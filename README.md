# MOONKATTY: 9 LIVES 🌙🚀

Telegram Mini App starter for the MOONKATTY universe.

## Current build
- Telegram WebApp SDK integration
- 10-language selector with saved preference
- RTL support for Hebrew
- Mission Control home screen
- LIFE #1 starter mission
- Moon Points demo UI

## LIFE #5 — Reactor engineering

The reactor chapter uses three sequential stages: charge three cells while controlling heat, keep temperature at 45–68°C and magnetic field at 45–55% for three seconds, then time three ignition pulses. Fully charged cells survive thermal shutdown; accepted pulses survive a miss. The guide, window blur and app backgrounding pause the simulation and release held controls. Charging routes automatically to the next unfinished cell. A versioned local checkpoint restores unfinished cells, calibration and accepted pulses after closing the app, behind an explicit resume button.

`reactor5.js` runs a display-synchronized animation loop with bounded time steps and 10 Hz accessible readouts. `reactor5-fx.js` draws the core plasma, energy feeds, coolant and one-shot pressure waves with cached textures, capped pixel density and adaptive particle detail. Both stop while paused or outside the chapter; `reactor5.css` scopes its portrait/landscape layouts. `i18n.js` supplies Russian UI text. Artwork and energy rings share an SVG coordinate system with uniform scaling. Reduced motion disables decorative rotation, particles and pressure waves while preserving the timing challenge. The console reserves its maximum phase height to keep the camera steady when switching stages. Short viewports use a uniformly scaled close view of the core. Chapter completion retains the existing one-time 1,250-point reward and unlocks LIFE #6.

## Important
Moon Points are in-game/reputation points only. They have no monetary value and do not guarantee a future token allocation.

Production rewards, social verification, persistence, wallet ownership verification and claim logic require a secure backend and must not rely on client-side state.
