const ExcelJS = require('exceljs');

const CS = 'FF2F5496', CL = 'FFD6E4F0', CW = 'FFFFFFFF';
const hdr = { font: { bold: true, color: { argb: CW }, size: 11 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CS } }, alignment: { wrapText: true, vertical: 'top' }, border: { top: { style: 'thin', color: { argb: 'FF4472C4' } }, bottom: { style: 'thin', color: { argb: 'FF4472C4' } }, left: { style: 'thin', color: { argb: 'FF4472C4' } }, right: { style: 'thin', color: { argb: 'FF4472C4' } } } };
const secS = { font: { bold: true, color: { argb: CS }, size: 11 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CL } }, border: { top: { style: 'medium', color: { argb: CS } }, bottom: { style: 'medium', color: { argb: CS } }, left: { style: 'thin', color: { argb: CS } }, right: { style: 'thin', color: { argb: CS } } } };
const valR = { font: { size: 11 }, alignment: { wrapText: true, vertical: 'top' }, border: { top: { style: 'thin', color: { argb: 'FFD9D9D9' } }, bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } }, left: { style: 'thin', color: { argb: 'FFD9D9D9' } }, right: { style: 'thin', color: { argb: 'FFD9D9D9' } } } };
const valA = { ...valR, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } } };
const valTax = { font: { bold: true, size: 11, color: { argb: 'FFC6594C' } }, alignment: { wrapText: true, vertical: 'top' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } } };
const valSum = { font: { bold: true, size: 11 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }, border: { top: { style: 'medium', color: { argb: 'FF548235' } }, bottom: { style: 'medium', color: { argb: 'FF548235' } }, left: { style: 'thin', color: { argb: 'FF548235' } }, right: { style: 'thin', color: { argb: 'FF548235' } } } };
const moneyFmt = '$#,##0.00';

const sections = [
  ['Document Info', ['documentType', 'fileName', 'extractionConfidence', 'languageDetected', 'currencyDetected', 'pageCount', 'validationStatus', 'lineCount']],
  ['Invoice Details', ['invoiceNumber', 'invoiceDate', 'dueDate', 'paymentTerms', 'orderNumber', 'issueDate', 'quoteNumber']],
  ['Vendor / Business', ['businessName', 'vendorName', 'vendorAddress', 'vendorEmail', 'vendorPhone', 'merchant', 'merchantAddress', 'storeNumber', 'cashierName', 'terminalId', 'taxId', 'taxRegId', 'address', 'phone', 'email', 'website']],
  ['Customer / Bill To', ['customerName', 'customerAddress', 'customerEmail', 'customerPhone', 'customerId', 'billToName', 'billToAddress', 'shipToName', 'shipToAddress']],
  ['Bank Details', ['bankName', 'bankAddress', 'branchName', 'accountHolder', 'accountNumber', 'sortCode', 'routingNumber', 'iban', 'bic', 'swiftCode', 'statementPeriod', 'statementDate']],
  ['Financial Summary', ['totalAmount', 'subtotal', 'taxAmount', 'taxRate', 'totalDiscount', 'shippingCost', 'amountPaid', 'balanceDue', 'depositCollected', 'openingBalance', 'closingBalance', 'availableBalance', 'totalAmountDue', 'currentCharges', 'previousBalance', 'payments']],
  ['Payment', ['paymentMethod', 'cardType', 'last4Digits', 'authorizationCode', 'remitInstructions', 'checkPayableTo', 'changeDue', 'cashGiven']],
  ['Utility / Service', ['utilityName', 'serviceAddress', 'serviceType', 'billingPeriod']],
  ['Employee / Payslip', ['employeeName', 'employeeId', 'employerName', 'payPeriod', 'payDate', 'payFrequency', 'grossPay', 'netPay', 'totalDeductions', 'taxWithholding', 'socialSecurity', 'medicare', 'retirement', 'insurance', 'ytdEarnings', 'ytdDeductions', 'ytdNetPay']],
  ['Contract', ['contractTitle', 'documentId', 'parties', 'effectiveDate', 'expirationDate', 'contractValue', 'governingLaw', 'jurisdiction']],
  ['Tax Document', ['taxFormType', 'taxYear', 'taxpayerName', 'taxpayerId', 'filingStatus', 'wages', 'federalWithholding', 'socialSecurityWages', 'socialSecurityTax', 'medicareWages', 'medicareTax', 'stateWages', 'stateTax', 'localWages', 'localTax', 'adjustedGrossIncome', 'totalIncome', 'totalTax', 'refundOrOwed']],
  ['Shipping', ['carrier', 'trackingNumber', 'referenceNumber', 'shipper', 'consignee', 'origin', 'destination', 'shipDate', 'deliveryDate', 'weight', 'weightUnit', 'packages', 'serviceType', 'declaredValue', 'freightCharge']],
  ['Purchase Order', ['poNumber', 'orderDate', 'requester', 'buyer', 'deliveryMethod']],
  ['Report', ['reportTitle', 'reportDate', 'period', 'preparedBy', 'sectionsFound', 'keyFigureCount']],
];

