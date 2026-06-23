import { useState, useRef, useEffect } from 'react'
import { DocumentNode, LayoutMode, StyleValue, ScrollAnimation, ClickAction, HoverStyle } from './documentModel'

interface Props { node: DocumentNode | null; onChange: (id: string, changes: Partial<DocumentNode>) => void }

type Section = 'content' | 'layout' | 'appearance' | 'typography' | 'interactions' | 'animation'

export default function PropertyInspector({ node, onChange }: Props) {
  const [activeSection, setActiveSection] = useState<Section>('content')
  if (!node) return <div style={{ padding: 20, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Selecione um elemento</div>

  const n = node
  function setStyle(prop: string, val: any) { onChange(n.id, { styles: { ...n.styles, [prop]: val } }) }
  function setProp(key: string, val: any) { onChange(n.id, { props: { ...n.props, [key]: val } }) }
  function setLayoutMode(mode: LayoutMode) { onChange(n.id, { layoutMode: mode }) }
  function setHover(h: HoverStyle) { onChange(n.id, { hoverStyle: h }) }
  function setAnim(a: ScrollAnimation | undefined) { onChange(n.id, { scrollAnimation: a }) }
  function setClick(c: Partial<ClickAction>) { onChange(n.id, { clickAction: { type: 'none', ...n.clickAction, ...c } as ClickAction }) }

  const isFreehand = n.layoutMode === 'freehand'

  const sections: { key: Section; label: string }[] = [
    { key: 'content', label: 'Conteudo' },
    { key: 'layout', label: 'Layout' },
    { key: 'appearance', label: 'Aparencia' },
    { key: 'typography', label: 'Tipografia' },
    { key: 'interactions', label: 'Interacoes' },
    { key: 'animation', label: 'Animacao' },
  ]

  function StyleInput({ label, value, onChange: oc, suffix, type = 'text' }: { label: string; value: any; onChange: (v: any) => void; suffix?: string; type?: string }) {
    return (
      <div className="builder-prop-row">
        <label className="builder-prop-label">{label}</label>
        <div className="builder-prop-input-wrap">
          <input type={type} value={value ?? ''} onChange={e => oc(type === 'number' ? Number(e.target.value) : e.target.value)} className="builder-prop-input" />
          {suffix && <span className="builder-prop-suffix">{suffix}</span>}
        </div>
      </div>
    )
  }

  function ColorInput({ label, value, onChange: oc }: { label: string; value?: string; onChange: (v: string) => void }) {
    return (
      <div className="builder-prop-row">
        <label className="builder-prop-label">{label}</label>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="color" value={value || '#000000'} onChange={e => oc(e.target.value)} style={{ width: 28, height: 28, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
          <input type="text" value={value || ''} onChange={e => oc(e.target.value)} className="builder-prop-input" style={{ width: 80 }} />
        </div>
      </div>
    )
  }

  function UnitInput({ label, value, onChange: oc }: { label: string; value: StyleValue | string | undefined; onChange: (v: StyleValue | string) => void }) {
    const sv = typeof value === 'object' ? value : undefined
    return (
      <div className="builder-prop-row">
        <label className="builder-prop-label">{label}</label>
        <div className="builder-prop-input-wrap">
          <input type="number" value={sv?.value ?? ''} onChange={e => oc({ value: Number(e.target.value), unit: sv?.unit || 'px' } as StyleValue)} className="builder-prop-input" style={{ width: 60 }} />
          <select value={sv?.unit || 'px'} onChange={e => oc({ value: sv?.value || 0, unit: e.target.value } as StyleValue)} className="builder-prop-select">
            <option value="px">px</option><option value="%">%</option><option value="vw">vw</option><option value="vh">vh</option>
          </select>
        </div>
      </div>
    )
  }

  function SelectInput({ label, value, options, onChange: oc }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
    return (
      <div className="builder-prop-row">
        <label className="builder-prop-label">{label}</label>
        <select value={value} onChange={e => oc(e.target.value)} className="builder-prop-select" style={{ flex: 1 }}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    )
  }

  const textTypes = ['heading', 'text', 'button']
  const containerTypes = ['section', 'container', 'row', 'column']
  const imageTypes = ['image']

  return (
    <div style={{ overflow: 'auto', height: '100%', fontSize: 12 }}>
      <style>{builderInspectorCss}</style>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{n.name}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{nodeTypeLabel(n.type)}</div>
      </div>
      <div className="builder-section-tabs"> {sections.map(s => (
        <button key={s.key} className={`builder-section-tab ${activeSection === s.key ? 'active' : ''}`} onClick={() => setActiveSection(s.key)}>{s.label}</button>
      ))}</div>

      {/* CONTENT */}
      {activeSection === 'content' && (
        <div>
          {n.type === 'heading' && (<><div className="builder-section-title">Texto</div><StyleInput label="Conteudo" value={n.props.text} onChange={v => setProp('text', v)} />
            <SelectInput label="Nivel" value={n.props.level || 'h2'} options={[{ value: 'h1', label: 'h1' }, { value: 'h2', label: 'h2' }, { value: 'h3', label: 'h3' }, { value: 'h4', label: 'h4' }]} onChange={v => setProp('level', v)} />
          </>)}
          {n.type === 'text' && (<><div className="builder-section-title">Texto</div><RichTextEditor html={n.props.html || ''} onChange={html => setProp('html', html)} /></>)}
          {n.type === 'button' && (<><div className="builder-section-title">Botao</div><StyleInput label="Texto" value={n.props.text} onChange={v => setProp('text', v)} /><StyleInput label="Link" value={n.props.link} onChange={v => setProp('link', v)} />
            <SelectInput label="Abrir em" value={n.props.target || '_self'} options={[{ value: '_self', label: 'Mesma janela' }, { value: '_blank', label: 'Nova janela' }]} onChange={v => setProp('target', v)} />
          </>)}
          {n.type === 'image' && (<><div className="builder-section-title">Imagem</div><StyleInput label="URL" value={n.props.src} onChange={v => setProp('src', v)} /><StyleInput label="Alt" value={n.props.alt} onChange={v => setProp('alt', v)} /></>)}
        </div>
      )}

      {/* LAYOUT */}
      {activeSection === 'layout' && (
        <div>
          <div className="builder-section-title">Modo</div>
          <div style={{ padding: '4px 12px', display: 'flex', gap: 4 }}>
            <button className={`btn ${!isFreehand ? 'btn-accent' : 'btn-secondary'}`} onClick={() => setLayoutMode('structured')} style={{ fontSize: 10, padding: '3px 8px', flex: 1 }}>Estruturado</button>
            <button className={`btn ${isFreehand ? 'btn-accent' : 'btn-secondary'}`} onClick={() => setLayoutMode('freehand')} style={{ fontSize: 10, padding: '3px 8px', flex: 1 }}>Livre</button>
          </div>
          {isFreehand && (<><div className="builder-section-title">Posicao</div><UnitInput label="X" value={n.styles.left} onChange={v => setStyle('left', v)} /><UnitInput label="Y" value={n.styles.top} onChange={v => setStyle('top', v)} /><StyleInput label="Z-Index" value={n.styles.zIndex} onChange={v => setStyle('zIndex', Number(v))} type="number" /></>)}
          <div className="builder-section-title">Dimensoes</div>
          <UnitInput label="Largura" value={n.styles.width} onChange={v => setStyle('width', v)} /><UnitInput label="Altura" value={n.styles.height} onChange={v => setStyle('height', v)} /><UnitInput label="Max Larg" value={n.styles.maxWidth} onChange={v => setStyle('maxWidth', v)} />
          {!isFreehand && (<>
            <div className="builder-section-title">Espacamento</div>
            {['T', 'R', 'B', 'L'].map(s => <UnitInput key={s} label={`Padding ${s}`} value={n.styles[`padding${s}` as keyof typeof n.styles] as StyleValue} onChange={v => setStyle(`padding${s}`, v)} />)}
            <UnitInput label="Gap" value={n.styles.gap} onChange={v => setStyle('gap', v)} />
            {['T', 'B'].map(s => <UnitInput key={s} label={`Margem ${s}`} value={n.styles[`margin${s}` as keyof typeof n.styles] as StyleValue} onChange={v => setStyle(`margin${s}`, v)} />)}
            <div className="builder-section-title">Flex</div>
            <SelectInput label="Direcao" value={n.styles.flexDirection || 'row'} options={[{ value: 'row', label: 'Linha' }, { value: 'column', label: 'Coluna' }]} onChange={v => setStyle('flexDirection', v)} />
            <SelectInput label="Alinhar" value={n.styles.alignItems || 'stretch'} options={[{ value: 'flex-start', label: 'Topo' }, { value: 'center', label: 'Centro' }, { value: 'flex-end', label: 'Fim' }, { value: 'stretch', label: 'Esticar' }]} onChange={v => setStyle('alignItems', v)} />
            <SelectInput label="Justificar" value={n.styles.justifyContent || 'flex-start'} options={[{ value: 'flex-start', label: 'Inicio' }, { value: 'center', label: 'Centro' }, { value: 'flex-end', label: 'Fim' }, { value: 'space-between', label: 'Espacar' }, { value: 'space-around', label: 'Ao redor' }]} onChange={v => setStyle('justifyContent', v)} />
          </>)}
        </div>
      )}

      {/* APPEARANCE */}
      {activeSection === 'appearance' && (
        <div>
          <div className="builder-section-title">Fundo</div>
          <ColorInput label="Cor" value={n.styles.backgroundColor} onChange={v => setStyle('backgroundColor', v)} />
          <StyleInput label="Imagem URL" value={n.styles.backgroundImage} onChange={v => setStyle('backgroundImage', v)} />
          <SelectInput label="Tamanho" value={n.styles.backgroundSize || 'auto'} options={[{ value: 'cover', label: 'Cobrir' }, { value: 'contain', label: 'Conter' }, { value: 'auto', label: 'Auto' }]} onChange={v => setStyle('backgroundSize', v)} />
          <div className="builder-section-title">Borda</div>
          <UnitInput label="Largura" value={n.styles.borderWidth} onChange={v => setStyle('borderWidth', v)} />
          <SelectInput label="Estilo" value={n.styles.borderStyle || 'none'} options={[{ value: 'none', label: 'Nenhuma' }, { value: 'solid', label: 'Solida' }, { value: 'dashed', label: 'Tracejada' }, { value: 'dotted', label: 'Pontilhada' }]} onChange={v => setStyle('borderStyle', v)} />
          <ColorInput label="Cor" value={n.styles.borderColor} onChange={v => setStyle('borderColor', v)} />
          <UnitInput label="Raio" value={n.styles.borderRadius} onChange={v => setStyle('borderRadius', v)} />
          <div className="builder-section-title">Sombra</div>
          <StyleInput label="Box Shadow" value={n.styles.boxShadow} onChange={v => setStyle('boxShadow', v)} />
          <StyleInput label="Opacidade" value={n.styles.opacity !== undefined ? n.styles.opacity : ''} onChange={v => setStyle('opacity', Number(v))} type="number" />
        </div>
      )}

      {/* TYPOGRAPHY */}
      {activeSection === 'typography' && (
        <div>
          <div className="builder-section-title">Fonte</div>
          <StyleInput label="Familia" value={n.styles.fontFamily} onChange={v => setStyle('fontFamily', v)} />
          <UnitInput label="Tamanho" value={n.styles.fontSize} onChange={v => setStyle('fontSize', v)} />
          <StyleInput label="Peso" value={n.styles.fontWeight} onChange={v => setStyle('fontWeight', v)} type="number" />
          <StyleInput label="Altura Linha" value={n.styles.lineHeight} onChange={v => setStyle('lineHeight', Number(v))} type="number" />
          <UnitInput label="Espacamento" value={n.styles.letterSpacing} onChange={v => setStyle('letterSpacing', v)} />
          <ColorInput label="Cor" value={n.styles.color} onChange={v => setStyle('color', v)} />
          <SelectInput label="Alinhar" value={n.styles.textAlign || 'left'} options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }]} onChange={v => setStyle('textAlign', v)} />
          <SelectInput label="Decoracao" value={n.styles.textDecoration || 'none'} options={[{ value: 'none', label: 'Nenhuma' }, { value: 'underline', label: 'Sublinhado' }]} onChange={v => setStyle('textDecoration', v)} />
        </div>
      )}

      {/* INTERACTIONS */}
      {activeSection === 'interactions' && (
        <div>
          <div className="builder-section-title">Hover</div>
          <ColorInput label="Bg Color" value={n.hoverStyle?.backgroundColor} onChange={v => setHover({ ...n.hoverStyle, backgroundColor: v })} />
          <ColorInput label="Cor texto" value={n.hoverStyle?.color} onChange={v => setHover({ ...n.hoverStyle, color: v })} />
          <StyleInput label="Escala" value={n.hoverStyle?.scale} onChange={v => setHover({ ...n.hoverStyle, scale: Number(v) })} type="number" />
          <StyleInput label="Opacidade" value={n.hoverStyle?.opacity} onChange={v => setHover({ ...n.hoverStyle, opacity: Number(v) })} type="number" />
          <StyleInput label="Sombra" value={n.hoverStyle?.boxShadow} onChange={v => setHover({ ...n.hoverStyle, boxShadow: v })} />
          <StyleInput label="Mover Y" value={n.hoverStyle?.translateY} onChange={v => setHover({ ...n.hoverStyle, translateY: Number(v) })} type="number" suffix="px" />
          <div className="builder-section-title">Ao Clicar</div>
          <SelectInput label="Acao" value={n.clickAction?.type || 'none'} onChange={v => setClick({ ...n.clickAction, type: v as ClickAction['type'] })} options={[
            { value: 'none', label: 'Nenhuma' }, { value: 'link', label: 'Ir para link' }, { value: 'scrollTo', label: 'Rolar ate' },
          ]} />
          {n.clickAction?.type === 'link' && (<><StyleInput label="URL" value={n.clickAction.linkUrl} onChange={v => setClick({ ...n.clickAction, linkUrl: v })} />
            <SelectInput label="Target" value={n.clickAction.linkTarget || '_self'} onChange={v => setClick({ ...n.clickAction, linkTarget: v as '_self' | '_blank' })} options={[{ value: '_self', label: 'Mesma janela' }, { value: '_blank', label: 'Nova janela' }]} /></>)}
          {n.clickAction?.type === 'scrollTo' && <StyleInput label="Seletor CSS" value={n.clickAction.scrollSelector} onChange={v => setClick({ ...n.clickAction, scrollSelector: v })} />}
        </div>
      )}

      {/* ANIMATION */}
      {activeSection === 'animation' && (
        <div>
          <SelectInput label="Tipo" value={n.scrollAnimation?.type || ''} onChange={v => setAnim(v ? { type: v as ScrollAnimation['type'], duration: n.scrollAnimation?.duration || 600, delay: n.scrollAnimation?.delay || 0, easing: n.scrollAnimation?.easing || 'ease' } : undefined)} options={[
            { value: '', label: 'Sem animacao' }, { value: 'fadeIn', label: 'Fade In' }, { value: 'fadeInUp', label: 'Fade In Up' }, { value: 'fadeInLeft', label: 'Fade In Left' }, { value: 'fadeInRight', label: 'Fade In Right' }, { value: 'scaleIn', label: 'Scale In' }, { value: 'slideIn', label: 'Slide In' },
          ]} />
          {n.scrollAnimation && (<><StyleInput label="Duracao" value={n.scrollAnimation.duration} onChange={v => setAnim({ ...n.scrollAnimation!, duration: Number(v) })} type="number" suffix="ms" />
            <StyleInput label="Atraso" value={n.scrollAnimation.delay} onChange={v => setAnim({ ...n.scrollAnimation!, delay: Number(v) })} type="number" suffix="ms" />
            <SelectInput label="Easing" value={n.scrollAnimation.easing} onChange={v => setAnim({ ...n.scrollAnimation!, easing: v as ScrollAnimation['easing'] })} options={[{ value: 'ease', label: 'Suave' }, { value: 'ease-out', label: 'Suave saida' }, { value: 'ease-in-out', label: 'Suave ambos' }]} /></>)}
        </div>
      )}
    </div>
  )
}

function nodeTypeLabel(type: string): string {
  const map: Record<string, string> = { page: 'Pagina', section: 'Secao', container: 'Container', row: 'Linha', column: 'Coluna', heading: 'Titulo', text: 'Texto', image: 'Imagem', button: 'Botao', divider: 'Divisor' }
  return map[type] || type
}

function RichTextEditor({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [showToolbar, setShowToolbar] = useState(false)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = html
  }, [html])

  function exec(cmd: string, val?: string) {
    document.execCommand(cmd, false, val)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  return (
    <div style={{ padding: '4px 12px' }}>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 4 }}>
        {[
          { cmd: 'bold', label: 'B' }, { cmd: 'italic', label: 'I' }, { cmd: 'underline', label: 'U' },
        ].map(b => (
          <button key={b.cmd} onMouseDown={e => { e.preventDefault(); exec(b.cmd) }} style={{ padding: '2px 8px', fontSize: 12, fontWeight: b.cmd === 'bold' ? 700 : undefined, fontStyle: b.cmd === 'italic' ? 'italic' : undefined, textDecoration: b.cmd === 'underline' ? 'underline' : undefined, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}>{b.label}</button>
        ))}
        <select onMouseDown={e => e.preventDefault()} onChange={e => exec('formatBlock', e.target.value)} style={{ padding: '2px 4px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
          <option value="">Bloco</option><option value="p">Paragrafo</option><option value="h2">Titulo</option><option value="h3">Sub-titulo</option>
        </select>
        <button onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList') }} style={{ padding: '2px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}>Lista</button>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML) }}
        onFocus={() => setShowToolbar(true)}
        className="builder-prop-input"
        style={{ width: '100%', minHeight: 80, padding: 8, outline: 'none', overflow: 'auto' }}
      />
    </div>
  )
}

