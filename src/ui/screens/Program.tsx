import { useState } from 'preact/hooks';
import { Repeat2, SlidersHorizontal, RotateCcw, Utensils, Footprints, Moon, Gauge, TrendingUp, Clock } from 'lucide-preact';
import { notify, program, sessions, updateProgram } from '../../data/store';
import { estimateMinutes, GUIDANCE, PATTERNS, WEEKDAY_LONG, WEEKDAY_SHORT, weeklySetsByPattern } from '../../domain/program';
import { getExercise, PATTERN_LABEL } from '../../domain/exercises';
import type { SlotPrescription, Weekday } from '../../domain/types';
import { Sheet, Stepper } from '../components';
import { SwapSheet } from './Session';

export function Program() {
  const p = program.value;
  const plan = sessions.value;
  const [swap, setSwap] = useState<SlotPrescription | null>(null);
  const [edit, setEdit] = useState<SlotPrescription | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const vol = weeklySetsByPattern(plan);

  const toggleDay = async (d: Weekday) => {
    const set = new Set(p.weekdays);
    if (set.has(d)) set.delete(d); else set.add(d);
    const days = [...set].sort((a, b) => a - b) as Weekday[];
    if (days.length < 2) { setMsg('Keep at least 2 training days.'); return; }
    if (days.length > 5) { setMsg('5 days is the maximum — turn one off first.'); return; }
    setMsg(null);
    await updateProgram({ weekdays: days });
    notify(`Re-balanced: ${days.length} full-body sessions (${days.map((x) => WEEKDAY_SHORT[x]).join(', ')})`);
  };
  const hasCustom = Object.keys(p.swaps).length > 0 || Object.keys(p.edits).length > 0;

  return (
    <main class="page two-col" id="main">
      <header class="page-head full">
        <div><div class="eyebrow">Your plan</div><h1>Programme</h1></div>
      </header>

      <section class="card stack full" aria-labelledby="days-h">
        <div class="card-head" style={{ marginBottom: 0 }}>
          <h2 id="days-h">Training days</h2>
          <span class="chip accent" data-testid="days-count">{p.weekdays.length} days / week</span>
        </div>
        <div class="days" role="group" aria-label="Training days">
          {WEEKDAY_SHORT.map((d, i) => (
            <button key={d} aria-pressed={p.weekdays.includes(i as Weekday)} onClick={() => toggleDay(i as Weekday)} aria-label={WEEKDAY_LONG[i]} data-testid={`day-${i}`}>{d}</button>
          ))}
        </div>
        {msg ? <div class="small" style={{ color: 'var(--danger)' }} role="alert">{msg}</div> : <div class="small muted">Pick 2–5 days. Sessions re-balance automatically so every day stays full-body and weekly volume stays even.</div>}
        <div class="row wrap" style={{ gap: '6px' }} aria-label="Weekly hard sets per pattern">
          {PATTERNS.map((x) => <span key={x.pattern} class="chip num">{PATTERN_LABEL[x.pattern]} {vol[x.pattern]}</span>)}
        </div>
      </section>

      {plan.map((s) => (
        <section key={s.index} class="card" aria-labelledby={`s-${s.index}`}>
          <div class="card-head">
            <div>
              <div class="eyebrow">{WEEKDAY_LONG[s.weekday]}</div>
              <h2 id={`s-${s.index}`}>{s.name}</h2>
            </div>
            <span class="chip outline"><Clock size={13} /> ~{estimateMinutes(s)} min</span>
          </div>
          <div class="list">
            {s.slots.map((slot) => {
              const ex = getExercise(slot.exerciseId);
              const custom = p.swaps[slot.key] || p.edits[slot.key];
              return (
                <div class="list-row" key={slot.key} data-testid={`slot-${s.index}-${slot.key}`}>
                  <div class="grow">
                    <div class="ellipsis" style={{ fontWeight: 600 }}>{ex.name}{custom ? <span class="badge-dot" style={{ marginLeft: '8px', verticalAlign: '2px' }} title="Customised" /> : null}</div>
                    <div class="xs muted num">{PATTERN_LABEL[slot.pattern]} · {slot.sets} × {slot.repMin}–{slot.repMax}{ex.timed ? 's' : ''}{ex.perSide ? '/side' : ''}</div>
                  </div>
                  <button class="icon-btn sm" aria-label={`Swap ${ex.name}`} onClick={() => setSwap(slot)} data-testid={`swap-${s.index}-${slot.key}`}><Repeat2 size={18} /></button>
                  <button class="icon-btn sm" aria-label={`Edit sets and reps for ${ex.name}`} onClick={() => setEdit(slot)} data-testid={`edit-${s.index}-${slot.key}`}><SlidersHorizontal size={18} /></button>
                </div>
              );
            })}
          </div>
          <div class="xs muted" style={{ marginTop: 'var(--s2)' }}>+ mobility warm-up, optional finisher and flexibility cool-down</div>
        </section>
      ))}

      <section class="card stack full" aria-labelledby="guide-h">
        <h2 id="guide-h">Guidance</h2>
        <div class="row" style={{ alignItems: 'flex-start' }}><Gauge size={18} class="muted" /><div class="small grow">{GUIDANCE.rpe}</div></div>
        <div class="row" style={{ alignItems: 'flex-start' }}><TrendingUp size={18} class="muted" /><div class="small grow">{GUIDANCE.progression}</div></div>
        <div class="row" style={{ alignItems: 'flex-start' }}><Footprints size={18} class="muted" /><div class="small grow">{GUIDANCE.walk}</div></div>
        <div class="row" style={{ alignItems: 'flex-start' }}><Moon size={18} class="muted" /><div class="small grow">{GUIDANCE.sleep}</div></div>
        <div class="row" style={{ alignItems: 'flex-start' }}><Utensils size={18} class="muted" /><div class="small grow"><strong>{GUIDANCE.calories} · {GUIDANCE.protein}</strong><ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>{GUIDANCE.meals.map((m) => <li key={m}>{m}</li>)}</ul></div></div>
      </section>

      {hasCustom ? (
        <button class="btn secondary block full" onClick={async () => { await updateProgram({ swaps: {}, edits: {} }); notify('Programme reset to the default exercises'); }}><RotateCcw size={18} /> Reset swaps & edits</button>
      ) : null}

      {swap ? <SwapSheet current={getExercise(swap.exerciseId)} slotKey={swap.key} programOnly onClose={() => setSwap(null)} onPick={async (id) => {
        await updateProgram({ swaps: { ...program.value.swaps, [swap.key]: id } });
        notify(`Swapped in: ${getExercise(id).name}`);
        setSwap(null);
      }} /> : null}
      {edit ? <EditSheet slot={edit} onClose={() => setEdit(null)} /> : null}
    </main>
  );
}

