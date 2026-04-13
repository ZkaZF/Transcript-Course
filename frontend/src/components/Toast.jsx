import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const COLORS = {
  success: 'border-green-500/30 bg-green-500/10 text-green-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-300',
  info: 'border-primary-500/30 bg-primary-500/10 text-primary-300',
};

function ToastItem({ toast, onRemove }) {
  const Icon = ICONS[toast.type] || Info;

  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-slide-in ${COLORS[toast.type]}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <p className="text-sm flex-1">{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} className="p-0.5 hover:opacity-70 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
