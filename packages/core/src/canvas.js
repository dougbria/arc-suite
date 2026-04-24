/* ============================================================
   canvas.js — Main image viewer & canvas management
   ============================================================ */

import state from './state.js';
import { enhanceImage, increaseResolution, removeBackground, eraseObject } from './actions.js';
import { generateFilename, showToast, copyToClipboard, globalCoordinateMapper } from './utils.js';
import { layoutManager } from './layout.js';

const elements = {
    canvasArea: null,
    welcomeScreen: null,
    imageViewer: null,
    mainImage: null,
    imageInfoBar: null,
    infoSeed: null,
    infoPrompt: null,
    zoomIndicator: null,
    zoomFitBtn: null,
    zoom100Btn: null,
    loadingOverlay: null,
    loadingText: null,
    canvasInterruptBtn: null,
    errorOverlay: null,
    errorMessage: null,
    viewerWrapper: null,
    canvasToolbar: null,
    toolbarBtns: null,
    maskControls: null,
    expandControls: null,
    brushSlider: null,
    maskCanvas: null,
    expandBox: null
};

// Zoom & Pan State (Scale/Translate moved to globalCoordinateMapper)
const interactionState = {
    isPanning: false,
    startX: 0,
    startY: 0
};

// 'fit' | '100' | 'custom'
let zoomMode = 'fit';

const CANVAS_HTML = `
  <section class="canvas-area" id="canvas-area">
    <!-- Welcome Screen -->
    <div id="welcome-screen" class="welcome-screen">
      <div class="welcome-inner">
        <div class="welcome-icon">✦</div>
        <h2>Welcome to Bria Arc</h2>
        <p>Create a new project or load an existing one to start.</p>
        <div class="welcome-actions">
          <button id="welcome-new-btn" class="btn btn-primary">New Project</button>
        </div>
      </div>
    </div>

    <!-- Image Viewer -->
    <div id="image-viewer" class="image-viewer hidden" style="display:flex; flex-direction:row; position:relative;">
      <!-- Column Wrapper for Canvas + Footer -->
      <div style="flex:1; display:flex; flex-direction:column; min-width:0; position:relative;">
        
        <div class="viewer-wrapper" id="viewer-wrapper" style="flex:1; position:relative; overflow:hidden;">
          <!-- Master Container for transforms (pan/zoom) -->
          <div id="canvas-transform-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; transform-origin: 0 0;">
            <img id="main-image" class="main-image" alt="Featured image" />
            <canvas id="mask-canvas" class="mask-canvas" style="position:absolute; top:0; left:0; pointer-events:none; opacity:0; transition: opacity 0.2s;"></canvas>
            
            <div id="layout-sprites-layer" class="layout-sprites-layer hidden" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;"></div>
            
            <div id="expand-box" class="expand-box hidden" style="position:absolute; border: 2px dashed var(--accent-primary); pointer-events:none;">
               <div class="expand-handle expand-handle-t" data-handle="t" style="position:absolute; top:-5px; left:50%; width:10px; height:10px; background:var(--accent-primary); transform:translateX(-50%); pointer-events:auto; cursor:ns-resize;"></div>
               <div class="expand-handle expand-handle-r" data-handle="r" style="position:absolute; top:50%; right:-5px; width:10px; height:10px; background:var(--accent-primary); transform:translateY(-50%); pointer-events:auto; cursor:ew-resize;"></div>
               <div class="expand-handle expand-handle-b" data-handle="b" style="position:absolute; bottom:-5px; left:50%; width:10px; height:10px; background:var(--accent-primary); transform:translateX(-50%); pointer-events:auto; cursor:ns-resize;"></div>
               <div class="expand-handle expand-handle-l" data-handle="l" style="position:absolute; top:50%; left:-5px; width:10px; height:10px; background:var(--accent-primary); transform:translateY(-50%); pointer-events:auto; cursor:ew-resize;"></div>
            </div>
          </div>

          <div id="ref-indicator" class="ref-indicator hidden">Uploaded Reference</div>
          <div id="compare-overlay" class="compare-overlay hidden">
            <!-- Compare structure ... -->
            <div id="compare-clipper" style="position:absolute; top:0; left:0; width:100%; height:100%; overflow:hidden; pointer-events:none;">
              <img id="compare-image" class="compare-image" alt="Compare image" />
            </div>
            <div id="wipe-handle" class="wipe-handle">
              <div class="wipe-line"></div>
              <div class="wipe-knob"></div>
            </div>
            <button id="exit-compare-btn" class="exit-compare-btn hidden">Exit Compare</button>
          </div>
          <!-- Hooks mount point for overarching UI extensions -->
          <div id="canvas-hooks-overlay" style="position:absolute; top:0; left:0; right:0; bottom:0; pointer-events:none; z-index:49;"></div>

        </div>

        <!-- Image info bar -->
        <div id="image-info-bar" class="image-info-bar" style="pointer-events:auto;">
          <div class="info-main">
            <span id="info-seed" class="info-seed" title="Click to copy seed">Seed: —</span>
            <span id="info-version" class="info-version"></span>
            <span id="info-prompt" class="info-prompt" title="Click to copy prompt">No prompt</span>
            <div class="zoom-controls">
              <span id="zoom-indicator" class="zoom-indicator">Fit</span>
              <button id="zoom-fit-btn" class="zoom-btn zoom-btn-active" title="Fit (F)">Fit</button>
              <button id="zoom-100-btn" class="zoom-btn" title="100% (H)">100%</button>
            </div>
          </div>
          <div class="info-actions">
            <!-- Hooks container for custom buttons like "Approve KF" -->
            <div id="canvas-info-actions-hook" style="display:inline-flex; gap:0.5rem; margin-right:0.5rem;"></div>
            <div class="gallery-nav" id="gallery-nav" style="display:flex; align-items:center;">
              <button id="nav-jump-top-parent" class="nav-btn nav-btn-outer" title="Jump to oldest ancestor (Shift+Cmd+Up)">⇈</button>
              <button id="nav-jump-parent" class="nav-btn nav-btn-outer" title="Jump to parent (Shift+Up)">↑</button>
              <button id="nav-prev" class="nav-btn nav-btn-inner" title="Prev">‹</button>
              <button id="nav-next" class="nav-btn nav-btn-inner" title="Next">›</button>
              <button id="nav-jump-first-child" class="nav-btn nav-btn-outer" title="Jump to first child (Shift+Down)">↓</button>
              <button id="nav-jump-last-child" class="nav-btn nav-btn-outer" title="Jump to newest child (Shift+Cmd+Down)">⇊</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading and Error Overlays -->
      <div id="loading-overlay" class="loading-overlay hidden">
        <div class="spinner"></div><p class="loading-text">Generating…</p>
        <button id="canvas-interrupt-btn" class="btn" style="margin-top:1rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); padding: 0.25rem 1rem;">Cancel</button>
      </div>
      <div id="error-overlay" class="error-overlay hidden">
        <div class="error-inner">
          <div class="error-icon">⚠</div>
          <p id="error-message" class="error-message"></p>
          <div style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 1rem;">
            <button id="retry-btn" class="btn btn-primary">Retry</button>
            <button id="error-cancel-btn" class="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
    <div id="arc-prompt-mount"></div>
  </section>
`;

