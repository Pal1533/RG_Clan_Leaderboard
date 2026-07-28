// Sample data mirroring the exact clans/{clanId} Firestore shape.
// Used only when Firestore is unreachable, so the page is reviewable
// offline and the design never renders blank.
export const DEMO = {
  event: { name: "Clan Clash Cup", startTime: Date.now() - 7 * 864e5, endTime: Date.now() + 7 * 864e5 },
  clans: [
    { tag: "[KING]", name: "Kings of the Pitch", tagStyle: "<#00FFFF>",
      eventBaseline: { u1: 5900, u2: 5100, u3: 4420, u4: 3980, u5: 2760 },
      members: [
        { userId: "u1", name: "JesusDied4U", role: "leader", mmr: 6365 },
        { userId: "u2", name: "Xuuya", role: "coleader", mmr: 5869 },
        { userId: "u3", name: "Pal", role: "member", mmr: 4890 },
        { userId: "u4", name: "Ryme", role: "member", mmr: 4245 },
        { userId: "u5", name: "GoatHerder", role: "member", mmr: 2985 },
        { userId: "u6", name: "TurboLamb", role: "member", mmr: 2140 },
      ] },
    { tag: "[SBA]", name: "Squad Break Alpha", tagStyle: "<#A855F7>",
      eventBaseline: { s1: 7795, s2: 6510, s3: 3781, s4: 5364 },
      members: [
        { userId: "s1", name: "Calvi56", role: "leader", mmr: 7785 },
        { userId: "s2", name: "BlakeRG", role: "coleader", mmr: 6690 },
        { userId: "s3", name: "Alexon", role: "member", mmr: 4310 },
        { userId: "s4", name: "truly a duck", role: "member", mmr: 5601 },
      ] },
    { tag: "[FURY]", name: "Full Send Fury", tagStyle: "<#FF7A3C>",
      eventBaseline: { f1: 7033, f2: 5410, f3: 4980, f4: 4100, f5: 3350 },
      members: [
        { userId: "f1", name: "Croxyyys", role: "leader", mmr: 7290 },
        { userId: "f2", name: "SayoshiRG", role: "coleader", mmr: 6009 },
        { userId: "f3", name: "Debliger", role: "member", mmr: 5115 },
        { userId: "f4", name: "Debliger 1", role: "member", mmr: 4088 },
        { userId: "f5", name: "Jazr RL", role: "member", mmr: 3627 },
      ] },
    { tag: "[NOVA]", name: "Nova Strikers", tagStyle: "<#E44BE0>",
      eventBaseline: { n1: 5120, n2: 4470, n3: 3900 },
      members: [
        { userId: "n1", name: "Cometline", role: "leader", mmr: 5480 },
        { userId: "n2", name: "pakshi", role: "member", mmr: 4610 },
        { userId: "n3", name: "Chicken Jockey", role: "member", mmr: 3705 },
      ] },
  ],
};
