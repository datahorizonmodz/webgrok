import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCaCVfxYTP3IvR6Jrh3mM0GBsvYKJRjRe4",
    authDomain: "datzon-web.firebaseapp.com",
    projectId: "datzon-web",
    storageBucket: "datzon-web.firebasestorage.app",
    messagingSenderId: "310892115798",
    appId: "1:310892115798:web:a03fb9d2b2137933b948f7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, signInAnonymously, collection, onSnapshot, doc };
