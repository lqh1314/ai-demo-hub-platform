import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ContractService } from './contract.service';

@Controller('contracts')
export class ContractController {
  constructor(private svc: ContractService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Post() create(@Body() b: any) { return this.svc.create(b); }
  @Get(':id') detail(@Param('id') id: string) { return this.svc.detail(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() b: any) { return this.svc.update(id, b); }
  @Post(':id/sign') sign(@Param('id') id: string, @Body() b: any) { return this.svc.sign(id, b); }
  @Post(':id/payments') addPay(@Param('id') id: string, @Body() b: any) { return this.svc.addPayment(id, b); }
  @Post('payments/:id/paid') markPaid(@Param('id') id: string, @Body() b: any) { return this.svc.markPaid(id, b); }
}
