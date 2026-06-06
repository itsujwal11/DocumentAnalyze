function esc(s) {
  const str = String(s == null ? '' : s);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function section(lines, title, headers, rows) {
  lines.push('');
  lines.push(`=== ${title} ===`);
  if (headers) lines.push(headers.map(h => esc(h)).join(','));
  if (rows) rows.forEach(r => lines.push(r.map(c => esc(c ?? '')).join(',')));
}

const sections = [
  ['DOCUMENT INFO', ['documentType', 'fileName', 'extractionConfidence', 'validationStatus', 'languageDetected', 'currencyDetected', 'pageCount', 'lineCount']],
  ['INVOICE DETAILS', ['invoiceNumber', 'invoiceDate', 'dueDate', 'paymentTerms', 'orderNumber', 'issueDate', 'quoteNumber']],
  ['VENDOR / BUSINESS', ['businessName', 'vendorName', 'vendorAddress', 'vendorEmail', 'vendorPhone', 'merchant', 'merchantAddress', 'storeNumber', 'cashierName', 'terminalId', 'taxId', 'taxRegId', 'address', 'phone', 'email', 'website']],
  ['CUSTOMER / BILL TO', ['customerName', 'customerAddress', 'customerEmail', 'customerPhone', 'customerId', 'billToName', 'billToAddress', 'shipToName', 'shipToAddress']],
  ['BANK DETAILS', ['bankName', 'bankAddress', 'branchName', 'accountHolder', 'accountNumber', 'sortCode', 'routingNumber', 'iban', 'bic', 'swiftCode', 'statementPeriod', 'statementDate']],
  ['FINANCIAL SUMMARY', ['totalAmount', 'subtotal', 'taxAmount', 'taxRate', 'totalDiscount', 'shippingCost', 'amountPaid', 'balanceDue', 'depositCollected', 'openingBalance', 'closingBalance', 'availableBalance', 'totalAmountDue', 'currentCharges', 'previousBalance', 'payments']],
  ['PAYMENT', ['paymentMethod', 'cardType', 'last4Digits', 'authorizationCode', 'remitInstructions', 'checkPayableTo', 'changeDue', 'cashGiven']],
  ['UTILITY / SERVICE', ['utilityName', 'serviceAddress', 'serviceType', 'billingPeriod']],
  ['EMPLOYEE / PAYSLIP', ['employeeName', 'employeeId', 'employerName', 'payPeriod', 'payDate', 'payFrequency', 'grossPay', 'netPay', 'totalDeductions', 'taxWithholding', 'socialSecurity', 'medicare', 'retirement', 'insurance', 'ytdEarnings', 'ytdDeductions', 'ytdNetPay']],
  ['CONTRACT', ['contractTitle', 'documentId', 'parties', 'effectiveDate', 'expirationDate', 'contractValue', 'governingLaw', 'jurisdiction']],
  ['TAX DOCUMENT', ['taxFormType', 'taxYear', 'taxpayerName', 'taxpayerId', 'filingStatus', 'wages', 'federalWithholding', 'socialSecurityWages', 'socialSecurityTax', 'medicareWages', 'medicareTax', 'stateWages', 'stateTax', 'localWages', 'localTax', 'adjustedGrossIncome', 'totalIncome', 'totalTax', 'refundOrOwed']],
  ['SHIPPING', ['carrier', 'trackingNumber', 'referenceNumber', 'shipper', 'consignee', 'origin', 'destination', 'shipDate', 'deliveryDate', 'weight', 'weightUnit', 'packages', 'serviceType', 'declaredValue', 'freightCharge']],
  ['PURCHASE ORDER', ['poNumber', 'orderDate', 'requester', 'buyer', 'deliveryMethod']],
  ['REPORT', ['reportTitle', 'reportDate', 'period', 'preparedBy', 'sectionsFound', 'keyFigureCount']],
];
const allSectionKeys = new Set(sections.flatMap(([, ks]) => ks));
const excludeKeys = new Set(['lineItems', 'detectedTables', 'entities', 'transactions', 'records', 'rawText']);

function fmtV(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(item => {
    if (typeof item === 'object' && item !== null) return Object.entries(item).filter(([k]) => k !== 'id').map(([k2, v2]) => `${k2}: ${v2 ?? ''}`).join(', ');
    return String(item);
  }).join(' | ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

async function generateCSV(docs) {
  const lines = [];

  for (let di = 0; di < docs.length; di++) {
    const doc = docs[di];
    const fields = doc.fields || {};
    const summary = doc.summary || {};

    if (docs.length > 1) lines.push(`DOCUMENT ${di + 1}: ${doc.fileName || 'unknown'}`, '');

    lines.push(`=== DOCUMENT SUMMARY ===`);
    lines.push(`Document Type,${esc(doc.documentType || '')}`);
    lines.push(`File Name,${esc(doc.fileName || '')}`);
    lines.push(`Confidence,${esc(doc.extractionConfidence != null ? doc.extractionConfidence.toFixed(1) + '%' : '')}`);
    lines.push(`Status,${esc(doc.extractionConfidence >= 70 ? 'verified' : 'needs review')}`);
    lines.push(`Record Count,${esc(summary.recordCount || 0)}`);
    lines.push(`Total Debit,${esc(summary.totalDebit != null ? summary.totalDebit : 0)}`);
    lines.push(`Total Credit,${esc(summary.totalCredit != null ? summary.totalCredit : 0)}`);
    lines.push(`Net Balance,${esc(summary.netBalance != null ? summary.netBalance : 0)}`);
    lines.push('');

    const shown = new Set();

    for (const [sn, fks] of sections) {
      const pairs = fks.map(k => [k, fields[k]]).filter(([k2, v]) => v != null && v !== '').filter(([k2]) => !shown.has(k2));
      if (pairs.length === 0 && !fks.some(k2 => shown.has(k2))) continue;
      lines.push(`--- ${sn} ---`);
      for (const [k, v] of pairs) {
        shown.add(k);
        lines.push(`${esc(k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim())},${esc(fmtV(v))}`);
      }
    }

    const extra = Object.keys(fields).filter(k => fields[k] != null && fields[k] !== '' && !shown.has(k) && !excludeKeys.has(k));
    if (extra.length > 0) {
      lines.push('--- ADDITIONAL FIELDS ---');
      for (const k of extra) {
        shown.add(k);
        lines.push(`${esc(k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim())},${esc(fmtV(fields[k]))}`);
      }
    }

    if (fields.lineItems && fields.lineItems.length > 0) {
      const hasItem = fields.lineItems.some(i => i.item);
      const hasQty = fields.lineItems.some(i => i.qty != null);
      const hasRate = fields.lineItems.some(i => i.rate != null || i.unitPrice != null);
      const headers = ['#', 'Description'];
      if (hasItem) headers.splice(1, 0, 'Item');
      if (hasQty) headers.push('Qty');
      if (hasRate) headers.push('Rate');
      headers.push('Amount');
      section(lines, 'LINE ITEMS', headers, fields.lineItems.map((item, i) => {
        const row = [i + 1, item.description || ''];
        if (hasItem) row.splice(1, 0, item.item || '');
        if (hasQty) row.push(item.qty ?? 1);
        if (hasRate) row.push(item.rate ?? item.unitPrice ?? 0);
        row.push(item.amount ?? item.total ?? 0);
        return row;
      }));
    }

    if (doc.records && doc.records.length > 0) {
      const cols = [{ key: 'id', label: '#' }, { key: 'date', label: 'Date' }, { key: 'description', label: 'Description' }, { key: 'type', label: 'Type' }];
      if (doc.records.some(r => r.qty != null)) cols.push({ key: 'qty', label: 'Qty' });
      if (doc.records.some(r => r.rate != null)) cols.push({ key: 'rate', label: 'Rate' });
      if (doc.records.some(r => r.amount != null)) cols.push({ key: 'amount', label: 'Amount' });
      if (doc.records.some(r => r.debit != null)) cols.push({ key: 'debit', label: 'Debit' });
      if (doc.records.some(r => r.credit != null)) cols.push({ key: 'credit', label: 'Credit' });
      if (doc.records.some(r => r.balance != null)) cols.push({ key: 'balance', label: 'Balance' });
      section(lines, 'RECORDS', cols.map(c => c.label), doc.records.map((r, i) => cols.map(c => (c.key === 'id' ? i + 1 : r[c.key]) ?? '')));
    }

    if (doc.entities && doc.entities.length > 0) {
      section(lines, 'ENTITIES', ['Type', 'Value'], doc.entities.map(e => [e.type, e.value]));
    }

    if (fields.detectedTables && fields.detectedTables.length > 0) {
      fields.detectedTables.forEach((table, ti) => {
        if (table.headers && table.rows) section(lines, `TABLE ${ti + 1}`, table.headers, table.rows.map(row => row.map(c => c || '')));
      });
    }

    if (doc.rawText) {
      section(lines, 'RAW TEXT', ['Line', 'Content'], doc.rawText.split('\n').map((l, i) => [i + 1, l]));
    }

    lines.push('', '');
  }

  return '\uFEFF' + lines.join('\r\n');
}

module.exports = { generateCSV };