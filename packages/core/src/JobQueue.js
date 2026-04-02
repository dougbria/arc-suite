export class JobQueue {
    constructor() {
        this.jobs = new Map();
        this.listeners = new Set();
    }

    /**
     * Subscribe to job updates
     * @param {Function} callback - fn(jobId, status, payload)
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    _emit(jobId, status, payload) {
        this.listeners.forEach(cb => cb(jobId, status, payload));
    }

    /**
     * Start a new async job which expects a 202 Accepted and polls
     * @param {string} jobId 
     * @param {Function} apiCall - fn that initiates and returns polling URL
     * @param {Function} pollCall - fn(url) that returns { status: 'done'|'running'|'failed', result: any }
     */
    async enqueue(jobId, apiCall, pollCall) {
        this.jobs.set(jobId, { status: 'starting' });
        this._emit(jobId, 'starting', null);

        try {
            const pollUrl = await apiCall();
            this.jobs.set(jobId, { status: 'polling', pollUrl });
            this._emit(jobId, 'polling', null);
            this._startPolling(jobId, pollUrl, pollCall);
        } catch (error) {
            this.jobs.set(jobId, { status: 'failed', error });
            this._emit(jobId, 'failed', { error });
        }
    }

    async _startPolling(jobId, pollUrl, pollCall) {
        const check = async () => {
            try {
                const res = await pollCall(pollUrl);
                if (res.status === 'done') {
                    this.jobs.set(jobId, { status: 'done', result: res.result });
                    this._emit(jobId, 'done', { result: res.result });
                } else if (res.status === 'failed') {
                    this.jobs.set(jobId, { status: 'failed', error: res.error });
                    this._emit(jobId, 'failed', { error: res.error });
                } else {
                    // Still running, repeat
                    setTimeout(check, 2000);
                }
            } catch (error) {
                this.jobs.set(jobId, { status: 'failed', error });
                this._emit(jobId, 'failed', { error });
            }
        };
        setTimeout(check, 2000);
    }
}
