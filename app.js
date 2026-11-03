/* 入校輔導紀錄｜階段 B：可離線使用的個人版 */
(async () => {
'use strict';
const APP_VERSION = '0.4.0';
const SCHEMA = 1;
const FILE_FORMAT = 'school-visit-record';
const TZ = 'Asia/Taipei';

/* ======================= 欄位定義（對應原表） ======================= */
const FIELDS = [
 {code:'participants',grp:'basic',label:'學校參與人數',unit:'人',ask:'幾人'},
 {code:'teacherTotal',no:1,label:'全校教師總數',unit:'位',ask:'約幾位'},
 {code:'leads',no:2,label:'數位學習推動計畫主導人員',type:'text',ask:'姓名＋職稱'},
 {code:'guidedClasses',no:3,label:'四學教學模式實施班級數',sub:'高引導式',unit:'班',ask:'幾班'},
 {code:'collaborativeClasses',no:3,label:'四學教學模式實施班級數',sub:'高協作式',unit:'班',ask:'幾班'},
 {code:'balancedClasses',no:3,label:'四學教學模式實施班級數',sub:'平衡式',unit:'班',ask:'幾班'},
 {code:'selfDirectedClasses',no:3,label:'四學教學模式實施班級數',sub:'高自學式',unit:'班',ask:'幾班'},
 {code:'fourLearningTeachers',no:4,label:'以四學模式進行教學之教師數',sub:'教師數',unit:'位',ask:'幾位'},
 {code:'subjectCount',no:4,label:'以四學模式進行教學之教師數',sub:'涵蓋學科數',unit:'個學科',ask:'幾個學科'},
 {code:'advancedTrainingTeachers',no:5,label:'參加過數位教學進階研習的教師數',unit:'位',ask:'幾位'},
 {code:'platformTeachers',no:6,label:'教學中使用數位學習平臺之教師數',unit:'位',ask:'幾位'},
 {code:'aiTeachers',no:7,label:'將AI融入教學中之教師數',unit:'位',ask:'幾位'},
 {code:'communityCount',no:8,label:'校內數位教學相關社群數',sub:'社群數',unit:'個',ask:'幾個'},
 {code:'communityTeachers',no:8,label:'校內數位教學相關社群數',sub:'參與教師',unit:'位',ask:'幾位'},
 {code:'semesterSharingEvents',no:9,label:'本學期辦理校內外數位教學分享／推廣',unit:'次',ask:'幾次',semester:true},
 {code:'semesterExternalTeachers',no:10,label:'本學期參與校外數位教學活動之教師數',unit:'位',ask:'幾位',semester:true},
];
const FMAP = Object.fromEntries(FIELDS.map(f => [f.code, f]));
const T2 = FIELDS.filter(f => f.grp !== 'basic');
const CATS = [
 ['數位教學模式','四學模式、PBL之課堂教學設計與實作回饋'],
 ['AI與數位資源應用','生成式AI／AI學習夥伴融入教學、數位內容與平臺功能之選用建議'],
 ['共備與觀議課','協同備課陪伴、公開授課之觀課與議課回饋'],
 ['教師社群與增能','數位教學社群運作建議、校內教師增能規劃'],
 ['課程發展','學校特色課程與數位學習課程規劃之諮詢'],
 ['學習數據與成效應用','平臺學習數據解讀、學習扶助應用與成效評估建議'],
 ['其他',''],
];
const SECTIONS = [
 ['highlights','一、亮點與可延續作法'],
 ['suggestions','二、對學校的具體建議'],
 ['difficulties','三、目前困境與需協助事項'],
 ['future','四、未來推動方向與下次輔導前建議完成事項'],
];
const STATUS = {none:'未記錄',pending:'待查',estimate:'估計',confirmed:'已確認'};
const SOURCES = ['校方口述','校方提供資料','其他'];

/* ======================= 工具 ======================= */
const parts = iso => { const o = {}; new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).forEach(p => o[p.type] = p.value); return o; };
const hm = iso => { const p = parts(iso); return `${p.hour}:${p.minute}`; };
const hms = iso => { const p = parts(iso); return `${p.hour}:${p.minute}:${p.second}`; };
const ymd = iso => { const p = parts(iso); return `${p.year}-${p.month}-${p.day}`; };
const roc = iso => { const p = parts(iso); return `${+p.year-1911}年${+p.month}月${+p.day}日`; };
const rocShort = d => { const [y,m,dd] = d.split('-'); return `${+y-1911}/${+m}/${+dd}`; };
const fromTaipei = (date, t) => new Date(`${date}T${t}:00+08:00`).toISOString();
const now = () => new Date().toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
const mmss = ms => { const s = Math.round(ms/1000), h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = s%60; return (h? h+':'+String(m).padStart(2,'0') : String(m).padStart(2,'0')) + ':' + String(x).padStart(2,'0'); };
const strip = o => { const c = JSON.parse(JSON.stringify(o)); delete c.rev; return c; };
const same = (a, b) => JSON.stringify(sortKeys(strip(a))) === JSON.stringify(sortKeys(strip(b)));
function sortKeys(o){ if(Array.isArray(o)) return o.map(sortKeys); if(o && typeof o==='object') return Object.keys(o).sort().reduce((r,k)=>(r[k]=sortKeys(o[k]),r),{}); return o; }
const blankFields = () => Object.fromEntries(FIELDS.map(f => [f.code, {value:null,status:'none',source:null}]));

/* ======================= 狀態與儲存 ======================= */
let S = {schools:[],visits:[],notes:[],followUps:[],recordings:[],reports:[]};
let settings = {author:'',semester:'115-1',enterSends:true};
let ui = {view:'home',visitId:null,sel:null};
let drafts = {};
let saveState = 'ok', lastSaved = null, stale = false;
const dirty = new Map();
const KEYF = {schools:'schoolId',visits:'visitId',notes:'noteId',followUps:'id',recordings:'recordingId',reports:'visitId'};
const bc = 'BroadcastChannel' in self ? new BroadcastChannel('school-visit-records') : null;

function touch(store, obj, del){ if(!del && obj) obj.updatedAt = now(); dirty.set(store+':'+obj[KEYF[store]], {store,obj,del:!!del}); }
let queue = Promise.resolve();
function persist(){ queue = queue.then(doPersist, doPersist); return queue; }
async function doPersist(){
  if(!dirty.size){ return true; }
  const items = [...dirty.values()]; dirty.clear();
  try{
    await Store.commit(items);
    saveState = 'ok'; lastSaved = now(); renderSave();
    bc && bc.postMessage({type:'changed'});
    return true;
  }catch(e){
    if(e instanceof Store.ConflictError){
      showBanner('這筆資料已在另一個分頁修改，本分頁的變更沒有覆寫。請先匯出全部備份，再重新載入。','danger',true);
      saveState = 'fail';
    } else {
      items.forEach(i => { const k = i.store+':'+i.obj[KEYF[i.store]]; if(!dirty.has(k)) dirty.set(k,i); });
      saveState = 'fail';
    }
    renderSave(); return false;
  }
}
async function saveMeta(key, val){ try{ await Store.putMeta(key, val); return true; }catch(e){ saveState='fail'; renderSave(); return false; } }
function renderSave(){
  const html = saveState==='ok' ? `<b>已存於本機</b>${lastSaved?hms(lastSaved):''}` : `<b>儲存失敗</b>畫面文字仍保留，請至設定匯出`;
  ['saveHome','saveVisit'].forEach(id => { const el = $(id); el.className = 'save '+saveState; el.innerHTML = html; });
}
function showBanner(msg, kind, withReload){
  const b = $('banner'); b.className = 'banner' + (kind==='danger'?' danger':'');
  b.innerHTML = `<span class="grow">${esc(msg)}</span>${withReload?'<button class="btn small" id="bnExport">匯出全部備份</button><button class="btn small primary" id="bnReload">重新載入</button>':''}<button class="btn small ghost" id="bnClose">關閉</button>`;
  b.hidden = false;
}
bc && (bc.onmessage = ev => { if(ev.data && ev.data.type==='changed' && !stale){ stale = true; showBanner('另一個分頁更新了資料。重新載入後再編輯，可避免互相覆寫。','warn',true); } });

/* ======================= 查詢 ======================= */
const school = id => S.schools.find(s => s.schoolId === id);
const visit = id => S.visits.find(v => v.visitId === id);
const cur = () => visit(ui.visitId);
const sName = s => s ? (s.short || s.name) : '待歸校訪視';
const notesOf = vid => S.notes.filter(n => n.visitId === vid).sort((a,b) => a.createdAt < b.createdAt ? 1 : -1);
const recsOf = vid => S.recordings.filter(r => r.visitId === vid).sort((a,b) => a.start < b.start ? -1 : 1);
const openFU = sid => sid ? S.followUps.filter(f => f.schoolId === sid && f.status === 'open') : [];
function reportOf(vid){ let r = S.reports.find(x => x.visitId === vid); if(!r){ r = {visitId:vid,highlights:'',suggestions:'',difficulties:'',future:'',updatedAt:now()}; S.reports.push(r); } return r; }
function suggestNo(sid, sem, exceptId){
  const nos = S.visits.filter(v => v.schoolId===sid && v.semester===sem && v.visitId!==exceptId && v.visitNo).map(v => v.visitNo);
  return nos.length ? Math.max(...nos)+1 : 1;
}
function prevVisit(v){
  return S.visits.filter(x => v.schoolId && x.schoolId===v.schoolId && x.visitId!==v.visitId && x.actualStart < v.actualStart)
    .sort((a,b) => a.actualStart < b.actualStart ? 1 : -1)[0];
}
const filledCount = v => T2.filter(f => v.fields[f.code].status !== 'none').length;

/* 錄音定位：筆記時間 − 該段錄音起始時間；跨段或區間不明時由使用者選段 */
function recCandidates(note){
  const t = note.createdAt;
  return recsOf(note.visitId).filter(r => r.start <= t && (!r.end || t <= r.end));
}
function recOffset(note){
  const c = recCandidates(note);
  let r = null;
  if(note.recordingId){ r = c.find(x => x.recordingId === note.recordingId) || null; }
  else if(c.length === 1) r = c[0];
  return { rec:r, ambiguous: !r && c.length > 1, candidates:c, text: r ? mmss(new Date(note.createdAt) - new Date(r.start)) : null };
}

/* ======================= 訪視建立 ======================= */
let starting = false;
async function startVisit(sid){
  if(starting) return; starting = true;
  try{
    const exist = S.visits.find(v => v.status==='active' && sid && v.schoolId===sid);
    if(exist){ openVisit(exist.visitId); return; }
    const t = now();
    const v = {visitId:uid(),schoolId:sid||null,semester:settings.semester,visitNo:sid?suggestNo(sid,settings.semester):null,visitNoManual:false,
      author:settings.author,participantsCount:null,date:ymd(t),plannedStart:null,plannedEnd:null,sourceEvent:null,
      actualStart:t,actualEnd:null,createdAt:t,updatedAt:t,status:'active',categories:[],otherText:'',fields:blankFields(),ask:{},
      templateVersion:DocxFill.TEMPLATE_ID};
    S.visits.push(v); touch('visits', v); await persist(); openVisit(v.visitId);
  } finally { starting = false; }
}

/* ======================= 首頁 ======================= */
function renderHome(){
  $('homeSub').textContent = `${settings.semester} 學期 · 填寫人 ${settings.author || '（未設定）'}`;
  const act = S.visits.filter(v => v.status==='active').sort((a,b) => a.actualStart < b.actualStart ? 1 : -1);
  const setup = !settings.author ? `<div class="card stack" style="margin-top:16px;border-color:var(--accent)"><b>首次設定</b>
    <div class="grid2"><label class="kv"><span>預設填寫人</span><input type="text" id="sAuthor" placeholder="姓名"></label>
    <label class="kv"><span>學期</span><input type="text" id="sSem" value="${esc(settings.semester)}"></label></div>
    <div class="tiny muted">學校可在第一次訪視時再建立。行事曆連結將在下一階段提供，略過也能完整使用。</div></div>` : '';
  $('activeArea').innerHTML = setup + (act.length ? `<h2>進行中的訪視</h2><div class="stack">${act.map(v => {
      const s = school(v.schoolId), n = notesOf(v.visitId).length;
      return `<div class="card active-card school"><div class="grow"><div class="name">${esc(sName(s))} ${s?'':'<span class="tag warn">待歸校</span>'}</div>
      <div class="muted tiny">${rocShort(v.date)} · ${hm(v.actualStart)} 開始 · 筆記 ${n} 筆${v.visitNo?` · 第 ${v.visitNo} 次`:''}</div></div>
      <button class="btn primary" data-open="${v.visitId}">繼續訪視</button></div>`; }).join('')}</div>` : '');
  const live = S.schools.filter(s => !s.archived), arch = S.schools.filter(s => s.archived);
  $('schoolList').innerHTML = (live.length ? live.map(s => {
      const fu = openFU(s.schoolId), a = act.find(v => v.schoolId===s.schoolId);
      const last = S.visits.filter(v => v.schoolId===s.schoolId && v.status==='ended').sort((x,y) => x.actualStart < y.actualStart ? 1 : -1)[0];
      return `<div class="school" style="padding:4px 0"><button class="linkish grow" data-school="${s.schoolId}"><div class="name">${esc(s.short||s.name)}${s.demo?' <span class="tag">示範</span>':''}</div>
        <div class="muted tiny">${esc(s.city)} · ${esc(s.name)}${last?` · 上次 ${rocShort(last.date)}（第 ${last.visitNo??'?'} 次）`:''}</div>
        ${fu.length?`<div class="tiny" style="color:var(--warn)">上次未完成 ${fu.length} 項：${esc(fu[0].text)}${fu.length>1?' 等':''}</div>`:''}</button>
        ${a?`<button class="btn" data-open="${a.visitId}">繼續</button>`:`<button class="btn primary" data-start="${s.schoolId}">開始${esc(s.short||s.name)}輔導</button>`}</div>`; }).join('')
    : `<p class="muted" style="margin:0">${arch.length?'所有學校皆已封存。':'尚未建立學校。可先「立即筆記」，或新增學校。'}</p>`)
    + (arch.length ? `<details><summary class="tiny muted">已封存 ${arch.length} 所</summary>${arch.map(s => `<div class="list-item"><button class="linkish grow" data-school="${s.schoolId}">${esc(s.short||s.name)} <span class="muted tiny">${esc(s.name)}</span></button></div>`).join('')}</details>` : '');
  const past = S.visits.filter(v => v.status==='ended').sort((a,b) => a.actualStart < b.actualStart ? 1 : -1);
  $('pastList').innerHTML = past.length ? past.map(v => `<div class="list-item"><div class="grow"><b>${esc(sName(school(v.schoolId)))}</b>
      <div class="muted tiny">${rocShort(v.date)} ${hm(v.actualStart)}–${v.actualEnd?hm(v.actualEnd):''} · 第 ${v.visitNo??'?'} 次 ${!v.demo&&needsExport(v)?'<span class="tag warn">變更未匯出</span>':''}</div></div>
      <button class="btn small" data-open="${v.visitId}">開啟</button></div>`).join('') : `<p class="muted" style="margin:0">尚無。</p>`;
  renderBackupState();
}
/* ----- 備份提醒 ----- */
let backupInfo = {all:null, visits:{}};
function visitLatest(v){ const ts = [v.updatedAt, ...S.notes.filter(n=>n.visitId===v.visitId).map(n=>n.updatedAt), ...S.recordings.filter(r=>r.visitId===v.visitId).map(r=>r.updatedAt), ...S.followUps.filter(f=>f.visitId===v.visitId||f.doneVisitId===v.visitId).map(f=>f.updatedAt), ...S.reports.filter(r=>r.visitId===v.visitId).map(r=>r.updatedAt)].filter(Boolean); return ts.sort().pop(); }
function needsExport(v){ const e = [backupInfo.visits[v.visitId], backupInfo.all].filter(Boolean).sort().pop(); return !e || visitLatest(v) > e; }
function renderBackupState(){
  const el = $('backupState'); if(!el) return;
  const real = S.visits.filter(v => !v.demo), pending = real.filter(needsExport).length;
  const days = backupInfo.all ? Math.floor((Date.now() - Date.parse(backupInfo.all))/864e5) : null;
  const old = real.length && (days===null || days >= 7);
  el.className = 'tiny' + (old||pending ? '' : ' muted');
  el.style.color = old ? 'var(--danger)' : pending ? 'var(--warn)' : '';
  el.textContent = (backupInfo.all ? `上次全部備份：${rocShort(ymd(backupInfo.all))} ${hm(backupInfo.all)}（${days===0?'今天':days+' 天前'}）` : '尚未匯出全部備份') + (pending ? `；${pending} 筆訪視有變更尚未匯出` : '') + (old ? '。建議現在匯出一次。' : '');
}
async function markExported(vid){ const t = now(); if(vid) backupInfo.visits[vid] = t; else backupInfo.all = t; await saveMeta('backup', backupInfo); renderBackupState(); }


/* ======================= 訪視畫面 ======================= */
const ta = $('ta');
let composing = false, lastCompEnd = 0, draftTimer = null;
function openVisit(id){
  ui = {view:'visit',visitId:id,sel:null}; saveMeta('ui', ui);
  $('home').hidden = true; $('visit').hidden = false;
  ta.value = drafts[id] || '';
  renderVisit(); window.scrollTo(0,0);
}
function goHome(){
  flushDraft(); ui = {view:'home',visitId:null,sel:null}; saveMeta('ui', ui);
  $('visit').hidden = true; $('home').hidden = false; renderHome();
}
function renderVisit(){
  const v = cur(); if(!v) return goHome();
  const s = school(v.schoolId);
  $('vTitle').innerHTML = `${esc(sName(s))} ${s?'':'<span class="tag warn">待歸校</span>'}${v.status==='ended'?' <span class="tag">已結束</span>':''}
    <small>${rocShort(v.date)} · ${hm(v.actualStart)} 開始${v.actualEnd?'–'+hm(v.actualEnd):''}${v.visitNo?` · 第 ${v.visitNo} 次`:''}</small>`;
  $('pOverview').textContent = `${filledCount(v)}/${T2.length}`;
  $('pBasic').textContent = v.categories.length ? `類別 ${v.categories.length}` : '類別未選';
  const n = notesOf(v.visitId); $('pTimeline').textContent = `${n.length} 筆`;
  const ask = Object.keys(v.ask).filter(k => v.ask[k]).length, fu = S.followUps.filter(f => f.visitId===v.visitId).length;
  $('pCheckout').textContent = `待補 ${ask} · 追蹤 ${fu}`;
  $('pRec').textContent = `${recsOf(v.visitId).length} 段`;
  const r = S.reports.find(x => x.visitId===v.visitId);
  $('pReport').textContent = r ? `${SECTIONS.filter(([k]) => r[k] && r[k].trim()).length}/4 段` : '未撰寫';
  $('enterHint').textContent = settings.enterSends ? 'Enter 記下；選字時不送出' : 'Enter 換行';
  ta.setAttribute('enterkeyhint', settings.enterSends ? 'send' : 'enter');
  const last = n[0];
  $('latest').innerHTML = last ? noteHTML(last) : `<p class="muted" style="margin:0">尚無筆記。在上方輸入一句話後按「記下」，或直接按「標記此刻」留下時間點。</p>`;
}
function noteHTML(n){
  const fu = S.followUps.find(f => f.noteId === n.noteId), ro = recOffset(n);
  return `<div class="note" data-note="${n.noteId}" id="note-${n.noteId}">
    <div class="meta"><b>${hms(n.createdAt)}</b>${n.kind==='mark'?'<span class="tag mark">時間標記</span>':''}
      ${ro.text?`<span class="tag acc recoff">${esc(ro.rec.label)} ${ro.text}</span>`:''}
      ${ro.ambiguous?`<span class="tag warn">錄音分段不明</span>${ro.candidates.map(c=>`<button class="chip" data-pickrec="${n.noteId}" data-rec="${c.recordingId}">${esc(c.label)}</button>`).join('')}`:''}
      ${n.updatedAt!==n.createdAt?`<span>修訂於 ${hm(n.updatedAt)}</span>`:''}${fu?'<span class="tag acc">已列追蹤</span>':''}</div>
    <div class="text ${n.text?'':'empty'}">${n.text?esc(n.text):'（尚未補字）'}</div>
    <div class="row"><button class="btn small" data-edit="${n.noteId}">補字／修訂</button>
      ${fu?'':`<button class="btn small" data-fu="${n.noteId}">設為追蹤</button>`}</div></div>`;
}
async function commit(kind){
  const v = cur(); if(!v) return;
  const text = ta.value.trim();
  if(kind==='note' && !text){ toast('請先輸入內容'); ta.focus(); return; }
  const last = notesOf(v.visitId)[0];
  if(last && last.text===text && last.kind===kind && Date.now()-new Date(last.createdAt) < 1500) return; // 連點防重
  const t = now();
  const n = {noteId:uid(),visitId:v.visitId,kind,text,createdAt:t,updatedAt:t,recordingId:null};
  S.notes.push(n); touch('notes', n);
  ta.value = ''; delete drafts[v.visitId];
  renderVisit();
  const ok = await persist();
  if(!ok){
    S.notes = S.notes.filter(x => x !== n); dirty.delete('notes:'+n.noteId);
    if(!ta.value) ta.value = text; drafts[v.visitId] = ta.value;
    renderVisit(); toast('儲存失敗，文字保留在輸入框');
    return;
  }
  saveMeta('draft:'+v.visitId, undefined);
  toast(kind==='mark' ? `已標記 ${hms(t)}` : '已記下');
  const el = document.querySelector('#latest .note'); if(el) el.classList.add('flash');
}
function flushDraft(){
  clearTimeout(draftTimer);
  const v = cur(); if(!v) return;
  if(ta.value) drafts[v.visitId] = ta.value; else delete drafts[v.visitId];
  ui.sel = [ta.selectionStart, ta.selectionEnd];
  saveMeta('draft:'+v.visitId, ta.value || undefined); saveMeta('ui', ui);
}
ta.addEventListener('compositionstart', () => composing = true);
ta.addEventListener('compositionend', () => { composing = false; lastCompEnd = Date.now(); });
ta.addEventListener('keydown', e => {
  if(e.key!=='Enter' || e.shiftKey || !settings.enterSends) return;
  if(e.isComposing || composing || e.keyCode===229 || Date.now()-lastCompEnd < 120) return; // 組字中的 Enter 交給輸入法選字
  e.preventDefault(); commit('note');
});
ta.addEventListener('input', () => { clearTimeout(draftTimer); draftTimer = setTimeout(flushDraft, 400); });
['saveBtn','markBtn'].forEach(id => {
  $(id).addEventListener('mousedown', e => e.preventDefault());
  $(id).addEventListener('pointerdown', e => { if(document.activeElement===ta) e.preventDefault(); });
});
$('saveBtn').onclick = () => { const f = document.activeElement===ta; commit('note'); if(f) ta.focus(); };
$('markBtn').onclick = () => { const f = document.activeElement===ta; commit('mark'); if(f) ta.focus(); };
$('backHome').onclick = goHome;
document.addEventListener('visibilitychange', () => { if(document.visibilityState==='hidden'){ flushDraft(); persist(); } });
window.addEventListener('pagehide', flushDraft);

/* ======================= 次層面板 ======================= */
let sheetKind = null, sheetCtx = {}, restoreFocus = null;
const TITLES = {overview:'學校推動概況',basic:'基本資料與輔導類別',timeline:'時間軸',checkout:'離校核對',settings:'設定',
  recordings:'錄音參照',report:'輔導觀察與綜合建議',export:'匯出',school:'學校資料',import:'匯入預覽'};
function openSheet(kind, opt={}){
  if(!$('visit').hidden) { restoreFocus = document.activeElement===ta ? [ta.selectionStart,ta.selectionEnd] : null; flushDraft(); }
  pendingConfirm = null; sheetKind = kind; sheetCtx = opt; if(kind==='overview') kp = {code:null, fresh:true};
  $('sheetTitle').textContent = TITLES[kind];
  $('sheet').hidden = false; $('sheet').scrollTop = 0;
  renderSheet(opt);
}
function closeSheet(){
  $('sheet').hidden = true; sheetKind = null; sheetCtx = {};
  persist();
  if($('visit').hidden){ renderHome(); return; }
  renderVisit();
  if(restoreFocus){ ta.focus(); try{ ta.setSelectionRange(...restoreFocus); }catch(e){} }
}
$('closeSheet').onclick = closeSheet;
function renderSheet(opt={}){
  const b = $('sheetBody'), keep = $('sheet').scrollTop;
  const fn = {overview:overviewHTML,basic:basicHTML,timeline:()=>timelineHTML(opt.edit),checkout:checkoutHTML,settings:settingsHTML,
    recordings:recordingsHTML,report:reportHTML,export:exportHTML,school:()=>schoolHTML(sheetCtx.schoolId),import:importHTML}[sheetKind];
  b.innerHTML = fn();
  if(!opt.top) $('sheet').scrollTop = keep;
  if(opt.edit){ const t = $('edit-'+opt.edit); if(t){ t.focus(); t.scrollIntoView({block:'center'}); } }
  if(sheetKind==='settings'){ refreshOfflineState(); checkPersist(false).then(renderPersist); }
}

/* ----- 推動概況 ----- */
function fieldRow(f, v){
  const fv = v.fields[f.code], asked = !!v.ask[f.code];
  const pv = prevVisit(v), pf = pv && pv.fields[f.code];
  const sameSem = pv && pv.semester === v.semester;
  const canCarry = pf && pf.value != null && fv.status === 'none' && !(f.semester && !sameSem);
  const carry = canCarry ? `<div class="carry">前次（第 ${pv.visitNo??'?'} 次，${rocShort(pv.date)}）：${pf.status==='estimate'?'約 ':''}${esc(String(pf.value).replace(/\n/g,'、'))} ${f.type==='text'?'':f.unit}
       <button class="btn small" data-carry="${f.code}">確認沿用</button></div>` : '';
  const carried = fv.carriedFrom ? (() => { const sv = visit(fv.carriedFrom); return `<div class="carry">沿用自第 ${sv?.visitNo??'?'} 次${sv?'（'+rocShort(sv.date)+'）':''}，確認於 ${roc(fv.confirmedAt)}</div>`; })() : '';
  const st = `<span class="tag ${fv.status==='confirmed'?'ok':fv.status==='estimate'?'acc':fv.status==='pending'?'warn':''}">${STATUS[fv.status]}</span>`;
  const input = f.type==='text'
    ? `<textarea id="fv-${f.code}" data-fv="${f.code}" rows="2" placeholder="姓名＋職稱，多人可分行">${esc(fv.value??'')}</textarea>`
    : `<div class="numin"><input type="text" inputmode="numeric" pattern="[0-9]*" id="fv-${f.code}" data-fv="${f.code}" value="${fv.value??''}" aria-label="${esc(f.label+(f.sub||''))}">
        <span class="unit">${f.unit}</span>${st}</div>`;
  return `<div class="field" id="row-${f.code}">
    <div class="lbl">${f.no?`<span class="no">${f.no}.</span>`:''}<span>${esc(f.label)}</span>${f.sub?`<span class="sub">${esc(f.sub)}</span>`:''}${f.type==='text'?st:''}</div>
    ${input}
    <div class="chips">
      <button class="chip" data-st="${f.code}" data-val="pending" aria-pressed="${fv.status==='pending'}">待查</button>
      ${f.type==='text'?'':`<button class="chip" data-st="${f.code}" data-val="estimate" aria-pressed="${fv.status==='estimate'}">估計</button>`}
      <button class="chip ask" data-ask="${f.code}" aria-pressed="${asked}">請校方補</button>
      <select class="src" data-src="${f.code}" aria-label="資料來源" ${fv.value!=null?'':'hidden'}>${SOURCES.map(s=>`<option ${(fv.source||'校方口述')===s?'selected':''}>${s}</option>`).join('')}</select>
    </div>
    <div class="tiny est-warn" style="color:var(--danger)" ${fv.status==='estimate'&&fv.value==null?'':'hidden'}>估計需填數值</div>
    ${carry}${carried}
  </div>`;
}
/* 現場速填：依話題分組的磚格＋自帶數字鍵盤（不叫出系統鍵盤） */
const QUICK = [
 ['人員', ['participants','teacherTotal','leads']],
 ['四學教學模式', ['guidedClasses','collaborativeClasses','balancedClasses','selfDirectedClasses','fourLearningTeachers','subjectCount']],
 ['增能與社群', ['advancedTrainingTeachers','communityCount','communityTeachers']],
 ['平臺與 AI', ['platformTeachers','aiTeachers']],
 ['本學期活動', ['semesterSharingEvents','semesterExternalTeachers']],
];
const SHORT = {participants:'參與人數',teacherTotal:'教師總數',leads:'主導人員',guidedClasses:'高引導式',collaborativeClasses:'高協作式',balancedClasses:'平衡式',selfDirectedClasses:'高自學式',
  fourLearningTeachers:'四學教師',subjectCount:'涵蓋學科',advancedTrainingTeachers:'進階研習教師',communityCount:'社群數',communityTeachers:'社群參與教師',
  platformTeachers:'用平臺教師',aiTeachers:'AI 融入教師',semesterSharingEvents:'分享推廣場次',semesterExternalTeachers:'校外活動教師'};
const QORDER = QUICK.flatMap(g => g[1]);
let kp = {code:null, fresh:true};
function carryable(code, v){
  const f = FMAP[code], pv = prevVisit(v), pf = pv && pv.fields[code];
  if(!pf || pf.value==null) return null;
  if(f.semester && pv.semester!==v.semester) return null;
  return {pv, pf};
}
function tileHTML(code, v){
  const f = FMAP[code], fv = v.fields[code], asked = !!v.ask[code], c = carryable(code, v);
  let val;
  if(fv.status==='pending') val = '待查';
  else if(fv.value!=null) val = f.type==='text' ? String(fv.value).split('\n')[0] : (fv.status==='estimate'?'約':'') + fv.value;
  else val = fv.status==='estimate' ? '約？' : '—';
  const prev = c && fv.status==='none' ? `<span class="tprev">前次 ${c.pf.status==='estimate'?'約':''}${esc(String(c.pf.value).split('\n')[0])}</span>` : '';
  return `<button class="tile st-${fv.status}${kp.code===code?' on':''}" data-tile="${code}" aria-label="${esc(SHORT[code])}">
    <span class="tl">${f.no?`<i>${f.no}</i>`:''}${esc(SHORT[code])}</span>
    <span class="tv">${esc(val)}${f.type!=='text'&&fv.value!=null?`<small>${f.unit}</small>`:''}</span>${prev}
    ${asked?'<span class="tflag">補</span>':''}</button>`;
}
function keypadHTML(v){
  if(!kp.code) return `<div class="kpad" id="kpad"><div class="muted" style="text-align:center;padding:14px 0">點上方任一格開始輸入。數字會即時存檔，不必按完成。</div></div>`;
  const f = FMAP[kp.code], fv = v.fields[kp.code], c = carryable(kp.code, v), asked = !!v.ask[kp.code];
  const last = QORDER.indexOf(kp.code) === QORDER.length-1;
  const title = `${f.no?f.no+'. ':''}${esc(f.label)}${f.sub?'<b>－'+esc(f.sub)+'</b>':''}`;
  const disp = fv.status==='pending' ? '<span style="color:var(--warn)">待查</span>'
    : fv.value!=null ? `${fv.status==='estimate'?'<span style="color:var(--accent)">約</span>':''}${esc(f.type==='text'?'':fv.value)}<small>${f.type==='text'?'':f.unit}</small>`
    : `<span class="muted">${fv.status==='estimate'?'約 ？':'—'}</span>`;
  const side = `
      <button class="key fn" data-kp="ask" aria-pressed="${asked}">請校方補</button>
      <button class="key fn" data-kp="carry" ${c&&fv.status==='none'?'':'disabled'}>${c?`沿用前次<small>${c.pf.status==='estimate'?'約':''}${esc(String(c.pf.value).split('\n')[0])}</small>`:'沿用前次'}</button>
      <button class="key fn next" data-kp="next">${last?'完成':'下一格 ▸'}</button>`;
  if(f.type==='text') return `<div class="kpad" id="kpad">
    <div class="ktitle">${title}</div>
    <textarea id="fv-${f.code}" data-fv="${f.code}" rows="2" placeholder="姓名＋職稱，多人可分行；也可先按待查或請校方補">${esc(fv.value??'')}</textarea>
    <div class="kside" style="margin-top:8px"><button class="key fn" data-kp="pending" aria-pressed="${fv.status==='pending'}">待查</button>${side}</div></div>`;
  return `<div class="kpad" id="kpad">
    <div class="ktop"><div class="ktitle grow">${title}</div><div class="kdisp">${disp}</div></div>
    ${fv.status==='estimate'&&fv.value==null?'<div class="tiny" style="color:var(--danger);margin-bottom:6px">估計需填數值</div>':''}
    <div class="kbody">
      <div class="kgrid">${['1','2','3','4','5','6','7','8','9'].map(d=>`<button class="key" data-kp="d" data-d="${d}">${d}</button>`).join('')}
        <button class="key fn" data-kp="clear">清除</button><button class="key" data-kp="d" data-d="0">0</button><button class="key fn" data-kp="bs" aria-label="刪除">⌫</button></div>
      <div class="kside">
        <button class="key fn" data-kp="est" aria-pressed="${fv.status==='estimate'}">約（估計）</button>
        <button class="key fn" data-kp="pending" aria-pressed="${fv.status==='pending'}">待查</button>${side}
      </div>
    </div></div>`;
}
function quickHTML(v){
  return `<div id="quickWrap">${QUICK.map(([g, codes]) => `<div class="qgroup"><h3>${g}</h3><div class="qgrid">${codes.map(c => tileHTML(c, v)).join('')}</div></div>`).join('')}
    ${keypadHTML(v)}</div>`;
}
function refreshQuick(){ const w = $('quickWrap'); if(w){ const d = document.createElement('div'); d.innerHTML = quickHTML(cur()); w.replaceWith(d.firstElementChild); } }
function numSet(code, s){
  const v = cur(), fv = v.fields[code];
  delete fv.carriedFrom; delete fv.confirmedAt;
  fv.value = s==='' ? null : parseInt(s, 10);
  if(fv.value!=null){ if(fv.status!=='estimate') fv.status = 'confirmed'; if(!fv.source) fv.source = '校方口述'; fv.confirmedDate = ymd(now()); }
  else if(fv.status!=='estimate') fv.status = 'none';
  touch('visits', v); persist();
}
function keypadPress(act, d){
  const v = cur(), code = kp.code; if(!code) return;
  const fv = v.fields[code];
  switch(act){
    case 'd':{ if(fv.status==='pending') fv.status = 'none'; let s = kp.fresh ? '' : (fv.value==null ? '' : String(fv.value)); kp.fresh = false; s = (s + d).replace(/^0+(?=\d)/, ''); if(s.length > 5) return; numSet(code, s); break; }
    case 'bs': kp.fresh = false; numSet(code, String(fv.value ?? '').slice(0, -1)); break;
    case 'clear': kp.fresh = true; fv.status = 'none'; numSet(code, ''); break;
    case 'est': fv.status = fv.status==='estimate' ? (fv.value!=null ? 'confirmed' : 'none') : 'estimate'; touch('visits', v); persist(); break;
    case 'pending': if(fv.status==='pending'){ fv.status = 'none'; } else { fv.status = 'pending'; fv.value = null; } kp.fresh = true; touch('visits', v); persist(); break;
    case 'ask': if(v.ask[code]) delete v.ask[code]; else v.ask[code] = true; touch('visits', v); persist(); break;
    case 'carry':{ const c = carryable(code, v); if(!c) return; v.fields[code] = {value:c.pf.value,status:c.pf.status==='estimate'?'estimate':'confirmed',source:c.pf.source,carriedFrom:c.pv.visitId,confirmedAt:now(),confirmedDate:ymd(now())}; touch('visits', v); persist(); toast('已沿用前次'); break; }
    case 'next':{ const i = QORDER.indexOf(code); kp.code = i < QORDER.length-1 ? QORDER[i+1] : null; kp.fresh = true; break; }
  }
  refreshQuick();
}
function overviewHTML(){
  const v = cur(), mode = settings.overviewMode || 'quick';
  const seg = `<div class="seg" role="tablist"><button data-ovmode="quick" aria-pressed="${mode==='quick'}">現場速填</button><button data-ovmode="full" aria-pressed="${mode==='full'}">完整整理</button></div>`;
  if(mode==='quick') return seg + quickHTML(v);
  return seg + `<p class="muted tiny" style="margin-top:14px">數字可稍後補。0 表示確認為零；留白為未記錄。「估計」在 Word 中加「約」；「待查」顯示為待查。前次數值須按「確認沿用」才會寫入本次；第 9、10 項跨學期不沿用。</p>
   <div class="card">${T2.map(f => fieldRow(f, v)).join('')}</div>`;
}
function rerow(code){ const el = $('row-'+code); if(el){ const d = document.createElement('div'); d.innerHTML = fieldRow(FMAP[code], cur()); el.replaceWith(d.firstElementChild); } }
function setVal(code, raw){
  const v = cur(), f = FMAP[code], fv = v.fields[code];
  delete fv.carriedFrom; delete fv.confirmedAt;
  let ret;
  if(f.type==='text'){
    const s = raw.trim(); fv.value = s || null;
    fv.status = s ? 'confirmed' : (fv.status==='pending' ? 'pending' : 'none');
  } else {
    const d = raw.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0)-65248)).replace(/\D/g,'');
    fv.value = d==='' ? null : parseInt(d,10);
    if(fv.value==null){ if(fv.status!=='pending' && fv.status!=='estimate') fv.status = 'none'; }
    else if(fv.status!=='estimate') fv.status = 'confirmed';
    ret = d;
  }
  if(fv.value!=null && !fv.source) fv.source = '校方口述';
  fv.confirmedDate = fv.value!=null ? ymd(now()) : null;
  touch('visits', v);
  return ret;
}

