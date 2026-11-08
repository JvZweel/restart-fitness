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

## Verification

Final gate, run 2026-11-08 on Linux, Node 24, Google Chrome via playwright-core (phone 390×844 @2x and desktop 1280×800, light and dark). All commands exited 0.

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

## Known limitations

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
