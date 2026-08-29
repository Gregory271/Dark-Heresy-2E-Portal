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
- Responsive layouts, text scaling, keyboard support, and reduced-motion modes.

Sourcebook PDFs selected in the hosted portal remain on that device and are not
uploaded to GitHub, Supabase, or another player. Cropped sourcebook artwork and
all Warhammer 40,000 properties remain the work of their credited creators and
rights holders.

To prepare the public GitHub Pages edition after making changes, run
`npm.cmd run build:hosted`.

## Roadmap

- Mobile accessibility audit: use remembered, single-level accordions for the
  largest sheet sections without introducing nested scroll traps.
- Foundry bridge first milestone: open the portal in Foundry and create native
  Acolyte Actors; a native sheet and two-way Actor sync remain next.
