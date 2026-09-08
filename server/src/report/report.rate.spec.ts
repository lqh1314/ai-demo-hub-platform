import { rate } from './report.service';

describe('报表比率 rate', () => {
  test('正常比率保留 1 位小数', () => {
    expect(rate(3, 4)).toBe(75);
    expect(rate(1, 3)).toBe(33.3);
    expect(rate(2, 3)).toBe(66.7);
  });
  test('总数为 0 时返回 0 而非 NaN/Infinity', () => {
    expect(rate(0, 0)).toBe(0);
    expect(rate(5, 0)).toBe(0);
  });
  test('满/空为 100 与 0', () => {
    expect(rate(10, 10)).toBe(100);
    expect(rate(0, 10)).toBe(0);
  });
});
