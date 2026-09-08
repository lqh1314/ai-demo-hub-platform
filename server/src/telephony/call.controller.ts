import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CallService } from './call.service';
import { PresenceService } from './presence.service';
import { QueueService } from './queue.service';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/token.service';

@Controller()
export class CallController {
  constructor(private calls: CallService, private presence: PresenceService, private queue: QueueService) {}

  @Get('calls') list(@CurrentUser() u: JwtPayload, @Query() q: any) {
    if (q.mine === '1') q.agentId = u.sub;
    return this.calls.listCalls(u.tenantId, q);
  }
  @Get('calls/:id') detail(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.calls.detail(u.tenantId, id); }
  @Post('calls/dial') dial(@CurrentUser() u: JwtPayload, @Body() b: any) { return this.calls.agentDial(u.tenantId, u.sub, b); }
  @Post('calls/:id/say') say(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() b: { speaker: 'AGENT' | 'CUSTOMER'; text: string }) {
    return this.calls.agentSay(u.tenantId, id, b.speaker || 'AGENT', b.text);
  }
  @Post('calls/:id/transfer') transfer(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.calls.routeToHuman(u.tenantId, id); }
  @Post('calls/:id/end') end(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() b: any) { return this.calls.endCall(u.tenantId, id, 'AGENT', b?.disposition); }
  @Post('calls/:id/wrap-up') wrap(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() b: any) { return this.calls.wrapUp(u.tenantId, id, b || {}); }
  @Post('queue/:id/accept') accept(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.queue.accept(u.tenantId, id, u.sub); }

  @Get('presence') snapshot(@CurrentUser() u: JwtPayload) { return this.presence.snapshot(u.tenantId); }
  @Post('presence/status') setStatus(@CurrentUser() u: JwtPayload, @Body() b: { status: any; callId?: string }) {
    return this.presence.setStatus(u.tenantId, u.sub, b.status, b.callId);
  }

  @Get('lines') lines(@CurrentUser() u: JwtPayload) { return this.calls.listLines(u.tenantId); }
  @Post('lines') createLine(@CurrentUser() u: JwtPayload, @Body() b: any) { return this.calls.createLine(u.tenantId, b); }
}
