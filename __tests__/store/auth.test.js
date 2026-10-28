// @vitest-environment jsdom
import { beforeEach, expect, test } from "vitest";

import { createAuthStore } from "../../src/store/auth.js";

// Each test gets its own store instance, exactly like each app launch does:
// persist hydrates synchronously from localStorage at creation.
let auth;

beforeEach(() => {
  localStorage.clear();
  auth = createAuthStore();
});

test("logIn stores token and username", () => {
  auth.getState().logIn({ token: "jwt-token", username: "admin" });

  const state = auth.getState();
  expect(state.token).toBe("jwt-token");
  expect(state.username).toBe("admin");
});

test("logIn persists credentials to localStorage", () => {
  auth.getState().logIn({ token: "jwt-token", username: "admin" });

  const persisted = JSON.parse(localStorage.getItem("auth"));
  expect(persisted.state.token).toBe("jwt-token");
  expect(persisted.state.username).toBe("admin");
});

test("logOut clears credentials in state and localStorage", () => {
  auth.getState().logIn({ token: "jwt-token", username: "admin" });

  auth.getState().logOut();

  const state = auth.getState();
  expect(state.token).toBeNull();
  expect(state.username).toBeNull();
  const persisted = JSON.parse(localStorage.getItem("auth"));
  expect(persisted.state.token).toBeNull();
});
