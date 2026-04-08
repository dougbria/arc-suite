/* ============================================================
   app.js — Main application controller
   Wires together all modules and event handlers.
   ============================================================ */

import state from './state-extensions.js';
import { core, Canvas, Gallery, State as stateEngine, CardJsonEditor, EntityEditor, apiConsole, VglInspector } from '@arc/core';
const { dataDB } = stateEngine;
import api from '@arc/api.js';
import { initCanvasController } from './canvas-controller.js';
import { initSetupCanvas } from './setup-canvas.js';
import { composeVglTemplate } from './vgl-compose.js';
import { initStoryboardUI } from './storyboard.js';
import { initSidebarController } from './sidebar-controller.js';
import { generateEntityVGL } from './llm-api.js';
import { initReviewUI } from './review.js';
import { initRegenQueue } from './regen-queue.js';
import { initCompare } from '@arc/compare.js';
import { initResizers } from '@arc/resizer.js';
import {
    createThumbnail,
    generateUUID,
    findDiffPaths,
    copyToClipboard,
    downloadPNG,
    downloadJSON,
    downloadTxt,
    generateFilename,
    generateTxtFilename,
    generateTxtReport,
    fileToBase64,
    showToast,
    pickExportFolder,
    writeFilesToHandle,
    saveFilesToFolder
} from '@arc/utils.js';
import { enhanceImage } from '@arc/actions.js';
// JsonEditor sourced from @arc/core

const { initGallery } = Gallery;
import JSZip from 'jszip';

// Load ArcDrama CSS
import './arc-drama.css';

import { SetupView } from './components/SetupView.js';
import { StoryboardView } from './components/StoryboardView.js';
import { ShotNavigator } from './components/ShotNavigator.js';


// ---- Critical Error Monitoring ----
window.addEventListener('error', (e) => {
    console.error('[GLOBAL ERROR]:', e.error || e.message);
    showToast('App Crash: ' + (e.message || 'Check console'), 5000);
});
window.addEventListener('unhandledrejection', (e) => {
    console.error('[UNHANDLED REJECTION]:', e.reason);
    showToast('Async Error: ' + (e.reason?.message || 'Check console'), 5000);
});

// ============================================================
// STRUCTURED PROMPT PASSTHROUGH DETECTION
// ============================================================

/**
 * The minimum set of top-level keys required to treat a JSON object
 * as a pre-formed structured prompt (per the SP schema).
 */
const SP_REQUIRED_KEYS = [
    'short_description',
    'objects',
    'lighting',
    'aesthetics',
    'photographic_characteristics'
];

/**
 * Try to parse `text` as a structured prompt JSON.
 * Returns the parsed object if it matches the schema requirements,
 * or null if it's not a valid / recognised SP JSON.
 *
 * @param {string} text
 * @returns {Object|null}
 */
function parseAsStructuredPrompt(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed.startsWith('{')) return null; // fast-exit for plain prompts
    try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const hasAllRequired = SP_REQUIRED_KEYS.every(k => Object.prototype.hasOwnProperty.call(parsed, k));
        return hasAllRequired ? parsed : null;
    } catch {
        return null; // not valid JSON
    }
}

// ---- DOM Elements ----
const getEl = (id) => {
    const el = document.getElementById(id);
    if (!el) console.warn(`[DOM] Element not found: #${id}`);
    return el;
};

// Mount UI Footers synchronously before querying the DOM
import { PromptBar } from '@arc/core';
new PromptBar('app').render();

// Main Elements
const projectSelect = getEl('project-select');
const newProjectBtn = getEl('new-project-btn');
const deleteShotBtn = getEl('delete-shot-btn');
const newProjectDialog = getEl('new-project-dialog');
const newProjectName = getEl('new-project-name');
const welcomeNewBtn = getEl('welcome-new-btn');
const apiKeyInput = getEl('api-key-input');
const apiKeyToggle = getEl('api-key-toggle');

// JSON Sidebar Elements
// Element references stripped for component migration

const promptInput = getEl('prompt-input');
const negativePromptInput = getEl('negative-prompt-input');
const imageCountSelect = getEl('image-count-select');
const aspectRatioSelect = getEl('aspect-ratio-select');
const resolutionSelect = getEl('resolution-select');
const seedInput = getEl('seed-input');

// Workspace Selectors (Phase 1.10)
const promptCharSelect = getEl('prompt-char-select');
const promptLocSelect = getEl('prompt-loc-select');

const liteModeToggle = getEl('lite-mode-toggle');
const liteModeBtnCheckbox = getEl('lite-mode-btn'); // New checkbox for UI Maximize
const liteQuickBtn   = document.getElementById('lite-quick-btn');

// Sync button ↔ hidden checkbox so any existing code reading liteModeToggle still works
if (liteQuickBtn) {
    liteQuickBtn?.addEventListener('click', () => {
        const isNowActive = liteQuickBtn?.classList.toggle('active');
        if (liteModeToggle) liteModeToggle.checked = isNowActive;
    });
}

if (liteModeBtnCheckbox) {
    liteModeBtnCheckbox?.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body?.classList.add('lite-mode');
        } else {
            document.body?.classList.remove('lite-mode');
        }
    });
}
const modContentToggle = getEl('mod-content-toggle');
const modInputToggle = getEl('mod-input-toggle');
const modOutputToggle = getEl('mod-output-toggle');
const previewSpCheckbox = getEl('preview-sp-checkbox');

const imageUpload = getEl('image-upload');
const uploadBtnText = getEl('upload-btn-text');
const uploadPreviewWrap = getEl('upload-preview-wrap');
const uploadPreview = getEl('upload-preview');
const clearUploadBtn = getEl('clear-upload-btn');

const btnGenerate = getEl('btn-generate');
const btnRefine = getEl('btn-refine');
const btnEdit = getEl('btn-edit');
const actionButtonsStack = getEl('action-buttons-stack');
const btnInterrupt = getEl('btn-interrupt');
const progressText = btnInterrupt ? btnInterrupt.querySelector('.progress-text') : null;

const refIndicator = getEl('ref-indicator');

const retryBtn = getEl('retry-btn');
const infoSeed = getEl('info-seed');
const infoPrompt = getEl('info-prompt');


const spToggle = getEl('sp-toggle');
const spContent = getEl('sp-content');
const spJson = getEl('sp-json');
const spToggleIcon = spToggle ? spToggle.querySelector('.vgl-toggle-icon') : null;

const spPreviewDialog = getEl('sp-preview-dialog');
const spPreviewEditor = getEl('sp-preview-editor');
const spPreviewGenerate = getEl('sp-preview-generate');
const spPreviewCancel = getEl('sp-preview-cancel');

// API Key Warning Dialog
const apiKeyWarningDialog = getEl('api-key-warning-dialog');
const apiKeyWarningGo = getEl('api-key-warning-go');
const apiKeyWarningClose = getEl('api-key-warning-close');

apiKeyWarningGo?.addEventListener('click', () => {
    apiKeyWarningDialog?.close();
    const advanced = document.querySelector('.prompt-advanced-details');
    if (advanced) advanced.open = true;
    apiKeyInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    apiKeyInput?.focus();
});
apiKeyWarningClose?.addEventListener('click', () => apiKeyWarningDialog?.close());

const globalConsoleBtn = getEl('global-console-btn');

const exportStarredBtn = getEl('export-starred-btn');

