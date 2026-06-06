const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const { UPLOAD_DIR, CONFIDENCE_THRESHOLD, parseAmount } = require('./server/config');
const { extractText, chunkText } = require('./server/ocr/index');
const { preprocessText } = require('./server/ocr/cleanup');
const { classify } = require('./server/classify');
const { InvoiceParser } = require('./server/parsers/invoice');
const { BankStatementParser } = require('./server/parsers/bank-statement');
const { ReceiptParser } = require('./server/parsers/receipt');
const { UtilityBillParser } = require('./server/parsers/utility-bill');
const { PayslipParser } = require('./server/parsers/payslip');
const { PurchaseOrderParser } = require('./server/parsers/purchase-order');
const { ContractParser } = require('./server/parsers/contract');
const { TaxDocumentParser } = require('./server/parsers/tax-document');
const { ShippingDocumentParser } = require('./server/parsers/shipping-document');
const { GenericReportParser } = require('./server/parsers/generic-report');
const { GenericTableParser, detectTables } = require('./server/parsers/table');
const { UnknownDocumentParser } = require('./server/parsers/unknown');
const { extractEntities } = require('./server/entity');
const { validateParserResult } = require('./server/validate');
const { normalize } = require('./server/normalize');
const { generateExcel } = require('./server/export/excel');
const { generateCSV } = require('./server/export/csv');

const app = express();
const PORT = 8080;
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, 'frontend', 'dist');
  app.use(express.static(frontendDist));
app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const ZIP_EXTS = ['.zip'];
const DOC_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.txt'];

const PARSER_MAP = {
  'INVOICE': InvoiceParser,
  'BANK_STATEMENT': BankStatementParser,
  'RECEIPT': ReceiptParser,
  'UTILITY_BILL': UtilityBillParser,
  'PAYSLIP': PayslipParser,
  'PURCHASE_ORDER': PurchaseOrderParser,
  'CONTRACT': ContractParser,
  'TAX_DOCUMENT': TaxDocumentParser,
  'SHIPPING_DOCUMENT': ShippingDocumentParser,
  'REPORT': GenericReportParser,
  'TABLE': GenericTableParser,
};

function getParser(docType, text) {
  const ParserClass = PARSER_MAP[docType];
  if (ParserClass) return new ParserClass(text);
  return new UnknownDocumentParser(text);
}

