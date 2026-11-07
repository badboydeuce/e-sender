import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { PrismaService } from "./prisma.service";
import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";

@Module({
  controllers: [HealthController, DevicesController],
  providers: [PrismaService, DevicesService],
})
export class AppModule {}
