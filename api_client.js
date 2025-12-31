/**
 * FlowMotion API Client (Vanilla JS)
 * Add this to your frontend
 */

const FLOWMOTION_API = 'https://your-backend.railway.app'; // ← Change this

/**
 * Generate Manim code from project data
 */
async function generateManimCode(project) {
  const response = await fetch(`${FLOWMOTION_API}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Generation failed');
  }
  
  return response.json();
}

/**
 * Generate and render video
 * @param {Object} project - Project data
 * @param {'l'|'m'|'h'} quality - l=480p, m=720p, h=1080p
 */
async function renderManimVideo(project, quality = 'l') {
  const response = await fetch(`${FLOWMOTION_API}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, quality }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Render failed');
  }
  
  const data = await response.json();
  
  // Convert relative video URL to full URL
  if (data.video_url) {
    data.video_url = `${FLOWMOTION_API}${data.video_url}`;
  }
  
  return data;
}

// Example usage:
// 
// const project = {
//   version: '1.0',
//   totalScenes: 1,
//   scenes: [{
//     scene: 1,
//     show: 'Blue circle',
//     animations: 'Fade in',
//     duration: 2
//   }]
// };
// 
// generateManimCode(project).then(({ code }) => console.log(code));
// renderManimVideo(project, 'l').then(({ video_url }) => window.open(video_url));
