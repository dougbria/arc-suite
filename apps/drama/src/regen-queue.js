import state from '@arc/state.js';
import { checkShotStaleness } from './staleness.js';

export function initRegenQueue() {
    const btnRegenStale = document.getElementById('btn-regen-stale');
    if (!btnRegenStale) return;

    btnRegenStale.addEventListener('click', async () => {
        if (!state.activeEpisode) {
            alert("No active episode.");
            return;
        }

        // Find all stale shots
        const staleShots = [];
        state.activeEpisode.scenes.forEach(scene => {
            scene.shots.forEach(shot => {
                if (checkShotStaleness(shot, scene)) {
                    staleShots.push({ shot, scene });
                }
            });
        });

        if (staleShots.length === 0) {
            alert("No stale shots found.");
            return;
        }

        if (!confirm(`Found ${staleShots.length} stale shots. Queue them for regeneration?`)) return;

        // Sequence through them by triggering the same Generate flow via UI
        console.log("Queueing " + staleShots.length + " shots...");
        document.querySelector('#nav-btn-inspector')?.click();
        
        // This is a simplified "dumb queue" that just sequentially triggers the main btn-generate
        // and waits for state.loading to flip, or hardcodes a delay. A robust production
        // queue would listen to the actual API promises. For bootstrap, we do basic sequence.
        (async function processQueue() {
            for (const item of staleShots) {
                console.log(`Regenerating shot ${item.shot.id}...`);
                const shotCard = document.querySelector(`.shot-card`); // It's just a generic selector
                // Set inspector to this shot
                state.activeShotId = item.shot.id;
                state.switchProject(item.shot.id);
                
                const promptInput = document.getElementById('prompt-input');
                const imageCount = document.getElementById('image-count-select');
                if (promptInput) promptInput.value = item.shot.action;
                if (imageCount) imageCount.value = Math.max(1, (item.shot.keyframes || []).length);
                
                const charSelect = document.getElementById('prompt-char-select');
                const locSelect = document.getElementById('prompt-loc-select');
                if (charSelect && item.shot.characterIds.length > 0) {
                     Array.from(charSelect.options).forEach(opt => {
                          opt.selected = item.shot.characterIds.includes(opt.value);
                     });
                }
                if (locSelect && item.scene.locationId) {
                     locSelect.value = item.scene.locationId;
                }
                
                // Trigger generate
                document.getElementById('btn-generate')?.click();

                // Simple polling wait for generation to start and finish
                await new Promise(r => setTimeout(r, 1000)); // wait for it to enter loading state
                while (document.getElementById('loading-overlay') && !document.getElementById('loading-overlay').classList.contains('hidden')) {
                    await new Promise(r => setTimeout(r, 2000));
                }
                await new Promise(r => setTimeout(r, 1000)); // breath before next
            }
            alert("Batch Regeneration Complete!");
        })();
    });
}
