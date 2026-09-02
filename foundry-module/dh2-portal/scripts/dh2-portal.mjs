import { rollSheetDice, sendSheetText } from "./sheet-chat.mjs";
import {openTest, openItem, openDamage, openAmmunition, skillRows, characteristicValue, armourLocations, updateCombatField, chatControlMarkup} from "./portal-combat.mjs";
import {ammoLock} from './ammunition.mjs';
const MODULE_ID = "dh2-portal";
const SYSTEM_ID = "dark-heresy-2nd";
const PORTAL_FLAG = "dh2CharacterBuilder";
const SOCKET_NAME = `module.${MODULE_ID}`;
const REMOTE_PORTAL_URL = "https://gregory271.github.io/Dark-Heresy-2E-Portal/?foundry=1";
const pendingPortalRequests = new Map();
let portalApplication = null;
const portalActorSheets = new Set();

function portraitState(actor) {
  return { img: actor.img || "icons/svg/mystery-man.svg", canEdit: Boolean(actor.isOwner || game.user.isGM) };
}

async function saveActorPortrait(actor, path) {
  if (!actor || !(actor.isOwner || game.user.isGM)) throw new Error("You do not own this Actor.");
  if (typeof path !== "string" || !path.trim()) throw new Error("Choose an image first.");
  // Updating only img deliberately leaves prototype tokens and character data intact.
  await actor.update({ img: path }, { render: false });
  for (const sheet of portalActorSheets) {
    if (sheet.actor?.id === actor.id) portalFrameFor(sheet)?.contentWindow?.postMessage({ source: "dh2-portal-module", type: "portrait-state", ...portraitState(actor) }, window.location.origin);
  }
  return actor;
}

function editActorPortrait(actor) {
  if (!(actor?.isOwner || game.user.isGM)) return ui.notifications.warn("Only an Actor owner or GM can change its portrait.");
  const Picker = foundry.applications?.apps?.FilePicker?.implementation || globalThis.FilePicker?.implementation || globalThis.FilePicker;
  if (!Picker) throw new Error("Foundry's image picker is unavailable.");
  return new Picker({ type: "image", current: actor.img, callback: async (path) => {
    try {
      await saveActorPortrait(actor, path);
      if (!(actor.sheet instanceof PortalAcolyteSheet)) actor.sheet?.render(false);
    } catch (error) { ui.notifications.error(error.message); }
  } }).browse();
}

function viewActorPortrait(actor) {
  const Popout = foundry.applications?.apps?.ImagePopout || globalThis.ImagePopout;
  if (!Popout) return ui.notifications.warn("Foundry's image viewer is unavailable.");
  // The image viewer API moved to ApplicationV2 in newer Foundry releases.
  const options = { title: actor.name, uuid: actor.uuid, editable: false };
  const viewer = foundry.applications?.apps?.ImagePopout
    ? new Popout({ src: actor.img, uuid: actor.uuid, window: { title: actor.name } })
    : new Popout(actor.img, options);
  viewer.render(true);
}

function portalFrameRoot(application) {
  return application?.element?.[0] ?? application?.element;
}

function portalFrameFor(application) {
  return portalFrameRoot(application)?.querySelector?.(".dh2-portal-frame") || null;
}

async function fetchPortalDocument(portalUrl) {
  if (!portalUrl || portalUrl.startsWith(REMOTE_PORTAL_URL)) return { portalUrl, portalHtml: "" };
  try {
    const response = await fetch(portalUrl);
    if (response.ok) return { portalUrl, portalHtml: await response.text() };
  } catch (_error) {
    // The hosted fallback below is useful when a module package is incomplete.
  }
  return { portalUrl: REMOTE_PORTAL_URL, portalHtml: "" };
}

function embeddedPortalHtml(html, portalUrl, { actorSheet = false, actorId = "" } = {}) {
  const absolutePortalUrl = new URL(portalUrl, window.location.href).href;
  const baseUrl = new URL("./", absolutePortalUrl).href;
  const escapedBase = baseUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const embeddedMeta = `<meta name="dh2-embedded" content="foundry"><meta name="dh2-actor-sheet" content="${actorSheet ? "true" : "false"}"><meta name="dh2-actor-id" content="${String(actorId).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">`;
  return /<head(?:\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(\s[^>]*)?>/i, (tag) => `${tag}${embeddedMeta}<base href="${escapedBase}">`)
    : `${embeddedMeta}<base href="${escapedBase}">${html}`;
}

function attachPortalFrame(application, frame, documentState, options = {}) {
  if (!frame) return;
  const portalUrl = documentState.portalUrl || REMOTE_PORTAL_URL;
  const html = documentState.portalHtml || "";
  const onLoad = () => {
    // Events inside an iframe do not bubble to Foundry's window activation handler.
    // Activate the containing window without cancelling native input focus or typing.
    try {
      const activate = () => application.bringToTop?.();
      frame.contentDocument?.addEventListener("pointerdown", activate, { capture: true });
      frame.contentDocument?.addEventListener("focusin", activate);
    } catch (_error) {
      // A remotely hosted fallback is cross-origin; leave its native focus untouched.
    }
    if (options.actorSheet && application.actor) {
      frame.contentWindow?.postMessage({
        source: "dh2-portal-module",
        type: "load-actor",
        actorId: application.actor.id,
        actor: application.actor.toObject?.() || application.actor,
        portrait: portraitState(application.actor),
      }, "*");
    }
  };
  frame.addEventListener?.("load", onLoad, { once: true });
  frame.tabIndex = 0;
  if (!html || portalUrl === REMOTE_PORTAL_URL) {
    frame.src = portalUrl;
    return;
  }
  frame.srcdoc = embeddedPortalHtml(html, portalUrl, options);
}

class DarkHeresyPortalApplication extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dh2-portal-application",
      title: "Dark Heresy 2E Portal",
      template: `modules/${MODULE_ID}/templates/portal.html`,
      classes: ["dh2-portal-window"],
      width: Math.min(1520, Math.max(960, window.innerWidth - 90)),
      height: Math.min(1040, Math.max(700, window.innerHeight - 90)),
      resizable: true,
      minimizable: true,
    });
  }

  async getData() {
    const path = `modules/${MODULE_ID}/portal/index.html?foundry=1`;
    const localUrl = foundry.utils.getRoute?.(path) || `/${path}`;
    this._portalDocument = await fetchPortalDocument(localUrl);
    return { portalUrl: this._portalDocument.portalUrl };
  }

  async _render(force, options) {
    await super._render(force, options);
    const frame = portalFrameFor(this);
    if (!frame) return this;
    attachPortalFrame(this, frame, this._portalDocument || {}, { actorSheet: false });
    return this;
  }

  async close(options) {
    portalApplication = null;
    return super.close(options);
  }
}

const PortalSheetBase = globalThis.ActorSheet || globalThis.Application;

