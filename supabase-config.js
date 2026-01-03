/**
 * FlowMotion - Supabase Configuration
 * Initialize Supabase client for authentication
 */

// ✅ Supabase Project Credentials
const SUPABASE_URL = 'https://neavpzshrqhyhmrcxjwl.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYXZwenNocnFoeWhtcmN4andsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNjk1MjAsImV4cCI6MjA4Mjk0NTUyMH0.V_bmz92EGNvq8R1NCN3Te6Knruoj0RKU9yaNDLFrxuc';

// ✅ Create Supabase client (CDN v2 exposes global `supabase`)
const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ✅ Environment-aware redirect URL
const IS_LOCAL =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const REDIRECT_URL = IS_LOCAL
  ? 'http://localhost:5500/callback.html'
  : 'https://saadgkp.github.io/flow_motion/callback.html';

// ✅ Expose globally
window.FlowMotionSupabase = {
  client: supabaseClient,
  redirectUrl: REDIRECT_URL
};

console.log('[FlowMotion] Supabase initialized');
