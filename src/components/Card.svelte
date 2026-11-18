<script>
  import { slide } from 'svelte/transition';
  import { Popover } from '@sveltestrap/sveltestrap';
  import { _ } from 'svelte-i18n';

  import {
    board,
    cards,
    colorMode,
    darkMode,
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
  class="card bg-{$colorMode}"
  onclick={onCardClick}
>
  <div class="d-flex" class:blur={deleteConfirmMode}>
    <div class="p-1 pt-votes flex-grow-0 bg-{$colorMode}-accent rounded-start">
      <Votes
        ontoggleVote={toggleVote}
        bind:votes={card.votes}
        bind:voted={card.voted}
        disabled={$voteLimitReached && !card.voted}
        bind:color
      />
    </div>
    <div class="p-1 pt-0 w-100 flex-grow-1">
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
          <div class="m-0 w-100">
            <div class="d-flex flex-wrap">
              <div class="flex-grow-1">
                {#if obscured}
                  <div class="text-secondary fw-bold">
                    {$_('card.anonymous')}
                  </div>
                {:else if card.author.length > 0}
                  <div class:text-primary={!$darkMode} class="fw-bold pb-1">
                    <EncryptedText bind:text={card.author} />
                  </div>
                {:else}
                  <div class="text-secondary fw-bold">
                    {$_('card.anonymous')}
                  </div>
                {/if}
              </div>
              <div
                id={`react-drawer-button-${cardSlug}`}
                data-name="react-drawer-button"
                class="d-flex flex-wrap justify-content-end pointer"
              >
                {#if Object.entries(card.reactions).filter(([, v]) => v > 0).length > 0}
                  {#each Object.entries(card.reactions)
                    .sort( ([ak, av], [bk, bv]) => (av === bv ? bk.localeCompare(ak) : bv - av) )
                    .filter(([, v]) => v > 0) as [emoji, count] (emoji)}
                    <span
                      class="badge m-1"
                      class:text-body={$darkMode}
                      class:text-bg-light={!$darkMode && card.reacted !== emoji}
                      class:text-bg-primary={!$darkMode &&
                        card.reacted === emoji}
                      class:bg-dark-accent={$darkMode && card.reacted === emoji}
                      class:text-bg-dark={$darkMode && card.reacted !== emoji}
                      in:slide>{emoji}&nbsp;&nbsp;{count}</span
                    >
                  {/each}
                {:else}
                  <div class="badge m-1">
                    <span class="grayscale-{$colorMode}">🙂</span>
                  </div>
                {/if}
              </div>
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
            <div class="border-top border-secondary author-border"></div>
          </div>
          <div
            data-name="card-content"
            class="p-1 w-100 pre-wrap"
            role="button"
            tabindex="0"
            onkeypress={null}
            onclick={obscured ? null : startEdit}
          >
            {#if obscured}
              <div data-name="obscured-placeholder" class="obscured-text"></div>
            {:else}
              <EncryptedText bind:text={card.text} />
            {/if}
          </div>
        </div>
      {/if}
    </div>
    <div class="p-1 pt-3 bg-{$colorMode}-accent rounded-end">
      {#if card.owner || $board.owner || $board.open_permission}
        <Button
          data-name="delete-button"
          textColor={!$darkMode ? 'danger' : 'body'}
          class="bg-{$colorMode}-accent"
          onclick={() => (deleteConfirmMode = true)}
        >
          <div class="icon">
            <Icons.trash class="align-top" size="1.4x" />
          </div>
        </Button>
      {/if}
    </div>
  </div>

  {#if deleteConfirmMode}
    <div class="position-absolute w-100 h-100 p-3 text-end">
      <Button
        data-name="cancel-button"
        color="secondary"
        textColor="light"
        class="btn-sm"
        onclick={() => (deleteConfirmMode = false)}
      >
        <div class="icon">
          <Icons.close size="1x" />
        </div>
      </Button>

      <Button
        data-name="confirm-button"
        color="danger"
        textColor="light"
        class="btn-sm"
        onclick={doDelete}
      >
        <div class="icon">
          <Icons.check size="1x" />
        </div>
      </Button>
    </div>
  {/if}
</div>

<style>
  .pt-votes {
    padding-top: 0.85rem !important;
  }

  .busy {
    opacity: 0.66;
  }

  .card {
    transition:
      opacity 0.2s,
      transform 0.2s,
      box-shadow 0.2s;
  }

  .focused {
    outline: 3px solid var(--bs-primary);
    outline-offset: 2px;
    box-shadow: 0 0.5rem 1.5rem rgba(var(--bs-primary-rgb), 0.35);
    transform: scale(1.03);
    z-index: 2;
  }

  .dimmed {
    opacity: 0.5;
  }

  .blur {
    opacity: 0.3;
  }

  .pre-wrap {
    white-space: pre-wrap;
  }

  .icon {
    width: 1.5em;
    height: 1.5em;
  }

  .author-border {
    opacity: 0.2;
  }

  .grayscale-dark {
    filter: grayscale(100%) brightness(0.5);
  }

  .grayscale-light {
    filter: grayscale(100%);
  }

  .pointer {
    cursor: pointer;
  }

  .obscured-text {
    width: 100%;
    height: 1.5em;
    border-radius: 3px;
    background: currentColor;
    opacity: 0.15;
  }
</style>
