import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore'; // Import Firestore

const firebaseConfig = {
  apiKey: "AIzaSyAFYSmtIlqROIYw_X2viPmA6xgUjIrJ3N0",
  authDomain: "lels-471ca.firebaseapp.com",
  projectId: "lels-471ca",
  storageBucket: "lels-471ca.appspot.com",
  messagingSenderId: "986233703071",
  appId: "1:986233703071:web:0a15471acebc3252aa30aa",
  measurementId: "G-NQBKSBNL8E",
  databaseURL: "https://lels-471ca-default-rtdb.firebaseio.com/",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);
const firestore = getFirestore(app);  // Initialize Firestore

export { database, storage, firestore };
