type Point = { snapshotDate: Date; plannedPercent: number; actualPercent: number };

export function ProgressChart({ points }: { points: Point[] }) {
  const sorted = [...points].sort((a, b) => a.snapshotDate.getTime() - b.snapshotDate.getTime());
  if (!sorted.length) return <div className="empty">Добавьте обновление прогресса, чтобы построить график.</div>;
  const width = 760;
  const height = 250;
  const pad = 30;
  const coords = (key: "plannedPercent" | "actualPercent") =>
    sorted.map((point, index) => {
      const x = pad + (index * (width - pad * 2)) / Math.max(sorted.length - 1, 1);
      const y = height - pad - (point[key] / 100) * (height - pad * 2);
      return `${x},${y}`;
    }).join(" ");

  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="График планового и фактического прогресса">
        {[0, 25, 50, 75, 100].map((value) => {
          const y = height - pad - (value / 100) * (height - pad * 2);
          return <g key={value}><line x1={pad} y1={y} x2={width - pad} y2={y} stroke="#dce7f4" /><text x="2" y={y + 4} fill="#789" fontSize="11">{value}%</text></g>;
        })}
        <polyline points={coords("plannedPercent")} fill="none" stroke="#8db1df" strokeWidth="4" strokeDasharray="8 7" />
        <polyline points={coords("actualPercent")} fill="none" stroke="#2676de" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="chart-legend"><span><i className="legend-dot" style={{ background: "#8db1df" }} />План</span><span><i className="legend-dot" style={{ background: "#2676de" }} />Факт</span></div>
    </div>
  );
}