/* ----- 基本資料 ----- */
function basicHTML(){
  const v = cur(), s = school(v.schoolId), sug = v.schoolId ? suggestNo(v.schoolId, v.semester, v.visitId) : null;
  const dup = v.schoolId && v.visitNo && S.visits.some(x => x.visitId!==v.visitId && x.schoolId===v.schoolId && x.semester===v.semester && x.visitNo===v.visitNo);
  return `<div class="card stack" style="margin-top:14px">
    <label class="kv"><span>學校</span><select id="bSchool"><option value="">（待歸校）</option>${S.schools.map(x=>`<option value="${x.schoolId}" ${x.schoolId===v.schoolId?'selected':''}>${esc(x.city)}｜${esc(x.name)}</option>`).join('')}</select></label>
    ${s?'':'<div class="tiny" style="color:var(--warn)">歸校後，本次的筆記、概況、錄音參照與追蹤會一併移到該校。</div>'}
    <div class="grid2">
      <label class="kv"><span>輔導日期</span><input type="date" id="bDate" value="${v.date}"></label>
      <label class="kv"><span>學期</span><input type="text" id="bSem" value="${esc(v.semester)}"></label>
      <label class="kv"><span>實際開始</span><input type="time" id="bStart" value="${hm(v.actualStart)}"></label>
      <label class="kv"><span>實際結束${v.actualEnd && ymd(v.actualEnd)!==v.date?'（跨日）':''}</span><input type="time" id="bEnd" value="${v.actualEnd?hm(v.actualEnd):''}"></label>
      <label class="kv"><span>填寫人</span><input type="text" id="bAuthor" value="${esc(v.author)}"></label>
      <label class="kv"><span>為本校第幾次輔導${sug?`（建議第 ${sug} 次）`:''}</span>
        <div class="numin"><span>第</span><input type="text" inputmode="numeric" id="bNo" value="${v.visitNo??''}"><span>次</span></div></label>
    </div>
    ${dup?'<div class="tiny" style="color:var(--danger)">本學期已有相同次別的訪視，請確認是否正確；系統不會自動重排歷史紀錄。</div>':''}
    <div class="tiny muted">修改實際起訖不影響筆記的原始記錄時間與錄音定位。</div>
  </div>
  <div class="card" style="margin-top:12px">${fieldRow(FMAP.participants, v)}</div>
  <h2>輔導類別（可複選）</h2>
  <div class="card">${CATS.map((c,i) => `<label class="cat"><input type="checkbox" data-cat="${i+1}" ${v.categories.includes(i+1)?'checked':''}>
     <span><b>${i+1}. ${c[0]}</b>${c[1]?`<small>${c[1]}</small>`:''}</span></label>`).join('')}
    ${v.categories.includes(7)?`<input type="text" id="bOther" placeholder="其他：請說明" value="${esc(v.otherText)}">${v.otherText?'':'<div class="tiny" style="color:var(--warn)">選了「其他」，正式匯出前需補上說明。</div>'}`:''}
  </div>`;
}