/**
 * Initialize the canvas/viewer module.
 * @param {string} [mountPointId=null] If provided, generates the HTML inside this container.
 */
export function initCanvas(mountPointId = null) {
    if (mountPointId) {
        const container = document.getElementById(mountPointId);
        if (container && !document.getElementById('canvas-area')) {
            container.insertAdjacentHTML('beforeend', CANVAS_HTML);
            console.log('[Core] Canvas UI dynamically injected into', mountPointId);
        }
    }

    elements.canvasArea = document.getElementById('canvas-area');
    elements.welcomeScreen = document.getElementById('welcome-screen');
    elements.imageViewer = document.getElementById('image-viewer');
    elements.mainImage = document.getElementById('main-image');
    elements.imageInfoBar = document.getElementById('image-info-bar');
    elements.infoSeed = document.getElementById('info-seed');
    elements.infoPrompt = document.getElementById('info-prompt');
    elements.zoomIndicator = document.getElementById('zoom-indicator');
    elements.zoomFitBtn    = document.getElementById('zoom-fit-btn');
    elements.zoom100Btn    = document.getElementById('zoom-100-btn');
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.loadingText = elements.loadingOverlay?.querySelector('.loading-text');
    elements.canvasInterruptBtn = elements.loadingOverlay?.querySelector('#canvas-interrupt-btn');
    elements.errorOverlay = document.getElementById('error-overlay');
    elements.errorMessage = document.getElementById('error-message');
    elements.viewerWrapper = document.getElementById('viewer-wrapper');
    elements.transformLayer = document.getElementById('canvas-transform-layer');
    elements.infoVersion = document.getElementById('info-version');
    
    // Tools
    elements.canvasToolbar = document.getElementById('canvas-toolbar');
    elements.maskControls = document.getElementById('toolbar-mask-controls');
    elements.expandControls = document.getElementById('toolbar-expand-controls');
    elements.maskCanvas = document.getElementById('mask-canvas');
    elements.expandBox = document.getElementById('expand-box');
    elements.brushSlider = document.getElementById('brush-size-slider');
    
    initTools();

    // Zoom control buttons
    elements.zoomFitBtn?.addEventListener('click', () => {
        zoomToFit();
    });
    elements.zoom100Btn?.addEventListener('click', () => {
        zoomTo100();
    });

    // Keyboard shortcuts  (ignore when typing in inputs)
    let shiftCompareActive = false;
    let isMouseOverCanvas = false;
    
    document.getElementById('canvas-wrap')?.addEventListener('mouseenter', () => isMouseOverCanvas = true);
    document.getElementById('canvas-wrap')?.addEventListener('mouseleave', () => isMouseOverCanvas = false);

    document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, textarea, select, [contenteditable]')) return;
        
        if (e.key === ' ') {
            window.isSpacebarDown = true;
            if (state.compareActive) {
                e.preventDefault();
                state.emit('toggleCompareEdges');
                state.emit('compareChanged');
            } else {
                // If not in compare, spacebar is pan override, so update cursor
                if (elements.viewerWrapper && !interactionState.isPanning) {
                    elements.viewerWrapper.style.cursor = 'grab';
                }
            }
        }
        
        if (e.key === 'Shift' && !shiftCompareActive && state.featuredImageId && isMouseOverCanvas) {
            shiftCompareActive = true;
            triggerCompareAuto();
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            zoomToFit();
        } else if (e.key === 'h' || e.key === 'H') {
            e.preventDefault();
            zoomTo100();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === ' ') {
            window.isSpacebarDown = false;
            if (elements.viewerWrapper && !interactionState.isPanning) {
                elements.viewerWrapper.style.cursor = '';
            }
        }
        if (e.key === 'Shift' && shiftCompareActive) {
            shiftCompareActive = false;
            state.exitCompare();
        }
    });

    // Listen for state changes
    state.on('projectChanged', () => updateView());
    state.on('imagesAdded', () => updateView()); // Ensure welcome screen hides when images appear
    state.on('featuredChanged', () => {
        updateView();
    });
    state.on('canvasLoadingChanged', () => updateLoadingState());
    state.on('loadingChanged', () => updateLoadingState());
    state.on('errorChanged', () => updateErrorState());

    // Zoom event
    elements.viewerWrapper.addEventListener('wheel', handleWheel, { passive: false });

    // Pan events
    elements.viewerWrapper.addEventListener('mousedown', startPan);
    window.addEventListener('mousemove', doPan);
    window.addEventListener('mouseup', endPan);

    layoutManager.init();

    // Canvas Right-Click Context Menu
    initCanvasContextMenu();

    updateView();
}

