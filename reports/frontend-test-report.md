# Frontend CI report

- Commit: 0c9443e8146849c11b5b165de40eeba1bc4bc088
- Result: **PASSED**

| Check | Result | Duration |
| --- | --- | ---: |
| Public frontend JavaScript syntax check | ✅ Passed | 0.56s |
| Public frontend production build | ✅ Passed | 2.39s |
| Admin frontend JavaScript syntax check | ✅ Passed | 0.53s |
| Admin frontend production build | ✅ Passed | 2.29s |

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

[36mvite v6.4.3 [32mbuilding for production...[36m[39m
transforming...
[32m✓[39m 59 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m  0.60 kB[22m[1m[22m[2m │ gzip:  0.37 kB[22m
[2mdist/[22m[35massets/index-ClzLOkoA.css  [39m[1m[2m 18.99 kB[22m[1m[22m[2m │ gzip:  4.96 kB[22m
[2mdist/[22m[36massets/index-C8Up1efx.js   [39m[1m[2m139.71 kB[22m[1m[22m[2m │ gzip: 48.92 kB[22m
[32m✓ built in 1.23s[39m
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

[36mvite v6.4.3 [32mbuilding for production...[36m[39m
transforming...
[32m✓[39m 9 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m  0.51 kB[22m[1m[22m[2m │ gzip:  0.32 kB[22m
[2mdist/[22m[35massets/index-Csz4oa1m.css  [39m[1m[2m 17.19 kB[22m[1m[22m[2m │ gzip:  4.55 kB[22m
[2mdist/[22m[36massets/index-D6ucyzyy.js   [39m[1m[2m120.46 kB[22m[1m[22m[2m │ gzip: 40.29 kB[22m
[32m✓ built in 969ms[39m
```
