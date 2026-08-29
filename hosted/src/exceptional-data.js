// Structured character-creation consequences from the user's owned books.
// Text is deliberately concise; page references identify the complete rule.

export const mentalDisorders = [
  { id: "phobia-dead", name: "Phobia — the dead", summary: "A fear centred on corpses, graves, or the visibly dead." },
  { id: "phobia-insects", name: "Phobia — insects", summary: "A fear centred on insects or insect-like creatures." },
  { id: "obsession-compulsion", name: "Obsession or Compulsion", summary: "A recurring fixation or behaviour that becomes harder to resist as severity rises." },
  { id: "visions-voices", name: "Visions and Voices", summary: "Disturbing perceptions, voices, or flashbacks intrude on the character's senses." },
  { id: "delusion", name: "Delusion", summary: "A fixed false belief shapes the character's decisions and interpretation of events." },
  { id: "horrific-nightmares", name: "Horrific Nightmares", summary: "Terrible dreams interfere with rest and mental recovery." },
];

export const mutantStartingTraits = [
  { id: "amphibious", name: "Amphibious" },
  { id: "dark-sight", name: "Dark-sight" },
  { id: "natural-weapons", name: "Natural Weapons" },
  { id: "sonar-sense", name: "Sonar Sense" },
  { id: "sturdy", name: "Sturdy" },
  { id: "toxic-1", name: "Toxic (1)" },
  { id: "unnatural-agility-1", name: "Unnatural Agility (1)" },
  { id: "unnatural-strength-1", name: "Unnatural Strength (1)" },
  { id: "unnatural-toughness-1", name: "Unnatural Toughness (1)" },
];

export const malignancies = [
  { id: "palsy", min: 1, max: 10, name: "Palsy", summary: "Reduce Agility by 1d10.", characteristicRoll: { target: "agility", sides: 10, sign: -1 } },
  { id: "dark-hearted", min: 11, max: 15, name: "Dark-hearted", summary: "Reduce Fellowship by 1d10.", characteristicRoll: { target: "fellowship", sides: 10, sign: -1 } },
  { id: "ill-fortuned", min: 16, max: 20, name: "Ill-fortuned", summary: "When spending Fate, a d10 result of 7–10 spends the point without granting its benefit." },
  { id: "skin-afflictions", min: 21, max: 25, name: "Skin Afflictions", summary: "Suffer –20 to Charm tests." },
  { id: "night-eyes", min: 26, max: 30, name: "Night Eyes", summary: "Suffer –10 to tests in bright light unless the eyes are shielded." },
  { id: "morbid", min: 31, max: 33, name: "Morbid", summary: "Reduce Intelligence by 1d10.", characteristicRoll: { target: "intelligence", sides: 10, sign: -1 } },
  { id: "witch-mark", min: 34, max: 45, name: "Witch-mark", summary: "Gain a minor, concealable deformity or mutation." },
  { id: "fell-obsession", min: 46, max: 50, name: "Fell Obsession", summary: "Gain an Obsession Mental Disorder with a malign focus." },
  { id: "irrational-nausea", min: 51, max: 55, name: "Irrational Nausea", summary: "Choose an innocuous trigger; nearby exposure can impose –10 to all tests after a failed Toughness test.", needsDetail: "Trigger" },
  { id: "wasted-frame", min: 56, max: 60, name: "Wasted Frame", summary: "Reduce Strength by 1d10.", characteristicRoll: { target: "strength", sides: 10, sign: -1 } },
  { id: "night-terrors", min: 61, max: 63, name: "Night Terrors", summary: "Gain the Horrific Nightmares Mental Disorder." },
  { id: "poor-health", min: 64, max: 70, name: "Poor Health", summary: "Reduce Toughness by 1d10.", characteristicRoll: { target: "toughness", sides: 10, sign: -1 } },
  { id: "distrustful", min: 71, max: 75, name: "Distrustful", summary: "Suffer –10 to Fellowship tests when dealing with strangers." },
  { id: "malign-sight", min: 76, max: 80, name: "Malign Sight", summary: "Reduce Perception by 1d10.", characteristicRoll: { target: "perception", sides: 10, sign: -1 } },
  { id: "ashen-taste", min: 81, max: 83, name: "Ashen Taste", summary: "Recover from Fatigue at half the normal rate." },
  { id: "bloodlust", min: 84, max: 90, name: "Bloodlust", summary: "After inflicting damage in combat, a Willpower test may be required to spare, capture, or allow an enemy to flee." },
  { id: "blackouts", min: 91, max: 93, name: "Blackouts", summary: "The GM determines when blackouts occur and what transpires during them." },
  { id: "strange-addiction", min: 94, max: 100, name: "Strange Addiction", summary: "Gain a Minor Compulsion for an unusual substance.", needsDetail: "Substance" },
];

