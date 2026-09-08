import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { MessageService } from './message.service';

@Controller('messages')
export class MessageController {
  constructor(private svc: MessageService) {}
  @Get('templates') tpls(@Query() q: any) { return this.svc.listTemplates(q); }
  @Post('templates') createTpl(@Body() b: any) { return this.svc.createTemplate(b); }
  @Patch('templates/:id') updateTpl(@Param('id') id: string, @Body() b: any) { return this.svc.updateTemplate(id, b); }
  @Get('tasks') tasks(@Query() q: any) { return this.svc.listTasks(q); }
  @Post('dispatch') dispatch(@Body() b: any) { return this.svc.dispatch(b); }
  @Get('records') records(@Query() q: any) { return this.svc.listRecords(q); }
}
