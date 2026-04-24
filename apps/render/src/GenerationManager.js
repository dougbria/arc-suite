import { api, Utils, Canvas, Layout } from '@arc/core';
const { createThumbnail, showToast, generateUUID } = Utils;
const { layoutManager } = Layout;

const SP_REQUIRED_KEYS = [
    'general',
    'objects',
    'lighting',
    'aesthetics',
    'photographic_characteristics'
];

function parseAsStructuredPrompt(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const hasAllRequired = SP_REQUIRED_KEYS.every(k => Object.prototype.hasOwnProperty.call(parsed, k));
        return hasAllRequired ? parsed : null;
    } catch {
        return null;
    }
}

export class GenerationManager {
    constructor(state, uiElements) {
        this.state = state;
        this.ui = uiElements;
        this.abortControllers = {};
    }

    getGenerationOptions() {
        // Fallback for lite mode toggle
        const isLite = this.ui.liteQuickBtn ? this.ui.liteQuickBtn.classList.contains('active') : !!this.ui.liteModeToggle?.checked;
        const ratioText = this.ui.aspectRatioBtn?.textContent.trim();
        return {
            aspect_ratio: ratioText === 'Auto' ? undefined : ratioText,
            resolution: this.ui.resolutionSelect?.value === '4MP' ? '4MP' : undefined,
            negative_prompt: this.ui.negativePromptInput?.value.trim() || undefined,
            lite: isLite,
            mod_content: !!this.ui.modContentToggle?.checked,
            mod_input: !!this.ui.modInputToggle?.checked,
            mod_output: !!this.ui.modOutputToggle?.checked,
            ip_signal: !!this.ui.ipSignalToggle?.checked
        };
    }

