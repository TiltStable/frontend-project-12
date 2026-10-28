import { afterEach, expect, test, vi } from "vitest";

import { QueryClient } from "@tanstack/react-query";

import {
  applyChannelRemoval,
  createChannel,
  deleteChannel,
  getChannels,
  getMessages,
  isChannelRemoval,
  logIn,
  renameChannel,
  sendMessage,
  signUp,
  upsertChannel,
  upsertMessage,
} from "../src/api.js";
import { createUiStore } from "../src/store/ui.js";

// The api module is stateless: every authed call carries its own token, so
// there is nothing to seed or reset between tests.
const TOKEN = "jwt-token";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("logIn resolves with token and username", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: "jwt-token", username: "admin" }), {
        status: 200,
      }),
    ),
  );

  const data = await logIn({ username: "admin", password: "admin" });

  expect(data).toEqual({ token: "jwt-token", username: "admin" });
  expect(fetch).toHaveBeenCalledWith("/api/v1/login", expect.any(Object));
});

test("logIn throws credentials error on 401", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));

  await expect(logIn({ username: "admin", password: "wrong" })).rejects.toThrow("credentials");
});

test("logIn throws network error when fetch rejects", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

  await expect(logIn({ username: "admin", password: "admin" })).rejects.toThrow("network");
});

test("logIn throws network error on unexpected server status", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));

  await expect(logIn({ username: "admin", password: "admin" })).rejects.toThrow("network");
});

test("logIn throws network error on a 200 with an unexpected body", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
  );

  await expect(logIn({ username: "admin", password: "admin" })).rejects.toThrow("network");
});

test("logIn throws network error on a 200 with a non-JSON body", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));

  await expect(logIn({ username: "admin", password: "admin" })).rejects.toThrow("network");
});

test("signUp posts the credentials without an auth header", async () => {
  const session = { token: "jwt-token", username: "newbie" };
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(session), { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);

  const data = await signUp({ username: "newbie", password: "secret1" });

  expect(data).toEqual(session);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/v1/signup");
  expect(options.method).toBe("POST");
  expect(options.headers.Authorization).toBeUndefined();
  expect(options.headers["Content-Type"]).toBe("application/json");
  expect(JSON.parse(options.body)).toEqual({ username: "newbie", password: "secret1" });
});

test("signUp throws conflict error on 409", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 409 })));

  await expect(signUp({ username: "admin", password: "secret1" })).rejects.toThrow("conflict");
});

test("signUp throws network error when fetch rejects", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

  await expect(signUp({ username: "newbie", password: "secret1" })).rejects.toThrow("network");
});

test("signUp throws network error on a 500", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));

  await expect(signUp({ username: "newbie", password: "secret1" })).rejects.toThrow("network");
});

test("signUp throws network error on a 2xx with an unexpected body", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 })),
  );

  await expect(signUp({ username: "newbie", password: "secret1" })).rejects.toThrow("network");
});

test("signUp throws network error on a non-JSON body", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 201 })));

  await expect(signUp({ username: "newbie", password: "secret1" })).rejects.toThrow("network");
});

test("getChannels requests the channels with the auth header", async () => {
  const channels = [{ id: "1", name: "general", removable: false }];
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(channels), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const data = await getChannels(TOKEN);

  expect(data).toEqual(channels);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/v1/channels");
  expect(options.method).toBe("GET");
  expect(options.headers.Authorization).toBe("Bearer jwt-token");
});

test("getMessages requests the messages with the auth header", async () => {
  const messages = [{ channelId: "1", body: "hello", username: "admin", removable: true, id: "3" }];
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(messages), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const data = await getMessages(TOKEN);

  expect(data).toEqual(messages);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/v1/messages");
  expect(options.headers.Authorization).toBe("Bearer jwt-token");
});

test("getChannels throws network error on a non-array body", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })),
  );

  await expect(getChannels(TOKEN)).rejects.toThrow("network");
});

