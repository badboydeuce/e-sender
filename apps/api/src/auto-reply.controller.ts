import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { DevicesService } from "./devices.service";
import { AutoReplyService } from "./auto-reply.service";
class RuleDto {
  @IsIn(["GLOBAL","DEVICE"]) scope!:"GLOBAL"|"DEVICE";
  @IsOptional() @IsString() device_id?:string|null;
  @IsString() @MinLength(1) @MaxLength(100) name!:string;
  @IsOptional() @IsString() @MaxLength(100) keyword?:string|null;
  @IsString() @MinLength(1) @MaxLength(2000) message!:string;
  @IsOptional() @IsBoolean() enabled?:boolean;
  @IsOptional() @IsInt() @Min(0) @Max(43200) cooldown_minutes?:number;
  @IsOptional() @IsInt() @Min(-1000) @Max(1000) priority?:number;
}
class GlobalSettingsDto { @IsBoolean() enabled!:boolean; }
class DeviceSettingsDto { @IsBoolean() enabled!:boolean; }
class IncomingDto {
  @IsString() @MaxLength(200) message_id!:string;
  @IsString() @MaxLength(20) from!:string;
  @IsString() @MaxLength(5000) text!:string;
}
class SendReportDto {
  @IsIn(["SENT","FAILED"]) status!:"SENT"|"FAILED";
  @IsOptional() @IsString() @MaxLength(500) error?:string;
}
@Controller()
export class AutoReplyController {
  constructor(private readonly auto:AutoReplyService,private readonly devices:DevicesService){}
  private admin(auth?:string){this.devices.requireAdmin(auth);}
  @Get("admin/auto-reply/settings") settings(@Headers("authorization") auth?:string){this.admin(auth);return this.auto.settings();}
  @Patch("admin/auto-reply/settings/global") global(@Headers("authorization") auth:string|undefined,@Body() body:GlobalSettingsDto){this.admin(auth);return this.auto.setGlobal(body.enabled);}
  @Patch("admin/auto-reply/settings/devices/:deviceId") device(@Headers("authorization") auth:string|undefined,@Param("deviceId") id:string,@Body() body:DeviceSettingsDto){this.admin(auth);return this.auto.setDevice(id,body.enabled);}
  @Get("admin/auto-reply/rules") rules(@Headers("authorization") auth?:string){this.admin(auth);return this.auto.listRules();}
  @Post("admin/auto-reply/rules") create(@Headers("authorization") auth:string|undefined,@Body() body:RuleDto){this.admin(auth);return this.auto.createRule(body);}
  @Patch("admin/auto-reply/rules/:id") update(@Headers("authorization") auth:string|undefined,@Param("id") id:string,@Body() body:Partial<RuleDto>){this.admin(auth);return this.auto.updateRule(id,body);}
  @Delete("admin/auto-reply/rules/:id") remove(@Headers("authorization") auth:string|undefined,@Param("id") id:string){this.admin(auth);return this.auto.deleteRule(id);}
  @Get("admin/auto-reply/history") history(@Headers("authorization") auth:string|undefined,@Query("limit") limit?:string){this.admin(auth);return this.auto.history(Number(limit)||100);}
  @Post("device/incoming-message") @HttpCode(200) incoming(@Headers("x-device-token") token:string|undefined,@Body() body:IncomingDto){if(!token)throw new Error("Device token required");return this.auto.receive(token,body);}
  @Post("device/auto-reply/:eventId/report") @HttpCode(200) report(@Headers("x-device-token") token:string|undefined,@Param("eventId") id:string,@Body() body:SendReportDto){if(!token)throw new Error("Device token required");return this.auto.report(token,id,body.status,body.error);}
}
