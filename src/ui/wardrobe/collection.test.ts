import { describe, expect, it } from 'vitest';
import { collectionCount, collectionEntries, enemyLabel, SHOP_HINT, UNMET } from './collection.ts';

describe('collection hints (09 checklist 8)', () => {
  const find = (e: ReturnType<typeof collectionEntries>, id: string) => e.find((x) => x.id === id)!;
  it('an unowned wolf accessory hides its name and only names the Wolf once one has been met', () => {
    const before = find(collectionEntries([], []), 'acc_wolf'), after = find(collectionEntries([], ['wolf']), 'acc_wolf');
    expect(before).toMatchObject({ owned: false, name: '???', hint: `Dropped by: ${UNMET}` });
    expect(after).toMatchObject({ owned: false, name: '???', hint: 'Dropped by: Wolf' });
  });
  it('owned items show their name and where they came from; shop items point at the shops', () => {
    const e = collectionEntries(['acc_wolf', 'cape_gold'], []);
    expect(find(e, 'acc_wolf')).toMatchObject({ owned: true, name: 'Wolf-pelt hood', hint: 'Dropped by: Wolf' });
    expect(find(e, 'cape_gold')).toMatchObject({ owned: true, name: 'Golden cape', hint: SHOP_HINT });
    expect(find(e, 'hat_straw')).toMatchObject({ owned: false, name: '???', hint: SHOP_HINT });
  });
  it('lists all 59 and counts the owned ones', () => {
    expect(collectionEntries([], [])).toHaveLength(59);
    expect(collectionCount(['acc_wolf', 'cape_gold', 'not_a_thing'])).toBe('2 / 59');
  });
  it('names dragons by color and the wisp properly', () => {
    expect(find(collectionEntries(['acc_dragon_storm'], []), 'acc_dragon_storm').hint).toBe('Dropped by: Dragon (storm)');
    expect(enemyLabel('wisp')).toBe("Will-o'-Wisp");
    expect(enemyLabel('bandit_archer')).toBe('Bandit Archer');
  });
});
