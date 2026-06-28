import { create } from 'zustand'
import { produce } from 'immer'
import type { Node, Edge, Connection, XYPosition } from '@xyflow/react'
import slugify from 'slugify'

export type QuestionType = 'multiple' | 'truefalse' | 'text' | 'text_area' | 'rating' | 'number' | 'date' | 'file_upload' | 'consent' | 'range' | 'ranking' | 'matrix'
export type NodeType = 'start' | 'question' | 'logic' | 'result' | 'redirect' | 'score' | 'wait' | 'webhook' | 'subflow' | 'custom'

export interface HandleConfig {
  id: string
  label: string
  position: 'right' | 'bottom' | 'left' | 'top'
  conditionType?: 'score' | 'answer' | 'custom_variable' | 'always'
  operator?: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'starts_with' | 'ends_with'
  value?: string
  weight?: number
}

export interface LogicBranch {
  id: string
  label: string
  conditionType: 'score' | 'answer' | 'custom_variable' | 'always'
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'starts_with' | 'ends_with'
  value: string
  variable: string
}

export interface QuestionConfig {
  type: QuestionType
  text: string
  description: string
  options: { label: string; value: string; correct: boolean }[]
  mediaUrl: string
  required: boolean
  multiple: boolean
  min?: number
  max?: number
  step?: number
  unit?: string
  acceptedTypes?: string
  maxFileSize?: number
  consentText?: string
  rangeLabels?: { min: string; max: string }
  rankingItems?: string[]
  matrixRows?: string[]
  matrixColumns?: { label: string; value: string }[]
}

export interface LogicConfig {
  mode: 'if_else' | 'switch' | 'weighted'
  conditionType: 'score' | 'answer' | 'custom_variable'
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'starts_with' | 'ends_with'
  value: string
  variable: string
  branches: LogicBranch[]
}

export interface ResultConfig {
  title: string
  content: string
  imageUrl: string
  redirectUrl: string
}

export interface RedirectConfig {
  url: string
  timeout: number
}

export interface ScoreConfig {
  action: 'add' | 'subtract' | 'set'
  value: number
}

export interface WaitConfig {
  seconds: number
}

export interface WebhookConfig {
  url: string
  method: 'POST' | 'GET'
  headers: { key: string; value: string }[]
  bodyTemplate: string
}

export interface SubflowConfig {
  quizId: string
  quizTitle: string
}

export interface TypographyStyle {
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  lineHeight?: number
  letterSpacing?: number
  textColor?: string
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through'
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
}

export interface BackgroundStyle {
  bgColor?: string
  bgImage?: string
  gradient?: string
}

export interface BoxModelStyle {
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  marginTop?: number
  marginRight?: number
  marginBottom?: number
  marginLeft?: number
  borderWidth?: number
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  borderColor?: string
  borderRadius?: number
  borderTopLeftRadius?: number
  borderTopRightRadius?: number
  borderBottomRightRadius?: number
  borderBottomLeftRadius?: number
}

export interface ShadowStyle {
  shadowX?: number
  shadowY?: number
  shadowBlur?: number
  shadowSpread?: number
  shadowColor?: string
}

export interface NodeStyles {
  color?: string
  icon?: string
  typography?: TypographyStyle
  background?: BackgroundStyle
  boxModel?: BoxModelStyle
  shadow?: ShadowStyle
  opacity?: number
  rotation?: number
  scale?: number
  zIndex?: number
  width?: number | string
  height?: number | string
}

export interface FreehandWidgetData {
  id: string
  type: 'text' | 'image' | 'shape' | 'icon' | 'divider' | 'button' | 'counter' | 'timer' | 'progress_bar'
  position: { x: number; y: number }
  size: { width: number; height: number }
  rotation: number
  zIndex: number
  locked: boolean
  visible: boolean
  styles: NodeStyles
  content?: string
  shapeType?: 'rect' | 'circle' | 'triangle' | 'line' | 'arrow'
  iconName?: string
}

export interface ActionConfig {
  type: 'redirect' | 'jump' | 'update_score' | 'set_variable' | 'submit' | 'show_hide' | 'webhook' | 'modal' | 'email_capture'
  url?: string
  target?: string
  newTab?: boolean
  scoreAction?: 'add' | 'subtract' | 'set'
  scoreValue?: number
  variableName?: string
  variableValue?: string
  elementId?: string
  show?: boolean
  webhookUrl?: string
  webhookBody?: string
}

