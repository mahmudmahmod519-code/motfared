import { describe, expect, it } from 'vitest';
import { gate, isPublicPath, loginUrl, safeNext } from '../lib/redirect';

describe('safeNext: where to go after signing in (never off this site)', () => {
  it('accepts an ordinary in-site path, with query and hash', () => {
    for (const ok of ['/', '/leads', '/leads?status=new', '/doctors/12', '/reps#top']) expect(safeNext(ok)).toBe(ok);
  });

  it.each([
    'https://evil.example/', 'http://evil.example', '//evil.example', '///evil.example', '/\\evil.example', '\\\\evil.example',
    'javascript:alert(1)', 'data:text/html,x', 'evil.example', '', '   ', '/%2f%2fevil.example', '/leads\n', '/leads\r\nSet-Cookie: a=b', '/\tx',
  ])('falls back to the overview for %j', (bad) => {
    expect(safeNext(bad)).toBe('/');
  });

  it('never loops back to the sign-in page or the password page it just came from', () => {
    for (const p of ['/login', '/login?next=/x', '/change-password']) expect(safeNext(p)).toBe('/');
  });

  it('copes with missing or non-string input', () => {
    for (const v of [undefined, null, 42, ['/x'], {}]) expect(safeNext(v as any)).toBe('/');
  });
});

describe('isPublicPath', () => {
  it('lets the sign-in page, the public lead form, the clinic page and static files through', () => {
    for (const p of ['/login', '/dr/dr-ahmed', '/clinic/abc', '/_next/static/x.js', '/fonts/IBMPlexSansArabic-Regular.woff2', '/favicon.ico', '/api/auth/login']) {
      expect([p, isPublicPath(p)]).toEqual([p, true]);
    }
  });
  it('treats everything else as private, including look-alikes', () => {
    for (const p of ['/', '/leads', '/doctors', '/loginx', '/login/../leads', '/drx/y', '/clinics', '/dr', '/change-password']) {
      expect([p, isPublicPath(p)]).toEqual([p, false]);
    }
  });
});

describe('gate: the cheap check in front of every page (the API enforces the real one)', () => {
  it('sends a visitor without a session cookie to sign in, remembering where they were going', () => {
    expect(gate({ pathname: '/leads', search: '?status=new', hasSession: false })).toEqual({ redirect: '/login?next=%2Fleads%3Fstatus%3Dnew' });
    expect(gate({ pathname: '/', search: '', hasSession: false })).toEqual({ redirect: '/login' });
  });
  it('does not remember a destination that is not safe', () => {
    expect(gate({ pathname: '//evil.example', search: '', hasSession: false })).toEqual({ redirect: '/login' });
  });
  it('lets public paths through with or without a session', () => {
    expect(gate({ pathname: '/login', search: '', hasSession: false })).toBeNull();
    expect(gate({ pathname: '/dr/x', search: '', hasSession: true })).toBeNull();
  });
  it('lets a visitor with a session cookie through (the page validates the session itself)', () => {
    expect(gate({ pathname: '/leads', search: '', hasSession: true })).toBeNull();
  });
  it('loginUrl encodes the destination', () => {
    expect(loginUrl('/a b?x=1&y=2')).toBe('/login?next=%2Fa%20b%3Fx%3D1%26y%3D2');
    expect(loginUrl('/')).toBe('/login');
  });
});
