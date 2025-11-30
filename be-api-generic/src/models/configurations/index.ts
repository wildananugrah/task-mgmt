import { z } from 'zod';
import { apiGenerator } from '../../utils/api-generator';
import { productConfig } from './product.config';
import { categoryConfig } from './category.config';
import { userConfig } from './user.config';
import { orderConfig } from './order.config';
import { articleConfig } from './article.config';
import { bookConfig } from './book.config';

// Register all model configurations
export const registerAllModels = () => {
  apiGenerator.registerModel(productConfig);
  apiGenerator.registerModel(categoryConfig);
  apiGenerator.registerModel(userConfig);
  apiGenerator.registerModel(orderConfig);
  apiGenerator.registerModel(articleConfig);
  apiGenerator.registerModel(bookConfig);
};

// Export the configured API generator
export { apiGenerator };

// Export individual configurations for direct access
export { productConfig, categoryConfig, userConfig, orderConfig, articleConfig };