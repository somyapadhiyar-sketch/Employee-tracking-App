import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
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

export default function TeamDynamics({ isDark, dept, deptEmployees = [], hideHeader = false }) {
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [analyticsSnap, logsSnap, leaveSnap] = await Promise.all([
          getDocs(collection(db, "employee_analytics")),
          getDocs(collection(db, "workLogs")),
          getDocs(collection(db, "leaveRequests")),
        ]);

        const aData = analyticsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const lLogs = logsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const lReqs = leaveSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        setAnalyticsData(aData);
        setWorkLogs(lLogs);
        setLeaveRequests(lReqs);
      } catch (error) {
        console.error("Error fetching dynamics data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 1. Scatter Plot Data: Anomaly Detection (Active vs Idle)
  const scatterData = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const teamEmails = deptEmployees.map((e) => e.email);

    return deptEmployees.map((emp) => {
      const empAnalytics = analyticsData.filter(
        (a) => a.employee_email === emp.email && a.date === today
      );
      const active = empAnalytics.reduce((acc, curr) => acc + (curr.active_time_seconds || 0), 0) / 60; // Minutes
      const idle = empAnalytics.reduce((acc, curr) => acc + (curr.idle_time_seconds || 0), 0) / 60; // Minutes

      return {
        name: `${emp.firstName} ${emp.lastName}`,
        active: Math.round(active),
        idle: Math.round(idle),
        z: 10,
      };
    });
  }, [analyticsData, deptEmployees]);

  // 2. Area Chart Data: Peak Productivity Hours (9 AM - 6 PM)
  const trendData = useMemo(() => {
    const hourlyData = Array.from({ length: 10 }, (_, i) => ({
      hour: i + 9,
      time: `${i + 9}:00`,
      productivity: 0,
    }));

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const teamEmails = deptEmployees.map((e) => e.email);

    analyticsData.forEach((row) => {
      if (row.date === today && teamEmails.includes(row.employee_email) && row.last_updated) {
        const h = new Date(row.last_updated).getHours();
        if (h >= 9 && h <= 18) {
          const index = h - 9;
          if (hourlyData[index]) {
            hourlyData[index].productivity += (row.active_time_seconds || 0) / 60;
          }
        }
      }
    });

    return hourlyData.map(d => ({
      ...d,
      time: d.hour > 12 ? `${d.hour - 12} PM` : d.hour === 12 ? '12 PM' : `${d.hour} AM`,
      productivity: Math.round(d.productivity)
    }));
  }, [analyticsData, deptEmployees]);

  // 3. Horizontal Bar Chart: Leave & Attendance Trends
  const leaveData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return deptEmployees.map((emp) => {
      const monthLeaves = leaveRequests.filter((r) => {
        if (r.employeeId !== emp.id || r.status !== "approved") return false;
        const d = new Date(r.startDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      // Total used leaves across all time to calculate balance (Simplified)
      const totalUsed = leaveRequests
        .filter((r) => r.employeeId === emp.id && r.status === "approved")
        .reduce((sum, r) => {
          // Basic duration calculation if not provided
          const s = new Date(r.startDate);
          const e = new Date(r.endDate);
          const diff = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1;
          return sum + diff;
        }, 0);

      return {
        name: emp.firstName,
        leavesThisMonth: monthLeaves.length,
        balanceRemaining: Math.max(0, 20 - totalUsed), // Assuming 20 days total policy
      };
    }).sort((a, b) => b.leavesThisMonth - a.leavesThisMonth).slice(0, 10);
  }, [leaveRequests, deptEmployees]);

  // 4. Composed Chart: Target vs Achieved (Logged Hours vs 8h Line)
  const targetData = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return deptEmployees.map((emp) => {
      const empLogs = workLogs.filter((l) => l.employeeId === emp.id && l.date === today);
      const totalHours = empLogs.reduce((acc, curr) => acc + (curr.hours || 0), 0);

      return {
        name: emp.firstName,
        hours: Math.round(totalHours * 10) / 10,
        target: 8,
      };
    }).sort((a, b) => b.hours - a.hours).slice(0, 12);
  }, [workLogs, deptEmployees]);

  // 5. Gantt Chart: Punctuality & Shift Timeline (9 AM - 6 PM)
  const ganttData = useMemo(() => {
    const startTimeStr = "09:00:00";
    const endTimeStr = "18:00:00";
    const todayDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    const getMinutes = (timeStr) => {
      if (!timeStr) return null;
      // Extract time if it's a full locale string like "4/1/2026, 9:52:42 AM"
      const t = timeStr.includes(',') ? timeStr.split(',')[1].trim() : timeStr;
      const [hPart, mPart, sPart] = t.split(':');
      let hours = parseInt(hPart);
      const minutes = parseInt(mPart);
      if (t.toLowerCase().includes('pm') && hours < 12) hours += 12;
      if (t.toLowerCase().includes('am') && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    const startMins = getMinutes(startTimeStr);
    const endMins = getMinutes(endTimeStr);
    const totalDayMins = endMins - startMins;

    return deptEmployees.map((emp) => {
      let loginMins = null;
      let logoutMins = null;

      if (emp.lastClockInDate === todayDate && emp.lastClockInTime) {
        loginMins = getMinutes(emp.lastClockInTime);
      }

      if (emp.lastClockOutDate === todayDate && emp.lastClockOutTime) {
        logoutMins = getMinutes(emp.lastClockOutTime);
      } else if (emp.clockedIn && emp.lastClockInDate === todayDate) {
        // Still clocked in, use current time (clamped to 6 PM)
        logoutMins = Math.min(endMins, getMinutes(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })));
      }

      if (!loginMins) return { name: emp.firstName, gap: totalDayMins, shift: 0, status: 'Absent' };

      // Calculate shift bar
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
        isLate: loginMins > (startMins + 15), // 15 mins grace
        isEarlyOut: logoutMins < endMins && !emp.clockedIn,
        loginTime: loginMins ? `${Math.floor(loginMins / 60)}:${(loginMins % 60).toString().padStart(2, '0')}` : 'N/A',
        logoutTime: logoutMins ? `${Math.floor(logoutMins / 60)}:${(logoutMins % 60).toString().padStart(2, '0')}` : 'N/A',
      };
    });
  }, [deptEmployees]);

  // 6. Leaderboard Data: Top 5 & Bottom 5 Productivity (7-Day Trend)
  const leaderboardData = useMemo(() => {
    const today = new Date();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      last7Days.push(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
    }

    const leaderboard = deptEmployees.map((emp) => {
      const history = last7Days.map(dateStr => {
        const dayLogs = analyticsData.filter(a => a.employee_email === emp.email && a.date === dateStr);
        const active = dayLogs.reduce((acc, curr) => acc + (curr.active_time_seconds || 0), 0);
        const idle = dayLogs.reduce((acc, curr) => acc + (curr.idle_time_seconds || 0), 0);
        const total = active + idle;
        return {
          date: dateStr,
          score: total > 0 ? Math.round((active / total) * 100) : 0
        };
      });

      const currentScore = history[history.length - 1].score;
      const trend = history.map(h => h.score);
      const isImproving = trend.length >= 2 ? currentScore >= (trend[0] || 0) : true;

      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        score: currentScore,
        trend: history,
        isImproving
      };
    });

    const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
    return {
      top: sorted.slice(0, 5),
      bottom: sorted.slice(Math.max(0, sorted.length - 5)).reverse()
    };
  }, [analyticsData, deptEmployees]);

  // 7. Burnout Risk Data: (Total Hours vs Break Ratio over last 3 days)
  const burnoutData = useMemo(() => {
    const today = new Date();
    const last3Days = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      last3Days.push(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
    }

    return deptEmployees.map((emp) => {
      const history = last3Days.map(dateStr => {
        const dayLogs = analyticsData.filter(a => a.employee_email === emp.email && a.date === dateStr);
        const active = dayLogs.reduce((acc, curr) => acc + (curr.active_time_seconds || 0), 0) / 3600;
        const idle = dayLogs.reduce((acc, curr) => acc + (curr.idle_time_seconds || 0), 0) / 3600;
        return { hours: active + idle, breakRatio: (active + idle) > 0 ? idle / (active + idle) : 0.2 };
      });

      const avgHours = history.length > 0 ? history.reduce((sum, h) => sum + h.hours, 0) / history.length : 0;
      const avgBreak = history.length > 0 ? history.reduce((sum, h) => sum + h.breakRatio, 0) / history.length : 0.2;

      let risk = 'Safe';
      let color = '#22c55e'; // Green
      let icon = 'fa-check-circle';

      if (avgHours > 10 && avgBreak < 0.08) {
        risk = 'Danger';
        color = '#ef4444'; // Red
        icon = 'fa-fire';
      } else if (avgHours > 9 || avgBreak < 0.12) {
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
        avgHours: Math.round(avgHours * 10) / 10,
        avgBreak: Math.round(avgBreak * 100)
      };
    });
  }, [analyticsData, deptEmployees]);

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
      if (payload.some(p => p.name === "Logged Hours" || p.name === "Min. Requirement (8h)")) {
        return (
          <div className="bg-white p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-gray-50 flex flex-col gap-1 min-w-[140px]">
            <p className="text-gray-800 font-black text-base">{data.name}</p>
            <p className="text-violet-500 font-bold text-xs">Logged Hours: {data.hours || 0}</p>
            <p className="text-rose-500 font-bold text-xs">Min. Requirement (8h): {data.target || 8}</p>
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
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-10"
        >
          <h1 className={`text-4xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-800"}`}>
            My Team - {dept || "Department Dynamics"}
          </h1>
          <p className={`text-lg mt-2 font-medium ${isDark ? "text-gray-400" : "text-slate-500"}`}>
            Live tracking and productivity analysis of all employees across your department.
          </p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

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
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Peak Productivity Hours</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Team Focus Wave (9AM - 6PM)</p>
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
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Balance vs Taken This Month</p>
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
                <Bar dataKey="leavesThisMonth" name="Taken This Month" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} barSize={20} />
                <Bar dataKey="balanceRemaining" name="Total Balance" stackId="a" fill="#10b981" radius={[0, 10, 10, 0]} barSize={20} />
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
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Target vs Achieved</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Logged Hours vs 8h Minimum</p>
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
                    name="Min. Requirement (8h)" 
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
            className={`p-5 rounded-3xl shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className={`text-xl font-black ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                  Top Performers 🔥
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ranked by Productivity</p>
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
            className={`p-5 rounded-3xl shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className={`text-xl font-black ${isDark ? "text-rose-400" : "text-rose-600"}`}>
                  Need Attention ⚠️
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Low Productivity Zones</p>
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
              <h3 className={`text-xl font-black ${isDark ? "text-white" : "text-gray-800"}`}>Burnout Risk Matrix 🔥</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Team Health Monitor (Last 3 Days)</p>
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white text-xl shadow-lg shrink-0">
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