export interface QuizNodeData {
  [key: string]: unknown
  label: string
  type: NodeType
  handles?: HandleConfig[]
  question?: QuestionConfig
  logic?: LogicConfig
  result?: ResultConfig
  redirect?: RedirectConfig
  score?: ScoreConfig
  wait?: WaitConfig
  webhook?: WebhookConfig
  subflow?: SubflowConfig
  actions?: ActionConfig[]
  styles?: NodeStyles
  freehand?: boolean
}

export interface QuizSettings {
  theme: 'dark' | 'light' | 'system'
  layout: 'single' | 'multi-step'
  progressBar: boolean
  allowBacktracking: boolean
  randomizeQuestions: boolean
  timeLimit: number
  redirectAfterComplete: string
  defaultFontFamily?: string
  defaultTextColor?: string
  defaultBgColor?: string
  defaultButtonStyle?: 'solid' | 'outline' | 'ghost' | 'text'
  globalBackground?: BackgroundStyle
}

export interface Quiz {
  id: string
  userId: string
  title: string
  description: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  nodes: Node<QuizNodeData>[]
  edges: Edge[]
  settings: QuizSettings
  version: number
  createdAt: string
  updatedAt: string
  freehand?: FreehandWidgetData[]
}

const DEFAULT_SETTINGS: QuizSettings = {
  theme: 'dark',
  layout: 'single',
  progressBar: true,
  allowBacktracking: false,
  randomizeQuestions: false,
  timeLimit: 0,
  redirectAfterComplete: '',
}

function generateQuizSlug(title: string): string {
  return slugify(title || 'quiz', { lower: true, strict: true }) + '-' + Math.random().toString(36).slice(2, 7)
}

function createStartNode(position: XYPosition): Node<QuizNodeData> {
  return {
    id: crypto.randomUUID(),
    type: 'quizNode',
    position,
    data: { label: 'Inicio', type: 'start', styles: { color: '#a855f7' } },
  }
}

function getHandlesForNode(data: QuizNodeData): HandleConfig[] {
  if (data.type === 'start') return [{ id: 'out', label: 'Iniciar', position: 'right' }]
  if (data.type === 'logic') {
    if (data.logic?.branches && data.logic.branches.length > 0) {
      return data.logic.branches.map(b => ({
        id: b.id,
        label: b.label,
        position: 'right' as const,
        conditionType: b.conditionType,
        operator: b.operator,
        value: b.value,
        weight: 1,
      }))
    }
    return [
      { id: 'true', label: 'Sim', position: 'right', conditionType: 'score', operator: '>=', value: '70' },
      { id: 'false', label: 'Nao', position: 'bottom' },
    ]
  }
  if (data.type === 'question') {
    if (data.question?.options && data.question.options.length > 0) {
      return data.question.options.map(o => ({
        id: `opt-${o.value}`,
        label: o.label,
        position: 'right' as const,
        conditionType: 'answer' as const,
        operator: '==' as const,
        value: o.value,
      }))
    }
  }
  if (data.type === 'wait' || data.type === 'webhook' || data.type === 'subflow' || data.type === 'score' || data.type === 'custom') {
    return [{ id: 'out', label: 'Prosseguir', position: 'right' }]
  }
  if (data.handles && data.handles.length > 0) {
    return data.handles
  }
  return [{ id: 'out', label: '', position: 'right' }]
}

interface QuizState {
  currentQuiz: Quiz | null
  isDirty: boolean
  isSaving: boolean
  isPreview: boolean
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedFreehandId: string | null
  savedVersion: number

  past: Quiz[]
  future: Quiz[]

  setQuiz: (quiz: Quiz) => void
  createNewQuiz: (fetchWithAuth: (url: string, opts?: any) => Promise<Response>) => Promise<string | null>
  loadQuiz: (id: string, fetchWithAuth: (url: string, opts?: any) => Promise<Response>) => Promise<void>
  saveQuiz: (fetchWithAuth: (url: string, opts?: any) => Promise<Response>) => Promise<boolean>
  setTitle: (title: string) => void
  setDescription: (desc: string) => void

