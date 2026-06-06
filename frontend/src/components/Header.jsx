import React from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Download, 
  FileImage, 
  Loader2 
} from 'lucide-react';

/**
 * Header Component - Navigation bar with main actions
 * 
 * Demonstrates:
 * - Professional UI design patterns
 * - Loading states and animations
 * - Conditional rendering based on state
 * - Icon integration with Lucide React
 */
function Header({ 
  onExtractText, 
  onNewImage, 
  onDownloadImage, 
  hasImage, 
  hasTextElements, 
  isExtracting 
}) {
  return (
    <motion.header 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="bg-white border-b border-gray-200 shadow-sm"
    >
      <div className="max-w-full px-6 py-4">
        <div className="flex items-center justify-between">
          
          <div className="flex items-center space-x-3">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-soft">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                PhoText<span className="text-primary-600">Pro</span>
              </h1>
            </motion.div>
            
            
            <div className="hidden md:block">
              <p className="text-sm text-gray-500">
                AI-Powered OCR Text Editor
              </p>
            </div>
          </div>

          
          <div className="flex items-center space-x-3">
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onExtractText}
              disabled={!hasImage || isExtracting}
              className={`
                flex items-center space-x-2 px-6 py-2.5 rounded-xl font-medium
                transition-all duration-200 shadow-soft hover:shadow-medium
                ${hasImage && !isExtracting 
                  ? 'bg-primary-500 hover:bg-primary-600 text-white' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Extracting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Extract Text</span>
                </>
              )}
            </motion.button>

            
            {hasTextElements && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onDownloadImage}
                className="flex items-center space-x-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all duration-200 shadow-soft hover:shadow-medium"
              >
                <Download className="w-5 h-5" />
                <span className="hidden sm:inline">Download</span>
              </motion.button>
            )}

            
            {hasImage && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onNewImage}
                className="flex items-center space-x-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium border border-gray-200 transition-all duration-200 shadow-soft hover:shadow-medium"
              >
                <FileImage className="w-5 h-5" />
                <span className="hidden sm:inline">New Image</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}

export default Header;
