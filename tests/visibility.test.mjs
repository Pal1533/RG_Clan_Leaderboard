import assert from "node:assert/strict";
import test from "node:test";

import {
  clanListenerPolicy,
  createVisibilityController,
} from "../js/live-state.js";

test("clan listener policy is phase-aware", () => {
  // Live reads only during the active window. Upcoming + ended freeze on
  // one cold fetch so we don't pay for a listener when the HUD isn't
  // writing to clan docs anyway.
  assert.equal(clanListenerPolicy("active"), "live");
  assert.equal(clanListenerPolicy("upcoming"), "oneshot");
  assert.equal(clanListenerPolicy("ended"), "oneshot");
  assert.equal(clanListenerPolicy("none"), "off");
  assert.equal(clanListenerPolicy(null), "off");
});

function fakeDocument() {
  const listeners = new Map();
  return {
    hidden: false,
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type) { listeners.get(type)?.(); },
    has(type) { return listeners.has(type); },
  };
}

test("visibility lifecycle detaches and resubscribes listeners", () => {
  const document = fakeDocument();
  let subscriptions = 0;
  let unsubscriptions = 0;
  const controller = createVisibilityController({
    document,
    subscribe: () => {
      subscriptions += 1;
      return () => { unsubscriptions += 1; };
    },
  });

  assert.equal(subscriptions, 1);
  assert.equal(controller.isAttached(), true);

  document.hidden = true;
  document.dispatch("visibilitychange");
  assert.equal(unsubscriptions, 1);
  assert.equal(controller.isAttached(), false);

  document.hidden = false;
  document.dispatch("visibilitychange");
  assert.equal(subscriptions, 2);
  assert.equal(controller.isAttached(), true);

  document.dispatch("visibilitychange");
  assert.equal(subscriptions, 2);

  controller.dispose();
  assert.equal(unsubscriptions, 2);
  assert.equal(document.has("visibilitychange"), false);
});

test("hidden pages wait to subscribe until visible", () => {
  const document = fakeDocument();
  document.hidden = true;
  let subscriptions = 0;
  const controller = createVisibilityController({
    document,
    subscribe: () => {
      subscriptions += 1;
      return () => {};
    },
  });

  assert.equal(subscriptions, 0);
  document.hidden = false;
  document.dispatch("visibilitychange");
  assert.equal(subscriptions, 1);
  controller.dispose();
});
