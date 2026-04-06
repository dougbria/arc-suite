import state from '@arc/state.js';

/**
 * Builds a partial VGL Structured Prompt Template by merging
 * characters, locations, and global styles from the workspace registry.
 *
 * @param {Object} options - Which entities to include in the template.
 * @param {string[]} [options.characterIds=[]] - Array of character IDs.
 * @param {string} [options.locationId=null] - Location ID.
 * @param {boolean} [options.includeStyle=true] - Whether to merge global style.
 * @returns {Object} A partial VGL JSON object to send to the structured prompt API.
 */
export function composeVglTemplate({ characterIds = [], locationId = null, includeStyle = true } = {}) {
    if (!state.workspace) return null;

    const template = {};

    // 1. Incorporate Style
    const style = state.workspace.style;
    if (includeStyle && style) {
        if (style.aesthetics) {
            template.aesthetics = { ...style.aesthetics };
        }
        if (style.defaultLighting) {
            template.lighting = { ...style.defaultLighting };
        }
        if (style.defaultCamera) {
            template.photographic_characteristics = { ...style.defaultCamera };
        }
    }

    // 2. Incorporate Location
    if (locationId) {
        const loc = state.workspace.locations.find(l => l.id === locationId);
        if (loc && loc.vgl) {
            if (loc.vgl.background_setting) {
                template.background_setting = loc.vgl.background_setting;
            }
            // Location lighting overrides default style lighting
            if (loc.vgl.lighting) {
                template.lighting = {
                    ...(template.lighting || {}),
                    ...loc.vgl.lighting
                };
            }
        }
    }

    // 3. Incorporate Characters
    const objects = [];
    characterIds.forEach((charId, index) => {
        const char = state.workspace.characters.find(c => c.id === charId);
        if (char && char.vgl) {
            // Start with character's VGL identity traits
            const obj = { ...char.vgl };
            // Ensure we have a distinct class
            obj.class = "person";
            // Add explicit reference to link it back during keyframing
            obj._arc_character_id = charId;
            // Strip out empty string traits so they don't break the prompt
            Object.keys(obj).forEach(k => {
                if (obj[k] === "") delete obj[k];
            });
            objects.push(obj);
        }
    });

    if (objects.length > 0) {
        template.objects = objects;
    }

    // Clean up empty objects
    ['aesthetics', 'lighting', 'photographic_characteristics'].forEach(key => {
        if (template[key] && Object.keys(template[key]).length === 0) {
            delete template[key];
        }
    });

    return template;
}

/**
 * Specifically composes a VGL template for an explicit Keyframe.
 * Merges shot-level overrides over the base template.
 */
export function composeKeyframeTemplate(shot, keyframeSpec) {
    const baseTemplate = composeVglTemplate({
        characterIds: shot.characterIds || [],
        locationId: shot.scene?.locationId || null
    });

    if (!baseTemplate) return null;

    // Shot-level camera/lighting overrides
    if (shot.camera) {
        baseTemplate.photographic_characteristics = {
            ...(baseTemplate.photographic_characteristics || {}),
            ...shot.camera
        };
    }
    if (shot.lightingOverride) {
        baseTemplate.lighting = {
            ...(baseTemplate.lighting || {}),
            ...shot.lightingOverride
        };
    }

    // Inject character action/poses from the keyframe logic
    if (baseTemplate.objects && keyframeSpec.characterPoses) {
        keyframeSpec.characterPoses.forEach(pose => {
            const charDescObj = baseTemplate.objects.find(o => o._arc_character_id === pose.characterId);
            if (charDescObj && pose.action) {
                // If the keyframe defines a specific pose/action, inject it into the description
                charDescObj.description = charDescObj.description 
                    ? `${charDescObj.description}, ${pose.action}` 
                    : pose.action;
            }
        });
    }

    return baseTemplate;
}
