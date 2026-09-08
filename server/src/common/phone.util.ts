/** 中国大陆号码归一化为 E.164；无法判定返回 null */
export function normalizePhone(input?: string | null): string | null {
  if (!input) return null;
  let s = String(input).replace(/[^\d+]/g, '');
  if (s.startsWith('+')) return s;
  if (s.startsWith('00')) return '+' + s.slice(2);
  if (s.startsWith('86') && s.length === 13) s = s.slice(2);
  if (/^1\d{10}$/.test(s)) return '+86' + s;
  if (/^\d{7,12}$/.test(s)) return s; // 座机等保留
  return s || null;
}

export function maskPhone(p?: string | null): string {
  if (!p) return '';
  return p.replace(/^(\+?\d{2,3})(\d{4})\d{4}(\d{2,4})$/, '$1$2****$3');
}