class PortalAcolyteSheet extends PortalSheetBase {
  static get defaultOptions() {
    const base = super.defaultOptions || {};
    return foundry.utils.mergeObject(base, {
      id: "dh2-portal-acolyte-sheet",
      title: "Dark Heresy 2E Portal Acolyte",
      template: `modules/${MODULE_ID}/templates/actor-sheet.html`,
      classes: ["dh2-portal-window", "dh2-portal-actor-sheet"],
      width: Math.min(1680, Math.max(1120, window.innerWidth - 70)),
      height: Math.min(1100, Math.max(760, window.innerHeight - 70)),
      resizable: true,
      minimizable: true,
    });
  }

  async getData() {
    const query = `foundry=1&actorSheet=1&actorId=${encodeURIComponent(this.actor?.id || "")}`;
    const path = `modules/${MODULE_ID}/portal/index.html?${query}`;
    const localUrl = foundry.utils.getRoute?.(path) || `/${path}`;
    this._portalDocument = await fetchPortalDocument(localUrl);
    if (this._portalDocument.portalUrl === REMOTE_PORTAL_URL) {
      this._portalDocument.portalUrl = `${REMOTE_PORTAL_URL}&actorSheet=1&actorId=${encodeURIComponent(this.actor?.id || "")}`;
    }
    return { portalUrl: this._portalDocument.portalUrl, actorId: this.actor?.id || "" };
  }

  async _render(force, options) {
    await super._render(force, options);
    portalActorSheets.add(this);
    const frame = portalFrameFor(this);
    if (!frame) return this;
    attachPortalFrame(this, frame, this._portalDocument || {}, {
      actorSheet: true,
      actorId: this.actor?.id || "",
    });
    return this;
  }

  async close(options) {
    portalActorSheets.delete(this);
    return super.close(options);
  }
}

function addItemChatControls(actor, anchor, item, includeRolls = true) {
  if (!item || !(actor.isOwner || game.user.isGM)) return;
  const controls = document.createElement("span");
  controls.className = "dh2-record-controls";
  const actions = [["Send to Chat", async () => {
    const text = document.createElement("div");
    text.innerHTML = item.flags?.[PORTAL_FLAG]?.sourceText || item.system?.benefit || item.system?.description || "No rules description recorded.";
    await sendSheetText(actor, { title: item.name, text: text.textContent });
  }]];
  if (includeRolls && ["weapon", "psychicPower"].includes(item.type)) actions.unshift(["Roll", () => openTest(actor, {
    title: item.name, weapon: item.type === "weapon" ? item : null, psychic: item.type === "psychicPower",
    target: item.type === "psychicPower" ? characteristicValue(actor, item.system?.target?.characteristic || "willpower") + Number(item.system?.target?.bonus || 0) : characteristicValue(actor, String(item.system?.class).toLowerCase() === "melee" ? "weaponSkill" : "ballisticSkill")
  })]);
  if (includeRolls && ["weapon", "psychicPower"].includes(item.type) && item.system?.damage && item.system.damage !== "0") actions.push(["Damage", () => openDamage(actor, item)]);
  for (const [label, action] of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", `${label}: ${item.name}`);
    if(label==='Send to Chat') {
      button.className='dh2-chat-share';
      button.innerHTML=chatControlMarkup;
      button.title='Send this description to chat (no roll)';
    }
    button.addEventListener("click", async (event) => {
      event.preventDefault(); event.stopPropagation(); button.disabled = true;
      try { await action(); if(label==='Send to Chat') ui.notifications.info(`${item.name} sent to chat.`); } catch (error) { ui.notifications.error(error.message); }
      finally { button.disabled = false; }
    });
    controls.append(button);
  }
  anchor.insertAdjacentElement("afterend", controls);
}

class PortalReinforcementSheet extends PortalSheetBase {
  async _render(force, options) {
    const prior = this.element?.[0] ?? this.element;
    const active = document.activeElement;
    const focusName = prior?.contains?.(active) ? active?.name : null;
    const selection = focusName ? [active.selectionStart, active.selectionEnd] : null;
    await super._render(force, options);
    if (focusName) {
      const root = this.element?.[0] ?? this.element;
      const field = [...(root?.querySelectorAll?.('input[name],textarea[name]') || [])].find(e=>e.name===focusName);
      field?.focus({preventScroll:true});
      if (selection?.[0] != null) { try { field?.setSelectionRange(...selection); } catch {} }
    }
    return this;
  }
  static get defaultOptions() {
    const base = super.defaultOptions || {};
    return foundry.utils.mergeObject(base, {
      id: "dh2-portal-reinforcement-sheet",
      title: "Dark Heresy Reinforcement",
      template: `modules/${MODULE_ID}/templates/reinforcement-sheet.html`,
      classes: ["dh2-reinforcement-window"],
      width: Math.min(1180, Math.max(920, window.innerWidth - 120)),
      height: Math.min(940, Math.max(680, window.innerHeight - 120)),
      resizable: true,
      minimizable: true,
      submitOnChange: false,
      closeOnSubmit: false,
      scrollY: [".dh2-rf-body"],
    });
  }

  async getData(options = {}) {
    const context = typeof super.getData === "function" ? await super.getData(options) : {};
    const isVehicle = this.actor.type === "vehicle";
    const source = cloneData(this.actor.flags?.[PORTAL_FLAG]?.[isVehicle ? "vehicle" : "reinforcement"] || {});
    const characteristicOrder = ["weaponSkill", "ballisticSkill", "strength", "toughness", "agility", "intelligence", "perception", "willpower", "fellowship", "influence"];
    const characteristics = characteristicOrder.map((key) => {
      const characteristic = this.actor.system?.characteristics?.[key] || {};
      const total = Number(characteristic.total ?? (Number(characteristic.base || 0) + Number(characteristic.advance || 0) * 5 + Number(characteristic.modifier || 0)));
      return { key, label: characteristic.label || key, short: characteristic.short || key, total, bonus: Math.floor(total / 10) + Number(characteristic.unnatural || 0) };
    });
    const itemGroups = { weapons: [], talents: [], traits: [], gear: [], psychicPowers: [], specialRules: [] };
    for (const item of this.actor.items?.contents || this.actor.items || []) {
      const group = item.flags?.[PORTAL_FLAG]?.reinforcementGroup || "";
      const record = {
        id: item.id,
        name: item.name,
        hasClip: item.type === "weapon" && Number(item.system?.clip?.max) > 0,
        clip: item.system?.clip || {},
        description: item.flags?.[PORTAL_FLAG]?.sourceText || item.system?.benefit || item.system?.description || "",
      };
      if (group === "weapon" || item.type === "weapon") itemGroups.weapons.push(record);
      else if (group === "talent" || item.type === "talent") itemGroups.talents.push(record);
      else if (group === "trait" || item.type === "trait") itemGroups.traits.push(record);
      else if (group === "psychic-power" || item.type === "psychicPower") itemGroups.psychicPowers.push(record);
      else if (group === "special-rule" || item.type === "specialAbility") itemGroups.specialRules.push(record);
      else if (group === "gear" || group === "armour" || ["gear", "armour", "tool"].includes(item.type)) itemGroups.gear.push(record);
    }
    return {
      ...context,
      actor: this.actor,
      system: this.actor.system,
      source,
      characteristics,
      armourLocations: isVehicle ? [] : armourLocations(this.actor),
      itemGroups,
      isVehicle,
      editable: Boolean(this.actor.isOwner || game.user.isGM),
      skills: skillRows(this.actor),
      combatModifier: this.actor.flags?.[PORTAL_FLAG]?.combatModifier || 0,
      combatNotes: this.actor.flags?.[PORTAL_FLAG]?.combatNotes || "",
      statuses: (globalThis.CONFIG?.statusEffects || []).filter(s => s.id).map(s => ({id:s.id, label:game.i18n?.localize(s.name || s.label || s.id) || s.id, active:Boolean(this.actor.statuses?.has(s.id))})),
      activeEffects: [...(this.actor.effects?.contents || this.actor.effects || [])].map(e => ({name:e.name, disabled:e.disabled})),
      isGM: Boolean(game.user.isGM),
      profileHeading: isVehicle ? "Vehicle" : source.gmNotes ? "Adventure NPC" : "NPC",
      tags: source.tags || [],
      sourceLabel: [source.source, source.page ? `p. ${source.page}` : ""].filter(Boolean).join(", "),
    };
  }

