const core = "Core Rulebook";
const beyond = "Enemies Beyond";
const within = "Enemies Within";
const without = "Enemies Without";

export const catalogs = {
  homeWorlds: [
    ["feral-world", "Feral World", core, "Untamed worlds forge instinctive survivors.", "Fieldcraft · Strength"],
    ["forge-world", "Forge World", core, "Industry and sacred machinery shape every life.", "Intelligence · Toughness"],
    ["highborn", "Highborn", core, "Privilege, obligation, and ruthless politics begin at birth.", "Fellowship · Influence"],
    ["hive-world", "Hive World", core, "Billions endure beneath stacked cities and poisoned skies.", "Agility · Perception"],
    ["shrine-world", "Shrine World", core, "Faith orders life in the shadow of saints and relics.", "Fellowship · Willpower"],
    ["voidborn", "Voidborn", core, "The starless dark creates minds unlike those born planetside.", "Intelligence · Willpower"],
    ["daemon-world", "Daemon World", beyond, "Reality itself has scarred those who survived.", "Warp-hardened survivor"],
    ["penal-colony", "Penal Colony", beyond, "Punishment, confinement, and violence defined existence.", "Endurance · Suspicion"],
    ["quarantine-world", "Quarantine World", beyond, "Isolation protects the Imperium from what lies within.", "Caution · Survival"],
    ["agri-world", "Agri-World", within, "Vast fields and brutal harvests feed distant billions.", "Strength · Fellowship"],
    ["feudal-world", "Feudal World", within, "Oaths, steel, and ancient hierarchy rule life.", "Strength · Weapon Skill"],
    ["frontier-world", "Frontier World", within, "Civilisation ends where your experience begins.", "Perception · Fieldcraft"],
    ["death-world", "Death World", without, "Everything in the environment evolved to kill.", "Agility · Toughness"],
    ["garden-world", "Garden World", without, "Beauty and abundance conceal cultivated danger.", "Fellowship · Perception"],
    ["research-station", "Research Station", without, "Remote study encourages brilliance and dangerous curiosity.", "Intelligence · Knowledge"],
  ].map(([id, name, source, description, highlight]) => ({ id, name, source, description, highlight })),
  backgrounds: [
    ["administratum", "Adeptus Administratum", core, "The machinery of empire runs on records, tithes, and patient calculation."],
    ["arbites", "Adeptus Arbites", core, "Imperial law is absolute, and you were its instrument."],
    ["astra-telepathica", "Adeptus Astra Telepathica", core, "You served the institution that binds psykers to Imperial survival."],
    ["mechanicus", "Adeptus Mechanicus", core, "Knowledge is sacred; flesh is only the beginning."],
    ["ministorum", "Adeptus Ministorum", core, "You carried the Imperial Creed into a faithless galaxy."],
    ["imperial-guard", "Imperial Guard", core, "Discipline and overwhelming firepower made you a soldier."],
    ["outcast", "Outcast", core, "You survived in the spaces where Imperial protection ends."],
    ["exorcised", "Exorcised", beyond, "Something from beyond once possessed you—and was driven out."],
    ["adepta-sororitas", "Adepta Sororitas", within, "Faith, discipline, and sacred violence shaped your service."],
    ["mutant", "Mutant", within, "The Imperium condemns the body you were born with."],
    ["heretek", "Heretek", without, "Forbidden innovation placed you beyond orthodox doctrine."],
    ["imperial-navy", "Imperial Navy", without, "You learned war among voidships, decks, and stellar distances."],
    ["rogue-trader-fleet", "Rogue Trader Fleet", without, "You served beyond Imperial borders under an ancient warrant."],
  ].map(([id, name, source, description]) => ({ id, name, source, description })),
  roles: [
    ["assassin", "Assassin", core, "Eliminate priority targets through patience and decisive violence."],
    ["chirurgeon", "Chirurgeon", core, "Preserve, alter, or interrogate the mysteries of flesh."],
    ["desperado", "Desperado", core, "Live by speed, nerve, and the weapon close at hand."],
    ["hierophant", "Hierophant", core, "Lead through conviction, rhetoric, and unshakable faith."],
    ["mystic", "Mystic", core, "Perceive and command truths hidden within the Warp."],
    ["sage", "Sage", core, "Turn knowledge, logic, and obscure records into weapons."],
    ["seeker", "Seeker", core, "Follow evidence and quarry wherever either may lead."],
    ["warrior", "Warrior", core, "Stand where violence is thickest and prevail."],
    ["crusader", "Crusader", beyond, "Become a shield against the unholy and impossible."],
    ["fanatic", "Fanatic", within, "Let absolute conviction consume doubt and weakness."],
    ["penitent", "Penitent", within, "Seek redemption through suffering, duty, and sacrifice."],
    ["ace", "Ace", without, "Master vehicles and win battles through speed and control."],
  ].map(([id, name, source, description]) => ({ id, name, source, description })),
  eliteAdvances: [
    { id: "psyker", name: "Psyker", source: core },
    { id: "untouchable", name: "Untouchable", source: core },
    { id: "inquisitor", name: "Inquisitor", source: core },
    { id: "astropath", name: "Astropath", source: beyond },
    { id: "sister-of-battle", name: "Sister of Battle", source: within },
  ],
};

