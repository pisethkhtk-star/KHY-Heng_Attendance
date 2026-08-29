/**
 * Global Camera Manager
 * Tracks active MediaStream instances across the application and ensures
 * they are automatically stopped when navigating away from camera pages.
 */

const activeStreams = new Set();

/**
 * Register an active camera stream
 * @param {MediaStream} stream 
 */
export const registerCameraStream = (stream) => {
  if (!stream) return;
  activeStreams.add(stream);

  // Automatically remove when all tracks have ended
  stream.getTracks().forEach(track => {
    track.addEventListener('ended', () => {
      const allEnded = stream.getTracks().every(t => t.readyState === 'ended');
      if (allEnded) {
        activeStreams.delete(stream);
      }
    });
  });
};

/**
 * Unregister a stream manually
 * @param {MediaStream} stream 
 */
export const unregisterCameraStream = (stream) => {
  if (!stream) return;
  activeStreams.delete(stream);
};

/**
 * Stop all active camera and media streams across the entire app
 */
export const stopAllCameraStreams = () => {
  if (activeStreams.size > 0) {
    console.log(`[CameraManager] Stopping ${activeStreams.size} active camera stream(s)...`);
  }

  activeStreams.forEach(stream => {
    try {
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach(track => {
          if (track.readyState !== 'ended') {
            track.stop();
            console.log(`[CameraManager] Stopped camera track: ${track.label || track.id}`);
          }
        });
      }
    } catch (e) {
      console.warn('[CameraManager] Error stopping stream track:', e);
    }
  });

  activeStreams.clear();
};

export default {
  registerCameraStream,
  unregisterCameraStream,
  stopAllCameraStreams,
};
