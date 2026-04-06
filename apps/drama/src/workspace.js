import state from '@arc/state.js';
import { fsStorage } from './fs-extensions.js';
import { generateUUID } from '@arc/utils.js';

/**
 * Creates a totally new workspace memory object.
 */
export function createNewWorkspace(name) {
    return {
        id: generateUUID(),
        name: name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        style: {
            name: "Default Style",
            description: "Default visual style for this production",
            aesthetics: {},
            referenceImageIds: [],
            entityVersion: 1,
            entityHistory: []
        },
        characters: [],
        locations: [],
        props: [],
        episodes: [],
        llmConfig: {
            provider: 'anthropic',
            model: 'claude-3-opus-20240229'
        },
        videoConfig: {
            provider: 'default',
            apiEndpoint: '',
            defaultDuration: 5,
            defaultFps: 24,
            defaultResolution: '1080p'
        }
    };
}

/**
 * Persists the current workspace state to disk.
 */
export async function saveWorkspace() {
    if (!state.workspace) return;
    state.workspace.updatedAt = Date.now();
    
    // Always mirror to localStorage as a safety net in case FS loses permissions on reload
    localStorage.setItem(`arcdrama-workspace-${state.workspace.id}`, JSON.stringify(state.workspace));
    localStorage.setItem('arcdrama-active-workspace', state.workspace.id);

    // Additionally save to File System if permission is currently actively granted
    if (state.storageType === 'fs') {
        await fsStorage.saveWorkspaceFile(state.workspace);
    }
}

/**
 * Loads the active workspace from disk/localStorage.
 */
export async function loadWorkspace() {
    let activeId = localStorage.getItem('arcdrama-active-workspace');

    if (state.storageType === 'fs') {
        if (!activeId) {
             // Try to discover existing shows if no active id is pinned
             const list = await fsStorage.getWorkspaceList();
             if (list.length > 0) activeId = list[0].id;
        }
        if (activeId) {
             const workspaceData = await fsStorage.loadWorkspaceFile(activeId);
             if (workspaceData) {
                 state.workspace = JSON.parse(workspaceData);
                 localStorage.setItem('arcdrama-active-workspace', activeId);
                 return true;
             }
        }
    } else {
        if (activeId) {
            const data = localStorage.getItem(`arcdrama-workspace-${activeId}`);
            if (data) {
                state.workspace = JSON.parse(data);
                return true;
            }
        }
    }
    return false;
}

// Bind to state singleton 
state.createWorkspace = async function(name) {
    this.workspace = createNewWorkspace(name);
    this.activeEpisode = null;
    this.activeEpisodeId = null;
    this.activeShotId = null;
    
    // Track in workspace list
    let list = JSON.parse(localStorage.getItem('arcdrama-workspace-list') || '[]');
    list.push({ id: this.workspace.id, name: this.workspace.name });
    localStorage.setItem('arcdrama-workspace-list', JSON.stringify(list));
    
    await saveWorkspace();
    this.emit('workspaceChanged');
};

state.loadWorkspace = async function() {
    const success = await loadWorkspace();
    if (success) {
        this.emit('workspaceChanged');
    }
    return success;
};

state.saveWorkspace = async function() {
    await saveWorkspace();
    this.emit('workspaceChanged');
};

state.deleteWorkspace = async function(id) {
    if (state.storageType === 'fs') {
        await fsStorage.deleteWorkspaceFile(id);
    }
    localStorage.removeItem(`arcdrama-workspace-${id}`);
    
    let list = JSON.parse(localStorage.getItem('arcdrama-workspace-list') || '[]');
    list = list.filter(w => w.id !== id);
    localStorage.setItem('arcdrama-workspace-list', JSON.stringify(list));
    
    if (this.workspace && this.workspace.id === id) {
        this.workspace = null;
        localStorage.removeItem('arcdrama-active-workspace');
        // fallback to first valid loaded
        const success = await loadWorkspace();
        if (success) {
            this.emit('workspaceChanged');
            return true;
        } else {
            this.emit('storageReset');
        }
    }
    return true;
};

state.getCharacter = function(id) {
    return this.workspace?.characters.find(c => c.id === id);
};

state.getLocation = function(id) {
    return this.workspace?.locations.find(l => l.id === id);
};

