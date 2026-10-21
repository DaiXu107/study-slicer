import { useEffect, useState, type CSSProperties } from 'react';

const COLORS = ['#df7a3e', '#1c2b3a', '#6f9b78', '#f0c46a', '#c9d7e3'];
const COUNT = 26;

export function Confetti({ burst }: { burst: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (burst <= 0) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1600);
    return () => window.clearTimeout(timer);
  }, [burst]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      {Array.from({ length: COUNT }).map((_, i) => {
        const style: CSSProperties & Record<'--drift', string> = {
          left: `${(i * 97) % 100}%`,
          width: i % 3 === 0 ? '6px' : '8px',
          height: i % 4 === 0 ? '12px' : '8px',
          backgroundColor: COLORS[i % COLORS.length],
          borderRadius: i % 5 === 0 ? '999px' : '2px',
          animation: `confetti-fall ${1.1 + (i % 5) * 0.12}s cubic-bezier(0.25, 0.6, 0.35, 1) forwards`,
          animationDelay: `${(i % 7) * 35}ms`,
          '--drift': `${((i * 37) % 120) - 60}px`,
        };
        return <span key={i} className="absolute top-0 block" style={style} />;
      })}
    </div>
  );
}
