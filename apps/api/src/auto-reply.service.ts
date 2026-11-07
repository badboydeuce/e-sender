import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { tokenDigest } from "./device-auth";
import { PrismaService } from "./prisma.service";
import { DevicesService } from "./devices.service";

type RuleInput={scope:"GLOBAL"|"DEVICE";device_id?:string|null;name:string;keyword?:string|null;message:string;enabled?:boolean;cooldown_minutes?:number;priority?:number};
@Injectable()
export class AutoReplyService {
  constructor(private readonly prisma:PrismaService,private readonly devices:DevicesService){}
  async settings(){
    const [global,devices]=await Promise.all([
      this.prisma.autoReplySettings.findUnique({where:{id:"global"}}),
      this.prisma.deviceAutoReplySettings.findMany({include:{device:{select:{id:true,name:true,active:true}}},orderBy:{updatedAt:"desc"}})
    ]);
    return {global:{enabled:global?.enabled??false},devices};
  }
  async setGlobal(enabled:boolean){return this.prisma.autoReplySettings.upsert({where:{id:"global"},create:{id:"global",enabled},update:{enabled}});}
  async setDevice(deviceId:string,enabled:boolean){
    const device=await this.prisma.device.findUnique({where:{id:deviceId}});
    if(!device)throw new NotFoundException("Device not found");
    return this.prisma.deviceAutoReplySettings.upsert({where:{deviceId},create:{deviceId,enabled},update:{enabled}});
  }
  async listRules(){return this.prisma.autoReplyRule.findMany({orderBy:[{scope:"asc"},{priority:"desc"},{createdAt:"asc"}],include:{device:{select:{id:true,name:true}}}});}
  private validate(input:RuleInput){
    if(!input.name.trim()||!input.message.trim())throw new BadRequestException("Rule name and reply message are required");
    if(input.scope==="DEVICE"&&!input.device_id)throw new BadRequestException("Select a device for a device-specific rule");
    if(input.scope==="GLOBAL"&&input.device_id)throw new BadRequestException("Global rules cannot be assigned to a device");
    if(input.cooldown_minutes!==undefined&&(!Number.isInteger(input.cooldown_minutes)||input.cooldown_minutes<0||input.cooldown_minutes>43200))throw new BadRequestException("Cooldown must be between 0 and 43200 minutes");
  }
  async createRule(input:RuleInput){
    this.validate(input);
    if(input.device_id&&!await this.prisma.device.findUnique({where:{id:input.device_id}}))throw new NotFoundException("Device not found");
    return this.prisma.autoReplyRule.create({data:{scope:input.scope,deviceId:input.device_id??null,name:input.name.trim(),keyword:input.keyword?.trim()||null,message:input.message.trim(),enabled:input.enabled??true,cooldownMinutes:input.cooldown_minutes??1440,priority:input.priority??0}});
  }
  async updateRule(id:string,input:Partial<RuleInput>){
    const current=await this.prisma.autoReplyRule.findUnique({where:{id}});
    if(!current)throw new NotFoundException("Auto-reply rule not found");
    const merged:RuleInput={scope:(input.scope??current.scope) as "GLOBAL"|"DEVICE",device_id:input.device_id===undefined?current.deviceId:input.device_id,name:input.name??current.name,keyword:input.keyword===undefined?current.keyword:input.keyword,message:input.message??current.message,enabled:input.enabled??current.enabled,cooldown_minutes:input.cooldown_minutes??current.cooldownMinutes,priority:input.priority??current.priority};
    this.validate(merged);
    if(merged.device_id&&!await this.prisma.device.findUnique({where:{id:merged.device_id}}))throw new NotFoundException("Device not found");
    return this.prisma.autoReplyRule.update({where:{id},data:{scope:merged.scope,deviceId:merged.device_id??null,name:merged.name.trim(),keyword:merged.keyword?.trim()||null,message:merged.message.trim(),enabled:merged.enabled,cooldownMinutes:merged.cooldown_minutes,priority:merged.priority}});
  }
  async deleteRule(id:string){const rule=await this.prisma.autoReplyRule.findUnique({where:{id}});if(!rule)throw new NotFoundException("Auto-reply rule not found");await this.prisma.autoReplyRule.delete({where:{id}});return{deleted:true,id};}
  async history(limit=100){return this.prisma.autoReplyEvent.findMany({take:Math.min(Math.max(limit,1),250),orderBy:{createdAt:"desc"},include:{device:{select:{id:true,name:true}},rule:{select:{id:true,name:true,scope:true}}}});}
  async receive(token:string,input:{message_id:string;from:string;text:string}){
    const device=await this.prisma.device.findUnique({where:{tokenHash:tokenDigest(token)}});
    if(!device||!device.active)throw new UnauthorizedException("Invalid or revoked device token");
    const phone=input.from.trim(),body=input.text.trim(),messageId=input.message_id.trim();
    if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new BadRequestException("Sender number must be in E.164 format");
    if(!messageId||messageId.length>200||!body||body.length>5000)throw new BadRequestException("Message ID and incoming message are required");
    const previous=await this.prisma.autoReplyEvent.findUnique({where:{deviceId_externalMessageId:{deviceId:device.id,externalMessageId:messageId}}});
    if(previous)return{duplicate:true,event_id:previous.id,reply:null,status:previous.status};
    const stop=/^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(body);
    if(stop){
      await this.prisma.$transaction(async tx=>{
        await tx.suppression.upsert({where:{phone},create:{phone,reason:"STOP"},update:{reason:"STOP"}});
        const matches=await tx.campaignRecipient.findMany({where:{phone},select:{id:true}});
        await tx.campaignRecipient.updateMany({where:{phone},data:{status:"OPTED_OUT"}});
        if(matches.length)await tx.batchRecipient.updateMany({where:{recipientId:{in:matches.map(x=>x.id)},status:"QUEUED"},data:{status:"SKIPPED",error:"Recipient opted out by incoming STOP message"}});
        await tx.autoReplyEvent.create({data:{deviceId:device.id,externalMessageId:messageId,phone,incomingText:body,status:"SUPPRESSED"}});
      });
      return{event_id:null,reply:null,status:"SUPPRESSED",opted_out:true};
    }
    const event=await this.prisma.autoReplyEvent.create({data:{deviceId:device.id,externalMessageId:messageId,phone,incomingText:body,status:"RECEIVED"}});
    const [global,deviceSettings,suppressed]=await Promise.all([
      this.prisma.autoReplySettings.findUnique({where:{id:"global"}}),
      this.prisma.deviceAutoReplySettings.findUnique({where:{deviceId:device.id}}),
      this.prisma.suppression.findUnique({where:{phone}})
    ]);
    if(suppressed)return this.finishNoReply(event.id,"SUPPRESSED");
    if(!global?.enabled||(deviceSettings&&!deviceSettings.enabled))return this.finishNoReply(event.id,"DISABLED");
    const rules=await this.prisma.autoReplyRule.findMany({where:{enabled:true,OR:[{scope:"DEVICE",deviceId:device.id},{scope:"GLOBAL",deviceId:null}]},orderBy:[{priority:"desc"},{createdAt:"asc"}]});
    const textLower=body.toLocaleLowerCase();
    const matching=(scope:"DEVICE"|"GLOBAL")=>rules.filter(r=>r.scope===scope&&r.keyword&&textLower.includes(r.keyword.toLocaleLowerCase()));
    const deviceMatch=matching("DEVICE")[0],globalMatch=matching("GLOBAL")[0];
    const deviceDefault=rules.find(r=>r.scope==="DEVICE"&&!r.keyword),globalDefault=rules.find(r=>r.scope==="GLOBAL"&&!r.keyword);
    const rule=deviceMatch??globalMatch??deviceDefault??globalDefault;
    if(!rule)return this.finishNoReply(event.id,"NO_RULE");
    if(rule.cooldownMinutes>0){
      const since=new Date(Date.now()-rule.cooldownMinutes*60000);
      const recent=await this.prisma.autoReplyEvent.findFirst({where:{phone,ruleId:rule.id,status:"SENT",createdAt:{gte:since}}});
      if(recent)return this.finishNoReply(event.id,"COOLDOWN");
    }
    await this.prisma.autoReplyEvent.update({where:{id:event.id},data:{ruleId:rule.id,replyText:rule.message,status:"REPLY_PENDING"}});
    return{event_id:event.id,reply:rule.message,status:"REPLY_PENDING",rule_id:rule.id,device_id:device.id};
  }
  private async finishNoReply(id:string,status:string){await this.prisma.autoReplyEvent.update({where:{id},data:{status}});return{event_id:id,reply:null,status};}
  async report(token:string,eventId:string,status:"SENT"|"FAILED",error?:string){
    const device=await this.prisma.device.findUnique({where:{tokenHash:tokenDigest(token)}});
    if(!device||!device.active)throw new UnauthorizedException("Invalid or revoked device token");
    const event=await this.prisma.autoReplyEvent.findUnique({where:{id:eventId}});
    if(!event||event.deviceId!==device.id)throw new NotFoundException("Auto-reply event not found for this device");
    if(event.status!=="REPLY_PENDING")throw new BadRequestException("Event is not awaiting a send report");
    return this.prisma.autoReplyEvent.update({where:{id:eventId},data:{status, error:error?.slice(0,500)??null,reportedAt:new Date()}});
  }
}