  addNode: (type: NodeType, position: XYPosition) => void
  updateNodeData: (nodeId: string, data: Partial<QuizNodeData>) => void
  removeNode: (nodeId: string) => void
  updateNodePosition: (nodeId: string, position: XYPosition) => void
  setNodes: (nodes: Node<QuizNodeData>[]) => void
  duplicateNode: (nodeId: string) => void

  addEdge: (connection: Connection) => boolean
  removeEdge: (edgeId: string) => void
  setEdges: (edges: Edge[]) => void
  selectEdge: (edgeId: string | null) => void

  selectNode: (nodeId: string | null) => void
  selectFreehandWidget: (id: string | null) => void

  togglePreview: () => void

  undo: () => void
  redo: () => void
  pushHistory: () => void

  updateSettings: (settings: Partial<QuizSettings>) => void

  publishQuiz: (fetchWithAuth: (url: string, opts?: any) => Promise<Response>) => Promise<boolean>

  addFreehandWidget: (widget: FreehandWidgetData) => void
  updateFreehandWidget: (id: string, data: Partial<FreehandWidgetData>) => void
  removeFreehandWidget: (id: string) => void
}

function cloneQuiz(q: Quiz): Quiz {
  return JSON.parse(JSON.stringify(q))
}

export const useQuizStore = create<QuizState>((set, get) => ({
  currentQuiz: null,
  isDirty: false,
  isSaving: false,
  isPreview: false,
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedFreehandId: null,
  savedVersion: 0,
  past: [] as Quiz[],
  future: [] as Quiz[],

  setQuiz: (quiz) => set({ currentQuiz: quiz, savedVersion: quiz.version, isDirty: false }),

    createNewQuiz: async (fetchWithAuth) => {
      try {
        const res = await fetchWithAuth('/api/quizzes', { method: 'POST' })
        if (!res.ok) return null
        const data = await res.json()
        set({
          currentQuiz: {
            ...data,
            nodes: data.nodes || [],
            edges: data.edges || [],
            settings: data.settings || { theme: 'dark', layout: 'single', progressBar: true, allowBacktracking: false, randomizeQuestions: false, timeLimit: 0, redirectAfterComplete: '' },
            freehand: data.freehand || [],
          },
          savedVersion: data.version,
          isDirty: false,
          past: [] as Quiz[],
          future: [] as Quiz[],
          selectedNodeId: null,
          selectedFreehandId: null,
          isPreview: false,
        })
        return data.id
      } catch { return null }
    },

    loadQuiz: async (id, fetchWithAuth) => {
      try {
        const res = await fetchWithAuth(`/api/quizzes/${id}`)
        if (!res.ok) return
        const quiz = await res.json()
        set({
          currentQuiz: {
            ...quiz,
            nodes: quiz.nodes || [],
            edges: quiz.edges || [],
            settings: quiz.settings || { theme: 'dark', layout: 'single', progressBar: true, allowBacktracking: false, randomizeQuestions: false, timeLimit: 0, redirectAfterComplete: '' },
            freehand: quiz.freehand || [],
          },
          savedVersion: quiz.version,
          isDirty: false,
          past: [] as Quiz[],
          future: [] as Quiz[],
          selectedNodeId: null,
          selectedFreehandId: null,
          isPreview: false,
        })
      } catch {}
    },

  saveQuiz: async (fetchWithAuth) => {
    const { currentQuiz, savedVersion } = get()
    if (!currentQuiz) return false
    set({ isSaving: true })
    try {
      const res = await fetchWithAuth(`/api/quizzes/${currentQuiz.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...currentQuiz, version: savedVersion }),
      })
      if (res.status === 409) {
        const serverQuiz = await res.json()
        set({ currentQuiz: serverQuiz, savedVersion: serverQuiz.version, isDirty: false, isSaving: false })
        return false
      }
      if (!res.ok) { set({ isSaving: false }); return false }
      const updated = await res.json()
      set({ currentQuiz: updated, savedVersion: updated.version, isDirty: false, isSaving: false })
      return true
    } catch { set({ isSaving: false }); return false }
  },

  setTitle: (title) => {
    set(produce((s: QuizState) => {
      if (s.currentQuiz) {
        s.currentQuiz.title = title
        s.isDirty = true
      }
    }))
  },

  setDescription: (desc) => {
    set(produce((s: QuizState) => {
      if (s.currentQuiz) { s.currentQuiz.description = desc; s.isDirty = true }
    }))
  },

  addNode: (type, position) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) return
      s.past.push(cloneQuiz(s.currentQuiz))
      s.future = []
      const id = crypto.randomUUID()
      const node: Node<QuizNodeData> = {
        id,
        type: 'quizNode',
        position,
        data: { label: getDefaultLabel(type), type, styles: {} },
      }
      if (type === 'question') {
        node.data.question = { type: 'multiple', text: '', description: '', options: [{ label: 'Opcao 1', value: '1', correct: false }], mediaUrl: '', required: false, multiple: false }
      } else if (type === 'logic') {
        node.data.logic = { mode: 'if_else', conditionType: 'score', operator: '>=', value: '70', variable: '', branches: [
          { id: crypto.randomUUID(), label: 'Sim', conditionType: 'always', operator: '==', value: 'true', variable: '' },
          { id: crypto.randomUUID(), label: 'Nao', conditionType: 'always', operator: '==', value: 'false', variable: '' },
        ]}
      } else if (type === 'result') {
        node.data.result = { title: '', content: '', imageUrl: '', redirectUrl: '' }
      } else if (type === 'redirect') {
        node.data.redirect = { url: '', timeout: 5 }
      } else if (type === 'score') {
        node.data.score = { action: 'add', value: 10 }
      } else if (type === 'wait') {
        node.data.wait = { seconds: 3 }
      } else if (type === 'webhook') {
        node.data.webhook = { url: '', method: 'POST', headers: [], bodyTemplate: '{}' }
      } else if (type === 'subflow') {
        node.data.subflow = { quizId: '', quizTitle: '' }
      }
      s.currentQuiz.nodes.push(node)
      s.isDirty = true
    }))
  },

  updateNodeData: (nodeId, data) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) return
      s.past.push(cloneQuiz(s.currentQuiz))
      s.future = []
      const node = s.currentQuiz.nodes.find(n => n.id === nodeId)
      if (node) { Object.assign(node.data, data); s.isDirty = true }
    }))
  },

  removeNode: (nodeId) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) return
      s.past.push(cloneQuiz(s.currentQuiz))
      s.future = []
      s.currentQuiz.nodes = s.currentQuiz.nodes.filter(n => n.id !== nodeId)
      s.currentQuiz.edges = s.currentQuiz.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
      s.isDirty = true
      if (s.selectedNodeId === nodeId) s.selectedNodeId = null
    }))
  },

  duplicateNode: (nodeId) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) return
      const orig = s.currentQuiz.nodes.find(n => n.id === nodeId)
      if (!orig) return
      s.past.push(cloneQuiz(s.currentQuiz))
      s.future = []
      const newNode: Node<QuizNodeData> = JSON.parse(JSON.stringify(orig))
      newNode.id = crypto.randomUUID()
      newNode.position = { x: orig.position.x + 50, y: orig.position.y + 50 }
      newNode.data.label = orig.data.label + ' (copia)'
      s.currentQuiz.nodes.push(newNode)
      s.isDirty = true
    }))
  },

  updateNodePosition: (nodeId, position) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) return
      const node = s.currentQuiz.nodes.find(n => n.id === nodeId)
      if (node) { node.position = position; s.isDirty = true }
    }))
  },

  setNodes: (nodes) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) return
      s.currentQuiz.nodes = nodes as Node<QuizNodeData>[]
      s.isDirty = true
    }))
  },

  addEdge: (connection) => {
    let valid = true
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) { valid = false; return }
      if (connection.source === connection.target) { valid = false; return }
      // Multi-output cycle detection: traverse via all edges
      const visited = new Set<string>()
      function dfs(nodeId: string): boolean {
        if (nodeId === connection.source) return true
        if (visited.has(nodeId)) return false
        visited.add(nodeId)
        const outgoing = s.currentQuiz!.edges.filter(e => e.source === nodeId)
        for (const e of outgoing) {
          if (e.target && dfs(e.target)) return true
        }
        return false
      }
      if (connection.target && dfs(connection.target)) { valid = false; return }
      s.past.push(cloneQuiz(s.currentQuiz))
      s.future = []
      const sourceNode = s.currentQuiz.nodes.find(n => n.id === connection.source)
      const handles = sourceNode ? getHandlesForNode(sourceNode.data) : []
      const handle = handles.find(h => h.id === connection.sourceHandle)
      const edgeLabel = handle?.label || ''

      const edge: Edge = {
        id: crypto.randomUUID(),
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        type: 'smoothstep',
        animated: true,
        label: edgeLabel,
        style: getEdgeStyle(connection.sourceHandle),
      }
      s.currentQuiz.edges.push(edge)
      s.isDirty = true
    }))
    return valid
  },

  removeEdge: (edgeId) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) return
      s.past.push(cloneQuiz(s.currentQuiz))
      s.future = []
      s.currentQuiz.edges = s.currentQuiz.edges.filter(e => e.id !== edgeId)
      s.isDirty = true
      if (s.selectedEdgeId === edgeId) s.selectedEdgeId = null
    }))
  },

  setEdges: (edges) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) return
      s.currentQuiz.edges = edges
      s.isDirty = true
    }))
  },

  selectEdge: (edgeId) => set({ selectedEdgeId: edgeId }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null, selectedFreehandId: null }),
  selectFreehandWidget: (id) => set({ selectedFreehandId: id, selectedNodeId: null, selectedEdgeId: null }),

  togglePreview: () => set(produce((s: QuizState) => { s.isPreview = !s.isPreview })),

  undo: () => {
    set(produce((s: QuizState) => {
      if (s.past.length === 0 || !s.currentQuiz) return
      s.future.push(cloneQuiz(s.currentQuiz))
      s.currentQuiz = s.past.pop()!
      s.isDirty = true
    }))
  },

  redo: () => {
    set(produce((s: QuizState) => {
      if (s.future.length === 0 || !s.currentQuiz) return
      s.past.push(cloneQuiz(s.currentQuiz))
      s.currentQuiz = s.future.pop()!
      s.isDirty = true
    }))
  },

  pushHistory: () => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) return
      s.past.push(cloneQuiz(s.currentQuiz))
      s.future = []
    }))
  },

  updateSettings: (settings) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) return
      Object.assign(s.currentQuiz.settings, settings)
      s.isDirty = true
    }))
  },

  publishQuiz: async (fetchWithAuth) => {
    const { currentQuiz } = get()
    if (!currentQuiz) return false
    try {
      const res = await fetchWithAuth(`/api/quizzes/${currentQuiz.id}/publish`, { method: 'POST' })
      if (!res.ok) return false
      const updated = await res.json()
      set({ currentQuiz: updated, savedVersion: updated.version, isDirty: false })
      return true
    } catch { return false }
  },

  addFreehandWidget: (widget) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) return
      if (!s.currentQuiz.freehand) s.currentQuiz.freehand = []
      s.currentQuiz.freehand.push(widget)
      s.isDirty = true
    }))
  },

  updateFreehandWidget: (id, data) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz?.freehand) return
      const w = s.currentQuiz.freehand.find(fw => fw.id === id)
      if (w) { Object.assign(w, data); s.isDirty = true }
    }))
  },

  removeFreehandWidget: (id) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz?.freehand) return
      s.currentQuiz.freehand = s.currentQuiz.freehand.filter(fw => fw.id !== id)
      s.isDirty = true
    }))
  },
}))

function getEdgeStyle(sourceHandle?: string | null): React.CSSProperties {
  if (sourceHandle === 'true') return { stroke: '#22c55e', strokeWidth: 2 }
  if (sourceHandle === 'false') return { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '6 3' }
  return { stroke: '#a855f7', strokeWidth: 2 }
}

function getDefaultLabel(type: NodeType): string {
  const map: Record<NodeType, string> = {
    start: 'Inicio',
    question: 'Pergunta',
    logic: 'Condicao',
    result: 'Resultado',
    redirect: 'Redirecionar',
    score: 'Pontuacao',
    wait: 'Aguardar',
    webhook: 'Webhook',
    subflow: 'Sub-quiz',
    custom: 'Personalizado',
  }
  return map[type] || 'Card'
}

export { getHandlesForNode, getEdgeStyle, getDefaultLabel }
