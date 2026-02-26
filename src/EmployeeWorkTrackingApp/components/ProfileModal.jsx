import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { DEPARTMENTS, WORK_TYPES } from '../constants/config';

export default function ProfileModal({ isOpen, onClose, user, role, isAdminView = false, workLogs = [] }) {
  const { isDark } = useTheme();

  if (!isOpen) return null;

  const getRoleLabel = () => {
    switch(role) {
      case 'admin': return 'Administrator';
      case 'manager': return 'Department Manager';
      case 'dept_manager': return 'Department Manager';
      case 'employee': return 'Employee';
      default: return 'User';
    }
  };

  const getRoleColor = () => {
    switch(role) {
      case 'admin': return 'from-red-500 to-rose-600';
      case 'manager': return 'from-violet-500 to-purple-600';
      case 'dept_manager': return 'from-violet-500 to-purple-600';
      case 'employee': return 'from-blue-500 to-cyan-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  // Get recent work logs (last 7 days)
  const recentWorkLogs = workLogs.slice(-10).reverse();

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-2xl mx-4 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}
        >
          {/* Header with gradient */}
          <div className={`h-32 bg-gradient-to-r ${getRoleColor()} relative`}>
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-all"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          {/* Profile Avatar */}
          <div className="flex justify-center -mt-16 relative z-10">
            <motion.div 
              whileHover={{ scale: 1.1 }}
              className={`w-28 h-28 bg-gradient-to-br ${getRoleColor()} rounded-full flex items-center justify-center shadow-2xl border-4 ${
                isDark ? 'border-gray-800' : 'border-white'
              }`}
            >
              <span className="text-4xl font-bold text-white">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-6 text-center">
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
              {user?.firstName} {user?.lastName}
            </h2>
            <p className={`text-sm font-medium mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {getRoleLabel()}
            </p>
            
            <div className={`inline-block mt-3 px-4 py-1.5 rounded-full text-white text-sm font-medium bg-gradient-to-r ${getRoleColor()}`}>
              <i className={`fas ${
                role === 'admin' ? 'fa-crown' : 
                role === 'manager' || role === 'dept_manager' ? 'fa-user-tie' : 'fa-user'
              } mr-2`}></i>
              {getRoleLabel()}
            </div>

            {/* Info Cards */}
            <div className={`mt-6 space-y-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-2xl p-4`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-gray-600' : 'bg-white shadow'}`}>
                  <i className="fas fa-envelope text-blue-500"></i>
                </div>
                <div className="text-left">
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Email</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{user?.email || 'Not provided'}</p>
                </div>
              </div>

              {user?.department && (
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-gray-600' : 'bg-white shadow'}`}>
                    <i className="fas fa-building text-violet-500"></i>
                  </div>
                  <div className="text-left">
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Department</p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{DEPARTMENTS[user.department]?.name || 'Not assigned'}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-gray-600' : 'bg-white shadow'}`}>
                  <i className="fas fa-calendar-alt text-emerald-500"></i>
                </div>
                <div className="text-left">
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Member Since</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
            </div>

            {/* Work History Section - Only shown when admin views employee profile */}
            {isAdminView && workLogs.length > 0 && (
              <div className={`mt-6 rounded-2xl p-4 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'} flex items-center`}>
                  <i className="fas fa-history mr-2 text-blue-500"></i>
                  Recent Work Activity
                </h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {recentWorkLogs.map((log) => (
                    <div key={log.id} className={`p-3 rounded-xl ${isDark ? 'bg-gray-600' : 'bg-white shadow-sm'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
                          {WORK_TYPES[log.workType]?.name || log.workType}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {log.duration || (log.minutes ? `${log.minutes} min` : `${log.hours} hours`)}
                        </span>
                      </div>
                      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{log.description}</p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {new Date(log.date).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isAdminView && workLogs.length === 0 && (
              <div className={`mt-6 p-4 rounded-2xl ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No work logs found for this employee.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