let currentAbortController = null;

// ============================================================
// INITIALIZATION
// ============================================================

(async function startup() {
    console.log('[APP] Starting initialization...');
    await state.init();
    
    if (apiConsole) apiConsole.init(document.body);

    // Load workspace early, so it's ready before canvas/gallery updates
    await state.loadWorkspace();
    
    console.log('[APP] State initialized');

    core.init();
    core.ui.addContextButton('Breakdown Plugin', () => showToast('Breakdown Plugin active'));
    core.plugins.register(new EntityEditor({ generateVGL: generateEntityVGL }));

    initCanvasController();
    
    // Inject components into mount points
    const setupView = new SetupView('arc-main-mount');
    setupView.render();
    const storyboardView = new StoryboardView('arc-main-mount');
    storyboardView.render();
    const shotNav = new ShotNavigator('canvas-hooks-overlay');
    shotNav.render();

    initSetupCanvas();
    initStoryboardUI();
    initSidebarController();
    initReviewUI();
    initRegenQueue();
    initGallery();
    initCompare();
    initResizers([
        { resizerId: 'resizer-gallery', prevId: 'arc-main-mount', nextId: 'arc-gallery-mount', mode: 'horizontal' },
        { resizerId: 'resizer-json', prevId: 'arc-gallery-mount', nextId: 'arc-vgl-mount', mode: 'horizontal' }
    ]);
    console.log('[APP] Modules initialized');

    loadApiKey();
    updateStorageUI();
    populateProjectSelect();
    updateActionButtonsState();

    console.log('[APP] VGL Studio initialized (Bria API refactored)');
})();

// ============================================================
// STORAGE SETUP UI
// ============================================================

const storageBanner = document.getElementById('storage-banner');
const storageBannerTitle = document.getElementById('storage-banner-title');
const storageBannerDesc = document.getElementById('storage-banner-desc');
const storagePickBtn = document.getElementById('storage-pick-btn');
const storageSkipBtn = document.getElementById('storage-skip-btn');
const storageBannerClose = document.getElementById('storage-banner-close');
const storageIndicatorBtn = document.getElementById('storage-indicator-btn');
const storageIndicatorName = document.getElementById('storage-indicator-name');

/**
 * Reflect the current storageType in the UI:
 *   'pending'  → show setup banner
 *   'fs'       → hide banner, show folder indicator in header
 *   'ls'       → hide banner, hide indicator
 */
function updateStorageUI() {
    if (!storageBanner) return;

    if (state.storageType !== 'fs') {
        // Force the user to choose a directory.
        if (storageBannerTitle) storageBannerTitle.textContent = 'ArcDrama requires Local Folder Storage';
        if (storageBannerDesc) storageBannerDesc.textContent = 'Please choose a local folder mapped to your hard drive to create ArcDrama Shows. Browser storage is unsupported.';
        if (storagePickBtn) { storagePickBtn.textContent = 'Choose Storage Folder'; storagePickBtn?.classList.remove('hidden'); }
        storageSkipBtn?.classList.add('hidden');
        storageBannerClose?.classList.add('hidden'); // Cannot dismiss
        storageBanner?.classList.remove('hidden');
        
        if (storageIndicatorBtn && storageIndicatorName) {
            storageIndicatorName.textContent = 'Storage Required';
            storageIndicatorBtn?.classList.remove('hidden');
        }
    } else {
        storageBanner?.classList.add('hidden');
        if (storageIndicatorBtn && storageIndicatorName) {
            storageIndicatorName.textContent = dataDB.rootDir?.name || 'Local Folder';
            storageIndicatorBtn?.classList.remove('hidden');
        }
    }
}

if (storagePickBtn) {
    storagePickBtn?.addEventListener('click', async () => {
        try {
            const success = true; // Auto-verify or prompt handled by DataService natively
            if (success) {
                state.storageType = 'fs';
                state.emit('storageReady');
            }
        } catch (err) {
            console.error('Failed to get FS permission:', err);
        }
    });
}

// After the FS folder is chosen
state.on('storageReady', async () => {
    await state.loadWorkspace();
    updateStorageUI();
    populateProjectSelect();
    updateActionButtonsState();
});

state.on('workspaceChanged', () => {
    if (state.workspace && promptCharSelect && promptLocSelect) {
        // Save current selections to restore them after repopulating
        const activeChars = Array.from(promptCharSelect.selectedOptions).map(o => o.value);
        const activeLoc = promptLocSelect.value;
        
        promptCharSelect.innerHTML = '';
        state.workspace.characters.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            if (activeChars.includes(c.id)) opt.selected = true;
            promptCharSelect.appendChild(opt);
        });
        
        promptLocSelect.innerHTML = '<option value="">— None —</option>';
        state.workspace.locations.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.name;
            if (activeLoc === l.id) opt.selected = true;
            promptLocSelect.appendChild(opt);
        });
    }
});

// "Choose Folder" button
storagePickBtn?.addEventListener('click', async () => {
    if (storagePickBtn) storagePickBtn.disabled = true;
    storagePickBtn.textContent = 'Opening…';
    const ok = await state.setupStorage();
    if (storagePickBtn) storagePickBtn.disabled = false;
    storagePickBtn.textContent = 'Choose Folder';
    if (!ok) showToast('No folder selected — try again.');
});

// "Use Browser Storage" button
storageSkipBtn?.addEventListener('click', async () => {
    await state.skipToLocalStorage();
    localStorage.setItem('vgl-studio-banner-dismissed', '1');
    updateStorageUI();
});

// Dismiss (X) — remembers choice in localStorage so banner stays gone
storageBannerClose?.addEventListener('click', () => {
    localStorage.setItem('vgl-studio-banner-dismissed', '1');
    storageBanner?.classList.add('hidden');
});

// Header folder indicator — clicking lets the user change the folder
storageIndicatorBtn?.addEventListener('click', async () => {
    if (!confirm('Change your storage folder? Your current projects will remain in the old folder.')) return;
    const ok = await state.setupStorage();
    if (ok) {
        updateStorageUI();
        showToast('✓ Storage folder updated.');
    }
});

// ============================================================
// PROJECT MANAGEMENT
// ============================================================

function populateProjectSelect() {
    if (!projectSelect) return;
    const projects = state.getProjectList();
    const activeId = state.activeProjectId;

    projectSelect.innerHTML = '<option value="">— Select Project —</option>';
    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const displayName = p.name.length > 40 ? p.name.substring(0, 40) + '...' : p.name;
        opt.textContent = `${displayName} (${p.imageCount})`;
        if (p.id === activeId) opt.selected = true;
        projectSelect.appendChild(opt);
    });
}

if (projectSelect) {
    projectSelect?.addEventListener('change', () => {
        const id = projectSelect.value;
        if (id) {
            state.switchProject(id);
            // updateJsonInspector() now handled by events in initialiser
        }
    });
}

if (newProjectBtn) newProjectBtn?.addEventListener('click', openNewProjectDialog);
if (welcomeNewBtn) welcomeNewBtn?.addEventListener('click', () => {
    // In ArcDrama, creating a "New Project" on the welcome screen should mean 
    // going to Setup and creating a Workspace.
    state.setCanvasMode('setup');
    const setupNewBtn = document.getElementById('setup-new-workspace-btn');
    if (setupNewBtn) setupNewBtn.click();
});

