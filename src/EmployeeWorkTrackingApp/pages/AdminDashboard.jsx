import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DEPARTMENTS } from "../constants/config";
import { useTheme } from "../context/ThemeContext";
import AdminSidebar from "../components/AdminSidebar";
import ProfileModal, { ProfileCard } from "../components/ProfileModal";
import ProfilePage from "./ProfilePage";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useOutletContext } from "react-router-dom";

export default function AdminDashboard() {
  const { auth, onLogout } = useOutletContext();
  const { isDark } = useTheme();

  const [currentSection, setCurrentSection] = useState("dashboard");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null);
  const [toast, setToast] = useState(null);

  const [allUsers, setAllUsers] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [attendanceFilter, setAttendanceFilter] = useState(null);
  const [presentSubFilter, setPresentSubFilter] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [leaveFilter, setLeaveFilter] = useState("pending");
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false
  );

  const fetchDashboardData = async () => {
    setLoadingData(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      setAllUsers(usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      const logsSnap = await getDocs(collection(db, "workLogs"));
      setWorkLogs(logsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      const leaveSnap = await getDocs(collection(db, "leaveRequests"));
      setLeaveRequests(
        leaveSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      showToast("Failed to load some database records.", "error");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) =>
    date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  const formatDate = (date) =>
    date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const user = auth?.currentUser || {};
  const userName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Admin"
    : "Admin";

  const approvedEmployees = allUsers.filter(
    (emp) => emp.status === "approved" && emp.role !== "admin"
  );
  const pendingRegistrations = allUsers.filter(
    (emp) => emp.status === "pending"
  );

  const approvedManagers = approvedEmployees.filter(
    (emp) => emp.role === "dept_manager" || emp.role === "manager"
  );
  const regularEmployees = approvedEmployees.filter(
    (emp) => emp.role !== "dept_manager" && emp.role !== "manager"
  );

  const pendingManagers = pendingRegistrations.filter(
    (emp) => emp.role === "dept_manager" || emp.role === "manager"
  );
  const pendingEmployeesList = pendingRegistrations.filter(
    (emp) => emp.role !== "dept_manager" && emp.role !== "manager"
  );

  const today = new Date().toISOString().split("T")[0];
  const todayLogs = workLogs.filter((log) => log.date === today);
  const presentIds = [
    ...new Set([
      ...todayLogs.map((log) => log.employeeId),
      ...allUsers.filter((u) => u.lastClockInDate === today).map((u) => u.id),
    ]),
  ].filter((id) => {
    const emp = allUsers.find((u) => u.id === id);
    return !(emp && emp.lastClockOutDate === today);
  });

  const presentManagers = approvedManagers.filter((emp) =>
    presentIds.includes(emp.id)
  );
  const presentEmployeesList = regularEmployees.filter((emp) =>
    presentIds.includes(emp.id)
  );
  const absentManagers = approvedManagers.filter(
    (emp) => !presentIds.includes(emp.id)
  );
  const absentEmployeesList = regularEmployees.filter(
    (emp) => !presentIds.includes(emp.id)
  );

  // FIX: Properly mapping leave requests for full visibility
  const allLeaveRequests = leaveRequests;
  const pendingLeaveRequests = allLeaveRequests.filter(
    (req) => req.status === "pending"
  );
  const approvedLeaveRequests = allLeaveRequests.filter(
    (req) => req.status === "approved"
  );
  const employeesOnLeave = allLeaveRequests.filter(
    (req) =>
      req.status === "approved" &&
      req.startDate <= today &&
      req.endDate >= today
  );

  const getDepartmentCount = (deptKey) =>
    approvedEmployees.filter((emp) => emp.department === deptKey).length;
  const getDepartmentManager = (deptKey) =>
    approvedManagers.find((emp) => emp.department === deptKey);
  const getDepartmentEmployees = (deptKey) =>
    regularEmployees.filter((emp) => emp.department === deptKey);
  const getEmployeeWorkLogs = (employeeId) =>
    workLogs.filter((log) => log.employeeId === employeeId);

  const viewEmployeeProfile = (employee) => {
    setSelectedEmployee(employee);
    setShowProfileModal(true);
  };

  const toggleEmployeeExpand = (employeeId) => {
    setExpandedEmployeeId((prev) => (prev === employeeId ? null : employeeId));
  };

  const handleApproveUser = async (employeeId) => {
    try {
      await updateDoc(doc(db, "users", employeeId), { status: "approved" });
      showToast("Account approved successfully!", "success");
      fetchDashboardData();
    } catch (err) {
      showToast("Failed to approve.", "error");
    }
  };

  const handleRejectUser = async (employeeId) => {
    if (
      window.confirm(
        "Are you sure you want to reject and delete this registration?"
      )
    ) {
      try {
        await deleteDoc(doc(db, "users", employeeId));
        showToast("Registration rejected.", "success");
        fetchDashboardData();
      } catch (err) {
        showToast("Failed to reject.", "error");
      }
    }
  };

  const handleDeleteEmployee = async (employeeId, employeeName) => {
    if (
      window.confirm(
        `Are you sure you want to delete ${employeeName}? This action cannot be undone.`
      )
    ) {
      try {
        await deleteDoc(doc(db, "users", employeeId));
        showToast(`${employeeName} deleted.`, "success");
        fetchDashboardData();
      } catch (err) {
        showToast("Failed to delete.", "error");
      }
    }
  };

  const handleApproveLeave = async (requestId) => {
    try {
      await updateDoc(doc(db, "leaveRequests", requestId), {
        status: "approved",
      });
      showToast("Leave request approved!", "success");
      fetchDashboardData();
    } catch (err) {
      showToast("Error approving leave.", "error");
    }
  };

  const handleRejectLeave = async (requestId) => {
    try {
      await updateDoc(doc(db, "leaveRequests", requestId), {
        status: "rejected",
      });
      showToast("Leave request rejected!", "success");
      fetchDashboardData();
    } catch (err) {
      showToast("Error rejecting leave.", "error");
    }
  };

  const getFilteredList = () => {
    if (!attendanceFilter || attendanceFilter === "total") {
      if (presentSubFilter === "managers") return approvedManagers;
      if (presentSubFilter === "employees") return regularEmployees;
      return approvedEmployees;
    }
    if (attendanceFilter === "present") {
      if (presentSubFilter === "managers") return presentManagers;
      if (presentSubFilter === "employees") return presentEmployeesList;
      return [...presentManagers, ...presentEmployeesList];
    } else if (attendanceFilter === "absent") {
      if (presentSubFilter === "managers") return absentManagers;
      if (presentSubFilter === "employees") return absentEmployeesList;
      return [...absentManagers, ...absentEmployeesList];
    } else if (attendanceFilter === "onLeave") {
      if (presentSubFilter === "managers")
        return employeesOnLeave.filter((req) => req.isManager); // Wait, we might need to change this if isManager isn't accurate
      if (presentSubFilter === "employees")
        return employeesOnLeave.filter((req) => !req.isManager);
      return employeesOnLeave;
    }
    return [];
  };

  const stats = [
    {
      title: "Total Employees",
      value: approvedEmployees.length,
      icon: "fa-users",
      color: "from-cyan-400 to-blue-500",
    },
    {
      title: "Departments",
      value: Object.keys(DEPARTMENTS).length,
      icon: "fa-building",
      color: "from-emerald-400 to-green-500",
    },
    {
      title: "Present Today",
      value: presentIds.length,
      icon: "fa-user-check",
      color: "from-violet-400 to-purple-500",
    },
    {
      title: "Pending",
      value: pendingRegistrations.length,
      icon: "fa-user-clock",
      color: "from-amber-400 to-orange-500",
    },
  ];

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 w-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Database...</p>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    switch (currentSection) {
      case "dashboard":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gradient-to-r from-gray-800 to-gray-700 border-gray-600"
                : "bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 border-blue-100"
                }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1
                    className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"
                      }`}
                  >
                    Welcome back, {userName}! 👋
                  </h1>
                  <p
                    className={
                      isDark ? "text-gray-400 mt-1" : "text-gray-500 mt-1"
                    }
                  >
                    {formatDate(currentTime)}
                  </p>
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl px-6 py-3 shadow-lg"
                >
                  <p className="text-white text-2xl font-mono font-bold">
                    {formatTime(currentTime)}
                  </p>
                </motion.div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.03, y: -5 }}
                  className={`rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border ${isDark
                    ? "bg-gray-800 border-gray-700 hover:bg-gray-750"
                    : "bg-white border-gray-100"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className={
                          isDark
                            ? "text-gray-400 text-sm font-medium"
                            : "text-gray-500 text-sm font-medium"
                        }
                      >
                        {stat.title}
                      </p>
                      <p
                        className={`text-4xl font-bold mt-1 ${isDark ? "text-white" : "text-gray-800"
                          }`}
                      >
                        {stat.value}
                      </p>
                    </div>
                    <div
                      className={`w-14 mt-5 h-14 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center shadow-lg`}
                    >
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
                className="bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl p-6 text-white shadow-lg"
              >
                <h3 className="text-xl font-bold mb-2">Pending Approvals</h3>
                <p className="text-cyan-100 mb-4">
                  {pendingRegistrations.length} requests waiting
                </p>
                <button
                  onClick={() => setCurrentSection("pending")}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-all"
                >
                  View All <i className="fas fa-arrow-right ml-2"></i>
                </button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl p-6 text-white shadow-lg"
              >
                <h3 className="text-xl font-bold mb-2">Team Overview</h3>
                <p className="text-emerald-100 mb-4">
                  {approvedManagers.length} managers, {regularEmployees.length}{" "}
                  employees
                </p>
                <button
                  onClick={() => setCurrentSection("employees")}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-all"
                >
                  View All <i className="fas fa-arrow-right ml-2"></i>
                </button>
              </motion.div>
            </div>
          </motion.div>
        );

      case "pending":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <h1
              className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"
                }`}
            >
              Pending Approvals
            </h1>

            {pendingManagers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-6 shadow-lg border ${isDark
                  ? "bg-gray-800 border-gray-700"
                  : "bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100"
                  }`}
              >
                <h2 className="text-xl font-bold text-violet-400 mb-4 flex items-center">
                  <i className="fas fa-user-tie mr-2"></i>Pending Managers (
                  {pendingManagers.length})
                </h2>
                <div className="space-y-4">
                  {pendingManagers.map((emp, index) => (
                    <motion.div
                      key={emp.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-center justify-between p-4 rounded-xl shadow-md border ${isDark
                        ? "bg-gray-700 border-gray-600"
                        : "bg-white border-violet-100"
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
                          <p className="text-violet-400 text-sm font-medium">
                            {DEPARTMENTS[emp.department]?.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleApproveUser(emp.id)}
                          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl shadow-lg"
                        >
                          <i className="fas fa-check mr-2"></i>Approve
                        </button>
                        <button
                          onClick={() => handleRejectUser(emp.id)}
                          className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl shadow-lg"
                        >
                          <i className="fas fa-times mr-2"></i>Reject
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100"
                }`}
            >
              <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center">
                <i className="fas fa-user mr-2"></i>Pending Employees (
                {pendingEmployeesList.length})
              </h2>
              {pendingEmployeesList.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-check-circle text-4xl text-white"></i>
                  </div>
                  <p
                    className={
                      isDark ? "text-gray-400 text-lg" : "text-gray-500 text-lg"
                    }
                  >
                    No pending employee approvals
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingEmployeesList.map((emp, index) => (
                    <motion.div
                      key={emp.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-center justify-between p-4 rounded-xl shadow-md border ${isDark
                        ? "bg-gray-700 border-gray-600"
                        : "bg-white border-blue-100"
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
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
                          <p className="text-blue-400 text-sm font-medium">
                            {DEPARTMENTS[emp.department]?.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleApproveUser(emp.id)}
                          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl shadow-lg"
                        >
                          <i className="fas fa-check mr-2"></i>Approve
                        </button>
                        <button
                          onClick={() => handleRejectUser(emp.id)}
                          className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl shadow-lg"
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

      case "departments":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between mb-8">
              <h1
                className={`text-2xl sm:text-3xl font-bold ${isDark ? "text-white" : "text-[#1e293b]"
                  }`}
              >
                {selectedDepartment
                  ? DEPARTMENTS[selectedDepartment]?.name
                  : "Departments"}
              </h1>
              {selectedDepartment && (
                <button
                  onClick={() => setSelectedDepartment(null)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-medium"
                >
                  <i className="fas fa-arrow-left mr-2"></i> Back
                </button>
              )}
            </div>
            {!selectedDepartment ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(DEPARTMENTS).map(([key, dept]) => (
                  <motion.div
                    key={key}
                    whileHover={{ scale: 1.02, y: -4 }}
                    onClick={() => setSelectedDepartment(key)}
                    className={`rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all cursor-pointer ${isDark ? "bg-gray-800" : "bg-white"
                      }`}
                  >
                    <div className="flex items-center mb-4">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center mr-4 
                        ${dept.color === "blue"
                            ? "bg-[#3b82f6]"
                            : dept.color === "green"
                              ? "bg-[#10b981]"
                              : dept.color === "purple"
                                ? "bg-[#8b5cf6]"
                                : dept.color === "yellow"
                                  ? "bg-[#f5b00b]"
                                  : dept.color === "red"
                                    ? "bg-[#ef4444]"
                                    : "bg-blue-500"
                          }
                      `}
                      >
                        <i
                          className={`fas ${dept.icon} text-white text-xl`}
                        ></i>
                      </div>
                      <div>
                        <h3
                          className={`font-bold text-lg ${isDark ? "text-white" : "text-[#1e293b]"
                            }`}
                        >
                          {dept.name}
                        </h3>
                        <p
                          className={
                            isDark
                              ? "text-gray-400 text-sm"
                              : "text-gray-500 text-sm"
                          }
                        >
                          {getDepartmentCount(key)} Employees
                        </p>
                      </div>
                    </div>
                    <p
                      className={`text-sm leading-relaxed mt-2 ${isDark ? "text-gray-400" : "text-gray-500"
                        }`}
                    >
                      {dept.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {getDepartmentManager(selectedDepartment) && (
                  <div
                    className={`rounded-2xl p-6 shadow-lg border ${isDark
                      ? "bg-gray-800 border-gray-700"
                      : "bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100"
                      }`}
                  >
                    <h2 className="text-xl font-bold text-violet-400 mb-4 flex items-center">
                      <i className="fas fa-user-tie mr-2"></i> Department
                      Manager
                    </h2>
                    <div
                      className={`flex items-center p-4 rounded-xl border relative ${isDark
                        ? "bg-gray-700 border-gray-600"
                        : "bg-white/50 border-violet-100"
                        }`}
                    >
                      <div className="flex items-center gap-4 pr-20">
                        <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                          {
                            getDepartmentManager(selectedDepartment)
                              .firstName[0]
                          }
                        </div>
                        <div>
                          <p
                            className={`font-bold text-lg ${isDark ? "text-white" : "text-gray-800"
                              }`}
                          >
                            {getDepartmentManager(selectedDepartment).firstName}
                          </p>
                          <p
                            className={
                              isDark
                                ? "text-gray-400 text-sm"
                                : "text-gray-500 text-sm"
                            }
                          >
                            {getDepartmentManager(selectedDepartment).email}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        );

      case "employees":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1
              className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"
                } mb-8`}
            >
              All Employees & Managers
            </h1>

            {approvedManagers.length > 0 && (
              <div
                className={`rounded-2xl p-6 shadow-lg mb-6 border ${isDark
                  ? "bg-gray-800 border-gray-700"
                  : "bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100"
                  }`}
              >
                <h2 className="text-xl font-bold text-violet-400 mb-4 flex items-center">
                  <i className="fas fa-user-tie mr-2"></i>Department Managers (
                  {approvedManagers.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {approvedManagers.map((emp) => (
                    <div
                      key={emp.id}
                      className={`p-4 rounded-xl shadow-md ${isDark
                        ? "bg-gray-700 border-gray-600"
                        : "bg-white border-gray-100"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold">
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
                                  ? "text-gray-400 text-xs"
                                  : "text-gray-500 text-xs"
                              }
                            >
                              {DEPARTMENTS[emp.department]?.name}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={() => viewEmployeeProfile(emp)}
                          className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm font-medium transition-all hover:scale-105 flex items-center justify-center shadow-md"
                        >
                          <i className="fas fa-eye mr-2"></i> View
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteEmployee(emp.id, emp.firstName)
                          }
                          className="px-3.5 py-2 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-lg text-sm font-medium transition-all hover:scale-105 flex items-center justify-center shadow-md"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              className={`rounded-2xl p-6 shadow-lg overflow-x-auto border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center">
                <i className="fas fa-users mr-2"></i>Employees (
                {regularEmployees.length})
              </h2>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                    <th className="px-4 py-4 font-bold rounded-tl-lg">Name</th>
                    <th className="px-4 py-4 font-bold">Email</th>
                    <th className="px-4 py-4 font-bold">Department</th>
                    <th className="px-4 py-4 font-bold rounded-tr-lg">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {regularEmployees.map((emp) => (
                    <React.Fragment key={emp.id}>
                      <tr
                        className={`border-b ${isDark
                          ? "border-gray-600 hover:bg-gray-700"
                          : "hover:bg-gray-50"
                          } ${expandedEmployeeId === emp.id
                            ? isDark
                              ? "bg-gray-700"
                              : "bg-gray-50"
                            : ""
                          }`}
                      >
                        <td
                          className={`px-4 py-3 font-medium ${isDark ? "text-white" : ""
                            }`}
                        >
                          {emp.firstName} {emp.lastName}
                        </td>
                        <td
                          className={`px-4 py-3 ${isDark ? "text-gray-400" : "text-gray-500"
                            }`}
                        >
                          {emp.email}
                        </td>
                        <td
                          className={`px-4 py-3 ${isDark ? "text-gray-300" : ""
                            }`}
                        >
                          {DEPARTMENTS[emp.department]?.name}
                        </td>
                        <td className="px-4 py-3 flex gap-2">
                          <button
                            onClick={() => toggleEmployeeExpand(emp.id)}
                            className="px-4 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm font-medium transition-all hover:scale-105 flex items-center justify-center shadow-sm"
                          >
                            <i
                              className={`fas fa-${expandedEmployeeId === emp.id
                                ? "eye-slash"
                                : "eye"
                                } mr-2`}
                            ></i>{" "}
                            {expandedEmployeeId === emp.id ? "Close" : "View"}
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteEmployee(emp.id, emp.firstName)
                            }
                            className="px-3.5 py-1.5 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-lg text-sm font-medium transition-all hover:scale-105 flex items-center justify-center shadow-sm"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                      <AnimatePresence>
                        {expandedEmployeeId === emp.id && (
                          <tr>
                            <td colSpan="4" className="p-0 border-b-0">
                              <div
                                className={`px-4 ${isDark ? "bg-gray-800" : "bg-slate-50"
                                  }`}
                              >
                                <ProfileCard
                                  user={emp}
                                  role={emp.role}
                                  isAdminView={true}
                                  workLogs={getEmployeeWorkLogs(emp.id)}
                                  isInline={true}
                                  onClose={() => setExpandedEmployeeId(null)}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  ))}
                  {regularEmployees.length === 0 && (
                    <tr>
                      <td
                        colSpan="4"
                        className={`px-4 py-8 text-center ${isDark ? "text-gray-400" : "text-gray-500"
                          }`}
                      >
                        No employees found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        );

      case "attendance": {
        let statsEmployees = approvedEmployees;
        let statsOnLeave = employeesOnLeave;

        if (presentSubFilter === "managers") {
          statsEmployees = approvedManagers;
          statsOnLeave = employeesOnLeave.filter(req => approvedManagers.some(m => m.id === req.employeeId));
        } else if (presentSubFilter === "employees") {
          statsEmployees = regularEmployees;
          statsOnLeave = employeesOnLeave.filter(req => regularEmployees.some(e => e.id === req.employeeId));
        }

        const statsPresentIds = statsEmployees.filter(emp => presentIds.includes(emp.id)).map(e => e.id);
        const presentCount = statsPresentIds.length;
        const totalCount = statsEmployees.length;
        const absentCount = totalCount - presentCount;
        const onLeaveCount = statsOnLeave.length;
        const attPercentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <motion.div
                onClick={() => {
                  setAttendanceFilter(
                    attendanceFilter === "present" ? null : "present"
                  );
                }}
                className={`bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer ${attendanceFilter === "present" ? "ring-4 ring-white" : ""
                  }`}
              >
                <p className="text-3xl font-bold">{presentCount}</p>
                <p className="text-white/80">Present</p>
              </motion.div>
              <motion.div
                onClick={() => {
                  setAttendanceFilter(
                    attendanceFilter === "absent" ? null : "absent"
                  );
                }}
                className={`bg-gradient-to-br from-rose-400 to-red-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer ${attendanceFilter === "absent" ? "ring-4 ring-white" : ""
                  }`}
              >
                <p className="text-3xl font-bold">
                  {absentCount}
                </p>
                <p className="text-white/80">Absent</p>
              </motion.div>
              <motion.div
                onClick={() => {
                  setAttendanceFilter(
                    attendanceFilter === "onLeave" ? null : "onLeave"
                  );
                }}
                className={`bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white shadow-lg cursor-pointer ${attendanceFilter === "onLeave" ? "ring-4 ring-white" : ""
                  }`}
              >
                <p className="text-3xl font-bold">{onLeaveCount}</p>
                <p className="text-white/80">On Leave</p>
              </motion.div>
              <motion.div
                onClick={() => {
                  setAttendanceFilter(
                    attendanceFilter === "total" ? null : "total"
                  );
                }}
                className={`bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer ${attendanceFilter === "total" ? "ring-4 ring-white" : ""
                  }`}
              >
                <p className="text-3xl font-bold">{totalCount}</p>
                <p className="text-white/80">Total</p>
              </motion.div>
              <motion.div className="bg-gradient-to-br from-violet-400 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                <p className="text-3xl font-bold">
                  {attPercentage}%
                </p>
                <p className="text-white/80">Attendance</p>
              </motion.div>
            </div>

            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setPresentSubFilter("all")}
                className={`px-6 py-2.5 rounded-xl font-bold transition-all ${presentSubFilter === "all"
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md"
                  : isDark
                    ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
              >
                All
              </button>
              <button
                onClick={() => setPresentSubFilter("managers")}
                className={`px-6 py-2.5 rounded-xl font-bold transition-all ${presentSubFilter === "managers"
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md"
                  : isDark
                    ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
              >
                Managers
              </button>
              <button
                onClick={() => setPresentSubFilter("employees")}
                className={`px-6 py-2.5 rounded-xl font-bold transition-all ${presentSubFilter === "employees"
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md"
                  : isDark
                    ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
              >
                Employees
              </button>
            </div>

            <div
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <div className="space-y-3">
                {getFilteredList().map((item) => {
                  const emp = item.employeeId
                    ? allUsers.find((e) => e.id === item.employeeId)
                    : item;
                  if (!emp) return null;
                  return (
                    <div
                      key={emp.id}
                      className={`flex items-center justify-between p-4 rounded-xl border ${isDark
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
            </div>
          </motion.div>
        );
      }

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

            {/* FULLY RESTORED LEAVE FILTERS */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setLeaveFilter("pending")}
                className={`px-6 py-2.5 rounded-xl font-bold ${leaveFilter === "pending"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
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
                  ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white"
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
                {allLeaveRequests.length})
              </button>
            </div>

            <div
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
                    : allLeaveRequests
                ).map((req) => {
                  const emp = allUsers.find((e) => e.id === req.employeeId);
                  if (!emp) return null;
                  return (
                    <div
                      key={req.id}
                      className={`p-4 rounded-xl border ${isDark
                        ? "bg-gray-700 border-gray-600"
                        : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
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
                        <div className="flex gap-2">
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
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        );

      case "profile":
        return <ProfilePage auth={{ currentUser: user }} />;

      default:
        return null;
    }
  };

  return (
    <>
      {toast && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${toast.type === "success" ? "bg-green-600" : "bg-red-600"
            } text-white`}
        >
          {toast.message}
        </div>
      )}

      <div
        className={`flex min-h-screen ${isDark
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50"
          }`}
      >
        <AdminSidebar
          currentSection={currentSection}
          onSectionChange={(section) => {
            setCurrentSection(section);
            setAttendanceFilter(null);
            setPresentSubFilter("all");
          }}
          onLogout={onLogout}
          pendingCount={pendingRegistrations.length}
          userName={userName}
          user={user}
          userRole={user?.role}
          leaveRequestCount={pendingLeaveRequests.length}
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        <div
          className={`flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative w-full transition-all duration-300 ${isSidebarOpen ? "lg:ml-72" : "lg:ml-0"
            }`}
          style={{ height: "100vh" }}
        >
          <AnimatePresence mode="wait">{renderSection()}</AnimatePresence>
        </div>
      </div>

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedEmployee(null);
        }}
        user={selectedEmployee}
        role={selectedEmployee?.role}
        isAdminView={true}
        workLogs={
          selectedEmployee ? getEmployeeWorkLogs(selectedEmployee.id) : []
        }
      />
    </>
  );
}
