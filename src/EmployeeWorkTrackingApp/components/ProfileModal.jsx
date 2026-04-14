import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import { useDepartments } from "../hooks/useDepartments";

export function ProfileCard({
  user,
  role,
  isAdminView = false,
  workLogs = [],
  onClose,
  isInline = false,
}) {

  const { isDark } = useTheme();
  const { departmentsMap } = useDepartments();

  const getRoleLabel = () => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "manager":
        return "Department Manager";
      case "dept_manager":
        return "Department Manager";
      case "employee":
        return "Employee";
      default:
        return "User";
    }
  };



  // Helper component to render each info card neatly
  const InfoCard = ({ icon, label, value, colorClass }) => (
    <div
      className={`flex items-start gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${isDark
        ? "bg-gray-700/50 border-gray-600 hover:bg-gray-700"
        : "bg-white border-gray-200 shadow-sm hover:border-blue-100"
        }`}
    >
      <div
        className={`mt-0.5 flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${isDark
          ? "bg-gray-800 text-blue-400"
          : `bg-${colorClass}-50 text-${colorClass}-600`
          }`}
      >
        <i className={`fas ${icon} text-lg`}></i>
      </div>
      <div className="overflow-hidden">
        <p
          className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDark ? "text-gray-400" : "text-gray-500"
            }`}
        >
          {label}
        </p>
        <p
          className={`text-base font-semibold truncate ${isDark ? "text-white" : "text-gray-900"
            }`}
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={
        isInline ? { height: 0, opacity: 0 } : { scale: 0.9, opacity: 0 }
      }
      animate={
        isInline ? { height: "auto", opacity: 1 } : { scale: 1, opacity: 1 }
      }
      exit={isInline ? { height: 0, opacity: 0 } : { scale: 0.9, opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
      className={`w-full overflow-hidden relative text-left ${isInline
        ? `${isDark
          ? "bg-gray-800 border-t border-gray-700 shadow-inner"
          : "bg-slate-50 border-t border-gray-200 shadow-inner"
        } px-4 py-6 sm:px-8 sm:py-8`
        : `max-w-4xl mx-4 p-8 sm:p-10 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? "bg-gray-800 text-white" : "bg-white text-gray-800"
        }`
        }`}
    >
      {!isInline && onClose && (
        <button
          onClick={onClose}
          className={`absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDark
            ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
            : "bg-gray-100 hover:bg-gray-200 text-gray-600"
            }`}
        >
          <i className="fas fa-times"></i>
        </button>
      )}

      <div>
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${isDark
              ? "bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 border border-blue-500/30"
              : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 border border-blue-200"
              }`}
          >
            <i className="fas fa-address-card text-xl"></i>
          </div>
          <div>
            <h2
              className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"
                }`}
            >
              Personal Information
            </h2>
            <p
              className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-500"
                }`}
            >
              Detailed profile data and contact information
            </p>
          </div>
        </div>

        {/* Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoCard
            icon="fa-user"
            label="First Name"
            value={user?.firstName || "N/A"}
            colorClass="blue"
          />
          <InfoCard
            icon="fa-id-badge"
            label="Last Name"
            value={user?.lastName || "N/A"}
            colorClass="indigo"
          />
          <InfoCard
            icon="fa-user-shield"
            label="User Role"
            value={getRoleLabel()}
            colorClass="violet"
          />
          <InfoCard
            icon="fa-envelope"
            label="Email Address"
            value={user?.email || "N/A"}
            colorClass="cyan"
          />
          <InfoCard
            icon="fa-phone"
            label="Phone Number"
            value={user?.phone || "Not provided"}
            colorClass="emerald"
          />
          {user?.department && (
            <InfoCard
              icon="fa-building"
              label="Department"
              value={
                departmentsMap[user.department]?.name ||
                user.department.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
              }
              colorClass="amber"
            />
          )}
        </div>

      </div>
    </motion.div>
  );
}

export default function ProfileModal({ isSidebarOpen = false, ...props }) {
  if (!props.isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed top-0 right-0 bottom-0 ${isSidebarOpen ? "left-0 lg:left-72" : "left-0"} bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300`}
        onClick={props.onClose}
      >
        <ProfileCard {...props} />
      </motion.div>
    </AnimatePresence>
  );
}
