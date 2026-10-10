# Campaign visual assets

Created with the built-in ImageGen tool for MOONKATTY, 3 October 2026. Raster originals were converted to WebP for the static game. Character and prop atlases retain transparency.

- `life1-base.webp`: lunar base exploration environment.
- `life2-crew.webp`: three specialists; the existing MOONKATTY character was the visual reference.
- `life3-command.webp`: launch-code command bridge.
- `life4-landing.webp`: landing canyon, also used by the navigator challenge.
- `moonkatty-walk.webp`: 6 columns × 4 rows. Rows are down, up, left, right. Frames advance with distance traveled, freeze when blocked, and return to the first frame when idle.
- `lunar-props.webp`: 3 columns × 1 row, two rocks and a supply crate.

## Generation prompts

### base

Use case: stylized-concept. Asset: production mobile game background for MOONKATTY Life 1 exploration. Create a beautiful bright premium cinematic 3D lunar base environment, vertical 3:4 composition, not a UI mockup. A wide navigable silver lunar courtyard seen at a moderately elevated three-quarter game camera. White ceramic futuristic buildings with gold metal trims and amber windows only around the TOP and far side edges, a small vivid blue Earth above the horizon at upper right. Lower 75 percent is spacious lunar ground and subtle floor pathways, readable silver stone texture, no large obstacles there. Warm sunrise from upper left and soft cool blue fill, bright detailed shadows. Clear appealing space adventure mood matching a cute high quality cat astronaut universe. Sharp realistic materials, beautifully lit. No characters, no spacecraft, no collectibles, no crystals, no terminals, no antenna, no text, no logos, no UI, no black vignette, no blur. This empty environment will have interactive objects placed by game code.

### crew

Use case: stylized-concept. Asset: cinematic hero art for the MOONKATTY game crew selection. Reference image defines the cute expressive tabby cat, premium white ceramic / gold trim astronaut suit and realistic 3D fur. Create one cohesive scene with THREE distinct full-body cat astronaut specialists standing side by side in a bright elegant lunar spacecraft hangar: left navigator tabby with a small cyan holographic map, center engineer orange tabby holding a compact tool, right scout silver tabby with small explorer backpack. Preserve brand design and charm from the reference without duplicating identical poses. The three characters occupy left center right thirds, facing viewer, visible ears and boots. Luminous white gold architecture, soft blue planet visible behind, sunrise highlights. Wide 4:3 composition, cats fit inside central 85 percent, polished cinematic detailed 3D render with excellent material textures. No text, no UI, no button, no watermark. This is scene art, not a poster or a collage.

### command

Use case: stylized-concept. Asset: background hero scene for MOONKATTY Life 3 launch code game. A beautiful bright cinematic futuristic command bridge of a white ceramic and gold lunar spacecraft, centered panoramic window showing a luminous blue planet and distant lunar terrain. Two elegant sleek physical consoles frame the lower sides, empty center with one subtle circular cyan hologram platform. Warm sunrise highlights, white gold metal and vivid teal console illumination, premium sharply detailed realistic 3D game render. Inviting space exploration adventure aesthetic suitable for cute cat astronauts but NO characters. Wide 4:3 composition. No readable text, no symbols to solve, no UI overlays, no borders, no watermarks, no dark vignette, no blurry panels. Actual puzzle controls will be placed by the application below this scene.

### landing

Use case: stylized-concept. Asset: production mobile game landing environment for MOONKATTY Life 4, vertical 3:4. Bright breathtaking futuristic lunar canyon landing site, premium cinematic 3D render, sharp detailed silver moon rocks, warm gold sunrise illumination on left cliff, teal blue reflected light on right. White ceramic and gold science base nestled high on the right canyon wall, a vivid blue Earth in starry deep cobalt sky. IMPORTANT composition for gameplay: middle 50 percent of width must be clear open sky and empty canyon air all the way down to a broad flat silver landing courtyard in the lowest 20 percent. Absolutely no bridges crossing the center, no floating rocks in center, no spacecraft, no characters, no baked landing circles or pads. Keep foreground edges uncluttered, readable bright ground at bottom, horizon above half height. Environment only, no text, no logos, no HUD or interface. Strong sense of depth, professional high-end space adventure, not dark.

### Walk atlas

