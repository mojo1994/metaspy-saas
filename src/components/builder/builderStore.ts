import { create } from 'zustand'
import { produce } from 'immer'
import {
  DocumentNode, createDefaultNode, findNode, insertNode, removeNode, moveNode, cloneSubtree,
  NodeType, NodeStyles,
} from './documentModel'

interface EditorStore {
  tree: DocumentNode
  selectedId: string
  past: DocumentNode[]
  future: DocumentNode[]
  deviceIndex: number
  zoom: number
  previewMode: boolean

  initTree: (tree: DocumentNode, selectedId: string) => void
  selectNode: (id: string) => void
  updateNode: (id: string, changes: Partial<DocumentNode>) => void
  setStyle: (id: string, prop: string, val: any) => void
  deleteNode: (id: string) => void
  addWidget: (type: string, parentId: string, index?: number) => string | null
  moveNodeAction: (nodeId: string, newParentId: string, newIndex: number) => void
  duplicateNode: (id: string) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  setDeviceIndex: (i: number) => void
  setZoom: (z: number) => void
  setPreviewMode: (p: boolean) => void
}

const MAX_HISTORY = 50

export const useEditorStore = create<EditorStore>((set, get) => ({
  tree: { id: '', type: 'page', name: '', layoutMode: 'structured', styles: {}, props: {}, visible: true, locked: false, children: [] },
  selectedId: '',
  past: [],
  future: [],
  deviceIndex: 0,
  zoom: 1,
  previewMode: false,

  initTree: (tree, selectedId) => set({ tree: JSON.parse(JSON.stringify(tree)), selectedId, past: [], future: [] }),

  selectNode: (id) => set({ selectedId: id }),

  updateNode: (id, changes) => set(produce((state: EditorStore) => {
    const node = findNode(state.tree, id)
    if (node) Object.assign(node, changes)
  })),

  setStyle: (id, prop, val) => set(produce((state: EditorStore) => {
    const node = findNode(state.tree, id)
    if (node) (node.styles as any)[prop] = val
  })),

  deleteNode: (id) => {
    const state = get()
    if (id === state.tree.id) return
    const tree = JSON.parse(JSON.stringify(state.tree))
    removeNode(tree, id)
    set({ tree, selectedId: tree.id, past: [...state.past, state.tree], future: [] })
  },

  addWidget: (type, parentId, index) => {
    const state = get()
    const node = createDefaultNode(type as NodeType)
    const tree = JSON.parse(JSON.stringify(state.tree))
    insertNode(tree, parentId, node, index ?? 0)
    set({ tree, selectedId: node.id, past: [...state.past, state.tree], future: [] })
    return node.id
  },

  moveNodeAction: (nodeId, newParentId, newIndex) => {
    const state = get()
    const tree = JSON.parse(JSON.stringify(state.tree))
    moveNode(tree, nodeId, newParentId, newIndex)
    set({ tree, past: [...state.past, state.tree], future: [] })
  },

  duplicateNode: (id) => {
    const state = get()
    const node = findNode(state.tree, id)
    if (!node || id === state.tree.id) return
    const parent = findNode(state.tree, state.tree.id)
    const clone = cloneSubtree(node)
    if (parent) {
      const idx = parent.children.findIndex(c => c.id === id)
      const tree = JSON.parse(JSON.stringify(state.tree))
      const p = findNode(tree, state.tree.id)
      if (p) {
        const i = p.children.findIndex(c => c.id === id)
        if (i !== -1) p.children.splice(i + 1, 0, clone)
      }
      set({ tree, selectedId: clone.id, past: [...state.past, state.tree], future: [] })
    }
  },

  pushHistory: () => set(produce((state: EditorStore) => {
    state.past.push(JSON.parse(JSON.stringify(state.tree)))
    if (state.past.length > MAX_HISTORY) state.past.shift()
    state.future = []
  })),

  undo: () => {
    const state = get()
    if (state.past.length === 0) return
    const prev = state.past[state.past.length - 1]
    set({
      tree: JSON.parse(JSON.stringify(prev)),
      past: state.past.slice(0, -1),
      future: [state.tree, ...state.future],
    })
  },

  redo: () => {
    const state = get()
    if (state.future.length === 0) return
    const next = state.future[0]
    set({
      tree: JSON.parse(JSON.stringify(next)),
      past: [...state.past, state.tree],
      future: state.future.slice(1),
    })
  },

  setDeviceIndex: (i) => set({ deviceIndex: i }),
  setZoom: (z) => set({ zoom: z }),
  setPreviewMode: (p) => set({ previewMode: p }),
}))
