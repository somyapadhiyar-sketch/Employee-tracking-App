import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CompactDatePicker from "./CompactDatePicker";
import { 
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  LineChart,
  Line,
  Cell,
} from "recharts";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

export default function TeamDynamics({ isDark, dept, deptEmployees = [], hideHeader = false, propStartDate, propEndDate }) {
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [startDate, setStartDate] = useState(() => propStartDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [endDate, setEndDate] = useState(() => propEndDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));

  useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
    if (propEndDate) setEndDate(propEndDate);
  }, [propStartDate, propEndDate]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [analyticsSnap, logsSnap, leaveSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "employee_analytics")),
          getDocs(collection(db, "workLogs")),
          getDocs(collection(db, "leaveRequests")),
          getDocs(collection(db, "users")),
        ]);

        const aData = analyticsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const lLogs = logsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const lReqs = leaveSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const currentAllUsers = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        setAnalyticsData(aData);
        setWorkLogs(lLogs);
        setLeaveRequests(lReqs);
        setAllUsers(currentAllUsers);
      } catch (error) {
        console.error("Error fetching dynamics data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 1. Scatter Plot Data: Anomaly Detection (Active vs Idle) - All Employees in the system
  const scatterData = useMemo(() => {
    // Show all approved employees (or ALL employees) in anomaly detection
    const systemEmployees = allUsers.filter(u => u.status === 'approved' && u.role !== 'admin');
    return systemEmployees.map((emp) => {
      const empAnalytics = analyticsData.filter(
        (a) => a.employee_email === emp.email && a.date >= startDate && a.date <= endDate
      );
      const active = empAnalytics.reduce((acc, curr) => acc + (curr.active_time_seconds || 0), 0) / 60;
      const idle   = empAnalytics.reduce((acc, curr) => acc + (curr.idle_time_seconds  || 0), 0) / 60;
      return {
        name:   `${emp.firstName} ${emp.lastName}`,
        active: Math.round(active),
        idle:   Math.round(idle),
        z: 10,
      };
    }).filter(emp => emp.active > 0 || emp.idle > 0); // hide employees with no tracking data in period
  }, [analyticsData, allUsers, startDate, endDate]);

  // 2. Area Chart Data: Peak Productivity Hours (9 AM - 6 PM) - Average across period
  const trendData = useMemo(() => {
    const hourlyData = Array.from({ length: 10 }, (_, i) => ({
      hour: i + 9,
      time: `${i + 9}:00`,
      productivity: 0,
    }));

    const teamEmails = deptEmployees.map((e) => e.email);
    
    // Filter to pertinent data in date range
    const activeLogs = analyticsData.filter((row) => 
      row.date >= startDate && 
      row.date <= endDate && 
      teamEmails.includes(row.employee_email) && 
      row.last_updated
    );

    // Calculate actual active days to average properly (avoid weekends/holiday drops)
    const distinctDates = new Set(activeLogs.map(r => r.date));
    const activeDaysCount = distinctDates.size || 1; // fallback to 1 to avoid NaN

    activeLogs.forEach((row) => {
      const h = new Date(row.last_updated).getHours();
      if (h >= 9 && h <= 18) {
        const index = h - 9;
        if (hourlyData[index]) {
          hourlyData[index].productivity += (row.active_time_seconds || 0) / 60;
        }
      }
    });

    return hourlyData.map(d => ({
      ...d,
      time: d.hour > 12 ? `${d.hour - 12} PM` : d.hour === 12 ? '12 PM' : `${d.hour} AM`,
      productivity: Math.round(d.productivity / activeDaysCount) // Average per active day
    }));
  }, [analyticsData, deptEmployees, startDate, endDate]);

  // 3. Horizontal Bar Chart: Leave Trends (Based on Range)
  const leaveData = useMemo(() => {
    const d1 = new Date(startDate);
    const d2 = new Date(endDate);
    const totalDays = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;

    return deptEmployees.map((emp) => {
      // Present Days: distinct dates worked
      const userAnalytics = analyticsData.filter(a => a.employee_email === emp.email && a.date >= startDate && a.date <= endDate);
      const distinctPresentDates = new Set(userAnalytics.map(a => a.date));
      const presentDays = distinctPresentDates.size;

      // Leave Days
      const userLeaves = leaveRequests.filter((r) => 
        r.employeeId === emp.id && 
        r.status === "approved" && 
        r.startDate <= endDate && 
        r.endDate >= startDate
      );
      
      let leaveDays = 0;
      userLeaves.forEach(r => {
        const s = r.startDate > startDate ? new Date(r.startDate) : new Date(startDate);
        const e = r.endDate < endDate ? new Date(r.endDate) : new Date(endDate);
        const diff = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1;
        
        if (r.leaveDuration === "half" || r.leaveDuration === "first_half" || r.leaveDuration === "second_half") {
          leaveDays += 0.5;
        } else {
          leaveDays += diff;
        }
      });

      const absentDays = Math.max(0, totalDays - presentDays - leaveDays);

      return {
        name: emp.firstName,
        presentDays,
        leaveDays,
        absentDays,
        totalActivity: presentDays + leaveDays, // for sorting purposes
      };
    }).sort((a, b) => b.totalActivity - a.totalActivity).slice(0, 10);
  }, [deptEmployees, analyticsData, leaveRequests, startDate, endDate]);

  // 4. Composed Chart: Target vs Achieved (Period Totals)
  const targetData = useMemo(() => {
    const dayDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    return deptEmployees.map((emp) => {
      const empLogs = workLogs.filter((l) => l.employeeId === emp.id && l.date >= startDate && l.date <= endDate);
      const totalHours = empLogs.reduce((acc, curr) => acc + (curr.hours || 0), 0);

      return {
        name: emp.firstName,
        hours: Math.round(totalHours * 10) / 10,
        target: 8 * dayDiff, // 8h per day
      };
    }).sort((a, b) => b.hours - a.hours).slice(0, 12);
  }, [workLogs, deptEmployees, startDate, endDate]);

  // 5. Gantt Chart: Punctuality & Shift Timeline (9 AM - 6 PM)
  const ganttData = useMemo(() => {
    const startTimeStr = "09:00:00";
    const endTimeStr = "18:00:00";
    const isSingleDay = startDate === endDate;

    const getMinutes = (timeStr) => {
      if (!timeStr) return null;
      try {
        const t = timeStr.includes(',') ? timeStr.split(',')[1].trim() : timeStr;
        const [hPart, mPart] = t.split(':');
        let hours = parseInt(hPart);
        const minutes = parseInt(mPart);
        if (t.toLowerCase().includes('pm') && hours < 12) hours += 12;
        if (t.toLowerCase().includes('am') && hours === 12) hours = 0;
        return hours * 60 + minutes;
      } catch (e) { return null; }
    };

    const startMins = getMinutes(startTimeStr);
    const endMins = getMinutes(endTimeStr);
    const totalDayMins = endMins - startMins;

    return deptEmployees.map((emp) => {
      let loginMins = null;
      let logoutMins = null;

      if (isSingleDay) {
        // Use exact day logs if range is 1 day
        const dayLogs = analyticsData.filter(a => a.employee_email === emp.email && a.date === startDate);
        if (dayLogs.length > 0) {
          // Simplification: use earliest log of the day as login
          const sorted = dayLogs.sort((a, b) => {
            const tA = a.last_updated?.toDate ? a.last_updated.toDate() : new Date(a.last_updated);
            const tB = b.last_updated?.toDate ? b.last_updated.toDate() : new Date(b.last_updated);
            return tA - tB;
          });
          const firstLog = sorted[0];
          const lastLog = sorted[sorted.length - 1];
          
          const firstDate = firstLog.last_updated?.toDate ? firstLog.last_updated.toDate() : new Date(firstLog.last_updated);
          loginMins = firstDate.getHours() * 60 + firstDate.getMinutes();
          
          const lastDate = lastLog.last_updated?.toDate ? lastLog.last_updated.toDate() : new Date(lastLog.last_updated);
          logoutMins = lastDate.getHours() * 60 + lastDate.getMinutes();
        }
      } else {
        // Calculate average for multiple days
        const rangeLogs = analyticsData.filter(a => a.employee_email === emp.email && a.date >= startDate && a.date <= endDate);
        const logsByDate = {};
        rangeLogs.forEach(log => {
          if (!logsByDate[log.date]) logsByDate[log.date] = [];
          logsByDate[log.date].push(log);
        });

        const arrivals = [];
        const departures = [];
        Object.values(logsByDate).forEach(dayLogs => {
          const sorted = dayLogs.sort((a, b) => {
            const tA = a.last_updated?.toDate ? a.last_updated.toDate() : new Date(a.last_updated);
            const tB = b.last_updated?.toDate ? b.last_updated.toDate() : new Date(b.last_updated);
            return tA - tB;
          });
          const first = sorted[0].last_updated?.toDate ? sorted[0].last_updated.toDate() : new Date(sorted[0].last_updated);
          arrivals.push(first.getHours() * 60 + first.getMinutes());
          
          const last = sorted[sorted.length-1].last_updated?.toDate ? sorted[sorted.length-1].last_updated.toDate() : new Date(sorted[sorted.length-1].last_updated);
          departures.push(last.getHours() * 60 + last.getMinutes());
        });

        if (arrivals.length > 0) {
          loginMins = arrivals.reduce((a, b) => a + b, 0) / arrivals.length;
          logoutMins = departures.reduce((a, b) => a + b, 0) / departures.length;
        }
      }

      if (!loginMins) return { name: emp.firstName, gap: totalDayMins, shift: 0, status: 'Absent' };

      const clampLogin = Math.max(startMins, loginMins);
      const clampLogout = logoutMins ? Math.min(endMins, logoutMins) : clampLogin;

      const gap = Math.max(0, clampLogin - startMins);
      const shift = Math.max(0, clampLogout - clampLogin);
      const remaining = Math.max(0, endMins - clampLogout);

      return {
        name: emp.firstName,
        gap,
        shift,
        remaining,
        isLate: loginMins > (startMins + 15), 
        isEarlyOut: logoutMins < endMins,
        loginTime: loginMins ? `${Math.floor(loginMins / 60)}:${(Math.round(loginMins % 60)).toString().padStart(2, '0')}` : 'N/A',
        logoutTime: logoutMins ? `${Math.floor(logoutMins / 60)}:${(Math.round(logoutMins % 60)).toString().padStart(2, '0')}` : 'N/A',
      };
    });
  }, [deptEmployees, analyticsData, startDate, endDate]);

  // 6. Leaderboard Data: Top 5 & Bottom 5 Productivity (Selected Trend)
  const leaderboardData = useMemo(() => {
    const dayDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    const rangeDays = [];
    // Show up to 7 days in the trend line for each employee
    const trendCount = Math.min(dayDiff, 7);
    for (let i = trendCount - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      rangeDays.push(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
    }

    const leaderboard = deptEmployees.map((emp) => {
      const history = rangeDays.map(dateStr => {
        const dayLogs = analyticsData.filter(a => a.employee_email === emp.email && a.date === dateStr);
        const active = dayLogs.reduce((acc, curr) => acc + (Number(curr.active_time_seconds) || 0), 0);
        const idle = dayLogs.reduce((acc, curr) => acc + (Number(curr.idle_time_seconds) || 0), 0);
        const total = active + idle;
        return {
          date: dateStr,
          score: total > 0 ? Math.round((active / total) * 100) : 0
        };
      });

      // Overall score for the ENTIRE selected range
      const rangeLogs = analyticsData.filter(a => a.employee_email === emp.email && a.date >= startDate && a.date <= endDate);
      const totalActive = rangeLogs.reduce((acc, curr) => acc + (Number(curr.active_time_seconds) || 0), 0);
      const totalIdle = rangeLogs.reduce((acc, curr) => acc + (Number(curr.idle_time_seconds) || 0), 0);
      const overallScore = (totalActive + totalIdle) > 0 
        ? Math.round((totalActive / (totalActive + totalIdle)) * 100) 
        : 0;

      const currentScore = history.length > 0 ? history[history.length - 1].score : 0;
      const trend = history.map(h => h.score);
      const isImproving = trend.length >= 2 ? currentScore >= (trend[0] || 0) : true;

      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        score: overallScore, // Show overall period score
        trend: history,
        isImproving
      };
    });

    const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
    return {
      top: sorted.slice(0, 5),
      bottom: sorted.slice(Math.max(0, sorted.length - 5)).reverse()
    };
  }, [analyticsData, deptEmployees, startDate, endDate]);

  // 7. Burnout Risk: Based on high work hours & low breaks in selected range
  const burnoutData = useMemo(() => {
    return deptEmployees.map((emp) => {
      const rangeLogs = analyticsData.filter(a => a.employee_email === emp.email && a.date >= startDate && a.date <= endDate);
      
      const distinctDates = new Set(rangeLogs.map(r => r.date));
      const activeDaysCount = distinctDates.size || 1;

      const activeTotal = rangeLogs.reduce((acc, curr) => acc + (Number(curr.active_time_seconds) || 0), 0);
      const avgDailyHours = (activeTotal / 3600) / activeDaysCount;
      
      const idleTotal = rangeLogs.reduce((acc, curr) => acc + (Number(curr.idle_time_seconds) || 0), 0);
      const breakRatio = (activeTotal + idleTotal) > 0 ? idleTotal / (activeTotal + idleTotal) : 0.2;

      let risk = 'Safe';
      let color = '#22c55e'; // Green
      let icon = 'fa-check-circle';

      if (avgDailyHours > 10 && breakRatio < 0.08) {
        risk = 'Danger';
        color = '#ef4444'; // Red
        icon = 'fa-fire';
      } else if (avgDailyHours > 9 || breakRatio < 0.12) {
        risk = 'Warning';
        color = '#f59e0b'; // Yellow/Amber
        icon = 'fa-exclamation-triangle';
      }

      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        risk,
        color,
        icon,
        avgHours: Math.round(avgDailyHours * 10) / 10,
        avgBreak: Math.round(breakRatio * 100)
      };
    });
  }, [analyticsData, deptEmployees, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      // Special styling for Target vs Achieved if it's the target chart data
      if (payload.some(p => p.name === "Logged Hours" || p.name === "Total Hours Target")) {
        return (
          <div className="bg-white p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-gray-50 flex flex-col gap-1 min-w-[140px]">
            <p className="text-gray-800 font-black text-base">{data.name}</p>
            <p className="text-violet-500 font-bold text-xs">Logged Hours: {data.hours || 0}</p>
            <p className="text-rose-500 font-bold text-xs">Target Hours: {data.target || 8}</p>
          </div>
        );
      }

      return (
        <div className={`p-3 rounded-xl shadow-xl border ${isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-100 text-gray-800"}`}>
          <p className="font-bold mb-1">{data.name || label}</p>
          {payload.map((p, index) => (
            <p key={index} className="text-xs" style={{ color: p.color }}>
              {p.name}: {p.value} {p.unit || ""}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {!hideHeader && (
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 mb-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="min-w-0 flex-1 lg:flex-none"
          >
            <h1 className={`text-2xl sm:text-3xl font-bold leading-tight truncate ${isDark ? "text-white" : "text-gray-900"}`}>
              My Team - {dept || "Department Dynamics"}
            </h1>
            <p className={`text-sm mt-1 sm:mt-0 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Live tracking and productivity analysis of all employees across your department.
            </p>
          </motion.div>

          {/* Date Range Picker - Keep it here for side-by-side if header is shown */}
          <div className={`w-full lg:w-auto px-1.5 sm:px-4 py-1 sm:py-0 h-auto sm:h-[40px] rounded-2xl shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 ${isDark ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex items-center gap-3 px-1 sm:px-0">
              <i className="fas fa-calendar-alt text-violet-500"></i>
              <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>Period:</span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="w-[115px] sm:w-[130px]">
                <CompactDatePicker
                  value={startDate}
                  onChange={(val) => setStartDate(val)}
                  isDark={isDark}
                  themeColor="violet"
                  size="sm"
                />
              </div>
              <span className={`shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                <i className="fas fa-arrow-right text-[10px]"></i>
              </span>
              <div className="w-[115px] sm:w-[130px]">
                <CompactDatePicker
                  value={endDate}
                  onChange={(val) => setEndDate(val)}
                  isDark={isDark}
                  themeColor="violet"
                  align="right"
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">

        {/* 1. Scatter Plot: Anomaly Detection */}
        <motion.div
          whileHover={{ y: -5 }}
          className={`p-5 rounded-3xl shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Anomaly Detection</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active vs Idle Time (Mins)</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <i className="fas fa-search-location"></i>
            </div>
          </div>
          <div className="h-[180px]">
            {scatterData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2">
                <i className="fas fa-search text-2xl text-gray-300"></i>
                <p className="text-xs font-bold text-gray-400 text-center">No tracking data<br/>for this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#f1f5f9"} vertical={false} />
                  <XAxis
                    type="number"
                    dataKey="active"
                    name="Active"
                    unit="m"
                    stroke={isDark ? "#9ca3af" : "#64748b"}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: 'Active Time (min)', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#9ca3af' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="idle"
                    name="Idle"
                    unit="m"
                    stroke={isDark ? "#9ca3af" : "#64748b"}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: 'Idle Time (min)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9ca3af' }}
                  />
                  <ZAxis type="number" dataKey="z" range={[100, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter name="Employees" data={scatterData} fill="#8884d8">
                    {scatterData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.idle > entry.active ? '#f43f5e' : '#10b981'}
                        fillOpacity={0.8}
                        stroke={entry.idle > entry.active ? '#9f1239' : '#065f46'}
                        strokeWidth={2}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-bold text-gray-500">PRODUCTIVE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <span className="text-[10px] font-bold text-gray-500">OUTLIER (HIGH IDLE)</span>
            </div>
          </div>
        </motion.div>

        {/* 2. Area Chart: Peak Productivity Hours */}
        <motion.div
          whileHover={{ y: -5 }}
          className={`p-5 rounded-3xl shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Peak Productivity Trends</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Team Focus Wave (Avg per day)</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-500">
              <i className="fas fa-chart-area"></i>
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#f1f5f9"} vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke={isDark ? "#9ca3af" : "#64748b"}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="productivity"
                  stroke="#06b6d4"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorProd)"
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 3. Horizontal Bar Chart: Leave Trends */}
        <motion.div
          whileHover={{ y: -5 }}
          className={`p-5 rounded-3xl shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Leave & Attendance</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Present vs Leave vs Absent</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <i className="fas fa-calendar-minus"></i>
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={leaveData} margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#f1f5f9"} horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke={isDark ? "#9ca3af" : "#64748b"}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="presentDays" name="Present Days" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={20} />
                <Bar dataKey="leaveDays" name="Leave Days" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={20} />
                <Bar dataKey="absentDays" name="Absent Days" stackId="a" fill="#f43f5e" radius={[0, 10, 10, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          whileHover={{ y: -5 }}
          className={`p-5 rounded-3xl shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Overall Period Progress</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Hours vs Target</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500">
              <i className="fas fa-bullseye"></i>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={targetData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    dy={5}
                />
                <YAxis 
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 8]}
                    ticks={[0, 2, 4, 6, 8]}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Legend 
                    verticalAlign="bottom" 
                    align="center"
                    content={({ payload }) => (
                        <div className="flex justify-center gap-6 mt-2">
                            {payload.map((entry, index) => (
                                <div key={`item-${index}`} className="flex items-center gap-2">
                                    {entry.dataKey === 'hours' ? (
                                        <div className="w-5 h-3" style={{ backgroundColor: entry.color }}></div>
                                    ) : (
                                        <div className="flex items-center">
                                            <div className="w-3 h-0.5" style={{ backgroundColor: entry.color }}></div>
                                            <div className="w-2 h-2 rounded-full border-2" style={{ borderColor: entry.color }}></div>
                                            <div className="w-3 h-0.5" style={{ backgroundColor: entry.color }}></div>
                                        </div>
                                    )}
                                    <span style={{ color: entry.color }} className="text-sm font-bold opacity-80">
                                        {entry.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                />
                <Bar dataKey="hours" name="Logged Hours" fill="#8357ff" radius={[4, 4, 0, 0]} barSize={25} />
                <Line 
                    type="monotone" 
                    dataKey="target" 
                    name="Total Hours Target" 
                    stroke="#ff4d6d" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: "#ff4d6d", stroke: "#fff", strokeWidth: 2 }} 
                    activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 5. Shift Timeline (Gantt Chart) */}
        <motion.div
          whileHover={{ y: -5 }}
          className={`p-5 rounded-3xl shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Punctuality & Shift Timeline</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gantt View (9AM - 6PM)</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <i className="fas fa-stream"></i>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={ganttData} margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#f1f5f9"} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 540]}
                  hide
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke={isDark ? "#9ca3af" : "#64748b"}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length >= 2) {
                      const data = payload[0].payload;
                      return (
                        <div className={`p-3 rounded-xl shadow-xl border ${isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-100 text-gray-800"}`}>
                          <p className="font-bold mb-1">{data.name}</p>
                          <p className="text-xs">Login: <span className="font-bold">{data.loginTime}</span></p>
                          {data.logoutTime !== 'N/A' && <p className="text-xs">Logout: <span className="font-bold">{data.logoutTime}</span></p>}
                          <div className="mt-2 text-[10px] font-bold">
                            {data.isLate && <span className="text-rose-500 mr-2">● LATE ARRIVAL</span>}
                            {data.isEarlyOut && <span className="text-amber-500">● EARLY LOGOUT</span>}
                            {!data.isLate && !data.isEarlyOut && data.shift > 0 && <span className="text-emerald-500">● ON TIME</span>}
                            {data.shift === 0 && <span className="text-gray-500">● ABSENT / NO CLOCK-IN</span>}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="gap" stackId="a" fill="transparent" />
                <Bar dataKey="shift" stackId="a" radius={[4, 4, 4, 4]} barSize={20}>
                  {ganttData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isLate ? '#f43f5e' : entry.isEarlyOut ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
                <Bar dataKey="remaining" stackId="a" fill="transparent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-gray-400 px-10">
            <span className="flex flex-col items-center"><span>9 AM</span><span className="w-px h-2 bg-gray-300 mt-1"></span></span>
            <span className="flex flex-col items-center"><span>12 PM</span><span className="w-px h-2 bg-gray-300 mt-1"></span></span>
            <span className="flex flex-col items-center"><span>3 PM</span><span className="w-px h-2 bg-gray-300 mt-1"></span></span>
            <span className="flex flex-col items-center"><span>6 PM</span><span className="w-px h-2 bg-gray-300 mt-1"></span></span>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500"></div>
              <span className="text-[10px] font-bold text-gray-500">ON TIME</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-rose-500"></div>
              <span className="text-[10px] font-bold text-gray-500">LATE ARRIVAL ({'>'}9:15)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500"></div>
              <span className="text-[10px] font-bold text-gray-500">EARLY LOGOUT ({'<'}6:00)</span>
            </div>
          </div>
        </motion.div>

        {/* 6. Team Leaderboard with Sparklines */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top 5 Performers */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className={`p-4 rounded-2xl sm:rounded-3xl shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
                  Top Performers 🔥
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Ranked by Productivity</p>
              </div>
            </div>
            <div className="space-y-4">
              {leaderboardData.top.map((emp, index) => (
                <div key={emp.id} className={`flex items-center justify-between p-2 rounded-xl ${isDark ? "bg-gray-700/30" : "bg-emerald-50/30"} border transition-all hover:translate-x-1 ${isDark ? "border-gray-700" : "border-emerald-50"}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-500/20">
                      {index + 1}
                    </span>
                    <div>
                      <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-800"}`}>{emp.name}</p>
                      <p className="text-[10px] font-black text-emerald-500 uppercase">{emp.score}% SCORE</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={emp.trend}>
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={false}
                            animationDuration={1500}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className={`text-sm ${emp.isImproving ? "text-emerald-500" : "text-rose-500"}`}>
                      <i className={`fas fa-caret-${emp.isImproving ? 'up' : 'down'}`}></i>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Bottom 5 Need Attention */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className={`p-4 rounded-2xl sm:rounded-3xl shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
                  Need Attention ⚠️
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Low Productivity Zones</p>
              </div>
            </div>
            <div className="space-y-4">
              {leaderboardData.bottom.map((emp, index) => (
                <div key={emp.id} className={`flex items-center justify-between p-2 rounded-xl ${isDark ? "bg-gray-700/30" : "bg-rose-50/30"} border transition-all hover:translate-x-1 ${isDark ? "border-gray-700" : "border-rose-50"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-lg bg-rose-500 text-white text-xs font-black shadow-md shadow-rose-500/20`}>
                      {leaderboardData.bottom.length - index}
                    </span>
                    <div>
                      <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-800"}`}>{emp.name}</p>
                      <p className="text-[10px] font-black text-rose-500 uppercase">{emp.score}% SCORE</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={emp.trend}>
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#f43f5e"
                            strokeWidth={2}
                            dot={false}
                            animationDuration={1500}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className={`text-sm ${emp.isImproving ? "text-emerald-500" : "text-rose-500"}`}>
                      <i className={`fas fa-caret-${emp.isImproving ? 'up' : 'down'}`}></i>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* 7. Burnout Risk Indicator (Heatmap Matrix) */}
        <motion.div
          whileHover={{ y: -5 }}
          className={`p-5 rounded-3xl shadow-xl border lg:col-span-2 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Burnout Risk Matrix 🔥</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Team Health Monitor (Selected Period)</p>
            </div>
            <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase ${isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"}`}>
              Health Check
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {burnoutData.map((emp) => (
              <div
                key={emp.id}
                className={`p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${isDark ? "bg-gray-700/30 border-gray-600" : "bg-gray-50 border-gray-100"}`}
                style={{ borderLeft: `6px solid ${emp.color}` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-800"}`}>{emp.name}</p>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full`} style={{ backgroundColor: `${emp.color}20`, color: emp.color }}>
                      {emp.risk}
                    </span>
                  </div>
                  <i className={`fas ${emp.icon} text-lg`} style={{ color: emp.color }}></i>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-gray-400">
                    <span>AVG WORK</span>
                    <span className={isDark ? "text-gray-300" : "text-gray-700"}>{emp.avgHours}H</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-400">
                    <span>BREAK RATIO</span>
                    <span className={isDark ? "text-gray-300" : "text-gray-700"}>{emp.avgBreak}%</span>
                  </div>
                </div>
                <div className="mt-3 w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (emp.avgHours / 12) * 100)}%`, backgroundColor: emp.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[10px] font-black text-gray-400 px-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> SAFE (Balanced)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> WARNING (9h+ Work)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> DANGER (10h+ & Min. Breaks)
            </div>
          </div>
        </motion.div>

      </div>

      <div className={`p-6 rounded-3xl border ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-violet-50/50 border-violet-100"}`}>
        <div className="flex items-start gap-4">
          <div className="w-9 sm:w-12 h-9 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white text-base sm:text-xl shadow-lg shrink-0">
            <i className="fas fa-magic"></i>
          </div>
          <div>
            <h4 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Manager's Insight</h4>
            <p className={`text-sm mt-1 leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              The scatter plot highlights employees with unusually high idle time. Use the target chart to ensure all team members hit their daily 8-hour requirement. Productivity waves help you schedule team meetings during "low" focus periods to maximize output.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
