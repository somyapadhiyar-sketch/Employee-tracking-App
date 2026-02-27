import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEPARTMENTS, WORK_TYPES, LATE_THRESHOLD_HOUR, LATE_THRESHOLD_MINUTE } from '../constants/config';
import { useTheme } from '../context/ThemeContext';
import ProfileModal from '../components/ProfileModal';

export default function EmployeeDashboard({ auth, onLogout }) {
  const { isDark, toggleTheme } = useTheme();
  const [currentSection, setCurrentSection] = useState('workLog');
  const [showProfile, setShowProfile] = useState(false);
  const [workType, setWorkType] = useState(null);
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Time tracking states
  const [taskStartTime, setTaskStartTime] = useState('');
  const [taskEndTime, setTaskEndTime] = useState('');
  const [calculatedDuration, setCalculatedDuration] = useState('');
  
  // Leave request states
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveType, setLeaveType] = useState('sick');
  const [leaveFilter, setLeaveFilter] = useState('all');
  
  // Toast notification
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



  // Leave balance - 6 Sick Leave + 10 Casual Leave per year
  const LEAVE_BALANCE = {
    sick: { total: 6, name: 'Sick Leave', icon: 'fa-user-nurse' },
    casual: { total: 10, name: 'Casual Leave', icon: 'fa-umbrella-beach' }
  };

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


  const user = auth.currentUser;
  const today = new Date().toISOString().split('T')[0];
  const myWorkLogs = auth.workLogs.filter(log => log.employeeId === user.id && log.date === today);
  
  // Get user's leave requests
  const allLeaveRequests = auth.leaveRequests || [];
  const myLeaveRequests = allLeaveRequests.filter(req => req.employeeId === user.id);
  const myPendingLeaveRequests = myLeaveRequests.filter(req => req.status === 'pending');
  const myApprovedLeaveRequests = myLeaveRequests.filter(req => req.status === 'approved');

  // Calculate used leaves
  const getUsedLeaves = (type) => {
    return myApprovedLeaveRequests.filter(req => req.leaveType === type).length;
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
    setClockInTime(formatTime(currentTime));
    showToastMessage('Clocked in successfully!', 'success');
  };

  const handleClockOut = () => {
    setClockedIn(false);
    showToastMessage('Clocked out successfully!', 'success');
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
    
    // Check leave balance
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
      isManager: false,
      role: user.role
    });
    showToastMessage('Leave request submitted!', 'success');
    setLeaveStartDate('');
    setLeaveEndDate('');
    setLeaveReason('');
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
    alert('Work entry saved!');
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

  const renderSection = () => {
    switch(currentSection) {
      case 'workLog':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Welcome & Clock */}
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-6 shadow-lg border ${
                isDark 
                  ? 'bg-gradient-to-r from-gray-800 to-gray-700 border-gray-600' 
                  : 'bg-gradient-to-r from-blue-50 via-cyan-50 to-teal-50 border-blue-100'
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
                  className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl px-6 py-3 shadow-lg"
                >
                  <p className="text-white text-xs font-medium">Current Time</p>
                  <p className="text-white text-2xl font-mono font-bold">{formatTime(currentTime)}</p>
                </motion.div>
              </div>
            </motion.div>
            
            {/* Clock In/Out Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl p-6 shadow-lg text-white"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Current Status</p>
                  <p className="text-2xl font-bold">{clockedIn ? '🟢 Clocked In' : '🔴 Not Clocked In'}</p>
                  <p className="text-blue-100">{formatTime(currentTime)}</p>
                </div>
                {!clockedIn ? (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClockIn} 
                    className="px-6 py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 shadow-lg"
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

            {/* Work Type Selection */}
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
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50' 
                      : isDark 
                        ? 'border-gray-600 hover:bg-gray-700'
                        : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-briefcase text-white text-2xl"></i>
                  </div>
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Office Work</p>
                  <p className={isDark ? 'text-gray-400 text-sm' : 'text-sm text-gray-500'}>Work done in office</p>
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectWorkType('non_office')}
                  className={`p-6 border-2 rounded-xl text-center transition ${
                    workType === 'non_office' 
                      ? 'border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50' 
                      : isDark 
                        ? 'border-gray-600 hover:bg-gray-700'
                        : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-laptop text-white text-2xl"></i>
                  </div>
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Non-Office Work</p>
                  <p className={isDark ? 'text-gray-400 text-sm' : 'text-sm text-gray-500'}>Remote work</p>
                </motion.button>
              </div>
              <p className={`text-sm mt-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Selected: <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{workType ? WORK_TYPES[workType].name : 'None'}</span></p>
            </motion.div>

            {/* Work Entry Form with Time Selection */}
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
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all ${
                      isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'
                    }`}
                    placeholder="Describe your work..."
                  ></textarea>
                </div>
                
                {/* Time Selection - Task Start & End */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Task Start Time */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Task Start Time</label>
                    <div className="flex gap-2">
                      <input 
                        type="time" 
                        value={taskStartTime}
                        onChange={handleStartTimeChange}
                        required
                        className={`flex-1 px-3 py-2.5 border-2 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all ${
                          isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'
                        }`}
                      />
                      <motion.button 
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={setCurrentAsStartTime}
                        className="px-3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-sm"
                        title="Set current time"
                      >
                        <i className="fas fa-clock"></i>
                      </motion.button>
                    </div>
                  </div>
                  
                  {/* Task End Time */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Task Complete Time</label>
                    <div className="flex gap-2">
                      <input 
                        type="time" 
                        value={taskEndTime}
                        onChange={handleEndTimeChange}
                        required
                        className={`flex-1 px-3 py-2.5 border-2 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all ${
                          isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-200'
                        }`}
                      />
                      <motion.button 
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={setCurrentAsEndTime}
                        className="px-3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-sm"
                        title="Set current time"
                      >
                        <i className="fas fa-clock"></i>
                      </motion.button>
                    </div>
                  </div>
                  
                  {/* Calculated Duration */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Time Taken</label>
                    <div className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white font-mono font-bold text-center">
                      {calculatedDuration || '00:00:00'}
                    </div>
                  </div>
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit" 
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-4 rounded-xl font-bold hover:shadow-xl transition-all"
                >
                  <i className="fas fa-save mr-2"></i> Save Entry
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        );

      case 'myReports':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h1 className={`text-3xl font-bold mb-8 ${isDark ? 'text-white' : 'text-gray-800'}`}>My Reports</h1>
            <div className={`rounded-2xl p-6 shadow-lg border ${
              isDark 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-100'
            }`}>
              <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>Today's Work History</h2>
              {myWorkLogs.length === 0 ? (
                <div className="text-center py-12">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
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
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
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
            </div>
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
              Leave Requests
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
                    className={`rounded-2xl p-6 shadow-lg border ${
                      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          type === 'sick' 
                            ? 'bg-gradient-to-br from-rose-400 to-red-500' 
                            : 'bg-gradient-to-br from-blue-400 to-cyan-500'
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
                          type === 'sick' 
                            ? 'bg-gradient-to-r from-rose-400 to-red-500' 
                            : 'bg-gradient-to-r from-blue-400 to-cyan-500'
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
                {/* Leave Type Selection */}
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
                              : isDark 
                                ? 'border-gray-600 bg-gray-700' 
                                : 'border-gray-200'
                          } ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              type === 'sick' 
                                ? 'bg-gradient-to-br from-rose-400 to-red-500' 
                                : 'bg-gradient-to-br from-blue-400 to-cyan-500'
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
                <button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-4 rounded-xl font-bold">
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
                <button onClick={() => setLeaveFilter('all')} className={`px-4 py-2 rounded-xl ${leaveFilter === 'all' ? 'bg-blue-500 text-white' : (isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700')}`}>
                  All ({myLeaveRequests.length})
                </button>
                <button onClick={() => setLeaveFilter('pending')} className={`px-4 py-2 rounded-xl ${leaveFilter === 'pending' ? 'bg-amber-500 text-white' : (isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700')}`}>
                  Pending ({myPendingLeaveRequests.length})
                </button>
                <button onClick={() => setLeaveFilter('approved')} className={`px-4 py-2 rounded-xl ${leaveFilter === 'approved' ? 'bg-emerald-500 text-white' : (isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700')}`}>
                  Approved ({myApprovedLeaveRequests.length})
                </button>
              </div>
              {(leaveFilter === 'all' ? myLeaveRequests : leaveFilter === 'pending' ? myPendingLeaveRequests : myApprovedLeaveRequests).length === 0 ? (
                <p className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No leave requests</p>
              ) : (
                <div className="space-y-3">
                  {(leaveFilter === 'all' ? myLeaveRequests : leaveFilter === 'pending' ? myPendingLeaveRequests : myApprovedLeaveRequests).map((req) => (
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


      <div className={`flex min-h-screen ${isDark ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50'}`}>
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

        {/* Sidebar */}
        <motion.div 
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: isSidebarOpen ? 0 : -300, opacity: isSidebarOpen ? 1 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={`fixed left-0 top-0 h-full w-full lg:w-64 shadow-2xl p-4 flex flex-col z-50 border-r overflow-y-auto scrollbar-hide ${
            isDark 
              ? 'bg-gradient-to-b from-gray-800 to-gray-900 border-gray-700' 
              : 'bg-gradient-to-b from-white to-blue-50 border-blue-100'
          }`}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >


          {/* Theme Toggle */}
          <motion.button
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
            {isDark ? 'Light' : 'Dark'}
          </motion.button>

          <div className="text-center mb-8 pt-2">
            <motion.div 
              whileHover={{ scale: 1.1 }}
              onClick={() => setShowProfile(true)}
              className="w-20 h-20 bg-gradient-to-br from-blue-400 via-cyan-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg cursor-pointer"
            >
              <span className="text-3xl font-bold text-white">{user.firstName[0]}{user.lastName[0]}</span>
            </motion.div>
            <h2 className={`font-bold text-xl ${isDark ? 'text-white' : 'text-gray-800'}`}>{user.firstName} {user.lastName}</h2>
            <p className={`text-sm font-medium ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>{DEPARTMENTS[user.department]?.name}</p>
          </div>
          
          <nav className="flex-1 space-y-2 px-2 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              onClick={() => { setCurrentSection('workLog'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${
                currentSection === 'workLog' 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg' 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-blue-50 text-gray-700'
              }`}
            >
              <i className="fas fa-clock w-5"></i> Log Work
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              onClick={() => { setCurrentSection('myReports'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${
                currentSection === 'myReports' 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg' 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-blue-50 text-gray-700'
              }`}
            >
              <i className="fas fa-file-alt w-5"></i> My Reports
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              onClick={() => { setCurrentSection('leave'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${
                currentSection === 'leave' 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg' 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-blue-50 text-gray-700'
              }`}
            >
              <i className="fas fa-calendar-minus w-5"></i> Leave
              {myPendingLeaveRequests.length > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-xs px-2 py-1 rounded-full">{myPendingLeaveRequests.length}</span>
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              onClick={() => { setShowProfile(true); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${
                currentSection === 'profile' 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg' 
                  : isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-blue-50 text-gray-700'
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

        {/* Main Content */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-8 relative w-full transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`} style={{ height: '100vh' }}>
          <AnimatePresence mode="wait">
            {renderSection()}
          </AnimatePresence>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={showProfile} 
        onClose={() => setShowProfile(false)} 
        user={user}
        role={user?.role}
      />
    </>
  );
}
