import state from '@arc/state.js';
import { fsStorage } from '@arc/fs-storage.js';
import { generateUUID, promptUser, promptSelect, alertUser } from '@arc/utils.js';
import { EntityEditor } from '@arc/core';
import { generateBreakdown } from './script-breakdown.js';

export function initSetupCanvas() {
    console.log('[SetupCanvas] Initializing setup canvas...');
    const workspaceTitle = document.getElementById('workspace-title');
    const newWorkspaceBtn = document.getElementById('setup-new-workspace-btn');
    const styleNameInput = document.getElementById('style-name');
    const styleDescInput = document.getElementById('style-desc');

    state.on('workspaceChanged', () => {
        if (!state.workspace) {
            workspaceTitle.textContent = 'No Workspace Loaded';
            return;
        }
        workspaceTitle.textContent = state.workspace.name || 'Untitled Workspace';
        
        if (state.workspace.style) {
            if (styleNameInput) styleNameInput.value = state.workspace.style.name || '';
            if (styleDescInput) styleDescInput.value = state.workspace.style.description || '';
            const styleContainer = document.getElementById('style-editor-container');
            if (styleContainer) {
                new EntityEditor().renderEditor(styleContainer, state.workspace.style, 'style');
            }
        }
        
        renderEntityLists();
    });

    const addCharBtn = document.getElementById('add-character-btn');
    if (addCharBtn) {
        addCharBtn.addEventListener('click', () => {
            if (!state.workspace) return;
            const newChar = {
                id: 'char_' + crypto.randomUUID(),
                name: 'New Character',
                isLocked: false,
                vgl: { description: '' },
                referenceImageIds: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                entityVersion: 1,
                entityHistory: []
            };
            state.workspace.characters.push(newChar);
            state.saveWorkspace();
            state.editingEntity = newChar;
            renderEntityLists();
        });
    }

    const addLocBtn = document.getElementById('add-location-btn');
    if (addLocBtn) {
        addLocBtn.addEventListener('click', () => {
            if (!state.workspace) return;
            const newLoc = {
                id: 'loc_' + crypto.randomUUID(),
                name: 'New Location',
                isLocked: false,
                vgl: { background_setting: '', lighting: {} },
                referenceImageIds: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                entityVersion: 1,
                entityHistory: []
            };
            state.workspace.locations.push(newLoc);
            state.saveWorkspace();
            state.editingEntity = newLoc;
            renderEntityLists();
        });
    }

    if (newWorkspaceBtn) {
        newWorkspaceBtn.addEventListener('click', async () => {
            let list = [];
            if (state.storageType === 'fs') {
                list = await fsStorage.getWorkspaceList();
            } else {
                const rawList = localStorage.getItem('arcdrama-workspace-list');
                if (rawList) list = JSON.parse(rawList);
            }
            
            let name = await promptUser('Enter a unique name for the new Show:', 'New Microdrama');
            if (name) {
                 if (list.find(w => (w.name || '').toLowerCase() === name.toLowerCase())) {
                      await alertUser(`A Show with the name "${name}" already exists.`);
                      return;
                 }
                 await state.createWorkspace(name);
            }
        });
    }
    
    const switchWorkspaceBtn = document.getElementById('setup-switch-workspace-btn');
    if (switchWorkspaceBtn) {
        switchWorkspaceBtn.addEventListener('click', async () => {
            await openShowBrowser();
        });
    }

    if (styleNameInput) {
        styleNameInput.addEventListener('change', () => {
            if (state.workspace && state.workspace.style) {
                state.workspace.style.name = styleNameInput.value;
                state.workspace.style.entityVersion++;
                state.saveWorkspace();
            }
        });
    }

    if (styleDescInput) {
        styleDescInput.addEventListener('change', () => {
            if (state.workspace && state.workspace.style) {
                state.workspace.style.description = styleDescInput.value;
                state.workspace.style.entityVersion++;
                state.saveWorkspace();
            }
        });
    }

    const breakdownBtn = document.getElementById('btn-generate-breakdown');
    const sourceInput = document.getElementById('breakdown-input-source');
    const jsonOutput = document.getElementById('breakdown-output-json');
    const syncBtn = document.getElementById('btn-sync-breakdown');
    const popBtn = document.getElementById('btn-populate-breakdown');
    
    if (breakdownBtn && sourceInput) {
        breakdownBtn.addEventListener('click', async () => {
            if (!state.workspace) return alertUser('Please create a Show first.');
            const text = sourceInput.value.trim();
            if (!text) return alertUser('Please paste a script outline first.');
            
            const originalText = breakdownBtn.textContent;
            breakdownBtn.textContent = 'Analyzing Script... (May take 30-60s)';
            breakdownBtn.disabled = true;
            
            const epCount = document.getElementById('breakdown-target-episodes')?.value || '';
            const epDuration = document.getElementById('breakdown-target-duration')?.value || '';
            
            try {
                const breakdown = await generateBreakdown(text, epCount, epDuration);
                
                // Show raw JSON outline for editing
                const jsonText = JSON.stringify(breakdown, null, 2);
                jsonOutput.value = jsonText;
                updateEstimates(jsonText);
                
                // Save it to disk so we don't lose it!
                state.workspace.lastBreakdownSource = text;
                state.workspace.lastBreakdownJson = jsonText;
                await state.saveWorkspace();
                
                if (syncBtn) {
                    syncBtn.disabled = false;
                    syncBtn.classList.remove('btn-secondary');
                    syncBtn.classList.add('btn-primary');
                }
                if (popBtn) {
                    popBtn.disabled = false;
                    popBtn.classList.remove('btn-secondary');
                    popBtn.classList.add('btn-primary');
                }
                
            } catch (e) {
                alertUser('LLM Breakdown Failed: ' + e.message);
            } finally {
                breakdownBtn.textContent = originalText;
                breakdownBtn.disabled = false;
            }
        });
    }
    
    if (syncBtn && jsonOutput) {
        syncBtn.addEventListener('click', async () => {
             const text = jsonOutput.value.trim();
             if (!text) return;
             try {
                  const struct = JSON.parse(text);
                  syncBtn.textContent = 'Syncing...';
                  syncBtn.disabled = true;
                  
                  if (state.syncProductionBoard) {
                       await state.syncProductionBoard(struct);
                       alertUser('Draft synchronized to Production Board! Switch tabs to review sequences.');
                  }
                  
                  syncBtn.textContent = 'Sync to Production Board';
                  syncBtn.disabled = false;
                  syncBtn.classList.remove('btn-primary');
                  syncBtn.classList.add('btn-secondary');
             } catch (e) {
                  alertUser('Invalid Breakdown Formatting: ' + e.message);
                  syncBtn.disabled = false;
                  syncBtn.textContent = 'Sync to Production Board';
             }
        });
    }

    if (popBtn && jsonOutput) {
        popBtn.addEventListener('click', async () => {
             const text = jsonOutput.value.trim();
             if (!text) return;
             try {
                  const struct = JSON.parse(text);
                  popBtn.textContent = 'Populating...';
                  popBtn.disabled = true;
                  
                  if (state.populateEntities) {
                       await state.populateEntities(struct);
                       alertUser('Characters & Locations populated! Switch back to setup to review.');
                       renderEntityLists();
                  }
                  
                  popBtn.textContent = 'Populate Characters & Locations';
                  popBtn.disabled = false;
                  popBtn.classList.remove('btn-primary');
                  popBtn.classList.add('btn-secondary');
             } catch (e) {
                  alertUser('Invalid Breakdown Formatting: ' + e.message);
                  popBtn.disabled = false;
                  popBtn.textContent = 'Populate Characters & Locations';
             }
        });
    }

    // Breakdown Tabs Wiring
    const tabInteractiveBtn = document.getElementById('tab-btn-interactive');
    const tabScriptBtn = document.getElementById('tab-btn-script');
    const tabRawBtn = document.getElementById('tab-btn-raw');
    
    const viewInteractive = document.getElementById('breakdown-view-interactive');
    const viewScript = document.getElementById('breakdown-view-script');
    const viewRaw = document.getElementById('breakdown-output-json');
    
    const setTab = (activeId) => {
         if (!tabInteractiveBtn) return;
         tabInteractiveBtn.classList.toggle('active', activeId === 'interactive');
         tabScriptBtn.classList.toggle('active', activeId === 'script');
         tabRawBtn.classList.toggle('active', activeId === 'raw');
         
         viewInteractive.classList.toggle('hidden', activeId !== 'interactive');
         viewScript.classList.toggle('hidden', activeId !== 'script');
         viewRaw.classList.toggle('hidden', activeId !== 'raw');
    };
    
    if (tabInteractiveBtn) {
         tabInteractiveBtn.onclick = () => setTab('interactive');
         tabScriptBtn.onclick = () => setTab('script');
         tabRawBtn.onclick = () => setTab('raw');
    }

    // Call initial render in case it was loaded before this init
    if (state.workspace && workspaceTitle) {
        workspaceTitle.textContent = state.workspace.name;
        if (state.workspace.style) {
            if (styleNameInput) styleNameInput.value = state.workspace.style.name || '';
            if (styleDescInput) styleDescInput.value = state.workspace.style.description || '';
            const styleContainer = document.getElementById('style-editor-container');
            if (styleContainer) {
                new EntityEditor().renderEditor(styleContainer, state.workspace.style, 'style');
            }
        }
        
        // Restore target parameters
        const epCountInput = document.getElementById('breakdown-target-episodes');
        const epDurInput = document.getElementById('breakdown-target-duration');
        
        if (epCountInput && state.workspace.lastBreakdownEpCount) {
             epCountInput.value = state.workspace.lastBreakdownEpCount;
        }
        if (epDurInput && state.workspace.lastBreakdownEpDuration) {
             epDurInput.value = state.workspace.lastBreakdownEpDuration;
        }
        
        // Restore last breakdown draft
        if (sourceInput && state.workspace.lastBreakdownSource) {
            sourceInput.value = state.workspace.lastBreakdownSource;
        }
        if (jsonOutput && state.workspace.lastBreakdownJson) {
            jsonOutput.value = state.workspace.lastBreakdownJson;
            if (syncBtn) {
                 syncBtn.disabled = false;
                 syncBtn.classList.remove('btn-secondary');
                 syncBtn.classList.add('btn-primary');
            }
            if (popBtn) {
                 popBtn.disabled = false;
                 popBtn.classList.remove('btn-secondary');
                 popBtn.classList.add('btn-primary');
            }
        }
    }
    
    // Auto-save manual edits
    const bindAutoSave = (el, prop, callback) => {
        if (el) {
             el.addEventListener('input', () => {
                  if (state.workspace) {
                       state.workspace[prop] = el.value;
                       state.saveWorkspace(); // lazy persist
                  }
                  if (callback) callback(el.value);
             });
        }
    };
    
    bindAutoSave(jsonOutput, 'lastBreakdownJson', updateEstimates);
    bindAutoSave(sourceInput, 'lastBreakdownSource');
    bindAutoSave(document.getElementById('breakdown-target-episodes'), 'lastBreakdownEpCount');
    bindAutoSave(document.getElementById('breakdown-target-duration'), 'lastBreakdownEpDuration');
    
    // Initial compute
    if (jsonOutput) updateEstimates(jsonOutput.value);
}

