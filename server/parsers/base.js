class BaseParser {
  constructor(rawText) {
    this.rawText = rawText || '';
    this.cleanText = rawText || '';
    this.confidence = 0;
    this.fieldConfidence = {};
    this.result = null;
  }

  extract() {
    throw new Error('Each parser must implement extract()');
  }

  validate(result) {
    this._runValidation(result, this._getValidationChecks(result));
  }

  _getValidationChecks(result) {
    return [];
  }

  _runValidation(result, checks) {
    let score = 0;
    let total = 0;
    for (const check of checks) {
      total += check.weight;
      if (check.test) {
        score += check.weight;
        this.fieldConfidence[check.key] = 100;
      } else {
        this.fieldConfidence[check.key] = 0;
      }
    }
    this.confidence = total > 0 ? Math.round((score / total) * 100) : 0;
  }

  getConfidence() {
    return this.confidence || 0;
  }

  getFieldConfidence() {
    return this.fieldConfidence || {};
  }

  needsReview() {
    return this.getConfidence() < 70;
  }

  detectTableStructure(lines) {
    const tables = [];
    let i = 0;
    while (i < lines.length) {
      const lineFields = [];
      for (let j = i; j < Math.min(i + 30, lines.length); j++) {
        const l = lines[j].trim();
        const parts = l.split(/\t| {3,}/);
        if (parts.length < 2) break;
        const pos = [];
        let searchFrom = 0;
        for (const p of parts) {
          const idx = l.indexOf(p, searchFrom);
          if (idx === -1) break;
          pos.push(idx);
          searchFrom = idx + p.length;
        }
        if (pos.length !== parts.length) break;
        lineFields.push({ parts, pos });
      }
      if (lineFields.length < 3) { i++; continue; }

      const ref = lineFields[0];
      let valid = 0;
      for (const lf of lineFields) {
        if (Math.abs(lf.parts.length - ref.parts.length) > 1) break;
        let match = true;
        for (let k = 0; k < Math.min(lf.parts.length, ref.parts.length); k++) {
          if (Math.abs(lf.pos[k] - ref.pos[k]) > 4) { match = false; break; }
        }
        if (match) valid++;
      }

      if (valid >= 3) {
        const headers = ref.parts.map(h => h.trim());
        const rows = lineFields.slice(1).filter(lf => lf.parts.length === headers.length).map(lf => lf.parts.map(p => p.trim()));
        if (rows.length >= 1) {
          tables.push({ headers, rows });
          i += lineFields.length;
          continue;
        }
      }
      i++;
    }
    return tables;
  }

  mapTableHeaders(headers) {
    const ll = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const map = {};
    const headerKeys = [
      { match: ['item', 'product', 'service', 'description', 'particulars', 'position', 'article', 'pos', 'art', 'leistung', 'bezeichnung'], key: 'item' },
      { match: ['description', 'desc', 'details', 'detail', 'name', 'bezeichnung'], key: 'description' },
      { match: ['qty', 'quantity', 'qty.', 'mng', 'menge', 'anzahl', 'stück', 'stk', 'pcs', 'count'], key: 'qty' },
      { match: ['rate', 'unit price', 'unit', 'price', 'preis', 'einzelpreis', 'stückpreis'], key: 'rate' },
      { match: ['amount', 'total', 'price', 'cost', 'value', 'sum', 'betrag', 'gesamt'], key: 'amount' },
      { match: ['date', 'datum', 'transaction date', 'posting date'], key: 'date' },
      { match: ['debit', 'withdrawal', 'ausgabe', 'soll', 'belastung'], key: 'debit' },
      { match: ['credit', 'deposit', 'einnahme', 'haben', 'gutschrift'], key: 'credit' },
      { match: ['balance', 'saldo', 'running balance'], key: 'balance' },
      { match: ['tax', 'vat', 'gst', 'mwst', 'ust', 'tax rate'], key: 'tax' },
      { match: ['reference', 'ref', 'ref.', 'invoice no', 'invoice number', 'order no', 'order number'], key: 'reference' },
    ];
    for (let ci = 0; ci < headers.length; ci++) {
      const h = ll[ci] || '';
      let matched = false;
      for (const hk of headerKeys) {
        if (hk.match.some(m => h === m || h.startsWith(m) || m.startsWith(h))) {
          map[ci] = hk.key;
          matched = true;
          break;
        }
      }
      if (!matched) {
        map[ci] = `col_${ci + 1}`;
      }
    }
    return map;
  }

  getExportData(result) {
    return { summary: {}, tables: [] };
  }
}

module.exports = { BaseParser };
