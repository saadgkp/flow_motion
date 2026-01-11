// ===== CONFIG (v2) =====
const DEFAULT_DURATION = 3;
const APP_IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// ===== AUTH HELPER =====
function getAuthHeaders() {
    // Always get from localStorage for reliability
    const token = localStorage.getItem('flowmotion_auth_token');
    if (token) {
        return { 'Authorization': `Bearer ${token}` };
    }
    return {};
}

function isUserLoggedIn() {
    return !!localStorage.getItem('flowmotion_auth_token');
}

// Check auth before protected actions
function checkAuthBeforeAction(actionName = 'use this feature') {
    if (!isUserLoggedIn()) {
        if (typeof showLoginPrompt === 'function') {
            showLoginPrompt(actionName);
        } else {
            showNotification('Please sign in to ' + actionName, 'info');
        }
        return false;
    }
    return true;
}

// Auto-detect local development
const API_URL = APP_IS_LOCAL
    ? 'http://localhost:8000' 
    : 'https://flowmotionbackend-production.up.railway.app';

// ===== TIER CONFIGURATION =====
const TIERS = {
    FREE: {
        name: 'Free',
        videosPerDay: 3,
        autofillsPerDay: 3,       // Autofill limit
        maxScenes: 6,
        maxCharsPerField: 150,
        maxObjectsPerScene: 3,    // Object limit per scene
        maxCodeViews: 0,          // No code access
        canEditCode: false,       // No editing
        canCopyCode: false,       // No copy
        canExportCode: false,     // No export
        hasCodeFirstOption: false // Only video-first
    },
    PRO: {
        name: 'Pro',
        videosPerDay: 10,
        autofillsPerDay: 10,      // Autofill limit
        maxScenes: 15,
        maxCharsPerField: 400,
        maxObjectsPerScene: 5,    // Object limit per scene
        maxCodeViews: Infinity,   // Unlimited views
        canEditCode: false,       // No editing (video-first only)
        canCopyCode: true,        // Can copy
        canExportCode: true,      // Can export
        hasCodeFirstOption: false // Only video-first
    },
    PRO_PLUS: {
        name: 'Pro+',
        videosPerDay: 30,
        autofillsPerDay: 30,      // Autofill limit
        maxScenes: 50,
        maxCharsPerField: 1000,
        maxObjectsPerScene: 10,   // Object limit per scene
        maxCodeViews: Infinity,   // Unlimited views
        canEditCode: true,        // Can edit (if code-first path)
        canCopyCode: true,        // Can copy
        canExportCode: true,      // Can export
        hasCodeFirstOption: true  // Can choose code-first OR video-first
    }
};

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

// Tier & Usage State
let currentTier = 'FREE';  // FREE, PRO, PRO_PLUS
let todayUsage = { videos: 0, codeViews: 0, autofills: 0, date: new Date().toDateString() };
let generatedCode = null;      // Cache for generated code
let codeWasCustomized = false; // Track if user went code-first path (PRO+ only)
let sessionCodeViews = 0;      // Track code views for current video session

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

// ===== INITIALIZE USAGE FROM LOCALSTORAGE =====
function initializeUsage() {
    const stored = localStorage.getItem('flowmotion_usage');
    if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === new Date().toDateString()) {
            todayUsage = parsed;
            // Ensure autofills field exists (migration)
            if (todayUsage.autofills === undefined) {
                todayUsage.autofills = 0;
            }
        } else {
            // Reset for new day
            todayUsage = { videos: 0, codeViews: 0, autofills: 0, date: new Date().toDateString() };
            saveUsage();
        }
    }
    
    // Tier is loaded from backend via auth.js - default to FREE until auth completes
    currentTier = 'FREE';
    
    updateTierUI();
}

function saveUsage() {
    localStorage.setItem('flowmotion_usage', JSON.stringify(todayUsage));
}

function saveTier() {
    // Tier is now controlled by backend - do nothing
    // Kept for backward compatibility with any calls
}

// ===== TIER UI =====
let advancedDropdownOpen = false;

function updateTierUI() {
    const tier = TIERS[currentTier];
    const remaining = tier.videosPerDay - todayUsage.videos;
    
    // Update tier badge in header (display only, not clickable)
    const tierBadge = document.getElementById('tier-badge');
    if (tierBadge) {
        tierBadge.textContent = tier.name;
        tierBadge.className = `tier-badge tier-${currentTier.toLowerCase().replace('_', '-')}`;
        tierBadge.style.cursor = 'default';  // Not clickable
        tierBadge.onclick = null;  // Remove click handler
    }
    
    // Update usage display
    const usageDisplay = document.getElementById('usage-display');
    if (usageDisplay) {
        usageDisplay.textContent = `${remaining}/${tier.videosPerDay} videos left today`;
    }
    
    // Update autofill count
    const autofillCount = document.getElementById('autofill-count');
    if (autofillCount) {
        const remainingAutofills = tier.autofillsPerDay - todayUsage.autofills;
        autofillCount.textContent = remainingAutofills;
    }
    
    // Always show Advanced dropdown button (replaces old renderBtn)
    renderBtn.style.display = 'flex';
    renderBtn.className = 'btn-advanced';
    renderBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span>Advanced</span>
        <svg class="dropdown-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
        </svg>
    `;
    renderBtn.disabled = false;
    
    // Render Video button
    videoBtn.innerHTML = `
        <span class="btn-shine"></span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Render Video</span>
    `;
    videoBtn.disabled = false;
    
    // Update dropdown if it exists
    updateAdvancedDropdown();
}

// ===== ADVANCED DROPDOWN =====
function toggleAdvancedDropdown(e) {
    e.stopPropagation();
    advancedDropdownOpen = !advancedDropdownOpen;
    
    let dropdown = document.getElementById('advanced-dropdown');
    
    if (advancedDropdownOpen) {
        if (!dropdown) {
            dropdown = createAdvancedDropdown();
            renderBtn.parentElement.appendChild(dropdown);
        }
        dropdown.classList.add('open');
    } else {
        if (dropdown) {
            dropdown.classList.remove('open');
        }
    }
}

function createAdvancedDropdown() {
    const dropdown = document.createElement('div');
    dropdown.id = 'advanced-dropdown';
    dropdown.className = 'advanced-dropdown';
    updateAdvancedDropdownContent(dropdown);
    return dropdown;
}

function updateAdvancedDropdown() {
    const dropdown = document.getElementById('advanced-dropdown');
    if (dropdown) {
        updateAdvancedDropdownContent(dropdown);
    }
}

function updateAdvancedDropdownContent(dropdown) {
    const tier = TIERS[currentTier];
    const isProPlus = tier.hasCodeFirstOption;
    
    dropdown.innerHTML = `
        <button class="dropdown-item ${isProPlus ? '' : 'locked'}" onclick="${isProPlus ? 'viewCopyCode()' : 'showUpgradeModal()'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span>View/Copy Code</span>
            ${isProPlus ? '' : '<svg class="lock-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'}
        </button>
        <button class="dropdown-item ${isProPlus ? '' : 'locked'}" onclick="${isProPlus ? 'customizeCode()' : 'showUpgradeModal()'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>Customize Code</span>
            ${isProPlus ? '' : '<svg class="lock-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'}
        </button>
        ${!isProPlus ? `
            <div class="dropdown-divider"></div>
            <button class="dropdown-item upgrade-item" onclick="showUpgradeModal()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span>Upgrade to Pro+</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </button>
        ` : ''}
    `;
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (advancedDropdownOpen && !e.target.closest('.btn-advanced') && !e.target.closest('.advanced-dropdown')) {
        advancedDropdownOpen = false;
        const dropdown = document.getElementById('advanced-dropdown');
        if (dropdown) {
            dropdown.classList.remove('open');
        }
    }
});

function canGenerateVideo() {
    const tier = TIERS[currentTier];
    return todayUsage.videos < tier.videosPerDay;
}

function canViewCode() {
    const tier = TIERS[currentTier];
    if (tier.maxCodeViews === Infinity) return true;
    return sessionCodeViews < tier.maxCodeViews;
}

function getRemainingCodeViews() {
    const tier = TIERS[currentTier];
    if (tier.maxCodeViews === Infinity) return '∞';
    return tier.maxCodeViews - sessionCodeViews;
}

function canAutofill() {
    const tier = TIERS[currentTier];
    return todayUsage.autofills < tier.autofillsPerDay;
}

function getRemainingAutofills() {
    const tier = TIERS[currentTier];
    return tier.autofillsPerDay - todayUsage.autofills;
}

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
    const tier = TIERS[currentTier];
    sceneCountEl.textContent = `${count}/${tier.maxScenes} scenes`;
    
    // Visual warning when near limit
    if (count >= tier.maxScenes) {
        sceneCountEl.classList.add('limit-reached');
    } else if (count >= tier.maxScenes - 2) {
        sceneCountEl.classList.add('limit-warning');
        sceneCountEl.classList.remove('limit-reached');
    } else {
        sceneCountEl.classList.remove('limit-warning', 'limit-reached');
    }
}

// ===== CREATE SCENE CARD =====
function createSceneCard(id, index, data = {}) {
    const card = document.createElement('div');
    card.className = 'scene-card';
    card.dataset.id = id;
    
    const tier = TIERS[currentTier];
    const maxChars = tier.maxCharsPerField;
    
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
                    <textarea class="prompt-input" data-field="show" rows="2" maxlength="${maxChars}">${data.show || ''}</textarea>
                    <span class="char-counter">${(data.show || '').length}/${maxChars}</span>
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
                    <textarea class="prompt-input" data-field="action" rows="2" maxlength="${maxChars}">${data.action || ''}</textarea>
                    <span class="char-counter">${(data.action || '').length}/${maxChars}</span>
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
                    <textarea class="prompt-input" data-field="narration" rows="2" maxlength="${maxChars}">${data.narration || ''}</textarea>
                    <span class="char-counter">${(data.narration || '').length}/${maxChars}</span>
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
                Add Object (${(data.objects || []).length}/${tier.maxObjectsPerScene})
            </button>
        </div>
    `;
    
    return card;
}

