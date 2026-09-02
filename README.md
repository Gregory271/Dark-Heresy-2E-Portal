# Dark Heresy 2E Portal

A campaign companion for creating Dark Heresy Second Edition Acolytes,
consulting locally owned sourcebooks, sharing characters, and exporting actors
to Foundry VTT.

## Run locally

1. Install a current Node.js release.
2. Open a terminal in this folder.
3. Run `npm.cmd run dev` on Windows or `npm run dev` on macOS/Linux.
4. Open `http://127.0.0.1:4173`.

## Main features

- Rules-aware character creation with continuous autosave.
- Searchable sourcebook compendium assembled in the user's browser.
- Shared campaign characters through Supabase, without player accounts.
- Builder JSON and Foundry Actor JSON exports.
- Native live-play sheets for Acolytes, reinforcement NPCs, and vehicles,
  including Foundry chat rolls and ammunition tracking.
- Responsive layouts, text scaling, keyboard support, and reduced-motion modes.

Sourcebook PDFs selected in the hosted portal remain on that device and are not
uploaded to GitHub, Supabase, or another player. Cropped sourcebook artwork and
all Warhammer 40,000 properties remain the work of their credited creators and
rights holders.

To prepare the public GitHub Pages edition after making changes, run
`npm.cmd run build:hosted`.

For a complete local campaign backup suitable for moving to another computer,
see [`docs/LAPTOP-MIGRATION.md`](docs/LAPTOP-MIGRATION.md). To regenerate the
optional sourcebook portraits from PDFs you own, run
`scripts/extract-reinforcement-art.ps1`; those private crops are deliberately
excluded from Git and public releases.

## Roadmap

- Rehearse player permissions and the laptop restore process before campaign
  night.
- Add a GM investigation workspace for clues, connections, conclusions, and
  encounter objectives.
- Mobile accessibility pass: use remembered, single-level accordions for the
  largest sheet sections without introducing nested scroll traps.
