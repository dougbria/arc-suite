export class UIHooks {
    constructor() {
        this.contextButtons = [];
        this.preflightInterceptors = [];
    }

    addContextButton(label, callback) {
        this.contextButtons.push({ label, callback });
        // Dispatch event so UI can re-render HUD
        window.dispatchEvent(new CustomEvent('arc-core:context-buttons-updated', {
            detail: this.contextButtons
        }));
    }

    addPreflightInterceptor(callback) {
        this.preflightInterceptors.push(callback);
    }

    async runPreflightInterceptors(payload) {
        let currentPayload = { ...payload };
        for (const interceptor of this.preflightInterceptors) {
            currentPayload = await interceptor(currentPayload);
        }
        return currentPayload;
    }

    renderContextButtons(container) {
        container.innerHTML = '';
        this.contextButtons.forEach(btnDef => {
            const btn = document.createElement('button');
            btn.textContent = btnDef.label;
            btn.className = 'arc-context-btn';
            btn.onclick = () => btnDef.callback();
            container.appendChild(btn);
        });
    }
}