  activateListeners(html) {
    if (typeof super.activateListeners === "function") super.activateListeners(html);
    const root = html?.[0] ?? html;
    const editable = this.actor.isOwner || game.user.isGM;
    const statePanel = root?.querySelector('.dh2-rf-state');
    if (statePanel) { statePanel.open = Boolean(this._stateOpen); statePanel.addEventListener('toggle',()=>{this._stateOpen=statePanel.open;}); }
    root?.querySelectorAll?.("input[name],textarea[name]").forEach(input => {
      input.disabled = !editable;
      let timer, savedValue = input.value;
      const save = async () => {
        clearTimeout(timer);
        if (input.value === savedValue) return;
        savedValue = input.value;
        try { await updateCombatField(this.actor,input.name,input.value); }
        catch(error) { ui.notifications.error(error.message); this.render(false); }
      };
      input.addEventListener("input", () => {clearTimeout(timer); timer=setTimeout(save,500);});
      input.addEventListener("change", save);
      input.addEventListener("blur", save);
    });
    root?.querySelectorAll?.("[data-roll-characteristic]").forEach(button => button.addEventListener("click", () =>
      openTest(this.actor,{title:button.title,target:characteristicValue(this.actor,button.dataset.rollCharacteristic)})));
    root?.querySelectorAll?.("[data-roll-skill]").forEach(button => button.addEventListener("click", () => {
      const skill=skillRows(this.actor).find(s=>s.key===button.dataset.rollSkill && s.speciality===button.dataset.speciality);
      if(skill) openTest(this.actor,{title:skill.label,target:skill.target});
    }));
    root?.querySelectorAll?.("[data-reinforcement-item]").forEach(button => {
      const item=this.actor.items?.get?.(button.dataset.reinforcementItem);
      button.addEventListener("click",()=>openItem(this.actor,item));
      addItemChatControls(this.actor,button,item);
    });
    root?.querySelectorAll?.("[data-status]").forEach(button => {
      button.disabled=!editable;
      button.addEventListener("click",async()=>{
        button.disabled=true;
        try { await this.actor.toggleStatusEffect(button.dataset.status,{active:!this.actor.statuses?.has(button.dataset.status)}); }
        catch(error){ui.notifications.error(error.message);}
        finally{button.disabled=!editable;}
      });
    });
    root?.querySelectorAll?.('[data-manage-ammo]').forEach(button=>{
      button.disabled=!editable;
      button.onclick=()=>{try{openAmmunition(this.actor,{id:button.dataset.manageAmmo});}catch(e){ui.notifications.error(e.message);}};
    });
    root?.querySelectorAll?.('[data-ammo]').forEach(input=>{
      input.disabled=!editable;
      input.addEventListener('change',async()=>{
        if(!editable)return;
        const value=Number(input.value), item=this.actor.items?.get(input.dataset.ammo);
        try{
          if(!item||!Number.isInteger(value)||value<0||value>Number(item.system.clip.max))throw Error('Ammunition must be between zero and the clip capacity.');
          await item.update({'system.clip.value':value});
        }catch(error){ui.notifications.error(error.message);this.render(false);}
      });
    });
    root?.querySelector("[data-crew-test]")?.addEventListener("click",()=>openTest(this.actor,{title:"Crew / Operate test",target:0}));
    root?.querySelector("[data-initiative]")?.addEventListener("click",async()=>{
      if(!editable)return;
      try{await this.actor.rollInitiative({createCombatants:true});}catch(error){ui.notifications.error(error.message);}
    });
    root?.querySelector("[data-portrait-edit]")?.addEventListener("click",()=>editActorPortrait(this.actor));
    root?.querySelector("[data-portrait-view]")?.addEventListener("click",()=>viewActorPortrait(this.actor));
  }
}

class PortalVehicleSheet extends PortalReinforcementSheet {}

Hooks.once("init", () => {
  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = Object.freeze({
      importActorData,
      importActorLibrary,
      importReinforcementActorData,
      importReinforcementActorLibrary,
      importVehicleActorData,
      importVehicleActorLibrary,
      openActorImport,
      openActorLibraryImport,
      openPortal,
      validateActorData,
      validateActorLibrary,
      validateReinforcementActorData,
      validateVehicleActorData,
      updateActorFromPortal,
      saveActorPortrait,
    });
  }
  if (game.system.id === SYSTEM_ID && globalThis.Actors?.registerSheet) {
    Actors.registerSheet(MODULE_ID, PortalAcolyteSheet, {
      types: ["acolyte"],
      makeDefault: true,
      label: "Dark Heresy Portal Sheet",
    });
    Actors.registerSheet(MODULE_ID, PortalReinforcementSheet, {
      types: ["npc"],
      makeDefault: true,
      label: "Portal NPC Combat Sheet",
    });
    Actors.registerSheet(MODULE_ID, PortalVehicleSheet, {types:["vehicle"],makeDefault:true,label:"Portal Vehicle Combat Sheet"});
  }
});

