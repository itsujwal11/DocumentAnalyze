const { BaseParser } = require('./base');
const { STATE_ABBREVS, parseAmount, parseFlexDate } = require('../config');

class UtilityBillParser extends BaseParser {
  constructor(rawText) {
    super(rawText);
  }

  extract() {
    const text = this.rawText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lowerText = text.toLowerCase();

    const result = {
      customerName: '',
      customerAddress: '',
      accountNumber: '',
      serviceAddress: '',
      serviceType: '',
      billingPeriod: '',
      invoiceDate: '',
      dueDate: '',
      usage: [],
      currentCharges: null,
      previousBalance: null,
      payments: null,
      totalAmountDue: null,
      detectedTables: [],
      utilityName: '',
    };

    this._extractHeader(result, text, lines);
    this._extractUsage(result, text, lines, lowerText);
    this._extractFinancial(result, text, lowerText);
    result.detectedTables = this.detectTableStructure(lines);
    this._validate(result);

    return result;
  }

  _extractHeader(result, text, lines) {
    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const l = lines[i].trim();
      if (l && l.length > 3 && l.length < 60 && !/^\d/.test(l) &&
          !/account|bill|statement|date|page|total/i.test(l)) {
        const alphaRatio = (l.match(/[A-Za-z\s]/g) || []).length / l.length;
        if (alphaRatio > 0.6) { result.utilityName = l; break; }
      }
    }
    if (!result.utilityName) result.utilityName = lines[0] || '';

    const cust = text.match(/(?:customer\s*name|customer)[:\s]*([A-Za-z\s.]+?)(?:\n|$)/i);
    if (cust) result.customerName = cust[1].trim();

    const acct = text.match(/(?:account\s*(?:number|no|#))[:\s]*([A-Z0-9][-A-Z0-9]+)/i);
    if (acct) result.accountNumber = acct[1].trim();

    const serv = text.match(/(?:service\s*address|served\s*by|premises)[:\s]*([A-Za-z0-9\s,.-]+?)(?:\n|$)/i);
    if (serv) result.serviceAddress = serv[1].trim();

    const servType = text.match(/(?:service\s*type|electric|gas|water|sewer|trash)/i);
    if (servType) {
      const st = servType[0].toLowerCase();
      if (/electric|gas|water|sewer|trash/.test(st)) result.serviceType = servType[0];
    }

    const period = text.match(/(?:billing\s*period|service\s*period|bill\s*period|period)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (period) result.billingPeriod = period[1].trim();

    const invDate = text.match(/(?:invoice\s*date|bill\s*date|statement\s*date)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (invDate) result.invoiceDate = parseFlexDate(invDate[1].trim());

    const due = text.match(/(?:due\s*date|payment\s*due)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (due) result.dueDate = parseFlexDate(due[1].trim());
  }

  _extractUsage(result, text, lines, lowerText) {
    const usageRe = /([A-Za-z\s]+?)\s+([\d,]+(?:\.\d+)?)\s*(kWh|kW|gal|CCF|therms|m³|hcf|units)/gi;
    let m;
    while ((m = usageRe.exec(text)) !== null) {
      result.usage.push({
        description: m[1].trim(),
        value: parseFloat(m[2].replace(/,/g, '')),
        unit: m[3],
      });
    }

    if (result.usage.length === 0) {
      const tableStart = this._findTableStart(lines);
      if (tableStart >= 0) {
        for (let i = tableStart + 1; i < lines.length; i++) {
          const l = lines[i];
          if (/total|balance|amount\s*due|thank|payment/i.test(l)) break;
          const parts = l.split(/\s{2,}|\t/).filter(Boolean);
          if (parts.length >= 2) {
            const lastNum = parseAmount(parts[parts.length - 1]);
            const desc = parts.slice(0, -1).join(' ');
            if (desc.length > 1 && lastNum !== null) {
              result.usage.push({ description: desc, value: lastNum, unit: '' });
            }
          }
        }
      }
    }
  }

  _findTableStart(lines) {
    for (let i = 0; i < lines.length; i++) {
      const ll = lines[i].toLowerCase();
      if (/usage|charges|description|service|meter|reading/i.test(ll) &&
          (/\b(amount|cost|value|total|kwh|usage)\b/i.test(ll))) return i;
    }
    return -1;
  }

  _extractFinancial(result, text, lowerText) {
    const current = text.match(/(?:current\s*charges|new\s*charges|amount\s*for|total\s*charges)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (current) result.currentCharges = parseAmount(current[1]);

    const prev = text.match(/(?:previous\s*balance)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (prev) result.previousBalance = parseAmount(prev[1]);

    const payment = text.match(/(?:payment|credit)[\s:.$]*-?\s*([\d,]+(?:\.\d{2})?)/i);
    if (payment && !/previous|current|total|balance|due/i.test(payment[0])) result.payments = parseAmount(payment[1]);

    const total = text.match(/(?:total\s*amount\s*due|amount\s*due|total\s*due|balance)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (total) result.totalAmountDue = parseAmount(total[1]);

    if (!result.totalAmountDue) {
      const lines = text.split('\n');
      for (const l of lines) {
        if (/^(total|balance)[\s:.$]/i.test(l.trim())) {
          const m = l.match(/([\d,]+(?:\.\d{2})?)/);
          if (m) { result.totalAmountDue = parseAmount(m[1]); break; }
        }
      }
    }
  }

  _getValidationChecks(result) {
    return [
      { key: 'accountNumber', weight: 25, test: result.accountNumber && result.accountNumber.length > 3 },
      { key: 'totalAmountDue', weight: 25, test: result.totalAmountDue !== null },
      { key: 'customerName', weight: 15, test: result.customerName && result.customerName.length > 2 },
      { key: 'utilityName', weight: 15, test: result.utilityName && result.utilityName.length > 2 },
      { key: 'usage', weight: 10, test: result.usage.length > 0 },
      { key: 'billingPeriod', weight: 10, test: !!result.billingPeriod },
    ];
  }

  _validate(result) {
    const checks = this._getValidationChecks(result);
    this._runValidation(result, checks);
    this.result = result;
  }

  getExportData(result) {
    return {
      summary: {
        'Utility Name': result.utilityName,
        'Customer Name': result.customerName,
        'Account Number': result.accountNumber,
        'Service Address': result.serviceAddress,
        'Service Type': result.serviceType,
        'Billing Period': result.billingPeriod,
        'Invoice Date': result.invoiceDate,
        'Due Date': result.dueDate,
        'Current Charges': result.currentCharges,
        'Previous Balance': result.previousBalance,
        'Payments': result.payments,
        'Total Amount Due': result.totalAmountDue,
      },
      usage: result.usage.map((u, i) => ({
        '#': i + 1,
        'Description': u.description,
        'Value': u.value,
        'Unit': u.unit,
      })),
      tables: result.detectedTables,
    };
  }
}

module.exports = { UtilityBillParser };