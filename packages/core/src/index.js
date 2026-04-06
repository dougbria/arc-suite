import { PluginManager } from './PluginManager.js';
import { UIHooks } from './UIHooks.js';
import { JobQueue } from './JobQueue.js';

export * as Gallery from './gallery.js';
export * as Canvas from './canvas.js';
export * as State from './state.js';
export * as CardJsonEditor from './card-json-editor.js';
export { EntityEditor } from './plugins/EntityEditor.js';
export { apiConsole } from './api-console.js';

import api from './api.js';
export { api };

export * as Actions from './actions.js';
export * as Compare from './compare.js';
export * as Resizer from './resizer.js';
export * as Utils from './utils.js';
export { PromptBar } from './components/PromptBar.js';
export { VglInspector } from './components/VglInspector.js';

export class ArcCore {
    constructor() {
        this.ui = new UIHooks();
        this.plugins = new PluginManager(this);
        this.jobs = new JobQueue();
    }

    init() {
        console.log('[ArcCore] Initialized with UIHooks, Plugins, JobQueue');
    }
}

export const core = new ArcCore();
