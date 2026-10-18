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
    // Piratenname + Rolle aus profiles laden (Trigger legt die Zeile bei Signup an)
    client
      .from('profiles')
      .select('display_name, role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (whoBox && data) {
          const label = data.display_name ? data.display_name : user.email;
          whoBox.textContent = '🏴‍☠️ ' + label;
        }
        const role = (data && data.role) || 'student';
        if (role === 'admin' && btnLogout) {
          // Admin-Link in der Topbar anzeigen
          const adminLink = document.createElement('a');
          adminLink.href = '/dashboard/admin/';
          adminLink.className = 'btn btn-ghost';
          adminLink.textContent = '⚙️ Admin';
          adminLink.style.marginLeft = '10px';
          btnLogout.parentNode.insertBefore(adminLink, btnLogout.nextSibling);
        }
        // Abo & Zahlung NUR fuer Eltern-Konto (Kinder erben den Zugang
        // ueber den Eltern-Code – ein Kauf-Hinweis gehoert nicht hierher).
        // billing.js wird NICHT im HTML geladen, sondern hier erst fuer Eltern
        // nachgeladen, damit Kinder keinerlei Bezahl-UI/Logik im Browser haben.
        if (role === 'parent' && typeof window.initBilling !== 'function') {
          const billingScript = document.createElement('script');
          billingScript.src = 'billing.js?v=f7c7ee6625';
          billingScript.onload = () => {
            if (typeof window.initBilling === 'function') {
              window.initBilling(client);
            }
          };
          document.head.appendChild(billingScript);
        } else if (role === 'parent' && typeof window.initBilling === 'function') {
          window.initBilling(client);
        }
        if (typeof window.initFamily === 'function') window.initFamily(client, user);
      });
    if (btnLogout) {
      btnLogout.hidden = false;
      btnLogout.onclick = async () => {
        await client.auth.signOut();
        window.location.replace('/login/');
      };
    }
    if (!window.ilandDashboardInited && typeof window.initDashboard === 'function') {
      window.ilandDashboardInited = true;
      window.initDashboard(user.id, client);
    }
  }

  async function boot() {
    if (!client) {
      // Supabase nicht konfiguriert -> Dashboard offen zeigen (Fallback)
      document.getElementById('appContent').hidden = false;
      if (!window.ilandDashboardInited && typeof window.initDashboard === 'function') {
        window.ilandDashboardInited = true;
        window.initDashboard('anon');
      }
      return;
    }
    const { data } = await client.auth.getSession();
    if (data.session && data.session.user) {
      showApp(data.session.user);
    } else {
      // Nicht eingeloggt -> zur Login-Seite (einmaliges Login auf /login)
      const params = new URLSearchParams(window.location.search);
      if (!params.get('fromLogin')) {
        window.location.replace('/login/?next=/dashboard/');
      }
    }
  }

  boot();
})();