24 full-body poses of the existing tabby MOONKATTY in a white/gold astronaut suit. Exactly six columns and four rows; front-facing walk, back-facing walk, left profile walk and right profile walk. Fixed character scale and root position, alternate steps and arm swing, transparent background. No waving pose, labels or interface.

### Props

Three equal square cells in one row: two different irregular silver lunar boulders and a white/gold supply crate. Consistent warm upper-left and cool blue fill lighting, transparent background, no labels or interface.

## Crew deck, 3 October 2026

`life2-bridge-v2.webp` is the approved crew-interior concept prepared with the built-in image generation tool and converted to WebP (quality 88). Its source is the generated preview `exec-51901225-98e6-4dba-8419-ca8e8f3ba2ec.png`.

Prompt: preserve the approved ship-interior composition, the three astronaut cats at the navigation, engineering and scouting stations, warm gold/ivory materials and the Earth view; remove all baked-in headings, role labels, counters and bottom HUD, reconstructing the scene below them. No text or interface in the artwork. Role labels, recruitment status, controls and lighting accents are rendered separately by the game.


## Campaign polish, 3 October 2026

Three further production assets were made with the built-in ImageGen tool and converted to WebP (quality 88). The originals are retained in the generation history. Gameplay controls and statuses are rendered by HTML rather than baked into the artwork.

- `life3-bridge-v2.webp`: ivory/gold command bridge with the cat captain and the existing cat-eared ship outside the window; a clear lower console for the four interactive launch stages. References: approved crew bridge and `moonkatty-life4-ship.png`.
- `life5-reactor-v2.webp`: front-facing white/gold reactor chamber, precise concentric circular machinery and cyan plasma. Core centered within the central 60% for mobile cropping; no labels or interface.
- `orbit-v2.webp`: open sapphire orbital playfield, detailed silver moon in the upper-right corner, sparse stars and pale blue/gold nebular edges. Central 70% kept clear of ships, debris and gates; interactive objects are separate sprites.

The new backgrounds use `cover` without nonuniform scaling. The original ship and antenna use `contain`; each rock/crate sprite-atlas cell has a square element. Chapter 1 collision bounds follow the rendered props. Chapter 7 asteroids use the same square atlas cells and their own motion/collision layer.


### LIFE #5 reactor integration

`life5-reactor-v2.webp` is reused at its original 1448 × 1086 proportions in an SVG with `preserveAspectRatio="xMidYMid meet"`. Core lighting, rotating rings and the charge arc share the source image coordinate system. No nonuniform transform is applied to the scene. A separate blurred background fills unused margins. The control panel is outside the artwork and changes with the three gameplay stages.

### LIFE 5 cinematic effects — 4 October 2026

The original reactor artwork is retained. `reactor5-fx.js` overlays a transparent canvas using the SVG camera coordinates (144, 0, 1160, 1086), with a tighter vertical crop (144, 130, 1160, 780) for short, wide galleries. The image and procedural effects always use the same uniform scale. Cached glow textures, capped pixel density (1.75), bounded particles and adaptive detail keep the light rig lightweight. All particle motion shares the gameplay animation loop and freezes on pause; reduced-motion preferences suppress decorative motion.


## LIFE 6 launch pad — 4 October 2026

`life6-launchpad.webp` was created with the built-in ImageGen tool and encoded as WebP (quality 88). Source: `exec-10a18d55-295d-40a2-86a8-5b13143e1275.png`. The unchanged `moonkatty-life4-ship.png` preserves spacecraft continuity. Canvas exhaust, dust, corridor markers and beacons are separate from the image.

Prompt: Production background for MOONKATTY chapter 6 LIFTOFF, portrait 3:4. Premium cinematic 3D lunar launch environment: luminous silver terrain, white ceramic and gold science base at the far edges, blue Earth at upper right, warm sun at upper left, sapphire space. Upper 70% and central 65% clear for flight. Empty circular ivory launch pad at bottom centre, amber lights, titanium rails, detailed lunar dust. Brilliant readable lighting, crisp material microdetail, coherent perspective. No spacecraft, characters, exhaust, text, labels, HUD or watermarks.

### LIFE 6 flight presentation — 4 October 2026

`liftoff6-fx.js` keeps the existing launch-pad, orbit and ship artwork. Ship position and bank update with each animation frame using a compositor transform; bounded engine plumes, maneuvering jets, route chevrons, exact-width beacon gates and the lunar horizon render separately at up to 30 Hz. The lunar surface and glow textures are cached. Particle detail adapts to render cost; reduced effects suppress decorative particles and banking. Pausing freezes both the simulation and scene. The flight renderer stops after completion.

