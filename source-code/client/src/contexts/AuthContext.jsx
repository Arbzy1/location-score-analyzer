import { createContext, useContext, useState, useEffect } from "react";
import { auth, provider } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  console.log("🔐 AuthProvider: Initializing");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🔄 AuthProvider: Setting up auth listener");
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("👤 Auth state changed:", currentUser ? "User logged in" : "No user");
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      console.log("🧹 AuthProvider: Cleaning up auth listener");
      unsubscribe();
    };
  }, []);

  const signIn = async () => {
    console.log("🔑 Attempting Google sign-in");
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("✅ Sign-in successful:", result.user.email);
      setUser(result.user);
    } catch (error) {
      console.error("❌ Login failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    console.log("🚪 Attempting logout");
    try {
      await signOut(auth);
      console.log("✅ Logout successful");
      setUser(null);
    } catch (error) {
      console.error("❌ Logout failed:", error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signIn,
    logout
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
} 