import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LearningStep {
  order: number;
  concept_id: string;
  concept_name: string;
  reason: string;
  prerequisites: string[];
}

export interface SavedLearningPath {
  id: string;
  steps: LearningStep[];
  summary: string;
  completedSteps: number[];
  createdAt: string;
}

interface LearningPathStore {
  paths: SavedLearningPath[];
  activePathId: string | null;
  savePath: (steps: LearningStep[], summary: string) => string;
  deletePath: (pathId: string) => void;
  setActivePath: (pathId: string | null) => void;
  getActivePath: () => SavedLearningPath | undefined;
  toggleStepComplete: (pathId: string, order: number) => void;
  clearPaths: () => void;
}

export const useLearningPathStore = create<LearningPathStore>()(
  persist(
    (set, get) => ({
      paths: [],
      activePathId: null,

      savePath: (steps, summary) => {
        const id = `lp-${Date.now()}`;
        const newPath: SavedLearningPath = {
          id,
          steps,
          summary,
          completedSteps: [],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          paths: [newPath, ...state.paths],
          activePathId: id,
        }));
        return id;
      },

      deletePath: (pathId) => {
        set((state) => ({
          paths: state.paths.filter((p) => p.id !== pathId),
          activePathId: state.activePathId === pathId ? null : state.activePathId,
        }));
      },

      setActivePath: (pathId) => {
        set({ activePathId: pathId });
      },

      getActivePath: () => {
        const { paths, activePathId } = get();
        return paths.find((p) => p.id === activePathId);
      },

      toggleStepComplete: (pathId, order) => {
        set((state) => ({
          paths: state.paths.map((p) => {
            if (p.id !== pathId) return p;
            const completed = p.completedSteps.includes(order)
              ? p.completedSteps.filter((s) => s !== order)
              : [...p.completedSteps, order];
            return { ...p, completedSteps: completed };
          }),
        }));
      },

      clearPaths: () => set({ paths: [], activePathId: null }),
    }),
    {
      name: "paperforge-learning-paths",
    }
  )
);
