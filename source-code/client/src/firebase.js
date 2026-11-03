// Firebase is used for Google sign-in only; user data is stored in Neon via the API.
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Web config is public by design; override with VITE_FIREBASE_* env vars if needed.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDzWaATU0_Mq2hseLumEHrrpcW750RqDTk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "streetnetworkanalysis.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "streetnetworkanalysis",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:424449003734:web:752c75d45090bede57f977"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { app, auth, provider };
