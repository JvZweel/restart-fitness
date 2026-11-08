import { render } from 'preact';
import './fonts.css';
import './styles.css';
import { App } from './ui/App';
import { boot } from './data/store';
import { initPwa } from './ui/pwa';

render(<App />, document.getElementById('app')!);
void boot();
initPwa();
