import { ActionIcon, Button, Group, Menu, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { useUiStore } from "../store/context.js";

function ChannelMenu({ channel }) {
  const openModal = useUiStore((state) => state.openModal);
  const { t } = useTranslation();
  return (
    <Menu>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={t("channels.rowAria")}>
          ⋯
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => openModal({ type: "rename", channel })}>
          {t("channels.menu.rename")}
        </Menu.Item>
        <Menu.Item color="red" onClick={() => openModal({ type: "remove", channel })}>
          {t("channels.menu.remove")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function ChannelRow({ channel }) {
  const currentChannelId = useUiStore((state) => state.currentChannelId);
  const setCurrentChannel = useUiStore((state) => state.setCurrentChannel);
  const { t } = useTranslation();
  const isCurrent = channel.id === currentChannelId;
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs" w="100%">
      <Text
        component="button"
        type="button"
        onClick={() => setCurrentChannel(channel.id)}
        truncate="end"
        maw="100%"
        aria-current={isCurrent ? "true" : undefined}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          textAlign: "left",
          minWidth: 0,
          flexGrow: 1,
          fontWeight: isCurrent ? 700 : 400,
        }}
      >
        {t("channels.rowName", { name: channel.name })}
      </Text>
      {channel.removable && <ChannelMenu channel={channel} />}
    </Group>
  );
}

function Channels({ channels }) {
  const openModal = useUiStore((state) => state.openModal);
  const { t } = useTranslation();
  return (
    <Stack gap="xs">
      <Button variant="subtle" color="gray" size="xs" onClick={() => openModal({ type: "add" })}>
        {t("channels.addButton")}
      </Button>
      {channels.map((channel) => (
        <ChannelRow key={channel.id} channel={channel} />
      ))}
    </Stack>
  );
}

export default Channels;
