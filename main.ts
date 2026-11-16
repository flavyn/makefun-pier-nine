// main.ts — hands Pier Nine in: copies game/ and screenshots/ out, then writes dossier.json with
// the kit's own buildDossier, so the gate's rebuild is byte for byte the file this program writes.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-threejs.ts';

const repo = resolve(import.meta.dirname);
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const shots = join(repo, 'screenshots');
if (!existsSync(shots)) {
  console.error('screenshots/: missing, so the entry would carry no render of its own game. Run the capture first.');
  process.exit(1);
}
const shotFiles = readdirSync(shots).filter((name) => !name.startsWith('.'));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  console.error(`screenshots/: ${shotFiles.length} images, and the gate wants 3 or 4.`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
cpSync(join(repo, 'game'), join(out, 'game'), { recursive: true });
cpSync(shots, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(repo, caps);
writeFileSync(join(out, 'dossier.json'), dossier);

let shotBytes = 0;
for (const name of shotFiles) shotBytes += statSync(join(shots, name)).size;
console.log(`dossier.json ${dossier.byteLength} B`);
console.log(`screenshots ${shotFiles.length} files, ${shotBytes} B`);
console.log(`game/ written to ${join(out, 'game')}`);
