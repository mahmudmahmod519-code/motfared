import { callPhoneKey, callPhoneTail, phoneMatchSets } from './call-phone';

/**
 * The one shape a phone number is compared in, whichever side it came from (ported from the legacy
 * callPhoneKey rules). An Egyptian mobile is 01[0125] + 8 digits, so the operator prefix lives in the two
 * digits a last-8 comparison throws away: 01011110001 and 01511110001 are different people.
 */
describe('call phone keys', () => {
  it.each([
    ['01012345678', '01012345678'],
    ['+20 10 1234 5678', '01012345678'],
    ['0020 10 1234 5678', '01012345678'],
    ['201012345678', '01012345678'],
    ['٠١٠١٢٣٤٥٦٧٨', '01012345678'],
    ['+249912345678', '249912345678'], // another country keeps its code, minus the plus
    ['00249912345678', '249912345678'],
    ['', ''],
    [null, ''],
    ['abc', ''],
  ])('%s -> %s', (input, expected) => {
    expect(callPhoneKey(input as any)).toBe(expected);
  });

  it('keeps Egyptian twins that differ only in the operator prefix distinct', () => {
    expect(callPhoneKey('01011110001')).not.toBe(callPhoneKey('01511110001'));
  });

  it('the tail is the last ten digits, or null when there are fewer', () => {
    expect(callPhoneTail('01012345678')).toBe('1012345678');
    expect(callPhoneTail('+20 10 1234 5678')).toBe('1012345678');
    expect(callPhoneTail('12345')).toBeNull();
    expect(callPhoneTail(null)).toBeNull();
  });

  it('match sets are deduplicated and ignore blanks', () => {
    const { keys, tails } = phoneMatchSets(['01012345678', '+20 10 1234 5678', '', null, '   ', '01112345679']);
    expect(keys).toEqual(['01012345678', '01112345679']);
    expect(tails).toEqual(['1012345678', '1112345679']);
    expect(phoneMatchSets(null)).toEqual({ keys: [], tails: [] });
  });
});
