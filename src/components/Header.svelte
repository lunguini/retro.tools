<script>
  import LocaleSelect from './LocaleSelect.svelte';
  import EncryptedText from './EncryptedText.svelte';
  import Menu from './Menu.svelte';

  import { _ } from 'svelte-i18n';
  import {
    board,
    colorMode,
    password,
    darkMode,
    peers,
    author,
    votesUsed,
  } from '../store.js';
  import { decrypt, encrypt, checkBoardPassword } from '../encryption.js';
  import Button from './Button.svelte';
  import { Icons } from '../data';
  import Input from './Input.svelte';

  let onlineNames = $derived([
    `${$author || $_('card.anonymous')} (${$_('board.you')})`,
    ...Object.values($peers.people).map((n) => n || $_('card.anonymous')),
  ]);

  let editMode = $state(false);
  let newBoardName = $state('');

  async function startEdit() {
    if (
      ($board.owner || $board.open_permission) &&
      (await checkBoardPassword($board, $password))
    ) {
      let decrypted;
      try {
        decrypted = await decrypt($board.name, $password);
      } catch {
        return;
      }
      editMode = true;
      newBoardName = decrypted;
    }
  }

  function cancelEdit() {
    editMode = false;
  }

  async function submitEdit() {
    $board.name = await encrypt(newBoardName, $password);
    editMode = false;
  }
</script>

<div class="on-top">
  <div class="d-flex justify-content-between flex-wrap">
    <div class="d-flex flex-column justify-content-center">
      <a
        data-name="home-link"
        href={import.meta.env.BASE_URL}
        class="text-uppercase fw-bold ps-2 m-0 home-link h3 text-decoration-none"
        class:text-primary={!$darkMode}
        class:text-secondary={$darkMode}
      >
        retro.tools
      </a>
    </div>
    <div class="flex-grow-1"></div>
    <div
      data-name="board-title"
      class="text-center d-none m-0 d-lg-block h3 w-50 text-body"
      role="button"
      tabindex="0"
      onkeypress={null}
      onclick={startEdit}
    >
      {#if editMode}
        <Input
          data-name="board-title-edit-field"
          autofocus
          bind:value={newBoardName}
          onsubmit={submitEdit}
          oncancel={cancelEdit}
          onblur={submitEdit}
          class="p-0 text-center big-text border-0"
        />
      {:else}
        <EncryptedText bind:text={$board.name} />
      {/if}
    </div>
    <div class="d-flex flex-grow-1 mb-1 me-1 justify-content-end">
      <Button
        id="darkLightToggle"
        color={$colorMode}
        class="me-1"
        onclick={() => {
          $darkMode = !$darkMode;
          window.localStorage.setItem('darkModePreference', $colorMode);
        }}
      >
        <div class="icon">
          {#if $darkMode}
            <Icons.sunrise class="align-top" size="100%" />
          {:else}
            <Icons.sunset class="align-top" size="100%" />
          {/if}
        </div>
      </Button>
      <label
        class="d-flex align-items-center me-2 mb-0 author-field"
        title={$_('board.your_name_hint')}
      >
        <span class="me-1 small text-secondary text-nowrap"
          >{$_('board.your_name')}</span
        >
        <input
          data-name="card-author-input"
          class="form-control form-control-sm"
          placeholder={$_('card.anonymous')}
          bind:value={$author}
          maxlength="40"
        />
      </label>
      {#if $board.max_votes > 0}
        <span
          data-name="votes-remaining"
          class="badge align-self-center me-2"
          class:text-bg-primary={$votesUsed < $board.max_votes}
          class:text-bg-secondary={$votesUsed >= $board.max_votes}
          title={$_('board.votes_remaining_hint')}
        >
          {$_('board.votes_remaining', {
            values: {
              remaining: Math.max(0, $board.max_votes - $votesUsed),
              max: $board.max_votes,
            },
          })}
        </span>
      {/if}
      <span
        data-name="peer-count"
        class="badge align-self-center me-2 text-bg-{$peers.peers > 0
          ? 'success'
          : $peers.failures > 0
            ? 'warning'
            : 'secondary'}"
        title={$peers.failures > 0 && $peers.peers === 0
          ? $_('board.waiting.blocked')
          : onlineNames.join('\n') || $_('board.peers_hint')}
      >
        {#if $peers.peers === 0}
          {$_('board.peers', { values: { count: 0 } })}
        {:else}
          {$_('board.online', { values: { count: $peers.peers + 1 } })}
          <span class="d-none d-xl-inline fw-normal"
            >· {onlineNames.slice(0, 3).join(', ')}{onlineNames.length > 3
              ? ` +${onlineNames.length - 3}`
              : ''}</span
          >
        {/if}
      </span>
      <LocaleSelect class="me-1 h-100" />
      <Menu />
    </div>
  </div>
  <hr class="my-0 d-lg-none" />
  <div
    data-name="board-title"
    class="text-secondary d-lg-none h3 pt-1 text-center text-body"
    role="button"
    tabindex="0"
    onkeypress={null}
    onclick={startEdit}
  >
    {#if editMode}
      <Input
        data-name="board-title-edit-field"
        autofocus
        bind:value={newBoardName}
        onsubmit={submitEdit}
        oncancel={cancelEdit}
        onblur={submitEdit}
        class="p-0 text-center border-0"
      />
    {:else}
      <EncryptedText bind:text={$board.name} />
    {/if}
  </div>
  <hr class="my-0 mx-2" />
</div>

<style>
  .icon {
    width: 1.5em;
    height: 1.5em;
    filter: brightness(0.6);
  }

  .on-top {
    z-index: 1040;
  }

  .home-link {
    cursor: pointer;
  }
  .author-field input {
    width: 9rem;
  }
</style>
