// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "../src/App.jsx";
import { StoresContext } from "../src/store/context.js";
import { createTestStores } from "./helpers.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom lacks matchMedia (MantineProvider) and ResizeObserver (Mantine
// overlays); App carries its own providers, so the test renders it bare.
window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub;

// An authenticated mount of "/" starts queries that would refetch with
// retries; a quiet fetch stub keeps the test deterministic.
const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 })));

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

const waitForInAct = async (assertion) => {
  await act(async () => {
    await vi.waitFor(assertion, { timeout: 1000, interval: 10 });
  });
};

let container;
let root;
let queryClient;
let stores;

const renderApp = () => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <StoresContext.Provider value={stores}>
        <App queryClient={queryClient} />
      </StoresContext.Provider>,
    );
  });
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState({}, "", "/");
  localStorage.clear();
  stores = createTestStores();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

test("the header renders on the login page", async () => {
  window.history.replaceState({}, "", "/login");
  renderApp();
  await flush();
  expect(container.querySelector('header a[href="/"]')?.textContent).toBe("Hexlet Chat");
});

test("the unknown page shows the not-found texts under the header", async () => {
  window.history.replaceState({}, "", "/unknown");
  renderApp();
  await flush();
  expect(container.querySelector('header a[href="/"]')?.textContent).toBe("Hexlet Chat");
  expect(container.textContent).toContain("страница не найдена");
  expect(container.textContent).toContain("На главную");
});

test("a logged-out user sees no logout button", async () => {
  window.history.replaceState({}, "", "/login");
  renderApp();
  await flush();

  expect(container.textContent).not.toContain("Выйти");
});

test("a logged-out user at / is redirected to the login page", async () => {
  renderApp();

  await waitForInAct(() => expect(window.location.pathname).toBe("/login"));
  expect(container.textContent).toContain("Вход");
  expect(container.textContent).toContain("Ваш ник на Хекслете");
});

test("the logout button clears the session, the cache and the ui store", async () => {
  stores.auth.setState({ token: "jwt-token", username: "admin" });
  stores.ui.setState({ currentChannelId: "3", modal: { type: "add" } });
  renderApp();
  await flush();
  queryClient.setQueryData(["channels"], [{ id: "1", name: "general", removable: false }]);

  const logoutButton = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Выйти",
  );
  act(() => logoutButton.click());
  await waitForInAct(() => expect(stores.auth.getState().token).toBeNull());

  expect(window.location.pathname).toBe("/login");
  expect(container.textContent).toContain("Ваш ник на Хекслете");
  expect(queryClient.getQueryData(["channels"])).toBeUndefined();
  expect(stores.ui.getState().currentChannelId).toBeNull();
  expect(stores.ui.getState().modal).toBeNull();
});

test("a failed load renders a visible toast with the error text", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response("", { status: 500 }))),
  );
  stores.auth.setState({ token: "jwt-token", username: "admin" });
  renderApp();

  // Notifications is mounted inside App, so the toast must actually appear
  // in the document, not only in the store.
  await waitForInAct(() =>
    expect(document.body.textContent).toContain("Не удалось загрузить данные"),
  );
});
