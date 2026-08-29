import api from '../utils/api';
import { faceStore } from '../models/FaceDataModel';

const CACHE_KEY = 'cached_face_descriptors_v1';
const CACHE_TIMESTAMP_KEY = 'cached_face_descriptors_ts';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

class FaceDataService {
  constructor() {
    this.isLoading = false;
    this.modelsLoading = false;
    this.modelsLoaded = false;
  }

  /**
   * Preload face-api neural net models into browser memory in the background
   */
  async preloadModels() {
    if (this.modelsLoaded || this.modelsLoading) return;
    if (typeof window === 'undefined') return;

    this.modelsLoading = true;
    try {
      // Wait for faceapi script from index.html if still loading
      let waited = 0;
      while (!window.faceapi && waited < 5000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
      }

      if (!window.faceapi) {
        console.warn('[FaceDataService] window.faceapi not yet ready for preloading.');
        this.modelsLoading = false;
        return;
      }

      const loadFromLocalOrCdn = async () => {
        try {
          const promises = [];
          if (!window.faceapi.nets.tinyFaceDetector.params) {
            promises.push(window.faceapi.nets.tinyFaceDetector.loadFromUri('/models'));
          }
          if (!window.faceapi.nets.faceLandmark68Net.params) {
            promises.push(window.faceapi.nets.faceLandmark68Net.loadFromUri('/models'));
          }
          if (!window.faceapi.nets.faceRecognitionNet.params) {
            promises.push(window.faceapi.nets.faceRecognitionNet.loadFromUri('/models'));
          }
          await Promise.all(promises);
        } catch (localErr) {
          console.warn('[FaceDataService] Local models failed, falling back to CDN:', localErr);
          const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
          await Promise.all([
            window.faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL),
            window.faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL),
            window.faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL)
          ]);
        }
      };

      await loadFromLocalOrCdn();
      this.modelsLoaded = true;
      console.log('[FaceDataService] Face AI models preloaded successfully in background.');
    } catch (err) {
      console.warn('[FaceDataService] Failed to preload face models:', err);
    } finally {
      this.modelsLoading = false;
    }
  }

  /**
   * Load cached faces from localStorage into memory immediately
   */
  loadFromLocalCache() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          faceStore.setEnrolledFaces(parsed);
          return true;
        }
      }
    } catch (e) {
      console.warn('[FaceDataService] Error reading local face cache:', e);
    }
    return false;
  }

  /**
   * Fetch all active employee face embeddings from backend and update faceStore
   * @param {boolean} force - Force refresh ignoring cache
   */
  async preloadFaceData(force = false) {
    // 1. Immediately hydrate from localStorage if available
    if (!faceStore.hasEnrolledFaces()) {
      this.loadFromLocalCache();
    }

    // Check if cache is still fresh unless forced
    const lastTs = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    const isFresh = lastTs && (Date.now() - parseInt(lastTs, 10) < CACHE_DURATION_MS);
    if (!force && isFresh && faceStore.hasEnrolledFaces()) {
      // Also initiate background model preloading
      this.preloadModels().catch(() => {});
      return faceStore.getFaces();
    }

    if (this.isLoading) return faceStore.getFaces();
    this.isLoading = true;

    try {
      console.log('[FaceDataService] Fetching all enrolled face data from backend...');
      const response = await api.get('/face/all');
      if (Array.isArray(response.data)) {
        faceStore.setEnrolledFaces(response.data);

        // Cache in localStorage (storing array without circular refs)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(response.data));
          localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
        } catch (storageErr) {
          console.warn('[FaceDataService] LocalStorage quota exceeded or error caching face data:', storageErr);
        }
      }
    } catch (error) {
      console.error('[FaceDataService] Failed to fetch face data from backend:', error);
    } finally {
      this.isLoading = false;
      // Preload AI models in background as well
      this.preloadModels().catch(() => {});
    }

    return faceStore.getFaces();
  }

  /**
   * Compare detected face descriptor against client-side model store
   * @param {Float32Array|number[]} queryDescriptor 
   * @param {number} threshold 
   * @returns {{ match: any, distance: number, confidence: number } | null}
   */
  matchFace(queryDescriptor, threshold = 0.52) {
    return faceStore.findBestMatch(queryDescriptor, threshold);
  }

  /**
   * Check if face models and face store are ready
   */
  isReady() {
    return faceStore.hasEnrolledFaces() && this.modelsLoaded;
  }
}

export const faceDataService = new FaceDataService();
export default faceDataService;
