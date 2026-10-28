import { createStore } from "zustand";

// Built per app launch by createStores (init.jsx): the state must not
// outlive a single launch. Intentionally not persisted, the chat always
// starts from the default channel.
//
// modal is null or { type: "add" } | { type: "rename", channel } |
// { type: "remove", channel }; ChannelModals renders it conditionally, so a
// freshly opened dialog always mounts a fresh form.
export const createUiStore = () =>
  createStore((set) => ({
    currentChannelId: null,
    setCurrentChannel: (currentChannelId) => set({ currentChannelId }),
    modal: null,
    openModal: (modal) => set({ modal }),
    closeModal: () => set({ modal: null }),
  }));
