import React, { useState, useEffect } from 'react';
import socket from './socket';
import { Settings, Save, Users, Clock, ArrowDown, ArrowUp, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const RoomSettings = ({ isHost, inPanel = false, onSettingsChanged }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    maxPlayers: 8,
    roundTime: 60,
    rounds: 3,
    wordOptions: 3
  });
  const [originalSettings, setOriginalSettings] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const roomId = localStorage.getItem('roomId');

  // Fetch current room settings when component mounts
  useEffect(() => {
    socket.on('roomSettingsUpdated', handleSettingsUpdate);
    socket.on('settingsError', handleSettingsError);

    // Request current settings
    if (roomId) {
      socket.emit('requestRoomSettings', { roomId });
    }

    return () => {
      socket.off('roomSettingsUpdated', handleSettingsUpdate);
      socket.off('settingsError', handleSettingsError);
    };
  }, [roomId]);

  // Handle settings updates from server
  const handleSettingsUpdate = (updatedSettings) => {
    setSettings(updatedSettings);
    setOriginalSettings(updatedSettings);
    setIsSaving(false);
    
    // Notify parent that settings are saved/synced
    if (onSettingsChanged) {
      onSettingsChanged(false);
    }
  };
  
  // Handle settings errors
  const handleSettingsError = (error) => {
    toast.error(error.error || "Failed to update settings");
    setIsSaving(false);
    setSettings(originalSettings); // Revert to original settings
    
    // Notify parent that settings are reverted
    if (onSettingsChanged) {
      onSettingsChanged(false);
    }
  };

  // Check if settings have changed from original
  const checkIfSettingsChanged = (newSettings) => {
    // Skip if we don't have original settings yet
    if (Object.keys(originalSettings).length === 0) return false;
    
    return Object.keys(originalSettings).some(key => 
      newSettings[key] !== originalSettings[key]
    );
  };

  // Handle change in settings
  const handleChange = (e) => {
    const { name, value } = e.target;
    let numValue = parseInt(value, 10);

    // Apply min/max constraints
    if (name === 'maxPlayers') {
      numValue = Math.max(2, Math.min(12, numValue));
    } else if (name === 'roundTime') {
      numValue = Math.max(30, Math.min(120, numValue));
    } else if (name === 'rounds') {
      numValue = Math.max(1, Math.min(10, numValue));
    } else if (name === 'wordOptions') {
      numValue = Math.max(1, Math.min(5, numValue));
    }

    const updatedSettings = {
      ...settings,
      [name]: numValue
    };
    
    setSettings(updatedSettings);
    
    // Notify parent if there are changes
    if (onSettingsChanged) {
      const hasChanges = checkIfSettingsChanged(updatedSettings);
      onSettingsChanged(hasChanges);
    }
  };

  // Increment/decrement handlers
  const increment = (setting) => {
    const maxValues = {
      maxPlayers: 12,
      roundTime: 120,
      rounds: 10,
      wordOptions: 5
    };

    if (settings[setting] < maxValues[setting]) {
      const updatedSettings = {
        ...settings,
        [setting]: settings[setting] + (setting === 'roundTime' ? 10 : 1)
      };
      
      setSettings(updatedSettings);
      
      // Notify parent if there are changes
      if (onSettingsChanged) {
        const hasChanges = checkIfSettingsChanged(updatedSettings);
        onSettingsChanged(hasChanges);
      }
    }
  };

  const decrement = (setting) => {
    const minValues = {
      maxPlayers: 2,
      roundTime: 30,
      rounds: 1,
      wordOptions: 1
    };

    if (settings[setting] > minValues[setting]) {
      const updatedSettings = {
        ...settings,
        [setting]: settings[setting] - (setting === 'roundTime' ? 10 : 1)
      };
      
      setSettings(updatedSettings);
      
      // Notify parent if there are changes
      if (onSettingsChanged) {
        const hasChanges = checkIfSettingsChanged(updatedSettings);
        onSettingsChanged(hasChanges);
      }
    }
  };

  // Save settings
  const saveSettings = () => {
    if (roomId && isHost) {
      setIsSaving(true);
      socket.emit('updateRoomSettings', {
        roomId,
        settings
      });

      // When not in panel mode, close the settings popup
      if (!inPanel) {
        setIsOpen(false);
      }
    }
  };

  // Cancel changes
  const cancelChanges = () => {
    setSettings(originalSettings);
    
    // Notify parent that settings are reverted
    if (onSettingsChanged) {
      onSettingsChanged(false);
    }
    
    if (!inPanel) {
      setIsOpen(false);
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = checkIfSettingsChanged(settings);

  // If user is not host, don't render settings button
  if (!isHost) {
    return null;
  }

  return inPanel ? (
    <div className="space-y-4">
      {/* Max Players Setting */}
      <div className="flex flex-col">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          <Users size={16} />
          Max Players
        </label>
        <div className="flex">
          <input
            type="number"
            name="maxPlayers"
            value={settings.maxPlayers}
            onChange={handleChange}
            min="2"
            max="12"
            className="w-full p-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex flex-col">
            <button
              onClick={() => increment('maxPlayers')}
              className="bg-gray-200 px-2 rounded-tr hover:bg-gray-300"
              title="Increase max players"
            >
              <ArrowUp size={16} />
            </button>
            <button
              onClick={() => decrement('maxPlayers')}
              className="bg-gray-200 px-2 rounded-br hover:bg-gray-300"
              title="Decrease max players"
            >
              <ArrowDown size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Round Time Setting */}
      <div className="flex flex-col">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          <Clock size={16} />
          Round Time (seconds)
        </label>
        <div className="flex">
          <input
            type="number"
            name="roundTime"
            value={settings.roundTime}
            onChange={handleChange}
            min="30"
            max="120"
            step="10"
            className="w-full p-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex flex-col">
            <button
              onClick={() => increment('roundTime')}
              className="bg-gray-200 px-2 rounded-tr hover:bg-gray-300"
              title="Increase round time"
            >
              <ArrowUp size={16} />
            </button>
            <button
              onClick={() => decrement('roundTime')}
              className="bg-gray-200 px-2 rounded-br hover:bg-gray-300"
              title="Decrease round time"
            >
              <ArrowDown size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Number of Rounds Setting */}
      <div className="flex flex-col">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          Number of Rounds
        </label>
        <div className="flex">
          <input
            type="number"
            name="rounds"
            value={settings.rounds}
            onChange={handleChange}
            min="1"
            max="10"
            className="w-full p-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex flex-col">
            <button
              onClick={() => increment('rounds')}
              className="bg-gray-200 px-2 rounded-tr hover:bg-gray-300"
              title="Increase rounds"
            >
              <ArrowUp size={16} />
            </button>
            <button
              onClick={() => decrement('rounds')}
              className="bg-gray-200 px-2 rounded-br hover:bg-gray-300"
              title="Decrease rounds"
            >
              <ArrowDown size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Word Options Setting */}
      <div className="flex flex-col">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          Word Options per Turn
        </label>
        <div className="flex">
          <input
            type="number"
            name="wordOptions"
            value={settings.wordOptions}
            onChange={handleChange}
            min="1"
            max="5"
            className="w-full p-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex flex-col">
            <button
              onClick={() => increment('wordOptions')}
              className="bg-gray-200 px-2 rounded-tr hover:bg-gray-300"
              title="Increase word options"
            >
              <ArrowUp size={16} />
            </button>
            <button
              onClick={() => decrement('wordOptions')}
              className="bg-gray-200 px-2 rounded-br hover:bg-gray-300"
              title="Decrease word options"
            >
              <ArrowDown size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-6">
        <button
          onClick={saveSettings}
          disabled={isSaving || !hasUnsavedChanges}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded font-medium ${
            hasUnsavedChanges
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Save size={16} />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={cancelChanges}
          disabled={!hasUnsavedChanges}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded font-medium ${
            hasUnsavedChanges
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <X size={16} />
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 bg-indigo-500 text-white rounded-full"
        title="Room Settings"
      >
        <Settings size={20} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Room Settings</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="w-80 space-y-4">
              {/* Settings controls */}
              <div className="flex flex-col">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Users size={16} />
                  Max Players
                </label>
                <div className="flex">
                  <input
                    type="number"
                    name="maxPlayers"
                    value={settings.maxPlayers}
                    onChange={handleChange}
                    min="2"
                    max="12"
                    className="w-full p-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <button
                      onClick={() => increment('maxPlayers')}
                      className="bg-gray-200 px-2 rounded-tr hover:bg-gray-300"
                      title="Increase max players"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      onClick={() => decrement('maxPlayers')}
                      className="bg-gray-200 px-2 rounded-br hover:bg-gray-300"
                      title="Decrease max players"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Round Time Setting */}
              <div className="flex flex-col">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Clock size={16} />
                  Round Time (seconds)
                </label>
                <div className="flex">
                  <input
                    type="number"
                    name="roundTime"
                    value={settings.roundTime}
                    onChange={handleChange}
                    min="30"
                    max="120"
                    step="10"
                    className="w-full p-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <button
                      onClick={() => increment('roundTime')}
                      className="bg-gray-200 px-2 rounded-tr hover:bg-gray-300"
                      title="Increase round time"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      onClick={() => decrement('roundTime')}
                      className="bg-gray-200 px-2 rounded-br hover:bg-gray-300"
                      title="Decrease round time"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Number of Rounds Setting */}
              <div className="flex flex-col">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  Number of Rounds
                </label>
                <div className="flex">
                  <input
                    type="number"
                    name="rounds"
                    value={settings.rounds}
                    onChange={handleChange}
                    min="1"
                    max="10"
                    className="w-full p-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <button
                      onClick={() => increment('rounds')}
                      className="bg-gray-200 px-2 rounded-tr hover:bg-gray-300"
                      title="Increase rounds"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      onClick={() => decrement('rounds')}
                      className="bg-gray-200 px-2 rounded-br hover:bg-gray-300"
                      title="Decrease rounds"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Word Options Setting */}
              <div className="flex flex-col">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  Word Options per Turn
                </label>
                <div className="flex">
                  <input
                    type="number"
                    name="wordOptions"
                    value={settings.wordOptions}
                    onChange={handleChange}
                    min="1"
                    max="5"
                    className="w-full p-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <button
                      onClick={() => increment('wordOptions')}
                      className="bg-gray-200 px-2 rounded-tr hover:bg-gray-300"
                      title="Increase word options"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      onClick={() => decrement('wordOptions')}
                      className="bg-gray-200 px-2 rounded-br hover:bg-gray-300"
                      title="Decrease word options"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={saveSettings}
                  disabled={isSaving || !hasUnsavedChanges}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded font-medium ${
                    hasUnsavedChanges
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={cancelChanges}
                  disabled={!hasUnsavedChanges}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded font-medium ${
                    hasUnsavedChanges
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <X size={16} />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RoomSettings; 