// ============================================================
// CANVAS CONTEXT MENU
// ============================================================

let canvasCtxMenu        = null;
let canvasCtxEraseSubmenu = null;
let canvasCtxEraseItem   = null;
let canvasCtxCopySubmenu = null;
let canvasCtxCopyItem    = null;
let canvasCtxCopyBg      = null;

function initCanvasContextMenu() {
    canvasCtxMenu        = document.getElementById('canvas-context-menu');
    canvasCtxEraseSubmenu = document.getElementById('canvas-ctx-erase-submenu');
    canvasCtxEraseItem   = document.getElementById('canvas-ctx-erase-item');
    canvasCtxCopySubmenu  = document.getElementById('canvas-ctx-copy-submenu');
    canvasCtxCopyItem     = document.getElementById('canvas-ctx-copy-item');
    canvasCtxCopyBg       = document.getElementById('canvas-ctx-copy-bg');
    if (!canvasCtxMenu) return;

    // Right-click on the viewer
    elements.viewerWrapper.addEventListener('contextmenu', (e) => {
        // Only show if an image is loaded
        if (!state.featuredImageId) return;
        e.preventDefault();
        showCanvasContextMenu(e);
    });

    // Dispatch actions
    canvasCtxMenu.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-canvas-action]');
        if (!btn) return;

        const action = btn.dataset.canvasAction;
        const imageId = state.featuredImageId;
        if (!imageId) return;

        hideCanvasContextMenu();

        const modOpts = {
            modContent: document.getElementById('mod-content-toggle')?.checked,
            modOutput:  document.getElementById('mod-output-toggle')?.checked,
            ipSignal:   document.getElementById('ip-signal-toggle')?.checked
        };

        const img = state.getFeaturedImage();
        let sp = null;
        if (img?.structured_prompt) {
            try { sp = typeof img.structured_prompt === 'string' ? JSON.parse(img.structured_prompt) : img.structured_prompt; } catch {}
        }

        switch (action) {
            case 'enhance':
                enhanceImage(imageId, modOpts);
                break;
            case 'increase-resolution': {
                const scale = parseInt(btn.dataset.scale, 10) || 2;
                increaseResolution(imageId, scale);
                break;
            }
            case 'remove-background':
                removeBackground(imageId);
                break;
            case 'erase': {
                const desc = btn.dataset.desc;
                if (desc) eraseObject(imageId, desc);
                break;
            }
            case 'compare': {
                triggerCompareAuto();
                break;
            }
            case 'copy-object': {
                const json = btn.dataset.json;
                if (json) copyToClipboard(json, 'Object copied!');
                break;
            }
            case 'copy-background': {
                const bg = sp?.background_setting;
                if (bg) copyToClipboard(bg, 'Background copied!');
                break;
            }
        }
    });

    // Close on outside click or Escape
    document.addEventListener('click', (e) => {
        if (canvasCtxMenu && !canvasCtxMenu.contains(e.target)) {
            hideCanvasContextMenu();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideCanvasContextMenu();
    });

}

function triggerCompareAuto() {
    const img = state.getFeaturedImage();
    if (!img) return;
    const project = state.getActiveProject();
    if (project && project.images) {
        if (img.parentImageId) {
            state.setCompareImage(img.parentImageId);
            return;
        }
        if (img.batchId) {
            const siblings = project.images.filter(i => i.batchId === img.batchId && i.id !== img.id);
            if (siblings.length > 0) {
                let best = siblings.find(i => i.seed === img.seed - 1);
                if (!best) best = siblings.find(i => i.seed === img.seed + 1);
                if (!best) best = siblings[0];
                if (best) {
                    state.setCompareImage(best.id);
                    return;
                }
            }
        }
    }
    showToast('No suitable image to compare against.', 3000);
}

