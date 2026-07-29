// Boot + Firestore wiring. Same access pattern as ATLAS: SDK ESM from
// gstatic, unauthenticated reads, onSnapshot for both events/current and clans.
import { FIREBASE_CONFIG, COLLECTIONS, SDK } from "./config.js";
import { buildStandings, currentEventId } from "./scoring.js";
import { renderHeaderStats, renderPodium, renderStandings, renderPlayers,
         renderPhase, setEventTitle, setSyncLine, showDemoBanner, markSynced,
         renderPerms, setOpenClan, onPinToggle, pushTickerEvents } from "./render.js";
import { DEMO } from "./demo-data.js";
import { recordSnapshot, clanMomentum, projectScore, detectRankChanges,
         detectBigGains, historySpanMs } from "./history.js";

let eventConfig = null;
let lastRawClans = [];

// UI controls state. Only viewMode / sortMode / filterQuery / pinnedIds
// affect what renders — everything else stays derived from Firestore.
let viewMode = "clans";       // "clans" | "players"
let sortMode = "score";       // "score" | "members" | "alpha"
let filterQuery = "";
const PINNED_STORAGE_KEY = "clashcup:pinnedClans";
const loadPinned = () => {
  try { return new Set(JSON.parse(localStorage.getItem(PINNED_STORAGE_KEY) || "[]")); }
  catch { return new Set(); }
};
const pinnedIds = loadPinned();
const savePinned = () =>
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify([...pinnedIds]));

const millisOf = t => (t?.toMillis ? t.toMillis() : (typeof t === "number" ? t : 0));

function parseEventDoc(d) {
  return {
    name: d.name ?? "Clan Clash Cup",
    startTime: millisOf(d.startTime),
    endTime: millisOf(d.endTime),
    maxMembers: typeof d.maxMembers === "number" ? d.maxMembers : null,
    perms: d.perms ?? null,
  };
}

// Apply user-controlled sort/filter/pin on top of the canonical score-sorted
// standings. Pinned clans float to the top but keep their canonical rank
// number so the display stays truthful.
function applyControls(standings) {
  const q = filterQuery.trim().toLowerCase();
  let list = q
    ? standings.filter(c =>
        c.tag.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.rows.some(r => r.name.toLowerCase().includes(q)))
    : standings.slice();
  if (sortMode === "members") list.sort((a, b) => b.members.length - a.members.length);
  else if (sortMode === "alpha") list.sort((a, b) => a.tag.localeCompare(b.tag));
  // Pinned first, preserving intra-group order.
  list.sort((a, b) => (pinnedIds.has(b.id) ? 1 : 0) - (pinnedIds.has(a.id) ? 1 : 0));
  return list;
}

function buildPlayerBoard(standings) {
  const rows = [];
  standings.forEach(c => c.rows.forEach(r => {
    if (r.delta == null) return;
    rows.push({ ...r, clanTag: c.tag, clanAccent: c.accent, clanId: c.id });
  }));
  rows.sort((a, b) => b.delta - a.delta);
  return rows.slice(0, 25);
}

function renderAll({ recordHistory = false } = {}) {
  const standings = buildStandings(lastRawClans, eventConfig);
  standings.forEach((c, i) => { c.rank = i + 1; });
  // History records happen once per real snapshot (not on UI-only re-renders
  // like tab switch or sort change), so momentum reflects data velocity
  // rather than click rate.
  if (recordHistory) recordSnapshot(standings);

  const evId = currentEventId(eventConfig);
  const waiting = evId ? lastRawClans.filter(c => c.eventId !== evId).length : 0;
  const allPlayers = buildPlayerBoard(standings);
  const mvpUserId = allPlayers[0]?.userId ?? null;

  // Build per-clan momentum + projection derived from history.
  const momentumById = new Map();
  standings.forEach(c => {
    const m = clanMomentum(c.id);
    momentumById.set(c.id, m);
  });
  const winnerProjection = eventConfig?.endTime && standings[0]
    ? projectScore(standings[0].id, eventConfig.endTime)
    : null;

  const ctx = {
    maxMembers: eventConfig?.maxMembers ?? null,
    pinned: pinnedIds,
    mvpUserId,
    momentumById,
    winnerProjection,
    winnerTag: standings[0]?.tag ?? null,
    endTime: eventConfig?.endTime ?? null,
    historyReady: historySpanMs() >= 60_000,
  };

  renderHeaderStats(standings, waiting);
  renderPodium(standings, ctx);
  renderPerms(eventConfig?.perms);

  const clansBoard = document.getElementById("clansBoard");
  const playersBoard = document.getElementById("playersBoard");
  if (viewMode === "clans") {
    const list = applyControls(standings);
    renderStandings(list, { ...ctx, emptyReason: filterQuery ? "filter" : null });
    clansBoard.style.display = ""; playersBoard.style.display = "none";
  } else {
    const q = filterQuery.trim().toLowerCase();
    const players = buildPlayerBoard(standings);
    const filtered = q
      ? players.filter(p => p.name.toLowerCase().includes(q) || p.clanTag.toLowerCase().includes(q))
      : players;
    renderPlayers(filtered, { ...ctx, emptyReason: q ? "filter" : null });
    clansBoard.style.display = "none"; playersBoard.style.display = "";
  }
}

