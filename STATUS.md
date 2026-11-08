# Status

Last updated: 2026-11-08

## Done

**Domain (src/domain, unit-tested)**
- Own 3-day full-body dumbbell programme with re-balancing for 2 to 5 training days (every day stays full-body; weekly sets per pattern stay even).
- Double progression driven by last session's reps and RPE, always snapped to the user's own weights list (also when a weight was removed since the last session).
- Weights list (default 2.5 to 40 kg in 2.5 kg steps, plus 41 kg), snapping, next up/down.
- Garmin Connect CSV parser (steps, sleep, weight; many date/number/duration formats) and merge by date.
- Backup export/import with validation and sanitising of untrusted files (malformed sets, non-numeric values, unknown exercise swaps, bad settings).
- Session logic: logging a set, carrying weight forward, auto-rest, next open set (src/domain/session.ts).
- Quick-log validation with plausible ranges (src/domain/daily.ts).
- Stats: week status, next session, streak, lift history / e1RM, weekly averages.

**App**
- Today: next session with exercise list and duration, resume banner, first-run welcome, week strip and streak, quick log (weight, steps, sleep, weekly waist) with inline field errors, daily targets.
- Session player: timed warm-up, lifts with 3D mannequin (play/pause, drag or arrow keys to rotate), cues, muscles, load suggestion, set editor (weight/reps steppers, RPE), compact rest dock (auto-start, pause, ±15 s, progress bar, vibration + beep, wake lock), swap today/always (with a warning when sets are already logged), optional interval finisher, cool-down with box breathing, summary with records and notes, resume after reload.
- Programme: training days 2 to 5, re-balanced sessions, same-pattern swaps, edit sets and rep ranges, hard sets per week, guidance.
- Progress: lift e1RM chart and recent sessions; body charts (weight, waist; steps and sleep as weekly averages once there are 3+ weeks); weekly photo timeline.
- Settings: theme (System/Light/Dark), weights list add/remove/restore, rest defaults, toggles, Garmin CSV preview + merge, JSON backup export/import, reset with confirmation, offline status, install button.
- PWA: manifest, icons, precached service worker, works offline, works under a sub-path (`npm run build:pages`).

**This pass (polish, accessibility, review)**
- Visual: tabular figures only on numbers (they had been on globally, which spaced out hyphens, e.g. "Warm - up"); sentence-case labels instead of tracked all-caps; solid session header (content was showing through); session screens scroll to top on phase/exercise change; phone-sized 3D stage so cues and controls fit; compact one-row rest dock instead of a third of the screen; charts drawn at real pixel width (text no longer scales up on desktop), dots only when readable; desktop side-rail navigation and two-column layouts (Today, Programme, Settings, Progress, session player); 44 px minimum tap targets; designed empty, loading and error states; toast fixed (it was half-width and lost its centring while animating).
- Accessibility: focus trap and focus return in sheets; focus moves to the new screen on navigation; always-mounted live region for toasts; labelled landmarks, headings, `aria-current` on tabs/steps/today, `aria-pressed` on toggles; decorative icons hidden; field errors linked with `aria-describedby`/`aria-invalid`; WCAG 2.2.2 pause control on the looping 3D demo; reduced motion starts the demo paused and disables UI motion; keyboard rotation of the figure; focus moves to Next/Finish when the set editor disappears.
- Bugs fixed (with tests): progression could suggest a weight no longer in the list; backup import accepted malformed sets/daily values/settings that could break charts and timers; a swap to an unknown exercise id survived import; auto-rest started after the session's last open set when it wasn't on the last exercise; after logging a set, an earlier skipped open set wasn't selected; storage write failures were unhandled promise rejections (now reported); photo import decoded data URLs with `fetch()` (now decoded locally); `npm run lint` failed on the e2e script (undeclared globals).
- Bugs fixed from an independent code review: Progress crashed for one render after deleting the only session of the selected lift; removing a set could hide the set editor while sets were still open; a paused rest stayed "paused" (with a stale Resume) after logging the next set started a new rest; resuming a paused rest reset the progress bar; backups with unknown exercise ids or a non-numeric start time could crash screens (now dropped on import, tested); the 3D viewer could start with the previous exercise's animation after fast navigation; a failed "Always" swap or discard was an unhandled rejection; a failed `startWorkout` write left a ghost session.

