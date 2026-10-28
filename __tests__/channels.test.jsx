// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import ChatPage from "../src/components/ChatPage.jsx";
import init from "../src/init.jsx";
import filter from "leo-profanity";
import { StoresContext } from "../src/store/context.js";
import { createTestStores, seedStores } from "./helpers.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom lacks matchMedia (MantineProvider color scheme) and ResizeObserver
// (Mantine Popover/Menu use floating-ui): both are stubbed for this file.
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

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

// A fixed delay is flaky under parallel-runner load, so assertions on async
// effects poll for the condition instead.
const waitForInAct = async (assertion) => {
  await act(async () => {
    await vi.waitFor(assertion, { timeout: 1000, interval: 10 });
  });
};

const channelsFixture = [
  { id: "1", name: "general", removable: false },
  { id: "2", name: "random", removable: false },
  { id: "3", name: "project", removable: true },
];
const projectMessage = {
  channelId: "3",
  body: "project talk",
  username: "admin",
  removable: true,
  id: "30",
};

const makeFetchMock = ({ channels = channelsFixture, messages = [projectMessage] } = {}) =>
  vi.fn((url) => {
    if (url.endsWith("/channels")) {
      return Promise.resolve(new Response(JSON.stringify(channels), { status: 200 }));
    }
    if (url.endsWith("/messages")) {
      return Promise.resolve(new Response(JSON.stringify(messages), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  });

const makeChannelMutationFetchMock = ({
  channels = channelsFixture,
  messages = [projectMessage],
  postResponse,
  patchResponse,
  deleteResponse,
} = {}) =>
  vi.fn((url, options = {}) => {
    if (options.method === "POST" && url.endsWith("/channels")) {
      return Promise.resolve(postResponse);
    }
    if (options.method === "PATCH") {
      return Promise.resolve(patchResponse);
    }
    if (options.method === "DELETE") {
      return Promise.resolve(deleteResponse);
    }
    if (url.endsWith("/channels")) {
      return Promise.resolve(new Response(JSON.stringify(channels), { status: 200 }));
    }
    if (url.endsWith("/messages")) {
      return Promise.resolve(new Response(JSON.stringify(messages), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  });

let container;
let root;
let stores;

const renderChatPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <StoresContext.Provider value={stores}>
        <MantineProvider>
          <QueryClientProvider client={queryClient}>
            <ChatPage />
          </QueryClientProvider>
        </MantineProvider>
      </StoresContext.Provider>,
    );
  });
  return { queryClient };
};

// init-driven render: init creates the query client itself, the fake socket
// exposes handlers so a test can act as the socket server. The per-launch
// store pair from beforeEach is injected, so seeding before the render and
// flipping the token afterwards reach the exact instances the app runs on.
const renderViaSocket = async (handlers) => {
  const socket = {
    on: (event, callback) => {
      handlers[event] = callback;
    },
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const element = await init(socket, { stores });
  act(() => {
    root.render(element);
  });
};

beforeEach(() => {
  localStorage.clear();
  stores = seedStores(createTestStores(), { token: "jwt-token", username: "admin" });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

let showSpy;
let hideSpy;

beforeEach(() => {
  showSpy = vi.spyOn(notifications, "show");
  hideSpy = vi.spyOn(notifications, "hide");
});

test("channel rows show the # prefix and the menu only for removable channels", async () => {
  vi.stubGlobal("fetch", makeFetchMock());

  renderChatPage();
  await flush();

  const buttonNames = [...container.querySelectorAll("aside button")].map((b) => b.textContent);
  expect(buttonNames).toContain("# general");
  expect(buttonNames).toContain("# random");
  expect(buttonNames).toContain("# project");
  // The menu aria-label is static: exactly one exists, on the removable row.
  const menuButtons = container.querySelectorAll('button[aria-label="Управление каналом"]');
  expect(menuButtons).toHaveLength(1);
  expect(menuButtons[0].closest("div").textContent.includes("# project")).toBe(true);
});

test("clicking a channel switches the chat", async () => {
  vi.stubGlobal("fetch", makeFetchMock());

  renderChatPage();
  await flush();

  const randomButton = [...container.querySelectorAll("aside button")].find(
    (b) => b.textContent === "# random",
  );
  act(() => randomButton.click());
  await flush();

  expect(container.textContent).toContain("# random");
  expect(container.textContent).toContain("Сообщений пока нет");
  const activeButton = container.querySelector("aside button[aria-current]");
  expect(activeButton.textContent).toBe("# random");
});

test("a dangling selection falls back to the first channel after the load", async () => {
  vi.stubGlobal("fetch", makeFetchMock());
  stores.ui.setState({ currentChannelId: "99" });

  renderChatPage();
  await flush();

  const activeButton = container.querySelector("aside button[aria-current]");
  expect(activeButton.textContent).toBe("# general");
  expect(container.textContent).toContain("# general");
});

test("socket removeChannel moves the second client to the default channel", async () => {
  const fetchMock = makeFetchMock();
  vi.stubGlobal("fetch", fetchMock);
  stores.ui.setState({ currentChannelId: "3" });
  const handlers = {};

  await renderViaSocket(handlers);
  await flush();
  expect(container.textContent).toContain("# project");

  await act(async () => {
    handlers.removeChannel({ id: "3" });
    await flush();
  });

  await waitForInAct(() => expect(container.textContent).toContain("# general"));
  expect(container.textContent).not.toContain("# project");
  expect(container.textContent).toContain("Сообщений пока нет");
  const deleteCalls = fetchMock.mock.calls.filter(([, options]) => options?.method === "DELETE");
  expect(deleteCalls).toHaveLength(0);
});

test("socket newChannel appends without switching and is idempotent", async () => {
  vi.stubGlobal("fetch", makeFetchMock());
  const handlers = {};

  await renderViaSocket(handlers);
  await flush();
  expect(container.textContent).toContain("# general");

  const newChannel = { id: "4", name: "extra", removable: true };
  await act(async () => {
    handlers.newChannel(newChannel);
    handlers.newChannel(newChannel);
    await flush();
  });

  expect(container.textContent.match(/# extra/g)).toHaveLength(1);
  const activeButton = container.querySelector("aside button[aria-current]");
  expect(activeButton.textContent).toBe("# general");
});

test("socket renameChannel updates the row in place without adding a menu", async () => {
  vi.stubGlobal("fetch", makeFetchMock());
  const handlers = {};

  await renderViaSocket(handlers);
  await flush();

  await act(async () => {
    handlers.renameChannel({ id: "2", name: "random2", removable: false });
    await flush();
  });

  expect(container.textContent).toContain("# random2");
  const buttonNames = [...container.querySelectorAll("aside button")].map((b) => b.textContent);
  expect(buttonNames).not.toContain("# random");
  // The renamed row is not removable, so the single menu still belongs to
  // the project channel.
  expect(container.querySelectorAll('button[aria-label="Управление каналом"]')).toHaveLength(1);
});

test("removing every channel over the socket leaves the tree alive", async () => {
  vi.stubGlobal("fetch", makeFetchMock({ channels: [channelsFixture[2]] }));
  const handlers = {};

  await renderViaSocket(handlers);
  await flush();
  expect(container.textContent).toContain("# project");

  await act(async () => {
    handlers.removeChannel({ id: "3" });
    await flush();
  });

  expect(container.textContent).toContain("Hexlet Chat");
  expect(stores.ui.getState().currentChannelId).toBeNull();
});

test("socket events with no session do not repopulate the cache", async () => {
  const handlers = {};
  const socket = {
    on: (event, callback) => {
      handlers[event] = callback;
    },
  };
  const queryClient = new QueryClient();
  // A logged-out client: the socket itself stays connected after logout.
  // persist writes every set to localStorage, so the pair from beforeEach
  // left a token there: a fresh browser profile means clearing it before
  // the launch, exactly like a real logged-out visitor.
  localStorage.clear();
  stores = createTestStores();

  await init(socket, { queryClient, stores });
  // The afterEach hook expects a mounted root even though this test does
  // not render anything: the handlers are checked against the cache.
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    handlers.newMessage({
      channelId: "1",
      body: "ghost message",
      username: "admin",
      removable: true,
      id: "99",
    });
    handlers.newChannel({ id: "9", name: "ghost channel", removable: true });
    handlers.removeChannel({ id: "1" });
    await flush();
  });

  expect(queryClient.getQueryData(["messages"])).toBeUndefined();
  expect(queryClient.getQueryData(["channels"])).toBeUndefined();

  // Positive control: the same payloads land in the cache once a session
  // exists, so the guard above is what blocks them. The guard reads the
  // injected store at call time, so flipping it after init is reachable.
  act(() => {
    stores.auth.setState({ token: "jwt-token", username: "admin" });
  });
  await act(async () => {
    handlers.newMessage({
      channelId: "1",
      body: "live message",
      username: "admin",
      removable: true,
      id: "98",
    });
    handlers.newChannel({ id: "8", name: "live channel", removable: true });
    await flush();
  });

  expect(queryClient.getQueryData(["messages"]).map((m) => m.id)).toEqual(["98"]);
  expect(queryClient.getQueryData(["channels"]).map((c) => c.id)).toEqual(["8"]);
});

test("invalid channel payloads do not crash and invalidate the queries", async () => {
  const fetchMock = makeFetchMock();
  vi.stubGlobal("fetch", fetchMock);
  const handlers = {};

  await renderViaSocket(handlers);
  await flush();
  const before = fetchMock.mock.calls.filter(([url]) => url.endsWith("/channels")).length;

  await act(async () => {
    handlers.newChannel({ broken: true });
    handlers.removeChannel({ id: 1 });
    await flush();
  });

  expect(container.textContent).toContain("Hexlet Chat");
  await waitForInAct(() => {
    const after = fetchMock.mock.calls.filter(([url]) => url.endsWith("/channels")).length;
    expect(after).toBeGreaterThan(before);
  });
});

// React tracks input values: assigning .value directly bypasses the change
// detection, so the prototype setter must be used for controlled inputs.
const typeText = (input, text) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const submitForm = (form) => {
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
};

// Modals and menus render into portals (document.body), not into container.
const bodyInput = () => document.body.querySelector('input[name="name"]');

const openAddModal = async () => {
  const addButton = [...container.querySelectorAll("button")].find((b) => b.textContent === "+");
  act(() => addButton.click());
  await waitForInAct(() => expect(bodyInput()).not.toBeNull());
  return bodyInput();
};

// The menu toggle carries a static aria-label; it is found within the row of
// the named channel (the row button and the menu sit in the same group).
const menuButtonFor = (channelName) => {
  const rowButton = [...container.querySelectorAll("aside button")].find(
    (b) => b.textContent === `# ${channelName}`,
  );
  return rowButton?.closest("div")?.querySelector('button[aria-label="Управление каналом"]');
};

const openChannelMenu = async (channelName, itemText) => {
  act(() => menuButtonFor(channelName).click());
  await waitForInAct(() =>
    expect(
      [...document.body.querySelectorAll("[role=menuitem]")].map((i) => i.textContent),
    ).toContain(itemText),
  );
  const item = [...document.body.querySelectorAll("[role=menuitem]")].find(
    (i) => i.textContent === itemText,
  );
  act(() => item.click());
  await waitForInAct(() => expect(bodyInput()).not.toBeNull());
  return bodyInput();
};

test("add channel: focuses the input, posts, appends and switches", async () => {
  const fetchMock = makeChannelMutationFetchMock({
    postResponse: new Response(JSON.stringify({ id: "4", name: "my channel", removable: true }), {
      status: 200,
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  const { queryClient } = renderChatPage();
  await flush();

  const input = await openAddModal();
  await waitForInAct(() => expect(document.activeElement).toBe(input));

  await act(async () => {
    typeText(input, "my channel");
  });
  await act(async () => {
    submitForm(input.closest("form"));
    await flush();
  });

  const postCall = fetchMock.mock.calls.find(
    ([url, options]) => url.endsWith("/channels") && options?.method === "POST",
  );
  expect(postCall[0]).toBe("/api/v1/channels");
  expect(postCall[1].headers.Authorization).toBe("Bearer jwt-token");
  expect(JSON.parse(postCall[1].body)).toEqual({ name: "my channel" });

  await waitForInAct(() => expect(container.textContent).toContain("# my channel"));
  const activeButton = container.querySelector("aside button[aria-current]");
  expect(activeButton.textContent).toBe("# my channel");
  expect(queryClient.getQueryData(["channels"]).map((c) => c.id)).toEqual(["1", "2", "3", "4"]);
  await waitForInAct(() => expect(bodyInput()).toBeNull());
  expect(showSpy).toHaveBeenCalledWith({ message: "Канал создан", color: "green" });
});

test("add channel: length and duplicate validation block the request", async () => {
  const fetchMock = makeChannelMutationFetchMock();
  vi.stubGlobal("fetch", fetchMock);
  renderChatPage();
  await flush();

  const input = await openAddModal();
  await act(async () => {
    typeText(input, "ab");
    submitForm(input.closest("form"));
    await flush();
  });
  expect(document.body.textContent).toContain("От 3 до 20 символов");

  await act(async () => {
    typeText(input, "GENERAL");
    submitForm(input.closest("form"));
    await flush();
  });
  expect(document.body.textContent).toContain("Канал с таким именем уже существует");

  const postCalls = fetchMock.mock.calls.filter(
    ([url, options]) => url.endsWith("/channels") && options?.method === "POST",
  );
  expect(postCalls).toHaveLength(0);
});

test("add channel: a server error keeps the modal open and the text", async () => {
  const fetchMock = makeChannelMutationFetchMock({
    postResponse: new Response("", { status: 500 }),
  });
  vi.stubGlobal("fetch", fetchMock);
  renderChatPage();
  await flush();

  const input = await openAddModal();
  await act(async () => {
    typeText(input, "fresh one");
    submitForm(input.closest("form"));
    await flush();
  });

  await waitForInAct(() => expect(document.body.textContent).toContain("Не удалось создать канал"));
  expect(input.value).toBe("fresh one");
  expect(bodyInput()).not.toBeNull();
});

test("rename channel: prefilled input, PATCH and list update", async () => {
  const fetchMock = makeChannelMutationFetchMock({
    patchResponse: new Response(JSON.stringify({ id: "3", name: "projects", removable: true }), {
      status: 200,
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  renderChatPage();
  await flush();

  const input = await openChannelMenu("project", "Переименовать");
  expect(input.value).toBe("project");
  expect(document.body.textContent).toContain("Переименовать канал");

  await act(async () => {
    typeText(input, "projects");
    submitForm(input.closest("form"));
    await flush();
  });

  const patchCall = fetchMock.mock.calls.find(([, options]) => options?.method === "PATCH");
  expect(patchCall[0]).toBe("/api/v1/channels/3");
  expect(JSON.parse(patchCall[1].body)).toEqual({ name: "projects" });

  await waitForInAct(() => expect(container.textContent).toContain("# projects"));
  expect(container.textContent).not.toMatch(/# project\b/);
  await waitForInAct(() => expect(bodyInput()).toBeNull());
  expect(showSpy).toHaveBeenCalledWith({ message: "Канал переименован", color: "green" });
});

test("rename channel: a duplicate name is rejected without a request", async () => {
  const fetchMock = makeChannelMutationFetchMock();
  vi.stubGlobal("fetch", fetchMock);
  renderChatPage();
  await flush();

  const input = await openChannelMenu("project", "Переименовать");
  await act(async () => {
    typeText(input, "general");
    submitForm(input.closest("form"));
    await flush();
  });

  expect(document.body.textContent).toContain("Канал с таким именем уже существует");
  expect(input.value).toBe("general");
  const patchCalls = fetchMock.mock.calls.filter(([, options]) => options?.method === "PATCH");
  expect(patchCalls).toHaveLength(0);
});

test("remove channel: confirm, DELETE, message cleanup, default fallback", async () => {
  const fetchMock = makeChannelMutationFetchMock({
    deleteResponse: new Response(JSON.stringify({ id: "3" }), { status: 200 }),
  });
  vi.stubGlobal("fetch", fetchMock);
  stores.ui.setState({ currentChannelId: "3" });
  const { queryClient } = renderChatPage();
  await flush();
  expect(container.textContent).toContain("# project");

  const menuButton = menuButtonFor("project");
  act(() => menuButton.click());
  await waitForInAct(() =>
    expect(
      [...document.body.querySelectorAll("[role=menuitem]")].map((i) => i.textContent),
    ).toContain("Удалить"),
  );
  const removeItem = [...document.body.querySelectorAll("[role=menuitem]")].find(
    (i) => i.textContent === "Удалить",
  );
  act(() => removeItem.click());
  await waitForInAct(() => expect(document.body.textContent).toContain("Удалить канал «project»"));
  expect(document.body.textContent).toContain("Отменить");

  // The chat page itself has a form too; scope the lookup to the dialog.
  const confirmForm = document.body.querySelector('[role="dialog"] form');
  await act(async () => {
    submitForm(confirmForm);
    await flush();
  });

  const deleteCalls = fetchMock.mock.calls.filter(([, options]) => options?.method === "DELETE");
  expect(deleteCalls).toHaveLength(1);
  expect(deleteCalls[0][0]).toBe("/api/v1/channels/3");
  await waitForInAct(() => {
    expect(container.textContent).toContain("# general");
    expect(container.textContent).not.toContain("# project");
  });
  expect(queryClient.getQueryData(["messages"])).toEqual([]);
  await waitForInAct(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull());
  expect(showSpy).toHaveBeenCalledWith({ message: "Канал удалён", color: "green" });
});

test("socket disconnect and reconnect announce the connection status", async () => {
  const handlers = {};
  const socket = {
    on: (event, callback) => {
      handlers[event] = callback;
    },
  };
  const queryClient = new QueryClient();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await init(socket, { queryClient, stores });

  await act(async () => {
    handlers.disconnect();
    handlers.connect();
    await flush();
  });

  // show with an existing id is a no-op in @mantine/notifications, so the
  // sticky lost toast must be hidden explicitly before the restored one.
  expect(showSpy).toHaveBeenNthCalledWith(1, {
    id: "socket-lost",
    message: "Нет соединения. Проверьте подключение к интернету.",
    color: "red",
    autoClose: false,
  });
  expect(hideSpy).toHaveBeenCalledWith("socket-lost");
  expect(showSpy).toHaveBeenNthCalledWith(2, {
    id: "socket-restored",
    message: "Соединение восстановлено",
    color: "teal",
  });
});

test("a profane channel name is masked on create and on rename", async () => {
  const word = filter.getDictionary("ru").find((w) => /[а-яё]/i.test(w) && !/\s/.test(w));
  const mask = "*".repeat(word.length);
  const fetchMock = makeChannelMutationFetchMock({
    postResponse: new Response(JSON.stringify({ id: "4", name: mask, removable: true }), {
      status: 200,
    }),
    patchResponse: new Response(JSON.stringify({ id: "3", name: mask, removable: true }), {
      status: 200,
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  renderChatPage();
  await flush();

  // Create with a profane name.
  const addInput = await openAddModal();
  await act(async () => {
    typeText(addInput, word);
    submitForm(addInput.closest("form"));
    await flush();
  });
  const postCall = fetchMock.mock.calls.find(
    ([url, options]) => url.endsWith("/channels") && options?.method === "POST",
  );
  expect(JSON.parse(postCall[1].body).name).toBe(mask);

  // Rename with a profane name (otherwise the filter is bypassed).
  const renameInput = await openChannelMenu(mask, "Переименовать");
  await act(async () => {
    typeText(renameInput, `новый ${word}`);
    submitForm(renameInput.closest("form"));
    await flush();
  });
  const patchCall = fetchMock.mock.calls.find(([, options]) => options?.method === "PATCH");
  expect(JSON.parse(patchCall[1].body).name).toBe(`новый ${mask}`);
});

test("a pending modal cannot be closed", async () => {
  const fetchMock = makeChannelMutationFetchMock({
    postResponse: new Promise(() => {}),
  });
  vi.stubGlobal("fetch", fetchMock);
  renderChatPage();
  await flush();

  const input = await openAddModal();
  await act(async () => {
    typeText(input, "slow channel");
    submitForm(input.closest("form"));
    await flush();
  });

  // Escape and backdrop clicks must be ignored while the request is pending.
  // The wait must outlast the ~200 ms exit transition: with a broken guard
  // the modal would be gone from the DOM by the time we assert.
  await act(async () => {
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 350));
  });

  expect(bodyInput()).not.toBeNull();
});
