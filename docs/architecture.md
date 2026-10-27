# BuildMe architecture

```
answers ──► initialScheme() ──► vary() (search only) ──► realise(scheme) ──► plan
                                     ▲                         │
                     edit.* (swap, move, resize, flip,          ├─ floors[]: rooms, doors, windows, links (layout graph)
                     add, remove, depth, mirror) ───────────────┘  stats, bylaw checks, score
```

## Scheme

A scheme is plain JSON:

- `gf.bands[]`: rows from the road side backwards (`F` front, `M` middle, `Q`/`R` rear, `C` corridor), each holding ordered items.
- `depths[]`: depth of each row.
- `ff`: first-floor rows, plus the two segments beside the stair.

Item kinds:

| Kind | What it is |
|---|---|
| `room` | A single room. |
| `suite` | A room plus a side column, e.g. bedroom + bath + dress, or drawing room + powder. |
| `stack` | Rooms stacked along the row depth, e.g. kitchen + store, servant + bath. |
| `stairCol` | Dog-leg stair plus filler. Its position is copied to the first floor. |
| `porch` | Car porch, part inside the building line and part in the front setback. |

## Realisation

1. **Width:** each row's width is split by target area, honouring minimum widths (`solveWidths`) and snapping to a 3-inch grid.
2. **First floor:** rows reuse the ground-floor row depths. Open terraces are added until the FAR budget is met.
3. **Doors:** placed on shared walls by rules: baths open off their bedroom or dress, kitchens off dining, bedrooms off circulation. A breadth-first search from the porch (ground floor) or stair (first floor) flags unreachable rooms.
4. **Windows:** placed on edges facing open space. A lounge lit only by borrowed light gets a skylight.
5. **Search and relaxation:** `generate()` tries up to 100 variants per attempt. It ranks them by score plus 1000 per failed bylaw, so a compliant plan always wins. When nothing compliant is found, it relaxes the brief one step and tries again, up to 16 attempts. It keeps the attempt closest to the original brief: 140 per missing bedroom, 30 per relaxation. Large rear zones are packed into several rows, each served by a corridor behind the middle row or between row pairs, and linked by a 4'-6" spine passage.
6. **Score:** penalises undersized or badly proportioned rooms, rooms without windows, unreachable rooms, missing kitchen–dining adjacency, and bylaw failures.

## Front end

- `app.js`: app shell with hash routes (`#dashboard`, `#new`, `#design`, `#projects`, `#plots`, `#cost`, `#bylaws`, `#help`). It also holds the brief parser (regular expressions for plot size, marla/kanal, bedrooms, floors, rooms, road side, style and finish), the four-step questions and the workspace. The assistant tips are rules over plan stats and checks, and projects are saved in `localStorage` (`buildme.projects`).
- Earlier layout note: four-step questions, then results. The results page is the plan viewer plus facts and cost, the 3D panel, the bylaw check, the schedule, the bubble editor and downloads.
- `help.js`: the help layer. Mimar is an inline SVG character with CSS moods (happy, wave, idea, think, oops). The FAQ library is tagged by screen, which feeds the floating guide, the Quick answers cards and the searchable Help page. `oops()` is the animated pop-up: blocks drop in and one doesn't fit, with reasons and fix buttons. `toast()` shows short notes. When `generate()` finds nothing it returns `[]` with a `diag` object (rejection counts by reason and the relaxations tried), and `app.js` turns that into the pop-up.
- `render.js`: draws SVG in feet. The same SVG feeds the screen, the PNG/PDF export (through a light print palette) and the bubble editor lanes.
- `model3d.js`: extrudes every enclosed room as a box per floor. It adds windows on outside walls, parapets on reachable roof edges, the porch, the mumty and water tank, plus style elements: frame, louvers, cornices, hip roofs, arches, iron rails, shutters.
- `export.js`: DXF (R12 ASCII: LINE/ARC/TEXT on A-* layers), jsPDF report, cost model.

## Downloads

- **Inside claude.ai:** the page uses the Artifact `downloads` capability. Its allowlist includes pdf, png, jpg and zip, so DXF and GLB ship zipped.
- **Elsewhere (Cloudflare, local file):** it falls back to a normal browser download.
