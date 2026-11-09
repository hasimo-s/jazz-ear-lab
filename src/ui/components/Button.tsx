import type { ButtonHTMLAttributes, Ref } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const styles: Record<Variant, string> = {
  primary: 'bg-brass-500 text-ink-950 hover:bg-brass-400 font-bold',
  secondary: 'bg-ink-800 text-ink-100 hover:bg-ink-700 border border-ink-700',
  ghost: 'text-ink-300 hover:text-ink-100 hover:bg-ink-800',
};

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      type="button"
      className={`min-h-12 rounded-xl px-4 py-3 text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
