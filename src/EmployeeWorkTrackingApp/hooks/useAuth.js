import { useState, useEffect } from 'react';
import { ADMIN_CREDENTIALS } from '../constants/config';
import departmentManagers from '../Data.json';


export default function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage and Data.json
  useEffect(() => {
    const storedEmployees = JSON.parse(localStorage.getItem('employees')) || [];
    const storedPending = JSON.parse(localStorage.getItem('pendingRegistrations')) || [];
    const storedLogs = JSON.parse(localStorage.getItem('workLogs')) || [];
    const storedAttendance = JSON.parse(localStorage.getItem('attendance')) || {};
    const storedUser = JSON.parse(localStorage.getItem('currentUser'));
    const storedLeaveRequests = JSON.parse(localStorage.getItem('leaveRequests')) || [];

    // Load department managers from Data.json if not already in stored employees
    const existingManagerIds = storedEmployees.map(emp => emp.id);
    const newManagers = departmentManagers.filter(manager => !existingManagerIds.includes(manager.id));

    // Combine stored employees with department managers from Data.json
    const combinedEmployees = [...newManagers, ...storedEmployees];

    // Save combined employees to localStorage
    if (newManagers.length > 0) {
      localStorage.setItem('employees', JSON.stringify(combinedEmployees));
    }

    setEmployees(combinedEmployees);
    setPendingRegistrations(storedPending);
    setWorkLogs(storedLogs);
    setAttendance(storedAttendance);
    setCurrentUser(storedUser);
    setLeaveRequests(storedLeaveRequests);
    setIsLoading(false);
  }, []);


  // Helper function to extract name from email
  const getNameFromEmail = (email) => {
    if (!email) return { firstName: 'User', lastName: '' };
    const namePart = email.split('@')[0];
    const parts = namePart.split(/[._-]/);
    if (parts.length >= 2) {
      return {
        firstName: parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
        lastName: parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
      };
    }
    return {
      firstName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
      lastName: ''
    };
  };

  // Login
  const login = (email, password, role) => {
    // Admin login
    if (role === 'admin') {
      // Find admin in the array
      const admin = ADMIN_CREDENTIALS.find(
        admin => admin.email === email && admin.password === password
      );

      if (admin) {
        const user = {
          id: 1,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          role: 'admin',
          department: null
        };
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
        return { success: true, user };
      }
      return { success: false, message: 'Invalid admin credentials' };
    }

    // Manager login
    if (role === 'dept_manager' || role === 'manager') {
      let user = employees.find(emp =>
        emp.email === email &&
        emp.password === password &&
        (emp.role === 'dept_manager' || emp.role === 'manager') &&
        emp.status === 'approved'
      );

      if (!user) {
        user = pendingRegistrations.find(emp =>
          emp.email === email &&
          emp.password === password &&
          (emp.role === 'dept_manager' || emp.role === 'manager') &&
          emp.status === 'pending'
        );

        if (user) {
          return { success: false, message: 'Your manager account is pending approval. Please wait for admin approval.' };
        }
      }

      if (user) {
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
        return { success: true, user };
      }

      return { success: false, message: 'Invalid credentials or account not approved yet.' };
    }

    // Employee login
    const user = employees.find(emp =>
      emp.email === email &&
      emp.password === password &&
      emp.role === role &&
      emp.status === 'approved'
    );

    if (user) {
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      return { success: true, user };
    }

    return { success: false, message: 'Invalid credentials or account not approved yet.' };
  };

  // Register
  const register = (userData) => {
    const { email, department, role } = userData;
    const userRole = role || 'employee';

    // Check if email exists in employees
    if (employees.find(emp => emp.email === email)) {
      return { success: false, message: 'Email already registered!' };
    }

    // Check if email exists in pending
    if (pendingRegistrations.find(emp => emp.email === email)) {
      return { success: false, message: 'Registration already pending approval!' };
    }

    // Check if a manager already exists for this department
    if (userRole === 'dept_manager' || userRole === 'manager') {
      const existingManager = employees.find(emp =>
        emp.department === department &&
        (emp.role === 'dept_manager' || emp.role === 'manager') &&
        emp.status === 'approved'
      );
      if (existingManager) {
        return { success: false, message: 'A manager already exists for this department! Only one manager per department is allowed.' };
      }

      const pendingManager = pendingRegistrations.find(emp =>
        emp.department === department &&
        (emp.role === 'dept_manager' || emp.role === 'manager')
      );
      if (pendingManager) {
        return { success: false, message: 'A manager registration is already pending for this department!' };
      }
    }

    const newUser = {
      ...userData,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      clockedIn: false,
      clockInTime: null,
      status: 'pending'
    };

    const updatedPending = [...pendingRegistrations, newUser];
    setPendingRegistrations(updatedPending);
    localStorage.setItem('pendingRegistrations', JSON.stringify(updatedPending));

    if (role === 'dept_manager' || role === 'manager') {
      return { success: true, message: 'Manager registration submitted! Waiting for admin approval.' };
    }

    return { success: true, message: 'Registration submitted! Waiting for approval.' };
  };

  // Logout
  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  // Approve employee or manager
  const approveEmployee = (index) => {
    const emp = pendingRegistrations[index];
    const updatedEmp = { ...emp, status: 'approved' };

    const updatedEmployees = [...employees, updatedEmp];
    setEmployees(updatedEmployees);
    localStorage.setItem('employees', JSON.stringify(updatedEmployees));

    const updatedPending = pendingRegistrations.filter((_, i) => i !== index);
    setPendingRegistrations(updatedPending);
    localStorage.setItem('pendingRegistrations', JSON.stringify(updatedPending));
  };

  // Reject employee
  const rejectEmployee = (index) => {
    const updatedPending = pendingRegistrations.filter((_, i) => i !== index);
    setPendingRegistrations(updatedPending);
    localStorage.setItem('pendingRegistrations', JSON.stringify(updatedPending));
  };

  // Update user
  const updateUser = (updatedUser) => {
    setCurrentUser(updatedUser);
    const updatedEmployees = employees.map(emp =>
      emp.id === updatedUser.id ? updatedUser : emp
    );
    setEmployees(updatedEmployees);
    localStorage.setItem('employees', JSON.stringify(updatedEmployees));
  };

  // Add work log
  const addWorkLog = (workEntry) => {
    const updatedLogs = [...workLogs, workEntry];
    setWorkLogs(updatedLogs);
    localStorage.setItem('workLogs', JSON.stringify(updatedLogs));
  };

  // Update attendance
  const updateAttendance = (employeeId, status) => {
    const today = new Date().toISOString().split('T')[0];

    const updatedAttendance = {
      ...attendance,
      [today]: {
        ...(attendance[today] || {}),
        [employeeId]: {
          status,
          clockInTime: new Date().toISOString()
        }
      }
    };
    setAttendance(updatedAttendance);
    localStorage.setItem('attendance', JSON.stringify(updatedAttendance));
  };

  // Get approved employees
  const getApprovedEmployees = () => employees.filter(emp => emp.status === 'approved');

  // Get approved managers
  const getApprovedManagers = () => employees.filter(emp => (emp.role === 'dept_manager' || emp.role === 'manager') && emp.status === 'approved');

  // Get employees by department
  const getEmployeesByDepartment = (dept) =>
    employees.filter(emp => emp.department === dept && emp.status === 'approved');

  // Get pending for department
  const getPendingForDepartment = (dept) =>
    pendingRegistrations.filter(emp => emp.department === dept);

  // Get pending managers
  const getPendingManagers = () => pendingRegistrations.filter(emp => emp.role === 'dept_manager' || emp.role === 'manager');

  // Get today's attendance
  const getTodayAttendance = () => {
    const today = new Date().toISOString().split('T')[0];
    return attendance[today] || {};
  };

  // Delete an employee (Admin can delete anyone, Manager can only delete employees in their department)
  const deleteEmployee = (employeeId, requestingUser) => {
    const employee = employees.find(emp => emp.id === employeeId);

    if (!employee) {
      return { success: false, message: 'Employee not found!' };
    }

    // If request is from a manager, they can only delete employees (not other managers or admins)
    if (requestingUser.role === 'dept_manager' || requestingUser.role === 'manager') {
      // Manager cannot delete admins
      if (employee.role === 'admin') {
        return { success: false, message: 'Cannot delete admin!' };
      }
      // Manager cannot delete other managers
      if (employee.role === 'dept_manager' || employee.role === 'manager') {
        return { success: false, message: 'Cannot delete other managers!' };
      }
      // Manager can only delete employees in their own department
      if (employee.department !== requestingUser.department) {
        return { success: false, message: 'You can only delete employees in your department!' };
      }
    }

    // Remove from employees array
    const updatedEmployees = employees.filter(emp => emp.id !== employeeId);
    setEmployees(updatedEmployees);
    localStorage.setItem('employees', JSON.stringify(updatedEmployees));

    // Also remove their work logs
    const updatedLogs = workLogs.filter(log => log.employeeId !== employeeId);
    setWorkLogs(updatedLogs);
    localStorage.setItem('workLogs', JSON.stringify(updatedLogs));

    return { success: true, message: `${employee.firstName} ${employee.lastName} has been removed!` };
  };

  // Submit leave request
  const submitLeaveRequest = (leaveData) => {
    const newRequest = {
      ...leaveData,
      id: Date.now(),
      status: 'pending',
      submittedAt: new Date().toISOString()
    };
    const updatedRequests = [...leaveRequests, newRequest];
    setLeaveRequests(updatedRequests);
    localStorage.setItem('leaveRequests', JSON.stringify(updatedRequests));
    return { success: true, message: 'Leave request submitted successfully!' };
  };

  // Approve leave request
  const approveLeaveRequest = (requestId) => {
    const updatedRequests = leaveRequests.map(req =>
      req.id === requestId ? { ...req, status: 'approved', respondedAt: new Date().toISOString() } : req
    );
    setLeaveRequests(updatedRequests);
    localStorage.setItem('leaveRequests', JSON.stringify(updatedRequests));
  };

  // Reject leave request
  const rejectLeaveRequest = (requestId) => {
    const updatedRequests = leaveRequests.map(req =>
      req.id === requestId ? { ...req, status: 'rejected', respondedAt: new Date().toISOString() } : req
    );
    setLeaveRequests(updatedRequests);
    localStorage.setItem('leaveRequests', JSON.stringify(updatedRequests));
  };

  // Get all leave requests (for admin)
  const getAllLeaveRequests = () => leaveRequests;

  // Get pending leave requests (for admin)
  const getPendingLeaveRequests = () => leaveRequests.filter(req => req.status === 'pending');

  // Get leave requests for a specific department (for manager)
  const getLeaveRequestsForDepartment = (dept) =>
    leaveRequests.filter(req => req.department === dept);

  // Get pending leave requests for a department
  const getPendingLeaveForDepartment = (dept) =>
    leaveRequests.filter(req => req.department === dept && req.status === 'pending');

  // Get leave requests submitted by a specific employee
  const getLeaveRequestsByEmployee = (employeeId) =>
    leaveRequests.filter(req => req.employeeId === employeeId);

  // Get employees on leave today
  const getEmployeesOnLeave = () => {
    const today = new Date().toISOString().split('T')[0];
    return leaveRequests.filter(req =>
      req.status === 'approved' &&
      req.startDate <= today &&
      req.endDate >= today
    );
  };

  return {
    currentUser,
    employees,
    pendingRegistrations,
    workLogs,
    attendance,
    leaveRequests,
    isLoading,
    login,
    register,
    logout,
    approveEmployee,
    rejectEmployee,
    updateUser,
    addWorkLog,
    updateAttendance,
    getApprovedEmployees,
    getApprovedManagers,
    getEmployeesByDepartment,
    getPendingForDepartment,
    getPendingManagers,
    getTodayAttendance,
    deleteEmployee,
    submitLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,
    getAllLeaveRequests,
    getPendingLeaveRequests,
    getLeaveRequestsForDepartment,
    getPendingLeaveForDepartment,
    getLeaveRequestsByEmployee,
    getEmployeesOnLeave
  };
}
