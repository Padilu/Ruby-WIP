import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { Ruby, type AnimationName, type AvatarHandle } from '@root/Ruby'
import type { RubyStatus } from './animationMap'

export interface RubyAvatarProps {
  status?: RubyStatus
  animation?: AnimationName
  size?: number | string
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  showStatusIndicator?: boolean
}

export const RubyAvatar = forwardRef<AvatarHandle, RubyAvatarProps>(function RubyAvatar(
  {
    status = 'idle',
    animation = 'idle',
    size = 38,
    className = '',
    style,
    onClick,
    showStatusIndicator = false,
  },
  ref
) {
  const innerRef = useRef<AvatarHandle>(null)

  useImperativeHandle(ref, () => ({
    play(anim) {
      innerRef.current?.play(anim)
    },
    pause() {
      innerRef.current?.pause()
    },
    stop() {
      innerRef.current?.stop()
    },
  }))

  const getStatusBorderColor = () => {
    switch (status) {
      case 'listening':
        return 'rgba(239, 68, 68, 0.75)' // Red pulse
      case 'processing':
        return 'rgba(234, 179, 8, 0.75)' // Amber spin/glow
      case 'speaking':
        return 'rgba(34, 197, 94, 0.75)' // Green active
      case 'idle':
      default:
        return 'rgba(148, 163, 184, 0.25)' // Subtle soft slate
    }
  }

  const dim = typeof size === 'number' ? `${size}px` : size

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center cursor-pointer transition-transform duration-200 active:scale-95 ${className}`}
      style={{
        width: dim,
        height: dim,
        ...style,
      }}
      title={`Ruby: ${status} (${animation})`}
    >
      {/* Background status halo glow */}
      {showStatusIndicator && (
        <span
          className={`absolute inset-0 rounded-full transition-all duration-500 pointer-events-none ${
            status === 'listening'
              ? 'animate-ping opacity-75'
              : status === 'processing'
                ? 'animate-pulse opacity-80'
                : 'opacity-40'
          }`}
          style={{
            boxShadow: `0 0 12px ${getStatusBorderColor()}`,
            border: `1.5px solid ${getStatusBorderColor()}`,
          }}
        />
      )}

      {/* Ruby Avatar Core Component */}
      <Ruby
        ref={innerRef}
        animation={animation}
        size={dim}
        playing={true}
        loop={true}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  )
})

export default RubyAvatar
