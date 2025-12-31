// ===== CONFIG =====
const DEFAULT_DURATION = 3;
const API_URL = 'https://flowmotionbackend-production.up.railway.app';

// ===== TOOLTIPS =====
const TOOLTIPS = {
    show: 'Describe the visual elements — shapes, text, equations, charts, or any objects you want on screen.',
    animations: 'How should elements appear and move? Fade in, transform, rotate, grow, slide, morph...',
    detailing: 'Add narration, voiceover script, or additional context for this scene.'
};

// ===== STATE =====
let scenes = [];
let transitions = [];
let sceneCounter = 0;
let previewOpen = false;
let isGenerating = false;
let isRendering = false;

// ===== DOM ELEMENTS =====
const scenesContainer = document.getElementById('scenes-container');
const addSceneBtn = document.getElementById('add-scene');
const renderBtn = document.getElementById('render-code');
const videoBtn = document.getElementById('render-video');
const installBtn = document.getElementById('install-engine');
const sceneCountEl = document.getElementById('scene-count');
const timelineWrapper = document.getElementById('timeline-wrapper');

// Preview Elements
const previewWidget = document.getElementById('preview-widget');
const previewToggle = document.getElementById('preview-toggle');
const previewPanel = document.getElementById('preview-panel');
const previewClose = document.getElementById('preview-close');
const previewBadge = document.getElementById('preview-badge');

// ===== PREVIEW TOGGLE =====
function togglePreview() {
    previewOpen = !previewOpen;
    previewPanel.classList.toggle('open', previewOpen);
}

previewToggle.addEventListener('click', togglePreview);
previewClose.addEventListener('click', togglePreview);

// Close preview when clicking outside
document.addEventListener('click', (e) => {
    if (previewOpen && !previewWidget.contains(e.target)) {
        previewOpen = false;
        previewPanel.classList.remove('open');
    }
});

// ===== DRAG TO SCROLL =====
let isDown = false;
let startX;
let scrollLeft;

timelineWrapper.addEventListener('mousedown', (e) => {
    if (e.target.closest('.scene-card, .btn-add-scene, .transition-input')) return;
    isDown = true;
    startX = e.pageX - timelineWrapper.offsetLeft;
    scrollLeft = timelineWrapper.scrollLeft;
});

timelineWrapper.addEventListener('mouseleave', () => isDown = false);
timelineWrapper.addEventListener('mouseup', () => isDown = false);
timelineWrapper.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - timelineWrapper.offsetLeft;
    const walk = (x - startX) * 1.5;
    timelineWrapper.scrollLeft = scrollLeft - walk;
});

// ===== UPDATE SCENE COUNT =====
function updateSceneCount() {
    const count = scenes.length;
    sceneCountEl.textContent = `${count} scene${count !== 1 ? 's' : ''}`;
}

