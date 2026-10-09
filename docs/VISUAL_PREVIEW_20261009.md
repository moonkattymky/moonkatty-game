# MOONKATTY: first-light visual preview

Status: draft PR45, not deployed. Initial CI produced 72 genuine screenshots with no harness failures. Visual review found the optional home teaser pushed the bottom navigation below the typical phone viewport; the revised stylesheet hides that teaser below 900px height and tightens spacing. Independent screenshot review also caught short-portrait Arabic telemetry touching the sticky footer. Compact header/HUD spacing and a dedicated overlap assertion address that without shrinking the enlarged cells. Updated exact-head screenshots and full regression must pass before review is complete.

## Comparison base

Stable PR42 commit: ec87cf46df4d41f39e0ae7b6a011cbc8eb8442a1.
Verified tree: 1ae512eda51828c260afc50f46d5091dc757d916.
The local baseline uses synthetic commit e8a2946 with that identical tree. Do not publish synthetic local ancestry. Apply the patch to the current reviewed remote candidate.

## What changes

- Home: a content-sized action deck and an intrinsic-size art row keep translated labels from covering the astronaut. The original cat and lunar artwork remain untouched.
- Warm gold primary action, clearer cool-blue secondary panels, softer 13–17px corners, more breathing room, and improved text contrast.
- Vector arrow icons and a CSS pause symbol replace decorative glyphs that were missing in some browser screenshots.
- Chapter briefing: stronger title/next-objective hierarchy and a more readable, cohesive stage list.
- Rover: clearer telemetry and controls, more distinct selected/recovery/exit cells, and a high-contrast EXIT label. Tile coordinates, rules, state, checkpoints, progression and rewards are unchanged.
- No new image files, paid assets, third-party libraries, font requests or repeating animation. The stylesheet is about 14.8 KB raw / 4.3 KB gzip.

## Changed files

Application:
- index.html: add one versioned visual-preview.css link after visual-system.css and before the existing touch floor.
- visual-preview.css: scoped presentation layer.
- field-art.js: cosmetic class hooks only.

Verification:
- tests/visual-preview-source.cjs
- tools/render-visual-preview.cjs
- .github/workflows/visual-preview.yml
- this document

## Verified locally

- Seven non-browser suites pass: visual-preview-source, i18n-coverage, story-next-client, mission-rules, story-plan, field-rules and no-conflict-markers.
- Source invariant test generates 88 SVG scenes and 9 chapter maps without state mutation.
- An independent comparison of 440 scene fixtures is byte-identical to PR42 after removing cosmetic class hooks.
- Fourteen declared opaque text/background pairs are at least 4.99:1. This is a source-color calculation, not a claim about every composited pixel or image background.
- Existing translations are unchanged: English plus all 12 locale packs are retained, including Arabic and Hebrew RTL.
- JavaScript syntax, workflow YAML parsing and git diff whitespace checks pass.

## Not verified yet

Local Chromium launch was previously blocked. The supported cloud browser rejects file URLs and could not connect to this checkout's loopback HTTP preview. The approved CI run subsequently produced 72 real screenshots. No mockup is being presented as a rendered result; revised captures are pending the final spacing check.

The CI workflow is read-only with respect to repository contents, bounded to 12 minutes, and has no deploy job. It serves only local fixtures, blocks external traffic and uses no real account. It is designed to capture 72 actual screenshots: before/after × Russian/English/Arabic × 390×844, 320×568, 568×320 × home, Chapter 1 plan, rover and power board. It also checks home/plan layout in all 13 languages at 320px. It verifies art decoding, portrait astronaut overlap/proportions, text/control horizontal bounds and HTML control sizes. The resulting HTML comparison index and JSON report are saved with the screenshots for 7 days.

The existing short-landscape rover scale can produce SVG cell targets below 44px. This preview increases short-portrait cells to support 44px, preserves the landscape layout, and explicitly records landscape target sizes rather than claiming a universal touch-size pass. Physical Telegram iPhone/Android testing remains necessary.

## Integrating after approval

Apply the patch on top of the latest reviewed remote candidate, preserving PR43's index.html codec script and storage/rewards/cloud cache versions. Only the new stylesheet link is required in index.html; never replace the whole file with this baseline copy. Do not merge or deploy until the actual screenshot artifact and normal regression CI have been reviewed.

Run screenshots in a permitted browser environment:

    node tools/render-visual-preview.cjs --before=/absolute/path/to/stable-PR42 --out=/absolute/path/to/review-artifacts

For a concise user review, choose the Russian 390×844 home and rover before/after pairs from the full artifact. The remaining screenshots are supporting coverage, not 72 separate chat attachments.

## Rollback

Remove the visual-preview.css link. The cosmetic class hooks are inert without the new stylesheet. No data migration or save-format rollback is involved.
