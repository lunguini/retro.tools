// Realtime subscriptions over the P2P Yjs document. Kept under the original
// module name/signatures so components didn't need to change.

import { openBoard, closeBoard, getUid } from './p2p.js';
import { normaliseBoard, normaliseCard, normaliseRank } from './api.js';
import { uid } from './store.js';

export async function signIn() {
  uid.set(getUid());
}

function subscribeMap(boardId, pick, onChange) {
  const s = openBoard(boardId);
  const map = pick(s);
  const observer = (event) => onChange(s, event);
  map.observe(observer);
  return () => {
    map.unobserve(observer);
    closeBoard(boardId);
  };
}

export async function subscribeToCards(
  boardId,
  newCallback,
  updateCallback,
  deleteCallback
) {
  await signIn();
  const s = openBoard(boardId);
  await s.ready;

  const emit = (id, action) => {
    if (action === 'delete') return deleteCallback(id);
    const card = normaliseCard(s, id);
    if (!card) return deleteCallback(id);
    (action === 'add' ? newCallback : updateCallback)(card);
  };

  // Initial snapshot
  for (const id of s.cards.keys()) emit(id, 'add');

  const unsubCards = subscribeMap(
    boardId,
    (s) => s.cards,
    (_s, event) => {
      event.changes.keys.forEach(({ action }, id) => emit(id, action));
    }
  );
  const relatedChange = (_s, event) => {
    const touched = new Set();
    event.changes.keys.forEach((_c, key) => touched.add(key.split('|')[0]));
    touched.forEach((id) => s.cards.has(id) && emit(id, 'update'));
  };
  const unsubVotes = subscribeMap(boardId, (s) => s.votes, relatedChange);
  const unsubReactions = subscribeMap(
    boardId,
    (s) => s.reactions,
    relatedChange
  );

  return () => {
    unsubCards();
    unsubVotes();
    unsubReactions();
    closeBoard(boardId);
  };
}

export async function subscribeToBoard(boardId, updateCallback) {
  await signIn();
  return subscribeMap(
    boardId,
    (s) => s.meta,
    (s) => updateCallback(normaliseBoard(s, boardId))
  );
}

export async function subscribeToRanks(
  boardId,
  newCallback,
  updateCallback,
  deleteCallback
) {
  await signIn();
  return subscribeMap(
    boardId,
    (s) => s.columns,
    (s, event) => {
      event.changes.keys.forEach(({ action }, id) => {
        if (action === 'delete') deleteCallback(id);
        else if (action === 'add') newCallback(normaliseRank(s, id));
        else updateCallback(normaliseRank(s, id));
      });
    }
  );
}