The visible route follows the same ±14% corridor as flight validation. Three milestone markers show confirmed checkpoints. Thrust buttons support a single tap and held adjustment, with release on pause or lost pointer capture. Flight summaries preserve time, hull and fuel for completed-session review. Existing version-1 checkpoints remain supported; older in-flight saves without time tracking display an unavailable duration rather than an invented total.


### LIFE 6 ceramic cockpit and orbital panorama — 4 October 2026

`life6-orbit-v2.webp` was created with the built-in ImageGen tool, then converted to WebP (quality 87). Source: `exec-9a4e9a1a-b625-4528-aa38-eb44c96360fc.png`, recomposed from `exec-71e2480d-bd9f-4185-82aa-38f05b0905b2.png`. The ship remains the existing branded sprite. The generated horizon replaces the previous cached procedural moon in chapter 6; other chapters retain their shared orbital artwork.

Prompt: Premium mobile space-exploration environment, stylized-concept, cinematic realistic science fiction, square 1:1. Curved lunar horizon in the lower quarter, richly detailed silver craters, fine shadows and warm copper sunrise. White-gold sunlight from upper left, small detailed blue Earth in upper right, deep indigo/cobalt space and restrained teal nebula. Central 60% is dark, clear open space for the separately rendered spacecraft, flight gates and UI. Crisp tactile details and restrained bloom. Background only: no spacecraft, people, interface, text, logos or watermarks.

The ceramic control deck uses original inline vector icons. Preflight diagnostic nodes connect to the spacecraft and reflect the actual armed, next and fault states. Compact scenes hide decorative nodes while preserving the same labeled controls. Ignition steps reflect the live safe-thrust range and completed hold. Presentation changes retain version-1 saves, physics, retry checkpoints and rewards.

Composition refinement: recompose the first portrait into a square without stretching planets or craters. Keep both Earth and lunar horizon visible in the near-square game scene, put Earth in the upper-right quadrant, leave the central play area and top instrument strip clear. Preserve the reference color grade, lighting and fine texture.

## LIFE 7 asteroid belt — 4 October 2026

`life7-void.webp` was generated with the built-in ImageGen tool and converted to WebP (quality 87). Original: `exec-29f68e3d-39bb-48df-9033-bf96e48d7407.png`. The original branded `moonkatty-life4-ship.png` and the first two square rock cells of `lunar-props.webp` remain unchanged. The panorama uses uniform `cover` scaling; ship artwork retains its 520:343 ratio. Interactive rocks, lane warnings, shield, route markers and the signal gate are drawn separately.

Prompt: Create a premium mobile space game environment background, square 1:1, cinematic stylized-concept art with fine physically plausible painted detail, high production quality. This is the background for MOONKATTY chapter 7 THE VOID, a top-down vertical spacecraft flight through an asteroid belt. A luminous deep cobalt and petrol blue nebula with subtle warm champagne-gold light at the top, tiny dense stars, distant atmospheric dust. A small spectacular fragmented moon at the upper right edge, thin rings of scattered tiny asteroids curving along the LEFT and RIGHT outer edges with mineral textures and rim lighting. The CENTER 65% and lower center must be unobstructed calm rich blue negative space for three gameplay lanes and a ship rendered separately. Composition feels vast, graceful, mysterious and beautiful, not muddy or pitch black. Soft volumetric light from above, teal dust wisps near edges, layered depth. No spaceship, no characters, no foreground giant rocks, no text, no logos, no interface, no lane lines, no borders. High clarity, clean legible game background, sophisticated color grading. Keep centre visually quiet.

`void7-fx.js` shares geometry and simulation time with the collision model. It uses compositor transforms for moving objects, a bounded 38-mote star field, two procedural engine plumes and capped 1.75 pixel density. Decorative drawing is limited to 30 Hz. Reduced effects suppress motes, rotating rocks, banking and impact rings while retaining essential hazards and warnings. Paused flight does not advance either motion or collision checks; leaving a chapter cancels its frame loop.

### LIFE 7 optical polish — 4 October 2026