const setupDelWkspBtn = document.getElementById('setup-delete-workspace-btn');
if (setupDelWkspBtn) {
    setupDelWkspBtn?.addEventListener('click', async () => {
        if (!state.workspace) return;
        const confirmDel = confirm(`Are you sure you want to permanently delete the show "${state.workspace.name}"? This cannot be undone.`);
        if (confirmDel) {
            await state.deleteWorkspace(state.workspace.id);
            // State handles fallback, just refresh UI
            if (!state.workspace) {
                document.getElementById('workspace-title').textContent = 'No Show Loaded';
                if (projectSelect) projectSelect.innerHTML = '<option value="">— Select Project —</option>';
            }
        }
    });
}

function openNewProjectDialog() {
    if (!newProjectDialog) return;
    if (newProjectName) newProjectName.value = '';
    if (newProjectDialog.showModal) {
        newProjectDialog.showModal();
    } else {
        newProjectDialog.setAttribute('open', '');
    }
}

if (newProjectDialog) {
    newProjectDialog?.addEventListener('close', async () => {
        if (newProjectDialog.returnValue === 'create' && newProjectName.value.trim()) {
            await state.createProject(newProjectName.value.trim());
            populateProjectSelect();
        }
    });
}

if (deleteShotBtn) deleteShotBtn?.addEventListener('click', async () => {
    const project = state.getActiveProject();
    if (!project) return;
    if (confirm(`Delete shot "${project.name}"? This cannot be undone.`)) {
        await state.deleteProject(project.id);
        populateProjectSelect();
    }
});

if (exportStarredBtn) exportStarredBtn.onclick = async () => {
    if (exportStarredBtn.dataset.exporting) return;
    exportStarredBtn.dataset.exporting = '1';
    if (exportStarredBtn) exportStarredBtn.disabled = true;

    try {
        const project = state.getActiveProject();
        const starredImages = project?.images.filter(img => img.isStarred) || [];

        if (!starredImages.length) {
            showToast('No starred images in this project to export.');
            return;
        }

        /** Return full base64 for an image — loads from disk in FS mode. */
        async function resolveBase64(img) {
            if (img.base64) return img.base64;
            if (state.storageType === 'fs') {
                const b64 = await dataDB.getImageBase64(img.id);
                if (b64) return b64;
            }
            return null;
        }

        showToast(`Preparing ${starredImages.length} image${starredImages.length > 1 ? 's' : ''}…`);

        // Build a zip with all starred images + sidecar files
        const zip = new JSZip();
        let count = 0;

        for (const img of starredImages) {
            const base = generateFilename(img, project.name, project);
            const txtBase = generateTxtFilename(img, project.name, project);
            const b64 = await resolveBase64(img);
            if (!b64) continue;

            // PNG — strip data URL header and decode to binary
            const raw = b64.replace(/^data:image\/\w+;base64,/, '');
            zip.file(base + '.png', raw, { base64: true });

            // VGL JSON sidecar
            if (img.structured_prompt) {
                let spObj;
                try { spObj = typeof img.structured_prompt === 'string' ? JSON.parse(img.structured_prompt) : img.structured_prompt; }
                catch { spObj = img.structured_prompt; }
                zip.file(base + '.json', JSON.stringify(spObj, null, 2));
            }

            // Text report
            zip.file(txtBase + '.txt', generateTxtReport(img, project));
            count++;
        }

        if (!count) { showToast('⚠️ Could not load any images to export.'); return; }

        // Generate zip blob and trigger single download
        const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
        const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const zipFilename = `${projectSlug}_starred_${ts}.zip`;

        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = zipFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        showToast(`✓ Downloaded ${count} image${count !== 1 ? 's' : ''} as ${zipFilename}`);
    } finally {
        delete exportStarredBtn.dataset.exporting;
        if (exportStarredBtn) exportStarredBtn.disabled = false;
    }
};

// Clear Starred button
const clearStarredBtn = document.getElementById('clear-starred-btn');
if (clearStarredBtn) clearStarredBtn?.addEventListener('click', () => {
    const project = state.getActiveProject();
    const starred = project?.images.filter(img => img.isStarred) || [];
    if (!starred.length) {
        showToast('No starred images to clear.');
        return;
    }
    if (!confirm(`Unstar all ${starred.length} starred image${starred.length > 1 ? 's' : ''}?`)) return;
    starred.forEach(img => state.toggleStar(img.id));
    showToast(`Unstarred ${starred.length} image${starred.length > 1 ? 's' : ''}.`);
});



state.on('projectChanged', () => {
    populateProjectSelect();
    updateActionButtonsState();
    // Handled by Event Listener
    updateHeaderToggleState();
    updateStarredCount();
});

state.on('imagesChanged', () => {
    updateStarredCount();
});
state.on('imageStarred', () => {
    updateStarredCount();
});

function updateStarredCount() {
    const project = state.getActiveProject();
    if (!project) return;
    const count = project.images.filter(img => img.isStarred).length;
    const el = document.getElementById('starred-count');
    if (el) el.textContent = count;
}

function updateHeaderToggleState() {
    const vglMount = document.getElementById('arc-vgl-mount'); const isCollapsed = vglMount ? vglMount?.classList.contains('collapsed') : false;
    document.getElementById('json-sidebar-header-toggle')?.classList.toggle('active', !isCollapsed);
}

document.getElementById('json-sidebar-header-toggle')?.addEventListener('click', () => {
    const vglMount = document.getElementById('arc-vgl-mount');
    if (!vglMount) return;
    vglMount.classList.toggle('collapsed');
    updateHeaderToggleState();
});

// ============================================================
// API KEY
// ============================================================

function loadApiKey() {
    const key = state.getApiKey();
    if (key) {
        if (apiKeyInput) apiKeyInput.value = key;
    }
}

if (apiKeyInput) {
    apiKeyInput?.addEventListener('input', () => {
        state.setApiKey(apiKeyInput.value);
        updateActionButtonsState();
    });
}

// Component now handles toggling

if (apiKeyToggle) {
    apiKeyToggle?.addEventListener('click', () => {
        const isPassword = apiKeyInput.type === 'password';
        if (apiKeyInput) apiKeyInput.type = isPassword ? 'text' : 'password';
        apiKeyToggle.textContent = isPassword ? '🙈' : '👁';
    });
}


// ============================================================
// PROMPT AUTO-EXPAND + EXPAND MODAL
// ============================================================

const promptExpandBtn    = document.getElementById('prompt-expand-btn');
const promptExpandDialog = document.getElementById('prompt-expand-dialog');
const promptExpandEditor = document.getElementById('prompt-expand-editor');
const promptExpandDone   = document.getElementById('prompt-expand-done');
const promptExpandCancel = document.getElementById('prompt-expand-cancel');

/** Resize promptInput to fit its content, capped at max-height from CSS. */
function autoExpandPrompt() {
    promptInput.style.height = 'auto';
    promptInput.style.height = promptInput.scrollHeight + 'px';
}