/* ----- 時間軸 ----- */
function timelineHTML(editId){
  const n = notesOf(cur().visitId);
  if(!n.length) return '<p class="muted" style="margin-top:14px">尚無筆記。</p>';
  return `<p class="muted tiny" style="margin-top:14px">新到舊排列。補字會保留最初記錄時間。</p><div class="card">${n.map(x => x.noteId===editId
    ? `<div class="note" id="note-${x.noteId}"><div class="meta"><b>${hms(x.createdAt)}</b>${x.kind==='mark'?'<span class="tag mark">時間標記</span>':''}</div>
       <textarea id="edit-${x.noteId}" rows="3">${esc(x.text)}</textarea>
       <div class="row"><button class="btn small primary" data-editsave="${x.noteId}">儲存</button><button class="btn small ghost" data-editcancel="1">取消</button></div></div>`
    : noteHTML(x)).join('')}</div>`;
}

/* ----- 錄音參照 ----- */
function recordingsHTML(){
  const v = cur(), rs = recsOf(v.visitId);
  return `<div class="note-box" style="margin-top:14px"><b>錄音前提醒</b><div class="tiny">請先向校方說明錄音用途並取得同意。錄音檔若要交給外部 AI 處理（轉錄、摘要），需另行確認。本系統只保存錄音的檔名與起始時間，原音檔請自行保存及移交。</div>
    <label class="inline"><input type="checkbox" id="recConsent" ${v.recordingConsentNoted?'checked':''}> 已向校方說明錄音用途</label></div>
  <h2>本次錄音（${rs.length} 段）</h2>
  <div class="card">${rs.length ? rs.map(r => `<div class="field" id="rec-${r.recordingId}">
      <div class="grid2">
        <label class="kv"><span>名稱或檔名</span><input type="text" data-recf="label" data-recid="${r.recordingId}" value="${esc(r.label)}"></label>
        <label class="kv"><span>說明</span><input type="text" data-recf="desc" data-recid="${r.recordingId}" value="${esc(r.desc||'')}"></label>
        <label class="kv"><span>實際開始錄音</span><input type="time" step="1" data-recf="start" data-recid="${r.recordingId}" value="${hms(r.start)}"></label>
        <label class="kv"><span>結束（可留白）</span><input type="time" step="1" data-recf="end" data-recid="${r.recordingId}" value="${r.end?hms(r.end):''}"></label>
      </div>
      <div class="row"><span class="tiny muted grow">對應筆記 ${S.notes.filter(n=>n.visitId===v.visitId&&recOffset(n).rec===r).length} 筆</span><button class="btn small danger" data-recdel="${r.recordingId}">刪除此段</button></div>
    </div>`).join('') : '<p class="muted" style="margin:0">尚無錄音參照。</p>'}</div>
  <h2>新增一段</h2>
  <div class="card stack">
    <div class="row"><button class="btn primary grow" id="recNow">現在開始錄音（記下此刻）</button></div>
    <div class="tiny muted">或補登：選取錄音檔只會讀取檔名，不會上傳或保存音檔。</div>
    <div class="grid2">
      <label class="kv"><span>名稱或檔名</span><input type="text" id="recLabel" placeholder="例：錄音 1"></label>
      <label class="kv"><span>實際開始時間</span><input type="time" step="1" id="recStart" value="${hms(v.actualStart)}"></label>
    </div>
    <div class="row"><label class="btn" for="recFile">從錄音檔帶入檔名…</label><input type="file" id="recFile" accept="audio/*,.m4a,.mp3,.wav" hidden><button class="btn" id="recAdd">新增</button></div>
  </div>`;
}

