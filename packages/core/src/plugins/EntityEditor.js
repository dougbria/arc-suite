import { State as stateEngine, JsonEditor } from '../index.js';
// We also need access to the dataDB instance from core state
const { dataDB } = stateEngine;
const state = stateEngine.default || stateEngine;

function generateUUID() {
    return Math.random().toString(36).substring(2, 15);
}

export class EntityEditor {
    constructor(options = {}) {
        this.id = 'EntityEditor';
        // You can pass custom API binders or LLM generators if needed, but for now we'll stub it
        this.generateVGL = options.generateVGL || (async (type, name, desc) => ({ raw: "LLM Stub. Provide actual LLM call in apps." }));
        // Core state bindings
        this.state = state;
    }

    init(core) {
        this.core = core;
        console.log('[EntityEditor Plugin] Initialized.');
        this._bindUI();
    }

    _bindUI() {
        // Find specific containers the host app might have injected
        const charList = document.getElementById('character-registry-list');
        const locList = document.getElementById('location-registry-list');

        if (!charList && !locList) return; // No UI present to bind

        this.state.on('workspaceLoaded', () => this.refreshAll());
        this.state.on('workspaceChanged', () => this.refreshAll());

        const addCharBtn = document.getElementById('add-character-btn');
        if (addCharBtn) {
            addCharBtn.onclick = async () => {
                if (!this.state.workspace) return;
                const char = { id: 'char_' + generateUUID(), name: 'New Character', vgl: { description: '' }, entityVersion: 1 };
                this.state.workspace.characters.push(char);
                await this.state.saveWorkspace();
                this.refreshAll();
            };
        }

        const addLocBtn = document.getElementById('add-location-btn');
        if (addLocBtn) {
            addLocBtn.onclick = async () => {
                if (!this.state.workspace) return;
                const loc = { id: 'loc_' + generateUUID(), name: 'New Location', vgl: { description: '' }, entityVersion: 1 };
                this.state.workspace.locations.push(loc);
                await this.state.saveWorkspace();
                this.refreshAll();
            };
        }
    }

    refreshAll() {
        const ws = this.state.workspace;
        if (!ws) return;

        const charList = document.getElementById('character-registry-list');
        const charWrap = document.getElementById('character-editor-container');
        if (charList) this._renderList(charList, charWrap, ws.characters || [], 'character');

        const locList = document.getElementById('location-registry-list');
        const locWrap = document.getElementById('location-editor-container');
        if (locList) this._renderList(locList, locWrap, ws.locations || [], 'location');
    }

    _renderList(listContainer, editorContainer, items, type) {
        listContainer.innerHTML = '';
        if (items.length === 0) {
            listContainer.innerHTML = `<div class="empty-state" style="padding:1rem;">No ${type}s added.</div>`;
            if (editorContainer) editorContainer.innerHTML = '';
            return;
        }

        items.forEach(item => {
            const listItem = document.createElement('div');
            listItem.className = 'md-list-item';
            listItem.innerHTML = `<span class="item-name">${item.name || 'Unnamed'}</span>
                                  <button class="icon-btn btn-delete">×</button>`;
            
            listItem.onclick = (e) => {
                if (e.target.classList.contains('btn-delete')) return; // handled below
                listContainer.querySelectorAll('.md-list-item').forEach(el => el.classList.remove('selected'));
                listItem.classList.add('selected');
                if (editorContainer) this.renderEditor(editorContainer, item, type);
            };

            const del = listItem.querySelector('.btn-delete');
            del.onclick = async (e) => {
                e.stopPropagation();
                if (!confirm(`Delete ${item.name}?`)) return;
                if (type === 'character') this.state.workspace.characters = this.state.workspace.characters.filter(i => i.id !== item.id);
                else this.state.workspace.locations = this.state.workspace.locations.filter(i => i.id !== item.id);
                if (editorContainer) editorContainer.innerHTML = '';
                await this.state.saveWorkspace();
                this.refreshAll();
            };

            listContainer.appendChild(listItem);
        });
    }

