import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Book } from 'lucide-react';
import API_BASE from '../../lib/api';

const TEMPLATE_API = `${API_BASE}/financial/templates`;

export default function TemplateManager({ onApplyTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', documentType: 'BANK_STATEMENT', keywords: '', transactionPattern: '', columns: '' });

  useEffect(() => {
    fetch(TEMPLATE_API)
      .then(r => r.json())
      .then(d => { if (d.success) setTemplates(d.data); })
      .catch(() => {});
  }, []);

  const saveTemplate = async () => {
    try {
      const res = await fetch(TEMPLATE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, isCustom: true })
      });
      const json = await res.json();
      if (json.success) {
        setTemplates(prev => [...prev, json.data]);
        setShowForm(false);
        setForm({ name: '', documentType: 'BANK_STATEMENT', keywords: '', transactionPattern: '', columns: '' });
      }
    } catch {}
  };

  const deleteTemplate = async (id) => {
    try {
      await fetch(`${TEMPLATE_API}/${id}`, { method: 'DELETE' });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch {}
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Book className="w-4 h-4" /> Document Templates
        </h4>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <input placeholder="Template name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          <select value={form.documentType} onChange={e => setForm({ ...form, documentType: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
            <option value="BANK_STATEMENT">Bank Statement</option>
            <option value="INVOICE">Invoice</option>
            <option value="RECEIPT">Receipt</option>
          </select>
          <input placeholder="Keywords (comma separated)" value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          <input placeholder="Transaction regex pattern" value={form.transactionPattern} onChange={e => setForm({ ...form, transactionPattern: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          <input placeholder="Columns (comma separated)" value={form.columns} onChange={e => setForm({ ...form, columns: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          <button onClick={saveTemplate} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
            <Save className="w-3.5 h-3.5" /> Save Template
          </button>
        </div>
      )}

      {templates.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No saved templates</p>
      ) : (
        <div className="space-y-1.5">
          {templates.map(t => (
            <div key={t.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-800">{t.name}</p>
                <p className="text-xs text-gray-400">{t.documentType}</p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onApplyTemplate?.(t)}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                  title="Apply template"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  title="Delete template"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
