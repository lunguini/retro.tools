<script>
  import { _ } from 'svelte-i18n';

  import { board, colors } from '../store.js';
  import { Icons } from '../data.js';

  let {
    votes = 0,
    voted = false,
    color,
    disabled = false,
    ontoggleVote,
  } = $props();
</script>

{#if $board.voting_open}
  <button
    type="button"
    data-name="vote-button"
    class="vote"
    class:voted
    {disabled}
    aria-pressed={voted}
    aria-label={$_('card.vote')}
    title={disabled ? $_('error.vote_limit_reached') : $_('card.vote')}
    style="--vote: {$colors[color] ?? 'var(--rt-accent)'}"
    onclick={() => ontoggleVote?.()}
  >
    <Icons.arrowUp size="14" strokeWidth="3" />
    <span data-name="vote-count">{votes}</span>
  </button>
{:else}
  <span
    class="vote static"
    style="--vote: {$colors[color] ?? 'var(--rt-accent)'}"
  >
    <span data-name="vote-count">{votes}</span>
  </span>
{/if}

<style>
  .vote {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--rt-line);
    background: transparent;
    color: var(--rt-muted);
    border-radius: 999px;
    padding: 0.1rem 0.55rem 0.1rem 0.45rem;
    font-weight: 700;
    font-size: 0.85rem;
    line-height: 1.4;
    font-variant-numeric: tabular-nums;
  }

  button.vote:hover:not(:disabled) {
    border-color: var(--vote);
    color: var(--vote);
  }

  .vote.voted {
    background: var(--vote);
    border-color: var(--vote);
    color: #fff;
  }

  .vote:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .vote.static {
    padding: 0.1rem 0.55rem;
  }
</style>
