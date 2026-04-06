import state from '@arc/state.js';
import { fsStorage } from './fs-extensions.js';
import { generateUUID } from '@arc/utils.js';

export function createEpisode(title) {
    const episode = {
        id: generateUUID(),
        title: title || 'New Episode',
        description: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scenes: []
    };
    return episode;
}

export function createScene(title, locationId, sceneNum = 10, baseName = '') {
    return {
        id: 'scene_' + generateUUID(),
        sceneNumber: sceneNum,
        baseName: baseName,
        title: title || 'New Scene',
        locationId: locationId || null,
        description: '',
        shots: []
    };
}

export async function loadEpisodeList() {
    if (!state.workspace) return;
    
    // In local storage mode we'll just keep them in workspace JSON (for dev test)
    if (state.storageType !== 'fs') {
        if (!state.workspace.episodes) state.workspace.episodes = [];
        state.episodeList = state.workspace.episodes;
    } else {
        const allEps = await fsStorage.getEpisodeList();
        const validIds = new Set((state.workspace.episodes || []).map(e => e.id));
        state.episodeList = allEps.filter(ep => validIds.has(ep.id));
    }
}

export async function loadActiveEpisode(episodeId) {
    if (state.storageType !== 'fs') {
         state.activeEpisode = state.workspace.episodes.find(e => e.id === episodeId);
    } else {
         const json = await fsStorage.loadEpisode(episodeId);
         if (json) {
             try {
                 state.activeEpisode = JSON.parse(json);
             } catch (e) {
                 console.error('Failed to parse episode JSON:', e);
                 state.activeEpisode = null;
             }
         } else {
             state.activeEpisode = null;
         }
    }
    state.emit('episodeChanged');
}

export async function saveActiveEpisode() {
    if (!state.activeEpisode) return;
    state.activeEpisode.updatedAt = Date.now();
    if (state.storageType === 'fs') {
        await fsStorage.saveEpisode(state.activeEpisode);
    } else {
        // Find and replace in workspace array
        const idx = state.workspace.episodes.findIndex(e => e.id === state.activeEpisode.id);
        if (idx >= 0) {
            state.workspace.episodes[idx] = state.activeEpisode;
        } else {
            state.workspace.episodes.push(state.activeEpisode);
        }
        await state.saveWorkspace(); // This will save to localStorage
    }
}
state.saveActiveEpisode = saveActiveEpisode;
state.loadActiveEpisode = loadActiveEpisode;

// State binding integrations
state.addEpisode = async function(title) {
    const ep = createEpisode(title);
    if (!state.workspace.episodes) state.workspace.episodes = [];
    
    if (state.storageType !== 'fs') {
        state.workspace.episodes.push(ep);
        state.activeEpisode = ep;
        await state.saveWorkspace();
    } else {
        // Only store references in FS mode
        state.workspace.episodes.push({ id: ep.id, title: ep.title });
        await fsStorage.saveEpisode(ep);
        state.activeEpisode = ep;
        await loadEpisodeList();
        await state.saveWorkspace();
    }
    state.emit('episodeListChanged');
    state.emit('episodeChanged');
    return ep;
};

state.addSceneToActiveEpisode = async function(title, locationId, sceneNum, baseName) {
    if (!state.activeEpisode) return null;
    const scene = createScene(title, locationId, sceneNum, baseName);
    state.activeEpisode.scenes.push(scene);
    
    // Sort scenes by sceneNumber
    state.activeEpisode.scenes.sort((a, b) => (a.sceneNumber || 0) - (b.sceneNumber || 0));
    
    await saveActiveEpisode();
    state.emit('episodeChanged');
    return scene;
};

state.removeSceneFromEpisode = async function(sceneId) {
    if (!state.activeEpisode) return false;
    state.activeEpisode.scenes = state.activeEpisode.scenes.filter(s => s.id !== sceneId);
    await saveActiveEpisode();
    state.emit('episodeChanged');
    return true;
};

state.deleteEpisode = async function(episodeId) {
    if (!state.workspace) return;
    
    // Remove from workspace tracking
    state.workspace.episodes = state.workspace.episodes.filter(e => e.id !== episodeId);
    state.episodeList = state.episodeList.filter(e => e.id !== episodeId);
    
    // Remove from disk
    if (state.storageType === 'fs') {
        await fsStorage.deleteEpisode(episodeId);
    }
    
    // Reset active if matching
    if (state.activeEpisode?.id === episodeId) {
        state.activeEpisode = null;
        state.activeEpisodeId = null;
    }
    
    await state.saveWorkspace();
    state.emit('episodeListChanged');
    state.emit('episodeChanged');
};
