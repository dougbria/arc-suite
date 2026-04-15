import { initCanvas } from '@arc/canvas.js';
import state from './state-extensions.js';

export function initCanvasController() {
  // Initialize Arc's canvas (it handles Image mode)
  initCanvas('arc-main-mount');

  // Add mode switching
  state.on('canvasModeChanged', () => {
    const mode = state.canvasMode;
    document.getElementById('arc-image-view')?.classList.toggle('hidden', mode !== 'image');
    document.getElementById('arc-storyboard-view')?.classList.toggle('hidden', mode !== 'storyboard');
    document.getElementById('arc-setup-view')?.classList.toggle('hidden', mode !== 'setup');
    document.getElementById('arc-map-view')?.classList.toggle('hidden', mode !== 'map');

    // Show/hide Arc's gallery sidebar (only hide in Storyboard mode)
    document.getElementById('reel-sidebar')?.classList.toggle('hidden', mode === 'storyboard');
    
    // Hide the prompt-bar (generation footer) if we are not actively in Shot Production
    const promptBar = document.getElementById('prompt-bar');
    if (promptBar) {
         promptBar.classList.toggle('hidden-prompt-bar', mode !== 'image');
    }
    
    // Hide floating Shot Details context popup
    const shotNavToggle = document.getElementById('shot-nav-toggle');
    const shotNavSidebar = document.getElementById('shot-nav-sidebar');
    if (shotNavToggle) shotNavToggle.classList.toggle('hidden', mode !== 'image');
    if (shotNavSidebar && mode !== 'image') shotNavSidebar.classList.add('hidden');
    
    // Update active state on header buttons
    document.querySelectorAll('.view-toggle').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  });

  // Bind header buttons
  document.querySelectorAll('.view-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.setCanvasMode(e.target.dataset.mode);
    });
  });
}
