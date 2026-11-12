/* ============================================================
   I-Land1o1 – Admin-Dashboard
   Zeigt Nutzer, Abos und Eltern-Kind-Verknüpfungen.
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
  let userMap = {};

  const IS_TEST_MODE = (typeof cfg.IS_TEST_MODE === 'boolean') ? cfg.IS_TEST_MODE : false;
  const ITEMS_PER_PAGE = 10;
  let currentPage = 1;
  let searchTerm = '';
  let roleFilter = '';
  let sortColumn = 'created_at';
  let sortDirection = 'desc';

  async function auditLog(action, targetId, targetEmail, details) {
    if (!client) return;
    try {
      const { data: session } = await client.auth.getSession();
      const actorEmail = session?.session?.user?.email || 'unknown';
      const actorId = session?.session?.user?.id || null;
      await client.from('admin_audit_log').insert({
        actor_id: actorId,
        actor_email: actorEmail,
        action,
        target_id: targetId,
        target_email: targetEmail,
        details: details || {}
      });
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
      .replace(/\"/g, '&quot;')
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
    return '<span class="status--' + safe + '">' + (status == null ? '–' : esc(status)) + '</span>';
  }


  // ---------- Hilfsfunktionen ----------
  function filterUsers(users) {
    return users.filter(u => {
      const matchesSearch = !searchTerm ||
        (u.display_name && u.display_name.toLowerCase().includes(searchTerm)) ||
        (u.email && u.email.toLowerCase().includes(searchTerm));
      const matchesRole = !roleFilter || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }

  function getSortedUsers(users) {
    return users.slice().sort((a, b) => {
      let valA, valB;
      switch (sortColumn) {
        case 'display_name': valA = a.display_name || ''; valB = b.display_name || ''; break;
        case 'email': valA = a.email || ''; valB = b.email || ''; break;
        case 'role': valA = a.role || ''; valB = b.role || ''; break;
        case 'last_sign_in_at': valA = a.last_sign_in_at || ''; valB = b.last_sign_in_at || ''; break;
        default: valA = a[sortColumn] || ''; valB = b[sortColumn] || ''; break;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  async function renderUsers(users) {
    const tbody = document.getElementById('usersBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = filterUsers(users);
    const sorted = getSortedUsers(filtered);
    const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageUsers = sorted.slice(start, start + ITEMS_PER_PAGE);

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
        if (r === u.role) o.selected = true;
        sel.appendChild(o);
      });
      const btn = document.createElement('button');
      btn.className = 'btn-save';
      btn.textContent = 'Speichern';
      btn.addEventListener('click', async () => {
        if (myRole !== 'admin') { showMsg('usersMsg', 'Nur Admins dürfen Rollen ändern.', 'error'); return; }
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
      tdEdit.appendChild(btn);

      const tdDate = document.createElement('td');
      tdDate.textContent = fmtDate(u.created_at);

      tr.append(tdName, tdRole, tdEdit, tdDate);
      tbody.appendChild(tr);
    }

    const pageCurrent = document.getElementById('pageCurrent');
    const pageTotal = document.getElementById('pageTotal');
    const btnPrev = document.getElementById('pagePrev');
    const btnNext = document.getElementById('pageNext');
    if (pageCurrent) pageCurrent.textContent = currentPage;
    if (pageTotal) pageTotal.textContent = totalPages || 1;
    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= (totalPages || 1);
  }

  async function renderSubs(subs) {
    const tbody = document.getElementById('subsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    for (const s of subs) {
      const user = userMap[s.user_id] || { email: 'User ' + s.user_id.slice(0, 8), display_name: 'User' };
      const tr = document.createElement('tr');
      const tdUser = document.createElement('td');
      tdUser.textContent = user.display_name || user.email || 'User';
      if (user.email && user.display_name) tdUser.textContent += ' <' + user.email + '>';
      const tdPlan = document.createElement('td');
      tdPlan.textContent = s.plan || '–';
      const tdStatus = document.createElement('td');
      tdStatus.innerHTML = statusBadge(s.status);
      const tdDate = document.createElement('td');
      tdDate.textContent = fmtDate(s.current_period_end);

      const tdReset = document.createElement('td');
      const btnReset = document.createElement('button');
      btnReset.className = 'btn-reset-sub';
      btnReset.dataset.label = 'Reset';
      btnReset.textContent = 'Reset';
      btnReset.title = 'Abo zurücksetzen (Test)';
      btnReset.addEventListener('click', () => resetSubscription(s.user_id));
      btnReset.style.marginRight = '8px';
      tdReset.appendChild(btnReset);

      if (myRole === 'admin') {
        const btnProg = document.createElement('button');
        btnProg.className = 'btn-reset-progress';
        btnProg.dataset.label = 'Fortschritt löschen';
        btnProg.textContent = 'Fortschritt löschen';
        btnProg.title = 'Lernfortschritt löschen (Test)';
        btnProg.addEventListener('click', () => resetLessonProgress(s.user_id));
        tdReset.appendChild(btnProg);
      }

      tr.append(tdUser, tdPlan, tdStatus, tdDate, tdReset);
      tbody.appendChild(tr);
    }

    const subsBox = document.getElementById('subsBox');
    if (subsBox && myRole === 'admin' && IS_TEST_MODE) {
      let bulk = subsBox.querySelector('.bulk-reset-wrap');
      if (!bulk) {
        bulk = document.createElement('div');
        bulk.className = 'bulk-reset-wrap';
        bulk.style.marginTop = '12px';
        bulk.innerHTML = '<hr style="margin:8px 0;border:none;border-top:1px solid var(--sand);"><button class="btn-reset-all">Alle Abos zurücksetzen</button>';
        subsBox.appendChild(bulk);
        bulk.querySelector('.btn-reset-all').addEventListener('click', resetAllSubscriptions);
      }
    }
  }

  async function renderLinks(links) {
    const tbody = document.getElementById('linksBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const l of links) {
      const parent = userMap[l.parent_id] || { display_name: 'Parent ' + (l.parent_id || '–').slice(0, 8), email: '' };
      const student = userMap[l.student_id] || { display_name: 'Student ' + (l.student_id || '–').slice(0, 8), email: '' };
      const tr = document.createElement('tr');
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
      showMsg('linksMsg', 'Nur Admins dürften Verknüpfungen anlegen.', 'error');
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
      showMsg('linksMsg', 'Nur Admins dürften Verknüpfungen entfernen.', 'error');
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

  async function loadDashboard() {
    if (!client) return;
    try {
      const [usersRes, subsRes, linksRes] = await Promise.all([
        client.from('profiles').select('*'),
        client.from('subscriptions').select('*'),
        client.from('parent_links').select('*')
      ]);

      document.getElementById('countUsers').textContent = (usersRes.data || []).length;
      const activeSubs = (subsRes.data || []).filter(s => ['active', 'trialing', 'paid'].includes(s.status)).length;
      document.getElementById('countSubs').textContent = activeSubs;
      document.getElementById('countLinks').textContent = (linksRes.data || []).length;

      const users = usersRes.data || [];
      userMap = {};
      users.forEach((p) => {
        userMap[p.id] = { display_name: p.display_name, email: p.email };
      });

      const parentSel = document.getElementById('linkParent');
      const studentSel = document.getElementById('linkStudent');
      parentSel.innerHTML = '<option value="">– Elternteil auswählen –</option>';
      studentSel.innerHTML = '<option value="">– Kind auswählen –</option>';
      const parents = users.filter(u => u.role === 'parent');
      const students = users.filter(u => u.role === 'student');
      parents.forEach((p) => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = (p.display_name || 'Pirat') + ' <' + (p.email || '–') + '>';
        parentSel.appendChild(o);
      });
      students.forEach((s) => {
        const o = document.createElement('option');
        o.value = s.id;
        o.textContent = (s.display_name || 'Pirat') + ' <' + (s.email || '–') + '>';
        studentSel.appendChild(o);
      });

      const searchInp = document.getElementById('userSearch');
      const filterSel = document.getElementById('userFilter');
      if (searchInp) {
        searchInp.oninput = () => { searchTerm = searchInp.value.toLowerCase(); currentPage = 1; renderUsers(users); };
      }
      if (filterSel) {
        filterSel.onchange = () => { roleFilter = filterSel.value; currentPage = 1; renderUsers(users); };
      }

      document.querySelectorAll('.admin-table th').forEach((th) => {
        th.addEventListener('click', () => {
          const col = th.dataset.sort;
          if (!col) return;
          if (sortColumn === col) { sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'; } else { sortColumn = col; sortDirection = 'asc'; }
          currentPage = 1;
          renderUsers(users);
        });
      });

      const btnPrev = document.getElementById('pagePrev');
      const btnNext = document.getElementById('pageNext');
      if (btnPrev) btnPrev.onclick = () => { if (currentPage > 1) { currentPage--; renderUsers(users); } };
      if (btnNext) btnNext.onclick = () => { const totalPages = Math.ceil(filterUsers(users).length / ITEMS_PER_PAGE); if (currentPage < totalPages) { currentPage++; renderUsers(users); } };

      const btnAddLink = document.getElementById('btnAddLink');
      if (btnAddLink) btnAddLink.onclick = createLink;

      renderUsers(users);
      renderSubs(subsRes.data || []);
      renderLinks(linksRes.data || []);
    } catch (e) {
      console.error('loadDashboard-Fehler:', e);
      showMsg('usersMsg', 'Fehler beim Laden: ' + e.message, 'error');
    }
  }

  async function resetAllSubscriptions() {
    if (myRole !== 'admin') {
      showMsg('subsMsg', 'Nur Admins dürften Abos zurücksetzen.', 'error');
      return;
    }
    if (!IS_TEST_MODE) {
      showMsg('subsMsg', 'Dieser Button ist nur im Test-Modus verfügbar.', 'error');
      return;
    }
    if (!confirm('Wirklich ALLE Abos zurücksetzen? Jeder Nutzer muss neu kaufen.')) return;

    setBusySubs(true);
    const { data: subs, error: fetchErr } = await client.from('subscriptions').select('user_id');
    if (fetchErr) {
      setBusySubs(false);
      showMsg('subsMsg', 'Fehler beim Laden: ' + fetchErr.message, 'error');
      return;
    }

    let failed = 0;
    for (const s of (subs || [])) {
      const { error } = await client.from('subscriptions').update({
        status: 'canceled',
        cancel_at_period_end: true,
        current_period_end: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString()
      }).eq('user_id', s.user_id);
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

  async function resetSubscription(userId) {
    if (myRole !== 'admin') {
      showMsg('subsMsg', 'Nur Admins dürften Abos zurücksetzen.', 'error');
      return;
    }
    if (!confirm('Wirklich das Abo für diesen User zurücksetzen? Der Zugang wird gesperrt und muss neu gekauft werden.')) return;

    setBusySubs(true);
    const { error } = await client.from('subscriptions').update({
      status: 'canceled',
      cancel_at_period_end: true,
      current_period_end: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date().toISOString()
    }).eq('user_id', userId);
    setBusySubs(false);

    if (error) {
      showMsg('subsMsg', 'Fehler beim Zurücksetzen: ' + error.message, 'error');
    } else {
      await auditLog('subscription_reset', userId, null, { plan: null });
      showMsg('subsMsg', 'Abo zurückgesetzt. Der User muss neu kaufen.', 'ok');
      loadDashboard();
    }
  }

  async function resetLessonProgress(userId) {
    if (myRole !== 'admin') {
      showMsg('subsMsg', 'Nur Admins dürften den Fortschritt löschen.', 'error');
      return;
    }
    if (!confirm('Wirklich den gesamten Lernfortschritt dieses Users löschen? Alle Lektionen werden wieder gesperrt.')) return;

    setBusySubs(true);
    const { error } = await client.from('lesson_progress').delete().eq('user_id', userId);
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

  async function boot() {
    if (!client) {
      appContent.hidden = false;
      return;
    }
    try {
      const { data } = await client.auth.getSession();
      if (!data || !data.session || !data.session.user) {
        window.location.replace('/login/index.html?next=/dashboard/admin/');
        return;
      }

      const { data: profile } = await client.from('profiles').select('display_name, role').eq('id', data.session.user.id).maybeSingle();

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
        btnLogout.onclick = async () => {
          await client.auth.signOut();
          window.location.replace('/');
        };
      }

      appContent.hidden = false;
      await loadDashboard();

    } catch (e) {
      console.error('boot-Fehler:', e);
      showMsg('usersMsg', 'Fehler beim Booten: ' + e.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
  boot();

})();
