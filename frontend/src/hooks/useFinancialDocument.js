import { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:8080/api/financial';

export function useFinancialDocument() {
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [normalized, setNormalized] = useState(null);
  const [error, setError] = useState(null);

  const processDocument = useCallback(async (file, documentType = '') => {
    if (!file) return null;
    setProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);
    setNormalized(null);

    const interval = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 10, 85));
    }, 300);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (documentType) formData.append('documentType', documentType);

      const res = await fetch(`${API_BASE}/process`, { method: 'POST', body: formData });
      clearInterval(interval);
      setProgress(90);

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Processing failed');

      setResult(json.data);
      setProgress(100);

      const normRes = await fetch(`${API_BASE}/normalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json.data)
      });
      const normJson = await normRes.json();
      if (normJson.success) setNormalized(normJson.data);

      return json.data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setProcessing(false);
    }
  }, []);

  const exportExcel = useCallback(async (doc) => {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/export/excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.documentType || 'financial'}_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }, []);

  const exportCsv = useCallback(async (doc) => {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/export/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.documentType || 'financial'}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }, []);

  const reprocessWithMapping = useCallback(async (mapping) => {
    try {
      const res = await fetch(`${API_BASE}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapping)
      });
      const json = await res.json();
      if (!json.success) throw new Error('Reprocess failed');
      setResult(json.data);
      return json.data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setProcessing(false);
    setProgress(0);
    setResult(null);
    setNormalized(null);
    setError(null);
  }, []);

  return {
    processDocument, exportExcel, exportCsv, reprocessWithMapping, reset,
    processing, exporting, progress, result, normalized, error
  };
}
