import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { mkdirSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
const charactersDir = path.join(__dirname, 'data', 'characters');
const distDir = path.join(__dirname, 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');
const port = process.env.PORT ?? 5174;

mkdirSync(uploadsDir, { recursive: true });
mkdirSync(charactersDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    callback(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('Le fichier doit etre une image.'));
      return;
    }

    callback(null, true);
  },
});

const app = express();

app.use(cors({ origin: ['http://127.0.0.1:5173', 'http://localhost:5173'] }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDir));

function characterPath(id) {
  return path.join(charactersDir, `${id}.json`);
}

function cleanCharacter(character) {
  return {
    id: character.id,
    nom: character.nom ?? 'Sans nom',
    portraitUrl: character.portraitUrl ?? '',
    stats: character.stats ?? {},
    pvActuels: Number(character.pvActuels ?? 0),
    chanceActuelle: Number(character.chanceActuelle ?? 0),
    ames: Number(character.ames ?? 0),
    niveau: Number(character.niveau ?? 35),
    armure: {
      nom: character.armure?.nom ?? '',
      reduction: Number(character.armure?.reduction ?? 0),
    },
    armes: Array.isArray(character.armes) ? character.armes : [],
    blessures: character.blessures ?? '',
    notes: character.notes ?? '',
    updatedAt: new Date().toISOString(),
  };
}

async function readCharacter(id) {
  const content = await fs.readFile(characterPath(id), 'utf8');
  return JSON.parse(content);
}

async function writeCharacter(character) {
  const clean = cleanCharacter(character);
  await fs.writeFile(characterPath(clean.id), JSON.stringify(clean, null, 2), 'utf8');
  return clean;
}

app.get('/api/characters', async (_request, response, next) => {
  try {
    const files = await fs.readdir(charactersDir);
    const characters = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => {
          const character = JSON.parse(await fs.readFile(path.join(charactersDir, file), 'utf8'));
          return {
            id: character.id,
            nom: character.nom,
            portraitUrl: character.portraitUrl,
            updatedAt: character.updatedAt,
          };
        }),
    );

    response.json(characters.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
  } catch (error) {
    next(error);
  }
});

app.post('/api/characters', async (request, response, next) => {
  try {
    const id = crypto.randomUUID();
    const character = await writeCharacter({ ...request.body, id });
    response.status(201).json(character);
  } catch (error) {
    next(error);
  }
});

app.get('/api/characters/:id', async (request, response, next) => {
  try {
    response.json(await readCharacter(request.params.id));
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.status(404).json({ error: 'Personnage introuvable.' });
      return;
    }

    next(error);
  }
});

app.put('/api/characters/:id', async (request, response, next) => {
  try {
    response.json(await writeCharacter({ ...request.body, id: request.params.id }));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/characters/:id', async (request, response, next) => {
  try {
    await fs.unlink(characterPath(request.params.id));
    response.status(204).end();
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.status(404).json({ error: 'Personnage introuvable.' });
      return;
    }

    next(error);
  }
});

app.post('/api/portrait', upload.single('portrait'), (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: 'Aucun fichier recu.' });
    return;
  }

  response.json({
    url: `/uploads/${request.file.filename}`,
  });
});

app.use(express.static(distDir));

app.get(/.*/, async (_request, response, next) => {
  try {
    await fs.access(indexHtmlPath);
    response.sendFile(indexHtmlPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.status(404).json({ error: 'Frontend non compile. Lancez npm run build.' });
      return;
    }

    next(error);
  }
});

app.use((error, _request, response, _next) => {
  response.status(400).json({ error: error.message ?? 'Upload impossible.' });
});

app.listen(port, () => {
  console.log(`Server listening on http://127.0.0.1:${port}`);
});
