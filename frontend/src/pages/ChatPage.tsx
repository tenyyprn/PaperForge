import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { sendADKChatMessage, type ADKAgentEvent } from "../api/client";
import { useGraphStore } from "../stores/graphStore";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
}

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activities, setActivities] = useState<ADKAgentEvent[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoSent = useRef(false);
  const { concepts } = useGraphStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ADK Runner 経由でメッセージ送信
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: DisplayMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setActivities([]);

    try {
      const adkConcepts = concepts.map((c) => ({
        name: c.name,
        name_ja: c.name_ja || "",
        definition: c.definition,
        definition_ja: c.definition_ja || "",
        concept_type: c.concept_type || "concept",
      }));

      const response = await sendADKChatMessage(text, adkConcepts, sessionId);
      setSessionId(response.session_id);

      // ツール呼び出しを抽出
      const toolCalls = response.events
        .filter((e) => e.event_type === "tool_call")
        .map((e) => e.metadata?.tool_name as string)
        .filter(Boolean);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.response || "応答を生成できませんでした。",
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
      ]);
      setActivities(response.events);
    } catch (err) {
      // セッションエラーの場合はセッションをリセット
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("Session not found") || errMsg.includes("session")) {
        setSessionId(undefined);
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "エラーが発生しました。もう一度お試しください。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, concepts, sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // URLパラメータ ?q= から質問を自動送信（GraphPage等からの遷移）
  useEffect(() => {
    const question = searchParams.get("q");
    if (question && !hasAutoSent.current) {
      hasAutoSent.current = true;
      setSearchParams({}, { replace: true });
      sendMessage(question);
    }
  }, [searchParams, setSearchParams, sendMessage]);

  const suggestedQuestions = [
    "登録されている概念を説明して",
    "この分野を学ぶ順番を教えて",
    "理解度クイズを出して",
    "関連する論文を教えて",
  ];

  const handleSuggestionClick = (question: string) => {
    setInput(question);
  };

  // アシスタントメッセージからクイックリプライ選択肢を検出
  const detectQuickReplies = (content: string, isLast: boolean): { label: string; value: string }[] => {
    if (!isLast || isLoading) return [];

    // beginner / intermediate / advanced パターン
    if (content.includes("beginner") && content.includes("intermediate") && content.includes("advanced")) {
      return [
        { label: "🔰 初心者向け", value: "beginner（初心者向け）でお願いします" },
        { label: "📘 中級者向け", value: "intermediate（中級者向け）でお願いします" },
        { label: "🎓 上級者向け", value: "advanced（上級者向け）でお願いします" },
      ];
    }

    // easy / intermediate / hard パターン（クイズ難易度）
    if (content.includes("easy") && content.includes("hard")) {
      return [
        { label: "😊 かんたん", value: "easy（かんたん）でお願いします" },
        { label: "📘 ふつう", value: "intermediate（ふつう）でお願いします" },
        { label: "🔥 むずかしい", value: "hard（むずかしい）でお願いします" },
      ];
    }

    return [];
  };

  const getStatusIcon = (eventType: string) => {
    switch (eventType) {
      case "thinking":
        return "🚀";
      case "tool_call":
        return "⚡";
      case "tool_result":
        return "✓";
      case "response":
      case "completed":
        return "✓";
      case "error":
        return "✗";
      default:
        return "•";
    }
  };

  const getActionLabel = (eventType: string) => {
    switch (eventType) {
      case "thinking":
        return "思考中";
      case "tool_call":
        return "ツール呼び出し";
      case "tool_result":
        return "ツール結果";
      case "response":
        return "回答生成";
      case "completed":
        return "完了";
      case "error":
        return "エラー";
      default:
        return eventType;
    }
  };

  return (
    <div className="chat-page page-container">
      <div className="chat-header">
        <h2>学習サポートチャット</h2>
        <div className="chat-header-info">
          <span className="agent-badge">🎓 Tutor Agent</span>
          <span className="concept-count">
            登録済み概念: {concepts.length}件
          </span>
        </div>
      </div>

      <div className="chat-layout">
        <div className="chat-container">
          <div className="messages">
            {messages.length === 0 ? (
              <div className="empty-state">
                <div className="agent-intro">
                  <span className="agent-avatar">🎓</span>
                  <div className="agent-info">
                    <h3>Tutor Agent</h3>
                    <p>論文から学んだ知識を深めるお手伝いをします</p>
                  </div>
                </div>
                <div className="capabilities">
                  <div className="capability">
                    <span className="capability-icon">📖</span>
                    <span>概念の説明</span>
                  </div>
                  <div className="capability">
                    <span className="capability-icon">❓</span>
                    <span>クイズ生成</span>
                  </div>
                  <div className="capability">
                    <span className="capability-icon">🗺️</span>
                    <span>学習パス</span>
                  </div>
                  <div className="capability">
                    <span className="capability-icon">📚</span>
                    <span>論文提案</span>
                  </div>
                </div>
                <div className="suggestions">
                  <p>質問例:</p>
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      className="suggestion-btn"
                      onClick={() => handleSuggestionClick(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => {
                  const isLastAssistant = msg.role === "assistant" && i === messages.length - 1;
                  const quickReplies = msg.role === "assistant"
                    ? detectQuickReplies(msg.content, isLastAssistant)
                    : [];
                  return (
                    <div key={i} className={`message ${msg.role}`}>
                      {msg.role === "assistant" && (
                        <span className="message-avatar">🎓</span>
                      )}
                      <div className="message-content">
                        {msg.content}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <div className="tool-calls">
                            {msg.toolCalls.map((tc, j) => (
                              <span key={j} className="tool-call-badge">
                                🔧 {tc}
                              </span>
                            ))}
                          </div>
                        )}
                        {quickReplies.length > 0 && (
                          <div className="quick-replies">
                            {quickReplies.map((qr, j) => (
                              <button
                                key={j}
                                className="quick-reply-btn"
                                onClick={() => sendMessage(qr.value)}
                                disabled={isLoading}
                              >
                                {qr.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {isLoading && (
                  <div className="message assistant">
                    <span className="message-avatar">🎓</span>
                    <div className="message-content loading">
                      <span className="loading-dots">考え中</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="chat-input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="質問を入力..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? "..." : "送信"}
            </button>
          </form>
        </div>

        {/* Agent Activity Panel */}
        {activities.length > 0 && (
          <div className="agent-activity-sidebar">
            <h4>エージェント活動</h4>
            <div className="activity-timeline">
              {activities.map((activity, i) => (
                <div key={i} className={`activity-item ${activity.event_type}`}>
                  <span className="activity-status">
                    {getStatusIcon(activity.event_type)}
                  </span>
                  <div className="activity-details">
                    <div className="activity-header">
                      <span className="activity-agent">{activity.agent_name}</span>
                      <span className="activity-action">
                        {getActionLabel(activity.event_type)}
                      </span>
                    </div>
                    <p className="activity-message">{activity.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
