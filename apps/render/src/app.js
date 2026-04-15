/* ============================================================
   app.js — Main application controller
   Wires together all modules and event handlers.
   [REFRESH_CHECK_TAG_001]
   ============================================================ */

import { 
    core, State as stateEngine, Canvas, Gallery, CardJsonEditor, apiConsole,
    api, Utils, Compare, Resizer, Actions, PromptBar, VglInspector
} from '@arc/core';
import JSZip from 'jszip';


const {
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
} = Utils;

const {
    generateImage,
    enhanceImage,
    removeBackground,
    eraseObject
} = Actions;

// Get state singleton
const state = stateEngine.default || stateEngine;
const { initCanvas } = Canvas;
const { initGallery } = Gallery;
const { initResizers } = Resizer;
const { initCompare } = Compare;
const { dataDB } = stateEngine;


// ---- Critical Error Monitoring ----
window?.addEventListener('error', (e) => {
    console.error('[GLOBAL ERROR]:', e.error || e.message);
    showToast('App Crash: ' + (e.message || 'Check console'), 5000);
});
window?.addEventListener('unhandledrejection', (e) => {
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

// ---- UI Element References (Populated after render) ----
let projectSelect;
let newProjectBtn;
let deleteProjectBtn;
let newProjectDialog;
let newProjectName;
let welcomeNewBtn;
let apiKeyInput;
let apiKeyToggle;
let promptInput;
let negativePromptInput;
let imageCountSelect;
let aspectRatioSelect;
let resolutionSelect;
let seedInput;
let liteModeToggle;
let liteQuickBtn;
let modContentToggle;
let modInputToggle;
let modOutputToggle;
let previewSpCheckbox;
let imageUpload;
let btnGenerate;
let btnRefine;
let btnEdit;
let btnInterrupt;
let progressText;
let promptBarCollapseBtn;
let promptBar;
let uploadBtnText;
let uploadPreviewWrap;
let uploadPreview;
let clearUploadBtn;
let uploadedImageBase64 = null;
let refIndicator;
let promptExpandBtn;
let promptExpandEditor;
let promptExpandDialog;
let promptExpandDone;
let promptExpandCancel;


let actionButtonsStack;
let retryBtn;
let infoSeed;
let infoPrompt;
let spToggle;
let spContent;
let spJson;
let spToggleIcon;
let spPreviewDialog;
let spPreviewEditor;
let spPreviewGenerate;
let spPreviewCancel;
let apiKeyWarningDialog;
let apiKeyWarningGo;
let apiKeyWarningClose;
let globalConsoleBtn;
let exportStarredBtn;
let clearStarredBtn;
let storageIndicatorBtn;
let storageBanner;
let storageBannerTitle;
let storageBannerDesc;
let storagePickBtn;
let storageSkipBtn;
let storageBannerClose;
let storageIndicatorName;


/** Handle generating new images (Text-to-Image). */
async function onGenerateClick() {
    if (!promptInput) return;
    const prompt = promptInput.value.trim();
    if (!prompt) { showToast('Please enter a prompt.'); return; }
    
    const count = parseInt(imageCountSelect?.value || '1', 10);
    const ratio = aspectRatioSelect?.value || '1:1';
    const seed = seedInput?.value ? parseInt(seedInput.value, 10) : null;
    
    try {
        await generateImage(prompt, seed, count, {
            aspect_ratio: ratio,
            negative_prompt: negativePromptInput?.value || '',
            lite: liteModeToggle?.checked || false,
            mod_content: modContentToggle?.checked || false,
            mod_input: modInputToggle?.checked || false,
            mod_output: modOutputToggle?.checked || false
        });
    } catch (err) {
        showToast('Generation failed: ' + err.message);
    }
}

/** Handle refining the currently selected image (Img-to-Img + VGL). */
async function onRefineClick() {
    const featured = state.getFeaturedImage();
    if (!featured) return;
    
    const prompt = promptInput?.value.trim() || featured.prompt;
    const count = parseInt(imageCountSelect?.value || '1', 10);
    const seed = seedInput?.value ? parseInt(seedInput.value, 10) : null;

    try {
        await generateImage(prompt, seed, count, {
            mode: 'refine',
            parentImageId: featured.id,
            structured_prompt: featured.structured_prompt,
            lite: liteModeToggle?.checked || false,
            mod_content: modContentToggle?.checked || false,
            mod_input: modInputToggle?.checked || false,
            mod_output: modOutputToggle?.checked || false
        });
    } catch (err) {
        showToast('Refinement failed: ' + err.message);
    }
}

/** Handle editing/modifying the selected image. */
async function onEditClick() {
    const featured = state.getFeaturedImage();
    const sourceImage = uploadedImageBase64 || featured?.base64;
    if (!sourceImage) { showToast('Select an image or upload one to edit.'); return; }
    
    const prompt = promptInput?.value.trim();
    if (!prompt) { showToast('Please enter an instruction (e.g., "Change the sky to sunset").'); return; }

    state.setLoading(true, 'Editing image…');
    try {
        const result = await api.edit(prompt, sourceImage, null, {
            mod_content: modContentToggle?.checked || false,
            mod_input: modInputToggle?.checked || false,
            mod_output: modOutputToggle?.checked || false
        });
        
        const thumbnail = await createThumbnail(result.base64, 200);
        await state.addImage(
            { ...result, thumbnail }, 
            prompt, 
            'edit', 
            generateUUID(), 
            featured?.id
        );
        showToast('✓ Image edited!');
    } catch (err) {
        showToast('Edit failed: ' + err.message);
    } finally {
        state.setLoading(false);
    }
}

function setupActionHandlers() {
    btnGenerate?.addEventListener('click', onGenerateClick);
    btnRefine?.addEventListener('click', onRefineClick);
    btnEdit?.addEventListener('click', onEditClick);
    
    // Auto-update buttons on project switch
    state.on('projectChanged', updateActionButtonsState);
}

function initUI() {
    projectSelect = getEl('project-select');
    newProjectBtn = getEl('new-project-btn');
    deleteProjectBtn = getEl('delete-project-btn');
    newProjectDialog = getEl('new-project-dialog');
    newProjectName = getEl('new-project-name');
    welcomeNewBtn = getEl('welcome-new-btn');
    apiKeyInput = getEl('api-key-input');
    apiKeyToggle = getEl('api-key-toggle');

    promptInput = getEl('prompt-input');
    negativePromptInput = getEl('negative-prompt-input');
    imageCountSelect = getEl('image-count-select');
    aspectRatioSelect = getEl('aspect-ratio-select');
    resolutionSelect = getEl('resolution-select');
    seedInput = getEl('seed-input');

    liteModeToggle = getEl('lite-mode-toggle');
    liteQuickBtn = document.getElementById('lite-quick-btn');
    modContentToggle = getEl('mod-content-toggle');
    modInputToggle = getEl('mod-input-toggle');
    modOutputToggle = getEl('mod-output-toggle');
    previewSpCheckbox = getEl('preview-sp-checkbox');
    imageUpload = getEl('image-upload');

    btnGenerate = getEl('btn-generate');
    btnRefine = getEl('btn-refine');
    btnEdit = getEl('btn-edit');
    btnInterrupt = getEl('btn-interrupt');
    progressText = btnInterrupt ? btnInterrupt.querySelector('.progress-text') : null;

    promptBarCollapseBtn = document.getElementById('prompt-bar-collapse-btn');
    promptBar = document.getElementById('prompt-bar');

    uploadBtnText = getEl('upload-btn-text');
    uploadPreviewWrap = getEl('upload-preview-wrap');
    uploadPreview = getEl('upload-preview');
    clearUploadBtn = getEl('clear-upload-btn');
    refIndicator = getEl('ref-indicator');

    promptExpandBtn = getEl('prompt-expand-btn');
    promptExpandEditor = getEl('prompt-expand-editor');
    promptExpandDialog = getEl('prompt-expand-dialog');
    promptExpandDone = getEl('prompt-expand-done');
    promptExpandCancel = getEl('prompt-expand-cancel');

    actionButtonsStack = getEl('action-buttons-stack');
    retryBtn = getEl('retry-btn');
    infoSeed = getEl('info-seed');
    infoPrompt = getEl('info-prompt');

    spToggle = getEl('sp-toggle');
    spContent = getEl('sp-content');
    spJson = getEl('sp-json');
    spToggleIcon = spToggle ? spToggle.querySelector('.vgl-toggle-icon') : null;

    spPreviewDialog = getEl('sp-preview-dialog');
    spPreviewEditor = getEl('sp-preview-editor');
    spPreviewGenerate = getEl('sp-preview-generate');
    spPreviewCancel = getEl('sp-preview-cancel');

    apiKeyWarningDialog = getEl('api-key-warning-dialog');
    apiKeyWarningGo = getEl('api-key-warning-go');
    apiKeyWarningClose = getEl('api-key-warning-close');
    globalConsoleBtn = getEl('global-console-btn');
    exportStarredBtn = getEl('export-starred-btn');
    clearStarredBtn = getEl('clear-starred-btn');
    storageIndicatorBtn = getEl('storage-indicator-btn');
    storageBanner = getEl('storage-banner');
    storageBannerTitle = getEl('storage-banner-title');
    storageBannerDesc = getEl('storage-banner-desc');
    storagePickBtn = getEl('storage-pick-btn');
    storageSkipBtn = getEl('storage-skip-btn');
    storageBannerClose = getEl('storage-banner-close');
    storageIndicatorName = getEl('storage-indicator-name');

    // Attach core UI listeners
    promptInput?.addEventListener('input', updateActionButtonsState);
    promptInput?.addEventListener('input', autoExpandPrompt);
    promptInput?.addEventListener('keydown', (e) => {
        if (e.shiftKey && e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            openPromptExpand();
        }
    });

    promptBarCollapseBtn?.addEventListener('click', togglePromptBar);
    promptExpandBtn?.addEventListener('click', openPromptExpand);
    promptExpandDone?.addEventListener('click', commitPromptExpand);
    promptExpandCancel?.addEventListener('click', () => promptExpandDialog.close());

    promptExpandEditor?.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            commitPromptExpand();
        }
    });
    
    // Switch listener logic for liteQuickBtn
    if (liteQuickBtn) {
        liteQuickBtn.addEventListener('click', () => {
            const isNowActive = liteQuickBtn.classList.toggle('active');
            if (liteModeToggle) liteModeToggle.checked = isNowActive;
        });
    }

    imageUpload?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        uploadedImageBase64 = await fileToBase64(file);
        if (uploadPreview) uploadPreview.src = uploadedImageBase64;
        uploadPreviewWrap?.classList.remove('hidden');
        if (uploadBtnText) uploadBtnText.textContent = '✓';
        updateActionButtonsState();
    });

    clearUploadBtn?.addEventListener('click', () => {
        uploadedImageBase64 = null;
        if (imageUpload) imageUpload.value = '';
        if (uploadPreview) uploadPreview.src = '';
        uploadPreviewWrap?.classList.add('hidden');
        if (uploadBtnText) uploadBtnText.textContent = '📎';
        updateActionButtonsState();
    });

    apiKeyWarningGo?.addEventListener('click', () => {
        apiKeyWarningDialog?.close();
        const advanced = document.querySelector('.prompt-advanced-details');
        if (advanced) advanced.open = true;
        apiKeyInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        apiKeyInput?.focus();
    });
    apiKeyWarningClose?.addEventListener('click', () => apiKeyWarningDialog?.close());

    // Project selection
    projectSelect?.addEventListener('change', () => {
        const id = projectSelect.value;
        if (id) state.switchProject(id);
    });

    // New Project
    newProjectBtn?.addEventListener('click', openNewProjectDialog);
    welcomeNewBtn?.addEventListener('click', openNewProjectDialog);
    newProjectDialog?.addEventListener('close', async () => {
        if (newProjectDialog.returnValue === 'create' && newProjectName.value.trim()) {
            await state.createProject(newProjectName.value.trim());
            populateProjectSelect();
        }
    });

    // Delete Project
    deleteProjectBtn?.addEventListener('click', async () => {
        const project = state.getActiveProject();
        if (!project) return;
        if (await confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
            await state.deleteProject(project.id);
            populateProjectSelect();
        }
    });

    // Export Starred
    if (exportStarredBtn) exportStarredBtn.onclick = async () => {
        if (exportStarredBtn.dataset.exporting) return;
        exportStarredBtn.dataset.exporting = '1';
        exportStarredBtn.disabled = true;
        try {
            const project = state.getActiveProject();
            const starredImages = project?.images.filter(img => img.isStarred) || [];
            if (!starredImages.length) {
                showToast('No starred images in this project to export.');
                return;
            }
            // ... (rest of export logic remains in its function or here)
            // Wait, I will just call a helper or keep it inline if it's small.
            // Actually I'll keep the logic as is.
            await handleExportStarred(); 
        } finally {
            exportStarredBtn.dataset.exporting = '';
            exportStarredBtn.disabled = false;
        }
    };

    // Clear Starred
    clearStarredBtn?.addEventListener('click', async () => {
        const project = state.getActiveProject();
        const starred = project?.images.filter(img => img.isStarred) || [];
        if (!starred.length) {
            showToast('No starred images to clear.');
            return;
        }
        if (!(await confirm(`Unstar all ${starred.length} starred image${starred.length > 1 ? 's' : ''}?`))) return;
        starred.forEach(img => state.toggleStar(img.id));
        showToast(`Unstarred ${starred.length} image${starred.length > 1 ? 's' : ''}.`);
    });

    // API Key
    apiKeyInput?.addEventListener('input', () => {
        state.setApiKey(apiKeyInput.value);
        updateActionButtonsState();
    });
    apiKeyToggle?.addEventListener('click', () => {
        const isPassword = apiKeyInput.type === 'password';
        if (apiKeyInput) apiKeyInput.type = isPassword ? 'text' : 'password';
        apiKeyToggle.textContent = isPassword ? '🙈' : '👁';
    });

    apiKeyToggle?.addEventListener('click', () => {
        const isPassword = apiKeyInput.type === 'password';
        if (apiKeyInput) apiKeyInput.type = isPassword ? 'text' : 'password';
        apiKeyToggle.textContent = isPassword ? '🙈' : '👁';
    });

    retryBtn?.addEventListener('click', () => {
        state.clearError();
        if (promptInput) promptInput.value = state.lastPrompt;
        handleAction('generate');
    });

    infoSeed?.addEventListener('click', () => {
        const img = state.getFeaturedImage();
        if (img) copyToClipboard(String(img.seed), 'Seed copied!');
    });

    infoPrompt?.addEventListener('click', () => {
        const img = state.getFeaturedImage();
        if (img) copyToClipboard(img.prompt || '', 'Prompt copied!');
    });

    // Sidebar Toggle
    document.getElementById('json-sidebar-header-toggle')?.addEventListener('click', () => {
        const vglMount = document.getElementById('arc-vgl-mount');
        if (!vglMount) return;
        const isCollapsed = vglMount?.classList.toggle('collapsed');
        const resizer = document.getElementById('resizer-json');
        if (resizer) resizer.classList.toggle('hidden', isCollapsed);
        updateHeaderToggleState();
    });

    // Storage Banner
    storagePickBtn?.addEventListener('click', async () => {
        storagePickBtn.disabled = true;
        storagePickBtn.textContent = 'Opening…';
        const ok = await state.setupStorage();
        storagePickBtn.disabled = false;
        storagePickBtn.textContent = 'Choose Folder';
        if (!ok) showToast('No folder selected — try again.');
    });
    storageSkipBtn?.addEventListener('click', async () => {
        await state.skipToLocalStorage();
        localStorage.setItem('vgl-studio-banner-dismissed', '1');
        updateStorageUI();
    });
    storageBannerClose?.addEventListener('click', () => {
        localStorage.setItem('vgl-studio-banner-dismissed', '1');
        storageBanner?.classList.add('hidden');
    });


    // Structured Prompt Panel
    if (spToggle && spContent && spToggleIcon) {
        spToggle.addEventListener('click', () => {
            const isOpen = !spContent.classList.contains('hidden');
            spContent.classList.toggle('hidden');
            spToggleIcon.classList.toggle('open', !isOpen);
        });
    }

    initVglInspector();

    state.on('loadingChanged', () => {
        const loadingOverlay = getEl('loading-overlay');
        const loadingText = loadingOverlay?.querySelector('.loading-text');
        if (loadingOverlay) {
            loadingOverlay?.classList.toggle('hidden', !state.isLoading);
            if (loadingText) loadingText.textContent = state.loadingText || 'Processing…';
        }
    });

    globalConsoleBtn?.addEventListener('click', () => {
        apiConsole.toggle();
    });

    setupActionHandlers();
    autoExpandPrompt();
}

