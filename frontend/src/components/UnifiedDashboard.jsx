import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Download, AlertCircle, Loader2, FileSpreadsheet, TrendingUp, TrendingDown, DollarSign, Calendar, Tag, CreditCard, User, Building2, Hash, Mail, Phone, MapPin, Percent, Globe, CheckCircle, XCircle, Eye } from 'lucide-react';

import API_BASE from '../lib/api';

const entityColors = {
  NAME: 'text-blue-600 bg-blue-50 border-blue-200', ORGANIZATION: 'text-purple-600 bg-purple-50 border-purple-200',
  DATE: 'text-green-600 bg-green-50 border-green-200', AMOUNT: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  INVOICE_NUMBER: 'text-orange-600 bg-orange-50 border-orange-200', EMAIL: 'text-pink-600 bg-pink-50 border-pink-200',
  PHONE: 'text-indigo-600 bg-indigo-50 border-indigo-200', ADDRESS: 'text-teal-600 bg-teal-50 border-teal-200',
  URL: 'text-sky-600 bg-sky-50 border-sky-200', ACCOUNT_NUMBER: 'text-cyan-600 bg-cyan-50 border-cyan-200',
};

const DOC_TYPE_STYLES = {
  INVOICE: 'bg-orange-50 text-orange-600 border-orange-200',
  BANK_STATEMENT: 'bg-blue-50 text-blue-600 border-blue-200',
  RECEIPT: 'bg-green-50 text-green-600 border-green-200',
  UTILITY_BILL: 'bg-red-50 text-red-600 border-red-200',
  PAYSLIP: 'bg-purple-50 text-purple-600 border-purple-200',
  PURCHASE_ORDER: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  CONTRACT: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  TAX_DOCUMENT: 'bg-pink-50 text-pink-600 border-pink-200',
  SHIPPING_DOCUMENT: 'bg-teal-50 text-teal-600 border-teal-200',
  REPORT: 'bg-gray-50 text-gray-600 border-gray-200',
  TABLE: 'bg-slate-50 text-slate-600 border-slate-200',
};

