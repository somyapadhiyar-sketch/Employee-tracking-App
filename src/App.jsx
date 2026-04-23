import { useState, useEffect } from "react";
import { ThemeProvider } from "./EmployeeWorkTrackingApp/context/ThemeContext";
import Login from "./EmployeeWorkTrackingApp/pages/Login";
import Register from "./EmployeeWorkTrackingApp/pages/Register";
import AdminDashboard from "./EmployeeWorkTrackingApp/pages/AdminDashboard";
import EmployeeDashboard from "./EmployeeWorkTrackingApp/pages/EmployeeDashboard";
import ManagerDashboard from "./EmployeeWorkTrackingApp/pages/ManagerDashboard";
import ProfilePage from "./EmployeeWorkTrackingApp/pages/ProfilePage";
import DashboardLayout from "./EmployeeWorkTrackingApp/components/DashboardLayout";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "./EmployeeWorkTrackingApp/hooks/AuthContext.jsx";

function ProtectedRoute({ children, auth }) {
  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!auth?.currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function EmployeeWorkTrackingApp() {
  const auth = useAuth();
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  // Handle automatic redirection after successful login/auth state update
  useEffect(() => {
    if (!auth.loading) {
      const path = window.location.pathname;
      const isPublicRoute = path === "/login" || path === "/register" || path === "/";
      
      if (auth.currentUser) {
        // We have disabled automatic redirection to allow you to log in manually 
        // to different accounts even if a session is already active.
      } else {
        // Not logged in. If on a protected route, go to login.
        if (!isPublicRoute) {
          console.log("Not logged in, auto-navigating to login");
          navigate("/login", { replace: true });
        }
      }
    }
  }, [auth.currentUser, auth.loading, navigate]);

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLoginSuccess = (userData) => {
    console.log("Login Success Data:", userData);

    // Update the auth context immediately.
    if (auth && auth.updateUser) {
      auth.updateUser(userData);
    }

    // Direct navigation for a smoother experience (no "refresh" feel)
    // Using case-insensitive role check for robustness
    const userRole = (userData.role || "").toLowerCase();
    const dashboardPath =
      userRole === "admin"
        ? "/admin"
        : userRole === "employee"
          ? "/employee"
          : "/manager";

    console.log("Navigating directly to dashboard:", dashboardPath);
    navigate(dashboardPath, { replace: true });

    showToast("Login successful!", "success");
  };

  const handleRegisterSuccess = () => {
    showToast("Registration successful! You can now log in.", "success");
    navigate("/login");
  };

  const handleLogout = async () => {
    await auth.logout();
    showToast("Logged out successfully!", "info");
  };

  return (
    <div className="min-h-screen">
      {toast && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${toast.type === "success"
            ? "bg-green-600"
            : toast.type === "error"
              ? "bg-red-600"
              : "bg-blue-600"
            } text-white animate-pulse`}
        >
          {toast.message}
        </div>
      )}

      <Routes>
        <Route
          path="/login"
          element={
            <ThemeProvider>
              <Login
                onLoginSuccess={handleLoginSuccess}
                onSwitchToRegister={() => navigate("/register")}
              />
            </ThemeProvider>
          }
        />
        <Route
          path="/register"
          element={
            <ThemeProvider>
              <Register
                onRegisterSuccess={handleRegisterSuccess}
                onSwitchToLogin={() => navigate("/login")}
              />
            </ThemeProvider>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/*"
          element={
            <ThemeProvider>
              <ProtectedRoute auth={auth}>
                <DashboardLayout onLogout={handleLogout}>
                  <Outlet />
                </DashboardLayout>
              </ProtectedRoute>
            </ThemeProvider>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="pending" element={<AdminDashboard />} />
          <Route
            path="departments"
            element={<div>Departments Coming Soon</div>}
          />
          <Route path="employees" element={<div>Employees Coming Soon</div>} />
          <Route
            path="attendance"
            element={<div>Attendance Coming Soon</div>}
          />
          <Route path="leave" element={<div>Leave Requests Coming Soon</div>} />
          <Route path="profile" element={<ProfilePage auth={auth} />} />
        </Route>

        {/* Employee Routes */}
        <Route
          path="/employee/*"
          element={
            <ThemeProvider>
              <ProtectedRoute auth={auth}>
                <DashboardLayout onLogout={handleLogout}>
                  <Outlet />
                </DashboardLayout>
              </ProtectedRoute>
            </ThemeProvider>
          }
        >
          <Route index element={<EmployeeDashboard auth={auth} />} />
          <Route path="profile" element={<ProfilePage auth={auth} />} />
        </Route>

        {/* Manager Routes */}
        <Route
          path="/manager/*"
          element={
            <ThemeProvider>
              <ProtectedRoute auth={auth}>
                <DashboardLayout onLogout={handleLogout}>
                  <Outlet />
                </DashboardLayout>
              </ProtectedRoute>
            </ThemeProvider>
          }
        >
          <Route index element={<ManagerDashboard auth={auth} />} />
          <Route path="profile" element={<ProfilePage auth={auth} />} />
        </Route>

        <Route
          path="/"
          element={
            <ThemeProvider>
              <Login
                onLoginSuccess={handleLoginSuccess}
                onSwitchToRegister={() => navigate("/register")}
              />
            </ThemeProvider>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <EmployeeWorkTrackingApp />
    </BrowserRouter>
  );
}
