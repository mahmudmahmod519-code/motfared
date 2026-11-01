import { toCanonicalPhone } from './phone';

describe('toCanonicalPhone', () => {
  it.each([
    ['01001234567', '01001234567'],
    ['+201001234567', '01001234567'],
    ['201001234567', '01001234567'],
    ['00201001234567', '01001234567'],
    ['+20 100 123 4567', '01001234567'],
    ['010-0123-4567', '01001234567'],
    ['1001234567', '01001234567'], // spreadsheet dropped the zero
    ['+2001001234567', '01001234567'], // stray zero after the country code
    ['٠١٠٠١٢٣٤٥٦٧', '01001234567'], // Arabic-Indic digits
    ['۰۱۰۰۱۲۳۴۵۶۷', '01001234567'], // Persian digits
    ['+249912345678', '+249912345678'], // Sudan keeps the plus
    ['00249912345678', '+249912345678'],
    ['+966512345678', '+966512345678'],
  ])('%s -> %s', (input, expected) => {
    expect(toCanonicalPhone(input)).toBe(expected);
  });

  it.each([null, undefined, '', '   ', 'abc', '12345', '01301234567', '0100123456', '+1 202 555 0100', '0512345678'])(
    'rejects %p rather than guessing',
    (input) => {
      expect(toCanonicalPhone(input as any)).toBeNull();
    },
  );
});

import { extractPhone } from './phone';

/** Ported from the legacy phone.test.js: a number typed into free text, as reps and forms produce it. */
describe('extractPhone', () => {
  it.each([
    ['01012345678', '01012345678'],
    ['ده رقمي اتصل بيا 010 2318 8094', '01023188094'],
    ['01012345678,01112345679', '01012345678'], // two numbers: the first is the contact number
    ['01012345678،01112345679', '01012345678'], // Arabic comma
    ['5 - 01012345678', '01012345678'], // a stray digit and separator on the edge
    ['+966 512345678', '+966512345678'],
    ['٠١٠١٢٣٤٥٦٧٨', '01012345678'],
  ])('%s -> %s', (input, expected) => {
    expect(extractPhone(input)).toBe(expected);
  });

  it.each(['', 'no number here', '12345', '010123456789', null, undefined])('rejects %p', (input) => {
    expect(extractPhone(input as any)).toBeNull();
  });

  it('does not invent a number by cutting a long cell in the middle of one', () => {
    const long = `${'ملاحظة '.repeat(8)}010123456789`; // a typo with an extra digit, far into a long cell
    expect(extractPhone(long)).toBeNull();
  });
});