export const mutations = [
  { id: "bestial-hide", min: 1, max: 6, name: "Bestial Hide", summary: "Gain Natural Armour (2)." },
  { id: "unnatural-arms", min: 7, max: 11, name: "Unnatural Arms", summary: "Gain Multiple Arms equal to Corruption bonus." },
  { id: "sightless-orbs", min: 12, max: 17, name: "Sightless Orbs", summary: "Gain Blind and Unnatural Senses with range based on Corruption bonus." },
  { id: "swollen-brute", min: 18, max: 25, name: "Swollen Brute", summary: "Increase Strength and Toughness by 10; reduce Agility bonus by 1 for movement.", characteristicChanges: { strength: 10, toughness: 10 } },
  { id: "deathsight", min: 26, max: 30, name: "Deathsight", summary: "Once per session, add Corruption bonus to damage and gain 1 Corruption." },
  { id: "cursed-fleshmetal", min: 31, max: 36, name: "Cursed Fleshmetal", summary: "Armour and cybernetics fuse into the body and regenerate with it." },
  { id: "razor-fangs", min: 37, max: 43, name: "Razor Fangs", summary: "Gain a rending unarmed attack and reduce Fellowship by 1d5.", characteristicRoll: { target: "fellowship", sides: 5, sign: -1 } },
  { id: "excessive-legs", min: 44, max: 49, name: "Excessive Legs", summary: "Gain Quadruped and additional legs based on Corruption bonus." },
  { id: "wings", min: 50, max: 54, name: "Wings", summary: "Gain Flyer with speed based on Corruption bonus." },
  { id: "serpentine-tail", min: 55, max: 60, name: "Serpentine Tail", summary: "Gain Crawler and a tail-based unarmed attack." },
  { id: "searing-blood", min: 61, max: 69, name: "Searing Blood", summary: "Blood Loss sprays burning blood at nearby creatures." },
  { id: "witch-curse", min: 70, max: 77, name: "Witch-Curse", summary: "Gain the Psyker trait, Psy Rating 1, and one eligible psychic power; using powers causes Corruption." },
  { id: "bone-blades", min: 78, max: 84, name: "Bone-Blades", summary: "Gain a rending natural attack that can cause Blood Loss." },
  { id: "cannibalistic-urge", min: 85, max: 89, name: "Cannibalistic Urge", summary: "Once per session, consuming human flesh can heal damage and causes Corruption." },
  { id: "corrupted-flesh", min: 90, max: 92, name: "Corrupted Flesh", summary: "When damaged, temporarily gain Fear (1)." },
  { id: "it-will-not-die", min: 93, max: 94, name: "It Will Not Die!", summary: "Lethal injury is survived through mutation rather than burning Fate, at a severe Corruption cost." },
  { id: "warp-gaze", min: 95, max: 97, name: "Warp Gaze", summary: "Gain a corrupting Warp-energy spray attack and Fear (1)." },
  { id: "warp-regeneration", min: 98, max: 99, name: "Warp Regeneration", summary: "Damage can trigger brief Regeneration and Corruption." },
  { id: "warp-made-manifest", min: 100, max: 100, name: "Warp Made Manifest", summary: "Gain Daemonic, Fear, From Beyond, and Warp Instability, with Willpower able to substitute for other characteristics." },
];

export const hatredSpecialities = ["Daemons", "Heretics", "Mutants", "Psykers", "Xenos", "Chaos Space Marines", "Eldar", "Dark Eldar", "Orks"];
export const resistanceSpecialities = ["Cold", "Heat", "Fear"];

export function tableEntryForRoll(table, roll) {
  const value = Number(roll || 0);
  return table.find((entry) => value >= entry.min && value <= entry.max) || null;
}

export function tableEntryById(table, id) {
  return table.find((entry) => entry.id === id) || null;
}
