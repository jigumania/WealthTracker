import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAvokQGmrFMLFvzLVT_hmKCtsUKiFepsG4",
    authDomain: "wealth-tracker-jiggy-133796.firebaseapp.com",
    projectId: "wealth-tracker-jiggy-133796",
    storageBucket: "wealth-tracker-jiggy-133796.firebasestorage.app",
    messagingSenderId: "225256967493",
    appId: "1:225256967493:web:7766fe4738dbb82d5a422c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