function loadDemo(reason) {
  console.warn("[ClashCup] falling back to demo data:", reason);
  showDemoBanner();
  setSyncLine("Demo mode — sample data mirroring <code>clans/{clanId}</code>.");
  eventConfig = { ...DEMO.event, maxMembers: 5, perms: null };
  const evId = currentEventId(eventConfig);
  DEMO.clans.forEach((c, i) => {
    c.eventId = evId;
    c.id = c.id ?? `demo-${i}`;
  });
  setEventTitle(eventConfig.name);
  renderPhase(eventConfig);
  lastRawClans = DEMO.clans;
  renderAll({ recordHistory: true });
  maybeApplyInitialHash();
}

async function boot() {
  let fb;
  try {
    const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`);
    const { getFirestore, doc, collection, onSnapshot } =
      await import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-firestore.js`);
    const app = initializeApp(FIREBASE_CONFIG);
    fb = { db: getFirestore(app), doc, collection, onSnapshot };
  } catch (e) { return loadDemo("SDK load failed: " + e.message); }

  try {
    fb.onSnapshot(fb.doc(fb.db, ...COLLECTIONS.eventDoc), snap => {
      if (!snap.exists()) { eventConfig = null; renderPhase(null); return; }
      eventConfig = parseEventDoc(snap.data());
      setEventTitle(eventConfig.name);
      renderPhase(eventConfig);
      renderAll();
    }, err => loadDemo("event listener: " + err.message));

    fb.onSnapshot(fb.collection(fb.db, COLLECTIONS.clans), snap => {
      lastRawClans = [];
      snap.forEach(ds => lastRawClans.push({ id: ds.id, ...ds.data() }));
      renderAll({ recordHistory: true });
      publishLiveEvents();
      markSynced();
      setSyncLine(`Live from Firestore <code>rgleaderboard</code>`);
      maybeApplyInitialHash();
    }, err => loadDemo("clans listener: " + err.message));
  } catch (e) { loadDemo(e.message); }
}

// Combine history-derived events into the ticker after each snapshot.
// Deduped by keeping tickerFeed capped and letting the module drop old rows.
function publishLiveEvents() {
  const events = [...detectRankChanges(), ...detectBigGains()];
  if (events.length) pushTickerEvents(events);
}

// Deep link: #TAG opens that clan and scrolls to it once rendered.
// Matches on canonical short tag (case-insensitive) then falls back to
// clan.id, so both "#OG" and "#actualDocId" work.
function applyHashDeepLink() {
  const key = decodeURIComponent(location.hash.slice(1)).trim().toLowerCase();
  if (!key) return;
  const standings = buildStandings(lastRawClans, eventConfig);
  const target = standings.find(c =>
    (c.tagShort ?? "").toLowerCase() === key ||
    (c.tag ?? "").toLowerCase() === key ||
    c.id === key);
  if (!target?.id) return;
  setOpenClan(target.id, true);
  renderAll();
  requestAnimationFrame(() => {
    const el = document.querySelector(`.clan[data-clan-id="${CSS.escape(target.id)}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function wireControls() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      if (tab.classList.contains("active")) return;
      document.querySelectorAll(".tab").forEach(t => {
        const on = t === tab;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on);
      });
      viewMode = tab.dataset.tab;
      renderAll();
    });
  });
  document.getElementById("filterInput").addEventListener("input", e => {
    filterQuery = e.target.value;
    renderAll();
  });
  document.getElementById("sortSelect").addEventListener("change", e => {
    sortMode = e.target.value;
    renderAll();
  });
  window.addEventListener("hashchange", applyHashDeepLink);
}

onPinToggle(id => {
  if (pinnedIds.has(id)) pinnedIds.delete(id); else pinnedIds.add(id);
  savePinned();
  renderAll();
});

// First-render hook: apply any incoming URL hash once data is present.
let hashApplied = false;
const maybeApplyInitialHash = () => {
  if (hashApplied || !lastRawClans.length || !location.hash) return;
  hashApplied = true;
  applyHashDeepLink();
};

wireControls();
boot();