// ===== CREATE SCENE CARD =====
function createSceneCard(id, index, data = {}) {
    const card = document.createElement('div');
    card.className = 'scene-card';
    card.dataset.id = id;
    
    card.innerHTML = `
        <div class="scene-header">
            <div class="scene-number">
                <span class="scene-badge">${index + 1}</span>
                <span class="scene-label">Scene</span>
            </div>
            <button class="btn-delete" onclick="deleteScene(${id})" title="Delete scene">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
        
        <div class="scene-body">
            <div class="prompt-group">
                <div class="prompt-label">
                    <span class="prompt-title">Show</span>
                    <div class="tooltip">
                        <svg class="info-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <span class="tooltip-text">${TOOLTIPS.show}</span>
                    </div>
                </div>
                <div class="prompt-input-wrap">
                    <textarea class="prompt-input" data-field="show" rows="2">${data.show || ''}</textarea>
                </div>
            </div>
            
            <div class="prompt-group">
                <div class="prompt-label">
                    <span class="prompt-title">Animations</span>
                    <div class="tooltip">
                        <svg class="info-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <span class="tooltip-text">${TOOLTIPS.animations}</span>
                    </div>
                </div>
                <div class="prompt-input-wrap">
                    <textarea class="prompt-input" data-field="action" rows="2">${data.action || ''}</textarea>
                </div>
            </div>
            
            <div class="prompt-group">
                <div class="prompt-label">
                    <span class="prompt-title">Detailing</span>
                    <div class="tooltip">
                        <svg class="info-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <span class="tooltip-text">${TOOLTIPS.detailing}</span>
                    </div>
                </div>
                <div class="prompt-input-wrap">
                    <textarea class="prompt-input" data-field="narration" rows="2">${data.narration || ''}</textarea>
                </div>
            </div>
            
            <div class="scene-footer">
                <div class="duration-control">
                    <span class="duration-label">Duration</span>
                    <div class="duration-input-wrap">
                        <input type="number" class="duration-input" value="${data.duration || DEFAULT_DURATION}" min="0.5" step="0.5" data-field="duration">
                        <span class="duration-suffix">sec</span>
                    </div>
                </div>
                <button class="btn-expand" onclick="toggleDetails(${id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    <span>Objects</span>
                </button>
            </div>
        </div>
        
        <!-- Expandable Object Details -->
        <div class="object-details-panel" data-scene-id="${id}" style="display: none;">
            <div class="details-header">
                <span>Object Details</span>
                <button class="btn-close-details" onclick="toggleDetails(${id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="objects-list">
                ${(data.objects || []).map((obj, i) => createObjectHTML(id, obj, i)).join('')}
            </div>
            <button class="btn-add-object" onclick="addObject(${id})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Object
            </button>
        </div>
    `;
    
    return card;
}

// ===== CREATE OBJECT HTML =====
function createObjectHTML(sceneId, obj = {}, index = 0) {
    const objId = obj.id || Date.now() + index;
    return `
        <div class="object-item" data-object-id="${objId}">
            <div class="object-header">
                <span class="object-num">${index + 1}</span>
                <input type="text" class="object-name" placeholder="Name" value="${obj.name || ''}" data-field="name">
                <button class="btn-remove-obj" onclick="removeObject(${sceneId}, ${objId})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <textarea class="obj-field" placeholder="Description" data-field="description" rows="1">${obj.description || ''}</textarea>
            <textarea class="obj-field" placeholder="Animation" data-field="animation" rows="1">${obj.animation || ''}</textarea>
        </div>
    `;
}

// ===== TOGGLE OBJECT DETAILS =====
function toggleDetails(sceneId) {
    const panel = document.querySelector(`.object-details-panel[data-scene-id="${sceneId}"]`);
    if (panel) {
        const isVisible = panel.style.display !== 'none';
        panel.style.display = isVisible ? 'none' : 'block';
    }
}

// ===== ADD OBJECT =====
let objectCounter = 0;
function addObject(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    
    if (!scene.objects) scene.objects = [];
    
    objectCounter++;
    const obj = {
        id: objectCounter,
        name: '',
        description: '',
        animation: ''
    };
    
    scene.objects.push(obj);
    
    const objectsList = document.querySelector(`.object-details-panel[data-scene-id="${sceneId}"] .objects-list`);
    objectsList.insertAdjacentHTML('beforeend', createObjectHTML(sceneId, obj, scene.objects.length - 1));
}

// ===== REMOVE OBJECT =====
function removeObject(sceneId, objectId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || !scene.objects) return;
    
    scene.objects = scene.objects.filter(o => o.id !== objectId);
    
    const objectItem = document.querySelector(`.object-item[data-object-id="${objectId}"]`);
    if (objectItem) {
        objectItem.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => objectItem.remove(), 200);
    }
    
    setTimeout(() => {
        const panel = document.querySelector(`.object-details-panel[data-scene-id="${sceneId}"]`);
        panel.querySelectorAll('.object-item').forEach((item, i) => {
            item.querySelector('.object-num').textContent = i + 1;
        });
    }, 210);
}

// ===== CREATE TRANSITION BLOCK =====
function createTransitionBlock(fromId, toId, data = '') {
    const block = document.createElement('div');
    block.className = 'transition-block';
    block.dataset.from = fromId;
    block.dataset.to = toId;
    
    block.innerHTML = `
        <div class="transition-line">
            <div class="transition-dot"></div>
            <div class="transition-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
        </div>
        <div class="transition-input-wrap">
            <textarea 
                class="transition-input"
                placeholder="Transition"
                data-field="transition"
                rows="2"
            >${data}</textarea>
        </div>
    `;
    
    return block;
}