function buildFields(parser, docType, classification, rawText) {
  const fields = {};
  const parsed = parser.result || {};

  fields.documentType = docType;
  fields.extractionConfidence = parser.getConfidence ? parser.getConfidence() : classification.confidence;

  if (typeof preprocessText === 'function') {
    const cleaned = preprocessText(rawText);
    fields.languageDetected = _detectLanguage(cleaned);
    fields.currencyDetected = _detectCurrency(cleaned);
  }

  if (parsed.vendor && parsed.vendor.name) { fields.businessName = parsed.vendor.name; fields.vendorName = parsed.vendor.name; }
  if (parsed.vendor && parsed.vendor.address) fields.vendorAddress = parsed.vendor.address;
  if (parsed.vendor && parsed.vendor.email) fields.vendorEmail = parsed.vendor.email;
  if (parsed.vendor && parsed.vendor.phone) fields.vendorPhone = parsed.vendor.phone;
  if (parsed.merchant && !fields.businessName) fields.businessName = parsed.merchant;
  if (parsed.merchantAddress && !fields.vendorAddress) fields.vendorAddress = parsed.merchantAddress;
  if (parsed.date && !fields.invoiceDate && !fields.date) fields.date = parsed.date;
  if (parsed.receiptNumber) fields.receiptNumber = parsed.receiptNumber;
  if (parsed.ticketNumber) fields.ticketNumber = parsed.ticketNumber;
  if (parsed.storeNumber) fields.storeNumber = parsed.storeNumber;
  if (parsed.cashierName) fields.cashierName = parsed.cashierName;
  if (parsed.terminalId) fields.terminalId = parsed.terminalId;
  if (parsed.tax != null && fields.taxAmount == null) fields.taxAmount = parsed.tax;
  if (parsed.bankName) fields.bankName = parsed.bankName;
  if (parsed.accountHolder) fields.accountHolder = parsed.accountHolder;
  if (parsed.accountNumber) fields.accountNumber = parsed.accountNumber;
  if (parsed.statementPeriod) fields.statementPeriod = parsed.statementPeriod;
  if (parsed.invoiceNumber) fields.invoiceNumber = parsed.invoiceNumber;
  if (parsed.invoiceDate) fields.invoiceDate = parsed.invoiceDate;
  if (parsed.dueDate) fields.dueDate = parsed.dueDate;
  if (parsed.total != null) fields.totalAmount = parsed.total;
  if (parsed.subtotal != null) fields.subtotal = parsed.subtotal;
  if (parsed.taxAmount != null) fields.taxAmount = parsed.taxAmount;
  if (parsed.taxRate != null) fields.taxRate = parsed.taxRate;
  if (parsed.balanceDue != null) fields.balanceDue = parsed.balanceDue;
  if (parsed.openingBalance != null) fields.openingBalance = parsed.openingBalance;
  if (parsed.closingBalance != null) fields.closingBalance = parsed.closingBalance;
  if (parsed.paymentMethod) fields.paymentMethod = parsed.paymentMethod;
  if (parsed.changeDue != null) fields.changeDue = parsed.changeDue;
  if (parsed.sortCode) fields.sortCode = parsed.sortCode;
  if (parsed.iban) fields.iban = parsed.iban;
  if (parsed.bic) fields.bic = parsed.bic;
  if (parsed.terms) fields.paymentTerms = parsed.terms;
  if (parsed.poNumber) fields.poNumber = parsed.poNumber;
  if (parsed.terms || parsed.paymentTerms) fields.paymentTerms = parsed.terms || parsed.paymentTerms;

  if (parsed.utilityName) fields.businessName = parsed.utilityName;
  if (parsed.customerName) fields.customerName = parsed.customerName;
  if (parsed.serviceAddress) fields.serviceAddress = parsed.serviceAddress;
  if (parsed.billingPeriod) fields.billingPeriod = parsed.billingPeriod;
  if (parsed.totalAmountDue != null) fields.totalAmount = parsed.totalAmountDue;

  if (parsed.employeeName) fields.employeeName = parsed.employeeName;
  if (parsed.employerName) fields.businessName = parsed.employerName;
  if (parsed.grossPay != null) fields.grossPay = parsed.grossPay;
  if (parsed.netPay != null) fields.netPay = parsed.netPay;

  if (parsed.contractTitle) fields.contractTitle = parsed.contractTitle;
  if (parsed.effectiveDate) fields.effectiveDate = parsed.effectiveDate;
  if (parsed.expirationDate) fields.expirationDate = parsed.expirationDate;

  if (parsed.taxFormType) fields.taxFormType = parsed.taxFormType;
  if (parsed.taxYear) fields.taxYear = parsed.taxYear;
  if (parsed.taxpayerName) fields.taxpayerName = parsed.taxpayerName;

  if (parsed.carrier) fields.carrier = parsed.carrier;
  if (parsed.trackingNumber) fields.trackingNumber = parsed.trackingNumber;
  if (parsed.origin) fields.origin = parsed.origin;
  if (parsed.destination) fields.destination = parsed.destination;

  if (parsed.shipTo) {
    if (parsed.shipTo.name) fields.shipToName = parsed.shipTo.name;
    if (parsed.shipTo.address) fields.shipToAddress = parsed.shipTo.address;
  }
  if (parsed.billTo) {
    if (parsed.billTo.name) fields.billToName = parsed.billTo.name;
    if (parsed.billTo.address) fields.billToAddress = parsed.billTo.address;
  }

  if (parsed.customer) {
    if (parsed.customer.name) fields.customerName = parsed.customer.name;
    if (parsed.customer.address) fields.customerAddress = parsed.customer.address;
  }

  if (parsed.reportTitle) fields.reportTitle = parsed.reportTitle;

  if (parsed.items && parsed.items.length > 0) {
    fields.lineItems = parsed.items;
  }

  if (parsed.transactions && parsed.transactions.length > 0) {
    fields.transactions = parsed.transactions;
  }

  if (parsed.usage && parsed.usage.length > 0) {
    fields.lineItems = parsed.usage;
  }

  if (parsed.earnings && parsed.earnings.length > 0) {
    fields.lineItems = [...(fields.lineItems || []), ...parsed.earnings.map(e => ({ description: e.description, amount: e.amount }))];
  }

  if (parsed.deductions && parsed.deductions.length > 0) {
    fields.lineItems = [...(fields.lineItems || []), ...parsed.deductions.map(d => ({ description: 'Deduction: ' + d.description, amount: d.amount }))];
  }

  if (parsed.tables || parsed.detectedTables) {
    const tableSrc = parsed.tables || parsed.detectedTables || [];
    if (tableSrc.length > 0) {
      fields.detectedTables = tableSrc;
    } else {
      const { tables } = detectTables(rawText);
      if (tables.length > 0) fields.detectedTables = tables;
    }
  }

  if (parsed.entities) {
    fields.entities = parsed.entities;
  }

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (!fields.businessName) {
    for (let i = 0; i < Math.min(8, lines.length); i++) {
      const l = lines[i];
      if (l && l.length > 2 && l.length < 60 && !/^\d/.test(l) &&
          !/^(bill|ship|invoice|date|page|total|tax|amount|receipt|statement|account|rech)/i.test(l)) {
        const alphaRatio = (l.match(/[A-Za-z\s]/g) || []).length / l.length;
        if (alphaRatio > 0.6) { fields.businessName = l; break; }
      }
    }
    if (!fields.businessName) fields.businessName = lines[0] || '';
  }

  fields.extractionConfidence = parser.getConfidence ? parser.getConfidence() : classification.confidence;

  return fields;
}

