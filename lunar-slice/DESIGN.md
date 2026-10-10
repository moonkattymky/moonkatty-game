# Lunar station visual slice

Base repository commit: 00e391ffe0bb2ed663a7e3136cf382b0030857b4.
Approved reference: MOONKATTY-lunar-station-AI-concept.png; Library identity libfile_dc987472356c8191827eabc1933a6a18. Actual pixels inspected 2026-10-10.

## Art direction
A focal white ceramic and brushed-gold observatory dome on a circular layered foundation. Dark glass ribs expose a telescope and warm practical light. Rounded connecting greenhouses, a broad landing stair and inlaid curved pedestrian paths create depth rather than scattered primitive props. Dense cyan crystal clusters break up the warm/cool palette. Lunar ridges are actual lit mesh terrain. Earth is a textured sphere. A detailed, animated tabby astronaut in a white/gold suit is the playable hero.

## Rendering plan
Locally pinned Three.js r170. PBR white ceramic, gold metal, rough regolith, glass and emissive trim. A warm directional key plus cool sky fill, real shadows for the main geometry, distance fade and a controlled filmic exposure. Procedural meshes with beveled edges and surface maps. Real geometry permits walking and 360-degree camera movement; the concept is never used as a gameplay backdrop.

## Scope and checks
Independent visual-only entry. No campaign, rewards, saves, auth or backend imports. No production deploy or merge. Keyboard/touch walking, collision boundaries, free orbit and mobile-adaptive render scale. Deliver a genuine browser-rendered frame and playable local slice; disclose desktop/software-GPU measurements separately from unmeasured physical Telegram performance.
