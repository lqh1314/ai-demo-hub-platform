import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { QaService } from './qa.service';

@Controller('qa')
export class QaController {
  constructor(private svc: QaService) {}
  @Get('rules') rules() { return this.svc.listRules(); }
  @Post('rules') createRule(@Body() b: any) { return this.svc.createRule(b); }
  @Patch('rules/:id') updateRule(@Param('id') id: string, @Body() b: any) { return this.svc.updateRule(id, b); }
  @Post('calls/:callId/evaluate') evalCall(@Param('callId') callId: string) { return this.svc.evaluate(callId); }
  @Get('records') records(@Query() q: any) { return this.svc.listRecords(q); }
  @Post('records/:id/review') review(@Param('id') id: string, @Body() b: { score?: number; comment?: string }) { return this.svc.review(id, b); }
}
