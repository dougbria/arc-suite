import state from '@arc/state.js';
import './episode-manager.js';
import './shot-manager.js';
import { promptUser, promptSelect, alertUser } from '@arc/utils.js';
import { checkShotStaleness } from './staleness.js';

export function initStoryboardUI() {
    const storyboardTabContainer = document.getElementById('storyboard-tabs');
    const storyboardGrid = document.getElementById('storyboard-grid');
    const addEpisodeBtn = document.getElementById('add-episode-btn');
    const delEpisodeBtn = document.getElementById('del-episode-btn');
    
    if (delEpisodeBtn) {
        delEpisodeBtn.addEventListener('click', async () => {
            if (!state.activeEpisode) return;
            const ok = await confirm(`Are you sure you want to delete episode "${state.activeEpisode.title}"?`);
            if (ok) {
                 await state.deleteEpisode(state.activeEpisode.id);
                 if (state.workspace && state.workspace.episodes && state.workspace.episodes.length > 0) {
                     await state.loadActiveEpisode(state.workspace.episodes[0].id);
                 }
            }
        });
    }
    
    // Add grid/strip toggle
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-sm btn-secondary';
    toggleBtn.textContent = state.storyboardViewMode === 'strip' ? 'Grid View' : 'Strip View';
    toggleBtn.style.marginLeft = '1rem';
    toggleBtn.addEventListener('click', () => {
         state.storyboardViewMode = state.storyboardViewMode === 'strip' ? 'grid' : 'strip';
         toggleBtn.textContent = state.storyboardViewMode === 'strip' ? 'Grid View' : 'Strip View';
         renderStoryboardGrid(storyboardGrid);
    });
    addEpisodeBtn.parentNode.insertBefore(toggleBtn, addEpisodeBtn);
    
    // Auto-select episode if 1 exists
    state.on('workspaceChanged', async () => {
        if (!state.workspace) return;
        
        // Initial episodes array
        if (!state.workspace.episodes) {
            state.workspace.episodes = [];
        }
        
        if (!state.activeEpisode && state.workspace.episodes.length > 0) {
            // grab first episode as default load
            const firstEp = state.workspace.episodes[0];
            await state.loadActiveEpisode(firstEp.id);
        } else if (!state.activeEpisode) {
            storyboardGrid.innerHTML = `
                <div class="empty-state">
                    <h3>No Episodes Found</h3>
                    <p>Create your first episode to begin boarding.</p>
                </div>
            `;
        }
        
        renderEpisodeTabs(storyboardTabContainer);
    });
    
    // Safety bridge: re-render cleanly when switching back to Production Board
    state.on('canvasModeChanged', () => {
        if (state.canvasMode === 'storyboard' && state.activeEpisode) {
             renderStoryboardGrid(storyboardGrid);
        }
    });
    
    state.on('episodeChanged', () => {
         renderEpisodeTabs(storyboardTabContainer);
         renderStoryboardGrid(storyboardGrid);
         if (delEpisodeBtn) {
             delEpisodeBtn.disabled = !state.activeEpisode;
         }
    });
    
    if (addEpisodeBtn) {
        addEpisodeBtn.addEventListener('click', async () => {
            // Auto increment highest EPxx value
            let maxNum = 0;
            if (state.workspace && state.workspace.episodes) {
                state.workspace.episodes.forEach(ep => {
                    const match = ep.title.match(/EP(\d{2,})/i);
                    if (match) {
                         const num = parseInt(match[1]);
                         if (num > maxNum) maxNum = num;
                    }
                });
            }
            if (maxNum === 0 && state.workspace?.episodes?.length > 0) {
                 maxNum = state.workspace.episodes.length;
            }
            const padded = 'EP' + String(maxNum + 1).padStart(2, '0');
            const epName = await promptUser('Episode Title (e.g. EP01_Pilot):', padded + '_');
            if (epName) {
                await state.addEpisode(epName);
            }
        });
    }

    initStoryboardFilters();
}

