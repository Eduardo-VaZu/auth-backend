import { describe, it, expect } from '@jest/globals';
import { isUuid } from './isUuid.js';

describe('isUuid Utility', () => {
  it('should return true for valid v4 UUID', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('should return false for invalid UUID strings', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('12345')).toBe(false);
    expect(isUuid('')).toBe(false);
  });
});
