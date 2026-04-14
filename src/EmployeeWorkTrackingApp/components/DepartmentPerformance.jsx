import React, { useMemo, useState } from 'react';
import TeamDynamics from './TeamDynamics';
import { motion } from 'framer-motion';

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
      className="space-y-6 pb-10"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all shadow-md active:scale-95 shrink-0 ${isDark ? "bg-gray-800 border-gray-700 text-white hover:bg-gray-700" : "bg-white border-gray-200 text-gray-800 hover:bg-gray-50"}`}
          >
            <i className="fas fa-arrow-left text-sm"></i>
          </button>
          <div className="min-w-0">
            <h1 className={`text-2xl sm:text-3xl font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
              {deptName} Productivity Analysis
            </h1>
            <p className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Team Dynamics & Behavioral Analysis for {deptUsers.length} members
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Range Picker */}
          <div className={`px-5 h-11 rounded-2xl border shadow-sm flex items-center gap-4 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
            <div className="flex items-center gap-3">
              <i className="fas fa-calendar-alt text-violet-500 text-sm"></i>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Period:</span>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className={`px-2 py-1 rounded-lg border text-[11px] font-bold focus:outline-none transition-all ${isDark ? "bg-gray-700 border-gray-600 text-white focus:border-violet-500" : "bg-gray-50 border-gray-200 text-gray-700 focus:border-violet-400"}`}
              />
              <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                <i className="fas fa-arrow-right text-[10px]"></i>
              </span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className={`px-2 py-1 rounded-lg border text-[11px] font-bold focus:outline-none transition-all ${isDark ? "bg-gray-700 border-gray-600 text-white focus:border-violet-500" : "bg-gray-50 border-gray-200 text-gray-700 focus:border-violet-400"}`}
              />
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
