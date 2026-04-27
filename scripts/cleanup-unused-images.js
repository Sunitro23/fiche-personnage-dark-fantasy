import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const uploadsDir = path.join(rootDir, 'uploads');
const charactersDir = path.join(rootDir, 'data', 'characters');
const dryRun = process.argv.includes('--dry-run');

function portraitFilename(portraitUrl) {
  if (!portraitUrl || typeof portraitUrl !== 'string') return null;

  const match = portraitUrl.match(/\/uploads\/([^/?#]+)/);
  if (!match) return null;

  return decodeURIComponent(match[1]);
}

async function listFiles(dir) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

await mkdir(uploadsDir, { recursive: true });
await mkdir(charactersDir, { recursive: true });

const referenced = new Set();
const characterFiles = await listFiles(charactersDir);

for (const entry of characterFiles) {
  if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

  try {
    const character = JSON.parse(await readFile(path.join(charactersDir, entry.name), 'utf8'));
    const filename = portraitFilename(character.portraitUrl);
    if (filename) referenced.add(filename);
  } catch (error) {
    console.warn(`Fiche ignoree (${entry.name}) : ${error.message}`);
  }
}

const uploads = await listFiles(uploadsDir);
const unused = uploads.filter((entry) => entry.isFile() && !referenced.has(entry.name));

for (const entry of unused) {
  const filePath = path.join(uploadsDir, entry.name);
  if (dryRun) {
    console.log(`[dry-run] ${filePath}`);
  } else {
    await rm(filePath);
    console.log(`Supprime : ${filePath}`);
  }
}

if (unused.length === 0) {
  console.log('Aucune image inutilisee.');
}
