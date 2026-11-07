import { Body, Controller, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { CampaignsService } from "./campaigns.service";
import { DevicesService } from "./devices.service";

class CreateCampaignDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsArray() @IsString({ each: true }) messages!: string[];
  @IsOptional() @IsInt() @Min(1) @Max(500) batch_size?: number;
}
class ImportRecipientsDto {
  @IsArray() @IsString({ each: true }) phones!: string[];
  @IsBoolean() consent_confirmed!: boolean;
}
class StatusDto {
  @IsString() @IsIn(["DRAFT", "PAUSED", "STOPPED"]) status!: string;
}
class AssignDevicesDto {
  @IsArray() @IsString({ each: true }) device_ids!: string[];
}
class StopDto {
  @IsString() phone!: string;
}
@Controller()
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService, private readonly devices: DevicesService) {}
  private admin(header?: string) { this.devices.requireAdmin(header); }

  @Get("admin/campaigns")
  list(@Headers("authorization") auth?: string) { this.admin(auth); return this.campaigns.list(); }

  @Post("admin/campaigns")
  create(@Headers("authorization") auth: string | undefined, @Body() body: CreateCampaignDto) {
    this.admin(auth); return this.campaigns.create({ name: body.name, messages: body.messages, batchSize: body.batch_size });
  }

  @Get("admin/campaigns/:id")
  detail(@Headers("authorization") auth: string | undefined, @Param("id") id: string) {
    this.admin(auth); return this.campaigns.detail(id);
  }

  @Patch("admin/campaigns/:id/status")
  status(@Headers("authorization") auth: string | undefined, @Param("id") id: string, @Body() body: StatusDto) {
    this.admin(auth); return this.campaigns.setStatus(id, body.status);
  }

  @Post("admin/campaigns/:id/devices")
  assign(@Headers("authorization") auth: string | undefined, @Param("id") id: string, @Body() body: AssignDevicesDto) {
    this.admin(auth); return this.campaigns.assignDevices(id, body.device_ids);
  }

  @Post("admin/campaigns/:id/recipients/import")
  importRecipients(@Headers("authorization") auth: string | undefined, @Param("id") id: string, @Body() body: ImportRecipientsDto) {
    this.admin(auth); return this.campaigns.importRecipients(id, body.phones, body.consent_confirmed);
  }

  @Get("admin/campaigns/:id/recipients")
  recipients(@Headers("authorization") auth: string | undefined, @Param("id") id: string) {
    this.admin(auth); return this.campaigns.recipients(id);
  }

  @Post("recipient/stop")
  stop(@Body() body: StopDto) { return this.campaigns.stopRecipient(body.phone); }
}
