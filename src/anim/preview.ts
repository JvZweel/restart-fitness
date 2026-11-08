// Dev-only preview harness: /anim.html?anim=<id>&t=<0..1>&dark=1
import { createViewer } from './viewer';
import { ANIMS } from './poses';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const v = createViewer(canvas, { dark: q.get('dark') === '1' });
const id = q.get('anim') ?? 'goblet-squat';
v.setAnim(id, ['quads'], ['glutes']);
if (q.has('t')) v.renderAt(Number(q.get('t')));
if (q.has('k')) v.renderKey(Number(q.get('k')));
(window as unknown as { __anim: unknown }).__anim = { v, ids: Object.keys(ANIMS) };
document.getElementById('l')!.textContent = id;
