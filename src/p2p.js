// Serverless board storage: each board is a Yjs document, persisted locally in
// IndexedDB and synced between participants over WebRTC (Trystero, with public
// Nostr relays used only for peer discovery/signalling).
//
// Document layout (all top-level Y.Maps):
//   meta      board fields (name, data, cards_open, voting_open, max_votes, ...)
//   columns   columnId -> { name, position, data }
//   cards     cardId   -> { text, author, column, owner, created_at }
//   votes     `${cardId}|${uid}` -> true
//   reactions `${cardId}|${uid}` -> emoji
// Votes and reactions are keyed per user so concurrent edits never clobber
// each other.

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { joinRoom } from 'trystero';

const APP_ID = 'retro-tools-p2p';
const BOARDS_KEY = 'p2pBoards';

export function getUid() {
  let id = localStorage.getItem('p2pUid');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('p2pUid', id);
  }
  return id;
}

export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Locally remembered boards (replaces the server's "my boards" listing).
export function knownBoards() {
  try {
    return JSON.parse(localStorage.getItem(BOARDS_KEY)) ?? {};
  } catch {
    return {};
  }
}

export function rememberBoard(id, info) {
  const boards = knownBoards();
  boards[id] = { ...boards[id], ...info };
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
}

export function forgetBoard(id) {
  const boards = knownBoards();
  delete boards[id];
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
}

const sessions = new Map();

function connect(boardId, ydoc) {
  const listeners = new Set();
  const status = { peers: 0 };
  let room;
  try {
    room = joinRoom({ appId: APP_ID, identity: 'none' }, boardId);
  } catch (err) {
    console.error('P2P connection failed', err);
    return { status, listeners, leave() {} };
  }
  const sync = room.makeAction('ysync');
  const update = room.makeAction('yupdate');
  const notify = () => listeners.forEach((l) => l(status));

  room.onPeerJoin(({ peerId }) => {
    status.peers = Object.keys(room.getPeers()).length;
    notify();
    // Ask the new peer for what we're missing; they do the same.
    sync.send(Y.encodeStateVector(ydoc), { target: peerId });
  });
  room.onPeerLeave(() => {
    status.peers = Object.keys(room.getPeers()).length;
    notify();
  });
  sync.onMessage((stateVector, { peerId }) => {
    const diff = Y.encodeStateAsUpdate(ydoc, new Uint8Array(stateVector));
    update.send(diff, { target: peerId });
  });
  update.onMessage((u) => Y.applyUpdate(ydoc, new Uint8Array(u), 'remote'));

  const onUpdate = (u, origin) => {
    if (origin !== 'remote' && origin !== 'idb') update.send(u);
  };
  ydoc.on('update', onUpdate);

  return {
    status,
    listeners,
    leave() {
      ydoc.off('update', onUpdate);
      room.leave();
    },
  };
}

// Returns a shared, ref-counted session for a board.
export function openBoard(boardId) {
  let s = sessions.get(boardId);
  if (!s) {
    const ydoc = new Y.Doc();
    const idb = new IndexeddbPersistence(`retro-${boardId}`, ydoc);
    s = {
      ydoc,
      idb,
      refs: 0,
      ready: idb.whenSynced,
      net: connect(boardId, ydoc),
      meta: ydoc.getMap('meta'),
      columns: ydoc.getMap('columns'),
      cards: ydoc.getMap('cards'),
      votes: ydoc.getMap('votes'),
      reactions: ydoc.getMap('reactions'),
    };
    sessions.set(boardId, s);
  }
  s.refs++;
  return s;
}

// Existing session, or a new one that stays open for the page's lifetime.
export function getSession(boardId) {
  return sessions.get(boardId) ?? openBoard(boardId);
}

export function closeBoard(boardId) {
  const s = sessions.get(boardId);
  if (!s) return;
  if (--s.refs <= 0) {
    s.net.leave();
    s.idb.destroy();
    s.ydoc.destroy();
    sessions.delete(boardId);
  }
}

// Wipe the local copy of a board and disconnect.
export async function destroyBoard(boardId) {
  const s = getSession(boardId);
  await s.ready;
  s.net.leave();
  await s.idb.clearData();
  s.ydoc.destroy();
  sessions.delete(boardId);
  forgetBoard(boardId);
}

// Resolve once the board has content (locally or from a peer), or reject
// after `timeoutMs` with nobody to sync from.
export async function waitForBoard(s, timeoutMs = 15000) {
  await s.ready;
  if (s.meta.has('created_at')) return;
  await new Promise((resolve, reject) => {
    const check = () => {
      if (s.meta.has('created_at')) {
        s.meta.unobserve(check);
        clearTimeout(t);
        resolve();
      }
    };
    const t = setTimeout(() => {
      s.meta.unobserve(check);
      reject(new Error('Not Found'));
    }, timeoutMs);
    s.meta.observe(check);
  });
}

export function onPeersChange(s, fn) {
  s.net.listeners.add(fn);
  fn(s.net.status);
  return () => s.net.listeners.delete(fn);
}
