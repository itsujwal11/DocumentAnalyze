const path = require('path');

const TESS_PATH = process.env.TESS_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe' : 'tesseract');
const PDFTOPPM_PATH = process.env.PDFTOPPM_PATH || (process.platform === 'win32' ? 'pdftoppm.exe' : 'pdftoppm');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const BANK_KW = { REQUIRED: ['statement'], STRONG: ['account no', 'transaction', 'withdrawal', 'deposit', 'opening balance', 'closing balance', 'bank statement', 'account number', 'sort code', 'account statement', 'fast payment', 'paid in', 'paid out', 'brought forward', 'bacs', 'direct debit'], MEDIUM: ['bank', 'branch', 'cheque', 'debit', 'credit', 'balance', 'previous balance'] };
const INVOICE_KW = { REQUIRED: ['invoice', 'total'], STRONG: ['invoice no', 'bill to', 'subtotal', 'amount due', 'tax', 'gst', 'vat'], MEDIUM: ['vendor', 'customer', 'quantity', 'unit price', 'due date'] };
const RECEIPT_KW = { REQUIRED: ['total', 'receipt'], STRONG: ['subtotal', 'vat', 'cash', 'change', 'thank you', 'quittung', 'kasse', 'bon', 'tisch', 'mwst'], MEDIUM: ['pos', 'store', 'merchant', 'item', 'qty', 'amount', 'bediente', 'stück', 'anzahl', 'tax', 'summe'] };
const UTILITY_KW = { REQUIRED: ['account', 'bill', 'usage'], STRONG: ['utility', 'service', 'meter', 'kwh', 'amount due', 'billing period', 'service address'], MEDIUM: ['electric', 'gas', 'water', 'sewer', 'trash', 'statement', 'current charges', 'previous balance'] };
const PAYSLIP_KW = { REQUIRED: ['employee', 'net pay', 'salary'], STRONG: ['employee id', 'gross', 'deduction', 'ytd', 'pay period', 'pay date', 'net salary', 'take home', 'pay'], MEDIUM: ['earnings', 'withholding', 'fica', 'social security', 'medicare', 'federal', 'state tax', 'local tax', 'pension'] };
const PURCHASE_ORDER_KW = { REQUIRED: ['purchase order', 'po', 'vendor'], STRONG: ['po number', 'order date', 'delivery date', 'ship to', 'bill to'], MEDIUM: ['requisition', 'buyer', 'unit price', 'quantity', 'total'] };
const CONTRACT_KW = { REQUIRED: ['agreement', 'contract', 'party'], STRONG: ['effective date', 'expiration date', 'term', 'signature'], MEDIUM: ['hereby', 'witness', 'clause', 'section', 'whereas', 'governing law'] };
const TAX_KW = { REQUIRED: ['tax', 'return', 'income'], STRONG: ['tax year', 'filing', 'w-2', '1099', 'irs', 'adjusted gross'], MEDIUM: ['withholding', 'deduction', 'credit', 'exemption', 'refund', 'amount you owe'] };
const SHIPPING_KW = { REQUIRED: ['ship', 'weight', 'carrier'], STRONG: ['tracking', 'shipping', 'destination', 'origin', 'bill of lading'], MEDIUM: ['freight', 'cargo', 'pallet', 'container', 'consignee', 'shipper'] };
const REPORT_KW = { REQUIRED: ['report', 'summary'], STRONG: ['prepared by', 'period ending', 'generated', 'analysis'], MEDIUM: ['data', 'table', 'figure', 'appendix', 'reference'] };

const CONFIDENCE_THRESHOLD = 70;

const MONTHS = {
  january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
  jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
};

const STATE_ABBREVS = /\b(WA|MO|NY|CA|TX|FL|IL|PA|OH|GA|NC|MI|NJ|VA|AZ|MA|TN|IN|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|IA|MS|AR|KS|UT|NV|NM|NE|WV|ID|HI|ME|NH|RI|MT|DE|SD|ND|AK|VT|WY)\b/;

function parseAmount(s) {
  if (!s) return null;
  s = s.replace(/[$£€¥]/g, '').trim();
  // must look like a number, not a date/path/word
  if (!/^-?\d[\d,.]*$/.test(s)) return null;
  // detect decimal type by last separator
  const lastCommaIdx = s.lastIndexOf(',');
  const lastDotIdx = s.lastIndexOf('.');
  if (lastCommaIdx > lastDotIdx && lastCommaIdx >= s.length - 3) {
    // European: comma is decimal (318,00 or 1.234,56)
    const result = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isNaN(result) ? null : result;
  }
  // US/default: strip commas, parse as float
  const result = parseFloat(s.replace(/,/g, ''));
  return isNaN(result) ? null : result;
}

function normDate(s) {
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

function parseFlexDate(s) {
  if (!s) return '';
  s = s.trim();
  const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m1) return m1[1] + '-' + m1[2].padStart(2,'0') + '-' + m1[3].padStart(2,'0');
  const m2 = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m2) return m2[3] + '-' + m2[1].padStart(2,'0') + '-' + m2[2].padStart(2,'0');
  // Handle "dd-Mon-YY" or "dd-Mon-YYYY" (e.g. "22-Apr-25", "07-May-2025")
  const m3 = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{2,4})$/);
  if (m3) {
    const mNum = MONTHS[m3[2].toLowerCase()];
    if (mNum) {
      let y = m3[3].length === 2 ? (parseInt(m3[3]) > 30 ? '19' : '20') + m3[3] : m3[3];
      return y + '-' + String(mNum).padStart(2,'0') + '-' + m3[1].padStart(2,'0');
    }
  }
  return s;
}

module.exports = {
  TESS_PATH, PDFTOPPM_PATH, UPLOAD_DIR,
  BANK_KW, INVOICE_KW, RECEIPT_KW, UTILITY_KW, PAYSLIP_KW, PURCHASE_ORDER_KW,
  CONTRACT_KW, TAX_KW, SHIPPING_KW, REPORT_KW,
  CONFIDENCE_THRESHOLD, MONTHS, STATE_ABBREVS,
  parseAmount, normDate, parseFlexDate
};
