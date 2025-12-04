import React from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  FolderTree,
  Users,
  ShoppingCart,
  FileText,
  BookOpen,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { getAccessibleModels } from '../config/models.config';

const iconMap: Record<string, any> = {
  Package,
  FolderTree,
  Users,
  ShoppingCart,
  FileText,
  BookOpen,
};

export function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const accessibleModels = user ? getAccessibleModels(user.role) : [];

  // Mock statistics - in real app, fetch from API
  const stats = [
    { label: 'Total Products', value: '1,234', change: '+12%', icon: Package, color: 'bg-blue-500' },
    { label: 'Active Orders', value: '56', change: '+23%', icon: ShoppingCart, color: 'bg-green-500' },
    { label: 'Total Revenue', value: '$45,678', change: '+18%', icon: DollarSign, color: 'bg-purple-500' },
    { label: 'Active Users', value: '892', change: '+5%', icon: Users, color: 'bg-orange-500' },
  ];

  return (
    <div>
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.firstName || user?.email}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's an overview of your system
        </p>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {accessibleModels.map((model) => {
            const Icon = iconMap[model.icon || 'FileText'] || FileText;
            return (
              <Link
                key={model.name}
                to={`/${model.plural}`}
                className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Icon className="w-8 h-8 text-gray-700 mb-2" />
                <span className="text-sm font-medium text-gray-900">
                  {model.plural.charAt(0).toUpperCase() + model.plural.slice(1)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}