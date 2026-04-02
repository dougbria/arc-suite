const IDB_NAME = 'arc-data-storage';
const IDB_STORE = 'handles';
const HANDLE_KEY = 'root-database-dir';

// ---- IndexedDB helpers ----
function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbGet(key) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
    });
}

async function idbSet(key, value) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ---- Permission helper ----
async function verifyPermission(handle) {
    const opts = { mode: 'readwrite' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if ((await handle.requestPermission(opts)) === 'granted') return true;
    return false;
}

export class DataService {
    constructor(appName) {
        this.appName = appName || 'core';
        /** @type {FileSystemDirectoryHandle|null} */
        this.rootDir = null;
    }

    isSupported() {
        return 'showDirectoryPicker' in window;
    }

    async restore() {
        try {
            const handle = await idbGet(HANDLE_KEY);
            if (!handle) return false;
            const ok = await verifyPermission(handle);
            if (ok) { this.rootDir = handle; return true; }
            return false;
        } catch (e) {
            console.warn('[DataService] restore failed:', e);
            return false;
        }
    }

    async pickDatabaseFolder() {
        try {
            const handle = await window.showDirectoryPicker({
                id: 'arc-database-root',
                mode: 'readwrite',
                startIn: 'documents'
            });
            await idbSet(HANDLE_KEY, handle);
            this.rootDir = handle;
            return true;
        } catch (e) {
            return false;
        }
    }

    async _getDir(pathParts) {
        if (!this.rootDir) throw new Error("DataService not initialized/connected");
        let current = this.rootDir;
        // Automatically create 'database' root folder if it doesn't exist
        current = await current.getDirectoryHandle('database', { create: true });
        for (const part of pathParts) {
            current = await current.getDirectoryHandle(part, { create: true });
        }
        return current;
    }

    async _readJson(dirHandle, filename) {
        try {
            const fh = await dirHandle.getFileHandle(filename);
            const file = await fh.getFile();
            const text = await file.text();
            return JSON.parse(text);
        } catch {
            return null;
        }
    }

    async _writeJson(dirHandle, filename, data) {
        const fh = await dirHandle.getFileHandle(filename, { create: true });
        const w = await fh.createWritable();
        await w.write(JSON.stringify(data, null, 2));
        await w.close();
    }

    async _listDirFiles(dirHandle, ext = '.json') {
        const results = [];
        for await (const [name, handle] of dirHandle.entries()) {
            if (handle.kind === 'file' && name.endsWith(ext)) {
                const data = await this._readJson(dirHandle, name);
                if (data) results.push(data);
            }
        }
        return results;
    }

    // ---- Workspaces ----
    async saveWorkspace(workspace) {
        const dir = await this._getDir(['workspaces', this.appName]);
        await this._writeJson(dir, `${workspace.id}.json`, workspace);
    }
    
    async getWorkspace(id) {
        const dir = await this._getDir(['workspaces', this.appName]);
        return await this._readJson(dir, `${id}.json`);
    }

    async listWorkspaces() {
        const dir = await this._getDir(['workspaces', this.appName]);
        return await this._listDirFiles(dir);
    }

    async deleteWorkspace(id) {
        try {
            const dir = await this._getDir(['workspaces', this.appName]);
            await dir.removeEntry(`${id}.json`);
        } catch(e) { console.warn("Delete workspace failed", e); }
    }

    // ---- Characters ----
    async saveCharacter(character) {
        const dir = await this._getDir(['entities', 'characters']);
        // Store metadata like originApp, lastModifiedBy if not present
        character.originApp = character.originApp || this.appName;
        character.lastModifiedBy = this.appName;
        await this._writeJson(dir, `${character.id}.json`, character);
    }

    async listCharacters() {
        const dir = await this._getDir(['entities', 'characters']);
        return await this._listDirFiles(dir);
    }

    async getCharacter(id) {
        try {
            const dir = await this._getDir(['entities', 'characters']);
            return await this._readJson(dir, `${id}.json`);
        } catch { return null; }
    }

    // ---- Locations ----
    async saveLocation(location) {
        const dir = await this._getDir(['entities', 'locations']);
        location.originApp = location.originApp || this.appName;
        location.lastModifiedBy = this.appName;
        await this._writeJson(dir, `${location.id}.json`, location);
    }

    async listLocations() {
        const dir = await this._getDir(['entities', 'locations']);
        return await this._listDirFiles(dir);
    }

    async getLocation(id) {
        try {
            const dir = await this._getDir(['entities', 'locations']);
            return await this._readJson(dir, `${id}.json`);
        } catch { return null; }
    }

    // ---- Images ----
    async saveImage(imgMetadata, base64) {
        const dir = await this._getDir(['images', imgMetadata.id]);
        imgMetadata.originApp = imgMetadata.originApp || this.appName;
        await this._writeJson(dir, 'metadata.json', imgMetadata);

        if (base64) {
            const raw = base64.replace(/^data:image\/\w+;base64,/, '');
            const binary = atob(raw);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const fh = await dir.getFileHandle(`${imgMetadata.id}.png`, { create: true });
            const w = await fh.createWritable();
            await w.write(new Blob([bytes], { type: 'image/png' }));
            await w.close();
        }
    }

    async getImageMetadata(id) {
        try {
            const dir = await this._getDir(['images', id]);
            return await this._readJson(dir, 'metadata.json');
        } catch { return null; }
    }

    async getImageBase64(id) {
        try {
            const dir = await this._getDir(['images', id]);
            const fh = await dir.getFileHandle(`${id}.png`);
            const file = await fh.getFile();
            return new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            });
        } catch { return null; }
    }
}
