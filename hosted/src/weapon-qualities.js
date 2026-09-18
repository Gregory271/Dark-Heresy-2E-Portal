// Paraphrased from the locally supplied DH2 sourcebooks. Page numbers are printed pages.
const core = (page, summary) => ({ source: `Core Rulebook, p. ${page}`, summary });
export const weaponQualityRules = {
  accurate: core(145, 'With Aim, gain another +10 to hit. A single shot from a single Basic weapon with Aim adds 1d10 damage per two degrees of success beyond the first, up to 2d10. These extra dice cannot trigger Righteous Fury.'),
  balanced: core(145, 'Gain +10 to Parry tests with this weapon. Multiple Balanced weapons do not stack this bonus.'),
  blast: core(145, 'Everyone within X metres of the impact suffers one hit. Roll damage once for all affected targets. A missed shot scatters (p. 230).'),
  concussive: core(145, 'On a hit, the target tests Toughness at −10 × X. Failure causes Stunned for one round per degree of failure. If damage inflicted also exceeds the target’s Strength bonus, knock the target Prone.'),
  corrosive: core(145, 'On a hit, reduce armour at that location by 1d10 AP, cumulatively. Any reduction beyond the remaining AP becomes damage that ignores Toughness; against an unarmoured location, the whole roll becomes damage. Challenging (+0) Tech-Use can repair the armour.'),
  crippling: core(145, 'After suffering at least one wound, the target is Crippled until the encounter ends or all damage is healed. Taking more than a Half Action on a turn inflicts X Rending damage at the original location, ignoring Armour and Toughness.'),
  defensive: core(145, 'Gain +15 to Parry with this weapon, but suffer −10 on attacks with it. Individual weapon rules may override the attack penalty.'),
  felling: core(145, 'For this damage calculation, reduce the target’s Unnatural Toughness bonus by X. Do not reduce ordinary Toughness bonus.'),
  flame: core(145, 'Every target hit must pass an Agility test or catch fire, even if the attack deals no damage (fire: p. 243). For a vehicle, its pilot instead tests Operate, adding the armour value of the facing hit; failure sets the vehicle on fire (p. 263).'),
  flexible: core(145, 'Attacks with this weapon cannot be Parried. The weapon can itself still be used to Parry.'),
  force: core(145, 'Counts as a Best craftsmanship Mono version of the equivalent Low-Tech weapon. A psyker adds base Psy Rating to damage and penetration and deals Energy damage. After damaging a foe, a Half Action opposed Willpower Focus Power test can inflict another 1d10 Energy per degree of success, ignoring Armour and Toughness. Use base Psy Rating; this test cannot cause Psychic Phenomena. Power Fields cannot destroy Force weapons.'),
  graviton: core(146, 'Add the struck location’s Armour points to damage, or the facing’s AP for vehicles and cover. Vehicle Critical damage uses the Motive Systems table regardless of hit location.'),
  hallucinogenic: core(146, 'A struck creature tests Toughness at −10 × X; respirators or sealed armour grant +20. On failure, roll 1d10 on Hallucinogenic Effects (Table 5–3). The delusion lasts one round plus one round per degree of failure.'),
  haywire: core(147, 'Affects technology within X metres. Roll on Haywire Field Effects (Table 5–4), applying weapon modifiers. The field weakens one severity step each round until insignificant, except where the table specifies a duration. Overlapping fields use the stronger effect rather than stacking.'),
  inaccurate: core(147, 'Aim grants no benefit to attacks with this weapon.'),
  indirect: core(147, 'May attack a known location without line of sight, subject to GM judgement. Standard, Semi-Auto and Full Auto attacks take a Full Action and suffer −10. Each hit scatters 1d10 minus Ballistic Skill bonus metres (minimum zero); each missed potential hit scatters Xd10 metres. Roll directions on the Scatter Diagram (p. 230).'),
  lance: core(147, 'Add the base penetration once per degree of success. Total penetration is base penetration × (1 + degrees of success).'),
  maximal: core(147, 'Switch modes as a Free Action. Maximal adds 10m range, 1d10 damage and 2 penetration; increase Blast by 2 if present. It spends triple ammunition and gains Recharge. Standard mode uses the normal profile.'),
  melta: core(148, 'Double penetration at Short range or closer.'),
  overheats: core(148, 'An attack roll of 91+ overheats the weapon. It deals its Energy damage at Pen 0 to the holding arm (random arm if held in both hands), unless dropped as a Free Action. It cannot fire during the following round. It overheats instead of jamming.'),
  'power-field': core(148, 'After successfully Parrying a weapon without Power Field, roll 1d100: on 26+, destroy the attacking weapon. Force weapons, Warp Weapons and Natural Weapons are immune.'),
  primitive: core(148, 'Each damage die above X counts as X. A natural 10 can still trigger Righteous Fury before the cap is applied.'),
  proven: core(148, 'Each damage die below X counts as X.'),
  'razor-sharp': core(148, 'At three or more degrees of success, double penetration for all hits from that attack.'),
  recharge: core(148, 'After an attack, the weapon cannot attack again until the end of the next round: at most every other round.'),
  reliable: core(148, 'Only an unmodified attack roll of 100 jams this weapon. Reliable Spray weapons, and Reliable weapons without hit rolls, never jam.'),
  sanctified: core(148, 'Damage counts as Holy, which affects certain Daemons and other Warp entities according to their rules.'),
  scatter: core(148, 'At Point Blank range, gain +10 to hit and +3 damage. At Short range, gain +10 to hit. Beyond Short range, damage is reduced by 3.'),
  shocking: core(149, 'After at least 1 damage gets through Armour and Toughness, the target tests Toughness at Challenging (+0). Failure inflicts 1 Fatigue and Stunned for half the degrees of failure in rounds, rounded up.'),
  smoke: core(149, 'Creates smoke instead of damage, with a radius of X metres at impact. It lasts 1d10+10 rounds, less in adverse weather. Use the smoke visibility rules on p. 229.'),
  snare: core(149, 'A hit forces an Agility test at −10 × X. Failure Immobilises the target, who counts as Helpless and can only attempt escape: a Full Action Strength or Agility test at the same penalty.'),
  spray: core(149, 'No Ballistic Skill hit roll: targets in a 30° cone out to the listed range test Challenging (+0) Agility or take one Body hit. Targets gain +20 if the attacker lacks the weapon training, rising to +30 for an unbraced Heavy weapon. Only complete concealment protects as cover. A natural 9 on any damage die jams the weapon, unless Reliable. Called Shots are not allowed.'),
  storm: core(149, 'Double the hits inflicted and ammunition spent. In Full Auto, each degree of success adds two hits, up to the weapon’s firing rate as normal.'),
  tearing: core(150, 'Roll one extra damage die and discard the lowest die.'),
  toxic: core(150, 'At the end of a turn, a character damaged through Armour and Toughness by Toxic in the last round tests Toughness at −10 × X. Failure inflicts another 1d10 damage of the first Toxic weapon’s damage type. Individual toxins may add further effects.'),
  'twin-linked': core(150, 'Gain +20 to hit and spend twice the ammunition. A successful attack with at least two degrees of success adds one hit. Reload time is doubled when empty.'),
  unbalanced: core(150, 'Parry tests with this weapon suffer −10. It cannot make Lightning Attacks.'),
  unreliable: core(150, 'An attack roll of 91+ jams the weapon, including Semi-Auto and Full Auto attacks.'),
  unwieldy: core(150, 'Cannot be used to Parry or make Lightning Attacks.'),
  vengeful: core(150, 'A damage die showing X or higher, before modifiers, triggers Righteous Fury (p. 227).'),
  daemonbane: { source: 'Enemies Beyond, p. 40', summary: 'Against a target with the Daemonic trait, gain Vengeful (8) and ignore the target’s Toughness bonus when resolving damage.' },
  tainted: { source: 'Enemies Beyond, p. 40', summary: 'Add the higher of the wielder’s Corruption bonus or Daemonic (X) value to damage.' },
};

export function itemQualityEntries(item) {
  return Object.entries(item?.profile?.special || {}).filter(([, value]) => value !== false && value !== null && value !== undefined && value !== '').map(([key, value]) => {
    const normalized = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[ _]+/g, '-');
    let rule = weaponQualityRules[normalized];
    let name = normalized.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (normalized === 'two-handed') rule = { source: item.source || 'Weapon description', summary: 'Requires two hands to wield. Follow any exception in this weapon’s individual description.' };
    if (key === '!' && item.name === 'Hand Cannon') {
      name = 'Recoil';
      rule = core(155, 'Suffer −10 to Ballistic Skill attacks unless wielding the Hand Cannon in two hands or using a Recoil Glove.');
    }
    return { key: normalized, name: `${name}${value === true ? '' : ` (${value})`}`, value, source: rule?.source || item.source || '', summary: rule?.summary || 'No verified explanation is linked for this imported quality. Consult this item’s source entry before resolving it.' };
  });
}

export function actionsForItem(actions, itemId) {
  return actions.filter(action => action.test?.weaponId === itemId || action.equipmentId === itemId);
}
