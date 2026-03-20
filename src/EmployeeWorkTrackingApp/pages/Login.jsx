import { useState } from "react";
import { motion } from "framer-motion";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase"; // Make sure db is exported from here

export default function Login({ onLoginSuccess, onSwitchToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("employee"); // UI selected role
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      console.log(user);
      // 2. Fetch the user's extra data (role, status, etc.) from Firestore
      const userDocRef = doc(db, "users", user.uid);
      // console.log(userDocRef);
      const userDoc = await getDoc(userDocRef);
      // console.log({ userDoc });
      if (!userDoc.exists()) {
        await signOut(auth);
        setError("User profile not found in database.");
        setLoading(false);
        return;
      }
      console.log("OK...");
      const userData = userDoc.data();

      // 3. Verify Role and Status
      const isEmployeeMatch = role === "employee" && userData.role === "employee";
      const isManagerMatch = role === "dept_manager" && (userData.role === "dept_manager" || userData.role === "manager");
      const isAdminMatch = role === "admin" && userData.role === "admin";

      if (!isEmployeeMatch && !isManagerMatch && !isAdminMatch) {
        await signOut(auth);
        setError(
          `You are not authorized to log in as a ${role === "dept_manager" ? "manager" : role}. Please select the correct login role.`
        );
        setLoading(false);
        return;
      }

      if (userData.status === "pending") {
        await signOut(auth);
        setError("Your account is pending admin approval.");
        setLoading(false);
        return;
      }

      // 4. Success! Pass the user data up to your app state (App.jsx)
      if (onLoginSuccess) {
        onLoginSuccess(userData);
      }
    } catch (error) {
      console.error(error);
      setError("Invalid email or password.");
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
        className="w-full md:w-1/2 bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 flex flex-col justify-center items-center p-8 min-h-[30vh] md:min-h-screen order-1 md:order-1"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-white/20 backdrop-blur rounded-3xl flex items-center justify-center mx-auto shadow-2xl border border-white/30 mb-6">
            <i className="fas fa-briefcase text-5xl text-white"></i>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">WorkTracker</h1>
          <p className="text-white/80 text-xl">
            Employee Work Management System
          </p>
          <p className="text-white/60 mt-4">Track your work efficiently</p>
        </motion.div>
      </motion.div>

      {/* Right Side - Login Form */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 bg-gray-50 min-h-[70vh] md:min-h-screen order-2 md:order-2"
      >
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome Back
          </h2>
          <p className="text-gray-500 mb-8">Sign in to continue</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <i
                    className={`fas ${
                      showPassword ? "fa-eye-slash" : "fa-eye"
                    }`}
                  ></i>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Login As
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "employee", label: "Employee", icon: "fa-user" },
                  {
                    value: "dept_manager",
                    label: "Manager",
                    icon: "fa-user-tie",
                  },
                  { value: "admin", label: "Admin", icon: "fa-user-shield" },
                ].map((option) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setRole(option.value)}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      role === option.value
                        ? "border-blue-500 bg-blue-50 text-blue-600"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <i className={`fas ${option.icon} text-xl mb-1 block`}></i>
                    <span className="text-sm font-medium">{option.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 text-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Logging in...
                </span>
              ) : (
                "Login"
              )}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-500">
              Don't have an account?{" "}
              <button
                onClick={onSwitchToRegister}
                className="text-blue-600 font-bold hover:underline"
              >
                Register here
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
