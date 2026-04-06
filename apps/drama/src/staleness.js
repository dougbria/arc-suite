import state from '@arc/state.js';

/**
 * Compares the generation record of the images inside a shot 
 * against the current entity versions in the workspace.
 * Returns true if ANY image is out of date.
 */
export function checkShotStaleness(shot, scene) {
    if (!state.projects[shot.id]) return false;
    const project = state.projects[shot.id];
    let isStale = false;
    
    project.images.forEach(img => {
        if (!img.generationRecord) return; // Legacy images bypass staleness
        
        const rec = img.generationRecord;
        if (rec.entityVersions['shot'] && rec.entityVersions['shot'] < (shot.entityVersion || 1)) {
            isStale = true;
        }
        
        if (scene.locationId) {
            const loc = state.workspace.locations?.find(l => l.id === scene.locationId);
            if (loc && rec.entityVersions['location:'+loc.id] && rec.entityVersions['location:'+loc.id] < (loc.entityVersion || 1)) {
                isStale = true;
            }
        }
        
        if (shot.characterIds) {
            shot.characterIds.forEach(id => {
                const c = state.workspace.characters?.find(char => char.id === id);
                if (c && rec.entityVersions['character:'+c.id] && rec.entityVersions['character:'+c.id] < (c.entityVersion || 1)) {
                    isStale = true;
                }
            });
        }
    });

    // Option: only consider the 'approved' keyframes or the *latest* ones. 
    // Right now, if ANY image is stale, the shot is stale.
    return isStale;
}
