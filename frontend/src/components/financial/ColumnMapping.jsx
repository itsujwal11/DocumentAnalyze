import React, { useState, useMemo } from 'react';
import { ArrowRight, Check, AlertCircle } from 'lucide-react';

export default function ColumnMapping({ rawText, onApplyMapping }) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [delimiter, setDelimiter] = useState('auto');

  const standardFields = ['date', 'description', 'amount', 'debit', 'credit', 'balance'];

  const parseText = (text, delim) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    let splitLines;
    if (delim === 'auto') {
      splitLines = lines.map(l => l.split(/\s{2,}|\t|,/));
    } else {
      splitLines = lines.map(l => l.split(delim));
    }

    const firstRow = splitLines[0];

    if (firstRow.length >= 2) {
      setHeaders(firstRow.map((_, i) => `Column ${i + 1}`));
      setRows(splitLines.map(r => r.map(c => c.trim())));
    } else {
      setHeaders(['Line']);
      setRows(lines.map(l => [l]));
    }
  };

  useMemo(() => {
    if (rawText) parseText(rawText, delimiter);
  }, [rawText]);

  const handleDelimiterChange = (delim) => {
    setDelimiter(delim);
    if (rawText) parseText(rawText, delim);
  };

  const updateMapping = (colIdx, field) => {
    setMapping(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === field) delete next[k]; });
      if (field) next[colIdx] = field;
      return next;
    });
  };

  const apply = () => {
    if (!onApplyMapping) return;
    const mappedHeaders = headers.map((h, i) => mapping[i] || h);
    onApplyMapping({
      headers: mappedHeaders,
      dataRows: rows,
      columnMappings: Object.entries(mapping).map(([col, field]) => ({
        column: headers[parseInt(col)],
        field
      }))
    });
  };

  if (!rawText) return null;

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">Document type not recognized</p>
            <p className="text-sm text-amber-600 mt-1">
              Map the columns below to standard fields so we can extract the data correctly.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-600">Delimiter:</span>
        {['auto', '\t', ',', '|'].map(d => (
          <button
            key={d}
            onClick={() => handleDelimiterChange(d)}
            className={`px-3 py-1 text-sm rounded-lg border ${
              delimiter === d
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {d === 'auto' ? 'Auto' : d === '\t' ? 'Tab' : `"${d}"`}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-10">#</th>
              {headers.map((h, i) => (
                <th key={i} className="px-2 py-2">
                  <select
                    value={mapping[i] || ''}
                    onChange={(e) => updateMapping(i, e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">{h} (ignore)</option>
                    {standardFields.map(f => (
                      <option key={f} value={f} className="capitalize">{f}</option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((row, ri) => (
              <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-1.5 text-xs text-gray-400">{ri + 1}</td>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-2 py-1.5 text-gray-700 text-xs whitespace-nowrap max-w-[200px] truncate">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 20 && (
          <p className="text-xs text-gray-400 text-center py-2 border-t border-gray-100">
            Showing first 20 of {rows.length} rows
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {Object.keys(mapping).length} of {headers.length} columns mapped
        </p>
        <button
          onClick={apply}
          disabled={Object.keys(mapping).length === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            Object.keys(mapping).length > 0
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ArrowRight className="w-4 h-4" />
          Apply Mapping
        </button>
      </div>
    </div>
  );
}
