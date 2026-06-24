import type { LucideProps } from 'lucide-react'
import {
  Settings2,
  TriangleAlert,
  Rocket,
  Play,
  Check,
  Minus,
  Star,
  Image,
  X,
  Radar,
  Diamond,
  Lock,
  SquarePlus,
  ArrowDown,
  Clock3,
  Video,
  ChevronDown,
  ChevronRight,
  Download,
  ArrowUp,
} from 'lucide-react'

type Props = Pick<LucideProps, 'size' | 'className'>

export function IconGear({ size = 16, className }: Props) {
  return <Settings2 size={size} strokeWidth={2} className={className} />
}

export function IconWarning({ size = 14, className }: Props) {
  return <TriangleAlert size={size} strokeWidth={2} className={className} />
}

export function IconRocket({ size = 48, className }: Props) {
  return <Rocket size={size} strokeWidth={1.8} className={className} />
}

export function IconPlay({ size = 24, className }: Props) {
  return <Play size={size} strokeWidth={2} className={className} />
}

export function IconCheck({ size = 14, className }: Props) {
  return <Check size={size} strokeWidth={3} className={className} />
}

export function IconDash({ size = 14, className }: Props) {
  return <Minus size={size} strokeWidth={3} className={className} />
}

export function IconStar({ size = 16, className }: Props) {
  return <Star size={size} strokeWidth={1.8} className={className} />
}

export function IconImage({ size = 24, className }: Props) {
  return <Image size={size} strokeWidth={1.8} className={className} />
}

export function IconClose({ size = 18, className }: Props) {
  return <X size={size} strokeWidth={2.5} className={className} />
}

export function IconLogo({ size = 24, className }: Props) {
  return <Radar size={size} strokeWidth={2} className={className} />
}

export function IconTarget({ size = 24, className }: Props) {
  return <Radar size={size} strokeWidth={1.8} className={className} />
}

export function IconDiamond({ size = 24, className }: Props) {
  return <Diamond size={size} strokeWidth={1.8} className={className} />
}

export function IconLocked({ size = 24, className }: Props) {
  return <Lock size={size} strokeWidth={1.8} className={className} />
}

export function IconBoxPlus({ size = 24, className }: Props) {
  return <SquarePlus size={size} strokeWidth={1.8} className={className} />
}

export function IconArrowDown({ size = 24, className }: Props) {
  return <ArrowDown size={size} strokeWidth={2} className={className} />
}

export function IconClock({ size = 14, className }: Props) {
  return <Clock3 size={size} strokeWidth={1.8} className={className} />
}

export function IconVideo({ size = 24, className }: Props) {
  return <Video size={size} strokeWidth={1.8} className={className} />
}

export function IconChevronDown({ size = 14, className }: Props) {
  return <ChevronDown size={size} strokeWidth={2.5} className={className} />
}

export function IconChevronRight({ size = 14, className }: Props) {
  return <ChevronRight size={size} strokeWidth={2.5} className={className} />
}

export function IconDownload({ size = 18, className }: Props) {
  return <Download size={size} strokeWidth={2} className={className} />
}

export function IconArrowUp({ size = 14, className }: Props) {
  return <ArrowUp size={size} strokeWidth={2.5} className={className} />
}
