import { useEffect, useRef } from 'preact/hooks';
import { Home, ClipboardList, LineChart, Settings as Cog, CheckCircle2, AlertCircle, Database, RotateCcw } from 'lucide-preact';
import { loadError, ready, toast } from '../data/store';
import { route } from './router';
import { Today } from './screens/Today';
import { Session } from './screens/Session';
import { Program } from './screens/Program';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';

const TABS = [
  { name: 'today', label: 'Today', icon: Home },
  { name: 'program', label: 'Programme', icon: ClipboardList },
  { name: 'progress', label: 'Progress', icon: LineChart },
  { name: 'settings', label: 'Settings', icon: Cog },
] as const;

export function App() {
  const r = route.value;
  const first = useRef(true);
  // Move focus to the new screen on navigation so keyboard / screen-reader users land at the top.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const main = document.getElementById('main');
    if (main) { main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true }); }
  }, [r.name]);

  if (!ready.value) {
    return (
      <div class="page" aria-busy="true" aria-label="Loading your data">
        <div class="skeleton" style={{ height: '56px', width: '40%' }} />
        <div class="skeleton" style={{ height: '320px' }} />
        <div class="skeleton" style={{ height: '160px' }} />
      </div>
    );
  }
  if (loadError.value) {
    return (
      <main class="page" id="main"><section class="card stack" role="alert" data-testid="storage-error">
        <div class="empty" style={{ padding: 'var(--s4) 0 0' }}>
          <div class="ico" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Database size={26} /></div>
          <h1 style={{ margin: 0, fontSize: 'var(--t-xl)' }}>Storage is unavailable</h1>
          <p class="small" style={{ margin: 0, maxWidth: '40ch' }}>The app couldn’t open its on-device database, so nothing can be saved. Private or incognito tabs often block storage. Open the app in a normal Chrome tab, or from the home-screen icon.</p>
          <p class="xs muted" style={{ margin: 0 }}>Details: {loadError.value}</p>
        </div>
        <button class="btn primary block" onClick={() => location.reload()}><RotateCcw size={18} /> Try again</button>
      </section></main>
    );
  }
  const inSession = r.name === 'session';
  return (
    <div class={`app ${inSession ? 'in-session' : 'has-rail'}`}>
      <a class="kbd-skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m?.setAttribute('tabindex', '-1'); m?.focus(); }}>Skip to content</a>
      {r.name === 'today' ? <Today /> : r.name === 'program' ? <Program /> : r.name === 'progress' ? <Progress /> : r.name === 'settings' ? <Settings /> : <Session />}
      {!inSession ? (
        <div class="tabbar">
          <div class="brand" aria-hidden="true"><RotateCcw size={20} strokeWidth={2.4} />Restart Fitness</div>
          <nav aria-label="Main">
            {TABS.map((t) => (
              <a key={t.name} href={`#/${t.name}`} aria-current={r.name === t.name ? 'page' : undefined} data-testid={`tab-${t.name}`}>
                <t.icon size={22} strokeWidth={r.name === t.name ? 2.4 : 2} aria-hidden="true" />{t.label}
              </a>
            ))}
          </nav>
        </div>
      ) : null}
      <Toast />
    </div>
  );
}

function Toast() {
  const t = toast.value;
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => { if (toast.value?.id === t.id) toast.value = null; }, 2800);
    return () => clearTimeout(id);
  }, [t?.id]);
  // The live region is always mounted so screen readers reliably announce new messages.
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {t ? <div key={t.id} class={`toast ${t.kind === 'err' ? 'err' : ''}`} data-testid="toast">{t.kind === 'err' ? <AlertCircle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}<span>{t.text}</span></div> : null}
    </div>
  );
}