export const scenes = [
  { id: "identity", eyebrow: "Character Creation", title: "Give Your Acolyte Life", copy: "Define your Acolyte's name, appearance, and other details that set them apart from fellow Acolytes.", theme: "intake", action: "Continue", detailTitle: "Give Your Acolyte Life", detail: "Define your Acolyte's name, appearance, past, history with the Inquisitor, and other personal details." },
  { id: "homeWorld", catalog: "homeWorlds", eyebrow: "Choose Home World", title: "Choose Home World", copy: "Your Acolyte's Home World is where they were born and likely spent much of their life. It shapes appearance, mannerisms, perspective, and starting characteristics.", theme: "forge", action: "Choose Home World", detailTitle: "Choose Home World", detail: "A Home World provides Characteristic Modifiers, Fate Threshold, a Home World Bonus, a Home World Aptitude, Wounds, and Recommended Backgrounds." },
  { id: "background", catalog: "backgrounds", eyebrow: "Choose Background", title: "Choose Background", copy: "A Background represents what the character has done until now, including organisations served, training received, resources available, and people known.", theme: "guard", action: "Choose Background", detailTitle: "Choose Background", detail: "A Background provides Starting Skills, Starting Talents, Starting Equipment, a Background Bonus, a Background Aptitude, and Recommended Roles." },
  { id: "role", catalog: "roles", eyebrow: "Choose Role", title: "Choose Role", copy: "While Home World and Background determine the past, the Role determines what your Acolyte is in the present and how they face danger and resolve problems.", theme: "assassin", action: "Choose Role", detailTitle: "Choose Role", detail: "A Role provides Role Aptitudes, a Role Talent, and a Role Bonus, and determines how your Acolyte grows and learns with experience." },
  { id: "characteristics", eyebrow: "Generate Characteristics", kicker: "Basic Building Blocks", title: "Determine Strengths and Weaknesses", copy: "Characteristics represent your Acolyte's raw potential and natural physical and mental gifts. Roll each value, or enter results rolled elsewhere.", theme: "assessment", action: "Continue", detailTitle: "Generate Characteristics", detail: "Normally roll 2d10+20. For a positive Home World modifier, roll 3d10 and keep the two highest; for a negative modifier, keep the two lowest. One characteristic may be re-rolled, but the second result must be kept." },
  { id: "fateWounds", eyebrow: "Home World Rules", kicker: "Fate and Wounds", title: "Determine Fate and Wounds", copy: "The selected Home World determines your Acolyte's Fate Threshold, chance of the Emperor's Blessing, and starting Wounds.", theme: "assessment", action: "Continue", detailTitle: "Fate Threshold and Wounds", detail: "Roll 1d10 for the Emperor's Blessing. If the result equals or exceeds the Home World's value, increase Fate Threshold by 1. Roll the listed Home World formula for Wounds." },
  { id: "divination", eyebrow: "Read Divination", kicker: "Twist of Destiny", title: "Read Your Acolyte's Divination", copy: "Your Acolyte rolls 1d100 during character creation and immediately applies the corresponding Divination.", theme: "assessment", action: "Continue", detailTitle: "Twist of Destiny", detail: "Roll 1d100 and compare the result to Table 2-9: Divinations. The result becomes part of your Acolyte's strange and twisted destiny." },
  { id: "aptitudes", eyebrow: "Character Creation", kicker: "Aptitudes", title: "Resolve Aptitudes", copy: "Aptitudes determine the experience cost of future advances. Every character begins with General and gains aptitudes from Home World, Background, and Role.", theme: "assessment", action: "Continue", detailTitle: "Aptitudes", detail: "If the same aptitude is gained more than once during character creation, replace each duplicate with a characteristic-based aptitude the character does not already possess." },
  { id: "grants", eyebrow: "Starting Abilities", kicker: "Skills, Talents, and Traits", title: "Record Starting Abilities", copy: "Record the skills, talents, traits, and special abilities granted by your selected character-creation options.", theme: "assessment", action: "Continue", detailTitle: "Starting Abilities", detail: "Starting benefits are gained without spending your Acolyte's starting experience points. Resolve any alternatives before continuing." },
  { id: "equipment", eyebrow: "Equip Your Acolyte", kicker: "Armoury and Acquisitions", title: "Equip Your Acolyte", copy: "Take the equipment granted by the Background, then select additional starting acquisitions equal to your Acolyte's Influence bonus.", theme: "assessment", action: "Continue", detailTitle: "Equip Your Acolyte", detail: "Additional starting acquisitions are normally limited to Scarce Availability or better. Weapons gained during character creation include two clips of standard ammunition." },
  { id: "advances", eyebrow: "Spend Starting XP", kicker: "1,000 Starting XP", title: "Purchase Advances", copy: "Spend experience points to improve your Acolyte's characteristics, acquire or improve skills, and purchase talents or psychic powers.", theme: "assessment", action: "Review Your Acolyte", detailTitle: "Spend Experience Points", detail: "Advance costs depend on how many matching aptitudes your Acolyte possesses. Advances and skill ranks must be purchased in order, and prerequisites still apply." },
  { id: "review", eyebrow: "Character Creation", kicker: "Final Review", title: "Your Acolyte Is Ready", copy: "Review your Acolyte, resolve outstanding choices, and export the completed record for later editing or Foundry VTT.", theme: "assessment", action: "Export Character", detailTitle: "Review Your Acolyte", detail: "The review verifies characteristics, Fate, Wounds, aptitudes, starting grants, acquisitions, and experience expenditure before export." },
];

export const defaultCharacter = {
  name: "", player: "", presentation: "", appearance: "",
  homeWorld: "forge-world", background: "imperial-guard", role: "assassin",
};

export const artByChoice = Object.fromEntries(
  [...catalogs.homeWorlds, ...catalogs.backgrounds, ...catalogs.roles]
    .map((entry) => [entry.id, `../public/assets/choices/${entry.id}.webp?v=0.5.0`]),
);

