import { CardJsonEditor, transformStructuredPrompt, untransformStructuredPrompt, highlightRawString, highlightRawJson } from '../card-json-editor.js';
import { findDiffPaths } from '../utils.js';

/**
 * VGL Inspector Component
 * Provides a UI panel for inspecting and modifying VGL structure.
 */
export class VglInspector extends HTMLElement {
    constructor() {
        super();
        this.options = {
            onPushToPrompt: null // Callback when user pushes edited RAW JSON to prompt
        };

        // State
        this.currentData = null;
        this.oldData = null;
        this.viewMode = 'tree'; // 'tree' or 'raw'
    }

    setConfig(options = {}) {
        Object.assign(this.options, options);
    }

    connectedCallback() {
        if (!this.querySelector('.vgl-inspector-sidebar')) {
            this.render();
        }
    }

    render() {
        this.innerHTML = `
            <aside class="json-sidebar vgl-inspector-sidebar" style="width: 100%; flex: 1; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">
                <div class="sidebar-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); background: transparent;">
                    <h3 style="margin: 0; font-size: 14px;">Visual Generative Language</h3>
                    <div class="sidebar-actions">
                        <select class="vgl-view-mode" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; padding: 2px 6px; font-size: 12px;">
                            <option value="tree" selected>Cards</option>
                            <option value="raw">Raw Edit</option>
                        </select>
                    </div>
                </div>
                
                <div class="sidebar-content" style="flex: 1; overflow: hidden; position: relative; background: transparent; display: flex; flex-direction: column;">
                    <!-- Tree Viewer -->
                    <div class="json-inspector-view vgl-tree-view" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 0;">
                        <div style="padding: 6px 12px; display: flex; gap: 6px; background: transparent; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <button class="btn btn-secondary btn-sm vgl-expand-all" style="font-size: 10px; padding: 2px 8px;">Expand All</button>
                            <button class="btn btn-secondary btn-sm vgl-collapse-all" style="font-size: 10px; padding: 2px 8px;">Collapse All</button>
                            <button class="btn btn-secondary btn-sm vgl-show-changes" style="font-size: 10px; padding: 2px 8px;">Show Changes</button>
                        </div>
                        <div class="vgl-tree-container" style="padding: 12px; flex: 1; overflow-y: auto; min-height: 0;">
                            <div style="color: var(--text-muted); font-size: 12px;">(no data)</div>
                        </div>
                    </div>
                    
                    <!-- Raw Editor -->
                    <div class="json-inspector-view hidden vgl-raw-view" style="flex: 1; padding: 0; position: relative;">
                        <!-- Highlight overlay placed exactly underneath -->
                        <pre class="vgl-raw-syntax" style="position: absolute; inset: 0; width: 100%; height: 100%; font-family: monospace; font-size: 12px; line-height: 18px; padding: 12px; box-sizing: border-box; margin: 0; pointer-events: none; z-index: 1; white-space: pre-wrap; word-wrap: break-word; overflow: hidden; color: var(--text-primary);"></pre>
                        <!-- Transparent textarea layered exactly on top -->
                        <textarea class="vgl-raw-textarea" spellcheck="false" style="position: absolute; inset: 0; width: 100%; height: 100%; border: none; background: transparent; color: transparent; caret-color: var(--text-primary); font-family: monospace; font-size: 12px; line-height: 18px; padding: 12px; box-sizing: border-box; outline: none; resize: none; margin: 0; z-index: 2; white-space: pre-wrap; word-wrap: break-word;"></textarea>
                    </div>
                </div>
                
                <div class="vgl-inspector-footer" style="padding: 8px; border-top: 1px solid rgba(255, 255, 255, 0.05); background: transparent; display: flex; gap: 8px;">
                    <div class="vgl-copy-part-wrap" style="position: relative; flex: 1;">
                        <button class="btn btn-secondary btn-sm vgl-copy-part-btn" style="width: 100%;" title="Copy options">⎘ Copy ▾</button>
                        <div class="context-menu vgl-copy-part-menu" style="display: none; position: absolute; bottom: 100%; left: 0; z-index: 1000; margin-bottom: 4px;"></div>
                    </div>
                    <button class="btn btn-primary btn-sm vgl-push-btn" style="flex: 1;" disabled>Push to Prompt</button>
                </div>
            </aside>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const modeSelect = this.querySelector('.vgl-view-mode');
        const treeView = this.querySelector('.vgl-tree-view');
        const rawView = this.querySelector('.vgl-raw-view');
        const rawTextarea = this.querySelector('.vgl-raw-textarea');
        const pushBtn = this.querySelector('.vgl-push-btn');

        // Toggle Views
        modeSelect.addEventListener('change', (e) => {
            this.viewMode = e.target.value;
            if (this.viewMode === 'raw') {
                treeView.classList.add('hidden');
                rawView.classList.remove('hidden');
                rawTextarea.value = this.currentData ? JSON.stringify(this.currentData, null, 2) : '';
            } else {
                rawView.classList.add('hidden');
                treeView.classList.remove('hidden');
            }
        });

        // Sync scrolling for syntax highlighter overlay
        if (rawTextarea) {
            const rawSyntax = this.querySelector('.vgl-raw-syntax');
            if (rawSyntax) {
                rawTextarea.addEventListener('scroll', () => {
                    rawSyntax.scrollTop = rawTextarea.scrollTop;
                    rawSyntax.scrollLeft = rawTextarea.scrollLeft;
                });
            }
        }

        // Expand / Collapse all
        const expandAllBtn = this.querySelector('.vgl-expand-all');
        const collapseAllBtn = this.querySelector('.vgl-collapse-all');
        const showChangesBtn = this.querySelector('.vgl-show-changes');

        const toggleAll = (collapse) => {
            const headers = this.querySelectorAll('.vgl-tree-container .card-header');
            headers.forEach(h => {
                const children = h.nextElementSibling;
                if (!children) return;
                const isHidden = children.classList.contains('hidden');
                if ((collapse && !isHidden) || (!collapse && isHidden)) {
                    h.click(); // Toggle cleanly
                }
            });
        };

        if (expandAllBtn) expandAllBtn.addEventListener('click', () => toggleAll(false));
        if (collapseAllBtn) collapseAllBtn.addEventListener('click', () => toggleAll(true));
        
        if (showChangesBtn) {
            showChangesBtn.addEventListener('click', () => {
                const headers = this.querySelectorAll('.vgl-tree-container .card-header');
                headers.forEach(h => {
                    const children = h.nextElementSibling;
                    if (!children) return;
                    
                    const cardGroup = h.closest('.card-group');
                    const hasDiff = cardGroup && cardGroup.classList.contains('highlight-card-ancestor');
                    const isHidden = children.classList.contains('hidden');
                    
                    if (hasDiff && isHidden) {
                        h.click();
                    } else if (!hasDiff && !isHidden) {
                        h.click();
                    }
                });
            });
        }

        // Global input observer for sidebar fixes "Push to prompt" ghost-blur click issue
        this.querySelector('.vgl-inspector-sidebar').addEventListener('input', (e) => {
            const currentPushBtn = this.querySelector('.vgl-push-btn');
            if (currentPushBtn && (e.target.matches('.card-edit-input') || e.target.classList.contains('vgl-raw-textarea'))) {
                currentPushBtn.disabled = false;
            }

            // Live syntax highlighting for the Raw Editor
            if (e.target.classList.contains('vgl-raw-textarea')) {
                const rawSyntax = this.querySelector('.vgl-raw-syntax');
                if (rawSyntax) {
                    rawSyntax.innerHTML = highlightRawString(e.target.value);
                }
            }
        });

        pushBtn.addEventListener('click', () => {
            try {
                const parsed = JSON.parse(rawTextarea.value);
                const flattenedData = untransformStructuredPrompt(parsed);

                // Scrub edit instructions to prevent feedback loops in generation
                const scrubKeys = ['edit', 'edit_instruction', 'edit instruction', 'edit_instructions', 'instruction'];
                scrubKeys.forEach(k => {
                    if (flattenedData && typeof flattenedData === 'object' && k in flattenedData) {
                        delete flattenedData[k];
                    }
                });

                this.currentData = flattenedData;
                if (this.options.onPushToPrompt) {
                    this.options.onPushToPrompt(flattenedData);
                }

                const origText = pushBtn.textContent;
                pushBtn.textContent = 'Pushed!';
                pushBtn.classList.add('accent-success');
                pushBtn.disabled = true; // wait for next edit
                setTimeout(() => {
                    pushBtn.textContent = origText;
                    pushBtn.classList.remove('accent-success');
                }, 1500);

            } catch (err) {
                alert('Invalid JSON: ' + err.message);
            }
        });

        // rawTextarea listener removed (handled globally above)

        // Copy Part Dropdown Toggle
        const copyPartBtn = this.querySelector('.vgl-copy-part-btn');
        const copyPartMenu = this.querySelector('.vgl-copy-part-menu');
        if (copyPartBtn && copyPartMenu) {
            copyPartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyPartMenu.style.display = copyPartMenu.style.display === 'block' ? 'none' : 'block';
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.vgl-copy-part-wrap')) {
                    copyPartMenu.style.display = 'none';
                }
            });
        }
    }

    /**
     * Update the display with new VGL JSON data.
     * @param {Object} newData 
     * @param {Object} [oldData=null] - Optional previous state for diffing
     */
    updateData(newData, oldData = null) {
        if (typeof newData === 'string' && newData.trim().startsWith('{')) {
            try { newData = JSON.parse(newData); } catch (e) { console.error('Failed to parse VGL newData', e); }
        }
        if (typeof oldData === 'string' && oldData.trim().startsWith('{')) {
            try { oldData = JSON.parse(oldData); } catch (e) { console.error('Failed to parse VGL oldData', e); }
        }

        this.currentData = newData;
        this.oldData = oldData;

        // Render Tree using JsonEditor (Task 2 & 7)
        const treeContainer = this.querySelector('.vgl-tree-container');
        if (treeContainer) {
            if (!newData) {
                treeContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px;">(no data)</div>';
            } else {
                const transformedNew = transformStructuredPrompt(newData);
                const transformedOld = oldData ? transformStructuredPrompt(oldData) : null;
                const diffPaths = findDiffPaths(transformedOld, transformedNew);

                if (!this.jsonEditorInstance) {
                    this.jsonEditorInstance = new CardJsonEditor(treeContainer, {
                        readonly: false,
                        highlightPaths: diffPaths,
                        onChange: (updatedData) => {
                            this.currentData = updatedData;
                            const rawTextarea = this.querySelector('.vgl-raw-textarea');
                            const rawSyntax = this.querySelector('.vgl-raw-syntax');
                            if (rawTextarea) {
                                rawTextarea.value = JSON.stringify(updatedData, null, 2);
                            }
                            if (rawSyntax) {
                                rawSyntax.innerHTML = highlightRawJson(updatedData, diffPaths);
                            }
                            const pushBtn = this.querySelector('.vgl-push-btn');
                            if (pushBtn) pushBtn.disabled = false;
                        }
                    });
                }
                this.jsonEditorInstance.highlightPaths = diffPaths;
                this.jsonEditorInstance.setData(transformedNew);

                const rawTextarea = this.querySelector('.vgl-raw-textarea');
                const rawSyntax = this.querySelector('.vgl-raw-syntax');
                if (rawTextarea) {
                    rawTextarea.value = JSON.stringify(transformedNew, null, 2);
                }
                if (rawSyntax) {
                    rawSyntax.innerHTML = highlightRawJson(transformedNew, diffPaths);
                }
            }
        }

        // Rebuild Copy Parts Dropdown (Task 3)
        const copyPartBtn = this.querySelector('.vgl-copy-part-btn');
        const copyPartMenu = this.querySelector('.vgl-copy-part-menu');
        if (copyPartBtn && copyPartMenu && newData) {
            copyPartMenu.innerHTML = '';

            const sp = newData || {};
            const objects = sp.objects || [];

            // Add 'Copy All'
            const copyAllItem = document.createElement('button');
            copyAllItem.textContent = '⎘ Copy All';
            copyAllItem.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(JSON.stringify(sp, null, 2));
                copyPartMenu.style.display = 'none';
                copyPartBtn.textContent = 'Copied!';
                setTimeout(() => copyPartBtn.textContent = '⎘ Copy ▾', 1500);
            });
            copyPartMenu.appendChild(copyAllItem);

            // Insert a divider 
            copyPartMenu.insertAdjacentHTML('beforeend', '<hr style="margin: 4px 0; border: 0; border-top: 1px solid var(--border-color); width: 100%;" />');

            if (sp.background_setting) {
                const bgBtn = document.createElement('button');
                bgBtn.textContent = '🌅 Copy Background';
                bgBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Just copy the property (usually an object) directly as a string
                    const exportText = typeof sp.background_setting === 'string' ? sp.background_setting : JSON.stringify(sp.background_setting, null, 2);
                    navigator.clipboard.writeText(exportText);
                    copyPartMenu.style.display = 'none';
                    copyPartBtn.textContent = 'Copied!';
                    setTimeout(() => copyPartBtn.textContent = '⎘ Copy ▾', 1500);
                });
                copyPartMenu.appendChild(bgBtn);
            }

            if (objects.length > 0) {
                const objSubmenuItem = document.createElement('div');
                objSubmenuItem.className = 'context-submenu-item';

                const origTrigger = document.createElement('button');
                origTrigger.className = 'context-submenu-trigger';
                origTrigger.textContent = '📋 Copy Object ▶';

                const origSubmenu = document.createElement('div');
                origSubmenu.className = 'context-submenu';
                // Because menu is at bottom left, submenu should pop up to the right
                origSubmenu.style.bottom = '0';
                origSubmenu.style.top = 'auto';
                origSubmenu.style.left = '100%';
                origSubmenu.style.right = 'auto';

                objects.forEach(obj => {
                    const desc = obj.description || '';
                    const firstSentence = desc.split(/[.!?]/)[0].trim();
                    const rawLabel = firstSentence || desc;
                    const label = rawLabel.length > 45 ? rawLabel.slice(0, 42) + '…' : rawLabel;

                    const btn = document.createElement('button');
                    btn.textContent = label;
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
                        copyPartMenu.style.display = 'none';
                        copyPartBtn.textContent = 'Copied!';
                        setTimeout(() => copyPartBtn.textContent = '⎘ Copy ▾', 1500);
                    });
                    origSubmenu.appendChild(btn);
                });

                objSubmenuItem.appendChild(origTrigger);
                objSubmenuItem.appendChild(origSubmenu);
                copyPartMenu.appendChild(objSubmenuItem);
            }

            if (!sp.background_setting && !sp.context && objects.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'ctx-empty';
                empty.textContent = 'No parts available';
                copyPartMenu.appendChild(empty);
            }
        }
    }
}

customElements.define('vgl-inspector', VglInspector);