function renderEntityLists() {
    if (!state.workspace) return;
    
    // Characters
    const charListEl = document.getElementById('character-registry-list');
    const charContainer = document.getElementById('character-editor-container');
    const charEmpty = document.getElementById('character-empty-state');
    
    if (charListEl) {
        charListEl.innerHTML = '';
        state.workspace.characters.forEach(char => {
            const item = document.createElement('div');
            item.className = `md-list-item ${state.editingEntity?.id === char.id ? 'active' : ''}`;
            item.innerHTML = `<strong>${char.name}</strong>`;
            
            // Add a small lock icon if it is locked
            if (char.isLocked) {
                item.innerHTML += ` <span style="font-size:0.8rem; opacity:0.6;">🔒</span>`;
            }
            
            item.onclick = () => {
                state.editingEntity = char;
                renderEntityLists(); // re-render to update active state
                charEmpty?.classList.add('hidden');
                charContainer?.classList.remove('hidden');
                charContainer.innerHTML = '';
                new EntityEditor().renderEditor(charContainer, state.editingEntity, 'character');
            };
            charListEl.appendChild(item);
        });
    }

    // Locations
    const locListEl = document.getElementById('location-registry-list');
    const locContainer = document.getElementById('location-editor-container');
    const locEmpty = document.getElementById('location-empty-state');

    if (locListEl) {
        locListEl.innerHTML = '';
        state.workspace.locations.forEach(loc => {
            const item = document.createElement('div');
            item.className = `md-list-item ${state.editingEntity?.id === loc.id ? 'active' : ''}`;
            item.innerHTML = `<strong>${loc.name}</strong>`;
            
            if (loc.isLocked) {
                item.innerHTML += ` <span style="font-size:0.8rem; opacity:0.6;">🔒</span>`;
            }

            item.onclick = () => {
                state.editingEntity = loc;
                renderEntityLists(); // re-render to update active state
                locEmpty?.classList.add('hidden');
                locContainer?.classList.remove('hidden');
                locContainer.innerHTML = '';
                new EntityEditor().renderEditor(locContainer, state.editingEntity, 'location');
            };
            locListEl.appendChild(item);
        });
    }
}

