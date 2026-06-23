export type NodeType =
  | 'page' | 'section' | 'container' | 'row' | 'column'
  | 'heading' | 'text' | 'image' | 'button' | 'icon' | 'video'
  | 'divider' | 'list' | 'form' | 'nav' | 'hero' | 'pricing'
  | 'faq' | 'testimonial' | 'countdown' | 'tabs' | 'modal' | 'embed'

export type LayoutMode = 'structured' | 'freehand'
export type Unit = 'px' | '%' | 'vw' | 'vh' | 'auto'

export interface StyleValue { value: number | string; unit: Unit }

export interface ScrollAnimation {
  type: 'fadeIn' | 'fadeInUp' | 'fadeInLeft' | 'fadeInRight' | 'scaleIn' | 'slideIn'
  duration: number
  delay: number
  easing: 'ease' | 'ease-out' | 'ease-in-out'
}

export interface ClickAction {
  type: 'link' | 'scrollTo' | 'openModal' | 'none'
  linkUrl?: string
  linkTarget?: '_self' | '_blank'
  scrollSelector?: string
  modalId?: string
}

export interface HoverStyle {
  backgroundColor?: string
  color?: string
  scale?: number
  opacity?: number
  boxShadow?: string
  translateY?: number
}

export interface NodeStyles {
  width?: StyleValue | 'fill' | 'hug'
  height?: StyleValue | 'hug'
  minWidth?: StyleValue
  maxWidth?: StyleValue
  minHeight?: StyleValue
  flex?: string
  marginTop?: StyleValue
  marginRight?: StyleValue
  marginBottom?: StyleValue
  marginLeft?: StyleValue
  paddingTop?: StyleValue
  paddingRight?: StyleValue
  paddingBottom?: StyleValue
  paddingLeft?: StyleValue
  display?: 'flex' | 'block' | 'grid' | 'inline-flex' | 'none'
  flexDirection?: 'row' | 'column'
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch'
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around'
  gap?: StyleValue
  left?: StyleValue
  top?: StyleValue
  zIndex?: number
  rotation?: number
  backgroundColor?: string
  backgroundImage?: string
  backgroundSize?: 'cover' | 'contain' | 'auto'
  borderWidth?: StyleValue
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted'
  borderColor?: string
  borderRadius?: StyleValue
  boxShadow?: string
  opacity?: number
  fontFamily?: string
  fontSize?: StyleValue
  fontWeight?: number | string
  lineHeight?: number
  letterSpacing?: StyleValue
  color?: string
  textAlign?: 'left' | 'center' | 'right'
  textDecoration?: 'none' | 'underline'
}

export interface DocumentNode {
  id: string
  type: NodeType
  name: string
  layoutMode: LayoutMode
  styles: NodeStyles
  children: DocumentNode[]
  props: Record<string, any>
  visible: boolean
  locked: boolean
  hoverStyle?: HoverStyle
  scrollAnimation?: ScrollAnimation
  clickAction?: ClickAction
  isComponent?: boolean
  componentId?: string
  componentOverrides?: Record<string, any>
}

export interface SavedComponent {
  id: string
  name: string
  node: DocumentNode
  createdAt: string
}

export interface PageData {
  id: string
  name: string
  slug: string
  tree: DocumentNode
  breakpoints: string[]
  globalStyles: Record<string, any>
}

let _nextId = 1
export function generateId(): string {
  return `node_${_nextId++}_${Date.now()}`
}

