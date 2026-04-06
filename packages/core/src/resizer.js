/**
 * Simple Resizer utility for vertical panes in VGL Studio.
 */
export function initResizers(configs = []) {
    configs.forEach(config => {
        setupResizer(config.resizerId, config.prevId, config.nextId, config.mode);
    });
}

function setupResizer(resizerId, prevId, nextId, mode = 'left') {
    const resizer = document.getElementById(resizerId);
    const prevEl = document.getElementById(prevId);
    const nextEl = document.getElementById(nextId);

    if (!resizer || !prevEl || !nextEl) return;

    let startX, startWidthNext, startWidthPrev;

    resizer.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startWidthNext = nextEl.offsetWidth;
        startWidthPrev = prevEl.offsetWidth;

        resizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        const delta = e.clientX - startX;

        // Determine if we are resizing the 'next' element or 'prev' element.
        // Usually, a right-side sidebar is 'nextEl' attached to a resizer, and delta is negative if dragged left.
        // But we want to support any arbitrary IDs.
        // Let's assume nextEl is generally a right sidebar if it's not the canvas.
        if (nextId !== 'arc-main-mount' && nextId !== 'canvas-area') {
            const newWidth = startWidthNext - delta;
            if (newWidth > 150 && newWidth < 800) {
                nextEl.style.width = `${newWidth}px`;
                nextEl.style.flex = 'none'; // Ensure flex layout doesn't override manual width
            }
        } else if (prevId !== 'arc-main-mount' && prevId !== 'canvas-area') {
            const newWidth = startWidthPrev + delta;
            if (newWidth > 150 && newWidth < 800) {
                prevEl.style.width = `${newWidth}px`;
                prevEl.style.flex = 'none';
            }
        }
    }

    function onMouseUp() {
        resizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    }
}
