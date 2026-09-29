/* ============================================================
   I-Land1o1 – Supabase Konfiguration
   ------------------------------------------------------------
   Werte findest du im Supabase Dashboard:
   Project Settings -> API
     - Project URL   -> SUPABASE_URL
     - anon public   -> SUPABASE_ANON_KEY  (Schalter auf "default" / legacy)

   ⚠️ WICHTIG: Trage HIER NUR den "anon public" Key ein!
   NIEMALS den "service_role" Key – diese Datei liegt offen im
   Browser für jeden Besucher. Der anon Key ist für öffentliche
   Clients gedacht (Datenschutz regelt Supabase RLS).
   ============================================================ */
window.ILAND_CONFIG = {
  SUPABASE_URL: 'https://lmlbjtazgcylsrtzzisr.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtbGJqdGF6Z2N5bHNydHp6aXNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NzU0NjQsImV4cCI6MjEwMDU1MTQ2NH0.np0bxuYpelOukoaN1ywHbwMFIR_BSTl8qXyk6ab-pxM'
};
