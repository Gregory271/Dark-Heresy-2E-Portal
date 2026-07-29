import { artByChoice, artFramingByChoice, artPageByChoice, catalogs, defaultCharacter, divinations, loreByChoice, mechanicsByChoice, scenes, selectedEntry, stageArtById } from "./data.js?v=0.9.0";
import { armoury } from "./armoury-data.js?v=0.7.0";
import { talentCatalogue } from "./talent-data.js?v=0.8.0";
import { contextualRuleTerms, coreRuleTerms, ruleTermsById } from "./compendium-terms.js?v=0.2.0";
import {
  buildSourcebookLibrary,
  clearStoredSourcebookLibrary,
  loadStoredSourcebookLibrary,
  sourcebookRequirements,
} from "./sourcebook-library.js?v=0.1.0";
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
} from "./cloud-storage.js?v=0.2.0";
import {
  aptitudeChoices,
  aptitudeMatches,
  characteristicAdvanceCosts,
  characteristics,
  rankNames,
  skillAdvanceCosts,
  skills,
  parseCharacteristicModifiers,
  parseFate,
  parseWounds,
} from "./creation-data.js?v=0.6.0";

const root = document.querySelector("#app");
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
  prepared.aptitudeReplacements ||= [];
  prepared.aptitudeSelections ||= {};
  prepared.grantChoices ||= {};
  prepared.acquisitions ||= [];
  prepared.equipment ||= {};
  prepared.equipment.inventory ||= [];
  prepared.equipment.equipped ||= {};
  prepared.equipment.selected ||= null;
  prepared.advances ||= { characteristics: {}, skills: {}, talents: [] };
  prepared.advances.characteristics ||= {};
  prepared.advances.skills ||= {};
  prepared.advances.talents ||= [];
  prepared.advances.psychicPowers ||= [];
  prepared.advances.eliteAdvances ||= [];
  prepared.talentShopSelected ||= null;
  prepared.talentFilters ||= { query: "", tier: "All" };
  prepared.xp ||= { starting: 1000 };
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
let appView = "roster";

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
    mergeCloudRecords(await listCloudCharacters());
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

function queueRepositorySave(record) {
  if (repositoryStatus !== "browser-only") {
    clearTimeout(repositorySaveTimers.get(record.id));
    repositorySaveTimers.set(record.id, setTimeout(async () => {
      try {
        await repositoryRequest(`/${encodeURIComponent(record.id)}`, {
          method: "PUT",
          body: JSON.stringify(record),
        });
        repositoryStatus = "ready";
      } catch (error) {
        repositoryStatus = "browser-only";
        console.warn("Character retained in browser backup because repository save failed.", error);
      } finally {
        repositorySaveTimers.delete(record.id);
      }
    }, 180));
  }
  if (savedCampaignConnection()) {
    clearTimeout(cloudSaveTimers.get(record.id));
    cloudSaveTimers.set(record.id, setTimeout(async () => {
      try {
        await saveCloudCharacter(record);
        cloudStatus = "connected";
      } catch (error) {
        cloudStatus = "offline";
        console.warn("Shared save failed; local recovery copies remain current.", error);
      } finally {
        cloudSaveTimers.delete(record.id);
      }
    }, 500));
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
    await deleteCloudCharacter(id);
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
let vfxMode = localStorage.getItem("dh2-vfx-mode") || "low";
let textScale = Math.min(1.5, Math.max(0.85, Number(localStorage.getItem("dh2-text-scale")) || 1));
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
const compendiumState = {
  query: "",
  book: "all",
  chapter: "All",
  selectedBook: "core",
  selectedPage: 22,
};
document.documentElement.dataset.vfx = vfxMode;

function applyTextScale(scope = root) {
  const surface = scope?.querySelectorAll ? scope : root;
  const previouslyScaled = [...surface.querySelectorAll("[data-access-font]")];
  previouslyScaled.forEach((element) => element.style.removeProperty("font-size"));
  surface.querySelectorAll(".content.is-overflowing").forEach((element) => element.classList.remove("is-overflowing"));

  const excludedTags = new Set(["SCRIPT", "STYLE", "SVG", "PATH", "CANVAS"]);
  const formTags = new Set(["BUTTON", "INPUT", "TEXTAREA", "SELECT", "OUTPUT"]);
  [...surface.querySelectorAll("*")]
    .filter((element) => {
      if (excludedTags.has(element.tagName)) return false;
      const hasDirectText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
      );
      return hasDirectText || formTags.has(element.tagName);
    })
    .forEach((element) => {
      const baseSize = Number.parseFloat(getComputedStyle(element).fontSize);
      if (!Number.isFinite(baseSize) || baseSize <= 0) return;
      element.dataset.accessFont = "";
      element.style.fontSize = `${(baseSize * textScale).toFixed(2)}px`;
    });

  document.documentElement.dataset.textSize = textScale >= 1.45
    ? "extra-large"
    : textScale >= 1.25
      ? "large"
    : textScale > 1
      ? "medium"
      : "normal";

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
});

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
  return modifiers;
}

function characteristicBreakdown(characteristicId) {
  const generated = Number(character.rolls[characteristicId]?.value || 0);
  const advanceRanks = Number(character.advances.characteristics[characteristicId] || 0);
  const advancement = advanceRanks * 5;
  const divination = divinationCharacteristicModifiers()[characteristicId] || 0;
  return {
    generated,
    advancement,
    divination,
    total: generated + advancement + divination,
  };
}

function characteristicValue(characteristicId) {
  return characteristicBreakdown(characteristicId).total;
}

function finalFateThreshold() {
  return Number(character.fate?.threshold || 0) + Number(currentDivination()?.fateChange || 0);
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
  return ["General", homeWorldRules().aptitude, backgroundAptitude, ...roleAptitudes].filter(Boolean);
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

function backgroundGrantedSkills() {
  const grants = {};
  splitGrant(ruleValue(character.background, "Starting Skills")).forEach((entry, index) => {
    const choiceId = `background-skills-${index}`;
    const selected = /\sor\s/i.test(entry) ? character.grantChoices[choiceId] : entry;
    if (!selected) return;
    const skill = skillForGrant(selected);
    if (!skill) return;
    const speciality = selected.match(/\(([^)]+)\)/)?.[1] || "";
    grants[skill.id] = {
      id: skill.id,
      name: skill.name,
      speciality,
      displayName: speciality ? `${skill.name} (${speciality})` : skill.name,
      rank: 1,
      source: catalogs.backgrounds.find((entry) => entry.id === character.background)?.name || "Background",
    };
  });
  return grants;
}

function resolvedGrantedSkills() {
  const grants = { ...backgroundGrantedSkills() };
  const divinationGrant = currentDivination()?.skillGrant;
  if (divinationGrant && !grants[divinationGrant.id]) {
    const skill = skills.find((entry) => entry.id === divinationGrant.id);
    if (skill) grants[skill.id] = { id: skill.id, name: skill.name, displayName: skill.name, speciality: "", rank: 1, source: "Divination" };
  }
  return grants;
}

function resolvedGrantedTalents() {
  const grants = {};
  const addGrant = (label, source) => {
    if (!label) return;
    const talent = talentByName(label);
    if (!talent) return;
    grants[talent.id] = { ...talent, displayName: label, source, initial: true, cost: 0 };
  };
  splitGrant(ruleValue(character.background, "Talents / Traits")).forEach((label) => addGrant(label, "Background"));
  addGrant(character.grantChoices["role-talent-0"], "Role");
  addGrant(character.grantChoices["homeworld-bonus-0"], "Home World");
  return grants;
}

function talentPrerequisiteStatus(talent) {
  const text = talent.prerequisites || "";
  if (!text) return { missing: [], parsed: true };
  const missing = [];
  let parsed = false;
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
  return { missing: [...new Set(missing)], parsed };
}

function skillRank(skillId) {
  return Math.max(Number(character.advances.skills[skillId] || 0), resolvedGrantedSkills()[skillId]?.rank || 0);
}

function skillTestTarget(skill) {
  const characteristic = characteristics.find((entry) => entry.name === skill.characteristic);
  const rank = skillRank(skill.id);
  return rank > 0 ? characteristicValue(characteristic?.id) + (rank - 1) * 10 : 0;
}

