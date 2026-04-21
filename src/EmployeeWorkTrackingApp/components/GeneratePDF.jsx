import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GeneratePDF = ({
  allUsers,
  departmentsMap,
  isDark,
  restrictedDeptId,
  currentUserEmail,
}) => {
  const [selectedDeptId, setSelectedDeptId] = useState(restrictedDeptId || "");
  const [selectedEmployeeEmail, setSelectedEmployeeEmail] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [pdfData, setPdfData] = useState(null); // This will hold the PDF URL or base64
  const [isSending, setIsSending] = useState(false);

  const deptRef = useRef(null);
  const empRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (deptRef.current && !deptRef.current.contains(event.target)) {
        setIsDeptDropdownOpen(false);
      }
      if (empRef.current && !empRef.current.contains(event.target)) {
        setIsEmpDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const departments = useMemo(() => {
    const list = Object.entries(departmentsMap).map(([id, data]) => ({
      id,
      ...data,
    }));
    return restrictedDeptId
      ? list.filter((d) => d.id === restrictedDeptId)
      : list;
  }, [departmentsMap, restrictedDeptId]);

  const filteredEmployees = useMemo(() => {
    let filtered = allUsers.filter(
      (u) => u.role !== "admin" && u.status === "approved"
    );
    if (selectedDeptId) {
      filtered = filtered.filter(
        (u) =>
          u.department === selectedDeptId || u.departmentId === selectedDeptId
      );
    }
    if (currentUserEmail) {
      filtered = filtered.filter((u) => u.email !== currentUserEmail);
    }
    return filtered;
  }, [allUsers, selectedDeptId, currentUserEmail]);

  const generateReport = async (actionType = "preview") => {
    if (!selectedDeptId && !selectedEmployeeEmail) {
      alert("Please select at least a department or an employee.");
      return null;
    }

    const selectedEmployee = allUsers.find(
      (u) => u.email === selectedEmployeeEmail
    );
    const isManager =
      selectedEmployee &&
      ["manager", "dept_manager"].includes(selectedEmployee.role);
    const employeeName = selectedEmployee
      ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
      : "All";

    let departmentName = "All Departments";
    if (selectedDeptId) {
      const selectedDept = departments.find((d) => d.id === selectedDeptId);
      departmentName = selectedDept
        ? selectedDept.name || selectedDept.id
        : "All Departments";
    } else if (selectedEmployee) {
      const deptId =
        selectedEmployee.department || selectedEmployee.departmentId;
      const deptObj = departmentsMap[deptId];
      if (deptObj) departmentName = deptObj.name || deptId;
    }

    const payload = {
      action: actionType,
      employee_name: employeeName,
      role: isManager ? "manager" : "employee",
      department: departmentName,
      start_date: startDate,
      end_date: endDate,
    };

    try {
      const response = await fetch(
        "http://localhost:5678/webhook/generate-pdf",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("The server returned an empty response.");
      }

      // Basic check if it's actually a PDF (starts with %PDF-)
      const text = await blob.slice(0, 5).text();
      if (text !== "%PDF-") {
        const errorText = await blob.text();
        console.error(
          "Not a valid PDF. Signature:",
          text,
          "Full Response:",
          errorText
        );
        throw new Error("The server did not return a valid PDF.");
      }

      return blob;
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert(
        error.message ||
          "Failed to generate PDF. Please check if n8n is running."
      );
      return null;
    }
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    setPdfData(null);

    const blob = await generateReport("preview");
    if (blob) {
      const pdfBlob = new Blob([blob], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);
      setPdfData(url);
    }
    setIsPreviewing(false);
  };

  const handleDownload = () => {
    if (pdfData) {
      const selectedEmployee = allUsers.find(
        (u) => u.email === selectedEmployeeEmail
      );
      const employeeName = selectedEmployee
        ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
        : "All_Employees";
      const sanitizedName = employeeName.replace(/\s+/g, "_");

      const link = document.createElement("a");
      link.href = pdfData;
      link.download = `${sanitizedName}_Report_${startDate}_to_${endDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(",")[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSendEmail = async () => {
    const selectedEmployee = allUsers.find(
      (u) => u.email === selectedEmployeeEmail
    );
    if (!selectedEmployee) {
      alert("Please select an employee to send the report to.");
      return;
    }

    setIsSending(true);
    try {
      let currentBlob = null;

      // 1. If we already have pdfData, fetch the blob from it
      if (pdfData) {
        const response = await fetch(pdfData);
        currentBlob = await response.blob();
      } else {
        // 2. Otherwise, trigger a new generation
        currentBlob = await generateReport("email");
      }

      if (!currentBlob) {
        setIsSending(false);
        return;
      }

      const base64PDF = await blobToBase64(currentBlob);

      const emailPayload = {
        employeeEmail: selectedEmployee.email,
        employeeName: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
        pdfData: base64PDF,
      };

      // Use the placeholder for n8n webhook URL
      const webhookUrl = "http://localhost:5678/webhook/send-pdf-email";

      const sendResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      });

      if (sendResponse.ok) {
        alert(`Report successfully sent to ${selectedEmployee.email}`);
      } else {
        throw new Error(`Failed to send email: ${sendResponse.statusText}`);
      }
    } catch (error) {
      console.error("Error sending email:", error);
      alert("Failed to send email. Please check your network or n8n webhook.");
    } finally {
      setIsSending(false);
    }
  };

  const openInNewTab = () => {
    if (pdfData) {
      window.open(pdfData, "_blank");
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-10"
      >
        <h1
          className={`text-3xl font-bold flex items-center ${
            isDark ? "text-white" : "text-gray-800"
          }`}
        >
          <i
            className={`fas fa-file-pdf mr-3 ${
              restrictedDeptId ? "text-violet-500" : "text-blue-500"
            }`}
          ></i>
          Generate PDF Report
        </h1>
        <p
          className={`text-sm mt-1 font-medium ${
            isDark ? "text-gray-400" : "text-gray-500"
          }`}
        >
          Select criteria to generate and download productivity reports.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-8 rounded-[2rem] shadow-xl border ${
          isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"
        }`}
      >
        <div className="space-y-8">
          <div
            className={`grid grid-cols-1 md:grid-cols-2 ${
              restrictedDeptId ? "lg:grid-cols-2" : "lg:grid-cols-3"
            } gap-6 items-end`}
          >
            {/* Department Selector - Hidden if restrictedDeptId is provided (Manager Side) */}
            {!restrictedDeptId && (
              <div className="space-y-2">
                <label
                  className={`text-xs font-black uppercase tracking-widest ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Department
                </label>
                <div className="relative z-20" ref={deptRef}>
                  <button
                    type="button"
                    onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                    className={`w-full flex items-center justify-between pl-4 pr-4 py-3 rounded-2xl border-2 transition-all font-bold text-sm outline-none ${
                      isDark
                        ? "bg-gray-900 border-gray-700 text-white focus:border-blue-500"
                        : "bg-gray-50 border-gray-100 text-slate-700 focus:border-blue-400"
                    }`}
                  >
                    <span className="truncate">
                      {selectedDeptId
                        ? departments.find((d) => d.id === selectedDeptId)?.name ||
                          selectedDeptId
                        : "All Departments"}
                    </span>
                    <motion.i
                      animate={{ rotate: isDeptDropdownOpen ? 180 : 0 }}
                      className={`fas fa-chevron-down text-xs ml-2 opacity-50 ${
                        restrictedDeptId ? "text-violet-500 opacity-100" : ""
                      }`}
                    ></motion.i>
                  </button>

                  <AnimatePresence>
                    {isDeptDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`absolute z-[100] left-0 w-full mt-2 rounded-2xl shadow-2xl border overflow-hidden ${
                          isDark
                            ? "bg-gray-800 border-gray-700"
                            : "bg-white border-gray-100"
                        }`}
                      >
                        <div className="max-h-60 overflow-y-auto scrollbar-hide">
                          {!restrictedDeptId && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDeptId("");
                                setSelectedEmployeeEmail("");
                                setIsDeptDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${
                                !selectedDeptId
                                  ? "bg-blue-500/10 text-blue-500"
                                  : isDark
                                  ? "text-gray-300 hover:bg-gray-700"
                                  : "text-slate-600 hover:bg-gray-50"
                              }`}
                            >
                              All Departments
                            </button>
                          )}
                          {departments.map((dept) => (
                            <button
                              key={dept.id}
                              type="button"
                              onClick={() => {
                                setSelectedDeptId(dept.id);
                                setSelectedEmployeeEmail("");
                                setIsDeptDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${
                                selectedDeptId === dept.id
                                  ? restrictedDeptId
                                    ? "bg-violet-500/10 text-violet-500"
                                    : "bg-blue-500/10 text-blue-500"
                                  : isDark
                                  ? "text-gray-300 hover:bg-gray-700"
                                  : "text-slate-600 hover:bg-gray-50"
                              }`}
                            >
                              {dept.name || dept.id}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Employee Selector */}
            <div className="space-y-2">
              <label
                className={`text-xs font-black uppercase tracking-widest ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}
              >
                Employee
              </label>
              <div className="relative z-20" ref={empRef}>
                <button
                  type="button"
                  onClick={() => setIsEmpDropdownOpen(!isEmpDropdownOpen)}
                  className={`w-full flex items-center justify-between pl-4 pr-4 py-3 rounded-2xl border-2 transition-all font-bold text-sm outline-none ${
                    isDark
                      ? "bg-gray-900 border-gray-700 text-white focus:border-blue-500"
                      : "bg-gray-50 border-gray-100 text-slate-700 focus:border-blue-400"
                  }`}
                >
                  <span className="truncate">
                    {selectedEmployeeEmail
                      ? filteredEmployees.find(
                          (e) => e.email === selectedEmployeeEmail
                        )?.firstName +
                        " " +
                        filteredEmployees.find(
                          (e) => e.email === selectedEmployeeEmail
                        )?.lastName
                      : "All Employees"}
                  </span>
                  <motion.i
                    animate={{ rotate: isEmpDropdownOpen ? 180 : 0 }}
                    className={`fas fa-chevron-down text-xs ml-2 opacity-50 ${
                      restrictedDeptId ? "text-violet-500 opacity-100" : ""
                    }`}
                  ></motion.i>
                </button>

                <AnimatePresence>
                  {isEmpDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`absolute z-[100] left-0 w-full mt-2 rounded-2xl shadow-2xl border overflow-hidden ${
                        isDark
                          ? "bg-gray-800 border-gray-700"
                          : "bg-white border-gray-100"
                      }`}
                    >
                      <div className="max-h-60 overflow-y-auto scrollbar-hide">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEmployeeEmail("");
                            setIsEmpDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${
                            !selectedEmployeeEmail
                              ? "bg-blue-500/10 text-blue-500"
                              : isDark
                              ? "text-gray-300 hover:bg-gray-700"
                              : "text-slate-600 hover:bg-gray-50"
                          }`}
                        >
                          All Employees
                        </button>
                        {filteredEmployees.map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => {
                              setSelectedEmployeeEmail(emp.email);
                              setIsEmpDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${
                              selectedEmployeeEmail === emp.email
                                ? restrictedDeptId
                                  ? "bg-violet-500/10 text-violet-500"
                                  : "bg-blue-500/10 text-blue-500"
                                : isDark
                                ? "text-gray-300 hover:bg-gray-700"
                                : "text-slate-600 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="truncate">
                                {emp.firstName} {emp.lastName}
                                {(emp.role === "manager" || emp.role === "dept_manager") && (
                                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-bold uppercase tracking-wider">
                                    Manager
                                  </span>
                                )}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2 lg:col-span-1 relative z-10">
              <label
                className={`text-xs font-black uppercase tracking-widest ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}
              >
                Date Range
              </label>
              <div
                className={`flex items-center gap-2 p-1.5 rounded-2xl border-2 ${
                  isDark
                    ? "bg-gray-900 border-gray-700"
                    : "bg-gray-50 border-gray-100"
                }`}
              >
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`bg-transparent border-none text-xs font-bold outline-none flex-1 p-1.5 ${
                    isDark ? "text-white" : "text-slate-700"
                  }`}
                />
                <span
                  className={`opacity-30 self-center ${
                    restrictedDeptId ? "text-violet-500 opacity-60" : ""
                  }`}
                >
                  <i className="fas fa-arrow-right text-[10px]"></i>
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`bg-transparent border-none text-xs font-bold outline-none flex-1 p-1.5 ${
                    isDark ? "text-white" : "text-slate-700"
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center pt-2">
            {/* Preview Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePreview}
              disabled={isPreviewing}
              className={`w-full max-w-md py-4 rounded-2xl font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2 ${
                isPreviewing
                  ? "bg-gray-400 cursor-not-allowed text-white"
                  : restrictedDeptId
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-violet-500/20"
                  : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-blue-500/20"
              }`}
            >
              {isPreviewing ? (
                <>
                  <i className="fas fa-circle-notch animate-spin"></i>
                  Generating Report...
                </>
              ) : (
                <>
                  <i className="fas fa-eye"></i>
                  Preview Report
                </>
              )}
            </motion.button>

            <AnimatePresence>
              {isPreviewing && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`text-xs mt-4 text-center font-bold tracking-wide ${
                    isDark
                      ? restrictedDeptId
                        ? "text-violet-400"
                        : "text-blue-400"
                      : restrictedDeptId
                      ? "text-violet-600"
                      : "text-blue-600"
                  }`}
                >
                  <i className="fas fa-info-circle mr-2"></i>
                  Please wait while we generate your report. This may take a few
                  seconds...
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Preview Section */}
      <AnimatePresence>
        {pdfData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-6"
          >
            <div
              className={`p-4 rounded-[2rem] shadow-2xl border overflow-hidden ${
                isDark
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-100"
              }`}
            >
              <div className="aspect-[1/1.4] w-full max-w-4xl mx-auto rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-gray-100 flex flex-col items-center justify-center relative">
                <embed
                  src={pdfData}
                  type="application/pdf"
                  className="w-full h-full"
                />
                <div
                  className={`absolute inset-0 flex flex-col items-center justify-center -z-10 ${
                    restrictedDeptId ? "text-violet-400" : "text-gray-400"
                  }`}
                >
                  <i className="fas fa-file-pdf text-4xl mb-2"></i>
                  <p className="text-sm font-medium">Loading Preview...</p>
                  <p className="text-xs mt-2 text-gray-500">
                    If it doesn't load, use the buttons below.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={openInNewTab}
                className="px-8 py-4 bg-gray-700 text-white rounded-2xl font-bold shadow-xl flex items-center gap-3"
              >
                <i className="fas fa-external-link-alt"></i>
                Open in New Tab
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDownload}
                className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-500/20 flex items-center gap-3"
              >
                <i className="fas fa-download"></i>
                Download PDF Report
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSendEmail}
                disabled={isSending}
                className={`px-8 py-4 rounded-2xl font-bold shadow-xl flex items-center gap-3 transition-all ${
                  isSending
                    ? "bg-gray-400 cursor-not-allowed text-white"
                    : restrictedDeptId
                    ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-violet-500/20"
                    : "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-indigo-500/20"
                }`}
              >
                {isSending ? (
                  <>
                    <i className="fas fa-circle-notch animate-spin"></i>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane"></i>
                    Send via Email
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GeneratePDF;
