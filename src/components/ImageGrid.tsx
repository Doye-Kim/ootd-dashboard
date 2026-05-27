'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type GridItem = { id: string; imagePath: string; alt: string };
type Pos = { x: number; y: number; w: number; h: number };
type Props = { items: GridItem[]; onItemClick?: (id: string) => void };

const GAP = 8;
const PAD = 8;

function colCount(width: number): number {
  if (width >= 1280) return 5;
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
}

export default function ImageGrid({ items, onItemClick }: Props) {
  const containerRef = useRef<HTMLUListElement>(null);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [totalHeight, setTotalHeight] = useState(0);
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const ratios = useRef<Record<string, number>>({});

  const layout = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const innerWidth = el.clientWidth - PAD * 2;
    const cols = colCount(innerWidth);
    const colW = (innerWidth - GAP * (cols - 1)) / cols;
    const heights = Array<number>(cols).fill(0);

    const next: Pos[] = items.map((item) => {
      const col = heights.indexOf(Math.min(...heights));
      const h = colW * (ratios.current[item.id] ?? 1);
      const pos: Pos = { x: PAD + col * (colW + GAP), y: PAD + heights[col], w: colW, h };
      heights[col] += h + GAP;
      return pos;
    });

    setPositions(next);
    setTotalHeight(items.length > 0 ? Math.max(...heights) + PAD * 2 - GAP : 0);
  }, [items]);

  useEffect(() => {
    layout();
    const ro = new ResizeObserver(layout);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [layout]);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        등록된 사진이 없습니다
      </div>
    );
  }

  return (
    <ul ref={containerRef} className="relative list-none w-full" style={{ height: totalHeight }}>
      {items.map((item, i) => {
        const p = positions[i];
        if (!p) return null;
        const isLoaded = loaded.has(item.id);
        return (
          <li
            key={item.id}
            className={`absolute ${onItemClick ? 'cursor-pointer' : ''}`}
            style={{ transform: `translate3d(${p.x}px, ${p.y}px, 0)`, width: p.w }}
            onClick={() => onItemClick?.(item.id)}
          >
            {!isLoaded && (
              <div
                className="w-full flex items-center justify-center rounded-lg border border-gray-100 bg-gray-50 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                style={{ height: p.h }}
              >
                <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-gray-400 animate-spin dark:border-gray-700 dark:border-t-gray-500" />
              </div>
            )}
            <img
              src={item.imagePath}
              alt={item.alt}
              className={`w-full block rounded-lg ${isLoaded ? '' : 'hidden'}`}
              onLoad={(e) => {
                const { naturalWidth, naturalHeight } = e.currentTarget;
                ratios.current[item.id] = naturalHeight / naturalWidth;
                setLoaded((prev) => new Set(prev).add(item.id));
                layout();
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
