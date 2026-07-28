// DOM rendering for the Clash Cup page. Consumes standings produced by
// scoring.js — no Firebase, no scoring math in here.
import { eventPhase } from "./scoring.js";

const $ = id => document.getElementById(id);
const fmt = n => (n > 0 ? "+" : "") + Math.round(n).toLocaleString();
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const initials = name => {
  const p = name.replace(/[\[\]]/g, "").split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p[1]?.[0] ?? "")).toUpperCase();
};
const segColor = (base, i) =>
  `hsl(${((base ?? 268) + i * 24) % 360} 85% ${64 - i * 4}%)`;
const hueOf = hex => {
  if (!hex) return null;
  const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx === mn) return 268;
  let h;
  if (mx === r) h = (g - b) / (mx - mn) % 6;
  else if (mx === g) h = (b - r) / (mx - mn) + 2;
  else h = (r - g) / (mx - mn) + 4;
  return Math.round(h * 60 + 360) % 360;
};
const crest = (clan, cls) =>
  `<div class="${cls}" style="--accent:${clan.accent ?? "var(--grad-a)"}">${esc(clan.tagShort)}</div>`;

export function renderHeaderStats(clans, waiting = 0) {
  const players = clans.reduce((s, c) => s + c.members.length, 0);
  const parts = [
    `<b>${clans.length}</b> clans competing`,
    `<b>${players}</b> players`,
  ];
  if (waiting > 0) parts.push(`<b>${waiting}</b> waiting to sync`);
  parts.push("scores sync live from ATLAS");
  $("subLine").innerHTML = parts.join(" · ");
}

// Format "N / max" when maxMembers is known, else fall back to "N members".
const rosterLabel = (count, max) => max ? `${count} / ${max} members` : `${count} members`;

export function renderPodium(clans, ctx = {}) {
  const pod = $("podium");
  if (clans.length < 2) { pod.style.display = "none"; return; }
  const order = [clans[1], clans[0], clans[2]].filter(Boolean);
  const cls = c => c === clans[0] ? "p1" : c === clans[1] ? "p2" : "p3";
  const label = c => c === clans[0] ? "Champion Seat" : c === clans[1] ? "2nd" : "3rd";
  pod.innerHTML = order.map(c => `
    <div class="step ${cls(c)}" style="--accent:${c.accent ?? "var(--grad-a)"}">
      <div class="place">${label(c)}</div>
      ${crest(c, "crest")}
      <div class="cname">${esc(c.tag)}</div>
      <div class="cmeta">${esc(c.name)} · ${rosterLabel(c.members.length, ctx.maxMembers)}</div>
      <div class="cscore ${c.score < 0 ? "neg" : ""}">${fmt(c.score)}<small>MMR gained</small></div>
    </div>`).join("");
  pod.style.display = "grid";
}

// Which clan accordions the user has opened, kept in module state so
// re-renders (a snapshot ticks every few seconds) don't collapse them.
const openIds = new Set();

export function renderStandings(clans, ctx = {}) {
  const host = $("standings");

  // FLIP: capture current positions before we rebuild, so we can animate
  // rank swaps once the new DOM is in place.
  const prevTops = new Map();
  host.querySelectorAll(".clan").forEach(el => {
    if (el.dataset.clanId) prevTops.set(el.dataset.clanId, el.getBoundingClientRect().top);
  });

  if (!clans.length) {
    host.innerHTML = `<div class="state"><div class="big">No clans scored yet</div>
      Baselines lock the first time each member syncs during the event window.</div>`;
    return;
  }
  host.innerHTML = "";
  clans.forEach((clan, idx) => {
    const rankCls = idx === 0 ? "r1" : idx === 1 ? "r2" : idx === 2 ? "r3" : "";
    const counting = clan.rows.filter(r => (r.delta ?? 0) > 0);
    const posTotal = counting.reduce((s, r) => s + r.delta, 0) || 1;
    const hue = hueOf(clan.accent);

    const relay = counting.map((r, i) =>
      `<span style="width:${(r.delta / posTotal * 100).toFixed(1)}%;background:${segColor(hue, i)}"
        title="${esc(r.name)}: ${fmt(r.delta)}"></span>`).join("");

    const memberRows = clan.rows.map(r => {
      const ci = counting.findIndex(c => c === r);
      const seg = ci >= 0 ? segColor(hue, ci) : "var(--ink-dim)";
      const deltaCell = r.delta == null
        ? `<span class="delta none">no baseline</span>`
        : `<span class="delta ${r.delta >= 0 ? "up" : "down"}">${fmt(r.delta)}</span>`;
      return `<tr class="${r.delta == null ? "nobase" : ""}">
        <td><div class="m-name"><span class="ava" style="--seg:${seg}">${esc(initials(r.name))}</span>${esc(r.name)}</div></td>
        <td><span class="role ${esc(r.role)}">${esc(r.role)}</span></td>
        <td class="num">${r.base != null ? r.base.toLocaleString() : "—"}</td>
        <td class="num">${r.mmr != null ? r.mmr.toLocaleString() : "—"}</td>
        <td class="num">${deltaCell}</td>
      </tr>`;
    }).join("");

    const hasNoBase = clan.rows.some(r => r.delta == null);
    const memberPanelId = `members-${clan.id ?? idx}`;
    const el = document.createElement("div");
    el.className = "clan";
    if (clan.id) el.dataset.clanId = clan.id;
    if (clan.id && openIds.has(clan.id)) el.classList.add("open");
    el.innerHTML = `
      <button class="clan-row" aria-expanded="${el.classList.contains("open")}" aria-controls="${memberPanelId}">
        <span class="rank ${rankCls}">#${idx + 1}</span>
        <span class="clan-id" style="--accent:${clan.accent ?? "var(--grad-a)"}">
          ${crest(clan, "crest-sm")}
          <span class="clan-text">
            <span class="clan-name-line">
              <span class="clan-tag">${esc(clan.tag)}</span>
              <span class="clan-meta">${esc(clan.name)} · ${rosterLabel(clan.members.length, ctx.maxMembers)}</span>
            </span>
            <span class="relay ${counting.length ? "" : "empty"}" aria-hidden="true">${relay}</span>
          </span>
        </span>
        <span class="clan-score">
          <div class="val ${clan.score < 0 ? "neg" : clan.score === 0 ? "zero" : ""}">${fmt(clan.score)}</div>
          <div class="lbl">MMR gained</div>
        </span>
        <span class="chev" aria-hidden="true">▼</span>
      </button>
      <div class="members" id="${memberPanelId}" role="region" aria-label="${esc(clan.tag)} members"><div class="members-inner">
        <table>
          <thead><tr><th>Player</th><th>Role</th><th class="num">Baseline</th>
          <th class="num">Current</th><th class="num">Contribution</th></tr></thead>
          <tbody>${memberRows}</tbody>
        </table>
        ${hasNoBase ? `<div class="note">Dimmed players haven't locked a baseline this event — they'll count after their first ATLAS sync inside the window.</div>` : ""}
      </div></div>`;
    const btn = el.querySelector(".clan-row");
    btn.addEventListener("click", () => {
      const open = el.classList.toggle("open");
      btn.setAttribute("aria-expanded", open);
      if (clan.id) { open ? openIds.add(clan.id) : openIds.delete(clan.id); }
    });
    host.appendChild(el);
  });

  // FLIP part 2: animate any row that moved. Reduced-motion CSS already
  // nukes the transition, so nothing to guard for here.
  requestAnimationFrame(() => {
    host.querySelectorAll(".clan").forEach(el => {
      const id = el.dataset.clanId;
      const prev = prevTops.get(id);
      if (prev == null) return;
      const dy = prev - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform .28s cubic-bezier(.4,.0,.2,1)";
        el.style.transform = "";
      });
    });
  });
}

