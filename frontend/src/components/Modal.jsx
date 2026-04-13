import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Modal — Reusable overlay dialog.
 * Props: isOpen, onClose, title, children
 */
export default function Modal({ isOpen, onClose, title, children }) {
  const backdropRef = useRef(null);

  // Tutup modal saat tekan Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === backdropRef.current && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-800">
          <h2 className="text-lg font-semibold text-surface-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
