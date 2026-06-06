import React, { useState, useEffect } from 'react';
import { 
  History, FileText, Trash2, Download, Search, 
  ChevronLeft, ChevronRight, Image as ImageIcon, 
  BarChart3, Eye, X
} from 'lucide-react';
import API_BASE from '../lib/api';

/**
 * Extraction History Component
 * 
 * Displays extraction history with:
 * - Pagination
 * - Search functionality
 * - Export options
 * - Delete operations
 * - Statistics view
 */

function ExtractionHistory({ onSelectExtraction }) {
  const [extractions, setExtractions] = useState([]);
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedExtraction, setSelectedExtraction] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  useEffect(() => {
    loadExtractions();
  }, [page, size]);

  const loadExtractions = async () => {
    setIsLoading(true);
    try {
      let url;
      if (searchQuery) {
        url = `${API_BASE}/extractions/search?query=${encodeURIComponent(searchQuery)}&page=${page}&size=${size}`;
      } else {
        url = `${API_BASE}/extractions?page=${page}&size=${size}`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setExtractions(result.data || []);
        setTotalPages(Math.max(1, Math.ceil((result.data?.length || 0) / size)));
      }
    } catch (error) {
      console.error('Failed to load extractions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    loadExtractions();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this extraction?')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/extractions/${id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setExtractions(extractions.filter(e => e.extraction.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete extraction:', error);
    }
  };

  const handleExport = async (id, format) => {
    try {
      const response = await fetch(`${API_BASE}/extractions/${id}/export/${format}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `extraction_${id}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEntityCount = (extraction) => {
    return extraction?.entities?.length || 0;
  };

  if (selectedExtraction) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Extraction Details
          </h3>
          <button 
            onClick={() => setSelectedExtraction(null)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">Filename</label>
              <p className="font-medium text-gray-800">{selectedExtraction.extraction.originalFilename}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Document Type</label>
              <p className="font-medium text-gray-800">{selectedExtraction.extraction.documentType}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Created</label>
              <p className="font-medium text-gray-800">{formatDate(selectedExtraction.extraction.createdAt)}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Entities Found</label>
              <p className="font-medium text-gray-800">{getEntityCount(selectedExtraction)}</p>
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-500">Extracted Text</label>
            <div className="mt-1 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-40 overflow-y-auto">
              {selectedExtraction.extraction.extractedText || 'No text extracted'}
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => onSelectExtraction && onSelectExtraction(selectedExtraction)}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              View Full Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <History className="w-5 h-5 text-blue-500" />
          Extraction History
        </h3>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={`Switch to ${viewMode === 'list' ? 'grid' : 'list'} view`}
          >
            {viewMode === 'list' ? <BarChart3 className="w-5 h-5 text-gray-600" /> : <FileText className="w-5 h-5 text-gray-600" />}
          </button>
        </div>
      </div>

      
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by filename or text..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Search
        </button>
      </form>

      
      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading extractions...</p>
        </div>
      )}

      
      {!isLoading && extractions.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-xl">
          <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No extractions found</p>
          <p className="text-sm text-gray-400">Upload an image to get started</p>
        </div>
      )}

      
      {!isLoading && extractions.length > 0 && (
        <>
          {viewMode === 'list' ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {extractions.map((item, index) => (
                  <div 
                    key={index} 
                    className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-800 truncate">
                          {item.extraction.originalFilename}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {formatDate(item.extraction.createdAt)} • {getEntityCount(item)} entities
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.extraction.ocrConfidence > 80 ? 'bg-green-100 text-green-700' :
                          item.extraction.ocrConfidence > 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {item.extraction.ocrConfidence?.toFixed(0)}%
                        </span>
                        
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                          {item.extraction.documentType}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-4">
                      <button
                        onClick={() => setSelectedExtraction(item)}
                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4 text-blue-600" />
                      </button>
                      
                      <div className="relative group">
                        <button className="p-2 hover:bg-green-100 rounded-lg transition-colors">
                          <Download className="w-4 h-4 text-green-600" />
                        </button>
                        
                        <div className="absolute right-0 top-full mt-1 bg-white shadow-lg border border-gray-200 rounded-lg py-1 hidden group-hover:block z-10">
                          <button
                            onClick={() => handleExport(item.extraction.id, 'json')}
                            className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            Export JSON
                          </button>
                          <button
                            onClick={() => handleExport(item.extraction.id, 'csv')}
                            className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            Export CSV
                          </button>
                          <button
                            onClick={() => handleExport(item.extraction.id, 'pdf')}
                            className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            Export PDF
                          </button>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDelete(item.extraction.id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {extractions.map((item, index) => (
                <div 
                  key={index}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedExtraction(item)}
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                    <ImageIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  
                  <h4 className="font-medium text-gray-800 truncate mb-1">
                    {item.extraction.originalFilename}
                  </h4>
                  
                  <p className="text-sm text-gray-500 mb-3">
                    {formatDate(item.extraction.createdAt)}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {getEntityCount(item)} entities
                    </span>
                    
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.extraction.ocrConfidence > 80 ? 'bg-green-100 text-green-700' :
                      item.extraction.ocrConfidence > 60 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.extraction.ocrConfidence?.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <span className="text-sm text-gray-600">
              Page {page + 1} of {totalPages}
            </span>
            
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ExtractionHistory;