/* ----- 綜合建議 ----- */
function reportHTML(){
  const v = cur(), r = reportOf(v.visitId), ns = notesOf(v.visitId).slice().reverse();
  const fus = S.followUps.filter(f => f.visitId===v.visitId || (f.schoolId && f.schoolId===v.schoolId && f.status==='open'));
  const wide = matchMedia('(min-width:1000px)').matches;
  return `<div class="split">
   <div class="notes-col"><details ${wide?'open':''}><summary>原始筆記（${ns.length}）：點段落代號帶入</summary>
    <div class="card" style="margin-top:8px">${ns.map(n => `<div class="note"><div class="meta"><b>${hm(n.createdAt)}</b>${n.kind==='mark'?'<span class="tag mark">標記</span>':''}</div>
      <div class="text ${n.text?'':'empty'}">${n.text?esc(n.text):'（未補字）'}</div>
      ${n.text?`<div class="sec-picks">${SECTIONS.map(([k],i)=>`<button class="chip" data-pick="${n.noteId}" data-sec="${k}" aria-label="帶入第${i+1}段">帶入${'一二三四'[i]}</button>`).join('')}</div>`:''}</div>`).join('') || '<p class="muted" style="margin:0">尚無筆記。</p>'}</div>
    ${fus.length?`<h2>追蹤事項</h2><div class="card">${fus.map(f=>`<div class="list-item"><div class="grow">${esc(f.text)}<div class="tiny muted">${f.status==='done'?'已完成':'待追蹤'}</div></div><button class="btn small" data-fupick="${f.id}">帶入四</button></div>`).join('')}</div>`:''}
   </details></div>
   <div class="report-col stack">
    <p class="muted tiny" style="margin:0">四段內容會寫入 Word 第三表；原始筆記、錄音與未帶入的備忘不會出現在 Word。</p>
    ${SECTIONS.map(([k,t]) => `<label class="kv"><span>${t}</span><textarea id="rp-${k}" data-rp="${k}" rows="6">${esc(r[k])}</textarea></label>`).join('')}
   </div></div>`;
}

