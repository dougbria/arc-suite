/**
 * Unified JSON Editor an Inspector for VGL Studio.
 * Handles nested objects, arrays, canonical field sorting, and inline editing.
 */

const SP_SECTION_ORDER = [
    'general',
    'objects',
    'lighting',
    'aesthetics',
    'photographic_characteristics',
    'text_render'
];

const SP_SECTION_LABELS = {
    general: 'General',
    objects: 'Objects',
    lighting: 'Lighting',
    aesthetics: 'Aesthetics',
    photographic_characteristics: 'Photographic Characteristics',
    text_render: 'Text Render'
};

const OBJECT_FIELD_ORDER = [
    'description', 'location', 'relative_size', 'shape_and_color',
    'texture', 'appearance_details', 'relationship', 'orientation',
    'pose', 'expression', 'clothing', 'action', 'gender',
    'skin_tone_and_texture', 'number_of_objects'
];

const TEXT_RENDER_FIELD_ORDER = [
    'text', 'location', 'size', 'color', 'font', 'appearance_details'
];

function sortObjectKeys(obj, order) {
    const ordered = {};
    for (const key of order) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            ordered[key] = obj[key];
        }
    }
    for (const key of Object.keys(obj)) {
        if (!Object.prototype.hasOwnProperty.call(ordered, key)) {
            ordered[key] = obj[key];
        }
    }
    return ordered;
}

export function transformStructuredPrompt(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data;

    const knownSections = new Set(SP_SECTION_ORDER.filter(k => k !== 'general'));
    const general = {};
    const sections = {};

    for (const [key, value] of Object.entries(data)) {
        if (knownSections.has(key)) {
            sections[key] = value;
        } else {
            general[key] = value;
        }
    }

    const result = {};
    for (const sectionKey of SP_SECTION_ORDER) {
        const label = SP_SECTION_LABELS[sectionKey] || sectionKey;
        if (sectionKey === 'general' && Object.keys(general).length > 0) {
            result[label] = general;
        } else if (sections[sectionKey] !== undefined) {
            result[label] = sections[sectionKey];
        }
    }

    return result;
}

/**
 * A reusable Class for rendering an interactive, editable tree of a JSON object.
 */
export class JsonEditor {
    /**
     * @param {HTMLElement} container DOM element to render inside
     * @param {Object} options Configuration
     * @param {boolean} options.readonly True to disable inline editing
     * @param {function} options.onChange Callback fired whenever a leaf node is updated: (newData) => {}
     * @param {string[]} options.highlightPaths Array of dot-path strings to highlight
     */
    constructor(container, options = {}) {
        this.container = container;
        this.data = null;
        this.readonly = options.readonly || false;
        this.onChange = options.onChange || null;
        this.highlightPaths = options.highlightPaths || [];
        this.expandedStates = new Set(); // Store expanded path keys
    }

    /**
     * Load new data and re-render.
     */
    setData(newData) {
        // Deep copy to prevent accidental reference mutation before onChange
        this.data = JSON.parse(JSON.stringify(newData));
        this.render();
    }

    /**
     * Apply an edit and emit to parent.
     */
    applyEdit(pathArray, newValue) {
        if (this.readonly) return;
        
        // Traverse to parent object / array
        let target = this.data;
        for (let i = 0; i < pathArray.length - 1; i++) {
            target = target[pathArray[i]];
        }
        
        const lastKey = pathArray[pathArray.length - 1];
        
        // Only update if changed
        if (target[lastKey] !== newValue) {
            target[lastKey] = newValue;
            if (this.onChange) {
                // emit a deeply cloned copy
                this.onChange(JSON.parse(JSON.stringify(this.data)));
            }
        }
    }

