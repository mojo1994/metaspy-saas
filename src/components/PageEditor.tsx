import { useState, useRef, useCallback, useEffect } from 'react'

declare global {
  interface Window {
    __metaEditorActive?: boolean
    __metaEditorEnabled?: boolean
    __metaEditorUpdateStyle?: (prop: string, value: string) => void
    __metaEditorUpdateText?: (text: string) => void
    __metaEditorUpdateAttr?: (attr: string, value: string) => void
    __metaEditorUpdateHtml?: (html: string) => void
    __metaEditorGetHtml?: () => string
    __metaEditorInsertHtml?: (html: string, position: string) => void
    __metaEditorRemove?: () => void
  }
}

interface ElementState {
  tag: string
  id: string
  classes: string[]
  text: string
  html: string
  selector: string
  styles: Record<string, string>
  attributes: Record<string, string>
  isImage: boolean
  imageSrc: string
  imageAlt: string
  childrenCount: number
}

interface WidgetDef {
  id: string
  label: string
  icon: string
  html: string
}

const WIDGETS: WidgetDef[] = [
  { id: 'heading', label: 'Titulo', icon: 'H', html: '<h2 style="font-size:28px;font-weight:700;text-align:center;color:#333;margin:20px 0">Novo Titulo</h2>' },
  { id: 'paragraph', label: 'Texto', icon: 'P', html: '<p style="font-size:16px;line-height:1.6;color:#555;margin:12px 0">Novo texto aqui. Clique para editar.</p>' },
  { id: 'button', label: 'Botao', icon: '▣', html: '<a href="#" style="display:inline-block;padding:12px 32px;background:#7c3aed;color:#fff;border-radius:8px;font-size:16px;font-weight:600;text-decoration:none;cursor:pointer">Clique Aqui</a>' },
  { id: 'card', label: 'Card', icon: '▢', html: '<div style="padding:24px;border-radius:12px;background:#f5f5f5;border:1px solid #e0e0e0;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-align:center"><h3 style="margin:0 0 8px;font-size:18px">Titulo do Card</h3><p style="margin:0;font-size:14px;color:#666">Descricao do card</p></div>' },
  { id: 'section', label: 'Secao', icon: '≡', html: '<section style="padding:40px 24px;background:#fafafa;max-width:900px;margin:0 auto"><h2 style="text-align:center;font-size:24px;font-weight:700">Titulo da Secao</h2><p style="text-align:center;color:#666;max-width:600px;margin:12px auto">Descricao da secao</p></section>' },
  { id: 'divider', label: 'Linha', icon: '—', html: '<hr style="border:none;border-top:2px solid #e0e0e0;margin:24px 0" />' },
  { id: 'image', label: 'Imagem', icon: '⊞', html: '<img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22200%22 viewBox=%220 0 400 200%22%3E%3Crect width=%22400%22 height=%22200%22 fill=%22%23e0e0e0%22/%3E%3Ctext x=%22200%22 y=%22100%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2216%22%3ENova Imagem%3C/text%3E%3C/svg%3E" alt="" style="max-width:100%;border-radius:8px" />' },
  { id: 'video', label: 'Video', icon: '▶', html: '<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#000"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen></iframe></div>' },
]

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function FileTreeNode({ node, cloneId, depth }: { node: any; cloneId: string | null; depth?: number }) {
  const [open, setOpen] = useState(true)
  const indent = depth || 0
  if (node.type === 'directory') {
    return (
      <div>
        <div className="ft-node" style={{ paddingLeft: 12 + indent * 16 }} onClick={() => setOpen(!open)}>
          <span className="ft-arrow">{open ? '▾' : '▸'}</span>
          <span className="ft-icon">{'📁'}</span>
          <span className="ft-name ft-dir">{node.name}</span>
        </div>
        {open && node.children && node.children.map((c: any) => (
          <FileTreeNode key={c.path} node={c} cloneId={cloneId} depth={indent + 1} />
        ))}
      </div>
    )
  }
  return (
    <div className="ft-node" style={{ paddingLeft: 12 + indent * 16 }}>
      <span className="ft-arrow" style={{ visibility: 'hidden' }}>▸</span>
      <span className="ft-icon">{'📄'}</span>
      <span className="ft-name ft-file">{node.name}</span>
      {node.size != null && <span className="ft-size">{formatSize(node.size)}</span>}
    </div>
  )
}

