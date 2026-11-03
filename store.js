/* 入校輔導紀錄｜IndexedDB 儲存層
 * 每筆資料帶 rev 修訂號；寫入時比對 rev，不同即視為其他分頁已修改，整批交易中止。
 */
(function (root) {
  'use strict';
  const DB_NAME = 'school-visit-records', DB_VER = 1;
  const STORES = { schools: 'schoolId', visits: 'visitId', notes: 'noteId', followUps: 'id', recordings: 'recordingId', reports: 'visitId', meta: 'key' };
  class ConflictError extends Error {}
  let db = null;
  const req2p = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const txDone = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onabort = () => rej(tx.error || tx._err || new Error('交易中止')); tx.onerror = () => {}; });

  const Store = {
    STORES, ConflictError, simulateFail: false,
    async open(idb) {
      const factory = idb || root.indexedDB;
      if (!factory) throw new Error('此瀏覽器不支援 IndexedDB');
      db = await new Promise((res, rej) => {
        const r = factory.open(DB_NAME, DB_VER);
        r.onupgradeneeded = () => { const d = r.result; Object.entries(STORES).forEach(([n, k]) => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: k }); }); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('資料庫被其他分頁鎖定，請關閉舊分頁後重試'));
      });
      db.onversionchange = () => { db.close(); };
      return Store;
    },
    async loadAll() {
      const names = Object.keys(STORES), tx = db.transaction(names, 'readonly'), out = {};
      await Promise.all(names.map(async n => { out[n] = await req2p(tx.objectStore(n).getAll()); }));
      return out;
    },
    /* items: [{store, obj, del}] — obj.rev 為本分頁最後讀到的修訂號 */
    async commit(items) {
      if (Store.simulateFail) throw new Error('模擬寫入失敗');
      if (!items.length) return;
      const names = [...new Set(items.map(i => i.store))];
      const tx = db.transaction(names, 'readwrite'), done = txDone(tx), next = [];
      items.forEach((it, idx) => {
        const os = tx.objectStore(it.store), key = it.obj[STORES[it.store]];
        const g = os.get(key);
        g.onsuccess = () => {
          const cur = g.result, curRev = cur ? (cur.rev || 0) : 0, mine = it.obj.rev || 0;
          if (cur && curRev !== mine) { tx._err = new ConflictError(`${it.store}:${key}`); try { tx.abort(); } catch (e) {} return; }
          if (it.del) { os.delete(key); next[idx] = null; return; }
          const rec = JSON.parse(JSON.stringify(it.obj)); rec.rev = curRev + 1; next[idx] = rec.rev; os.put(rec);
        };
      });
      await done;
      items.forEach((it, i) => { if (next[i] != null) it.obj.rev = next[i]; });
    },
    async putMeta(key, value) {
      if (Store.simulateFail) throw new Error('模擬寫入失敗');
      const tx = db.transaction('meta', 'readwrite'), d = txDone(tx);
      if (value === undefined) tx.objectStore('meta').delete(key); else tx.objectStore('meta').put({ key, value });
      await d;
    },
    /* 匯入：整批寫入，任何一筆失敗即全部不寫 */
    async importBatch(items) {
      if (Store.simulateFail) throw new Error('模擬寫入失敗');
      const names = [...new Set(items.map(i => i.store))];
      if (!names.length) return;
      const tx = db.transaction(names, 'readwrite'), d = txDone(tx);
      items.forEach(it => tx.objectStore(it.store).put(it.obj));
      await d;
    },
    async clearAll() {
      const names = Object.keys(STORES), tx = db.transaction(names, 'readwrite'), d = txDone(tx);
      names.forEach(n => tx.objectStore(n).clear());
      await d;
    }
  };
  root.Store = Store;
  if (typeof module === 'object' && module.exports) module.exports = Store;
})(typeof self !== 'undefined' ? self : globalThis);