/* ----- 離校核對 ----- */
const askList = v => FIELDS.filter(f => v.ask[f.code]);
function clipText(v){
  const s = school(v.schoolId), items = askList(v);
  if(!items.length) return '';
  const lines = items.map((f,i) => `${i+1}. ${f.label}${f.sub?'－'+f.sub:''}（${f.ask}）`);
  return `【入校輔導待補資料】\n學校：${s?s.name:'（尚未歸校）'}\n輔導日期：民國${roc(v.actualStart)}\n\n煩請協助補充下列資料：\n${lines.join('\n')}\n\n謝謝您的協助！`;
}
function checkoutHTML(){
  const v = cur(), asked = askList(v);
  const missing = FIELDS.filter(f => !v.ask[f.code] && (v.fields[f.code].status==='none' || v.fields[f.code].status==='pending' || (v.fields[f.code].status==='estimate' && v.fields[f.code].value==null)));
  const mine = S.followUps.filter(f => f.visitId===v.visitId);
  const prior = S.followUps.filter(f => f.schoolId && f.schoolId===v.schoolId && f.visitId!==v.visitId && (f.status==='open' || f.doneVisitId===v.visitId));
  const fname = f => `${f.no?f.no+'. ':''}${esc(f.label)}${f.sub?`<span style="color:var(--accent)">－${esc(f.sub)}</span>`:''} <span class="muted tiny">（${f.unit||'文字'}）</span>`;
  return `
  <h2>待校方補充（${asked.length}）</h2>
  <div class="card">${asked.length ? asked.map(f => `<div class="list-item"><div class="grow">${fname(f)}<div class="tiny muted">${STATUS[v.fields[f.code].status]}</div></div>
     <button class="btn small" data-unask="${f.code}">移除</button></div>`).join('') : '<p class="muted" style="margin:0">尚未勾選。可從下方「尚未記錄」加入，或在推動概況按「請校方補」。</p>'}</div>
  <div class="row" style="margin-top:10px"><button class="btn primary grow" id="copyList" ${asked.length?'':'disabled'}>複製待補清單給承辦人</button></div>
  <div id="copyOut"></div>
  <h2>尚未記錄或待查（${missing.length}）</h2>
  <div class="card">${missing.length ? missing.map(f => `<div class="list-item"><div class="grow">${fname(f)}<div class="tiny muted">${STATUS[v.fields[f.code].status]}</div></div>
     <button class="btn small" data-askadd="${f.code}">加入待補</button></div>`).join('') + `<div class="row" style="padding-top:10px"><button class="btn small" id="askAll">全部加入待補</button></div>` : '<p class="muted" style="margin:0">各欄皆已記錄或已列入待補。</p>'}</div>
  <h2>下次追蹤事項</h2>
  <div class="card">
    ${mine.map(f => fuRow(f)).join('') || '<p class="muted" style="margin:0 0 8px">本次尚無。可在筆記上按「設為追蹤」，或直接新增。</p>'}
    <div class="row" style="padding-top:8px"><input type="text" id="fuNew" placeholder="新增追蹤事項" style="flex:1;min-width:0"><button class="btn" id="fuAdd">新增</button></div>
  </div>
  ${prior.length ? `<h2>前次未完成（${prior.filter(f => f.status==='open').length}）</h2><div class="card">${prior.map(f => fuRow(f,true)).join('')}</div>` : ''}
  <h2>結束訪視</h2>
  <div class="card stack">
    ${v.actualEnd ? `<div>已於 <b>${hm(v.actualEnd)}</b> 結束。時間可在「基本資料」修改。</div>${needsExport(v)?'<div class="note-box"><b>建議現在匯出訪視檔</b><div class="tiny">紀錄目前只在這台裝置上。匯出後可存到「檔案」或傳到電腦。</div><button class="btn primary" id="expVisit2">匯出訪視檔</button></div>':'<div class="tiny" style="color:var(--ok)">本次紀錄已匯出。</div>'}<button class="btn" id="reopen">重新開啟訪視</button>`
      : `<div class="muted tiny">寫入實際結束時間 ${hm(now())}，之後仍可修改。</div><button class="btn primary" id="endVisit">結束訪視</button>`}
  </div>`;
}
function fuRow(f, prior){
  const src = f.noteId && S.notes.find(n => n.noteId===f.noteId), pv = prior && visit(f.visitId);
  return `<div class="list-item"><input type="checkbox" data-fudone="${f.id}" ${f.status==='done'?'checked':''} aria-label="已完成">
    <div class="grow"><div style="${f.status==='done'?'text-decoration:line-through;color:var(--muted)':''}">${esc(f.text)}</div>
    <div class="tiny muted">${pv?`來自第 ${pv.visitNo??'?'} 次（${rocShort(pv.date)}）`:''}${src?`<button class="btn small ghost" data-gonote="${src.noteId}" data-govisit="${src.visitId}" style="min-height:36px;padding:0 4px">來源筆記 ${hm(src.createdAt)}</button>`:''}
    ${f.status==='done'?`· 已完成${f.doneVisitId===cur().visitId?'（本次）':''}`:''}</div></div>
    ${prior?'':`<button class="btn small danger" data-fudel="${f.id}">刪除</button>`}</div>`;
}

