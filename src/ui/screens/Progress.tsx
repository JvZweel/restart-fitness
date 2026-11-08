import { useEffect, useMemo, useState } from 'preact/hooks';
import { Camera, ImagePlus, Trash2, Dumbbell, Scale, Ruler, Footprints, Moon, History, LineChart as ChartIcon } from 'lucide-preact';
import { addPhoto, daily, notify, photos, removePhoto, removeWorkout, workouts } from '../../data/store';
import { go } from '../router';
import { EXERCISES } from '../../domain/exercises';
import { liftHistory, weeklyAverages, workoutVolume } from '../../domain/stats';
import { addDays, fmtShort, isoDate, parseIso, startOfWeek } from '../../domain/dates';
import type { DailyLog, ProgressPhoto } from '../../domain/types';
import { Confirm, Empty, LineChart, Segmented, Sheet } from '../components';

type Tab = 'lifts' | 'body' | 'photos';
type Range = 28 | 84 | 0;

export function Progress() {
  const [tab, setTab] = useState<Tab>('lifts');
  return (
    <main class="page" id="main">
      <header class="page-head"><h1>Progress</h1></header>
      <Segmented label="Progress view" value={tab} onChange={setTab} testid="progress-tabs" options={[{ value: 'lifts', label: 'Lifts' }, { value: 'body', label: 'Body' }, { value: 'photos', label: 'Photos' }]} />
      <div class="grid-2 stack" style={{ gap: 'var(--s4)' }}>{tab === 'lifts' ? <Lifts /> : tab === 'body' ? <Body /> : <Photos />}</div>
    </main>
  );
}

