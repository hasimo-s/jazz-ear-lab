// Salamander Grand Piano V3 (CC BY 3.0, Alexander Holm) のサンプルを
// npmパッケージから public/samples/piano にコピーする。
// '#' はURLで扱いにくいため 's' に置き換える (D#4v8.mp3 -> Ds4.mp3)。
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('@audio-samples/piano-mp3-velocity8/package.json'));
const src = join(pkgDir, 'audio');
const dest = join(process.cwd(), 'public', 'samples', 'piano');
mkdirSync(dest, { recursive: true });

let copied = 0;
for (const file of readdirSync(src)) {
  const m = /^([A-G]#?)(\d)v8\.mp3$/.exec(file);
  if (!m) continue;
  const octave = Number(m[2]);
  if (octave < 1 || octave > 7) continue; // 使用音域外は除外
  const out = `${m[1].replace('#', 's')}${octave}.mp3`;
  if (!existsSync(join(dest, out))) {
    cpSync(join(src, file), join(dest, out));
    copied++;
  }
}
console.log(`[samples] ${copied} file(s) copied to public/samples/piano`);
