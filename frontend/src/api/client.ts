import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost" ? "http://localhost:8001" : "");

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface PaperSummary {
  title: string;
  title_en: string;
  title_ja: string;
  authors: string[];
  year: string;
  original_language: string;
  abstract: string;
  abstract_ja: string;
  main_claim: string;
  main_claim_ja: string;
  introduction: string;
  development: string;
  turn: string;
  conclusion: string;
  easy_explanation: string;
}

export interface PaperResponse {
  paper_id: string;
  filename: string;
  status: string;
  concepts?: Concept[];
  relations?: Relation[];
  summary?: PaperSummary;
}

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

export async function uploadPaper(file: File): Promise<PaperResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post<PaperResponse>("/api/papers/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

// Chat API
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tool_calls?: Array<{ name: string; args: Record<string, unknown> }>;
  tool_results?: Array<{ name: string; result: Record<string, unknown> }>;
}

export interface ChatConcept {
  name: string;
  name_ja?: string;
  definition: string;
  definition_ja?: string;
  concept_type?: string;
}

export interface ChatActivityItem {
  agent: string;
  action: string;
  status: string;
  message: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  concepts: ChatConcept[];
  session_id?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  activities: ChatActivityItem[];
}

export async function sendChatMessage(
  messages: ChatMessage[],
  concepts: ChatConcept[]
): Promise<ChatResponse> {
  const response = await apiClient.post<ChatResponse>("/api/chat/", {
    messages,
    concepts,
  });
  return response.data;
}

// Learning Path API
export interface LearningStep {
  order: number;
  concept_id: string;
  concept_name: string;
  reason: string;
  prerequisites: string[];
}

export interface LearningPathResponse {
  steps: LearningStep[];
  summary: string;
}

export async function generateLearningPath(
  concepts: Concept[],
  relations: Relation[]
): Promise<LearningPathResponse> {
  const response = await apiClient.post<LearningPathResponse>("/api/learning-path/generate", {
    concepts,
    relations,
  });
  return response.data;
}

// Agent API
export interface AgentActivity {
  id: string;
  agent_id: string;
  agent_name: string;
  icon: string;
  action: string;
  status: "started" | "thinking" | "completed" | "delegating";
  message: string;
  timestamp: string;
  result?: Record<string, unknown>;
}

export interface AgentResponse {
  session_id: string;
  activities: AgentActivity[];
  result: Record<string, unknown>;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

export interface QuizResult {
  questions: QuizQuestion[];
}

export async function runAgent(
  task: "extract" | "quiz" | "learn" | "chat",
  input: string,
  concepts: Concept[] = [],
  context: Record<string, unknown> = {}
): Promise<AgentResponse> {
  const response = await apiClient.post<AgentResponse>("/api/agents/run", {
    task,
    input,
    concepts,
    context,
  });
  return response.data;
}

export async function getAgentList(): Promise<{ agents: Record<string, { name: string; icon: string; description: string }> }> {
  const response = await apiClient.get("/api/agents/agents");
  return response.data;
}

// Graph Sync API
export interface GraphSyncRequest {
  concepts: Concept[];
  relations: Relation[];
}

export interface GraphSyncResponse {
  success: boolean;
  concepts_synced: number;
  relations_synced: number;
  storage: "firestore" | "memory";
}

export interface GraphStatsResponse {
  total_concepts: number;
  total_relations: number;
  concept_types: Record<string, number>;
  relation_types: Record<string, number>;
  storage: "firestore" | "memory";
}

export async function syncGraph(
  concepts: Concept[],
  relations: Relation[]
): Promise<GraphSyncResponse> {
  const response = await apiClient.post<GraphSyncResponse>("/api/graph/sync", {
    concepts,
    relations,
  });
  return response.data;
}

export async function getGraphFromServer(): Promise<{ concepts: Concept[]; relations: Relation[] }> {
  const response = await apiClient.get("/api/graph/");
  return response.data;
}

export async function clearGraphOnServer(): Promise<{ success: boolean; concepts_deleted: number; relations_deleted: number }> {
  const response = await apiClient.delete("/api/graph/");
  return response.data;
}

export async function getGraphStats(): Promise<GraphStatsResponse> {
  const response = await apiClient.get("/api/graph/stats");
  return response.data;
}

// Semantic Search API (Vector Search)
export interface SimilarConceptResult {
  concept: Concept;
  similarity: number;
}

export interface SuggestedRelation {
  source: string;
  source_id: string;
  target: string;
  target_id: string;
  relation_type: string;
  confidence: number;
  suggested: boolean;
}

export interface SuggestRelationsResponse {
  suggestions: SuggestedRelation[];
  total_suggestions: number;
}

export async function semanticSearch(
  query: string,
  topK: number = 5,
  threshold: number = 0.5
): Promise<SimilarConceptResult[]> {
  const response = await apiClient.post<SimilarConceptResult[]>("/api/graph/semantic-search", {
    query,
    top_k: topK,
    threshold,
  });
  return response.data;
}

export async function getSimilarConcepts(
  conceptId: string,
  topK: number = 5,
  threshold: number = 0.5
): Promise<SimilarConceptResult[]> {
  const response = await apiClient.get<SimilarConceptResult[]>(
    `/api/graph/concepts/${conceptId}/similar`,
    { params: { top_k: topK, threshold } }
  );
  return response.data;
}

export async function suggestRelations(
  threshold: number = 0.7
): Promise<SuggestRelationsResponse> {
  const response = await apiClient.post<SuggestRelationsResponse>("/api/graph/suggest-relations", {
    threshold,
  });
  return response.data;
}

// ADK Chat API (ADK Runner を使用)
export interface ADKChatConcept {
  name: string;
  name_ja?: string;
  definition: string;
  definition_ja?: string;
  concept_type?: string;
}

export interface ADKAgentEvent {
  event_type: "thinking" | "tool_call" | "tool_result" | "response" | "error" | "completed";
  agent_name: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ADKChatRequest {
  message: string;
  session_id?: string;
  concepts?: ADKChatConcept[];
}

export interface ADKChatResponse {
  session_id: string;
  response: string;
  events: ADKAgentEvent[];
}

export async function sendADKChatMessage(
  message: string,
  concepts: ADKChatConcept[] = [],
  sessionId?: string
): Promise<ADKChatResponse> {
  const response = await apiClient.post<ADKChatResponse>("/api/adk/", {
    message,
    concepts,
    session_id: sessionId,
  });
  return response.data;
}

export async function getADKSessionHistory(
  sessionId: string
): Promise<{ session_id: string; messages: Array<{ role: string; content: string }> }> {
  const response = await apiClient.get(`/api/adk/sessions/${sessionId}`);
  return response.data;
}
