import { escapeLike, foldText } from './arabic-fold';

describe('Arabic folding (search)', () => {
  it.each([
    ['عبد الله', 'عبدالله'],
    ['هبة', 'هبه'],
    ['أحمد', 'احمد'],
    ['إيمان', 'ايمان'],
    ['آمنة', 'امنه'],
    ['مُحَمَّد', 'محمد'],
    ['يحيى', 'يحيي'],
    ['ALI Ahmed', 'aliahmed'],
  ])('%s and %s fold to the same text', (a, b) => {
    expect(foldText(a)).toBe(foldText(b));
  });

  it('leaves digits alone and survives null', () => {
    expect(foldText('0100 123')).toBe('0100123');
    expect(foldText(null)).toBe('');
  });

  it('escapes LIKE wildcards so user input matches literally', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});
