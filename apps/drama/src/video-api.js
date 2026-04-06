import state from '@arc/state.js';

/**
 * MOCK Video API Client for Phase 4
 * Simulates polling and asynchronous rendering.
 */

// Simulated database of running tasks
const generateTasks = new Map();

export async function generateVideo(projectId, imageId) {
    // 1. Validate
    if (!projectId || !imageId) {
        throw new Error("Missing projectId or imageId for video generation.");
    }

    // 2. Fetch the Project Image to "animate"
    const project = state.projects[projectId];
    if (!project) throw new Error("Project not found");
    const image = project.images.find(img => img.id === imageId);
    if (!image) throw new Error("Image not found");

    const taskId = 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    // Simulate generation asynchronously taking time
    generateTasks.set(taskId, {
        status: 'processing',
        projectId,
        imageId,
        progress: 0,
        startTime: Date.now()
    });

    simulateProcessing(taskId, image);

    return taskId;
}

export async function checkVideoStatus(taskId) {
    const task = generateTasks.get(taskId);
    if (!task) return null;
    return task;
}

// Background simulator loop
function simulateProcessing(taskId, baseImage) {
    let progress = 0;
    const interval = setInterval(() => {
        const task = generateTasks.get(taskId);
        if (!task) {
            clearInterval(interval);
            return;
        }

        progress += 10;
        task.progress = progress;

        if (progress >= 100) {
            clearInterval(interval);
            task.status = 'completed';
            
            // In a real API, we'd receive a remote MP4 URL. Here we attach a fake MP4.
            // (Due to local storage, we'd traditionally fetch and save as Blob).
            task.videoUrl = "https://www.w3schools.com/html/mov_bbb.mp4"; // generic open-source test video
            
            // Link it backwards to the workspace Image
            baseImage.videoUrl = task.videoUrl;
            baseImage.videoStatus = 'ready';
            
            // Tell the UI to redraw Gallery/Player
            state.emit('videoCompleted', { projectId: task.projectId, imageId: task.imageId, videoUrl: task.videoUrl });
        } else {
             state.emit('videoProgress', { taskId, progress });
        }
    }, 1000);
}
