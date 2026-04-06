export class StoryboardView {
    constructor(mountPointId) {
        this.mountPointId = mountPointId;
    }

    render() {
        const container = document.getElementById(this.mountPointId);
        if (!container) return;

        if (document.getElementById('arc-storyboard-view')) return;

        container.insertAdjacentHTML('beforeend', `
        <div id="arc-storyboard-view" class="view-mode hidden" style="flex:1; display:flex; flex-direction:row; background:var(--bg-color); width:100%; height:100%;">
          
          <div style="flex:1; display:flex; flex-direction:column; min-width: 0;">
             <div class="storyboard-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; padding:1rem; border-bottom:1px solid var(--border-color);">
                <div style="display:flex; align-items:center; flex-wrap:wrap; gap: 1rem;">
                    <h2>Episodes</h2>
                    <div id="storyboard-tabs" style="display:flex; gap:0.5rem"></div>
                </div>
                <div style="display:flex; gap: 0.5rem;">
                   <button id="btn-regen-stale" class="btn btn-sm btn-secondary" title="Regenerate all stale keyframes in current episode">Regenerate Stale</button>
                   <button id="del-episode-btn" class="btn btn-sm" style="background:var(--danger);" title="Delete current episode" disabled>Delete Episode</button>
                   <button id="add-episode-btn" class="btn btn-sm btn-primary">New Episode</button>
                </div>
             </div>
             
             <div id="story-filter-bar" style="display:flex; gap: 1rem; padding: 0.5rem 1rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); flex-wrap:wrap;">
                <select id="filter-scene"><option value="">All Scenes</option></select>
                <select id="filter-character"><option value="">All Characters</option></select>
                <select id="filter-location"><option value="">All Locations</option></select>
                <select id="filter-status"><option value="">All Statuses</option></select>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                   <input type="checkbox" id="filter-starred"><label for="filter-starred">Starred</label>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                   <input type="checkbox" id="filter-stale"><label for="filter-stale">Stale</label>
                </div>
             </div>
             
             <div id="storyboard-grid" style="flex:1; overflow-y:auto; padding:1rem;">
                <div class="empty-state">Loading Storyboard...</div>
             </div>
          </div>
          
          <!-- Generic Sidebar -->
          <div id="storyboard-sidebar-container" style="display:flex; flex-direction:row; height:100%;">
             <!-- Collapse Toggle -->
             <button id="storyboard-sidebar-toggle" class="btn btn-sm" style="height:100%; border:none; border-left:1px solid var(--border-color); background:var(--bg-secondary); border-radius:0; padding:0 4px; font-size:1.2rem; cursor:pointer;" title="Toggle Sidebar">▶</button>
             <div id="storyboard-sidebar" style="width: 300px; background: var(--bg-secondary); overflow-y: auto; transition: width 0.2s;">
                <!-- Sidebar content injected here by sidebar-controller.js -->
             </div>
          </div>

        </div>
        `);
    }
}
