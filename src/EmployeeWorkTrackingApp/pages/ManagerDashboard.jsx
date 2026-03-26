import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  WORK_TYPES,
  LATE_THRESHOLD_HOUR,
  LATE_THRESHOLD_MINUTE,
} from "../constants/config";
import { useDepartments } from "../hooks/useDepartments";
import { useTheme } from "../context/ThemeContext";
import ProfileModal from "../components/ProfileModal";
import ProfilePage from "./ProfilePage";
import { useOutletContext } from "react-router-dom";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

export default function ManagerDashboard() {
  const { auth, onLogout } = useOutletContext();
  const { isDark, toggleTheme } = useTheme();
  const { departmentsMap } = useDepartments();

  const [currentSection, setCurrentSection] = useState("pending");
  const [showProfile, setShowProfile] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeProfile, setShowEmployeeProfile] = useState(false);
  const [reportFilter, setReportFilter] = useState("daily");
  const [reportRoleFilter, setReportRoleFilter] = useState("employee");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toast, setToast] = useState(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false
  );
  const [isFullScreenImage, setIsFullScreenImage] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(true);
  const menuTimeoutRef = useRef(null);

  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [publicHolidays, setPublicHolidays] = useState([]);

  const [allUsers, setAllUsers] = useState([]);
  const [allWorkLogs, setAllWorkLogs] = useState([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const fetchDashboardData = async () => {
    setLoadingData(true);
    try {
      const uId = auth?.currentUser?.uid || auth?.currentUser?.id;
      if (uId) {
        const userSnap = await getDoc(doc(db, "users", uId));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const todayStr = new Date().toISOString().split("T")[0];
          if (
            userData.lastClockInDate === todayStr &&
            userData.lastClockOutDate !== todayStr
          ) {
            setClockedIn(true);
          }
        }
      }

      const usersSnap = await getDocs(collection(db, "users"));
      setAllUsers(usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

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
      showToastMessage("Failed to load some database records.", "error");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      if (clientX < 100 && clientY < 100) {
        if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
        menuTimeoutRef.current = setTimeout(() => setIsMenuVisible(true), 1000);
      } else {
        if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
        menuTimeoutRef.current = setTimeout(
          () => setIsMenuVisible(false),
          2000
        );
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const startHideTimer = () => {
      if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
      menuTimeoutRef.current = setTimeout(() => setIsMenuVisible(false), 2000);
    };
    startHideTimer();
    return () => {
      if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    };
  }, [isSidebarOpen]);

  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState(null);
  const [workType, setWorkType] = useState(null);
  const [attendanceFilter, setAttendanceFilter] = useState(null);
  const [leaveFilter, setLeaveFilter] = useState("pending");
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveType, setLeaveType] = useState("sick");
  const [myLeaveFilter, setMyLeaveFilter] = useState("all");

  const LEAVE_BALANCE = {
    sick: { total: 6, name: "Sick Leave", icon: "fa-user-nurse" },
    casual: { total: 10, name: "Casual Leave", icon: "fa-umbrella-beach" },
  };

  const [taskStartTime, setTaskStartTime] = useState("");
  const [taskEndTime, setTaskEndTime] = useState("");
  const [calculatedDuration, setCalculatedDuration] = useState("");

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

  const user = auth?.currentUser || {};
  const userName = user?.firstName
    ? `${user.firstName} ${user.lastName}`
    : "Manager";
  const userInitial = user?.firstName
    ? user.firstName.charAt(0).toUpperCase()
    : "M";
  const dept = user?.department;
  const currentUserId = user?.uid || user?.id;



  const deptEmployees = allUsers.filter(
    (emp) =>
      emp.department === dept &&
      emp.status === "approved" &&
      emp.id !== currentUserId &&
      emp.role !== "admin"
  );
  const deptPending = allUsers.filter(
    (emp) =>
      emp.department === dept &&
      emp.status === "pending" &&
      emp.role !== "admin"
  );

  const today = new Date().toISOString().split("T")[0];
  const todayLogs = allWorkLogs.filter(
    (log) => log.department === dept && log.date === today
  );
  const presentIds = [
    ...new Set([
      ...todayLogs.map((log) => log.employeeId),
      ...deptEmployees
        .filter((u) => u.lastClockInDate === today)
        .map((u) => u.id),
    ]),
  ]
    .filter((id) => {
      const emp = deptEmployees.find((u) => u.id === id);
      return !(emp && emp.lastClockOutDate === today);
    })
    .filter((id) => id !== currentUserId);

  const myWorkLogs = allWorkLogs.filter(
    (log) => log.employeeId === currentUserId && log.date === today
  );

  const filteredTeamLogs = allWorkLogs
    .filter((log) => {
      if (log.department !== dept) return false;

      const todayObj = new Date();
      const logDateObj = new Date(log.date);

      if (reportFilter === "daily") {
        return log.date === today;
      } else if (reportFilter === "weekly") {
        const diffTime = Math.abs(todayObj - logDateObj);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      } else if (reportFilter === "monthly") {
        return (
          logDateObj.getMonth() === todayObj.getMonth() &&
          logDateObj.getFullYear() === todayObj.getFullYear()
        );
      }
      return true;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const deptLeaveRequests = allLeaveRequests.filter(
    (req) => req.department === dept && req.employeeId !== currentUserId
  );
  const pendingLeaveRequests = deptLeaveRequests.filter(
    (req) => req.status === "pending"
  );
  const approvedLeaveRequests = deptLeaveRequests.filter(
    (req) => req.status === "approved"
  );
  const employeesOnLeave = allLeaveRequests.filter(
    (req) =>
      req.status === "approved" &&
      req.department === dept &&
      req.startDate <= today &&
      req.endDate >= today
  );

  const myLeaveRequests = allLeaveRequests.filter(
    (req) => req.employeeId === currentUserId
  );
  const myPendingLeaveRequests = myLeaveRequests.filter(
    (req) => req.status === "pending"
  );

  const getUsedLeaves = (type) =>
    myLeaveRequests.filter(
      (req) => req.leaveType === type && req.status === "approved"
    ).length;

  const handleApproveUser = async (employeeId) => {
    try {
      await updateDoc(doc(db, "users", employeeId), { status: "approved" });
      showToastMessage("Employee approved successfully!", "success");
      fetchDashboardData();
    } catch (err) {
      showToastMessage("Failed to approve.", "error");
    }
  };

  const handleRejectUser = async (employeeId) => {
    if (window.confirm("Are you sure you want to reject this registration?")) {
      try {
        await deleteDoc(doc(db, "users", employeeId));
        showToastMessage("Registration rejected.", "success");
        fetchDashboardData();
      } catch (err) {
        showToastMessage("Failed to reject.", "error");
      }
    }
  };

  const handleDeleteEmployee = async (employeeId, employeeName) => {
    if (
      window.confirm(
        `Are you sure you want to remove ${employeeName}? This action cannot be undone.`
      )
    ) {
      try {
        await deleteDoc(doc(db, "users", employeeId));
        showToastMessage(`${employeeName} removed successfully.`, "success");
        fetchDashboardData();
      } catch (err) {
        showToastMessage("Failed to remove employee.", "error");
      }
    }
  };

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
        employeeName: userName,
        department: dept,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason,
        leaveType: leaveType,
        status: "pending",
        isManager: true,
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

  const handleApproveLeave = async (requestId) => {
    try {
      await updateDoc(doc(db, "leaveRequests", requestId), {
        status: "approved",
      });
      showToastMessage("Leave request approved!", "success");
      fetchDashboardData();
    } catch (err) {
      showToastMessage("Error approving leave.", "error");
    }
  };

  const handleRejectLeave = async (requestId) => {
    try {
      await updateDoc(doc(db, "leaveRequests", requestId), {
        status: "rejected",
      });
      showToastMessage("Leave request rejected!", "success");
      fetchDashboardData();
    } catch (err) {
      showToastMessage("Error rejecting leave.", "error");
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
        employeeName: userName,
        department: dept,
        workType: workType,
        description: e.target.description.value,
        hours: totalHours,
        minutes: hours * 60 + mins,
        taskStartTime,
        taskEndTime,
        duration: calculatedDuration,
        date: today,
        clockInTime: clockInTime ? clockInTime.toISOString() : null,
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

  const getAttendanceFilteredList = () => {
    if (!attendanceFilter) return [];
    if (attendanceFilter === "present")
      return deptEmployees.filter((emp) => presentIds.includes(emp.id));
    if (attendanceFilter === "absent")
      return deptEmployees.filter((emp) => !presentIds.includes(emp.id));
    if (attendanceFilter === "onLeave") return employeesOnLeave;
    return deptEmployees;
  };

  const handleClockIn = async () => {
    setClockedIn(true);
    setClockInTime(new Date());
    try {
      const todayDate = new Date().toISOString().split("T")[0];
      await updateDoc(doc(db, "users", currentUserId), {
        lastClockInDate: todayDate,
        lastClockInTime: new Date().toISOString(),
        lastClockOutDate: null,
        lastClockOutTime: null,
      });
      showToastMessage("Clocked in successfully!", "success");
    } catch (err) {
      console.error(err);
      showToastMessage("Failed to clock in to database.", "error");
    }
  };

  const handleClockOut = async () => {
    setClockedIn(false);
    setClockInTime(null);
    setTaskStartTime("");
    setTaskEndTime("");
    setCalculatedDuration("");
    try {
      const todayDate = new Date().toISOString().split("T")[0];
      await updateDoc(doc(db, "users", currentUserId), {
        lastClockOutDate: todayDate,
        lastClockOutTime: new Date().toISOString(),
      });
      showToastMessage("Clocked out successfully!", "success");
    } catch (err) {
      console.error(err);
      showToastMessage("Failed to clock out to database.", "error");
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
  const getEmployeeWorkLogs = (employeeId) =>
    allWorkLogs.filter((log) => log.employeeId === employeeId);
  const viewEmployeeProfile = (employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeProfile(true);
  };

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 w-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    switch (currentSection) {
      case "pending":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <motion.div
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gradient-to-r from-gray-800 to-gray-700 border-gray-600"
                : "bg-gradient-to-r from-violet-50 via-purple-50 to-pink-50 border-purple-100"
                }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1
                    className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"
                      }`}
                  >
                    Welcome, {userName}! 👋
                  </h1>
                  <p
                    className={
                      isDark ? "text-gray-400 mt-1" : "text-gray-500 mt-1"
                    }
                  >
                    {formatDate(currentTime)}
                  </p>
                </div>
                <motion.div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl px-6 py-3 shadow-lg">
                  <p className="text-white text-2xl font-mono font-bold">
                    {formatTime(currentTime)}
                  </p>
                </motion.div>
              </div>
            </motion.div>

            <motion.div
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <h2
                className={`text-xl font-bold mb-4 flex items-center ${isDark ? "text-violet-400" : "text-purple-600"
                  }`}
              >
                <i className="fas fa-user-plus mr-2"></i>Pending Employee
                Approvals ({deptPending.length})
              </h2>
              {deptPending.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-check-circle text-4xl text-white"></i>
                  </div>
                  <p
                    className={
                      isDark ? "text-gray-400 text-lg" : "text-gray-500 text-lg"
                    }
                  >
                    No pending approvals
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deptPending.map((emp) => (
                    <motion.div
                      key={emp.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border gap-4 ${isDark
                        ? "bg-gray-700 border-gray-600"
                        : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                          {emp.firstName?.[0]}
                          {emp.lastName?.[0]}
                        </div>
                        <div>
                          <p
                            className={`font-bold ${isDark ? "text-white" : "text-gray-800"
                              }`}
                          >
                            {emp.firstName} {emp.lastName}
                          </p>
                          <p
                            className={
                              isDark
                                ? "text-gray-400 text-sm"
                                : "text-gray-500 text-sm"
                            }
                          >
                            {emp.email}
                          </p>
                          <p
                            className={
                              isDark
                                ? "text-gray-400 text-sm"
                                : "text-gray-500 text-sm"
                            }
                          >
                            {emp.phone}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 w-full sm:w-auto">
                        <button
                          onClick={() => handleApproveUser(emp.id)}
                          className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl shadow-lg"
                        >
                          <i className="fas fa-check mr-2"></i>Approve
                        </button>
                        <button
                          onClick={() => handleRejectUser(emp.id)}
                          className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl shadow-lg"
                        >
                          <i className="fas fa-times mr-2"></i>Reject
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        );

      case "myLeave":
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
              My Leave
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(LEAVE_BALANCE).map(([type, data]) => {
                const used = getUsedLeaves(type);
                const remaining = data.total - used;
                return (
                  <motion.div
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
                  </motion.div>
                );
              })}
            </div>

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
                <i className="fas fa-calendar-plus mr-2"></i>Submit Leave
                Request
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
                  className="w-full bg-gradient-to-r from-violet-500 to-purple-600 text-white py-4 rounded-xl font-bold"
                >
                  <i className="fas fa-paper-plane mr-2"></i>Submit Request
                </button>
              </form>
            </motion.div>

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
                <i className="fas fa-history mr-2"></i>Leave History
              </h2>
              <div className="flex flex-wrap gap-3 mb-4">
                <button
                  onClick={() => setMyLeaveFilter("all")}
                  className={`px-4 py-2 rounded-xl ${myLeaveFilter === "all"
                    ? "bg-violet-500 text-white"
                    : isDark
                      ? "bg-gray-700 text-gray-200"
                      : "bg-gray-200 text-gray-700"
                    }`}
                >
                  All ({myLeaveRequests.length})
                </button>
                <button
                  onClick={() => setMyLeaveFilter("pending")}
                  className={`px-4 py-2 rounded-xl ${myLeaveFilter === "pending"
                    ? "bg-amber-500 text-white"
                    : isDark
                      ? "bg-gray-700 text-gray-200"
                      : "bg-gray-200 text-gray-700"
                    }`}
                >
                  Pending ({myPendingLeaveRequests.length})
                </button>
                <button
                  onClick={() => setMyLeaveFilter("approved")}
                  className={`px-4 py-2 rounded-xl ${myLeaveFilter === "approved"
                    ? "bg-emerald-500 text-white"
                    : isDark
                      ? "bg-gray-700 text-gray-200"
                      : "bg-gray-200 text-gray-700"
                    }`}
                >
                  Approved (
                  {
                    myLeaveRequests.filter((r) => r.status === "approved")
                      .length
                  }
                  )
                </button>
              </div>
              <div className="space-y-3">
                {(myLeaveFilter === "all"
                  ? myLeaveRequests
                  : myLeaveFilter === "pending"
                    ? myPendingLeaveRequests
                    : myLeaveRequests.filter((r) => r.status === "approved")
                ).map((req) => (
                  <div
                    key={req.id}
                    className={`flex flex-col justify-between p-4 rounded-xl gap-2 ${isDark ? "bg-gray-700" : "bg-gray-50"
                      }`}
                  >
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
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
              Leave Requests - {departmentsMap[dept]?.name}
            </h1>

            {/* FULLY RESTORED LEAVE FILTERS */}
            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={() => setLeaveFilter("pending")}
                className={`px-6 py-2.5 rounded-xl font-bold ${leaveFilter === "pending"
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white"
                  : isDark
                    ? "bg-gray-700 text-gray-200"
                    : "bg-gray-200 text-gray-700"
                  }`}
              >
                <i className="fas fa-clock mr-2"></i>Pending (
                {pendingLeaveRequests.length})
              </button>
              <button
                onClick={() => setLeaveFilter("approved")}
                className={`px-6 py-2.5 rounded-xl font-bold ${leaveFilter === "approved"
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white"
                  : isDark
                    ? "bg-gray-700 text-gray-200"
                    : "bg-gray-200 text-gray-700"
                  }`}
              >
                <i className="fas fa-check-circle mr-2"></i>Approved (
                {approvedLeaveRequests.length})
              </button>
              <button
                onClick={() => setLeaveFilter("all")}
                className={`px-6 py-2.5 rounded-xl font-bold ${leaveFilter === "all"
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white"
                  : isDark
                    ? "bg-gray-700 text-gray-200"
                    : "bg-gray-200 text-gray-700"
                  }`}
              >
                <i className="fas fa-list mr-2"></i>All (
                {deptLeaveRequests.length})
              </button>
            </div>

            <motion.div
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <div className="space-y-4">
                {(leaveFilter === "pending"
                  ? pendingLeaveRequests
                  : leaveFilter === "approved"
                    ? approvedLeaveRequests
                    : deptLeaveRequests
                ).map((req) => {
                  const emp = allUsers.find((e) => e.id === req.employeeId);
                  if (!emp) return null;
                  return (
                    <motion.div
                      key={req.id}
                      className={`p-4 rounded-xl border ${isDark
                        ? "bg-gray-700 border-gray-600"
                        : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                        }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                            {emp.firstName?.[0]}
                            {emp.lastName?.[0]}
                          </div>
                          <div>
                            <p
                              className={`font-bold ${isDark ? "text-white" : "text-gray-800"
                                }`}
                            >
                              {emp.firstName} {emp.lastName}
                            </p>
                            <p
                              className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"
                                }`}
                            >
                              {emp.email}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${req.status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : req.status === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                            }`}
                        >
                          {req.status.charAt(0).toUpperCase() +
                            req.status.slice(1)}
                        </span>
                      </div>
                      <div
                        className={`p-3 rounded-lg mb-3 ${isDark ? "bg-gray-600" : "bg-white"
                          }`}
                      >
                        <p
                          className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"
                            }`}
                        >
                          <strong>Reason:</strong> {req.reason}
                        </p>
                        <p
                          className={`text-sm mt-2 ${isDark ? "text-gray-300" : "text-gray-600"
                            }`}
                        >
                          <strong>Dates:</strong> {req.startDate} to{" "}
                          {req.endDate}
                        </p>
                      </div>
                      {req.status === "pending" && (
                        <div className="flex gap-2 w-full mt-2 sm:mt-0">
                          <button
                            onClick={() => handleApproveLeave(req.id)}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-lg font-medium"
                          >
                            <i className="fas fa-check mr-2"></i>Approve
                          </button>
                          <button
                            onClick={() => handleRejectLeave(req.id)}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-lg font-medium"
                          >
                            <i className="fas fa-times mr-2"></i>Reject
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        );

      case "myWork":
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
              Log Your Work
            </h1>

            <motion.div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-6 shadow-lg text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-violet-100 text-sm">Current Status</p>
                  <p className="text-2xl font-bold">
                    {clockedIn ? "🟢 Clocked In" : "🔴 Not Clocked In"}
                  </p>
                  <p className="text-violet-100">{formatTime(currentTime)}</p>
                </div>
                {!clockedIn ? (
                  <button
                    onClick={handleClockIn}
                    className="px-6 py-3 bg-white text-purple-600 rounded-lg font-bold hover:bg-purple-50 shadow-lg transition-all"
                  >
                    <i className="fas fa-sign-in-alt mr-2"></i> Clock In
                  </button>
                ) : (
                  <button
                    onClick={handleClockOut}
                    className="px-6 py-3 bg-white text-rose-500 rounded-lg font-bold hover:bg-rose-50 shadow-lg transition-all"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i> Clock Out
                  </button>
                )}
              </div>
            </motion.div>

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
                    ? "border-violet-500 bg-violet-50/50 shadow-sm"
                    : isDark
                      ? "border-gray-700 hover:border-gray-600 bg-gray-800"
                      : "border-gray-100 hover:border-violet-100 hover:shadow-sm bg-white"
                    }`}
                >
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${workType === "office"
                      ? "bg-violet-600 shadow-md"
                      : "bg-violet-500"
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
              className={`rounded-2xl p-6 sm:p-8 shadow-sm border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <h2
                className={`text-xl font-bold mb-6 ${isDark ? "text-white" : "text-gray-800"
                  }`}
              >
                Add Work Entry
              </h2>

              <form onSubmit={handleWorkLog} className="space-y-6">
                {/* Description Field */}
                <div>
                  <label
                    className={`block text-sm font-bold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                  >
                    Work Description
                  </label>
                  <textarea
                    name="description"
                    rows="3"
                    required
                    className={`w-full px-4 py-3 border-2 rounded-xl outline-none transition-all resize-none ${isDark
                      ? "bg-gray-700/50 border-gray-600 focus:border-violet-500 text-white"
                      : "bg-gray-50 border-gray-200 focus:border-violet-500 focus:bg-white text-gray-800"
                      }`}
                    placeholder="Briefly describe the tasks you completed..."
                  ></textarea>
                </div>

                {/* Time Tracking Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Start Time */}
                  <div>
                    <label
                      className={`block text-sm font-bold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
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
                        className={`flex-1 px-4 py-3 border-2 rounded-xl outline-none transition-all ${isDark
                          ? "bg-gray-700/50 border-gray-600 focus:border-violet-500 text-white"
                          : "bg-gray-50 border-gray-200 focus:border-violet-500 focus:bg-white text-gray-800"
                          }`}
                      />
                      <button
                        type="button"
                        onClick={setCurrentAsStartTime}
                        title="Set to current time"
                        className={`px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center ${isDark
                          ? "bg-gray-700 text-violet-400 hover:bg-gray-600"
                          : "bg-violet-50 text-violet-600 hover:bg-violet-100"
                          }`}
                      >
                        <i className="fas fa-clock text-lg"></i>
                      </button>
                    </div>
                  </div>

                  {/* End Time */}
                  <div>
                    <label
                      className={`block text-sm font-bold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
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
                        className={`flex-1 px-4 py-3 border-2 rounded-xl outline-none transition-all ${isDark
                          ? "bg-gray-700/50 border-gray-600 focus:border-violet-500 text-white"
                          : "bg-gray-50 border-gray-200 focus:border-violet-500 focus:bg-white text-gray-800"
                          }`}
                      />
                      <button
                        type="button"
                        onClick={setCurrentAsEndTime}
                        title="Set to current time"
                        className={`px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center ${isDark
                          ? "bg-gray-700 text-violet-400 hover:bg-gray-600"
                          : "bg-violet-50 text-violet-600 hover:bg-violet-100"
                          }`}
                      >
                        <i className="fas fa-clock text-lg"></i>
                      </button>
                    </div>
                  </div>

                  {/* Calculated Duration */}
                  <div>
                    <label
                      className={`block text-sm font-bold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                    >
                      Time Taken
                    </label>
                    <div
                      className={`w-full h-[52px] border-2 rounded-xl font-mono text-lg font-bold flex items-center justify-center transition-all ${calculatedDuration
                        ? "bg-violet-50 border-violet-200 text-violet-700"
                        : isDark
                          ? "bg-gray-700/50 border-gray-600 text-gray-400"
                          : "bg-gray-50 border-gray-200 text-gray-400"
                        }`}
                    >
                      {calculatedDuration || "00:00:00"}
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg mt-2"
                >
                  Save Work Entry
                </button>
              </form>
            </motion.div>
          </motion.div>
        );

      case "team":
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
              My Team - {departmentsMap?.[dept]?.name}
            </h1>
            <div
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <h2
                className={`text-xl font-bold mb-4 flex items-center ${isDark ? "text-white" : "text-gray-800"
                  }`}
              >
                <i className="fas fa-users mr-2"></i>Team Members List (
                {deptEmployees.length})
              </h2>
              <div className="space-y-3">
                {deptEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className={`flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-xl border gap-4 ${isDark
                      ? "bg-gray-700 border-gray-600"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {emp.firstName?.[0]}
                        {emp.lastName?.[0]}
                      </div>
                      <div>
                        <p
                          className={`font-bold ${isDark ? "text-white" : "text-gray-800"
                            }`}
                        >
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p
                          className={
                            isDark
                              ? "text-gray-400 text-sm"
                              : "text-gray-500 text-sm"
                          }
                        >
                          {emp.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                      <button
                        onClick={() =>
                          handleDeleteEmployee(
                            emp.id,
                            `${emp.firstName} ${emp.lastName}`
                          )
                        }
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-lg text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        );

      case "attendance":
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
              Team Attendance
            </h1>

            {/* FULLY RESTORED ATTENDANCE CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <motion.div
                onClick={() =>
                  setAttendanceFilter(
                    attendanceFilter === "present" ? null : "present"
                  )
                }
                className={`bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer ${attendanceFilter === "present" ? "ring-4 ring-white" : ""
                  }`}
              >
                <p className="text-3xl font-bold">{presentIds.length}</p>
                <p className="text-white/80">Present</p>
              </motion.div>
              <motion.div
                onClick={() =>
                  setAttendanceFilter(
                    attendanceFilter === "absent" ? null : "absent"
                  )
                }
                className={`bg-gradient-to-br from-rose-400 to-red-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer ${attendanceFilter === "absent" ? "ring-4 ring-white" : ""
                  }`}
              >
                <p className="text-3xl font-bold">
                  {deptEmployees.length - presentIds.length}
                </p>
                <p className="text-white/80">Absent</p>
              </motion.div>
              <motion.div
                onClick={() =>
                  setAttendanceFilter(
                    attendanceFilter === "onLeave" ? null : "onLeave"
                  )
                }
                className={`bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white shadow-lg cursor-pointer ${attendanceFilter === "onLeave" ? "ring-4 ring-white" : ""
                  }`}
              >
                <p className="text-3xl font-bold">{employeesOnLeave.length}</p>
                <p className="text-white/80">On Leave</p>
              </motion.div>
              <motion.div className="bg-gradient-to-br from-violet-400 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                <p className="text-3xl font-bold">
                  {Math.round(
                    (presentIds.length / deptEmployees.length) * 100
                  ) || 0}
                  %
                </p>
                <p className="text-white/80">Attendance</p>
              </motion.div>
            </div>

            <motion.div
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <div className="space-y-3">
                {getAttendanceFilteredList().map((item) => {
                  const emp = item.employeeId
                    ? allUsers.find((e) => e.id === item.employeeId)
                    : item;
                  if (!emp) return null;
                  return (
                    <div
                      key={emp.id}
                      className={`flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-xl border gap-4 ${isDark
                        ? "bg-gray-700 border-gray-600"
                        : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-violet-500 to-purple-500">
                          {emp.firstName?.[0]}
                          {emp.lastName?.[0]}
                        </div>
                        <div>
                          <p
                            className={`font-bold ${isDark ? "text-white" : "text-gray-800"
                              }`}
                          >
                            {emp.firstName} {emp.lastName}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${attendanceFilter === "onLeave"
                          ? "bg-amber-100 text-amber-700"
                          : presentIds.includes(emp.id)
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                          }`}
                      >
                        {attendanceFilter === "onLeave"
                          ? "✓ On Leave"
                          : presentIds.includes(emp.id)
                            ? "✓ Present"
                            : "✗ Absent"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        );

      // FULLY RESTORED REPORTS SECTION
      case "reports":
        const finalReports = filteredTeamLogs.filter((log) => {
          const logUser = allUsers.find((u) => u.id === log.employeeId);
          if (!logUser) return false;
          if (reportRoleFilter === "employee") {
            return (
              logUser.role !== "manager" &&
              logUser.role !== "dept_manager" &&
              logUser.role !== "admin"
            );
          } else {
            return (
              logUser.role === "manager" || logUser.role === "dept_manager"
            );
          }
        });

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
                Reports
              </h1>
              <div
                className={`p-1 flex flex-wrap gap-1 sm:gap-0 rounded-xl border ${isDark
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
                  }`}
              >
                <button
                  onClick={() => setReportFilter("daily")}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${reportFilter === "daily"
                    ? "bg-violet-600 text-white"
                    : isDark
                      ? "text-gray-400 hover:text-white hover:bg-gray-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setReportFilter("weekly")}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${reportFilter === "weekly"
                    ? "bg-violet-600 text-white"
                    : isDark
                      ? "text-gray-400 hover:text-white hover:bg-gray-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setReportFilter("monthly")}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${reportFilter === "monthly"
                    ? "bg-violet-600 text-white"
                    : isDark
                      ? "text-gray-400 hover:text-white hover:bg-gray-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                >
                  Monthly
                </button>
              </div>
            </div>
            <motion.div
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <div className="flex flex-wrap gap-4 sm:gap-6 border-b mb-6 border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setReportRoleFilter("employee")}
                  className={`pb-3 text-lg font-bold border-b-2 transition-all ${reportRoleFilter === "employee"
                    ? "border-violet-500 text-violet-500"
                    : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    }`}
                >
                  Employee Reports
                </button>
                <button
                  onClick={() => setReportRoleFilter("manager")}
                  className={`pb-3 text-lg font-bold border-b-2 transition-all ${reportRoleFilter === "manager"
                    ? "border-violet-500 text-violet-500"
                    : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    }`}
                >
                  Manager Reports
                </button>
              </div>

              <h2
                className={`text-xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"
                  }`}
              >
                {reportFilter === "daily"
                  ? "Today's Work Report"
                  : reportFilter === "weekly"
                    ? "Last 7 Days Work Report"
                    : "This Month's Work Report"}
              </h2>
              {finalReports.length === 0 ? (
                <p
                  className={`text-center py-8 ${isDark ? "text-gray-400" : "text-gray-500"
                    }`}
                >
                  No work entries found for this period.
                </p>
              ) : (
                <div className="space-y-4">
                  {finalReports.map((log) => (
                    <div
                      key={log.id}
                      className={`flex flex-col justify-between p-4 rounded-xl border gap-2 ${isDark
                        ? "bg-gray-700 border-gray-600"
                        : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                        }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <span
                          className={`font-bold ${isDark ? "text-white" : "text-gray-800"
                            }`}
                        >
                          {log.employeeName}{" "}
                          <span className="text-sm font-normal text-gray-400 ml-2">
                            ({log.date})
                          </span>
                        </span>
                        <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">
                          {log.duration}
                        </span>
                      </div>
                      <p
                        className={`text-sm mb-2 ${isDark ? "text-gray-400" : "text-gray-500"
                          }`}
                      >
                        <i
                          className={`fas ${log.workType === "office"
                            ? "fa-briefcase"
                            : "fa-laptop"
                            } mr-1`}
                        ></i>
                        {WORK_TYPES?.[log.workType]?.name ||
                          (log.workType === "office"
                            ? "Office Work"
                            : "Non-Office Work")}{" "}
                        | <i className="fas fa-clock mx-1"></i>{" "}
                        {log.taskStartTime} - {log.taskEndTime}
                      </p>
                      <p className={isDark ? "text-gray-300" : "text-gray-600"}>
                        {log.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
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
              <h1 className={`text-3xl font-bold ${isDark ? "text-white" : "from-violet-400 to-purple-600"}`}>
                <i className="fas fa-umbrella-beach mr-3 text-violet-500"></i>
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
                        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold ${isPast ? 'bg-gray-300 text-gray-500' : 'bg-gradient-to-br from-violet-400 to-purple-600 text-white shadow-md'}`}>
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
                          <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400 px-2.5 py-1 bg-violet-50 dark:bg-violet-900/30 rounded-md">Upcoming</span>
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
                      dayClass += `bg-emerald-500 text-white shadow-emerald-500/30 ring-2 ring-emerald-300 ring-offset-2 dark:ring-offset-gray-800 scale-110 z-10`;
                    } else if (isHoliday) {
                      dayClass += `bg-violet-500 text-white shadow-violet-500/30 scale-105`;
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
                    <span className="w-3 h-3 rounded-full bg-violet-500 shadow-sm"></span>
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
            className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[100] ${toast.type === "success" ? "bg-green-600" : "bg-red-600"
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
          className={`fixed top-4 left-4 z-[60] lg:hidden p-3 rounded-xl shadow-lg ${isDark ? "bg-gray-800 text-white" : "bg-white text-gray-800"}`}
        >
          <i className="fas fa-bars text-xl"></i>
        </motion.button>
      )}

      <div
        className={`flex min-h-screen relative ${isDark
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50"
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
            : "bg-gradient-to-b from-white to-violet-50 border-violet-100"
            }`}
        >
          <div className="text-center mb-8 pt-2">
            <div
              onClick={() => user?.profileImage && setIsFullScreenImage(true)}
              className={`w-24 h-24 ${user?.profileImage ? 'cursor-pointer hover:scale-105 transition-transform' : 'bg-gradient-to-br from-violet-400 via-purple-500 to-pink-500'} rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg border-4 border-white overflow-hidden`}
            >
              {user?.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-white">
                  {userInitial}
                </span>
              )}
            </div>
            <h2
              className={`font-bold text-xl ${isDark ? "text-white" : "text-gray-800"
                }`}
            >
              {userName}
            </h2>
            <p
              className={`text-sm font-medium ${isDark ? "text-violet-400" : "text-violet-600"
                }`}
            >
              {departmentsMap?.[dept]?.name}
            </p>
          </div>

          <nav className="flex-1 space-y-2 px-2 overflow-y-auto">
            <button
              onClick={() => {
                setCurrentSection("pending");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center justify-between ${currentSection === "pending"
                ? "bg-violet-500 text-white"
                : "hover:bg-violet-50 text-gray-700"
                }`}
            >
              <span>
                <i className="fas fa-user-plus w-5"></i> Pending
              </span>
            </button>
            <button
              onClick={() => {
                setCurrentSection("myLeave");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all ${currentSection === "myLeave"
                ? "bg-violet-500 text-white"
                : "hover:bg-violet-50 text-gray-700"
                }`}
            >
              <i className="fas fa-calendar-minus w-5"></i> My Leave
            </button>
            <button
              onClick={() => {
                setCurrentSection("leave");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all ${currentSection === "leave"
                ? "bg-violet-500 text-white"
                : "hover:bg-violet-50 text-gray-700"
                }`}
            >
              <i className="fas fa-calendar-check w-5"></i> Leave Requests
            </button>
            <button
              onClick={() => {
                setCurrentSection("myWork");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all ${currentSection === "myWork"
                ? "bg-violet-500 text-white"
                : "hover:bg-violet-50 text-gray-700"
                }`}
            >
              <i className="fas fa-clock w-5"></i> My Work
            </button>
            <button
              onClick={() => {
                setCurrentSection("team");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all ${currentSection === "team"
                ? "bg-violet-500 text-white"
                : "hover:bg-violet-50 text-gray-700"
                }`}
            >
              <i className="fas fa-users w-5"></i> My Team
            </button>
            <button
              onClick={() => {
                setCurrentSection("attendance");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all ${currentSection === "attendance"
                ? "bg-violet-500 text-white"
                : "hover:bg-violet-50 text-gray-700"
                }`}
            >
              <i className="fas fa-calendar-check w-5"></i> Attendance
            </button>
            <button
              onClick={() => {
                setCurrentSection("reports");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all ${currentSection === "reports"
                ? "bg-violet-500 text-white"
                : "hover:bg-violet-50 text-gray-700"
                }`}
            >
              <i className="fas fa-file-pdf w-5"></i> Reports
            </button>
            <button
              onClick={() => {
                setCurrentSection("holidays");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all ${currentSection === "holidays"
                ? "bg-violet-500 text-white"
                : "hover:bg-violet-50 text-gray-700"
                }`}
            >
              <i className="fas fa-umbrella-beach w-5"></i> Public Holidays
            </button>


            <button
              onClick={() => {
                setCurrentSection("profile");
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all ${currentSection === "profile"
                ? "bg-violet-500 text-white"
                : "hover:bg-violet-50 text-gray-700"
                }`}
            >
              <i className="fas fa-user-circle w-5"></i> My Profile
            </button>
          </nav>

          <button
            onClick={() => {
              auth.logout();
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

      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        user={user}
        role={user?.role}
      />
      <ProfileModal
        isOpen={showEmployeeProfile}
        onClose={() => {
          setShowEmployeeProfile(false);
          setSelectedEmployee(null);
        }}
        user={selectedEmployee}
        role={selectedEmployee?.role}
        isAdminView={true}
        workLogs={
          selectedEmployee ? getEmployeeWorkLogs(selectedEmployee.id) : []
        }
      />

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
