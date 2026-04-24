import state from './state.js';
import { getRenderedImageBounds } from './canvas.js';
import { globalCoordinateMapper } from './utils.js';

export class LayoutManager {
    constructor() {
        this.sprites = [];
        this.activeSpriteId = null;
        this.container = null;
        this.boundingBox = null;
        
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.initialSpriteX = 0;
        this.initialSpriteY = 0;
        
        this.isScaling = false;
        this.isRotating = false;
        this.initialScale = 1;
        this.initialRotation = 0;
        this.transformCenterX = 0;
        this.transformCenterY = 0;
        
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.updateLayerBounds = this.updateLayerBounds.bind(this);
    }
    
    init() {
        this.container = document.getElementById('layout-sprites-layer');
        if (!this.container) return;
        
        // Ensure there is a bounding box div
        this.boundingBox = document.createElement('div');
        this.boundingBox.className = 'layout-bounding-box hidden';
        this.boundingBox.style.position = 'absolute';
        this.boundingBox.style.pointerEvents = 'none'; // only handles have pointer-events
        this.boundingBox.style.border = '2px dashed var(--accent)';
        
        // Add handles
        const handles = ['tl', 'tr', 'bl', 'br', 'rot'];
        handles.forEach(h => {
            const handle = document.createElement('div');
            handle.className = `layout-handle layout-handle-${h}`;
            handle.dataset.handle = h;
            handle.style.position = 'absolute';
            handle.style.width = '12px';
            handle.style.height = '12px';
            handle.style.background = 'var(--accent)';
            handle.style.borderRadius = h === 'rot' ? '50%' : '2px';
            handle.style.pointerEvents = 'auto';
            
            // Positioning
            if (h === 'tl') { handle.style.top = '-6px'; handle.style.left = '-6px'; handle.style.cursor = 'nwse-resize'; }
            if (h === 'tr') { handle.style.top = '-6px'; handle.style.right = '-6px'; handle.style.cursor = 'nesw-resize'; }
            if (h === 'bl') { handle.style.bottom = '-6px'; handle.style.left = '-6px'; handle.style.cursor = 'nesw-resize'; }
            if (h === 'br') { handle.style.bottom = '-6px'; handle.style.right = '-6px'; handle.style.cursor = 'nwse-resize'; }
            if (h === 'rot') { handle.style.top = '-24px'; handle.style.left = '50%'; handle.style.transform = 'translateX(-50%)'; handle.style.cursor = 'grab'; }
            
            this.boundingBox.appendChild(handle);
        });
        
        this.container.appendChild(this.boundingBox);
        
        state.on('canvasModeChanged', () => {
            if (state.canvasMode === 'layout') {
                this.updateLayerBounds();
                this.container.classList.remove('hidden');
                this.container.style.pointerEvents = 'auto';
            } else {
                this.container.classList.add('hidden');
                this.container.style.pointerEvents = 'none';
                this.clearSprites(); // Or optionally keep them hidden
            }
        });
        
        state.on('layoutAddSprite', async (imageRecord) => {
            if (state.canvasMode !== 'layout') return;
            try {
                const base64 = await state.resolveImageBase64(imageRecord.id);
                if (base64) {
                    this.addSprite(base64);
                }
            } catch (err) {
                console.error('[LayoutManager] Failed to add sprite', err);
            }
        });
        
        this.container.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('resize', this.updateLayerBounds);
    }
    
    updateLayerBounds() {
        if (!this.container || state.canvasMode !== 'layout') return;
        const bounds = getRenderedImageBounds();
        const mainImg = document.getElementById('main-image');
        if (!bounds || !mainImg) return;
        
        const nw = mainImg.naturalWidth || 1024;
        const nh = mainImg.naturalHeight || 1024;
        const scale = bounds.width / nw;
        
        // Transform the layer to establish a local coordinate system of [nw, nh] matching the visual image
        this.container.style.width = `${nw}px`;
        this.container.style.height = `${nh}px`;
        this.container.style.left = `${bounds.left}px`;
        this.container.style.top = `${bounds.top}px`;
        this.container.style.transform = `scale(${scale})`;
        this.container.style.transformOrigin = '0 0';
        
        // Invert the scale on the bounding box to keep handles a constant visual size
        this.boundingBox.style.borderWidth = `${2 / scale}px`;
        const handles = this.boundingBox.querySelectorAll('.layout-handle');
        handles.forEach(h => {
            h.style.width = `${12 / scale}px`;
            h.style.height = `${12 / scale}px`;
            const isRot = h.dataset.handle === 'rot';
            if (h.dataset.handle === 'tl') { h.style.top = `${-6 / scale}px`; h.style.left = `${-6 / scale}px`; }
            if (h.dataset.handle === 'tr') { h.style.top = `${-6 / scale}px`; h.style.right = `${-6 / scale}px`; }
            if (h.dataset.handle === 'bl') { h.style.bottom = `${-6 / scale}px`; h.style.left = `${-6 / scale}px`; }
            if (h.dataset.handle === 'br') { h.style.bottom = `${-6 / scale}px`; h.style.right = `${-6 / scale}px`; }
            if (isRot) { h.style.top = `${-24 / scale}px`; }
        });
    }
    