const moneyFields = new Set(['totalAmount', 'subtotal', 'taxAmount', 'totalDiscount', 'shippingCost', 'amountPaid', 'balanceDue', 'depositCollected', 'openingBalance', 'closingBalance', 'availableBalance', 'totalAmountDue', 'currentCharges', 'previousBalance', 'payments', 'grossPay', 'netPay', 'totalDeductions', 'taxWithholding', 'socialSecurity', 'medicare', 'retirement', 'insurance', 'ytdEarnings', 'ytdDeductions', 'ytdNetPay', 'contractValue', 'wages', 'federalWithholding', 'socialSecurityWages', 'socialSecurityTax', 'medicareWages', 'medicareTax', 'stateWages', 'stateTax', 'localWages', 'localTax', 'adjustedGrossIncome', 'totalIncome', 'totalTax', 'refundOrOwed', 'declaredValue', 'freightCharge', 'totalDebit', 'totalCredit', 'netBalance']);

function setVal(cell, v, key) {
  if (v == null) return cell.value = '';
  if (typeof v === 'boolean') return cell.value = v;
  if (typeof v === 'number') {
    cell.value = v;
    if (moneyFields.has(key)) cell.numFmt = moneyFmt;
    return;
  }
  if (Array.isArray(v)) {
    cell.value = v.map(item => {
      if (typeof item === 'object' && item !== null) return Object.entries(item).filter(([k2]) => k2 !== 'id').map(([k3, v2]) => `${k3}: ${v2 ?? ''}`).join(', ');
      return String(item);
    }).join(' | ');
    return;
  }
  if (typeof v === 'object') cell.value = JSON.stringify(v);
  else cell.value = String(v);
}

function addRow(ws, r, label, value, key, alt) {
  ws.getCell(`A${r}`).value = label;
  ws.getCell(`A${r}`).style = alt ? valA : valR;
  setVal(ws.getCell(`B${r}`), value, key);
  ws.getCell(`B${r}`).style = alt ? valA : valR;
}

function buildFieldsSheet(ws, fields, doc) {
  ws.pageSetup = { orientation: 'portrait', fitToPage: true, margins: { top: 0.5, bottom: 0.5, left: 0.3, right: 0.3 } };
  ws.getColumn(1).width = 36; ws.getColumn(2).width = 65;
  ws.getRow(1).height = 28;
  ws.getCell('A1').value = 'Field'; ws.getCell('A1').style = hdr;
  ws.getCell('B1').value = 'Value'; ws.getCell('B1').style = hdr;

  let r = 2, alt = false;
  const shown = new Set();

  for (const [sn, fks] of sections) {
    const pairs = fks.map(k => [k, fields[k]]).filter(([k, v]) => v != null && v !== '');
    if (pairs.length === 0) continue;
    ws.getCell(`A${r}`).value = sn; ws.getCell(`A${r}`).style = secS;
    ws.mergeCells(`A${r}:B${r}`); ws.getRow(r).height = 22; r++;
    for (const [k, v] of pairs) {
      if (shown.has(k)) continue;
      shown.add(k);
      addRow(ws, r, k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(), v, k, alt);
      alt = !alt; r++;
    }
  }

  const allKeys = Object.keys(fields).filter(k => fields[k] != null && fields[k] !== '');
  const unshown = allKeys.filter(k => !shown.has(k));
  if (unshown.length > 0) {
    ws.getCell(`A${r}`).value = 'Additional Fields'; ws.getCell(`A${r}`).style = secS;
    ws.mergeCells(`A${r}:B${r}`); ws.getRow(r).height = 22; r++;
    for (const k of unshown) {
      shown.add(k);
      addRow(ws, r, k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(), fields[k], k, alt);
      alt = !alt; r++;
    }
  }

  ws.getCell(`A${r}`).value = 'Financial Summary'; ws.getCell(`A${r}`).style = secS;
  ws.mergeCells(`A${r}:B${r}`); r++;
  const sumRows = [['Record Count', 'recordCount'], ['Total Debit', 'totalDebit'], ['Total Credit', 'totalCredit'], ['Net Balance', 'netBalance']];
  for (const [l, k] of sumRows) {
    addRow(ws, r, l, doc.summary?.[k], k, alt);
    alt = !alt; r++;
  }
  ws.getColumn(1).width = 36; ws.getColumn(2).width = 65;
}

