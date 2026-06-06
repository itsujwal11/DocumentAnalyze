import React from 'react';
import { motion } from 'framer-motion';
import { 
  Image as ImageIcon, 
  Layers, 
  Zap, 
  Settings,
  Info 
} from 'lucide-react';

/**
 * Sidebar Component - Left toolbar with tools and info
 * 
 * Demonstrates:
 * - Professional tool organization
 * - State-based UI updates
 * - Progress indicators and status displays
 * - Tooltips and user guidance
 */
function Sidebar({ 
  imageFile, 
  textElements, 
  selectedElement, 
  onElementSelect, 
  isExtracting 
}) {
  const tools = [
    {
      icon: ImageIcon,
      label: 'Image',
      description: 'Image information',
      active: !!imageFile,
    },
    {
      icon: Layers,
      label: 'Layers',
      description: 'Text elements',
      active: textElements.length > 0,
      badge: textElements.length,
    },
    {
      icon: Zap,
      label: 'OCR',
      description: 'Text extraction',
      active: isExtracting,
      loading: isExtracting,
    },
    {
      icon: Settings,
      label: 'Settings',
      description: 'Preferences',
      active: false,
    },
  ];

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-20 bg-white border-r border-gray-200 flex flex-col"
    >
      
      <div className="flex-1 py-4 space-y-2">
        {tools.map((tool, index) => (
          <motion.button
            key={tool.label}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
              relative w-14 h-14 mx-auto rounded-xl flex items-center justify-center
              transition-all duration-200 group
              ${tool.active 
                ? 'bg-primary-500 text-white shadow-medium' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
            `}
            title={tool.description}
          >
            <tool.icon className={`
              w-6 h-6 
              ${tool.loading ? 'animate-spin' : ''}
            `} />
            
            
            {tool.badge && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium"
              >
                {tool.badge}
              </motion.div>
            )}
            
            
            {tool.loading && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-2 border-primary-300 border-t-transparent rounded-xl"
              />
            )}
          </motion.button>
        ))}
      </div>

      
      <div className="p-4 space-y-4 border-t border-gray-200">
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-12 h-12 mx-auto bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center transition-all duration-200"
          title="Information"
        >
          <Info className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
}

export default Sidebar;
