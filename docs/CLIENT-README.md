# Client Application - Auto-Generated UI System

This is a **fully dynamic client application** that automatically generates user interfaces based on model configurations, similar to how the backend API is auto-generated. The UI adapts to your data models without requiring manual form or table creation.

## Features

### 🎨 Professional Design
- **Clean black, white, and gray theme** with a minimalist aesthetic
- **Responsive layout** with header and collapsible sidebar
- **Compact and professional** interface optimized for productivity
- Built with **TailwindCSS** for consistent styling

### 🚀 Auto-Generated UI Components
- **Dynamic Forms**: Automatically generates forms based on model field configurations
- **Dynamic Tables**: Creates data tables with sorting, pagination, and filtering
- **CRUD Operations**: Full Create, Read, Update, Delete functionality for all models
- **Field Types Support**: Text, number, email, password, textarea, select, checkbox, date, JSON, arrays, and more

### 🔐 Authentication & Authorization
- JWT-based authentication with token refresh
- Role-based access control (Admin, Manager, User)
- Protected routes and permission-based UI elements
- Automatic token management and refresh

### 📊 Model-Driven Architecture
The UI is automatically generated from model configurations that define:
- Field types and validation rules
- Display names and labels
- Permissions per role
- Search, filter, and sort capabilities
- List view columns

## Getting Started

### Prerequisites
- Backend API running on `http://localhost:3000`
- Bun runtime installed

### Installation

```bash
cd client
bun install
```

### Running the Application

```bash
bun run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
bun run build
bun run preview
```

## Model Configuration

The UI is driven by model configurations in `src/config/models.config.ts`. Each model defines:

```typescript
{
  name: 'product',
  displayName: 'Product',
  plural: 'products',
  icon: 'Package',
  fields: [
    {
      name: 'name',
      label: 'Product Name',
      type: 'text',
      required: true,
      searchable: true,
      sortable: true
    },
    // ... more fields
  ],
  listFields: ['name', 'sku', 'price', 'quantity'],
  permissions: {
    create: ['ADMIN', 'MANAGER'],
    read: ['ADMIN', 'MANAGER', 'USER'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN']
  }
}
```

## Available Models

The system includes pre-configured models for:

1. **Products** - Complete inventory management
2. **Categories** - Hierarchical categorization
3. **Users** - User management with roles
4. **Orders** - Order processing and tracking
5. **Articles** - Content management
6. **Books** - Additional content type

## Default Credentials

For testing, use these demo accounts:

- **Admin**: `admin@example.com` / `admin123`
- **Manager**: `manager@example.com` / `manager123`
- **User**: `user@example.com` / `user123`

## Architecture

### Technology Stack
- **React 19** with TypeScript
- **TailwindCSS** for styling
- **React Router** for navigation
- **React Hook Form** with Zod validation
- **TanStack Query** for server state management
- **Zustand** for client state
- **Axios** for API calls
- **Lucide React** for icons

### Key Components

1. **DynamicForm**: Renders forms based on field configurations
2. **DynamicTable**: Creates data tables with full CRUD operations
3. **DynamicCRUDPage**: Complete CRUD page for any model
4. **Layout**: Main application layout with sidebar navigation

### Folder Structure

```
client/
├── src/
│   ├── components/       # Reusable UI components
│   ├── config/           # Model configurations
│   ├── lib/             # API client and utilities
│   ├── pages/           # Page components
│   ├── stores/          # State management
│   └── main.tsx         # Application entry point
├── index.html
├── tailwind.config.js
└── vite.config.ts
```

## Adding New Models

To add a new model to the UI:

1. Add the model configuration to `src/config/models.config.ts`:
```typescript
export const newModelConfig: ModelConfig = {
  name: 'newmodel',
  displayName: 'New Model',
  plural: 'newmodels',
  fields: [...],
  // ... other configuration
};
```

2. Register it in the `modelConfigs` object:
```typescript
export const modelConfigs = {
  // ... existing models
  newmodel: newModelConfig
};
```

The UI will automatically:
- Add navigation menu item
- Create CRUD pages
- Generate forms and tables
- Apply permissions

## Customization

### Theme Colors
Edit `tailwind.config.js` to customize the grayscale theme:
```javascript
colors: {
  gray: {
    50: '#fafafa',
    100: '#f4f4f4',
    // ... etc
  }
}
```

### Layout
Modify `src/components/Layout.tsx` to customize:
- Header content
- Sidebar navigation
- User menu

### Field Types
Add custom field types in `src/components/DynamicForm.tsx`

## Performance Optimizations

- **React Query** for intelligent caching and background refetching
- **Lazy loading** for code splitting
- **Optimistic updates** for better UX
- **Debounced search** to reduce API calls

## Security Features

- Tokens stored in localStorage with automatic refresh
- API interceptors for token injection
- Permission-based UI rendering
- Protected routes with authentication checks

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

### API Connection Issues
- Ensure backend is running on port 3000
- Check CORS settings if running on different ports
- Verify proxy configuration in `vite.config.ts`

### Authentication Problems
- Clear localStorage and login again
- Check token expiration settings
- Verify backend JWT configuration

### UI Not Updating
- Check model configuration permissions
- Ensure user role has required permissions
- Verify API responses match expected format

## License

This project is part of the auto-generated API system and follows the same license as the parent project.