/**
 * Extract a short label (≤ 40 chars) from a VGL object entry.
 */
function objectShortLabel(obj) {
    const desc = obj.description || '';
    // Use the first sentence or first 40 chars, whichever is shorter
    const firstSentence = desc.split(/[.!?]/)[0].trim();
    const label = firstSentence || desc;
    return label.length > 45 ? label.slice(0, 42) + '…' : label;
}

function showCanvasContextMenu(e) {
    if (!canvasCtxMenu) return;

    // Build the Erase Object submenu from VGL objects
    const img = state.getFeaturedImage();
    let sp = null;
    if (img?.structured_prompt) {
        try {
            sp = typeof img.structured_prompt === 'string'
                ? JSON.parse(img.structured_prompt) : img.structured_prompt;
        } catch { sp = null; }
    }

    const objects = sp?.objects ?? [];

    // Erase submenu
    if (canvasCtxEraseSubmenu) {
        canvasCtxEraseSubmenu.innerHTML = '';
        if (objects.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'ctx-empty';
            empty.textContent = 'No VGL objects';
            canvasCtxEraseSubmenu.appendChild(empty);
        } else {
            objects.forEach((obj) => {
                const label = objectShortLabel(obj);
                const btn = document.createElement('button');
                btn.dataset.canvasAction = 'erase';
                btn.dataset.desc = label;
                btn.textContent = label;
                canvasCtxEraseSubmenu.appendChild(btn);
            });
        }
    }
    if (canvasCtxEraseItem) {
        canvasCtxEraseItem.style.display = objects.length === 0 && !sp ? 'none' : '';
    }

    // Copy Object submenu
    if (canvasCtxCopySubmenu) {
        canvasCtxCopySubmenu.innerHTML = '';
        if (objects.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'ctx-empty';
            empty.textContent = 'No VGL objects';
            canvasCtxCopySubmenu.appendChild(empty);
        } else {
            objects.forEach((obj) => {
                const label = objectShortLabel(obj);
                const btn = document.createElement('button');
                btn.dataset.canvasAction = 'copy-object';
                btn.dataset.json = JSON.stringify(obj, null, 2);
                btn.textContent = label;
                canvasCtxCopySubmenu.appendChild(btn);
            });
        }
    }
    if (canvasCtxCopyItem) {
        canvasCtxCopyItem.style.display = !sp ? 'none' : '';
    }

    // Copy Background button
    if (canvasCtxCopyBg) {
        canvasCtxCopyBg.style.display = sp?.background_setting ? '' : 'none';
    }

    // Position safely within viewport
    canvasCtxMenu.classList.remove('hidden');
    const menuW = canvasCtxMenu.offsetWidth  || 220;
    const menuH = canvasCtxMenu.offsetHeight || 180;
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuW > window.innerWidth)  x = window.innerWidth  - menuW - 8;
    if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
    canvasCtxMenu.style.left = x + 'px';
    canvasCtxMenu.style.top  = y + 'px';
}

function hideCanvasContextMenu() {
    canvasCtxMenu?.classList.add('hidden');
}


// ============================================================
// CANVAS TOOLS (Mask & Expand)
// ============================================================

function initTools() {
    const btns = elements.canvasToolbar?.querySelectorAll('.toolbar-mode-btn');
    if (btns) {
        btns.forEach(btn => btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            state.setCanvasMode(mode);
        }));
    }

    state.on('canvasModeChanged', updateToolModes);
    state.on('featuredChanged', () => {
        const img = state.getFeaturedImage();
        if (img) setupToolCanvases(img);
    });

    setupMaskDrawing();
    setupExpandDragging();
}

function updateToolModes() {
    const mode = state.canvasMode;
    const btns = elements.canvasToolbar?.querySelectorAll('.toolbar-mode-btn');
    btns?.forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });

    elements.maskControls?.classList.toggle('hidden', mode !== 'mask');
    elements.expandControls?.classList.toggle('hidden', mode !== 'expand');

    elements.maskCanvas.style.opacity = (mode === 'mask') ? '0.7' : '0';
    elements.maskCanvas.style.pointerEvents = (mode === 'mask') ? 'auto' : 'none';
    
    // Auto-center expand box on mode enter if it isn't set up yet
    if (mode === 'expand') {
        elements.expandBox.classList.remove('hidden');
        elements.expandBox.style.pointerEvents = 'auto';
        elements.expandBox.style.cursor = 'move';
        if (!elements.expandBox.style.width || elements.expandBox.style.width === "0px") {
             const bounds = getRenderedImageBounds();
             if (bounds) {
                 elements.expandBox.style.width = bounds.width + 'px';
                 elements.expandBox.style.height = bounds.height + 'px';
                 elements.expandBox.style.left = bounds.left + 'px';
                 elements.expandBox.style.top = bounds.top + 'px';
             }
        }
    } else {
        elements.expandBox.classList.add('hidden');
        elements.expandBox.style.pointerEvents = 'none';
    }
}

export function getRenderedImageBounds() {
    const img = elements.mainImage;
    if (!img) return null;
    const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
    let width = img.offsetWidth;
    let height = img.offsetHeight;
    if (width / height > ratio) {
        width = height * ratio;
    } else {
        height = width / ratio;
    }
    const left = (img.offsetWidth - width) / 2;
    const top = (img.offsetHeight - height) / 2;
    return { width, height, left, top };
}

