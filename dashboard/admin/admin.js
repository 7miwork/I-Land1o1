/* ============================================================
   I-Land1o1 – Admin-Dashboard
   Zeigt Nutzer, Abos und Eltern-Kind-Verknüpfungen.
   Nur für Rollen 'admin' (und 'teacher' zum Lesen).
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

  const appContent = document.getElementById('appContent');
  const btnLogout = document.getElementById('btnLogout');
  const whoBox = document.getElementById('authWho');

  let client = null;
  let myRole = 'student';

  // Test-Modus: Nur im Test-System soll "Alle Abos zurücksetzen" sichtbar sein.
  // Der Nutzer kann IS_TEST_MODE auf true setzen, wenn er im Test-System läuft.
  const IS_TEST_MODE = (typeof cfg.IS_TEST_MODE === 'boolean') ? cfg.IS_TEST_MODE : false;

  // ---------- Pagination / Suche / Filter ----------
  const ITEMS_PER_PAGE = 10;
  let currentPage = 1;
  let searchTerm = '';
  let roleFilter = '';

  // ---------- Audit-Log ----------
  async function auditLog(action, targetId, targetEmail, details) {
    if (!client) return;
    try {
      const { data: session } = await client.auth.getSession();
      const actorEmail = session?.session?.user?.email || 'unknown';
      const actorId = session?.session?.user?.id || null;
      await client
        .from('admin_audit_log')
        .insert({ actor_id: actorId, actor_email: actorEmail, action, target_id: targetId, target_email: targetEmail, details: details || {} });
    } catch (e) {
      console.error('Audit-Log-Fehler:', e);
    }
  }

  if (isConfigured && window.supabase) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  function showMsg(id, text, kind) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !text;
    el.textContent = text;
    el.className = 'msg msg--' + kind;
  }

  function fmtDate(iso) {
    if (!iso) return '–';
    try { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return iso; }
  }

    function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function roleBadge(role) {
    const safe = esc(role || 'student');
    const cls = 'role-' + safe;
    const label = { student: 'Schüler:in', parent: 'Elternteil', teacher: 'Lehrer:in', admin: 'Admin' }[role] || safe;
    return '<span class="role-badge ' + cls + '">' + esc(label) + '</span>';
  }

  function statusBadge(status) {
    const safe = esc(status || 'incomplete');
    const cls = 'status-' + safe;
    return '<span class="' + cls + '">' + (status == null ? '–' : esc(status)) + '</span>';
  }

  async function boot() {
    if (!client) {
      appContent.hidden = false;
      return;
    }
    const { data } = await client.auth.getSession();
    if (!data || !data.session || !data.session.user) {
      window.location.replace('/login/index.html?next=/dashboard/admin/');
      return;
    }

    const { data: profile } = await client
      .from('profiles')
      .select('display_name, role')
      .eq('id', data.session.user.id)
      .maybeSingle();

    if (whoBox) whoBox.textContent = '🏴‍☠️ ' + (profile ? (profile.display_name || data.session.user.email) : data.session.user.email);
    myRole = profile ? profile.role : 'student';

    if (myRole !== 'admin' && myRole !== 'teacher') {
      appContent.hidden = false;
      const hero = document.querySelector('.hero');
      if (hero) hero.innerHTML = '<p class="kicker">⛔ Zugriff verweigert</p><h1>Nur für Admins</h1><p class="sub">Du hast keine Admin-Rechte.</p>';
      return;
    }

    if (btnLogout) {
      btnLogout.hidden = false;
      btnLogout.onclick = async () => { await client.auth.signOut(); window.location.replace('/'); };
    }

    appContent.hidden = false;
    await loadDashboard();
  }

  async function loadDashboard() {
    const [usersRes, subsRes, linksRes] = await Promise.all([
      client.from('profiles').select('*'),
      client.from('subscriptions').select('*'),
      client.from('parent_links').select('*'),
    ]);

    document.getElementById('countUsers').textContent = (usersRes.data || []).length;
//
// Map user_id -> {display_name, email} fuer die Anzeige im Admin-Dashboard
//
userMap = {};
(usersRes && usersRes.data)?.forEach((p) => { userMap[p.id] = { display_name: p.display_name, email: p.email }; });
    const activeSubs = (subsRes.data || []).filter(s => ['active', 'trialing', 'paid'].includes(s.status)).length;
    document.getElementById('countSubs').textContent = activeSubs;
    document.getElementById('countLinks').textContent = (linksRes.data || []).length;

    // Link-Dropdowns befuellen (Eltern + Kinder mit echten Namen)
    const users = usersRes.data || [];
    const parents = users.filter(u => u.role === 'parent');
    const students = users.filter(u => u.role === 'student');
    const parentSel = document.getElementById('linkParent');
    const studentSel = document.getElementById('linkStudent');
    parentSel.innerHTML = '<option value="">– Elternteil auswählen –</option>';
    studentSel.innerHTML = '<option value="">– Kind auswählen –</option>';
    parents.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = (p.display_name || 'Pirat') + ' <' + (p.email || '–') + '>';
      parentSel.appendChild(o);
    });
    students.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = (s.display_name || 'Pirat') + ' <' + (s.email || '–') + '>';
      studentSel.appendChild(o);
    });

    // Event-Listener fuer Suche/Filter/Pagination
    const searchInp = document.getElementById('userSearch');
    const filterSel = document.getElementById('userFilter');
    if (searchInp) {
      searchInp.oninput = () => { searchTerm = searchInp.value.toLowerCase(); currentPage = 1; renderUsers(filterUsers(users)); };
    }
    if (filterSel) {
      filterSel.onchange = () => { roleFilter = filterSel.value; currentPage = 1; renderUsers(filterUsers(users)); };
    }
    const btnPrev = document.getElementById('pagePrev');
    const btnNext = document.getElementById('pageNext');
    if (btnPrev) btnPrev.onclick = () => { if (currentPage > 1) { currentPage--; renderUsers(filterUsers(users)); } };
    if (btnNext) btnNext.onclick = () => { const filtered = filterUsers(users); const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE); if (currentPage < totalPages) { currentPage++; renderUsers(filtered); } };

    const btnAddLink = document.getElementById("btnAddLink");
    if (btnAddLink) btnAddLink.onclick = createLink;

    renderUsers(filterUsers(users));
    renderSubs(subsRes.data || []);
    renderLinks(linksRes.data || []);
  }

  // Filtert Nutzer nach Suchbegriff und Rollen-Filter
  function filterUsers(users) {
    return users.filter(u => {
      const matchesSearch = !searchTerm ||
        (u.display_name && u.display_name.toLowerCase().includes(searchTerm)) ||
        (u.email && u.email.toLowerCase().includes(searchTerm));
      const matchesRole = !roleFilter || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }

  async function renderUsers(users) {
    const tbody = document.getElementById('usersBody');
    tbody.innerHTML = '';

    // Pagination: nur aktuelle Seite anzeigen
    const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageUsers = users.slice(start, start + ITEMS_PER_PAGE);

    // Pagination-Controls aktualisieren
    const pageCurrent = document.getElementById('pageCurrent');
    const pageTotal = document.getElementById('pageTotal');
    const btnPrev = document.getElementById('pagePrev');
    const btnNext = document.getElementById('pageNext');
    if (pageCurrent) pageCurrent.textContent = currentPage;
    if (pageTotal) pageTotal.textContent = totalPages || 1;
    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= (totalPages || 1);

    for (const u of pageUsers) {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = u.display_name || '–';
      const small = document.createElement('small');
      small.style.color = 'var(--sand)';
      small.textContent = u.email || '–';
      tdName.appendChild(document.createElement('br'));
      tdName.appendChild(small);

      const tdRole = document.createElement('td');
      tdRole.innerHTML = roleBadge(u.role);

      const tdEdit = document.createElement('td');
      const sel = document.createElement('select');
      sel.className = 'role-select';
      sel.value = u.role;
      ['student', 'parent', 'teacher', 'admin'].forEach((r) => {
        const o = document.createElement('option');
        o.value = r;
        o.textContent = { student: 'Schüler:in', parent: 'Elternteil', teacher: 'Lehrer:in', admin: 'Admin' }[r];
        sel.appendChild(o);
      });
      const btn = document.createElement('button');
      btn.className = 'btn-save';
      btn.textContent = 'Speichern';
      btn.addEventListener('click', async () => {
        if (myRole !== 'admin') { showMsg('usersMsg', 'Nur Admins dürfen Rollen ändern.', 'error'); return; }
        // Admin darf sich nicht selbst herabstufen
        const { data: session } = await client.auth.getSession();
        if (session?.session?.user?.id === u.id && sel.value !== 'admin') {
          showMsg('usersMsg', 'Du kannst deine eigene Admin-Rolle nicht ändern.', 'error');
          return;
        }
        const oldRole = u.role;
        const { error } = await client.from('profiles').update({ role: sel.value }).eq('id', u.id);
        if (error) showMsg('usersMsg', error.message, 'error');
        else {
          await auditLog('role_change', u.id, u.email, { old_role: oldRole, new_role: sel.value });
          showMsg('usersMsg', 'Rolle gespeichert.', 'ok');
          loadDashboard();
        }
      });

      tdEdit.appendChild(sel);
      tdEdit.appendChild(document.createElement('br'));
      tdEdit.appendChild(btn);

      const tdDate = document.createElement('td');
      tdDate.textContent = fmtDate(u.created_at);

      tr.appendChild(tdName);
      tr.appendChild(tdRole);
      tr.appendChild(tdEdit);
      tr.appendChild(tdDate);
      tbody.appendChild(tr);
    }
  }

  // Map user_id -> {display_name, email} für die Anzeige im Admin-Dashboard
  let userMap = {};

  async function renderSubs(subs) {
    const tbody = document.getElementById('subsBody');
    tbody.innerHTML = '';
    for (const s of subs) {
      const tr = document.createElement('tr');
      const tdUser = document.createElement('td');
      // Falls userMap noch nicht befüllt (z.B. bei schneller Navigation):
      const u = userMap[s.user_id] || { email: 'User ' + s.user_id.slice(0, 8), display_name: 'User' };
      tdUser.textContent = u.email || u.display_name || 'User';
      const tdPlan = document.createElement('td');
      tdPlan.textContent = s.plan || '–';
      const tdStatus = document.createElement('td');
      tdStatus.innerHTML = statusBadge(s.status);
      const tdDate = document.createElement('td');
      tdDate.textContent = fmtDate(s.current_period_end);

      // Reset-Buttons (nur für Admins)
      const tdReset = document.createElement('td');
      const btnReset = document.createElement('button');
      btnReset.className = 'btn-reset-sub';
      btnReset.dataset.label = 'Reset';
      btnReset.textContent = 'Reset';
      btnReset.title = 'Abo zurücksetzen (Test)';
      btnReset.addEventListener('click', () => resetSubscription(s.user_id));
      tdReset.appendChild(btnReset);

      if (myRole === 'admin') {
        const btnProg = document.createElement('button');
        btnProg.className = 'btn-reset-progress';
        btnProg.dataset.label = 'Fortschritt löschen';
        btnProg.textContent = 'Fortschritt löschen';
        btnProg.title = 'Lernfortschritt löschen (Test)';
        btnProg.style.marginLeft = '4px';
        btnProg.addEventListener('click', () => resetLessonProgress(s.user_id));
        tdReset.appendChild(btnProg);
      }

      tr.append(tdUser, tdPlan, tdStatus, tdDate, tdReset);
      tbody.appendChild(tr);
    }

    // Bulk-Reset-Button unter der Tabelle (nur im Test-Modus)
    const subsBox = document.getElementById('subsBox');
    if (subsBox && myRole === 'admin' && IS_TEST_MODE) {
      let bulk = subsBox.querySelector('.bulk-reset-wrap');
      if (!bulk) {
        bulk = document.createElement('div');
        bulk.className = 'bulk-reset-wrap';
        bulk.style.marginTop = '12px';
        bulk.innerHTML = '<hr style="margin:8px 0;border:none;border-top:1px solid var(--sand);"><button class="btn btn-reset-all" style="background:var(--red);color:var(--parchment);padding:6px 14px;border-radius:var(--radius);font-weight:700;" data-label="Alle zurücksetzen">⚠️ Alle Abos zurücksetzen (Test)</button>';
        subsBox.appendChild(bulk);
        bulk.querySelector('.btn-reset-all').addEventListener('click', resetAllSubscriptions);
      }
    }
  }

  // ============================================================
  // Abo-Reset (Testing) – nur für Admins
  // ============================================================
  async function resetSubscription(userId) {
    if (myRole !== 'admin') {
      showMsg('subsMsg', 'Nur Admins dürfen Abos zurücksetzen.', 'error');
      return;
    }
    if (!confirm('Wirklich das Abo für diesen User zurücksetzen? Der Zugang wird gesperrt und muss neu gekauft werden.')) return;

    setBusySubs(true);
    const { error } = await client
      .from('subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: true,
        current_period_end: new Date(Date.now() - 86400000).toISOString(), // gestern
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    setBusySubs(false);

    if (error) {
      showMsg('subsMsg', 'Fehler beim Zurücksetzen: ' + error.message, 'error');
    } else {
      await auditLog('subscription_reset', userId, null, { plan: null });
      showMsg('subsMsg', 'Abo zurückgesetzt. Der User muss neu kaufen.', 'ok');
      loadDashboard();
    }
  }

  async function resetAllSubscriptions() {
    if (myRole !== 'admin') {
      showMsg('subsMsg', 'Nur Admins dürfen Abos zurücksetzen.', 'error');
      return;
    }
    if (!IS_TEST_MODE) {
      showMsg('subsMsg', 'Dieser Button ist nur im Test-Modus verfügbar.', 'error');
      return;
    }
    if (!confirm('Wirklich ALLE Abos zurücksetzen? Jeder Nutzer muss neu kaufen.')) return;

    setBusySubs(true);
    const { data: subs, error: fetchErr } = await client
      .from('subscriptions')
      .select('user_id');
    if (fetchErr) {
      setBusySubs(false);
      showMsg('subsMsg', 'Fehler beim Laden: ' + fetchErr.message, 'error');
      return;
    }

    let failed = 0;
    for (const s of (subs || [])) {
      const { error } = await client
        .from('subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: true,
          current_period_end: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', s.user_id);
      if (error) failed++;
    }

    setBusySubs(false);
    await auditLog('subscription_reset_all', null, null, { failed, total: (subs || []).length });
    const msg = failed === 0
      ? 'Alle Abos zurückgesetzt.'
      : 'Fertig. ' + failed + ' Abos konnten nicht zurückgesetzt werden.';
    showMsg('subsMsg', msg, failed === 0 ? 'ok' : 'error');
    loadDashboard();
  }

  async function resetLessonProgress(userId) {
    if (myRole !== 'admin') {
      showMsg('subsMsg', 'Nur Admins dürfen den Fortschritt löschen.', 'error');
      return;
    }
    if (!confirm('Wirklich den gesamten Lernfortschritt dieses Users löschen? Alle Lektionen werden wieder gesperrt.')) return;

    setBusySubs(true);
    const { error } = await client
      .from('lesson_progress')
      .delete()
      .eq('user_id', userId);
    setBusySubs(false);

    if (error) {
      showMsg('subsMsg', 'Fehler beim Löschen: ' + error.message, 'error');
    } else {
      await auditLog('progress_reset', userId, null, {});
      showMsg('subsMsg', 'Lernfortschritt gelöscht. Der User startet bei Lektion 1.', 'ok');
      loadDashboard();
    }
  }

  function setBusySubs(busy) {
    const btns = document.querySelectorAll('.btn-reset-sub, .btn-reset-all, .btn-reset-progress');
    btns.forEach((b) => { b.disabled = busy; b.textContent = busy ? '…' : b.dataset.label || b.textContent; });
  }

  async function renderLinks(links) {
    const tbody = document.getElementById('linksBody');
    tbody.innerHTML = '';
    for (const l of links) {
      const tr = document.createElement('tr');
      const parent = userMap[l.parent_id] || { display_name: 'Parent ' + (l.parent_id || '–').slice(0, 8), email: '' };
      const student = userMap[l.student_id] || { display_name: 'Student ' + (l.student_id || '–').slice(0, 8), email: '' };
      const tdP = document.createElement('td');
      tdP.textContent = parent.display_name + (parent.email ? ' <' + parent.email + '>' : '');
      const tdS = document.createElement('td');
      tdS.textContent = student.display_name + (student.email ? ' <' + student.email + '>' : '');
      const tdD = document.createElement('td');
      tdD.textContent = fmtDate(l.created_at);
      const tdDel = document.createElement('td');
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-delete';
      btnDel.textContent = 'Entfernen';
      btnDel.addEventListener('click', () => deleteLink(l.parent_id, l.student_id));
      tdDel.appendChild(btnDel);
      tr.append(tdP, tdS, tdD, tdDel);
      tbody.appendChild(tr);
    }
  }

  async function createLink() {
    if (myRole !== 'admin') {
      showMsg('linksMsg', 'Nur Admins dürfen Verknüpfungen anlegen.', 'error');
      return;
    }
    const parentSel = document.getElementById('linkParent');
    const studentSel = document.getElementById('linkStudent');
    const parentId = parentSel.value;
    const studentId = studentSel.value;
    if (!parentId || !studentId) {
      showMsg('linksMsg', 'Bitte Elternteil und Kind auswählen.', 'error');
      return;
    }
    if (!confirm('Wirklich diese Verknüpfung anlegen?')) return;
    const { error } = await client.from('parent_links').insert({ parent_id: parentId, student_id: studentId });
    if (error) {
      showMsg('linksMsg', 'Fehler: ' + error.message, 'error');
    } else {
      await auditLog('link_create', studentId, null, { parent_id: parentId });
      showMsg('linksMsg', 'Verknüpfung angelegt.', 'ok');
      parentSel.value = '';
      studentSel.value = '';
      loadDashboard();
    }
  }

  async function deleteLink(parentId, studentId) {
    if (myRole !== 'admin') {
      showMsg('linksMsg', 'Nur Admins dürfen Verknüpfungen entfernen.', 'error');
      return;
    }
    if (!confirm('Wirklich diese Eltern-Kind-Verknüpfung entfernen?')) return;
    const { error } = await client.from('parent_links').delete().eq('parent_id', parentId).eq('student_id', studentId);
    if (error) {
      showMsg('linksMsg', 'Fehler: ' + error.message, 'error');
    } else {
      await auditLog('link_delete', studentId, null, { parent_id: parentId });
      showMsg('linksMsg', 'Verknüpfung entfernt.', 'ok');
      loadDashboard();
    }
  }

  // Load users table data
async function loadUsersTable() {
  if (!client) return;
  try {
    const { data, error } = await client.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const tbody = document.getElementById('usersBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#888;">Keine Nutzer gefunden</td></tr>';
      return;
    }
    for (const u of data) {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = u.display_name || u.email || '–';
      const tdRole = document.createElement('td');
      tdRole.innerHTML = roleBadge(u.role || 'student');
      const tdChange = document.createElement('td');
      const btnChange = document.createElement('button');
      btnChange.className = 'btn btn-small';
      btnChange.dataset.action = 'update-role';
      btnChange.dataset.userId = u.id;
      btnChange.textContent = 'Edit';
      tdChange.appendChild(btnChange);
      const tdDate = document.createElement('td');
      tdDate.textContent = fmtDate(u.created_at);
      tr.append(tdName, tdRole, tdChange, tdDate);
      tbody.appendChild(tr);
    }
  } catch (e) {
    showMsg('usersMsg', 'Fehler beim Laden: ' + e.message, 'error');
  }
}

// Load subscriptions table
async function loadSubsTable() {
  if (!client) return;
  try {
    const { data, error } = await client.from('subscriptions').select('*, profiles!inner(display_name, email)').order('created_at', { ascending: false });
    if (error) throw error;
    const tbody = document.getElementById('subsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#888;">Keine Abonnements gefunden</td></tr>';
      return;
    }
    for (const s of data) {
      const tr = document.createElement('tr');
      const tdUser = document.createElement('td');
      tdUser.textContent = s.profiles?.display_name || '–';
      const tdPlan = document.createElement('td');
      tdPlan.textContent = s.plan_type || '–';
      const tdStatus = document.createElement('td');
      tdStatus.innerHTML = statusBadge(s.status || 'incomplete');
      const tdEnd = document.createElement('td');
      tdEnd.textContent = fmtDate(s.canceled_at || s.current_period_end);
      const tdReset = document.createElement('td');
      const btnReset = document.createElement('button');
      btnReset.className = 'btn-reset-sub';
      btnReset.dataset.label = 'Reset (Test)';
      btnReset.dataset.userId = s.id;
      btnReset.textContent = 'Reset Test';
      tdReset.appendChild(btnReset);
      tr.append(tdUser, tdPlan, tdStatus, tdEnd, tdReset);
      tbody.appendChild(tr);
    }
  } catch (e) {
    showMsg('subsMsg', 'Fehler beim Laden: ' + e.message, 'error');
  }
}

// Load parent-links table
async function loadLinksTable() {
  if (!client) return;
  try {
    const { data, error } = await client.from('parent_links').select(`
      *,
      profiles!parent_links_parent_id_fkey(address:email)
    `).order('created_at', { ascending: false });
    if (error) throw error;
    const tbody = document.getElementById('linksBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#888;">Keine Verknüpfungen gefunden</td></tr>';
      return;
    }
    for (const l of data) {
      const tr = document.createElement('tr');
      const tdP = document.createElement('td');
      tdP.textContent = l.profiles?.display_name || 'Parent ' + l.parent_id;
      const tdS = document.createElement('td');
      tdS.textContent = l.student_id || '–';
      const tdD = document.createElement('td');
      tdD.textContent = fmtDate(l.created_at);
      const tdDel = document.createElement('td');
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-delete';
      btnDel.textContent = 'Entfernen';
      btnDel.addEventListener('click', () => deleteLink(l.parent_id, l.student_id));
      tdDel.appendChild(btnDel);
      tr.append(tdP, tdS, tdD, tdDel);
      tbody.appendChild(tr);
    }
  } catch (e) {
    showMsg('linksMsg', 'Fehler beim Laden: ' + e.message, 'error');
  }
}

// Main dashboard loader
async function loadDashboard() {
  await loadUsersTable();
  await loadSubsTable();
  await loadLinksTable();
  // Update counts
  const countUsers = document.getElementById('countUsers');
  const countSubs = document.getElementById('countSubs');
  const countLinks = document.getElementById('countLinks');
  if (countUsers) {
    const data = await client.from('profiles').select('id').eq('role', 'student');
    countUsers.textContent = data?.length || 0;
  }
  if (countSubs) {
    const data = await client.from('subscriptions').select('id').eq('status', 'active');
    countSubs.textContent = data?.length || 0;
  }
  if (countLinks) {
    const data = await client.from('parent_links').select('id');
    countLinks.textContent = data?.length || 0;
  }
}

// Initialize tables on page load
async function initTables() {
  if (client) {
    await loadDashboard();
  }
}

// Ensure tables are initialized when dashboard loads
document.addEventListener('DOMContentLoaded', initTables);

boot();
})();
