const { BANK_KW, INVOICE_KW, RECEIPT_KW, UTILITY_KW, PAYSLIP_KW, PURCHASE_ORDER_KW, CONTRACT_KW, TAX_KW, SHIPPING_KW, REPORT_KW } = require('./config');
const { detectTables } = require('./parsers/table');

function calcScore(text, kws) {
  let s = 0;
  const l = text.toLowerCase();
  if (kws.REQUIRED) kws.REQUIRED.forEach(kw => { if (l.includes(kw)) s += 30; });
  if (kws.STRONG) kws.STRONG.forEach(kw => { if (l.includes(kw)) s += 15; });
  if (kws.MEDIUM) kws.MEDIUM.forEach(kw => { if (l.includes(kw)) s += 5; });
  return Math.min(s, 100);
}

const KW_MAP = [
  { type: 'BANK_STATEMENT', kws: BANK_KW },
  { type: 'INVOICE', kws: INVOICE_KW },
  { type: 'RECEIPT', kws: RECEIPT_KW },
  { type: 'UTILITY_BILL', kws: UTILITY_KW },
  { type: 'PAYSLIP', kws: PAYSLIP_KW },
  { type: 'PURCHASE_ORDER', kws: PURCHASE_ORDER_KW },
  { type: 'CONTRACT', kws: CONTRACT_KW },
  { type: 'TAX_DOCUMENT', kws: TAX_KW },
  { type: 'SHIPPING_DOCUMENT', kws: SHIPPING_KW },
  { type: 'REPORT', kws: REPORT_KW },
];

function classify(text) {
  if (!text || !text.trim()) return { type: 'UNKNOWN', confidence: 0 };

  const scores = KW_MAP.map(({ type, kws }) => ({ type, score: calcScore(text, kws) }));
  scores.sort((a, b) => b.score - a.score);

  if (scores[0].score >= 30) {
    return { type: scores[0].type, confidence: scores[0].score };
  }

  if (scores[0].score > 0) {
    return { type: scores[0].type, confidence: scores[0].score };
  }

  const { confidence: tableConf } = detectTables(text);
  if (tableConf >= 50) return { type: 'TABLE', confidence: tableConf };

  return { type: 'UNKNOWN', confidence: 0 };
}

module.exports = { classify, calcScore };