`life7-asteroid-v2.webp` was created with the built-in ImageGen tool as a transparent sprite, then downsampled to 384 × 384 and converted to WebP (quality 90) with alpha preserved. Original: `exec-0a57761a-7565-4b1b-b2d4-a729d41460fb.png`. The new large-asteroid material replaces only chapter 7's large boulder; the existing small-rock atlas and branded spacecraft remain. A few subdued decorative rocks stay at the extreme scene edges outside the playable lanes.

Prompt: Use case: stylized-concept. Asset: one production asteroid sprite for the bright cinematic MOONKATTY mobile space game. A single irregular rounded asteroid viewed from above at a slight three-quarter angle, floating isolated on a genuinely transparent background. Square 1:1 composition, asteroid centered exactly, occupying about 74 percent of image width and height with transparent margin all around. Strong readable silhouette, angular fractured edges, several crisp deep craters, silver basalt with small champagne metallic mineral seams, detailed chips and fractured layers. Premium realistic stylized 3D game render, warm soft gold key light from upper left and subtle cyan-blue rim light on lower right. Bright midtone material, convincing dimensionality, sharp surface relief that remains readable at 48 pixels. Slight asymmetry, no spiky silhouette, no crystals sticking out. ONE asteroid only. No background, no star field, no floor, no cast shadow outside the rock, no particle cloud, no text, no UI, no frame. Clean antialiased transparent edges.

The existing panorama now has a subtle uniformly scaled camera drift and steering parallax. Sector lighting, cached engine glows, maneuvering jets, a procedural shield mesh, impact fragments and a beveled signal gate use the same simulation time as flight. Decorative detail drops when painting exceeds its budget; reduced effects retain essential lane warnings, hazards and shield visibility. Hazard warnings and the tactical strip share the collision geometry and remain active until the object has actually passed the hull.


## Spatial campaign redesign — 4 October 2026

Five assets were produced with the built-in ImageGen tool, then encoded to WebP without distortion. The original ship sprite remains unchanged. Raster images supply material detail; SVG hit targets and mission state remain separate.

- `world-surface.webp`: near-overhead lunar facility, realistic pale regolith, ivory ceramic and titanium equipment on the outer edges, restrained gold lighting, broad clear central area, no UI or text. Original `exec-6e569200-62fb-4d3a-bdec-4a5a5b727505.png`; quality 86.
- `world-orbital.webp`: near-overhead orbital shipyard framing a clear blue nebula center, detailed machinery, realistic metal and ceramic, clear navigation space, no ship or UI. Original `exec-86d063ae-c549-481b-8e64-ffb022b8680a.png`; quality 86.
- `world-rover.webp`: single realistic six-wheel lunar rover isolated on transparent background, compact legible top-down silhouette, detailed ivory chassis and wheels, no floor/UI. Original `exec-2735893e-9c13-4a3b-829d-d82816dc2eac.png`; quality 88, alpha retained.
- `crew-bridge-v3.webp`: edit of `life2-bridge-v2.webp`, preserving all three character placements and bridge composition. Adult cats, natural proportions and smaller eyes, serious suits, realistic bright materials, no added UI. Original `exec-9bdb5331-bd5f-47a2-8990-13e9a8fc0c76.png`; quality 86.
- `launch-bridge-v3.webp`: edit of `life3-bridge-v2.webp`. Preserve exact portrait composition, cat upper left, branded white cat-eared ship upper right, planet, and broad empty lower deck. Replace kitten look with mature adult tabby, natural eyes, closed mouth and calm expression. Ivory ceramic, brushed titanium, restrained gold, precise seams, fine wear, bright cinematic lighting; no text or new objects. Original `exec-c558f9e0-f5ee-499b-8e63-37f45ef43e2d.png`; quality 86.

These files are game assets; they are not screenshots of a tested interface. Gameplay previews in the redesign audit are actual browser captures.


## Station props and spatial detail — 5 October 2026

`station-details-v2.webp` was generated with the built-in ImageGen tool and encoded at WebP quality 88 with alpha preserved. Original: `exec-285570d2-3332-401a-90db-839dd616fa2e.png`, 1254 × 1254, four 627 × 627 atlas cells. Clockwise from top left: habitat/power module, relay dish, docking ring, scientific cargo unit. SVG patterns crop each cell at its native proportions; bounded rectangles keep artwork from changing hit-target bounds. The atlas is shared by chapter maps, crew stations, collectibles, docking structures and convoy waypoints.