function detectRecCols(records) {
  const cols = [];
  cols.push({ key: 'id', header: '#', width: 5 });
  if (records.some(r => r.date)) cols.push({ key: 'date', header: 'Date', width: 14 });
  if (records.some(r => r.description)) cols.push({ key: 'description', header: 'Description', width: 50 });
  if (records.some(r => r.type)) cols.push({ key: 'type', header: 'Type', width: 16 });
  if (records.some(r => r.qty != null)) cols.push({ key: 'qty', header: 'Qty', width: 8 });
  if (records.some(r => r.rate != null)) cols.push({ key: 'rate', header: 'Rate', width: 14, fmt: 'money' });
  if (records.some(r => r.amount != null)) cols.push({ key: 'amount', header: 'Amount', width: 14, fmt: 'money' });
  if (records.some(r => r.debit != null)) cols.push({ key: 'debit', header: 'Debit', width: 14, fmt: 'money' });
  if (records.some(r => r.credit != null)) cols.push({ key: 'credit', header: 'Credit', width: 14, fmt: 'money' });
  if (records.some(r => r.balance != null)) cols.push({ key: 'balance', header: 'Balance', width: 16, fmt: 'money' });
  return cols;
}

function addTable(ws, records, columns, name) {
  if (!records || records.length === 0) {
    ws.getCell('A1').value = 'No data available';
    ws.getCell('A1').font = { italic: true, color: { argb: 'FF808080' } };
    return;
  }
  ws.properties.defaultColWidth = 12;
  ws.getRow(1).height = 24;
  ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width || 14 }));
  ws.getRow(1).eachCell(c => c.style = hdr);
  ws.addTable({
    name: name || 'Table', ref: 'A1', headerRow: true, totalsRow: false,
    columns: columns.map(c => ({ name: c.header, filterButton: false })),
    rows: records.map(r => columns.map(c => r[c.key] ?? '')),
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
  });
}

function addEntitiesSheet(ws, entities) {
  ws.pageSetup = { orientation: 'portrait', fitToPage: true, margins: { top: 0.5, bottom: 0.5, left: 0.3, right: 0.3 } };
  ws.getColumn(1).width = 28; ws.getColumn(2).width = 55;
  ws.getRow(1).height = 24;
  ws.getCell('A1').value = 'Type'; ws.getCell('A1').style = hdr;
  ws.getCell('B1').value = 'Value'; ws.getCell('B1').style = hdr;
  if (!entities || entities.length === 0) {
    ws.getCell('A2').value = '(no entities extracted)';
    ws.getCell('A2').font = { italic: true, color: { argb: 'FF808080' } };
    return;
  }
  let alt = false;
  entities.forEach((ent, i) => {
    const r = i + 2;
    ws.getCell(`A${r}`).value = ent.type;
    ws.getCell(`A${r}`).style = alt ? valA : valR;
    ws.getCell(`B${r}`).value = ent.value;
    ws.getCell(`B${r}`).style = alt ? valA : valR;
    alt = !alt;
  });
}

