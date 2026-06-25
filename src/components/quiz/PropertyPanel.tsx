import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useQuizStore } from '../../stores/quizStore'

export default function PropertyPanel() {
  const selectedNodeId = useQuizStore(s => s.selectedNodeId)
  const currentQuiz = useQuizStore(s => s.currentQuiz)
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const removeNode = useQuizStore(s => s.removeNode)

  const node = currentQuiz?.nodes.find(n => n.id === selectedNodeId)

  if (!node) {
    return (
      <div className="quiz-panel quiz-panel-empty">
        <div className="quiz-panel-empty-icon">◻</div>
        <p>Selecione um card para editar suas propriedades</p>
      </div>
    )
  }

  return (
    <div className="quiz-panel">
      <div className="quiz-panel-header">
        <span>Configurar Card</span>
        <button className="quiz-panel-remove" onClick={() => removeNode(node.id)} title="Remover card">✕</button>
      </div>
      <div className="quiz-panel-body">
        <div className="quiz-panel-field">
          <label>Rotulo</label>
          <input type="text" value={node.data.label} onChange={e => updateNodeData(node.id, { label: e.target.value })} />
        </div>
        <div className="quiz-panel-divider" />
        {node.type === 'question' && <QuestionFields nodeId={node.id} />}
        {node.type === 'logic' && <LogicFields nodeId={node.id} />}
        {node.type === 'result' && <ResultFields nodeId={node.id} />}
        {node.type === 'redirect' && <RedirectFields nodeId={node.id} />}
        {node.type === 'score' && <ScoreFields nodeId={node.id} />}
      </div>
    </div>
  )
}

function QuestionFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const q = node?.data?.question
  if (!q) return null

  return (
    <>
      <div className="quiz-panel-field">
        <label>Texto da pergunta</label>
        <textarea value={q.text} onChange={e => updateNodeData(nodeId, { question: { ...q, text: e.target.value } })} rows={3} />
      </div>
      <div className="quiz-panel-field">
        <label>Descricao (opcional)</label>
        <textarea value={q.description} onChange={e => updateNodeData(nodeId, { question: { ...q, description: e.target.value } })} rows={2} />
      </div>
      <div className="quiz-panel-field">
        <label>Opcoes</label>
        {q.options.map((opt, i) => (
          <div key={i} className="quiz-panel-option-row">
            <input type="text" value={opt.label} onChange={e => {
              const opts = [...q.options]; opts[i] = { ...opts[i], label: e.target.value }; updateNodeData(nodeId, { question: { ...q, options: opts } })
            }} placeholder="Rotulo" />
            <input type="checkbox" checked={opt.correct} onChange={e => {
              const opts = [...q.options]; opts[i] = { ...opts[i], correct: e.target.checked }; updateNodeData(nodeId, { question: { ...q, options: opts } })
            }} title="Correta" />
            <button className="quiz-panel-remove-opt" onClick={() => {
              const opts = q.options.filter((_, idx) => idx !== i); updateNodeData(nodeId, { question: { ...q, options: opts } })
            }}>✕</button>
          </div>
        ))}
        <button className="quiz-panel-add-opt" onClick={() => {
          const opts = [...q.options, { label: `Opcao ${q.options.length + 1}`, value: String(q.options.length + 1), correct: false }]
          updateNodeData(nodeId, { question: { ...q, options: opts } })
        }}>+ Adicionar opcao</button>
      </div>
      <div className="quiz-panel-field">
        <label>URL de midia (opcional)</label>
        <input type="text" value={q.mediaUrl} onChange={e => updateNodeData(nodeId, { question: { ...q, mediaUrl: e.target.value } })} placeholder="https://..." />
      </div>
      <div className="quiz-panel-field-row">
        <label><input type="checkbox" checked={q.required} onChange={e => updateNodeData(nodeId, { question: { ...q, required: e.target.checked } })} /> Obrigatorio</label>
        <label><input type="checkbox" checked={q.multiple} onChange={e => updateNodeData(nodeId, { question: { ...q, multiple: e.target.checked } })} /> Multiplas respostas</label>
      </div>
    </>
  )
}

function LogicFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const l = node?.data?.logic
  if (!l) return null
  return (
    <>
      <div className="quiz-panel-field">
        <label>Tipo de condicao</label>
        <select value={l.conditionType} onChange={e => updateNodeData(nodeId, { logic: { ...l, conditionType: e.target.value as any } })}>
          <option value="score">Pontuacao</option>
          <option value="answer">Resposta</option>
          <option value="custom_variable">Variavel personalizada</option>
        </select>
      </div>
      <div className="quiz-panel-field">
        <label>Operador</label>
        <select value={l.operator} onChange={e => updateNodeData(nodeId, { logic: { ...l, operator: e.target.value as any } })}>
          <option value=">">Maior que (&gt;)</option>
          <option value="<">Menor que (&lt;)</option>
          <option value=">=">Maior ou igual (&gt;=)</option>
          <option value="<=">Menor ou igual (&lt;=)</option>
          <option value="==">Igual (==)</option>
          <option value="!=">Diferente (!=)</option>
          <option value="contains">Contem</option>
        </select>
      </div>
      <div className="quiz-panel-field">
        <label>Valor</label>
        <input type="text" value={l.value} onChange={e => updateNodeData(nodeId, { logic: { ...l, value: e.target.value } })} />
      </div>
    </>
  )
}

function ResultFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const r = node?.data?.result
  if (!r) return null
  return (
    <>
      <div className="quiz-panel-field">
        <label>Titulo</label>
        <input type="text" value={r.title} onChange={e => updateNodeData(nodeId, { result: { ...r, title: e.target.value } })} />
      </div>
      <div className="quiz-panel-field">
        <label>Conteudo</label>
        <textarea value={r.content} onChange={e => updateNodeData(nodeId, { result: { ...r, content: e.target.value } })} rows={4} />
      </div>
      <div className="quiz-panel-field">
        <label>URL de imagem (opcional)</label>
        <input type="text" value={r.imageUrl} onChange={e => updateNodeData(nodeId, { result: { ...r, imageUrl: e.target.value } })} />
      </div>
      <div className="quiz-panel-field">
        <label>URL de redirecionamento (opcional)</label>
        <input type="text" value={r.redirectUrl} onChange={e => updateNodeData(nodeId, { result: { ...r, redirectUrl: e.target.value } })} />
      </div>
    </>
  )
}

function RedirectFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const r = node?.data?.redirect
  if (!r) return null
  return (
    <>
      <div className="quiz-panel-field">
        <label>URL de destino</label>
        <input type="text" value={r.url} onChange={e => updateNodeData(nodeId, { redirect: { ...r, url: e.target.value } })} placeholder="https://..." />
      </div>
      <div className="quiz-panel-field">
        <label>Timeout (segundos)</label>
        <input type="number" value={r.timeout} onChange={e => updateNodeData(nodeId, { redirect: { ...r, timeout: parseInt(e.target.value) || 5 } })} />
      </div>
    </>
  )
}

function ScoreFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const s = node?.data?.score
  if (!s) return null
  return (
    <>
      <div className="quiz-panel-field">
        <label>Acao</label>
        <select value={s.action} onChange={e => updateNodeData(nodeId, { score: { ...s, action: e.target.value as any } })}>
          <option value="add">Adicionar</option>
          <option value="subtract">Subtrair</option>
          <option value="set">Definir</option>
        </select>
      </div>
      <div className="quiz-panel-field">
        <label>Valor</label>
        <input type="number" value={s.value} onChange={e => updateNodeData(nodeId, { score: { ...s, value: parseInt(e.target.value) || 0 } })} />
      </div>
    </>
  )
}
