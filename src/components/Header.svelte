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
  import { Icons } from '../data';
  import Input from './Input.svelte';

  let onlineNames = $derived([
    `${$author || $_('card.anonymous')} (${$_('board.you')})`,
    ...Object.values($peers.people).map((n) => n || $_('card.anonymous')),
  ]);

  function initials(name) {
    const parts = name
      .replace(/\(.*\)/, '')
      .trim()
      .split(/\s+/);
    return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  function hue(name) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  }

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

<header class="on-top rt-header">
  <div class="brand-row">
    <a
      data-name="home-link"
      href={import.meta.env.BASE_URL}
      class="wordmark text-decoration-none"
    >
      retro.tools
    </a>
    <span class="sep" aria-hidden="true">/</span>
    <div
      data-name="board-title"
      class="board-title text-truncate"
      class:editable={$board.owner || $board.open_permission}
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
          class="py-0 border-0 title-input"
        />
      {:else}
        <EncryptedText bind:text={$board.name} />
      {/if}
    </div>
  </div>

  <div class="tools">
    <div
      data-name="peer-count"
      class="people"
      class:warn={$peers.failures > 0 && $peers.peers === 0}
      title={$peers.failures > 0 && $peers.peers === 0
        ? $_('board.waiting.blocked')
        : onlineNames.join('\n')}
    >
      <span class="avatars" aria-hidden="true">
        {#each onlineNames.slice(0, 4) as name, i (i)}
          <span class="avatar" style="--h: {hue(name)}">{initials(name)}</span>
        {/each}
      </span>
      <span class="people-label">
        {$peers.peers === 0
          ? $_('board.peers', { values: { count: 0 } })
          : $_('board.online', { values: { count: $peers.peers + 1 } })}
      </span>
    </div>

    {#if $board.max_votes > 0}
      <span
        data-name="votes-remaining"
        class="votes-left"
        class:out={$votesUsed >= $board.max_votes}
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

    <label class="name-field" title={$_('board.your_name_hint')}>
      <span class="name-label">{$_('board.your_name')}</span>
      <input
        data-name="card-author-input"
        class="form-control form-control-sm"
        placeholder={$_('card.anonymous')}
        bind:value={$author}
        maxlength="40"
      />
    </label>

    <button
      type="button"
      id="darkLightToggle"
      class="tool-btn"
      aria-label={$_('general.toggle_theme')}
      title={$_('general.toggle_theme')}
      onclick={() => {
        $darkMode = !$darkMode;
        window.localStorage.setItem('darkModePreference', $colorMode);
      }}
    >
      {#if $darkMode}
        <Icons.sunrise size="18" />
      {:else}
        <Icons.sunset size="18" />
      {/if}
    </button>
    <LocaleSelect class="h-100" />
    <Menu />
  </div>
</header>

<style>
  .on-top {
    z-index: 1040;
  }

  .rt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    flex-wrap: wrap;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--rt-line);
    background: var(--rt-wall);
  }

  .brand-row {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    min-width: 0;
    flex: 1 1 18rem;
  }

  .wordmark {
    font-weight: 800;
    font-size: 1rem;
    color: var(--rt-muted);
    white-space: nowrap;
  }

  .wordmark:hover {
    color: var(--rt-accent);
  }

  .sep {
    color: var(--rt-line);
    font-size: 1.3rem;
  }

  .board-title {
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--rt-ink);
    min-width: 0;
  }

  .board-title.editable {
    cursor: text;
  }

  .board-title :global(.title-input) {
    font-size: 1.35rem;
    font-weight: 800;
  }

  .tools {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .people {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--rt-muted);
  }

  .people.warn {
    color: #b7791f;
  }

  .avatars {
    display: flex;
  }

  .avatar {
    width: 1.7rem;
    height: 1.7rem;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.68rem;
    font-weight: 800;
    color: #fff;
    background: hsl(var(--h) 45% 48%);
    border: 2px solid var(--rt-wall);
    margin-left: -0.45rem;
  }

  .avatar:first-child {
    margin-left: 0;
  }

  .votes-left {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--rt-accent);
    background: rgba(var(--rt-accent-rgb), 0.12);
    border-radius: 999px;
    padding: 0.2rem 0.65rem;
    white-space: nowrap;
  }

  .votes-left.out {
    color: var(--rt-muted);
    background: var(--rt-lane);
  }

  .name-field {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
  }

  .name-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--rt-muted);
    white-space: nowrap;
  }

  .name-field input {
    width: 9rem;
  }

  .tool-btn {
    border: 0;
    background: none;
    color: var(--rt-muted);
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .tool-btn:hover {
    background: var(--rt-lane);
    color: var(--rt-ink);
  }

  @media (max-width: 575px) {
    .rt-header {
      padding: 0.5rem 0.75rem;
    }
    .people-label,
    .name-label {
      display: none;
    }
    .name-field input {
      width: 7.5rem;
    }
  }
</style>
