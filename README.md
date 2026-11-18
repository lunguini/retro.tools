> **Fork note (`p2p` branch):** this fork runs with **no backend**. Boards are
> [Yjs](https://yjs.dev) documents stored in each participant's browser
> (IndexedDB) and synced peer-to-peer over WebRTC via
> [Trystero](https://github.com/dmotz/trystero) (public Nostr relays are used
> only for discovery). It deploys as a static site to GitHub Pages
> (`.github/workflows/pages.yml`).
>
> Trade-offs: a board is only reachable while at least one participant who has
> it is online; permissions and vote limits are enforced client-side; "delete"
> forgets your local copy only.
>
> Also adds card focus (#218) and a per-person vote limit (#219).

<h1 style="color:#007bff;font-weight:700;text-transform:uppercase;">RETRO.TOOLS</h1>

![Screenshot](./resources/screenshot-dark.png#gh-dark-mode-only)
![Screenshot](./resources/screenshot-light.png#gh-light-mode-only)

# Brief

A free and open source online retrospective meeting tool.

Hosted at [retro.tools](https://retro.tools), free for anyone to use.

The backend projects live at:
- [d0x2f/retro.tools-backend](https://github.com/d0x2f/retro.tools-backend)
- [d0x2f/retro.tools-cloud-functions](https://github.com/d0x2f/retro.tools-cloud-functions)

# Features

* Simple, clean & intuitive interface
* Mobile first design
* No sign-ups, logins or tracking
* Optional encryption using a password
* Easy to share a board to your co-workers quickly with a link or an on-screen QR code
* Open source
* Multiple pre-built templates
* Brazilian Portugese, English, German, Korean, Russian, Spanish, Turkish and Ukrainian translations (contributions very welcome!)

# Contributing

See the contribution guide at [CONTRIBUTING.md](./CONTRIBUTING.md).