    clearSprites() {
        this.sprites.forEach(s => {
            if (s.el.parentNode) s.el.parentNode.removeChild(s.el);
        });
        this.sprites = [];
        this.setActiveSprite(null);
    }
    
    addSprite(base64Data) {
        const id = 'sprite-' + Date.now();
        
        const el = document.createElement('div');
        el.className = 'layout-sprite';
        el.dataset.id = id;
        el.style.position = 'absolute';
        el.style.cursor = 'move';
        el.style.pointerEvents = 'auto'; // allow dragging on the element itself
        
        const img = new Image();
        img.src = base64Data;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.display = 'block';
        img.style.pointerEvents = 'none';
        
        el.appendChild(img);
        
        img.onload = () => {
            // Container width matches the main background image
            const mainImg = document.getElementById('main-image');
            const mainW = mainImg.naturalWidth || 1024;
            const mainH = mainImg.naturalHeight || 1024;
            
            const sprite = {
                id,
                el,
                base64Data,
                imgObj: img,
                x: 0,
                y: 0,
                scale: 1,
                rotation: 0,
                width: img.naturalWidth || 512,
                height: img.naturalHeight || 512
            };
            
            // Downscale initial size if too big
            const maxW = mainW * 0.5;
            if (sprite.width > maxW) {
                const ratio = maxW / sprite.width;
                sprite.width *= ratio;
                sprite.height *= ratio;
            }
            
            // Center
            sprite.x = (mainW - sprite.width) / 2;
            sprite.y = (mainH - sprite.height) / 2;
            
            this.sprites.push(sprite);
            this.container.appendChild(el);
            this.setActiveSprite(id);
            this.updateSpriteDOM(sprite);
        };
    }
    
    setActiveSprite(id) {
        this.activeSpriteId = id;
        if (!id) {
            this.boundingBox.classList.add('hidden');
        } else {
            this.boundingBox.classList.remove('hidden');
            const sprite = this.sprites.find(s => s.id === id);
            if (sprite) this.updateBoundingBox(sprite);
        }
    }
    
    updateSpriteDOM(sprite) {
        sprite.el.style.width = `${sprite.width}px`;
        sprite.el.style.height = `${sprite.height}px`;
        sprite.el.style.transform = `translate(${sprite.x}px, ${sprite.y}px) rotate(${sprite.rotation}deg) scale(${sprite.scale})`;
        sprite.el.style.zIndex = '100'; // above bg
        
        if (this.activeSpriteId === sprite.id) {
            this.updateBoundingBox(sprite);
        }
    }
    
