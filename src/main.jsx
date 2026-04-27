import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const STAT_DEFS = [
  ['CON', 'Points de vie', 'coeur'],
  ['END', 'Blessures graves, survie, mort', 'crane'],
  ['FOR', 'Armes lourdes, parade, puissance', 'bras'],
  ['DEX', 'Initiative, esquive, armes rapides', 'lame'],
  ['VOL', 'Magie, résistance mentale', 'flamme'],
  ['PRES', 'Social, intimidation, commandement', 'couronne'],
  ['CHANCE', 'Relances, survie miraculeuse, destin', 'etoile'],
];

const MAX_STAT = 18;
const BASE_STAT = 5;
const STAT_BUDGET = 35;
const START_LEVEL = 35;
const API_URL = import.meta.env.VITE_API_URL ?? '/api';

const EMPTY_CHARACTER = {
  id: '',
  nom: 'Aric le Vagabond',
  portraitUrl: '',
  stats: {
    CON: BASE_STAT,
    END: BASE_STAT,
    FOR: BASE_STAT,
    DEX: BASE_STAT,
    VOL: BASE_STAT,
    PRES: BASE_STAT,
    CHANCE: BASE_STAT,
  },
  pvActuels: BASE_STAT,
  chanceActuelle: BASE_STAT,
  ames: 0,
  niveau: START_LEVEL,
  armure: {
    nom: 'Armure de Vagabond',
    reduction: 2,
  },
  armes: [],
  blessures: 'Aucune blessure grave.',
  notes: 'Notes, historique, objectifs, relations...',
};

function getMod(stat) {
  return Math.floor((stat - 10) / 2);
}

