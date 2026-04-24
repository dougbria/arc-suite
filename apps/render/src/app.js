/* ============================================================
   app.js - Main application controller
   Wires together all modules and event handlers.
   [REFRESH_CHECK_TAG_001]
   ============================================================ */

import { 
    core, State as stateEngine, Canvas, Gallery, apiConsole,
    api, Utils, Compare, Resizer, PromptBar, VglInspector
} from '@arc/core';
import JSZip from 'jszip';
import { GenerationManager } from './GenerationManager.js';


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

// ---- DOM Elements ----
const getEl = (id) => {
    const el = document.getElementById(id);
    if (!el) console.warn(`[DOM] Element not found: #${id}`);
    return el;
};

// ---- UI Element References (Populated after render) ----
let newProjectDialog;
let newProjectName;
let welcomeNewBtn;
let apiKeyInput;
let apiKeyToggle;
let promptInput;
let negativePromptInput;
let imageCountBtn;
let aspectRatioBtn;
let resolutionSelect;
let seedInput;
let seedPopoverBtn;
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
let btnExpand;
let btnInterrupt;
let progressText;
let promptBarCollapseBtn;
let promptBar;
let uploadBtnText;
let uploadPreviewWrap;
let uploadPreview;
let clearUploadBtn;
let generationManager = null;
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
let settingsBtn;
let settingsDialog;
let settingsBriaKey;
let settingsCloseBtn;
let settingsStorageStatus;
let settingsPickFolderBtn;
let settingsUseBrowserBtn;
let jsonSidebarToggle;

let vglInspector;


// Generation handlers are centralized in handleAction() at the bottom of the file

