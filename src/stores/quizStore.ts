import { create } from 'zustand'
import { produce } from 'immer'
import type { Node, Edge, Connection, XYPosition } from '@xyflow/react'
import slugify from 'slugify'

export type QuestionType = 'multiple' | 'truefalse' | 'text' | 'rating'
export type NodeType = 'start' | 'question' | 'logic' | 'result' | 'redirect' | 'score' | 'custom'

export interface QuestionConfig {
  type: QuestionType
  text: string
  description: string
  options: { label: string; value: string; correct: boolean }[]
  mediaUrl: string
  required: boolean
  multiple: boolean
}

export interface LogicConfig {
  conditionType: 'score' | 'answer' | 'custom_variable'
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains'
  value: string
  variable: string
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

export interface NodeStyles {
  color?: string
  icon?: string
}

export interface QuizNodeData {
  [key: string]: unknown
  label: string
  type: NodeType
  question?: QuestionConfig
  logic?: LogicConfig
  result?: ResultConfig
  redirect?: RedirectConfig
  score?: ScoreConfig
  styles?: NodeStyles
}

export interface QuizSettings {
  theme: 'dark' | 'light' | 'system'
  layout: 'single' | 'multi-step'
  progressBar: boolean
  allowBacktracking: boolean
  randomizeQuestions: boolean
  timeLimit: number
  redirectAfterComplete: string
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

interface QuizState {
  currentQuiz: Quiz | null
  isDirty: boolean
  isSaving: boolean
  isPreview: boolean
  selectedNodeId: string | null
  savedVersion: number

  // History
  past: Quiz[]
  future: Quiz[]

  setQuiz: (quiz: Quiz) => void
  createNewQuiz: (fetchWithAuth: (url: string, opts?: any) => Promise<Response>) => Promise<string | null>
  loadQuiz: (id: string, fetchWithAuth: (url: string, opts?: any) => Promise<Response>) => Promise<void>
  saveQuiz: (fetchWithAuth: (url: string, opts?: any) => Promise<Response>) => Promise<boolean>
  setTitle: (title: string) => void
  setDescription: (desc: string) => void

  // Nodes
  addNode: (type: NodeType, position: XYPosition) => void
  updateNodeData: (nodeId: string, data: Partial<QuizNodeData>) => void
  removeNode: (nodeId: string) => void
  updateNodePosition: (nodeId: string, position: XYPosition) => void
  setNodes: (nodes: Node<QuizNodeData>[]) => void

  // Edges
  addEdge: (connection: Connection) => boolean
  removeEdge: (edgeId: string) => void
  setEdges: (edges: Edge[]) => void

  // Selection
  selectNode: (nodeId: string | null) => void

  // Preview
  togglePreview: () => void

  // Undo/Redo
  undo: () => void
  redo: () => void
  pushHistory: () => void

  // Settings
  updateSettings: (settings: Partial<QuizSettings>) => void

  // Publish
  publishQuiz: (fetchWithAuth: (url: string, opts?: any) => Promise<Response>) => Promise<boolean>
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
  savedVersion: 0,
  past: [],
  future: [],

  setQuiz: (quiz) => set({ currentQuiz: quiz, savedVersion: quiz.version, isDirty: false }),

  createNewQuiz: async (fetchWithAuth) => {
    try {
      const res = await fetchWithAuth('/api/quizzes', { method: 'POST' })
      if (!res.ok) return null
      const data = await res.json()
      set({
        currentQuiz: data,
        savedVersion: data.version,
        isDirty: false,
        past: [],
        future: [],
        selectedNodeId: null,
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
        currentQuiz: quiz,
        savedVersion: quiz.version,
        isDirty: false,
        past: [],
        future: [],
        selectedNodeId: null,
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
        node.data.logic = { conditionType: 'score', operator: '>=', value: '70', variable: '' }
      } else if (type === 'result') {
        node.data.result = { title: '', content: '', imageUrl: '', redirectUrl: '' }
      } else if (type === 'redirect') {
        node.data.redirect = { url: '', timeout: 5 }
      } else if (type === 'score') {
        node.data.score = { action: 'add', value: 10 }
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
      // Self-connection check
      if (connection.source === connection.target) { valid = false; return }
      // Circular dependency check
      const visited = new Set<string>()
      function dfs(nodeId: string): boolean {
        if (nodeId === connection.source) return true
        if (visited.has(nodeId)) return false
        visited.add(nodeId)
        const outgoing = s.currentQuiz!.edges.filter(e => e.source === nodeId)
        for (const e of outgoing) {
          if (e.target && dfs(e.target)) return true
        }
        // Also check through nodes
        const node = s.currentQuiz!.nodes.find(n => n.id === nodeId)
        return false
      }
      if (connection.target && dfs(connection.target)) { valid = false; return }
      s.past.push(cloneQuiz(s.currentQuiz))
      s.future = []
      const edge: Edge = {
        id: crypto.randomUUID(),
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        type: 'smoothstep',
        animated: true,
      }
      if (connection.sourceHandle === 'true') edge.label = 'Sim'
      if (connection.sourceHandle === 'false') edge.label = 'Nao'
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
    }))
  },

  setEdges: (edges) => {
    set(produce((s: QuizState) => {
      if (!s.currentQuiz) return
      s.currentQuiz.edges = edges
      s.isDirty = true
    }))
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

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
}))

function getDefaultLabel(type: NodeType): string {
  const map: Record<NodeType, string> = {
    start: 'Inicio',
    question: 'Pergunta',
    logic: 'Condicao',
    result: 'Resultado',
    redirect: 'Redirecionar',
    score: 'Pontuacao',
    custom: 'Personalizado',
  }
  return map[type] || 'Card'
}
