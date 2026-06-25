import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { FarmsModule } from './farms/farms.module';
import { PasturesModule } from './pastures/pastures.module';
import { AnimalsModule } from './animals/animals.module';
import { HealthRecordsModule } from './health-records/health-records.module';
import { WeighingsModule } from './weighings/weighings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    FarmsModule,
    PasturesModule,
    AnimalsModule,
    HealthRecordsModule,
    WeighingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
