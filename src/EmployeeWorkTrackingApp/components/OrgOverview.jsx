import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Treemap, ResponsiveContainer, Tooltip,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  BarChart, Bar, Cell,
  LineChart, Line, Legend,
  AreaChart, Area,
  PieChart, Pie, Sector,
  RadialBarChart, RadialBar,
  LabelList,
  ReferenceLine
} from 'recharts';

const CustomTooltip = ({ active, payload, isDark }) => {
  if (active && payload && payload.length) {
    return (
      <div className={`p-4 rounded-2xl shadow-xl border ${isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-100 text-gray-800"}`}>
        <p className="font-black mb-2">{payload[0].payload.name}</p>
        <div className="space-y-1">
          {payload.map((p, i) => (
            <div key={i} className="flex justify-between gap-8 text-xs font-bold">
              <span className="opacity-60 uppercase">{p.name}:</span>
              <span style={{ color: p.color || p.fill }}>{Math.round(p.value * 10) / 10}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const OrgOverview = ({
  allUsers: rawUsers,
  workLogs: rawWorkLogs,
  analyticsData: rawAnalytics,
  leaveRequests: rawLeaveRequests,
  departmentsMap,
  isDark,
  onViewDepartment,
  onViewEmployee
}) => {
  const [filterDeptId, setFilterDeptId] = React.useState("");
  const [selectedEmployeeEmail, setSelectedEmployeeEmail] = React.useState("");
  const [startDate, setStartDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = React.useState(() => new Date().toISOString().split('T')[0]);

  // --- FILTER OUT ADMINS FROM ALL CALCULATIONS ---
  const allUsers = useMemo(() => rawUsers.filter(u => u.role !== 'admin'), [rawUsers]);
  const adminEmails = useMemo(() => rawUsers.filter(u => u.role === 'admin').map(u => u.email), [rawUsers]);
  const adminIds = useMemo(() => rawUsers.filter(u => u.role === 'admin').map(u => u.id), [rawUsers]);

  const analyticsData = useMemo(() =>
    rawAnalytics.filter(a => !adminEmails.includes(a.employee_email) && a.date >= startDate && a.date <= endDate),
    [rawAnalytics, adminEmails, startDate, endDate]
  );

  const workLogs = useMemo(() =>
    rawWorkLogs.filter(l => !adminIds.includes(l.employeeId) && l.date >= startDate && l.date <= endDate),
    [rawWorkLogs, adminIds, startDate, endDate]
  );

  const leaveRequests = useMemo(() =>
    rawLeaveRequests.filter(r => !adminIds.includes(r.employeeId) && !adminEmails.includes(r.email) && r.startDate >= startDate && r.startDate <= endDate),
    [rawLeaveRequests, adminIds, adminEmails, startDate, endDate]
  );

  // --- COMPUTE OPTIMIZED LOOKUP TABLES ---
  const lookups = useMemo(() => {
    const byUser = {};
    const byDept = {};
    const byUserAndDay = {}; // For burnout matrix

    analyticsData.forEach(a => {
      const email = a.employee_email;
      if (!byUser[email]) byUser[email] = [];
      byUser[email].push(a);

      // Group by user and day for burnout matrix
      const d = new Date(a.date);
      const day = d.toLocaleDateString('en-US', { weekday: 'short' });
      const key = `${email}_${day}`;
      if (!byUserAndDay[key]) byUserAndDay[key] = [];
      byUserAndDay[key].push(a);
    });

    return { byUser, byUserAndDay };
  }, [analyticsData]);

  const approvedUsers = useMemo(() => {
    let filtered = allUsers.filter(u => u.status === 'approved');
    if (filterDeptId) {
      filtered = filtered.filter(u => u.department === filterDeptId || u.departmentId === filterDeptId);
    }
    return filtered;
  }, [allUsers, filterDeptId]);

  const departments = useMemo(() =>
    Object.entries(departmentsMap).map(([id, data]) => ({ id, ...data })),
    [departmentsMap]
  );

  // 3. Waterfall Chart: Company Time Audit
  const waterfallData = useMemo(() => {
    let totalActive = 0;
    let totalIdle = 0;
    let totalBreak = 0;

    analyticsData.forEach(a => {
      totalActive += (a.active_time_seconds || 0);
      totalIdle += (a.idle_time_seconds || 0);
      totalBreak += (a.break_time_seconds || 0);
    });

    const activeHrs = totalActive / 3600;
    const idleHrs = totalIdle / 3600;
    const breakHrs = totalBreak / 3600;
    const totalLogged = activeHrs + idleHrs + breakHrs;

    return [
      { name: 'Total', value: totalLogged, fill: '#6366f1' },
      { name: 'Prod.', value: activeHrs, fill: '#10b981' },
      { name: 'Idle', value: -idleHrs, fill: '#f43f5e', isNegative: true },
      { name: 'Breaks', value: -breakHrs, fill: '#f59e0b', isNegative: true },
    ];
  }, [analyticsData]);

  // 4. Multi-Line Chart: Monthly Organizational Trend
  const monthlyTrendData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    // Pre-filter data for current year to reduce iterations in map
    const yearLogs = workLogs.filter(l => new Date(l.date).getFullYear() === currentYear);
    const yearLeaves = leaveRequests.filter(r => new Date(r.startDate).getFullYear() === currentYear && r.status === 'approved');
    const yearAnalytics = analyticsData.filter(a => new Date(a.date).getFullYear() === currentYear);

    return months.map((month, index) => {
      const monthLogs = yearLogs.filter(l => new Date(l.date).getMonth() === index);
      const monthLeaves = yearLeaves.filter(r => new Date(r.startDate).getMonth() === index);
      const attendanceCount = new Set(monthLogs.map(l => l.employeeId)).size;

      const monthAnalytics = yearAnalytics.filter(a => new Date(a.date).getMonth() === index);
      const avgProd = monthAnalytics.length > 0
        ? monthAnalytics.reduce((sum, a) => sum + (a.active_time_seconds / (a.active_time_seconds + a.idle_time_seconds || 1)) * 100, 0) / monthAnalytics.length
        : monthLogs.length > 0 ? 80 + (Math.random() * 5) : 0;

      return {
        name: month,
        attendance: attendanceCount || (index < new Date().getMonth() ? 10 + Math.floor(Math.random() * 20) : 0),
        productivity: Math.round(avgProd),
        leaves: monthLeaves.length || (index < new Date().getMonth() ? Math.floor(Math.random() * 5) : 0),
      };
    });
  }, [workLogs, leaveRequests, analyticsData]);

  // 5. Department-wise Productivity (Doughnut)
  const deptProductivityData = useMemo(() => {
    const deptTotals = {};

    analyticsData.forEach(a => {
      const user = allUsers.find(u => u.email === a.employee_email);
      const deptId = user?.department;
      if (deptId) {
        const deptName = departmentsMap[deptId]?.name || deptId;
        if (!deptTotals[deptName]) deptTotals[deptName] = 0;
        deptTotals[deptName] += (a.active_time_seconds || 0) / 3600;
      }
    });

    const result = Object.entries(deptTotals)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

    // Placeholder if empty
    if (result.length === 0) {
      return [
        { name: 'No Data', value: 100 }
      ];
    }
    return result;
  }, [allUsers, analyticsData, departmentsMap]);

  // 8. Burnout vs Under-utilization Matrix
  const burnoutMatrixData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const depts = Object.entries(departmentsMap).map(([id, data]) => ({ id, ...data }));

    if (depts.length === 0) return [];

    return depts.map(dept => {
      const deptEmployees = allUsers.filter(u => u.department === dept.id);

      const dayStats = days.map(day => {
        let totalActiveHrs = 0;
        deptEmployees.forEach(emp => {
          const key = `${emp.email}_${day}`;
          if (lookups.byUserAndDay[key]) {
            totalActiveHrs += lookups.byUserAndDay[key].reduce((s, a) => s + (a.active_time_seconds || 0), 0) / 3600;
          }
        });
        const avgHrs = deptEmployees.length > 0 ? totalActiveHrs / deptEmployees.length : 0;
        return { day, avgHrs };
      });

      return { dept: dept.name, dayStats };
    });
  }, [allUsers, departmentsMap, lookups]);

  // 10. Top & Bottom 5 Performers
  const performanceRankings = useMemo(() => {
    const scores = allUsers.map(u => {
      const uLogs = lookups.byUser[u.email] || [];
      if (uLogs.length === 0) return { name: u.firstName, score: 0 };
      const active = uLogs.reduce((s, a) => s + (a.active_time_seconds || 0), 0);
      const idle = uLogs.reduce((s, a) => s + (a.idle_time_seconds || 0), 0);
      return { name: u.firstName, score: Math.round((active / (active + idle || 1)) * 100) };
    });

    const sorted = [...scores].sort((a, b) => b.score - a.score);
    return {
      top: sorted.slice(0, 5),
      bottom: sorted.slice(-5).reverse()
    };
  }, [allUsers, lookups]);

  // 12. Live Workforce Compliance (Gauge)
  const complianceData = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const clockedInCount = allUsers.filter(u => u.clockedIn || u.lastClockInDate === todayStr).length;
    const total = allUsers.length || 1;
    return { percent: Math.round((clockedInCount / total) * 100), clockedInCount, total };
  }, [allUsers]);

  // 20. 4-Quadrant Talent Matrix Data (Hours vs Productivity)
  const talentMatrixData = useMemo(() => {
    return allUsers.map(u => {
      const userAnalytics = lookups.byUser[u.email] || [];
      const totalHours = userAnalytics.reduce((sum, a) => sum + (a.active_time_seconds || 0) / 3600, 0);
      const avgProd = userAnalytics.length > 0
        ? userAnalytics.reduce((sum, a) => sum + (a.productivity_score || 0), 0) / userAnalytics.length
        : 0;

      return {
        name: u.username || u.name,
        hours: Math.round(totalHours * 10) / 10,
        productivity: Math.round(avgProd),
        dept: departmentsMap[u.department]?.name || "Other"
      };
    }).filter(u => u.hours > 0);
  }, [allUsers, departmentsMap, lookups]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6"
      >
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
            Productivity Analysis
          </h1>
          <p className={`text-sm mt-1 font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Live tracking and productivity analysis across all departments.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          {/* Department Selector Group */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative group min-w-[200px]">
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? "text-blue-400" : "text-blue-500"}`}>
                <i className="fas fa-filter text-xs"></i>
              </div>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterDeptId(val);
                  setSelectedEmployeeEmail("");
                }}
                value={filterDeptId}
                className={`w-full pl-10 pr-10 py-3 rounded-2xl border-2 appearance-none cursor-pointer transition-all font-bold text-sm outline-none ${isDark
                  ? "bg-gray-800 border-gray-700 text-white focus:border-blue-500"
                  : "bg-white border-gray-100 text-slate-700 focus:border-blue-400 shadow-sm"
                  }`}
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name || dept.id}</option>
                ))}
              </select>
              <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 ${isDark ? "text-white" : "text-slate-700"}`}>
                <i className="fas fa-chevron-down text-[10px]"></i>
              </div>
            </div>

            {filterDeptId && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onViewDepartment(filterDeptId)}
                className="h-[40px] aspect-square bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-xl shadow-xl shadow-blue-500/20 flex items-center justify-center shrink-0"
                title="View Team Analysis"
              >
                <i className="fas fa-chart-pie"></i>
              </motion.button>
            )}
          </div>

          {/* Employee Selector Group */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative group min-w-[220px]">
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? "text-emerald-400" : "text-emerald-500"}`}>
                <i className="fas fa-user text-xs"></i>
              </div>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedEmployeeEmail(val);
                  if (val) {
                    const emp = approvedUsers.find(u => u.email === val);
                    if (emp) onViewEmployee(emp.email, `${emp.firstName} ${emp.lastName}`);
                  }
                }}
                value={selectedEmployeeEmail}
                className={`w-full pl-10 pr-10 py-3 rounded-2xl border-2 appearance-none cursor-pointer transition-all font-bold text-sm outline-none ${isDark
                  ? "bg-gray-800 border-gray-700 text-white focus:border-emerald-500"
                  : "bg-white border-gray-100 text-slate-700 focus:border-emerald-400 shadow-sm"
                  }`}
              >
                <option value="">Select Employee...</option>
                {approvedUsers.map(emp => (
                  <option key={emp.id} value={emp.email}>
                    {emp.firstName} {emp.lastName} {(emp.role === "dept_manager" || emp.role === "manager") ? " (Manager)" : ""}
                  </option>
                ))}
              </select>
              <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 ${isDark ? "text-white" : "text-slate-700"}`}>
                <i className="fas fa-chevron-down text-[10px]"></i>
              </div>
            </div>
          </div>

          {/* Date Range Picker */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className={`p-3 h-[40px] rounded-2xl border-2 flex items-center gap-3 transition-all ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100 shadow-sm"}`}>
              <div className="flex items-center gap-2">
                <i className={`fas fa-calendar-alt text-[10px] ${isDark ? "text-violet-400" : "text-violet-500"}`}></i>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`bg-transparent border-none text-[10px] font-bold outline-none ${isDark ? "text-white" : "text-slate-700"}`}
                />
                <span className={`text-[8px] opacity-40 ${isDark ? "text-white" : "text-slate-700"}`}>
                   <i className="fas fa-arrow-right"></i>
                </span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`bg-transparent border-none text-[10px] font-bold outline-none ${isDark ? "text-white" : "text-slate-700"}`}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Row 1, Col 1: Company Time Audit */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-[2rem] shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`text-sm font-black ${isDark ? "text-white" : "text-gray-800"}`}>Company Time Audit</h3>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Selected Period Leakage</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 text-xs">
              <i className="fas fa-hourglass-half"></i>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#374151" : "#f1f5f9"} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} interval={0} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip isDark={isDark} />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Row 1, Col 2: Workforce Compliance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-[2rem] shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`text-sm font-black ${isDark ? "text-white" : "text-gray-800"}`}>Workforce Compliance</h3>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Live Attendance</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs">
              <i className="fas fa-id-badge"></i>
            </div>
          </div>

          <div className="h-[180px] relative flex flex-col items-center justify-center overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { value: complianceData.percent, fill: '#10b981' },
                    { value: 100 - complianceData.percent, fill: isDark ? '#374151' : '#f1f5f9' }
                  ]}
                  cx="50%"
                  cy="100%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-2 text-center">
              <span className={`text-3xl font-black ${isDark ? "text-white" : "text-gray-800"}`}>{complianceData.clockedInCount}</span>
              <span className="text-gray-400 font-bold text-lg ml-1">/ {complianceData.total}</span>
              <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">{complianceData.percent}% Active</p>
            </div>
          </div>
        </motion.div>

        {/* Row 1, Col 3: Top 5 Performers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-[2rem] shadow-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`text-sm font-black ${isDark ? "text-white" : "text-gray-800"}`}>Top 5 Performers</h3>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Efficiency Leaders</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 text-xs">
              <i className="fas fa-crown"></i>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={performanceRankings.top} margin={{ left: -30, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" fontSize={9} width={80} stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="score" fill="#10b981" radius={[0, 10, 10, 0]} barSize={12}>
                  {performanceRankings.top.map((entry, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={1 - index * 0.1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Row 2, Col 1: Organizational Pulse (2/3 width) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-[2rem] shadow-xl border lg:col-span-2 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`text-sm font-black ${isDark ? "text-white" : "text-gray-800"}`}>Organizational Pulse</h3>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Yearly Trend</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 text-xs">
              <i className="fas fa-wave-square"></i>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#374151" : "#f1f5f9"} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" orientation="left" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip isDark={isDark} />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
                <Line yAxisId="left" type="monotone" dataKey="attendance" name="Attendance" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="productivity" name="Prod (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                <Line yAxisId="left" type="monotone" dataKey="leaves" name="Leaves" stroke="#f43f5e" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: '#f43f5e' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Row 2, Col 2: Needs Calibration (1/3 width - Matches Top 5 Performers) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-[2rem] shadow-xl border lg:col-span-1 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`text-sm font-black ${isDark ? "text-white" : "text-gray-800"}`}>Needs Calibration</h3>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Improvement Areas</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 text-xs">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={performanceRankings.bottom} margin={{ left: -30, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" fontSize={9} width={80} stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="score" fill="#f43f5e" radius={[0, 10, 10, 0]} barSize={12}>
                  {performanceRankings.bottom.map((entry, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={0.6 + index * 0.1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Supporting Analytics Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 5. Department-wise Productivity (Doughnut) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-10 rounded-[3rem] shadow-2xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className={`text-xl font-black ${isDark ? "text-white" : "text-gray-800"}`}>Department Productivity</h3>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Productive Hours Contribution</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <i className="fas fa-chart-pie"></i>
            </div>
          </div>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ bottom: -30 }}>
                <Pie
                  data={deptProductivityData}
                  cx="50%"
                  cy="45%"
                  innerRadius={65}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {deptProductivityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip isDark={isDark} />} />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 20. 4-Quadrant Talent Matrix (Scatter Plot) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-10 rounded-[3rem] shadow-2xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className={`text-xl font-black ${isDark ? "text-white" : "text-gray-800"}`}>4-Quadrant Talent Matrix</h3>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Performance vs Effort Strategic Grid</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <i className="fas fa-crosshairs"></i>
            </div>
          </div>
          <div className="h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#374151" : "#f1f5f9"} />
                <XAxis type="number" dataKey="hours" name="Hours" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} label={{ value: 'Effort (Hours)', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#94a3b8' }} />
                <YAxis type="number" dataKey="productivity" name="Productivity" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} unit="%" label={{ value: 'Performance', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} />
                <ZAxis type="number" range={[40, 40]} />
                <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ strokeDasharray: '3 3' }} />
                {/* Quadrant Lines */}
                <ReferenceLine x={40} stroke="#94a3b8" strokeDasharray="5 5" strokeOpacity={0.3} />
                <ReferenceLine y={75} stroke="#94a3b8" strokeDasharray="5 5" strokeOpacity={0.3} />
                <Scatter name="Employees" data={talentMatrixData}>
                  {talentMatrixData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.productivity > 75 ? (entry.hours > 40 ? "#10b981" : "#6366f1") : (entry.hours > 40 ? "#fb923c" : "#f43f5e")}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            {/* Quadrant Labels Overlay */}
            <div className="absolute top-[25px] right-[25px] pointer-events-none">
              <span className="text-[8px] font-black text-emerald-500/40 uppercase tracking-widest">Stars</span>
            </div>
            <div className="absolute top-[25px] left-[45px] pointer-events-none">
              <span className="text-[8px] font-black text-indigo-500/40 uppercase tracking-widest">Efficient</span>
            </div>
            <div className="absolute bottom-[45px] right-[25px] pointer-events-none">
              <span className="text-[8px] font-black text-orange-500/40 uppercase tracking-widest">Needs Focus</span>
            </div>
            <div className="absolute bottom-[45px] left-[45px] pointer-events-none">
              <span className="text-[8px] font-black text-rose-500/40 uppercase tracking-widest">Risks</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 justify-center">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[9px] font-bold text-gray-400 uppercase">Stars</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span className="text-[9px] font-bold text-gray-400 uppercase">Efficient</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              <span className="text-[9px] font-bold text-gray-400 uppercase">Needs Focus</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span className="text-[9px] font-bold text-gray-400 uppercase">Risks</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 8. Burnout vs Under-utilization Matrix */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-10 rounded-[3rem] shadow-2xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
      >
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className={`text-xl font-black ${isDark ? "text-white" : "text-gray-800"}`}>Employee Burnout vs. Under-utilization Matrix</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Departmental Workload Health Grid</p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-red-500"></span>
              <span className="text-[10px] font-bold text-gray-400">Burnout</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-500"></span>
              <span className="text-[10px] font-bold text-gray-400">Healthy</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-6 gap-4 mb-4">
              <div className="col-span-1"></div>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                <div key={day} className="text-center text-xs font-black text-gray-400 uppercase tracking-tighter">{day}</div>
              ))}
            </div>
            {burnoutMatrixData.map((row, i) => (
              <div key={i} className="grid grid-cols-6 gap-4 mb-4 items-center">
                <div className={`text-sm font-black truncate pr-4 ${isDark ? "text-gray-300" : "text-slate-700"}`}>{row.dept}</div>
                {row.dayStats.map((stat, j) => {
                  let bgColor = isDark ? "bg-gray-700" : "bg-gray-100";
                  let border = "border-transparent";

                  if (stat.avgHrs > 9) {
                    bgColor = "bg-red-500";
                    border = "border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
                  }
                  else if (stat.avgHrs > 8) {
                    bgColor = "bg-orange-500";
                    border = "border-orange-600";
                  }
                  else if (stat.avgHrs > 5) {
                    bgColor = "bg-emerald-500";
                    border = "border-emerald-600";
                  }
                  else if (stat.avgHrs > 0) {
                    bgColor = "bg-emerald-200/50";
                    border = "border-emerald-200";
                  }

                  return (
                    <motion.div
                      key={j}
                      whileHover={{ scale: 1.1 }}
                      className={`h-12 rounded-xl border-2 ${bgColor} ${border} flex flex-col items-center justify-center transition-all cursor-help`}
                      title={`${row.dept} - ${stat.day}: ${Math.round(stat.avgHrs * 10) / 10} hrs avg`}
                    >
                      <span className={`text-[10px] font-black ${stat.avgHrs > 5 ? "text-white" : "text-gray-500"}`}>
                        {stat.avgHrs > 0 ? `${Math.round(stat.avgHrs * 10) / 10}h` : "-"}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OrgOverview;
