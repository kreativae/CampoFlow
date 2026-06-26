import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { ReproductionModule } from './reproduction/reproduction.module';
import { FinanceModule } from './finance/finance.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditLogInterceptor } from './audit/audit-log.interceptor';
import { QuotationsModule } from './quotations/quotations.module';
import { WeatherModule } from './weather/weather.module';
import { SuppliesModule } from './supplies/supplies.module';
import { MachinesModule } from './machines/machines.module';
import { TeamsModule } from './teams/teams.module';
import { AgendaModule } from './agenda/agenda.module';
import { MapFeaturesModule } from './map-features/map-features.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    FarmsModule,
    PasturesModule,
    AnimalsModule,
    HealthRecordsModule,
    WeighingsModule,
    ReproductionModule,
    FinanceModule,
    DashboardModule,
    QuotationsModule,
    WeatherModule,
    SuppliesModule,
    MachinesModule,
    TeamsModule,
    AgendaModule,
    MapFeaturesModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