function togglePromptBar() {
    if (promptBar) {
        promptBar.classList.toggle('collapsed');
    }
}



let currentAbortController = null;

// ============================================================
// INITIALIZATION
// ============================================================

(async function startup() {
    console.log('[APP] Starting initialization...');
    await state.init();
    console.log('[APP] State initialized');

    core.init();
    core.ui.addContextButton('Upscale', () => showToast('Upscale Plugin Executed!'));

    initCanvas('arc-main-mount');
    
    // Now that mount points exist, render the Prompt Bar
    new PromptBar('arc-prompt-mount').render();
    
    initUI(); // Select elements and attach basic listeners

    initGallery('arc-gallery-mount');
    initCompare();
    initResizers([
        { resizerId: 'resizer-gallery', prevId: 'arc-main-mount', nextId: 'arc-gallery-mount', mode: 'horizontal' },
        { resizerId: 'resizer-json', prevId: 'arc-gallery-mount', nextId: 'arc-vgl-mount', mode: 'horizontal' }
    ]);
    initCanvasNav();
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

/**
 * Reflect the current storageType in the UI:
 *   'pending'  → show setup banner
 *   'fs'       → hide banner, show folder indicator in header
 *   'ls'       → hide banner, hide indicator
 */
function updateStorageUI() {
    if (!storageBanner) return;

    const type = state.storageType;
    const fsSupported = dataDB.isSupported();
    const bannerDismissed = localStorage.getItem('vgl-studio-banner-dismissed') === '1';

    if (type === 'pending') {
        // FSA supported, no folder chosen yet — full setup prompt
        if (storageBannerTitle) storageBannerTitle.textContent = 'Set up persistent storage';
        if (storageBannerDesc) storageBannerDesc.textContent = 'Choose a local folder to save your projects & images across sessions.';
        if (storagePickBtn) { storagePickBtn.textContent = 'Choose Folder'; storagePickBtn?.classList.remove('hidden'); }
        storageSkipBtn?.classList.remove('hidden');
        storageBanner?.classList.remove('hidden');
        storageIndicatorBtn?.classList.add('hidden');

    } else if (type === 'fs') {
        storageBanner?.classList.add('hidden');
        if (storageIndicatorBtn && storageIndicatorName) {
            storageIndicatorName.textContent = dataDB.rootDir?.name || 'Local Folder';
            storageIndicatorBtn?.classList.remove('hidden');
        }

    } else {
        // localStorage mode
        if (!bannerDismissed) {
            // First visit — inform the user about storage
            if (!fsSupported) {
                // Browser doesn't support FSA (Firefox, Safari, etc.)
                if (storageBannerTitle) storageBannerTitle.textContent = 'Using browser storage';
                if (storageBannerDesc) storageBannerDesc.textContent = 'Projects are saved in this browser. For folder-based storage, use Chrome or Edge.';
                storagePickBtn?.classList.add('hidden');
                storageSkipBtn?.classList.add('hidden');
            } else {
                // FSA supported but user chose browser storage
                if (storageBannerTitle) storageBannerTitle.textContent = 'Using browser storage';
                if (storageBannerDesc) storageBannerDesc.textContent = 'Projects are saved in this browser only. You can switch to a local folder anytime.';
                if (storagePickBtn) { storagePickBtn.textContent = 'Choose Folder instead'; storagePickBtn?.classList.remove('hidden'); }
                storageSkipBtn?.classList.add('hidden');
            }
            storageBanner?.classList.remove('hidden');
        } else {
            storageBanner?.classList.add('hidden');
        }
        
        if (storageIndicatorBtn && storageIndicatorName) {
            storageIndicatorName.textContent = 'Browser Storage';
            storageIndicatorBtn?.classList.remove('hidden');
        }
    }
}


// After the FS folder is chosen
state.on('storageReady', () => {
    updateStorageUI();
    populateProjectSelect();
    updateActionButtonsState();
});

// ============================================================
// PROJECT MANAGEMENT
// ============================================================

function populateProjectSelect() {
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

function openNewProjectDialog() {
    if (!newProjectDialog) return;
    if (newProjectName) newProjectName.value = '';
    if (newProjectDialog.showModal) {
        newProjectDialog.showModal();
    } else {
        newProjectDialog.setAttribute('open', '');
    }
}

async function handleExportStarred() {
    const project = state.getActiveProject();
    const starredImages = project?.images.filter(img => img.isStarred) || [];

    /** Return full base64 for an image — loads from disk in FS mode. */
    async function resolveBase64(img) {
        if (img.base64) return img.base64;
        if (state.storageType === 'fs') {
            const b64 = await dataDB.getImageBase64(img.id);
            if (b64) return b64;
        }
        return null;
    }

    const zip = new JSZip();
    const loaders = starredImages.map(async (img) => {
        const base = generateFilename(img, project.name, project);
        const txtBase = generateTxtFilename(img, project.name, project);
        const b64 = await resolveBase64(img);
        const txtContent = generateTxtReport(img, project);

        if (b64) {
            const raw = b64.replace(/^data:image\/\w+;base64,/, '');
            zip.file(base + '.png', raw, { base64: true });
        }
        if (txtContent) {
            zip.file(txtBase + '.txt', txtContent);
        }
        if (img.structured_prompt) {
            const spObj = typeof img.structured_prompt === 'string' ? JSON.parse(img.structured_prompt) : img.structured_prompt;
            zip.file(base + '.json', JSON.stringify(spObj, null, 2));
        }
    });

    await Promise.all(loaders);

    const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const zipFilename = `${projectSlug}_starred_${ts}.zip`;

    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipFilename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast(`Exported ${starredImages.length} images!`);
}

state.on('projectChanged', () => {
    populateProjectSelect();
    updateActionButtonsState();
    // updateJsonInspector() handled by event listener on State
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
    const vglMount = document.getElementById('arc-vgl-mount');
    if (!vglMount) return;
    const isCollapsed = vglMount?.classList.contains('collapsed');
    document.getElementById('json-sidebar-header-toggle')?.classList.toggle('active', !isCollapsed);
}

// ============================================================
// API KEY
// ============================================================

function loadApiKey() {
    const key = state.getApiKey();
    if (key) {
        if (apiKeyInput) apiKeyInput.value = key;
    }
}




// ============================================================
// PROMPT AUTO-EXPAND + EXPAND MODAL
// ============================================================



/** Resize promptInput to fit its content, capped at max-height from CSS. */
function autoExpandPrompt() {
    if (!promptInput) return;
    promptInput.style.height = 'auto';
    promptInput.style.height = promptInput.scrollHeight + 'px';
}

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

// Shift+Enter handled in initUI


// Ctrl+Enter inside the modal commits


// Collapse handled in initUI


document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        togglePromptBar();
    }
});

// Input listener handled in initUI



function updateActionButtonsState() {
    if (!promptInput) return;
    const hasProject = !!state.getActiveProject();
    const hasApiKey = !!state.getApiKey();
    const hasPrompt = promptInput.value.trim().length > 0;
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
    
    // Logic for Refine button: Only visible if featured image has a VGL (structured_prompt)
    if (btnRefine) {
        const hasVGL = hasFeatured && !!state.getFeaturedImage()?.structured_prompt;
        btnRefine.style.display = hasVGL ? 'inline-flex' : 'none';
        btnRefine.disabled = !hasVGL;
    }

    // Logic for Edit button: Visible if any image is selected or an image was uploaded
    if (btnEdit) {
        const canEdit = hasFeatured || uploadedImageBase64;
        btnEdit.style.display = canEdit ? 'inline-flex' : 'none';
        btnEdit.disabled = !canEdit;
    }

    // Visual cues only
    btnGenerate?.classList.toggle('dimmed', !hasPrompt || !hasApiKey);
    if (btnRefine) btnRefine.classList.toggle('dimmed', !hasPrompt || !hasApiKey);
    if (btnEdit) btnEdit.classList.toggle('dimmed', !hasPrompt || !hasApiKey);

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
    // Handled by event listener
    // Do NOT auto-populate the seed field — leave it showing the 'Rand' placeholder
    // unless the user has manually typed a value.
});

