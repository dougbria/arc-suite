import state from '../state.js';
import { globalCoordinateMapper } from '../utils.js'; // if needed later

const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
<style>
  @import "../../../packages/core/src/theme.css";

  :host {
    display: block;
    width: 100%;
    grid-area: header;
    z-index: 100;
  }

  .app-header {
    height: var(--header-height);
    background: var(--bg-secondary);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    user-select: none;
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }

  button, select {
    font-family: inherit;
    border: none;
    background: transparent;
    cursor: pointer;
    color: inherit;
    padding: 0;
    margin: 0;
    outline: none;
  }

  .header-left, .header-center, .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .app-title {
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: var(--text-primary);
  }
  .title-accent {
    color: var(--accent);
    font-weight: 800;
  }

  .app-modes {
    display: flex;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    padding: 2px;
    border: 1px solid var(--border-subtle);
  }
  .app-mode {
    padding: 4px 16px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: calc(var(--radius-md) - 2px);
    transition: var(--transition-fast);
  }
  .app-mode:hover {
    color: var(--text-primary);
  }
  .app-mode.active {
    background: var(--bg-hover);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }

  .project-selector {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-tertiary);
    padding: 4px 6px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  .project-selector select {
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-weight: 500;
    cursor: pointer;
    outline: none;
    padding: 2px 4px;
    min-width: 140px;
  }
  
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    transition: var(--transition-fast);
  }
  .icon-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .icon-btn.danger:hover {
    color: var(--danger);
    background: rgba(239, 68, 68, 0.1);
  }

  .storage-indicator-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    color: var(--text-secondary);
    transition: var(--transition-fast);
  }
  .storage-indicator-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border);
  }
  .hidden {
    display: none !important;
  }
</style>
<header class="app-header">
  <div class="header-left">
    <h1 class="app-title">Bria<span class="title-accent">Arc</span></h1>
  </div>
  <div class="header-center" id="app-modes-container">
    <div class="app-modes">
      <span class="app-mode active" data-mode="render">Render</span>
      <span class="app-mode" data-mode="drama">Drama</span>
    </div>
  </div>
  <div class="header-right">
    <div class="project-selector">
      <select id="project-select" title="Switch project">
        <option value="">— No Project —</option>
      </select>
      <button id="new-project-btn" class="icon-btn" title="New Project">＋</button>
      <button id="delete-project-btn" class="icon-btn danger" title="Delete Project">✕</button>
    </div>
    
    <div class="header-divider" style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 8px;"></div>
    
    <button id="settings-btn" class="icon-btn" title="Open Settings" style="font-size: 1.2rem;">⚙</button>
    <button id="storage-indicator-btn" class="storage-indicator-btn hidden" title="Change storage folder">
      <span class="storage-indicator-icon">📁</span>
      <span id="storage-indicator-name" class="storage-indicator-name"></span>
    </button>
  </div>
</header>
`;

export class ArcToolbar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(TEMPLATE.content.cloneNode(true));
        
        // Element bindings
        this.projectSelect = this.shadowRoot.getElementById('project-select');
        this.newProjectBtn = this.shadowRoot.getElementById('new-project-btn');
        this.deleteProjectBtn = this.shadowRoot.getElementById('delete-project-btn');
        this.settingsBtn = this.shadowRoot.getElementById('settings-btn');
        this.storageIndicatorBtn = this.shadowRoot.getElementById('storage-indicator-btn');
        this.storageIndicatorName = this.shadowRoot.getElementById('storage-indicator-name');
        
        // Bind methods
        this._updateProjectList = this._updateProjectList.bind(this);
        this._updateStorageIndicator = this._updateStorageIndicator.bind(this);
    }

    connectedCallback() {
        this._setupEventListeners();
        
        // Filter visible apps based on active-app attribute
        const activeApp = this.getAttribute('active-app');
        if (activeApp) {
            const modes = this.shadowRoot.querySelectorAll('.app-mode');
            modes.forEach(mode => {
                if (mode.dataset.mode === activeApp) {
                    mode.classList.add('active');
                } else {
                    mode.style.display = 'none';
                }
            });
        }
        
        // Subscribe to state changes
        state.on('init', this._updateProjectList);
        state.on('init', this._updateStorageIndicator);
        state.on('projectChanged', this._updateProjectList);
        state.on('storageReady', this._updateStorageIndicator);
        state.on('storageChanged', this._updateStorageIndicator);
        
        // Initial render
        this._updateProjectList();
        this._updateStorageIndicator();
    }

    disconnectedCallback() {
        // Need unsubscribe mechanism in state.js ideally, but state is global singleton
    }

    _setupEventListeners() {
        this.projectSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val) state.switchProject(val);
        });

        this.newProjectBtn.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('action', { detail: { type: 'new-project' }}));
        });

        this.deleteProjectBtn.addEventListener('click', () => {
            if (!state.activeProjectId) return;
            this.dispatchEvent(new CustomEvent('action', { detail: { type: 'delete-project', id: state.activeProjectId }}));
        });

        this.settingsBtn.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('action', { detail: { type: 'open-settings' }}));
        });

        this.storageIndicatorBtn.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('action', { detail: { type: 'change-storage' }}));
        });
        
        // Mode Switcher
        const modes = this.shadowRoot.querySelectorAll('.app-mode');
        modes.forEach(mode => {
            mode.addEventListener('click', (e) => {
                modes.forEach(m => m.classList.remove('active'));
                e.target.classList.add('active');
                this.dispatchEvent(new CustomEvent('action', { detail: { type: 'switch-mode', mode: e.target.dataset.mode }}));
            });
        });
    }

    _updateProjectList() {
        const list = state.getProjectList();
        
        // Hierarchy indentation (if parents exist)
        // Sort flat array so children come after parents
        const sorted = [];
        const topLevel = list.filter(p => !p.parentId);
        
        const addChildren = (parent) => {
            sorted.push({ ...parent, level: 0 });
            const children = list.filter(p => p.parentId === parent.id);
            children.forEach(child => {
                sorted.push({ ...child, level: 1 });
            });
        };
        
        topLevel.forEach(addChildren);
        // Fallback for flat lists
        if (sorted.length === 0 && list.length > 0) sorted.push(...list.map(p => ({...p, level: 0})));

        this.projectSelect.innerHTML = sorted.length === 0 
            ? '<option value="">— No Project —</option>' 
            : sorted.map(p => {
                const prefix = p.level > 0 ? '\u00A0\u00A0↳ ' : '';
                return `<option value="${p.id}" ${p.id === state.activeProjectId ? 'selected' : ''}>${prefix}${p.name} (${p.imageCount})</option>`;
              }).join('');
    }

    _updateStorageIndicator() {
        if (state.storageType === 'fs') {
            const folderName = state.getFolderName();
            if (folderName) {
                this.storageIndicatorName.textContent = folderName;
                this.storageIndicatorBtn.classList.remove('hidden');
            }
        } else {
            this.storageIndicatorBtn.classList.add('hidden');
        }
    }
}

customElements.define('arc-toolbar', ArcToolbar);
