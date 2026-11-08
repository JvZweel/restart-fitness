import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { X, ChevronLeft, ChevronRight, Play, Pause, SkipForward, SkipBack, Check, Plus, Minus, Repeat2, Timer, Info, Trophy, Dumbbell, Zap, Wind, CircleDashed, AlertTriangle } from 'lucide-preact';
import { active, discardWorkout, finishWorkout, notify, planForActive, settings, suggestionFor, updateActive, updateProgram, program, workouts, dailyFor } from '../../data/store';
import { alternativesFor, COOLDOWN, FINISHER_BY_ID, FINISHERS, getExercise, MOVE_MUSCLES, PATTERN_LABEL, WARMUP } from '../../domain/exercises';
import { nextDown, nextUp } from '../../domain/weights';
import { fmtClock, isoDate } from '../../domain/dates';
import { e1rm } from '../../domain/progression';
import { liftHistory, workoutVolume } from '../../domain/stats';
import { applyLogSet, nextOpenSet } from '../../domain/session';
import type { Exercise, GuidedMove, Phase, SetLog, SlotPrescription, WorkoutLog } from '../../domain/types';
import { AnimStage, Confirm, Empty, MuscleChips, Sheet, Stepper } from '../components';
import { beep, buzz, holdWakeLock, unlockAudio } from '../feedback';
import { useNow } from '../hooks';
import { go } from '../router';

const PHASES: { id: Phase; label: string }[] = [
  { id: 'warmup', label: 'Warm-up' }, { id: 'lift', label: 'Lifts' }, { id: 'finisher', label: 'Finisher' }, { id: 'cooldown', label: 'Cool-down' },
];
const ORDER: Phase[] = ['warmup', 'lift', 'finisher', 'cooldown', 'summary'];

function slotFor(w: WorkoutLog, i: number): SlotPrescription {
  const log = w.exercises[i];
  const plan = planForActive();
  const fromPlan = plan?.slots.find((s) => s.key === log.key);
  const ex = getExercise(log.exerciseId);
  const s = settings.value;
  if (fromPlan) return { ...fromPlan, exerciseId: log.exerciseId, ...(fromPlan.exerciseId !== log.exerciseId ? { repMin: ex.repMin, repMax: ex.repMax } : {}) };
  const main = ['knee', 'hinge', 'push', 'pull'].includes(ex.pattern);
  return { key: log.key, pattern: ex.pattern, exerciseId: ex.id, sets: log.sets.length, repMin: ex.repMin, repMax: ex.repMax, targetRpe: 8, restSec: main ? s.restCompoundSec : s.restAccessorySec };
}

export function Session() {
  const w = active.value;
  useEffect(() => holdWakeLock(), []);
  const [leave, setLeave] = useState(false);
  const [discard, setDiscard] = useState(false);
  const now = useNow(1000);
  const phase = w?.phase;
  useEffect(() => { window.scrollTo(0, 0); }, [phase]);

  if (!w) {
    return (
      <main class="page" id="main">
        <Empty icon={<Dumbbell size={26} />} title="No session in progress" body="Start today’s session from the Today tab.">
          <button class="btn primary" onClick={() => go('today')}>Go to Today</button>
        </Empty>
      </main>
    );
  }

  const phaseIdx = ORDER.indexOf(w.phase);
  const setPhase = (phase: Phase, extra: Partial<WorkoutLog> = {}) => updateActive((x) => ({ ...x, ...extra, phase, cursor: 0, restEndsAt: null }));

  return (
    <div class="player">
      <header class="player-top">
        <div class="inner">
          <div class="row between">
            <button class="icon-btn plain" aria-label="Leave session" onClick={() => setLeave(true)} data-testid="leave"><X size={24} aria-hidden="true" /></button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700 }} role="heading" aria-level={2}>{w.sessionName}</div>
              <div class="xs muted num" data-testid="elapsed">{fmtClock((now - w.startedAt) / 1000)} elapsed</div>
            </div>
            <span style={{ width: 'var(--tap)' }} />
          </div>
          <ol class="phases" aria-label="Session progress">
            {PHASES.map((p, i) => (
              <li key={p.id} class={i < phaseIdx ? 'done' : i === phaseIdx ? 'current' : ''} aria-current={i === phaseIdx ? 'step' : undefined}>
                <i aria-hidden="true" />{p.label}{i < phaseIdx ? <span class="sr-only"> (done)</span> : null}
              </li>
            ))}
          </ol>
        </div>
      </header>

      {w.phase === 'warmup' ? <Guided key="warm" kind="warmup" moves={WARMUP} cursor={w.cursor} defaultSec={settings.value.warmupSec}
        onCursor={(c) => updateActive((x) => ({ ...x, cursor: c }))} onDone={(skipped) => setPhase('lift', { warmupDone: !skipped })} /> : null}
      {w.phase === 'lift' ? <Lifts w={w} onFinish={() => setPhase(settings.value.showFinisher ? 'finisher' : 'cooldown')} /> : null}
      {w.phase === 'finisher' ? <FinisherView w={w} onDone={(done) => setPhase('cooldown', { finisherDone: done ? true : null })} /> : null}
      {w.phase === 'cooldown' ? <Guided key="cool" kind="cooldown" moves={COOLDOWN} cursor={w.cursor} defaultSec={settings.value.cooldownSec}
        onCursor={(c) => updateActive((x) => ({ ...x, cursor: c }))} onDone={(skipped) => setPhase('summary', { cooldownDone: !skipped })} /> : null}
      {w.phase === 'summary' ? <Summary w={w} /> : null}

      {leave ? (
        <Sheet title="Leave session?" onClose={() => setLeave(false)}>
          <p class="muted" style={{ margin: 0 }}>Everything you logged is saved. You can resume from the Today tab.</p>
          <button class="btn primary block" onClick={() => { setLeave(false); go('today'); }} data-testid="leave-keep">Keep for later</button>
          <button class="btn danger block" onClick={() => { setLeave(false); setDiscard(true); }}>Discard session</button>
        </Sheet>
      ) : null}
      {discard ? <Confirm title="Discard this session?" body="The sets you logged in this session will be deleted. This can’t be undone." confirm="Discard" danger
        onConfirm={async () => { try { await discardWorkout(); notify('Session discarded'); } catch { notify('Couldn’t discard: storage is unavailable', 'err'); } go('today'); }} onClose={() => setDiscard(false)} /> : null}
    </div>
  );
}

