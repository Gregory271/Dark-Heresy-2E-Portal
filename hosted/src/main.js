import { artByChoice, artFramingByChoice, artPageByChoice, catalogs, defaultCharacter, divinations, loreByChoice, mechanicsByChoice, scenes, selectedEntry, stageArtById } from "./data.js?v=0.10.4";
import { armoury } from "./armoury-data.js?v=0.8.1";
import { actionGroups, actionSource, combatActionCatalogue } from "./action-data.js?v=0.1.0";
import { talentCatalogue as baseTalentCatalogue } from "./talent-data.js?v=0.9.1";
import { reinforcementCatalogue, vehicleCatalogue } from "./reinforcement-data.js?v=0.1.0";
import {
  disciplineId,
  eliteAdvanceById,
  eliteAdvanceCatalogue,
  eliteTalentCatalogue,
  psychicDisciplines,
  psychicPowerById,
  psychicPowerCatalogue,
} from "./advancement-data.js?v=0.1.0";
import { characteristicRuleTerms, contextualRuleTerms, coreRuleTerms, creatorRuleTerms, ruleTermsById } from "./compendium-terms.js?v=0.4.2";
import {
  buildSourcebookLibrary,
  clearStoredSourcebookLibrary,
  loadStoredSourcebookLibrary,
  sourcebookRequirements,
} from "./sourcebook-library.js?v=0.4.0";
import {
  clearCampaignConnection,
  cloudIsConfigured,
  connectToCampaign,
  createSharedCampaign,
  deleteCloudCharacter,
  listCloudCharacters,
  saveCloudCharacter,
  savedCampaignConnection,
  subscribeToCloudCharacters,
} from "./cloud-storage.js?v=0.3.0";
import {
  aptitudeChoices,
  aptitudeMatches,
  characteristicAdvanceCosts,
  characteristics,
  rankNames,
  skillAdvanceCosts,
  skillSpecialities,
  specialistSkillIds,
  skills,
  parseCharacteristicModifiers,
  parseFate,
  parseWounds,
} from "./creation-data.js?v=0.8.0";
import {
  hatredSpecialities,
  malignancies,
  mentalDisorders,
  mutantStartingTraits,
  mutations,
  resistanceSpecialities,
  tableEntryById,
  tableEntryForRoll,
} from "./exceptional-data.js?v=0.1.0";

const talentCatalogue = [...baseTalentCatalogue, ...eliteTalentCatalogue];

const root = document.querySelector("#app");
const portalEmblem = `<img class="sigil" src="./public/assets/brand/pax-historia-emblem.png?v=0.1.0" alt="" aria-hidden="true" />`;
const hostedEdition = location.hostname.endsWith("github.io")
  || document.querySelector('meta[name="dh2-edition"]')?.content === "hosted";
document.documentElement.dataset.edition = hostedEdition ? "hosted" : "local";
const libraryStorageKey = "dh2-character-library";
const activeCharacterStorageKey = "dh2-active-character-id";
const repositorySaveTimers = new Map();
const cloudSaveTimers = new Map();
let repositoryStatus = "connecting";
let cloudStatus = cloudIsConfigured() ? "disconnected" : "unconfigured";
let cloudRefreshTimer = null;
const sheetDetailRecords = new Map();
let sheetDetailCounter = 0;
const currentActionRecords = new Map();
let actionRollSession = null;
let actionIndexState = {
  query: localStorage.getItem("dh2-action-query") || "",
  group: localStorage.getItem("dh2-action-group") || "All",
  fateOnly: localStorage.getItem("dh2-action-fate-only") === "true",
  showUnavailable: localStorage.getItem("dh2-action-show-unavailable") === "true",
};
const reviewTabStorageKey = "dh2-review-tab";
let reviewTabState = localStorage.getItem(reviewTabStorageKey) || "actions";
let armouryBrowserState = {
  query: "",
  category: "All",
  availability: "available",
};
const reinforcementState = {
  query: localStorage.getItem("dh2-reinforcement-query") || "",
  category: localStorage.getItem("dh2-reinforcement-category") || "All",
  selectedId: localStorage.getItem("dh2-reinforcement-selected") || "",
};

function characterId() {
  return globalThis.crypto?.randomUUID?.() || `acolyte-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function prepareCharacter(input = {}) {
  const prepared = { ...defaultCharacter, ...structuredClone(input || {}) };
  prepared.rolls ||= {};
  prepared.characteristicReroll ||= null;
  prepared.fate ||= {};
  prepared.wounds ||= {};
  prepared.divination ||= {};
  prepared.divination.statChoices ||= {};
  prepared.divination.resolutions ||= {};
  const hadExceptionalState = Boolean(prepared.exceptional);
  prepared.exceptional ||= {};
  prepared.exceptional.creationCorruptionApplied = Math.max(0, Number(prepared.exceptional.creationCorruptionApplied || 0));
  prepared.history ||= {};
  prepared.aptitudeReplacements ||= [];
  prepared.aptitudeSelections ||= {};
  prepared.grantChoices ||= {};
  prepared.acquisitions ||= [];
  prepared.equipment ||= {};
  prepared.equipment.inventory ||= [];
  prepared.equipment.characterCreationGrants ||= [];
  prepared.equipment.unlinkedCharacterCreationGrants ||= [];
  if (!Array.isArray(prepared.equipment.noCostGrants)) {
    prepared.equipment.noCostGrants = prepared.equipment.inventory
      .filter((id) => !prepared.acquisitions.includes(id));
  }
  prepared.equipment.noCostGrants = [...new Set(prepared.equipment.noCostGrants)]
    .filter((id) => prepared.equipment.inventory.includes(id) && !prepared.acquisitions.includes(id));
  const inventoryIds = new Set(prepared.equipment.inventory);
  const legacyEquipped = prepared.equipment.equipped || {};
  const itemForId = (id) => armoury.find((item) => item.id === id);
  const legacyReadied = [legacyEquipped.primary, legacyEquipped.secondary, legacyEquipped.melee].filter(Boolean);
  const legacyArmour = [legacyEquipped.armour].filter(Boolean);
  const legacyActiveGear = [legacyEquipped.utilityOne, legacyEquipped.utilityTwo]
    .filter((id) => {
      const item = itemForId(id);
      return item && !["Weapons", "Armour", "Weapon Mods"].includes(item.category);
    });
  prepared.equipment.readiedWeapons = [...new Set([
    ...(Array.isArray(prepared.equipment.readiedWeapons) ? prepared.equipment.readiedWeapons : []),
    ...legacyReadied,
  ])].filter((id) => inventoryIds.has(id) && itemForId(id)?.category === "Weapons");
  prepared.equipment.wornArmour = [...new Set([
    ...(Array.isArray(prepared.equipment.wornArmour) ? prepared.equipment.wornArmour : []),
    ...legacyArmour,
  ])].filter((id) => inventoryIds.has(id) && itemForId(id)?.category === "Armour");
  prepared.equipment.activeGear = [...new Set([
    ...(Array.isArray(prepared.equipment.activeGear) ? prepared.equipment.activeGear : []),
    ...legacyActiveGear,
  ])].filter((id) => {
    const item = itemForId(id);
    return inventoryIds.has(id) && item && !["Weapons", "Armour", "Weapon Mods"].includes(item.category);
  });
  prepared.equipment.weaponModAssignments = Object.fromEntries(
    Object.entries(prepared.equipment.weaponModAssignments || {}).filter(([modId, weaponId]) => (
      inventoryIds.has(modId)
      && inventoryIds.has(weaponId)
      && itemForId(modId)?.category === "Weapon Mods"
      && itemForId(weaponId)?.category === "Weapons"
    )),
  );
  delete prepared.equipment.equipped;
  prepared.equipment.selected ||= null;
  prepared.advances ||= { characteristics: {}, skills: {}, talents: [] };
  prepared.advances.characteristics ||= {};
  prepared.advances.skills ||= {};
  prepared.advances.specialistSkills ||= {};
  prepared.advances.talents ||= [];
  prepared.advances.psychicPowers ||= [];
  prepared.advances.eliteAdvances ||= [];
  prepared.advances.psyRating = Math.max(0, Number(prepared.advances.psyRating || 0));
  prepared.conditions ||= { insanity: 0, corruption: 0 };
  prepared.conditions.insanity = Math.max(0, Number(prepared.conditions.insanity || 0));
  prepared.conditions.corruption = Math.max(0, Number(prepared.conditions.corruption || 0));
  prepared.combat ||= {};
  prepared.combat.damage = Math.max(0, Number(prepared.combat.damage || 0));
  prepared.psychicFilters ||= { query: "", discipline: "All Powers", showUnavailable: true };
  prepared.psychicShopSelected ||= null;
  prepared.eliteShopSelected ||= null;
  prepared.eliteSetup ||= { gmApproved: {}, inquisitorLore: "", sisterWeapon: "", psykerCorruption: null, maleficApproved: false };
  prepared.eliteSetup.gmApproved ||= {};
  prepared.talentShopSelected ||= null;
  prepared.talentFilters ||= { query: "", tier: "All" };
  prepared.xp ||= {};
  prepared.xp.starting = Number.isFinite(Number(prepared.xp.starting))
    ? Math.max(0, Number(prepared.xp.starting))
    : 1000;
  prepared.xp.awards = Array.isArray(prepared.xp.awards)
    ? prepared.xp.awards.filter((entry) => Number(entry?.amount) > 0)
    : [];
  if (!hadExceptionalState && prepared.eliteSetup.psykerCorruption !== null) {
    prepared.exceptional.creationCorruptionApplied = Math.min(
      prepared.conditions.corruption,
      Math.max(0, Number(prepared.eliteSetup.psykerCorruption || 0)),
    );
  }
  return prepared;
}

function readCharacterLibrary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(libraryStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry) => entry?.id && entry?.character) : [];
  } catch {
    return [];
  }
}

let characterLibrary = readCharacterLibrary();
if (!characterLibrary.length) {
  let legacyCharacter = {};
  try {
    legacyCharacter = JSON.parse(localStorage.getItem("dh2-character") || "{}");
  } catch {
    legacyCharacter = {};
  }
  const now = new Date().toISOString();
  characterLibrary.push({
    id: characterId(),
    character: prepareCharacter(legacyCharacter),
    step: Number(sessionStorage.getItem("dh2-step") || 0),
    createdAt: now,
    updatedAt: now,
    origin: Object.keys(legacyCharacter).length ? "Migrated local character" : "Created locally",
  });
}

let activeCharacterId = localStorage.getItem(activeCharacterStorageKey);
if (!characterLibrary.some((entry) => entry.id === activeCharacterId)) activeCharacterId = characterLibrary[0].id;
let activeRecord = characterLibrary.find((entry) => entry.id === activeCharacterId);
let step = Math.min(scenes.length - 1, Math.max(0, Number(activeRecord?.step || 0)));
let character = prepareCharacter(activeRecord?.character);
syncCreationConsequences();
let appView = "roster";
let activeFloatingTooltipTarget = null;
let floatingTooltipListenersReady = false;

async function repositoryRequest(path = "", options = {}) {
  if (location.hostname.endsWith("github.io")) throw new Error("Local repository is not available on GitHub Pages.");
  const response = await fetch(`/api/characters${path}`, {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Local repository request failed (${response.status}).`);
  }
  return response.json();
}

async function initialiseLocalRepository() {
  if (hostedEdition) {
    repositoryStatus = "browser-only";
    localStorage.setItem(libraryStorageKey, JSON.stringify(characterLibrary));
    return;
  }
  try {
    const payload = await repositoryRequest();
    const repositoryRecords = Array.isArray(payload.characters) ? payload.characters : [];
    const merged = new Map(repositoryRecords.map((record) => [record.id, record]));
    for (const localRecord of characterLibrary) {
      const storedRecord = merged.get(localRecord.id);
      if (!storedRecord || String(localRecord.updatedAt || "") > String(storedRecord.updatedAt || "")) {
        merged.set(localRecord.id, localRecord);
        await repositoryRequest(`/${encodeURIComponent(localRecord.id)}`, {
          method: "PUT",
          body: JSON.stringify(localRecord),
        });
      }
    }
    characterLibrary = [...merged.values()];
    repositoryStatus = "ready";
  } catch (error) {
    console.warn("The local character repository is unavailable; browser backup remains active.", error);
    repositoryStatus = "browser-only";
  }

  if (!characterLibrary.length) {
    const now = new Date().toISOString();
    characterLibrary.push({
      id: characterId(),
      character: prepareCharacter(),
      step: 0,
      createdAt: now,
      updatedAt: now,
      origin: "Created locally",
    });
  }
  if (!characterLibrary.some((entry) => entry.id === activeCharacterId)) activeCharacterId = characterLibrary[0].id;
  activeRecord = characterLibrary.find((entry) => entry.id === activeCharacterId);
  step = Math.min(scenes.length - 1, Math.max(0, Number(activeRecord?.step || 0)));
  character = prepareCharacter(activeRecord?.character);
  localStorage.setItem(libraryStorageKey, JSON.stringify(characterLibrary));
}

function withTimeout(promise, milliseconds, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function mergeCloudRecords(records = []) {
  const merged = new Map(characterLibrary.map((record) => [record.id, record]));
  for (const remote of records) {
    const local = merged.get(remote.id);
    if (!local || String(remote.updatedAt || "") >= String(local.updatedAt || "")) merged.set(remote.id, remote);
  }
  characterLibrary = [...merged.values()];
  localStorage.setItem(libraryStorageKey, JSON.stringify(characterLibrary));
  if (appView === "roster") renderRoster();
}

async function refreshCloudRepository() {
  if (!savedCampaignConnection()) return;
  try {
    mergeCloudRecords(await withTimeout(
      listCloudCharacters(),
      10000,
      "The shared campaign did not respond within 10 seconds.",
    ));
    cloudStatus = "connected";
  } catch (error) {
    cloudStatus = "offline";
    console.warn("Shared campaign refresh failed; local copies remain available.", error);
  }
}

async function initialiseCloudRepository() {
  if (!cloudIsConfigured()) {
    cloudStatus = "unconfigured";
    return;
  }
  if (!savedCampaignConnection()) {
    cloudStatus = "disconnected";
    return;
  }
  cloudStatus = "connecting";
  await refreshCloudRepository();
  if (cloudStatus !== "connected") return;
  try {
    await subscribeToCloudCharacters(() => {
      clearTimeout(cloudRefreshTimer);
      cloudRefreshTimer = setTimeout(refreshCloudRepository, 120);
    });
  } catch (error) {
    console.warn("Live updates are unavailable; saves still synchronize.", error);
  }
}

async function persistRepositoryRecord(record) {
  try {
    await repositoryRequest(`/${encodeURIComponent(record.id)}`, {
      method: "PUT",
      body: JSON.stringify(record),
    });
    repositoryStatus = "ready";
  } catch (error) {
    repositoryStatus = "browser-only";
    console.warn("Character retained in browser backup because repository save failed.", error);
  }
}

async function persistCloudRecord(record) {
  try {
    await withTimeout(
      saveCloudCharacter(record),
      12000,
      "The shared campaign did not respond while saving.",
    );
    cloudStatus = "connected";
  } catch (error) {
    cloudStatus = "offline";
    console.warn("Shared save failed; local recovery copies remain current.", error);
  }
}

function queueRepositorySave(record) {
  if (repositoryStatus !== "browser-only") {
    clearTimeout(repositorySaveTimers.get(record.id));
    repositorySaveTimers.set(record.id, setTimeout(() => {
      repositorySaveTimers.delete(record.id);
      void persistRepositoryRecord(record);
    }, 180));
  }
  if (savedCampaignConnection()) {
    clearTimeout(cloudSaveTimers.get(record.id));
    cloudSaveTimers.set(record.id, setTimeout(() => {
      cloudSaveTimers.delete(record.id);
      void persistCloudRecord(record);
    }, 350));
  }
}

function flushActiveCharacterSaves() {
  const record = characterLibrary.find((entry) => entry.id === activeCharacterId);
  if (!record) return;
  if (repositoryStatus !== "browser-only") {
    clearTimeout(repositorySaveTimers.get(record.id));
    repositorySaveTimers.delete(record.id);
    void persistRepositoryRecord(record);
  }
  if (savedCampaignConnection()) {
    clearTimeout(cloudSaveTimers.get(record.id));
    cloudSaveTimers.delete(record.id);
    void persistCloudRecord(record);
  }
}

async function deleteRepositoryRecord(id) {
  clearTimeout(repositorySaveTimers.get(id));
  repositorySaveTimers.delete(id);
  clearTimeout(cloudSaveTimers.get(id));
  cloudSaveTimers.delete(id);
  try {
    await repositoryRequest(`/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    console.warn("Repository delete could not be completed.", error);
  }
  try {
    await withTimeout(
      deleteCloudCharacter(id),
      12000,
      "The shared campaign did not respond while deleting.",
    );
  } catch (error) {
    console.warn("Shared character delete could not be completed.", error);
  }
}

const talentAdvanceCosts = {
  1: [600, 300, 200],
  2: [900, 450, 300],
  3: [1200, 600, 400],
};

function talentCost(talent) {
  const matches = aptitudeMatches(talent.aptitudes, resolvedAptitudes().aptitudes);
  return talentAdvanceCosts[talent.tier]?.[matches] ?? 0;
}

function talentByName(value = "") {
  const target = normaliseItemName(value).replace(/\s+\(.+$/, "");
  return talentCatalogue.find((talent) => normaliseItemName(talent.name) === target)
    || talentCatalogue.find((talent) => target.startsWith(normaliseItemName(talent.name)));
}

function migrateLegacyTalents() {
  character.advances.talents = character.advances.talents.map((entry) => {
    if (entry?.id && talentCatalogue.some((talent) => talent.id === entry.id)) return entry;
    const match = talentByName(entry?.name || "");
    return match ? { id: match.id, name: match.name, cost: talentCost(match), source: "XP" } : entry;
  });
}

function normaliseItemName(value = "") {
  return value.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|for|with|common craftsmanship)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtmlAttribute(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cleanRulesSummary(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^Consult .+? for the complete rules text\.?$/i, "Rules summary is not yet recorded.")
    .trim();
}

function visibleSheetSummary(value = "", maximumLength = 220) {
  const text = cleanRulesSummary(value);
  if (text.length <= maximumLength) return text;
  const candidate = text.slice(0, maximumLength + 1);
  const sentenceEnd = candidate.lastIndexOf(". ");
  const wordEnd = candidate.lastIndexOf(" ");
  const cut = sentenceEnd >= maximumLength * 0.55 ? sentenceEnd + 1 : wordEnd;
  return `${candidate.slice(0, Math.max(1, cut)).trim()}…`;
}

function registerSheetDetail({ kind = "Character Record", name, summary = "", source = "", rows = [] }) {
  const id = `sheet-detail-${sheetDetailCounter += 1}`;
  sheetDetailRecords.set(id, {
    kind,
    name: String(name || "Record Details"),
    summary: cleanRulesSummary(summary),
    source: String(source || ""),
    rows: rows.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== ""),
  });
  return id;
}

function sheetDetailButton(record) {
  const id = registerSheetDetail(record);
  return `<button class="sheet-entry-details" type="button" data-sheet-detail="${id}" aria-label="View ${escapeHtmlAttribute(record.name)} details">Details</button>`;
}

function renderSheetEntry({ kind, name, summary, meta = "", source = "", rows = [] }) {
  const safeSummary = cleanRulesSummary(summary) || "No additional effect is recorded.";
  return `<div class="sheet-entry">
    <strong>${escapeHtmlAttribute(name)}</strong>
    <span class="sheet-entry-summary">${escapeHtmlAttribute(visibleSheetSummary(safeSummary))}</span>
    <span class="sheet-entry-meta">${meta ? `<em>${escapeHtmlAttribute(meta)}</em>` : ""}${sheetDetailButton({ kind, name, summary: safeSummary, source, rows })}</span>
  </div>`;
}

function renderInventorySheetEntry(item, provenance, ownedWeapons) {
  const safeSummary = itemRulesSummary(item) || "No additional effect is recorded.";
  const rows = [
    ["Category", item.category],
    ["Availability", effectiveAvailability(item)],
    ["Craftsmanship", item.craftsmanship],
    ["Weight", displayWeight(item)],
    ...itemProfileRows(item),
  ];
  return `<div class="sheet-entry inventory-sheet-entry">
    <span class="inventory-item-identity"><strong>${escapeHtmlAttribute(item.name)}</strong><small>${escapeHtmlAttribute(item.category)}</small><em>${escapeHtmlAttribute(provenance.label)}</em></span>
    <span class="sheet-entry-summary">${escapeHtmlAttribute(visibleSheetSummary(safeSummary))}</span>
    <span class="sheet-entry-meta">${reviewInventoryControl(item, ownedWeapons)}${sheetDetailButton({ kind: item.category, name: item.name, summary: safeSummary, source: item.source, rows })}</span>
  </div>`;
}

function findLegacyArmouryItem(value) {
  const target = normaliseItemName(value);
  if (!target) return null;
  const exact = armoury.find((item) => normaliseItemName(item.name) === target);
  if (exact) return exact;
  const contained = armoury
    .filter((item) => {
      const candidate = normaliseItemName(item.name);
      return candidate.length >= 4 && (target.includes(candidate) || candidate.includes(target));
    })
    .sort((a, b) => normaliseItemName(b.name).length - normaliseItemName(a.name).length)[0];
  if (contained) return contained;
  const targetTokens = new Set(target.split(" "));
  return armoury
    .map((item) => {
      const tokens = new Set(normaliseItemName(item.name).split(" "));
      const overlap = [...targetTokens].filter((token) => tokens.has(token)).length;
      return { item, score: overlap / Math.max(1, Math.min(targetTokens.size, tokens.size)) };
    })
    .sort((a, b) => b.score - a.score)
    .find((entry) => entry.score >= 0.75)?.item || null;
}

const grantedEquipmentAliases = {
  autoquill: "Auto Quill",
  robes: "Imperial Robes",
  "light carapace": "Enforcer Light Carapace",
  chestplate: "Carapace Chestplate",
  vest: "Flak Vest",
  "servo skull": "Monotask Servo-Skull",
  "optical mechadendrite": "Mechadendrite",
  "guard flak": "Imperial Guard Flak Armour",
  grapnel: "Grapnel and Line",
  bodyglove: "Armoured Bodyglove",
  injector: "Inhaler/Injector",
  pack: "Backpack",
  "glow globe": "Glow-globe/stab light",
  stablight: "Glow-globe/stab light",
  "laud hailer skull": "Laud Hailer",
  disguise: "Disguise Kit",
  light: "Glow-globe/stab light",
  plugs: "Filtration Plugs",
  "combat shotgun": "Shotgun (Combat)",
  auspex: "Auspex/Scanner",
};

const compositeEquipmentGrants = {
  "compact laspistol": ["Laspistol", "Compact"],
  "compact autopistol": ["Autopistol", "Compact"],
};

function armouryItemWithExactName(value = "") {
  const target = normaliseItemName(value);
  const alias = grantedEquipmentAliases[target];
  const resolvedTarget = normaliseItemName(alias || value);
  return armoury.find((item) => normaliseItemName(item.name) === resolvedTarget) || null;
}

function expandGrantedEquipmentLabel(value = "") {
  const target = normaliseItemName(value);
  if (compositeEquipmentGrants[target]) return compositeEquipmentGrants[target];
  if (armouryItemWithExactName(value)) return [value];
  return value.split(/\s+and\s+/i).map((entry) => entry.trim()).filter(Boolean);
}

function resolvedGrantedEquipment() {
  const background = catalogs.backgrounds.find((entry) => entry.id === character.background);
  const sourceName = background?.name || "Selected Background";
  const entries = [];
  splitGrant(ruleValue(character.background, "Starting Equipment")).forEach((grantText, index) => {
    const choiceId = `background-equipment-${index}`;
    const isChoice = /\sor\s/i.test(grantText);
    const selectedText = isChoice ? character.grantChoices[choiceId] : grantText;
    if (!selectedText) {
      entries.push({
        key: `${choiceId}-unresolved`,
        label: grantText,
        sourceType: "background-choice",
        sourceName,
        choiceId,
        unresolvedChoice: true,
      });
      return;
    }
    expandGrantedEquipmentLabel(selectedText).forEach((label, itemIndex) => {
      const item = armouryItemWithExactName(label);
      entries.push({
        key: `${choiceId}-${itemIndex}`,
        label,
        listedAs: selectedText,
        item,
        itemId: item?.id || "",
        sourceType: isChoice ? "background-choice" : "background-grant",
        sourceName,
        choiceId: isChoice ? choiceId : "",
        unresolvedChoice: false,
      });
    });
  });
  if (hasEliteAdvance("sister-of-battle")) {
    ["Adepta Sororitas Power Armour", character.eliteSetup.sisterWeapon].filter(Boolean).forEach((label, index) => {
      const item = armouryItemWithExactName(label);
      entries.push({
        key: `elite-sister-of-battle-${index}`,
        label,
        listedAs: label,
        item,
        itemId: item?.id || "",
        sourceType: "elite-grant",
        sourceName: "Sister of Battle Elite Advance",
        choiceId: index === 1 ? "elite-sister-weapon" : "",
        unresolvedChoice: false,
      });
    });
  }
  return { sourceName, entries };
}

function syncGrantedEquipment() {
  if (!character?.equipment) return;
  const grants = resolvedGrantedEquipment();
  const previousIds = new Set(character.equipment.characterCreationGrants || []);
  const currentIds = new Set(grants.entries.map((entry) => entry.itemId).filter(Boolean));

  for (const previousId of previousIds) {
    if (currentIds.has(previousId)) continue;
    if (!character.acquisitions.includes(previousId) && !character.equipment.noCostGrants.includes(previousId)) {
      character.equipment.inventory = character.equipment.inventory.filter((entry) => entry !== previousId);
      removeEquipmentState(previousId);
    }
  }

  for (const itemId of currentIds) {
    if (!character.equipment.inventory.includes(itemId)) character.equipment.inventory.push(itemId);
    character.acquisitions = character.acquisitions.filter((entry) => entry !== itemId);
    character.equipment.noCostGrants = character.equipment.noCostGrants.filter((entry) => entry !== itemId);
  }

  character.equipment.characterCreationGrants = [...currentIds];
  character.equipment.unlinkedCharacterCreationGrants = grants.entries
    .filter((entry) => !entry.item && !entry.unresolvedChoice)
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      listedAs: entry.listedAs,
      sourceType: entry.sourceType,
      sourceName: entry.sourceName,
      choiceId: entry.choiceId,
    }));
}

function equipmentProvenance(itemId, grants = resolvedGrantedEquipment()) {
  const creationGrant = grants.entries.find((entry) => entry.itemId === itemId);
  if (creationGrant) {
    return {
      type: creationGrant.sourceType,
      label: creationGrant.sourceType === "background-choice"
        ? `Chosen from ${creationGrant.sourceName}`
        : `Granted by ${creationGrant.sourceName}`,
      detail: creationGrant.sourceType === "background-choice"
        ? `${creationGrant.sourceName} starting-equipment choice`
        : `${creationGrant.sourceName} starting equipment`,
      grant: creationGrant,
    };
  }
  if (character.acquisitions.includes(itemId)) {
    return { type: "starting-acquisition", label: "Starting acquisition · 1 slot", detail: "Purchased with one starting acquisition" };
  }
  if (character.equipment.noCostGrants.includes(itemId)) {
    return { type: "gm-grant", label: "GM grant · no cost", detail: "Added without XP, currency, or an acquisition slot" };
  }
  return { type: "inventory", label: "Inventory", detail: "Inventory source not recorded" };
}

function migrateLegacyEquipment() {
  if (!character.acquisitions.some((entry) => entry && !armoury.some((item) => item.id === entry))) return;
  const migrated = [];
  const unresolved = [];
  for (const entry of character.acquisitions.filter(Boolean)) {
    if (armoury.some((item) => item.id === entry)) {
      migrated.push(entry);
      continue;
    }
    const match = findLegacyArmouryItem(String(entry));
    if (match) migrated.push(match.id);
    else unresolved.push(String(entry));
  }
  character.acquisitions = [...new Set(migrated)];
  character.equipment.legacyAcquisitions = unresolved;
  for (const id of character.acquisitions) {
    if (!character.equipment.inventory.includes(id)) character.equipment.inventory.push(id);
  }
}

migrateLegacyEquipment();
migrateLegacyTalents();
save();

const soundtrack = new Audio(hostedEdition ? "" : "./public/assets/audio/dark-heresy-ambient-mix.mp3?v=0.6.0");
soundtrack.loop = true;
const savedVolume = Number(localStorage.getItem("dh2-soundtrack-volume"));
soundtrack.volume = Number.isFinite(savedVolume) ? Math.min(1, Math.max(0, savedVolume)) : 0.22;
soundtrack.preload = "metadata";
let soundtrackPlaying = false;
let lockAudioContext;
let diceBox;
let diceBoxReady;
let textScale = Math.min(1.6, Math.max(0.8, Number(localStorage.getItem("dh2-text-scale")) || 1));
let pendingFocusSelector = "";
let compendiumData = null;
let compendiumLoadError = "";
let compendiumImporting = false;
let compendiumImportProgress = "";
let compendiumSearchTimer;
let compendiumWordFrequency = new Map();
let compendiumSearchIndex = [];
const compendiumChapterHtmlCache = new Map();
const collapsedWordCache = new Map();
const expandedWordCache = new Map();
const compendiumState = {
  query: "",
  book: "all",
  chapter: "All",
  selectedBook: "core",
  selectedPage: 22,
};
function applyTextScale(scope = root) {
  const surface = scope?.querySelectorAll ? scope : root;
  const previouslyScaled = [...surface.querySelectorAll("[data-access-font]")];
  previouslyScaled.forEach((element) => element.style.removeProperty("font-size"));
  surface.querySelectorAll(".content.is-overflowing").forEach((element) => element.classList.remove("is-overflowing"));

  const excludedTags = new Set(["SCRIPT", "STYLE", "SVG", "PATH", "CANVAS"]);
  const formTags = new Set(["BUTTON", "INPUT", "TEXTAREA", "SELECT", "OUTPUT"]);
  const compactTextSelector = [
    "small",
    "dt",
    ".eyebrow",
    ".choice-source",
    ".selection-state",
    ".brand span",
    ".roster-button",
    ".text-button",
    ".compact-button",
    ".facts dt",
    ".identity-form label span",
    ".record span",
    ".mechanics-panel dd",
    ".management-heading",
    ".manual-result",
    ".rules-footnote",
    ".applied-change span",
    ".divination-choice span",
    ".replacement-grid label",
    ".acquisition-list label",
    ".grant-panel p",
    ".grant-entry",
    ".grant-choice-list label",
    ".granted-line",
    ".legacy-warning",
    ".carrying-summary span",
    ".carrying-summary small",
    ".equipment-rule-alerts p",
    ".equipment-state-heading span",
    ".equipment-check-list small",
    ".modification-entry small",
    ".carried-equipment-entry > span",
    ".carried-equipment-entry label",
    ".carried-equipment-entry label span",
    ".armoury-item span",
    ".armoury-item em",
    ".item-profile dd",
    ".acquisition-heading span",
    ".inventory-record-heading span",
    ".inventory-entry",
    ".xp-meter span",
    ".advance-warning span",
    ".advance-nav button",
    ".advance-rows label",
    ".specialist-skill-intro > p",
    ".specialist-family-heading small",
    ".specialist-family-heading > span",
    ".specialist-skill-records strong",
    ".specialist-skill-records small",
    ".specialist-skill-add label",
    ".talent-filters button",
    ".talent-row span",
    ".talent-row em",
    ".talent-cost span",
    ".talent-inspector dt",
    ".other-advances label",
    ".elite-select-copy p",
    ".elite-select-control span",
    ".automatic-elite-compact span",
    ".review-characteristics span",
    ".calculation-note",
    ".review-meta",
    ".review-vital-heading span",
    ".review-vital-heading small",
    ".wounds-total small",
    ".wounds-controls label span",
    ".wounds-critical",
    ".armour-location span",
    ".armour-location small",
    ".review-armour-card > p",
    ".review-record-state",
    ".review-status-card > span",
    ".review-status-card > small",
    ".review-movement-card b small",
    ".review-summary-card > h3",
    ".review-workspace-tabs button",
    ".review-tab-select",
    ".review-skill-label",
    ".action-index-counts",
    ".action-index-counts span",
    ".action-index-counts em",
    ".action-search span",
    ".action-filter-list button",
    ".action-filter-list button > span",
    ".show-unavailable",
    ".action-index-notice",
    ".action-group-tag",
    ".action-group-tag > span",
    ".action-type-caption",
    ".action-context",
    ".action-test-preview",
    ".action-card footer small",
    ".dossier-list strong",
    ".dossier-list span",
    ".dossier-list em",
    ".dossier-list p",
    ".xp-ledger div",
    ".advancement-balance span",
    ".xp-award-form p",
    ".xp-award-form label > span",
    ".advancement-manager-actions button span",
    ".roster-card-heading span",
    ".roster-progress small",
    ".text-size-control",
    ".volume-control",
    ".roster-footer",
    ".compendium-provenance",
    ".compendium-page-headings",
    ".source-note",
    ".credit-small",
    ".artist-credits p",
  ].join(",");
  const isPhone = window.matchMedia("(max-width: 640px)").matches;
  const isCompactViewport = window.matchMedia("(max-width: 800px)").matches;

  // Select the responsive text mode before measuring computed font sizes.
  // This keeps threshold changes deterministic whether the slider is moved
  // gradually or jumps directly to a new value.
  document.documentElement.dataset.textSize = textScale >= 1.4
    ? "extra-large"
    : textScale >= 1.15
      ? "large"
      : textScale >= 0.95
        ? "medium"
        : "normal";

  [...surface.querySelectorAll("*")]
    .filter((element) => {
      if (excludedTags.has(element.tagName)) return false;
      if (element.getAttribute("aria-hidden") === "true") return false;
      const hasDirectText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
      );
      return hasDirectText || formTags.has(element.tagName);
    })
    .forEach((element) => {
      const computedSize = Number.parseFloat(getComputedStyle(element).fontSize);
      if (!Number.isFinite(computedSize) || computedSize <= 0) return;
      const compact = element.matches(compactTextSelector);
      const secondaryDetail = element.matches(".item-origin");
      const minimumSize = secondaryDetail
        ? (isPhone ? 13 : 12)
        : isPhone
          ? (compact ? 13 : 16)
          : isCompactViewport
            ? (compact ? 14 : 16)
            : (compact ? 14 : 18);
      const baseSize = Math.max(computedSize, minimumSize);
      const scaledSize = baseSize * textScale;
      const phoneHeadingCap = Math.max(56, Math.min(78, window.innerWidth * 0.145));
      const finalSize = isPhone && element.matches("h1")
        ? Math.min(scaledSize, phoneHeadingCap)
        : scaledSize;
      element.dataset.accessFont = "";
      element.style.fontSize = `${finalSize.toFixed(2)}px`;
    });

  requestAnimationFrame(() => {
    root.querySelectorAll(".content:not(.management-content)").forEach((element) => {
      element.classList.toggle("is-overflowing", element.scrollHeight > element.clientHeight + 2);
    });
  });
}

let textResizeTimer;
window.addEventListener("resize", () => {
  window.clearTimeout(textResizeTimer);
  textResizeTimer = window.setTimeout(applyTextScale, 100);
});
document.addEventListener("visibilitychange", () => {
  document.documentElement.classList.toggle("page-paused", document.hidden);
  if (document.hidden) flushActiveCharacterSaves();
});
window.addEventListener("pagehide", flushActiveCharacterSaves);

function playMechanicalLock() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  lockAudioContext ||= new AudioContext();
  const context = lockAudioContext;
  if (context.state === "suspended") context.resume().catch(() => {});
  const now = context.currentTime;
  const level = 0.09 + soundtrack.volume * 0.12;
  const master = context.createGain();
  master.gain.setValueAtTime(level, now);
  master.connect(context.destination);

  function noiseStrike(at, duration, frequency, q, gainAmount) {
    const frames = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      const decay = 1 - index / frames;
      samples[index] = (Math.random() * 2 - 1) * decay * decay;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = context.createGain();
    gain.gain.setValueAtTime(gainAmount, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(at);
  }

  function metalTick(at, frequency, duration, gainAmount) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(gainAmount, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration);
  }

  // Bolt slides, teeth catch, then the assembly stops hard.
  noiseStrike(now, 0.028, 2450, 0.7, 0.8);
  metalTick(now + 0.004, 1850, 0.018, 0.25);
  noiseStrike(now + 0.034, 0.018, 4100, 1.4, 0.55);
  metalTick(now + 0.038, 980, 0.014, 0.22);
  noiseStrike(now + 0.061, 0.042, 170, 0.55, 1);
  noiseStrike(now + 0.064, 0.022, 3200, 1.1, 0.48);
}

function ensureDiceLayer() {
  let layer = document.querySelector("#dice-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "dice-layer";
    layer.innerHTML = `<div id="dice-box"></div><p class="dice-status">Resolving roll…</p>`;
    document.body.append(layer);
  }
  return layer;
}

async function ensureDiceBox() {
  if (diceBoxReady) return diceBoxReady;
  const layer = ensureDiceLayer();
  layer.classList.add("visible", "loading");
  diceBoxReady = import("../public/vendor/dice-box/dice-box.es.js").then(async ({ default: DiceBox }) => {
    diceBox = new DiceBox({
      container: "#dice-box",
      assetPath: new URL("../public/assets/", import.meta.url).href,
      theme: "default",
      themeColor: "#7e2320",
      offscreen: true,
      scale: 7,
      gravity: 1.4,
      mass: 1.25,
      friction: 0.72,
      restitution: 0.3,
      spinForce: 7,
      throwForce: 8,
    });
    await diceBox.init();
    layer.classList.remove("loading");
    return diceBox;
  }).catch((error) => {
    layer.classList.remove("visible", "loading");
    diceBoxReady = null;
    throw error;
  });
  return diceBoxReady;
}

async function rollVisualDice(quantity, sides = 10) {
  if (hostedEdition) {
    const layer = ensureDiceLayer();
    const diceSurface = layer.querySelector("#dice-box");
    diceSurface.innerHTML = Array.from(
      { length: quantity },
      () => `<span class="flat-die" aria-hidden="true">?</span>`,
    ).join("");
    document.documentElement.classList.add("dice-active");
    layer.classList.add("visible", "flat-dice-active");
    layer.querySelector(".dice-status").textContent = `Rolling ${quantity}d${sides}…`;
    await new Promise((resolve) => window.setTimeout(resolve, 620));
    const values = Array.from({ length: quantity }, () => {
      const random = new Uint32Array(1);
      globalThis.crypto.getRandomValues(random);
      return (random[0] % sides) + 1;
    });
    diceSurface.querySelectorAll(".flat-die").forEach((die, index) => {
      die.textContent = values[index];
      die.classList.add("resolved");
    });
    layer.querySelector(".dice-status").textContent = values.join(" + ");
    window.setTimeout(() => {
      layer.classList.remove("visible", "flat-dice-active");
      diceSurface.replaceChildren();
      document.documentElement.classList.remove("dice-active");
    }, 1500);
    return values;
  }
  const layer = ensureDiceLayer();
  const box = await ensureDiceBox();
  box.show();
  document.documentElement.classList.add("dice-active");
  layer.classList.add("visible");
  layer.querySelector(".dice-status").textContent = `Rolling ${quantity}d${sides}…`;
  const results = await box.roll(`${quantity}d${sides}`);
  const values = results.flatMap((result) =>
    result.rolls ? result.rolls.map((roll) => Number(roll.value)) : [Number(result.value)]);
  layer.querySelector(".dice-status").textContent = values.join(" + ");
  window.setTimeout(() => {
    layer.classList.remove("visible");
    box.clear();
    box.hide();
    document.documentElement.classList.remove("dice-active");
  }, 1500);
  return values;
}

function ruleValue(choiceId, label) {
  return mechanicsByChoice[choiceId]?.find(([rowLabel]) => rowLabel === label)?.[1] || "";
}

function homeWorldRules() {
  return {
    modifiers: parseCharacteristicModifiers(ruleValue(character.homeWorld, "Characteristics")),
    fate: parseFate(ruleValue(character.homeWorld, "Fate")),
    wounds: parseWounds(ruleValue(character.homeWorld, "Wounds")),
    aptitude: ruleValue(character.homeWorld, "Aptitude"),
  };
}

function characteristicRollConfig(characteristicId) {
  const modifier = homeWorldRules().modifiers[characteristicId] || 0;
  return {
    modifier,
    quantity: modifier === 0 ? 2 : 3,
    keep: modifier > 0 ? "highest" : modifier < 0 ? "lowest" : "all",
  };
}

function calculateCharacteristic(dice, config) {
  const sorted = [...dice].sort((a, b) => a - b);
  const kept = config.keep === "highest"
    ? sorted.slice(-2)
    : config.keep === "lowest"
      ? sorted.slice(0, 2)
      : sorted;
  return { kept, value: kept.reduce((sum, die) => sum + die, 20) };
}

function divinationFor(value) {
  return divinations.find((entry) => value >= entry.min && value <= entry.max);
}

function currentDivination() {
  return divinationFor(Number(character.divination?.roll || 0));
}

function selectedDivinationTalentLabel() {
  const grant = currentDivination()?.talentGrant;
  if (!grant) return "";
  if (grant.choice === "hatred") return character.divination.resolutions?.talentSpeciality ? `Hatred (${character.divination.resolutions.talentSpeciality})` : "";
  if (grant.choice === "resistance") return character.divination.resolutions?.talentSpeciality ? `Resistance (${character.divination.resolutions.talentSpeciality})` : "";
  return grant.label;
}

function selectedMalignancyRecord(source) {
  const id = source === "divination"
    ? character.divination.resolutions?.malignancyId
    : character.exceptional?.startingMalignancyId;
  return tableEntryById(malignancies, id);
}

function selectedMutationRecord() {
  return tableEntryById(mutations, character.exceptional?.mutationId);
}

function exceptionalCharacteristicModifiers() {
  const modifiers = {};
  const add = (target, amount) => {
    if (!target || !Number.isFinite(Number(amount))) return;
    modifiers[target] = (modifiers[target] || 0) + Number(amount);
  };
  for (const [source, magnitudeKey] of [["divination", "malignancyMagnitude"], ["starting", "startingMalignancyMagnitude"]]) {
    const entry = selectedMalignancyRecord(source);
    if (entry?.characteristicRoll) {
      const magnitude = source === "divination"
        ? Number(character.divination.resolutions?.[magnitudeKey] || 0)
        : Number(character.exceptional?.[magnitudeKey] || 0);
      if (magnitude) add(entry.characteristicRoll.target, magnitude * entry.characteristicRoll.sign);
    }
  }
  const mutation = selectedMutationRecord();
  Object.entries(mutation?.characteristicChanges || {}).forEach(([target, amount]) => add(target, amount));
  if (mutation?.characteristicRoll) {
    const magnitude = Number(character.exceptional?.mutationMagnitude || 0);
    if (magnitude) add(mutation.characteristicRoll.target, magnitude * mutation.characteristicRoll.sign);
  }
  return modifiers;
}

function desiredCreationCorruption() {
  const mutant = character.background === "mutant" ? 10 : 0;
  const daemonWorld = character.homeWorld === "daemon-world" ? Number(character.exceptional?.daemonWorldCorruption || 0) : 0;
  const roguePsyker = hasEliteAdvance("psyker") && character.background !== "astra-telepathica"
    ? Number(character.eliteSetup?.psykerCorruption || 0)
    : 0;
  return mutant + daemonWorld + roguePsyker;
}

function syncCreationConsequences() {
  character.exceptional ||= {};
  character.conditions ||= { insanity: 0, corruption: 0 };
  const previous = Math.max(0, Number(character.exceptional.creationCorruptionApplied || 0));
  const desired = Math.max(0, desiredCreationCorruption());
  character.conditions.corruption = Math.max(0, Number(character.conditions.corruption || 0) - previous + desired);
  character.exceptional.creationCorruptionApplied = desired;
}

function divinationCharacteristicModifiers() {
  const modifiers = {};
  const choices = character.divination?.statChoices || {};
  for (const change of currentDivination()?.statChanges || []) {
    const target = change.target || choices[change.id];
    if (!target) continue;
    modifiers[target] = (modifiers[target] || 0) + Number(change.amount || 0);
  }
  const conditional = currentDivination()?.skillGrant?.ifKnownStat;
  if (conditional && backgroundGrantedSkills()[currentDivination().skillGrant.id]) {
    modifiers[conditional.target] = (modifiers[conditional.target] || 0) + conditional.amount;
  }
  const talentGrant = currentDivination()?.talentGrant;
  if (talentGrant?.fallback && divinationTalentAlreadyOwned()) {
    const { target, amount } = talentGrant.fallback;
    modifiers[target] = (modifiers[target] || 0) + amount;
  }
  return modifiers;
}

function characteristicBreakdown(characteristicId) {
  const generated = Number(character.rolls[characteristicId]?.value || 0);
  const advanceRanks = Number(character.advances.characteristics[characteristicId] || 0);
  const advancement = advanceRanks * 5;
  const divination = divinationCharacteristicModifiers()[characteristicId] || 0;
  const exceptional = exceptionalCharacteristicModifiers()[characteristicId] || 0;
  const beforeElite = generated + advancement + divination + exceptional;
  const elite = hasEliteAdvance("untouchable") && characteristicId === "fellowship"
    ? Math.floor(beforeElite / 2) - beforeElite
    : 0;
  return {
    generated,
    advancement,
    divination,
    exceptional,
    elite,
    total: beforeElite + elite,
  };
}

function characteristicValue(characteristicId) {
  return characteristicBreakdown(characteristicId).total;
}

function finalFateThreshold() {
  const fated = character.advances?.talents?.some((entry) => entry.id === "elite-inquisitor-fated") ? 1 : 0;
  return Number(character.fate?.threshold || 0) + Number(currentDivination()?.fateChange || 0) + fated;
}

function fateStatus() {
  const threshold = Math.max(0, finalFateThreshold());
  const recorded = character.fate?.current;
  const current = recorded === undefined || recorded === null || recorded === ""
    ? threshold
    : Math.max(0, Math.min(threshold, Number(recorded) || 0));
  return { threshold, current };
}

function currentFatePoints() {
  return fateStatus().current;
}

function characteristicBonus(characteristicId) {
  return Math.floor(characteristicValue(characteristicId) / 10);
}

function rawAptitudes() {
  const roleRows = mechanicsByChoice[character.role] || [];
  const roleAptitudes = (roleRows.find(([label]) => label === "Role Aptitudes")?.[1] || "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.includes(" or ")
      ? character.aptitudeSelections.role || value.split(" or ")[0].trim()
      : value);
  const backgroundRaw = ruleValue(character.background, "Aptitude Choice") || "";
  const backgroundAptitude = backgroundRaw.includes(" or ")
    ? character.aptitudeSelections.background || backgroundRaw.split(" or ")[0].trim()
    : backgroundRaw.trim();
  const eliteAptitudes = [
    hasEliteAdvance("psyker") ? "Psyker" : "",
    hasEliteAdvance("inquisitor") ? "Leadership" : "",
    hasEliteAdvance("sister-of-battle") ? "Willpower" : "",
  ].filter(Boolean);
  return ["General", homeWorldRules().aptitude, backgroundAptitude, ...roleAptitudes, ...eliteAptitudes].filter(Boolean);
}

function resolvedAptitudes() {
  const unique = [];
  let duplicateCount = 0;
  for (const aptitude of rawAptitudes()) {
    if (unique.includes(aptitude)) duplicateCount += 1;
    else unique.push(aptitude);
  }
  return {
    aptitudes: [...unique, ...character.aptitudeReplacements.slice(0, duplicateCount).filter(Boolean)],
    duplicateCount,
  };
}

function skillForGrant(label = "") {
  const normalised = label.toLowerCase().replace(/^one\s+/, "").trim();
  return skills
    .filter((skill) => normalised === skill.name.toLowerCase() || normalised.startsWith(`${skill.name.toLowerCase()} (`))
    .sort((a, b) => b.name.length - a.name.length)[0] || null;
}

const specialistSkillIdSet = new Set(specialistSkillIds);

function isSpecialistSkill(skillId) {
  return specialistSkillIdSet.has(skillId);
}

function normaliseSpeciality(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function specialistSkillKey(skillId, speciality = "") {
  const key = normaliseSpeciality(speciality).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unspecified";
  return `${skillId}::${key}`;
}

function skillRecordKey(skillId, speciality = "") {
  return isSpecialistSkill(skillId) ? specialistSkillKey(skillId, speciality) : skillId;
}

function backgroundGrantedSkills() {
  const grants = {};
  splitGrant(ruleValue(character.background, "Starting Skills")).forEach((entry, index) => {
    const choiceId = `background-skills-${index}`;
    const needsSpecialityChoice = /pick one|^one\s+(?:forbidden lore|scholastic lore|trade|operate|navigate|common lore|linguistics)|^one\s+alien\s+language/i.test(entry);
    const selected = /\sor\s/i.test(entry) || needsSpecialityChoice ? character.grantChoices[choiceId] : entry;
    if (!selected) return;
    const skill = skillForGrant(selected);
    if (!skill) return;
    const source = catalogs.backgrounds.find((background) => background.id === character.background)?.name || "Background";
    if (isSpecialistSkill(skill.id)) {
      const specialityText = selected.match(/\(([^)]+)\)/)?.[1] || "";
      if (!specialityText || /pick one|choose/i.test(specialityText)) return;
      specialityText.split(/\s*,\s*/).map(normaliseSpeciality).filter(Boolean).forEach((speciality) => {
        const key = specialistSkillKey(skill.id, speciality);
        grants[key] = {
          key, id: skill.id, name: skill.name, speciality,
          displayName: `${skill.name} (${speciality})`, rank: 1, source,
        };
      });
      return;
    }
    grants[skill.id] = {
      key: skill.id, id: skill.id, name: skill.name, speciality: "",
      displayName: skill.name, rank: 1, source,
    };
  });
  return grants;
}

function resolvedGrantedSkills() {
  const grants = { ...backgroundGrantedSkills() };
  const divinationGrant = currentDivination()?.skillGrant;
  if (divinationGrant && !grants[divinationGrant.id]) {
    const skill = skills.find((entry) => entry.id === divinationGrant.id);
    if (skill) grants[skill.id] = { key: skill.id, id: skill.id, name: skill.name, displayName: skill.name, speciality: "", rank: 1, source: "Divination" };
  }
  const addEliteSpeciality = (skillId, speciality, source) => {
    if (!speciality) return;
    const skill = skills.find((entry) => entry.id === skillId);
    if (!skill) return;
    const key = specialistSkillKey(skillId, speciality);
    grants[key] = { key, id: skillId, name: skill.name, speciality, displayName: `${skill.name} (${speciality})`, rank: 1, source };
  };
  const addBasicSkill = (skillId, source) => {
    const skill = skills.find((entry) => entry.id === skillId);
    if (skill) grants[skill.id] = { key: skill.id, id: skill.id, name: skill.name, speciality: "", displayName: skill.name, rank: 1, source };
  };
  if (character.homeWorld === "daemon-world") addBasicSkill("psyniscience", "Daemon World — Touched by the Warp");
  if (character.homeWorld === "penal-colony") {
    addEliteSpeciality("common-lore", "Underworld", "Penal Colony — Finger on the Pulse");
    addBasicSkill("scrutiny", "Penal Colony — Finger on the Pulse");
  }
  if (hasEliteAdvance("sister-of-battle")) addEliteSpeciality("scholastic-lore", "Tactica Imperialis", "Sister of Battle Elite Advance");
  if (hasEliteAdvance("inquisitor")) addEliteSpeciality("forbidden-lore", character.eliteSetup.inquisitorLore, "Inquisitor Elite Advance");
  return grants;
}

function baseGrantedTalents() {
  const grants = {};
  const addGrant = (label, source) => {
    if (!label) return;
    const talent = talentByName(label);
    if (!talent) return;
    grants[talent.id] = { ...talent, displayName: label, ruleSource: talent.source, source, initial: true, cost: 0 };
  };
  splitGrant(ruleValue(character.background, "Talents / Traits")).forEach((label) => addGrant(label, "Background"));
  addGrant(character.grantChoices["role-talent-0"], "Role");
  addGrant(character.grantChoices["homeworld-bonus-0"], "Home World");
  if (character.homeWorld === "voidborn") addGrant("Strong Minded", "Voidborn — Child of the Dark");
  if (hasEliteAdvance("untouchable")) addGrant("Resistance (Psychic Powers)", "Untouchable Elite Advance");
  if (hasEliteAdvance("inquisitor")) addGrant("Peer (Inquisition)", "Inquisitor Elite Advance");
  if (hasEliteAdvance("sister-of-battle")) {
    addGrant("Peer (Adepta Sororitas)", "Sister of Battle Elite Advance");
    addGrant("Weapon Training (Bolt)", "Sister of Battle Elite Advance");
  }
  if (character.homeWorld === "penal-colony") addGrant("Peer (Criminal Cartels)", "Penal Colony — Finger on the Pulse");
  return grants;
}

function divinationTalentAlreadyOwned() {
  const label = selectedDivinationTalentLabel() || currentDivination()?.talentGrant?.label;
  const talent = talentByName(label || "");
  if (!talent) return false;
  return Boolean(baseGrantedTalents()[talent.id])
    || character.advances.talents.some((entry) => entry?.id === talent.id);
}

function resolvedGrantedTalents() {
  const grants = baseGrantedTalents();
  const label = selectedDivinationTalentLabel();
  const talent = talentByName(label);
  if (talent && !divinationTalentAlreadyOwned()) {
    grants[talent.id] = { ...talent, displayName: label, ruleSource: talent.source, source: "Divination", initial: true, cost: 0 };
  }
  return grants;
}

function paidTalentAdvanceEntries() {
  const grantedIds = new Set(Object.keys(resolvedGrantedTalents()));
  const seen = new Set();
  return character.advances.talents.filter((entry) => {
    if (!entry?.id || grantedIds.has(entry.id) || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function talentPrerequisiteStatus(talent) {
  const text = talent.prerequisites || "";
  if (!text) return { missing: [], parsed: true };
  const missing = [];
  let parsed = false;
  if (talent.requiresEliteAdvance) {
    parsed = true;
    if (!hasEliteAdvance(talent.requiresEliteAdvance)) missing.push(`${eliteAdvanceById(talent.requiresEliteAdvance)?.name || talent.requiresEliteAdvance} Elite Advance`);
  }
  for (const characteristic of characteristics) {
    const match = text.match(new RegExp(`${characteristic.name}\\s+(\\d+)`, "i"));
    if (!match) continue;
    parsed = true;
    if (characteristicValue(characteristic.id) < Number(match[1])) missing.push(`${characteristic.name} ${match[1]}`);
  }
  const ownedIds = new Set([...Object.keys(resolvedGrantedTalents()), ...character.advances.talents.map((entry) => entry.id)]);
  for (const prerequisite of talentCatalogue) {
    if (prerequisite.id === talent.id || !new RegExp(`\\b${prerequisite.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) continue;
    parsed = true;
    if (!ownedIds.has(prerequisite.id)) missing.push(prerequisite.name);
  }
  const insanityMatch = text.match(/Insanity\s+(\d+)/i);
  if (insanityMatch) {
    parsed = true;
    if (Number(character.conditions.insanity || 0) < Number(insanityMatch[1])) missing.push(`Insanity ${insanityMatch[1]}`);
  }
  return { missing: [...new Set(missing)], parsed };
}

function specialistAdvanceRecords(skillId) {
  const records = Object.entries(character.advances.specialistSkills || {})
    .filter(([, entry]) => entry?.skillId === skillId && normaliseSpeciality(entry.speciality))
    .map(([key, entry]) => ({ key, skillId, speciality: normaliseSpeciality(entry.speciality), rank: Number(entry.rank || 0) }));
  const legacyRank = Number(character.advances.skills[skillId] || 0);
  if (legacyRank > 0) {
    const grants = Object.values(resolvedGrantedSkills()).filter((entry) => entry.id === skillId);
    const speciality = grants.length === 1 ? grants[0].speciality : "Unspecified";
    const key = specialistSkillKey(skillId, speciality);
    if (!records.some((entry) => entry.key === key)) records.push({ key, skillId, speciality, rank: legacyRank, legacy: true });
  }
  return records;
}

function skillRank(skillId, speciality = "") {
  const key = skillRecordKey(skillId, speciality);
  const purchasedRank = isSpecialistSkill(skillId)
    ? Number(specialistAdvanceRecords(skillId).find((entry) => entry.key === key)?.rank || 0)
    : Number(character.advances.skills[skillId] || 0);
  return Math.max(purchasedRank, resolvedGrantedSkills()[key]?.rank || 0);
}

function skillTestTarget(skill, speciality = "") {
  const characteristic = characteristics.find((entry) => entry.name === skill.characteristic);
  const rank = skillRank(skill.id, speciality);
  return rank > 0 ? characteristicValue(characteristic?.id) + (rank - 1) * 10 : 0;
}

function characteristicXpCost(characteristicId) {
  const characteristic = characteristics.find((entry) => entry.id === characteristicId);
  const matches = aptitudeMatches(characteristic?.aptitudes || [], resolvedAptitudes().aptitudes);
  const rank = Number(character.advances.characteristics[characteristicId] || 0);
  return Array.from({ length: rank }, (_, index) => characteristicAdvanceCosts[matches][index]).reduce((sum, cost) => sum + cost, 0);
}

function skillXpCost(skillId, speciality = "") {
  const skill = skills.find((entry) => entry.id === skillId);
  const matches = aptitudeMatches(skill?.aptitudes || [], resolvedAptitudes().aptitudes);
  const key = skillRecordKey(skillId, speciality);
  const freeRank = resolvedGrantedSkills()[key]?.rank || 0;
  const rank = skillRank(skillId, speciality);
  return Array.from({ length: Math.max(0, rank - freeRank) }, (_, offset) => skillAdvanceCosts[matches][freeRank + offset]).reduce((sum, cost) => sum + cost, 0);
}

function ownedSkillRecords() {
  const grants = resolvedGrantedSkills();
  const records = [];
  for (const skill of skills) {
    if (!isSpecialistSkill(skill.id)) {
      const rank = skillRank(skill.id);
      if (rank > 0) records.push({ key: skill.id, skill, speciality: "", displayName: skill.name, rank, grant: grants[skill.id] || null });
      continue;
    }
    const family = new Map();
    Object.values(grants).filter((entry) => entry.id === skill.id).forEach((grant) => {
      family.set(grant.key, { key: grant.key, skill, speciality: grant.speciality, displayName: grant.displayName, grant });
    });
    specialistAdvanceRecords(skill.id).forEach((advance) => {
      const existing = family.get(advance.key);
      family.set(advance.key, {
        key: advance.key, skill, speciality: advance.speciality,
        displayName: `${skill.name} (${advance.speciality})`, grant: existing?.grant || null,
      });
    });
    family.forEach((record) => {
      const rank = skillRank(skill.id, record.speciality);
      if (rank > 0) records.push({ ...record, rank });
    });
  }
  return records.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function automaticEliteAdvances() {
  if (character.role !== "mystic") return [];
  const psyker = eliteAdvanceById("psyker");
  return [{ ...psyker, source: "Mystic Role — Stare into the Warp", ruleSource: `${psyker.source}, p. ${psyker.page}`, cost: 0, automatic: true }];
}

function activeEliteAdvances() {
  const combined = [...automaticEliteAdvances(), ...character.advances.eliteAdvances]
    .map((entry) => ({ ...(eliteAdvanceById(entry?.id) || {}), ...entry }))
    .filter((entry) => entry.id);
  return [...new Map(combined.map((entry) => [entry.id, entry])).values()];
}

function hasEliteAdvance(id) {
  return activeEliteAdvances().some((entry) => entry.id === id);
}

function exceptionalFeatureRecords() {
  const records = [];
  if (character.background === "mutant") {
    const startingTrait = mutantStartingTraits.find((entry) => entry.id === character.exceptional?.mutantTraitId);
    if (startingTrait) records.push({ name: startingTrait.name, summary: "Selected Mutant starting trait.", source: "Mutant Background" });
    const mutation = selectedMutationRecord();
    if (mutation) records.push({ name: mutation.name, summary: mutation.summary, source: "Mutant Background — Mutation, Core Rulebook p. 292" });
  }
  if (character.background === "exorcised") {
    const malignancy = selectedMalignancyRecord("starting");
    if (malignancy) records.push({ name: malignancy.name, summary: malignancy.summary, source: "Exorcised Background — Malignancy, Core Rulebook p. 290" });
  }
  if (currentDivination()?.malignancyRoll) {
    const malignancy = selectedMalignancyRecord("divination");
    if (malignancy) records.push({ name: malignancy.name, summary: malignancy.summary, source: "Divination — Malignancy, Core Rulebook p. 290" });
  }
  if (currentDivination()?.disorderGrant === "phobia") {
    const disorder = mentalDisorders.find((entry) => entry.id === character.divination.resolutions?.disorderId);
    if (disorder) records.push({ name: disorder.name, summary: disorder.summary, source: "Divination — Mental Disorder, Core Rulebook pp. 287–289" });
  }
  return records;
}

function automaticTraits() {
  const traits = [...exceptionalFeatureRecords()];
  if (["mechanicus", "heretek"].includes(character.background)) traits.push({
    name: "Mechanicus Implants",
    summary: "The character possesses the foundational cranial circuitry, cyber-mantle, electro-graft, electoo inductors, and Potentia Coil of a servant of the Machine-God.",
    source: character.background === "mechanicus" ? "Adeptus Mechanicus Background" : "Heretek Background",
  });
  if (character.homeWorld === "agri-world") traits.push({
    name: "Brutal Charge (2)",
    summary: "The character gains +2 damage on attacks made during a Charge.",
    source: "Agri-World — Strength from the Land",
  });
  if (hasEliteAdvance("psyker")) traits.push({
    name: "Psyker",
    summary: "The character has a Psy Rating and can manifest psychic powers, with the attendant risk of Psychic Phenomena.",
    source: "Psyker Elite Advance",
  });
  if (character.background === "astra-telepathica" && traits.some((entry) => entry.name === "Psyker")) traits.push({
    name: "Sanctioned",
    summary: "The character is an Imperial-sanctioned psyker and begins the Psyker elite advance at Psy Rating 2 rather than 1.",
    source: "Adeptus Astra Telepathica — Tested on Terra",
  });
  if (hasEliteAdvance("astropath")) traits.push(
    { name: "Soul Bound", summary: "The Astropath is soul-bound to the Emperor and permanently loses normal sight.", source: "Astropath Elite Advance" },
    { name: "Blind", summary: "The Astropath permanently loses normal sight as part of Soul Binding.", source: "Astropath Elite Advance" },
    { name: `Unnatural Senses (${characteristicValue("willpower") || "WP"})`, summary: "The Astropath perceives surroundings psychically to a range equal to Willpower in metres.", source: "Astropath Elite Advance" },
  );
  return traits;
}

function equipmentGrantedTraits() {
  const activeIds = new Set([
    ...character.equipment.readiedWeapons,
    ...character.equipment.wornArmour,
    ...character.equipment.activeGear,
  ]);
  const traits = [];
  if (activeIds.has("core-gear-photo-visors-contacts")) {
    traits.push({
      name: "Dark-sight",
      summary: "The character can see normally in darkness while the photo-visors or contacts are active.",
      source: "Photo-Visors/Contacts - active only while this item is equipped",
      conditional: true,
    });
  }
  return traits;
}

function xpSpent() {
  const owned = resolvedAptitudes().aptitudes;
  let spent = 0;
  for (const [id, rank] of Object.entries(character.advances.characteristics)) {
    const characteristic = characteristics.find((entry) => entry.id === id);
    const matches = aptitudeMatches(characteristic?.aptitudes || [], owned);
    for (let index = 0; index < Number(rank || 0); index += 1) {
      spent += characteristicAdvanceCosts[matches][index];
    }
  }
  for (const [id, rank] of Object.entries(character.advances.skills)) {
    const skill = skills.find((entry) => entry.id === id);
    const matches = aptitudeMatches(skill?.aptitudes || [], owned);
    const legacySpeciality = isSpecialistSkill(id)
      ? (Object.values(resolvedGrantedSkills()).filter((entry) => entry.id === id).length === 1
        ? Object.values(resolvedGrantedSkills()).find((entry) => entry.id === id).speciality
        : "Unspecified")
      : "";
    const freeRank = resolvedGrantedSkills()[skillRecordKey(id, legacySpeciality)]?.rank || 0;
    for (let index = freeRank; index < Number(rank || 0); index += 1) {
      spent += skillAdvanceCosts[matches][index];
    }
  }
  for (const entry of Object.values(character.advances.specialistSkills || {})) {
    if (!entry?.skillId || !normaliseSpeciality(entry.speciality)) continue;
    const skill = skills.find((candidate) => candidate.id === entry.skillId);
    const matches = aptitudeMatches(skill?.aptitudes || [], owned);
    const key = specialistSkillKey(entry.skillId, entry.speciality);
    const freeRank = resolvedGrantedSkills()[key]?.rank || 0;
    for (let index = freeRank; index < Number(entry.rank || 0); index += 1) {
      spent += skillAdvanceCosts[matches][index];
    }
  }
  for (const entry of paidTalentAdvanceEntries()) {
    const talent = talentCatalogue.find((candidate) => candidate.id === entry?.id);
    spent += talent ? talentCost(talent) : Number(entry?.cost || 0);
  }
  for (const collection of [character.advances.psychicPowers, character.advances.eliteAdvances]) {
    for (const entry of collection) spent += Number(entry?.cost || 0);
  }
  spent += psyRatingXpCost();
  return spent;
}

function save({ markComplete = false } = {}) {
  syncCreationConsequences();
  syncGrantedEquipment();
  const now = new Date().toISOString();
  if (markComplete) character.completedAt = now;
  else if (step < scenes.length - 1 && !character.completedAt) character.completedAt = null;
  const existingIndex = characterLibrary.findIndex((entry) => entry.id === activeCharacterId);
  const existing = characterLibrary[existingIndex];
  const record = {
    id: activeCharacterId,
    character: structuredClone(character),
    step,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    origin: existing?.origin || "Created locally",
  };
  if (existingIndex >= 0) characterLibrary[existingIndex] = record;
  else characterLibrary.push(record);
  localStorage.setItem(libraryStorageKey, JSON.stringify(characterLibrary));
  localStorage.setItem(activeCharacterStorageKey, activeCharacterId);
  localStorage.setItem("dh2-character", JSON.stringify(character));
  sessionStorage.setItem("dh2-step", String(step));
  sessionStorage.setItem("dh2-app-view", appView);
  queueRepositorySave(record);
}

function rerenderAdvancesPreservingScroll(focusSelector = "", anchorSelector = "#advance-talents") {
  const previousShop = document.querySelector(".advance-shop");
  const previousAnchor = document.querySelector(focusSelector || anchorSelector);
  const anchorViewportOffset = previousShop && previousAnchor
    ? previousAnchor.getBoundingClientRect().top - previousShop.getBoundingClientRect().top
    : 0;
  const previousScroll = previousShop?.scrollTop || 0;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  render();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const shop = document.querySelector(".advance-shop");
      const anchor = document.querySelector(focusSelector || anchorSelector);
      if (shop) shop.scrollTop = previousScroll;
      if (shop && anchor) {
        const nextOffset = anchor.getBoundingClientRect().top - shop.getBoundingClientRect().top;
        shop.scrollTop = Math.max(0, shop.scrollTop + nextOffset - anchorViewportOffset);
      }
      if (focusSelector && anchor instanceof HTMLElement) anchor.focus({ preventScroll: true });
    });
  });
}

function rerenderEquipmentStatePreservingScroll(focusSelector = "") {
  const scrollPositions = [".armoury-list", ".loadout-panel", ".management-content", ".item-inspector > div", ".review-tab-panel:not([hidden])", ".inventory-list"]
    .map((selector) => ({ selector, top: document.querySelector(selector)?.scrollTop || 0 }));
  render();
  requestAnimationFrame(() => {
    scrollPositions.forEach(({ selector, top }) => {
      const target = document.querySelector(selector);
      if (target) target.scrollTop = top;
    });
    const focusTarget = focusSelector ? document.querySelector(focusSelector) : null;
    if (focusTarget instanceof HTMLElement) focusTarget.focus({ preventScroll: true });
  });
}

function rerenderGrantsPreservingScroll(focusSelector = "") {
  const grid = document.querySelector(".grants-grid");
  const previousScroll = grid?.scrollTop || 0;
  render();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const nextGrid = document.querySelector(".grants-grid");
      if (nextGrid) nextGrid.scrollTop = previousScroll;
      const focusTarget = focusSelector ? document.querySelector(focusSelector) : null;
      if (focusTarget instanceof HTMLElement) focusTarget.focus({ preventScroll: true });
    });
  });
}

function refreshCharacteristicDisplay(characteristicId) {
  const input = document.querySelector(`[data-manual-characteristic="${characteristicId}"]`);
  const article = input?.closest(".characteristic-entry");
  const result = character.rolls[characteristicId];
  if (!article) return;
  const resultBox = article.querySelector(".characteristic-result");
  const rollButton = article.querySelector(".roll-characteristic");
  if (result) {
    article.classList.add("complete");
    resultBox.innerHTML = `<strong>${result.value}</strong><small>Entered manually</small>`;
    if (rollButton) {
      rollButton.textContent = character.characteristicReroll === characteristicId ? "Re-roll kept" : "Use one re-roll";
      rollButton.disabled = Boolean(character.characteristicReroll);
    }
  } else {
    article.classList.remove("complete");
    resultBox.innerHTML = "<strong>—</strong><small>Awaiting result</small>";
    if (rollButton) {
      rollButton.textContent = "Roll for Characteristic";
      rollButton.disabled = false;
    }
  }
  const complete = characteristics.filter((entry) => character.rolls[entry.id]?.value).length;
  const counter = document.querySelector(".management-heading span");
  if (counter) counter.textContent = `${complete} / ${characteristics.length} recorded`;
}

function refreshXpMeter() {
  const meter = document.querySelector(".xp-meter");
  if (!meter) return;
  const values = meter.querySelectorAll("strong");
  const spent = xpSpent();
  if (values[1]) values[1].textContent = String(spent);
  if (values[2]) {
    values[2].textContent = String(character.xp.starting - spent);
    values[2].classList.toggle("invalid", spent > character.xp.starting);
  }
}

function resetCreationDataFrom(sceneId) {
  if (sceneId === "homeWorld") {
    character.rolls = {};
    character.characteristicReroll = null;
    character.fate = {};
    character.wounds = {};
    character.divination = { statChoices: {} };
  }
  character.exceptional = { creationCorruptionApplied: 0 };
  character.aptitudeReplacements = [];
  character.aptitudeSelections = {};
  character.grantChoices = {};
  character.acquisitions = [];
  character.equipment = {
    inventory: [],
    noCostGrants: [],
    characterCreationGrants: [],
    unlinkedCharacterCreationGrants: [],
    readiedWeapons: [],
    wornArmour: [],
    activeGear: [],
    weaponModAssignments: {},
    selected: null,
  };
  character.advances = {
    characteristics: {},
    skills: {},
    specialistSkills: {},
    talents: [],
    psychicPowers: [],
    eliteAdvances: [],
    psyRating: 0,
  };
  character.conditions = { insanity: 0, corruption: 0 };
  character.combat = { damage: 0 };
  character.psychicFilters = { query: "", discipline: "All Powers", showUnavailable: true };
  character.psychicShopSelected = null;
  character.eliteShopSelected = null;
  character.eliteSetup = { gmApproved: {}, inquisitorLore: "", sisterWeapon: "", psykerCorruption: null, maleficApproved: false };
  character.talentShopSelected = null;
  character.talentFilters = { query: "", tier: "All" };
  character.xp = { starting: 1000, awards: [] };
}

function selectCatalogChoice(scene, choiceId) {
  if (!scene?.catalog || character[scene.id] === choiceId) return false;
  resetCreationDataFrom(scene.id);
  character[scene.id] = choiceId;
  return true;
}

function randomEntry(entries, excludedId = "") {
  const eligible = entries.filter((entry) => entry.id !== excludedId);
  const pool = eligible.length ? eligible : entries;
  if (!pool.length) return null;
  if (globalThis.crypto?.getRandomValues) {
    const random = new Uint32Array(1);
    globalThis.crypto.getRandomValues(random);
    return pool[random[0] % pool.length];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomizeCurrentCatalog(scene) {
  const selected = randomEntry(catalogs[scene.catalog], character[scene.id]);
  if (!selected || !selectCatalogChoice(scene, selected.id)) return;
  playMechanicalLock();
  pendingFocusSelector = "#randomize-stage";
  save();
  render();
}

function randomizeCharacterOrigins() {
  const confirmed = confirm(
    "Randomize this character's Home World, Background, and Role? Identity fields remain unchanged. Later mechanical choices are reset, and all dice are still rolled by the player.",
  );
  if (!confirmed) return;
  resetCreationDataFrom("homeWorld");
  character.homeWorld = randomEntry(catalogs.homeWorlds, character.homeWorld)?.id || character.homeWorld;
  character.background = randomEntry(catalogs.backgrounds, character.background)?.id || character.background;
  character.role = randomEntry(catalogs.roles, character.role)?.id || character.role;
  playMechanicalLock();
  pendingFocusSelector = "#randomize-character";
  save();
  render();
}

function cycleChoice(direction) {
  const scene = scenes[step];
  if (!scene.catalog) return false;
  const entries = catalogs[scene.catalog];
  const current = entries.findIndex((entry) => entry.id === character[scene.id]);
  selectCatalogChoice(scene, entries[(current + direction + entries.length) % entries.length].id);
  pendingFocusSelector = direction < 0 ? "#previous-choice" : "#next-choice";
  save();
  render();
  return true;
}

function renderFacts(facts = []) {
  if (!facts.length) return "";
  return `<dl class="facts">${facts
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("")}</dl>`;
}

function renderCatalog(scene, selected) {
  const entries = catalogs[scene.catalog];
  const selectionLabel = scene.id === "homeWorld" ? "home world" : scene.id;
  return `
    <label class="mobile-choice-control">
      <span class="sr-only">Choose ${selectionLabel}</span>
      <select id="mobile-catalog-choice" aria-label="Choose ${selectionLabel}" aria-describedby="mobile-choice-help">
        ${entries.map((entry) => `<option value="${entry.id}" ${entry.id === selected.id ? "selected" : ""}>${entry.name}</option>`).join("")}
      </select>
      <small class="sr-only" id="mobile-choice-help">Selecting an option updates its lore and rules.</small>
    </label>
    <div class="catalog-picker" role="listbox" aria-label="${scene.detailTitle}">
      <button class="catalog-arrow" id="previous-choice" aria-label="Previous choice">‹</button>
      <div class="choice-card" role="option" aria-selected="true" aria-live="polite">
        <span class="selection-state">◆ Current selection</span>
        <p class="choice-source">${selected.source}</p>
        <h2>${selected.name}</h2>
      <ul class="choice-lore">
        ${loreByChoice[selected.id].map((point) => `<li>${point}</li>`).join("")}
      </ul>
      </div>
      <button class="catalog-arrow" id="next-choice" aria-label="Next choice">›</button>
    </div>
    <div class="catalog-slots" style="--slot-count: ${entries.length}" aria-label="${entries.length} available choices">
      ${entries.map((entry, index) => `
        <button
          class="catalog-slot ${entry.id === selected.id ? "active" : ""}"
          type="button"
          data-choice-id="${entry.id}"
          aria-label="${index + 1}: ${entry.name}"
          aria-pressed="${entry.id === selected.id}"
          title="${entry.name}"
        ></button>`).join("")}
    </div>
    <div class="catalog-randomizers" aria-label="Random character options">
      <button class="compact-button" id="randomize-stage" type="button">Randomize This Choice</button>
      <button class="compact-button" id="randomize-character" type="button">Randomize Character</button>
      <small>Randomizes Home World, Background, and Role only. Dice are never rolled.</small>
    </div>`;
}

function psykerPathClarification() {
  const sanctioned = character.background === "astra-telepathica";
  return `<section class="psyker-path-clarification" aria-label="Mystic and Psyker rules clarification">
    <span class="psyker-path-mark" aria-hidden="true">Ψ</span>
    <div>
      <strong>Mystic is the Role; Psyker is the Elite Advance it grants.</strong>
      <p>Stare into the Warp gives this character the normal Psyker Elite Advance automatically for 0 XP. It grants the Psyker trait, Psyker aptitude, Psy Rating, and access to psychic powers; it cannot be purchased a second time.</p>
      <small>${sanctioned
        ? "Adeptus Astra Telepathica: Tested on Terra also grants Sanctioned and raises starting Psy Rating from 1 to 2."
        : "Without the Adeptus Astra Telepathica background, the character is an unsanctioned rogue psyker and must record 1d10+3 Corruption."}</small>
    </div>
  </section>`;
}

function renderMechanics(selected) {
  const rows = mechanicsByChoice[selected.id] || [];
  const rulesHeading = scenes[step].id === "homeWorld"
    ? "Home World Rules"
    : scenes[step].id === "background"
      ? "Background Rules"
      : "Role Special Rules";
  return `
    <aside class="mechanics-panel" aria-label="${selected.name} mechanical benefits">
      <div class="mechanics-heading">
        <strong>${rulesHeading}</strong>
      </div>
      <dl>
        ${rows.map(([label, value]) => `
          <div class="mechanics-row mechanics-row-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}">
            <dt>${label}</dt>
            <dd${label === "Characteristics" ? ' class="mechanic-modifiers"' : ""}>${label === "Characteristics"
              ? value.split(",").map((modifier) => `<span class="mechanic-modifier">${modifier.trim()}</span>`).join("")
              : value}</dd>
          </div>`).join("")}
      </dl>
      ${scenes[step].id === "role" && selected.id === "mystic" ? psykerPathClarification() : ""}
    </aside>`;
}

function renderIdentity() {
  const history = character.history || {};
  const historyPrompts = [
    ["desire", "What does your Acolyte desire?", "A goal, need, or ambition."],
    ["hatred", "What does your Acolyte hate?", "A foe, institution, failing, or idea."],
    ["sacrifice", "What would your Acolyte sacrifice?", "What duty might cost them."],
    ["meeting", "How did the Inquisitor find them?", "The event that brought them into service."],
    ["inquisitorMeaning", "What does the Inquisitor mean to them?", "Patron, judge, saviour, threat, or something more complicated."],
    ["warbandBond", "What binds them to the warband?", "A shared cause, debt, friendship, or necessity."],
    ["base", "Where does the warband operate from?", "A vessel, safe house, fortress, or other base."],
  ];
  return `
    <form class="identity-form" id="identity-form">
      <label>
        <span>Name</span>
        <input name="name" maxlength="60" autocomplete="off" value="${character.name}" placeholder="UNASSIGNED" />
      </label>
      <div class="split-fields">
        <label>
          <span>Player</span>
          <input name="player" maxlength="60" value="${character.player}" placeholder="Optional" />
        </label>
        <label>
          <span>Gender / Presentation</span>
          <input name="presentation" maxlength="60" value="${character.presentation}" placeholder="Optional" />
        </label>
      </div>
      <label>
        <span>Appearance</span>
        <textarea name="appearance" maxlength="240" placeholder="A brief description of your Acolyte's appearance…">${escapeHtmlAttribute(character.appearance)}</textarea>
      </label>
      <details class="personal-history-card">
        <summary><strong>Optional personal history</strong><span>Skippable · can be completed later</span></summary>
        <p>Use any prompts that help define the character. None are required to continue.</p>
        <div class="personal-history-grid">
          ${historyPrompts.map(([id, label, placeholder]) => `<label><span>${label}</span><textarea data-history-field="${id}" maxlength="320" placeholder="${placeholder}">${escapeHtmlAttribute(history[id] || "")}</textarea></label>`).join("")}
        </div>
      </details>
    </form>`;
}

function renderCharacteristics() {
  const complete = characteristics.filter((entry) => character.rolls[entry.id]?.value).length;
  return `
    <div class="management-shell characteristics-stage">
      <div class="management-heading">
        <span>${complete} / ${characteristics.length} recorded</span>
        <strong>Roll each characteristic or enter a result rolled elsewhere.</strong>
      </div>
      <div class="characteristic-grid">
        ${characteristics.map((entry) => {
          const config = characteristicRollConfig(entry.id);
          const result = character.rolls[entry.id];
          const formula = config.quantity === 2
            ? "2d10 + 20"
            : `3d10, keep ${config.keep} 2, +20`;
          const rerollUnavailable = Boolean(result && character.characteristicReroll);
          return `
            <article class="characteristic-entry ${result ? "complete" : ""}">
              <div class="characteristic-name">
                <span class="characteristic-abbreviation">${entry.abbreviation}</span>
                <strong>${entry.name}</strong>
                <small>${formula}</small>
              </div>
              <div class="characteristic-result">
                <strong>${result?.value ?? "—"}</strong>
                ${result ? `<small>${result.source === "manual" ? "Entered manually" : `Dice: ${result.dice.join(", ")}`}</small>` : ""}
              </div>
              <div class="roll-actions">
                <button class="compact-button roll-characteristic" data-characteristic="${entry.id}" type="button" ${rerollUnavailable ? "disabled" : ""}>${result ? character.characteristicReroll === entry.id ? "Re-roll kept" : "Use one re-roll" : "Roll for Characteristic"}</button>
                <label class="manual-result">
                  <span>Enter result</span>
                  <input type="number" min="22" max="50" value="${result?.source === "manual" ? result.value : ""}" data-manual-characteristic="${entry.id}" placeholder="—" />
                </label>
              </div>
            </article>`;
        }).join("")}
      </div>
      <p class="rules-footnote">After all ten rolls, one characteristic may be re-rolled. The second result must be kept.</p>
    </div>`;
}

function renderFateWounds() {
  const rules = homeWorldRules();
  const fateRoll = character.fate.roll;
  const fateThreshold = rules.fate.threshold + (fateRoll >= rules.fate.blessing ? 1 : 0);
  const woundsDice = character.wounds.dice || [];
  const woundsTotal = woundsDice.length
    ? rules.wounds.base + woundsDice.reduce((sum, die) => sum + die, 0)
    : null;
  return `
    <div class="management-shell ceremony-grid">
      <article class="ceremony-card">
        <p class="choice-source">Fate Threshold</p>
        <h2>The Emperor's Blessing</h2>
        <p>Base threshold ${rules.fate.threshold}. Roll 1d10; ${rules.fate.blessing}+ increases it by 1.</p>
        <div class="ceremony-result">${fateRoll ?? "—"} <span>Threshold ${fateRoll ? fateThreshold : "—"}</span></div>
        <div class="dual-actions">
          <button class="compact-button" id="roll-fate" type="button">Roll 1d10</button>
          <label class="manual-result"><span>Enter d10</span><input id="manual-fate" type="number" min="1" max="10" value="${character.fate.source === "manual" ? fateRoll || "" : ""}" /></label>
        </div>
      </article>
      <article class="ceremony-card">
        <p class="choice-source">Starting Wounds</p>
        <h2>${rules.wounds.base} + ${rules.wounds.dice}d5</h2>
        <p>Roll each d5 using a d10, divide by two, and round up.</p>
        <div class="ceremony-result">${woundsTotal ?? "—"} <span>${woundsDice.length ? `d5: ${woundsDice.join(", ")}` : "Wounds"}</span></div>
        <div class="dual-actions">
          <button class="compact-button" id="roll-wounds" type="button">Roll ${rules.wounds.dice}d10</button>
          <label class="manual-result"><span>Enter total</span><input id="manual-wounds" type="number" min="${rules.wounds.base + rules.wounds.dice}" max="${rules.wounds.base + rules.wounds.dice * 5}" value="${character.wounds.source === "manual" ? character.wounds.total || "" : ""}" /></label>
        </div>
      </article>
    </div>`;
}

function renderMagnitudeControl(entry, source) {
  if (!entry?.characteristicRoll) return "";
  const key = source === "divination" ? "malignancyMagnitude" : source === "mutation" ? "mutationMagnitude" : "startingMalignancyMagnitude";
  const value = source === "divination" ? character.divination.resolutions?.[key] : character.exceptional?.[key];
  const characteristic = characteristics.find((candidate) => candidate.id === entry.characteristicRoll.target)?.name || entry.characteristicRoll.target;
  return `<div class="exceptional-magnitude">
    <p><strong>Characteristic adjustment pending</strong><span>Roll 1d${entry.characteristicRoll.sides}; ${characteristic} is reduced by the result.</span></p>
    <button class="compact-button" type="button" data-roll-exceptional-magnitude="${source}">Roll 1d${entry.characteristicRoll.sides}</button>
    <label class="manual-result"><span>Enter result</span><input type="number" min="1" max="${entry.characteristicRoll.sides}" value="${value || ""}" data-exceptional-magnitude="${source}" /></label>
  </div>`;
}

function renderExceptionalResult(entry, source) {
  if (!entry) return "";
  const detailKey = source === "divination" ? "malignancyDetail" : source === "mutation" ? "mutationDetail" : "startingMalignancyDetail";
  const detail = source === "divination" ? character.divination.resolutions?.[detailKey] : character.exceptional?.[detailKey];
  return `<article class="exceptional-result">
    <span>${entry.min === entry.max ? entry.min : `${entry.min}–${entry.max}`}</span>
    <div><strong>${entry.name}</strong><p>${entry.summary}</p></div>
    ${entry.needsDetail ? `<label><span>${entry.needsDetail}</span><input type="text" maxlength="120" value="${escapeHtmlAttribute(detail || "")}" data-exceptional-detail="${source}" placeholder="Record the chosen ${entry.needsDetail.toLowerCase()}" /></label>` : ""}
    ${renderMagnitudeControl(entry, source)}
  </article>`;
}

function renderDivination() {
  const roll = Number(character.divination.roll || 0);
  const result = roll ? divinationFor(roll) : null;
  const changes = result?.statChanges || [];
  const choices = character.divination.statChoices || {};
  const changeControls = changes.map((change) => {
    if (change.target) {
      const characteristic = characteristics.find((entry) => entry.id === change.target);
      return `<div class="applied-change"><span>Applied automatically</span><strong>${characteristic?.name || change.target} ${change.amount > 0 ? "+" : ""}${change.amount}</strong></div>`;
    }
    return `<label class="divination-choice">
      <span>${change.label || "Choose characteristic"} ${change.amount > 0 ? "+" : ""}${change.amount}</span>
      <select data-divination-choice="${change.id}">
        <option value="">Choose...</option>
        ${change.options.map((id) => {
          const characteristic = characteristics.find((entry) => entry.id === id);
          return `<option value="${id}" ${choices[change.id] === id ? "selected" : ""}>${characteristic?.name || id}</option>`;
        }).join("")}
      </select>
    </label>`;
  }).join("");
  const fateControl = result?.fateChange
    ? `<div class="applied-change"><span>Applied automatically</span><strong>Fate Threshold +${result.fateChange}</strong></div>`
    : "";
  const talentGrant = result?.talentGrant;
  const talentOptions = talentGrant?.choice === "hatred" ? hatredSpecialities : talentGrant?.choice === "resistance" ? resistanceSpecialities : [];
  const talentLabel = selectedDivinationTalentLabel();
  const talentAlreadyOwned = talentGrant ? divinationTalentAlreadyOwned() : false;
  const talentControl = talentGrant ? `<div class="divination-resolution-card">
    <strong>${talentAlreadyOwned ? "Existing talent detected" : "Talent granted automatically"}</strong>
    ${talentOptions.length ? `<label><span>Choose ${talentGrant.label} speciality</span><select data-divination-talent-speciality><option value="">Choose...</option>${talentOptions.map((option) => `<option value="${option}" ${character.divination.resolutions?.talentSpeciality === option ? "selected" : ""}>${option}</option>`).join("")}</select></label>` : `<span>${talentGrant.label}</span>`}
    <p>${talentAlreadyOwned ? `${talentLabel || talentGrant.label} is already possessed, so the listed characteristic increase is applied instead.` : talentLabel ? `${talentLabel} will be included in the final sheet and export.` : "Choose the required speciality to finish this result."}</p>
  </div>` : "";
  const disorderControl = result?.disorderGrant === "phobia" ? `<div class="divination-resolution-card">
    <strong>Choose the Phobia</strong>
    <label><span>Mental Disorder</span><select data-divination-disorder><option value="">Choose...</option>${mentalDisorders.filter((entry) => entry.id.startsWith("phobia-")).map((entry) => `<option value="${entry.id}" ${character.divination.resolutions?.disorderId === entry.id ? "selected" : ""}>${entry.name}</option>`).join("")}</select></label>
  </div>` : "";
  const divinationMalignancy = selectedMalignancyRecord("divination");
  const malignancyControl = result?.malignancyRoll ? `<div class="divination-resolution-card">
    <strong>Resolve the Malignancy</strong>
    <p>Roll d100 on Table 8-15, or enter a result rolled elsewhere.</p>
    <div class="dual-actions"><button class="compact-button" type="button" data-roll-divination-malignancy>Roll d100</button><label class="manual-result"><span>Enter d100</span><input type="number" min="1" max="100" value="${character.divination.resolutions?.malignancyRoll || ""}" data-divination-malignancy-roll /></label></div>
    ${renderExceptionalResult(divinationMalignancy, "divination")}
  </div>` : "";
  return `
    <div class="management-shell divination-layout">
      <article class="divination-card">
        <p class="choice-source">Table 2-9: Divinations</p>
        <h2>${result?.title || "The Emperor's Tarot Awaits"}</h2>
        <div class="divination-die">${roll || "—"}<span>d100 result</span></div>
        <p>${result?.effect || "Roll the percentile dice here, or enter a result from physical dice or your VTT."}</p>
        <div class="dual-actions">
          <button class="compact-button" id="roll-divination" type="button">Roll d100</button>
          <label class="manual-result">
            <span>Enter d100</span>
            <input id="manual-divination" type="number" min="1" max="100" value="${character.divination.source === "manual" ? roll || "" : ""}" />
          </label>
        </div>
      </article>
      <aside class="divination-reference">
        <p class="choice-source">Twist of Destiny</p>
        <p>The selected effect is recorded in the export. Effects that offer alternatives remain a player choice and should be resolved before the final review.</p>
        ${result ? `<dl><dt>Roll</dt><dd>${result.min === result.max ? result.min : `${result.min}-${result.max}`}</dd><dt>Divination</dt><dd>${result.title}</dd><dt>Effect</dt><dd>${result.effect}</dd></dl>` : ""}
        ${result && (changeControls || fateControl || talentControl || disorderControl || malignancyControl) ? `<div class="divination-adjustments">${changeControls}${fateControl}${talentControl}${disorderControl}${malignancyControl}</div>` : ""}
      </aside>
    </div>`;
}

function renderAptitudes() {
  const { aptitudes, duplicateCount } = resolvedAptitudes();
  const backgroundOptions = ruleValue(character.background, "Aptitude Choice").split(" or ").map((value) => value.trim()).filter(Boolean);
  const roleChoiceText = (ruleValue(character.role, "Role Aptitudes").split(";").find((value) => value.includes(" or ")) || "").trim();
  const roleOptions = roleChoiceText.split(" or ").map((value) => value.trim()).filter(Boolean);
  return `
    <div class="management-shell">
      <div class="aptitude-ledger">
        <section>
          <p class="choice-source">Received from character creation</p>
          <div class="replacement-grid aptitude-source-choices">
            ${backgroundOptions.length > 1 ? `<label><span>Background aptitude</span><select data-aptitude-source="background">${backgroundOptions.map((option) => `<option ${rawAptitudes().includes(option) && (character.aptitudeSelections.background || backgroundOptions[0]) === option ? "selected" : ""}>${option}</option>`).join("")}</select></label>` : ""}
            ${roleOptions.length > 1 ? `<label><span>Role aptitude</span><select data-aptitude-source="role">${roleOptions.map((option) => `<option ${(character.aptitudeSelections.role || roleOptions[0]) === option ? "selected" : ""}>${option}</option>`).join("")}</select></label>` : ""}
          </div>
          <div class="tag-list">${rawAptitudes().map((aptitude) => `<span>${aptitude}</span>`).join("")}</div>
        </section>
        <section>
          <p class="choice-source">Duplicate replacements required: ${duplicateCount}</p>
          <div class="replacement-grid">
            ${Array.from({ length: duplicateCount }, (_, index) => `
              <label>
                <span>Replacement ${index + 1}</span>
                <select data-aptitude-replacement="${index}">
                  <option value="">Choose aptitude</option>
                  ${aptitudeChoices.map((aptitude) => `<option ${character.aptitudeReplacements[index] === aptitude ? "selected" : ""}>${aptitude}</option>`).join("")}
                </select>
              </label>`).join("") || "<p>No duplicate aptitudes require replacement.</p>"}
          </div>
        </section>
        <section>
          <p class="choice-source">Final aptitudes</p>
          <div class="tag-list final">${aptitudes.map((aptitude) => `<span>${aptitude}</span>`).join("")}</div>
        </section>
      </div>
    </div>`;
}

function splitGrant(value = "") {
  return value.split(";").map((entry) => entry.trim()).filter(Boolean);
}

const availabilityOrder = ["Ubiquitous", "Abundant", "Plentiful", "Common", "Average", "Scarce", "Rare", "Very Rare", "Extremely Rare", "Near Unique", "Unique"];

function effectiveAvailability(item) {
  const index = availabilityOrder.indexOf(item.availability);
  if (index < 0) return item.availability;
  const shift = character.background === "mechanicus" && item.category === "Cybernetics" ? -2 : 0;
  return availabilityOrder[Math.max(0, Math.min(availabilityOrder.length - 1, index + shift))];
}

function isStartingAcquisitionLegal(item) {
  const index = availabilityOrder.indexOf(effectiveAvailability(item));
  return index >= 0 && index <= availabilityOrder.indexOf("Scarce");
}

function specialSummary(special = {}) {
  return Object.entries(special)
    .filter(([, value]) => value !== false && value !== 0 && value !== null && value !== "")
    .map(([name, value]) => `${name.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}${value === true ? "" : ` (${value})`}`)
    .join(", ");
}

function itemProfileRows(item) {
  const profile = item?.profile || {};
  if (!item) return [];
  if (item.category === "Weapons") {
    return [
      ["Class", profile.class || profile.type],
      ["Type", profile.type],
      ["Range", profile.range ? `${profile.range}m` : "Melee"],
      ["Rate of Fire", profile.rateOfFire ? `${profile.rateOfFire.single > 0 ? "S" : "–"}/${profile.rateOfFire.burst > 0 ? profile.rateOfFire.burst : "–"}/${profile.rateOfFire.full > 0 ? profile.rateOfFire.full : "–"}` : ""],
      ["Damage", `${profile.damage || "—"} ${profile.damageType || ""}`.trim()],
      ["Penetration", profile.penetration],
      ["Clip", profile.clip?.max],
      ["Reload", profile.reload],
      ["Qualities", specialSummary(profile.special)],
    ];
  }
  if (item.category === "Armour") {
    const ap = profile.armourPoints || {};
    return [
      ["Type", profile.type],
      ["Armour Points", Object.entries(ap).filter(([, value]) => value).map(([location, value]) => `${location.replace(/([A-Z])/g, " $1")}: ${value}`).join(", ")],
      ["Maximum Agility", profile.maxAgility || "—"],
    ];
  }
  return Object.entries(profile)
    .filter(([key, value]) => !["description", "equipped", "modifications", "availability", "craftsmanship", "weight"].includes(key) && ["string", "number", "boolean"].includes(typeof value) && value !== "" && value !== false)
    .slice(0, 7)
    .map(([key, value]) => [key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()), value]);
}

function itemRulesSummary(item) {
  if (!item) return "";
  const description = cleanRulesSummary(item.description || item.profile?.description || "");
  if (description && description !== "Rules summary is not yet recorded.") return description;
  const profile = itemProfileRows(item)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "" && value !== "—")
    .slice(0, 6)
    .map(([label, value]) => `${label}: ${value}`)
    .join(" · ");
  return profile || `${item.category}; ${effectiveAvailability(item)} availability; ${displayWeight(item)}.`;
}

function equipmentItem(itemId) {
  return armoury.find((item) => item.id === itemId) || null;
}

function removeEquipmentState(itemId) {
  character.equipment.readiedWeapons = character.equipment.readiedWeapons.filter((id) => id !== itemId);
  character.equipment.wornArmour = character.equipment.wornArmour.filter((id) => id !== itemId);
  character.equipment.activeGear = character.equipment.activeGear.filter((id) => id !== itemId);
  delete character.equipment.weaponModAssignments[itemId];
  character.equipment.weaponModAssignments = Object.fromEntries(
    Object.entries(character.equipment.weaponModAssignments).filter(([, weaponId]) => weaponId !== itemId),
  );
}

function equipmentItemIsActive(itemId) {
  return character.equipment.readiedWeapons.includes(itemId)
    || character.equipment.wornArmour.includes(itemId)
    || character.equipment.activeGear.includes(itemId)
    || Boolean(character.equipment.weaponModAssignments[itemId]);
}

function reviewInventoryControl(item, ownedWeapons = []) {
  if (item.category === "Weapons") {
    const checked = character.equipment.readiedWeapons.includes(item.id) ? "checked" : "";
    return `<label class="inventory-state-control"><input type="checkbox" data-ready-weapon="${item.id}" ${checked} /><span>Readied</span></label>`;
  }
  if (item.category === "Armour") {
    const checked = character.equipment.wornArmour.includes(item.id) ? "checked" : "";
    return `<label class="inventory-state-control"><input type="checkbox" data-wear-armour="${item.id}" ${checked} /><span>Worn</span></label>`;
  }
  if (item.category === "Weapon Mods") {
    const assignedWeaponId = character.equipment.weaponModAssignments[item.id] || "";
    return `<label class="inventory-modification-control"><span>Installed on</span><select data-modification-target="${item.id}" aria-label="Weapon for ${escapeHtmlAttribute(item.name)}"><option value="">Not installed</option>${ownedWeapons.map((weapon) => {
      const compatibility = modificationCompatibility(item, weapon);
      return `<option value="${weapon.id}" ${assignedWeaponId === weapon.id ? "selected" : ""}>${escapeHtmlAttribute(weapon.name)}${compatibility.compatible ? "" : " · check eligibility"}</option>`;
    }).join("")}</select></label>`;
  }
  const checked = character.equipment.activeGear.includes(item.id) ? "checked" : "";
  return `<label class="inventory-state-control"><input type="checkbox" data-active-gear="${item.id}" ${checked} /><span>Worn / in use</span></label>`;
}

function modificationCompatibility(modification, weapon) {
  if (!modification || !weapon) return { compatible: false, reason: "Select an owned weapon." };
  const rules = String(modification.profile?.upgrades || "").trim();
  if (!rules) return { compatible: true, reason: "No eligibility restriction is recorded." };
  const lower = rules.toLowerCase();
  const weaponClass = String(weapon.profile?.class || "").toLowerCase();
  const weaponType = String(weapon.profile?.type || "").toLowerCase();
  const ranged = weaponClass !== "melee";
  if (/except[^.]*pistol/.test(lower) && weaponClass === "pistol") return { compatible: false, reason: rules };
  if (/except[^.]*thrown/.test(lower) && (weaponClass === "thrown" || weaponType.includes("grenade"))) return { compatible: false, reason: rules };
  if (lower.includes("any weapon")) return { compatible: true, reason: rules };
  if (lower.includes("ranged weapon") && !ranged) return { compatible: false, reason: rules };
  if (lower.includes("melee weapon") && ranged) return { compatible: false, reason: rules };

  const classNames = ["basic", "pistol", "heavy", "melee", "thrown"];
  const mentionedClasses = classNames.filter((name) => lower.includes(name));
  if (mentionedClasses.length && !mentionedClasses.includes(weaponClass)) return { compatible: false, reason: rules };

  const typeNames = ["las", "solid projectile", "bolt", "flame", "melta", "plasma", "low-tech", "power", "launcher"];
  const mentionedTypes = typeNames.filter((name) => lower.includes(name));
  if (mentionedTypes.length && !mentionedTypes.some((name) => weaponType.includes(name))) {
    return { compatible: false, reason: rules };
  }
  return { compatible: true, reason: rules };
}

function isSightModification(item) {
  return item?.category === "Weapon Mods" && /\bsight\b/i.test(item.name);
}

const carryingWeights = [0.9, 2.25, 4.5, 9, 18, 27, 36, 45, 56, 67, 78, 90, 112, 225, 337, 450, 675, 900, 1350, 1800, 2250];

function equipmentRulesState(inventoryItems = []) {
  const readiedWeapons = inventoryItems.filter((item) => character.equipment.readiedWeapons.includes(item.id));
  const wornArmour = inventoryItems.filter((item) => character.equipment.wornArmour.includes(item.id));
  const activeGear = inventoryItems.filter((item) => character.equipment.activeGear.includes(item.id));
  const weaponModifications = inventoryItems.filter((item) => item.category === "Weapon Mods");
  const assignedModifications = weaponModifications.filter((item) => character.equipment.weaponModAssignments[item.id]);
  const knownWeight = inventoryItems.reduce((sum, item) => sum + (Number.isFinite(item.weight) ? item.weight : 0), 0);
  const carryingStatsRecorded = Boolean(character.rolls.strength?.value && character.rolls.toughness?.value);
  const strengthAndToughness = Math.min(20, Math.max(0, characteristicBonus("strength") + characteristicBonus("toughness")));
  const baseCapacity = carryingStatsRecorded ? (carryingWeights[strengthAndToughness] || 0) : null;
  const hasBackpack = activeGear.some((item) => /\bbackpack\b/i.test(item.name));
  const hasCombatVest = activeGear.some((item) => /\bcombat vest\b/i.test(item.name));
  const containerCapacity = Math.max(hasBackpack ? 30 : 0, hasCombatVest ? 15 : 0);
  const carryingCapacity = carryingStatsRecorded ? baseCapacity + containerCapacity : null;
  const warnings = [];

  if (hasBackpack && hasCombatVest) {
    warnings.push({ level: "warning", message: "Only one backpack or combat vest can be worn at a time." });
  }
  if (wornArmour.length > 1) {
    warnings.push({ level: "info", message: "Multiple armour pieces may be worn, but Armour Points do not add together; use the highest AP covering each location." });
  }
  const activeFields = wornArmour.filter((item) => /force field/i.test(item.profile?.type || ""));
  if (activeFields.length > 1) {
    warnings.push({ level: "warning", message: "A character may benefit from only one force field at a time." });
  }
  const modificationsByWeapon = new Map();
  assignedModifications.forEach((modification) => {
    const weaponId = character.equipment.weaponModAssignments[modification.id];
    if (!modificationsByWeapon.has(weaponId)) modificationsByWeapon.set(weaponId, []);
    modificationsByWeapon.get(weaponId).push(modification);
    const weapon = equipmentItem(weaponId);
    const compatibility = modificationCompatibility(modification, weapon);
    if (!compatibility.compatible) {
      warnings.push({ level: "warning", message: `${modification.name} is not listed as compatible with ${weapon?.name || "the selected weapon"}. Eligibility: ${compatibility.reason}` });
    }
  });
  modificationsByWeapon.forEach((modifications, weaponId) => {
    const weapon = equipmentItem(weaponId);
    if (modifications.length > 4) warnings.push({ level: "warning", message: `${weapon?.name || "A weapon"} has more than four modifications assigned.` });
    if (modifications.filter(isSightModification).length > 1) warnings.push({ level: "warning", message: `${weapon?.name || "A weapon"} has more than one sight modification assigned.` });
  });
  weaponModifications.filter((item) => !character.equipment.weaponModAssignments[item.id]).forEach((item) => {
    warnings.push({ level: "info", message: `${item.name} is owned but has not been installed on a weapon.` });
  });
  if (carryingStatsRecorded && knownWeight > carryingCapacity) {
    warnings.push({ level: "warning", message: `Known carried weight (${knownWeight.toFixed(1)} kg) exceeds carrying capacity (${carryingCapacity} kg).` });
  }
  return {
    readiedWeapons,
    wornArmour,
    activeGear,
    weaponModifications,
    assignedModifications,
    knownWeight,
    carryingStatsRecorded,
    baseCapacity,
    containerCapacity,
    carryingCapacity,
    warnings,
  };
}

const armourHitLocations = [
  { id: "head", label: "Head", range: "01–10" },
  { id: "leftArm", label: "Left Arm", range: "21–30" },
  { id: "body", label: "Body", range: "31–70" },
  { id: "rightArm", label: "Right Arm", range: "11–20" },
  { id: "leftLeg", label: "Left Leg", range: "86–00" },
  { id: "rightLeg", label: "Right Leg", range: "71–85" },
];

function armourProtectionState(wornArmour = []) {
  return armourHitLocations.map((location) => {
    const layers = wornArmour
      .map((item) => ({
        item,
        armourPoints: Math.max(0, Number(item.profile?.armourPoints?.[location.id] || 0)),
      }))
      .filter((entry) => entry.armourPoints > 0)
      .sort((a, b) => b.armourPoints - a.armourPoints || a.item.name.localeCompare(b.item.name));
    return {
      ...location,
      layers,
      armourPoints: layers[0]?.armourPoints || 0,
      effectiveItem: layers[0]?.item || null,
    };
  });
}

function renderReviewArmour(wornArmour = []) {
  const protection = armourProtectionState(wornArmour);
  const toughnessBonus = characteristicBonus("toughness");
  const tiles = protection.map((location) => {
    const totalProtection = location.armourPoints + toughnessBonus;
    const layerRows = location.layers.length
      ? location.layers.map((entry) => [entry.item.name, `AP ${entry.armourPoints} · ${entry.item.profile?.type || "Armour"}`])
      : [["Protection", "No worn armour covers this location"]];
    const detailId = registerSheetDetail({
      kind: "Location Protection",
      name: location.label,
      summary: location.armourPoints
        ? `${location.effectiveItem.name} provides the highest worn Armour value at this location. The displayed total adds Toughness Bonus for ordinary damage reduction; Armour Points from separate worn pieces do not add together.`
        : "No worn armour covers this location, but Toughness Bonus still normally reduces damage. Penetration reduces Armour Points, not Toughness Bonus.",
      source: "Current inventory and worn-armour state",
      rows: [["Hit roll", location.range], ["Total normal reduction", totalProtection], ["Armour Points", location.armourPoints], ["Toughness Bonus", toughnessBonus], ...layerRows],
    });
    return `<button type="button" class="armour-location armour-location-${location.id}" data-sheet-detail="${detailId}" title="${escapeHtmlAttribute(`${location.label} (${location.range}): ${totalProtection} normal damage reduction (AP ${location.armourPoints} + TB ${toughnessBonus})`)}">
      <span>${location.label}</span><strong>${totalProtection}</strong><small>AP ${location.armourPoints} + TB ${toughnessBonus}</small>
    </button>`;
  }).join("");
  const covered = protection.filter((location) => location.armourPoints > 0).length;
  return `<section class="review-armour-card" aria-labelledby="review-armour-heading">
    <div class="review-vital-heading"><h3 id="review-armour-heading">Armour</h3><small>${covered}/6 locations have worn armour</small></div>
    <div class="armour-diagram" aria-label="Normal damage reduction by hit location, including Armour Points and Toughness Bonus">
      <img src="./public/assets/ui/acolyte-silhouette.svg" alt="" aria-hidden="true" />
      ${tiles}
    </div>
    <p>Total = highest worn AP + TB ${toughnessBonus} · Penetration reduces AP only</p>
  </section>`;
}

function woundStatus() {
  const threshold = Math.max(0, Number(character.wounds?.total || 0));
  const damage = Math.max(0, Number(character.combat?.damage || 0));
  return {
    threshold,
    damage,
    remaining: Math.max(0, threshold - damage),
    critical: Math.max(0, damage - threshold),
    percentRemaining: threshold ? Math.max(0, Math.min(100, ((threshold - damage) / threshold) * 100)) : 0,
  };
}

function renderReviewWounds() {
  const status = woundStatus();
  return `<section class="review-wounds-card" aria-labelledby="review-wounds-heading">
    <div class="review-vital-heading"><h3 id="review-wounds-heading">Wounds</h3></div>
    <div class="wounds-total"><strong data-wounds-remaining>${status.threshold ? status.remaining : "—"}</strong><span>/ <b data-wounds-threshold>${status.threshold || "—"}</b><small>Remaining / Threshold</small></span></div>
    <div class="wounds-track" role="img" aria-label="${status.threshold ? `${status.remaining} of ${status.threshold} Wounds remaining` : "Wounds not recorded"}"><i data-wounds-track style="--wounds-remaining:${status.percentRemaining}%"></i></div>
    <div class="wounds-controls">
      <button class="wound-adjust recover" type="button" data-adjust-damage="-1" ${status.damage <= 0 ? "disabled" : ""}>Recover</button>
      <label><span>Current Damage</span><input type="number" min="0" step="1" inputmode="numeric" data-current-damage value="${status.damage}" ${status.threshold ? "" : "disabled"} /></label>
      <button class="wound-adjust damage" type="button" data-adjust-damage="1" ${status.threshold ? "" : "disabled"}>Damage</button>
    </div>
    <p class="wounds-critical" data-wounds-critical ${status.critical ? "" : "hidden"}>Critical Damage: <strong>${status.critical}</strong></p>
  </section>`;
}

function refreshReviewWounds() {
  const status = woundStatus();
  const remaining = document.querySelector("[data-wounds-remaining]");
  const threshold = document.querySelector("[data-wounds-threshold]");
  const track = document.querySelector("[data-wounds-track]");
  const input = document.querySelector("[data-current-damage]");
  const recover = document.querySelector('[data-adjust-damage="-1"]');
  const critical = document.querySelector("[data-wounds-critical]");
  if (remaining) remaining.textContent = status.threshold ? String(status.remaining) : "—";
  if (threshold) threshold.textContent = status.threshold ? String(status.threshold) : "—";
  if (track) track.style.setProperty("--wounds-remaining", `${status.percentRemaining}%`);
  if (input && document.activeElement !== input) input.value = String(status.damage);
  if (recover) recover.disabled = status.damage <= 0;
  if (critical) {
    critical.hidden = status.critical <= 0;
    critical.querySelector("strong").textContent = String(status.critical);
  }
}

function renderReviewFate() {
  const status = fateStatus();
  const pips = Array.from({ length: status.threshold }, (_, index) => `<i class="${index < status.current ? "filled" : ""}"></i>`).join("");
  return `<section class="review-fate-card" aria-labelledby="review-fate-heading">
    <div class="review-vital-heading"><h3 id="review-fate-heading">Fate</h3><small>Spend, then restore next session</small></div>
    <div class="fate-total"><strong data-fate-current-display>${status.threshold ? status.current : "—"}</strong><span>/ <b data-fate-threshold>${status.threshold || "—"}</b><small>Current / Threshold</small></span></div>
    <div class="fate-pips" data-fate-pips role="img" aria-label="${status.threshold ? `${status.current} of ${status.threshold} Fate points available` : "Fate has not been determined"}">${pips}</div>
    <div class="fate-controls">
      <button class="fate-adjust restore" type="button" data-adjust-fate="1" ${!status.threshold || status.current >= status.threshold ? "disabled" : ""}>Restore</button>
      <label><span>Current Fate</span><input type="number" min="0" max="${status.threshold}" step="1" inputmode="numeric" data-current-fate value="${status.current}" ${status.threshold ? "" : "disabled"} /></label>
      <button class="fate-adjust spend" type="button" data-adjust-fate="-1" ${status.current <= 0 ? "disabled" : ""}>Spend</button>
    </div>
    <button class="compact-button view-fate-actions" type="button" data-open-fate-actions ${status.threshold ? "" : "disabled"}>View Fate Actions</button>
  </section>`;
}

function refreshReviewFate() {
  const status = fateStatus();
  const display = document.querySelector("[data-fate-current-display]");
  const threshold = document.querySelector("[data-fate-threshold]");
  const input = document.querySelector("[data-current-fate]");
  const restore = document.querySelector('[data-adjust-fate="1"]');
  const spend = document.querySelector('[data-adjust-fate="-1"]');
  const pips = document.querySelector("[data-fate-pips]");
  if (display) display.textContent = status.threshold ? String(status.current) : "—";
  if (threshold) threshold.textContent = status.threshold ? String(status.threshold) : "—";
  if (input && document.activeElement !== input) input.value = String(status.current);
  if (restore) restore.disabled = !status.threshold || status.current >= status.threshold;
  if (spend) spend.disabled = status.current <= 0;
  if (pips) {
    [...pips.children].forEach((pip, index) => pip.classList.toggle("filled", index < status.current));
    pips.setAttribute("aria-label", status.threshold ? `${status.current} of ${status.threshold} Fate points available` : "Fate has not been determined");
  }
}

function displayWeight(item) {
  return Number.isFinite(item?.weight) ? `${item.weight} kg` : "Weight not listed";
}

function foundryCamelCase(value = "") {
  return value
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, letter) => letter.toUpperCase())
    .replace(/^./, (letter) => letter.toLowerCase());
}

function foundryBioValue(catalogue, id) {
  return catalogue.find((entry) => entry.id === id)?.name || "";
}

function foundryDivinationName() {
  const title = currentDivination()?.title || "";
  if (title === "Only the insane have strength enough to prosper.") {
    return "Only the insane have the strength to prosper.";
  }
  return title;
}

function foundryBackgroundName() {
  const name = foundryBioValue(catalogs.backgrounds, character.background);
  return name === "Rogue Trader Fleet" ? "Rogue Trader" : name;
}

function foundryCharacteristicData(characteristicId) {
  const breakdown = characteristicBreakdown(characteristicId);
  return {
    base: breakdown.generated,
    advance: Number(character.advances.characteristics[characteristicId] || 0),
    modifier: breakdown.divination + breakdown.exceptional + breakdown.elite,
    unnatural: 0,
    cost: characteristicXpCost(characteristicId),
  };
}

function foundrySkillData() {
  const payload = {};
  const ownedRecords = ownedSkillRecords();
  for (const skill of skills) {
    const foundryKey = foundryCamelCase(skill.id);
    const characteristic = characteristics.find((entry) => entry.name === skill.characteristic);
    const characteristicShort = characteristic?.abbreviation || "";
    const baseRecord = {
      label: skill.name,
      characteristics: characteristicShort ? [characteristicShort] : [],
      characteristic: characteristicShort,
      advance: isSpecialistSkill(skill.id) ? 0 : skillRank(skill.id),
      isSpecialist: isSpecialistSkill(skill.id),
      cost: isSpecialistSkill(skill.id) ? 0 : skillXpCost(skill.id),
    };
    if (isSpecialistSkill(skill.id)) {
      const familyRecords = ownedRecords.filter((record) => record.skill.id === skill.id);
      payload[foundryKey] = {
        ...baseRecord,
        specialities: Object.fromEntries(familyRecords.map((record) => [foundryCamelCase(record.speciality || "Unspecified"), {
            label: record.speciality || "Unspecified",
            advance: record.rank,
            cost: skillXpCost(skill.id, record.speciality),
            taken: true,
            custom: !(skillSpecialities[skill.id] || []).includes(record.speciality),
          }])),
      };
    } else {
      payload[foundryKey] = { ...baseRecord, specialities: {} };
    }
  }
  return payload;
}

function foundryPsyRating() {
  if (!hasPsykerAccess()) return 0;
  return basePsyRating() + Math.max(0, Number(character.advances.psyRating || 0));
}

function psykerClass() {
  return character.background === "astra-telepathica" ? "Bound" : "Unbound";
}

function psychicStrengthProfile(effectiveRating = foundryPsyRating()) {
  const base = Math.max(1, foundryPsyRating());
  const classification = psykerClass();
  const pushLimit = classification === "Bound" ? 2 : 4;
  const effective = Math.max(1, Math.min(base + pushLimit, Number(effectiveRating || base)));
  const pushed = effective > base;
  const modifier = (base - effective) * 10;
  const risk = pushed
    ? classification === "Bound"
      ? "Pushed: Psychic Phenomena occurs on any Focus Power result except doubles."
      : "Pushed: Psychic Phenomena occurs automatically."
    : "Normal strength: Psychic Phenomena occurs when the Focus Power dice show doubles.";
  return { base, effective, classification, pushLimit, pushed, modifier, risk };
}

function psychicPhenomenaTriggered(roll, profile) {
  if (!profile) return false;
  const doubles = roll === 100 || (roll > 0 && roll % 11 === 0);
  if (!profile.pushed) return doubles;
  return profile.classification === "Bound" ? !doubles : true;
}

function basePsyRating() {
  if (!hasPsykerAccess()) return 0;
  return character.background === "astra-telepathica" ? 2 : 1;
}

function psyRatingXpCost() {
  const base = basePsyRating();
  const advances = Math.max(0, Number(character.advances.psyRating || 0));
  let cost = 0;
  for (let rating = base + 1; rating <= base + advances; rating += 1) cost += rating * 200;
  return cost;
}

function parseSpecialAbility([source, value]) {
  const [namePart, ...benefitParts] = String(value || "").split(/\s*(?:·|—|:)\s*/);
  const name = benefitParts.length && namePart.length <= 80 ? namePart : `${source} Ability`;
  const benefit = benefitParts.length ? benefitParts.join(" — ") : String(value || "");
  return { name, benefit, source };
}

function foundrySpecialAbility(entry) {
  const { name, benefit, source } = parseSpecialAbility(entry);
  return {
    name,
    type: "specialAbility",
    system: {
      description: benefit,
      benefit,
    },
    flags: { dh2CharacterBuilder: { initial: true, source } },
  };
}

function foundryEquipmentItem(item) {
  const provenance = equipmentProvenance(item.id);
  const installedOnId = character.equipment.weaponModAssignments[item.id] || "";
  const installedOn = equipmentItem(installedOnId);
  const assignedModifications = item.category === "Weapons"
    ? Object.entries(character.equipment.weaponModAssignments)
      .filter(([, weaponId]) => weaponId === item.id)
      .map(([modId]) => equipmentItem(modId)?.name)
      .filter(Boolean)
    : [];
  return {
    name: item.name,
    type: item.documentType,
    system: {
      ...item.profile,
      description: item.description || item.profile?.description || "",
      availability: item.availability,
      craftsmanship: item.craftsmanship,
      weight: item.weight ?? 0,
      equipped: equipmentItemIsActive(item.id),
      ...(item.category === "Weapon Mods" ? { installed: Boolean(installedOnId) } : {}),
      ...(item.category === "Weapons" ? { modifications: assignedModifications } : {}),
    },
    flags: {
      dh2CharacterBuilder: {
        source: item.source,
        category: item.category,
        inventorySource: provenance.type,
        grantedBy: provenance.grant?.sourceName || "",
        sourceDetail: provenance.detail,
        readied: character.equipment.readiedWeapons.includes(item.id),
        worn: character.equipment.wornArmour.includes(item.id),
        activeGear: character.equipment.activeGear.includes(item.id),
        installedOn: installedOn?.name || "",
        installedOnBuilderId: installedOnId,
      },
    },
  };
}

function foundryUnlinkedGrantedEquipment() {
  return (character.equipment.unlinkedCharacterCreationGrants || []).map((entry) => ({
    name: entry.label,
    type: "tool",
    system: {
      description: `${entry.sourceName} starting equipment. The builder preserved this grant as written because no unambiguous Armoury entry was available.`,
      availability: "",
      craftsmanship: "Common",
      weight: 0,
      equipped: false,
    },
    flags: {
      dh2CharacterBuilder: {
        initial: true,
        inventorySource: entry.sourceType,
        grantedBy: entry.sourceName,
        sourceDetail: entry.sourceType === "background-choice" ? "Selected starting-equipment choice" : "Starting equipment",
        unresolvedArmouryLink: true,
      },
    },
  }));
}

function hasPsykerAccess() {
  return hasEliteAdvance("psyker");
}

function eliteAdvanceStatus(advance) {
  const automaticGrant = automaticEliteAdvances().find((entry) => entry.id === advance.id);
  if (automaticGrant) return { missing: [], owned: true, automatic: true };
  const missing = [];
  const activeIds = new Set(activeEliteAdvances().map((entry) => entry.id));
  for (const [id, minimum] of Object.entries(advance.prerequisites?.characteristics || {})) {
    if (characteristicValue(id) < minimum) missing.push(`${characteristics.find((entry) => entry.id === id)?.name || id} ${minimum}`);
  }
  if (advance.prerequisites?.background && character.background !== advance.prerequisites.background) {
    missing.push(`${catalogs.backgrounds.find((entry) => entry.id === advance.prerequisites.background)?.name || advance.prerequisites.background} background`);
  }
  for (const id of advance.prerequisites?.elite || []) {
    if (!activeIds.has(id)) missing.push(`${eliteAdvanceById(id)?.name || id} Elite Advance`);
  }
  for (const id of advance.prerequisites?.excludes || []) {
    if (activeIds.has(id)) missing.push(`Incompatible with ${eliteAdvanceById(id)?.name || id}`);
  }
  if (!character.eliteSetup.gmApproved?.[advance.id] && !advance.automatic) missing.push("GM approval");
  return { missing: [...new Set(missing)], owned: activeIds.has(advance.id) };
}

function purchasedPsychicPowerIds() {
  return new Set(character.advances.psychicPowers.map((entry) => entry?.id).filter(Boolean));
}

function psychicPowerStatus(power) {
  const missing = [];
  const prerequisites = power.prerequisite || {};
  if (!hasPsykerAccess()) missing.push("Psyker Elite Advance");
  if (power.discipline === "Astropath" && !hasEliteAdvance("astropath")) missing.push("Astropath Elite Advance");
  if (power.discipline === "Malefic Daemonology" && !character.eliteSetup.maleficApproved) missing.push("GM approval for Malefic Daemonology");
  if (prerequisites.psyRating && foundryPsyRating() < prerequisites.psyRating) missing.push(`Psy Rating ${prerequisites.psyRating}`);
  for (const [id, minimum] of Object.entries(prerequisites.characteristics || {})) {
    if (characteristicValue(id) < minimum) missing.push(`${characteristics.find((entry) => entry.id === id)?.name || id} ${minimum}`);
  }
  for (const [id, rank] of Object.entries(prerequisites.skills || {})) {
    if (skillRank(id) < rank) missing.push(`${skills.find((entry) => entry.id === id)?.name || id} ${rankNames[rank - 1] || `rank ${rank}`}`);
  }
  for (const name of prerequisites.talents || []) if (!hasTalentNamed(name)) missing.push(name);
  for (const id of prerequisites.elite || []) if (!hasEliteAdvance(id)) missing.push(`${eliteAdvanceById(id)?.name || id} Elite Advance`);
  if (prerequisites.corruption && Number(character.conditions.corruption || 0) < prerequisites.corruption) missing.push(`${prerequisites.corruption} Corruption points`);
  if (prerequisites.insanity && Number(character.conditions.insanity || 0) < prerequisites.insanity) missing.push(`${prerequisites.insanity} Insanity points`);
  const ownedIds = purchasedPsychicPowerIds();
  for (const id of prerequisites.powers || []) if (!ownedIds.has(id)) missing.push(psychicPowerById(id)?.name || id);
  if (power.path?.length && !power.path.some((id) => ownedIds.has(id))) {
    const names = power.path.map((id) => psychicPowerById(id)?.name || id);
    missing.push(`Power path: ${names.join(" or ")}`);
  }
  return { missing: [...new Set(missing)], owned: ownedIds.has(power.id) };
}

function focusPowerTest(power) {
  const focus = String(power.focus || "");
  const modifierText = focus.match(/\(([+–-]?\d+)\)/)?.[1]?.replace("–", "-") || "0";
  const modifier = Number(modifierText || 0);
  const skill = skills.find((entry) => new RegExp(`\\b${entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(focus));
  if (skill) {
    const test = skillActionTest(skill, "");
    return { ...test, actionModifier: test.actionModifier + modifier, characteristicName: `Focus Power · ${skill.name}`, psychicPowerId: power.id };
  }
  const characteristic = characteristics.find((entry) => new RegExp(`\\b${entry.name}\\b`, "i").test(focus))
    || characteristics.find((entry) => entry.id === "willpower");
  return actionTestRecord(characteristic.id, modifier, { characteristicName: `Focus Power · ${skill?.name || characteristic.name}`, psychicPowerId: power.id });
}

function currentTalentRecords() {
  return [
    ...Object.values(resolvedGrantedTalents()).map((talent) => ({
      id: talent.id,
      name: talent.displayName || talent.name,
      benefit: talent.benefit,
      source: talent.ruleSource || talent.source,
      initial: true,
    })),
    ...paidTalentAdvanceEntries().map((entry) => {
      const talent = talentCatalogue.find((candidate) => candidate.id === entry?.id);
      return talent ? { ...talent, initial: false } : null;
    }).filter(Boolean),
  ];
}

function hasTalentNamed(name) {
  const sought = String(name || "").toLowerCase();
  return currentTalentRecords().some((talent) => String(talent.name || "").toLowerCase().includes(sought));
}

function weaponIsMelee(weapon) {
  return String(weapon?.profile?.class || "").toLowerCase() === "melee";
}

function weaponIsRanged(weapon) {
  return Boolean(weapon) && !weaponIsMelee(weapon) && weapon.category === "Weapons";
}

function weaponTrainingModifier(weapon) {
  if (!weapon) return 0;
  const type = String(weapon.profile?.type || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const training = currentTalentRecords()
    .map((talent) => String(talent.name || ""))
    .filter((name) => /weapon training/i.test(name));
  if (training.some((name) => {
    const normalised = name.toLowerCase().replace(/[^a-z0-9]+/g, " ");
    return type && normalised.includes(type);
  })) return 0;
  return -20;
}

function actionTestRecord(characteristicId, modifier = 0, extra = {}) {
  const characteristic = characteristics.find((entry) => entry.id === characteristicId);
  return {
    characteristicId,
    characteristicName: characteristic?.name || characteristicId,
    baseTarget: characteristicValue(characteristicId),
    actionModifier: Number(modifier || 0),
    ...extra,
  };
}

function skillActionTest(skill, speciality = "") {
  const rank = skillRank(skill.id, speciality);
  const characteristic = characteristics.find((entry) => entry.name === skill.characteristic);
  const trainedBonus = rank > 0 ? (rank - 1) * 10 : -20;
  return actionTestRecord(characteristic?.id, trainedBonus, {
    characteristicName: speciality ? `${skill.name} (${speciality})` : skill.name,
    skillId: skill.id,
    speciality,
    rank,
    untrained: rank === 0,
  });
}

function actionAvailability(record, context) {
  let available = true;
  let reason = "";
  if (record.requirement === "heavyWeapon" && !context.heavyWeapons.length) {
    available = false;
    reason = "No readied Heavy weapon.";
  } else if (record.requirement === "meleeWeapon" && !context.meleeWeapons.length) {
    available = false;
    reason = "No melee weapon is currently readied.";
  } else if (record.requirement === "rangedWeapon" && !context.rangedWeapons.length) {
    available = false;
    reason = "No ranged weapon is currently readied.";
  } else if (record.requirement === "psyker" && !hasPsykerAccess()) {
    available = false;
    reason = "Requires the Psyker elite advance.";
  } else if (record.requirement === "lightningAttack" && !hasTalentNamed("Lightning Attack")) {
    available = false;
    reason = "Requires the Lightning Attack talent.";
  } else if (record.requirement === "swiftAttack" && !hasTalentNamed("Swift Attack")) {
    available = false;
    reason = "Requires the Swift Attack talent.";
  }
  if (record.test?.baseTarget === 0) {
    available = false;
    reason = `${record.test.characteristicName || "Required characteristic"} has not been determined.`;
  }
  return { available, unavailableReason: reason };
}

function staticCombatActionRecords(context) {
  return combatActionCatalogue.map((definition) => {
    const record = {
      ...definition,
      source: actionSource,
      context: "Standard combat option",
      test: definition.test ? actionTestRecord(definition.test.characteristicId, definition.test.modifier, definition.test) : null,
    };
    if (definition.skillId) {
      const skill = skills.find((entry) => entry.id === definition.skillId);
      if (skill) {
        record.test = skillActionTest(skill);
        record.context = record.test.untrained ? `${skill.name} is untrained (-20)` : `${skill.name}: ${rankNames[record.test.rank - 1]}`;
      }
    }
    if (definition.dynamicType === "ready" && hasTalentNamed("Quick Draw")) {
      record.type = "Half Action / Free to draw weapon";
      record.context = "Quick Draw changes drawing a weapon to a Free Action; other Ready uses remain Half Actions.";
    }
    if (definition.dynamicType === "stand" && hasTalentNamed("Leap Up")) {
      record.type = "Half Action / Free to stand";
      record.context = "Leap Up changes standing from Prone to a Free Action; mounting and dismounting remain Half Actions.";
    }
    if (definition.dynamicType === "reload" && context.rangedWeapons.length) {
      record.context = context.rangedWeapons.map((weapon) => `${weapon.name}: ${weapon.profile?.reload || "reload time not recorded"}`).join(" · ");
      if (hasTalentNamed("Rapid Reload")) record.context += " · Rapid Reload halves these times.";
    }
    const state = actionAvailability(record, context);
    return { ...record, ...state };
  });
}

function weaponAttackRecord(weapon, mode, options = {}) {
  const readied = character.equipment.readiedWeapons.includes(weapon.id);
  const melee = weaponIsMelee(weapon);
  const characteristicId = melee ? "weaponSkill" : "ballisticSkill";
  const trainingModifier = weaponTrainingModifier(weapon);
  const actionModifier = Number(options.modifier || 0) + trainingModifier;
  const baseTarget = characteristicValue(characteristicId);
  const installedMods = Object.entries(character.equipment.weaponModAssignments)
    .filter(([, weaponId]) => weaponId === weapon.id)
    .map(([modId]) => equipmentItem(modId)?.name)
    .filter(Boolean);
  let reason = "";
  if (!readied) reason = `${weapon.name} is carried but not readied.`;
  else if (!baseTarget) reason = `${melee ? "Weapon Skill" : "Ballistic Skill"} has not been determined.`;
  const profile = weapon.profile || {};
  return {
    id: `weapon-${weapon.id}-${mode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: `${mode} - ${weapon.name}`,
    group: "Attacks",
    type: options.type || "Half Action",
    subtypes: ["Attack", melee ? "Melee" : "Ranged"],
    summary: options.summary || `Attack with ${weapon.name}.`,
    source: `${actionSource}; ${weapon.source || "Armoury"}`,
    context: [
      `${melee ? "WS" : "BS"} ${baseTarget || "not set"}`,
      trainingModifier ? "Untrained weapon -20" : "Weapon training matched",
      installedMods.length ? `Installed: ${installedMods.join(", ")}` : "",
    ].filter(Boolean).join(" · "),
    available: readied && Boolean(baseTarget),
    unavailableReason: reason,
    test: actionTestRecord(characteristicId, actionModifier, {
      weaponId: weapon.id,
      weaponName: weapon.name,
      mode,
      hitMode: options.hitMode || "single",
      calledShot: Boolean(options.calledShot),
      trainingModifier,
      inherentModifier: Number(options.modifier || 0),
      rateOfFire: profile.rateOfFire || {},
    }),
  };
}

function weaponActionRecords(inventoryItems) {
  const records = [];
  inventoryItems.filter((item) => item.category === "Weapons").forEach((weapon) => {
    const profile = weapon.profile || {};
    const melee = weaponIsMelee(weapon);
    const canSingle = melee || Number(profile.rateOfFire?.single || 0) > 0;
    if (canSingle) {
      records.push(weaponAttackRecord(weapon, "Standard Attack", {
        modifier: 10,
        summary: `Make one ${melee ? "melee" : "ranged"} attack with ${weapon.name} at +10.`,
      }));
      records.push(weaponAttackRecord(weapon, "Called Shot", {
        type: "Full Action",
        modifier: -20,
        calledShot: true,
        summary: `Attack a declared hit location with ${weapon.name} at -20.`,
      }));
    }
    if (!melee && Number(profile.rateOfFire?.burst || 0) > 0) {
      records.push(weaponAttackRecord(weapon, "Semi-Auto Burst", {
        modifier: 0,
        hitMode: "semi",
        summary: `Fire up to ${profile.rateOfFire.burst} rounds; additional Degrees of Success can score additional hits.`,
      }));
      records.push(weaponAttackRecord(weapon, "Suppressing Fire", {
        type: "Full Action",
        modifier: -20,
        hitMode: "suppressing",
        summary: `Fill a firing arc with ${weapon.name}; targets test against Pinning and successful fire can strike random targets.`,
      }));
    }
    if (!melee && Number(profile.rateOfFire?.full || 0) > 0) {
      records.push(weaponAttackRecord(weapon, "Full Auto Burst", {
        modifier: -10,
        hitMode: "full",
        summary: `Fire up to ${profile.rateOfFire.full} rounds; each Degree of Success can score a hit.`,
      }));
    }
  });
  const weaponSkill = characteristicValue("weaponSkill");
  records.push({
    id: "weapon-unarmed-standard",
    name: "Standard Attack - Unarmed",
    group: "Attacks",
    type: "Half Action",
    subtypes: ["Attack", "Melee"],
    summary: "Make one unarmed melee attack at +10 Weapon Skill.",
    source: actionSource,
    context: `WS ${weaponSkill || "not set"} · No Weapon Training required`,
    available: Boolean(weaponSkill),
    unavailableReason: weaponSkill ? "" : "Weapon Skill has not been determined.",
    test: actionTestRecord("weaponSkill", 10, { mode: "Standard Attack", hitMode: "single", unarmed: true }),
  });
  return records;
}

function skillActionRecords() {
  return ownedSkillRecords()
    .filter((record) => !["dodge", "parry"].includes(record.skill.id))
    .map((record) => {
      const test = skillActionTest(record.skill, record.speciality);
      return {
        id: `skill-${record.key}`,
        name: record.displayName,
        group: "Skills",
        type: "Varies by task",
        subtypes: ["Concentration", "Miscellaneous"],
        summary: ruleTermsById[`skill-${record.skill.id}`]?.summary || `Use ${record.displayName} to attempt an appropriate task.`,
        source: ruleTermsById[`skill-${record.skill.id}`] ? `${ruleTermsById[`skill-${record.skill.id}`].book}, skill description` : "Character skill",
        context: `${rankNames[record.rank - 1]} · target ${test.baseTarget + test.actionModifier}`,
        available: Boolean(test.baseTarget),
        unavailableReason: test.baseTarget ? "" : `${record.skill.characteristic} has not been determined.`,
        test,
      };
    });
}

function characteristicActionRecords() {
  return characteristics.map((entry) => {
    const value = characteristicValue(entry.id);
    return {
      id: `characteristic-test-${entry.id}`,
      name: `${entry.name} Test`,
      group: "Skills",
      type: "Varies by task",
      subtypes: ["Test"],
      summary: ruleTermsById[`characteristic-${entry.id.replace(/([A-Z])/g, "-$1").toLowerCase()}`]?.summary || `Make a test using ${entry.name}.`,
      source: "Core Rulebook, pp. 21-24",
      context: `${entry.abbreviation} ${value || "not set"}`,
      available: Boolean(value),
      unavailableReason: value ? "" : `${entry.name} has not been determined.`,
      test: actionTestRecord(entry.id, 0),
    };
  });
}

function fateUseMetadata(record = {}) {
  const text = [record.name, record.summary, record.context].filter(Boolean).join(" ");
  const referencesFateSpend = /\b(?:spend|spends|spending|spent)\b.{0,18}\bfate\b/i.test(text);
  const spendsFate = Boolean(record.spendsFate)
    || /^\s*spend\s+fate\b/i.test(record.name || "")
    || /\b(?:may|can|must)\s+spend\b.{0,18}\bfate\b/i.test(text)
    || /\bspend\s+(?:a|one|1)\s+fate\s+point\s+to\b/i.test(text);
  const burnsFate = /\b(?:burn|burns|burning|burned|burnt)\b.{0,18}\bfate\b/i.test(text);
  return {
    usesFate: Boolean(record.usesFate || referencesFateSpend || burnsFate),
    spendsFate,
    burnsFate: Boolean(record.burnsFate || burnsFate),
  };
}

function capabilityActionRecords(inventoryItems) {
  const fateThreshold = finalFateThreshold();
  const currentFate = currentFatePoints();
  const fateOptions = [
    ["fate-reroll", "Spend Fate - Re-roll", "Re-roll one test; the second result must be used."],
    ["fate-plus-ten", "Spend Fate - Gain +10", "Gain +10 on a test when declared before the dice are rolled."],
    ["fate-add-dos", "Spend Fate - Add 1 Degree of Success", "Add one Degree of Success to a successful test after the dice are rolled."],
    ["fate-initiative", "Spend Fate - Initiative 10", "Count as having rolled 10 for Initiative."],
    ["fate-heal", "Spend Fate - Recover Damage", "Immediately remove 1d5 Damage; this cannot remove Critical Damage."],
    ["fate-stunned", "Spend Fate - Recover from Stunned", "Immediately recover from being Stunned."],
    ["fate-fatigue", "Spend Fate - Remove Fatigue", "Remove all levels of Fatigue."],
    ["fate-burn", "Burn Fate - Survive", "Permanently reduce Fate Threshold by 1 to survive an otherwise certain death, subject to the GM's narration and consequences."],
  ].map(([id, name, summary]) => {
    const burnsFate = name.startsWith("Burn");
    const available = burnsFate ? fateThreshold > 0 : currentFate > 0;
    return {
      id,
      name,
      group: "Abilities",
      type: name.startsWith("Spend") ? "Free Action" : "Special",
      subtypes: [],
      summary,
      source: "Core Rulebook, p. 293",
      context: fateThreshold
        ? burnsFate
          ? `Fate ${currentFate}/${fateThreshold} · burning Fate permanently reduces the threshold`
          : `Fate ${currentFate}/${fateThreshold} · costs 1 current Fate point`
        : "Fate Threshold has not been determined",
      available,
      unavailableReason: fateThreshold ? burnsFate ? "" : "No current Fate points remain." : "Determine Fate Threshold first.",
      usesFate: true,
      spendsFate: !burnsFate,
      burnsFate,
      test: null,
    };
  });
  const abilities = [
    ...currentTalentRecords().map((talent) => ({
      id: `talent-${talent.id || talent.name}`,
      name: talent.name,
      type: "Talent",
      summary: talent.benefit || "Character talent.",
      source: talent.source || "Character talent",
      context: talent.initial ? "Granted during character creation" : "Purchased with XP",
    })),
    ...[...automaticTraits(), ...equipmentGrantedTraits()].map((trait) => ({
      id: `trait-${trait.name}`,
      name: trait.name,
      type: trait.conditional ? "Equipment Trait" : "Trait",
      summary: trait.summary,
      source: trait.source,
      context: trait.conditional ? "Active only while its equipment is in use" : "Always active",
    })),
    ...[
      ["Home World", ruleValue(character.homeWorld, "Home World Bonus")],
      ["Background", ruleValue(character.background, "Background Bonus")],
      ["Role", ruleValue(character.role, "Role Bonus")],
    ].filter(([, value]) => value).map((entry) => {
      const ability = parseSpecialAbility(entry);
      return { id: `ability-${entry[0].toLowerCase().replace(/\s+/g, "-")}`, name: ability.name, type: "Special Ability", summary: ability.benefit, source: ability.source, context: `${entry[0]} choice` };
    }),
  ].map((entry) => ({ ...entry, group: "Abilities", subtypes: [], available: true, unavailableReason: "", test: null }));

  const usableGear = inventoryItems
    .filter((item) => !["Weapons", "Armour", "Weapon Mods"].includes(item.category))
    .map((item) => {
      const summary = itemRulesSummary(item);
      const type = /full action/i.test(summary) ? "Full Action" : /half action/i.test(summary) ? "Half Action" : /free action/i.test(summary) ? "Free Action" : "Varies by use";
      return {
        id: `gear-${item.id}`,
        name: `Use ${item.name}`,
        group: "Utility",
        type,
        subtypes: ["Miscellaneous"],
        summary,
        source: item.source || "Owned equipment",
        context: character.equipment.activeGear.includes(item.id) ? "Currently worn or in use" : "Carried in inventory",
        available: true,
        unavailableReason: "",
        test: null,
      };
    });
  return [...fateOptions, ...abilities, ...usableGear];
}

function psychicActionRecords() {
  return character.advances.psychicPowers.map((entry, index) => psychicPowerById(entry.id) || entry).filter((power) => power?.name).map((power, index) => ({
    id: `psychic-${power.id || index}-${String(power.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: `Manifest ${power.name}`,
    group: "Psychic",
    type: power.action || "Use power profile",
    subtypes: [...new Set([...(String(power.subtype || "Concentration").split(/\s*,\s*/)), "Psychic"])],
    summary: power.summary || power.description || "Manifest this known psychic power using its Focus Power profile.",
    source: power.page ? `${power.source}, p. ${power.page}` : power.source || "Psychic power advancement",
    context: `Psy Rating ${foundryPsyRating()} · ${power.focus || "Use the recorded Focus Power profile"} · Range ${power.range || "varies"}${power.sustained ? ` · Sustained ${power.sustained}` : ""}`,
    available: hasPsykerAccess(),
    unavailableReason: hasPsykerAccess() ? "" : "Requires the Psyker elite advance.",
    test: power.focus ? focusPowerTest(power) : null,
  }));
}

function derivedCharacterActions(inventoryItems = character.equipment.inventory.map((id) => equipmentItem(id)).filter(Boolean)) {
  const readied = inventoryItems.filter((item) => character.equipment.readiedWeapons.includes(item.id));
  const context = {
    readied,
    meleeWeapons: readied.filter(weaponIsMelee),
    rangedWeapons: readied.filter(weaponIsRanged),
    heavyWeapons: readied.filter((weapon) => String(weapon.profile?.class || "").toLowerCase() === "heavy"),
  };
  const records = [
    ...weaponActionRecords(inventoryItems),
    ...staticCombatActionRecords(context),
    ...characteristicActionRecords(),
    ...skillActionRecords(),
    ...psychicActionRecords(),
    ...capabilityActionRecords(inventoryItems),
  ];
  if (hasTalentNamed("Technical Knock") && context.rangedWeapons.length) {
    records.push({
      id: "talent-clear-jam",
      name: "Clear Weapon Jam",
      group: "Utility",
      type: "Half Action",
      subtypes: ["Miscellaneous"],
      summary: "Use Technical Knock to clear a jam as a Half Action instead of a Full Action.",
      source: "Technical Knock talent; Core Rulebook combat rules",
      context: context.rangedWeapons.map((weapon) => weapon.name).join(", "),
      available: true,
      unavailableReason: "",
      test: actionTestRecord("ballisticSkill", 0),
    });
  }
  const fate = fateStatus();
  const normalizedRecords = records.map((record) => {
    const metadata = fateUseMetadata(record);
    if (!metadata.spendsFate && !metadata.burnsFate) return { ...record, ...metadata };
    const fateAvailable = metadata.burnsFate ? fate.threshold > 0 : fate.current > 0;
    return {
      ...record,
      ...metadata,
      available: Boolean(record.available && fateAvailable),
      unavailableReason: record.available && !fateAvailable
        ? metadata.burnsFate ? "No Fate Threshold remains to burn." : "No current Fate points remain."
        : record.unavailableReason,
    };
  });
  const groupOrder = new Map(actionGroups.map((group, index) => [group, index]));
  return normalizedRecords.sort((a, b) => (groupOrder.get(a.group) ?? 99) - (groupOrder.get(b.group) ?? 99) || a.name.localeCompare(b.name));
}

function serialisableCharacterActions(actions = derivedCharacterActions()) {
  return actions.map((record) => {
    const section = actionSectionPresentation(record);
    return {
      id: record.id,
      name: record.name,
      group: record.group,
      section: section.key,
      sectionLabel: section.title,
      actionType: record.type,
      subtypes: record.subtypes || [],
      summary: record.summary,
      source: record.source,
      context: record.context,
      available: Boolean(record.available),
      usesFate: Boolean(record.usesFate),
      spendsFate: Boolean(record.spendsFate),
      burnsFate: Boolean(record.burnsFate),
      unavailableReason: record.unavailableReason || record.reason || "",
      test: record.test ? { ...record.test } : null,
    };
  });
}

function resolvedActionTest(test, situationalModifier = 0, fateModifier = 0) {
  const actionModifier = Number(test?.actionModifier || 0);
  const situational = Number(situationalModifier || 0);
  const fate = Number(fateModifier || 0);
  const combinedModifier = Math.max(-60, Math.min(60, actionModifier + situational + fate));
  return {
    baseTarget: Number(test?.baseTarget || 0),
    actionModifier,
    situationalModifier: situational,
    fateModifier: fate,
    combinedModifier,
    target: Number(test?.baseTarget || 0) + combinedModifier,
  };
}

function testOutcome(roll, target) {
  const success = roll === 1 || (roll !== 100 && roll <= target);
  const targetTens = Math.floor(target / 10);
  const rollTens = Math.floor(roll / 10);
  const degrees = success
    ? Math.max(1, 1 + targetTens - rollTens)
    : Math.max(1, 1 + rollTens - targetTens);
  return { success, degrees, label: `${degrees} Degree${degrees === 1 ? "" : "s"} of ${success ? "Success" : "Failure"}` };
}

function attackHitCount(test, degrees) {
  const cap = test?.hitMode === "semi" || test?.hitMode === "suppressing"
    ? Number(test.rateOfFire?.burst || 1)
    : test?.hitMode === "full"
      ? Number(test.rateOfFire?.full || 1)
      : ["swift", "lightning"].includes(test?.hitMode)
        ? Math.max(1, characteristicBonus("weaponSkill"))
        : 1;
  if (test?.hitMode === "semi" || test?.hitMode === "suppressing" || test?.hitMode === "swift") return Math.min(cap, 1 + Math.floor((degrees - 1) / 2));
  if (test?.hitMode === "full" || test?.hitMode === "lightning") return Math.min(cap, degrees);
  return 1;
}

function attackHitLocation(roll) {
  if (roll === 100) return "Left Leg";
  const reversed = Number(String(roll).padStart(2, "0").split("").reverse().join(""));
  if (reversed <= 10) return "Head";
  if (reversed <= 20) return "Right Arm";
  if (reversed <= 30) return "Left Arm";
  if (reversed <= 70) return "Body";
  if (reversed <= 85) return "Right Leg";
  return "Left Leg";
}

function expandSpecialistGrantOption(option) {
  const cleaned = option.replace(/^.*?·\s*Gain\s+/i, "").replace(/\.$/, "").trim();
  if (/^one\s+alien\s+language$/i.test(cleaned)) {
    return ["Eldar", "Kroot", "Ork", "Tau"].map((speciality) => `Linguistics (${speciality})`);
  }
  const skill = skillForGrant(cleaned);
  if (!skill || !isSpecialistSkill(skill.id) || (cleaned.includes("(") && !/pick one|choose/i.test(cleaned))) return [cleaned];
  return (skillSpecialities[skill.id] || []).map((speciality) => `${skill.name} (${speciality})`);
}

function grantAlternatives() {
  const sources = [
    ["background-skills", "Background skill", ruleValue(character.background, "Starting Skills")],
    ["background-equipment", "Background equipment", ruleValue(character.background, "Starting Equipment")],
    ["role-talent", "Role talent", ruleValue(character.role, "Talent Choice")],
    ["homeworld-bonus", "Home World option", ruleValue(character.homeWorld, "Home World Bonus")],
  ];
  const alternatives = [];
  for (const [sourceId, label, value] of sources) {
    splitGrant(value).forEach((entry, index) => {
      const hasEitherOr = /\sor\s/i.test(entry);
      const specialistPlaceholder = sourceId === "background-skills" && (/pick one|^one\s+(?:forbidden lore|scholastic lore|trade|operate|navigate|common lore|linguistics)|^one\s+alien\s+language/i.test(entry));
      if (!hasEitherOr && !specialistPlaceholder) return;
      let options = (hasEitherOr ? entry.split(/\s+or\s+/i) : [entry])
        .map((option) => option.replace(/^.*?·\s*Gain\s+/i, "").replace(/\.$/, "").trim())
        .filter(Boolean);
      if (sourceId === "background-skills") options = options.flatMap(expandSpecialistGrantOption);
      if (options.length < 2) return;
      alternatives.push({ id: `${sourceId}-${index}`, sourceId, label, source: entry, options });
    });
  }
  return alternatives;
}

function talentForGrantOption(option = "") {
  const direct = talentByName(option);
  if (direct) return direct;
  const target = normaliseItemName(option);
  return [...talentCatalogue]
    .sort((a, b) => b.name.length - a.name.length)
    .find((talent) => {
      const name = normaliseItemName(talent.name);
      return target === name || target.endsWith(` ${name}`) || target.includes(` ${name} `);
    });
}

function renderStartingTalentComparison(choice) {
  const talents = choice.options.map((option) => ({ option, talent: talentForGrantOption(option) }));
  if (!talents.every((entry) => entry.talent)) return "";
  const selected = character.grantChoices[choice.id] || "";
  return `<section class="starting-talent-comparison" aria-label="Compare talent choices">
    <p><strong>Choose one free starting talent.</strong> Compare what each option lets your Acolyte do before making the selection above.</p>
    <div class="starting-talent-options">
      ${talents.map(({ option, talent }) => `<article class="starting-talent-option ${selected === option ? "selected" : ""}" ${selected === option ? 'aria-current="true"' : ""}>
        <header><strong>${escapeHtmlAttribute(option)}</strong><span>${selected === option ? "Selected" : `Tier ${talent.tier}`}</span></header>
        <p>${escapeHtmlAttribute(cleanRulesSummary(talent.benefit) || "No mechanical summary is recorded.")}</p>
        <footer><span>${talent.aptitudes.join(" · ") || "No aptitudes recorded"}</span><small>${talent.source || "Source not recorded"}</small></footer>
      </article>`).join("")}
    </div>
  </section>`;
}

function renderStartingConsequences() {
  const panels = [];
  if (character.homeWorld === "daemon-world") {
    panels.push(`<section class="grant-panel exceptional-panel">
      <h2>Daemon World Corruption</h2>
      <p>Touched by the Warp grants Psyniscience and 1d10+5 starting Corruption.</p>
      <div class="dual-actions"><button class="compact-button" type="button" data-roll-daemon-corruption>Roll 1d10+5</button><label class="manual-result"><span>Enter total</span><input type="number" min="6" max="15" value="${character.exceptional?.daemonWorldCorruption || ""}" data-daemon-corruption /></label></div>
      ${character.exceptional?.daemonWorldCorruption ? `<div class="applied-change"><span>Applied automatically</span><strong>Corruption +${character.exceptional.daemonWorldCorruption}</strong></div>` : ""}
    </section>`);
  }
  if (character.background === "mutant") {
    const mutation = selectedMutationRecord();
    panels.push(`<section class="grant-panel exceptional-panel">
      <h2>Mutant Traits and Mutation</h2>
      <p>Choose one starting trait, record 10 Corruption, then roll 5d10 on the Mutation table.</p>
      <label><span>Starting trait</span><select data-mutant-trait><option value="">Choose...</option>${mutantStartingTraits.map((entry) => `<option value="${entry.id}" ${character.exceptional?.mutantTraitId === entry.id ? "selected" : ""}>${entry.name}</option>`).join("")}</select></label>
      <div class="dual-actions"><button class="compact-button" type="button" data-roll-mutation>Roll 5d10</button><label class="manual-result"><span>Enter total</span><input type="number" min="5" max="50" value="${character.exceptional?.mutationRoll || ""}" data-mutation-roll /></label></div>
      ${character.exceptional?.mutationDice?.length ? `<small>Dice: ${character.exceptional.mutationDice.join(", ")}</small>` : ""}
      ${renderExceptionalResult(mutation, "mutation")}
      <div class="applied-change"><span>Applied automatically</span><strong>Corruption +10</strong></div>
    </section>`);
  }
  if (character.background === "exorcised") {
    const malignancy = selectedMalignancyRecord("starting");
    panels.push(`<section class="grant-panel exceptional-panel">
      <h2>Starting Malignancy</h2>
      <p>The Exorcised background begins with one Malignancy chosen from Table 8-15.</p>
      <label><span>Malignancy</span><select data-starting-malignancy><option value="">Choose...</option>${malignancies.map((entry) => `<option value="${entry.id}" ${character.exceptional?.startingMalignancyId === entry.id ? "selected" : ""}>${entry.name}</option>`).join("")}</select></label>
      ${renderExceptionalResult(malignancy, "starting")}
    </section>`);
  }
  if (!panels.length) return "";
  return `<div class="starting-consequences" aria-label="Starting consequences">${panels.join("")}</div>`;
}

function renderGrants() {
  const backgroundRows = mechanicsByChoice[character.background] || [];
  const roleRows = mechanicsByChoice[character.role] || [];
  const homeRows = mechanicsByChoice[character.homeWorld] || [];
  const freeSkills = Object.values(resolvedGrantedSkills());
  const freeTalents = Object.values(resolvedGrantedTalents());
  const freeTraits = automaticTraits();
  const groups = [
    ["Initial Skills", freeSkills.map((skill) => `${skill.displayName} · Known · ${skill.source}`)],
    ["Initial Talents", freeTalents.map((talent) => `${talent.displayName} · ${talent.source}`)],
    ["Initial Traits", freeTraits.map((trait) => `${trait.name} · ${trait.source}`)],
    ["Home World Bonus", [homeRows.find(([label]) => label === "Home World Bonus")?.[1]].filter(Boolean)],
    ["Background Bonus", [backgroundRows.find(([label]) => label === "Background Bonus")?.[1]].filter(Boolean)],
    ["Role Talent", [roleRows.find(([label]) => label === "Talent Choice")?.[1]].filter(Boolean)],
    ["Role Bonus", [roleRows.find(([label]) => label === "Role Bonus")?.[1]].filter(Boolean)],
  ];
  return `
    <div class="management-shell grants-grid">
      ${groups.map(([title, entries]) => `
        <section class="grant-panel" data-grant-group="${title.toLowerCase().replace(/\s+/g, "-")}">
          <h2>${title}</h2>
          ${entries.map((entry) => `<div class="grant-entry">${entry}</div>`).join("") || "<p>None recorded.</p>"}
        </section>`).join("")}
      <section class="grant-panel choice-resolution" data-grant-group="granted-choices">
        <h2>Granted Choices</h2>
        <p>Select each alternative granted by the character's Home World, Background, or Role.</p>
        <div class="grant-choice-list">
          ${grantAlternatives().map((choice) => `
            <div class="grant-choice-item">
              <label>
                <span>${choice.label}<small>${choice.source}</small></span>
                <select data-grant-choice="${choice.id}">
                  <option value="">Choose...</option>
                  ${choice.options.map((option) => `<option value="${option}" ${character.grantChoices[choice.id] === option ? "selected" : ""}>${option}</option>`).join("")}
                </select>
              </label>
              ${renderStartingTalentComparison(choice)}
            </div>`).join("") || "<p>No unresolved alternatives were detected.</p>"}
        </div>
      </section>
      ${renderStartingConsequences()}
    </div>`;
}

function renderEquipment() {
  const slots = Math.max(0, characteristicBonus("influence"));
  const grantedEquipment = resolvedGrantedEquipment();
  const grantedByItemId = new Map(grantedEquipment.entries.filter((entry) => entry.itemId).map((entry) => [entry.itemId, entry]));
  const categories = ["All", ...new Set(armoury.map((item) => item.category))];
  if (!categories.includes(armouryBrowserState.category)) armouryBrowserState.category = "All";
  const availableNowIds = new Set([
    ...character.equipment.inventory,
    ...grantedByItemId.keys(),
    ...armoury.filter(isStartingAcquisitionLegal).map((item) => item.id),
  ]);
  const storedSelection = armoury.find((item) => item.id === character.equipment.selected);
  const selectionMatchesAvailability = storedSelection && (
    armouryBrowserState.availability === "all"
    || (armouryBrowserState.availability === "available" && availableNowIds.has(storedSelection.id))
    || (armouryBrowserState.availability === "unavailable" && !availableNowIds.has(storedSelection.id))
  );
  const selected = selectionMatchesAvailability
    ? storedSelection
    : armoury.find((item) => armouryBrowserState.availability === "all"
      || (armouryBrowserState.availability === "available" && availableNowIds.has(item.id))
      || (armouryBrowserState.availability === "unavailable" && !availableNowIds.has(item.id)))
      || storedSelection
      || armoury[0];
  const selectedGrant = grantedByItemId.get(selected.id);
  const inventoryItems = character.equipment.inventory.map((id) => armoury.find((item) => item.id === id)).filter(Boolean);
  const unlinkedGrantedItems = grantedEquipment.entries.filter((entry) => !entry.item);
  const ownedWeapons = inventoryItems.filter((item) => item.category === "Weapons");
  const rulesState = equipmentRulesState(inventoryItems);
  const selectedInInventory = character.equipment.inventory.includes(selected.id);
  const selectedAcquisition = character.acquisitions.includes(selected.id);
  const selectedNoCostGrant = character.equipment.noCostGrants.includes(selected.id);
  const acquisitionLimitReached = character.acquisitions.filter(Boolean).length >= slots;
  const acquisitionLegal = isStartingAcquisitionLegal(selected);
  const acquisitionDisabled = Boolean(selectedGrant) || !acquisitionLegal || selectedAcquisition || acquisitionLimitReached;
  const acquisitionTitle = selectedGrant
    ? `This item is already included by ${selectedGrant.sourceName} and does not use an acquisition.`
    : selectedAcquisition
    ? "This item already uses one starting acquisition."
    : !acquisitionLegal
      ? "This item's effective Availability is not eligible for a normal starting acquisition."
      : acquisitionLimitReached
        ? "No starting acquisition slots remain."
        : "Spend one starting acquisition slot and add this item to inventory.";
  const rows = itemProfileRows(selected);
  const availabilityFilters = [
    ["available", "Available Now", availableNowIds.size, "Show choice grants, owned gear, and items obtainable during character creation."],
    ["unavailable", "Unavailable", armoury.length - availableNowIds.size, "Show items that require an acquisition test or later access."],
    ["all", "All Items", armoury.length, "Show every equipment entry in the Armoury."],
  ];
  const itemMatchesArmouryFilters = (item) => {
    const searchText = normaliseItemName(`${item.name} ${item.category} ${item.description}`);
    const matchesQuery = searchText.includes(normaliseItemName(armouryBrowserState.query));
    const matchesCategory = armouryBrowserState.category === "All" || item.category === armouryBrowserState.category;
    const availableNow = availableNowIds.has(item.id);
    const matchesAvailability = armouryBrowserState.availability === "all"
      || (armouryBrowserState.availability === "available" && availableNow)
      || (armouryBrowserState.availability === "unavailable" && !availableNow);
    return matchesQuery && matchesCategory && matchesAvailability;
  };
  return `
    <div class="management-shell armoury-layout">
      <section class="armoury-browser">
        <div class="armoury-toolbar">
          <label><span>Search Armoury</span><input id="armoury-search" type="search" value="${escapeHtmlAttribute(armouryBrowserState.query)}" placeholder="Weapon, armour, tool..." autocomplete="off" /></label>
          <div class="armoury-availability-filter">
            <span>Show equipment</span>
            <select id="armoury-availability-select" aria-label="Filter equipment by current availability">
              ${availabilityFilters.map(([id, label, count]) => `<option value="${id}" ${armouryBrowserState.availability === id ? "selected" : ""}>${label} (${count})</option>`).join("")}
            </select>
            <div role="group" aria-label="Filter equipment by current availability">
              ${availabilityFilters.map(([id, label, count, title]) => `<button type="button" data-equipment-availability="${id}" class="${armouryBrowserState.availability === id ? "active" : ""}" aria-pressed="${armouryBrowserState.availability === id}" title="${escapeHtmlAttribute(title)}">${label} <small>${count}</small></button>`).join("")}
            </div>
            <small>Choice grants, owned gear, and items obtainable during creation.</small>
          </div>
          <div class="armoury-categories" aria-label="Filter equipment by category">${categories.map((category) => `<button type="button" data-equipment-category="${category}" class="${armouryBrowserState.category === category ? "active" : ""}" aria-pressed="${armouryBrowserState.category === category}">${category}</button>`).join("")}</div>
        </div>
        <div class="armoury-list" id="armoury-list">
          ${armoury.map((item) => {
            const availableNow = availableNowIds.has(item.id);
            return `
              <button class="armoury-item ${selected.id === item.id ? "selected" : ""}" type="button" data-equipment-item="${item.id}" data-equipment-search="${escapeHtmlAttribute(normaliseItemName(`${item.name} ${item.category} ${item.description}`))}" data-equipment-type="${item.category}" data-equipment-available="${availableNow}" aria-pressed="${selected.id === item.id}" ${itemMatchesArmouryFilters(item) ? "" : "hidden"}>
              <strong class="item-name">${item.name}</strong>
              <span class="item-category">${item.category}</span>
              <span>${effectiveAvailability(item) || "Availability not recorded"}${effectiveAvailability(item) !== item.availability ? ` (base ${item.availability})` : ""} · ${displayWeight(item)}</span>
              ${grantedByItemId.has(item.id)
                ? `<em class="granted item-origin">Included · ${grantedByItemId.get(item.id).sourceName}</em>`
                : isStartingAcquisitionLegal(item)
                  ? `<em>Eligible starting acquisition</em>`
                  : `<em class="restricted">Requires acquisition test</em>`}
            </button>`;
          }).join("")}
          <p class="armoury-empty" ${armoury.some(itemMatchesArmouryFilters) ? "hidden" : ""}>No equipment matches these filters.</p>
        </div>
      </section>
      <section class="item-inspector">
        <div>
          <p class="choice-source">${selected.category} · ${selected.source || "System Compendium"}</p>
          <h2>${selected.name}</h2>
          <p>${selected.description || "The compendium records the profile below. Extended rules text will be added during the four-book audit."}</p>
          <dl class="item-profile">
            ${[...rows, ["Availability", effectiveAvailability(selected) || "—"], ...(effectiveAvailability(selected) !== selected.availability ? [["Base Availability", selected.availability]] : []), ["Craftsmanship", selected.craftsmanship], ["Weight", displayWeight(selected)]]
              .map(([label, value]) => `<div><dt>${label}</dt><dd>${value ?? "—"}</dd></div>`).join("")}
          </dl>
          <div class="item-actions">
            <button class="primary-button acquire-equipment" type="button" data-acquire-equipment="${selected.id}" title="${acquisitionTitle}" ${acquisitionDisabled ? "disabled" : ""}>${selectedGrant ? `Included by ${selectedGrant.sourceName}` : selectedAcquisition ? "Starting Acquisition Recorded" : "Use 1 Starting Acquisition"} <span>›</span></button>
            <button class="compact-button add-equipment" type="button" data-add-equipment="${selected.id}" ${selectedGrant || (selectedInInventory && !selectedNoCostGrant) ? "disabled" : ""}>${selectedGrant ? "Granted Automatically" : selectedNoCostGrant ? "Remove GM Grant" : selectedInInventory ? "Already in Inventory" : "Add as GM Grant (No Cost)"}</button>
          </div>
          ${selectedGrant
            ? `<p class="item-cost-note included"><strong>Character-creation grant:</strong> ${selectedGrant.sourceType === "background-choice" ? "You selected this from" : "This is included by"} ${selectedGrant.sourceName}. It costs no XP, currency, or starting-acquisition slot.</p>`
            : `<p class="item-cost-note"><strong>GM grant:</strong> “Add as GM Grant” records that the item was awarded free. Use it only when the GM explicitly gives the character an item outside the normal starting-acquisition allowance.</p>`}
        </div>
        <aside class="loadout-panel">
          <div class="loadout-heading">
            <span>Influence Bonus ${characteristicBonus("influence")}</span>
            <strong>${character.acquisitions.filter(Boolean).length} / ${slots} starting acquisitions recorded</strong>
          </div>
          <div class="acquisition-heading"><strong>Optional Starting Acquisitions</strong><span>Each recorded item spends 1 of ${slots} slots.</span></div>
          <div class="acquisition-picks">
            ${character.acquisitions.filter(Boolean).map((id) => {
              const item = armoury.find((entry) => entry.id === id);
              return item ? `<button type="button" data-remove-acquisition="${id}" title="Remove acquisition">${item.name}<span>×</span></button>` : "";
            }).join("") || "<span>No starting acquisitions selected.</span>"}
          </div>
          ${character.equipment.legacyAcquisitions?.length ? `<div class="legacy-warning"><strong>Review previous entries:</strong> ${character.equipment.legacyAcquisitions.join("; ")}. These older free-text entries were not counted because no unambiguous Armoury match was found.<button type="button" data-clear-legacy>Dismiss old entries</button></div>` : ""}
          <div class="carrying-summary">
            <span>Known carried weight</span>
            <strong>${rulesState.carryingStatsRecorded ? `${rulesState.knownWeight.toFixed(1)} / ${rulesState.carryingCapacity} kg` : `${rulesState.knownWeight.toFixed(1)} kg · capacity pending`}</strong>
            <small>${rulesState.carryingStatsRecorded ? `Base ${rulesState.baseCapacity} kg${rulesState.containerCapacity ? ` · carrying gear +${rulesState.containerCapacity} kg` : ""}` : "Record Strength and Toughness to calculate carrying capacity."}</small>
          </div>
          ${rulesState.warnings.length ? `<div class="equipment-rule-alerts" aria-label="Equipment rules notices">${rulesState.warnings.map((warning) => `<p class="${warning.level}">${warning.message}</p>`).join("")}</div>` : ""}
          <section class="inventory-record unified-equipment-record" aria-labelledby="inventory-record-title">
            <div class="inventory-record-heading">
              <strong id="inventory-record-title">Your Inventory</strong>
              <span>Every owned item appears once. Ready weapons, wear compatible armour, install modifications, or mark carried gear in use.</span>
            </div>
            <div class="carried-equipment-list unified-equipment-list">${inventoryItems.map((item) => {
              const source = equipmentProvenance(item.id, grantedEquipment);
              const assignedWeaponId = item.category === "Weapon Mods" ? character.equipment.weaponModAssignments[item.id] || "" : "";
              const stateControl = item.category === "Weapons"
                ? `<label class="inventory-state-control"><input type="checkbox" data-ready-weapon="${item.id}" ${character.equipment.readiedWeapons.includes(item.id) ? "checked" : ""} /><span>Readied</span></label>`
                : item.category === "Armour"
                  ? `<label class="inventory-state-control"><input type="checkbox" data-wear-armour="${item.id}" ${character.equipment.wornArmour.includes(item.id) ? "checked" : ""} /><span>Worn</span></label>`
                  : item.category === "Weapon Mods"
                    ? `<label class="inventory-mod-control"><span>Installed on</span><select data-modification-target="${item.id}"><option value="">Not installed</option>${ownedWeapons.map((weapon) => {
                        const compatibility = modificationCompatibility(item, weapon);
                        return `<option value="${weapon.id}" ${assignedWeaponId === weapon.id ? "selected" : ""}>${weapon.name}${compatibility.compatible ? "" : " · check eligibility"}</option>`;
                      }).join("")}</select></label>`
                    : `<label class="inventory-state-control"><input type="checkbox" data-active-gear="${item.id}" ${character.equipment.activeGear.includes(item.id) ? "checked" : ""} /><span>Worn / in use</span></label>`;
              return `<div class="carried-equipment-entry ${selected.id === item.id ? "selected" : ""}">
                <button type="button" data-equipment-item="${item.id}" title="View ${escapeHtmlAttribute(item.name)} details"><strong>${item.name}</strong><small class="item-origin">${source.label}</small></button>
                <span>${item.category} · ${displayWeight(item)}</span>
                ${stateControl}
              </div>`;
            }).join("")}${unlinkedGrantedItems.map((entry) => `
              <div class="inventory-entry ${entry.unresolvedChoice ? "unresolved" : "unlinked"}">
                <strong>${entry.label}</strong>
                <small class="item-origin">${entry.unresolvedChoice ? "Background choice unresolved" : `Granted by ${entry.sourceName}`}</small>
                <em>${entry.unresolvedChoice ? "Return to Starting Abilities and choose one option." : "Recorded as written · Armoury details not yet linked."}</em>
              </div>`).join("")}${!inventoryItems.length && !unlinkedGrantedItems.length ? "<p>No equipment recorded yet.</p>" : ""}</div>
          </section>
        </aside>
      </section>
    </div>`;
}

function renderTalentShop() {
  const granted = resolvedGrantedTalents();
  const purchasedTalents = paidTalentAdvanceEntries();
  const purchasedIds = new Set(purchasedTalents.map((entry) => entry.id).filter(Boolean));
  const selected = talentCatalogue.find((talent) => talent.id === character.talentShopSelected)
    || talentCatalogue.find((talent) => talent.name === "Quick Draw")
    || talentCatalogue[0];
  const cost = talentCost(selected);
  const matches = aptitudeMatches(selected.aptitudes, resolvedAptitudes().aptitudes);
  const owned = granted[selected.id] || purchasedIds.has(selected.id);
  const prerequisiteStatus = talentPrerequisiteStatus(selected);
  const filterQuery = character.talentFilters.query.trim().toLowerCase();
  const filterTier = character.talentFilters.tier || "All";
  return `
    <section class="talent-shop" id="advance-talents">
      <div class="advance-section-heading">
        <div><p class="choice-source">Tiered Advances</p><h2>Talents</h2></div>
        <div class="purchased-talents">${[
          ...Object.values(granted).map((talent) => `<span class="initial">${talent.displayName} · Initial</span>`),
          ...purchasedTalents.map((entry) => {
            const talent = talentCatalogue.find((candidate) => candidate.id === entry.id);
            return talent ? `<button type="button" data-remove-talent="${talent.id}">${talent.name} · ${talentCost(talent)} XP <b>×</b></button>` : "";
          }),
        ].join("") || "<span>No talents recorded.</span>"}</div>
      </div>
      <div class="talent-terminal">
        <div class="talent-catalogue">
          <div class="talent-filters">
            <input id="talent-search" type="search" aria-label="Search talents" placeholder="Search name, benefit, prerequisite..." autocomplete="off" value="${escapeHtmlAttribute(character.talentFilters.query)}" />
            ${["All", "1", "2", "3"].map((tier) => `<button type="button" data-talent-tier="${tier}" class="${tier === filterTier ? "active" : ""}" aria-pressed="${tier === filterTier}">${tier === "All" ? "All tiers" : `Tier ${tier}`}</button>`).join("")}
          </div>
          <div class="talent-list">
            ${talentCatalogue.map((talent) => `
              <button type="button" class="talent-row ${talent.id === selected.id ? "selected" : ""}" data-talent-id="${talent.id}" data-talent-search="${escapeHtmlAttribute(`${talent.name} ${talent.benefit} ${talent.prerequisites} ${talent.aptitudes.join(" ")} ${talent.source}`.toLowerCase())}" data-talent-tier-value="${talent.tier}" aria-pressed="${talent.id === selected.id}" ${!( `${talent.name} ${talent.benefit} ${talent.prerequisites} ${talent.aptitudes.join(" ")} ${talent.source}`.toLowerCase().includes(filterQuery) && (filterTier === "All" || String(talent.tier) === filterTier)) ? "hidden" : ""}>
                <strong>${talent.name}</strong><span>Tier ${talent.tier}</span><em>${talentCost(talent)} XP</em>
              </button>`).join("")}
          </div>
        </div>
        <article class="talent-inspector">
          <p class="choice-source">${selected.source || "Talent Advance"}</p>
          <h3>${selected.name}</h3>
          <div class="talent-cost"><strong>${cost} XP</strong><span>Tier ${selected.tier} · ${matches}/2 aptitudes</span></div>
          <dl>
            <div><dt>Aptitudes</dt><dd>${selected.aptitudes.join(", ") || "None recorded"}</dd></div>
            <div><dt>Prerequisites</dt><dd>${selected.prerequisites || "None"}</dd></div>
            ${prerequisiteStatus.missing.length ? `<div><dt>Missing</dt><dd class="missing-prerequisite">${prerequisiteStatus.missing.join(", ")}</dd></div>` : ""}
            ${selected.prerequisites && !prerequisiteStatus.parsed ? `<div><dt>Validation</dt><dd>Review this prerequisite before purchasing; its format is not yet automatically resolved.</dd></div>` : ""}
            <div><dt>Benefit</dt><dd>${selected.benefit || "No summary recorded in the compendium."}</dd></div>
          </dl>
          <button class="primary-button purchase-talent" type="button" data-purchase-talent="${selected.id}" ${owned || prerequisiteStatus.missing.length || xpSpent() + cost > character.xp.starting ? "disabled" : ""}>${owned ? "Talent Already Owned" : prerequisiteStatus.missing.length ? "Prerequisites Missing" : xpSpent() + cost > character.xp.starting ? "Insufficient XP" : "Purchase Talent"} <span>›</span></button>
        </article>
      </div>
    </section>`;
}

function renderSpecialistSkillShop(ownedAptitudes) {
  const ownedRecords = ownedSkillRecords();
  return `
    <section class="specialist-skill-shop" aria-labelledby="specialist-skills-title">
      <div class="specialist-skill-intro">
        <div><p class="choice-source">Each speciality advances separately</p><h3 id="specialist-skills-title">Specialist Skills</h3></div>
        <p>Choose a listed speciality, or record a GM-approved speciality when the rules allow one not shown here.</p>
      </div>
      <div class="specialist-skill-families">
        ${skills.filter((skill) => isSpecialistSkill(skill.id)).map((skill) => {
          const records = ownedRecords.filter((record) => record.skill.id === skill.id);
          const matches = aptitudeMatches(skill.aptitudes, ownedAptitudes);
          const existingKeys = new Set(records.map((record) => specialistSkillKey(skill.id, record.speciality)));
          const available = (skillSpecialities[skill.id] || []).filter((speciality) => !existingKeys.has(specialistSkillKey(skill.id, speciality)));
          return `<article class="specialist-skill-family" id="specialist-${skill.id}">
            <div class="specialist-family-heading">
              <div><strong>${skill.name}</strong><small>${skill.characteristic} · ${matches}/2 aptitudes</small></div>
              <span>${records.length} recorded</span>
            </div>
            <div class="specialist-skill-records">${records.map((record) => {
              const nextCost = record.rank < rankNames.length ? skillAdvanceCosts[matches][record.rank] : null;
              return `<label class="${record.grant ? "initial-advance" : ""}">
                <span><strong>${record.displayName}</strong><small>${record.rank ? `Target ${skillTestTarget(skill, record.speciality)}` : "Untrained"}${record.grant ? ` · Known granted by ${record.grant.source}` : ""}${nextCost ? ` · Next ${nextCost} XP` : ""}</small></span>
                <select data-specialist-skill-advance="${escapeHtmlAttribute(record.key)}" data-specialist-skill-id="${skill.id}" data-specialist-skill-name="${escapeHtmlAttribute(record.speciality)}">
                  <option value="0" ${record.rank === 0 ? "selected" : ""} ${record.grant ? "disabled" : ""}>Remove / Untrained</option>
                  ${rankNames.map((name, index) => `<option value="${index + 1}" ${record.rank === index + 1 ? "selected" : ""}>${name}${record.grant && index === 0 ? " · Initial (0 XP)" : ""}</option>`).join("")}
                </select>
              </label>`;
            }).join("") || "<p>No speciality recorded yet.</p>"}</div>
            <div class="specialist-skill-add">
              <label><span>Add a speciality</span><select data-specialist-skill-choice="${skill.id}"><option value="">Choose from the rulebook...</option>${available.map((speciality) => `<option value="${escapeHtmlAttribute(speciality)}">${speciality}</option>`).join("")}</select></label>
              <label><span>Or GM-approved speciality</span><input data-specialist-skill-custom="${skill.id}" type="text" autocomplete="off" placeholder="Optional custom name" /></label>
              <button class="compact-button" type="button" data-add-specialist-skill="${skill.id}">Add at Known</button>
            </div>
          </article>`;
        }).join("")}
      </div>
    </section>`;
}

function psychicPrerequisiteText(power) {
  const prerequisite = power.prerequisite || {};
  const parts = [];
  for (const [id, minimum] of Object.entries(prerequisite.characteristics || {})) parts.push(`${characteristics.find((entry) => entry.id === id)?.name || id} ${minimum}`);
  for (const [id, rank] of Object.entries(prerequisite.skills || {})) parts.push(`${skills.find((entry) => entry.id === id)?.name || id} ${rankNames[rank - 1] || rank}`);
  if (prerequisite.psyRating) parts.push(`Psy Rating ${prerequisite.psyRating}`);
  if (prerequisite.corruption) parts.push(`${prerequisite.corruption} Corruption points`);
  if (prerequisite.insanity) parts.push(`${prerequisite.insanity} Insanity points`);
  parts.push(...(prerequisite.talents || []));
  parts.push(...(prerequisite.elite || []).map((id) => `${eliteAdvanceById(id)?.name || id} Elite Advance`));
  parts.push(...(prerequisite.powers || []).map((id) => psychicPowerById(id)?.name || id));
  if (power.path?.length) parts.push(`Power path: ${power.path.map((id) => psychicPowerById(id)?.name || id).join(" or ")}`);
  return parts.join(" · ") || "Psyker Elite Advance";
}

function renderPsychicShop() {
  const selected = psychicPowerById(character.psychicShopSelected)
    || psychicPowerCatalogue.find((power) => power.name === "Telekinetic Control")
    || psychicPowerCatalogue[0];
  const selectedStatus = psychicPowerStatus(selected);
  const purchasedIds = purchasedPsychicPowerIds();
  const query = String(character.psychicFilters.query || "").trim().toLowerCase();
  const discipline = character.psychicFilters.discipline || "All Powers";
  const showUnavailable = character.psychicFilters.showUnavailable !== false;
  const baseRating = basePsyRating();
  const currentRating = foundryPsyRating();
  const remaining = character.xp.starting - xpSpent();
  return `<section id="advance-psychic" class="psychic-shop">
    <div class="advance-section-heading psychic-heading">
      <div><p class="choice-source">Psyker access detected</p><h2>Psychic Powers and Psy Rating</h2><p>Choose powers from complete sourcebook catalogues. Power-tree paths, prerequisites, and XP are checked automatically.</p></div>
      <div class="psy-rating-control">
        <span>Psy Rating</span><strong>${currentRating}</strong><small>Base ${baseRating} · ${psyRatingXpCost()} XP spent</small>
        <label><span>Purchased increases</span><select data-psy-rating-advance>
          ${Array.from({ length: Math.max(1, 10 - baseRating + 1) }, (_, count) => {
            const finalRating = baseRating + count;
            let addedCost = 0;
            for (let rating = baseRating + 1; rating <= finalRating; rating += 1) addedCost += rating * 200;
            return `<option value="${count}" ${Number(character.advances.psyRating || 0) === count ? "selected" : ""}>PR ${finalRating}${count ? ` · ${addedCost} XP` : " · starting"}</option>`;
          }).join("")}
        </select></label>
      </div>
    </div>
    <div class="warp-exposure-controls">
      <label><span>Current Insanity</span><input type="number" min="0" max="100" value="${Number(character.conditions.insanity || 0)}" data-condition-value="insanity" /></label>
      <label><span>Current Corruption</span><input type="number" min="0" max="100" value="${Number(character.conditions.corruption || 0)}" data-condition-value="corruption" /></label>
      <label class="malefic-approval"><input type="checkbox" data-malefic-approval ${character.eliteSetup.maleficApproved ? "checked" : ""} /><span>GM approves access to Malefic Daemonology</span></label>
    </div>
    <div class="purchased-psychic-powers">${character.advances.psychicPowers.map((entry) => {
      const record = psychicPowerById(entry.id);
      return record ? `<button type="button" data-remove-psychic-power="${record.id}">${record.name} · ${record.cost} XP <b>×</b></button>` : "";
    }).join("") || "<span>No psychic powers purchased.</span>"}</div>
    <div class="psychic-terminal">
      <div class="psychic-catalogue">
        <div class="psychic-filters">
          <input id="psychic-search" type="search" aria-label="Search psychic powers" placeholder="Search powers, effects, prerequisites..." autocomplete="off" value="${escapeHtmlAttribute(character.psychicFilters.query || "")}" />
          <label><span>Discipline</span><select data-psychic-discipline>${psychicDisciplines.map((entry) => `<option value="${entry.name}" ${entry.name === discipline ? "selected" : ""}>${entry.name}</option>`).join("")}</select></label>
          <label class="show-unavailable"><input type="checkbox" data-psychic-show-unavailable ${showUnavailable ? "checked" : ""} /><span>Show locked powers</span></label>
        </div>
        <div class="psychic-list">${psychicPowerCatalogue.map((power) => {
          const status = psychicPowerStatus(power);
          const search = `${power.name} ${power.discipline} ${power.summary} ${psychicPrerequisiteText(power)} ${power.source}`.toLowerCase();
          const visible = search.includes(query) && (discipline === "All Powers" || power.discipline === discipline) && (showUnavailable || !status.missing.length || status.owned);
          return `<button type="button" class="psychic-row ${power.id === selected.id ? "selected" : ""} ${status.missing.length ? "locked" : ""} ${status.owned ? "owned" : ""}" data-psychic-power-id="${power.id}" data-psychic-search="${escapeHtmlAttribute(search)}" data-psychic-discipline-value="${escapeHtmlAttribute(power.discipline)}" data-psychic-available="${status.missing.length ? "false" : "true"}" ${visible ? "" : "hidden"}>
            <strong>${power.name}</strong><span>${power.discipline}</span><em>${status.owned ? "Known" : `${power.cost} XP`}</em>
          </button>`;
        }).join("")}</div>
      </div>
      <article class="psychic-inspector">
        <p class="choice-source">${selected.source}, p. ${selected.page}</p>
        <h3>${selected.name}</h3>
        <div class="psychic-cost"><strong>${selected.cost} XP</strong><span>${selected.discipline}</span></div>
        <p>${selected.summary}</p>
        <dl>
          <div><dt>Prerequisites</dt><dd>${psychicPrerequisiteText(selected)}</dd></div>
          ${selectedStatus.missing.length ? `<div><dt>Missing</dt><dd class="missing-prerequisite">${selectedStatus.missing.join(" · ")}</dd></div>` : ""}
          <div><dt>Action</dt><dd>${selected.action}</dd></div>
          <div><dt>Focus Power</dt><dd>${selected.focus}</dd></div>
          <div><dt>Range</dt><dd>${selected.range}</dd></div>
          <div><dt>Sustained</dt><dd>${selected.sustained}</dd></div>
          <div><dt>Subtype</dt><dd>${selected.subtype}</dd></div>
        </dl>
        <button class="primary-button purchase-psychic-power" type="button" data-purchase-psychic-power="${selected.id}" ${selectedStatus.owned || selectedStatus.missing.length || selected.cost > remaining ? "disabled" : ""}>${selectedStatus.owned ? "Power Already Known" : selectedStatus.missing.length ? "Prerequisites Missing" : selected.cost > remaining ? "Insufficient XP" : "Purchase Psychic Power"}<span>›</span></button>
      </article>
    </div>
  </section>`;
}

function eliteSetupControls(advance) {
  if (advance.id === "psyker" && character.background !== "astra-telepathica") {
    const value = character.eliteSetup.psykerCorruption;
    return `<div class="elite-setup-control"><strong>Rogue psyker Corruption</strong><p>Record the required 1d10+3 Corruption immediately.</p><label><span>Result</span><input type="number" min="4" max="13" data-psyker-corruption value="${value ?? ""}" placeholder="4–13" /></label><button class="compact-button" type="button" data-roll-psyker-corruption>Roll 1d10+3</button></div>`;
  }
  if (advance.setup === "inquisitor-lore") {
    return `<label class="elite-setup-control"><strong>Forbidden Lore speciality</strong><select data-inquisitor-lore><option value="">Choose one...</option>${(skillSpecialities["forbidden-lore"] || []).map((entry) => `<option value="${escapeHtmlAttribute(entry)}" ${character.eliteSetup.inquisitorLore === entry ? "selected" : ""}>${entry}</option>`).join("")}</select></label>`;
  }
  if (advance.setup === "sister-weapon") {
    return `<label class="elite-setup-control"><strong>Granted weapon</strong><select data-sister-weapon><option value="">Choose one...</option>${["Godwyn-Deaz Bolt Pistol", "Flamer"].map((entry) => `<option value="${entry}" ${character.eliteSetup.sisterWeapon === entry ? "selected" : ""}>${entry}</option>`).join("")}</select></label>`;
  }
  return "";
}

function renderEliteAdvanceShop() {
  const selected = eliteAdvanceById(character.eliteShopSelected) || eliteAdvanceCatalogue.find((entry) => !entry.automatic) || eliteAdvanceCatalogue[0];
  const status = eliteAdvanceStatus(selected);
  const active = activeEliteAdvances();
  const includedByMystic = selected.id === "psyker" && character.role === "mystic";
  return `<section class="elite-advance-shop" id="advance-elite">
    <div class="elite-compact-heading"><div><p class="choice-source">Optional, campaign-changing advances</p><h2>Elite Advances</h2></div><p>Choose an advance to inspect it. The builder checks mechanical prerequisites; the GM must still approve how it enters the story.</p></div>
    <div class="active-elite-advances">${active.map((advance) => `<div class="active-elite-chip"><span>${advance.automatic ? "Granted" : "Purchased"}</span><strong>${advance.name}</strong><small>${advance.automatic ? advance.source : `${advance.cost} XP`}</small>${advance.automatic ? "" : `<button type="button" data-remove-elite-advance="${advance.id}" aria-label="Remove ${advance.name}">×</button>`}</div>`).join("") || "<span>No Elite Advance selected.</span>"}</div>
    <div class="elite-selector-grid">
      <label class="elite-select-control"><span>Inspect an Elite Advance</span><select data-elite-advance-inspect aria-label="Inspect an Elite Advance"><option value="">Choose an advance...</option>${eliteAdvanceCatalogue.map((entry) => `<option value="${entry.id}" ${entry.id === selected.id ? "selected" : ""}>${entry.name}${entry.id === "psyker" && character.role === "mystic" ? " — Included by Mystic" : ""}</option>`).join("")}</select></label>
      <article class="elite-inspector">
        <div><p class="choice-source">${selected.source}, p. ${selected.page}</p><h3>${selected.name}</h3><p>${selected.summary}</p></div>
        <dl>
          <div><dt>Cost</dt><dd>${includedByMystic ? "0 XP — included by Mystic" : `${selected.cost} XP`}</dd></div>
          <div><dt>Instant changes</dt><dd>${selected.instantChanges.join(" · ")}</dd></div>
          <div><dt>Guidance</dt><dd>${selected.notes}</dd></div>
          ${selected.prerequisites?.narrative ? `<div><dt>Narrative prerequisite</dt><dd>${selected.prerequisites.narrative}</dd></div>` : ""}
          ${status.missing.filter((entry) => entry !== "GM approval").length ? `<div><dt>Missing</dt><dd class="missing-prerequisite">${status.missing.filter((entry) => entry !== "GM approval").join(" · ")}</dd></div>` : ""}
        </dl>
        ${includedByMystic ? psykerPathClarification() : `<label class="elite-gm-approval"><input type="checkbox" data-elite-gm-approval="${selected.id}" ${character.eliteSetup.gmApproved?.[selected.id] ? "checked" : ""} ${status.owned ? "disabled" : ""} /><span>GM approval confirmed for this character</span></label>`}
        <button class="primary-button" type="button" data-purchase-elite-advance="${selected.id}" ${status.owned || status.missing.length || xpSpent() + selected.cost > character.xp.starting ? "disabled" : ""}>${includedByMystic ? "Included by Mystic Role" : status.owned ? "Advance Already Active" : status.missing.length ? "Prerequisites Missing" : xpSpent() + selected.cost > character.xp.starting ? "Insufficient XP" : "Purchase Elite Advance"}<span>${includedByMystic ? "✓" : "›"}</span></button>
      </article>
    </div>
    ${active.map(eliteSetupControls).filter(Boolean).join("")}
  </section>`;
}

function renderAdvances() {
  const owned = resolvedAptitudes().aptitudes;
  const spent = xpSpent();
  const unresolved = grantAlternatives().filter((choice) => !character.grantChoices[choice.id]);
  return `
    <div class="management-shell advance-layout">
      <aside class="xp-meter">
        <span>Total XP</span><strong>${character.xp.starting}</strong>
        <span>Spent</span><strong>${spent}</strong>
        <span>Remaining</span><strong class="${spent > character.xp.starting ? "invalid" : ""}">${character.xp.starting - spent}</strong>
      </aside>
      <section class="advance-shop">
        ${unresolved.length ? `<div class="advance-warning"><strong>Starting choices incomplete</strong><span>Return to Starting Abilities and resolve ${unresolved.length} granted alternative${unresolved.length === 1 ? "" : "s"} before purchasing advances.</span></div>` : ""}
        <nav class="advance-nav"><button type="button" data-advance-jump="advance-characteristics">Characteristics</button><button type="button" data-advance-jump="advance-skills">Skills</button><button type="button" data-advance-jump="advance-talents">Talents</button><button type="button" data-advance-jump="advance-elite">Elite Advances</button>${hasPsykerAccess() ? `<button type="button" data-advance-jump="advance-psychic">Psychic</button>` : ""}</nav>
        <h2 id="advance-characteristics">Characteristic Advances</h2>
        <div class="advance-rows">
          ${characteristics.filter((entry) => entry.id !== "influence").map((entry) => {
            const rank = Number(character.advances.characteristics[entry.id] || 0);
            const matches = aptitudeMatches(entry.aptitudes, owned);
            const breakdown = characteristicBreakdown(entry.id);
            const applied = [
              `Generated ${breakdown.generated || "—"}`,
              breakdown.divination ? `Divination ${breakdown.divination > 0 ? "+" : ""}${breakdown.divination}` : "",
              breakdown.advancement ? `Advances +${breakdown.advancement}` : "",
            ].filter(Boolean).join(" · ");
            return `<label><span>${entry.name}<small>${matches}/2 aptitudes · ${applied} · Total ${breakdown.total}</small></span>
              <select data-characteristic-advance="${entry.id}">
                ${["None", "Simple +5", "Intermediate +10", "Trained +15", "Proficient +20", "Expert +25"].map((name, index) => `<option value="${index}" ${rank === index ? "selected" : ""}>${name}</option>`).join("")}
              </select></label>`;
          }).join("")}
        </div>
        <h2 id="advance-skills">Skill Advances</h2>
        <div class="advance-rows skill-shop">
          ${skills.filter((skill) => !isSpecialistSkill(skill.id)).map((skill) => {
            const freeGrant = resolvedGrantedSkills()[skill.id];
            const rank = skillRank(skill.id);
            const matches = aptitudeMatches(skill.aptitudes, owned);
            const nextCost = rank < rankNames.length ? skillAdvanceCosts[matches][rank] : null;
            return `<label class="${freeGrant ? "initial-advance" : ""}"><span>${skill.name}<small>${skill.characteristic} · ${matches}/2 aptitudes${rank ? ` · Test ${skillTestTarget(skill)}` : ""}${freeGrant ? ` · Known granted by ${freeGrant.source}` : ""}${nextCost ? ` · Next ${nextCost} XP` : ""}</small></span>
              <select data-skill-advance="${skill.id}">
                <option value="0" ${rank === 0 ? "selected" : ""} ${freeGrant ? "disabled" : ""}>Untrained</option>
                ${rankNames.map((name, index) => `<option value="${index + 1}" ${rank === index + 1 ? "selected" : ""}>${name}${freeGrant && index === 0 ? " · Initial (0 XP)" : ""}</option>`).join("")}
              </select></label>`;
          }).join("")}
        </div>
        ${renderSpecialistSkillShop(owned)}
        ${renderTalentShop()}
        ${renderEliteAdvanceShop()}
        ${hasPsykerAccess() ? renderPsychicShop() : ""}
      </section>
    </div>`;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function rosterChoiceName(catalogue, id) {
  return catalogs[catalogue].find((entry) => entry.id === id)?.name || "Not selected";
}

function rosterProgress(record) {
  const currentStep = Math.min(scenes.length - 1, Math.max(0, Number(record.step || 0)));
  const savedCharacter = record.character || {};
  const hasStarted = currentStep > 0 || ["name", "player", "presentation", "appearance"]
    .some((field) => String(savedCharacter[field] || "").trim());
  const completedSections = Math.min(currentStep, scenes.length - 1);
  const sectionTotal = scenes.length - 1;
  let label = "Creation not started";
  if (savedCharacter.completedAt) label = "Complete · editable";
  else if (currentStep >= scenes.length - 1) label = "Ready for final review";
  else if (hasStarted) label = `Creation in progress · ${completedSections} of ${sectionTotal} sections complete`;
  return {
    currentStep,
    label,
    percentage: savedCharacter.completedAt ? 100 : Math.round((completedSections / sectionTotal) * 100),
  };
}

async function loadCompendium() {
  if (compendiumData || compendiumLoadError) return;
  if (hostedEdition) {
    try {
      const stored = await loadStoredSourcebookLibrary();
      if (stored?.books?.length) {
        activateCompendium(stored);
      } else {
        compendiumLoadError = "Connect your four sourcebooks to build this browser’s compendium. The files and extracted index stay on this device.";
      }
    } catch (error) {
      compendiumLoadError = error.message || "This browser’s compendium could not be opened.";
    }
    if (appView === "compendium") renderCompendium();
    return;
  }
  try {
    const response = await fetch(new URL("../public/data/dh2-compendium.json?v=0.1.0", import.meta.url));
    if (!response.ok) throw new Error(`Rules library returned ${response.status}`);
    activateCompendium(await response.json());
  } catch (error) {
    compendiumLoadError = error.message || "The local rules library could not be loaded.";
  }
  if (appView === "compendium") renderCompendium();
}

function activateCompendium(payload) {
  compendiumData = payload;
  compendiumLoadError = "";
  compendiumImporting = false;
  compendiumImportProgress = "";
  compendiumChapterHtmlCache.clear();
  collapsedWordCache.clear();
  expandedWordCache.clear();
  compendiumWordFrequency = buildCompendiumWordFrequency();
  compendiumSearchIndex = buildCompendiumSearchIndex();
}

function compendiumBooks() {
  return compendiumData?.books || [];
}

function isReferenceChapter(book, chapter) {
  if (!chapter) return false;
  if (/front cover|back cover|^contents$|^index$/i.test(chapter)) return false;
  if (chapter === book.shortTitle || chapter === book.title || /^DH\d+_/i.test(chapter)) return false;
  if (book.id === "core" && /^(?:Into the Dark|Innocence Proves Nothing)/i.test(chapter)) return false;
  return true;
}

function buildCompendiumWordFrequency() {
  const frequency = new Map();
  for (const book of compendiumData?.books || []) {
    for (const page of book.pages) {
      for (const match of String(page.text).matchAll(/\b[A-Za-z]{3,18}\b/g)) {
        const word = match[0].toLowerCase();
        frequency.set(word, (frequency.get(word) || 0) + 1);
      }
    }
  }
  return frequency;
}

function buildCompendiumSearchIndex() {
  return compendiumBooks().flatMap((book) =>
    book.pages.filter((page) => isReferenceChapter(book, page.chapter)).map((page) => ({
      book,
      page,
      heading: String(page.heading || page.chapter).toLowerCase(),
      chapter: String(page.chapter).toLowerCase(),
      text: `${page.chapter} ${page.heading} ${page.headings.join(" ")} ${page.text}`.toLowerCase(),
    })),
  );
}

function restoreCollapsedWord(word) {
  const lower = word.toLowerCase();
  if (lower.length < 3 || lower.length > 14) return word;
  if (collapsedWordCache.has(lower)) {
    const cached = collapsedWordCache.get(lower);
    return /^[A-Z]/.test(word) ? `${cached[0].toUpperCase()}${cached.slice(1)}` : cached;
  }
  let best = lower;
  const originalScore = compendiumWordFrequency.get(lower) || 0;
  let bestScore = originalScore;
  const singleVariants = [];
  for (let index = 0; index < lower.length; index += 1) {
    const candidate = `${lower.slice(0, index)}${lower[index]}${lower.slice(index)}`;
    singleVariants.push({ candidate, index });
    const score = compendiumWordFrequency.get(candidate) || 0;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  for (const { candidate, index } of singleVariants) {
    for (let second = index + 2; second < candidate.length; second += 1) {
      const doubled = `${candidate.slice(0, second)}${candidate[second]}${candidate.slice(second)}`;
      const score = compendiumWordFrequency.get(doubled) || 0;
      if (score > bestScore) {
        best = doubled;
        bestScore = score;
      }
    }
  }
  const corrected = best !== lower && bestScore >= Math.max(3, originalScore * 1.5) ? best : lower;
  collapsedWordCache.set(lower, corrected);
  return /^[A-Z]/.test(word) ? `${corrected[0].toUpperCase()}${corrected.slice(1)}` : corrected;
}

function restoreCollapsedSpelling(value) {
  return String(value).replace(/\b[A-Za-z]{4,14}\b/g, restoreCollapsedWord);
}

function restoreExpandedWord(word) {
  const lower = word.toLowerCase();
  if (!/(.)\1/.test(lower)) return word;
  if (expandedWordCache.has(lower)) {
    const cached = expandedWordCache.get(lower);
    return /^[A-Z]/.test(word) ? `${cached[0].toUpperCase()}${cached.slice(1)}` : cached;
  }
  const collapsed = lower.replace(/(.)\1+/g, "$1");
  const originalScore = compendiumWordFrequency.get(lower) || 0;
  const collapsedScore = compendiumWordFrequency.get(collapsed) || 0;
  const corrected = collapsed !== lower && collapsedScore >= Math.max(3, originalScore * 1.5)
    ? collapsed
    : lower;
  expandedWordCache.set(lower, corrected);
  return /^[A-Z]/.test(word) ? `${corrected[0].toUpperCase()}${corrected.slice(1)}` : corrected;
}

function restoreExpandedSpelling(value) {
  return String(value)
    .replace(/\b[A-Za-z]{4,18}\b/g, restoreExpandedWord)
    .replace(/([,.;:!?])\1+/g, "$1");
}

function restoreDetachedInitials(value) {
  return String(value).replace(/\b([A-Z])\s+([A-Z][A-Za-z]{2,})\b/g, (match, initial, remainder) => {
    const combined = `${initial}${remainder}`.toLowerCase();
    if ((compendiumWordFrequency.get(combined) || 0) < 3) return match;
    if (remainder === remainder.toUpperCase()) return combined.toUpperCase();
    return `${combined[0].toUpperCase()}${combined.slice(1)}`;
  });
}

function restoreSplitSmallCapsLines(value) {
  const lines = String(value).split(/\n/);
  const repaired = [];
  for (let index = 0; index < lines.length; index += 1) {
    const initialLine = lines[index].trim().match(/^([A-Z](?:\s+[A-Z])*)(?:\s+\(\s*([A-Z]{1,4})\s*\))?$/);
    const initials = initialLine ? initialLine[1].split(/\s+/) : [];
    let fragments = String(lines[index + 1] || "").trim().match(/^[A-Z]{2,}(?:\s+[A-Z]{1,})*$/)
      ? lines[index + 1].trim().split(/\s+/)
      : [];
    if (initials.length && fragments.length > initials.length && fragments.slice(initials.length).every((part) => part.length <= 3)) {
      fragments = fragments.slice(0, initials.length);
    }
    if (initials.length && initials.length === fragments.length) {
      const heading = initials.map((initial, tokenIndex) => `${initial}${fragments[tokenIndex]}`).join(" ");
      repaired.push(`${heading}${initialLine[2] ? ` (${initialLine[2]})` : ""}`);
      index += 1;
      continue;
    }
    repaired.push(lines[index]);
  }
  return repaired.join("\n");
}

function normalizeErraticSmallCaps(value) {
  return String(value)
    .replace(/\b[A-Za-z]{4,}\b/g, (word) => {
      const interiorUppercase = (word.slice(1).match(/[A-Z]/g) || []).length;
      const lowercase = (word.match(/[a-z]/g) || []).length;
      if (!interiorUppercase || !lowercase) return word;
      const normalized = word.toLowerCase();
      return /^[A-Z]/.test(word) ? `${normalized[0].toUpperCase()}${normalized.slice(1)}` : normalized;
    })
    .replace(/\bA\s*-\s*rco\s+flagellant\b/gi, "Arco-flagellant");
}

function compendiumChapters() {
  const books = compendiumBooks().filter((book) => compendiumState.book === "all" || book.id === compendiumState.book);
  return [...new Set(books.flatMap((book) => book.pages.map((page) => page.chapter)).filter(Boolean))];
}

function compendiumMatches() {
  const query = compendiumState.query.trim().toLowerCase();
  const matches = [];
  for (const book of compendiumBooks()) {
    if (compendiumState.book !== "all" && book.id !== compendiumState.book) continue;
    for (const page of book.pages) {
      if (compendiumState.chapter !== "All" && page.chapter !== compendiumState.chapter) continue;
      const haystack = `${page.chapter} ${page.heading} ${page.headings.join(" ")} ${page.text}`.toLowerCase();
      if (query && !haystack.includes(query)) continue;
      matches.push({ book, page });
    }
  }
  return matches;
}

function compendiumSnippet(text, query) {
  const compact = restoreCollapsedSpelling(
    normalizeErraticSmallCaps(
      restoreDetachedInitials(restoreSplitSmallCapsLines(String(text || ""))),
    ),
  ).replace(/\s+/g, " ").trim();
  if (!compact) return "No extractable text was found on this page.";
  const needle = query.trim().toLowerCase();
  const index = needle ? compact.toLowerCase().indexOf(needle) : -1;
  const start = Math.max(0, index < 0 ? 0 : index - 115);
  const end = Math.min(compact.length, start + 290);
  return `${start ? "…" : ""}${compact.slice(start, end)}${end < compact.length ? "…" : ""}`;
}

function selectedCompendiumPage(matches = compendiumMatches()) {
  for (const book of compendiumBooks()) {
    if (book.id !== compendiumState.selectedBook) continue;
    const page = book.pages.find((entry) => entry.pdfPage === Number(compendiumState.selectedPage));
    if (page) return { book, page };
  }
  return matches[0] || null;
}

function renderCompendiumReader(selection) {
  if (!selection) return `<div class="compendium-empty"><h2>No matching rules</h2><p>Change the search or filters to continue.</p></div>`;
  const { book, page } = selection;
  const paragraphs = page.text.split(/\n+/).filter(Boolean);
  return `
    <article class="compendium-reader" tabindex="0">
      <p class="choice-source">${escapeHtmlAttribute(book.shortTitle)} · Page ${escapeHtmlAttribute(page.printedPage)}</p>
      <h2>${escapeHtmlAttribute(page.heading || page.chapter)}</h2>
      ${page.headings.length ? `<div class="compendium-page-headings">${page.headings.map((heading) => `<span>${escapeHtmlAttribute(heading)}</span>`).join("")}</div>` : ""}
      <div class="compendium-provenance">PDF page ${page.pdfPage} · ${escapeHtmlAttribute(page.chapter)}</div>
      <div class="compendium-article-text">${paragraphs.map((paragraph) => `<p>${escapeHtmlAttribute(paragraph)}</p>`).join("")}</div>
    </article>`;
}

function legacyRenderCompendium() {
  const books = compendiumBooks();
  const chapters = compendiumChapters();
  if (compendiumState.chapter !== "All" && !chapters.includes(compendiumState.chapter)) compendiumState.chapter = "All";
  const matches = compendiumMatches();
  const selection = selectedCompendiumPage(matches);
  if (selection) {
    compendiumState.selectedBook = selection.book.id;
    compendiumState.selectedPage = selection.page.pdfPage;
  }
  const visibleMatches = matches.slice(0, 120);
  root.innerHTML = `
    <a class="skip-link" href="#compendium-content">Skip to rules compendium</a>
    <main class="compendium-scene theme-assessment">
      <header class="topbar compendium-topbar">
        ${portalEmblem}
        <div class="brand"><strong>Dark Heresy Rules Library</strong><span>Compendium</span></div>
        ${renderPortalSectionNav("compendium")}
        <label class="text-size-control" title="Interface text size">
          <span aria-hidden="true">TEXT</span>
          <input id="text-size" type="range" min="80" max="160" step="5" value="${Math.round(textScale * 100)}" aria-label="Interface text size" />
          <output id="text-size-value" for="text-size">${Math.round(textScale * 100)}%</output>
        </label>
      </header>
      <section class="compendium-content" id="compendium-content" tabindex="-1">
        <div class="compendium-heading">
          <div><p class="eyebrow">Inquisitorial Reference</p><h1>Rules Compendium</h1></div>
          <p>Search the Core Rulebook and all three Enemies supplements. Every result retains its source and printed page.</p>
        </div>
        <div class="quick-rules" aria-label="Core rule glossary">
          ${coreRuleTerms.map((entry) => `<button type="button" class="quick-rule-chip" data-compendium-term="${entry.id}">${entry.term}</button>`).join("")}
        </div>
        ${!compendiumData ? `
          <div class="compendium-loading" role="status">${compendiumLoadError ? `<strong>Library unavailable</strong><span>${escapeHtmlAttribute(compendiumLoadError)}</span>` : `<strong>Opening the sealed archive…</strong><span>Loading four local sourcebooks.</span>`}</div>
        ` : `
          <div class="compendium-toolbar">
            <label><span>Search rules</span><input id="compendium-search" type="search" value="${escapeHtmlAttribute(compendiumState.query)}" placeholder="Test, combat action, talent, daemon…" autocomplete="off" /></label>
            <label><span>Sourcebook</span><select id="compendium-book"><option value="all" ${compendiumState.book === "all" ? "selected" : ""}>All four books</option>${books.map((book) => `<option value="${book.id}" ${compendiumState.book === book.id ? "selected" : ""}>${escapeHtmlAttribute(book.shortTitle)}</option>`).join("")}</select></label>
            <label><span>Chapter</span><select id="compendium-chapter"><option>All</option>${chapters.map((chapter) => `<option ${compendiumState.chapter === chapter ? "selected" : ""}>${escapeHtmlAttribute(chapter)}</option>`).join("")}</select></label>
          </div>
          <div class="compendium-layout">
            <nav class="compendium-results" aria-label="Rules search results">
              <div class="compendium-result-count"><strong>${matches.length}</strong><span>matching pages${matches.length > visibleMatches.length ? ` · first ${visibleMatches.length} shown` : ""}</span></div>
              ${visibleMatches.map(({ book, page }) => `
                <button type="button" class="compendium-result ${selection?.book.id === book.id && selection?.page.pdfPage === page.pdfPage ? "selected" : ""}" data-rule-book="${book.id}" data-rule-page="${page.pdfPage}" aria-pressed="${selection?.book.id === book.id && selection?.page.pdfPage === page.pdfPage}">
                  <span>${escapeHtmlAttribute(book.shortTitle)} · p. ${escapeHtmlAttribute(page.printedPage)}</span>
                  <strong>${escapeHtmlAttribute(page.heading || page.chapter)}</strong>
                  <small>${escapeHtmlAttribute(compendiumSnippet(page.text, compendiumState.query))}</small>
                </button>`).join("")}
            </nav>
            ${renderCompendiumReader(selection)}
          </div>
        `}
      </section>
      <footer class="roster-footer"><span>Rules Compendium</span><span>Source text © its respective rights holders · Do not redistribute</span></footer>
    </main>`;

  wireCompendiumEvents();
  requestAnimationFrame(applyTextScale);
  if (!compendiumData && !compendiumLoadError) loadCompendium();
}

function legacyWireCompendiumEvents() {
  document.querySelector("#open-roster")?.addEventListener("click", () => {
    appView = "roster";
    save();
    render();
  });
  document.querySelector("#open-reinforcements")?.addEventListener("click", () => {
    appView = "reinforcements";
    save();
    render();
  });
  document.querySelector("#text-size")?.addEventListener("input", (event) => {
    textScale = Number(event.target.value) / 100;
    localStorage.setItem("dh2-text-scale", String(textScale));
    document.querySelector("#text-size-value").textContent = `${Math.round(textScale * 100)}%`;
    applyTextScale();
  });
  document.querySelector("#compendium-search")?.addEventListener("input", (event) => {
    window.clearTimeout(compendiumSearchTimer);
    compendiumState.query = event.target.value;
    compendiumSearchTimer = window.setTimeout(() => {
      renderCompendium();
      const search = document.querySelector("#compendium-search");
      search?.focus();
      search?.setSelectionRange(search.value.length, search.value.length);
    }, 160);
  });
  document.querySelector("#compendium-book")?.addEventListener("change", (event) => {
    compendiumState.book = event.target.value;
    compendiumState.chapter = "All";
    renderCompendium();
  });
  document.querySelector("#compendium-chapter")?.addEventListener("change", (event) => {
    compendiumState.chapter = event.target.value;
    renderCompendium();
  });
  document.querySelectorAll("[data-rule-book]").forEach((button) => {
    button.addEventListener("click", () => {
      compendiumState.selectedBook = button.dataset.ruleBook;
      compendiumState.selectedPage = Number(button.dataset.rulePage);
      renderCompendium();
      document.querySelector(".compendium-reader")?.focus({ preventScroll: true });
    });
  });
  document.querySelectorAll("[data-compendium-term]").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = ruleTermsById[button.dataset.compendiumTerm];
      if (!entry) return;
      compendiumState.query = entry.term;
      compendiumState.book = "core";
      compendiumState.chapter = "All";
      renderCompendium();
    });
  });
}

function compendiumChapterCatalog() {
  return compendiumBooks().flatMap((book) =>
    [...new Set(book.pages.map((page) => page.chapter).filter(Boolean))]
      .filter((chapter) => isReferenceChapter(book, chapter))
      .map((chapter) => {
        const isFrontMatter = chapter === book.shortTitle
          || chapter === book.title
          || /^DH\d+_/i.test(chapter);
        return {
          key: `${book.id}::${chapter}`,
          book,
          chapter,
          label: isFrontMatter ? "Front Matter & Contents" : chapter,
        };
      }),
  );
}

function activeCompendiumChapter() {
  const catalog = compendiumChapterCatalog();
  let selected = catalog.find(({ book, chapter }) =>
    book.id === compendiumState.selectedBook && chapter === compendiumState.chapter,
  );
  if (!selected) {
    selected = catalog.find(({ book, chapter }) => book.id === "core" && chapter.startsWith("Chapter I:"))
      || catalog.find(({ book }) => book.id === "core")
      || catalog[0]
      || null;
  }
  if (selected) {
    compendiumState.selectedBook = selected.book.id;
    compendiumState.chapter = selected.chapter;
  }
  return selected;
}

function compendiumSectionMatches() {
  const query = compendiumState.query.trim().toLowerCase();
  if (!query) return [];
  const matches = new Map();
  for (const entry of compendiumSearchIndex) {
      if (!entry.text.includes(query)) continue;
      const { book, page } = entry;
      const sectionName = page.heading || page.chapter;
      const key = `${book.id}::${sectionName}`;
      const score = entry.heading === query ? 100 : entry.heading.includes(query) ? 70 : entry.chapter.includes(query) ? 35 : 1;
      const existing = matches.get(key);
      if (!existing || score > existing.score) matches.set(key, { book, page, score });
  }
  return [...matches.values()].sort((a, b) => b.score - a.score || a.page.heading.localeCompare(b.page.heading));
}

const compendiumTooltipTerms = [...contextualRuleTerms, ...creatorRuleTerms]
  .flatMap((entry) => [entry.term, ...entry.aliases].map((alias) => ({ alias, entry })))
  .filter(({ alias }) => alias.length > 1)
  .sort((a, b) => b.alias.length - a.alias.length);
const compendiumTooltipMap = new Map(compendiumTooltipTerms.map(({ alias, entry }) => [alias.toLowerCase(), entry]));
const compendiumTooltipPattern = new RegExp(
  `\\b(${compendiumTooltipTerms.map(({ alias }) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi",
);

function compendiumTermKind(category) {
  if (category === "Action") return "action";
  if (category === "Faction") return "faction";
  if (category === "Condition") return "condition";
  if (category === "Threat") return "threat";
  if (category === "Psychic" || category === "Psychic Powers") return "psychic";
  if (category === "Quality") return "quality";
  if (category === "Skill" || category === "Skills") return "skill";
  return "mechanic";
}

function highlightCompendiumTerms(text, book) {
  const seen = new Set();
  const tokens = [];
  for (const match of String(text).matchAll(compendiumTooltipPattern)) {
    const entry = compendiumTooltipMap.get(match[0].toLowerCase());
    if (!entry) continue;
    tokens.push({ type: "term", start: match.index, end: match.index + match[0].length, text: match[0], entry });
  }
  const pagePattern = /\b(?:see\s+)?(?:page|pages|p\.)\s+(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?/gi;
  for (const match of String(text).matchAll(pagePattern)) {
    const target = book?.pages.find((page) => String(page.printedPage).trim() === match[1]);
    if (!target) continue;
    tokens.push({
      type: "page",
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      target,
      rangeEnd: match[2] || "",
    });
  }
  tokens.sort((a, b) => a.start - b.start || (a.type === "page" ? -1 : 1));
  let cursor = 0;
  let output = "";
  for (const token of tokens) {
    if (token.start < cursor) continue;
    if (token.type === "term" && seen.has(token.entry.term)) continue;
    output += escapeHtmlAttribute(String(text).slice(cursor, token.start));
    if (token.type === "page") {
      const destination = token.rangeEnd
        ? `printed pages ${token.target.printedPage}-${token.rangeEnd}`
        : `printed page ${token.target.printedPage}`;
      output += `<button type="button" class="source-page-link" data-source-book="${book.id}" data-source-page="${token.target.pdfPage}" data-tooltip="Open ${escapeHtmlAttribute(destination)} in ${escapeHtmlAttribute(book.shortTitle)}.">${escapeHtmlAttribute(token.text)}</button>`;
      cursor = token.end;
      continue;
    }
    const entry = token.entry;
    seen.add(entry.term);
    const tooltip = `${entry.category}: ${entry.summary} Source: ${entry.book}, page ${entry.page}.`;
    output += `<span class="lore-term lore-term-${compendiumTermKind(entry.category)}" tabindex="0" data-tooltip="${escapeHtmlAttribute(tooltip)}" aria-label="${escapeHtmlAttribute(`${token.text}. ${tooltip}`)}">${escapeHtmlAttribute(token.text)}</span>`;
    cursor = token.end;
  }
  output += escapeHtmlAttribute(String(text).slice(cursor));
  return output;
}

function reflowCompendiumText(text) {
  const lines = restoreCollapsedSpelling(restoreExpandedSpelling(normalizeErraticSmallCaps(restoreDetachedInitials(restoreSplitSmallCapsLines(String(text || ""))))))
    .replace(/\bEXAMPM?\s*LE\b/gi, "EXAMPLE")
    .replace(/\bE\s+XAMPLE\b/gi, "EXAMPLE")
    .replace(/\bS\s+KILL TESTS\b/gi, "SKILL TESTS")
    .replace(/\bC\s+HARACTERISTIC T\s+ESTS\b/gi, "CHARACTERISTIC TESTS")
    .replace(/\bS\s+KILLS,\s*T\s+ALENTS,\s*T?\s*AND R\s+AITS\b/gi, "SKILLS, TALENTS, AND TRAITS")
    .replace(/^DIFFI?F?\s*CULTY\s+TESE?\s*T\s+MODIFIER$/gim, "DIFFICULTY TEST MODIFIER")
    .replace(/^Rout\w*\s+ine(\s+[+-]\d+)?$/gim, (_, modifier = "") => `Routine${modifier}`)
    .replace(/^Challeng\w*\s+ing(\s+[+-]\d+)?$/gim, (_, modifier = "") => `Challenging${modifier}`)
    .replace(/^Diffic\w*\s+ult(\s+[–-]\d+)?$/gim, (_, modifier = "") => `Difficult${modifier}`)
    .replace(/^H\s+rd(\s+[–-]\d+)?$/gim, (_, modifier = "") => `Hard${modifier}`)
    .replace(/([+-]\d)\+\s*0\b/g, (_, prefix) => `${prefix}0`)
    .replace(/\u00ad/g, "")
    .replaceAll("â€™", "’")
    .replaceAll("â€˜", "‘")
    .replaceAll("â€œ", "“")
    .replaceAll("â€", "”")
    .replaceAll("â€“", "–")
    .replaceAll("â€”", "—")
    .replaceAll("ï¬", "fi")
    .replaceAll("ï¬‚", "fl")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => {
      if (!line || /^\d{1,3}$/.test(line)) return false;
      if (/^CHAPTER\s+[IVXLC]+:.*\s+\d+$/i.test(line)) return false;
      const words = line.match(/[A-Z]+/g) || [];
      if (
        line.length <= 70
        && line === line.toUpperCase()
        && words.some((word) => word.length === 1)
        && words.some((word) => word.length >= 3)
      ) return false;
      if (/\(cid:\d+\)/i.test(line)) return false;
      if (/(.{1,4})\1{4,}/i.test(line)) return false;
      if (/\b[A-Za-z]{42,}\b/.test(line)) return false;
      const letters = (line.match(/[A-Za-z]/g) || []).length;
      const spaces = (line.match(/\s/g) || []).length;
      const repeatedLetters = [...line.matchAll(/([A-Za-z])\1+/g)]
        .reduce((total, match) => total + match[0].length - 1, 0);
      if (line.length >= 65 && spaces / line.length < 0.045) return false;
      if (letters >= 55 && repeatedLetters / letters > 0.055 && spaces / line.length < 0.13) return false;
      return true;
    });
  const roughParagraphs = [];
  let current = "";
  for (const line of lines) {
    if (!current) {
      current = line;
      continue;
    }
    const joinsHyphen = /[A-Za-z]-$/.test(current) && /^[a-z]/.test(line);
    current = joinsHyphen ? `${current.slice(0, -1)}${line}` : `${current} ${line}`;
    if (current.length >= 430 && /[.!?]["'”’)]?$/.test(line)) {
      roughParagraphs.push(current);
      current = "";
    }
  }
  if (current) roughParagraphs.push(current);
  const paragraphs = roughParagraphs.flatMap((paragraph) => {
    if (paragraph.length < 900) return [paragraph];
    const sentences = paragraph.match(/[^.!?]+[.!?]+(?:["'”’])?|[^.!?]+$/g) || [paragraph];
    const chunks = [];
    for (let index = 0; index < sentences.length; index += 4) {
      chunks.push(sentences.slice(index, index + 4).join(" ").replace(/\s+/g, " ").trim());
    }
    return chunks.filter(Boolean);
  });
  const seen = new Set();
  return paragraphs.filter((paragraph) => {
    const key = paragraph.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderChapterArticle(selection) {
  if (!selection) return `<div class="compendium-empty"><h2>Library unavailable</h2><p>No readable chapters were found.</p></div>`;
  const { book, chapter } = selection;
  const cacheKey = `${book.id}::${chapter}`;
  if (compendiumChapterHtmlCache.has(cacheKey)) return compendiumChapterHtmlCache.get(cacheKey);
  const pages = book.pages.filter((page) => page.chapter === chapter);
  const article = `
    <article class="compendium-reader compendium-book-reader" tabindex="0">
      <header class="compendium-article-header">
        <p class="choice-source">${escapeHtmlAttribute(book.shortTitle)}</p>
        <h2>${escapeHtmlAttribute(selection.label || chapter)}</h2>
        <div class="term-legend" aria-label="Highlighted term categories">
          <span class="legend-action">Actions</span>
          <span class="legend-faction">Factions</span>
          <span class="legend-condition">Conditions</span>
          <span class="legend-skill">Skills</span>
          <span class="legend-psychic">Psychic</span>
          <span class="legend-quality">Qualities</span>
          <span class="legend-threat">Threats</span>
          <span class="legend-mechanic">Core rules</span>
        </div>
      </header>
      ${pages.map((page) => {
        const paragraphs = reflowCompendiumText(page.text);
        return `
          <section class="compendium-section" id="rule-page-${page.pdfPage}">
            <div class="compendium-section-heading">
              <h3>${escapeHtmlAttribute(page.heading || chapter)}</h3>
            </div>
            <div class="compendium-article-text">${paragraphs.map((paragraph) => `<p>${highlightCompendiumTerms(paragraph, book)}</p>`).join("")}</div>
          </section>`;
      }).join("")}
    </article>`;
  compendiumChapterHtmlCache.set(cacheKey, article);
  return article;
}

function renderCompendiumSidebarBody(selection, chapterPages, matches = compendiumSectionMatches()) {
  const visibleMatches = matches.slice(0, 60);
  if (compendiumState.query) {
    return `
      <nav class="compendium-search-results" aria-label="Rules search results">
        <div class="compendium-result-count"><strong>${matches.length}</strong><span>matching sections</span></div>
        ${visibleMatches.map(({ book, page }) => `
          <button type="button" class="compendium-search-result ${compendiumState.selectedBook === book.id && Number(compendiumState.selectedPage) === page.pdfPage ? "selected" : ""}" data-rule-book="${book.id}" data-rule-chapter="${escapeHtmlAttribute(page.chapter)}" data-rule-page="${page.pdfPage}" ${compendiumState.selectedBook === book.id && Number(compendiumState.selectedPage) === page.pdfPage ? `aria-current="true"` : ""}>
            <strong>${escapeHtmlAttribute(page.heading || page.chapter)}</strong>
            <span>${escapeHtmlAttribute(book.shortTitle)} &middot; Printed page ${escapeHtmlAttribute(page.printedPage)}</span>
            <small>${escapeHtmlAttribute(compendiumSnippet(page.text, compendiumState.query))}</small>
          </button>`).join("")}
        ${matches.length === 0 ? `<p class="compendium-no-results">No matching headings or concepts.</p>` : ""}
      </nav>`;
  }
  const bookChapters = compendiumChapterCatalog().filter((entry) => entry.book.id === selection.book.id);
  return `
    <nav class="compendium-book-chapters" aria-label="Chapters in ${escapeHtmlAttribute(selection.book.shortTitle)}">
      <div class="compendium-book-label">
        <strong>${escapeHtmlAttribute(selection.book.shortTitle)}</strong>
        <span>${bookChapters.length} chapters</span>
      </div>
      ${bookChapters.map((entry) => `
        <button type="button" class="${entry.key === selection.key ? "selected" : ""}" data-rule-chapter-key="${escapeHtmlAttribute(entry.key)}" ${entry.key === selection.key ? `aria-current="page"` : ""}>
          ${escapeHtmlAttribute(entry.label)}
        </button>`).join("")}
    </nav>
    ${chapterPages.length ? `
      <details class="compendium-sidebar-disclosure">
        <summary>Headings in this chapter</summary>
        <nav class="compendium-contents" aria-label="Headings in this chapter">
          ${chapterPages.map((page) => `<button type="button" data-rule-anchor="${page.pdfPage}">${escapeHtmlAttribute(page.heading || page.chapter)}</button>`).join("")}
        </nav>
      </details>` : ""}
    <details class="compendium-sidebar-disclosure quick-rules-disclosure">
      <summary>Quick rules</summary>
      <div class="quick-rules compact" aria-label="Core rules glossary">
        ${coreRuleTerms.map((entry) => `<button type="button" data-compendium-term="${entry.id}">${entry.term}</button>`).join("")}
      </div>
    </details>`;
}

function renderSourcebookConnection() {
  const requirements = sourcebookRequirements();
  return `
    <div class="sourcebook-connect" role="status" aria-live="polite">
      <div class="sourcebook-connect-copy">
        <p class="eyebrow">Device-local reference</p>
        <strong>${compendiumImporting ? "Indexing sourcebooks" : "Connect Sourcebooks"}</strong>
        <p>${compendiumImporting
          ? escapeHtmlAttribute(compendiumImportProgress || "Preparing the selected files…")
          : escapeHtmlAttribute(compendiumLoadError || "Select the four sourcebooks to recreate the complete rules library in this browser.")}</p>
      </div>
      ${compendiumImporting ? `
        <div class="sourcebook-progress" aria-hidden="true"><span></span></div>
        <p class="sourcebook-privacy">Keep this tab open. Indexing all four books can take several minutes.</p>
      ` : `
        <ol class="sourcebook-requirements">
          ${requirements.map((book) => `<li><span>${escapeHtmlAttribute(book.shortTitle)}</span><small>${book.expectedPages} PDF pages</small></li>`).join("")}
        </ol>
        <div class="sourcebook-actions">
          <button class="primary-button" id="connect-sourcebooks" type="button">Select Four PDFs</button>
          <button class="compact-button" id="import-rules-index" type="button">Import Local Index</button>
          <button class="text-button" id="skip-sourcebooks" type="button">Skip for now</button>
        </div>
        <p class="sourcebook-privacy">Processing and storage happen only in this browser. After the first successful import, the index is reopened automatically on this browser and device. Sourcebook files and extracted text are not sent to GitHub, Supabase, or other players.</p>
      `}
    </div>`;
}

function renderCompendium() {
  const books = compendiumBooks();
  const catalog = compendiumChapterCatalog();
  const selection = activeCompendiumChapter();
  const matches = compendiumSectionMatches();
  const chapterIndex = selection ? catalog.findIndex((entry) => entry.key === selection.key) : -1;
  const chapterPages = selection
    ? selection.book.pages
      .filter((page) => page.chapter === selection.chapter && page.heading && page.heading !== selection.chapter)
      .filter((page, index, pages) => pages.findIndex((entry) => entry.heading === page.heading) === index)
    : [];
  root.innerHTML = `
    <a class="skip-link" href="#compendium-content">Skip to rules compendium</a>
    <main class="compendium-scene theme-assessment">
      <header class="topbar compendium-topbar">
        ${portalEmblem}
        <div class="brand"><strong>Dark Heresy Rules Library</strong><span>Compendium</span></div>
        ${renderPortalSectionNav("compendium")}
        ${hostedEdition && compendiumData ? `<button class="compact-button sourcebook-control" id="replace-sourcebooks" type="button">Manage Sourcebooks</button>` : ""}
        <label class="text-size-control" title="Interface text size">
          <span aria-hidden="true">TEXT</span>
          <input id="text-size" type="range" min="80" max="160" step="5" value="${Math.round(textScale * 100)}" aria-label="Interface text size" />
          <output id="text-size-value" for="text-size">${Math.round(textScale * 100)}%</output>
        </label>
      </header>
      <section class="compendium-content" id="compendium-content" tabindex="-1">
        <div class="compendium-heading">
          <div><p class="eyebrow">Inquisitorial Reference</p><h1>Rules Compendium</h1></div>
        </div>
        ${!compendiumData ? `
          ${hostedEdition
            ? renderSourcebookConnection()
            : `<div class="compendium-loading" role="status">${compendiumLoadError ? `<strong>Library unavailable</strong><span>${escapeHtmlAttribute(compendiumLoadError)}</span>` : `<strong>Opening the sealed archive...</strong><span>Loading four local sourcebooks.</span>`}</div>`}
        ` : `
          <div class="compendium-toolbar simplified">
            <label><span>Search the library</span><input id="compendium-search" type="search" value="${escapeHtmlAttribute(compendiumState.query)}" placeholder="Search a rule, talent, weapon, or concept..." autocomplete="off" /></label>
          </div>
          <div class="compendium-layout book-layout">
            <aside class="compendium-sidebar">
              <label class="chapter-picker">
                <span>Choose a chapter</span>
                <select id="compendium-chapter">
                  ${books.map((book) => `
                    <optgroup label="${escapeHtmlAttribute(book.shortTitle)}">
                      ${catalog.filter((entry) => entry.book.id === book.id).map((entry) => `<option value="${escapeHtmlAttribute(entry.key)}" ${selection?.key === entry.key ? "selected" : ""}>${escapeHtmlAttribute(entry.label)}</option>`).join("")}
                    </optgroup>`).join("")}
                </select>
              </label>
              <div class="compendium-sidebar-body">${renderCompendiumSidebarBody(selection, chapterPages, matches)}</div>
            </aside>
            <div class="compendium-reading-pane">
              <nav class="chapter-navigation" aria-label="Chapter navigation">
                <button type="button" id="previous-chapter" ${chapterIndex <= 0 ? "disabled" : ""}>&larr; Previous chapter</button>
                <button type="button" id="next-chapter" ${chapterIndex < 0 || chapterIndex >= catalog.length - 1 ? "disabled" : ""}>Next chapter &rarr;</button>
              </nav>
              ${renderChapterArticle(selection)}
              <nav class="chapter-navigation chapter-navigation-bottom" aria-label="Continue reading">
                <button type="button" id="previous-chapter-bottom" ${chapterIndex <= 0 ? "disabled" : ""}>&larr; Previous chapter</button>
                <button type="button" id="next-chapter-bottom" ${chapterIndex < 0 || chapterIndex >= catalog.length - 1 ? "disabled" : ""}>Next chapter &rarr;</button>
              </nav>
            </div>
          </div>
        `}
      </section>
      <footer class="roster-footer"><span>Rules Compendium</span><span>${hostedEdition ? "Sourcebook index stored only on this device" : "Source text belongs to its respective rights holders · Do not redistribute"}</span></footer>
      ${hostedEdition ? `
        <input id="sourcebook-files" class="visually-hidden" type="file" accept="application/pdf,.pdf" multiple />
        <input id="sourcebook-index-file" class="visually-hidden" type="file" accept="application/json,.json" />
      ` : ""}
    </main>`;

  wireCompendiumEvents();
  requestAnimationFrame(applyTextScale);
  if (!compendiumData && !compendiumLoadError) loadCompendium();
}

function scrollCompendiumToPage(pdfPage, { behavior = "smooth", focus = true } = {}) {
  requestAnimationFrame(() => {
    const target = document.querySelector(`#rule-page-${pdfPage}`);
    const reader = document.querySelector(".compendium-reader");
    if (!target || !reader) return;
    const overflow = getComputedStyle(reader).overflowY;
    const hasReaderScroll = ["auto", "scroll"].includes(overflow) && reader.scrollHeight > reader.clientHeight + 1;
    if (hasReaderScroll) {
      const readerBox = reader.getBoundingClientRect();
      const targetBox = target.getBoundingClientRect();
      reader.scrollTo({
        top: reader.scrollTop + targetBox.top - readerBox.top - 14,
        behavior,
      });
    } else {
      target.scrollIntoView({ behavior, block: "start" });
    }
    if (focus) {
      const heading = target.querySelector("h3");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
    }
  });
}

function resetCompendiumReader() {
  requestAnimationFrame(() => {
    const reader = document.querySelector(".compendium-reader");
    if (!reader) return;
    reader.scrollTop = 0;
    const heading = reader.querySelector("h2");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  });
}

function updateCompendiumSidebar() {
  const body = document.querySelector(".compendium-sidebar-body");
  const selection = activeCompendiumChapter();
  if (!body || !selection) return;
  const chapterPages = selection.book.pages
    .filter((page) => page.chapter === selection.chapter && page.heading && page.heading !== selection.chapter)
    .filter((page, index, pages) => pages.findIndex((entry) => entry.heading === page.heading) === index);
  body.innerHTML = renderCompendiumSidebarBody(selection, chapterPages);
  applyTextScale(body);
}

function wireCompendiumSidebarEvents() {
  const body = document.querySelector(".compendium-sidebar-body");
  body?.addEventListener("click", (event) => {
    const resultButton = event.target.closest("[data-rule-book]");
    if (resultButton) {
      const sidebarScroll = document.querySelector(".compendium-sidebar")?.scrollTop || 0;
      compendiumState.selectedBook = resultButton.dataset.ruleBook;
      compendiumState.chapter = resultButton.dataset.ruleChapter;
      compendiumState.selectedPage = Number(resultButton.dataset.rulePage);
      renderCompendium();
      const sidebar = document.querySelector(".compendium-sidebar");
      if (sidebar) sidebar.scrollTop = sidebarScroll;
      scrollCompendiumToPage(resultButton.dataset.rulePage);
      return;
    }
    const anchorButton = event.target.closest("[data-rule-anchor]");
    if (anchorButton) {
      scrollCompendiumToPage(anchorButton.dataset.ruleAnchor);
      return;
    }
    const chapterButton = event.target.closest("[data-rule-chapter-key]");
    if (chapterButton) {
      const [bookId, ...chapterParts] = chapterButton.dataset.ruleChapterKey.split("::");
      compendiumState.selectedBook = bookId;
      compendiumState.chapter = chapterParts.join("::");
      compendiumState.selectedPage = 0;
      compendiumState.query = "";
      renderCompendium();
      resetCompendiumReader();
      return;
    }
    const termButton = event.target.closest("[data-compendium-term]");
    if (termButton) {
      const entry = ruleTermsById[termButton.dataset.compendiumTerm];
      if (!entry) return;
      compendiumState.query = entry.term;
      const search = document.querySelector("#compendium-search");
      if (search) search.value = entry.term;
      updateCompendiumSidebar();
    }
  });
}

async function connectSourcebookFiles(files) {
  if (!files?.length || compendiumImporting) return;
  compendiumImporting = true;
  compendiumLoadError = "";
  compendiumImportProgress = "Preparing the selected files…";
  renderCompendium();
  try {
    const library = await buildSourcebookLibrary(files, ({ message }) => {
      compendiumImportProgress = message || compendiumImportProgress;
      const progress = document.querySelector(".sourcebook-connect-copy > p:last-child");
      if (progress) progress.textContent = compendiumImportProgress;
    });
    if (navigator.storage?.persist) {
      await navigator.storage.persist().catch(() => false);
    }
    activateCompendium(library);
    renderCompendium();
    resetCompendiumReader();
  } catch (error) {
    compendiumData = null;
    compendiumImporting = false;
    compendiumImportProgress = "";
    compendiumLoadError = error.message || "The selected sourcebooks could not be indexed.";
    renderCompendium();
  }
}

function wireCompendiumEvents() {
  document.querySelector("#open-roster")?.addEventListener("click", () => {
    appView = "roster";
    save();
    render();
  });
  document.querySelector("#open-reinforcements")?.addEventListener("click", () => {
    appView = "reinforcements";
    save();
    render();
  });
  document.querySelector("#text-size")?.addEventListener("input", (event) => {
    textScale = Number(event.target.value) / 100;
    localStorage.setItem("dh2-text-scale", String(textScale));
    document.querySelector("#text-size-value").textContent = `${Math.round(textScale * 100)}%`;
    applyTextScale();
  });
  document.querySelector("#connect-sourcebooks")?.addEventListener("click", () => {
    document.querySelector("#sourcebook-files")?.click();
  });
  document.querySelector("#import-rules-index")?.addEventListener("click", () => {
    document.querySelector("#sourcebook-index-file")?.click();
  });
  document.querySelector("#skip-sourcebooks")?.addEventListener("click", () => {
    localStorage.setItem("dh2-sourcebook-setup-skipped", "true");
    appView = "roster";
    save();
    render();
  });
  document.querySelector("#replace-sourcebooks")?.addEventListener("click", async () => {
    if (!confirm("Disconnect the sourcebook index from this browser? Character and campaign data will not be affected.")) return;
    await clearStoredSourcebookLibrary();
    compendiumData = null;
    compendiumLoadError = "Connect your four sourcebooks to rebuild this browser’s compendium.";
    compendiumSearchIndex = [];
    compendiumWordFrequency = new Map();
    compendiumChapterHtmlCache.clear();
    renderCompendium();
  });
  document.querySelector("#sourcebook-files")?.addEventListener("change", async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    await connectSourcebookFiles(files);
  });
  document.querySelector("#sourcebook-index-file")?.addEventListener("change", async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    await connectSourcebookFiles(files);
  });
  document.querySelector("#compendium-search")?.addEventListener("input", (event) => {
    window.clearTimeout(compendiumSearchTimer);
    compendiumState.query = event.target.value;
    compendiumSearchTimer = window.setTimeout(() => {
      updateCompendiumSidebar();
    }, 55);
  });
  document.querySelector("#compendium-chapter")?.addEventListener("change", (event) => {
    const [bookId, ...chapterParts] = event.target.value.split("::");
    compendiumState.selectedBook = bookId;
    compendiumState.chapter = chapterParts.join("::");
    compendiumState.query = "";
    renderCompendium();
  });
  wireCompendiumSidebarEvents();
  document.querySelectorAll(".source-page-link").forEach((button) => {
    button.addEventListener("click", () => {
      const sidebarScroll = document.querySelector(".compendium-sidebar")?.scrollTop || 0;
      const bookId = button.dataset.sourceBook;
      const pdfPage = Number(button.dataset.sourcePage);
      const book = compendiumBooks().find((entry) => entry.id === bookId);
      const page = book?.pages.find((entry) => entry.pdfPage === pdfPage);
      if (!book || !page) return;
      compendiumState.selectedBook = book.id;
      compendiumState.chapter = page.chapter;
      compendiumState.selectedPage = page.pdfPage;
      renderCompendium();
      const sidebar = document.querySelector(".compendium-sidebar");
      if (sidebar) sidebar.scrollTop = sidebarScroll;
      scrollCompendiumToPage(page.pdfPage);
    });
  });
  const catalog = compendiumChapterCatalog();
  const currentIndex = catalog.findIndex((entry) =>
    entry.book.id === compendiumState.selectedBook && entry.chapter === compendiumState.chapter,
  );
  const moveChapter = (offset) => {
    const destination = catalog[currentIndex + offset];
    if (!destination) return;
    compendiumState.selectedBook = destination.book.id;
    compendiumState.chapter = destination.chapter;
    compendiumState.query = "";
    renderCompendium();
    resetCompendiumReader();
  };
  document.querySelector("#previous-chapter")?.addEventListener("click", () => moveChapter(-1));
  document.querySelector("#previous-chapter-bottom")?.addEventListener("click", () => moveChapter(-1));
  document.querySelector("#next-chapter")?.addEventListener("click", () => moveChapter(1));
  document.querySelector("#next-chapter-bottom")?.addEventListener("click", () => moveChapter(1));
}

function applyRuleHighlights() {
  const content = document.querySelector("#scene-content");
  if (!content || content.closest(".scene-identity")) return;
  const aliases = creatorRuleTerms
    .filter((entry) => entry.id !== "test")
    .flatMap((entry) => [entry.term, ...entry.aliases].map((alias) => ({ alias, id: entry.id })))
    .sort((a, b) => b.alias.length - a.alias.length);
  const pattern = new RegExp(`(?<![A-Za-z0-9-])(${aliases.map(({ alias }) => alias.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")).join("|")})(?![A-Za-z0-9-])`, "gi");
  const aliasMap = new Map(aliases.map(({ alias, id }) => [alias.toLowerCase(), id]));
  const reviewPage = Boolean(content.closest(".scene-review"));
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (!node.nodeValue?.trim()) continue;
    if (node.parentElement?.closest("button,input,textarea,select,option,label,legend,a,.choice-source,.characteristic-abbreviation,.rule-term,.review-characteristics,.review-vitals-strip,.review-meta,.xp-ledger,.loadout-panel,.validation-panel,.review-section-heading,.inventory-item-identity,.action-card,.review-sections strong,.review-sections h1,.review-sections h2,.review-sections h3")) continue;
    const matches = [...node.nodeValue.matchAll(pattern)];
    if (!matches.length) continue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of matches) {
      const id = aliasMap.get(match[0].toLowerCase());
      const entry = ruleTermsById[id];
      if (!entry || match.index < cursor) continue;
      fragment.append(node.nodeValue.slice(cursor, match.index));
      if (reviewPage && entry.category === "Characteristic") {
        fragment.append(match[0]);
        cursor = match.index + match[0].length;
        continue;
      }
      const button = document.createElement("button");
      const tooltip = `${entry.category}: ${entry.summary} Source: ${entry.book}, page ${entry.page}.`;
      button.type = "button";
      button.className = `rule-term lore-term lore-term-${compendiumTermKind(entry.category)}`;
      button.dataset.ruleTerm = id;
      button.dataset.tooltip = tooltip;
      button.textContent = match[0];
      button.setAttribute("aria-label", `${match[0]}. ${tooltip}`);
      fragment.append(button);
      cursor = match.index + match[0].length;
    }
    fragment.append(node.nodeValue.slice(cursor));
    node.replaceWith(fragment);
  }
}

function floatingRuleTooltip() {
  let tooltip = document.querySelector("#floating-rule-tooltip");
  if (tooltip) return tooltip;
  tooltip = document.createElement("div");
  tooltip.id = "floating-rule-tooltip";
  tooltip.className = "floating-rule-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.append(tooltip);
  return tooltip;
}

function hideFloatingRuleTooltip() {
  activeFloatingTooltipTarget = null;
  const tooltip = document.querySelector("#floating-rule-tooltip");
  if (tooltip) tooltip.hidden = true;
}

function positionFloatingRuleTooltip(target) {
  const text = target?.dataset.tooltip?.trim();
  if (!text || !target.isConnected) return hideFloatingRuleTooltip();
  const tooltip = floatingRuleTooltip();
  activeFloatingTooltipTarget = target;
  tooltip.textContent = text;
  tooltip.style.setProperty("--tooltip-accent", getComputedStyle(target).color);
  tooltip.style.fontSize = `${((window.matchMedia("(max-width: 640px)").matches ? 16 : 18) * textScale).toFixed(2)}px`;
  tooltip.dataset.placement = "above";
  tooltip.hidden = false;
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";

  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const edge = 12;
  const gap = 10;
  const left = Math.min(
    Math.max(edge, targetRect.left + (targetRect.width - tooltipRect.width) / 2),
    Math.max(edge, viewportWidth - tooltipRect.width - edge),
  );
  let top = targetRect.top - tooltipRect.height - gap;
  if (top < edge) {
    top = targetRect.bottom + gap;
    tooltip.dataset.placement = "below";
  }
  top = Math.min(Math.max(edge, top), Math.max(edge, viewportHeight - tooltipRect.height - edge));
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}

function wireFloatingMechanicsTooltips() {
  document.querySelectorAll(".scene .lore-term[data-tooltip]").forEach((target) => {
    target.addEventListener("pointerenter", () => positionFloatingRuleTooltip(target));
    target.addEventListener("pointerleave", hideFloatingRuleTooltip);
    target.addEventListener("focus", () => positionFloatingRuleTooltip(target));
    target.addEventListener("blur", hideFloatingRuleTooltip);
  });
  if (floatingTooltipListenersReady) return;
  floatingTooltipListenersReady = true;
  window.addEventListener("resize", () => {
    if (activeFloatingTooltipTarget) positionFloatingRuleTooltip(activeFloatingTooltipTarget);
  });
  document.addEventListener("scroll", () => {
    if (!activeFloatingTooltipTarget) return;
    requestAnimationFrame(() => positionFloatingRuleTooltip(activeFloatingTooltipTarget));
  }, true);
}

function switchToCharacter(recordId) {
  const record = characterLibrary.find((entry) => entry.id === recordId);
  if (!record) return;
  activeCharacterId = record.id;
  activeRecord = record;
  character = prepareCharacter(record.character);
  step = Math.min(scenes.length - 1, Math.max(0, Number(record.step || 0)));
  appView = "builder";
  migrateLegacyEquipment();
  migrateLegacyTalents();
  save();
  pendingFocusSelector = "#scene-content";
  render();
}

function createRosterCharacter(seed = {}, origin = "Created locally") {
  const now = new Date().toISOString();
  const id = characterId();
  const record = {
    id,
    character: prepareCharacter(seed),
    step: 0,
    createdAt: now,
    updatedAt: now,
    origin,
  };
  characterLibrary.unshift(record);
  activeCharacterId = id;
  activeRecord = record;
  character = prepareCharacter(record.character);
  step = 0;
  appView = "builder";
  save();
  pendingFocusSelector = "#scene-content";
  render();
}

function renderPortalSectionNav(active = "") {
  const button = (id, label, narrow) => `<button class="roster-button" id="open-${id}" type="button" ${active === id ? 'aria-current="page" disabled' : ""}><span class="nav-wide">${label}</span><span class="nav-narrow">${narrow}</span></button>`;
  return `<nav class="section-nav" aria-label="Portal sections">
    ${button("roster", "Your Acolytes", "Acolytes")}
    ${button("reinforcements", "Reinforcements", "Support")}
    ${button("compendium", "Rules Compendium", "Rules")}
  </nav>`;
}

function reinforcementEntries() {
  return [
    ...reinforcementCatalogue,
    ...vehicleCatalogue,
    ...armoury.map((item) => ({
      id: `equipment-${item.id}`,
      type: "equipment",
      category: "Equipment",
      name: item.name,
      source: item.source || "Armoury",
      page: Number(String(item.source || "").match(/p\.\s*(\d+)/i)?.[1] || 0) || null,
      tags: [item.category, item.availability, item.documentType].filter(Boolean),
      summary: item.description || "Equipment profile from the Armoury.",
      item,
    })),
  ];
}

function reinforcementSearchText(entry) {
  return [
    entry.name,
    entry.category,
    entry.source,
    entry.summary,
    entry.tags?.join(" "),
    entry.peer,
    entry.requirements,
    entry.profileText,
    JSON.stringify(entry.characteristics || {}),
    JSON.stringify(entry.profile || {}),
    entry.weapons?.join(" "),
    entry.skills?.join(" "),
    entry.talents?.join(" "),
    entry.traits?.join(" "),
    entry.gear?.join(" "),
  ].filter(Boolean).join(" ").toLowerCase();
}

function reinforcementStatCells(entry) {
  const stats = entry.characteristics || {};
  const labels = [
    ["wounds", "Wounds"], ["ws", "WS"], ["bs", "BS"], ["strength", "S"], ["toughness", "T"],
    ["agility", "Ag"], ["intelligence", "Int"], ["perception", "Per"], ["willpower", "WP"], ["fellowship", "Fel"],
  ];
  return labels.filter(([id]) => stats[id] !== undefined).map(([id, label]) => `<div><span>${label}</span><strong>${escapeHtmlAttribute(stats[id])}</strong></div>`).join("");
}

function reinforcementArtwork(entry) {
  if (entry.type === "vehicle") return stageArtById.equipment;
  const tags = (entry.tags || []).map((tag) => String(tag).toLowerCase());
  const artId = tags.includes("assassin") ? "assassin"
    : tags.includes("adeptus astartes") || tags.includes("grey knights") ? "crusader"
      : tags.includes("ecclesiarchy") || tags.includes("adepta sororitas") ? "adepta-sororitas"
        : tags.includes("daemonhost") || tags.includes("daemon") ? "daemon-world"
          : tags.includes("eldar") ? "rogue-trader-fleet"
            : tags.includes("ork") || tags.includes("kroot") ? "outcast"
              : "review";
  return artByChoice[artId] || stageArtById.review;
}

function reinforcementListEntries(entries, selectedId) {
  return entries.map((entry) => `
    <button class="reinforcement-list-entry ${entry.id === selectedId ? "selected" : ""}" type="button" data-reinforcement-id="${escapeHtmlAttribute(entry.id)}" aria-pressed="${entry.id === selectedId}">
      <span class="reinforcement-list-kind">${escapeHtmlAttribute(entry.category || entry.type)}</span>
      <strong>${escapeHtmlAttribute(entry.name)}</strong>
      <small>${escapeHtmlAttribute(entry.source || "Sourcebook catalogue")}${entry.page ? ` · p. ${escapeHtmlAttribute(entry.page)}` : ""}</small>
    </button>`).join("") || `<div class="reinforcement-empty"><strong>No matching records</strong><span>Try another name, sourcebook, or category.</span></div>`;
}

function reinforcementDetail(entry) {
  if (!entry) return `<div class="reinforcement-empty reinforcement-empty-detail"><h2>Select a record</h2><p>Choose an NPC, vehicle, or equipment profile from the catalogue.</p></div>`;
  const tags = (entry.tags || []).filter(Boolean).map((tag) => `<span>${escapeHtmlAttribute(tag)}</span>`).join("");
  if (entry.type === "equipment") {
    const item = entry.item || {};
    const profile = item.profile || {};
    return `<article class="reinforcement-record equipment-record">
      <header class="reinforcement-record-header"><div class="reinforcement-record-art" style="--record-image:url('${reinforcementArtwork(entry)}')" aria-hidden="true"></div><div><p class="eyebrow">Equipment profile</p><h2>${escapeHtmlAttribute(entry.name)}</h2><p>${escapeHtmlAttribute(entry.summary)}</p></div><span class="reinforcement-record-mark">◆</span></header>
      <div class="reinforcement-tags">${tags}</div>
      <dl class="reinforcement-facts"><div><dt>Category</dt><dd>${escapeHtmlAttribute(item.category || "Equipment")}</dd></div><div><dt>Availability</dt><dd>${escapeHtmlAttribute(item.availability || profile.availability || "—")}</dd></div><div><dt>Weight</dt><dd>${profile.weight ?? item.weight ?? "—"}${profile.weight || item.weight ? " kg" : ""}</dd></div><div><dt>Craftsmanship</dt><dd>${escapeHtmlAttribute(item.craftsmanship || profile.craftsmanship || "Common")}</dd></div></dl>
      <section class="reinforcement-text-block"><h3>Rules summary</h3><p>${escapeHtmlAttribute(item.description || entry.summary || "No summary recorded.")}</p></section>
      <p class="reinforcement-source">${escapeHtmlAttribute(entry.source || "Armoury")}</p>
    </article>`;
  }
  const influence = entry.influenceMinimum ? `<div class="reinforcement-influence"><span>Influence minimum <strong>${escapeHtmlAttribute(entry.influenceMinimum)}</strong></span><span>Influence cost <strong>${escapeHtmlAttribute(entry.influenceCost)}</strong></span></div>` : "";
  const statGrid = entry.characteristics ? `<section class="reinforcement-stat-section"><h3>Characteristics</h3><div class="reinforcement-stat-grid">${reinforcementStatCells(entry)}</div></section>` : entry.profileText ? `<section class="reinforcement-stat-section"><h3>Profile</h3><p class="reinforcement-profile-text">${escapeHtmlAttribute(entry.profileText)}</p></section>` : "";
  const vehicleFacts = entry.profile ? `<dl class="reinforcement-facts vehicle-facts"><div><dt>Armour</dt><dd>Front ${escapeHtmlAttribute(entry.profile.front)} · Side ${escapeHtmlAttribute(entry.profile.side)} · Rear ${escapeHtmlAttribute(entry.profile.rear)}</dd></div><div><dt>Speed</dt><dd>${escapeHtmlAttribute(entry.profile.cruising)} cruising · ${escapeHtmlAttribute(entry.profile.tactical)} tactical</dd></div><div><dt>Manoeuvrability</dt><dd>${escapeHtmlAttribute(entry.profile.manoeuvrability)}</dd></div><div><dt>Size</dt><dd>${escapeHtmlAttribute(entry.profile.size)}</dd></div><div><dt>Carrying</dt><dd>${escapeHtmlAttribute(entry.profile.carrying)} · Integrity ${escapeHtmlAttribute(entry.profile.integrity)}</dd></div><div><dt>Crew</dt><dd>${escapeHtmlAttribute(entry.profile.crew)}</dd></div></dl>` : "";
  const listBlock = (title, values) => values?.length ? `<section class="reinforcement-text-block"><h3>${title}</h3><ul>${values.map((value) => `<li>${escapeHtmlAttribute(value)}</li>`).join("")}</ul></section>` : "";
  return `<article class="reinforcement-record">
    <header class="reinforcement-record-header"><div class="reinforcement-record-art" style="--record-image:url('${reinforcementArtwork(entry)}')" aria-hidden="true"></div><div><p class="eyebrow">${escapeHtmlAttribute(entry.category || "Sourcebook record")}${entry.tier ? ` · ${escapeHtmlAttribute(entry.tier)}` : ""}</p><h2>${escapeHtmlAttribute(entry.name)}</h2><p>${escapeHtmlAttribute(entry.summary)}</p></div><span class="reinforcement-record-mark">${entry.type === "vehicle" ? "◇" : "✦"}</span></header>
    <div class="reinforcement-tags">${tags}</div>${influence}${entry.peer ? `<p class="reinforcement-callout"><strong>Calling this support:</strong> ${escapeHtmlAttribute(entry.peer)}</p>` : ""}${entry.requirements ? `<p class="reinforcement-callout warning"><strong>Requirement:</strong> ${escapeHtmlAttribute(entry.requirements)}</p>` : ""}
    ${statGrid}${vehicleFacts}<div class="reinforcement-columns">${listBlock("Weapons", entry.weapons)}${listBlock("Skills", entry.skills)}${listBlock("Talents", entry.talents)}${listBlock("Traits", entry.traits)}${listBlock("Gear", entry.gear)}${listBlock("Psychic powers", entry.psychicPowers)}${listBlock("Special rules", entry.notes)}</div>
    <footer class="reinforcement-record-footer"><span>${escapeHtmlAttribute(entry.source || "Sourcebook catalogue")}${entry.page ? ` · p. ${escapeHtmlAttribute(entry.page)}` : ""}${entry.statBlockPage ? ` · statblock p. ${escapeHtmlAttribute(entry.statBlockPage)}` : ""}</span>${entry.fate !== undefined ? `<span>Fate ${escapeHtmlAttribute(entry.fate)}</span>` : ""}</footer>
  </article>`;
}

function renderReinforcements() {
  const allEntries = reinforcementEntries();
  const validCategories = new Set(["All", "NPCs", "Vehicles", "Equipment"]);
  if (!validCategories.has(reinforcementState.category)) reinforcementState.category = "All";
  const query = reinforcementState.query.trim().toLowerCase();
  const filtered = allEntries.filter((entry) => (reinforcementState.category === "All" || entry.category === reinforcementState.category) && (!query || reinforcementSearchText(entry).includes(query)));
  if (!filtered.some((entry) => entry.id === reinforcementState.selectedId)) reinforcementState.selectedId = filtered[0]?.id || "";
  const selected = allEntries.find((entry) => entry.id === reinforcementState.selectedId);
  const categories = ["All", "NPCs", "Vehicles", "Equipment"];
  root.innerHTML = `<main class="reinforcement-scene theme-assessment">
    <header class="topbar reinforcement-topbar">${portalEmblem}<div class="brand"><strong>Dark Heresy Field Archive</strong><span>Reinforcements</span></div>${renderPortalSectionNav("reinforcements")}<label class="text-size-control" title="Interface text size"><span aria-hidden="true">TEXT</span><input id="text-size" type="range" min="80" max="160" step="5" value="${Math.round(textScale * 100)}" aria-label="Interface text size" /><output id="text-size-value" for="text-size">${Math.round(textScale * 100)}%</output></label></header>
    <section class="reinforcement-content" id="reinforcement-content" tabindex="-1">
      <div class="reinforcement-heading"><div><p class="eyebrow">Warband support and reference</p><h1>Reinforcements</h1><p class="lede">Search sourcebook NPCs, vehicles, and Armoury equipment. The Reinforcement Characters also provide examples of affiliations, talents, and play styles for building your own Acolyte. The GM decides when they enter the warband.</p></div><div class="reinforcement-count" aria-live="polite"><strong>${filtered.length}</strong><span>records</span></div></div>
      <div class="reinforcement-toolbar"><label class="reinforcement-search"><span>Search the archive</span><input id="reinforcement-search" type="search" value="${escapeHtmlAttribute(reinforcementState.query)}" placeholder="Search names, factions, traits, or weapons…" autocomplete="off" /></label><div class="reinforcement-filter-group" role="tablist" aria-label="Record type">${categories.map((category) => `<button type="button" role="tab" class="${reinforcementState.category === category ? "active" : ""}" aria-selected="${reinforcementState.category === category}" data-reinforcement-category="${category}">${category}</button>`).join("")}</div><label class="reinforcement-filter-select"><span>Record type</span><select id="reinforcement-category-select">${categories.map((category) => `<option value="${category}" ${reinforcementState.category === category ? "selected" : ""}>${category}</option>`).join("")}</select></label></div>
      <div class="reinforcement-layout"><aside class="reinforcement-list" aria-label="Archive records"><div class="reinforcement-list-heading"><span>Archive records</span><strong>${filtered.length}</strong></div><div id="reinforcement-results">${reinforcementListEntries(filtered, reinforcementState.selectedId)}</div></aside><section class="reinforcement-inspector" aria-live="polite" id="reinforcement-inspector">${reinforcementDetail(selected)}</section></div>
    </section>
    <footer class="roster-footer"><span>Sourcebook reference · GM tools</span><span>Use the printed pages listed on each record for full rules context.</span></footer>
  </main>`;
  wireReinforcementEvents();
  requestAnimationFrame(applyTextScale);
}

function wireReinforcementEvents() {
  document.querySelector("#text-size")?.addEventListener("input", (event) => {
    textScale = Number(event.target.value) / 100;
    localStorage.setItem("dh2-text-scale", String(textScale));
    document.querySelector("#text-size-value").textContent = `${Math.round(textScale * 100)}%`;
    applyTextScale();
  });
  document.querySelector("#open-roster")?.addEventListener("click", () => { appView = "roster"; save(); render(); });
  document.querySelector("#open-compendium")?.addEventListener("click", () => { appView = "compendium"; save(); render(); });
  document.querySelectorAll("[data-reinforcement-category]").forEach((button) => button.addEventListener("click", () => {
    reinforcementState.category = button.dataset.reinforcementCategory;
    localStorage.setItem("dh2-reinforcement-category", reinforcementState.category);
    renderReinforcements();
  }));
  document.querySelector("#reinforcement-category-select")?.addEventListener("change", (event) => {
    reinforcementState.category = event.target.value;
    localStorage.setItem("dh2-reinforcement-category", reinforcementState.category);
    renderReinforcements();
  });
  document.querySelector("#reinforcement-search")?.addEventListener("input", (event) => {
    reinforcementState.query = event.target.value;
    localStorage.setItem("dh2-reinforcement-query", reinforcementState.query);
    renderReinforcements();
    requestAnimationFrame(() => { const input = document.querySelector("#reinforcement-search"); input?.focus(); input?.setSelectionRange(input.value.length, input.value.length); });
  });
  document.querySelectorAll("[data-reinforcement-id]").forEach((button) => button.addEventListener("click", () => {
    reinforcementState.selectedId = button.dataset.reinforcementId;
    localStorage.setItem("dh2-reinforcement-selected", reinforcementState.selectedId);
    renderReinforcements();
  }));
}

function renderRoster() {
  const orderedRecords = [...characterLibrary].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const repositoryLabel = cloudStatus === "connected"
    ? "Shared campaign synchronized"
    : cloudStatus === "connecting"
      ? "Connecting shared campaign"
      : cloudStatus === "offline"
        ? "Shared campaign unavailable"
        : repositoryStatus === "ready"
          ? "Local repository"
          : "Browser backup";
  const repositoryMessage = cloudStatus === "connected"
    ? `Changes synchronize automatically with campaign ${escapeHtmlAttribute(savedCampaignConnection()?.campaignId || "")}. Local recovery copies remain enabled.`
    : cloudStatus === "connecting"
      ? "The shared campaign is being contacted. You can keep working while the browser recovery copy remains active."
      : cloudStatus === "offline"
        ? "The shared service could not be reached. Characters remain safe in this browser; open Shared Campaign to retry or disconnect."
        : cloudStatus === "unconfigured"
          ? "Characters remain safe locally. Shared campaign storage is not configured yet."
          : repositoryStatus === "ready"
            ? "Characters are stored as separate files by this app, with a browser backup for recovery. Connect a campaign to synchronize with other players."
            : "Characters are safe in this browser. Connect a shared campaign for cross-device synchronization.";
  root.innerHTML = `
    <a class="skip-link" href="#roster-content">Skip to character roster</a>
    <main class="roster-scene theme-assessment">
      <div class="roster-art" aria-hidden="true"></div>
      <header class="topbar roster-topbar">
        ${portalEmblem}
        <div class="brand"><strong>Dark Heresy Character Creation</strong><span>Your Acolytes</span></div>
        ${renderPortalSectionNav("roster")}
        <label class="text-size-control" title="Interface text size">
          <span aria-hidden="true">TEXT</span>
          <input id="text-size" type="range" min="80" max="160" step="5" value="${Math.round(textScale * 100)}" aria-label="Interface text size" />
          <output id="text-size-value" for="text-size">${Math.round(textScale * 100)}%</output>
        </label>
      </header>
      <section class="roster-content" id="roster-content" tabindex="-1">
        <div class="roster-heading">
          <div>
            <p class="eyebrow">Acolyte Archive</p>
            <h1>Your Acolytes</h1>
            <p class="lede">Continue your Acolyte's creation, preserve another version, or import a character shared by a friend.</p>
          </div>
          <div class="roster-actions">
            <button class="primary-button" id="new-character" type="button">Create Your Acolyte <span>›</span></button>
            <button class="compact-button" id="shared-archive" type="button">${savedCampaignConnection() ? "Shared Campaign" : "Connect Campaign"}</button>
            <button class="compact-button" id="import-character" type="button">Import Shared Character</button>
            <input class="sr-only" id="character-file" type="file" accept=".json,application/json" />
          </div>
        </div>
        <div class="roster-notice" role="status">
          <strong>${repositoryLabel}</strong>
          <span>${repositoryMessage}</span>
        </div>
        <div class="roster-grid" aria-label="${orderedRecords.length} saved character${orderedRecords.length === 1 ? "" : "s"}">
          ${orderedRecords.map((record) => {
            const savedCharacter = prepareCharacter(record.character);
            const progress = rosterProgress(record);
            const updated = new Date(record.updatedAt);
            const safeName = escapeHtmlAttribute(savedCharacter.name || "Unnamed Acolyte");
            return `
              <article class="roster-card ${record.id === activeCharacterId ? "active-record" : ""}">
                <div class="roster-card-heading">
                  <span>${escapeHtmlAttribute(record.origin || "Created locally")}</span>
                  <strong>${safeName}</strong>
                  <small>Last opened ${Number.isNaN(updated.valueOf()) ? "recently" : updated.toLocaleDateString()}</small>
                </div>
                <dl>
                  <div><dt>Home World</dt><dd>${escapeHtmlAttribute(rosterChoiceName("homeWorlds", savedCharacter.homeWorld))}</dd></div>
                  <div><dt>Background</dt><dd>${escapeHtmlAttribute(rosterChoiceName("backgrounds", savedCharacter.background))}</dd></div>
                  <div><dt>Role</dt><dd>${escapeHtmlAttribute(rosterChoiceName("roles", savedCharacter.role))}</dd></div>
                  <div><dt>Player</dt><dd>${escapeHtmlAttribute(savedCharacter.player || "Not recorded")}</dd></div>
                </dl>
                <div class="roster-progress" aria-label="${escapeHtmlAttribute(progress.label)}; ${progress.percentage}% complete">
                  <span style="--roster-progress:${progress.percentage}%"></span>
                  <small>${escapeHtmlAttribute(progress.label)}</small>
                </div>
                <div class="roster-card-actions">
                  <button class="primary-button" type="button" data-open-character="${record.id}">Open <span>›</span></button>
                  <button class="compact-button" type="button" data-duplicate-character="${record.id}">Duplicate</button>
                  <button class="compact-button" type="button" data-export-character="${record.id}">Export</button>
                  <button class="text-button danger-button" type="button" data-delete-character="${record.id}">Delete</button>
                </div>
              </article>`;
          }).join("") || `<div class="empty-roster"><h2>No Acolytes Recorded</h2><p>Create your first Acolyte or import one supplied by a friend.</p></div>`}
        </div>
      </section>
      <footer class="roster-footer">
        <span>Unofficial game aid</span>
        <button class="footer-credit-button" id="credits" type="button">Games Workshop · Fantasy Flight Games · Artist credits</button>
      </footer>
    </main>
    <dialog id="credits-dialog" aria-labelledby="credits-dialog-title">
      <button class="dialog-close" aria-label="Close credits">×</button>
      <p class="eyebrow">Credits and attribution</p>
      <h2 id="credits-dialog-title">Source & credits</h2>
      <p>Dark Heresy, Warhammer 40,000, and associated settings and sourcebook material belong to their respective rights holders. Original universe by Games Workshop; Dark Heresy Second Edition published by Fantasy Flight Games.</p>
      <p class="credit-small"><strong>Game creators:</strong> Dark Heresy originally designed by Owen Barnes, Kate Flack, and Mike Mason. Dark Heresy Second Edition designed by Andrew Fischer and produced by Tim Huckelbery.</p>
      ${hostedEdition ? "" : `<p class="credit-small"><strong>Soundtrack:</strong> “Dark Heresy — Roleplaying Game Ambient Music Mix,” supplied by the user for local playback.</p>`}
      <p class="credit-small">Sourcebook illustrations remain the work of their credited artists. Individual image, artist, book, and page provenance is recorded in the local project notes.</p>
      <p class="credit-small"><strong>Header emblem:</strong> Pax Historia Inquisitorial emblem supplied by the GM for this portal. Warhammer 40,000 imagery and marks belong to Games Workshop.</p>
      <p class="credit-small"><strong>Display type:</strong> Caslon Antique when available through a licensed local installation; bundled fallback IM FELL English by Igino Marini, licensed under the SIL Open Font License 1.1.</p>
      <details class="artist-credits">
        <summary>View credited Core Rulebook interior artists</summary>
        <p>David Ardila, A.L. Ashbaugh, Jacob Atienza, Cristi Balanescu, Lin Bo, Alex Boca, Matt Bradbury, Filip Burburan, Jon Cave, Anna Christenson, Alexandre Dainche, Mauro Dal Bo, Vincent Devault, Guillaume Ducos, Álvaro Calvo Escudero, Zack Graves, Ilich Henriquez, Imaginary FS Pte Ltd, Toni Justamante Jacobs, Nicholas Kay, Julian Kok, Anton Kokarev, Mathias Kollros, Alex Konstad, Sam Lamont, Clint Langley, Ignacio Bazán Lazcano, Diego Gisbert Llorens, Henning Ludvigsen, Mark Molnar, David Auden Nash, Niten, Hector Ortiz, Shane Pierce, Yos Bayu Pratama, Neil Roberts, Michael Rookard, Martin de Diego Sádaba, Christian Schwager, Stephen Somers, Ray Swanland, Theo Sylinades, Thrung, Eric Tranchefeux, Ben Zweifel, and the Games Workshop Design Studio.</p>
      </details>
    </dialog>
    <dialog id="shared-dialog" aria-labelledby="shared-dialog-title">
      <button class="dialog-close" aria-label="Close shared campaign">×</button>
      <p class="eyebrow">Automatic character synchronization</p>
      <h2 id="shared-dialog-title">Shared Campaign</h2>
      ${cloudIsConfigured() ? savedCampaignConnection() ? `
        <p>This device is connected as <strong>${escapeHtmlAttribute(savedCampaignConnection().displayName)}</strong>.</p>
        <p class="credit-small">Sync status: <strong>${cloudStatus === "connected" ? "online" : cloudStatus === "connecting" ? "connecting" : "offline"}</strong>. Browser recovery copies remain available at all times.</p>
        <label>Campaign ID<input id="connected-campaign-id" value="${escapeHtmlAttribute(savedCampaignConnection().campaignId)}" readonly /></label>
        <div class="dialog-actions">
          <button class="compact-button" id="copy-campaign-id" type="button">Copy Campaign ID</button>
          ${cloudStatus !== "connected" ? `<button class="compact-button" id="retry-campaign" type="button">Retry Sync</button>` : ""}
          <button class="text-button danger-button" id="disconnect-campaign" type="button">Disconnect this device</button>
        </div>` : `
        <div class="shared-campaign-grid">
          <form id="create-campaign-form">
            <h3>Create as Game Master</h3>
            <label>Your display name<input name="displayName" required maxlength="60" autocomplete="nickname" /></label>
            <label>Campaign name<input name="campaignName" required maxlength="100" /></label>
            <label>Private invite code<input name="inviteCode" required minlength="8" autocomplete="new-password" /></label>
            <button class="primary-button" type="submit">Create Shared Campaign</button>
          </form>
          <form id="join-campaign-form">
            <h3>Join as Player</h3>
            <label>Your display name<input name="displayName" required maxlength="60" autocomplete="nickname" /></label>
            <label>Campaign ID<input name="campaignId" required /></label>
            <label>Invite code<input name="inviteCode" required minlength="8" autocomplete="current-password" /></label>
            <button class="primary-button" type="submit">Join Shared Campaign</button>
          </form>
        </div>
        <p class="credit-small">No email or player account is required. The anonymous session is retained by this browser.</p>` : `
        <p>Shared storage is prepared but not configured. Add the Supabase project URL and publishable key to <code>src/supabase-config.js</code>, then reload.</p>`}
      <p id="shared-dialog-status" class="credit-small" role="status" aria-live="polite"></p>
    </dialog>`;

  wireRosterEvents();
  requestAnimationFrame(applyTextScale);
}

function wireRosterEvents() {
  document.querySelector("#text-size")?.addEventListener("input", (event) => {
    textScale = Number(event.target.value) / 100;
    localStorage.setItem("dh2-text-scale", String(textScale));
    document.querySelector("#text-size-value").textContent = `${Math.round(textScale * 100)}%`;
    applyTextScale();
  });
  document.querySelector("#new-character")?.addEventListener("click", () => createRosterCharacter());
  document.querySelector("#open-compendium")?.addEventListener("click", () => {
    appView = "compendium";
    save();
    render();
  });
  document.querySelector("#open-reinforcements")?.addEventListener("click", () => {
    appView = "reinforcements";
    save();
    render();
  });
  const sharedDialog = document.querySelector("#shared-dialog");
  document.querySelector("#shared-archive")?.addEventListener("click", () => sharedDialog?.showModal());
  sharedDialog?.querySelector(".dialog-close")?.addEventListener("click", () => sharedDialog.close());
  sharedDialog?.addEventListener("click", (event) => {
    if (event.target === sharedDialog) sharedDialog.close();
  });
  document.querySelector("#create-campaign-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#shared-dialog-status");
    const values = new FormData(event.currentTarget);
    status.textContent = "Creating the shared campaign…";
    try {
      const result = await withTimeout(createSharedCampaign({
        name: values.get("campaignName"),
        inviteCode: values.get("inviteCode"),
        displayName: values.get("displayName"),
      }), 20000, "The shared service did not respond while creating the campaign.");
      for (const record of characterLibrary) {
        await withTimeout(saveCloudCharacter(record), 12000, "A character could not be synchronized in time.");
      }
      cloudStatus = "connected";
      await initialiseCloudRepository();
      await navigator.clipboard?.writeText(result.connection.campaignId);
      sharedDialog.close();
      renderRoster();
      alert(`Campaign created. Give your players this ID and the private invite code:\n${result.connection.campaignId}`);
    } catch (error) {
      status.textContent = `Could not create the campaign: ${error.message}`;
    }
  });
  document.querySelector("#join-campaign-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#shared-dialog-status");
    const values = new FormData(event.currentTarget);
    status.textContent = "Joining the shared campaign…";
    try {
      await withTimeout(connectToCampaign({
        campaignId: values.get("campaignId"),
        inviteCode: values.get("inviteCode"),
        displayName: values.get("displayName"),
      }), 20000, "The shared service did not respond while joining the campaign.");
      for (const record of characterLibrary) {
        await withTimeout(saveCloudCharacter(record), 12000, "A character could not be synchronized in time.");
      }
      cloudStatus = "connected";
      await initialiseCloudRepository();
      sharedDialog.close();
      renderRoster();
    } catch (error) {
      status.textContent = `Could not join the campaign: ${error.message}`;
    }
  });
  document.querySelector("#copy-campaign-id")?.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(savedCampaignConnection()?.campaignId || "");
    document.querySelector("#shared-dialog-status").textContent = "Campaign ID copied.";
  });
  document.querySelector("#retry-campaign")?.addEventListener("click", async () => {
    const status = document.querySelector("#shared-dialog-status");
    status.textContent = "Contacting the shared campaign…";
    cloudStatus = "connecting";
    await initialiseCloudRepository();
    if (cloudStatus === "connected") {
      sharedDialog.close();
      renderRoster();
    } else {
      status.textContent = "The shared campaign is still unavailable. Your browser copies are safe.";
    }
  });
  document.querySelector("#disconnect-campaign")?.addEventListener("click", () => {
    if (!confirm("Disconnect this browser from the shared campaign? Local character copies will remain.")) return;
    clearCampaignConnection();
    cloudStatus = "disconnected";
    sharedDialog.close();
    renderRoster();
  });
  document.querySelector("#import-character")?.addEventListener("click", () => document.querySelector("#character-file")?.click());
  document.querySelector("#character-file")?.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const imported = payload?.character || payload;
      if (!imported || typeof imported !== "object" || payload?.type === "acolyte" && payload?.system) {
        throw new Error("This is not a builder character file.");
      }
      const importedName = imported.name || file.name.replace(/\.json$/i, "");
      createRosterCharacter({ ...imported, name: importedName }, `Imported from ${file.name}`);
    } catch (error) {
      alert(`The character could not be imported. ${error.message}`);
      event.target.value = "";
    }
  });
  document.querySelectorAll("[data-open-character]").forEach((button) => {
    button.addEventListener("click", () => switchToCharacter(button.dataset.openCharacter));
  });
  document.querySelectorAll("[data-duplicate-character]").forEach((button) => {
    button.addEventListener("click", async () => {
      const source = characterLibrary.find((entry) => entry.id === button.dataset.duplicateCharacter);
      if (!source) return;
      const duplicate = prepareCharacter(source.character);
      duplicate.name = duplicate.name ? `${duplicate.name} — Copy` : "Unnamed Acolyte — Copy";
      createRosterCharacter(duplicate, `Duplicate of ${source.character.name || "Unnamed Acolyte"}`);
    });
  });
  document.querySelectorAll("[data-export-character]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = characterLibrary.find((entry) => entry.id === button.dataset.exportCharacter);
      if (!record) return;
      downloadJson(`${record.character.name || "acolyte"}.dh2-character.json`, {
        format: "dh2-character-builder",
        version: 2,
        exportedAt: new Date().toISOString(),
        character: record.character,
      });
    });
  });
  document.querySelectorAll("[data-delete-character]").forEach((button) => {
    button.addEventListener("click", async () => {
      const record = characterLibrary.find((entry) => entry.id === button.dataset.deleteCharacter);
      if (!record || !confirm(`Delete ${record.character.name || "this unnamed Acolyte"} from this device? Export it first if you may need it later.`)) return;
      characterLibrary = characterLibrary.filter((entry) => entry.id !== record.id);
      if (activeCharacterId === record.id) activeCharacterId = characterLibrary[0]?.id || "";
      localStorage.setItem(libraryStorageKey, JSON.stringify(characterLibrary));
      if (activeCharacterId) {
        localStorage.setItem(activeCharacterStorageKey, activeCharacterId);
        const nextRecord = characterLibrary.find((entry) => entry.id === activeCharacterId);
        if (nextRecord) localStorage.setItem("dh2-character", JSON.stringify(nextRecord.character));
      } else {
        localStorage.removeItem(activeCharacterStorageKey);
        localStorage.removeItem("dh2-character");
      }
      await deleteRepositoryRecord(record.id);
      renderRoster();
    });
  });
  const credits = document.querySelector("#credits-dialog");
  document.querySelector("#credits")?.addEventListener("click", () => credits.showModal());
  credits?.querySelector(".dialog-close")?.addEventListener("click", () => credits.close());
  credits?.addEventListener("click", (event) => {
    if (event.target === credits) credits.close();
  });
}

function actionGroupKey(group = "") {
  return String(group).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
}

function actionTypePresentation(type = "") {
  const value = String(type).toLowerCase();
  if (value.includes("reaction")) return { key: "reaction", short: "React" };
  if (value.includes("extended")) return { key: "extended", short: "Extended" };
  if (value.includes("half") && value.includes("full")) return { key: "variable", short: "Half / Full" };
  if (value.includes("full")) return { key: "full", short: "Full" };
  if (value.includes("half")) return { key: "half", short: "Half" };
  if (value.includes("free")) return { key: "free", short: "Free" };
  if (value.includes("talent") || value.includes("trait") || value.includes("ability")) return { key: "passive", short: "Ability" };
  return { key: "variable", short: "Varies" };
}

function actionTypeGlyph(kind) {
  const common = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  if (kind === "reaction") return `<svg ${common}><path class="glyph-ring" d="M19.7 8.7A8.5 8.5 0 1 0 20 14"/><path class="glyph-strong" d="m16.2 4.8 3.9 3.9-5.3 1.1"/><path class="glyph-fine" d="M7.3 12h9.4M12 7.3v9.4"/><circle class="glyph-core" cx="12" cy="12" r="2.1"/></svg>`;
  if (kind === "extended") return `<svg ${common}><path class="glyph-ring" d="M5 3h14M5 21h14"/><path class="glyph-strong" d="M7 4.5c0 4 5 4.2 5 7.5s-5 3.5-5 7.5M17 4.5c0 4-5 4.2-5 7.5s5 3.5 5 7.5"/><path class="glyph-fine" d="M9.2 8.2h5.6M9 17h6"/></svg>`;
  if (kind === "full") return `<svg ${common}><circle class="glyph-ring" cx="12" cy="12" r="8.5"/><path class="glyph-strong" d="m12 5 5 7-5 7-5-7z"/><path class="glyph-fine" d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`;
  if (kind === "half") return `<svg ${common}><circle class="glyph-ring" cx="12" cy="12" r="8.5"/><path class="glyph-fill" d="M12 3.5a8.5 8.5 0 0 0 0 17z"/><path class="glyph-strong" d="M12 6v12"/><path class="glyph-fine" d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`;
  if (kind === "free") return `<svg ${common}><path class="glyph-ring" d="M18.5 7.2A8.5 8.5 0 1 0 19.7 15"/><path class="glyph-strong" d="m13 3-5 9h4l-1 9 6-11h-4z"/></svg>`;
  if (kind === "passive") return `<svg ${common}><path class="glyph-ring" d="m12 2.8 7.5 4.4v9.6L12 21.2l-7.5-4.4V7.2z"/><path class="glyph-strong" d="m12 6 3.8 6-3.8 6-3.8-6z"/><circle class="glyph-core" cx="12" cy="12" r="1.7"/></svg>`;
  return `<svg ${common}><circle class="glyph-ring" cx="12" cy="12" r="8.5"/><path class="glyph-strong" d="M7 8.2 12 12l-5 3.8M17 8.2 12 12l5 3.8"/><circle class="glyph-core" cx="12" cy="12" r="1.8"/></svg>`;
}

function actionGroupGlyph(group) {
  const key = actionGroupKey(group);
  const common = 'viewBox="0 0 16 16" aria-hidden="true" focusable="false"';
  if (key === "attacks") return `<svg ${common}><circle cx="8" cy="8" r="5"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/><circle class="group-core" cx="8" cy="8" r="1.3"/></svg>`;
  if (key === "movement") return `<svg ${common}><path d="M2 11.5h7.5M7.5 8l3.5 3.5L7.5 15M5 5h7M9.5 1.5 13 5 9.5 8.5"/></svg>`;
  if (key === "reactions") return `<svg ${common}><path d="M12.7 6.2A5.4 5.4 0 1 0 13 10"/><path d="m10.3 3.5 3 2.7-3.8.8"/></svg>`;
  if (key === "psychic") return `<svg ${common}><path d="M8 1.2 9.7 6 14.8 8l-5.1 2L8 14.8 6.3 10 1.2 8l5.1-2z"/><circle class="group-core" cx="8" cy="8" r="1.4"/></svg>`;
  if (key === "skills") return `<svg ${common}><path d="M3 8.3 6.4 12 13 4"/><path d="M2 2h12v12H2z"/></svg>`;
  if (key === "utility") return `<svg ${common}><path d="M10.5 2.2a3.5 3.5 0 0 0-3.9 4.9L2 11.7 4.3 14l4.6-4.6a3.5 3.5 0 0 0 4.9-3.9l-2.2 2.2-2.3-.9-.9-2.3z"/></svg>`;
  if (key === "tactical") return `<svg ${common}><path d="m2 11 6-8 6 8-6 3z"/><path d="M8 3v11M4.8 7.3h6.4"/></svg>`;
  if (key === "abilities") return `<svg ${common}><path d="m8 1.5 5.5 3.2v6.6L8 14.5l-5.5-3.2V4.7z"/><path d="M5.5 8h5M8 5.5v5"/></svg>`;
  if (key === "fate") return `<svg ${common}><path d="M8 1.5 12.8 4v5.3L8 14.5 3.2 9.3V4z"/><path d="M8 4.2v7.6M5.8 6.1h4.4M6.5 9.8h3"/><circle class="group-core" cx="8" cy="8" r="1.1"/></svg>`;
  return `<svg ${common}><circle cx="8" cy="8" r="5.5"/><circle class="group-core" cx="8" cy="8" r="1.3"/></svg>`;
}

// The action index is deliberately organised around the way a player looks
// for an option at the table: first the universal actions, then options added
// by the character's loadout and choices. The underlying records still retain
// their rules group for filtering and export.
const actionSectionDefinitions = [
  { key: "basic-attacks", title: "Basic Attacks", glyph: "Attacks", source: "Core combat actions", order: 10 },
  { key: "basic-movement", title: "Basic Movement", glyph: "Movement", source: "Core movement actions", order: 20 },
  { key: "basic-reactions", title: "Reactions", glyph: "Reactions", source: "Core reaction actions", order: 30 },
  { key: "basic-tactics", title: "Basic Tactics", glyph: "Tactical", source: "Core tactical actions", order: 40 },
  { key: "basic-utility", title: "Basic Utility", glyph: "Utility", source: "Core utility actions", order: 50 },
  { key: "weapon-actions", title: "Weapon Actions", glyph: "Attacks", source: "From current weapon loadout", order: 60 },
  { key: "skill-tests", title: "Skill Tests", glyph: "Skills", source: "From trained skills and characteristics", order: 70 },
  { key: "psychic-powers", title: "Psychic Powers", glyph: "Psychic", source: "Known powers and Focus Power actions", order: 80 },
  { key: "features-fate", title: "Talents, Traits & Fate", glyph: "Abilities", source: "From this Acolyte's choices and Fate points", order: 90 },
  { key: "owned-equipment", title: "Owned Equipment", glyph: "Utility", source: "Actions provided by carried equipment", order: 100 },
  { key: "other-actions", title: "Other Actions", glyph: "Abilities", source: "Additional character options", order: 110 },
];

function actionSectionPresentation(action = {}) {
  const id = String(action.id || "").toLowerCase();
  if (id.startsWith("weapon-") && !id.startsWith("weapon-unarmed-")) return actionSectionDefinitions[5];
  if (id.startsWith("psychic-")) return actionSectionDefinitions[7];
  if (id.startsWith("skill-") || id.startsWith("characteristic-test-")) return actionSectionDefinitions[6];
  if (id.startsWith("gear-")) return actionSectionDefinitions[9];
  if (id.startsWith("fate-") || id.startsWith("talent-") || id.startsWith("trait-") || id.startsWith("ability-")) return actionSectionDefinitions[8];
  if (action.group === "Attacks") return actionSectionDefinitions[0];
  if (action.group === "Movement") return actionSectionDefinitions[1];
  if (action.group === "Reactions") return actionSectionDefinitions[2];
  if (action.group === "Tactical") return actionSectionDefinitions[3];
  if (action.group === "Utility") return actionSectionDefinitions[4];
  if (action.group === "Skills") return actionSectionDefinitions[6];
  if (action.group === "Psychic") return actionSectionDefinitions[7];
  if (action.group === "Abilities") return actionSectionDefinitions[8];
  return actionSectionDefinitions[10];
}

function renderActionIndex(actions) {
  if (!actionGroups.includes(actionIndexState.group)) actionIndexState.group = "All";
  const query = actionIndexState.query.trim().toLowerCase();
  const initiallyVisible = (action) => (
    (actionIndexState.group === "All" || action.group === actionIndexState.group)
    && (!actionIndexState.fateOnly || action.usesFate)
    && (action.available || actionIndexState.showUnavailable)
    && (!query || [action.name, action.group, action.type, action.summary, action.context, action.usesFate ? "Fate" : "", ...(action.subtypes || [])].join(" ").toLowerCase().includes(query))
  );
  const initialVisibleCount = actions.filter(initiallyVisible).length;
  const availableCount = actions.filter((action) => action.available).length;
  const unavailableCount = actions.length - availableCount;
  const carriedWeaponActions = actions.filter((action) => /carried but not readied/i.test(action.unavailableReason || "")).length;
  currentActionRecords.clear();
  actions.forEach((action) => currentActionRecords.set(action.id, action));
  const renderActionCard = (action) => {
    const search = [action.name, action.group, action.type, action.summary, action.context, action.usesFate ? "Fate" : "", ...(action.subtypes || [])].join(" ").toLowerCase();
    const initiallyHidden = !initiallyVisible(action);
    const preview = action.test ? resolvedActionTest(action.test) : null;
    const typePresentation = actionTypePresentation(action.type);
    const groupKey = actionGroupKey(action.group);
    return `<article class="action-card action-group-${groupKey} action-type-${typePresentation.key} ${action.usesFate ? "uses-fate" : ""} ${action.available ? "available" : "unavailable"}" data-action-card data-action-id="${escapeHtmlAttribute(action.id)}" data-action-group-value="${escapeHtmlAttribute(action.group)}" data-action-search="${escapeHtmlAttribute(search)}" data-action-available="${action.available}" data-action-uses-fate="${Boolean(action.usesFate)}" ${initiallyHidden ? "hidden" : ""}>
        <header>
          <div class="action-identity">
            <span class="action-group-tag">${actionGroupGlyph(action.group)}<span>${escapeHtmlAttribute(action.group)}</span>${action.usesFate ? `<em class="action-fate-tag">${actionGroupGlyph("Fate")} Fate</em>` : ""}</span>
            <h4>${escapeHtmlAttribute(action.name)}</h4>
          </div>
          <span class="action-type-badge" role="img" aria-label="Action type: ${escapeHtmlAttribute(action.type)}" title="${escapeHtmlAttribute(action.type)}">${actionTypeGlyph(typePresentation.key)}<span class="action-type-caption">${escapeHtmlAttribute(typePresentation.short)}</span></span>
        </header>
        <p>${escapeHtmlAttribute(action.summary)}</p>
        <div class="action-context">${escapeHtmlAttribute(action.available ? action.context || "Available now" : action.unavailableReason || "Requirements are not met.")}</div>
        ${preview ? `<div class="action-test-preview"><span>${escapeHtmlAttribute(action.test.characteristicName)}</span><strong>Target ${preview.target}</strong>${preview.actionModifier ? `<em>${preview.actionModifier > 0 ? "+" : ""}${preview.actionModifier} action modifier</em>` : ""}</div>` : ""}
        <footer><small>${escapeHtmlAttribute(action.source || actionSource)}</small><button class="compact-button" type="button" data-open-action="${escapeHtmlAttribute(action.id)}" ${action.available ? "" : "disabled"}>${action.test ? "Roll Test" : "Details"}</button></footer>
      </article>`;
  };
  const actionSectionsMarkup = actionSectionDefinitions.map((definition) => {
    const sectionActions = actions.filter((action) => actionSectionPresentation(action).key === definition.key);
    if (!sectionActions.length) return "";
    const sectionInitiallyVisible = sectionActions.some(initiallyVisible);
    return `<section class="action-group-section" data-action-section="${definition.key}" aria-labelledby="action-section-${definition.key}" ${sectionInitiallyVisible ? "" : "hidden"}>
      <header class="action-section-heading">
        <div><span class="action-section-icon">${actionGroupGlyph(definition.glyph)}</span><h4 id="action-section-${definition.key}">${definition.title}</h4></div>
        <span>${definition.source}</span>
      </header>
      <div class="action-card-grid">${sectionActions.map(renderActionCard).join("")}</div>
    </section>`;
  }).join("");
  return `<section class="review-actions-index" aria-labelledby="current-actions-title">
    <div class="review-section-heading action-index-heading">
      <div>
        <h3 id="current-actions-title">Current Actions and Abilities</h3>
        <p>Derived from this Acolyte's characteristics, training, readied weapons, inventory, psychic powers, and special rules.</p>
      </div>
      <div class="action-index-counts" aria-label="Action availability"><strong>${availableCount}</strong><span>available</span>${unavailableCount ? `<em>${unavailableCount} conditional</em>` : ""}</div>
    </div>
    <div class="action-index-controls">
      <label class="action-search"><span>Search actions</span><input id="action-search" type="search" value="${escapeHtmlAttribute(actionIndexState.query)}" placeholder="Attack, Dodge, Tech-Use…" autocomplete="off" /></label>
      <div class="action-filter-list" role="group" aria-label="Filter actions">${actionGroups.map((group) => `<button class="compact-button ${actionIndexState.group === group ? "active" : ""}" type="button" data-action-group="${group}" aria-pressed="${actionIndexState.group === group}">${actionGroupGlyph(group)}<span>${group}</span></button>`).join("")}<button class="compact-button fate-action-filter ${actionIndexState.fateOnly ? "active" : ""}" type="button" data-action-fate-only aria-pressed="${actionIndexState.fateOnly}">${actionGroupGlyph("Fate")}<span>Fate</span></button></div>
      <label class="show-unavailable"><input id="show-unavailable-actions" type="checkbox" ${actionIndexState.showUnavailable ? "checked" : ""} /><span>Show unavailable options</span></label>
    </div>
    ${carriedWeaponActions ? `<p class="action-index-notice">Owned weapons do not add attack buttons until they are marked <strong>Readied</strong> in Inventory. Conditional attack modes remain available through “Show unavailable options.”</p>` : ""}
    <div class="action-section-list" id="action-card-grid">${actionSectionsMarkup}</div>
    <p class="action-empty" id="action-empty" ${initialVisibleCount ? "hidden" : ""}>No available actions match these filters. Change the filter or show unavailable options to inspect unmet requirements.</p>
  </section>`;
}

function creationConsequenceWarnings() {
  const warnings = [];
  const divination = currentDivination();
  if (divination?.talentGrant?.choice && !character.divination.resolutions?.talentSpeciality) warnings.push(`The Divination's ${divination.talentGrant.label} speciality has not been chosen.`);
  if (divination?.disorderGrant === "phobia" && !character.divination.resolutions?.disorderId) warnings.push("The Divination's Phobia has not been chosen.");
  if (divination?.malignancyRoll) {
    const malignancy = selectedMalignancyRecord("divination");
    if (!malignancy) warnings.push("The Divination's Malignancy roll has not been resolved.");
    else if (malignancy.characteristicRoll && !character.divination.resolutions?.malignancyMagnitude) warnings.push(`${malignancy.name}'s characteristic reduction has not been rolled.`);
  }
  if (character.homeWorld === "daemon-world" && !character.exceptional?.daemonWorldCorruption) warnings.push("Daemon World starting Corruption has not been rolled or entered.");
  if (character.background === "mutant") {
    const mutation = selectedMutationRecord();
    if (!character.exceptional?.mutantTraitId) warnings.push("The Mutant starting trait has not been chosen.");
    if (!mutation) warnings.push("The Mutant's 5d10 Mutation roll has not been resolved.");
    else if (mutation.characteristicRoll && !character.exceptional?.mutationMagnitude) warnings.push(`${mutation.name}'s characteristic reduction has not been rolled.`);
  }
  if (character.background === "exorcised") {
    const malignancy = selectedMalignancyRecord("starting");
    if (!malignancy) warnings.push("The Exorcised starting Malignancy has not been chosen.");
    else if (malignancy.characteristicRoll && !character.exceptional?.startingMalignancyMagnitude) warnings.push(`${malignancy.name}'s characteristic reduction has not been rolled.`);
  }
  return warnings;
}

function renderReview() {
  sheetDetailRecords.clear();
  sheetDetailCounter = 0;
  const spent = xpSpent();
  const missingCharacteristics = characteristics.filter((entry) => !character.rolls[entry.id]?.value);
  const unresolvedAptitudes = resolvedAptitudes().duplicateCount - character.aptitudeReplacements.filter(Boolean).length;
  const unresolvedDivinationChoices = (currentDivination()?.statChanges || [])
    .filter((change) => !change.target && !character.divination.statChoices?.[change.id]);
  const unresolvedGrantChoices = grantAlternatives().filter((choice) => !character.grantChoices[choice.id]);
  const divinationModifiers = divinationCharacteristicModifiers();
  const ownedSkills = ownedSkillRecords();
  const initialTalents = Object.values(resolvedGrantedTalents());
  const purchasedTalents = paidTalentAdvanceEntries().map((entry) => talentCatalogue.find((talent) => talent.id === entry.id)).filter(Boolean);
  const inventoryItems = character.equipment.inventory.map((id) => armoury.find((item) => item.id === id)).filter(Boolean);
  const ownedWeapons = inventoryItems.filter((item) => item.category === "Weapons");
  const psychicPowers = character.advances.psychicPowers.map((entry) => psychicPowerById(entry.id) || entry).filter((entry) => entry?.name);
  const eliteAdvances = activeEliteAdvances();
  const equipmentState = equipmentRulesState(inventoryItems);
  const currentActions = derivedCharacterActions(inventoryItems);
  const grantedEquipment = resolvedGrantedEquipment();
  const unlinkedGrantedEquipment = character.equipment.unlinkedCharacterCreationGrants || [];
  const xpLedger = [
    ...characteristics.filter((entry) => Number(character.advances.characteristics[entry.id] || 0) > 0).map((entry) => [`${entry.name} +${Number(character.advances.characteristics[entry.id]) * 5}`, characteristicXpCost(entry.id)]),
    ...ownedSkills.filter((record) => skillXpCost(record.skill.id, record.speciality) > 0).map((record) => [`${record.displayName} · ${rankNames[record.rank - 1]}`, skillXpCost(record.skill.id, record.speciality)]),
    ...purchasedTalents.map((talent) => [talent.name, talentCost(talent)]),
    ...character.advances.psychicPowers.filter((entry) => entry?.name).map((entry) => [entry.name, Number(entry.cost || 0)]),
    ...(psyRatingXpCost() ? [[`Psy Rating ${foundryPsyRating()}`, psyRatingXpCost()]] : []),
    ...character.advances.eliteAdvances.filter((entry) => entry?.name).map((entry) => [entry.name, Number(entry.cost || 0)]),
  ];
  const xpAvailable = character.xp.starting - spent;
  const xpAwards = [...(character.xp.awards || [])].reverse();
  const xpAwardedTotal = (character.xp.awards || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const initialXp = Math.max(0, character.xp.starting - xpAwardedTotal);
  const agilityBonus = characteristicBonus("agility");
  const toughnessBonus = characteristicBonus("toughness");
  const willpowerBonus = characteristicBonus("willpower");
  const abilityEntries = [
    ["Home World", ruleValue(character.homeWorld, "Home World Bonus")],
    ["Background", ruleValue(character.background, "Background Bonus")],
    ["Role", ruleValue(character.role, "Role Bonus")],
  ].filter(([, value]) => value);
  const parsedAbilityEntries = abilityEntries.map(parseSpecialAbility);
  const warnings = [
    missingCharacteristics.length ? `${missingCharacteristics.length} characteristics have no result.` : "",
    !character.fate.roll ? "Fate roll has not been recorded." : "",
    !character.wounds.total && !character.wounds.dice?.length ? "Wounds have not been recorded." : "",
    !character.divination.roll ? "Divination has not been rolled or entered." : "",
    unresolvedDivinationChoices.length ? `${unresolvedDivinationChoices.length} Divination characteristic choice${unresolvedDivinationChoices.length === 1 ? "" : "s"} remain.` : "",
    unresolvedGrantChoices.length ? `${unresolvedGrantChoices.length} granted alternative${unresolvedGrantChoices.length === 1 ? "" : "s"} remain.` : "",
    unresolvedAptitudes > 0 ? `${unresolvedAptitudes} duplicate aptitude replacements remain.` : "",
    spent > character.xp.starting ? `XP is overspent by ${spent - character.xp.starting}.` : "",
    hasEliteAdvance("psyker") && character.background !== "astra-telepathica" && character.eliteSetup.psykerCorruption === null ? "The rogue psyker's 1d10+3 starting Corruption has not been recorded." : "",
    hasEliteAdvance("inquisitor") && !character.eliteSetup.inquisitorLore ? "The Inquisitor's granted Forbidden Lore speciality has not been chosen." : "",
    hasEliteAdvance("sister-of-battle") && !character.eliteSetup.sisterWeapon ? "The Sister of Battle's granted weapon has not been chosen." : "",
    ...creationConsequenceWarnings(),
    ...psychicPowers.filter((power) => psychicPowerStatus(power).missing.length).map((power) => `${power.name} no longer meets: ${psychicPowerStatus(power).missing.join(", ")}.`),
    ...equipmentState.warnings.filter((entry) => entry.level === "warning").map((entry) => entry.message),
  ].filter(Boolean);
  const homeWorldName = catalogs.homeWorlds.find((entry) => entry.id === character.homeWorld)?.name || "Home World pending";
  const backgroundName = catalogs.backgrounds.find((entry) => entry.id === character.background)?.name || "Background pending";
  const roleName = catalogs.roles.find((entry) => entry.id === character.role)?.name || "Role pending";
  const identityRows = `<div class="dossier-list">
    <div><strong>Player</strong><span>${character.player || "Not recorded"}</span></div>
    <div><strong>Presentation</strong><span>${character.presentation || "Not recorded"}</span></div>
    <div><strong>Appearance</strong><span>${character.appearance || "Not recorded"}</span></div>
    <div><strong>Home World</strong><span>${homeWorldName}</span></div>
    <div><strong>Background</strong><span>${backgroundName}</span></div>
    <div><strong>Role</strong><span>${roleName}</span></div>
  </div>`;
  const identitySummaryRows = `<div class="dossier-list">
    <div><strong>Home World</strong><span>${homeWorldName}</span></div>
    <div><strong>Background</strong><span>${backgroundName}</span></div>
    <div><strong>Role</strong><span>${roleName}</span></div>
  </div>`;
  const historyLabels = {
    desire: "Desire", hatred: "Hatred", sacrifice: "Sacrifice", meeting: "Meeting the Inquisitor",
    inquisitorMeaning: "Meaning of the Inquisitor", warbandBond: "Warband bond", base: "Base of operations",
  };
  const personalHistoryRows = `<div class="dossier-list">${Object.entries(historyLabels).map(([id, label]) => character.history?.[id]
    ? `<div><strong>${label}</strong><span>${escapeHtmlAttribute(character.history[id])}</span></div>`
    : "").join("") || "<p>No personal-history prompts recorded.</p>"}</div>`;
  const aptitudeTags = `<div class="tag-list final">${resolvedAptitudes().aptitudes.map((aptitude) => `<span>${aptitude}</span>`).join("")}</div>`;
  const skillRows = `<div class="dossier-list review-skills-list">${ownedSkills.map((record) => {
    const { skill, grant, displayName, speciality, rank } = record;
    const rule = ruleTermsById[`skill-${skill.id}`];
    const tooltip = rule ? `${rule.category}: ${rule.summary} Source: ${rule.book}, page ${rule.page}.` : "";
    const label = rule
      ? `<button type="button" class="review-skill-label rule-term lore-term lore-term-skill" data-rule-term="${rule.id}" data-tooltip="${escapeHtmlAttribute(tooltip)}" aria-label="${escapeHtmlAttribute(`${displayName}. ${tooltip}`)}">${escapeHtmlAttribute(displayName)}</button>`
      : `<strong>${escapeHtmlAttribute(displayName)}</strong>`;
    return `<div>${label}<span>${rankNames[rank - 1]} · ${skill.characteristic} target ${skillTestTarget(skill, speciality)}</span><em>${grant ? `Initial · ${grant.source}` : `${skillXpCost(skill.id, speciality)} XP`}</em></div>`;
  }).join("") || "<p>None recorded.</p>"}</div>`;
  const talentRows = [
    ...initialTalents.map((talent) => renderSheetEntry({
      kind: "Talent",
      name: talent.displayName,
      summary: talent.benefit,
      meta: `Initial · ${talent.source}`,
      source: talent.ruleSource || talent.source,
      rows: [["Tier", talent.tier], ["Aptitudes", talent.aptitudes?.join(", ")], ["Prerequisites", talent.prerequisites || "None"]],
    })),
    ...purchasedTalents.map((talent) => renderSheetEntry({
      kind: "Talent",
      name: talent.name,
      summary: talent.benefit,
      meta: `${talentCost(talent)} XP`,
      source: talent.source,
      rows: [["Tier", talent.tier], ["Aptitudes", talent.aptitudes?.join(", ")], ["Prerequisites", talent.prerequisites || "None"]],
    })),
  ].join("") || "<p>None recorded.</p>";
  const abilityRows = [
    ...[...automaticTraits(), ...equipmentGrantedTraits()].map((trait) => renderSheetEntry({
      kind: trait.conditional ? "Equipment Trait" : "Trait",
      name: trait.name,
      summary: trait.summary,
      meta: trait.conditional ? "Equipment Trait" : "Automatic Trait",
      source: trait.source,
    })),
    ...parsedAbilityEntries.map((ability) => renderSheetEntry({
      kind: "Special Ability",
      name: ability.name,
      summary: ability.benefit,
      meta: ability.source,
      source: ability.source,
    })),
  ].join("") || "<p>None recorded.</p>";
  const psychicRows = psychicPowers.map((power) => renderSheetEntry({
    kind: "Psychic Power",
    name: power.name,
    summary: power.summary || power.description || "Psychic power selected during advancement.",
    meta: `${Number(power.cost || 0)} XP`,
    source: power.page ? `${power.source}, p. ${power.page}` : power.source || "Character advancement",
    rows: [["Discipline", power.discipline], ["Psy Rating", foundryPsyRating()], ["Action", power.action], ["Focus Power", power.focus], ["Range", power.range], ["Sustained", power.sustained], ["Subtype", power.subtype], ["XP Cost", Number(power.cost || 0)]],
  })).join("") || "<p>No psychic powers recorded.</p>";
  const eliteRows = eliteAdvances.map((entry) => renderSheetEntry({
    kind: "Elite Advance",
    name: entry.name,
    summary: entry.summary,
    meta: entry.automatic ? "Automatic · 0 XP" : `${entry.cost} XP`,
    source: entry.ruleSource || `${entry.source}, p. ${entry.page}`,
    rows: [["Instant changes", entry.instantChanges?.join(" · ")], ["Guidance", entry.notes]],
  })).join("") || "<p>No elite advance recorded.</p>";
  const inventoryRows = [
    ...inventoryItems.map((item) => renderInventorySheetEntry(item, equipmentProvenance(item.id, grantedEquipment), ownedWeapons)),
    ...unlinkedGrantedEquipment.map((entry) => renderSheetEntry({
      kind: "Starting Equipment",
      name: entry.label,
      summary: "This starting item is recorded, but its Armoury profile has not yet been linked.",
      meta: entry.sourceType === "background-choice" ? `Chosen from ${entry.sourceName}` : `Granted by ${entry.sourceName}`,
      source: entry.sourceName,
    })),
  ].join("") || "<p>No inventory recorded.</p>";
  const hasPsychicWorkspace = hasPsykerAccess() || psychicPowers.length > 0;
  const reviewTabs = [
    ["actions", "Actions"],
    ["skills", "Skills"],
    ...(hasPsychicWorkspace ? [["psychic", "Psychic"]] : []),
    ["inventory", "Inventory"],
    ["features", "Features & Traits"],
    ["background", "Background"],
    ["advancement", "Advancement"],
  ];
  if (!reviewTabs.some(([id]) => id === reviewTabState)) reviewTabState = "actions";
  return `
    <div class="management-shell review-layout">
      <section class="review-dossier">
        <header class="review-profile-heading">
          <div><h2>${character.name || "Unnamed Acolyte"}</h2><p class="review-profile-details">${homeWorldName} · ${backgroundName} · ${roleName}</p></div>
          <span class="review-record-state">${warnings.length ? `${warnings.length} item${warnings.length === 1 ? "" : "s"} to review` : "Ready to play"}</span>
        </header>
        <div class="review-characteristics">${characteristics.map((entry) => {
          const breakdown = characteristicBreakdown(entry.id);
          const characteristicRuleId = `characteristic-${entry.id.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
          const rule = ruleTermsById[characteristicRuleId];
          const tooltip = rule ? `${rule.term}: ${rule.summary}` : entry.name;
          const parts = [
            breakdown.generated ? `Generated ${breakdown.generated}` : "",
            breakdown.advancement ? `Advances +${breakdown.advancement}` : "",
            breakdown.divination ? `Divination ${breakdown.divination > 0 ? "+" : ""}${breakdown.divination}` : "",
            breakdown.exceptional ? `Mutation/Malignancy ${breakdown.exceptional > 0 ? "+" : ""}${breakdown.exceptional}` : "",
            breakdown.elite ? `Elite Advance ${breakdown.elite > 0 ? "+" : ""}${breakdown.elite}` : "",
          ].filter(Boolean);
          return `<div class="${breakdown.divination || breakdown.exceptional || breakdown.elite ? "modified" : ""}" title="${escapeHtmlAttribute(parts.join(" · "))}">
            <button type="button" class="review-characteristic-label rule-term lore-term lore-term-stat" data-rule-term="${characteristicRuleId}" data-tooltip="${escapeHtmlAttribute(tooltip)}" aria-label="${escapeHtmlAttribute(`${entry.name}. ${tooltip}`)}">${entry.abbreviation}</button>
            <strong>${breakdown.total || "—"}</strong>${parts.length > 1 ? `<small>${escapeHtmlAttribute(parts.slice(1).join(" · "))}</small>` : ""}
          </div>`;
        }).join("")}</div>
        ${Object.keys(divinationModifiers).length || Object.keys(exceptionalCharacteristicModifiers()).length || currentDivination()?.fateChange || character.exceptional?.creationCorruptionApplied ? `<div class="calculation-note"><strong>Creation effects applied:</strong> ${[
          ...Object.entries(divinationModifiers).map(([id, amount]) => `${characteristics.find((entry) => entry.id === id)?.name || id} ${amount > 0 ? "+" : ""}${amount}`),
          ...Object.entries(exceptionalCharacteristicModifiers()).map(([id, amount]) => `${characteristics.find((entry) => entry.id === id)?.name || id} ${amount > 0 ? "+" : ""}${amount}`),
          currentDivination()?.fateChange ? `Fate Threshold +${currentDivination().fateChange}` : "",
          character.exceptional?.creationCorruptionApplied ? `Starting Corruption +${character.exceptional.creationCorruptionApplied}` : "",
        ].filter(Boolean).join(" · ")}</div>` : ""}
        <div class="review-vitals-strip">
          ${renderReviewWounds()}
          ${renderReviewArmour(equipmentState.wornArmour)}
          ${renderReviewFate()}
        </div>
        <section class="review-status-strip" aria-label="Movement and character resources">
          <article class="review-status-card">
            <span>Fatigue Threshold</span>
            <strong>${toughnessBonus + willpowerBonus}</strong>
            <small>TB ${toughnessBonus} + WPB ${willpowerBonus}</small>
          </article>
          <article class="review-status-card review-movement-card">
            <span>Movement · metres</span>
            <div><b>${agilityBonus}<small>Half</small></b><b>${agilityBonus * 2}<small>Full</small></b><b>${agilityBonus * 3}<small>Charge</small></b><b>${agilityBonus * 6}<small>Run</small></b></div>
          </article>
          <button class="review-status-card review-xp-card" type="button" data-open-advancement-tab>
            <span>Available XP</span>
            <strong>${xpAvailable}</strong>
            <small>${spent} spent · ${character.xp.starting} earned</small>
          </button>
          ${hasPsykerAccess() ? `<article class="review-status-card"><span>Psy Rating</span><strong>${foundryPsyRating()}</strong><small>Current rating</small></article>` : ""}
          ${Number(character.conditions.insanity || 0) ? `<article class="review-status-card status-warning"><span>Insanity</span><strong>${Number(character.conditions.insanity)}</strong><small>Current points</small></article>` : ""}
          ${Number(character.conditions.corruption || 0) ? `<article class="review-status-card status-warning"><span>Corruption</span><strong>${Number(character.conditions.corruption)}</strong><small>Current points</small></article>` : ""}
        </section>
        <div class="review-sheet-body">
          <aside class="review-summary-rail" aria-label="Character summary">
            <section class="review-summary-card"><div class="review-summary-card-body">${identitySummaryRows}</div><h3>Identity</h3></section>
            <section class="review-summary-card review-summary-skills"><div class="review-summary-card-body">${skillRows}</div><h3>Skills</h3></section>
          </aside>
          <section class="review-workspace" aria-label="Character details">
            <nav class="review-workspace-tabs" role="tablist" aria-label="Character sheet sections">
              ${reviewTabs.map(([id, label]) => `<button type="button" role="tab" id="review-tab-${id}" aria-controls="review-panel-${id}" aria-selected="${reviewTabState === id}" tabindex="${reviewTabState === id ? "0" : "-1"}" class="${reviewTabState === id ? "active" : ""}" data-review-tab="${id}">${label}</button>`).join("")}
            </nav>
            <label class="review-tab-select"><span>Character sheet section</span><select id="review-tab-select">${reviewTabs.map(([id, label]) => `<option value="${id}" ${reviewTabState === id ? "selected" : ""}>${label}</option>`).join("")}</select></label>
            <div class="review-tab-panels review-sections">
              <div class="review-tab-panel" id="review-panel-actions" role="tabpanel" aria-labelledby="review-tab-actions" data-review-panel="actions" ${reviewTabState === "actions" ? "" : "hidden"}>${renderActionIndex(currentActions)}</div>
              <div class="review-tab-panel" id="review-panel-skills" role="tabpanel" aria-labelledby="review-tab-skills" data-review-panel="skills" ${reviewTabState === "skills" ? "" : "hidden"}><section class="review-skills-section"><h3>Skills</h3>${skillRows}</section></div>
              ${hasPsychicWorkspace ? `<div class="review-tab-panel" id="review-panel-psychic" role="tabpanel" aria-labelledby="review-tab-psychic" data-review-panel="psychic" ${reviewTabState === "psychic" ? "" : "hidden"}><section><div class="review-section-heading"><div><h3>Psychic Powers</h3><p>Psy Rating ${foundryPsyRating()} · powers and Warp-active abilities available to this Acolyte.</p></div></div><div class="dossier-list">${psychicRows}</div></section></div>` : ""}
              <div class="review-tab-panel" id="review-panel-inventory" role="tabpanel" aria-labelledby="review-tab-inventory" data-review-panel="inventory" ${reviewTabState === "inventory" ? "" : "hidden"}><section class="review-inventory-section">
                <div class="review-section-heading"><div><h3>Inventory</h3><p>All owned weapons, armour, modifications, and carried gear. Change an item's current state here at any time.</p></div><div class="inventory-totals" aria-label="Inventory totals"><span>${inventoryItems.length + unlinkedGrantedEquipment.length} items</span><strong>${equipmentState.carryingStatsRecorded ? `${equipmentState.knownWeight.toFixed(1)} / ${equipmentState.carryingCapacity} kg` : `${equipmentState.knownWeight.toFixed(1)} kg`}</strong></div></div>
                <div class="inventory-column-labels" aria-hidden="true"><span>Item</span><span>Rules summary</span><span>Current state</span></div><div class="dossier-list inventory-list">${inventoryRows}</div>
              </section></div>
              <div class="review-tab-panel" id="review-panel-features" role="tabpanel" aria-labelledby="review-tab-features" data-review-panel="features" ${reviewTabState === "features" ? "" : "hidden"}>
                <div class="review-feature-grid"><section class="review-aptitudes-section"><h3>Aptitudes</h3>${aptitudeTags}</section><section class="review-talents-section"><h3>Talents</h3><div class="dossier-list">${talentRows}</div></section><section class="review-abilities-section"><h3>Traits and Special Abilities</h3><div class="dossier-list">${abilityRows}</div></section>${eliteAdvances.length ? `<section class="review-elites-section"><h3>Elite Advances</h3><div class="dossier-list">${eliteRows}</div></section>` : ""}</div>
              </div>
              <div class="review-tab-panel" id="review-panel-background" role="tabpanel" aria-labelledby="review-tab-background" data-review-panel="background" ${reviewTabState === "background" ? "" : "hidden"}><div class="review-background-grid"><section><h3>Identity and Origin</h3>${identityRows}</section><section><h3>Personal History</h3>${personalHistoryRows}</section><section><h3>Divination</h3><div class="dossier-list">${renderSheetEntry({ kind: "Divination", name: currentDivination()?.title || "Not recorded", summary: currentDivination()?.effect || "No effect recorded.", meta: character.divination.roll ? `Roll ${character.divination.roll}` : "", source: currentDivination()?.source || "Core Rulebook — Divinations" })}</div></section></div></div>
              <div class="review-tab-panel" id="review-panel-advancement" role="tabpanel" aria-labelledby="review-tab-advancement" data-review-panel="advancement" ${reviewTabState === "advancement" ? "" : "hidden"}><section class="review-advancement-section">
                <div class="review-section-heading"><div><h3>Advancement</h3><p>Award experience, review purchases, or return to the rules-aware advancement and equipment tools.</p></div></div>
                <div class="advancement-balance" aria-label="Experience totals">
                  <div><span>Total earned</span><strong>${character.xp.starting} XP</strong></div>
                  <div><span>Spent</span><strong>${spent} XP</strong></div>
                  <div class="${xpAvailable < 0 ? "overspent" : "available"}"><span>Available</span><strong>${xpAvailable} XP</strong></div>
                </div>
                <div class="advancement-manager">
                  <form class="xp-award-form" id="xp-award-form">
                    <div><h4>Award XP</h4><p>Add experience granted by the GM. The new total is saved immediately.</p></div>
                    <label><span>Amount</span><input id="xp-award-amount" name="amount" type="number" min="1" step="50" inputmode="numeric" placeholder="100" required /></label>
                    <label class="xp-award-note"><span>Reason · optional</span><input id="xp-award-note" name="note" type="text" maxlength="80" placeholder="Investigation completed" /></label>
                    <button class="primary-button" type="submit">Add XP <span>›</span></button>
                  </form>
                  <div class="advancement-manager-actions">
                    <button class="compact-button" type="button" data-manage-advances><strong>Purchase Advances</strong><span>Characteristics, skills, talents, psychic powers, and eligible elite advances.</span></button>
                    <button class="compact-button" type="button" data-manage-inventory><strong>Manage Inventory</strong><span>Acquire, equip, ready, wear, or carry items through the existing Armoury.</span></button>
                  </div>
                </div>
                <div class="advancement-ledgers">
                  <div><h4>XP Purchases</h4><div class="xp-ledger">${xpLedger.map(([name, cost]) => `<div><span>${name}</span><strong>${cost} XP</strong></div>`).join("") || "<p>No XP purchases recorded.</p>"}<div class="total"><span>Spent</span><strong>${spent} XP</strong></div></div></div>
                  <div><h4>XP Awards</h4><div class="xp-ledger xp-award-ledger">${xpAwards.map((entry) => `<div><span>${escapeHtmlAttribute(entry.note || "GM award")}</span><strong>+${Number(entry.amount)} XP</strong><small>${entry.at ? new Date(entry.at).toLocaleDateString() : "Recorded"}</small></div>`).join("") || "<p>No later XP awards recorded.</p>"}<div class="total"><span>Initial ${initialXp} + awards ${xpAwardedTotal}</span><strong>${character.xp.starting} XP</strong></div></div></div>
                </div>
              </section></div>
            </div>
          </section>
        </div>
      </section>
      <aside class="validation-panel">
        <h2>Save Your Acolyte</h2>
        <button class="primary-button save-to-roster" type="button">Save &amp; Return to Acolytes <span>›</span></button>
        ${warnings.length ? warnings.map((warning) => `<p class="warning">${warning}</p>`).join("") : `<p class="valid">Character creation record is complete.</p>`}
        <section class="review-export-options" aria-labelledby="review-export-title">
          <h3 id="review-export-title">Optional exports</h3>
          <p>Download a copy for backup or import into Foundry VTT.</p>
          <button class="compact-button export-builder" type="button">Export Builder JSON</button>
          <button class="compact-button export-foundry" type="button">Export Foundry Actor</button>
        </section>
        <p class="export-status" id="export-status" role="status" aria-live="polite"></p>
      </aside>
    </div>`;
}

function renderStageBody(scene, selected) {
  if (scene.id === "identity") return renderIdentity();
  if (scene.catalog) return renderCatalog(scene, selected);
  if (scene.id === "characteristics") return renderCharacteristics();
  if (scene.id === "fateWounds") return renderFateWounds();
  if (scene.id === "divination") return renderDivination();
  if (scene.id === "aptitudes") return renderAptitudes();
  if (scene.id === "grants") return renderGrants();
  if (scene.id === "equipment") return renderEquipment();
  if (scene.id === "advances") return renderAdvances();
  if (scene.id === "review") return renderReview();
  return renderFacts(scene.facts);
}

function render() {
  if (appView === "roster") {
    renderRoster();
    return;
  }
  if (appView === "reinforcements") {
    renderReinforcements();
    return;
  }
  if (appView === "compendium") {
    renderCompendium();
    return;
  }
  const scene = scenes[step];
  const isIdentity = scene.id === "identity";
  const unresolvedStageGrants = ["grants", "advances"].includes(scene.id) ? grantAlternatives().filter((choice) => !character.grantChoices[choice.id]) : [];
  const selected = selectedEntry(scene, character);
  const sceneArt = selected ? artByChoice[selected.id] : stageArtById[scene.id] || null;
  const framing = selected ? artFramingByChoice[selected.id] : null;
  const imageStyle = sceneArt
    ? `--scene-image: url('${sceneArt}'); --scene-size: ${framing?.size || "cover"}; --scene-position: ${framing?.position || "68% center"}`
    : "";
  root.innerHTML = `
    <a class="skip-link" href="#scene-content">Skip to current step</a>
    <main class="scene scene-${scene.id} theme-${scene.theme} ${selected ? "has-selection" : ""} ${!scene.catalog && !isIdentity ? "management-scene" : ""}" style="${imageStyle}">
      <div class="scene-art" aria-hidden="true"></div>
      <div class="fog fog-one" aria-hidden="true"></div>
      <div class="grain" aria-hidden="true"></div>

      <header class="topbar">
        ${portalEmblem}
        <div class="brand">
          <strong>Dark Heresy Character Creation</strong>
          <span>Create Your Acolyte</span>
        </div>
        ${renderPortalSectionNav("")}
        <div class="audio-controls">
          <button class="sound ${soundtrackPlaying ? "playing" : ""}" id="sound-toggle" type="button" ${hostedEdition ? "disabled" : ""}
            aria-label="${soundtrackPlaying ? "Pause" : "Play"} ambient soundtrack"
            aria-pressed="${soundtrackPlaying}" title="${hostedEdition ? "Soundtrack is available in the local GM edition" : `${soundtrackPlaying ? "Pause" : "Play"} soundtrack`}">
            <span class="sound-icon">${soundtrackPlaying ? "Ⅱ" : "▶"}</span>
            <span class="sound-waves" aria-hidden="true"><i></i><i></i><i></i></span>
          </button>
          <label class="volume-control" title="Soundtrack volume">
            <span aria-hidden="true">VOL</span>
            <input id="sound-volume" type="range" min="0" max="100" step="1"
              value="${Math.round(soundtrack.volume * 100)}" aria-label="Soundtrack volume" />
          </label>
          <label class="text-size-control" title="Interface text size">
            <span aria-hidden="true">TEXT</span>
            <input id="text-size" type="range" min="80" max="160" step="5"
              value="${Math.round(textScale * 100)}" aria-label="Interface text size" />
            <output id="text-size-value" for="text-size">${Math.round(textScale * 100)}%</output>
          </label>
        </div>
      </header>

      <section class="content ${!scene.catalog && !isIdentity ? "management-content" : ""}" id="scene-content" tabindex="-1">
        ${scene.eyebrow ? `<p class="eyebrow">${scene.eyebrow}</p>` : ""}
        ${scene.kicker ? `<p class="kicker">${scene.kicker}</p>` : ""}
        <h1 id="scene-title">${scene.title}</h1>
        <p class="lede">${scene.copy}</p>
        ${scene.catalog ? `
          <div class="catalog-stage-layout">
            <div class="catalog-selection-column">${renderStageBody(scene, selected)}</div>
            ${selected ? renderMechanics(selected) : ""}
          </div>` : `
          ${renderStageBody(scene, selected)}
          ${selected ? renderMechanics(selected) : ""}`}
      </section>

      <aside class="record" aria-label="Current character record">
        <span>Your Acolyte</span>
        <strong>${character.name || "Designation pending"}</strong>
        <p>${step > 0 ? catalogs.homeWorlds.find(x => x.id === character.homeWorld)?.name : "Home World not chosen"}</p>
        <p>${step > 1 ? catalogs.backgrounds.find(x => x.id === character.background)?.name : "Background not chosen"}</p>
        <p>${step > 2 ? catalogs.roles.find(x => x.id === character.role)?.name : "Role not chosen"}</p>
      </aside>

      <footer class="controls ${scene.id === "review" ? "completed-sheet-controls" : ""}" aria-label="${scene.id === "review" ? "Completed character controls" : "Character creation navigation"}">
        <button class="text-button" id="back" ${step === 0 ? "disabled" : ""}>Back</button>
        ${scene.id === "review" ? "" : `<div class="progress" aria-label="Step ${step + 1} of ${scenes.length}">
          ${scenes.map((entry, index) => `<i class="${index === step ? "active" : index < step ? "done" : ""}" ${index === step ? 'aria-current="step"' : ""}><span class="sr-only">${entry.title}${index === step ? ", current step" : index < step ? ", completed" : ""}</span></i>`).join("")}
        </div>`}
        <div class="actions">
          ${isIdentity ? "" : `<button class="text-button" id="details">Rules</button>`}
          <button class="primary-button" id="continue" ${unresolvedStageGrants.length ? `disabled title="Resolve ${unresolvedStageGrants.length} granted choice${unresolvedStageGrants.length === 1 ? "" : "s"} first"` : ""}>${unresolvedStageGrants.length ? `Resolve ${unresolvedStageGrants.length} Choice${unresolvedStageGrants.length === 1 ? "" : "s"}` : scene.id === "review" ? "Save Acolyte & Return" : scene.action}<span>›</span></button>
        </div>
      </footer>
    </main>

    <div class="sr-only" id="selection-announcer" aria-live="polite"></div>

    <dialog id="detail-dialog" aria-labelledby="detail-dialog-title">
      <button class="dialog-close" aria-label="Close details">×</button>
      <p class="eyebrow">Character Creation Reference</p>
      <h2 id="detail-dialog-title">${scene.detailTitle}</h2>
      <p>${scene.detail}</p>
      ${selected ? `<p><strong>${selected.name}</strong></p><ul class="dialog-lore">${loreByChoice[selected.id].map((point) => `<li>${point}</li>`).join("")}</ul>` : ""}
    </dialog>

    <dialog id="rule-dialog" class="rule-dialog" aria-labelledby="rule-dialog-title">
      <button class="dialog-close" aria-label="Close quick rule">×</button>
      <p class="eyebrow">Core Rule</p>
      <h2 id="rule-dialog-title">Rule reference</h2>
      <p id="rule-dialog-summary"></p>
      <p class="source-note" id="rule-dialog-source"></p>
      <button class="primary-button" id="rule-dialog-open" type="button">Open in Compendium <span>›</span></button>
    </dialog>

    <dialog id="sheet-detail-dialog" class="sheet-detail-dialog" aria-labelledby="sheet-detail-title">
      <button class="dialog-close" aria-label="Close character capability details">×</button>
      <p class="eyebrow" id="sheet-detail-kind">Character Record</p>
      <h2 id="sheet-detail-title">Record details</h2>
      <p id="sheet-detail-summary"></p>
      <dl class="sheet-detail-profile" id="sheet-detail-profile"></dl>
      <p class="source-note" id="sheet-detail-source"></p>
    </dialog>

    <dialog id="action-dialog" class="action-dialog" aria-labelledby="action-dialog-title">
      <button class="dialog-close" aria-label="Close action">×</button>
      <p class="eyebrow" id="action-dialog-kind">Current Action</p>
      <div class="action-dialog-title-row" id="action-dialog-title-row">
        <h2 id="action-dialog-title">Action details</h2>
        <span class="action-type-badge" id="action-dialog-type" role="img" aria-label="Action type"></span>
      </div>
      <div class="action-dialog-tags" id="action-dialog-tags"></div>
      <p id="action-dialog-summary"></p>
      <p class="action-dialog-context" id="action-dialog-context"></p>
      <div class="action-fate-control" id="action-fate-control" hidden>
        <div class="action-fate-control-copy">${actionGroupGlyph("Fate")}<span><small>Fate-linked capability</small><strong id="action-fate-status">Fate — / —</strong></span></div>
        <button class="compact-button" id="spend-action-fate" type="button">Spend 1 Fate Point</button>
      </div>
      <div class="action-roll-panel" id="action-roll-panel" hidden>
        <div class="action-psychic-control" id="action-psychic-control" hidden>
          <div><small>Psychic Strength</small><strong id="action-psychic-class">Bound Psyker</strong><span id="action-psychic-base">Base Psy Rating —</span></div>
          <label><span>Effective Psy Rating</span><select id="action-psychic-rating" aria-label="Effective Psy Rating"></select></label>
          <p id="action-psychic-risk"></p>
        </div>
        <div class="action-roll-equation">
          <span><small>Base</small><strong id="action-roll-base">0</strong></span>
          <span><small>Action</small><strong id="action-roll-action-mod">+0</strong></span>
          <span class="action-roll-psychic-value" id="action-roll-psychic-cell" hidden><small>Psychic</small><strong id="action-roll-psychic-mod">+0</strong></span>
          <label><small>Situation</small><select id="action-roll-situation" aria-label="Situational test modifier">${[60,50,40,30,20,10,0,-10,-20,-30,-40,-50,-60].map((modifier) => `<option value="${modifier}" ${modifier === 0 ? "selected" : ""}>${modifier > 0 ? "+" : ""}${modifier}</option>`).join("")}</select></label>
          <span class="action-roll-fate-value"><small>Fate</small><strong id="action-roll-fate-mod">+0</strong></span>
          <span class="action-roll-target"><small>Target</small><strong id="action-roll-target">0</strong></span>
        </div>
        <p class="action-roll-note">Set only the situational modifier supplied by the GM. The action and training modifiers are already included.</p>
        <label class="action-roll-fate-option" id="action-roll-fate-option">
          <input id="action-roll-fate-plus-ten" type="checkbox" />
          ${actionGroupGlyph("Fate")}
          <span><strong>Gain +10 with Fate</strong><small>Declare before rolling. The point is spent when the d100 is rolled.</small></span>
          <em id="action-roll-fate-available">Fate — / —</em>
        </label>
        <button class="primary-button" id="execute-action-roll" type="button">Roll d100 <span>›</span></button>
        <div class="action-roll-result" id="action-roll-result" role="status" aria-live="polite"></div>
      </div>
      <p class="source-note" id="action-dialog-source"></p>
    </dialog>`;

  wireEvents();
  requestAnimationFrame(() => {
    applyRuleHighlights();
    wireFloatingMechanicsTooltips();
    applyTextScale();
    if (pendingFocusSelector) {
      const focusTarget = document.querySelector(pendingFocusSelector);
      pendingFocusSelector = "";
      focusTarget?.focus({ preventScroll: true });
    }
  });
}

function filterReviewActionCards() {
  const query = actionIndexState.query.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll("[data-action-card]").forEach((card) => {
    const groupMatches = actionIndexState.group === "All" || card.dataset.actionGroupValue === actionIndexState.group;
    const fateMatches = !actionIndexState.fateOnly || card.dataset.actionUsesFate === "true";
    const availabilityMatches = actionIndexState.showUnavailable || card.dataset.actionAvailable === "true";
    const searchMatches = !query || card.dataset.actionSearch.includes(query);
    card.hidden = !(groupMatches && fateMatches && availabilityMatches && searchMatches);
    if (!card.hidden) visible += 1;
  });
  document.querySelectorAll("[data-action-section]").forEach((section) => {
    section.hidden = !section.querySelector("[data-action-card]:not([hidden])");
  });
  const empty = document.querySelector("#action-empty");
  if (empty) empty.hidden = visible > 0;
}

function activateReviewTab(tabId, { focus = false } = {}) {
  const button = document.querySelector(`[data-review-tab="${tabId}"]`);
  const panel = document.querySelector(`[data-review-panel="${tabId}"]`);
  if (!button || !panel) return;
  reviewTabState = tabId;
  localStorage.setItem(reviewTabStorageKey, reviewTabState);
  document.querySelectorAll("[data-review-tab]").forEach((entry) => {
    const active = entry === button;
    entry.classList.toggle("active", active);
    entry.setAttribute("aria-selected", String(active));
    entry.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll("[data-review-panel]").forEach((entry) => {
    entry.hidden = entry !== panel;
  });
  const select = document.querySelector("#review-tab-select");
  if (select) select.value = tabId;
  if (focus) button.focus({ preventScroll: true });
}

function signedNumber(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${number}`;
}

function refreshActionRollTarget() {
  const dialog = document.querySelector("#action-dialog");
  const action = currentActionRecords.get(dialog?.dataset.actionId || "");
  if (!action?.test) return;
  const situation = Number(document.querySelector("#action-roll-situation")?.value || 0);
  const fateBonus = document.querySelector("#action-roll-fate-plus-ten")?.checked ? 10 : 0;
  const psychic = action.test.psychicPowerId
    ? psychicStrengthProfile(document.querySelector("#action-psychic-rating")?.value)
    : null;
  const test = psychic ? { ...action.test, actionModifier: Number(action.test.actionModifier || 0) + psychic.modifier } : action.test;
  const resolved = resolvedActionTest(test, situation, fateBonus);
  document.querySelector("#action-roll-base").textContent = resolved.baseTarget;
  document.querySelector("#action-roll-action-mod").textContent = signedNumber(action.test.actionModifier);
  document.querySelector("#action-roll-psychic-mod").textContent = signedNumber(psychic?.modifier || 0);
  document.querySelector("#action-roll-fate-mod").textContent = signedNumber(resolved.fateModifier);
  document.querySelector("#action-roll-target").textContent = resolved.target;
  if (psychic) {
    document.querySelector("#action-psychic-risk").textContent = psychic.risk;
    document.querySelector("#action-psychic-control")?.classList.toggle("pushed", psychic.pushed);
  }
}

function configurePsychicActionRoll(action) {
  const control = document.querySelector("#action-psychic-control");
  const cell = document.querySelector("#action-roll-psychic-cell");
  const select = document.querySelector("#action-psychic-rating");
  const psychic = Boolean(action?.test?.psychicPowerId);
  control.hidden = !psychic;
  cell.hidden = !psychic;
  if (!psychic) {
    select.replaceChildren();
    return;
  }
  const profile = psychicStrengthProfile();
  document.querySelector("#action-psychic-class").textContent = `${profile.classification} Psyker`;
  document.querySelector("#action-psychic-base").textContent = `Base Psy Rating ${profile.base}`;
  select.innerHTML = Array.from({ length: profile.base + profile.pushLimit }, (_, index) => index + 1)
    .map((rating) => `<option value="${rating}" ${rating === profile.base ? "selected" : ""}>${rating}${rating < profile.base ? " · controlled" : rating === profile.base ? " · normal" : " · push"}</option>`)
    .join("");
  document.querySelector("#action-psychic-risk").textContent = profile.risk;
  control.classList.remove("pushed");
}

function refreshActionRollFateControls() {
  const status = fateStatus();
  const checkbox = document.querySelector("#action-roll-fate-plus-ten");
  const label = document.querySelector("#action-roll-fate-option");
  const available = document.querySelector("#action-roll-fate-available");
  if (available) available.textContent = `Fate ${status.current} / ${status.threshold}`;
  if (checkbox) {
    const rollStarted = Boolean(actionRollSession?.roll);
    checkbox.disabled = rollStarted || (!checkbox.checked && status.current <= 0);
  }
  label?.classList.toggle("selected", Boolean(checkbox?.checked));
  label?.classList.toggle("unavailable", status.current <= 0 && !checkbox?.checked);
}

function spendFateForActionRoll() {
  const status = fateStatus();
  if (status.current <= 0) return false;
  character.fate.current = status.current - 1;
  const dialog = document.querySelector("#action-dialog");
  if (dialog) dialog.dataset.resourceChanged = "true";
  playMechanicalLock();
  save();
  refreshActionRollFateControls();
  const generalStatus = dialog?.querySelector("#action-fate-status");
  if (generalStatus) generalStatus.textContent = `Fate ${status.current - 1} / ${status.threshold}`;
  return true;
}

function actionRollResultMarkup(action, session) {
  const { outcome, resolved, roll, originalRoll, rerolled, addedDegree } = session;
  const attack = action.test.weaponId || action.test.unarmed || action.test.hitMode;
  const effectiveDegrees = outcome.success ? outcome.degrees + (addedDegree ? 1 : 0) : outcome.degrees;
  const outcomeLabel = `${effectiveDegrees} Degree${effectiveDegrees === 1 ? "" : "s"} of ${outcome.success ? "Success" : "Failure"}${addedDegree ? " (includes +1 from Fate)" : ""}`;
  const hitCount = attack && outcome.success ? attackHitCount(action.test, effectiveDegrees) : 0;
  const location = attack && outcome.success ? (action.test.calledShot ? "Declared location" : attackHitLocation(roll)) : "";
  const jamThreshold = ["semi", "full", "suppressing"].includes(action.test.hitMode) ? 94 : 96;
  const possibleJam = Boolean(action.test.weaponId && weaponIsRanged(equipmentItem(action.test.weaponId)) && roll >= jamThreshold);
  session.possibleJam = possibleJam;
  const phenomena = psychicPhenomenaTriggered(roll, session.psychic);
  session.phenomena = phenomena;
  const fate = fateStatus();
  const canReroll = !rerolled && !addedDegree && fate.current > 0;
  const canAddDegree = outcome.success && !addedDegree && fate.current > 0;
  return `<div class="action-outcome ${outcome.success && !possibleJam ? "success" : "failure"}"><strong>${roll} - ${outcome.success && !possibleJam ? "Success" : possibleJam ? "Possible weapon jam" : "Failure"}</strong><span>Target ${resolved.target} · ${outcomeLabel}</span>${rerolled ? `<span>Mandatory reroll · original result ${originalRoll}</span>` : ""}${session.psychic ? `<span>Effective Psy Rating ${session.psychic.effective} · ${session.psychic.classification}${session.psychic.pushed ? " Push" : " normal strength"}</span>` : ""}${hitCount ? `<span>${hitCount} hit${hitCount === 1 ? "" : "s"}${location ? ` · ${location}` : ""}</span>` : ""}${possibleJam ? `<em>The roll reached this fire mode's jam threshold. Apply the weapon's Reliable, Unreliable, or other relevant qualities.</em>` : ""}</div>
    ${phenomena ? `<div class="psychic-phenomena-alert"><strong>Psychic Phenomena triggered</strong><span>Resolve the Warp disturbance before applying the power's effects.</span><button class="compact-button roll-psychic-phenomena" type="button">Roll Psychic Phenomena d100</button></div>` : session.psychic ? `<p class="psychic-risk-clear">No Psychic Phenomena was triggered by this Focus Power result.</p>` : ""}
    <div class="action-roll-fate-after" ${canReroll || canAddDegree ? "" : "hidden"}>
      ${canReroll ? `<button class="compact-button reroll-action-with-fate" type="button">Spend Fate to re-roll</button>` : ""}
      ${canAddDegree ? `<button class="compact-button add-action-degree-with-fate" type="button">Spend Fate for +1 DoS</button>` : ""}
      <small>Fate ${fate.current} / ${fate.threshold}</small>
    </div>
    ${action.test.weaponId && outcome.success && !possibleJam ? `<button class="compact-button roll-action-damage" type="button">Roll first hit damage</button>` : ""}`;
}

function wireActionRollResultButtons(action, result) {
  result.querySelector(".reroll-action-with-fate")?.addEventListener("click", rerollCurrentActionWithFate);
  result.querySelector(".add-action-degree-with-fate")?.addEventListener("click", addDegreeToCurrentActionWithFate);
  result.querySelector(".roll-action-damage")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    await rollWeaponDamage(action, result);
  });
  result.querySelector(".roll-psychic-phenomena")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const [roll] = await rollVisualDice(1, 100);
    button.insertAdjacentHTML("afterend", `<p class="psychic-phenomena-result"><strong>${roll}</strong><span>Apply this result on Table 6–2: Psychic Phenomena (Core Rulebook, p. 196) before resolving the power.</span></p>`);
  });
}

function renderCurrentActionRollResult(action) {
  const result = document.querySelector("#action-roll-result");
  if (!result || !actionRollSession?.outcome) return;
  result.innerHTML = actionRollResultMarkup(action, actionRollSession);
  wireActionRollResultButtons(action, result);
  refreshActionRollFateControls();
}

function openActionDialog(actionId) {
  const action = currentActionRecords.get(actionId) || derivedCharacterActions().find((entry) => entry.id === actionId);
  const dialog = document.querySelector("#action-dialog");
  if (!action || !dialog) return;
  dialog.dataset.actionId = action.id;
  dialog.querySelector("#action-dialog-kind").textContent = action.group;
  dialog.querySelector("#action-dialog-title").textContent = action.name;
  dialog.querySelector("#action-dialog-summary").textContent = action.summary;
  dialog.querySelector("#action-dialog-context").textContent = action.context || "Available now.";
  dialog.querySelector("#action-dialog-source").textContent = `Source: ${action.source || actionSource}`;
  const typePresentation = actionTypePresentation(action.type);
  dialog.querySelector("#action-dialog-title-row").className = `action-dialog-title-row action-type-${typePresentation.key}`;
  const typeBadge = dialog.querySelector("#action-dialog-type");
  typeBadge.setAttribute("aria-label", `Action type: ${action.type}`);
  typeBadge.setAttribute("title", action.type);
  typeBadge.innerHTML = `${actionTypeGlyph(typePresentation.key)}<span class="action-type-caption">${escapeHtmlAttribute(typePresentation.short)}</span>`;
  const tags = dialog.querySelector("#action-dialog-tags");
  tags.innerHTML = (action.subtypes || []).map((tag) => `<span>${escapeHtmlAttribute(tag)}</span>`).join("");
  tags.hidden = !(action.subtypes || []).length;
  const fateControl = dialog.querySelector("#action-fate-control");
  const fateButton = dialog.querySelector("#spend-action-fate");
  const fate = fateStatus();
  fateControl.hidden = !action.usesFate;
  dialog.dataset.resourceChanged = "false";
  if (action.usesFate) {
    dialog.querySelector("#action-fate-status").textContent = `Fate ${fate.current} / ${fate.threshold}`;
    fateControl.classList.toggle("fate-burn-warning", Boolean(action.burnsFate));
    fateButton.hidden = !action.spendsFate;
    fateButton.disabled = !action.spendsFate || fate.current <= 0;
    fateButton.textContent = action.spendsFate ? fate.current > 0 ? "Spend 1 Fate Point" : "No Fate Points Remain" : "Fate-linked rule";
    fateControl.querySelector("small").textContent = action.burnsFate
      ? "Permanent Fate burn — resolve with the GM"
      : action.spendsFate ? "This capability costs current Fate" : "This rule modifies another Fate use";
  }
  const rollPanel = dialog.querySelector("#action-roll-panel");
  rollPanel.hidden = !action.test;
  configurePsychicActionRoll(action);
  dialog.querySelector("#action-roll-situation").value = "0";
  dialog.querySelector("#action-roll-fate-plus-ten").checked = false;
  dialog.querySelector("#action-roll-result").replaceChildren();
  const rollButton = dialog.querySelector("#execute-action-roll");
  rollButton.disabled = false;
  rollButton.innerHTML = "Roll d100 <span>›</span>";
  actionRollSession = action.test ? { actionId: action.id, plusTenSpent: false, rerolled: false, addedDegree: false, roll: null, originalRoll: null, outcome: null, resolved: null } : null;
  if (action.test) {
    refreshActionRollTarget();
    refreshActionRollFateControls();
  }
  dialog.showModal();
}

async function rollWeaponDamage(action, targetElement) {
  const weapon = equipmentItem(action.test?.weaponId);
  if (!weapon || !targetElement) return;
  const formula = String(weapon.profile?.damage || "");
  const match = formula.match(/(\d+)d(10|5)\s*([+-]\s*\d+)?/i);
  if (!match) {
    targetElement.insertAdjacentHTML("beforeend", `<p class="action-roll-caveat">Damage formula could not be resolved automatically: ${escapeHtmlAttribute(formula || "not recorded")}.</p>`);
    return;
  }
  const baseDice = Number(match[1]);
  const sides = Number(match[2]);
  const fixed = Number(String(match[3] || "0").replace(/\s/g, ""));
  const tearing = Boolean(weapon.profile?.special?.tearing);
  const rolled = await rollVisualDice(baseDice + (tearing ? 1 : 0), sides);
  const kept = tearing ? [...rolled].sort((a, b) => b - a).slice(0, baseDice) : rolled;
  const primitive = Number(weapon.profile?.special?.primitive || 0);
  const adjusted = primitive ? kept.map((die) => Math.min(die, primitive)) : kept;
  const strength = weaponIsMelee(weapon) ? characteristicBonus("strength") : 0;
  const total = Math.max(0, adjusted.reduce((sum, die) => sum + die, 0) + fixed + strength);
  const qualities = specialSummary(weapon.profile?.special || {});
  targetElement.insertAdjacentHTML("beforeend", `<div class="action-damage-result"><strong>${total} ${escapeHtmlAttribute(weapon.profile?.damageType || "Damage")}</strong><span>${escapeHtmlAttribute(`${formula}${strength ? ` + SB ${strength}` : ""}`)} · Pen ${escapeHtmlAttribute(String(weapon.profile?.penetration ?? 0))}</span>${qualities ? `<small>${escapeHtmlAttribute(qualities)}</small>` : ""}<em>Raw damage before the target applies Armour, Toughness, and other defences.</em></div>`);
}

async function executeCurrentActionRoll() {
  const dialog = document.querySelector("#action-dialog");
  const action = currentActionRecords.get(dialog?.dataset.actionId || "");
  if (!action?.test) return;
  const button = document.querySelector("#execute-action-roll");
  button.disabled = true;
  try {
    const situation = Number(document.querySelector("#action-roll-situation")?.value || 0);
    const plusTen = Boolean(document.querySelector("#action-roll-fate-plus-ten")?.checked);
    if (plusTen && !actionRollSession?.plusTenSpent) {
      if (!spendFateForActionRoll()) return;
      actionRollSession.plusTenSpent = true;
    }
    const psychic = action.test.psychicPowerId
      ? psychicStrengthProfile(document.querySelector("#action-psychic-rating")?.value)
      : null;
    const test = psychic ? { ...action.test, actionModifier: Number(action.test.actionModifier || 0) + psychic.modifier } : action.test;
    const resolved = resolvedActionTest(test, situation, plusTen ? 10 : 0);
    const [roll] = await rollVisualDice(1, 100);
    const outcome = testOutcome(roll, resolved.target);
    actionRollSession = { ...actionRollSession, actionId: action.id, resolved, psychic, roll, originalRoll: roll, outcome };
    renderCurrentActionRollResult(action);
  } finally {
    const resolved = Boolean(actionRollSession?.roll);
    button.disabled = resolved;
    button.innerHTML = resolved ? "Test resolved" : "Roll d100 <span>›</span>";
  }
}

async function rerollCurrentActionWithFate() {
  const dialog = document.querySelector("#action-dialog");
  const action = currentActionRecords.get(dialog?.dataset.actionId || "");
  if (!action?.test || !actionRollSession?.roll || actionRollSession.rerolled || actionRollSession.addedDegree) return;
  if (!spendFateForActionRoll()) return;
  const button = document.querySelector(".reroll-action-with-fate");
  if (button) button.disabled = true;
  const [roll] = await rollVisualDice(1, 100);
  actionRollSession.roll = roll;
  actionRollSession.rerolled = true;
  actionRollSession.outcome = testOutcome(roll, actionRollSession.resolved.target);
  renderCurrentActionRollResult(action);
}

function addDegreeToCurrentActionWithFate() {
  const dialog = document.querySelector("#action-dialog");
  const action = currentActionRecords.get(dialog?.dataset.actionId || "");
  if (!action?.test || !actionRollSession?.outcome?.success || actionRollSession.addedDegree) return;
  if (!spendFateForActionRoll()) return;
  actionRollSession.addedDegree = true;
  renderCurrentActionRollResult(action);
}

function wireEvents() {
  document.querySelector("#open-roster")?.addEventListener("click", () => {
    appView = "roster";
    save();
    render();
  });
  document.querySelector("#open-reinforcements")?.addEventListener("click", () => {
    appView = "reinforcements";
    save();
    render();
  });
  document.querySelector("#open-compendium")?.addEventListener("click", () => {
    appView = "compendium";
    save();
    render();
  });
  document.querySelector("#sound-volume").addEventListener("input", (event) => {
    soundtrack.volume = Number(event.target.value) / 100;
    localStorage.setItem("dh2-soundtrack-volume", String(soundtrack.volume));
  });
  document.querySelector("#text-size").addEventListener("input", (event) => {
    textScale = Number(event.target.value) / 100;
    localStorage.setItem("dh2-text-scale", String(textScale));
    document.querySelector("#text-size-value").textContent = `${Math.round(textScale * 100)}%`;
    applyTextScale();
  });

  document.querySelectorAll("[data-review-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      playMechanicalLock();
      activateReviewTab(button.dataset.reviewTab);
    });
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...document.querySelectorAll("[data-review-tab]")];
      const index = tabs.indexOf(button);
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      activateReviewTab(tabs[nextIndex].dataset.reviewTab, { focus: true });
    });
  });
  document.querySelector("#review-tab-select")?.addEventListener("change", (event) => {
    playMechanicalLock();
    activateReviewTab(event.target.value);
  });
  document.querySelector("[data-open-advancement-tab]")?.addEventListener("click", () => {
    playMechanicalLock();
    activateReviewTab("advancement");
    document.querySelector('[data-review-panel="advancement"]')?.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.querySelector("#xp-award-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const amountInput = event.currentTarget.elements.amount;
    const noteInput = event.currentTarget.elements.note;
    const amount = Math.floor(Number(amountInput.value || 0));
    if (!Number.isFinite(amount) || amount < 1) {
      amountInput.focus();
      return;
    }
    character.xp.starting += amount;
    character.xp.awards.push({
      id: globalThis.crypto?.randomUUID?.() || `xp-${Date.now()}`,
      amount,
      note: String(noteInput.value || "").trim(),
      at: new Date().toISOString(),
    });
    playMechanicalLock();
    save();
    pendingFocusSelector = "#xp-award-amount";
    render();
  });
  document.querySelector("[data-manage-advances]")?.addEventListener("click", () => {
    playMechanicalLock();
    step = scenes.findIndex((entry) => entry.id === "advances");
    pendingFocusSelector = "#scene-content";
    save();
    render();
  });
  document.querySelector("[data-manage-inventory]")?.addEventListener("click", () => {
    playMechanicalLock();
    step = scenes.findIndex((entry) => entry.id === "equipment");
    pendingFocusSelector = "#scene-content";
    save();
    render();
  });

  document.querySelector("[data-current-damage]")?.addEventListener("input", (event) => {
    character.combat.damage = Math.max(0, Number(event.target.value || 0));
    save();
    refreshReviewWounds();
  });
  document.querySelector("[data-current-damage]")?.addEventListener("change", refreshReviewWounds);
  document.querySelectorAll("[data-adjust-damage]").forEach((button) => {
    button.addEventListener("click", () => {
      character.combat.damage = Math.max(0, Number(character.combat.damage || 0) + Number(button.dataset.adjustDamage || 0));
      playMechanicalLock();
      save();
      refreshReviewWounds();
    });
  });

  document.querySelector("[data-current-fate]")?.addEventListener("input", (event) => {
    const threshold = finalFateThreshold();
    character.fate.current = Math.max(0, Math.min(threshold, Number(event.target.value || 0)));
    save();
    refreshReviewFate();
  });
  document.querySelector("[data-current-fate]")?.addEventListener("change", () => {
    rerenderEquipmentStatePreservingScroll("[data-current-fate]");
  });
  document.querySelectorAll("[data-adjust-fate]").forEach((button) => {
    button.addEventListener("click", () => {
      const status = fateStatus();
      character.fate.current = Math.max(0, Math.min(status.threshold, status.current + Number(button.dataset.adjustFate || 0)));
      playMechanicalLock();
      save();
      rerenderEquipmentStatePreservingScroll(`[data-adjust-fate="${button.dataset.adjustFate}"]`);
    });
  });
  document.querySelector("[data-open-fate-actions]")?.addEventListener("click", () => {
    actionIndexState.group = "All";
    actionIndexState.fateOnly = true;
    localStorage.setItem("dh2-action-group", actionIndexState.group);
    localStorage.setItem("dh2-action-fate-only", "true");
    activateReviewTab("actions");
    document.querySelectorAll("[data-action-group]").forEach((entry) => {
      const active = entry.dataset.actionGroup === "All";
      entry.classList.toggle("active", active);
      entry.setAttribute("aria-pressed", String(active));
    });
    const fateButton = document.querySelector("[data-action-fate-only]");
    fateButton?.classList.add("active");
    fateButton?.setAttribute("aria-pressed", "true");
    filterReviewActionCards();
    document.querySelector('[data-review-panel="actions"]')?.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.querySelector("#action-search")?.addEventListener("input", (event) => {
    actionIndexState.query = event.target.value;
    localStorage.setItem("dh2-action-query", actionIndexState.query);
    filterReviewActionCards();
  });
  document.querySelectorAll("[data-action-group]").forEach((button) => {
    button.addEventListener("click", () => {
      actionIndexState.group = button.dataset.actionGroup;
      localStorage.setItem("dh2-action-group", actionIndexState.group);
      document.querySelectorAll("[data-action-group]").forEach((entry) => {
        const active = entry === button;
        entry.classList.toggle("active", active);
        entry.setAttribute("aria-pressed", String(active));
      });
      filterReviewActionCards();
    });
  });
  document.querySelector("[data-action-fate-only]")?.addEventListener("click", (event) => {
    actionIndexState.fateOnly = !actionIndexState.fateOnly;
    localStorage.setItem("dh2-action-fate-only", String(actionIndexState.fateOnly));
    event.currentTarget.classList.toggle("active", actionIndexState.fateOnly);
    event.currentTarget.setAttribute("aria-pressed", String(actionIndexState.fateOnly));
    filterReviewActionCards();
  });
  document.querySelector("#show-unavailable-actions")?.addEventListener("change", (event) => {
    actionIndexState.showUnavailable = event.target.checked;
    localStorage.setItem("dh2-action-show-unavailable", String(actionIndexState.showUnavailable));
    filterReviewActionCards();
  });
  document.querySelector(".review-actions-index")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-action]");
    if (button) openActionDialog(button.dataset.openAction);
  });
  const actionDialog = document.querySelector("#action-dialog");
  actionDialog?.querySelector(".dialog-close")?.addEventListener("click", () => actionDialog.close());
  actionDialog?.addEventListener("click", (event) => {
    if (event.target === actionDialog) actionDialog.close();
  });
  actionDialog?.addEventListener("close", () => {
    if (actionDialog.dataset.resourceChanged === "true") rerenderEquipmentStatePreservingScroll();
  });
  document.querySelector("#spend-action-fate")?.addEventListener("click", (event) => {
    const action = currentActionRecords.get(actionDialog?.dataset.actionId || "");
    const fate = fateStatus();
    if (!action?.spendsFate || fate.current <= 0) return;
    character.fate.current = fate.current - 1;
    actionDialog.dataset.resourceChanged = "true";
    playMechanicalLock();
    save();
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "Fate Point Spent";
    actionDialog.querySelector("#action-fate-status").textContent = `Fate ${fate.current - 1} / ${fate.threshold}`;
    actionDialog.querySelector("#action-fate-control").classList.add("fate-spent");
  });
  document.querySelector("#action-roll-situation")?.addEventListener("change", refreshActionRollTarget);
  document.querySelector("#action-psychic-rating")?.addEventListener("change", refreshActionRollTarget);
  document.querySelector("#action-roll-fate-plus-ten")?.addEventListener("change", () => {
    refreshActionRollTarget();
    refreshActionRollFateControls();
  });
  document.querySelector("#execute-action-roll")?.addEventListener("click", executeCurrentActionRoll);

  document.querySelector("#sound-toggle").addEventListener("click", async () => {
    try {
      if (soundtrackPlaying) {
        soundtrack.pause();
        soundtrackPlaying = false;
      } else {
        await soundtrack.play();
        soundtrackPlaying = true;
      }
      render();
    } catch {
      soundtrackPlaying = false;
      const button = document.querySelector("#sound-toggle");
      button.title = "The browser could not start this audio file";
      button.classList.add("sound-error");
    }
  });

  const form = document.querySelector("#identity-form");
  form?.addEventListener("input", (event) => {
    const historyField = event.target.dataset?.historyField;
    if (historyField) {
      character.history ||= {};
      character.history[historyField] = event.target.value;
    } else if (event.target.name) {
      character[event.target.name] = event.target.value;
    }
    save();
    const recordName = document.querySelector(".record strong");
    if (recordName) recordName.textContent = character.name || "Designation pending";
  });

  document.querySelector("#back").addEventListener("click", () => {
    if (step > 0) step -= 1;
    pendingFocusSelector = "#scene-content";
    save();
    render();
  });

  document.querySelector("#continue").addEventListener("click", () => {
    if (step < scenes.length - 1) {
      playMechanicalLock();
      step += 1;
      pendingFocusSelector = "#scene-content";
      save();
      render();
    } else {
      playMechanicalLock();
      appView = "roster";
      save({ markComplete: true });
      render();
    }
  });

  const scene = scenes[step];
  if (scene.catalog) {
    document.querySelector("#previous-choice").addEventListener("click", () => cycleChoice(-1));
    document.querySelector("#next-choice").addEventListener("click", () => cycleChoice(1));
    document.querySelector("#randomize-stage")?.addEventListener("click", () => randomizeCurrentCatalog(scene));
    document.querySelector("#randomize-character")?.addEventListener("click", randomizeCharacterOrigins);
    document.querySelectorAll(".catalog-slot").forEach((slot) => {
      slot.addEventListener("click", () => {
        if (!selectCatalogChoice(scene, slot.dataset.choiceId)) return;
        playMechanicalLock();
        pendingFocusSelector = `[data-choice-id="${slot.dataset.choiceId}"]`;
        save();
        render();
      });
    });
    document.querySelector("#mobile-catalog-choice")?.addEventListener("change", (event) => {
      if (!selectCatalogChoice(scene, event.target.value)) return;
      playMechanicalLock();
      pendingFocusSelector = "#mobile-catalog-choice";
      save();
      render();
    });
  }

  document.querySelectorAll(".roll-characteristic").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const id = button.dataset.characteristic;
        const prior = character.rolls[id];
        if (prior && character.characteristicReroll && character.characteristicReroll !== id) return;
        const config = characteristicRollConfig(id);
        const dice = await rollVisualDice(config.quantity, 10);
        const calculated = calculateCharacteristic(dice, config);
        if (prior) character.characteristicReroll = id;
        character.rolls[id] = { ...calculated, dice, formula: `${config.quantity}d10+20`, keep: config.keep, source: "local-3d" };
        save();
        render();
      } catch (error) {
        button.disabled = false;
        button.textContent = "3D unavailable";
        console.error(error);
      }
    });
  });

  document.querySelectorAll("[data-manual-characteristic]").forEach((input) => {
    input.addEventListener("input", () => {
      const id = input.dataset.manualCharacteristic;
      if (!input.value.trim()) {
        delete character.rolls[id];
        if (character.characteristicReroll === id) character.characteristicReroll = null;
        save();
        refreshCharacteristicDisplay(id);
        return;
      }
      const value = Number(input.value);
      const minimum = Number(input.min || 20);
      const maximum = Number(input.max || 50);
      if (!Number.isFinite(value) || value < minimum || value > maximum) return;
      const config = characteristicRollConfig(id);
      character.rolls[id] = { value, dice: [], formula: `${config.quantity}d10+20`, keep: config.keep, source: "manual" };
      save();
      refreshCharacteristicDisplay(id);
    });
  });

  document.querySelector("#roll-fate")?.addEventListener("click", async () => {
    const [value] = await rollVisualDice(1, 10);
    const rules = homeWorldRules();
    character.fate = {
      roll: value,
      source: "local-3d",
      threshold: rules.fate.threshold + (value >= rules.fate.blessing ? 1 : 0),
    };
    save();
    render();
  });
  const manualFate = document.querySelector("#manual-fate");
  manualFate?.addEventListener("input", (event) => {
    if (!event.target.value.trim()) {
      character.fate = {};
      save();
      return;
    }
    const value = Number(event.target.value);
    if (!Number.isFinite(value) || value < 1 || value > 10) return;
    const rules = homeWorldRules();
    character.fate = {
      roll: value,
      source: "manual",
      threshold: rules.fate.threshold + (value >= rules.fate.blessing ? 1 : 0),
    };
    save();
  });
  manualFate?.addEventListener("change", () => {
    render();
  });
  document.querySelector("#roll-wounds")?.addEventListener("click", async () => {
    const rules = homeWorldRules();
    const d10s = await rollVisualDice(rules.wounds.dice, 10);
    const dice = d10s.map((value) => Math.ceil(value / 2));
    character.wounds = {
      dice,
      d10s,
      source: "local-3d",
      total: rules.wounds.base + dice.reduce((sum, value) => sum + value, 0),
    };
    save();
    render();
  });
  const manualWounds = document.querySelector("#manual-wounds");
  manualWounds?.addEventListener("input", (event) => {
    if (!event.target.value.trim()) {
      character.wounds = {};
      save();
      return;
    }
    const total = Number(event.target.value);
    const minimum = Number(event.target.min);
    const maximum = Number(event.target.max);
    if (!Number.isFinite(total) || total < minimum || total > maximum) return;
    character.wounds = { total, dice: [], source: "manual" };
    save();
  });
  manualWounds?.addEventListener("change", () => {
    render();
  });
  document.querySelector("#roll-divination")?.addEventListener("click", async () => {
    const dice = await rollVisualDice(1, 100);
    const value = dice[0];
    character.divination = { roll: value, dice, source: "local-3d", result: divinationFor(value), statChoices: {} };
    save();
    render();
  });
  const manualDivination = document.querySelector("#manual-divination");
  manualDivination?.addEventListener("input", (event) => {
    if (!event.target.value.trim()) {
      character.divination = { statChoices: {} };
      save();
      return;
    }
    const value = Number(event.target.value);
    if (!Number.isFinite(value) || value < 1 || value > 100) return;
    character.divination = { roll: value, dice: [], source: "manual", result: divinationFor(value), statChoices: {} };
    save();
  });
  manualDivination?.addEventListener("change", () => {
    render();
  });
  document.querySelectorAll("[data-divination-choice]").forEach((select) => {
    select.addEventListener("change", () => {
      character.divination.statChoices ||= {};
      character.divination.statChoices[select.dataset.divinationChoice] = select.value;
      save();
      render();
    });
  });
  document.querySelector("[data-divination-talent-speciality]")?.addEventListener("change", (event) => {
    character.divination.resolutions ||= {};
    character.divination.resolutions.talentSpeciality = event.target.value;
    playMechanicalLock();
    save();
    render();
  });
  document.querySelector("[data-divination-disorder]")?.addEventListener("change", (event) => {
    character.divination.resolutions ||= {};
    character.divination.resolutions.disorderId = event.target.value;
    playMechanicalLock();
    save();
    render();
  });
  const recordDivinationMalignancy = (value, dice = [], source = "manual") => {
    character.divination.resolutions ||= {};
    const entry = tableEntryForRoll(malignancies, value);
    character.divination.resolutions.malignancyRoll = value;
    character.divination.resolutions.malignancyId = entry?.id || "";
    character.divination.resolutions.malignancyDice = dice;
    character.divination.resolutions.malignancySource = source;
    delete character.divination.resolutions.malignancyMagnitude;
    delete character.divination.resolutions.malignancyDetail;
  };
  document.querySelector("[data-roll-divination-malignancy]")?.addEventListener("click", async () => {
    const dice = await rollVisualDice(1, 100);
    recordDivinationMalignancy(dice[0], dice, "local-3d");
    save();
    render();
  });
  const manualDivinationMalignancy = document.querySelector("[data-divination-malignancy-roll]");
  manualDivinationMalignancy?.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value) || value < 1 || value > 100) return;
    recordDivinationMalignancy(value);
    save();
  });
  manualDivinationMalignancy?.addEventListener("change", render);

  document.querySelector("[data-mutant-trait]")?.addEventListener("change", (event) => {
    character.exceptional.mutantTraitId = event.target.value;
    playMechanicalLock();
    save();
    render();
  });
  const recordMutation = (value, dice = [], source = "manual") => {
    const entry = tableEntryForRoll(mutations, value);
    character.exceptional.mutationRoll = value;
    character.exceptional.mutationId = entry?.id || "";
    character.exceptional.mutationDice = dice;
    character.exceptional.mutationSource = source;
    delete character.exceptional.mutationMagnitude;
    delete character.exceptional.mutationDetail;
  };
  document.querySelector("[data-roll-mutation]")?.addEventListener("click", async () => {
    const dice = await rollVisualDice(5, 10);
    recordMutation(dice.reduce((sum, die) => sum + die, 0), dice, "local-3d");
    save();
    render();
  });
  const manualMutation = document.querySelector("[data-mutation-roll]");
  manualMutation?.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value) || value < 5 || value > 50) return;
    recordMutation(value);
    save();
  });
  manualMutation?.addEventListener("change", render);

  document.querySelector("[data-starting-malignancy]")?.addEventListener("change", (event) => {
    character.exceptional.startingMalignancyId = event.target.value;
    delete character.exceptional.startingMalignancyMagnitude;
    delete character.exceptional.startingMalignancyDetail;
    playMechanicalLock();
    save();
    render();
  });
  const manualDaemonCorruption = document.querySelector("[data-daemon-corruption]");
  manualDaemonCorruption?.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value) || value < 6 || value > 15) return;
    character.exceptional.daemonWorldCorruption = value;
    save();
  });
  manualDaemonCorruption?.addEventListener("change", render);
  document.querySelector("[data-roll-daemon-corruption]")?.addEventListener("click", async () => {
    const [die] = await rollVisualDice(1, 10);
    character.exceptional.daemonWorldCorruption = die + 5;
    character.exceptional.daemonWorldCorruptionDie = die;
    save();
    render();
  });
  const setExceptionalMagnitude = (source, value) => {
    if (source === "divination") {
      character.divination.resolutions.malignancyMagnitude = value;
    } else if (source === "mutation") {
      character.exceptional.mutationMagnitude = value;
    } else {
      character.exceptional.startingMalignancyMagnitude = value;
    }
  };
  document.querySelectorAll("[data-exceptional-magnitude]").forEach((input) => {
    input.addEventListener("input", () => {
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < Number(input.min) || value > Number(input.max)) return;
      setExceptionalMagnitude(input.dataset.exceptionalMagnitude, value);
      save();
    });
    input.addEventListener("change", render);
  });
  document.querySelectorAll("[data-roll-exceptional-magnitude]").forEach((button) => {
    button.addEventListener("click", async () => {
      const source = button.dataset.rollExceptionalMagnitude;
      const entry = source === "divination" ? selectedMalignancyRecord("divination") : source === "mutation" ? selectedMutationRecord() : selectedMalignancyRecord("starting");
      if (!entry?.characteristicRoll) return;
      const [die] = await rollVisualDice(1, entry.characteristicRoll.sides === 5 ? 10 : entry.characteristicRoll.sides);
      const value = entry.characteristicRoll.sides === 5 ? Math.ceil(die / 2) : die;
      setExceptionalMagnitude(source, value);
      save();
      render();
    });
  });
  document.querySelectorAll("[data-exceptional-detail]").forEach((input) => {
    input.addEventListener("input", () => {
      const source = input.dataset.exceptionalDetail;
      if (source === "divination") character.divination.resolutions.malignancyDetail = input.value;
      else if (source === "mutation") character.exceptional.mutationDetail = input.value;
      else character.exceptional.startingMalignancyDetail = input.value;
      save();
    });
  });

  document.querySelectorAll("[data-aptitude-replacement]").forEach((select) => {
    select.addEventListener("change", () => {
      playMechanicalLock();
      character.aptitudeReplacements[Number(select.dataset.aptitudeReplacement)] = select.value;
      save();
      render();
    });
  });
  document.querySelectorAll("[data-aptitude-source]").forEach((select) => {
    select.addEventListener("change", () => {
      playMechanicalLock();
      character.aptitudeSelections[select.dataset.aptitudeSource] = select.value;
      character.aptitudeReplacements = [];
      save();
      render();
    });
  });
  document.querySelectorAll("[data-grant-choice]").forEach((select) => {
    select.addEventListener("change", () => {
      playMechanicalLock();
      const choiceId = select.dataset.grantChoice;
      character.grantChoices[choiceId] = select.value;
      save();
      rerenderGrantsPreservingScroll(`[data-grant-choice="${choiceId}"]`);
    });
  });
  const filterArmoury = () => {
    armouryBrowserState.query = document.querySelector("#armoury-search")?.value || "";
    armouryBrowserState.category = document.querySelector("[data-equipment-category].active")?.dataset.equipmentCategory || "All";
    armouryBrowserState.availability = document.querySelector("[data-equipment-availability].active")?.dataset.equipmentAvailability || "available";
    const query = normaliseItemName(armouryBrowserState.query);
    let visibleCount = 0;
    document.querySelectorAll(".armoury-item").forEach((item) => {
      const categoryMatches = armouryBrowserState.category === "All" || item.dataset.equipmentType === armouryBrowserState.category;
      const availableNow = item.dataset.equipmentAvailable === "true";
      const availabilityMatches = armouryBrowserState.availability === "all"
        || (armouryBrowserState.availability === "available" && availableNow)
        || (armouryBrowserState.availability === "unavailable" && !availableNow);
      item.hidden = !(item.dataset.equipmentSearch.includes(query) && categoryMatches && availabilityMatches);
      if (!item.hidden) visibleCount += 1;
    });
    const emptyState = document.querySelector(".armoury-empty");
    if (emptyState) emptyState.hidden = visibleCount > 0;
  };
  document.querySelector("#armoury-search")?.addEventListener("input", filterArmoury);
  document.querySelector("#armoury-availability-select")?.addEventListener("change", (event) => {
    playMechanicalLock();
    document.querySelectorAll("[data-equipment-availability]").forEach((entry) => {
      const active = entry.dataset.equipmentAvailability === event.currentTarget.value;
      entry.classList.toggle("active", active);
      entry.setAttribute("aria-pressed", String(active));
    });
    filterArmoury();
  });
  document.querySelectorAll("[data-equipment-availability]").forEach((button) => {
    button.addEventListener("click", () => {
      playMechanicalLock();
      document.querySelectorAll("[data-equipment-availability]").forEach((entry) => {
        entry.classList.toggle("active", entry === button);
        entry.setAttribute("aria-pressed", String(entry === button));
      });
      const availabilitySelect = document.querySelector("#armoury-availability-select");
      if (availabilitySelect) availabilitySelect.value = button.dataset.equipmentAvailability;
      filterArmoury();
    });
  });
  document.querySelectorAll("[data-equipment-category]").forEach((button) => {
    button.addEventListener("click", () => {
      playMechanicalLock();
      document.querySelectorAll("[data-equipment-category]").forEach((entry) => {
        entry.classList.toggle("active", entry === button);
        entry.setAttribute("aria-pressed", String(entry === button));
      });
      filterArmoury();
    });
  });
  document.querySelectorAll("[data-equipment-item]").forEach((button) => {
    button.addEventListener("click", () => {
      playMechanicalLock();
      character.equipment.selected = button.dataset.equipmentItem;
      save();
      rerenderEquipmentStatePreservingScroll(`[data-equipment-item="${button.dataset.equipmentItem}"]`);
    });
  });
  document.querySelector("[data-add-equipment]")?.addEventListener("click", (event) => {
    playMechanicalLock();
    const id = event.currentTarget.dataset.addEquipment;
    if (character.equipment.noCostGrants.includes(id)) {
      character.equipment.noCostGrants = character.equipment.noCostGrants.filter((entry) => entry !== id);
      character.equipment.inventory = character.equipment.inventory.filter((entry) => entry !== id);
      removeEquipmentState(id);
    } else if (!character.equipment.inventory.includes(id)) {
      character.equipment.inventory.push(id);
      character.equipment.noCostGrants.push(id);
    }
    save();
    rerenderEquipmentStatePreservingScroll();
  });
  document.querySelector("[data-acquire-equipment]")?.addEventListener("click", (event) => {
    playMechanicalLock();
    const id = event.currentTarget.dataset.acquireEquipment;
    if (!character.acquisitions.includes(id)) character.acquisitions.push(id);
    if (!character.equipment.inventory.includes(id)) character.equipment.inventory.push(id);
    character.equipment.noCostGrants = character.equipment.noCostGrants.filter((entry) => entry !== id);
    save();
    rerenderEquipmentStatePreservingScroll();
  });
  document.querySelectorAll("[data-remove-acquisition]").forEach((button) => {
    button.addEventListener("click", () => {
      playMechanicalLock();
      const id = button.dataset.removeAcquisition;
      character.acquisitions = character.acquisitions.filter((entry) => entry !== id);
      character.equipment.inventory = character.equipment.inventory.filter((entry) => entry !== id);
      removeEquipmentState(id);
      save();
      rerenderEquipmentStatePreservingScroll();
    });
  });
  document.querySelector("[data-clear-legacy]")?.addEventListener("click", () => {
    character.equipment.legacyAcquisitions = [];
    save();
    rerenderEquipmentStatePreservingScroll();
  });
  document.querySelectorAll("[data-ready-weapon]").forEach((input) => {
    input.addEventListener("change", () => {
      playMechanicalLock();
      const id = input.dataset.readyWeapon;
      character.equipment.readiedWeapons = input.checked
        ? [...new Set([...character.equipment.readiedWeapons, id])]
        : character.equipment.readiedWeapons.filter((entry) => entry !== id);
      pendingFocusSelector = `[data-ready-weapon="${id}"]`;
      save();
      rerenderEquipmentStatePreservingScroll();
    });
  });
  document.querySelectorAll("[data-wear-armour]").forEach((input) => {
    input.addEventListener("change", () => {
      playMechanicalLock();
      const id = input.dataset.wearArmour;
      character.equipment.wornArmour = input.checked
        ? [...new Set([...character.equipment.wornArmour, id])]
        : character.equipment.wornArmour.filter((entry) => entry !== id);
      pendingFocusSelector = `[data-wear-armour="${id}"]`;
      save();
      rerenderEquipmentStatePreservingScroll();
    });
  });
  document.querySelectorAll("[data-active-gear]").forEach((input) => {
    input.addEventListener("change", () => {
      playMechanicalLock();
      const id = input.dataset.activeGear;
      character.equipment.activeGear = input.checked
        ? [...new Set([...character.equipment.activeGear, id])]
        : character.equipment.activeGear.filter((entry) => entry !== id);
      pendingFocusSelector = `[data-active-gear="${id}"]`;
      save();
      rerenderEquipmentStatePreservingScroll();
    });
  });
  document.querySelectorAll("[data-modification-target]").forEach((select) => {
    select.addEventListener("change", () => {
      playMechanicalLock();
      const modificationId = select.dataset.modificationTarget;
      if (select.value) character.equipment.weaponModAssignments[modificationId] = select.value;
      else delete character.equipment.weaponModAssignments[modificationId];
      pendingFocusSelector = `[data-modification-target="${modificationId}"]`;
      save();
      rerenderEquipmentStatePreservingScroll();
    });
  });
  document.querySelectorAll("[data-characteristic-advance]").forEach((select) => {
    select.addEventListener("change", () => {
      playMechanicalLock();
      const characteristicId = select.dataset.characteristicAdvance;
      character.advances.characteristics[characteristicId] = Number(select.value);
      save();
      rerenderAdvancesPreservingScroll(`[data-characteristic-advance="${characteristicId}"]`, "#advance-characteristics");
    });
  });
  document.querySelector("[data-elite-advance-inspect]")?.addEventListener("change", (event) => {
    character.eliteShopSelected = event.target.value || null;
    playMechanicalLock();
    save();
    rerenderAdvancesPreservingScroll("[data-elite-advance-inspect]", "#advance-elite");
  });
  document.querySelectorAll("[data-elite-gm-approval]").forEach((input) => {
    input.addEventListener("change", () => {
      character.eliteSetup.gmApproved[input.dataset.eliteGmApproval] = input.checked;
      save();
      rerenderAdvancesPreservingScroll(`[data-elite-gm-approval="${input.dataset.eliteGmApproval}"]`, "#advance-elite");
    });
  });
  document.querySelector("[data-purchase-elite-advance]")?.addEventListener("click", (event) => {
    const advance = eliteAdvanceById(event.currentTarget.dataset.purchaseEliteAdvance);
    if (!advance || eliteAdvanceStatus(advance).missing.length || hasEliteAdvance(advance.id)) return;
    character.advances.eliteAdvances.push({ id: advance.id, name: advance.name, source: `${advance.source}, p. ${advance.page}`, cost: advance.cost });
    if (advance.id === "psyker" && character.background === "astra-telepathica") character.eliteSetup.psykerCorruption = 0;
    playMechanicalLock();
    syncGrantedEquipment();
    save();
    rerenderAdvancesPreservingScroll("#advance-elite", "#advance-elite");
  });
  document.querySelectorAll("[data-remove-elite-advance]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.removeEliteAdvance;
      const removedIds = new Set([id]);
      if (id === "psyker") removedIds.add("astropath");
      character.advances.eliteAdvances = character.advances.eliteAdvances.filter((entry) => !removedIds.has(entry.id));
      if (removedIds.has("astropath")) character.advances.psychicPowers = character.advances.psychicPowers.filter((entry) => psychicPowerById(entry.id)?.discipline !== "Astropath");
      if (!hasPsykerAccess()) {
        character.advances.psychicPowers = [];
        character.advances.psyRating = 0;
      }
      playMechanicalLock();
      syncGrantedEquipment();
      save();
      rerenderAdvancesPreservingScroll("#advance-elite", "#advance-elite");
    });
  });
  document.querySelector("[data-inquisitor-lore]")?.addEventListener("change", (event) => {
    character.eliteSetup.inquisitorLore = event.target.value;
    save();
    rerenderAdvancesPreservingScroll("[data-inquisitor-lore]", "#advance-elite");
  });
  document.querySelector("[data-sister-weapon]")?.addEventListener("change", (event) => {
    character.eliteSetup.sisterWeapon = event.target.value;
    syncGrantedEquipment();
    save();
    rerenderAdvancesPreservingScroll("[data-sister-weapon]", "#advance-elite");
  });
  document.querySelector("[data-psyker-corruption]")?.addEventListener("input", (event) => {
    const value = event.target.value === "" ? null : Math.max(4, Math.min(13, Number(event.target.value)));
    character.eliteSetup.psykerCorruption = value;
    save();
    refreshXpMeter();
  });
  document.querySelector("[data-roll-psyker-corruption]")?.addEventListener("click", async () => {
    const [die] = await rollVisualDice(1, 10);
    character.eliteSetup.psykerCorruption = die + 3;
    save();
    rerenderAdvancesPreservingScroll("[data-psyker-corruption]", "#advance-elite");
  });
  document.querySelectorAll("[data-skill-advance]").forEach((select) => {
    select.addEventListener("change", () => {
      playMechanicalLock();
      const skillId = select.dataset.skillAdvance;
      character.advances.skills[skillId] = Number(select.value);
      save();
      rerenderAdvancesPreservingScroll(`[data-skill-advance="${skillId}"]`, "#advance-skills");
    });
  });
  document.querySelectorAll("[data-specialist-skill-advance]").forEach((select) => {
    select.addEventListener("change", () => {
      playMechanicalLock();
      character.advances.specialistSkills ||= {};
      const key = select.dataset.specialistSkillAdvance;
      const skillId = select.dataset.specialistSkillId;
      const speciality = normaliseSpeciality(select.dataset.specialistSkillName);
      const rank = Number(select.value);
      delete character.advances.skills[skillId];
      if (rank > 0) character.advances.specialistSkills[key] = { skillId, speciality, rank };
      else delete character.advances.specialistSkills[key];
      save();
      rerenderAdvancesPreservingScroll(`[data-specialist-skill-advance="${key}"]`, `#specialist-${skillId}`);
    });
  });
  document.querySelectorAll("[data-add-specialist-skill]").forEach((button) => {
    button.addEventListener("click", () => {
      character.advances.specialistSkills ||= {};
      const skillId = button.dataset.addSpecialistSkill;
      const selected = document.querySelector(`[data-specialist-skill-choice="${skillId}"]`)?.value || "";
      const custom = document.querySelector(`[data-specialist-skill-custom="${skillId}"]`)?.value || "";
      const speciality = normaliseSpeciality(selected || custom);
      if (!speciality) return;
      const key = specialistSkillKey(skillId, speciality);
      character.advances.specialistSkills[key] = { skillId, speciality, rank: Math.max(1, Number(character.advances.specialistSkills[key]?.rank || 0)) };
      delete character.advances.skills[skillId];
      playMechanicalLock();
      save();
      rerenderAdvancesPreservingScroll(`[data-specialist-skill-advance="${key}"]`, `#specialist-${skillId}`);
    });
  });
  const filterTalents = () => {
    const query = (document.querySelector("#talent-search")?.value || "").trim().toLowerCase();
    const tier = document.querySelector("[data-talent-tier].active")?.dataset.talentTier || "All";
    document.querySelectorAll(".talent-row").forEach((row) => {
      row.hidden = !(row.dataset.talentSearch.includes(query) && (tier === "All" || row.dataset.talentTierValue === tier));
    });
  };
  document.querySelector("#talent-search")?.addEventListener("input", (event) => {
    character.talentFilters.query = event.target.value;
    save();
    filterTalents();
  });
  document.querySelectorAll("[data-talent-tier]").forEach((button) => {
    button.addEventListener("click", () => {
      playMechanicalLock();
      document.querySelectorAll("[data-talent-tier]").forEach((entry) => {
        entry.classList.toggle("active", entry === button);
        entry.setAttribute("aria-pressed", String(entry === button));
      });
      character.talentFilters.tier = button.dataset.talentTier;
      save();
      filterTalents();
    });
  });
  document.querySelectorAll("[data-talent-id]").forEach((button) => {
    button.addEventListener("click", () => {
      playMechanicalLock();
      character.talentShopSelected = button.dataset.talentId;
      save();
      rerenderAdvancesPreservingScroll();
    });
  });
  document.querySelector("[data-purchase-talent]")?.addEventListener("click", (event) => {
    const talent = talentCatalogue.find((entry) => entry.id === event.currentTarget.dataset.purchaseTalent);
    if (!talent || talentPrerequisiteStatus(talent).missing.length || character.advances.talents.some((entry) => entry.id === talent.id) || resolvedGrantedTalents()[talent.id]) return;
    character.advances.talents.push({ id: talent.id, name: talent.name, cost: talentCost(talent), source: "XP" });
    playMechanicalLock();
    save();
    rerenderAdvancesPreservingScroll();
  });
  document.querySelectorAll("[data-remove-talent]").forEach((button) => {
    button.addEventListener("click", () => {
      character.advances.talents = character.advances.talents.filter((entry) => entry.id !== button.dataset.removeTalent);
      save();
      rerenderAdvancesPreservingScroll();
    });
  });
  document.querySelectorAll("[data-advance-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const shop = document.querySelector(".advance-shop");
      const target = document.querySelector(`#${button.dataset.advanceJump}`);
      if (shop && target) shop.scrollTo({ top: Math.max(0, target.offsetTop - 46), behavior: "smooth" });
    });
  });
  document.querySelector("[data-psy-rating-advance]")?.addEventListener("change", (event) => {
    character.advances.psyRating = Math.max(0, Number(event.target.value || 0));
    playMechanicalLock();
    save();
    rerenderAdvancesPreservingScroll("[data-psy-rating-advance]", "#advance-psychic");
  });
  document.querySelectorAll("[data-condition-value]").forEach((input) => {
    input.addEventListener("input", () => {
      character.conditions[input.dataset.conditionValue] = Math.max(0, Math.min(100, Number(input.value || 0)));
      save();
    });
  });
  document.querySelector("[data-malefic-approval]")?.addEventListener("change", (event) => {
    character.eliteSetup.maleficApproved = event.target.checked;
    save();
    rerenderAdvancesPreservingScroll("[data-malefic-approval]", "#advance-psychic");
  });
  const filterPsychicPowers = () => {
    const query = String(document.querySelector("#psychic-search")?.value || "").trim().toLowerCase();
    const discipline = document.querySelector("[data-psychic-discipline]")?.value || "All Powers";
    const showUnavailable = document.querySelector("[data-psychic-show-unavailable]")?.checked !== false;
    document.querySelectorAll(".psychic-row").forEach((row) => {
      row.hidden = !(row.dataset.psychicSearch.includes(query)
        && (discipline === "All Powers" || row.dataset.psychicDisciplineValue === discipline)
        && (showUnavailable || row.dataset.psychicAvailable === "true" || row.classList.contains("owned")));
    });
  };
  document.querySelector("#psychic-search")?.addEventListener("input", (event) => {
    character.psychicFilters.query = event.target.value;
    save();
    filterPsychicPowers();
  });
  document.querySelector("[data-psychic-discipline]")?.addEventListener("change", (event) => {
    character.psychicFilters.discipline = event.target.value;
    save();
    filterPsychicPowers();
  });
  document.querySelector("[data-psychic-show-unavailable]")?.addEventListener("change", (event) => {
    character.psychicFilters.showUnavailable = event.target.checked;
    save();
    filterPsychicPowers();
  });
  document.querySelectorAll("[data-psychic-power-id]").forEach((button) => {
    button.addEventListener("click", () => {
      character.psychicShopSelected = button.dataset.psychicPowerId;
      playMechanicalLock();
      save();
      rerenderAdvancesPreservingScroll(`[data-psychic-power-id="${button.dataset.psychicPowerId}"]`, "#advance-psychic");
    });
  });
  document.querySelector("[data-purchase-psychic-power]")?.addEventListener("click", (event) => {
    const power = psychicPowerById(event.currentTarget.dataset.purchasePsychicPower);
    if (!power || psychicPowerStatus(power).missing.length || purchasedPsychicPowerIds().has(power.id) || xpSpent() + power.cost > character.xp.starting) return;
    character.advances.psychicPowers.push({ id: power.id, name: power.name, source: `${power.source}, p. ${power.page}`, cost: power.cost });
    playMechanicalLock();
    save();
    rerenderAdvancesPreservingScroll(`[data-psychic-power-id="${power.id}"]`, "#advance-psychic");
  });
  document.querySelectorAll("[data-remove-psychic-power]").forEach((button) => {
    button.addEventListener("click", () => {
      character.advances.psychicPowers = character.advances.psychicPowers.filter((entry) => entry.id !== button.dataset.removePsychicPower);
      playMechanicalLock();
      save();
      rerenderAdvancesPreservingScroll("#advance-psychic", "#advance-psychic");
    });
  });
  document.querySelector(".export-builder")?.addEventListener("click", () => {
    const filename = `${character.name || "acolyte"}.dh2-character.json`;
    downloadJson(filename, {
      format: "dh2-character-builder",
      version: 2,
      exportedAt: new Date().toISOString(),
      character,
      calculated: {
        characteristicValues: Object.fromEntries(characteristics.map((entry) => [entry.id, characteristicValue(entry.id)])),
        characteristicBreakdowns: Object.fromEntries(characteristics.map((entry) => [entry.id, characteristicBreakdown(entry.id)])),
        divinationModifiers: divinationCharacteristicModifiers(),
        exceptionalModifiers: exceptionalCharacteristicModifiers(),
        fateThreshold: finalFateThreshold(),
        currentFate: currentFatePoints(),
        aptitudes: resolvedAptitudes().aptitudes,
        skills: Object.fromEntries(ownedSkillRecords().map((record) => [record.key, {
          id: record.skill.id,
          name: record.skill.name,
          rank: record.rank,
          initial: Boolean(record.grant),
          source: record.grant?.source || "XP",
          speciality: record.speciality,
        }])),
        talents: [
          ...Object.values(resolvedGrantedTalents()).map((talent) => ({ id: talent.id, name: talent.displayName, initial: true, cost: 0, source: talent.source })),
          ...paidTalentAdvanceEntries().map((entry) => {
            const talent = talentCatalogue.find((candidate) => candidate.id === entry.id);
            return talent ? { id: talent.id, name: talent.name, initial: false, cost: talentCost(talent), source: "XP" } : entry;
          }),
        ],
        eliteAdvances: activeEliteAdvances(),
        psyRating: foundryPsyRating(),
        psyRatingXp: psyRatingXpCost(),
        psychicPowers: character.advances.psychicPowers.map((entry) => psychicPowerById(entry.id) || entry),
        conditions: { ...character.conditions },
        actions: serialisableCharacterActions(),
        xpSpent: xpSpent(),
      },
    });
    const status = document.querySelector("#export-status");
    if (status) status.textContent = `Download started: ${filename}`;
  });
  document.querySelector(".save-to-roster")?.addEventListener("click", () => {
    playMechanicalLock();
    appView = "roster";
    save({ markComplete: true });
    render();
  });
  document.querySelector(".export-foundry")?.addEventListener("click", () => {
    const eliteAdvances = activeEliteAdvances();
    const foundryAbilities = [
      ["Home World", ruleValue(character.homeWorld, "Home World Bonus")],
      ["Background", ruleValue(character.background, "Background Bonus")],
      ["Role", ruleValue(character.role, "Role Bonus")],
    ].filter(([, value]) => value);
    const filename = `${character.name || "acolyte"}.foundry-actor.json`;
    downloadJson(filename, {
      name: character.name || "Unnamed Acolyte",
      type: "acolyte",
      system: {
        bio: {
          homeWorld: foundryBioValue(catalogs.homeWorlds, character.homeWorld),
          background: foundryBackgroundName(),
          role: foundryBioValue(catalogs.roles, character.role),
          elite: eliteAdvances.map((entry) => entry.name).join(", "),
          divination: foundryDivinationName(),
          gender: character.presentation || "",
          notes: [
            character.appearance ? `Appearance: ${character.appearance}` : "",
            ...Object.entries({ desire: "Desire", hatred: "Hatred", sacrifice: "Sacrifice", meeting: "Meeting the Inquisitor", inquisitorMeaning: "Meaning of the Inquisitor", warbandBond: "Warband bond", base: "Base of operations" })
              .map(([id, label]) => character.history?.[id] ? `${label}: ${character.history[id]}` : ""),
          ].filter(Boolean).join("\n\n"),
        },
        characteristics: Object.fromEntries(characteristics.map((entry) => [entry.id, foundryCharacteristicData(entry.id)])),
        fate: {
          max: finalFateThreshold(),
          value: currentFatePoints(),
          rolled: Boolean(character.fate?.roll),
        },
        wounds: {
          max: Number(character.wounds?.total || 0),
          value: woundStatus().remaining,
          critical: woundStatus().critical,
          rolled: Boolean(character.wounds?.total),
        },
        fatigue: { value: 0 },
        psy: {
          rating: foundryPsyRating(),
          sustained: 0,
          defaultPR: foundryPsyRating(),
          class: character.background === "astra-telepathica" ? "bound" : "unbound",
          cost: psyRatingXpCost(),
          hasFocus: character.equipment.inventory.some((id) => /psy-focus/i.test(armoury.find((item) => item.id === id)?.name || "")),
        },
        skills: foundrySkillData(),
        experience: { total: character.xp.starting, used: xpSpent() },
        insanity: Number(character.conditions.insanity || 0),
        corruption: Number(character.conditions.corruption || 0),
      },
      items: [
        ...resolvedAptitudes().aptitudes.map((aptitude) => ({
          name: aptitude,
          type: "aptitude",
          system: { description: "Granted during character creation." },
          flags: { dh2CharacterBuilder: { initial: true } },
        })),
        ...character.equipment.inventory.map((id) => armoury.find((item) => item.id === id)).filter(Boolean).map(foundryEquipmentItem),
        ...foundryUnlinkedGrantedEquipment(),
        ...[
          ...Object.values(resolvedGrantedTalents()).map((talent) => ({ talent, initial: true })),
           ...paidTalentAdvanceEntries().map((entry) => ({ talent: talentCatalogue.find((candidate) => candidate.id === entry.id), initial: false })),
        ].filter((entry) => entry.talent).map(({ talent, initial }) => ({
          name: talent.displayName || talent.name,
          type: "talent",
          system: {
            aptitudes: talent.aptitudes.join(", "),
            benefit: talent.benefit,
            prerequisites: talent.prerequisites,
            source: talent.source,
            tier: Number(talent.tier),
            cost: initial ? 0 : talentCost(talent),
          },
          flags: { dh2CharacterBuilder: { initial } },
        })),
        ...[...automaticTraits(), ...equipmentGrantedTraits()].map((entry) => ({
          name: entry.name,
          type: "trait",
          system: { description: entry.summary || entry.source, level: 0 },
          flags: { dh2CharacterBuilder: { initial: true, conditional: Boolean(entry.conditional) } },
        })),
        ...foundryAbilities.map(foundrySpecialAbility),
        ...eliteAdvances.map((entry) => ({
          name: entry.name,
          type: "specialAbility",
          system: { description: entry.summary || entry.notes, benefit: entry.instantChanges?.join("; ") || entry.summary },
          flags: { dh2CharacterBuilder: { initial: Boolean(entry.automatic), eliteAdvance: true, source: entry.ruleSource || `${entry.source}, p. ${entry.page}` } },
        })),
        ...character.advances.psychicPowers.map((entry) => psychicPowerById(entry.id) || entry).filter((entry) => entry?.name).map((entry) => ({
          name: entry.name,
          type: "psychicPower",
          system: {
            description: entry.summary || entry.description || "Selected during character advancement.",
            benefit: entry.summary || entry.description || "",
            cost: Number(entry.cost || 0),
            discipline: entry.discipline || "",
            action: entry.action || "",
            focusPower: entry.focus || "",
            range: entry.range || "",
            sustained: entry.sustained || "",
            subtype: entry.subtype || "",
            prerequisites: psychicPrerequisiteText(entry),
          },
          flags: { dh2CharacterBuilder: { initial: false, source: entry.page ? `${entry.source}, p. ${entry.page}` : "XP" } },
        })),
      ],
      flags: {
        dh2CharacterBuilder: {
          format: "mrkeathley-dark-heresy-2nd",
          schemaVersion: 2,
          source: character,
          derivedActions: serialisableCharacterActions(),
          eliteAdvances,
          psyRatingXp: psyRatingXpCost(),
        },
      },
    });
    const status = document.querySelector("#export-status");
    if (status) status.textContent = `Download started: ${filename}`;
  });

  const dialog = document.querySelector("#detail-dialog");
  document.querySelector("#details")?.addEventListener("click", () => dialog.showModal());
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  const sheetDetailDialog = document.querySelector("#sheet-detail-dialog");
  sheetDetailDialog?.addEventListener("click", (event) => {
    if (event.target === sheetDetailDialog) sheetDetailDialog.close();
  });
  document.addEventListener("keydown", keyboardNavigation, { once: true });
}

function keyboardNavigation(event) {
  if (event.defaultPrevented || document.querySelector("dialog[open]") || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.closest?.("[role='tablist']")) {
    document.addEventListener("keydown", keyboardNavigation, { once: true });
    return;
  }
  if (event.key === "ArrowLeft" && scenes[step].catalog) {
    cycleChoice(-1);
  } else if (event.key === "ArrowRight" && scenes[step].catalog) {
    cycleChoice(1);
  } else if (event.key === "ArrowLeft" && step > 0) {
    step -= 1;
    save();
    render();
  } else if (event.key === "ArrowRight" && step < scenes.length - 1) {
    step += 1;
    save();
    render();
  } else {
    document.addEventListener("keydown", keyboardNavigation, { once: true });
  }
}

root.addEventListener("click", (event) => {
  const sheetDetailButton = event.target.closest("[data-sheet-detail]");
  if (sheetDetailButton) {
    const record = sheetDetailRecords.get(sheetDetailButton.dataset.sheetDetail);
    const dialog = document.querySelector("#sheet-detail-dialog");
    if (!record || !dialog) return;
    dialog.querySelector("#sheet-detail-kind").textContent = record.kind;
    dialog.querySelector("#sheet-detail-title").textContent = record.name;
    dialog.querySelector("#sheet-detail-summary").textContent = record.summary;
    const profile = dialog.querySelector("#sheet-detail-profile");
    profile.replaceChildren();
    for (const [label, value] of record.rows) {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const definition = document.createElement("dd");
      term.textContent = label;
      definition.textContent = value;
      row.append(term, definition);
      profile.append(row);
    }
    profile.hidden = record.rows.length === 0;
    const source = dialog.querySelector("#sheet-detail-source");
    source.textContent = record.source ? `Source: ${record.source}` : "";
    source.hidden = !record.source;
    dialog.showModal();
    return;
  }
  const termButton = event.target.closest("[data-rule-term]");
  if (termButton) {
    const entry = ruleTermsById[termButton.dataset.ruleTerm];
    const dialog = document.querySelector("#rule-dialog");
    if (!entry || !dialog) return;
    dialog.dataset.termId = entry.id;
    dialog.querySelector("#rule-dialog-title").textContent = entry.term;
    dialog.querySelector("#rule-dialog-summary").textContent = entry.summary;
    dialog.querySelector("#rule-dialog-source").textContent = `${entry.book}, page ${entry.page} · ${entry.category}`;
    dialog.showModal();
    return;
  }
  const dialogOpen = event.target.closest("#rule-dialog-open");
  if (dialogOpen) {
    const dialog = dialogOpen.closest("#rule-dialog");
    const entry = ruleTermsById[dialog?.dataset.termId];
    if (!entry) return;
    dialog.close();
    compendiumState.query = entry.term;
    compendiumState.book = "core";
    compendiumState.chapter = "All";
    appView = "compendium";
    save();
    render();
    return;
  }
  const close = event.target.closest("#rule-dialog .dialog-close");
  if (close) close.closest("dialog")?.close();
  const sheetClose = event.target.closest("#sheet-detail-dialog .dialog-close");
  if (sheetClose) sheetClose.closest("dialog")?.close();
});

await initialiseLocalRepository();
render();
void initialiseCloudRepository().finally(() => {
  if (appView === "roster") renderRoster();
});