export const stageArtById = {
  identity: "../public/assets/stages/grants.webp?v=0.6.2",
  characteristics: "../public/assets/stages/characteristics.webp?v=0.6.2",
  fateWounds: "../public/assets/stages/fate-wounds.webp?v=0.6.2",
  divination: "../public/assets/stages/divination.webp?v=0.6.2",
  aptitudes: "../public/assets/stages/aptitudes.webp?v=0.6.2",
  grants: "../public/assets/stages/grants.webp?v=0.6.2",
  equipment: "../public/assets/stages/equipment.webp?v=0.6.2",
  advances: "../public/assets/stages/advances.webp?v=0.6.2",
  review: "../public/assets/stages/review.webp?v=0.6.2",
};

export const divinations = [
  { min: 1, max: 1, title: "Mutation without, corruption within.", effect: "Roll once on Table 8-15: Malignancies (Core Rulebook, page 290) and apply the result." },
  { min: 2, max: 5, title: "Trust in your fear.", effect: "Increase Perception by 5. Gain the Phobia Mental Disorder.", statChanges: [{ target: "perception", amount: 5 }] },
  { min: 6, max: 9, title: "Humans must die so that humanity can endure.", effect: "Gain the Jaded talent. If already possessed, increase Willpower by 2 instead." },
  { min: 10, max: 13, title: "The pain of the bullet is ecstasy compared to damnation.", effect: "Reduce Agility by 3. The first time Critical damage is suffered each session, roll 1d10; on a 10, suffer no Critical Effects, though the damage still counts as Critical damage.", statChanges: [{ target: "agility", amount: -3 }] },
  { min: 14, max: 17, title: "Be a boon to your allies and the bane of your enemies.", effect: "Gain Hatred (choose any one). If already possessed, increase Strength by 2 instead." },
  { min: 18, max: 21, title: "The wise learn from the deaths of others.", effect: "Increase Agility or Intelligence by 3. Reduce Weapon Skill or Ballistic Skill by 3.", statChanges: [{ id: "increase", options: ["agility", "intelligence"], amount: 3 }, { id: "reduce", options: ["weaponSkill", "ballisticSkill"], amount: -3 }] },
  { min: 22, max: 25, title: "Kill the alien before it can speak its lies.", effect: "Gain Quick Draw. If already possessed, increase Agility by 2 instead." },
  { min: 26, max: 29, title: "Truth is subjective.", effect: "Increase Perception by 3. The first time Corruption is gained each session, gain that amount plus 1.", statChanges: [{ target: "perception", amount: 3 }] },
  { min: 30, max: 33, title: "Thought begets Heresy.", effect: "Reduce Intelligence by 3. The first time Corruption is gained each session, reduce that amount by 1, to a minimum of 0.", statChanges: [{ target: "intelligence", amount: -3 }] },
  { min: 34, max: 38, title: "Heresy begets Retribution.", effect: "Increase Fellowship or Strength by 3. Reduce Toughness or Willpower by 3.", statChanges: [{ id: "increase", options: ["fellowship", "strength"], amount: 3 }, { id: "reduce", options: ["toughness", "willpower"], amount: -3 }] },
  { min: 39, max: 43, title: "A mind without purpose wanders in dark places.", effect: "When gaining Mental Disorders, the character may gain a new Disorder instead of increasing the severity of an existing Disorder." },
  { min: 44, max: 49, title: "If a job is worth doing, it is worth dying for.", effect: "Increase Toughness or Willpower by 3. Reduce Fellowship or Strength by 3.", statChanges: [{ id: "increase", options: ["toughness", "willpower"], amount: 3 }, { id: "reduce", options: ["fellowship", "strength"], amount: -3 }] },
  { min: 50, max: 54, title: "Dark dreams lie upon the heart.", effect: "When rolling on Table 8-15: Malignancies, the character may instead select any one result and gain that Malignancy." },
  { min: 55, max: 59, title: "Violence solves everything.", effect: "Increase Weapon Skill or Ballistic Skill by 3. Reduce Agility or Intelligence by 3.", statChanges: [{ id: "increase", options: ["weaponSkill", "ballisticSkill"], amount: 3 }, { id: "reduce", options: ["agility", "intelligence"], amount: -3 }] },
  { min: 60, max: 63, title: "Ignorance is a wisdom of its own.", effect: "Reduce Perception by 3. The first time Insanity is gained each session, reduce that amount by 1, to a minimum of 0.", statChanges: [{ target: "perception", amount: -3 }] },
  { min: 64, max: 67, title: "Only the insane have strength enough to prosper.", effect: "Increase Willpower by 3. The first time Insanity is gained each session, gain that amount plus 1.", statChanges: [{ target: "willpower", amount: 3 }] },
  { min: 68, max: 71, title: "A suspicious mind is a healthy mind.", effect: "Increase Perception by 2. The character may re-roll Awareness tests to avoid being Surprised.", statChanges: [{ target: "perception", amount: 2 }] },
  { min: 72, max: 75, title: "Suffering is an unrelenting instructor.", effect: "Reduce Toughness by 3. The first time damage is suffered each session, gain +20 to the next test made before the end of the next turn.", statChanges: [{ target: "toughness", amount: -3 }] },
  { min: 76, max: 79, title: "The only true fear is dying without your duty done.", effect: "Gain Resistance (Cold, Heat, or Fear). If already possessed, increase Toughness by 2 instead." },
  { min: 80, max: 83, title: "Only in death does duty end.", effect: "The first time Fatigue would be suffered each session, reduce it by 1, to a minimum of 0." },
  { min: 84, max: 87, title: "Innocence is an illusion.", effect: "Gain Keen Intuition. If already possessed, increase Intelligence by 2 instead." },
  { min: 88, max: 91, title: "To war is human.", effect: "Gain Dodge as a Known skill. If already possessed, increase Agility by 2 instead.", skillGrant: { id: "dodge", ifKnownStat: { target: "agility", amount: 2 } } },
  { min: 92, max: 95, title: "There is no substitute for zeal.", effect: "Gain Clues from the Crowds. If already possessed, increase Fellowship by 2 instead." },
  { min: 96, max: 99, title: "Even one who has nothing can still offer his life.", effect: "When burning Fate threshold to survive a lethal injury, roll 1d10. On a 10, survive without reducing Fate threshold." },
  { min: 100, max: 100, title: "Do not ask why you serve. Only ask how.", effect: "Increase Fate threshold by 1.", fateChange: 1 },
];

