# Chapter 1–4 visual assets

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
