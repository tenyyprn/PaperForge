import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { sendChatMessage, type ChatMessage, type ChatActivityItem } from "../api/client";
import { useGraphStore } from "../stores/graphStore";

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activities, setActivities] = useState<ChatActivityItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoSent = useRef(false);
  const { concepts } = useGraphStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // メッセージ送信の共通ロジック
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    setMessages((prev) => {
      const newMessages = [...prev, userMessage];
      // 非同期で API 呼び出し
      const chatConcepts = concepts.map((c) => ({
        name: c.name,
        name_ja: c.name_ja || "",
        definition: c.definition,
        definition_ja: c.definition_ja || "",
        concept_type: c.concept_type || "concept",
      }));
      setIsLoading(true);
      setActivities([]);
      sendChatMessage(newMessages, chatConcepts)
        .then((response) => {
          setMessages((prev) => [...prev, response.message]);
          setActivities(response.activities || []);
        })
        .catch(() => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "エラーが発生しました。もう一度お試しください。" },
          ]);
        })
        .finally(() => setIsLoading(false));
      return newMessages;
    });
    setInput("");
  }, [isLoading, concepts]);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "started":
        return "🚀";
      case "executing":
        return "⚡";
      case "completed":
        return "✓";
      case "failed":
        return "✗";
      default:
        return "•";
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "thinking":
        return "思考中";
      case "tool_call":
        return "ツール呼び出し";
      case "tool_result":
        return "ツール結果";
      case "response":
        return "回答生成";
      case "error":
        return "エラー";
      default:
        return action;
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
                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    {msg.role === "assistant" && (
                      <span className="message-avatar">🎓</span>
                    )}
                    <div className="message-content">
                      {msg.content}
                      {msg.tool_calls && msg.tool_calls.length > 0 && (
                        <div className="tool-calls">
                          {msg.tool_calls.map((tc, j) => (
                            <span key={j} className="tool-call-badge">
                              🔧 {tc.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
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
                <div key={i} className={`activity-item ${activity.status}`}>
                  <span className="activity-status">
                    {getStatusIcon(activity.status)}
                  </span>
                  <div className="activity-details">
                    <div className="activity-header">
                      <span className="activity-agent">{activity.agent}</span>
                      <span className="activity-action">
                        {getActionLabel(activity.action)}
                      </span>
                    </div>
                    <p className="activity-message">{activity.message}</p>
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
