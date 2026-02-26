import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEPARTMENTS } from '../constants/config';
import { useTheme } from '../context/ThemeContext';
import AdminSidebar from '../components/AdminSidebar';
import ProfileModal from '../components/ProfileModal';

export default function AdminDashboard({ auth, onLogout }) {
  const { isDark } = useTheme();
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Attendance filter states
  const [attendanceFilter, setAttendanceFilter] = useState(null);
  const [presentSubFilter, setPresentSubFilter] = useState('all');
  
  // Department filter state
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  // Leave section state
  const [leaveFilter, setLeaveFilter] = useState('pending');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const user = auth.currentUser;
  const userName = user ? `${user.firstName} ${user.lastName}` : 'Admin';

  const approvedEmployees = auth.employees.filter(emp => emp.status === 'approved');
  const approvedManagers = approvedEmployees.filter(emp => emp.role === 'dept_manager' || emp.role === 'manager');
  const regularEmployees = approvedEmployees.filter(emp => emp.role !== 'dept_manager' && emp.role !== 'manager');
  
  const pendingEmployees = auth.pendingRegistrations.filter(emp => emp.role !== 'dept_manager' && emp.role !== 'manager');
  const pendingManagers = auth.pendingRegistrations.filter(emp => emp.role === 'dept_manager' || emp.role === 'manager');
  
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = auth.workLogs.filter(log => log.date === today);
  const presentIds = [...new Set(todayLogs.map(log => log.employeeId))];
  
  // Present managers and employees
  const presentManagers = approvedManagers.filter(emp => presentIds.includes(emp.id));
  const presentEmployeesList = regularEmployees.filter(emp => presentIds.includes(emp.id));
  const absentManagers = approvedManagers.filter(emp => !presentIds.includes(emp.id));
  const absentEmployeesList = regularEmployees.filter(emp => !presentIds.includes(emp.id));

  // Leave requests
  const allLeaveRequests = auth.leaveRequests || [];
  const pendingLeaveRequests = allLeaveRequests.filter(req => req.status === 'pending');
  const approvedLeaveRequests = allLeaveRequests.filter(req => req.status === 'approved');
  
  // Employees on leave today
  const employeesOnLeave = allLeaveRequests.filter(req => 
    req.status === 'approved' && 
    req.startDate <= today && 
    req.endDate >= today
  );

  const getDepartmentCount = (deptKey) => 
    approvedEmployees.filter(emp => emp.department === deptKey).length;

  const getDepartmentManager = (deptKey) => {
    return approvedManagers.find(emp => emp.department === deptKey);
  };

  const getDepartmentEmployees = (deptKey) => {
    return regularEmployees.filter(emp => emp.department === deptKey);
  };

  const getEmployeeWorkLogs = (employeeId) => {
    return auth.workLogs.filter(log => log.employeeId === employeeId);
  };

  const viewEmployeeProfile = (employee) => {
    setSelectedEmployee(employee);
    setShowProfileModal(true);
  };

  const handleDeleteEmployee = (employeeId, employeeName) => {
    if (window.confirm(`Are you sure you want to delete ${employeeName}? This action cannot be undone.`)) {
      const result = auth.deleteEmployee(employeeId, user);
      if (result.success) {
        showToast(result.message, 'success');
      } else {
        showToast(result.message, 'error');
      }
    }
  };

  const handleApproveLeave = (requestId) => {
    auth.approveLeaveRequest(requestId);
    showToast('Leave request approved!', 'success');
  };

  const handleRejectLeave = (requestId) => {
    auth.rejectLeaveRequest(requestId);
    showToast('Leave request rejected!', 'success');
  };

  const getFilteredList = () => {
    if (!attendanceFilter) return [];
    
    if (attendanceFilter === 'present') {
      if (presentSubFilter === 'managers') {
        return presentManagers;
      } else if (presentSubFilter === 'employees') {
        return presentEmployeesList;
      } else {
        return [...presentManagers, ...presentEmployeesList];
      }
    } else if (attendanceFilter === 'absent') {
      if (presentSubFilter === 'managers') {
        return absentManagers;
      } else if (presentSubFilter === 'employees') {
        return absentEmployeesList;
      } else {
        return [...absentManagers, ...absentEmployeesList];
      }
    } else if (attendanceFilter === 'onLeave') {
      if (presentSubFilter === 'managers') {
        return employeesOnLeave.filter(req => req.isManager);
      } else if (presentSubFilter === 'employees') {
        return employeesOnLeave.filter(req => !req.isManager);
      } else {
        return employeesOnLeave;
      }
    } else {
      if (presentSubFilter === 'managers') {
        return approvedManagers;
      } else if (presentSubFilter === 'employees') {
        return regularEmployees;
      } else {
        return approvedEmployees;
      }
    }
  };

  const stats = [
    { title: 'Total Employees', value: approvedEmployees.length, icon: 'fa-users', color: 'from-cyan-400 to-blue-500' },
    { title: 'Departments', value: 5, icon: 'fa-building', color: 'from-emerald-400 to-green-500' },
    { title: 'Present Today', value: presentIds.length, icon: 'fa-user-check', color: 'from-violet-400 to-purple-500' },
    { title: 'Pending', value: auth.pendingRegistrations.length, icon: 'fa-user-clock', color: 'from-amber-400 to-orange-500' },
  ];

  const renderSection = () => {
    switch(currentSection) {
      case 'dashboard':
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
              className={`rounded-2xl p-6 shadow-lg border ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-700 border-gray-600' : 'bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 border-blue-100'}`}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    Welcome back, {user ? user.firstName : 'Admin'}! 👋
                  </h1>
                  <p className={isDark ? 'text-gray-400 mt-1' : 'text-gray-500 mt-1'}>{formatDate(currentTime)}</p>
                </div>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl px-6 py-3 shadow-lg">
                  <p className="text-white text-2xl font-mono font-bold">{formatTime(currentTime)}</p>
                </motion.div>
              </div>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <motion.div 
                  key={stat.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.03, y: -5 }}
                  className={`rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border ${isDark ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' : 'bg-white border-gray-100'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={isDark ? 'text-gray-400 text-sm font-medium' : 'text-gray-500 text-sm font-medium'}>{stat.title}</p>
                      <p className={`text-4xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>{stat.value}</p>
                    </div>
                    <div className={`w-14 h-14 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                      <i className={`fas ${stat.icon} text-white text-xl`}></i>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} whileHover={{ scale: 1.02 }} className="bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl p-6 text-white shadow-lg">
                <h3 className="text-xl font-bold mb-2">Pending Approvals</h3>
                <p className="text-cyan-100 mb-4">{auth.pendingRegistrations.length} requests waiting</p>
                <button onClick={() => setCurrentSection('pending')} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-all">View All <i className="fas fa-arrow-right ml-2"></i></button>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} whileHover={{ scale: 1.02 }} className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl p-6 text-white shadow-lg">
                <h3 className="text-xl font-bold mb-2">Team Overview</h3>
                <p className="text-emerald-100 mb-4">{approvedManagers.length} managers, {regularEmployees.length} employees</p>
                <button onClick={() => setCurrentSection('employees')} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-all">View All <i className="fas fa-arrow-right ml-2"></i></button>
              </motion.div>
            </div>
          </motion.div>
        );

      case 'pending':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Pending Approvals</h1>
            
            {pendingManagers.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl p-6 shadow-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100'}`}>
                <h2 className="text-xl font-bold text-violet-400 mb-4 flex items-center"><i className="fas fa-user-tie mr-2"></i>Pending Managers ({pendingManagers.length})</h2>
                <div className="space-y-4">
                  {pendingManagers.map((emp, index) => (
                    <motion.div key={emp.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} whileHover={{ scale: 1.01 }} className={`flex items-center justify-between p-4 rounded-xl shadow-md border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-violet-100'}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">{emp.firstName[0]}{emp.lastName[0]}</div>
                        <div>
                          <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{emp.firstName} {emp.lastName}</p>
                          <p className={isDark ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>{emp.email}</p>
                          <p className="text-violet-400 text-sm font-medium">{DEPARTMENTS[emp.department]?.name}</p>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => auth.approveEmployee(auth.pendingRegistrations.indexOf(emp))} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl shadow-lg"><i className="fas fa-check mr-2"></i>Approve</motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => auth.rejectEmployee(auth.pendingRegistrations.indexOf(emp))} className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl shadow-lg"><i className="fas fa-times mr-2"></i>Reject</motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`rounded-2xl p-6 shadow-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'}`}>
              <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center"><i className="fas fa-user mr-2"></i>Pending Employees ({pendingEmployees.length})</h2>
              {pendingEmployees.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fas fa-check-circle text-4xl text-white"></i></div>
                  <p className={isDark ? 'text-gray-400 text-lg' : 'text-gray-500 text-lg'}>No pending employee approvals</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingEmployees.map((emp, index) => (
                    <motion.div key={emp.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} whileHover={{ scale: 1.01 }} className={`flex items-center justify-between p-4 rounded-xl shadow-md border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-blue-100'}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">{emp.firstName[0]}{emp.lastName[0]}</div>
                        <div>
                          <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{emp.firstName} {emp.lastName}</p>
                          <p className={isDark ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>{emp.email}</p>
                          <p className="text-blue-400 text-sm font-medium">{DEPARTMENTS[emp.department]?.name}</p>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => auth.approveEmployee(auth.pendingRegistrations.indexOf(emp))} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl shadow-lg"><i className="fas fa-check mr-2"></i>Approve</motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => auth.rejectEmployee(auth.pendingRegistrations.indexOf(emp))} className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl shadow-lg"><i className="fas fa-times mr-2"></i>Reject</motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        );

      case 'departments':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-8">
              <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                {selectedDepartment ? DEPARTMENTS[selectedDepartment]?.name : 'Departments'}
              </h1>
              {selectedDepartment && (
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedDepartment(null)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-medium"
                >
                  <i className="fas fa-arrow-left mr-2"></i> Back
                </motion.button>
              )}
            </div>
            
            {!selectedDepartment ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(DEPARTMENTS).map(([key, dept], index) => (
                  <motion.div 
                    key={key} 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: index * 0.1 }} 
                    whileHover={{ scale: 1.03, y: -5 }}
                    onClick={() => setSelectedDepartment(key)}
                    className={`rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border cursor-pointer ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
                  >
                    <div className="flex items-center mb-4">
                      <div className={`w-14 h-14 bg-gradient-to-br ${dept.color === 'blue' ? 'from-blue-400 to-blue-600' : dept.color === 'green' ? 'from-emerald-400 to-green-600' : dept.color === 'purple' ? 'from-violet-400 to-purple-600' : dept.color === 'yellow' ? 'from-amber-400 to-yellow-600' : 'from-rose-400 to-red-600'} rounded-2xl flex items-center justify-center mr-4 shadow-lg`}>
                        <i className={`fas ${dept.icon} text-white text-xl`}></i>
                      </div>
                      <div>
                        <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-800'}`}>{dept.name}</h3>
                        <p className={isDark ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>{getDepartmentCount(key)} Employees</p>
                      </div>
                    </div>
                    <p className={isDark ? 'text-gray-400 text-sm' : 'text-gray-600 text-sm'}>{dept.description}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {getDepartmentManager(selectedDepartment) ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl p-6 shadow-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100'}`}
                  >
                    <h2 className="text-xl font-bold text-violet-400 mb-4 flex items-center">
                      <i className="fas fa-user-tie mr-2"></i> Department Manager
                    </h2>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/50 dark:bg-gray-700/50">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                          {getDepartmentManager(selectedDepartment).firstName[0]}{getDepartmentManager(selectedDepartment).lastName[0]}
                        </div>
                        <div>
                          <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-800'}`}>
                            {getDepartmentManager(selectedDepartment).firstName} {getDepartmentManager(selectedDepartment).lastName}
                          </p>
                          <p className={isDark ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>
                            {getDepartmentManager(selectedDepartment).email}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <motion.button 
                          whileHover={{ scale: 1.05 }} 
                          whileTap={{ scale: 0.95 }} 
                          onClick={() => viewEmployeeProfile(getDepartmentManager(selectedDepartment))}
                          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm font-medium"
                        >
                          <i className="fas fa-eye mr-1"></i> View
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl p-6 shadow-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-amber-50 border-amber-100'}`}
                  >
                    <p className="text-amber-600 font-medium">
                      <i className="fas fa-exclamation-triangle mr-2"></i>
                      No manager assigned to this department
                    </p>
                  </motion.div>
                )}

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`rounded-2xl p-6 shadow-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
                >
                  <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center">
                    <i className="fas fa-users mr-2"></i> Employees ({getDepartmentEmployees(selectedDepartment).length})
                  </h2>
                  {getDepartmentEmployees(selectedDepartment).length === 0 ? (
                    <div className="text-center py-8">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <i className={`fas fa-user-plus text-2xl ${isDark ? 'text-gray-500' : 'text-gray-400'}`}></i>
                      </div>
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No employees in this department</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getDepartmentEmployees(selectedDepartment).map((emp, index) => (
                        <motion.div 
                          key={emp.id} 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`flex items-center justify-between p-4 rounded-xl border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <div>
                              <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{emp.firstName} {emp.lastName}</p>
                              <p className={isDark ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>{emp.email}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <motion.button 
                              whileHover={{ scale: 1.05 }} 
                              whileTap={{ scale: 0.95 }} 
                              onClick={() => viewEmployeeProfile(emp)}
                              className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm font-medium"
                            >
                              <i className="fas fa-eye mr-1"></i> View
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </motion.div>
        );

      case 'employees':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'} mb-8`}>All Employees & Managers</h1>
            
            {approvedManagers.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl p-6 shadow-lg mb-6 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100'}`}>
                <h2 className="text-xl font-bold text-violet-400 mb-4 flex items-center"><i className="fas fa-user-tie mr-2"></i>Department Managers ({approvedManagers.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {approvedManagers.map((emp, index) => (
                    <motion.div key={emp.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.1 }} whileHover={{ scale: 1.02 }} className={`p-4 rounded-xl shadow-md transition-all ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:shadow-lg'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div onClick={() => viewEmployeeProfile(emp)} className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold cursor-pointer">{emp.firstName[0]}{emp.lastName[0]}</div>
                          <div>
                            <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{emp.firstName} {emp.lastName}</p>
                            <p className={isDark ? 'text-gray-400 text-xs' : 'text-gray-500 text-xs'}>{DEPARTMENTS[emp.department]?.name}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => viewEmployeeProfile(emp)} className="flex-1 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm font-medium"><i className="fas fa-eye mr-1"></i> View</motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleDeleteEmployee(emp.id, `${emp.firstName} ${emp.lastName}`)} className="px-3 py-1.5 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-lg text-sm font-medium"><i className="fas fa-trash mr-1"></i></motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`rounded-2xl p-6 shadow-lg overflow-x-auto border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center"><i className="fas fa-users mr-2"></i>Employees ({regularEmployees.length})</h2>
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                    <th className="px-4 py-3 text-left font-bold">Name</th>
                    <th className="px-4 py-3 text-left font-bold">Email</th>
                    <th className="px-4 py-3 text-left font-bold">Department</th>
                    <th className="px-4 py-3 text-left font-bold">Status</th>
                    <th className="px-4 py-3 text-left font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regularEmployees.map(emp => (
                    <tr key={emp.id} className={`border-t transition-all ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                      <td className={`px-4 py-3 font-medium ${isDark ? 'text-white' : ''}`}>{emp.firstName} {emp.lastName}</td>
                      <td className={`px-4 py-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{emp.email}</td>
                      <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : ''}`}>{DEPARTMENTS[emp.department]?.name}</td>
                      <td className="px-4 py-3"><span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">{emp.status}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => viewEmployeeProfile(emp)} className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm font-medium"><i className="fas fa-eye mr-1"></i> View</motion.button>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleDeleteEmployee(emp.id, `${emp.firstName} ${emp.lastName}`)} className="px-3 py-1.5 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-lg text-sm font-medium"><i className="fas fa-trash mr-1"></i></motion.button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {regularEmployees.length === 0 && (
                    <tr><td colSpan="5" className={`px-4 py-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No employees found</td></tr>
                  )}
                </tbody>
              </table>
            </motion.div>
          </motion.div>
        );

      case 'attendance':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'} mb-8`}>Today's Attendance</h1>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.1 }} 
                whileHover={{ scale: 1.05 }}
                onClick={() => { setAttendanceFilter(attendanceFilter === 'present' ? null : 'present'); setPresentSubFilter('all'); }}
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
                onClick={() => { setAttendanceFilter(attendanceFilter === 'absent' ? null : 'absent'); setPresentSubFilter('all'); }}
                className={`bg-gradient-to-br from-rose-400 to-red-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer ${attendanceFilter === 'absent' ? 'ring-4 ring-white' : ''}`}
              >
                <p className="text-3xl font-bold">{approvedEmployees.length - presentIds.length}</p>
                <p className="text-white/80">Absent</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.25 }} 
                whileHover={{ scale: 1.05 }}
                onClick={() => { setAttendanceFilter(attendanceFilter === 'onLeave' ? null : 'onLeave'); setPresentSubFilter('all'); }}
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
                onClick={() => { setAttendanceFilter(attendanceFilter === 'total' ? null : 'total'); setPresentSubFilter('all'); }}
                className={`bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer ${attendanceFilter === 'total' ? 'ring-4 ring-white' : ''}`}
              >
                <p className="text-3xl font-bold">{approvedEmployees.length}</p>
                <p className="text-white/80">Total</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.4 }} 
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-violet-400 to-purple-600 rounded-2xl p-6 text-white shadow-lg"
              >
                <p className="text-3xl font-bold">{Math.round((presentIds.length / approvedEmployees.length) * 100) || 0}%</p>
                <p className="text-white/80">Attendance</p>
              </motion.div>
            </div>

            {attendanceFilter && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="flex gap-3 mb-6"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPresentSubFilter('all')}
                  className={`px-6 py-2.5 rounded-xl font-bold ${
                    presentSubFilter === 'all' 
                      ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white' 
                      : isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  All
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPresentSubFilter('managers')}
                  className={`px-6 py-2.5 rounded-xl font-bold ${
                    presentSubFilter === 'managers' 
                      ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white' 
                      : isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Managers
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPresentSubFilter('employees')}
                  className={`px-6 py-2.5 rounded-xl font-bold ${
                    presentSubFilter === 'employees' 
                      ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white' 
                      : isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Employees
                </motion.button>
              </motion.div>
            )}

            {attendanceFilter && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                className={`rounded-2xl p-6 shadow-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
              >
                {getFilteredList().length === 0 ? (
                  <p className={isDark ? 'text-gray-400 text-center py-8' : 'text-gray-500 text-center py-8'}>No records found</p>
                ) : (
                  <div className="space-y-3">
                    {getFilteredList().map((item) => {
                      const emp = item.employeeId ? auth.employees.find(e => e.id === item.employeeId) : item;
                      if (!emp) return null;
                      return (
                        <div key={emp.id} className={`flex items-center justify-between p-4 rounded-xl border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                              emp.role === 'dept_manager' || emp.role === 'manager' 
                                ? 'bg-gradient-to-br from-violet-500 to-purple-500' 
                                : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                            }`}>
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <div>
                              <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{emp.firstName} {emp.lastName}</p>
                              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{emp.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              emp.role === 'dept_manager' || emp.role === 'manager'
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {DEPARTMENTS[emp.department]?.name}
                            </span>
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        );

      case 'leave':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'} mb-8`}>Leave Requests</h1>
            
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
                onClick={() => setLeaveFilter('approved')}
                className={`px-6 py-2.5 rounded-xl font-bold ${
                  leaveFilter === 'approved' 
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white' 
                    : isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                }`}
              >
                <i className="fas fa-check-circle mr-2"></i>Approved ({approvedLeaveRequests.length})
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
                <i className="fas fa-list mr-2"></i>All ({allLeaveRequests.length})
              </motion.button>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className={`rounded-2xl p-6 shadow-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
            >
              {leaveFilter === 'pending' && pendingLeaveRequests.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-check-circle text-4xl text-white"></i>
                  </div>
                  <p className={isDark ? 'text-gray-400 text-lg' : 'text-gray-500 text-lg'}>No pending leave requests</p>
                </div>
              )}
              
              {leaveFilter === 'approved' && approvedLeaveRequests.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-calendar-check text-4xl text-white"></i>
                  </div>
                  <p className={isDark ? 'text-gray-400 text-lg' : 'text-gray-500 text-lg'}>No approved leave requests</p>
                </div>
              )}

              {leaveFilter === 'all' && allLeaveRequests.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-calendar-times text-4xl text-white"></i>
                  </div>
                  <p className={isDark ? 'text-gray-400 text-lg' : 'text-gray-500 text-lg'}>No leave requests yet</p>
                </div>
              )}

              <div className="space-y-4">
                {(leaveFilter === 'pending' ? pendingLeaveRequests : leaveFilter === 'approved' ? approvedLeaveRequests : allLeaveRequests).map((req, index) => {
                  const emp = auth.employees.find(e => e.id === req.employeeId);
                  if (!emp) return null;
                  return (
                    <motion.div 
                      key={req.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-4 rounded-xl border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                            req.isManager 
                              ? 'bg-gradient-to-br from-violet-500 to-purple-500' 
                              : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                          }`}>
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                          <div>
                            <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{emp.firstName} {emp.lastName}</p>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{DEPARTMENTS[req.department]?.name}</p>
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

      default:
        return null;
    }
  };

  return (
    <>
      {toast && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        } text-white`}>
          {toast.message}
        </div>
      )}

      <div className={`flex min-h-screen ${isDark ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50'}`}>
        <AdminSidebar 
          currentSection={currentSection}
          onSectionChange={(section) => { setCurrentSection(section); setAttendanceFilter(null); setPresentSubFilter('all'); }}
          onLogout={onLogout}
          pendingCount={auth.pendingRegistrations.length}
          userName={userName}
          user={user}
          userRole={user?.role}
          leaveRequestCount={pendingLeaveRequests.length}
        />
        <div className="ml-64 p-8 flex-1 overflow-y-auto" style={{ height: '100vh' }}>
          <AnimatePresence mode="wait">
            {renderSection()}
          </AnimatePresence>
        </div>
      </div>

      <ProfileModal 
        isOpen={showProfileModal} 
        onClose={() => { setShowProfileModal(false); setSelectedEmployee(null); }} 
        user={selectedEmployee}
        role={selectedEmployee?.role}
        isAdminView={true}
        workLogs={selectedEmployee ? getEmployeeWorkLogs(selectedEmployee.id) : []}
      />
    </>
  );
}
