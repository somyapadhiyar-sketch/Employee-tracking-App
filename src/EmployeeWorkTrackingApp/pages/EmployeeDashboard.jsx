import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  WORK_TYPES,
  LATE_THRESHOLD_HOUR,
  LATE_THRESHOLD_MINUTE,
} from "../constants/config";
import { useDepartments } from "../hooks/useDepartments";
import { useTheme } from "../context/ThemeContext";
import ProfilePage from "./ProfilePage";
import ActivityReport from "../components/ActivityReport";
import MyPerformance from "./MyPerformance";

// NEW FIREBASE IMPORTS
import { collection, getDocs, addDoc, doc, updateDoc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function EmployeeDashboard() {
  const { auth, onLogout } = useOutletContext();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { departmentsMap } = useDepartments();

  const [currentSection, setCurrentSection] = useState("dashboard");

  // IST Date/Time Helpers
  const getISTDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const getISTTimeString = () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 7);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  });
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [workType, setWorkType] = useState(null);
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnBreak, setIsOnBreak] = useState(false);

  // Time tracking states
  const [taskStartTime, setTaskStartTime] = useState("");
  const [taskEndTime, setTaskEndTime] = useState("");
  const [calculatedDuration, setCalculatedDuration] = useState("");

  // Leave request states
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveType, setLeaveType] = useState("sick");
  const [leaveDuration, setLeaveDuration] = useState("full");
  const [leaveFilter, setLeaveFilter] = useState("all");
  const [leaveSearchTerm, setLeaveSearchTerm] = useState("");
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("all");
  const [leaveStartTime, setLeaveStartTime] = useState("09:00");
  const [leaveEndTime, setLeaveEndTime] = useState("13:30");

  const [isDurationDropdownOpen, setIsDurationDropdownOpen] = useState(false);
  const [isHalfTypeDropdownOpen, setIsHalfTypeDropdownOpen] = useState(false);

  const [toast, setToast] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [isFullScreenImage, setIsFullScreenImage] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(true);
  const menuTimeoutRef = useRef(null);


  // NEW STATE FOR FIREBASE DATA
  const [allWorkLogs, setAllWorkLogs] = useState([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDate, setSearchDate] = useState("");

  // Edit Log State
  const [editingLogId, setEditingLogId] = useState(null);
  const [description, setDescription] = useState("");

  // 1. Fetch data from Firestore
  const fetchDashboardData = async () => {
    setLoadingData(true);
    try {
      const uId = auth?.currentUser?.uid || auth?.currentUser?.id;
      if (uId) {
        const userSnap = await getDoc(doc(db, "users", uId));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const todayStr = getISTDate();

          // Use Firebase clockedIn field if available, otherwise fallback to date calculation
          if (userData.clockedIn !== undefined) {
            setClockedIn(userData.clockedIn);
          } else if (userData.lastClockInDate === todayStr && userData.lastClockOutDate !== todayStr) {
            setClockedIn(true);
          }
          if (userData.isOnBreak !== undefined) {
            setIsOnBreak(userData.isOnBreak);
          }
        }
      }

      const logsSnap = await getDocs(collection(db, "workLogs"));
      setAllWorkLogs(
        logsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      const leaveSnap = await getDocs(collection(db, "leaveRequests"));
      setAllLeaveRequests(
        leaveSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      const holidaysSnap = await getDocs(collection(db, "publicHolidays"));
      if (!holidaysSnap.empty) {
        const seen = new Set();
        const uniqueHols = [];
        for (const docItem of holidaysSnap.docs) {
          const data = docItem.data();
          if (seen.has(data.date)) {
            deleteDoc(doc(db, "publicHolidays", docItem.id));
          } else {
            seen.add(data.date);
            uniqueHols.push({ id: docItem.id, ...data });
          }
        }
        uniqueHols.sort((a, b) => new Date(a.date) - new Date(b.date));
        setPublicHolidays(uniqueHols);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      showToastMessage("Failed to load database records.", "error");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // --- DERIVED DATA ---
  const user = auth?.currentUser || {};
  const currentUserId = user?.uid || user?.id;
  const today = new Date().toISOString().split("T")[0];

  // Set browser title with identity for Smart Tracking Agent
  useEffect(() => {
    if (user?.firstName) {
      document.title = `[${user.firstName} ${user.lastName}] Employee Dashboard`;
    }
    return () => {
      document.title = "Employee Work Tracking App";
    };
  }, [user]);

  const LEAVE_BALANCE = {
    sick: { total: 6, name: "Sick Leave", icon: "fa-user-nurse" },
    casual: { total: 10, name: "Casual Leave", icon: "fa-umbrella-beach" },
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Add resize listener to handle sidebar state
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    window.addEventListener("resize", handleResize);
    // Call once to set initial state correctly
    handleResize();

    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const formatTime = (date) => {
    if (!date) return "--:--:--";
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const formatTimeForInput = (date) => {
    if (!date) return "";
    return date.toTimeString().slice(0, 8);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const showToastMessage = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Set browser title with identity for Smart Tracking Agent
  useEffect(() => {
    if (user?.firstName) {
      document.title = `[${user.firstName} ${user.lastName}] Employee Tracking`;
    }
    return () => {
      document.title = "Employee Work Tracking App";
    };
  }, [user]);

  // Mobile menu visibility simplified



  const filteredWorkLogs = allWorkLogs.filter((log) => {
    if (log.employeeId !== currentUserId) return false;

    const todayObj = new Date();
    const logDateObj = new Date(log.date);

    const logWorkTypeName = WORK_TYPES?.[log.workType]?.name || log.workType || "";
    const logDescription = log.description || "";
    const searchString = searchTerm.toLowerCase();

    if (searchTerm &&
      !logDescription.toLowerCase().includes(searchString) &&
      !logWorkTypeName.toLowerCase().includes(searchString) &&
      !log.date.toLowerCase().includes(searchString) &&
      !(log.duration || "").toLowerCase().includes(searchString)
    ) return false;

    // Date Range Filter
    if (log.date < reportStartDate || log.date > reportEndDate) return false;

    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const myLeaveRequests = allLeaveRequests.filter(
    (req) => req.employeeId === currentUserId
  );

  const filteredMyLeaveHistory = myLeaveRequests
    .filter((req) => {
      const searchLow = leaveSearchTerm.toLowerCase();
      const typeName = (LEAVE_BALANCE[req.leaveType]?.name || "").toLowerCase();
      const reason = (req.reason || "").toLowerCase();
      const matchesSearch =
        typeName.includes(searchLow) || reason.includes(searchLow);
      const matchesStatus =
        leaveStatusFilter === "all" || req.status === leaveStatusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort(
      (a, b) =>
        new Date(b.appliedAt || b.startDate) -
        new Date(a.appliedAt || a.startDate)
    );

  const myPendingLeaveRequests = myLeaveRequests.filter(
    (req) => req.status === "pending"
  );
  const myApprovedLeaveRequests = myLeaveRequests.filter(
    (req) => req.status === "approved"
  );

  const calculateLeaveDuration = (start, end, durationType = "full") => {
    if (!start || !end) return 0;
    if (durationType === "half" || durationType === "first_half" || durationType === "second_half") return 0.5;
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = Math.abs(e - s);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const getUsedLeaves = (type) =>
    myApprovedLeaveRequests
      .filter((req) => req.leaveType === type)
      .reduce(
        (acc, req) =>
          acc +
          calculateLeaveDuration(req.startDate, req.endDate, req.leaveDuration),
        0
      );

  const handleClockIn = async () => {
    setClockedIn(true);
    setClockInTime(formatTime(currentTime));
    try {
      const todayDate = getISTDate();
      await updateDoc(doc(db, "users", currentUserId), {
        clockedIn: true,
        lastClockInDate: todayDate,
        lastClockInTime: getISTTimeString(),
      });
      showToastMessage("Clocked in successfully!", "success");
    } catch (err) {
      console.error(err);
      showToastMessage("Failed to clock in to database.", "error");
    }
  };

  const handleClockOut = async () => {
    setClockedIn(false);
    setIsOnBreak(false); // Auto-reset break on clock out
    try {
      const todayDate = getISTDate();
      await updateDoc(doc(db, "users", currentUserId), {
        clockedIn: false,
        isOnBreak: false,
        lastClockOutDate: todayDate,
        lastClockOutTime: getISTTimeString()
      });
      showToastMessage("Clocked out successfully!", "success");
    } catch (err) {
      console.error(err);
      showToastMessage("Failed to clock out to database.", "error");
    }
  };

  const handleToggleBreak = async () => {
    const newBreakStatus = !isOnBreak;
    setIsOnBreak(newBreakStatus);
    try {
      await updateDoc(doc(db, "users", currentUserId), {
        isOnBreak: newBreakStatus
      });
      showToastMessage(newBreakStatus ? "Break started. Tracking paused." : "Resumed work. Tracking active.", "info");
    } catch (err) {
      console.error(err);
      setIsOnBreak(!newBreakStatus); // Fallback
      showToastMessage("Failed to update break status.", "error");
    }
  };

  // --- FIREBASE ACTIONS ---
  const handleSubmitLeaveRequest = async (e) => {
    e.preventDefault();
    if (!leaveStartDate || !leaveEndDate || !leaveReason)
      return showToastMessage("Please fill all fields!", "error");
    if (new Date(leaveStartDate) > new Date(leaveEndDate))
      return showToastMessage("End date must be after start date!", "error");

    const availableLeaves =
      LEAVE_BALANCE[leaveType].total - getUsedLeaves(leaveType);
    if (availableLeaves <= 0)
      return showToastMessage(
        `No ${LEAVE_BALANCE[leaveType].name} available!`,
        "error"
      );

    const lType = leaveType;
    const lDuration = lType === "sick" ? "full" : leaveDuration;
    const lEndDate = (lDuration === "half" || lDuration === "first_half" || lDuration === "second_half") ? leaveStartDate : leaveEndDate;

    try {
      await addDoc(collection(db, "leaveRequests"), {
        employeeId: currentUserId,
        employeeName: `${user.firstName} ${user.lastName}`,
        department: user.department,
        startDate: leaveStartDate,
        endDate: lEndDate,
        reason: leaveReason,
        leaveType: lType,
        leaveDuration: lDuration,
        startTime: (lDuration === "first_half" || lDuration === "second_half" || lDuration === "half") ? leaveStartTime : null,
        endTime: (lDuration === "first_half" || lDuration === "second_half" || lDuration === "half") ? leaveEndTime : null,
        status: "pending",
        isManager: false,
        role: user.role,
        appliedAt: new Date().toISOString(),
      });
      showToastMessage("Leave request submitted!", "success");
      setLeaveStartDate("");
      setLeaveEndDate("");
      setLeaveReason("");
      fetchDashboardData();
    } catch (err) {
      showToastMessage("Failed to submit leave.", "error");
    }
  };

  const handleWorkLog = async (e) => {
    e.preventDefault();
    if (!taskStartTime || !taskEndTime)
      return alert("Please select both start and end time!");

    const [hours, mins] = calculatedDuration.split(":").map(Number);
    const totalHours = hours + mins / 60;

    try {
      const dataToSave = {
        employeeId: currentUserId,
        employeeName: `${user.firstName} ${user.lastName}`,
        department: user.department,
        workType: workType,
        description: description,
        hours: totalHours,
        minutes: hours * 60 + mins,
        taskStartTime,
        taskEndTime,
        duration: calculatedDuration,
        date: getISTDate(),
        clockInTime,
        createdAt: getISTTimeString(),
      };

      if (editingLogId) {
        const { createdAt, ...updateData } = dataToSave;
        await updateDoc(doc(db, "workLogs", editingLogId), { ...updateData, isEdited: true });
        showToastMessage("Work entry updated!", "success");
        setEditingLogId(null);
      } else {
        await addDoc(collection(db, "workLogs"), dataToSave);
        showToastMessage("Work entry saved!", "success");
      }

      setDescription("");
      setTaskStartTime("");
      setTaskEndTime("");
      setCalculatedDuration("");
      fetchDashboardData();
    } catch (err) {
      showToastMessage("Failed to save work.", "error");
    }
  };

  const handleEditLog = (log) => {
    setEditingLogId(log.id);
    setWorkType(log.workType || "office");
    setTaskStartTime(log.taskStartTime || "");
    setTaskEndTime(log.taskEndTime || "");
    setCalculatedDuration(log.duration || "");
    setDescription(log.description || "");
    setCurrentSection("workLog");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteLog = async (logId) => {
    if (window.confirm("Are you sure you want to delete this work entry?")) {
      try {
        await deleteDoc(doc(db, "workLogs", logId));
        showToastMessage("Work entry deleted!", "success");
        fetchDashboardData();
      } catch (err) {
        showToastMessage("Failed to delete entry.", "error");
      }
    }
  };

  const handleStartTimeChange = (e) => {
    setTaskStartTime(e.target.value);
    calculateDuration(e.target.value, taskEndTime);
  };

  const handleEndTimeChange = (e) => {
    setTaskEndTime(e.target.value);
    calculateDuration(taskStartTime, e.target.value);
  };

  const calculateDuration = (start, end) => {
    if (!start || !end) return setCalculatedDuration("");
    const [startHour, startMin, startSec] = start.split(":").map(Number);
    const [endHour, endMin, endSec] = end.split(":").map(Number);
    const startTotalSec = startHour * 3600 + startMin * 60 + startSec;
    const endTotalSec = endHour * 3600 + endMin * 60 + endSec;
    let diffSec = endTotalSec - startTotalSec;
    if (diffSec < 0) diffSec += 24 * 3600;
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    setCalculatedDuration(
      `${hours.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    );
  };

  const selectWorkType = (type) => setWorkType(type);
  const setCurrentAsStartTime = () => {
    setTaskStartTime(formatTimeForInput(new Date()));
    calculateDuration(formatTimeForInput(new Date()), taskEndTime);
  };
  const setCurrentAsEndTime = () => {
    setTaskEndTime(formatTimeForInput(new Date()));
    calculateDuration(taskStartTime, formatTimeForInput(new Date()));
  };

  // Loading Screen if Firebase is fetching
  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    switch (currentSection) {
      case "dashboard": {
        const myLogsCount = allWorkLogs.filter(log => log.employeeId === currentUserId).length;
        const pendingLeaves = myPendingLeaveRequests.length;
        const approvedLeaves = myApprovedLeaveRequests.length;

        const employeeStats = [
          {
            title: "Total Work Logs",
            value: myLogsCount,
            icon: "fa-clipboard-check",
            color: "from-blue-400 to-indigo-500",
            action: () => setCurrentSection("myReports"),
          },
          {
            title: "Pending Leaves",
            value: pendingLeaves,
            icon: "fa-hourglass-half",
            color: "from-orange-400 to-pink-500",
            action: () => setCurrentSection("leave"),
          },
          {
            title: "Approved Leaves",
            value: approvedLeaves,
            icon: "fa-check-circle",
            color: "from-emerald-400 to-teal-500",
            action: () => setCurrentSection("leave"),
          },
          {
            title: "Public Holidays",
            value: publicHolidays.length,
            icon: "fa-umbrella-beach",
            color: "from-purple-400 to-pink-500",
            action: () => setCurrentSection("holidays"),
          },
        ];

        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Welcome & Clock */}
            <motion.div
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gradient-to-r from-gray-800 to-gray-700 border-gray-600"
                : "bg-gradient-to-r from-blue-50 via-cyan-50 to-teal-50 border-blue-100"
                }`}
            >
              <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-6 text-center sm:text-left">
                <div className="flex flex-col items-center sm:items-start">
                  <h1
                    className={`text-3xl sm:text-4xl font-bold ${isDark ? "text-white" : "text-gray-800"
                      }`}
                  >
                    Welcome back, <span className="text-blue-500 font-extrabold">{user?.firstName || "Employee"}</span>
                  </h1>
                  <p className={`text-sm mt-1 font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Here's a quick overview of your profile and attendance.
                  </p>
                </div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col items-center sm:items-end w-full sm:w-auto"
                >
                  <p className={`text-xl sm:text-2xl font-mono font-bold tracking-tight leading-none ${isDark ? "text-white" : "text-blue-600"
                    }`}>
                    {formatTime(currentTime)}
                  </p>
                  <p className={`text-sm font-bold tracking-wide mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {formatDate(currentTime)}
                  </p>

                  {/* Clock In Section Inside Welcome */}
                  <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-end gap-3 bg-white/40 dark:bg-gray-800/50 p-2.5 rounded-xl border border-white/50 dark:border-gray-700 w-fit">
                    <p className={`text-base font-bold ml-1 ${isDark ? "text-white" : "text-gray-800"}`}>
                      {clockedIn ? "🟢 Clocked In" : "🔴 Not Clocked In"}
                    </p>
                    {!clockedIn ? (
                      <motion.button
                        onClick={handleClockIn}
                        animate={{ filter: ["brightness(1)", "brightness(0.6)", "brightness(1)"] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        className="relative px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-blue-900/40 hover:shadow-blue-900/60 transition-all text-sm transform hover:-translate-y-0.5"
                      >
                        <i className="fas fa-sign-in-alt mr-1"></i> Clock In
                      </motion.button>
                    ) : (
                      <motion.button
                        onClick={handleClockOut}
                        animate={{ filter: ["brightness(1)", "brightness(0.6)", "brightness(1)"] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        className="relative px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-lg font-bold shadow-lg shadow-red-900/40 hover:shadow-red-900/60 transition-all text-sm transform hover:-translate-y-0.5"
                      >
                        <i className="fas fa-sign-out-alt mr-1"></i> Clock Out
                      </motion.button>
                    )}

                    {clockedIn && (
                      <motion.button
                        onClick={handleToggleBreak}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`px-5 py-2.5 rounded-lg font-bold shadow-lg transition-all text-sm flex items-center gap-2 ${isOnBreak
                          ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-900/40"
                          : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-900/40"
                          }`}
                      >
                        <i className={`fas ${isOnBreak ? "fa-play" : "fa-coffee"}`}></i>
                        {isOnBreak ? "Resume Work" : "Start Break"}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {employeeStats.map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.03, y: -5 }}
                  className={`rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border cursor-pointer ${isDark
                    ? "bg-gray-800 border-gray-700 hover:bg-gray-750"
                    : "bg-white border-gray-100"
                    }`}
                  onClick={stat.action}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={isDark ? "text-gray-400 text-sm font-medium" : "text-gray-500 text-sm font-medium"}>
                        {stat.title}
                      </p>
                      <p className={`text-4xl font-bold mt-1 ${isDark ? "text-white" : "text-gray-800"}`}>
                        {stat.value}
                      </p>
                    </div>
                    <div className={`w-14 h-14 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center shadow-lg mt-5`}>
                      <i className={`fas ${stat.icon} text-white text-xl`}></i>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setCurrentSection("workLog")}
                className="cursor-pointer bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl p-6 text-white shadow-lg"
              >
                <h3 className="text-xl font-bold mb-2">Log Your Work</h3>
                <p className="text-blue-100 mb-4">
                  Ready to submit your daily activities?
                </p>
                <div className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-all inline-block">
                  Go to Activity Log <i className="fas fa-arrow-right ml-2"></i>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setCurrentSection("myReports")}
                className="cursor-pointer bg-gradient-to-br from-teal-400 to-emerald-500 rounded-2xl p-6 text-white shadow-lg"
              >
                <h3 className="text-xl font-bold mb-2">My Reports</h3>
                <p className="text-teal-100 mb-4">
                  View your past submitted work logs.
                </p>
                <div className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-all inline-block">
                  View Reports <i className="fas fa-arrow-right ml-2"></i>
                </div>
              </motion.div>
            </div>
          </motion.div>
        );
      }

      case "workLog":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <h2 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
              Log Your Work
            </h2>

            {/* Work Type Selection */}
            <motion.div
              className={`rounded-2xl p-6 sm:p-8 shadow-sm border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <h2
                className={`text-xl font-bold mb-6 ${isDark ? "text-white" : "text-gray-800"
                  }`}
              >
                Select Work Type
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Office Work Card */}
                <button
                  type="button"
                  onClick={() => selectWorkType("office")}
                  className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all duration-200 ${workType === "office"
                    ? "border-blue-500 bg-blue-50/50 shadow-sm"
                    : isDark
                      ? "border-gray-700 hover:border-gray-600 bg-gray-800"
                      : "border-gray-100 hover:border-blue-100 hover:shadow-sm bg-white"
                    }`}
                >
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${workType === "office"
                      ? "bg-blue-600 shadow-md"
                      : "bg-blue-500"
                      }`}
                  >
                    <i className="fas fa-briefcase text-white text-2xl"></i>
                  </div>
                  <p
                    className={`text-lg font-bold mb-1 ${isDark ? "text-white" : "text-gray-800"
                      }`}
                  >
                    Office Work
                  </p>
                  <p
                    className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                  >
                    Work done in office
                  </p>
                </button>

                {/* Non-Office Work Card */}
                <button
                  type="button"
                  onClick={() => selectWorkType("non_office")}
                  className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all duration-200 ${workType === "non_office"
                    ? "border-purple-500 bg-purple-50/50 shadow-sm"
                    : isDark
                      ? "border-gray-700 hover:border-gray-600 bg-gray-800"
                      : "border-gray-100 hover:border-purple-100 hover:shadow-sm bg-white"
                    }`}
                >
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${workType === "non_office"
                      ? "bg-purple-600 shadow-md"
                      : "bg-purple-500"
                      }`}
                  >
                    <i className="fas fa-laptop text-white text-2xl"></i>
                  </div>
                  <p
                    className={`text-lg font-bold mb-1 ${isDark ? "text-white" : "text-gray-800"
                      }`}
                  >
                    Non-Office Work
                  </p>
                  <p
                    className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                  >
                    Remote work
                  </p>
                </button>
              </div>

              {/* Selected Status Text */}
              <div className="mt-6 flex items-center">
                <p
                  className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"
                    }`}
                >
                  Selected:{" "}
                  <span
                    className={`font-bold ml-1 ${isDark ? "text-white" : "text-gray-900"
                      }`}
                  >
                    {workType === "office"
                      ? "Office Work"
                      : workType === "non_office"
                        ? "Non-Office Work"
                        : "None"}
                  </span>
                </p>
              </div>
            </motion.div>

            {/* Add Work Entry Form */}
            <motion.div
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <h2
                className={`text-xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"
                  }`}
              >
                Add Work Entry
              </h2>
              <form onSubmit={handleWorkLog} className="space-y-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                  >
                    Work Description
                  </label>
                  <textarea
                    name="description"
                    rows="4"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-xl ${isDark
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "border-gray-200"
                      }`}
                    placeholder="Describe your work..."
                  ></textarea>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                    >
                      Task Start Time
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={taskStartTime}
                        onChange={handleStartTimeChange}
                        required
                        className={`flex-1 px-3 py-2.5 border-2 rounded-xl ${isDark
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "border-gray-200"
                          }`}
                      />
                      <button
                        type="button"
                        onClick={setCurrentAsStartTime}
                        className="px-3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold"
                      >
                        <i className="fas fa-clock"></i>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                    >
                      Task Complete Time
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={taskEndTime}
                        onChange={handleEndTimeChange}
                        required
                        className={`flex-1 px-3 py-2.5 border-2 rounded-xl ${isDark
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "border-gray-200"
                          }`}
                      />
                      <button
                        type="button"
                        onClick={setCurrentAsEndTime}
                        className="px-3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold"
                      >
                        <i className="fas fa-clock"></i>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                    >
                      Time Taken
                    </label>
                    <div className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white font-mono font-bold text-center">
                      {calculatedDuration || "00:00:00"}
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-4 rounded-xl font-bold"
                >
                  {editingLogId ? "Update Work Entry" : "Save Entry"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        );

      case "myReports":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <h1 className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
              My Reports
            </h1>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 md:flex-[2] relative group">
                  <i className={`fas fa-search absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? "text-gray-500" : "text-gray-400"} group-focus-within:text-blue-500 transition-colors`}></i>
                  <input
                    type="text"
                    placeholder="Search messages / keywords..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-11 pr-4 py-3 rounded-2xl border transition-all ${isDark
                      ? "bg-gray-800 border-gray-700 text-white focus:ring-2 focus:ring-blue-500/50"
                      : "bg-white border-gray-200 text-gray-800 focus:ring-4 focus:ring-blue-100 placeholder:text-gray-400"
                      }`}
                  />
                </div>

                <div className={`md:w-fit px-4 py-3 rounded-2xl border flex flex-col sm:flex-row items-center gap-3 transition-all ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100 shadow-sm"}`}>
                  <div className="flex items-center gap-2 w-full">
                    <i className={`fas fa-calendar-alt text-xs ${isDark ? "text-blue-400" : "text-blue-500"}`}></i>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className={`bg-transparent border-none text-xs font-bold outline-none w-[110px] ${isDark ? "text-white" : "text-slate-700"}`}
                    />
                    <span className={`text-[10px] opacity-40 ${isDark ? "text-white" : "text-slate-700"}`}>
                      <i className="fas fa-arrow-right"></i>
                    </span>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className={`bg-transparent border-none text-xs font-bold outline-none w-[110px] ${isDark ? "text-white" : "text-slate-700"}`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl p-6 shadow-xl border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <h2
                className={`text-xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"
                  }`}
              >
                {searchTerm ? `Search Results for "${searchTerm}"` : `Work History from ${reportStartDate} to ${reportEndDate}`}
              </h2>
              {filteredWorkLogs.length === 0 ? (
                <p
                  className={`text-center py-8 ${isDark ? "text-gray-400" : "text-gray-500"
                    }`}
                >
                  No work entries found for this period.
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredWorkLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`flex flex-col justify-between p-4 rounded-xl border gap-2 ${isDark
                        ? "bg-gray-700 border-gray-600"
                        : "bg-gray-50 border-gray-200"
                        }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <span
                          className={`font-bold ${isDark ? "text-white" : "text-gray-800"
                            }`}
                        >
                          {WORK_TYPES?.[log.workType]?.name || log.workType} <span className="text-sm font-normal text-gray-400 ml-2">({log.date})</span>
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                            {log.duration}
                          </span>
                          <button onClick={() => handleEditLog(log)} className="text-blue-500 hover:text-blue-600 transition-colors p-1" title="Edit">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button onClick={() => handleDeleteLog(log.id)} className="text-rose-500 hover:text-rose-600 transition-colors p-1" title="Delete">
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                      <p
                        className={`text-sm mb-2 ${isDark ? "text-gray-400" : "text-gray-500"
                          }`}
                      >
                        <i className="fas fa-clock mr-1"></i>
                        {log.taskStartTime} - {log.taskEndTime}
                      </p>
                      <p className={isDark ? "text-gray-300" : "text-gray-600"}>
                        {log.description}
                        {log.isEdited && <span className={`ml-2 text-xs italic ${isDark ? "text-gray-500" : "text-gray-400"}`}>(edited)</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        );

      case "activityTracking":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <h1 className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
              <i className="fas fa-desktop mr-3 text-blue-500"></i> My Application Usage
            </h1>
            <ActivityReport
              currentUserEmail={user.email}
              isDark={isDark}
            />
          </motion.div>
        );

      case "leave":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <h1
              className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"
                }`}
            >
              Leave Requests
            </h1>

            {/* Leave Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(LEAVE_BALANCE).map(([type, data]) => {
                const used = getUsedLeaves(type);
                const remaining = data.total - used;
                return (
                  <div
                    key={type}
                    className={`rounded-2xl p-6 shadow-lg border ${isDark
                      ? "bg-gray-800 border-gray-700"
                      : "bg-white border-gray-100"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${type === "sick"
                            ? "bg-gradient-to-br from-rose-400 to-red-500"
                            : "bg-gradient-to-br from-blue-400 to-cyan-500"
                            }`}
                        >
                          <i
                            className={`fas ${data.icon} text-white text-xl`}
                          ></i>
                        </div>
                        <div>
                          <h3
                            className={`font-bold ${isDark ? "text-white" : "text-gray-800"
                              }`}
                          >
                            {data.name}
                          </h3>
                          <p
                            className={
                              isDark
                                ? "text-gray-400 text-sm"
                                : "text-gray-500 text-sm"
                            }
                          >
                            Per Year
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-3xl font-bold ${remaining > 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                        >
                          {remaining}
                        </p>
                        <p
                          className={
                            isDark
                              ? "text-gray-400 text-sm"
                              : "text-gray-500 text-sm"
                          }
                        >
                          Available
                        </p>
                      </div>
                    </div>
                    <div
                      className={`h-3 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-200"
                        }`}
                    >
                      <div
                        className={`h-3 rounded-full ${type === "sick"
                          ? "bg-gradient-to-r from-rose-400 to-red-500"
                          : "bg-gradient-to-r from-blue-400 to-cyan-500"
                          }`}
                        style={{ width: `${(used / data.total) * 100}%` }}
                      ></div>
                    </div>
                    <p
                      className={`text-sm mt-2 ${isDark ? "text-gray-400" : "text-gray-500"
                        }`}
                    >
                      Used: {used} / {data.total}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Request Form */}
            <motion.div
              className={`rounded-2xl p-4 sm:p-6 shadow-lg border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <h2
                className={`text-xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"
                  }`}
              >
                Submit Leave Request
              </h2>
              <form onSubmit={handleSubmitLeaveRequest} className="space-y-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                  >
                    Leave Type
                  </label>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {Object.entries(LEAVE_BALANCE).map(([type, data]) => {
                      const isAvailable = data.total - getUsedLeaves(type) > 0;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setLeaveType(type)}
                          disabled={!isAvailable}
                          className={`p-4 rounded-xl border-2 text-left transition ${leaveType === type
                            ? type === "sick"
                              ? "border-rose-500 bg-rose-50"
                              : "border-blue-500 bg-blue-50"
                            : isDark
                              ? "border-gray-600 bg-gray-700"
                              : "border-gray-200"
                            } ${!isAvailable ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${type === "sick"
                                ? "bg-gradient-to-br from-rose-400 to-red-500"
                                : "bg-gradient-to-br from-blue-400 to-cyan-500"
                                }`}
                            >
                              <i className={`fas ${data.icon} text-white`}></i>
                            </div>
                            <div>
                              <p
                                className={`font-bold ${isDark ? "text-white" : "text-gray-800"
                                  }`}
                              >
                                {data.name}
                              </p>
                              <p
                                className={`text-sm ${isAvailable
                                  ? "text-emerald-500"
                                  : "text-rose-500"
                                  }`}
                              >
                                {data.total - getUsedLeaves(type)} available
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Casual Leave Specific: Duration Dropdown */}
                <AnimatePresence>
                  {leaveType === "casual" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 relative z-20"
                    >
                      <label
                        className={`block text-sm font-bold ${isDark ? "text-gray-300" : "text-gray-700"
                          }`}
                      >
                        Casual Leave Type
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Custom Duration Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsDurationDropdownOpen(!isDurationDropdownOpen)}
                            className={`w-full flex items-center px-4 py-3.5 border-2 rounded-xl transition-all focus:border-blue-500 ${isDark
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-gray-50 border-gray-100 text-gray-800 shadow-sm"
                              }`}
                          >
                            <i className={`fas fa-clock mr-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}></i>
                            <span className="flex-1 text-left font-bold text-sm sm:text-base">
                              {leaveDuration === "full" ? "Full Day Leave" : "Half Day Leave"}
                            </span>
                            <motion.i
                              animate={{ rotate: isDurationDropdownOpen ? 180 : 0 }}
                              className={`fas fa-chevron-down ml-2 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
                            ></motion.i>
                          </button>

                          <AnimatePresence>
                            {isDurationDropdownOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className={`absolute z-[100] w-full mt-2 rounded-xl shadow-2xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"
                                  }`}
                              >
                                {[
                                  { value: "full", label: "Full Day Leave" },
                                  { value: "half", label: "Half Day Leave" },
                                ].map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      const val = opt.value;
                                      if (val === "full") {
                                        setLeaveDuration("full");
                                      } else {
                                        setLeaveDuration("first_half");
                                        setLeaveEndDate(leaveStartDate);
                                        setLeaveStartTime("09:00");
                                        setLeaveEndTime("13:30");
                                      }
                                      setIsDurationDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-3.5 first:rounded-t-xl last:rounded-b-xl hover:bg-blue-500 hover:text-white transition-colors font-bold ${leaveDuration === opt.value
                                        ? "bg-blue-500/10 text-blue-500"
                                        : isDark ? "text-gray-200" : "text-gray-700"
                                      }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Custom Secondary Half-Type Dropdown */}
                        {(leaveDuration === "half" || leaveDuration === "first_half" || leaveDuration === "second_half") && (
                          <div className="relative">
                            <motion.button
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              type="button"
                              onClick={() => setIsHalfTypeDropdownOpen(!isHalfTypeDropdownOpen)}
                              className={`w-full flex items-center px-4 py-3.5 border-2 rounded-xl transition-all focus:border-blue-500 ${isDark
                                ? "bg-gray-700 border-gray-600 text-white"
                                : "bg-gray-50 border-gray-100 text-gray-800 shadow-sm"
                                }`}
                            >
                              <i className={`fas fa-adjust mr-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}></i>
                              <span className="flex-1 text-left font-bold text-sm sm:text-base">
                                {leaveDuration === "second_half" ? "Second Half" : "First Half"}
                              </span>
                              <motion.i
                                animate={{ rotate: isHalfTypeDropdownOpen ? 180 : 0 }}
                                className={`fas fa-chevron-down ml-2 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
                              ></motion.i>
                            </motion.button>

                            <AnimatePresence>
                              {isHalfTypeDropdownOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className={`absolute z-[100] w-full mt-2 rounded-xl shadow-2xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"
                                    }`}
                                >
                                  {[
                                    { value: "first_half", label: "First Half" },
                                    { value: "second_half", label: "Second Half" },
                                  ].map((opt) => (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => {
                                        setLeaveDuration(opt.value);
                                        setLeaveEndDate(leaveStartDate);
                                        if (opt.value === "first_half") {
                                          setLeaveStartTime("09:00");
                                          setLeaveEndTime("13:30");
                                        } else {
                                          setLeaveStartTime("13:30");
                                          setLeaveEndTime("18:00");
                                        }
                                        setIsHalfTypeDropdownOpen(false);
                                      }}
                                      className={`w-full text-left px-4 py-3.5 first:rounded-t-xl last:rounded-b-xl hover:bg-blue-500 hover:text-white transition-colors font-bold ${leaveDuration === opt.value
                                          ? "bg-blue-500/10 text-blue-500"
                                          : isDark ? "text-gray-200" : "text-gray-700"
                                        }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                      <p className={`text-[11px] font-medium px-1 flex items-center gap-1.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        <i className="fas fa-info-circle text-blue-400"></i>
                        {leaveDuration === "full"
                          ? "This will count as 1 full day from your balance."
                          : "This will count as 0.5 days from your balance."}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 relative z-10">
                  <div className={(leaveDuration === "first_half" || leaveDuration === "second_half" || leaveDuration === "half") && leaveType === "casual" ? "md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4" : ""}>
                    <div className={(leaveDuration === "first_half" || leaveDuration === "second_half" || leaveDuration === "half") && leaveType === "casual" ? "md:col-span-1" : ""}>
                      <label
                        className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                          }`}
                      >
                        {(leaveDuration === "first_half" || leaveDuration === "second_half" || leaveDuration === "half") && leaveType === "casual" ? "Leave Date" : "Start Date"}
                      </label>
                      <input
                        type="date"
                        value={leaveStartDate}
                        onChange={(e) => {
                          setLeaveStartDate(e.target.value);
                          if (leaveDuration === "half" || leaveDuration === "first_half" || leaveDuration === "second_half") setLeaveEndDate(e.target.value);
                        }}
                        required
                        className={`w-full px-4 py-3 border-2 rounded-xl transition-all ${isDark
                          ? "bg-gray-700 border-gray-600 focus:border-blue-500 text-white"
                          : "border-gray-200 focus:border-blue-500 focus:bg-white"
                          }`}
                      />
                    </div>

                    {(leaveDuration === "first_half" || leaveDuration === "second_half" || leaveDuration === "half") && leaveType === "casual" && (
                      <>
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                            From Time
                          </label>
                          <input
                            type="time"
                            value={leaveStartTime}
                            onChange={(e) => setLeaveStartTime(e.target.value)}
                            required
                            className={`w-full px-4 py-3 border-2 rounded-xl transition-all ${isDark
                              ? "bg-gray-700 border-gray-600 focus:border-blue-500 text-white"
                              : "border-gray-200 focus:border-blue-500 focus:bg-white text-gray-800"
                              }`}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                            To Time
                          </label>
                          <input
                            type="time"
                            value={leaveEndTime}
                            onChange={(e) => setLeaveEndTime(e.target.value)}
                            required
                            className={`w-full px-4 py-3 border-2 rounded-xl transition-all ${isDark
                              ? "bg-gray-700 border-gray-600 focus:border-blue-500 text-white"
                              : "border-gray-200 focus:border-blue-500 focus:bg-white text-gray-800"
                              }`}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  {!(leaveDuration === "half" || leaveDuration === "first_half" || leaveDuration === "second_half" && leaveType === "casual") && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <label
                        className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                          }`}
                      >
                        End Date
                      </label>
                      <input
                        type="date"
                        value={leaveEndDate}
                        onChange={(e) => setLeaveEndDate(e.target.value)}
                        required
                        className={`w-full px-4 py-3 border-2 rounded-xl transition-all ${isDark
                          ? "bg-gray-700 border-gray-600 focus:border-blue-500 text-white"
                          : "border-gray-200 focus:border-blue-500 focus:bg-white"
                          }`}
                      />
                    </motion.div>
                  )}
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                  >
                    Reason
                  </label>
                  <textarea
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    rows="3"
                    required
                    className={`w-full px-4 py-3 border-2 rounded-xl ${isDark
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "border-gray-200"
                      }`}
                    placeholder="Enter reason for leave..."
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-4 rounded-xl font-bold"
                >
                  Submit Request
                </button>
              </form>
            </motion.div>

            {/* New Leave History with Table and Search */}
            <motion.div
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2
                  className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}
                >
                  Leave History
                </h2>

                {/* Search and Filter Row */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative group">
                    <i className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? "text-gray-500" : "text-gray-400"} group-focus-within:text-blue-500 transition-colors`}></i>
                    <input
                      type="text"
                      placeholder="Search leave type or reason..."
                      value={leaveSearchTerm}
                      onChange={(e) => setLeaveSearchTerm(e.target.value)}
                      className={`pl-9 pr-4 py-2 rounded-xl border text-sm transition-all focus:outline-none ${isDark
                        ? "bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500/50"
                        : "bg-gray-50 border-gray-200 text-gray-800 focus:ring-2 focus:ring-blue-100"
                        }`}
                    />
                  </div>

                  <select
                    value={leaveStatusFilter}
                    onChange={(e) => setLeaveStatusFilter(e.target.value)}
                    className={`px-4 py-2 rounded-xl border text-sm focus:outline-none cursor-pointer ${isDark
                      ? "bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500/50"
                      : "bg-gray-50 border-gray-200 text-gray-800 focus:ring-2 focus:ring-blue-100"
                      }`}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto -mx-6 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr>
                        {["Date Applied", "Leave Type", "From", "To", "Duration", "Reason", "Status"].map((head) => (
                          <th key={head} className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-100"}`}>
                      {filteredMyLeaveHistory.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-gray-500 italic">
                            No leave records found matching your selection.
                          </td>
                        </tr>
                      ) : (
                        filteredMyLeaveHistory.map((req) => (
                          <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className={`px-4 py-4 whitespace-nowrap text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                              {new Date(req.appliedAt || req.startDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${req.leaveType === "sick" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"}`}>
                                {LEAVE_BALANCE[req.leaveType]?.name}
                              </span>
                              {(req.leaveDuration === "half" || req.leaveDuration === "first_half" || req.leaveDuration === "second_half") && (
                                <div className="mt-1 flex flex-col gap-0.5">
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-orange-100 text-orange-700 w-fit">
                                    {req.leaveDuration === "first_half" ? "1st Half" : req.leaveDuration === "second_half" ? "2nd Half" : "Half"}
                                  </span>
                                  {req.startTime && req.endTime && (
                                    <span className={`text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                      {req.startTime} - {req.endTime}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${isDark ? "text-white" : "text-gray-800"}`}>
                              {req.startDate}
                            </td>
                            <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${isDark ? "text-white" : "text-gray-800"}`}>
                              {req.endDate}
                            </td>
                            <td className={`px-4 py-4 whitespace-nowrap text-sm font-bold ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                              {calculateLeaveDuration(req.startDate, req.endDate, req.leaveDuration)} Days
                            </td>
                            <td className="px-4 py-4">
                              <p className={`text-sm line-clamp-1 max-w-[150px] ${isDark ? "text-gray-400" : "text-gray-500"}`} title={req.reason}>
                                {req.reason}
                              </p>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${req.status === "pending"
                                  ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                                  : req.status === "approved"
                                    ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                                    : "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                                  }`}
                              >
                                {req.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </motion.div>
        );

      case "holidays": {
        const currentYear = new Date().getFullYear();
        // Generate current month info
        const todayDate = new Date();
        const calYear = currentCalendarDate.getFullYear();
        const calMonth = currentCalendarDate.getMonth();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();

        const IT_HOLIDAYS = publicHolidays;

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        const calendarDays = Array(firstDayOfMonth).fill(null);
        for (let i = 1; i <= daysInMonth; i++) {
          calendarDays.push(i);
        }

        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between mb-8">
              <h1
                className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"
                  } flex items-center`}
              >
                <i className="fas fa-umbrella-beach mr-3 text-blue-500"></i>
                Public Holidays
              </h1>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mt-8 items-start">
              {/* Holidays List */}
              <div className="w-full md:w-3/5 grid grid-cols-1 gap-4">
                {IT_HOLIDAYS.map((holiday, idx) => {
                  const holDate = new Date(holiday.date);
                  const todayZero = new Date(todayDate);
                  todayZero.setHours(0, 0, 0, 0);
                  const holZero = new Date(holDate);
                  holZero.setHours(0, 0, 0, 0);

                  const isPast = holZero < todayZero;

                  return (
                    <div key={idx} onClick={() => setCurrentCalendarDate(new Date(holiday.date))} className={`cursor-pointer flex items-center justify-between p-4 rounded-xl shadow-sm border tracking-wide transition-all duration-300 ${isPast ? (isDark ? 'bg-gray-800/80 border-gray-700 opacity-60' : 'bg-gray-100 border-gray-200 opacity-70') : (isDark ? 'bg-gray-800 border-gray-700 hover:border-blue-500/50 hover:shadow-md' : 'bg-white border-blue-100 hover:border-blue-200 hover:shadow-md')}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold ${isPast ? 'bg-gray-300 text-gray-500' : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md'}`}>
                          <span className="text-[10px] uppercase">{holDate.toLocaleString('default', { month: 'short' })}</span>
                          <span className="text-lg leading-none">{holDate.getDate()}</span>
                        </div>
                        <div>
                          <p className={`font-bold text-[15px] leading-tight ${isPast ? (isDark ? 'text-gray-400' : 'text-gray-600') : (isDark ? 'text-white' : 'text-gray-800')}`}>{holiday.name}</p>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} font-medium mt-1 inline-block`}><i className="far fa-calendar mr-1.5"></i>{holDate.toLocaleDateString(undefined, { weekday: 'long' })}</span>
                        </div>
                      </div>

                      <div>
                        {isPast ? (
                          <span className="text-[11px] font-bold text-gray-400 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">Passed</span>
                        ) : (
                          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-md">Upcoming</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Current Month Calendar */}
              <div className={`w-full md:w-2/5 md:sticky md:top-6 rounded-3xl p-6 shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
                      {monthNames[calMonth]}
                    </h3>
                    <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>{calYear}</p>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <button onClick={() => setCurrentCalendarDate(new Date(calYear, calMonth - 1, 1))} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><i className="fas fa-chevron-left text-sm"></i></button>
                    <button onClick={() => setCurrentCalendarDate(new Date())} className={`px-2.5 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>Today</button>
                    <button onClick={() => setCurrentCalendarDate(new Date(calYear, calMonth + 1, 1))} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><i className="fas fa-chevron-right text-sm"></i></button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <div key={day} className={`text-xs font-bold py-1 ${day === 'Su' || day === 'Sa' ? 'text-rose-400' : (isDark ? 'text-gray-400' : 'text-gray-500')}`}>{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2 text-center">
                  {calendarDays.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className="p-2"></div>;

                    const currentDateStr = `${currentYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isHoliday = IT_HOLIDAYS.some(h => h.date === currentDateStr);
                    const isToday = day === todayDate.getDate() && calMonth === todayDate.getMonth() && currentYear === todayDate.getFullYear();
                    const isWeekend = new Date(currentYear, calMonth, day).getDay() === 0 || new Date(currentYear, calMonth, day).getDay() === 6;

                    let dayClass = `aspect-square flex items-center justify-center rounded-xl text-sm font-bold cursor-default transition-all shadow-sm `;
                    if (isToday) {
                      dayClass += `bg-emerald-500 text-white shadow-emerald-500/30 ring-2 ring-emerald-300 ring-offset-2 dark:ring-offset-gray-800 scale-110 z-10`;
                    } else if (isHoliday) {
                      dayClass += `bg-blue-500 text-white shadow-blue-500/30 scale-105`;
                    } else if (isWeekend) {
                      dayClass += isDark ? `bg-gray-700/50 text-rose-400/80 border border-gray-700 ` : `bg-gray-50 text-rose-500/80 border border-gray-100`;
                    } else {
                      dayClass += isDark ? `bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600` : `bg-white text-gray-700 hover:bg-gray-50 border border-gray-200`;
                    }

                    return (
                      <div key={day} className={dayClass} title={isHoliday ? IT_HOLIDAYS.find(h => h.date === currentDateStr)?.name : ''}>
                        {day}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 space-y-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></span>
                    <span className={isDark ? "text-gray-300" : "text-gray-700"}>Public Holiday</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></span>
                    <span className={isDark ? "text-gray-300" : "text-gray-700"}>Today</span>
                  </div>
                </div>
              </div>
            </div>

          </motion.div>
        );
      }

      case "performance":
        return <MyPerformance userEmail={auth?.currentUser?.email} isDark={isDark} />;

      case "profile":
        return <ProfilePage auth={{ currentUser: user }} />;

      default:
        return null;
    }
  };

  return (
    <>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${toast.type === "success" ? "bg-green-600" : "bg-red-600"
              } text-white`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>



      {/* Mobile Hamburger Button */}
      {!isSidebarOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsSidebarOpen(true)}
          className={`fixed top-4 left-4 z-50 p-3 rounded-xl shadow-lg border ${isDark
            ? "bg-gray-800 text-white border-gray-700"
            : "bg-white text-gray-800 border-gray-200"
            } ${isSidebarOpen ? "md:hidden" : ""}`}
        >
          <i className="fas fa-bars text-xl"></i>
        </motion.button>
      )}

      <div
        className={`flex min-h-screen relative ${isDark
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50"
          }`}
      >
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && window.innerWidth < 1024 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />
          )}
        </AnimatePresence>

        <motion.div
          className={`fixed left-0 top-0 h-full w-full md:w-72 shadow-2xl p-4 flex flex-col z-50 border-r overflow-y-auto transition-transform duration-300 scrollbar-hide ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${isDark
            ? "bg-gradient-to-b from-gray-800 to-gray-900 border-gray-700"
            : "bg-gradient-to-b from-white to-blue-50 border-blue-100"
            }`}
        >
          <div className="text-center mb-8 pt-2">
            <div
              onClick={() => user?.profileImage && setIsFullScreenImage(true)}
              className={`w-20 h-20 ${user?.profileImage ? 'cursor-pointer hover:scale-105 transition-transform' : 'bg-gradient-to-br from-blue-400 via-cyan-500 to-teal-600'} rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg overflow-hidden`}
            >
              {user?.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {user?.firstName?.[0] || "E"}
                </span>
              )}
            </div>
            <h2
              className={`font-bold text-xl ${isDark ? "text-white" : "text-gray-800"
                }`}
            >
              {user?.firstName} {user?.lastName}
            </h2>
            <p
              className={`text-sm font-medium ${isDark ? "text-cyan-400" : "text-blue-600"
                }`}
            >
              {departmentsMap?.[user?.department]?.name}
            </p>
          </div>

          <nav className="flex-1 space-y-2 px-2 overflow-y-auto scrollbar-hide">
            <button
              onClick={() => {
                setCurrentSection("dashboard");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all font-bold ${currentSection === "dashboard"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-50 text-gray-700"
                }`}
            >
              <i className="fas fa-home w-5"></i> Dashboard
            </button>
            <button
              onClick={() => {
                setCurrentSection("workLog");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all font-bold ${currentSection === "workLog"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-50 text-gray-700"
                }`}
            >
              <i className="fas fa-clock w-5"></i> Log Work
            </button>
            <button
              onClick={() => {
                setCurrentSection("myReports");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all font-bold ${currentSection === "myReports"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-50 text-gray-700"
                }`}
            >
              <i className="fas fa-file-alt w-5"></i> My Reports
            </button>
            <button
              onClick={() => {
                setCurrentSection("activityTracking");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all font-bold ${currentSection === "activityTracking"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-50 text-gray-700"
                }`}
            >
              <i className="fas fa-desktop w-5"></i> Activity Tracking
            </button>
            <button
              onClick={() => {
                setCurrentSection("performance");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all font-bold ${currentSection === "performance"
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                : "hover:bg-blue-50/50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
                }`}
            >
              <i className="fas fa-tachometer-alt w-5 opacity-80"></i> My Performance
            </button>
            <button
              onClick={() => {
                setCurrentSection("leave");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all font-bold ${currentSection === "leave"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-50 text-gray-700"
                }`}
            >
              <i className="fas fa-calendar-minus w-5"></i> Leave Requests
            </button>
            <button
              onClick={() => {
                setCurrentSection("holidays");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all font-bold ${currentSection === "holidays"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-50 text-gray-700"
                }`}
            >
              <i className="fas fa-umbrella-beach w-5"></i> Public Holidays
            </button>


            <button
              onClick={() => {
                setCurrentSection("profile");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all font-bold ${currentSection === "profile"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-50 text-gray-700"
                }`}
            >
              <i className="fas fa-user-circle w-5"></i> My Profile
            </button>
          </nav>

          <button
            onClick={() => {
              auth?.logout();
              window.location.href = "/login";
            }}
            className="w-full text-left px-4 py-3.5 rounded-xl transition-all font-bold mt-4 hover:bg-red-50 text-gray-700 hover:text-red-600"
          >
            <i className="fas fa-sign-out-alt w-5"></i> Logout
          </button>
        </motion.div>

        <div
          className={`flex-1 overflow-x-hidden overflow-y-auto p-3 pt-20 sm:p-5 sm:pt-22 md:p-6 md:pt-24 lg:p-6 relative w-full transition-all duration-300 ${isSidebarOpen ? "lg:ml-72" : "lg:ml-0"
            }`}
          style={{ height: "100vh" }}
        >
          <AnimatePresence mode="wait">{renderSection()}</AnimatePresence>
        </div>
      </div>

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