function initStoryboardFilters() {
    state.on('workspaceChanged', () => {
        if (!state.workspace) return;
        
        const fChar = document.getElementById('filter-character');
        const fLoc = document.getElementById('filter-location');
        if (fChar && state.workspace.characters) {
            fChar.innerHTML = '<option value="">All Characters</option>' + state.workspace.characters.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            fChar.value = state.storyboardFilters.characterIds[0] || '';
        }
        if (fLoc && state.workspace.locations) {
            fLoc.innerHTML = '<option value="">All Locations</option>' + state.workspace.locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
            fLoc.value = state.storyboardFilters.locationIds[0] || '';
        }
    });

    state.on('episodeChanged', () => {
        if (!state.activeEpisode) return;
        const fScene = document.getElementById('filter-scene');
        if (fScene) {
            fScene.innerHTML = '<option value="">All Scenes</option>' + state.activeEpisode.scenes.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
            fScene.value = ''; // Force reset 
        }
        // Purge ghost filter value
        if (state.storyboardFilters) {
             state.storyboardFilters.sceneId = null;
        }
    });

    const fChar = document.getElementById('filter-character');
    const fLoc = document.getElementById('filter-location');
    const fScene = document.getElementById('filter-scene');
    const fStat = document.getElementById('filter-status');
    const fStar = document.getElementById('filter-starred');
    const fStale = document.getElementById('filter-stale');
    
    // Wire changes to re-render grid
    const updateFilters = () => {
        state.storyboardFilters.characterIds = fChar.value ? [fChar.value] : [];
        state.storyboardFilters.locationIds = fLoc.value ? [fLoc.value] : [];
        state.storyboardFilters.statuses = fStat.value ? [fStat.value] : [];
        state.storyboardFilters.sceneId = fScene.value || null;
        state.storyboardFilters.starredOnly = fStar.checked;
        state.storyboardFilters.staleOnly = fStale.checked;
        
        renderStoryboardGrid(document.getElementById('storyboard-grid'));
    };

    [fChar, fLoc, fScene, fStat].forEach(el => el?.addEventListener('change', updateFilters));
    [fStar, fStale].forEach(el => el?.addEventListener('change', updateFilters));
}

function renderEpisodeTabs(container) {
    if (!container) return;
    container.innerHTML = '';
    
    if (state.workspace && state.workspace.episodes) {
        state.workspace.episodes.forEach(ep => {
            const btn = document.createElement('button');
            btn.className = `btn btn-sm ${state.activeEpisode?.id === ep.id ? 'active' : ''}`;
            btn.textContent = ep.title;
            btn.addEventListener('click', async () => {
                await state.loadActiveEpisode(ep.id);
            });
            container.appendChild(btn);
        });
    }
}