Prompt: Create a 2 × 2 transparent atlas of four separate production space-game objects: an ivory/titanium habitat power module, a precision relay dish, a scientific cargo power container and a mechanical docking ring. Mature cinematic industrial realism, consistent near-overhead three-quarter orthographic view, warm upper-left lighting, cool reflected fill. Brushed metal, ceramic panels, gold foil, fine seams, bolts, pipes and restrained wear. Full silhouettes, matching scale and transparent margins. No text, UI, outlines, toy proportions or background.


## Language-screen hero — 7 October 2026

- `moonkatty-hero.webp` / `moonkatty-bust.webp`: cropped from root `moonkatty.png` (bust used on crew cards; hero currently unused — language intro uses the original emoji helmet).

## Chapter 1 structural worksite draft — 9 October 2026

Two purpose-built assets replace the mismatched photograph/sticker combination in the chapter 1 field only. The 36 hit rectangles, rules, target locations, hazards, scanner, saves and rewards remain unchanged. Other chapters retain their existing artwork pending review of this first scene.

- `lunar-worksite-atlas-v1.webp`: 1254 × 1254 RGBA, 528,906 bytes. Sixteen original premium 3D worksite objects: eight different industrial obstacles, three distinct gold data instruments, an extraction pad, tabby astronaut rover, fissure, rocks and crater. The latter two are reserved and not placed as misleading obstacles. One atlas image definition is reused through SVG references. Explicit inspected source rectangles and clip paths prevent neighboring sprites leaking into letterboxed viewports.
- `lunar-worksite-ground-v1.webp`: 900 × 900 RGB, 277,330 bytes. Empty lunar terrain with warm upper-left sunlight and cool ambient fill. The game places every gameplay object separately; no objective or control is baked into the plate.

Created with the built-in image generation tool. Existing `moonkatty-hero.webp` was the identity reference for the tabby driver. The atlas was generated, inspected, then revised for clearer spacing; its packing is still deliberately represented by explicit rectangles rather than assumed equal cells. Original generated PNGs were converted to WebP; alpha is preserved. No external asset host, paid dependency or additional runtime package was introduced.

Production prompt: create a transparent 4 × 4 production sprite sheet of sixteen isolated detailed 3D lunar worksite objects, with a consistent elevated orthographic camera, off-white ceramic and champagne-gold metal, restrained blue glass, functional machinery detail, warm upper-left key and cool fill. Preserve the recognizable tabby astronaut identity from the reference, with no token symbols, lettering, interface or background cards. Requested objects in row order: habitat, solar collector, paired tanks, cooling fans; dish, greenhouse, battery, drill; terminal, sensor dish, sample cylinder, docking pad; cat-piloted rover, fissure, rocks, crater.

Revision prompt: preserve those sixteen designs and materials, but fit complete objects inside their own atlas cells with transparent padding, especially the rover. Keep the same order, camera and lighting. No guides, borders, labels or UI.

Ground prompt: an empty square production lunar ground plate under a fixed elevated orthographic camera, luminous silver regolith and restrained champagne/blue lighting, detailed but calm central play area, shallow rock erosion mainly near the edges. No horizon, sky, buildings, equipment, characters, grids, paths, pads, marks, controls or collectible positions.

Performance budgets enforced by `tests/lunar-worksite.cjs`: under 850 KB combined image transfer, two shared image resources, under 650 SVG nodes, under 48 KB generated SVG per redraw, under 15 KB gzip for the complete shared field renderer, no full-frame filters or decorative animation, deterministic non-mutating rendering. CI source-generation timing is not a physical-phone or Telegram performance certification.

## Lunar expedition concept implementation — 10 October 2026

- `lunar-ground-v1.webp`: 1024×1024, 382276 bytes. Generated ground plate derived from the reviewed white/gold lunar concept; all obstacles/objectives are placed by the existing renderer, with no baked mission markers.
- `moonkatty-walk-v1.webp`: 1024×341 RGBA, 96802 bytes. Four tabby astronaut poses generated using the original `moonkatty-hero.webp` identity reference. Four frames are selected by an SVG viewport and short CSS animation only when the displayed position changes.

Generated with imagegen, converted/resized to WebP for mobile. Ground prompt: near overhead lunar regolith, warm station edge light and cold ambient fill, open center, no interface/character/objectives. Walk prompt: one row of four full-body transparent walking poses, same tabby astronaut, white/gold suit and helmet, consistent size/light, side-facing movement. These are first-prototype assets, not photorealistic 3D geometry.
