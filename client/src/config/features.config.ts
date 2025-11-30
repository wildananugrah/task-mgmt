/**
 * Feature Flags Configuration
 * Controls which features are enabled/disabled in the application
 */

export interface FeatureFlags {
  fileStorage: boolean;
}

// Read from environment variables
const ENABLE_FILE_STORAGE = import.meta.env.VITE_ENABLE_FILE_STORAGE === 'true';

export const featureFlags: FeatureFlags = {
  fileStorage: ENABLE_FILE_STORAGE,
};

/**
 * Check if file storage feature is enabled
 */
export function isFileStorageEnabled(): boolean {
  return featureFlags.fileStorage;
}

export default featureFlags;