## Animation upgrade (this pass, 2026-11-08)

The 3D demonstrations were rebuilt end to end: figure, motion engine, lighting/camera and every move. The app flow, test IDs, offline behaviour and session UI are unchanged.

**Figure (src/anim/mannequin.ts)**
- Sculpted studio mannequin instead of ellipsoid/capsule "puppet": smooth lathe-profiled tapered segments (thigh, shin, upper arm, forearm), ribcage with V-taper, pelvis bowl, pecs, deltoids (front/rear), lats, traps, glutes, two-headed calves, egg-shaped head with jaw, neck, clavicles, two-segment spine (lumbar + lower thoracic), shaped feet with instep.
- Hands: open hands for planted/resting poses, and fists that wrap around the dumbbell handle (grip frame rotates for neutral/supinated/pronated).
- Hex rubber dumbbells with steel handle and collars; padded bench (rounded extruded pads, steel frame, incline strut, decline leg rollers at the front end).
- Matte material (roughness 0.6), static body merged per joint (few draw calls); muscle groups are separate meshes so they can glow.

**Motion (src/anim/motion.ts, poses.ts)**
- Keyframes are flattened into channels and interpolated with cyclic monotone cubic Hermite splines (Fritsch–Carlson): eased stops at pauses, smooth pass-through where there is no pause, never overshooting a keyframe.
- Every keyframe carries a tempo phase (eccentric / concentric / flow) and a tension value. Lifts use a controlled ~2 s eccentric, a short pause and a ~1–1.2 s concentric.
- Breathing: the ribcage expands on the inhale and the belly braces under load; for lifts the inhale/brace is on the eccentric and the exhale on the concentric. Stretches and holds breathe freely; box breathing runs 4-4-4-4.
- Muscle glow follows tension (brighter at the hardest point of the rep).
- Generic 3D two-bone IK for feet and hands with the knee/elbow bend direction kept from the authored pose; planted limbs (hands in push-ups, cat-cow, climbers; feet in squats, hinges, push-ups) stay on their marks; feet auto-flatten to the floor following the leg's heading; planted palms lie flat; resting hands (hips, chest, belly) lie palm-to-body.
- Scapulohumeral rhythm: the clavicle elevates as the arm rises above ~60°.
- Squats pass through a mid-depth key so knees and hips break together and the centre of mass stays over the feet; hinges push the hips back with a neutral spine.
- Re-authored all moves with correct bench angles (incline press 38°, incline curl 55°, upright seat 80°, decline −14° with shins hooked under the rollers), press arm planes (elbows out with forearms vertical, lockout over the shoulders), neutral/supinated/pronated grips, goblet hold at the upper chest, two-hand bell for pullover/overhead extension/sumo, bell across the hips for hip thrusts.

**Stage (src/anim/viewer.ts)**
- Studio key/fill/rim (+ second rim) lighting that turns with the camera, soft PCF shadows, a soft floor disc, and contact shadows under the torso and each foot (fade as the foot lifts).
- Subtle idle: thorax micro-sway and gaze drift (off for floor/core moves and under reduced motion).
- Optional faint dumbbell path trails (full path + comet tail); on by default, toggle in anim.html.
- Exercise-specific framing: the camera fits the whole loop (figure + props) for its auto-orbit range, per-move azimuth/elevation/zoom.
- Gentle auto-orbit (±10° over 18 s), paused for 4 s after a drag; drag to orbit (horizontal for touch, tilt with mouse/pen) with inertia; arrow keys still rotate.
- Reduced motion: no auto-orbit, no idle sway, no inertia; the demo still starts paused (unchanged) and reacts to the OS setting changing mid-session.
- Pixel ratio capped at 2 and at 1.6 MP per canvas; it steps down by 0.25 (to 1.0 minimum) after sustained frames slower than 25 fps.
- Disposal frees geometries, materials and textures; removed benches are disposed on exercise change.