// Consumers (deep links, tests) can force a clan open by id — the next
// render will honor it via the persisted openIds set.
export function setOpenClan(id, open = true) {
  if (!id) return;
  if (open) openIds.add(id); else openIds.delete(id);
}

// Phase chip + live countdown. Re-derives phase from Date.now() on every
// tick so the chip transitions upcoming → active → ended without a reload.
let tick = null;
const pad2 = n => String(n).padStart(2, "0");
export function renderPhase(eventConfig) {
  const chip = $("phaseChip"), txt = $("phaseText"),
        cChip = $("countChip"), cd = $("countdown");

  const applyPhase = phase => {
    chip.classList.remove("ended", "upcoming");
    if (phase === "active") txt.textContent = "Live Event";
    else if (phase === "upcoming") { txt.textContent = "Starts Soon"; chip.classList.add("upcoming"); }
    else if (phase === "ended") { txt.textContent = "Event Ended"; chip.classList.add("ended"); }
    else { txt.textContent = "No Active Event"; chip.classList.add("ended"); }
  };

  clearInterval(tick);
  if (!eventConfig) { applyPhase("none"); cChip.style.display = "none"; return; }

  const draw = () => {
    const phase = eventPhase(eventConfig);
    applyPhase(phase);
    if (phase !== "active" && phase !== "upcoming") { cChip.style.display = "none"; return; }
    cChip.style.display = "";
    const target = phase === "active" ? eventConfig.endTime : eventConfig.startTime;
    const suffix = phase === "active" ? " left" : " to start";
    let ms = Math.max(0, target - Date.now());
    const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5),
          m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
    cd.textContent = (d ? `${d}d ${pad2(h)}h ${pad2(m)}m` : `${pad2(h)}:${pad2(m)}:${pad2(s)}`) + suffix;
  };
  draw();
  tick = setInterval(draw, 1000);
}

export function setEventTitle(name) { $("eventTitle").textContent = name; }
export function setSyncLine(html) { $("syncLine").innerHTML = html; }
export function showDemoBanner() { $("demoBanner").style.display = "block"; }

// Live "updated Xs ago" chip. Ticks every second; goes amber past 60s
// so a silent listener doesn't look fresh forever.
let lastSyncAt = null;
let syncTick = null;
const fmtAgo = ms => {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
};
export function markSynced(now = Date.now()) {
  lastSyncAt = now;
  const chip = $("syncBadge"), txt = $("syncBadgeText");
  chip.style.display = "";
  const draw = () => {
    const age = Date.now() - lastSyncAt;
    txt.textContent = `Updated ${fmtAgo(age)}`;
    chip.classList.toggle("stale", age > 60_000);
  };
  clearInterval(syncTick);
  draw();
  syncTick = setInterval(draw, 1000);
}

// Human-readable summary of what event.perms locks. Empty when no perms
// object or when nothing meaningful is disabled.
const PERM_LABELS = {
  allowLeave: "leaving",
  allowDisband: "disbanding",
  allowTransfer: "transferring",
  allowRoleChange: "role changes",
  allowRenameClan: "renaming",
  allowKick: "kicking",
  allowJoin: "new members",
  allowApprove: "approvals",
  allowClanCreate: "new clans",
};
export function renderPerms(perms) {
  const el = $("permsNote");
  if (!perms) { el.textContent = ""; return; }
  const locked = Object.entries(PERM_LABELS)
    .filter(([k]) => perms[k] === false)
    .map(([, label]) => label);
  el.textContent = locked.length
    ? `Event lock: ${locked.join(" · ")} disabled until the event ends.`
    : "";
}
