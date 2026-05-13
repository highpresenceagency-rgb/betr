export default function ProgressBar({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${(step / total) * 100}%` }} />
    </div>
  );
}
