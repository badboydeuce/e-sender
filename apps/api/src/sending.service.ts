import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { tokenDigest } from "./device-auth";
import { PrismaService } from "./prisma.service";
import { DevicesService } from "./devices.service";
import { parseMessageVariants } from "./message-variants";
type ReportItem={item_id:string;status:"SENT"|"FAILED"|"SKIPPED";error?:string;provider_message_id?:string};
@Injectable()
export class SendingService {
 constructor(private readonly prisma:PrismaService,private readonly devices:DevicesService){}
 async previewBatch(campaignId:string,deviceId:string,limit?:number){
  // Lock the campaign row to serialize previews and prevent duplicate recipient reservations.
  return this.prisma.$transaction(async tx=>{
   await tx.$queryRaw<Array<{id:string}>>\`SELECT "id" FROM "Campaign" WHERE "id" = \${campaignId} FOR UPDATE\`;
   const campaign=await tx.campaign.findUnique({where:{id:campaignId},include:{devices:true}});
   if(!campaign)throw new NotFoundException("Campaign not found");
   if(["STOPPED","PAUSED"].includes(campaign.status))throw new BadRequestException("Campaign is paused or stopped");
   const device=await tx.device.findUnique({where:{id:deviceId}});
   if(!device||!device.active)throw new BadRequestException("Selected device is not active");
   if(!campaign.devices.some(d=>d.deviceId===deviceId))throw new BadRequestException("Device is not assigned to this campaign");
   const size=Math.min(Math.max(limit??campaign.batchSize,1),campaign.batchSize);
   const blocked=(await tx.suppression.findMany({select:{phone:true}})).map(s=>s.phone);
   const rows=await tx.campaignRecipient.findMany({where:{campaignId,status:"ELIGIBLE",consented:true,batchItems:{none:{status:"QUEUED"}},phone:{notIn:blocked}},orderBy:{createdAt:"asc"},take:size});
   if(!rows.length)throw new BadRequestException("No eligible, opted-in recipients are available for the next batch");
   const messages=parseMessageVariants(campaign.messageSet);
   if(!messages.length)throw new BadRequestException("Campaign has no usable message variants");
   const previousCount=await tx.batchRecipient.count({where:{batch:{campaignId}}});
   const batch=await tx.campaignBatch.create({data:{campaignId,deviceId,status:"PENDING_APPROVAL",recipients:{create:rows.map((r,i)=>({recipientId:r.id,message:messages[(previousCount+i)%messages.length]}))}},include:{recipients:{include:{recipient:{select:{phone:true}}}}}});
   return {batch_id:batch.id,campaign_id:campaignId,device_id:deviceId,status:batch.status,recipient_count:batch.recipients.length,recipients:batch.recipients.map(r=>({item_id:r.id,phone:r.recipient.phone,message:r.message})),requires_approval:true};
  });
 }
 async approveBatch(id:string){
  return this.prisma.$transaction(async tx=>{
   const initial=await tx.campaignBatch.findUnique({where:{id},select:{campaignId:true}});
   if(!initial)throw new NotFoundException("Batch not found");
   await tx.$queryRaw<Array<{id:string}>>\`SELECT "id" FROM "Campaign" WHERE "id" = \${initial.campaignId} FOR UPDATE\`;
   await tx.$queryRaw<Array<{id:string}>>\`SELECT "id" FROM "CampaignBatch" WHERE "id" = \${id} FOR UPDATE\`;
   const batch=await tx.campaignBatch.findUnique({where:{id},include:{campaign:true,device:true}});
   if(!batch)throw new NotFoundException("Batch not found");
   if(batch.status!=="PENDING_APPROVAL")throw new BadRequestException("Only a pending batch can be approved");
   if(["PAUSED","STOPPED"].includes(batch.campaign.status)||!batch.device.active)throw new BadRequestException("Campaign or device is not active");
   const blocked=await tx.suppression.findMany({select:{phone:true}});
   const items=await tx.batchRecipient.findMany({where:{batchId:id,status:"QUEUED"},include:{recipient:true}});
   const allowed=items.filter(i=>i.recipient.consented&&i.recipient.status==="ELIGIBLE"&&!blocked.some(s=>s.phone===i.recipient.phone));
   await tx.batchRecipient.updateMany({where:{batchId:id,status:"QUEUED",id:{notIn:allowed.map(i=>i.id)}},data:{status:"SKIPPED",error:"Consent, eligibility or suppression check failed"}});
   if(allowed.length)await tx.campaignRecipient.updateMany({where:{id:{in:allowed.map(i=>i.recipientId)},status:"ELIGIBLE"},data:{status:"QUEUED"}});
   await tx.campaignBatch.update({where:{id},data:{status:"APPROVED",approvedAt:new Date()}});
   await tx.campaign.update({where:{id:batch.campaignId},data:{status:"ACTIVE"}});
   return {batch_id:id,status:"APPROVED",approved_recipients:allowed.length,skipped:items.length-allowed.length};
  });
 }
 async cancelBatch(id:string){const b=await this.prisma.campaignBatch.findUnique({where:{id}});if(!b)throw new NotFoundException("Batch not found");if(["IN_PROGRESS","COMPLETED"].includes(b.status))throw new BadRequestException("A batch already handed to a device cannot be cancelled as pending");await this.prisma.batchRecipient.updateMany({where:{batchId:id,status:"QUEUED"},data:{status:"SKIPPED",error:"Batch cancelled by administrator"}});return this.prisma.campaignBatch.update({where:{id},data:{status:"CANCELLED"}});}
 async poll(token:string){
  const device=await this.prisma.device.findUnique({where:{tokenHash:tokenDigest(token)}});
  if(!device||!device.active)throw new UnauthorizedException("Invalid or revoked device token");
  await this.prisma.device.update({where:{id:device.id},data:{lastSeenAt:new Date()}});
  const batch=await this.prisma.campaignBatch.findFirst({where:{deviceId:device.id,status:{in:["APPROVED","IN_PROGRESS"]},campaign:{status:"ACTIVE"}},orderBy:{createdAt:"asc"},include:{campaign:true,recipients:{where:{status:"QUEUED"},include:{recipient:{select:{phone:true,consented:true,status:true}}},orderBy:{createdAt:"asc"}}}});
  if(!batch)return {has_work:false,device_id:device.id,server_time:new Date().toISOString()};
  if(batch.status==="APPROVED")await this.prisma.campaignBatch.update({where:{id:batch.id},data:{status:"IN_PROGRESS",startedAt:new Date()}});
  return {has_work:true,batch_id:batch.id,campaign_id:batch.campaignId,batch_size:batch.recipients.length,items:batch.recipients.filter(r=>r.recipient.consented&&r.recipient.status==="QUEUED").map(r=>({item_id:r.id,phone:r.recipient.phone,message:r.message})),server_time:new Date().toISOString(),instruction:"Send each item once using this iPhone's selected SIM/eSIM. Report every result. Do not retry an item unless explicitly reissued."};
 }
 async report(token:string,batchId:string,items:ReportItem[]){
  const device=await this.prisma.device.findUnique({where:{tokenHash:tokenDigest(token)}});
  if(!device||!device.active)throw new UnauthorizedException("Invalid or revoked device token");
  const batch=await this.prisma.campaignBatch.findUnique({where:{id:batchId},include:{campaign:true}});
  if(!batch||batch.deviceId!==device.id)throw new NotFoundException("Batch not found for this device");
  if(batch.status!=="IN_PROGRESS")throw new BadRequestException("Batch is not in progress");
  // Reports from work already handed to iOS remain valid after an admin pauses/stops future work.
  const ids=[...new Set(items.map(i=>i.item_id))];
  const known=await this.prisma.batchRecipient.findMany({where:{id:{in:ids},batchId},include:{recipient:true}});
  if(known.length!==ids.length)throw new BadRequestException("Report contains an item not belonging to this batch");
  let updated=0;
  for(const item of items){
   if(!["SENT","FAILED","SKIPPED"].includes(item.status))continue;
   const row=known.find(x=>x.id===item.item_id)!;
   const status=await this.prisma.batchRecipient.updateMany({where:{id:item.item_id,batchId,status:"QUEUED"},data:{status:item.status,attemptedAt:new Date(),sentAt:item.status==="SENT"?new Date():null,error:item.error?.slice(0,500)??null,providerMessageId:item.provider_message_id?.slice(0,200)??null}});
   if(status.count){updated++;await this.prisma.campaignRecipient.updateMany({where:{id:row.recipientId,status:{not:"OPTED_OUT"}},data:{status:item.status==="SENT"?"SENT":item.status==="FAILED"?"SEND_FAILED":"SKIPPED"}});}
  }
  const remaining=await this.prisma.batchRecipient.count({where:{batchId,status:"QUEUED"}});
  if(remaining===0)await this.prisma.campaignBatch.update({where:{id:batchId},data:{status:"COMPLETED",completedAt:new Date()}});
  return {batch_id:batchId,updated,remaining,status:remaining===0?"COMPLETED":"IN_PROGRESS"};
 }
 async reportSummary(campaignId:string){
  const campaign=await this.prisma.campaign.findUnique({where:{id:campaignId}});if(!campaign)throw new NotFoundException("Campaign not found");
  const [batches,items]=await Promise.all([this.prisma.campaignBatch.findMany({where:{campaignId},orderBy:{createdAt:"desc"},include:{device:{select:{id:true,name:true}},_count:{select:{recipients:true}}}}),this.prisma.batchRecipient.groupBy({by:["status"],where:{batch:{campaignId}},_count:{_all:true}})]);
  return {campaign_id:campaignId,batches,recipient_totals:Object.fromEntries(items.map(x=>[x.status,x._count._all]))};
 }
}
