export class PromptBar {
  constructor(mountPointId) {
    this.mountPointId = mountPointId;
  }

  render() {
    const container = document.getElementById(this.mountPointId);
    if (!container) return;

    if (document.getElementById('prompt-bar')) return;

    container.insertAdjacentHTML('beforeend', `
    <!-- ==================== PROMPT BAR (Floating Dock) ==================== -->
    <div class="prompt-bar drawer-expanded" id="prompt-bar">
      
      <!-- Minimized State: Handle/Action Strip -->
      <div id="drawer-minimized-strip" class="drawer-minimized-strip" title="Show Prompt Drawer (Ctrl+P)">
        <div class="prompt-bar-drag-pill"></div>
        <div id="minimized-actions" class="minimized-actions" style="display:none; margin-left:12px;">
          <button id="minimized-expand-btn" class="btn btn-sm btn-primary hidden">📐 Expand</button>
          <button id="minimized-synthesize-btn" class="btn btn-sm btn-primary hidden">🧪 Synthesize</button>
        </div>
      </div>

      <!-- Expanded State: Full Content -->
      <div class="prompt-bar-inner drawer-content">
        <button id="prompt-bar-collapse-btn" class="prompt-bar-collapse-btn" title="Minimize Drawer (Ctrl+P)">
          <div class="prompt-bar-drag-pill"></div>
        </button>
        <!-- Reorganized Layout: Primary (Top) and Advanced (Collapsible) -->
        <div class="prompt-layout-container">

          <!-- Primary Area: Prompt, Buttons, then Settings -->
          <div class="prompt-primary-area" style="display: flex; flex-direction: row; gap: 16px; align-items: flex-end;">
            <!-- 1. Left side: Prompt & Upload -->
            <div class="prompt-input-group" style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
              <label for="prompt-input" class="main-label">Prompt/Instructions</label>
              <div class="prompt-row" style="display: flex; gap: 10px; align-items: stretch;">
                <div class="upload-control-inline">
                  <label class="upload-label-inline" id="upload-label">
                    <input type="file" id="image-upload" accept="image/png,image/jpeg,image/webp"
                      class="hidden-input" />
                    <div class="upload-btn-inline" id="upload-btn-text" title="Upload reference image">📎</div>
                  </label>
                  <div id="upload-preview-wrap" class="upload-preview-wrap hidden">
                    <img id="upload-preview" src="" />
                    <button id="clear-upload-btn" class="clear-upload-btn" title="Remove image">✕</button>
                  </div>
                </div>
                <div class="prompt-input-wrap" style="position: relative; flex: 1; display: flex;">
                  <textarea id="prompt-input" class="prompt-input" rows="2" style="flex: 1; resize: none; padding-right: 32px;"
                    placeholder="Describe thoughts, instructions, or modifications…"></textarea>
                  <button id="prompt-expand-btn" class="prompt-expand-btn" title="Expand editor (Shift+Enter)">⤢</button>
                </div>
              </div>
            </div>

            <!-- 2. Right side: Settings & Action Buttons -->
            <div class="prompt-controls-side" style="flex: 0 0 auto; display: flex; flex-direction: column; gap: 8px;">
              <!-- Quick Settings (Count, Ratio, Seed) -->
              <div class="prompt-quick-settings">
                  <div class="quick-params-row" style="display: flex; gap: 8px;">
                    <div class="param-item custom-dropdown-wrap">
                      <button id="image-count-btn" class="custom-dropdown-btn">4</button>
                      <div id="image-count-menu" class="custom-dropdown-menu hidden">
                        <button class="dropdown-option" data-value="1">1</button>
                        <button class="dropdown-option" data-value="2">2</button>
                        <button class="dropdown-option" data-value="3">3</button>
                        <button class="dropdown-option active" data-value="4">4</button>
                      </div>
                    </div>
                    <div class="param-item custom-dropdown-wrap">
                      <button id="aspect-ratio-btn" class="custom-dropdown-btn">Auto</button>
                      <div id="aspect-ratio-menu" class="custom-dropdown-menu hidden">
                        <button class="dropdown-option active" data-value="">Auto</button>
                        <button class="dropdown-option" data-value="1:1">1:1</button>
                        <button class="dropdown-option" data-value="16:9">16:9</button>
                        <button class="dropdown-option" data-value="9:16">9:16</button>
                        <button class="dropdown-option" data-value="4:3">4:3</button>
                        <button class="dropdown-option" data-value="3:4">3:4</button>
                      </div>
                    </div>
                    <div class="param-item custom-dropdown-wrap seed-item">
                      <button id="seed-popover-btn" class="custom-dropdown-btn" title="Random Seed">🎲 Auto</button>
                      <div id="seed-popover-menu" class="custom-dropdown-menu hidden" style="padding:8px; min-width: 140px;">
                        <input type="number" id="seed-input" class="prompt-input" style="width:100%; margin-bottom:8px;" placeholder="Random..." />
                        <button id="seed-random-btn" class="btn btn-sm btn-secondary" style="width:100%">🎲 Randomize</button>
                      </div>
                    </div>
                  </div>
              </div>

              <!-- Action Buttons (Segmented Control) -->
              <div class="prompt-action-container">
                <div id="action-buttons-stack" class="action-buttons-combo">
                  <button id="btn-generate" class="btn btn-sm btn-primary combo-primary" title="Generate New">✨ Generate</button>
                  <button id="btn-refine" class="btn btn-sm btn-secondary combo-segment" disabled title="Refine generated image">⟲ Refine</button>
                  <button id="btn-edit" class="btn btn-sm btn-secondary combo-segment" disabled title="Edit image">✎ Edit</button>
                  <button id="btn-expand" class="btn btn-sm btn-secondary combo-segment" disabled title="Expand using outpainting box">📐 Expand</button>
                  <button id="btn-layout" class="btn btn-sm btn-secondary combo-segment" disabled title="Enter layout mode to composite multiple images">🖼 Layout</button>
                  <button id="btn-synthesize" class="btn btn-sm btn-secondary combo-segment hidden" title="Synthesize multiple selected images">🧪 Synthesize</button>
                </div>
                <!-- Integrated Progress/Cancel Button -->
                <button id="btn-interrupt" class="btn btn-sm btn-primary btn-progress hidden">
                  <span class="progress-text">Generating...</span>
                  <span class="interrupt-icon">✕</span>
                </button>
              </div>
            </div>
            
            <!-- Integrated Console Link -->
            <div id="logs-panel" class="prompt-console-action" style="align-self: flex-end; margin-bottom: 4px;">
              <button id="global-console-btn" class="console-link-btn" title="Open API Request/Response Console">API</button>
            </div>
          </div>

          <!-- Advanced Area: Collapsible Details -->
          <details class="prompt-advanced-details">
            <summary class="advanced-summary">Advanced Settings</summary>
            <div class="advanced-grid">
              <!-- 1. Negative Prompt (Extended text box) -->
              <div class="neg-prompt-group full-width">
                <label for="negative-prompt-input">Negative Prompt</label>
                <textarea id="negative-prompt-input" class="neg-prompt-input" rows="2" placeholder="Objects, styles, or colors to exclude…"></textarea>
              </div>

              <!-- 2. Generation Quality/Mode Options (just below neg prompt) -->
              <div class="advanced-row-wrap">
                  <div class="param-item">
                    <label>Resolution</label>
                    <select id="resolution-select">
                      <option value="1MP" selected>1MP</option>
                      <option value="4MP">4MP</option>
                    </select>
                  </div>
                  <div class="toggle-item">
                    <label class="toggle-switch">
                      <input type="checkbox" id="lite-mode-toggle" />
                      <span class="toggle-slider"></span>
                    </label>
                    <span class="toggle-label">Lite Mode</span>
                  </div>
                   <div class="toggle-item">
                    <label class="toggle-switch">
                      <input type="checkbox" id="preview-sp-checkbox" />
                      <span class="toggle-slider"></span>
                    </label>
                    <span class="toggle-label">Preview VGL</span>
                  </div>
              </div>

              <!-- 3. Content Moderation Group -->
              <div class="moderation-group">
                  <h4 class="settings-sub-label">Content Moderation</h4>
                  <div class="toggles-grid">
                     <div class="toggle-item">
                        <label class="toggle-switch">
                          <input type="checkbox" id="mod-content-toggle" />
                          <span class="toggle-slider"></span>
                        </label>
                        <span class="toggle-label">Content</span>
                     </div>
                     <div class="toggle-item">
                        <label class="toggle-switch">
                          <input type="checkbox" id="mod-input-toggle" />
                          <span class="toggle-slider"></span>
                        </label>
                        <span class="toggle-label">Input</span>
                     </div>
                     <div class="toggle-item">
                        <label class="toggle-switch">
                          <input type="checkbox" id="mod-output-toggle" />
                          <span class="toggle-slider"></span>
                        </label>
                        <span class="toggle-label">Output</span>
                     </div>
                     <div class="toggle-item">
                        <label class="toggle-switch">
                          <input type="checkbox" id="ip-signal-toggle" />
                          <span class="toggle-slider"></span>
                        </label>
                        <span class="toggle-label">IP Signal</span>
                     </div>
                  </div>
              </div>
            </div>
          </details>
        </div>
      </div>

    </div>
        `);
  }
}
