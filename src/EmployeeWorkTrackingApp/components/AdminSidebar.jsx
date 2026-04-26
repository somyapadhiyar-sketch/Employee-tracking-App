import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

export default function AdminSidebar({
  currentSection,
  onSectionChange,
  onLogout,
  pendingCount,
  userName,
  user,
  userRole,
  leaveRequestCount,
  isSidebarOpen,
  toggleSidebar,
  onAddDepartment,
  onDeptAction,
}) {
  const { isDark, toggleTheme } = useTheme();
  const [isDepartmentsExpanded, setIsDepartmentsExpanded] = useState(false);

  const [isFullScreenImage, setIsFullScreenImage] = useState(false);
  const [isToggleVisible, setIsToggleVisible] = useState(false);
  const hideTimeoutRef = useRef(null);

  const showToggleWithTimeout = () => {
    setIsToggleVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setIsToggleVisible(false);
    }, 2000);
  };

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  };

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const userInitial = userName ? userName.charAt(0).toUpperCase() : "A";
  const displayName = userName || "Admin";

  const menuItems = [
    {
      id: "dashboard",
      icon: "fa-home",
      label: "Dashboard",
      color: "from-blue-500 to-blue-600",
    },
    {
      id: "pending",
      icon: "fa-user-clock",
      label: "Pending",
      badge: pendingCount,
      color: "from-blue-500 to-blue-600",
    },
    {
      id: "departments",
      icon: "fa-building",
      label: "Departments",
      color: "from-blue-500 to-blue-600",
    },
    {
      id: "employees",
      icon: "fa-users",
      label: "Employees",
      color: "from-blue-500 to-blue-600",
    },
    {
      id: "attendance",
      icon: "fa-calendar-check",
      label: "Attendance",
      color: "from-blue-500 to-blue-600",
    },
    {
      id: "leave",
      icon: "fa-calendar-minus",
      label: "Leave",
      badge: leaveRequestCount,
      color: "from-blue-500 to-blue-600",
    },
    {
      id: "holidays",
      icon: "fa-umbrella-beach",
      label: "Public Holidays",
      color: "from-blue-500 to-blue-600",
    },
    {
      id: "org_overview",
      icon: "fa-chart-line",
      label: "Productivity Analysis",
      color: "from-blue-500 to-blue-600",
    },
    {
      id: "activityMonitor",
      icon: "fa-desktop",
      label: "Activity Monitor",
      color: "from-blue-500 to-blue-600",
    },
    {
      id: "reportDetails",
      icon: "fa-file-invoice",
      label: "Report Details",
      color: "from-blue-500 to-blue-600",
    },
    {
      id: "generatePdf",
      icon: "fa-file-pdf",
      label: "Generate PDF",
      color: "from-blue-500 to-blue-600",
    },
    {
      id: "admin_chat",
      icon: "fa-robot",
      label: "Admin Insight Chat",
      color: "from-blue-500 to-indigo-600",
    },
    {
      id: "profile",
      icon: "fa-user-circle",
      label: "My Profile",
      color: "from-blue-500 to-blue-600",
    },
  ];

  const navigate = useNavigate();

  const handleMenuClick = (item) => {
    if (item.id === "departments") {
      setIsDepartmentsExpanded(!isDepartmentsExpanded);
      if (onDeptAction) onDeptAction("view");
    } else {
      setIsDepartmentsExpanded(false);
    }
    onSectionChange(item.id);
    if (window.innerWidth < 1024 && item.id !== "departments") {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* Sidebar Toggle Hover Zone */}
      <div
        className="fixed top-0 left-0 z-[60] transition-all duration-300 lg:hidden cursor-pointer"
        style={{ width: '56px', height: '56px' }}
        onMouseEnter={showToggleWithTimeout}
        onClick={() => {
          toggleSidebar();
          showToggleWithTimeout();
        }}
      >
        <motion.div
          animate={{ opacity: isToggleVisible ? 1 : 0 }}
          className="p-1 transition-all duration-500"
        >
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onMouseEnter={clearHideTimeout}
            onMouseLeave={showToggleWithTimeout}
            className={`p-2 transition-all duration-300 ${isDark
              ? "text-white hover:text-blue-400"
              : "text-blue-600 hover:text-blue-700 font-bold"
              }`}
          >
            <i
              className={`fas ${isSidebarOpen ? "fa-times text-2xl" : "fa-bars text-xl"}`}
            ></i>
          </motion.button>
        </motion.div>
      </div>

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
        initial={{ x: "-100%", opacity: 0 }}
        animate={{
          x: isSidebarOpen ? 0 : "-100%",
          opacity: isSidebarOpen ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed left-0 top-0 h-full w-[75%] md:w-72 shadow-2xl p-4 flex flex-col z-40 border-r overflow-y-auto scrollbar-hide ${isDark
          ? "bg-gradient-to-b from-gray-800 to-gray-900 border-gray-700"
          : "bg-gradient-to-b from-white to-cyan-50 border-cyan-100"
          }`}
        style={{ pointerEvents: isSidebarOpen || window.innerWidth >= 1024 ? "auto" : "none" }}
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
            onClick={() => user?.profileImage && setIsFullScreenImage(true)}
            className={`w-20 h-20 sm:w-24 sm:h-24 ${user?.profileImage ? '' : 'bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600'} rounded-full flex items-center justify-center mx-auto mb-3 shadow-2xl border-4 border-white cursor-pointer overflow-hidden`}
          >
            {user?.profileImage ? (
              <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl sm:text-4xl font-bold text-white">
                {userInitial}
              </span>
            )}
          </motion.div>
          <h2
            className={`font-bold text-xl sm:text-2xl ${isDark ? "text-white" : "text-gray-800"
              }`}
          >
            {displayName}
          </h2>
          <p className="text-cyan-400 text-sm font-medium">Administrator</p>
        </motion.div>



        {/* Navigation */}
        <nav
          className="flex-1 space-y-2 px-2 overflow-y-auto scrollbar-hide"
        >
          {menuItems.map((item, index) => (
            <div key={item.id} className="w-full relative flex flex-col">
              <motion.button
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                whileHover={{ scale: 1.02, x: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleMenuClick(item)}
                className={`w-full text-left px-4 py-3 sm:py-3.5 transition-all duration-300 flex items-center justify-between group ${(currentSection === item.id || (item.id === "departments" && currentSection === "add_department"))
                  ? `bg-gradient-to-r ${item.color} text-white shadow-lg ${item.id === "departments" && isDepartmentsExpanded ? "rounded-t-xl" : "rounded-xl"}`
                  : isDark
                    ? `bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white ${item.id === "departments" && isDepartmentsExpanded ? "rounded-t-xl" : "rounded-xl"}`
                    : `bg-white hover:bg-cyan-50 text-gray-700 hover:text-gray-900 ${item.id === "departments" && isDepartmentsExpanded ? "rounded-t-xl" : "rounded-xl"}`
                  }`}
              >
                <span className="flex items-center gap-3">
                  <i
                    className={`fas ${item.icon} w-5 text-lg group-hover:scale-110 transition-transform`}
                  ></i>
                  <span className="font-bold">{item.label}</span>
                </span>
                <div className="flex items-center gap-2">
                  {item.badge > 0 && item.id !== "profile" && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      whileHover={{ scale: 1.2 }}
                      className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg"
                    >
                      {item.badge}
                    </motion.span>
                  )}
                  {item.id === "departments" && (
                    <i className={`fas fa-chevron-down transition-all duration-300 opacity-0 group-hover:opacity-100 ${isDepartmentsExpanded ? 'rotate-180 opacity-100' : ''}`}></i>
                  )}
                </div>
              </motion.button>
              <AnimatePresence>
                {item.id === "departments" && isDepartmentsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className={`overflow-hidden rounded-b-xl shadow-lg ${isDark ? "bg-gray-800 shadow-xl" : "bg-white shadow-sm"}`}
                  >
                    <div className="flex flex-col py-1 pb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); if (onAddDepartment) onAddDepartment(); if (window.innerWidth < 1024) toggleSidebar(); }}
                        className={`w-full text-left px-5 py-2.5 transition-all flex items-center gap-3 font-bold ${isDark ? "text-gray-300 hover:bg-gray-700" : "text-gray-800 hover:bg-gray-50"}`}
                      >
                        <i className="fas fa-plus w-5 flex justify-center text-sm"></i> Add New Department
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (onDeptAction) onDeptAction("edit"); if (window.innerWidth < 1024) toggleSidebar(); }}
                        className={`w-full text-left px-5 py-2.5 transition-all flex items-center gap-3 font-bold ${isDark ? "text-gray-300 hover:bg-gray-700" : "text-gray-800 hover:bg-gray-50"}`}
                      >
                        <i className="fas fa-pencil-alt w-5 flex justify-center text-sm"></i> Update Department
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (onDeptAction) onDeptAction("delete"); if (window.innerWidth < 1024) toggleSidebar(); }}
                        className={`w-full text-left px-5 py-2.5 transition-all flex items-center gap-3 font-bold ${isDark ? "text-gray-300 hover:bg-gray-700" : "text-gray-800 hover:bg-gray-50"}`}
                      >
                        <i className="fas fa-trash-alt w-5 flex justify-center text-sm"></i> Delete Department
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
          className={`w-full text-left px-4 py-3 sm:py-3.5 rounded-xl transition-all text-gray-700 group mt-4 ${isDark
            ? "bg-gray-800 hover:bg-red-900/50 text-gray-200 hover:text-red-400"
            : "bg-white hover:bg-red-50 text-gray-700 hover:text-red-600"
            }`}
        >
          <span className="flex items-center gap-3 font-bold">
            <i className="fas fa-sign-out-alt w-5 text-lg group-hover:translate-x-1 transition-transform"></i>
            Logout
          </span>
        </motion.button>
      </motion.div>

      {/* Profile Modal */}

      {/* Full Screen Image Modal */}
      <AnimatePresence>
        {isFullScreenImage && user?.profileImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 sm:p-8 backdrop-blur-sm"
          >
            <button
              onClick={() => setIsFullScreenImage(false)}
              className="absolute top-4 right-4 sm:top-8 sm:right-8 z-[110] w-12 h-12 bg-white/10 hover:bg-red-500/80 rounded-full flex items-center justify-center text-white transition-all shadow-lg"
            >
              <i className="fas fa-times text-2xl"></i>
            </button>
            <motion.img
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={user.profileImage}
              alt="Profile Full Screen"
              className="w-full h-full object-contain drop-shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
