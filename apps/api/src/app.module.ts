import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { PrismaService } from "./prisma.service";
import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";

@Module({
  controllers: [HealthController, DevicesController, CampaignsController],
  providers: [PrismaService, DevicesService, CampaignsService],
})
export class AppModule {}
