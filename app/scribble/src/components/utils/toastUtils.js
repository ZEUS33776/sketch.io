import { toast } from 'react-hot-toast';

// Create safe toast functions that won't crash if toast isn't available
const safeToast = {
  success: (message, options = {}) => {
    try {
      return toast.success(message, options);
    } catch (error) {
      console.warn('Toast error:', error);
      console.info('Toast message:', message);
    }
  },
  
  error: (message, options = {}) => {
    try {
      return toast.error(message, options);
    } catch (error) {
      console.warn('Toast error:', error);
      console.error('Toast message:', message);
    }
  },
  
  info: (message, options = {}) => {
    try {
      // If toast.info doesn't exist, fall back to toast.success
      if (typeof toast.info === 'function') {
        return toast.info(message, options);
      } else {
        return toast.success(message, { 
          ...options,
          style: { ...options.style, background: '#3b82f6' } // Blue for info
        });
      }
    } catch (error) {
      console.warn('Toast error:', error);
      console.info('Toast message:', message);
    }
  }
};

export default safeToast; 