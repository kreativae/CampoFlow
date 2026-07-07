import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { EncryptionModule } from './common/crypto/encryption.module';
import { StorageModule } from './common/storage/storage.module';
import { EmailModule } from './common/email/email.module';
import { QueueModule } from './common/queue/queue.module';
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
import { SoilAnalysisModule } from './soil-analysis/soil-analysis.module';
import { CropsModule } from './crops/crops.module';
import { ContactsModule } from './contacts/contacts.module';
import { EmployeesModule } from './employees/employees.module';
import { DocumentsModule } from './documents/documents.module';
import { ReportsModule } from './reports/reports.module';
import { BiModule } from './bi/bi.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BillingModule } from './billing/billing.module';
import { AdminModule } from './admin/admin.module';
import { TicketsModule } from './tickets/tickets.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    EncryptionModule,
    StorageModule,
    EmailModule,
    QueueModule,
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
    EmployeesModule,
    AgendaModule,
    MapFeaturesModule,
    SoilAnalysisModule,
    CropsModule,
    ContactsModule,
    DocumentsModule,
    ReportsModule,
    BiModule,
    NotificationsModule,
    BillingModule,
    AdminModule,
    TicketsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Must be registered before any other exception filter (SentryGlobalFilter is a
    // no-op when SENTRY_DSN isn't set — it just rethrows for Nest's default handler).
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
