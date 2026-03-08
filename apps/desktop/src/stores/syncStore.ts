import { create } from "zustand";

export type SyncStatus = "idle" | "syncing" | "online" | "offline";

type SyncStore = {
  status: SyncStatus;
  lastError: string;
  enabled: boolean;
  setStatus: (status: SyncStatus) => void;
  setLastError: (lastError: string) => void;
  setEnabled: (enabled: boolean) => void;
};

export const useSyncStore = create<SyncStore>((set) => ({
  status: "idle",
  lastError: "",
  enabled: true,
  setStatus: (status) => set({ status }),
  setLastError: (lastError) => set({ lastError }),
  setEnabled: (enabled) => set({ enabled }),
}));
