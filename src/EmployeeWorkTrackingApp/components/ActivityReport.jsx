import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase"; 

export default function ActivityReport({ currentUserEmail, isDark }) {
  const [trackingData, setTrackingData] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="p-4 text-center">Loading Activity Data...</div>;
  }

  return (
    <div className={`rounded-2xl p-6 shadow-lg border mt-6 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
      <h2 className={`text-xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"}`}>
        <i className="fas fa-desktop mr-2 text-blue-500"></i> My Application Usage
      </h2>

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
            {trackingData.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-gray-500 italic">
                  No tracking data found.
                </td>
              </tr>
            ) : (
              trackingData.map((row) => {
                // NAYA LOGIC: Purane data ko handle karne ke liye
                const appName = row.app_or_website || row.app_used || "Unknown App";
                const isWebsite = appName.includes('.com') || appName.includes('.in') || appName.includes('.org');

                return (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
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
                      {row.latest_url && row.latest_url !== "N/A" && (
                         <p className="text-xs text-gray-400 mt-1 max-w-[200px] truncate">{row.latest_url}</p>
                      )}
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
                      {/* Agar idle time active time se zyada hai, toh Warning dikhayenge */}
                      {(row.idle_time_seconds || 0) > (row.active_time_seconds || 0) ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 ring-1 ring-amber-200 rounded-full text-xs font-bold uppercase tracking-wider">
                          Low Activity
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