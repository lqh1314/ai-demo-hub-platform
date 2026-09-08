import { Tag } from 'antd';
import { lbl, colorOf } from '../lib/enums';

export function ETag({ value }: { value?: string | null }) {
  if (value == null || value === '') return <span>-</span>;
  return <Tag color={colorOf(value)} style={{ marginInlineEnd: 0 }}>{lbl(value)}</Tag>;
}

export default ETag;
