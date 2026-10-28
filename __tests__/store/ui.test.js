import { beforeEach, expect, test } from "vitest";

import { useUiStore } from "../../src/store/ui.js";

beforeEach(() => {
  useUiStore.setState({ currentChannelId: null, modal: null });
});

test("currentChannelId starts empty", () => {
  expect(useUiStore.getState().currentChannelId).toBeNull();
});

test("setCurrentChannel stores the selected channel id", () => {
  useUiStore.getState().setCurrentChannel("2");

  expect(useUiStore.getState().currentChannelId).toBe("2");
});

test("openModal stores the modal descriptor, closeModal resets it", () => {
  expect(useUiStore.getState().modal).toBeNull();

  const channel = { id: "3", name: "project", removable: true };
  useUiStore.getState().openModal({ type: "rename", channel });
  expect(useUiStore.getState().modal).toEqual({ type: "rename", channel });

  useUiStore.getState().closeModal();
  expect(useUiStore.getState().modal).toBeNull();
});
