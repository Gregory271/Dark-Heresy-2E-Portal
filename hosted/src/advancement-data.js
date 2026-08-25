// Rules-aware Elite Advance and psychic-power catalogue.
// Mechanical summaries are condensed from the user's owned sourcebooks; page
// references remain attached so the local Compendium can provide full context.

const core = "Core Rulebook";
const within = "Enemies Within";
const beyond = "Enemies Beyond";

export const eliteAdvanceCatalogue = [
  {
    id: "psyker", name: "Psyker", source: core, page: 90, cost: 300,
    summary: "Gain the Psyker trait, Psyker aptitude, Psy Rating 1, and access to psychic powers and Psy Rating advances.",
    prerequisites: { characteristics: { willpower: 40 }, excludes: ["untouchable"] },
    instantChanges: ["Psyker trait", "Psyker aptitude", "Psy Rating 1", "Cannot later become an Untouchable"],
    notes: "A character without the Sanctioned trait immediately gains 1d10+3 Corruption points.",
  },
  {
    id: "untouchable", name: "Untouchable", source: core, page: 91, cost: 300,
    summary: "Become a soulless psychic null who resists Warp powers but is profoundly disturbing to other humans.",
    prerequisites: { excludes: ["psyker", "astropath"] },
    instantChanges: ["Resistance (Psychic Powers)", "Fellowship is normally halved", "Fellowship counts as 1 against psykers or Psyniscience users", "Immune to Psychic Phenomena", "+30 to resist Perils of the Warp", "Cannot benefit from positive psychic powers"],
    notes: "The Core Rulebook recommends no more than one Untouchable in a group. GM approval is always required.",
  },
  {
    id: "inquisitor", name: "Inquisitor", source: core, page: 88, cost: 1000,
    summary: "Assume the authority and burdens of an Inquisitor and unlock the Inquisitor-only talent set.",
    prerequisites: { characteristics: { influence: 75 }, narrative: "An existing Inquisitor or similarly momentous authority must grant the office." },
    instantChanges: ["Peer (Inquisition)", "Forbidden Lore (choose one)", "Leadership aptitude"],
    notes: "This advance substantially changes the campaign and warband; GM approval and a narrative elevation are required.",
    setup: "inquisitor-lore",
  },
  {
    id: "astropath", name: "Astropath", source: beyond, page: 36, cost: 300,
    summary: "Undergo Soul Binding and unlock the long-range telepathic powers of an Imperial Astropath.",
    prerequisites: { background: "astra-telepathica", elite: ["psyker"] },
    instantChanges: ["Soul Bound trait", "Permanent loss of sight", "Unnatural Senses equal to Willpower"],
    notes: "Usually selected during character creation; becoming an Astropath later normally requires a journey to Holy Terra.",
  },
  {
    id: "sister-of-battle", name: "Sister of Battle", source: within, page: 38, cost: 750,
    summary: "Complete the Adepta Sororitas' harsh martial training and become a fully armoured Battle Sister.",
    prerequisites: { background: "adepta-sororitas", characteristics: { influence: 50, willpower: 40 } },
    instantChanges: ["Peer (Adepta Sororitas)", "Weapon Training (Bolt)", "Scholastic Lore (Tactica Imperialis)", "Willpower aptitude", "Adepta Sororitas power armour", "Godwyn-De'az bolt pistol or flamer"],
    notes: "Only a character with the Adepta Sororitas background can purchase this advance.",
    setup: "sister-weapon",
  },
];

const power = (id, name, discipline, cost, page, summary, prerequisite, action, focus, range, sustained, subtype, path = []) => ({
  id, name, discipline, cost, page, summary, prerequisite, action, focus, range, sustained, subtype,
  path: Array.isArray(path) ? path : [path],
  source: discipline === "Minor Powers" ? within : ["Sanctic Daemonology", "Malefic Daemonology", "Astropath"].includes(discipline) ? beyond : core,
});

export const psychicDisciplines = [
  { id: "all", name: "All Powers" },
  { id: "biomancy", name: "Biomancy", source: core, summary: "Alter living flesh, restore allies, or drain the vitality of foes." },
  { id: "divination", name: "Divination", source: core, summary: "Perceive the Warp's flow and foresee danger, fortune, and possible futures." },
  { id: "pyromancy", name: "Pyromancy", source: core, summary: "Create and command supernatural flame." },
  { id: "telekinesis", name: "Telekinesis", source: core, summary: "Move matter and unleash invisible force." },
  { id: "telepathy", name: "Telepathy", source: core, summary: "Read, influence, protect, or dominate minds." },
  { id: "minor-powers", name: "Minor Powers", source: within, summary: "Undisciplined manifestations available to any character with a Psy Rating." },
  { id: "sanctic-daemonology", name: "Sanctic Daemonology", source: beyond, summary: "Holy psychic arts developed to oppose Daemons and the Warp." },
  { id: "malefic-daemonology", name: "Malefic Daemonology", source: beyond, summary: "Forbidden arts that summon and strengthen Daemons, and always invite Corruption." },
  { id: "astropath", name: "Astropath", source: beyond, summary: "Soul-bound telepathic techniques available only to Astropaths." },
];

