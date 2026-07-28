// ATLAS-identical event scoring, ported line-for-line from the userscript's
// computeClanEventScore / clanBaselineForCurrentEvent / eventPhase.
// Pure functions, no DOM, no Firebase — the main leaderboard site can
// import this module when Clash standings get integrated there, so the
// website and the in-game HUD can never disagree on the math.

export const stripTMP = s => String(s ?? "").replace(/<[^>]*>/g, "").trim();

export const currentEventId = eventConfig =>
  eventConfig ? String(eventConfig.startTime) : null;

export const eventPhase = (eventConfig, now = Date.now()) => {
  if (!eventConfig) return "none";
  if (now < eventConfig.startTime) return "upcoming";
  if (now > eventConfig.endTime) return "ended";
  return "active";
};

// A clan's baseline only counts if it belongs to the current event —
// stale baselines from a previous event score zero, same as in-game.
export const clanBaseline = (clan, eventConfig) => {
  if (!clan || !clan.eventBaseline) return null;
  if (clan.eventId !== currentEventId(eventConfig)) return null;
  return clan.eventBaseline;
};

// Per-member rows (sorted by contribution desc) + clan score.
// Score = Σ (current MMR − baseline) over members WITH a locked baseline;
// members without one get delta:null and contribute nothing yet.
export function scoreClan(clan, eventConfig) {
  const baseline = clanBaseline(clan, eventConfig);
  const rows = (clan.members ?? []).map(m => {
    const base = baseline ? baseline[m.userId] : null;
    const has = base != null && typeof m.mmr === "number";
    return {
      name: stripTMP(m.name) || "Unknown",
      role: m.role ?? "member",
      mmr: typeof m.mmr === "number" ? m.mmr : null,
      base: has ? base : null,
      delta: has ? m.mmr - base : null,
    };
  }).sort((a, b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity));
  const score = rows.reduce((s, r) => s + (r.delta ?? 0), 0);
  return { rows, score, scored: baseline != null };
}

// Full standings: decorate, filter to the current event, rank by score.
export function buildStandings(rawClans, eventConfig) {
  const evId = currentEventId(eventConfig);
  return rawClans
    .map(c => ({
      ...c,
      ...scoreClan(c, eventConfig),
      tag: stripTMP(c.tag) || stripTMP(c.name) || "?",
      tagShort: (stripTMP(c.tag) || "?").replace(/[\[\]]/g, "").slice(0, 4),
      accent: accentFrom(c.tagStyle),
      name: stripTMP(c.name) || "Unnamed clan",
    }))
    .filter(c => evId == null || c.eventId === evId)
    .sort((a, b) => b.score - a.score);
}

// First <#RRGGBB> in a clan's TextMeshPro tagStyle becomes its accent color.
export const accentFrom = style => {
  const m = /<#([0-9a-fA-F]{6})>/.exec(String(style ?? ""));
  return m ? "#" + m[1] : null;
};
