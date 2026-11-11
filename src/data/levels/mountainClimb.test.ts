import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// M17 Task 2 (06 §8.3): no flying enemies on the climb; its two regulars are Rams on flat ground; rocks use the 3.0 s default.
describe('Mountains §3, every version', () => {
  for (const v of [1, 2, 3]) {
    it(`v${v}: two Rams, no flyers, no fast rock zones`, () => {
      const d = JSON.parse(readFileSync(`levels-src/mountains/s3/v${v}.json`, 'utf8'));
      const enemies = d.objects.filter((o: { type: string }) => o.type === 'enemy').map((o: { props: { enemy: string } }) => o.props.enemy);
      expect(enemies).toEqual(['ram', 'ram']);
      for (const z of d.objects.filter((o: { type: string }) => o.type === 'falling_rocks')) expect(z.props.interval).toBeUndefined();
      const rows: string[] = readFileSync(`levels-src/mountains/s3/v${v}.txt`, 'utf8').split('\n');
      for (const o of d.objects.filter((o: { type: string }) => o.type === 'enemy')) expect(rows[o.y + 1][o.x], 'standing on solid ground').toBe('#');
    });
  }
});
