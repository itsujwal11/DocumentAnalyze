const { BaseParser } = require('./base');
const { parseAmount, parseFlexDate } = require('../config');

class GenericReportParser extends BaseParser {
  constructor(rawText) {
    super(rawText);
  }

  extract() {
    const text = this.rawText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lowerText = text.toLowerCase();

    const result = {
      reportTitle: '',
      reportDate: '',
      period: '',
      preparedBy: '',
      sections: [],
      keyFigures: [],
      detectedTables: [],
      entities: [],
      records: [],
    };

    this._extractGeneral(result, text, lines, lowerText);
    this._extractTablesAndRecords(result, text, lines);
    result.detectedTables = this.detectTableStructure(lines);
    this._validate(result);

    return result;
  }

  _extractGeneral(result, text, lines, lowerText) {
    const title = text.match(/^(?:report|summary|analysis|review|study)[^]{0,100}/im);
    if (title) result.reportTitle = title[0].trim();
    if (!result.reportTitle) {
      for (let i = 0; i < Math.min(4, lines.length); i++) {
        if (lines[i].length > 5 && lines[i].length < 80 && /[A-Z]/.test(lines[i][0])) {
          result.reportTitle = lines[i];
          break;
        }
      }
    }
    if (!result.reportTitle) result.reportTitle = lines[0] || '';

    const repDate = text.match(/(?:report\s*date|date\s*of\s*report|prepared\s*on|generated\s*on)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (repDate) result.reportDate = parseFlexDate(repDate[1].trim());

    const period = text.match(/(?:period|period\s*ending|period\s*covered|reporting\s*period)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (period) result.period = period[1].trim();

    const preparedBy = text.match(/(?:prepared\s*by|author|created\s*by|generated\s*by)[:\s]*([A-Za-z\s.]+?)(?:\n|$)/i);
    if (preparedBy) result.preparedBy = preparedBy[1].trim();

    const sectionRe = /^([A-Z][A-Za-z\s]{3,60})$/gm;
    let sm;
    while ((sm = sectionRe.exec(text)) !== null) {
      const s = sm[1].trim();
      if (s.length > 3 && s.length < 60 && !/^[A-Z\s]+$/.test(s) && !/^page|date/i.test(s)) {
        result.sections.push({ title: s });
      }
    }
  }

  _extractTablesAndRecords(result, text, lines) {
    const amountRe = /\$?([\d,]+(?:\.\d{2})?)/g;
    for (const line of lines) {
      if (line.length < 5) continue;
      if (/^(page|date|item|qty|quantity|unit|price|amount|total|subtotal|this|generated|the\s+your|not\s+valid|telephone|registered)/i.test(line)) continue;

      const amounts = [];
      let m;
      while ((m = amountRe.exec(line)) !== null) {
        const v = parseAmount(m[1]);
        if (v !== null && v > 0) amounts.push(v);
      }
      if (!amounts.length) continue;

      const dates = [];
      const dRe = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/g;
      while ((m = dRe.exec(line)) !== null) {
        const p1 = parseInt(m[1]), p2 = parseInt(m[2]);
        if (p1 >= 1 && p1 <= 31 && p2 >= 1 && p2 <= 12) dates.push(m[0]);
      }

      let clean = line.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, '').replace(/\$?[\d,]+(?:\.\d{2})?/g, '').replace(/\s+/g, ' ').trim();
      if (!clean) clean = 'Entry';
      if (clean.length > 80) clean = clean.substring(0, 80).trim();

      const rec = {
        date: dates.length ? dates[0].replace(/\//g, '-') : '',
        description: clean,
        value: amounts[0] || null,
        balance: amounts.length > 1 ? amounts[amounts.length - 1] : null,
        type: 'report_entry',
      };

      result.records.push(rec);

      if (amounts.length > 0) {
        result.keyFigures.push({ label: clean, value: amounts[0] });
      }
    }
  }

  _getValidationChecks(result) {
    return [
      { key: 'reportTitle', weight: 25, test: result.reportTitle && result.reportTitle.length > 3 },
      { key: 'records', weight: 30, test: result.records.length > 0 },
      { key: 'sections', weight: 15, test: result.sections.length > 0 },
      { key: 'keyFigures', weight: 15, test: result.keyFigures.length > 0 },
      { key: 'preparedBy', weight: 10, test: !!result.preparedBy },
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
        'Report Title': result.reportTitle,
        'Report Date': result.reportDate,
        'Period': result.period,
        'Prepared By': result.preparedBy,
        'Sections Found': result.sections.length,
        'Record Count': result.records.length,
        'Key Figure Count': result.keyFigures.length,
      },
      keyFigures: result.keyFigures.map((kf, i) => ({ '#': i + 1, 'Figure': kf.label, 'Value': kf.value })),
      tables: result.detectedTables,
    };
  }
}

module.exports = { GenericReportParser };