function updateEstimates(text) {
    const epSpan = document.getElementById('estimate-episodes');
    const runSpan = document.getElementById('estimate-runtime');
    if (!epSpan || !runSpan) return;
    
    if (!text || text.trim() === '') {
        epSpan.textContent = '0';
        runSpan.textContent = '0m';
        return;
    }
    
    try {
        const breakdown = JSON.parse(text);
        if (breakdown.episodes) {
            epSpan.textContent = breakdown.episodes.length;
            
            let totalShots = 0;
            breakdown.episodes.forEach(ep => {
                if (ep.scenes) {
                    ep.scenes.forEach(sc => {
                        if (sc.shots) totalShots += sc.shots.length;
                    });
                }
            });
            // Assume an average of 3 seconds per shot
            const totalSeconds = totalShots * 3;
            const mins = Math.floor(totalSeconds / 60);
            const secs = totalSeconds % 60;
            runSpan.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            
            // Extract screenplay
            const scriptView = document.getElementById('breakdown-script-content');
            if (scriptView) {
                 scriptView.textContent = breakdown.screenplay || 'No screenplay provided.';
            }
            
            // Build interactive tree
            const treeContainer = document.getElementById('breakdown-view-interactive');
            if (treeContainer) {
                 treeContainer.innerHTML = '';
                 const displayObj = { ...breakdown };
                 delete displayObj.screenplay; // Don't render the huge script in the JSON tree
                 renderInteractiveJson(treeContainer, displayObj, 0);
            }
            
        } else {
            epSpan.textContent = '0';
            runSpan.textContent = '0m';
        }
    } catch(e) {
        epSpan.textContent = '?';
        runSpan.textContent = '?';
    }
}

