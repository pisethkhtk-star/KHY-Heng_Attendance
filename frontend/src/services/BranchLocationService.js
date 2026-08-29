import api from '../utils/api';
import { branchLocationStore } from '../models/BranchLocationModel';

const CACHE_KEY = 'cached_branch_locations_v1';
const CACHE_TIMESTAMP_KEY = 'cached_branch_locations_ts';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

class BranchLocationService {
  constructor() {
    this.isLoading = false;
  }

  loadFromLocalCache() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          branchLocationStore.setBranches(parsed);
          return true;
        }
      }
    } catch (e) {
      console.warn('[BranchLocationService] Error reading local branch location cache:', e);
    }
    return false;
  }

  /**
   * Preload all branch kiosk settings from backend upon login
   * @param {boolean} force 
   */
  async preloadBranchLocations(force = false) {
    if (!branchLocationStore.hasBranches()) {
      this.loadFromLocalCache();
    }

    const lastTs = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    const isFresh = lastTs && (Date.now() - parseInt(lastTs, 10) < CACHE_DURATION_MS);
    if (!force && isFresh && branchLocationStore.hasBranches()) {
      return branchLocationStore.getBranches();
    }

    if (this.isLoading) return branchLocationStore.getBranches();
    this.isLoading = true;

    try {
      console.log('[BranchLocationService] Fetching branch kiosk locations from backend...');
      const response = await api.get('/kiosk-settings');
      if (Array.isArray(response.data)) {
        branchLocationStore.setBranches(response.data);

        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(response.data));
          localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
        } catch (e) {
          console.warn('[BranchLocationService] Failed to cache branch locations to localStorage:', e);
        }
      }
    } catch (error) {
      console.error('[BranchLocationService] Failed to fetch branch locations:', error);
    } finally {
      this.isLoading = false;
    }

    return branchLocationStore.getBranches();
  }

  /**
   * Check client GPS coordinates against branch geofence locally
   * @param {number} clientLat 
   * @param {number} clientLng 
   * @param {string} [employeeBranchStr] 
   */
  checkGeofence(clientLat, clientLng, employeeBranchStr = '') {
    return branchLocationStore.checkGeofence(clientLat, clientLng, employeeBranchStr);
  }
}

export const branchLocationService = new BranchLocationService();
export default branchLocationService;
