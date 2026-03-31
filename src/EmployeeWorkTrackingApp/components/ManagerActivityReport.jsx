import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase"; 

export default function ManagerActivityReport({ isDark }) {
  const [trackingData, setTrackingData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 4 Filters ki States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedDate, setSelectedDate] = useState(""); 
  const [selectedStatus, setSelectedStatus] = useState("all"); 

  const formatDuration = (totalSeconds) => {
    if (!totalSeconds) return "0s";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    let result = "";
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0 || hours > 0) result += `${minutes}m `;
    result += `${seconds}s`;
    return result;
  };

  useEffect(() => {
    const fetchAllTrackingData = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "employee_analytics"));
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const sortedData = data.sort((a, b) => 
          new Date(b.last_updated || 0) - new Date(a.last_updated || 0)
        );

        setTrackingData(sortedData);
      } catch (error) {
        console.error("Error fetching tracking data: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllTrackingData();
  }, []);

  const uniqueEmployees = Array.from(new Set(trackingData.map(d => d.employee_email)))
    .map(email => {
      const user = trackingData.find(d => d.employee_email === email);
      return { email: email, name: user.user_name || "Unknown User" };
    });

  // POWERFUL FILTER LOGIC (4 Filters Ek Sath)
  const filteredData = trackingData.filter((row) => {
    // 1. Employee Filter
    const matchesEmployee = selectedEmployee === "all" || row.employee_email === selectedEmployee;
    
    // 2. Date Filter
    const matchesDate = selectedDate === "" || row.date === selectedDate;

    // 3. Status Filter (Calculate status first)
    const idleTime = row.idle_time_seconds || 0;
    const activeTime = row.active_time_seconds || 0;
    
    let rowStatus = "productive";
    if (idleTime > activeTime) {
        rowStatus = "low_activity";
    } else if (idleTime === activeTime) {
        rowStatus = "moderate";
    }

    const matchesStatus = selectedStatus === "all" || rowStatus === selectedStatus;

    // 4. Search Keyword Filter
    const searchLower = searchTerm.toLowerCase();
    const appMatch = (row.app_or_website || row.app_used || "").toLowerCase().includes(searchLower);
    const nameMatch = (row.user_name || "").toLowerCase().includes(searchLower);
    const matchesSearch = appMatch || nameMatch;
    
    return matchesEmployee && matchesDate && matchesStatus && matchesSearch;
  });

  if (loading) {
    return <div className="min-h-[400px] flex items-center justify-center text-gray-500">Loading Team Activity Data...</div>;
  }

  return (
    <div className={`rounded-2xl p-6 shadow-lg border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
      <div className="flex flex-col mb-8 gap-4">
        <h2 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
          <i className="fas fa-desktop mr-3 text-blue-500"></i> Activity Monitor
        </h2>
        
        {/* FILTERS SECTION */}
        <div className={`p-4 rounded-xl border ${isDark ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`}>
          
          {/* 1. Employee Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none cursor-pointer ${isDark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-800"}`}
            >
              <option value="all">All Team</option>
              {uniqueEmployees.map((emp, index) => (
                <option key={index} value={emp.email}>{emp.name}</option>
              ))}
            </select>
          </div>

          {/* 2. Date Picker */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none ${isDark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-800"}`}
            />
          </div>

          {/* 3. Status Dropdown (Moderate Added) */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none cursor-pointer ${isDark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-800"}`}
            >
              <option value="all">All Status</option>
              <option value="productive">Productive</option>
              <option value="moderate">Moderate</option>
              <option value="low_activity">Low Activity</option>
            </select>
          </div>

          {/* 4. App/Keyword Search */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Search App</label>
            <div className="relative">
              <i className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-gray-500" : "text-gray-400"}`}></i>
              <input
                type="text"
                placeholder="Search app..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none ${isDark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-800"}`}
              />
            </div>
          </div>

        </div>
        
        {/* Active Filters Clear Button */}
        {(selectedEmployee !== "all" || selectedDate !== "" || selectedStatus !== "all" || searchTerm !== "") && (
          <div className="flex justify-end">
            <button 
              onClick={() => {
                setSelectedEmployee("all");
                setSelectedDate("");
                setSelectedStatus("all");
                setSearchTerm("");
              }}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1"
            >
              <i className="fas fa-times"></i> Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className={isDark ? "bg-gray-700" : "bg-gray-50"}>
            <tr>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Employee</th>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Date</th>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>App / Website</th>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Active</th>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Idle</th>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Total</th>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Status</th>
            </tr>
          </thead>
          
          <tbody className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-100"}`}>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-gray-500 italic">
                  No records found matching your filters.
                </td>
              </tr>
            ) : (
              filteredData.map((row) => {
                const appName = row.app_or_website || row.app_used || "Unknown App";
                const isWebsite = appName.includes('.com') || appName.includes('.in') || appName.includes('.org');
                
                const idleTime = row.idle_time_seconds || 0;
                const activeTime = row.active_time_seconds || 0;

                return (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br from-blue-500 to-indigo-600 mr-3`}>
                          {(row.user_name || "U")[0].toUpperCase()}
                        </div>
                        <div>
                          <div className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                            {row.user_name || "Unknown User"}
                          </div>
                          <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            {row.employee_email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className={`px-4 py-4 whitespace-nowrap text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                      {row.date || "N/A"}
                    </td>
                    
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <i className={`text-lg ${isWebsite ? 'fas fa-globe text-blue-500' : 'fas fa-window-maximize text-purple-500'}`}></i>
                        <span className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
                          {appName}
                        </span>
                      </div>
                    </td>

                    <td className={`px-4 py-4 whitespace-nowrap text-sm font-bold text-emerald-500`}>
                      {formatDuration(row.active_time_seconds)}
                    </td>
                    
                    <td className={`px-4 py-4 whitespace-nowrap text-sm font-bold text-rose-500`}>
                      {formatDuration(row.idle_time_seconds)}
                    </td>
                    
                    <td className={`px-4 py-4 whitespace-nowrap text-sm font-bold ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                      {formatDuration(row.total_time_seconds)}
                    </td>
                    
                    <td className="px-4 py-4 whitespace-nowrap">
                      {idleTime > activeTime ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 ring-1 ring-amber-200 rounded-full text-xs font-bold uppercase tracking-wider">
                          Low Activity
                        </span>
                      ) : idleTime === activeTime ? (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 ring-1 ring-blue-200 rounded-full text-xs font-bold uppercase tracking-wider">
                          Moderate
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 rounded-full text-xs font-bold uppercase tracking-wider">
                          Productive
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}