    renderEditor(container, item, type) {
        container.innerHTML = `
            <div style="margin-bottom:1rem; border-bottom:1px solid #333; padding-bottom:1rem;">
                <h3 style="margin:0 0 1rem 0; display:flex; gap:1rem; align-items:center;">
                    <span>Edit ${type}:</span>
                    <input type="text" id="ee-name" value="${item.name || ''}" style="background:transparent; color:white; border:1px solid #444; padding:4px;" />
                    <label style="font-size:0.8rem; font-weight:normal; display:flex; align-items:center; gap:0.25rem;">
                        <input type="checkbox" id="ee-lock" ${item.isLocked ? 'checked' : ''} />
                        Locked (Prevent Override)
                    </label>
                </h3>
                <div>
                   <label>Description</label><br>
                   <textarea id="ee-desc" style="width:100%; min-height:60px; background:#111; color:#ccc; border:1px solid #444; padding:4px;">${item.vgl?.description || item.vgl?.background_setting || ''}</textarea>
                </div>
            </div>
            <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
                <label>Master VGL Prompt</label>
                <button id="ee-btn-generate" class="md-btn">✨ Generate VGL via LLM</button>
            </div>
            <div id="ee-vgl-container" style="border:1px solid #444; min-height:200px; padding:1rem; background:#1a1a1a; overflow-y:auto; max-height:400px;"></div>
        `;

        const nameInput = container.querySelector('#ee-name');
        nameInput.onchange = () => this._saveField(item, 'name', nameInput.value);

        const lockInput = container.querySelector('#ee-lock');
        lockInput.onchange = () => this._saveField(item, 'isLocked', lockInput.checked);

        const descInput = container.querySelector('#ee-desc');
        descInput.onchange = () => {
            if (!item.vgl) item.vgl = {};
            this._saveField(item.vgl, type === 'location' ? 'background_setting' : 'description', descInput.value, item);
        };

        const vglContainer = container.querySelector('#ee-vgl-container');
        const generateBtn = container.querySelector('#ee-btn-generate');
        let jsonEditorInstance = null;

        generateBtn.onclick = async () => {
            const currentDesc = descInput.value || '';
            const currentName = nameInput.value || '';
            if (!currentDesc) return alert("Please provide a description first.");
            
            generateBtn.textContent = 'Generating...';
            generateBtn.disabled = true;
            try {
                const structuredData = await this.generateVGL(type, currentName, currentDesc);
                if (structuredData) {
                    if (!item.vgl) item.vgl = {};
                    item.vgl.structured_prompt = JSON.stringify(structuredData, null, 2);
                    this._saveField(item.vgl, type === 'location' ? 'background_setting' : 'description', currentDesc, item);
                    if (jsonEditorInstance) jsonEditorInstance.setData(JsonEditor.transformStructuredPrompt(structuredData));
                }
            } catch (err) {
                console.error("VGL Generation Failed:", err);
                alert("Generation failed: " + err.message);
            } finally {
                generateBtn.textContent = '✨ Generate VGL via LLM';
                generateBtn.disabled = false;
            }
        };

        let parsed = {};
        if (item.vgl?.structured_prompt) {
            try { parsed = JSON.parse(item.vgl.structured_prompt); } catch(e) { parsed = { raw: item.vgl.structured_prompt }; }
        }

        // Initialize the new Unified JSON Editor!
        jsonEditorInstance = new JsonEditor.JsonEditor(vglContainer, {
            readonly: false,
            onChange: (newData) => {
                if (!item.vgl) item.vgl = {};
                item.vgl.structured_prompt = JSON.stringify(newData, null, 2);
                item.entityVersion = (item.entityVersion || 0) + 1;
                this.state.saveWorkspace(); // auto-save
            }
        });
        jsonEditorInstance.setData(JsonEditor.transformStructuredPrompt(parsed));
    }

    _saveField(targetObj, field, value, rootEntity = null) {
        targetObj[field] = value;
        const e = rootEntity || targetObj;
        e.entityVersion = (e.entityVersion || 0) + 1;
        this.state.saveWorkspace();
    }
}
