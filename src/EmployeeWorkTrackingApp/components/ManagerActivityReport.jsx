import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase"; 

export default function ManagerActivityReport({ isDark, teamEmails = [], adminView = false, allUsers = [] }) {
  const [trackingData, setTrackingData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 4 Filters ki States + Dept Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
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
      // Data agar pehle se hai toh dobara full loading nahi dikhayenge (No Blinking)
      if (trackingData.length === 0) setLoading(true);
      
      try {
        const querySnapshot = await getDocs(collection(db, "employee_analytics"));
        let data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Filter: Admin view mein sab dikhao, Manager view mein sirf team emails
        if (!adminView) {
          if (teamEmails && teamEmails.length > 0) {
            data = data.filter(item => teamEmails.includes(item.employee_email));
          } else {
            data = [];
          }
        }

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
  }, [JSON.stringify(teamEmails), adminView]);

  // uniqueEmployees should also be from the filtered trackingData, filtered by selectedDepartment
  const uniqueEmployees = Array.from(new Set(trackingData.map(d => d.employee_email)))
    .map(email => {
      const userInfo = allUsers.find(u => u.email === email);
      const trackInfo = trackingData.find(d => d.employee_email === email);
      return { 
        email: email, 
        name: userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : (trackInfo.user_name || "Unknown User"),
        department: userInfo?.department || "Unknown",
        role: userInfo?.role || "employee"
      };
    })
    .filter(emp => selectedDepartment === "all" || emp.department === selectedDepartment);

  const uniqueDepartments = Array.from(new Set(allUsers.filter(u => u.status === "approved").map(u => u.department))).filter(Boolean);

  const filteredData = trackingData.filter((row) => {
    const user = allUsers.find(u => u.email === row.employee_email);
    const dept = user?.department || "Unknown";

    const matchesEmployee = selectedEmployee === "all" || row.employee_email === selectedEmployee;
    const matchesDept = selectedDepartment === "all" || dept === selectedDepartment;
    const matchesDate = selectedDate === "" || row.date === selectedDate;

    const searchLower = searchTerm.toLowerCase();
    const appName = row.app_or_website || row.app_used || "";
    const appMatch = (row.app_or_website || row.app_used || "").toLowerCase().includes(searchLower);
    const nameMatch = (row.user_name || "").toLowerCase().includes(searchLower);
    const matchesSearch = appMatch || nameMatch;

    const idleTime = row.idle_time_seconds || 0;
    const activeTime = row.active_time_seconds || 0;
    
    let rowStatus = "productive";
    if (appName === "Break Mode (Away)") {
        rowStatus = "break";
    } else if (idleTime > activeTime) {
        rowStatus = "low_activity";
    } else if (idleTime > 0 && idleTime === activeTime) {
        rowStatus = "moderate";
    }

    const matchesStatus = selectedStatus === "all" || rowStatus === selectedStatus;
    
    return matchesEmployee && matchesDept && matchesDate && matchesStatus && matchesSearch;
  });

  if (loading) {
    return <div className="min-h-[400px] flex items-center justify-center text-gray-500">Loading Team Activity Data...</div>;
  }

  return (
    <div className={`rounded-2xl p-6 shadow-lg border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
      <div className="flex flex-col mb-8 gap-4">
        {adminView && (
          <h2 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
            <i className="fas fa-desktop mr-3 text-blue-500"></i> Activity Monitor
          </h2>
        )}
        <div className={`p-4 rounded-xl border ${isDark ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"} grid grid-cols-1 sm:grid-cols-2 ${adminView ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-4`}>
          
          {adminView && (
            <div className="flex flex-col gap-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => {
                    setSelectedDepartment(e.target.value);
                    setSelectedEmployee("all");
                }}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none cursor-pointer ${isDark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-800"}`}
              >
                <option value="all">All Departments</option>
                {uniqueDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept.toUpperCase()}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none cursor-pointer ${isDark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-800"}`}
            >
              <option value="all">All Team</option>
              {uniqueEmployees.map((emp, index) => (
                <option key={index} value={emp.email}>
                  {emp.name} { (emp.role === "manager" || emp.role === "dept_manager") ? "(Manager)" : "" }
                </option>
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
              <option value="break">Break</option>
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
      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className={isDark ? "bg-gray-700" : "bg-gray-50"}>
            <tr>
              <th className={`px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"} w-[25%]`}>Employee</th>
              <th className={`px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"} w-[12%]`}>Date</th>
              <th className={`px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"} w-[25%]`}>App / Website</th>
              <th className={`px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"} w-[8%]`}>Active</th>
              <th className={`px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"} w-[8%]`}>Idle</th>
              <th className={`px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"} w-[10%]`}>Total</th>
              <th className={`px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"} w-[12%]`}>Status</th>
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
                    <td className="px-2 py-3">
                      <div className="flex items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] bg-gradient-to-br from-blue-500 to-indigo-600 mr-2 shrink-0`}>
                          {(row.user_name || "U")[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <p className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-gray-800"}`}>
                            {row.user_name || "Unknown User"}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {(() => {
                              const u = allUsers.find(user => user.email === row.employee_email);
                              const isMngr = u?.role === "manager" || u?.role === "dept_manager";
                              if (isMngr) {
                                return (
                                  <span className="px-1 py-0.5 bg-violet-100 text-violet-600 rounded text-[9px] font-bold uppercase leading-none border border-violet-200 shrink-0">
                                    Manager
                                  </span>
                                );
                              }
                              return (
                                <span className="px-1 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-bold uppercase leading-none border border-gray-200 shrink-0">
                                  Staff
                                </span>
                              );
                            })()}
                            <p className="text-[10px] text-gray-400 truncate hidden sm:block">{row.employee_email}</p>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className={`px-2 py-3 text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                      {row.date || "N/A"}
                    </td>
                    
                    <td className="px-2 py-3">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <i className={`text-sm shrink-0 ${isWebsite ? 'fas fa-globe text-blue-500' : 'fas fa-window-maximize text-purple-500'}`}></i>
                          <span className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-gray-800"}`} title={appName}>
                            {appName}
                          </span>
                        </div>
                        {row.latest_window_title && row.latest_window_title !== "N/A" && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500 max-w-[200px] sm:max-w-[250px]" title={row.latest_window_title}>
                            <i className="fas fa-desktop shrink-0 opacity-70"></i>
                            <span className="truncate">{row.latest_window_title}</span>
                          </div>
                        )}
                        {row.latest_url && row.latest_url !== "N/A" && (
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-400 max-w-[200px] sm:max-w-[250px]" title={row.latest_url}>
                            <i className="fas fa-link shrink-0 opacity-70"></i>
                            <a href={row.latest_url.startsWith('http') ? row.latest_url : `https://${row.latest_url}`} target="_blank" rel="noopener noreferrer" className="truncate hover:text-blue-500 transition-colors">
                              {row.latest_url}
                            </a>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className={`px-2 py-3 text-center text-xs font-bold text-emerald-500`}>
                      {formatDuration(row.active_time_seconds)}
                    </td>
                    
                    <td className={`px-2 py-3 text-center text-xs font-bold text-rose-500`}>
                      {formatDuration(row.idle_time_seconds)}
                    </td>
                    
                    <td className={`px-2 py-3 text-center text-xs font-bold ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                      {formatDuration(row.total_time_seconds)}
                    </td>
                    
                    <td className="px-2 py-3 text-center">
                      {appName === "Break Mode (Away)" ? (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 ring-1 ring-gray-200 rounded text-[9px] font-bold uppercase">
                          Break
                        </span>
                      ) : (row.idle_time_seconds || 0) > (row.active_time_seconds || 0) ? (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 ring-1 ring-amber-200 rounded text-[9px] font-bold uppercase">
                          Low Activity
                        </span>
                      ) : (row.idle_time_seconds || 0) > 0 && (row.idle_time_seconds || 0) === (row.active_time_seconds || 0) ? (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 ring-1 ring-blue-200 rounded text-[9px] font-bold uppercase">
                          Moderate
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 rounded text-[9px] font-bold uppercase">
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