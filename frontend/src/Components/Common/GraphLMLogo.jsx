/**
 * GraphLMLogo – theme-aware reusable logo component.
 *
 * Props:
 *  variant   – 'full' (default) | 'icon'
 *              'full'  → horizontal logo mark + wordmark
 *              'icon'  → icon-only mark (collapsed sidebar, favicons, etc.)
 *  height    – pixel height (default 28)
 *  className – extra Tailwind classes
 *  forceDark – override to always use the dark-background variant
 *  forceLight – override to always use the light-background variant
 *  onClick   – optional click handler
 */
import { useThemeStore } from '@/store'

export default function GraphLMLogo({
  variant = 'full',
  height,
  className = '',
  forceDark = false,
  forceLight = false,
  onClick,
}) {
  const resolvedTheme = useThemeStore(s => s.resolvedTheme)

  const h = height ?? 28

  // Icon variant has no text so no theme switching needed
  if (variant === 'icon') {
    return (
      <img
        src="/logo/graphlm-icon.svg"
        alt="GraphLM"
        height={h}
        style={{ height: h, width: 'auto', display: 'block', cursor: onClick ? 'pointer' : 'default' }}
        className={className}
        draggable={false}
        onClick={onClick}
      />
    )
  }

  // Determine which wordmark to use
  const isDark = forceDark || (!forceLight && resolvedTheme === 'dark')
  const src = isDark
    ? '/logo/graphlm-logo-dark.svg'
    : '/logo/graphlm-logo-light.svg'

  return (
    <img
      src={src}
      alt="GraphLM"
      height={h}
      style={{ height: h, width: 'auto', display: 'block', cursor: onClick ? 'pointer' : 'default' }}
      className={className}
      draggable={false}
      onClick={onClick}
    />
  )
}
