import { useState } from "react";
import { motion } from "framer-motion";
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail, signInWithPopup, getAdditionalUserInfo, deleteUser } from "firebase/auth";
import { doc, getDoc, setDoc, query, collection, where, getDocs, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../../firebase"; // Make sure db is exported from here
import { useAuth } from "../hooks/AuthContext";
// Removed ALLOWED_LOCATIONS and GEOFENCE_RADIUS imports

export default function Login({ onLoginSuccess, onSwitchToRegister }) {
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("employee"); // UI selected role
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setError("");
    setResetSent(false);
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError("");
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError("No account found with this email address.");
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyAndLogin = async (user) => {
    const uid = user.uid;
    const userDocRef = doc(db, "users", uid);
    let userDoc;

    try {
      userDoc = await getDoc(userDocRef);
    } catch (err) {
      console.error("Error fetching user doc:", err);
      await signOut(auth);
      if (err.code === "permission-denied") {
        throw new Error("Your account is pending admin approval.");
      }
      throw new Error("Failed to connect to the database. Please try again.");
    }

    if (!userDoc.exists()) {
      await signOut(auth);
      throw new Error("User profile not found in database. Please register first.");
    }

    const userData = userDoc.data();

    // Verify Role and Status
    const dbRole = (userData.role || "").toLowerCase();
    const isEmployeeMatch = role === "employee" && dbRole === "employee";
    const isManagerMatch =
      role === "dept_manager" && (dbRole === "dept_manager" || dbRole === "manager");
    const isAdminMatch = role === "admin" && dbRole === "admin";

    if (!isEmployeeMatch && !isManagerMatch && !isAdminMatch) {
      await signOut(auth);
      throw new Error(
        `You are not authorized to log in as a ${role === "dept_manager" ? "manager" : role
        }. Please select the correct login role.`
      );
    }

    if (userData.status === "pending") {
      await signOut(auth);
      throw new Error("Your account is pending admin approval.");
    }

    return userData;
  };



  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {


      const result = await signInWithPopup(auth, googleProvider);
      const { isNewUser } = getAdditionalUserInfo(result);

      // Check if profile exists
      const userDocRef = doc(db, "users", result.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        if (isNewUser) {
          try {
            await deleteUser(result.user);
          } catch (delError) {
            console.error("Cleanup error:", delError);
          }
        }
        await signOut(auth);
        setError("User profile not found in database. Please register first.");
        setLoading(false);
        return;
      }

      // Update location in Firestore
      await updateDoc(userDocRef, {
        lastLoginAt: new Date().toISOString(),
      });

      const userData = await verifyAndLogin(result.user);
      if (userData && onLoginSuccess) {
        onLoginSuccess(userData);
      }
    } catch (err) {
      console.error(err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed before completion.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Google login is not enabled in Firebase Console.");
      } else {
        setError(err.message || "Google Sign-In failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanEmail = email.trim();

    try {
      // 1. Pre-verify role by email to avoid race conditions and URL changes
      const q = query(
        collection(db, "users"),
        where("email", "==", cleanEmail.toLowerCase())
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();

        // Verify Role Match (case-insensitive for robustness)
        const dbRole = (userData.role || "").toLowerCase();
        const isEmployeeMatch = role === "employee" && dbRole === "employee";
        const isManagerMatch =
          role === "dept_manager" && (dbRole === "dept_manager" || dbRole === "manager");
        const isAdminMatch = role === "admin" && dbRole === "admin";

        if (!isEmployeeMatch && !isManagerMatch && !isAdminMatch) {
          throw new Error(
            `You are not authorized to log in as a ${role === "dept_manager" ? "manager" : role
            }. Please select the correct login role.`
          );
        }

        if (userData.status === "pending") {
          throw new Error("Your account is pending admin approval.");
        }
      }


      // 2. Check for legacy/hardcoded Admin credentials if role is admin
      if (role === 'admin') {
        const { ADMIN_CREDENTIALS } = await import("../constants/config");
        const hardcodedAdmin = ADMIN_CREDENTIALS.find(
          a => a.email.toLowerCase() === cleanEmail.toLowerCase() && a.password === password
        );

        if (hardcodedAdmin) {
          const q = query(
            collection(db, "users"),
            where("email", "==", cleanEmail.toLowerCase()),
            where("role", "==", "admin")
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const userRef = doc(db, "users", querySnapshot.docs[0].id);
            await updateDoc(userRef, {
              lastLoginAt: new Date().toISOString(),
            });

            const userData = querySnapshot.docs[0].data();
            if (onLoginSuccess) {
              onLoginSuccess(userData);
              return;
            }
          }
        }
      }

      // 3. Standard Firebase Auth login
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);

      // Update location in Firestore
      const userDocRef = doc(db, "users", userCredential.user.uid);
      await updateDoc(userDocRef, {
        lastLoginAt: new Date().toISOString(),
      });

      const userData = await verifyAndLogin(userCredential.user);

      if (userData && onLoginSuccess) {
        onLoginSuccess(userData);
      }
    } catch (err) {
      console.error("Login error:", err);

      if (err.message.includes("location") || err.message.includes("Location")) {
        setError(err.message);
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password. If you usually login with Google, you might need to use 'Forgot Password' to set a manual password.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else if (err.code === 'auth/user-disabled') {
        setError("This account has been disabled by an administrator.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many failed login attempts. Please try again later or reset your password.");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full scrollbar-hide">
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
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
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

          {resetSent && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-50 border-2 border-emerald-100 p-4 rounded-2xl mb-6 flex items-start gap-3 shadow-sm mx-1"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 mt-0.5 animate-bounce">
                <i className="fas fa-check"></i>
              </div>
              <div>
                <p className="text-emerald-800 font-bold text-sm">Reset Link Sent!</p>
                <p className="text-emerald-600 text-xs mt-0.5">Please check your inbox and spam folder for the password reset link.</p>
              </div>
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
                  <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                </button>
              </div>
              <div className="flex justify-end mt-1.5 px-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Forgot Password?
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
                    className={`p-3 rounded-xl border-2 transition-all text-center ${role === option.value
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

          <div className="relative my-8 px-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-gray-50 text-gray-500 font-bold uppercase tracking-wider">
                OR CONTINUE WITH
              </span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-lg mb-4"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            Sign in with Google
          </motion.button>

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
