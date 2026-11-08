// Generic demo history for screenshots / e2e (NOT anyone's real data).
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function demoBackup(weeks = 6, today = new Date()) {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const start = new Date(monday); start.setDate(start.getDate() - weeks * 7);
  const workouts = [];
  const daily = [];
  const plan = [
    [['knee:0', 'goblet-squat', 15, 3], ['push:0', 'flat-db-press', 15, 3], ['pull:0', 'one-arm-row', 17.5, 3], ['hinge:0', 'db-rdl', 15, 3], ['biceps:0', 'hammer-curl', 7.5, 2], ['triceps:0', 'overhead-triceps', 10, 2], ['core:0', 'dead-bug', 0, 2]],
    [['knee:1', 'bulgarian-split-squat', 7.5, 3], ['push:1', 'seated-shoulder-press', 10, 3], ['pull:1', 'chest-supported-row', 12.5, 3], ['hinge:1', 'hip-thrust', 20, 3], ['core:1', 'side-plank', 0, 2]],
    [['knee:2', 'reverse-lunge', 7.5, 3], ['push:2', 'incline-db-press', 12.5, 3], ['pull:2', 'db-pullover', 12.5, 3], ['hinge:2', 'sumo-deadlift', 22.5, 3], ['biceps:1', 'incline-curl', 5, 2], ['triceps:1', 'skull-crusher', 7.5, 2], ['core:2', 'reverse-crunch', 0, 2]],
  ];
  const steps = [2.5, 2.5, 2.5, 2.5];
  for (let w = 0; w < weeks; w++) {
    for (let s = 0; s < 3; s++) {
      const d = new Date(start); d.setDate(d.getDate() + w * 7 + s);
      const t = new Date(d); t.setHours(18, 30);
      workouts.push({
        id: `demo-${w}-${s}`, date: iso(d), startedAt: t.getTime(), finishedAt: t.getTime() + 52 * 60000, sessionIndex: s, sessionName: `Full Body ${'ABC'[s]}`,
        phase: 'summary', cursor: 0, warmupDone: true, finisherDone: w % 2 ? true : null, cooldownDone: true, restEndsAt: null, notes: '',
        exercises: plan[s].map(([key, id, base, sets]) => {
          const inc = base ? Math.floor(w / 2) * steps[0] : 0;
          const reps = 8 + (w % 2) * 2 + (s === 0 ? 1 : 0);
          return { key, exerciseId: id, sets: Array.from({ length: sets }, (_, k) => ({ weight: base + inc, reps: id === 'side-plank' ? 30 + w * 2 : reps - (k === sets - 1 ? 1 : 0), rpe: 7 + (k === sets - 1 ? 1 : 0), done: true })) };
        }),
      });
    }
    for (let k = 0; k < 7; k++) {
      const d = new Date(start); d.setDate(d.getDate() + w * 7 + k);
      const day = { date: iso(d), steps: 6500 + Math.round(Math.sin(w * 7 + k) * 1800 + w * 250), sleepH: Math.round((6.4 + Math.cos(k) * 0.5) * 10) / 10, weight: Math.round((96 - (w * 7 + k) * 0.08 + Math.sin(k) * 0.3) * 10) / 10, source: 'manual' };
      if (k === 0) day.waist = Math.round((104 - w * 0.6) * 10) / 10;
      daily.push(day);
    }
  }
  return {
    app: 'restart-fitness', version: 1, exportedAt: new Date().toISOString(),
    settings: { theme: 'system', units: 'kg', weights: [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 41], restCompoundSec: 120, restAccessorySec: 75, autoRest: true, sound: true, vibrate: true, warmupSec: 40, cooldownSec: 40, showFinisher: true },
    program: { weekdays: [0, 1, 2], swaps: {}, edits: {} }, workouts, daily,
  };
}
