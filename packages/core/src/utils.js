/* ============================================================
   utils.js — Helper utilities
   ============================================================ */

/**
 * Generate a simple UUID v4.
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

/**
 * Generate a random seed (positive integer, up to 2^31).
 */
export function randomizeSeed() {
    return Math.floor(Math.random() * 2147483647);
}

/**
 * Replaces window.prompt with a custom dialog to play nicely with automated testing.
 */
export function promptUser(title, defaultValue = '') {
    return new Promise((resolve) => {
        let dialog = document.getElementById('arc-generic-prompt');
        let input, titleEl;

        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'arc-generic-prompt';
            dialog.style = "background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:8px; padding:1.5rem; color:var(--text-primary); max-width:400px; width:100%; margin:auto;";
            dialog.innerHTML = `
                <form method="dialog" style="display:flex; flex-direction:column; gap:1rem;">
                    <h3 id="arc-generic-prompt-title" style="margin:0;"></h3>
                    <input type="text" id="arc-generic-prompt-input" class="form-control" style="width: 100%; box-sizing: border-box;">
                    <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top: 1rem;">
                        <button type="button" id="arc-generic-prompt-cancel" class="btn btn-secondary">Cancel</button>
                        <button type="submit" value="confirm" class="btn btn-primary">OK</button>
                    </div>
                </form>
            `;
            document.body.appendChild(dialog);
            
            dialog.querySelector('#arc-generic-prompt-cancel').addEventListener('click', () => {
                dialog.close('cancel');
            });
        }

        input = dialog.querySelector('#arc-generic-prompt-input');
        titleEl = dialog.querySelector('#arc-generic-prompt-title');

        titleEl.textContent = title;
        input.value = defaultValue;
        dialog.returnValue = ''; // reset return value

        const handleClose = () => {
            dialog.removeEventListener('close', handleClose);
            if (dialog.returnValue === 'confirm') {
                resolve(input.value.trim());
            } else {
                resolve(null);
            }
        };
        dialog.addEventListener('close', handleClose);
        
        if (dialog.showModal) {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
    });
}

/**
 * Replaces window.confirm with a custom dialog.
 */
export function confirmUser(message) {
    return new Promise((resolve) => {
        let dialog = document.getElementById('arc-generic-confirm');

        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'arc-generic-confirm';
            dialog.style = "background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:8px; padding:1.5rem; color:var(--text-primary); max-width:400px; width:100%; margin:auto;";
            dialog.innerHTML = `
                <form method="dialog" style="display:flex; flex-direction:column; gap:1rem;">
                    <p id="arc-generic-confirm-msg" style="margin:0;"></p>
                    <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top: 1rem;">
                        <button type="button" id="arc-generic-confirm-cancel" class="btn btn-secondary">Cancel</button>
                        <button type="submit" value="confirm" class="btn btn-danger">Confirm</button>
                    </div>
                </form>
            `;
            document.body.appendChild(dialog);
            
            dialog.querySelector('#arc-generic-confirm-cancel').addEventListener('click', () => {
                dialog.close('cancel');
            });
        }

        const msgEl = dialog.querySelector('#arc-generic-confirm-msg');
        msgEl.textContent = message;
        dialog.returnValue = ''; // reset

        const handleClose = () => {
            dialog.removeEventListener('close', handleClose);
            resolve(dialog.returnValue === 'confirm');
        };
        dialog.addEventListener('close', handleClose);
        
        if (dialog.showModal) {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
    });
}

/**
 * Custom dialog to select an option from a dropdown.
 * options is an array of {label, value} objects.
 */