function getDefaultStyles(tag: string): Record<string, string> {
  if (tag === 'img') return { maxWidth: '100%', borderRadius: '0px', opacity: '1' }
  if (tag === 'a') return { color: '#7c3aed', fontSize: '16px', textDecoration: 'underline' }
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') return { fontSize: tag === 'h1' ? '32px' : tag === 'h2' ? '24px' : '20px', fontWeight: '700', lineHeight: '1.3', color: '#222', margin: '12px 0' }
  if (tag === 'p') return { fontSize: '16px', lineHeight: '1.6', color: '#555', margin: '8px 0' }
  if (tag === 'button') return { padding: '10px 24px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }
  if (tag === 'section') return { padding: '40px 24px', background: '#fafafa' }
  if (tag === 'div') return { padding: '0px', margin: '0px' }
  return {}
}

const INJECT_EDITOR_SCRIPT = `
(function() {
  if (window.__metaEditorActive) return;
  window.__metaEditorActive = true;
  let selectedEl = null;
  let overlay = null;

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = '__metaEditorOverlay';
    overlay.style.cssText = 'position:absolute;pointer-events:none;border:2px solid #7c3aed;background:rgba(124,58,237,0.08);z-index:999999;transition:all 0.12s;display:none';
    document.body.appendChild(overlay);
  }

  function updateOverlay(el) {
    if (!overlay) createOverlay();
    if (!el) { overlay.style.display = 'none'; return; }
    var r = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = (r.top + window.scrollY) + 'px';
    overlay.style.left = (r.left + window.scrollX) + 'px';
    overlay.style.width = r.width + 'px';
    overlay.style.height = r.height + 'px';
  }

  function getCSS(el) {
    var s = window.getComputedStyle(el);
    var props = ['display','position','width','height','padding','margin','color','background','backgroundColor','fontSize','fontWeight','fontFamily','textAlign','lineHeight','border','borderRadius','borderWidth','borderColor','borderRadius','opacity','boxShadow','transform','overflow','zIndex','flexDirection','justifyContent','alignItems','gap'];
    var result = {};
    props.forEach(function(p) { result[p] = s.getPropertyValue(p); });
    return result;
  }

  function getAttr(el) {
    var attrs = {};
    for (var i = 0; i < el.attributes.length; i++) {
      attrs[el.attributes[i].name] = el.attributes[i].value;
    }
    return attrs;
  }

  function buildSelector(el) {
    if (!el || el === document.body) return 'body';
    if (el.id) return '#' + el.id;
    var path = [];
    var cur = el;
    while (cur && cur !== document.body) {
      var s = cur.tagName.toLowerCase();
      if (cur.id) { path.unshift('#' + cur.id); break; }
      if (cur.className && typeof cur.className === 'string') {
        var cls = cur.className.trim().split(/\\s+/).filter(function(c) { return c && c.indexOf('__meta') === -1; }).slice(0,2).join('.');
        if (cls) s += '.' + cls;
      }
      var parent = cur.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === cur.tagName; });
        if (siblings.length > 1) {
          var idx = siblings.indexOf(cur) + 1;
          s += ':nth-of-type(' + idx + ')';
        }
      }
      path.unshift(s);
      cur = parent;
    }
    return path.join(' > ');
  }

  function getElementState(el) {
    var isImg = el.tagName === 'IMG';
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      classes: Array.from(el.classList).filter(function(c) { return c.indexOf('__meta') === -1; }),
      text: (el.textContent || '').trim().slice(0, 200),
      html: el.innerHTML,
      selector: buildSelector(el),
      styles: getCSS(el),
      attributes: getAttr(el),
      isImage: isImg,
      imageSrc: isImg ? (el.getAttribute('src') || '') : '',
      imageAlt: isImg ? (el.getAttribute('alt') || '') : '',
      childrenCount: el.children.length
    };
  }

  document.addEventListener('click', function(e) {
    if (!window.__metaEditorEnabled) return;
    var el = e.target;
    if (el === overlay || el.id === '__metaEditorOverlay') return;
    var anchor = el.closest('a');
    if (anchor) { el = anchor; e.preventDefault(); }
    if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;
    if (el === selectedEl && el.isContentEditable) return;
    selectedEl = el;
    updateOverlay(el);
    var tag = el.tagName.toLowerCase();
    if (['p','h1','h2','h3','h4','h5','h6','span','a','li','td','th','label','figcaption','div','blockquote','cite','code','pre','strong','em','b','i','u','small'].indexOf(tag) !== -1) {
      var cs = window.getComputedStyle(el);
      el.style.color = cs.color;
      el.style.fontSize = cs.fontSize;
      el.style.fontWeight = cs.fontWeight;
      el.style.fontFamily = cs.fontFamily;
      el.style.lineHeight = cs.lineHeight;
      el.style.textAlign = cs.textAlign;
      el.contentEditable = true;
      el.focus();
      var range = document.createRange();
      range.selectNodeContents(el);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      el.addEventListener('blur', function onBlur() {
        el.contentEditable = false;
        updateOverlay(el);
        window.parent.postMessage({ type: 'elementUpdated', state: getElementState(el) }, '*');
      }, { once: true });
      el.addEventListener('keydown', function keyHandler(ev) {
        if (ev.key === 'Enter' && !ev.shiftKey && ['span','a','li','label','h1','h2','h3','h4','h5','h6','strong','em','b','i','u','small'].indexOf(tag) !== -1) {
          ev.preventDefault();
          el.blur();
        }
      });
    }
    var state = getElementState(el);
    window.parent.postMessage({ type: 'elementSelected', state: state }, '*');
  }, false);

  window.__metaEditorUpdateStyle = function(prop, value) {
    if (!selectedEl) return;
    selectedEl.style[prop] = value;
    updateOverlay(selectedEl);
    window.parent.postMessage({ type: 'elementUpdated', state: getElementState(selectedEl) }, '*');
  };

  window.__metaEditorUpdateText = function(text) {
    if (!selectedEl) return;
    function findTextNode(n) {
      for (var i = 0; i < n.childNodes.length; i++) {
        var c = n.childNodes[i];
        if (c.nodeType === 3 && c.textContent.trim()) return c;
        var found = findTextNode(c);
        if (found) return found;
      }
      return null;
    }
    var tn = findTextNode(selectedEl);
    if (tn) tn.textContent = text;
    else selectedEl.textContent = text;
    window.parent.postMessage({ type: 'elementUpdated', state: getElementState(selectedEl) }, '*');
  };

  window.__metaEditorUpdateAttr = function(attr, value) {
    if (!selectedEl) return;
    if (value) selectedEl.setAttribute(attr, value);
    else selectedEl.removeAttribute(attr);
    updateOverlay(selectedEl);
    window.parent.postMessage({ type: 'elementUpdated', state: getElementState(selectedEl) }, '*');
  };

  window.__metaEditorUpdateHtml = function(html) {
    if (!selectedEl) return;
    selectedEl.innerHTML = html;
    updateOverlay(selectedEl);
    window.parent.postMessage({ type: 'elementUpdated', state: getElementState(selectedEl) }, '*');
  };

  window.__metaEditorGetHtml = function() {
    return document.documentElement.outerHTML;
  };

  window.__metaEditorInsertHtml = function(html, position) {
    if (!selectedEl) return;
    position = position || 'beforeend';
    selectedEl.insertAdjacentHTML(position, html);
    updateOverlay(selectedEl);
  };

  window.__metaEditorRemove = function() {
    if (!selectedEl || selectedEl === document.body) return;
    var parent = selectedEl.parentElement;
    selectedEl.remove();
    selectedEl = null;
    if (overlay) overlay.style.display = 'none';
    window.parent.postMessage({ type: 'elementRemoved' }, '*');
  };

  createOverlay();
})();
`

function iframeDocType() {
  return '<!DOCTYPE html>'
}

interface PageEditorProps {
  html: string
  sourceUrl?: string
  onExtract?: (html: string) => void
}

export default function PageEditor({ html, sourceUrl, onExtract }: PageEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [editMode, setEditMode] = useState(false)
  const [selectedElement, setSelectedElement] = useState<ElementState | null>(null)
  const [draftText, setDraftText] = useState<string | null>(null)
  const [draftHtml, setDraftHtml] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [showWidgets, setShowWidgets] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showFileTree, setShowFileTree] = useState(false)
  const [fileTreeData, setFileTreeData] = useState<any>(null)
  const [cloneId, setCloneId] = useState<string | null>(null)
  const [loadingTree, setLoadingTree] = useState(false)
  const [treeError, setTreeError] = useState('')
  const [editedHtml, setEditedHtml] = useState(html)

  const iframeLoaded = useRef(false)
  const editModeRef = useRef(false)

  useEffect(() => {
    editModeRef.current = editMode
  }, [editMode])

  const pushHistory = useCallback((h: string) => {
    setHistory(prev => {
      const newH = prev.slice(0, historyIdx + 1)
      newH.push(h)
      if (newH.length > 50) newH.shift()
      return newH
    })
    setHistoryIdx(prev => Math.min(prev + 1, 49))
  }, [historyIdx])

  const sendToIframe = useCallback((method: string, ...args: unknown[]) => {
    const ifr = iframeRef.current
    if (!ifr?.contentWindow) return
    try {
      const fn = (ifr.contentWindow as unknown as Record<string, unknown>)[method]
      if (typeof fn === 'function') (fn as (...a: unknown[]) => void)(...args)
    } catch {}
  }, [])

  const handleMessage = useCallback((e: MessageEvent) => {
    if (e.data?.type === 'elementSelected') {
      setSelectedElement(e.data.state)
      setDraftText(null)
      setDraftHtml(null)
    } else if (e.data?.type === 'elementUpdated') {
      setSelectedElement(e.data.state)
    } else if (e.data?.type === 'elementRemoved') {
      setSelectedElement(null)
      setDraftText(null)
      setDraftHtml(null)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  useEffect(() => {
    if (!iframeRef.current) return
    const doc = iframeRef.current.contentDocument
    if (!doc) return

    const fullHtml = editedHtml.startsWith('<!') ? editedHtml : iframeDocType() + '<html><head><base href="' + window.location.origin + '"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + editedHtml + '</body></html>'

    doc.open()
    doc.write(fullHtml)
    doc.close()

    iframeLoaded.current = true
  }, [editedHtml])

  useEffect(() => {
    if (!iframeLoaded.current || !editMode) return
    const inject = () => {
      const ifr = iframeRef.current
      if (!ifr?.contentDocument) { setTimeout(inject, 200); return }
      try {
        const script = ifr.contentDocument.createElement('script')
        script.textContent = INJECT_EDITOR_SCRIPT
        ifr.contentDocument.body.appendChild(script)
        setTimeout(() => {
          if (ifr.contentWindow) ifr.contentWindow.__metaEditorEnabled = true
        }, 100)
      } catch { setTimeout(inject, 200) }
    }
    inject()
  }, [editMode])

  function toggleEditMode() {
    const next = !editMode
    setEditMode(next)
    if (next && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.__metaEditorEnabled = true
    } else if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.__metaEditorEnabled = false
      setSelectedElement(null)
    }
  }

  function updateStyle(prop: string, value: string) {
    sendToIframe('__metaEditorUpdateStyle', prop, value)
  }

  function updateText(text: string) {
    sendToIframe('__metaEditorUpdateText', text)
  }

  function applyText() {
    if (draftText !== null) { updateText(draftText); setDraftText(null) }
  }

  function applyHtml() {
    if (draftHtml !== null) { sendToIframe('__metaEditorUpdateHtml', draftHtml); setDraftHtml(null) }
  }

  function updateAttr(attr: string, value: string) {
    sendToIframe('__metaEditorUpdateAttr', attr, value)
  }

  function removeElement() {
    sendToIframe('__metaEditorRemove')
    setSelectedElement(null)
  }

  function insertWidget(widget: WidgetDef) {
    sendToIframe('__metaEditorInsertHtml', widget.html, 'beforeend')
  }

  function extractHtml() {
    const ifr = iframeRef.current
    if (!ifr?.contentWindow) return
    try {
      const fn = (ifr.contentWindow as unknown as Record<string, unknown>).__metaEditorGetHtml
      const html = typeof fn === 'function' ? (fn as () => string)() : editedHtml
      setEditedHtml(html)
      pushHistory(html)
      onExtract?.(html)
    } catch {}
  }

  async function handleShowFileTree() {
    if (!sourceUrl) return
    if (fileTreeData) { setShowFileTree(!showFileTree); return }
    setLoadingTree(true)
    setTreeError('')
    try {
      const resp = await fetch('/api/clone/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl })
      })
      if (!resp.ok) {
        let msg = 'Erro ao clonar'
        try { const err = await resp.json(); msg = err.error || msg } catch {}
        throw new Error(msg)
      }
      const data = await resp.json()
      setCloneId(data.cloneId)
      setFileTreeData(data.files)
      setShowFileTree(true)
    } catch (e: any) {
      setTreeError(e.message || 'Erro desconhecido')
      setShowFileTree(true)
    }
    setLoadingTree(false)
  }

  function downloadZip() {
    if (!cloneId) return
    const a = document.createElement('a')
    a.href = '/api/clone/deep/download/' + cloneId
    a.download = 'pagina-clonada.zip'
    a.click()
  }

  function renderStyleInput(label: string, prop: string, type: string = 'text', options?: string[]) {
    const val = selectedElement?.styles?.[prop] || ''
    return (
      <div className="pe-prop-row">
        <label>{label}</label>
        {options ? (
          <select value={val} onChange={e => updateStyle(prop, e.target.value)}>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : type === 'color' ? (
          <div className="pe-color-wrap">
            <input type="color" value={val || '#000000'} onChange={e => updateStyle(prop, e.target.value)} />
            <input type="text" value={val} onChange={e => updateStyle(prop, e.target.value)} placeholder="ex: #fff" />
          </div>
        ) : (
          <input type={type} value={val} onChange={e => updateStyle(prop, e.target.value)} />
        )}
      </div>
    )
  }

  return (
    <div className="page-editor">
      <div className="pe-toolbar">
        <div className="pe-toolbar-left">
          <button className={`btn ${editMode ? 'btn-accent' : 'btn-secondary'}`} onClick={toggleEditMode} style={{ fontSize: 12 }}>
            {editMode ? 'Visualizar' : 'Editar'}
          </button>
          {editMode && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowWidgets(!showWidgets)} style={{ fontSize: 12 }}>
                Widgets
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAdvanced(!showAdvanced)} style={{ fontSize: 12 }}>
                Avancado
              </button>
            </>
          )}
        </div>
        <div className="pe-toolbar-right">
          <button className="btn btn-secondary" onClick={handleShowFileTree} style={{ fontSize: 12 }} disabled={!sourceUrl || loadingTree}>
            {loadingTree ? 'Carregando...' : 'Arquivos'}
          </button>
          <button className="btn btn-primary" onClick={extractHtml} style={{ fontSize: 12 }}>
            Extrair HTML
          </button>
        </div>
      </div>

      <div className="pe-workspace">
        <div className="pe-canvas">
          {!editMode && (
            <div className="pe-canvas-hint">
              <p>Clique em "Editar" para comecar a editar a pagina visualmente.</p>
            </div>
          )}
          <iframe ref={iframeRef} className="pe-iframe" title="Page Editor" sandbox="allow-same-origin allow-scripts allow-forms" />
        </div>

        {editMode && selectedElement && (
          <div className="pe-sidebar">
            <div className="pe-sidebar-header">
              <span style={{ fontWeight: 600, fontSize: 13 }}>{selectedElement.tag}</span>
              {selectedElement.id && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>#{selectedElement.id}</span>}
              <button className="btn btn-secondary" onClick={removeElement} style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 11, color: 'var(--danger)' }}>
                Remover
              </button>
            </div>

            <div className="pe-sidebar-selector">{selectedElement.selector}</div>

            <details open className="pe-section">
              <summary>Texto</summary>
              <div className="pe-section-body">
                <div className="pe-prop-row">
                  <label>Conteudo</label>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <textarea rows={3} value={draftText ?? selectedElement.text} onChange={e => setDraftText(e.target.value)} onBlur={() => { if (draftText !== null) updateText(draftText); setDraftText(null) }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); applyText() } }} />
                    <button className="btn btn-primary" onClick={applyText} style={{ fontSize: 11, padding: '2px 10px', marginTop: 4, alignSelf: 'flex-end' }}>Aplicar</button>
                  </div>
                </div>
                {renderStyleInput('Cor', 'color', 'color')}
                {renderStyleInput('Tamanho', 'fontSize')}
                {renderStyleInput('Peso', 'fontWeight', 'text', ['100','200','300','400','500','600','700','800','900'])}
                {renderStyleInput('Alinhamento', 'textAlign', 'text', ['left','center','right','justify'])}
                {renderStyleInput('Font', 'fontFamily')}
                {renderStyleInput('Altura linha', 'lineHeight')}
              </div>
            </details>

            <details open className="pe-section">
              <summary>Fundo</summary>
              <div className="pe-section-body">
                {renderStyleInput('Cor', 'backgroundColor', 'color')}
                {renderStyleInput('Opacidade', 'opacity', 'number')}
              </div>
            </details>

            {selectedElement.isImage && (
              <details open className="pe-section">
                <summary>Imagem</summary>
                <div className="pe-section-body">
                  <div className="pe-prop-row">
                    <label>URL</label>
                    <input type="text" value={selectedElement.imageSrc} onChange={e => updateAttr('src', e.target.value)} />
                  </div>
                  <div className="pe-prop-row">
                    <label>Alt</label>
                    <input type="text" value={selectedElement.imageAlt} onChange={e => updateAttr('alt', e.target.value)} />
                  </div>
                  {renderStyleInput('Object-fit', 'objectFit', 'text', ['cover','contain','fill','none','scale-down'])}
                </div>
              </details>
            )}

            <details className="pe-section">
              <summary>Espacamento</summary>
              <div className="pe-section-body">
                {renderStyleInput('Padding', 'padding')}
                {renderStyleInput('Margin', 'margin')}
                {renderStyleInput('Largura', 'width')}
                {renderStyleInput('Altura', 'height')}
                {renderStyleInput('Gap', 'gap')}
              </div>
            </details>

            <details className="pe-section">
              <summary>Borda</summary>
              <div className="pe-section-body">
                {renderStyleInput('Largura', 'borderWidth')}
                {renderStyleInput('Cor', 'borderColor', 'color')}
                {renderStyleInput('Raio', 'borderRadius')}
                {renderStyleInput('Estilo', 'border', 'text', ['none','solid 1px','solid 2px','solid 3px','dashed 1px','dashed 2px','dotted 1px','dotted 2px'])}
              </div>
            </details>

            <details className="pe-section">
              <summary>Layout</summary>
              <div className="pe-section-body">
                {renderStyleInput('Display', 'display', 'text', ['block','flex','grid','inline','inline-block','none'])}
                {renderStyleInput('Position', 'position', 'text', ['static','relative','absolute','fixed','sticky'])}
                {renderStyleInput('Flex direction', 'flexDirection', 'text', ['row','column','row-reverse','column-reverse'])}
                {renderStyleInput('Justify', 'justifyContent', 'text', ['flex-start','center','flex-end','space-between','space-around'])}
                {renderStyleInput('Align', 'alignItems', 'text', ['flex-start','center','flex-end','stretch'])}
                {renderStyleInput('Overflow', 'overflow', 'text', ['visible','hidden','scroll','auto'])}
                {renderStyleInput('Z-index', 'zIndex')}
              </div>
            </details>

            {showAdvanced && (
              <details open className="pe-section">
                <summary>Avancado (HTML direto)</summary>
                <div className="pe-section-body">
                  <div className="pe-prop-row">
                    <label>ID</label>
                    <input type="text" value={selectedElement.id} onChange={e => updateAttr('id', e.target.value)} />
                  </div>
                  <div className="pe-prop-row">
                    <label>Classes</label>
                    <input type="text" value={selectedElement.classes.join(' ')} onChange={e => updateAttr('class', e.target.value)} />
                  </div>
                  <div className="pe-prop-row" style={{ gridColumn: '1/-1' }}>
                    <label>HTML interno</label>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <textarea rows={6} value={draftHtml ?? selectedElement.html} onChange={e => setDraftHtml(e.target.value)} onBlur={() => { if (draftHtml !== null) sendToIframe('__metaEditorUpdateHtml', draftHtml); setDraftHtml(null) }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); applyHtml() } }} />
                      <button className="btn btn-primary" onClick={applyHtml} style={{ fontSize: 11, padding: '2px 10px', marginTop: 4, alignSelf: 'flex-end' }}>Aplicar</button>
                    </div>
                  </div>
                </div>
              </details>
            )}
          </div>
        )}

        {editMode && showWidgets && (
          <div className="pe-widgets-panel">
            <div className="pe-sidebar-header">
              <span style={{ fontWeight: 600, fontSize: 13 }}>Widgets</span>
              <button className="btn btn-secondary" onClick={() => setShowWidgets(false)} style={{ padding: '2px 8px', fontSize: 11 }}>X</button>
            </div>
            <div className="pe-widgets-grid">
              {WIDGETS.map(w => (
                <button key={w.id} className="pe-widget-btn" onClick={() => insertWidget(w)} title={w.label}>
                  <span className="pe-widget-icon">{w.icon}</span>
                  <span className="pe-widget-label">{w.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showFileTree && (
          <div className="pe-file-tree-panel">
            <div className="pe-file-tree-header">
              <span style={{ fontWeight: 600, fontSize: 13 }}>Arquivos</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {cloneId && <button className="btn btn-primary" onClick={downloadZip} style={{ fontSize: 11, padding: '2px 10px' }}>ZIP</button>}
                <button className="btn btn-secondary" onClick={() => setShowFileTree(false)} style={{ padding: '2px 8px', fontSize: 11 }}>X</button>
              </div>
            </div>
            {loadingTree && <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>Clonando pagina e baixando recursos...</div>}
            {treeError && <div style={{ padding: 16, fontSize: 12, color: 'var(--danger)' }}>{treeError}</div>}
            {fileTreeData && (
              <div className="pe-file-tree-body">
                {fileTreeData.map((node: any) => <FileTreeNode key={node.path} node={node} cloneId={cloneId} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
