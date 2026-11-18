<script>
  import { Popover } from '@sveltestrap/sveltestrap';
  import { _ } from 'svelte-i18n';

  import {
    board,
    cards,
    colors,
    password,
    focusedCard,
    localFocusedCard,
    voteLimitReached,
  } from '../store.js';
  import {
    updateCard,
    deleteCard,
    agree,
    undoAgree,
    react,
    undoReact,
  } from '../api.js';
  import { decrypt, encrypt } from '../encryption.js';
  import { clickOutside } from '../utils.js';

  import Textarea from './Textarea.svelte';
  import Votes from './Votes.svelte';
  import EncryptedText from './EncryptedText.svelte';
  import ReactDrawer from './ReactDrawer.svelte';
  import Button from './Button.svelte';
  import { Icons } from '../data.js';

  let { card = $bindable(), color = $bindable(), onerror } = $props();

  let obscured = $derived($board.data?.obscure_cards && !card.owner);

  let focused = $derived($focusedCard === card.id);
  let dimmed = $derived($focusedCard != null && !focused);
  let cardEl = $state();

  // Bring the focused card into view for every participant.
  $effect(() => {
    if (focused && cardEl?.offsetParent) {
      cardEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });

  function setFocus(id) {
    if ($board.owner || $board.open_permission) {
      $board = { ...$board, focused_card: id };
    } else {
      $localFocusedCard = id;
    }
  }

  // Clicking a card focuses it (and unfocuses any other); clicking the
  // focused card again, outside its editable text, unfocuses it.
  function onCardClick(e) {
    if (editMode || deleteConfirmMode) return;
    if (e.target.closest('button, textarea, input, a, .popover')) return;
    if (e.target.closest('[data-name=react-drawer-button]')) return;
    const inContent = e.target.closest('[data-name=card-content]');
    if (focused && !inContent) setFocus(null);
    else if (!focused) setFocus(card.id);
  }

  let editMode = $state(false);
  let reactDrawOpen = $state(false);
  let newCardText = $state('');
  let deleteConfirmMode = $state(false);

  const cardSlug = (Math.random() + 1).toString(36).substring(7);

  function error(message, err) {
    onerror?.({ message, err });
  }

  async function startEdit() {
    if (!card.owner && !$board.owner && !$board.open_permission) {
      return;
    }
    let decrypted;
    try {
      decrypted = await decrypt(card.text, $password);
    } catch {
      return;
    }
    newCardText = decrypted;
    editMode = true;
  }

  function cancelEdit() {
    editMode = false;
  }

  async function submitEdit() {
    const newCard = {
      ...card,
      text: await encrypt(newCardText, $password),
      busy: true,
    };
    try {
      cards.replace(card.id, await updateCard($board, newCard));
      editMode = false;
    } catch (err) {
      error('error.updating_card', err);
    }
  }

  async function doDelete() {
    card.busy = true;
    try {
      await deleteCard($board, card);
      cards.remove(card.id);
    } catch (err) {
      error('error.card_delete', err);
    }
  }

  async function toggleVote() {
    if (card.busy) {
      return;
    }
    card.busy = true;
    try {
      if (card.voted) {
        let response = await undoAgree($board, card);
        if (response.ok) {
          card.voted = false;
        }
      } else {
        if ($voteLimitReached) {
          error('error.vote_limit_reached');
          return;
        }
        let response = await agree($board, card);
        if (response.ok) {
          card.voted = true;
        }
      }
    } catch (err) {
      error('error.vote_failed', err);
    } finally {
      card.busy = false;
    }
  }

  function doReact(emoji) {
    reactDrawOpen = false;
    (card.reacted === emoji
      ? undoReact($board, card)
      : react($board, card, emoji)
    ).catch((err) => error('error.react_failed', err));
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  data-name="card"
  data-focused={focused}
  bind:this={cardEl}
  class:busy={card.busy}
  class:focused
  class:dimmed
  class="rt-card"
  style="--lane: {$colors[color] ?? 'var(--rt-muted)'}"
  onclick={onCardClick}
>
  {#if editMode}
    <Textarea
      data-name="card-edit-field"
      autoresize
      autofocus
      bind:value={newCardText}
      onsubmit={submitEdit}
      oncancel={cancelEdit}
      onblur={submitEdit}
    />
  {:else}
    <div data-name="card-body">
      <div
        data-name="card-content"
        class="card-text pre-wrap"
        class:editable={!obscured &&
          (card.owner || $board.owner || $board.open_permission)}
        role="button"
        tabindex="0"
        onkeypress={null}
        onclick={obscured ? null : startEdit}
      >
        {#if obscured}
          <div data-name="obscured-placeholder" class="obscured-text"></div>
          <div class="obscured-text short"></div>
        {:else}
          <EncryptedText bind:text={card.text} />
        {/if}
      </div>
    </div>
  {/if}

  {#if deleteConfirmMode}
    <div class="card-foot confirm" data-name="delete-confirm">
      <span class="text-secondary small">{$_('card.delete_confirm')}</span>
      <span class="ms-auto d-flex gap-1">
        <Button
          data-name="cancel-button"
          class="btn-sm btn-outline-secondary"
          onclick={() => (deleteConfirmMode = false)}
        >
          {$_('card.cancel')}
        </Button>
        <Button
          data-name="confirm-button"
          color="danger"
          class="btn-sm"
          onclick={doDelete}
        >
          {$_('card.delete')}
        </Button>
      </span>
    </div>
  {:else}
    <div class="card-foot">
      <Votes
        ontoggleVote={toggleVote}
        bind:votes={card.votes}
        bind:voted={card.voted}
        disabled={$voteLimitReached && !card.voted}
        bind:color
      />
      <span class="author text-truncate">
        {#if obscured || card.author.length === 0}
          {$_('card.anonymous')}
        {:else}
          <EncryptedText bind:text={card.author} />
        {/if}
      </span>
      <span class="ms-auto d-flex align-items-center gap-1">
        <button
          type="button"
          id={`react-drawer-button-${cardSlug}`}
          data-name="react-drawer-button"
          class="reactions"
          class:empty={Object.values(card.reactions).every((v) => !v)}
          aria-label={$_('card.react')}
        >
          {#each Object.entries(card.reactions)
            .sort( ([ak, av], [bk, bv]) => (av === bv ? bk.localeCompare(ak) : bv - av) )
            .filter(([, v]) => v > 0) as [emoji, count] (emoji)}
            <span class="reaction" class:mine={card.reacted === emoji}
              >{emoji}<span class="count">{count}</span></span
            >
          {:else}
            <span class="add-reaction">🙂</span>
          {/each}
        </button>
        {#if card.owner || $board.owner || $board.open_permission}
          <button
            type="button"
            data-name="delete-button"
            class="icon-btn delete"
            aria-label={$_('card.delete')}
            onclick={() => (deleteConfirmMode = true)}
          >
            <Icons.trash size="15" />
          </button>
        {/if}
      </span>
      <Popover
        target={`react-drawer-button-${cardSlug}`}
        bind:isOpen={reactDrawOpen}
      >
        <div
          use:clickOutside
          onclickOutside={() => (reactDrawOpen = !reactDrawOpen)}
        >
          <ReactDrawer onselected={doReact} current={card.reacted} />
        </div>
      </Popover>
    </div>
  {/if}
</div>

<style>
  .rt-card {
    position: relative;
    background: var(--rt-card);
    border-radius: 10px;
    border-left: 3px solid var(--lane);
    box-shadow: var(--rt-shadow);
    padding: 0.7rem 0.8rem 0.45rem 0.85rem;
    transition:
      opacity 0.2s,
      transform 0.2s,
      box-shadow 0.2s;
  }

  .card-text {
    font-size: 1.05rem;
    line-height: 1.4;
    color: var(--rt-ink);
    overflow-wrap: anywhere;
    outline-offset: 4px;
  }

  .card-text.editable {
    cursor: text;
  }

  .card-foot {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.55rem;
    min-height: 1.9rem;
  }

  .author {
    font-size: 0.82rem;
    color: var(--rt-muted);
    font-weight: 600;
    min-width: 0;
  }

  .reactions {
    display: flex;
    gap: 0.25rem;
    border: 0;
    background: none;
    padding: 0.1rem 0.2rem;
    border-radius: 999px;
    cursor: pointer;
    color: inherit;
  }

  .reaction {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.85rem;
    padding: 0.05rem 0.45rem;
    border-radius: 999px;
    background: var(--rt-lane);
  }

  .reaction.mine {
    background: rgba(var(--rt-accent-rgb), 0.18);
    box-shadow: inset 0 0 0 1px rgba(var(--rt-accent-rgb), 0.5);
  }

  .count {
    font-weight: 700;
    font-size: 0.78rem;
  }

  .add-reaction {
    filter: grayscale(1);
    opacity: 0.45;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.8rem;
    height: 1.8rem;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--rt-muted);
  }

  .icon-btn.delete:hover {
    color: #c43d4b;
    background: rgba(196, 61, 75, 0.1);
  }

  /* Secondary controls appear on hover/focus; always on touch screens. */
  @media (hover: hover) {
    .reactions.empty,
    .icon-btn.delete {
      opacity: 0;
    }
    .rt-card:hover .reactions.empty,
    .rt-card:hover .icon-btn.delete,
    .rt-card:focus-within .reactions.empty,
    .rt-card:focus-within .icon-btn.delete {
      opacity: 1;
    }
  }

  .confirm {
    border-top: 1px solid var(--rt-line);
    padding-top: 0.45rem;
  }

  .busy {
    opacity: 0.66;
  }

  .focused {
    box-shadow:
      0 0 0 3px var(--rt-accent),
      var(--rt-lift);
    transform: translateY(-2px) scale(1.02);
    z-index: 2;
  }

  .dimmed {
    opacity: 0.45;
  }

  .pre-wrap {
    white-space: pre-wrap;
  }

  .obscured-text {
    width: 100%;
    height: 0.9em;
    margin: 0.25em 0;
    border-radius: 4px;
    background: currentColor;
    opacity: 0.12;
  }

  .obscured-text.short {
    width: 60%;
  }
</style>
