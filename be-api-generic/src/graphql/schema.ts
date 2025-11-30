import gql from 'graphql-tag';

export const typeDefs = gql`
  scalar JSON
  scalar DateTime

  # Common types
  type Pagination {
    page: Int!
    limit: Int!
    total: Int!
    totalPages: Int!
  }

  # User types
  type User {
    id: ID!
    email: String!
    firstName: String
    lastName: String
    role: UserRole!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    displayName: String
  }

  enum UserRole {
    ADMIN
    MANAGER
    USER
  }

  type AuthResponse {
    user: User!
    accessToken: String!
    refreshToken: String!
  }

  # Category types
  type Category {
    id: ID!
    name: String!
    description: String
    slug: String!
    parentId: String
    parent: Category
    children: [Category!]
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    products: [Product!]
    productCount: Int
  }

  # Product types
  type Product {
    id: ID!
    name: String!
    description: String
    sku: String!
    barcode: String
    price: Float!
    cost: Float
    quantity: Int!
    minQuantity: Int!
    unit: String!
    weight: Float
    dimensions: JSON
    images: [String!]!
    tags: [String!]!
    status: ProductStatus!
    featured: Boolean!
    categoryId: String!
    category: Category!
    createdById: String!
    createdBy: User!
    stockStatus: String
    stockMovements: [StockMovement!]
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  enum ProductStatus {
    ACTIVE
    INACTIVE
    OUT_OF_STOCK
    DISCONTINUED
  }

  # Stock movement types
  type StockMovement {
    id: ID!
    productId: String!
    product: Product!
    type: MovementType!
    quantity: Int!
    previousQty: Int!
    currentQty: Int!
    reference: String
    notes: String
    createdAt: DateTime!
  }

  enum MovementType {
    PURCHASE
    SALE
    ADJUSTMENT
    RETURN
    TRANSFER
  }

  # Order types
  type Order {
    id: ID!
    orderNumber: String!
    userId: String!
    user: User!
    status: OrderStatus!
    totalAmount: Float!
    tax: Float
    shipping: Float
    discount: Float
    notes: String
    shippingInfo: JSON
    paymentInfo: JSON
    orderItems: [OrderItem!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  enum OrderStatus {
    PENDING
    CONFIRMED
    PROCESSING
    SHIPPED
    DELIVERED
    CANCELLED
    REFUNDED
  }

  type OrderItem {
    id: ID!
    orderId: String!
    order: Order!
    productId: String!
    product: Product!
    quantity: Int!
    price: Float!
    discount: Float
    total: Float!
    createdAt: DateTime!
  }

  # Response types
  type ProductsResponse {
    data: [Product!]!
    pagination: Pagination!
  }

  type CategoriesResponse {
    data: [Category!]!
    pagination: Pagination!
  }

  type UsersResponse {
    data: [User!]!
    pagination: Pagination!
  }

  type OrdersResponse {
    data: [Order!]!
    pagination: Pagination!
  }

  # Input types
  input ProductInput {
    name: String!
    description: String
    sku: String!
    barcode: String
    price: Float!
    cost: Float
    quantity: Int
    minQuantity: Int
    unit: String
    weight: Float
    dimensions: JSON
    images: [String!]
    tags: [String!]
    status: ProductStatus
    featured: Boolean
    categoryId: String!
    metadata: JSON
  }

  input ProductUpdateInput {
    name: String
    description: String
    barcode: String
    price: Float
    cost: Float
    quantity: Int
    minQuantity: Int
    unit: String
    weight: Float
    dimensions: JSON
    images: [String!]
    tags: [String!]
    status: ProductStatus
    featured: Boolean
    categoryId: String
    metadata: JSON
  }

  input CategoryInput {
    name: String!
    description: String
    slug: String
    parentId: String
    isActive: Boolean
  }

  input CategoryUpdateInput {
    name: String
    description: String
    parentId: String
    isActive: Boolean
  }

  input UserInput {
    email: String!
    password: String!
    firstName: String
    lastName: String
    role: UserRole
    isActive: Boolean
  }

  input UserUpdateInput {
    email: String
    firstName: String
    lastName: String
    role: UserRole
    isActive: Boolean
    password: String
  }

  input OrderItemInput {
    productId: String!
    quantity: Int!
    price: Float!
    discount: Float
  }

  input OrderInput {
    items: [OrderItemInput!]!
    tax: Float
    shipping: Float
    discount: Float
    notes: String
    shippingInfo: JSON
    paymentInfo: JSON
  }

  input OrderUpdateInput {
    status: OrderStatus
    notes: String
    shippingInfo: JSON
    paymentInfo: JSON
  }

  # Filter inputs
  input ProductFilter {
    search: String
    categoryId: String
    status: ProductStatus
    featured: Boolean
    minPrice: Float
    maxPrice: Float
    tags: [String!]
    page: Int
    limit: Int
    sort: String
    order: String
  }

  input CategoryFilter {
    search: String
    parentId: String
    isActive: Boolean
    page: Int
    limit: Int
    sort: String
    order: String
  }

  input UserFilter {
    search: String
    role: UserRole
    isActive: Boolean
    page: Int
    limit: Int
    sort: String
    order: String
  }

  input OrderFilter {
    search: String
    status: OrderStatus
    userId: String
    dateFrom: String
    dateTo: String
    minAmount: Float
    maxAmount: Float
    page: Int
    limit: Int
    sort: String
    order: String
  }

  # Queries
  type Query {
    # Products
    products(filter: ProductFilter): ProductsResponse!
    product(id: ID!): Product

    # Categories
    categories(filter: CategoryFilter): CategoriesResponse!
    category(id: ID!): Category

    # Users
    users(filter: UserFilter): UsersResponse!
    user(id: ID!): User
    me: User

    # Orders
    orders(filter: OrderFilter): OrdersResponse!
    order(id: ID!): Order
    myOrders(filter: OrderFilter): OrdersResponse!
  }

  # Mutations
  type Mutation {
    # Auth
    login(email: String!, password: String!): AuthResponse!
    register(email: String!, password: String!, firstName: String, lastName: String): AuthResponse!
    refreshToken(refreshToken: String!): String!
    logout(refreshToken: String!): Boolean!

    # Products
    createProduct(input: ProductInput!): Product!
    updateProduct(id: ID!, input: ProductUpdateInput!): Product!
    deleteProduct(id: ID!): Boolean!

    # Categories
    createCategory(input: CategoryInput!): Category!
    updateCategory(id: ID!, input: CategoryUpdateInput!): Category!
    deleteCategory(id: ID!): Boolean!

    # Users
    createUser(input: UserInput!): User!
    updateUser(id: ID!, input: UserUpdateInput!): User!
    deleteUser(id: ID!): Boolean!

    # Orders
    createOrder(input: OrderInput!): Order!
    updateOrder(id: ID!, input: OrderUpdateInput!): Order!
    cancelOrder(id: ID!): Order!
  }

  # Subscriptions (optional, for real-time features)
  type Subscription {
    productUpdated(id: ID!): Product
    orderStatusChanged(userId: ID): Order
    stockAlert(productId: ID!): StockMovement
  }
`;