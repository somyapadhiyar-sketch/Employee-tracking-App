import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase"; // Adjust this path if your firebase.js is in a different folder

// 1. Create the Context
const AuthContext = createContext();

// 2. Create a custom hook so other files can easily use the auth data
export function useAuth() {
  return useContext(AuthContext);
}

// 3. Create the Provider component
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    // Try to get user from sessionStorage on initial load
    const savedUser = sessionStorage.getItem("worktracker_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  // Sync currentUser with sessionStorage whenever it changes
  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem("worktracker_user", JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem("worktracker_user");
    }
  }, [currentUser]);

  useEffect(() => {
    // This listener fires automatically whenever the user logs in or out
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true); // Ensure loading is true when we are checking auth state
      if (firebaseUser) {
        // User is logged into Firebase Auth. Now fetch their extra data from Firestore!
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            // Combine Auth UID with Firestore data
            setCurrentUser({ uid: firebaseUser.uid, ...userDoc.data() });
          } else {
            console.error("User document not found in Firestore!");
            setCurrentUser(null);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setCurrentUser(null);
        }
      } else {
        // No user is logged in via Firebase Auth
        // BUT if we have a hardcoded user (like an admin), we keep them!
        setCurrentUser(prev => (prev?.isHardcoded ? prev : null));
      }

      // Stop the loading screen once we know the auth state
      setLoading(false);
    });

    // Cleanup the listener when the component unmounts
    return unsubscribe;
  }, []);

  // Heartbeat mechanism to track window presence (Fallback for background tabs)
  useEffect(() => {
    let interval;
    if (currentUser && currentUser.uid && currentUser.clockedIn) {
      const updateHeartbeat = async () => {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          await updateDoc(userDocRef, {
            lastSeen: new Date().toISOString(),
          });
        } catch (error) {
          console.warn("Heartbeat update failed:", error);
        }
      };

      // Run immediately and then every 15 seconds
      updateHeartbeat();
      interval = setInterval(updateHeartbeat, 15000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentUser?.uid, currentUser?.clockedIn]);

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      // Clear state immediately to avoid redirection race conditions
      setCurrentUser(null); 
      sessionStorage.removeItem("worktracker_user");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  // Update user locally
  const updateUser = (updatedData) => {
    if (!updatedData) {
      setCurrentUser(null);
    } else {
      setCurrentUser(prevUser => ({ ...(prevUser || {}), ...updatedData }));
    }
  };

  // The values we want to provide to the rest of the app
  const value = {
    currentUser,
    loading,
    logout,
    updateUser,
    refreshUser: async () => {
      if (auth.currentUser) {
        setLoading(true);
        try {
          const userDocRef = doc(db, "users", auth.currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setCurrentUser({ uid: auth.currentUser.uid, ...userDoc.data() });
          }
        } catch (error) {
          console.error("Refresh error:", error);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {/* 
        Changing this from {!loading && children} to just {children}.
        This ensures the App never unmounts during auth transitions, 
        which keeps the Login page validation messages visible and prevents 
        unexpected "refreshes".
      */}
      {children}
    </AuthContext.Provider>
  );
}
