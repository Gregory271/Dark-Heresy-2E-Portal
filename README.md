# Acolyte Induction

A local cinematic character-creation prototype for Dark Heresy Second Edition.
It is data-driven for characters built from the Core Rulebook, Enemies Beyond,
Enemies Within, and Enemies Without. The initial sniper selection is a test
preset, not a limitation of the builder.

## Run

1. Install a current Node.js release.
2. Open a terminal in this folder.
3. On Windows, run `npm.cmd run dev` (this avoids PowerShell's `npm.ps1`
   execution-policy restriction). On macOS or Linux, run `npm run dev`.
4. Open `http://127.0.0.1:4173`.

No package installation or internet connection is required for the packaged
prototype. The 3D dice engine and its visual assets are included locally.
Close the terminal to stop the app.

## Rules Compendium

The local Rules Compendium indexes all 885 pages from the four supplied books:

- Dark Heresy Second Edition Core Rulebook
- Enemies Within
- Enemies Without
- Enemies Beyond

The Compendium reads like a digital edition of the books: choose a chapter
from one grouped menu, move through chapters with Previous and Next, or search
headings and rules concepts across the complete library. Chapters are presented
as continuous articles instead of a grid of individual PDF-page buttons.
Book citations are explicitly labelled `Printed page`; internal PDF storage
numbers remain hidden. Opening fiction, covers, contents, and indexes are
excluded from rules navigation and search. The concise setting introduction
and rules-relevant lore remain.
Printed-page references remain beside section headings for citation. Common
mechanical terms in the builder are highlighted; selecting one opens a concise
rules summary and can jump directly to its source in the Compendium.

Extracted PDF lines are reflowed into readable prose paragraphs. Mechanical
language is highlighted in Rogue Trader-style contextual categories for
actions, factions, conditions, skills, psychic concepts, weapon qualities,
threats, and core rules. Hovering a term—or focusing it with the keyboard—shows
a concise definition and book/page reference. Icons and category labels ensure
the system does not rely on colour alone.

Malformed duplicate-glyph layers found in several illustrated examples and
tables are detected and repaired during extraction. The reader additionally
filters repeated-string artifacts, restores likely collapsed double letters
from the clean-book vocabulary, reconstructs split small-cap headings, removes
duplicate paragraphs, and uses one
natural document scrollbar on mobile. Desktop uses two restrained scroll
areas: the chapter/contents rail and the primary book reader. Navigation links
scroll only the reader, preserving the surrounding interface and both chapter
navigation bars.

Opening a search result preserves the query, complete result list, and sidebar
position. The active result is visibly marked, allowing users to read it and
continue through later matches without repeating the search.

Search uses a prebuilt lowercase index and updates only the result rail after a
short input debounce. Rendered chapter articles are cached, so searching no
longer rebuilds the chapter, terminology tooltips, or full accessibility tree.
Important terms retain their category colour even when they do not have a
navigable destination.

Run `python scripts/audit_compendium.py` after rebuilding the library. It checks
all 885 local pages for repeated glyph runs, mojibake, long garbage tokens,
adjacent duplicate lines, and stray running footers.

Printed references such as `page 217`, `p. 217`, and `pages 217-220` are
resolved against the current sourcebook and become internal links. Activating
one opens the destination chapter, scrolls to the cited printed page, and moves
keyboard focus to its section heading.

The local compendium is assembled from sourcebooks selected by the user. Its
extracted text and cropped illustrations must not be published or redistributed.

## Hosted player edition

The GitHub Pages workflow publishes the generated `hosted/` edition. It keeps
character creation, Foundry export, shared Supabase campaigns, accessibility
features, and the complete compendium interface. Full sourcebook files, their
extracted text, sourcebook illustrations, and locally supplied music are not
committed to the public repository.

On the hosted site, **Connect Sourcebooks** lets each player select the Core
Rulebook and all three Enemies PDFs from their own computer. PDF.js creates the
same searchable chapter-and-page data structure in the browser and saves it in
IndexedDB. The PDFs and extracted index never enter Supabase, GitHub, campaign
records, or another player's browser. A previously generated local index can
also be selected for recovery on the same user's devices.

Run `npm run build:hosted` after changing the local application. The generated
edition contains redacted equipment and talent records with source references
instead of copied descriptions; the connected sourcebook library supplies the
full rules-reading experience.

The checked-in browser build needs no `node_modules` directory. Developers can
regenerate `public/data/dh2-compendium.json` with
`scripts/build_compendium.py` when the four local PDFs and the Python PDF
libraries are available.

## Performance

The app starts in `VFX LOW`, which retains restrained fog and smoke but avoids
the most expensive full-screen blur and blend effects. Use the VFX button in
the top bar to enable the fuller effect set. Decorative animation pauses when
the browser tab is hidden and while the 3D dice overlay is active.

## Private artwork

The included sourcebook illustrations are tightly cropped for this private
local game aid. They are not full-page scans and must not be redistributed.
Book and page provenance is recorded in `PROJECT-NOTES.md`.

