import { useState } from 'preact/hooks';
import { Play, RotateCcw, Footprints, Moon, Scale, Ruler, Flame, Check, ChevronRight, CalendarDays, Clock, Trophy } from 'lucide-preact';
import { active, dailyFor, lastValue, notify, saveDaily, sessions, startWorkout, workouts, program } from '../../data/store';
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
    await startWorkout(s.index);
    go('session');
  };

  const whenLabel = next ? ({ today: 'Today', 'catch-up': 'Catch up', upcoming: WEEKDAY_LONG[weekdayOf(parseIso(next.date))], 'next-week': `Next week · ${fmtShort(next.date)}` } as const)[next.when] : '';

  return (
    <main class="page two-col" id="main">
      <header class="page-head full">
        <div>
          <div class="eyebrow">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>Today</h1>
        </div>
        <span class="chip accent" title="Sessions this week"><Check size={14} /> {doneThisWeek}/{plan.length} this week</span>
      </header>

      {active.value ? (
        <button class="banner full" style={{ border: 0, textAlign: 'left' }} onClick={() => go('session')} data-testid="resume">
          <RotateCcw size={22} />
          <div class="grow"><strong>Resume {active.value.sessionName}</strong><span class="small">Started {new Date(active.value.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · progress saved</span></div>
          <ChevronRight size={22} />
        </button>
      ) : null}

      {next ? (
        <section class="card accent stack" aria-labelledby="next-h">
          <div class="row between">
            <span class="eyebrow">{whenLabel}</span>
            <span class="chip outline"><Clock size={13} /> ~{estimateMinutes(next.session)} min</span>
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
            <Play size={20} /> Start session
          </button>
          <button class="btn ghost" onClick={() => setPicker(true)}>Choose a different session</button>
        </section>
      ) : null}

      <div class="stack">
        <section class="card" aria-labelledby="week-h">
          <div class="card-head"><h2 id="week-h">This week</h2><span class="small muted">{streak > 0 ? <><Trophy size={14} style={{ verticalAlign: '-2px' }} /> {streak}-week streak</> : 'Build your streak'}</span></div>
          <div class="week" role="list">
            {week.map((d) => (
              <div role="listitem" key={d.date} class={`day ${d.planned ? 'planned' : ''} ${d.done ? 'done' : ''} ${d.isToday ? 'today' : ''}`} aria-label={`${WEEKDAY_LONG[d.weekday]}${d.planned ? `, ${d.planned.name}` : ', rest'}${d.done ? ', done' : ''}`}>
                <span>{WEEKDAY_SHORT[d.weekday].slice(0, 1)}</span>
                <span class="dot">{d.done ? <Check size={16} /> : parseIso(d.date).getDate()}</span>
              </div>
            ))}
          </div>
          <div class="progress-bar" style={{ marginTop: 'var(--s3)' }} aria-hidden="true"><div style={{ width: `${Math.min(100, (doneThisWeek / plan.length) * 100)}%` }} /></div>
        </section>

        <QuickLog date={today} />

        <section class="card stack-sm" aria-labelledby="g-h">
          <div class="card-head" style={{ marginBottom: 0 }}><h2 id="g-h">Daily targets</h2><Flame size={18} class="muted" /></div>
          <div class="small"><strong>{GUIDANCE.calories}</strong> · {GUIDANCE.protein}</div>
          <div class="small muted">{GUIDANCE.walk}</div>
        </section>
      </div>

      {picker ? (
        <Sheet title="Choose a session" onClose={() => setPicker(false)}>
          <div class="stack-sm">
            {plan.map((s) => (
              <button key={s.index} class="alt" onClick={() => { setPicker(false); void begin(s); }} disabled={!!active.value}>
                <CalendarDays size={20} class="muted" />
                <div class="grow"><strong>{s.name}</strong><div class="xs muted">{WEEKDAY_LONG[s.weekday]} · {s.slots.length} exercises · ~{estimateMinutes(s)} min</div></div>
                <Play size={18} />
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
  const [weight, setWeight] = useState(cur?.weight?.toString() ?? '');
  const [steps, setSteps] = useState(cur?.steps?.toString() ?? '');
  const [sleep, setSleep] = useState(cur?.sleepH?.toString() ?? '');
  const [waist, setWaist] = useState(cur?.waist?.toString() ?? '');
  const weekAgo = isoDate(addDays(new Date(), -6));
  const waistDue = !dailyForRange(weekAgo, props.date);

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));
  const save = async (e: Event) => {
    e.preventDefault();
    const patch = { weight: num(weight), steps: num(steps), sleepH: num(sleep), waist: num(waist) };
    if (Object.values(patch).some((v) => v != null && (Number.isNaN(v) || v < 0))) { notify('Check the numbers — only positive values', 'err'); return; }
    await saveDaily(props.date, patch);
    notify('Saved today’s log');
  };
  const ph = (k: 'weight' | 'steps' | 'sleepH' | 'waist') => { const v = lastValue(k); return v != null ? `last ${v}` : ''; };

  return (
    <form class="card stack" onSubmit={save} aria-labelledby="ql-h">
      <div class="card-head" style={{ marginBottom: 0 }}><h2 id="ql-h">Quick log</h2><span class="small muted">{cur ? 'Logged today' : 'Takes 10 seconds'}</span></div>
      <div class="grid2">
        <Metric icon={<Scale size={16} />} label="Body weight" unit="kg" value={weight} onInput={setWeight} placeholder={ph('weight')} step="0.1" testid="ql-weight" />
        <Metric icon={<Footprints size={16} />} label="Steps" unit="" value={steps} onInput={setSteps} placeholder={ph('steps')} step="1" testid="ql-steps" />
        <Metric icon={<Moon size={16} />} label="Sleep" unit="h" value={sleep} onInput={setSleep} placeholder={ph('sleepH')} step="0.25" testid="ql-sleep" />
        <Metric icon={<Ruler size={16} />} label={waistDue ? 'Waist · due' : 'Waist (weekly)'} unit="cm" value={waist} onInput={setWaist} placeholder={ph('waist')} step="0.5" testid="ql-waist" />
      </div>
      <button class="btn primary block" type="submit" data-testid="ql-save">Save</button>
    </form>
  );
}

function dailyForRange(from: string, to: string): boolean {
  for (let d = parseIso(from); isoDate(d) <= to; d = addDays(d, 1)) if (dailyFor(isoDate(d))?.waist != null) return true;
  return false;
}

function Metric(props: { icon: preact.JSX.Element; label: string; unit: string; value: string; onInput: (v: string) => void; placeholder: string; step: string; testid: string }) {
  const id = `m-${props.testid}`;
  return (
    <div class="field">
      <label for={id} class="row" style={{ gap: '6px' }}>{props.icon}{props.label}</label>
      <div class="input-unit">
        <input id={id} class="input num" inputMode="decimal" type="number" min="0" step={props.step} value={props.value} placeholder={props.placeholder} data-testid={props.testid}
          onInput={(e) => props.onInput((e.target as HTMLInputElement).value)} />
        {props.unit ? <span>{props.unit}</span> : null}
      </div>
    </div>
  );
}