function _detectLanguage(text) {
  if (/mwst|rechnung|bediente|tisch\s+\d|quittung/i.test(text)) return 'DE';
  if (/le\s+la\s+les|et\s+ou|nous\s+vous|veuillez/i.test(text)) return 'FR';
  if (/el\s+la\s+los|y\s+o|nuestro/i.test(text)) return 'ES';
  return 'EN';
}

function _detectCurrency(text) {
  if (/CHF|Fr\.?\b/i.test(text)) return 'CHF';
  if (/\$/.test(text)) return 'USD';
  if (/₹|Rs\.?\s/i.test(text)) return 'INR';
  if (/€/.test(text)) return 'EUR';
  if (/£/.test(text)) return 'GBP';
  if (/¥/.test(text)) return 'JPY';
  return 'USD';
}

function getRecords(parser, docType) {
  const parsed = parser.result || {};
  const records = [];

  switch (docType) {
    case 'INVOICE': {
      let runningBalance = 0;
      if (parsed.items && parsed.items.length > 0) {
        parsed.items.forEach(item => {
          const amount = item.amount || item.total || 0;
          runningBalance += amount;
          records.push({
            date: item.date || parsed.invoiceDate || '',
            description: (item.item || '') + ((item.item && item.description && item.item !== item.description) ? ' - ' + item.description : ''),
            qty: item.qty || 1,
            rate: item.rate || amount,
            amount: amount,
            debit: null,
            credit: amount,
            balance: runningBalance,
            type: 'invoice_item',
          });
        });
      }
      if (parsed.taxAmount != null && parsed.taxAmount > 0) {
        runningBalance += parsed.taxAmount;
        records.push({
          date: parsed.invoiceDate || '',
          description: 'Tax (' + (parsed.taxRate != null ? parsed.taxRate + '%' : '') + ') on Subtotal ($' + (parsed.subtotal || 0).toFixed(2) + ')',
          qty: null,
          rate: null,
          amount: parsed.taxAmount,
          debit: null,
          credit: parsed.taxAmount,
          balance: runningBalance,
          type: 'tax',
        });
      }
      if (parsed.total != null) {
        records.push({
          date: parsed.dueDate || parsed.invoiceDate || '',
          description: 'INVOICE TOTAL - ' + (parsed.invoiceNumber || ''),
          qty: null,
          rate: null,
          amount: parsed.total,
          debit: null,
          credit: parsed.total,
          balance: parsed.total,
          type: 'invoice_summary',
        });
      }
      break;
    }
    case 'BANK_STATEMENT': {
      if (parsed.transactions && parsed.transactions.length > 0) {
        parsed.transactions.forEach(txn => {
          records.push({
            date: txn.date || '',
            description: txn.description || 'Transaction',
            debit: txn.debit || null,
            credit: txn.credit || null,
            balance: txn.balance || null,
            type: txn.type || 'bank_transaction',
          });
        });
      }
      break;
    }
    case 'RECEIPT': {
      if (parsed.items && parsed.items.length > 0) {
        parsed.items.forEach(item => {
          records.push({
            date: parsed.date || '',
            description: item.description || 'Item',
            qty: item.qty || 1,
            rate: item.unitPrice || 0,
            amount: item.total || item.unitPrice || 0,
            debit: null,
            credit: item.total || item.unitPrice || 0,
            balance: null,
            type: 'receipt_item',
          });
        });
      }
      if (parsed.tax != null && parsed.tax > 0) {
        records.push({
          date: parsed.date || '',
          description: 'Tax' + (parsed.taxRate != null ? ' (' + parsed.taxRate + '%)' : ''),
          debit: null,
          credit: parsed.tax,
          balance: null,
          type: 'tax',
        });
      }
      if (parsed.total != null) {
        records.push({
          date: parsed.date || '',
          description: 'RECEIPT - ' + (parsed.merchant || ''),
          debit: null,
          credit: parsed.total,
          balance: parsed.changeDue != null ? parsed.total - parsed.changeDue : parsed.total,
          type: 'receipt_summary',
        });
      }
      break;
    }
    case 'UTILITY_BILL': {
      if (parsed.usage && parsed.usage.length > 0) {
        parsed.usage.forEach(u => {
          records.push({
            date: parsed.invoiceDate || '',
            description: u.description || 'Usage',
            qty: u.value || null,
            amount: u.value || null,
            debit: u.value || null,
            credit: null,
            balance: null,
            type: 'utility_usage',
          });
        });
      }
      if (parsed.totalAmountDue != null) {
        records.push({
          date: parsed.dueDate || parsed.invoiceDate || '',
          description: 'BALANCE DUE - ' + (parsed.utilityName || 'Utility'),
          debit: parsed.totalAmountDue,
          credit: null,
          balance: parsed.totalAmountDue,
          type: 'utility_summary',
        });
      }
      break;
    }
    case 'PAYSLIP': {
      if (parsed.earnings && parsed.earnings.length > 0) {
        parsed.earnings.forEach(e => {
          records.push({
            date: parsed.payDate || '',
            description: e.description || 'Earning',
            debit: null,
            credit: e.amount || 0,
            balance: null,
            amount: e.amount || 0,
            type: 'earning',
          });
        });
      }
      if (parsed.deductions && parsed.deductions.length > 0) {
        parsed.deductions.forEach(d => {
          records.push({
            date: parsed.payDate || '',
            description: d.description || 'Deduction',
            debit: d.amount || 0,
            credit: null,
            balance: null,
            amount: d.amount || 0,
            type: 'deduction',
          });
        });
      }
      if (parsed.netPay != null) {
        records.push({
          date: parsed.payDate || '',
          description: 'NET PAY - ' + (parsed.employeeName || ''),
          debit: null,
          credit: parsed.netPay,
          balance: parsed.netPay,
          amount: parsed.netPay,
          type: 'payslip_summary',
        });
      }
      break;
    }
    case 'PURCHASE_ORDER': {
      if (parsed.items && parsed.items.length > 0) {
        parsed.items.forEach(item => {
          records.push({
            date: parsed.orderDate || '',
            description: (item.item || '') + ' - ' + (item.description || item.item || ''),
            qty: item.qty || 1,
            rate: item.unitPrice || 0,
            amount: item.total || 0,
            debit: item.total || 0,
            credit: null,
            balance: null,
            type: 'po_item',
          });
        });
      }
      if (parsed.total != null) {
        records.push({
          date: parsed.orderDate || parsed.deliveryDate || '',
          description: 'PO TOTAL - ' + (parsed.poNumber || ''),
          debit: parsed.total,
          credit: null,
          balance: parsed.total,
          type: 'po_summary',
        });
      }
      break;
    }
    case 'CONTRACT': {
      if (parsed.clauses && parsed.clauses.length > 0) {
        parsed.clauses.forEach(c => {
          records.push({
            date: parsed.effectiveDate || '',
            description: 'Clause ' + (c.number || '') + ': ' + (c.text || ''),
            debit: null,
            credit: null,
            balance: null,
            type: 'clause',
          });
        });
      }
      if (parsed.contractValue != null) {
        records.push({
          date: parsed.effectiveDate || '',
          description: 'CONTRACT VALUE - ' + (parsed.contractTitle || ''),
          debit: parsed.contractValue,
          credit: null,
          balance: parsed.contractValue,
          type: 'contract_summary',
        });
      }
      break;
    }
    case 'TAX_DOCUMENT': {
      const taxItems = [
        { label: 'Wages', value: parsed.wages },
        { label: 'Federal Withholding', value: parsed.federalWithholding },
        { label: 'Social Security Wages', value: parsed.socialSecurityWages },
        { label: 'Social Security Tax', value: parsed.socialSecurityTax },
        { label: 'Medicare Wages', value: parsed.medicareWages },
        { label: 'Medicare Tax', value: parsed.medicareTax },
        { label: 'State Wages', value: parsed.stateWages },
        { label: 'State Tax', value: parsed.stateTax },
        { label: 'Local Wages', value: parsed.localWages },
        { label: 'Local Tax', value: parsed.localTax },
        { label: 'Adjusted Gross Income', value: parsed.adjustedGrossIncome },
        { label: 'Total Income', value: parsed.totalIncome },
        { label: 'Total Deductions', value: parsed.totalDeductions },
        { label: 'Taxable Income', value: parsed.taxableIncome },
        { label: 'Total Tax', value: parsed.totalTax },
      ].filter(item => item.value != null);
      taxItems.forEach(item => {
        records.push({
          date: parsed.taxYear || '',
          description: item.label,
          debit: null,
          credit: item.value,
          balance: null,
          amount: item.value,
          type: 'tax_figure',
        });
      });
      if (parsed.refundOrOwed != null) {
        records.push({
          date: parsed.taxYear || '',
          description: 'REFUND / AMOUNT OWED',
          debit: null,
          credit: parsed.refundOrOwed,
          balance: parsed.refundOrOwed,
          amount: parsed.refundOrOwed,
          type: 'tax_summary',
        });
      }
      break;
    }
    case 'SHIPPING_DOCUMENT': {
      if (parsed.trackingNumber) {
        records.push({
          date: parsed.shipDate || '',
          description: 'Tracking: ' + parsed.trackingNumber + ' - ' + (parsed.origin || '') + ' to ' + (parsed.destination || ''),
          debit: parsed.freightCharge || null,
          credit: null,
          balance: parsed.declaredValue || parsed.freightCharge || null,
          type: 'shipping_info',
        });
      }
      break;
    }
    case 'TABLE': {
      if (parsed.records && parsed.records.length > 0) {
        parsed.records.forEach(r => records.push(r));
      }
      break;
    }
    case 'REPORT': {
      if (parsed.records && parsed.records.length > 0) {
        parsed.records.forEach(r => records.push(r));
      }
      if (parsed.keyFigures && parsed.keyFigures.length > 0) {
        parsed.keyFigures.forEach(kf => {
          records.push({
            date: parsed.reportDate || '',
            description: kf.label || 'Key Figure',
            debit: null,
            credit: kf.value || 0,
            balance: null,
            type: 'key_figure',
          });
        });
      }
      break;
    }
    default: {
      if (parsed.records && parsed.records.length > 0) {
        parsed.records.forEach(r => records.push(r));
      }
      break;
    }
  }

  return records;
}

