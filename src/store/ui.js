import { create } from "zustand";

// Session UI state (current channel, open modal later): intentionally not
// persisted, the chat always starts from the default channel.
//
// modal is null or { type: "add" } | { type: "rename", channel } |
// { type: "remove", channel }; ChannelModals renders it conditionally, so a
// freshly opened dialog always mounts a fresh form.
export const useUiStore = create((set) => ({
  currentChannelId: null,
  setCurrentChannel: (currentChannelId) => set({ currentChannelId }),
  modal: null,
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
}));
