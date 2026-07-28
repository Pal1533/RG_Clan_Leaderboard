// Boot + Firestore wiring. Same access pattern as ATLAS: SDK ESM from
// gstatic, unauthenticated reads, onSnapshot for live standings.
import { FIREBASE_CONFIG, COLLECTIONS, SDK } from "./config.js";
import { buildStandings, eventPhase, currentEventId } from "./scoring.js";
import { renderHeaderStats, renderPodium, renderStandings, renderPhase,
         setEventTitle, setSyncLine, showDemoBanner } from "./render.js";
import { DEMO } from "./demo-data.js";

let eventConfig = null;

function renderAll(rawClans) {
  const standings = buildStandings(rawClans, eventConfig);
  renderHeaderStats(standings);
  renderPodium(standings);
  renderStandings(standings);
}

function loadDemo(reason) {
  console.warn("[ClashCup] falling back to demo data:", reason);
  showDemoBanner();
  setSyncLine("Demo mode — sample data mirroring <code>clans/{clanId}</code>.");
  eventConfig = DEMO.event;
  const evId = currentEventId(eventConfig);
  DEMO.clans.forEach(c => { c.eventId = evId; });
  setEventTitle(DEMO.event.name);
  renderPhase(eventConfig, eventPhase(eventConfig));
  renderAll(DEMO.clans);
}

async function boot() {
  let fb;
  try {
    const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`);
    const { getFirestore, doc, getDoc, collection, onSnapshot } =
      await import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-firestore.js`);
    const app = initializeApp(FIREBASE_CONFIG);
    fb = { db: getFirestore(app), doc, getDoc, collection, onSnapshot };
  } catch (e) { return loadDemo("SDK load failed: " + e.message); }

  try {
    const snap = await fb.getDoc(fb.doc(fb.db, ...COLLECTIONS.eventDoc));
    if (snap.exists()) {
      const d = snap.data();
      eventConfig = {
        name: d.name ?? "Clan Clash Cup",
        startTime: d.startTime?.toMillis ? d.startTime.toMillis() : (d.startTime ?? 0),
        endTime: d.endTime?.toMillis ? d.endTime.toMillis() : (d.endTime ?? 0),
      };
      setEventTitle(eventConfig.name);
    }
    renderPhase(eventConfig, eventPhase(eventConfig));

    fb.onSnapshot(fb.collection(fb.db, COLLECTIONS.clans), snap => {
      const clans = [];
      snap.forEach(ds => clans.push({ id: ds.id, ...ds.data() }));
      renderAll(clans);
      setSyncLine(`Live from Firestore <code>rgleaderboard</code> · last update ${new Date().toLocaleTimeString()}`);
    }, err => loadDemo("clans listener: " + err.message));
  } catch (e) { loadDemo(e.message); }
}

boot();
