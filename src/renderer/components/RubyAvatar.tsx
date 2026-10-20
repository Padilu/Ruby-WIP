import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

const statusConfig: Record<
  RubyStatus,
  {
    glowColor: string
    borderColor: string
    scaleAnim: number[]
    opacityAnim: number[]
    duration: number
    filterGlow: string
  }
> = {
  listening: {
    glowColor: 'rgba(239, 68, 68, 0.65)',
    borderColor: 'rgba(239, 68, 68, 0.85)',
    scaleAnim: [1, 1.38, 1],
    opacityAnim: [0.8, 0.2, 0.8],
    duration: 1.1,
    filterGlow: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))',
  },
  processing: {
    glowColor: 'rgba(245, 158, 11, 0.65)',
    borderColor: 'rgba(245, 158, 11, 0.85)',
    scaleAnim: [0.96, 1.15, 0.96],
    opacityAnim: [0.75, 0.35, 0.75],
    duration: 1.6,
    filterGlow: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))',
  },
  speaking: {
    glowColor: 'rgba(16, 185, 129, 0.7)',
    borderColor: 'rgba(16, 185, 129, 0.9)',
    scaleAnim: [1, 1.25, 1],
    opacityAnim: [0.85, 0.4, 0.85],
    duration: 0.85,
    filterGlow: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.7))',
  },
  idle: {
    glowColor: 'rgba(148, 163, 184, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    scaleAnim: [1, 1.08, 1],
    opacityAnim: [0.4, 0.15, 0.4],
    duration: 3.2,
    filterGlow: 'drop-shadow(0 0 4px rgba(148, 163, 184, 0.2))',
  },
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

  const currentCfg = statusConfig[status] || statusConfig.idle
  const dim = typeof size === 'number' ? `${size}px` : size

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`relative inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      style={{
        width: dim,
        height: dim,
        ...style,
      }}
      title={`Ruby: ${status} (${animation})`}
    >
      {/* 1. Fluid Halo Pulsing Aura Ring */}
      {showStatusIndicator && (
        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{
              opacity: currentCfg.opacityAnim,
              scale: currentCfg.scaleAnim,
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              duration: currentCfg.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: `0 0 14px ${currentCfg.glowColor}`,
              border: `1.5px solid ${currentCfg.borderColor}`,
            }}
          />
        </AnimatePresence>
      )}

      {/* 2. Glassmorphic Inner Ring */}
      {showStatusIndicator && (
        <motion.div
          animate={{
            borderColor: currentCfg.borderColor,
          }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"
        />
      )}

      {/* 3. Ruby Avatar 3D Procedural SVG */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
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
            filter: currentCfg.filterGlow,
          }}
        />
      </div>
    </motion.div>
  )
})

export default RubyAvatar
