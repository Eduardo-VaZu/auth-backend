import { describe, it, expect } from '@jest/globals';
import { Email } from './Email.js';

describe('Email Value Object', () => {
  it('should create a valid email instance', () => {
    const emailStr = 'test@example.com';
    const email = new Email(emailStr);
    expect(email.value).toBe(emailStr);
  });

  it('should normalize email to lowercase', () => {
    const email = new Email('TEST@EXAMPLE.COM');
    expect(email.value).toBe('test@example.com');
  });

  it('should throw ValidationError for invalid email format', () => {
    expect(() => new Email('invalid-email')).toThrow();
  });

  it('should throw ValidationError for empty email', () => {
    expect(() => new Email('')).toThrow();
  });
});
