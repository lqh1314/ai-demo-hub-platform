import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IntegrationService } from './integration.service';

@Controller('integrations')
export class IntegrationController {
  constructor(private svc: IntegrationService) {}
  @Get('keys') keys() { return this.svc.listKeys(); }
  @Post('keys') createKey(@Body() b: any) { return this.svc.createKey(b); }
  @Post('keys/:id/toggle') toggle(@Param('id') id: string, @Body() b: { enabled: boolean }) { return this.svc.toggleKey(id, b.enabled); }
  @Get('webhooks') wh() { return this.svc.listWebhooks(); }
  @Post('webhooks') createWh(@Body() b: any) { return this.svc.createWebhook(b); }
  @Get('webhooks/deliveries') deliveries() { return this.svc.listDeliveries(); }
  @Get('providers') providers() { return this.svc.listProviders(); }
  @Post('providers') upsertProvider(@Body() b: any) { return this.svc.upsertProvider(b); }
  @Get('providers/active') activeLlm() { return this.svc.activeLlm(); }
  @Post('providers/test') testProvider(@Body() b: any) { return this.svc.testProvider(b); }
  @Get('providers/:id/reveal') reveal(@Param('id') id: string) { return this.svc.revealProvider(id); }
}
