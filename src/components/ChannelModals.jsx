import { Button, Group, Modal, Text, TextInput } from "@mantine/core";
import { hasLength, useForm } from "@mantine/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

import {
  applyChannelRemoval,
  createChannel,
  deleteChannel,
  renameChannel,
  upsertChannel,
} from "../api.js";
import { cleanText } from "../profanity.js";
import { useAuthStore, useStores, useUiStore } from "../store/context.js";

// The expired-session error is shared across modals, the fallback text is
// per-mutation; both are resolved with t by the caller.
const mutationErrorText = (mutation, sessionExpiredText, fallbackText) => {
  if (!mutation.isError) {
    return null;
  }
  return mutation.error.message === "credentials" ? sessionExpiredText : fallbackText;
};

// The ladder keeps the root cause (status or payload) in `cause`; log it
// once from onError so the failure stays diagnosable without spamming the
// console on every re-render.
const logMutationError = (error) => {
  console.error("Channel mutation failed:", error.cause ?? error);
};

// A modal cannot be dismissed while its request is in flight: a late
// onSuccess closeModal() would otherwise close whatever dialog replaced it.
const blockClose = (pending, onClose) => () => {
  if (!pending) {
    onClose();
  }
};

function ChannelNameForm({ form, onSubmit, pending, errorText, submitLabel }) {
  const { t } = useTranslation();
  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <TextInput
        data-autofocus
        name="name"
        label={t("modals.nameLabel")}
        {...form.getInputProps("name")}
      />
      {errorText && (
        <Text c="red" mt="xs">
          {errorText}
        </Text>
      )}
      <Button type="submit" loading={pending} disabled={pending} mt="md">
        {submitLabel}
      </Button>
    </form>
  );
}

function AddChannelModal({ channels, onClose }) {
  const queryClient = useQueryClient();
  const setCurrentChannel = useUiStore((state) => state.setCurrentChannel);
  const token = useAuthStore((state) => state.token);
  const { t } = useTranslation();
  // hasLength trims the value itself (like the submit below), so both checks
  // agree on what the user typed. The validators live inside the component:
  // t must be bound to the instance from useTranslation.
  const lengthValidator = hasLength({ min: 3, max: 20 }, t("validation.length3to20"));
  const form = useForm({
    initialValues: { name: "" },
    validate: {
      name: (value) => {
        const lengthFail = lengthValidator(value);
        if (lengthFail) {
          return lengthFail;
        }
        const normalized = value.trim().toLowerCase();
        return channels.some((channel) => channel.name.toLowerCase() === normalized)
          ? t("validation.channelNameDuplicate")
          : null;
      },
    },
  });
  const create = useMutation({
    mutationFn: (values) => createChannel(token, values),
    onError: logMutationError,
    onSuccess: (channel) => {
      queryClient.setQueryData(["channels"], (old) => upsertChannel(old ?? [], channel));
      // The creator lands in the channel they have just made; other clients
      // only get the row (the socket handler never touches the selection).
      setCurrentChannel(channel.id);
      notifications.show({ message: t("notifications.channelCreated"), color: "green" });
      onClose();
    },
  });
  return (
    <Modal
      opened
      onClose={blockClose(create.isPending, onClose)}
      title={t("modals.add.title")}
      centered
      closeOnEscape={!create.isPending}
      closeOnClickOutside={!create.isPending}
      withCloseButton={!create.isPending}
    >
      <ChannelNameForm
        form={form}
        pending={create.isPending}
        submitLabel={t("modals.add.submit")}
        errorText={mutationErrorText(create, t("errors.sessionExpired"), t("modals.add.error"))}
        onSubmit={(values) => create.mutate({ name: cleanText(values.name.trim()) })}
      />
    </Modal>
  );
}

function RenameChannelModal({ channel, channels, onClose }) {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const { t } = useTranslation();
  const lengthValidator = hasLength({ min: 3, max: 20 }, t("validation.length3to20"));
  const form = useForm({
    initialValues: { name: channel.name },
    validate: {
      name: (value) => {
        const lengthFail = lengthValidator(value);
        if (lengthFail) {
          return lengthFail;
        }
        const normalized = value.trim().toLowerCase();
        const duplicate = channels.some(
          (item) => item.id !== channel.id && item.name.toLowerCase() === normalized,
        );
        return duplicate ? t("validation.channelNameDuplicate") : null;
      },
    },
  });
  const rename = useMutation({
    mutationFn: (values) => renameChannel(token, values),
    onError: logMutationError,
    onSuccess: (updated) => {
      queryClient.setQueryData(["channels"], (old) => upsertChannel(old ?? [], updated));
      notifications.show({ message: t("notifications.channelRenamed"), color: "green" });
      onClose();
    },
  });
  return (
    <Modal
      opened
      onClose={blockClose(rename.isPending, onClose)}
      title={t("modals.rename.title")}
      centered
      closeOnEscape={!rename.isPending}
      closeOnClickOutside={!rename.isPending}
      withCloseButton={!rename.isPending}
    >
      <ChannelNameForm
        form={form}
        pending={rename.isPending}
        submitLabel={t("modals.rename.submit")}
        errorText={mutationErrorText(rename, t("errors.sessionExpired"), t("modals.rename.error"))}
        onSubmit={(values) =>
          rename.mutate({ id: channel.id, name: cleanText(values.name.trim()) })
        }
      />
    </Modal>
  );
}

function RemoveChannelModal({ channel, onClose }) {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const { ui } = useStores();
  const { t } = useTranslation();
  const removal = useMutation({
    mutationFn: (values) => deleteChannel(token, values),
    onError: logMutationError,
    onSuccess: () => {
      applyChannelRemoval(queryClient, ui, channel.id);
      notifications.show({ message: t("notifications.channelRemoved"), color: "green" });
      onClose();
    },
  });
  return (
    <Modal
      opened
      onClose={blockClose(removal.isPending, onClose)}
      title={t("modals.remove.title")}
      centered
      closeOnEscape={!removal.isPending}
      closeOnClickOutside={!removal.isPending}
      withCloseButton={!removal.isPending}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          removal.mutate({ id: channel.id });
        }}
      >
        <Text>{t("modals.remove.confirm", { name: channel.name })}</Text>
        {removal.isError && (
          <Text c="red" mt="xs">
            {mutationErrorText(removal, t("errors.sessionExpired"), t("modals.remove.error"))}
          </Text>
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="default" disabled={removal.isPending} onClick={onClose}>
            {t("modals.remove.cancel")}
          </Button>
          <Button
            type="submit"
            color="red"
            loading={removal.isPending}
            disabled={removal.isPending}
          >
            {t("modals.remove.submit")}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

// Channels is only rendered with a non-empty list, but the guard keeps the
// duplicate validators safe if that ever changes.
function ChannelModals({ channels }) {
  const modal = useUiStore((state) => state.modal);
  const closeModal = useUiStore((state) => state.closeModal);
  const safeChannels = channels ?? [];
  if (modal?.type === "add") {
    return <AddChannelModal channels={safeChannels} onClose={closeModal} />;
  }
  if (modal?.type === "rename") {
    return (
      <RenameChannelModal channel={modal.channel} channels={safeChannels} onClose={closeModal} />
    );
  }
  if (modal?.type === "remove") {
    return <RemoveChannelModal channel={modal.channel} onClose={closeModal} />;
  }
  return null;
}

export default ChannelModals;
