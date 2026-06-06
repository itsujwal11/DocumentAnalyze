import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Loader2, 
  CheckCircle 
} from 'lucide-react';

/**
 * OCR Progress Component - Loading overlay with progress tracking
 * 
 * Demonstrates:
 * - Smooth progress animations
 * - Loading state management
 * - Professional UI feedback
 * - Component composition patterns
 */
function OCRProgress({ progress }) {
  const progressStages = [
    { label: 'Analyzing image...', min: 0, max: 20 },
    { label: 'Detecting text regions...', min: 20, max: 40 },
    { label: 'Extracting characters...', min: 40, max: 70 },
    { label: 'Processing with AI...', min: 70, max: 90 },
    { label: 'Finalizing results...', min: 90, max: 100 },
  ];

  const getCurrentStage = () => {
    return progressStages.find(stage => progress >= stage.min && progress <= stage.max) || progressStages[0];
  };

  const currentStage = getCurrentStage();
  const stageProgress = ((progress - currentStage.min) / (currentStage.max - currentStage.min)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl p-8 w-96 shadow-strong"
      >
        
        <div className="text-center mb-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-medium"
          >
            <Brain className="w-8 h-8 text-white" />
          </motion.div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Extracting Text Using AI OCR
          </h3>
          
          <AnimatePresence mode="wait">
            <motion.p
              key={currentStage.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-sm text-gray-600"
            >
              {currentStage.label}
            </motion.p>
          </AnimatePresence>
        </div>

        
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span className="font-medium text-primary-600">{Math.round(progress)}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full relative"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            >
              
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          </div>
        </div>

        
        <div className="flex justify-between mb-6">
          {progressStages.map((stage, index) => {
            const isActive = progress >= stage.min;
            const isCurrent = currentStage.label === stage.label;
            
            return (
              <motion.div
                key={stage.label}
                className="flex flex-col items-center space-y-1"
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ 
                  scale: isActive ? 1 : 0.8, 
                  opacity: isActive ? 1 : 0.5 
                }}
                transition={{ duration: 0.3 }}
              >
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {isActive ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="w-1 h-8 bg-gray-200" />
              </motion.div>
            );
          })}
        </div>

        
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Status:</span>
            <span className="font-medium text-primary-600">
              {progress === 100 ? 'Complete' : 'Processing...'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">AI Model:</span>
            <span className="font-medium text-gray-900">LSTM OCR v2.0</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Quality:</span>
            <span className="font-medium text-gray-900">High Precision</span>
          </div>
        </div>

        
        {progress < 100 && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full mt-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
          >
            Cancel Processing
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}

export default OCRProgress;