// Upload listeners handled in initUI


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
        if (mode === 'generate' && state.pushedLineageId && previewSpCheckbox.checked) {
            parentImageId = state.pushedLineageId;
        }
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
            } else {
                console.log('[TRACE] handleAction - mode is generate, calling generateStructuredPrompt');
                state.setLoading(true, 'Generating layout…');
                const spResult = await api.generateStructuredPrompt(prompt, uploadedImageBase64, null, {
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
                if (batchStructuredPrompt && typeof batchStructuredPrompt === 'object') {
                    const scrubKeys = ['edit', 'edit_instruction', 'edit instruction', 'edit_instructions', 'instruction'];
                    scrubKeys.forEach(k => {
                        if (k in batchStructuredPrompt) delete batchStructuredPrompt[k];
                    });
                }
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

                // Incremental update — add to gallery and feature
                await state.addImage({ ...result, thumbnail }, prompt, mode, batchId, parentImageId);

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
        if (mode === 'generate' && state.pushedLineageId) {
            parentImageId = state.pushedLineageId;
        }
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


// ============================================================
// IMAGE INFO BAR (copy actions)
// ============================================================

// ============================================================
// IMAGE INFO BAR (copy/download actions)
// ============================================================



// ============================================================
// GALLERY NAVIGATION (canvas footer arrows)
// ============================================================

function navScrollToImage(imageId) {
    const el = document.getElementById('reel-scroll')?.querySelector(`[data-image-id="${imageId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function initCanvasNav() {
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

    document.getElementById('nav-jump-top-parent')?.addEventListener('click', () => {
        const project = state.getActiveProject();
        if (!project) return;
        let current = state.getFeaturedImage();
        let topParentId = current?.id;
        while (current?.parentImageId) {
            current = project.images.find(i => i.id === current.parentImageId);
            if (current) topParentId = current.id;
            else break;
        }
        if (topParentId && topParentId !== state.featuredImageId) {
            state.setFeaturedImage(topParentId);
            navScrollToImage(topParentId);
        } else {
            showToast('Already at top parent.');
        }
    });

    document.getElementById('nav-jump-parent')?.addEventListener('click', () => {
        const img = state.getFeaturedImage();
        if (!img?.parentImageId) { showToast('No parent image.'); return; }
        state.setFeaturedImage(img.parentImageId);
        navScrollToImage(img.parentImageId);
    });

    document.getElementById('nav-jump-first-child')?.addEventListener('click', () => {
        const project = state.getActiveProject();
        if (!project) return;
        const images = project.images;

        // All direct children of the current image
        const children = images.filter(i => i.parentImageId === state.featuredImageId);
        if (!children.length) { showToast('No child/variant images.'); return; }

        // Because images are prepended, the oldest child is at the end of the filtered array
        const target = children[children.length - 1];

        state.setFeaturedImage(target.id);
        navScrollToImage(target.id);
    });

    document.getElementById('nav-jump-last-child')?.addEventListener('click', () => {
        const project = state.getActiveProject();
        if (!project) return;
        const images = project.images;

        // All direct children of the current image
        const children = images.filter(i => i.parentImageId === state.featuredImageId);
        if (!children.length) { showToast('No child/variant images.'); return; }

        // Because images are prepended, the newest child is at the beginning of the filtered array
        const target = children[0];

        state.setFeaturedImage(target.id);
        navScrollToImage(target.id);
    });
}


// ============================================================
// STRUCTURED PROMPT PANEL
// ============================================================



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
            if (previewSpCheckbox) previewSpCheckbox.checked = true; // Setup for bypass
            if (state.featuredImageId) state.pushedLineageId = state.featuredImageId;
        }
    });
    vglInspectorInstance.render();

    // Hook to global state
    function syncVgl() {
        state.pushedLineageId = null; // Clear lineage hook on manual navigation
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

    syncVgl();
}