function setupToolCanvases(imgRecord) {
    // Match the canvas natural res to the image for 1:1 drawing
    const img = elements.mainImage;
    if (!img) return;

    elements.canvasToolbar.classList.remove('hidden');

    function syncDimensions() {
        elements.maskCanvas.width = img.naturalWidth || 1024;
        elements.maskCanvas.height = img.naturalHeight || 1024;
        elements.maskCanvas.style.width = img.offsetWidth + 'px';
        elements.maskCanvas.style.height = img.offsetHeight + 'px';
        
        // Reset expand box so it aligns nicely on new image
        elements.expandBox.style.width = '0px';
        if (state.canvasMode === 'expand') updateToolModes();
    }

    if (img.complete) {
        syncDimensions();
    } else {
        img.onload = syncDimensions;
    }
}

// Global drawing state
let isDrawing = false;
let maskCtx = null;

function setupMaskDrawing() {
    elements.maskCanvas.addEventListener('pointerdown', (e) => {
        if (state.canvasMode !== 'mask') return;
        if (window.isSpacebarDown || e.button === 1) return; // ignore panning
        isDrawing = true;
        
        maskCtx = elements.maskCanvas.getContext('2d', { willReadFrequently: true });
        maskCtx.lineCap = 'round';
        maskCtx.lineJoin = 'round';
        maskCtx.strokeStyle = 'rgba(255, 0, 0, 1)';
        drawStroke(e, false);
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDrawing) return;
        drawStroke(e, true);
    });

    window.addEventListener('pointerup', () => {
        isDrawing = false;
    });

    document.getElementById('clear-mask-btn')?.addEventListener('click', () => {
        if (!maskCtx) maskCtx = elements.maskCanvas.getContext('2d');
        maskCtx.clearRect(0, 0, elements.maskCanvas.width, elements.maskCanvas.height);
    });
}

function drawStroke(e, lineTo) {
    const rect = elements.maskCanvas.getBoundingClientRect();
    const scaleX = elements.maskCanvas.width / rect.width;
    const scaleY = elements.maskCanvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    maskCtx.lineWidth = (parseInt(elements.brushSlider?.value) || 40) * scaleX;
    maskCtx.globalCompositeOperation = e.altKey ? 'destination-out' : 'source-over';

    if (!lineTo) {
        maskCtx.beginPath();
        maskCtx.moveTo(x, y);
    }
    maskCtx.lineTo(x, y);
    maskCtx.stroke();
    
    // Draw single dots on click
    if (!lineTo) {
        maskCtx.beginPath();
        maskCtx.arc(x, y, maskCtx.lineWidth / 2, 0, Math.PI * 2);
        maskCtx.fillStyle = 'rgba(255, 0, 0, 1)';
        maskCtx.fill();
        maskCtx.beginPath();
        maskCtx.moveTo(x, y);
    }
}

// Expand Crop Logic
let activeDragHandle = null;
let expandStartX, expandStartY, initialBoxRect;