// ===== CREATE OBJECT HTML =====
function createObjectHTML(sceneId, obj = {}, index = 0) {
    const objId = obj.id || Date.now() + index;
    const tier = TIERS[currentTier];
    const maxChars = tier.maxCharsPerField;
    
    return `
        <div class="object-item" data-object-id="${objId}">
            <div class="object-header">
                <span class="object-num">${index + 1}</span>
                <input type="text" class="object-name" placeholder="Name" value="${obj.name || ''}" data-field="name" maxlength="${maxChars}">
                <button class="btn-remove-obj" onclick="removeObject(${sceneId}, ${objId})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <textarea class="obj-field" placeholder="Description" data-field="description" rows="1" maxlength="${maxChars}">${obj.description || ''}</textarea>
            <textarea class="obj-field" placeholder="Animation" data-field="animation" rows="1" maxlength="${maxChars}">${obj.animation || ''}</textarea>
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
    
    // Check object limit for current tier
    const tier = TIERS[currentTier];
    const maxObjects = tier.maxObjectsPerScene;
    
    if (scene.objects.length >= maxObjects) {
        showNotification(`Object limit reached (${maxObjects} per scene). Upgrade for more!`, 'info');
        showUpgradeModal();
        return;
    }
    
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
    
    // Update the "Add Object" button to show remaining count
    updateAddObjectButton(sceneId);
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
        
        // Update the "Add Object" button to show remaining count
        updateAddObjectButton(sceneId);
    }, 210);
}

// ===== UPDATE ADD OBJECT BUTTON =====
function updateAddObjectButton(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    
    const tier = TIERS[currentTier];
    const maxObjects = tier.maxObjectsPerScene;
    const currentCount = (scene.objects || []).length;
    const remaining = maxObjects - currentCount;
    
    const panel = document.querySelector(`.object-details-panel[data-scene-id="${sceneId}"]`);
    if (!panel) return;
    
    const addBtn = panel.querySelector('.btn-add-object');
    if (addBtn) {
        if (remaining <= 0) {
            addBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Limit Reached (${maxObjects})
            `;
            addBtn.classList.add('limit-reached');
        } else {
            addBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Object (${currentCount}/${maxObjects})
            `;
            addBtn.classList.remove('limit-reached');
        }
    }
}

// ===== CREATE TRANSITION BLOCK =====
function createTransitionBlock(fromId, toId, data = '') {
    const block = document.createElement('div');
    block.className = 'transition-block';
    block.dataset.from = fromId;
    block.dataset.to = toId;
    
    const maxChars = 100;  // Fixed limit for transitions
    
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
                maxlength="${maxChars}"
            >${data}</textarea>
            <span class="char-counter transition-counter">${(data || '').length}/${maxChars}</span>
        </div>
    `;
    
    return block;
}

// ===== ADD SCENE =====
function addScene() {
    const tier = TIERS[currentTier];
    
    // Check scene limit
    if (scenes.length >= tier.maxScenes) {
        showNotification(`Scene limit reached (${tier.maxScenes}). Upgrade for more scenes!`, 'info');
        showUpgradeModal();
        return;
    }
    
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
    
    // Clear cached code when scenes change
    resetCodeState();
    
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
        
        // Clear cached code when scenes change
        resetCodeState();
    }, 300);
}

// ===== RESET CODE STATE =====
function resetCodeState() {
    generatedCode = null;
    codeWasCustomized = false;
    sessionCodeViews = 0;
    updateTierUI();
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
    
    const tier = TIERS[currentTier];
    
    // Auto-resize textareas
    if (e.target.tagName === 'TEXTAREA') {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
        
        // Enforce character limit for text fields (not transition)
        if (field !== 'transition' && field !== 'duration') {
            const maxChars = tier.maxCharsPerField;
            if (e.target.value.length > maxChars) {
                e.target.value = e.target.value.substring(0, maxChars);
                showNotification(`Character limit: ${maxChars}. Upgrade for more!`, 'info');
            }
            
            // Update character counter if exists
            const counter = e.target.parentElement.querySelector('.char-counter');
            if (counter) {
                const remaining = maxChars - e.target.value.length;
                counter.textContent = `${e.target.value.length}/${maxChars}`;
                counter.classList.toggle('limit-warning', remaining < 20);
                counter.classList.toggle('limit-reached', remaining <= 0);
            }
        }
    }
    
    // Clear cached code when content changes
    resetCodeState();
    
    // Transition
    if (field === 'transition') {
        const block = e.target.closest('.transition-block');
        const fromId = parseInt(block.dataset.from);
        const toId = parseInt(block.dataset.to);
        const transition = transitions.find(t => t.from === fromId && t.to === toId);
        
        // Enforce 100 character limit for transitions
        const maxChars = 100;
        if (e.target.value.length > maxChars) {
            e.target.value = e.target.value.substring(0, maxChars);
            showNotification(`Transition limit: ${maxChars} characters`, 'info');
        }
        
        // Update character counter
        const counter = block.querySelector('.transition-counter');
        if (counter) {
            const remaining = maxChars - e.target.value.length;
            counter.textContent = `${e.target.value.length}/${maxChars}`;
            counter.classList.toggle('limit-warning', remaining < 20);
            counter.classList.toggle('limit-reached', remaining <= 0);
        }
        
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

// ===== VIEW/COPY CODE (PRO+ Only - Code First Path, Read-Only) =====
async function viewCopyCode() {
    if (isGenerating) return;
    
    // Check auth first
    if (!checkAuthBeforeAction('generate code')) return;
    
    const tier = TIERS[currentTier];
    if (!tier.hasCodeFirstOption) {
        showNotification('View/Copy code is available in Pro+ plan', 'info');
        return;
    }
    
    // Close dropdown
    advancedDropdownOpen = false;
    const dropdown = document.getElementById('advanced-dropdown');
    if (dropdown) dropdown.classList.remove('open');
    
    // Validate scenes
    const hasContent = scenes.some(s => s.show || s.action);
    if (!hasContent) {
        showNotification('Please add some content to your scenes first.', 'error');
        return;
    }
    
    isGenerating = true;
    renderBtn.disabled = true;
    const originalHTML = renderBtn.innerHTML;
    renderBtn.innerHTML = `
        <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
        </svg>
        <span>Generating...</span>
    `;
    
    try {
        const project = buildProjectJSON();
        
        const response = await fetch(`${API_URL}/generate`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ project })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.code) {
            // Cache the generated code
            generatedCode = data.code;
            codeWasCustomized = false;  // View-only, not customized
            
            // Show code editor modal (read-only)
            showCodeEditorModal(data.code, false);
            
            previewBadge.textContent = 'Code Ready';
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
        updateTierUI();
    }
}

// ===== CUSTOMIZE CODE (PRO+ Only - Code First Path) =====
async function customizeCode() {
    if (isGenerating) return;
    
    // Check auth first
    if (!checkAuthBeforeAction('generate code')) return;
    
    const tier = TIERS[currentTier];
    if (!tier.hasCodeFirstOption) {
        showNotification('Code customization is available in Pro+ plan', 'info');
        return;
    }
    
    // Close dropdown
    advancedDropdownOpen = false;
    const dropdown = document.getElementById('advanced-dropdown');
    if (dropdown) dropdown.classList.remove('open');
    
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
        <span>Generating...</span>
    `;
    
    try {
        const project = buildProjectJSON();
        
        const response = await fetch(`${API_URL}/generate`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ project })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.code) {
            // Cache the generated code
            generatedCode = data.code;
            codeWasCustomized = true;  // Mark as code-first path
            
            // Show code editor modal (editable)
            showCodeEditorModal(data.code, true);
            
            previewBadge.textContent = 'Code Ready';
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
        updateTierUI();
    }
}

// ===== SHOW CODE EDITOR MODAL (Editable - PRO+ Code-First) =====
function showCodeEditorModal(code, editable = false) {
    const existingModal = document.getElementById('code-modal');
    if (existingModal) existingModal.remove();
    
    const tier = TIERS[currentTier];
    
    const modal = document.createElement('div');
    modal.id = 'code-modal';
    modal.className = 'modal-overlay';
    
    modal.innerHTML = `
        <div class="modal-content code-editor-modal">
            <div class="modal-header">
                <div class="modal-title-group">
                    <h3>${editable ? 'Customize Your Code' : 'Generated Code'}</h3>
                    ${editable ? '<span class="edit-badge pro-plus">Editable</span>' : ''}
                </div>
                <button class="modal-close" onclick="closeCodeModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="code-editor-wrap">
                    <textarea 
                        id="code-editor" 
                        class="code-editor ${editable ? '' : 'readonly'}" 
                        ${editable ? '' : 'readonly'}
                        spellcheck="false"
                    >${escapeHtml(code)}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <div class="footer-left-actions">
                    ${tier.canCopyCode ? `
                        <button class="btn-secondary" onclick="copyCode()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                            Copy
                        </button>
                    ` : ''}
                    ${tier.canExportCode ? `
                        <button class="btn-secondary" onclick="downloadCode()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Export .py
                        </button>
                    ` : ''}
                </div>
                ${editable ? `
                    <button class="btn-primary" onclick="proceedToRender()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        Render Video
                    </button>
                ` : `
                    <button class="btn-primary" onclick="closeCodeModal()">Done</button>
                `}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Track edits if editable
    if (editable) {
        const editor = document.getElementById('code-editor');
        editor.addEventListener('input', () => {
            generatedCode = editor.value;
        });
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCodeModal();
    });
    
    document.addEventListener('keydown', handleEscapeKey);
}

