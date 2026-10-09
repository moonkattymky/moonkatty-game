# Chapter 1 entrance geometry

## Change

Chapter 1 caches the field dimensions and obstacle rectangles for movement.
The entrance animation scales the entire screen from 0.99 to 1. A CSS transform
does not resize the layout box, so `ResizeObserver` alone can leave the cache at
an intermediate animation size after the screen is fully visible.

The controller now refreshes its existing cache on the Chapter 1 screen's own
`screenEnter` animation end or cancellation, provided that screen is still
active. Child animations, other animation names and inactive screens are ignored.
The existing entry and resize paths remain in place, including reduced-motion
entry with no animation. There is no new timer or per-frame geometry scan.

This fixes persistent stale geometry after the entrance transition. It does not
change movement rules or promise exact geometry throughout the animation.
The existing walkable-position repair still runs when a refreshed obstacle
rectangle covers the player's position.

## Scope and release

The only runtime changes are `app.js` and its versioned `index.html` script URL.
There are no CSS, art, reward, checkpoint-format, database or backend changes.
The unused Chapter 1 verification prototype is not included or activated.

Review the exact-head Actions result for browser and aggregate test status.
Browser tests use the desktop Chromium supplied by Playwright, not physical
Telegram devices. Combine this patch with any independently approved visual
changes and rerun those checks before release. Publishing this draft does not
merge or deploy it.
