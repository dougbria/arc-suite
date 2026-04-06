import state from '@arc/state.js';
import { saveActiveEpisode } from './episode-manager.js';
import { promptUser } from '@arc/utils.js';

export function initReviewUI() {
    const btnApprove = document.getElementById('nav-btn-approve');
    if (!btnApprove) return;

    // Show approve button only if in image view and we have an active shot
    state.on('canvasModeChanged', updateApproveButton);
    state.on('projectLoaded', updateApproveButton);
    state.on('imageFeatured', updateApproveButton);
    state.on('workspaceChanged', updateApproveButton);

    btnApprove.addEventListener('click', async () => {
        if (state.activeEntityId) {
            const featured = state.getFeaturedImage();
            if (!featured) {
                alert("No image featured to approve.");
                return;
            }
            const arr = state.activeEntityType === 'character' ? state.workspace.characters : state.workspace.locations;
            const entity = arr?.find(e => e.id === state.activeEntityId);
            if (!entity) return;
            
            if (!entity.referenceImageIds) entity.referenceImageIds = [];
            if (!entity.referenceImageIds.includes(featured.id)) {
                entity.referenceImageIds.unshift(featured.id);
            }
            
            if (featured.prompt && featured.prompt.trim().startsWith('{')) {
                entity.vgl.structured_prompt = featured.prompt;
            }
            
            entity.updatedAt = Date.now();
            entity.entityVersion++;
            
            await state.saveWorkspace();
            state.emit('projectChanged');
            updateApproveButton();
            console.log(`Approved Reference and VGL for ${entity.name}`);
            return;
        }

        if (!state.activeEpisode || !state.activeShotId) return;
        
        const featured = state.getFeaturedImage();
        if (!featured) {
            alert("No image featured to approve.");
            return;
        }

        let targetShot = null;
        for (const scene of state.activeEpisode.scenes) {
            targetShot = scene.shots.find(s => s.id === state.activeShotId);
            if (targetShot) break;
        }

        if (!targetShot) return;

        if (!targetShot.keyframes || targetShot.keyframes.length === 0) {
            // Auto add a keyframe if none existed
            targetShot.keyframes = [{ action: targetShot.action }];
        }

        // Quick dialogue to ask which keyframe if > 1
        let kfIndex = 0;
        if (targetShot.keyframes.length > 1) {
            const options = targetShot.keyframes.map((kf, i) => `[${i+1}] ${kf.action || 'Keyframe'}`).join('\n');
            const res = await promptUser(`Approve as which keyframe? (Enter number 1-${targetShot.keyframes.length}):\n${options}`, '1');
            if (res === null) return;
            kfIndex = parseInt(res) - 1;
        }

        if (kfIndex >= 0 && kfIndex < targetShot.keyframes.length) {
            targetShot.keyframes[kfIndex].imageId = featured.id;
            
            // Check if all approved
            const allApproved = targetShot.keyframes.every(kf => kf.imageId);
            if (allApproved) {
                targetShot.status = 'approved';
            } else {
                targetShot.status = 'review';
            }

            await saveActiveEpisode();
            // Re-render UI
            state.emit('episodeChanged');
            updateApproveButton();
            // notify success inline via existing toast (just alert for now if absent)
            console.log(`Approved image ${featured.id} for Keyframe ${kfIndex + 1}`);
            // visually update image info bar
            btnApprove.textContent = "✔ Approved KF" + (kfIndex + 1);
            btnApprove.style.background = 'var(--accent-color)';
        }
    });
}

function updateApproveButton() {
    const btnApprove = document.getElementById('nav-btn-approve');
    if (!btnApprove) return;

    // Reset default
    btnApprove.textContent = "Approve KF";
    btnApprove.style.background = 'var(--success)';

    if (state.canvasMode === 'image' && state.activeEntityId) {
        if (state.getFeaturedImage()) {
            btnApprove.style.display = 'inline-block';
            btnApprove.textContent = "Approve VGL & Ref";
            
            const arr = state.activeEntityType === 'character' ? state.workspace.characters : state.workspace.locations;
            const entity = arr?.find(e => e.id === state.activeEntityId);
            const featured = state.getFeaturedImage();
            
            if (entity && featured && entity.referenceImageIds?.includes(featured.id)) {
                btnApprove.textContent = "✔ Approved Ref";
                btnApprove.style.background = 'var(--accent-color)';
            }
        } else {
            btnApprove.style.display = 'none';
        }
        return;
    }

    if (state.canvasMode === 'image' && state.activeShotId && state.activeEpisode) {
        // Double check this project is a shot
        const isShot = Array.from(state.activeEpisode.scenes).some(scene => 
             scene.shots.some(shot => shot.id === state.activeShotId)
        );
        if (isShot && state.getFeaturedImage()) {
            btnApprove.style.display = 'inline-block';
            
            // If already approved for any KF
            let targetShot = null;
            for (const scene of state.activeEpisode.scenes) {
                targetShot = scene.shots.find(s => s.id === state.activeShotId);
                if (targetShot) break;
            }
            if (targetShot && targetShot.keyframes) {
                const featured = state.getFeaturedImage();
                const matchedIdx = targetShot.keyframes.findIndex(kf => kf.imageId === featured.id);
                if (matchedIdx >= 0) {
                    btnApprove.textContent = "✔ Approved KF" + (matchedIdx + 1);
                    btnApprove.style.background = 'var(--accent-color)';
                }
            }
            
            return;
        }
    }
    btnApprove.style.display = 'none';
}
