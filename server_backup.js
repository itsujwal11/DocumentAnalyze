const express = require('express');
const multer = require('multer');
const cors = require('cors');
const ExcelJS = require('exceljs');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = 8080;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));

// ===== IMAGE PREPROCESSING =====
async function preprocessImage(inputPath) {
  const outputPath = inputPath + '_pp.png';
  try {
    const img = await Jimp.read(inputPath);
    await img
      .greyscale()
      .contrast(0.5)
      .normalize()
      .resize(img.bitmap.width > 3000 ? 3000 : img.bitmap.width, Jimp.AUTO)
      .quality(100)
      .writeAsync(outputPath);
    return outputPath;
  } catch (e) {
    return inputPath;
  }
}

// ===== CLASSIFICATION =====
const BANK_KW = { REQUIRED: ['statement', 'account', 'balance'], STRONG: ['account no', 'transaction', 'withdrawal', 'deposit', 'opening balance', 'closing balance'], MEDIUM: ['bank', 'branch', 'cheque', 'debit', 'credit'] };
const INVOICE_KW = { REQUIRED: ['invoice', 'total', 'tax'], STRONG: ['invoice no', 'bill to', 'subtotal', 'amount due'], MEDIUM: ['vendor', 'customer', 'quantity', 'unit price', 'due date'] };
const RECEIPT_KW = { REQUIRED: ['total', 'paid'], STRONG: ['receipt', 'thank you', 'cash', 'change'], MEDIUM: ['pos', 'store', 'merchant', 'item', 'qty', 'amount'] };

function calcScore(t, kws) {
  let s = 0; const l = t.toLowerCase();
  kws.REQUIRED.forEach(kw => { if (l.includes(kw)) s += 30; });
  kws.STRONG.forEach(kw => { let i = 0; while ((i = l.indexOf(kw, i)) !== -1) { s += 15; i += kw.length; } });
  kws.MEDIUM.forEach(kw => { let i = 0; while ((i = l.indexOf(kw, i)) !== -1) { s += 5; i += kw.length; } });
  return Math.min(s, 100);
}