Hooks.once("ready", async () => {
  if (game.system.id !== SYSTEM_ID) {
    console.warn(`${MODULE_ID} | This module requires the ${SYSTEM_ID} system.`);
    return;
  }
  game.socket.on(SOCKET_NAME, handleSocketMessage);
  window.addEventListener("message", handlePortalMessage);
  // Upgrade only the built-in/Portal NPC and vehicle sheets, preserving custom third-party overrides.
  if (game.user.isGM && game.users?.find?.(u=>u.isGM && u.active)?.id === game.user.id) {
    const updates = [...(game.actors?.contents || game.actors || [])].filter(a=>['npc','vehicle'].includes(a.type)).flatMap(a=>{
      const current=a.flags?.core?.sheetClass || '';
      const next=`${MODULE_ID}.${a.type==='vehicle'?'PortalVehicleSheet':'PortalReinforcementSheet'}`;
      if(current===next || (current && !current.startsWith(SYSTEM_ID+'.') && !current.startsWith(MODULE_ID+'.')))return [];
      return [{_id:a.id,'flags.core.sheetClass':next,'flags.dh2CharacterBuilder.previousSheetClass':current}];
    });
    if(updates.length) {
      try{await Actor.updateDocuments(updates);}catch(error){console.error('Portal sheet upgrade failed',error);ui.notifications.warn('Some NPC sheets could not be upgraded. Choose Portal NPC/Vehicle Combat Sheet in Sheet settings.');}
    }
  }
});

Hooks.on("updateActor", (actor, changes) => {
  if (game.system.id !== SYSTEM_ID || !("img" in changes || "name" in changes)) return;
  // Portrait saves suppress full document rendering to preserve the live
  // sheet. Refresh the native Actors directory on every client explicitly.
  ui.actors?.render(false);
  if ("name" in changes) ui.combat?.render(false);
  for (const sheet of portalActorSheets) {
    if (sheet.actor?.id !== actor.id) continue;
    if ("name" in changes) {
      const root = sheet.element?.[0] ?? sheet.element;
      const title = root?.querySelector?.(".window-title");
      if (title) title.textContent = actor.name;
    }
    const frame = portalFrameFor(sheet);
    const origin = frame?.srcdoc ? window.location.origin : new URL(frame?.src || window.location.href, window.location.href).origin;
    if ("img" in changes) frame?.contentWindow?.postMessage({ source: "dh2-portal-module", type: "portrait-state", ...portraitState(actor) }, origin);
    if ("name" in changes) frame?.contentWindow?.postMessage({ source: "dh2-portal-module", type: "actor-name-state", name: actor.name }, origin);
  }
});

// Keep native NPC and vehicle sheets intact and give their existing portrait
// an accessible view/change control. No token image is modified.
Hooks.on("renderActorSheet", (sheet, html) => {
  if (game.system.id !== SYSTEM_ID || !["npc", "vehicle"].includes(sheet.actor?.type) || sheet instanceof PortalReinforcementSheet) return;
  const root = html?.[0] ?? html;
  const seen = new Set();
  root?.querySelectorAll?.(".item-edit[data-item-id]").forEach((anchor) => {
    const id = anchor.dataset.itemId;
    if (seen.has(id) || anchor.parentElement.querySelector(".dh2-record-controls")) return;
    seen.add(id);
    addItemChatControls(sheet.actor, anchor, sheet.actor.items?.get?.(id), false);
  });
  const portrait = root?.querySelector?.('img[data-edit="img"]');
  if (!portrait || root.querySelector(".dh2-native-portrait-controls")) return;
  const controls = document.createElement("div");
  controls.className = "dh2-native-portrait-controls";
  for (const [label, action] of [["View Portrait", () => viewActorPortrait(sheet.actor)], ...(sheet.actor.isOwner || game.user.isGM ? [["Change Portrait", () => editActorPortrait(sheet.actor)]] : [])]) {
    const button = document.createElement("button");
    button.type = "button"; button.textContent = label;
    button.addEventListener("click", action); controls.append(button);
  }
  portrait.insertAdjacentElement("afterend", controls);
});

Hooks.on("renderActorDirectory", (_application, html) => {
  if (game.system.id !== SYSTEM_ID) return;

  const root = html?.[0] ?? html;
  if (!(root instanceof HTMLElement) || root.querySelector("[data-dh2-portal-controls]")) return;

  const controls = document.createElement("div");
  controls.className = "dh2-portal-directory-controls";
  controls.dataset.dh2PortalControls = "";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "dh2-portal-open-button";
  openButton.innerHTML = '<i class="fa-solid fa-user-gear" aria-hidden="true"></i><span>Open DH2 Portal</span>';
  openButton.addEventListener("click", openPortal);
  controls.append(openButton);

  if (game.user.isGM) {
    const libraryButton = document.createElement("button");
    libraryButton.type = "button";
    libraryButton.className = "dh2-portal-library-import-button";
    libraryButton.innerHTML = '<i class="fa-solid fa-users" aria-hidden="true"></i><span>Import Web Roster</span>';
    libraryButton.addEventListener("click", openActorLibraryImport);
    controls.append(libraryButton);

    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.className = "dh2-portal-import-button";
    importButton.innerHTML = '<i class="fa-solid fa-file-import" aria-hidden="true"></i><span>Import JSON</span>';
    importButton.addEventListener("click", openActorImport);
    controls.append(importButton);
  }

  const target = root.querySelector(".directory-footer")
    ?? root.querySelector(".directory-header .header-actions")
    ?? root.querySelector(".directory-header");
  if (target) target.append(controls);
});

function openPortal() {
  if (game.system.id !== SYSTEM_ID) {
    ui.notifications.warn("Open a world using the Dark Heresy 2nd Edition system first.");
    return null;
  }
  portalApplication ??= new DarkHeresyPortalApplication();
  portalApplication.render(true);
  return portalApplication;
}

async function openActorImport() {
  if (!game.user.isGM) {
    ui.notifications.warn("Only a Gamemaster can import a Portal Acolyte JSON file.");
    return null;
  }

  try {
    const file = await chooseJsonFile();
    if (!file) return null;
    const payload = await readJsonFile(file);
    if (looksLikeReinforcementLibrary(payload)) return await importReinforcementActorLibrary(payload);
    if (looksLikeVehicleLibrary(payload)) return await importVehicleActorLibrary(payload);
    if (looksLikeActorLibrary(payload)) return await importActorLibrary(payload);
    if (payload?.type === "npc" && payload?.flags?.[PORTAL_FLAG]?.reinforcementId) return await importReinforcementActorData(payload);
    if (payload?.type === "vehicle" && payload?.flags?.[PORTAL_FLAG]?.vehicleId) return await importVehicleActorData(payload);
    return await importActorData(payload);
  } catch (error) {
    console.error(`${MODULE_ID} | Character import failed`, error);
    ui.notifications.error(error instanceof Error ? error.message : "The Portal character could not be imported.");
    return null;
  }
}

async function openActorLibraryImport() {
  if (!game.user.isGM) {
    ui.notifications.warn("Only a Gamemaster can import a Portal web roster.");
    return null;
  }

  try {
    const file = await chooseJsonFile();
    if (!file) return null;
    const payload = await readJsonFile(file);
    return await importActorLibrary(payload);
  } catch (error) {
    console.error(`${MODULE_ID} | Web roster import failed`, error);
    ui.notifications.error(error instanceof Error ? error.message : "The Portal web roster could not be imported.");
    return null;
  }
}

