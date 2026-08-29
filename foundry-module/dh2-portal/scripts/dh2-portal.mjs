const MODULE_ID = "dh2-portal";
const SYSTEM_ID = "dark-heresy-2nd";
const PORTAL_FLAG = "dh2CharacterBuilder";
const SOCKET_NAME = `module.${MODULE_ID}`;
const REMOTE_PORTAL_URL = "https://gregory271.github.io/Dark-Heresy-2E-Portal/?foundry=1";
const pendingPortalRequests = new Map();
let portalApplication = null;

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
    try {
      // Foundry intentionally serves HTML from its data directory as
      // text/plain. Fetch the document here and render it as srcdoc instead
      // of navigating an iframe directly to the raw response.
      const response = await fetch(localUrl);
      if (response.ok) {
        const portalHtml = await response.text();
        this._portalDocument = { portalUrl: localUrl, portalHtml };
        return { portalUrl: localUrl };
      }
    } catch (_error) {
      // Fall through to the hosted edition when the local package is absent.
    }
    this._portalDocument = { portalUrl: REMOTE_PORTAL_URL, portalHtml: "" };
    return { portalUrl: REMOTE_PORTAL_URL };
  }

  async _render(force, options) {
    await super._render(force, options);
    const root = this.element?.[0] ?? this.element;
    const frame = root?.querySelector?.(".dh2-portal-frame");
    if (!frame) return this;

    const portalUrl = frame.dataset.portalUrl || REMOTE_PORTAL_URL;
    const html = this._portalDocument?.portalHtml || "";
    if (!html || portalUrl === REMOTE_PORTAL_URL) {
      frame.src = portalUrl;
      return this;
    }

    const absolutePortalUrl = new URL(portalUrl, window.location.href).href;
    const baseUrl = new URL("./", absolutePortalUrl).href;
    const escapedBase = baseUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const embeddedMeta = '<meta name="dh2-embedded" content="foundry">';
    const documentHtml = /<head(?:\s[^>]*)?>/i.test(html)
      ? html.replace(/<head(\s[^>]*)?>/i, (tag) => `${tag}${embeddedMeta}<base href="${escapedBase}">`)
      : `${embeddedMeta}<base href="${escapedBase}">${html}`;
    frame.srcdoc = documentHtml;
    return this;
  }

  async close(options) {
    portalApplication = null;
    return super.close(options);
  }
}

Hooks.once("init", () => {
  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = Object.freeze({ importActorData, openActorImport, openPortal, validateActorData });
  }
});

Hooks.once("ready", () => {
  if (game.system.id !== SYSTEM_ID) {
    console.warn(`${MODULE_ID} | This module requires the ${SYSTEM_ID} system.`);
    return;
  }
  game.socket.on(SOCKET_NAME, handleSocketMessage);
  window.addEventListener("message", handlePortalMessage);
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
    const payload = JSON.parse(await file.text());
    return await importActorData(payload);
  } catch (error) {
    console.error(`${MODULE_ID} | Character import failed`, error);
    ui.notifications.error(error instanceof Error ? error.message : "The Portal character could not be imported.");
    return null;
  }
}

async function handlePortalMessage(event) {
  const portalRoot = portalApplication?.element?.[0] ?? portalApplication?.element;
  const portalWindow = portalRoot?.querySelector?.(".dh2-portal-frame")?.contentWindow;
  const fromPortal = Boolean(portalWindow && event.source === portalWindow);
  const allowedOrigin = event.origin === window.location.origin
    || event.origin === "https://gregory271.github.io"
    || (event.origin === "null" && fromPortal);
  if (!allowedOrigin || !fromPortal || event.data?.source !== "dh2-portal-frame") return;
  if (event.data.type !== "create-actor" || !event.data.requestId) return;

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

async function importActorData(payload, { ownerUserId = game.user.id, openSheet = true, notify = true } = {}) {
  if (game.system.id !== SYSTEM_ID) {
    throw new Error("Activate the Dark Heresy 2nd Edition system before importing this character.");
  }

  const actorData = validateActorData(payload);
  if (ownerUserId && !game.users.get(ownerUserId)?.isGM) {
    const ownerLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    actorData.ownership = { default: 0, [ownerUserId]: ownerLevel };
  }

  const actor = await Actor.create(actorData);
  if (!actor) throw new Error("Foundry did not create the Acolyte Actor.");

  if (notify) ui.notifications.info(`${actor.name} was imported from the Dark Heresy 2E Portal.`);
  if (openSheet) actor.sheet?.render(true);
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