// ── Warm-up / cool-down ─────────────────────────────────────────
function Guided(props: { kind: 'warmup' | 'cooldown'; moves: GuidedMove[]; cursor: number; defaultSec: number; onCursor: (c: number) => void; onDone: (skipped: boolean) => void }) {
  const idx = Math.min(props.cursor, props.moves.length - 1);
  const move = props.moves[idx];
  const dur = move.perSide || move.seconds >= 60 ? move.seconds : props.defaultSec;
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(dur);
  const now = useNow(250);
  const running = endsAt != null;
  const remaining = running ? Math.max(0, (endsAt - now) / 1000) : left;

  const auto = useRef(false);
  useEffect(() => { setLeft(dur); setEndsAt(auto.current ? Date.now() + dur * 1000 : null); }, [idx, dur]);
  useEffect(() => {
    if (running && remaining <= 0) {
      if (settings.value.sound) beep(1, 660);
      if (settings.value.vibrate) buzz(150);
      if (idx < props.moves.length - 1) { auto.current = true; props.onCursor(idx + 1); } else { auto.current = false; setEndsAt(null); props.onDone(false); }
    }
  }, [running && remaining <= 0]);

  const toggle = () => {
    unlockAudio();
    if (running) { auto.current = false; setLeft(remaining); setEndsAt(null); } else { auto.current = true; setEndsAt(Date.now() + remaining * 1000); }
  };
  const title = props.kind === 'warmup' ? 'Mobility warm-up' : 'Flexibility cool-down';
  const total = props.moves.reduce((a, m) => a + nextDur(m, props.defaultSec), 0);

  return (
    <main class="player-body" id="main">
      <div class="stack sticky-col">
        <div class="row between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div class="eyebrow">{title}, move {idx + 1} of {props.moves.length}</div>
            <h1 class="ex-title" data-testid="move-name">{move.name}</h1>
          </div>
          <span class="chip outline num" title="Total time"><Timer size={13} aria-hidden="true" /> {Math.round(total / 60)} min</span>
        </div>
        <AnimStage fit anim={move.anim} primary={MOVE_MUSCLES[move.id] ?? []} label={move.name} />
      </div>
      <div class="stack">
        <section class="card stack" aria-label="Timer">
          <p class="cue" aria-live="polite">{move.cue}{move.perSide ? <span class="muted"> Switch sides halfway.</span> : null}</p>
          <div class="guided-ctrl">
            <button class="icon-btn" aria-label="Previous move" onClick={() => props.onCursor(Math.max(0, idx - 1))} disabled={idx === 0}><SkipBack size={22} aria-hidden="true" /></button>
            <Ring fraction={remaining / dur} label={fmtClock(remaining)} ending={running && remaining <= 5} testid="guided-timer" size={148} />
            <button class="icon-btn" aria-label={idx < props.moves.length - 1 ? 'Next move' : 'Finish'} onClick={() => (idx < props.moves.length - 1 ? props.onCursor(idx + 1) : props.onDone(false))} data-testid="guided-next"><SkipForward size={22} aria-hidden="true" /></button>
          </div>
          <button class="btn primary lg block" onClick={toggle} data-testid="guided-toggle">{running ? <><Pause size={22} aria-hidden="true" /> Pause</> : <><Play size={22} aria-hidden="true" /> {remaining < dur ? 'Resume' : 'Start'}</>}</button>
        </section>
        <section class="card" aria-label={`${title} moves`}>
          <ol class="moves">
            {props.moves.map((m, i) => (
              <li key={m.id} class={i === idx ? 'current' : i < idx ? 'done' : ''} aria-current={i === idx ? 'step' : undefined}>
                <span class="n num" aria-hidden="true">{i < idx ? <Check size={14} /> : i + 1}</span>
                <span class="grow">{m.name}{i < idx ? <span class="sr-only"> (done)</span> : null}</span><span class="num muted">{fmtClock(nextDur(m, props.defaultSec))}</span>
              </li>
            ))}
          </ol>
        </section>
        <button class="btn secondary block" onClick={() => props.onDone(true)} data-testid="guided-skip">{props.kind === 'warmup' ? 'Skip warm-up' : 'Skip cool-down'}</button>
      </div>
    </main>
  );
}
const nextDur = (m: GuidedMove, def: number) => (m.perSide || m.seconds >= 60 ? m.seconds : def);