function initUI() {
    newProjectDialog = getEl('new-project-dialog');
    newProjectName = getEl('new-project-name');
    welcomeNewBtn = getEl('welcome-new-btn');
    welcomeNewBtn = getEl('welcome-new-btn');

    promptInput = getEl('prompt-input');
    negativePromptInput = getEl('negative-prompt-input');
    imageCountBtn = getEl('image-count-btn');
    aspectRatioBtn = getEl('aspect-ratio-btn');
    resolutionSelect = getEl('resolution-select');
    seedInput = getEl('seed-input');
    seedPopoverBtn = getEl('seed-popover-btn');

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
    btnExpand = getEl('btn-expand');
    btnInterrupt = getEl('btn-interrupt');
    progressText = btnInterrupt ? btnInterrupt.querySelector('.progress-text') : null;

    promptBarCollapseBtn = document.getElementById('prompt-bar-collapse-btn');
    promptBar = document.getElementById('prompt-bar');

    uploadBtnText = getEl('upload-btn-text');
    uploadPreviewWrap = getEl('upload-preview-wrap');
    uploadPreview = getEl('upload-preview');
    clearUploadBtn = getEl('clear-upload-btn');
    refIndicator = getEl('ref-indicator');
    settingsDialog = getEl('settings-dialog');
    settingsBriaKey = getEl('settings-bria-key');
    settingsCloseBtn = getEl('settings-close-btn');
    settingsStorageStatus = getEl('settings-storage-status');
    settingsPickFolderBtn = getEl('settings-pick-folder-btn');
    settingsUseBrowserBtn = getEl('settings-use-browser-btn');

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

    // VGL Inspector and Sidebar logic is handled in startup via initVglInspector()

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
        if (settingsDialog) {
            if (settingsBriaKey) settingsBriaKey.value = state.getApiKey() || '';
            settingsDialog.showModal();
        }
    });
    apiKeyWarningClose?.addEventListener('click', () => apiKeyWarningDialog?.close());

    // Settings logic
    settingsBtn?.addEventListener('click', () => {
        if (settingsBriaKey) settingsBriaKey.value = state.getApiKey() || '';
        settingsDialog?.showModal();
    });
    const toolbar = document.getElementById('app-toolbar');
    toolbar?.addEventListener('action', async (e) => {
        const { type, id, mode } = e.detail;
        switch (type) {
            case 'new-project':
                openNewProjectDialog();
                break;
            case 'delete-project':
                const project = state.getActiveProject();
                if (!project) return;
                if (await confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
                    await state.deleteProject(project.id);
                }
                break;
            case 'open-settings':
                if (settingsDialog) {
                    if (settingsBriaKey) settingsBriaKey.value = state.getApiKey() || '';
                    if (settingsDialog.showModal) settingsDialog.showModal();
                    else settingsDialog.setAttribute('open', '');
                }
                break;
            case 'change-storage':
                await state.setupStorage();
                break;
            case 'toggle-vgl-sidebar':
                toggleJsonSidebar();
                break;
            case 'switch-mode':
                console.log('Mode switch requested:', mode);
                break;
        }
    });

    settingsCloseBtn?.addEventListener('click', () => settingsDialog?.close());

    settingsBriaKey?.addEventListener('input', (e) => {
        state.setApiKey(e.target.value.trim());
    });

    storageIndicatorBtn?.addEventListener('click', async () => {
        try {
            await state.setupStorage();
            updateStorageUI();
        } catch (err) {
            showToast('Failed to pick folder: ' + err.message);
        }
    });

    // (Storage buttons managed within Settings modal)

    // New Project Dialog
    welcomeNewBtn?.addEventListener('click', openNewProjectDialog);
    newProjectDialog?.addEventListener('close', async () => {
        if (newProjectDialog.returnValue === 'create' && newProjectName.value.trim()) {
            await state.createProject(newProjectName.value.trim());
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

    // Centralized API Key management is now in Settings Logic (lines 332-343)

    retryBtn?.addEventListener('click', () => {
        state.clearError();
        if (promptInput) promptInput.value = state.lastPrompt;
        generationManager.handleAction(state.lastMode || 'generate', uploadedImageBase64);
    });

    const errorCancelBtn = document.getElementById('error-cancel-btn');
    errorCancelBtn?.addEventListener('click', () => {
        state.clearError();
    });

    infoSeed?.addEventListener('click', () => {
        const img = state.getFeaturedImage();
        if (img) copyToClipboard(String(img.seed), 'Seed copied!');
    });

    infoPrompt?.addEventListener('click', () => {
        if (document.body.classList.contains('prompt-bar-hidden')) {
            togglePromptBar();
        } else {
            const img = state.getFeaturedImage();
            if (img) copyToClipboard(img.prompt || '', 'Prompt copied!');
        }
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
        if (!ok) showToast('No folder selected - try again.');
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

    // Loading overlay is handled by canvas.js updateLoadingState via core state events

    globalConsoleBtn?.addEventListener('click', () => {
        apiConsole.toggle();
    });

    setupActionHandlers();
    autoExpandPrompt();
}

function togglePromptBar() {
    if (promptBar) {
        const isCollapsed = promptBar.classList.toggle('collapsed');
        document.body.classList.toggle('prompt-bar-hidden', isCollapsed);
        if (isCollapsed) {
            // Also close advanced settings if they were open
            const advanced = promptBar.querySelector('.prompt-advanced-details');
            if (advanced) advanced.open = false;
        }
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


// After the FS folder is chosen
state.on('storageReady', () => {
    updateStorageUI();
    updateActionButtonsState();
});

// ============================================================
// PROJECT MANAGEMENT
// ============================================================

// populateProjectSelect removed since ArcToolbar manages its own dropdown

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

    /** Return full base64 for an image - loads from disk in FS mode. */
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
    // ArcToolbar automatically listens to projectChanged events.
    updateActionButtonsState();
    // updateJsonInspector() handled by event listener on State
    updateHeaderToggleState();
    updateStarredCount();
    
    // Unmask/Mask UI dynamically relative to new target
    state.emit('loadingChanged');
    state.emit('canvasLoadingChanged');
    state.emit('backgroundJobsChanged');
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

function updateStorageUI() {
    const isLocal = state.storageType === 'fs';
    const folderName = dataDB.rootDir?.name || 'Local Folder';

    if (storageIndicatorBtn) {
        storageIndicatorBtn.classList.toggle('hidden', !isLocal);
        if (storageIndicatorName) storageIndicatorName.textContent = folderName;
    }

    if (storageBanner) {
        storageBanner.classList.toggle('hidden', state.storageType !== 'pending');
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
    const isMaskMode = state.canvasMode === 'mask';
    const isExpandMode = state.canvasMode === 'expand';

    if (btnGenerate) {
        btnGenerate.disabled = false;
        btnGenerate.style.display = (isMaskMode || isExpandMode) ? 'none' : 'inline-flex';
    }
    
    // Logic for Refine button: Only visible if featured image has a VGL (structured_prompt)
    if (btnRefine) {
        const hasVGL = hasFeatured && !!state.getFeaturedImage()?.structured_prompt;
        btnRefine.style.display = (hasVGL && !isMaskMode && !isExpandMode) ? 'inline-flex' : 'none';
        btnRefine.disabled = !hasVGL;
    }

    // Logic for Edit button: Visible if any image is selected or an image was uploaded
    if (btnEdit) {
        const canEdit = hasFeatured || uploadedImageBase64;
        btnEdit.style.display = (canEdit && !isExpandMode) ? 'inline-flex' : 'none';
        btnEdit.disabled = !canEdit;
    }

    if (btnExpand) {
        const canExpand = hasFeatured && isExpandMode;
        btnExpand.style.display = canExpand ? 'inline-flex' : 'none';
        btnExpand.disabled = !canExpand;
    }

    const isLayoutMode = state.canvasMode === 'layout';

    const btnLayout = document.getElementById('btn-layout');
    if (btnLayout) {
        const canLayout = hasFeatured && state.selectedImageIds && state.selectedImageIds.size === 1 && !isExpandMode && !isLayoutMode;
        btnLayout.style.display = canLayout ? 'inline-flex' : 'none';
        btnLayout.disabled = !canLayout;
    }

    const btnSynthesize = document.getElementById('btn-synthesize');
    if (btnSynthesize) {
        // Show Synthesize button if we are in layout mode OR multiple images are selected
        const hasMultipleSelected = state.selectedImageIds && state.selectedImageIds.size > 1;
        const showSynthesize = isLayoutMode || hasMultipleSelected;
        
        btnSynthesize.classList.toggle('hidden', !showSynthesize);
        btnSynthesize.disabled = !showSynthesize;
        
        if (showSynthesize) {
            if (btnGenerate) btnGenerate.style.display = 'none';
            if (btnRefine) btnRefine.style.display = 'none';
            if (btnEdit) btnEdit.style.display = 'none';
            if (btnExpand) btnExpand.style.display = 'none';
            if (btnLayout) btnLayout.style.display = 'none';
        }
    }

    // Visual cues only
    btnGenerate?.classList.toggle('dimmed', !hasPrompt || !hasApiKey);
    if (btnRefine) btnRefine.classList.toggle('dimmed', !hasPrompt || !hasApiKey);
    if (btnEdit) btnEdit.classList.toggle('dimmed', !hasPrompt || !hasApiKey);
    if (btnExpand) btnExpand.classList.toggle('dimmed', !hasApiKey);

    // Update Reference Indicator visibility
    const isUploading = !!uploadedImageBase64;
    const isFeaturedRef = hasFeatured && state.getFeaturedImage()?.isReference;
    
    if (refIndicator) {
        refIndicator.classList.toggle('hidden', !isUploading && !isFeaturedRef);
        if (isUploading) {
            refIndicator.textContent = 'Using Uploaded Reference';
            refIndicator.style.background = 'var(--accent-primary)';
        } else if (isFeaturedRef) {
            refIndicator.textContent = 'Reference Image';
            refIndicator.style.background = '';
        }
    }
}

state.on('featuredChanged', () => {
    updateActionButtonsState();
    // Handled by event listener
    // Do NOT auto-populate the seed field - leave it showing the 'Rand' placeholder
    // unless the user has manually typed a value.
});

state.on('canvasModeChanged', () => {
    updateActionButtonsState();
    if (state.canvasMode === 'expand') {
        const promptInput = document.getElementById('prompt-input');
        if (promptInput) promptInput.value = '';
    }
});

// Upload listeners handled in initUI


function setupActionHandlers() {
    generationManager = new GenerationManager(state, {
        promptInput, imageCountBtn, resolutionSelect, aspectRatioBtn,
        negativePromptInput, previewSpCheckbox, modContentToggle, modInputToggle,
        modOutputToggle, ipSignalToggle: document.getElementById('ip-signal-toggle'),
        liteQuickBtn, liteModeToggle, actionButtonsStack, btnInterrupt,
        settingsDialog, spPreviewEditor, spPreviewDialog, spPreviewGenerate, spPreviewCancel,
        seedInput
    });

    state.on('loadingChanged', () => {
        if (state.isLoading) {
            actionButtonsStack?.classList.add('hidden');
            btnInterrupt?.classList.remove('hidden');
        } else {
            btnInterrupt?.classList.add('hidden');
            actionButtonsStack?.classList.remove('hidden');
        }
    });

    state.on('selectionChanged', () => {
        updateActionButtonsState();
    });

    btnGenerate?.addEventListener('click', () => generationManager.handleAction('generate', uploadedImageBase64));
    btnRefine?.addEventListener('click', () => generationManager.handleAction('refine', uploadedImageBase64));
    btnEdit?.addEventListener('click', () => generationManager.handleAction('edit', uploadedImageBase64));
    btnExpand?.addEventListener('click', () => generationManager.handleAction('expand', uploadedImageBase64));
    
    const btnLayout = document.getElementById('btn-layout');
    btnLayout?.addEventListener('click', () => {
        state.setCanvasMode('layout');
    });
    
    const btnSynthesize = document.getElementById('btn-synthesize');
    btnSynthesize?.addEventListener('click', () => generationManager.handleAction('blend', uploadedImageBase64));

    btnInterrupt?.addEventListener('click', () => {
        generationManager.interrupt();
    });

    state.on('interruptRequested', () => {
        generationManager?.interrupt();
    });

    if (promptInput) {
        promptInput.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                if (btnExpand && !btnExpand.disabled && btnExpand.style.display !== 'none') generationManager.handleAction('expand', uploadedImageBase64);
                else if (btnEdit && !btnEdit.disabled && state.canvasMode === 'mask') generationManager.handleAction('edit', uploadedImageBase64);
                else if (btnGenerate && !btnGenerate.disabled && btnGenerate.style.display !== 'none') generationManager.handleAction('generate', uploadedImageBase64);
                else if (btnRefine && !btnRefine.disabled && btnRefine.style.display !== 'none') generationManager.handleAction('refine', uploadedImageBase64);
                else if (btnEdit && !btnEdit.disabled && btnEdit.style.display !== 'none') generationManager.handleAction('edit', uploadedImageBase64);
            }
        });
    }

    // Custom Dropdown UI Logic
    document.addEventListener('click', (e) => {
        // Close all dropdowns
        document.querySelectorAll('.custom-dropdown-menu').forEach(menu => {
            if (!menu.classList.contains('hidden') && !menu.parentElement.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });

        // Toggle dropdown
        const btn = e.target.closest('.custom-dropdown-btn');
        if (btn) {
            const menu = btn.parentElement.querySelector('.custom-dropdown-menu');
            if (menu) {
                // If it's the seed popover, don't close others maybe? Just toggle this
                const isHidden = menu.classList.contains('hidden');
                document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.add('hidden'));
                if (isHidden) menu.classList.remove('hidden');
            }
            return;
        }

        // Select option
        const opt = e.target.closest('.dropdown-option');
        if (opt) {
            const menu = opt.closest('.custom-dropdown-menu');
            const wrap = opt.closest('.custom-dropdown-wrap');
            const mainBtn = wrap.querySelector('.custom-dropdown-btn');
            
            menu.querySelectorAll('.dropdown-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            
            mainBtn.textContent = opt.textContent;
            mainBtn.dataset.value = opt.dataset.value;
            menu.classList.add('hidden');
            
            updateActionButtonsState();
        }
    });

    seedPopoverBtn?.addEventListener('click', () => {
        if (seedInput?.value) {
            seedPopoverBtn.textContent = '🎲 ' + seedInput.value;
        } else {
            seedPopoverBtn.textContent = '🎲 Auto';
        }
        setTimeout(() => seedInput?.focus(), 50);
    });

    document.getElementById('seed-random-btn')?.addEventListener('click', () => {
        if (seedInput) {
            seedInput.value = '';
            seedPopoverBtn.textContent = '🎲 Auto';
            document.getElementById('seed-popover-menu')?.classList.add('hidden');
        }
    });

    seedInput?.addEventListener('input', () => {
        if (seedInput.value) {
            seedPopoverBtn.textContent = '🎲 ' + seedInput.value;
        } else {
            seedPopoverBtn.textContent = '🎲 Auto';
        }
    });
}

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

    document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, textarea, select, [contenteditable]')) return;
        
        let targetId = null;
        if (e.key === 'ArrowLeft') {
            targetId = 'nav-prev';
        } else if (e.key === 'ArrowRight') {
            targetId = 'nav-next';
        } else if (e.key === 'ArrowUp') {
            if (e.shiftKey && (e.metaKey || e.ctrlKey)) targetId = 'nav-jump-top-parent';
            else if (e.shiftKey) targetId = 'nav-jump-parent';
        } else if (e.key === 'ArrowDown') {
            if (e.shiftKey && (e.metaKey || e.ctrlKey)) targetId = 'nav-jump-last-child';
            else if (e.shiftKey) targetId = 'nav-jump-first-child';
        }

        if (targetId) {
            e.preventDefault();
            document.getElementById(targetId)?.click();
        }
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

    // Use the custom element
    vglInspectorInstance = document.createElement('vgl-inspector');
    vglInspectorInstance.setConfig({
        onPushToPrompt: (parsedJson) => {
            if (promptInput) promptInput.value = JSON.stringify(parsedJson, null, 2);
            if (previewSpCheckbox) previewSpCheckbox.checked = true; // Setup for bypass
            if (state.featuredImageId) state.pushedLineageId = state.featuredImageId;
        }
    });

    const mountPoint = document.getElementById('arc-vgl-mount');
    if (mountPoint) mountPoint.appendChild(vglInspectorInstance);

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

    // Listen to changes
    state.on('featuredChanged', syncVgl);
    state.on('projectChanged', () => {
        vglInspectorInstance.updateData(null);
        syncVgl();
    });

    // ==========================================
    // Multi-Project Background Tracking
    // ==========================================
    const bgJobTray = document.createElement('div');
    bgJobTray.id = 'bg-job-tray';
    bgJobTray.className = 'bg-job-tray hidden';
    document.body.appendChild(bgJobTray);

    document.head.insertAdjacentHTML('beforeend', `
        <style>
            .bg-job-tray {
                position: fixed;
                top: 60px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000;
                display: flex;
                flex-direction: column;
                gap: 8px;
                pointer-events: none;
            }
            .bg-job-tray.hidden { display: none; }
            .bg-job-item {
                pointer-events: auto;
                background: rgba(43, 45, 49, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 8px 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                color: rgba(255, 255, 255, 0.9);
                font-size: 13px;
                backdrop-filter: blur(10px);
            }
            .bg-job-item .spinner {
                width: 14px;
                height: 14px;
                border: 2px solid rgba(255, 255, 255, 0.2);
                border-top-color: var(--accent-light, #58a6ff);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            .bg-job-cancel {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.5);
                cursor: pointer;
                padding: 4px;
                margin-left: 8px;
            }
            .bg-job-cancel:hover { color: #ff5555; }
        </style>
    `);

    state.on('backgroundJobsChanged', () => {
        const jobs = state.getBackgroundJobs();
        if (jobs.length === 0) {
            bgJobTray.classList.add('hidden');
            return;
        }
        
        bgJobTray.classList.remove('hidden');
        bgJobTray.innerHTML = jobs.map(j => `
            <div class="bg-job-item">
                <div class="spinner"></div>
                <span class="bg-job-text"><b>${j.projectName}</b>: ${j.text}</span>
                <button class="bg-job-cancel" data-id="${j.projectId}">✕</button>
            </div>
        `).join('');

        bgJobTray.querySelectorAll('.bg-job-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pid = e.target.getAttribute('data-id');
                generationManager.interrupt(pid);
                state.setLoading(false, null, pid); // Pre-emptive UI sync
            });
        });
    });
}



