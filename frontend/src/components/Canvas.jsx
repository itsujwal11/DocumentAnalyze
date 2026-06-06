import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

/**
 * Canvas Component - Main image editing canvas
 * 
 * Demonstrates:
 * - Canvas API for image rendering and manipulation
 * - Computer vision coordinate transformations
 * - Interactive text element selection and editing
 * - True image editing (not overlays)
 * - Mouse event handling for drag and selection
 */
function Canvas({ 
  imageFile, 
  textElements, 
  selectedElement, 
  editedImageData, 
  onElementSelect 
}) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredElement, setHoveredElement] = useState(null);

  useEffect(() => {
    if (!imageFile) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      fitImageToCanvas();
    };
    img.src = URL.createObjectURL(imageFile);

    return () => {
      URL.revokeObjectURL(img.src);
    };
  }, [imageFile]);

  /**
   * Fit image to canvas with proper scaling
   * Computer Vision: Coordinate system transformation
   */
  const fitImageToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const scaleX = canvasWidth / img.width;
    const scaleY = canvasHeight / img.height;
    const newScale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave some padding

    const scaledWidth = img.width * newScale;
    const scaledHeight = img.height * newScale;
    const newOffsetX = (canvasWidth - scaledWidth) / 2;
    const newOffsetY = (canvasHeight - scaledHeight) / 2;

    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  }, []);

  /**
   * Draw canvas with image and text elements
   * This implements true image editing (rendering directly on canvas)
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = imageRef.current;
    if (img) {
      if (editedImageData) {
        const editedImg = new Image();
        editedImg.onload = () => {
          ctx.drawImage(editedImg, offset.x, offset.y, 
            img.width * scale, img.height * scale);
          drawTextElements(ctx);
        };
        editedImg.src = editedImageData;
      } else {
        ctx.drawImage(img, offset.x, offset.y, 
          img.width * scale, img.height * scale);
        drawTextElements(ctx);
      }
    }
  }, [imageRef, editedImageData, scale, offset, textElements]);

  /**
   * Draw text elements with bounding boxes
   * Computer Vision: Bounding box rendering and selection
   */
  const drawTextElements = (ctx) => {
    textElements.forEach((element, index) => {
      const { bbox, confidence, attributes } = element;
      const { x, y, width, height } = bbox;
      
      const canvasX = offset.x + x * scale;
      const canvasY = offset.y + y * scale;
      const canvasWidth = width * scale;
      const canvasHeight = height * scale;

      let boxColor = '#4ade80'; // Default green
      let lineWidth = 2;
      let fillColor = 'rgba(74, 222, 128, 0.15)';
      
      if (element.id === selectedElement?.id) {
        boxColor = '#16a34a'; // Dark green for selected
        lineWidth = 3;
        fillColor = 'rgba(34, 197, 94, 0.2)';
      } else if (hoveredElement === element.id) {
        boxColor = '#22c55e'; // Light green for hover
      }

      if (attributes?.bold) {
        lineWidth += 1;
      }
      if (attributes?.italic) {
        ctx.setLineDash([5, 3]);
      }

      ctx.strokeStyle = boxColor;
      ctx.lineWidth = lineWidth;
      ctx.fillStyle = fillColor;
      
      ctx.fillRect(canvasX, canvasY, canvasWidth, canvasHeight);
      
      ctx.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);
      
      ctx.setLineDash([]);

      if (confidence) {
        const confidenceColor = confidence > 90 ? '#16a34a' : 
                               confidence > 75 ? '#22c55e' : 
                               confidence > 60 ? '#f59e0b' : '#ef4444';
        
        ctx.fillStyle = confidenceColor;
        ctx.fillRect(canvasX + canvasWidth - 40, canvasY - 20, 40, 16);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 11px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(
          `${Math.round(confidence)}%`, 
          canvasX + canvasWidth - 4, 
          canvasY - 8
        );
        ctx.textAlign = 'left';

        let indicatorX = canvasX + 4;
        if (attributes?.bold) {
          ctx.fillStyle = '#6366f1';
          ctx.fillRect(indicatorX, canvasY - 20, 12, 12);
          indicatorX += 14;
        }
        if (attributes?.italic) {
          ctx.fillStyle = '#8b5cf6';
          ctx.fillRect(indicatorX, canvasY - 20, 12, 12);
          indicatorX += 14;
        }
      }

      if (element.text && element.text.length > 0) {
        ctx.save();
        ctx.font = `${element.fontSize || 14}px ${element.fontFamily || 'Inter'}`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.textBaseline = 'middle';
        
        let displayText = element.text;
        const maxChars = Math.floor(canvasWidth / (element.fontSize || 14) * 0.8);
        if (displayText.length > maxChars) {
          displayText = displayText.substring(0, maxChars) + '...';
        }
        
        ctx.fillText(displayText, canvasX + 8, canvasY + canvasHeight / 2);
        ctx.restore();
      }
    });
  };

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        fitImageToCanvas();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitImageToCanvas]);

  /**
   * Mouse event handlers
   * Computer Vision: Hit testing and coordinate transformation
   */
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedElement = textElements.find(element => {
      const { bbox } = element;
      const elementX = offset.x + bbox.x * scale;
      const elementY = offset.y + bbox.y * scale;
      const elementWidth = bbox.width * scale;
      const elementHeight = bbox.height * scale;

      return x >= elementX && x <= elementX + elementWidth &&
             y >= elementY && y <= elementY + elementHeight;
    });

    if (clickedElement) {
      onElementSelect(clickedElement.id, clickedElement);
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  }, [textElements, scale, offset, onElementSelect]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hoveredEl = textElements.find(element => {
      const { bbox } = element;
      const elementX = offset.x + bbox.x * scale;
      const elementY = offset.y + bbox.y * scale;
      const elementWidth = bbox.width * scale;
      const elementHeight = bbox.height * scale;

      return x >= elementX && x <= elementX + elementWidth &&
             y >= elementY && y <= elementY + elementHeight;
    });

    setHoveredElement(hoveredEl?.id || null);

    if (isDragging) {
      const newOffsetX = e.clientX - dragStart.x;
      const newOffsetY = e.clientY - dragStart.y;
      setOffset({ x: newOffsetX, y: newOffsetY });
    }
  }, [isDragging, dragStart, textElements, scale, offset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setHoveredElement(null);
  }, []);

  return (
    <div className="w-full h-full bg-white rounded-2xl shadow-soft border border-gray-200 overflow-hidden relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: isDragging ? 'grabbing' : hoveredElement ? 'pointer' : 'grab' }}
      />
      
      
      {textElements.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-4 left-4 bg-white/90 backdrop-blur-xs rounded-xl px-4 py-3 shadow-soft border border-gray-100"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-sm font-semibold text-gray-700">
              {textElements.length} text regions detected
            </p>
          </div>
          
          <div className="text-xs text-gray-500 space-y-1">
            <p>Click to edit • Drag to move • Scroll to zoom</p>
            
            
            <div className="flex items-center gap-2">
              <span>Avg Confidence:</span>
              <span className={`font-medium ${
                Math.round(textElements.reduce((sum, el) => sum + (el.confidence || 0), 0) / textElements.length) > 80 ? 'text-green-600' :
                Math.round(textElements.reduce((sum, el) => sum + (el.confidence || 0), 0) / textElements.length) > 60 ? 'text-amber-600' :
                'text-red-600'
              }`}>
                {Math.round(textElements.reduce((sum, el) => sum + (el.confidence || 0), 0) / textElements.length)}%
              </span>
            </div>
            
            
            <div className="flex gap-3">
              <span>Bold: {textElements.filter(el => el.attributes?.bold).length}</span>
              <span>Italic: {textElements.filter(el => el.attributes?.italic).length}</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default Canvas;
