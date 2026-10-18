#!/usr/bin/env bash
# Bundles server/rewards into one ESM file for deploy tools that limit the number of uploaded files
# (the Supabase MCP deploy accepts few files per call). Deploy: rewards/index.ts = `import './rewards.bundle.mjs';`
# plus rewards/rewards.bundle.mjs, verify_jwt=false. The Supabase CLI can deploy server/rewards directly instead.
set -euo pipefail
cd "$(dirname "$0")/../../server"
OUT=${1:-/tmp/rewards-bundle}; mkdir -p "$OUT"
${ESBUILD:-npx --yes esbuild@0.24.2} rewards/index.ts --bundle --format=esm --platform=neutral --target=es2022 --outfile="$OUT/rewards.bundle.mjs" --log-level=warning
printf "import './rewards.bundle.mjs';\n" > "$OUT/index.ts"; echo "bundle: $OUT/rewards.bundle.mjs ($(stat -c %s "$OUT/rewards.bundle.mjs") bytes)"