export function promptSelect(title, options) {
    return new Promise((resolve) => {
        let dialog = document.getElementById('arc-generic-select');
        let selectEl, titleEl;

        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'arc-generic-select';
            dialog.style = "background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:8px; padding:1.5rem; color:var(--text-primary); max-width:400px; width:100%; margin:auto;";
            dialog.innerHTML = `
                <form method="dialog" style="display:flex; flex-direction:column; gap:1rem;">
                    <h3 id="arc-generic-select-title" style="margin:0;"></h3>
                    <select id="arc-generic-select-input" class="form-control" style="width: 100%; box-sizing: border-box; padding: 0.5rem; background: var(--bg-tertiary); color: var(--text-primary);"></select>
                    <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top: 1rem;">
                        <button type="button" id="arc-generic-select-cancel" class="btn btn-secondary">Cancel</button>
                        <button type="submit" value="confirm" class="btn btn-primary">Select</button>
                    </div>
                </form>
            `;
            document.body.appendChild(dialog);
            
            dialog.querySelector('#arc-generic-select-cancel').addEventListener('click', () => {
                dialog.close('cancel');
            });
        }

        titleEl = dialog.querySelector('#arc-generic-select-title');
        selectEl = dialog.querySelector('#arc-generic-select-input');
        
        titleEl.textContent = title;
        
        // Populate options
        selectEl.innerHTML = '';
        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.value;
            el.textContent = opt.label;
            selectEl.appendChild(el);
        });

        dialog.returnValue = ''; // reset return value

        const handleClose = () => {
            dialog.removeEventListener('close', handleClose);
            if (dialog.returnValue === 'confirm') {
                resolve(selectEl.value);
            } else {
                resolve(null);
            }
        };
        dialog.addEventListener('close', handleClose);
        
        if (dialog.showModal) {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
    });
}

/**
 * Custom dialog to replace window.alert.
 */
export function alertUser(message) {
    return new Promise((resolve) => {
        let dialog = document.getElementById('arc-generic-alert');
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'arc-generic-alert';
            dialog.style = "background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:8px; padding:1.5rem; color:var(--text-primary); max-width:400px; width:100%; margin:auto;";
            dialog.innerHTML = `
                <form method="dialog" style="display:flex; flex-direction:column; gap:1rem;">
                    <p id="arc-generic-alert-msg" style="margin:0;"></p>
                    <div style="display:flex; justify-content:flex-end; margin-top: 1rem;">
                        <button type="submit" class="btn btn-primary">OK</button>
                    </div>
                </form>
            `;
            document.body.appendChild(dialog);
        }

        const msgEl = dialog.querySelector('#arc-generic-alert-msg');
        msgEl.textContent = message;

        const handleClose = () => {
            dialog.removeEventListener('close', handleClose);
            resolve();
        };
        dialog.addEventListener('close', handleClose);
        
        if (dialog.showModal) {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
    });
}

// Override native prompt and confirm
window.prompt = promptUser;
window.confirm = confirmUser;
window.alert = alertUser;

/**
 * Create a thumbnail from a base64 image string.
 */
export function createThumbnail(base64, maxSize = 200) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = base64;
    });
}

// ============================================================
// FILENAME CONVENTION
// [project]_[note_or_prompt]_[seed][_suffix]_v[NNNN].ext  (versioned)
// [project]_[note_or_prompt]_[seed]_[timestamp].ext       (legacy)
// [project]_[note_or_prompt]_[timestamp].txt              (text report)
// If a batch note exists it is used as the slug; otherwise the
// first 5 words of the prompt are used.
// ============================================================

/**
 * Convert a timestamp (ms) to YYYYMMDD_HHMMSS string.
 */
