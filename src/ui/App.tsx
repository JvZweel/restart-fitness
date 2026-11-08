import { useEffect } from 'preact/hooks';
import { Home, ClipboardList, LineChart, Settings as Cog, CheckCircle2, AlertCircle } from 'lucide-preact';
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
  if (!ready.value) return <div class="page" aria-busy="true"><div class="card" style={{ height: '220px', opacity: 0.6 }} /><div class="card" style={{ height: '140px', opacity: 0.4 }} /></div>;
  if (loadError.value) {
    return (
      <main class="page"><section class="card stack" role="alert">
        <h2 class="row"><AlertCircle size={20} color="var(--danger)" /> Storage unavailable</h2>
        <p class="muted" style={{ margin: 0 }}>The app couldn’t open its on-device database ({loadError.value}). Private / incognito mode can block storage — open it in a normal Chrome tab.</p>
        <button class="btn primary" onClick={() => location.reload()}>Try again</button>
      </section></main>
    );
  }
  const r = route.value;
  const inSession = r.name === 'session';
  return (
    <div class="app">
      <a class="kbd-skip" href="#main">Skip to content</a>
      {r.name === 'today' ? <Today /> : r.name === 'program' ? <Program /> : r.name === 'progress' ? <Progress /> : r.name === 'settings' ? <Settings /> : <Session />}
      {!inSession ? (
        <div class="tabbar"><nav aria-label="Main">
          {TABS.map((t) => (
            <a key={t.name} href={`#/${t.name}`} aria-current={r.name === t.name ? 'page' : undefined} data-testid={`tab-${t.name}`}>
              <t.icon size={22} strokeWidth={r.name === t.name ? 2.4 : 2} />{t.label}
            </a>
          ))}
        </nav></div>
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
  if (!t) return null;
  return <div class={`toast ${t.kind === 'err' ? 'err' : ''}`} role="status" aria-live="polite" data-testid="toast">{t.kind === 'err' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}{t.text}</div>;
}
