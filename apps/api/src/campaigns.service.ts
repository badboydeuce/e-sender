import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { ValidationKeysService } from "./validation-keys.service";
@Injectable()
export class CampaignsService {
 constructor(private readonly prisma:PrismaService,private readonly validationKeys:ValidationKeysService){}
 async create(input:{name:string;messages:string[];batchSize?:number}) {
  const messages=input.messages.map(v=>v.trim()).filter(Boolean);
  if(!input.name.trim()||messages.length===0)throw new BadRequestException("Campaign name and at least one message are required");
  if((input.batchSize??20)<1||(input.batchSize??20)>500)throw new BadRequestException("Batch size must be between 1 and 500");
  return this.prisma.campaign.create({data:{name:input.name.trim(),messageSet:messages.join("\n==\n"),batchSize:input.batchSize??20}});
 }
 async list(){return this.prisma.campaign.findMany({orderBy:{createdAt:"desc"},include:{_count:{select:{recipients:true,devices:true}}}});}
 async detail(id:string){const c=await this.prisma.campaign.findUnique({where:{id},include:{_count:{select:{recipients:true,devices:true}}}});if(!c)throw new NotFoundException("Campaign not found");return c;}
 async setStatus(id:string,status:string){if(!["DRAFT","PAUSED","STOPPED"].includes(status))throw new BadRequestException("Only DRAFT, PAUSED or STOPPED can be set manually");await this.detail(id);return this.prisma.campaign.update({where:{id},data:{status}});}
 async assignDevices(id:string,deviceIds:string[]){await this.detail(id);const devices=await this.prisma.device.findMany({where:{id:{in:[...new Set(deviceIds)]},active:true},select:{id:true}});if(devices.length!==new Set(deviceIds).size)throw new BadRequestException("Every selected device must exist and be active");await this.prisma.$transaction([this.prisma.campaignDevice.deleteMany({where:{campaignId:id}}),...devices.map(d=>this.prisma.campaignDevice.create({data:{campaignId:id,deviceId:d.id}}))]);return{campaign_id:id,assigned_devices:devices.length};}
 async importRecipients(id:string,rawPhones:string[],consentConfirmed:boolean){
  if(!consentConfirmed)throw new BadRequestException("Confirm that every imported recipient has opted in before importing");await this.detail(id);
  const phones=[...new Set(rawPhones.map(v=>v.trim()).filter(Boolean))];if(!phones.length||phones.length>500)throw new BadRequestException("Provide between 1 and 500 phone numbers per import");
  const results:Array<{phone:string;status:string;reason?:string}>=[];
  for(const phone of phones){
   if(!/^\+[1-9]\d{7,14}$/.test(phone)){results.push({phone,status:"INVALID_FORMAT"});continue;}
   if(await this.prisma.suppression.findUnique({where:{phone}})){results.push({phone,status:"OPTED_OUT"});continue;}
   if(await this.prisma.campaignRecipient.findUnique({where:{campaignId_phone:{campaignId:id,phone}}})){results.push({phone,status:"DUPLICATE"});continue;}
   const recipient=await this.prisma.campaignRecipient.create({data:{campaignId:id,phone,consented:true,consentAt:new Date(),status:"VALIDATING"}});
   try{const validation=await this.validationKeys.validateNumber(phone);const valid=validation.valid===true&&validation.line_type==="mobile";const status=valid?"ELIGIBLE":"INVALID_NUMBER";await this.prisma.campaignRecipient.update({where:{id:recipient.id},data:{status,validation}});results.push({phone,status,reason:valid?undefined:"Number must be valid and mobile"});}
   catch(error){const message=error instanceof Error?error.message:"Validation failed";await this.prisma.campaignRecipient.update({where:{id:recipient.id},data:{status:"VALIDATION_ERROR",validation:{error:message}}});results.push({phone,status:"VALIDATION_ERROR",reason:message});}
  }
  return{campaign_id:id,processed:results.length,eligible:results.filter(r=>r.status==="ELIGIBLE").length,results};
 }
 async recipients(id:string){await this.detail(id);return this.prisma.campaignRecipient.findMany({where:{campaignId:id},orderBy:{createdAt:"asc"}});}
 async stopRecipient(phoneInput:string){const phone=phoneInput.trim();if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new BadRequestException("Phone number must be in E.164 format");await this.prisma.suppression.upsert({where:{phone},create:{phone,reason:"STOP"},update:{reason:"STOP"}});const matches=await this.prisma.campaignRecipient.findMany({where:{phone},select:{id:true}});await this.prisma.campaignRecipient.updateMany({where:{phone},data:{status:"OPTED_OUT"}});if(matches.length)await this.prisma.batchRecipient.updateMany({where:{recipientId:{in:matches.map(r=>r.id)},status:"QUEUED"},data:{status:"SKIPPED",error:"Recipient opted out"}});return{phone,opted_out:true};}
}
