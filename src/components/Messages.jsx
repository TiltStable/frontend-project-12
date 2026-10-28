import { Button, Divider, Stack, Text, TextInput, Title } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { sendMessage, upsertMessage } from "../api.js";
import { cleanText } from "../profanity.js";
import { useAuthStore } from "../store/context.js";

function Messages({ messages, channels, currentChannelId }) {
  const currentChannel = channels?.find((channel) => channel.id === currentChannelId) ?? null;
  const channelMessages = messages.filter((message) => message.channelId === currentChannelId);
  const queryClient = useQueryClient();
  const username = useAuthStore((state) => state.username);
  const token = useAuthStore((state) => state.token);
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  // React batches state updates: two submits inside one synchronous block
  // would both read sending=false, so the guard has to be synchronous too.
  const inFlight = useRef(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || inFlight.current) {
      return;
    }
    if (typeof username !== "string") {
      setSendError(t("errors.sessionExpired"));
      return;
    }
    inFlight.current = true;
    setSendError(null);
    setSending(true);
    try {
      const message = await sendMessage(token, {
        channelId: currentChannelId,
        body: cleanText(text),
        username,
      });
      queryClient.setQueryData(["messages"], (old) => upsertMessage(old ?? [], message));
      setBody("");
    } catch (error) {
      console.error("Message send failed:", error);
      // The typed text stays in the input: nothing the user wrote is lost.
      setSendError(
        error.message === "credentials" ? t("errors.sessionExpired") : t("messages.sendFailed"),
      );
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 140px)",
        minWidth: 0,
      }}
    >
      <Title order={2} size="h4">
        {t("messages.header", { name: currentChannel ? currentChannel.name : "" })}
      </Title>
      <div style={{ overflowY: "auto", flexGrow: 1, minHeight: 0 }}>
        <Stack gap="xs" mb="sm">
          {channelMessages.length === 0 && <Text>{t("messages.empty")}</Text>}
          {channelMessages.map((message) => (
            <Text key={message.id} style={{ overflowWrap: "anywhere" }}>
              <b>{message.username}</b>: {message.body}
            </Text>
          ))}
        </Stack>
      </div>
      <Divider mb="sm" />
      <form onSubmit={onSubmit}>
        {sendError && (
          <Text c="red" mb="xs">
            {sendError}
          </Text>
        )}
        <TextInput
          name="body"
          aria-label={t("messages.label")}
          placeholder={t("messages.placeholder")}
          value={body}
          disabled={sending}
          onChange={(event) => setBody(event.currentTarget.value)}
        />
        <Button type="submit" loading={sending} disabled={sending || !body.trim()} mt="xs">
          {t("messages.send")}
        </Button>
      </form>
    </section>
  );
}

export default Messages;
