import { QueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { notifications } from "@mantine/notifications";
import { I18nextProvider, initReactI18next } from "react-i18next";

import {
  applyChannelRemoval,
  isChannel,
  isChannelRemoval,
  isMessage,
  upsertChannel,
  upsertMessage,
} from "./api.js";
import resources from "./locales/index.js";
import { useAuthStore } from "./store/auth.js";
import App from "./App.jsx";

// The socket is opened by the entry point and passed in, so the external
// resource stays on the caller's side and can be swapped from outside.
// The query client is injectable for the same reason: tests inspect the
// exact cache the handlers write to.
const init = async (socket, queryClient = new QueryClient()) => {
  // The default locale is ru by the project requirement: no language
  // detection, i18next promotes the first fallback code to the language
  // when neither lng nor a detector is given.
  const i18n = i18next.createInstance();
  await i18n.use(initReactI18next).init({
    resources,
    fallbackLng: "ru",
  });

  // The socket stays connected after a logout (it lives in the entry
  // point), but a signed-out client must not repopulate the cache: the
  // next session rebuilds it with its own fetch.
  const requireSession = (handler) => (payload) => {
    if (!useAuthStore.getState().token) {
      return;
    }
    handler(payload);
  };

  socket.on(
    "newMessage",
    requireSession((message) => {
      if (isMessage(message)) {
        queryClient.setQueryData(["messages"], (old) => upsertMessage(old ?? [], message));
      } else {
        queryClient.invalidateQueries({ queryKey: ["messages"] });
      }
    }),
  );

  // newChannel and renameChannel carry the same full channel object, and the
  // upsert makes both the mutation echo and the broadcast idempotent.
  const upsertChannelFromSocket = (channel) => {
    if (isChannel(channel)) {
      queryClient.setQueryData(["channels"], (old) => upsertChannel(old ?? [], channel));
    } else {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    }
  };
  socket.on("newChannel", requireSession(upsertChannelFromSocket));
  socket.on("renameChannel", requireSession(upsertChannelFromSocket));
  socket.on(
    "removeChannel",
    requireSession((payload) => {
      if (isChannelRemoval(payload)) {
        applyChannelRemoval(queryClient, payload.id);
      } else {
        queryClient.invalidateQueries({ queryKey: ["channels"] });
        queryClient.invalidateQueries({ queryKey: ["messages"] });
      }
    }),
  );

  // After a reconnect the cache may have missed messages (and channel
  // create/rename/remove events) that happened while offline: refetch to
  // catch up. Connection status is announced with toasts: notifications is
  // store-based, so it works outside React, and the i18n instance from the
  // closure translates the texts. show with an existing id is a NO-OP in
  // @mantine/notifications (not a replace), so the sticky "lost" toast is
  // hidden explicitly and the "restored" one gets its own id.
  let wasDisconnected = false;
  socket.on("disconnect", () => {
    wasDisconnected = true;
    notifications.show({
      id: "socket-lost",
      message: i18n.t("socket.lost"),
      color: "red",
      autoClose: false,
    });
  });
  socket.on("connect", () => {
    if (wasDisconnected) {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      wasDisconnected = false;
      notifications.hide("socket-lost");
      notifications.show({
        id: "socket-restored",
        message: i18n.t("socket.restored"),
        color: "teal",
      });
    }
  });

  return (
    <I18nextProvider i18n={i18n}>
      <App queryClient={queryClient} />
    </I18nextProvider>
  );
};

export default init;
