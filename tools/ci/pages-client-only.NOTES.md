# Pages client-only trim (pending workflow scope)

OAuth push cannot update `.github/workflows/*` without `workflow` scope.

Intended `deploy-pages.yml` step before upload:

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

Copy `tools/ci/model-tests.yml` → `.github/workflows/model-tests.yml` with a workflow-scoped token.
