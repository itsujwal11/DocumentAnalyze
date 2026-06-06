import Tesseract from 'tesseract.js';

const BANK_KW = { REQUIRED: ['statement', 'account', 'balance'], STRONG: ['account no', 'transaction', 'withdrawal', 'deposit', 'opening balance', 'closing balance'], MEDIUM: ['bank', 'branch', 'cheque', 'debit', 'credit'] };
const INVOICE_KW = { REQUIRED: ['invoice', 'total', 'tax'], STRONG: ['invoice no', 'bill to', 'subtotal', 'amount due'], MEDIUM: ['vendor', 'customer', 'quantity', 'unit price', 'due date'] };
const RECEIPT_KW = { REQUIRED: ['total', 'paid'], STRONG: ['receipt', 'thank you', 'cash', 'change'], MEDIUM: ['pos', 'store', 'merchant', 'item', 'qty', 'amount'] };

function calcScore(text, kws) {
  let s = 0; const t = text.toLowerCase();
  kws.REQUIRED.forEach(kw => { if (t.includes(kw)) s += 30; });
  kws.STRONG.forEach(kw => { let i = 0; while ((i = t.indexOf(kw, i)) !== -1) { s += 15; i += kw.length; } });
  kws.MEDIUM.forEach(kw => { let i = 0; while ((i = t.indexOf(kw, i)) !== -1) { s += 5; i += kw.length; } });
  return Math.min(s, 100);
}

function classify(text) {
  if (!text || !text.trim()) return { type: 'UNKNOWN', confidence: 0, message: 'No text content' };
  const bs = calcScore(text, BANK_KW), iv = calcScore(text, INVOICE_KW), rc = calcScore(text, RECEIPT_KW);
  const max = Math.max(bs, iv, rc);
  if (max >= 30) {
    if (bs === max) return { type: 'BANK_STATEMENT', confidence: bs, message: `Bank statement detected (${bs.toFixed(1)}%)` };
    if (iv === max) return { type: 'INVOICE', confidence: iv, message: `Invoice detected (${iv.toFixed(1)}%)` };
    return { type: 'RECEIPT', confidence: rc, message: `Receipt detected (${rc.toFixed(1)}%)` };
  }
  if (max > 0) {
    const guess = bs >= iv && bs >= rc ? 'BANK_STATEMENT' : iv >= rc ? 'INVOICE' : 'RECEIPT';
    return { type: guess, confidence: max, message: `Weak ${guess} (${max.toFixed(1)}%)` };
  }
  return { type: 'UNKNOWN', confidence: 0, message: 'Could not determine document type' };
}

function parseAmount(str) { if (!str) return null; try { return parseFloat(str.replace(/,/g, '')); } catch { return null; } }