/* ----- 匯出 ----- */
function exportChecks(v){
  const s = school(v.schoolId), block = [], warn = [];
  if(!s) block.push('尚未歸校：請在「基本資料」選擇學校');
  if(!v.date) block.push('尚未確認輔導日期');
  if(!v.visitNo) block.push('尚未填寫「為本校第幾次輔導」');
  if(v.categories.includes(7) && !v.otherText) warn.push('輔導類別勾選「其他」但未填說明');
  if(!v.actualEnd) warn.push('尚未寫入實際結束時間，Word 只會填開始時間');
  const est = FIELDS.filter(f => v.fields[f.code].status==='estimate');
  const pen = FIELDS.filter(f => v.fields[f.code].status==='pending');
  const none = FIELDS.filter(f => v.fields[f.code].status==='none');
  const estBad = est.filter(f => v.fields[f.code].value==null);
  if(estBad.length) block.push('估計值缺少數字：' + estBad.map(f => f.label+(f.sub?'－'+f.sub:'')).join('、'));
  return {block, warn, est, pen, none};
}
const fl = f => esc(f.label + (f.sub ? '－'+f.sub : ''));
function exportHTML(){
  const v = cur(), c = exportChecks(v), s = school(v.schoolId);
  return `<h2>訪視檔（交接用）</h2>
  <div class="card stack"><div class="tiny muted">包含本次所有筆記、推動概況、追蹤、錄音參照與綜合建議，以及該校必要資料。檔案可在電腦匯入後續編。下載完成只代表已匯出，兩台裝置不會自動同步。</div>
    <div class="row"><button class="btn primary grow" id="expVisit">匯出訪視檔</button>${navigator.canShare?'<button class="btn" id="shareVisit">分享（AirDrop 等）</button>':''}</div></div>
  <h2>正式 Word 紀錄表</h2>
  <div class="card stack">
    ${c.block.length?`<div class="confirm"><b>需先處理才能匯出</b>${c.block.map(x=>`<div>・${esc(x)}</div>`).join('')}</div>`:''}
    ${c.warn.map(x=>`<div class="tiny" style="color:var(--warn)">・${esc(x)}</div>`).join('')}
    <div><b>估計值</b>（Word 中加「約」）：${c.est.length?c.est.map(fl).join('、'):'無'}</div>
    <div><b>待查</b>（Word 中顯示「待查」）：${c.pen.length?c.pen.map(fl).join('、'):'無'}</div>
    <div><b>未記錄</b>（Word 中留空）：${c.none.length?c.none.map(fl).join('、'):'無'}</div>
    <div class="tiny muted">檔名：${esc(docxName(v))}</div>
    <div class="row"><button class="btn" data-sheet2="overview">返回補填</button>
      <button class="btn primary grow" id="expDocx" ${c.block.length?'disabled':''}>依現況匯出 Word</button></div>
    <div id="docxOut"></div>
  </div>
  <h2>刪除這筆訪視</h2>
  <div class="card stack">${pendingConfirm==='delvisit' ? (() => { const n = S.notes.filter(x=>x.visitId===v.visitId).length, r = S.recordings.filter(x=>x.visitId===v.visitId).length, f = S.followUps.filter(x=>x.visitId===v.visitId).length;
    return `<div class="confirm"><b>確定刪除 ${esc(sName(s))} ${rocShort(v.date)} 這筆訪視？</b><div class="tiny">將一併刪除筆記 ${n} 筆、錄音參照 ${r} 段、本次提出的追蹤 ${f} 項與綜合建議；本次勾選完成的前次追蹤會恢復為未完成。刪除後無法復原。</div>
      ${needsExport(v)?'<div class="tiny" style="color:var(--danger)">這筆訪視有變更尚未匯出。</div>':''}<div class="row"><button class="btn" id="expVisit3">先匯出訪視檔</button><button class="btn danger" id="delVisitYes">刪除</button><button class="btn ghost" id="cancelConfirm">取消</button></div></div>`; })()
    : `<div class="tiny muted">用於誤建或試用的訪視。其他訪視與學校資料不受影響。</div><button class="btn danger" id="delVisitAsk">刪除這筆訪視…</button>`}</div>`;
}
function docxName(v){
  const s = school(v.schoolId), d = (v.date||'').replace(/-/g,'');
  const nm = (s ? (s.short || s.name) : '未歸校').replace(/[\\/:*?"<>|\s]/g,'');
  return `${nm}_${d}_第${v.visitNo??'N'}次_輔導紀錄.docx`;
}
function dateTimeText(v){
  const st = v.actualStart, en = v.actualEnd;
  if(!en) return `${roc(st)} ${hm(st)}`;
  if(ymd(st) === ymd(en)) return `${roc(st)} ${hm(st)}–${hm(en)}`;
  return `${roc(st)} ${hm(st)}–\n${roc(en)} ${hm(en)}`;
}
async function exportDocx(v){
  const s = school(v.schoolId), r = S.reports.find(x => x.visitId===v.visitId) || {};
  const rec = {city:s.city, schoolName:s.name, author:v.author, dateTimeText:dateTimeText(v), visitNo:v.visitNo,
    categories:v.categories, otherText:v.otherText, fields:v.fields,
    reportSections:SECTIONS.map(([k,t]) => ({title:t, text:r[k]||''}))};
  const buf = await (await fetch('template.docx', {cache:'no-cache'}).catch(() => fetch('template.docx'))).arrayBuffer();
  const blob = await DocxFill.fillTemplate(JSZip, buf, rec, {DOMParser, XMLSerializer, outputType:'blob'});
  download(blob, docxName(v));
}

/* ----- 學校 ----- */
function schoolHTML(sid){
  const s = school(sid); if(!s) return '<p>找不到學校。</p>';
  const vs = S.visits.filter(v => v.schoolId===sid).sort((a,b) => a.actualStart < b.actualStart ? 1 : -1);
  const fu = S.followUps.filter(f => f.schoolId===sid);
  return `<div class="card stack" style="margin-top:14px">
    <div class="grid2"><label class="kv"><span>縣市</span><input type="text" id="scCity" value="${esc(s.city)}"></label>
    <label class="kv"><span>簡稱</span><input type="text" id="scShort" value="${esc(s.short||'')}"></label></div>
    <label class="kv"><span>正式校名</span><input type="text" id="scName" value="${esc(s.name)}"></label>
    <label class="kv"><span>其他別稱（以頓號分隔，供日後行事曆比對）</span><input type="text" id="scAlias" value="${esc((s.aliases||[]).join('、'))}"></label>
    ${(s.nameHistory||[]).length?`<div class="tiny muted">更名歷程：${s.nameHistory.map(h=>`${esc(h.name)}（至 ${rocShort(ymd(h.until))}）`).join('；')}</div>`:''}
    <div class="tiny muted">更名不影響既有訪視；已匯出的歷史 Word 不會改變。</div>
    <div class="row">${s.archived?`<span class="tag">已封存</span><button class="btn" id="scUnarchive">取消封存</button>`:`<button class="btn" id="scArchive">封存學校</button>`}<span class="tiny muted grow">封存後首頁不再列出，歷史訪視與追蹤仍保留，可隨時取消封存。</span></div>
  </div>
  <h2>訪視歷程（${vs.length}）</h2>
  <div class="card">${vs.map(v => `<div class="list-item"><div class="grow"><b>${rocShort(v.date)}</b> 第 ${v.visitNo??'?'} 次 · ${esc(v.semester)}
    <div class="tiny muted">筆記 ${S.notes.filter(n=>n.visitId===v.visitId).length} 筆 · 概況 ${filledCount(v)}/${T2.length}${v.status==='active'?' · 進行中':''}</div></div>
    <button class="btn small" data-open="${v.visitId}">開啟</button></div>`).join('') || '<p class="muted" style="margin:0">尚無。</p>'}</div>
  <h2>追蹤事項</h2>
  <div class="card">${fu.map(f => { const fv = visit(f.visitId); return `<div class="list-item"><div class="grow" style="${f.status==='done'?'color:var(--muted);text-decoration:line-through':''}">${esc(f.text)}<div class="tiny muted">第 ${fv?.visitNo??'?'} 次提出${f.status==='done'?` · 於 ${f.doneAt?rocShort(ymd(f.doneAt)):''} 完成`:''}</div></div></div>`; }).join('') || '<p class="muted" style="margin:0">尚無。</p>'}</div>`;
}

/* ----- 刪除 ----- */
function demoSet(){ const sids = new Set(S.schools.filter(s => s.demo).map(s => s.schoolId)); const vids = new Set(S.visits.filter(v => v.demo || sids.has(v.schoolId)).map(v => v.visitId)); return {sids, vids}; }
function removeRecords(vids, sids){
  const gone = (store, pred) => { S[store].filter(pred).forEach(o => touch(store, o, true)); S[store] = S[store].filter(o => !pred(o)); };
  S.followUps.filter(f => vids.has(f.doneVisitId) && !vids.has(f.visitId)).forEach(f => { f.status = 'open'; f.doneAt = null; f.doneVisitId = null; touch('followUps', f); });
  gone('notes', n => vids.has(n.visitId)); gone('recordings', r => vids.has(r.visitId)); gone('reports', r => vids.has(r.visitId));
  gone('followUps', f => vids.has(f.visitId) || (sids && sids.has(f.schoolId))); gone('visits', v => vids.has(v.visitId));
  if(sids) gone('schools', s => sids.has(s.schoolId));
  vids.forEach(id => { delete drafts[id]; delete backupInfo.visits[id]; saveMeta('draft:'+id, undefined); });
  saveMeta('backup', backupInfo);
  return persist();
}

/* ----- 設定 ----- */
let pendingConfirm = null;
function settingsHTML(){
  return `<div class="card stack" style="margin-top:14px">
    <label class="kv"><span>預設填寫人</span><input type="text" id="sAuthor" value="${esc(settings.author)}"></label>
    <label class="kv"><span>學期</span><input type="text" id="sSem" value="${esc(settings.semester)}" placeholder="例：115-1"></label>
    <label class="inline"><input type="checkbox" id="sEnter" ${settings.enterSends?'checked':''}> 鍵盤 Enter 直接記下（中文選字時不受影響）</label>
  </div>
  <h2>離線使用與本機保存</h2><div class="card stack"><div id="offlineDetail">檢查中…</div><div id="persistDetail" class="tiny"></div></div>
  <h2>備份與還原</h2>
  <div class="card stack">
    <div class="tiny muted">全部備份含所有學校、訪視、筆記、追蹤、錄音參照與綜合建議；不含行事曆授權。還原時會先預覽差異，不會靜默覆寫。</div>
    <div class="row"><button class="btn grow" id="exportAll2">匯出全部備份</button><label class="btn grow" for="importFile">從檔案還原…</label></div>
  </div>
  <h2>測試用</h2>
  <div class="card stack">
    <label class="inline"><input type="checkbox" id="sFail" ${Store.simulateFail?'checked':''}> 模擬本機儲存失敗（重新整理後自動解除）</label>
    ${(() => { const d = demoSet(); if(!d.sids.size) return '<button class="btn" id="loadDemo">加入虛構示範學校</button>';
      return pendingConfirm==='demo' ? `<div class="confirm"><b>移除示範資料？</b><div class="tiny">將刪除 ${d.sids.size} 所示範學校，以及其下 ${d.vids.size} 筆訪視（含您在示範學校試用時建立的紀錄）。您自己建立的學校與訪視不受影響。</div><div class="row"><button class="btn danger" id="demoYes">移除</button><button class="btn ghost" id="cancelConfirm">取消</button></div></div>`
        : `<button class="btn" id="demoAsk">移除示範資料（${d.sids.size} 所學校）</button>`; })()}
    ${pendingConfirm==='reset'?`<div class="confirm"><b>確定清除本機所有紀錄？此動作無法復原，建議先匯出全部備份。</b><div class="row"><button class="btn danger" id="resetYes">清除</button><button class="btn ghost" id="resetNo">取消</button></div></div>`
      :`<button class="btn danger" id="resetAsk">清除本機所有紀錄</button>`}
  </div>
  <p class="footnote">版本 ${APP_VERSION} · 資料格式 v${SCHEMA}</p>`;
}

/* ======================= 匯出／匯入 ======================= */
function download(blob, name){
  const file = (typeof File === 'function') ? new File([blob], name, {type: blob.type}) : blob;
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  toast('已匯出：' + name);
}
function packVisit(v){
  const sids = new Set([v.schoolId].filter(Boolean));
  const fus = S.followUps.filter(f => f.visitId===v.visitId || f.doneVisitId===v.visitId || (v.schoolId && f.schoolId===v.schoolId && f.status==='open'));
  fus.forEach(f => f.schoolId && sids.add(f.schoolId));
  const vids = new Set([v.visitId, ...fus.map(f => f.visitId)]);
  const related = S.visits.filter(x => vids.has(x.visitId));
  return { schools:S.schools.filter(s => sids.has(s.schoolId)), visits:related,
    notes:S.notes.filter(n => vids.has(n.visitId)), followUps:fus,
    recordings:S.recordings.filter(r => vids.has(r.visitId)), reports:S.reports.filter(r => vids.has(r.visitId)) };
}
function makeFile(kind, data){
  return {format:FILE_FORMAT, schemaVersion:SCHEMA, appVersion:APP_VERSION, kind, exportedAt:now(), timezone:TZ,
    data:Object.fromEntries(Object.entries(data).map(([k,arr]) => [k, arr.map(x => JSON.parse(JSON.stringify(x)))]))};
}
const jsonBlob = o => new Blob([JSON.stringify(o, null, 1)], {type:'application/json'});
function visitFileName(v){ const s = school(v.schoolId); return `訪視檔_${(s?(s.short||s.name):'未歸校').replace(/[\\/:*?"<>|\s]/g,'')}_${v.date.replace(/-/g,'')}_${hm(now()).replace(':','')}.json`; }
function exportAll(){ download(jsonBlob(makeFile('backup', S)), `入校輔導_全部備份_${ymd(now()).replace(/-/g,'')}_${hm(now()).replace(':','')}.json`); markExported(null); }

let importPlan = null;
function validateFile(o){
  const errs = [];
  if(!o || typeof o!=='object' || o.format!==FILE_FORMAT) return ['這不是入校輔導紀錄的匯出檔'];
  if(typeof o.schemaVersion!=='number') return ['缺少資料格式版本'];
  if(o.schemaVersion > SCHEMA) return [`此檔由較新的版本產生（格式 v${o.schemaVersion}，本機為 v${SCHEMA}）。請先更新網頁再匯入。`];
  const d = o.data || {};
  for(const k of Object.keys(KEYF)){ if(d[k]!==undefined && !Array.isArray(d[k])) errs.push(`${k} 格式錯誤`); d[k] = d[k] || []; }
  const isDate = s => typeof s==='string' && !isNaN(Date.parse(s));
  const sids = new Set([...S.schools, ...d.schools].map(s => s.schoolId));
  const vids = new Set([...S.visits, ...d.visits].map(v => v.visitId));
  d.schools.forEach((s,i) => { if(typeof s.schoolId!=='string' || !s.name) errs.push(`第 ${i+1} 筆學校缺少識別或校名`); });
  d.visits.forEach((v,i) => {
    if(typeof v.visitId!=='string') errs.push(`第 ${i+1} 筆訪視缺少識別`);
    if(!isDate(v.actualStart) || (v.actualEnd && !isDate(v.actualEnd))) errs.push(`訪視 ${v.date||i+1} 的時間格式錯誤`);
    if(v.schoolId && !sids.has(v.schoolId)) errs.push(`訪視 ${v.date||i+1} 參照的學校不存在`);
    if(!v.fields || typeof v.fields!=='object') errs.push(`訪視 ${v.date||i+1} 缺少概況欄位`);
  });
  [['notes','noteId','筆記'],['followUps','id','追蹤'],['recordings','recordingId','錄音參照'],['reports','visitId','綜合建議']].forEach(([k,id,nm]) =>
    d[k].forEach((x,i) => { if(typeof x[id]!=='string' || !vids.has(x.visitId)) errs.push(`第 ${i+1} 筆${nm}的關聯訪視不存在`); }));
  d.notes.forEach((n,i) => { if(!isDate(n.createdAt)) errs.push(`第 ${i+1} 筆筆記的時間格式錯誤`); });
  d.recordings.forEach((r,i) => { if(!isDate(r.start)) errs.push(`第 ${i+1} 筆錄音的起始時間錯誤`); });
  return errs;
}
function planImport(o, fileName){
  const rows = [];
  for(const [store, key] of Object.entries(KEYF)){
    for(const rec of o.data[store]){
      const local = S[store].find(x => x[key]===rec[key]);
      rows.push({store, key:rec[key], rec, local, kind: !local ? 'new' : same(local, rec) ? 'same' : 'conflict', choice:'local'});
    }
  }
  importPlan = {fileName, kind:o.kind, exportedAt:o.exportedAt, rows};
}
const STORE_NM = {schools:'學校',visits:'訪視',notes:'筆記',followUps:'追蹤',recordings:'錄音參照',reports:'綜合建議'};
function describe(row){
  const r = row.rec;
  if(row.store==='schools') return esc(r.name);
  if(row.store==='visits') return `${esc(sName(school(r.schoolId)) )} ${r.date?rocShort(r.date):''} 第 ${r.visitNo??'?'} 次`;
  if(row.store==='notes') return `${hm(r.createdAt)} ${esc((r.text||'（時間標記）').slice(0,40))}`;
  if(row.store==='followUps') return esc(r.text);
  if(row.store==='recordings') return `${esc(r.label)} ${hm(r.start)}`;
  if(row.store==='reports') return '綜合建議內容';
  return '';
}
function importHTML(){
  const p = importPlan; if(!p) return '';
  const c = k => p.rows.filter(r => r.kind===k);
  const conf = c('conflict');
  return `<div class="card stack" style="margin-top:14px">
    <div><b>${esc(p.fileName)}</b><div class="tiny muted">${p.kind==='backup'?'全部備份':'訪視檔'} · 匯出於 ${roc(p.exportedAt)} ${hm(p.exportedAt)}</div></div>
    <div>新增 <b>${c('new').length}</b> 筆 · 相同略過 <b>${c('same').length}</b> 筆 · 衝突 <b style="color:${conf.length?'var(--danger)':'inherit'}">${conf.length}</b> 筆</div>
    ${c('new').length?`<details><summary>新增項目</summary><div class="tiny">${c('new').map(r=>`<div>${STORE_NM[r.store]}：${describe(r)}</div>`).join('')}</div></details>`:''}
  </div>
  ${conf.length?`<h2>衝突：同一筆資料兩邊內容不同</h2>
   <div class="card stack"><div class="tiny">請逐筆選擇。建議先匯出本機副本再決定。</div><button class="btn" id="exportAll3">先匯出本機副本</button>
   <div class="scrollx"><table class="imp-table"><thead><tr><th>項目</th><th>本機修改</th><th>匯入檔修改</th><th>採用</th></tr></thead><tbody>
   ${conf.map((r,i)=>`<tr><td>${STORE_NM[r.store]}：${describe(r)}</td><td class="tiny">${r.local.updatedAt?roc(r.local.updatedAt)+' '+hm(r.local.updatedAt):'—'}</td><td class="tiny">${r.rec.updatedAt?roc(r.rec.updatedAt)+' '+hm(r.rec.updatedAt):'—'}</td>
     <td><label class="inline"><input type="radio" name="cf${i}" data-cf="${i}" value="local" ${r.choice==='local'?'checked':''}>保留本機</label><label class="inline"><input type="radio" name="cf${i}" data-cf="${i}" value="import" ${r.choice==='import'?'checked':''}>採用匯入</label></td></tr>`).join('')}
   </tbody></table></div></div>`:''}
  <div class="row" style="margin-top:14px"><button class="btn ghost" id="impCancel">取消</button>
   <button class="btn primary grow" id="impGo" ${c('new').length||conf.length?'':'disabled'}>${c('new').length||conf.length?'確認匯入':'內容與本機完全相同，無須匯入'}</button></div>`;
}
async function applyImport(){
  const conf = importPlan.rows.filter(r => r.kind==='conflict');
  const items = importPlan.rows.filter(r => r.kind==='new' || (r.kind==='conflict' && r.choice==='import'))
    .map(r => ({store:r.store, obj:{...strip(r.rec), rev:(r.local?.rev||0)+1}}));
  if(!items.length){ toast('沒有需要寫入的項目'); closeSheet(); return; }
  try{
    await Store.importBatch(items);
    await reloadAll();
    toast(`已匯入 ${items.length} 筆` + (conf.length?`（衝突 ${conf.length} 筆已依選擇處理）`:''));
    importPlan = null; closeSheet();
    bc && bc.postMessage({type:'changed'});
  }catch(e){
    showBanner('匯入失敗，本機資料未變更：' + (e.message||e), 'danger');
  }
}
async function handleImportFile(file){
  let o;
  try{ o = JSON.parse(await file.text()); }catch(e){ showBanner('無法讀取：檔案內容不是有效的 JSON，可能已損毀。本機資料未變更。','danger'); return; }
  const errs = validateFile(o);
  if(errs.length){ showBanner('無法匯入：' + errs.slice(0,3).join('；') + (errs.length>3?` 等 ${errs.length} 項`:'') + '。本機資料未變更。','danger'); return; }
  planImport(o, file.name); openSheet('import');
}

/* ======================= 事件 ======================= */
document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-cat],[data-fudone]'); if(!t) return;
  const d = t.dataset, v = cur(), id = t.id;
  if(d.start!==undefined) return startVisit(d.start);
  if(d.open){ if(sheetKind) { $('sheet').hidden = true; sheetKind = null; } return openVisit(d.open); }
  if(d.school) return openSheet('school', {schoolId:d.school});
  if(d.sheet) return openSheet(d.sheet, {top:true});
  if(d.sheet2){ sheetKind = d.sheet2; $('sheetTitle').textContent = TITLES[d.sheet2]; return renderSheet({top:true}); }
  if(d.edit){ if(sheetKind!=='timeline') openSheet('timeline',{edit:d.edit}); else renderSheet({edit:d.edit}); return; }
  if(d.editsave){ const n = S.notes.find(x => x.noteId===d.editsave), val = $('edit-'+d.editsave).value.trim(); if(n && val!==n.text){ n.text = val; touch('notes', n); await persist(); } renderSheet({}); return; }
  if(d.editcancel) return renderSheet({});
  if(d.pickrec){ const n = S.notes.find(x => x.noteId===d.pickrec); const keepU = n.updatedAt; n.recordingId = d.rec; touch('notes', n); n.updatedAt = keepU; await persist(); sheetKind ? renderSheet({}) : renderVisit(); return; }
  if(d.fu){ const n = S.notes.find(x => x.noteId===d.fu); const f = {id:uid(),visitId:v.visitId,schoolId:v.schoolId,noteId:n.noteId,text:n.text||`時間標記 ${hm(n.createdAt)} 待補說明`,status:'open',doneAt:null,doneVisitId:null,createdAt:now()};
    S.followUps.push(f); touch('followUps', f); await persist(); toast('已加入下次追蹤'); sheetKind ? renderSheet({}) : renderVisit(); return; }
  if(d.gonote){ if(d.govisit!==ui.visitId){ $('sheet').hidden = true; sheetKind = null; openVisit(d.govisit); } openSheet('timeline'); const el = $('note-'+d.gonote); if(el){ el.scrollIntoView({block:'center'}); el.classList.add('flash'); } return; }
  if(d.tile){ kp.code = d.tile; kp.fresh = true; refreshQuick(); if(FMAP[d.tile].type==='text'){ const t2 = $('fv-'+d.tile); t2 && t2.focus(); } return; }
  if(d.kp){ keypadPress(d.kp, d.d); return; }
  if(d.ovmode){ settings.overviewMode = d.ovmode; saveMeta('settings', settings); renderSheet({}); return; }
  if(d.st){ const fv = v.fields[d.st]; if(fv.status===d.val){ fv.status = fv.value!=null ? 'confirmed' : 'none'; } else { fv.status = d.val; if(d.val==='pending') fv.value = null; } touch('visits', v); persist(); rerow(d.st); return; }
  if(d.ask){ v.ask[d.ask] = !v.ask[d.ask]; if(!v.ask[d.ask]) delete v.ask[d.ask]; touch('visits', v); persist(); rerow(d.ask); return; }
  if(d.carry){ const pv = prevVisit(v), pf = pv.fields[d.carry]; v.fields[d.carry] = {value:pf.value,status:pf.status==='estimate'?'estimate':'confirmed',source:pf.source,carriedFrom:pv.visitId,confirmedAt:now(),confirmedDate:ymd(now())}; touch('visits', v); persist(); rerow(d.carry); toast('已沿用，可再修改'); return; }
  if(d.unask){ delete v.ask[d.unask]; touch('visits', v); persist(); renderSheet({}); return; }
  if(d.askadd){ v.ask[d.askadd] = true; touch('visits', v); persist(); renderSheet({}); return; }
  if(d.fudel){ const f = S.followUps.find(x => x.id===d.fudel); S.followUps = S.followUps.filter(x => x !== f); touch('followUps', f, true); persist(); renderSheet({}); return; }
  if(d.recdel){ const r = S.recordings.find(x => x.recordingId===d.recdel); S.recordings = S.recordings.filter(x => x !== r); S.notes.filter(n => n.recordingId===r.recordingId).forEach(n => { n.recordingId = null; touch('notes', n); }); touch('recordings', r, true); persist(); renderSheet({}); return; }
  if(d.pick){ const n = S.notes.find(x => x.noteId===d.pick), r = reportOf(v.visitId); r[d.sec] = (r[d.sec] ? r[d.sec].replace(/\s+$/,'') + '\n' : '') + '・' + n.text; touch('reports', r); persist(); const ta2 = $('rp-'+d.sec); if(ta2){ ta2.value = r[d.sec]; } toast('已帶入，可再編修'); return; }
  if(d.fupick){ const f = S.followUps.find(x => x.id===d.fupick), r = reportOf(v.visitId); r.future = (r.future ? r.future.replace(/\s+$/,'') + '\n' : '') + '・' + f.text; touch('reports', r); persist(); $('rp-future').value = r.future; toast('已帶入第四段'); return; }

  switch(id){
    case 'copyList':{
      const txt = clipText(v); let ok = false;
      try{ await Promise.race([navigator.clipboard.writeText(txt), new Promise((_,rej) => setTimeout(() => rej(new Error('timeout')), 1500))]); ok = true; }catch(err){}
      $('copyOut').innerHTML = `<p class="tiny ${ok?'':'muted'}" style="margin:10px 0 6px">${ok?'已複製，可直接貼到 LINE 或郵件。':'此處無法直接複製，請長按下方文字選取後拷貝。'}</p><pre class="copy" id="copyPre">${esc(txt)}</pre>`;
      if(!ok){ const r = document.createRange(); r.selectNodeContents($('copyPre')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      if(ok) toast('待補清單已複製'); break; }
    case 'fuAdd':{ const i = $('fuNew'), s = i.value.trim(); if(!s) return; const f = {id:uid(),visitId:v.visitId,schoolId:v.schoolId,noteId:null,text:s,status:'open',doneAt:null,doneVisitId:null,createdAt:now()}; S.followUps.push(f); touch('followUps', f); await persist(); renderSheet({}); break; }
    case 'askAll': FIELDS.forEach(f => { const fv = v.fields[f.code]; if(fv.status==='none' || fv.status==='pending') v.ask[f.code] = true; }); touch('visits', v); persist(); renderSheet({}); break;
    case 'endVisit': v.actualEnd = now(); v.status = 'ended'; touch('visits', v); await persist(); toast(`已結束 ${hm(v.actualEnd)}`); renderSheet({}); break;
    case 'reopen': v.status = 'active'; v.actualEnd = null; touch('visits', v); await persist(); renderSheet({}); break;
    case 'openSettings': openSheet('settings', {top:true}); break;
    case 'quickNote': startVisit(null); break;
    case 'addSchoolBtn': $('addSchoolForm').hidden = false; $('nsCity').focus(); break;
    case 'nsCancel': $('addSchoolForm').hidden = true; break;
    case 'nsSave':{ const name = $('nsName').value.trim(), city = $('nsCity').value.trim(); if(!name || !city){ toast('請填縣市與正式校名'); return; }
      const s = {schoolId:uid(),city,name,short:$('nsShort').value.trim(),aliases:[],nameHistory:[],createdAt:now()}; S.schools.push(s); touch('schools', s); await persist();
      ['nsCity','nsName','nsShort'].forEach(k => $(k).value = ''); $('addSchoolForm').hidden = true; renderHome(); break; }
    case 'recNow': case 'recAdd':{
      const r = {recordingId:uid(),visitId:v.visitId,label:'',desc:'',start:now(),end:null,createdAt:now()};
      if(id==='recAdd'){ const st = $('recStart').value; if(!st){ toast('請填起始時間'); return; } r.start = new Date(`${v.date}T${st.length===5?st+':00':st}+08:00`).toISOString(); }
      r.label = (id==='recAdd' && $('recLabel').value.trim()) || `錄音 ${recsOf(v.visitId).length+1}`;
      S.recordings.push(r); touch('recordings', r); await persist(); toast(id==='recNow'?`已記下錄音起點 ${hms(r.start)}`:'已新增錄音參照'); renderSheet({}); break; }
    case 'expVisit': case 'expVisit2': case 'expVisit3': download(jsonBlob(makeFile('visit', packVisit(v))), visitFileName(v)); await markExported(v.visitId); if(id!=='expVisit') renderSheet({}); break;
    case 'delVisitAsk': pendingConfirm = 'delvisit'; renderSheet({}); break;
    case 'delVisitYes':{ pendingConfirm = null; const ok = await removeRecords(new Set([v.visitId])); if(!ok){ toast('刪除失敗，資料未變更'); break; } $('sheet').hidden = true; sheetKind = null; goHome(); toast('已刪除這筆訪視'); break; }
    case 'cancelConfirm': pendingConfirm = null; renderSheet({}); break;
    case 'demoAsk': pendingConfirm = 'demo'; renderSheet({}); break;
    case 'demoYes':{ pendingConfirm = null; const d = demoSet(); if(ui.visitId && d.vids.has(ui.visitId)){ ui = {view:'home',visitId:null,sel:null}; saveMeta('ui', ui); $('visit').hidden = true; } await removeRecords(d.vids, d.sids); renderSheet({}); renderHome(); toast('已移除示範資料'); break; }
    case 'scArchive': case 'scUnarchive':{ const sc = school(sheetCtx.schoolId); sc.archived = id==='scArchive'; touch('schools', sc); await persist(); renderSheet({}); toast(sc.archived?'已封存':'已取消封存'); break; }
    case 'shareVisit':{ const f = new File([jsonBlob(makeFile('visit', packVisit(v)))], visitFileName(v), {type:'application/json'});
      try{ if(navigator.canShare({files:[f]})){ await navigator.share({files:[f], title:'入校輔導訪視檔'}); await markExported(v.visitId); } else toast('此裝置無法分享檔案，請改用匯出'); }catch(err){} break; }
    case 'expDocx':{
      t.disabled = true; $('docxOut').innerHTML = '<p class="tiny muted">產生中…</p>';
      try{ await exportDocx(v); $('docxOut').innerHTML = `<p class="tiny" style="color:var(--ok)">已匯出 ${esc(docxName(v))}。</p>`; }
      catch(err){ $('docxOut').innerHTML = `<div class="confirm"><b>未產生 Word</b><div>${esc(err instanceof DocxFill.TemplateError ? '樣板版本不符：' + err.message + '。請確認 template.docx 為《115-DEMO-D01》原表。' : (err.message || String(err)))}</div></div>`; }
      t.disabled = false; break; }
    case 'exportAll': case 'exportAll2': case 'exportAll3': case 'bnExport': exportAll(); break;
    case 'bnReload': location.reload(); break;
    case 'bnClose': $('banner').hidden = true; break;
    case 'impCancel': importPlan = null; closeSheet(); break;
    case 'impGo': t.disabled = true; await applyImport(); break;
    case 'loadDemo': await addDemo(); renderSheet({}); toast('已加入示範學校'); break;
    case 'resetAsk': pendingConfirm = 'reset'; renderSheet({}); break;
    case 'resetNo': pendingConfirm = null; renderSheet({}); break;
    case 'resetYes': pendingConfirm = null; try{ await Store.clearAll(); }catch(err){ showBanner('清除失敗：'+err.message,'danger'); break; } await reloadAll(); closeSheet(); goHome(); toast('已清除'); break;
  }
});
document.addEventListener('change', async e => {
  const t = e.target, d = t.dataset, v = cur();
  if(t.id==='importFile' || t.id==='recFile'){
    const f = t.files && t.files[0]; t.value = '';
    if(!f) return;
    if(t.id==='importFile') return handleImportFile(f);
    $('recLabel').value = f.name; return;
  }
  if(d.cf!==undefined){ importPlan.rows.filter(r => r.kind==='conflict')[+d.cf].choice = t.value; return; }
  if(d.fudone){ const f = S.followUps.find(x => x.id===d.fudone); if(t.checked){ f.status = 'done'; f.doneAt = now(); f.doneVisitId = v.visitId; } else { f.status = 'open'; f.doneAt = null; f.doneVisitId = null; } touch('followUps', f); await persist(); renderSheet({}); return; }
  if(d.cat){ const c = +d.cat; v.categories = t.checked ? [...new Set([...v.categories, c])].sort() : v.categories.filter(x => x!==c); touch('visits', v); persist(); renderSheet({}); return; }
  if(d.src){ v.fields[d.src].source = t.value; touch('visits', v); persist(); return; }
  if(d.recf){
    const r = S.recordings.find(x => x.recordingId===d.recid);
    if(d.recf==='start' && t.value) r.start = new Date(`${ymd(r.start)}T${t.value.length===5?t.value+':00':t.value}+08:00`).toISOString();
    else if(d.recf==='end') r.end = t.value ? new Date(`${ymd(r.start)}T${t.value.length===5?t.value+':00':t.value}+08:00`).toISOString() : null;
    else if(d.recf==='label' || d.recf==='desc') r[d.recf] = t.value.trim();
    touch('recordings', r); persist(); return;
  }
  const sc = sheetCtx.schoolId && school(sheetCtx.schoolId);
  switch(t.id){
    case 'bSchool':{ const sid = t.value || null; v.schoolId = sid; S.followUps.filter(f => f.visitId===v.visitId).forEach(f => { f.schoolId = sid; touch('followUps', f); });
      if(!v.visitNoManual) v.visitNo = sid ? suggestNo(sid, v.semester, v.visitId) : null; touch('visits', v); persist(); renderSheet({}); break; }
    case 'bDate':{ if(!t.value) break; const st = hm(v.actualStart), en = v.actualEnd && hm(v.actualEnd), cross = v.actualEnd && ymd(v.actualEnd)!==v.date;
      const old = v.date; v.date = t.value; v.actualStart = fromTaipei(t.value, st);
      if(en){ const off = cross ? Math.round((Date.parse(ymd(v.actualEnd)) - Date.parse(old))/864e5) : 0; const nd = new Date(Date.parse(t.value) + off*864e5).toISOString().slice(0,10); v.actualEnd = fromTaipei(nd, en); }
      touch('visits', v); persist(); renderSheet({}); break; }
    case 'bStart': if(t.value){ v.actualStart = fromTaipei(v.date, t.value); touch('visits', v); persist(); } break;
    case 'bEnd': if(t.value){ let e2 = fromTaipei(v.date, t.value); if(e2 < v.actualStart){ e2 = new Date(new Date(e2).getTime() + 864e5).toISOString(); } v.actualEnd = e2; v.status = 'ended'; } else { v.actualEnd = null; v.status = 'active'; } touch('visits', v); persist(); renderSheet({}); break;
    case 'bNo':{ const n = parseInt(t.value.replace(/\D/g,''),10); v.visitNo = isNaN(n) ? null : n; v.visitNoManual = true; touch('visits', v); persist(); renderSheet({}); break; }
    case 'bSem': if(t.value.trim()){ v.semester = t.value.trim(); touch('visits', v); persist(); } break;
    case 'bAuthor': v.author = t.value.trim(); touch('visits', v); persist(); break;
    case 'bOther': v.otherText = t.value.trim(); touch('visits', v); persist(); break;
    case 'recConsent': v.recordingConsentNoted = t.checked; touch('visits', v); persist(); break;
    case 'sAuthor': settings.author = t.value.trim(); saveMeta('settings', settings); if(!sheetKind) renderHome(); break;
    case 'sSem': settings.semester = t.value.trim() || settings.semester; saveMeta('settings', settings); break;
    case 'sEnter': settings.enterSends = t.checked; saveMeta('settings', settings); break;
    case 'sFail': Store.simulateFail = t.checked; if(!t.checked){ saveState = 'ok'; renderSave(); persist(); } break;
    case 'scCity': if(t.value.trim()){ sc.city = t.value.trim(); touch('schools', sc); persist(); } break;
    case 'scShort': sc.short = t.value.trim(); touch('schools', sc); persist(); break;
    case 'scName': if(t.value.trim() && t.value.trim()!==sc.name){ (sc.nameHistory = sc.nameHistory || []).push({name:sc.name, until:now()}); sc.name = t.value.trim(); touch('schools', sc); persist(); renderSheet({}); } break;
    case 'scAlias': sc.aliases = t.value.split(/[、,，]/).map(x => x.trim()).filter(Boolean); touch('schools', sc); persist(); break;
  }
});
let rpTimer = null;
document.addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if(d.fv){ const clean = setVal(d.fv, t.value); if(clean!==undefined && clean!==t.value) t.value = clean; persist();
    const tile = document.querySelector(`[data-tile="${d.fv}"]`); if(tile){ const x = document.createElement('div'); x.innerHTML = tileHTML(d.fv, cur()); tile.replaceWith(x.firstElementChild); }
    const row = $('row-'+d.fv), tag = row && row.querySelector('.tag'), fv = cur().fields[d.fv];
    if(tag){ tag.textContent = STATUS[fv.status]; tag.className = 'tag '+(fv.status==='confirmed'?'ok':fv.status==='estimate'?'acc':fv.status==='pending'?'warn':''); }
    if(row){ row.querySelectorAll('[data-st]').forEach(c => c.setAttribute('aria-pressed', String(fv.status===c.dataset.val)));
      const sel = row.querySelector('.src'); if(sel) sel.hidden = fv.value==null; const w = row.querySelector('.est-warn'); if(w) w.hidden = !(fv.status==='estimate' && fv.value==null);
      row.querySelectorAll('.carry').forEach(x => x.remove()); }
    return; }
  if(d.rp){ const r = reportOf(cur().visitId); r[d.rp] = t.value; touch('reports', r); clearTimeout(rpTimer); rpTimer = setTimeout(persist, 500); }
});
document.addEventListener('keydown', e => { if(e.key==='Enter' && e.target.dataset && e.target.dataset.fv && e.target.tagName==='INPUT' && !e.isComposing && e.keyCode!==229){ e.preventDefault(); e.target.blur(); } });