function characteristicXpCost(characteristicId) {
  const characteristic = characteristics.find((entry) => entry.id === characteristicId);
  const matches = aptitudeMatches(characteristic?.aptitudes || [], resolvedAptitudes().aptitudes);
  const rank = Number(character.advances.characteristics[characteristicId] || 0);
  return Array.from({ length: rank }, (_, index) => characteristicAdvanceCosts[matches][index]).reduce((sum, cost) => sum + cost, 0);
}

function skillXpCost(skillId) {
  const skill = skills.find((entry) => entry.id === skillId);
  const matches = aptitudeMatches(skill?.aptitudes || [], resolvedAptitudes().aptitudes);
  const freeRank = resolvedGrantedSkills()[skillId]?.rank || 0;
  const rank = skillRank(skillId);
  return Array.from({ length: Math.max(0, rank - freeRank) }, (_, offset) => skillAdvanceCosts[matches][freeRank + offset]).reduce((sum, cost) => sum + cost, 0);
}

function automaticEliteAdvances() {
  return character.role === "mystic"
    ? [{ id: "psyker", name: "Psyker", source: "Mystic Role — Stare into the Warp", cost: 0, automatic: true }]
    : [];
}

function automaticTraits() {
  const traits = [];
  if (automaticEliteAdvances().some((entry) => entry.id === "psyker")) traits.push({ name: "Psyker", source: "Psyker Elite Advance" });
  if (character.background === "astra-telepathica" && traits.some((entry) => entry.name === "Psyker")) traits.push({ name: "Sanctioned", source: "Adeptus Astra Telepathica — Tested on Terra" });
  return traits;
}

function equipmentGrantedTraits() {
  const equippedIds = new Set(Object.values(character.equipment.equipped).filter(Boolean));
  const traits = [];
  if (equippedIds.has("core-gear-photo-visors-contacts")) {
    traits.push({
      name: "Dark-sight",
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
    const freeRank = resolvedGrantedSkills()[id]?.rank || 0;
    for (let index = freeRank; index < Number(rank || 0); index += 1) {
      spent += skillAdvanceCosts[matches][index];
    }
  }
  for (const entry of character.advances.talents) {
    const talent = talentCatalogue.find((candidate) => candidate.id === entry?.id);
    spent += talent ? talentCost(talent) : Number(entry?.cost || 0);
  }
  for (const collection of [character.advances.psychicPowers, character.advances.eliteAdvances]) {
    for (const entry of collection) spent += Number(entry?.cost || 0);
  }
  return spent;
}

function save() {
  const now = new Date().toISOString();
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

function rerenderAdvancesPreservingScroll() {
  const previousShop = document.querySelector(".advance-shop");
  const previousAnchor = document.querySelector("#advance-talents");
  const anchorViewportOffset = previousShop && previousAnchor
    ? previousAnchor.offsetTop - previousShop.scrollTop
    : 0;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  render();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const shop = document.querySelector(".advance-shop");
      const anchor = document.querySelector("#advance-talents");
      if (shop && anchor) shop.scrollTop = Math.max(0, anchor.offsetTop - anchorViewportOffset);
    });
  });
}

function refreshCharacteristicDisplay(characteristicId) {
  const input = document.querySelector(`[data-manual-characteristic="${characteristicId}"]`);
  const article = input?.closest(".characteristic-entry");
  const result = character.rolls[characteristicId];
  if (!article || !result) return;
  article.classList.add("complete");
  const resultBox = article.querySelector(".characteristic-result");
  resultBox.innerHTML = `<strong>${result.value}</strong><small>Entered manually</small>`;
  const rollButton = article.querySelector(".roll-characteristic");
  if (rollButton) {
    rollButton.textContent = character.characteristicReroll === characteristicId ? "Re-roll kept" : "Use one re-roll";
    rollButton.disabled = Boolean(character.characteristicReroll);
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

function cycleChoice(direction) {
  const scene = scenes[step];
  if (!scene.catalog) return false;
  const entries = catalogs[scene.catalog];
  const current = entries.findIndex((entry) => entry.id === character[scene.id]);
  character[scene.id] = entries[(current + direction + entries.length) % entries.length].id;
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
  return `
    <label class="mobile-choice-control">
      <span>Choose ${scene.id === "homeWorld" ? "home world" : scene.id}</span>
      <select id="mobile-catalog-choice" aria-describedby="mobile-choice-help">
        ${entries.map((entry) => `<option value="${entry.id}" ${entry.id === selected.id ? "selected" : ""}>${entry.name}</option>`).join("")}
      </select>
      <small id="mobile-choice-help">Select an option to update its lore and rules below.</small>
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
    </div>`;
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
          <div>
            <dt>${label}</dt>
            <dd>${value}</dd>
          </div>`).join("")}
      </dl>
    </aside>`;
}

function renderIdentity() {
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
        <textarea name="appearance" maxlength="240" placeholder="A brief description of the Acolyte's appearance…">${character.appearance}</textarea>
      </label>
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
                <span>${entry.abbreviation}</span>
                <strong>${entry.name}</strong>
                <small>${formula}</small>
              </div>
              <div class="characteristic-result">
                <strong>${result?.value ?? "—"}</strong>
                ${result ? `<small>${result.source === "manual" ? "Entered manually" : `Dice: ${result.dice.join(", ")}`}</small>` : ""}
              </div>
              <div class="roll-actions">
                <button class="compact-button roll-characteristic" data-characteristic="${entry.id}" type="button" ${rerollUnavailable ? "disabled" : ""}>${result ? character.characteristicReroll === entry.id ? "Re-roll kept" : "Use one re-roll" : "Roll 3D Dice"}</button>
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
        ${result && (changeControls || fateControl) ? `<div class="divination-adjustments">${changeControls}${fateControl}</div>` : ""}
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

const equipmentSlots = [
  ["primary", "Primary Weapon"],
  ["secondary", "Secondary Weapon"],
  ["melee", "Melee Weapon"],
  ["armour", "Armour"],
  ["utilityOne", "Utility I"],
  ["utilityTwo", "Utility II"],
];

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

function itemFitsSlot(item, slot) {
  if (slot === "armour") return item.category === "Armour";
  if (slot === "melee") return item.category === "Weapons" && item.profile.class === "Melee";
  if (slot === "primary") return item.category === "Weapons" && ["Basic", "Heavy"].includes(item.profile.class);
  if (slot === "secondary") return item.category === "Weapons" && item.profile.class === "Pistol";
  return !["Weapons", "Armour"].includes(item.category);
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
    modifier: breakdown.divination,
    unnatural: 0,
    cost: characteristicXpCost(characteristicId),
  };
}

function foundrySkillData() {
  const payload = {};
  const specialistIds = new Set(["common-lore", "forbidden-lore", "linguistics", "navigate", "operate", "scholastic-lore", "trade"]);
  for (const skill of skills.filter((entry) => skillRank(entry.id) > 0)) {
    const foundryKey = foundryCamelCase(skill.id);
    const rank = skillRank(skill.id);
    const cost = skillXpCost(skill.id);
    const grant = resolvedGrantedSkills()[skill.id];
    const speciality = grant?.speciality || "";
    const characteristic = characteristics.find((entry) => entry.name === skill.characteristic);
    const characteristicShort = characteristic?.abbreviation || "";
    const baseRecord = {
      label: skill.name,
      characteristics: characteristicShort ? [characteristicShort] : [],
      characteristic: characteristicShort,
      advance: specialistIds.has(skill.id) ? 0 : rank,
      isSpecialist: specialistIds.has(skill.id),
      cost: specialistIds.has(skill.id) ? 0 : cost,
    };
    if (specialistIds.has(skill.id)) {
      const specialityLabel = speciality || "Unspecified";
      const specialityKey = foundryCamelCase(specialityLabel);
      payload[foundryKey] = {
        ...baseRecord,
        specialities: {
          [specialityKey]: {
            label: specialityLabel,
            advance: rank,
            cost,
            taken: true,
            custom: !speciality,
          },
        },
      };
    } else {
      payload[foundryKey] = { ...baseRecord, specialities: {} };
    }
  }
  return payload;
}

function foundryEquipmentItem(item) {
  return {
    name: item.name,
    type: item.documentType,
    system: {
      ...item.profile,
      description: item.description || item.profile?.description || "",
      availability: item.availability,
      craftsmanship: item.craftsmanship,
      weight: item.weight ?? 0,
      equipped: Object.values(character.equipment.equipped).includes(item.id),
    },
    flags: { dh2CharacterBuilder: { source: item.source, category: item.category } },
  };
}

function hasPsykerAccess() {
  return automaticEliteAdvances().some((entry) => entry.id === "psyker")
    || character.advances.eliteAdvances.some((entry) => /psyker|astropath/i.test(entry?.name || ""));
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
      if (!/\sor\s/i.test(entry)) return;
      const options = entry.split(/\s+or\s+/i)
        .map((option) => option.replace(/^.*?·\s*Gain\s+/i, "").replace(/\.$/, "").trim())
        .filter(Boolean);
      if (options.length < 2) return;
      alternatives.push({ id: `${sourceId}-${index}`, label, source: entry, options });
    });
  }
  return alternatives;
}

