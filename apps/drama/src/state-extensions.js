import { State as stateEngine } from '@arc/core';
const state = stateEngine.default || stateEngine;
const { dataDB } = stateEngine;

// ── Workspace state ──────────────────────────────
state.workspace = null;
state.activeEpisodeId = null;
state.activeEpisode = null;
state.activeShotId = null;
state.canvasMode = 'setup';
state.editingEntity = null;
state.storyboardFilters = {
  characterIds: [], locationIds: [], statuses: [],
  starredOnly: false, staleOnly: false
};
state.storyboardViewMode = 'grid';
state.compareShots = null;

// ── Workspace methods ────────────────────────────
state.loadWorkspace = async function() {
    if (!dataDB.isSupported()) return;
    const ok = await dataDB.pickDatabaseFolder();
    if (ok) {
        const workspaces = await dataDB.listWorkspaces();
        if (workspaces.length > 0) {
            state.workspace = workspaces[0]; // Auto-load first for POC
            this.emit('workspaceLoaded');
        }
    }
};

state.createWorkspace = async function(name) {
    state.workspace = {
        id: crypto.randomUUID(),
        name,
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
        images: []
    };
    await dataDB.saveWorkspace(state.workspace);
    this.emit('workspaceChanged');
    this.emit('workspaceLoaded');
};

state.saveWorkspace = async function() {
    if (this.workspace) await dataDB.saveWorkspace(this.workspace);
};

state.getCharacter = async function(id) {
    try {
        const char = await dataDB.getCharacter(id);
        return char;
    } catch (e) { return null; }
};

state.getLocation = async function(id) {
    try {
        const loc = await dataDB.getLocation(id);
        return loc;
    } catch (e) { return null; }
};

state.populateEntities = async function(breakdown) {
    if (!this.workspace) return;
    
    // Import new characters
    const charMap = {}; // name to ID
    for (const c of (breakdown.newCharacters || [])) {
        if (c.isNew) {
            const char = {
                id: 'char_' + crypto.randomUUID(),
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
            await dataDB.saveCharacter(char);
        } else {
            charMap[c.name.toLowerCase()] = c.matchedId;
            const existingChar = this.workspace.characters.find(x => x.id === c.matchedId);
            if (existingChar && !existingChar.isLocked) {
                if (!existingChar.vgl) existingChar.vgl = {};
                existingChar.vgl.description = c.description;
                existingChar.updatedAt = Date.now();
                await dataDB.saveCharacter(existingChar);
            }
        }
    }

    // Import new locations
    const locMap = {}; // name to ID
    for (const l of (breakdown.newLocations || [])) {
        if (l.isNew) {
            const loc = {
                id: 'loc_' + crypto.randomUUID(),
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
            await dataDB.saveLocation(loc);
        } else {
            locMap[l.name.toLowerCase()] = l.matchedId;
            const existingLoc = this.workspace.locations.find(x => x.id === l.matchedId);
            if (existingLoc && !existingLoc.isLocked) {
                if (!existingLoc.vgl) existingLoc.vgl = {};
                existingLoc.vgl.background_setting = l.description;
                existingLoc.updatedAt = Date.now();
                await dataDB.saveLocation(existingLoc);
            }
        }
    }
    
    await this.saveWorkspace();
    return { charMap, locMap };
};

state.syncProductionBoard = async function(breakdown) {
    if (!this.workspace) return;
    
    const { charMap, locMap } = await this.populateEntities(breakdown);

    if (!this.workspace.episodes) this.workspace.episodes = [];
    if (!breakdown.episodes) return; 

    // Import Episodes, Scenes, Shots
    for (const epRaw of breakdown.episodes) {
         let ep = null;
         
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
              let scene = (this.activeEpisode.scenes || []).find(s => s.sceneNumber == sRaw.sceneNumber);
              
              if (!scene) {
                   const locId = locMap[(sRaw.locationName || '').toLowerCase()] || null;
                   const title = sRaw.title || `Sequence ${sRaw.sceneNumber || 10}: ${sRaw.baseName || 'Untitled'}`;
                   scene = await this.addSceneToActiveEpisode(title, locId, sRaw.sceneNumber || 10, sRaw.baseName || 'Scene');
              }
              
              for (const shotRaw of (sRaw.shots || [])) {
                   const cIds = (shotRaw.characterNames || []).map(n => charMap[n.toLowerCase()]).filter(x => x);
                   
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

state.setCanvasMode = function(mode) { 
  this.canvasMode = mode;
  this.emit('canvasModeChanged');
};

export default state;
