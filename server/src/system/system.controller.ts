import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SystemService } from './system.service';

@Controller('system')
export class SystemController {
  constructor(private svc: SystemService) {}
  @Get('dicts') dicts() { return this.svc.listDicts(); }
  @Post('dicts') createDict(@Body() b: any) { return this.svc.createDict(b); }
  @Post('dicts/:id/items') addItem(@Param('id') id: string, @Body() b: any) { return this.svc.addDictItem(id, b); }
  @Get('notifications') notif(@Query() q: any) { return this.svc.listNotifications(q); }
  @Get('notifications/unread-count') unread() { return this.svc.unreadCount(); }
  @Post('notifications/:id/read') read(@Param('id') id: string) { return this.svc.read(id); }
  @Get('audit') audit(@Query() q: any) { return this.svc.listAudit(q); }
}
