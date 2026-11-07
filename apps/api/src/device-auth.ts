import { createHmac, timingSafeEqual } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";

export function tokenDigest(token: string): string {
  const secret = process.env.DEVICE_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("DEVICE_TOKEN_SECRET must be set to at least 32 characters");
  }
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function safeEqual(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireDeviceHeader(value: string | undefined): string {
  if (!value || value.length < 32 || value.length > 256) {
    throw new UnauthorizedException("Device authentication required");
  }
  return value;
}
