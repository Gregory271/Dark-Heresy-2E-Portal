# Dark Heresy 2E Portal Bridge

This Foundry integration opens the complete Portal inside Foundry and registers
it as the default Acolyte sheet for the installed `dark-heresy-2nd` system.
Existing Acolyte Actors load into the same review, actions, skills, inventory,
features, background, and advancement interface. Changes made there are saved
back to the Actor, including Portal-managed Items.

## Install for local testing

1. From the project folder, run `npm.cmd run build:foundry` (or run
   `node scripts/build-foundry-module.mjs` after `hosted` is already built).
2. Copy `dist/dh2-portal` into Foundry's `Data/modules` folder.
3. Restart Foundry and enable **Dark Heresy 2E Portal Bridge** in the world.
4. Open the Actors directory and select **Open DH2 Portal**.
5. Use **Open DH2 Portal** to create an Acolyte, then choose **Create Foundry
   Actor** on final review. The new Actor opens with the Portal sheet.
6. Open any existing Acolyte Actor. Its sheet should now be the Portal sheet;
   if another sheet is selected, use the sheet icon/menu and choose **Dark
   Heresy Portal Sheet**, then set it as default if Foundry offers that option.

The GM can also select **Import JSON** to import an existing
`.foundry-actor.json` export. If a player creates an Actor while a GM is
connected, the module asks the GM client to create it and grants that player
Owner permission.

The built package contains a local copy of the Portal. If the module is copied
without running the build command, it falls back to the current GitHub Pages
edition so the window still opens; use the built package for the complete
offline-capable Foundry workflow.

Only Gamemasters see the direct JSON import control. A native Portal Actor sheet
and two-way Actor synchronization are included in this version. Foundry still
stores the underlying `acolyte` Actor and its Items, so the system remains
compatible with the Dark Heresy 2E rules system and other tools.
