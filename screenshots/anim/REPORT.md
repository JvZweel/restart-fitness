# Animation upgrade report (2026-11-08)

The 3D exercise demonstrations in Restart Fitness were rebuilt. What changed:
- **Figure:** a sculpted studio mannequin replaces the ellipsoid/capsule doll.
- **Motion engine:** splines with tempo phases replace linear lerp.
- **Rig:** generic two-bone IK for planted feet and hands.
- **Stage:** new lighting and framing.
- **Moves:** every move re-authored and then reviewed visually.

The app flow, test IDs, offline precache and session UI are unchanged. Everything is committed locally only; nothing was pushed or uploaded.

## Commits (local, branch `main`)

| Commit | What |
| --- | --- |
| `61f7756` | Before contact sheets for every move (`screenshots/anim/before/`) plus the contact-sheet tooling |
| `6c39731` | test: animation engine spec. RED: the module was missing |
| `e5c8e6d` | feat: sculpted mannequin, spline tempo engine, 3D two-bone IK, re-authored moves, anim.html preview. GREEN: 275 tests |
| `1c1f7e6` | fix: pose fixes from the visual review, code-review fixes, lighter geometry (276 tests) |
| `2a387bf` | docs: after contact sheets, perf measurement, STATUS.md, refreshed e2e screenshots |
| (next commit) | this REPORT.md |

## Tests and gates (all exit 0)

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm test`: 8 files, 276 tests. 214 of them are in `test/anim.test.ts`, which runs **every** animation at 60 fps and checks:
  - all values finite;
  - nothing below the floor;
  - no popping (a joint moving more than 4.5 cm in one frame);
  - planted limbs within 1.2 cm of their mark;
  - no foot sliding;
  - centre of mass over the feet;
  - no sinking into the bench pad;
  - two-hand, goblet and hip-bell grips held;
  - IK reach.

  It also checks the spline maths: holds, no overshoot, easing, phase, tension and zero-duration safety.
- `npm run build`: 3D chunk 626 kB (161 kB gzip); precache 18 entries, 1104.8 KiB.
- `npm run e2e`: 27 steps, 55 assertions, 48 app screenshots refreshed in `screenshots/`.
- `npm run build:pages && npm run e2e:pages`: 23 steps, 55 assertions under `/restart-fitness/`, including offline.

## Best images

- Overviews of all moves: `screenshots/anim/overview-1.png`, `screenshots/anim/overview-2.png`
- Before overviews: `screenshots/anim/before/overview-1.png`, `screenshots/anim/before/overview-2.png`
- Single moves:
  - `screenshots/anim/db-rdl.png` (hip hinge, flat back, bells tracking the legs)
  - `screenshots/anim/flat-db-press.png` (press arc, feet planted, dumbbell trail)
  - `screenshots/anim/one-arm-row.png` (support hand and knee planted on the bench)
  - `screenshots/anim/bent-over-row.png`
  - `screenshots/anim/hip-thrust.png`
  - `screenshots/anim/cat-cow.png`
  - `screenshots/anim/thruster.png`
- Dark theme: `screenshots/anim/dark/seated-shoulder-press.png`, `screenshots/anim/dark/goblet-squat.png`
- In the app: `screenshots/phone-light-lift.png`, `screenshots/desktop-dark-lift.png`

## Reviewed moves (contact sheet at 0/25/50/75 % opened and inspected for each)

The brief said 43 moves. The registry has 44 animation ids because `bw-squat` is used by the warm-up. All 44 were reviewed:

1. goblet-squat
2. bw-squat
3. bulgarian-split-squat
4. reverse-lunge
5. step-up
6. db-rdl
7. good-morning
8. hip-thrust
9. sumo-deadlift
10. single-leg-rdl
11. flat-db-press
12. close-grip-press
13. incline-db-press
14. decline-db-press
15. seated-shoulder-press
16. push-up
17. one-arm-row
18. chest-supported-row
19. rear-delt-fly
20. db-pullover
21. bent-over-row
22. hammer-curl
23. alt-curl
24. incline-curl
25. overhead-triceps
26. skull-crusher
27. dead-bug
28. side-plank
29. plank
30. reverse-crunch
31. march
32. arm-circles
33. cat-cow
34. worlds-greatest
35. wall-angel
36. hip-flexor-stretch
37. hamstring-stretch
38. figure-four
39. childs-pose
40. chest-opener
41. breathing
42. thruster
43. farmer-march
44. mountain-climber

**Fixed during the review:**
- RDL, good morning and bent-over row had the hips ahead of the ankles.
- Squats had the centre of mass behind the heels, and the knees were frog-legged.
- Cat pose collapsed instead of arching up.
- Child's pose put the head through the floor and the knees dipped.
- Figure-four was unreadable.
- The decline press legs floated.
- Worlds-greatest had a "boxing" elbow.
- The step-up bell clipped the thigh.
- The breathing hands stuck out.
- The reverse-lunge rear shin lay flat on the floor.
- The reverse-crunch ribcage pressed into the pad.
- The abs highlight showed as a spot on the sternum.

## Known limits

- Performance was measured only in headless Chrome with SwiftShader software WebGL (`screenshots/anim/perf.json`):
  - about 48k triangles and 86–126 draw calls per frame;
  - 0.5–5 ms of CPU per pose plus render;
  - 26–40 ms frame interval under software rendering.

  It was **not measured on a physical Android device**, and no 60 fps claim is made. The pixel ratio is capped at 2 (and 1.6 MP), and it steps down automatically on sustained slow frames.
- Poses are hand-authored joint angles plus IK, not motion capture. Some moves are stylised:
  - the side plank is straight-arm;
  - the march arm swing is generous;
  - the child's-pose hips sit slightly low.
- Fists are a single wrapped shape, not individual fingers.
- Automatic clipping checks cover the floor, the bench pad and grips. Arm-through-torso intersection was checked visually only.
- Idle sway is applied only in the viewer, so it isn't covered by the rig tests. Its amplitude is about 1° of thorax and 4° of gaze.
