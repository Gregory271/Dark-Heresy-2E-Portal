# Usability and play audit

## Personas used

- **First-session player:** knows neither Dark Heresy nor Foundry; must create an
  Acolyte and find the most likely action without asking the GM what every field
  means.
- **Returning player:** wants token → own sheet → primary weapon → roll in as
  few decisions as possible, including ammunition, wounds, Fate, and Fatigue.
- **Online GM:** runs several NPCs and a vehicle, tracks temporary conditions,
  sends rules to chat, and must keep GM-only Actors invisible to players.
- **Physical-table GM:** uses real minis and maps; Foundry supplies initiative,
  rolls, music, handouts, adversary state, and a compact encounter objective.
- **Keyboard/low-vision player:** needs visible focus, meaningful control names,
  no colour-only state, text scaling, and layouts that survive zoom.
- **Campaign custodian:** moves the complete world to a laptop and must not lose
  module versions, uploaded portraits, maps, or actor data.

## Scenario matrix

| Journey | Pass condition | Current result |
| --- | --- | --- |
| New player creates an Acolyte | Can type identity, use Back, resolve every red choice, and create a Foundry Actor | Automated routing/random/creation checks pass; one friend-facing guided run is still recommended |
| Player opens token/Actor | Only that owned Actor opens; roster remains inaccessible | Automated actor-routing test passes |
| Player starts combat | Primary equipped weapon and standard attack are first; roll reaches chat | Action grouping/order and chat tests pass |
| Ammunition loop | Attack expends loaded ammunition; reload moves reserve to clip; empty weapon cannot fire silently | Automated ammunition and combat tests pass |
| Live resource loop | Wounds, Fate, Fatigue, Influence and XP survive saves without resetting inventory or ammo | Focused sync/influence tests pass |
| GM runs NPC | Characteristics, skills, weapons, initiative, conditions, armour, and rules-to-chat are usable on one sheet | Functional; visual/manual zoom test remains |
| GM runs vehicle | Integrity, facing armour, crew test, weapons, conditions, and chat are editable/rollable | Functional; vehicle action economy still needs a dedicated rules pass |
| Hybrid physical session | GM can operate from Actor sheets/chat/handouts without relying on the canvas | Supported; a compact Encounter Objective card is the best next feature |
| Laptop migration | World, system, module, and shared assets restore at matching versions | Packaging/validation script added; restore should be rehearsed before the actual move |

## Product findings and priorities

1. **Investigation workspace:** add cases with clues, source, reliability,
   connections, unresolved questions, and conclusions. Keep player-visible and
   GM-secret fields separate. This is the strongest useful inspiration from
   Owlcat's official Dark Heresy investigation journal—not its decoration.
2. **Encounter objectives:** put “capture,” “rescue,” “escape,” “close the rift,”
   and similar directives above the combat log, with success/failure state. This
   works online and beside physical minis.
3. **One-click common play:** keep primary weapon standard attacks ahead of
   situational options; show ammo and availability at the action itself.
4. **NPC/vehicle parity:** preserve the same interaction grammar as Acolytes:
   click value to roll, click record for rules, quiet share-to-chat control,
   immediate resource editing, clear focus and condition state.
5. **Permissions rehearsal:** assign each player Owner only on their Actor; NPC,
   reinforcement, adventure, and roster folders remain GM-only.
6. **Mobile/accessibility pass:** accordions are appropriate only at narrow
   widths; desktop should retain fast scanning. Test at 125%, 150%, keyboard
   only, and reduced-motion mode.
7. **Artwork integrity:** never infer named profile art from a broad faction or
   role tag. Use an exact sourcebook crop, a user-selected portrait, or an
   explicit neutral silhouette.

Research basis:

- Owlcat's investigation system: <https://darkheresy.owlcat.games/news/en/11>
- Owlcat's beta feature overview: <https://darkheresy.owlcat.games/news/en>
- Foundry User Data backup/move guidance: <https://foundryvtt.com/article/user-data-backup/>
- Foundry asset-management guidance: <https://foundryvtt.com/article/asset-management/>
- Foundry user/document permissions: <https://foundryvtt.com/article/users/>
