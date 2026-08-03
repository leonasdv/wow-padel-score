// Public config for the WOWPadel Score live share page.
// Safe to commit/deploy: the anon key only unlocks the locked-down RPC functions
// in supabase/schema.sql (get_shared_event / update_shared_event / etc.), which
// enforce their own share_id / edit_token checks. See supabase/README.md.
window.WOWPADEL_CONFIG = {
  supabaseUrl: 'https://sqkiemhdcxgilyydwauo.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxa2llbWhkY3hnaWx5eWR3YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDA4MzksImV4cCI6MjEwMTMxNjgzOX0.jw2g7A5ZYX3oUbQl0c0SLcLgqjQsdFncrmqehCq63Dg',
};
