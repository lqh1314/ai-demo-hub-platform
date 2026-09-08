import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

/** 供应商凭证 AES-256-GCM 加解密；密钥来自环境变量 CREDENTIAL_KEY */
function key(): Buffer {
  const raw = process.env.CREDENTIAL_KEY || 'dev-credential-key-please-change-32b';
  return createHash('sha256').update(raw).digest(); // 恒为 32 字节
}
export const CredentialCrypto = {
  encrypt(plain: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]);
  },
  decrypt(buf: Buffer): string {
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  },
};
