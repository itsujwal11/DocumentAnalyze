import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  Image as ImageIcon, 
  FileImage,
  AlertCircle 
} from 'lucide-react';

/**
 * Upload Area Component - Drag and drop image upload
 * 
 * Demonstrates:
 * - File upload handling with drag and drop
 * - Image validation and preview
 * - Smooth animations and transitions
 * - Error handling and user feedback
 */
function UploadArea({ onImageUpload }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Validate uploaded file
   */
  const validateFile = (file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPEG, PNG, or WebP)');
      return false;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('Image size must be less than 10MB');
      return false;
    }

    setError(null);
    return true;
  };

  /**
   * Handle file upload
   */
  const handleFileUpload = useCallback((file) => {
    if (!validateFile(file)) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
      setTimeout(() => {
        onImageUpload(file);
      }, 300);
    };
    reader.readAsDataURL(file);
  }, [onImageUpload]);

  /**
   * Handle drag events
   */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileUpload(imageFile);
    } else {
      setError('Please drop an image file');
    }
  }, [handleFileUpload]);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center
          transition-all duration-300 cursor-pointer
          ${isDragOver 
            ? 'border-primary-500 bg-primary-50 shadow-medium' 
            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
          }
        `}
      >
        
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        
        <AnimatePresence mode="wait">
          {!previewImage ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              
              <motion.div
                animate={{ 
                  scale: isDragOver ? 1.1 : 1,
                  rotate: isDragOver ? 5 : 0 
                }}
                transition={{ duration: 0.2 }}
                className="w-20 h-20 mx-auto"
              >
                <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center">
                  <Upload className="w-10 h-10 text-primary-600" />
                </div>
              </motion.div>

              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-gray-900">
                  {isDragOver ? 'Drop your image here' : 'Upload your image'}
                </h3>
                <p className="text-gray-500">
                  Drag and drop or click to browse
                </p>
                <p className="text-sm text-gray-400">
                  Supports JPEG, PNG, WebP (max 10MB)
                </p>
              </div>

              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-all duration-200 shadow-soft hover:shadow-medium"
              >
                Browse Files
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-4"
            >
              
              <div className="relative">
                <img
                  src={previewImage}
                  alt="Preview"
                  className="w-full h-64 object-cover rounded-xl shadow-soft"
                />
                <div className="absolute inset-0 bg-black/10 rounded-xl flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl"
                  >
                    <p className="text-sm font-medium text-gray-700">Image loaded</p>
                  </motion.div>
                </div>
              </div>

              
              <div className="flex items-center justify-center space-x-2 text-green-600">
                <FileImage className="w-5 h-5" />
                <span className="font-medium">Image ready for OCR processing</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 rounded-xl p-3"
            >
              <div className="flex items-center space-x-2 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {[
          { icon: ImageIcon, title: 'Smart OCR', desc: 'AI-powered text detection' },
          { icon: Upload, title: 'Easy Upload', desc: 'Drag & drop interface' },
          { icon: FileImage, title: 'Multiple Formats', desc: 'JPEG, PNG, WebP support' }
        ].map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            className="bg-white rounded-xl p-4 text-center shadow-soft border border-gray-100"
          >
            <feature.icon className="w-8 h-8 text-primary-500 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900 text-sm">{feature.title}</h4>
            <p className="text-xs text-gray-500 mt-1">{feature.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export default UploadArea;
