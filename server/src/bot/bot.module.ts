import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotController } from './bot.controller';
import { DialogOrchestrator } from './dialog.orchestrator';

@Module({
  controllers: [BotController],
  providers: [BotService, DialogOrchestrator],
  exports: [BotService, DialogOrchestrator],
})
export class BotModule {}
