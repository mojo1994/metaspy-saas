export type NodeType =
  | 'page'
  | 'section'
  | 'container'
  | 'row'
  | 'column'
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'icon'
  | 'video'
  | 'divider'
  | 'list'
  | 'form'
  | 'nav'
  | 'hero'
  | 'pricing'
  | 'faq'
  | 'testimonial'
  | 'countdown'
  | 'tabs'
  | 'modal'
  | 'embed'

export type LayoutMode = 'structured' | 'freehand'

export type Unit = 'px' | '%' | 'vw' | 'vh' | 'auto'

export interface StyleValue {
  value: number | string
  unit: Unit
}

export interface NodeStyles {
  // Layout
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
  // Flex
  display?: 'flex' | 'block' | 'grid' | 'inline-flex' | 'none'
  flexDirection?: 'row' | 'column'
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch'
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around'
  gap?: StyleValue
  // Freehand positioning
  left?: StyleValue
  top?: StyleValue
  zIndex?: number
  rotation?: number
  // Appearance
  backgroundColor?: string
  backgroundImage?: string
  backgroundSize?: 'cover' | 'contain' | 'auto'
  borderWidth?: StyleValue
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted'
  borderColor?: string
  borderRadius?: StyleValue
  boxShadow?: string
  opacity?: number
  // Typography
  fontFamily?: string
  fontSize?: StyleValue
  fontWeight?: number | string
  lineHeight?: number
  letterSpacing?: StyleValue
  color?: string
  textAlign?: 'left' | 'center' | 'right'
  textDecoration?: 'none' | 'underline'
  // States
  hoverBackgroundColor?: string
  hoverColor?: string
  hoverScale?: number
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
}

export interface BreakpointOverride {
  breakpoint: string
  styles: Partial<NodeStyles>
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
    id: generateId(),
    type,
    name: name || type.charAt(0).toUpperCase() + type.slice(1),
    layoutMode: 'structured',
    styles: {},
    children: [],
    props: {},
    visible: true,
    locked: false,
  }

  switch (type) {
    case 'page':
      base.styles = {
        width: { value: 100, unit: '%' },
        minHeight: { value: 100, unit: 'vh' },
        backgroundColor: '#ffffff',
        paddingTop: { value: 0, unit: 'px' },
        paddingBottom: { value: 0, unit: 'px' },
        paddingLeft: { value: 0, unit: 'px' },
        paddingRight: { value: 0, unit: 'px' },
      }
      break
    case 'section':
      base.styles = {
        width: { value: 100, unit: '%' },
        paddingTop: { value: 60, unit: 'px' },
        paddingBottom: { value: 60, unit: 'px' },
        paddingLeft: { value: 24, unit: 'px' },
        paddingRight: { value: 24, unit: 'px' },
      }
      break
    case 'container':
      base.styles = {
        display: 'flex',
        flexDirection: 'row',
        width: { value: 100, unit: '%' },
        gap: { value: 16, unit: 'px' },
      }
      break
    case 'row':
      base.styles = {
        display: 'flex',
        flexDirection: 'row',
        width: { value: 100, unit: '%' },
        gap: { value: 16, unit: 'px' },
      }
      break
    case 'column':
      base.styles = {
        display: 'flex',
        flexDirection: 'column',
        flex: '1',
        gap: { value: 8, unit: 'px' },
      }
      break
    case 'heading':
      base.styles = {
        fontFamily: 'Inter, sans-serif',
        fontSize: { value: 32, unit: 'px' },
        fontWeight: 700,
        color: '#111111',
        lineHeight: 1.2,
      }
      base.props = { text: 'Titulo da Pagina', level: 'h2' }
      break
    case 'text':
      base.styles = {
        fontFamily: 'Inter, sans-serif',
        fontSize: { value: 16, unit: 'px' },
        color: '#333333',
        lineHeight: 1.6,
      }
      base.props = { text: 'Clique para editar este texto. Adicione seu conteudo aqui.' }
      break
    case 'image':
      base.styles = {
        width: { value: 100, unit: '%' },
        maxWidth: { value: 600, unit: 'px' },
        borderRadius: { value: 8, unit: 'px' },
      }
      base.props = { src: '', alt: '' }
      break
    case 'button':
      base.styles = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: { value: 12, unit: 'px' },
        paddingBottom: { value: 12, unit: 'px' },
        paddingLeft: { value: 24, unit: 'px' },
        paddingRight: { value: 24, unit: 'px' },
        backgroundColor: '#7c3aed',
        color: '#ffffff',
        borderRadius: { value: 8, unit: 'px' },
        fontWeight: 600,
        fontSize: { value: 16, unit: 'px' },
        borderWidth: { value: 0, unit: 'px' },
        borderStyle: 'none',
      }
      base.props = { text: 'Clique Aqui', link: '', target: '_self' }
      break
    case 'divider':
      base.styles = {
        width: { value: 100, unit: '%' },
        height: { value: 1, unit: 'px' },
        backgroundColor: '#e0e0e0',
        marginTop: { value: 24, unit: 'px' },
        marginBottom: { value: 24, unit: 'px' },
      }
      break
  }

  return base
}

