# Deployed response headers — cache policy check

**Date checked:** 12 November 2026
**Host:** `https://htpn-clinical-checker.vercel.app`
**Method:** `curl -sS -D - -o /dev/null <url>` (headers only), from a cloud session with outbound access to the deployed site.

## Deployment currency

`/dfu/index.html` contains the string `v10.7` (2 occurrences). The deployment is current, so the headers below describe the build in question.

## Recorded headers

| URL | Status | `cache-control` | `etag` | `age` | `x-vercel-cache` | `content-type` |
|---|---|---|---|---|---|---|
| `/dfu/` | 200 | `public, max-age=0, must-revalidate` | `"dd4c1903ba8a5b1ae5c0b5230d623ce5"` | 0 | MISS | `text/html; charset=utf-8` |
| `/dfu/index.html` | 200 | `public, max-age=0, must-revalidate` | `"dd4c1903ba8a5b1ae5c0b5230d623ce5"` | 0 | MISS | `text/html; charset=utf-8` |
| `/dfu/tissue/model.json` | 200 | `public, max-age=0, must-revalidate` | `"3983a835cb73e887e56e624c52bf6a79"` | 0 | MISS | `application/json; charset=utf-8` |
| `/dfu/tissue/group1-shard1of3.bin` | 200 | `public, max-age=0, must-revalidate` | `"100026d382fb3be9d80979e2b728c297"` | 0 | MISS | `application/octet-stream` |
| `/dfu/seg/model.json` | 200 | `public, max-age=0, must-revalidate` | `"78ae29293ad31ba1f1d6004f5d0e20cf"` | 0 | MISS | `application/json; charset=utf-8` |

All five also returned `accept-ranges: bytes`, `access-control-allow-origin: *` and a `last-modified` header. Served from `iad1`.

## Verdict

Revalidation is in force. All five URLs return `public, max-age=0, must-revalidate` with a strong `ETag`, so a browser must revalidate the HTML, the model manifests and the weight shards on every load; a stale `group1-shard1of3.bin` cannot be served from cache beside a freshly deployed `model.json`. `vercel.json` needs no change.

Notes:
- `/dfu/` (directory form, no filename) picks up the policy even though the configured sources are `/dfu` and `/(.*).html` — confirmed empirically above, not assumed.
- `x-vercel-cache: MISS` on all five reflects a first request to that edge node and is not a finding; the `Cache-Control` value is what governs browser-side revalidation.
