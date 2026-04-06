import state from '@arc/state.js';

/**
 * Render the history view for a given entity.
 * @param {HTMLElement} container 
 * @param {Object} entity 
 * @param {Function} onRevertCallback
 */
export function renderEntityHistory(container, entity, onRevertCallback) {
    container.innerHTML = '';
    
    if (!entity.entityHistory || entity.entityHistory.length === 0) {
        container.innerHTML = '<div class="text-muted" style="text-align:center; padding: 1rem;">No history available.</div>';
        return;
    }

    const historyList = document.createElement('div');
    historyList.className = 'history-list';
    
    // Reverse array to show newest first
    const snapshots = [...entity.entityHistory].reverse();

    snapshots.forEach((snap, idx) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.style.borderBottom = '1px solid var(--border-color)';
        item.style.padding = '0.5rem 0';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';

        const dateStr = new Date(snap.timestamp).toLocaleString();
        
        item.innerHTML = `
            <div class="history-item-info">
                <strong>v${snap.version}</strong>
                <span class="text-muted" style="font-size: 0.8em; margin-left: 0.5rem;">${dateStr}</span>
            </div>
            <button class="btn btn-sm btn-revert">Revert</button>
        `;

        const revertBtn = item.querySelector('.btn-revert');
        revertBtn.addEventListener('click', () => {
             if (confirm(`Are you sure you want to revert to version ${snap.version}?`)) {
                 if (onRevertCallback) onRevertCallback(snap);
             }
        });

        historyList.appendChild(item);
    });

    container.appendChild(historyList);
}

/**
 * Creates a snapshot of the current entity state and adds it to history.
 */
export function snapshotEntityInfo(entity) {
    if (!entity.entityHistory) entity.entityHistory = [];
    
    // Deep clone the current state minus history
    const clone = JSON.parse(JSON.stringify(entity));
    delete clone.entityHistory;
    
    // Only save if different from last snapshot
    const lastSnap = entity.entityHistory[entity.entityHistory.length - 1];
    if (lastSnap) {
        const lastClone = JSON.parse(JSON.stringify(lastSnap.data));
        if (JSON.stringify(clone) === JSON.stringify(lastClone)) {
            return false; // no change
        }
    }

    entity.entityHistory.push({
        version: entity.entityVersion || 1,
        timestamp: Date.now(),
        data: clone
    });
    
    // Cap at 20 history items
    if (entity.entityHistory.length > 20) {
        entity.entityHistory.shift();
    }
    return true;
}
