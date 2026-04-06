import state from '@arc/state.js';
import { promptUser, promptSelect } from '@arc/utils.js';
import { saveActiveEpisode } from './episode-manager.js';

export function initSidebarController() {
    const sidebar = document.getElementById('storyboard-sidebar');
    if (!sidebar) return;

    state.on('canvasModeChanged', renderSidebar);
    state.on('episodeChanged', renderSidebar);

    const toggleBtn = document.getElementById('storyboard-sidebar-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isCollapsed = sidebar.style.width === '0px';
            sidebar.style.width = isCollapsed ? '300px' : '0px';
            // Hide padding when collapsed to avoid spilling
            sidebar.style.padding = isCollapsed ? '' : '0px';
            toggleBtn.textContent = isCollapsed ? '▶' : '◀';
        });
    }

    // Patch state to listen for active shot changes
    const originalSwitchProject = state.switchProject;
    state.switchProject = function(id) {
        originalSwitchProject.call(state, id);
        if (state.canvasMode === 'storyboard') {
            state.activeShotId = id;
            renderSidebar();
        }
    };
}

function renderSidebar() {
    const sidebar = document.getElementById('storyboard-sidebar');
    if (!sidebar) return;

    if (state.canvasMode !== 'storyboard') {
        sidebar.innerHTML = ''; // maybe hide the sidebar entirely using CSS based on canvasMode instead
        return;
    }

    if (!state.activeShotId) {
        sidebar.innerHTML = `
            <div style="padding: 1rem;">
                <h3>Production Overview</h3>
                <p class="text-muted">Select a shot to view its details, or select an entity to edit.</p>
            </div>
        `;
        return;
    }

    // Find the shot
    let targetShot = null;
    let targetScene = null;
    if (state.activeEpisode) {
        for (const scene of state.activeEpisode.scenes) {
            const shot = scene.shots.find(s => s.id === state.activeShotId);
            if (shot) {
                targetShot = shot;
                targetScene = scene;
                break;
            }
        }
    }

    if (!targetShot) {
        sidebar.innerHTML = `<div style="padding: 1rem;" class="text-muted">Shot not found.</div>`;
        return;
    }

    // Render Shot Details
    sidebar.innerHTML = `
        <div style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
            <h3>Shot Details</h3>
            <div class="form-group" style="margin-top:1rem;">
                <label>Action / Prompt</label>
                <textarea id="sb-shot-action" rows="3" style="width:100%; box-sizing:border-box;">${targetShot.action || ''}</textarea>
            </div>
            <div class="form-group" style="margin-top:1rem;">
                <label>Characters</label>
                <div id="sb-shot-chars" style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem;"></div>
                <button id="sb-add-char-btn" class="btn btn-sm btn-secondary" style="margin-top:0.5rem;">Add Character</button>
            </div>
            <div class="form-group" style="margin-top:1rem;">
                <label>Keyframes</label>
                <div id="sb-shot-keyframes" style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;"></div>
                <button id="sb-add-kf-btn" class="btn btn-sm btn-secondary" style="margin-top:0.5rem;">Add Keyframe</button>
            </div>
            <div class="form-group" style="margin-top:1rem;">
                <label>Notes</label>
                <textarea id="sb-shot-notes" rows="2" style="width:100%; box-sizing:border-box;">${targetShot.notes || ''}</textarea>
            </div>
            
            <button id="sb-btn-gen-all" class="btn btn-primary" style="margin-top:1.5rem; width:100%;">Generate Shot Keyframes</button>
        </div>
    `;

    // Hook inputs
    const actionInput = document.getElementById('sb-shot-action');
    actionInput.addEventListener('change', async () => {
        targetShot.action = actionInput.value;
        await saveActiveEpisode();
        state.emit('episodeChanged');
    });

    // Populate characters
    const charsContainer = document.getElementById('sb-shot-chars');
    targetShot.characterIds.forEach(id => {
        const c = state.workspace.characters.find(c => c.id === id);
        if (c) {
             const badge = document.createElement('span');
             badge.className = 'badge';
             badge.style.background = 'var(--primary)';
             badge.textContent = c.name + ' ×';
             badge.style.cursor = 'pointer';
             badge.addEventListener('click', async () => {
                 targetShot.characterIds = targetShot.characterIds.filter(cid => cid !== id);
                 await saveActiveEpisode();
                 renderSidebar();
             });
             charsContainer.appendChild(badge);
        }
    });

    document.getElementById('sb-add-char-btn').addEventListener('click', async () => {
        if (!state.workspace.characters || state.workspace.characters.length === 0) {
            await alert("No characters in workspace.");
            return;
        }
        
        // Use promptSelect instead of text input
        const options = state.workspace.characters.map(c => ({ label: c.name || 'Unnamed', value: c.id }));
        const charId = await promptSelect('Select Character to Add', options);
        if (!charId) return;

        if (!targetShot.characterIds.includes(charId)) {
            targetShot.characterIds.push(charId);
            await saveActiveEpisode();
            renderSidebar();
        }
    });

    // Notes
    const notesInput = document.getElementById('sb-shot-notes');
    notesInput.addEventListener('change', async () => {
        targetShot.notes = notesInput.value;
        await saveActiveEpisode();
    });

    // Keyframes
    const kfContainer = document.getElementById('sb-shot-keyframes');
    if (!targetShot.keyframes) targetShot.keyframes = [];
    targetShot.keyframes.forEach((kf, idx) => {
         const kfEl = document.createElement('div');
         kfEl.className = 'registry-card';
         kfEl.style.padding = '0.5rem';
         kfEl.innerHTML = `
             <div style="font-size:0.8rem; color:var(--text-muted); display:flex; justify-content:space-between;">
                <span>Keyframe ${idx + 1}</span>
                <span class="btn-del-kf" style="cursor:pointer; color:var(--danger)">X</span>
             </div>
             <input type="text" class="kf-action-input" value="${kf.action || ''}" placeholder="Specific keyframe action..." style="width:100%; margin-top:0.25rem;">
         `;
         kfEl.querySelector('.kf-action-input').addEventListener('change', async (e) => {
             kf.action = e.target.value;
             await saveActiveEpisode();
         });
         kfEl.querySelector('.btn-del-kf').addEventListener('click', async () => {
             targetShot.keyframes.splice(idx, 1);
             await saveActiveEpisode();
             renderSidebar();
         });
         kfContainer.appendChild(kfEl);
    });

    document.getElementById('sb-add-kf-btn').addEventListener('click', async () => {
         targetShot.keyframes.push({ action: '' });
         await saveActiveEpisode();
         renderSidebar();
    });

    document.getElementById('sb-btn-gen-all').addEventListener('click', () => {
         // Auto-generate all keyframes using the main generator for now
         state.activeShotId = targetShot.id;
         state.switchProject(targetShot.id);
         const promptInput = document.getElementById('prompt-input');
         const imageCount = document.getElementById('image-count-select');
         if (promptInput) promptInput.value = targetShot.action;
         if (imageCount) imageCount.value = Math.max(1, targetShot.keyframes.length); // simple mapping
         
         const charSelect = document.getElementById('prompt-char-select');
         const locSelect = document.getElementById('prompt-loc-select');
         if (charSelect && targetShot.characterIds.length > 0) {
              Array.from(charSelect.options).forEach(opt => {
                   opt.selected = targetShot.characterIds.includes(opt.value);
              });
         }
         if (locSelect && targetScene.locationId) {
              locSelect.value = targetScene.locationId;
         }
         
         document.getElementById('btn-generate')?.click();
         document.querySelector('#nav-btn-inspector')?.click();
    });
}