let toastT; function toast(m){ const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

/* ======================= 示範資料 ======================= */
async function addDemo(){
  // 固定識別碼：重複加入示範資料不會產生第二份
  const sA = 'demo-school-a', sB = 'demo-school-b', sC = 'demo-school-c', prevV = 'demo-visit-a2', prevN = 'demo-note-a2', t0 = '2026-10-06T05:40:00.000Z';
  if(S.schools.some(x => x.schoolId===sA)) return;
  const fields = blankFields();
  Object.assign(fields, {teacherTotal:{value:48,status:'estimate',source:'校方口述'},leads:{value:'王○○ 教務主任\n陳○○ 資訊組長',status:'confirmed',source:'校方口述'},
    platformTeachers:{value:20,status:'confirmed',source:'校方提供資料'},semesterSharingEvents:{value:1,status:'confirmed',source:'校方口述'}});
  const add = (store, o) => { S[store].push(o); touch(store, o); o.updatedAt = o.createdAt || t0; o.createdAt = o.createdAt || t0; };
  add('schools', {schoolId:sA,city:'高雄市',name:'高雄市立示範甲國民小學',short:'甲國小',aliases:['示範甲國小'],nameHistory:[],demo:true});
  add('schools', {schoolId:sB,city:'屏東縣',name:'屏東縣立示範乙國民中學',short:'乙國中',aliases:[],nameHistory:[],demo:true});
  add('schools', {schoolId:sC,city:'臺南市',name:'臺南市立示範丙國民小學',short:'丙國小',aliases:[],nameHistory:[],demo:true});
  add('visits', {visitId:prevV,schoolId:sA,semester:'115-1',visitNo:2,visitNoManual:true,author:settings.author||'林○○',date:'2026-10-06',plannedStart:null,plannedEnd:null,sourceEvent:null,
    actualStart:t0,actualEnd:'2026-10-06T07:30:00.000Z',createdAt:t0,status:'ended',categories:[1,3],otherText:'',fields,ask:{},templateVersion:DocxFill.TEMPLATE_ID,demo:true});
  add('notes', {noteId:prevN,visitId:prevV,kind:'note',text:'資訊組長提到平臺帳號尚未全面開通，下次確認開通進度。',createdAt:'2026-10-06T06:15:00.000Z',recordingId:null});
  add('followUps', {id:'demo-fu-a2',visitId:prevV,schoolId:sA,noteId:prevN,text:'確認學生平臺帳號開通進度',status:'open',doneAt:null,doneVisitId:null,createdAt:'2026-10-06T06:15:00.000Z'});
  await persist();
}

/* ======================= 離線與更新 ======================= */
let swReg = null;
async function refreshOfflineState(){
  const set = html => { const a = $('offlineState'), b = $('offlineDetail'); if(a) a.innerHTML = html; if(b) b.innerHTML = html; };
  if(!('serviceWorker' in navigator)){ set('此瀏覽器不支援離線快取，請連線使用。'); return; }
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    if(!reg || !navigator.serviceWorker.controller){ set('正在準備離線使用；首次開啟後請重新整理一次。'); return; }
    const st = await new Promise((res, rej) => { const ch = new MessageChannel(); ch.port1.onmessage = ev => res(ev.data); navigator.serviceWorker.controller.postMessage({type:'status'}, [ch.port2]); setTimeout(() => rej(new Error('timeout')), 3000); });
    set(st.missing.length ? `離線快取不完整（缺 ${st.missing.length} 個檔案），請連線後重新整理。` : `<b style="color:var(--ok)">已可離線使用</b>（介面版本 ${esc(st.version)}）`);
  }catch(e){ set('無法確認離線狀態，請連線後重新整理。'); }
}
function watchUpdates(reg){
  const prompt = w => { showBanner('新版本已就緒。更新不會清除紀錄或草稿。',''); const b = $('banner'); const btn = document.createElement('button'); btn.className = 'btn small primary'; btn.textContent = '立即更新'; btn.onclick = () => { flushDraft(); w.postMessage({type:'skipWaiting'}); }; b.insertBefore(btn, b.lastChild); };
  if(reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
  reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if(w.state==='installed' && navigator.serviceWorker.controller) prompt(w); if(w.state==='activated') refreshOfflineState(); }); });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if(reloading) return; reloading = true; if(document.querySelector('#sheet:not([hidden])') ) { refreshOfflineState(); return; } location.reload(); });
}