function setupExpandDragging() {
    const box = elements.expandBox;
    box.addEventListener('pointerdown', e => {
        if (state.canvasMode !== 'expand') return;
        
        if (e.target.classList.contains('expand-handle')) {
            activeDragHandle = e.target.dataset.handle;
        } else if (e.target === box) {
            activeDragHandle = 'pan';
        } else {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        expandStartX = e.clientX;
        expandStartY = e.clientY;
        initialBoxRect = { 
            left: parseFloat(box.style.left) || 0,
            top: parseFloat(box.style.top) || 0,
            width: parseFloat(box.style.width) || elements.mainImage.offsetWidth,
            height: parseFloat(box.style.height) || elements.mainImage.offsetHeight 
        };
    });

    window.addEventListener('pointermove', e => {
        if (!activeDragHandle) return;
        // Divide by globalCoordinateMapper.scale to move exactly alongside mouse visually
        const dx = (e.clientX - expandStartX) / globalCoordinateMapper.scale;
        const dy = (e.clientY - expandStartY) / globalCoordinateMapper.scale;
        
        const bounds = getRenderedImageBounds();
        const origWidth = bounds ? bounds.width : elements.mainImage.offsetWidth;
        const origHeight = bounds ? bounds.height : elements.mainImage.offsetHeight;
        const origLeft = bounds ? bounds.left : 0;
        const origTop = bounds ? bounds.top : 0;
        const snapDist = 10;

        if (activeDragHandle === 'pan') {
            let nextLeft = initialBoxRect.left + dx;
            let nextTop = initialBoxRect.top + dy;
            
            if (nextLeft > origLeft) nextLeft = origLeft;
            if (nextLeft + initialBoxRect.width < origLeft + origWidth) {
                nextLeft = origLeft + origWidth - initialBoxRect.width;
            }
            if (nextTop > origTop) nextTop = origTop;
            if (nextTop + initialBoxRect.height < origTop + origHeight) {
                nextTop = origTop + origHeight - initialBoxRect.height;
            }

            box.style.left = nextLeft + 'px';
            box.style.top = nextTop + 'px';
        } else if (activeDragHandle === 'r') {
            let w = Math.max(origWidth, initialBoxRect.width + dx);
            if (Math.abs(w - origWidth) < snapDist) w = origWidth;
            box.style.width = w + 'px';
        } else if (activeDragHandle === 'l') {
            let w = Math.max(origWidth, initialBoxRect.width - dx);
            let l = initialBoxRect.left + (initialBoxRect.width - w);
            if (Math.abs(l - origLeft) < snapDist || l > origLeft) {
                l = origLeft;
                w = initialBoxRect.left + initialBoxRect.width - origLeft;
            }
            box.style.width = w + 'px';
            box.style.left = l + 'px';
        } else if (activeDragHandle === 'b') {
            let h = Math.max(origHeight, initialBoxRect.height + dy);
            if (Math.abs(h - origHeight) < snapDist) h = origHeight;
            box.style.height = h + 'px';
        } else if (activeDragHandle === 't') {
            let h = Math.max(origHeight, initialBoxRect.height - dy);
            let t = initialBoxRect.top + (initialBoxRect.height - h);
            if (Math.abs(t - origTop) < snapDist || t > origTop) {
                t = origTop;
                h = initialBoxRect.top + initialBoxRect.height - origTop;
            }
            box.style.height = h + 'px';
            box.style.top = t + 'px';
        }
    });

    window.addEventListener('pointerup', () => {
        activeDragHandle = null;
    });

    document.querySelectorAll('.expand-ratio-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.expand-ratio-btn').forEach(b => b.classList.remove('btn-primary'));
            e.target.classList.add('btn-primary');
            
            const ratioStr = e.target.dataset.ratio;
            if (ratioStr === 'free') return;
            const rw = parseInt(ratioStr.split(':')[0], 10);
            const rh = parseInt(ratioStr.split(':')[1], 10);
            
            const bounds = getRenderedImageBounds();
            const origW = bounds ? bounds.width : elements.mainImage.offsetWidth;
            const origH = bounds ? bounds.height : elements.mainImage.offsetHeight;
            
            let newW = Math.max(origW, origH * (rw / rh));
            let newH = Math.max(origH, origW * (rh / rw));

            box.style.width = newW + 'px';
            box.style.height = newH + 'px';
        });
    });

    document.getElementById('reset-expand-btn')?.addEventListener('click', () => {
        if (!elements.mainImage || !elements.expandBox) return;
        const bounds = getRenderedImageBounds();
        if (bounds) {
            elements.expandBox.style.width = bounds.width + 'px';
            elements.expandBox.style.height = bounds.height + 'px';
            elements.expandBox.style.left = bounds.left + 'px';
            elements.expandBox.style.top = bounds.top + 'px';
        }
        document.querySelectorAll('.expand-ratio-btn').forEach(b => b.classList.remove('btn-primary'));
        document.querySelector('.expand-ratio-btn[data-ratio="free"]')?.classList.add('btn-primary');
    });
}


/**
 * Export getters to pull mathematical DOM bounds during Execution.
 */
export function getMaskBase64() {
    if (!elements.maskCanvas) return null;
    
    // Check if empty
    const ctx = elements.maskCanvas.getContext('2d');
    const pixelData = ctx.getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height).data;
    let hasPixels = false;
    for (let i = 3; i < pixelData.length; i += 4) {
        if (pixelData[i] > 0) { hasPixels = true; break; }
    }
    if (!hasPixels) return null;
    
    // Bria mask requires B/W. 
    // We drew red, so let's physically map alpha > 0 to WHITE and alpha === 0 to BLACK,
    // though usually Bria expects white where edit occurs, black out of bounds.
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = elements.maskCanvas.width;
    tempCanvas.height = elements.maskCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = 'black';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Replace non-transparent with white
    const idata = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const d = idata.data;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i+3] > 0) {
            d[i] = 255; d[i+1] = 255; d[i+2] = 255; d[i+3] = 255;
        } else {
            d[i] = 0; d[i+1] = 0; d[i+2] = 0; d[i+3] = 255;
        }
    }
    tempCtx.putImageData(idata, 0, 0);
    return tempCanvas.toDataURL('image/png');
}

export function getExpandBounds() {
    if (!elements.expandBox) return null;
    const box = elements.expandBox;
    const img = elements.mainImage;
    
    const bounds = getRenderedImageBounds();
    if (!bounds) return null;

    // Scale factor from screen pixels (rendered image) to actual natural pixels
    const cssScale = (img.naturalWidth || 1024) / bounds.width;
    
    const boxW = parseFloat(box.style.width) || bounds.width;
    const boxH = parseFloat(box.style.height) || bounds.height;
    const boxL = parseFloat(box.style.left) || 0;
    const boxT = parseFloat(box.style.top) || 0;

    // Output dimensions
    const outWidth = Math.round(boxW * cssScale);
    const outHeight = Math.round(boxH * cssScale);
    
    // The box's position relative to the image's visual top-left corner
    const relativeLeft = boxL - bounds.left;
    const relativeTop = boxT - bounds.top;

    const offsetLeftPx = Math.round(relativeLeft * cssScale);
    const offsetTopPx = Math.round(relativeTop * cssScale);

    // The Bria API offset implies "where is the original image located relative to the new Top-Left of the expanded canvas?"
    // If the box is drawn to the left of the image (relativeLeft < 0), the original image sits INSIDE the new canvas at a positive offset.
    const finalOffset = [
        Math.max(0, -offsetLeftPx),
        Math.max(0, -offsetTopPx)
    ];

    return {
        canvas: [outWidth, outHeight],
        original_image_size: [img.naturalWidth || 1024, img.naturalHeight || 1024],
        offset: finalOffset
    };
}


