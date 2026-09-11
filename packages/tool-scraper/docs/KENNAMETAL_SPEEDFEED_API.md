# Kennametal / WIDIA speeds & feeds API ("workshop solutions")

The interactive Feeds & Speeds widget on kennametal.com product pages is
backed by a Hybris storefront API under `/store/us/en/kmt/workshop/`. It is
**fully usable as a guest** — no login, no API key, just a cookie jar. It is
the same engine behind the static Application Data charts, but with exact
per-tool diameters, 20+ workpiece-material subgroups, per-operation modes
for endmills, and automatic engagement (chip-thinning) adjustment.

All findings below verified live 2026-07-24 with plain `curl`
(`-A "Mozilla/5.0"`, shared cookie jar across calls).

**WIDIA serves the same API from widia.com**, under the identical
`/store/us/en/kmt/workshop/` path — the `kmt` segment does *not* become
`wid` (that 404s). Verified 2026-07-26: the full add → bind → defaults
flow works for WIDIA material numbers, and the 10 mm VariMill chip
splitter (7073625) returns P0 defaults ap 10 mm, ae 1 mm, Vc 464.51 m/min,
fz 0.08 mm with the usual `data-valid-wpm` list of P/M/K/N/S/H subgroups.
Swap the host; everything else in this document applies unchanged. (Note
this contrasts with the variant-table endpoint, where WIDIA *does* rename
the component node — see `CLAUDE.md`.)

Endpoints discovered by reading
`etc.clientlibs/kennametal/clientlibs/site/kennametal/v2/product-async.min.*.js`
(object `feedsAndSpeeds`, helper `generateStoreURL`).

## Capability summary by tool type

| | Drills (GOdrill, KenTIP FS) | Endmills (GOmill PRO) | Taps (KHSST) |
|---|---|---|---|
| Supported | ✅ 23 material subgroups | ✅ 27 material subgroups | ❌ `valid-wpm: []` — no data |
| Speed | Vc default + min–max range | Vc default + min–max range | — |
| Feed | Vp (mm/min) + fn per rev | fz per tooth + Vf + fn | — |
| DOC / WOC | n/a (depth-of-hole input) | `ap` / `ae` with vendor defaults | — |
| Operation modes | one (drilling) | Side Milling / Slot Milling | — |
| Adaptive / HEM | n/a | set `ae` low → engine applies Kv/KFz boost | — |
| Finishing mode | ❌ (use Vc max of range) | ❌ (use Vc max of range, reduce fz) | — |
| Ramp angle | n/a | ❌ not in the engine at all | — |
| Extras | MRR, power, torque, coolant | MRR, power, torque, spindle rpm | — |

Taps: Kennametal publishes **no cutting data** for the KHSST HSS tap lines —
the speedfeed response carries `data-valid-wpm="[]"` and tap family/product
pages have no application charts either. Keep externally-derived tap SFM
(tapping feed is locked to pitch; rpm is the only free parameter anyway).

## Call flow

### 0. Material taxonomy (no session needed)

```
GET /store/us/en/kmt/workshop/common/wpm-standard-lookups
```

Clean JSON: hardness scales, material standards (AISI, DIN, …), and the full
ISO group tree — `P0..P6, M1..M3, K1..K3, N1..N6, S1..S4, H1..H4` with
names, carbon/hardness descriptions. Use these `code` values as
`materialCode.value` below.

### 1. Create a guest solution (one per tool)

```
POST /store/us/en/kmt/workshop/solutions/solution/add
Content-Type: application/x-www-form-urlencoded

isFromProjects=true&variantCode=<Material Number>&fromAEMFSModal=true&query=
```

Returns JSON; `response.redirectUrl` contains `solutionCode=<CODE>` (e.g.
`00003U9OR`). Works with any Material Number from the variant scrape.

### 2. Bind the solution to the session

```
GET /store/us/en/kmt/workshop/solutions/solution?solutionCode=<CODE>&productCode=<Material Number>
```

One GET with the same cookie jar; without it the speedfeed calls 302.

### 3. Defaults

```
POST /store/us/en/kmt/workshop/solutions/solution/speedfeed/defaults
Content-Type: application/x-www-form-urlencoded

solutionCode=<CODE>&fpxFSResponseJson=
```

Returns an HTML fragment (~100 KB) with the default material (P0) and all
values — see "Parsing" below.

### 4. Recalculate (change operation / ap / ae / Vc / fz)

```
POST /store/us/en/kmt/workshop/solutions/solution/speedfeed
Content-Type: application/json          ← REQUIRED (form-encoded → 302/404)

{"solutionCode":"<CODE>","turretCode":"","machineCode":"",
 "materialCode":{"symbol":"KMatCode","value":"P0"},
 "materialIdAdvance":{"symbol":"KMatCodeAdvId","value":""},
 "newSymbol":"Operation",          // or "ap" | "ae" | "Vc" | "fz"
 "newValue":"Slot Milling",        // string, even for numbers: "0.15"
 "newUom":"metric"}                // or "inch"
```

The engine re-derives everything downstream of the changed field.

### 5. Switch workpiece material