    render() {
        this.container.innerHTML = '';
        if (!this.data) return;

        const tree = document.createElement('div');
        tree.className = 'json-tree json-editor';

        const changedSet = new Set(this.highlightPaths);
        const ancestorSet = new Set();
        for (const p of this.highlightPaths) {
            const parts = p.split('.');
            for (let i = 1; i < parts.length; i++) {
                ancestorSet.add(parts.slice(0, i).join('.'));
            }
        }

        const getSortOrder = (pathStr) => {
            const lower = pathStr.toLowerCase();
            if (lower.startsWith('objects.') || lower === 'objects') return OBJECT_FIELD_ORDER;
            if (lower.startsWith('text render.') || lower === 'text render') return TEXT_RENDER_FIELD_ORDER;
            return null;
        };

        const createNode = (key, value, level, pathArray) => {
            const currentPathArray = [...pathArray, key];
            const fullPathStr = currentPathArray.join('.');
            const isChanged = changedSet.has(fullPathStr);
            const isAncestor = ancestorSet.has(fullPathStr);

            // Default auto-expand top 2 levels if not explicitly registered
            if (level < 2 && !this.expandedStates.has(fullPathStr)) {
                // we don't strictly add it to the Set to allow collapsing it, but we start it open
            }

            // ---- OBJECT ----
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                const sortOrder = getSortOrder(fullPathStr);
                const sortedValue = sortOrder ? sortObjectKeys(value, sortOrder) : value;

                return this._buildCollapsible(key, '{', '}', level, fullPathStr, isAncestor || isChanged, () => {
                    const children = document.createElement('div');
                    children.className = 'tree-children';
                    Object.entries(sortedValue).forEach(([k, v]) => {
                        children.appendChild(createNode(k, v, level + 1, currentPathArray));
                    });
                    return children;
                });
            }

            // ---- ARRAY ----
            if (Array.isArray(value)) {
                return this._buildCollapsible(key, '[', ']', level, fullPathStr, isAncestor || isChanged, () => {
                    const children = document.createElement('div');
                    children.className = 'tree-children';
                    value.forEach((v, i) => {
                        children.appendChild(createNode(i, v, level + 1, currentPathArray));
                    });
                    return children;
                });
            }

            // ---- PRIMITIVE (Leaf Editor) ----
            const item = document.createElement('div');
            item.className = 'tree-item tree-leaf';
            if (isChanged) item.classList.add('highlight-diff-changed');
            else if (isAncestor) item.classList.add('highlight-diff-ancestor');

            const indent = document.createElement('span');
            indent.className = 'tree-indent';
            indent.style.width = `${level * 16}px`;

            const keySpan = document.createElement('span');
            keySpan.className = 'tree-key';
            keySpan.textContent = key + ': ';

            item.appendChild(indent);
            item.appendChild(keySpan);

            const type = value === null ? 'null' : typeof value;
            
            if (this.readonly || type === 'boolean' || type === 'null') {
                const valueSpan = document.createElement('span');
                valueSpan.className = `tree-value tree-value-${type}`;
                valueSpan.textContent = JSON.stringify(value);
                item.appendChild(valueSpan);
            } else {
                // Interactive Edit Mode for strings and numbers
                const valueWrapper = document.createElement('div');
                valueWrapper.className = 'tree-edit-wrapper';
                
                // Flexible textarea for long strings
                const input = document.createElement('textarea');
                input.className = 'tree-edit-input';
                input.value = value;
                input.rows = 1;
                // Auto-expand height
                const resizeTextarea = () => {
                    input.style.height = 'auto';
                    input.style.height = (input.scrollHeight) + 'px';
                };
                
                input.addEventListener('input', resizeTextarea);
                // Trigger resize once mounted
                setTimeout(resizeTextarea, 0);

                input.addEventListener('blur', () => {
                   let nextVal = input.value;
                   if (type === 'number') {
                       const parsed = parseFloat(input.value);
                       if (!isNaN(parsed)) nextVal = parsed;
                   }
                   this.applyEdit(currentPathArray, nextVal);
                });

                // Catch enter key to save and blur (if it's a short value, but since it's textarea, shift+enter for newline)
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        input.blur();
                    }
                });

                valueWrapper.appendChild(input);
                item.appendChild(valueWrapper);
            }

            return item;
        };

        if (Array.isArray(this.data)) {
            this.data.forEach((v, i) => tree.appendChild(createNode(i, v, 0, [i])));
        } else if (typeof this.data === 'object') {
            Object.entries(this.data).forEach(([k, v]) => tree.appendChild(createNode(k, v, 0, [k])));
        }

        this.container.appendChild(tree);
    }

    _buildCollapsible(key, openBracket, closeBracket, level, fullPathStr, isHighlighted, buildChildren) {
        const item = document.createElement('div');
        item.className = 'tree-item';
        if (isHighlighted) item.classList.add('highlight-diff-ancestor');

        const indent = document.createElement('span');
        indent.className = 'tree-indent';
        indent.style.width = `${level * 16}px`;

        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        
        // Auto-expand top 2 levels
        const isCollapsed = this.expandedStates.has(fullPathStr + '_closed');
        toggle.textContent = isCollapsed ? '▶' : '▼';

        const keySpan = document.createElement('span');
        keySpan.className = 'tree-key';
        keySpan.textContent = key + ': ';

        const bracket = document.createElement('span');
        bracket.className = 'tree-bracket';
        bracket.textContent = openBracket;

        item.appendChild(indent);
        item.appendChild(toggle);
        item.appendChild(keySpan);
        item.appendChild(bracket);

        const children = buildChildren();
        if (isCollapsed) children.classList.add('hidden');

        toggle.onclick = () => {
            const closing = children.classList.toggle('hidden');
            toggle.textContent = closing ? '▶' : '▼';
            if (closing) {
                this.expandedStates.add(fullPathStr + '_closed');
            } else {
                this.expandedStates.delete(fullPathStr + '_closed');
            }
        };

        const closingItem = document.createElement('div');
        closingItem.className = 'tree-closing';

        const closeIndent = document.createElement('span');
        closeIndent.className = 'tree-indent';
        closeIndent.style.width = `${level * 16}px`;
        closingItem.appendChild(closeIndent);
        closingItem.appendChild(document.createTextNode(closeBracket));

        const fragment = document.createDocumentFragment();
        fragment.appendChild(item);
        fragment.appendChild(children);
        fragment.appendChild(closingItem);
        return fragment;
    }
}
