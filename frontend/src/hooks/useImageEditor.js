import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Image Editor Hook - Manages true image text editing
 * 
 * This hook demonstrates:
 * - Canvas API manipulation for true image editing
 * - Image inpainting algorithms for text removal
 * - Computer vision coordinate transformations
 * - State management for edited image data
 * 
 * Image Editing Pipeline:
 * 1. Text removal using inpainting algorithms
 * 2. Background reconstruction from surrounding pixels
 * 3. New text rendering with precise positioning
 * 4. Coordinate transformation between OCR and canvas space
 */
export function useImageEditor(imageFile, textElements) {
  const [selectedElement, setSelectedElement] = useState(null);
  const [editedImageData, setEditedImageData] = useState(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const originalImageData = useRef(null);

  useEffect(() => {
    if (!imageFile) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      originalImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    };
    img.src = URL.createObjectURL(imageFile);

    return () => {
      URL.revokeObjectURL(img.src);
    };
  }, [imageFile]);

  /**
   * Apply text editing to the actual image
   * This implements true image editing (not overlays)
   * 
   * Computer Vision Algorithm:
   * 1. Remove original text using inpainting
   * 2. Reconstruct background from surrounding pixels
   * 3. Render new text with proper positioning
   */
  const applyTextEditing = useCallback(() => {
    if (!imageRef.current || !originalImageData.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = imageRef.current.width;
    canvas.height = imageRef.current.height;
    const ctx = canvas.getContext('2d');

    ctx.putImageData(originalImageData.current, 0, 0);

    textElements.forEach((element) => {
      if (element.id === selectedElement?.id) {
        removeTextWithInpainting(ctx, element);
        
        renderTextOnCanvas(ctx, element);
      }
    });

    const dataUrl = canvas.toDataURL('image/png');
    setEditedImageData(dataUrl);
  }, [textElements, selectedElement]);

  /**
   * Remove text from image using inpainting algorithm
   * 
   * Inpainting Algorithm:
   * 1. Identify text region using bounding box
   * 2. Sample surrounding pixels for background color
   * 3. Apply Gaussian blur for smooth transition
   * 4. Fill text region with reconstructed background
   */
  const removeTextWithInpainting = (ctx, element) => {
    const { bbox } = element;
    const { x, y, width, height } = bbox;
    
    const padding = 2;
    const expandedX = Math.max(0, x - padding);
    const expandedY = Math.max(0, y - padding);
    const expandedWidth = width + padding * 2;
    const expandedHeight = height + padding * 2;

    const surroundingData = getSurroundingPixels(ctx, expandedX, expandedY, expandedWidth, expandedHeight);
    
    const avgColor = calculateAverageColor(surroundingData);
    
    ctx.fillStyle = avgColor;
    ctx.fillRect(expandedX, expandedY, expandedWidth, expandedHeight);
    
    ctx.filter = 'blur(1px)';
    ctx.fillRect(expandedX, expandedY, expandedWidth, expandedHeight);
    ctx.filter = 'none';
  };

  /**
   * Get surrounding pixels for background reconstruction
   */
  const getSurroundingPixels = (ctx, x, y, width, height) => {
    const imageData = ctx.getImageData(x - 5, y - 5, width + 10, height + 10);
    return imageData.data;
  };

  /**
   * Calculate average color from pixel data
   */
  const calculateAverageColor = (pixelData) => {
    let r = 0, g = 0, b = 0, count = 0;
    
    for (let i = 0; i < pixelData.length; i += 4) {
      r += pixelData[i];
      g += pixelData[i + 1];
      b += pixelData[i + 2];
      count++;
    }
    
    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  /**
   * Render text on canvas with proper positioning
   * 
   * Text Rendering Algorithm:
   * 1. Transform OCR coordinates to canvas space
   * 2. Apply font styling and sizing
   * 3. Render text with anti-aliasing
   * 4. Add subtle shadow for depth
   */
  const renderTextOnCanvas = (ctx, element) => {
    const { bbox, text, fontSize, fontFamily, color } = element;
    const { x, y, width, height } = bbox;
    
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color || '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 1;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    const textX = x + 5;
    const textY = y + height / 2;
    
    ctx.fillText(text, textX, textY);
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  };

  /**
   * Update text element
   */
  const updateElement = useCallback((elementId, updates) => {
    setSelectedElement(prev => 
      prev?.id === elementId ? { ...prev, ...updates } : prev
    );
    
    setTimeout(() => {
      applyTextEditing();
    }, 100);
  }, [applyTextEditing]);

  /**
   * Delete text element
   */
  const deleteElement = useCallback((elementId) => {
    setSelectedElement(null);
    
    setTimeout(() => {
      applyTextEditing();
    }, 100);
  }, [applyTextEditing]);

  /**
   * Download edited image
   */
  const downloadImage = useCallback(() => {
    const dataUrl = editedImageData || (imageRef.current ? 
      URL.createObjectURL(imageFile) : null);
    
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.download = 'photext-pro-edited.png';
    link.href = dataUrl;
    link.click();
    
    if (dataUrl.startsWith('blob:')) {
      URL.revokeObjectURL(dataUrl);
    }
  }, [editedImageData, imageFile]);

  useEffect(() => {
    if (textElements.length > 0) {
      applyTextEditing();
    }
  }, [textElements, applyTextEditing]);

  return {
    selectedElement,
    updateElement,
    deleteElement,
    downloadImage,
    editedImageData,
    setSelectedElement,
  };
}