export const loreByChoice = {
  "feral-world": [
    "Life is governed by harsh environments, tribal customs, and survival with limited technology.",
    "Feral worlders commonly rely on physical strength, hunting, and traditional weapons.",
    "Imperial agents value their resilience, instincts, and ability to endure primitive conditions.",
  ],
  "forge-world": [
    "Forge worlds are the Imperium's armouries, where vast populations labour in manufactorums.",
    "Technology is omnipresent but remains sacred, ritualised, and controlled by the Machine Cult.",
    "Their people may be workers, overseers, soldiers, or Mechanicus aspirants familiar with augmentation.",
  ],
  highborn: [
    "Highborn characters are raised among wealth, privilege, political obligation, and noble rivalry.",
    "They are accustomed to authority and resources unavailable to most Imperial citizens.",
    "Their upbringing favours influence and social ability, but can leave them less physically hardened.",
  ],
  "hive-world": [
    "Hive worlds compress billions of people into immense, stratified cities.",
    "Their inhabitants learn to navigate crowds, enclosed spaces, gangs, industry, and constant scarcity.",
    "A hive worlder may come from the spires, habs, manufactorums, or lawless underhive.",
  ],
  "shrine-world": [
    "Shrine worlds are centres of pilgrimage, worship, relics, and the Imperial Creed.",
    "Their people live surrounded by religious observance and the authority of the Ecclesiarchy.",
    "Faith shapes their outlook, though sacred sites also attract corruption, exploitation, and hidden heresy.",
  ],
  voidborn: [
    "Voidborn spend their lives aboard starships, stations, or other artificial environments.",
    "They are accustomed to cramped passages, recycled air, strange gravity, and the dangers of space.",
    "Planet-bound citizens often regard their appearance, mannerisms, and superstitions with suspicion.",
  ],
  "daemon-world": [
    "Daemon worlds are places where reality has been overwhelmed by the Warp and its inhabitants.",
    "Survivors learn that physical laws, memory, and perception cannot always be trusted.",
    "Escaping such a world leaves knowledge and scars that Imperial authorities may fear as much as value.",
  ],
  "penal-colony": [
    "Penal colonies confine criminals, dissidents, and the condemned under brutal Imperial authority.",
    "Life is defined by punishment, forced labour, violence, and competition for limited protection.",
    "Those who survive often become hardened, suspicious, and adept at enduring confinement.",
  ],
  "quarantine-world": [
    "Quarantine worlds are isolated because of contamination, plague, xenos influence, or other forbidden threats.",
    "Their populations live beneath restrictions, fear, and the possibility of total Imperial sanction.",
    "Survivors are familiar with secrecy, isolation, and dangers outsiders may not understand.",
  ],
  "agri-world": [
    "Agri-worlds devote immense regions, and often their entire economy, to feeding the Imperium.",
    "Their populations labour among industrial harvesters, processing works, livestock, and endless fields.",
    "Life may appear pastoral from afar, but production quotas and harsh labour dominate daily existence.",
  ],
  "feudal-world": [
    "Feudal worlds possess limited technology and societies organised around hereditary rulers and sworn service.",
    "Warriors may be trained with blades, bows, armour, cavalry, or locally revered relic-weapons.",
    "Their customs emphasise loyalty, honour, obligation, and sharply divided social ranks.",
  ],
  "frontier-world": [
    "Frontier worlds exist at the edge of settled Imperial space, where authority and supplies are limited.",
    "Settlers must contend with isolation, hostile environments, raiders, and threats beyond Imperial protection.",
    "Their people prize self-reliance, practical skills, and vigilance against the unknown.",
  ],
  "death-world": [
    "Death worlds possess environments so lethal that ordinary settlement is a constant struggle.",
    "Native predators, toxins, weather, terrain, or other hazards shape every aspect of survival.",
    "Their inhabitants develop exceptional caution, toughness, and familiarity with hostile wilderness.",
  ],
  "garden-world": [
    "Garden worlds are celebrated for beauty, favourable climates, and carefully preserved environments.",
    "They often serve as estates, retreats, or prized holdings for the Imperium's powerful.",
    "Their apparent tranquillity can conceal rigid control, political privilege, and threats protected from scrutiny.",
  ],
  "research-station": [
    "Research stations are isolated facilities devoted to specialised study, observation, or experimentation.",
    "Their inhabitants depend on technical systems and a small community operating far from conventional support.",
    "The work conducted there may involve discoveries, restricted knowledge, or dangers that demand secrecy.",
  ],
  administratum: [
    "The Adeptus Administratum records, calculates, and directs the countless obligations of the Imperium.",
    "Its servants work within immense bureaucracies where information, procedure, and rank carry great power.",
    "They are trained to navigate records and institutions that can obscure truth as readily as preserve it.",
  ],
  arbites: [
    "The Adeptus Arbites enforces Imperial law rather than the local laws of individual worlds.",
    "Arbitrators investigate sedition, crush serious crime, and confront threats to Imperial authority.",
    "Their service combines disciplined violence with inquiry, interrogation, and knowledge of the underworld.",
  ],
  "astra-telepathica": [
    "The Adeptus Astra Telepathica finds, tests, sanctions, and employs the Imperium's psykers.",
    "Its servants confront the Warp's dangers and the fear directed at those touched by psychic power.",
    "They may serve as sanctioned psykers, handlers, warders, telepaths, or support personnel.",
  ],
  mechanicus: [
    "The Adeptus Mechanicus preserves technological lore and maintains the machines sustaining the Imperium.",
    "Its servants approach technology through sacred ritual, specialised knowledge, and bodily augmentation.",
    "They may serve as adepts, enginseers, investigators, artisans, or hunters of forbidden technology.",
  ],
  ministorum: [
    "The Adeptus Ministorum maintains worship of the Emperor across the Imperium.",
    "Its members preach, teach, preserve sacred practice, and oppose witches, mutants, xenos, and heresy.",
    "Their duties can range from parish service and pilgrimage to missionary work and militant persecution.",
  ],
  "imperial-guard": [
    "The Imperial Guard is an immense army tithed from worlds across the galaxy.",
    "Survivors become hardened veterans familiar with weapons, warzones, alien foes, and massed warfare.",
    "Guardsmen may specialise in reconnaissance, vehicles, artillery, logistics, medicine, or command.",
  ],
  outcast: [
    "Outcasts live beyond respectable Imperial society as wanderers, criminals, exiles, or unwanted survivors.",
    "They learn to function without reliable protection from institutions or conventional communities.",
    "Their independence and underworld experience can make them valuable in investigations others cannot enter.",
  ],
  exorcised: [
    "The Exorcised have survived daemonic possession and the ritual expulsion of the entity.",
    "They retain intimate knowledge of corruption while carrying lasting physical and spiritual trauma.",
    "The Imperium may employ their rare experience while continuing to distrust what remains within them.",
  ],
  "adepta-sororitas": [
    "The Adepta Sororitas serves the Ecclesiarchy through militant faith, discipline, and devotion.",
    "Its members are trained within the Schola Progenium before entering specialised Orders.",
    "Their service joins religious conviction with martial, medical, diplomatic, or investigative duties.",
  ],
  mutant: [
    "Mutants bear physical deviations that Imperial society commonly condemns as corruption.",
    "Many survive in hidden communities, polluted districts, labour gangs, or the margins of civilisation.",
    "Their unusual bodies can provide advantages while exposing them to hatred, persecution, and suspicion.",
  ],
  heretek: [
    "Hereteks pursue technology beyond the strictures imposed by the Adeptus Mechanicus.",
    "They experiment with forbidden devices, proscribed knowledge, and innovations judged dangerous or impious.",
    "Their expertise is valuable to the Inquisition, but discovery can bring condemnation from the Machine Cult.",
  ],
  "imperial-navy": [
    "The Imperial Navy fights and travels between worlds aboard immense voidships.",
    "Its personnel learn discipline, shipboard routine, void warfare, and survival far from planetary support.",
    "Their duties can include gunnery, boarding actions, flight operations, engineering, logistics, or navigation.",
  ],
  "rogue-trader-fleet": [
    "Rogue Trader fleets explore, trade, conquer, and negotiate beyond ordinary Imperial boundaries.",
    "Their crews encounter distant worlds, xenos cultures, strange markets, and hazards unknown to most citizens.",
    "Life in a fleet rewards adaptability, ambition, negotiation, and loyalty to the commanding dynasty.",
  ],
  assassin: [
    "Assassins stalk chosen targets and strike at the moment most likely to secure the kill.",
    "They may employ stealth, infiltration, disguise, blades, poisons, firearms, or explosives.",
    "The role supports both distant snipers and close-range killers focused on precise violence.",
  ],
  chirurgeon: [
    "Chirurgeons preserve life through medical knowledge, surgery, drugs, and practical treatment.",
    "They study bodies closely enough to heal injuries, identify causes of death, or exploit physical weakness.",
    "Their expertise supports investigations as well as keeping fellow Acolytes alive.",
  ],
  desperado: [
    "Desperados rely on speed, daring, and mastery of firearms in dangerous confrontations.",
    "They flourish in close-range gunfights where quick reactions and mobility decide survival.",
    "Their methods suit gunslingers, bounty hunters, criminals, and other practitioners of sudden violence.",
  ],
  hierophant: [
    "Hierophants lead through conviction, rhetoric, authority, and command of Imperial belief.",
    "They can inspire allies, confront hostile crowds, and use social power as effectively as weapons.",
    "The role suits preachers, officers, demagogues, and others who direct the actions of those around them.",
  ],
  mystic: [
    "Mystics perceive realities hidden from ordinary senses, especially the influence of the Warp.",
    "Many are psykers, diviners, or spiritual interpreters whose insight carries exceptional danger.",
    "Their role centres on psychic awareness, willpower, knowledge, and confronting unnatural threats.",
  ],
  sage: [
    "Sages pursue knowledge through study, analysis, records, and disciplined reasoning.",
    "They identify patterns and recover information others overlook or cannot understand.",
    "Their expertise supports research, technical investigation, cryptology, and specialised lore.",
  ],
  seeker: [
    "Seekers uncover truth by following evidence, questioning witnesses, and detecting deception.",
    "They combine observation with social investigation and persistent pursuit of hidden answers.",
    "The role suits investigators, interrogators, trackers, and hunters of conspiracies.",
  ],
  warrior: [
    "Warriors confront the enemy directly through training, endurance, and mastery of combat.",
    "They may specialise in melee weapons, firearms, heavy equipment, or battlefield leadership.",
    "Their role is to survive violence and apply force when investigation gives way to battle.",
  ],
  crusader: [
    "Crusaders are dedicated martial champions who place themselves between allies and terrible foes.",
    "They combine faith, discipline, armour, and close-combat skill against enemies of the Imperium.",
    "Their role favours protection, endurance, and holding ground in the face of unnatural threats.",
  ],
  fanatic: [
    "Fanatics are driven by an overwhelming creed, hatred, duty, or personal cause.",
    "Their conviction allows them to press forward when fear or suffering would stop others.",
    "The same zeal can make them powerful servants and dangerously inflexible companions.",
  ],
  penitent: [
    "Penitents seek absolution for real or imagined failures through suffering and service.",
    "They accept danger, hardship, and punishment as part of their pursuit of redemption.",
    "Their role turns guilt and endurance into determination against the enemies of the Imperium.",
  ],
  ace: [
    "Aces are exceptional pilots and vehicle operators whose skill is proven under dangerous conditions.",
    "They understand machines through handling, instinct, and experience rather than purely academic study.",
    "Their role excels when missions depend on speed, manoeuvring, pursuit, or vehicular combat.",
  ],
};