export function renderInteractiveJson(container, obj, level = 0) {
    if (obj === null || typeof obj !== 'object') {
        const span = document.createElement('span');
        span.textContent = JSON.stringify(obj);
        span.style.color = typeof obj === 'string' ? 'var(--accent-color)' : 'var(--text-primary)';
        container.appendChild(span);
        return;
    }
    
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            container.innerHTML += `<span style="color:var(--text-muted)">[]</span>`;
            return;
        }
        const wrapper = document.createElement('div');
        wrapper.style.paddingLeft = level > 0 ? '1rem' : '0';
        obj.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.style.marginBottom = '0.5rem';
            
            if (typeof item !== 'object') {
                itemDiv.innerHTML = `<span style="color:var(--text-muted)">- </span>`;
                renderInteractiveJson(itemDiv, item, level + 1);
            } else {
                let titleStr = `Item ${index+1}`;
                if (item.title) titleStr = item.title;
                else if (item.name) titleStr = item.name;
                else if (item.sceneNumber) titleStr = `Scene ${item.sceneNumber}${item.baseName ? ': ' + item.baseName : ''}`;
                else if (item.shotNumber) titleStr = `Shot ${item.shotNumber}${item.suffix || ''}`;
                
                const details = document.createElement('details');
                details.open = level < 2; // Auto expand top 2 levels
                details.style.borderLeft = '2px solid var(--border-color)';
                details.style.paddingLeft = '0.75rem';
                details.style.marginTop = '0.25rem';
                
                details.innerHTML = `<summary style="cursor:pointer; font-weight:600; color:var(--text-primary); margin-bottom:0.25rem;">${titleStr}</summary>`;
                
                const contentDiv = document.createElement('div');
                contentDiv.style.marginTop = '0.25rem';
                renderInteractiveJson(contentDiv, item, level + 1);
                
                details.appendChild(contentDiv);
                itemDiv.appendChild(details);
            }
            wrapper.appendChild(itemDiv);
        });
        container.appendChild(wrapper);
        return;
    }
    
    const keys = Object.keys(obj);
    if (keys.length === 0) {
        container.innerHTML += `<span style="color:var(--text-muted)">{}</span>`;
        return;
    }
    
    const table = document.createElement('div');
    table.style.display = 'grid';
    table.style.gridTemplateColumns = 'max-content 1fr';
    table.style.gap = '0.25rem 1rem';
    table.style.marginTop = '0.25rem';
    
    keys.forEach(key => {
        if (key === 'screenplay') return;
        
        const keyEl = document.createElement('div');
        keyEl.style.color = 'var(--text-muted)';
        keyEl.style.fontWeight = '500';
        keyEl.textContent = key + ':';
        
        const valEl = document.createElement('div');
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keyEl.style.gridColumn = '1 / -1';
            valEl.style.gridColumn = '1 / -1';
            valEl.style.paddingLeft = '1rem';
        }
        
        renderInteractiveJson(valEl, obj[key], level + 1);
        
        table.appendChild(keyEl);
        if (typeof obj[key] === 'object' && obj[key] !== null) {
             table.appendChild(valEl);
        } else {
             const rowGrp = document.createElement('div');
             rowGrp.style.gridColumn = '2';
             rowGrp.appendChild(valEl);
             table.appendChild(rowGrp);
        }
    });
    container.appendChild(table);
}