**Preview** — `anim.html?anim=<id>` (dev server) has an exercise picker, play/pause, trails and dark toggles and a live phase/tension readout; `&t=0..1` renders a fixed frame; `&sheet=1` is the contact-sheet layout.

### Animation verification

- Unit tests: `test/anim.test.ts` (214 tests) — timeline continuity/holds/no overshoot/easing/phase/tension/zero-duration safety; and for **every** animation at 60 fps: finite joints, nothing below the floor (>−1.5 cm), dumbbells above the floor, no joint moving more than 4.5 cm in one frame (no popping), planted limbs within 1.2 cm, standing foot not sliding (<2 cm), centre of mass over the feet for two-footed standing moves, no torso sinking more than 3 cm into a bench pad, two-hand/goblet/hip-bell grips within 3 cm, IK reach.
- Before/after contact sheets (0/25/50/75 % of each loop) for every move: `screenshots/anim/before/<id>.png` and `screenshots/anim/<id>.png`; overviews `screenshots/anim/overview-1.png`, `overview-2.png`; dark samples in `screenshots/anim/dark/`. Generated with `node scripts/anim-contact.mjs [baseUrl] [outDir] [ids]` (+ `python3 scripts/anim-overview.py`).
- Every "after" sheet was opened and inspected. Problems found and fixed during review: hinges with hips ahead of the ankles (RDL, good morning, bent-over row), squat centre of mass behind the heels and frog-legged knees, cat pose collapsing instead of arching, child's pose head through the floor and knees dipping, figure-four unreadable, decline legs floating, worlds-greatest "boxing" elbow, step-up bell clipping the thigh, resting hands sticking out (breathing), reverse-lunge rear shin flat on the floor, reverse-crunch ribcage pressing into the pad, a sternum "abs" spot.

Visual review inventory (all 44 animation ids in the registry; the brief said 43 — the registry also contains `bw-squat`, used by the warm-up):

| Group | Moves reviewed (after sheet) |
| --- | --- |
| Knee dominant | goblet-squat, bw-squat, bulgarian-split-squat, reverse-lunge, step-up |
| Hinge | db-rdl, good-morning, hip-thrust, sumo-deadlift, single-leg-rdl |
| Push | flat-db-press, close-grip-press, incline-db-press, decline-db-press, seated-shoulder-press, push-up |
| Pull | one-arm-row, chest-supported-row, rear-delt-fly, db-pullover, bent-over-row |
| Arms | hammer-curl, alt-curl, incline-curl, overhead-triceps, skull-crusher |
| Core | dead-bug, side-plank, plank, reverse-crunch |
| Warm-up | march, arm-circles, cat-cow, worlds-greatest, wall-angel |
| Cool-down | hip-flexor-stretch, hamstring-stretch, figure-four, childs-pose, chest-opener, breathing |
| Finishers | thruster, farmer-march, mountain-climber |

### Animation performance (measured, with limits)

`node scripts/anim-perf.mjs > screenshots/anim/perf.json` — headless Chrome with **SwiftShader software WebGL** on the Linux build box, 390 px wide stage, deviceScaleFactor 2:

- Scene cost after the geometry trim: ~48 k triangles, 86–126 draw calls per frame including the shadow pass (was ~101 k triangles / 131–171 calls before trimming sphere/lathe resolution and removing small parts from the shadow pass).
- CPU time to pose + submit one frame (`renderAt`): 0.5–5 ms average across six sampled moves.
- Free-running frame interval under software rendering: 26–40 ms (≈25–38 fps); the adaptive pixel ratio stepped down to 1.75 there. This is a CPU rasteriser, not a phone GPU.
- **Not measured on a physical Android device.** No claim of 60 fps on Android is made; mid-range phone GPUs should handle this scene size, but that needs a real-device check (Chrome DevTools remote performance trace). The adaptive pixel ratio is the safety valve.
- The lazy 3D chunk is 626 kB (161 kB gzip), up ~1 kB of app code plus `BufferGeometryUtils` from Three's own addons; precache is 18 entries / 1104.8 KiB (was 1044 KiB). No new dependencies, no CDN.

## Verification

The gate below was re-run after the animation upgrade (see the end of this section for the latest numbers).

Final gate (previous polish pass), run 2026-11-08 on Linux, Node 24, Google Chrome via playwright-core (phone 390×844 @2x and desktop 1280×800, light and dark). All commands exited 0.

- Unit tests (Vitest, 62): domain logic, including the new session, daily-validation, backup-hardening and photo-decoding tests.
- e2e (`npm run e2e`, 27 steps / 55 assertions, no browser console errors): the whole session flow, rest timer (auto-start, ±15 s, pause/resume, end vibration, paused-rest regression), resume after reload, swaps, 4-day schedule + programme swap/edit with reload, weights list, theme persistence, backup export/reset/import, Garmin CSV preview/merge, bad backup and bad CSV errors, offline reload through the service worker, fresh-install empty states, reduced motion, storage blocked, WebGL unavailable, keyboard skip link and sheet focus trap/return. It writes 48 screenshots to `screenshots/`, which were reviewed by eye.
- Base path (`npm run build:pages && npm run e2e:pages`): `dist/` served under `http://localhost:4180/restart-fitness/`, and the same suite runs without screenshot steps (23 steps / 55 assertions), including offline via the service worker. The manifest has `start_url`, `scope` and `id` set to `/restart-fitness/`; icons are relative; the script, CSS, fonts and the lazy 3D chunk resolve under `/restart-fitness/assets/`; the service worker is registered at `/restart-fitness/sw.js` with that scope.

```
$ npm run lint
> restart-fitness@1.0.0 lint
> eslint .

exit=0

$ npm run typecheck
> restart-fitness@1.0.0 typecheck
> tsc -p .

exit=0

$ npm test
 Test Files  7 passed (7)
      Tests  62 passed (62)
exit=0

$ npm run build
ok built in 422ms
precache  18 entries (1044.01 KiB)
exit=0

$ npm run e2e
PASS  first run shows a next session and empty logs
PASS  keyboard: skip link, sheet focus moves in, Escape closes and returns focus
PASS  quick log rejects out-of-range values with a field error
PASS  quick daily log saves weight, steps, sleep, waist
PASS  warm-up: timer runs, next move, skip
PASS  lift: 3D mannequin renders, suggestion, steppers, RPE, log set, rest timer
PASS  resume an interrupted session after reload
PASS  swap exercise for today only
PASS  log every set and finish lifts
PASS  finisher interval timer, then cool-down, summary, save
PASS  progress shows the logged lift and body data
PASS  change schedule to 4 days and swap in the programme
PASS  weights list: add and remove
PASS  theme toggle persists after reload
PASS  export backup, reset, import restores
PASS  Garmin CSV import: preview and merge
PASS  bad backup file and bad CSV show clear errors and change nothing
PASS  offline reload via service worker
PASS  empty states (fresh install, light)
PASS  empty states (fresh install, dark)
PASS  reduced motion: demonstration starts paused and can be played
PASS  storage blocked: clear error screen
PASS  3D unavailable: session still usable with cues
PASS  screenshots phone light
PASS  screenshots phone dark
PASS  screenshots desktop light
PASS  screenshots desktop dark
27 steps, 55 assertions
exit=0

$ npm run build:pages && npm run e2e:pages
ok built in 425ms
precache  18 entries (1044.18 KiB)
Serving dist under http://localhost:4180/restart-fitness/
PASS  quick daily log saves weight, steps, sleep, waist
23 steps, 55 assertions
exit=0
```

