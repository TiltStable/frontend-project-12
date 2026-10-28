// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { renderToString } from "react-dom/server";

import init from "../src/init.jsx";
import { useAuthStore } from "../src/store/auth.js";

// BrowserRouter reads the current location at render time, so every test
// starts from "/" to stay independent of the previous test's pushState.
// Under renderToString React takes the store's server snapshot: zustand v5
// serves getInitialState() there, and the persist middleware pins it to the
// creator's result object. Seeding therefore mutates that snapshot, while
// setState alone would only update the client-side state.
const seedAuth = ({ token, username }) => {
  Object.assign(useAuthStore.getInitialState(), { token, username });
  useAuthStore.setState({ token, username });
};

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  seedAuth({ token: null, username: null });
});

// The app contract: init receives a socket (opened by the caller), returns
// markup ready for rendering. These checks mirror the project smoke test.
test("init subscribes to socket events", async () => {
  const socket = { on: vi.fn() };

  await init(socket);

  expect(socket.on).toHaveBeenCalledWith("newMessage", expect.any(Function));
  expect(socket.on).toHaveBeenCalledWith("connect", expect.any(Function));
  expect(socket.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
  expect(socket.on).toHaveBeenCalledWith("newChannel", expect.any(Function));
  expect(socket.on).toHaveBeenCalledWith("renameChannel", expect.any(Function));
  expect(socket.on).toHaveBeenCalledWith("removeChannel", expect.any(Function));
});

test("renders the chat page at / for an authenticated user", async () => {
  const socket = { on: vi.fn() };
  seedAuth({ token: "fake-token", username: "admin" });

  const markup = renderToString(await init(socket));

  // Queries do not fetch during SSR: the page renders in its pending state.
  expect(markup).toContain("Hexlet Chat");
  expect(markup).toContain("Загрузка");
});

test("redirects to the login page at / without a token", async () => {
  const socket = { on: vi.fn() };

  const markup = renderToString(await init(socket));

  // The header link "Hexlet Chat" is on every page now. In a static render
  // the Navigate element produces no target markup, so the regression only
  // checks that no chat content is rendered.
  expect(markup).toContain("Hexlet Chat");
  expect(markup).not.toContain("Загрузка");
  expect(markup).not.toContain("Каналы");
});

test("renders the login form at /login", async () => {
  const socket = { on: vi.fn() };
  window.history.pushState({}, "", "/login");

  const markup = renderToString(await init(socket));

  expect(markup).toContain("Ваш ник на Хекслете");
  expect(markup).toContain("Пароль");
  expect(markup).toContain("Войти");
});

test("renders the not found page for an unknown route", async () => {
  const socket = { on: vi.fn() };
  window.history.pushState({}, "", "/definitely-not-a-route");

  const markup = renderToString(await init(socket));

  expect(markup).toContain("404");
});
