# MOONKATTY v2 authored hero

This is an independently authored three-dimensional Blender model. The existing `hero.js` stays unchanged. No AI character plate is used.

## Runtime

Import `createHeroV2` from `hero-v2.js` and await it. It returns `{root, update(time, walking), triangleCount, rigs}`. World is Y-up, frontal direction is +Z. The authored body is in a three-quarter passing stride, with the head turned toward the viewer. Height is approximately 3.62 units. A slightly larger scene scale may be appropriate compared with the original 3.83-unit hero.

Required runtime assets: `art/hero-v2/hero.json`, `hero.bin.gz`, and `iris.png`. The head-only proof uses `head.json` and `head.bin.gz` instead. Geometry is indexed and batched by material and articulated part. Positions are int16, normals int8, colors uint8, UVs uint16, and indices uint16 or uint32. The browser uses DecompressionStream to unpack the gzip payload.

## Rebuild

1. Run Blender in background mode with `build_hero.py`. It builds the unified head sculpt, authors the suit and pose, saves actual Blender renders and source `.blend` files, and writes an intermediate mesh export under `/tmp`.
2. Run `python pack_head.py hero` and `python pack_head.py head` to make runtime assets. Intermediate floating-point JSON is not a shipping asset.
3. Run `node validate_model.mjs` for geometry, index, bounds, loading and animation-transform checks.

The Blender build used here has no OpenImageDenoise support, so denoising is intentionally disabled. Studio proof images use CPU Cycles and are actual model renders. Runtime WebGL materials reproduce the geometry and main PBR surfaces, but the studio lighting is not a claim of in-scene browser appearance. Inspect the integrated renderer before making that claim.

## Honest scope

This replaces primitive facial parts with a joined sculpt and carved orbital/mouth recesses; uses almond eye surfaces with authored iris UVs, explicit fur ribbons, real ear thickness, continuous folded garments, curved boot envelopes and a posed 3D rig. It is a stylized realtime model, not a production film character groom. Animation is procedural limb motion around authored pivots, not a skinned mocap-quality gait. Further polish should be judged from actual model renders.
