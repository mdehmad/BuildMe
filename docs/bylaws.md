# CDA bylaws implemented

Source: *Islamabad Residential Sectors Zoning (Building Control) Regulation 1993*, Capital Development Authority ([PDF](https://www.cda.gov.pk/public/Assets/pdf/1699885249_b05cb0e0_abed_43cf_8916_685822960e8d_.pdf)). Code: `cdaRules()`, `porchRules()`, `annex1()` and `bylawChecks()` in `src/engine.js`.

## Schedule A — bulk & height

Terraced houses are classified by plot area and detached houses by frontage. Every type is limited to 2 storeys and 30 ft from the front road, plus a stair tower (mumty). Covered area is measured externally.

| Type | Plot | Front | Sides | Ground coverage | FAR | Stair tower |
|---|---|---|---|---|---|---|
| A | up to 150 yd², frontage 20–29 ft | 5' | — | 60% | 1.20 | 150 ft² |
| A | 151–200 yd², frontage 25–30 ft | 6' | — | 60% | 1.20 | 150 ft² |
| B | 201–625 yd², frontage 30–49 ft | 10' | — | 60% | 1.05 | 200 ft² |
| C | frontage 50–59 ft | 10' | 5' / 10' | 50% | 0.90 | 250 ft² |
| C | frontage 60–69 ft | 10' | 10' / 10' | 50% | 0.90 | 250 ft² |
| C | frontage 70–79 ft | 20' | 10' / 10' | 50% | 0.90 | 250 ft² |
| D | frontage 80–99 ft | 20' | 10' / 10' | 50% | 0.85 | 250 ft² |
| D | frontage 100 ft + | 30' | 15' / 15' | 50% | 0.85 | 250 ft² |

**Rear open space** follows current practice as specified by the project owner: **5 ft up to 5 marla (≤ 1,250 ft²), 7 ft below 1 kanal, 10 ft from 1 kanal (4,500 ft²)**. The 1993 table lists 7–15 ft. The house sits on the rear line, and extra open space goes to the front lawn unless the user chooses a back yard.

## Other clauses

- **cl. 10 — servant room:** one servant room with bath is required on plots of 501 yd² and above.
- **cl. 12.06 — car porch:**
  - Terraced: single porch, 180 ft² total, of which at most 80 ft² may be in the setback.
  - Detached single: 200 ft² (setback ≤ 10 ft) or 300 ft² (setback over 10 ft).
  - Detached double: 300 / 400 ft².
  - All porches: minimum width 9 ft. Maximum length 26 ft (single) or 30 ft (double) for detached houses.
  - Porch area within the limit is excluded from FAR; any excess counts.
  - Porch roofs may not be used as terraces.
- **cl. 16 — living units:** 1 below 488 yd², 2 from 488 yd².
- **Annex 1 — minimum spaces:** habitable rooms 100 ft² and 8'-6" wide; kitchen 45 ft² and 5'-0"; bath 24 ft² and 3'-0"; powder 15 ft². Up to 10% relaxation is allowed with a penalty.
- **Stair flight:** minimum 3'-3".

## How the plan stays compliant

1. **Envelope:** plot minus setbacks, with depth capped so ground coverage ≤ limit (exempt porch area excluded).
2. **First floor:** area is capped at `FAR × plot − ground floor counted area`. Rooms that don't fit become open roof terrace, and any terrace over the porch becomes inaccessible porch roof.
3. **Checks:** every plan is checked. The suggestion search discards failing candidates, and editing operations refuse changes that would fail.