function fmtAmt(v) { return v != null ? '$' + Number(v).toFixed(2) : '-'; }
function fmtVal(v) {
  if (!v && v !== 0) return '-';
  if (Array.isArray(v)) return v.map(item => typeof item === 'object' ? Object.entries(item).filter(([k]) => k !== 'id').map(([k2, v2]) => `${k2}: ${v2 ?? ''}`).join(', ') : String(item)).join(' | ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function UnifiedDashboard() {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [activeSection, setActiveSection] = useState('extracted');
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [globalErrors, setGlobalErrors] = useState([]);
  const inputRef = useRef(null);

  const docs = result ? (result.documents || [result]) : [];
  const doc = docs[activeDocIdx] || {};
  const records = doc.records || [];
  const summary = doc.summary || {};
  const docType = doc.documentType || 'Unknown';
  const isMulti = result && result.documents;
  const fields = doc.fields || {};

  const recHasQty = records.some(r => r.qty != null);
  const recHasRate = records.some(r => r.rate != null);
  const recHasAmount = records.some(r => r.amount != null);
  const recHasBalance = records.some(r => r.balance != null && r.balance > 0);
  const recHasDebit = records.some(r => r.debit != null && r.debit > 0);
  const recHasCredit = records.some(r => r.credit != null && r.credit > 0);

  // Dynamic columns per document type
  const tableCols = [];
  if (docType === 'BANK_STATEMENT') {
    tableCols.push('#', 'Date', 'Description');
    if (recHasDebit) tableCols.push('Debit');
    if (recHasCredit) tableCols.push('Credit');
    if (recHasBalance) tableCols.push('Balance');
  } else if (['INVOICE', 'PURCHASE_ORDER', 'RECEIPT'].includes(docType)) {
    tableCols.push('#', 'Date', 'Description');
    if (recHasQty) tableCols.push('Qty');
    if (recHasRate) tableCols.push('Rate');
    if (recHasAmount) tableCols.push('Amount');
    if (recHasBalance) tableCols.push('Balance');
  } else {
    tableCols.push('#', 'Date', 'Description', 'Type');
    if (recHasDebit) tableCols.push('Debit');
    if (recHasCredit) tableCols.push('Credit');
    if (recHasBalance) tableCols.push('Balance');
    if (recHasQty) tableCols.push('Qty');
    if (recHasRate) tableCols.push('Rate');
    if (recHasAmount) tableCols.push('Amount');
  }

  // Info cards for extracted data section
  function buildInfoCards(fields, docType) {
    const cards = [];
    if (fields.invoiceNumber) {
      cards.push({ type: 'invoice_header', invoiceNumber: fields.invoiceNumber, invoiceDate: fields.invoiceDate, dueDate: fields.dueDate });
    }
    if (fields.businessName && !fields.employeeName) {
      cards.push({ type: 'info_card', icon: 'Building2', title: fields.businessName, fields: [
        { label: 'Address', value: fields.vendorAddress },
        { label: 'Email', value: fields.vendorEmail },
        { label: 'Phone', value: fields.vendorPhone },
        { label: 'Bank', value: fields.bankName },
        { label: 'Account', value: fields.accountNumber },
        { label: 'Sort Code', value: fields.sortCode },
        { label: 'IBAN', value: fields.iban },
        { label: 'BIC', value: fields.bic },
        { label: 'Store', value: fields.storeNumber },
        { label: 'Cashier', value: fields.cashierName },
        { label: 'Terminal', value: fields.terminalId },
      ].filter(f => f.value) });
    }
    if (fields.employeeName) {
      cards.push({ type: 'info_card', icon: 'User', title: fields.employeeName, fields: [
        { label: 'Employer', value: fields.businessName },
        { label: 'Gross Pay', value: fields.grossPay != null ? fmtAmt(fields.grossPay) : null },
        { label: 'Net Pay', value: fields.netPay != null ? fmtAmt(fields.netPay) : null },
        { label: 'Period', value: fields.payPeriod },
      ].filter(f => f.value) });
    }
    if (fields.customerName) {
      cards.push({ type: 'info_card', icon: 'User', title: 'Customer: ' + fields.customerName, fields: [
        { label: 'Address', value: fields.customerAddress },
      ].filter(f => f.value) });
    }
    if (docType === 'BANK_STATEMENT') {
      const bankInfo = [
        { label: 'Account Holder', value: fields.accountHolder },
        { label: 'Account Number', value: fields.accountNumber },
        { label: 'Sort Code', value: fields.sortCode },
        { label: 'Bank', value: fields.bankName },
        { label: 'Period', value: fields.statementPeriod },
        { label: 'Opening Balance', value: fields.openingBalance != null ? fmtAmt(fields.openingBalance) : null },
        { label: 'Closing Balance', value: fields.closingBalance != null ? fmtAmt(fields.closingBalance) : null },
      ].filter(f => f.value);
      if (bankInfo.length > 0) {
        cards.push({ type: 'info_card', icon: 'CreditCard', title: 'Account Details', fields: bankInfo });
      }
    }
    if (docType === 'RECEIPT') {
      const receiptInfo = [
        { label: 'Date', value: fields.date },
        { label: 'Receipt #', value: fields.receiptNumber },
        { label: 'Ticket #', value: fields.ticketNumber },
        { label: 'Store', value: fields.storeNumber },
        { label: 'Cashier', value: fields.cashierName },
        { label: 'Terminal', value: fields.terminalId },
      ].filter(f => f.value);
      if (receiptInfo.length > 0) {
        cards.push({ type: 'info_card', icon: 'Calendar', title: 'Receipt Details', fields: receiptInfo });
      }
    }
    if (fields.trackingNumber) {
      cards.push({ type: 'info_card', icon: 'Tag', title: 'Tracking: ' + fields.trackingNumber, fields: [
        { label: 'Carrier', value: fields.carrier },
        { label: 'Origin', value: fields.origin },
        { label: 'Destination', value: fields.destination },
        { label: 'Ship Date', value: fields.shipDate },
        { label: 'Delivery', value: fields.deliveryDate },
      ].filter(f => f.value) });
    }
    if (fields.taxFormType) {
      cards.push({ type: 'info_card', icon: 'Percent', title: fields.taxFormType + ' - ' + (fields.taxYear || ''), fields: [
        { label: 'Taxpayer', value: fields.taxpayerName },
        { label: 'Employer', value: fields.employerName },
      ].filter(f => f.value) });
    }
    if (fields.effectiveDate) {
      cards.push({ type: 'info_card', icon: 'Calendar', title: fields.contractTitle || 'Contract', fields: [
        { label: 'Effective', value: fields.effectiveDate },
        { label: 'Expires', value: fields.expirationDate },
      ].filter(f => f.value) });
    }
    return cards;
  }

  const infoCards = buildInfoCards(fields, docType);

  const rowStyle = (rec) => {
    if (rec.type === 'tax') return 'bg-orange-50 font-medium text-orange-700';
    if (rec.type === 'invoice_summary' || rec.type === 'po_summary' || rec.type === 'receipt_summary' || rec.type === 'payslip_summary' || rec.type === 'tax_summary' || rec.type === 'contract_summary' || rec.type === 'utility_summary') return 'bg-green-50 font-bold text-green-800 border-t-2 border-green-300';
    return 'hover:bg-gray-50';
  };

  const suppressExtErrors = ['does not support image input', 'image.png', 'Extension context invalidated', 'ResizeObserver loop'];
  React.useEffect(() => {
    const handler = (event) => {
      const msg = event.message || (event.error && event.error.message) || '';
      if (suppressExtErrors.some(k => msg.includes(k))) return;
      setGlobalErrors(prev => [...prev.slice(-9), { msg, time: new Date().toLocaleTimeString() }]);
    };
    window.addEventListener('error', handler);
    window.addEventListener('unhandledrejection', handler);
    return () => { window.removeEventListener('error', handler); window.removeEventListener('unhandledrejection', handler); };
  }, []);

  const handleFile = useCallback(async (fileList) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setFiles(arr); setError(null); setResult(null); setActiveDocIdx(0); setProcessing(true); setProgress(5);
    const formData = new FormData();
    for (const f of arr) formData.append('files', f);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 600000);
    try {
      setProgress(15);
      const res = await fetch(`${API_BASE}/process`, { method: 'POST', body: formData, signal: ac.signal });
      clearTimeout(timer); setProgress(70);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Server error (${res.status})`);
      setProgress(90); setResult(data.data); setProgress(100);
    } catch (err) {
      clearTimeout(timer);
      setError(err.name === 'AbortError' ? 'Request timed out' : err.message);
    } finally { setProcessing(false); }
  }, []);

  const handleExport = useCallback(async (format) => {
    if (!result) return;
    try {
      const payload = result.documents ? result : { documents: [result] };
      const res = await fetch(`${API_BASE}/export/${format}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const ext = format === 'excel' ? 'xlsx' : 'csv';
      const fname = isMulti ? 'all_documents' : (doc.fileName || 'export').replace(/\.[^.]+$/, '');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `${fname}_${Date.now()}.${ext}`;
      link.click(); URL.revokeObjectURL(url);
    } catch (err) { setError('Export failed: ' + err.message); }
  }, [result, doc, docs, isMulti]);

  const reset = useCallback(() => { setFiles([]); setResult(null); setError(null); setProgress(0); setActiveDocIdx(0); }, []);

  if (!files.length) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Document Processor</h1>
          <p className="text-gray-500">Upload documents to auto-detect, extract data, and export</p>
        </div>
        <div onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${dragOver ? 'border-blue-400 bg-blue-50 scale-[1.02] shadow-lg' : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-gray-50 shadow-sm'}`}>
          <input ref={inputRef} type="file" multiple accept="image/*,.pdf,.txt,.zip" className="hidden" onChange={(e) => e.target.files.length && handleFile(e.target.files)} />
          <Upload className={`w-16 h-16 mx-auto mb-4 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">{dragOver ? 'Drop them here' : 'Upload documents'}</h2>
          <p className="text-gray-500 mb-2">Drop images, PDFs, text files, or ZIP bundles here</p>
          <p className="text-xs text-gray-400">Supports invoices, bank statements, receipts, utility bills, payslips, and more</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-50 rounded-lg"><FileText className="w-5 h-5 text-blue-500" /></div>
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate">{files.length > 1 ? `${files.length} files` : files[0].name}</p>
              <p className="text-xs text-gray-400">{files.length > 1 ? `${files.reduce((s, f) => s + f.size, 0) / 1024} KB total` : (files[0].size / 1024).toFixed(1) + ' KB'}</p>
            </div>
            {result && <span className={`px-3 py-1 rounded-full text-xs font-medium border shrink-0 ${DOC_TYPE_STYLES[docType] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>{docType}</span>}
            {result && isMulti && <span className="px-3 py-1 rounded-full text-xs font-medium border bg-purple-50 text-purple-600 border-purple-200 shrink-0">{docs.length} docs</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reset} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border">New Upload</button>
            {result && <>
              <button onClick={() => handleExport('excel')} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium shadow-sm"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
              <button onClick={() => handleExport('csv')} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium shadow-sm"><Download className="w-4 h-4" /> CSV</button>
            </>}
          </div>
        </div>

        {processing && (
          <div className="mb-6 bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="font-medium text-gray-700">Processing {files.length > 1 ? `${files.length} files` : 'document'}...</span>
              <span className="text-sm text-gray-400">{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {globalErrors.length > 0 && (
          <div className="mb-6 bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-6 h-6 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-yellow-800">Browser Extension Detected</p>
              <p className="text-yellow-700 text-sm mt-1">Errors like "Cannot read 'image.png'" are caused by browser extensions. Open in incognito/private window or disable extensions.</p>
            </div>
          </div>
        )}

        {error && !processing && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div><p className="font-medium text-red-700">Error</p><p className="text-red-600 text-sm mt-1">{error}</p></div>
          </div>
        )}

        {result && !processing && !error && (
          <>
            {isMulti && (
              <div className="flex flex-wrap gap-1 mb-4 bg-white p-1 rounded-xl border shadow-sm overflow-x-auto">
                {docs.map((d, i) => (
                  <button key={i} onClick={() => { setActiveDocIdx(i); setActiveSection('extracted'); }}
                    className={`px-3 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${activeDocIdx === i ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                    {d.fileName || `Doc ${i + 1}`}
                    <span className="ml-1.5 opacity-70">({d.summary?.recordCount || 0})</span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Type</p>
                <p className="text-lg font-bold text-gray-800 mt-1">{docType}</p>
                <p className="text-xs text-gray-400">{doc.extractionConfidence?.toFixed(1) || '0'}% confidence</p>
                {fields.validationStatus === 'needs_review' && <p className="text-xs text-orange-500 font-medium mt-1">&#9888; Needs Review</p>}
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Status</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <p className="text-lg font-bold text-gray-800">{doc.extractionConfidence >= 70 ? 'verified' : 'needs review'}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Records</p>
                <p className="text-lg font-bold text-gray-800 mt-1">{records.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Text Length</p>
                <p className="text-lg font-bold text-gray-800 mt-1">{(doc.rawText?.length || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-400">chars</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Debit</p>
                <p className="text-lg font-bold text-red-500 mt-1">{fmtAmt(summary?.totalDebit)}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Credit</p>
                <p className="text-lg font-bold text-green-500 mt-1">{fmtAmt(summary?.totalCredit)}</p>
              </div>
            </div>

            <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
              {[
                { id: 'extracted', label: 'Extracted Data' },
                { id: 'fields', label: 'All Fields' },
                { id: 'entities', label: 'Entities' },
                { id: 'text', label: 'Raw Text' },
              ].map(s => (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeSection === s.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {s.label}
                </button>
              ))}
            </div>

            {activeSection === 'extracted' && (
              <div className="space-y-6">
                {infoCards.map((card, ci) => {
                  const iconMap = { Building2: <Building2 className="w-4 h-4 text-blue-500" />, User: <User className="w-4 h-4 text-purple-500" />, CreditCard: <CreditCard className="w-4 h-4 text-blue-500" />, Calendar: <Calendar className="w-4 h-4 text-green-500" />, Tag: <Tag className="w-4 h-4 text-teal-500" />, Percent: <Percent className="w-4 h-4 text-pink-500" />, Hash: <Hash className="w-4 h-4 text-orange-500" /> };
                  if (card.type === 'invoice_header') {
                    return (
                      <div key={ci} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div className="px-6 py-4 border-b bg-gray-50 flex items-center gap-2">
                          <Hash className="w-4 h-4 text-orange-500" />
                          <h3 className="font-semibold text-gray-700">Invoice #{card.invoiceNumber}</h3>
                          {card.invoiceDate && <span className="text-sm text-gray-400 ml-2">| {card.invoiceDate}</span>}
                          {card.dueDate && <span className="text-sm text-gray-400 ml-2">| Due: {card.dueDate}</span>}
                        </div>
                      </div>
                    );
                  }
                  if (card.type === 'info_card') {
                    return (
                      <div key={ci} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div className="px-6 py-4 border-b bg-gray-50 flex items-center gap-2">
                          {iconMap[card.icon] || <FileText className="w-4 h-4 text-gray-500" />}
                          <h3 className="font-semibold text-gray-700">{card.title}</h3>
                        </div>
                        <div className="px-6 py-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          {card.fields.map((f, fi) => <div key={fi}><span className="text-gray-400">{f.label}:</span> <span className="text-gray-700">{f.value}</span></div>)}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}

                {records.length > 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                      <h3 className="font-semibold text-gray-700">Records ({records.length})</h3>
                      {summary && <span className="text-sm text-gray-500">Net: <span className={'font-medium ' + ((summary.netBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600')}>{fmtAmt(summary.netBalance)}</span></span>}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                          {tableCols.map((col, ci) => <th key={ci} className={'px-4 py-3 text-left' + (['Qty','Rate','Amount','Debit','Credit','Balance'].includes(col) ? ' text-right' : '')}>{col}</th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-gray-100">
                          {records.map((rec, i) => (
                            <tr key={i} className={rowStyle(rec)}>
                              {tableCols.map((col, ci) => {
                                if (col === '#') return <td key={ci} className="px-4 py-2 text-gray-400 text-xs">{rec.id || i + 1}</td>;
                                if (col === 'Date') return <td key={ci} className="px-4 py-2 text-gray-600 whitespace-nowrap">{rec.date || '-'}</td>;
                                if (col === 'Description') return <td key={ci} className="px-4 py-2 font-medium text-gray-700 max-w-xs truncate">{rec.description || '-'}</td>;
                                if (col === 'Type') return <td key={ci} className="px-4 py-2 text-gray-400 text-xs">{rec.type || '-'}</td>;
                                if (col === 'Qty') return <td key={ci} className="px-4 py-2 text-right text-gray-600">{rec.qty != null ? rec.qty : '-'}</td>;
                                if (col === 'Rate') return <td key={ci} className="px-4 py-2 text-right text-gray-600">{rec.rate != null ? fmtAmt(rec.rate) : '-'}</td>;
                                if (col === 'Amount') return <td key={ci} className="px-4 py-2 text-right text-gray-700">{rec.amount != null ? fmtAmt(rec.amount) : '-'}</td>;
                                if (col === 'Debit') return <td key={ci} className="px-4 py-2 text-right text-red-600 whitespace-nowrap">{rec.debit > 0 ? fmtAmt(rec.debit) : '-'}</td>;
                                if (col === 'Credit') return <td key={ci} className="px-4 py-2 text-right text-green-600 whitespace-nowrap">{rec.credit > 0 ? fmtAmt(rec.credit) : '-'}</td>;
                                if (col === 'Balance') return <td key={ci} className="px-4 py-2 text-right text-gray-600 whitespace-nowrap font-medium">{rec.balance != null ? fmtAmt(rec.balance) : '-'}</td>;
                                return <td key={ci} className="px-4 py-2 text-gray-600">-</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border overflow-hidden p-6 text-center">
                    <p className="text-gray-400">No records extracted for this document</p>
                  </div>
                )}

                {fields.lineItems && fields.lineItems.length > 0 && ['INVOICE', 'PURCHASE_ORDER', 'RECEIPT'].includes(docType) && (
                  <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50">
                      <h3 className="font-semibold text-gray-700">Original Line Items ({fields.lineItems.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                          {fields.lineItems.some(i => i.date) && <th className="px-4 py-3 text-left">Date</th>}
                          <th className="px-4 py-3 text-left">Item</th>
                          <th className="px-4 py-3 text-left">Description</th>
                          <th className="px-4 py-3 text-right">Qty</th>
                          <th className="px-4 py-3 text-right">Rate</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-100">
                          {fields.lineItems.map((item, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              {item.date && <td className="px-4 py-2 text-gray-500 text-xs">{item.date}</td>}
                              <td className="px-4 py-2 text-gray-700">{item.item || item.description || '-'}</td>
                              <td className="px-4 py-2 text-gray-500">{item.description || '-'}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{item.qty != null ? item.qty : '-'}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{item.rate != null ? fmtAmt(item.rate) : item.unitPrice != null ? fmtAmt(item.unitPrice) : '-'}</td>
                              <td className="px-4 py-2 text-right text-gray-700 font-medium">{item.amount != null ? fmtAmt(item.amount) : item.total != null ? fmtAmt(item.total) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fields.subtotal != null && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Subtotal</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fmtAmt(fields.subtotal)}</p>
                    </div>
                  )}
                  {fields.taxAmount != null && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Tax{fields.taxRate != null ? ` (${fields.taxRate}%)` : ''}</p>
                      <p className="text-lg font-bold text-orange-600 mt-1">{fmtAmt(fields.taxAmount)}</p>
                    </div>
                  )}
                  {fields.totalAmount != null && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Total</p>
                      <p className="text-lg font-bold text-green-600 mt-1">{fmtAmt(fields.totalAmount)}</p>
                    </div>
                  )}
                  {fields.balanceDue != null && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Balance Due</p>
                      <p className="text-lg font-bold text-red-600 mt-1">{fmtAmt(fields.balanceDue)}</p>
                    </div>
                  )}
                  {fields.openingBalance != null && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Opening Balance</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fmtAmt(fields.openingBalance)}</p>
                    </div>
                  )}
                  {fields.closingBalance != null && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Closing Balance</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fmtAmt(fields.closingBalance)}</p>
                    </div>
                  )}
                  {fields.paymentMethod && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Payment</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fields.paymentMethod}</p>
                    </div>
                  )}
                  {fields.netPay != null && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Net Pay</p>
                      <p className="text-lg font-bold text-green-600 mt-1">{fmtAmt(fields.netPay)}</p>
                    </div>
                  )}
                  {fields.grossPay != null && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Gross Pay</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fmtAmt(fields.grossPay)}</p>
                    </div>
                  )}
                  {fields.poNumber && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">PO Number</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fields.poNumber}</p>
                    </div>
                  )}
                  {fields.contractValue != null && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Contract Value</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fmtAmt(fields.contractValue)}</p>
                    </div>
                  )}
                  {fields.utilityName && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Utility</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fields.utilityName}</p>
                    </div>
                  )}
                  {fields.date && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Date</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fields.date}</p>
                    </div>
                  )}
                  {fields.receiptNumber && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Receipt #</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fields.receiptNumber}</p>
                    </div>
                  )}
                  {fields.ticketNumber && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Ticket #</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fields.ticketNumber}</p>
                    </div>
                  )}
                  {fields.storeNumber && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Store #</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fields.storeNumber}</p>
                    </div>
                  )}
                  {fields.cashierName && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Cashier</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fields.cashierName}</p>
                    </div>
                  )}
                  {fields.terminalId && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Terminal</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{fields.terminalId}</p>
                    </div>
                  )}
                </div>

                {doc.fields && doc.fields.detectedTables && doc.fields.detectedTables.length > 0 && doc.fields.detectedTables.map((table, ti) => (
                  <div key={'table_'+ti} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50">
                      <h3 className="font-semibold text-gray-700">Detected Table {ti + 1}</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                          {table.headers.map((h, hi) => <th key={hi} className="px-4 py-3 text-left">{h}</th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-gray-100">
                          {table.rows.map((row, ri) => (
                            <tr key={ri} className="hover:bg-gray-50">
                              {row.map((cell, ci) => <td key={ci} className="px-4 py-2 text-sm text-gray-700">{cell}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'fields' && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50">
                  <h3 className="font-semibold text-gray-700">All Extracted Fields</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {Object.entries(fields).filter(([k]) => k !== 'lineItems' && k !== 'detectedTables' && k !== 'entities' && k !== 'transactions').map(([k, v]) =>
                    v != null && v !== '' ? (
                      <div key={k} className="px-6 py-3 flex items-start gap-4 hover:bg-gray-50">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[160px] py-1">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-sm text-gray-800 font-medium">{fmtVal(v)}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {activeSection === 'entities' && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50">
                  <h3 className="font-semibold text-gray-700">Entities ({doc.entities?.length || 0})</h3>
                </div>
                {doc.entities && doc.entities.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-3 text-left">Type</th>
                        <th className="px-6 py-3 text-left">Value</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {doc.entities.map((ent, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${entityColors[ent.type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>{ent.type}</span>
                            </td>
                            <td className="px-6 py-3 font-medium text-gray-700">{ent.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="px-6 py-4 text-sm text-gray-400">No entities extracted</div>}
              </div>
            )}

            {activeSection === 'text' && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-700">Extracted Text</h3>
                  <span className="text-xs text-gray-400">Confidence: {doc.extractionConfidence?.toFixed(1) || '0'}%</span>
                </div>
                <div className="p-6">
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto border">{doc.rawText || '(no text extracted)'}</pre>
                  {(!doc.rawText || doc.rawText.length < 20) && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-700">Very little text was recognized. The image may need better lighting or higher contrast.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
