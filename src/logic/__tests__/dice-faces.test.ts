import { describe, it, expect } from 'vitest';
import { d20FromFaces } from '../dice';

describe('d20FromFaces (manually entered dice)', () => {
  it('normal: one face, natural equals the face', () => {
    expect(d20FromFaces([14])).toEqual({ rolls: [14], used: 14, natural: 14 });
  });

  it('advantage keeps the higher of two, natural is the kept die', () => {
    expect(d20FromFaces([4, 17], 'advantage')).toEqual({ rolls: [4, 17], used: 17, natural: 17 });
  });

  it('disadvantage keeps the lower of two, natural is the kept die', () => {
    expect(d20FromFaces([4, 17], 'disadvantage')).toEqual({ rolls: [4, 17], used: 4, natural: 4 });
  });

  it('a natural 1 on disadvantage is judged on the kept die', () => {
    expect(d20FromFaces([20, 1], 'disadvantage').natural).toBe(1);
  });

  it('rejects the wrong number of faces for the mode', () => {
    expect(() => d20FromFaces([5, 6])).toThrow(RangeError);
    expect(() => d20FromFaces([5], 'advantage')).toThrow(RangeError);
  });

  it('rejects faces outside 1..20 and non-integers', () => {
    expect(() => d20FromFaces([0])).toThrow(RangeError);
    expect(() => d20FromFaces([21])).toThrow(RangeError);
    expect(() => d20FromFaces([10.5])).toThrow(RangeError);
  });
});
