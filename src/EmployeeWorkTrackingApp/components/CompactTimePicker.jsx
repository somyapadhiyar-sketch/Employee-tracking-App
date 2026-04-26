import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CompactTimePicker = ({ value, onChange, isDark, themeColor = 'blue' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current value or default to 00:00:00
  const [h, m, s] = (value || '00:00:00').split(':').map(val => val || '00');
  
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const seconds = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (type, val) => {
    let newH = h, newM = m, newS = s;
    if (type === 'h') newH = val;
    if (type === 'm') newM = val;
    if (type === 's') newS = val;
    onChange(`${newH}:${newM}:${newS}`);
  };

  const themeClasses = {
    blue: 'bg-blue-600 text-white',
    violet: 'bg-violet-600 text-white',
  };

  const hoverClasses = {
    blue: 'hover:bg-blue-500 hover:text-white',
    violet: 'hover:bg-violet-500 hover:text-white',
  };

  return (
    <div className="relative flex-1" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-3 py-2.5 border-2 rounded-xl cursor-pointer transition-all ${
          isOpen ? `border-${themeColor}-500 shadow-sm` : isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className="flex gap-1.5 overflow-hidden">
          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${isDark ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800 border border-gray-100'} shadow-sm`}>{h}</span>
          <span className={`text-xs font-bold flex items-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>:</span>
          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${isDark ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800 border border-gray-100'} shadow-sm`}>{m}</span>
          <span className={`text-xs font-bold flex items-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>:</span>
          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${isDark ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800 border border-gray-100'} shadow-sm`}>{s}</span>
        </div>
        <i className={`fas fa-chevron-down text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}></i>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`absolute left-0 right-0 mt-2 z-[200] p-3 rounded-2xl shadow-2xl border flex gap-2 ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
            }`}
          >
            {/* Hours */}
            <div className="flex-1">
              <p className={`text-[10px] font-bold text-center mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>HH</p>
              <div className="h-40 overflow-y-auto scrollbar-hide flex flex-col gap-1">
                {hours.map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelect('h', val)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      h === val ? themeClasses[themeColor] : isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes */}
            <div className="flex-1">
              <p className={`text-[10px] font-bold text-center mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>MM</p>
              <div className="h-40 overflow-y-auto scrollbar-hide flex flex-col gap-1">
                {minutes.map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelect('m', val)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      m === val ? themeClasses[themeColor] : isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Seconds */}
            <div className="flex-1">
              <p className={`text-[10px] font-bold text-center mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>SS</p>
              <div className="h-40 overflow-y-auto scrollbar-hide flex flex-col gap-1">
                {seconds.map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelect('s', val)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      s === val ? themeClasses[themeColor] : isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CompactTimePicker;
