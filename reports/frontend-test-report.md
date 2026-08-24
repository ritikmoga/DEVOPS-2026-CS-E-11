# Frontend CI report

- Commit: 4340b5a831775c49dc2feb545452c00da82d7d00
- Result: **PASSED**

| Check | Result | Duration |
| --- | --- | ---: |
| Public frontend typecheck | ✅ Passed | 2.01s |
| Public frontend production build | ✅ Passed | 5.15s |
| Admin frontend typecheck | ✅ Passed | 2.08s |
| Admin frontend production build | ✅ Passed | 5.54s |

## Output

### Public frontend typecheck

```text
> @event-platform/public-client@1.0.0 typecheck
> tsc --noEmit
```

### Public frontend production build

```text
> @event-platform/public-client@1.0.0 build
> tsc -b && vite build

vite v6.4.3 building for production...
transforming...
✓ 2053 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.50 kB │ gzip:   0.32 kB
dist/assets/index-CTLYDvRE.css   17.75 kB │ gzip:   4.66 kB
dist/assets/index-BkWEpIEy.js   396.01 kB │ gzip: 125.96 kB
✓ built in 2.66s
```

### Admin frontend typecheck

```text
> @event-platform/admin-client@1.0.0 typecheck
> tsc --noEmit
```

### Admin frontend production build

```text
> @event-platform/admin-client@1.0.0 build
> tsc -b && vite build

vite v6.4.3 building for production...
transforming...
✓ 2676 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.41 kB │ gzip:   0.28 kB
dist/assets/index-DuGlApkD.css   15.82 kB │ gzip:   4.19 kB
dist/assets/index-wzZ-yvw9.js   783.03 kB │ gzip: 229.99 kB
✓ built in 3.29s


(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```
