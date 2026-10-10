# Shared renderer option — proposal only

PR61 owns the test entry and `graphics-preview/world.js` lifecycle hooks. This
proposal does **not** alter that file or duplicate the Home integration.

An isolated scene profile at 390×844 / pixel ratio 0.85 used synchronous pixel
readback so queued GPU work could not be mistaken for completed rendering. On
this Chromium 145 / SwiftShader host, median render/readback cost was 152.6 ms
with the current multisampled default framebuffer and 75.0 ms without MSAA
(12 measured frames per case, after warmup). These are diagnostic measurements,
not physical-phone gameplay frame rates. Disabling reflections entirely also
reduced cost, but removes the metallic material style we want to preserve.

The minimum shared-file change for review is the renderer option:

```diff
-renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
+renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',alpha:false});
```

Before applying it, coordinate with the logic/PR61 workstream and compare edge
quality and actual frame times on Telegram Android/iOS at the existing adaptive
pixel ratios. It changes presentation only: it must retain `pause`, `dispose`,
the closed-during-loading guard, input, progression and every save schema. The
prototype's global camera/navigation integration proposals remain in
`docs/OPEN_WORLD_GRAPHICS_20261010.md`.

The current graphics stage instead optimizes only `scene.js`: small mascot
features use fewer invisible subdivisions, while the large head/helmet/body keep
their smooth meshes. All collision parameters, walking rules, preview state and
shared `world.js` remain unchanged. No approval or cross-chat agreement for the
renderer option is assumed.