test("getMessages throws network error when an item misses required fields", async () => {
  const messages = [{ channelId: "1", body: "hello", id: "3" }];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(messages), { status: 200 })),
  );

  await expect(getMessages(TOKEN)).rejects.toThrow("network");
});

test("getChannels throws credentials error on 401", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));

  // An expired session is actionable and must not read as a network failure.
  await expect(getChannels(TOKEN)).rejects.toThrow("credentials");
});

test("getMessages throws credentials error on 401", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));

  await expect(getMessages(TOKEN)).rejects.toThrow("credentials");
});

test("sendMessage posts the message with auth and content-type headers", async () => {
  const message = { channelId: "1", body: "hello", username: "admin", removable: true, id: "5" };
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(message), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const data = await sendMessage(TOKEN, { channelId: "1", body: "hello", username: "admin" });

  expect(data).toEqual(message);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/v1/messages");
  expect(options.method).toBe("POST");
  expect(options.headers.Authorization).toBe("Bearer jwt-token");
  expect(options.headers["Content-Type"]).toBe("application/json");
  expect(JSON.parse(options.body)).toEqual({
    channelId: "1",
    body: "hello",
    username: "admin",
  });
});

test("sendMessage throws credentials error on 401", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));

  await expect(
    sendMessage(TOKEN, { channelId: "1", body: "x", username: "admin" }),
  ).rejects.toThrow("credentials");
});

test("sendMessage throws network error when fetch rejects", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

  await expect(
    sendMessage(TOKEN, { channelId: "1", body: "x", username: "admin" }),
  ).rejects.toThrow("network");
});

test("sendMessage throws network error on a 200 with an unexpected body", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
  );

  await expect(
    sendMessage(TOKEN, { channelId: "1", body: "x", username: "admin" }),
  ).rejects.toThrow("network");
});

test("upsertMessage appends a new message", () => {
  const list = [messageFixture("1")];

  const next = upsertMessage(list, messageFixture("2"));

  expect(next.map((m) => m.id)).toEqual(["1", "2"]);
  expect(list).toEqual([messageFixture("1")]);
});

test("upsertMessage replaces an existing message by id", () => {
  const list = [{ channelId: "1", body: "old", username: "admin", removable: true, id: "1" }];

  const next = upsertMessage(list, {
    channelId: "1",
    body: "new",
    username: "admin",
    removable: true,
    id: "1",
  });

  expect(next.map((m) => m.id)).toEqual(["1"]);
  expect(next[0].body).toBe("new");
  expect(list[0].body).toBe("old");
});

test("createChannel posts the name with auth and content-type headers", async () => {
  const channel = { id: "3", name: "project", removable: true };
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(channel), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const data = await createChannel(TOKEN, { name: "project" });

  expect(data).toEqual(channel);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/v1/channels");
  expect(options.method).toBe("POST");
  expect(options.headers.Authorization).toBe("Bearer jwt-token");
  expect(options.headers["Content-Type"]).toBe("application/json");
  expect(JSON.parse(options.body)).toEqual({ name: "project" });
});

test("createChannel throws credentials error on 401", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));

  await expect(createChannel(TOKEN, { name: "project" })).rejects.toThrow("credentials");
});

test("createChannel throws network error when fetch rejects", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

  await expect(createChannel(TOKEN, { name: "project" })).rejects.toThrow("network");
});

test("createChannel throws network error on a 500", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));

  await expect(createChannel(TOKEN, { name: "project" })).rejects.toThrow("network");
});

test("createChannel throws network error on a 200 with an unexpected body", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
  );

  await expect(createChannel(TOKEN, { name: "project" })).rejects.toThrow("network");
});

test("renameChannel patches the channel name", async () => {
  const channel = { id: "3", name: "renamed", removable: true };
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(channel), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const data = await renameChannel(TOKEN, { id: "3", name: "renamed" });

  expect(data).toEqual(channel);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/v1/channels/3");
  expect(options.method).toBe("PATCH");
  expect(options.headers.Authorization).toBe("Bearer jwt-token");
  expect(JSON.parse(options.body)).toEqual({ name: "renamed" });
});

