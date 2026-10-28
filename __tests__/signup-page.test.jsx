// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "../src/App.jsx";
import { useAuthStore } from "../src/store/auth.js";
import { useUiStore } from "../src/store/ui.js";

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

let fetchMock;
let postResponse;

const makeFetchMock = () =>
  vi.fn((url, options = {}) => {
    if (options.method === "POST" && url.endsWith("/signup")) {
      return Promise.resolve(postResponse);
    }
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  });

let container;
let root;

const renderApp = (path) => {
  window.history.replaceState({}, "", path);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <App queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })} />,
    );
  });
};

beforeEach(() => {
  postResponse = new Response(JSON.stringify({ token: "jwt-token", username: "newbie" }), {
    status: 201,
  });
  fetchMock = makeFetchMock();
  vi.stubGlobal("fetch", fetchMock);
  useAuthStore.setState({ token: null, username: null });
  useUiStore.setState({ currentChannelId: null, modal: null });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const openForm = async () => {
  renderApp("/signup");
  await flush();
  return {
    username: container.querySelector('input[name="username"]'),
    password: container.querySelector('input[name="password"]'),
    confirmPassword: container.querySelector('input[name="confirmPassword"]'),
    form: container.querySelector("form"),
  };
};

const postCalls = () => fetchMock.mock.calls.filter(([, o]) => o?.method === "POST");

test("an empty submit is blocked with required errors and sends nothing", async () => {
  const { form } = await openForm();

  await act(async () => {
    submitForm(form);
    await flush();
  });

  expect(postCalls()).toHaveLength(0);
  expect(container.textContent.match(/Обязательное поле/g)).toHaveLength(3);
  // Uncovered-by-other-tests translation strings (labels and the submit).
  expect(container.textContent).toContain("Имя пользователя");
  expect(container.textContent).toContain("Зарегистрироваться");
});

test("a short or long username is blocked", async () => {
  const { username, password, confirmPassword, form } = await openForm();

  await act(async () => {
    typeText(username, "ab");
    typeText(password, "secret1");
    typeText(confirmPassword, "secret1");
    submitForm(form);
    await flush();
  });
  expect(postCalls()).toHaveLength(0);
  expect(container.textContent).toContain("От 3 до 20 символов");

  await act(async () => {
    typeText(username, "a".repeat(21));
    submitForm(form);
    await flush();
  });
  expect(postCalls()).toHaveLength(0);
  expect(container.textContent).toContain("От 3 до 20 символов");
});

test("a short password is blocked", async () => {
  const { username, password, confirmPassword, form } = await openForm();

  await act(async () => {
    typeText(username, "newbie");
    typeText(password, "abc");
    typeText(confirmPassword, "abc");
    submitForm(form);
    await flush();
  });

  expect(postCalls()).toHaveLength(0);
  expect(container.textContent).toContain("Не менее 6 символов");
});

test("a mismatched confirmation is blocked", async () => {
  const { username, password, confirmPassword, form } = await openForm();

  await act(async () => {
    typeText(username, "newbie");
    typeText(password, "secret1");
    typeText(confirmPassword, "secret2");
    submitForm(form);
    await flush();
  });

  expect(postCalls()).toHaveLength(0);
  expect(container.textContent).toContain("Пароли не совпадают");
});

test("changing the password revalidates a filled confirmation", async () => {
  const { username, password, confirmPassword } = await openForm();

  await act(async () => {
    typeText(username, "newbie");
    typeText(password, "secret1");
    typeText(confirmPassword, "secret1");
    await flush();
  });
  expect(container.textContent).not.toContain("Пароли не совпадают");

  await act(async () => {
    typeText(password, "secret2");
    await flush();
  });

  // The mismatch error must surface before any submit: the confirmation was
  // computed against the password that no longer exists.
  expect(container.textContent).toContain("Пароли не совпадают");
  expect(postCalls()).toHaveLength(0);
});

test("a successful signup posts, stores the session and redirects to the chat", async () => {
  const { username, password, confirmPassword, form } = await openForm();

  await act(async () => {
    typeText(username, "newbie");
    typeText(password, "secret1");
    typeText(confirmPassword, "secret1");
    submitForm(form);
    await flush();
  });

  await waitForInAct(() => expect(window.location.pathname).toBe("/"));
  expect(container.textContent).toContain("Каналы");
  expect(useAuthStore.getState().token).toBe("jwt-token");
  expect(useAuthStore.getState().username).toBe("newbie");

  const calls = postCalls();
  expect(calls).toHaveLength(1);
  const [url, options] = calls[0];
  expect(url).toBe("/api/v1/signup");
  expect(options.headers.Authorization).toBeUndefined();
  expect(JSON.parse(options.body)).toEqual({ username: "newbie", password: "secret1" });
});

test("a duplicate username shows the conflict message and keeps the form", async () => {
  postResponse = new Response(JSON.stringify({ statusCode: 409, error: "Conflict" }), {
    status: 409,
  });
  const { username, password, confirmPassword, form } = await openForm();

  await act(async () => {
    typeText(username, "admin");
    typeText(password, "secret1");
    typeText(confirmPassword, "secret1");
    submitForm(form);
    await flush();
  });

  expect(container.textContent).toContain("Такой пользователь уже существует");
  expect(username.value).toBe("admin");
  expect(postCalls()).toHaveLength(1);
});

test("a server failure shows the network error and keeps the form", async () => {
  fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  const { username, password, confirmPassword, form } = await openForm();

  await act(async () => {
    typeText(username, "newbie");
    typeText(password, "secret1");
    typeText(confirmPassword, "secret1");
    submitForm(form);
    await flush();
  });

  expect(container.textContent).toContain("Ошибка сети");
  expect(username.value).toBe("newbie");
  expect(postCalls()).toHaveLength(1);
});

test("the login and signup pages link to each other", async () => {
  renderApp("/login");
  await flush();
  const toSignup = container.querySelector('a[href="/signup"]');
  expect(toSignup?.textContent).toBe("Регистрация");

  act(() => toSignup.click());
  await waitForInAct(() => expect(window.location.pathname).toBe("/signup"));
  expect(container.textContent).toContain("Подтвердите пароль");

  const toLogin = container.querySelector('a[href="/login"]');
  expect(toLogin?.textContent).toBe("Войти");
  act(() => toLogin.click());
  await waitForInAct(() => expect(window.location.pathname).toBe("/login"));
  expect(container.textContent).toContain("Ваш ник на Хекслете");
});
