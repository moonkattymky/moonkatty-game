// Chapter 1 'База Альфа' (overhaul): every quest teaches one action (Astro Bot), with hidden caches + puzzles (BotW) and a
// base that starts growing via the first builder robot (Hay Day). Targets come from the world layout (passed in as `P`).
export const xpForLevel = (L) => 100 + 60 * (L - 1); // XP needed to go from level L to L+1

export function addXP(data, n) { data.xp += n; let ups = 0; while (data.xp >= xpForLevel(data.level)) { data.xp -= xpForLevel(data.level); data.level++; ups++; } return ups; }

// kinds:
//   power   60-second hook: the base reactor flickers out; mine 3 energy crystals right by the spawn (timing bar) -> the base lights back up
//   hop     beam to the canyon, cross the ground crack with a JET hop, reach the pad
//   mine    timing-bar mining of 3 ore crystals (hold, release in the green zone)
//   parts   find + carry 3 lost antenna parts (compass, glow when close; one sits in the meteor zone)
//   install hold-to-install the parts at the base dish
//   puzzle  reactor console pipe puzzle (tap tiles to rotate)
//   sprint  launch-complex boost run through rings, 1-3 stars by time
//   secret  first hidden cache (lookout ledge, needs the jetpack) - unlocks the secrets counter
//   build   back to the base pad: the builder robot builds the first base module
export function chapter1(P, fast) {
  return [
    { id: 'power', kind: 'power', icon: '⚡', need: 3, pts: 15, xp: 40, region: 'hub' },
    { id: 'canyon', kind: 'hop', icon: '🛬', target: P.canyonPad, r: 7, crack: 0, pts: 20, xp: 40, region: 'canyon' },
    { id: 'crystals', kind: 'mine', icon: '⛏️', need: 3, pts: 25, xp: 50, region: 'canyon' },
    { id: 'parts', kind: 'parts', icon: '🧭', need: 3, pts: 30, xp: 60, region: 'canyon' },
    { id: 'dish', kind: 'install', icon: '📡', target: P.dish, r: 4.5, hold: fast ? 0.35 : 1.6, pts: 30, xp: 60, region: 'hub' },
    { id: 'reactor', kind: 'puzzle', icon: '⚡', target: P.reactorConsole, r: 4, pts: 35, xp: 70, region: 'hub' },
    { id: 'launch', kind: 'sprint', icon: '🏁', target: P.sprintStart, r: 4.5, pts: 30, xp: 70, region: 'launch', starPts: 5, times: fast ? [999, 999] : [40, 55] },
    { id: 'secret', kind: 'secret', icon: '🗝️', cache: 'ledge', pts: 30, xp: 60, region: 'hub' },
    { id: 'home', kind: 'build', icon: '🤖', target: P.homePad, r: 4.5, pts: 50, xp: 120, buildTime: fast ? 2.5 : 120, region: 'hub' },
  ];
}
