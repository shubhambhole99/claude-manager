import React, { useRef, useEffect, useState } from "react";
import "./ChatPanel.css";

export default function ChatPanel({ messages, streamingText, isThinking, onSendMessage }) {
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [inputText, setInputText] = useState("");
  const [pendingImages, setPendingImages] = useState([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() && pendingImages.length === 0) return;
    onSendMessage(inputText.trim(), pendingImages.map(img => img.dataUrl));
    setInputText("");
    setPendingImages([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) addImageFile(file);
      }
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.type.startsWith("image/")) addImageFile(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files || []);
    for (const file of files) {
      if (file.type.startsWith("image/")) addImageFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const addImageFile = (file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPendingImages(prev => [...prev, { dataUrl: ev.target.result, name: file.name }]);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="chat-panel" onDrop={handleDrop} onDragOver={handleDragOver}>
      <div className="messages-container">
        {messages.length === 0 && !streamingText && !isThinking && (
          <div className="empty-state">
            <div className="empty-icon">C</div>
            <h2>Christopher</h2>
            <p>Your personal AI assistant. Click the orb to start talking, or type below.</p>
            <div className="capabilities">
              <div className="cap-item">
                <span className="cap-icon">🖥</span>
                <span>Full computer access</span>
              </div>
              <div className="cap-item">
                <span className="cap-icon">🎙</span>
                <span>Voice conversations</span>
              </div>
              <div className="cap-item">
                <span className="cap-icon">📷</span>
                <span>Image understanding</span>
              </div>
              <div className="cap-item">
                <span className="cap-icon">🔀</span>
                <span>Parallel tasks</span>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === "user" ? "S" : msg.role === "system" ? "!" : "C"}
            </div>
            <div className="message-body">
              <div className="message-meta">
                <span className="message-sender">
                  {msg.role === "user" ? "You" : msg.role === "system" ? "System" : "Christopher"}
                </span>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">
                {msg.images && msg.images.length > 0 && (
                  <div className="message-images">
                    {msg.images.map((img, j) => (
                      <img key={j} src={img} alt="Attached" className="message-image" />
                    ))}
                  </div>
                )}
                <MessageContent text={msg.content} />
              </div>
            </div>
          </div>
        ))}

        {isThinking && !streamingText && (
          <div className="message assistant">
            <div className="message-avatar">C</div>
            <div className="message-body">
              <div className="thinking-dots">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        {streamingText && (
          <div className="message assistant streaming">
            <div className="message-avatar">C</div>
            <div className="message-body">
              <div className="message-meta">
                <span className="message-sender">Christopher</span>
              </div>
              <div className="message-content">
                <MessageContent text={streamingText} />
                <span className="cursor-blink" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {pendingImages.length > 0 && (
        <div className="image-preview-bar">
          {pendingImages.map((img, i) => (
            <div key={i} className="image-preview-item">
              <img src={img.dataUrl} alt={img.name || "Preview"} />
              <button className="image-remove-btn" onClick={() => removeImage(i)}>x</button>
            </div>
          ))}
        </div>
      )}

      <form className="input-bar" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
        <button
          type="button"
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach image (or paste with Ctrl+V)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
        <textarea
          ref={inputRef}
          className="chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Message Christopher... (paste images with Ctrl+V)"
          rows={1}
        />
        <button type="submit" className="send-btn" disabled={!inputText.trim() && pendingImages.length === 0}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function MessageContent({ text }) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const content = part.slice(3, -3);
      const firstLine = content.indexOf("\n");
      const lang = firstLine > 0 ? content.slice(0, firstLine).trim() : "";
      const code = firstLine > 0 ? content.slice(firstLine + 1) : content;
      return (
        <pre key={i} className="code-block">
          {lang && <div className="code-lang">{lang}</div>}
          <code>{code}</code>
        </pre>
      );
    }
    return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{part}</span>;
  });
}
