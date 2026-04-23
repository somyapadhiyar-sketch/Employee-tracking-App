import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useDepartments } from "../hooks/useDepartments";
import { useTheme } from "../context/ThemeContext";
import AdminSidebar from "../components/AdminSidebar";
import ProfileModal, { ProfileCard } from "../components/ProfileModal";

import ProfilePage from "./ProfilePage";
import SelectHolidaysModal from "../components/SelectHolidaysModal";
import ManagerActivityReport from "../components/ManagerActivityReport";
import OrgOverview from "../components/OrgOverview";
import MyPerformance from "./MyPerformance";
import DepartmentPerformance from "../components/DepartmentPerformance";
import GeneratePDF from "../components/GeneratePDF";
import AdminInsightChat from "../components/AdminInsightChat";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useOutletContext } from "react-router-dom";

const AdminCustomSelect = ({ value, options, onChange, label, isDark, icon, iconColorLight, iconColorDark }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className="flex-[1.5] min-w-[200px] w-full">
      <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
        {label}
      </label>
      <div className={`relative group ${isOpen ? "z-50" : "z-20"}`} ref={containerRef}>
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none ${isDark ? iconColorDark : iconColorLight}`}>
          <i className={`fas ${icon} text-sm`}></i>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between pl-11 pr-4 py-3 rounded-xl border-2 transition-all font-bold text-sm outline-none ${isDark
            ? "bg-gray-700 border-gray-600 focus:border-blue-500 text-white"
            : "bg-gray-50 border-gray-100 text-slate-700 focus:border-blue-400 shadow-sm"
            }`}
        >
          <span className="truncate pr-2">{selectedOption?.label}</span>
          <i
            className={`fas fa-chevron-down text-[10px] transition-transform ${isOpen ? "rotate-180" : ""
              } opacity-50 ${isDark ? "text-white" : "text-slate-700"}`}
          ></i>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`absolute top-[48px] left-0 w-full z-50 rounded-xl shadow-2xl border max-h-60 overflow-y-auto overflow-x-hidden scrollbar-hide ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"
                }`}
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${value === opt.value
                    ? "bg-blue-500/10 text-blue-500"
                    : isDark
                      ? "text-gray-300 hover:bg-gray-700"
                      : "text-slate-600 hover:bg-gray-50"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const FONT_AWESOME_ICONS = [
  { class: "fa-building", name: "Building" },
  { class: "fa-users", name: "Users" },
  { class: "fa-briefcase", name: "Briefcase" },
  { class: "fa-chart-line", name: "Chart" },
  { class: "fa-chart-pie", name: "Pie Chart" },
  { class: "fa-chart-bar", name: "Bar Chart" },
  { class: "fa-laptop-code", name: "Laptop" },
  { class: "fa-desktop", name: "Desktop" },
  { class: "fa-cogs", name: "Cogs" },
  { class: "fa-headset", name: "Headset" },
  { class: "fa-calculator", name: "Calculator" },
  { class: "fa-bullhorn", name: "Bullhorn" },
  { class: "fa-balance-scale", name: "Scale" },
  { class: "fa-microscope", name: "Science" },
  { class: "fa-paint-brush", name: "Art" },
  { class: "fa-heartbeat", name: "Healthcare" },
  { class: "fa-shield-alt", name: "Security" },
  { class: "fa-truck", name: "Logistics" },
  { class: "fa-shopping-cart", name: "Retail" },
  { class: "fa-leaf", name: "Environment" },
  { class: "fa-globe", name: "Global" },
  { class: "fa-lightbulb", name: "Idea" },
  { class: "fa-server", name: "Server" },
  { class: "fa-cloud", name: "Cloud" },
  { class: "fa-project-diagram", name: "Project" },
  { class: "fa-boxes", name: "Stock" },
  { class: "fa-bullseye", name: "Target" },
  { class: "fa-comments", name: "Communications" },
  { class: "fa-handshake", name: "Partnership" },
  { class: "fa-coins", name: "Finance" },
];

export default function AdminDashboard() {
  const { auth, onLogout } = useOutletContext();
  const { isDark } = useTheme();
  const { departmentsMap, addDepartment, editDepartment, deleteDepartment } =
    useDepartments();

  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDept, setNewDept] = useState({
    name: "",
    icon: "fa-building",
    color: "blue",
    description: "",
  });
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState(null);
  const [deptActionView, setDeptActionView] = useState("view");

  const [currentSection, setCurrentSection] = useState("dashboard");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null);
  const [toast, setToast] = useState(null);
  const [managerSearchTerm, setManagerSearchTerm] = useState("");
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");

  const [allUsers, setAllUsers] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [attendanceFilter, setAttendanceFilter] = useState(null);
  const [presentSubFilter, setPresentSubFilter] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [leaveFilter, setLeaveFilter] = useState("pending");
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [showSelectHolidaysModal, setShowSelectHolidaysModal] = useState(false);
  const [selectedAnalysisEmail, setSelectedAnalysisEmail] = useState(null);
  const [selectedAnalysisName, setSelectedAnalysisName] = useState("");
  const [selectedDeptAnalysisId, setSelectedDeptAnalysisId] = useState(null);
  const [selectedDeptAnalysisName, setSelectedDeptAnalysisName] = useState("");
  const [selectedReportDept, setSelectedReportDept] = useState("");
  const [selectedReportEmployee, setSelectedReportEmployee] = useState("");
  const [reportSearchTerm, setReportSearchTerm] = useState("");
  const [reportDetailsStartDate, setReportDetailsStartDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
  );
  const [reportDetailsEndDate, setReportDetailsEndDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
  );
  const [reportCurrentPage, setReportCurrentPage] = useState(1);
  const reportItemsPerPage = 10;
  const [analysisReturnTo, setAnalysisReturnTo] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  const handleGenerateReport = async () => {
    console.log("handleGenerateReport triggered");
    setIsGeneratingReport(true);
    setPdfPreviewUrl(null); // Clear previous preview
    try {
      // Find department name if selected
      let deptName = "All Departments";
      if (selectedReportDept) {
        const dept = departmentsMap[selectedReportDept];
        if (dept) deptName = dept.name;
      }

      // Find employee name and email if selected
      let empName = "All Employees";
      let empEmail = auth?.currentUser?.email;
      if (selectedReportEmployee) {
        const emp = allUsers.find((u) => u.id === selectedReportEmployee);
        if (emp) {
          empName = `${emp.firstName} ${emp.lastName}`;
          empEmail = emp.email;
        }
      }

      const payload = {
        employee_name: empName,
        email: empEmail,
        department: deptName,
        departmentId: selectedReportDept || "all",
        employee: empName,
        employeeEmail: selectedReportEmployee || "all",
        start_date: reportDetailsStartDate,
        end_date: reportDetailsEndDate,
        startDate: reportDetailsStartDate,
        endDate: reportDetailsEndDate,
        generatedBy: userName,
        action: "preview", // Added for routing
      };

      console.log("GenerateReport Payload:", payload);

      const response = await fetch("/n8n-webhook/webhook-test/testid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true
      });

      console.log('Response received (Admin):', response);

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const blob = await response.blob();

      // Check if the response is actually a PDF
      if (blob.type !== "application/pdf") {
        const text = await blob.text();
        console.error("n8n Error Response:", text);
        showToast(
          "n8n sent an error instead of a PDF. Check the console.",
          "error"
        );
        setIsGeneratingReport(false);
        return;
      }

      const url = window.URL.createObjectURL(blob);
      setPdfPreviewUrl(url);

      showToast("Report generated! Preview available below.", "success");
    } catch (error) {
      console.error("Error generating report:", error);
      showToast(
        "Failed to generate report. Make sure n8n is running.",
        "error"
      );
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfPreviewUrl) return;

    let deptName = "All_Departments";
    if (selectedReportDept) {
      const dept = departmentsMap[selectedReportDept];
      if (dept) deptName = dept.name;
    }

    const link = document.createElement("a");
    link.href = pdfPreviewUrl;
    const fileName = `Report_${deptName.replace(
      /\s+/g,
      "_"
    )}_${reportDetailsStartDate}.pdf`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

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

      const analyticsSnap = await getDocs(collection(db, "employee_analytics"));
      setAnalyticsData(
        analyticsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      const holidaysSnap = await getDocs(collection(db, "publicHolidays"));
      if (holidaysSnap.empty) {
        // Initialize with default if empty
        const currentYear = new Date().getFullYear();
        const IT_HOLIDAYS = [
          {
            date: `${currentYear}-01-14`,
            name: "Makar Sankranti",
            type: "Optional",
          },
          { date: `${currentYear}-03-04`, name: "Dhuleti", type: "Mandatory" },
          {
            date: `${currentYear}-08-28`,
            name: "Raksha Bandhan",
            type: "Optional",
          },
          { date: `${currentYear}-10-19`, name: "Dussehra", type: "Mandatory" },
          { date: `${currentYear}-11-09`, name: "New Year", type: "Mandatory" },
        ];

        for (const holiday of IT_HOLIDAYS) {
          await addDoc(collection(db, "publicHolidays"), holiday);
        }
        setPublicHolidays(IT_HOLIDAYS);
      } else {
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
      showToast("Failed to load some database records.", "error");
    } finally {
      // Small delay for better UX
      setTimeout(() => setLoadingData(false), 200);
    }
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

  // Update document title for identity detection by tracking agent
  useEffect(() => {
    if (userName) {
      document.title = `Admin Dashboard [${userName}]`;
    }
  }, [userName]);

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", handleResize);
    };
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
  const formatDisplayDuration = (duration) => {
    if (!duration) return "";
    if (duration.includes("h") || duration.includes("m") || duration.includes("s")) return duration;
    if (duration.includes(":")) {
      const partsArr = duration.split(":").map(Number);
      if (partsArr.length === 3) {
        const [h, m, s] = partsArr;
        const res = [];
        if (h > 0) res.push(`${h}h`);
        if (m > 0) res.push(`${m}m`);
        if (s > 0 || res.length === 0) res.push(`${s}s`);
        return res.join(" ");
      }
    }
    return duration;
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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

  const handleAddNewDepartment = async (e) => {
    e.preventDefault();
    if (!newDept.name || !newDept.description) {
      showToast("Please fill in all required fields", "error");
      return;
    }
    setIsAddingDept(true);

    if (editingDeptId) {
      const { success } = await editDepartment(editingDeptId, newDept);
      setIsAddingDept(false);

      if (success) {
        showToast("Department updated successfully!", "success");
        setCurrentSection("departments");
        setEditingDeptId(null);
        setNewDept({
          name: "",
          icon: "fa-building",
          color: "blue",
          description: "",
        });
      } else {
        showToast("Failed to update department", "error");
      }
    } else {
      const deptId = newDept.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/(^_|_$)/g, "");

      if (departmentsMap[deptId]) {
        showToast("Department already exists", "error");
        setIsAddingDept(false);
        return;
      }

      const { success } = await addDepartment(deptId, newDept);
      setIsAddingDept(false);

      if (success) {
        showToast("Department added successfully!", "success");
        setCurrentSection("departments");
        setNewDept({
          name: "",
          icon: "fa-building",
          color: "blue",
          description: "",
        });
      } else {
        showToast("Failed to add department", "error");
      }
    }
  };

  const handleDeleteDepartment = async (e, deptId, deptName) => {
    e.stopPropagation();
    if (
      window.confirm(
        `Are you sure you want to delete the department "${deptName}"? This action cannot be undone.`
      )
    ) {
      const { success } = await deleteDepartment(deptId);
      if (success) {
        showToast(`Department "${deptName}" deleted.`, "success");
        if (selectedDepartment === deptId) setSelectedDepartment(null);
      } else {
        showToast("Failed to delete department.", "error");
      }
    }
  };

  const openEditDeptModal = (e, deptId, deptData) => {
    e.stopPropagation();
    setEditingDeptId(deptId);
    setNewDept(deptData);
    setCurrentSection("add_department");
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
      action: () => setCurrentSection("employees"),
    },
    {
      title: "Departments",
      value: Object.keys(departmentsMap).length,
      icon: "fa-building",
      color: "from-emerald-400 to-green-500",
      action: () => {
        setCurrentSection("departments");
        setDeptActionView("view");
      },
    },
    {
      title: "Present Today",
      value: presentIds.length,
      icon: "fa-user-check",
      color: "from-violet-400 to-purple-500",
      action: () => {
        setCurrentSection("attendance");
        setAttendanceFilter("present");
        setPresentSubFilter("all");
      },
    },
    {
      title: "Pending",
      value: pendingRegistrations.length,
      icon: "fa-user-clock",
      color: "from-amber-400 to-orange-500",
      action: () => setCurrentSection("pending"),
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
      case "admin_chat": {
        return <AdminInsightChat isDark={isDark} userName={userName} />;
      }
      case "generatePdf": {
        return (
          <GeneratePDF
            allUsers={allUsers}
            departmentsMap={departmentsMap}
            isDark={isDark}
            currentUserEmail={auth?.currentUser?.email}
          />
        );
      }
      case "reportDetails": {
        const departmentsList = Object.entries(departmentsMap).map(
          ([id, d]) => ({ id, ...d })
        );
        const filteredEmployeesForReport = allUsers.filter(
          (u) =>
            u.status === "approved" &&
            u.role !== "admin" &&
            (!selectedReportDept ||
              u.department === selectedReportDept ||
              u.departmentId === selectedReportDept)
        );

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
              Report Details
            </h1>
            <div
              className={`p-6 rounded-2xl border space-y-6 ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100 shadow-sm"
                }`}
            >
              {/* Search Bar Row */}
              <div className="relative group">
                <i
                  className={`fas fa-search absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? "text-gray-500" : "text-gray-400"
                    } group-focus-within:text-blue-500 transition-colors`}
                ></i>
                <input
                  type="text"
                  placeholder="Search name, messages or keywords..."
                  value={reportSearchTerm}
                  onChange={(e) => {
                    setReportSearchTerm(e.target.value);
                    setReportCurrentPage(1);
                  }}
                  className={`w-full pl-11 pr-4 py-3.5 rounded-xl border-2 transition-all font-bold ${isDark
                    ? "bg-gray-700 border-gray-600 focus:border-blue-500 text-white"
                    : "bg-gray-50 border-gray-100 focus:border-blue-400 focus:bg-white text-gray-800 shadow-sm"
                    }`}
                />
              </div>

              {/* Selectors and Dates Row */}
              <div className="flex flex-col lg:flex-row flex-wrap gap-4 items-end">
                <AdminCustomSelect
                  isDark={isDark}
                  label="Department"
                  value={selectedReportDept}
                  icon="fa-building"
                  iconColorLight="text-blue-500"
                  iconColorDark="text-blue-400"
                  options={[
                    { value: "", label: "All Departments" },
                    ...departmentsList.map((dept) => ({
                      value: dept.id,
                      label: dept.name,
                    })),
                  ]}
                  onChange={(val) => {
                    setSelectedReportDept(val);
                    setSelectedReportEmployee("");
                    setReportCurrentPage(1);
                  }}
                />

                <AdminCustomSelect
                  isDark={isDark}
                  label="Employee"
                  value={selectedReportEmployee}
                  icon="fa-user"
                  iconColorLight="text-emerald-500"
                  iconColorDark="text-emerald-400"
                  options={[
                    { value: "", label: "Select Employee" },
                    ...filteredEmployeesForReport.map((emp) => ({
                      value: emp.id,
                      label: `${emp.firstName} ${emp.lastName} ${emp.role === "manager" || emp.role === "dept_manager" ? "(Manager)" : ""}`.trim(),
                    })),
                  ]}
                  onChange={(val) => {
                    setSelectedReportEmployee(val);
                    setReportCurrentPage(1);
                  }}
                />

                <div className="flex-[2] min-w-[280px] w-full flex gap-3">
                  <div className="flex-1">
                    <label
                      className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? "text-gray-400" : "text-gray-500"
                        }`}
                    >
                      From
                    </label>
                    <input
                      type="date"
                      value={reportDetailsStartDate}
                      onChange={(e) => {
                        setReportDetailsStartDate(e.target.value);
                        setReportCurrentPage(1);
                      }}
                      className={`w-full px-4 py-[9.5px] rounded-xl border-2 transition-all font-bold text-sm outline-none ${isDark
                        ? "bg-gray-700 border-gray-600 focus:border-blue-500 text-white"
                        : "bg-gray-50 border-gray-100 focus:border-blue-400 focus:bg-white text-gray-800 shadow-sm"
                        }`}
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? "text-gray-400" : "text-gray-500"
                        }`}
                    >
                      To
                    </label>
                    <input
                      type="date"
                      value={reportDetailsEndDate}
                      onChange={(e) => {
                        setReportDetailsEndDate(e.target.value);
                        setReportCurrentPage(1);
                      }}
                      className={`w-full px-4 py-[9.5px] rounded-xl border-2 transition-all font-bold text-sm outline-none ${isDark
                        ? "bg-gray-700 border-gray-600 focus:border-blue-500 text-white"
                        : "bg-gray-50 border-gray-100 focus:border-blue-400 focus:bg-white text-gray-800 shadow-sm"
                        }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl shadow-xl overflow-hidden border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                      <th className="px-6 py-4 font-bold text-sm">Employee</th>
                      <th className="px-6 py-4 font-bold text-sm">Date</th>
                      <th className="px-6 py-4 font-bold text-sm">Work Type</th>
                      <th className="px-6 py-4 font-bold text-sm">
                        Task Details
                      </th>
                      <th className="px-6 py-4 font-bold text-sm">Time</th>
                      <th className="px-6 py-4 font-bold text-sm text-right">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-100"
                      }`}
                  >
                    {(() => {
                      const filteredLogs = workLogs
                        .filter((log) => {
                          const matchesEmployee =
                            !selectedReportEmployee ||
                            log.employeeId === selectedReportEmployee;
                          const matchesDept =
                            !selectedReportDept ||
                            allUsers.find((u) => u.id === log.employeeId)
                              ?.department === selectedReportDept ||
                            allUsers.find((u) => u.id === log.employeeId)
                              ?.departmentId === selectedReportDept;

                          const matchesStartDate =
                            !reportDetailsStartDate ||
                            log.date >= reportDetailsStartDate;
                          const matchesEndDate =
                            !reportDetailsEndDate ||
                            log.date <= reportDetailsEndDate;
                          const matchesDate =
                            matchesStartDate && matchesEndDate;

                          const logEmployee = allUsers.find(
                            (u) => u.id === log.employeeId
                          );
                          const employeeName = `${logEmployee?.firstName || ""
                            } ${logEmployee?.lastName || ""}`.toLowerCase();
                          const description = (
                            log.description || ""
                          ).toLowerCase();
                          const search = reportSearchTerm.toLowerCase();
                          const searchTrimmed = search.trim();
                          const isExactOffice = searchTrimmed === "office";
                          const workType = (log.workType || "").toLowerCase();
                          const workTypeMatch = isExactOffice ? workType === "office" : workType.includes(searchTrimmed);
                          const durationStr = String(formatDisplayDuration(log.duration) || (log.minutes ? `${log.minutes}m` : `${log.hours}h`)).toLowerCase();

                          const matchesSearch =
                            !search ||
                            employeeName.includes(search) ||
                            description.includes(search) ||
                            workTypeMatch ||
                            durationStr.includes(searchTrimmed) ||
                            durationStr.replace(/\s+/g, "").includes(searchTrimmed.replace(/\s+/g, ""));

                          return (
                            matchesEmployee &&
                            matchesDept &&
                            matchesDate &&
                            matchesSearch
                          );
                        })
                        .sort((a, b) => new Date(b.date) - new Date(a.date));

                      const totalPages = Math.ceil(filteredLogs.length / reportItemsPerPage);
                      const paginatedLogs = filteredLogs.slice(
                        (reportCurrentPage - 1) * reportItemsPerPage,
                        reportCurrentPage * reportItemsPerPage
                      );

                      if (paginatedLogs.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan="6"
                              className={`px-6 py-12 text-center text-lg italic ${isDark ? "text-gray-500" : "text-gray-400"
                                }`}
                            >
                              No work logs found matching your filters.
                            </td>
                          </tr>
                        );
                      }

                      return paginatedLogs.map((log) => {
                        const logEmployee = allUsers.find(
                          (u) => u.id === log.employeeId
                        );
                        return (
                          <tr
                            key={log.id}
                            className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-tr from-blue-500 to-indigo-600`}
                                >
                                  {logEmployee?.firstName?.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                  <span
                                    className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"
                                      }`}
                                  >
                                    {logEmployee?.firstName}{" "}
                                    {logEmployee?.lastName}
                                  </span>
                                  <span
                                    className={`text-[10px] font-medium ${isDark ? "text-gray-400" : "text-gray-500"
                                      }`}
                                  >
                                    {logEmployee?.role === "manager" ||
                                      logEmployee?.role === "dept_manager"
                                      ? "Manager"
                                      : "Employee"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td
                              className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${isDark ? "text-gray-300" : "text-gray-600"
                                }`}
                            >
                              {new Date(log.date).toLocaleDateString(
                                undefined,
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 w-fit ${log.workType === "office"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-violet-100 text-violet-700"
                                  }`}
                              >
                                <i
                                  className={`fas ${log.workType === "office"
                                    ? "fa-briefcase"
                                    : "fa-laptop-house"
                                    } text-[10px]`}
                                ></i>
                                {log.workType === "office"
                                  ? "Office"
                                  : "Non-Office"}
                              </span>
                            </td>
                            <td
                              className={`px-6 py-4 text-sm leading-relaxed max-w-sm ${isDark ? "text-gray-300" : "text-gray-700"
                                }`}
                            >
                              {log.description}
                            </td>
                            <td
                              className={`px-6 py-4 whitespace-nowrap text-xs font-medium ${isDark ? "text-gray-400" : "text-gray-500"
                                }`}
                            >
                              {log.taskStartTime} - {log.taskEndTime}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span
                                className={`text-sm font-black ${isDark
                                  ? "text-emerald-400"
                                  : "text-emerald-600"
                                  }`}
                              >
                                {formatDisplayDuration(log.duration) ||
                                  (log.minutes
                                    ? `${log.minutes}m`
                                    : `${log.hours}h`)}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {(() => {
                const filteredLogsForPagination = workLogs.filter((log) => {
                  const matchesEmployee = !selectedReportEmployee || log.employeeId === selectedReportEmployee;
                  const matchesDept = !selectedReportDept || allUsers.find((u) => u.id === log.employeeId)?.department === selectedReportDept || allUsers.find((u) => u.id === log.employeeId)?.departmentId === selectedReportDept;
                  const matchesStartDate = !reportDetailsStartDate || log.date >= reportDetailsStartDate;
                  const matchesEndDate = !reportDetailsEndDate || log.date <= reportDetailsEndDate;
                  const matchesDate = matchesStartDate && matchesEndDate;
                  const logEmployee = allUsers.find((u) => u.id === log.employeeId);
                  const employeeName = `${logEmployee?.firstName || ""} ${logEmployee?.lastName || ""}`.toLowerCase();
                  const description = (log.description || "").toLowerCase();
                  const search = reportSearchTerm.toLowerCase();
                  const searchTrimmed = search.trim();
                  const isExactOffice = searchTrimmed === "office";
                  const workType = (log.workType || "").toLowerCase();
                  const workTypeMatch = isExactOffice ? workType === "office" : workType.includes(searchTrimmed);
                  const durationStr = String(formatDisplayDuration(log.duration) || (log.minutes ? `${log.minutes}m` : `${log.hours}h`)).toLowerCase();

                  const matchesSearch = !search || employeeName.includes(search) || description.includes(search) || workTypeMatch || durationStr.includes(searchTrimmed) || durationStr.replace(/\s+/g, "").includes(searchTrimmed.replace(/\s+/g, ""));
                  return matchesEmployee && matchesDept && matchesDate && matchesSearch;
                });

                const totalPages = Math.ceil(filteredLogsForPagination.length / reportItemsPerPage);

                if (totalPages <= 1) return null;

                return (
                  <div className={`flex justify-between items-center px-6 py-4 border-t ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-100 bg-white"}`}>
                    <button
                      onClick={() => setReportCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={reportCurrentPage === 1}
                      className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${reportCurrentPage === 1 ? (isDark ? "text-gray-500 cursor-not-allowed" : "text-gray-400 cursor-not-allowed") : (isDark ? "text-blue-400 hover:bg-gray-700" : "text-blue-600 hover:bg-blue-50")}`}
                    >
                      <i className="fas fa-chevron-left"></i> Previous
                    </button>
                    <span className={`text-sm font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      Page {reportCurrentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setReportCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={reportCurrentPage === totalPages}
                      className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${reportCurrentPage === totalPages ? (isDark ? "text-gray-500 cursor-not-allowed" : "text-gray-400 cursor-not-allowed") : (isDark ? "text-blue-400 hover:bg-gray-700" : "text-blue-600 hover:bg-blue-50")}`}
                    >
                      Next <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        );
      }
      case "org_overview":
        return (
          <OrgOverview
            allUsers={allUsers}
            workLogs={workLogs}
            analyticsData={analyticsData}
            leaveRequests={leaveRequests}
            departmentsMap={departmentsMap}
            isDark={isDark}
            onViewDepartment={(id, name) => {
              setSelectedDeptAnalysisId(id);
              setSelectedDeptAnalysisName(name);
              setAnalysisReturnTo("org_overview");
              setCurrentSection("departmentAnalytics");
            }}
            onViewEmployee={(email, name) => {
              setSelectedAnalysisEmail(email);
              setSelectedAnalysisName(name);
              setAnalysisReturnTo("org_overview");
              setCurrentSection("individualAnalytics");
            }}
          />
        );
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
              <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-6 text-center sm:text-left">
                <div className="flex flex-col items-center sm:items-start">
                  <h1
                    className={`text-3xl sm:text-4xl font-black ${isDark ? "text-white" : "text-gray-800"
                      }`}
                  >
                    Welcome back,{" "}
                    <span className="text-blue-500 font-extrabold">
                      {userName}
                    </span>
                  </h1>
                  <p
                    className={`text-sm mt-1 font-medium ${isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                  >
                    Have a great day ahead!
                  </p>
                </div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col items-center sm:items-end w-full sm:w-auto"
                >
                  <p
                    className={`text-xl sm:text-2xl font-mono font-bold tracking-tight leading-none ${isDark ? "text-white" : "text-blue-600"
                      }`}
                  >
                    {formatTime(currentTime)}
                  </p>
                  <p
                    className={`text-sm font-bold tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                  >
                    {formatDate(currentTime)}
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
                  className={`rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border cursor-pointer ${isDark
                    ? "bg-gray-800 border-gray-700 hover:bg-gray-750"
                    : "bg-white border-gray-100"
                    }`}
                  onClick={stat.action}
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
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl shadow-md border ${isDark
                        ? "bg-gray-700 border-gray-600"
                        : "bg-white border-violet-100"
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
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
                            {departmentsMap[emp.department]?.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-4 sm:mt-0 w-full sm:w-auto">
                        <button
                          onClick={() => handleApproveUser(emp.id)}
                          className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl shadow-lg flex items-center justify-center"
                        >
                          <i className="fas fa-check mr-2"></i>Approve
                        </button>
                        <button
                          onClick={() => handleRejectUser(emp.id)}
                          className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl shadow-lg flex items-center justify-center"
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
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl shadow-md border ${isDark
                        ? "bg-gray-700 border-gray-600"
                        : "bg-white border-blue-100"
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
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
                            {departmentsMap[emp.department]?.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-4 sm:mt-0 w-full sm:w-auto">
                        <button
                          onClick={() => handleApproveUser(emp.id)}
                          className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl shadow-lg flex items-center justify-center"
                        >
                          <i className="fas fa-check mr-2"></i>Approve
                        </button>
                        <button
                          onClick={() => handleRejectUser(emp.id)}
                          className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl shadow-lg flex items-center justify-center"
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
                  ? departmentsMap[selectedDepartment]?.name
                  : "Departments"}
              </h1>
              <div className="flex gap-3">
                {selectedDepartment && (
                  <button
                    onClick={() => setSelectedDepartment(null)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-bold shadow-md flex items-center gap-2 active:scale-95"
                  >
                    <i className="fas fa-arrow-left"></i> Back
                  </button>
                )}
              </div>
            </div>
            {!selectedDepartment ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                {Object.entries(departmentsMap).map(([key, dept]) => (
                  <motion.div
                    key={key}
                    whileHover={{ scale: 1.02, y: -4 }}
                    onClick={() => setSelectedDepartment(key)}
                    className={`relative rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all cursor-pointer flex flex-col h-full ${isDark ? "bg-gray-800" : "bg-white"
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
                                    : dept.color === "orange"
                                      ? "bg-[#f97316]"
                                      : dept.color === "teal"
                                        ? "bg-[#14b8a6]"
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
                      className={`text-sm leading-relaxed mt-2 mb-2 flex-grow ${isDark ? "text-gray-400" : "text-gray-500"
                        }`}
                    >
                      {dept.description}
                    </p>
                    {deptActionView !== "view" && (
                      <div className="flex gap-3 mt-4">
                        {(deptActionView === "edit" ||
                          deptActionView === "both") && (
                            <button
                              onClick={(e) => openEditDeptModal(e, key, dept)}
                              className={`flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${isDark
                                ? "bg-cyan-900/30 text-cyan-400 hover:bg-cyan-900/50"
                                : "bg-cyan-50 hover:bg-cyan-100 text-cyan-600"
                                }`}
                            >
                              <i className="fas fa-pencil-alt"></i> edit
                            </button>
                          )}
                        {(deptActionView === "delete" ||
                          deptActionView === "both") && (
                            <button
                              onClick={(e) =>
                                handleDeleteDepartment(e, key, dept.name)
                              }
                              className={`flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${isDark
                                ? "bg-rose-900/40 hover:bg-rose-900/60 text-rose-400"
                                : "bg-rose-50 hover:bg-rose-100 text-rose-500"
                                }`}
                            >
                              <i className="fas fa-trash-alt"></i> delete
                            </button>
                          )}
                      </div>
                    )}
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
                            {getDepartmentManager(selectedDepartment).firstName}{" "}
                            {getDepartmentManager(selectedDepartment).lastName}
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

                {getDepartmentEmployees(selectedDepartment)?.length > 0 && (
                  <div
                    className={`rounded-2xl p-6 shadow-lg border ${isDark
                      ? "bg-gray-800 border-gray-700"
                      : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100"
                      }`}
                  >
                    <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center">
                      <i className="fas fa-users mr-2"></i> Department Employees
                      ({getDepartmentEmployees(selectedDepartment).length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {getDepartmentEmployees(selectedDepartment).map((emp) => (
                        <div
                          key={emp.id}
                          className={`flex items-center p-4 rounded-xl border relative ${isDark
                            ? "bg-gray-700 border-gray-600"
                            : "bg-white/50 border-blue-100"
                            }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                              {emp.firstName[0]}
                            </div>
                            <div>
                              <p
                                className={`font-bold text-lg ${isDark ? "text-white" : "text-gray-800"
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        );

      case "employees": {
        const filterFn = (u, term) => {
          if (!term) return true;
          const s = term.toLowerCase();
          return (
            `${u.firstName} ${u.lastName}`.toLowerCase().includes(s) ||
            u.email.toLowerCase().includes(s) ||
            departmentsMap[u.department]?.name.toLowerCase().includes(s)
          );
        };
        const filteredManagers = approvedManagers.filter((u) =>
          filterFn(u, managerSearchTerm)
        );
        const filteredEmployees = regularEmployees.filter((u) =>
          filterFn(u, employeeSearchTerm)
        );

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

            {/* Department Managers Section */}
            <div
              className={`rounded-2xl p-6 shadow-lg mb-8 overflow-x-auto border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-xl font-bold text-violet-400 flex items-center whitespace-nowrap">
                  <i className="fas fa-user-tie mr-2"></i>Department Managers (
                  {filteredManagers.length})
                </h2>
                <div className="relative group w-full sm:w-64">
                  <i
                    className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs ${isDark ? "text-gray-500" : "text-gray-400"
                      } group-focus-within:text-violet-500 transition-colors`}
                  ></i>
                  <input
                    type="text"
                    placeholder="Search managers..."
                    value={managerSearchTerm}
                    onChange={(e) => setManagerSearchTerm(e.target.value)}
                    className={`w-full pl-9 pr-4 py-2 text-sm rounded-xl border transition-all ${isDark
                      ? "bg-gray-700/50 border-gray-600 text-white focus:ring-1 focus:ring-violet-500"
                      : "bg-gray-50 border-gray-200 text-gray-800 focus:ring-2 focus:ring-violet-100 focus:bg-white"
                      }`}
                  />
                </div>
              </div>

              {filteredManagers.length > 0 ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gradient-to-r from-violet-500 to-purple-600 text-white">
                      <th className="px-4 py-4 font-bold rounded-tl-lg text-sm">
                        Name
                      </th>
                      <th className="px-4 py-4 font-bold text-sm">Email</th>
                      <th className="px-4 py-4 font-bold text-sm">
                        Department
                      </th>
                      <th className="px-4 py-4 font-bold rounded-tr-lg text-sm">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredManagers.map((emp) => (
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
                            className={`px-4 py-3 font-medium text-sm ${isDark ? "text-white" : ""
                              }`}
                          >
                            {emp.firstName} {emp.lastName}
                          </td>
                          <td
                            className={`px-4 py-3 text-sm ${isDark ? "text-gray-400" : "text-gray-500"
                              }`}
                          >
                            {emp.email}
                          </td>
                          <td
                            className={`px-4 py-3 text-sm ${isDark ? "text-gray-300" : ""
                              }`}
                          >
                            {departmentsMap[emp.department]?.name}
                          </td>
                          <td className="px-4 py-3 flex gap-3">
                            <button
                              onClick={() => toggleEmployeeExpand(emp.id)}
                              title={
                                expandedEmployeeId === emp.id ? "Close" : "View"
                              }
                              className="w-9 h-9 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg transition-all hover:scale-110 shadow-sm flex items-center justify-center"
                            >
                              <i
                                className={`fas fa-${expandedEmployeeId === emp.id
                                  ? "eye-slash"
                                  : "eye"
                                  }`}
                              ></i>
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteEmployee(emp.id, emp.firstName)
                              }
                              title="Delete"
                              className="w-9 h-9 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-lg transition-all hover:scale-110 shadow-sm flex items-center justify-center"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </td>
                        </tr>
                        <AnimatePresence>
                          {expandedEmployeeId === emp.id && (
                            <tr>
                              <td colSpan="4" className="p-0">
                                <div
                                  className={`px-4 py-2 ${isDark ? "bg-gray-800" : "bg-slate-50"
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
                  </tbody>
                </table>
              ) : (
                <p
                  className={`text-center py-8 ${isDark ? "text-gray-500" : "text-gray-400"
                    }`}
                >
                  No managers found for "{managerSearchTerm}"
                </p>
              )}
            </div>

            {/* Regular Employees Section */}
            <div
              className={`rounded-2xl p-6 shadow-lg overflow-x-auto border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-xl font-bold text-blue-400 flex items-center whitespace-nowrap">
                  <i className="fas fa-users mr-2"></i>Employees (
                  {filteredEmployees.length})
                </h2>
                <div className="relative group w-full sm:w-64">
                  <i
                    className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs ${isDark ? "text-gray-500" : "text-gray-400"
                      } group-focus-within:text-blue-500 transition-colors`}
                  ></i>
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                    className={`w-full pl-9 pr-4 py-2 text-sm rounded-xl border transition-all ${isDark
                      ? "bg-gray-700/50 border-gray-600 text-white focus:ring-1 focus:ring-blue-500"
                      : "bg-gray-50 border-gray-200 text-gray-800 focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      }`}
                  />
                </div>
              </div>

              {filteredEmployees.length > 0 ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                      <th className="px-4 py-4 font-bold rounded-tl-lg text-sm">
                        Name
                      </th>
                      <th className="px-4 py-4 font-bold text-sm">Email</th>
                      <th className="px-4 py-4 font-bold text-sm">
                        Department
                      </th>
                      <th className="px-4 py-4 font-bold rounded-tr-lg text-sm">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => (
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
                            className={`px-4 py-3 font-medium text-sm ${isDark ? "text-white" : ""
                              }`}
                          >
                            {emp.firstName} {emp.lastName}
                          </td>
                          <td
                            className={`px-4 py-3 text-sm ${isDark ? "text-gray-400" : "text-gray-500"
                              }`}
                          >
                            {emp.email}
                          </td>
                          <td
                            className={`px-4 py-3 text-sm ${isDark ? "text-gray-300" : ""
                              }`}
                          >
                            {departmentsMap[emp.department]?.name}
                          </td>
                          <td className="px-4 py-3 flex gap-3">
                            <button
                              onClick={() => toggleEmployeeExpand(emp.id)}
                              title={
                                expandedEmployeeId === emp.id ? "Close" : "View"
                              }
                              className="w-9 h-9 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg transition-all hover:scale-110 shadow-sm flex items-center justify-center"
                            >
                              <i
                                className={`fas fa-${expandedEmployeeId === emp.id
                                  ? "eye-slash"
                                  : "eye"
                                  }`}
                              ></i>
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteEmployee(emp.id, emp.firstName)
                              }
                              title="Delete"
                              className="w-9 h-9 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-lg transition-all hover:scale-110 shadow-sm flex items-center justify-center"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </td>
                        </tr>
                        <AnimatePresence>
                          {expandedEmployeeId === emp.id && (
                            <tr>
                              <td colSpan="4" className="p-0">
                                <div
                                  className={`px-4 py-2 ${isDark ? "bg-gray-800" : "bg-slate-50"
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
                  </tbody>
                </table>
              ) : (
                <p
                  className={`text-center py-8 ${isDark ? "text-gray-500" : "text-gray-400"
                    }`}
                >
                  No employees found for "{employeeSearchTerm}"
                </p>
              )}
            </div>
          </motion.div>
        );
      }

      case "attendance": {
        let statsEmployees = approvedEmployees;
        let statsOnLeave = employeesOnLeave;

        if (presentSubFilter === "managers") {
          statsEmployees = approvedManagers;
          statsOnLeave = employeesOnLeave.filter((req) =>
            approvedManagers.some((m) => m.id === req.employeeId)
          );
        } else if (presentSubFilter === "employees") {
          statsEmployees = regularEmployees;
          statsOnLeave = employeesOnLeave.filter((req) =>
            regularEmployees.some((e) => e.id === req.employeeId)
          );
        }

        const statsPresentIds = statsEmployees
          .filter((emp) => presentIds.includes(emp.id))
          .map((e) => e.id);
        const presentCount = statsPresentIds.length;
        const totalCount = statsEmployees.length;
        const absentCount = totalCount - presentCount;
        const onLeaveCount = statsOnLeave.length;
        const attPercentage =
          totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

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
                <p className="text-3xl font-bold">{absentCount}</p>
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
                <p className="text-3xl font-bold">{attPercentage}%</p>
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
            <div className="flex gap-1 sm:gap-3 mb-6 w-full sm:w-auto">
              <button
                onClick={() => setLeaveFilter("pending")}
                className={`flex-1 sm:flex-none flex flex-row items-center justify-center px-1 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] xs:text-[11px] sm:text-base font-bold whitespace-nowrap transition-all ${leaveFilter === "pending"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                  : isDark
                    ? "bg-gray-700 text-gray-200"
                    : "bg-gray-200 text-gray-700"
                  }`}
              >
                <i className="fas fa-clock mr-1 sm:mr-2"></i>
                <div className="flex flex-row items-center gap-0.5 sm:gap-1 tracking-wide leading-tight">
                  <span>Pending</span>
                  <span>({pendingLeaveRequests.length})</span>
                </div>
              </button>
              <button
                onClick={() => setLeaveFilter("approved")}
                className={`flex-1 sm:flex-none flex flex-row items-center justify-center px-1 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] xs:text-[11px] sm:text-base font-bold whitespace-nowrap transition-all ${leaveFilter === "approved"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                  : isDark
                    ? "bg-gray-700 text-gray-200"
                    : "bg-gray-200 text-gray-700"
                  }`}
              >
                <i className="fas fa-check-circle mr-1 sm:mr-2"></i>
                <div className="flex flex-row items-center gap-0.5 sm:gap-1 tracking-wide leading-tight">
                  <span className="hidden xs:inline">Approved</span>
                  <span className="xs:hidden">Approd</span>
                  <span>({approvedLeaveRequests.length})</span>
                </div>
              </button>
              <button
                onClick={() => setLeaveFilter("all")}
                className={`flex-1 sm:flex-none flex flex-row items-center justify-center px-1 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] xs:text-[11px] sm:text-base font-bold whitespace-nowrap transition-all ${leaveFilter === "all"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                  : isDark
                    ? "bg-gray-700 text-gray-200"
                    : "bg-gray-200 text-gray-700"
                  }`}
              >
                <i className="fas fa-list mr-1 sm:mr-2"></i>
                <div className="flex flex-row items-center gap-0.5 sm:gap-1 tracking-wide leading-tight">
                  <span>All</span>
                  <span>({allLeaveRequests.length})</span>
                </div>
              </button>
            </div>

            <div
              className={`rounded-2xl p-6 shadow-lg border ${isDark
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
                }`}
            >
              <div className="space-y-4">
                {(() => {
                  const filteredReqs =
                    leaveFilter === "pending"
                      ? pendingLeaveRequests
                      : leaveFilter === "approved"
                        ? approvedLeaveRequests
                        : allLeaveRequests;

                  if (filteredReqs.length === 0) {
                    return (
                      <div className="text-center py-16">
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse">
                          <i className="fas fa-clipboard-check text-4xl text-white"></i>
                        </div>
                        <h3
                          className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-800"
                            }`}
                        >
                          No {leaveFilter} leave requests
                        </h3>
                        <p
                          className={isDark ? "text-gray-400" : "text-gray-500"}
                        >
                          {leaveFilter === "pending"
                            ? "All clear! There are no new requests waiting for your approval."
                            : `There are currently no ${leaveFilter} requests in the system.`}
                        </p>
                      </div>
                    );
                  }

                  return filteredReqs.map((req) => {
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
                                {(req.leaveDuration === "half" ||
                                  req.leaveDuration === "first_half" ||
                                  req.leaveDuration === "second_half") && (
                                    <span className="ml-2 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-orange-100 text-orange-700 align-middle">
                                      {req.leaveDuration === "half"
                                        ? "Half Leave"
                                        : req.leaveDuration === "first_half"
                                          ? "1st Half Leave"
                                          : "2nd Half Leave"}
                                    </span>
                                  )}
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
                            {req.startTime && req.endTime && (
                              <div className="mt-1 text-xs font-bold text-orange-500">
                                <i className="fas fa-clock mr-1"></i> Time:{" "}
                                {req.startTime} to {req.endTime}
                              </div>
                            )}
                            {req.leaveDuration === "half" ||
                              req.leaveDuration === "first_half" ||
                              req.leaveDuration === "second_half" ? (
                              <span className="ml-2 font-bold text-orange-500">
                                (0.5 Day -{" "}
                                {req.leaveDuration === "half"
                                  ? "Half"
                                  : req.leaveDuration === "first_half"
                                    ? "1st Half"
                                    : "2nd Half"}
                                )
                              </span>
                            ) : (
                              <span className="ml-2 font-bold text-blue-500">
                                (
                                {Math.ceil(
                                  Math.abs(
                                    new Date(req.endDate) -
                                    new Date(req.startDate)
                                  ) /
                                  (1000 * 60 * 60 * 24)
                                ) + 1}{" "}
                                Days)
                              </span>
                            )}
                          </p>
                        </div>
                        {req.status === "pending" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveLeave(req.id)}
                              className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-lg font-medium shadow-md transition-all hover:scale-105"
                            >
                              <i className="fas fa-check mr-2"></i>Approve
                            </button>
                            <button
                              onClick={() => handleRejectLeave(req.id)}
                              className="flex-1 px-4 py-2 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-lg font-medium shadow-md transition-all hover:scale-105"
                            >
                              <i className="fas fa-times mr-2"></i>Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </motion.div>
        );

      case "holidays": {
        const currentYear = new Date().getFullYear();
        const todayDate = new Date();
        const calYear = currentCalendarDate.getFullYear();
        const calMonth = currentCalendarDate.getMonth();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();

        const IT_HOLIDAYS = publicHolidays;

        const monthNames = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];

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
            <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2 sm:gap-4">
              <h1
                className={`text-[26px] xs:text-[28px] sm:text-3xl font-bold leading-tight ${isDark ? "text-white" : "text-gray-800"
                  } flex items-center`}
              >
                <i className="fas fa-umbrella-beach mr-2 sm:mr-3 text-blue-500"></i>
                <span>Public Holidays</span>
              </h1>
              <button
                onClick={() => setShowSelectHolidaysModal(true)}
                className="px-3 py-2 sm:px-6 sm:py-3 text-[10px] sm:text-base bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-lg sm:rounded-2xl transition-all shadow-md sm:shadow-lg hover:shadow-xl flex items-center gap-1.5 sm:gap-2 active:scale-95 whitespace-nowrap shrink-0"
              >
                <i className="fas fa-calendar-plus"></i>
                <span>Manage <span className="hidden xs:inline">Holidays</span></span>
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Holidays List */}
              <div className="w-full md:w-3/5 space-y-4">
                {IT_HOLIDAYS.map((holiday, idx) => {
                  const holDate = new Date(holiday.date);
                  const todayZero = new Date(todayDate);
                  todayZero.setHours(0, 0, 0, 0);
                  const holZero = new Date(holDate);
                  holZero.setHours(0, 0, 0, 0);
                  const isPast = holZero < todayZero;

                  return (
                    <div
                      key={idx}
                      onClick={() =>
                        setCurrentCalendarDate(new Date(holiday.date))
                      }
                      className={`cursor-pointer flex items-center justify-between p-3 xs:p-4 sm:p-5 rounded-xl sm:rounded-[1.5rem] shadow-sm border transition-all duration-300 ${isPast
                        ? isDark
                          ? "bg-gray-800/80 border-gray-700 opacity-60"
                          : "bg-gray-50 border-gray-100 opacity-70"
                        : isDark
                          ? "bg-gray-800 border-gray-700 hover:border-blue-500/50 hover:shadow-lg"
                          : "bg-white border-blue-50 hover:border-blue-200 hover:shadow-lg"
                        }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-5">
                        <div
                          className={`w-11 h-11 xs:w-12 xs:h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center font-bold ${isPast
                            ? "bg-gray-300 text-gray-500"
                            : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md sm:shadow-lg"
                            }`}
                        >
                          <span className="text-[8px] sm:text-[10px] uppercase font-black">
                            {holDate.toLocaleString("default", {
                              month: "short",
                            })}
                          </span>
                          <span className="text-base sm:text-xl leading-none">
                            {holDate.getDate()}
                          </span>
                        </div>
                        <div className="min-w-0 pr-2">
                          <p
                            className={`font-black text-sm sm:text-lg truncate ${isPast
                              ? isDark
                                ? "text-gray-400"
                                : "text-gray-500"
                              : isDark
                                ? "text-white"
                                : "text-slate-800"
                              }`}
                          >
                            {holiday.name}
                          </p>
                          <span
                            className={`text-xs font-bold ${isDark ? "text-gray-400" : "text-gray-500"
                              } mt-1 inline-block`}
                          >
                            <i className="far fa-calendar mr-2"></i>
                            {holDate.toLocaleDateString(undefined, {
                              weekday: "long",
                            })}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 sm:px-3 sm:py-1 rounded-full shrink-0 ${isPast
                          ? "bg-gray-100 text-gray-400"
                          : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}
                      >
                        {isPast ? "Passed" : "Upcoming"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mini Calendar View */}
              <div
                className={`w-full md:w-2/5 md:sticky md:top-6 rounded-[2rem] p-8 shadow-2xl border ${isDark
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-100 text-slate-800"
                  }`}
              >
                <div className="flex flex-col mb-8">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-2xl font-black">
                      {monthNames[calMonth]}
                    </h2>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() =>
                          setCurrentCalendarDate(
                            new Date(calYear, calMonth - 1, 1)
                          )
                        }
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDark
                          ? "bg-gray-700 hover:bg-gray-600"
                          : "bg-gray-100 hover:bg-gray-200"
                          }`}
                      >
                        <i className="fas fa-chevron-left text-sm opacity-60"></i>
                      </button>
                      <button
                        onClick={() => setCurrentCalendarDate(new Date())}
                        className={`text-sm font-bold opacity-70 hover:opacity-100 transition-all ${isDark ? "text-white" : "text-slate-800"
                          }`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() =>
                          setCurrentCalendarDate(
                            new Date(calYear, calMonth + 1, 1)
                          )
                        }
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDark
                          ? "bg-gray-700 hover:bg-gray-600"
                          : "bg-gray-100 hover:bg-gray-200"
                          }`}
                      >
                        <i className="fas fa-chevron-right text-sm opacity-60"></i>
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-bold opacity-40">{calYear}</p>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-4 text-center">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, idx) => (
                    <div
                      key={day}
                      className={`text-[10px] font-black uppercase tracking-widest ${idx === 0 || idx === 6 ? "text-rose-500" : "text-gray-400"
                        }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, idx) => {
                    if (!day)
                      return <div key={`empty-${idx}`} className="p-2"></div>;
                    const dateStr = `${calYear}-${String(calMonth + 1).padStart(
                      2,
                      "0"
                    )}-${String(day).padStart(2, "0")}`;
                    const isHoliday = IT_HOLIDAYS.some(
                      (h) => h.date === dateStr
                    );
                    const isToday =
                      day === todayDate.getDate() &&
                      calMonth === todayDate.getMonth() &&
                      calYear === todayDate.getFullYear();

                    const isWeekend = idx % 7 === 0 || idx % 7 === 6;

                    return (
                      <div
                        key={day}
                        className={`aspect-square flex items-center justify-center rounded-xl text-sm font-bold transition-all relative cursor-default ${isToday
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105"
                          : isHoliday
                            ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                            : isDark
                              ? "bg-gray-700/50 hover:bg-gray-600 text-gray-300"
                              : "bg-gray-50 hover:bg-gray-100 text-slate-800 border border-gray-100"
                          }`}
                      >
                        <span className={!isToday && !isHoliday && isWeekend ? "text-rose-400" : ""}>
                          {day}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className={`mt-8 pt-6 border-t ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
                      <span className={`text-xs font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Public Holiday</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></div>
                      <span className={`text-xs font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Today</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      }

      case "individualAnalytics":
        return (
          <div className="p-6">
            <MyPerformance
              userEmail={selectedAnalysisEmail}
              userName={selectedAnalysisName}
              isDark={isDark}
              isManagerView={true}
              onBack={() => {
                setCurrentSection(analysisReturnTo || "employees");
                setAnalysisReturnTo(null);
              }}
            />
          </div>
        );

      case "departmentAnalytics":
        return (
          <div className="p-6">
            <DepartmentPerformance
              deptId={selectedDeptAnalysisId}
              deptName={selectedDeptAnalysisName}
              allUsers={allUsers}
              analyticsData={analyticsData}
              isDark={isDark}
              onBack={() => {
                setCurrentSection(analysisReturnTo || "departments");
                setAnalysisReturnTo(null);
              }}
            />
          </div>
        );

      case "activityMonitor":
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
              Company Activity Monitor
            </h1>
            <p
              className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"
                }`}
            >
              Live tracking and productivity analysis of all employees across
              all departments.
            </p>

            {/* Wahi Manager wala component Admin ke liye bhi perfect chalega! */}
            <ManagerActivityReport
              isDark={isDark}
              adminView={true}
              allUsers={allUsers}
            />
          </motion.div>
        );

      case "add_department":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`w-full max-w-5xl mx-auto rounded-3xl shadow-xl flex flex-col overflow-hidden ${isDark
              ? "bg-gray-800 border border-gray-700"
              : "bg-white border border-gray-100"
              }`}
          >
            <div
              className={`p-5 sm:p-6 flex items-center justify-between shrink-0 transition-all duration-300 bg-gradient-to-r from-blue-500 to-blue-600`}
            >
              <h2 className="text-2xl font-bold text-white flex items-center">
                <i
                  className={`fas ${editingDeptId ? "fa-edit" : "fa-plus-circle"
                    } mr-3`}
                ></i>
                {editingDeptId ? "Edit Department" : "Add Department"}
              </h2>
            </div>

            <div className="p-5 sm:p-6 flex-1">
              <form
                onSubmit={handleAddNewDepartment}
                className="space-y-4 sm:space-y-5"
              >
                <div>
                  <label
                    className={`block text-base font-semibold mb-3 ${isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                  >
                    Department Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newDept.name}
                    onChange={(e) =>
                      setNewDept({ ...newDept, name: e.target.value })
                    }
                    placeholder="e.g. Human Resources"
                    className={`w-full px-4 py-3 rounded-xl border-2 transition-all outline-none text-base ${isDark
                      ? "bg-gray-700 border-gray-600 focus:border-blue-500 text-white"
                      : "bg-gray-50 border-gray-200 focus:border-blue-500 text-gray-800"
                      }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label
                      className={`block text-base font-semibold mb-3 ${isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                    >
                      Icon Class (
                      <a
                        href="https://fontawesome.com/search?o=r&m=free"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        FontAwesome
                      </a>
                      )
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <i
                          className={`fas ${newDept.icon} text-blue-500 text-lg`}
                        ></i>
                      </div>
                      <input
                        type="text"
                        value={newDept.icon}
                        onChange={(e) =>
                          setNewDept({ ...newDept, icon: e.target.value })
                        }
                        onFocus={() => setShowIconPicker(true)}
                        onBlur={() =>
                          setTimeout(() => setShowIconPicker(false), 200)
                        }
                        className={`w-full pl-12 pr-10 py-3 rounded-xl border-2 transition-all outline-none text-base ${showIconPicker
                          ? "border-blue-500 ring-4 ring-blue-500/20"
                          : ""
                          } ${isDark
                            ? "bg-gray-700 border-gray-600 focus:border-blue-500 text-white"
                            : "bg-gray-50 border-gray-200 focus:border-blue-500 text-gray-800"
                          }`}
                        placeholder="e.g. fa-building"
                      />
                      <button
                        type="button"
                        onClick={() => setShowIconPicker(!showIconPicker)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <i
                          className={`fas fa-chevron-${showIconPicker ? "up" : "down"
                            }`}
                        ></i>
                      </button>

                      <AnimatePresence>
                        {showIconPicker && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`absolute z-[100] w-full mt-2 p-3 rounded-2xl shadow-2xl max-h-72 overflow-y-auto ${isDark
                              ? "bg-gray-800 border-[1px] border-gray-700"
                              : "bg-white border-[1px] border-gray-100"
                              }`}
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {FONT_AWESOME_ICONS.map((icon) => (
                                <button
                                  key={icon.class}
                                  type="button"
                                  onClick={() => {
                                    setNewDept({
                                      ...newDept,
                                      icon: icon.class,
                                    });
                                    setShowIconPicker(false);
                                  }}
                                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors text-sm font-medium ${newDept.icon === icon.class
                                    ? isDark
                                      ? "bg-blue-900/40 text-blue-400"
                                      : "bg-blue-50 text-blue-600"
                                    : isDark
                                      ? "hover:bg-gray-700 text-gray-300"
                                      : "hover:bg-gray-50 text-gray-700"
                                    }`}
                                >
                                  <i
                                    className={`fas ${icon.class} w-6 text-center text-lg`}
                                  ></i>
                                  <span className="truncate">{icon.name}</span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label
                        className={`block text-base font-semibold ${isDark ? "text-gray-300" : "text-gray-700"
                          }`}
                      >
                        Theme Color
                      </label>
                      <div
                        className={`w-6 h-6 rounded-full shadow-sm border ${newDept.color === "blue"
                          ? "bg-blue-500"
                          : newDept.color === "green"
                            ? "bg-emerald-500"
                            : newDept.color === "purple"
                              ? "bg-violet-500"
                              : newDept.color === "yellow"
                                ? "bg-amber-500"
                                : newDept.color === "red"
                                  ? "bg-rose-500"
                                  : newDept.color === "orange"
                                    ? "bg-orange-500"
                                    : newDept.color === "teal"
                                      ? "bg-teal-500"
                                      : "bg-gray-400"
                          }`}
                      ></div>
                    </div>
                    <select
                      value={newDept.color}
                      onChange={(e) =>
                        setNewDept({ ...newDept, color: e.target.value })
                      }
                      className={`w-full px-4 py-3 rounded-xl border-2 transition-all outline-none text-base cursor-pointer ${isDark
                        ? "bg-gray-700 border-gray-600 focus:border-blue-500 text-white"
                        : "bg-gray-50 border-gray-200 focus:border-blue-500 text-gray-800"
                        }`}
                    >
                      <option value="blue">Blue</option>
                      <option value="green">Green</option>
                      <option value="purple">Purple</option>
                      <option value="yellow">Yellow</option>
                      <option value="red">Red</option>
                      <option value="orange">Orange</option>
                      <option value="teal">Teal</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    className={`block text-base font-semibold mb-3 ${isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                  >
                    Description
                  </label>
                  <textarea
                    required
                    value={newDept.description}
                    onChange={(e) =>
                      setNewDept({ ...newDept, description: e.target.value })
                    }
                    placeholder="Brief description of the department's role..."
                    rows="4"
                    className={`w-full px-5 py-4 rounded-xl border-2 transition-all outline-none resize-none text-lg ${isDark
                      ? "bg-gray-700 border-gray-600 focus:border-blue-500 text-white"
                      : "bg-gray-50 border-gray-200 focus:border-blue-500 text-gray-800"
                      }`}
                  ></textarea>
                </div>

                <div className="pt-6 flex flex-col sm:flex-row gap-4">
                  <button
                    type="button"
                    onClick={() => setCurrentSection("departments")}
                    className={`flex-1 py-4 rounded-xl font-bold transition-all text-lg shadow-sm hover:shadow-md ${isDark
                      ? "bg-gray-700 hover:bg-gray-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                      }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingDept}
                    className={`flex-[2] py-4 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center transform hover:-translate-y-1 bg-gradient-to-r from-blue-500 to-blue-600 shadow-blue-500/30`}
                  >
                    {isAddingDept ? (
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-4 border-white/50 border-t-white rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </div>
                    ) : (
                      <span>
                        <i
                          className={`fas ${editingDeptId ? "fa-save" : "fa-plus"
                            } mr-3`}
                        ></i>{" "}
                        {editingDeptId ? "Save Changes" : "Create Department"}
                      </span>
                    )}
                  </button>
                </div>
              </form>
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
          onAddDepartment={() => {
            setEditingDeptId(null);
            setNewDept({
              name: "",
              icon: "fa-building",
              color: "blue",
              description: "",
            });
            setCurrentSection("add_department");
          }}
          onDeptAction={(action) => {
            setCurrentSection("departments");
            setDeptActionView(action);
          }}
        />
        <div
          className={`flex-1 overflow-y-auto scrollbar-hide p-4 pt-8 sm:p-6 sm:pt-10 md:p-8 md:pt-12 lg:p-8 relative min-w-0 w-full transition-all duration-300 ${isSidebarOpen ? "lg:ml-72" : "lg:ml-0"
            }`}
          style={{ height: "100vh" }}
        >
          {loadingData ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin"></div>
              <p
                className={`text-lg font-bold animate-pulse ${isDark ? "text-gray-300" : "text-gray-600"
                  }`}
              >
                Syncing organizational data...
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">{renderSection()}</AnimatePresence>
          )}
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
        isSidebarOpen={isSidebarOpen}
      />

      <SelectHolidaysModal
        isOpen={showSelectHolidaysModal}
        onClose={() => setShowSelectHolidaysModal(false)}
        currentHolidays={publicHolidays}
        onSaveSuccess={fetchDashboardData}
        isSidebarOpen={isSidebarOpen}
      />
    </>
  );
}