// ===== SHOW CODE VIEW MODAL (Read-Only - After Render) =====
function showCodeViewModal(code) {
    const tier = TIERS[currentTier];
    
    // Check view limit for FREE tier
    if (!canViewCode()) {
        showNotification('Code view limit reached. Upgrade to Pro for unlimited views!', 'info');
        showUpgradeModal();
        return;
    }
    
    // Increment view count
    sessionCodeViews++;
    
    const existingModal = document.getElementById('code-modal');
    if (existingModal) existingModal.remove();
    
    const remainingViews = getRemainingCodeViews();
    
    const modal = document.createElement('div');
    modal.id = 'code-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-title-group">
                    <h3>Generated Manim Code</h3>
                    ${tier.maxCodeViews !== Infinity ? 
                        `<span class="edit-badge free">${remainingViews} view${remainingViews !== 1 ? 's' : ''} left</span>` : 
                        ''
                    }
                </div>
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
                ${tier.canCopyCode ? `
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
                ` : `
                    <button class="btn-secondary disabled" disabled>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        Copy (Pro)
                    </button>
                `}
                <button class="btn-primary" onclick="closeCodeModal()">Done</button>
            </div>
        </div>
    `;
    
    modal.dataset.code = code;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCodeModal();
    });
    
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
    const tier = TIERS[currentTier];
    if (!tier.canCopyCode) {
        showNotification('Upgrade to Pro to copy code', 'info');
        return;
    }
    
    const code = generatedCode || document.getElementById('code-modal')?.dataset.code;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            showNotification('Code copied to clipboard!', 'success');
        });
    }
}

function downloadCode() {
    const tier = TIERS[currentTier];
    if (!tier.canExportCode) {
        showNotification('Upgrade to Pro to export code', 'info');
        return;
    }
    
    const code = generatedCode || document.getElementById('code-modal')?.dataset.code;
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

// ===== PROCEED TO RENDER (After Code Customization - PRO+) =====
function proceedToRender() {
    closeCodeModal();
    renderVideoWithCode(generatedCode);
}

// ===== RENDER VIDEO (Main Entry Point) =====
async function renderVideo() {
    const tier = TIERS[currentTier];
    
    // If PRO+ and code was already customized, use that code
    if (tier.hasCodeFirstOption && codeWasCustomized && generatedCode) {
        await renderVideoWithCode(generatedCode);
    } else {
        // Video-first path for all tiers
        await renderVideoFirstWorkflow();
    }
}

// ===== VIDEO-FIRST WORKFLOW (All Tiers) =====
async function renderVideoFirstWorkflow() {
    if (isRendering) return;
    
    // Check auth first
    if (!checkAuthBeforeAction('render videos')) return;
    
    if (!canGenerateVideo()) {
        showNotification(`Daily limit reached. Upgrade for more videos!`, 'error');
        showUpgradeModal();
        return;
    }
    
    const hasContent = scenes.some(s => s.show || s.action);
    if (!hasContent) {
        showNotification('Please add some content to your scenes first.', 'error');
        return;
    }
    
    isRendering = true;
    videoBtn.disabled = true;
    
    // Also disable customize button if visible
    if (renderBtn) {
        renderBtn.disabled = true;
    }
    
    previewBadge.textContent = 'Working';
    previewBadge.classList.remove('rendered');
    
    try {
        const project = buildProjectJSON();
        
        // ===== STEP 1: Generate Code =====
        updateRenderStatus('Generating code...', 'code');
        
        const codeResponse = await fetch(`${API_URL}/generate`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ project })
        });
        
        if (!codeResponse.ok) {
            const error = await codeResponse.json().catch(() => ({}));
            throw new Error(error.detail || `Code generation failed: ${codeResponse.status}`);
        }
        
        const codeData = await codeResponse.json();
        
        if (!codeData.success || !codeData.code) {
            throw new Error(codeData.message || 'Code generation failed');
        }
        
        // Cache the generated code
        generatedCode = codeData.code;
        
        // ===== STEP 2: Render Video =====
        updateRenderStatus('Rendering video...', 'render');
        
        const renderResponse = await fetch(`${API_URL}/render`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ code: generatedCode, quality: 'l' })
        });
        
        if (!renderResponse.ok) {
            const error = await renderResponse.json().catch(() => ({}));
            throw new Error(error.detail || `Render failed: ${renderResponse.status}`);
        }
        
        const renderData = await renderResponse.json();
        
        // Check if code was auto-corrected (fallback mechanism)
        if (renderData.corrected) {
            // Update cached code with corrected version
            generatedCode = renderData.code;
            showNotification(`Video rendered! (Auto-corrected after ${renderData.attempts - 1} error${renderData.attempts > 2 ? 's' : ''})`, 'success');
        }
        
        if (renderData.success && renderData.video_url) {
            // Update cached code if returned
            if (renderData.code) {
                generatedCode = renderData.code;
            }
            codeWasCustomized = false;  // Video-first, so no customization
            sessionCodeViews = 0;        // Reset view count for new video
            
            // Update usage
            todayUsage.videos++;
            saveUsage();
            updateTierUI();
            
            // Show video
            const videoUrl = `${API_URL}${renderData.video_url}`;
            showVideoInPreview(videoUrl);
            
            // Add "View Code" button to preview
            addViewCodeButton();
            
            if (!renderData.corrected) {
                showNotification('Video rendered successfully!', 'success');
            }
        } else {
            throw new Error(renderData.message || 'Render failed');
        }
        
    } catch (error) {
        console.error('Render error:', error);
        showNotification(`Error: ${error.message}`, 'error');
        previewBadge.textContent = 'Error';
    } finally {
        isRendering = false;
        videoBtn.disabled = false;
        if (renderBtn) {
            renderBtn.disabled = false;
        }
        resetRenderStatus();
        updateTierUI();
    }
}

// ===== RENDER STATUS HELPERS =====
function updateRenderStatus(message, phase) {
    const icon = phase === 'code' ? 
        '<svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' :
        '<svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    
    videoBtn.innerHTML = `
        ${icon}
        <span class="render-status-text">${message}</span>
    `;
    
    previewBadge.textContent = phase === 'code' ? 'Generating' : 'Rendering';
}

function resetRenderStatus() {
    videoBtn.innerHTML = `
        <span class="btn-shine"></span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Render Video</span>
    `;
}

// ===== RENDER WITH EXISTING CODE (PRO+ Code-First Path) =====
async function renderVideoWithCode(code) {
    if (isRendering) return;
    
    // Check auth first
    if (!checkAuthBeforeAction('render videos')) return;
    
    if (!canGenerateVideo()) {
        showNotification(`Daily limit reached. Upgrade for more videos!`, 'error');
        showUpgradeModal();
        return;
    }
    
    isRendering = true;
    videoBtn.disabled = true;
    videoBtn.innerHTML = `
        <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
        </svg>
        <span>Rendering...</span>
    `;
    
    if (renderBtn) {
        renderBtn.disabled = true;
    }
    
    previewBadge.textContent = 'Rendering';
    previewBadge.classList.remove('rendered');
    
    try {
        // Send pre-generated/customized code to render endpoint
        const response = await fetch(`${API_URL}/render`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ code, quality: 'l' })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.video_url) {
            // Update usage
            todayUsage.videos++;
            saveUsage();
            
            // Show video
            const videoUrl = `${API_URL}${data.video_url}`;
            showVideoInPreview(videoUrl);
            
            // Add "View Code" button
            addViewCodeButton();
            
            // Reset for next project
            codeWasCustomized = false;
            sessionCodeViews = 0;
            
            updateTierUI();
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
        if (renderBtn) {
            renderBtn.disabled = false;
        }
        updateTierUI();
    }
}

// ===== SHOW VIDEO IN PREVIEW =====
function showVideoInPreview(videoUrl) {
    const previewVideo = document.getElementById('preview-video');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    
    previewVideo.src = videoUrl;
    previewVideo.style.display = 'block';
    previewPlaceholder.style.display = 'none';
    
    previewOpen = true;
    previewPanel.classList.add('open');
    
    previewBadge.textContent = 'Ready';
    previewBadge.classList.add('rendered');
    
    downloadVideoFile(videoUrl);
}

// ===== ADD VIEW CODE BUTTON (In Preview Panel) =====
function addViewCodeButton() {
    if (!generatedCode) return;
    
    const tier = TIERS[currentTier];
    
    // Don't show button for FREE tier (no code access)
    if (tier.maxCodeViews === 0) return;
    
    const previewHeader = document.querySelector('.preview-header');
    const existingBtn = previewHeader.querySelector('.btn-view-code');
    if (existingBtn) existingBtn.remove();
    
    const remainingViews = getRemainingCodeViews();
    
    const viewCodeBtn = document.createElement('button');
    viewCodeBtn.className = 'btn-view-code';
    viewCodeBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
        View Code ${tier.maxCodeViews !== Infinity ? `(${remainingViews})` : ''}
    `;
    viewCodeBtn.onclick = () => showCodeViewModal(generatedCode);
    
    previewHeader.insertBefore(viewCodeBtn, previewHeader.querySelector('.preview-close'));
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

// ===== UPGRADE MODAL =====
function showUpgradeModal() {
    const existingModal = document.getElementById('upgrade-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'upgrade-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content upgrade-modal">
            <div class="modal-header">
                <h3>Upgrade Your Plan</h3>
                <button class="modal-close" onclick="closeUpgradeModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="tier-cards">
                    <div class="tier-card ${currentTier === 'FREE' ? 'current' : ''}">
                        <div class="tier-name">Free</div>
                        <div class="tier-price">$0</div>
                        <ul class="tier-features">
                            <li>3 videos/day</li>
                            <li>3 AI autofills/day</li>
                            <li>6 scenes max</li>
                            <li>150 chars/field</li>
                            <li style="text-decoration: line-through; opacity: 0.5;">No code access</li>
                        </ul>
                        ${currentTier === 'FREE' ? '<button class="btn-current" disabled>Current Plan</button>' : ''}
                    </div>
                    <div class="tier-card featured ${currentTier === 'PRO' ? 'current' : ''}">
                        <div class="tier-badge-label">Popular</div>
                        <div class="tier-name">Pro</div>
                        <div class="tier-price">$10<span>/mo</span></div>
                        <ul class="tier-features">
                            <li>10 videos/day</li>
                            <li>10 AI autofills/day</li>
                            <li>15 scenes max</li>
                            <li>400 chars/field</li>
                            <li>View & copy code (unlimited)</li>
                        </ul>
                        ${currentTier === 'PRO' ? 
                            '<button class="btn-current" disabled>Current Plan</button>' : 
                            '<button class="btn-upgrade" onclick="selectTier(\'PRO\')">Upgrade</button>'
                        }
                    </div>
                    <div class="tier-card ${currentTier === 'PRO_PLUS' ? 'current' : ''}">
                        <div class="tier-name">Pro+</div>
                        <div class="tier-price">$25<span>/mo</span></div>
                        <ul class="tier-features">
                            <li>30 videos/day</li>
                            <li>30 AI autofills/day</li>
                            <li>50 scenes max</li>
                            <li>1000 chars/field</li>
                            <li>Customize code before render</li>
                        </ul>
                        ${currentTier === 'PRO_PLUS' ? 
                            '<button class="btn-current" disabled>Current Plan</button>' : 
                            '<button class="btn-upgrade" onclick="selectTier(\'PRO_PLUS\')">Upgrade</button>'
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeUpgradeModal();
    });
}

function closeUpgradeModal() {
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.remove();
}

function selectTier(tier) {
    // Tier is controlled by backend only - no frontend tier changes allowed
    // In production, this will redirect to payment provider (LemonSqueezy)
    showNotification('Payment integration coming soon! Contact support for upgrades.', 'info');
    closeUpgradeModal();
    
    // TODO: Redirect to payment URL
    // window.location.href = `https://your-lemonsqueezy-store.lemonsqueezy.com/checkout/buy/${tier}`;
}

// ===== TIER SELECTOR (Removed - Tier controlled by backend) =====
// To upgrade users: Go to Supabase Dashboard → Table Editor → users → change subscription_tier
function showTierSelector() {
    // Disabled - tier is now controlled via Supabase dashboard
    showNotification('Contact support to upgrade your plan', 'info');
}

function closeTierSelector() {
    const modal = document.getElementById('tier-selector-modal');
    if (modal) modal.remove();
}

function setDemoTier(tier) {
    // Disabled - tier is now controlled via Supabase dashboard
    showNotification('Tier changes are managed by admin', 'info');
}

// ===== NOTIFICATION =====
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 4000);
}

