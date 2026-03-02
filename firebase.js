import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCaCVfxYTP3IvR6Jrh3mM0GBsvYKJRjRe4",
    authDomain: "datzon-web.firebaseapp.com",
    projectId: "datzon-web",
    storageBucket: "datzon-web.firebasestorage.app",
    messagingSenderId: "310892115798",
    appId: "1:310892115798:web:a03fb9d2b2137933b948f7"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
