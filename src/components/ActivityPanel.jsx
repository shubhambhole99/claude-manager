import React, { useRef, useEffect } from "react";
import "./ActivityPanel.css";

export default function ActivityPanel({ events, isOpen, onToggle }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const lastEvent = events[events.length - 1];
  const isDone = lastEvent?.type === "done";
  const isError = lastEvent?.type === "error";
  const isWorking = lastEvent && !isDone && !isError;

  return (
    <div className={`activity-panel ${isOpen ? "open" : "collapsed"}`}>
      <button className="activity-toggle" onClick={onToggle}>
        <span className={`activity-indicator ${isDone ? "done" : isError ? "error" : isWorking ? "working" : "idle"}`} />
        <span className="activity-label">
          {isDone ? "Done" : isError ? "Error" : isWorking ? "Working..." : "Idle"}
        </span>
        <span className="activity-arrow">{isOpen ? "▼" : "▲"}</span>
      </button>

      {isOpen && (
        <div className="activity-log" ref={scrollRef}>
          {events.length === 0 && (
            <div className="activity-empty">No activity yet</div>
          )}
          {events.map((evt, i) => (
            <div key={i} className={`activity-entry ${evt.type}`}>
              <span className="activity-time">
                {new Date(evt.timestamp).toLocaleTimeString()}
              </span>
              <span className={`activity-icon ${evt.type}`}>
                {evt.type === "start" ? "▶" :
                 evt.type === "tool" ? "⚙" :
                 evt.type === "status" ? "●" :
                 evt.type === "done" ? "✓" :
                 evt.type === "error" ? "✗" : "·"}
              </span>
              <span className="activity-text">{evt.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