/**
 * Reset zoom to Fit mode (default).
 */
function resetZoom() {
    zoomToFit();
}

/**
 * Zoom to Fit — scale=1 + centered (CSS handles contain scaling).
 */
export function zoomToFit() {
    if (!elements.mainImage || !elements.viewerWrapper) {
        globalCoordinateMapper.setTransform(1, 0, 0);
        zoomMode = 'fit';
        applyZoom(true);
        state.emit('zoomChanged', getZoomState());
        return;
    }

    const img = elements.mainImage;
    const wrapper = elements.viewerWrapper;
    const promptBar = document.getElementById('prompt-bar');
    
    const wrapW = wrapper.clientWidth;
    const wrapH = wrapper.clientHeight;
    let visibleH = wrapH;
    
    // If prompt bar exists and is open, calculate visible area above it
    if (promptBar && !promptBar.classList.contains('collapsed')) {
        const wrapRect = wrapper.getBoundingClientRect();
        const promptRect = promptBar.getBoundingClientRect();
        
        // Find how much of the wrapper is physically above the prompt bar (plus a small gap)
        const spaceAbovePrompt = promptRect.top - wrapRect.top - 20; 
        if (spaceAbovePrompt > 100 && spaceAbovePrompt < visibleH) {
            visibleH = spaceAbovePrompt;
        }
    }

    const naturalW = img.naturalWidth || 512;
    const naturalH = img.naturalHeight || 512;
    
    const containScale = Math.min(wrapW / naturalW, wrapH / naturalH);
    const fitScale = Math.min(wrapW / naturalW, visibleH / naturalH);
    
    // The required CSS scale relative to the browser's native contain scale
    const newScale = containScale > 0 ? fitScale / containScale : 1;
    
    // Pan to center the image within the newly calculated visible area
    const newTx = (wrapW / 2) * (1 - newScale);
    const newTy = (visibleH / 2) - (wrapH / 2) * newScale;

    globalCoordinateMapper.setTransform(newScale, newTx, newTy);
    zoomMode = 'fit';
    applyZoom(true);
    state.emit('zoomChanged', getZoomState());
}

/**
 * Zoom to 100% — render image at its natural pixel dimensions.
 *
 * The <img> uses object-fit:contain, so the browser already applies a
 * "contain scale" of  min(wrapW/naturalW, wrapH/naturalH)  at transform
 * scale=1.  To make 1 image-pixel == 1 display-pixel we must invert that.
 */
export function zoomTo100() {
    if (!elements.mainImage || !elements.viewerWrapper) return;
    const img = elements.mainImage;
    const wrapper = elements.viewerWrapper;
    const naturalW = img.naturalWidth  || 512;
    const naturalH = img.naturalHeight || 512;
    const wrapW = wrapper.clientWidth;
    const wrapH = wrapper.clientHeight;
    const containScale = Math.min(wrapW / naturalW, wrapH / naturalH);
    
    // Multiply by 1/containScale so the net display scale is 1.0 (100%)
    const newScale = containScale > 0 ? 1 / containScale : 1;
    
    // Center the image itself to the center of the viewport
    const cx = wrapW / 2;
    const cy = wrapH / 2;
    
    // Calculate translation to keep the physical center of the image centered
    const newTx = cx * (1 - newScale);
    const newTy = cy * (1 - newScale);

    globalCoordinateMapper.setTransform(newScale, newTx, newTy);
    zoomMode = '100';
    applyZoom(true);
    state.emit('zoomChanged', getZoomState());
}

/**
 * Handle mouse wheel for zooming.
 */
function handleWheel(e) {
    if (state.canvasLoading || !state.featuredImageId) return;
    e.preventDefault();

    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    const currentScale = globalCoordinateMapper.scale;
    const newScale = Math.max(0.1, Math.min(10, currentScale * factor));

    if (newScale !== currentScale) {
        // Use viewerWrapper so the reference frame is STATIC, avoiding drift/curves
        const rect = elements.viewerWrapper.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;

        // Calculate the canvas coordinate under the cursor before zoom
        const px = (cx - globalCoordinateMapper.translateX) / currentScale;
        const py = (cy - globalCoordinateMapper.translateY) / currentScale;

        // Apply new scale
        globalCoordinateMapper.scale = newScale;
        
        // Adjust translation so the canvas coordinate remains under the cursor
        globalCoordinateMapper.translateX = cx - (px * newScale);
        globalCoordinateMapper.translateY = cy - (py * newScale);

        zoomMode = 'custom';
        applyZoom();
        state.emit('zoomChanged', getZoomState());
    }
}

/**
 * Start panning.
 */
