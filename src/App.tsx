import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cash from './pages/Cash';
import Assets from './pages/Assets';
import Liabilities from './pages/Liabilities';
import { seedDatabase } from './db';
import { AuthProvider } from './context/AuthContext';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { initRealtimeSync } from './logic';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    seedDatabase().then(() => setInitialized(true));
  }, []);

  useEffect(() => {
    if (!initialized) return;

    let unsubscribeSync: (() => void) | undefined;

    console.log('Initializing Auth listener for Sync...');
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('User logged in, starting real-time sync for:', user.uid);
        unsubscribeSync = initRealtimeSync(user.uid);
      } else {
        console.log('User logged out, stopping real-time sync.');
        if (unsubscribeSync) {
          unsubscribeSync();
          unsubscribeSync = undefined;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSync) unsubscribeSync();
    };
  }, [initialized]);

  if (!initialized) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Initializing...</div>;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'cash': return <Cash />;
      case 'assets': return <Assets />;
      case 'liabilities': return <Liabilities />;
      default: return <Dashboard />;
    }
  };

  return (
    <AuthProvider>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </Layout>
    </AuthProvider>
  );
}

export default App;
