// Connection to the shared storage (Supabase) for the librarian's picks and
// the anonymous usage numbers. Leave empty to run the app without them.
//
// The "anon" key is public by design (like a mailbox address): the database
// rules in tools/supabase-setup.sql decide what it may do. Never put the
// "service_role" key or any password here.

window.CLOUD = {
  url: "https://zgsnzfkqpkhbyvjedlsm.supabase.co",
  anonKey: "sb_publishable_2Dgukj3avarmL90Gs518PQ_73qalSH8", // public by design (see above)
};
