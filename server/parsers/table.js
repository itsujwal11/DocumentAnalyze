const { BaseParser } = require('./base');
const { parseAmount } = require('../config');

class GenericTableParser extends BaseParser {
  constructor(rawText) {
    super(rawText);
  }

  extract() {
    const text = this.rawText;
    const { tables, confidence } = detectTables(text);
    const result = {
      tables: tables.map(t => ({
        headers: t.headers,
        rows: t.rows,
        rowCount: t.rows.length,
        columnMap: this.mapTableHeaders(t.headers),
      })),
      records: [],
      columnMapping: {},
    };

    for (const table of tables) {
      const colMap = this.mapTableHeaders(table.headers);
      for (const row of table.rows) {
        const rec = { date: '', description: row.join(' | '), debit: null, credit: null, balance: null, type: 'table_row', row, mapped: {} };
        for (let ci = 0; ci < row.length; ci++) {
          const key = colMap[ci] || `col_${ci + 1}`;
          rec.mapped[key] = row[ci];
        }
        const dateMatch = row[0]?.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/);
        if (dateMatch) rec.date = dateMatch[1];
        for (const cell of row) {
          const num = parseAmount(cell);
          if (num !== null && cell.length < 20) {
            if (rec.debit === null && num > 0 && !cell.startsWith('$')) rec.debit = num;
            else if (rec.credit === null) rec.credit = num;
          }
        }
        result.records.push(rec);
      }
    }

    this.confidence = confidence;
    this.result = result;
    this._validate(result);
    return result;
  }

  _getValidationChecks(result) {
    return [
      { key: 'tables', weight: 40, test: result.tables.length > 0 },
      { key: 'rows', weight: 30, test: result.tables.some(t => t.rows.length >= 2) },
      { key: 'records', weight: 30, test: result.records.length > 0 },
    ];
  }

  _validate(result) {
    const checks = this._getValidationChecks(result);
    this._runValidation(result, checks);
    this.result = result;
  }

  getExportData(result) {
    const exportData = { summary: { 'Table Count': result.tables.length } };
    result.tables.forEach((table, ti) => {
      const key = `Table ${ti + 1}`;
      const headers = table.headers;
      const rows = table.rows;
      const tableData = rows.map((row, ri) => {
        const obj = { '#': ri + 1 };
        headers.forEach((h, ci) => { obj[h] = row[ci] || ''; });
        return obj;
      });
      exportData[key] = { headers, rowCount: table.rowCount, columnMap: table.columnMap, data: tableData };
    });
    exportData.records = result.records;
    return exportData;
  }
}

function detectTables(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const tables = [];
  let i = 0;

  while (i < lines.length) {
    const lineFields = [];
    for (let j = i; j < lines.length; j++) {
      const l = lines[j].trim();
      const parts = l.split(/\t| {2,}/);
      if (parts.length < 2) break;
      const pos = [];
      let searchFrom = 0;
      for (const p of parts) {
        const idx = l.indexOf(p, searchFrom);
        pos.push(idx);
        searchFrom = idx + p.length;
      }
      lineFields.push({ parts, pos });
    }
    if (lineFields.length < 4) { i++; continue; }

    const ref = lineFields[0];
    let valid = 0;
    for (const lf of lineFields) {
      if (Math.abs(lf.parts.length - ref.parts.length) > 1) break;
      let match = true;
      for (let k = 0; k < Math.min(lf.parts.length, ref.parts.length); k++) {
        if (Math.abs(lf.pos[k] - ref.pos[k]) > 3) { match = false; break; }
      }
      if (match) valid++;
    }

    if (valid >= 4) {
      const headers = ref.parts.map(h => h.trim());
      const rows = lineFields.slice(1).filter(lf => lf.parts.length === headers.length).map(lf => lf.parts.map(p => p.trim()));
      if (rows.length >= 2) {
        tables.push({ headers, rows });
        i += lineFields.length;
        continue;
      }
    }
    i++;
  }

  if (tables.length > 0) {
    const tableLineCount = tables.reduce((s, t) => s + t.rows.length + 1, 0);
    const confidence = Math.min(95, Math.round(30 + (tableLineCount / Math.max(lines.length, 1)) * 70));
    return { tables, confidence };
  }

  const pipeResult = isPipeDelimited(text);
  if (pipeResult) {
    const pipeLines = text.split('\n').filter(l => /^\d{4}[-/]\d{2}[-/]\d{2}\s*\|/.test(l.trim()));
    return { tables: [{ headers: ['Date', 'Description', 'Amount', 'Balance'], rows: pipeLines.map(l => l.split('|').map(p => p.trim())) }], confidence: 85 };
  }

  return { tables: [], confidence: 0 };
}

function isPipeDelimited(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const pipeLines = lines.filter(l => /^\d{4}[-/]\d{2}[-/]\d{2}\s*\|/.test(l) && l.split('|').length >= 4);
  return pipeLines.length >= lines.length * 0.5 && pipeLines.length >= 2;
}

function getTableColumnMap(headers) {
  const dummyParser = new GenericTableParser('');
  return dummyParser.mapTableHeaders(headers);
}

module.exports = { GenericTableParser, detectTables, isPipeDelimited, getTableColumnMap };