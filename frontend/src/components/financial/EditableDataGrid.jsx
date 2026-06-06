import React, { useState, useCallback } from 'react';
import { Pencil, Save, X, ChevronDown, ChevronUp, Download } from 'lucide-react';

export default function EditableDataGrid({ records, onRecordsChange, onExportCsv, documentType }) {
  const [editCell, setEditCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  const columns = documentType === 'BANK_STATEMENT'
    ? ['date', 'description', 'debit', 'credit', 'balance']
    : ['date', 'description', 'credit', 'debit', 'type'];

  const headers = {
    date: 'Date', description: 'Description', debit: 'Debit',
    credit: 'Credit', balance: 'Balance', type: 'Type'
  };

  const getValue = (record, col) => {
    const val = record[col];
    if (val == null || val === '') return '';
    if (typeof val === 'number') return val.toFixed(2);
    return String(val);
  };

  const sortedRecords = [...(records || [])].sort((a, b) => {
    if (!sortKey) return 0;
    const va = getValue(a, sortKey);
    const vb = getValue(b, sortKey);
    const cmp = va.localeCompare(vb);
    return sortAsc ? cmp : -cmp;
  });

  const startEdit = (rowIdx, col) => {
    const record = sortedRecords[rowIdx];
    setEditCell({ rowIdx, col });
    setEditValue(getValue(record, col));
  };

  const saveEdit = useCallback(() => {
    if (!editCell) return;
    const updated = [...records];
    const realIdx = records.indexOf(sortedRecords[editCell.rowIdx]);
    const num = parseFloat(editValue);
    if (!isNaN(num)) {
      updated[realIdx] = { ...updated[realIdx], [editCell.col]: num };
    } else {
      updated[realIdx] = { ...updated[realIdx], [editCell.col]: editValue };
    }
    onRecordsChange(updated);
    setEditCell(null);
  }, [editCell, editValue, records, sortedRecords, onRecordsChange]);

  const toggleSort = (col) => {
    if (sortKey === col) setSortAsc(!sortAsc);
    else { setSortKey(col); setSortAsc(true); }
  };

  if (!records || records.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
        <p>No records found in this document.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600">
          {records.length} record{records.length !== 1 ? 's' : ''} &middot; Click cells to edit
        </p>
        <div className="flex gap-2">
          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-8">#</th>
              {columns.map(col => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {headers[col] || col}
                    {sortKey === col && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map((record, idx) => (
              <tr key={idx} className={`border-b border-gray-100 hover:bg-blue-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                {columns.map(col => {
                  const isEditing = editCell?.rowIdx === idx && editCell?.col === col;
                  return (
                    <td key={col} className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditCell(null); }}
                            className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            autoFocus
                          />
                          <button onClick={saveEdit} className="p-0.5 text-green-600 hover:text-green-800"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditCell(null)} className="p-0.5 text-red-500 hover:text-red-700"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(idx, col)}
                          className="group flex items-center gap-1 w-full text-left"
                        >
                          <span className="text-gray-900">{getValue(record, col)}</span>
                          <Pencil className="w-3 h-3 text-gray-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