/* ======================= 啟動 ======================= */
async function reloadAll(){
  const all = await Store.loadAll();
  for(const k of Object.keys(KEYF)) S[k] = all[k] || [];
  const meta = Object.fromEntries((all.meta||[]).map(m => [m.key, m.value]));
  settings = Object.assign({author:'',semester:'115-1',enterSends:true}, meta.settings||{});
  ui = Object.assign({view:'home',visitId:null,sel:null}, meta.ui||{});
  backupInfo = Object.assign({all:null, visits:{}}, meta.backup||{});
  drafts = {}; Object.entries(meta).forEach(([k,val]) => { if(k.startsWith('draft:')) drafts[k.slice(6)] = val; });
  return meta;
}
try{
  await Store.open();
  const meta = await reloadAll();
  if(!meta.initialized){ await addDemo(); await saveMeta('initialized', true); }
  lastSaved = now();
}catch(e){
  saveState = 'fail';
  showBanner('無法開啟本機資料庫：' + (e.message||e) + '。若為私密瀏覽模式，請改用一般模式開啟。','danger');
}
renderSave();
if(ui.view==='visit' && cur()){
  openVisit(ui.visitId);
  if(ta.value){ const s = ui.sel || [ta.value.length, ta.value.length]; try{ ta.setSelectionRange(s[0], s[1]); }catch(e){} toast('已還原未送出的文字'); }
} else { $('home').hidden = false; renderHome(); }

/* 申請持續保存：由瀏覽器依其規則決定是否給予 */
let persistState = null;
async function checkPersist(ask){
  try{
    if(!navigator.storage || !navigator.storage.persisted){ persistState = 'unsupported'; return; }
    let p = await navigator.storage.persisted();
    if(!p && ask && navigator.storage.persist) p = await navigator.storage.persist();
    persistState = p ? 'yes' : 'no';
  }catch(e){ persistState = 'unsupported'; }
}
function renderPersist(){ const el = $('persistDetail'); if(!el) return; const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  el.innerHTML = persistState==='yes' ? '<b style="color:var(--ok)">已取得持續保存</b>：系統不會因空間不足或久未使用而自動清除，但刪除主畫面圖示或清除網站資料仍會刪除紀錄。'
    : persistState==='no' ? `<b style="color:var(--warn)">尚未取得持續保存</b>（由系統決定）。${standalone?'':'從主畫面圖示開啟較可能取得。'}請定期匯出備份。`
    : '此瀏覽器無法確認持續保存狀態，請定期匯出備份。'; }
checkPersist(true).then(renderPersist);

if('serviceWorker' in navigator && location.protocol !== 'file:'){
  navigator.serviceWorker.register('sw.js').then(reg => { swReg = reg; watchUpdates(reg); refreshOfflineState(); }).catch(() => refreshOfflineState());
} else refreshOfflineState();
window.__app = {S, Store, packVisit, makeFile, validateFile, recOffset, exportChecks, docxName};
})();