if (promptInput) {
    promptInput?.addEventListener('input', autoExpandPrompt);
    // Initial size-to-content in case a value is pre-filled
    autoExpandPrompt();

    /** Open the full-screen prompt editor. */
    function openPromptExpand() {
        promptExpandEditor.value = promptInput.value;
        promptExpandDialog.showModal();
        // Focus and move cursor to end
        promptExpandEditor.focus();
        promptExpandEditor.setSelectionRange(promptExpandEditor.value.length, promptExpandEditor.value.length);
    }

    /** Write the modal value back to the main textarea and close. */
    function commitPromptExpand() {
        if (promptInput) promptInput.value = promptExpandEditor.value;
        autoExpandPrompt();
        promptInput.dispatchEvent(new Event('input'));   // triggers updateActionButtonsState
        promptExpandDialog.close();
    }

    promptExpandBtn?.addEventListener('click', openPromptExpand);

    // Shift+Enter on the main textarea opens the modal
    promptInput?.addEventListener('keydown', (e) => {
        if (e.shiftKey && e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            openPromptExpand();
        }
    });

    // Ctrl+Enter inside the modal commits
    promptExpandEditor?.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            commitPromptExpand();
        }
    });

    promptExpandDone?.addEventListener('click', commitPromptExpand);
    promptExpandCancel?.addEventListener('click', () => promptExpandDialog.close());

    promptInput?.addEventListener('input', updateActionButtonsState);
}


function updateActionButtonsState() {
    if (!btnGenerate) return;
    const hasProject = !!state.getActiveProject();
    const hasApiKey = !!state.getApiKey();
    const hasPrompt = promptInput ? promptInput.value.trim().length > 0 : false;
    const hasFeatured = !!state.getFeaturedImage();

    // Project is a hard requirement for UI logic
    if (!hasProject) {
        if (btnGenerate) btnGenerate.disabled = true;
        if (btnRefine) btnRefine.disabled = true;
        if (btnEdit) btnEdit.disabled = true;
        return;
    }

    // Always enable Generate/Refine/Edit if we have a project,
    // so we can give constructive feedback on click if API key or Prompt is missing.
    if (btnGenerate) btnGenerate.disabled = false;
    if (btnRefine) btnRefine.disabled = false;
    if (btnEdit) btnEdit.disabled = false;

    // Visual cues only
    btnGenerate?.classList.toggle('dimmed', !hasPrompt || !hasApiKey);
    btnRefine?.classList.toggle('dimmed', !hasPrompt || !hasApiKey || !hasFeatured);
    btnEdit?.classList.toggle('dimmed', !hasPrompt || !hasApiKey || (!hasFeatured && !uploadedImageBase64));

    // Update Reference Indicator visibility
    if (hasFeatured) {
        const featured = state.getFeaturedImage();
        refIndicator?.classList.toggle('hidden', !featured.isReference);
    } else {
        refIndicator?.classList.add('hidden');
    }
}

state.on('featuredChanged', () => {
    updateActionButtonsState();
    // Handled by state listener
    renderShotNavSidebar();
    // Do NOT auto-populate the seed field — leave it showing the 'Rand' placeholder
    // unless the user has manually typed a value.
});

// ============================================================
// SHOT CONTEXT SIDEBAR & GALLERY DROPDOWN
// ============================================================

const shotNavSidebar = document.getElementById('shot-nav-sidebar');
const shotNavToggle = document.getElementById('shot-nav-toggle');
const shotContextCloseBtn = document.getElementById('shot-context-close-btn');
const sideSceneTitle = document.getElementById('side-scene-title');
const sideShotTitle = document.getElementById('side-shot-title');
const sideShotAction = document.getElementById('side-shot-action');
const sideShotDialogue = document.getElementById('side-shot-dialogue');
const sideShotPrev = document.getElementById('side-shot-prev');
const sideShotNext = document.getElementById('side-shot-next');
const galleryShotSelect = document.getElementById('gallery-shot-select');
const navBtnApprove = document.getElementById('nav-btn-approve');

if (shotNavToggle) {
    shotNavToggle?.addEventListener('click', () => {
        shotNavSidebar?.classList.toggle('hidden');
    });
}

if (shotContextCloseBtn) {
    shotContextCloseBtn?.addEventListener('click', () => {
        shotNavSidebar?.classList.add('hidden');
    });
}

if (galleryShotSelect) {
    galleryShotSelect?.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        if (selectedId) {
            state.activeShotId = selectedId;
            state.switchProject(selectedId);
        }
    });
}

function renderShotNavSidebar() {
    if (!shotNavSidebar) return;

    if (state.canvasMode === 'image' && state.activeEntityId) {
        shotNavSidebar?.classList.remove('hidden');
        
        if (galleryShotSelect) galleryShotSelect.innerHTML = `<option value="">Iterating Asset</option>`;
        sideSceneTitle.textContent = state.activeEntityType === 'character' ? 'Iterating: Character' : 'Iterating: Location';
        
        const arr = state.activeEntityType === 'character' ? state.workspace?.characters : state.workspace?.locations;
        const entity = arr?.find(e => e.id === state.activeEntityId);
        
        if (sideShotTitle) sideShotTitle.textContent = entity?.name || 'Unknown Asset';
        sideShotAction.textContent = entity?.vgl?.description || 'No description available.';
        if (sideShotDialogue) sideShotDialogue.style.display = 'none';
        if (sideShotPrev) sideShotPrev.textContent = '--';
        if (sideShotNext) sideShotNext.textContent = '--';
        return;
    }

    if (state.canvasMode === 'image' && state.activeEpisode) {
        
        // Populate Gallery Dropdown
        if (galleryShotSelect) {
            galleryShotSelect.innerHTML = '<option value="">Select Shot...</option>';
            let foundActiveInDropdown = false;
            for (const scene of state.activeEpisode.scenes) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = scene.title || 'Untitled Scene';
                for (const shot of scene.shots) {
                    const opt = document.createElement('option');
                    opt.value = shot.id;
                    opt.textContent = shot.num ? `SH${String(shot.num).padStart(3, '0')}` : 'SH???';
                    if (shot.id === state.activeShotId) {
                        opt.selected = true;
                        foundActiveInDropdown = true;
                    }
                    optgroup.appendChild(opt);
                }
                galleryShotSelect.appendChild(optgroup);
            }
            if (!foundActiveInDropdown && galleryShotSelect.options.length > 0) {
               galleryShotSelect.selectedIndex = 0;
            }
        }

        // Find active shot index in a flattened list to get Prev/Next
        let flattenedShots = [];
        let activeShotIndex = -1;
        
        for (const scene of state.activeEpisode.scenes) {
            for (const shot of scene.shots) {
                flattenedShots.push({ shot, scene });
                if (shot.id === state.activeShotId) {
                    activeShotIndex = flattenedShots.length - 1;
                }
            }
        }

        // Populate Sidebar Details
        if (activeShotIndex !== -1) {
            const active = flattenedShots[activeShotIndex];
            sideSceneTitle.textContent = active.scene.title || 'Untitled Scene';
            if (sideShotTitle) sideShotTitle.textContent = active.shot.num ? `Shot ${active.shot.num}` : 'Current Shot';
            sideShotAction.textContent = active.shot.action || 'No action described.';
            
            if (active.shot.dialogue && sideShotDialogue) {
                sideShotDialogue.textContent = `"${active.shot.dialogue.text}" - ${active.shot.dialogue.characterName}`;
                sideShotDialogue.style.display = 'block';
            } else if (sideShotDialogue) {
                sideShotDialogue.style.display = 'none';
            }
            
            // Prev Shot
            if (activeShotIndex > 0 && sideShotPrev) {
                sideShotPrev.textContent = flattenedShots[activeShotIndex - 1].shot.action || 'Untitled Shot';
            } else if (sideShotPrev) {
                sideShotPrev.textContent = '-- Start of Episode --';
            }
            
            // Next Shot
            if (activeShotIndex < flattenedShots.length - 1 && sideShotNext) {
                sideShotNext.textContent = flattenedShots[activeShotIndex + 1].shot.action || 'Untitled Shot';
            } else if (sideShotNext) {
                sideShotNext.textContent = '-- End of Episode --';
            }
        } else {
            sideSceneTitle.textContent = state.activeEpisode.title || 'Current Episode';
            if (sideShotTitle) sideShotTitle.textContent = 'No Shot Selected';
            sideShotAction.textContent = 'Please select a shot from the dropdown menu to generate keyframes.';
            if (sideShotDialogue) sideShotDialogue.style.display = 'none';
            if (sideShotPrev) sideShotPrev.textContent = 'None';
            if (sideShotNext) sideShotNext.textContent = 'None';
        }
    } else {
        shotNavSidebar?.classList.add('hidden');
    }
}

