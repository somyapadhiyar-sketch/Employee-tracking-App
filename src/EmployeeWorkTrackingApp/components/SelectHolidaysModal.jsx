import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useTheme } from '../context/ThemeContext';

const AVAILABLE_HOLIDAYS = [
  { name: "New Year's Day", dateMonth: "01", dateDay: "01" },
  { name: "Makar Sankranti", dateMonth: "01", dateDay: "14" },
  { name: "Republic Day", dateMonth: "01", dateDay: "26" },
  { name: "Maha Shivaratri", dateMonth: "02", dateDay: "14" },
  { name: "Holi", dateMonth: "03", dateDay: "03" },
  { name: "Dhuleti", dateMonth: "03", dateDay: "04" },
  { name: "Eid al-Fitr", dateMonth: "03", dateDay: "20" },
  { name: "Good Friday", dateMonth: "04", dateDay: "03" },
  { name: "Ram Navami", dateMonth: "04", dateDay: "17" },
  { name: "Labour Day", dateMonth: "05", dateDay: "01" },
  { name: "Independence Day", dateMonth: "08", dateDay: "15" },
  { name: "Raksha Bandhan", dateMonth: "08", dateDay: "28" },
  { name: "Janmashtami", dateMonth: "09", dateDay: "04" },
  { name: "Ganesh Chaturthi", dateMonth: "09", dateDay: "14" },
  { name: "Gandhi Jayanti", dateMonth: "10", dateDay: "02" },
  { name: "Dussehra", dateMonth: "10", dateDay: "19" },
  { name: "Diwali", dateMonth: "11", dateDay: "08" },
  { name: "Bhai Dooj", dateMonth: "11", dateDay: "10" },
  { name: "Guru Nanak Jayanti", dateMonth: "11", dateDay: "24" },
  { name: "Christmas Day", dateMonth: "12", dateDay: "25" }
];

export default function SelectHolidaysModal({ isOpen, onClose, currentHolidays, onSaveSuccess, isSidebarOpen }) {
  const { isDark } = useTheme();
  const [selectedHolidays, setSelectedHolidays] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (isOpen) {
      // Initialize selected holidays with what's already in the DB
      const currentSelectedNames = currentHolidays.map(h => h.name);
      setSelectedHolidays(currentSelectedNames);
    }
  }, [isOpen, currentHolidays]);

  const handleToggle = (holidayName) => {
    setSelectedHolidays(prev => {
      if (prev.includes(holidayName)) {
        return prev.filter(name => name !== holidayName);
      } else {
        return [...prev, holidayName];
      }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Get current DB snapshot to know exact IDs to delete
      const holidaysSnap = await getDocs(collection(db, "publicHolidays"));
      const dbHolidays = holidaysSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. Identify what to delete (in DB but not in selectedHolidays)
      const toDelete = dbHolidays.filter(docHol => !selectedHolidays.includes(docHol.name));

      for (const docToDel of toDelete) {
        await deleteDoc(doc(db, "publicHolidays", docToDel.id));
      }

      // 3. Identify what to add (in selectedHolidays but not in DB)
      const dbHolidayNames = dbHolidays.map(d => d.name);
      const toAddNames = selectedHolidays.filter(name => !dbHolidayNames.includes(name));

      const toAddFull = AVAILABLE_HOLIDAYS.filter(ah => toAddNames.includes(ah.name));

      for (const ah of toAddFull) {
        await addDoc(collection(db, "publicHolidays"), {
          name: ah.name,
          date: `${currentYear}-${ah.dateMonth}-${ah.dateDay}`,
          type: "Optional"
        });
      }

      // Call onSuccess
      onSaveSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving holidays:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed top-0 bottom-0 right-0 ${isSidebarOpen ? "left-0 lg:left-72" : "left-0"} z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-300`}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`w-[90%] sm:w-full max-w-[340px] sm:max-w-lg rounded-3xl shadow-2xl overflow-hidden ${isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"}`}
        >
          {/* Header */}
          <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
            <h2 className={`text-lg sm:text-xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
              Select Public Holidays ({currentYear})
            </h2>
            <button
              onClick={onClose}
              className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full transition-colors ${isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-500"}`}
            >
              <i className="fas fa-times text-xs sm:text-sm"></i>
            </button>
          </div>

          {/* Body */}
          <div className="p-1 sm:p-2 max-h-[55vh] sm:max-h-[60vh] overflow-y-auto scrollbar-hide">
            <div className="grid grid-cols-1 gap-1">
              {AVAILABLE_HOLIDAYS.map((holiday, idx) => {
                const isSelected = selectedHolidays.includes(holiday.name);
                const displayDate = new Date(`${currentYear}-${holiday.dateMonth}-${holiday.dateDay}`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });

                return (
                  <div
                    key={idx}
                    onClick={() => handleToggle(holiday.name)}
                    className={`flex items-center justify-between p-3 sm:p-3.5 mx-1 sm:mx-2 rounded-xl cursor-pointer transition-all ${isSelected ? (isDark ? 'bg-blue-900/20 border border-blue-500/30' : 'bg-blue-50 border border-blue-200') : (isDark ? 'hover:bg-gray-700/50 border border-transparent' : 'hover:bg-gray-50 border border-transparent')}`}
                  >
                    <div className="flex flex-col">
                      <span className={`font-bold text-[13px] sm:text-[15px] ${isSelected ? (isDark ? 'text-blue-400' : 'text-blue-700') : (isDark ? 'text-gray-200' : 'text-gray-700')}`}>
                        {holiday.name}
                      </span>
                      <span className={`text-[10px] sm:text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {displayDate}
                      </span>
                    </div>

                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center transition-colors border-2 flex-shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : (isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white')}`}>
                      {isSelected && <i className="fas fa-check text-[10px] sm:text-xs"></i>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 sm:gap-3 bg-gray-50/50 dark:bg-gray-800/50">
            <button
              onClick={onClose}
              className={`px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm rounded-lg sm:rounded-xl font-bold transition-all ${isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm rounded-lg sm:rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/20 ${isSaving ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i> Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
