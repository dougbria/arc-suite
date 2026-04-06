export class SetupView {
    constructor(mountPointId) {
        this.mountPointId = mountPointId;
    }

    render() {
        const container = document.getElementById(this.mountPointId);
        if (!container) return;
        
        // Prevent double injection
        if (document.getElementById('arc-setup-view')) return;

        container.insertAdjacentHTML('beforeend', `
        <div id="arc-setup-view" class="view-mode hidden" style="width:100%; height:100%;">
          <div class="setup-container">
            
            <header class="setup-header">
              <h2 id="workspace-title">New Show</h2>
              <div class="setup-actions">
                <button id="setup-switch-workspace-btn" class="btn btn-secondary btn-sm">Switch Show</button>
                <button id="setup-new-workspace-btn" class="btn btn-primary btn-sm">New Show</button>
              </div>
            </header>

            <div class="setup-container-stacked" style="display:flex; flex-direction:column; gap:2rem;">
              
              <!-- Top Row (Script Breakdown) -->
              <div class="setup-section-full">
                <section class="setup-section" id="section-breakdown" style="margin-bottom:0">
                  <header class="section-header">
                     <h3>Script & Breakdown</h3>
                     <div style="display:flex; gap:0.5rem">
                         <button class="btn btn-sm btn-secondary" id="btn-populate-breakdown" disabled>Populate Characters & Locations</button>
                         <button class="btn btn-sm btn-secondary" id="btn-sync-breakdown" disabled>Sync to Production Board</button>
                     </div>
                  </header>
                  <div class="setup-card breakdown-card" style="display:flex; gap:2rem; padding:0; background:transparent; border:none;">
                    
                    <div style="flex:1; display:flex; flex-direction:column;">
                        <div class="setup-card" style="height:100%; display:flex; flex-direction:column;">
                            <label class="main-label">Source Material</label>
                            <textarea class="breakdown-input" id="breakdown-input-source" style="flex:1; min-height: 300px;" placeholder="Paste script or story outline here..."></textarea>
                            
                            <div style="display:flex; gap:1rem; margin-top:1rem; align-items:center;">
                                <div style="display:flex; flex-direction:column; flex:1">
                                     <label class="main-label" style="font-size:0.8em; margin-bottom:0.2rem;">Target Episodes</label>
                                     <input type="number" id="breakdown-target-episodes" class="breakdown-input" style="padding:0.4rem" placeholder="e.g. 40">
                                </div>
                                <div style="display:flex; flex-direction:column; flex:1">
                                     <label class="main-label" style="font-size:0.8em; margin-bottom:0.2rem;">Target Episode Length</label>
                                     <input type="text" id="breakdown-target-duration" class="breakdown-input" style="padding:0.4rem" placeholder="e.g. 90-120s">
                                </div>
                            </div>
                            
                            <button class="btn btn-primary btn-full breakdown-btn" id="btn-generate-breakdown" style="margin-top:1rem; padding: 0.75rem;">Generate Breakdown</button>
                        </div>
                    </div>
                    
                    <!-- Dedicated Pane for JSON Breakdown -->
                    <div style="flex:1; display:flex; flex-direction:column; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
                        <header style="padding:0.75rem 1rem; border-bottom:1px solid var(--border-color); background:rgba(0,0,0,0.2); display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; gap:1rem; align-items:center;">
                                <h4 style="margin:0; font-size:0.95rem; color:var(--text-primary)">Living Breakdown</h4>
                                <div class="breakdown-tabs" style="display:flex; gap:0.5rem;">
                                    <button class="btn btn-sm btn-secondary active" id="tab-btn-interactive">Interactive</button>
                                    <button class="btn btn-sm btn-secondary" id="tab-btn-script">Screenplay</button>
                                    <button class="btn btn-sm btn-secondary" id="tab-btn-raw">Raw JSON</button>
                                </div>
                            </div>
                            <div style="font-size:0.85rem; color:var(--text-muted); font-weight:500;">
                                Eps: <span id="estimate-episodes" style="color:var(--text-primary)">0</span> | 
                                Est. Runtime: <span id="estimate-runtime" style="color:var(--accent-color)">0m</span>
                            </div>
                        </header>
                        
                        <!-- Main Content Area -->
                        <div style="flex:1; position:relative; min-height:400px; background:var(--bg-base);">
                            <div id="breakdown-view-interactive" style="position:absolute; top:0; left:0; right:0; bottom:0; overflow-y:auto; padding:1.5rem;">
                                 <div class="empty-state" style="border:none; height:100%; display:flex; align-items:center; justify-content:center;">Generate a breakdown to see the interactive timeline.</div>
                            </div>
                            <div id="breakdown-view-script" class="hidden" style="position:absolute; top:0; left:0; right:0; bottom:0; overflow-y:auto; padding:2rem; background:#fff; color:#000;">
                                 <div class="script-format" id="breakdown-script-content" style="font-family:'Courier Prime', Courier, monospace; max-width:800px; margin:0 auto; white-space:pre-wrap; font-size:14px; line-height:1.3; text-align:left;">Screenplay will appear here.</div>
                            </div>
                            <textarea class="breakdown-input hidden" id="breakdown-output-json" placeholder="Generated JSON outline will appear here..." style="position:absolute; top:0; left:0; right:0; bottom:0; width:100%; height:100%; border:none; padding:1.5rem; font-family:monospace; font-size:0.85rem; color:var(--text-secondary); background:var(--bg-base); resize:none; outline:none; white-space:pre;"></textarea>
                        </div>
                    </div>
                  </div>
                </section>
              </div>

              <!-- Bottom Row (Assets) -->
              <div class="setup-grid">
              
              <!-- Characters -->
              <section class="setup-section master-detail-section" id="section-characters">
                  <div class="md-sidebar">
                      <header class="md-header">
                          <h3 style="flex:1">Characters</h3>
                          <button class="btn btn-sm btn-secondary" id="gen-all-characters-vgl-btn" title="Generate missing VGLs for all characters">✨ Generate All VGL</button>
                          <button class="btn btn-sm" id="add-character-btn" title="Add Character" style="font-size:1.2rem; padding:0 0.5rem">+</button>
                      </header>
                      <div id="character-registry-list" class="md-list"></div>
                  </div>
                  <div class="md-content">
                      <div id="character-editor-container" class="md-editor hidden"></div>
                      <div id="character-empty-state" class="md-empty">Select a character to edit</div>
                  </div>
              </section>

              <!-- Locations -->
              <section class="setup-section master-detail-section" id="section-locations">
                  <div class="md-sidebar">
                      <header class="md-header">
                          <h3 style="flex:1">Locations</h3>
                          <button class="btn btn-sm btn-secondary" id="gen-all-locations-vgl-btn" title="Generate missing VGLs for all locations">✨ Generate All VGL</button>
                          <button class="btn btn-sm" id="add-location-btn" title="Add Location" style="font-size:1.2rem; padding:0 0.5rem">+</button>
                      </header>
                      <div id="location-registry-list" class="md-list"></div>
                  </div>
                  <div class="md-content">
                      <div id="location-editor-container" class="md-editor hidden"></div>
                      <div id="location-empty-state" class="md-empty">Select a location to edit</div>
                  </div>
              </section>

              </div>
            </div>
          </div>
        </div>
        `);
    }
}
