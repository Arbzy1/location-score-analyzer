// Import required Firebase modules
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // ✅ Import GoogleAuthProvider
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Firebase configuration (Replace with YOUR actual config)
const firebaseConfig = {
  apiKey: "AIzaSyDzWaATU0_Mq2hseLumEHrrpcW750RqDTk",
  authDomain: "streetnetworkanalysis.firebaseapp.com",
  projectId: "streetnetworkanalysis",
  storageBucket: "streetnetworkanalysis.appspot.com",
  messagingSenderId: "424449003734",
  appId: "1:424449003734:web:752c75d45090bede57f977",
  measurementId: "G-KBSSF2DYD2"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Firebase services
const db = getFirestore(app);       // Firestore database
const auth = getAuth(app);          // Firebase Authentication
const provider = new GoogleAuthProvider(); // ✅ Added Google Sign-in Provider
const storage = getStorage(app);    // Firebase Storage
const analytics = getAnalytics(app); // Firebase Analytics

// ✅ Export everything
export { app, db, auth, provider, storage, analytics };