function formatMod(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function pointsUsed(stats) {
  return Object.values(stats).reduce((sum, value) => sum + Math.max(0, value - BASE_STAT), 0);
}

function levelUpCost(level) {
  return Math.max(1, Math.ceil((0.02 * level ** 3) + (3.06 * level ** 2) + (105.6 * level) - 895));
}

function toSaveData(character) {
  return {
    id: character.id,
    nom: character.nom,
    portraitUrl: character.portraitUrl,
    stats: character.stats,
    pvActuels: character.pvActuels,
    chanceActuelle: character.chanceActuelle,
    ames: Number(character.ames ?? 0),
    niveau: Number(character.niveau ?? START_LEVEL),
    armure: {
      nom: character.armure.nom,
      reduction: character.armure.reduction,
    },
    armes: character.armes.map((weapon) => ({
      id: weapon.id,
      nom: weapon.nom,
      degats: weapon.degats,
      stat: weapon.stat,
    })),
    blessures: character.blessures,
    notes: character.notes,
  };
}

function App() {
  const [character, setCharacter] = useState(EMPTY_CHARACTER);
  const [characters, setCharacters] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [creationStats, setCreationStats] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const portraitInputRef = useRef(null);
  const [uploadError, setUploadError] = useState('');
  const didLoadCharacter = useRef(false);
  const used = useMemo(() => pointsUsed(character.stats), [character.stats]);
  const level = Number(character.niveau ?? START_LEVEL);
  const nextLevelCost = useMemo(() => levelUpCost(level), [level]);
  const pvMax = character.stats.CON;
  const chanceMax = character.stats.CHANCE;

  useEffect(() => {
    loadCharacters();
  }, []);

  useEffect(() => {
    if (!selectedId || !didLoadCharacter.current) return undefined;

    const timeoutId = window.setTimeout(async () => {
      setIsSaving(true);
      try {
        const response = await fetch(`${API_URL}/characters/${selectedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSaveData(character)),
        });

        if (!response.ok) throw new Error('Sauvegarde impossible.');
        const saved = await response.json();
        setCharacters((current) => current.map((item) => (item.id === saved.id ? saved : item)));
        setStatusMessage('Sauvegardé');
      } catch (error) {
        setStatusMessage(error.message);
      } finally {
        setIsSaving(false);
      }
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [character, selectedId]);

  function patch(next) {
    setCharacter((current) => ({ ...current, ...next }));
  }

  async function loadCharacters() {
    try {
      const response = await fetch(`${API_URL}/characters`);
      if (!response.ok) throw new Error('Chargement impossible.');
      setCharacters(await response.json());
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  async function createCharacter() {
    didLoadCharacter.current = false;
    setStatusMessage('');

    try {
      const stats = creationStats ?? EMPTY_CHARACTER.stats;
      const response = await fetch(`${API_URL}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSaveData({
          ...EMPTY_CHARACTER,
          stats,
          pvActuels: stats.CON,
          chanceActuelle: stats.CHANCE,
          ames: 0,
          niveau: START_LEVEL,
        })),
      });

      if (!response.ok) throw new Error('Création impossible.');
      const created = await response.json();
      setCharacters((current) => [created, ...current]);
      setCharacter(created);
      setSelectedId(created.id);
      setCreationStats(null);
      didLoadCharacter.current = true;
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  async function openCharacter(id) {
    didLoadCharacter.current = false;
    setStatusMessage('');

    try {
      const response = await fetch(`${API_URL}/characters/${id}`);
      if (!response.ok) throw new Error('Personnage introuvable.');
      setCharacter(await response.json());
      setSelectedId(id);
      didLoadCharacter.current = true;
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  async function deleteCharacter(event, id, name) {
    event.stopPropagation();
    if (!window.confirm(`Supprimer ${name || 'ce personnage'} ?`)) return;

    try {
      const response = await fetch(`${API_URL}/characters/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Suppression impossible.');
      setCharacters((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  function backToSelection() {
    didLoadCharacter.current = false;
    setSelectedId('');
    setCreationStats(null);
    setCharacter(EMPTY_CHARACTER);
    loadCharacters();
  }

  function startCreation() {
    setCreationStats(EMPTY_CHARACTER.stats);
    setStatusMessage('');
  }

  function patchCreationStat(stat, delta) {
    setCreationStats((current) => {
      const stats = current ?? EMPTY_CHARACTER.stats;
      const currentUsed = pointsUsed(stats);
      if (delta > 0 && currentUsed >= STAT_BUDGET) return stats;
      if (delta > 0 && stats[stat] >= MAX_STAT) return stats;

      return {
        ...stats,
        [stat]: Math.min(MAX_STAT, Math.max(BASE_STAT, stats[stat] + delta)),
      };
    });
  }

  function increaseStatWithSouls(stat) {
    setCharacter((current) => {
      if (current.stats[stat] >= MAX_STAT) return current;

      const cost = levelUpCost(Number(current.niveau ?? START_LEVEL));
      if (Number(current.ames ?? 0) < cost) return current;

      const nextStats = { ...current.stats, [stat]: current.stats[stat] + 1 };
      const nextCharacter = {
        ...current,
        ames: Number(current.ames ?? 0) - cost,
        niveau: Number(current.niveau ?? START_LEVEL) + 1,
        stats: nextStats,
      };

      if (stat === 'CON') {
        nextCharacter.pvActuels = current.pvActuels + 1;
      }

      if (stat === 'CHANCE') {
        nextCharacter.chanceActuelle = current.chanceActuelle + 1;
      }

      return nextCharacter;
    });
  }

  function updateWeapon(id, field, value) {
    setCharacter((current) => ({
      ...current,
      armes: current.armes.map((weapon) => (weapon.id === id ? { ...weapon, [field]: value } : weapon)),
    }));
  }

  function addWeapon() {
    setCharacter((current) => ({
      ...current,
      armes: [...current.armes, { id: crypto.randomUUID(), nom: '', degats: 'd6', stat: 'FOR' }],
    }));
  }

  function removeWeapon(id) {
    setCharacter((current) => ({
      ...current,
      armes: current.armes.filter((weapon) => weapon.id !== id),
    }));
  }

  async function uploadPortrait(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('portrait', file);
    setUploadError('');

    try {
      const response = await fetch(`${API_URL}/portrait`, {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Upload impossible.');

      patch({ portraitUrl: payload.url });
    } catch (error) {
      setUploadError(error.message);
    } finally {
      event.target.value = '';
    }
  }

  if (!selectedId && creationStats) {
    const creationUsed = pointsUsed(creationStats);

    return (
      <main className="page-shell">
        <section className="panel creation-panel">
          <div className="sheet-toolbar">
            <button onClick={backToSelection}>← Personnages</button>
            <span>{creationUsed} / {STAT_BUDGET}</span>
          </div>

          <div className="panel-title">
            <h2>Choisir les statistiques</h2>
            <p><span>{creationUsed} / {STAT_BUDGET}</span>Base {BASE_STAT} · maximum {MAX_STAT}</p>
          </div>

          <div className="stat-list">
            {STAT_DEFS.map(([stat, help, icon]) => (
              <article className="stat-row" key={stat}>
                <div className={`stat-icon ${icon}`} aria-hidden="true" />
                <div className="stat-copy">
                  <strong>{stat}</strong>
                  <small>{help}</small>
                </div>
                <div className="stat-controls">
                  <button disabled={creationStats[stat] <= BASE_STAT} onClick={() => patchCreationStat(stat, -1)}>-</button>
                  <output>{creationStats[stat]}</output>
                  <button disabled={creationUsed >= STAT_BUDGET || creationStats[stat] >= MAX_STAT} onClick={() => patchCreationStat(stat, 1)}>+</button>
                  <span>{formatMod(getMod(creationStats[stat]))}</span>
                </div>
              </article>
            ))}
          </div>

          <button className="create-character-button" disabled={creationUsed !== STAT_BUDGET} onClick={createCharacter}>
            Créer le personnage
          </button>
        </section>
      </main>
    );
  }

  if (!selectedId) {
    return (
      <main className="page-shell">
        <section className="panel selection-panel">
          <div className="section-heading">
            <h2>Choisir un personnage</h2>
            <button className="add-button" aria-label="Créer un personnage" onClick={startCreation}>+</button>
          </div>

          <div className="character-list">
            {characters.length === 0 ? (
              <p className="empty-state">Aucun personnage sauvegardé.</p>
            ) : (
              characters.map((item) => (
                <button className="character-card" key={item.id} onClick={() => openCharacter(item.id)}>
                  <span className="character-thumb">
                    {item.portraitUrl ? <img src={item.portraitUrl} alt="" /> : <span />}
                  </span>
                  <span>
                    <strong>{item.nom || 'Sans nom'}</strong>
                    <small>{item.updatedAt ? new Date(item.updatedAt).toLocaleString('fr-FR') : 'Non daté'}</small>
                  </span>
                  <span
                    className="character-delete"
                    role="button"
                    tabIndex="0"
                    aria-label={`Supprimer ${item.nom || 'ce personnage'}`}
                    onClick={(event) => deleteCharacter(event, item.id, item.nom)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') deleteCharacter(event, item.id, item.nom);
                    }}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M9 4h6l1 2h4v2H4V6h4l1-2Z" />
                      <path d="M7 10h10l-1 10H8L7 10Z" />
                      <path d="M10 12v6M14 12v6" />
                    </svg>
                  </span>
                </button>
              ))
            )}
          </div>

          {statusMessage ? <p className="save-status">{statusMessage}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="sheet-toolbar">
        <button onClick={backToSelection}>← Personnages</button>
        <span>{isSaving ? 'Sauvegarde...' : statusMessage}</span>
      </div>

      <section className="sheet-grid">
        <section className="panel identity-panel">
          <div className="portrait-frame">
            {character.portraitUrl ? (
              <img src={character.portraitUrl} alt={`Portrait de ${character.nom || 'personnage'}`} />
            ) : (
              <div className="portrait-figure" />
            )}
            <button className="portrait-upload" onClick={() => portraitInputRef.current?.click()}>
              +
            </button>
            <input ref={portraitInputRef} type="file" accept="image/*" onChange={uploadPortrait} />
            {uploadError ? <small className="upload-error">{uploadError}</small> : null}
          </div>

          <div className="field-stack">
            <div className="identity-fields">
              <TextField label="Nom" value={character.nom} onChange={(nom) => patch({ nom })} />
              <label className="field souls-field">
                <span>Âmes</span>
                <input
                  type="number"
                  min="0"
                  value={character.ames}
                  onChange={(event) => patch({ ames: Number(event.target.value) })}
                />
              </label>
            </div>

            <div className="identity-meters">
              <div className="meter-card">
                <span>PV actuels</span>
                <div className="large-value">{character.pvActuels} / {pvMax}</div>
                <input
                  className="range blood"
                  min="0"
                  max={pvMax}
                  type="range"
                  value={character.pvActuels}
                  onChange={(event) => patch({ pvActuels: Number(event.target.value) })}
                />
                <div className="stepper-line">
                  <button onClick={() => patch({ pvActuels: Math.max(0, character.pvActuels - 1) })}>-</button>
                  <button onClick={() => patch({ pvActuels: Math.min(pvMax, character.pvActuels + 1) })}>+</button>
                </div>
              </div>

              <div className="meter-card">
                <span>Chance actuelle</span>
                <div className="large-value">{character.chanceActuelle} / {chanceMax}</div>
                <input
                  className="range luck"
                  min="0"
                  max={chanceMax}
                  type="range"
                  value={character.chanceActuelle}
                  onChange={(event) => patch({ chanceActuelle: Number(event.target.value) })}
                />
                <div className="button-row compact">
                  <button onClick={() => patch({ chanceActuelle: Math.max(0, character.chanceActuelle - 1) })}>-</button>
                  <button onClick={() => patch({ chanceActuelle: Math.min(chanceMax, character.chanceActuelle + 1) })}>+</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel stats-panel">
          <div className="panel-title">
            <h2>Statistiques</h2>
          </div>

          <div className="level-up-summary">
            <div>
              <span>Niveau</span>
              <strong>{level}</strong>
            </div>
            <p>Coût de montée : {nextLevelCost} âmes</p>
          </div>

          <div className="stat-list">
            {STAT_DEFS.map(([stat, help, icon]) => (
              <article className="stat-row" key={stat}>
                <div className={`stat-icon ${icon}`} aria-hidden="true" />
                <div className="stat-copy">
                  <strong>{stat}</strong>
                  <small>{help}</small>
                </div>
                <div className="stat-controls">
                  <button disabled>-</button>
                  <output>{character.stats[stat]}</output>
                  <button
                    disabled={character.stats[stat] >= MAX_STAT || Number(character.ames ?? 0) < nextLevelCost}
                    onClick={() => increaseStatWithSouls(stat)}
                  >
                    +
                  </button>
                  <span>{formatMod(getMod(character.stats[stat]))}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel inventory-panel">
          <div className="section-heading">
            <h2>Inventaire</h2>
            <button className="add-button" aria-label="Ajouter une arme ou un sort" onClick={addWeapon}>+</button>
          </div>

          <div className="inventory-list">
            <article className="inventory-row armor-item">
              <span className="item-icon shield-icon" aria-hidden="true" />
              <input
                aria-label="Nom de l'armure"
                value={character.armure.nom}
                onChange={(event) => patch({ armure: { ...character.armure, nom: event.target.value } })}
              />
              <label className="armor-reduction">
                <input
                  aria-label="Réduction fixe"
                  type="number"
                  min="0"
                  value={character.armure.reduction}
                  onChange={(event) => patch({ armure: { ...character.armure, reduction: Number(event.target.value) } })}
                />
              </label>
            </article>

            {character.armes.map((weapon) => (
              <article className="inventory-row weapon-row" key={weapon.id}>
                <span className={`item-icon ${weapon.stat === 'VOL' ? 'spell-icon' : 'blade-icon'}`} aria-hidden="true" />
                <input
                  aria-label="Nom de l'arme ou du sort"
                  value={weapon.nom}
                  placeholder="Nom"
                  onChange={(event) => updateWeapon(weapon.id, 'nom', event.target.value)}
                />
                <select value={weapon.degats} onChange={(event) => updateWeapon(weapon.id, 'degats', event.target.value)}>
                  {['d4', 'd6', 'd8', 'd10', 'd12'].map((die) => <option key={die}>{die}</option>)}
                </select>
                <select value={weapon.stat} onChange={(event) => updateWeapon(weapon.id, 'stat', event.target.value)}>
                  {['FOR', 'DEX', 'VOL'].map((stat) => (
                    <option key={stat} value={stat}>
                      {stat} ({formatMod(getMod(character.stats[stat]))})
                    </option>
                  ))}
                </select>
                <button className="delete-button" aria-label={`Supprimer ${weapon.nom || 'cette entrée'}`} onClick={() => removeWeapon(weapon.id)}>
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M9 4h6l1 2h4v2H4V6h4l1-2Z" />
                    <path d="M7 10h10l-1 10H8L7 10Z" />
                    <path d="M10 12v6M14 12v6" />
                  </svg>
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel notes-panel">
          <h2>Blessures graves & notes</h2>
          <label className="field">
            <span>Blessures graves</span>
            <textarea value={character.blessures} onChange={(event) => patch({ blessures: event.target.value })} />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea value={character.notes} onChange={(event) => patch({ notes: event.target.value })} />
          </label>
        </section>
      </section>

    </main>
  );
}

function TextField({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

createRoot(document.getElementById('root')).render(<App />);
