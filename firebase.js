import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore
} from
    "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js"; 
 
 
const firebaseConfig = { 
 
    apiKey: "AIzaSyD2TLHnVzYfD_5CWuP15dn25Qhxyhuksg4 " ,  
 
    authDomain: "gd11-demonlist.firebaseapp.com" ,  
 
    projectId: "gd11-demonlist " ,  
 
    storageBucket: "gd11-demonlist.firebasestorage.app" ,  
 
    messagingSenderId: "645171215190" ,  
 
    appId: "1:645171215190:web:222c39c99b1f64116e74f7" 
 
}; 
 
 
const app = initializeApp(firebaseConfig); 
 
export const db = getFirestore(app);