<script>
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { _ } from 'svelte-i18n';
  import { go as navigate } from './utils.js';

  import { getBoards } from './api.js';
  import { Icons } from './data.js';
  import { colorMode, darkMode } from './store.js';

  import BoardTable from './components/BoardTable.svelte';
  import LocaleSelect from './components/LocaleSelect.svelte';
  import Alert from './components/Alert.svelte';
  import CreateForm from './components/CreateForm.svelte';
  import Button from './components/Button.svelte';

  let {
    errorAlertVisible = $bindable(false),
    errorAlertMessage = $bindable('error.network'),
  } = $props();

  let boards = $state([]);
  let errorClearTimeout;

  async function doGetBoards() {
    // If the getBoards request fails, just silently omit the board list
    try {
      boards = await getBoards();
    } catch {
      boards = [];
    }
  }

  function error(message, err) {
    if (err) console.error(err);
    errorAlertVisible = true;
    errorAlertMessage = message;

    if (errorClearTimeout) clearTimeout(errorClearTimeout);
    errorClearTimeout = setTimeout(() => (errorAlertVisible = false), 3000);
  }

  function handleError({ message, err }) {
    error(message, err);
  }

  onMount(doGetBoards);
</script>

<svelte:head>
  <meta property="og:url" content="https://retro.lunguini.com" />
</svelte:head>

<div class="d-flex flex-column scroll h-100">
  <div class="topbar">
    <div class="d-flex justify-content-between align-items-center flex-wrap">
      <span class="wordmark">retro.tools</span>
      <div class="text-end flex-grow-1 text-nowrap d-flex justify-content-end">
        <Button
          id="darkLightToggle"
          color={$colorMode}
          textColor="body"
          class="me-1"
          onclick={() => {
            $darkMode = !$darkMode;
            window.localStorage.setItem('darkModePreference', $colorMode);
          }}
        >
          <div class="icon low-brightness">
            {#if $darkMode}
              <Icons.sunrise class="align-top" size="100%" />
            {:else}
              <Icons.sunset class="align-top" size="100%" />
            {/if}
          </div>
        </Button>
        <Button
          color={$colorMode}
          textColor="body"
          href="https://github.com/lunguini/retro.tools"
          rel="noreferrer"
          target="_blank"
          class="me-1"
        >
          <div class="icon low-brightness">
            <Icons.github class="align-top" size="100%" />
          </div>
          GitHub
        </Button>
        <Button
          color={$colorMode}
          textColor="body"
          class="me-1"
          href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&amp;hosted_button_id=FJMVB9QFZQ79J&amp;source=url"
          rel="noreferrer"
          target="_blank"
        >
          <div class="icon text-danger">
            <Icons.heart class="align-top" size="100%" />
          </div>
          {$_('general.donate')}
        </Button>
        <LocaleSelect />
      </div>
    </div>
  </div>
  <main class="home">
    <section class="hero">
      <h1 data-name="splash-hero" class="hero-title">
        {$_('splash.hero_text')}
      </h1>
      <p data-name="splash-privacy" class="hero-lede">
        {$_('splash.privacy_note')}
      </p>
      <div class="hero-form">
        <CreateForm
          onerror={handleError}
          oncreated={(boardId) => navigate(`/${boardId}`)}
        />
      </div>
      <BoardTable
        {boards}
        onclick={(boardId) => navigate(`/${boardId}`)}
        onerror={handleError}
        ondeleted={doGetBoards}
      />
    </section>

    <section class="points" aria-label={$_('splash.why')}>
      <div class="point">
        <span class="point-icon"><Icons.anonymous size="22" /></span>
        <h2>{$_('splash.features.anonymous.title')}</h2>
        <p>{$_('splash.features.anonymous.body_1')}</p>
      </div>
      <div class="point">
        <span class="point-icon"><Icons.login size="22" /></span>
        <h2>{$_('splash.features.no_logins.title')}</h2>
        <p>{$_('splash.features.no_logins.body')}</p>
      </div>
      <div class="point">
        <span class="point-icon"><Icons.lock size="22" /></span>
        <h2>{$_('splash.features.encryption.title')}</h2>
        <p>
          {$_('splash.features.encryption.body_1')}
        </p>
      </div>
    </section>

    <footer class="home-foot">
      {$_('splash.features.open_source.body')}
      <a
        rel="noreferrer"
        target="_blank"
        href="https://github.com/lunguini/retro.tools"
        >{$_('splash.features.open_source.github_link')}</a
      >
    </footer>
  </main>
</div>

{#if errorAlertVisible}
  <div
    class="fixed-bottom"
    in:fly={{ y: 100, duration: 200 }}
    out:fly={{ y: 100, duration: 200 }}
  >
    <Alert
      data-name="error-alert"
      class="fixed-bottom mb-0 py-1"
      color="danger"
      isOpen={true}
    >
      {$_(errorAlertMessage)}
    </Alert>
  </div>
{/if}

<style>
  .scroll {
    overflow: auto;
  }

  .icon {
    display: inline-block;
    width: 1.5em;
    height: 1.5em;
  }

  .low-brightness {
    filter: brightness(0.6);
  }

  .topbar {
    padding: 0.6rem 1rem;
  }

  .wordmark {
    font-weight: 800;
    font-size: 1.05rem;
    color: var(--rt-ink);
  }

  .home {
    width: 100%;
    max-width: 44rem;
    margin: 0 auto;
    padding: 0 1rem 3rem;
  }

  .hero {
    padding-top: clamp(2rem, 9vh, 6rem);
  }

  .hero-title {
    font-size: clamp(2rem, 5vw, 3.1rem);
    font-weight: 800;
    line-height: 1.08;
    letter-spacing: -0.025em;
    max-width: 16ch;
    margin-bottom: 1rem;
  }

  .hero-lede {
    font-size: 1.1rem;
    line-height: 1.5;
    color: var(--rt-muted);
    max-width: 36rem;
    margin-bottom: 2rem;
  }

  .hero-form {
    margin-bottom: 1.5rem;
  }

  .points {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 1.75rem;
    margin-top: 3.5rem;
    padding-top: 2rem;
    border-top: 1px solid var(--rt-line);
  }

  .point h2 {
    font-size: 1rem;
    font-weight: 800;
    margin: 0.5rem 0 0.35rem;
  }

  .point p {
    font-size: 0.92rem;
    line-height: 1.5;
    color: var(--rt-muted);
    margin: 0;
  }

  .point-icon {
    color: var(--rt-accent);
  }

  .home-foot {
    margin-top: 2.5rem;
    font-size: 0.85rem;
    color: var(--rt-muted);
  }
</style>
