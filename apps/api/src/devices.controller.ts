import { Body, Controller, Get, Headers, HttpCode, Param, Post } from "@nestjs/common";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { DevicesService } from "./devices.service";
import { requireDeviceHeader } from "./device-auth";
class EnrollDto {
  @IsString() @MinLength(1) @MaxLength(256) enrollment_code!: string;
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsString() @IsIn(["iOS"]) platform!: string;
}
class HeartbeatDto {
  @IsOptional() @IsString() @MaxLength(40) app_version?: string;
  @IsOptional() @IsString() @MaxLength(40) shortcut_version?: string;
}
@Controller()
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}
  @Post("device/enroll") @HttpCode(200)
  enroll(@Body() body: EnrollDto) { return this.devices.enroll(body.enrollment_code, body.name, body.platform); }
  @Post("device/heartbeat") @HttpCode(200)
  heartbeat(@Headers("x-device-token") header: string | undefined, @Body() body: HeartbeatDto) {
    return this.devices.heartbeat(requireDeviceHeader(header), body.app_version, body.shortcut_version);
  }
  @Get("admin/devices")
  listDevices(@Headers("authorization") authorization?: string) {
    this.devices.requireAdmin(authorization);
    return this.devices.listDevices();
  }
  @Post("admin/devices/:deviceId/revoke") @HttpCode(200)
  revoke(@Param("deviceId") deviceId: string, @Headers("authorization") authorization?: string) {
    this.devices.requireAdmin(authorization);
    return this.devices.revoke(deviceId);
  }
}