### Latest gate (after the animation upgrade)

All commands exited 0: `npm run lint`, `npm run typecheck`, `npm test` (8 files, 276 tests), `npm run build` (precache 18 entries, 1104.82 KiB), `npm run e2e` (27 steps, 55 assertions, 48 screenshots refreshed), `npm run build:pages && npm run e2e:pages` (23 steps, 55 assertions).

## Known limitations

- Animation: poses are hand-authored joint angles plus IK, not motion capture; a few moves are stylised (side plank is shown straight-arm on the floor contact, the march arm swing is generous, the child's pose keeps the hips slightly low). Grips use a rotating fist rather than separate fingers. Clipping checks are heuristic (contact points vs floor/bench pad); arm-through-torso intersection is checked visually, not automatically.
- Animation performance has only been measured in software-rendered headless Chrome (see above); not on a physical Android device.

- The rest timer's paused state lives in memory: after a reload during a paused rest, the rest is cleared (a running rest survives reloads because its end time is stored).
- The warm-up, cool-down and finisher timers restart their current move or interval after a reload (the position in the move list is kept). Persisting them is a small follow-up (store a start timestamp like the rest timer does).
- Background alerts: if Android suspends Chrome with the screen off, the end-of-rest beep and vibration fire when the app is visible again. The wake lock keeps the screen on during a session to avoid this.
- The 3D mannequin needs WebGL; without it a clear fallback is shown and the cues remain.
- Garmin import is CSV-only (no live sync), by design, because the app makes no network calls.
- Volume (kg lifted) counts weight × reps per logged set using kg per dumbbell; it does not double for two-dumbbell lifts.
- Verified in desktop Chrome with phone emulation (390×844) and at 1280×800; not yet tried on a physical Android device in this pass.

## Decisions

- **Programme PDF not found**, so the programme was designed from scratch: 3 full-body sessions (A/B/C) of squat/lunge, push, pull, hip hinge, arms and core, 45 to 60 min, Mon to Wed by default.
- **Loads are kg per dumbbell** everywhere (suggestions, steppers, history, e1RM).
- **Default weights list**: 2.5 to 40 kg in 2.5 kg steps plus 41 kg (the adjustable dumbbells' maximum); editable in Settings.
- **Rest auto-starts when a set is logged** (toggle in Settings); not after the last open set of the session; re-logging a corrected set doesn't restart it.
- **Swaps are today-only or always**: "Today only" changes the current session; "Always" also stores the swap in the programme. Swaps stay within the same movement pattern so weekly balance holds.
- **Import keeps existing photos if the backup has none**; otherwise the backup's photos replace them.
- **The finisher rotates** across sessions (different interval finisher per session) and is optional (Settings toggle, skip button).
- **Box breathing is part of the cool-down** (last move).
- **Rest pause state is not persisted** (see limitations); a running rest is.
- **Theme is mirrored to localStorage** so the pre-paint script can apply it before IndexedDB loads (no flash), and it wins if an IndexedDB write didn't land.
- Steps and sleep show weekly averages once there are more than 21 daily points; daily dots were unreadable noise.
- Under prefers-reduced-motion the 3D demonstration starts paused on a mid-movement frame (one tap to play), rather than being removed, because it is instructional.
- Desktop (≥900 px) uses a left side rail instead of the bottom tab bar.
- Quick-log ranges (weight 30 to 300 kg, waist 40 to 250 cm, sleep 0 to 24 h, steps 0 to 100,000) catch typos; an emptied field removes that day's stored value.
- Screenshots in `screenshots/` are committed as a review artifact; they use generic demo data from `e2e/demo-data.mjs` only.