```
POST /store/us/en/kmt/workshop/solutions/solution/speedfeed/wpm
Content-Type: application/json          ← REQUIRED

{"solutionCode":"<CODE>","turretCode":"","machineCode":"",
 "newUom":"metric","materialStandard":"ALL",
 "materialCode":{"symbol":"KMatCode","value":"N1"},
 "materialIdAdvance":{"symbol":"KMatCodeAdvId","value":""}}
```

Note: resets Operation to the default (Side Milling) — set material first,
then operation/engagement.

### Other endpoints (seen in JS, untested)

- `/workshop/solutions/solution/feed-speed/export/` — file export of the
  feeds/speeds result; might yield structured data instead of HTML.
- `/workshop/solutions/solutionComponent` — add another product to an
  existing solution ("ADD" branch in JS). Worth testing before a 500-tool
  sweep: could let one solution/session serve many variants instead of one
  `solution/add` per tool.
- `/workshop/solutions/solution/speedfeed/turrets`, `/warnings`,
  `/close-assembly`, `/load-assembly` — machine-selection plumbing.

## Parsing the HTML fragments

State lives in cleanly-ID'd `<input>`/`<select>` elements, prefix `metric-`
or `inch-` (both unit systems are always present):

| Element id | Meaning |
|---|---|
| `metric-KMatCode` | selected material subgroup (e.g. `P0`) |
| `metric-Operation` | `<select>`: `Side Milling` / `Slot Milling` (endmills) |
| `metric-ap-value1` | DOC mm (endmills) |
| `metric-ae-value2` | WOC mm (endmills, side milling only — absent in slot) |
| `metric-Vc-valueN` | cutting speed m/min (input index shifts when ae absent) |
| `metric-fz-valueN` | feed per tooth mm (endmills) |

Computed outputs are labeled text pairs in the fragment:
`Spindle Speed (n) … rev/min`, `Feed Rate (Vf) … mm/min`,
`Feed per Revolution (fn)`, `Penetration Rate (Vp)` (drills),
`Material Removal Rate (MRR)`, `Power at Tool (Pcut)`, `Torque at Tool`,
`Coolant`, and `Cutting Speed (Vc) m/min <min> - <max>` (the vendor range).

Tool support check: `data-valid-wpm="[…]"` attribute lists the material
subgroups the engine has data for; `[]` means unsupported tool (taps).

## Verified reference values

1 mm GOdrill (4151623), defaults (P0): n 25465 rpm, Vc range 70–115 m/min,
Vp 763.95 mm/min → fn 0.030 mm/rev — back-computes exactly to the static
chart's 80 m/min starting value and 0.03 mm/rev minimum.

3 mm GOmill PRO radiused 4FL (7378942):

| State | ap | ae | Vc m/min | fz mm | n rpm | Vf mm/min |
|---|---|---|---|---|---|---|
| P0, Side (default) | 3 | 1.2 | 219.44 | 0.0195 | — | — |
| P0, Slot | 3 | — | 165 | 0.0156 (−20%) | 17507 | 1094 |
| N1, Side | 3 | 1.2 | 731.47 (658–805) | 0.0279 | 77611 | 8661 |
| N1, Side, ae=0.15 (5% D1) | 3 | 0.15 | 1397.07 (×1.91) | 0.0627 (×2.25) | 148234 | 37185 |

The last row shows the engine auto-applies Kennametal's published Kv/KFz
engagement adjustment factors (the "Multi-Purpose_Table" on family pages) —
i.e. **adaptive/HEM cutting data = set `ae` to the adaptive engagement and
read back the boosted Vc/fz**. No named "adaptive" mode exists.

## Gotchas

- Spindle speeds are **uncapped** (148k rpm above) — clamp to machine maxRPM
  downstream, as the preset generator already does.
- Recalc/wpm endpoints demand `Content-Type: application/json` with a JSON
  body; form-encoding silently 302s (defaults endpoint is the opposite —
  form-encoded).
- Every `solution/add` creates a persistent named solution server-side
  (`Solution_<timestamp>`); be polite on bulk runs and investigate
  `solutionComponent` reuse first.
- ~8–10 requests per tool for a 3-material × 3-purpose preset sweep
  (setup ×2, then one recalc per material/operation/engagement change).
- Ramp angle and an explicit finishing mode don't exist anywhere in the
  engine; synthesize finishing from Vc max + reduced fz (their footnoted
  guidance) and keep ramp angle as a local default.

## Cheaper alternative for drills: static application charts

Drill family pages server-render the same base data (Vc min/start/max +
feed-per-rev ranges at ~10 diameter breakpoints, per material subgroup) in
`APPLICATION_LINK Holemaking_SF_Chart*` divs — one unauthenticated GET per
family, same fetch pattern as the variant tables. Endmill family pages have
the analogous `SCEM_Application_Data_Web` chart (side/slot Vc + fz by
diameter + ap/ae rules) and the `Multi-Purpose_Table` Kv/KFz factors. Use
the charts when per-family granularity is enough; use the API when exact
per-tool values or engagement-adjusted numbers are wanted.