function normalizeDate(s) {
  if (!s) return '';
  const p = s.replace(/\//g, '-').split('-');
  if (p.length === 3) {
    let y = p[2].length === 2 ? '20' + p[2] : p[2];
    let m = p[1].length === 1 ? '0' + p[1] : p[1];
    let d = p[0].length === 1 ? '0' + p[0] : p[0];
    return `${y}-${m}-${d}`;
  }
  return s;
}

function parseBankStatement(text) {
  const recs = [];
  if (!text) return recs;
  const dateRe = /(\d{2}[-/]\d{2}[-/]\d{4})\s*(?:[,;]\s*)?(.*)/;
  const amtRe = /\$?([\d,]+(?:\.\d{2})?)/g;
  for (const line of text.split('\n')) {
    const l = line.trim(); if (!l) continue;
    const dm = l.match(dateRe); if (!dm) continue;
    const date = normalizeDate(dm[1]);
    let rest = dm[2].trim();
    const amounts = []; let m;
    while ((m = amtRe.exec(rest)) !== null) { const a = parseAmount(m[1]); if (a !== null) amounts.push(a); }
    if (!amounts.length) continue;
    let desc = rest.replace(/\$?[\d,]+(?:\.\d{2})?/g, '').trim();
    desc = desc.replace(/\s+/g, ' ').trim();
    desc = desc.replace(/(?:\b|)(amount|date|description|total|balance|account|memo|reference)\s*:\s*/gi, '').trim();
    desc = desc.replace(/\b(cr|dr)\b/gi, '').trim().replace(/\$/g, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s+/g, ' ').trim();
    if (!desc) desc = 'Transaction';
    const ru = rest.toUpperCase();
    const hasCR = ru.includes(' CR') || ru.endsWith('CR');
    const hasDR = ru.includes(' DR') || ru.endsWith('DR');
    const dl = desc.toLowerCase();
    const isDebit = hasDR || /withdrawal|debit|paid|purchase|atm|pos|ebill|electricity|utility/.test(dl);
    const isCredit = hasCR || /credit|deposit|salary|refund|interest|transfer/.test(dl);
    if (amounts.length === 1) {
      if (isDebit) recs.push({ date, description: desc, debit: amounts[0], credit: null, balance: null });
      else recs.push({ date, description: desc, debit: null, credit: amounts[0], balance: null });
    } else if (amounts.length === 2) {
      if (isDebit) recs.push({ date, description: desc, debit: amounts[0], credit: null, balance: amounts[1] });
      else recs.push({ date, description: desc, debit: null, credit: amounts[0], balance: amounts[1] });
    } else if (amounts.length >= 3) {
      const bal = amounts[amounts.length - 1];
      const mid = amounts.slice(0, -1);
      if (mid.length === 1) recs.push({ date, description: desc, debit: null, credit: mid[0], balance: bal });
      else recs.push({ date, description: desc, debit: mid[0], credit: mid[1], balance: bal });
    }
  }
  return recs;
}

function parseInvoice(text) {
  const recs = [];
  if (!text) return recs;
  const invNo = text.match(/(?:invoice\s*(?:no|number|#|id)?[\s:.-]*)(\S+)/i);
  const total = text.match(/(?:total|amount\s*due|grand\s*total)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  const tax = text.match(/(?:tax|vat|gst|sales\s*tax|hst)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  const date = text.match(/(?:date|invoice\s*date|issued)[\s:.]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
  recs.push({ date: date ? normalizeDate(date[1]) : '', description: `Invoice ${invNo ? invNo[1] : ''}`, debit: tax ? parseAmount(tax[1]) : null, credit: total ? parseAmount(total[1]) : null, balance: null, type: 'invoice_summary' });
  let inItems = false;
  const itemRe = /([A-Za-z][A-Za-z\s]+?)\s+([\d,]+(?:\.\d{2})?)/;
  for (const line of text.split('\n')) {
    const l = line.trim(); if (!l) continue;
    if (/item|description|product/i.test(l)) { inItems = true; continue; }
    if (inItems && /total|subtotal/i.test(l)) { inItems = false; continue; }
    if (inItems) {
      const im = l.match(itemRe);
      if (im) { const a = parseAmount(im[2]); if (a !== null) recs.push({ date: '', description: im[1].trim(), debit: null, credit: a, balance: null }); }
    }
  }
  return recs;
}

function parseReceipt(text) {
  const recs = [];
  if (!text) return recs;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let total = null;
  for (const l of lines) { const m = l.match(/(?:total|amount|sum|due|paid|change)[\s:.$]*([\d,]+(?:\.\d{2})?)/i); if (m) total = m[1]; }
  const date = text.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
  const merchant = lines[0] || '';
  recs.push({ date: date ? normalizeDate(date[1]) : '', description: `Receipt - ${merchant}`, debit: null, credit: total ? parseAmount(total) : null, balance: null, type: 'receipt_summary' });
  const itemRe = /([A-Za-z][A-Za-z0-9\s.]+?)\s+([\d,]+(?:\.\d{2})?)\s*$/;
  for (const l of lines) {
    if (l === merchant) continue;
    if (/total|change|cash|tax/i.test(l)) continue;
    const im = l.match(itemRe);
    if (im) { const a = parseAmount(im[2]); if (a !== null && im[1].trim().length > 1) recs.push({ date: '', description: im[1].trim(), debit: null, credit: a, balance: null }); }
  }
  return recs;
}

function parseUnknown(text) {
  const recs = [];
  if (!text) return recs;
  const dateRe = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/g;
  const amtRe = /[$£€]?\s*([\d,]+(?:\.\d{2})?)\s*/g;
  const headerRe = /^(page|date|description|item|qty|quantity|unit|price|amount|total|subtotal|tax|vat|inv|bill|receipt|thank|balance|statement|account|period|opening|closing)/i;
  const nonFinRe = /(?:account|address|phone|email|fax|website|www\.|tel|page|\d+ of \d+)/i;
  for (const line of text.split('\n')) {
    const l = line.trim(); if (!l || l.length < 5) continue;
    if (headerRe.test(l)) continue;
    if (nonFinRe.test(l)) continue;
    const amounts = []; let m; while ((m = amtRe.exec(l)) !== null) { try { const v = parseFloat(m[1].replace(/,/g, '')); if (v > 0) amounts.push(v); } catch {} }
    if (!amounts.length) continue;
    const dates = []; while ((m = dateRe.exec(l)) !== null) { const p1 = parseInt(m[1]), p2 = parseInt(m[2]); if (p1 >= 1 && p1 <= 31 && p2 >= 1 && p2 <= 12) dates.push(m[0]); }
    const date = dates.length ? normalizeDate(dates[0]) : '';
    let clean = l.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, '').replace(/[$£€]?\s*[\d,]+(?:\.\d{2})?/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) clean = 'Entry';
    if (clean.length > 80) clean = clean.substring(0, 80).trim();
    const dl = clean.toLowerCase();
    const isDebit = /debit|withdrawal|paid |purchase|payment|charge/.test(dl);
    const isCredit = /credit|deposit|refund|salary|interest|cash in/.test(dl);
    const r = { date, description: clean, debit: null, credit: null, balance: null, type: 'unknown' };
    if (amounts.length === 1) { if (isDebit) r.debit = amounts[0]; else r.credit = amounts[0]; }
    else if (amounts.length === 2) {
      if (isDebit) { r.debit = amounts[0]; r.balance = amounts[1]; }
      else if (isCredit) { r.credit = amounts[0]; r.balance = amounts[1]; }
      else { if (amounts[0] >= 1000) { r.credit = amounts[0]; r.balance = amounts[1]; } else { r.debit = amounts[0]; r.balance = amounts[1]; } }
    }
    recs.push(r);
  }
  return recs;
}

function parseRecords(type, text) {
  switch (type) {
    case 'BANK_STATEMENT': return parseBankStatement(text);
    case 'INVOICE': return parseInvoice(text);
    case 'RECEIPT': return parseReceipt(text);
    default: return parseUnknown(text);
  }
}

function normalize(docType, fileName, confidence, rawText, records) {
  const normRecs = records.map(r => ({ date: r.date || '', description: r.description || '', amount: r.debit && r.debit > 0 ? r.debit.toFixed(2) : (r.credit || 0).toFixed(2), type: r.debit && r.debit > 0 ? 'debit' : 'credit', source: 'main' }));
  const totalDebit = records.reduce((s, r) => s + (r.debit || 0), 0);
  const totalCredit = records.reduce((s, r) => s + (r.credit || 0), 0);
  const lastBal = records.filter(r => r.balance != null).length > 0 ? records.filter(r => r.balance != null).reduce((_, r) => r.balance, 0) : null;
  return {
    documentType: docType, fileName, extractionConfidence: confidence, rawText,
    records: normRecs,
    summary: { totalDebit, totalCredit, netBalance: lastBal != null ? lastBal : totalCredit - totalDebit, recordCount: records.length }
  };
}

export async function processDocument(file, onProgress) {
  const result = { fileName: file.name, fileSize: file.size, ocrText: '', confidence: 0, detectedType: 'UNKNOWN', parsedRecords: [], normalized: null, error: null };

  try {
    if (onProgress) onProgress(10);

    const { data } = await Tesseract.recognize(file, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(10 + Math.round(m.progress * 60));
        }
      }
    });

    result.ocrText = data.text;
    result.confidence = data.confidence || 0;
    if (onProgress) onProgress(75);


    const cls = classify(data.text);
    result.detectedType = cls.type;
    result.classificationMessage = cls.message;
    if (onProgress) onProgress(85);

    result.parsedRecords = parseRecords(cls.type, data.text);
    if (onProgress) onProgress(92);

    result.normalized = normalize(cls.type, file.name, cls.confidence, data.text, result.parsedRecords);
    if (onProgress) onProgress(100);

    return { success: true, data: result };
  } catch (err) {
    result.error = err.message;
    return { success: false, error: err.message };
  }
}

export async function exportExcel(normalized) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PhoText Pro'; wb.created = new Date();

  const ws1 = wb.addWorksheet('Summary');
  ws1.columns = [{ width: 25 }, { width: 20 }];
  const hd = ws1.addRow(['Field', 'Value']); hd.font = { bold: true };
  const meta = [
    ['Document Type', normalized.documentType],
    ['File Name', normalized.fileName],
    ['Confidence', `${(normalized.extractionConfidence || 0).toFixed(1)}%`],
    ['Records', String(normalized.summary.recordCount)],
    ['Total Debit', normalized.summary.totalDebit.toFixed(2)],
    ['Total Credit', normalized.summary.totalCredit.toFixed(2)],
    ['Net Balance', normalized.summary.netBalance.toFixed(2)],
  ];
  for (const [k, v] of meta) { const r = ws1.addRow([k, v]); r.getCell(0).font = { bold: true }; }

  const ws2 = wb.addWorksheet('Transactions');
  ws2.columns = [{ width: 15 }, { width: 50 }, { width: 12 }, { width: 10 }];
  const hd2 = ws2.addRow(['Date', 'Description', 'Amount', 'Type']); hd2.font = { bold: true };
  for (const r of normalized.records) ws2.addRow([r.date, r.description, r.amount, r.type]);

  if (normalized.rawText) {
    const ws3 = wb.addWorksheet('Raw Text');
    ws3.columns = [{ width: 200 }];
    ws3.addRow(['Raw Extracted Text']).font = { bold: true };
    ws3.addRow([normalized.rawText]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportCsv(normalized) {
  let csv = 'Date,Description,Amount,Type\n';
  for (const r of normalized.records) {
    const esc = v => { const s = String(v || ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; };
    csv += `${esc(r.date)},"${esc(r.description)}",${esc(r.amount)},${esc(r.type)}\n`;
  }
  return new Blob([csv], { type: 'text/csv' });
}