// ===== ADD SCENE =====
function addScene() {
    sceneCounter++;
    const id = sceneCounter;
    
    if (scenes.length > 0) {
        const lastScene = scenes[scenes.length - 1];
        transitions.push({
            from: lastScene.id,
            to: id,
            description: ''
        });
    }
    
    scenes.push({
        id,
        show: '',
        action: '',
        narration: '',
        duration: DEFAULT_DURATION,
        objects: []
    });
    
    renderTimeline();
    updateSceneCount();
    
    setTimeout(() => {
        timelineWrapper.scrollTo({
            left: timelineWrapper.scrollWidth,
            behavior: 'smooth'
        });
    }, 100);
}

// ===== DELETE SCENE =====
function deleteScene(id) {
    if (scenes.length <= 1) return;
    
    const index = scenes.findIndex(s => s.id === id);
    if (index === -1) return;
    
    const card = document.querySelector(`.scene-card[data-id="${id}"]`);
    if (card) {
        card.style.animation = 'fadeOut 0.3s ease forwards';
    }
    
    setTimeout(() => {
        transitions = transitions.filter(t => t.from !== id && t.to !== id);
        
        if (index > 0 && index < scenes.length - 1) {
            transitions.push({
                from: scenes[index - 1].id,
                to: scenes[index + 1].id,
                description: ''
            });
        }
        
        scenes.splice(index, 1);
        renderTimeline();
        updateSceneCount();
    }, 300);
}

// ===== RENDER TIMELINE =====
function renderTimeline() {
    scenesContainer.innerHTML = '';
    
    scenes.forEach((scene, index) => {
        const card = createSceneCard(scene.id, index, scene);
        card.style.animationDelay = `${index * 0.1}s`;
        scenesContainer.appendChild(card);
        
        if (index < scenes.length - 1) {
            const transition = transitions.find(t => 
                t.from === scene.id && t.to === scenes[index + 1].id
            );
            const transBlock = createTransitionBlock(
                scene.id, 
                scenes[index + 1].id, 
                transition?.description || ''
            );
            scenesContainer.appendChild(transBlock);
        }
    });
}

// ===== UPDATE DATA ON INPUT =====
scenesContainer.addEventListener('input', (e) => {
    const field = e.target.dataset.field;
    if (!field) return;
    
    // Auto-resize textareas
    if (e.target.tagName === 'TEXTAREA') {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    }
    
    // Transition
    if (field === 'transition') {
        const block = e.target.closest('.transition-block');
        const fromId = parseInt(block.dataset.from);
        const toId = parseInt(block.dataset.to);
        const transition = transitions.find(t => t.from === fromId && t.to === toId);
        if (transition) transition.description = e.target.value;
        return;
    }
    
    // Object fields
    const objectItem = e.target.closest('.object-item');
    if (objectItem) {
        const objectId = parseInt(objectItem.dataset.objectId);
        const panel = e.target.closest('.object-details-panel');
        const sceneId = parseInt(panel.dataset.sceneId);
        const scene = scenes.find(s => s.id === sceneId);
        const obj = scene?.objects?.find(o => o.id === objectId);
        if (obj) obj[field] = e.target.value;
        return;
    }
    
    // Scene fields
    const card = e.target.closest('.scene-card');
    if (!card) return;
    
    const id = parseInt(card.dataset.id);
    const scene = scenes.find(s => s.id === id);
    
    if (scene) {
        if (field === 'duration') {
            scene[field] = e.target.value ? parseFloat(e.target.value) : DEFAULT_DURATION;
        } else {
            scene[field] = e.target.value;
        }
    }
});

