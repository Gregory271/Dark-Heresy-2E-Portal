# Foundry laptop migration

The campaign depends on three matched packages: world `dark-heresy-test`, game
system `dark-heresy-2nd`, and module `dh2-portal`. Portraits, maps, and audio in
Foundry's shared `Data/assets` folder are also included when present.

## Create the transfer package

1. Close Foundry VTT completely.
2. From this repository, run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\backup-foundry-campaign.ps1
   ```

3. Copy the resulting `dh2-foundry-portable-*.zip` from the Desktop to the
   laptop using a USB drive or a static cloud upload.

Use `-ValidateOnly` first when you only want to check that all required folders
and versions are present. Pass a different `-WorldId` if the campaign moves to
a new world.

## Restore on the laptop

1. Install the same Foundry generation listed in `MIGRATION-MANIFEST.json`.
2. Launch Foundry once, locate **Browse User Data**, and then close Foundry.
3. Extract the ZIP. Merge its `Data` folder into the laptop's Foundry User Data
   directory. Preserve the paths under `worlds`, `systems`, `modules`, and
   `assets`.
4. Launch Foundry. Confirm the world, `dark-heresy-2nd` system, and DH2 Portal
   module appear. Enable the module in the world if needed.
5. Open one Acolyte, one reinforcement NPC, and one vehicle. Verify portrait,
   token, attack roll, chat card, ammunition, and editable wounds/integrity.

Do not run an active Foundry world directly from OneDrive, Dropbox, iCloud, or
another live-sync folder. Make backups only while Foundry is closed. Foundry's
built-in package backups are also useful, but shared multimedia assets outside
the world folder need their own copy.