function startPan(e) {
    // Allow panning with middle click or left click
    if (e.button !== 0 && e.button !== 1) return;
    
    const isPanOverride = (e.button === 1 || window.isSpacebarDown);
    
    if (!isPanOverride) {
        // If not overriding, only allow left-click pan in view/expand modes
        // Expand handles use stopPropagation so they won't trigger this
        if (state.canvasMode !== 'view' && state.canvasMode !== 'expand') return;
    }

    interactionState.isPanning = true;
    interactionState.startX = e.clientX - globalCoordinateMapper.translateX;
    interactionState.startY = e.clientY - globalCoordinateMapper.translateY;
    elements.viewerWrapper.style.cursor = 'grabbing';
}

/**
 * Do panning.
 */
function doPan(e) {
    if (!interactionState.isPanning) return;
    globalCoordinateMapper.translateX = e.clientX - interactionState.startX;
    globalCoordinateMapper.translateY = e.clientY - interactionState.startY;
    applyZoom();
    state.emit('zoomChanged', getZoomState());
}

/**
 * End panning.
 */
function endPan() {
    if (!interactionState.isPanning) return;
    interactionState.isPanning = false;
    elements.viewerWrapper.style.cursor = '';
}

/**
 * Apply zoom and pan transforms to the main image layer.
 */
function applyZoom(animated = false) {
    if (!elements.transformLayer) return;
    
    // Disable transitions during scroll/pan to prevent lag/curved paths
    elements.transformLayer.style.transition = animated ? 'transform 0.25s ease-out' : 'none';
    
    elements.transformLayer.style.transform = `translate(${globalCoordinateMapper.translateX}px, ${globalCoordinateMapper.translateY}px) scale(${globalCoordinateMapper.scale})`;

    // Update indicator text
    if (elements.zoomIndicator) {
        if (zoomMode === 'fit') {
            elements.zoomIndicator.textContent = 'Fit';
        } else if (zoomMode === '100') {
            elements.zoomIndicator.textContent = '100%';
        } else {
            elements.zoomIndicator.textContent = `${Math.round(globalCoordinateMapper.scale * 100)}%`;
        }
    }

    // Update active button state
    elements.zoomFitBtn?.classList.toggle('zoom-btn-active', zoomMode === 'fit');
    elements.zoom100Btn?.classList.toggle('zoom-btn-active', zoomMode === '100');
}

/**
 * Get current zoom state for external sync.
 */
export function getZoomState() {
    return {
        scale: globalCoordinateMapper.scale,
        translateX: globalCoordinateMapper.translateX,
        translateY: globalCoordinateMapper.translateY,
        isPanning: interactionState.isPanning,
        startX: interactionState.startX,
        startY: interactionState.startY
    };
}

/**
 * Update the view based on current project state.
 */
function updateView() {
    const project = state.getActiveProject();

    if (!project) {
        // No project — show welcome
        elements.welcomeScreen.classList.remove('hidden');
        elements.imageViewer.classList.add('hidden');
        return;
    }

    // Has a project (even if 0 images) — hide welcome
    elements.welcomeScreen.classList.add('hidden');
    elements.imageViewer.classList.remove('hidden');

    if (project.images.length === 0) {
        // Empty project — show viewer but it will be empty
        // We ensure featuredImageId is null
        state.featuredImageId = null;
        updateFeaturedImage();
        return;
    }

    // If no featured image, auto-select the first
    if (!state.featuredImageId) {
        state.featuredImageId = project.images[0].id;
    }

    updateFeaturedImage();
}

/**
 * Update the main image display.
 */
function updateFeaturedImage() {
    const img = state.getFeaturedImage();
    if (!img) {
        // If loading, stay in viewer so we see the spinner
        if (state.isLoading) {
             elements.imageViewer.classList.remove('hidden');
             elements.welcomeScreen.classList.add('hidden');
        } else {
             elements.imageViewer.classList.add('hidden');
             elements.welcomeScreen.classList.remove('hidden');
        }
        return;
    }

    elements.mainImage.src = img.base64;
    elements.infoSeed.textContent = `Seed: ${img.seed}`;
    if (elements.infoVersion) {
        elements.infoVersion.textContent = img.version != null ? `v${String(img.version).padStart(3, '0')}` : '';
    }
    const displayPrompt = img.prompt ? (img.prompt.length > 200 ? img.prompt.substring(0, 200) + '...' : img.prompt) : '(no prompt)';
    elements.infoPrompt.textContent = displayPrompt;

    // Show viewer if hidden
    elements.welcomeScreen.classList.add('hidden');
    elements.imageViewer.classList.remove('hidden');
}

/**
 * Update loading overlay.
 */
function updateLoadingState() {
    const show = !!state.isLoading && !!state.canvasLoading;
    if (elements.loadingOverlay) elements.loadingOverlay.classList.toggle('hidden', !show);
    if (show && elements.loadingText) {
        elements.loadingText.textContent = state.loadingText || 'Processing…';
        // Force viewer visible if we have a project
        if (state.getActiveProject()) {
            elements.imageViewer.classList.remove('hidden');
            elements.welcomeScreen.classList.add('hidden');
        }
    }
}

/**
 * Update error overlay.
 */
function updateErrorState() {
    if (state.errorMessage) {
        elements.errorOverlay.classList.remove('hidden');
        elements.errorMessage.textContent = state.errorMessage;
    } else {
        elements.errorOverlay.classList.add('hidden');
    }
}
