const qrLibraryUrl = "https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.min.js";
let qrLibraryPromise;

export function campaignInviteUrl(campaignId, inviteCode, baseUrl = globalThis.location?.href || "https://example.invalid/") {
  const id = String(campaignId || "").trim();
  const code = String(inviteCode ?? "");
  if (!id || code.length < 8) throw new Error("A campaign ID and private invite code are required.");
  const url = new URL(baseUrl);
  url.hash = new URLSearchParams({ joinCampaign: id, invite: code }).toString();
  return url.href;
}

export function campaignInviteFromUrl(href = globalThis.location?.href || "") {
  try {
    const params = new URLSearchParams(new URL(href).hash.slice(1));
    const campaignId = String(params.get("joinCampaign") || "").trim();
    const inviteCode = String(params.get("invite") || "");
    return campaignId && inviteCode.length >= 8 ? { campaignId, inviteCode } : null;
  } catch {
    return null;
  }
}

async function loadQrLibrary() {
  if (typeof globalThis.qrcode === "function") return globalThis.qrcode;
  if (!qrLibraryPromise) {
    qrLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = qrLibraryUrl;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => typeof globalThis.qrcode === "function"
        ? resolve(globalThis.qrcode)
        : reject(new Error("The QR generator did not start correctly."));
      script.onerror = () => reject(new Error("Could not load the QR generator. Check your internet connection and try again."));
      document.head.append(script);
    }).catch((error) => {
      qrLibraryPromise = null;
      throw error;
    });
  }
  return qrLibraryPromise;
}

export async function renderCampaignQr(target, inviteUrl) {
  if (!target) throw new Error("The QR code area is unavailable.");
  const createQr = await loadQrLibrary();
  const qr = createQr(0, "M");
  qr.addData(inviteUrl);
  qr.make();
  target.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
  const svg = target.querySelector("svg");
  if (svg) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "QR code with a private campaign invitation link");
    svg.setAttribute("focusable", "false");
  }
  return svg;
}
