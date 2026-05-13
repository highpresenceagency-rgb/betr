'use client';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  loading?: boolean;
}

export function PrimaryButton({ label, loading, disabled, className, ...rest }: ButtonProps) {
  return (
    <button className={className ? `btn-primary ${className}` : 'btn-primary'} disabled={disabled || loading} {...rest}>
      {loading ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> : label}
    </button>
  );
}
