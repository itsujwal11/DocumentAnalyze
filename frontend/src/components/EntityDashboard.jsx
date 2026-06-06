import React from 'react';
import { 
  User, Calendar, DollarSign, Mail, Phone, CreditCard, 
  Hash, Globe, Percent, MapPin, Building2, FileText,
  Bitcoin, TrendingUp, CheckCircle, AlertCircle, Download
} from 'lucide-react';
import API_BASE from '../lib/api';

function downloadFile(url, ext) {
  const link = document.createElement('a');
  link.href = url;
  link.download = `extraction.${ext}`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => document.body.removeChild(link), 100);
}

/**
 * Entity Dashboard Component
 * 
 * Displays extracted entities in a structured format with:
 * - Entity type icons and colors
 * - Confidence scores
 * - Categorized view
 * - Search and filter capabilities
 */

const entityIcons = {
  NAME: User,
  PERSON: User,
  ORGANIZATION: Building2,
  DATE: Calendar,
  TIME: Calendar,
  CURRENCY: DollarSign,
  AMOUNT: DollarSign,
  ACCOUNT_BALANCE: CreditCard,
  INVOICE_NUMBER: FileText,
  TRANSACTION_ID: Hash,
  EMAIL: Mail,
  PHONE_NUMBER: Phone,
  ADDRESS: MapPin,
  CRYPTO_SYMBOL: Bitcoin,
  STOCK_TICKER: TrendingUp,
  ID_NUMBER: CreditCard,
  DOCUMENT_NUMBER: FileText,
  URL: Globe,
  PERCENTAGE: Percent,
  LOCATION: MapPin,
  PRODUCT: FileText,
  MONEY: DollarSign,
  UNKNOWN: AlertCircle
};

const entityColors = {
  NAME: 'bg-blue-100 text-blue-800 border-blue-200',
  PERSON: 'bg-blue-100 text-blue-800 border-blue-200',
  ORGANIZATION: 'bg-purple-100 text-purple-800 border-purple-200',
  DATE: 'bg-green-100 text-green-800 border-green-200',
  TIME: 'bg-green-100 text-green-800 border-green-200',
  CURRENCY: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  AMOUNT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ACCOUNT_BALANCE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  INVOICE_NUMBER: 'bg-orange-100 text-orange-800 border-orange-200',
  TRANSACTION_ID: 'bg-pink-100 text-pink-800 border-pink-200',
  EMAIL: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  PHONE_NUMBER: 'bg-teal-100 text-teal-800 border-teal-200',
  ADDRESS: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  CRYPTO_SYMBOL: 'bg-amber-100 text-amber-800 border-amber-200',
  STOCK_TICKER: 'bg-red-100 text-red-800 border-red-200',
  ID_NUMBER: 'bg-slate-100 text-slate-800 border-slate-200',
  DOCUMENT_NUMBER: 'bg-gray-100 text-gray-800 border-gray-200',
  URL: 'bg-violet-100 text-violet-800 border-violet-200',
  PERCENTAGE: 'bg-lime-100 text-lime-800 border-lime-200',
  LOCATION: 'bg-sky-100 text-sky-800 border-sky-200',
  PRODUCT: 'bg-rose-100 text-rose-800 border-rose-200',
  MONEY: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  UNKNOWN: 'bg-gray-100 text-gray-600 border-gray-200'
};

const extractionMethodLabels = {
  REGEX: 'Regex Pattern',
  CRF: 'CRF Model',
  BILSTM_CRF: 'BiLSTM-CRF',
  NER_MODEL: 'NER Model',
  RULE_BASED: 'Rule Based',
  MANUAL: 'Manual'
};

