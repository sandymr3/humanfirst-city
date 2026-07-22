import { describe, it, expect } from 'vitest';
import { normalizeBaseUrl } from '@/config/appConfig';

describe('normalizeBaseUrl', () => {
  it('strips a trailing /api (main frontend NEXT_PUBLIC_API_URL convention)', () => {
    expect(normalizeBaseUrl('https://svc-uc.a.run.app/api')).toBe('https://svc-uc.a.run.app');
  });

  it('strips trailing slashes (with or without /api)', () => {
    expect(normalizeBaseUrl('https://svc-uc.a.run.app/')).toBe('https://svc-uc.a.run.app');
    expect(normalizeBaseUrl('https://svc-uc.a.run.app/api/')).toBe('https://svc-uc.a.run.app');
  });

  it('leaves a bare origin intact', () => {
    expect(normalizeBaseUrl('http://localhost:8080')).toBe('http://localhost:8080');
  });

  it('strips a trailing /api/v1 (pasted-with-path mistake) to avoid doubled paths', () => {
    expect(normalizeBaseUrl('https://svc-uc.a.run.app/api/v1')).toBe('https://svc-uc.a.run.app');
    expect(normalizeBaseUrl('https://svc-uc.a.run.app/api/v1/')).toBe('https://svc-uc.a.run.app');
  });
});
