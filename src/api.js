// Board operations against the local/P2P Yjs document (no backend).
// Function signatures mirror the original REST client.

import {
  openBoard,
  closeBoard,
  getSession as session,
  waitForBoard,
  getUid,
  newId,
  knownBoards,
  rememberBoard,
  destroyBoard,
} from './p2p.js';

const ok = () => ({ ok: true, status: 200 });

export function normaliseBoard(s, id) {
  const meta = s.meta.toJSON();
  return {
    cards_open: true,
    voting_open: true,
    ice_breaking: '',
    open_permission: false,
    max_votes: 0,
    focused_card: null,
    ...meta,
    data: meta.data ?? {},
    id,
    owner: meta.owner === getUid(),
  };
}

export function normaliseRank(s, id) {
  return { ...s.columns.get(id), id };
}

export function normaliseCard(s, id) {
  const uid = getUid();
  const raw = s.cards.get(id);
  if (!raw) return null;
  let votes = 0;
  let voted = false;
  for (const key of s.votes.keys()) {
    const [cardId, voter] = key.split('|');
    if (cardId === id) {
      votes++;
      if (voter === uid) voted = true;
    }
  }
  const reactions = {};
  let reacted = '';
  for (const [key, emoji] of s.reactions.entries()) {
    const [cardId, reactor] = key.split('|');
    if (cardId !== id) continue;
    reactions[emoji] = (reactions[emoji] ?? 0) + 1;
    if (reactor === uid) reacted = emoji;
  }
  return {
    ...raw,
    id,
    votes,
    voted,
    reactions,
    reacted,
    owner: raw.owner === uid,
    created_at: new Date(raw.created_at ?? Date.now()),
  };
}

// Number of votes the current user has cast on this board.
export function votesUsed(s) {
  const uid = getUid();
  let n = 0;
  for (const key of s.votes.keys()) {
    const [cardId, voter] = key.split('|');
    if (voter === uid && s.cards.has(cardId)) n++;
  }
  return n;
}

export async function createAuthToken() {
  return getUid();
}

export async function getBoard(boardId) {
  const s = openBoard(boardId);
  try {
    await waitForBoard(s);
  } catch {
    closeBoard(boardId);
    return { error: 'Not Found' };
  }
  const board = normaliseBoard(s, boardId);
  rememberBoard(boardId, {
    name: board.name,
    created_at: board.created_at,
    owner: board.owner,
    data: board.data,
  });
  closeBoard(boardId);
  return board;
}

export async function getBoards() {
  return Object.entries(knownBoards())
    .map(([id, info]) => ({
      id,
      name: info.name ?? '',
      created_at: info.created_at ?? 0,
      data: info.data ?? {},
      owner: info.owner ?? false,
    }))
    .sort((a, b) => b.created_at - a.created_at);
}

export async function getRanks(boardId) {
  const s = session(boardId);
  await s.ready;
  return [...s.columns.keys()].map((id) => normaliseRank(s, id));
}

const BOARD_FIELDS = [
  'name',
  'data',
  'cards_open',
  'voting_open',
  'ice_breaking',
  'open_permission',
  'max_votes',
  'focused_card',
];

export async function updateBoard(board) {
  const s = session(board.id);
  s.ydoc.transact(() => {
    for (const f of BOARD_FIELDS) {
      if (board[f] === undefined) continue;
      if (JSON.stringify(s.meta.get(f)) !== JSON.stringify(board[f])) {
        s.meta.set(f, board[f]);
      }
    }
  });
  rememberBoard(board.id, { name: board.name });
  return normaliseBoard(s, board.id);
}

export async function updateRank(boardId, rank) {
  const s = session(boardId);
  const { name, position, data } = { ...s.columns.get(rank.id), ...rank };
  s.columns.set(rank.id, { name, position, data });
  return normaliseRank(s, rank.id);
}

export async function createRank(boardId, name, position, data) {
  const s = session(boardId);
  const id = newId();
  s.columns.set(id, { name, position, data });
  return normaliseRank(s, id);
}

export async function createBoard(
  name,
  data,
  ice_breaking,
  open_permission = false
) {
  const id = newId();
  const s = session(id);
  await s.ready;
  const created_at = Date.now();
  s.ydoc.transact(() => {
    s.meta.set('name', name);
    s.meta.set('data', data);
    s.meta.set('cards_open', true);
    s.meta.set('voting_open', true);
    s.meta.set('ice_breaking', ice_breaking);
    s.meta.set('open_permission', open_permission);
    s.meta.set('max_votes', 0);
    s.meta.set('owner', getUid());
    s.meta.set('created_at', created_at);
  });
  rememberBoard(id, { name, created_at, owner: true, data });
  return normaliseBoard(s, id);
}

export async function createCard(boardId, rankId, text, author) {
  const s = session(boardId);
  const id = newId();
  s.cards.set(id, {
    text,
    author,
    column: rankId,
    owner: getUid(),
    created_at: Date.now(),
  });
  return normaliseCard(s, id);
}

export async function updateCard(board, card) {
  const s = session(board.id);
  const current = s.cards.get(card.id);
  if (!current) throw new Error('Card not found');
  s.cards.set(card.id, { ...current, text: card.text, column: card.column });
  return normaliseCard(s, card.id);
}

export async function deleteCard(board, card) {
  const s = session(board.id);
  s.ydoc.transact(() => {
    s.cards.delete(card.id);
    for (const key of [...s.votes.keys()]) {
      if (key.startsWith(`${card.id}|`)) s.votes.delete(key);
    }
    for (const key of [...s.reactions.keys()]) {
      if (key.startsWith(`${card.id}|`)) s.reactions.delete(key);
    }
    if (s.meta.get('focused_card') === card.id) {
      s.meta.set('focused_card', null);
    }
  });
  return ok();
}

export async function agree(board, card) {
  const s = session(board.id);
  const max = s.meta.get('max_votes') ?? 0;
  if (max > 0 && votesUsed(s) >= max) {
    return { ok: false, status: 429 };
  }
  s.votes.set(`${card.id}|${getUid()}`, true);
  return ok();
}

export async function undoAgree(board, card) {
  session(board.id).votes.delete(`${card.id}|${getUid()}`);
  return ok();
}

export async function deleteRank(boardId, rankId) {
  const s = session(boardId);
  s.ydoc.transact(() => {
    s.columns.delete(rankId);
    for (const [id, c] of [...s.cards.entries()]) {
      if (c.column === rankId) s.cards.delete(id);
    }
  });
  return ok();
}

export async function deleteBoard(boardId) {
  // Boards live in participants' browsers; "delete" forgets the local copy.
  await destroyBoard(boardId);
  return ok();
}

export async function react(board, card, reaction) {
  session(board.id).reactions.set(`${card.id}|${getUid()}`, reaction);
  return ok();
}

export async function undoReact(board, card) {
  session(board.id).reactions.delete(`${card.id}|${getUid()}`);
  return ok();
}
