import state from '@arc/state.js';
import { generateUUID } from '@arc/utils.js';
import { saveActiveEpisode } from './episode-manager.js';

export async function createShot(sceneId, prompt, shotNum = 10, suffix = '') {
    if (!state.activeEpisode) return null;
    
    // Find the scene
    const scene = state.activeEpisode.scenes.find(s => s.id === sceneId);
    if (!scene) return null;

    // Auto-create the Arc project back-end
    const newProject = await state.createProject(`SH${String(shotNum).padStart(4, '0')}${suffix}`);

    const shot = {
        id: newProject.id, // Linking the shot ID exactly to the projectId
        sceneId: sceneId,
        shotNumber: shotNum,
        suffix: suffix,
        action: prompt,  // core prompt
        characterIds: [],
        camera: {},
        keyframes: [],
        status: 'draft', // draft, ready, generating, review, approved
        entityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    scene.shots.push(shot);
    await saveActiveEpisode();
    state.emit('episodeChanged');
    
    // Switch to this new backing project so generating images maps properly
    state.switchProject(newProject.id);

    return shot;
}

export async function deleteShot(sceneId, shotId) {
    if (!state.activeEpisode) return false;
    
    const scene = state.activeEpisode.scenes.find(s => s.id === sceneId);
    if (!scene) return false;

    // Delete Arc project data
    await state.deleteProject(shotId);

    scene.shots = scene.shots.filter(s => s.id !== shotId);
    await saveActiveEpisode();
    state.emit('episodeChanged');
    return true;
}

state.addShotToScene = createShot;
state.removeShotFromScene = deleteShot;