export function createDefaultPage(name: string, slug: string): PageData {
  const page = createDefaultNode('page', name)
  const hero = createDefaultNode('section', 'Hero')
  const container = createDefaultNode('container', 'Container')
  container.styles = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: { value: 100, unit: '%' },
    maxWidth: { value: 900, unit: 'px' },
    gap: { value: 16, unit: 'px' },
    paddingTop: { value: 80, unit: 'px' },
    paddingBottom: { value: 80, unit: 'px' },
    paddingLeft: { value: 24, unit: 'px' },
    paddingRight: { value: 24, unit: 'px' },
    textAlign: 'center',
  }
  const heading = createDefaultNode('heading', 'Heading')
  heading.props = { text: 'Sua Pagina Incrivel', level: 'h1' }
  heading.styles.fontSize = { value: 48, unit: 'px' }
  const text = createDefaultNode('text', 'Subtitle')
  text.props = { text: 'Crie paginas profissionais sem escrever codigo. Arraste e solte componentes para construir o site dos seus sonhos.' }
  text.styles.fontSize = { value: 18, unit: 'px' }
  text.styles.color = '#666666'
  const btn = createDefaultNode('button', 'CTA')
  btn.props = { text: 'Comece Agora', link: '#' }

  container.children = [heading, text, btn]
  hero.children = [container]
  page.children = [hero]

  return {
    id: generateId(),
    name,
    slug,
    tree: page,
    breakpoints: ['1440', '768', '375'],
    globalStyles: {},
  }
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
  if (idx !== -1) {
    tree.children.splice(idx, 1)
    return true
  }
  for (const child of tree.children) {
    if (removeNode(child, id)) return true
  }
  return false
}

export function insertNode(tree: DocumentNode, parentId: string, node: DocumentNode, index?: number): boolean {
  const parent = findNode(tree, parentId)
  if (!parent) return false
  if (index !== undefined && index >= 0) {
    parent.children.splice(index, 0, node)
  } else {
    parent.children.push(node)
  }
  return true
}

export function moveNode(tree: DocumentNode, nodeId: string, newParentId: string, newIndex?: number): boolean {
  const node = findNode(tree, nodeId)
  if (!node) return false
  const nodeCopy = JSON.parse(JSON.stringify(node))
  removeNode(tree, nodeId)
  return insertNode(tree, newParentId, nodeCopy, newIndex)
}

