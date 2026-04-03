import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ZAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';


export default function MyPerformance({ userEmail, userName, isDark, isManagerView, onBack }) {
  const [loading, setLoading] = useState(true);
  const [focusScore, setFocusScore] = useState(0);
  const [heatmapData, setHeatmapData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [appUsageData, setAppUsageData] = useState([]);
  const [peakCurveData, setPeakCurveData] = useState([]);
  const [monthlyProgress, setMonthlyProgress] = useState(0);
  const [monthlyHours, setMonthlyHours] = useState(0);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!userEmail) return;
      setLoading(true);
      try {
        const analyticsSnap = await getDocs(collection(db, "employee_analytics"));
        const analyticsData = analyticsSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter(item => item.employee_email === userEmail);

        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // 1. Efficiency & Goal
        const inRangeAnalytics = analyticsData.filter(log => log.date >= startDate && log.date <= endDate);
        
        let totalActiveRange = inRangeAnalytics.reduce((acc, log) => acc + (log.active_time_seconds || 0), 0);
        let totalIdleRange = inRangeAnalytics.reduce((acc, log) => acc + (log.idle_time_seconds || 0), 0);
        const rangeLogged = totalActiveRange + totalIdleRange;
        setFocusScore(rangeLogged > 0 ? Math.round((totalActiveRange / rangeLogged) * 100) : 0);

        const totalHrs = Math.round(totalActiveRange / 3600);
        setMonthlyHours(totalHrs);
        setMonthlyProgress(Math.min(100, Math.round((totalHrs / 160) * 100)));

        // 2. Activity Heatmap - Based on Range
        const dayDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
        const rangeDays = [];
        for (let i = 0; i < dayDiff; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          const dayLogs = analyticsData.filter(log => log.date === dateStr);
          const active = dayLogs.reduce((acc, log) => acc + (log.active_time_seconds || 0), 0);
          rangeDays.push({ date: dateStr, intensity: active / 3600 });
        }
        setHeatmapData(rangeDays);

        // 3. Breakdown - Max last 14 days if range is long
        const breakdownCount = Math.min(dayDiff, 14);
        const breakdownDays = [];
        for (let i = 0; i < breakdownCount; i++) {
          const d = new Date(endDate);
          d.setDate(d.getDate() - (breakdownCount - 1 - i));
          const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          const dayLogs = analyticsData.filter(log => log.date === dateStr);
          let active = 0, idle = 0;
          dayLogs.forEach(log => {
            active += (log.active_time_seconds || 0);
            idle += (log.idle_time_seconds || 0);
          });
          breakdownDays.push({
            name: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
            Active: Math.round(active / 3600 * 10) / 10,
            Idle: Math.round(idle / 3600 * 10) / 10,
            Break: Math.round(Math.max(0, 8 * 3600 - active - idle) / 3600 * 10) / 10
          });
        }
        setWeeklyData(breakdownDays);

        // 4. Hourly Productivity & App Aggregation
        const appAggregation = {};
        const hourlyGroups = Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          timeLabel: `${i % 12 || 12}${i >= 12 ? 'PM' : 'AM'}`,
          active: 0
        }));

        inRangeAnalytics.forEach(row => {
          const title = (row.latest_window_title || "Unknown").split('-')[0].trim();
          const activeTime = (row.active_time_seconds || 0);

          if (row.last_updated) {
            const h = new Date(row.last_updated).getHours();
            if (h >= 0 && h < 24) {
              hourlyGroups[h].active += activeTime / 60;
            }
          }

          if (!appAggregation[title]) appAggregation[title] = 0;
          appAggregation[title] += activeTime;
        });

        setPeakCurveData(hourlyGroups.filter(g => g.hour >= 8 && g.hour <= 20));

        const appUsageMapped = Object.entries(appAggregation)
          .map(([name, value]) => ({
            name: name.length > 20 ? name.substring(0, 20) + '...' : name,
            minutes: Math.round(value / 60)
          }))
          .sort((a, b) => b.minutes - a.minutes)
          .slice(0, 8);
        setAppUsageData(appUsageMapped);
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [userEmail, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-transparent">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Heatmap intensity helper (GitHub style)
  const getIntensityClass = (hours) => {
    if (hours === 0) return isDark ? "bg-gray-800" : "bg-gray-100";
    if (hours < 2) return "bg-emerald-100";
    if (hours < 4) return "bg-emerald-300";
    if (hours < 6) return "bg-emerald-500";
    return "bg-emerald-700";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-10"
    >
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
        <div>
          <h1 className={`text-3xl sm:text-4xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {isManagerView && userName ? `${userName}'s Analytics` : "Personal Growth Analytics"}
          </h1>
          <p className={`mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {isManagerView ? "Review the employee's performance and motivation trends" : "Track your performance and motivation trends"}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className={`p-4 rounded-3xl border shadow-sm flex items-center gap-4 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
            <div className="flex items-center gap-3">
              <i className="fas fa-calendar-alt text-blue-500"></i>
              <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Period:</span>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none transition-all ${isDark ? "bg-gray-700 border-gray-600 text-white focus:border-blue-500" : "bg-gray-50 border-gray-200 text-gray-700 focus:border-blue-400"}`}
              />
              <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                <i className="fas fa-arrow-right text-[10px]"></i>
              </span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none transition-all ${isDark ? "bg-gray-700 border-gray-600 text-white focus:border-blue-500" : "bg-gray-50 border-gray-200 text-gray-700 focus:border-blue-400"}`}
              />
            </div>
          </div>

          {onBack && (
            <button 
              onClick={onBack}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center border transition-all shadow-lg active:scale-95 shrink-0 ${isDark ? "bg-gray-800 border-gray-700 text-white hover:bg-gray-700" : "bg-white border-gray-200 text-gray-800 hover:bg-gray-50"}`}
            >
              <i className="fas fa-arrow-left"></i>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        
        {/* Monthly Goal Tracker (Compact Card Style) */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className={`p-6 rounded-3xl shadow-xl border flex flex-col justify-between lg:col-span-2 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-4">
             <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Period Goal</h3>
             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                <i className="fas fa-history"></i>
             </div>
          </div>
          <div className="flex-grow flex items-center justify-center py-4">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="42"
                  stroke={isDark ? "#374151" : "#f1f5f9"}
                  strokeWidth="10"
                  fill="transparent"
                />
                <motion.circle
                  cx="50" cy="50" r="42"
                  stroke="#3b82f6"
                  strokeWidth="10"
                  strokeDasharray="263.8"
                  initial={{ strokeDashoffset: 263.8 }}
                  animate={{ strokeDashoffset: 263.8 - (monthlyProgress / 100) * 263.8 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-black ${isDark ? "text-white" : "text-blue-600"}`}>{monthlyProgress}%</span>
              </div>
            </div>
          </div>
          <div className="text-center">
             <p className={`text-3xl font-black ${isDark ? "text-white" : "text-gray-800"}`}>{monthlyHours}<span className="text-sm font-bold text-gray-400"> hrs</span></p>
             <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Total In Period</p>
          </div>
        </motion.div>

        {/* Peak Productivity Curve (Smooth Area Chart) - Now in the Middle */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className={`p-6 rounded-3xl shadow-xl border lg:col-span-2 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Peak Focus</h3>
              <p className={`text-[10px] uppercase font-bold tracking-widest ${isDark ? "text-gray-500" : "text-gray-400"}`}>Hourly Trends</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
              <i className="fas fa-wave-square"></i>
            </div>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={peakCurveData}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#374151" : "#f1f5f9"} />
                <XAxis
                  dataKey="timeLabel"
                  stroke={isDark ? "#9ca3af" : "#64748b"}
                  fontSize={8}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: isDark ? '#1f2937' : '#fff', fontSize: '10px' }}
                  formatter={(value) => [`${Math.round(value)}m`, 'Focus']}
                />
                <Area
                  type="monotone"
                  dataKey="active"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorActive)"
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Daily Productivity Speedometer (Gauge) - Now on the Right */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className={`p-6 rounded-3xl shadow-xl border lg:col-span-2 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Efficiency Meter</h3>
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold ${focusScore >= 80 ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"}`}>
              Average Score
            </span>
          </div>

          <div className="relative w-full aspect-video flex flex-col items-center justify-center">
            <svg viewBox="0 0 100 60" className="w-full max-w-[200px]">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke={isDark ? "#374151" : "#f1f5f9"}
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke={focusScore >= 80 ? "#10b981" : focusScore >= 40 ? "#3b82f6" : "#f43f5e"}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="125.6"
                strokeDashoffset={125.6 - (focusScore / 100) * 125.6}
                className="transition-all duration-1000 ease-out"
              />
              <motion.g
                animate={{ rotate: (focusScore / 100) * 180 - 90 }}
                transition={{ duration: 1.5, type: "spring" }}
                style={{ transformOrigin: "50px 50px" }}
              >
                {/* Invisible bounding circle to force stable rotation center across browsers */}
                <circle cx="50" cy="50" r="50" fill="transparent" />
                <line x1="50" y1="50" x2="50" y2="15" stroke={isDark ? "white" : "#1f2937"} strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="50" cy="50" r="4" fill={isDark ? "white" : "#1f2937"} />
              </motion.g>
            </svg>
            <div className={`mt-2 text-4xl font-black ${focusScore >= 80 ? "text-emerald-500" : focusScore >= 40 ? "text-blue-500" : "text-rose-500"}`}>
              {focusScore}%
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-gray-500" : "text-gray-400"}`}>Efficiency</p>
          </div>
        </motion.div>

        {/* Activity Heatmap (GitHub Style) */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className={`p-6 rounded-3xl shadow-xl border lg:col-span-6 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="mb-6 flex items-center justify-between">
            <h3 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Activity Patterns</h3>
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Selected Period</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {heatmapData.map((day, i) => {
              const dayNumber = day.date.split('-')[2];
              return (
                <motion.div
                  key={day.date}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className={`w-8 h-8 rounded-lg shadow-inner cursor-help transition-all transform hover:scale-110 flex items-center justify-center text-[10px] font-bold ${getIntensityClass(day.intensity)} ${day.intensity > 4 ? "text-white" : "text-gray-500"}`}
                  title={`${day.date}: ${Math.round(day.intensity * 10) / 10} hours logged`}
                >
                  {dayNumber}
                </motion.div>
              );
            })}
          </div>
          <div className="mt-6 flex items-center gap-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <span>Low</span>
            <div className="flex gap-1.5">
              <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded-sm"></div>
              <div className="w-4 h-4 bg-emerald-100 rounded-sm"></div>
              <div className="w-4 h-4 bg-emerald-300 rounded-sm"></div>
              <div className="w-4 h-4 bg-emerald-500 rounded-sm"></div>
              <div className="w-4 h-4 bg-emerald-700 rounded-sm"></div>
            </div>
            <span>High</span>
          </div>
        </motion.div>

        {/* Bottom Row: Weekly Breakdown (40%) & Top Apps (60%) */}
        <div className="lg:col-span-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Weekly Time Breakdown (Stacked Bar) */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className={`p-6 rounded-3xl shadow-xl border lg:col-span-2 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
          >
            <h3 className={`text-xl font-bold mb-8 ${isDark ? "text-white" : "text-gray-800"}`}>Period Breakdown</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#374151" : "#f1f5f9"} />
                  <XAxis dataKey="name" stroke={isDark ? "#9ca3af" : "#64748b"} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: isDark ? '#1f2937' : '#fff' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend />
                  <Bar dataKey="Active" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Idle" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Break" stackId="a" fill="#9ca3af" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Top Apps & Sites (Horizontal Bar Chart) */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className={`p-6 rounded-3xl shadow-xl border lg:col-span-3 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Top Applications & Websites</h3>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Period Usage (Minutes)</p>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={appUsageData}
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDark ? "#374151" : "#f1f5f9"} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke={isDark ? "#9ca3af" : "#64748b"}
                    fontSize={11}
                    width={120}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: isDark ? '#1f2937' : '#fff' }}
                  />
                  <Bar
                    dataKey="minutes"
                    fill="#3b82f6"
                    radius={[0, 10, 10, 0]}
                    barSize={25}
                  >
                    {appUsageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

      </div>

      <div className={`p-8 rounded-3xl border shadow-lg ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-center gap-4 mb-4 text-blue-500">
          <i className="fas fa-lightbulb text-xl"></i>
          <h4 className="font-bold">Growth Tip</h4>
        </div>
        <p className={`text-sm leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Your focus meter is at {focusScore}%. Consistency in your application usage indicates balanced time management.
          Use the heatmap to identify your most productive weekdays and try to recreate that environment!
        </p>
      </div>
    </motion.div>
  );
}
