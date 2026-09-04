# Dark Heresy 2E Portal Bridge

This Foundry integration opens the complete Portal inside Foundry and registers
it as the default Acolyte sheet for the installed `dark-heresy-2nd` system.
Existing Acolyte Actors load into the same review, actions, skills, inventory,
features, background, and advancement interface. Changes made there are saved
back to the Actor, including Portal-managed Items.

On a live Acolyte sheet, click any Characteristic at the top of the sheet to
open the standard test dialog. It uses the Actor's current target and supports
situational modifiers, Fate +10, Degrees of Success or Failure, keyboard
activation, and Foundry chat. NPC Characteristic buttons use the same play
pattern.

Owned weapons, armour and general gear are available automatically; the Portal
does not require a separate equipped checkbox. Multiple armour layers still use
the highest AP at each body location rather than adding together. Weapon
modifications are assigned to a compatible owned weapon and can be reassigned.

NPCs and vehicles use Portal combat sheets with editable resources, conditions,
ammunition, notes and roll modifiers. Click a name for rules; Roll and Damage
use Portal dialogs and Foundry chat. Vehicle rolls require an explicit crew
target. The system still calculates derived characteristics and tracks native
conditions. Resolve defences, special effects and jams manually; these controls
do not automatically apply attacks to targets.

In Foundry, **Ammo / Reload** beside a ranged weapon tracks loaded ammunition
and spare rounds/charges allocated to that weapon. Attack rolls automatically
spend ammunition, including on misses; damage and Fate rerolls do not spend it
again. Partial bursts are capped to the ammunition remaining. Reload transfers
saved reserves; apply the weapon's reload time yourself. New reserves start at
zero. Special ammunition, overcharge, discarded magazines and jam losses need
manual adjustment. This first version is Foundry-only; standalone web tracking,
shared ammo stacks and cross-client simultaneous firing are not implemented.

On GM startup, built-in NPC/vehicle sheet selections are upgraded; third-party
sheet overrides are preserved. No actor statistics or ownership are changed.

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
