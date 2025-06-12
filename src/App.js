import React from 'react';
import './App.css';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

// 🔁 Paste your actual Firebase config here:
const firebaseConfig = {
  apiKey: "AIzaSyDVj89SXzbWlQK2EUHtFSMQozLJuC_Sq9c",
  authDomain: "camera-d5533.firebaseapp.com",
  projectId: "camera-d5533",
  storageBucket: "camera-d5533.firebasestorage.app",
  messagingSenderId: "979816260669",
  appId: "1:979816260669:web:6484a5b85229e4f2677654"
};


const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function App() {
  const setCameraState = (state) => {
    set(ref(db, 'camera/command'), state);
  };

  return (
    <div className="App">
      <h1>📱 Control Phone Camera</h1>
      <button onClick={() => setCameraState("on")} style={{ padding: "10px 20px", marginRight: 10 }}>Turn ON</button>
      <button onClick={() => setCameraState("off")} style={{ padding: "10px 20px" }}>Turn OFF</button>
    </div>
  );
}

export default App;