// ===== HELPER: ESCAPE HTML =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== AUTOFILL FEATURE =====
let isAutofilling = false;

function showAutofillModal() {
    if (!canAutofill()) {
        showNotification(`Autofill limit reached (${TIERS[currentTier].autofillsPerDay}/day). Upgrade for more!`, 'info');
        showUpgradeModal();
        return;
    }
    
    const existingModal = document.getElementById('autofill-modal');
    if (existingModal) existingModal.remove();
    
    const tier = TIERS[currentTier];
    const remaining = getRemainingAutofills();
    
    const modal = document.createElement('div');
    modal.id = 'autofill-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content autofill-modal">
            <div class="modal-header">
                <div class="modal-title-group">
                    <h3>AI Autofill</h3>
                    <span class="edit-badge">${remaining} left today</span>
                </div>
                <button class="modal-close" onclick="closeAutofillModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <p class="autofill-hint">Describe what you want to explain, and AI will generate scene content for you.</p>
                <div class="autofill-input-group">
                    <label for="autofill-topic">Topic</label>
                    <textarea 
                        id="autofill-topic" 
                        class="autofill-textarea"
                        placeholder="e.g., Explain the Pythagorean theorem step by step with visual proofs"
                        rows="3"
                        maxlength="500"
                    ></textarea>
                    <span class="autofill-char-count"><span id="topic-char-count">0</span>/500</span>
                </div>
                <div class="autofill-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <span>Will generate up to ${tier.maxScenes} scenes with ${tier.maxCharsPerField} chars/field</span>
                </div>
            </div>
            <div class="modal-footer">
                <label class="autofill-replace-option">
                    <input type="checkbox" id="autofill-replace" checked>
                    <span>Replace existing scenes</span>
                </label>
                <button class="btn-primary" id="autofill-submit" onclick="executeAutofill()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                    </svg>
                    Generate Scenes
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Character counter
    const topicInput = document.getElementById('autofill-topic');
    const charCount = document.getElementById('topic-char-count');
    topicInput.addEventListener('input', () => {
        charCount.textContent = topicInput.value.length;
    });
    
    // Focus input
    setTimeout(() => topicInput.focus(), 100);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAutofillModal();
    });
    
    // Close on Escape
    document.addEventListener('keydown', handleAutofillEscape);
}

function handleAutofillEscape(e) {
    if (e.key === 'Escape') closeAutofillModal();
}

function closeAutofillModal() {
    const modal = document.getElementById('autofill-modal');
    if (modal) {
        modal.remove();
        document.removeEventListener('keydown', handleAutofillEscape);
    }
}