async function handlePortalMessage(event) {
  const context = [...portalContexts()].find((entry) => entry.frame?.contentWindow === event.source);
  const fromPortal = Boolean(context);
  const allowedOrigin = event.origin === window.location.origin
    || event.origin === "https://gregory271.github.io"
    || (event.origin === "null" && fromPortal);
  if (!allowedOrigin || !fromPortal) return;

  if (event.data?.type === "load-actor" && event.data?.source === "dh2-portal-frame") return;
  if (event.data?.source !== "dh2-portal-frame" || !event.data.requestId) return;

  if (event.data.type === "actor-sheet-ready") {
    if (context.kind !== "actor-sheet" || !context.application.actor) return;
    // Use this sheet's Actor, including a token's synthetic Actor, never a roster selection.
    const actor = context.application.actor;
    event.source.postMessage({
      source: "dh2-portal-module", type: "load-actor",
      actorId: actor.id, actor: actor.toObject?.() || actor,
      portrait: portraitState(actor),
    }, event.origin === "null" ? "*" : event.origin);
    return;
  }

  if (["sheet-roll", "sheet-chat", "sheet-ammunition"].includes(event.data.type)) {
    if (context.kind !== "actor-sheet") return;
    const reply = (result) => event.source?.postMessage({ source: "dh2-portal-module", type: "sheet-chat-result", requestId: event.data.requestId, ...result }, event.origin === "null" ? "*" : event.origin);
    try {
      const result = event.data.type === 'sheet-ammunition' ? (openAmmunition(context.application.actor,event.data.payload || {}), {}) : await (event.data.type === "sheet-roll" ? rollSheetDice : sendSheetText)(context.application.actor, event.data.payload || {});
      reply({ ok: true, ...result });
    } catch (error) { reply({ ok: false, error: error.message }); }
    return;
  }

  if (["edit-portrait", "view-portrait"].includes(event.data.type)) {
    if (context.kind !== "actor-sheet" || !context.application.actor) return;
    try {
      if (event.data.type === "edit-portrait") await editActorPortrait(context.application.actor);
      else viewActorPortrait(context.application.actor);
    } catch (error) { ui.notifications.error(error.message); }
    return;
  }

  if (event.data.type === "update-actor") {
    if (context.kind !== "actor-sheet" || !context.application.actor) return;
    const reply = (result) => event.source?.postMessage({
      source: "dh2-portal-module",
      type: "update-actor-result",
      requestId: event.data.requestId,
      ...result,
    }, event.origin === "null" ? "*" : event.origin);
    try {
      const actor = await updateActorFromPortal(context.application.actor, event.data.payload);
      reply({ ok: true, actorId: actor.id, name: actor.name });
    } catch (error) {
      reply({ ok: false, error: error instanceof Error ? error.message : "Foundry could not save this Acolyte." });
    }
    return;
  }

  if (event.data.type === "create-reinforcement" && context.kind === "portal") {
    const reply = (result) => event.source?.postMessage({
      source: "dh2-portal-module",
      type: "create-reinforcement-result",
      requestId: event.data.requestId,
      ...result,
    }, event.origin === "null" ? "*" : event.origin);
    if (!game.user.isGM) {
      reply({ ok: false, error: "Only a Gamemaster can create reinforcement NPCs." });
      return;
    }
    try {
      const actor = await importReinforcementActorData(event.data.payload, { openSheet: true });
      reply({ ok: true, actorId: actor.id, name: actor.name });
    } catch (error) {
      reply({ ok: false, error: error instanceof Error ? error.message : "Foundry could not create this reinforcement NPC." });
    }
    return;
  }

  if (event.data.type === "create-reinforcement-library" && context.kind === "portal") {
    const reply = (result) => event.source?.postMessage({
      source: "dh2-portal-module",
      type: "create-reinforcement-result",
      requestId: event.data.requestId,
      ...result,
    }, event.origin === "null" ? "*" : event.origin);
    if (!game.user.isGM) {
      reply({ ok: false, error: "Only a Gamemaster can create reinforcement NPCs." });
      return;
    }
    try {
      const result = await importReinforcementActorLibrary(event.data.payload);
      reply({ ok: true, name: `${result.created.length} reinforcement NPC${result.created.length === 1 ? "" : "s"} created${result.skipped.length ? `; ${result.skipped.length} already existed` : ""}` });
    } catch (error) {
      reply({ ok: false, error: error instanceof Error ? error.message : "Foundry could not create the reinforcement NPC library." });
    }
    return;
  }

  if (event.data.type === "create-vehicle" && context.kind === "portal") {
    const reply = (result) => event.source?.postMessage({
      source: "dh2-portal-module",
      type: "create-vehicle-result",
      requestId: event.data.requestId,
      ...result,
    }, event.origin === "null" ? "*" : event.origin);
    if (!game.user.isGM) {
      reply({ ok: false, error: "Only a Gamemaster can create vehicle Actors." });
      return;
    }
    try {
      const actor = await importVehicleActorData(event.data.payload, { openSheet: true });
      reply({ ok: true, actorId: actor.id, name: actor.name });
    } catch (error) {
      reply({ ok: false, error: error instanceof Error ? error.message : "Foundry could not create this vehicle." });
    }
    return;
  }

  if (event.data.type === "create-vehicle-library" && context.kind === "portal") {
    const reply = (result) => event.source?.postMessage({
      source: "dh2-portal-module",
      type: "create-vehicle-result",
      requestId: event.data.requestId,
      ...result,
    }, event.origin === "null" ? "*" : event.origin);
    if (!game.user.isGM) {
      reply({ ok: false, error: "Only a Gamemaster can create vehicle Actors." });
      return;
    }
    try {
      const result = await importVehicleActorLibrary(event.data.payload);
      reply({ ok: true, name: `${result.created.length} vehicle${result.created.length === 1 ? "" : "s"} created${result.skipped.length ? `; ${result.skipped.length} already existed` : ""}` });
    } catch (error) {
      reply({ ok: false, error: error instanceof Error ? error.message : "Foundry could not create the vehicle library." });
    }
    return;
  }

  if (event.data.type !== "create-actor" || context.kind !== "portal") return;

  const reply = (result) => event.source?.postMessage({
    source: "dh2-portal-module",
    type: "create-actor-result",
    requestId: event.data.requestId,
    ...result,
  }, event.origin === "null" ? "*" : event.origin);

  if (game.user.isGM) {
    try {
      const actor = await importActorData(event.data.payload, { ownerUserId: game.user.id, openSheet: true });
      reply({ ok: true, actorId: actor.id, name: actor.name });
    } catch (error) {
      reply({ ok: false, error: error instanceof Error ? error.message : "Foundry could not create this Acolyte." });
    }
    return;
  }

  const activeGM = primaryActiveGM();
  if (!activeGM) {
    reply({ ok: false, error: "A Gamemaster must be connected before a player can create a Foundry Actor." });
    return;
  }

  pendingPortalRequests.set(event.data.requestId, { source: event.source, origin: event.origin });
  game.socket.emit(SOCKET_NAME, {
    type: "create-actor-request",
    requestId: event.data.requestId,
    requesterId: game.user.id,
    payload: event.data.payload,
  });
}

