import { useEffect, useRef } from 'react';
import { Copy, Scissors, Trash2, Edit, Sparkles, RefreshCw } from 'lucide-react';

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onPasteStyle: () => void;
  onResetStyle: () => void;
  onDelete: () => void;
  hasClipboard: boolean;
}

export function ContextMenu({
  x,
  y,
  onClose,
  onEdit,
  onDuplicate,
  onCopy,
  onPaste,
  onPasteStyle,
  onResetStyle,
  onDelete,
  hasClipboard
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Ensure menu stays within window bounds
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 280);

  return (
    <div
      ref={menuRef}
      className="studio-context-menu"
      style={{
        position: 'fixed',
        top: `${adjustedY}px`,
        left: `${adjustedX}px`,
        zIndex: 99999,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        padding: '6px',
        minWidth: '200px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        fontSize: '13px',
        color: '#1f2937'
      }}
    >
      <button
        style={itemStyle}
        onClick={() => { onEdit(); onClose(); }}
      >
        <Edit size={14} /> <span>Edit Element</span>
      </button>

      <button
        style={itemStyle}
        onClick={() => { onDuplicate(); onClose(); }}
      >
        <Scissors size={14} /> <span>Duplicate</span> <kbd style={kbdStyle}>Ctrl+D</kbd>
      </button>

      <button
        style={itemStyle}
        onClick={() => { onCopy(); onClose(); }}
      >
        <Copy size={14} /> <span>Copy</span> <kbd style={kbdStyle}>Ctrl+C</kbd>
      </button>

      <button
        style={{ ...itemStyle, opacity: hasClipboard ? 1 : 0.5, pointerEvents: hasClipboard ? 'auto' : 'none' }}
        onClick={() => { onPaste(); onClose(); }}
      >
        <span>Paste</span> <kbd style={kbdStyle}>Ctrl+V</kbd>
      </button>

      <button
        style={{ ...itemStyle, opacity: hasClipboard ? 1 : 0.5, pointerEvents: hasClipboard ? 'auto' : 'none' }}
        onClick={() => { onPasteStyle(); onClose(); }}
      >
        <Sparkles size={14} color="#d97706" /> <strong>Paste Style</strong> <kbd style={kbdStyle}>Ctrl+Shift+V</kbd>
      </button>

      <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }} />

      <button
        style={itemStyle}
        onClick={() => { onResetStyle(); onClose(); }}
      >
        <RefreshCw size={14} /> <span>Reset Style</span>
      </button>

      <button
        style={{ ...itemStyle, color: '#dc2626' }}
        onClick={() => { onDelete(); onClose(); }}
      >
        <Trash2 size={14} /> <span>Delete</span> <kbd style={kbdStyle}>Del</kbd>
      </button>
    </div>
  );
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '8px 10px',
  background: 'transparent',
  border: 'none',
  borderRadius: '4px',
  textAlign: 'left',
  cursor: 'pointer',
  width: '100%',
  font: 'inherit'
};

const kbdStyle: React.CSSProperties = {
  fontSize: '10px',
  opacity: 0.6,
  background: '#f3f4f6',
  padding: '2px 4px',
  borderRadius: '3px',
  marginLeft: 'auto'
};
