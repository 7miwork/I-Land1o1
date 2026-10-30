/* ============================================================
   I-Land1o1 – Auth (Supabase)
   Session-Check für das Dashboard.
   Bei nicht-angemeldetem Nutzer: Redirect zu /login.
   Bei angemeldetem Nutzer: Dashboard-App starten.
   ============================================================ */

(function () {
  const cfg = window.ILAND_CONFIG || {};
  const isConfigured =
    typeof cfg.SUPABASE_URL === 'string'
    && cfg.SUPABASE_URL.indexOf('HIER_') !== 0
    && /^https:\/\/.+\..+/.test(cfg.SUPABASE_URL)
    && typeof cfg.SUPABASE_ANON_KEY === 'string'
    && cfg.SUPABASE_ANON_KEY.indexOf('HIER_') !== 0
    && cfg.SUPABASE_ANON_KEY.length > 20;

  const btnLogout = document.getElementById('btnLogout');
  const whoBox = document.getElementById('authWho');

  let client = null;

  if (isConfigured && window.supabase) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  function showApp(user) {
    document.getElementById('appContent').hidden = false;
    if (whoBox) whoBox.textContent = user.email;
    // Piratenname aus profiles laden (Trigger legt die Zeile bei Signup an)
    client
      .from('profiles')
      .select('display_name, role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (whoBox && data) {
          const label = data.display_name ? data.display_name : user.email;
          whoBox.textContent = '🏴‍☠️ ' + label;
          if (data.role === 'admin' && btnLogout) {
            // Admin-Link in der Topbar anzeigen
            const adminLink = document.createElement('a');
            adminLink.href = '/dashboard/admin/';
            adminLink.className = 'btn btn-ghost';
            adminLink.textContent = '⚙️ Admin';
            adminLink.style.marginLeft = '10px';
            btnLogout.parentNode.insertBefore(adminLink, btnLogout.nextSibling);
          }
        }
      });
    if (btnLogout) {
      btnLogout.hidden = false;
      btnLogout.onclick = async () => {
        await client.auth.signOut();
        window.location.replace('/');
      };
    }
    if (!window.ilandDashboardInited && typeof window.initDashboard === 'function') {
      window.ilandDashboardInited = true;
      window.initDashboard(user.id, client);
    }
    if (typeof window.initBilling === 'function') window.initBilling(client);
    if (typeof window.initFamily === 'function') window.initFamily(client, user);
  }

  async function boot() {
    if (!client) {
      document.getElementById('appContent').hidden = false;
      if (!window.ilandDashboardInited && typeof window.initDashboard === 'function') {
        window.ilandDashboardInited = true;
        window.initDashboard('anon');
      }
      return;
    }
    try {
      const { data, error } = await client.auth.getSession();
      if (error) console.error('getSession error:', error);
      if (data && data.session && data.session.user) {
        showApp(data.session.user);
      } else {
        const params = new URLSearchParams(window.location.search);
        if (!params.get('fromLogin')) {
          // Aktuellen Pfad als next merken, damit nach Login zurueckkehrt (z. B. /dashboard/admin/)
          const next = window.location.pathname.startsWith('/dashboard/') ? window.location.pathname : '/dashboard/';
          window.location.replace('/login/index.html?next=' + encodeURIComponent(next));
        }
      }
    } catch (err) {
      console.error('Dashboard boot failed:', err);
    }
  }

  boot();
})();