function portalContexts() {
  const contexts = [];
  const portalFrame = portalFrameFor(portalApplication);
  if (portalApplication && portalFrame) contexts.push({ kind: "portal", application: portalApplication, frame: portalFrame });
  for (const application of portalActorSheets) {
    const frame = portalFrameFor(application);
    if (frame) contexts.push({ kind: "actor-sheet", application, frame });
  }
  return contexts;
}

async function handleSocketMessage(message) {
  if (!message || typeof message !== "object") return;

  if (message.type === "create-actor-result" && message.targetUserId === game.user.id) {
    const pending = pendingPortalRequests.get(message.requestId);
    if (!pending) return;
    pendingPortalRequests.delete(message.requestId);
    pending.source?.postMessage({
      source: "dh2-portal-module",
      type: "create-actor-result",
      requestId: message.requestId,
      ok: Boolean(message.ok),
      actorId: message.actorId || "",
      name: message.name || "",
      error: message.error || "",
    }, pending.origin);
    return;
  }

  if (message.type !== "create-actor-request" || !game.user.isGM) return;
  if (primaryActiveGM()?.id !== game.user.id) return;

  try {
    const actor = await importActorData(message.payload, {
      ownerUserId: message.requesterId,
      openSheet: false,
      notify: false,
    });
    game.socket.emit(SOCKET_NAME, {
      type: "create-actor-result",
      requestId: message.requestId,
      targetUserId: message.requesterId,
      ok: true,
      actorId: actor.id,
      name: actor.name,
    });
    ui.notifications.info(`${actor.name} was created from ${game.users.get(message.requesterId)?.name || "a player"}'s Portal.`);
  } catch (error) {
    game.socket.emit(SOCKET_NAME, {
      type: "create-actor-result",
      requestId: message.requestId,
      targetUserId: message.requesterId,
      ok: false,
      error: error instanceof Error ? error.message : "Foundry could not create this Acolyte.",
    });
  }
}

async function importActorData(payload, {
  ownerUserId = game.user.id,
  openSheet = true,
  notify = true,
  folderId = null,
} = {}) {
  if (game.system.id !== SYSTEM_ID) {
    throw new Error("Activate the Dark Heresy 2nd Edition system before importing this character.");
  }

  const actorData = validateActorData(payload);
  if (ownerUserId && !game.users.get(ownerUserId)?.isGM) {
    const ownerLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    actorData.ownership = { default: 0, [ownerUserId]: ownerLevel };
  }
  if (folderId) actorData.folder = folderId;

  const actor = await Actor.create(actorData);
  if (!actor) throw new Error("Foundry did not create the Acolyte Actor.");

  if (notify) ui.notifications.info(`${actor.name} was imported from the Dark Heresy 2E Portal.`);
  if (openSheet) actor.sheet?.render(true);
  return actor;
}

async function importActorLibrary(payload, { folderName = "Imported Acolytes" } = {}) {
  if (!game.user.isGM) throw new Error("Only a Gamemaster can import a Portal web roster.");
  if (game.system.id !== SYSTEM_ID) {
    throw new Error("Activate the Dark Heresy 2nd Edition system before importing this roster.");
  }

  const entries = validateActorLibrary(payload);
  const folder = await findOrCreateActorFolder(folderName);
  const result = { created: [], skipped: [], failed: [] };
  for (const entry of entries) {
    const duplicate = findMatchingPortalActor(entry);
    if (duplicate) {
      result.skipped.push({ recordId: entry.recordId, name: entry.actor.name, actorId: duplicate.id });
      continue;
    }
    try {
      const actor = await importActorData(entry.actor, {
        ownerUserId: game.user.id,
        openSheet: false,
        notify: false,
        folderId: folder?.id || null,
      });
      result.created.push(actor);
    } catch (error) {
      result.failed.push({
        recordId: entry.recordId,
        name: entry.actor.name,
        error: error instanceof Error ? error.message : "Foundry could not create this Actor.",
      });
    }
  }

  const summary = `${result.created.length} Acolyte${result.created.length === 1 ? "" : "s"} imported${result.skipped.length ? `; ${result.skipped.length} existing duplicate${result.skipped.length === 1 ? "" : "s"} skipped` : ""}${result.failed.length ? `; ${result.failed.length} failed` : ""}.`;
  if (result.failed.length) {
    console.error(`${MODULE_ID} | Some web roster entries failed`, result.failed);
    ui.notifications.warn(summary);
  } else {
    ui.notifications.info(summary);
  }
  return result;
}

async function importReinforcementActorData(payload, { openSheet = true, notify = true } = {}) {
  if (!game.user.isGM) throw new Error("Only a Gamemaster can create reinforcement NPCs.");
  if (game.system.id !== SYSTEM_ID) throw new Error("Activate the Dark Heresy 2nd Edition system before creating this NPC.");
  const actorData = validateReinforcementActorData(payload);
  const reinforcementId = actorData.flags?.[PORTAL_FLAG]?.reinforcementId;
  const existing = game.actors?.find?.((actor) => actor.type === "npc" && actor.flags?.[PORTAL_FLAG]?.reinforcementId === reinforcementId);
  if (existing) {
    if (notify) ui.notifications.info(`${existing.name} already exists in the Reinforcement Characters folder.`);
    if (openSheet) existing.sheet?.render(true);
    return existing;
  }
  const adventure = actorData.flags?.[PORTAL_FLAG]?.adventure;
  let folder;
  if (adventure?.id === "dark-pursuits") {
    const root = await findOrCreateActorFolder("Dark Pursuits (GM)");
    const names = { 1: "I - City of Lies", 2: "II - Beneath the Sky", 3: "III - Hunting Damnation" };
    folder = await findOrCreateActorFolder(names[adventure.part] || "Supporting NPCs", root?.id || null);
    actorData.ownership = { default: 0 };
    actorData.prototypeToken = { actorLink: false, disposition: 0 };
  } else folder = await findOrCreateActorFolder("Reinforcement Characters");
  if (folder?.id) actorData.folder = folder.id;
  const actor = await Actor.create(actorData);
  if (!actor) throw new Error("Foundry did not create the reinforcement NPC.");
  if (notify) ui.notifications.info(`${actor.name} was created as a reinforcement NPC.`);
  if (openSheet) actor.sheet?.render(true);
  return actor;
}

