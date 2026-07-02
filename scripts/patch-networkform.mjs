import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const f = join(root, 'src/settings/NetworkForm.tsx');
let s = readFileSync(f, 'utf8');
if (s.includes('rateLimited')) {
  console.log('already patched');
  process.exit(0);
}
const oldBlock = '{testResult.success\n            ? `\u2705 Connected';
const newBlock = '{testResult.rateLimited\n            ? `\u26A0\uFE0F ${testResult.error}`\n            : testResult.success\n            ? `\u2705 Connected';
if (!s.includes(oldBlock)) {
  console.error('target block not found');
  process.exit(1);
}
s = s.replace(oldBlock, newBlock);
writeFileSync(f, s);
console.log('NetworkForm patched with rate-limit display');
