// Public config for the WOWPadel Score live share page.
// Safe to commit/deploy: the anon key only unlocks the locked-down RPC functions
// in supabase/schema.sql (get_shared_event / update_shared_event / etc.), which
// enforce their own share_id / edit_token checks. See supabase/README.md.
window.WOWPADEL_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
