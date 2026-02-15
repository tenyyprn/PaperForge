import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  defaultUploadDirectory: string;
  setDefaultUploadDirectory: (path: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultUploadDirectory: "",
      setDefaultUploadDirectory: (path: string) => set({ defaultUploadDirectory: path }),
    }),
    {
      name: "paperforge-settings",
    }
  )
);
