import { Body, Controller, Get, Headers, HttpCode, Param, Post } from "@nestjs/common";
import { IsArray, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { DevicesService } from "./devices.service";
import { SendingService } from "./sending.service";
class PreviewDto { @IsString() campaign_id!:string; @IsString() device_id!:string; }
class ReportItemDto { @IsString() item_id!:string; @IsIn(["SENT","FAILED","SKIPPED"]) status!:"SENT"|"FAILED"|"SKIPPED"; @IsOptional() @IsString() @MaxLength(500) error?:string; @IsOptional() @IsString() @MaxLength(200) provider_message_id?:string; }
class ReportDto { @IsArray() items!:ReportItemDto[]; }
@Controller()
export class SendingController {
 constructor(private readonly sending:SendingService,private readonly devices:DevicesService){}
 @Post("admin/batches/preview") preview(@Headers("authorization") auth:string|undefined,@Body() body:PreviewDto){this.devices.requireAdmin(auth);return this.sending.previewBatch(body.campaign_id,body.device_id);}
 @Post("admin/batches/:id/approve") approve(@Headers("authorization") auth:string|undefined,@Param("id") id:string){this.devices.requireAdmin(auth);return this.sending.approveBatch(id);}
 @Post("admin/batches/:id/cancel") cancel(@Headers("authorization") auth:string|undefined,@Param("id") id:string){this.devices.requireAdmin(auth);return this.sending.cancelBatch(id);}
 @Get("admin/campaigns/:id/report") report(@Headers("authorization") auth:string|undefined,@Param("id") id:string){this.devices.requireAdmin(auth);return this.sending.reportSummary(id);}
 @Get("device/command") command(@Headers("x-device-token") token?:string){if(!token)throw new Error("Device token required");return this.sending.poll(token);}
 @Post("device/batches/:id/report") @HttpCode(200) deviceReport(@Headers("x-device-token") token:string|undefined,@Param("id") id:string,@Body() body:ReportDto){if(!token)throw new Error("Device token required");return this.sending.report(token,id,body.items);}
}
