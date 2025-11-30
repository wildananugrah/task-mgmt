# Generic API Client - Frontend Documentation

A dynamic, configuration-driven React + TypeScript frontend that automatically generates CRUD interfaces based on model configurations.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Model Configuration](#model-configuration)
- [Components](#components)
- [Authentication](#authentication)
- [Customization](#customization)

---

## Overview

This frontend application automatically generates complete CRUD (Create, Read, Update, Delete) interfaces for your API models. Simply define your model configuration, and the system generates:

- List views with pagination, search, and filtering
- Create/Edit forms with validation
- Detail views
- Delete confirmations
- All necessary API integrations

### Key Features

- **Configuration-Driven**: Define UI once in `models.config.ts`, get full CRUD interface
- **Type-Safe**: Full TypeScript support with Zod validation
- **Dynamic Forms**: Auto-generated forms based on field configurations
- **Relation Support**: Automatic loading of relation field options from API
- **Responsive Design**: TailwindCSS-based responsive UI
- **Authentication**: Built-in JWT authentication with token refresh
- **Customizable**: Easy to extend and customize components

---

## Architecture

### Directory Structure

```
client/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── DynamicForm.tsx     # Auto-generated forms
│   │   ├── DynamicList.tsx     # Auto-generated list views
│   │   ├── Layout.tsx          # Main layout wrapper
│   │   ├── Modal.tsx           # Reusable modal component
│   │   └── Notification.tsx    # Toast notification system
│   ├── config/              # Application configuration
│   │   └── models.config.ts    # Model definitions (IMPORTANT!)
│   ├── contexts/            # React contexts
│   │   ├── auth.context.tsx    # Authentication state
│   │   └── notification.context.tsx  # Notification system
│   ├── lib/                 # Utilities and helpers
│   │   └── api-client.ts       # API client with interceptors
│   ├── pages/               # Page components
│   │   ├── Dashboard.tsx       # Dashboard page
│   │   ├── LoginPage.tsx       # Login page
│   │   └── ModelPage.tsx       # Generic CRUD page
│   └── App.tsx              # Main app component
├── .env                     # Environment variables
└── index.html               # Entry HTML file
```

### Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Styling
- **React Router** - Client-side routing
- **React Hook Form** - Form state management
- **Zod** - Schema validation
- **Axios** - HTTP client
- **Lucide React** - Icon library
- **Framer Motion** - Animations

---

## Getting Started

### Prerequisites

- Bun runtime installed
- Backend API running (see parent directory)

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

The application will be available at `http://localhost:5173`

### Environment Variables

Create a `.env` file in the client directory:

```env
# Application title (shown in navbar)
VITE_APP_TITLE=Product Management

# API base URL (default: /api via proxy)
VITE_API_URL=/api
```

---

## Model Configuration

The heart of this application is the **model configuration** in `src/config/models.config.ts`. This file defines how each model is displayed and edited in the UI.

### Basic Structure

```typescript
export interface ModelConfig {
  name: string;                    // Model name (singular)
  displayName: string;             // Display name in UI
  plural: string;                  // Plural form for routes
  icon?: string;                   // Lucide icon name
  fields: FieldConfig[];           // Field definitions
  listFields?: string[];           // Fields to show in list view
  searchFields?: string[];         // Searchable fields
  filterFields?: string[];         // Filterable fields
  sortFields?: string[];           // Sortable fields
  permissions?: {                  // Role-based permissions
    create: string[];
    read: string[];
    update: string[];
    delete: string[];
  };
}
```

### Field Configuration

Each field has the following structure:

```typescript
export interface FieldConfig {
  name: string;                    // Field name (matches API)
  label: string;                   // Display label
  type: 'text' | 'number' | 'email' | 'password' | 'textarea' |
        'select' | 'checkbox' | 'date' | 'json' | 'array' | 'decimal';
  required?: boolean;              // Is field required?
  placeholder?: string;            // Input placeholder

  // For select fields with static options
  options?: { value: string; label: string }[];

  // For select fields with dynamic options from relations
  relation?: {
    model: string;                 // Related model name
    valueField?: string;           // Field to use as value (default: 'id')
    labelField?: string;           // Field to use as label (default: 'name')
    labelFields?: string[];        // Multiple fields for label
  };

  // Field constraints
  min?: number;                    // Min value/length
  max?: number;                    // Max value/length
  rows?: number;                   // Textarea rows

  // UI behavior
  hidden?: boolean;                // Hide in forms
  readOnly?: boolean;              // Read-only field
  searchable?: boolean;            // Searchable in list
  filterable?: boolean;            // Filterable in list
  sortable?: boolean;              // Sortable in list
  defaultValue?: any;              // Default value for new records
}
```

### Example: User Model Configuration

```typescript
export const userConfig: ModelConfig = {
  name: 'user',
  displayName: 'User',
  plural: 'users',
  icon: 'Users',
  fields: [
    {
      name: 'id',
      label: 'ID',
      type: 'text',
      hidden: true
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      searchable: true
    },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      required: true
    },
    {
      name: 'firstName',
      label: 'First Name',
      type: 'text',
      searchable: true
    },
    {
      name: 'lastName',
      label: 'Last Name',
      type: 'text',
      searchable: true
    },
    {
      name: 'role',
      label: 'Role',
      type: 'select',
      required: true,
      defaultValue: 'USER',
      filterable: true,
      options: [
        { value: 'ADMIN', label: 'Admin' },
        { value: 'MANAGER', label: 'Manager' },
        { value: 'USER', label: 'User' },
        { value: 'CLIENT', label: 'Client' }
      ]
    },
    {
      name: 'isActive',
      label: 'Active',
      type: 'checkbox',
      defaultValue: true,
      filterable: true
    },
    {
      name: 'createdAt',
      label: 'Created At',
      type: 'date',
      readOnly: true,
      sortable: true
    }
  ],
  listFields: ['email', 'firstName', 'lastName', 'role', 'isActive'],
  searchFields: ['email', 'firstName', 'lastName'],
  filterFields: ['role', 'isActive'],
  sortFields: ['email', 'firstName', 'createdAt'],
  permissions: {
    create: ['ADMIN'],
    read: ['ADMIN', 'MANAGER'],
    update: ['ADMIN'],
    delete: ['ADMIN']
  }
};
```

### Using Relations

For fields that reference other models, use the `relation` property:

```typescript
{
  name: 'categoryId',
  label: 'Category',
  type: 'select',
  required: true,
  relation: {
    model: 'category',        // Fetch from /api/categories
    labelField: 'name'        // Display category.name
  }
}

// For composite labels (e.g., "John Doe"):
{
  name: 'userId',
  label: 'Customer',
  type: 'select',
  relation: {
    model: 'user',
    labelFields: ['firstName', 'lastName']  // Combines both fields
  }
}
```

### Adding a New Model

1. **Add model configuration** to `src/config/models.config.ts`:

```typescript
export const myModelConfig: ModelConfig = {
  name: 'myModel',
  displayName: 'My Model',
  plural: 'myModels',
  icon: 'Box',
  fields: [
    // Define your fields here
  ],
  // ... other config
};

// Export in modelConfigs
export const modelConfigs: Record<string, ModelConfig> = {
  // ... existing models
  myModel: myModelConfig,
};
```

2. **That's it!** The UI will automatically:
   - Generate list view at `/myModels`
   - Generate create/edit forms
   - Handle API integration
   - Apply permissions

---

## Components

### DynamicForm

Auto-generates forms based on field configuration. Handles:
- Field rendering based on type
- Validation using Zod
- Relation field option loading
- Create vs Edit mode (password handling)
- Empty string to null conversion

**Usage:**
```tsx
<DynamicForm
  fields={modelConfig.fields}
  onSubmit={handleSubmit}
  initialData={existingRecord}
  isLoading={loading}
/>
```

**Special Features:**
- Password fields: Shown in create mode, optional in edit mode with "(leave empty to keep current)" hint
- Relation fields: Automatically fetches options from related model APIs
- Empty strings: Converted to `null` for optional fields
- Validation: Auto-generated from field configuration

### DynamicList

Auto-generates list views with:
- Pagination
- Search
- Filtering
- Sorting
- Bulk selection
- Bulk delete

**Usage:**
```tsx
<DynamicList
  modelConfig={modelConfig}
  data={records}
  totalCount={total}
  onRefresh={fetchData}
/>
```

### Modal

Reusable modal component with animations.

**Usage:**
```tsx
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Modal Title"
>
  <p>Modal content</p>
</Modal>
```

### Notification

Toast notification system.

**Usage:**
```tsx
import { useNotification } from '../contexts/notification.context';

const { showNotification } = useNotification();

showNotification('Success!', 'success');
showNotification('Error occurred', 'error');
showNotification('Warning message', 'warning');
showNotification('Info message', 'info');
```

---

## Authentication

### How It Works

1. User logs in via `/login` with email + password
2. Backend returns `accessToken` (short-lived) and `refreshToken` (long-lived)
3. Tokens stored in `localStorage`
4. `accessToken` sent with every API request via Authorization header
5. When `accessToken` expires (401 error), automatically refresh using `refreshToken`
6. If refresh fails, redirect to login

### Token Management

Located in `src/lib/api-client.ts`:

```typescript
export const tokenManager = {
  getAccessToken: () => localStorage.getItem('accessToken'),
  getRefreshToken: () => localStorage.getItem('refreshToken'),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },
  clearTokens: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};
```

### Protected Routes

Routes automatically check for authentication:

```typescript
// In App.tsx
{user ? (
  <Routes>
    <Route path="/" element={<Layout />}>
      <Route index element={<Dashboard />} />
      <Route path=":model" element={<ModelPage />} />
    </Route>
  </Routes>
) : (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
)}
```

### Auth Context

Access current user and auth methods:

```typescript
import { useAuth } from '../contexts/auth.context';

const { user, login, logout } = useAuth();

// Login
await login(email, password);

// Logout
logout();

// Check user role
if (user?.role === 'ADMIN') {
  // Admin only features
}
```

---

## Customization

### Changing App Title

Update `.env`:
```env
VITE_APP_TITLE=My Custom Title
```

### Customizing Styling

The application uses TailwindCSS. Modify `tailwind.config.js`:

```javascript
export default {
  theme: {
    extend: {
      colors: {
        primary: '#your-color',
      },
    },
  },
};
```

### Adding Custom Components

1. Create component in `src/components/`
2. Import and use in `ModelPage.tsx` or other pages

### Customizing Form Behavior

Override `DynamicForm` behavior by:

1. **Custom validation**: Add `validation` property to field config
2. **Custom rendering**: Fork `DynamicForm.tsx` and modify `renderField()` method
3. **Custom submission**: Wrap form submission in parent component

### Adding Custom API Endpoints

Extend `api-client.ts`:

```typescript
export const customApi = {
  myCustomEndpoint: async (data: any) => {
    const response = await apiClient.post('/custom-endpoint', data);
    return response.data;
  },
};
```

---

## Best Practices

### Model Configuration

1. **Keep field names consistent** with backend API
2. **Use relations** for foreign keys (categoryId, userId, etc.)
3. **Mark computed fields** as `readOnly`
4. **Hide internal fields** like `id`, `createdAt`, `updatedAt` in forms
5. **Set sensible defaults** for required fields

### Form Handling

1. **Empty strings**: The form automatically converts empty strings to `null` for optional fields
2. **Password fields**: Use `type: 'password'` and `required: true` - system handles create vs edit mode
3. **Relations**: Use `relation` property instead of static `options` for dynamic data

### Performance

1. **Limit relation queries**: Relation fields fetch all records, consider pagination for large datasets
2. **Optimize list fields**: Only include necessary fields in `listFields`
3. **Use server-side pagination**: Already implemented, don't disable it

### Security

1. **Never expose sensitive data** in list views
2. **Use permissions** in model config to restrict access
3. **Validate on backend**: Frontend validation is for UX, always validate on backend

---

## Troubleshooting

### Form not submitting

- Check browser console for validation errors
- Ensure all required fields are filled
- Check that field types match configuration

### Relation dropdown empty

- Verify the relation model name is correct (singular form)
- Check API endpoint returns data: `/api/{plural}`
- Check browser network tab for API errors

### Password field issues

- **Create mode**: Password should be visible and required
- **Edit mode**: Password should be visible but optional with "(leave empty to keep current)" hint
- Empty password in edit mode = no password change

### 401 Unauthorized errors

- Check if user is logged in
- Check token in localStorage
- Try logging out and back in
- Check backend JWT configuration

---

## API Client Reference

### modelApi

Generic CRUD operations:

```typescript
// List with pagination
const response = await modelApi.list('users', {
  page: 1,
  limit: 20,
  search: 'john',
  sort: 'createdAt',
  order: 'desc',
  role: 'ADMIN',  // Custom filters
});

// Get single record
const user = await modelApi.get('users', userId);

// Create record
const newUser = await modelApi.create('users', {
  email: 'user@example.com',
  password: 'password123',
  role: 'USER',
});

// Update record
const updated = await modelApi.update('users', userId, {
  firstName: 'John',
});

// Delete record
await modelApi.delete('users', userId);

// Bulk delete
await modelApi.bulkDelete('users', [id1, id2, id3]);
```

### authApi

Authentication operations:

```typescript
// Login
const { user } = await authApi.login(email, password);

// Get current user
const user = await authApi.getCurrentUser();

// Logout
await authApi.logout();
```

---

## Contributing

When adding new features:

1. Keep components generic and reusable
2. Update this documentation
3. Add TypeScript types
4. Test with different model configurations
5. Consider backwards compatibility

---

## FAQ

**Q: How do I add a new field to an existing model?**

A: Update the model configuration in `src/config/models.config.ts`. The UI will automatically update.

**Q: Can I customize the generated forms?**

A: Yes, you can fork `DynamicForm.tsx` or create custom form components for specific models.

**Q: How do I handle file uploads?**

A: Add a field with `type: 'file'` (currently basic support, may need custom implementation).

**Q: Can I use this with a different backend?**

A: Yes, but ensure your backend API follows the same structure (REST endpoints, JWT auth, pagination format).

**Q: How do I add custom pages?**

A: Add new routes in `App.tsx` and create page components in `src/pages/`.

---

## License

This project is part of the Generic API system. See main repository for license information.
