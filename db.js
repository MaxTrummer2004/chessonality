/* ============================================================
   db.js  IndexedDB persistence for Chess Personality
   Stores: game analyses (with evals/book), profile, history
   ============================================================ */

'use strict';

const DB_NAME    = 'chess-personality';
const DB_VERSION = 1;

// Object store names
const STORE_GAMES   = 'games';     // full analyses (positions, evals, bookMoves, personality)
const STORE_PROFILE = 'profile';   // username, settings
const STORE_HISTORY = 'history';   // lightweight game list (for profile page)

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_GAMES)) {
        db.createObjectStore(STORE_GAMES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PROFILE)) {
        db.createObjectStore(STORE_PROFILE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        const hs = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
        hs.createIndex('date', 'date');
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror   = () => reject(req.error);
  });
}

// ---- Generic helpers ----
async function _put(store, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

async function _get(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

async function _getAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

async function _delete(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ---- Profile ----
async function dbGetProfile(key) {
  const row = await _get(STORE_PROFILE, key);
  return row ? row.value : null;
}

async function dbSetProfile(key, value) {
  await _put(STORE_PROFILE, { key, value });
}

// ---- History (lightweight entries for profile list) ----
async function dbGetHistory() {
  const all = await _getAll(STORE_HISTORY);
  // Sort newest first
  return all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

async function dbSaveHistoryEntry(entry) {
  // Deduplicate by pgn hash
  const all = await dbGetHistory();
  const dup = all.find(e => e.pgnHash === entry.pgnHash && e.pgnHash);
  if (dup) await _delete(STORE_HISTORY, dup.id);
  await _put(STORE_HISTORY, entry);
  // Cap at 50
  const updated = await dbGetHistory();
  if (updated.length > 50) {
    for (let i = 50; i < updated.length; i++) {
      await _delete(STORE_HISTORY, updated[i].id);
    }
  }
}

async function dbDeleteHistoryEntry(id) {
  await _delete(STORE_HISTORY, id);
  // Also delete the full game data
  await _delete(STORE_GAMES, id);
}

// ---- Full game analysis (heavy data) ----
async function dbSaveGame(id, data) {
  await _put(STORE_GAMES, { id, ...data });
}

async function dbLoadGame(id) {
  return await _get(STORE_GAMES, id);
}

// ---- Simple hash for PGN dedup ----
function pgnHash(pgn) {
  let h = 0;
  for (let i = 0; i < pgn.length; i++) {
    h = ((h << 5) - h + pgn.charCodeAt(i)) | 0;
  }
  return 'pgn_' + (h >>> 0).toString(36);
}

// ---- Migration: pull existing localStorage data into IndexedDB ----
async function migrateFromLocalStorage() {
  try {
    const raw = localStorage.getItem('ce-history');
    if (!raw) return;
    const old = JSON.parse(raw);
    if (!Array.isArray(old) || old.length === 0) return;

    for (const entry of old) {
      const he = {
        id:          entry.id || Date.now() + Math.random(),
        date:        entry.date || new Date().toISOString(),
        pgnHash:     pgnHash(entry.pgn || ''),
        pgn:         entry.pgn,
        playerColor: entry.playerColor,
        white:       entry.white,
        black:       entry.black,
        result:      entry.result,
        totalMoves:  entry.totalMoves,
        mistakes:    entry.mistakes,
        blunders:    entry.blunders,
        bookDepth:   entry.bookDepth,
        personality: entry.personality || null,
        personalityScores: entry.personalityScores || null
      };
      await dbSaveHistoryEntry(he);
    }

    // Migrate username
    const name = localStorage.getItem('ce-username');
    if (name) await dbSetProfile('username', name);

    // Clear old storage
    localStorage.removeItem('ce-history');
    localStorage.removeItem('ce-username');
    console.log('[DB] Migrated', old.length, 'entries from localStorage to IndexedDB');
  } catch (err) {
    console.warn('[DB] Migration failed:', err);
  }
}
