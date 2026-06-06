import React from 'react';
import { Loader2, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

export default function ProcessingStatus({ processing, progress, result, error }) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-red-800">Processing Error</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <p className="font-medium text-blue-800">Processing document...</p>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <p className="text-xs text-blue-500">{Math.round(progress)}% complete</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="font-medium text-green-800">Processing Complete</p>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            result.status === 'completed' ? 'bg-green-100 text-green-700' :
            result.status === 'needs_mapping' ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {result.status === 'completed' ? 'Parsed' :
             result.status === 'needs_mapping' ? 'Needs Mapping' : 'Failed'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white rounded-lg p-2.5 border border-green-100">
            <span className="text-gray-500">Document Type</span>
            <p className="font-semibold text-gray-900">{result.detectedType}</p>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-green-100">
            <span className="text-gray-500">Confidence</span>
            <p className="font-semibold text-gray-900">
              {result.confidence ? `${result.confidence.toFixed(1)}%` : 'N/A'}
            </p>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-green-100">
            <span className="text-gray-500">Records Found</span>
            <p className="font-semibold text-gray-900">{result.parsedRecords?.length || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-green-100">
            <span className="text-gray-500">File</span>
            <p className="font-semibold text-gray-900 truncate">{result.fileName}</p>
          </div>
        </div>

        {result.warnings?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">{w}</p>
              ))}
            </div>
          </div>
        )}

        {result.extractedPages?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Extracted Pages</p>
            <div className="space-y-1">
              {result.extractedPages.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
