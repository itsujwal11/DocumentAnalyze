import { useState, useCallback } from 'react';

/**
 * OCR Hook - Manages OCR text extraction process
 * 
 * This hook demonstrates:
 * - Async state management with React hooks
 * - Progress tracking for long-running operations
 * - Error handling and user feedback
 * - Integration with backend OCR service
 * 
 * OCR Pipeline (LSTM-based):
 * 1. Image preprocessing (normalization, noise reduction)
 * 2. Text detection (connected component analysis)
 * 3. Character recognition (LSTM neural networks)
 * 4. Post-processing (confidence scoring, text reconstruction)
 */
export function useOCR() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [textElements, setTextElements] = useState([]);
  const [error, setError] = useState(null);

  /**
   * Extract text from image using OCR
   * 
   * @param {File} imageFile - The image file to process
   * @returns {Promise<Array>} Array of detected text elements
   */
  const extractText = useCallback(async (imageFile) => {
    if (!imageFile) {
      setError('Please select an image first');
      return;
    }

    setIsExtracting(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', imageFile);

      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 15;
        });
      }, 200);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        throw new Error(`OCR processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.data || !result.data.words || !Array.isArray(result.data.words)) {
        throw new Error('Invalid OCR response format');
      }

      const elements = result.data.words.map((word, index) => ({
        id: word.id || `text-${index}`,
        text: word.text || '',
        bbox: word.bbox || { x: 0, y: 0, width: 100, height: 30 },
        confidence: word.confidence || 85,
        fontSize: word.fontSize || Math.max(12, Math.min(32, (word.bbox?.height || 30) * 0.75)),
        fontFamily: word.fontFamily || detectFont(word),
        color: '#000000', // Will be extracted from image later
        originalIndex: index,
        baseline: word.baseline || word.bbox.y + word.bbox.height * 0.85,
        angle: word.angle || 0,
        spacing: word.spacing || 5,
        attributes: word.attributes || {
          bold: false,
          italic: false,
          underline: false
        },
        lineId: word.lineId || null,
        blockId: word.blockId || null,
      }));

      setTextElements(elements);
      
      setTimeout(() => {
        setProgress(100);
        setIsExtracting(false);
      }, 500);

      return elements;

    } catch (err) {
      console.error('OCR extraction error:', err);
      setError(err.message || 'OCR processing failed');
      setIsExtracting(false);
      setProgress(0);
      return [];
    }
  }, []);

  /**
   * Detect font family from OCR data
   * This is a simplified font detection - in production, would use 
   * more sophisticated font matching algorithms
   */
  const detectFont = (wordData) => {
    const text = wordData.text || '';
    
    if (text.length > 0) {
      if (/[A-Z]/.test(text) && text.length < 5) {
        return 'Georgia, serif'; // Likely a heading
      }
      if (/[0-9]/.test(text)) {
        return 'JetBrains Mono, monospace'; // Likely numeric data
      }
    }
    
    return 'Inter, sans-serif'; // Default font
  };

  /**
   * Reset OCR state
   */
  const reset = useCallback(() => {
    setIsExtracting(false);
    setProgress(0);
    setTextElements([]);
    setError(null);
  }, []);

  return {
    extractText,
    isExtracting,
    progress,
    textElements,
    error,
    reset,
  };
}
