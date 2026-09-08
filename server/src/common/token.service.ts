import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

const ACCESS_SECRET = process.env.JWT_SECRET || 'dev-access-secret-change-me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  realName: string;
  roleAlias: string;
  permissions: string[];
  deptId?: string | null;
  jti?: string;
}

export const TokenService = {
  signAccess(p: JwtPayload): string {
    return jwt.sign(p, ACCESS_SECRET, { expiresIn: (process.env.ACCESS_TTL || '2h') as jwt.SignOptions['expiresIn'] });
  },
  signRefresh(p: JwtPayload): string {
    return jwt.sign({ sub: p.sub, tenantId: p.tenantId, jti: crypto.randomUUID() }, REFRESH_SECRET, { expiresIn: '7d' as jwt.SignOptions['expiresIn'] });
  },
  verifyAccess(token: string): JwtPayload {
    return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
  },
  verifyRefresh(token: string): { sub: string; tenantId: string } {
    return jwt.verify(token, REFRESH_SECRET) as any;
  },
  hashToken(t: string): string {
    return crypto.createHash('sha256').update(t).digest('hex');
  },
};