function EntityDashboard({ entities, extraction }) {
  if (!entities || entities.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Structured Entities Found</h3>
          <p className="text-gray-500 mb-4">No dates, currency, emails, or other structured data detected.</p>
        </div>
        
        {extraction?.extractedText && (
          <div className="mt-6">
            <h4 className="text-md font-semibold text-gray-700 mb-3">Extracted Raw Text:</h4>
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {extraction.extractedText}
              </pre>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-gray-500">OCR Confidence:</span>
              <span className="font-medium text-blue-600">
                {extraction.ocrConfidence?.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const groupedEntities = entities.reduce((acc, entity) => {
    const type = entity.entityType || 'UNKNOWN';
    if (!acc[type]) acc[type] = [];
    acc[type].push(entity);
    return acc;
  }, {});

  const avgConfidence = entities.reduce((sum, e) => sum + (e.confidenceScore || 0), 0) / entities.length;
  const highConfidenceCount = entities.filter(e => (e.confidenceScore || 0) > 80).length;

  return (
    <div className="space-y-6">
      
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold">{entities.length}</div>
            <div className="text-blue-100 text-sm">Total Entities</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{Object.keys(groupedEntities).length}</div>
            <div className="text-blue-100 text-sm">Entity Types</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{avgConfidence.toFixed(1)}%</div>
            <div className="text-blue-100 text-sm">Avg Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{highConfidenceCount}</div>
            <div className="text-blue-100 text-sm">High Confidence</div>
          </div>
        </div>
      </div>

      
      {extraction && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            Export Results
          </h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => downloadFile(`${API_BASE}/extractions/${extraction.id}/export/json`, 'json')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              Export JSON
            </button>
            <button
              onClick={() => downloadFile(`${API_BASE}/extractions/${extraction.id}/export/csv`, 'csv')}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
            >
              Export CSV
            </button>
            <button
              onClick={() => downloadFile(`${API_BASE}/extractions/${extraction.id}/export/pdf`, 'pdf')}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            >
              Export PDF
            </button>
            <button
              onClick={() => downloadFile(`${API_BASE}/extractions/${extraction.id}/export/excel`, 'xlsx')}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
            >
              Export Excel
            </button>
          </div>
        </div>
      )}

      
      {extraction && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Extraction Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Document Type:</span>
              <span className="ml-2 font-medium text-gray-800">{extraction.documentType || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-gray-500">OCR Confidence:</span>
              <span className="ml-2 font-medium text-gray-800">{extraction.ocrConfidence?.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-500">Processing Time:</span>
              <span className="ml-2 font-medium text-gray-800">{extraction.processingTimeMs}ms</span>
            </div>
            <div>
              <span className="text-gray-500">Precision:</span>
              <span className="ml-2 font-medium text-gray-800">{extraction.precision?.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-gray-500">Recall:</span>
              <span className="ml-2 font-medium text-gray-800">{extraction.recall?.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-gray-500">F1 Score:</span>
              <span className="ml-2 font-medium text-gray-800">{extraction.f1Score?.toFixed(3)}</span>
            </div>
          </div>
        </div>
      )}

      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Extracted Entities</h3>
        
        {Object.entries(groupedEntities).map(([type, typeEntities]) => {
          const Icon = entityIcons[type] || FileText;
          const colorClass = entityColors[type] || entityColors.UNKNOWN;
          
          return (
            <div key={type} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className={`px-4 py-3 border-b flex items-center justify-between ${colorClass}`}>
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5" />
                  <span className="font-semibold">{type.replace(/_/g, ' ')}</span>
                  <span className="text-sm opacity-75">({typeEntities.length})</span>
                </div>
              </div>
              
              <div className="divide-y divide-gray-100">
                {typeEntities.map((entity, index) => (
                  <div key={index} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{entity.entityValue}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Method: {extractionMethodLabels[entity.extractionMethod] || entity.extractionMethod}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        entity.confidenceScore > 90 ? 'bg-green-100 text-green-700' :
                        entity.confidenceScore > 70 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {entity.confidenceScore?.toFixed(1)}%
                      </div>
                      
                      
                      {entity.positionX !== null && (
                        <div className="text-xs text-gray-400">
                          ({entity.positionX}, {entity.positionY})
                        </div>
                      )}
                      
                      {entity.confidenceScore > 80 ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EntityDashboard;
