import { Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { getChannels, getMessages } from "../api.js";
import { useUiStore } from "../store/ui.js";
import ChannelModals from "./ChannelModals.jsx";
import Channels from "./Channels.jsx";
import Messages from "./Messages.jsx";

function ChatPage() {
  const { t } = useTranslation();
  const channelsQuery = useQuery({ queryKey: ["channels"], queryFn: getChannels });
  const messagesQuery = useQuery({ queryKey: ["messages"], queryFn: getMessages });
  const currentChannelId = useUiStore((state) => state.currentChannelId);
  const setCurrentChannel = useUiStore((state) => state.setCurrentChannel);
  const channels = channelsQuery.data;

  // A 401 on load is actionable ("log in again") and must not read as a
  // transient network problem; anything else keeps the generic load error.
  const loadErrorFor = (query) =>
    query.error?.message === "credentials" ? (
      <Text c="red">{t("errors.sessionExpired")}</Text>
    ) : (
      <Text c="red">{t("chat.loadFailed")}</Text>
    );

  // Load failures are also announced with a toast. show with an existing id
  // is a no-op in @mantine/notifications (not a replace), so repeats from
  // retries and window-focus refetches do not stack copies.
  useEffect(() => {
    const error = channelsQuery.error;
    if (!error) {
      return;
    }
    notifications.show({
      id: "channels-load-error",
      message: error.message === "credentials" ? t("errors.sessionExpired") : t("chat.loadFailed"),
      color: "red",
    });
  }, [channelsQuery.error, t]);
  useEffect(() => {
    const error = messagesQuery.error;
    if (!error) {
      return;
    }
    notifications.show({
      id: "messages-load-error",
      message: error.message === "credentials" ? t("errors.sessionExpired") : t("chat.loadFailed"),
      color: "red",
    });
  }, [messagesQuery.error, t]);

  // The selection invariant: currentChannelId always points to an existing
  // channel. It covers both the initial pick and a selection left dangling
  // by a removed channel (socket removal or a refetch catching up).
  useEffect(() => {
    if (channels && channels.length > 0 && !channels.some((c) => c.id === currentChannelId)) {
      setCurrentChannel(channels[0].id);
    }
  }, [channels, currentChannelId, setCurrentChannel]);

  return (
    <section className="app">
      <Title order={1}>{t("app.title")}</Title>
      <div style={{ display: "flex", gap: "16px" }}>
        <aside style={{ width: "220px", flexShrink: 0, minWidth: 0 }}>
          <Title order={2} size="h4">
            {t("chat.channelsTitle")}
          </Title>
          {channelsQuery.isPending && <Text>{t("chat.loading")}</Text>}
          {channelsQuery.isError && loadErrorFor(channelsQuery)}
          {channels && <Channels channels={channels} />}
        </aside>
        <main style={{ flexGrow: 1, minWidth: 0 }}>
          {messagesQuery.isPending && <Text>{t("chat.loading")}</Text>}
          {messagesQuery.isError && loadErrorFor(messagesQuery)}
          {messagesQuery.data && channels && (
            <Messages
              messages={messagesQuery.data}
              channels={channels}
              currentChannelId={currentChannelId}
            />
          )}
        </main>
      </div>
      {channels && <ChannelModals channels={channels} />}
    </section>
  );
}

export default ChatPage;
