import { createStore } from "zustand";
import { persist } from "zustand/middleware";

// Session state must not outlive a single app launch (closed browser-mode
// tests launch the app repeatedly in one page), so this module only builds
// instances; init.jsx creates one per launch and hands it to the tree.
export const createAuthStore = () =>
  createStore(
    persist(
      (set) => ({
        token: null,
        username: null,
        logIn: ({ token, username }) => set({ token, username }),
        logOut: () => set({ token: null, username: null }),
      }),
      {
        name: "auth",
        // A persisted session without a username (old storage schema) would
        // poison every sent message with username: null; such a session is
        // dropped entirely so the user just logs in again. The store actions
        // always come from `current`: persist also calls merge with an empty
        // storage value, and replacing the state with a bare object would
        // strip logIn/logOut from the store.
        merge: (persisted, current) => {
          const restored = { ...current, ...persisted };
          if (typeof restored.username !== "string") {
            return { ...current, token: null, username: null };
          }
          return restored;
        },
        // Corrupted localStorage fails safe to logged-out; the log keeps the
        // cause diagnosable instead of silently dropping the session.
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.error("Auth session restore failed, user is logged out:", error);
          }
        },
      },
    ),
  );