async function processSingleFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const rawText = await extractText(filePath, ext);
  if (!rawText || !rawText.trim()) {
    fs.unlink(filePath, () => {});
    return null;
  }

  const cleaned = preprocessText(rawText);
  const classification = classify(cleaned);
  const docType = classification.type;

  const parser = getParser(docType, cleaned);
  parser.extract();

  const validation = validateParserResult(parser, docType);
  const entities = extractEntities(rawText);
  const fields = buildFields(parser, docType, classification, rawText);
  const records = getRecords(parser, docType);

  fields.entities = entities;
  fields.validationStatus = validation.status;

  const confidence = parser.getConfidence ? parser.getConfidence() : classification.confidence;
  const result = normalize(docType, originalName, confidence, rawText, entities, fields, records);

  fs.unlink(filePath, () => {});
  return result;
}

app.post('/api/process', upload.any(), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const allResults = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (ext === '.zip') {
        const extractDir = path.join(UPLOAD_DIR, 'zip_' + Date.now());
        try {
          const zip = new AdmZip(file.path);
          zip.extractAllTo(extractDir, true);
          const extracted = fs.readdirSync(extractDir).filter(f => DOC_EXTS.includes(path.extname(f).toLowerCase()));
          for (const f of extracted) {
            const fp = path.join(extractDir, f);
            const result = await processSingleFile(fp, f);
            if (result) allResults.push(result);
          }
        } finally {
          fs.rmSync(extractDir, { recursive: true, force: true });
          fs.unlink(file.path, () => {});
        }
      } else if (DOC_EXTS.includes(ext)) {
        const result = await processSingleFile(file.path, file.originalname);
        if (result) allResults.push(result);
      } else {
        fs.unlink(file.path, () => {});
      }
    }

    if (allResults.length === 0) {
      return res.status(422).json({ success: false, error: 'Could not extract text from any file' });
    }

    if (allResults.length === 1) {
      res.json({ success: true, data: allResults[0] });
    } else {
      res.json({ success: true, data: { documents: allResults } });
    }
  } catch (err) {
    if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/export/excel', async (req, res) => {
  try {
    const data = req.body;
    const docs = data && data.documents ? data.documents : (data && data.records ? [data] : null);
    if (!docs || docs.length === 0) return res.status(400).json({ error: 'No data provided' });

    const buf = await generateExcel(docs);
    const firstName = docs[0].fileName || 'export';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${firstName}_${docs.length}docs.xlsx"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/export/csv', async (req, res) => {
  try {
    const data = req.body;
    const docs = data && data.documents ? data.documents : (data && data.records ? [data] : null);
    if (!docs || docs.length === 0) return res.status(400).json({ error: 'No data provided' });

    const csv = await generateCSV(docs);
    const firstName = docs[0].fileName || 'export';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${firstName}_${docs.length}docs.csv"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(csv);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ error: err.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`PhoText-Pro server running on http://localhost:${PORT}`);
});
server.timeout = 0;
process.on('uncaughtException', e => console.error('Uncaught:', e.message));
process.on('unhandledRejection', e => console.error('Unhandled:', e.message));