# Frontend CI report

- Commit: 14ea6422d89826ea2661e6a779061578f543c3c6
- Result: **PASSED**

| Check | Result | Duration |
| --- | --- | ---: |
| Public frontend typecheck | ✅ Passed | 1.77s |
| Public frontend production build | ✅ Passed | 4.46s |
| Admin frontend typecheck | ✅ Passed | 2.03s |
| Admin frontend production build | ✅ Passed | 8.02s |

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

[36mvite v6.4.3 [32mbuilding for production...[36m[39m
transforming...
[32m✓[39m 2053 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m  0.50 kB[22m[1m[22m[2m │ gzip:   0.32 kB[22m
[2mdist/[22m[35massets/index-CTLYDvRE.css  [39m[1m[2m 17.75 kB[22m[1m[22m[2m │ gzip:   4.66 kB[22m
[2mdist/[22m[36massets/index-BkWEpIEy.js   [39m[1m[2m396.01 kB[22m[1m[22m[2m │ gzip: 125.96 kB[22m
[32m✓ built in 2.50s[39m
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

[36mvite v6.4.3 [32mbuilding for production...[36m[39m
transforming...
[32m✓[39m 2676 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m  0.41 kB[22m[1m[22m[2m │ gzip:   0.28 kB[22m
[2mdist/[22m[35massets/index-DuGlApkD.css  [39m[1m[2m 15.82 kB[22m[1m[22m[2m │ gzip:   4.19 kB[22m
[2mdist/[22m[36massets/index-wzZ-yvw9.js   [39m[1m[33m783.03 kB[39m[22m[2m │ gzip: 229.99 kB[22m
[32m✓ built in 5.74s[39m

[33m
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m
```
