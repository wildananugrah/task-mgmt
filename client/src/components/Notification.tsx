'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// ✅ Types
type NotificationType = 'success' | 'error' | 'info' | 'warning';

type Notification = {
  id: string;
  message: string;
  type: NotificationType;
  duration: number;
};

type NotificationContextType = {
  notify: (message: string, options?: { type?: NotificationType; duration?: number }) => void;
};

// ✅ Context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// ✅ Hook
export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
}

// ✅ Color classes per type
const typeStyles: Record<NotificationType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
  warning: 'bg-yellow-500 text-black',
};

// ✅ Provider
export function NotificationProviderComponent({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  };

  const notify = useCallback(
    (message: string, options: { type?: NotificationType; duration?: number } = {}) => {
      const id = crypto.randomUUID();
      const type = options.type || 'info';
      const duration = options.duration || 3000;

      const notification = { id, message, type, duration };
      setNotifications((prev) => [notification, ...prev]);

      timers.current[id] = setTimeout(() => removeNotification(id), duration);
    },
    []
  );

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}

      {/* 🔔 Notification stack container */}
      <div className="fixed top-4 right-4 z-[9999] space-y-2 w-[300px]">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              onMouseEnter={() => clearTimeout(timers.current[n.id])}
              onMouseLeave={() =>
                (timers.current[n.id] = setTimeout(() => removeNotification(n.id), n.duration))
              }
              className={`relative px-4 py-3 rounded-lg shadow-lg text-white ${typeStyles[n.type]}`}
            >
              <p>{n.message}</p>
              <button
                className="absolute top-1 right-2 text-sm font-bold"
                onClick={() => removeNotification(n.id)}
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}