    updateBoundingBox(sprite) {
        const scaledWidth = sprite.width * sprite.scale;
        const scaledHeight = sprite.height * sprite.scale;
        const offsetX = sprite.x + (sprite.width - scaledWidth) / 2;
        const offsetY = sprite.y + (sprite.height - scaledHeight) / 2;
        
        this.boundingBox.style.width = `${scaledWidth}px`;
        this.boundingBox.style.height = `${scaledHeight}px`;
        this.boundingBox.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${sprite.rotation}deg)`;
        this.boundingBox.style.zIndex = '1000'; // always on top of sprites
        
        // Re-append to ensure it's the last element in the DOM (on top)
        if (this.container && this.boundingBox.parentNode) {
            this.container.appendChild(this.boundingBox);
        }
    }
    
    // --- Interaction Handlers ---
    
    getPointerPos(e) {
        // We need coordinates relative to the container layer, which is already transformed by canvas pan/zoom.
        // Wait, if the container is transformed, event coordinates will be relative to viewport.
        // We can use getBoundingClientRect on the container to figure out the local coordinates.
        const rect = this.container.getBoundingClientRect();
        // The container itself is scaled and translated.
        // So rect gives the visible bounding box. But CSS transforms are applied.
        // A more robust way: use the main canvas.js viewportTransform inverse mapping if needed,
        // OR simply compute based on clientX/Y.
        
        // Actually, if we just use e.clientX / clientY, we can map to the container's coordinate space.
        // Let's import the getImageCoordinates helper from canvas.js, or duplicate the logic locally.
        // We can just rely on movementX/movementY scaled by the viewport scale!
        return { x: e.clientX, y: e.clientY };
    }
    
    onPointerDown(e) {
        if (state.canvasMode !== 'layout') return;
        
        // Ignore if panning (spacebar override or middle click)
        if (window.isSpacebarDown || e.button === 1) return;
        
        const handle = e.target.closest('.layout-handle');
        if (handle) {
            this.startTransform(e, handle.dataset.handle);
            return;
        }
        
        const spriteEl = e.target.closest('.layout-sprite');
        if (spriteEl) {
            const id = spriteEl.dataset.id;
            this.setActiveSprite(id);
            this.startDrag(e);
            return;
        }
        
        // Clicked background
        this.setActiveSprite(null);
    }
    
    startDrag(e) {
        const sprite = this.sprites.find(s => s.id === this.activeSpriteId);
        if (!sprite) return;
        
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.initialSpriteX = sprite.x;
        this.initialSpriteY = sprite.y;
        e.preventDefault();
    }
    
    startTransform(e, handleType) {
        const sprite = this.sprites.find(s => s.id === this.activeSpriteId);
        if (!sprite) return;
        
        if (handleType === 'rot') {
            this.isRotating = true;
        } else {
            this.isScaling = true;
        }
        
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.initialScale = sprite.scale;
        this.initialRotation = sprite.rotation;
        
        // Center of the sprite in client coordinates
        const rect = sprite.el.getBoundingClientRect();
        this.transformCenterX = rect.left + rect.width / 2;
        this.transformCenterY = rect.top + rect.height / 2;
        
        e.preventDefault();
    }
    
    onPointerMove(e) {
        if (!this.activeSpriteId) return;
        const sprite = this.sprites.find(s => s.id === this.activeSpriteId);
        if (!sprite) return;
        
        // Use the centralized CoordinateMapper for zoom
        let zoom = globalCoordinateMapper.scale;
        
        let layerScale = 1;
        const containerTransform = this.container.style.transform;
        const scaleMatch = containerTransform.match(/scale\(([^)]+)\)/);
        if (scaleMatch) layerScale = parseFloat(scaleMatch[1]) || 1;
        
        const totalZoom = zoom * layerScale;

        if (this.isDragging) {
            const dx = (e.clientX - this.dragStartX) / totalZoom;
            const dy = (e.clientY - this.dragStartY) / totalZoom;
            sprite.x = this.initialSpriteX + dx;
            sprite.y = this.initialSpriteY + dy;
            this.updateSpriteDOM(sprite);
        } else if (this.isScaling) {
            const dx = (e.clientX - this.dragStartX) / totalZoom;
            const initialDist = Math.hypot(this.dragStartX - this.transformCenterX, this.dragStartY - this.transformCenterY);
            const currentDist = Math.hypot(e.clientX - this.transformCenterX, e.clientY - this.transformCenterY);
            
            sprite.scale = this.initialScale * (currentDist / initialDist);
            this.updateSpriteDOM(sprite);
        } else if (this.isRotating) {
            const initialAngle = Math.atan2(this.dragStartY - this.transformCenterY, this.dragStartX - this.transformCenterX);
            const currentAngle = Math.atan2(e.clientY - this.transformCenterY, e.clientX - this.transformCenterX);
            const angleDelta = (currentAngle - initialAngle) * (180 / Math.PI);
            sprite.rotation = this.initialRotation + angleDelta;
            this.updateSpriteDOM(sprite);
        }
    }
    
    onPointerUp(e) {
        this.isDragging = false;
        this.isScaling = false;
        this.isRotating = false;
    }
    
    // Renders the final layout state to an offscreen canvas and returns base64
    exportCompositeBase64() {
        const mainImg = document.getElementById('main-image');
        if (!mainImg || !mainImg.src) return null;
        
        const canvas = document.createElement('canvas');
        canvas.width = mainImg.naturalWidth;
        canvas.height = mainImg.naturalHeight;
        const ctx = canvas.getContext('2d');
        
        // Draw background
        ctx.drawImage(mainImg, 0, 0);
        
        // Draw sprites
        this.sprites.forEach(sprite => {
            ctx.save();
            // Translate to sprite center
            ctx.translate(sprite.x + sprite.width / 2, sprite.y + sprite.height / 2);
            ctx.rotate(sprite.rotation * Math.PI / 180);
            ctx.scale(sprite.scale, sprite.scale);
            // Draw image offset by half width/height so it pivots around center
            ctx.drawImage(sprite.imgObj, -sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
            ctx.restore();
        });
        
        return canvas.toDataURL('image/jpeg', 0.95);
    }
}

// Export a singleton instance
export const layoutManager = new LayoutManager();
