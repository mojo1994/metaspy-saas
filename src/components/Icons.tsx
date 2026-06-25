import {
  Gear,
  Warning,
  Rocket,
  Play,
  Check,
  Minus,
  Star,
  Image,
  X,
  Crosshair as PhosphorCrosshair,
  Diamond,
  Lock,
  PlusSquare,
  ArrowDown,
  Clock,
  Video,
  CaretDown,
  CaretRight,
  Download,
  ArrowUp,
} from '@phosphor-icons/react'

type Props = { size?: number; className?: string }

export function IconGear({ size = 16, className }: Props) {
  return <Gear size={size} weight="regular" className={className} />
}

export function IconWarning({ size = 14, className }: Props) {
  return <Warning size={size} weight="regular" className={className} />
}

export function IconRocket({ size = 48, className }: Props) {
  return <Rocket size={size} weight="regular" className={className} />
}

export function IconPlay({ size = 24, className }: Props) {
  return <Play size={size} weight="regular" className={className} />
}

export function IconCheck({ size = 14, className }: Props) {
  return <Check size={size} weight="bold" className={className} />
}

export function IconDash({ size = 14, className }: Props) {
  return <Minus size={size} weight="bold" className={className} />
}

export function IconStar({ size = 16, className }: Props) {
  return <Star size={size} weight="regular" className={className} />
}

export function IconImage({ size = 24, className }: Props) {
  return <Image size={size} weight="regular" className={className} />
}

export function IconClose({ size = 18, className }: Props) {
  return <X size={size} weight="bold" className={className} />
}

export function IconLogo({ size = 24, className }: Props) {
  return <PhosphorCrosshair size={size} weight="regular" className={className} />
}

export function IconTarget({ size = 24, className }: Props) {
  return <PhosphorCrosshair size={size} weight="regular" className={className} />
}

export function IconDiamond({ size = 24, className }: Props) {
  return <Diamond size={size} weight="regular" className={className} />
}

export function IconLocked({ size = 24, className }: Props) {
  return <Lock size={size} weight="regular" className={className} />
}

export function IconBoxPlus({ size = 24, className }: Props) {
  return <PlusSquare size={size} weight="regular" className={className} />
}

export function IconArrowDown({ size = 24, className }: Props) {
  return <ArrowDown size={size} weight="regular" className={className} />
}

export function IconClock({ size = 14, className }: Props) {
  return <Clock size={size} weight="regular" className={className} />
}

export function IconVideo({ size = 24, className }: Props) {
  return <Video size={size} weight="regular" className={className} />
}

export function IconChevronDown({ size = 14, className }: Props) {
  return <CaretDown size={size} weight="bold" className={className} />
}

export function IconChevronRight({ size = 14, className }: Props) {
  return <CaretRight size={size} weight="bold" className={className} />
}

export function IconDownload({ size = 18, className }: Props) {
  return <Download size={size} weight="regular" className={className} />
}

export function IconArrowUp({ size = 14, className }: Props) {
  return <ArrowUp size={size} weight="bold" className={className} />
}
