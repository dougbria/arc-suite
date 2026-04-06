export class ShotNavigator {
    constructor(mountPointId) {
        this.mountPointId = mountPointId;
    }

    render() {
        // Because Canvas creates the 'canvas-hooks-overlay' dynamically, 
        // we attach to it instead of replacing its parent entirely.
        const container = document.getElementById(this.mountPointId);
        if (!container) return;

        if (document.getElementById('shot-nav-toggle')) return;

        container.insertAdjacentHTML('beforeend', `
          <!-- Absolute Positioned Button and Popup -->
          <button id="shot-nav-toggle" class="btn btn-sm" style="position:absolute; top:1rem; left:1rem; z-index:50; background:var(--bg-elevated); border:1px solid var(--border-color); color:var(--text-primary); box-shadow:0 4px 6px rgba(0,0,0,0.3); font-size:0.85rem; padding:0.4rem 0.8rem; pointer-events:auto;">
             ℹ Shot Details
          </button>
          
          <div id="shot-nav-sidebar" class="vgl-panel hidden" style="position:absolute; top:3.5rem; left:1rem; z-index:50; width: 300px; display:flex; flex-direction:column; background: var(--bg-surface); border:1px solid var(--border-color); border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.6); max-height: calc(100% - 4.5rem); pointer-events:auto;">
               <div class="sidebar-header" style="border-bottom: 1px solid var(--border-color); padding:0.75rem 1rem; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); border-radius: 8px 8px 0 0;">
                   <h3 id="side-scene-title" style="font-size: 0.85rem; color: var(--accent-color); margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Current Episode</h3>
                   <button id="shot-context-close-btn" class="icon-btn" style="color:var(--text-muted); font-size:1.2rem; padding:0 4px; line-height:1;">×</button>
               </div>
               
               <div id="shot-nav-content" class="sidebar-content" style="padding: 1rem; flex:1; overflow-y:auto; overflow-x:hidden;">
                   <div id="side-shot-title" style="font-size: 1.1rem; font-weight: bold; margin-bottom: 0.5rem; color: var(--text-primary);">Shot Title</div>
                   <div id="side-shot-action" style="font-size: 0.85rem; color: var(--text-secondary); font-style: italic; line-height: 1.4;">Action goes here.</div>
                   <div id="side-shot-dialogue" style="font-size: 0.85rem; color: var(--text-primary); border-left: 2px solid var(--accent-color); padding-left: 8px; margin-top: 8px; display: none;">Dialogue goes here.</div>
                   
                   <hr style="border:0; border-top:1px solid var(--border-color); margin: 1rem 0;">
                   
                   <div style="font-size: 0.75rem; color: var(--text-tertiary); display:flex; flex-direction:column; gap:0.5rem;">
                       <div>
                           <strong style="color:var(--text-secondary); text-transform:uppercase; font-size:0.65rem; letter-spacing:0.05em;">Previous Shot</strong>
                           <div id="side-shot-prev" style="margin-top:2px; line-height:1.3; font-style:italic;">None</div>
                       </div>
                       <div>
                           <strong style="color:var(--text-secondary); text-transform:uppercase; font-size:0.65rem; letter-spacing:0.05em;">Next Shot</strong>
                           <div id="side-shot-next" style="margin-top:2px; line-height:1.3; font-style:italic;">None</div>
                       </div>
                   </div>
               </div>
          </div>
        `);
    }
}
