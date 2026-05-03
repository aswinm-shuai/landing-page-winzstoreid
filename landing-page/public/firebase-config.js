import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAa79AiF0E6BPYUhxkDSo5Bqjdiw6-MlnA",
  authDomain: "subflow-web-8070c.firebaseapp.com",
  projectId: "subflow-web-8070c",
  storageBucket: "subflow-web-8070c.firebasestorage.app",
  messagingSenderId: "139957202151",
  appId: "1:139957202151:web:7605a63c5f29712e608642"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, { experimentalForceLongPolling: true });
export const storage = getStorage(app);

// GANTI DENGAN UID ADMIN ANDA
// UID ini digunakan untuk mengambil data spesifik toko Anda dari database Subflow
export const STORE_UID = "Jvn925whZfaKcFeCgUrbcrkZOvO2";