export function stylesToCss(styles: NodeStyles, layoutMode: LayoutMode, breakpoint?: string): string {
  const lines: string[] = []

  function val(s?: StyleValue): string {
    if (!s) return '0'
    return `${s.value}${s.unit}`
  }

  if (layoutMode === 'freehand') {
    if (styles.left) lines.push(`left: ${val(styles.left)}`)
    if (styles.top) lines.push(`top: ${val(styles.top)}`)
    if (styles.zIndex !== undefined) lines.push(`z-index: ${styles.zIndex}`)
    if (styles.rotation) lines.push(`transform: rotate(${styles.rotation}deg)`)
  }

  if (styles.display) lines.push(`display: ${styles.display}`)
  if (styles.flexDirection) lines.push(`flex-direction: ${styles.flexDirection}`)
  if (styles.alignItems) lines.push(`align-items: ${styles.alignItems}`)
  if (styles.justifyContent) lines.push(`justify-content: ${styles.justifyContent}`)
  if (styles.gap) lines.push(`gap: ${val(styles.gap)}`)
  if (styles.flex) lines.push(`flex: ${styles.flex}`)

  if (styles.width) {
    if (styles.width === 'fill') lines.push('width: 100%')
    else if (styles.width === 'hug') lines.push('width: auto')
    else lines.push(`width: ${val(styles.width)}`)
  }
  if (styles.height) {
    if (styles.height === 'hug') lines.push('height: auto')
    else lines.push(`height: ${val(styles.height)}`)
  }
  if (styles.minWidth) lines.push(`min-width: ${val(styles.minWidth)}`)
  if (styles.maxWidth) lines.push(`max-width: ${val(styles.maxWidth)}`)
  if (styles.minHeight) lines.push(`min-height: ${val(styles.minHeight)}`)

  if (styles.marginTop) lines.push(`margin-top: ${val(styles.marginTop)}`)
  if (styles.marginRight) lines.push(`margin-right: ${val(styles.marginRight)}`)
  if (styles.marginBottom) lines.push(`margin-bottom: ${val(styles.marginBottom)}`)
  if (styles.marginLeft) lines.push(`margin-left: ${val(styles.marginLeft)}`)
  if (styles.paddingTop) lines.push(`padding-top: ${val(styles.paddingTop)}`)
  if (styles.paddingRight) lines.push(`padding-right: ${val(styles.paddingRight)}`)
  if (styles.paddingBottom) lines.push(`padding-bottom: ${val(styles.paddingBottom)}`)
  if (styles.paddingLeft) lines.push(`padding-left: ${val(styles.paddingLeft)}`)

  if (styles.backgroundColor) lines.push(`background-color: ${styles.backgroundColor}`)
  if (styles.backgroundImage) lines.push(`background-image: url(${styles.backgroundImage})`)
  if (styles.backgroundSize) lines.push(`background-size: ${styles.backgroundSize}`)
  if (styles.borderWidth) lines.push(`border-width: ${val(styles.borderWidth)}`)
  if (styles.borderStyle) lines.push(`border-style: ${styles.borderStyle}`)
  if (styles.borderColor) lines.push(`border-color: ${styles.borderColor}`)
  if (styles.borderRadius) lines.push(`border-radius: ${val(styles.borderRadius)}`)
  if (styles.boxShadow) lines.push(`box-shadow: ${styles.boxShadow}`)
  if (styles.opacity !== undefined) lines.push(`opacity: ${styles.opacity}`)

  if (styles.fontFamily) lines.push(`font-family: ${styles.fontFamily}`)
  if (styles.fontSize) lines.push(`font-size: ${val(styles.fontSize)}`)
  if (styles.fontWeight) lines.push(`font-weight: ${styles.fontWeight}`)
  if (styles.lineHeight) lines.push(`line-height: ${styles.lineHeight}`)
  if (styles.letterSpacing) lines.push(`letter-spacing: ${val(styles.letterSpacing)}`)
  if (styles.color) lines.push(`color: ${styles.color}`)
  if (styles.textAlign) lines.push(`text-align: ${styles.textAlign}`)
  if (styles.textDecoration) lines.push(`text-decoration: ${styles.textDecoration}`)

  return lines.join('; ')
}

export function nodeTypeLabel(type: NodeType): string {
  const map: Record<NodeType, string> = {
    page: 'Pagina', section: 'Secao', container: 'Container',
    row: 'Linha', column: 'Coluna',
    heading: 'Titulo', text: 'Texto', image: 'Imagem',
    button: 'Botao', icon: 'Icone', video: 'Video',
    divider: 'Divisor', list: 'Lista', form: 'Formulario',
    nav: 'Nav Bar', hero: 'Hero', pricing: 'Precos',
    faq: 'FAQ', testimonial: 'Depoimento', countdown: 'Timer',
    tabs: 'Abas', modal: 'Modal', embed: 'Incorporar',
  }
  return map[type] || type
}
