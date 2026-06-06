import React, { useState, useCallback } from 'react';
import { Upload, FileText, Image, AlertCircle, Check } from 'lucide-react';

export default function DocumentUpload({ onUpload, isProcessing }) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);

  const validate = (f) => {
    const validTypes = [
      'application/pdf',
      'image/png', 'image/jpeg', 'image/jpg', 'image/tiff'
    ];
    if (!validTypes.includes(f.type)) {
      setError('Please upload a PDF, PNG, JPG, or TIFF file');
      return false;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File must be less than 20MB');
      return false;
    }
    setError(null);
    return true;
  };

  const handleFile = useCallback((f) => {
    if (!validate(f)) return;
    setFile(f);
    onUpload(f);
  }, [onUpload]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleChange = useCallback((e) => {
    const f = e.target.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
          dragOver
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
          onChange={handleChange}
          disabled={isProcessing}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />

        {!file ? (
          <div className="space-y-5">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center">
              <Upload className="w-10 h-10 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {dragOver ? 'Drop your file here' : 'Upload a financial document'}
              </h3>
              <p className="text-gray-500 mt-1">Drag & drop or click to browse</p>
              <p className="text-sm text-gray-400 mt-2">
                Supports PDF, PNG, JPG (max 20MB)
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> Bank Statements</span>
              <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> Invoices</span>
              <span className="flex items-center gap-1"><Image className="w-4 h-4" /> Receipts</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-2xl flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">{formatSize(file.size)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {file.type === 'application/pdf' ? 'PDF Document' : 'Image'}
              </p>
            </div>
            {!isProcessing && (
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="text-sm text-red-500 hover:text-red-700 underline"
              >
                Remove
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
