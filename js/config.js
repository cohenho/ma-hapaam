// Connection to the shared storage (Supabase) for the librarian's picks and
// the anonymous usage numbers. Leave empty to run the app without them.
//
// The "anon" key is public by design (like a mailbox address): the database
// rules in tools/supabase-setup.sql decide what it may do. Never put the
// "service_role" key or any password here.

window.CLOUD = {
  url: "",      // Project URL, e.g. "https://abcdefgh.supabase.co"
  anonKey: "",  // the "Publishable key" (sb_publishable_…) or the legacy "anon public" key
};
