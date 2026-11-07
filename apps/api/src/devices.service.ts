import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "./prisma.service";
import { safeEqual, tokenDigest } from "./device-auth";
@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}
  async enroll(code: string, name: string, platform: string) {
    if (!safeEqual(code, process.env.DEVICE_ENROLLMENT_CODE)) throw new ForbiddenException("Invalid enrollment code");
    const token = randomBytes(48).toString("base64url");
    const device = await this.prisma.device.create({ data: { name: name.trim(), platform, tokenHash: tokenDigest(token) }, select: { id: true, name: true, platform: true, createdAt: true } });
    return { device_id: device.id, device_name: device.name, device_token: token, token_type: "Device", message: "Save this token securely. It cannot be retrieved again." };
  }
  async heartbeat(token: string, appVersion?: string, shortcutVersion?: string) {
    const device = await this.prisma.device.findUnique({ where: { tokenHash: tokenDigest(token) } });
    if (!device || !device.active) throw new UnauthorizedException("Invalid or revoked device token");
    const updated = await this.prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() }, select: { id: true, lastSeenAt: true } });
    return { accepted: true, device_id: updated.id, server_time: updated.lastSeenAt?.toISOString(), app_version: appVersion ?? null, shortcut_version: shortcutVersion ?? null };
  }
  async listDevices() {
    return this.prisma.device.findMany({ orderBy: [{ active: "desc" }, { lastSeenAt: "desc" }, { createdAt: "desc" }], select: { id: true, name: true, platform: true, active: true, lastSeenAt: true, createdAt: true } });
  }
  async revoke(deviceId: string) {
    const exists = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!exists) throw new NotFoundException("Device not found");
    await this.prisma.device.update({ where: { id: deviceId }, data: { active: false } });
    return { device_id: deviceId, active: false };
  }
  requireAdmin(authHeader?: string) {
    const expected = process.env.ADMIN_API_TOKEN;
    if (!expected || expected.length < 32 || authHeader !== "Bearer " + expected) throw new UnauthorizedException("Admin authentication required");
  }
}
