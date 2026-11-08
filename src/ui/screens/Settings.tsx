import { useEffect, useState } from 'preact/hooks';
import { Plus, Trash2, Upload, Download, FileSpreadsheet, RotateCcw, Sun, Moon, MonitorSmartphone, WifiOff, Smartphone, ShieldCheck } from 'lucide-preact';
import { daily, exportBackupJson, importBackupJson, mergeDailyRows, notify, resetAll, setTheme, settings, updateSettings, photos } from '../../data/store';
import { mergeDaily, parseGarminCsv, type GarminParseResult } from '../../domain/garmin';
import { DEFAULT_WEIGHTS } from '../../domain/weights';
import { fmtClock, isoDate } from '../../domain/dates';
import type { ThemePref } from '../../domain/types';
import { Confirm, Sheet, Stepper, Toggle } from '../components';
import { installPrompt, offlineReady } from '../pwa';

export function Settings() {
  const s = settings.value;
  return (
    <main class="page two-col" id="main">
      <header class="page-head full"><h1>Settings</h1></header>
      <div class="stack">
        <Appearance theme={s.theme} />
        <Weights />
        <section class="card" aria-labelledby="rest-h">
          <h2 id="rest-h" style={{ marginBottom: 'var(--s3)' }}>Rest timer</h2>
          <div class="stack">
            <Stepper label="big lifts" value={fmtClock(s.restCompoundSec)} onDec={() => updateSettings({ restCompoundSec: Math.max(30, s.restCompoundSec - 15) })} onInc={() => updateSettings({ restCompoundSec: Math.min(300, s.restCompoundSec + 15) })} testid="rest-compound" />
            <Stepper label="arms & core" value={fmtClock(s.restAccessorySec)} onDec={() => updateSettings({ restAccessorySec: Math.max(15, s.restAccessorySec - 15) })} onInc={() => updateSettings({ restAccessorySec: Math.min(240, s.restAccessorySec + 15) })} testid="rest-accessory" />
          </div>
          <div class="list" style={{ marginTop: 'var(--s2)' }}>
            <Toggle label="Start rest automatically" hint="When you log a set" checked={s.autoRest} onChange={(v) => updateSettings({ autoRest: v })} testid="t-autorest" />
            <Toggle label="Sound at the end" checked={s.sound} onChange={(v) => updateSettings({ sound: v })} />
            <Toggle label="Vibrate at the end" checked={s.vibrate} onChange={(v) => updateSettings({ vibrate: v })} />
          </div>
        </section>
        <section class="card" aria-labelledby="sess-h">
          <h2 id="sess-h" style={{ marginBottom: 'var(--s3)' }}>Session</h2>
          <div class="grid2">
            <Stepper label="warm-up / move" value={`${s.warmupSec}s`} onDec={() => updateSettings({ warmupSec: Math.max(20, s.warmupSec - 5) })} onInc={() => updateSettings({ warmupSec: Math.min(90, s.warmupSec + 5) })} />
            <Stepper label="stretch hold" value={`${s.cooldownSec}s`} onDec={() => updateSettings({ cooldownSec: Math.max(20, s.cooldownSec - 5) })} onInc={() => updateSettings({ cooldownSec: Math.min(120, s.cooldownSec + 5) })} />
          </div>
          <div class="list" style={{ marginTop: 'var(--s2)' }}>
            <Toggle label="Offer the metabolic finisher" hint="Short optional intervals after the lifts" checked={s.showFinisher} onChange={(v) => updateSettings({ showFinisher: v })} />
            <div class="list-row"><div class="grow" style={{ fontWeight: 600 }}>Units</div><span class="chip">Kilograms (kg)</span></div>
          </div>
        </section>
      </div>
      <div class="stack">
        <Garmin />
        <Backup />
        <About />
      </div>
    </main>
  );
}

function Appearance(props: { theme: ThemePref }) {
  return (
    <section class="card stack" aria-labelledby="th-h">
      <h2 id="th-h">Appearance</h2>
      <div class="seg" role="group" aria-label="Theme" data-testid="theme">
        {([['system', 'System', <MonitorSmartphone size={16} />], ['light', 'Light', <Sun size={16} />], ['dark', 'Dark', <Moon size={16} />]] as const).map(([v, l, i]) => (
          <button key={v} aria-pressed={props.theme === v} onClick={() => setTheme(v)} data-testid={`theme-${v}`}><span class="row" style={{ justifyContent: 'center', gap: '6px' }}>{i}{l}</span></button>
        ))}
      </div>
      <div class="small muted">System follows your phone’s light or dark setting.</div>
    </section>
  );
}

