# Restart Fitness

A private, offline training companion for Android Chrome. It is built for someone restarting strength training at home with adjustable dumbbells (up to 41 kg) and an adjustable bench, training three evenings a week.

- **Guided sessions.** Each session has a timed mobility warm-up, then full-body dumbbell lifts with a 3D demonstration, form cues and target muscles. Then an optional interval finisher and a flexibility cool-down with box breathing.
- **Set logging.** Steppers for weight, reps and RPE (how hard it felt). Weights only come from your own dumbbell list.
- **Rest timer.** Starts automatically when you log a set. You can pause, add or remove 15 s, and it vibrates and beeps at the end. The screen stays on during a session.
- **Automatic progression.** Next session's weight and reps are worked out from your last session (double progression).
- **Programme editor.** Pick 2 to 5 training days; sessions re-balance so every day stays full-body. You can swap exercises (today only, or always) and edit sets and rep ranges.
- **Progress.** Strength trend per lift, plus charts for body weight, waist, steps and sleep, and a weekly photo timeline.
- **Daily log.** Weight, steps, sleep and a weekly waist measurement in a few seconds, or import steps, sleep and weight from Garmin.
- **Privacy.** Everything stays on the phone. No account, no server, no analytics, and the app makes no network requests.

## Run locally (under a minute)

Requires Node 20 or newer.

```bash
npm ci
npm run dev        # http://localhost:5173 (also reachable on your LAN for testing on a phone)
```

## Build, test, check

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript (strict)
npm test           # Vitest unit tests (domain logic: progression, scheduling, backup, Garmin CSV, session)
npm run build      # Production build into dist/ (with service worker for offline use)
npm run preview    # Serve dist/ at http://localhost:4173
npm run check      # lint + typecheck + test + build
```

### End-to-end tests

The e2e suite drives the production build in system Chrome (`/usr/bin/google-chrome`, override with `CHROME=/path/to/chrome`) via `playwright-core`. It covers the full session flow, the rest timer, resuming after a reload, swaps, the schedule editor, theme persistence, backup export/import, Garmin import, error states, keyboard and focus behaviour, reduced motion and offline use.

```bash
npm run build && npm run e2e              # also writes screenshots/ (phone + desktop, light + dark)
SHOTS=0 npm run e2e                       # skip screenshots
npm run build:pages && npm run e2e:pages  # same suite against the /restart-fitness/ base-path build
```

If the e2e reports that port 4173 is busy, a previous preview is still running. Stop it with `pkill -f "vite[.]js preview"` (the brackets stop `pkill` from matching its own command line).

### Hosting under a sub-path (for example GitHub Pages)

`npm run build:pages` builds with `BASE_PATH=/restart-fitness/`. The manifest `start_url`/`scope`, icons, service worker, fonts and code chunks all follow the base path. Any static host works; serve `dist/` over HTTPS (service workers need HTTPS, except on `localhost`).

## Install on Android (Chrome)

1. Open the app's URL in Chrome on the phone.
2. Tap the menu **⋮** and choose **Install app** (or **Add to Home screen**). Settings also shows an **Install app** button when Chrome offers one.
3. Launch it from the home-screen icon. After the first load it works fully offline: Settings → App shows **Offline: Ready**.

## Back up your data

Your data lives only in the browser storage on your phone. Uninstalling the app, clearing Chrome's site data or losing the phone deletes it.

- Every few weeks, go to **Settings → Backup → Export**. This downloads a `.json` file with your logs, programme and settings (and photos, if the switch is on).
- Keep the file somewhere safe, such as Google Drive or your computer.
- To restore, use **Settings → Backup → Import**. This replaces the data on the phone. If the backup has no photos, the photos already on the phone are kept.

## Data privacy

- No account, no sign-in, no tracking, no ads.
- The app never sends data anywhere. After installation it doesn't use the network at all; the service worker only serves the app's own files.
- Progress photos are compressed and stored on the phone only.
- A backup file contains your training and body data in plain JSON, so store it like any personal document.

## Import from Garmin Connect

1. On a computer, open Garmin Connect (connect.garmin.com) in a browser and sign in.
2. Go to **Reports** (the chart icon in the side menu) and choose **Steps**, **Sleep** or **Weight**.
3. Choose a range (for example 4 weeks or 1 year) and select **Export CSV** (top right).
4. Move the file to the phone (email, Drive or USB). In the app, go to **Settings → Garmin import → Choose Garmin CSV**.
5. Check the preview and select **Merge**. Days are matched by date. By default only empty days are filled; turn on **Replace values I typed in** to let Garmin values win.

The parser handles comma, semicolon and tab separators, US/EU/ISO dates, durations like `7h 12m`, and weights in kg or lb.

## Project layout

```
src/domain/   pure logic + types (exercises, programme re-balancing, progression, weights, Garmin CSV, backup, stats, session)
src/data/     IndexedDB (idb) access and app state (Preact signals)
src/anim/     Three.js mannequin, keyframed moves, viewer
src/ui/       screens (Today, Session, Programme, Progress, Settings) and shared components
test/         Vitest unit tests
e2e/          Playwright (playwright-core) end-to-end run + generic demo data
```

See [STATUS.md](STATUS.md) for what is done, how it was verified, known limitations and design decisions.