// ===== BUILD PROJECT JSON =====
function buildProjectJSON() {
    return {
        version: '1.0',
        totalScenes: scenes.length,
        scenes: scenes.map((s, index) => {
            const sceneData = {
                scene: index + 1,
                show: s.show,
                animations: s.action,
                detailing: s.narration,
                duration: s.duration
            };
            
            if (s.objects && s.objects.length > 0) {
                sceneData.objects = s.objects.map(o => ({
                    name: o.name,
                    description: o.description,
                    animation: o.animation
                })).filter(o => o.name);
            }
            
            if (index < scenes.length - 1) {
                const transition = transitions.find(t => 
                    t.from === s.id && t.to === scenes[index + 1].id
                );
                if (transition?.description) {
                    sceneData.transitionToNext = transition.description;
                }
            }
            
            return sceneData;
        })
    };
}

// ===== GENERATE CODE (API CALL) =====
async function generateCode() {
    if (isGenerating) return;
    
    // Validate scenes
    const hasContent = scenes.some(s => s.show || s.action);
    if (!hasContent) {
        showNotification('Please add some content to your scenes first.', 'error');
        return;
    }
    
    isGenerating = true;
    renderBtn.disabled = true;
    renderBtn.innerHTML = `
        <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
        </svg>
        Generating...
    `;
    
    try {
        const project = buildProjectJSON();
        
        const response = await fetch(`${API_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.code) {
            showCodeModal(data.code);
            previewBadge.textContent = 'Generated';
            previewBadge.classList.add('rendered');
        } else {
            throw new Error(data.message || 'Generation failed');
        }
        
    } catch (error) {
        console.error('Generation error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        isGenerating = false;
        renderBtn.disabled = false;
        renderBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Generate Code
        `;
    }
}

// ===== SHOW CODE MODAL =====
function showCodeModal(code) {
    // Remove existing modal
    const existingModal = document.getElementById('code-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'code-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Generated Manim Code</h3>
                <button class="modal-close" onclick="closeCodeModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <pre class="code-block"><code>${escapeHtml(code)}</code></pre>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="copyCode()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy Code
                </button>
                <button class="btn-secondary" onclick="downloadCode()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download .py
                </button>
                <button class="btn-primary" onclick="closeCodeModal()">Done</button>
            </div>
        </div>
    `;
    
    // Store code for copy/download
    modal.dataset.code = code;
    
    document.body.appendChild(modal);
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCodeModal();
    });
    
    // Close on Escape
    document.addEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') closeCodeModal();
}

function closeCodeModal() {
    const modal = document.getElementById('code-modal');
    if (modal) {
        modal.remove();
        document.removeEventListener('keydown', handleEscapeKey);
    }
}

function copyCode() {
    const modal = document.getElementById('code-modal');
    const code = modal?.dataset.code;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            showNotification('Code copied to clipboard!', 'success');
        });
    }
}

function downloadCode() {
    const modal = document.getElementById('code-modal');
    const code = modal?.dataset.code;
    if (code) {
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flowmotion_scene.py`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('File downloaded!', 'success');
    }
}

// ===== RENDER VIDEO (API CALL) =====
async function renderVideo() {
    if (isRendering) return;
    
    // Validate scenes
    const hasContent = scenes.some(s => s.show || s.action);
    if (!hasContent) {
        showNotification('Please add some content to your scenes first.', 'error');
        return;
    }
    
    isRendering = true;
    videoBtn.disabled = true;
    videoBtn.innerHTML = `
        <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
        </svg>
        Rendering...
    `;
    
    // Update preview badge
    previewBadge.textContent = 'Rendering';
    previewBadge.classList.remove('rendered');
    
    try {
        const project = buildProjectJSON();
        
        const response = await fetch(`${API_URL}/render`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project, quality: 'l' })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.video_url) {
            // Get video URL
            const videoUrl = `${API_URL}${data.video_url}`;
            
            // Show in preview
            const previewVideo = document.getElementById('preview-video');
            const previewPlaceholder = document.getElementById('preview-placeholder');
            
            previewVideo.src = videoUrl;
            previewVideo.style.display = 'block';
            previewPlaceholder.style.display = 'none';
            
            // Open preview panel
            previewOpen = true;
            previewPanel.classList.add('open');
            
            // Update badge
            previewBadge.textContent = 'Ready';
            previewBadge.classList.add('rendered');
            
            // Auto-download
            downloadVideoFile(videoUrl);
            
            showNotification('Video rendered successfully!', 'success');
        } else {
            throw new Error(data.message || 'Render failed');
        }
        
    } catch (error) {
        console.error('Render error:', error);
        showNotification(`Error: ${error.message}`, 'error');
        previewBadge.textContent = 'Error';
    } finally {
        isRendering = false;
        videoBtn.disabled = false;
        videoBtn.innerHTML = `
            <span class="btn-shine"></span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>Get Video</span>
        `;
    }
}

