/**
 * Nested Card style JSON Editor for VGL Studio.
 * Handles nested objects using glassmorphism-style grouping cards instead of indents.
 */

const SP_SECTION_ORDER = [
    'general',
    'objects',
    'lighting',
    'aesthetics',
    'photographic_characteristics',
    'text_render'
];

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
        if (sectionKey === 'general' && Object.keys(general).length > 0) {
            result[sectionKey] = sortObjectKeys(general, Object.keys(general)); // Keep sorted
        } else if (sections[sectionKey] !== undefined) {
            result[sectionKey] = sections[sectionKey];
        }
    }

    return result;
}

export function untransformStructuredPrompt(transformed) {
    if (!transformed || typeof transformed !== 'object' || Array.isArray(transformed)) return transformed;
    const flat = {};
    for (const [key, value] of Object.entries(transformed)) {
        if (key === 'general' && typeof value === 'object' && !Array.isArray(value)) {
            for (const [gKey, gVal] of Object.entries(value)) {
                flat[gKey] = gVal;
            }
        } else {
            flat[key] = value;
        }
    }
    return flat;
}
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

export function highlightRawJson(obj, diffPathsArray) {
    if (!obj) return '';
    const diffPaths = new Set(diffPathsArray || []);
    let indentLevel = 0;
    const indentStr = '  ';

    function walk(val, pathArr) {
        const fullPath = pathArr.join('.');
        const isChanged = diffPaths.has(fullPath);
        
        // Wrap diffs in an amber block
        const startDiff = isChanged ? `<span style="background: rgba(255,170,0,0.15); display: inline-block;">` : '';
        const endDiff = isChanged ? `</span>` : '';

        if (val === null) return `${startDiff}<span style="color:#6b7280;">null</span>${endDiff}`;
        if (typeof val === 'string') return `${startDiff}<span style="color:#34d399;">"${val.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"</span>${endDiff}`;
        if (typeof val === 'number') return `${startDiff}<span style="color:#fbbf24;">${val}</span>${endDiff}`;
        if (typeof val === 'boolean') return `${startDiff}<span style="color:#60a5fa;">${val}</span>${endDiff}`;

        if (Array.isArray(val)) {
            if (val.length === 0) return '[]';
            indentLevel++;
            let result = '[\n';
            val.forEach((item, i) => {
                const prefix = indentStr.repeat(indentLevel);
                result += `${prefix}${walk(item, [...pathArr, i])}${i < val.length - 1 ? ',' : ''}\n`;
            });
            indentLevel--;
            result += indentStr.repeat(indentLevel) + ']';
            return result;
        }

        if (typeof val === 'object') {
            const keys = Object.keys(val);
            if (keys.length === 0) return '{}';
            indentLevel++;
            let result = '{\n';
            keys.forEach((k, i) => {
                const prefix = indentStr.repeat(indentLevel);
                const currentPath = [...pathArr, k];
                const keyHtml = `<span style="color:#a78bfa;">"${k}"</span>`;
                result += `${prefix}${keyHtml}: ${walk(val[k], currentPath)}${i < Object.keys(val).length - 1 ? ',' : ''}\n`;
            });
            indentLevel--;
            result += indentStr.repeat(indentLevel) + '}';
            return result;
        }
        return String(val);
    }
    
    return walk(obj, []);
}

export function highlightRawString(rawStr) {
    if (!rawStr) return '';
    return rawStr
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            let color = '#fbbf24';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    color = '#a78bfa'; // key
                } else {
                    color = '#34d399'; // string
                }
            } else if (/true|false/.test(match)) {
                color = '#60a5fa'; // boolean
            } else if (/null/.test(match)) {
                color = '#6b7280'; // null
            }
            return '<span style="color:' + color + ';">' + match + '</span>';
        });
}

const OBJECT_FIELD_ORDER = [
    'description', 'location', 'relative_size', 'shape_and_color',
    'texture', 'appearance_details', 'relationship', 'orientation',
    'pose', 'expression', 'clothing', 'action', 'gender',
    'skin_tone_and_texture', 'number_of_objects'
];

const TEXT_RENDER_FIELD_ORDER = [
    'text', 'location', 'size', 'color', 'font', 'appearance_details'
];

/**
 * Renders nested cards for JSON data.
 */
export class CardJsonEditor {
    constructor(container, options = {}) {
        this.container = container;
        this.data = null;
        this.readonly = options.readonly || false;
        this.onChange = options.onChange || null;
        this.highlightPaths = options.highlightPaths || [];
        this.expandedStates = new Set();
    }

    setData(newData) {
        this.data = JSON.parse(JSON.stringify(newData));
        this.render();
    }