function classify(text) {
  if (!text || !text.trim()) return { type: 'UNKNOWN', confidence: 0 };
  const bs = calcScore(text, BANK_KW), iv = calcScore(text, INVOICE_KW), rc = calcScore(text, RECEIPT_KW);
  const max = Math.max(bs, iv, rc);
  if (max >= 30) { if (bs === max) return { type: 'BANK_STATEMENT', confidence: bs }; if (iv === max) return { type: 'INVOICE', confidence: iv }; return { type: 'RECEIPT', confidence: rc }; }
  if (max > 0) { const guess = bs >= iv && bs >= rc ? 'BANK_STATEMENT' : iv >= rc ? 'INVOICE' : 'RECEIPT'; return { type: guess, confidence: max }; }
  return { type: 'UNKNOWN', confidence: 0 };
}
// ===== ENTITY EXTRACTION (IMPROVED) =====
function extractEntities(text) {
  const entities = [];
  const lowerText = text.toLowerCase();

  function add(type, value) {
    if (value == null) return;
    const v = String(value).trim();
    if (v && !entities.some(e => e.type === type && e.value === v)) {
      entities.push({ type, value: v });
    }
  }

  // Email
  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let m; while ((m = emailRe.exec(text)) !== null) add('EMAIL', m[0]);

  // Phone (requires separator chars to avoid matching account numbers)
  const phoneRe = /\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;
  while ((m = phoneRe.exec(text)) !== null) add('PHONE', m[0].trim());

  // Dates
  const dateRe = /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g;
  while ((m = dateRe.exec(text)) !== null) add('DATE', m[0]);

  // Currency amounts
  const amtRe = /[$€£₹]\s*[\d,]+(?:\.\d{2})?/g;
  while ((m = amtRe.exec(text)) !== null) add('AMOUNT', m[0]);

  // Website
  const webRe = /(?:www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  while ((m = webRe.exec(text)) !== null) add('WEBSITE', m[0].toLowerCase());

  // Currency detected
  if (/\$/.test(text)) add('CURRENCY', 'USD');
  else if (/€/.test(text)) add('CURRENCY', 'EUR');
  else if (/£/.test(text)) add('CURRENCY', 'GBP');
  else if (/₹/.test(text)) add('CURRENCY', 'INR');
  else if (/Rs\.?\s|NPR/i.test(text)) add('CURRENCY', 'NPR');

  // Invoice number
  const invRe = /(?:invoice\s*(?:no|number|#|id)?[:\s]*)([A-Z0-9][-A-Z0-9/]+)/i;
  const invM = text.match(invRe);
  if (invM) add('INVOICE_NUMBER', invM[1].trim());

  // Receipt number
  const receiptRe = /(?:receipt\s*(?:no|number|#|id)?[:\s]*)([A-Z0-9][-A-Z0-9/]+)/i;
  const receiptM = text.match(receiptRe);
  if (receiptM) add('RECEIPT_NUMBER', receiptM[1].trim());

  // Ticket number
  const ticketRe = /(?:ticket\s*(?:no|number|#)?[:\s]*)([A-Z0-9][-A-Z0-9/]+)/i;
  const ticketM = text.match(ticketRe);
  if (ticketM) add('TICKET_NUMBER', ticketM[1].trim());

  // PO number
  const poRe = /(?:po|p\.?\s*o\.?|purchase\s*order)\s*(?:#|number|no)?[:\s]*([A-Z0-9][-A-Z0-9/]+)/i;
  const poM = text.match(poRe);
  if (poM) add('PO_NUMBER', poM[1].trim());

  // Order number
  const orderRe = /(?:order|ord)\s*(?:#|no|number)?[:\s]*([A-Z0-9][-A-Z0-9/]+)/i;
  const orderM = text.match(orderRe);
  if (orderM && !orderM[0].toLowerCase().includes('purchase')) add('ORDER_NUMBER', orderM[1].trim());

  // Quote number
  const quoteRe = /(?:quote|quotation)\s*(?:#|no|number)?[:\s]*([A-Z0-9][-A-Z0-9/]+)/i;
  const quoteM = text.match(quoteRe);
  if (quoteM) add('QUOTE_NUMBER', quoteM[1].trim());

  // Sort code
  const sortRe = /sort\s*code[:\s]*([\d-]{6,10})/i;
  const sortM = text.match(sortRe);
  if (sortM) add('SORT_CODE', sortM[1].trim());

  // Account number
  const acctRe = /account\s*(?:number|no|#)[:\s]*(\d{6,20})/i;
  const acctM = text.match(acctRe);
  if (acctM) add('ACCOUNT_NUMBER', acctM[1].trim());

  // IBAN
  const ibanRe = /\bIBAN[:\s]*([A-Z0-9]{10,34})\b/i;
  const ibanM = text.match(ibanRe);
  if (ibanM) add('IBAN', ibanM[1].trim());

  // BIC
  const bicRe = /\bBIC[:\s]*([A-Z0-9]{6,12})\b/i;
  const bicM = text.match(bicRe);
  if (bicM) add('BIC', bicM[1].trim());

  // SWIFT code
  const swiftRe = /\bSWIFT[:\s]*([A-Z0-9]{6,12})\b/i;
  const swiftM = text.match(swiftRe);
  if (swiftM) add('SWIFT_CODE', swiftM[1].trim());

  // Branch
  const branchRe = /branch[:\s]*([A-Za-z0-9\s.]+?)(?:\d|[A-Z]{2}\s|$)/i;
  const branchM = text.match(branchRe);
  if (branchM) add('BRANCH', branchM[1].trim());

  // Bank name
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(4, lines.length); i++) {
    const l = lines[i].replace(/\t.*/, '').trim();
    if (/(bank|limited|financial|credit\s+union)/i.test(l) && !/statement|account/i.test(l) && l.length < 60) {
      add('BANK_NAME', l);
      break;
    }
  }

  // Routing number
  const routingRe = /routing\s*(?:number|no|#)[:\s]*(\d{6,12})/i;
  const routingM = text.match(routingRe);
  if (routingM) add('ROUTING_NUMBER', routingM[1].trim());

  // Account holder
  const holderRe = /account\s*holder[:\s]*([A-Za-z\s.]+?)(?:\n|$)/i;
  const holderM = text.match(holderRe);
  if (holderM) add('ACCOUNT_HOLDER', holderM[1].trim());

  // Statement period
  const periodRe = /statement\s*period[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i;
  const periodM = text.match(periodRe);
  if (periodM) add('STATEMENT_PERIOD', periodM[1].trim());

  // Customer ID
  const custIdRe = /(?:customer|cust)\s*(?:id|#|no|number)[:\s]*([A-Z0-9][-A-Z0-9/]+)/i;
  const custIdM = text.match(custIdRe);
  if (custIdM) add('CUSTOMER_ID', custIdM[1].trim());

  // Business name (first meaningful line)
  const firstLines = text.split('\n').filter(Boolean).map(l => l.trim()).filter(l => l.length > 2);
  for (let i = 0; i < Math.min(2, firstLines.length); i++) {
    const l = firstLines[i];
    if (!/^(bill|ship|invoice|date|page|total|tax|amount|receipt|statement|account)/i.test(l) && !/^\d/.test(l)) {
      add('BUSINESS_NAME', l);
      break;
    }
  }

  // Tax ID (EIN, VAT, GST, registration number)
  const einRe = /\bEIN[:\s]*(\d{2}-\d{7})\b/i;
  const einM = text.match(einRe);
  if (einM) add('TAX_ID', einM[1]);
  const vatRe = /\bVAT[:\s]*([A-Z0-9][-A-Z0-9]{4,20})\b/i;
  const vatM = text.match(vatRe);
  if (vatM) add('TAX_ID', vatM[1]);
  const gstRe = /\bGST[:\s]*([A-Z0-9][-A-Z0-9]{4,20})\b/i;
  const gstM = text.match(gstRe);
  if (gstM) add('TAX_ID', gstM[1]);
  const regRe = /\b(?:registration\s*no[.:]?|reg\s*no[.:]?)[:\s]*([A-Z0-9][-A-Z0-9]{4,20})\b/i;
  const regM = text.match(regRe);
  if (regM) add('TAX_ID', regM[1]);

  // Tax rate
  const taxRateRe = /(?:tax\s*rate|vat\s*rate|gst\s*rate)[:\s]*([\d.]+)%/i;
  const taxRateM = text.match(taxRateRe);
  if (taxRateM) add('TAX_RATE', taxRateM[1] + '%');

  // Payment terms
  const termsRe = /(?:payment\s*terms|terms)[:\s]*([A-Za-z0-9\s,/-]+?)(?:\n|$)/i;
  const termsM = text.match(termsRe);
  if (termsM) add('PAYMENT_TERMS', termsM[1].trim());

  // Payment method
  const pmMap = { visa: 'Visa', mastercard: 'Mastercard', 'american express': 'Amex', amex: 'Amex', discover: 'Discover', ach: 'ACH', cash: 'Cash', check: 'Check', cheque: 'Check' };
  for (const [kw, val] of Object.entries(pmMap)) {
    if (lowerText.includes(kw)) { add('PAYMENT_METHOD', val); break; }
  }

  // Card type
  const cardRe = /(visa|mastercard|amex|american\s*express|discover)/i;
  const cardM = text.match(cardRe);
  if (cardM) add('CARD_TYPE', cardM[1]);

  // Last 4 digits of card
  const last4Re = /(?:\*{4}\s*){1,3}(\d{4})/;
  const last4M = text.match(last4Re);
  if (last4M) add('LAST4_DIGITS', last4M[1]);

  // Authorization code
  const authRe = /(?:authorization|auth|approval)\s*(?:code|#|no)[:\s]*([A-Z0-9]+)/i;
  const authM = text.match(authRe);
  if (authM) add('AUTHORIZATION_CODE', authM[1].trim());

  // Financial labeled amounts
  const labelAmts = [
    [/subtotal[\s:.$]*([\d,]+(?:\.\d{2})?)/i, 'SUBTOTAL'],
    [/total[\s:.$]*([\d,]+(?:\.\d{2})?)/i, 'TOTAL_AMOUNT'],
    [/discount[\s:.$]*([\d,]+(?:\.\d{2})?)/i, 'DISCOUNT'],
    [/shipping[\s:.$]*([\d,]+(?:\.\d{2})?)/i, 'SHIPPING_COST'],
    [/(?:tax|vat|gst)[\s:.$]*([\d,]+(?:\.\d{2})?)/i, 'TAX_AMOUNT'],
    [/amount\s*paid[\s:.$]*([\d,]+(?:\.\d{2})?)/i, 'AMOUNT_PAID'],
    [/balance\s*due[\s:.$]*([\d,]+(?:\.\d{2})?)/i, 'BALANCE_DUE'],
    [/opening\s*balance[\s:.$]*([\d,]+(?:\.\d{2})?)/i, 'OPENING_BALANCE'],
    [/closing\s*balance[\s:.$]*([\d,]+(?:\.\d{2})?)/i, 'CLOSING_BALANCE'],
    [/available\s*balance[\s:.$]*([\d,]+(?:\.\d{2})?)/i, 'AVAILABLE_BALANCE'],
  ];
  for (const [re, type] of labelAmts) {
    const am = text.match(re);
    if (am) add(type, parseAmount(am[1]));
  }

  return entities;
}
// ===== BANK FIELD EXTRACTION =====
function extractBankFields(text) {
  const fields = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < Math.min(4, lines.length); i++) {
    const l = lines[i].replace(/\t.*/, '').trim();
    if (/(bank|limited|financial|credit\s+union)/i.test(l) && !/statement|account/i.test(l)) {
      if (!fields.bankName || l.length > fields.bankName.length) fields.bankName = l;
    }
  }
  if (!fields.bankName) fields.bankName = lines[0] || '';

  const holderM = text.match(/account\s*holder[:\s]*([A-Za-z\s.]+?)(?:\n|$)/i);
  if (holderM) fields.accountHolder = holderM[1].trim();

  const acctM = text.match(/account\s*(?:number|no)[:\s]*(\d{6,20})/i);
  if (acctM) fields.accountNumber = acctM[1].trim();

  const periodM = text.match(/statement\s*period[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
  if (periodM) fields.statementPeriod = periodM[1].trim();

  const openM = text.match(/opening\s*balance[:\s$]*([\d,]+(?:\.\d{2})?)/i);
  if (openM) fields.openingBalance = parseAmount(openM[1]);

  const closeM = text.match(/closing\s*balance[:\s$]*([\d,]+(?:\.\d{2})?)/i);
  if (closeM) fields.closingBalance = parseAmount(closeM[1]);

  const sortM = text.match(/sort\s*code[:\s]*([\d-]+)/i);
  if (sortM) fields.sortCode = sortM[1].trim();

  const branchM = text.match(/branch[:\s]*([A-Za-z0-9\s.]+?)(?:\n|IBAN|BIC|$)/i);
  if (branchM) fields.branch = branchM[1].trim();

  const ibanM = text.match(/IBAN[:\s]*([A-Z0-9\s]{10,34})/i);
  if (ibanM) fields.iban = ibanM[1].replace(/\t.*/, '').trim();

  const bicM = text.match(/BIC[:\s]*([A-Z0-9\s]{6,12})/i);
  if (bicM) fields.bic = bicM[1].trim();

  return fields;
}

// ===== INVOICE FIELD EXTRACTION =====
function extractInvoiceFields(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const lowerLines = lines.map(l => l.toLowerCase());
  const fields = {};

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const l = lines[i].trim();
    if (l && !l.toLowerCase().includes('invoice') && !l.match(/^\d/) && l.length > 2 && !fields.company) {
      if (!/^(bill|ship|invoice|date|page|total|tax|amount)/i.test(l)) {
        fields.company = l;
      }
    }
  }

  const invRe = /(?:invoice\s*(?:no|number|#|id)?[:\s]*)([A-Z0-9][-A-Z0-9/]+)/i;
  const invM = text.match(invRe);
  if (invM) fields.invoiceNumber = invM[1].trim();

  const dates = [];
  const dateRe = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g;
  let m; while ((m = dateRe.exec(text)) !== null) dates.push(m[1]);
  if (dates.length > 0) fields.invoiceDate = dates[0];
  if (dates.length > 1) fields.dueDate = dates[1];

  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  while ((m = emailRe.exec(text)) !== null) { fields.email = fields.email || m[0]; fields.website = m[0].split('@')[1]; }

  const phoneRe = /(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;
  while ((m = phoneRe.exec(text)) !== null) { fields.phone = fields.phone || m[0].trim(); }

  const billMatch = text.match(/(?:bill\s*to|billed?\s*to)[:\s]*([^\n]+)/i);
  if (billMatch) fields.billTo = billMatch[1].trim();
  const shipMatch = text.match(/(?:ship\s*to|shipped?\s*to)[:\s]*([^\n]+)/i);
  if (shipMatch) fields.shipTo = shipMatch[1].trim();

  const addrLines = lines.filter(l => /street|st\.?|drive|dr\.?|avenue|ave|road|rd\.?|blvd|ct\.?|ln\.?|way|circle|[A-Z]{2}\s+\d{5}|WA|MO|NY|CA|TX|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|IA|MS|AR|KS|UT|NV|NM|NE|WV|ID|HI|ME|NH|RI|MT|DE|SD|ND|AK|VT|WY/i.test(l));
  if (addrLines.length > 0) fields.addresses = addrLines.map(l => l.trim());

  const items = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const ll = lowerLines[i];

    if (/item|description|product|qty|quantity|description/i.test(ll) && /\b(amount|price|total)\b/i.test(ll)) {
      inTable = true;
      continue;
    }
    if (inTable && /^[\s]*$/m.test(l)) { inTable = false; continue; }
    if (inTable) {
      const itemMatch = l.match(/(\d+)\s+(.+?)\s+\$?\s*([\d,]+(?:\.\d{2})?)/);
      if (itemMatch) {
        items.push({ qty: parseInt(itemMatch[1]), description: itemMatch[2].trim(), amount: parseAmount(itemMatch[3]) });
      } else {
        const simpleItem = l.match(/^([A-Za-z][A-Za-z\s&.-]+?)\s+\$?\s*([\d,]+(?:\.\d{2})?)/);
        if (simpleItem && !/total|subtotal|tax|shipping|thank|make all|payable/i.test(l)) {
          items.push({ qty: 1, description: simpleItem[1].trim(), amount: parseAmount(simpleItem[2]) });
        }
      }
    }
  }

  const totalMatch = text.match(/(?:total|grand\s+total)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (totalMatch) fields.total = parseAmount(totalMatch[1]);

  const subMatch = text.match(/(?:subtotal)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (subMatch) fields.subtotal = parseAmount(subMatch[1]);

  const taxMatch = text.match(/(?:tax|vat|gst|sales\s+tax|hst)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (taxMatch) fields.tax = parseAmount(taxMatch[1]);

  const shipMatch2 = text.match(/(?:shipping|freight|delivery|handling)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (shipMatch2) fields.shipping = parseAmount(shipMatch2[1]);

  if (!fields.company) fields.company = lines[0] || '';

  fields.lineItems = items;
  return fields;
}
// ===== COMPREHENSIVE FIELD EXTRACTION =====
function extractAllFields(text, docType) {
  const fields = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const lowerText = text.toLowerCase();

  function extractBlock(label, maxExtra) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(label.toLowerCase())) {
        const parts = [lines[i].replace(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').replace(/^[:\s]+/, '')];
        for (let j = i + 1; j < Math.min(i + 1 + maxExtra, lines.length); j++) {
          const l = lines[j];
          if (!l) break;
          if (/^(invoice|date|page|total|tax|subtotal|amount|phone|email|account|payment|due|ship|bill|order|po|quote|receipt|customer|vendor|item|qty|quantity|unit|price|discount|shipping|freight|handling|reference|ref|check|authorization|auth|terminal|store|cashier|reg|terms|remit|make all|legal|thank)[\s:]/i.test(l)) break;
          parts.push(l);
        }
        const result = parts.filter(Boolean).join(', ').trim();
        if (result) return result;
        break;
      }
    }
    return '';
  }

  // ===== 1. Document Metadata =====
  fields.documentType = docType;

  const pageMatch = text.match(/page\s+(\d+)\s+of\s+(\d+)/i);
  if (pageMatch) fields.pageCount = parseInt(pageMatch[2]);

  if (/der\s+die\s+das|und\s+oder|nicht\s+kein/i.test(text)) fields.languageDetected = 'DE';
  else if (/le\s+la\s+les|et\s+ou|nous\s+vous|veuillez/i.test(text)) fields.languageDetected = 'FR';
  else if (/el\s+la\s+los|y\s+o|nuestro|señor/i.test(text)) fields.languageDetected = 'ES';
  else fields.languageDetected = 'EN';

  if (/\$/.test(text)) fields.currencyDetected = 'USD';
  else if (/₹|Rs\.?\s/i.test(text)) fields.currencyDetected = 'INR';
  else if (/€/.test(text)) fields.currencyDetected = 'EUR';
  else if (/£/.test(text)) fields.currencyDetected = 'GBP';
  else if (/¥/.test(text)) fields.currencyDetected = 'JPY';
  else fields.currencyDetected = 'USD';

  // ===== 2. Issuer/Vendor/Merchant =====
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const l = lines[i].trim();
    if (l && !l.toLowerCase().includes('invoice') && !l.match(/^\d/) && l.length > 2) {
      if (!/^(bill|ship|invoice|date|page|total|tax|amount|receipt|statement|account)/i.test(l)) {
        if (!fields.businessName || l.length > fields.businessName.length) {
          fields.businessName = l;
        }
      }
    }
  }
  if (!fields.businessName) fields.businessName = lines[0] || '';
  // Tax ID
  const einMatch = text.match(/\bEIN[:\s]*(\d{2}-\d{7})\b/i);
  if (einMatch) fields.taxId = einMatch[1];
  const vatMatch = text.match(/\bVAT[:\s]*([A-Z0-9][-A-Z0-9]{4,20})\b/i);
  if (vatMatch && !fields.taxId) fields.taxId = vatMatch[1];
  const gstMatch = text.match(/\bGST[:\s]*([A-Z0-9][-A-Z0-9]{4,20})\b/i);
  if (gstMatch && !fields.taxId) fields.taxId = gstMatch[1];
  const regMatch = text.match(/\b(?:registration\s*no[.:]?|reg\s*no[.:]?)[:\s]*([A-Z0-9][-A-Z0-9]{4,20})\b/i);
  if (regMatch && !fields.taxId) fields.taxId = regMatch[1];

  // Address
  const addrFiltered = lines.filter(l => {
    const ll = l.toLowerCase();
    return /street|st\.|drive|dr\.|avenue|ave\.|road|rd\.|blvd|boulevard|ct\.|ln\.|way|circle|p\.?\s*o\.?\s*box|suite|ste\b/i.test(ll) ||
           /\b[A-Z]{2}\s+\d{5}/.test(l) ||
           (/\b\d{5}\b/.test(l) && /[A-Za-z]/.test(l));
  });
  if (addrFiltered.length > 0) fields.address = addrFiltered.join('; ');

  // Phone
  const phoneR = /\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;
  let pm; if ((pm = phoneR.exec(text)) !== null) fields.phone = pm[0].trim();

  // Email
  const emailR = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let em; if ((em = emailR.exec(text)) !== null) fields.email = em[0];

  // Website
  const webR = /(?:www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  let wm; if ((wm = webR.exec(text)) !== null) fields.website = wm[0].toLowerCase();

  // Store number
  const storeRe = /(?:store|store\s*#|store\s*no)[:\s]*([A-Z0-9][-A-Z0-9]+)/i;
  const storeM = text.match(storeRe);
  if (storeM) fields.storeNumber = storeM[1].trim();

  // Cashier name
  const cashierRe = /(?:cashier|associate|clerk)[:\s]*([A-Za-z\s.]+?)(?:\n|$)/i;
  const cashierM = text.match(cashierRe);
  if (cashierM) fields.cashierName = cashierM[1].trim();

  // Terminal ID
  const termRe = /(?:terminal|term\s*#|reg\s*#|register)[:\s]*([A-Z0-9]+)/i;
  const termM = text.match(termRe);
  if (termM) fields.terminalId = termM[1].trim();

  // ===== 3. Recipient/Customer =====
  const billBlock = extractBlock('bill to', 3);
  if (billBlock) {
    fields.billToName = billBlock.split(',')[0].trim();
    fields.billToAddress = billBlock;
  }
  const shipBlock = extractBlock('ship to', 3);
  if (shipBlock) {
    fields.shipToName = shipBlock.split(',')[0].trim();
    fields.shipToAddress = shipBlock;
  }

  const custIdRe = /(?:customer|cust)\s*(?:id|#|no|number)[:\s]*([A-Z0-9][-A-Z0-9/]+)/i;
  const custIdM = text.match(custIdRe);
  if (custIdM) fields.customerId = custIdM[1].trim();

  const custEmailRe = /(?:customer|cust)\s*email[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const custEmailM = text.match(custEmailRe);
  if (custEmailM) fields.customerEmail = custEmailM[1].trim();

  const custPhoneRe = /(?:customer|cust)\s*(?:phone|tel|mobile)[:\s]*(\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4})/i;
  const custPhoneM = text.match(custPhoneRe);
  if (custPhoneM) fields.customerPhone = custPhoneM[1].trim();
  // ===== 4. Financial Tracking =====
  const invRe = /(?:invoice\s*(?:no|number|#|id)?[:\s]*)([A-Z0-9][-A-Z0-9/]+)/i;
  const invM = text.match(invRe);
  if (invM) fields.invoiceNumber = invM[1].trim();

  const receiptRe = /(?:receipt\s*(?:no|number|#|id)?[:\s]*)([A-Z0-9][-A-Z0-9/]+)/i;
  const receiptM = text.match(receiptRe);
  if (receiptM) fields.receiptNumber = receiptM[1].trim();

  const ticketRe = /(?:ticket\s*(?:no|number|#)?[:\s]*)([A-Z0-9][-A-Z0-9/]+)/i;
  const ticketM = text.match(ticketRe);
  if (ticketM) fields.ticketNumber = ticketM[1].trim();

  const poRe = /(?:po|p\.?\s*o\.?|purchase\s*order)\s*(?:#|number|no)?[:\s]*([A-Z0-9][-A-Z0-9/]+)/i;
  const poM = text.match(poRe);
  if (poM) fields.poNumber = poM[1].trim();

  const orderRe = /(?:order|ord)\s*(?:#|no|number)?[:\s]*([A-Z0-9][-A-Z0-9/]+)/i;
  const orderM = text.match(orderRe);
  if (orderM && !orderM[0].toLowerCase().includes('purchase')) fields.orderNumber = orderM[1].trim();

  const quoteRe = /(?:quote|quotation)\s*(?:#|no|number)?[:\s]*([A-Z0-9][-A-Z0-9/]+)/i;
  const quoteM = text.match(quoteRe);
  if (quoteM) fields.quoteNumber = quoteM[1].trim();

  // Dates
  function parseFlexDate(s) {
    if (!s) return '';
    s = s.trim();
    const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (m1) return m1[1] + '-' + m1[2].padStart(2,'0') + '-' + m1[3].padStart(2,'0');
    const m2 = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m2) return m2[3] + '-' + m2[1].padStart(2,'0') + '-' + m2[2].padStart(2,'0');
    return s;
  }

  const issueDateM = text.match(/(?:issue\s*date|date\s*of\s*issue|issued)[:\s]*([A-Za-z0-9\s,-]+?)(?:\n|$)/i);
  if (issueDateM) fields.issueDate = parseFlexDate(issueDateM[1].trim());

  const dueDateM = text.match(/(?:due\s*date|payment\s*due|due\s*by|payable\s*by)[:\s]*([A-Za-z0-9\s,-]+?)(?:\n|$)/i);
  if (dueDateM) fields.dueDate = parseFlexDate(dueDateM[1].trim());

  const deliveryDateM = text.match(/(?:delivery\s*date|delivered|ship\s*date)[:\s]*([A-Za-z0-9\s,-]+?)(?:\n|$)/i);
  if (deliveryDateM) fields.deliveryDate = parseFlexDate(deliveryDateM[1].trim());

  // Fallback to generic dates if specific dates not found
  if (!fields.issueDate || !fields.dueDate) {
    const allDates = [];
    const dRe1 = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g;
    let dm;
    while ((dm = dRe1.exec(text)) !== null) allDates.push(dm[1]);
    const dRe2 = /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/g;
    while ((dm = dRe2.exec(text)) !== null) allDates.push(dm[1]);
    const normalized = allDates.map(d => parseFlexDate(d)).filter(Boolean);
    if (!fields.issueDate && normalized.length > 0) fields.issueDate = normalized[0];
    if (!fields.dueDate && normalized.length > 1) fields.dueDate = normalized[1];
  }

  const termsM = text.match(/(?:payment\s*terms|terms|terms?\s*of\s*payment)[:\s]*([A-Za-z0-9\s,-]+?)(?:\n|$)/i);
  if (termsM) fields.paymentTerms = termsM[1].trim();
  // ===== 5. Bank-Specific =====
  for (let i = 0; i < Math.min(4, lines.length); i++) {
    const l = lines[i].replace(/\t.*/, '').trim();
    if (/(bank|limited|financial|credit\s+union)/i.test(l) && !/statement|account/i.test(l)) {
      if (!fields.bankName || l.length > fields.bankName.length) fields.bankName = l;
    }
  }
  if (!fields.bankName) fields.bankName = lines[0] || '';

  const branchRe = /branch[:\s]*([A-Za-z0-9\s.]+?)(?:\n|IBAN|BIC|$)/i;
  const branchM = text.match(branchRe);
  if (branchM) fields.branchName = branchM[1].trim();

  const acctRe = /account\s*(?:number|no|#)[:\s]*(\d{6,20})/i;
  const acctM = text.match(acctRe);
  if (acctM) fields.accountNumber = acctM[1].trim();

  const sortRe = /sort\s*code[:\s]*([\d-]+)/i;
  const sortM = text.match(sortRe);
  if (sortM) fields.sortCode = sortM[1].trim();

  const routingRe = /routing\s*(?:number|no|#)[:\s]*(\d{6,12})/i;
  const routingM = text.match(routingRe);
  if (routingM) fields.routingNumber = routingM[1].trim();

  const ibanRe = /\bIBAN[:\s]*([A-Z0-9\s]{10,34})\b/i;
  const ibanM = text.match(ibanRe);
  if (ibanM) fields.iban = ibanM[1].replace(/\s+/g, '').trim();

  const bicRe = /\bBIC[:\s]*([A-Z0-9]{6,12})\b/i;
  const bicM = text.match(bicRe);
  if (bicM) fields.bic = bicM[1].trim();

  const swiftRe = /\bSWIFT[:\s]*([A-Z0-9]{6,12})\b/i;
  const swiftM = text.match(swiftRe);
  if (swiftM) fields.swiftCode = swiftM[1].trim();

  const holderRe = /account\s*holder[:\s]*([A-Za-z\s.]+?)(?:\n|$)/i;
  const holderM = text.match(holderRe);
  if (holderM) fields.accountHolder = holderM[1].trim();

  const periodRe = /statement\s*period[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i;
  const periodM = text.match(periodRe);
  if (periodM) fields.statementPeriod = periodM[1].trim();

  const stmtDateRe = /statement\s*date[:\s]*([A-Za-z0-9\s,-]+?)(?:\n|$)/i;
  const stmtDateM = text.match(stmtDateRe);
  if (stmtDateM) fields.statementDate = parseFlexDate(stmtDateM[1].trim());

  const openM = text.match(/opening\s*balance[:\s$]*([\d,]+(?:\.\d{2})?)/i);
  if (openM) fields.openingBalance = parseAmount(openM[1]);

  const closeM = text.match(/closing\s*balance[:\s$]*([\d,]+(?:\.\d{2})?)/i);
  if (closeM) fields.closingBalance = parseAmount(closeM[1]);

  const availM = text.match(/available\s*balance[:\s$]*([\d,]+(?:\.\d{2})?)/i);
  if (availM) fields.availableBalance = parseAmount(availM[1]);
  // ===== 6. Line Items =====
  const lineItems = [];
  let inTable = false;
  let tableCols = [];
  const lowerLines = lines.map(l => l.toLowerCase());

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const ll = lowerLines[i];

    if (/item|description|product|qty|quantity|details/i.test(ll) && /\b(amount|price|total|cost|value)\b/i.test(ll)) {
      inTable = true;
      const parts = l.split(/\s{2,}|\t/).filter(Boolean);
      tableCols = parts.map(p => {
        const pl = p.toLowerCase();
        if (/qty|quantity/i.test(pl)) return 'qty';
        if (/desc|item|product|details/i.test(pl)) return 'desc';
        if (/price|rate|unit/i.test(pl)) return 'price';
        if (/discount/i.test(pl)) return 'disc';
        if (/tax|vat|gst/i.test(pl)) return 'tax';
        if (/total|amount|cost|value/i.test(pl)) return 'total';
        return 'unknown';
      });
      continue;
    }

    if (inTable) {
      if (/^[\s]*$/.test(l) || /total|subtotal|tax|shipping|thank|make all|payable|balance|opening|closing/i.test(ll)) {
        inTable = false;
        continue;
      }

      const parts = l.split(/\s{2,}|\t/).filter(Boolean);
      const item = { qty: 1, description: '', unitPrice: null, discount: null, tax: null, total: null };

      if (parts.length >= 2 && tableCols.length >= 2) {
        for (let ci = 0; ci < parts.length && ci < tableCols.length; ci++) {
          const col = tableCols[ci];
          const val = parts[ci].trim();
          const num = parseAmount(val);
          if (col === 'qty' && num !== null) item.qty = num;
          else if (col === 'desc') item.description = val;
          else if (col === 'price' && num !== null) item.unitPrice = num;
          else if (col === 'disc' && num !== null) item.discount = num;
          else if (col === 'tax' && num !== null) item.tax = num;
          else if (col === 'total' && num !== null) item.total = num;
        }
        if (item.description || item.total !== null) {
          lineItems.push(item);
        }
      } else {
        const itemMatch = l.match(/(\d+)\s+(.+?)\s+\$?\s*([\d,]+(?:\.\d{2})?)/);
        if (itemMatch) {
          lineItems.push({ qty: parseInt(itemMatch[1]), description: itemMatch[2].trim(), unitPrice: parseAmount(itemMatch[3]), discount: null, tax: null, total: parseAmount(itemMatch[3]) });
        } else {
          const simpleItem = l.match(/^([A-Za-z][A-Za-z\s&.-]+?)\s+\$?\s*([\d,]+(?:\.\d{2})?)/);
          if (simpleItem && !/total|subtotal|tax/i.test(l)) {
            lineItems.push({ qty: 1, description: simpleItem[1].trim(), unitPrice: parseAmount(simpleItem[2]), discount: null, tax: null, total: parseAmount(simpleItem[2]) });
          }
        }
      }
    }
  }

  // For bank statements, extract transaction-style line items
  if (docType === 'BANK_STATEMENT' || docType === 'UNKNOWN') {
    const bankItems = [];
    for (const line of lines) {
      const ll = line.toLowerCase();
      if (/opening\s*balance|closing\s*balance|total|page\s+\d+|iban|bic/i.test(ll)) continue;
      if (/^date\s+(?:description|details|paid|debit)/i.test(ll)) continue;
      const amounts = (line.match(/(?:\$|\b)\s*([\d,]+\.\d{2})\b/g) || []).map(s => {
        const num = parseAmount(s.replace(/[^0-9.,]/g, ''));
        return num !== null && num > 0 ? num : null;
      }).filter(n => n !== null);
      if (amounts.length === 0) continue;
      const dateM = line.match(/^([A-Za-z]+\s+\d{1,2},?\s*\d{0,4})|^(\d{1,2}\s+[A-Za-z]+)/);
      const date = dateM ? (dateM[1] || dateM[2] || '').trim() : '';
      const desc = line.replace(/(?:\$|\b)\s*[\d,]+\.\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
      const item = { date, description: desc || 'Transaction', debit: null, credit: null, balance: null };
      if (amounts.length === 1) { item.credit = amounts[0]; item.balance = amounts[0]; }
      else if (amounts.length === 2) { item.debit = amounts[0]; item.credit = amounts[1]; }
      else if (amounts.length >= 3) { item.debit = amounts[0]; item.credit = amounts[1]; item.balance = amounts[amounts.length - 1]; }
      bankItems.push(item);
    }
    if (bankItems.length > 0) fields.bankLineItems = bankItems;
  }

  if (lineItems.length > 0) fields.lineItems = lineItems;
  // ===== 7. Financial Summary =====
  const subM = text.match(/(?:subtotal)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (subM) fields.subtotal = parseAmount(subM[1]);

  const discM = text.match(/(?:discount|total discount)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (discM) fields.totalDiscount = parseAmount(discM[1]);

  const shipM = text.match(/(?:shipping|freight|delivery|handling)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (shipM) fields.shippingCost = parseAmount(shipM[1]);

  const taxM = text.match(/(?:tax|vat|gst|sales\s+tax|hst)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (taxM) fields.taxAmount = parseAmount(taxM[1]);

  const taxRateM = text.match(/(?:tax\s*rate|vat\s*rate|gst\s*rate)[:\s]*([\d.]+)%/i);
  if (taxRateM) fields.taxRate = parseFloat(taxRateM[1]);

  const taxIdM = text.match(/(?:tax\s*id|vat\s*no|gst\s*no|ein)[:\s]*([A-Z0-9][-A-Z0-9]{3,20})/i);
  if (taxIdM && !fields.taxId) fields.taxRegId = taxIdM[1].trim();

  const totalM = text.match(/(?:total|grand\s+total|total amount)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (totalM) fields.totalAmount = parseAmount(totalM[1]);

  const paidM = text.match(/(?:amount\s*paid|paid|payment)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (paidM) fields.amountPaid = parseAmount(paidM[1]);

  const balanceDueM = text.match(/(?:balance\s*due|amount\s*due|owing)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (balanceDueM) fields.balanceDue = parseAmount(balanceDueM[1]);

  const depositM = text.match(/(?:deposit|deposit\s*collected|down\s*payment)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (depositM) fields.depositCollected = parseAmount(depositM[1]);

  // ===== 8. Payment/Settlement =====
  const pmRe = /(?:payment\s*method|paid\s*via|payment\s*type)[:\s]*([A-Za-z\s]+?)(?:\n|$)/i;
  const pmM = text.match(pmRe);
  if (pmM) fields.paymentMethod = pmM[1].trim();
  else {
    if (/visa/i.test(text)) fields.paymentMethod = 'Visa';
    else if (/mastercard|mc\b/i.test(text)) fields.paymentMethod = 'Mastercard';
    else if (/amex|american\s*express/i.test(text)) fields.paymentMethod = 'Amex';
    else if (/discover/i.test(text)) fields.paymentMethod = 'Discover';
    else if (/ach\b/i.test(text)) fields.paymentMethod = 'ACH';
    else if (/cash/i.test(text)) fields.paymentMethod = 'Cash';
    else if (/check|cheque/i.test(text)) fields.paymentMethod = 'Check';
  }

  const cardTypeM = text.match(/(visa|mastercard|amex|american\s*express|discover)/i);
  if (cardTypeM) fields.cardType = cardTypeM[1];

  const last4M = text.match(/(?:\*{4}\s*){1,3}(\d{4})/);
  if (last4M) fields.last4Digits = last4M[1];

  const authM = text.match(/(?:authorization|auth|approval)\s*(?:code|#|no)[:\s]*([A-Z0-9]+)/i);
  if (authM) fields.authorizationCode = authM[1].trim();

  const remitM = text.match(/(?:remit|remittance|make\s*(?:all)?\s*payable)[^\n]*/i);
  if (remitM) fields.remitInstructions = remitM[0].trim();

  const checkPayM = text.match(/(?:make\s*(?:all)?\s*(?:checks?|cheques?|payments)?\s*payable\s*to)[:\s]*([^\n]+)/i);
  if (checkPayM) fields.checkPayableTo = checkPayM[1].trim();

  const changeM = text.match(/(?:change\s*due|change)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (changeM) fields.changeDue = parseAmount(changeM[1]);

  const cashGivenM = text.match(/(?:cash\s*(?:given|rendered|paid)|amount\s*tendered)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
  if (cashGivenM) fields.cashGiven = parseAmount(cashGivenM[1]);

  // ===== 9. Compliance =====
  const disclaimerKws = ['this is a computer generated', 'electronic', 'subject to', 'terms and conditions', 'conditions apply', 'interest will be', 'unauthorized', 'valid only if', 'void if'];
  for (const kw of disclaimerKws) {
    if (lowerText.includes(kw)) {
      const idx = lowerText.indexOf(kw);
      const start = Math.max(0, text.lastIndexOf('.', idx - 1) + 1);
      let end = text.indexOf('.', idx + kw.length + 50);
      if (end === -1) end = text.indexOf('\n', idx + kw.length + 50);
      if (end === -1) end = Math.min(idx + 200, text.length);
      if (end > start) {
        fields.legalDisclaimer = text.substring(start, end + 1).replace(/\n/g, ' ').trim();
        break;
      }
    }
  }

  const thankM = text.match(/(thank\s*(?:you|you\s*for|you\s*for\s*your)[^.!]*[.!])/i);
  if (thankM) fields.thankYouNote = thankM[1].trim();

  return fields;
}
// ===== PARSERS =====
function parseAmount(s) { if (!s) return null; try { return parseFloat(s.replace(/,/g, '')); } catch { return null; } }
function normDate(s) {
  if (!s) return '';
  const p = s.replace(/\//g, '-').split('-');
  if (p.length === 3) { let y = p[2].length === 2 ? '20' + p[2] : p[2]; let m = p[1].length === 1 ? '0' + p[1] : p[1]; let d = p[0].length === 1 ? '0' + p[0] : p[0]; return `${y}-${m}-${d}`; }
  return s;
}

const MONTHS = {
  january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
  jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
};

function parseBankStatementDate(s) {
  if (!s) return null;
  s = s.trim().replace(/^on\s+/i, '');
  const numMatch = s.match(/^(\d{1,2})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{2,4})$/);
  if (numMatch) {
    const d = parseInt(numMatch[1]), m = parseInt(numMatch[2]), y = numMatch[3].length === 2 ? '20' + numMatch[3] : numMatch[3];
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  const monMatch = s.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?$/);
  if (monMatch) {
    const d = monMatch[1].padStart(2,'0'), mNum = MONTHS[monMatch[2].toLowerCase()];
    if (!mNum) return null;
    const y = monMatch[3] ? (monMatch[3].length === 2 ? '20' + monMatch[3] : monMatch[3]) : '2024';
    return `${y}-${String(mNum).padStart(2,'0')}-${d}`;
  }
  const monMatch2 = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monMatch2) {
    const mNum = MONTHS[monMatch2[1].toLowerCase()];
    if (!mNum) return null;
    return `${monMatch2[3]}-${String(mNum).padStart(2,'0')}-${String(monMatch2[2]).padStart(2,'0')}`;
  }
  return null;
}

function parseBankStatement(text) {
  const recs = [];
  const lines = text.split('\n').map(l => l.replace(/\r/, '')).filter(Boolean);
  if (!text || lines.length === 0) return recs;

  let prevBalance = null;
  let inTable = false;
  let inferredYear = null;

  const yearM = text.match(/issue\s*date[:\s]*\d{1,2}\s+[A-Za-z]+\s+(\d{2,4})/i);
  if (yearM) inferredYear = yearM[1].length === 2 ? '20' + yearM[1] : yearM[1];
  if (!inferredYear) {
    const perM = text.match(/\b(20\d{2})\b/);
    if (perM) inferredYear = perM[1];
  }

  for (const line of lines) {
    const ll = line.toLowerCase();

    if (/^date\s+(?:description|details|paid|debit)/i.test(ll) || /^date\s+\S+\s+paid/i.test(ll)) {
      inTable = true; continue;
    }

    if (!inTable) continue;

    if (/closing\s*balance|total|page\s+\d+|iban|bic|telephone|registered|this\s+(is\s+)?a\s+sample|generated\s+by|not\s+valid|the\s+your/i.test(ll)) {
      const cb = line.match(/closing\s*balance[:\s$]*([\d,]+(?:\.\d{2})?)/i);
      if (cb && recs.length > 0) recs[recs.length - 1].closingBalance = parseAmount(cb[1]);
      break;
    }

    let dateMatch = line.match(/^([A-Za-z]+\s+\d{1,2},?\s+\d{4})/);
    if (!dateMatch) {
      const tabParts = line.split(/\t/).filter(Boolean);
      if (tabParts.length >= 2) {
        dateMatch = ['', tabParts[0]];
      } else {
        const wordDate = line.match(/^(\d{1,2}\s+[A-Za-z]+)/);
        if (wordDate) dateMatch = ['', wordDate[1]];
      }
    }

    if (!dateMatch) continue;

    const rawDateStr = dateMatch[1] || dateMatch[0];
    let date = parseBankStatementDate(rawDateStr);

    if (!date && inferredYear && rawDateStr) {
      date = parseBankStatementDate(rawDateStr + ' ' + inferredYear);
    }
    if (!date) continue;

    let afterDate;
    if (dateMatch.index === undefined) {
      const tabParts = line.split(/\t/).filter(Boolean);
      if (tabParts.length >= 2) {
        afterDate = tabParts.slice(1).join(' ').trim();
      } else {
        afterDate = line.substring(dateMatch[0].length).trim();
      }
    } else {
      afterDate = line.substring(dateMatch[0].length).trim();
    }

    if (!afterDate) continue;

    const dollarAmounts = [];
    const dollarRe = /\$\s*([\d,]+(?:\.\d{2})?)|([\d,]+\.\d{2})/g;
    let m; while ((m = dollarRe.exec(afterDate)) !== null) {
      const val = m[1] || m[2];
      const a = parseAmount(val);
      if (a !== null && a > 0) dollarAmounts.push(a);
    }
    if (dollarAmounts.length === 0) continue;

    const balance = dollarAmounts[dollarAmounts.length - 1];

    const descMatch = afterDate.match(/^(.+?)\s*\$?\s*[\d,]+(?:\.\d{2})/);
    let desc = descMatch ? descMatch[1].trim() : '';
    if (/brought\s*forward/i.test(desc)) desc = 'Opening Balance';
    if (!desc) desc = 'Transaction';

    let debit = null, credit = null;

    if (dollarAmounts.length === 1) {
      if (/opening/i.test(desc)) desc = 'Opening Balance';
    } else if (dollarAmounts.length === 2) {
      const amt = dollarAmounts[0];
      if (prevBalance !== null) {
        const diff = balance - prevBalance;
        if (Math.abs(diff - amt) < 0.01) credit = amt;
        else debit = amt;
      } else { credit = amt; }
    } else {
      const first = dollarAmounts[0], second = dollarAmounts[1];
      if (prevBalance !== null) {
        const diff = balance - prevBalance;
        if (Math.abs(diff - (second - first)) < 0.01) { debit = first; credit = second; }
        else if (Math.abs(diff - (first - second)) < 0.01) { credit = first; debit = second; }
        else if (diff > 0) { credit = first; debit = second; }
        else { debit = first; credit = second; }
      } else { debit = first; credit = second; }
    }

    recs.push({ date, description: desc, debit, credit, balance, type: 'bank_transaction' });
    if (balance !== null) prevBalance = balance;
  }

  return recs;
}
function parseInvoice(text) {
  const recs = [];
  if (!text) return recs;
  const fields = extractInvoiceFields(text);

  recs.push({
    date: fields.invoiceDate || '',
    description: `INVOICE ${fields.invoiceNumber || ''} - ${fields.company || ''}`,
    debit: fields.tax || null,
    credit: fields.total || null,
    balance: null,
    type: 'invoice_summary',
    docType: 'INVOICE'
  });

  if (fields.lineItems && fields.lineItems.length > 0) {
    for (const item of fields.lineItems) {
      recs.push({
        date: '',
        description: `[Qty ${item.qty}] ${item.description}`,
        debit: null,
        credit: item.amount || 0,
        balance: null,
        type: 'line_item'
      });
    }
  } else {
    for (const line of text.split('\n')) {
      const l = line.trim(); if (!l) continue;
      if (/item|description|product/i.test(l)) continue;
      if (/total|subtotal|tax|shipping|thank|make all|payable/i.test(l)) break;
      const im = l.match(/([A-Za-z][A-Za-z\s&.-]+?)\s+\$?\s*([\d,]+(?:\.\d{2})?)/);
      if (im) {
        const a = parseAmount(im[2]);
        if (a !== null && !/invoice|bill|date|account|phone|email/i.test(im[1])) {
          recs.push({ date: '', description: im[1].trim(), debit: null, credit: a, balance: null, type: 'line_item' });
        }
      }
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
  recs.push({ date: date ? normDate(date[1]) : '', description: `Receipt - ${merchant}`, debit: null, credit: total ? parseAmount(total) : null, balance: null, type: 'receipt_summary' });
  for (const l of lines) {
    if (l === merchant) continue; if (/total|change|cash|tax/i.test(l)) continue;
    const im = l.match(/([A-Za-z][A-Za-z0-9\s.]+?)\s+([\d,]+(?:\.\d{2})?)\s*$/);
    if (im) { const a = parseAmount(im[2]); if (a !== null && im[1].trim().length > 1) recs.push({ date: '', description: im[1].trim(), debit: null, credit: a, balance: null }); }
  }
  return recs;
}

function parseUnknown(text) {
  const recs = [];
  if (!text) return recs;
  for (const line of text.split('\n')) {
    const l = line.trim(); if (!l || l.length < 5) continue;
    if (/^(page|date|description|item|qty|quantity|unit|price|amount|total|subtotal|tax|vat|inv|bill|receipt|thank|balance|statement|account|period|opening|closing)/i.test(l)) continue;
    const amounts = []; let m; while ((m = /\$?([\d,]+(?:\.\d{2})?)/g.exec(l)) !== null) { try { const v = parseFloat(m[1].replace(/,/g, '')); if (v > 0) amounts.push(v); } catch {} }
    if (!amounts.length) continue;
    const dates = []; while ((m = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/g.exec(l)) !== null) { const p1 = parseInt(m[1]), p2 = parseInt(m[2]); if (p1 >= 1 && p1 <= 31 && p2 >= 1 && p2 <= 12) dates.push(m[0]); }
    const date = dates.length ? normDate(dates[0]) : '';
    let clean = l.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, '').replace(/\$?[\d,]+(?:\.\d{2})?/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) clean = 'Entry'; if (clean.length > 80) clean = clean.substring(0, 80).trim();
    const dl = clean.toLowerCase(); const isDebit = /debit|withdrawal|paid |purchase|payment|charge/.test(dl); const isCredit = /credit|deposit|refund|salary|interest|cash in/.test(dl);
    const r = { date, description: clean, debit: null, credit: null, balance: null, type: 'unknown' };
    if (amounts.length === 1) { if (isDebit) r.debit = amounts[0]; else r.credit = amounts[0]; }
    else if (amounts.length === 2) { if (isDebit) { r.debit = amounts[0]; r.balance = amounts[1]; } else if (isCredit) { r.credit = amounts[0]; r.balance = amounts[1]; } else { if (amounts[0] >= 1000) { r.credit = amounts[0]; r.balance = amounts[1]; } else { r.debit = amounts[0]; r.balance = amounts[1]; } } }
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
// ===== NORMALIZE =====
function normalize(docType, fileName, confidence, rawText, records, entities, fields) {
  const normRecs = records.map((r, i) => ({
    id: i + 1, date: r.date || '', description: r.description || '', type: r.type || '',
    debit: r.debit || 0, credit: r.credit || 0, balance: r.balance || 0
  }));
  const totalDebit = records.reduce((s, r) => s + (r.debit || 0), 0);
  const totalCredit = records.reduce((s, r) => s + (r.credit || 0), 0);
  const lastBal = records.filter(r => r.balance != null).length > 0 ? records.filter(r => r.balance != null).pop().balance : null;
  return {
    documentType: docType, fileName, extractionConfidence: confidence, rawText,
    entities, fields: fields || {},
    records: normRecs,
    summary: { totalDebit, totalCredit, netBalance: lastBal != null ? lastBal : totalCredit - totalDebit, recordCount: records.length }
  };
}

// ===== PDF EXTRACTION =====
async function extractPdf(filePath) {
  const { PDFParse } = pdfParse;
  const parser = new PDFParse({ url: filePath });
  const result = await parser.getText();
  return result.text || '';
}

async function ocrImage(imagePath) {
  const ppPath = await preprocessImage(imagePath);
  return new Promise((resolve, reject) => {
    const tessPath = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
    execFile(tessPath, [ppPath, 'stdout', '--psm', '4', '-l', 'eng', '--oem', '3'], { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (ppPath !== imagePath) fs.unlink(ppPath, () => {});
      if (err) return reject(new Error(`Tesseract failed: ${err.message}\n${stderr}`));
      resolve(stdout);
    });
  });
}

async function ocrPdfPages(pdfPath) {
  const tmpDir = path.join(UPLOAD_DIR, 'pdf_pages_' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    await new Promise((resolve, reject) => {
      execFile('pdftoppm.exe', ['-png', '-r', '300', pdfPath, path.join(tmpDir, 'page')], { maxBuffer: 100 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(`pdftoppm failed: ${err.message}`));
        resolve();
      });
    });
    const pages = fs.readdirSync(tmpDir).filter(f => /\.png$/i.test(f)).sort();
    if (pages.length === 0) return '';
    const texts = [];
    for (const page of pages) {
      try {
        const text = await ocrImage(path.join(tmpDir, page));
        if (text) texts.push(text);
      } catch {}
    }
    return texts.join('\n--- Page Break ---\n');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function extractText(filePath, ext) {
  const imgExts = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif'];
  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf8');
  } else if (ext === '.pdf') {
    try {
      const text = await extractPdf(filePath);
      if (text && text.trim().length > 20) return text;
    } catch {}
    return await ocrPdfPages(filePath);
  } else if (imgExts.includes(ext)) {
    return await ocrImage(filePath);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// ===== ROUTE: POST /api/process =====
app.post('/api/process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const rawText = await extractText(filePath, ext);
    if (!rawText || !rawText.trim()) {
      fs.unlink(filePath, () => {});
      return res.status(422).json({ success: false, error: 'Could not extract text from file' });
    }
    const classification = classify(rawText);
    const entities = extractEntities(rawText);
    const fields = extractAllFields(rawText, classification.type);
    const records = parseRecords(classification.type, rawText);
    const result = normalize(classification.type, req.file.originalname, classification.confidence, rawText, records, entities, fields);
    fs.unlink(filePath, () => {});
    res.json({ success: true, data: result });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== ROUTE: POST /api/export/excel =====
app.post('/api/export/excel', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.records) return res.status(400).json({ error: 'No data provided' });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PhoText-Pro';
    wb.created = new Date();

    const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } }, alignment: { wrapText: true, vertical: 'top' } };
    const sectionStyle = { font: { bold: true, color: { argb: 'FF2F5496' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } } };
    const dateFmt = 'yyyy-mm-dd';
    const moneyFmt = '$#,##0.00';

    // Sheet 1: Summary
    const ws1 = wb.addWorksheet('Summary');
    const fields = data.fields || {};
    const summary = data.summary || {};

    const sections = {
      'Document Info': ['documentType', 'fileName', 'extractionConfidence', 'languageDetected', 'currencyDetected', 'pageCount'],
      'Business/Vendor': ['businessName', 'taxId', 'taxRegId', 'address', 'phone', 'email', 'website', 'storeNumber', 'cashierName', 'terminalId'],
      'Customer': ['billToName', 'billToAddress', 'shipToName', 'shipToAddress', 'customerId', 'customerEmail', 'customerPhone'],
      'Financial Tracking': ['invoiceNumber', 'receiptNumber', 'ticketNumber', 'poNumber', 'orderNumber', 'quoteNumber', 'issueDate', 'dueDate', 'deliveryDate', 'paymentTerms'],
      'Bank Details': ['bankName', 'branchName', 'accountNumber', 'sortCode', 'routingNumber', 'iban', 'bic', 'swiftCode', 'accountHolder', 'statementPeriod', 'statementDate'],
      'Balances': ['openingBalance', 'closingBalance', 'availableBalance', 'totalAmount', 'subtotal', 'totalDiscount', 'shippingCost', 'taxAmount', 'taxRate', 'amountPaid', 'balanceDue', 'depositCollected'],
      'Payment': ['paymentMethod', 'cardType', 'last4Digits', 'authorizationCode', 'remitInstructions', 'checkPayableTo', 'changeDue', 'cashGiven'],
      'Summary': []
    };

    let row = 1;
    ws1.getRow(row).height = 25;
    const col1 = ws1.getColumn(1), col2 = ws1.getColumn(2);
    col1.width = 28; col2.width = 50;

    for (const [sectionName, fieldKeys] of Object.entries(sections)) {
      ws1.getCell(`A${row}`).value = sectionName;
      ws1.getCell(`A${row}`).style = sectionStyle;
      ws1.mergeCells(`A${row}:B${row}`);
      row++;

      if (sectionName === 'Summary') {
        const sumFields = [
          ['Record Count', summary.recordCount],
          ['Total Debit', summary.totalDebit],
          ['Total Credit', summary.totalCredit],
          ['Net Balance', summary.netBalance]
        ];
        for (const [label, val] of sumFields) {
          ws1.getCell(`A${row}`).value = label;
          ws1.getCell(`A${row}`).style = headerStyle;
          ws1.getCell(`B${row}`).value = val;
          if (['Total Debit', 'Total Credit', 'Net Balance'].includes(label)) {
            ws1.getCell(`B${row}`).numFmt = moneyFmt;
          }
          row++;
        }
        continue;
      }

      let hasAny = false;
      for (const key of fieldKeys) {
        if (fields[key] != null && fields[key] !== '') { hasAny = true; break; }
      }
      if (!hasAny) { row++; continue; }

      for (const key of fieldKeys) {
        const val = fields[key];
        if (val == null || val === '') continue;
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        ws1.getCell(`A${row}`).value = label;
        ws1.getCell(`A${row}`).style = headerStyle;
        const v = val;
        ws1.getCell(`B${row}`).value = v;
        if (typeof v === 'number' && (key.includes('alance') || key.includes('otal') || key.includes('Amount') || key.includes('Subtotal') || key.includes('Tax') || key.includes('Shipping') || key.includes('Discount') || key.includes('Paid') || key.includes('Due'))) {
          ws1.getCell(`B${row}`).numFmt = moneyFmt;
        }
        row++;
      }
      row++;
    }

    // Catch-all: other fields not in predefined sections
    const allSectionKeys = new Set(Object.values(sections).flat());
    const otherKeys = Object.keys(fields).filter(k => !allSectionKeys.has(k) && fields[k] != null && fields[k] !== '' && k !== 'lineItems' && k !== 'bankLineItems');
    if (otherKeys.length > 0) {
      ws1.getCell(`A${row}`).value = 'Other Fields';
      ws1.getCell(`A${row}`).style = sectionStyle;
      ws1.mergeCells(`A${row}:B${row}`);
      row++;
      for (const key of otherKeys) {
        const val = fields[key];
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        ws1.getCell(`A${row}`).value = label;
        ws1.getCell(`A${row}`).style = headerStyle;
        ws1.getCell(`B${row}`).value = Array.isArray(val) ? val.join('; ') : val;
        if (typeof val === 'number') ws1.getCell(`B${row}`).numFmt = moneyFmt;
        row++;
      }
      row++;
    }

    // Sheet 2: Transactions
    const ws2 = wb.addWorksheet('Transactions');
    ws2.columns = [
      { header: '#', key: 'id', width: 6 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'Description', key: 'description', width: 55 },
      { header: 'Debit', key: 'debit', width: 14 },
      { header: 'Credit', key: 'credit', width: 14 },
      { header: 'Balance', key: 'balance', width: 16 }
    ];
    const hRow2 = ws2.getRow(1);
    hRow2.height = 22;
    hRow2.eachCell(c => c.style = headerStyle);
    ws2.addTable({
      name: 'Transactions',
      ref: 'A1',
      headerRow: true,
      totalsRow: true,
      columns: [
        { name: '#', filterButton: false, totalsRowLabel: 'TOTALS' },
        { name: 'Date', filterButton: false },
        { name: 'Type', filterButton: false },
        { name: 'Description', filterButton: false },
        { name: 'Debit', filterButton: false, totalsRowFunction: 'sum' },
        { name: 'Credit', filterButton: false, totalsRowFunction: 'sum' },
        { name: 'Balance', filterButton: false }
      ],
      rows: data.records.map(r => [r.id, r.date, r.type, r.description, r.debit || 0, r.credit || 0, r.balance || 0]),
      style: { theme: 'TableStyleMedium2', showRowStripes: true }
    });
    const cc2 = ws2.getColumn(5);
    cc2.numFmt = moneyFmt;
    const cc3 = ws2.getColumn(6);
    cc3.numFmt = moneyFmt;
    const cc4 = ws2.getColumn(7);
    cc4.numFmt = moneyFmt;

    // Sheet 3: Extracted Fields (flat key-value)
    const ws3 = wb.addWorksheet('Extracted Fields');
    ws3.getColumn(1).width = 30; ws3.getColumn(2).width = 55;
    ws3.getCell('A1').value = 'Field';
    ws3.getCell('A1').style = headerStyle;
    ws3.getCell('B1').value = 'Value';
    ws3.getCell('B1').style = headerStyle;

    let r3 = 2;
    for (const [key, val] of Object.entries(fields)) {
      if (key === 'lineItems' || key === 'bankLineItems') continue;
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      ws3.getCell(`A${r3}`).value = label;
      const v = val;
      ws3.getCell(`B${r3}`).value = v != null ? (Array.isArray(v) ? v.join('; ') : v) : '';
      if (typeof v === 'number') ws3.getCell(`B${r3}`).numFmt = moneyFmt;
      r3++;
    }

    // Sheet 4: Raw Text
    const ws4 = wb.addWorksheet('Raw Text');
    ws4.getColumn(1).width = 120;
    ws4.getCell('A1').value = data.rawText || '';
    ws4.getCell('A1').style = { alignment: { wrapText: true, vertical: 'top' } };
    const rawLines = (data.rawText || '').split('\n').length;
    ws4.getRow(1).height = Math.max(15, Math.min(rawLines * 15, 30000));

    // Sheet 5: Entities
    const ws5 = wb.addWorksheet('Entities');
    ws5.getColumn(1).width = 24; ws5.getColumn(2).width = 55;
    ws5.getCell('A1').value = 'Type';
    ws5.getCell('A1').style = headerStyle;
    ws5.getCell('B1').value = 'Value';
    ws5.getCell('B1').style = headerStyle;
    if (data.entities && data.entities.length > 0) {
      data.entities.forEach((ent, i) => {
        ws5.getCell(`A${i + 2}`).value = ent.type;
        ws5.getCell(`B${i + 2}`).value = ent.value;
      });
    } else {
      ws5.getCell('A2').value = '(no entities extracted)';
    }

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${data.fileName || 'export'}.xlsx"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`PhoText-Pro server running on http://localhost:${PORT}`);
});
