// Cross-session read-budget telemetry. Every admin session uploads its
// current read counters to admin_read_stats/{yyyymmdd_sessionId} so we can
// see WHICH features drove reads over a day, not just the total from the
// Firebase console. Toggleable — set `?telemetry=off` to skip uploads.
//
// Cost model: 1 write per session per upload interval + a final beforeunload
// flush via sendBeacon. At 12 admin sessions/day × 5 uploads each = 60
// writes/day, well inside free tier. Reads happen only when we query the
// collection to view the stats, which is admin-triggered.
//
// This is *observability infrastructure*. If we don't need it long-term,
// flip TELEMETRY_ENABLED = false in config or turn off the admin.js
// bootstrap. The gateway.setReadStat write path is defensive — it swallows
// errors so a Firestore hiccup doesn't cascade into UI failures.
//
// This is the CLAN-site copy of the leaderboard site's read-telemetry.js.
// The only intentional divergence is the default `source` option — this
// file defaults to "clan" so the aggregator in rg_player_leaderboard's
// read-stats-query.js can bucket clan-site sessions correctly even when
// the same browser is used to sign in to both sites (which defeats the
// old userAgent-regex fallback).

const HAS_CRYPTO_UUID = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";
const SESSION_ID = HAS_CRYPTO_UUID
  ? crypto.randomUUID()
  : `s${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
const SESSION_STARTED_AT = new Date().toISOString();

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}
function docKey(date = todayKey()) {
  // Flat collection so we can query with a simple where("date","==",X).
  // {date}_{sessionId} keeps the doc-id sortable + human-readable.
  return `${date}_${SESSION_ID}`;
}

export function createReadTelemetryUploader({
  gateway,
  budget,
  isAdmin,
  source = "clan",
  uploadIntervalMs = 60_000,
  logger = typeof console !== "undefined" ? console : null,
  now = () => Date.now(),
  // "admin" (default) writes to admin_read_stats and requires isAdmin().
  // "visitor" writes to visitor_read_stats and includes a deviceId. Rules
  // don't require auth for the visitor collection, so anonymous clan-page
  // browsers can report their reads too.
  mode = "admin",
  deviceId = null,
} = {}) {
  const writeMethod = mode === "visitor" ? "setVisitorStat" : "setReadStat";
  if (!gateway || typeof gateway[writeMethod] !== "function") {
    return { start() {}, stop() {}, upload: async () => {}, sessionId: SESSION_ID };
  }

  // Clamp to <=16 chars to match the Firestore rule; fall back to "clan"
  // if a caller passes something unexpected. This is the field the
  // aggregator prefers over userAgent for source attribution.
  const normalizedSource = typeof source === "string" && source.length > 0
    ? source.slice(0, 16)
    : "clan";

  let intervalHandle = null;
  let lastPayloadKey = "";
  let running = false;

  async function upload({ final = false } = {}) {
    if (!running) return;
    // Admin mode gates uploads on the isAdmin() check; visitor mode skips
    // that so anonymous clan-page browsers can still report their reads.
    if (mode === "admin" && (typeof isAdmin !== "function" || !isAdmin())) return;
    const snap = budget?.snapshot?.() || { total: 0, perLabel: {}, tripped: false };
    // Skip identical payloads to avoid burning writes on quiet sessions.
    const payloadKey = `${snap.total}:${JSON.stringify(snap.perLabel || {})}:${snap.tripped ? 1 : 0}`;
    if (!final && payloadKey === lastPayloadKey) return;
    lastPayloadKey = payloadKey;

    const payload = {
      date: todayKey(),
      sessionId: SESSION_ID,
      startedAt: SESSION_STARTED_AT,
      updatedAt: new Date().toISOString(),
      total: Number(snap.total) || 0,
      perLabel: snap.perLabel && typeof snap.perLabel === "object" ? { ...snap.perLabel } : {},
      tripped: Boolean(snap.tripped),
      userAgent: typeof navigator !== "undefined" ? String(navigator.userAgent || "").slice(0, 200) : "",
      source: normalizedSource,
    };
    if (mode === "visitor") {
      // Rule requires a non-empty deviceId. Falls back to sessionId if the
      // caller didn't supply one so the write still passes shape check.
      payload.deviceId = String(deviceId || SESSION_ID);
    }

    try {
      await gateway[writeMethod](docKey(payload.date), payload);
    } catch (err) {
      logger?.warn?.("[RG SITE] telemetry upload failed:", err?.message || err);
    }
  }

  function start() {
    if (running) return;
    running = true;
    // Fire immediately so the day's first admin action is captured, then poll.
    upload();
    intervalHandle = setInterval(() => upload(), uploadIntervalMs);
    // beforeunload can't do async — the setDoc RPC may race the tab close.
    // A final synchronous-ish upload via the standard client is the best we
    // can do here; if it drops in flight, the last periodic write is the
    // fallback record.
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleUnload);
      window.addEventListener("pagehide", handleUnload);
    }
  }

  function stop() {
    if (!running) return;
    running = false;
    if (intervalHandle != null) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    }
  }

  function handleUnload() {
    // Fire and forget — we can't await inside a beforeunload handler and get
    // consistent behavior across browsers. The synchronous kick of the write
    // is enough; the client's connection stays open long enough in most
    // cases for the write to complete.
    upload({ final: true });
  }

  return { start, stop, upload, sessionId: SESSION_ID };
}

export const READ_TELEMETRY_SESSION_ID = SESSION_ID;
