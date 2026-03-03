import React from 'react'
import { Tooltip } from 'antd'
import type { SemaforoStatus } from '../../types'

const COLORS: Record<SemaforoStatus, string> = {
  verde: '#52c41a',
  giallo: '#faad14',
  rosso: '#ff4d4f',
  grigio: '#d9d9d9',
}

const LABELS: Record<SemaforoStatus, string> = {
  verde: 'Performance ottima (≥ 4.0)',
  giallo: 'Performance nella norma (2.5 – 3.9)',
  rosso: 'Performance critica (< 2.5)',
  grigio: 'Nessuna valutazione',
}

interface Props {
  status: SemaforoStatus | null | undefined
  size?: number
  showLabel?: boolean
}

export const Semaforo: React.FC<Props> = ({ status, size = 16, showLabel }) => {
  const s = status || 'grigio'
  return (
    <Tooltip title={LABELS[s]}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: COLORS[s],
            boxShadow: `0 0 4px ${COLORS[s]}`,
            flexShrink: 0,
          }}
        />
        {showLabel && (
          <span style={{ fontSize: 12, color: '#666' }}>{LABELS[s]}</span>
        )}
      </span>
    </Tooltip>
  )
}