function formatTimestamp(ts) {
    const d = new Date(ts || Date.now());
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Sanitize any string for use in a filename.
 * Lowercases, replaces spaces and special characters with underscores,
 * collapses repeated underscores, and trims leading/trailing ones.
 */
function toSlug(text, maxWords = 5) {
    if (!text) return null;
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')   // strip special chars
        .trim()
        .split(/\s+/)                  // split on whitespace
        .filter(Boolean)
        .slice(0, maxWords)
        .join('_') || null;
}

/**
 * Extract ~5-word slug from a prompt string.
 */
function promptSlug(prompt) {
    return toSlug(prompt, 5) || 'untitled';
}

/**
 * Extract up to 7-word slug from a batch note.
 * Returns null if the note is empty/missing.
 */
function noteSlug(note) {
    return toSlug(note, 7);
}

/**
 * Sanitize a project name for use in filenames.
 */
function projectSlug(name) {
    if (!name) return 'vgl';
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

/**
 * Generate the base filename (no extension) for an image file.
 * Format: [project]_[note_or_prompt]_[seed][_suffix]_v[NNNN]
 *
 * Images with a version number use the _v[NNNN] pattern.
 * Images without a version (legacy) fall back to _[timestamp].
 * Resolution increases add _2x or _4x suffix before the version.
 *
 * @param {Object} img          - Image record (prompt, seed, createdAt, batchId, version, versionSuffix)
 * @param {string} projectName
 * @param {Object} [project]    - Full project object (for batchNotes lookup)
 * @returns {string}
 */
export function generateFilename(img, projectName, project) {
    // Legacy call signature: generateFilename(promptString, seed)
    if (typeof img === 'string') {
        const slug = promptSlug(img);
        const proj = projectSlug(projectName || 'vgl');
        const ts = formatTimestamp(Date.now());
        const seed = projectName || '';
        return `${proj}_${slug}_${seed ? seed + '_' : ''}${ts}`;
    }

    const proj = projectSlug(projectName || 'vgl');
    const seed = img.seed || 0;

    // Prefer batch note → fall back to prompt slug
    const batchNote = project?.batchNotes?.[img.batchId] || img.batchNote || '';
    const slug = noteSlug(batchNote) || promptSlug(img.prompt);

    // Version-aware filename or legacy timestamp fallback
    const suffix = img.versionSuffix || '';
    if (img.version != null) {
        const v = `_v${String(img.version).padStart(4, '0')}`;
        return `${proj}_${slug}_${seed}${suffix}${v}`;
    }

    // Legacy: no version, use timestamp
    const ts = formatTimestamp(img.createdAt);
    return `${proj}_${slug}_${seed}_${ts}`;
}

/**
 * Generate the base filename for a .txt report (no seed).
 * Format: [project]_[note_or_prompt]_[timestamp]
 */
export function generateTxtFilename(img, projectName, project) {
    const proj = projectSlug(projectName || 'vgl');
    const ts = formatTimestamp(img.createdAt);

    const batchNote = project?.batchNotes?.[img.batchId] || img.batchNote || '';
    const slug = noteSlug(batchNote) || promptSlug(img.prompt);

    return `${proj}_${slug}_${ts}`;
}

// ============================================================
// DOWNLOAD HELPERS
// ============================================================

/**
 * Trigger a browser download of a PNG from base64.
 */
export function downloadPNG(base64, filename = 'image') {
    const link = document.createElement('a');
    link.href = base64;
    link.download = filename.endsWith('.png') ? filename : filename + '.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Trigger a browser download of a JSON object.
 */
export function downloadJSON(obj, filename = 'vgl') {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.json') ? filename : filename + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Trigger a browser download of a plain text file.
 */
export function downloadTxt(content, filename = 'report') {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.txt') ? filename : filename + '.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Show the OS folder picker immediately within a user gesture.
 * Returns the chosen FileSystemDirectoryHandle, null if unsupported,
 * or throws an AbortError if the user cancelled.
 *
 * ⚠️  Must be called synchronously (or as the first await) inside a
 *    click / keydown handler — the browser blocks it once the gesture expires.
 */
export async function pickExportFolder() {
    if (!window.showDirectoryPicker) return null;
    return await window.showDirectoryPicker({ mode: 'readwrite' });
}

/**
 * Write an array of { name, blob } files into an already-opened directory handle.
 */
export async function writeFilesToHandle(dirHandle, files) {
    for (const { name, blob } of files) {
        try {
            const fh = await dirHandle.getFileHandle(name, { create: true });
            const writable = await fh.createWritable();
            await writable.write(blob);
            await writable.close();
        } catch (e) {
            console.error(`Failed to write ${name}:`, e);
        }
    }
}

/**
 * Convenience: pick a folder then write files.
 * Only use this when there is NO async work between the user gesture and this call.
 * For cases with prior async work (e.g. loading images) use pickExportFolder +
 * writeFilesToHandle separately.
 *
 * @returns {Promise<boolean>} true if saved, false if unsupported, re-throws AbortError
 */
export async function saveFilesToFolder(files) {
    if (!window.showDirectoryPicker) return false;
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await writeFilesToHandle(dirHandle, files);
    return true;
}

// ============================================================
// TXT REPORT GENERATOR
// ============================================================

/**
 * Build and return the .txt report content for a given image.
 *
 * Includes:
 *  - Original user prompt
 *  - Batch notes
 *  - ASCII lineage tree showing ancestors → this image ★ → descendants
 *
 * @param {Object} img        - The image record
 * @param {Object} project    - The full project object (has .images, .name)
 * @returns {string}
 */
export function generateTxtReport(img, project) {
    const projectName = project.name || 'vgl';
    const lines = [];
    const hr = '─'.repeat(60);

    lines.push('BRIA ARC — IMAGE EXPORT REPORT');
    lines.push(hr);
    lines.push(`Project:    ${projectName}`);
    lines.push(`Image ID:   ${img.id}`);
    lines.push(`Mode:       ${(img.mode || 'generate').toUpperCase()}`);
    lines.push(`Seed:       ${img.seed || 'N/A'}`);
    lines.push(`Created:    ${new Date(img.createdAt).toLocaleString()}`);
    lines.push('');

    // Prompt
    lines.push('ORIGINAL PROMPT');
    lines.push(hr);
    lines.push(img.prompt || '(no prompt)');
    lines.push('');

    // Batch notes
    const batchImages = project.images.filter(i => i.batchId === img.batchId);
    const batchNote = batchImages.length > 0 ? (batchImages[0].batchNote || '') : '';
    // try the batch note from the first image or from a batches index
    const batch = project.images.find(i => i.batchId === img.batchId);

    // Notes are stored on the project level batches map
    lines.push('BATCH NOTES');
    lines.push(hr);
    const note = img.batchNote || project.batchNotes?.[img.batchId] || '(none)';
    lines.push(note);
    lines.push('');

    // Build lineage tree
    lines.push('LINEAGE TREE');
    lines.push(hr);
    lines.push('(★ = this image, filenames show what would be downloaded)');
    lines.push('');

    const allImages = project.images;

    // Walk UP to find root ancestor
    const chain = []; // [rootmost → ... → this image]
    let cur = img;
    while (cur) {
        chain.unshift(cur);
        cur = cur.parentImageId ? allImages.find(i => i.id === cur.parentImageId) : null;
    }

    // Render the tree with BFS downward from each node in chain
    function renderNode(node, prefix, isLast, targetId) {
        const isSelf = node.id === targetId;
        const fname = generateFilename(node, projectName, project) + '.png';
        const mode = (node.mode || 'generate').toUpperCase();
        const marker = isSelf ? ' ★' : '';
        const connector = isLast ? '└── ' : '├── ';
        lines.push(`${prefix}${connector}${fname}  [${mode} / seed ${node.seed || 0}]${marker}`);

        const children = allImages.filter(i => i.parentImageId === node.id);
        const childPrefix = prefix + (isLast ? '    ' : '│   ');
        children.forEach((child, idx) => {
            renderNode(child, childPrefix, idx === children.length - 1, targetId);
        });
    }

    // Render from root
    const root = chain[0];
    const rootFname = generateFilename(root, projectName, project) + '.png';
    const rootMode = (root.mode || 'generate').toUpperCase();
    const rootMarker = root.id === img.id ? ' ★' : '';
    lines.push(`${rootFname}  [${rootMode} / seed ${root.seed || 0}]${rootMarker}`);

    if (root.id !== img.id) {
        const rootChildren = allImages.filter(i => i.parentImageId === root.id);
        rootChildren.forEach((child, idx) => {
            renderNode(child, '', idx === rootChildren.length - 1, img.id);
        });
    }

    lines.push('');
    lines.push(hr);
    lines.push('Generated by Bria Arc');

    return lines.join('\n');
}

// ============================================================
// MISC UTILITIES
// ============================================================

/**
 * Copy text to clipboard and show toast.
 */
export async function copyToClipboard(text, label = 'Copied!') {
    try {
        await navigator.clipboard.writeText(text);
        showToast(label);
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(label);
    }
}

/**
 * Show a brief toast notification.
 */
export function showToast(message, duration = 5000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

/**
 * Convert a File to a base64 data URL.
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Format a timestamp to a short readable string (for UI display, not filenames).
 */
export function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Recursively find keys that differ between two objects.
 * Returns an array of dot-notated paths.
 */
export function findDiffPaths(oldObj, newObj, path = '') {
    let diffs = [];

    if (oldObj && typeof oldObj === 'object' && !Array.isArray(oldObj) &&
        newObj && typeof newObj === 'object' && !Array.isArray(newObj)) {
        const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
        for (const key of allKeys) {
            const fullPath = path ? `${path}.${key}` : key;
            diffs = diffs.concat(findDiffPaths(oldObj[key], newObj[key], fullPath));
        }
        return diffs;
    }

    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
        const len = Math.max(oldObj.length, newObj.length);
        for (let i = 0; i < len; i++) {
            const fullPath = path ? `${path}.${i}` : String(i);
            diffs = diffs.concat(findDiffPaths(oldObj[i], newObj[i], fullPath));
        }
        return diffs;
    }

    if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
        if (path) diffs.push(path);
    }

    return diffs;
}
