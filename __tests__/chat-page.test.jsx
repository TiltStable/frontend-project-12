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

// jsdom does not implement matchMedia; MantineProvider's color scheme hook
// needs it on client-side renders.
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

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

// A fixed delay is flaky under parallel-runner load (the POST round-trip may
// outlive it), so assertions on async effects poll for the condition instead.
const waitForInAct = async (assertion) => {
  await act(async () => {
    await vi.waitFor(assertion, { timeout: 1000, interval: 10 });
  });
};

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
};

beforeEach(() => {
  localStorage.clear();
  stores = seedStores(createTestStores(), { token: "jwt-token", username: "admin" });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

test("renders channels and the selected channel messages", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.endsWith("/channels")
              ? [
                  { id: "1", name: "general", removable: false },
                  { id: "2", name: "random", removable: false },
                ]
              : [
                  {
                    channelId: "1",
                    body: "hello there",
                    username: "admin",
                    removable: true,
                    id: "3",
                  },
                ],
          ),
          { status: 200 },
        ),
      ),
    ),
  );

  renderChatPage();
  await flush();

  // The default-selection effect picks the first channel.
  expect(container.textContent).toContain("# general");
  expect(container.textContent).toContain("general");
  expect(container.textContent).toContain("random");
  expect(container.textContent).toContain("admin: hello there");
  // Translation strings not covered anywhere else (placeholder is an
  // attribute, so textContent does not see it).
  expect(container.querySelector('input[name="body"]')?.placeholder).toBe("Введите сообщение…");
  expect(container.textContent).toContain("Отправить");

  // Selecting a channel via the store moves the highlight.
  act(() => stores.ui.getState().setCurrentChannel("2"));
  await flush();
  expect(container.textContent).toContain("# random");
  expect(container.textContent).toContain("Сообщений пока нет");
});

test("does not crash when channels fail while messages succeed", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url) =>
      Promise.resolve(
        url.endsWith("/channels")
          ? new Response("", { status: 500 })
          : new Response(JSON.stringify([]), { status: 200 }),
      ),
    ),
  );

  renderChatPage();
  await flush();

  // Regression: Messages used to call channels.find on undefined and crash
  // the whole tree when only the channels request failed. The tree must stay
  // alive: the h1 is rendered unconditionally.
  expect(container.textContent).toContain("Ошибка соединения");
  expect(container.textContent).toContain("Hexlet Chat");
});

test("a failed channels load announces a toast and deduplicates by id", async () => {
  const showSpy = vi.spyOn(notifications, "show");
  vi.stubGlobal(
    "fetch",
    vi.fn((url) =>
      Promise.resolve(
        url.endsWith("/channels")
          ? new Response("", { status: 500 })
          : new Response(JSON.stringify([]), { status: 200 }),
      ),
    ),
  );

  renderChatPage();
  await flush();

  await waitForInAct(() =>
    expect(showSpy).toHaveBeenCalledWith({
      id: "channels-load-error",
      message: "Ошибка соединения",
      color: "red",
    }),
  );
  // A refetch reproducing the same failure does not stack a copy: show with
  // an existing id is a no-op, so every call keeps the same id.
  await act(async () => {
    await flush();
  });
  const ids = showSpy.mock.calls.map(([options]) => options.id);
  expect(new Set(ids)).toEqual(new Set(["channels-load-error"]));
});

test("a 401 on load shows the session error, not a network one", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response("", { status: 401 }))),
  );

  renderChatPage();
  await flush();

  // An expired session is actionable; showing the generic network text would
  // send the user into pointless retries.
  expect(container.textContent).toContain("Сессия устарела, войдите заново");
  expect(container.textContent).not.toContain("Ошибка соединения");
  expect(container.textContent).toContain("Hexlet Chat");
});

// React tracks input values: assigning .value directly bypasses the change
// detection, so the prototype setter must be used for controlled inputs.
const typeText = (input, text) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

test("sends a message and shows it in the feed", async () => {
  stores.ui.setState({ currentChannelId: "1" });
  const fetchMock = vi.fn((url, options) => {
    if (url.endsWith("/channels")) {
      return Promise.resolve(
        new Response(JSON.stringify([{ id: "1", name: "general", removable: false }]), {
          status: 200,
        }),
      );
    }
    if (url.endsWith("/messages") && options?.method === "POST") {
      const posted = JSON.parse(options.body);
      return Promise.resolve(
        new Response(JSON.stringify({ ...posted, removable: true, id: "9" }), { status: 200 }),
      );
    }
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  });
  vi.stubGlobal("fetch", fetchMock);

  renderChatPage();
  await flush();

  const input = container.querySelector("input[name=body]");
  await act(async () => {
    typeText(input, "my new message");
  });
  await act(async () => {
    container
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });

  const postCall = fetchMock.mock.calls.find(
    ([url, options]) => url.endsWith("/messages") && options?.method === "POST",
  );
  expect(JSON.parse(postCall[1].body)).toEqual({
    channelId: "1",
    body: "my new message",
    username: "admin",
  });
  await waitForInAct(() => expect(container.textContent).toContain("my new message"));
  expect(input.value).toBe("");
});

