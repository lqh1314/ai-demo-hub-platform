import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CampaignService } from './campaign.service';

@Controller('campaigns')
export class CampaignController {
  constructor(private svc: CampaignService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Post() create(@Body() b: any) { return this.svc.create(b); }
  @Patch(':id') update(@Param('id') id: string, @Body() b: any) { return this.svc.update(id, b); }
  @Post(':id/start') start(@Param('id') id: string) { return this.svc.setStatus(id, 'RUNNING'); }
  @Post(':id/pause') pause(@Param('id') id: string) { return this.svc.setStatus(id, 'PAUSED'); }
  @Post(':id/targets/import') imp(@Param('id') id: string, @Body() b: { rows: any[] }) { return this.svc.importTargets(id, b.rows || []); }
  @Get(':id/targets') targets(@Param('id') id: string, @Query() q: any) { return this.svc.targets(id, q); }
  @Get(':id/stats') stats(@Param('id') id: string) { return this.svc.stats(id); }
  @Post(':id/run') run(@Param('id') id: string, @Body() b: { agentId?: string }) { return this.svc.runBatch(id, b?.agentId); }
}
