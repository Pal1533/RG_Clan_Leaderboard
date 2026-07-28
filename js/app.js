// Boot + Firestore wiring. Same access pattern as ATLAS: SDK ESM from
// gstatic, unauthenticated reads, onSnapshot for both events/current and clans.
import { FIREBASE_CONFIG, COLLECTIONS, SDK } from "./config.js";
import { buildStandings, currentEventId } from "./scoring.js";
import { renderHeaderStats, renderPodium, renderStandings, renderPhase,
         setEventTitle, setSyncLine, showDemoBanner, markSynced,
         renderPerms } from "./render.js";
import { DEMO } from "./demo-data.js";

let eventConfig = null;
let lastRawClans = [];

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

function renderAll() {
  const standings = buildStandings(lastRawClans, eventConfig);
  const evId = currentEventId(eventConfig);
  const waiting = evId ? lastRawClans.filter(c => c.eventId !== evId).length : 0;
  const ctx = { maxMembers: eventConfig?.maxMembers ?? null };
  renderHeaderStats(standings, waiting);
  renderPodium(standings, ctx);
  renderStandings(standings, ctx);
  renderPerms(eventConfig?.perms);
}

function loadDemo(reason) {
  console.warn("[ClashCup] falling back to demo data:", reason);
  showDemoBanner();
  setSyncLine("Demo mode — sample data mirroring <code>clans/{clanId}</code>.");
  eventConfig = { ...DEMO.event, maxMembers: 5, perms: null };
  const evId = currentEventId(eventConfig);
  DEMO.clans.forEach(c => { c.eventId = evId; });
  setEventTitle(eventConfig.name);
  renderPhase(eventConfig);
  lastRawClans = DEMO.clans;
  renderAll();
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
      renderAll();
      markSynced();
      setSyncLine(`Live from Firestore <code>rgleaderboard</code>`);
    }, err => loadDemo("clans listener: " + err.message));
  } catch (e) { loadDemo(e.message); }
}

boot();
