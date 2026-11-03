import { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../firebase";
import { 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut 
} from "firebase/auth";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🔄 AuthProvider: Setting up auth listener");
    const unsubscribe = auth.onAuthStateChanged(user => {
      console.log("👤 Auth state changed:", user ? "User logged in" : "No user");
      setCurrentUser(user);
      setLoading(false);
    });

    return () => {
      console.log("🧹 AuthProvider: Cleaning up auth listener");
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const logout = async () => {
    console.log("🚪 Attempting logout");
    return signOut(auth);
  };

  const value = {
    currentUser,
    signInWithGoogle,
    logout,
    loading
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 