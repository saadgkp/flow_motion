/**
 * FlowMotion - Authentication Module
 * Shows full dashboard with Sign In button - prompts login on action
 */

// Auth state
let currentUser = null;
let authToken = null;
let isAuthInitialized = false;

// Storage keys
const TOKEN_KEY = 'flowmotion_auth_token';
const USER_KEY = 'flowmotion_user';

// API URL (must be defined here since auth.js loads before app.js)
const AUTH_API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://flowmotionbackend-production.up.railway.app';

// ===== INITIALIZATION =====

async function initAuth() {
    if (isAuthInitialized) return;
    
    console.log('[Auth] Initializing...');
    
    if (!window.FlowMotionSupabase || !window.FlowMotionSupabase.client) {
        console.error('[Auth] Supabase not loaded!');
        updateAuthUI();
        return;
    }
    
    const supabase = window.FlowMotionSupabase.client;
    
    // Check Supabase's session first (catches callback redirect)
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
            console.log('[Auth] Found Supabase session!');
            await handleSignIn(session);
            isAuthInitialized = true;
            return;
        }
    } catch (e) {
        console.error('[Auth] Session check error:', e);
    }
    
    // Check localStorage backup
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    
    if (storedToken && storedUser) {
        try {
            const { data, error } = await supabase.auth.getUser(storedToken);
            
            if (!error && data.user) {
                authToken = storedToken;
                currentUser = JSON.parse(storedUser);
                console.log('[Auth] Restored from localStorage:', currentUser.email);
                updateAuthUI();
                isAuthInitialized = true;
                return;
            }
        } catch (e) {
            console.error('[Auth] localStorage check error:', e);
        }
        clearAuthState();
    }
    
    // No session - show sign in button
    console.log('[Auth] No session, showing sign in button');
    updateAuthUI();
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Auth] State change:', event);
        
        if (event === 'SIGNED_IN' && session) {
            await handleSignIn(session);
        } else if (event === 'SIGNED_OUT') {
            clearAuthState();
            updateAuthUI();
        }
    });
    
    isAuthInitialized = true;
}


// ===== LOGIN PROMPT MODAL =====

function showLoginPrompt(action = 'use this feature') {
    const existing = document.getElementById('login-prompt-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'login-prompt-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="login-prompt-content">
            <button class="modal-close" onclick="closeLoginPrompt()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            
            <div class="login-prompt-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
            </div>
            
            <h3>Sign in to continue</h3>
            <p>Create a free account to ${action}</p>
            
            <button class="btn-google-login" onclick="loginWithGoogle()">
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
            </button>
            
            <p class="login-prompt-note">Free account • No credit card required</p>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeLoginPrompt();
    });
}

function closeLoginPrompt() {
    const modal = document.getElementById('login-prompt-modal');
    if (modal) modal.remove();
}


// ===== LOGIN/LOGOUT =====

async function loginWithGoogle() {
    if (!window.FlowMotionSupabase || !window.FlowMotionSupabase.client) {
        showNotification('Authentication service not ready. Please refresh.', 'error');
        return;
    }
    
    const supabase = window.FlowMotionSupabase.client;
    const redirectUrl = window.FlowMotionSupabase.redirectUrl;
    
    console.log('[Auth] Starting Google OAuth, redirect:', redirectUrl);
    
    // Show loading on button
    const btn = document.querySelector('.btn-google-login');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <svg class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
            </svg>
            <span>Redirecting...</span>
        `;
    }
    
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl }
    });
    
    if (error) {
        console.error('[Auth] OAuth error:', error);
        showNotification('Login failed: ' + error.message, 'error');
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
            `;
        }
    }
}

