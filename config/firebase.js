const { initializeApp } = require('firebase/app');
const {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
} = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyDgsVvuQsqejmw8B6cxJxWENnkIBCkSslU",
    authDomain: "bombaiwala-chat.firebaseapp.com",
    projectId: "bombaiwala-chat",
    storageBucket: "bombaiwala-chat.firebasestorage.app",
    messagingSenderId: "231756735849",
    appId: "1:231756735849:web:77b1bc54bdcc374f47c9f8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

module.exports = {
    db,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
};
