import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOutletContext } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import useAuth from "../hooks/useAuth";
import { useDepartments } from "../hooks/useDepartments";
import {
  Edit2,
  Save,
  X,
  Shield,
  CheckCircle2,
  AlertCircle,
  Camera,
  Trash2,
} from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function ProfilePage() {
  const contextAuth = useOutletContext()?.auth;
  const fallbackAuth = useAuth();
  const auth = contextAuth || fallbackAuth;
  const user = auth.currentUser;
  const { isDark } = useTheme();
  const { departmentsMap } = useDepartments();

  const [editMode, setEditMode] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contactNo: "",
    role: "",
    department: "",
    profileImage: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        contactNo: user.contactNo || user.phone || "",
        role: user.role || "",
        department: user.department || "",
        profileImage: user.profileImage || "",
      });
    }
  }, [user]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Create an image element to get the dimensions
        const img = new Image();
        img.onload = async () => {
          // Create canvas to compress image
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Get highly compressed Base64 JPEG
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);

          setFormData((prev) => ({ ...prev, profileImage: compressedDataUrl }));

          if (user?.id || user?.uid) {
            try {
              const userId = String(user.uid || user.id);
              await setDoc(
                doc(db, "users", userId),
                { profileImage: compressedDataUrl },
                { merge: true }
              );
              try {
                auth.updateUser({ ...user, profileImage: compressedDataUrl });
              } catch (e) {
                console.warn("Ignored local quota error:", e);
              }
            } catch (fbError) {
              console.warn("Firebase update failed:", fbError);
            }
          }
          setMessage({ text: "profile Added succesfully", type: "success" });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // const handleRemoveImage = async () => {
  //   setFormData((prev) => ({ ...prev, profileImage: "" }));
  //   try {
  //     if (user?.id || user?.uid) {
  //       try {
  //         const userId = String(user.uid || user.id);
  //         await setDoc(
  //           doc(db, "users", userId),
  //           { profileImage: "" },
  //           { merge: true }
  //         );
  //       } catch (fbError) {
  //         console.warn("Firebase remove image failed:", fbError);
  //       }
  //     }
  //     auth.updateUser({ ...user, profileImage: "" });
  //   } catch (error) {
  //     console.error("Error removing image from Firebase:", error);
  //   }
  // };
  const handleRemoveImage = async () => {
    setFormData((prev) => ({ ...prev, profileImage: "" }));

    try {
      // 1. Update Firebase
      if (user?.id || user?.uid) {
        try {
          const userId = String(user.uid || user.id);
          await setDoc(
            doc(db, "users", userId),
            { profileImage: "" },
            { merge: true }
          );
          console.log("✅ Firebase update successful!");
        } catch (fbError) {
          console.warn("❌ Firebase remove image failed:", fbError);
          throw fbError; // Throw error to trigger the main catch block if DB fails
        }
      }

      // 2. Update Local Context
      console.log("🔄 Attempting to update local auth state...");
      if (auth && typeof auth.updateUser === "function") {
        // If your updateUser function is asynchronous, you might need to add 'await' here
        auth.updateUser({ ...user, profileImage: "" });
        console.log("✅ Local auth state updated!");
      } else {
        console.warn("⚠️ auth.updateUser is not available.");
      }

      // 3. Show Success Message
      setMessage({
        text: "Profile image removed successfully!",
        type: "success",
      });
    } catch (error) {
      // 4. Catch and log the EXACT error
      console.error("🔍 EXACT ERROR causing the failure message:", error);
      setMessage({
        text: "Failed to remove profile image.",
        type: "error",
      });
    }
  };

  // Clear message automatically
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ text: "", type: "" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const getRoleLabel = () => {
    switch (formData.role) {
      case "admin":
        return "Administrator";
      case "manager":
      case "dept_manager":
        return "Department Manager";
      case "employee":
        return "Employee";
      default:
        return "User";
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (user?.id || user?.uid) {
        try {
          const userId = String(user.uid || user.id);
          await setDoc(
            doc(db, "users", userId),
            {
              firstName: formData.firstName,
              lastName: formData.lastName,
              email: formData.email,
              contactNo: formData.contactNo || "",
              profileImage: formData.profileImage || "",
            },
            { merge: true }
          );
        } catch (fbError) {
          console.warn("Firebase update failed:", fbError);
        }
      }

      try {
        auth.updateUser({ ...user, ...formData });
      } catch (e) {
        console.warn("Ignored local state update error (likely quota):", e);
      }

      setMessage({ text: "Profile Upadte successfully", type: "success" });
      setEditMode(false);
    } catch (error) {
      console.error("Error updating profile in Firebase:", error);
      setMessage({ text: "Failed to update profile.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ text: "Passwords do not match!", type: "error" });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setMessage({
        text: "Password must be at least 6 characters!",
        type: "error",
      });
      return;
    }
    setSaving(true);
    try {
      const updatedUser = { ...user, password: passwordData.newPassword };
      localStorage.setItem("currentUser", JSON.stringify(updatedUser)); // Update in localStorage directly
      auth.updateUser(updatedUser); // Update in context
      setMessage({ text: "Password updated successfully!", type: "success" });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordSection(false);
    } catch (error) {
      console.error(error);
      setMessage({ text: "Failed to update password.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">Loading profile...</p>
      </div>
    );
  }

  // Common input styling for edit mode
  const inputClassName = `w-full mt-1 px-3 py-2 text-sm rounded-lg border outline-none transition-all ${isDark
      ? "bg-gray-800 border-gray-700 text-white focus:border-indigo-500 focus:bg-gray-700"
      : "bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500 focus:bg-white"
    }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 font-sans transition-colors duration-300"
    >
      {/* Toast Message Notification */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-8 left-8 md:left-auto md:w-96 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 font-medium ${message.type === "success"
                ? "bg-white text-emerald-600 border-emerald-100 dark:bg-gray-800 dark:text-emerald-400 dark:border-emerald-900/30"
                : "bg-white text-rose-600 border-rose-100 dark:bg-gray-800 dark:text-rose-400 dark:border-rose-900/30"
              }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span className="flex-1 text-sm">{message.text}</span>
            <button
              onClick={() => setMessage({ text: "", type: "" })}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full">
        <h1
          className={`text-3xl font-bold mb-6 ${isDark ? "text-white" : "text-gray-800"
            }`}
        >
          My Profile
        </h1>

        <div
          className={`w-full rounded-[22px] transition-colors relative overflow-hidden ${isDark
              ? "bg-gray-800 border border-gray-700/50"
              : "bg-white border border-[#E5E7EB] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]"
            }`}
        >
          {/* Card 1: Profile Header */}
          <div
            className={`p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 border-b ${isDark ? "border-gray-700/50" : "border-gray-100"
              }`}
          >
            <div className="relative group">
              <div className="w-[100px] h-[100px] rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 text-white flex items-center justify-center text-4xl font-bold uppercase shadow-inner overflow-hidden border border-blue-500/50">
                {formData.profileImage ? (
                  <img
                    src={formData.profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    {formData.firstName?.[0]}
                    {formData.lastName?.[0]}
                  </>
                )}
              </div>
              {editMode && (
                <label
                  className="absolute bottom-0 right-0 w-8 h-8 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full flex items-center justify-center cursor-pointer shadow-md hover:scale-105 hover:bg-gray-50 transition-all z-10"
                  title="Upload Image"
                >
                  <Camera
                    size={14}
                    className="text-gray-600 dark:text-gray-300"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              )}
              {editMode && formData.profileImage && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-0 right-0 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-all z-20"
                  title="Remove Image"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            <div className="flex flex-col justify-center h-full pt-1 text-center sm:text-left">
              <h2
                className={`text-[22px] font-bold ${isDark ? "text-white" : "text-[#111827]"
                  }`}
              >
                {formData.firstName} {formData.lastName}
              </h2>
              <p
                className={`text-[15px] font-medium mt-1 ${isDark ? "text-gray-400" : "text-[#6B7280]"
                  }`}
              >
                {formData.role === "admin"
                  ? "Administrator"
                  : formData.department && departmentsMap[formData.department]
                    ? departmentsMap[formData.department].name
                    : getRoleLabel()}
              </p>
              <p
                className={`text-[13px] mt-1.5 ${isDark ? "text-gray-500" : "text-[#9CA3AF]"
                  }`}
              >
                {/* Employee Tracking App */}
              </p>
            </div>
          </div>

          {/* Card 2: Personal Information */}
          <div
            className={`p-6 sm:p-8 border-b ${isDark ? "border-gray-700/50" : "border-gray-100"
              }`}
          >
            <div className="flex justify-between items-center mb-8 border-b pb-4 border-gray-100 dark:border-gray-700/50">
              <h3
                className={`text-lg font-bold ${isDark ? "text-[#e5e7eb]" : "text-blue-600"
                  }`}
              >
                Personal Information
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditMode(!editMode);
                  setShowPasswordSection(false);
                }}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${editMode
                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  }`}
              >
                {editMode ? "Cancel" : "Edit"}
                {!editMode && <Edit2 size={14} />}
              </button>
            </div>

            <form
              onSubmit={handleSaveProfile}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-7"
            >
              {/* First Name */}
              <div className="flex flex-col">
                <label
                  className={`text-[12px] font-medium tracking-wide !mb-1.5 ${isDark ? "text-gray-400" : "text-[#9CA3AF]"
                    }`}
                >
                  First Name
                </label>
                {editMode ? (
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className={inputClassName}
                  />
                ) : (
                  <span
                    className={`text-[15px] font-semibold ${isDark ? "text-gray-200" : "text-[#1F2937]"
                      }`}
                  >
                    {formData.firstName}
                  </span>
                )}
              </div>

              {/* Last Name */}
              <div className="flex flex-col">
                <label
                  className={`text-[12px] font-medium tracking-wide !mb-1.5 ${isDark ? "text-gray-400" : "text-[#9CA3AF]"
                    }`}
                >
                  Last Name
                </label>
                {editMode ? (
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className={inputClassName}
                  />
                ) : (
                  <span
                    className={`text-[15px] font-semibold ${isDark ? "text-gray-200" : "text-[#1F2937]"
                      }`}
                  >
                    {formData.lastName}
                  </span>
                )}
              </div>

              {/* Role */}
              <div className="flex flex-col">
                <label
                  className={`text-[12px] font-medium tracking-wide !mb-1.5 ${isDark ? "text-gray-400" : "text-[#9CA3AF]"
                    }`}
                >
                  User Role
                </label>
                <span
                  className={`text-[15px] font-semibold ${isDark ? "text-gray-200" : "text-[#1F2937]"
                    }`}
                >
                  {getRoleLabel()}
                </span>
              </div>

              {/* Email Address */}
              <div className="flex flex-col">
                <label
                  className={`text-[12px] font-medium tracking-wide !mb-1.5 ${isDark ? "text-gray-400" : "text-[#9CA3AF]"
                    }`}
                >
                  Email Address
                </label>
                {editMode ? (
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className={inputClassName}
                  />
                ) : (
                  <span
                    className={`text-[15px] font-semibold ${isDark ? "text-gray-200" : "text-[#1F2937]"
                      }`}
                  >
                    {formData.email}
                  </span>
                )}
              </div>

              {/* Contact No */}
              <div className="flex flex-col">
                <label
                  className={`text-[12px] font-medium tracking-wide !mb-1.5 ${isDark ? "text-gray-400" : "text-[#9CA3AF]"
                    }`}
                >
                  Phone Number
                </label>
                {editMode ? (
                  <input
                    type="tel"
                    value={formData.contactNo}
                    onChange={(e) =>
                      setFormData({ ...formData, contactNo: e.target.value })
                    }
                    placeholder="e.g. (+62) 821 255"
                    className={inputClassName}
                  />
                ) : (
                  <span
                    className={`text-[15px] font-semibold ${isDark ? "text-gray-200" : "text-[#1F2937]"
                      }`}
                  >
                    {formData.contactNo || "—"}
                  </span>
                )}
              </div>

              {/* Submission actions */}
              <AnimatePresence>
                {editMode && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="col-span-full pt-4 flex justify-end"
                  >
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-8 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-all flex items-center gap-2"
                    >
                      {saving ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      Save Info
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>

          {/* Card 3: Security */}
          <div className="p-6 sm:p-8">
            <div className="flex justify-between items-center mb-8 border-b pb-4 border-gray-100 dark:border-gray-700/50">
              <h3
                className={`text-lg font-bold ${isDark ? "text-[#e5e7eb]" : "text-blue-600"
                  }`}
              >
                Security
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordSection(!showPasswordSection);
                  setEditMode(false);
                }}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${showPasswordSection
                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  }`}
              >
                {showPasswordSection ? "Cancel" : "Edit"}
                {!showPasswordSection && <Edit2 size={14} />}
              </button>
            </div>

            {showPasswordSection ? (
              <form
                onSubmit={handlePasswordChange}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-7"
              >
                <div className="flex flex-col">
                  <label
                    className={`text-[12px] font-medium tracking-wide !mb-1.5 ${isDark ? "text-gray-400" : "text-[#9CA3AF]"
                      }`}
                  >
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                    className={inputClassName}
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex flex-col">
                  <label
                    className={`text-[12px] font-medium tracking-wide !mb-1.5 ${isDark ? "text-gray-400" : "text-[#9CA3AF]"
                      }`}
                  >
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value,
                      })
                    }
                    className={inputClassName}
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex flex-col">
                  <label
                    className={`text-[12px] font-medium tracking-wide !mb-1.5 ${isDark ? "text-gray-400" : "text-[#9CA3AF]"
                      }`}
                  >
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value,
                      })
                    }
                    className={inputClassName}
                    placeholder="••••••••"
                  />
                </div>

                <div className="col-span-full pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-8 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-all flex items-center gap-2"
                  >
                    {saving ? (
                      <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    ) : (
                      <Shield size={16} />
                    )}
                    Update Password
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-7">
                <div className="flex flex-col">
                  <label
                    className={`text-[12px] font-medium tracking-wide !mb-1.5 ${isDark ? "text-gray-400" : "text-[#9CA3AF]"
                      }`}
                  >
                    Account Password
                  </label>
                  <span
                    className={`text-[15px] font-semibold tracking-widest ${isDark ? "text-gray-200" : "text-[#1F2937]"
                      }`}
                  >
                    ••••••••••••
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
