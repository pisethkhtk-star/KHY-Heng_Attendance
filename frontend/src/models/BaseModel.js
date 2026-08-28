/**
 * BaseModel
 * Base class for all frontend domain models.
 * Provides serialization, cloning, and attribute initialization.
 */
export class BaseModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : null;
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : null;
  }

  /**
   * Clone model instance
   * @returns {BaseModel}
   */
  clone() {
    return new this.constructor(this.toJSON());
  }

  /**
   * Convert model to plain JSON object
   * @returns {Object}
   */
  toJSON() {
    return { ...this };
  }
}