function Ring(props: { fraction: number; label: string; ending?: boolean; size?: number; testid?: string }) {
  const size = props.size ?? 200;
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, props.fraction));
  return (
    <div class="ring" style={{ margin: '0 auto' }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" stroke-width="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" stroke-dasharray={`${c * f} ${c}`} style={{ transition: 'stroke-dasharray .25s linear' }} />
      </svg>
      <div class={`timer small ${props.ending ? 'ending' : ''}`} role="timer" aria-live="off" data-testid={props.testid}>{props.label}</div>
    </div>
  );
}

// ── Lifts ──────────────────────────────────────────────────────
const RPE_LABEL: Record<number, string> = { 6: 'easy', 7: '3 left', 8: '2 left', 9: '1 left', 10: 'max' };

function Lifts(props: { w: WorkoutLog; onFinish: () => void }) {
  const w = props.w;
  const cursor = Math.min(w.cursor, w.exercises.length - 1);
  const log = w.exercises[cursor];
  const slot = slotFor(w, cursor);
  const ex = getExercise(log.exerciseId);
  const firstOpen = log.sets.findIndex((s) => !s.done);
  const [sel, setSel] = useState<number>(firstOpen);
  const [swap, setSwap] = useState(false);
  const [info, setInfo] = useState(false);
  useEffect(() => { setSel(log.sets.findIndex((s) => !s.done)); }, [cursor, log.exerciseId]);
  const firstRender = useRef(true);
  useEffect(() => { if (firstRender.current) { firstRender.current = false; return; } window.scrollTo(0, 0); }, [cursor]);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [restEpoch, setRestEpoch] = useState(0); // bumps when logging a set starts a fresh rest
  const sug = useMemo(() => suggestionFor(slot), [slot.exerciseId, slot.repMin, slot.repMax]);
  const weights = settings.value.weights;

  const editSet = (i: number, patch: Partial<SetLog>) => updateActive((x) => {
    const e = x.exercises[cursor];
    e.sets[i] = { ...e.sets[i], ...patch };
    return x;
  });

  const logSet = async (i: number) => {
    unlockAudio();
    await updateActive((x) => applyLogSet(x, cursor, i, { now: Date.now(), restSec: slot.restSec, autoRest: settings.value.autoRest }));
    if (active.value?.restEndsAt && !log.sets[i].done) setRestEpoch((n) => n + 1);
    const sets = active.value?.exercises[cursor]?.sets ?? [];
    const next = nextOpenSet(sets, i);
    setSel(next);
    // The editor disappears once every set is logged: keep keyboard focus on the way forward.
    if (next < 0) requestAnimationFrame(() => nextRef.current?.focus());
  };

  const addSet = () => updateActive((x) => {
    const e = x.exercises[cursor];
    const last = e.sets[e.sets.length - 1] ?? { weight: sug.weight, reps: sug.reps, rpe: null, done: false };
    e.sets.push({ weight: last.weight, reps: last.reps, rpe: null, done: false });
    return x;
  }).then(() => setSel(log.sets.length));
  const removeSet = () => updateActive((x) => {
    const e = x.exercises[cursor];
    const idx = e.sets.map((s) => s.done).lastIndexOf(false);
    if (idx >= 0 && e.sets.length > 1) e.sets.splice(idx, 1);
    return x;
  }).then(() => {
    const sets = active.value?.exercises[cursor]?.sets ?? [];
    if (!sets[sel] || sets[sel].done) setSel(nextOpenSet(sets, -1));
  });

  const goTo = (c: number) => updateActive((x) => ({ ...x, cursor: Math.max(0, Math.min(x.exercises.length - 1, c)) }));
  const allDone = log.sets.every((s) => s.done);
  const last = cursor === w.exercises.length - 1;
  const cur = log.sets[sel] ?? null;
  const unit = ex.timed ? 's' : '';

  return (
    <main class="player-body" id="main">
      <nav class="ex-dots full" aria-label="Exercises in this session">
        {w.exercises.map((e, i) => {
          const complete = e.sets.every((s) => s.done);
          return <button key={e.key} aria-current={i === cursor ? 'step' : undefined} class={complete ? 'complete' : ''} onClick={() => goTo(i)} aria-label={`${getExercise(e.exerciseId).name}${complete ? ', complete' : ''}`}>{complete ? <Check size={14} aria-hidden="true" /> : i + 1}</button>;
        })}
      </nav>

      <div class="stack sticky-col">
        <div>
          <div class="eyebrow">Exercise {cursor + 1} of {w.exercises.length}, {PATTERN_LABEL[ex.pattern].toLowerCase()}</div>
          <div class="row between" style={{ alignItems: 'flex-start' }}>
            <h1 class="ex-title" data-testid="exercise-name">{ex.name}</h1>
            <div class="row" style={{ gap: '6px', flex: 'none' }}>
              <button class="icon-btn sm" aria-label={`About ${ex.name} and your history`} onClick={() => setInfo(true)}><Info size={18} aria-hidden="true" /></button>
              <button class="icon-btn sm" aria-label={`Swap ${ex.name}`} onClick={() => setSwap(true)} data-testid="swap-open"><Repeat2 size={18} aria-hidden="true" /></button>
            </div>
          </div>
        </div>
        <AnimStage fit anim={ex.anim} primary={ex.primary} secondary={ex.secondary} label={ex.name}
          tags={<span class="chip accent num">{slot.sets} × {slot.repMin}–{slot.repMax}{ex.perSide ? ' / side' : ''}{unit}</span>} />
        <ul class="cues" aria-label="Form cues">{ex.cues.map((c) => <li key={c}><Check size={16} aria-hidden="true" />{c}</li>)}</ul>
        <MuscleChips primary={ex.primary} secondary={ex.secondary} />
      </div>

      <div class="stack">
        <div class="suggest" data-testid="suggestion">
          <Zap size={20} aria-hidden="true" />
          <div class="grow">
            <strong class="num">{ex.load === 'bodyweight' ? `${sug.reps}${unit} reps` : `${sug.weight} kg × ${sug.reps}${unit}`}</strong>
            <div class="xs">{sug.note}</div>
          </div>
          <span class="chip outline num" title="Target effort">RPE {slot.targetRpe - 1}–{slot.targetRpe}</span>
        </div>

        <div class="stack-sm" role="list" aria-label="Sets">
          {log.sets.map((s, i) => (
            <button key={i} role="listitem" class={`set-row ${s.done ? 'done' : ''} ${i === sel ? 'current' : ''}`} onClick={() => setSel(i)} data-testid={`set-${i}`} aria-pressed={i === sel} aria-label={`Set ${i + 1}: ${s.weight} kilograms, ${s.reps} reps${s.rpe ? `, RPE ${s.rpe}` : ''}${s.done ? ', done' : ''}`}>
              <span class="n" aria-hidden="true">{s.done ? <Check size={14} /> : i + 1}</span>
              <span class="num" style={{ fontWeight: 700 }}>{ex.load === 'bodyweight' ? 'Bodyweight' : `${s.weight} kg`} × {s.reps}{unit}</span>
              <span class="xs num">{s.rpe ? `RPE ${s.rpe}` : ''}</span>
              <span class="xs muted">{s.done ? 'Logged' : i === sel ? 'Editing' : ''}</span>
            </button>
          ))}
          <div class="grid2">
            <button class="btn secondary sm" onClick={addSet}><Plus size={16} aria-hidden="true" /> Add set</button>
            <button class="btn secondary sm" onClick={removeSet} disabled={log.sets.filter((s) => !s.done).length === 0 || log.sets.length <= 1}><Minus size={16} aria-hidden="true" /> Remove set</button>
          </div>
        </div>

        {cur ? (
          <section class="card stack" aria-label={`Set ${sel + 1} editor`}>
            {ex.load !== 'bodyweight' ? (
              <Stepper label="kg per dumbbell" value={String(cur.weight)} testid="weight-stepper"
                onDec={() => editSet(sel, { weight: nextDown(cur.weight, weights) })} onInc={() => editSet(sel, { weight: nextUp(cur.weight, weights) })} />
            ) : null}
            <Stepper label={ex.timed ? 'seconds' : ex.perSide ? 'reps per side' : 'reps'} value={String(cur.reps)} testid="reps-stepper"
              onDec={() => editSet(sel, { reps: Math.max(0, cur.reps - (ex.timed ? 5 : 1)) })} onInc={() => editSet(sel, { reps: cur.reps + (ex.timed ? 5 : 1) })} />
            <div>
              <div class="label" style={{ marginBottom: '6px' }}>How hard was it? (RPE)</div>
              <div class="rpe" role="group" aria-label="RPE">
                {[6, 7, 8, 9, 10].map((r) => (
                  <button key={r} aria-pressed={cur.rpe === r} onClick={() => editSet(sel, { rpe: cur.rpe === r ? null : r })} data-testid={`rpe-${r}`}>{r}<small>{RPE_LABEL[r]}</small></button>
                ))}
              </div>
            </div>
            <button class="btn primary lg block" onClick={() => logSet(sel)} data-testid="log-set"><Check size={22} aria-hidden="true" /> {cur.done ? 'Update set' : `Log set ${sel + 1}`}</button>
          </section>
        ) : (
          <section class="card stack" style={{ textAlign: 'center' }} aria-live="polite">
            <div class="row" style={{ justifyContent: 'center', color: 'var(--accent)' }}><Check size={22} aria-hidden="true" /><strong>All sets logged</strong></div>
            <span class="small muted">{last ? 'Finish the lifts when you’re ready.' : 'On to the next exercise.'} Tap a set above to correct it.</span>
          </section>
        )}

        <div class="grid2">
          <button class="btn secondary" onClick={() => goTo(cursor - 1)} disabled={cursor === 0}><ChevronLeft size={20} aria-hidden="true" /> Previous</button>
          {last ? (
            <button ref={nextRef} class={`btn ${allDone ? 'primary' : 'secondary'}`} onClick={props.onFinish} data-testid="finish-lifts">Finish lifts <ChevronRight size={20} aria-hidden="true" /></button>
          ) : (
            <button ref={nextRef} class={`btn ${allDone ? 'primary' : 'secondary'}`} onClick={() => goTo(cursor + 1)} aria-label={`Next exercise: ${getExercise(w.exercises[cursor + 1].exerciseId).name}`} data-testid="next-exercise">Next <ChevronRight size={20} aria-hidden="true" /></button>
          )}
        </div>
      </div>

      <RestDock w={w} restSec={slot.restSec} epoch={restEpoch} />

      {swap ? <SwapSheet current={ex} slotKey={log.key} loggedSets={log.sets.filter((x) => x.done).length} onClose={() => setSwap(false)} onPick={async (id, always) => {
        const s2 = suggestionFor({ exerciseId: id, repMin: getExercise(id).repMin, repMax: getExercise(id).repMax });
        await updateActive((x) => {
          const e = x.exercises[cursor];
          x.exercises[cursor] = { ...e, exerciseId: id, sets: e.sets.map(() => ({ weight: s2.weight, reps: s2.reps, rpe: null, done: false })) };
          return x;
        });
        setSwap(false);
        if (always) {
          try { await updateProgram({ swaps: { ...program.value.swaps, [log.key]: id } }); } catch { notify(`Swapped for today only: the programme couldn’t be saved`, 'err'); return; }
        }
        notify(always ? `Swapped in your programme: ${getExercise(id).name}` : `Swapped for today: ${getExercise(id).name}`);
      }} /> : null}
      {info ? (
        <Sheet title={ex.name} onClose={() => setInfo(false)}>
          <div class="small muted">{ex.equipment} · {PATTERN_LABEL[ex.pattern]}{ex.perSide ? ' · per side' : ''}</div>
          <ul class="cues">{ex.cues.map((c) => <li key={c}><Check size={16} aria-hidden="true" />{c}</li>)}</ul>
          <MuscleChips primary={ex.primary} secondary={ex.secondary} />
          <History exerciseId={ex.id} />
        </Sheet>
      ) : null}
    </main>
  );
}

