import { useState } from 'react'
import { DocumentNode, LayoutMode, StyleValue, stylesToCss, nodeTypeLabel } from './documentModel'

interface Props {
  node: DocumentNode | null
  onChange: (id: string, changes: Partial<DocumentNode>) => void
}

type Section = 'layout' | 'appearance' | 'typography' | 'content'

export default function PropertyInspector({ node, onChange }: Props) {
  const [activeSection, setActiveSection] = useState<Section>('content')

  if (!node) {
    return (
      <div style={{ padding: 20, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
        Selecione um elemento para editar suas propriedades
      </div>
    )
  }

  const n = node

  function setStyle(prop: string, value: any) {
    onChange(n.id, { styles: { ...n.styles, [prop]: value } })
  }

  function setProp(key: string, value: any) {
    onChange(n.id, { props: { ...n.props, [key]: value } })
  }

  function setLayoutMode(mode: LayoutMode) {
    onChange(n.id, { layoutMode: mode })
  }

  const sections: { key: Section; label: string }[] = [
    { key: 'content', label: 'Conteudo' },
    { key: 'layout', label: 'Layout' },
    { key: 'appearance', label: 'Aparencia' },
    { key: 'typography', label: 'Tipografia' },
  ]

  const isFreehand = n.layoutMode === 'freehand'

  function StyleInput({ label, value, onChange: onValueChange, suffix, type = 'text' }: {
    label: string
    value: any
    onChange: (v: any) => void
    suffix?: string
    type?: string
  }) {
    return (
      <div className="builder-prop-row">
        <label className="builder-prop-label">{label}</label>
        <div className="builder-prop-input-wrap">
          <input
            type={type}
            value={value || ''}
            onChange={e => onValueChange(type === 'number' ? Number(e.target.value) : e.target.value)}
            className="builder-prop-input"
          />
          {suffix && <span className="builder-prop-suffix">{suffix}</span>}
        </div>
      </div>
    )
  }

  function ColorInput({ label, value, onChange: onValueChange }: {
    label: string
    value: string | undefined
    onChange: (v: string) => void
  }) {
    return (
      <div className="builder-prop-row">
        <label className="builder-prop-label">{label}</label>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="color"
            value={value || '#000000'}
            onChange={e => onValueChange(e.target.value)}
            style={{ width: 28, height: 28, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
          />
          <input
            type="text"
            value={value || ''}
            onChange={e => onValueChange(e.target.value)}
            className="builder-prop-input"
            style={{ width: 80 }}
          />
        </div>
      </div>
    )
  }

  function UnitInput({ label, value, onChange: onValueChange }: {
    label: string
    value: StyleValue | string | undefined
    onChange: (v: StyleValue | string) => void
  }) {
    const sv = typeof value === 'object' ? value : undefined
    return (
      <div className="builder-prop-row">
        <label className="builder-prop-label">{label}</label>
        <div className="builder-prop-input-wrap">
          <input
            type="number"
            value={sv?.value ?? ''}
            onChange={e => onValueChange({ value: Number(e.target.value), unit: sv?.unit || 'px' } as StyleValue)}
            className="builder-prop-input"
            style={{ width: 60 }}
          />
          <select
            value={sv?.unit || 'px'}
            onChange={e => onValueChange({ value: sv?.value || 0, unit: e.target.value } as StyleValue)}
            className="builder-prop-select"
          >
            <option value="px">px</option>
            <option value="%">%</option>
            <option value="vw">vw</option>
            <option value="vh">vh</option>
          </select>
        </div>
      </div>
    )
  }

  return (
    <div style={{ overflow: 'auto', height: '100%', fontSize: 12 }}>
      <style>{`
        .builder-prop-row { display: flex; align-items: center; gap: 8px; padding: 4px 12px; }
        .builder-prop-label { width: 80px; font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
        .builder-prop-input-wrap { display: flex; align-items: center; gap: 2px; flex: 1; }
        .builder-prop-input {
          flex: 1; padding: 3px 6px; border: 1px solid var(--border);
          border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);
          font-size: 11px; min-width: 0; outline: none;
        }
        .builder-prop-input:focus { border-color: var(--purple-400); }
        .builder-prop-input[type="number"] { width: 60px; }
        .builder-prop-select {
          padding: 3px 4px; border: 1px solid var(--border); border-radius: 4px;
          background: var(--bg-primary); color: var(--text-primary); font-size: 10px;
          cursor: pointer; outline: none;
        }
        .builder-prop-suffix { font-size: 10px; color: var(--text-muted); }
        .builder-section-tabs { display: flex; border-bottom: 1px solid var(--border); overflow-x: auto; }
        .builder-section-tab {
          padding: 6px 10px; font-size: 11px; cursor: pointer; white-space: nowrap;
          border-bottom: 2px solid transparent; color: var(--text-muted); transition: all 0.15s;
          background: none; border-top: none; border-left: none; border-right: none;
        }
        .builder-section-tab:hover { color: var(--text-primary); }
        .builder-section-tab.active { color: var(--purple-400); border-bottom-color: var(--purple-400); }
        .builder-section-title { padding: 8px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 600; }
      `}</style>

      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{n.name}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{nodeTypeLabel(n.type)}</div>
      </div>

      <div className="builder-section-tabs">
        {sections.map(s => (
          <button
            key={s.key}
            className={`builder-section-tab ${activeSection === s.key ? 'active' : ''}`}
            onClick={() => setActiveSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'content' && (
        <div>
          {n.type === 'heading' && (
            <>
              <div className="builder-section-title">Texto</div>
              <StyleInput label="Conteudo" value={n.props.text} onChange={v => setProp('text', v)} />
              <div className="builder-prop-row">
                <label className="builder-prop-label">Nivel</label>
                <select value={n.props.level || 'h2'} onChange={e => setProp('level', e.target.value)} className="builder-prop-select">
                  <option value="h1">h1</option>
                  <option value="h2">h2</option>
                  <option value="h3">h3</option>
                  <option value="h4">h4</option>
                </select>
              </div>
            </>
          )}
          {n.type === 'text' && (
            <>
              <div className="builder-section-title">Texto</div>
              <div style={{ padding: '4px 12px' }}>
                <textarea
                  value={n.props.text || ''}
                  onChange={e => setProp('text', e.target.value)}
                  className="builder-prop-input"
                  rows={4}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </>
          )}
          {n.type === 'button' && (
            <>
              <div className="builder-section-title">Botao</div>
              <StyleInput label="Texto" value={n.props.text} onChange={v => setProp('text', v)} />
              <StyleInput label="Link" value={n.props.link} onChange={v => setProp('link', v)} />
              <div className="builder-prop-row">
                <label className="builder-prop-label">Abrir em</label>
                <select value={n.props.target || '_self'} onChange={e => setProp('target', e.target.value)} className="builder-prop-select">
                  <option value="_self">Mesma janela</option>
                  <option value="_blank">Nova janela</option>
                </select>
              </div>
            </>
          )}
          {n.type === 'image' && (
            <>
              <div className="builder-section-title">Imagem</div>
              <StyleInput label="URL" value={n.props.src} onChange={v => setProp('src', v)} />
              <StyleInput label="Alt" value={n.props.alt} onChange={v => setProp('alt', v)} />
            </>
          )}
        </div>
      )}

      {activeSection === 'layout' && (
        <div>
          <div className="builder-section-title">Modo</div>
          <div style={{ padding: '4px 12px', display: 'flex', gap: 4 }}>
            <button
              className={`btn ${!isFreehand ? 'btn-accent' : 'btn-secondary'}`}
              onClick={() => setLayoutMode('structured')}
              style={{ fontSize: 10, padding: '3px 8px', flex: 1 }}
            >
              Estruturado
            </button>
            <button
              className={`btn ${isFreehand ? 'btn-accent' : 'btn-secondary'}`}
              onClick={() => setLayoutMode('freehand')}
              style={{ fontSize: 10, padding: '3px 8px', flex: 1 }}
            >
              Livre
            </button>
          </div>

          {isFreehand && (
            <>
              <div className="builder-section-title">Posicao</div>
              <UnitInput label="X" value={n.styles.left} onChange={v => setStyle('left', v)} />
              <UnitInput label="Y" value={n.styles.top} onChange={v => setStyle('top', v)} />
              <StyleInput label="Z-Index" value={n.styles.zIndex} onChange={v => setStyle('zIndex', Number(v))} type="number" />
            </>
          )}

          <div className="builder-section-title">Dimensoes</div>
          <UnitInput label="Largura" value={n.styles.width} onChange={v => setStyle('width', v)} />
          <UnitInput label="Altura" value={n.styles.height} onChange={v => setStyle('height', v)} />
          <UnitInput label="Max Larg" value={n.styles.maxWidth} onChange={v => setStyle('maxWidth', v)} />

          {!isFreehand && (
            <>
              <div className="builder-section-title">Espacamento</div>
              <UnitInput label="Padding T" value={n.styles.paddingTop} onChange={v => setStyle('paddingTop', v)} />
              <UnitInput label="Padding R" value={n.styles.paddingRight} onChange={v => setStyle('paddingRight', v)} />
              <UnitInput label="Padding B" value={n.styles.paddingBottom} onChange={v => setStyle('paddingBottom', v)} />
              <UnitInput label="Padding L" value={n.styles.paddingLeft} onChange={v => setStyle('paddingLeft', v)} />
              <UnitInput label="Gap" value={n.styles.gap} onChange={v => setStyle('gap', v)} />
              <UnitInput label="Margem T" value={n.styles.marginTop} onChange={v => setStyle('marginTop', v)} />
              <UnitInput label="Margem B" value={n.styles.marginBottom} onChange={v => setStyle('marginBottom', v)} />

              <div className="builder-section-title">Flex</div>
              <div className="builder-prop-row">
                <label className="builder-prop-label">Direcao</label>
                <select
                  value={n.styles.flexDirection || 'row'}
                  onChange={e => setStyle('flexDirection', e.target.value)}
                  className="builder-prop-select"
                >
                  <option value="row">Linha</option>
                  <option value="column">Coluna</option>
                </select>
              </div>
              <div className="builder-prop-row">
                <label className="builder-prop-label">Alinhar</label>
                <select
                  value={n.styles.alignItems || 'stretch'}
                  onChange={e => setStyle('alignItems', e.target.value)}
                  className="builder-prop-select"
                >
                  <option value="flex-start">Topo</option>
                  <option value="center">Centro</option>
                  <option value="flex-end">Fim</option>
                  <option value="stretch">Esticar</option>
                </select>
              </div>
              <div className="builder-prop-row">
                <label className="builder-prop-label">Justificar</label>
                <select
                  value={n.styles.justifyContent || 'flex-start'}
                  onChange={e => setStyle('justifyContent', e.target.value)}
                  className="builder-prop-select"
                >
                  <option value="flex-start">Inicio</option>
                  <option value="center">Centro</option>
                  <option value="flex-end">Fim</option>
                  <option value="space-between">Espacar</option>
                  <option value="space-around">Ao redor</option>
                </select>
              </div>
            </>
          )}
        </div>
      )}

      {activeSection === 'appearance' && (
        <div>
          <div className="builder-section-title">Fundo</div>
          <ColorInput label="Cor" value={n.styles.backgroundColor} onChange={v => setStyle('backgroundColor', v)} />
          <StyleInput label="Imagem URL" value={n.styles.backgroundImage} onChange={v => setStyle('backgroundImage', v)} />
          <div className="builder-prop-row">
            <label className="builder-prop-label">Tamanho</label>
            <select value={n.styles.backgroundSize || 'auto'} onChange={e => setStyle('backgroundSize', e.target.value)} className="builder-prop-select">
              <option value="cover">Cobrir</option>
              <option value="contain">Conter</option>
              <option value="auto">Auto</option>
            </select>
          </div>

          <div className="builder-section-title">Borda</div>
          <UnitInput label="Largura" value={n.styles.borderWidth} onChange={v => setStyle('borderWidth', v)} />
          <div className="builder-prop-row">
            <label className="builder-prop-label">Estilo</label>
            <select value={n.styles.borderStyle || 'none'} onChange={e => setStyle('borderStyle', e.target.value)} className="builder-prop-select">
              <option value="none">Nenhuma</option>
              <option value="solid">Solida</option>
              <option value="dashed">Tracejada</option>
              <option value="dotted">Pontilhada</option>
            </select>
          </div>
          <ColorInput label="Cor" value={n.styles.borderColor} onChange={v => setStyle('borderColor', v)} />
          <UnitInput label="Raio" value={n.styles.borderRadius} onChange={v => setStyle('borderRadius', v)} />

          <div className="builder-section-title">Sombra</div>
          <StyleInput label="Box Shadow" value={n.styles.boxShadow} onChange={v => setStyle('boxShadow', v)} />
          <StyleInput label="Opacidade" value={n.styles.opacity !== undefined ? n.styles.opacity : ''} onChange={v => setStyle('opacity', Number(v))} type="number" />
        </div>
      )}

      {activeSection === 'typography' && (
        <div>
          <div className="builder-section-title">Fonte</div>
          <StyleInput label="Familia" value={n.styles.fontFamily} onChange={v => setStyle('fontFamily', v)} />
          <UnitInput label="Tamanho" value={n.styles.fontSize} onChange={v => setStyle('fontSize', v)} />
          <StyleInput label="Peso" value={n.styles.fontWeight} onChange={v => setStyle('fontWeight', v)} type="number" />
          <StyleInput label="Altura Linha" value={n.styles.lineHeight} onChange={v => setStyle('lineHeight', Number(v))} type="number" />
          <UnitInput label="Espacamento" value={n.styles.letterSpacing} onChange={v => setStyle('letterSpacing', v)} />
          <ColorInput label="Cor" value={n.styles.color} onChange={v => setStyle('color', v)} />
          <div className="builder-prop-row">
            <label className="builder-prop-label">Alinhar</label>
            <select value={n.styles.textAlign || 'left'} onChange={e => setStyle('textAlign', e.target.value)} className="builder-prop-select">
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
