# Frontend CI report

- Commit: f4dc98c2cd099eec7c107578f0effe2acd2a5def
- Result: **PASSED**

| Check | Result | Duration |
| --- | --- | ---: |
| Public frontend typecheck | ✅ Passed | 2.34s |
| Public frontend production build | ✅ Passed | 6.02s |
| Admin frontend typecheck | ✅ Passed | 2.34s |
| Admin frontend production build | ✅ Passed | 8.63s |

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
[32m✓ built in 3.41s[39m
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
[32m✓ built in 5.94s[39m

[33m
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m
```