function History(props: { exerciseId: string }) {
  const h = liftHistory(props.exerciseId, workouts.value).slice(-5).reverse();
  if (!h.length) return <p class="small muted" style={{ margin: 0 }}>No history yet. This will be your first log.</p>;
  return (
    <table class="table"><thead><tr><th>Date</th><th>Top set</th><th>e1RM</th></tr></thead>
      <tbody>{h.map((p) => <tr key={p.t}><td>{p.date}</td><td>{p.topWeight} kg × {p.topReps}</td><td>{p.e1rm}</td></tr>)}</tbody></table>
  );
}

export function SwapSheet(props: { current: Exercise; slotKey: string; onClose: () => void; onPick: (id: string, always: boolean) => void; programOnly?: boolean; loggedSets?: number }) {
  const alts = alternativesFor(props.current.id);
  const [pick, setPick] = useState(alts[0]?.id ?? props.current.id);
  const ex = getExercise(pick);
  return (
    <Sheet title={`Swap ${props.current.name}`} onClose={props.onClose}>
      <AnimStage anim={ex.anim} primary={ex.primary} secondary={ex.secondary} aspect="16 / 10" label={ex.name} />
      <div class="small muted">Same movement pattern ({PATTERN_LABEL[props.current.pattern].toLowerCase()}), so your weekly balance stays intact.</div>
      {props.loggedSets ? <div class="suggest warn" role="note"><AlertTriangle size={18} aria-hidden="true" /><span>You’ve logged {props.loggedSets} set{props.loggedSets === 1 ? '' : 's'} of {props.current.name}. Swapping starts the new exercise fresh and clears them.</span></div> : null}
      <div class="stack-sm" role="radiogroup" aria-label="Alternatives">
        {alts.map((a) => (
          <button key={a.id} class="alt" role="radio" aria-checked={pick === a.id} onClick={() => setPick(a.id)} data-testid={`alt-${a.id}`}>
            <div class="grow"><strong>{a.name}</strong><div class="xs muted">{a.equipment} · {a.repMin}–{a.repMax}{a.timed ? 's' : ''}{a.perSide ? ' / side' : ''}</div></div>
            {pick === a.id ? <Check size={20} color="var(--accent)" aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      {props.programOnly ? (
        <button class="btn primary block" onClick={() => props.onPick(pick, true)} data-testid="swap-always">Use {ex.name}</button>
      ) : (
        <div class="grid2">
          <button class="btn secondary" onClick={() => props.onPick(pick, false)} data-testid="swap-today">Today only</button>
          <button class="btn primary" onClick={() => props.onPick(pick, true)} data-testid="swap-always">Always</button>
        </div>
      )}
    </Sheet>
  );
}

// ── Rest timer ─────────────────────────────────────────────────
function RestDock(props: { w: WorkoutLog; restSec: number; epoch: number }) {
  const now = useNow(250);
  const [paused, setPaused] = useState<number | null>(null);
  const alerted = useRef<number | null>(null);
  const endsAt = props.w.restEndsAt;
  const remaining = endsAt != null ? (endsAt - now) / 1000 : paused;

  useEffect(() => {
    if (endsAt != null && now >= endsAt && alerted.current !== endsAt) {
      alerted.current = endsAt;
      if (settings.value.sound) beep(3);
      if (settings.value.vibrate) buzz();
    }
    if (endsAt != null && now - endsAt > 8000) void updateActive((x) => ({ ...x, restEndsAt: null }));
  }, [now >= (endsAt ?? Infinity), Math.floor(now / 2000)]);

  const set = (ms: number | null) => updateActive((x) => ({ ...x, restEndsAt: ms }));
  const over = remaining != null && remaining <= 0;
  // Denominator for the progress bar: the length of the rest that is running (grows with +15 s).
  const total = useRef(props.restSec);
  const start = (sec: number, fresh = true) => { unlockAudio(); setPaused(null); if (fresh) total.current = sec; void set(Date.now() + sec * 1000); };
  // A new rest (e.g. from logging a set) supersedes a paused one.
  useEffect(() => { if (endsAt != null) setPaused(null); }, [endsAt != null]);
  if (remaining != null && remaining > total.current) total.current = remaining;
  useEffect(() => { if (endsAt == null && paused == null) total.current = props.restSec; }, [endsAt, paused, props.restSec]);
  useEffect(() => { if (props.epoch) total.current = props.restSec; }, [props.epoch]);

  if (remaining == null) {
    return (
      <div class="dock"><div class="inner">
        <button class="btn secondary block" onClick={() => start(props.restSec)} data-testid="rest-start"><Timer size={20} aria-hidden="true" /> Start rest timer, {fmtClock(props.restSec)}</button>
      </div></div>
    );
  }
  const frac = over ? 0 : Math.max(0, Math.min(1, remaining / total.current));
  return (
    <div class="dock" role="region" aria-label="Rest timer">
      <div class="rest-bar" aria-hidden="true"><div style={{ width: `${frac * 100}%` }} /></div>
      <div class="inner">
        <div class={`rest ${over ? 'over' : ''}`}>
          <div class="rest-read">
            <span class="eyebrow" aria-live="polite">{over ? 'Rest done, next set' : paused != null ? 'Rest paused' : 'Resting'}</span>
            <span class={`rest-time ${!over && remaining <= 5 ? 'ending' : ''}`} role="timer" aria-live="off" data-testid="rest-time">{over ? 'Go!' : fmtClock(Math.ceil(remaining))}</span>
          </div>
          <div class="rest-btns">
            {!over ? (
              <>
                <button class="btn secondary" onClick={() => (paused != null ? setPaused(Math.max(0, paused - 15)) : set((endsAt ?? Date.now()) - 15000))} aria-label="15 seconds less" data-testid="rest-minus">−15</button>
                {paused != null
                  ? <button class="btn primary" onClick={() => start(paused, false)} aria-label="Resume rest" data-testid="rest-resume"><Play size={20} aria-hidden="true" /></button>
                  : <button class="btn primary" onClick={() => { setPaused(Math.max(0, remaining)); void set(null); }} aria-label="Pause rest" data-testid="rest-pause"><Pause size={20} aria-hidden="true" /></button>}
                <button class="btn secondary" onClick={() => (paused != null ? setPaused(paused + 15) : set((endsAt ?? Date.now()) + 15000))} aria-label="15 seconds more" data-testid="rest-plus">+15</button>
              </>
            ) : null}
            <button class={`btn ${over ? 'primary' : 'secondary'}`} onClick={() => { setPaused(null); void set(null); }} aria-label={over ? 'Dismiss rest timer' : 'Stop rest'} data-testid="rest-stop">{over ? 'Dismiss' : <X size={20} aria-hidden="true" />}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Finisher ───────────────────────────────────────────────────
function FinisherView(props: { w: WorkoutLog; onDone: (done: boolean) => void }) {
  const plan = planForActive();
  const f = FINISHER_BY_ID[plan?.finisherId ?? ''] ?? FINISHERS[0];
  const total = f.rounds * (f.workSec + f.restSec) - f.restSec;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [offset, setOffset] = useState(0); // seconds elapsed while paused
  const now = useNow(250);
  const elapsed = startedAt != null ? offset + (now - startedAt) / 1000 : offset;
  const cycle = f.workSec + f.restSec;
  const round = Math.min(f.rounds, Math.floor(elapsed / cycle) + 1);
  const inCycle = elapsed - (round - 1) * cycle;
  const working = inCycle < f.workSec;
  const left = working ? f.workSec - inCycle : cycle - inCycle;
  const complete = elapsed >= total;
  const phaseKey = `${round}-${working}`;
  const prevKey = useRef(phaseKey);
  useEffect(() => {
    if (startedAt != null && prevKey.current !== phaseKey) { if (settings.value.sound) beep(working ? 2 : 1, working ? 880 : 520); if (settings.value.vibrate) buzz(working ? [120, 80, 120] : 200); }
    prevKey.current = phaseKey;
  }, [phaseKey]);
  useEffect(() => { if (complete && startedAt != null) { setOffset(total); setStartedAt(null); if (settings.value.sound) beep(3); if (settings.value.vibrate) buzz(); } }, [complete]);
  const sleep = dailyFor(isoDate())?.sleepH;

  return (
    <main class="player-body" id="main">
      <div class="full">
        <div class="eyebrow">Optional finisher · {Math.round(total / 60)} min</div>
        <h1 class="ex-title">{f.name}</h1>
      </div>
      <AnimStage fit anim={f.anim} primary={MOVE_MUSCLES[f.id] ?? []} label={f.name} />
      <section class="card stack">
        <p style={{ margin: 0 }}>{f.description} <span class="muted">{f.rounds} rounds · {f.workSec}s work / {f.restSec}s rest.</span></p>
        {sleep != null && sleep < 6 ? <div class="suggest"><Wind size={18} aria-hidden="true" /><span>You logged {sleep} h of sleep. Consider skipping this and taking an easy walk instead.</span></div> : null}
        <div style={{ textAlign: 'center' }}>
          <div class="eyebrow" style={{ color: complete ? 'var(--accent)' : working ? 'var(--accent)' : 'var(--text-2)' }}>{complete ? 'Finished' : `Round ${round} of ${f.rounds} · ${working ? 'Work' : 'Rest'}`}</div>
          <div class={`timer ${!complete && left <= 3 && startedAt != null ? 'ending' : ''}`} role="timer" data-testid="finisher-time">{complete ? <Trophy size={56} /> : fmtClock(Math.ceil(left))}</div>
        </div>
        {!complete ? (
          <button class="btn primary lg block" onClick={() => { unlockAudio(); if (startedAt != null) { setOffset(elapsed); setStartedAt(null); } else setStartedAt(Date.now()); }} data-testid="finisher-toggle">
            {startedAt != null ? <><Pause size={20} /> Pause</> : <><Play size={20} /> {elapsed > 0 ? 'Resume' : 'Start finisher'}</>}
          </button>
        ) : <button class="btn primary lg block" onClick={() => props.onDone(true)} data-testid="finisher-done"><Check size={20} aria-hidden="true" /> Done, start cool-down</button>}
        {!complete ? <button class="btn secondary block" onClick={() => props.onDone(elapsed > total * 0.5)} data-testid="finisher-skip">{elapsed > 0 ? 'End finisher' : 'Skip finisher'}</button> : null}
      </section>
    </main>
  );
}

// ── Summary ────────────────────────────────────────────────────
function Summary(props: { w: WorkoutLog }) {
  const w = props.w;
  const { sets, volume } = workoutVolume(w);
  const [notes, setNotes] = useState(w.notes);
  const prs = w.exercises.flatMap((e) => {
    const best = Math.max(0, ...e.sets.filter((s) => s.done).map((s) => e1rm(s.weight, s.reps)));
    if (!best) return [];
    const prev = Math.max(0, ...liftHistory(e.exerciseId, workouts.value).map((p) => p.e1rm));
    return prev > 0 && best > prev ? [{ name: getExercise(e.exerciseId).name, best }] : [];
  });
  const mins = Math.round((Date.now() - w.startedAt) / 60000);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await updateActive((x) => ({ ...x, notes }));
      await finishWorkout();
      notify('Session saved');
      go('today');
    } catch {
      setSaving(false);
      notify('Couldn’t save the session. Storage may be full. Try again, or export a backup.', 'err');
    }
  };
  return (
    <main class="player-body" id="main">
      <section class="card accent stack full" style={{ textAlign: 'center' }}>
        <Trophy size={40} style={{ margin: '0 auto', color: 'var(--accent)' }} aria-hidden="true" />
        <h1 style={{ margin: 0, fontSize: 'var(--t-2xl)' }}>Session complete</h1>
        <div class="grid3">
          <div class="stat"><strong>{mins}</strong><span>minutes</span></div>
          <div class="stat"><strong>{sets}</strong><span>sets logged</span></div>
          <div class="stat"><strong>{volume.toLocaleString()}</strong><span>kg lifted</span></div>
        </div>
      </section>
      <section class="card stack">
        <h2>Highlights</h2>
        {prs.length ? prs.map((p) => <div key={p.name} class="row"><Trophy size={16} color="var(--accent)" aria-hidden="true" /><span class="grow">{p.name}</span><strong class="num">e1RM {p.best} kg</strong></div>)
          : <p class="small muted" style={{ margin: 0 }}>No new records this time. Next session’s weights are already worked out from today’s sets.</p>}
        <ul class="checklist" aria-label="Session parts">
          {([[w.warmupDone, 'Warm-up', 'Warm-up skipped'], [!!w.finisherDone, 'Finisher', 'No finisher'], [w.cooldownDone, 'Cool-down', 'Cool-down skipped']] as const).map(([done, yes, no]) => (
            <li key={yes} class={done ? 'yes' : ''}>{done ? <Check size={16} aria-hidden="true" /> : <CircleDashed size={16} aria-hidden="true" />}{done ? yes : no}</li>
          ))}
        </ul>
      </section>
      <section class="card stack">
        <label class="label" for="notes">Notes (how did it feel?)</label>
        <textarea id="notes" class="input" value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} placeholder="Energy, sleep, anything that hurt…" />
        <button class="btn primary lg block" onClick={save} disabled={saving} data-testid="save-session"><Check size={20} aria-hidden="true" /> {saving ? 'Saving' : 'Save session'}</button>
      </section>
    </main>
  );
}