async function handleSignIn(session) {
    console.log('[Auth] Processing sign in...');
    
    if (!session || !session.access_token) {
        console.error('[Auth] No valid session');
        return;
    }
    
    // Store token
    authToken = session.access_token;
    localStorage.setItem(TOKEN_KEY, authToken);
    
    const user = session.user;
    if (!user) return;
    
    // User data
    const userData = {
        google_id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
        picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || null
    };
    
    currentUser = userData;
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    
    // Close login prompt if open
    closeLoginPrompt();
    
    // Sync with backend
    try {
        const response = await fetch(`${AUTH_API_URL}/auth/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            const result = await response.json();
            currentUser = { ...result.user, usage: result.usage };
            localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
            
            if (result.user.subscription_tier) {
                let tierKey = result.user.subscription_tier.toUpperCase().replace(' ', '_');
                if (tierKey === 'PRO+') tierKey = 'PRO_PLUS';
                if (typeof TIERS !== 'undefined' && TIERS[tierKey]) {
                    currentTier = tierKey;
                    if (typeof saveTier === 'function') saveTier();
                }
            }
            
            if (result.usage && typeof saveUsage === 'function') {
                todayUsage = {
                    videos: result.usage.videos || 0,
                    autofills: result.usage.autofills || 0,
                    codeViews: 0,
                    date: new Date().toDateString()
                };
                saveUsage();
            }
        }
    } catch (e) {
        console.warn('[Auth] Backend sync error:', e);
    }
    
    updateAuthUI();
    if (typeof updateTierUI === 'function') updateTierUI();
    if (typeof showNotification === 'function') {
        showNotification(`Welcome, ${currentUser.name}!`, 'success');
    }
}

async function logout() {
    console.log('[Auth] Logging out...');
    
    const supabase = window.FlowMotionSupabase.client;
    await supabase.auth.signOut();
    
    clearAuthState();
    updateAuthUI();
    
    if (typeof TIERS !== 'undefined') {
        currentTier = 'FREE';
        if (typeof saveTier === 'function') saveTier();
        if (typeof updateTierUI === 'function') updateTierUI();
    }
    
    if (typeof showNotification === 'function') {
        showNotification('Logged out', 'success');
    }
}

function clearAuthState() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}


// ===== AUTH UI =====

function updateAuthUI() {
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;
    
    if (currentUser) {
        // Logged in - show profile
        authContainer.innerHTML = `
            <div class="user-profile" onclick="toggleUserMenu()">
                <img class="user-avatar" src="${currentUser.picture || generateAvatar(currentUser.name)}" alt="" onerror="this.src='${generateAvatar(currentUser.name)}'">
                <span class="user-name">${(currentUser.name || 'User').split(' ')[0]}</span>
                <svg class="dropdown-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </div>
            <div class="user-menu" id="user-menu">
                <div class="user-menu-header">
                    <span class="user-email">${currentUser.email}</span>
                </div>
                <button class="user-menu-item" onclick="showCloudScenes()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                    </svg>
                    Cloud Scenes
                </button>
                <div class="user-menu-divider"></div>
                <button class="user-menu-item logout" onclick="logout()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Logout
                </button>
            </div>
        `;
    } else {
        // Not logged in - show sign in button
        authContainer.innerHTML = `
            <button class="btn-signin" onclick="showLoginPrompt('get started')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                <span>Sign In</span>
            </button>
        `;
    }
}

function generateAvatar(name) {
    const initial = (name || 'U').charAt(0).toUpperCase();
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%2310b981" width="100" height="100" rx="50"/><text x="50" y="50" dominant-baseline="central" text-anchor="middle" fill="white" font-family="sans-serif" font-size="40" font-weight="600">${initial}</text></svg>`;
}

function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    if (menu) menu.classList.toggle('open');
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('user-menu');
    const profile = e.target.closest('.user-profile');
    if (menu && menu.classList.contains('open') && !profile) {
        menu.classList.remove('open');
    }
});


// ===== AUTH CHECK HELPER =====

function requireAuth(action = 'use this feature') {
    if (!currentUser || !authToken) {
        showLoginPrompt(action);
        return false;
    }
    return true;
}

function getAuthHeaders() {
    if (authToken) return { 'Authorization': `Bearer ${authToken}` };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) return { 'Authorization': `Bearer ${token}` };
    return {};
}

function isLoggedIn() {
    return !!currentUser && !!authToken;
}


// ===== CLOUD SCENES =====

async function showCloudScenes() {
    if (!requireAuth('access cloud scenes')) return;
    
    const userMenu = document.getElementById('user-menu');
    if (userMenu) userMenu.classList.remove('open');
    
    try {
        const response = await fetch(`${AUTH_API_URL}/scenes`, { headers: getAuthHeaders() });
        if (response.status === 401) { logout(); return; }
        const data = await response.json();
        if (data.success) showCloudScenesModal(data.scenes);
    } catch (e) {
        console.error(e);
        showNotification('Failed to load scenes', 'error');
    }
}

function showCloudScenesModal(scenes) {
    const existing = document.getElementById('cloud-scenes-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'cloud-scenes-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content load-modal">
            <div class="modal-header">
                <h3>Cloud Scenes</h3>
                <button class="modal-close" onclick="closeCloudScenesModal()">×</button>
            </div>
            <div class="modal-body">
                ${scenes.length === 0 ? '<p style="text-align:center;color:#888;">No saved scenes yet</p>' : 
                    scenes.map(s => `
                        <div class="config-item">
                            <span>${s.name}</span>
                            <button onclick="loadCloudScene('${s.id}')">Load</button>
                            <button onclick="deleteCloudScene('${s.id}')">Delete</button>
                        </div>
                    `).join('')
                }
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeCloudScenesModal() {
    const modal = document.getElementById('cloud-scenes-modal');
    if (modal) modal.remove();
}

async function loadCloudScene(id) {
    const response = await fetch(`${AUTH_API_URL}/scenes`, { headers: getAuthHeaders() });
    const data = await response.json();
    const scene = data.scenes.find(s => s.id === id);
    if (scene) {
        scenes = []; transitions = []; sceneCounter = 0;
        (scene.scene_data.scenes || []).forEach((s, i) => {
            sceneCounter++;
            if (scenes.length > 0) transitions.push({ from: scenes[scenes.length-1].id, to: sceneCounter, description: '' });
            scenes.push({ id: sceneCounter, show: s.show||'', action: s.action||'', narration: s.narration||'', duration: s.duration||3, objects: [] });
        });
        renderTimeline(); updateSceneCount(); resetCodeState();
        closeCloudScenesModal();
        showNotification('Scene loaded!', 'success');
    }
}

async function deleteCloudScene(id) {
    if (!confirm('Delete this scene?')) return;
    await fetch(`${AUTH_API_URL}/scenes/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    showCloudScenes();
}


// ===== INIT =====

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initAuth, 150);
});