export const psychicPowerCatalogue = [
  // Biomancy — Core Rulebook, pp. 200–202.
  power("biomancy-invigourate", "Invigourate", "Biomancy", 100, 200, "Remove levels of Fatigue up to the power's Psy Rating.", { characteristics: { toughness: 30 } }, "Half Action", "Challenging (+0) Willpower", "1 metre", "No", "Concentration"),
  power("biomancy-smite", "Smite", "Biomancy", 200, 202, "Attack a target with a barrage of bio-lightning.", { characteristics: { willpower: 40 } }, "Half Action", "Challenging (+0) Willpower", "20 metres × Psy Rating", "No", "Attack, Concentration", "biomancy-invigourate"),
  power("biomancy-shape-flesh", "Shape Flesh", "Biomancy", 200, 202, "Alter the physical appearance of a touched organic target.", { characteristics: { perception: 35, toughness: 30 } }, "Full Action", "Ordinary (+10) Willpower", "1 metre", "Free Action", "Concentration", "biomancy-smite"),
  power("biomancy-enfeeble", "Enfeeble", "Biomancy", 100, 200, "Stun and fatigue a target by draining its vitality.", { characteristics: { toughness: 35 } }, "Half Action", "Challenging (+0) Opposed Willpower", "20 metres × Psy Rating", "Half Action", "Attack, Concentration", "biomancy-smite"),
  power("biomancy-iron-arm", "Iron Arm", "Biomancy", 400, 200, "Gain Unnatural Strength and Toughness while suffering reduced Agility.", { characteristics: { strength: 35, toughness: 35 } }, "Half Action", "Hard (–20) Willpower", "Self", "Free Action", "Concentration", "biomancy-shape-flesh"),
  power("biomancy-endurance", "Endurance", "Biomancy", 300, 200, "Heal the psyker and several allies and overcome Pinning.", { characteristics: { toughness: 30 } }, "Half Action", "Difficult (–10) Willpower", "3 metres × Psy Rating radius", "No", "Concentration", "biomancy-shape-flesh"),
  power("biomancy-life-leech", "Life Leech", "Biomancy", 400, 201, "Drain a target's Toughness and gain Unnatural Toughness from the stolen vitality.", { characteristics: { toughness: 40 } }, "Full Action", "Difficult (–10) Opposed Willpower", "10 metres × Psy Rating", "Free Action", "Attack, Concentration", "biomancy-enfeeble"),
  power("biomancy-warp-speed", "Warp Speed", "Biomancy", 500, 202, "Gain Unnatural Weapon Skill, Ballistic Skill, and Agility equal to Psy Rating.", { psyRating: 5 }, "Half Action", "Difficult (–10) Willpower", "Self", "Free Action", "Concentration", ["biomancy-iron-arm", "biomancy-endurance"]),
  power("biomancy-haemorrhage", "Haemorrhage", "Biomancy", 400, 200, "Inflict armour-ignoring Energy damage that can leap to a nearby target after a kill.", { psyRating: 4 }, "Half Action", "Difficult (–10) Opposed Willpower", "10 metres × Psy Rating", "No", "Attack, Concentration", "biomancy-life-leech"),

  // Divination — Core Rulebook, pp. 203–205.
  power("divination-warp-perception", "Warp Perception", "Divination", 100, 204, "Gain Unnatural Senses while the power is sustained.", { characteristics: { willpower: 35 } }, "Half Action", "Challenging (+0) Psyniscience", "Self", "Half Action", "Concentration"),
  power("divination-prescience", "Prescience", "Divination", 200, 204, "Grant the psyker and nearby allies bonuses to Weapon Skill and Ballistic Skill.", { skills: { psyniscience: 1 } }, "Half Action", "Challenging (+0) Psyniscience", "3 metres × Psy Rating radius", "Half Action", "Concentration", "divination-warp-perception"),
  power("divination-foreboding", "Foreboding", "Divination", 200, 203, "Use Perception in place of Dodge to evade a foreseen attack.", { skills: { psyniscience: 1 } }, "Reaction", "Difficult (–10) Perception", "Self", "No", "Concentration", "divination-warp-perception"),
  power("divination-misfortune", "Misfortune", "Divination", 300, 203, "Afflict one target with ill fortune and worsen its test results.", { characteristics: { willpower: 45 } }, "Half Action", "Difficult (–10) Opposed Willpower", "20 metres × Psy Rating", "Free Action", "Attack, Concentration", "divination-foreboding"),
  power("divination-scriers-gaze", "Scrier's Gaze", "Divination", 200, 204, "Conduct a thirty-minute ritual to receive information about distant events.", { skills: { psyniscience: 2 } }, "Special", "Challenging (+0) Psyniscience", "Self", "No", "Concentration", "divination-prescience"),
  power("divination-forewarning", "Forewarning", "Divination", 400, 203, "Grant nearby allies a protective field against foreseen attacks.", { characteristics: { perception: 50 } }, "Half Action", "Challenging (+0) Psyniscience", "3 metres × Psy Rating radius", "Free Action", "Concentration", "divination-foreboding"),
  power("divination-precognition", "Precognition", "Divination", 400, 203, "Gain a pool of re-rolls for the psyker and nearby allies.", { characteristics: { perception: 45, willpower: 45 } }, "Full Action", "Hard (–20) Psyniscience", "5 metres × Psy Rating radius", "No", "Concentration", "divination-scriers-gaze"),
  power("divination-winding-fate", "Winding Fate", "Divination", 500, 205, "Touch a person or object to glimpse its past or possible future.", { characteristics: { perception: 50 } }, "Full Action", "Difficult (–10) Psyniscience", "Self", "No", "Concentration", "divination-scriers-gaze"),
  power("divination-perfect-timing", "Perfect Timing", "Divination", 300, 203, "Allow the psyker and nearby allies to ignore cover when shooting.", { characteristics: { perception: 55 } }, "Half Action", "Difficult (–10) Psyniscience", "3 metres × Psy Rating radius", "Half Action", "Concentration", "divination-forewarning"),

  // Pyromancy — Core Rulebook, pp. 206–208.
  power("pyromancy-manipulate-flame", "Manipulate Flame", "Pyromancy", 100, 208, "Extinguish, move, or spread an existing patch of fire.", { characteristics: { willpower: 35 } }, "Half Action", "Routine (+20) Willpower", "10 metres × Psy Rating", "Half Action", "Attack"),
  power("pyromancy-fiery-form", "Fiery Form", "Pyromancy", 400, 206, "Transform into living flame and burn nearby enemies.", { psyRating: 4 }, "Half Action", "Difficult (–10) Willpower", "Self", "Half Action", "Concentration", "pyromancy-manipulate-flame"),
  power("pyromancy-fire-shield", "Fire Shield", "Pyromancy", 300, 206, "Surround the psyker with spectral flame that burns successful attackers.", { characteristics: { agility: 40 } }, "Half Action", "Challenging (+0) Willpower", "20 metres × Psy Rating", "Free Action", "Concentration", "pyromancy-manipulate-flame"),
  power("pyromancy-spontaneous-combustion", "Spontaneous Combustion", "Pyromancy", 200, 208, "Strike a target with flame and potentially set it alight.", { characteristics: { willpower: 40 } }, "Half Action", "Ordinary (+10) Willpower", "20 metres × Psy Rating", "No", "Attack", "pyromancy-manipulate-flame"),
  power("pyromancy-flame-breath", "Flame Breath", "Pyromancy", 300, 206, "Attack at range with a barrage of supernatural flame.", { psyRating: 3 }, "Half Action", "Challenging (+0) Willpower", "20 metres × Psy Rating", "No", "Attack", "pyromancy-manipulate-flame"),
  power("pyromancy-cauterise", "Cauterise", "Pyromancy", 300, 206, "Remove Blood Loss from the psyker or a touched target.", { characteristics: { willpower: 45 } }, "Half Action", "Routine (+20) Willpower", "1 metre", "No", "Concentration", "pyromancy-fire-shield"),
  power("pyromancy-molten-beam", "Molten Beam", "Pyromancy", 400, 208, "Project a high-penetration Melta beam of psychic fire.", { psyRating: 4 }, "Half Action", "Challenging (+0) Willpower", "5 metres × Psy Rating", "No", "Attack", "pyromancy-spontaneous-combustion"),
  power("pyromancy-sunburst", "Sunburst", "Pyromancy", 400, 208, "Release a storm of fire against enemies at range.", { psyRating: 4 }, "Half Action", "Challenging (+0) Willpower", "20 metres × Psy Rating", "No", "Attack", "pyromancy-flame-breath"),
  power("pyromancy-inferno", "Inferno", "Pyromancy", 500, 207, "Ignite the air around a target in a powerful psychic blast.", { psyRating: 5 }, "Half Action", "Difficult (–10) Willpower", "10 metres × Psy Rating", "No", "Attack, Concentration", ["pyromancy-molten-beam", "pyromancy-sunburst"]),

  // Telekinesis — Core Rulebook, pp. 209–211.
  power("telekinesis-control", "Telekinetic Control", "Telekinesis", 100, 211, "Move and manipulate unattended objects at range.", { characteristics: { willpower: 35 } }, "Half Action", "Routine (+20) Willpower", "10 metres × Psy Rating", "Half Action", "Concentration"),
  power("telekinesis-assail", "Assail", "Telekinesis", 200, 209, "Smash a target with a bolt of invisible force and potentially knock it Prone.", { characteristics: { willpower: 40 } }, "Half Action", "Ordinary (+10) Willpower", "20 metres × Psy Rating", "No", "Attack, Concentration", "telekinesis-control"),
  power("telekinesis-shield", "Telekine Shield", "Telekinesis", 200, 211, "Create a personal wall of force that adds Armour to every Hit Location.", { characteristics: { intelligence: 40 } }, "Half Action", "Routine (+20) Willpower", "Self", "Free Action", "Concentration", "telekinesis-assail"),
  power("telekinesis-crush", "Crush", "Telekinesis", 300, 209, "Squeeze a target with invisible force and Snare it.", { characteristics: { willpower: 45 } }, "Half Action", "Challenging (+0) Opposed Willpower", "10 metres × Psy Rating", "No", "Attack, Concentration", "telekinesis-assail"),
  power("telekinesis-objuration-mechanicum", "Objuration Mechanicum", "Telekinesis", 300, 209, "Create a Haywire field that disrupts machines within range.", { characteristics: { intelligence: 40 } }, "Half Action", "Challenging (+0) Willpower", "10 metres × Psy Rating", "No", "Concentration", "telekinesis-assail"),
  power("telekinesis-gate-of-infinity", "Gate of Infinity", "Telekinesis", 400, 209, "Open two linked Warp portals and move between distant locations.", { psyRating: 5 }, "Extended Action (3)", "Hard (–20) Willpower", "1 kilometre × Psy Rating", "No", "Concentration", "telekinesis-shield"),
  power("telekinesis-dome", "Telekine Dome", "Telekinesis", 300, 211, "Create a stationary dome of invisible protective energy.", { psyRating: 4 }, "Half Action", "Challenging (+0) Willpower", "5 metres × Psy Rating", "Free Action", "Concentration", ["telekinesis-shield", "telekinesis-crush"]),
  power("telekinesis-shockwave", "Shockwave", "Telekinesis", 300, 210, "Release a concussive blast that damages and pushes everyone nearby.", { characteristics: { willpower: 50 } }, "Half Action", "Challenging (+0) Willpower", "Self", "No", "Attack, Concentration", "telekinesis-crush"),
  power("telekinesis-vortex-of-doom", "Vortex of Doom", "Telekinesis", 400, 211, "Create and control a destructive vortex of Warp energy.", { psyRating: 5 }, "Half Action", "Difficult (–10) Willpower", "5 metres × Psy Rating", "Half Action", "Attack, Concentration", ["telekinesis-dome", "telekinesis-shockwave"]),

  // Telepathy — Core Rulebook, pp. 212–214.
  power("telepathy-link", "Telepathic Link", "Telepathy", 100, 214, "Read a target's thoughts or transmit a brief mental message.", { characteristics: { willpower: 35 } }, "Half Action", "Difficult (–10) Opposed Willpower", "20 metres × Psy Rating", "No", "Concentration"),
  power("telepathy-erasure", "Erasure", "Telepathy", 100, 212, "Remove a recent memory from a target's mind.", { characteristics: { fellowship: 40 } }, "Full Action", "Challenging (+0) Opposed Willpower", "5 metres × Psy Rating", "No", "Concentration", "telepathy-link"),
  power("telepathy-hallucination", "Hallucination", "Telepathy", 200, 212, "Cause a target to suffer uncontrolled visions.", { characteristics: { fellowship: 40 } }, "Half Action", "Challenging (+0) Opposed Willpower", "10 metres × Psy Rating", "No", "Concentration", "telepathy-link"),
  power("telepathy-psychic-shriek", "Psychic Shriek", "Telepathy", 300, 213, "Attack a target with a concussive wave of psychic force.", { psyRating: 3 }, "Half Action", "Challenging (+0) Willpower", "10 metres × Psy Rating", "No", "Attack", "telepathy-link"),
  power("telepathy-dominate", "Dominate", "Telepathy", 200, 212, "Force targets to follow one simple command during their next turn.", { characteristics: { willpower: 40 } }, "Full Action", "Challenging (+0) Opposed Willpower", "5 metres × Psy Rating", "No", "Concentration", "telepathy-erasure"),
  power("telepathy-mental-fortitude", "Mental Fortitude", "Telepathy", 300, 212, "Share the Adamantium Faith talent with nearby allies.", { talents: ["Adamantium Faith"] }, "Half Action", "Difficult (–10) Willpower", "3 metres × Psy Rating radius", "Free Action", "Concentration", ["telepathy-erasure", "telepathy-hallucination"]),
  power("telepathy-terrify", "Terrify", "Telepathy", 400, 214, "Inflict nightmarish visions and force the target to roll on Shock.", { characteristics: { fellowship: 45 } }, "Half Action", "Difficult (–10) Opposed Willpower", "10 metres × Psy Rating", "No", "Concentration", "telepathy-hallucination"),
  power("telepathy-invisibility", "Invisibility", "Telepathy", 400, 212, "Obscure one target from sight, improving Stealth and penalising ranged attacks against it.", { characteristics: { agility: 30 }, psyRating: 4 }, "Half Action", "Difficult (–10) Willpower", "10 metres × Psy Rating", "Free Action", "Concentration", "telepathy-psychic-shriek"),
  power("telepathy-puppet-master", "Puppet Master", "Telepathy", 400, 214, "Take control of a target's body and divide actions between it and the psyker.", { characteristics: { fellowship: 55 } }, "Full Action", "Difficult (–10) Opposed Willpower", "10 metres × Psy Rating", "Special", "Concentration", ["telepathy-dominate", "telepathy-mental-fortitude", "telepathy-terrify"]),

  // Minor Psychic Powers — Enemies Within, pp. 59–61. These have no tree.
  power("minor-aura-of-fear", "Aura of Fear", "Minor Powers", 200, 59, "Gain the Fear (1) trait while sustaining a projected aura.", { characteristics: { fellowship: 35 }, insanity: 5 }, "Full Action", "Hard (–20) Willpower", "Self", "Half Action", "Concentration"),
  power("minor-deja-vu", "Deja Vu", "Minor Powers", 200, 59, "Compel a target to repeat its last action.", { characteristics: { willpower: 35 } }, "Half Action", "Difficult (–10) Opposed Willpower", "5 metres × Psy Rating", "No", "Concentration"),
  power("minor-foretelling", "Foretelling", "Minor Powers", 100, 59, "Receive a brief, unclear glimpse of one event in a target's near future.", { characteristics: { perception: 35 } }, "Full Action", "Difficult (–10) Psyniscience", "5 metres × Psy Rating", "No", "Concentration"),
  power("minor-ignite", "Ignite", "Minor Powers", 100, 60, "Create and sustain a small flame that can ignite combustible material.", { characteristics: { willpower: 30 } }, "Half Action", "Challenging (+0) Willpower", "5 metres × Psy Rating", "Half Action", "Attack, Concentration"),
  power("minor-ill-omen", "Ill Omen", "Minor Powers", 200, 60, "Manifest an unsettling omen that penalises a target or changes its behaviour.", { skills: { psyniscience: 1 } }, "Full Action", "Difficult (–10) Willpower", "10 metres × Psy Rating", "No", "Concentration"),
  power("minor-impel", "Impel", "Minor Powers", 100, 60, "Push an object or character directly away and possibly knock it Prone.", { characteristics: { willpower: 30 } }, "Half Action", "Ordinary (+10) Willpower", "5 metres × Psy Rating", "No", "Attack, Concentration"),
  power("minor-luck", "Luck", "Minor Powers", 100, 60, "Gain 5 plus Psy Rating on the next test attempted this round.", { characteristics: { perception: 30 } }, "Half Action", "Challenging (+0) Awareness", "Self", "No", "Concentration"),
  power("minor-suggestion", "Suggestion", "Minor Powers", 200, 61, "Convince a target of a small and credible falsehood.", { skills: { deceive: 1 } }, "Full Action", "Difficult (–10) Opposed Willpower", "1 metre × Psy Rating", "No", "Concentration"),
  power("minor-summon-vermin", "Summon Vermin", "Minor Powers", 100, 61, "Call nearby small animals to the psyker's location without controlling them.", { characteristics: { fellowship: 30 } }, "Full Action", "Challenging (+0) Willpower", "1 kilometre × Psy Rating", "No", "Concentration"),
  power("minor-weapon-jinx", "Weapon Jinx", "Minor Powers", 200, 61, "Reduce nearby ranged weapons to Poor craftsmanship and possibly jam them.", { characteristics: { intelligence: 35 } }, "Half Action", "Difficult (–10) Willpower", "5 metres × Psy Rating", "No", "Concentration"),
  power("minor-word-of-beasts", "Word of Beasts", "Minor Powers", 100, 61, "Read an animal's impressions or form an empathic bond with it.", { characteristics: { fellowship: 35 } }, "Half Action", "Difficult (–10) Opposed Willpower", "10 metres", "No", "Concentration"),

  // Sanctic Daemonology — Enemies Beyond, pp. 54–56.
  power("sanctic-psychic-communion", "Psychic Communion", "Sanctic Daemonology", 100, 56, "Increase Initiative for the psyker and selected allies.", { characteristics: { perception: 35 } }, "Full Action", "Ordinary (+10) Willpower", "10 metres × Psy Rating", "Free Action", "Concentration"),
  power("sanctic-word-of-the-emperor", "Word of the Emperor", "Sanctic Daemonology", 200, 56, "Force enemies attacking the psyker to overcome his holy denunciation.", { characteristics: { fellowship: 30 } }, "Half Action", "Difficult (–10) Willpower", "10 metres × Psy Rating", "Half Action", "Concentration", "sanctic-psychic-communion"),
  power("sanctic-exorcism", "Exorcism", "Sanctic Daemonology", 200, 55, "Inflict Willpower damage on a target with the Daemonic trait.", { characteristics: { willpower: 40 } }, "Full Action", "Difficult (–10) Opposed Willpower", "5 metres × Psy Rating", "Half Action", "Attack, Concentration", "sanctic-psychic-communion"),
  power("sanctic-purge-soul", "Purge Soul", "Sanctic Daemonology", 200, 56, "Burn a foe from within using its Corruption against it.", { characteristics: { willpower: 35 } }, "Half Action", "Difficult (–10) Opposed Willpower", "10 metres × Psy Rating", "No", "Attack, Concentration", "sanctic-word-of-the-emperor"),
  power("sanctic-hammerhand", "Hammerhand", "Sanctic Daemonology", 300, 55, "Grant Unnatural Strength to the psyker and selected allies.", { psyRating: 3 }, "Half Action", "Difficult (–10) Willpower", "5 metres × Psy Rating", "Free Action", "Concentration", "sanctic-word-of-the-emperor"),
  power("sanctic-banishment", "Banishment", "Sanctic Daemonology", 300, 54, "Damage a creature with Warp Instability and potentially cast it back into the Warp.", { psyRating: 3 }, "Full Action", "Hard (–20) Willpower", "10 metres × Psy Rating", "No", "Attack, Concentration", "sanctic-exorcism"),
  power("sanctic-cleansing-flame", "Cleansing Flame", "Sanctic Daemonology", 300, 54, "Project a spray of Sanctified psychic flame.", { psyRating: 4 }, "Half Action", "Challenging (+0) Willpower", "5 metres × Psy Rating", "No", "Attack, Concentration", "sanctic-purge-soul"),
  power("sanctic-sanctuary", "Sanctuary", "Sanctic Daemonology", 400, 56, "Give selected allies force-field protection and repel Daemons.", { characteristics: { willpower: 45 } }, "Full Action", "Challenging (+0) Willpower", "Self", "Half Action", "Concentration", "sanctic-banishment"),
  power("sanctic-holocaust", "Holocaust", "Sanctic Daemonology", 500, 56, "Sustain a soul-burning Warp-fire blast around the psyker at personal cost.", { psyRating: 5 }, "Full Action", "Hard (–20) Willpower", "Self", "Full Action", "Attack, Concentration", ["sanctic-cleansing-flame", "sanctic-sanctuary"]),

  // Malefic Daemonology — Enemies Beyond, pp. 57–58.
  power("malefic-summoning", "Summoning", "Malefic Daemonology", 50, 58, "Gain a Psy Rating-scaled bonus to Forbidden Lore (Daemonology) tests made to summon Daemons.", { characteristics: { willpower: 35 } }, "Full Action", "Challenging (+0) Willpower", "Self", "Free Action", "Concentration"),
  power("malefic-cursed-earth", "Cursed Earth", "Malefic Daemonology", 100, 57, "Strengthen Daemons and psychic manifestations in a profaned area.", { characteristics: { willpower: 40 } }, "Full Action", "Difficult (–10) Willpower", "1 metre × Psy Rating", "Free Action", "Concentration", "malefic-summoning"),
  power("malefic-incursion", "Incursion", "Malefic Daemonology", 100, 57, "Gain a Psy Rating-scaled bonus to Daemonic Mastery tests.", { characteristics: { willpower: 45 } }, "Full Action", "Difficult (–10) Willpower", "Self", "Free Action", "Concentration", "malefic-cursed-earth"),
  power("malefic-dark-flame", "Dark Flame", "Malefic Daemonology", 100, 57, "Project corrupting Warp-fire whose damage scales with Corruption.", { corruption: 10 }, "Half Action", "Challenging (+0) Willpower", "5 metres × Psy Rating", "No", "Attack, Concentration", "malefic-cursed-earth"),
  power("malefic-sacrifice", "Sacrifice", "Malefic Daemonology", 100, 58, "Convert recently inflicted damage into a bonus on the next Focus Power test.", { characteristics: { willpower: 45 } }, "Half Action", "Ordinary (+10) Willpower", "Self", "No", "Concentration", "malefic-incursion"),
  power("malefic-infernal-gaze", "Infernal Gaze", "Malefic Daemonology", 200, 57, "Damage and corrupt every non-Daemonic character within sight and range.", { characteristics: { willpower: 45 }, corruption: 15 }, "Half Action", "Difficult (–10) Willpower", "5 metres × Psy Rating", "No", "Attack, Concentration", "malefic-dark-flame"),
  power("malefic-possession", "Possession", "Malefic Daemonology", 200, 57, "Invite a Daemon into the psyker to gain Daemonic power at grave risk.", { corruption: 20 }, "Full Action", "Difficult (–10) Willpower", "Self", "Free Action", "Concentration", ["malefic-sacrifice", "malefic-infernal-gaze"]),

  // Astropath powers — Enemies Beyond, pp. 36–37. No discipline tree.
  power("astropath-astral-telepathy", "Astral Telepathy", "Astropath", 200, 37, "Transmit a brief telepathic message across orbital distances.", { elite: ["astropath"], characteristics: { willpower: 40 }, powers: ["telepathy-link"] }, "Full Action", "Hard (–20) Opposed Willpower", "1,000 kilometres × Psy Rating", "No", "Concentration"),
  power("astropath-telepathic-bond", "Telepathic Bond", "Astropath", 200, 37, "Create a sustained mental communication network with several willing allies.", { elite: ["astropath"], characteristics: { fellowship: 35 }, powers: ["telepathy-link"] }, "Full Action", "Difficult (–10) Opposed Willpower", "20 metres × Psy Rating", "Free Action", "Concentration"),
  power("astropath-mind-scan", "Mind Scan", "Astropath", 300, 37, "Strip back a target's psyche over successive sustained rounds.", { elite: ["astropath"], characteristics: { fellowship: 40, willpower: 50 }, powers: ["astropath-telepathic-bond"] }, "Full Action", "Hard (–20) Willpower", "1 metre × Psy Rating", "Full Action", "Concentration"),
  power("astropath-thought-shield", "Thought Shield", "Astropath", 300, 37, "Use a Reaction to reject mental influence or possession.", { elite: ["astropath"], talents: ["Strong Minded"] }, "Reaction", "Hard (–20) Willpower", "Self", "No", "Concentration"),
];