state.on('canvasModeChanged', renderShotNavSidebar);
state.on('episodeChanged', renderShotNavSidebar);
state.on('projectChanged', renderShotNavSidebar); // Update active button when switching shots

function updateGalleryApprovalBadges() {
    if (state.canvasMode !== 'image') return;
    
    let activeShot = null;
    if (state.activeEpisode && state.activeShotId) {
        for (const s of state.activeEpisode.scenes) {
            const found = s.shots.find(x => x.id === state.activeShotId);
            if (found) { activeShot = found; break; }
        }
    }
    
    const approvedId = activeShot ? activeShot.approvedImageId : null;
    
    document.querySelectorAll('.gallery-item').forEach(item => {
        const imgId = item.dataset.id;
        let badge = item.querySelector('.kf-badge');
        
        if (approvedId && imgId === approvedId) {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'kf-badge';
                badge.innerHTML = '★ APPROVED KF';
                item.appendChild(badge);
            }
            item.style.border = '2px solid var(--accent-color)';
            item.style.boxShadow = '0 0 12px var(--accent-color)';
        } else {
            if (badge) badge.remove();
            item.style.border = '';
            item.style.boxShadow = '';
        }
    });
}

// Hook badges up to project changes/image updates. 
// Using `imagesChanged` is safe but gallery rendering has a slight delay. 
// We use a small setTimeout on imagesChanged or just bind to mutation observer in a full app.
state.on('imagesChanged', () => setTimeout(updateGalleryApprovalBadges, 100));
state.on('projectChanged', () => setTimeout(updateGalleryApprovalBadges, 100));

if (navBtnApprove) {
    navBtnApprove?.addEventListener('click', async () => {
        const featuredImg = state.getFeaturedImage();
        if (!featuredImg || !state.activeEpisode || !state.activeShotId) return;
        
        let shot = null;
        for (const s of state.activeEpisode.scenes) {
            const found = s.shots.find(x => x.id === state.activeShotId);
            if (found) { shot = found; break; }
        }
        
        if (shot) {
            shot.approvedImageId = featuredImg.id;
            await state.saveWorkspace();
            updateGalleryApprovalBadges();
            showToast('Keyframe Approved for Shot!');
        }
    });
}

// ============================================================
// IMAGE UPLOAD
// ============================================================

if (imageUpload) {
    imageUpload?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        uploadedImageBase64 = await fileToBase64(file);
        uploadPreview.src = uploadedImageBase64;
        uploadPreviewWrap?.classList.remove('hidden');
        uploadBtnText.textContent = '✓';
        updateActionButtonsState();
    });
}

if (clearUploadBtn) {
    clearUploadBtn?.addEventListener('click', () => {
        uploadedImageBase64 = null;
        imageUpload.value = '';
        uploadPreview.src = '';
        uploadPreviewWrap?.classList.add('hidden');
        uploadBtnText.textContent = '📎';
        updateActionButtonsState();
    });
}

// ---- Interrupt ----
if (btnInterrupt) {
    btnInterrupt?.addEventListener('click', () => {
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
            state.setLoading(false);
            showToast('Processing interrupted');
        }
    });
}

// ============================================================
// SUBMIT ACTIONS (Generate / Refine / Edit)
// ============================================================

// ---- Submit Actions ----
if (btnGenerate) btnGenerate?.addEventListener('click', () => handleAction('generate'));
if (btnRefine) btnRefine?.addEventListener('click', () => handleAction('refine'));
if (btnEdit) btnEdit?.addEventListener('click', () => handleAction('edit'));

if (promptInput) {
    promptInput?.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            if (btnGenerate && !btnGenerate.disabled) handleAction('generate');
            else if (btnRefine && !btnRefine.disabled) handleAction('refine');
            else if (btnEdit && !btnEdit.disabled) handleAction('edit');
        }
    });
}

/**
 * Gather common generation options from the UI.
 */
function getGenerationOptions() {
    // Prefer the visible quick button; fall back to the (hidden) Advanced checkbox
    const isLite = liteQuickBtn ? liteQuickBtn?.classList.contains('active') : !!liteModeToggle.checked;
    return {
        aspect_ratio: aspectRatioSelect.value || undefined,
        resolution: resolutionSelect.value === '4MP' ? '4MP' : undefined,
        negative_prompt: negativePromptInput.value.trim() || undefined,
        lite: isLite,
        mod_content: !!modContentToggle.checked,
        mod_input: !!modInputToggle.checked,
        mod_output: !!modOutputToggle.checked,
        ip_signal: !!document.getElementById('ip-signal-toggle').checked
    };
}

