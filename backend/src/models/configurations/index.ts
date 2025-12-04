import { apiGenerator } from '../../utils/api-generator';
import { userConfig } from './user.config';

// Register all model configurations
export const registerAllModels = () => {
  apiGenerator.registerModel(userConfig);
};

// Export the configured API generator
export { apiGenerator };

// Export individual configurations for direct access
export { userConfig };