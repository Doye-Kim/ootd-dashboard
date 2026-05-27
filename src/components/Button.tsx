'use client';

type Variant = 'primary' | 'outline' | 'danger' | 'secondary';

const variantClass: Record<Variant, string> = {
  primary: 'bg-slate-700 text-white hover:bg-slate-500',
  outline: 'border border-slate-700 text-slate-700 hover:bg-slate-100',
  danger: ' border border-red-700 text-red-700 hover:bg-red-50',
  secondary: 'bg-slate-200 hover:bg-slate-300 text-slate-600',
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: Props) {
  return (
    <button
      type='button'
      className={`py-2 text-sm rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${variantClass[variant]} ${className}`}
      {...props}
    />
  );
}
