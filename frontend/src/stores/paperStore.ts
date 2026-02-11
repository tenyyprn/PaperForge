import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PaperSummary, Concept, Relation } from "../api/client";

export interface Paper {
  id: string;
  filename: string;
  uploadedAt: string;
  summary: PaperSummary;
  conceptIds: string[];  // このペーパーから抽出された概念のID
  relationIds: string[]; // このペーパーから抽出された関係のID
}

interface PaperStore {
  papers: Paper[];
  addPaper: (paper: Paper) => void;
  removePaper: (paperId: string) => void;
  getPaper: (paperId: string) => Paper | undefined;
  getPaperByConcept: (conceptId: string) => Paper | undefined;
  clearPapers: () => void;
}

export const usePaperStore = create<PaperStore>()(
  persist(
    (set, get) => ({
      papers: [],

      addPaper: (paper) =>
        set((state) => {
          // 既に同じIDの論文が存在する場合は追加しない
          const exists = state.papers.some((p) => p.id === paper.id);
          if (exists) return state;
          return { papers: [...state.papers, paper] };
        }),

      removePaper: (paperId) =>
        set((state) => ({
          papers: state.papers.filter((p) => p.id !== paperId),
        })),

      getPaper: (paperId) => {
        return get().papers.find((p) => p.id === paperId);
      },

      getPaperByConcept: (conceptId) => {
        return get().papers.find((p) => p.conceptIds.includes(conceptId));
      },

      clearPapers: () => set({ papers: [] }),
    }),
    {
      name: "paperforge-papers",
    }
  )
);

// Helper function to create a Paper from PaperResponse
export function createPaperFromResponse(
  paperId: string,
  filename: string,
  summary: PaperSummary,
  concepts: Concept[],
  relations: Relation[]
): Paper {
  return {
    id: paperId,
    filename,
    uploadedAt: new Date().toISOString(),
    summary,
    conceptIds: concepts.map((c) => c.id),
    relationIds: relations.map((r) => r.id),
  };
}
