#!/usr/bin/env bash
# Builds the Telegram Mini App bundle of the 3D world: world3d/app.min.js (+ stamps index.html, sw.js).
# usage: bash tools/world3d/build.sh      (needs node; fetches esbuild 0.24.2 via npx if not installed)
set -euo pipefail
cd "$(dirname "$0")/../.."
W=world3d
ESBUILD=${ESBUILD:-"npx --yes esbuild@0.24.2"}
$ESBUILD $W/src/main.js --bundle --format=esm --minify --target=es2020 --legal-comments=none \
  --alias:three=./$W/vendor/three/build/three.module.js --outfile=$W/app.min.js --log-level=warning
BUILD=$(sha256sum $W/app.min.js $W/boot.js $W/assets/moonkatty.glb | sha256sum | cut -c1-10)
sed -i -E "s/(boot\.js|app\.min\.js)\?v=[A-Za-z0-9_]+/\1?v=$BUILD/g" $W/index.html
sed -i -E "s/^const VERSION = '[^']*';/const VERSION = '$BUILD';/" $W/sw.js
echo "built $W/app.min.js ($(stat -c %s $W/app.min.js) bytes, gzip $(gzip -9c $W/app.min.js | wc -c)) version $BUILD"
