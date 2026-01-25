import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // TODO: API呼び出しを実装
    const assistantMessage: Message = {
      role: "assistant",
      content: "申し訳ありません。まだAPIが接続されていません。",
    };
    setMessages((prev) => [...prev, assistantMessage]);
  };

  return (
    <div className="chat-page">
      <h2>チャット</h2>
      <div className="chat-container">
        <div className="messages">
          {messages.length === 0 ? (
            <p className="empty-state">
              論文について質問したり、学習パスを生成してもらいましょう。
            </p>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                {msg.content}
              </div>
            ))
          )}
        </div>
        <form onSubmit={handleSubmit} className="chat-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="質問を入力..."
          />
          <button type="submit">送信</button>
        </form>
      </div>
    </div>
  );
}