const emblem = { size: "auto 86%", position: "80% 50%" };
const portrait = { size: "auto 98%", position: "82% 100%" };

export const artFramingByChoice = {
  ace: emblem,
  assassin: emblem,
  chirurgeon: emblem,
  crusader: emblem,
  desperado: emblem,
  exorcised: emblem,
  "feral-world": emblem,
  hierophant: emblem,
  mystic: emblem,
  penitent: emblem,
  sage: emblem,
  seeker: emblem,
  warrior: emblem,

  "adepta-sororitas": { ...portrait, position: "80% 100%" },
  fanatic: { ...portrait, position: "82% 100%" },
  heretek: { ...portrait, position: "82% 100%" },
  "imperial-navy": { ...portrait, position: "84% 100%" },
  mechanicus: { ...portrait, position: "82% 100%" },
  ministorum: { ...portrait, position: "84% 100%" },
  outcast: { size: "auto 92%", position: "83% 100%" },

  administratum: { size: "cover", position: "70% 32%" },
  arbites: { size: "auto 96%", position: "82% 100%" },
  "astra-telepathica": { size: "auto 92%", position: "83% 100%" },
  "daemon-world": { size: "cover", position: "64% 35%" },
  mutant: { size: "cover", position: "66% 25%" },
  "imperial-guard": { size: "auto 91%", position: "84% 100%" },
  "rogue-trader-fleet": { size: "auto 96%", position: "83% 100%" },
};