function Lifts() {
  const logged = useMemo(() => {
    const ids = new Set(workouts.value.flatMap((w) => w.exercises.filter((e) => e.sets.some((s) => s.done)).map((e) => e.exerciseId)));
    return EXERCISES.filter((e) => ids.has(e.id));
  }, [workouts.value]);
  const [id, setId] = useState<string>(logged[0]?.id ?? '');
  const [del, setDel] = useState<string | null>(null);
  useEffect(() => { if (!logged.find((e) => e.id === id) && logged[0]) setId(logged[0].id); }, [logged.length]);

  if (!logged.length) {
    return (
      <section class="card full" data-testid="empty-lifts">
        <Empty icon={<Dumbbell size={26} />} title="No lifts logged yet" body="Finish your first session and each lift’s strength trend appears here.">
          <button class="btn primary" onClick={() => go('today')}>Go to today’s session</button>
        </Empty>
      </section>
    );
  }
  // Trust the logged list, not `id`: after a delete, `id` can point at a lift with no history for one render.
  const ex = logged.find((e) => e.id === id) ?? logged[0];
  const h = liftHistory(ex.id, workouts.value);
  const bw = ex.load === 'bodyweight';
  const first = h[0];
  const last = h[h.length - 1];
  return (
    <>
      <section class="card stack">
        <div class="field">
          <label for="ex-pick">Exercise</label>
          <select id="ex-pick" class="input" value={ex.id} onChange={(e) => setId((e.target as HTMLSelectElement).value)} data-testid="lift-pick">
            {logged.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div class="grid3">
          <div class="stat"><strong class="num">{bw ? last.topReps : last.e1rm}</strong><span>{bw ? 'best reps' : 'est. 1-rep max, kg'}</span></div>
          <div class="stat"><strong class="num">{bw ? `${last.topReps}` : `${last.topWeight}×${last.topReps}`}</strong><span>last top set</span></div>
          <div class="stat"><strong class="num" style={{ color: 'var(--accent)' }}>{h.length > 1 ? `${last.e1rm - first.e1rm >= 0 ? '+' : ''}${Math.round((last.e1rm - first.e1rm) * 10) / 10}` : '—'}</strong><span>since first log</span></div>
        </div>
        {h.length > 1
          ? <LineChart label={`${ex.name} estimated one-rep max over time`} testid="lift-chart" points={h.map((p) => ({ x: p.t, y: bw ? p.topReps : p.e1rm }))} secondary={bw ? undefined : h.map((p) => ({ x: p.t, y: p.topWeight }))} />
          : <p class="small muted" style={{ margin: 0 }}>One session logged. The trend line appears after the next one.</p>}
        {!bw && h.length > 1 ? <div class="row small muted" aria-hidden="true"><span class="row" style={{ gap: '6px' }}><i style={{ width: '16px', height: '3px', background: 'var(--accent)', display: 'inline-block', borderRadius: '2px' }} /> est. 1-rep max</span><span class="row" style={{ gap: '6px' }}><i style={{ width: '16px', borderTop: '2px dashed var(--text-3)', display: 'inline-block' }} /> top-set weight</span></div> : null}
      </section>
      <section class="card">
        <div class="card-head"><h2>Recent sessions</h2><History size={18} class="muted" aria-hidden="true" /></div>
        <div class="list">
          {workouts.value.slice(0, 12).map((w) => {
            const v = workoutVolume(w);
            return (
              <div class="list-row" key={w.id}>
                <div class="grow"><div style={{ fontWeight: 600 }}>{w.sessionName}</div><div class="xs muted num">{fmtShort(w.date)}, {v.sets} sets, {v.volume.toLocaleString()} kg, {w.finishedAt ? Math.round((w.finishedAt - w.startedAt) / 60000) : 0} min</div></div>
                <button class="icon-btn sm plain danger" aria-label={`Delete ${w.sessionName} on ${fmtShort(w.date)}`} onClick={() => setDel(w.id)}><Trash2 size={18} aria-hidden="true" /></button>
              </div>
            );
          })}
        </div>
      </section>
      {del ? <Confirm title="Delete this session?" body="Its sets are removed from your history and charts." confirm="Delete" danger onConfirm={async () => { try { await removeWorkout(del); notify('Session deleted'); } catch { notify('Couldn’t delete: storage is unavailable', 'err'); } }} onClose={() => setDel(null)} /> : null}
    </>
  );
}

function Body() {
  const [range, setRange] = useState<Range>(84);
  if (!daily.value.length) {
    return (
      <section class="card full" data-testid="empty-body">
        <Empty icon={<ChartIcon size={26} />} title="No body data yet" body="Log weight, steps, sleep and a weekly waist measurement on Today, or import steps and sleep from Garmin. Trends appear after two entries.">
          <div class="row wrap" style={{ justifyContent: 'center' }}>
            <button class="btn primary" onClick={() => go('today')}>Open quick log</button>
            <button class="btn secondary" onClick={() => go('settings')}>Import from Garmin</button>
          </div>
        </Empty>
      </section>
    );
  }
  const from = range ? isoDate(addDays(new Date(), -range)) : '0000';
  const rows = daily.value.filter((d) => d.date >= from);
  const series = (k: keyof Pick<DailyLog, 'weight' | 'waist' | 'steps' | 'sleepH'>) => rows.filter((d) => d[k] != null).map((d) => ({ x: parseIso(d.date).getTime(), y: d[k] as number }));
  const cards: { k: 'weight' | 'waist' | 'steps' | 'sleepH'; title: string; unit: string; icon: preact.JSX.Element; dec: number; weekly?: boolean }[] = [
    { k: 'weight', title: 'Body weight', unit: 'kg', icon: <Scale size={18} aria-hidden="true" />, dec: 1 },
    { k: 'waist', title: 'Waist', unit: 'cm', icon: <Ruler size={18} aria-hidden="true" />, dec: 1 },
    { k: 'steps', title: 'Steps', unit: 'steps', icon: <Footprints size={18} aria-hidden="true" />, dec: 0, weekly: true },
    { k: 'sleepH', title: 'Sleep', unit: 'h', icon: <Moon size={18} aria-hidden="true" />, dec: 1, weekly: true },
  ];
  return (
    <>
      <div class="full"><Segmented label="Range" value={range} onChange={setRange} testid="body-range" options={[{ value: 28, label: '4 weeks' }, { value: 84, label: '12 weeks' }, { value: 0, label: 'All' }]} /></div>
      {cards.map((c) => {
        const daily = series(c.k);
        // Noisy daily series (steps, sleep) read better as weekly averages once there are a few weeks.
        const weekly = c.weekly && daily.length > 21;
        const pts = weekly ? weeklyAverages(daily) : daily;
        const avg = daily.length ? daily.reduce((a, p) => a + p.y, 0) / daily.length : 0;
        const delta = daily.length > 1 ? daily[daily.length - 1].y - daily[0].y : 0;
        const fmt = (v: number) => (c.k === 'steps' ? Math.round(v).toLocaleString() : v.toFixed(c.dec));
        return (
          <section class="card stack-sm" key={c.k} aria-labelledby={`b-${c.k}`}>
            <div class="card-head" style={{ marginBottom: 0 }}>
              <h2 id={`b-${c.k}`} class="row" style={{ gap: '8px' }}>{c.icon}{c.title}</h2>
              {daily.length ? <span class="small muted num">{c.weekly ? `avg ${fmt(avg)} ${c.unit}` : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta).toFixed(1)} ${c.unit}`}</span> : null}
            </div>
            {pts.length > 1
              ? <LineChart label={`${c.title}${weekly ? ', weekly average' : ''}`} unit={c.unit} points={pts} decimals={c.dec} testid={`chart-${c.k}`} average={c.weekly ? avg : undefined} />
              : <p class="small muted" style={{ margin: 0 }}>{daily.length ? `Latest: ${fmt(daily[0].y)} ${c.unit}. One more entry and the trend appears.` : 'Nothing in this range yet.'}</p>}
            {weekly && pts.length > 1 ? <div class="xs muted">Weekly averages; dotted line is the average for the range.</div> : null}
          </section>
        );
      })}
    </>
  );
}

function Photos() {
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<ProgressPhoto | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const urls = useMemo(() => new Map(photos.value.map((p) => [p.id, URL.createObjectURL(p.blob)])), [photos.value]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const thisWeek = isoDate(startOfWeek(new Date()));
  const hasThisWeek = photos.value.some((p) => p.date >= thisWeek);

  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    setBusy(true);
    try { await addPhoto(f); notify('Photo saved on this phone'); } catch { notify('Couldn’t read that image. Try a JPEG or PNG photo.', 'err'); } finally { setBusy(false); }
  };
  const byWeek = new Map<string, ProgressPhoto[]>();
  for (const p of [...photos.value].reverse()) {
    const wk = isoDate(startOfWeek(parseIso(p.date)));
    byWeek.set(wk, [...(byWeek.get(wk) ?? []), p]);
  }
  return (
    <>
      <section class="card stack full">
        <div class="card-head" style={{ marginBottom: 0 }}><h2>Weekly photo</h2><span class={`chip ${hasThisWeek ? 'accent' : ''}`}>{hasThisWeek ? 'Done this week' : 'Due this week'}</span></div>
        <p class="small muted" style={{ margin: 0 }}>Same spot, same light, once a week. Photos are compressed and stay on this phone. They are never uploaded.</p>
        <label class="btn primary block" aria-disabled={busy} data-testid="photo-add">
          <ImagePlus size={20} aria-hidden="true" /> {busy ? 'Saving photo' : 'Add progress photo'}
          <input type="file" accept="image/*" capture="environment" class="sr-only" onChange={onFile} disabled={busy} data-testid="photo-input" />
        </label>
      </section>
      {photos.value.length === 0 ? <section class="card full" data-testid="empty-photos"><Empty icon={<Camera size={26} />} title="No photos yet" body="Add one this week. Your timeline builds week by week, and comparing a few weeks apart shows change the scale misses." /></section> : (
        [...byWeek.entries()].map(([wk, list]) => (
          <section class="card stack-sm full" key={wk}>
            <div class="eyebrow">Week of {fmtShort(wk)}</div>
            <div class="photos">
              {list.map((p) => <button key={p.id} onClick={() => setView(p)} aria-label={`Photo from ${p.date}`}><img src={urls.get(p.id)} alt={`Progress photo ${p.date}`} loading="lazy" /><span>{fmtShort(p.date)}</span></button>)}
            </div>
          </section>
        ))
      )}
      {view ? (
        <Sheet title={fmtShort(view.date)} onClose={() => setView(null)}>
          <img src={urls.get(view.id)} alt={`Progress photo ${view.date}`} style={{ width: '100%', borderRadius: 'var(--r)' }} />
          <button class="btn danger block" onClick={() => { setDel(view.id); setView(null); }}><Trash2 size={18} aria-hidden="true" /> Delete photo</button>
        </Sheet>
      ) : null}
      {del ? <Confirm title="Delete this photo?" body="It is removed from this phone. This can’t be undone." confirm="Delete" danger onConfirm={async () => { await removePhoto(del); notify('Photo deleted'); }} onClose={() => setDel(null)} /> : null}
    </>
  );
}
