import React, { useState, useCallback } from 'react';
import { Download, FileSpreadsheet, RefreshCw, FileText, AlertTriangle } from 'lucide-react';
import DocumentUpload from './DocumentUpload';
import ProcessingStatus from './ProcessingStatus';
import EditableDataGrid from './EditableDataGrid';
import ColumnMapping from './ColumnMapping';
import TemplateManager from './TemplateManager';
import { useFinancialDocument } from '../../hooks/useFinancialDocument';

export default function FinancialDashboard() {
  const {
    processDocument, exportExcel, exportCsv, reprocessWithMapping, reset,
    processing, exporting, progress, result, normalized, error
  } = useFinancialDocument();

  const [file, setFile] = useState(null);
  const [docTypeHint, setDocTypeHint] = useState('');
  const [editableRecords, setEditableRecords] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');

  const handleUpload = useCallback((f) => {
    setFile(f);
    setEditableRecords(null);
    setActiveTab('processing');
    processDocument(f, docTypeHint);
  }, [docTypeHint, processDocument]);

  const handleReprocess = useCallback(() => {
    if (!file) return;
    setEditableRecords(null);
    processDocument(file, docTypeHint);
  }, [file, docTypeHint, processDocument]);

  const handleRecordsChange = useCallback((records) => {
    setEditableRecords(records);
  }, []);

  const handleApplyMapping = useCallback(async (mapping) => {
    const reprocessed = await reprocessWithMapping({
      documentId: result?.documentId,
      headers: mapping.headers,
      dataRows: mapping.dataRows,
      columnMappings: mapping.columnMappings
    });
    if (reprocessed) {
      setEditableRecords(reprocessed.parsedRecords);
    }
  }, [result, reprocessWithMapping]);

  const handleExportExcel = useCallback(() => {
    if (normalized) {
      const doc = { ...normalized };
      if (editableRecords) {
        const totalDebit = editableRecords.filter(r => r.debit).reduce((s, r) => s + r.debit, 0);
        const totalCredit = editableRecords.filter(r => r.credit).reduce((s, r) => s + r.credit, 0);
        doc.records = editableRecords.map(r => ({
          date: r.date || '',
          description: r.description || '',
          amount: (r.debit || r.credit || 0).toFixed(2),
          type: r.debit > 0 ? 'debit' : 'credit',
          source: 'main'
        }));
        doc.summary = { totalDebit, totalCredit, netBalance: totalCredit - totalDebit, recordCount: editableRecords.length };
      }
      exportExcel(doc);
    }
  }, [normalized, editableRecords, exportExcel]);

  const handleExportCsv = useCallback(() => {
    if (normalized) {
      const doc = { ...normalized };
      if (editableRecords) {
        doc.records = editableRecords.map(r => ({
          date: r.date || '',
          description: r.description || '',
          amount: (r.debit || r.credit || 0).toFixed(2),
          type: r.debit > 0 ? 'debit' : 'credit',
          source: 'main'
        }));
      }
      exportCsv(doc);
    }
  }, [normalized, editableRecords, exportCsv]);

  const handleReset = useCallback(() => {
    setFile(null);
    setEditableRecords(null);
    setActiveTab('upload');
    reset();
  }, [reset]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Financial Document Processor</h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload bank statements, invoices, or receipts to extract structured data
          </p>
        </div>
        <div className="flex items-center gap-3">
          {result && (
            <>
              <button
                onClick={handleExportExcel}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'Excel'}
              </button>
              <button
                onClick={handleExportCsv}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
            </>
          )}
          {file && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200"
            >
              <RefreshCw className="w-4 h-4" /> New
            </button>
          )}
        </div>
      </div>

      {!result && activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Document Type (optional hint)</label>
              <select
                value={docTypeHint}
                onChange={(e) => setDocTypeHint(e.target.value)}
                className="w-48 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Auto-detect</option>
                <option value="BANK_STATEMENT">Bank Statement</option>
                <option value="INVOICE">Invoice</option>
                <option value="RECEIPT">Receipt</option>
              </select>
            </div>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50"
            >
              <FileText className="w-4 h-4" /> Templates
            </button>
          </div>

          <DocumentUpload onUpload={handleUpload} isProcessing={processing} />

          {showTemplates && (
            <div className="max-w-md">
              <TemplateManager onApplyTemplate={(t) => {
                setDocTypeHint(t.documentType);
                setShowTemplates(false);
              }} />
            </div>
          )}
        </div>
      )}

      {(processing || result || error) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <ProcessingStatus
              processing={processing}
              progress={progress}
              result={result}
              error={error}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <button
                  onClick={handleReprocess}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                >
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
              </div>
            )}

            {showTemplates && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <TemplateManager onApplyTemplate={(t) => {
                  setDocTypeHint(t.documentType);
                  setShowTemplates(false);
                }} />
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {result?.status === 'needs_mapping' ? (
              <ColumnMapping
                rawText={result.rawText}
                onApplyMapping={handleApplyMapping}
              />
            ) : result?.status === 'completed' && (
              <>
                <EditableDataGrid
                  records={editableRecords || result.parsedRecords}
                  onRecordsChange={handleRecordsChange}
                  onExportCsv={() => {
                    const doc = normalized ? { ...normalized } : null;
                    if (doc) exportCsv(doc);
                  }}
                  documentType={result.detectedType}
                />

                {result.detectedType === 'UNKNOWN' && editableRecords && editableRecords.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-700">
                      This document was classified as UNKNOWN. The data shown is an approximation.
                      Use the column mapping above to improve results.
                    </p>
                  </div>
                )}
              </>
            )}

            {result?.status === 'parsing_failed' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <h3 className="font-semibold text-amber-800">Parsing Failed</h3>
                <p className="text-sm text-amber-600 mt-1">
                  We could not extract structured data. Try a different document type hint, or use the raw text view.
                </p>
                <details className="mt-4 text-left">
                  <summary className="text-sm text-amber-700 cursor-pointer font-medium">View Raw Text</summary>
                  <pre className="mt-2 p-3 bg-white border border-amber-200 rounded-lg text-xs text-gray-600 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {result.rawText}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      )}

      {normalized?.summary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-500">Total Debit</p>
              <p className="text-lg font-bold text-red-600">{normalized.summary.totalDebit.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-500">Total Credit</p>
              <p className="text-lg font-bold text-green-600">{normalized.summary.totalCredit.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-500">Net Balance</p>
              <p className={`text-lg font-bold ${normalized.summary.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {normalized.summary.netBalance.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-500">Records</p>
              <p className="text-lg font-bold text-gray-800">{normalized.summary.recordCount}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
