// Portable UTF-8 save codes with IEEE CRC-32 (06 §15.3). No I/O and no save mutation.
import { SAVE_RULES } from '../../data/save.ts';
import type { SaveData } from './schema.ts';
import { validateSave } from './validate.ts';

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function base64url(bytes: Uint8Array): string {
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function encodeSave(save: SaveData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(save));
  return `RB1:${base64url(bytes)}:${crc32(bytes).toString(16).toUpperCase().padStart(8, '0')}`;
}
export function decodeSave(code: string): SaveData {
  const invalid = () => new Error("That code isn't valid");
  if (typeof code !== 'string' || code.length > SAVE_RULES.importMaxLength) throw invalid();
  const compact = code.replace(/\s/g, '');
  if (compact.length > SAVE_RULES.importMaxLength) throw invalid();
  const match = /^RB1:([A-Za-z0-9_-]+):([0-9A-F]{8})$/.exec(compact); if (!match) throw invalid();
  const [, payload, checksum] = match; if (payload.length % 4 === 1) throw invalid();
  const binary = atob(payload.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - payload.length % 4) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (base64url(bytes) !== payload || crc32(bytes) !== Number.parseInt(checksum, 16)) throw invalid();
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return validateSave(JSON.parse(text));
}
