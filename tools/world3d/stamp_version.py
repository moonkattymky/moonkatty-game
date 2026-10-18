#!/usr/bin/env python3
"""Cache-bust every first-party module: writes an import map that maps each ./src/**/*.js URL to ?v=N
(relative imports resolve to URLs first, then hit the map), and bumps the main.js script tag.
usage: python3 tools/stamp_version.py 31 [index.html]"""
import sys, re, json, pathlib
v = sys.argv[1]; idx = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'index.html'); root = idx.parent
m = {"three": "./vendor/three/build/three.module.js"}
for p in sorted((root / 'src').rglob('*.js')):
    rel = './' + p.relative_to(root).as_posix(); m[rel] = f'{rel}?v={v}'
s = idx.read_text()
s = re.sub(r'<script type="importmap">.*?</script>', '<script type="importmap">' + json.dumps({"imports": m}, separators=(',', ':')) + '</script>', s, flags=re.S)
s = re.sub(r'src="\./src/main\.js\?v=\d+"', f'src="./src/main.js?v={v}"', s)
idx.write_text(s); print('stamped', v, len(m) - 1, 'modules')
