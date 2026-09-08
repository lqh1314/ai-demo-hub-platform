import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { QueueService } from './queue.service';
import { RealtimeBus } from './realtime.bus';
import { CallService } from './call.service';
import { CallController } from './call.controller';
import { CtiController } from './cti.controller';
import { RealtimeGateway } from './realtime.gateway';
import { BotModule } from '../bot/bot.module';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [BotModule, CrmModule],
  controllers: [CallController, CtiController],
  providers: [PresenceService, QueueService, RealtimeBus, CallService, RealtimeGateway],
  exports: [CallService, PresenceService, QueueService, RealtimeBus],
})
export class TelephonyModule {}
