import { mount } from 'svelte';

import App from './App.svelte';
import './i18n.js';

const app = mount(App, { target: document.body });

export default app;