async function handleAction(mode) {
    const prompt = promptInput.value.trim();
    const hasApiKey = !!state.getApiKey();

    // Check API key first — this is the harder blocker to discover
    if (!hasApiKey) {
        const dlg = document.getElementById('api-key-warning-dialog');
        if (dlg?.showModal) dlg.showModal();
        else showToast('Bria API Token is missing. See Advanced Settings.');
        return;
    }

    if (!prompt) {
        showToast('Please enter a prompt or instructions.');
        promptInput.focus();
        return;
    }

    const imageCount = parseInt(imageCountSelect.value, 10);
    const options = getGenerationOptions();
    const seed = seedInput.value.trim() ? parseInt(seedInput.value.trim(), 10) : null;

    console.log(`[handleAction] START - Mode: ${mode}, Count: ${imageCount}, Prompt: "${prompt}"`, options);

    try {
        const featured = state.getFeaturedImage();

        if ((mode === 'refine' || mode === 'edit') && !featured && !uploadedImageBase64) {
            showToast(`Please select an image in the gallery to ${mode}.`);
            return;
        }

        if (previewSpCheckbox.checked && (mode === 'generate' || mode === 'edit' || mode === 'refine')) {
            console.log('[handleAction] Redirecting to Preview SP');
            await handleStructuredPromptPreview(prompt, imageCount, options, mode);
            return;
        }

        let editImage = uploadedImageBase64 || (mode === 'edit' ? featured?.base64 : null);
        let parentImageId = (mode === 'refine' || mode === 'edit') ? featured?.id : null;
        let batchId = generateUUID();

        // --- Workflow 1: Upload Registration ---
        if (mode === 'edit' && uploadedImageBase64) {
            state.setLoading(true, 'Registering upload…');
            const thumb = await createThumbnail(uploadedImageBase64, 200);
            const refImg = await state.addImage({
                base64: uploadedImageBase64,
                thumbnail: thumb,
                isReference: true
            }, prompt, 'upload', batchId);
            parentImageId = refImg.id;
        }

        state.lastPrompt = prompt;
        state.clearError();
        state.setLoading(true, `${mode.charAt(0).toUpperCase() + mode.slice(1).replace(/e$/, '')}ing…`);

        // Interruption & Progress UI
        currentAbortController = new AbortController();
        actionButtonsStack?.classList.add('hidden');
        btnInterrupt?.classList.remove('hidden');

        // --- PRE-CALCULATE STRUCTURED PROMPT FOR BATCH ---
        let batchStructuredPrompt = null;
        if (mode === 'generate') {
            // Check if the prompt is itself a pre-formed SP JSON — if so, skip the API call
            const directSp = parseAsStructuredPrompt(prompt);
            if (directSp) {
                console.log('[TRACE] handleAction - prompt is a structured prompt JSON, skipping SP generation');
                showToast('Using structured prompt directly — skipping layout generation.', 3000);
                batchStructuredPrompt = directSp;
                console.log('[TRACE] handleAction - mode is generate, calling generateStructuredPrompt');
                state.setLoading(true, 'Generating layout…');
                
                // --- Phase 5: Build Automated VGL Composition from Shot Context ---
                let baseTemplate = null;
                let activeCharacterIds = [];
                let activeLocationId = null;

                if (state.activeEpisode && state.activeShotId) {
                    let foundShot = null;
                    let foundScene = null;
                    for (const sc of state.activeEpisode.scenes) {
                        const sh = sc?.shots?.find(s => s.id === state.activeShotId);
                        if (sh) {
                            foundShot = sh;
                            foundScene = sc;
                            break;
                        }
                    }
                    if (foundShot && foundScene) {
                        activeCharacterIds = foundShot.characterIds || [];
                        activeLocationId = foundScene.locationId || null;
                    }
                } else if (promptCharSelect || promptLocSelect) { // Fallback for standalone tests
                    activeCharacterIds = promptCharSelect ? Array.from(promptCharSelect.selectedOptions).map(o => o.value) : [];
                    activeLocationId = promptLocSelect ? promptLocSelect.value : null;
                }
                
                if (activeCharacterIds.length > 0 || activeLocationId) {
                    baseTemplate = composeVglTemplate({ 
                        characterIds: activeCharacterIds, 
                        locationId: activeLocationId 
                    });
                    console.log('[TRACE] handleAction - Injected base VGL template from Shot:', baseTemplate);
                }
                
                const spResult = await api.generateStructuredPrompt(prompt, uploadedImageBase64, baseTemplate, {
                    ...options,
                    signal: currentAbortController.signal
                });
                console.log('[TRACE] handleAction - generateStructuredPrompt returned', { sp: !!spResult.structured_prompt });
                batchStructuredPrompt = spResult.structured_prompt;
                if (!batchStructuredPrompt) throw new Error('Failed to generate structured prompt.');
            }
        } else if (mode === 'refine') {
            console.log('[TRACE] handleAction - mode is refine, usando existing SP');
            // Use featured image's SP (parse if it's a string from storage)
            const rawSp = featured.structured_prompt;
            try {
                batchStructuredPrompt = typeof rawSp === 'string' ? JSON.parse(rawSp) : rawSp;
            } catch (e) {
                console.warn('[TRACE] handleAction - Error parsing existing SP', e);
                batchStructuredPrompt = rawSp;
            }
        } else if (mode === 'edit') {
            console.log('[TRACE] handleAction - mode is edit, calling generateStructuredPrompt (instruction)');
            state.setLoading(true, 'Generating instruction layout…');
            const spResult = await api.generateStructuredPrompt(prompt, editImage, null, {
                ...options,
                signal: currentAbortController.signal
            });
            console.log('[TRACE] handleAction - generateStructuredPrompt (edit) returned', { sp: !!spResult.structured_prompt });
            batchStructuredPrompt = spResult.structured_prompt;
            if (!batchStructuredPrompt) throw new Error('Failed to generate structured instruction.');
        }

        // For edit: always generate a fresh random seed unless the user typed one.
        // For refine: fall back to featured seed so variants are close to the source.
        const baseSeed = seed !== null ? seed : (
            mode === 'edit' ? Math.floor(Math.random() * 2147483647)
                            : (mode === 'refine' && featured ? featured.seed : Math.floor(Math.random() * 2147483647))
        );
        console.log('[TRACE] handleAction - entering loop', { imageCount, baseSeed });
        const batchResults = [];
        for (let i = 0; i < imageCount; i++) {
            console.log(`[TRACE] handleAction - loop iteration ${i + 1}/${imageCount}`);
            if (currentAbortController?.signal.aborted) {
                console.warn('[TRACE] handleAction - loop aborted');
                break;
            }

            const currentSeed = baseSeed + i;
            const statusMsg = `${mode.charAt(0).toUpperCase() + mode.slice(1).replace(/e$/, '')}ing ${i + 1}/${imageCount}…`;
            state.setLoading(true, statusMsg);
            if (progressText) progressText.textContent = statusMsg;

            try {
                let result;
                switch (mode) {
                    case 'generate':
                    case 'refine':
                        result = await api.generate(prompt, currentSeed, null, {
                            ...options,
                            structured_prompt: batchStructuredPrompt,
                            signal: currentAbortController.signal
                        });
                        break;
                    case 'edit':
                        result = await api.edit(prompt, editImage, currentSeed, {
                            ...options,
                            structured_instruction: batchStructuredPrompt,
                            signal: currentAbortController.signal
                        });
                        break;
                }
                const thumbnail = await createThumbnail(result.base64, 200);

                // Phase 2.8: Staleness checks via Generation Record
                const generationRecord = {
                    shotId: state.activeShotId,
                    entityVersions: {}
                };
                if (state.activeEpisode && state.activeShotId) {
                    for (const s of state.activeEpisode.scenes) {
                        const shot = s.shots.find(sh => sh.id === state.activeShotId);
                        if (shot) {
                            generationRecord.entityVersions['shot'] = shot.entityVersion || 1;
                            if (s.locationId) {
                                const loc = state.workspace.locations?.find(l => l.id === s.locationId);
                                if (loc) generationRecord.entityVersions['location:'+loc.id] = loc.entityVersion || 1;
                            }
                            if (shot.characterIds) {
                                shot.characterIds.forEach(id => {
                                    const c = state.workspace.characters?.find(char => char.id === id);
                                    if (c) generationRecord.entityVersions['character:'+c.id] = c.entityVersion || 1;
                                });
                            }
                        }
                    }
                }

                // Incremental update — add to gallery and feature
                await state.addImage({ ...result, thumbnail, generationRecord }, prompt, mode, batchId, parentImageId);

                // After the first image arrives, lift the canvas overlay so the user
                // can view and interact with it while the remaining images generate.
                if (i === 0) state.setCanvasLoading(false);

                // Add a small 1s "breath" delay between images
                if (i < imageCount - 1) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            } catch (err) {
                console.error(`[handleAction] Item ${i + 1} failed:`, err);
            }
        }
    } catch (err) {
        if (err.name === 'AbortError' || err.message === 'Processing interrupted') {
            showToast('Generation interrupted');
        } else {
            console.error('[handleAction] ERROR:', err);
            const msg = err.message || 'An unexpected error occurred.';
            state.setError(msg);
            showToast('Error: ' + msg);
            if (promptInput) promptInput.value = state.lastPrompt;
        }
    } finally {
        console.log('[handleAction] FINALLY - cleaning up');
        state.setLoading(false);
        btnInterrupt?.classList.add('hidden');
        actionButtonsStack?.classList.remove('hidden');
        currentAbortController = null;
    }
}

