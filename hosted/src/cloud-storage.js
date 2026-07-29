import { supabaseConfig } from "./supabase-config.js";

const campaignStorageKey = "dh2-shared-campaign";
let client = null;
let session = null;
let liveChannel = null;

export function cloudIsConfigured() {
  return Boolean(supabaseConfig.url && supabaseConfig.publishableKey);
}

export function savedCampaignConnection() {
  try {
    return JSON.parse(localStorage.getItem(campaignStorageKey) || "null");
  } catch {
    return null;
  }
}

export function clearCampaignConnection() {
  localStorage.removeItem(campaignStorageKey);
  if (liveChannel && client) client.removeChannel(liveChannel);
  liveChannel = null;
}

async function getClient() {
  if (!cloudIsConfigured()) return null;
  if (!client) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    client = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  if (!session) {
    const current = await client.auth.getSession();
    session = current.data.session;
    if (!session) {
      const anonymous = await client.auth.signInAnonymously();
      if (anonymous.error) throw anonymous.error;
      session = anonymous.data.session;
    }
  }
  return client;
}

export async function connectToCampaign({ campaignId, inviteCode, displayName }) {
  const supabase = await getClient();
  if (!supabase) throw new Error("Supabase has not been configured.");
  const { data, error } = await supabase.rpc("join_campaign", {
    requested_campaign: campaignId,
    supplied_invite_code: inviteCode,
    member_display_name: displayName,
  });
  if (error) throw error;
  const connection = {
    campaignId,
    displayName,
    role: "player",
    connectedAt: new Date().toISOString(),
  };
  localStorage.setItem(campaignStorageKey, JSON.stringify(connection));
  return { connection, membership: data };
}

export async function createSharedCampaign({ name, inviteCode, displayName }) {
  const supabase = await getClient();
  if (!supabase) throw new Error("Supabase has not been configured.");
  const { data, error } = await supabase.rpc("create_campaign", {
    campaign_name: name,
    supplied_invite_code: inviteCode,
    creator_display_name: displayName,
  });
  if (error) throw error;
  const campaignId = data;
  const connection = {
    campaignId,
    displayName,
    role: "gm",
    connectedAt: new Date().toISOString(),
  };
  localStorage.setItem(campaignStorageKey, JSON.stringify(connection));
  return { connection };
}

export async function listCloudCharacters() {
  const connection = savedCampaignConnection();
  if (!connection) return [];
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("characters")
    .select("id,owner_id,character_data,step,origin,created_at,updated_at")
    .eq("campaign_id", connection.campaignId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((entry) => ({
    id: entry.id,
    ownerId: entry.owner_id,
    character: entry.character_data,
    step: entry.step,
    origin: entry.origin || "Shared campaign",
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
  }));
}

export async function saveCloudCharacter(record) {
  const connection = savedCampaignConnection();
  if (!connection) return { skipped: true };
  const supabase = await getClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Anonymous player session is unavailable.");
  const existing = await supabase
    .from("characters")
    .select("id")
    .eq("id", record.id)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const updated = await supabase.from("characters").update({
      character_data: record.character,
      step: record.step,
      origin: record.origin,
      updated_at: record.updatedAt,
    }).eq("id", record.id);
    if (updated.error) throw updated.error;
  } else {
    const inserted = await supabase.from("characters").insert({
      id: record.id,
      campaign_id: connection.campaignId,
      owner_id: user.id,
      character_data: record.character,
      step: record.step,
      origin: record.origin,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    });
    if (inserted.error) throw inserted.error;
  }
  return { saved: true };
}

export async function deleteCloudCharacter(id) {
  const connection = savedCampaignConnection();
  if (!connection) return { skipped: true };
  const supabase = await getClient();
  const { error } = await supabase.from("characters").delete().eq("id", id);
  if (error) throw error;
  return { deleted: true };
}

export async function subscribeToCloudCharacters(onChange) {
  const connection = savedCampaignConnection();
  if (!connection) return () => {};
  const supabase = await getClient();
  if (liveChannel) await supabase.removeChannel(liveChannel);
  liveChannel = supabase
    .channel(`campaign-${connection.campaignId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "characters",
      filter: `campaign_id=eq.${connection.campaignId}`,
    }, () => onChange())
    .subscribe();
  return () => {
    if (liveChannel) supabase.removeChannel(liveChannel);
    liveChannel = null;
  };
}
