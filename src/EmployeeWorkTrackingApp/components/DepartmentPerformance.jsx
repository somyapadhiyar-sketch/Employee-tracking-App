import React, { useMemo } from 'react';
import TeamDynamics from './TeamDynamics';
import { motion } from 'framer-motion';

const DepartmentPerformance = ({ deptId, deptName, allUsers, analyticsData, isDark, onBack }) => {
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
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-8">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {deptName} Department Analysis
          </h1>
          <p className={`mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Team Dynamics & Behavioral Analysis for {deptUsers.length} members
          </p>
        </div>
        <button
          onClick={onBack}
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center border transition-all shadow-lg active:scale-95 shrink-0 ${isDark ? "bg-gray-800 border-gray-700 text-white hover:bg-gray-700" : "bg-white border-gray-200 text-gray-800 hover:bg-gray-50"}`}
        >
          <i className="fas fa-arrow-left"></i>
        </button>
      </div>

      <TeamDynamics 
        isDark={isDark} 
        dept={deptName} 
        deptEmployees={deptUsers} 
        hideHeader={true} 
      />
    </motion.div>
  );
};

export default DepartmentPerformance;
