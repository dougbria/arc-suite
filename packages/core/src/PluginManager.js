export class PluginManager {
    constructor(core) {
        this.core = core;
        this.plugins = new Map();
    }

    register(plugin) {
        if (!plugin.id || !plugin.init) {
            console.error('[PluginManager] Invalid plugin format', plugin);
            return;
        }
        this.plugins.set(plugin.id, plugin);
        plugin.init(this.core);
        console.log(`[PluginManager] Registered plugin: ${plugin.id}`);
    }

    get(pluginId) {
        return this.plugins.get(pluginId);
    }
}
