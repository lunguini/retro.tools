<script>
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { _, dictionary } from 'svelte-i18n';

  import {
    activeRankOptions,
    author,
    board,
    cards,
    colorMode,
    colors,
    focusedRank,
    password,
    ranks,
    sorted,
  } from '../store.js';
  import { Icons } from '../data.js';
  import { createCard, deleteRank, updateRank } from '../api.js';
  import { encrypt } from '../encryption.js';

  import Card from './Card.svelte';
  import Textarea from './Textarea.svelte';
  import Button from './Button.svelte';
  import { slide } from 'svelte/transition';
  import RankOptions from './RankOptions.svelte';
  import Input from './Input.svelte';

  let { rank = $bindable(), drake = null, onerror } = $props();

  let dropTarget = $state();
  let sortedFilteredCards = $derived(
    $cards
      .filter((c) => c.column === rank.id)
      .sort((a, b) =>
        $sorted
          ? b.votes - a.votes || a.created_at - b.created_at
          : a.created_at - b.created_at
      )
  );
  let columnWidth = $derived(
    $ranks.length <= 2
      ? 'col-lg-4'
      : $ranks.length === 3
        ? 'col-lg-3'
        : `col-lg-${Math.floor(12 / $ranks.length)}`
  );
  let newCardText = $state('');
  let canManage = $derived($board.owner || $board.open_permission);
  let displayName = $derived(
    $dictionary.en && rank.name in $dictionary.en ? $_(rank.name) : rank.name
  );
  let renaming = $state(false);
  let newName = $state('');

  function startRename() {
    if (!canManage) return;
    newName = displayName;
    renaming = true;
  }

  async function submitRename() {
    if (!renaming) return;
    renaming = false;
    const name = newName.trim();
    if (!name || name === displayName) return;
    try {
      await updateRank($board.id, { ...rank, name });
    } catch (err) {
      error('error.network', err);
    }
  }
  let deleteConfirmMode = $state(false);

  function error(message, err) {
    onerror?.({ message, err });
  }

  async function newCard() {
    if (newCardText.length === 0) {
      return;
    }
    if (!$board.cards_open) {
      if ($board.owner) {
        error('board.creation_disabled_as_owner');
      } else {
        error('board.creation_disabled_as_participant');
      }
      return;
    }

    const encryptedCardText = await encrypt(newCardText, $password);
    const encryptedAuthor =
      $author.length > 0 ? await encrypt($author, $password) : '';
    try {
      newCardText = '';
      await createCard($board.id, rank.id, encryptedCardText, encryptedAuthor);
    } catch (err) {
      error('error.creating_card', err);
    }
  }

  function toggleOptions() {
    if (!$board.owner && !$board.open_permission) {
      return;
    }
    if ($activeRankOptions != rank.id) {
      $activeRankOptions = rank.id;
    } else {
      $activeRankOptions = '';
    }
  }

  async function doDelete() {
    rank.busy = true;
    try {
      await deleteRank($board.id, rank.id);
    } catch (err) {
      error('error.network', err);
    }
  }

  onMount(() => drake?.containers.push(dropTarget));

  const SvelteComponent = $derived(Icons[rank.data.icon]);
</script>

<div
  data-name="rank"
  data-options-open={$activeRankOptions === rank.id}
  class="rank flex-grow-0 flex-shrink-0 px-2 {columnWidth}"
  class:busy={rank.busy}
  style="--lane: {$colors[rank.data.color]}"