async function executeAutofill() {
    if (isAutofilling) return;
    
    // Check auth first
    if (!checkAuthBeforeAction('use AI autofill')) {
        closeAutofillModal();
        return;
    }
    
    const topicInput = document.getElementById('autofill-topic');
    const topic = topicInput.value.trim();
    
    if (!topic || topic.length < 3) {
        showNotification('Please enter a topic (at least 3 characters)', 'error');
        return;
    }
    
    const replaceExisting = document.getElementById('autofill-replace').checked;
    const tier = TIERS[currentTier];
    
    isAutofilling = true;
    const submitBtn = document.getElementById('autofill-submit');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
        </svg>
        Generating...
    `;
    
    try {
        const response = await fetch(`${API_URL}/autofill`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                topic: topic,
                max_chars_per_field: tier.maxCharsPerField,
                max_scenes: tier.maxScenes
            })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.scenes && data.scenes.length > 0) {
            // Update usage
            todayUsage.autofills++;
            saveUsage();
            
            // Apply scenes
            applyAutofillScenes(data.scenes, replaceExisting);
            
            closeAutofillModal();
            showNotification(`Generated ${data.scenes.length} scenes!`, 'success');
            
            // Reset code state since content changed
            resetCodeState();
        } else {
            throw new Error(data.message || 'No scenes generated');
        }
        
    } catch (error) {
        console.error('Autofill error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        isAutofilling = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
    }
}

function applyAutofillScenes(generatedScenes, replaceExisting) {
    if (replaceExisting) {
        // Clear existing scenes
        scenes = [];
        transitions = [];
        sceneCounter = 0;
    }
    
    // Add generated scenes
    generatedScenes.forEach((sceneData, index) => {
        sceneCounter++;
        const id = sceneCounter;
        
        // Add transition if not first scene
        if (scenes.length > 0) {
            const lastScene = scenes[scenes.length - 1];
            transitions.push({
                from: lastScene.id,
                to: id,
                description: sceneData.transitionToNext || ''
            });
        }
        
        scenes.push({
            id,
            show: sceneData.show || '',
            action: sceneData.animations || '',
            narration: sceneData.detailing || '',
            duration: sceneData.duration || DEFAULT_DURATION,
            objects: []
        });
    });
    
    // Re-render
    renderTimeline();
    updateSceneCount();
    
    // Scroll to first scene
    setTimeout(() => {
        timelineWrapper.scrollTo({ left: 0, behavior: 'smooth' });
    }, 100);
}

// ===== SAVE/LOAD SCENE CONFIGURATIONS =====
const SAVED_CONFIGS_KEY = 'flowmotion_saved_configs';

function getSavedConfigs() {
    const stored = localStorage.getItem(SAVED_CONFIGS_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveConfigs(configs) {
    localStorage.setItem(SAVED_CONFIGS_KEY, JSON.stringify(configs));
}

function showSaveModal() {
    // Check if there's content to save
    const hasContent = scenes.some(s => s.show || s.action || s.narration);
    if (!hasContent) {
        showNotification('Add some content to your scenes before saving', 'error');
        return;
    }
    
    const existingModal = document.getElementById('save-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'save-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content save-modal">
            <div class="modal-header">
                <h3>Save Configuration</h3>
                <button class="modal-close" onclick="closeSaveModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="save-input-group">
                    <label for="config-name">Configuration Name</label>
                    <input 
                        type="text" 
                        id="config-name" 
                        class="save-input"
                        placeholder="e.g., Pythagorean Theorem Tutorial"
                        maxlength="50"
                    >
                </div>
                <p class="save-info">${scenes.length} scenes will be saved</p>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeSaveModal()">Cancel</button>
                <button class="btn-primary" onclick="executeSave()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    Save
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => document.getElementById('config-name').focus(), 100);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSaveModal();
    });
}

function closeSaveModal() {
    const modal = document.getElementById('save-modal');
    if (modal) modal.remove();
}

function executeSave() {
    const nameInput = document.getElementById('config-name');
    const name = nameInput.value.trim();
    
    if (!name) {
        showNotification('Please enter a name for this configuration', 'error');
        return;
    }
    
    const configs = getSavedConfigs();
    
    // Check for duplicate names
    const existingIndex = configs.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
    if (existingIndex !== -1) {
        if (!confirm(`"${name}" already exists. Replace it?`)) {
            return;
        }
        configs.splice(existingIndex, 1);
    }
    
    // Build configuration
    const config = {
        name,
        savedAt: new Date().toISOString(),
        scenes: scenes.map(s => ({
            show: s.show,
            action: s.action,
            narration: s.narration,
            duration: s.duration,
            objects: s.objects || []
        })),
        transitions: transitions.map(t => ({
            description: t.description
        }))
    };
    
    configs.unshift(config); // Add to beginning
    
    // Limit to 20 saved configs
    if (configs.length > 20) {
        configs.pop();
    }
    
    saveConfigs(configs);
    closeSaveModal();
    showNotification(`Saved "${name}"!`, 'success');
}

function showLoadModal() {
    const configs = getSavedConfigs();
    
    const existingModal = document.getElementById('load-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'load-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content load-modal">
            <div class="modal-header">
                <h3>Load Configuration</h3>
                <button class="modal-close" onclick="closeLoadModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                ${configs.length === 0 ? `
                    <div class="empty-configs">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <p>No saved configurations</p>
                        <span>Save your current scene setup to reuse later</span>
                    </div>
                ` : `
                    <div class="configs-list">
                        ${configs.map((config, index) => `
                            <div class="config-item" data-index="${index}">
                                <div class="config-info">
                                    <span class="config-name">${escapeHtml(config.name)}</span>
                                    <span class="config-meta">${config.scenes.length} scenes • ${formatDate(config.savedAt)}</span>
                                </div>
                                <div class="config-actions">
                                    <button class="btn-load-config" onclick="loadConfig(${index})" title="Load">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="8 17 12 21 16 17"/>
                                            <line x1="12" y1="12" x2="12" y2="21"/>
                                            <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
                                        </svg>
                                    </button>
                                    <button class="btn-delete-config" onclick="deleteConfig(${index})" title="Delete">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="3 6 5 6 21 6"/>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeLoadModal();
    });
}

function closeLoadModal() {
    const modal = document.getElementById('load-modal');
    if (modal) modal.remove();
}

function loadConfig(index) {
    const configs = getSavedConfigs();
    const config = configs[index];
    
    if (!config) {
        showNotification('Configuration not found', 'error');
        return;
    }
    
    // Confirm replacement
    const hasContent = scenes.some(s => s.show || s.action || s.narration);
    if (hasContent) {
        if (!confirm('This will replace your current scenes. Continue?')) {
            return;
        }
    }
    
    // Clear current scenes
    scenes = [];
    transitions = [];
    sceneCounter = 0;
    
    // Load scenes from config
    config.scenes.forEach((sceneData, i) => {
        sceneCounter++;
        const id = sceneCounter;
        
        if (scenes.length > 0) {
            const lastScene = scenes[scenes.length - 1];
            const transitionData = config.transitions[i - 1] || {};
            transitions.push({
                from: lastScene.id,
                to: id,
                description: transitionData.description || ''
            });
        }
        
        scenes.push({
            id,
            show: sceneData.show || '',
            action: sceneData.action || '',
            narration: sceneData.narration || '',
            duration: sceneData.duration || DEFAULT_DURATION,
            objects: sceneData.objects || []
        });
    });
    
    renderTimeline();
    updateSceneCount();
    resetCodeState();
    closeLoadModal();
    showNotification(`Loaded "${config.name}"`, 'success');
}

function deleteConfig(index) {
    const configs = getSavedConfigs();
    const config = configs[index];
    
    if (!config) return;
    
    if (!confirm(`Delete "${config.name}"?`)) {
        return;
    }
    
    configs.splice(index, 1);
    saveConfigs(configs);
    
    // Refresh modal
    showLoadModal();
    showNotification('Configuration deleted', 'success');
}

function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
}

// ===== INSTALL ENGINE =====
function installEngine() {
    window.open('https://github.com/flowmotion/engine', '_blank');
}

// ===== EVENT LISTENERS =====
addSceneBtn.addEventListener('click', addScene);
renderBtn.addEventListener('click', toggleAdvancedDropdown);  // Advanced dropdown
videoBtn.addEventListener('click', renderVideo);      // All tiers - Render Video
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
    
    /* Advanced Dropdown */
    .header-actions {
        position: relative;
    }
    
    .btn-advanced {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1rem;
        background: var(--surface-alt);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .btn-advanced:hover {
        background: var(--surface);
        border-color: var(--primary);
        color: var(--text);
    }
    
    .btn-advanced .dropdown-arrow {
        transition: transform 0.2s ease;
    }
    
    .advanced-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        min-width: 220px;
        background: white;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        opacity: 0;
        visibility: hidden;
        transform: translateY(-10px);
        transition: all 0.2s ease;
        z-index: 100;
        overflow: hidden;
    }
    
    .advanced-dropdown.open {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
    }
    
    .dropdown-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.75rem 1rem;
        background: none;
        border: none;
        color: var(--text);
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: left;
    }
    
    .dropdown-item:hover {
        background: var(--surface-alt);
    }
    
    .dropdown-item.locked {
        color: var(--text-muted);
        cursor: not-allowed;
    }
    
    .dropdown-item.locked:hover {
        background: var(--surface-alt);
    }
    
    .dropdown-item .lock-icon {
        margin-left: auto;
        opacity: 0.5;
    }
    
    .dropdown-item.upgrade-item {
        color: var(--primary);
        font-weight: 500;
    }
    
    .dropdown-item.upgrade-item:hover {
        background: rgba(16, 185, 129, 0.1);
    }
    
    .dropdown-item.upgrade-item svg:last-child {
        margin-left: auto;
    }
    
    .dropdown-divider {
        height: 1px;
        background: var(--border);
        margin: 0.25rem 0;
    }
    
    /* Character Counter */
    .char-counter {
        position: absolute;
        bottom: 4px;
        right: 8px;
        font-size: 0.65rem;
        color: var(--text-muted);
        opacity: 0.6;
        pointer-events: none;
        transition: all 0.2s ease;
    }
    
    .prompt-input-wrap,
    .transition-input-wrap {
        position: relative;
    }
    
    .prompt-input:focus + .char-counter,
    .transition-input:focus + .transition-counter {
        opacity: 1;
    }
    
    .transition-counter {
        bottom: 6px;
        right: 10px;
    }
    
    .char-counter.limit-warning {
        color: #f59e0b;
        opacity: 1;
    }
    
    .char-counter.limit-reached {
        color: #ef4444;
        opacity: 1;
        font-weight: 600;
    }
    
    /* Scene Count Limits */
    .scene-count.limit-warning {
        color: #f59e0b;
    }
    
    .scene-count.limit-reached {
        color: #ef4444;
        font-weight: 600;
    }
    
    /* Tier Badge */
    .tier-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .tier-badge:hover {
        transform: scale(1.05);
    }
    
    .tier-free {
        background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
        color: #374151;
    }
    
    .tier-pro {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
    }
    
    .tier-pro-plus {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        color: white;
    }
    
    /* Usage Display */
    .usage-display {
        font-size: 0.75rem;
        color: var(--text-muted);
        margin-left: 0.5rem;
    }
    
    /* Code Editor Modal */
    .code-editor-modal .modal-body {
        padding: 0;
    }
    
    .code-editor-wrap {
        position: relative;
        height: 400px;
    }
    
    .code-editor {
        width: 100%;
        height: 100%;
        background: #1f2937;
        color: #e5e7eb;
        border: none;
        padding: 16px;
        font-family: 'Fira Code', 'Consolas', monospace;
        font-size: 13px;
        line-height: 1.5;
        resize: none;
        outline: none;
    }
    
    .code-editor.readonly {
        opacity: 0.8;
        cursor: default;
    }
    
    .modal-title-group {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .edit-badge {
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 500;
    }
    
    .edit-badge.free {
        background: #fef3c7;
        color: #92400e;
    }
    
    .edit-badge.pro-plus {
        background: #ede9fe;
        color: #7c3aed;
    }
    
    .footer-left-actions {
        display: flex;
        gap: 8px;
        flex: 1;
    }
    
    .btn-secondary.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    /* View Code Button in Preview */
    .btn-view-code {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.4rem 0.75rem;
        background: var(--surface-alt);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-right: auto;
    }
    
    .btn-view-code:hover {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
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
        min-width: 44px;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .modal-close:hover {
        background: #f3f4f6;
        color: #1f2937;
    }
    
    .modal-body {
        flex: 1;
        overflow: auto;
        padding: 20px;
        -webkit-overflow-scrolling: touch;
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
        -webkit-overflow-scrolling: touch;
    }
    
    .modal-footer {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        padding: 16px 20px;
        border-top: 1px solid #e5e7eb;
        flex-wrap: wrap;
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
        min-height: 44px;
    }
    
    .btn-secondary:hover {
        background: #e5e7eb;
    }
    
    .btn-secondary:active {
        transform: scale(0.98);
    }
    
    .btn-primary {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 20px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        min-height: 44px;
    }
    
    .btn-primary:hover {
        background: #059669;
    }
    
    .btn-primary:active {
        transform: scale(0.98);
    }
    
    /* Upgrade Modal */
    .upgrade-modal {
        max-width: 900px;
    }
    
    .tier-cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.5rem;
    }
    
    .tier-card {
        background: var(--surface-alt);
        border: 2px solid var(--border);
        border-radius: 12px;
        padding: 1.5rem;
        text-align: center;
        position: relative;
        transition: all 0.2s ease;
    }
    
    .tier-card.featured {
        border-color: var(--primary);
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(52, 211, 153, 0.02));
    }
    
    .tier-card.current {
        border-color: var(--primary);
    }
    
    .tier-badge-label {
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--primary);
        color: white;
        padding: 0.2rem 0.75rem;
        border-radius: 20px;
        font-size: 0.7rem;
        font-weight: 600;
    }
    
    .tier-name {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 0.5rem;
    }
    
    .tier-price {
        font-size: 2rem;
        font-weight: 700;
        color: var(--primary-dark);
        margin-bottom: 1rem;
    }
    
    .tier-price span {
        font-size: 0.9rem;
        font-weight: 400;
        color: var(--text-muted);
    }
    
    .tier-features {
        list-style: none;
        text-align: left;
        margin-bottom: 1.5rem;
    }
    
    .tier-features li {
        padding: 0.4rem 0;
        font-size: 0.85rem;
        color: var(--text-secondary);
        position: relative;
        padding-left: 1.5rem;
    }
    
    .tier-features li::before {
        content: '✓';
        position: absolute;
        left: 0;
        color: var(--primary);
        font-weight: 700;
    }
    
    .btn-upgrade {
        width: 100%;
        padding: 0.75rem;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .btn-upgrade:hover {
        background: var(--primary-dark);
        transform: translateY(-2px);
    }
    
    .btn-current {
        width: 100%;
        padding: 0.75rem;
        background: var(--surface);
        color: var(--text-muted);
        border: 1px solid var(--border);
        border-radius: 8px;
        font-weight: 500;
        cursor: default;
    }
    
    /* Tier Selector (Demo) */
    .tier-selector-modal {
        max-width: 400px;
    }
    
    .tier-selector-buttons {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    
    .tier-select-btn {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 1rem;
        background: var(--surface-alt);
        border: 2px solid var(--border);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .tier-select-btn:hover {
        border-color: var(--primary);
        background: rgba(16, 185, 129, 0.05);
    }
    
    .tier-select-btn.active {
        border-color: var(--primary);
        background: rgba(16, 185, 129, 0.1);
    }
    
    .tier-select-btn strong {
        font-size: 1rem;
        color: var(--text);
    }
    
    .tier-select-btn span {
        font-size: 0.8rem;
        color: var(--text-muted);
    }
    
    /* Notification Styles */
    .notification {
        position: fixed;
        bottom: 80px;
        right: 20px;
        left: 20px;
        max-width: 400px;
        margin-left: auto;
        padding: 12px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 1001;
        animation: slideInNotification 0.3s ease;
    }
    
    @keyframes slideInNotification {
        from {
            transform: translateY(20px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
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
        min-width: 44px;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }
    
    .notification button:hover {
        opacity: 1;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
        .modal-overlay {
            padding: 16px;
        }
        
        .modal-content {
            max-height: 85vh;
        }
        
        .tier-cards {
            grid-template-columns: 1fr;
        }
        
        .code-editor-wrap {
            height: 300px;
        }
        
        .usage-display {
            display: none;
        }
    }
    
    @media (max-width: 480px) {
        .modal-overlay {
            padding: 0;
            align-items: flex-end;
        }
        
        .modal-content {
            max-width: 100%;
            max-height: 90vh;
            border-radius: 16px 16px 0 0;
        }
        
        .code-editor-wrap {
            height: 250px;
        }
        
        .footer-left-actions {
            flex-wrap: wrap;
        }
        
        .modal-footer {
            flex-direction: column;
        }
        
        .modal-footer .btn-primary {
            order: -1;
            width: 100%;
            justify-content: center;
        }
    }
    
    @supports (padding-bottom: env(safe-area-inset-bottom)) {
        .modal-content {
            padding-bottom: env(safe-area-inset-bottom);
        }
        
        .notification {
            bottom: calc(80px + env(safe-area-inset-bottom));
        }
    }
    
    /* Autofill Modal */
    .autofill-modal {
        max-width: 500px;
    }
    
    .autofill-hint {
        color: var(--text-secondary);
        font-size: 0.9rem;
        margin-bottom: 1rem;
    }
    
    .autofill-input-group {
        position: relative;
        margin-bottom: 1rem;
    }
    
    .autofill-input-group label {
        display: block;
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--text);
        margin-bottom: 0.5rem;
    }
    
    .autofill-textarea {
        width: 100%;
        padding: 12px;
        background: var(--surface-alt);
        border: 1px solid var(--border);
        border-radius: 8px;
        font-size: 0.95rem;
        color: var(--text);
        resize: vertical;
        min-height: 80px;
        font-family: inherit;
    }
    
    .autofill-textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }
    
    .autofill-char-count {
        position: absolute;
        bottom: 8px;
        right: 12px;
        font-size: 0.7rem;
        color: var(--text-muted);
    }
    
    .autofill-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        background: rgba(16, 185, 129, 0.05);
        border: 1px solid rgba(16, 185, 129, 0.2);
        border-radius: 6px;
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    
    .autofill-info svg {
        flex-shrink: 0;
        color: var(--primary);
    }
    
    .autofill-replace-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        color: var(--text-secondary);
        cursor: pointer;
        margin-right: auto;
    }
    
    .autofill-replace-option input[type="checkbox"] {
        width: 16px;
        height: 16px;
        accent-color: var(--primary);
    }
    
    /* Save/Load Modals */
    .save-modal,
    .load-modal {
        max-width: 450px;
    }
    
    .save-input-group {
        margin-bottom: 1rem;
    }
    
    .save-input-group label {
        display: block;
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--text);
        margin-bottom: 0.5rem;
    }
    
    .save-input {
        width: 100%;
        padding: 12px;
        background: var(--surface-alt);
        border: 1px solid var(--border);
        border-radius: 8px;
        font-size: 0.95rem;
        color: var(--text);
    }
    
    .save-input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }
    
    .save-info {
        font-size: 0.85rem;
        color: var(--text-muted);
    }
    
    .empty-configs {
        text-align: center;
        padding: 2rem;
        color: var(--text-muted);
    }
    
    .empty-configs svg {
        margin-bottom: 1rem;
        opacity: 0.5;
    }
    
    .empty-configs p {
        font-size: 1rem;
        color: var(--text-secondary);
        margin-bottom: 0.25rem;
    }
    
    .empty-configs span {
        font-size: 0.85rem;
    }
    
    .configs-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 300px;
        overflow-y: auto;
    }
    
    .config-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: var(--surface-alt);
        border: 1px solid var(--border);
        border-radius: 8px;
        transition: all 0.2s ease;
    }
    
    .config-item:hover {
        border-color: var(--primary);
        background: rgba(16, 185, 129, 0.02);
    }
    
    .config-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    
    .config-name {
        font-weight: 500;
        color: var(--text);
    }
    
    .config-meta {
        font-size: 0.75rem;
        color: var(--text-muted);
    }
    
    .config-actions {
        display: flex;
        gap: 0.5rem;
    }
    
    .btn-load-config,
    .btn-delete-config {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: 1px solid var(--border);
        border-radius: 6px;
        cursor: pointer;
        color: var(--text-secondary);
        transition: all 0.2s ease;
    }
    
    .btn-load-config:hover {
        background: var(--primary);
        border-color: var(--primary);
        color: white;
    }
    
    .btn-delete-config:hover {
        background: #ef4444;
        border-color: #ef4444;
        color: white;
    }
    
    /* Add Object Button Limit */
    .btn-add-object.limit-reached {
        background: var(--surface-alt);
        color: var(--text-muted);
        cursor: not-allowed;
        opacity: 0.7;
    }
    
    .btn-add-object.limit-reached:hover {
        background: var(--surface-alt);
        border-color: var(--border);
    }
    
    /* Toolbar Buttons */
    .btn-autofill,
    .btn-save,
    .btn-load {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 0.75rem;
        background: var(--surface-alt);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .btn-autofill:hover,
    .btn-save:hover,
    .btn-load:hover {
        background: var(--surface);
        border-color: var(--primary);
        color: var(--text);
    }
    
    .btn-autofill {
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(16, 185, 129, 0.1));
        border-color: rgba(139, 92, 246, 0.3);
        color: #8b5cf6;
    }
    
    .btn-autofill:hover {
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(16, 185, 129, 0.2));
        border-color: #8b5cf6;
    }
    
    .toolbar-divider {
        width: 1px;
        height: 24px;
        background: var(--border);
        margin: 0 0.25rem;
    }
    
    /* Dev Badge */
    .dev-badge {
        position: fixed;
        top: 80px;
        right: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
        font-size: 10px;
        font-weight: 700;
        border-radius: 4px;
        z-index: 9999;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    /* Footer Links */
    .footer-links {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .footer-link {
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 0.75rem;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        transition: all 0.2s ease;
    }
    
    .footer-link:hover {
        color: var(--primary);
        background: rgba(16, 185, 129, 0.1);
    }
    
    .footer-divider {
        color: var(--text-muted);
        opacity: 0.5;
        font-size: 0.5rem;
    }
    
    /* Legal Modal */
    .legal-modal {
        max-width: 700px;
        max-height: 80vh;
    }
    
    .legal-modal .modal-body {
        max-height: 60vh;
        overflow-y: auto;
    }
    
    .legal-content h2 {
        font-size: 1.25rem;
        color: var(--text);
        margin: 1.5rem 0 0.75rem 0;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid var(--border);
    }
    
    .legal-content h2:first-child {
        margin-top: 0;
    }
    
    .legal-content p {
        color: var(--text-secondary);
        font-size: 0.9rem;
        line-height: 1.6;
        margin-bottom: 1rem;
    }
    
    .legal-content ul {
        color: var(--text-secondary);
        font-size: 0.9rem;
        line-height: 1.6;
        margin-bottom: 1rem;
        padding-left: 1.5rem;
    }
    
    .legal-content li {
        margin-bottom: 0.5rem;
    }
    
    .legal-content .highlight {
        background: rgba(16, 185, 129, 0.1);
        padding: 1rem;
        border-radius: 8px;
        border-left: 3px solid var(--primary);
    }
    
    .legal-content .last-updated {
        font-size: 0.8rem;
        color: var(--text-muted);
        font-style: italic;
    }
    
    /* Pricing Modal */
    .pricing-modal {
        max-width: 950px;
    }
    
    .pricing-header {
        text-align: center;
        margin-bottom: 2rem;
    }
    
    .pricing-header h2 {
        font-size: 1.75rem;
        color: var(--text);
        margin-bottom: 0.5rem;
    }
    
    .pricing-header p {
        color: var(--text-muted);
    }
    
    .pricing-cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.5rem;
    }
    
    .pricing-card {
        background: var(--surface-alt);
        border: 2px solid var(--border);
        border-radius: 16px;
        padding: 1.5rem;
        position: relative;
        transition: all 0.2s ease;
    }
    
    .pricing-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
    }
    
    .pricing-card.featured {
        border-color: var(--primary);
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(52, 211, 153, 0.02));
    }
    
    .pricing-card.featured::before {
        content: 'Most Popular';
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--primary);
        color: white;
        padding: 0.25rem 1rem;
        border-radius: 20px;
        font-size: 0.7rem;
        font-weight: 600;
    }
    
    .pricing-card-header {
        text-align: center;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border);
        margin-bottom: 1rem;
    }
    
    .pricing-card-name {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text);
    }
    
    .pricing-card-price {
        font-size: 2.5rem;
        font-weight: 700;
        color: var(--primary-dark);
        margin: 0.5rem 0;
    }
    
    .pricing-card-price span {
        font-size: 1rem;
        font-weight: 400;
        color: var(--text-muted);
    }
    
    .pricing-card-desc {
        font-size: 0.85rem;
        color: var(--text-muted);
    }
    
    .pricing-features {
        list-style: none;
        padding: 0;
        margin: 0 0 1.5rem 0;
    }
    
    .pricing-features li {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        padding: 0.5rem 0;
        font-size: 0.85rem;
        color: var(--text-secondary);
    }
    
    .pricing-features li svg {
        flex-shrink: 0;
        color: var(--primary);
        margin-top: 2px;
    }
    
    .pricing-features li.disabled {
        color: var(--text-muted);
        text-decoration: line-through;
    }
    
    .pricing-features li.disabled svg {
        color: var(--text-muted);
    }
    
    .pricing-card-btn {
        width: 100%;
        padding: 0.75rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .pricing-card-btn.primary {
        background: var(--primary);
        color: white;
        border: none;
    }
    
    .pricing-card-btn.primary:hover {
        background: var(--primary-dark);
    }
    
    .pricing-card-btn.secondary {
        background: transparent;
        color: var(--text);
        border: 1px solid var(--border);
    }
    
    .pricing-card-btn.secondary:hover {
        border-color: var(--primary);
        color: var(--primary);
    }
    
    .pricing-note {
        text-align: center;
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--border);
        font-size: 0.8rem;
        color: var(--text-muted);
    }
    
    @media (max-width: 768px) {
        .pricing-cards {
            grid-template-columns: 1fr;
        }
        
        .footer-links {
            display: none;
        }
    }
`;
document.head.appendChild(style);

// ===== PRICING MODAL =====
function showPricingModal() {
    const existingModal = document.getElementById('pricing-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'pricing-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content pricing-modal">
            <div class="modal-header">
                <h3>Choose Your Plan</h3>
                <button class="modal-close" onclick="closePricingModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="pricing-header">
                    <h2>Simple, Transparent Pricing</h2>
                    <p>Start free, upgrade when you need more power</p>
                </div>
                
                <div class="pricing-cards">
                    <!-- Free -->
                    <div class="pricing-card">
                        <div class="pricing-card-header">
                            <div class="pricing-card-name">Free</div>
                            <div class="pricing-card-price">$0<span>/month</span></div>
                            <div class="pricing-card-desc">Perfect for getting started</div>
                        </div>
                        <ul class="pricing-features">
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span><strong>3</strong> videos per day</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span><strong>3</strong> AI autofills per day</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>Up to <strong>6</strong> scenes</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>150 characters per field</span>
                            </li>
                            <li class="disabled">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                <span>View/Copy code</span>
                            </li>
                            <li class="disabled">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                <span>Export code</span>
                            </li>
                        </ul>
                        <button class="pricing-card-btn secondary" onclick="closePricingModal()">Current Plan</button>
                    </div>
                    
                    <!-- Pro -->
                    <div class="pricing-card featured">
                        <div class="pricing-card-header">
                            <div class="pricing-card-name">Pro</div>
                            <div class="pricing-card-price">$10<span>/month</span></div>
                            <div class="pricing-card-desc">For regular creators</div>
                        </div>
                        <ul class="pricing-features">
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span><strong>10</strong> videos per day</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span><strong>10</strong> AI autofills per day</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>Up to <strong>15</strong> scenes</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>400 characters per field</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>Unlimited code views</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>Copy & Export code</span>
                            </li>
                        </ul>
                        <button class="pricing-card-btn primary" onclick="selectTier('PRO'); closePricingModal();">Upgrade to Pro</button>
                    </div>
                    
                    <!-- Pro+ -->
                    <div class="pricing-card">
                        <div class="pricing-card-header">
                            <div class="pricing-card-name">Pro+</div>
                            <div class="pricing-card-price">$25<span>/month</span></div>
                            <div class="pricing-card-desc">For power users</div>
                        </div>
                        <ul class="pricing-features">
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span><strong>30</strong> videos per day</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span><strong>30</strong> AI autofills per day</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>Up to <strong>50</strong> scenes</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>1000 characters per field</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>Customize code before render</span>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>Priority rendering</span>
                            </li>
                        </ul>
                        <button class="pricing-card-btn primary" onclick="selectTier('PRO_PLUS'); closePricingModal();">Upgrade to Pro+</button>
                    </div>
                </div>
                
                <div class="pricing-note">
                    🔒 Secure payments via Stripe • Cancel anytime • All sales final (no refunds)
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePricingModal();
    });
}

function closePricingModal() {
    const modal = document.getElementById('pricing-modal');
    if (modal) modal.remove();
}

// ===== TERMS OF SERVICE MODAL =====
function showTermsModal() {
    const existingModal = document.getElementById('terms-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'terms-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content legal-modal">
            <div class="modal-header">
                <h3>Terms of Service</h3>
                <button class="modal-close" onclick="closeTermsModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="legal-content">
                    <p class="last-updated">Last updated: January 2026</p>
                    
                    <h2>1. Acceptance of Terms</h2>
                    <p>By accessing or using FlowMotion ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
                    
                    <h2>2. Description of Service</h2>
                    <p>FlowMotion is a web-based platform that allows users to create mathematical animations using a visual interface. The Service generates Manim code and renders videos based on user input.</p>
                    
                    <h2>3. User Accounts</h2>
                    <ul>
                        <li>You must provide accurate information when creating an account</li>
                        <li>You are responsible for maintaining the security of your account</li>
                        <li>You must be at least 13 years old to use this Service</li>
                        <li>One person or entity may not maintain more than one free account</li>
                    </ul>
                    
                    <h2>4. Acceptable Use</h2>
                    <p>You agree NOT to use the Service to:</p>
                    <ul>
                        <li>Generate illegal, harmful, or offensive content</li>
                        <li>Violate any applicable laws or regulations</li>
                        <li>Infringe on intellectual property rights of others</li>
                        <li>Attempt to bypass usage limits or security measures</li>
                        <li>Resell or redistribute the Service without permission</li>
                    </ul>
                    
                    <h2>5. Content Ownership & AI Training</h2>
                    <div class="highlight">
                        <p><strong>Your Content:</strong> You retain ownership of all content you create using FlowMotion. Videos and code generated from your input belong to you.</p>
                    </div>
                    <p>By using the Service, you grant FlowMotion a limited license to process your input for the purpose of generating animations.</p>
                    <div class="highlight" style="border-left-color: #f59e0b; background: rgba(245, 158, 11, 0.1); margin-top: 1rem;">
                        <p><strong>⚠️ AI Training:</strong> You agree that your scene configurations and generated Manim code may be used to train and improve our AI models. This data helps us provide better animation quality for all users.</p>
                    </div>
                    
                    <h2>6. Payment & Subscriptions</h2>
                    <ul>
                        <li>Paid plans are billed monthly or annually in advance</li>
                        <li>Prices are subject to change with 30 days notice</li>
                        <li><strong>All purchases are final and non-refundable</strong></li>
                        <li>You can cancel your subscription at any time (no future charges)</li>
                    </ul>
                    
                    <h2>7. Service Availability</h2>
                    <p>We strive for 99.9% uptime but do not guarantee uninterrupted service. We reserve the right to modify or discontinue features with reasonable notice.</p>
                    
                    <h2>8. Limitation of Liability</h2>
                    <p>FlowMotion is provided "as is" without warranties. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
                    
                    <h2>9. Changes to Terms</h2>
                    <p>We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
                    
                    <h2>10. Contact</h2>
                    <p>For questions about these Terms, contact us at: <strong>ummeyahyasaad@gmail.com</strong></p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-primary" onclick="closeTermsModal()">I Understand</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeTermsModal();
    });
}

function closeTermsModal() {
    const modal = document.getElementById('terms-modal');
    if (modal) modal.remove();
}

// ===== PRIVACY POLICY MODAL =====
function showPrivacyModal() {
    const existingModal = document.getElementById('privacy-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'privacy-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content legal-modal">
            <div class="modal-header">
                <h3>Privacy Policy</h3>
                <button class="modal-close" onclick="closePrivacyModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="legal-content">
                    <p class="last-updated">Last updated: January 2026</p>
                    
                    <h2>1. Information We Collect</h2>
                    <p><strong>Account Information:</strong></p>
                    <ul>
                        <li>Name and email address (from Google Sign-In)</li>
                        <li>Profile picture (optional, from Google)</li>
                        <li>Subscription status and payment history</li>
                    </ul>
                    
                    <p><strong>Usage Information:</strong></p>
                    <ul>
                        <li>Scene configurations you create</li>
                        <li>Videos rendered and features used</li>
                        <li>Technical logs (IP address, browser type)</li>
                    </ul>
                    
                    <h2>2. How We Use Your Information</h2>
                    <ul>
                        <li>To provide and improve the Service</li>
                        <li>To process payments and manage subscriptions</li>
                        <li>To send important service updates</li>
                        <li>To prevent fraud and abuse</li>
                    </ul>
                    
                    <div class="highlight">
                        <p><strong>🔒 We do NOT:</strong> Sell your personal data or share it with advertisers.</p>
                    </div>
                    
                    <div class="highlight" style="border-left-color: #f59e0b; background: rgba(245, 158, 11, 0.1); margin-top: 1rem;">
                        <p><strong>⚠️ AI Training:</strong> By using FlowMotion, you agree that your scene configurations and generated code may be used to improve and train our AI models. This helps us provide better animations for everyone.</p>
                    </div>
                    
                    <h2>3. Data Storage & Security</h2>
                    <ul>
                        <li>Data is stored securely on Supabase (PostgreSQL)</li>
                        <li>All connections are encrypted (HTTPS/TLS)</li>
                        <li>We use industry-standard security practices</li>
                        <li>Rendered videos are temporarily stored and auto-deleted</li>
                    </ul>
                    
                    <h2>4. Third-Party Services</h2>
                    <p>We use the following third-party services:</p>
                    <ul>
                        <li><strong>Google OAuth:</strong> For secure sign-in</li>
                        <li><strong>Supabase:</strong> Database and authentication</li>
                        <li><strong>Railway:</strong> Backend hosting</li>
                        <li><strong>Stripe:</strong> Payment processing (if applicable)</li>
                    </ul>
                    
                    <h2>5. Your Rights</h2>
                    <p>You have the right to:</p>
                    <ul>
                        <li><strong>Access:</strong> Request a copy of your data</li>
                        <li><strong>Delete:</strong> Request deletion of your account and data</li>
                        <li><strong>Export:</strong> Download your saved scenes</li>
                        <li><strong>Opt-out:</strong> Unsubscribe from marketing emails</li>
                    </ul>
                    
                    <h2>6. Cookies</h2>
                    <p>We use essential cookies for authentication. We do not use tracking or advertising cookies.</p>
                    
                    <h2>7. Children's Privacy</h2>
                    <p>FlowMotion is not intended for children under 13. We do not knowingly collect data from children.</p>
                    
                    <h2>8. Changes to This Policy</h2>
                    <p>We may update this policy periodically. We will notify you of significant changes via email or in-app notification.</p>
                    
                    <h2>9. Contact Us</h2>
                    <p>For privacy concerns or data requests: <strong>ummeyahyasaad@gmail.com</strong></p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-primary" onclick="closePrivacyModal()">Got It</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePrivacyModal();
    });
}

function closePrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    if (modal) modal.remove();
}

// ===== TOOLTIP POSITIONING =====
document.addEventListener('mouseover', (e) => {
    const tooltip = e.target.closest('.tooltip');
    if (!tooltip) return;
    
    const tooltipText = tooltip.querySelector('.tooltip-text');
    if (!tooltipText) return;
    
    const rect = tooltip.getBoundingClientRect();
    const tooltipRect = tooltipText.getBoundingClientRect();
    
    let top = rect.top - tooltipRect.height - 10;
    let left = rect.left + (rect.width / 2) - (260 / 2);
    
    if (left < 10) left = 10;
    if (left + 260 > window.innerWidth - 10) left = window.innerWidth - 270;
    if (top < 10) top = rect.bottom + 10;
    
    tooltipText.style.top = top + 'px';
    tooltipText.style.left = left + 'px';
});

// ===== INITIALIZE =====
initializeUsage();
addScene();
addScene();
updateSceneCount();

// Show local dev indicator
if (APP_IS_LOCAL) {
    const devBadge = document.createElement('div');
    devBadge.className = 'dev-badge';
    devBadge.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
        </svg>
        LOCAL
    `;
    document.body.appendChild(devBadge);
    console.log('%c[FlowMotion] Running in LOCAL mode - API: ' + API_URL, 'color: #10b981; font-weight: bold;');
}
