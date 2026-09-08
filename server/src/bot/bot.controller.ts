import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { BotService } from './bot.service';

@Controller()
export class BotController {
  constructor(private svc: BotService) {}
  @Get('bot/config') getConfig() { return this.svc.getConfig(); }
  @Patch('bot/config') updateConfig(@Body() b: any) { return this.svc.updateConfig(b); }

  @Get('intents') listIntents(@Query() q: any) { return this.svc.listIntents(q); }
  @Post('intents') createIntent(@Body() b: any) { return this.svc.createIntent(b); }
  @Patch('intents/:id') updateIntent(@Param('id') id: string, @Body() b: any) { return this.svc.updateIntent(id, b); }
  @Delete('intents/:id') deleteIntent(@Param('id') id: string) { return this.svc.deleteIntent(id); }

  @Get('kb/bases') bases() { return this.svc.listKnowledgeBases(); }
  @Get('kb/articles') listKb(@Query() q: any) { return this.svc.listKb(q); }
  @Post('kb/articles') createKb(@Body() b: any) { return this.svc.createKb(b); }
  @Patch('kb/articles/:id') updateKb(@Param('id') id: string, @Body() b: any) { return this.svc.updateKb(id, b); }
  @Post('kb/articles/:id/publish') publishKb(@Param('id') id: string) { return this.svc.publishKb(id); }
  @Delete('kb/articles/:id') deleteKb(@Param('id') id: string) { return this.svc.deleteKb(id); }
}
