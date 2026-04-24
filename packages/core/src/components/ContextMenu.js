const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
<style>
  @import "../../../packages/core/src/theme.css";

  .context-menu {
    position: fixed;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-lg);
    padding: 6px 0;
    min-width: 180px;
    z-index: var(--z-index-modal);
    font-size: 0.9rem;
    display: flex;
    flex-direction: column;
    color: var(--text-primary);
  }

  .context-menu.hidden {
    display: none !important;
  }

  .context-menu button {
    background: transparent;
    border: none;
    color: var(--text-primary);
    text-align: left;
    padding: 8px 16px;
    width: 100%;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background var(--transition-fast);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .context-menu button:hover {
    background: var(--bg-hover);
  }

  .context-menu button.danger-text {
    color: var(--danger);
  }
  .context-menu button.danger-text:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .context-menu hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 4px 0;
  }

  .context-submenu-item {
    position: relative;
  }

  .context-submenu {
    display: none;
    position: absolute;
    top: 0;
    left: 100%;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-lg);
    padding: 6px 0;
    min-width: 150px;
    z-index: var(--z-index-modal);
  }

  .context-submenu-item:hover .context-submenu {
    display: flex;
    flex-direction: column;
  }
</style>
<div id="context-menu" class="context-menu hidden">
  <button data-action="compare">🔀 Compare</button>
  <button data-action="jump-to-top-parent" id="ctx-jump-top-parent" class="hidden">⇈ Jump to Top Parent</button>
  <button data-action="jump-to-parent" id="ctx-jump-parent" class="hidden">⬆ Jump to Parent</button>
  <button data-action="jump-to-first-child" id="ctx-jump-first-child" class="hidden">⬇ Jump to First Child</button>
  <button data-action="jump-to-latest-child" id="ctx-jump-latest-child" class="hidden">⇊ Jump to Latest Child</button>
  <button data-action="star">⭐ Star / Unstar</button>
  <hr />
  <button data-action="enhance">✨ Creative Enhancer</button>
  <div class="context-submenu-item">
    <button class="context-submenu-trigger">📐 Increase Resolution ▶</button>
    <div class="context-submenu">
      <button data-action="increase-resolution" data-scale="2">2× Resolution</button>
      <button data-action="increase-resolution" data-scale="4">4× Resolution</button>
    </div>
  </div>
  <hr />
  <button data-action="download-png">⬇ Download PNG</button>
  <button data-action="download-sp">📄 Download VGL</button>
  <button data-action="show-in-folder">📂 Show in Folder</button>
  <hr />
  <button data-action="copy-seed">📋 Copy Seed</button>
  <button data-action="copy-prompt">📋 Copy Prompt</button>
  <hr />
  <button data-action="delete" class="danger-text">✕ Delete Image</button>
</div>
`;

export class ArcContextMenu extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(TEMPLATE.content.cloneNode(true));
        this.menu = this.shadowRoot.getElementById('context-menu');
        
        this.targetId = null;
        this._handleClick = this._handleClick.bind(this);
        this._handleGlobalClick = this._handleGlobalClick.bind(this);
        this._handleGlobalKey = this._handleGlobalKey.bind(this);
    }

    connectedCallback() {
        this.menu.addEventListener('click', this._handleClick);
        document.addEventListener('click', this._handleGlobalClick);
        document.addEventListener('keydown', this._handleGlobalKey);
    }

    disconnectedCallback() {
        this.menu.removeEventListener('click', this._handleClick);
        document.removeEventListener('click', this._handleGlobalClick);
        document.removeEventListener('keydown', this._handleGlobalKey);
    }

    show(x, y, targetId, parentId, childrenCount) {
        this.targetId = targetId;
        
        // Update visibility of jump buttons
        const topBtn = this.shadowRoot.getElementById('ctx-jump-top-parent');
        const parentBtn = this.shadowRoot.getElementById('ctx-jump-parent');
        const firstBtn = this.shadowRoot.getElementById('ctx-jump-first-child');
        const latestBtn = this.shadowRoot.getElementById('ctx-jump-latest-child');

        if (parentId) {
            topBtn?.classList.remove('hidden');
            parentBtn?.classList.remove('hidden');
        } else {
            topBtn?.classList.add('hidden');
            parentBtn?.classList.add('hidden');
        }

        if (childrenCount > 0) {
            firstBtn?.classList.remove('hidden');
            latestBtn?.classList.remove('hidden');
        } else {
            firstBtn?.classList.add('hidden');
            latestBtn?.classList.add('hidden');
        }

        // Position Menu
        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y}px`;
        this.menu.classList.remove('hidden');
        
        // Ensure menu doesn't overflow right or bottom bounds
        requestAnimationFrame(() => {
            const rect = this.menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                this.menu.style.left = `${window.innerWidth - rect.width - 10}px`;
            }
            if (rect.bottom > window.innerHeight) {
                this.menu.style.top = `${window.innerHeight - rect.height - 10}px`;
            }
        });
    }

    hide() {
        this.menu.classList.add('hidden');
        this.targetId = null;
    }

    _handleClick(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn || !this.targetId) return;
        
        const action = btn.dataset.action;
        const scale = btn.dataset.scale || null;
        
        this.dispatchEvent(new CustomEvent('menu-action', {
            detail: { action, targetId: this.targetId, scale }
        }));
        
        this.hide();
    }

    _handleGlobalClick(e) {
        if (!this.contains(e.target)) {
            this.hide();
        }
    }

    _handleGlobalKey(e) {
        if (e.key === 'Escape') {
            this.hide();
        }
    }
}

customElements.define('arc-context-menu', ArcContextMenu);