    applyEdit(pathArray, newValue) {
        if (this.readonly) return;
        
        let target = this.data;
        for (let i = 0; i < pathArray.length - 1; i++) {
            target = target[pathArray[i]];
        }
        
        const lastKey = pathArray[pathArray.length - 1];
        if (target[lastKey] !== newValue) {
            target[lastKey] = newValue;
            if (this.onChange) {
                this.onChange(JSON.parse(JSON.stringify(this.data)));
            }
        }
    }

    render() {
        this.container.innerHTML = '';
        if (!this.data) return;

        const editorRoot = document.createElement('div');
        editorRoot.className = 'json-card-editor';

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

            // ---- OBJECT or ARRAY ----
            if (typeof value === 'object' && value !== null) {
                const isArray = Array.isArray(value);
                const sortOrder = !isArray ? getSortOrder(fullPathStr) : null;
                const sortedValue = sortOrder ? sortObjectKeys(value, sortOrder) : value;

                return this._buildCardGroup(key, level, fullPathStr, isAncestor || isChanged, () => {
                    const children = document.createElement('div');
                    children.className = 'card-children';
                    const entries = isArray ? value.map((v, i) => [i, v]) : Object.entries(sortedValue);
                    
                    entries.forEach(([k, v]) => {
                        children.appendChild(createNode(k, v, level + 1, currentPathArray));
                    });
                    return children;
                });
            }

            // ---- PRIMITIVE (Leaf Editor) ----
            const item = document.createElement('div');
            item.className = 'card-leaf';
            if (isChanged) item.classList.add('highlight-card-changed');
            else if (isAncestor) item.classList.add('highlight-card-ancestor');

            const keySpan = document.createElement('div');
            keySpan.className = 'card-leaf-key';
            keySpan.textContent = isNaN(key) ? key.replace(/_/g, ' ') : `Item ${key}`;

            item.appendChild(keySpan);

            const type = value === null ? 'null' : typeof value;
            
            if (this.readonly || type === 'boolean' || type === 'null') {
                const valueSpan = document.createElement('div');
                valueSpan.className = `card-leaf-value card-value-${type}`;
                valueSpan.textContent = JSON.stringify(value);
                item.appendChild(valueSpan);
            } else {
                const input = document.createElement('textarea');
                input.className = 'card-edit-input';
                input.value = value;
                input.rows = 1;
                
                const resizeTextarea = () => {
                    input.style.height = '0px';
                    input.style.height = input.scrollHeight + (input.offsetHeight - input.clientHeight) + 'px';
                };
                
                input.addEventListener('input', resizeTextarea);
                
                let lastWidth = 0;
                if (window.ResizeObserver) {
                    const ro = new ResizeObserver((entries) => {
                        for (let entry of entries) {
                            if (entry.contentRect.width !== lastWidth) {
                                lastWidth = entry.contentRect.width;
                                resizeTextarea();
                            }
                        }
                    });
                    ro.observe(input);
                } else {
                    setTimeout(resizeTextarea, 0);
                }

                input.addEventListener('blur', () => {
                   let nextVal = input.value;
                   if (type === 'number') {
                       const parsed = parseFloat(input.value);
                       if (!isNaN(parsed)) nextVal = parsed;
                   }
                   this.applyEdit(currentPathArray, nextVal);
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        input.blur();
                    }
                });

                item.appendChild(input);
            }

            return item;
        };

        if (Array.isArray(this.data)) {
            this.data.forEach((v, i) => editorRoot.appendChild(createNode(i, v, 0, [])));
        } else if (typeof this.data === 'object') {
            Object.entries(this.data).forEach(([k, v]) => editorRoot.appendChild(createNode(k, v, 0, [])));
        }

        this.container.appendChild(editorRoot);
    }

    _buildCardGroup(key, level, fullPathStr, isHighlighted, buildChildren) {
        const card = document.createElement('div');
        card.className = `card-group level-${level}`;
        if (isHighlighted) card.classList.add('highlight-card-ancestor');

        const header = document.createElement('div');
        header.className = 'card-header';
        
        const isCollapsed = this.expandedStates.has(fullPathStr + '_closed');
        const icon = document.createElement('span');
        icon.className = 'card-toggle-icon';
        icon.innerHTML = isCollapsed ? `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        ` : `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        `;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'card-title';
        if (!isNaN(key)) {
            titleSpan.classList.add('card-title-array');
            titleSpan.textContent = `Item ${parseInt(key) + 1}`;
        } else {
            titleSpan.textContent = key.replace(/_/g, ' ');
        }

        header.appendChild(icon);
        header.appendChild(titleSpan);
        card.appendChild(header);

        const children = buildChildren();
        if (isCollapsed) children.classList.add('hidden');

        header.onclick = () => {
            const closing = children.classList.toggle('hidden');
            icon.innerHTML = closing ? `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            ` : `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            `;
            
            if (closing) {
                this.expandedStates.add(fullPathStr + '_closed');
            } else {
                this.expandedStates.delete(fullPathStr + '_closed');
            }
        };

        card.appendChild(children);
        return card;
    }
}
