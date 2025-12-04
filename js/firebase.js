// firebase.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBw5SGaLMuQ3U-d4ID08tkHxDtEchp4gy8",
  authDomain: "tree-72e80.firebaseapp.com",
  projectId: "tree-72e80",
  storageBucket: "gs://tree-72e80.firebasestorage.app",
  messagingSenderId: "794600869996",
  appId: "1:794600869996:web:bef802290914e20f088849"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const storage = getStorage(app);             // ✅ use this app + bucket

export { app, db, storage };