export const artPageByChoice = {
  "feral-world": 34, "forge-world": 36, highborn: 38, "hive-world": 40,
  "shrine-world": 42, voidborn: 44, administratum: 48, arbites: 50,
  "astra-telepathica": 52, mechanicus: 54, ministorum: 56,
  "imperial-guard": 58, outcast: 60, assassin: 64, chirurgeon: 66,
  desperado: 68, hierophant: 70, mystic: 72, sage: 74, seeker: 76,
  warrior: 78, "daemon-world": 28, "penal-colony": 30,
  "quarantine-world": 32, exorcised: 34, crusader: 36, "agri-world": 26,
  "feudal-world": 28, "frontier-world": 30, "adepta-sororitas": 32,
  mutant: 34, fanatic: 36, penitent: 38, "death-world": 28,
  "garden-world": 30, "research-station": 32, heretek: 34,
  "imperial-navy": 36, "rogue-trader-fleet": 38, ace: 40,
};

const homeWorld = (characteristics, fate, wounds, aptitude, bonus) => [
  ["Characteristics", characteristics],
  ["Fate", fate],
  ["Wounds", wounds],
  ["Aptitude", aptitude],
  ["Home World Bonus", bonus],
];
const background = (skills, talents, equipment, aptitude, bonus) => [
  ["Starting Skills", skills],
  ["Talents / Traits", talents],
  ["Starting Equipment", equipment],
  ["Aptitude Choice", aptitude],
  ["Background Bonus", bonus],
];
const role = (aptitudes, talent, bonus) => [
  ["Role Aptitudes", aptitudes],
  ["Talent Choice", talent],
  ["Role Bonus", bonus],
];