// ===== DOWNLOAD VIDEO FILE =====
function downloadVideoFile(url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowmotion_video.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ===== EXPORT JSON (for backup) =====
function exportJSON() {
    const project = buildProjectJSON();
    project.created = new Date().toISOString();
    
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowmotion-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Project exported!', 'success');
}

// ===== NOTIFICATION =====
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => notification.remove(), 4000);
}

// ===== HELPER: ESCAPE HTML =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== INSTALL ENGINE =====
function installEngine() {
    window.open('https://github.com/flowmotion/engine', '_blank');
}

// ===== EVENT LISTENERS =====
addSceneBtn.addEventListener('click', addScene);
renderBtn.addEventListener('click', generateCode);
videoBtn.addEventListener('click', renderVideo);
installBtn.addEventListener('click', installEngine);

// ===== ADD STYLES =====
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        to {
            opacity: 0;
            transform: scale(0.95) translateX(-10px);
        }
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .spinner {
        animation: spin 1s linear infinite;
    }
    
    /* Modal Styles */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    }
    
    .modal-content {
        background: white;
        border-radius: 12px;
        width: 100%;
        max-width: 800px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
    }
    
    .modal-header h3 {
        margin: 0;
        font-size: 18px;
        color: #1f2937;
    }
    
    .modal-close {
        background: none;
        border: none;
        cursor: pointer;
        color: #6b7280;
        padding: 4px;
        border-radius: 4px;
    }
    
    .modal-close:hover {
        background: #f3f4f6;
        color: #1f2937;
    }
    
    .modal-body {
        flex: 1;
        overflow: auto;
        padding: 20px;
    }
    
    .code-block {
        background: #1f2937;
        color: #e5e7eb;
        padding: 16px;
        border-radius: 8px;
        font-family: 'Fira Code', 'Consolas', monospace;
        font-size: 13px;
        line-height: 1.5;
        overflow-x: auto;
        margin: 0;
    }
    
    .modal-footer {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        padding: 16px 20px;
        border-top: 1px solid #e5e7eb;
    }
    
    .btn-secondary {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        color: #374151;
    }
    
    .btn-secondary:hover {
        background: #e5e7eb;
    }
    
    .btn-primary {
        padding: 8px 20px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
    }
    
    .btn-primary:hover {
        background: #059669;
    }
    
    /* Notification Styles */
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 1001;
        animation: slideIn 0.3s ease;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification-success {
        background: #10b981;
        color: white;
    }
    
    .notification-error {
        background: #ef4444;
        color: white;
    }
    
    .notification-info {
        background: #3b82f6;
        color: white;
    }
    
    .notification button {
        background: none;
        border: none;
        color: inherit;
        font-size: 18px;
        cursor: pointer;
        opacity: 0.8;
    }
    
    .notification button:hover {
        opacity: 1;
    }
`;
document.head.appendChild(style);

// ===== TOOLTIP POSITIONING =====
document.addEventListener('mouseover', (e) => {
    const tooltip = e.target.closest('.tooltip');
    if (!tooltip) return;
    
    const tooltipText = tooltip.querySelector('.tooltip-text');
    if (!tooltipText) return;
    
    const rect = tooltip.getBoundingClientRect();
    const tooltipRect = tooltipText.getBoundingClientRect();
    
    // Position above the icon
    let top = rect.top - tooltipRect.height - 10;
    let left = rect.left + (rect.width / 2) - (260 / 2);
    
    // Keep within viewport
    if (left < 10) left = 10;
    if (left + 260 > window.innerWidth - 10) left = window.innerWidth - 270;
    if (top < 10) top = rect.bottom + 10; // Show below if no space above
    
    tooltipText.style.top = top + 'px';
    tooltipText.style.left = left + 'px';
});

// ===== INITIALIZE =====
addScene();
addScene();
updateSceneCount();