async function openShowBrowser() {
    let list = [];
    if (state.storageType === 'fs') {
        list = await fsStorage.getWorkspaceList();
    } else {
        const rawList = localStorage.getItem('arcdrama-workspace-list');
        if (rawList) list = JSON.parse(rawList);
    }
    
    if (list.length === 0) {
        await alertUser('No other shows found in this local directory.');
        return;
    }
    
    const dialog = document.getElementById('show-browser-dialog');
    const container = document.getElementById('show-browser-list');
    if (!dialog || !container) return;
    
    container.innerHTML = '';
    
    // Sort array by updatedAt descending
    list.sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    list.forEach(w => {
        const el = document.createElement('div');
        el.className = 'show-browser-item';
        el.style = 'display:flex; justify-content:space-between; align-items:center; padding:1rem; border:1px solid var(--border-color); border-radius:4px; margin-bottom:0.5rem; background:var(--bg-secondary); cursor:pointer; transition:border 0.2s;';
        
        let dateStr = 'Unknown date';
        if (w.updatedAt) {
            const d = new Date(w.updatedAt);
            dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } else if (w.createdAt) {
            const d = new Date(w.createdAt);
            dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }

        const isActive = (state.workspace && state.workspace.id === w.id);
        
        el.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
                <div style="font-weight:600; font-size:1.1rem; color: ${isActive ? 'var(--accent-color)' : 'var(--text-primary)'};">${w.name || 'Unnamed Show'} ${isActive ? '(Active)' : ''}</div>
                <div style="font-size:0.85rem; color:var(--text-muted);">Last Updated: ${dateStr}</div>
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <button class="btn btn-sm ${isActive ? 'btn-secondary' : 'btn-primary'} load-show-btn">${isActive ? 'Current' : 'Load Show'}</button>
                <button class="icon-btn danger delete-show-btn" title="Delete Show" style="font-size:1.2rem; padding:4px 8px; border-radius:4px; line-height:1;">✕</button>
            </div>
        `;
        
        el.addEventListener('mouseover', () => { el.style.borderColor = 'var(--accent-color)'; });
        el.addEventListener('mouseout', () => { el.style.borderColor = 'var(--border-color)'; });
        
        const loadBtn = el.querySelector('.load-show-btn');
        loadBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (isActive) return;
            dialog.close();
            
            localStorage.setItem('arcdrama-active-workspace', w.id);
            
            // Clean unmount memory and hot-load the new workspace
            state.activeEpisode = null;
            state.activeEpisodeId = null;
            state.activeShotId = null;
            state.workspace = null;
            
            const success = await state.loadWorkspace();
            if (!success) window.location.reload();
        });

        const delBtn = el.querySelector('.delete-show-btn');
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to permanently delete "${w.name}"? This cannot be undone.`)) {
                await state.deleteWorkspace(w.id);
                openShowBrowser(); // refresh list
                if (isActive) {
                    document.getElementById('workspace-title').textContent = 'No Show Loaded';
                }
            }
        });
        
        container.appendChild(el);
    });
    
    const cancelBtn = document.getElementById('show-browser-cancel');
    const closeHandler = () => { dialog.close(); };
    cancelBtn.onclick = closeHandler;
    
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
}