test("keeps the input text and shows an error when sending fails", async () => {
  stores.ui.setState({ currentChannelId: "1" });
  vi.stubGlobal(
    "fetch",
    vi.fn((url, options) => {
      if (options?.method === "POST") {
        return Promise.resolve(new Response("", { status: 500 }));
      }
      if (url.endsWith("/channels")) {
        return Promise.resolve(
          new Response(JSON.stringify([{ id: "1", name: "general", removable: false }]), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    }),
  );

  renderChatPage();
  await flush();

  const input = container.querySelector("input[name=body]");
  await act(async () => {
    typeText(input, "do not lose me");
  });
  await act(async () => {
    container
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });

  await waitForInAct(() => expect(container.textContent).toContain("Ошибка соединения"));
  expect(input.value).toBe("do not lose me");
});

test("a double submit in one synchronous block sends only one message", async () => {
  stores.ui.setState({ currentChannelId: "1" });
  const fetchMock = vi.fn((url, options) => {
    if (options?.method === "POST") {
      const posted = JSON.parse(options.body);
      return Promise.resolve(
        new Response(JSON.stringify({ ...posted, removable: true, id: "9" }), { status: 200 }),
      );
    }
    if (url.endsWith("/channels")) {
      return Promise.resolve(
        new Response(JSON.stringify([{ id: "1", name: "general", removable: false }]), {
          status: 200,
        }),
      );
    }
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  });
  vi.stubGlobal("fetch", fetchMock);

  renderChatPage();
  await flush();

  const input = container.querySelector("input[name=body]");
  await act(async () => {
    typeText(input, "once only");
  });
  await act(async () => {
    // Two submits inside one synchronous block: React state updates are
    // batched, so the guard must not rely on the rendered disabled state.
    const submit = () =>
      container
        .querySelector("form")
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    submit();
    submit();
    await flush();
  });

  const postCalls = fetchMock.mock.calls.filter(
    ([url, options]) => url.endsWith("/messages") && options?.method === "POST",
  );
  expect(postCalls.length).toBe(1);
  await waitForInAct(() => expect(container.textContent).toContain("once only"));
});

test("sending without a username shows a session error and skips the request", async () => {
  stores.ui.setState({ currentChannelId: "1" });
  stores.auth.setState({ token: "jwt-token", username: null });
  const fetchMock = vi.fn((url) => {
    if (url.endsWith("/channels")) {
      return Promise.resolve(
        new Response(JSON.stringify([{ id: "1", name: "general", removable: false }]), {
          status: 200,
        }),
      );
    }
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  });
  vi.stubGlobal("fetch", fetchMock);

  renderChatPage();
  await flush();

  const input = container.querySelector("input[name=body]");
  await act(async () => {
    typeText(input, "should not send");
  });
  await act(async () => {
    container
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });

  const postCalls = fetchMock.mock.calls.filter(
    ([url, options]) => url.endsWith("/messages") && options?.method === "POST",
  );
  expect(postCalls.length).toBe(0);
  expect(container.textContent).toContain("Сессия устарела, войдите заново");
  expect(input.value).toBe("should not send");
});

test("a profane message is masked before it is sent", async () => {
  stores.ui.setState({ currentChannelId: "1" });
  const word = filter.getDictionary("ru").find((w) => /[а-яё]/i.test(w) && !/\s/.test(w));
  const fetchMock = vi.fn((url, options) => {
    if (url.endsWith("/channels")) {
      return Promise.resolve(
        new Response(JSON.stringify([{ id: "1", name: "general", removable: false }]), {
          status: 200,
        }),
      );
    }
    if (url.endsWith("/messages") && options?.method === "POST") {
      const posted = JSON.parse(options.body);
      return Promise.resolve(
        new Response(JSON.stringify({ ...posted, removable: true, id: "9" }), { status: 200 }),
      );
    }
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  });
  vi.stubGlobal("fetch", fetchMock);

  renderChatPage();
  await flush();

  const input = container.querySelector("input[name=body]");
  await act(async () => {
    typeText(input, `привет ${word}`);
  });
  await act(async () => {
    container
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });

  const postCall = fetchMock.mock.calls.find(
    ([url, options]) => url.endsWith("/messages") && options?.method === "POST",
  );
  expect(JSON.parse(postCall[1].body).body).toBe(`привет ${"*".repeat(word.length)}`);
  await waitForInAct(() =>
    expect(container.textContent).toContain(`привет ${"*".repeat(word.length)}`),
  );
});

test("socket newMessage events render in the feed without duplicates", async () => {
  const handlers = {};
  const socket = {
    on: (event, callback) => {
      handlers[event] = callback;
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn((url) => {
      if (url.endsWith("/channels")) {
        return Promise.resolve(
          new Response(JSON.stringify([{ id: "1", name: "general", removable: false }]), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    }),
  );

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const element = await init(socket, { stores });
  act(() => {
    root.render(element);
  });
  await flush();
  expect(container.textContent).toContain("# general");

  const feedMessage = {
    channelId: "1",
    body: "via socket once",
    username: "admin",
    removable: true,
    id: "77",
  };
  await act(async () => {
    handlers.newMessage(feedMessage);
    await flush();
  });
  expect(container.textContent).toContain("via socket once");

  // The sender's own message arrives twice (POST response + broadcast echo):
  // the upsert must keep a single copy.
  await act(async () => {
    handlers.newMessage(feedMessage);
    await flush();
  });
  expect(container.textContent.match(/via socket once/g).length).toBe(1);

  // An invalid payload must not crash the tree.
  await act(async () => {
    handlers.newMessage({ broken: true });
    await flush();
  });
  expect(container.textContent).toContain("Hexlet Chat");
});
