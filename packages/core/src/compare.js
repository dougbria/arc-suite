import state from './state.js';
import { getZoomState } from './canvas.js';

let overlay = null;
let clipper = null;
let compareImg = null;
let wipeHandle = null;
let exitBtn = null;
let mainImage = null;
let viewerWrapper = null;
let isDragging = false;
let syncRafId = null;

/**
 * Initialize compare mode.
 */
export function initCompare() {
    overlay = document.getElementById('compare-overlay');
    clipper = document.getElementById('compare-clipper');
    compareImg = document.getElementById('compare-image');
    wipeHandle = document.getElementById('wipe-handle');
    exitBtn = document.getElementById('exit-compare-btn');
    mainImage = document.getElementById('main-image');
    viewerWrapper = document.getElementById('viewer-wrapper');

    state.on('compareChanged', () => updateCompare());
    state.on('zoomChanged', () => {
        if (state.compareActive) syncCompareImageSize();
    });

    exitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.exitCompare();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.compareActive) {
            state.exitCompare();
        }
    });

    wipeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !state.compareActive) return;
        const rect = viewerWrapper.getBoundingClientRect();
        let x = (e.clientX - rect.left) / rect.width;
        x = Math.max(0, Math.min(1, x));
        state.wipePosition = x;
        applyWipePosition(x);
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    viewerWrapper.addEventListener('click', (e) => {
        if (!state.compareActive || isDragging) return;
        if (e.target.closest('.exit-compare-btn, .wipe-handle')) return;
        const rect = viewerWrapper.getBoundingClientRect();
        let x = (e.clientX - rect.left) / rect.width;
        x = Math.max(0, Math.min(1, x));
        state.wipePosition = x;
        applyWipePosition(x);
    });

    state.on('toggleCompareEdges', () => {
        if (!state.compareActive) return;
        const distToLeft = Math.abs(state.wipePosition - lastLeftBound);
        const distToRight = Math.abs(state.wipePosition - lastRightBound);
        const target = distToLeft < distToRight ? lastRightBound : lastLeftBound;
        state.wipePosition = target;
        applyWipePosition(target);
    });
}

function updateCompare() {
    if (state.compareActive && state.compareImageId) {
        const compareImgData = state.getImage(state.compareImageId);
        if (!compareImgData) {
            state.exitCompare();
            return;
        }
        compareImg.src = compareImgData.base64;
        overlay.classList.remove('hidden');
        overlay.classList.add('active');
        exitBtn.classList.remove('hidden');
        syncCompareImageSize();
        applyWipePosition(state.wipePosition);
    } else {
        overlay.classList.add('hidden');
        overlay.classList.remove('active');
        exitBtn.classList.add('hidden');
    }
}

let lastLeftBound = 0;
let lastRightBound = 1;

function syncCompareImageSize() {
    if (!state.compareActive) return;
    if (syncRafId) cancelAnimationFrame(syncRafId);
    syncRafId = requestAnimationFrame(() => {
        const zoom = getZoomState();
        
        const featuredImg = state.getFeaturedImage();
        const compareImgData = state.getImage(state.compareImageId);
        let offsetX = 0;
        let offsetY = 0;

        let fSp = featuredImg?.structured_prompt;
        if (typeof fSp === 'string') try { fSp = JSON.parse(fSp); } catch {}
        if (fSp?.expand_offset) {
            offsetX += fSp.expand_offset[0];
            offsetY += fSp.expand_offset[1];
        }

        let cSp = compareImgData?.structured_prompt;
        if (typeof cSp === 'string') try { cSp = JSON.parse(cSp); } catch {}
        if (cSp?.expand_offset) {
            offsetX -= cSp.expand_offset[0];
            offsetY -= cSp.expand_offset[1];
        }

        const viewerWrapper = document.getElementById('viewer-wrapper');
        const mainImage = document.getElementById('main-image');
        const cWidth = viewerWrapper.clientWidth;
        const cHeight = viewerWrapper.clientHeight;
        const nWidth = mainImage.naturalWidth || 1024;
        const nHeight = mainImage.naturalHeight || 1024;

        const containerAspect = cWidth / cHeight;
        const imgAspect = nWidth / nHeight;

        let renderScale;
        if (imgAspect > containerAspect) {
            renderScale = cWidth / nWidth;
        } else {
            renderScale = cHeight / nHeight;
        }

        const clipper = document.getElementById('compare-clipper');
        if (offsetX !== 0 || offsetY !== 0) {
            clipper.style.backgroundColor = '#000';
        } else {
            clipper.style.backgroundColor = 'transparent';
        }

        const mRenderWidth = nWidth * renderScale;
        const mRenderHeight = nHeight * renderScale;
        const mLeft = (cWidth - mRenderWidth) / 2;
        const mTop = (cHeight - mRenderHeight) / 2;

        const cnWidth = compareImg.naturalWidth || 1024;
        const cnHeight = compareImg.naturalHeight || 1024;

        const screenOffsetX = offsetX * renderScale;
        const screenOffsetY = offsetY * renderScale;

        const cRenderWidth = cnWidth * renderScale;
        const cRenderHeight = cnHeight * renderScale;

        const baseLeft = mLeft + screenOffsetX;
        const baseTop = mTop + screenOffsetY;

        const minX = Math.min(mLeft, baseLeft);
        const maxX = Math.max(mLeft + mRenderWidth, baseLeft + cRenderWidth);
        lastLeftBound = Math.max(0, minX / cWidth);
        lastRightBound = Math.min(1, maxX / cWidth);

        compareImg.style.position = 'absolute';
        compareImg.style.inset = 'auto';
        compareImg.style.left = baseLeft + 'px';
        compareImg.style.top = baseTop + 'px';
        compareImg.style.width = cRenderWidth + 'px';
        compareImg.style.height = cRenderHeight + 'px';
        compareImg.style.objectFit = 'fill';

        compareImg.style.transform = `translate(${zoom.translateX}px, ${zoom.translateY}px) scale(${zoom.scale})`;
        compareImg.style.transformOrigin = `${-baseLeft}px ${-baseTop}px`;
    });
}

function applyWipePosition(x) {
    const pct = (x * 100).toFixed(2);
    clipper.style.clipPath = `inset(0 0 0 ${pct}%)`;
    wipeHandle.style.left = `${pct}%`;
}
