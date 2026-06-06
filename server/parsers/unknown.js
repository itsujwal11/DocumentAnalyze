const { BaseParser } = require('./base');
const { STATE_ABBREVS, parseAmount, normDate } = require('../config');

class UnknownDocumentParser extends BaseParser {
  constructor(rawText) {
    super(rawText);
  }

  extract() {
    const text = this.rawText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lowerText = text.toLowerCase();

    const result = {
      language: this._detectLanguage(text),
      currency: this._detectCurrency(text),
      entities: [],
      fields: {},
      records: [],
      detectedTables: [],
    };

    result.entities = this._extractEntities(text, lines);
    result.fields = this._extractFields(text, lines, lowerText);
    result.records = this._extractRecords(text, lines);
    result.detectedTables = this.detectTableStructure(lines);
    this._validate(result);

    return result;
  }

  _detectLanguage(text) {
    if (/mwst|rechnung|bediente|tisch\s+\d|quittung/i.test(text)) return 'DE';
    if (/le\s+la\s+les|et\s+ou|nous\s+vous|veuillez/i.test(text)) return 'FR';
    if (/el\s+la\s+los|y\s+o|nuestro/i.test(text)) return 'ES';
    return 'EN';
  }

  _detectCurrency(text) {
    if (/CHF|Fr\.?\b/i.test(text)) return 'CHF';
    if (/\$/.test(text)) return 'USD';
    if (/₹|Rs\.?\s/i.test(text)) return 'INR';
    if (/€/.test(text)) return 'EUR';
    if (/£/.test(text)) return 'GBP';
    if (/¥/.test(text)) return 'JPY';
    return 'USD';
  }

