#!/usr/bin/env bash
# v80: robust live gate runner. usage: tools/world3d/live_gate.sh <test.mjs> <log>
# waits for box 1-min load < 3 (max 30 min), runs the test, retries ONCE on failure (after re-waiting for load).
T="$1"; L="$2"; export MK_BASE=${MK_BASE:-https://moonkattymky.github.io/moonkatty-game/world3d/index.html}; export NODE_PATH=${NODE_PATH:-/workspace/port-tools/node_modules}
waitload() { for i in $(seq 1 180); do l=$(cut -d' ' -f1 /proc/loadavg); awk -v l="$l" 'BEGIN{exit !(l<3)}' && { echo "load $l ok"; return 0; }; sleep 10; done; echo "load still high $l"; }
for a in 1 2; do waitload; timeout 900 node "$T" > "$L.$a" 2>&1; rc=$?; echo "attempt $a rc=$rc $(grep SUMMARY "$L.$a")"; [ $rc = 0 ] && { cp "$L.$a" "$L"; echo GATE PASS; exit 0; }; done
cp "$L.2" "$L"; echo GATE FAIL; exit 1
