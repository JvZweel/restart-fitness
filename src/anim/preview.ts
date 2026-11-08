// Dev-only preview harness: /anim.html?anim=<id>&t=<0..1>&dark=1&trails=0&sheet=1
import { createViewer } from './viewer';
import { ANIMS } from './poses';
import { COOLDOWN, EXERCISES, FINISHERS, MOVE_MUSCLES, WARMUP } from '../domain/exercises';
import type { Muscle } from '../domain/types';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const sheet = q.has('sheet');
const dark = q.get('dark') === '1';
document.documentElement.dataset.theme = dark ? 'dark' : 'light';
const ids = Object.keys(ANIMS);
const id = q.get('anim') && ANIMS[q.get('anim')!] ? q.get('anim')! : 'goblet-squat';

/** Muscles shown for an animation: the exercise's own, else the warm-up/cool-down/finisher map. */
function musclesFor(anim: string): [Muscle[], Muscle[]] {
  const ex = EXERCISES.find((e) => e.anim === anim);
  if (ex) return [ex.primary, ex.secondary];
  const move = [...WARMUP, ...COOLDOWN].find((m) => m.anim === anim);
  const fin = FINISHERS.find((f) => f.anim === anim);
  return [MOVE_MUSCLES[move?.id ?? fin?.id ?? ''] ?? [], []];
}

const phaseEl = document.getElementById('phase')!;
const label: Record<string, string> = { ecc: 'Lower', con: 'Lift', flow: 'Flow', hold: 'Pause' };
const v = createViewer(canvas, {
  dark,
  trails: q.get('trails') !== '0',
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  onFrame: (f) => { phaseEl.textContent = `${label[f.phase]} · tension ${(f.tension * 100).toFixed(0)}% · ${f.t.toFixed(1)} / ${f.total.toFixed(1)} s`; },
});
const [primary, secondary] = musclesFor(id);
v.setAnim(id, primary, secondary);
if (q.has('t')) v.renderAt(Number(q.get('t')));
if (q.has('k')) v.renderKey(Number(q.get('k')));
(window as unknown as { __anim: unknown }).__anim = { v, ids };

const pick = document.getElementById('pick') as HTMLSelectElement;
for (const a of ids) pick.add(new Option(a, a, a === id, a === id));
pick.onchange = () => { q.set('anim', pick.value); location.search = q.toString(); };
let playing = !q.has('t') && !q.has('k');
const play = document.getElementById('play') as HTMLButtonElement;
const sync = () => { play.textContent = playing ? 'Pause' : 'Play'; v.setPlaying(playing); };
play.onclick = () => { playing = !playing; sync(); };
(document.getElementById('trails') as HTMLInputElement).checked = q.get('trails') !== '0';
(document.getElementById('trails') as HTMLInputElement).onchange = (e) => v.setTrails((e.target as HTMLInputElement).checked);
(document.getElementById('dark') as HTMLInputElement).checked = dark;
(document.getElementById('dark') as HTMLInputElement).onchange = (e) => { q.set('dark', (e.target as HTMLInputElement).checked ? '1' : '0'); location.search = q.toString(); };
if (sheet) document.body.classList.add('sheet');
sync();
