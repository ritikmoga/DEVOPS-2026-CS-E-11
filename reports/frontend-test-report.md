# Frontend CI report

- Commit: local
- Result: **PASSED**

| Check | Result | Duration |
| --- | --- | ---: |
| Public frontend JavaScript syntax check | ✅ Passed | 0.28s |
| Public frontend production build | ✅ Passed | 1.72s |
| Admin frontend JavaScript syntax check | ✅ Passed | 0.30s |
| Admin frontend production build | ✅ Passed | 1.18s |

## Output

### Public frontend JavaScript syntax check

```text
> @event-platform/public-client@1.0.0 typecheck
> node --check src/app.js
```

### Public frontend production build

```text
> @event-platform/public-client@1.0.0 build
> vite build

vite v6.4.3 building for production...
transforming...
✓ 59 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.60 kB │ gzip:  0.37 kB
dist/assets/index-BhwVLNNs.css   19.07 kB │ gzip:  4.98 kB
dist/assets/index-CW5NfVjy.js   140.27 kB │ gzip: 49.10 kB
✓ built in 802ms
```

### Admin frontend JavaScript syntax check

```text
> @event-platform/admin-client@1.0.0 typecheck
> node --check src/app.js
```

### Admin frontend production build

```text
> @event-platform/admin-client@1.0.0 build
> vite build

vite v6.4.3 building for production...
transforming...
✓ 9 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.51 kB │ gzip:  0.33 kB
dist/assets/index-Csz4oa1m.css   17.19 kB │ gzip:  4.55 kB
dist/assets/index-Bz7w9fNx.js   120.44 kB │ gzip: 40.28 kB
✓ built in 559ms
```