function EditSheet(props: { slot: SlotPrescription; onClose: () => void }) {
  const ex = getExercise(props.slot.exerciseId);
  const [sets, setSets] = useState(props.slot.sets);
  const [lo, setLo] = useState(props.slot.repMin);
  const [hi, setHi] = useState(props.slot.repMax);
  const step = ex.timed ? 5 : 1;
  const save = async () => {
    await updateProgram({ edits: { ...program.value.edits, [props.slot.key]: { sets, repMin: lo, repMax: Math.max(lo, hi) } } });
    notify(`${ex.name}: ${sets} × ${lo}–${Math.max(lo, hi)}`);
    props.onClose();
  };
  const reset = async () => {
    const edits = { ...program.value.edits };
    delete edits[props.slot.key];
    await updateProgram({ edits });
    props.onClose();
  };
  return (
    <Sheet title={ex.name} onClose={props.onClose}>
      <div class="small muted">Applies to this slot ({PATTERN_LABEL[ex.pattern].toLowerCase()}) whenever it appears in your week.</div>
      <Stepper label="sets" value={String(sets)} onDec={() => setSets(Math.max(1, sets - 1))} onInc={() => setSets(Math.min(8, sets + 1))} testid="edit-sets" />
      <div class="grid2">
        <Stepper label={ex.timed ? 'min sec' : 'min reps'} value={String(lo)} onDec={() => setLo(Math.max(1, lo - step))} onInc={() => { setLo(lo + step); if (hi < lo + step) setHi(lo + step); }} testid="edit-lo" />
        <Stepper label={ex.timed ? 'max sec' : 'max reps'} value={String(hi)} onDec={() => setHi(Math.max(lo, hi - step))} onInc={() => setHi(hi + step)} testid="edit-hi" />
      </div>
      <button class="btn primary block" onClick={save} data-testid="edit-save">Save</button>
      <button class="btn ghost" onClick={reset}><RotateCcw size={16} /> Back to default ({ex.repMin}–{ex.repMax})</button>
    </Sheet>
  );
}
