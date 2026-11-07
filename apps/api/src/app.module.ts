import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { PrismaService } from "./prisma.service";
import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";
import { ValidationKeysController } from "./validation-keys.controller";
import { ValidationKeysService } from "./validation-keys.service";
@Module({controllers:[HealthController,DevicesController,CampaignsController,ValidationKeysController],providers:[PrismaService,DevicesService,CampaignsService,ValidationKeysService]})
export class AppModule {}
