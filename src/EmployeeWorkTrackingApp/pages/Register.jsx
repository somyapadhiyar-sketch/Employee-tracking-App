import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DEPARTMENTS } from '../constants/config';

export default function Register({ onRegister, onSwitchToLogin, auth }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: 'it_engineering',
    role: 'employee',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [managerWarning, setManagerWarning] = useState('');

  // Check if manager already exists for selected department
  useEffect(() => {
    if (formData.role === 'dept_manager' || formData.role === 'manager') {
      // Check approved managers
      const existingManager = auth?.employees?.find(emp => 
        emp.department === formData.department && 
        (emp.role === 'dept_manager' || emp.role === 'manager') &&
        emp.status === 'approved'
      );
      
      if (existingManager) {
        setManagerWarning(`⚠️ A manager (${existingManager.firstName} ${existingManager.lastName}) already exists for ${DEPARTMENTS[formData.department]?.name}. Only one manager per department is allowed.`);
      } else {
        // Check pending managers
        const pendingManager = auth?.pendingRegistrations?.find(emp => 
          emp.department === formData.department && 
          (emp.role === 'dept_manager' || emp.role === 'manager')
        );
        
        if (pendingManager) {
          setManagerWarning(`⚠️ A manager registration is already pending for ${DEPARTMENTS[formData.department]?.name}.`);
        } else {
          setManagerWarning('');
        }
      }
    } else {
      setManagerWarning('');
    }
  }, [formData.role, formData.department, auth]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleChange = (role) => {
    setFormData({ ...formData, role });
  };

  const handleDepartmentChange = (e) => {
    setFormData({ ...formData, department: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Final check before submitting
    if (formData.role === 'dept_manager' || formData.role === 'manager') {
      const existingManager = auth?.employees?.find(emp => 
        emp.department === formData.department && 
        (emp.role === 'dept_manager' || emp.role === 'manager') &&
        emp.status === 'approved'
      );
      
      if (existingManager) {
        setError(`Cannot register as manager! A manager (${existingManager.firstName} ${existingManager.lastName}) already exists for ${DEPARTMENTS[formData.department]?.name}.`);
        setLoading(false);
        return;
      }

      const pendingManager = auth?.pendingRegistrations?.find(emp => 
        emp.department === formData.department && 
        (emp.role === 'dept_manager' || emp.role === 'manager')
      );
      
      if (pendingManager) {
        setError(`Cannot register as manager! A manager registration is already pending for ${DEPARTMENTS[formData.department]?.name}.`);
        setLoading(false);
        return;
      }
    }
    
    try {
      const result = onRegister(formData);
      if (!result.success) {
        setError(result.message || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex">
      {/* Left Side - Branding */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-1/2 bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 flex flex-col justify-center items-center p-6"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto shadow-2xl border border-white/30 mb-5">
            <i className="fas fa-user-plus text-4xl text-white"></i>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Join Us</h1>
          <p className="text-white/80 text-lg">Create Your Account</p>
          <p className="text-white/60 mt-3">Start tracking your work today</p>
        </motion.div>
      </motion.div>

      {/* Right Side - Register Form */}
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-1/2 flex flex-col justify-center items-center p-6 bg-gray-50 overflow-y-auto"
      >
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Create Account</h2>
          <p className="text-gray-500 mb-5">Fill in your details</p>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg mb-3 text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                placeholder="First Name"
              />
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                placeholder="Last Name"
              />
            </div>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              placeholder="Email"
            />

            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              placeholder="Phone"
            />

            <select
              name="department"
              value={formData.department}
              onChange={handleDepartmentChange}
              className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none bg-white"
            >
              {Object.entries(DEPARTMENTS).map(([key, dept]) => (
                <option key={key} value={key}>{dept.name}</option>
              ))}
            </select>

            {/* Manager Warning */}
            {managerWarning && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-sm"
              >
                {managerWarning}
              </motion.div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'employee', label: 'Employee', icon: 'fa-user' },
                { value: 'dept_manager', label: 'Manager', icon: 'fa-user-tie' }
              ].map((option) => (
                <motion.button
                  key={option.value}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRoleChange(option.value)}
                  className={`p-2.5 rounded-xl border-2 transition-all text-center ${
                    formData.role === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <i className={`fas ${option.icon} text-lg block mb-1`}></i>
                  <span className="text-xs font-medium">{option.label}</span>
                </motion.button>
              ))}
            </div>

            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              placeholder="Password"
            />

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading || managerWarning !== ''}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Creating...
                </span>
              ) : (
                'Create Account'
              )}
            </motion.button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-gray-500 text-sm">
              Have account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-blue-600 font-bold hover:underline"
              >
                Login
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
