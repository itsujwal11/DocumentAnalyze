import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Type, 
  Palette, 
  Sliders, 
  Trash2, 
  Check,
  X
} from 'lucide-react';

/**
 * Text Editor Component - Right sidebar for text editing
 * 
 * Demonstrates:
 * - Form handling and state management
 * - Real-time text editing with immediate updates
 * - Font styling and color customization
 * - Professional UI with smooth animations
 * - Integration with canvas editing system
 */
function TextEditor({ 
  selectedElement, 
  onUpdateElement, 
  onDeleteElement, 
  textElements 
}) {
  const [localText, setLocalText] = useState('');
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState('Inter, sans-serif');
  const [textColor, setTextColor] = useState('#000000');

  useEffect(() => {
    if (selectedElement) {
      setLocalText(selectedElement.text || '');
      setFontSize(selectedElement.fontSize || 18);
      setFontFamily(selectedElement.fontFamily || 'Inter, sans-serif');
      setTextColor(selectedElement.color || '#000000');
    }
  }, [selectedElement]);

  /**
   * Handle text change with immediate update
   */
  const handleTextChange = (newText) => {
    setLocalText(newText);
    if (selectedElement) {
      onUpdateElement(selectedElement.id, { text: newText });
    }
  };

  /**
   * Handle font size change
   */
  const handleFontSizeChange = (newSize) => {
    setFontSize(newSize);
    if (selectedElement) {
      onUpdateElement(selectedElement.id, { fontSize: newSize });
    }
  };

  /**
   * Handle font family change
   */
  const handleFontFamilyChange = (newFamily) => {
    setFontFamily(newFamily);
    if (selectedElement) {
      onUpdateElement(selectedElement.id, { fontFamily: newFamily });
    }
  };

  /**
   * Handle color change
   */
  const handleColorChange = (newColor) => {
    setTextColor(newColor);
    if (selectedElement) {
      onUpdateElement(selectedElement.id, { color: newColor });
    }
  };

  /**
   * Handle element deletion
   */
  const handleDelete = () => {
    if (selectedElement) {
      onDeleteElement(selectedElement.id);
    }
  };

  const fontOptions = [
    { value: 'Inter, sans-serif', label: 'Inter' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: 'Times New Roman, serif', label: 'Times New Roman' },
    { value: 'Courier New, monospace', label: 'Courier New' },
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Verdana, sans-serif', label: 'Verdana' },
  ];

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-80 bg-white border-l border-gray-200 flex flex-col h-full"
    >
      
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Type className="w-5 h-5 text-primary-500" />
            Text Editor
          </h3>
          <AnimatePresence>
            {selectedElement && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="w-2 h-2 bg-primary-500 rounded-full"
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {selectedElement ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Type className="w-4 h-4" />
                  Text Content
                </label>
                <div className="relative">
                  <textarea
                    value={localText}
                    onChange={(e) => handleTextChange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 resize-none"
                    rows={3}
                    placeholder="Enter your text here..."
                  />
                  
                  <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    {localText.length}
                  </div>
                </div>
              </div>

              
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Sliders className="w-4 h-4" />
                  Font Size
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="12"
                    max="72"
                    value={fontSize}
                    onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
                    className="w-full accent-primary-500"
                  />
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>12px</span>
                    <span className="font-medium text-primary-600">{fontSize}px</span>
                    <span>72px</span>
                  </div>
                </div>
              </div>

              
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Type className="w-4 h-4" />
                  Font Family
                </label>
                <select
                  value={fontFamily}
                  onChange={(e) => handleFontFamilyChange(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                >
                  {fontOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Palette className="w-4 h-4" />
                  Text Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-16 h-16 rounded-xl border-2 border-gray-200 cursor-pointer"
                  />
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={textColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                      placeholder="#000000"
                    />
                    
                    <div className="flex space-x-2">
                      {['#000000', '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#f59e0b'].map(color => (
                        <button
                          key={color}
                          onClick={() => handleColorChange(color)}
                          className="w-6 h-6 rounded-md border border-gray-300 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Element Info</h4>
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Confidence:</span>
                    <span className="font-medium">
                      {selectedElement.confidence ? `${Math.round(selectedElement.confidence)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Position:</span>
                    <span className="font-medium">
                      ({Math.round(selectedElement.bbox?.x || 0)}, {Math.round(selectedElement.bbox?.y || 0)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Size:</span>
                    <span className="font-medium">
                      {Math.round(selectedElement.bbox?.width || 0)} × {Math.round(selectedElement.bbox?.height || 0)}
                    </span>
                  </div>
                </div>
              </div>

              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDelete}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Text Element
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center h-full text-center space-y-4"
            >
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                <Type className="w-8 h-8 text-gray-400" />
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">No Text Selected</h4>
                <p className="text-sm text-gray-500">
                  Click on a green bounding box in the canvas to edit text
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      
      {textElements.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total elements:</span>
            <span className="font-medium text-gray-900">{textElements.length}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default TextEditor;
