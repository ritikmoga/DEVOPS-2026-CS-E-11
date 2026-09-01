# Frontend CI report

- Commit: 6f5461291ce2648154be44f50c1362b7071fcba8
- Result: **PASSED**

| Check | Result | Duration |
| --- | --- | ---: |
| Public frontend JavaScript syntax check | ✅ Passed | 0.39s |
| Public frontend production build | ✅ Passed | 1.94s |
| Admin frontend JavaScript syntax check | ✅ Passed | 0.46s |
| Admin frontend production build | ✅ Passed | 1.89s |

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
dist/assets/index-BqjgrXXw.js   140.29 kB │ gzip: 49.11 kB
✓ built in 998ms
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
dist/index.html                   0.51 kB │ gzip:  0.32 kB
dist/assets/index-Csz4oa1m.css   17.19 kB │ gzip:  4.55 kB
dist/assets/index-D6ucyzyy.js   120.46 kB │ gzip: 40.29 kB
✓ built in 736ms
```