## Current exports

- The app now opens on an Acolyte Archive inspired by character rosters in
  modern tabletop tools. Every character and its current creation step is
  stored as an individual JSON record under `local-data/characters/` when the
  included app server is running. Browser storage remains a recovery copy, and
  existing browser-only characters migrate into the repository automatically.
- Archive entries can be opened, duplicated, exported, or deleted after a
  confirmation. Builder JSON supplied by another player can be imported as a
  shared character, allowing a private group to exchange characters without
  accounts or a hosted database.
- Character creation autosaves continuously to both the app repository and its
  browser backup. The final review also offers
  **Save to Archive**, and an Archive button remains available throughout the
  builder.

- Builder JSON is the editable canonical character record.
- Foundry Actor JSON targets the locally installed mrkeathley Dark Heresy 2E
  system schema. It records biography package names, characteristic bases and
  advances, Divination modifiers, Fate, Wounds, skill ranks and specialist
  skills, experience, embedded aptitudes, talents, traits, and equipment.
  Skill exports include complete system-native records so the sheet's Advance
  dropdown displays Known, Trained, Experienced, or Veteran rather than
  falling back to Unknown.
- Calculated characteristic totals include the generated result, purchased
  advances, and Divination modifier. Direct Divination changes apply
  automatically; alternative characteristics require an explicit choice.
- The Armoury contains 331 structured entries imported from the user's local
  Dark Heresy Foundry compendia: weapons, armour, ammunition, tools,
  consumables, cybernetics, and weapon modifications. It supports text search,
  category filters, starting-acquisition checks, inventory, loadout slots, item
  profiles, and embedded Foundry Draft items.
- Granted “or” choices are resolved through selection controls and stored as
  structured data; players no longer type them into a notes field.
- Legacy free-text acquisitions are migrated to matching Armoury records when
  possible. Unmatched text is displayed for review but is not counted as a
  valid acquisition. Selected acquisitions can be removed and replaced.
- Background and Divination skill grants now create Initial Known ranks at
  zero XP. The advancement shop displays their source, calculated test target,
  and the cost of the next rank, and exports Initial status separately from
  purchased ranks. Required grant choices must be resolved before advancement.
- XP purchases share one Advancement terminal with jump controls for
  Characteristics, Skills, Talents, and other advances. The Talent section
  contains 122 searchable entries from the local compendium, tier filters,
  aptitude-derived costs, prerequisites, benefits, source references, free
  starting talents, and removable purchases. Purchased talents are embedded in
  both JSON exports.
- Talent search covers names, benefits, prerequisites, aptitudes, and source
  references. Search and tier filters persist while inspecting or purchasing,
  and talent selection preserves the Advancement terminal's anchored scroll
  position without moving the full-screen scene.
- The final Review is a scrollable character dossier covering identity and
  origin, characteristic calculations, derived values, aptitudes, skills,
  talents, traits, special abilities, automatic or optional Elite Advances,
  equipment, loadout, acquisitions, Divination, and an itemised XP ledger.
- Elite Advances are explicitly labelled optional. Automatically granted paths
  such as the Mystic Role's Psyker advance and resulting Psyker/Sanctioned
  traits are recorded without requiring manual entry. Numeric sourcebook stage
  labels were removed in favour of plain workflow names.
- The mechanical confirmation sound now plays on every Continue action and on
  aptitude, grant, equipment, acquisition, loadout, advancement, talent-filter,
  and talent-selection controls. Its audio context resumes automatically after
  browser suspension.
- Review uses a dedicated full-viewport dashboard mode: its redundant outer
  heading is removed, the sheet occupies the full central area, validation and
  export remain in a narrow command rail, and dossier panels flow through three
  balanced desktop columns to minimise internal scrolling.
- A persistent accessibility slider scales interface text from 80% to 160%
  across every creation and review screen without browser zoom. Its setting is
  saved locally, adapts when the viewport changes, and uses compact controls on
  tablet and mobile layouts.
- Phones use a purpose-built single-column workflow. Home World, Background,
  and Role use native dropdowns; management workspaces, equipment, advances,
  talents, and the final dossier flatten into a touch-friendly document flow.
- Accessibility support includes keyboard focus restoration, a skip link,
  visible high-contrast focus indicators, 44-pixel touch targets, semantic
  labels and live status text, non-colour selection indicators, safe-area
  spacing, reduced-motion and reduced-transparency preferences, Windows forced
  colours, and operating-system high-contrast preferences.
- Starting Abilities now uses the full management viewport. Wide screens show
  a four-column grant ledger with consolidated skill and talent areas and a
  full-width choice resolver; tablet and mobile layouts collapse progressively
  to two and one columns.
- The Core Rulebook's complete Clothing and Personal Gear table is now in the
  Armoury, including Photo-Visors/Contacts and sixteen other previously omitted
  records. Armoury search ignores punctuation and hyphen differences and also
  searches category names and rules descriptions.
