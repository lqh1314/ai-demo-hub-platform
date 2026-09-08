import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface RealtimeEvent { room: `tenant:${string}` | `agent:${string}` | `group:${string}`; event: string; payload: unknown }

/** 进程内实时事件总线；多实例时可替换为 Redis pub/sub（RedisService.subscribe 已预留） */
@Injectable()
export class RealtimeBus extends EventEmitter {
  publish(room: RealtimeEvent['room'], event: string, payload: unknown) {
    this.emit('rt', { room, event, payload } as RealtimeEvent);
  }
  onEvent(fn: (e: RealtimeEvent) => void) { this.on('rt', fn); }
}
