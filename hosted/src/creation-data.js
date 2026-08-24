export const characteristics = [
  ["weaponSkill", "Weapon Skill", "WS", "Weapon Skill", "Offence"],
  ["ballisticSkill", "Ballistic Skill", "BS", "Ballistic Skill", "Finesse"],
  ["strength", "Strength", "S", "Strength", "Offence"],
  ["toughness", "Toughness", "T", "Toughness", "Defence"],
  ["agility", "Agility", "Ag", "Agility", "Finesse"],
  ["intelligence", "Intelligence", "Int", "Intelligence", "Knowledge"],
  ["perception", "Perception", "Per", "Perception", "Fieldcraft"],
  ["willpower", "Willpower", "WP", "Willpower", "Psyker"],
  ["fellowship", "Fellowship", "Fel", "Fellowship", "Social"],
  ["influence", "Influence", "Inf", null, null],
].map(([id, name, abbreviation, aptitudeOne, aptitudeTwo]) => ({
  id, name, abbreviation, aptitudes: [aptitudeOne, aptitudeTwo].filter(Boolean),
}));

export const characteristicAdvanceCosts = {
  0: [500, 750, 1000, 1500, 2500],
  1: [250, 500, 750, 1000, 1500],
  2: [100, 250, 500, 750, 1250],
};

export const skillAdvanceCosts = {
  0: [300, 600, 900, 1200],
  1: [200, 400, 600, 800],
  2: [100, 200, 300, 400],
};

const commonLoreSpecialities = [
  "Adepta Sororitas", "Adeptus Arbites", "Adeptus Astartes", "Adeptus Astra Telepathica",
  "Adeptus Mechanicus", "Administratum", "Askellon Sector", "Chartist Captains",
  "Collegia Titanicus", "Ecclesiarchy", "Imperial Creed", "Imperial Guard", "Imperial Navy",
  "Imperium", "Navigators", "Planetary Defence Forces", "Rogue Traders", "Schola Progenium",
  "Tech", "Underworld", "War",
];

const scholasticLoreSpecialities = [
  ...commonLoreSpecialities,
  "Astromancy", "Beasts", "Bureaucracy", "Chymistry", "Cryptology", "Heraldry",
  "Imperial Warrants", "Judgement", "Legend", "Numerology", "Occult", "Philosophy",
  "Tactica Imperialis",
];

export const skillSpecialities = {
  "common-lore": commonLoreSpecialities,
  "forbidden-lore": [
    "Archaeotech", "Chaos Space Marines", "Criminal Cartels and Smugglers", "Daemonology",
    "Heresy", "The Horus Heresy and the Long War", "Inquisition", "Mutants", "Pirates",
    "Psykers", "The Warp", "Xenos", ...commonLoreSpecialities, ...scholasticLoreSpecialities,
  ].filter((entry, index, list) => list.indexOf(entry) === index),
  linguistics: [
    "High Gothic", "Low Gothic", "Techna-Lingua", "Chapter Runes", "Mercenary Cant",
    "Underworld Cant", "Eldar", "Kroot", "Ork", "Tau",
  ],
  navigate: ["Surface", "Stellar", "Warp"],
  operate: ["Aeronautica", "Surface", "Voidship"],
  "scholastic-lore": scholasticLoreSpecialities,
  trade: [
    "Agri", "Archaeologist", "Armourer", "Astrographer", "Chymist", "Cryptographer", "Cook",
    "Explorator", "Linguist", "Loremancer", "Morticator", "Performancer", "Prospector",
    "Scrimshawer", "Sculptor", "Shipwright", "Soothsayer", "Technomat", "Voidfarer",
  ],
};

export const specialistSkillIds = Object.freeze(Object.keys(skillSpecialities));

export const skills = [
  ["acrobatics", "Acrobatics", "Agility", "General"],
  ["athletics", "Athletics", "Strength", "General"],
  ["awareness", "Awareness", "Perception", "Fieldcraft"],
  ["charm", "Charm", "Fellowship", "Social"],
  ["command", "Command", "Fellowship", "Leadership"],
  ["commerce", "Commerce", "Intelligence", "Knowledge"],
  ["common-lore", "Common Lore", "Intelligence", "Knowledge"],
  ["deceive", "Deceive", "Fellowship", "Social"],
  ["dodge", "Dodge", "Agility", "Defence"],
  ["forbidden-lore", "Forbidden Lore", "Intelligence", "Knowledge"],
  ["inquiry", "Inquiry", "Fellowship", "Social"],
  ["interrogation", "Interrogation", "Willpower", "Social"],
  ["intimidate", "Intimidate", "Strength", "Social"],
  ["linguistics", "Linguistics", "Intelligence", "General"],
  ["logic", "Logic", "Intelligence", "Knowledge"],
  ["medicae", "Medicae", "Intelligence", "Fieldcraft"],
  ["navigate", "Navigate", "Intelligence", "Fieldcraft"],
  ["operate", "Operate", "Agility", "Fieldcraft"],
  ["parry", "Parry", "Weapon Skill", "Defence"],
  ["psyniscience", "Psyniscience", "Perception", "Psyker"],
  ["scholastic-lore", "Scholastic Lore", "Intelligence", "Knowledge"],
  ["scrutiny", "Scrutiny", "Perception", "General"],
  ["security", "Security", "Intelligence", "Tech"],
  ["sleight-of-hand", "Sleight of Hand", "Agility", "Knowledge"],
  ["stealth", "Stealth", "Agility", "Fieldcraft"],
  ["survival", "Survival", "Perception", "Fieldcraft"],
  ["tech-use", "Tech-Use", "Intelligence", "Tech"],
  ["trade", "Trade", "Intelligence", "General"],
].map(([id, name, characteristic, aptitude]) => ({
  id, name, characteristic, aptitudes: [characteristic, aptitude],
}));

export const aptitudeChoices = [
  "Weapon Skill", "Ballistic Skill", "Strength", "Toughness", "Agility",
  "Intelligence", "Perception", "Willpower", "Fellowship",
];

export const rankNames = ["Known", "Trained (+10)", "Experienced (+20)", "Veteran (+30)"];

export const creationStageIds = [
  "identity", "homeWorld", "background", "role", "characteristics",
  "fateWounds", "divination", "aptitudes", "grants", "equipment", "advances", "review",
];

export function parseCharacteristicModifiers(text = "") {
  const result = {};
  for (const part of text.split(",")) {
    const match = part.trim().match(/^([+-])\s*(.+)$/);
    if (!match) continue;
    const characteristic = characteristics.find((entry) =>
      entry.name.toLowerCase() === match[2].trim().toLowerCase());
    if (characteristic) result[characteristic.id] = match[1] === "+" ? 1 : -1;
  }
  return result;
}

export function parseFate(text = "") {
  const numbers = text.match(/\d+/g)?.map(Number) || [];
  return { threshold: numbers[0] || 0, blessing: numbers[1] || 10 };
}

export function parseWounds(text = "") {
  const match = text.match(/(\d+)\s*\+\s*(\d*)d5/i);
  return { base: Number(match?.[1] || 0), dice: Number(match?.[2] || 1) };
}

export function aptitudeMatches(required, owned) {
  return required.filter((aptitude) => owned.includes(aptitude)).length;
}
