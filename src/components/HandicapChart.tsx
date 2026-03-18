interface DataPoint {
  date: Date
  index: number
}

interface Props {
  data: DataPoint[]
}

export function HandicapChart({ data }: Props) {
  if (data.length < 2) return null

  const W = 320
  const H = 160
  const PAD_X = 40
  const PAD_Y = 20
  const PAD_BOTTOM = 30

  const indices = data.map(d => d.index)
  const minY = Math.floor(Math.min(...indices) - 1)
  const maxY = Math.ceil(Math.max(...indices) + 1)
  const rangeY = maxY - minY || 1

  const xScale = (i: number) => PAD_X + (i / (data.length - 1)) * (W - PAD_X - 10)
  const yScale = (v: number) => PAD_Y + (1 - (v - minY) / rangeY) * (H - PAD_Y - PAD_BOTTOM)

  const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d.index) }))
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  // Y-axis labels (3-4 ticks)
  const yTicks: number[] = []
  const step = rangeY <= 4 ? 1 : rangeY <= 10 ? 2 : Math.ceil(rangeY / 4)
  for (let v = Math.ceil(minY / step) * step; v <= maxY; v += step) {
    yTicks.push(v)
  }

  // X-axis labels (first, middle, last)
  const xLabels = [
    { i: 0, label: fmtDate(data[0].date) },
    ...(data.length > 2 ? [{ i: Math.floor(data.length / 2), label: fmtDate(data[Math.floor(data.length / 2)].date) }] : []),
    { i: data.length - 1, label: fmtDate(data[data.length - 1].date) },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
      {/* Grid lines */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD_X} y1={yScale(v)} x2={W - 10} y2={yScale(v)} stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={0.5} />
          <text x={PAD_X - 6} y={yScale(v) + 4} textAnchor="end" className="text-gray-400 dark:text-gray-500" fontSize={10} fill="currentColor">{v.toFixed(1)}</text>
        </g>
      ))}

      {/* Line */}
      <polyline points={polyline} fill="none" stroke="#d97706" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* Area fill */}
      <polygon
        points={`${points[0].x},${H - PAD_BOTTOM} ${polyline} ${points[points.length - 1].x},${H - PAD_BOTTOM}`}
        fill="url(#hcGrad)"
        opacity={0.15}
      />
      <defs>
        <linearGradient id="hcGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#d97706" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2.5} fill={i === points.length - 1 ? '#d97706' : '#fbbf24'} stroke="#fff" strokeWidth={1} />
      ))}

      {/* Current value highlight */}
      <text x={points[points.length - 1].x} y={points[points.length - 1].y - 10} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#d97706">
        {data[data.length - 1].index.toFixed(1)}
      </text>

      {/* X-axis labels */}
      {xLabels.map(({ i, label }) => (
        <text key={i} x={xScale(i)} y={H - 5} textAnchor="middle" className="text-gray-400 dark:text-gray-500" fontSize={9} fill="currentColor">{label}</text>
      ))}
    </svg>
  )
}

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}
