import { PluginManager } from './PluginManager.js';
import { UIHooks } from './UIHooks.js';
import { JobQueue } from './JobQueue.js';

export * as Gallery from './gallery.js';
export * as Canvas from './canvas.js';
export * as State from './state.js';
export * as JsonEditor from './json-editor.js';
export { EntityEditor } from './plugins/EntityEditor.js';

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
