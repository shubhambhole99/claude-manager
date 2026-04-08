import React from "react";
import "./VoiceOrb.css";

export default function VoiceOrb({ isListening, isSpeaking, isThinking, onToggle, onStop }) {
  const getState = () => {
    if (isThinking) return "thinking";
    if (isSpeaking) return "speaking";
    if (isListening) return "listening";
    return "idle";
  };

  const state = getState();

  return (
    <div className="voice-orb-container">
      {(isSpeaking || isThinking) && (
        <button className="stop-btn" onClick={onStop} title="Stop">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          Stop
        </button>
      )}

      <button
        className={`voice-orb ${state}`}
        onClick={onToggle}
        title={isListening ? "Stop listening" : "Start listening"}
      >
        <div className="orb-inner">
          {state === "listening" && (
            <>
              <div className="pulse-ring ring-1" />
              <div className="pulse-ring ring-2" />
              <div className="pulse-ring ring-3" />
            </>
          )}
          {state === "thinking" && <div className="spin-ring" />}
          {state === "speaking" && (
            <div className="wave-bars">
              <span /><span /><span /><span /><span />
            </div>
          )}
          <div className="orb-icon">
            {state === "idle" && <MicIcon />}
            {state === "listening" && <MicActiveIcon />}
            {state === "thinking" && <BrainIcon />}
            {state === "speaking" && <SpeakerIcon />}
          </div>
        </div>
      </button>

      <span className="orb-label">
        {state === "idle" && "Click to talk"}
        {state === "listening" && "Listening..."}
        {state === "thinking" && "Thinking..."}
        {state === "speaking" && "Speaking..."}
      </span>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicActiveIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