const eliteTalent = (id, name, elite, tier, aptitudes, prerequisites, benefit, source, page) => ({
  id, name, requiresEliteAdvance: elite, tier, aptitudes, prerequisites, benefit, source: `${source}, p. ${page}`,
});

export const eliteTalentCatalogue = [
  // Inquisitor talents — Core Rulebook, pp. 88–89.
  eliteTalent("elite-inquisitor-complete-control", "Complete Control", "inquisitor", 2, ["Intelligence", "Social"], "Perception 45", "Spend Fate to increase or decrease warband Subtlety by 1d10 plus Willpower bonus.", core, 88),
  eliteTalent("elite-inquisitor-fated", "Fated", "inquisitor", 3, ["Knowledge", "Willpower"], "Inspired Intuition, Shield of Contempt, Strength through Conviction", "Immediately increase Fate Threshold by 1.", core, 88),
  eliteTalent("elite-inquisitor-inspired-intuition", "Inspired Intuition", "inquisitor", 2, ["Perception", "Social"], "Intelligence 50", "Spend Fate to ask the GM one question about the immediate situation and receive a helpful answer.", core, 89),
  eliteTalent("elite-inquisitor-jack-all-trades", "Jack of All Trades", "inquisitor", 2, ["Knowledge"], "Intelligence 45", "Gain all unknown non-Specialist skills as Known skills.", core, 89),
  eliteTalent("elite-inquisitor-master-all-trades", "Master of All Trades", "inquisitor", 3, ["Knowledge"], "Intelligence 55, Jack of All Trades", "Advance every Known skill to Trained.", core, 89),
  eliteTalent("elite-inquisitor-shared-destiny", "Shared Destiny", "inquisitor", 1, ["Fellowship", "Leadership"], "Willpower 40", "Characters within 10 metres can spend two Fate points to grant one Fate point to another character in range.", core, 89),
  eliteTalent("elite-inquisitor-shield-contempt", "Shield of Contempt", "inquisitor", 2, ["Defence", "Toughness"], "Willpower 50", "Spend Fate to gain 0 Corruption instead of the amount just suffered.", core, 89),
  eliteTalent("elite-inquisitor-strength-conviction", "Strength through Conviction", "inquisitor", 2, ["Defence", "Willpower"], "Willpower 50", "Spend Fate to gain 0 Insanity instead of the amount just suffered.", core, 89),
  eliteTalent("elite-inquisitor-will", "Will of the Inquisitor", "inquisitor", 3, ["Knowledge", "Willpower"], "Fated, Intelligence 50, Perception 50, Willpower 55", "Before a test, spend Fate to count the d100 result as 01.", core, 89),

  // Untouchable talents — Core Rulebook, p. 92.
  eliteTalent("elite-untouchable-bane-daemon", "Bane of the Daemon", "untouchable", 2, ["Defence", "Willpower"], "Willpower 40", "Penalise Warp Instability tests made by nearby creatures.", core, 92),
  eliteTalent("elite-untouchable-daemonic-anathema", "Daemonic Anathema", "untouchable", 3, ["Willpower"], "Warp Anathema, Willpower 55", "Nearby creatures gain no benefit from the Daemonic trait.", core, 92),
  eliteTalent("elite-untouchable-null-field", "Null Field", "untouchable", 3, ["Willpower"], "Psychic Null, Willpower 50", "Extend Psychic Null to all characters within Willpower bonus metres.", core, 92),
  eliteTalent("elite-untouchable-psychic-null", "Psychic Null", "untouchable", 2, ["Defence", "Willpower"], "Willpower 40", "Gain Deny the Witch and +20 to evade or oppose psychic powers; repeat purchases improve the bonus.", core, 92),
  eliteTalent("elite-untouchable-soulless-aura", "Soulless Aura", "untouchable", 1, ["Finesse", "Willpower"], "Willpower 30", "Nearby enemies suffer –10 to Charm and Deceive tests.", core, 92),
  eliteTalent("elite-untouchable-warp-anathema", "Warp Anathema", "untouchable", 3, ["Intelligence", "Willpower"], "Warp Disruption, Willpower 55", "Warp Disruption reduces Psy Rating by 2; repeat purchases increase the reduction.", core, 92),
  eliteTalent("elite-untouchable-warp-bane", "Warp Bane", "untouchable", 3, ["Willpower"], "Warp Disruption, Willpower 55", "Extend Warp Disruption to twice the character's Willpower bonus in metres.", core, 92),
  eliteTalent("elite-untouchable-warp-disruption", "Warp Disruption", "untouchable", 2, ["Perception", "Willpower"], "Willpower 45", "Reduce the base Psy Rating of nearby characters by 1.", core, 92),

  // Sister of Battle talents — Enemies Within, pp. 38–39.
  eliteTalent("elite-sister-blessed-martyrdom", "Blessed Martyrdom", "sister-of-battle", 2, ["Leadership", "Willpower"], "Ceaseless Crusader, Shielding Faith", "When burning Fate to survive, witnessing allies regain spent Fate; death restores all spent Fate to witnesses.", within, 38),
  eliteTalent("elite-sister-ceaseless-crusader", "Ceaseless Crusader", "sister-of-battle", 1, ["Leadership", "Willpower"], "Willpower 45", "Spend Fate to ignore Fatigue for the encounter and remove 1 Fatigue from nearby allies.", within, 38),
  eliteTalent("elite-sister-cleanse-fire", "Cleanse with Fire", "sister-of-battle", 2, ["Willpower", "Offence"], "Ballistic Skill 40", "With Flame weapons, re-roll damage dice lower than Willpower bonus.", within, 38),
  eliteTalent("elite-sister-divine-vengeance", "Divine Vengeance", "sister-of-battle", 2, ["Ballistic Skill", "Offence"], "Cleanse with Fire, Ballistic Skill 45", "The first Righteous Fury inflicted in each combat restores 1 spent Fate point.", within, 38),
  eliteTalent("elite-sister-emperors-guidance", "Emperor's Guidance", "sister-of-battle", 2, ["Willpower", "Offence"], "Insanity 25, Furious Zeal", "Spend Fate to add Insanity bonus to weapon penetration until the end of the next turn.", within, 39),
  eliteTalent("elite-sister-furious-zeal", "Furious Zeal", "sister-of-battle", 1, ["Weapon Skill", "Offence"], "Insanity 10, Hatred (Any One)", "Add Insanity bonus to melee damage against targets covered by a Hatred talent.", within, 39),
  eliteTalent("elite-sister-spirit-martyr", "Spirit of the Martyr", "sister-of-battle", 2, ["Willpower", "Defence"], "Insanity 20, Furious Zeal", "Spend Fate to add Insanity bonus as Armour to all locations until the end of the next turn.", within, 39),
  eliteTalent("elite-sister-shielding-faith", "Shielding Faith", "sister-of-battle", 1, ["Willpower", "Defence"], "Deny the Witch", "Spend Fate when using Deny the Witch to pass automatically with Willpower bonus degrees of success.", within, 39),
  eliteTalent("elite-sister-zealots-passion", "Zealot's Passion", "sister-of-battle", 3, ["Fellowship", "Offence"], "Fellowship 35, Spirit of the Martyr", "Spend Fate to grant the character and nearby allies Hatred against one chosen foe for the encounter.", within, 39),

  // Astropath talents — Enemies Beyond, pp. 36–37.
  eliteTalent("elite-astropath-bound-highest-power", "Bound to the Highest Power", "astropath", 3, ["Willpower", "Defence"], "Warp Lock", "Spend Fate to ignore the character's Psychic Phenomena result, then forgo Focus Power and sustaining powers until next turn.", beyond, 36),
  eliteTalent("elite-astropath-supreme-telepath", "Supreme Telepath", "astropath", 3, ["Fellowship"], "Fellowship 40, Willpower 50", "Spend Fate before a Telepathy or Astropath Focus Power test to temporarily increase Psy Rating by half Willpower bonus.", beyond, 36),
  eliteTalent("elite-astropath-second-sight", "Second Sight", "astropath", 2, ["Perception", "Willpower"], "Perception 35", "Increase the Astropath's Unnatural Senses range to twice Willpower.", beyond, 36),
  eliteTalent("elite-astropath-soul-ward", "Soul Ward", "astropath", 3, ["Defence", "Willpower"], "Strong Minded, Willpower 50", "Re-roll Willpower tests caused by Psychic Phenomena, Perils, mutation, or daemonic possession.", beyond, 37),
  eliteTalent("elite-astropath-warp-awareness", "Warp Awareness", "astropath", 2, ["Perception", "Psyker"], "Warp Sense", "Use Psyniscience in place of Awareness for Awareness tests.", beyond, 37),
];

export function disciplineId(name = "") {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function psychicPowerById(id) {
  return psychicPowerCatalogue.find((entry) => entry.id === id) || null;
}

export function eliteAdvanceById(id) {
  return eliteAdvanceCatalogue.find((entry) => entry.id === id) || null;
}
