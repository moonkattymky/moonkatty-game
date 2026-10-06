# Pages client-only trim (blocked — needs `workflow` OAuth scope)

**Status (2026-10-07 ~02:40 IL):** cannot apply from this agent. `gh` token scopes are
`gist, read:org, repo` only — **no `workflow`**. GitHub rejects pushes that modify
`.github/workflows/*` without that scope. Do **not** re-auth overnight; owner applies.

## Owner steps (workflow-scoped token / PAT)

1. Edit `.github/workflows/deploy-pages.yml` — insert **before** Upload site:

```yaml
      - name: Prepare client site
        run: |
          mkdir -p _site
          shopt -s dotglob nullglob
          for item in *; do
            case "$item" in
              _site|server|tests|.git|.github) continue ;;
            esac
            cp -a "$item" _site/
          done
      - name: Upload site
        uses: actions/upload-pages-artifact@v4
        with:
          path: '_site'
```

2. Copy `tools/ci/model-tests.yml` → `.github/workflows/model-tests.yml`.
3. Commit + push to `main` (or merge a PR that touches workflows).

Current `deploy-pages.yml` still uploads `path: '.'` (includes `server/` + `tests/`).
