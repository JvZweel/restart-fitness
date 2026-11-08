import { signal } from '@preact/signals';

export type Route = { name: 'today' | 'program' | 'progress' | 'settings' | 'session'; param?: string };

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, param] = h.split('/');
  if (name === 'program' || name === 'progress' || name === 'settings' || name === 'session') return { name, param };
  return { name: 'today' };
}

export const route = signal<Route>(parse());
window.addEventListener('hashchange', () => { route.value = parse(); window.scrollTo(0, 0); });

export function go(path: string): void {
  if (location.hash !== `#/${path}`) location.hash = `/${path}`;
}