state.populateEntities = async function(breakdown) {
    if (!this.workspace) return;
    
    // Import new characters
    const charMap = {}; // name to ID
    (breakdown.newCharacters || []).forEach(c => {
        if (c.isNew) {
            const char = {
                id: 'char_' + generateUUID(),
                name: c.name,
                isLocked: false,
                vgl: { description: c.description },
                referenceImageIds: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                entityVersion: 1,
                entityHistory: []
            };
            this.workspace.characters.push(char);
            charMap[c.name.toLowerCase()] = char.id;
        } else {
            charMap[c.name.toLowerCase()] = c.matchedId;
            const existingChar = this.getCharacter(c.matchedId);
            if (existingChar && !existingChar.isLocked) {
                if (!existingChar.vgl) existingChar.vgl = {};
                existingChar.vgl.description = c.description;
            }
        }
    });

    // Import new locations
    const locMap = {}; // name to ID
    (breakdown.newLocations || []).forEach(l => {
        if (l.isNew) {
            const loc = {
                id: 'loc_' + generateUUID(),
                name: l.name,
                isLocked: false,
                vgl: { background_setting: l.description, lighting: {} },
                referenceImageIds: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                entityVersion: 1,
                entityHistory: []
            };
            this.workspace.locations.push(loc);
            locMap[l.name.toLowerCase()] = loc.id;
        } else {
            locMap[l.name.toLowerCase()] = l.matchedId;
            const existingLoc = this.getLocation(l.matchedId);
            if (existingLoc && !existingLoc.isLocked) {
                if (!existingLoc.vgl) existingLoc.vgl = {};
                existingLoc.vgl.background_setting = l.description;
            }
        }
    });
    
    await this.saveWorkspace();
    return { charMap, locMap };
};

state.syncProductionBoard = async function(breakdown) {
    if (!this.workspace) return;
    
    const { charMap, locMap } = await this.populateEntities(breakdown);

    // Ensure arrays exist
    if (!this.workspace.episodes) this.workspace.episodes = [];
    if (!breakdown.episodes) return; // Nothing to sync

    // Import Episodes, Scenes, Shots
    for (const epRaw of breakdown.episodes) {
         let ep = null;
         
         // If there's exactly 1 episode in the workspace and exactly 1 in the new breakdown, 
         // assume they are the same episode even if the title shifted slightly to prevent "Extra Episodes"
         if (this.workspace.episodes.length === 1 && breakdown.episodes.length === 1) {
             ep = this.workspace.episodes[0];
         } else {
             ep = this.workspace.episodes.find(e => e.title === epRaw.title);
         }
         
         if (!ep) {
              ep = await this.addEpisode(epRaw.title || 'New Episode');
         } else {
              await this.loadActiveEpisode(ep.id);
         }
         
         for (const sRaw of (epRaw.scenes || [])) {
              // Match by sceneNumber to prevent duplicate sequence generation on multi-sync
              let scene = (this.activeEpisode.scenes || []).find(s => s.sceneNumber == sRaw.sceneNumber);
              
              if (!scene) {
                   const locId = locMap[(sRaw.locationName || '').toLowerCase()] || null;
                   
                   // Format as Sequence Number + Base Name as requested by user
                   const title = sRaw.title || `Sequence ${sRaw.sceneNumber || 10}: ${sRaw.baseName || 'Untitled'}`;
                   
                   scene = await this.addSceneToActiveEpisode(title, locId, sRaw.sceneNumber || 10, sRaw.baseName || 'Scene');
              }
              
              for (const shotRaw of (sRaw.shots || [])) {
                   // Build character IDs array
                   const cIds = (shotRaw.characterNames || []).map(n => charMap[n.toLowerCase()]).filter(x => x);
                   
                   // Guard against duplicate shots caused by undefined vs empty string suffixes and str/int typing
                   const targetSuffix = (shotRaw.suffix || '').trim();
                   const existingShot = (scene.shots || []).find(sh => 
                       sh.shotNumber == shotRaw.shotNumber && 
                       (sh.suffix || '').trim() === targetSuffix
                   );
                   
                   if (!existingShot) {
                        const newShot = await this.addShotToScene(scene.id, shotRaw.action || '...', shotRaw.shotNumber || 10, targetSuffix);
                        if (newShot) {
                             newShot.characterIds = cIds;
                        }
                   }
              }
         }
    }
    
    if (this.activeEpisode) {
         if (this.saveActiveEpisode) await this.saveActiveEpisode();
         this.emit('episodeChanged');
    }
};
