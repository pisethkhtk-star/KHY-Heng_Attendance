import { BaseModel } from './BaseModel';

/**
 * BranchLocationModel
 * Represents branch kiosk geofencing configuration (GPS coordinates & radius).
 */
export class BranchLocationModel extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.id = data.id || null;
    this.name = data.name || '';
    this.latitude = data.latitude != null ? parseFloat(data.latitude) : null;
    this.longitude = data.longitude != null ? parseFloat(data.longitude) : null;
    this.radius = data.radius != null ? parseFloat(data.radius) : 100.0;
  }

  /**
   * Calculate Haversine distance in meters to a target coordinate
   * @param {number} clientLat 
   * @param {number} clientLng 
   * @returns {number} Distance in meters
   */
  distanceTo(clientLat, clientLng) {
    if (this.latitude == null || this.longitude == null || clientLat == null || clientLng == null) {
      return Infinity;
    }
    const R = 6371e3; // Earth radius in meters
    const phi1 = (clientLat * Math.PI) / 180;
    const phi2 = (this.latitude * Math.PI) / 180;
    const deltaPhi = ((this.latitude - clientLat) * Math.PI) / 180;
    const deltaLambda = ((this.longitude - clientLng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Check if coordinates fall within this branch's radius
   * @param {number} clientLat 
   * @param {number} clientLng 
   * @returns {boolean}
   */
  isInside(clientLat, clientLng) {
    return this.distanceTo(clientLat, clientLng) <= this.radius;
  }
}

/**
 * BranchLocationStore
 * In-memory client-side store for branch geofence settings.
 */
class BranchLocationStore {
  constructor() {
    this.branches = [];
    this.isLoaded = false;
    this.lastFetched = null;
  }

  /**
   * Set branch records from backend API
   * @param {Array} rawList 
   */
  setBranches(rawList = []) {
    if (!Array.isArray(rawList)) return;
    this.branches = rawList
      .map(b => new BranchLocationModel(b))
      .filter(b => b.latitude != null && b.longitude != null);
    this.isLoaded = true;
    this.lastFetched = new Date();
    console.log(`[BranchLocationStore] Initialized ${this.branches.length} branch locations in client store.`);
  }

  getBranches() {
    return this.branches;
  }

  hasBranches() {
    return this.branches.length > 0;
  }

  /**
   * Filter branches assigned to a specific employee branch string (e.g. "Phnom Penh HQ, Siem Reap")
   * @param {string} employeeBranchStr 
   * @returns {BranchLocationModel[]}
   */
  getAllowedBranches(employeeBranchStr) {
    if (!employeeBranchStr || typeof employeeBranchStr !== 'string' || !employeeBranchStr.trim()) {
      return this.branches;
    }

    const assignedNames = employeeBranchStr
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (assignedNames.length === 0) return this.branches;

    const matched = this.branches.filter(b =>
      assignedNames.some(name => b.name.toLowerCase().includes(name) || name.includes(b.name.toLowerCase()))
    );

    return matched.length > 0 ? matched : this.branches;
  }

  /**
   * Compare client GPS coordinates against allowed branch geofences locally
   * @param {number} clientLat 
   * @param {number} clientLng 
   * @param {string} [employeeBranchStr] 
   * @returns {{ isInside: boolean, closestBranch: BranchLocationModel|null, closestDistance: number, activeBranch: BranchLocationModel|null }}
   */
  checkGeofence(clientLat, clientLng, employeeBranchStr = '') {
    if (clientLat == null || clientLng == null || this.branches.length === 0) {
      return {
        isInside: false,
        closestBranch: null,
        closestDistance: Infinity,
        activeBranch: null,
        message: 'No GPS or branch location data available'
      };
    }

    const checkList = this.getAllowedBranches(employeeBranchStr);
    let isInside = false;
    let closestBranch = null;
    let closestDistance = Infinity;
    let activeBranch = null;

    for (const branch of checkList) {
      const dist = branch.distanceTo(clientLat, clientLng);
      if (dist <= branch.radius) {
        isInside = true;
        activeBranch = branch;
      }
      if (dist < closestDistance) {
        closestDistance = dist;
        closestBranch = branch;
      }
    }

    return {
      isInside,
      closestBranch,
      closestDistance: Math.round(closestDistance),
      activeBranch,
      closestRadius: closestBranch ? closestBranch.radius : 100
    };
  }

  clear() {
    this.branches = [];
    this.isLoaded = false;
    this.lastFetched = null;
  }
}

export const branchLocationStore = new BranchLocationStore();
export default branchLocationStore;
