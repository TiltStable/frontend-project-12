// @vitest-environment jsdom
import { beforeEach, expect, test } from "vitest";

import { createAuthStore } from "../../src/store/auth.js";

// Client-side hydration path: a token saved by a previous session must be
// back in the store right after the store is created (persist reads
// localStorage synchronously at creation). renderToString-based tests cannot
// catch a regression here — they read the initial snapshot, not the
// hydrated state. With per-launch factories a fresh createAuthStore() per
// test replays the exact launch-time hydration.
beforeEach(() => {
  localStorage.clear();
});

test("rehydrates the token from localStorage at creation", () => {
  localStorage.setItem(
    "auth",
    JSON.stringify({
      state: { token: "saved-token", username: "admin" },
      version: 0,
    }),
  );

  const auth = createAuthStore();

  expect(auth.getState().token).toBe("saved-token");
  expect(auth.getState().username).toBe("admin");
  expect(auth.persist.hasHydrated()).toBe(true);
});

test("drops an old-schema session without a username", () => {
  // A session persisted by an older schema carries no username: restoring it
  // would poison every sent message with username: null, so it is dropped
  // and the user lands on the login page.
  localStorage.setItem("auth", JSON.stringify({ state: { token: "saved-token" }, version: 0 }));

  const auth = createAuthStore();

  expect(auth.getState().token).toBeNull();
  expect(auth.getState().username).toBeNull();
  // The store actions survive the merge.
  expect(typeof auth.getState().logIn).toBe("function");
  expect(typeof auth.getState().logOut).toBe("function");
});
