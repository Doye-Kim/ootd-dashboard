'use client';

type Variant = 'primary' | 'outline' | 'danger';

const variantClass: Record<Variant, string> = {
  primary: 'bg-gray-900 text-white hover:bg-gray-700',
  outline: 'border border-gray-200 text-gray-500 hover:bg-gray-50',
  danger: 'border border-red-200 text-red-500 hover:bg-red-50',
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button
      type="button"
      className={`py-2 text-sm rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${variantClass[variant]} ${className}`}
      {...props}
    />
  );
}