// ============================================================
// STRUCTURED PROMPT PREVIEW
// ============================================================

/**
 * Preview the structured prompt before generating.
 * Shows a dialog where the user can review/edit, then choose to generate or go back.
 */
async function handleStructuredPromptPreview(prompt, imageCount, options, mode = 'generate') {
    state.lastPrompt = prompt;
    state.clearError();
    state.setLoading(true, 'Generating preview…');

    try {
        const featured = state.getFeaturedImage();
        let spResult;
        let batchId = generateUUID();
        let parentImageId = (mode === 'refine' || mode === 'edit' ? featured?.id : null);
        // For edit: fresh random seed; for refine: use featured seed; for generate: random.
        const baseSeed = options.seed !== undefined ? options.seed : (
            mode === 'edit' ? Math.floor(Math.random() * 2147483647)
                            : (mode === 'refine' && featured ? featured.seed : Math.floor(Math.random() * 2147483647))
        );

        if (mode === 'refine') {
            if (!featured) throw new Error('No image selected to refine.');
            spResult = {
                structured_prompt: featured.structured_prompt,
                seed: featured.seed
            };
        } else if (mode === 'edit') {
            const editImage = uploadedImageBase64 || featured?.base64;
            if (!editImage) throw new Error('Upload or select an image for edit.');

            if (uploadedImageBase64) {
                state.setLoading(true, 'Registering upload…');
                const thumb = await createThumbnail(uploadedImageBase64, 200);
                const refImg = await state.addImage({
                    base64: uploadedImageBase64,
                    thumbnail: thumb,
                    isReference: true
                }, prompt, 'upload', batchId);
                parentImageId = refImg.id;
            }

            console.log('[TRACE] handleStructuredPromptPreview - mode is edit, calling generateStructuredPrompt (instruction)');
            state.setLoading(true, 'Generating instruction layout…');
            spResult = await api.generateStructuredPrompt(prompt, editImage, null, options);
        }
        else {
            spResult = await api.generateStructuredPrompt(prompt, uploadedImageBase64, null, options);
        }

        state.setLoading(false);

        if (!spResult.structured_prompt) throw new Error('No structured prompt returned.');

        const originalSp = spResult.structured_prompt;

        // Format JSON
        let formatted;
        try {
            const parsed = typeof originalSp === 'string'
                ? JSON.parse(originalSp) : originalSp;
            formatted = JSON.stringify(parsed, null, 2);
        } catch {
            formatted = originalSp;
        }

        spPreviewEditor.value = formatted;
        spPreviewDialog.showModal();

        const action = await new Promise((resolve) => {
            const onGen = () => { cleanup(); resolve('generate'); };
            const onCancel = () => { cleanup(); resolve('cancel'); };
            function cleanup() {
                spPreviewGenerate.removeEventListener('click', onGen);
                spPreviewCancel.removeEventListener('click', onCancel);
                spPreviewDialog.close();
            }
            spPreviewGenerate?.addEventListener('click', onGen);
            spPreviewCancel?.addEventListener('click', onCancel);
        });

        if (action === 'generate') {
            let editedSp = spPreviewEditor.value.trim();
            const seedFromInput = seedInput.value.trim() ? parseInt(seedInput.value.trim(), 10) : null;

            // Edit: always use a fresh random seed unless user typed one.
            // Refine: fall back to featured seed.
            const startSeed = seedFromInput !== null ? seedFromInput : (
                mode === 'edit' ? Math.floor(Math.random() * 2147483647)
                                : (mode === 'refine' && featured ? featured.seed : (spResult.seed || Math.floor(Math.random() * 2147483647)))
            );

            const editImage = uploadedImageBase64 || (mode === 'edit' ? featured?.base64 : null);
            const parentId = parentImageId; // Use the one we prepared earlier (includes uploaded reference)

            // Optimization: If JSON was edited, call generate_from_diff
            let finalSp = editedSp;

            // Simple comparison of trimmed strings to see if edited
            if (editedSp !== formatted) {
                console.log('[SP] JSON edited, reconciling with original via diff...');
                state.setLoading(true, 'Optimizing structured prompt…');

                // For manual edits, if it's a gallery image, we reconcile against the source image's SP
                const baseSpForDiff = (mode === 'edit' && !uploadedImageBase64 && featured) ? featured.structured_prompt : originalSp;
                const diffResult = await api.generateStructuredPromptFromDiff(baseSpForDiff, editedSp, startSeed, options);
                finalSp = diffResult.structured_prompt || editedSp;
            }

            // Ensure finalSp is a parsed object if it's currently a string
            let parsedSp = finalSp;
            if (typeof finalSp === 'string') {
                try {
                    parsedSp = JSON.parse(finalSp);
                    console.log('[TRACE] handleStructuredPromptPreview - Parsed finalSp successfully');
                } catch (e) {
                    console.warn('[TRACE] [SP] Could not parse finalSp as JSON, sending as-is:', e);
                }
            }

            console.log('[TRACE] handleStructuredPromptPreview - entering loop', { imageCount, mode });
            state.setLoading(true, 'Generating batch from structured prompt…');
            currentAbortController = new AbortController();
            actionButtonsStack?.classList.add('hidden');
            btnInterrupt?.classList.remove('hidden');
            if (progressText) progressText.textContent = 'Generating batch…';

            for (let i = 0; i < imageCount; i++) {
                console.log(`[TRACE] handleStructuredPromptPreview - loop iteration ${i + 1}/${imageCount}`);
                if (currentAbortController?.signal.aborted) break;

                const statusMsg = `Generating image ${i + 1}/${imageCount}…`;
                state.setLoading(true, statusMsg);
                if (progressText) progressText.textContent = statusMsg;
                const currentSeed = startSeed + i;

                try {
                    let result;
                    if (mode === 'edit') {
                        result = await api.edit(prompt, editImage, currentSeed, {
                            ...options,
                            structured_instruction: parsedSp
                        });
                    } else {
                        result = await api.generate(prompt, currentSeed, null, {
                            ...options,
                            structured_prompt: parsedSp
                        });
                    }

                    const thumbnail = await createThumbnail(result.base64, 200);

                    // Incremental update
                    await state.addImage({ ...result, thumbnail }, prompt, mode, batchId, parentImageId);

                    // Lift canvas overlay after first image so the user can interact
                    if (i === 0) state.setCanvasLoading(false);

                    if (i < imageCount - 1) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                } catch (itemErr) {
                    console.error(`[SP Preview] Image ${i + 1} failed:`, itemErr);
                    showToast(`Image ${i + 1} failed: ${itemErr.message}`);
                    // Continue with the rest of the batch
                }
            }
        }
    } catch (err) {
        state.setError(err.message);
        showToast('Error: ' + err.message); // Explicitly show toast
    } finally {
        state.setLoading(false);
        btnInterrupt?.classList.add('hidden');
        actionButtonsStack?.classList.remove('hidden');
        currentAbortController = null;
    }
}