async function importReinforcementActorLibrary(payload) {
  if (!game.user.isGM) throw new Error("Only a Gamemaster can create reinforcement NPCs.");
  if (!payload || typeof payload !== "object" || payload.format !== "dh2-reinforcement-actor-library" || !Array.isArray(payload.actors)) {
    throw new Error("This is not a Dark Heresy Portal reinforcement NPC library.");
  }
  if (!payload.actors.length) throw new Error("The reinforcement NPC library is empty.");
  if (payload.actors.length > 100) throw new Error("The reinforcement NPC library exceeds the 100-Actor safety limit.");
  const result = { created: [], skipped: [], failed: [] };
  for (const entry of payload.actors) {
    const actorData = validateReinforcementActorData(entry?.actor || entry);
    const reinforcementId = actorData.flags?.[PORTAL_FLAG]?.reinforcementId;
    const existing = game.actors?.find?.((actor) => actor.type === "npc" && actor.flags?.[PORTAL_FLAG]?.reinforcementId === reinforcementId);
    if (existing) {
      result.skipped.push(existing);
      continue;
    }
    try {
      result.created.push(await importReinforcementActorData(actorData, { openSheet: false, notify: false }));
    } catch (error) {
      result.failed.push({ name: actorData.name, error: error instanceof Error ? error.message : "Foundry could not create this NPC." });
    }
  }
  const summary = `${result.created.length} reinforcement NPC${result.created.length === 1 ? "" : "s"} created${result.skipped.length ? `; ${result.skipped.length} duplicate${result.skipped.length === 1 ? "" : "s"} skipped` : ""}${result.failed.length ? `; ${result.failed.length} failed` : ""}.`;
  if (result.failed.length) {
    console.error(`${MODULE_ID} | Some reinforcement NPCs failed`, result.failed);
    ui.notifications.warn(summary);
  } else {
    ui.notifications.info(summary);
  }
  return result;
}

async function importVehicleActorData(payload, { openSheet = true, notify = true } = {}) {
  if (!game.user.isGM) throw new Error("Only a Gamemaster can create vehicle Actors.");
  if (game.system.id !== SYSTEM_ID) throw new Error("Activate the Dark Heresy 2nd Edition system before creating this vehicle.");
  const actorData = validateVehicleActorData(payload);
  const vehicleId = actorData.flags?.[PORTAL_FLAG]?.vehicleId;
  const existing = game.actors?.find?.((actor) => actor.type === "vehicle" && actor.flags?.[PORTAL_FLAG]?.vehicleId === vehicleId);
  if (existing) {
    if (notify) ui.notifications.info(`${existing.name} already exists in the Vehicles folder.`);
    if (openSheet) existing.sheet?.render(true);
    return existing;
  }
  const folder = await findOrCreateActorFolder("Vehicles");
  if (folder?.id) actorData.folder = folder.id;
  const actor = await Actor.create(actorData);
  if (!actor) throw new Error("Foundry did not create the vehicle Actor.");
  if (notify) ui.notifications.info(`${actor.name} was created as a vehicle Actor.`);
  if (openSheet) actor.sheet?.render(true);
  return actor;
}

async function importVehicleActorLibrary(payload) {
  if (!game.user.isGM) throw new Error("Only a Gamemaster can create vehicle Actors.");
  if (!payload || typeof payload !== "object" || payload.format !== "dh2-vehicle-actor-library" || !Array.isArray(payload.actors)) {
    throw new Error("This is not a Dark Heresy Portal vehicle library.");
  }
  if (!payload.actors.length) throw new Error("The vehicle library is empty.");
  if (payload.actors.length > 100) throw new Error("The vehicle library exceeds the 100-Actor safety limit.");
  const result = { created: [], skipped: [], failed: [] };
  for (const entry of payload.actors) {
    const actorData = validateVehicleActorData(entry?.actor || entry);
    const vehicleId = actorData.flags?.[PORTAL_FLAG]?.vehicleId;
    const existing = game.actors?.find?.((actor) => actor.type === "vehicle" && actor.flags?.[PORTAL_FLAG]?.vehicleId === vehicleId);
    if (existing) {
      result.skipped.push(existing);
      continue;
    }
    try {
      result.created.push(await importVehicleActorData(actorData, { openSheet: false, notify: false }));
    } catch (error) {
      result.failed.push({ name: actorData.name, error: error instanceof Error ? error.message : "Foundry could not create this vehicle." });
    }
  }
  const summary = `${result.created.length} vehicle${result.created.length === 1 ? "" : "s"} created${result.skipped.length ? `; ${result.skipped.length} duplicate${result.skipped.length === 1 ? "" : "s"} skipped` : ""}${result.failed.length ? `; ${result.failed.length} failed` : ""}.`;
  if (result.failed.length) {
    console.error(`${MODULE_ID} | Some vehicles failed`, result.failed);
    ui.notifications.warn(summary);
  } else {
    ui.notifications.info(summary);
  }
  return result;
}

async function updateActorFromPortal(actor, payload) {
  return ammoLock(actor, () => syncActorFromPortal(actor, payload));
}
async function syncActorFromPortal(actor, payload) {
  if (!actor || typeof actor.update !== "function") throw new Error("The Foundry Acolyte no longer exists.");
  const actorData = validateActorData(payload);
  await actor.update({
    ...(actorData.name !== actor.name ? { name: actorData.name } : {}),
    type: actorData.type,
    system: actorData.system,
    [`flags.${PORTAL_FLAG}`]: actorData.flags?.[PORTAL_FLAG] || {},
  }, { render: false });

  const desiredItems = Array.isArray(actorData.items) ? actorData.items : [];
  const existingItems = [...(actor.items?.contents || actor.items || [])];
  const used = new Set();
  const updates = [];
  const creates = [];
  for (const desired of desiredItems) {
    const match = existingItems.find((item) => !used.has(item.id) && item.type === desired.type && item.name === desired.name);
    if (match) {
      used.add(match.id);
      const update = { ...cloneData(desired), _id: match.id };
      // A builder snapshot must never refill a live weapon or lose its reserves.
      if (match.type === 'weapon' && match.system?.clip) {
        update.system.clip = cloneData(match.system.clip);
        if(match.flags?.dh2Ammo) update.flags = {...update.flags, dh2Ammo:cloneData(match.flags.dh2Ammo)};
      }
      updates.push(update);
    } else {
      creates.push(cloneData(desired));
    }
  }
  if (updates.length && typeof actor.updateEmbeddedDocuments === "function") {
    await actor.updateEmbeddedDocuments("Item", updates, { render: false });
  }
  if (creates.length && typeof actor.createEmbeddedDocuments === "function") {
    await actor.createEmbeddedDocuments("Item", creates, { render: false });
  }
  const stale = existingItems.filter((item) => item.flags?.[PORTAL_FLAG] && !used.has(item.id) && !desiredItems.some((desired) => desired.type === item.type && desired.name === item.name));
  if (stale.length && typeof actor.deleteEmbeddedDocuments === "function") {
    await actor.deleteEmbeddedDocuments("Item", stale.map((item) => item.id), { render: false });
  }
  return actor;
}

