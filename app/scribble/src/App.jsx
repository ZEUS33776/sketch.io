import { useState, useEffect } from 'react';
import AvatarPage from './pages/AvatarPage';
import { Toaster } from 'react-hot-toast';

function App() {
  // Check for network connection
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Update network status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          success: {
            style: {
              background: '#4ade80',
              color: 'white',
            },
          },
          error: {
            style: {
              background: '#ef4444',
              color: 'white',
            },
          },
        }}
      />
      
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center p-2 z-50">
          You are currently offline. Please check your connection.
        </div>
      )}
      
      <AvatarPage />
    </div>
  );
}

export default App;
