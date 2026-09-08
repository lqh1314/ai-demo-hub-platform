import { OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../common/token.service';
import { PresenceService } from './presence.service';
import { CallService } from './call.service';
import { QueueService } from './queue.service';
import { RealtimeBus } from './realtime.bus';

@WebSocketGateway({ cors: { origin: true }, namespace: 'realtime' })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger('Realtime');
  constructor(private presence: PresenceService, private calls: CallService, private queue: QueueService, private bus: RealtimeBus) {}

  afterInit() {
    // 业务总线 -> 对应房间推送
    this.bus.onEvent(({ room, event, payload }) => this.server?.to(room).emit(event, payload));
  }

  handleConnection(client: Socket) {
    const token = (client.handshake.auth?.token || client.handshake.query?.token) as string;
    try {
      const u = TokenService.verifyAccess(token);
      (client.data as any).user = u;
      client.join(`tenant:${u.tenantId}`);
      client.join(`agent:${u.sub}`);
      this.logger.log(`坐席 ${u.realName} 已连接实时通道`);
    } catch {
      client.emit('unauthorized', { message: '握手令牌无效' });
      client.disconnect(true);
    }
  }

  private u(client: Socket) { return (client.data as any).user; }
  private ack(err: unknown, data?: unknown) { return { ok: !err, error: err ? String(err) : undefined, data }; }

  @SubscribeMessage('presence.set_status')
  async onStatus(@ConnectedSocket() c: Socket, @MessageBody() b: { status: any; callId?: string }) {
    const user = this.u(c); if (!user) return this.ack('未认证');
    const r = await this.presence.setStatus(user.tenantId, user.sub, b.status, b.callId);
    c.to(`tenant:${user.tenantId}`).emit('agent.presence_changed', { ...r, userId: user.sub });
    return this.ack(null, r);
  }

  @SubscribeMessage('queue.subscribe')
  onSubGroup(@ConnectedSocket() c: Socket, @MessageBody() b: { groupId: string }) {
    c.join(`group:${b.groupId}`);
    return this.ack(null, { joined: `group:${b.groupId}` });
  }

  @SubscribeMessage('call.dial')
  async onDial(@ConnectedSocket() c: Socket, @MessageBody() b: any) {
    const user = this.u(c); if (!user) return this.ack('未认证');
    try { return this.ack(null, await this.calls.agentDial(user.tenantId, user.sub, b)); } catch (e) { return this.ack((e as Error).message); }
  }

  @SubscribeMessage('call.answer')
  async onAnswer(@ConnectedSocket() c: Socket, @MessageBody() b: { queueId: string }) {
    const user = this.u(c); if (!user) return this.ack('未认证');
    return this.ack(null, await this.queue.accept(user.tenantId, b.queueId, user.sub));
  }

  @SubscribeMessage('call.hangup')
  async onHangup(@ConnectedSocket() c: Socket, @MessageBody() b: { callId: string; disposition?: string }) {
    const user = this.u(c); if (!user) return this.ack('未认证');
    try { return this.ack(null, await this.calls.endCall(user.tenantId, b.callId, 'AGENT', b.disposition)); } catch (e) { return this.ack((e as Error).message); }
  }
}
