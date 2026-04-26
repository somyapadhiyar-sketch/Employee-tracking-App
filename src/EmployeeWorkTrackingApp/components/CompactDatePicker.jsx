import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CompactDatePicker = ({ value, onChange, isDark, themeColor = 'blue', align = 'left', size = 'md' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current date or default to today
  const selectedDate = useMemo(() => {
    if (!value) return new Date();
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [value]);

  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  // Reset view date when actual selection changes or when opening
  useEffect(() => {
    if (isOpen) {
      setViewDate(new Date(selectedDate));
    }
  }, [isOpen, selectedDate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = startDayOfMonth(year, month);
    
    const days = [];
    // Padding for previous month
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [viewDate]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelect = (date) => {
    if (!date) return;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date) => {
    if (!date) return false;
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  const themeClasses = {
    blue: 'bg-blue-600 text-white',
    violet: 'bg-violet-600 text-white shadow-lg shadow-violet-500/20',
  };

  const textClasses = {
    blue: 'text-blue-500',
    violet: 'text-violet-500',
  };

  const formatDateLabel = (val) => {
    if (!val) return 'Select Date';
    const d = new Date(val);
    if (isNaN(d.getTime())) return 'Select Date';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="relative block w-full" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between ${size === 'lg' ? 'px-4 py-3 border-2 font-bold' : size === 'sm' ? 'px-3 py-1.5 border' : 'px-4 py-2.5 border'} rounded-xl cursor-pointer transition-all w-full ${
          isOpen
            ? `border-${themeColor}-500 shadow-sm ${isDark ? 'bg-gray-800' : 'bg-white'}`
            : isDark ? 'bg-gray-800 border-gray-600 text-white' : `bg-white ${size === 'md' ? 'border-gray-300' : 'border-gray-200'} text-gray-800`
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <i className={`fas fa-calendar-alt text-xs ${isOpen ? textClasses[themeColor] : 'opacity-40'}`}></i>
          <span className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            {formatDateLabel(value)}
          </span>
        </div>
        <i className={`fas fa-chevron-down text-[8px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}></i>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 z-[300] min-w-[260px] p-4 rounded-2xl shadow-2xl border ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
              <button onClick={handlePrevMonth} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                <i className="fas fa-chevron-left text-xs"></i>
              </button>
              <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-800'}`}>
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </h3>
              <button onClick={handleNextMonth} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>

            {/* Week Labels */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className={`text-[10px] font-black text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarData.map((date, idx) => (
                <div key={idx} className="aspect-square">
                  {date ? (
                    <button
                      type="button"
                      onClick={() => handleSelect(date)}
                      className={`w-full h-full flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                        isSelected(date)
                          ? themeClasses[themeColor]
                          : isToday(date)
                          ? isDark ? 'bg-gray-700 text-white ring-1 ring-violet-500' : 'bg-violet-50 text-violet-600 ring-1 ring-violet-200'
                          : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  ) : (
                    <div className="w-full h-full"></div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between border-t pt-3 border-gray-100 dark:border-gray-700">
              <button
                onClick={() => handleSelect(new Date())}
                className={`text-[10px] font-black uppercase tracking-tighter transition-colors ${textClasses[themeColor]}`}
              >
                Today
              </button>
              <button
                onClick={() => { onChange(''); setIsOpen(false); }}
                className={`text-[10px] font-black uppercase tracking-tighter text-gray-400 hover:text-gray-600`}
              >
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CompactDatePicker;
