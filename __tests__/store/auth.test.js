// @vitest-environment jsdom
import { beforeEach, expect, test } from "vitest";

import { useAuthStore } from "../../src/store/auth.js";

beforeEach(() => {
  useAuthStore.getState().logOut();
});

test("logIn stores token and username", () => {
  useAuthStore.getState().logIn({ token: "jwt-token", username: "admin" });

  const state = useAuthStore.getState();
  expect(state.token).toBe("jwt-token");
  expect(state.username).toBe("admin");
});

test("logIn persists credentials to localStorage", () => {
  useAuthStore.getState().logIn({ token: "jwt-token", username: "admin" });

  const persisted = JSON.parse(localStorage.getItem("auth"));
  expect(persisted.state.token).toBe("jwt-token");
  expect(persisted.state.username).toBe("admin");
});

test("logOut clears credentials in state and localStorage", () => {
  useAuthStore.getState().logIn({ token: "jwt-token", username: "admin" });

  useAuthStore.getState().logOut();

  const state = useAuthStore.getState();
  expect(state.token).toBeNull();
  expect(state.username).toBeNull();
  const persisted = JSON.parse(localStorage.getItem("auth"));
  expect(persisted.state.token).toBeNull();
});