export const mechanicsByChoice = {
  "feral-world": homeWorld("+ Strength, + Toughness, - Influence", "2 · Blessing 3+", "9 + 1d5", "Toughness", "The Old Ways · Low-Tech weapons lose Primitive and gain Proven (3)."),
  "forge-world": homeWorld("+ Intelligence, + Toughness, - Fellowship", "3 · Blessing 8+", "8 + 1d5", "Intelligence", "Omnissiah’s Chosen · Gain Technical Knock or Weapon-Tech."),
  highborn: homeWorld("+ Fellowship, + Influence, - Toughness", "4 · Blessing 10+", "9 + 1d5", "Fellowship", "Breeding Counts · Influence reductions are reduced by 1, to a minimum of 1."),
  "hive-world": homeWorld("+ Agility, + Perception, - Willpower", "2 · Blessing 6+", "8 + 1d5", "Perception", "Teeming Masses · Ignore crowds for movement; +20 Navigate (Surface) in enclosed spaces."),
  "shrine-world": homeWorld("+ Fellowship, + Willpower, - Perception", "3 · Blessing 6+", "7 + 1d5", "Willpower", "Faith in the Creed · On a 1, a spent Fate point is not lost."),
  voidborn: homeWorld("+ Intelligence, + Willpower, - Strength", "3 · Blessing 5+", "7 + 1d5", "Intelligence", "Child of the Dark · Gain Strong Minded and +30 to movement tests in zero gravity."),
  "daemon-world": homeWorld("+ Willpower, + Perception, - Fellowship", "3 · Blessing 4+", "7 + 1d5", "Willpower", "Touched by the Warp · Psyniscience Known and 1d10+5 Corruption."),
  "penal-colony": homeWorld("+ Toughness, + Perception, - Influence", "3 · Blessing 8+", "10 + 1d5", "Toughness", "Finger on the Pulse · Common Lore (Underworld), Scrutiny, and Peer (Criminal Cartels)."),
  "quarantine-world": homeWorld("+ Ballistic Skill, + Intelligence, - Strength", "3 · Blessing 9+", "8 + 1d5", "Fieldcraft", "Secretive by Nature · Subtlety decreases by 2 less, minimum decrease 1."),
  "agri-world": homeWorld("+ Fellowship, + Strength, - Agility", "2 · Blessing 7+", "8 + 1d5", "Strength", "Strength from the Land · Gain Brutal Charge (2)."),
  "feudal-world": homeWorld("+ Perception, + Weapon Skill, - Intelligence", "3 · Blessing 6+", "9 + 1d5", "Weapon Skill", "At Home in Armour · Ignore armour’s maximum Agility value."),
  "frontier-world": homeWorld("+ Ballistic Skill, + Perception, - Fellowship", "3 · Blessing 7+", "7 + 1d5", "Ballistic Skill", "Rely on None but Yourself · +20 to personal weapon modification and +10 to repair damaged items."),
  "death-world": homeWorld("+ Agility, + Perception, - Fellowship", "2 · Blessing 5+", "9 + 1d5", "Fieldcraft", "Survivor’s Paranoia · Attackers gain no +30 against you while you are Surprised."),
  "garden-world": homeWorld("+ Fellowship, + Agility, - Toughness", "2 · Blessing 4+", "7 + 1d5", "Social", "Serenity of the Green · Halve Shock/Trauma duration; remove Insanity for 50 XP per point."),
  "research-station": homeWorld("+ Intelligence, + Perception, - Fellowship", "3 · Blessing 8+", "8 + 1d5", "Knowledge", "Pursuit of Data · Scholastic Lore +10 grants a related Forbidden Lore Known."),

  administratum: background("Commerce or Medicae; Common Lore (Administratum); High Gothic; Logic; one Scholastic Lore", "Weapon Training (Las or Solid Projectile)", "Laspistol or stub automatic; robes; autoquill; chrono; dataslate; medi-kit", "Knowledge or Social", "Master of Paperwork · All items count as one Availability level easier."),
  arbites: background("Awareness; Common Lore (Arbites, Underworld); Inquiry or Interrogation; Intimidate; Scrutiny", "Weapon Training (Shock or Solid Projectile)", "Shotgun or shock maul; light carapace or chestplate; stimm; manacles; lho sticks", "Offence or Defence", "Face of the Law · Reroll Intimidation and Interrogation; may use WP bonus as Degrees of Success."),
  "astra-telepathica": background("Awareness; Common Lore (Astra Telepathica); Deceive or Interrogation; Forbidden Lore (Warp); Psyniscience or Scrutiny", "Weapon Training (Las, Low-Tech)", "Laspistol; staff or whip; light flak cloak or vest; micro-bead or psy focus", "Defence or Psyker", "Constant Threat · Adjust nearby Psychic Phenomena by WP bonus. Tested on Terra can grant Sanctioned."),
  mechanicus: background("Awareness or one Operate; Common Lore (Mechanicus); Logic; Security; Tech-Use", "Mechadendrite Use (Utility); Weapon Training (Solid Projectile); Mechanicus Implants", "Autogun or hand cannon; servo-skull or optical mechadendrite; robes; sacred unguents", "Knowledge or Tech", "Replace the Weak Flesh · Cybernetics count as two Availability levels easier."),
  ministorum: background("Charm; Command; Common Lore (Ministorum); Inquiry or Scrutiny; High Gothic", "Weapon Training (Flame) or (Low-Tech, Solid Projectile)", "Hand flamer or warhammer and stub revolver; robes or flak vest; pack; glow-globe; laud-hailer skull", "Leadership or Social", "Faith is All · Spending Fate for +10 grants +20 instead."),
  "imperial-guard": background("Athletics; Command; Common Lore (Imperial Guard); Medicae or Operate (Surface); Navigate (Surface)", "Weapon Training (Las, Low-Tech)", "Lasgun or laspistol and sword; combat vest; Guard flak; grapnel; lho sticks; magnoculars", "Fieldcraft or Leadership", "Hammer of the Emperor · Reroll damage dice showing 1 or 2 against an ally’s recent target."),
  outcast: background("Acrobatics or Sleight of Hand; Common Lore (Underworld); Deceive; Dodge; Stealth", "Weapon Training (Chain, and Las or Solid Projectile)", "Autopistol or laspistol; chainsword; bodyglove or flak vest; injector; obscura or slaught", "Fieldcraft or Social", "Never Quit · Toughness bonus counts as 2 higher for Fatigue."),
  exorcised: background("Awareness; Deceive or Inquiry; Dodge; Forbidden Lore (Daemonology); Intimidate or Scrutiny", "Hatred (Daemons); Weapon Training (Solid Projectile, Chain); one starting Malignancy", "Pistol; shotgun; chainblade; robes; drugs; disguise or excruciator kit; rebreather; light", "Defence or Knowledge", "Touched by a Daemon · Insanity bonus counts 2 higher against Fear; same Daemon cannot possess you again."),
  "adepta-sororitas": background("Athletics; Charm or Intimidate; Common Lore (Sororitas); High Gothic; Medicae or Parry", "Weapon Training (Flame or Las, Chain)", "Hand flamer or laspistol; chainblade; bodyglove; chrono; dataslate; stablight; micro-bead", "Offence or Social", "Incorruptible Devotion · Corruption gained becomes that much Insanity minus 1 instead."),
  mutant: background("Acrobatics or Athletics; Awareness; Deceive or Intimidate; Forbidden Lore (Mutants); Survival", "Weapon Training (Low-Tech, Solid Projectile); one mutation trait; 10 Corruption and a starting mutation", "Shotgun or stub revolver and great weapon; grapnel; heavy leathers; combat vest; stimm", "Fieldcraft or Offence", "Twisted Flesh · May fail resistance to malignancy/mutation and take a mutation instead of a malignancy."),
  heretek: background("Deceive or Inquiry; one Forbidden Lore; Medicae or Security; Tech-Use; one Trade", "Weapon Training (Solid Projectile); Mechanicus Implants", "Stub revolver and special ammo; web grenade; combi-tool; flak cloak; plugs; de-tox; dataslate; light", "Finesse or Tech", "Master of Hidden Lores · +20 Tech-Use on unfamiliar devices with a relevant Forbidden Lore."),
  "imperial-navy": background("Athletics; Command or Intimidate; Common Lore (Navy); Navigate (Stellar); Operate (Aeronautica or Voidship)", "Weapon Training (Chain or Shock, Solid Projectile)", "Combat shotgun or hand cannon; chainsword or shock whip; flak coat; rebreather; micro-bead", "Offence or Tech", "Close Quarters Discipline · +1 Degree of Success on successful ranged tests at close ranges or in melee."),
  "rogue-trader-fleet": background("Charm or Scrutiny; Commerce; Common Lore (Rogue Traders); one alien language; Operate (Surface or Aeronautica)", "Weapon Training (Las or Solid Projectile, Shock)", "Compact laspistol or autopistol; shock maul; mesh cloak or chestplate; auspex; chrono", "Finesse or Social", "Inured to the Xenos · +10 Fear tests caused by aliens; +20 Interaction tests with aliens."),

  assassin: role("Agility; Ballistic Skill or Weapon Skill; Fieldcraft; Finesse; Perception", "Jaded or Leap Up", "Sure Kill · Spend Fate after a hit to add attack Degrees of Success to the first hit’s damage."),
  chirurgeon: role("Fieldcraft; Intelligence; Knowledge; Strength; Toughness", "Resistance (one) or Takedown", "Dedicated Healer · Spend Fate after failed First Aid to succeed with DoS equal to Intelligence bonus."),
  desperado: role("Agility; Ballistic Skill; Defence; Fellowship; Finesse", "Catfall or Quick Draw", "Move and Shoot · After a Move, make one Pistol Standard Attack as a Free Action once per round."),
  hierophant: role("Fellowship; Offence; Social; Toughness; Willpower", "Double Team or Hatred (one)", "Sway the Masses · Spend Fate to auto-succeed Charm, Command, or Intimidate with DoS equal to WP bonus."),
  mystic: role("Defence; Intelligence; Knowledge; Perception; Willpower", "Resistance (Psychic Powers) or Warp Sense", "Stare into the Warp · Begin with the Psyker elite advance; Willpower 35 recommended."),
  sage: role("Intelligence; Knowledge; Perception; Tech; Willpower", "Ambidextrous or Clues from the Crowds", "Quest for Knowledge · Spend Fate to auto-succeed Logic or Lore with DoS equal to Intelligence bonus."),
  seeker: role("Fellowship; Intelligence; Perception; Social; Tech", "Keen Intuition or Disarm", "Nothing Escapes My Sight · Spend Fate to auto-succeed Awareness or Inquiry with DoS equal to Perception bonus."),
  warrior: role("Ballistic Skill; Defence; Offence; Strength; Weapon Skill", "Iron Jaw or Rapid Reload", "Expert at Violence · Spend Fate to replace attack DoS with the relevant combat characteristic bonus."),
  crusader: role("Knowledge; Offence; Strength; Toughness; Willpower", "Bodyguard or Deny the Witch", "Smite the Unholy · Spend Fate to pass Fear; melee hits against Fear (X) gain +X damage and Penetration."),
  fanatic: role("Leadership; Offence; Toughness; Weapon Skill; Willpower", "Deny the Witch or Jaded", "Death to All Who Oppose Me! · Spend Fate to gain Hatred against the current foe for the encounter."),
  penitent: role("Agility; Fieldcraft; Intelligence; Offence; Toughness", "Die Hard or Flagellant", "Cleansing Pain · After suffering Damage, gain +10 to the first test before the end of your next turn."),
  ace: role("Agility; Finesse; Perception; Tech; Willpower", "Hard Target or Hotshot Pilot", "Right Stuff · Spend Fate to auto-succeed an Operate or vehicle/steed Survival test with DoS equal to Agility bonus."),
};

export function selectedEntry(scene, character) {
  if (!scene.catalog) return null;
  const field = scene.id;
  return catalogs[scene.catalog].find((entry) => entry.id === character[field]) || catalogs[scene.catalog][0];
}
