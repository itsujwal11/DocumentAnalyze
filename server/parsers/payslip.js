const { BaseParser } = require('./base');
const { parseAmount, parseFlexDate } = require('../config');

class PayslipParser extends BaseParser {
  constructor(rawText) {
    super(rawText);
  }

  extract() {
    const text = this.rawText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lowerText = text.toLowerCase();

    const result = {
      employeeName: '',
      employeeId: '',
      employerName: '',
      payPeriod: '',
      payDate: '',
      earnings: [],
      deductions: [],
      grossPay: null,
      netPay: null,
      totalDeductions: null,
      ytdEarnings: null,
      ytdDeductions: null,
      ytdNetPay: null,
      taxWithholding: null,
      socialSecurity: null,
      medicare: null,
      retirement: null,
      insurance: null,
      detectedTables: [],
      payFrequency: '',
    };

    this._extractHeader(result, text, lines);
    this._extractEarnings(result, text, lines, lowerText);
    this._extractDeductions(result, text, lines, lowerText);
    this._extractTotals(result, text, lowerText);
    result.detectedTables = this.detectTableStructure(lines);
    this._validate(result);

    return result;
  }

  _extractHeader(result, text, lines) {
    const empName = text.match(/(?:employee\s*name|employee|name)[:\s]*([A-Za-z\s.]+?)(?:\n|$)/i);
    if (empName) result.employeeName = empName[1].trim();

    const empId = text.match(/(?:employee\s*(?:id|no|#|number)|ssn)[:\s]*([A-Z0-9-]+)/i);
    if (empId) result.employeeId = empId[1].trim();

    const employer = text.match(/(?:employer\s*name|company|payroll)\s*[:\s]*([A-Za-z\s.]+?)(?:\n|$)/i);
    if (employer) result.employerName = employer[1].trim();

    const period = text.match(/(?:pay\s*period|period\s*ending|for\s*period)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (period) result.payPeriod = period[1].trim();

    const payDate = text.match(/(?:pay\s*date|check\s*date|paid\s*on|payment\s*date)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (payDate) result.payDate = parseFlexDate(payDate[1].trim());

    const freq = text.match(/(?:pay\s*frequency|paid)\s*[:\s]*(weekly|bi.?weekly|semi.?monthly|monthly|annually)/i);
    if (freq) result.payFrequency = freq[1];
  }

  _extractEarnings(result, text, lines, lowerText) {
    const earnRe = /([A-Za-z\s]+?)\s+([\d,]+(?:\.\d{2})?)/g;
    let inEarnings = false;
    for (const line of lines) {
      const ll = line.toLowerCase();
      if (/earnings|income|gross|salary|wages|regular/i.test(ll) && !/deduction|ytd|net/i.test(ll)) {
        inEarnings = true;
        continue;
      }
      if (inEarnings) {
        if (/deductions|total|net\s*pay|ytd|tax/i.test(ll) && !/regular|overtime/i.test(ll)) break;
        const m = line.match(/^([A-Za-z\s&]+?)\s+([\d,]+(?:\.\d{2})?)/);
        if (m) {
          const desc = m[1].trim();
          const val = parseAmount(m[2]);
          if (desc.length > 1 && val !== null && val < 1000000) {
            result.earnings.push({ description: desc, amount: val });
          }
        }
      }
    }

    if (result.earnings.length === 0) {
      const tableStart = this._findSection(lines, ['earnings', 'income', 'salary', 'wages', 'regular']);
      if (tableStart >= 0) {
        for (let i = tableStart + 1; i < lines.length; i++) {
          const l = lines[i];
          if (/deductions|total|net\s*pay|ytd|tax|benefits/i.test(l)) break;
          const parts = l.split(/\s{2,}|\t/).filter(Boolean);
          if (parts.length >= 2) {
            const amt = parseAmount(parts[parts.length - 1]);
            const desc = parts.slice(0, -1).join(' ');
            if (desc.length > 1 && amt !== null) {
              result.earnings.push({ description: desc, amount: amt });
            }
          }
        }
      }
    }
  }

  _extractDeductions(result, text, lines, lowerText) {
    let inDeductions = false;
    for (const line of lines) {
      const ll = line.toLowerCase();
      if (/deductions|withholdings|before.tax|after.tax/i.test(ll)) {
        inDeductions = true;
        continue;
      }
      if (inDeductions) {
        if (/total|net\s*pay|ytd|gross/i.test(ll) && !/deduction/i.test(ll)) break;
        const m = line.match(/^([A-Za-z\s&]+?)\s+([\d,]+(?:\.\d{2})?)/);
        if (m) {
          const desc = m[1].trim();
          const val = parseAmount(m[2]);
          if (desc.length > 1 && val !== null && val < 1000000) {
            result.deductions.push({ description: desc, amount: val });
            if (/federal|income\s*tax|withholding/i.test(desc)) result.taxWithholding = val;
            if (/social|security|ss/i.test(desc) && !/medicare/i.test(desc)) result.socialSecurity = val;
            if (/medicare/i.test(desc)) result.medicare = val;
            if (/retirement|401k|pension|super/i.test(desc)) result.retirement = val;
            if (/insurance|health|dental|vision|life/i.test(desc)) result.insurance = val;
          }
        }
      }
    }
  }

  _findSection(lines, keywords) {
    for (let i = 0; i < lines.length; i++) {
      const ll = lines[i].toLowerCase();
      if (keywords.some(kw => ll.includes(kw))) return i;
    }
    return -1;
  }

  _extractTotals(result, text, lowerText) {
    const gross = text.match(/(?:gross\s*pay|gross\s*salary|gross\s*earnings|total\s*earnings)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (gross) result.grossPay = parseAmount(gross[1]);

    const totalDed = text.match(/(?:total\s*deductions|deductions\s*total)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (totalDed) result.totalDeductions = parseAmount(totalDed[1]);

    const net = text.match(/(?:net\s*pay|net\s*salary|net\s*amount|take\s*home|total\s*net)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (net) result.netPay = parseAmount(net[1]);

    const ytdEarn = text.match(/(?:ytd\s*earnings|year.to.date\s*earnings|ytd\s*gross)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (ytdEarn) result.ytdEarnings = parseAmount(ytdEarn[1]);

    const ytdDed = text.match(/(?:ytd\s*deductions|year.to.date\s*deductions)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (ytdDed) result.ytdDeductions = parseAmount(ytdDed[1]);

    const ytdNet = text.match(/(?:ytd\s*net|year.to.date\s*net)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (ytdNet) result.ytdNetPay = parseAmount(ytdNet[1]);

    if (result.grossPay === null && result.earnings.length > 0) {
      result.grossPay = result.earnings.reduce((s, e) => s + (e.amount || 0), 0);
    }
    if (result.totalDeductions === null && result.deductions.length > 0) {
      result.totalDeductions = result.deductions.reduce((s, d) => s + (d.amount || 0), 0);
    }
    if (result.netPay === null && result.grossPay !== null && result.totalDeductions !== null) {
      result.netPay = result.grossPay - result.totalDeductions;
    }
  }

  _getValidationChecks(result) {
    return [
      { key: 'employeeName', weight: 20, test: result.employeeName && result.employeeName.length > 2 },
      { key: 'grossPay', weight: 20, test: result.grossPay !== null && result.grossPay > 0 },
      { key: 'netPay', weight: 20, test: result.netPay !== null && result.netPay > 0 },
      { key: 'employerName', weight: 15, test: result.employerName && result.employerName.length > 2 },
      { key: 'payDate', weight: 15, test: !!result.payDate },
      { key: 'deductions', weight: 10, test: result.deductions.length > 0 },
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
        'Employee Name': result.employeeName,
        'Employee ID': result.employeeId,
        'Employer Name': result.employerName,
        'Pay Period': result.payPeriod,
        'Pay Date': result.payDate,
        'Pay Frequency': result.payFrequency,
        'Gross Pay': result.grossPay,
        'Total Deductions': result.totalDeductions,
        'Net Pay': result.netPay,
        'Tax Withholding': result.taxWithholding,
        'Social Security': result.socialSecurity,
        'Medicare': result.medicare,
        'Retirement': result.retirement,
        'Insurance': result.insurance,
        'YTD Earnings': result.ytdEarnings,
        'YTD Deductions': result.ytdDeductions,
        'YTD Net Pay': result.ytdNetPay,
      },
      earnings: result.earnings.map((e, i) => ({ '#': i + 1, 'Description': e.description, 'Amount': e.amount })),
      deductions: result.deductions.map((d, i) => ({ '#': i + 1, 'Description': d.description, 'Amount': d.amount })),
      tables: result.detectedTables,
    };
  }
}

module.exports = { PayslipParser };