function addRawTextSheet(ws, doc) {
  ws.pageSetup = { orientation: 'portrait', margins: { top: 0.3, bottom: 0.3, left: 0.3, right: 0.3 } };
  ws.getColumn(1).width = 120;
  ws.getRow(1).height = 30;
  ws.getCell('A1').value = 'Raw OCR Text  —  ' + (doc.fileName || 'unknown');
  ws.getCell('A1').font = { bold: true, size: 12, color: { argb: CW } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('A2').value = doc.rawText || '(no text extracted)';
  ws.getCell('A2').style = { alignment: { wrapText: true, vertical: 'top' }, font: { name: 'Consolas', size: 10 } };
}

function addDetectedTablesSheets(wb, fields, namePrefix) {
  const tables = fields.detectedTables || [];
  tables.forEach((table, ti) => {
    if (!table.rows || !table.headers || table.rows.length === 0) return;
    const ws = wb.addWorksheet(`${namePrefix}Table ${ti + 1}`);
    const cols = table.headers.map((h, ci) => ({
      key: `col${ci}`, header: h,
      width: Math.max(12, Math.min(40, h.length + 5)),
      fmt: /amount|price|total|cost|value|debit|credit|balance|tax|kwh|usage/i.test(h) ? 'money' : undefined,
    }));
    cols.unshift({ key: 'id', header: '#', width: 5 });
    const rows = table.rows.map((row, ri) => {
      const obj = { id: ri + 1 };
      table.headers.forEach((h, ci) => { obj[`col${ci}`] = row[ci] || ''; });
      return obj;
    });
    addTable(ws, rows, cols, `Table${ti + 1}`);
  });
}

async function generateExcel(docs) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PhoText-Pro';
  wb.created = new Date();

  docs.forEach((doc, di) => {
    const pfx = docs.length > 1 ? `Doc${di + 1} - ` : '';
    const fields = doc.fields || {};
    const summary = doc.summary || {};
    const docType = (doc.documentType || '').toUpperCase();

    switch (docType) {
      case 'INVOICE': {
        const ws = wb.addWorksheet(pfx + 'Invoice Summary');
        buildFieldsSheet(ws, fields, doc);
        if (fields.lineItems && fields.lineItems.length > 0) {
          const ws2 = wb.addWorksheet(pfx + 'Line Items');
          const cols = [{ key: 'id', header: '#', width: 5 }, { key: 'item', header: 'Item', width: 20 }, { key: 'description', header: 'Description', width: 40 }, { key: 'qty', header: 'Qty', width: 8 }, { key: 'rate', header: 'Rate', width: 14, fmt: 'money' }, { key: 'amount', header: 'Amount', width: 14, fmt: 'money' }];
          const rows = fields.lineItems.map((item, i) => ({ id: i + 1, item: item.item || item.description || '', description: item.description || '', qty: item.qty || 1, rate: item.rate || item.unitPrice || 0, amount: item.amount || item.total || 0 }));
          addTable(ws2, rows, cols, 'LineItems');
        }
        if (doc.records && doc.records.length > 0) {
          const ws3 = wb.addWorksheet(pfx + 'Records');
          addTable(ws3, doc.records, detectRecCols(doc.records), 'Records');
        }
        addDetectedTablesSheets(wb, fields, pfx);
        break;
      }
      case 'BANK_STATEMENT': {
        if (doc.records && doc.records.length > 0) {
          const ws = wb.addWorksheet(pfx + 'Transactions');
          addTable(ws, doc.records, detectRecCols(doc.records), 'Transactions');
        }
        const ws2 = wb.addWorksheet(pfx + 'Account Details');
        buildFieldsSheet(ws2, fields, doc);
        addDetectedTablesSheets(wb, fields, pfx);
        break;
      }
      case 'RECEIPT': {
        const ws = wb.addWorksheet(pfx + 'Receipt Summary');
        buildFieldsSheet(ws, fields, doc);
        if (fields.lineItems && fields.lineItems.length > 0) {
          const ws2 = wb.addWorksheet(pfx + 'Items');
          const cols = [{ key: 'id', header: '#', width: 5 }, { key: 'description', header: 'Description', width: 40 }, { key: 'qty', header: 'Qty', width: 8 }, { key: 'rate', header: 'Rate', width: 14, fmt: 'money' }, { key: 'amount', header: 'Amount', width: 14, fmt: 'money' }];
          const rows = fields.lineItems.map((item, i) => ({ id: i + 1, description: item.description || item.item || '', qty: item.qty || 1, rate: item.rate || item.unitPrice || 0, amount: item.amount || item.total || 0 }));
          addTable(ws2, rows, cols, 'Items');
        }
        addDetectedTablesSheets(wb, fields, pfx);
        break;
      }
      case 'UTILITY_BILL': {
        const ws = wb.addWorksheet(pfx + 'Utility Summary');
        buildFieldsSheet(ws, fields, doc);
        if (doc.records && doc.records.length > 0) {
          const ws2 = wb.addWorksheet(pfx + 'Usage Records');
          addTable(ws2, doc.records, detectRecCols(doc.records), 'Usage');
        }
        addDetectedTablesSheets(wb, fields, pfx);
        break;
      }
      case 'PAYSLIP': {
        const ws = wb.addWorksheet(pfx + 'Payslip Summary');
        buildFieldsSheet(ws, fields, doc);
        if (doc.records && doc.records.length > 0) {
          const ws2 = wb.addWorksheet(pfx + 'Pay Records');
          addTable(ws2, doc.records, detectRecCols(doc.records), 'PayRecords');
        }
        addDetectedTablesSheets(wb, fields, pfx);
        break;
      }
      case 'PURCHASE_ORDER': {
        const ws = wb.addWorksheet(pfx + 'PO Summary');
        buildFieldsSheet(ws, fields, doc);
        if (fields.lineItems && fields.lineItems.length > 0) {
          const ws2 = wb.addWorksheet(pfx + 'PO Items');
          const cols = [{ key: 'id', header: '#', width: 5 }, { key: 'item', header: 'Item', width: 20 }, { key: 'description', header: 'Description', width: 40 }, { key: 'qty', header: 'Qty', width: 8 }, { key: 'rate', header: 'Rate', width: 14, fmt: 'money' }, { key: 'amount', header: 'Total', width: 14, fmt: 'money' }];
          const rows = fields.lineItems.map((item, i) => ({ id: i + 1, item: item.item || item.description || '', description: item.description || '', qty: item.qty || 1, rate: item.rate || item.unitPrice || 0, amount: item.amount || item.total || 0 }));
          addTable(ws2, rows, cols, 'POItems');
        }
        addDetectedTablesSheets(wb, fields, pfx);
        break;
      }
      case 'CONTRACT': {
        const ws = wb.addWorksheet(pfx + 'Contract Summary');
        buildFieldsSheet(ws, fields, doc);
        if (doc.records && doc.records.length > 0) {
          const ws2 = wb.addWorksheet(pfx + 'Clauses');
          addTable(ws2, doc.records, detectRecCols(doc.records), 'Clauses');
        }
        addDetectedTablesSheets(wb, fields, pfx);
        break;
      }
      case 'TAX_DOCUMENT': {
        const ws = wb.addWorksheet(pfx + 'Tax Summary');
        buildFieldsSheet(ws, fields, doc);
        if (doc.records && doc.records.length > 0) {
          const ws2 = wb.addWorksheet(pfx + 'Tax Figures');
          addTable(ws2, doc.records, detectRecCols(doc.records), 'TaxFigures');
        }
        addDetectedTablesSheets(wb, fields, pfx);
        break;
      }
      case 'SHIPPING_DOCUMENT': {
        const ws = wb.addWorksheet(pfx + 'Shipping Details');
        buildFieldsSheet(ws, fields, doc);
        addDetectedTablesSheets(wb, fields, pfx);
        break;
      }
      case 'TABLE': {
        if (doc.records && doc.records.length > 0) {
          const ws = wb.addWorksheet(pfx + 'Table Data');
          addTable(ws, doc.records, detectRecCols(doc.records), 'TableData');
        }
        const ws2 = wb.addWorksheet(pfx + 'Table Summary');
        buildFieldsSheet(ws2, fields, doc);
        addDetectedTablesSheets(wb, fields, pfx);
        break;
      }
      case 'REPORT': {
        const ws = wb.addWorksheet(pfx + 'Report Summary');
        buildFieldsSheet(ws, fields, doc);
        if (doc.records && doc.records.length > 0) {
          const ws2 = wb.addWorksheet(pfx + 'Report Data');
          addTable(ws2, doc.records, detectRecCols(doc.records), 'ReportData');
        }
        addDetectedTablesSheets(wb, fields, pfx);
        break;
      }
      default: {
        const ws = wb.addWorksheet(pfx + 'Summary');
        buildFieldsSheet(ws, fields, doc);
        if (doc.records && doc.records.length > 0) {
          const ws2 = wb.addWorksheet(pfx + 'Records');
          addTable(ws2, doc.records, detectRecCols(doc.records), 'Records');
        }
        addDetectedTablesSheets(wb, fields, pfx);
        break;
      }
    }

    addEntitiesSheet(wb.addWorksheet(pfx + 'Entities'), doc.entities);
    addRawTextSheet(wb.addWorksheet(pfx + 'Raw Text'), doc);
  });

  return await wb.xlsx.writeBuffer();
}

module.exports = { generateExcel };