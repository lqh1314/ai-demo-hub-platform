import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CrmService } from './crm.service';

@Controller()
export class CrmController {
  constructor(private svc: CrmService) {}

  // 线索
  @Get('leads') listLeads(@Query() q: any) { return this.svc.listLeads(q); }
  @Get('leads/:id') getLead(@Param('id') id: string) { return this.svc.getLead(id); }
  @Post('leads') createLead(@Body() b: any) { return this.svc.createLead(b); }
  @Patch('leads/:id') updateLead(@Param('id') id: string, @Body() b: any) { return this.svc.updateLead(id, b); }
  @Delete('leads/:id') removeLead(@Param('id') id: string) { return this.svc.removeLead(id); }
  @Post('leads/:id/assign') assign(@Param('id') id: string, @Body() b: any) { return this.svc.assignLead(id, b); }
  @Post('leads/:id/convert') convert(@Param('id') id: string, @Body() b: any) { return this.svc.convertLead(id, b); }

  // 客户 / 联系人
  @Get('customers') listCustomers(@Query() q: any) { return this.svc.listCustomers(q); }
  @Get('customers/:id') getCustomer(@Param('id') id: string) { return this.svc.getCustomer(id); }
  @Post('customers') createCustomer(@Body() b: any) { return this.svc.createCustomer(b); }
  @Patch('customers/:id') updateCustomer(@Param('id') id: string, @Body() b: any) { return this.svc.updateCustomer(id, b); }
  @Get('contacts') listContacts(@Query() q: any) { return this.svc.listContacts(q); }
  @Post('contacts') createContact(@Body() b: any) { return this.svc.createContact(b); }
  @Get('screen-pop') screenPop(@Query('phone') phone: string) { return this.svc.screenPop(phone); }

  // 商机
  @Get('opportunities') listOpp(@Query() q: any) { return this.svc.listOpportunities(q); }
  @Post('opportunities') createOpp(@Body() b: any) { return this.svc.createOpportunity(b); }
  @Post('opportunities/:id/advance-stage') advance(@Param('id') id: string, @Body() b: any) { return this.svc.advanceStage(id, b); }

  // 动态 / 待办
  @Get('activities') timeline(@Query('type') type: string, @Query('id') id: string) { return this.svc.timeline(type, id); }
  @Post('activities') append(@Body() b: any) { return this.svc.appendActivity(b); }
  @Get('tasks') myTasks(@Query('status') status: string) { return this.svc.myTasks(status); }
  @Post('tasks') createTask(@Body() b: any) { return this.svc.createTask(b); }
  @Post('tasks/:id/complete') complete(@Param('id') id: string, @Body() b: any) { return this.svc.completeTask(id, b?.result); }
}
