import { createContext, useContext } from "react";
import { useStore } from "zustand";

// init.jsx builds the per-launch stores and hands them to the tree through
// this context, so components and plain helpers read the same instances the
// socket handlers write to.
export const StoresContext = createContext(null);

export const useStores = () => {
  const stores = useContext(StoresContext);
  if (!stores) {
    throw new Error("Stores are not provided: the tree must render inside StoresContext.Provider");
  }
  return stores;
};

// Selector hooks keep the component call-sites identical to the previous
// module-singleton shape: useAuthStore((state) => state.token).
export const useAuthStore = (selector) => useStore(useStores().auth, selector);

export const useUiStore = (selector) => useStore(useStores().ui, selector);
