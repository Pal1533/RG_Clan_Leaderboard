import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStandings,
  buildWaitingRoster,
  scoreClan,
  startingLineupUids,
  startingLineupSize,
} from "../js/scoring.js";

const event = {
  name: "Cup",
  startTime: 1000,
  endTime: 9000,
};

test("legacy and map clan shapes produce the same event total", () => {
  const legacy = {
    id: "legacy",
    eventId: "1000",
    members: [
      { userId: "a", name: "A", mmr: 1150, syncedAt: 10 },
      { userId: "b", name: "B", mmr: 950, syncedAt: 10 },
    ],
    eventBaseline: { a: 1000, b: 1000 },
  };
  const current = {
    id: "current",
    eventId: "1000",
    members: {
      a: { name: "A", mmr: 1150, syncedAt: 10, eventBaseline: 1000 },
      b: { name: "B", mmr: 950, syncedAt: 10, eventBaseline: 1000 },
    },
  };

  assert.equal(scoreClan(legacy, event).score, 100);
  assert.equal(scoreClan(current, event).score, 100);
});

test("scoring uses newer memberStats without changing negative semantics", () => {
  const clan = {
    eventId: "1000",
    members: {
      a: { name: "A", mmr: 1100, syncedAt: 10, eventBaseline: 1000 },
      b: { name: "B", mmr: 900, syncedAt: 20, eventBaseline: 1000 },
    },
    memberStats: {
      a: { mmr: 1250, syncedAt: 11 },
      b: { mmr: 5000, syncedAt: 19 },
    },
  };

  const scored = scoreClan(clan, event);
  assert.equal(scored.score, 150);
  assert.deepEqual(scored.rows.map(row => row.delta), [250, -100]);
});

test("standings exclude stale event clans and keep normalized member arrays", () => {
  const standings = buildStandings([
    {
      id: "new",
      tag: "NEW",
      eventId: "1000",
      members: { a: { mmr: 1100, eventBaseline: 1000 } },
    },
    {
      id: "old",
      tag: "OLD",
      eventId: "999",
      members: [{ userId: "b", mmr: 2000 }],
      eventBaseline: { b: 1000 },
    },
  ], event);

  assert.equal(standings.length, 1);
  assert.equal(standings[0].id, "new");
  assert.ok(Array.isArray(standings[0].members));
  assert.equal(standings[0].score, 100);
});

test("waiting roster includes stale clans and members without a baseline", () => {
  const waiting = buildWaitingRoster([
    {
      id: "stale",
      tag: "OLD",
      eventId: "999",
      members: { a: { name: "Alpha", eventBaseline: 700 } },
    },
    {
      id: "current",
      tag: "NOW",
      eventId: "1000",
      members: {
        b: { name: "Bravo", eventBaseline: 800 },
        c: { name: "Charlie" },
      },
    },
  ], event);

  assert.deepEqual(waiting.map(group => [
    group.clanTag,
    group.members.map(member => member.name),
  ]), [
    ["OLD", ["Alpha"]],
    ["NOW", ["Charlie"]],
  ]);
});

// ------- Bench feature -------

const benchEvent = {
  name: "Cup",
  startTime: 1000,
  endTime: 9000,
  perms: { useBench: true },
};

test("bench off: all members score, no isBench flag", () => {
  const clan = {
    eventId: "1000",
    members: [
      { userId: "a", name: "A", mmr: 1100, joinedAt: 1, eventBaseline: 1000 },
      { userId: "b", name: "B", mmr: 1200, joinedAt: 2, eventBaseline: 1000 },
      { userId: "c", name: "C", mmr: 1300, joinedAt: 3, eventBaseline: 1000 },
    ],
  };
  const scored = scoreClan(clan, event);
  assert.equal(scored.score, 600);
  assert.deepEqual(scored.rows.map(r => r.isBench), [false, false, false]);
});

test("bench on with 6 members, explicit lineup: only starters score", () => {
  const clan = {
    eventId: "1000",
    startingLineup: ["a", "b", "c", "d", "e"],
    members: [
      { userId: "a", name: "A", mmr: 1100, joinedAt: 1, eventBaseline: 1000 },
      { userId: "b", name: "B", mmr: 1100, joinedAt: 2, eventBaseline: 1000 },
      { userId: "c", name: "C", mmr: 1100, joinedAt: 3, eventBaseline: 1000 },
      { userId: "d", name: "D", mmr: 1100, joinedAt: 4, eventBaseline: 1000 },
      { userId: "e", name: "E", mmr: 1100, joinedAt: 5, eventBaseline: 1000 },
      { userId: "f", name: "F", mmr: 9999, joinedAt: 6, eventBaseline: 1000 },
    ],
  };
  const scored = scoreClan(clan, benchEvent);
  // 5 starters × 100 delta = 500; F's +8999 is bench, ignored.
  assert.equal(scored.score, 500);
  const fRow = scored.rows.find(r => r.userId === "f");
  assert.equal(fRow.isBench, true);
});

test("bench on with 6 members, no explicit lineup: oldest-5-by-joinedAt are starters", () => {
  const clan = {
    eventId: "1000",
    members: [
      { userId: "a", name: "A", mmr: 1100, joinedAt: 1, eventBaseline: 1000 },
      { userId: "b", name: "B", mmr: 1100, joinedAt: 2, eventBaseline: 1000 },
      { userId: "c", name: "C", mmr: 1100, joinedAt: 3, eventBaseline: 1000 },
      { userId: "d", name: "D", mmr: 1100, joinedAt: 4, eventBaseline: 1000 },
      { userId: "e", name: "E", mmr: 1100, joinedAt: 5, eventBaseline: 1000 },
      { userId: "f", name: "F", mmr: 9999, joinedAt: 6, eventBaseline: 1000 },
    ],
  };
  const scored = scoreClan(clan, benchEvent);
  assert.equal(scored.score, 500);
  const fRow = scored.rows.find(r => r.userId === "f");
  assert.equal(fRow.isBench, true);
});

test("startingLineupSize honors events/current.startingLineupSize override", () => {
  assert.equal(startingLineupSize({}), 5);
  assert.equal(startingLineupSize({ startingLineupSize: 6 }), 6);
  assert.equal(startingLineupSize({ startingLineupSize: 21 }), 5); // out of range
  assert.equal(startingLineupSize({ startingLineupSize: 0 }), 5);  // out of range
});

test("startingLineupUids caps to lineup size (dynamic)", () => {
  const clan = {
    members: [
      { userId: "a", joinedAt: 1 },
      { userId: "b", joinedAt: 2 },
      { userId: "c", joinedAt: 3 },
      { userId: "d", joinedAt: 4 },
      { userId: "e", joinedAt: 5 },
      { userId: "f", joinedAt: 6 },
      { userId: "g", joinedAt: 7 },
    ],
  };
  const sevenPlayerEvent = { ...benchEvent, startingLineupSize: 6 };
  assert.equal(startingLineupUids(clan, sevenPlayerEvent).length, 6);
  assert.equal(startingLineupUids(clan, benchEvent).length, 5);
});
