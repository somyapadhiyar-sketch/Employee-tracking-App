import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import { useState } from "react";
// 1. IMPORT THE NEW FIREBASE AUTH HOOK
import { useAuth } from "../hooks/AuthContext.jsx";

export default function DashboardLayout({ onLogout }) {
  const auth = useAuth();
  const user = auth.currentUser;

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

  // Pass down auth and onLogout to the child route (e.g. AdminDashboard, ManagerDashboard)
  // We no longer render AdminSidebar here because each dashboard is rendering its own complete layout!
  return <Outlet context={{ auth, onLogout }} />;
}
