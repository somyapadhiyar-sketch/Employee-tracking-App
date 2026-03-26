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
import MessagingDashboard from "../components/MessagingDashboard";
import useMessageNotification from "../hooks/useMessageNotification";

// NEW FIREBASE IMPORTS
import { collection, getDocs, addDoc, doc, updateDoc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function EmployeeDashboard() {
  const { auth, onLogout } = useOutletContext();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { departmentsMap } = useDepartments();

  const [currentSection, setCurrentSection] = useState("workLog");
  const [reportFilter, setReportFilter] = useState("daily");
  const [workType, setWorkType] = useState(null);
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Time tracking states
  const [taskStartTime, setTaskStartTime] = useState("");
  const [taskEndTime, setTaskEndTime] = useState("");
  const [calculatedDuration, setCalculatedDuration] = useState("");

  // Leave request states
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveType, setLeaveType] = useState("sick");
  const [leaveFilter, setLeaveFilter] = useState("all");

  const [toast, setToast] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false
  );
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [isFullScreenImage, setIsFullScreenImage] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(true);
  const menuTimeoutRef = useRef(null);
  const [msgToast, setMsgToast] = useState(null);
  const msgToastTimerRef = useRef(null);

  // NEW STATE FOR FIREBASE DATA
  const [allWorkLogs, setAllWorkLogs] = useState([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // 1. Fetch data from Firestore
  const fetchDashboardData = async () => {
    setLoadingData(true);
    try {
      const uId = auth?.currentUser?.uid || auth?.currentUser?.id;
      if (uId) {
        const userSnap = await getDoc(doc(db, "users", uId));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const todayStr = new Date().toISOString().split("T")[0];
          if (userData.lastClockInDate === todayStr && userData.lastClockOutDate !== todayStr) {
            setClockedIn(true);
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

  // Mobile menu visibility simplified

  const LEAVE_BALANCE = {
    sick: { total: 6, name: "Sick Leave", icon: "fa-user-nurse" },
    casual: { total: 10, name: "Casual Leave", icon: "fa-umbrella-beach" },
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
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

  // --- DERIVED DATA ---
  const user = auth?.currentUser || {};
  const currentUserId = user?.uid || user?.id;
  const today = new Date().toISOString().split("T")[0];

  // Real-time message notifications
  const isMessagesOpen = currentSection === "messages";
  const { unreadCount, latestMessage, clearNotification } = useMessageNotification(
    currentUserId,
    "employee",
    isMessagesOpen
  );

  // Show toast when a new message arrives
  useEffect(() => {
    if (latestMessage) {
      setMsgToast(latestMessage);
      clearTimeout(msgToastTimerRef.current);
      msgToastTimerRef.current = setTimeout(() => {
        setMsgToast(null);
        clearNotification();
      }, 5000);
    }
  }, [latestMessage, clearNotification]); // Added clearNotification to dependencies

  const filteredWorkLogs = allWorkLogs.filter((log) => {
    if (log.employeeId !== currentUserId) return false;

    const todayObj = new Date();
    const logDateObj = new Date(log.date);

    if (reportFilter === "daily") {
      return log.date === today;
    } else if (reportFilter === "weekly") {
      const diffTime = Math.abs(todayObj - logDateObj);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    } else if (reportFilter === "monthly") {
      return logDateObj.getMonth() === todayObj.getMonth() && logDateObj.getFullYear() === todayObj.getFullYear();
    }
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const myLeaveRequests = allLeaveRequests.filter(
    (req) => req.employeeId === currentUserId
  );
  const myPendingLeaveRequests = myLeaveRequests.filter(
    (req) => req.status === "pending"
  );
  const myApprovedLeaveRequests = myLeaveRequests.filter(
    (req) => req.status === "approved"
  );

  const getUsedLeaves = (type) =>
    myApprovedLeaveRequests.filter((req) => req.leaveType === type).length;

  const handleClockIn = async () => {
    setClockedIn(true);
    setClockInTime(formatTime(currentTime));
    try {
      const todayDate = new Date().toISOString().split("T")[0];
      await updateDoc(doc(db, "users", currentUserId), {
        lastClockInDate: todayDate,
        lastClockInTime: new Date().toISOString(),
        lastClockOutDate: null,
        lastClockOutTime: null
      });
      showToastMessage("Clocked in successfully!", "success");
    } catch (err) {
      console.error(err);
      showToastMessage("Failed to clock in to database.", "error");
    }
  };

  const handleClockOut = async () => {
    setClockedIn(false);
    try {
      const todayDate = new Date().toISOString().split("T")[0];
      await updateDoc(doc(db, "users", currentUserId), {
        lastClockOutDate: todayDate,
        lastClockOutTime: new Date().toISOString()
      });
      showToastMessage("Clocked out successfully!", "success");
    } catch (err) {
      console.error(err);
      showToastMessage("Failed to clock out to database.", "error");
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

    try {
      await addDoc(collection(db, "leaveRequests"), {
        employeeId: currentUserId,
        employeeName: `${user.firstName} ${user.lastName}`,
        department: user.department,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason,
        leaveType: leaveType,
        status: "pending",
        isManager: false,
        role: user.role,
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
      await addDoc(collection(db, "workLogs"), {
        employeeId: currentUserId,
        employeeName: `${user.firstName} ${user.lastName}`,
        department: user.department,
        workType: workType,
        description: e.target.description.value,
        hours: totalHours,
        minutes: hours * 60 + mins,
        taskStartTime,
        taskEndTime,
        duration: calculatedDuration,
        date: today,
        clockInTime: clockInTime ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
      });
      e.target.reset();
      setTaskStartTime("");
      setTaskEndTime("");
      setCalculatedDuration("");
      showToastMessage("Work entry saved!", "success");
      fetchDashboardData();
    } catch (err) {
      showToastMessage("Failed to log work.", "error");
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
      case "workLog":
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
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1
                    className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"
                      }`}
                  >
                    Log Your Work
                  </h1>
                  <p
                    className={
                      isDark ? "text-gray-400 mt-1" : "text-gray-500 mt-1"
                    }
                  >
                    {formatDate(currentTime)}
                  </p>
                </div>
                <motion.div className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl px-6 py-3 shadow-lg">
                  <p className="text-white text-xs font-medium">Current Time</p>
                  <p className="text-white text-2xl font-mono font-bold">
                    {formatTime(currentTime)}
                  </p>
                </motion.div>
              </div>
            </motion.div>

            {/* Clock In/Out Card */}
            <motion.div className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl p-6 shadow-lg text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Current Status</p>
                  <p className="text-2xl font-bold">
                    {clockedIn ? "🟢 Clocked In" : "🔴 Not Clocked In"}
                  </p>
                  <p className="text-blue-100">{formatTime(currentTime)}</p>
                </div>
                {!clockedIn ? (
                  <button
                    onClick={handleClockIn}
                    className="px-6 py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 shadow-lg"
                  >
                    <i className="fas fa-sign-in-alt mr-2"></i> Clock In
                  </button>
                ) : (
                  <button
                    onClick={handleClockOut}
                    className="px-6 py-3 bg-white text-rose-500 rounded-lg font-bold hover:bg-rose-50 shadow-lg"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i> Clock Out
                  </button>
                )}
              </div>
            </motion.div>

            {/* Work Type Selection
            <motion.div className={`rounded-2xl p-6 shadow-lg border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
              <h2 className={`text-xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"}`}>Select Work Type</h2>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => selectWorkType("office")} className={`p-6 border-2 rounded-xl text-center ${workType === "office" ? "border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50" : isDark ? "border-gray-600" : "border-gray-200"}`}>
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3"><i className="fas fa-briefcase text-white text-2xl"></i></div>
                  <p className={`font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Office Work</p>
                </button>
                <button onClick={() => selectWorkType("non_office")} className={`p-6 border-2 rounded-xl text-center ${workType === "non_office" ? "border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50" : isDark ? "border-gray-600" : "border-gray-200"}`}>
                  <div className="w-14 h-14 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center mx-auto mb-3"><i className="fas fa-laptop text-white text-2xl"></i></div>
                  <p className={`font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Non-Office Work</p>
                </button>
              </div>
            </motion.div> */}
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
                  Save Entry
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h1
                className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"
                  }`}
              >
                My Reports
              </h1>
              <div className={`p-1 flex flex-wrap gap-1 sm:gap-0 rounded-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                <button
                  onClick={() => setReportFilter('daily')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${reportFilter === 'daily' ? 'bg-blue-600 text-white' : isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setReportFilter('weekly')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${reportFilter === 'weekly' ? 'bg-blue-600 text-white' : isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setReportFilter('monthly')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${reportFilter === 'monthly' ? 'bg-blue-600 text-white' : isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                >
                  Monthly
                </button>
              </div>
            </div>
            <div
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <h2
                className={`text-xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"
                  }`}
              >
                {reportFilter === 'daily' ? "Today's Work History" : reportFilter === 'weekly' ? "Last 7 Days Work History" : "This Month's Work History"}
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
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {log.duration}
                        </span>
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
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              className={`rounded-2xl p-6 shadow-lg border ${isDark
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
                  <div className="grid grid-cols-2 gap-4">
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
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${type === "sick"
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                    >
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={leaveStartDate}
                      onChange={(e) => setLeaveStartDate(e.target.value)}
                      required
                      className={`w-full px-4 py-3 border-2 rounded-xl ${isDark
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "border-gray-200"
                        }`}
                    />
                  </div>
                  <div>
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
                      className={`w-full px-4 py-3 border-2 rounded-xl ${isDark
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "border-gray-200"
                        }`}
                    />
                  </div>
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

            {/* Leave History */}
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
                Leave History
              </h2>
              <div className="flex flex-wrap gap-3 mb-4">
                <button
                  onClick={() => setLeaveFilter("all")}
                  className={`px-4 py-2 rounded-xl ${leaveFilter === "all"
                    ? "bg-blue-500 text-white"
                    : isDark
                      ? "bg-gray-700 text-gray-200"
                      : "bg-gray-200 text-gray-700"
                    }`}
                >
                  All ({myLeaveRequests.length})
                </button>
                <button
                  onClick={() => setLeaveFilter("pending")}
                  className={`px-4 py-2 rounded-xl ${leaveFilter === "pending"
                    ? "bg-amber-500 text-white"
                    : isDark
                      ? "bg-gray-700 text-gray-200"
                      : "bg-gray-200 text-gray-700"
                    }`}
                >
                  Pending ({myPendingLeaveRequests.length})
                </button>
                <button
                  onClick={() => setLeaveFilter("approved")}
                  className={`px-4 py-2 rounded-xl ${leaveFilter === "approved"
                    ? "bg-emerald-500 text-white"
                    : isDark
                      ? "bg-gray-700 text-gray-200"
                      : "bg-gray-200 text-gray-700"
                    }`}
                >
                  Approved ({myApprovedLeaveRequests.length})
                </button>
              </div>
              <div className="space-y-3">
                {(leaveFilter === "all"
                  ? myLeaveRequests
                  : leaveFilter === "pending"
                    ? myPendingLeaveRequests
                    : myApprovedLeaveRequests
                ).map((req) => (
                  <div
                    key={req.id}
                    className={`flex flex-col justify-between p-4 rounded-xl gap-2 ${isDark ? "bg-gray-700" : "bg-gray-50"
                      }`}
                  >
                    <div className="flex flex-wrap gap-2 justify-between items-start mb-2">
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${req.leaveType === "sick"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-blue-100 text-blue-700"
                          }`}
                      >
                        {LEAVE_BALANCE[req.leaveType]?.name}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs ${req.status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : req.status === "approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                          }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <p
                      className={`font-bold ${isDark ? "text-white" : "text-gray-800"
                        }`}
                    >
                      {req.startDate} - {req.endDate}
                    </p>
                    <p
                      className={
                        isDark
                          ? "text-gray-300 text-sm"
                          : "text-gray-600 text-sm"
                      }
                    >
                      {req.reason}
                    </p>
                  </div>
                ))}
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
              <h1 className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
                <i className="fas fa-umbrella-beach mr-3 text-emerald-500"></i>
                Public Holidays
              </h1>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 items-start">
              {/* Holidays List */}
              <div className="w-full xl:w-3/5 grid grid-cols-1 gap-4">
                {IT_HOLIDAYS.map((holiday, idx) => {
                  const holDate = new Date(holiday.date);
                  const todayZero = new Date(todayDate);
                  todayZero.setHours(0, 0, 0, 0);
                  const holZero = new Date(holDate);
                  holZero.setHours(0, 0, 0, 0);

                  const isPast = holZero < todayZero;

                  return (
                    <div key={idx} onClick={() => setCurrentCalendarDate(new Date(holiday.date))} className={`cursor-pointer flex items-center justify-between p-4 rounded-xl shadow-sm border tracking-wide ${isPast ? (isDark ? 'bg-gray-800/80 border-gray-700 opacity-60' : 'bg-gray-100 border-gray-200 opacity-70') : (isDark ? 'bg-gray-800 border-gray-700 bg-gradient-to-br from-gray-800 to-emerald-900/20' : 'bg-white border-emerald-100 bg-gradient-to-br from-white to-emerald-50')} transition-all hover:scale-[1.01] duration-300`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold ${isPast ? 'bg-gray-300 text-gray-500' : 'bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-md'}`}>
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
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-md">Upcoming</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Current Month Calendar */}
              <div className={`w-full xl:w-2/5 xl:sticky xl:top-6 rounded-3xl p-6 shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
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
                      dayClass += `bg-blue-500 text-white shadow-blue-500/30 ring-2 ring-blue-300 ring-offset-2 dark:ring-offset-gray-800 scale-110 z-10`;
                    } else if (isHoliday) {
                      dayClass += `bg-emerald-500 text-white shadow-emerald-500/30 scale-105`;
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
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></span>
                    <span className={isDark ? "text-gray-300" : "text-gray-700"}>Public Holiday</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></span>
                    <span className={isDark ? "text-gray-300" : "text-gray-700"}>Today</span>
                  </div>
                </div>
              </div>
            </div>

          </motion.div>
        );
      }

      case "profile":
        return <ProfilePage auth={{ currentUser: user }} />;
      case "messages":
        return <MessagingDashboard user={user} role="employee" isDark={isDark} />;
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

      {/* Message Notification Toast */}
      <AnimatePresence>
        {msgToast && (
          <motion.div
            initial={{ opacity: 0, y: -80, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -80, scale: 0.9 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed top-5 right-5 z-[200] flex items-start gap-4 bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700 text-gray-800 dark:text-white px-5 py-4 rounded-2xl shadow-2xl max-w-xs cursor-pointer"
            onClick={() => { setCurrentSection("messages"); setMsgToast(null); clearNotification(); }}
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-md">
              <i className="fas fa-comments text-lg"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">New Message from Admin</p>
              <p className="text-sm font-medium truncate">{msgToast}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setMsgToast(null); clearNotification(); }} className="text-gray-400 hover:text-red-500 transition-colors shrink-0">
              <i className="fas fa-times text-sm"></i>
            </button>
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
          className={`fixed top-4 left-4 z-[60] lg:hidden p-3 rounded-xl shadow-lg ${isDark ? "bg-gray-800 text-white" : "bg-white text-gray-800"}`}
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
          className={`fixed left-0 top-0 h-full w-full lg:w-64 shadow-2xl p-4 flex flex-col z-50 border-r overflow-y-auto transition-transform duration-300 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${isDark
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

          <nav className="flex-1 space-y-2 px-2 overflow-y-auto">
            <button
              onClick={() => {
                setCurrentSection("workLog");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex justify-between items-center ${currentSection === "workLog"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-50 text-gray-700"
                }`}
            >
              <span><i className="fas fa-clock w-5"></i> Log Work</span>
            </button>
            <button
              onClick={() => {
                setCurrentSection("myReports");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex justify-between items-center ${currentSection === "myReports"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-50 text-gray-700"
                }`}
            >
              <span><i className="fas fa-file-alt w-5"></i> My Reports</span>
            </button>
            <button
              onClick={() => {
                setCurrentSection("leave");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex justify-between items-center ${currentSection === "leave"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-50 text-gray-700"
                }`}
            >
              <span><i className="fas fa-calendar-minus w-5"></i> Leave Requests</span>
            </button>
            <button
              onClick={() => {
                setCurrentSection("holidays");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex justify-between items-center ${currentSection === "holidays"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-50 text-gray-700"
                }`}
            >
              <span><i className="fas fa-umbrella-beach w-5"></i> Public Holidays</span>
            </button>

            <button
              onClick={() => {
                setCurrentSection("messages");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center justify-between ${currentSection === "messages"
                ? "bg-violet-500 text-white"
                : "hover:bg-violet-50 text-gray-700"
                }`}
            >
              <span><i className="fas fa-comments w-5"></i> Messages</span>
              {unreadCount > 0 && currentSection !== "messages" && (
                <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setCurrentSection("profile");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all ${currentSection === "profile"
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
            className="w-full text-left px-4 py-3.5 rounded-xl transition-all mt-4 hover:bg-red-50 text-gray-700 hover:text-red-600"
          >
            <i className="fas fa-sign-out-alt w-5"></i> Logout
          </button>
        </motion.div>

        <div
          className={`flex-1 overflow-y-auto p-4 pt-20 sm:p-8 sm:pt-24 lg:p-8 relative w-full transition-all duration-300 lg:ml-64`}
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
