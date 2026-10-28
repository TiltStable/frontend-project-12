import { createAuthStore } from "../src/store/auth.js";
import { createUiStore } from "../src/store/ui.js";

// A fresh store pair per test mirrors the per-launch creation in init.jsx:
// no state leaks between tests, exactly like between app launches.
export const createTestStores = () => ({ auth: createAuthStore(), ui: createUiStore() });

// Server snapshots (renderToString) read getInitialState, which persist pins
// to the creator's result object: seeding must mutate both the snapshot and
// the client state, then the pair goes to init through the stores option.
export const seedStores = (stores, { token = null, username = null, ...uiState } = {}) => {
  Object.assign(stores.auth.getInitialState(), { token, username });
  stores.auth.setState({ token, username });
  stores.ui.setState({ currentChannelId: null, modal: null, ...uiState });
  return stores;
};
