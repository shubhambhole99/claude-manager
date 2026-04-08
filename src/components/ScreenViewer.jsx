import React, { useState, useEffect, useRef, useCallback } from "react";
import "./ScreenViewer.css";

const RESOLUTION_OPTIONS = [
  { label: "Auto (logical)", w: 0, h: 0 },
  { label: "1920x1080", w: 1920, h: 1080 },
  { label: "2560x1440", w: 2560, h: 1440 },
  { label: "2880x1800", w: 2880, h: 1800 },
  { label: "3840x2160", w: 3840, h: 2160 },
  { label: "1440x900", w: 1440, h: 900 },
  { label: "1366x768", w: 1366, h: 768 },
  { label: "1280x720", w: 1280, h: 720 },
];

export default function ScreenViewer({ socket, onClose }) {
  const [displays, setDisplays] = useState([]);
  const [selectedDisplay, setSelectedDisplay] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [frame, setFrame] = useState(null);
  const [fps, setFps] = useState(5);
  const [quality, setQuality] = useState(50);
  const [actualFps, setActualFps] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState(true);
  const [resOverrides, setResOverrides] = useState({}); // { "0": {width, height}, ... }
  const fpsCountRef = useRef(0);
  const fpsTimerRef = useRef(null);
  const canvasRef = useRef(null);
  const pinchRef = useRef({ active: false, startDist: 0, startZoom: 1 });

  // Load displays + saved overrides on mount
  useEffect(() => {
    if (!socket) return;
    socket.emit("screen:list");
    fetch("/api/settings/screen-res").then(r => r.json()).then(setResOverrides).catch(() => {});

    const handleDisplays = ({ displays: d }) => {
      if (d && d.length > 0) {
        setDisplays(d);
        const primary = d.findIndex((x) => x.primary);
        if (primary >= 0) setSelectedDisplay(primary);
      } else {
        setDisplays([{ id: 0, name: "Primary Display", nativeWidth: 1920, nativeHeight: 1080, logicalWidth: 1920, logicalHeight: 1080, primary: true }]);
      }
    };

    const handleFrame = ({ image }) => {
      setFrame(image);
      fpsCountRef.current++;
    };

    socket.on("screen:displays", handleDisplays);
    socket.on("screen:frame", handleFrame);

    return () => {
      socket.off("screen:displays", handleDisplays);
      socket.off("screen:frame", handleFrame);
      socket.emit("screen:stop");
    };
  }, [socket]);

  // Measure actual FPS
  useEffect(() => {
    if (streaming) {
      fpsCountRef.current = 0;
      fpsTimerRef.current = setInterval(() => {
        setActualFps(fpsCountRef.current);
        fpsCountRef.current = 0;
      }, 1000);
    } else {
      if (fpsTimerRef.current) clearInterval(fpsTimerRef.current);
      setActualFps(0);
    }
    return () => { if (fpsTimerRef.current) clearInterval(fpsTimerRef.current); };
  }, [streaming]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    if (fitMode) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(Math.max(z + delta, 0.1), 3));
  }, [fitMode]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Pinch-to-zoom
  const getTouchDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      if (fitMode) { setFitMode(false); setZoom(1); }
      pinchRef.current = { active: true, startDist: getTouchDist(e.touches), startZoom: zoom };
    }
  };

  const handleTouchMove = (e) => {
    if (pinchRef.current.active && e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      const scale = dist / pinchRef.current.startDist;
      setZoom(Math.min(Math.max(pinchRef.current.startZoom * scale, 0.1), 3));
    }
  };

  const handleTouchEnd = () => { pinchRef.current.active = false; };

  const emitStart = (dispIdx, fpsVal, qualVal) => {
    if (!socket) return;
    socket.emit("screen:start", { displayIndex: dispIdx, fps: fpsVal, quality: qualVal });
  };

  const startStream = () => {
    emitStart(selectedDisplay, fps, quality);
    setStreaming(true);
  };

  const stopStream = () => {
    if (!socket) return;
    socket.emit("screen:stop");
    setStreaming(false);
  };

  const changeDisplay = (idx) => {
    setSelectedDisplay(idx);
    setFrame(null);
    if (streaming) emitStart(idx, fps, quality);
  };

  const changeFps = (newFps) => {
    setFps(newFps);
    if (streaming) emitStart(selectedDisplay, newFps, quality);
  };

  const changeQuality = (q) => {
    setQuality(q);
    if (streaming) emitStart(selectedDisplay, fps, q);
  };

  const changeResolution = async (value) => {
    const key = String(selectedDisplay);
    let newOverrides;

    if (value === "auto") {
      // Remove override
      newOverrides = { ...resOverrides };
      delete newOverrides[key];
      await fetch(`/api/settings/screen-res/${key}`, { method: "DELETE" }).catch(() => {});
    } else {
      const [w, h] = value.split("x").map(Number);
      newOverrides = { ...resOverrides, [key]: { width: w, height: h } };
      await fetch("/api/settings/screen-res", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayIndex: selectedDisplay, width: w, height: h }),
      }).catch(() => {});
    }

    setResOverrides(newOverrides);
    // Restart stream to apply
    if (streaming) {
      socket.emit("screen:stop");
      setTimeout(() => emitStart(selectedDisplay, fps, quality), 200);
    }
  };

  const getCurrentResValue = () => {
    const override = resOverrides[String(selectedDisplay)];
    if (!override) return "auto";
    return `${override.width}x${override.height}`;
  };

  const zoomIn = () => {
    if (fitMode) { setFitMode(false); setZoom(1.2); return; }
    setZoom((z) => Math.min(z + 0.2, 3));
  };

  const zoomOut = () => {
    if (fitMode) { setFitMode(false); setZoom(0.8); return; }
    setZoom((z) => Math.max(z - 0.2, 0.1));
  };

  const resetFit = () => { setFitMode(true); setZoom(1); };

  const displayLabel = (d, i) => {
    const tag = d.primary ? " *" : "";
    const native = d.nativeWidth && d.nativeHeight ? `${d.nativeWidth}x${d.nativeHeight}` : `${d.logicalWidth || "?"}x${d.logicalHeight || "?"}`;
    return `Display ${i} (${native})${tag}`;
  };

  return (
    <div className="screen-viewer">
      <div className="screen-viewer-toolbar">
        <div className="screen-viewer-controls">
          <select className="screen-select" value={selectedDisplay}
            onChange={(e) => changeDisplay(Number(e.target.value))}>
            {displays.map((d, i) => (
              <option key={i} value={i}>{displayLabel(d, i)}</option>
            ))}
          </select>

          <select className="fps-select" value={getCurrentResValue()}
            onChange={(e) => changeResolution(e.target.value)} title="Output resolution">
            <option value="auto">Auto</option>
            {RESOLUTION_OPTIONS.filter(r => r.w > 0).map((r) => (
              <option key={r.label} value={`${r.w}x${r.h}`}>{r.label}</option>
            ))}
          </select>

          <select className="fps-select" value={fps}
            onChange={(e) => changeFps(Number(e.target.value))}>
            <option value={1}>1 FPS</option>
            <option value={2}>2 FPS</option>
            <option value={3}>3 FPS</option>
            <option value={5}>5 FPS</option>
            <option value={8}>8 FPS</option>
            <option value={10}>10 FPS</option>
            <option value={15}>15 FPS</option>
          </select>

          <select className="fps-select" value={quality}
            onChange={(e) => changeQuality(Number(e.target.value))} title="Image quality">
            <option value={30}>Low Q</option>
            <option value={50}>Med Q</option>
            <option value={70}>High Q</option>
            <option value={90}>Max Q</option>
          </select>

          {!streaming ? (
            <button className="screen-btn start" onClick={startStream}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              View
            </button>
          ) : (
            <button className="screen-btn stop" onClick={stopStream}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
              Stop
            </button>
          )}

          <span style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />

          <button className="screen-btn zoom-btn" onClick={zoomOut} title="Zoom out">-</button>
          <span className="zoom-label">{fitMode ? "Fit" : `${Math.round(zoom * 100)}%`}</span>
          <button className="screen-btn zoom-btn" onClick={zoomIn} title="Zoom in">+</button>
          <button className={`screen-btn zoom-btn ${fitMode ? "active" : ""}`} onClick={resetFit} title="Fit to screen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>

        <div className="screen-viewer-info">
          {streaming && <span className="live-badge">LIVE</span>}
          {streaming && <span className="frame-count">{actualFps} fps</span>}
          <button className="screen-btn close" onClick={() => { stopStream(); onClose(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={canvasRef}
        className={`screen-viewer-canvas ${fitMode ? "fit-mode" : ""}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {!frame && !streaming && (
          <div className="screen-placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p>Select a display and click View to start</p>
          </div>
        )}
        {!frame && streaming && (
          <div className="screen-placeholder">
            <div className="screen-loading">Connecting...</div>
          </div>
        )}
        {frame && (
          <div className="screen-image-wrapper" style={fitMode ? {} : { transform: `scale(${zoom})` }}>
            <img
              className="screen-image"
              src={`data:image/jpeg;base64,${frame}`}
              alt="Screen"
              draggable={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
