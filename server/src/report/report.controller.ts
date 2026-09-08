import { Controller, Get, Query } from '@nestjs/common';
import { ReportService } from './report.service';

@Controller('reports')
export class ReportController {
  constructor(private svc: ReportService) {}
  @Get('overview') overview() { return this.svc.overview(); }
  @Get('funnel') funnel() { return this.svc.funnel(); }
  @Get('calls') calls(@Query() q: any) { return this.svc.callReport(q); }
  @Get('agents') agents(@Query() q: any) { return this.svc.agentReport(q); }
}
