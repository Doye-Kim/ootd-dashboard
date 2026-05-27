'use client';

export function Chips<T extends string>({
  options,
  selected,
  labels,
  onChange,
}: {
  options: T[];
  selected: T[];
  labels: Record<T, string>;
  onChange: (next: T[]) => void;
}) {
  const toggle = (v: T) =>
    onChange(
      selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v],
    );
  return (
    <div className='flex flex-wrap gap-1.5'>
      {options.map((v) => (
        <button
          key={v}
          type='button'
          onClick={() => toggle(v)}
          className={`px-3.5 py-1 text-sm rounded-lg border cursor-pointer transition-colors ${
            selected.includes(v)
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-gray-100 text-gray-700 border-none hover:bg-gray-200'
          }`}>
          {labels[v]}
        </button>
      ))}
    </div>
  );
}