const builderInspectorCss = `
.builder-prop-row { display: flex; align-items: center; gap: 8px; padding: 4px 12px; }
.builder-prop-label { width: 80px; font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.builder-prop-input-wrap { display: flex; align-items: center; gap: 2px; flex: 1; }
.builder-prop-input {
  flex: 1; padding: 3px 6px; border: 1px solid var(--border);
  border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);
  font-size: 11px; min-width: 0; outline: none;
}
.builder-prop-input:focus { border-color: var(--purple-400); }
.builder-prop-select {
  padding: 3px 4px; border: 1px solid var(--border); border-radius: 4px;
  background: var(--bg-primary); color: var(--text-primary); font-size: 10px;
  cursor: pointer; outline: none;
}
.builder-section-tabs { display: flex; border-bottom: 1px solid var(--border); overflow-x: auto; }
.builder-section-tab {
  padding: 6px 10px; font-size: 11px; cursor: pointer; white-space: nowrap;
  border-bottom: 2px solid transparent; color: var(--text-muted); transition: all 0.15s;
  background: none; border-top: none; border-left: none; border-right: none;
}
.builder-section-tab:hover { color: var(--text-primary); }
.builder-section-tab.active { color: var(--purple-400); border-bottom-color: var(--purple-400); }
.builder-section-title { padding: 8px 12px 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 600; }
`