  _extractEntities(text, lines) {
    const entities = [];
    const seen = new Set();

    function add(type, value) {
      if (value == null) return;
      const v = String(value).trim();
      if (v && !seen.has(type + '|' + v)) {
        seen.add(type + '|' + v);
        entities.push({ type, value: v });
      }
    }

    const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    let m; while ((m = emailRe.exec(text)) !== null) add('EMAIL', m[0]);

    const phoneRe = /\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;
    while ((m = phoneRe.exec(text)) !== null) add('PHONE', m[0].trim());

    const dateRe = /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g;
    while ((m = dateRe.exec(text)) !== null) add('DATE', m[0]);

    const aRe = /[$€£₹]\s*[\d,]+(?:\.\d{2})?/g;
    while ((m = aRe.exec(text)) !== null) add('AMOUNT', m[0]);

    const webRe = /(?:www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    while ((m = webRe.exec(text)) !== null) add('WEBSITE', m[0].toLowerCase());

    const invRe = /(?:invoice\s*(?:no|number|#|id)?[:\s]*)([A-Z0-9][-A-Z0-9/]+)/i;
    const invM = text.match(invRe);
    if (invM) add('INVOICE_NUMBER', invM[1].trim());

    const acctRe = /account\s*(?:number|no|#)[:\s]*(\d{6,20})/i;
    const acctM = text.match(acctRe);
    if (acctM) add('ACCOUNT_NUMBER', acctM[1].trim());

    const ssnRe = /\b(\d{3}[-]\d{2}[-]\d{4})\b/;
    const ssnM = text.match(ssnRe);
    if (ssnM) add('SSN', ssnM[1]);

    const urlRe = /https?:\/\/[^\s]+/g;
    while ((m = urlRe.exec(text)) !== null) add('URL', m[0]);

    return entities;
  }

  _extractFields(text, lines, lowerText) {
    const fields = {};

    fields.languageDetected = this._detectLanguage(text);
    fields.currencyDetected = this._detectCurrency(text);

    for (let i = 0; i < Math.min(8, lines.length); i++) {
      const l = lines[i];
      if (l && l.length > 2 && l.length < 60 && !/^\d/.test(l) &&
          !/^(bill|ship|invoice|date|page|total|tax|amount|receipt|statement|account|rech)/i.test(l)) {
        const alphaRatio = (l.match(/[A-Za-z\s]/g) || []).length / l.length;
        if (alphaRatio > 0.6) {
          fields.businessName = l;
          break;
        }
      }
    }
    if (!fields.businessName) fields.businessName = lines[0] || '';

    const phoneR = /\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/;
    const pm = text.match(phoneR);
    if (pm) fields.phone = pm[0].trim();

    const emailR = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const em = text.match(emailR);
    if (em) fields.email = em[0];

    const webR = /(?:www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    const wm = text.match(webR);
    if (wm) fields.website = wm[0].toLowerCase();

    const addrFiltered = lines.filter(l => {
      const ll = l.toLowerCase();
      return /\bstreet\b|\bdr\.|\bdrove\b|\bavenue\b|\broad\b|\bblvd\b|\bp\.?\s*o\.?\s*box\b|\bsuite\b|\bste\b/i.test(ll) ||
             /\b[A-Z]{2}\s+\d{5}\b/.test(l) ||
             (/^\d{1,5}\s/.test(l.trim()) && /[A-Za-z]{3,}/.test(l));
    });
    if (addrFiltered.length > 0) fields.address = addrFiltered.join('; ');

    return fields;
  }

  _extractRecords(text, lines) {
    const records = [];
    for (const line of lines) {
      if (line.length < 5) continue;
      if (/^(page|date|description|item|qty|quantity|unit|price|amount|total|subtotal|tax|vat|inv|bill|receipt|thank|balance|statement|account|period|opening|closing|iban|bic|this\s+(is\s+)?a|generated|not\s+valid|telephone|registered|the\s+your)/i.test(line)) continue;

      const amounts = [];
      const amountRe = /\$?([\d,]+(?:\.\d{2})?)/g;
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
      const date = dates.length ? normDate(dates[0]) : '';

      let clean = line.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, '').replace(/\$?[\d,]+(?:\.\d{2})?/g, '').replace(/\s+/g, ' ').trim();
      if (!clean) clean = 'Entry';
      if (clean.length > 80) clean = clean.substring(0, 80).trim();

      const dl = clean.toLowerCase();
      const isDebit = /debit|withdrawal|paid |purchase|payment|charge/.test(dl);
      const isCredit = /credit|deposit|refund|salary|interest|cash in/.test(dl);

      const rec = { date, description: clean, debit: null, credit: null, balance: null, type: 'unknown' };

      if (amounts.length === 1) {
        if (isDebit) rec.debit = amounts[0];
        else rec.credit = amounts[0];
      } else if (amounts.length === 2) {
        if (isDebit) { rec.debit = amounts[0]; rec.balance = amounts[1]; }
        else if (isCredit) { rec.credit = amounts[0]; rec.balance = amounts[1]; }
        else {
          if (amounts[0] >= 1000) { rec.credit = amounts[0]; rec.balance = amounts[1]; }
          else { rec.debit = amounts[0]; rec.balance = amounts[1]; }
        }
      }

      records.push(rec);
    }
    return records;
  }

  _getValidationChecks(result) {
    return [
      { key: 'entities', weight: 30, test: result.entities.length > 0 },
      { key: 'language', weight: 10, test: !!result.language },
      { key: 'currency', weight: 10, test: !!result.currency },
      { key: 'businessName', weight: 20, test: result.fields.businessName && result.fields.businessName.length > 2 },
      { key: 'records', weight: 30, test: result.records.length > 0 },
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
        'Language': result.language,
        'Currency': result.currency,
        'Business Name': result.fields.businessName,
        'Phone': result.fields.phone,
        'Email': result.fields.email,
        'Website': result.fields.website,
        'Address': result.fields.address,
        'Entity Count': result.entities.length,
        'Record Count': result.records.length,
      },
      tables: result.detectedTables,
    };
  }
}

module.exports = { UnknownDocumentParser };