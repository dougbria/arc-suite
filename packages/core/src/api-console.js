import state from './state.js';

class ApiConsole {
    constructor() {
        this.isOpen = false;
        this.element = null;
        this.logsList = null;
    }

    init() {
        if (this.element) return;
        this.createDOM();
        this.attachListeners();
        state.on('logsChanged', () => this.renderLogs());
    }

    createDOM() {
        this.element = document.createElement('div');
        this.element.id = 'arc-global-api-console';
        this.element.innerHTML = `
            <style>
                #arc-global-api-console {
                    position: fixed;
                    right: 20px;
                    bottom: 20px;
                    width: 450px;
                    height: 600px;
                    max-height: 80vh;
                    background: var(--bg-surface, #1e1e24);
                    border: 1px solid var(--border-color, #333);
                    border-radius: 8px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    display: flex;
                    flex-direction: column;
                    z-index: 9999;
                    font-family: var(--font-primary, sans-serif);
                    transition: transform 0.2s ease, opacity 0.2s ease;
                    transform: translateY(20px);
                    opacity: 0;
                    pointer-events: none;
                }
                #arc-global-api-console.open {
                    transform: translateY(0);
                    opacity: 1;
                    pointer-events: auto;
                }
                .arc-console-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    background: var(--bg-surface-hover, #2a2a32);
                    border-bottom: 1px solid var(--border-color, #333);
                    border-radius: 8px 8px 0 0;
                    font-weight: 600;
                    font-size: 14px;
                    color: var(--text-primary, #fff);
                }
                .arc-console-header-actions button {
                    background: none;
                    border: 1px solid var(--border-color, #333);
                    color: var(--text-secondary, #aaa);
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-left: 8px;
                    font-size: 12px;
                }
                .arc-console-header-actions button:hover {
                    background: var(--bg-hover, #444);
                    color: var(--text-primary, #fff);
                }
                .arc-console-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .arc-log-entry {
                    background: rgba(0,0,0,0.2);
                    border: 1px solid var(--border-color, #333);
                    border-radius: 6px;
                    padding: 8px;
                    font-family: monospace;
                    font-size: 11px;
                    color: var(--text-secondary, #ccc);
                }
                .arc-log-meta {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 6px;
                    flex-wrap: wrap;
                }
                .arc-log-source {
                    color: #a855f7;
                    font-weight: bold;
                }
                .arc-log-time { color: #888; }
                .arc-log-type { padding: 2px 6px; border-radius: 4px; font-weight: bold; background: #333; }
                .arc-log-type.response { color: #4ade80; }
                .arc-log-type.error { color: #f87171; }
                .arc-log-type.request { color: #60a5fa; }
                .arc-log-json {
                    margin: 0;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    overflow-x: hidden;
                    max-height: 150px;
                    overflow-y: auto;
                }
            </style>
            <div class="arc-console-header">
                <div>API Console</div>
                <div class="arc-console-header-actions">
                    <button id="arc-console-export-btn">Export</button>
                    <button id="arc-console-clear-btn">Clear</button>
                    <button id="arc-console-close-btn">✕</button>
                </div>
            </div>
            <div class="arc-console-body" id="arc-console-list"></div>
        `;
        document.body.appendChild(this.element);
        this.logsList = document.getElementById('arc-console-list');
    }

    attachListeners() {
        document.getElementById('arc-console-close-btn').addEventListener('click', () => this.close());
        document.getElementById('arc-console-clear-btn').addEventListener('click', () => state.clearLogs());
        document.getElementById('arc-console-export-btn').addEventListener('click', () => this.exportLogs());
    }

    toggle() {
        if (!this.element) this.init();
        this.isOpen = !this.isOpen;
        this.element.classList.toggle('open', this.isOpen);
        if (this.isOpen) {
            this.renderLogs();
        }
    }

    open() {
        if (!this.element) this.init();
        this.isOpen = true;
        this.element.classList.add('open');
        this.renderLogs();
    }

    close() {
        this.isOpen = false;
        this.element?.classList.remove('open');
    }

    exportLogs() {
        const text = state.logs.map(log => {
            const time = new Date(log.timestamp).toISOString();
            const source = log.source || 'Bria API';
            const type = log.type || 'INFO';
            let str = `[${time}] [${source}] [${type}] ${log.endpoint || ''}\n`;
            if (log.message) str += `${log.message}\n`;
            if (log.request) str += `REQ: ${JSON.stringify(log.request, null, 2)}\n`;
            if (log.response) str += `RES: ${JSON.stringify(log.response, null, 2)}\n`;
            if (log.error) str += `ERR: ${JSON.stringify(log.error, null, 2)}\n`;
            return str;
        }).join('\n=================================\n\n');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `api_logs_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    renderLogs() {
        if (!this.isOpen || !this.logsList) return;
        this.logsList.innerHTML = '';

        if (!state.logs || state.logs.length === 0) {
            this.logsList.innerHTML = '<div style="color: #888; font-style: italic; text-align: center; margin-top: 20px;">No logs yet...</div>';
            return;
        }

        state.logs.forEach(log => {
            const entry = document.createElement('div');
            entry.className = 'arc-log-entry';

            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            const typeClass = (log.type || 'info').toLowerCase();
            const source = log.source || 'Bria API'; // Default assumption for legacy logs

            let detailsHtml = '';
            if (log.request) detailsHtml += `<pre class="arc-log-json">REQ: ${JSON.stringify(log.request, null, 2)}</pre>`;
            if (log.response) detailsHtml += `<pre class="arc-log-json">RES: ${JSON.stringify(log.response, null, 2)}</pre>`;
            if (log.error) detailsHtml += `<pre class="arc-log-json">ERR: ${JSON.stringify(log.error, null, 2)}</pre>`;
            if (log.message) detailsHtml += `<div style="margin-top: 4px;">${log.message}</div>`;

            entry.innerHTML = `
                <div class="arc-log-meta">
                    <span class="arc-log-time">[${timestamp}]</span>
                    <span class="arc-log-source">${source}</span>
                    <span class="arc-log-type ${typeClass}">${log.type || 'INFO'}</span>
                    <span>${log.endpoint || ''}</span>
                </div>
                ${detailsHtml}
            `;
            this.logsList.appendChild(entry);
        });
    }
}

export const apiConsole = new ApiConsole();
window.arcApiConsole = apiConsole;
