import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { faceDataService } from '../services/FaceDataService';
import { faceStore } from '../models/FaceDataModel';
import { branchLocationService } from '../services/BranchLocationService';
import { branchLocationStore } from '../models/BranchLocationModel';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        setUser(response.data);
        // Preload all face data and branch locations into client model store immediately upon login/session restore
        faceDataService.preloadFaceData().catch(err => {
          console.warn('Background face data preloading error:', err);
        });
        branchLocationService.preloadBranchLocations().catch(err => {
          console.warn('Background branch location preloading error:', err);
        });
      } catch (error) {
        console.error('Fetch current user failed:', error);
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password, client: 'web' });
      const { token: receivedToken, user: receivedUser } = response.data;
      
      localStorage.setItem('token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);

      // Preload all face data and branch locations into client model store immediately upon login
      faceDataService.preloadFaceData().catch(err => {
        console.warn('Background face data preloading error:', err);
      });
      branchLocationService.preloadBranchLocations().catch(err => {
        console.warn('Background branch location preloading error:', err);
      });

      return { success: true };
    } catch (error) {
      console.error('Login request failed:', error);
      const errMsg = error.response?.data?.message || 'Login failed';
      return { success: false, message: errMsg };
    } finally {
      setLoading(false);
    }
  };

  const loginWithQR = async (qrToken) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login-qr', { qrToken });
      const { token: receivedToken, user: receivedUser } = response.data;
      
      localStorage.setItem('token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);

      // Preload all face data and branch locations into client model store immediately upon login
      faceDataService.preloadFaceData().catch(err => {
        console.warn('Background face data preloading error:', err);
      });
      branchLocationService.preloadBranchLocations().catch(err => {
        console.warn('Background branch location preloading error:', err);
      });

      return { success: true };
    } catch (error) {
      console.error('QR Login request failed:', error);
      const errMsg = error.response?.data?.message || 'QR Login failed';
      return { success: false, message: errMsg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('cached_face_descriptors_v1');
    localStorage.removeItem('cached_face_descriptors_ts');
    localStorage.removeItem('cached_branch_locations_v1');
    localStorage.removeItem('cached_branch_locations_ts');
    faceStore.clear();
    branchLocationStore.clear();
    setToken(null);
    setUser(null);
  };

  const hasRole = (roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const hasPermission = (resource) => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    return user.permissions?.includes(resource) || false;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithQR, logout, hasRole, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