export function createDefaultNode(type: NodeType, name?: string): DocumentNode {
  const base: DocumentNode = {
    id: generateId(), type,
    name: name || type.charAt(0).toUpperCase() + type.slice(1),
    layoutMode: 'structured', styles: {}, children: [], props: {},
    visible: true, locked: false,
  }
  switch (type) {
    case 'page':
      base.styles = { width: { value: 100, unit: '%' }, minHeight: { value: 100, unit: 'vh' }, backgroundColor: '#ffffff', paddingTop: { value: 0, unit: 'px' }, paddingBottom: { value: 0, unit: 'px' }, paddingLeft: { value: 0, unit: 'px' }, paddingRight: { value: 0, unit: 'px' } }
      break
    case 'section':
      base.styles = { width: { value: 100, unit: '%' }, paddingTop: { value: 60, unit: 'px' }, paddingBottom: { value: 60, unit: 'px' }, paddingLeft: { value: 24, unit: 'px' }, paddingRight: { value: 24, unit: 'px' } }
      break
    case 'container': case 'row':
      base.styles = { display: 'flex', flexDirection: 'row', width: { value: 100, unit: '%' }, gap: { value: 16, unit: 'px' } }
      break
    case 'column':
      base.styles = { display: 'flex', flexDirection: 'column', flex: '1', gap: { value: 8, unit: 'px' } }
      break
    case 'heading':
      base.styles = { fontFamily: 'Inter, sans-serif', fontSize: { value: 32, unit: 'px' }, fontWeight: 700, color: '#111111', lineHeight: 1.2 }
      base.props = { text: 'Titulo da Pagina', level: 'h2' }
      break
    case 'text':
      base.styles = { fontFamily: 'Inter, sans-serif', fontSize: { value: 16, unit: 'px' }, color: '#333333', lineHeight: 1.6 }
      base.props = { html: 'Clique para editar este texto. Adicione seu conteudo aqui.' }
      break
    case 'image':
      base.styles = { width: { value: 100, unit: '%' }, maxWidth: { value: 600, unit: 'px' }, borderRadius: { value: 8, unit: 'px' } }
      base.props = { src: '', alt: '' }
      break
    case 'button':
      base.styles = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', paddingTop: { value: 12, unit: 'px' }, paddingBottom: { value: 12, unit: 'px' }, paddingLeft: { value: 24, unit: 'px' }, paddingRight: { value: 24, unit: 'px' }, backgroundColor: '#7c3aed', color: '#ffffff', borderRadius: { value: 8, unit: 'px' }, fontWeight: 600, fontSize: { value: 16, unit: 'px' }, borderWidth: { value: 0, unit: 'px' }, borderStyle: 'none' }
      base.props = { text: 'Clique Aqui', link: '', target: '_self' }
      break
    case 'divider':
      base.styles = { width: { value: 100, unit: '%' }, height: { value: 1, unit: 'px' }, backgroundColor: '#e0e0e0', marginTop: { value: 24, unit: 'px' }, marginBottom: { value: 24, unit: 'px' } }
      break
  }
  return base
}

export function createDefaultPage(name: string, slug: string): PageData {
  const page = createDefaultNode('page', name)
  const hero = createDefaultNode('section', 'Hero')
  const container = createDefaultNode('container', 'Container')
  container.styles = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: { value: 100, unit: '%' }, maxWidth: { value: 900, unit: 'px' }, gap: { value: 16, unit: 'px' }, paddingTop: { value: 80, unit: 'px' }, paddingBottom: { value: 80, unit: 'px' }, paddingLeft: { value: 24, unit: 'px' }, paddingRight: { value: 24, unit: 'px' }, textAlign: 'center' }
  const heading = createDefaultNode('heading', 'Heading')
  heading.props = { text: 'Sua Pagina Incrivel', level: 'h1' }
  heading.styles.fontSize = { value: 48, unit: 'px' }
  const text = createDefaultNode('text', 'Subtitle')
  text.props = { html: 'Crie paginas profissionais sem escrever codigo. Arraste e solte componentes.' }
  text.styles.fontSize = { value: 18, unit: 'px' }
  text.styles.color = '#666666'
  const btn = createDefaultNode('button', 'CTA')
  btn.props = { text: 'Comece Agora', link: '#' }
  container.children = [heading, text, btn]
  hero.children = [container]
  page.children = [hero]
  return { id: generateId(), name, slug, tree: page, breakpoints: ['1440', '768', '375'], globalStyles: {} }
}

