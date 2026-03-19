import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase"; // Adjust this path if your firebase.js is in a different folder

// 1. Create the Context
const AuthContext = createContext();

// 2. Create a custom hook so other files can easily use the auth data
export function useAuth() {
  return useContext(AuthContext);
}

// 3. Create the Provider component
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This listener fires automatically whenever the user logs in or out
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
        // No user is logged in
        setCurrentUser(null);
      }

      // Stop the loading screen once we know the auth state
      setLoading(false);
    });

    // Cleanup the listener when the component unmounts
    return unsubscribe;
  }, []);

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  // The values we want to provide to the rest of the app
  const value = {
    currentUser,
    loading,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {/* We only render the app once Firebase has checked the initial login state */}
      {!loading && children}
    </AuthContext.Provider>
  );
}