>
  <div class="lane">
    <div
      style="position: relative; display: flex; flex-direction: column;"
      data-name="rank-header"
    >
      <div class="lane-head" class:blur={deleteConfirmMode}>
        <div class="d-flex flex-column justify-content-center flex-shrink-0">
          <div
            class="icon lane-icon"
            class:clickable={canManage}
            title={canManage ? $_('board.column_options') : undefined}
            role="button"
            data-name="rank-options-button"
            tabindex="0"
            onkeypress={null}
            onclick={toggleOptions}
          >
            <SvelteComponent />
          </div>
        </div>
        <div class="d-flex flex-grow-1 align-items-center min-w-0">
          {#if renaming}
            <Input
              data-name="rank-name-input"
              autofocus
              bind:value={newName}
              onsubmit={submitRename}
              oncancel={() => (renaming = false)}
              onblur={submitRename}
              class="py-0 fw-bold"
            />
          {:else}
            <h5
              data-name="rank-name"
              class="m-0 text-truncate rank-name"
              class:editable={canManage}
              title={canManage ? $_('board.rename_column') : displayName}
              role={canManage ? 'button' : undefined}
              tabindex={canManage ? 0 : undefined}
              onclick={startRename}
              onkeydown={(e) => e.key === 'Enter' && startRename()}
            >
              {displayName}
            </h5>
            <span class="lane-count" data-name="rank-card-count"
              >{sortedFilteredCards.length}</span
            >
          {/if}
        </div>
        {#if $board.owner || $board.open_permission}
          <button
            type="button"
            data-name="delete-button"
            class="lane-delete"
            aria-label={$_('board.delete_column')}
            title={$_('board.delete_column')}
            onclick={() => (deleteConfirmMode = true)}
          >
            <Icons.trash size="15" />
          </button>
        {/if}
      </div>
      <div class="d-flex mb-3" class:blur={deleteConfirmMode}>
        <div class="d-flex input-group flex-nowrap">
          <Textarea
            autoresize
            data-name="card-text-input"
            onsubmit={newCard}
            placeholder={$_('board.add_card')}
            bind:value={newCardText}
            onfocus={() => ($focusedRank = rank.id)}
            minWidth="5em"
            class="flex-grow-1"
          />
          <Button
            color={$colorMode}
            disabled={newCardText.length == 0}
            class="d-lg-none ms-1"
            onclick={newCard}
          >
            <div class="icon">
              <Icons.enter size="100%" />
            </div>
          </Button>
        </div>
      </div>

      {#if deleteConfirmMode}
        <div
          class="d-flex justify-content-end position-absolute w-100 h-100 p-2 text-end"
        >
          <Button
            data-name="cancel-button"
            color="secondary"
            textColor="light"
            class="btn-sm m-1"
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
            class="btn-sm m-1"
            onclick={doDelete}
          >
            <div class="icon">
              <Icons.check size="1x" />
            </div>
          </Button>
        </div>
      {/if}
    </div>
    {#if $activeRankOptions == rank.id}
      <div class="p-1" in:slide out:slide>
        <RankOptions {onerror} class="w-100" {rank} />
      </div>
    {/if}
    <div class="h-100" bind:this={dropTarget} data-rank-id={rank.id}>
      {#each sortedFilteredCards as card (card.id)}
        <div
          data-card-id={card.id}
          animate:flip={{ duration: 200 }}
          class="pb-2"
          data-drag={!(card.owner || $board.owner || $board.open_permission)
            ? 'false'
            : 'true'}
        >
          <Card {card} {onerror} color={rank.data.color} />
        </div>
      {/each}
      {#if !sortedFilteredCards || sortedFilteredCards.length === 0}
        <div class="lane-empty" data-drag="false">
          <small>{$_('board.no_cards')}</small>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .icon {
    width: 1.5em;
    box-sizing: content-box;
  }

  .blur {
    opacity: 0.3;
  }

  .busy {
    opacity: 0.66;
  }
  .rank-name.editable {
    cursor: text;
    border-bottom: 1px dashed transparent;
  }

  .rank-name.editable:hover {
    border-bottom-color: currentColor;
  }

  .min-w-0 {
    min-width: 0;
  }
  .lane {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: color-mix(in srgb, var(--lane) 5%, var(--rt-lane));
    border-top: 4px solid var(--lane);
    border-radius: 12px;
    padding: 0.75rem 0.75rem 0.5rem;
  }

  .lane-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.6rem;
    min-height: 2rem;
  }

  .lane-icon {
    color: var(--lane);
    display: flex;
    align-items: center;
  }

  .lane-icon.clickable {
    cursor: pointer;
  }

  .rank-name {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--rt-ink);
    letter-spacing: 0;
  }

  .lane-count {
    margin-left: 0.4rem;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--rt-muted);
    background: var(--rt-card);
    border-radius: 999px;
    padding: 0 0.5rem;
    font-variant-numeric: tabular-nums;
  }

  .lane-delete {
    border: 0;
    background: none;
    color: var(--rt-muted);
    border-radius: 6px;
    width: 1.8rem;
    height: 1.8rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 0.25rem;
  }

  .lane-delete:hover {
    color: #c43d4b;
    background: rgba(196, 61, 75, 0.1);
  }

  @media (hover: hover) {
    .lane-delete {
      opacity: 0;
    }
    .lane-head:hover .lane-delete,
    .lane-head:focus-within .lane-delete {
      opacity: 1;
    }
  }

  .lane-empty {
    text-align: center;
    color: var(--rt-muted);
    padding: 1.5rem 0;
  }
</style>