test("renameChannel throws network error on a 404 with an empty body", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

  await expect(renameChannel(TOKEN, { id: "3", name: "renamed" })).rejects.toThrow("network");
});

test("renameChannel throws credentials error on 401", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));

  await expect(renameChannel(TOKEN, { id: "3", name: "renamed" })).rejects.toThrow("credentials");
});

test("deleteChannel sends DELETE and validates the removal payload", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id: "3" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const data = await deleteChannel(TOKEN, { id: "3" });

  expect(data).toEqual({ id: "3" });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/v1/channels/3");
  expect(options.method).toBe("DELETE");
  expect(options.headers.Authorization).toBe("Bearer jwt-token");
});

test("deleteChannel throws credentials error on 401", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));

  await expect(deleteChannel(TOKEN, { id: "3" })).rejects.toThrow("credentials");
});

test("deleteChannel throws network error when fetch rejects", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

  await expect(deleteChannel(TOKEN, { id: "3" })).rejects.toThrow("network");
});

test("deleteChannel throws network error on a 200 with an unexpected body", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ gone: true }), { status: 200 })),
  );

  await expect(deleteChannel(TOKEN, { id: "3" })).rejects.toThrow("network");
});

test("upsertChannel appends a new channel", () => {
  const list = [channelFixture("1", false), channelFixture("2", false)];

  const next = upsertChannel(list, channelFixture("3", true));

  expect(next.map((c) => c.id)).toEqual(["1", "2", "3"]);
  expect(list.map((c) => c.id)).toEqual(["1", "2"]);
});

test("upsertChannel replaces an existing channel by id in place", () => {
  const list = [channelFixture("1", false), channelFixture("2", true)];

  const next = upsertChannel(list, { id: "2", name: "renamed", removable: true });

  expect(next.map((c) => c.id)).toEqual(["1", "2"]);
  expect(next[1].name).toBe("renamed");
  expect(list[1].name).toBe("random");
});

test("isChannelRemoval accepts only a string id", () => {
  expect(isChannelRemoval({ id: "3" })).toBe(true);
  expect(isChannelRemoval({})).toBe(false);
  expect(isChannelRemoval({ id: 3 })).toBe(false);
  expect(isChannelRemoval(null)).toBe(false);
});

test("applyChannelRemoval clears the channel, its messages and moves the selection", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["channels"], [channelFixture("1", false), channelFixture("3", true)]);
  queryClient.setQueryData(
    ["messages"],
    [
      { channelId: "3", body: "doomed", username: "admin", removable: true, id: "5" },
      messageFixture("6"),
    ],
  );
  const ui = createUiStore();
  ui.setState({ currentChannelId: "3" });

  applyChannelRemoval(queryClient, ui, "3");

  expect(queryClient.getQueryData(["channels"])).toEqual([channelFixture("1", false)]);
  expect(queryClient.getQueryData(["messages"])).toEqual([messageFixture("6")]);
  expect(ui.getState().currentChannelId).toBe("1");
});

test("applyChannelRemoval keeps the selection when another channel is removed", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["channels"], [channelFixture("1", false), channelFixture("3", true)]);
  const ui = createUiStore();
  ui.setState({ currentChannelId: "1" });

  applyChannelRemoval(queryClient, ui, "3");

  expect(ui.getState().currentChannelId).toBe("1");
});

test("applyChannelRemoval sets a null selection on a cold or emptied cache", () => {
  const queryClient = new QueryClient();
  const ui = createUiStore();
  ui.setState({ currentChannelId: "3" });

  applyChannelRemoval(queryClient, ui, "3");

  expect(ui.getState().currentChannelId).toBe(null);
});

function messageFixture(id) {
  return { channelId: "1", body: `body ${id}`, username: "admin", removable: true, id };
}

function channelFixture(id, removable) {
  return { id, name: id === "1" ? "general" : "random", removable };
}
