import './styles.css';
import { App } from './ui/app.ts';
import { must } from './ui/dom.ts';

const app = new App(must('#app'));
app.start();