export function findNode(tree: DocumentNode, id: string): DocumentNode | null {
  if (tree.id === id) return tree
  for (const child of tree.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

export function removeNode(tree: DocumentNode, id: string): boolean {
  const idx = tree.children.findIndex(c => c.id === id)
  if (idx !== -1) { tree.children.splice(idx, 1); return true }
  for (const child of tree.children) { if (removeNode(child, id)) return true }
  return false
}

export function insertNode(tree: DocumentNode, parentId: string, node: DocumentNode, index?: number): boolean {
  const parent = findNode(tree, parentId)
  if (!parent) return false
  if (index !== undefined && index >= 0) parent.children.splice(index, 0, node)
  else parent.children.push(node)
  return true
}

export function moveNode(tree: DocumentNode, nodeId: string, newParentId: string, newIndex?: number): boolean {
  const node = findNode(tree, nodeId)
  if (!node) return false
  const copy = JSON.parse(JSON.stringify(node))
  removeNode(tree, nodeId)
  return insertNode(tree, newParentId, copy, newIndex)
}

export function cloneSubtree(node: DocumentNode): DocumentNode {
  const clone = JSON.parse(JSON.stringify(node))
  function reId(n: DocumentNode) {
    n.id = generateId()
    n.children.forEach(reId)
  }
  reId(clone)
  return clone
}

export function stylesToCss(styles: NodeStyles, layoutMode: LayoutMode): string {
  const lines: string[] = []
  const val = (s?: StyleValue) => s ? `${s.value}${s.unit}` : '0'
  if (layoutMode === 'freehand') {
    if (styles.left) lines.push(`left: ${val(styles.left)}`)
    if (styles.top) lines.push(`top: ${val(styles.top)}`)
    if (styles.zIndex !== undefined) lines.push(`z-index: ${styles.zIndex}`)
    if (styles.rotation) lines.push(`transform: rotate(${styles.rotation}deg)`)
  }
  const f = (k: string, v: any) => { if (v !== undefined && v !== '') lines.push(`${k}: ${v}`) }
  f('display', styles.display); f('flex-direction', styles.flexDirection)
  f('align-items', styles.alignItems); f('justify-content', styles.justifyContent)
  f('gap', styles.gap ? val(styles.gap) : undefined); f('flex', styles.flex)
  if (styles.width) { if (styles.width === 'fill') f('width', '100%'); else if (styles.width === 'hug') f('width', 'auto'); else f('width', val(styles.width)) }
  if (styles.height) { if (styles.height === 'hug') f('height', 'auto'); else f('height', val(styles.height)) }
  f('min-width', styles.minWidth ? val(styles.minWidth) : undefined)
  f('max-width', styles.maxWidth ? val(styles.maxWidth) : undefined)
  f('min-height', styles.minHeight ? val(styles.minHeight) : undefined)
  ;['margin', 'padding'].forEach(p => {
    ;['Top', 'Right', 'Bottom', 'Left'].forEach(s => {
      const key = `${p}${s}` as keyof NodeStyles
      f(`${p}-${s.toLowerCase()}`, styles[key] ? val(styles[key] as StyleValue) : undefined)
    })
  })
  f('background-color', styles.backgroundColor)
  f('background-image', styles.backgroundImage ? `url(${styles.backgroundImage})` : undefined)
  f('background-size', styles.backgroundSize)
  ;['border-width', 'border-style', 'border-color', 'border-radius'].forEach(p => {
    const key = p === 'border-width' ? 'borderWidth' : p === 'border-style' ? 'borderStyle' : p === 'border-color' ? 'borderColor' : 'borderRadius'
    const v = styles[key as keyof NodeStyles]
    if (v) f(p, typeof v === 'object' ? val(v as StyleValue) : v as string)
  })
  f('box-shadow', styles.boxShadow); f('opacity', styles.opacity)
  f('font-family', styles.fontFamily)
  f('font-size', styles.fontSize ? val(styles.fontSize) : undefined)
  f('font-weight', styles.fontWeight); f('line-height', styles.lineHeight)
  f('letter-spacing', styles.letterSpacing ? val(styles.letterSpacing) : undefined)
  f('color', styles.color); f('text-align', styles.textAlign); f('text-decoration', styles.textDecoration)
  return lines.join('; ')
}

export function hoverStyleToCss(hs?: HoverStyle): string {
  if (!hs) return ''
  const p: string[] = []
  if (hs.backgroundColor) p.push(`background-color: ${hs.backgroundColor}`)
  if (hs.color) p.push(`color: ${hs.color}`)
  if (hs.boxShadow) p.push(`box-shadow: ${hs.boxShadow}`)
  if (hs.opacity !== undefined) p.push(`opacity: ${hs.opacity}`)
  const t: string[] = []
  if (hs.scale) t.push(`scale(${hs.scale})`)
  if (hs.translateY) t.push(`translateY(${hs.translateY}px)`)
  if (t.length) p.push(`transform: ${t.join(' ')}`)
  return p.join('; ')
}

export function scrollAnimationToCss(sa?: ScrollAnimation): string {
  if (!sa) return ''
  const names: Record<string, string> = {
    fadeIn: 'fadeIn', fadeInUp: 'fadeInUp', fadeInLeft: 'fadeInLeft',
    fadeInRight: 'fadeInRight', scaleIn: 'scaleIn', slideIn: 'slideIn',
  }
  return `animation: ${names[sa.type] || 'fadeIn'} ${sa.duration}ms ${sa.easing} ${sa.delay}ms both`
}

export const SCROLL_ANIMATION_KEYFRAMES = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes fadeInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
@keyframes slideIn { from { opacity: 0; transform: translateY(60px); } to { opacity: 1; transform: translateY(0); } }
`

export function nodeTypeLabel(type: NodeType): string {
  const map: Record<NodeType, string> = {
    page: 'Pagina', section: 'Secao', container: 'Container', row: 'Linha', column: 'Coluna',
    heading: 'Titulo', text: 'Texto', image: 'Imagem', button: 'Botao', icon: 'Icone',
    video: 'Video', divider: 'Divisor', list: 'Lista', form: 'Formulario', nav: 'Nav Bar',
    hero: 'Hero', pricing: 'Precos', faq: 'FAQ', testimonial: 'Depoimento',
    countdown: 'Timer', tabs: 'Abas', modal: 'Modal', embed: 'Incorporar',
  }
  return map[type] || type
}
