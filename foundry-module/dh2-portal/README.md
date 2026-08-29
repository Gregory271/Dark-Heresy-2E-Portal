# Dark Heresy 2E Portal Bridge

This first Foundry milestone opens the complete Portal inside a Foundry window
and creates native Acolyte Actors for the installed `dark-heresy-2nd` system.

## Install for local testing

1. From the project folder, run `npm.cmd run build:foundry` (or run
   `node scripts/build-foundry-module.mjs` after `hosted` is already built).
2. Copy `dist/dh2-portal` into Foundry's `Data/modules` folder.
3. Restart Foundry and enable **Dark Heresy 2E Portal Bridge** in the world.
4. Open the Actors directory and select **Open DH2 Portal**.
5. Create or open an Acolyte and use **Create Foundry Actor** on final review.

The GM can also select **Import JSON** to import an existing
`.foundry-actor.json` export. If a player creates an Actor while a GM is
connected, the module asks the GM client to create it and grants that player
Owner permission.

The built package contains a local copy of the Portal. If the module is copied
without running the build command, it falls back to the current GitHub Pages
edition so the window still opens; use the built package for a mostly offline
Foundry workflow.

Only Gamemasters see the direct JSON import control. A native Portal Actor sheet
and two-way Actor synchronization are later milestones built on this bridge.
