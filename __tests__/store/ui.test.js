import { beforeEach, expect, test } from "vitest";

import { createUiStore } from "../../src/store/ui.js";

// A fresh instance per test mirrors the per-launch creation in init.jsx.
let ui;

beforeEach(() => {
  ui = createUiStore();
});

test("currentChannelId starts empty", () => {
  expect(ui.getState().currentChannelId).toBeNull();
});

test("setCurrentChannel stores the selected channel id", () => {
  ui.getState().setCurrentChannel("2");

  expect(ui.getState().currentChannelId).toBe("2");
});

test("openModal stores the modal descriptor, closeModal resets it", () => {
  expect(ui.getState().modal).toBeNull();

  const channel = { id: "3", name: "project", removable: true };
  ui.getState().openModal({ type: "rename", channel });
  expect(ui.getState().modal).toEqual({ type: "rename", channel });

  ui.getState().closeModal();
  expect(ui.getState().modal).toBeNull();
});
