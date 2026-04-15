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
    <div class="prompt-bar" id="prompt-bar">
      <button id="prompt-bar-collapse-btn" class="prompt-bar-collapse-btn" title="Toggle Prompt Bar (Ctrl+P)">┈</button>
      <div class="prompt-bar-inner">
        <!-- Reorganized Layout: Primary (Top) and Advanced (Collapsible) -->
        <div class="prompt-layout-container">

          <!-- Primary Area: Prompt, Buttons, then Settings -->
          <div class="prompt-primary-area">
            <!-- 1. Prompt & Upload -->
            <div class="prompt-input-group">
              <label for="prompt-input" class="main-label">Prompt/Instructions</label>
              <div class="prompt-row">
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
                <div class="prompt-input-wrap">
                  <textarea id="prompt-input" class="prompt-input" rows="2"
                    placeholder="Describe thoughts, instructions, or modifications…"></textarea>
                  <button id="prompt-expand-btn" class="prompt-expand-btn" title="Expand editor (Shift+Enter)">⤢</button>
                </div>
              </div>
            </div>

            <!-- 2. Lower Controls Row -->
            <div class="prompt-controls-row">
              <!-- Action Buttons (Segmented Control) -->
              <div class="prompt-action-container">
                <div id="action-buttons-stack" class="action-buttons-combo">
                  <button id="btn-generate" class="btn btn-primary combo-primary" title="Generate New">✨ Generate</button>
                  <button id="btn-refine" class="btn btn-secondary combo-segment" disabled title="Refine generated image">⟲ Refine</button>
                  <button id="btn-edit" class="btn btn-secondary combo-segment" disabled title="Edit image">✎ Edit</button>
                </div>
                <!-- Integrated Progress/Cancel Button -->
                <button id="btn-interrupt" class="btn btn-primary btn-progress hidden">
                  <span class="progress-text">Generating...</span>
                  <span class="interrupt-icon">✕</span>
                </button>
              </div>

              <!-- Quick Settings (Count, Ratio, Seed) -->
              <div class="prompt-quick-settings">
                  <div class="quick-params-row">
                    <div class="param-item">
                      <label>Count</label>
                      <select id="image-count-select">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4" selected>4</option>
                      </select>
                    </div>
                    <div class="param-item">
                      <label>Ratio</label>
                      <select id="aspect-ratio-select">
                        <option value="">Auto</option>
                        <option value="1:1">1:1</option>
                        <option value="2:3">2:3</option>
                        <option value="3:2">3:2</option>
                        <option value="4:5">4:5</option>
                        <option value="5:4">5:4</option>
                        <option value="9:16">9:16</option>
                        <option value="16:9">16:9</option>
                        <option value="9:21">9:21</option>
                        <option value="21:9">21:9</option>
                      </select>
                    </div>
                    <div class="param-item seed-item">
                      <label>Seed</label>
                      <input type="number" id="seed-input" placeholder="Random" title="Leave empty for a random seed each time" />
                    </div>
                  </div>
              </div>

              <!-- Integrated Console Link -->
              <div id="logs-panel" class="prompt-console-action">
                <button id="global-console-btn" class="console-link-btn" title="Open API Request/Response Console">API Console</button>
              </div>
            </div>
          </div>


          </div>

          <!-- Advanced Area: Collapsible Details -->
          <details class="prompt-advanced-details">
            <summary class="advanced-summary">Advanced Settings</summary>
            <div class="advanced-grid">

              <!-- Negative Prompt -->
              <div class="neg-prompt-group">
                <label for="negative-prompt-input">Negative Prompt</label>
                <input type="text" id="negative-prompt-input" class="neg-prompt-input" placeholder="Exclude things…" />
              </div>

              <!-- Resolution -->
              <div class="param-item res-param">
                <label>Resolution</label>
                <select id="resolution-select">
                  <option value="1MP" selected>1MP</option>
                  <option value="4MP">4MP</option>
                </select>
              </div>

              <!-- Toggles Grid -->
              <div class="toggles-grid">
                <div class="toggle-item">
                  <label class="toggle-switch">
                    <input type="checkbox" id="lite-mode-toggle" />
                    <span class="toggle-slider"></span>
                  </label>
                  <span class="toggle-label">Lite Mode</span>
                </div>
                <div class="toggle-item">
                  <label class="toggle-switch">
                    <input type="checkbox" id="mod-content-toggle" />
                    <span class="toggle-slider"></span>
                  </label>
                  <span class="toggle-label">Content Mod</span>
                </div>
                <div class="toggle-item">
                  <label class="toggle-switch">
                    <input type="checkbox" id="mod-input-toggle" />
                    <span class="toggle-slider"></span>
                  </label>
                  <span class="toggle-label">Input Mod</span>
                </div>
                <div class="toggle-item">
                  <label class="toggle-switch">
                    <input type="checkbox" id="mod-output-toggle" />
                    <span class="toggle-slider"></span>
                  </label>
                  <span class="toggle-label">Output Mod</span>
                </div>
                <div class="toggle-item">
                  <label class="toggle-switch">
                    <input type="checkbox" id="ip-signal-toggle" />
                    <span class="toggle-slider"></span>
                  </label>
                  <span class="toggle-label">IP Signal</span>
                </div>
                <div class="toggle-item">
                  <label class="toggle-switch">
                    <input type="checkbox" id="preview-sp-checkbox" />
                    <span class="toggle-slider"></span>
                  </label>
                  <span class="toggle-label">Preview SP</span>
                </div>
              </div>

              <!-- API Key Management -->
              <div class="api-key-advanced">
                <label for="api-key-input" class="api-key-label">Bria API Token</label>
                <div class="api-key-row">
                  <input type="password" id="api-key-input" class="api-key-input" placeholder="Enter Bria API token…"
                    autocomplete="off" />
                  <button id="api-key-toggle" class="icon-btn" title="Show/hide key">👁</button>
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
