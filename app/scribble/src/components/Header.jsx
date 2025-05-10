import React from 'react';
import { ArrowLeft } from 'lucide-react';

const Header = () => {
  const handleBackToRoom = () => {
    const roomId = localStorage.getItem("roomId");
    if (roomId) {
      window.location.href = `/?roomId=${roomId}`;
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="bg-custom-blue p-3 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleBackToRoom}
            className="p-1.5 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition-colors"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">sketch.io</h1>
        </div>
        
        <div className="text-white text-sm font-medium">
          Draw and Guess!
        </div>
      </div>
    </div>
  );
};

export default Header;
