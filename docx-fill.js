/* 入校輔導紀錄｜Word 套表模組
 * 以原表的表格標籤與儲存格位置定位，替換作答儲存格的段落文字；
 * 保留 tcPr（框線、寬度、合併）、pPr 與字型設定，不重建表格。
 * 瀏覽器與 Node 共用：fillTemplate(JSZip, arrayBuffer, rec, {DOMParser, XMLSerializer})
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DocxFill = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const BLANK = '　　　';
  const SP = '　';
  const TEMPLATE_ID = '115-DEMO-D01';

  class TemplateError extends Error {}

  /* ---------- 數值片語 ---------- */
  // 未記錄 → 保留空白與單位；待查 → 整個片語「待查」；估計 → 加「約」（hasYue 時不重複）
  function slot(fv, unit, opt = {}) {
    const st = fv ? fv.status : 'none';
    if (st === 'pending') return `${SP}待查${SP}`;
    if (fv && fv.value != null && (st === 'confirmed' || st === 'estimate')) {
      const yue = st === 'estimate' && !opt.hasYue ? '約' : '';
      return `${SP}${yue}${fv.value}${SP}${unit}`;
    }
    return (opt.blank || BLANK) + unit;
  }

  /* ---------- DOM 工具 ---------- */
  const kids = (el, name) => Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.nodeName === name);
  const all = (el, name) => Array.from(el.getElementsByTagName(name));
  const text = el => all(el, 'w:t').map(t => t.textContent).join('');

  function makePara(doc, protoP, line, o = {}) {
    const p = doc.createElementNS(W, 'w:p');
    const pPr = kids(protoP, 'w:pPr')[0];
    if (pPr) p.appendChild(pPr.cloneNode(true));
    const r = doc.createElementNS(W, 'w:r');
    const protoR = kids(protoP, 'w:r')[0];
    let rPr = protoR && kids(protoR, 'w:rPr')[0];
    rPr = rPr ? rPr.cloneNode(true) : (pPr && kids(pPr, 'w:rPr')[0] ? kids(pPr, 'w:rPr')[0].cloneNode(true) : doc.createElementNS(W, 'w:rPr'));
    // 統一黑色、移除底線；標題加粗
    kids(rPr, 'w:color').forEach(n => rPr.removeChild(n));
    kids(rPr, 'w:u').forEach(n => rPr.removeChild(n));
    if (o.bold) {
      if (!kids(rPr, 'w:b').length) rPr.appendChild(doc.createElementNS(W, 'w:b'));
      if (!kids(rPr, 'w:bCs').length) rPr.appendChild(doc.createElementNS(W, 'w:bCs'));
    } else {
      kids(rPr, 'w:b').concat(kids(rPr, 'w:bCs')).forEach(n => rPr.removeChild(n));
    }
    const c = doc.createElementNS(W, 'w:color'); c.setAttributeNS(W, 'w:val', '000000'); rPr.appendChild(c);
    r.appendChild(rPr);
    const t = doc.createElementNS(W, 'w:t');
    t.setAttribute('xml:space', 'preserve');
    t.appendChild(doc.createTextNode(line));
    r.appendChild(t);
    p.appendChild(r);
    return p;
  }

  // 以多段文字取代儲存格內容（保留第一段格式作原型）
  function setCell(doc, tc, lines) {
    const ps = kids(tc, 'w:p');
    const proto = ps[0];
    const fresh = lines.map(l => makePara(doc, proto, l));
    ps.forEach(p => tc.removeChild(p));
    fresh.forEach(p => tc.appendChild(p));
  }

  function rowsOf(tbl) { return kids(tbl, 'w:tr'); }
  function cellsOf(tr) { return kids(tr, 'w:tc'); }

  /* ---------- 樣板版本檢核 ---------- */
  const EXPECT0 = ['縣市', '校名', '填寫人', '輔導日期/時間', '學校參與人數', '為本校第幾次輔導'];
  const EXPECT1 = ['1. 全校教師總數', '2. 數位學習推動計畫主導人員', '3. 四學教學模式實施班級數', '4. 以四學模式進行教學之教師數',
    '5. 參加過數位教學進階研習的教師數', '6. 教學中使用數位學習平臺之教師數', '7. 將AI融入教學中之教師數', '8. 校內數位教學相關社群數',
    '9. 本學期辦理校內外數位教學分享／推廣', '10. 本學期參與校外數位教學活動之教師數'];

  function checkTemplate(tbls) {
    if (tbls.length !== 3) throw new TemplateError(`樣板應有 3 張表，實際為 ${tbls.length} 張`);
    const t0 = rowsOf(tbls[0]);
    const labels0 = t0.slice(0, 3).flatMap(tr => { const c = cellsOf(tr); return [text(c[0]), text(c[2])]; });
    EXPECT0.forEach((l, i) => { if ((labels0[i] || '').replace(/\s/g, '') !== l) throw new TemplateError(`第一表找不到「${l}」欄位`); });
    if (!text(cellsOf(t0[3])[0]).startsWith('輔導類別')) throw new TemplateError('第一表找不到「輔導類別」');
    const t1 = rowsOf(tbls[1]);
    if (!text(t1[0]).startsWith('學校推動概況')) throw new TemplateError('第二表標題不符');
    EXPECT1.forEach((l, i) => { const got = t1[i + 1] ? text(cellsOf(t1[i + 1])[0]).trim() : ''; if (got !== l) throw new TemplateError(`第二表第 ${i + 1} 列應為「${l}」，實際為「${got}」`); });
    if (text(rowsOf(tbls[2])[0]).trim() !== '輔導觀察與綜合建議') throw new TemplateError('第三表標題不符');
  }

  /* ---------- 主程式 ---------- */
  async function fillTemplate(JSZip, buf, rec, env) {
    const zip = await JSZip.loadAsync(buf);
    const file = zip.file('word/document.xml');
    if (!file) throw new TemplateError('檔案內沒有 word/document.xml，不是有效的 Word 樣板');
    const xml = await file.async('string');
    const doc = new env.DOMParser().parseFromString(xml, 'application/xml');
    const body = all(doc, 'w:body')[0];
    const tbls = kids(body, 'w:tbl');
    checkTemplate(tbls);
    const F = rec.fields;

    /* 第一表 */
    const t0 = rowsOf(tbls[0]);
    let c = cellsOf(t0[0]);
    if (rec.city) setCell(doc, c[1], [rec.city]);
    if (rec.schoolName) setCell(doc, c[3], [rec.schoolName]);
    c = cellsOf(t0[1]);
    if (rec.author) setCell(doc, c[1], [rec.author]);
    if (rec.dateTimeText) setCell(doc, c[3], rec.dateTimeText.split('\n'));
    c = cellsOf(t0[2]);
    if (F.participants && F.participants.status !== 'none') setCell(doc, c[1], [slot(F.participants, '人')]);
    if (rec.visitNo) setCell(doc, c[3], [`第${SP}${rec.visitNo}${SP}次`]);
    // 輔導類別：□ → ☑；其他說明寫入底線位置
    const catPs = kids(cellsOf(t0[3])[1], 'w:p');
    catPs.forEach(p => {
      const m = text(p).match(/^[□☑](\d)\./); if (!m) return;
      const n = +m[1], on = rec.categories.includes(n);
      const t = all(p, 'w:t').find(x => /[□☑]/.test(x.textContent));
      if (t) t.textContent = t.textContent.replace(/[□☑]/, on ? '☑' : '□');
      if (n === 7 && on && rec.otherText) {
        const u = all(p, 'w:t').find(x => /_{5,}/.test(x.textContent));
        if (u) { u.textContent = rec.otherText; u.setAttribute('xml:space', 'preserve'); }
      }
    });

    /* 第二表 */
    const t1 = rowsOf(tbls[1]);
    const v = i => cellsOf(t1[i])[1];
    const has = (...codes) => codes.some(k => F[k] && F[k].status !== 'none');
    if (has('teacherTotal')) setCell(doc, v(1), [F.teacherTotal.status === 'pending' ? '待查' : '約' + slot(F.teacherTotal, '位', { hasYue: true })]);
    if (has('leads')) setCell(doc, v(2), F.leads.status === 'pending' ? ['待查'] : String(F.leads.value).split(/\n+/).map(s => s.trim()).filter(Boolean));
    if (has('guidedClasses', 'collaborativeClasses', 'balancedClasses', 'selfDirectedClasses')) setCell(doc, v(3), [
      `高引導式${slot(F.guidedClasses, '班')}${SP}${SP}／${SP}${SP}高協作式${slot(F.collaborativeClasses, '班')}`,
      `平衡式${slot(F.balancedClasses, '班', { blank: BLANK + SP })}${SP}${SP}／${SP}${SP}高自學式${slot(F.selfDirectedClasses, '班')}`]);
    if (has('fourLearningTeachers', 'subjectCount')) setCell(doc, v(4), [`${slot(F.fourLearningTeachers, '位')}（涵蓋${slot(F.subjectCount, '個學科')}）`]);
    [['advancedTrainingTeachers', 5, '位'], ['platformTeachers', 6, '位'], ['aiTeachers', 7, '位'], ['semesterSharingEvents', 9, '次'], ['semesterExternalTeachers', 10, '位']]
      .forEach(([k, i, u]) => { if (has(k)) setCell(doc, v(i), [slot(F[k], u)]); });
    if (has('communityCount', 'communityTeachers')) setCell(doc, v(8), [`${slot(F.communityCount, '個')}／參與教師${slot(F.communityTeachers, '位')}`]);

    /* 第三表 */
    const sections = (rec.reportSections || []).filter(s => s.text && s.text.trim());
    if (sections.length) {
      const tc = cellsOf(rowsOf(tbls[2])[1])[0];
      const ps = kids(tc, 'w:p');
      const proto = ps[1] || ps[0];
      ps.slice(1).forEach(p => tc.removeChild(p));
      sections.forEach((s, i) => {
        if (i > 0) tc.appendChild(makePara(doc, proto, ''));
        tc.appendChild(makePara(doc, proto, s.title, { bold: true }));
        s.text.split('\n').forEach(line => tc.appendChild(makePara(doc, proto, line)));
      });
    }

    let out = new env.XMLSerializer().serializeToString(doc);
    if (!out.startsWith('<?xml')) out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + out;
    zip.file('word/document.xml', out);
    return zip.generateAsync({ type: env.outputType || 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  return { fillTemplate, slot, TemplateError, TEMPLATE_ID };
});
