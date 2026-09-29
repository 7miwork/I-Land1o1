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
  SUPABASE_URL: 'HIER_SUPABASE_URL_EINFUEGEN',        // z.B. https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: 'HIER_ANON_PUBLIC_KEY_EINFUEGEN' // langer JWT-String (anon public)
};
