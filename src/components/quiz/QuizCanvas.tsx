import { useCallback, useRef, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQuizStore, type QuizNodeData } from '../../stores/quizStore'
import QuizNodeComponent from './QuizNodeComponent'

const nodeTypes: NodeTypes = { quizNode: QuizNodeComponent }

function CanvasInner() {
  const currentQuiz = useQuizStore(s => s.currentQuiz)
  const setNodes = useQuizStore(s => s.setNodes)
  const setEdges = useQuizStore(s => s.setEdges)
  const addEdge = useQuizStore(s => s.addEdge)
  const removeEdge = useQuizStore(s => s.removeEdge)
  const selectNode = useQuizStore(s => s.selectNode)
  const updateNodePosition = useQuizStore(s => s.updateNodePosition)
  const isPreview = useQuizStore(s => s.isPreview)
  const pushHistory = useQuizStore(s => s.pushHistory)
  const [nodes, setLocalNodes, onNodesChange] = useNodesState(currentQuiz?.nodes || [])
  const [edges, setLocalEdges, onEdgesChange] = useEdgesState(currentQuiz?.edges || [])
  const [error, setError] = useState('')

  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentQuiz) {
      setLocalNodes(currentQuiz.nodes)
      setLocalEdges(currentQuiz.edges)
    }
  }, [currentQuiz?.id])

  const onConnect = useCallback((connection: Connection) => {
    setError('')
    const valid = addEdge(connection)
    if (!valid) {
      setError('Conexao invalida: circuito detectado')
      return
    }
    const state = useQuizStore.getState()
    setLocalEdges([...state.currentQuiz!.edges])
  }, [addEdge])

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    updateNodePosition(node.id, node.position)
  }, [updateNodePosition])

  const onNodesChangeHandler = useCallback((changes: any) => {
    if (isPreview) return
    onNodesChange(changes)
  }, [isPreview, onNodesChange])

  const onEdgesChangeHandler = useCallback((changes: any) => {
    if (isPreview) return
    onEdgesChange(changes)
    // If edge was deleted by user click
    for (const c of changes) {
      if (c.type === 'remove') {
        removeEdge(c.id)
      }
    }
  }, [isPreview, onEdgesChange, removeEdge])

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/quiz-node-type') as any
    if (!type) return
    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect()
    if (!reactFlowBounds) return
    const position = {
      x: event.clientX - reactFlowBounds.left - 100,
      y: event.clientY - reactFlowBounds.top - 30,
    }
    useQuizStore.getState().addNode(type, position)
    pushHistory()
    const state = useQuizStore.getState()
    setLocalNodes([...state.currentQuiz!.nodes])
  }, [pushHistory])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) useQuizStore.getState().redo()
        else useQuizStore.getState().undo()
        const state = useQuizStore.getState()
        if (state.currentQuiz) {
          setLocalNodes([...state.currentQuiz.nodes])
          setLocalEdges([...state.currentQuiz.edges])
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = useQuizStore.getState().selectedNodeId
        if (sel) {
          useQuizStore.getState().removeNode(sel)
          const state = useQuizStore.getState()
          setLocalNodes([...state.currentQuiz!.nodes])
          setLocalEdges([...state.currentQuiz!.edges])
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="quiz-canvas-wrapper" ref={reactFlowWrapper}>
      {error && <div className="quiz-canvas-error">{error}</div>}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeHandler}
        onEdgesChange={onEdgesChangeHandler}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={!isPreview}
        nodesConnectable={!isPreview}
        elementsSelectable={!isPreview}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(168,85,247,0.08)" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={() => '#a855f7'}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: '#1a1a2e', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 6 }}
        />
      </ReactFlow>
    </div>
  )
}

export default function QuizCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
