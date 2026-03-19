import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import { useState } from "react";
// 1. IMPORT THE NEW FIREBASE AUTH HOOK
import { useAuth } from "../hooks/AuthContext.jsx";

export default function DashboardLayout({ onLogout }) {
  const auth = useAuth();
  const user = auth.currentUser;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // If Firebase hasn't loaded the user yet, show the spinner
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
      <AdminSidebar
        currentSection={window.location.pathname.split("/")[2] || "dashboard"}
        onSectionChange={(section) => {
          const basePath = window.location.pathname.split("/")[1];
          if (section === "profile") {
            window.history.pushState({}, "", `/${basePath}/profile`);
          } else {
            window.history.pushState({}, "", `/${basePath}`);
          }
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
        onLogout={onLogout}
        // 2. We set these to 0 here because your individual dashboards (like AdminDashboard)
        // now securely fetch their own live data directly from Firebase!
        pendingCount={0}
        leaveRequestCount={0}
        userName={`${user.firstName} ${user.lastName}`}
        user={user}
        userRole={user.role}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Outlet context={{ auth, onLogout }} />
      </main>
    </div>
  );
}
