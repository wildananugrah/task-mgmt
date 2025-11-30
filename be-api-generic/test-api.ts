import { registerAllModels, apiGenerator } from './src/models/configurations';

console.log('Registering models...');
registerAllModels();

console.log('Checking registered models:');
const modelNames = ['product', 'category', 'user', 'order'];

modelNames.forEach(name => {
  const config = apiGenerator.getModelConfig(name);
  console.log(`${name}: ${config ? 'Found ✓' : 'Not found ✗'}`);
});

console.log('\nGenerating routes...');
const routes = apiGenerator.generateRESTRoutes();
console.log('Generated routes:', routes.length);
routes.forEach(route => {
  console.log(`  ${route.method} ${route.path}`);
});