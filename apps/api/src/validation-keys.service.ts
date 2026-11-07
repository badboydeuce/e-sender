import { Injectable, ServiceUnavailableException, BadRequestException, NotFoundException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { PrismaService } from "./prisma.service";
type ProviderResult = Record<string, unknown> & { valid?: boolean; line_type?: string };
@Injectable()
export class ValidationKeysService {
  constructor(private readonly prisma: PrismaService) {}
  private encryptionKey(): Buffer {
    const secret = process.env.API_KEY_ENCRYPTION_SECRET;
    if (!secret || secret.length < 32) throw new ServiceUnavailableException("API_KEY_ENCRYPTION_SECRET must be configured with at least 32 characters");
    return scryptSync(secret, "esender-apilayer-key-v1", 32);
  }
  private encrypt(value: string) {
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return { encryptedKey: encrypted.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
  }
  private decrypt(row: { encryptedKey: string; iv: string; authTag: string }) {
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(row.iv, "base64"));
    decipher.setAuthTag(Buffer.from(row.authTag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(row.encryptedKey, "base64")), decipher.final()]).toString("utf8");
  }
  async list() {
    const rows = await this.prisma.validationApiKey.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(r => ({ id:r.id,label:r.label,masked:"••••••"+r.lastFour,enabled:r.enabled,status:r.status,request_count:r.requestCount,failure_count:r.failureCount,last_used_at:r.lastUsedAt,last_error:r.lastError,cooldown_until:r.cooldownUntil,created_at:r.createdAt }));
  }
  async importLines(input: string) {
    const keys = [...new Set(input.split(/\r?\n/).map(v=>v.trim()).filter(Boolean))];
    if (!keys.length) throw new BadRequestException("Paste at least one API key, one per line");
    if (keys.length > 100) throw new BadRequestException("Import is limited to 100 keys at a time");
    let added=0, skipped=0;
    for (const key of keys) {
      const fingerprint=createHash("sha256").update(key).digest("hex");
      if (await this.prisma.validationApiKey.findUnique({where:{fingerprint},select:{id:true}})) { skipped++; continue; }
      const encrypted=this.encrypt(key);
      await this.prisma.validationApiKey.create({data:{label:"APILayer key "+(await this.prisma.validationApiKey.count()+1),...encrypted,fingerprint,lastFour:key.slice(-4)}});
      added++;
    }
    return {added,skipped};
  }
  async setEnabled(id:string,enabled:boolean) {
    const row=await this.prisma.validationApiKey.findUnique({where:{id}});
    if(!row) throw new NotFoundException("API key not found");
    return this.prisma.validationApiKey.update({where:{id},data:{enabled,status:enabled?"READY":"DISABLED",lastError:null,cooldownUntil:null},select:{id:true,enabled:true,status:true}});
  }
  async remove(id:string) {
    if(!await this.prisma.validationApiKey.findUnique({where:{id},select:{id:true}})) throw new NotFoundException("API key not found");
    await this.prisma.validationApiKey.delete({where:{id}}); return {deleted:true};
  }
  private async reserveKey(excluded:Set<string>) {
    return this.prisma.$transaction(async tx=>{
      await tx.validationKeyRotation.upsert({where:{id:"global"},create:{id:"global",sequence:0n},update:{}});
      const rows=await tx.$queryRaw<Array<{sequence:bigint}>>`SELECT sequence FROM "ValidationKeyRotation" WHERE id = 'global' FOR UPDATE`;
      const sequence=rows[0]?.sequence??0n, now=new Date();
      const candidates=await tx.validationApiKey.findMany({where:{enabled:true,id:{notIn:[...excluded]},OR:[{cooldownUntil:null},{cooldownUntil:{lte:now}}]},orderBy:{createdAt:"asc"}});
      if(!candidates.length)return null;
      const selected=candidates[Number(sequence%BigInt(candidates.length))];
      await tx.validationKeyRotation.update({where:{id:"global"},data:{sequence:{increment:1n}}});
      await tx.validationApiKey.update({where:{id:selected.id},data:{requestCount:{increment:1},lastUsedAt:now}});
      return selected;
    });
  }
  async validateNumber(phone:string):Promise<ProviderResult> {
    const excluded=new Set<string>(); let lastError="No enabled APILayer keys are available";
    for(let attempt=0;attempt<10;attempt++) {
      const row=await this.reserveKey(excluded); if(!row)break; excluded.add(row.id);
      try {
        const response=await fetch("https://api.apilayer.com/number_verification/validate?number="+encodeURIComponent(phone),{headers:{apikey:this.decrypt(row)},signal:AbortSignal.timeout(12000)});
        if(response.ok) {
          await this.prisma.validationApiKey.update({where:{id:row.id},data:{status:"READY",lastError:null,cooldownUntil:null}});
          return await response.json() as ProviderResult;
        }
        lastError="APILayer returned HTTP "+response.status;
        const authError=response.status===401||response.status===403;
        await this.prisma.validationApiKey.update({where:{id:row.id},data:{failureCount:{increment:1},status:authError?"AUTH_ERROR":response.status===429?"RATE_LIMITED":"ERROR",lastError,cooldownUntil:authError?null:new Date(Date.now()+(response.status===429?5:1)*60000)}});
      } catch(error) {
        lastError=error instanceof Error?error.message:"APILayer request failed";
        await this.prisma.validationApiKey.update({where:{id:row.id},data:{failureCount:{increment:1},status:"ERROR",lastError,cooldownUntil:new Date(Date.now()+60000)}});
      }
    }
    throw new ServiceUnavailableException(lastError);
  }
  async test(id:string) {
    const row=await this.prisma.validationApiKey.findUnique({where:{id}});
    if(!row)throw new NotFoundException("API key not found");
    const response=await fetch("https://api.apilayer.com/number_verification/validate?number=%2B14155552671",{headers:{apikey:this.decrypt(row)},signal:AbortSignal.timeout(12000)});
    const ok=response.ok, message=ok?"APILayer accepted the key. This test may count as one provider request.":"APILayer returned HTTP "+response.status;
    await this.prisma.validationApiKey.update({where:{id},data:{requestCount:{increment:1},lastUsedAt:new Date(),failureCount:ok?undefined:{increment:1},status:ok?"READY":response.status===401||response.status===403?"AUTH_ERROR":response.status===429?"RATE_LIMITED":"ERROR",lastError:ok?null:message,cooldownUntil:!ok&&response.status===429?new Date(Date.now()+300000):null}});
    return {ok,status_code:response.status,message};
  }
}
