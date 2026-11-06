/* Urban Nex (celular) — guarda tudo no aparelho (IndexedDB; se não der, localStorage). */
(function (root) {
  "use strict";
  const DB = "urban_nex", STORE = "kv", KEY = "db", LS = "urban_nex_db";
  let data = { v: 1, users: {}, session: null }, timer = null, idb = null;

  const openIdb = () => new Promise(res => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = rq.onblocked = () => res(null);
    } catch (_) { res(null); }
  });
  const idbGet = () => new Promise(res => { try { const r = idb.transaction(STORE).objectStore(STORE).get(KEY); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); } catch (_) { res(null); } });
  const idbPut = txt => new Promise(res => { try { const t = idb.transaction(STORE, "readwrite"); t.objectStore(STORE).put(txt, KEY); t.oncomplete = () => res(true); t.onerror = t.onabort = () => res(false); } catch (_) { res(false); } });

  async function open() {
    idb = await openIdb();
    // duas cópias (IndexedDB e localStorage): vale a mais recente
    let best = null;
    const tryTxt = txt => { if (!txt) return; try { const d = JSON.parse(txt); if (d && d.users && (!best || (d.t || 0) >= (best.t || 0))) best = d; } catch (_) {} };
    tryTxt(idb ? await idbGet() : null);
    try { tryTxt(localStorage.getItem(LS)); } catch (_) {}
    if (best) data = best;
    return data;
  }
  async function flush() {
    clearTimeout(timer); timer = null;
    data.t = data.t || Date.now();
    const txt = JSON.stringify(data);
    let ok = idb ? await idbPut(txt) : false;
    try { localStorage.setItem(LS, txt); } catch (_) {}
  }
  function save() {
    clearTimeout(timer); data.t = Date.now();
    try { localStorage.setItem(LS, JSON.stringify(data)); } catch (_) {}     // cópia imediata, não perde nada se o app fechar
    timer = setTimeout(flush, 200);
  }
  if (typeof addEventListener === "function") {
    addEventListener("pagehide", () => flush());
    addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  }
  const exportJSON = () => JSON.stringify({ app: "urban_nex", version: 1, exported_at: new Date().toISOString(), data: Object.assign({}, data, { session: null }) });
  function importJSON(txt, replace) {
    let o; try { o = JSON.parse(txt); } catch (_) { throw new Error("Não consegui ler esse arquivo."); }
    const d = o && o.app === "urban_nex" ? o.data : null;
    if (!d || !d.users) throw new Error("Esse arquivo não é um backup do Urban Nex.");
    if (replace) data.users = d.users;
    else for (const [k, u] of Object.entries(d.users)) data.users[k] = u;
    save();
    return Object.keys(d.users).length;
  }
  root.NUStore = { open, flush, save, exportJSON, importJSON, get db() { return data; }, reset() { data = { v: 1, users: {}, session: null }; } };
})(typeof self !== "undefined" ? self : this);
