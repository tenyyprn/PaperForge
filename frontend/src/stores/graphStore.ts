import { create } from "zustand";
import { persist } from "zustand/middleware";
import { syncGraph, getGraphFromServer } from "../api/client";

export type ConceptType =
  | "method"
  | "model"
  | "dataset"
  | "task"
  | "metric"
  | "domain"
  | "theory"
  | "application"
  | "concept";

// オントロジータイプ別の色定義
export const CONCEPT_TYPE_COLORS: Record<ConceptType, string> = {
  method: "#FF6B6B",      // 赤 - 手法
  model: "#4ECDC4",       // ティール - モデル
  dataset: "#45B7D1",     // 青 - データセット
  task: "#96CEB4",        // 緑 - タスク
  metric: "#FFEAA7",      // 黄 - 評価指標
  domain: "#DDA0DD",      // プラム - 研究分野
  theory: "#98D8C8",      // ミント - 理論
  application: "#F7DC6F", // ゴールド - 応用
  concept: "#B0B0B0",     // グレー - 一般概念
};

export const CONCEPT_TYPE_LABELS: Record<ConceptType, string> = {
  method: "手法",
  model: "モデル",
  dataset: "データセット",
  task: "タスク",
  metric: "評価指標",
  domain: "研究分野",
  theory: "理論",
  application: "応用",
  concept: "概念",
};

export interface Concept {
  id: string;
  name: string;
  name_en: string;
  name_ja: string;
  definition: string;
  definition_ja: string;
  concept_type: ConceptType;
}

export interface Relation {
  id: string;
  source: string;
  target: string;
  relation_type: string;
}

export interface GraphNode {
  id: string;
  name: string;
  name_en: string;
  name_ja: string;
  definition: string;
  definition_ja: string;
  concept_type: ConceptType;
  color: string;
  val: number;
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphStore {
  concepts: Concept[];
  relations: Relation[];
  syncStatus: "idle" | "syncing" | "synced" | "error";
  lastSyncedAt: string | null;
  storageType: "local" | "firestore" | "memory";
  addConcepts: (concepts: Concept[]) => void;
  addRelations: (relations: Relation[]) => void;
  clearGraph: () => void;
  getGraphData: () => GraphData;
  syncToServer: () => Promise<void>;
  loadFromServer: () => Promise<void>;
}

export const useGraphStore = create<GraphStore>()(
  persist(
    (set, get) => ({
      concepts: [],
      relations: [],
      syncStatus: "idle",
      lastSyncedAt: null,
      storageType: "local",

      addConcepts: (newConcepts) => {
        set((state) => {
          const existingIds = new Set(state.concepts.map((c) => c.id));
          const uniqueConcepts = newConcepts.filter((c) => !existingIds.has(c.id));
          return { concepts: [...state.concepts, ...uniqueConcepts] };
        });
        // Firestore へ自動同期（非同期・失敗してもブロックしない）
        setTimeout(() => get().syncToServer(), 0);
      },

      addRelations: (newRelations) => {
        set((state) => {
          const existingIds = new Set(state.relations.map((r) => r.id));
          const uniqueRelations = newRelations.filter((r) => !existingIds.has(r.id));
          return { relations: [...state.relations, ...uniqueRelations] };
        });
        setTimeout(() => get().syncToServer(), 0);
      },

      clearGraph: () => set({ concepts: [], relations: [] }),

      getGraphData: () => {
        const { concepts, relations } = get();

        const nodes: GraphNode[] = concepts.map((c) => ({
          id: c.id,
          name: c.name,
          name_en: c.name_en || "",
          name_ja: c.name_ja || "",
          definition: c.definition,
          definition_ja: c.definition_ja || c.definition,
          concept_type: c.concept_type || "concept",
          color: CONCEPT_TYPE_COLORS[c.concept_type || "concept"],
          val: 1,
        }));

        // 概念名からIDへのマッピング
        const nameToId = new Map(concepts.map((c) => [c.name, c.id]));

        const links: GraphLink[] = relations
          .map((r) => ({
            source: nameToId.get(r.source) || r.source,
            target: nameToId.get(r.target) || r.target,
            label: r.relation_type,
          }))
          .filter((l) => nameToId.has(l.source) || nameToId.has(l.target));

        return { nodes, links };
      },

      syncToServer: async () => {
        const { concepts, relations } = get();
        set({ syncStatus: "syncing" });

        try {
          const result = await syncGraph(concepts, relations);
          set({
            syncStatus: "synced",
            lastSyncedAt: new Date().toISOString(),
            storageType: result.storage === "firestore" ? "firestore" : "memory",
          });
        } catch (error) {
          console.error("Sync failed:", error);
          set({ syncStatus: "error" });
        }
      },

      loadFromServer: async () => {
        set({ syncStatus: "syncing" });

        try {
          const data = await getGraphFromServer();
          set({
            concepts: data.concepts as Concept[],
            relations: data.relations,
            syncStatus: "synced",
            lastSyncedAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Load from server failed:", error);
          set({ syncStatus: "error" });
        }
      },
    }),
    {
      name: "paperforge-graph",
      partialize: (state) => ({
        concepts: state.concepts,
        relations: state.relations,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
