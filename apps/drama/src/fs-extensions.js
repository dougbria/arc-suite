import { fsStorage } from '@arc/fs-storage.js';

// Helper to build explicit filename
function getShowFileName(workspace) {
    const safeName = (workspace.name || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `show_${safeName}_${workspace.id}.json`;
}

// Add workspace I/O
fsStorage.loadWorkspaceFile = async function(workspaceId) {
    if (!this.rootDir) return null;
    
    // Scan directory to find matching ID regardless of 'safeName' prefix or legacy
    try {
        for await (const [name, entry] of this.rootDir.entries()) {
            if (entry.kind === 'file' && name.endsWith('.json') && (name.startsWith('show_') || name.startsWith('workspace'))) {
                 if (name.includes(workspaceId) || name === 'workspace.json') {
                      const file = await entry.getFile();
                      const text = await file.text();
                      const ws = JSON.parse(text);
                      if (ws && ws.id === workspaceId || name === 'workspace.json') {
                          return text;
                      }
                 }
            }
        }
    } catch { /* ignore iteration errors */ }
    return null;
};

fsStorage.saveWorkspaceFile = async function(workspace) {
    if (!this.rootDir) return false;
    try {
        const fileName = getShowFileName(workspace);
        
        // Remove old filenames if the name changed
        for await (const [name, entry] of this.rootDir.entries()) {
             if (entry.kind === 'file' && name.endsWith('.json') && name.includes(workspace.id) && name !== fileName) {
                  try { await this.rootDir.removeEntry(name); } catch(e) {}
             }
        }
        
        const fileHandle = await this.rootDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(workspace, null, 2));
        await writable.close();
        return true;
    } catch (e) {
        console.error('Failed to save workspace', e);
        return false;
    }
};

fsStorage.deleteWorkspaceFile = async function(workspaceId) {
    if (!this.rootDir) return false;
    try {
        for await (const [name, entry] of this.rootDir.entries()) {
             if (entry.kind === 'file' && name.endsWith('.json') && name.includes(workspaceId)) {
                  try { await this.rootDir.removeEntry(name); } catch(e) {}
             }
        }
        return true;
    } catch (e) {
        console.warn('Failed to delete workspace files:', e);
        return false;
    }
};

fsStorage.getWorkspaceList = async function() {
    if (!this.rootDir) return [];
    try {
        const list = [];
         for await (const [name, entry] of this.rootDir.entries()) {
            if (entry.kind === 'file' && name.endsWith('.json') && (name.startsWith('show_') || name.startsWith('workspace'))) {
                try {
                    const file = await entry.getFile();
                    const text = await file.text();
                    const ws = JSON.parse(text);
                    if (ws && ws.id) {
                         list.push({ 
                             id: ws.id, 
                             name: ws.name || 'Unnamed Show',
                             createdAt: ws.createdAt || file.lastModified,
                             updatedAt: ws.updatedAt || file.lastModified
                         });
                    }
                } catch (e) { 
                    console.warn('[FS] Error parsing workspace:', entry.name, e);
                }
            }
        }
        return list;
    } catch (e) {
        console.error('[FS] getWorkspaceList iterator failed', e);
        return [];
    }
};

// Add episode folder I/O
fsStorage.loadEpisode = async function(episodeId) {
    if (!this.rootDir) return null;
    try {
        const epDirHandle = await this.rootDir.getDirectoryHandle('episodes', { create: false });
        const epFileHandle = await epDirHandle.getFileHandle(`episode_${episodeId}.json`, { create: false });
        const file = await epFileHandle.getFile();
        return await file.text();
    } catch {
        return null;
    }
};

fsStorage.saveEpisode = async function(episode) {
    if (!this.rootDir) return false;
    try {
        const epDirHandle = await this.rootDir.getDirectoryHandle('episodes', { create: true });
        const epFileHandle = await epDirHandle.getFileHandle(`episode_${episode.id}.json`, { create: true });
        const writable = await epFileHandle.createWritable();
        await writable.write(JSON.stringify(episode, null, 2));
        await writable.close();
        return true;
    } catch (e) {
        console.error('Failed to save episode', e);
        return false;
    }
};

fsStorage.getEpisodeList = async function() {
    if (!this.rootDir) return [];
    try {
        const epDirHandle = await this.rootDir.getDirectoryHandle('episodes', { create: false });
        const episodes = [];
        for await (const [name, entry] of epDirHandle.entries()) {
            if (entry.kind === 'file' && entry.name.startsWith('episode_') && entry.name.endsWith('.json')) {
                const file = await entry.getFile();
                const text = await file.text();
                try {
                    episodes.push(JSON.parse(text));
                } catch { /* ignore parse errors */ }
            }
        }
        return episodes;
    } catch {
        return [];
    }
};

fsStorage.deleteEpisode = async function(episodeId) {
    if (!this.rootDir) return false;
    try {
        const epDirHandle = await this.rootDir.getDirectoryHandle('episodes', { create: false });
        await epDirHandle.removeEntry(`episode_${episodeId}.json`);
        return true;
    } catch (e) {
        console.warn('Failed to delete episode', e);
        return false;
    }
};

// Add video storage
fsStorage.saveVideo = async function(projectId, videoId, blob) { /* Phase 4 */ };

export { fsStorage };