// Retry button
retryBtn?.addEventListener('click', () => {
    state.clearError();
    if (promptInput) promptInput.value = state.lastPrompt;
    // Default to generate if we can't determine the last mode
    handleAction('generate');
});

// ============================================================
// IMAGE INFO BAR (copy actions)
// ============================================================

// ============================================================
// IMAGE INFO BAR (copy/download actions)
// ============================================================

infoSeed?.addEventListener('click', () => {
    const img = state.getFeaturedImage();
    if (img) copyToClipboard(String(img.seed), 'Seed copied!');
});

infoPrompt?.addEventListener('click', () => {
    const img = state.getFeaturedImage();
    if (img) copyToClipboard(img.prompt || '', 'Prompt copied!');
});

// ============================================================
// GALLERY NAVIGATION (canvas footer arrows)
// ============================================================

function navScrollToImage(imageId) {
    const el = document.getElementById('reel-scroll')?.querySelector(`[data-image-id="${imageId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.getElementById('nav-prev')?.addEventListener('click', () => {
    const project = state.getActiveProject();
    if (!project?.images?.length) return;
    const ids = project.images.map(i => i.id);
    const cur = ids.indexOf(state.featuredImageId);
    const nextIdx = cur <= 0 ? ids.length - 1 : cur - 1;
    state.setFeaturedImage(ids[nextIdx]);
    navScrollToImage(ids[nextIdx]);
});

document.getElementById('nav-next')?.addEventListener('click', () => {
    const project = state.getActiveProject();
    if (!project?.images?.length) return;
    const ids = project.images.map(i => i.id);
    const cur = ids.indexOf(state.featuredImageId);
    const nextIdx = cur >= ids.length - 1 ? 0 : cur + 1;
    state.setFeaturedImage(ids[nextIdx]);
    navScrollToImage(ids[nextIdx]);
});

document.getElementById('nav-jump-parent')?.addEventListener('click', () => {
    const img = state.getFeaturedImage();
    if (!img?.parentImageId) { showToast('No parent image.'); return; }
    state.setFeaturedImage(img.parentImageId);
    navScrollToImage(img.parentImageId);
});

document.getElementById('nav-jump-child')?.addEventListener('click', () => {
    const project = state.getActiveProject();
    if (!project) return;
    const images = project.images;

    // All direct children of the current image
    const children = images.filter(i => i.parentImageId === state.featuredImageId);
    if (!children.length) { showToast('No child/variant images.'); return; }

    // Prefer a child that itself has children (keeps traversal going)
    const childWithKids = children.find(c => images.some(i => i.parentImageId === c.id));
    const target = childWithKids || children[0];

    state.setFeaturedImage(target.id);
    navScrollToImage(target.id);
});



// ============================================================
// STRUCTURED PROMPT PANEL
// ============================================================

if (spToggle && spContent && spToggleIcon) {
    spToggle?.addEventListener('click', () => {
        const isOpen = !spContent?.classList.contains('hidden');
        spContent?.classList.toggle('hidden');
        spToggleIcon?.classList.toggle('open', !isOpen);
    });
}

/**
 * Build a pruned copy of `data` that contains only the subtrees
 * that include at least one path from `diffPaths`.
 *
 * e.g. diffPaths = ["Aesthetics.color_scheme", "Objects.0.description"]
 * → returns { Aesthetics: { color_scheme: ... }, Objects: [ { description: ... } ] }
 */
function buildDiffOnlyTree(data, diffPaths) {
    if (!data || typeof data !== 'object') return data;

    // Group paths by their first segment
    const byRoot = {};
    for (const p of diffPaths) {
        const dot = p.indexOf('.');
        const head = dot === -1 ? p : p.slice(0, dot);
        const tail = dot === -1 ? null : p.slice(dot + 1);
        if (!byRoot[head]) byRoot[head] = [];
        if (tail) byRoot[head].push(tail);
    }

    if (Array.isArray(data)) {
        const result = [];
        for (const [rawKey, childPaths] of Object.entries(byRoot)) {
            const idx = parseInt(rawKey, 10);
            if (isNaN(idx) || idx >= data.length) continue;
            const child = data[idx];
            result[idx] = childPaths.length > 0
                ? buildDiffOnlyTree(child, childPaths)
                : child;
        }
        // Compact sparse array
        return result.filter((_, i) => i in result);
    } else {
        const result = {};
        for (const [key, childPaths] of Object.entries(byRoot)) {
            if (!(key in data)) continue;
            result[key] = childPaths.length > 0
                ? buildDiffOnlyTree(data[key], childPaths)
                : data[key];
        }
        return result;
    }
}

// ============================================================
// VGL INSPECTOR INITIALIZATION
// ============================================================
let vglInspectorInstance = null;

function initVglInspector() {
    // Only init once
    if (vglInspectorInstance) return;

    // Use the explicit ID configured in index.html
    vglInspectorInstance = new VglInspector('arc-vgl-mount', {
        onPushToPrompt: (parsedJson) => {
            if (promptInput) promptInput.value = JSON.stringify(parsedJson, null, 2);
            // Setup for bypass in Drama if preview isn't checked
        }
    });
    vglInspectorInstance.render();

    // Hook to global state
    function syncVgl() {
        const img = state.getFeaturedImage();
        if (!img || !img.structured_prompt) {
            vglInspectorInstance.updateData(null);
            return;
        }

        let parsedData = img.structured_prompt;
        if (typeof parsedData === 'string') {
            try { parsedData = JSON.parse(parsedData); } catch (e) { parsedData = null; }
        }

        let oldData = null;
        // If diff mode or refine mode
        if (state.compareActive && state.compareImageId) {
            const cmp = state.getImage(state.compareImageId);
            if (cmp && cmp.structured_prompt) {
                oldData = typeof cmp.structured_prompt === 'string' ? JSON.parse(cmp.structured_prompt) : cmp.structured_prompt;
            }
        } else if (img.mode === 'refine' && img.parentImageId) {
            const prt = state.getImage(img.parentImageId);
            if (prt && prt.structured_prompt) {
                oldData = typeof prt.structured_prompt === 'string' ? JSON.parse(prt.structured_prompt) : prt.structured_prompt;
            }
        }

        vglInspectorInstance.updateData(parsedData, oldData);
    }

    state.on('featuredChanged', syncVgl);
    state.on('compareChanged', syncVgl);

    // Initial sync
    syncVgl();
}

initVglInspector();

// ============================================================
// LOADING STATE UI
// ============================================================

state.on('loadingChanged', () => {
    const loadingOverlay = getEl('loading-overlay');
    const loadingText = loadingOverlay?.querySelector('.loading-text');
    if (loadingOverlay) {
        loadingOverlay?.classList.toggle('hidden', !state.isLoading);
        if (loadingText) loadingText.textContent = state.loadingText || 'Processing…';
    }
});
// ============================================================
// GLOBAL CONSOLE HOOK
// ============================================================
if (globalConsoleBtn) {
    globalConsoleBtn?.addEventListener('click', () => {
        apiConsole.toggle();
    });
}

// Set UI state after async setup completes:
setTimeout(() => {
    // 1. Initial UI update
    updateActionButtonsState();

    // 2. Prompt for API key if missing (removed since it uses undefined 'elements')
}, 100);
