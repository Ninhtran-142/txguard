// Pre-build step: transpile the injected (page main-world) provider hook from
// TypeScript to a standalone JS file in public/injected/.
//
// Vite's `?url` asset handling copies `.ts` files verbatim (no transpile), so
// Chrome would receive raw TypeScript and throw a SyntaxError. We use Vite's
// own build API (library/IIFE mode) to compile the single self-contained
// entry to executable JS, then move it into public/injected/. publicDir:false
// prevents Vite from copying the whole public/ folder into the temp outDir.
import { build } from 'vite';
import { rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(root, '.injected-tmp');
const destDir = join(root, 'public', 'injected');

rmSync(tmp, { recursive: true, force: true });
await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  build: {
    outDir: '.injected-tmp',
    emptyOutDir: true,
    lib: {
      entry: join(root, 'src/injected/providerHook.ts'),
      name: 'TxGuardProviderHook',
      formats: ['iife'],
      fileName: () => 'providerHook.js',
    },
    minify: false,
    sourcemap: false,
  },
});

mkdirSync(destDir, { recursive: true });
copyFileSync(join(tmp, 'providerHook.js'), join(destDir, 'providerHook.js'));
rmSync(tmp, { recursive: true, force: true });
console.log('built public/injected/providerHook.js');
