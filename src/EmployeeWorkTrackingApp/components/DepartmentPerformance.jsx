import React, { useMemo, useState } from 'react';
import TeamDynamics from './TeamDynamics';
import { motion, AnimatePresence } from 'framer-motion';
import CompactDatePicker from './CompactDatePicker';

const DepartmentPerformance = ({ deptId, deptName, allUsers, analyticsData, isDark, onBack }) => {
  const [startDate, setStartDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [endDate, setEndDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));

  // 1. Identify users in this department
  const deptUsers = useMemo(() => 
    allUsers.filter(u => u.department === deptId || u.departmentId === deptId),
    [allUsers, deptId]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative space-y-4 sm:space-y-6 pb-10"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-4 sm:mb-6">
        {/* Title + mobile back arrow inline */}
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className={`text-2xl sm:text-3xl font-bold leading-tight ${isDark ? "text-white" : "text-gray-900"}`}>
              {deptName} Productivity Analysis
            </h1>
            <p className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Team Dynamics & Behavioral Analysis for {deptUsers.length} members
            </p>
          </div>
          {/* Arrow — visible only on mobile (right of title) */}
          <button
            onClick={onBack}
            title="Go Back"
            className={`lg:hidden mt-1 shrink-0 transition-all group ${isDark ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-gray-800"}`}
          >
            <i className="fas fa-arrow-left text-lg transition-transform group-hover:-translate-x-1"></i>
          </button>
        </div>

        {/* Right column: arrow and date picker */}
        <div className="flex flex-col lg:items-end gap-2">
          <button
            onClick={onBack}
            title="Go Back"
            className={`hidden lg:flex transition-all group ${isDark ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-gray-800"}`}
          >
            <i className="fas fa-arrow-left text-lg transition-transform group-hover:-translate-x-1"></i>
          </button>

          {/* Date Range Picker */}
          <div className={`w-full sm:w-auto px-1.5 sm:px-4 py-1 sm:py-0 h-auto sm:h-[40px] rounded-2xl shadow-sm flex items-center gap-1.5 sm:gap-3 ${isDark ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex items-center gap-1.5 sm:gap-2 px-0.5 sm:px-0">
              <i className="fas fa-calendar-alt text-violet-500 text-sm"></i>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Period:</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-center">
              <div className="w-[115px] sm:w-[130px]">
                <CompactDatePicker
                  value={startDate}
                  onChange={(val) => setStartDate(val)}
                  isDark={isDark}
                  themeColor="violet"
                  size="sm"
                />
              </div>
              <span className={`shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                <i className="fas fa-arrow-right text-[10px]"></i>
              </span>
              <div className="w-[115px] sm:w-[130px]">
                <CompactDatePicker
                  value={endDate}
                  onChange={(val) => setEndDate(val)}
                  isDark={isDark}
                  themeColor="violet"
                  align="right"
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <TeamDynamics 
        isDark={isDark} 
        dept={deptName} 
        deptEmployees={deptUsers} 
        hideHeader={true} 
        propStartDate={startDate}
        propEndDate={endDate}
      />
    </motion.div>
  );
};

export default DepartmentPerformance;
