# MOONKATTY — Lunar Observatory

An independent, presentation-only playable 3D visual slice based on the approved lunar-station concept. It contains a new observatory dome, articulated telescope, glazed greenhouse wings, inlaid paths, faceted crystal gardens, lunar ridges and a dimensional tabby astronaut.

## Open locally

Serve this folder over HTTP, for example `python3 -m http.server 8000`, then open `http://localhost:8000/`. The scene and engine are self-contained; there is no runtime CDN or external API request.

- WASD or arrow keys: walk
- Drag: rotate the camera through 360 degrees
- Mouse wheel or two-finger pinch: zoom
- On phones, left joystick: walk, right-side drag: look
- Menu: pause and change render quality
- Crosshair button: reset location and camera
- Frame button / H: hide the interface; H or Escape restores it

This page never imports campaign/auth/reward/backend controllers and does not write progress. It is not integrated into the published game. Returning to an existing game is outside this slice.

## Rendering and provenance

- Three.js 0.170.0 is locally pinned, with the upstream MIT notice.
- All architecture, terrain, props, crystals, celestial spheres and the hero are genuine 3D meshes.
- The approved AI concept is an art-direction reference. It is not loaded as a background, skybox, or screenshot substitute.
- The Earth and regolith maps are existing original generated texture assets from the project's earlier graphics prototype. Earth is artistic, not a precise scientific globe.
- Hero fur, suit, eye and fabric material maps are authored procedurally. The hero has real ears, muzzle, eyes, visor, limbs, backpack and striped tail, including animated walking and idle motion.
- Physical material shading, prefiltered environment lighting, a warm key, cool fill and actual shadow maps supply the scene lighting.

## Verification

`node tests/render.cjs` (with Playwright installed) serves only this folder, renders desktop/portrait/landscape screenshots, checks walking/orbit/zoom/pause/touch input, and verifies isolated storage/network behavior.

A GitHub Actions runner is used because this assistant's current local environment cannot launch Chromium's required sockets. Its software-GPU output proves actual rendering and control behavior, not smooth physical Android/iOS Telegram performance. No phone FPS or final AI-concept fidelity is claimed.