    async handleAction(mode, uploadedImageBase64) {
        // CAPTURE CONTEXT SYNCHRONOUSLY BEFORE ANY AWAITS
        const initialProjectId = this.state.activeProjectId;

        const prompt = this.ui.promptInput.value.trim();
        const hasApiKey = !!this.state.getApiKey();

        if (!hasApiKey) {
            if (this.ui.settingsDialog) {
                this.ui.settingsDialog.showModal();
            } else {
                showToast('Bria API Token is missing. Open Settings to add it.');
            }
            return;
        }

        if (!prompt && mode !== 'expand') {
            showToast('Please enter a prompt or instructions.');
            this.ui.promptInput.focus();
            return;
        }

        const countText = this.ui.imageCountBtn?.textContent.trim();
        const imageCount = countText ? parseInt(countText, 10) : 1;
        const options = this.getGenerationOptions();
        const seedValue = this.ui.seedInput?.value.trim();
        const seed = seedValue ? parseInt(seedValue, 10) : null;

        console.log(`[handleAction] START - Mode: ${mode}, Count: ${imageCount}, Prompt: "${prompt}"`, options);

        try {
            const featured = this.state.getFeaturedImage();

            if ((mode === 'refine' || mode === 'edit') && !featured && !uploadedImageBase64) {
                showToast(`Please select an image in the gallery to ${mode}.`);
                return;
            }

            if (this.ui.previewSpCheckbox?.checked && (mode === 'generate' || mode === 'edit' || mode === 'refine')) {
                console.log('[handleAction] Redirecting to Preview SP');
                await this.handleStructuredPromptPreview(prompt, imageCount, options, mode, uploadedImageBase64);
                return;
            }

            let editImage = uploadedImageBase64 || ((mode === 'edit' || mode === 'expand') ? featured?.base64 : null);
            let parentImageId = (mode === 'refine' || mode === 'edit' || mode === 'expand') ? featured?.id : null;
            if (mode === 'generate' && this.state.pushedLineageId && this.ui.previewSpCheckbox?.checked) {
                parentImageId = this.state.pushedLineageId;
            }
            let batchId = generateUUID();
            
            this.state.lastPrompt = prompt;
            this.state.lastMode = mode;
            this.state.clearError();
            this.state.setLoading(true, 'Initializing...', initialProjectId);
            this.abortControllers[initialProjectId] = new AbortController();
            this.state.emit('generationStarted');

            let blendImagesBase64 = [];
            let compositeB64 = null;
            if (mode === 'blend') {
                if (this.state.canvasMode === 'layout') {
                    this.state.setLoading(true, 'Capturing layout canvas…', initialProjectId);
                    compositeB64 = layoutManager.exportCompositeBase64();
                    if (!compositeB64) throw new Error('Could not capture layout canvas.');
                    
                    // Switch to view mode to clear the sprites from screen
                    this.state.setCanvasMode('view');
                } else {
                    for (const id of this.state.selectedImageIds) {
                        if (this.abortControllers[initialProjectId].signal.aborted) throw new Error('Aborted');
                        const b64 = await this.state.resolveImageBase64(id);
                        if (b64) blendImagesBase64.push(b64);
                    }
                    
                    if (this.abortControllers[initialProjectId].signal.aborted) throw new Error('Aborted');
                    this.state.setLoading(true, 'Creating composite image…', initialProjectId);
                    compositeB64 = await createCompositeImage(blendImagesBase64);
                }
                
                if (this.abortControllers[initialProjectId].signal.aborted) throw new Error('Aborted');
                const thumb = await createThumbnail(compositeB64, 200);
                const baseBgId = this.state.featuredImageId;
                const refImg = await this.state.addImage({
                    base64: compositeB64,
                    thumbnail: thumb,
                    isReference: true
                }, 'Blend Composite', 'composite', batchId, baseBgId, initialProjectId);
                parentImageId = refImg.id;
            }

            if (mode === 'edit' && uploadedImageBase64) {
                this.state.setLoading(true, 'Registering upload…', initialProjectId);
                const thumb = await createThumbnail(uploadedImageBase64, 200);
                const refImg = await this.state.addImage({
                    base64: uploadedImageBase64,
                    thumbnail: thumb,
                    isReference: true
                }, prompt, 'upload', batchId, null, initialProjectId);
                parentImageId = refImg.id;
            }

            this.state.setLoading(true, 'Submitting Job...', initialProjectId);

            let expandBounds = null;
            if (mode === 'expand') {
                expandBounds = Canvas.getExpandBounds();
                if (!expandBounds) throw new Error('Could not calculate expand bounds. Are you in expand mode?');
            } else if (mode === 'edit') {
                const maskBase64 = Canvas.getMaskBase64();
                if (maskBase64) options.masks = [maskBase64];
            }

            let batchStructuredPrompt = null;
            if (mode === 'generate') {
                const directSp = parseAsStructuredPrompt(prompt);
                if (directSp) {
                    this.state.setLoading(true, 'Using user-supplied VGL structure...', initialProjectId);
                    showToast('Using structured prompt directly - skipping layout generation.', 3000);
                    batchStructuredPrompt = directSp;
                } else {
                    this.state.setLoading(true, 'Generating VGL from user prompt...', initialProjectId);
                    const spResult = await api.generateStructuredPrompt(prompt, uploadedImageBase64, null, {
                        ...options,
                        signal: this.abortControllers[initialProjectId].signal
                    });
                    batchStructuredPrompt = spResult.structured_prompt;
                    if (!batchStructuredPrompt) throw new Error('Failed to generate structured prompt.');
                }
            } else if (mode === 'refine') {
                this.state.setLoading(true, 'Duplicating source VGL structure for refinement branch…', initialProjectId);
                const rawSp = featured.structured_prompt;
                try {
                    batchStructuredPrompt = typeof rawSp === 'string' ? JSON.parse(rawSp) : rawSp;
                    if (batchStructuredPrompt && typeof batchStructuredPrompt === 'object') {
                        const scrubKeys = ['edit', 'edit_instruction', 'edit instruction', 'edit_instructions', 'instruction'];
                        scrubKeys.forEach(k => {
                            if (k in batchStructuredPrompt) delete batchStructuredPrompt[k];
                        });
                    }
                } catch (e) {
                    batchStructuredPrompt = rawSp;
                }
            } else if (mode === 'edit') {
                this.state.setLoading(true, 'Generating VGL from user edit prompt...', initialProjectId);
                const spResult = await api.generateStructuredPrompt(prompt, editImage, null, {
                    ...options,
                    signal: this.abortControllers[initialProjectId].signal
                });
                batchStructuredPrompt = spResult.structured_prompt;
                if (!batchStructuredPrompt) throw new Error('Failed to generate structured instruction.');
            }

            const baseSeed = seed !== null ? seed : (
                mode === 'edit' ? Math.floor(Math.random() * 2147483647)
                                : (mode === 'refine' && featured ? featured.seed : Math.floor(Math.random() * 2147483647))
            );
            
            this.state.setLoading(true, `Generating [0/${imageCount}]…`, initialProjectId);
            let finishedCount = 0;

            const promises = Array.from({ length: imageCount }, async (_, i) => {
                if (this.abortControllers[initialProjectId]?.signal.aborted) return;

                const currentSeed = baseSeed + i;
                try {
                    let result;
                    switch (mode) {
                        case 'generate':
                        case 'refine':
                            result = await api.generate(prompt, currentSeed, uploadedImageBase64, {
                                ...options,
                                structured_prompt: batchStructuredPrompt,
                                signal: this.abortControllers[initialProjectId].signal
                            });
                            break;
                        case 'edit':
                            result = await api.edit(prompt, editImage, currentSeed, {
                                ...options,
                                structured_instruction: batchStructuredPrompt,
                                signal: this.abortControllers[initialProjectId].signal
                            });
                            break;
                        case 'expand':
                            result = await api.expandImage(editImage, expandBounds, prompt, currentSeed, {
                                ...options,
                                signal: this.abortControllers[initialProjectId].signal
                            });
                            result.structured_prompt = { expand_offset: expandBounds.offset };
                            break;
                        case 'blend':
                            result = await api.blend(prompt, compositeB64, currentSeed, {
                                ...options,
                                signal: this.abortControllers[initialProjectId].signal
                            });
                            break;
                    }
                    const thumbnail = await createThumbnail(result.base64, 200);
                    await this.state.addImage({ ...result, thumbnail }, prompt, mode, batchId, parentImageId, initialProjectId);

                    finishedCount++;
                    this.state.setLoading(true, `Generating [${finishedCount}/${imageCount}]…`, initialProjectId);

                    if (i === 0) this.state.setCanvasLoading(false, initialProjectId);
                } catch (err) {
                    console.error(`[handleAction] Item ${i + 1} failed:`, err);
                    throw err; // Re-throw to accurately mark as rejected in allSettled
                }
            });

            const results = await Promise.allSettled(promises);
            
            const failures = results.filter(r => r.status === 'rejected');
            if (failures.length > 0 && failures.length < imageCount) {
                showToast(`Finished: ${imageCount - failures.length} succeeded, ${failures.length} failed.`);
            } else if (failures.length === imageCount) {
                throw failures[0].reason; // All failed, throw the first error to trigger global catch
            }

            if (mode === 'expand' || mode === 'edit') {
                this.state.setCanvasMode('view');
            }

        } catch (err) {
            const isInterrupt = err.name === 'AbortError' || 
                                err.message === 'Processing interrupted' || 
                                err.message === 'Request cancelled by user.';
                                
            if (isInterrupt) {
                showToast('Generation interrupted');
            } else {
                console.error('[handleAction] ERROR:', err);
                const msg = err.message || 'An unexpected error occurred.';
                this.state.setError(msg);
                showToast('Error: ' + msg);
                if (this.ui.promptInput) this.ui.promptInput.value = this.state.lastPrompt;
            }
        } finally {
            this.state.setLoading(false, null, initialProjectId);
            this.state.emit('generationFinished');
            delete this.abortControllers[initialProjectId];
        }
    }

