import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PaperSummary, Concept, Relation } from "../api/client";
import { storePaper, listStoredPapers, deleteStoredPaper } from "../api/client";

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
  syncPaperToServer: (paper: Paper) => Promise<void>;
  loadPapersFromServer: () => Promise<void>;
}

export const usePaperStore = create<PaperStore>()(
  persist(
    (set, get) => ({
      papers: [],

      addPaper: (paper) => {
        set((state) => {
          const exists = state.papers.some((p) => p.id === paper.id);
          if (exists) return state;
          return { papers: [...state.papers, paper] };
        });
        // Firestore へ自動同期（非同期・失敗してもブロックしない）
        setTimeout(() => get().syncPaperToServer(paper), 0);
      },

      removePaper: (paperId) => {
        set((state) => ({
          papers: state.papers.filter((p) => p.id !== paperId),
        }));
        // Firestore からも削除
        deleteStoredPaper(paperId).catch(() => {});
      },

      getPaper: (paperId) => {
        return get().papers.find((p) => p.id === paperId);
      },

      getPaperByConcept: (conceptId) => {
        return get().papers.find((p) => p.conceptIds.includes(conceptId));
      },

      clearPapers: () => set({ papers: [] }),

      syncPaperToServer: async (paper) => {
        try {
          await storePaper({
            id: paper.id,
            filename: paper.filename,
            uploadedAt: paper.uploadedAt,
            summary: paper.summary as unknown as Record<string, unknown>,
            conceptIds: paper.conceptIds,
            relationIds: paper.relationIds,
          });
        } catch (e) {
          console.warn("Failed to sync paper to server:", e);
        }
      },

      loadPapersFromServer: async () => {
        try {
          const data = await listStoredPapers();
          if (data.papers && data.papers.length > 0) {
            set({ papers: data.papers as unknown as Paper[] });
          }
        } catch (e) {
          console.warn("Failed to load papers from server:", e);
        }
      },
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
