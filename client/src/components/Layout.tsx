import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Package,
  FolderTree,
  Users,
  ShoppingCart,
  FileText,
  BookOpen,
  LogOut,
  Menu,
  X,
  Home,
  User,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { getAccessibleModels } from '../config/models.config';
import { useNotification } from './Notification';

const iconMap: Record<string, any> = {
  Package,
  FolderTree,
  Users,
  ShoppingCart,
  FileText,
  BookOpen,
};

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const { notify } = useNotification();

  const handleLogout = async () => {
    try {
      await logout();
      notify('Logged out successfully', { type: 'success' });
      navigate('/login');
    } catch (error) {
      notify('Logout failed', { type: 'error' });
    }
  };

  // Get models accessible to the current user
  const accessibleModels = user ? getAccessibleModels(user.role) : [];

  // Group models by menu group
  const groupedModels = accessibleModels.reduce((acc, model) => {
    // Skip hidden models
    if (model.menu?.hidden) return acc;

    const group = model.menu?.group || 'Other';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push({
      name: model.plural.charAt(0).toUpperCase() + model.plural.slice(1),
      href: `/${model.plural}`,
      icon: iconMap[model.icon || 'FileText'] || FileText,
      order: model.menu?.order || 999,
    });
    return acc;
  }, {} as Record<string, Array<{ name: string; href: string; icon: any; order: number }>>);

  // Sort items within each group by order
  Object.keys(groupedModels).forEach(group => {
    groupedModels[group].sort((a, b) => a.order - b.order);
  });

  // Sort groups alphabetically
  const sortedGroups = Object.keys(groupedModels).sort();

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  const isGroupActive = (items: Array<{ href: string }>) => {
    return items.some(item => isActive(item.href));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 fixed w-full top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-md text-gray-400 lg:hidden hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-900"
              >
                {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <div className="flex-shrink-0 flex items-center ml-4 lg:ml-0">
                <h1 className="text-xl font-bold text-gray-900">
                  {import.meta.env.VITE_APP_TITLE || 'Product Management'}
                </h1>
              </div>
            </div>

            {/* User menu */}
            <div className="flex items-center">
              <div className="ml-3 relative">
                <div>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
                  >
                    <div className="h-8 w-8 rounded-full bg-gray-900 flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <span className="ml-3 text-gray-700 hidden sm:block">
                      {user?.firstName || user?.email}
                    </span>
                    <ChevronDown className="ml-1 h-4 w-4 text-gray-400 hidden sm:block" />
                  </button>
                </div>

                {userMenuOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5">
                    <div className="px-4 py-2 text-xs text-gray-500 border-b">
                      {user?.email}
                      <br />
                      Role: {user?.role}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Layout container */}
      <div className="flex pt-16">
        {/* Sidebar */}
        <aside
          className={`fixed lg:relative inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 h-screen lg:h-auto pt-16 lg:pt-0 transform transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
        >
          <div className="h-full px-3 py-4 overflow-y-auto custom-scrollbar">
            <nav className="space-y-1">
              {/* Dashboard link */}
              <Link
                to="/"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive('/')
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Home className="mr-3 h-5 w-5" />
                Dashboard
              </Link>

              {/* Grouped menu items */}
              {sortedGroups.map((group) => {
                const items = groupedModels[group];
                const isOpen = openGroups[group] ?? true; // Default to open
                const groupActive = isGroupActive(items);

                return (
                  <div key={group} className="py-1">
                    <button
                      onClick={() => toggleGroup(group)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                        groupActive
                          ? 'text-gray-900 bg-gray-50'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>{group}</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          isOpen ? 'transform rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="mt-1 space-y-1">
                        {items.map((item) => {
                          const Icon = item.icon;
                          const active = isActive(item.href);
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`flex items-center pl-6 pr-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                active
                                  ? 'bg-gray-900 text-white'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <Icon className="mr-3 h-5 w-5" />
                              {item.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-gray-900 bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}