function renderGrants() {
  const backgroundRows = mechanicsByChoice[character.background] || [];
  const roleRows = mechanicsByChoice[character.role] || [];
  const homeRows = mechanicsByChoice[character.homeWorld] || [];
  const freeSkills = Object.values(resolvedGrantedSkills());
  const groups = [
    ["Initial Skills", freeSkills.map((skill) => `${skill.displayName} · Known · ${skill.source}`)],
    ["Talents and Traits", splitGrant(backgroundRows.find(([label]) => label === "Talents / Traits")?.[1])],
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
            <label>
              <span>${choice.label}<small>${choice.source}</small></span>
              <select data-grant-choice="${choice.id}">
                <option value="">Choose...</option>
                ${choice.options.map((option) => `<option value="${option}" ${character.grantChoices[choice.id] === option ? "selected" : ""}>${option}</option>`).join("")}
              </select>
            </label>`).join("") || "<p>No unresolved alternatives were detected.</p>"}
        </div>
      </section>
    </div>`;
}

function renderEquipment() {
  const slots = Math.max(0, characteristicBonus("influence"));
  const selected = armoury.find((item) => item.id === character.equipment.selected) || armoury[0];
  const categories = ["All", ...new Set(armoury.map((item) => item.category))];
  const inventoryItems = character.equipment.inventory.map((id) => armoury.find((item) => item.id === id)).filter(Boolean);
  const rows = itemProfileRows(selected);
  return `
    <div class="management-shell armoury-layout">
      <section class="armoury-browser">
        <div class="armoury-toolbar">
          <label><span>Search Armoury</span><input id="armoury-search" type="search" placeholder="Weapon, armour, tool..." autocomplete="off" /></label>
          <div class="armoury-categories" aria-label="Filter equipment by category">${categories.map((category) => `<button type="button" data-equipment-category="${category}" class="${category === "All" ? "active" : ""}" aria-pressed="${category === "All"}">${category}</button>`).join("")}</div>
        </div>
        <div class="armoury-list" id="armoury-list">
          ${armoury.map((item) => `
              <button class="armoury-item ${selected.id === item.id ? "selected" : ""}" type="button" data-equipment-item="${item.id}" data-equipment-search="${escapeHtmlAttribute(normaliseItemName(`${item.name} ${item.category} ${item.description}`))}" data-equipment-type="${item.category}" aria-pressed="${selected.id === item.id}">
              <span class="item-category">${item.category}</span>
              <strong>${item.name}</strong>
              <span>${effectiveAvailability(item) || "Availability not recorded"}${effectiveAvailability(item) !== item.availability ? ` (base ${item.availability})` : ""} · ${displayWeight(item)}</span>
              ${isStartingAcquisitionLegal(item) ? `<em>Starting acquisition</em>` : `<em class="restricted">Requires acquisition test</em>`}
            </button>`).join("")}
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
            <button class="primary-button add-equipment" type="button" data-add-equipment="${selected.id}" ${character.equipment.inventory.includes(selected.id) ? "disabled" : ""}>${character.equipment.inventory.includes(selected.id) ? "In Inventory" : "Add to Inventory"} <span>›</span></button>
            <button class="compact-button acquire-equipment" type="button" data-acquire-equipment="${selected.id}" ${!isStartingAcquisitionLegal(selected) || character.acquisitions.includes(selected.id) || character.acquisitions.filter(Boolean).length >= slots ? "disabled" : ""}>${character.acquisitions.includes(selected.id) ? "Acquisition Selected" : "Use Starting Acquisition"}</button>
          </div>
        </div>
        <aside class="loadout-panel">
          <div class="loadout-heading">
            <span>Influence Bonus ${characteristicBonus("influence")}</span>
            <strong>${character.acquisitions.filter(Boolean).length} / ${slots} starting acquisitions recorded</strong>
          </div>
          <div class="acquisition-picks">
            ${character.acquisitions.filter(Boolean).map((id) => {
              const item = armoury.find((entry) => entry.id === id);
              return item ? `<button type="button" data-remove-acquisition="${id}" title="Remove acquisition">${item.name}<span>×</span></button>` : "";
            }).join("") || "<span>No starting acquisitions selected.</span>"}
          </div>
          <p class="granted-line"><strong>Background:</strong> ${ruleValue(character.background, "Starting Equipment")}</p>
          ${character.equipment.legacyAcquisitions?.length ? `<div class="legacy-warning"><strong>Review previous entries:</strong> ${character.equipment.legacyAcquisitions.join("; ")}. These older free-text entries were not counted because no unambiguous Armoury match was found.<button type="button" data-clear-legacy>Dismiss old entries</button></div>` : ""}
          <div class="loadout-slots">
            ${equipmentSlots.map(([slot, label]) => {
              const equipped = armoury.find((item) => item.id === character.equipment.equipped[slot]);
              return `<label><span>${label}</span><select data-equipment-slot="${slot}"><option value="">Empty</option>${inventoryItems.filter((item) => itemFitsSlot(item, slot)).map((item) => `<option value="${item.id}" ${equipped?.id === item.id ? "selected" : ""}>${item.name}</option>`).join("")}</select></label>`;
            }).join("")}
          </div>
          <div class="inventory-strip">${inventoryItems.map((item) => `<button type="button" data-equipment-item="${item.id}">${item.name}</button>`).join("") || "<span>No items added yet.</span>"}</div>
        </aside>
      </section>
    </div>`;
}

function renderTalentShop() {
  const granted = resolvedGrantedTalents();
  const purchasedIds = new Set(character.advances.talents.map((entry) => entry.id).filter(Boolean));
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
          ...character.advances.talents.map((entry) => {
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

function renderAdvances() {
  const owned = resolvedAptitudes().aptitudes;
  const spent = xpSpent();
  const unresolved = grantAlternatives().filter((choice) => !character.grantChoices[choice.id]);
  return `
    <div class="management-shell advance-layout">
      <aside class="xp-meter">
        <span>Starting XP</span><strong>${character.xp.starting}</strong>
        <span>Spent</span><strong>${spent}</strong>
        <span>Remaining</span><strong class="${spent > character.xp.starting ? "invalid" : ""}">${character.xp.starting - spent}</strong>
      </aside>
      <section class="advance-shop">
        ${unresolved.length ? `<div class="advance-warning"><strong>Starting choices incomplete</strong><span>Return to Starting Abilities and resolve ${unresolved.length} granted alternative${unresolved.length === 1 ? "" : "s"} before purchasing advances.</span></div>` : ""}
        <nav class="advance-nav"><button type="button" data-advance-jump="advance-characteristics">Characteristics</button><button type="button" data-advance-jump="advance-skills">Skills</button><button type="button" data-advance-jump="advance-talents">Talents</button>${hasPsykerAccess() ? `<button type="button" data-advance-jump="advance-psychic">Psychic</button>` : ""}<button type="button" data-advance-jump="advance-elite">Optional Elite Paths</button></nav>
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
          ${skills.map((skill) => {
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
        ${renderTalentShop()}
        ${hasPsykerAccess() ? `
          <section id="advance-psychic" class="conditional-advances">
            <p class="choice-source">Psyker access detected</p>
            <h2>Psychic Powers and Psy Rating</h2>
            <div class="other-advances">
              ${[["psychicPowers", "Psychic Power"]].map(([type, label]) => {
                const entry = character.advances[type][0] || {};
                return `<label><span>${label}</span><input data-other-name="${type}" aria-label="${label} name" value="${entry.name || ""}" placeholder="Enter selected ${label.toLowerCase()}" /><input data-other-cost="${type}" aria-label="${label} XP cost" type="number" min="0" step="50" value="${entry.cost || ""}" placeholder="XP" /></label>`;
              }).join("")}
            </div>
          </section>` : ""}
        <details class="elite-advances" id="advance-elite">
          <summary><span>Optional — most characters skip this</span><strong>Elite Advances</strong><em>Special character paths, not a required creation step.</em></summary>
          <div class="elite-explanation">
            <p>Elite Advances are exceptional packages with their own prerequisites and costs. Do not select one merely to finish the character.</p>
            ${automaticEliteAdvances().length ? `<div class="automatic-elite"><strong>Granted automatically</strong>${automaticEliteAdvances().map((entry) => `<span>${entry.name} · 0 XP<br><small>${entry.source}</small></span>`).join("")}</div>` : `<p class="elite-none">This character has no automatically granted Elite Advance.</p>`}
            <div class="elite-path-list">
              ${catalogs.eliteAdvances.map((entry) => `<span>${entry.name}<small>${entry.source}</small></span>`).join("")}
            </div>
            ${character.advances.eliteAdvances.length ? `<div class="legacy-warning"><strong>Previously entered Elite Advance:</strong> ${character.advances.eliteAdvances.map((entry) => `${entry.name || "Unnamed"} (${entry.cost || 0} XP)`).join("; ")}.</div>` : ""}
          </div>
        </details>
      </section>
    </div>`;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function rosterChoiceName(catalogue, id) {
  return catalogs[catalogue].find((entry) => entry.id === id)?.name || "Not selected";
}

function rosterProgress(record) {
  const currentStep = Math.min(scenes.length - 1, Math.max(0, Number(record.step || 0)));
  return {
    currentStep,
    label: currentStep >= scenes.length - 1 ? "Review ready" : scenes[currentStep]?.title || "In progress",
    percentage: Math.round(((currentStep + 1) / scenes.length) * 100),
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
        compendiumLoadError = "Connect your four sourcebooks to build this browser’s private rules library. The files and extracted index stay on this device.";
      }
    } catch (error) {
      compendiumLoadError = error.message || "This browser’s private rules library could not be opened.";
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
    const initials = lines[index].trim().match(/^[A-Z](?:\s+[A-Z])*$/)
      ? lines[index].trim().split(/\s+/)
      : [];
    const fragments = String(lines[index + 1] || "").trim().match(/^[A-Z]{2,}(?:\s+[A-Z]{2,})*$/)
      ? lines[index + 1].trim().split(/\s+/)
      : [];
    if (initials.length && initials.length === fragments.length) {
      repaired.push(initials.map((initial, tokenIndex) => `${initial}${fragments[tokenIndex]}`).join(" "));
      index += 1;
      continue;
    }
    repaired.push(lines[index]);
  }
  return repaired.join("\n");
}

function normalizeErraticSmallCaps(value) {
  return String(value)
    .replace(/\b[A-Za-z]{3,}\b/g, (word) => {
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
        <div class="sigil" aria-hidden="true"><span></span></div>
        <div class="brand"><strong>Dark Heresy Rules Library</strong><span>Compendium</span></div>
        <button class="roster-button" id="return-to-roster" type="button">Acolyte Archive</button>
        <label class="text-size-control" title="Interface text size">
          <span aria-hidden="true">TEXT</span>
          <input id="text-size" type="range" min="85" max="150" step="5" value="${Math.round(textScale * 100)}" aria-label="Interface text size" />
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
  document.querySelector("#return-to-roster")?.addEventListener("click", () => {
    appView = "roster";
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

const compendiumTooltipTerms = [...contextualRuleTerms, ...coreRuleTerms]
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
  const lines = restoreCollapsedSpelling(normalizeErraticSmallCaps(restoreDetachedInitials(restoreSplitSmallCapsLines(String(text || "")))))
    .replace(/\bE\s+XAMPLE\b/gi, "EXAMPLE")
    .replace(/\bS\s+KILL TESTS\b/gi, "SKILL TESTS")
    .replace(/\bC\s+HARACTERISTIC T\s+ESTS\b/gi, "CHARACTERISTIC TESTS")
    .replace(/\bS\s+KILLS,\s*T\s+ALENTS,\s*T?\s*AND R\s+AITS\b/gi, "SKILLS, TALENTS, AND TRAITS")
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
              <span>Printed page ${escapeHtmlAttribute(page.printedPage)}</span>
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
        </div>
        <p class="sourcebook-privacy">Processing and storage happen only in this browser. Sourcebook files and extracted text are not sent to GitHub, Supabase, or other players.</p>
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
        <div class="sigil" aria-hidden="true"><span></span></div>
        <div class="brand"><strong>Dark Heresy Rules Library</strong><span>Compendium</span></div>
        <button class="roster-button" id="return-to-roster" type="button">Acolyte Archive</button>
        ${hostedEdition && compendiumData ? `<button class="compact-button sourcebook-control" id="replace-sourcebooks" type="button">Manage Sourcebooks</button>` : ""}
        <label class="text-size-control" title="Interface text size">
          <span aria-hidden="true">TEXT</span>
          <input id="text-size" type="range" min="85" max="150" step="5" value="${Math.round(textScale * 100)}" aria-label="Interface text size" />
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
  document.querySelector("#return-to-roster")?.addEventListener("click", () => {
    appView = "roster";
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
  document.querySelector("#replace-sourcebooks")?.addEventListener("click", async () => {
    if (!confirm("Disconnect the sourcebook index from this browser? Character and campaign data will not be affected.")) return;
    await clearStoredSourcebookLibrary();
    compendiumData = null;
    compendiumLoadError = "Connect your four sourcebooks to rebuild this browser’s private rules library.";
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
  const aliases = coreRuleTerms
    .flatMap((entry) => [entry.term, ...entry.aliases].map((alias) => ({ alias, id: entry.id })))
    .sort((a, b) => b.alias.length - a.alias.length);
  const pattern = new RegExp(`\\b(${aliases.map(({ alias }) => alias.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")).join("|")})\\b`, "i");
  const aliasMap = new Map(aliases.map(({ alias, id }) => [alias.toLowerCase(), id]));
  const highlighted = new Set();
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (!node.nodeValue?.trim()) continue;
    if (node.parentElement?.closest("button,input,textarea,select,option,a,.choice-source,.rule-term")) continue;
    const match = node.nodeValue.match(pattern);
    if (!match) continue;
    const id = aliasMap.get(match[0].toLowerCase());
    if (!id || highlighted.has(id)) continue;
    highlighted.add(id);
    const before = node.nodeValue.slice(0, match.index);
    const after = node.nodeValue.slice(match.index + match[0].length);
    const fragment = document.createDocumentFragment();
    fragment.append(before);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rule-term";
    button.dataset.ruleTerm = id;
    button.textContent = match[0];
    button.setAttribute("aria-label", `${match[0]}: open quick rule`);
    fragment.append(button, after);
    node.replaceWith(fragment);
  }
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

function renderRoster() {
  const orderedRecords = [...characterLibrary].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  root.innerHTML = `
    <a class="skip-link" href="#roster-content">Skip to character roster</a>
    <main class="roster-scene theme-assessment">
      <div class="roster-art" aria-hidden="true"></div>
      <header class="topbar roster-topbar">
        <div class="sigil" aria-hidden="true"><span></span></div>
        <div class="brand"><strong>Dark Heresy Character Creation</strong><span>Acolyte Archive</span></div>
        <button class="credits-button" id="credits" type="button">Source & credits</button>
        <label class="text-size-control" title="Interface text size">
          <span aria-hidden="true">TEXT</span>
          <input id="text-size" type="range" min="85" max="150" step="5" value="${Math.round(textScale * 100)}" aria-label="Interface text size" />
          <output id="text-size-value" for="text-size">${Math.round(textScale * 100)}%</output>
        </label>
      </header>
      <section class="roster-content" id="roster-content" tabindex="-1">
        <div class="roster-heading">
          <div>
            <p class="eyebrow">Acolyte Archive</p>
            <h1>Your Characters</h1>
            <p class="lede">Continue an Acolyte, preserve another version, or import a character shared by a friend.</p>
          </div>
          <div class="roster-actions">
            <button class="primary-button" id="new-character" type="button">Create Acolyte <span>›</span></button>
            <button class="compact-button" id="open-compendium" type="button">Rules Compendium</button>
            <button class="compact-button" id="shared-archive" type="button">${savedCampaignConnection() ? "Shared Campaign" : "Connect Campaign"}</button>
            <button class="compact-button" id="import-character" type="button">Import Shared Character</button>
            <input class="sr-only" id="character-file" type="file" accept=".json,application/json" />
          </div>
        </div>
        <div class="roster-notice" role="status">
          <strong>${cloudStatus === "connected" ? "Shared campaign synchronized" : repositoryStatus === "ready" ? "Local repository" : "Browser backup"}</strong>
          <span>${cloudStatus === "connected"
            ? `Changes synchronize automatically with campaign ${escapeHtmlAttribute(savedCampaignConnection()?.campaignId || "")}. Local recovery copies remain enabled.`
            : cloudStatus === "unconfigured"
              ? "Shared storage awaits its Supabase public configuration. Local file and browser recovery copies remain enabled."
              : repositoryStatus === "ready"
                ? "Characters are stored as separate files by this app, with a browser backup for recovery. Connect a campaign to synchronize with other players."
                : "Characters are safe in this browser. Connect a shared campaign for cross-device synchronization."}</span>
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
                <div class="roster-progress" aria-label="${progress.percentage}% complete">
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
          }).join("") || `<div class="empty-roster"><h2>No Acolytes recorded</h2><p>Create the first character or import one supplied by a friend.</p></div>`}
        </div>
      </section>
      <footer class="roster-footer">
        <span>Unofficial game aid</span>
        <span>Games Workshop · Fantasy Flight Games · Sourcebook artists credited in project notes</span>
      </footer>
    </main>
    <dialog id="credits-dialog" aria-labelledby="credits-dialog-title">
      <button class="dialog-close" aria-label="Close credits">×</button>
      <p class="eyebrow">Credits and attribution</p>
      <h2 id="credits-dialog-title">Source & credits</h2>
      <p>Dark Heresy, Warhammer 40,000, and associated settings and sourcebook material belong to their respective rights holders. Original universe by Games Workshop; Dark Heresy Second Edition published by Fantasy Flight Games.</p>
      <p class="credit-small">Sourcebook illustrations remain the work of their credited artists. Individual image, artist, book, and page provenance is recorded in the local project notes.</p>
    </dialog>
    <dialog id="shared-dialog" aria-labelledby="shared-dialog-title">
      <button class="dialog-close" aria-label="Close shared campaign">×</button>
      <p class="eyebrow">Automatic character synchronization</p>
      <h2 id="shared-dialog-title">Shared Campaign</h2>
      ${cloudIsConfigured() ? savedCampaignConnection() ? `
        <p>This device is connected as <strong>${escapeHtmlAttribute(savedCampaignConnection().displayName)}</strong>.</p>
        <label>Campaign ID<input id="connected-campaign-id" value="${escapeHtmlAttribute(savedCampaignConnection().campaignId)}" readonly /></label>
        <div class="dialog-actions">
          <button class="compact-button" id="copy-campaign-id" type="button">Copy Campaign ID</button>
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
      const result = await createSharedCampaign({
        name: values.get("campaignName"),
        inviteCode: values.get("inviteCode"),
        displayName: values.get("displayName"),
      });
      for (const record of characterLibrary) await saveCloudCharacter(record);
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
      await connectToCampaign({
        campaignId: values.get("campaignId"),
        inviteCode: values.get("inviteCode"),
        displayName: values.get("displayName"),
      });
      for (const record of characterLibrary) await saveCloudCharacter(record);
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

function renderReview() {
  const spent = xpSpent();
  const missingCharacteristics = characteristics.filter((entry) => !character.rolls[entry.id]?.value);
  const unresolvedAptitudes = resolvedAptitudes().duplicateCount - character.aptitudeReplacements.filter(Boolean).length;
  const unresolvedDivinationChoices = (currentDivination()?.statChanges || [])
    .filter((change) => !change.target && !character.divination.statChoices?.[change.id]);
  const unresolvedGrantChoices = grantAlternatives().filter((choice) => !character.grantChoices[choice.id]);
  const divinationModifiers = divinationCharacteristicModifiers();
  const ownedSkills = skills.filter((skill) => skillRank(skill.id) > 0);
  const initialTalents = Object.values(resolvedGrantedTalents());
  const purchasedTalents = character.advances.talents.map((entry) => talentCatalogue.find((talent) => talent.id === entry.id)).filter(Boolean);
  const inventoryItems = character.equipment.inventory.map((id) => armoury.find((item) => item.id === id)).filter(Boolean);
  const acquisitionItems = character.acquisitions.map((id) => armoury.find((item) => item.id === id)).filter(Boolean);
  const xpLedger = [
    ...characteristics.filter((entry) => Number(character.advances.characteristics[entry.id] || 0) > 0).map((entry) => [`${entry.name} +${Number(character.advances.characteristics[entry.id]) * 5}`, characteristicXpCost(entry.id)]),
    ...ownedSkills.filter((skill) => skillXpCost(skill.id) > 0).map((skill) => [`${skill.name} · ${rankNames[skillRank(skill.id) - 1]}`, skillXpCost(skill.id)]),
    ...purchasedTalents.map((talent) => [talent.name, talentCost(talent)]),
    ...character.advances.psychicPowers.filter((entry) => entry?.name).map((entry) => [entry.name, Number(entry.cost || 0)]),
    ...character.advances.eliteAdvances.filter((entry) => entry?.name).map((entry) => [entry.name, Number(entry.cost || 0)]),
  ];
  const abilityEntries = [
    ["Home World", ruleValue(character.homeWorld, "Home World Bonus")],
    ["Background", ruleValue(character.background, "Background Bonus")],
    ["Role", ruleValue(character.role, "Role Bonus")],
    ["Talents / Traits", ruleValue(character.background, "Talents / Traits")],
  ].filter(([, value]) => value);
  const warnings = [
    missingCharacteristics.length ? `${missingCharacteristics.length} characteristics have no result.` : "",
    !character.fate.roll ? "Fate roll has not been recorded." : "",
    !character.wounds.total && !character.wounds.dice?.length ? "Wounds have not been recorded." : "",
    !character.divination.roll ? "Divination has not been rolled or entered." : "",
    unresolvedDivinationChoices.length ? `${unresolvedDivinationChoices.length} Divination characteristic choice${unresolvedDivinationChoices.length === 1 ? "" : "s"} remain.` : "",
    unresolvedGrantChoices.length ? `${unresolvedGrantChoices.length} granted alternative${unresolvedGrantChoices.length === 1 ? "" : "s"} remain.` : "",
    unresolvedAptitudes > 0 ? `${unresolvedAptitudes} duplicate aptitude replacements remain.` : "",
    spent > character.xp.starting ? `XP is overspent by ${spent - character.xp.starting}.` : "",
  ].filter(Boolean);
  return `
    <div class="management-shell review-layout">
      <section class="review-dossier">
        <p class="choice-source">${character.name || "Unnamed Acolyte"}</p>
        <h2>${catalogs.homeWorlds.find((entry) => entry.id === character.homeWorld).name} · ${catalogs.backgrounds.find((entry) => entry.id === character.background).name} · ${catalogs.roles.find((entry) => entry.id === character.role).name}</h2>
        <div class="review-characteristics">${characteristics.map((entry) => {
          const breakdown = characteristicBreakdown(entry.id);
          const parts = [
            breakdown.generated ? `Generated ${breakdown.generated}` : "",
            breakdown.advancement ? `Advances +${breakdown.advancement}` : "",
            breakdown.divination ? `Divination ${breakdown.divination > 0 ? "+" : ""}${breakdown.divination}` : "",
          ].filter(Boolean);
          return `<div class="${breakdown.divination ? "modified" : ""}" title="${parts.join(" · ")}"><span>${entry.abbreviation}</span><strong>${breakdown.total || "—"}</strong>${parts.length > 1 ? `<small>${parts.slice(1).join(" · ")}</small>` : ""}</div>`;
        }).join("")}</div>
        ${Object.keys(divinationModifiers).length || currentDivination()?.fateChange ? `<div class="calculation-note"><strong>Divination applied:</strong> ${[
          ...Object.entries(divinationModifiers).map(([id, amount]) => `${characteristics.find((entry) => entry.id === id)?.name || id} ${amount > 0 ? "+" : ""}${amount}`),
          currentDivination()?.fateChange ? `Fate Threshold +${currentDivination().fateChange}` : "",
        ].filter(Boolean).join(" · ")}</div>` : ""}
        <div class="review-meta">
          <span>Fate <strong>${character.fate.roll ? finalFateThreshold() : "—"}</strong></span>
          <span>Wounds <strong>${character.wounds.total || "—"}</strong></span>
          <span>Fatigue Threshold <strong>${characteristicBonus("toughness") + characteristicBonus("willpower")}</strong></span>
          <span>Move <strong>${characteristicBonus("agility")} / ${characteristicBonus("agility") * 2} / ${characteristicBonus("agility") * 3} / ${characteristicBonus("agility") * 6}</strong></span>
          <span>XP <strong>${spent} / ${character.xp.starting}</strong></span>
        </div>
        <div class="review-sections">
          <section>
            <h3>Identity and Origin</h3>
            <div class="dossier-list">
              <div><strong>Player</strong><span>${character.player || "Not recorded"}</span></div>
              <div><strong>Presentation</strong><span>${character.presentation || "Not recorded"}</span></div>
              <div><strong>Appearance</strong><span>${character.appearance || "Not recorded"}</span></div>
              <div><strong>Home World</strong><span>${catalogs.homeWorlds.find((entry) => entry.id === character.homeWorld)?.name}</span></div>
              <div><strong>Background</strong><span>${catalogs.backgrounds.find((entry) => entry.id === character.background)?.name}</span></div>
              <div><strong>Role</strong><span>${catalogs.roles.find((entry) => entry.id === character.role)?.name}</span></div>
            </div>
          </section>
          <section>
            <h3>Aptitudes</h3>
            <div class="tag-list final">${resolvedAptitudes().aptitudes.map((aptitude) => `<span>${aptitude}</span>`).join("")}</div>
          </section>
          <section>
            <h3>Skills</h3>
            <div class="dossier-list">${ownedSkills.map((skill) => {
              const grant = resolvedGrantedSkills()[skill.id];
              return `<div><strong>${grant?.displayName || skill.name}</strong><span>${rankNames[skillRank(skill.id) - 1]} · Test ${skillTestTarget(skill)}</span><em>${grant ? `Initial · ${grant.source}` : `${skillXpCost(skill.id)} XP`}</em></div>`;
            }).join("") || "<p>None recorded.</p>"}</div>
          </section>
          <section>
            <h3>Talents</h3>
            <div class="dossier-list">${[
              ...initialTalents.map((talent) => `<div><strong>${talent.displayName}</strong><span>${talent.benefit}</span><em>Initial · ${talent.source}</em></div>`),
              ...purchasedTalents.map((talent) => `<div><strong>${talent.name}</strong><span>${talent.benefit}</span><em>${talentCost(talent)} XP</em></div>`),
            ].join("") || "<p>None recorded.</p>"}</div>
          </section>
          <section>
            <h3>Traits and Special Abilities</h3>
            <div class="dossier-list">${[
              ...[...automaticTraits(), ...equipmentGrantedTraits()].map((trait) => `<div><strong>${trait.name}</strong><span>${trait.source}</span><em>${trait.conditional ? "Equipment Trait" : "Automatic Trait"}</em></div>`),
              ...abilityEntries.map(([source, value]) => `<div><strong>${source}</strong><span>${value}</span></div>`),
            ].join("")}</div>
          </section>
          <section>
            <h3>Elite Advances</h3>
            <div class="dossier-list">${[
              ...automaticEliteAdvances().map((entry) => `<div><strong>${entry.name}</strong><span>${entry.source}</span><em>Automatic · 0 XP</em></div>`),
              ...character.advances.eliteAdvances.filter((entry) => entry?.name).map((entry) => `<div><strong>${entry.name}</strong><span>Optional Elite Advance</span><em>${entry.cost || 0} XP</em></div>`),
            ].join("") || "<p>None. Elite Advances are optional and are not required to complete this character.</p>"}</div>
          </section>
          <section>
            <h3>Equipment and Loadout</h3>
            <div class="loadout-review">${equipmentSlots.map(([slot, label]) => {
              const item = armoury.find((entry) => entry.id === character.equipment.equipped[slot]);
              return `<div><span>${label}</span><strong>${item?.name || "Empty"}</strong></div>`;
            }).join("")}</div>
            <div class="dossier-list compact">${inventoryItems.map((item) => `<div><strong>${item.name}</strong><span>${item.category} · ${effectiveAvailability(item)} · ${displayWeight(item)}</span>${acquisitionItems.some((entry) => entry.id === item.id) ? "<em>Starting Acquisition</em>" : ""}</div>`).join("") || "<p>No inventory recorded.</p>"}</div>
          </section>
          <section>
            <h3>Divination</h3>
            <div class="dossier-list"><div><strong>${currentDivination()?.title || "Not recorded"}</strong><span>${currentDivination()?.effect || ""}</span><em>${character.divination.roll ? `Roll ${character.divination.roll}` : ""}</em></div></div>
          </section>
          <section>
            <h3>XP Ledger</h3>
            <div class="xp-ledger">${xpLedger.map(([name, cost]) => `<div><span>${name}</span><strong>${cost} XP</strong></div>`).join("") || "<p>No XP purchases recorded.</p>"}<div class="total"><span>Remaining</span><strong>${character.xp.starting - spent} XP</strong></div></div>
          </section>
        </div>
      </section>
      <aside class="validation-panel">
        <h2>Validation</h2>
        <button class="primary-button save-to-roster" type="button">Save to Archive <span>›</span></button>
        ${warnings.length ? warnings.map((warning) => `<p class="warning">${warning}</p>`).join("") : `<p class="valid">Character creation record is complete.</p>`}
        <button class="primary-button export-builder" type="button">Export Builder JSON <span>›</span></button>
        <button class="compact-button export-foundry" type="button">Export Foundry Actor</button>
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
  if (appView === "compendium") {
    renderCompendium();
    return;
  }
  const scene = scenes[step];
  const isIdentity = scene.id === "identity";
  const unresolvedStageGrants = ["grants", "advances"].includes(scene.id) ? grantAlternatives().filter((choice) => !character.grantChoices[choice.id]) : [];
  const selected = selectedEntry(scene, character);
  const sceneArt = hostedEdition ? null : selected ? artByChoice[selected.id] : stageArtById[scene.id] || null;
  const framing = selected ? artFramingByChoice[selected.id] : null;
  const imageStyle = sceneArt
    ? `--scene-image: url('${sceneArt}'); --scene-size: ${framing?.size || "cover"}; --scene-position: ${framing?.position || "68% center"}`
    : "";
  root.innerHTML = `
    <a class="skip-link" href="#scene-content">Skip to current step</a>
    <main class="scene scene-${scene.id} theme-${scene.theme} ${selected ? "has-selection" : ""} ${!scene.catalog && !isIdentity ? "management-scene" : ""}" style="${imageStyle}">
      <div class="scene-art" aria-hidden="true"></div>
      <div class="fog fog-one" aria-hidden="true"></div>
      <div class="fog fog-two" aria-hidden="true"></div>
      <div class="smoke smoke-one" aria-hidden="true"></div>
      <div class="smoke smoke-two" aria-hidden="true"></div>
      <div class="signal-scan" aria-hidden="true"></div>
      <div class="grain" aria-hidden="true"></div>

      <header class="topbar">
        <div class="sigil" aria-hidden="true"><span></span></div>
        <div class="brand">
          <strong>Dark Heresy Character Creation</strong>
          <span>Create an Acolyte</span>
        </div>
        <button class="roster-button" id="open-roster" type="button">Acolyte Archive</button>
        <button class="roster-button compendium-button" id="open-compendium" type="button">Rules Compendium</button>
        <button class="credits-button" id="credits" type="button">Source & credits</button>
        <div class="audio-controls">
          <button class="vfx-toggle" id="vfx-toggle" type="button" title="Change decorative animation quality">VFX ${vfxMode === "low" ? "LOW" : "HIGH"}</button>
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
            <input id="text-size" type="range" min="85" max="150" step="5"
              value="${Math.round(textScale * 100)}" aria-label="Interface text size" />
            <output id="text-size-value" for="text-size">${Math.round(textScale * 100)}%</output>
          </label>
        </div>
      </header>

      <section class="content ${!scene.catalog && !isIdentity ? "management-content" : ""}" id="scene-content" tabindex="-1">
        <p class="eyebrow">${scene.eyebrow}</p>
        ${scene.kicker ? `<p class="kicker">${scene.kicker}</p>` : selected ? `<p class="kicker">${selected.name}</p>` : ""}
        <h1 id="scene-title">${scene.title}</h1>
        <p class="lede">${scene.copy}</p>
        ${renderStageBody(scene, selected)}
        ${selected ? renderMechanics(selected) : ""}
      </section>

      <aside class="record" aria-label="Current character record">
        <span>Acolyte</span>
        <strong>${character.name || "Designation pending"}</strong>
        <p>${step > 0 ? catalogs.homeWorlds.find(x => x.id === character.homeWorld)?.name : "Home World not chosen"}</p>
        <p>${step > 1 ? catalogs.backgrounds.find(x => x.id === character.background)?.name : "Background not chosen"}</p>
        <p>${step > 2 ? catalogs.roles.find(x => x.id === character.role)?.name : "Role not chosen"}</p>
      </aside>

      <footer class="controls" aria-label="Character creation navigation">
        <button class="text-button" id="back" ${step === 0 ? "disabled" : ""}>Back</button>
        <div class="progress" aria-label="Step ${step + 1} of ${scenes.length}">
          ${scenes.map((entry, index) => `<i class="${index === step ? "active" : index < step ? "done" : ""}" ${index === step ? 'aria-current="step"' : ""}><span class="sr-only">${entry.title}${index === step ? ", current step" : index < step ? ", completed" : ""}</span></i>`).join("")}
        </div>
        <div class="actions">
          ${isIdentity ? "" : `<button class="text-button" id="details">Rules</button>`}
          <button class="primary-button" id="continue" ${unresolvedStageGrants.length ? `disabled title="Resolve ${unresolvedStageGrants.length} granted choice${unresolvedStageGrants.length === 1 ? "" : "s"} first"` : ""}>${unresolvedStageGrants.length ? `Resolve ${unresolvedStageGrants.length} Choice${unresolvedStageGrants.length === 1 ? "" : "s"}` : scene.action}<span>›</span></button>
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

    <dialog id="credits-dialog" aria-labelledby="credits-dialog-title">
      <button class="dialog-close" aria-label="Close credits">×</button>
      <p class="eyebrow">Credits and attribution</p>
      <h2 id="credits-dialog-title">Source & credits</h2>
      <p>Dark Heresy, Warhammer 40,000, and all associated marks, settings, and sourcebook material belong to their respective rights holders. Original game and universe by Games Workshop; Dark Heresy Second Edition published by Fantasy Flight Games.</p>
      <p class="credit-small"><strong>Game creators:</strong> Dark Heresy originally designed by Owen Barnes, Kate Flack, and Mike Mason. Dark Heresy Second Edition designed by Andrew Fischer and produced by Tim Huckelbery.</p>
      ${hostedEdition ? "" : `<p class="credit-small"><strong>Soundtrack:</strong> “Dark Heresy — Roleplaying Game Ambient Music Mix,” supplied by the user for local playback.</p>`}
      <p class="credit-small">Sourcebook illustrations remain the work of their credited artists. Individual image, artist, book, and page credits are recorded in the local project notes as artwork is added. This unofficial prototype is not endorsed by or affiliated with Games Workshop or Fantasy Flight Games.</p>
      <details class="artist-credits">
        <summary>View credited Core Rulebook interior artists</summary>
        <p>David Ardila, A.L. Ashbaugh, Jacob Atienza, Cristi Balanescu, Lin Bo, Alex Boca, Matt Bradbury, Filip Burburan, Jon Cave, Anna Christenson, Alexandre Dainche, Mauro Dal Bo, Vincent Devault, Guillaume Ducos, Álvaro Calvo Escudero, Zack Graves, Ilich Henriquez, Imaginary FS Pte Ltd, Toni Justamante Jacobs, Nicholas Kay, Julian Kok, Anton Kokarev, Mathias Kollros, Alex Konstad, Sam Lamont, Clint Langley, Ignacio Bazán Lazcano, Diego Gisbert Llorens, Henning Ludvigsen, Mark Molnar, David Auden Nash, Niten, Hector Ortiz, Shane Pierce, Yos Bayu Pratama, Neil Roberts, Michael Rookard, Martin de Diego Sádaba, Christian Schwager, Stephen Somers, Ray Swanland, Theo Sylinades, Thrung, Eric Tranchefeux, Ben Zweifel, and the Games Workshop Design Studio.</p>
      </details>
    </dialog>

    <dialog id="rule-dialog" class="rule-dialog" aria-labelledby="rule-dialog-title">
      <button class="dialog-close" aria-label="Close quick rule">×</button>
      <p class="eyebrow">Core Rule</p>
      <h2 id="rule-dialog-title">Rule reference</h2>
      <p id="rule-dialog-summary"></p>
      <p class="source-note" id="rule-dialog-source"></p>
      <button class="primary-button" id="rule-dialog-open" type="button">Open in Compendium <span>›</span></button>
    </dialog>`;

  wireEvents();
  requestAnimationFrame(() => {
    applyRuleHighlights();
    applyTextScale();
    if (pendingFocusSelector) {
      const focusTarget = document.querySelector(pendingFocusSelector);
      pendingFocusSelector = "";
      focusTarget?.focus({ preventScroll: true });
    }
  });
}

function wireEvents() {
  document.querySelector("#open-roster")?.addEventListener("click", () => {
    appView = "roster";
    save();
    render();
  });
  document.querySelector("#open-compendium")?.addEventListener("click", () => {
    appView = "compendium";
    save();
    render();
  });
  document.querySelector("#vfx-toggle").addEventListener("click", () => {
    vfxMode = vfxMode === "low" ? "high" : "low";
    localStorage.setItem("dh2-vfx-mode", vfxMode);
    document.documentElement.dataset.vfx = vfxMode;
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
    character[event.target.name] = event.target.value;
    save();
    document.querySelector(".record strong").textContent = character.name || "Designation pending";
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
      document.querySelector("#detail-dialog").showModal();
    }
  });

  const scene = scenes[step];
  if (scene.catalog) {
    document.querySelector("#previous-choice").addEventListener("click", () => cycleChoice(-1));
    document.querySelector("#next-choice").addEventListener("click", () => cycleChoice(1));
    document.querySelectorAll(".catalog-slot").forEach((slot) => {
      slot.addEventListener("click", () => {
        if (character[scene.id] === slot.dataset.choiceId) return;
        character[scene.id] = slot.dataset.choiceId;
        playMechanicalLock();
        pendingFocusSelector = `[data-choice-id="${slot.dataset.choiceId}"]`;
        save();
        render();
      });
    });
    document.querySelector("#mobile-catalog-choice")?.addEventListener("change", (event) => {
      if (character[scene.id] === event.target.value) return;
      character[scene.id] = event.target.value;
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
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 20 || value > 50) return;
      const id = input.dataset.manualCharacteristic;
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
  document.querySelector("#manual-fate")?.addEventListener("change", (event) => {
    const value = Number(event.target.value);
    const rules = homeWorldRules();
    character.fate = {
      roll: value,
      source: "manual",
      threshold: rules.fate.threshold + (value >= rules.fate.blessing ? 1 : 0),
    };
    save();
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
  document.querySelector("#manual-wounds")?.addEventListener("change", (event) => {
    character.wounds = { total: Number(event.target.value), dice: [], source: "manual" };
    save();
    render();
  });
  document.querySelector("#roll-divination")?.addEventListener("click", async () => {
    const dice = await rollVisualDice(1, 100);
    const value = dice[0];
    character.divination = { roll: value, dice, source: "local-3d", result: divinationFor(value), statChoices: {} };
    save();
    render();
  });
  document.querySelector("#manual-divination")?.addEventListener("change", (event) => {
    const value = Math.min(100, Math.max(1, Number(event.target.value)));
    character.divination = { roll: value, dice: [], source: "manual", result: divinationFor(value), statChoices: {} };
    save();
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
      character.grantChoices[select.dataset.grantChoice] = select.value;
      save();
      render();
    });
  });
  const filterArmoury = () => {
    const query = normaliseItemName(document.querySelector("#armoury-search")?.value || "");
    const category = document.querySelector("[data-equipment-category].active")?.dataset.equipmentCategory || "All";
    document.querySelectorAll(".armoury-item").forEach((item) => {
      item.hidden = !(item.dataset.equipmentSearch.includes(query) && (category === "All" || item.dataset.equipmentType === category));
    });
  };
  document.querySelector("#armoury-search")?.addEventListener("input", filterArmoury);
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
      render();
    });
  });
  document.querySelector("[data-add-equipment]")?.addEventListener("click", (event) => {
    playMechanicalLock();
    const id = event.currentTarget.dataset.addEquipment;
    if (!character.equipment.inventory.includes(id)) character.equipment.inventory.push(id);
    save();
    render();
  });
  document.querySelector("[data-acquire-equipment]")?.addEventListener("click", (event) => {
    playMechanicalLock();
    const id = event.currentTarget.dataset.acquireEquipment;
    if (!character.acquisitions.includes(id)) character.acquisitions.push(id);
    if (!character.equipment.inventory.includes(id)) character.equipment.inventory.push(id);
    save();
    render();
  });
  document.querySelectorAll("[data-remove-acquisition]").forEach((button) => {
    button.addEventListener("click", () => {
      playMechanicalLock();
      character.acquisitions = character.acquisitions.filter((id) => id !== button.dataset.removeAcquisition);
      save();
      render();
    });
  });
  document.querySelector("[data-clear-legacy]")?.addEventListener("click", () => {
    character.equipment.legacyAcquisitions = [];
    save();
    render();
  });
  document.querySelectorAll("[data-equipment-slot]").forEach((select) => {
    select.addEventListener("change", () => {
      playMechanicalLock();
      character.equipment.equipped[select.dataset.equipmentSlot] = select.value;
      save();
    });
  });
  document.querySelectorAll("[data-characteristic-advance]").forEach((select) => {
    select.addEventListener("change", () => {
      playMechanicalLock();
      character.advances.characteristics[select.dataset.characteristicAdvance] = Number(select.value);
      save();
      render();
    });
  });
  document.querySelectorAll("[data-skill-advance]").forEach((select) => {
    select.addEventListener("change", () => {
      playMechanicalLock();
      character.advances.skills[select.dataset.skillAdvance] = Number(select.value);
      save();
      render();
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
  document.querySelectorAll("[data-other-name],[data-other-cost]").forEach((input) => {
    input.addEventListener("input", () => {
      const type = input.dataset.otherName || input.dataset.otherCost;
      const entry = character.advances[type][0] || { name: "", cost: 0 };
      if (input.dataset.otherName) entry.name = input.value;
      else entry.cost = Number(input.value || 0);
      character.advances[type][0] = entry;
      save();
      if (input.dataset.otherCost) refreshXpMeter();
    });
  });
  document.querySelector(".export-builder")?.addEventListener("click", () => {
    downloadJson(`${character.name || "acolyte"}.dh2-character.json`, {
      format: "dh2-character-builder",
      version: 1,
      exportedAt: new Date().toISOString(),
      character,
      calculated: {
        characteristicValues: Object.fromEntries(characteristics.map((entry) => [entry.id, characteristicValue(entry.id)])),
        characteristicBreakdowns: Object.fromEntries(characteristics.map((entry) => [entry.id, characteristicBreakdown(entry.id)])),
        divinationModifiers: divinationCharacteristicModifiers(),
        fateThreshold: finalFateThreshold(),
        aptitudes: resolvedAptitudes().aptitudes,
        skills: Object.fromEntries(skills.filter((skill) => skillRank(skill.id) > 0).map((skill) => [skill.id, {
          rank: skillRank(skill.id),
          initial: Boolean(resolvedGrantedSkills()[skill.id]),
          source: resolvedGrantedSkills()[skill.id]?.source || "XP",
          speciality: resolvedGrantedSkills()[skill.id]?.speciality || "",
        }])),
        talents: [
          ...Object.values(resolvedGrantedTalents()).map((talent) => ({ id: talent.id, name: talent.displayName, initial: true, cost: 0, source: talent.source })),
          ...character.advances.talents.map((entry) => {
            const talent = talentCatalogue.find((candidate) => candidate.id === entry.id);
            return talent ? { id: talent.id, name: talent.name, initial: false, cost: talentCost(talent), source: "XP" } : entry;
          }),
        ],
        eliteAdvances: [...automaticEliteAdvances(), ...character.advances.eliteAdvances],
        xpSpent: xpSpent(),
      },
    });
  });
  document.querySelector(".save-to-roster")?.addEventListener("click", () => {
    playMechanicalLock();
    appView = "roster";
    save();
    render();
  });
  document.querySelector(".export-foundry")?.addEventListener("click", () => {
    const eliteAdvances = [...automaticEliteAdvances(), ...character.advances.eliteAdvances];
    downloadJson(`${character.name || "acolyte"}.foundry-actor.json`, {
      name: character.name || "Unnamed Acolyte",
      type: "acolyte",
      system: {
        bio: {
          homeWorld: foundryBioValue(catalogs.homeWorlds, character.homeWorld),
          background: foundryBackgroundName(),
          role: foundryBioValue(catalogs.roles, character.role),
          elite: eliteAdvances[0]?.name || "",
          divination: foundryDivinationName(),
          gender: character.presentation || "",
          notes: character.appearance || "",
        },
        characteristics: Object.fromEntries(characteristics.map((entry) => [entry.id, foundryCharacteristicData(entry.id)])),
        fate: {
          max: finalFateThreshold(),
          value: Number(character.fate?.current ?? finalFateThreshold()),
          rolled: Boolean(character.fate?.roll),
        },
        wounds: {
          max: Number(character.wounds?.total || 0),
          value: Number(character.wounds?.total || 0),
          critical: 0,
          rolled: Boolean(character.wounds?.total),
        },
        fatigue: { value: 0 },
        skills: foundrySkillData(),
        experience: { total: character.xp.starting, used: xpSpent() },
        insanity: 0,
        corruption: 0,
      },
      items: [
        ...resolvedAptitudes().aptitudes.map((aptitude) => ({
          name: aptitude,
          type: "aptitude",
          system: { description: "Granted during character creation." },
          flags: { dh2CharacterBuilder: { initial: true } },
        })),
        ...character.equipment.inventory.map((id) => armoury.find((item) => item.id === id)).filter(Boolean).map(foundryEquipmentItem),
        ...[
          ...Object.values(resolvedGrantedTalents()).map((talent) => ({ talent, initial: true })),
          ...character.advances.talents.map((entry) => ({ talent: talentCatalogue.find((candidate) => candidate.id === entry.id), initial: false })),
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
          system: { description: entry.source, level: 0 },
          flags: { dh2CharacterBuilder: { initial: true, conditional: Boolean(entry.conditional) } },
        })),
      ],
      flags: {
        dh2CharacterBuilder: {
          format: "mrkeathley-dark-heresy-2nd",
          schemaVersion: 1,
          source: character,
        },
      },
    });
  });

  const dialog = document.querySelector("#detail-dialog");
  document.querySelector("#details")?.addEventListener("click", () => dialog.showModal());
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  const credits = document.querySelector("#credits-dialog");
  document.querySelector("#credits").addEventListener("click", () => credits.showModal());
  credits.querySelector(".dialog-close").addEventListener("click", () => credits.close());
  credits.addEventListener("click", (event) => {
    if (event.target === credits) credits.close();
  });
  document.addEventListener("keydown", keyboardNavigation, { once: true });
}

function keyboardNavigation(event) {
  if (document.querySelector("dialog[open]") || ["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
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
});

await initialiseLocalRepository();
await initialiseCloudRepository();
render();