function renderStoryboardGrid(container) {
    if (!container) return;
    container.innerHTML = '';
    
    if (!state.activeEpisode) {
         container.innerHTML = '<div class="empty-state">No Active Episode.</div>';
         return;
    }
    
    const ep = state.activeEpisode;
    
    if (ep.scenes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
               <h3>${ep.title}</h3>
               <p>This episode has no scenes yet.</p>
               <button class="btn btn-primary" id="first-scene-btn">Add Scene</button>
            </div>
        `;
        document.getElementById('first-scene-btn')?.addEventListener('click', async () => {
            await handleCreateScene(ep);
        });
        return;
    }
    
    // Render Scenes and Shots
    const isStrip = state.storyboardViewMode === 'strip';
    
    ep.scenes.forEach((scene, index) => {
        const f = state.storyboardFilters;
        if (f.sceneId && scene.id !== f.sceneId) return;

        const loc = state.workspace.locations?.find(l => l.id === scene.locationId);
        const locName = loc ? loc.name : 'Unknown Location';

        const sceneEl = document.createElement('div');
        sceneEl.className = 'scene-container';
        sceneEl.innerHTML = `
            <div class="scene-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <h3>${scene.title} <span style="font-size:0.8em; color:var(--text-muted); font-weight:normal;">— ${locName}</span></h3>
                    <button class="btn btn-sm btn-edit-scene" style="padding:0.2rem 0.5rem" title="Edit Scene">✏️</button>
                    <button class="btn btn-sm btn-delete-scene" style="padding:0.2rem 0.5rem; background:transparent; color:var(--danger)" title="Delete Scene">🗑️</button>
                </div>
                <button class="btn btn-sm btn-add-shot">Add Shot</button>
            </div>
            <div class="shot-grid ${isStrip ? 'storyboard-row' : ''}" style="display:flex; ${!isStrip ? 'gap:1rem; flex-wrap:wrap; overflow-visible;' : ''} padding: 1rem 0;">
                <!-- Shots go here -->
            </div>
        `;
        
        const shotGrid = sceneEl.querySelector('.shot-grid');
        
        sceneEl.querySelector('.btn-edit-scene').addEventListener('click', async () => {
            await handleEditScene(ep, scene);
        });
        
        sceneEl.querySelector('.btn-delete-scene').addEventListener('click', async () => {
            if (await confirmUser(`Are you sure you want to delete "${scene.title}" and all its shots?`)) {
                await state.removeSceneFromEpisode(scene.id);
            }
        });

        if (scene.shots.length === 0) {
            shotGrid.innerHTML = '<div class="text-muted">No shots in this scene.</div>';
        } else {
            // Sort shots according to spec before rendering
            const sortedShots = [...scene.shots].sort((a, b) => {
                const diff = (a.shotNumber || 0) - (b.shotNumber || 0);
                if (diff !== 0) return diff;
                return (a.suffix || '').localeCompare(b.suffix || '');
            });

            sortedShots.forEach(shot => {
                // Apply Filters
                const f = state.storyboardFilters;
                if (f.characterIds.length > 0 && (!shot.characterIds || !shot.characterIds.includes(f.characterIds[0]))) return;
                if (f.locationIds.length > 0 && scene.locationId !== f.locationIds[0]) return;
                
                const isStale = checkShotStaleness(shot, scene);
                if (f.staleOnly && !isStale) return;
                
                // Read from underlying project for thumbnails
                const proj = state.projects[shot.id];
                const thumbCount = proj ? proj.images.length : 0;
                
                let thumbHtml = '';
                let thumbImg = null;
                if (shot.approvedImageId && proj) {
                     thumbImg = proj.images.find(i => i.id === shot.approvedImageId);
                }
                if (!thumbImg && proj && proj.images.length > 0) {
                     thumbImg = proj.images[0];
                }
                if (thumbImg) {
                     thumbHtml = `<img src="${thumbImg.thumbnail || thumbImg.base64}" alt="Thumbnail" />`;
                } else {
                     thumbHtml = '<span class="text-muted">No Images</span>';
                }
                
                const shotCard = document.createElement('div');
                shotCard.style.cursor = 'pointer';
                
                if (isStrip) {
                    shotCard.className = 'frame-cell';
                    if (isStale) shotCard.style.border = '2px solid var(--warning)';
                    shotCard.innerHTML = `
                        <div class="frame-image">
                            ${thumbHtml}
                            ${thumbCount > 0 ? `<div style="position:absolute; bottom:4px; right:4px;"><span class="badge" style="background:rgba(0,0,0,0.7); font-size:0.7rem;">${thumbCount} KFs</span></div>` : ''}
                        </div>
                        <div class="frame-meta">
                            <div class="frame-title" title="${shot.action?.replace(/"/g, '&quot;')}">${shot.action || 'Untitled Shot'}</div>
                            <div class="frame-desc">${proj ? proj.name : 'Unknown v' + (shot.entityVersion || 1)}</div>
                        </div>
                        ${isStale ? '<div style="position:absolute; top:4px; right:4px;"><span class="badge" style="background:var(--warning); color:#000;">STALE</span></div>' : ''}
                    `;
                } else {
                    shotCard.className = 'registry-card shot-card';
                    shotCard.style.width = '240px';
                    shotCard.style.minWidth = '240px';
                    if (isStale) shotCard.style.border = '2px solid var(--warning)';
                    shotCard.innerHTML = `
                        <div class="card-header" style="background:#222; border-bottom:1px solid #333; padding: 0.5rem;">
                             <div style="color:var(--text-muted); font-size:0.75rem; margin-bottom:0.25rem;">${proj ? proj.name : 'Unknown'}</div>
                             <strong style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${shot.action?.replace(/"/g, '&quot;')}">${shot.action || 'Untitled Shot'}</strong>
                             ${isStale ? '<span class="badge" style="background:var(--warning); color:#000;">STALE</span>' : ''}
                        </div>
                        <div style="height: 120px; background: #111; display:flex; align-items:center; justify-content:center; flex: 1; position:relative; overflow:hidden;">
                             ${thumbHtml}
                             ${thumbCount > 0 ? `<div style="position:absolute; bottom:4px; right:4px;"><span class="badge" style="background:rgba(0,0,0,0.7); font-size:0.7rem;">${thumbCount} KFs</span></div>` : ''}
                        </div>
                        <div style="padding: 0.5rem; display:flex; justify-content:space-between; align-items:center;">
                             <span class="badge" style="background:var(--surface-color)">v${shot.entityVersion || 1}</span>
                             <div style="display:flex; gap:0.25rem;">
                                 <button class="btn btn-sm btn-gen-shot" style="background:var(--accent-color)" title="Generate Image">Generate</button>
                                 <button class="btn btn-sm btn-del-shot" style="background:var(--danger)" title="Delete">Delete</button>
                             </div>
                        </div>
                    `;
                    
                    shotCard.querySelector('.btn-del-shot').addEventListener('click', async (e) => {
                        e.stopPropagation(); // prevent card click
                        await state.removeShotFromScene(scene.id, shot.id);
                    });
                    
                    shotCard.querySelector('.btn-gen-shot').addEventListener('click', async (e) => {
                        e.stopPropagation();
                        state.activeShotId = shot.id;
                        state.switchProject(shot.id);
                        document.querySelector('#nav-btn-generate')?.click();
                    });
                }
                
                shotCard.addEventListener('click', () => {
                   state.activeShotId = shot.id;
                   state.switchProject(shot.id);
                   document.querySelector('button[data-mode="image"]')?.click();
                });
                shotGrid.appendChild(shotCard);
            });
            
            // If filters hid all shots, but there were shots
            if (shotGrid.children.length === 0) {
                 shotGrid.innerHTML = '<div class="text-muted">All shots filtered out.</div>';
            }
        }
        
        sceneEl.querySelector('.btn-add-shot').addEventListener('click', async () => {
            await handleCreateShot(scene);
        });
        
        container.appendChild(sceneEl);
    });
    
    // Add Scene button at the bottom
    const addSceneBtn = document.createElement('button');
    addSceneBtn.className = 'btn btn-secondary';
    addSceneBtn.textContent = 'Add Another Scene';
    addSceneBtn.style.marginTop = '2rem';
    addSceneBtn.addEventListener('click', async () => {
         await handleCreateScene(ep);
    });
    
    container.appendChild(addSceneBtn);
}

// Custom Dialog for Scene Creation (handles Naming Convention)
async function handleCreateScene(ep) {
    let nextNum = 10;
    if (ep.scenes && ep.scenes.length > 0) {
        const nums = ep.scenes.map(s => s.sceneNumber || 0).filter(n => !isNaN(n));
        if (nums.length > 0) nextNum = Math.max(...nums) + 10;
    }
    
    const locs = state.workspace?.locations || [];
    if (locs.length === 0) {
        await alertUser("Please add at least one Location in the Setup > Locations registry first.");
        return;
    }

    const res = await new Promise(resolve => {
        const dialog = document.createElement('dialog');
        dialog.className = "modal";
        dialog.style.padding = "2rem";
        dialog.style.width = "400px";
        dialog.innerHTML = `
            <form method="dialog" style="display:flex; flex-direction:column; gap:1rem;">
                <h3 style="margin:0;">Create Scene</h3>
                <div class="form-group">
                    <label>Scene Number (SC00xx)</label>
                    <input type="number" id="inp-sc-num" class="form-control" value="${nextNum}" min="1">
                </div>
                <div class="form-group">
                    <label>Base Name</label>
                    <input type="text" id="inp-sc-base" class="form-control" placeholder="e.g. Apartment Night">
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <select id="inp-sc-loc" class="form-control" style="background:var(--bg-tertiary); color:white;"></select>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
                    <button type="button" id="btn-sc-cancel" class="btn btn-secondary">Cancel</button>
                    <button type="submit" value="confirm" class="btn btn-primary">Create</button>
                </div>
            </form>
        `;
        document.body.appendChild(dialog);
        
        const sel = dialog.querySelector('#inp-sc-loc');
        locs.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id; opt.textContent = l.name;
            sel.appendChild(opt);
        });

        dialog.querySelector('#btn-sc-cancel').onclick = () => dialog.close('cancel');
        dialog.onclose = () => {
            document.body.removeChild(dialog);
            if (dialog.returnValue === 'confirm') {
                resolve({
                    sceneNum: parseInt(dialog.querySelector('#inp-sc-num').value) || nextNum,
                    baseName: dialog.querySelector('#inp-sc-base').value.trim(),
                    locId: sel.value
                });
            } else resolve(null);
        };
        dialog.showModal();
    });

    if (!res || !res.sceneNum || !res.baseName || !res.locId) return;

    // Use string slug for human display
    const padded = String(res.sceneNum).padStart(4, '0');
    const slug = res.baseName.replace(/\s+/g, '_');
    const fullTitle = `SC${padded}_${slug}`;

    await state.addSceneToActiveEpisode(fullTitle, res.locId, res.sceneNum, res.baseName);
}

// Custom Dialog for Editing a Scene
async function handleEditScene(ep, scene) {
    const locs = state.workspace?.locations || [];
    
    const res = await new Promise(resolve => {
        const dialog = document.createElement('dialog');
        dialog.className = "modal";
        dialog.style.padding = "2rem";
        dialog.style.width = "400px";
        dialog.innerHTML = `
            <form method="dialog" style="display:flex; flex-direction:column; gap:1rem;">
                <h3 style="margin:0;">Edit Scene</h3>
                <div class="form-group">
                    <label>Scene Number (SC00xx)</label>
                    <input type="number" id="inp-esc-num" class="form-control" value="${scene.sceneNumber || 10}" min="1">
                </div>
                <div class="form-group">
                    <label>Base Name</label>
                    <input type="text" id="inp-esc-base" class="form-control" value="${scene.baseName || ''}" placeholder="e.g. Apartment Night">
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <select id="inp-esc-loc" class="form-control" style="background:var(--bg-tertiary); color:white;"></select>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
                    <button type="button" id="btn-esc-cancel" class="btn btn-secondary">Cancel</button>
                    <button type="submit" value="confirm" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        `;
        document.body.appendChild(dialog);
        
        const sel = dialog.querySelector('#inp-esc-loc');
        locs.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id; opt.textContent = l.name;
            if (l.id === scene.locationId) opt.selected = true;
            sel.appendChild(opt);
        });

        dialog.querySelector('#btn-esc-cancel').onclick = () => dialog.close('cancel');
        dialog.onclose = () => {
            document.body.removeChild(dialog);
            if (dialog.returnValue === 'confirm') {
                resolve({
                    sceneNum: parseInt(dialog.querySelector('#inp-esc-num').value) || 10,
                    baseName: dialog.querySelector('#inp-esc-base').value.trim(),
                    locId: sel.value
                });
            } else resolve(null);
        };
        dialog.showModal();
    });

    if (!res || !res.baseName || !res.locId) return;

    const padded = String(res.sceneNum).padStart(4, '0');
    const slug = res.baseName.replace(/\s+/g, '_');
    
    scene.sceneNumber = res.sceneNum;
    scene.baseName = res.baseName;
    scene.locationId = res.locId;
    scene.title = `SC${padded}_${slug}`;

    // Await global save from state
    if (state.saveActiveEpisode) {
        await state.saveActiveEpisode();
        state.emit('episodeChanged');
    }
}

// Custom Dialog for Shot Creation
async function handleCreateShot(scene) {
    let nextNum = 10;
    if (scene.shots && scene.shots.length > 0) {
        const nums = scene.shots.map(s => s.shotNumber || 0).filter(n => !isNaN(n));
        if (nums.length > 0) nextNum = Math.max(...nums) + 10;
    }

    const res = await new Promise(resolve => {
        const dialog = document.createElement('dialog');
        dialog.className = "modal";
        dialog.style.padding = "2rem";
        dialog.style.width = "400px";
        dialog.innerHTML = `
            <form method="dialog" style="display:flex; flex-direction:column; gap:1rem;">
                <h3 style="margin:0;">Create Shot</h3>
                <div style="display:flex; gap:0.5rem;">
                    <div class="form-group" style="flex:1;">
                        <label>Shot Number</label>
                        <input type="number" id="inp-sh-num" class="form-control" value="${nextNum}" min="1">
                    </div>
                    <div class="form-group" style="width: 80px;">
                        <label>Suffix</label>
                        <input type="text" id="inp-sh-suf" class="form-control" placeholder="e.g. a" maxlength="4">
                    </div>
                </div>
                <div class="form-group">
                    <label>Initial Action / Prompt</label>
                    <textarea id="inp-sh-act" class="form-control" rows="2" placeholder="Describe the shot action..."></textarea>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
                    <button type="button" id="btn-sh-cancel" class="btn btn-secondary">Cancel</button>
                    <button type="submit" value="confirm" class="btn btn-primary">Create</button>
                </div>
            </form>
        `;
        document.body.appendChild(dialog);
        
        dialog.querySelector('#btn-sh-cancel').onclick = () => dialog.close('cancel');
        dialog.onclose = () => {
            document.body.removeChild(dialog);
            if (dialog.returnValue === 'confirm') {
                resolve({
                    shotNum: parseInt(dialog.querySelector('#inp-sh-num').value) || nextNum,
                    suffix: dialog.querySelector('#inp-sh-suf').value.trim().toLowerCase().slice(0,4),
                    action: dialog.querySelector('#inp-sh-act').value.trim()
                });
            } else resolve(null);
        };
        dialog.showModal();
    });

    if (!res) return;
    await state.addShotToScene(scene.id, res.action || '', res.shotNum, res.suffix);
}
