import { fromCents, multiply, toCents } from './money';

describe('money', () => {
  it('converts DECIMAL strings to cents and back', () => {
    expect(toCents('199.00')).toBe(19900);
    expect(toCents('0.29')).toBe(29); // 0.29 * 100 = 28.999999999999996 in float
    expect(fromCents(19900)).toBe('199.00');
  });

  it('multiplies without float drift', () => {
    expect(multiply('0.10', 3)).toBe('0.30'); // 0.1 * 3 = 0.30000000000000004 in float
    expect(multiply('15.00', 2)).toBe('30.00');
  });
});
