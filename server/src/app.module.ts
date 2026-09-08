import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { ProviderModule } from './providers/provider.module';
import { JwtAuthGuard } from './common/auth.guard';
import { TenantInterceptor } from './common/tenant.interceptor';
import { IamModule } from './iam/iam.module';
import { CrmModule } from './crm/crm.module';
import { BotModule } from './bot/bot.module';
import { TelephonyModule } from './telephony/telephony.module';
import { OutboundModule } from './outbound/outbound.module';
import { QaModule } from './qa/qa.module';
import { ContractModule } from './contract/contract.module';
import { MessageModule } from './message/message.module';
import { ReportModule } from './report/report.module';
import { IntegrationModule } from './integration/integration.module';
import { SystemModule } from './system/system.module';
import { HealthController } from './common/health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    CommonModule,
    ProviderModule,
    IamModule,
    CrmModule,
    BotModule,
    TelephonyModule,
    OutboundModule,
    QaModule,
    ContractModule,
    MessageModule,
    ReportModule,
    IntegrationModule,
    SystemModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
})
export class AppModule {}
