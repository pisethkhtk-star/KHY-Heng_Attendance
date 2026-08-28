import api from '../utils/api';

/**
 * BaseApiService
 * Abstract base service providing standard CRUD operations using Axios api client.
 */
export class BaseApiService {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.api = api;
  }

  /**
   * Fetch all records with optional query parameters
   * @param {Object} [params]
   * @returns {Promise<any>}
   */
  async getAll(params = {}) {
    const response = await this.api.get(this.endpoint, { params });
    return response.data;
  }

  /**
   * Fetch single record by ID
   * @param {string|number} id
   * @returns {Promise<any>}
   */
  async getById(id) {
    const response = await this.api.get(`${this.endpoint}/${id}`);
    return response.data;
  }

  /**
   * Create a new record
   * @param {Object} payload
   * @returns {Promise<any>}
   */
  async create(payload) {
    const response = await this.api.post(this.endpoint, payload);
    return response.data;
  }

  /**
   * Update existing record
   * @param {string|number} id
   * @param {Object} payload
   * @returns {Promise<any>}
   */
  async update(id, payload) {
    const response = await this.api.put(`${this.endpoint}/${id}`, payload);
    return response.data;
  }

  /**
   * Delete record by ID
   * @param {string|number} id
   * @returns {Promise<any>}
   */
  async delete(id) {
    const response = await this.api.delete(`${this.endpoint}/${id}`);
    return response.data;
  }
}
