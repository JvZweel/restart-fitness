import { useState } from 'preact/hooks';
import { Play, RotateCcw, Footprints, Moon, Scale, Ruler, Flame, Check, ChevronRight, CalendarDays, Clock, Trophy, Sparkles } from 'lucide-preact';
import { active, dailyFor, lastValue, notify, saveDaily, sessions, startWorkout, workouts, program } from '../../data/store';
import { validateDaily, type DailyKey } from '../../domain/daily';
import { nextSession, weekStatus, weekStreak } from '../../domain/stats';
import { estimateMinutes, GUIDANCE, WEEKDAY_LONG, WEEKDAY_SHORT } from '../../domain/program';
import { getExercise } from '../../domain/exercises';
import { addDays, fmtShort, isoDate, parseIso, weekdayOf } from '../../domain/dates';
import { go } from '../router';
import { Sheet } from '../components';
import { unlockAudio } from '../feedback';
import type { SessionPlan } from '../../domain/types';

export function Today() {
  const now = new Date();
  const today = isoDate(now);
  const plan = sessions.value;
  const week = weekStatus(now, plan, workouts.value);
  const next = nextSession(now, plan, workouts.value);
  const doneThisWeek = week.reduce((a, d) => a + d.done, 0);
  const streak = weekStreak(now, program.value.weekdays.length, workouts.value);
  const [picker, setPicker] = useState(false);

  const begin = async (s: SessionPlan) => {
    unlockAudio();
    try {
      await startWorkout(s.index);
      go('session');
    } catch {
      notify('Couldn’t start the session: storage is unavailable.', 'err');
    }
  };
  const firstRun = workouts.value.length === 0 && !active.value;

  const whenLabel = next ? ({ today: 'Today', 'catch-up': 'Catch up', upcoming: WEEKDAY_LONG[weekdayOf(parseIso(next.date))], 'next-week': `Next week · ${fmtShort(next.date)}` } as const)[next.when] : '';

  return (
    <main class="page two-col" id="main">
      <header class="page-head full">
        <div>
          <div class="eyebrow">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>Today</h1>
        </div>
        <span class="chip accent" data-testid="week-count"><Check size={14} aria-hidden="true" /> {doneThisWeek}/{plan.length} this week</span>
      </header>

      {active.value ? (
        <button class="banner full" style={{ border: 0, textAlign: 'left' }} onClick={() => go('session')} data-testid="resume">
          <RotateCcw size={22} aria-hidden="true" />
          <div class="grow"><strong>Resume {active.value.sessionName}</strong><span class="small">Started at {new Date(active.value.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Everything you logged is saved.</span></div>
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      ) : null}

      {firstRun ? (
        <section class="card welcome full" aria-labelledby="welcome-h" data-testid="welcome">
          <Sparkles size={22} aria-hidden="true" />
          <div class="stack-sm">
            <h2 id="welcome-h">Your first session is ready</h2>
            <p class="small muted" style={{ margin: 0 }}>Each session is a short mobility warm-up, seven dumbbell lifts with a demonstration, and a cool-down. Weights start light. Log how hard each set felt and the app works out the next session’s weights for you.</p>
          </div>
        </section>
      ) : null}

      {next ? (
        <section class="card accent stack" aria-labelledby="next-h">
          <div class="row between">
            <span class="eyebrow">{whenLabel}</span>
            <span class="chip outline"><Clock size={13} aria-hidden="true" /> about {estimateMinutes(next.session)} min</span>
          </div>
          <h2 id="next-h" style={{ fontSize: 'var(--t-2xl)' }}>{next.session.name}</h2>
          <ol class="list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {next.session.slots.map((slot) => {
              const ex = getExercise(slot.exerciseId);
              return (
                <li key={slot.key} class="row between" style={{ padding: '8px 0' }}>
                  <span class="ellipsis">{ex.name}</span>
                  <span class="small muted num" style={{ flex: 'none' }}>{slot.sets} × {slot.repMin}–{slot.repMax}{ex.timed ? 's' : ''}</span>
                </li>
              );
            })}
          </ol>
          <button class="btn primary lg block" onClick={() => begin(next.session)} disabled={!!active.value} data-testid="start-session">
            <Play size={20} aria-hidden="true" /> Start session
          </button>
          <button class="btn ghost" onClick={() => setPicker(true)}>Choose a different session</button>
        </section>
      ) : null}

      <div class="stack">
        <section class="card" aria-labelledby="week-h">
          <div class="card-head"><h2 id="week-h">This week</h2><span class="small muted">{streak > 0 ? <><Trophy size={14} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> {streak}-week streak</> : `${plan.length} sessions planned`}</span></div>
          <div class="week" role="list">
            {week.map((d) => (
              <div role="listitem" key={d.date} class={`day ${d.planned ? 'planned' : ''} ${d.done ? 'done' : ''} ${d.isToday ? 'today' : ''}`} aria-current={d.isToday ? 'date' : undefined}>
                <span aria-hidden="true">{WEEKDAY_SHORT[d.weekday].slice(0, 1)}</span>
                <span class="dot" aria-hidden="true">{d.done ? <Check size={16} /> : parseIso(d.date).getDate()}</span>
                <span class="sr-only">{WEEKDAY_LONG[d.weekday]} {parseIso(d.date).getDate()}: {d.planned ? d.planned.name : 'rest day'}{d.done ? ', done' : ''}</span>
              </div>
            ))}
          </div>
          <div class="progress-bar" style={{ marginTop: 'var(--s3)' }} aria-hidden="true"><div style={{ width: `${Math.min(100, (doneThisWeek / plan.length) * 100)}%` }} /></div>
        </section>

        <QuickLog date={today} />

        <section class="card stack-sm" aria-labelledby="g-h">
          <div class="card-head" style={{ marginBottom: 0 }}><h2 id="g-h">Daily targets</h2><Flame size={18} class="muted" aria-hidden="true" /></div>
          <div class="small"><strong>{GUIDANCE.calories}</strong> · {GUIDANCE.protein}</div>
          <div class="small muted">{GUIDANCE.walk}</div>
        </section>
      </div>

      {picker ? (
        <Sheet title="Choose a session" onClose={() => setPicker(false)}>
          <div class="stack-sm">
            {plan.map((s) => (
              <button key={s.index} class="alt" onClick={() => { setPicker(false); void begin(s); }} disabled={!!active.value}>
                <CalendarDays size={20} class="muted" aria-hidden="true" />
                <div class="grow"><strong>{s.name}</strong><div class="xs muted">{WEEKDAY_LONG[s.weekday]}, {s.slots.length} exercises, about {estimateMinutes(s)} min</div></div>
                <Play size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
    </main>
  );
}

function QuickLog(props: { date: string }) {
  const cur = dailyFor(props.date);
  const [vals, setVals] = useState<Record<DailyKey, string>>({
    weight: cur?.weight?.toString() ?? '', steps: cur?.steps?.toString() ?? '', sleepH: cur?.sleepH?.toString() ?? '', waist: cur?.waist?.toString() ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<DailyKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const weekAgo = isoDate(addDays(new Date(), -6));
  const waistDue = !dailyForRange(weekAgo, props.date);
  const set = (k: DailyKey) => (v: string) => { setVals({ ...vals, [k]: v }); if (errors[k]) setErrors({ ...errors, [k]: undefined }); };

  const save = async (e: Event) => {
    e.preventDefault();
    const { patch, errors: errs } = validateDaily(vals);
    setErrors(errs);
    if (Object.keys(errs).length) {
      notify('Check the highlighted values', 'err');
      (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus();
      return;
    }
    if (!Object.keys(patch).length && !cur) { notify('Enter at least one value to save', 'err'); return; }
    setSaving(true);
    try {
      // Cleared fields remove the stored value.
      await saveDaily(props.date, { weight: patch.weight, steps: patch.steps, sleepH: patch.sleepH, waist: patch.waist });
      notify('Saved today’s log');
    } catch {
      notify('Couldn’t save: storage is unavailable', 'err');
    } finally { setSaving(false); }
  };
  const ph = (k: DailyKey) => { const v = lastValue(k); return v != null ? `last ${v}` : ''; };

  return (
    <form class="card stack" onSubmit={save} aria-labelledby="ql-h" noValidate>
      <div class="card-head" style={{ marginBottom: 0 }}><h2 id="ql-h">Quick log</h2><span class="small muted">{cur ? 'Logged today' : 'For today'}</span></div>
      <div class="grid2">
        <Metric icon={<Scale size={16} />} label="Body weight" unit="kg" value={vals.weight} onInput={set('weight')} placeholder={ph('weight')} step="0.1" testid="ql-weight" error={errors.weight} />
        <Metric icon={<Footprints size={16} />} label="Steps" unit="" value={vals.steps} onInput={set('steps')} placeholder={ph('steps')} step="1" testid="ql-steps" error={errors.steps} />
        <Metric icon={<Moon size={16} />} label="Sleep" unit="h" value={vals.sleepH} onInput={set('sleepH')} placeholder={ph('sleepH')} step="0.25" testid="ql-sleep" error={errors.sleepH} />
        <Metric icon={<Ruler size={16} />} label={waistDue ? 'Waist, due' : 'Waist, weekly'} unit="cm" value={vals.waist} onInput={set('waist')} placeholder={ph('waist')} step="0.5" testid="ql-waist" error={errors.waist} />
      </div>
      <button class="btn primary block" type="submit" disabled={saving} data-testid="ql-save">{saving ? 'Saving' : 'Save'}</button>
    </form>
  );
}

function dailyForRange(from: string, to: string): boolean {
  for (let d = parseIso(from); isoDate(d) <= to; d = addDays(d, 1)) if (dailyFor(isoDate(d))?.waist != null) return true;
  return false;
}

function Metric(props: { icon: preact.JSX.Element; label: string; unit: string; value: string; onInput: (v: string) => void; placeholder: string; step: string; testid: string; error?: string }) {
  const id = `m-${props.testid}`;
  return (
    <div class="field">
      <label for={id} class="row" style={{ gap: '6px' }}><span aria-hidden="true" style={{ display: 'contents' }}>{props.icon}</span>{props.label}{props.unit ? <span class="sr-only"> in {props.unit === 'h' ? 'hours' : props.unit}</span> : null}</label>
      <div class="input-unit">
        <input id={id} class="input num" inputMode="decimal" type="text" autoComplete="off" value={props.value} placeholder={props.placeholder} data-testid={props.testid}
          aria-invalid={props.error ? 'true' : undefined} aria-describedby={props.error ? `${id}-err` : undefined}
          onInput={(e) => props.onInput((e.target as HTMLInputElement).value)} />
        {props.unit ? <span aria-hidden="true">{props.unit}</span> : null}
      </div>
      {props.error ? <div id={`${id}-err`} class="field-err">{props.error}</div> : null}
    </div>
  );
}
