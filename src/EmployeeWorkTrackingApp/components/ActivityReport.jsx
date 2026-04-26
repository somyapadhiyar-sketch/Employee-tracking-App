import React, { useState, useEffect } from "react";
import CompactDatePicker from "./CompactDatePicker";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

export default function ActivityReport({ currentUserEmail, isDark }) {
  const [trackingData, setTrackingData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [startDate, setStartDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [endDate, setEndDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Seconds ko Hours:Minutes:Seconds mein convert karne ka function
  const formatDuration = (totalSeconds) => {
    if (!totalSeconds) return "0s";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60); // Decimal hatane ke liye Math.floor lagaya hai

    let result = "";
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0 || hours > 0) result += `${minutes}m `;
    result += `${seconds}s`;
    return result;
  };

  useEffect(() => {
    const fetchTrackingData = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "employee_analytics"),
          where("employee_email", "==", currentUserEmail)
        );

        const querySnapshot = await getDocs(q);
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

    if (currentUserEmail) {
      fetchTrackingData();
    }
  }, [currentUserEmail]);

  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, selectedStatus, searchTerm]);

  if (loading) {
    return <div className="p-4 text-center">Loading Activity Data...</div>;
  }

  const filteredData = trackingData.filter((row) => {
    const matchesStartDate = !startDate || row.date >= startDate;
    const matchesEndDate = !endDate || row.date <= endDate;
    const matchesDate = matchesStartDate && matchesEndDate;
    
    // Identity Logic
    const appName = row.app_or_website || row.app_used || "";
    const url = row.latest_url || "";
    
    // Status Logic
    const activeTime = row.active_time_seconds || 0;
    const idleTime = row.idle_time_seconds || 0;
    
    let status = "productive";
    if (appName.startsWith("Break Mode")) {
      status = "break";
    } else if (idleTime > activeTime) {
      status = "low";
    } else if (idleTime > 0 && idleTime === activeTime) {
      status = "moderate";
    }
    const matchesStatus = selectedStatus === "all" || status === selectedStatus;

    // Search Logic
    const matchesSearch = appName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          url.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesDate && matchesStatus && matchesSearch;
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  return (
    <div className={`rounded-2xl p-6 shadow-lg border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
      {/* Filters Section */}
      <div className="flex flex-col mb-6 gap-4">
        <div className={`p-4 rounded-xl border ${isDark ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`}>
          
            <div className="flex flex-col gap-1.5 h-full">
              <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>From Date</label>
              <CompactDatePicker
                value={startDate}
                onChange={(val) => setStartDate(val)}
                isDark={isDark}
                themeColor="violet"
              />
            </div>

            <div className="flex flex-col gap-1.5 h-full">
              <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>To Date</label>
              <CompactDatePicker
                value={endDate}
                onChange={(val) => setEndDate(val)}
                isDark={isDark}
                themeColor="violet"
                align="right"
              />
            </div>

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
              <option value="low">Low Activity</option>
              <option value="break">Break</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Search App</label>
            <div className="relative">
              <i className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-gray-500" : "text-gray-400"}`}></i>
              <input
                type="text"
                placeholder="Search app..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none ${isDark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-800"}`}
              />
            </div>
          </div>

        </div>
        
        {/* Active Filters Clear Button */}
        {(startDate !== "" || endDate !== "" || selectedStatus !== "all" || searchTerm !== "") && (
          <div className="flex justify-end">
            <button 
              onClick={() => {
                setStartDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
                setEndDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
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
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Date</th>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>App / Website</th>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Active Time</th>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Idle Time</th>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Total Time</th>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Status</th>
            </tr>
          </thead>

          <tbody className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-100"}`}>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-gray-500 italic">
                  No records found matching your filters.
                </td>
              </tr>
            ) : (
              currentItems.map((row) => {
                // NAYA LOGIC: Purane data ko handle karne ke liye
                const appName = row.app_or_website || row.app_used || "Unknown App";
                const isWebsite = appName.includes('.com') || appName.includes('.in') || appName.includes('.org');

                return (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className={`px-4 py-4 whitespace-nowrap text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                      {row.date || "N/A"}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap overflow-hidden">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <i className={`text-lg shrink-0 ${isWebsite ? 'fas fa-globe text-blue-500' : 'fas fa-window-maximize text-purple-500'}`}></i>
                          <span className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-800"}`} title={appName}>
                            {appName}
                          </span>
                        </div>
                        {row.latest_window_title && row.latest_window_title !== "N/A" && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500 max-w-[250px]" title={row.latest_window_title}>
                            <i className="fas fa-desktop shrink-0 opacity-70"></i>
                            <span className="truncate">{row.latest_window_title}</span>
                          </div>
                        )}
                        {row.latest_url && row.latest_url !== "N/A" && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400 max-w-[250px]" title={row.latest_url}>
                            <i className="fas fa-link shrink-0 opacity-70"></i>
                            <a href={row.latest_url.startsWith('http') ? row.latest_url : `https://${row.latest_url}`} target="_blank" rel="noopener noreferrer" className="truncate hover:text-blue-500 transition-colors">
                              {row.latest_url}
                            </a>
                          </div>
                        )}
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
                      {appName.startsWith("Break Mode") ? (
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 ring-1 ring-gray-200 rounded-full text-xs font-bold uppercase tracking-wider">
                          Break
                        </span>
                      ) : (row.idle_time_seconds || 0) > (row.active_time_seconds || 0) ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 ring-1 ring-amber-200 rounded-full text-xs font-bold uppercase tracking-wider">
                          Low Activity
                        </span>
                      ) : (row.idle_time_seconds || 0) > 0 && (row.idle_time_seconds || 0) === (row.active_time_seconds || 0) ? (
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <p className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={prevPage}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                currentPage === 1
                  ? isDark
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                  : isDark
                  ? "bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
                  : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm"
              }`}
            >
              Previous
            </button>
            <div className={`px-4 py-1.5 rounded-lg text-sm font-bold ${isDark ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-blue-50 text-blue-600 border border-blue-100"}`}>
              Page {currentPage} of {totalPages}
            </div>
            <button
              onClick={nextPage}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                currentPage === totalPages
                  ? isDark
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                  : isDark
                  ? "bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
                  : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}