import { useState } from "react";
import { motion } from "framer-motion";
import { DEPARTMENTS } from "../constants/config";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  setDoc,
  getDocs,
  query,
  collection,
  where,
} from "firebase/firestore";
import { auth, db } from "../../firebase"; // Make sure db is exported from here

export default function Register({ onSwitchToLogin, onRegisterSuccess }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "it_engineering",
    role: "employee",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone" && value !== "" && !/^\d*$/.test(value)) return;
    setFormData({ ...formData, [name]: value });
  };

  const handleRoleChange = (role) => setFormData({ ...formData, role });
  const handleDepartmentChange = (e) =>
    setFormData({ ...formData, department: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. If registering as a manager, check Firestore if one already exists for this department
      if (formData.role === "dept_manager" || formData.role === "manager") {
        const managersQuery = query(
          collection(db, "users"),
          where("department", "==", formData.department),
          where("role", "in", ["dept_manager", "manager"])
        );
        const querySnapshot = await getDocs(managersQuery);

        if (!querySnapshot.empty) {
          setError(
            `A manager already exists (or is pending) for ${
              DEPARTMENTS[formData.department]?.name
            }.`
          );
          setLoading(false);
          return;
        }
      }

      // 2. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      // 3. Save their extra details to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        department: formData.department,
        role: formData.role,
        // Managers require approval, employees are auto-approved (adjust to your preference)
        status: "pending",
        createdAt: new Date().toISOString(),
        clockedIn: false,
      });

      // 4. Success! Redirect to login or auto-login
      if (onRegisterSuccess) {
        onRegisterSuccess();
      } else {
        onSwitchToLogin(); // Fallback if you just want to swap the screen
      }
    } catch (error) {
      console.error(error);
      // Format Firebase errors nicely
      if (error.code === "auth/email-already-in-use") {
        setError("This email is already registered.");
      } else if (error.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full">
      {/* Left Side - Branding */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full md:w-1/2 bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 flex flex-col justify-center items-center p-6 min-h-[30vh] md:min-h-screen order-1 md:order-1"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto shadow-2xl border border-white/30 mb-5">
            <i className="fas fa-user-plus text-4xl text-white"></i>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Join Us</h1>
          <p className="text-white/80 text-lg">Create Your Account</p>
          <p className="text-white/60 mt-3">Start tracking your work today</p>
        </motion.div>
      </motion.div>

      {/* Right Side - Register Form */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full md:w-1/2 flex flex-col justify-center items-center p-6 bg-gray-50 overflow-y-auto min-h-[70vh] md:min-h-screen order-2 md:order-2"
      >
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">
            Create Account
          </h2>
          <p className="text-gray-500 mb-5">Fill in your details</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg mb-3 text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                placeholder="First Name"
              />
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                placeholder="Last Name"
              />
            </div>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              placeholder="Email"
            />

            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              pattern="[0-9]*"
              inputMode="numeric"
              className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              placeholder="Phone (numbers only)"
            />

            <select
              name="department"
              value={formData.department}
              onChange={handleDepartmentChange}
              className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none bg-white"
            >
              {Object.entries(DEPARTMENTS).map(([key, dept]) => (
                <option key={key} value={key}>
                  {dept.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "employee", label: "Employee", icon: "fa-user" },
                {
                  value: "dept_manager",
                  label: "Manager",
                  icon: "fa-user-tie",
                },
              ].map((option) => (
                <motion.button
                  key={option.value}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRoleChange(option.value)}
                  className={`p-2.5 rounded-xl border-2 transition-all text-center ${
                    formData.role === option.value
                      ? "border-blue-500 bg-blue-50 text-blue-600"
                      : "border-gray-200 hover:border-gray-300 text-gray-600"
                  }`}
                >
                  <i className={`fas ${option.icon} text-lg block mb-1`}></i>
                  <span className="text-xs font-medium">{option.label}</span>
                </motion.button>
              ))}
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 pr-12 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i
                  className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}
                ></i>
              </button>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Creating...
                </span>
              ) : (
                "Create Account"
              )}
            </motion.button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-gray-500 text-sm">
              Have account?{" "}
              <button
                onClick={onSwitchToLogin}
                className="text-blue-600 font-bold hover:underline"
              >
                Login
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
