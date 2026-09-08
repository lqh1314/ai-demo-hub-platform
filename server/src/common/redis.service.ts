import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis 访问层：存在 REDIS_URL 时使用真实 Redis（多实例共享 presence/队列/缓存）；
 * 连接失败或未配置时自动降级为进程内内存实现，保证离线/单实例也能完整运行。
 */
@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger('Redis');
  private client: Redis | null = null;
  private mem = new Map<string, string>();
  private sets = new Map<string, Set<string>>();
  private zsets = new Map<string, Map<string, number>>();
  private hashes = new Map<string, Map<string, string>>();
  private listeners = new Map<string, Set<(msg: string) => void>>();
  private memTimers = new Map<string, NodeJS.Timeout>();
  mode: 'redis' | 'memory' = 'memory';

  async onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn('未配置 REDIS_URL，使用进程内缓存（单实例模式）');
      return;
    }
    try {
      this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
      await this.client.connect();
      this.mode = 'redis';
      this.client.on('message', (ch, msg) => this.listeners.get(ch)?.forEach((fn) => fn(msg)));
      this.logger.log('Redis 已连接');
    } catch (e) {
      this.logger.warn(`Redis 连接失败，降级内存模式：${(e as Error).message}`);
      this.client = null;
    }
  }

  async get(k: string): Promise<string | null> {
    if (this.client) return this.client.get(k);
    return this.mem.has(k) ? this.mem.get(k)! : null;
  }
  async set(k: string, v: string, ttlSec?: number): Promise<void> {
    if (this.client) { ttlSec ? await this.client.set(k, v, 'EX', ttlSec) : await this.client.set(k, v); return; }
    this.mem.set(k, v);
    // 内存降级模式同样兑现 TTL，避免缓存永不失效
    const old = this.memTimers.get(k);
    if (old) clearTimeout(old);
    if (ttlSec && ttlSec > 0) {
      const t = setTimeout(() => { this.mem.delete(k); this.memTimers.delete(k); }, ttlSec * 1000);
      this.memTimers.set(k, t);
    }
  }
  async del(k: string): Promise<void> {
    if (this.client) await this.client.del(k); else this.mem.delete(k);
    const t = this.memTimers.get(k);
    if (t) { clearTimeout(t); this.memTimers.delete(k); }
  }
  async incr(k: string): Promise<number> {
    if (this.client) return this.client.incr(k);
    const n = Number(this.mem.get(k) || 0) + 1; this.mem.set(k, String(n)); return n;
  }
  async hSet(k: string, f: string, v: string) {
    if (this.client) return this.client.hset(k, f, v);
    if (!this.hashes.has(k)) this.hashes.set(k, new Map());
    this.hashes.get(k)!.set(f, v); return 1;
  }
  async hGet(k: string, f: string) {
    if (this.client) return this.client.hget(k, f);
    return this.hashes.get(k)?.get(f) ?? null;
  }
  async hGetAll(k: string): Promise<Record<string, string>> {
    if (this.client) return this.client.hgetall(k);
    return Object.fromEntries(this.hashes.get(k) ?? new Map());
  }
  async sAdd(k: string, ...vals: string[]) {
    if (this.client) return this.client.sadd(k, ...vals);
    if (!this.sets.has(k)) this.sets.set(k, new Set());
    vals.forEach((v) => this.sets.get(k)!.add(v)); return vals.length;
  }
  async sRem(k: string, ...vals: string[]) {
    if (this.client) return this.client.srem(k, ...vals);
    vals.forEach((v) => this.sets.get(k)?.delete(v)); return vals.length;
  }
  async sMembers(k: string): Promise<string[]> {
    if (this.client) return this.client.smembers(k);
    return [...(this.sets.get(k) ?? [])];
  }
  async zAdd(k: string, score: number, member: string) {
    if (this.client) return this.client.zadd(k, score, member);
    if (!this.zsets.has(k)) this.zsets.set(k, new Map());
    this.zsets.get(k)!.set(member, score); return 1;
  }
  async zIncrBy(k: string, inc: number, member: string): Promise<number> {
    if (this.client) return Number(await this.client.zincrby(k, inc, member));
    const m = this.zsets.get(k) ?? new Map<string, number>();
    const n = (m.get(member) ?? 0) + inc; m.set(member, n); this.zsets.set(k, m); return n;
  }
  async zScore(k: string, member: string): Promise<number | null> {
    if (this.client) { const v = await this.client.zscore(k, member); return v == null ? null : Number(v); }
    return this.zsets.get(k)?.has(member) ? this.zsets.get(k)!.get(member)! : null;
  }
  /** 取有序集合中 score 升序的前 n 个成员（用于最少负载选择） */
  async zRangeByScoreAsc(k: string, limit: number): Promise<string[]> {
    if (this.client) return this.client.zrange(k, 0, limit - 1);
    const m = this.zsets.get(k); if (!m) return [];
    return [...m.entries()].sort((a, b) => a[1] - b[1]).slice(0, limit).map((e) => e[0]);
  }
  async zRem(k: string, member: string) {
    if (this.client) return this.client.zrem(k, member);
    return this.zsets.get(k)?.delete(member) ? 1 : 0;
  }
  async publish(ch: string, msg: string) {
    if (this.client) return this.client.publish(ch, msg);
    this.listeners.get(ch)?.forEach((fn) => fn(msg));
  }
  async subscribe(ch: string, fn: (msg: string) => void) {
    if (!this.listeners.has(ch)) this.listeners.set(ch, new Set());
    this.listeners.get(ch)!.add(fn);
    if (this.client) await this.client.subscribe(ch);
  }
}
