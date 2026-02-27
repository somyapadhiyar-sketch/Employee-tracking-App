import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import ProfileModal from './ProfileModal';

export default function AdminSidebar({ currentSection, onSectionChange, onLogout, pendingCount, userName, user, userRole, leaveRequestCount, isSidebarOpen, toggleSidebar }) {
  const { isDark, toggleTheme } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  
  const userInitial = userName ? userName.charAt(0).toUpperCase() : 'A';
  const displayName = userName || 'Admin';

  const menuItems = [
    { id: 'dashboard', icon: 'fa-home', label: 'Dashboard', color: 'from-cyan-400 to-blue-500' },
    { id: 'pending', icon: 'fa-user-clock', label: 'Pending', badge: pendingCount, color: 'from-amber-400 to-orange-500' },
    { id: 'departments', icon: 'fa-building', label: 'Departments', color: 'from-emerald-400 to-green-500' },
    { id: 'employees', icon: 'fa-users', label: 'Employees', color: 'from-violet-400 to-purple-500' },
    { id: 'attendance', icon: 'fa-calendar-check', label: 'Attendance', color: 'from-rose-400 to-pink-500' },
    { id: 'leave', icon: 'fa-calendar-minus', label: 'Leave', badge: leaveRequestCount, color: 'from-orange-400 to-red-500' },
    { id: 'profile', icon: 'fa-user-circle', label: 'My Profile', color: 'from-blue-400 to-indigo-500' },
  ];

  const handleMenuClick = (item) => {
    if (item.id === 'profile') {
      setShowProfile(true);
    } else {
      onSectionChange(item.id);
    }
    if (window.innerWidth < 1024) {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleSidebar}
        className={`fixed top-4 left-4 z-50 p-3 rounded-xl shadow-lg ${
          isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
        }`}
      >
        <i className={`fas ${isSidebarOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
      </motion.button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div 
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: isSidebarOpen ? 0 : -300, opacity: isSidebarOpen ? 1 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed left-0 top-0 h-full w-full lg:w-72 shadow-2xl p-4 flex flex-col z-40 border-r overflow-y-auto ${
          isDark 
            ? 'bg-gradient-to-b from-gray-800 to-gray-900 border-gray-700' 
            : 'bg-gradient-to-b from-white to-cyan-50 border-cyan-100'
        }`}

      >

        {/* Profile Section */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-4 pt-4"
        >
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            onClick={() => setShowProfile(true)}
            className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-2xl border-4 border-white cursor-pointer"
          >
            <span className="text-3xl sm:text-4xl font-bold text-white">{userInitial}</span>
          </motion.div>
          <h2 className={`font-bold text-xl sm:text-2xl ${isDark ? 'text-white' : 'text-gray-800'}`}>{displayName}</h2>
          <p className="text-cyan-400 text-sm font-medium">Administrator</p>
        </motion.div>

        {/* Theme Toggle */}
        <motion.button
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className={`mx-auto mb-4 px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all ${
            isDark 
              ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' 
              : 'bg-cyan-100 text-gray-700 hover:bg-cyan-200'
          }`}
        >
          <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`}></i>
          <span className="hidden sm:inline">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </motion.button>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 px-2 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

          {menuItems.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleMenuClick(item)}
              className={`w-full text-left px-4 py-3 sm:py-3.5 rounded-xl transition-all duration-300 flex items-center justify-between group ${
                currentSection === item.id 
                  ? `bg-gradient-to-r ${item.color} text-white shadow-lg` 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white'
                    : 'bg-white hover:bg-cyan-50 text-gray-700 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <i className={`fas ${item.icon} w-5 text-lg group-hover:scale-110 transition-transform`}></i>
                <span className="font-medium">{item.label}</span>
              </span>
              {item.badge > 0 && item.id !== 'profile' && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.2 }}
                  className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg"
                >
                  {item.badge}
                </motion.span>
              )}
            </motion.button>
          ))}
        </nav>

        {/* Logout Button */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLogout}
          className={`w-full text-left px-4 py-3 sm:py-3.5 rounded-xl transition-all text-gray-700 group mt-4 ${
            isDark 
              ? 'bg-gray-800 hover:bg-red-900/50 text-gray-200 hover:text-red-400' 
              : 'bg-white hover:bg-red-50 text-gray-700 hover:text-red-600'
          }`}
        >
          <span className="flex items-center gap-3 font-medium">
            <i className="fas fa-sign-out-alt w-5 text-lg group-hover:translate-x-1 transition-transform"></i>
            Logout
          </span>
        </motion.button>
      </motion.div>

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={showProfile} 
        onClose={() => setShowProfile(false)} 
        user={user}
        role={userRole || 'admin'}
      />
    </>
  );
}
