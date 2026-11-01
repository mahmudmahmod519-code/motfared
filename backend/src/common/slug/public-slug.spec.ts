import { isReserved, normaliseSlug, slugError, suggestSlug } from './public-slug';

/** The original's tests for the doctor's public address (test/public-links.test.js), unchanged in substance. */
describe('public slug', () => {
  it('a slug is tidied the way a person would expect', () => {
    expect(normaliseSlug('Karim Naim')).toBe('karim-naim');
    expect(normaliseSlug('  KARIM--naim  ')).toBe('karim-naim');
    expect(normaliseSlug('karim_naim')).toBe('karim-naim');
  });

  it('a slug that cannot survive being typed is refused, with the reason', () => {
    expect(slugError('كريم')).toMatch(/إنجليزي/);
    expect(slugError('ab')).toMatch(/قصير/);
    expect(slugError('a'.repeat(41))).toMatch(/طويل/);
    expect(slugError('123')).toMatch(/أرقام/);
    expect(slugError('karim naim!')).toMatch(/حروف/);
    expect(slugError('karim-naim')).toBeNull();
  });

  it('an address that reads as something it is not is reserved', () => {
    for (const word of ['admin', 'login', 'clinic', 'settings']) expect(slugError(word)).toMatch(/محجوز/);
    expect(isReserved('Admin')).toBe(true);
    expect(slugError('dr')).toBeTruthy(); // refused by the length rule that runs first
  });

  it('the suggestion drops the title and spells the name the way its owner would', () => {
    expect(suggestSlug('د. كريم نعيم')).toBe('karim-naim');
    expect(suggestSlug('دكتور أحمد عفيفي')).toBe('ahmed-afifi');
    expect(suggestSlug('دكتورة منى جمال')).toBe('mona-gamal');
    expect(suggestSlug('Dr. Mahmoud El-Baghdady')).toBe('mahmoud-elbaghdady');
  });

  it("the suggestion spells the live doctors' names, not their letters", () => {
    expect(suggestSlug('د. زياد كمال')).toBe('ziad-kamal');
    expect(suggestSlug('د. مصطفى كامل')).toBe('mostafa-kamel');
    expect(suggestSlug('د. سمير الحبشي')).toBe('samir-elhabashy');
    expect(suggestSlug('عيادة الجداوي')).toBe('elgedawy');
  });

  it('a name that cannot be suggested gives nothing rather than a bad guess', () => {
    expect(suggestSlug('')).toBeNull();
    expect(suggestSlug(undefined)).toBeNull();
    expect(suggestSlug('د. ١٢')).toBeNull();
  });
});
