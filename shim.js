// Lets CLASS HUB run on Supabase: provides the same small database / user / upload API the page already uses.
(() => {
const sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY), T = 'docs', B = 'class-files';
const err = e => ({ code: 'error', message: (e && e.message) || 'Something went wrong' });
const par = p => p.split('/').slice(0, -1).join('/'), last = p => p.split('/').pop();
const recent = new Map(), mark = p => recent.set(p, Date.now()), pend = p => Date.now() - (recent.get(p) || 0) < 4000;
const ds = r => ({ id: last(r.path), exists: true, data: () => JSON.parse(JSON.stringify(r.data)), metadata: { hasPendingWrites: pend(r.path), fromCache: false } });
const none = p => ({ id: last(p), exists: false, data: () => undefined, metadata: { hasPendingWrites: false, fromCache: false } });
const listen = (filter, cb) => { const ch = sb.channel('r' + Math.random().toString(36).slice(2)).on('postgres_changes', { event: '*', schema: 'public', table: T, filter }, () => cb()).subscribe(); return () => sb.removeChannel(ch); };
const doc = p => ({
  id: last(p), path: p,
  async get() { const { data, error } = await sb.from(T).select('path,data').eq('path', p).maybeSingle(); if (error) throw err(error); return data ? ds(data) : none(p); },
  async set(d) { mark(p); const { data, error } = await sb.from(T).update({ data: d, updated_at: new Date().toISOString() }).eq('path', p).select('path'); if (error) throw err(error); if (data && data.length) return; const r = await sb.from(T).insert({ path: p, parent: par(p), data: d }); if (r.error) throw err(r.error); },
  async update(d) { const s = await this.get(); return this.set({ ...(s.exists ? s.data() : {}), ...d }); },
  async delete() { mark(p); const { error } = await sb.from(T).delete().eq('path', p); if (error) throw err(error); },
  onSnapshot(next, errf) { let on = 1; const run = () => this.get().then(s => on && next(s)).catch(e => errf && errf(e)); run(); const off = listen('path=eq.' + p, run); return () => { on = 0; off(); }; }
});
const col = (p, o = {}) => ({
  path: p, doc: id => doc(p + '/' + id),
  orderBy: (f, dir) => col(p, { ...o, ob: [f, dir] }), limit: n => col(p, { ...o, lim: n }),
  async get() { let q = sb.from(T).select('path,data').eq('parent', p); if (o.ob) q = q.order('data->' + o.ob[0], { ascending: o.ob[1] != 'desc' }); if (o.lim) q = q.limit(o.lim); const { data, error } = await q; if (error) throw err(error); const docs = (data || []).map(ds); return { docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map((d, i) => ({ type: 'added', doc: d, newIndex: i })), metadata: {} }; },
  onSnapshot(next, errf) {
    let prev = null, on = 1;
    const run = () => this.get().then(s => { if (!on) return; const m = new Map(s.docs.map(d => [d.id, JSON.stringify(d.data())])), ch = [];
      s.docs.forEach(d => { if (!prev || !prev.has(d.id)) ch.push({ type: 'added', doc: d }); else if (prev.get(d.id) != m.get(d.id)) ch.push({ type: 'modified', doc: d }); });
      if (prev) prev.forEach((v, id) => { if (!m.has(id)) ch.push({ type: 'removed', doc: { id } }); });
      prev = m; next({ ...s, docChanges: () => ch }); }).catch(e => errf && errf(e));
    run(); const off = listen('parent=eq.' + p, run); return () => { on = 0; off(); };
  }
});
const loginUI = () => {
  const d = document.createElement('div'); d.id = 'lg';
  d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:linear-gradient(160deg,#eef6fd,#bfe0fa);font-family:system-ui,sans-serif;color:#0f2740';
  const s = 'padding:12px;border-radius:14px;border:1px solid #b8d6ee;font-size:16px;width:100%;box-sizing:border-box', b = 'padding:12px;border-radius:14px;border:0;background:#1479d4;color:#fff;font-size:16px;cursor:pointer;width:100%';
  d.innerHTML = `<div style="background:#fff;padding:26px;border-radius:24px;width:min(92vw,360px);display:grid;gap:10px;box-shadow:0 10px 30px rgba(30,100,170,.2)"><h2 style="margin:0">CLASS HUB</h2><p style="margin:0;color:#5d7a96">Sign in to join your class.</p><button id=lgg style="${b}">Continue with Google</button><input id=lge type=email placeholder="Email" style="${s}"><button id=lgs style="${b}">Send code</button><input id=lgo placeholder="Code from email" inputmode=numeric style="${s};display:none"><button id=lgv style="${b};display:none">Verify</button><p id=lgm style="margin:0;font-size:13px;color:#5d7a96"></p></div>`;
  document.body.appendChild(d);
  const $ = i => d.querySelector('#' + i), m = t => $('lgm').textContent = t;
  $('lgg').onclick = () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } });
  $('lgs').onclick = async () => { const email = $('lge').value.trim(); if (!email) return m('Enter your email.'); const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } }); if (error) return m(error.message); m('Check your email for the code (or tap the link).'); $('lgo').style.display = $('lgv').style.display = 'block'; };
  $('lgv').onclick = async () => { const { error } = await sb.auth.verifyOtp({ email: $('lge').value.trim(), token: $('lgo').value.trim(), type: 'email' }); if (error) m(error.message); };
};
const auth = async () => {
  const { data: { session } } = await sb.auth.getSession(); if (session) return session.user;
  return new Promise(res => { loginUI(); sb.auth.onAuthStateChange((e, s) => { if (s) { const l = document.getElementById('lg'); if (l) l.remove(); res(s.user); } }); });
};
const room = uid => { const ch = sb.channel('online', { config: { presence: { key: uid } } }); let f = () => {}; ch.on('presence', { event: 'sync' }, () => f({ peers: Object.keys(ch.presenceState()) })); ch.subscribe(s => { if (s == 'SUBSCRIBED') ch.track({ here: 1 }); }); return { presence() {}, onPeers(fn) { f = fn; } }; };
let U;
window.claudeBlob = async id => { const { data, error } = await sb.storage.from(B).download(id); if (error) throw err(error); return data; };
window.claude = { async use(n) {
  if (n == 'user') { U = U || await auth(); return { id: async () => U.id, canEdit: () => false, isOwner: () => false, can: () => true }; }
  if (n == 'db') return { collection: p => col(p), doc: p => doc(p) };
  if (n == 'assets') return { upload: async f => { const cid = typeof CID == 'string' ? CID : ''; if (!cid) throw { code: 'noaccess' }; const id = cid + '/' + crypto.randomUUID() + '-' + f.name.replace(/[^\w.\-]/g, '_'); const { error } = await sb.storage.from(B).upload(id, f, { contentType: f.type || undefined }); if (error) throw { code: 'upload', message: error.message }; return { id, url: '', sizeBytes: f.size, contentType: f.type }; } };
  if (n == 'downloads') return { save: async ({ filename, data }) => { const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); } };
  if (n == 'room') { U = U || await auth(); return room(U.id); }
  return null;
} };
})();
