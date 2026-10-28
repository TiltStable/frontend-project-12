import { useAuthStore } from "./store/auth.js";
import { useUiStore } from "./store/ui.js";

// Error messages are machine codes: the UI maps them to human texts, the
// i18next step will move those texts to locales.

const authHeaders = () => {
  const { token } = useAuthStore.getState();
  return { Authorization: `Bearer ${token}` };
};

// A hung connection must not leave the UI blocked forever: the rejection
// flows through the same ladder and unlocks whatever is showing a spinner.
const REQUEST_TIMEOUT_MS = 10_000;

const fetchData = async (url) => {
  let response;
  let data;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: authHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 401) {
      // An expired session is actionable ("log in again") and must not look
      // like a network failure (same branch as in mutateJson below).
      throw new Error("credentials");
    }
    if (!response.ok) {
      throw new Error("network", { cause: response.status });
    }
    // A non-JSON 200 must surface as a contract error, not a raw SyntaxError.
    data = await response.json();
  } catch (cause) {
    if (
      cause instanceof Error &&
      (cause.message === "network" || cause.message === "credentials")
    ) {
      throw cause;
    }
    throw new Error("network", { cause });
  }
  return data;
};

export const isChannel = (channel) =>
  typeof channel?.id === "string" && typeof channel?.name === "string";

export const isMessage = (message) =>
  typeof message?.id === "string" &&
  typeof message?.channelId === "string" &&
  typeof message?.body === "string" &&
  typeof message?.username === "string";

// The server sends { id } only when a channel is removed.
export const isChannelRemoval = (payload) => typeof payload?.id === "string";

// A 200 with an unexpected body would silently break the rendering, so every
// fetched list is validated at the contract layer.
const fetchList = async (url, isItem) => {
  const data = await fetchData(url);
  if (!Array.isArray(data) || !data.every(isItem)) {
    throw new Error("network", { cause: data });
  }
  return data;
};

// The shared write ladder: a fetch rejection, an unexpected status, a
// non-JSON body or a contract violation all surface as "network"; an expired
// session is actionable and maps to "credentials".
const mutateJson = async (url, method, body, isItem) => {
  let response;
  try {
    response = await fetch(
      url,
      body === undefined
        ? { method, headers: authHeaders(), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
        : {
            method,
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          },
    );
  } catch (cause) {
    throw new Error("network", { cause });
  }
  if (response.status === 401) {
    throw new Error("credentials");
  }
  if (!response.ok) {
    throw new Error("network", { cause: response.status });
  }
  let data;
  try {
    data = await response.json();
  } catch (cause) {
    throw new Error("network", { cause });
  }
  if (!isItem(data)) {
    throw new Error("network", { cause: data });
  }
  return data;
};

export const logIn = async ({ username, password }) => {
  let response;
  try {
    response = await fetch("/api/v1/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new Error("network", { cause });
  }
  if (response.status === 401) {
    throw new Error("credentials");
  }
  if (!response.ok) {
    throw new Error("network", { cause: response.status });
  }
  let data;
  try {
    data = await response.json();
  } catch (cause) {
    throw new Error("network", { cause });
  }
  // A 200 with an unexpected body would store token: undefined and silently
  // bounce the user back to the login form without any message.
  if (typeof data?.token !== "string" || typeof data?.username !== "string") {
    throw new Error("network", { cause: data });
  }
  return data;
};

// The signup ladder mirrors logIn. The endpoint is unauthenticated: no Bearer
// header is sent (and 401 is not a meaningful status here). 409 is actionable
// (duplicate username) and must not read as a network failure.
export const signUp = async ({ username, password }) => {
  let response;
  try {
    response = await fetch("/api/v1/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new Error("network", { cause });
  }
  if (response.status === 409) {
    throw new Error("conflict");
  }
  if (!response.ok) {
    throw new Error("network", { cause: response.status });
  }
  let data;
  try {
    data = await response.json();
  } catch (cause) {
    throw new Error("network", { cause });
  }
  if (typeof data?.token !== "string" || typeof data?.username !== "string") {
    throw new Error("network", { cause: data });
  }
  return data;
};

export const getChannels = () => fetchList("/api/v1/channels", isChannel);

export const getMessages = () => fetchList("/api/v1/messages", isMessage);

// A message can reach the cache twice (the POST response of the sender and
// the socket broadcast), so insertion is idempotent by id.
export const upsertMessage = (list, message) => {
  if (!list.some((item) => item.id === message.id)) {
    return [...list, message];
  }
  return list.map((item) => (item.id === message.id ? message : item));
};

// Same for channels: the mutation response and the broadcast carry the same
// object, and a replace-in-place keeps the list order stable on renames.
export const upsertChannel = (list, channel) => {
  if (!list.some((item) => item.id === channel.id)) {
    return [...list, channel];
  }
  return list.map((item) => (item.id === channel.id ? channel : item));
};

// One removal invariant with two callers (the remove-modal success path and
// the socket handler): drop the channel and its messages, and any client
// viewing the removed channel falls back to the default one. The channel
// cache may still be empty when the broadcast arrives (socket connects
// before the first GET), so every read tolerates undefined.
export const applyChannelRemoval = (queryClient, channelId) => {
  queryClient.setQueryData(["channels"], (old) => (old ?? []).filter((c) => c.id !== channelId));
  queryClient.setQueryData(["messages"], (old) =>
    (old ?? []).filter((message) => message.channelId !== channelId),
  );
  const { currentChannelId, setCurrentChannel } = useUiStore.getState();
  if (currentChannelId === channelId) {
    const channels = queryClient.getQueryData(["channels"]);
    setCurrentChannel(channels?.length > 0 ? channels[0].id : null);
  }
};

export const sendMessage = ({ channelId, body, username }) =>
  mutateJson("/api/v1/messages", "POST", { channelId, body, username }, isMessage);

export const createChannel = ({ name }) =>
  mutateJson("/api/v1/channels", "POST", { name }, isChannel);

export const renameChannel = ({ id, name }) =>
  mutateJson(`/api/v1/channels/${id}`, "PATCH", { name }, isChannel);

export const deleteChannel = ({ id }) =>
  mutateJson(`/api/v1/channels/${id}`, "DELETE", undefined, isChannelRemoval);