    async handleStructuredPromptPreview(prompt, imageCount, options, mode, uploadedImageBase64) {
        // CAPTURE CONTEXT SYNCHRONOUSLY BEFORE ANY AWAITS
        const initialProjectId = this.state.activeProjectId;

        this.state.lastPrompt = prompt;
        this.state.clearError();
        this.state.setLoading(true, 'Initializing Custom Preview configuration…', initialProjectId);

        try {
            const featured = this.state.getFeaturedImage();
            let spResult;
            let batchId = generateUUID();
            let parentImageId = (mode === 'refine' || mode === 'edit' || mode === 'expand' ? featured?.id : null);
            if (mode === 'generate' && this.state.pushedLineageId) {
                parentImageId = this.state.pushedLineageId;
            }

            if (mode === 'refine') {
                if (!featured) throw new Error('No image selected to refine.');
                spResult = {
                    structured_prompt: featured.structured_prompt,
                    seed: featured.seed
                };
            } else if (mode === 'edit') {
                const editImage = uploadedImageBase64 || featured?.base64;
                if (!editImage) throw new Error('Upload or select an image for edit.');

                if (uploadedImageBase64) {
                    this.state.setLoading(true, 'Registering upload data…', initialProjectId);
                    const thumb = await createThumbnail(uploadedImageBase64, 200);
                    const refImg = await this.state.addImage({
                        base64: uploadedImageBase64,
                        thumbnail: thumb,
                        isReference: true
                    }, prompt, 'upload', batchId, null, initialProjectId);
                    parentImageId = refImg.id;
                }
                this.state.setLoading(true, 'Generating instruction layout for preview…', initialProjectId);
                spResult = await api.generateStructuredPrompt(prompt, editImage, null, options);
            } else {
                spResult = await api.generateStructuredPrompt(prompt, uploadedImageBase64, null, options);
            }

            this.state.setLoading(false, null, initialProjectId);
            if (!spResult.structured_prompt) throw new Error('No structured prompt returned.');

            const originalSp = spResult.structured_prompt;
            let formatted;
            try {
                const parsed = typeof originalSp === 'string' ? JSON.parse(originalSp) : originalSp;
                formatted = JSON.stringify(parsed, null, 2);
            } catch {
                formatted = originalSp;
            }

            this.ui.spPreviewEditor.value = formatted;
            this.ui.spPreviewDialog.showModal();

            const action = await new Promise((resolve) => {
                const onGen = () => { cleanup(); resolve('generate'); };
                const onCancel = () => { cleanup(); resolve('cancel'); };
                const cleanup = () => {
                    this.ui.spPreviewGenerate.removeEventListener('click', onGen);
                    this.ui.spPreviewCancel.removeEventListener('click', onCancel);
                    this.ui.spPreviewDialog.close();
                };
                this.ui.spPreviewGenerate?.addEventListener('click', onGen);
                this.ui.spPreviewCancel?.addEventListener('click', onCancel);
            });

            if (action === 'generate') {
                let editedSp = this.ui.spPreviewEditor.value.trim();
                const seedFromInput = this.ui.seedInput?.value.trim() ? parseInt(this.ui.seedInput.value.trim(), 10) : null;

                const startSeed = seedFromInput !== null ? seedFromInput : (
                    mode === 'edit' ? Math.floor(Math.random() * 2147483647)
                                    : (mode === 'refine' && featured ? featured.seed : (spResult.seed || Math.floor(Math.random() * 2147483647)))
                );

                const editImage = uploadedImageBase64 || (mode === 'edit' ? featured?.base64 : null);
                let finalSp = editedSp;

                if (editedSp !== formatted) {
                    this.state.setLoading(true, 'Reviewing Structure Prompt...', initialProjectId);
                    try {
                        const originalObj = typeof originalSp === 'string' ? JSON.parse(originalSp) : originalSp;
                        const diffPayload = {
                            original_json: originalObj,
                            edited_json: JSON.parse(editedSp),
                            session_id: "diff_session_1"
                        };
                        const diffResult = await api.generateFromDiff(diffPayload);
                        finalSp = diffResult.structured_prompt || diffResult;
                    } catch (e) {
                        console.warn('[handleStructuredPromptPreview] diff/JSON parse failed, sending raw content...', e);
                        finalSp = editedSp;
                    }
                }

                this.abortControllers[initialProjectId] = new AbortController();
                this.state.emit('generationStarted');

                this.state.setLoading(true, `Generating [0/${imageCount}]…`, initialProjectId);
                let finishedCount = 0;

                const promises = Array.from({ length: imageCount }, async (_, i) => {
                    if (this.abortControllers[initialProjectId]?.signal.aborted) return;
                    
                    const currentSeed = startSeed + i;
                    
                    try {
                        let result;
                        if (mode === 'edit') {
                            result = await api.edit(prompt, editImage, currentSeed, {
                                ...options,
                                structured_instruction: finalSp,
                                signal: this.abortControllers[initialProjectId].signal
                            });
                        } else {
                            result = await api.generate(prompt, currentSeed, uploadedImageBase64, {
                                ...options,
                                structured_prompt: finalSp,
                                signal: this.abortControllers[initialProjectId].signal
                            });
                        }

                        const thumbnail = await createThumbnail(result.base64, 200);
                        await this.state.addImage({ ...result, thumbnail }, prompt, mode, batchId, parentImageId, initialProjectId);

                        finishedCount++;
                        this.state.setLoading(true, `Generating [${finishedCount}/${imageCount}]…`, initialProjectId);

                        if (i === 0) this.state.setCanvasLoading(false, initialProjectId);
                    } catch (err) {
                        console.error(`[handleStructuredPromptPreview] Item ${i + 1} failed:`, err);
                        throw err;
                    }
                });
                
                const results = await Promise.allSettled(promises);
                
                const failures = results.filter(r => r.status === 'rejected');
                if (failures.length === imageCount) {
                    throw failures[0].reason;
                }
            }
        } catch (err) {
            const isInterrupt = err.name === 'AbortError' || 
                                err.message === 'Processing interrupted' || 
                                err.message === 'Request cancelled by user.';
            
            if (isInterrupt) {
                showToast('Preview interrupted');
            } else {
                console.error('[handleStructuredPromptPreview] ERROR:', err);
                this.state.setError(err.message || 'Preview prompt failed');
                showToast('Error: ' + err.message);
            }
        } finally {
            this.state.setLoading(false, null, initialProjectId);
            this.state.emit('generationFinished');
            delete this.abortControllers[initialProjectId];
        }
    }

    interrupt(projectId = null) {
        const id = projectId || this.state.activeProjectId;
        if (this.abortControllers[id]) {
            this.abortControllers[id].abort();
        }
        this.state.setLoading(false, null, id);
        this.state.setCanvasLoading(false, id);
    }
}

async function createCompositeImage(base64Array) {
    if (!base64Array || base64Array.length === 0) return null;
    if (base64Array.length === 1) return base64Array[0];

    const images = await Promise.all(base64Array.map(b64 => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = b64;
        });
    }));
    
    let cols, rows;
    if (images.length === 2) {
        cols = 2; rows = 1;
    } else {
        cols = Math.ceil(Math.sqrt(images.length));
        rows = Math.ceil(images.length / cols);
    }

    const TILE_SIZE = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = cols * TILE_SIZE;
    canvas.height = rows * TILE_SIZE;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    images.forEach((img, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        const scale = Math.min(TILE_SIZE / img.width, TILE_SIZE / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = col * TILE_SIZE + (TILE_SIZE - w) / 2;
        const y = row * TILE_SIZE + (TILE_SIZE - h) / 2;
        
        ctx.drawImage(img, x, y, w, h);
    });

    return canvas.toDataURL('image/jpeg', 0.95);
}
