import { useState, useEffect, useRef } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { DEPARTMENTS, WORK_TYPES, LATE_THRESHOLD_HOUR, LATE_THRESHOLD_MINUTE } from '../constants/config';
import { useTheme } from '../context/ThemeContext';
import ProfileModal from '../components/ProfileModal';

export default function ManagerDashboard({ auth, onLogout }) {
  const { isDark, toggleTheme } = useTheme();
  const [currentSection, setCurrentSection] = useState('pending');
  const [showProfile, setShowProfile] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeProfile, setShowEmployeeProfile] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toast, setToast] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
  const [isMenuVisible, setIsMenuVisible] = useState(true);
  const menuTimeoutRef = useRef(null);

  // Show menu after 1 second when cursor is in top-left area
  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      // Check if cursor is in top-left corner (within 100px from left and top)
      if (clientX < 100 && clientY < 100) {
        if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
        menuTimeoutRef.current = setTimeout(() => {
          setIsMenuVisible(true);
        }, 1000); // Show after 1 second
      } else {
        // Hide after 2 seconds when cursor leaves the area
        if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
        menuTimeoutRef.current = setTimeout(() => {
          setIsMenuVisible(false);
        }, 2000);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    };
  }, []);

  // Auto-hide menu button after 2 seconds initially
  useEffect(() => {
    const startHideTimer = () => {
      if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
      menuTimeoutRef.current = setTimeout(() => {
        setIsMenuVisible(false);
      }, 2000);
    };

    startHideTimer();

    return () => {
      if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    };
  }, [isSidebarOpen]);

  const handleMenuMouseEnter = () => {
    setIsMenuVisible(true);
    if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
  };

  const handleMenuMouseLeave = () => {
    if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    menuTimeoutRef.current = setTimeout(() => {
      setIsMenuVisible(false);
    }, 2000);
  };



  // Clock in/out states for manager
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState(null);
  const [workType, setWorkType] = useState(null);
  
  // Team filter state (for team section)
  const [teamFilter, setTeamFilter] = useState(null);
  
  // Attendance filter states (for attendance section)
  const [attendanceFilter, setAttendanceFilter] = useState(null);
  const [attendanceSubFilter, setAttendanceSubFilter] = useState('all');
  
  // Leave section state
  const [leaveFilter, setLeaveFilter] = useState('pending');

  // Manager's own leave request states
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveType, setLeaveType] = useState('sick');
  const [myLeaveFilter, setMyLeaveFilter] = useState('all');

  // Leave balance - 6 Sick Leave + 10 Casual Leave per year
  const LEAVE_BALANCE = {
    sick: { total: 6, name: 'Sick Leave', icon: 'fa-user-nurse' },
    casual: { total: 10, name: 'Casual Leave', icon: 'fa-umbrella-beach' }
  };

  // Time tracking states
  const [taskStartTime, setTaskStartTime] = useState('');
  const [taskEndTime, setTaskEndTime] = useState('');
  const [calculatedDuration, setCalculatedDuration] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    if (!date) return '--:--:--';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const formatTimeForInput = (date) => {
    if (!date) return '';
    return date.toTimeString().slice(0, 8);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const showToastMessage = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12
      }
    }
  };

  const cardHoverVariants = {
    rest: { scale: 1 },
    hover: { 
      scale: 1.02,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 17
      }
    }
  };


  const user = auth.currentUser;
  const userName = user ? `${user.firstName} ${user.lastName}` : 'Manager';
  const userInitial = user ? user.firstName.charAt(0).toUpperCase() : 'M';
  const dept = user.department;
  
  // Manager can only see their department employees (excluding themselves)
  const deptEmployees = auth.employees.filter(emp => 
    emp.department === dept && 
    emp.status === 'approved' && 
    emp.id !== user.id
  );
  const deptPending = auth.pendingRegistrations.filter(emp => emp.department === dept);
  
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = auth.workLogs.filter(log => log.department === dept && log.date === today);
  // Exclude manager from present count (only count employees)
  const presentIds = [...new Set(todayLogs.map(log => log.employeeId))].filter(id => id !== user.id);
  
  // Manager's own work logs
  const myWorkLogs = auth.workLogs.filter(log => log.employeeId === user.id && log.date === today);

  // Leave requests for this department
  const allLeaveRequests = auth.leaveRequests || [];
  const deptLeaveRequests = allLeaveRequests.filter(req => req.department === dept && req.employeeId !== user.id);
  const pendingLeaveRequests = deptLeaveRequests.filter(req => req.status === 'pending');
  
  // Employees on leave today in this department
  const employeesOnLeave = allLeaveRequests.filter(req => 
    req.status === 'approved' && 
    req.department === dept &&
    req.startDate <= today && 
    req.endDate >= today
  );

  // Get manager's own leave requests
  const myLeaveRequests = allLeaveRequests.filter(req => req.employeeId === user.id);
  const myPendingLeaveRequests = myLeaveRequests.filter(req => req.status === 'pending');
  
  const getUsedLeaves = (type) => {
    return myLeaveRequests.filter(req => req.leaveType === type && req.status === 'approved').length;
  };

  const handleSubmitLeaveRequest = (e) => {
    e.preventDefault();
    if (!leaveStartDate || !leaveEndDate || !leaveReason) {
      showToastMessage('Please fill all fields!', 'error');
      return;
    }
    if (new Date(leaveStartDate) > new Date(leaveEndDate)) {
      showToastMessage('End date must be after start date!', 'error');
      return;
    }
    
    const usedLeaves = getUsedLeaves(leaveType);
    const availableLeaves = LEAVE_BALANCE[leaveType].total - usedLeaves;
    
    if (availableLeaves <= 0) {
      showToastMessage(`No ${LEAVE_BALANCE[leaveType].name} available!`, 'error');
      return;
    }
    
    auth.submitLeaveRequest({
      employeeId: user.id,
      employeeName: `${user.firstName} ${user.lastName}`,
      department: user.department,
      startDate: leaveStartDate,
      endDate: leaveEndDate,
      reason: leaveReason,
      leaveType: leaveType,
      status: 'pending',
      isManager: true,
      role: user.role
    });
    showToastMessage('Leave request submitted!', 'success');
    setLeaveStartDate('');
    setLeaveEndDate('');
    setLeaveReason('');
  };

  // Filtered team list (for team section - just list, no attendance)
  const getFilteredTeamList = () => {
    if (!teamFilter) return deptEmployees;
    return deptEmployees;
  };

  // Filtered attendance list (for attendance section)
  const getAttendanceFilteredList = () => {
    if (!attendanceFilter) return [];
    
    if (attendanceFilter === 'present') {
      return deptEmployees.filter(emp => presentIds.includes(emp.id));
    } else if (attendanceFilter === 'absent') {
      return deptEmployees.filter(emp => !presentIds.includes(emp.id));
    } else if (attendanceFilter === 'onLeave') {
      if (attendanceSubFilter === 'all') {
        return employeesOnLeave;
      } else {
        return employeesOnLeave;
      }
    } else {
      return deptEmployees;
    }
  };

  const isLate = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    if (hours > LATE_THRESHOLD_HOUR) return true;
    if (hours === LATE_THRESHOLD_HOUR && minutes > LATE_THRESHOLD_MINUTE) return true;
    return false;
  };

  const handleClockIn = () => {
    setClockedIn(true);
    setClockInTime(new Date());
    const status = isLate() ? 'late' : 'present';
    auth.updateAttendance(user.id, status);
    showToastMessage('Clocked in successfully!', 'success');
  };

  const handleClockOut = () => {
    setClockedIn(false);
    setClockInTime(null);
    setTaskStartTime('');
    setTaskEndTime('');
    setCalculatedDuration('');
    showToastMessage('Clocked out successfully!', 'success');
  };

  const handleStartTimeChange = (e) => {
    const timeStr = e.target.value;
    setTaskStartTime(timeStr);
    calculateDuration(timeStr, taskEndTime);
  };

  const handleEndTimeChange = (e) => {
    const timeStr = e.target.value;
    setTaskEndTime(timeStr);
    calculateDuration(taskStartTime, timeStr);
  };

  const calculateDuration = (start, end) => {
    if (!start || !end) {
      setCalculatedDuration('');
      return;
    }
    
    const [startHour, startMin, startSec] = start.split(':').map(Number);
    const [endHour, endMin, endSec] = end.split(':').map(Number);
    
    const startTotalSec = startHour * 3600 + startMin * 60 + startSec;
    const endTotalSec = endHour * 3600 + endMin * 60 + endSec;
    
    let diffSec = endTotalSec - startTotalSec;
    if (diffSec < 0) {
      diffSec += 24 * 3600;
    }
    
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    
    setCalculatedDuration(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
  };

  const handleWorkLog = (e) => {
    e.preventDefault();
    
    if (!taskStartTime || !taskEndTime) {
      alert('Please select both start and end time!');
      return;
    }
    
    const [hours, mins] = calculatedDuration.split(':').map(Number);
    const totalHours = hours + mins / 60;
    
    const workEntry = {
      id: Date.now(),
      employeeId: user.id,
      employeeName: `${user.firstName} ${user.lastName}`,
      department: user.department,
      workType: workType,
      description: e.target.description.value,
      hours: totalHours,
      minutes: hours * 60 + mins,
      taskStartTime: taskStartTime,
      taskEndTime: taskEndTime,
      duration: calculatedDuration,
      date: today,
      clockInTime: clockInTime,
      createdAt: new Date().toISOString()
    };
    auth.addWorkLog(workEntry);
    e.target.reset();
    setTaskStartTime('');
    setTaskEndTime('');
    setCalculatedDuration('');
    showToastMessage('Work entry saved!', 'success');
  };

  const selectWorkType = (type) => {
    setWorkType(type);
  };

  const setCurrentAsStartTime = () => {
    setTaskStartTime(formatTimeForInput(new Date()));
    calculateDuration(formatTimeForInput(new Date()), taskEndTime);
  };

  const setCurrentAsEndTime = () => {
    setTaskEndTime(formatTimeForInput(new Date()));
    calculateDuration(taskStartTime, formatTimeForInput(new Date()));
  };

  const getEmployeeWorkLogs = (employeeId) => {
    return auth.workLogs.filter(log => log.employeeId === employeeId);
  };

  const viewEmployeeProfile = (employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeProfile(true);
  };

  const handleDeleteEmployee = (employeeId, employeeName) => {
    if (window.confirm(`Are you sure you want to remove ${employeeName}? This action cannot be undone.`)) {
      const result = auth.deleteEmployee(employeeId, user);
      if (result.success) {
        showToastMessage(result.message, 'success');
      } else {
        showToastMessage(result.message, 'error');
      }
    }
  };

  const handleApproveLeave = (requestId) => {
    auth.approveLeaveRequest(requestId);
    showToastMessage('Leave request approved!', 'success');
  };

  const handleRejectLeave = (requestId) => {
    auth.rejectLeaveRequest(requestId);
    showToastMessage('Leave request rejected!', 'success');
  };

  const renderSection = () => {
    switch(currentSection) {
      case 'pending':
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
              className={`rounded-2xl p-6 shadow-lg border ${
                isDark 
                  ? 'bg-gradient-to-r from-gray-800 to-gray-700 border-gray-600' 
                  : 'bg-gradient-to-r from-violet-50 via-purple-50 to-pink-50 border-purple-100'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    Welcome, {user ? user.firstName : 'Manager'}! 👋
                  </h1>
                  <p className={isDark ? 'text-gray-400 mt-1' : 'text-gray-500 mt-1'}>{formatDate(currentTime)}</p>
                </div>
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl px-6 py-3 shadow-lg"
                >
                  <p className="text-white text-2xl font-mono font-bold">{formatTime(currentTime)}</p>
                </motion.div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-6 shadow-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-100'
              }`}
            >
              <h2 className={`text-xl font-bold mb-4 flex items-center ${isDark ? 'text-violet-400' : 'text-purple-600'}`}>
                <i className="fas fa-user-plus mr-2"></i>
                Pending Employee Approvals ({deptPending.length})
              </h2>
              {deptPending.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-check-circle text-4xl text-white"></i>
                  </div>
                  <p className={isDark ? 'text-gray-400 text-lg' : 'text-gray-500 text-lg'}>No pending approvals</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deptPending.map((emp, index) => (
                    <motion.div 
                      key={emp.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.01 }}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        isDark 
                          ? 'bg-gray-700 border-gray-600' 
                          : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <div>
                          <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{emp.firstName} {emp.lastName}</p>
                          <p className={isDark ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>{emp.email}</p>
                          <p className={isDark ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>{emp.phone}</p>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => auth.approveEmployee(auth.pendingRegistrations.indexOf(emp))}
                          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl shadow-lg"
                        >
                          <i className="fas fa-check mr-2"></i>Approve
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => auth.rejectEmployee(auth.pendingRegistrations.indexOf(emp))}
                          className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl shadow-lg"
                        >
                          <i className="fas fa-times mr-2"></i>Reject
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        );

      case 'myLeave':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <motion.h1 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}
            >
              My Leave
            </motion.h1>
            
            {/* Leave Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(LEAVE_BALANCE).map(([type, data]) => {
                const used = getUsedLeaves(type);
                const remaining = data.total - used;
                return (
                  <motion.div 
                    key={type}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl p-6 shadow-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          type === 'sick' ? 'bg-gradient-to-br from-rose-400 to-red-500' : 'bg-gradient-to-br from-blue-400 to-cyan-500'
                        }`}>
                          <i className={`fas ${data.icon} text-white text-xl`}></i>
                        </div>
                        <div>
                          <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{data.name}</h3>
                          <p className={isDark ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>Per Year</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-3xl font-bold ${remaining > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{remaining}</p>
                        <p className={isDark ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>Available</p>
                      </div>
                    </div>
                    <div className={`h-3 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      <div 
                        className={`h-3 rounded-full ${
                          type === 'sick' ? 'bg-gradient-to-r from-rose-400 to-red-500' : 'bg-gradient-to-r from-blue-400 to-cyan-500'
                        }`}
                        style={{ width: `${(used / data.total) * 100}%`, maxWidth: '100%' }}
                      ></div>
                    </div>
                    <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Used: {used} / {data.total}
                    </p>
                  </motion.div>
                );
              })}
            </div>
            
            {/* Leave Request Form */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-6 shadow-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
            >
              <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                <i className="fas fa-calendar-plus mr-2"></i>Submit Leave Request
              </h2>
              <form onSubmit={handleSubmitLeaveRequest} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Leave Type</label>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(LEAVE_BALANCE).map(([type, data]) => {
                      const used = getUsedLeaves(type);
                      const remaining = data.total - used;
                      const isAvailable = remaining > 0;
                      return (
                        <motion.button
                          key={type}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setLeaveType(type)}
                          disabled={!isAvailable}
                          className={`p-4 rounded-xl border-2 text-left transition ${
                            leaveType === type 
                              ? (type === 'sick' ? 'border-rose-500 bg-rose-50' : 'border-blue-500 bg-blue-50')
                              : isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-200'
                          } ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              type === 'sick' ? 'bg-gradient-to-br from-rose-400 to-red-500' : 'bg-gradient-to-br from-blue-400 to-cyan-500'
                            }`}>
                              <i className={`fas ${data.icon} text-white`}></i>
                            </div>
                            <div>
                              <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{data.name}</p>
                              <p className={`text-sm ${isAvailable ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {remaining} available
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Start Date</label>
                    <input 
                      type="date" 
                      value={leaveStartDate}
                      onChange={(e) => setLeaveStartDate(e.target.value)}
                      required
                      className={`w-full px-4 py-3 border-2 rounded-xl ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>End Date</label>
                    <input 
                      type="date" 
                      value={leaveEndDate}
                      onChange={(e) => setLeaveEndDate(e.target.value)}
                      required
                      className={`w-full px-4 py-3 border-2 rounded-xl ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'}`}
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Reason</label>
                  <textarea 
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    rows="3"
                    required
                    className={`w-full px-4 py-3 border-2 rounded-xl ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'}`}
                    placeholder="Enter reason for leave..."
                  ></textarea>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-violet-500 to-purple-600 text-white py-4 rounded-xl font-bold">
                  <i className="fas fa-paper-plane mr-2"></i>Submit Request
                </button>
              </form>
            </motion.div>

            {/* Leave History */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-6 shadow-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
            >
              <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                <i className="fas fa-history mr-2"></i>Leave History
              </h2>
              <div className="flex gap-3 mb-4">
                <button onClick={() => setMyLeaveFilter('all')} className={`px-4 py-2 rounded-xl ${myLeaveFilter === 'all' ? 'bg-violet-500 text-white' : (isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700')}`}>
                  All ({myLeaveRequests.length})
                </button>
                <button onClick={() => setMyLeaveFilter('pending')} className={`px-4 py-2 rounded-xl ${myLeaveFilter === 'pending' ? 'bg-amber-500 text-white' : (isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700')}`}>
                  Pending ({myPendingLeaveRequests.length})
                </button>
                <button onClick={() => setMyLeaveFilter('approved')} className={`px-4 py-2 rounded-xl ${myLeaveFilter === 'approved' ? 'bg-emerald-500 text-white' : (isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700')}`}>
                  Approved ({myLeaveRequests.filter(r => r.status === 'approved').length})
                </button>
              </div>
              {(myLeaveFilter === 'all' ? myLeaveRequests : myLeaveFilter === 'pending' ? myPendingLeaveRequests : myLeaveRequests.filter(r => r.status === 'approved')).length === 0 ? (
                <p className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No leave requests</p>
              ) : (
                <div className="space-y-3">
                  {(myLeaveFilter === 'all' ? myLeaveRequests : myLeaveFilter === 'pending' ? myPendingLeaveRequests : myLeaveRequests.filter(r => r.status === 'approved')).map((req) => (
                    <div key={req.id} className={`p-4 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            req.leaveType === 'sick' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {LEAVE_BALANCE[req.leaveType]?.name}
                          </span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs ${req.status === 'pending' ? 'bg-amber-100 text-amber-700' : req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {req.status}
                        </span>
                      </div>
                      <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{req.startDate} - {req.endDate}</p>
                      <p className={isDark ? 'text-gray-300 text-sm' : 'text-gray-600 text-sm'}>{req.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        );

      case 'leave':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <motion.h1 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}
            >
              Leave Requests - {DEPARTMENTS[dept]?.name}
            </motion.h1>
            
            <div className="flex gap-3 mb-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLeaveFilter('pending')}
                className={`px-6 py-2.5 rounded-xl font-bold ${
                  leaveFilter === 'pending' 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' 
                    : isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                }`}
              >
                <i className="fas fa-clock mr-2"></i>Pending ({pendingLeaveRequests.length})
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLeaveFilter('all')}
                className={`px-6 py-2.5 rounded-xl font-bold ${
                  leaveFilter === 'all' 
                    ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white' 
                    : isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                }`}
              >
                <i className="fas fa-list mr-2"></i>All ({deptLeaveRequests.length})
              </motion.button>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-6 shadow-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-100'
              }`}
            >
              {leaveFilter === 'pending' && pendingLeaveRequests.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-check-circle text-4xl text-white"></i>
                  </div>
                  <p className={isDark ? 'text-gray-400 text-lg' : 'text-gray-500 text-lg'}>No pending leave requests</p>
                </div>
              )}

              {leaveFilter === 'all' && deptLeaveRequests.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-calendar-times text-4xl text-white"></i>
                  </div>
                  <p className={isDark ? 'text-gray-400 text-lg' : 'text-gray-500 text-lg'}>No leave requests yet</p>
                </div>
              )}

              <div className="space-y-4">
                {(leaveFilter === 'pending' ? pendingLeaveRequests : deptLeaveRequests).map((req, index) => {
                  const emp = auth.employees.find(e => e.id === req.employeeId);
                  if (!emp) return null;
                  const leaveTypeName = req.leaveType === 'sick' ? 'Sick Leave' : 'Casual Leave';
                  return (
                    <motion.div 
                      key={req.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-4 rounded-xl border ${
                        isDark ? 'bg-gray-700 border-gray-600' : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                          <div>
                            <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{emp.firstName} {emp.lastName}</p>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{emp.email}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      </div>
                      
                      <div className={`p-3 rounded-lg mb-3 ${isDark ? 'bg-gray-600' : 'bg-white'}`}>
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          <strong>Reason:</strong> {req.reason}
                        </p>
                        <p className={`text-sm mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          <strong>Dates:</strong> {req.startDate} to {req.endDate}
                        </p>
                      </div>
                      
                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <motion.button 
                            whileHover={{ scale: 1.05 }} 
                            whileTap={{ scale: 0.95 }} 
                            onClick={() => handleApproveLeave(req.id)}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-lg font-medium"
                          >
                            <i className="fas fa-check mr-2"></i>Approve
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.05 }} 
                            whileTap={{ scale: 0.95 }} 
                            onClick={() => handleRejectLeave(req.id)}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-lg font-medium"
                          >
                            <i className="fas fa-times mr-2"></i>Reject
                          </motion.button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        );

      case 'myWork':
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
              className={`rounded-2xl p-6 shadow-lg border ${
                isDark 
                  ? 'bg-gradient-to-r from-gray-800 to-gray-700 border-gray-600' 
                  : 'bg-gradient-to-r from-violet-50 via-purple-50 to-pink-50 border-purple-100'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Log Your Work</h1>
                  <p className={isDark ? 'text-gray-400 mt-1' : 'text-gray-500 mt-1'}>{formatDate(currentTime)}</p>
                </div>
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl px-6 py-3 shadow-lg"
                >
                  <p className="text-white text-xs font-medium">Current Time</p>
                  <p className="text-white text-2xl font-mono font-bold">{formatTime(currentTime)}</p>
                </motion.div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-6 shadow-lg text-white"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-violet-100 text-sm">Current Status</p>
                  <p className="text-2xl font-bold">{clockedIn ? '🟢 Clocked In' : '🔴 Not Clocked In'}</p>
                  <p className="text-violet-100">{formatTime(currentTime)}</p>
                </div>
                {!clockedIn ? (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClockIn} 
                    className="px-6 py-3 bg-white text-purple-600 rounded-lg font-bold hover:bg-purple-50 shadow-lg"
                  >
                    <i className="fas fa-sign-in-alt mr-2"></i> Clock In
                  </motion.button>
                ) : (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClockOut} 
                    className="px-6 py-3 bg-white text-rose-500 rounded-lg font-bold hover:bg-rose-50 shadow-lg"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i> Clock Out
                  </motion.button>
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`rounded-2xl p-6 shadow-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-100'
              }`}
            >
              <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>Select Work Type</h2>
              <div className="grid grid-cols-2 gap-4">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectWorkType('office')}
                  className={`p-6 border-2 rounded-xl text-center transition ${
                    workType === 'office' 
                      ? 'border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50' 
                      : isDark 
                        ? 'border-gray-600 hover:bg-gray-700'
                        : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-briefcase text-white text-2xl"></i>
                  </div>
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Office Work</p>
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectWorkType('non_office')}
                  className={`p-6 border-2 rounded-xl text-center transition ${
                    workType === 'non_office' 
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50' 
                      : isDark 
                        ? 'border-gray-600 hover:bg-gray-700'
                        : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-laptop text-white text-2xl"></i>
                  </div>
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Non-Office Work</p>
                </motion.button>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`rounded-2xl p-6 shadow-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-100'
              }`}
            >
              <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>Add Work Entry</h2>
              <form onSubmit={handleWorkLog} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Work Description</label>
                  <textarea 
                    name="description" 
                    rows="4" 
                    required 
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 transition-all ${
                      isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'
                    }`}
                    placeholder="Describe your work..."
                  ></textarea>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Task Start Time</label>
                    <div className="flex gap-2">
                      <input 
                        type="time" 
                        value={taskStartTime}
                        onChange={handleStartTimeChange}
                        required
                        className={`flex-1 px-3 py-2.5 border-2 rounded-xl focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 transition-all ${
                          isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'
                        }`}
                      />
                      <motion.button 
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={setCurrentAsStartTime}
                        className="px-3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-sm"
                      >
                        <i className="fas fa-clock"></i>
                      </motion.button>
                    </div>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Task Complete Time</label>
                    <div className="flex gap-2">
                      <input 
                        type="time" 
                        value={taskEndTime}
                        onChange={handleEndTimeChange}
                        required
                        className={`flex-1 px-3 py-2.5 border-2 rounded-xl focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 transition-all ${
                          isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'
                        }`}
                      />
                      <motion.button 
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={setCurrentAsEndTime}
                        className="px-3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-sm"
                      >
                        <i className="fas fa-clock"></i>
                      </motion.button>
                    </div>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Time Taken</label>
                    <div className="px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl text-white font-mono font-bold text-center">
                      {calculatedDuration || '00:00:00'}
                    </div>
                  </div>
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit" 
                  className="w-full bg-gradient-to-r from-violet-500 to-purple-600 text-white py-4 rounded-xl font-bold hover:shadow-xl transition-all"
                >
                  <i className="fas fa-save mr-2"></i> Save Entry
                </motion.button>
              </form>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`rounded-2xl p-6 shadow-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-100'
              }`}
            >
              <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>Today's Work History</h2>
              {myWorkLogs.length === 0 ? (
                <div className="text-center py-12">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <i className={`fas fa-clipboard-list text-4xl ${isDark ? 'text-gray-500' : 'text-gray-400'}`}></i>
                  </div>
                  <p className={isDark ? 'text-gray-400 text-lg' : 'text-gray-500 text-lg'}>No work entries today</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myWorkLogs.map((log, index) => (
                    <motion.div 
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-4 rounded-xl border ${
                        isDark 
                          ? 'bg-gray-700 border-gray-600' 
                          : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{WORK_TYPES[log.workType]?.name}</span>
                        <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">
                          {log.duration || (log.minutes ? `${log.minutes} min` : `${log.hours} hours`)}
                        </span>
                      </div>
                      {log.taskStartTime && log.taskEndTime && (
                        <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          <i className="fas fa-clock mr-1"></i>
                          {log.taskStartTime} - {log.taskEndTime}
                        </p>
                      )}
                      <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>{log.description}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        );

      case 'team':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <motion.h1 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}
            >
              My Team - {DEPARTMENTS[dept]?.name}
            </motion.h1>
            
            <div className="grid grid-cols-1 gap-4 mb-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl p-6 text-white shadow-lg`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100">Total Team Members</p>
                    <p className="text-4xl font-bold">{deptEmployees.length}</p>
                  </div>
                  <i className="fas fa-users text-5xl opacity-50"></i>
                </div>
              </motion.div>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`rounded-2xl p-6 shadow-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-100'
              }`}
            >
              <h2 className={`text-xl font-bold mb-4 flex items-center ${isDark ? 'text-white' : 'text-gray-800'}`}>
                <i className="fas fa-users mr-2"></i>
                Team Members List ({deptEmployees.length})
              </h2>
              {deptEmployees.length === 0 ? (
                <p className={isDark ? 'text-gray-400 text-center py-8' : 'text-gray-500 text-center py-8'}>No team members</p>
              ) : (
                <div className="space-y-3">
                  {deptEmployees.map((emp, index) => (
                    <motion.div 
                      key={emp.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        isDark 
                          ? 'bg-gray-700 border-gray-600' 
                          : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <motion.div 
                          whileHover={{ scale: 1.1 }}
                          onClick={() => viewEmployeeProfile(emp)}
                          className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold cursor-pointer"
                        >
                          {emp.firstName[0]}{emp.lastName[0]}
                        </motion.div>
                        <div>
                          <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{emp.firstName} {emp.lastName}</p>
                          <p className={isDark ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>{emp.email}</p>
                          <p className={isDark ? 'text-gray-500 text-sm' : 'text-gray-400 text-sm'}>{emp.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => viewEmployeeProfile(emp)}
                          className="px-2 py-1 sm:px-3 sm:py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap"
                        >
                          <i className="fas fa-eye sm:mr-1"></i><span className="hidden sm:inline">View</span>
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDeleteEmployee(emp.id, `${emp.firstName} ${emp.lastName}`)}
                          className="px-2 py-1 sm:px-3 sm:py-1.5 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap"
                        >
                          <i className="fas fa-trash sm:mr-1"></i><span className="hidden sm:inline">Remove</span>
                        </motion.button>
                      </div>

                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        );

      case 'attendance':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <motion.h1 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}
            >
              Team Attendance - {DEPARTMENTS[dept]?.name}
            </motion.h1>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.1 }} 
                whileHover={{ scale: 1.05 }}
                onClick={() => { setAttendanceFilter(attendanceFilter === 'present' ? null : 'present'); }}
                className={`bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer ${attendanceFilter === 'present' ? 'ring-4 ring-white' : ''}`}
              >
                <p className="text-3xl font-bold">{presentIds.length}</p>
                <p className="text-white/80">Present</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.2 }} 
                whileHover={{ scale: 1.05 }}
                onClick={() => { setAttendanceFilter(attendanceFilter === 'absent' ? null : 'absent'); }}
                className={`bg-gradient-to-br from-rose-400 to-red-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer ${attendanceFilter === 'absent' ? 'ring-4 ring-white' : ''}`}
              >
                <p className="text-3xl font-bold">{deptEmployees.length - presentIds.length}</p>
                <p className="text-white/80">Absent</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.25 }} 
                whileHover={{ scale: 1.05 }}
                onClick={() => { setAttendanceFilter(attendanceFilter === 'onLeave' ? null : 'onLeave'); }}
                className={`bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white shadow-lg cursor-pointer ${attendanceFilter === 'onLeave' ? 'ring-4 ring-white' : ''}`}
              >
                <p className="text-3xl font-bold">{employeesOnLeave.length}</p>
                <p className="text-white/80">On Leave</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.3 }} 
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-violet-400 to-purple-600 rounded-2xl p-6 text-white shadow-lg"
              >
                <p className="text-3xl font-bold">{Math.round((presentIds.length / deptEmployees.length) * 100) || 0}%</p>
                <p className="text-white/80">Attendance</p>
              </motion.div>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className={`rounded-2xl p-6 shadow-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
            >
              {getAttendanceFilteredList().length === 0 ? (
                <p className={isDark ? 'text-gray-400 text-center py-8' : 'text-gray-500 text-center py-8'}>
                  {attendanceFilter === 'present' ? 'No employees present today' : 
                   attendanceFilter === 'absent' ? 'No employees absent today' : 
                   attendanceFilter === 'onLeave' ? 'No employees on leave today' : 
                   'No employees found'}
                </p>
              ) : (
                <div className="space-y-3">
                  {getAttendanceFilteredList().map((item) => {
                    const emp = item.employeeId ? auth.employees.find(e => e.id === item.employeeId) : item;
                    if (!emp) return null;
                    return (
                      <div key={emp.id} className={`flex items-center justify-between p-4 rounded-xl border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-violet-500 to-purple-500">
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                          <div>
                            <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{emp.firstName} {emp.lastName}</p>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{emp.email}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          attendanceFilter === 'onLeave' 
                            ? 'bg-amber-100 text-amber-700'
                            : presentIds.includes(emp.id) 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-rose-100 text-rose-700'
                        }`}>
                          {attendanceFilter === 'onLeave' ? '✓ On Leave' : presentIds.includes(emp.id) ? '✓ Present' : '✗ Absent'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        );

      case 'reports':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h1 className={`text-3xl font-bold mb-8 ${isDark ? 'text-white' : 'text-gray-800'}`}>Team Reports</h1>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-6 shadow-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-100'
              }`}
            >
              <h2 className={`text-xl font-bold mb-4 flex items-center ${isDark ? 'text-white' : 'text-gray-800'}`}>
                <i className="fas fa-clipboard-list mr-2"></i>
                Today's Work Report
              </h2>
              {todayLogs.length === 0 ? (
                <div className="text-center py-12">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <i className={`fas fa-clipboard-list text-4xl ${isDark ? 'text-gray-500' : 'text-gray-400'}`}></i>
                  </div>
                  <p className={isDark ? 'text-gray-400 text-lg' : 'text-gray-500 text-lg'}>No work entries today</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todayLogs.map((log, index) => (
                    <motion.div 
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-4 rounded-xl border ${
                        isDark 
                          ? 'bg-gray-700 border-gray-600' 
                          : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{log.employeeName}</span>
                        <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">
                          {log.minutes ? `${log.minutes} min` : `${log.hours} hours`}
                        </span>
                      </div>
                      <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>{log.description}</p>
                      <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {log.workType} - {new Date(log.createdAt).toLocaleTimeString()}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        );

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
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            } text-white`}
          >
            <div className="flex items-center gap-2">
              <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      <div className={`flex min-h-screen ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
          : 'bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50'
      }`}>
        {/* Mobile Hamburger Button */}
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: isMenuVisible ? 0 : -100 }}
          transition={{ duration: 0.3 }}
          onMouseEnter={handleMenuMouseEnter}
          onMouseLeave={handleMenuMouseLeave}
          className="fixed top-4 left-0 z-50 p-4 w-20 h-20 cursor-pointer"
          style={{ pointerEvents: isMenuVisible ? 'auto' : 'none' }}
        >
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-3 rounded-xl shadow-lg ${
              isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
            }`}
          >
            <i className={`fas ${isSidebarOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
          </motion.button>
        </motion.div>
        




        {/* Mobile Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            />
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: isSidebarOpen ? 0 : -300, opacity: isSidebarOpen ? 1 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={`fixed left-0 top-0 h-full w-full lg:w-64 shadow-2xl p-4 flex flex-col z-40 border-r overflow-y-auto scrollbar-hide ${
            isDark 
              ? 'bg-gradient-to-b from-gray-800 to-gray-900 border-gray-700' 
              : 'bg-gradient-to-b from-white to-violet-50 border-violet-100'
          }`}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >


          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className={`mx-auto mb-4 px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all ${
              isDark 
                ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' 
                : 'bg-violet-100 text-gray-700 hover:bg-violet-200'
            }`}
          >
            <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`}></i>
            {isDark ? 'Light' : 'Dark'}
          </motion.button>

          <div className="text-center mb-8 pt-2">
            <motion.div 
              whileHover={{ scale: 1.1 }}
              onClick={() => setShowProfile(true)}
              className="w-24 h-24 bg-gradient-to-br from-violet-400 via-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg border-4 border-white cursor-pointer"
            >
              <span className="text-4xl font-bold text-white">{userInitial}</span>
            </motion.div>
            <h2 className={`font-bold text-xl ${isDark ? 'text-white' : 'text-gray-800'}`}>{userName}</h2>
            <p className={`text-sm font-medium ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{DEPARTMENTS[dept]?.name}</p>
          </div>
          
          <nav className="flex-1 space-y-2 px-2 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              onClick={() => { setCurrentSection('pending'); setAttendanceFilter(null); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center justify-between ${
                currentSection === 'pending' 
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg' 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-violet-50 text-gray-700'
              }`}
            >
              <span className="flex items-center gap-3"><i className="fas fa-user-plus w-5"></i> Pending</span>
              {deptPending.length > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">{deptPending.length}</span>
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              onClick={() => { setCurrentSection('myLeave'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${
                currentSection === 'myLeave' 
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg' 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-violet-50 text-gray-700'
              }`}
            >
              <i className="fas fa-calendar-minus w-5"></i> My Leave
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              onClick={() => { setCurrentSection('leave'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center justify-between ${
                currentSection === 'leave' 
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg' 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-violet-50 text-gray-700'
              }`}
            >
              <span className="flex items-center gap-3"><i className="fas fa-calendar-check w-5"></i> Leave Requests</span>
              {pendingLeaveRequests.length > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">{pendingLeaveRequests.length}</span>
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              onClick={() => { setCurrentSection('myWork'); setAttendanceFilter(null); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${
                currentSection === 'myWork' 
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg' 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-violet-50 text-gray-700'
              }`}
            >
              <i className="fas fa-clock w-5"></i> My Work
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              onClick={() => { setCurrentSection('team'); setAttendanceFilter(null); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${
                currentSection === 'team' 
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg' 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-violet-50 text-gray-700'
              }`}
            >
              <i className="fas fa-users w-5"></i> My Team
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              onClick={() => { setCurrentSection('attendance'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${
                currentSection === 'attendance' 
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg' 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-violet-50 text-gray-700'
              }`}
            >
              <i className="fas fa-calendar-check w-5"></i> Attendance
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              onClick={() => { setCurrentSection('reports'); setAttendanceFilter(null); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${
                currentSection === 'reports' 
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg' 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-violet-50 text-gray-700'
              }`}
            >
              <i className="fas fa-file-pdf w-5"></i> Reports
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              onClick={() => { setShowProfile(true); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${
                currentSection === 'profile' 
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg' 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-violet-50 text-gray-700'
              }`}
            >
              <i className="fas fa-user-circle w-5"></i> My Profile
            </motion.button>
          </nav>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onLogout} 
            className={`w-full text-left px-4 py-3.5 rounded-xl transition-all mt-4 ${
              isDark
                ? 'bg-gray-800 hover:bg-red-900/50 text-gray-200 hover:text-red-400'
                : 'bg-white hover:bg-red-50 text-gray-700 hover:text-red-600'
            }`}
          >
            <i className="fas fa-sign-out-alt w-5"></i> Logout
          </motion.button>
        </motion.div>

        <div className={`flex-1 overflow-y-auto p-4 sm:p-8 relative w-full transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`} style={{ height: '100vh' }}>
          <AnimatePresence mode="wait">
            {renderSection()}
          </AnimatePresence>
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
        workLogs={selectedEmployee ? getEmployeeWorkLogs(selectedEmployee.id) : []}
      />
    </>
  );
}
