import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PresenceService } from './presence.service';
import { selectAgent } from '../crm/assignment.strategy';
import { RealtimeBus } from './realtime.bus';

/** 派单队列：入队、按策略选择空闲坐席、指派/溢出 */
@Injectable()
export class QueueService {
  private rrIndex: Record<string, number> = {};
  constructor(private prisma: PrismaService, private presence: PresenceService, private bus: RealtimeBus) {}

  async enqueue(tenantId: string, data: { callId?: string; leadId?: string; phone?: string | null; groupId: string; strategy: 'ROUND_ROBIN' | 'LEAST_LOAD' | 'SKILL_MATCH'; priority?: number }) {
    // 同一通话重复请求转人工时幂等：复用既有排队记录重新排队，避免唯一约束(通话编号)冲突导致 500
    if (data.callId) {
      const existing = await this.prisma.dispatchQueue.findFirst({ where: { callId: data.callId }, orderBy: { enqueueAt: 'desc' } });
      if (existing) {
        const q = await this.prisma.dispatchQueue.update({
          where: { id: existing.id },
          data: { state: 'WAITING', assignedTo: null, groupId: data.groupId, leadId: data.leadId ?? existing.leadId, phoneE164: data.phone ?? existing.phoneE164, strategy: data.strategy, priority: data.priority ?? 100, enqueueAt: new Date() },
        });
        return this.tryAssign(tenantId, q.id);
      }
    }
    const q = await this.prisma.dispatchQueue.create({
      data: { tenantId, groupId: data.groupId, callId: data.callId, leadId: data.leadId, phoneE164: data.phone, strategy: data.strategy, priority: data.priority ?? 100, state: 'WAITING', enqueueAt: new Date() },
    });
    return this.tryAssign(tenantId, q.id);
  }

  async tryAssign(tenantId: string, queueId: string) {
    const q = await this.prisma.dispatchQueue.findUnique({ where: { id: queueId } });
    if (!q || q.state !== 'WAITING') return { assigned: false };
    const group = await this.prisma.skillGroup.findUnique({ where: { id: q.groupId } });
    const candidates = await this.presence.candidatesOfGroup(tenantId, q.groupId);
    const last = this.rrIndex[q.groupId] ?? -1;
    const picked = selectAgent(candidates, group?.strategy || q.strategy, { lastIndex: last });
    if (!picked) {
      this.bus.publish(`group:${q.groupId}`, 'queue.updated', { queueId, waiting: true });
      return { assigned: false, reason: 'NO_IDLE_AGENT' };
    }
    this.rrIndex[q.groupId] = picked.nextIndex;
    await this.prisma.dispatchQueue.update({ where: { id: q.id }, data: { state: 'ASSIGNED', assignedTo: picked.userId, assignAt: new Date() } });
    if (q.callId) await this.prisma.callSession.update({ where: { id: q.callId }, data: { agentId: picked.userId, status: 'TRANSFERRING', transferred: true, groupId: q.groupId } });
    this.bus.publish(`agent:${picked.userId}`, 'call.incoming', { queueId: q.id, callId: q.callId, leadId: q.leadId, phone: q.phoneE164 });
    this.bus.publish(`group:${q.groupId}`, 'queue.updated', { queueId, assignedTo: picked.userId });
    return { assigned: true, agentId: picked.userId };
  }

  /** 坐席点击接听 */
  async accept(tenantId: string, queueId: string, agentId: string) {
    const q = await this.prisma.dispatchQueue.findUnique({ where: { id: queueId } });
    if (!q || q.assignedTo !== agentId) return { ok: false };
    if (q.callId) {
      await this.prisma.callSession.update({ where: { id: q.callId }, data: { status: 'AGENT_TALK', answerAt: new Date(), agentId } });
      await this.presence.setStatus(tenantId, agentId, 'ON_CALL', q.callId);
      await this.presence.incrLoad(tenantId, agentId);
    }
    return { ok: true, callId: q.callId };
  }
}
