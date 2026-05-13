'use client';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  rightElement?: React.ReactNode;
}

export default function Input({ label, rightElement, className, style, ...rest }: InputProps) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <p style={{ fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600, marginBottom: 5, color: '#3A3A3A' }}>
          {label}
        </p>
      )}
      <div className="inp-wrap" style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <input
          style={{
            flex: 1,
            background: 'transparent',
            paddingLeft: 13,
            paddingRight: rightElement ? 4 : 13,
            paddingTop: 11,
            paddingBottom: 11,
            color: '#D0D0D0',
            fontSize: 13,
            fontWeight: 500,
            width: '100%',
            ...style,
          }}
          className={className}
          {...rest}
        />
        {rightElement && <div style={{ paddingRight: 12 }}>{rightElement}</div>}
      </div>
    </div>
  );
}
