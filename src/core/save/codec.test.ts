import { describe, expect, it } from 'vitest';
import { crc32, decodeSave, encodeSave } from './codec.ts';
import { NewerSaveVersionError } from './migrate.ts';
import { defaultSave } from '../../data/save.ts';

const rawCode = (text: string) => {
  const bytes = new TextEncoder().encode(text), base64 = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return `RB1:${base64}:${crc32(bytes).toString(16).toUpperCase().padStart(8, '0')}`;
};
describe('portable save code (06 §15.3)', () => {
  it('uses IEEE CRC32 and exactly eight uppercase checksum digits', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926); expect(crc32(new Uint8Array())).toBe(0);
    expect(encodeSave(defaultSave())).toMatch(/^RB1:[A-Za-z0-9_-]+:[A-F0-9]{8}$/);
  });
  it('round-trips a valid save exactly and accepts whitespace pasted anywhere', () => {
    const save = defaultSave(); save.training = [1, 17]; save.typedSeed = 'ABC123';
    const code = encodeSave(save); expect(decodeSave(code)).toEqual(save);
    expect(decodeSave(` \n${code.split('').join(' \t')}\r\n`)).toEqual(save);
  });
  it('calculates its checksum over UTF-8 JSON bytes and preserves non-ASCII text', () => {
    const save = defaultSave(); save.pbs['tank|forest'] = { ticks: 4, splits: [1, 2, 3, 4], date: '2026-10-17T12:34:56.000Z', seedText: 'ABC123', kit: { displayName: 'Gládiator ★', weapons: [], abilities: [] } };
    expect(decodeSave(encodeSave(save))).toEqual(save);
    expect(encodeSave(save)).toBe(rawCode(JSON.stringify(save)));
  });
  it('a changed payload or checksum is refused and cannot mutate the existing save', () => {
    const save = defaultSave(), before = structuredClone(save), code = encodeSave(save), [, payload, checksum] = code.split(':');
    expect(() => decodeSave(`RB1:${payload.slice(0, -1)}${payload.at(-1) === 'A' ? 'B' : 'A'}:${checksum}`)).toThrow();
    expect(() => decodeSave(`RB1:${payload}:00000000`)).toThrow(); expect(save).toEqual(before);
  });
  it.each(['RB2:YWJj:352441C2', 'RB1:YWJj=:352441C2', 'RB1:YWJj+:352441C2', 'RB1:A:00000000', 'RB1:YWJj:352441c2', 'RB1:YWJj:352441C2:EXTRA', '', 'RB1::00000000'])('rejects malformed code %s', (code) => { expect(() => decodeSave(code)).toThrow(); });
  it('rejects noncanonical trailing base64 bits even with the same decoded bytes and CRC', () => {
    const code = rawCode('{}'); expect(() => decodeSave(code.replace('e30:', 'e31:'))).toThrow();
  });
  it('rejects bad JSON, primitive/array roots, invalid UTF-8, and newer versions', () => {
    for (const text of ['{', 'null', '[]', '42']) expect(() => decodeSave(rawCode(text))).toThrow();
    const bytes = new Uint8Array([0xff]), checksum = crc32(bytes).toString(16).toUpperCase().padStart(8, '0');
    expect(() => decodeSave(`RB1:_w:${checksum}`)).toThrow();
    expect(() => decodeSave(rawCode('{"v":2}'))).toThrow(NewerSaveVersionError);
  });
  it('rejects both raw and compact codes above the1million character limit', () => {
    expect(() => decodeSave(' '.repeat(1_000_001))).toThrow(); expect(() => decodeSave('A'.repeat(1_000_001))).toThrow();
  });
});
