const { BaseParser } = require('./base');
const { parseAmount, parseFlexDate } = require('../config');

class ContractParser extends BaseParser {
  constructor(rawText) {
    super(rawText);
  }

  extract() {
    const text = this.rawText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lowerText = text.toLowerCase();

    const result = {
      contractTitle: '',
      parties: [],
      effectiveDate: '',
      expirationDate: '',
      contractValue: null,
      governingLaw: '',
      jurisdiction: '',
      clauses: [],
      detectedTables: [],
      documentId: '',
    };

    this._extractGeneral(result, text, lines, lowerText);
    this._extractClauses(result, text, lines, lowerText);
    result.detectedTables = this.detectTableStructure(lines);
    this._validate(result);

    return result;
  }

  _extractGeneral(result, text, lines, lowerText) {
    const title = text.match(/^(?:contract|agreement|license|terms|warranty)[^]{0,80}/im);
    if (title) result.contractTitle = title[0].trim();

    const docId = text.match(/(?:contract|agreement)\s*(?:no|number|#|id|reference)[:\s]*([A-Z0-9][-A-Z0-9/]+)/i);
    if (docId) result.documentId = docId[1].trim();

    const eff = text.match(/(?:effective\s*date|commencement\s*date|start\s*date)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (eff) result.effectiveDate = parseFlexDate(eff[1].trim());

    const exp = text.match(/(?:expiration\s*date|expiry\s*date|end\s*date|termination\s*date)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (exp) result.expirationDate = parseFlexDate(exp[1].trim());

    const value = text.match(/(?:contract\s*value|total\s*value|consideration|amount)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (value) result.contractValue = parseAmount(value[1]);

    const law = text.match(/(?:governing\s*law|law)\s*[:\s]*([A-Za-z\s]+?)(?:\n|$)/i);
    if (law) result.governingLaw = law[1].trim();

    const jur = text.match(/(?:jurisdiction|venue)[:\s]*([A-Za-z\s,]+?)(?:\n|$)/i);
    if (jur) result.jurisdiction = jur[1].trim();

    const parties = text.match(/(?:between\s+(.+?)(?:\s+and\s+|\s+&+\s+)(.+?)(?:\.\s|hereby|witness))/is);
    if (parties) {
      result.parties = [parties[1].trim(), parties[2].trim()].filter(Boolean);
    } else {
      const partyRe = /party[:\s]*([A-Za-z0-9\s,.-]+?)(?:\n|$)/gi;
      let pm;
      while ((pm = partyRe.exec(text)) !== null) {
        const p = pm[1].trim();
        if (p.length > 2) result.parties.push(p);
      }
      if (result.parties.length === 0) {
        if (lines.length > 0 && lines[0].length < 80) result.parties.push(lines[0]);
        if (lines.length > 1 && lines[1].length < 80) result.parties.push(lines[1]);
      }
    }
  }

  _extractClauses(result, text, lines, lowerText) {
    const clauseRe = /(\d+\.?\s*[A-Z][^.]+\.)/g;
    let cm;
    while ((cm = clauseRe.exec(text)) !== null) {
      const clause = cm[1].trim();
      if (clause.length > 5) {
        result.clauses.push({ number: cm[1].split('.')[0].trim(), text: clause });
      }
    }

    if (result.clauses.length === 0) {
      const sectionRe = /(?:section|clause|article)\s+(\d+)[.\s]*([A-Za-z][^.]+)/gi;
      while ((cm = sectionRe.exec(text)) !== null) {
        result.clauses.push({ number: cm[1], text: (cm[2] || '').trim() });
      }
    }
  }

  _getValidationChecks(result) {
    return [
      { key: 'contractTitle', weight: 20, test: result.contractTitle && result.contractTitle.length > 5 },
      { key: 'parties', weight: 25, test: result.parties.length >= 1 },
      { key: 'effectiveDate', weight: 20, test: !!result.effectiveDate },
      { key: 'clauses', weight: 15, test: result.clauses.length > 0 },
      { key: 'contractValue', weight: 10, test: result.contractValue !== null },
      { key: 'expirationDate', weight: 10, test: !!result.expirationDate },
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
        'Contract Title': result.contractTitle,
        'Document ID': result.documentId,
        'Parties': result.parties.join('; '),
        'Effective Date': result.effectiveDate,
        'Expiration Date': result.expirationDate,
        'Contract Value': result.contractValue,
        'Governing Law': result.governingLaw,
        'Jurisdiction': result.jurisdiction,
        'Clause Count': result.clauses.length,
      },
      clauses: result.clauses.map((c, i) => ({ '#': i + 1, 'Number': c.number, 'Clause': c.text })),
      tables: result.detectedTables,
    };
  }
}

module.exports = { ContractParser };