// @vitest-environment jsdom
import { expect, test, vi } from "vitest";

// Client-side hydration path: a token saved by a previous session must be
// back in the store right after the store module loads (persist reads
// localStorage synchronously at creation). renderToString-based tests cannot
// catch a regression here — they read the initial snapshot, not the
// hydrated state.
test("rehydrates the token from localStorage on load", async () => {
  localStorage.setItem(
    "auth",
    JSON.stringify({
      state: { token: "saved-token", username: "admin" },
      version: 0,
    }),
  );

  const { useAuthStore } = await import("../../src/store/auth.js");

  expect(useAuthStore.getState().token).toBe("saved-token");
  expect(useAuthStore.getState().username).toBe("admin");
  expect(useAuthStore.persist.hasHydrated()).toBe(true);
});

test("drops an old-schema session without a username", async () => {
  // A session persisted by an older schema carries no username: restoring it
  // would poison every sent message with username: null, so it is dropped
  // and the user lands on the login page.
  localStorage.setItem("auth", JSON.stringify({ state: { token: "saved-token" }, version: 0 }));
  // The store module was already imported by the previous test: reset the
  // module cache so the store re-creates and re-hydrates from this storage.
  vi.resetModules();

  const { useAuthStore } = await import("../../src/store/auth.js");

  expect(useAuthStore.getState().token).toBeNull();
  expect(useAuthStore.getState().username).toBeNull();
  // The store actions survive the merge.
  expect(typeof useAuthStore.getState().logIn).toBe("function");
  expect(typeof useAuthStore.getState().logOut).toBe("function");
});
