// Concise mechanical index derived from Core Rulebook Table 7-1 and the
// action descriptions on pages 217-225. Dynamic weapon, skill, talent, and
// psychic entries are assembled in main.js from the current character.
export const combatActionCatalogue = [
  { id: "aim", name: "Aim", group: "Tactical", type: "Half or Full Action", subtypes: ["Concentration"], summary: "Gain +10 with a Half Action or +20 with a Full Action on the next attack against the chosen target." },
  { id: "all-out-attack", name: "All Out Attack", group: "Attacks", type: "Full Action", subtypes: ["Attack", "Melee"], summary: "Make one melee attack at +30 Weapon Skill, but give up Evasion reactions until the start of the next turn.", test: { characteristicId: "weaponSkill", modifier: 30 } },
  { id: "brace", name: "Brace Heavy Weapon", group: "Utility", type: "Half Action", subtypes: ["Miscellaneous"], summary: "Brace a Heavy weapon so it can fire without the normal unbraced penalty.", requirement: "heavyWeapon" },
  { id: "defensive-stance", name: "Defensive Stance", group: "Tactical", type: "Full Action", subtypes: ["Concentration", "Melee"], summary: "Gain one additional Reaction and impose -20 Weapon Skill on melee attacks against the character until the next turn." },
  { id: "delay", name: "Delay", group: "Tactical", type: "Full Action", subtypes: ["Miscellaneous"], summary: "End the turn now to perform one Half Action before the start of the next turn." },
  { id: "disengage", name: "Disengage", group: "Movement", type: "Full Action", subtypes: ["Movement"], summary: "Break from melee and make a Half Move without granting engaged opponents a free attack." },
  { id: "dodge", name: "Dodge", group: "Reactions", type: "Reaction", subtypes: ["Movement"], summary: "After being hit and before damage is rolled, test Dodge to negate the hit.", skillId: "dodge" },
  { id: "parry", name: "Parry", group: "Reactions", type: "Reaction", subtypes: ["Melee"], summary: "After a melee hit and before damage is rolled, test Parry to negate the hit.", skillId: "parry", requirement: "meleeWeapon" },
  { id: "feint", name: "Feint", group: "Attacks", type: "Half Action", subtypes: ["Melee"], summary: "Win an Opposed Weapon Skill test so the next melee Standard Attack against that target cannot be Evaded.", test: { characteristicId: "weaponSkill", modifier: 0, opposed: true } },
  { id: "focus-power", name: "Focus Power", group: "Psychic", type: "Varies", subtypes: ["Concentration"], summary: "Manifest a known psychic power using the Focus Power test and action listed in that power's profile.", requirement: "psyker" },
  { id: "grapple", name: "Grapple", group: "Attacks", type: "Varies", subtypes: ["Attack", "Melee"], summary: "Initiate, control, damage, or escape from a grapple using the appropriate opposed test.", test: { characteristicId: "weaponSkill", modifier: 0, opposed: true } },
  { id: "guarded-action", name: "Guarded Action", group: "Tactical", type: "Half Action", subtypes: ["Concentration", "Melee or Ranged"], summary: "Take -10 on a Weapon Skill or Ballistic Skill test to gain +10 on Evasion tests until the next turn." },
  { id: "jump-leap", name: "Jump or Leap", group: "Movement", type: "Full Action", subtypes: ["Movement"], summary: "Jump vertically or leap horizontally; the GM can call for an Athletics test when the distance or conditions require it.", skillId: "athletics" },
  { id: "knock-down", name: "Knock Down", group: "Attacks", type: "Half Action", subtypes: ["Attack", "Melee"], summary: "Make an Opposed Strength test to knock an opponent Prone.", test: { characteristicId: "strength", modifier: 0, opposed: true } },
  { id: "lightning-attack", name: "Lightning Attack", group: "Attacks", type: "Half Action", subtypes: ["Attack", "Melee"], summary: "With the Lightning Attack talent, test Weapon Skill at -10 and score one hit per Degree of Success, up to Weapon Skill Bonus.", test: { characteristicId: "weaponSkill", modifier: -10, hitMode: "lightning" }, requirement: "lightningAttack" },
  { id: "manoeuvre", name: "Manoeuvre", group: "Attacks", type: "Half Action", subtypes: ["Melee", "Movement"], summary: "Win an Opposed Weapon Skill test to move an engaged opponent one metre.", test: { characteristicId: "weaponSkill", modifier: 0, opposed: true } },
  { id: "move", name: "Move", group: "Movement", type: "Half or Full Action", subtypes: ["Movement"], summary: "Move up to Agility Bonus metres as a Half Action or twice that distance as a Full Action." },
  { id: "overwatch", name: "Overwatch", group: "Attacks", type: "Full Action", subtypes: ["Attack", "Concentration", "Ranged"], summary: "Guard a 45-degree kill zone and make the declared ranged attack when its trigger occurs.", requirement: "rangedWeapon" },
  { id: "ready", name: "Ready", group: "Utility", type: "Half Action", subtypes: ["Miscellaneous"], summary: "Draw, retrieve, stow, or otherwise prepare a weapon or item.", dynamicType: "ready" },
  { id: "reload", name: "Reload", group: "Utility", type: "Varies by weapon", subtypes: ["Miscellaneous"], summary: "Reload a currently readied ranged weapon using its listed reload time.", requirement: "rangedWeapon", dynamicType: "reload" },
  { id: "run", name: "Run", group: "Movement", type: "Full Action", subtypes: ["Movement"], summary: "Move six times Agility Bonus; ranged attacks against the runner suffer -20 while melee attacks gain +20." },
  { id: "stand", name: "Stand, Mount, or Dismount", group: "Movement", type: "Half Action", subtypes: ["Movement"], summary: "Stand from Prone, mount or dismount, enter or leave a vehicle, or move within a vehicle.", dynamicType: "stand" },
  { id: "stun", name: "Stun", group: "Attacks", type: "Full Action", subtypes: ["Attack", "Melee"], summary: "Make a Weapon Skill test at -20 to attempt to Stun an engaged opponent.", test: { characteristicId: "weaponSkill", modifier: -20 } },
  { id: "swift-attack", name: "Swift Attack", group: "Attacks", type: "Half Action", subtypes: ["Attack", "Melee"], summary: "With the Swift Attack talent, test Weapon Skill and gain another hit for every two additional Degrees of Success, up to Weapon Skill Bonus.", test: { characteristicId: "weaponSkill", modifier: 0, hitMode: "swift" }, requirement: "swiftAttack" },
  { id: "tactical-advance", name: "Tactical Advance", group: "Movement", type: "Full Action", subtypes: ["Concentration", "Movement"], summary: "Move from cover to cover up to Half Move while retaining the protection of the cover left during the movement." },
  { id: "use-skill", name: "Use a Skill", group: "Skills", type: "Half, Full, or Extended Action", subtypes: ["Concentration", "Miscellaneous"], summary: "Use a trained skill; the exact action time and difficulty depend on the task." },
];

export const actionGroups = ["All", "Attacks", "Movement", "Reactions", "Skills", "Psychic", "Utility", "Tactical", "Abilities"];

export const actionSource = "Core Rulebook, pp. 217-225";