function validateActorData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Choose a valid Portal Foundry Actor JSON file.");
  }
  if (payload.format === "dh2-character-builder") {
    throw new Error('This is Builder JSON. In the Portal, use “Export Foundry Actor” and import that file instead.');
  }

  const source = payload.actor && typeof payload.actor === "object" ? payload.actor : payload;
  if (source.type !== "acolyte" || !source.system || typeof source.system !== "object") {
    throw new Error("This file is not a Dark Heresy 2E Portal Acolyte Actor export.");
  }

  const portalFlags = source.flags?.[PORTAL_FLAG];
  if (portalFlags?.format && portalFlags.format !== "mrkeathley-dark-heresy-2nd") {
    throw new Error("This Portal export targets a different Foundry system format.");
  }

  return {
    name: String(source.name || "Unnamed Acolyte"),
    type: "acolyte",
    img: source.img || "icons/svg/mystery-man.svg",
    system: cloneData(source.system),
    items: Array.isArray(source.items) ? cloneData(source.items) : [],
    flags: cloneData(source.flags || {}),
  };
}

function validateActorLibrary(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Choose a valid Portal Foundry roster file.");
  }
  const format = String(payload.format || "").trim();
  const actors = Array.isArray(payload.actors)
    ? payload.actors
    : payload.actors && typeof payload.actors === "object"
      ? Object.values(payload.actors)
      : [];
  if (!actors.length || (format && format !== "dh2-foundry-actor-library" && !actors.every((entry) => entry?.actor?.type === "acolyte"))) {
    const detected = format || "no format identifier";
    throw new Error(`This is not a Portal roster transfer (detected: ${detected}; Actors: ${actors.length}). In the web app, open Your Acolytes and use “Export Roster for Foundry”.`);
  }
  if (actors.length > 250) throw new Error("This roster contains more than the 250-character safety limit.");

  return actors.map((entry, index) => {
    const recordId = String(entry?.recordId || entry?.actor?.flags?.[PORTAL_FLAG]?.libraryRecordId || "").trim();
    if (!recordId) throw new Error(`Roster entry ${index + 1} is missing its character identifier.`);
    const actor = validateActorData(entry?.actor || entry);
    actor.flags ||= {};
    actor.flags[PORTAL_FLAG] ||= {};
    actor.flags[PORTAL_FLAG].libraryRecordId = recordId;
    actor.flags[PORTAL_FLAG].libraryUpdatedAt = String(entry?.updatedAt || actor.flags[PORTAL_FLAG].libraryUpdatedAt || "");
    actor.flags[PORTAL_FLAG].libraryOrigin = String(entry?.origin || actor.flags[PORTAL_FLAG].libraryOrigin || "Web roster");
    return { recordId, actor };
  });
}

function validateReinforcementActorData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Choose a valid Portal reinforcement NPC file.");
  const source = payload.actor && typeof payload.actor === "object" ? payload.actor : payload;
  const reinforcementId = String(source.flags?.[PORTAL_FLAG]?.reinforcementId || "").trim();
  if (source.type !== "npc" || !source.system || typeof source.system !== "object" || !reinforcementId) {
    throw new Error("This file is not a Dark Heresy Portal reinforcement NPC export.");
  }
  const flags = cloneData(source.flags || {});
  flags.core ||= {};
  flags.core.sheetClass = `${MODULE_ID}.PortalReinforcementSheet`;
  return {
    name: String(source.name || "Unnamed Reinforcement"),
    type: "npc",
    img: normalisePortalAssetPath(source.img),
    system: cloneData(source.system),
    items: Array.isArray(source.items) ? cloneData(source.items) : [],
    flags,
  };
}

function validateVehicleActorData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Choose a valid Portal vehicle file.");
  const source = payload.actor && typeof payload.actor === "object" ? payload.actor : payload;
  const vehicleId = String(source.flags?.[PORTAL_FLAG]?.vehicleId || "").trim();
  if (source.type !== "vehicle" || !source.system || typeof source.system !== "object" || !vehicleId) {
    throw new Error("This file is not a Dark Heresy Portal vehicle export.");
  }
  const flags = cloneData(source.flags || {});
  flags.core = {...flags.core, sheetClass: `${MODULE_ID}.PortalVehicleSheet`};
  return {
    name: String(source.name || "Unnamed Vehicle"),
    type: "vehicle",
    img: normalisePortalAssetPath(source.img),
    system: cloneData(source.system),
    items: Array.isArray(source.items) ? cloneData(source.items) : [],
    flags,
  };
}

function normalisePortalAssetPath(value = "") {
  const path = String(value || "").split("?")[0];
  if (path.startsWith("./")) return `modules/${MODULE_ID}/portal/${path.slice(2)}`;
  if (path.startsWith("../public/")) return `modules/${MODULE_ID}/portal/public/${path.slice("../public/".length)}`;
  if (path.startsWith("public/")) return `modules/${MODULE_ID}/portal/${path}`;
  return path || "icons/svg/mystery-man.svg";
}

function looksLikeActorLibrary(payload) {
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload)
    && (String(payload.format || "").trim() === "dh2-foundry-actor-library" || Array.isArray(payload.actors)));
}

function looksLikeReinforcementLibrary(payload) {
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload)
    && String(payload.format || "").trim() === "dh2-reinforcement-actor-library" && Array.isArray(payload.actors));
}

function looksLikeVehicleLibrary(payload) {
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload)
    && String(payload.format || "").trim() === "dh2-vehicle-actor-library" && Array.isArray(payload.actors));
}

function findMatchingPortalActor(entry) {
  const incomingFlags = entry.actor.flags?.[PORTAL_FLAG] || {};
  const incomingSource = serialiseForComparison(incomingFlags.source);
  return game.actors?.find?.((actor) => {
    const existingFlags = actor.flags?.[PORTAL_FLAG] || {};
    if (entry.recordId && existingFlags.libraryRecordId === entry.recordId) return true;
    return Boolean(incomingSource && serialiseForComparison(existingFlags.source) === incomingSource);
  }) || null;
}

async function findOrCreateActorFolder(name, parent = null) {
  const existing = game.folders?.find?.((folder) => folder.type === "Actor" && folder.name === name && (folder.folder?.id || folder.folder || null) === parent);
  if (existing) return existing;
  if (typeof globalThis.Folder?.create !== "function") return null;
  return Folder.create({ name, type: "Actor", sorting: "a", folder: parent });
}

function serialiseForComparison(value) {
  if (!value || typeof value !== "object") return "";
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return "";
  }
}

function primaryActiveGM() {
  return game.users
    .filter((user) => user.active && user.isGM)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))[0] || null;
}

function cloneData(value) {
  if (typeof globalThis.foundry?.utils?.deepClone === "function") return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

function chooseJsonFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.hidden = true;
    input.addEventListener("change", () => {
      const [file] = input.files || [];
      input.remove();
      resolve(file || null);
    }, { once: true });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve(null);
    }, { once: true });
    document.body.append(input);
    input.click();
  });
}

async function readJsonFile(file) {
  const raw = typeof file?.text === "function"
    ? await file.text()
    : await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result), { once: true });
      reader.addEventListener("error", () => reject(reader.error || new Error("Foundry could not read the selected file.")), { once: true });
      reader.readAsText(file);
    });
  const text = String(raw || "").replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error("The selected JSON file is empty.");
  const parsed = JSON.parse(text);
  return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
}
