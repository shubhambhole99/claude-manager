# XtermPanel Scroll Bug — Root Cause & Fix

> **Fixed:** 2026-04-02

---

## The Bug

When using terminal mode (xterm.js), sending a prompt in Claude CLI and then switching focus to another window causes the terminal to **automatically scroll up**. The user expects the terminal to stay at the bottom following output.

---

## Root Cause

**`XtermPanel.jsx`** had scroll protection that only guarded against scroll-to-top jumps when the user had *manually scrolled up via mouse wheel*. It did not handle focus-loss scenarios.

When the browser window loses focus on Windows:

1. **`ResizeObserver` fires `fit.fit()`** — container dimensions can shift slightly (scrollbar visibility, DWM rendering changes), triggering xterm to recalculate terminal dimensions
2. **`fit.fit()` triggers xterm's internal `_innerRefresh`** — this resets `scrollTop` to match the internal `viewportY`, which can jump to 0
3. **`pty:output` continues arriving** — `term.write()` calls happen while the window is unfocused, and the browser may not properly sync the virtual scrollbar
4. **Existing scroll guard didn't activate** — the old code (`userScrolledUp && savedScrollTop > 500 && cur === 0`) only triggered when the user had scrolled up via wheel events, which doesn't happen during a focus switch

### Old code (broken)

```js
// Only tracked wheel events — missed focus-loss entirely
let userScrolledUp = false;
let savedScrollTop = 0;

vpEl.addEventListener('wheel', (e) => {
  if (e.deltaY < 0) {
    userScrolledUp = true;
  } else {
    if (vpEl.scrollTop >= vpEl.scrollHeight - vpEl.clientHeight - 5) {
      userScrolledUp = false;
    }
  }
});

vpEl.addEventListener('scroll', () => {
  const cur = vpEl.scrollTop;
  // This guard was too restrictive:
  // - Required userScrolledUp (only set by wheel)
  // - Required savedScrollTop > 500 (arbitrary threshold)
  if (userScrolledUp && savedScrollTop > 500 && cur === 0) {
    vpEl.scrollTop = savedScrollTop;
    return;
  }
  savedScrollTop = cur;
});
```

---

## The Fix

### 1. Position-based scroll tracking (replaces wheel-only tracking)

```js
let isAtBottom = true;
let savedScrollTop = 0;

vpEl.addEventListener('scroll', () => {
  const cur = vpEl.scrollTop;
  const gap = vpEl.scrollHeight - cur - vpEl.clientHeight;
  isAtBottom = gap < 10;

  // Guard: jump from non-zero to 0 while not at bottom = xterm viewport reset
  if (!isAtBottom && savedScrollTop > 50 && cur === 0) {
    vpEl.scrollTop = savedScrollTop;
    return;
  }
  savedScrollTop = cur;
}, { passive: true });
```

**Why it works:** Tracks `isAtBottom` from actual scroll position instead of relying on wheel events. Any unexpected jump to `scrollTop=0` from a non-zero position is caught and reverted.

### 2. Save/restore scroll on window blur/focus

```js
let savedAtBottom = true;

const onBlur = () => {
  savedScrollTop = vpEl.scrollTop;
  savedAtBottom = isAtBottom;
};

const onFocus = () => {
  try { fit.fit(); } catch {}
  requestAnimationFrame(() => {
    if (savedAtBottom) {
      term.scrollToBottom();
    } else {
      vpEl.scrollTop = savedScrollTop;
    }
  });
};

window.addEventListener('blur', onBlur);
window.addEventListener('focus', onFocus);
```

**Why it works:** Captures exact scroll state before the window loses focus. On regain, restores it — if the user was following output (at bottom), scrolls to bottom; otherwise restores the exact position. Uses `requestAnimationFrame` to run after xterm's own viewport sync.

### 3. Guard `fit.fit()` when document is hidden

```js
const observer = new ResizeObserver(() => {
  // ... size threshold check ...
  resizeTimeout = setTimeout(() => {
    if (document.hidden) return;  // <-- skip when hidden
    try { fit.fit(); } catch {}
  }, 100);
});
```

**Why it works:** `fit.fit()` recalculates terminal dimensions and triggers viewport refresh. When the document is hidden (tab switch, minimize), these recalculations serve no purpose and can cause scroll position resets. Skipping them prevents the root cause. The `onFocus` handler calls `fit.fit()` when the user returns.

### 4. Alt-screen buffer stripping (pre-existing)

```js
const ALT_SCREEN_RE = /\x1b\[\?(?:1049|47)[hl]/g;
const handleOutput = ({ conversationId: cid, data }) => {
  if (cid !== conversationId) return;
  term.write(typeof data === 'string' ? data.replace(ALT_SCREEN_RE, '') : data);
};
```

**Why it works:** Claude CLI tools (like editors, pagers) emit alternate screen buffer escape sequences that cause xterm's internal `viewportY` to reset to 0. Stripping these before they reach xterm prevents the viewport jump at the source.

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/XtermPanel.jsx` | Replaced scroll protection block (lines 44–91), updated ResizeObserver, added cleanup |

---

## How to Reproduce (before fix)

1. Open Christopher at `localhost:3000`
2. Open a terminal conversation (terminal-persistent mode)
3. Send a prompt to Claude CLI
4. While Claude is responding (streaming output), Alt-Tab to another window
5. **Expected:** Terminal stays at bottom following output
6. **Actual (before fix):** Terminal scrolls up to top or an old position

## How to Verify (after fix)

1. Same steps as above — terminal should stay at bottom
2. Manually scroll up in terminal, switch windows, come back — should stay at the scrolled-up position
3. Scroll back to bottom, switch windows, come back — should still be at bottom
