interface ProgressBarProps {
  value: number
  maxValue?: number
  label?: string
  color?: string
  showPercentage?: boolean
}

export function ProgressBar({
  value,
  maxValue = 100,
  label,
  color = '#0f766e',
  showPercentage = true,
}: ProgressBarProps) {
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0

  return (
    <div className="progress-bar-container">
      {label && <div className="progress-bar-label">{label}</div>}
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {showPercentage && (
        <div className="progress-bar-value">
          {percentage.toFixed(1)}%
        </div>
      )}
    </div>
  )
}
