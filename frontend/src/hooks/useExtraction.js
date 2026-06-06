import { useState, useCallback } from 'react';

/**
 * Extraction Hook - Manages text extraction with entity recognition
 * 
 * This hook integrates with the Java Spring Boot backend:
 * - OCR processing using Tesseract
 * - Named Entity Recognition (NER)
 * - Entity extraction using Regex, CRF
 * - Export functionality
 */

const API_BASE_URL = 'http://localhost:8080/api';

export function useExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractionResult, setExtractionResult] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Upload image and extract text with entities
   */
  const extractFromImage = useCallback(async (imageFile, documentType = null) => {
    if (!imageFile) {
      setError('Please select an image first');
      return null;
    }

    setIsExtracting(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      if (documentType) {
        formData.append('documentType', documentType);
      }

      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 15;
        });
      }, 300);

      const response = await fetch(`${API_BASE_URL}/extractions/upload`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Extraction failed');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Extraction failed');
      }

      setExtractionResult(result.data);
      
      setTimeout(() => {
        setIsExtracting(false);
      }, 500);

      return result.data;

    } catch (err) {
      console.error('Extraction error:', err);
      setError(err.message || 'Extraction processing failed');
      setIsExtracting(false);
      setProgress(0);
      return null;
    }
  }, []);

  /**
   * Get extraction by ID
   */
  const getExtraction = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/extractions/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch extraction');
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (err) {
      console.error('Fetch extraction error:', err);
      setError(err.message);
      return null;
    }
  }, []);

  /**
   * Get all extractions
   */
  const getAllExtractions = useCallback(async (page = 0, size = 10) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/extractions?page=${page}&size=${size}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch extractions');
      }

      const result = await response.json();
      return result.success ? result.data : [];
    } catch (err) {
      console.error('Fetch extractions error:', err);
      setError(err.message);
      return [];
    }
  }, []);

  /**
   * Search extractions
   */
  const searchExtractions = useCallback(async (query, page = 0, size = 10) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/extractions/search?query=${encodeURIComponent(query)}&page=${page}&size=${size}`
      );
      
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const result = await response.json();
      return result.success ? result.data : [];
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message);
      return [];
    }
  }, []);

  /**
   * Get extraction statistics
   */
  const getStatistics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/extractions/statistics`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (err) {
      console.error('Fetch statistics error:', err);
      setError(err.message);
      return null;
    }
  }, []);

  /**
   * Export extraction
   */
  const exportExtraction = useCallback(async (id, format) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/extractions/${id}/export/${format}`
      );
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `extraction_${id}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (err) {
      console.error('Export error:', err);
      setError(err.message);
      return false;
    }
  }, []);

  /**
   * Delete extraction
   */
  const deleteExtraction = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/extractions/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Delete failed');
      }

      const result = await response.json();
      return result.success;
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.message);
      return false;
    }
  }, []);

  /**
   * Reset extraction state
   */
  const reset = useCallback(() => {
    setIsExtracting(false);
    setProgress(0);
    setExtractionResult(null);
    setError(null);
  }, []);

  return {
    extractFromImage,
    getExtraction,
    getAllExtractions,
    searchExtractions,
    getStatistics,
    exportExtraction,
    deleteExtraction,
    isExtracting,
    progress,
    extractionResult,
    error,
    reset,
  };
}
