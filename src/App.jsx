import { useState } from 'react';
import useAuth from './EmployeeWorkTrackingApp/hooks/useAuth';
import { ThemeProvider } from './EmployeeWorkTrackingApp/context/ThemeContext';
import Login from './EmployeeWorkTrackingApp/pages/Login';
import Register from './EmployeeWorkTrackingApp/pages/Register';
import AdminDashboard from './EmployeeWorkTrackingApp/pages/AdminDashboard';
import EmployeeDashboard from './EmployeeWorkTrackingApp/pages/EmployeeDashboard';
import ManagerDashboard from './EmployeeWorkTrackingApp/pages/ManagerDashboard';

function EmployeeWorkTrackingApp() {
  const auth = useAuth();
  const [currentView, setCurrentView] = useState('login');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = (email, password, role) => {
    const result = auth.login(email, password, role);
    if (result.success) {
      if (result.user.role === 'admin') {
        setCurrentView('admin');
      } else if (result.user.role === 'employee') {
        setCurrentView('employee');
      } else if (result.user.role === 'dept_manager' || result.user.role === 'manager') {
        setCurrentView('manager');
      }
      showToast('Login successful!', 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleRegister = (userData) => {
    const result = auth.register(userData);
    showToast(result.message, result.success ? 'success' : 'error');
    if (result.success) {
      setCurrentView('login');
    }
  };

  const handleLogout = () => {
    auth.logout();
    setCurrentView('login');
    showToast('Logged out successfully!', 'info');
  };

  // Render based on auth state and current view
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If logged in, show appropriate dashboard (wrapped in ThemeProvider)
  if (auth.currentUser) {
    if (auth.currentUser.role === 'admin') {
      return (
        <ThemeProvider>
          <AdminDashboard auth={auth} onLogout={handleLogout} />
        </ThemeProvider>
      );
    } else if (auth.currentUser.role === 'employee') {
      return (
        <ThemeProvider>
          <EmployeeDashboard auth={auth} onLogout={handleLogout} />
        </ThemeProvider>
      );
    } else if (auth.currentUser.role === 'dept_manager' || auth.currentUser.role === 'manager') {
      return (
        <ThemeProvider>
          <ManagerDashboard auth={auth} onLogout={handleLogout} />
        </ThemeProvider>
      );
    }
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen">
        {toast && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-600' : 
            toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          } text-white`}>
            {toast.message}
          </div>
        )}

        {currentView === 'login' && (
          <Login 
            onLogin={handleLogin} 
            onSwitchToRegister={() => setCurrentView('register')} 
          />
        )}
        
        {currentView === 'register' && (
          <Register 
            onRegister={handleRegister} 
            onSwitchToLogin={() => setCurrentView('login')}
            auth={auth}
          />
        )}
      </div>
    </ThemeProvider>
  );
}

export default function App() {
  return <EmployeeWorkTrackingApp />;
}
