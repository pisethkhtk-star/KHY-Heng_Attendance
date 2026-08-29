import { BaseModel } from './BaseModel';

/**
 * FaceDataModel
 * Represents registered face embedding data and provides client-side local recognition.
 */
export class FaceDataModel extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.staffId = data.staffId || '';
    this.nameEn = data.nameEn || '';
    this.nameKh = data.nameKh || '';
    this.photoUrl = data.photoUrl || '';
    
    // Ensure descriptor is a Float32Array for ultra-fast vector computation
    if (data.descriptor instanceof Float32Array) {
      this.descriptor = data.descriptor;
    } else if (Array.isArray(data.descriptor)) {
      this.descriptor = new Float32Array(data.descriptor);
    } else if (typeof data.descriptor === 'string') {
      try {
        this.descriptor = new Float32Array(JSON.parse(data.descriptor));
      } catch (e) {
        this.descriptor = null;
      }
    } else {
      this.descriptor = null;
    }
  }

  /**
   * Euclidean distance between two vectors
   * @param {Float32Array|number[]} a 
   * @param {Float32Array|number[]} b 
   * @returns {number}
   */
  static euclideanDistance(a, b) {
    if (!a || !b || a.length !== b.length) return 1.0;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}

/**
 * FaceStore
 * In-memory client-side registry for all enrolled employee face embeddings.
 */
class FaceStore {
  constructor() {
    this.faces = [];
    this.isLoaded = false;
    this.lastFetched = null;
  }

  /**
   * Initialize store with raw face records from backend
   * @param {Array} rawList
   */
  setEnrolledFaces(rawList = []) {
    if (!Array.isArray(rawList)) return;
    this.faces = rawList
      .map(item => new FaceDataModel(item))
      .filter(item => item.descriptor && item.descriptor.length === 128);
    this.isLoaded = true;
    this.lastFetched = new Date();
    console.log(`[FaceStore] Initialized ${this.faces.length} face embedding models in client store.`);
  }

  /**
   * Get all registered face models
   * @returns {FaceDataModel[]}
   */
  getFaces() {
    return this.faces;
  }

  /**
   * Check if face models are ready
   * @returns {boolean}
   */
  hasEnrolledFaces() {
    return this.faces.length > 0;
  }

  /**
   * Match a detected face descriptor against all enrolled face embeddings in client memory
   * @param {Float32Array|number[]} queryDescriptor 
   * @param {number} threshold - Match threshold (default 0.52, lower is stricter)
   * @returns {{ match: FaceDataModel, distance: number } | null}
   */
  findBestMatch(queryDescriptor, threshold = 0.52) {
    if (!queryDescriptor || this.faces.length === 0) return null;

    let bestMatch = null;
    let minDistance = 1.0;

    for (let i = 0; i < this.faces.length; i++) {
      const candidate = this.faces[i];
      const dist = FaceDataModel.euclideanDistance(queryDescriptor, candidate.descriptor);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = candidate;
      }
    }

    if (bestMatch && minDistance <= threshold) {
      return {
        match: bestMatch,
        distance: minDistance,
        confidence: Math.max(0, Math.round((1 - minDistance) * 100))
      };
    }

    return null;
  }

  /**
   * Clear cached face store
   */
  clear() {
    this.faces = [];
    this.isLoaded = false;
    this.lastFetched = null;
  }
}

export const faceStore = new FaceStore();
export default faceStore;