function Weights() {
  const list = settings.value.weights;
  const [val, setVal] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const add = async (e: Event) => {
    e.preventDefault();
    const n = Number(val.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > 200) { setErr('Enter a weight between 0 and 200 kg'); return; }
    if (list.includes(Math.round(n * 100) / 100)) { setErr(`${n} kg is already in the list`); return; }
    setErr(null);
    await updateSettings({ weights: [...list, n] });
    setVal('');
  };
  const remove = (w: number) => updateSettings({ weights: list.filter((x) => x !== w) });
  return (
    <section class="card stack" aria-labelledby="w-h">
      <div class="card-head" style={{ marginBottom: 0 }}><h2 id="w-h">Available weights</h2><span class="chip num">{list.length} weights</span></div>
      <div class="small muted" id="w-hint">Kilograms per dumbbell. Weight suggestions only use weights from this list.</div>
      <form class="row" onSubmit={add}>
        <div class="input-unit grow">
          <input class="input num" type="number" inputMode="decimal" step="0.25" min="0" placeholder="e.g. 18.5" value={val} aria-label="New weight in kilograms" aria-describedby={err ? 'w-err' : 'w-hint'} aria-invalid={err ? 'true' : undefined} data-testid="weight-new"
            onInput={(e) => setVal((e.target as HTMLInputElement).value)} />
          <span>kg</span>
        </div>
        <button class="icon-btn" type="submit" aria-label="Add weight" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', borderColor: 'var(--accent)' }} data-testid="weight-add"><Plus size={24} aria-hidden="true" /></button>
      </form>
      {err ? <div class="field-err" id="w-err" role="alert">{err}</div> : null}
      {list.length ? (
        <div class="weights" role="list" aria-label="Your weights">
          {list.map((w) => (
            <span class="weight-chip" role="listitem" key={w} data-testid={`w-${w}`}>
              <span>{w}<span class="sr-only"> kg</span></span>
              <button class="icon-btn sm plain" aria-label={`Remove ${w} kg`} onClick={() => remove(w)} data-testid={`w-del-${w}`}><Trash2 size={16} aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      ) : <div class="small muted">No weights in the list. Suggestions round to the nearest 0.5 kg until you add some.</div>}
      {list.join() !== DEFAULT_WEIGHTS.join() ? <button class="btn ghost sm" onClick={() => updateSettings({ weights: DEFAULT_WEIGHTS })}><RotateCcw size={14} aria-hidden="true" /> Restore default list</button> : null}
    </section>
  );
}

function Garmin() {
  const [preview, setPreview] = useState<(GarminParseResult & { name: string }) | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      const r = parseGarminCsv(await f.text());
      if (!r.rows.length) { notify('No steps, sleep or weight found in that file. Export a Steps, Sleep or Weight report as CSV.', 'err'); return; }
      setPreview({ ...r, name: f.name });
    } catch { notify('Couldn’t read that file. Choose a CSV exported from Garmin Connect.', 'err'); }
  };
  const apply = async () => {
    if (!preview) return;
    const merged = mergeDaily(daily.value, preview.rows, overwrite);
    const changed = merged.filter((m) => preview.rows.some((r) => r.date === m.date));
    try {
      await mergeDailyRows(changed);
      notify(`Imported ${preview.rows.length} days from Garmin`);
      setPreview(null);
    } catch { notify('Couldn’t save the import: storage is unavailable', 'err'); }
  };
  return (
    <section class="card stack" aria-labelledby="g-h">
      <h2 id="g-h" class="row" style={{ gap: '8px' }}><FileSpreadsheet size={18} aria-hidden="true" /> Garmin import</h2>
      <p class="small muted" style={{ margin: 0 }}>In Garmin Connect on the web, open Reports, pick Steps, Sleep or Weight, choose a range and select Export CSV. Load the file here. Days are merged by date and you see a preview first.</p>
      <label class="btn secondary block" data-testid="garmin-pick">
        <Upload size={18} aria-hidden="true" /> Choose Garmin CSV
        <input type="file" accept=".csv,text/csv,text/plain" class="sr-only" onChange={onFile} data-testid="garmin-input" />
      </label>
      {preview ? (
        <Sheet title="Import preview" onClose={() => setPreview(null)}>
          <div class="small muted">{preview.name}: {preview.detected.join(', ') || 'data'} for {preview.rows.length} days{preview.skipped ? `, ${preview.skipped} rows skipped` : ''}. Showing the latest 30.</div>
          <div style={{ maxHeight: '40vh', overflow: 'auto' }} tabIndex={0} aria-label="Import preview table">
            <table class="table" data-testid="garmin-preview">
              <caption class="sr-only">Rows to import</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Steps</th><th scope="col">Sleep h</th><th scope="col">Weight kg</th></tr></thead>
              <tbody>{preview.rows.slice(-30).reverse().map((r) => <tr key={r.date}><td>{r.date}</td><td>{r.steps ?? '—'}</td><td>{r.sleepH ?? '—'}</td><td>{r.weight ?? '—'}</td></tr>)}</tbody>
            </table>
          </div>
          <div class="list"><Toggle label="Replace values I typed in" hint="When off, only empty days are filled" checked={overwrite} onChange={setOverwrite} /></div>
          <button class="btn primary block" onClick={apply} data-testid="garmin-apply">Merge {preview.rows.length} days</button>
        </Sheet>
      ) : null}
    </section>
  );
}

function Backup() {
  const [withPhotos, setWithPhotos] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const exportNow = async () => {
    setBusy(true);
    let json: string;
    try { json = await exportBackupJson(withPhotos); } catch { notify('Couldn’t create the backup. Try again without photos.', 'err'); setBusy(false); return; }
    setBusy(false);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `restart-fitness-backup-${isoDate()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    notify('Backup downloaded');
  };
  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try { setPending(await f.text()); } catch { notify('Couldn’t read that file', 'err'); }
  };
  return (
    <section class="card stack" aria-labelledby="bk-h">
      <h2 id="bk-h">Backup</h2>
      <p class="small muted" style={{ margin: 0 }}>Your data lives only on this phone. Export a backup every few weeks and keep it somewhere safe, such as Google Drive. It holds your logs, programme and settings.</p>
      <div class="list"><Toggle label="Include progress photos" hint={`${photos.value.length} photo${photos.value.length === 1 ? '' : 's'}, makes the file larger`} checked={withPhotos} onChange={setWithPhotos} /></div>
      <div class="grid2">
        <button class="btn primary" onClick={exportNow} disabled={busy} data-testid="export"><Download size={18} aria-hidden="true" /> {busy ? 'Preparing' : 'Export'}</button>
        <label class="btn secondary" data-testid="import-pick"><Upload size={18} aria-hidden="true" /> Import<input type="file" accept="application/json,.json" class="sr-only" onChange={onFile} data-testid="import-input" /></label>
      </div>
      <button class="btn danger block" onClick={() => setReset(true)} data-testid="reset"><RotateCcw size={18} aria-hidden="true" /> Reset all data</button>
      {pending ? <Confirm title="Replace all data?" body="Importing replaces the logs, programme and settings on this phone with the backup. Export first if you want to keep the current data." confirm="Replace" onConfirm={async () => {
        try { const r = await importBackupJson(pending); notify(`Restored ${r.workouts} sessions and ${r.days} days`); } catch (err) { notify(err instanceof Error ? err.message : 'Import failed. Nothing was changed.', 'err'); }
      }} onClose={() => setPending(null)} /> : null}
      {reset ? <Confirm title="Reset everything?" body="Deletes every session, daily log, photo and setting on this phone. This can’t be undone." confirm="Delete everything" danger onConfirm={async () => { try { await resetAll(); notify('All data reset'); } catch { notify('Couldn’t reset: storage is unavailable', 'err'); } }} onClose={() => setReset(false)} /> : null}
    </section>
  );
}

function About() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const f = () => setOnline(navigator.onLine);
    addEventListener('online', f); addEventListener('offline', f);
    return () => { removeEventListener('online', f); removeEventListener('offline', f); };
  }, []);
  const prompt = installPrompt.value;
  return (
    <section class="card stack" aria-labelledby="ab-h">
      <h2 id="ab-h">App</h2>
      <div class="list">
        <div class="list-row"><WifiOff size={18} class="muted" aria-hidden="true" /><div class="grow">Offline</div><span class={`chip ${offlineReady.value ? 'accent' : ''}`} data-testid="offline-status">{offlineReady.value ? 'Ready' : 'Preparing'}</span></div>
        <div class="list-row"><ShieldCheck size={18} class="muted" aria-hidden="true" /><div class="grow">Data stays on this device</div><span class="chip">No account</span></div>
        <div class="list-row"><Smartphone size={18} class="muted" aria-hidden="true" /><div class="grow">Version</div><span class="chip num">{__APP_VERSION__}{online ? '' : ' · offline'}</span></div>
      </div>
      {prompt ? <button class="btn primary block" onClick={async () => { await prompt.prompt(); installPrompt.value = null; }}>Install app</button> : <div class="small muted">To install, open the Chrome menu (⋮) and choose Install app or Add to Home screen.</div>}
    </section>
  );
}
