import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, FabricImage, IText, Rect, Circle, Line } from 'fabric'
import { PDFDocument } from 'pdf-lib'
import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowLeft, ArrowRight, Bold, ChevronDown, Circle as CircleIcon, Copy, FileImage, FilePlus2, FileText, ImagePlus, Italic, Layers, Minus, MousePointer2, Plus, Redo2, RotateCcw, Save, Settings2, Shapes, Square, Trash2, Type, Underline, Undo2, Upload, X } from 'lucide-react'

type Page = { id: number; json: any; background: string }
const W = 794, H = 1123
const makePage = (id:number):Page => ({id,json:null,background:'#ffffff'})

export default function App() {
  const canvasEl = useRef<HTMLCanvasElement|null>(null)
  const editor = useRef<Canvas|null>(null)
  const fileRef = useRef<HTMLInputElement|null>(null)
  const [pages,setPages] = useState<Page[]>([makePage(1)])
  const [active,setActive] = useState(0)
  const [selected,setSelected] = useState<any>(null)
  const [zoom,setZoom] = useState(75)
  const [name,setName] = useState('Untitled design')
  const [fontSize,setFontSize] = useState(32)
  const [fontFamily,setFontFamily] = useState('Arial')
  const [textColor,setTextColor] = useState('#202124')
  const [busy,setBusy] = useState(false)
  const [saved,setSaved] = useState(true)

  const persistPage = useCallback(() => {
    const c = editor.current
    if (!c) return
    const json = c.toJSON()
    setPages(prev => prev.map((p,i)=>i===active?{...p,json}:p))
    setSaved(false)
  },[active])

  useEffect(() => {
    if (!canvasEl.current) return
    const c = new Canvas(canvasEl.current,{width:W,height:H,backgroundColor:'#ffffff',selection:true,preserveObjectStacking:true})
    editor.current = c
    const page = pages[active]
    if (page.json) c.loadFromJSON(page.json).then(()=>c.requestRenderAll())
    c.on('selection:created',e=>setSelected(e.selected?.[0] ?? null))
    c.on('selection:updated',e=>setSelected(e.selected?.[0] ?? null))
    c.on('selection:cleared',()=>setSelected(null))
    c.on('object:modified',persistPage)
    c.on('text:changed',persistPage)
    return ()=>{ c.dispose(); editor.current=null }
  // Canvas is intentionally recreated only when switching pages.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[active])

  useEffect(()=>{const c=editor.current;if(!c)return; c.setZoom(zoom/100);c.setDimensions({width:W*zoom/100,height:H*zoom/100});c.requestRenderAll()},[zoom])

  const save = () => { persistPage(); const snapshot = pages.map((p,i)=>i===active?{...p,json:editor.current?.toJSON()}:p); localStorage.setItem('valocanvas-project',JSON.stringify({name,pages:snapshot,active}));setSaved(true) }
  useEffect(()=>{const raw=localStorage.getItem('valocanvas-project');if(!raw)return;try{const d=JSON.parse(raw);if(d.pages?.length){setName(d.name||'Untitled design');setPages(d.pages);setActive(d.active||0)}}catch{}},[])
  useEffect(()=>{const t=setInterval(()=>{if(!saved)save()},12000);return()=>clearInterval(t)},[saved,pages,active,name])

  const addText = (kind:'heading'|'subheading'|'body'='heading') => {
    const c=editor.current;if(!c)return
    const sizes={heading:48,subheading:30,body:18}
    const text= new IText(kind==='heading'?'Add a heading':kind==='subheading'?'Add a subheading':'Start typing your text',{left:90,top:100,width:590,fontFamily,fontSize:sizes[kind],fill:textColor,fontWeight:kind==='heading'?'bold':'normal',editable:true})
    c.add(text);c.setActiveObject(text);c.requestRenderAll();persistPage()
  }
  const addShape = (shape:'rect'|'circle'|'line') => {
    const c=editor.current;if(!c)return
    const obj=shape==='rect'?new Rect({left:120,top:180,width:220,height:140,fill:'#e8efff',stroke:'#5278d0',strokeWidth:2,rx:8,ry:8}):shape==='circle'?new Circle({left:140,top:180,radius:70,fill:'#e8efff',stroke:'#5278d0',strokeWidth:2}):new Line([100,100,420,100],{stroke:'#202124',strokeWidth:3})
    c.add(obj);c.setActiveObject(obj);c.requestRenderAll();persistPage()
  }
  const addImage = async (file?:File) => {if(!file)return;const c=editor.current;if(!c)return;const url=URL.createObjectURL(file);const img=await FabricImage.fromURL(url);const scale=Math.min(420/img.width!,360/img.height!,1);img.set({left:100,top:140,scaleX:scale,scaleY:scale});c.add(img);c.setActiveObject(img);c.requestRenderAll();persistPage();URL.revokeObjectURL(url)}
  const changePage = (index:number) => {persistPage();setActive(index);setSelected(null)}
  const addPage = () => {persistPage();setPages(p=>[...p,makePage(Math.max(...p.map(x=>x.id))+1)]);setActive(pages.length)}
  const deletePage = (index:number) => {if(pages.length===1)return;const next=pages.filter((_,i)=>i!==index);setPages(next);setActive(Math.max(0,index-1))}
  const duplicatePage = () => {persistPage();const copy={...pages[active],id:Date.now(),json:editor.current?.toJSON()};const next=[...pages.slice(0,active+1),copy,...pages.slice(active+1)];setPages(next);setActive(active+1)}
  const updateSelected = (key:string,value:any) => {const c=editor.current;const o=c?.getActiveObject() as any;if(!o)return;o.set(key,value);o.setCoords();c?.requestRenderAll();persistPage();setSelected({...o})}
  const undo = () => {const c=editor.current;if(!c)return;const stack=(c as any).__undo||[];if(stack.length){c.loadFromJSON(stack.pop()).then(()=>c.requestRenderAll())}}
  const exportPDF = async () => {
    const c=editor.current;if(!c)return
    setBusy(true)
    try {
      persistPage()
      const doc=await PDFDocument.create()
      for(let i=0;i<pages.length;i++){
        let json=pages[i].json
        if(i===active)json=c.toJSON()
        const temp=document.createElement('canvas')
        const tempCanvas=new Canvas(temp,{width:W,height:H,backgroundColor:'#ffffff'})
        if(json)await tempCanvas.loadFromJSON(json)
        tempCanvas.setDimensions({width:W*2,height:H*2})
        tempCanvas.setZoom(2);tempCanvas.renderAll()
        const png=await doc.embedPng(tempCanvas.toDataURL({format:'png',multiplier:1}))
        const pdfPage=doc.addPage([595.28,841.89])
        pdfPage.drawImage(png,{x:0,y:0,width:595.28,height:841.89})
        await tempCanvas.dispose()
      }
      const bytes=await doc.save()
      const blob=new Blob([bytes as BlobPart],{type:'application/pdf'})
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(name.trim()||'valocanvas-design')+'.pdf';a.click();URL.revokeObjectURL(url)
    }catch(e){console.error(e);alert('PDF export failed. Your project remains saved locally.')}
    finally{setBusy(false)}
  }
  const removeSelected=()=>{const c=editor.current;const o=c?.getActiveObject();if(o){c?.remove(o);c?.discardActiveObject();c?.requestRenderAll();setSelected(null);persistPage()}}
  const undoAction=()=>{const c=editor.current;if(!c)return; (c as any).undo?.();c.requestRenderAll() }
  return <div className="app">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">V</span><span>valo<span className="brand-light">canvas</span></span></div>
      <div className="docname"><input value={name} onChange={e=>{setName(e.target.value);setSaved(false)}} aria-label="Document name"/><span className={saved?'saved':'unsaved'}>{saved?'Saved':'Unsaved changes'}</span></div>
      <div className="top-actions"><button className="icon-btn" title="Undo" onClick={undoAction}><Undo2 size={17}/></button><button className="icon-btn" title="Redo"><Redo2 size={17}/></button><button className="save-btn" onClick={save}><Save size={15}/> Save</button><button className="export-btn" onClick={exportPDF} disabled={busy}><ArrowDownToLine size={16}/>{busy?'Preparing PDF…':'Export PDF'}</button></div>
    </header>
    <main className="workspace">
      <aside className="left-panel">
        <div className="panel-heading">Create</div>
        <button className="tool-row active"><MousePointer2/><span>Select</span></button>
        <button className="tool-row" onClick={()=>addText('heading')}><Type/><span>Heading</span></button>
        <button className="tool-row" onClick={()=>addText('subheading')}><FileText/><span>Subheading</span></button>
        <button className="tool-row" onClick={()=>addText('body')}><AlignLeft/><span>Body text</span></button>
        <div className="panel-divider"/>
        <div className="panel-heading">Elements</div>
        <button className="tool-row" onClick={()=>addShape('rect')}><Square/><span>Rectangle</span></button>
        <button className="tool-row" onClick={()=>addShape('circle')}><CircleIcon/><span>Circle</span></button>
        <button className="tool-row" onClick={()=>addShape('line')}><Minus/><span>Line</span></button>
        <div className="panel-divider"/>
        <div className="panel-heading">Media</div>
        <button className="upload-tile" onClick={()=>fileRef.current?.click()}><ImagePlus/><strong>Upload image</strong><small>PNG, JPG, WEBP</small></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={e=>addImage(e.target.files?.[0])}/>
        <div className="panel-note">Your files stay on this device.</div>
      </aside>
      <section className="stage">
        <div className="stage-toolbar"><span className="page-label">Page {active+1} <span>·</span> A4 portrait</span><div className="zoom-tools"><button className="icon-btn" onClick={()=>setZoom(z=>Math.max(25,z-10))}><Minus size={15}/></button><span>{zoom}%</span><button className="icon-btn" onClick={()=>setZoom(z=>Math.min(150,z+10))}><Plus size={15}/></button></div></div>
        <div className="canvas-scroll"><div className="canvas-wrap" style={{width:W*zoom/100,height:H*zoom/100}}><canvas ref={canvasEl}/></div></div>
        <div className="stage-footer"><span><span className="status-dot"/> All changes are stored locally</span><span>794 × 1123 px</span></div>
      </section>
      <aside className="right-panel">
        <div className="right-title">Properties <Settings2 size={16}/></div>
        {selected ? <>
          <div className="property-section"><div className="section-title">Position & size</div><div className="field-grid"><label>X<input type="number" value={Math.round(selected.left||0)} onChange={e=>updateSelected('left',+e.target.value)}/></label><label>Y<input type="number" value={Math.round(selected.top||0)} onChange={e=>updateSelected('top',+e.target.value)}/></label><label>Width<input type="number" value={Math.round(selected.getScaledWidth?.()||0)} onChange={e=>updateSelected('scaleX',(+e.target.value)/(selected.width||1))}/></label><label>Height<input type="number" value={Math.round(selected.getScaledHeight?.()||0)} onChange={e=>updateSelected('scaleY',(+e.target.value)/(selected.height||1))}/></label></div><label className="full-field">Rotation <input type="number" value={Math.round(selected.angle||0)} onChange={e=>updateSelected('angle',+e.target.value)}/></label></div>
          {selected.type==='i-text'||selected.type==='textbox'?<div className="property-section"><div className="section-title">Typography</div><label className="full-field">Font family<select value={selected.fontFamily||'Arial'} onChange={e=>updateSelected('fontFamily',e.target.value)}><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option><option>Courier New</option></select></label><label className="full-field">Font size<input type="number" min="6" max="240" value={selected.fontSize||24} onChange={e=>updateSelected('fontSize',+e.target.value)}/></label><div className="format-row"><button onClick={()=>updateSelected('fontWeight',selected.fontWeight==='bold'?'normal':'bold')} className={selected.fontWeight==='bold'?'pressed':''}><Bold size={16}/></button><button onClick={()=>updateSelected('fontStyle',selected.fontStyle==='italic'?'normal':'italic')}><Italic size={16}/></button><button onClick={()=>updateSelected('underline',!selected.underline)}><Underline size={16}/></button></div><div className="format-row"><button onClick={()=>updateSelected('textAlign','left')}><AlignLeft size={16}/></button><button onClick={()=>updateSelected('textAlign','center')}><AlignCenter size={16}/></button><button onClick={()=>updateSelected('textAlign','right')}><AlignRight size={16}/></button></div><label className="color-field">Text color <input type="color" value={typeof selected.fill==='string'?selected.fill:'#202124'} onChange={e=>updateSelected('fill',e.target.value)}/></label></div>:null}
          <div className="property-section"><div className="section-title">Appearance</div><label className="full-field">Opacity <input type="range" min="0" max="1" step=".05" value={selected.opacity??1} onChange={e=>updateSelected('opacity',+e.target.value)}/></label><label className="color-field">Fill <input type="color" value={typeof selected.fill==='string'&&selected.fill.startsWith('#')?selected.fill:'#ffffff'} onChange={e=>updateSelected('fill',e.target.value)}/></label></div>
          <button className="delete-btn" onClick={removeSelected}><Trash2 size={15}/> Delete selected object</button>
        </>:<div className="empty-properties"><Layers size={24}/><strong>Nothing selected</strong><span>Select an element on your page to edit its properties.</span></div>}
      </aside>
    </main>
    <footer className="pagesbar"><div className="pages-heading">Pages <span>{pages.length}</span></div><div className="page-list">{pages.map((p,i)=><button key={p.id} className={'page-card '+(i===active?'current':'')} onClick={()=>changePage(i)}><span className="page-mini"><span/></span><span>Page {i+1}</span><span className="page-menu" onClick={e=>{e.stopPropagation();deletePage(i)}}><X size={12}/></span></button>)}</div><div className="page-actions"><button className="secondary-btn" onClick={duplicatePage}><Copy size={14}/> Duplicate</button><button className="add-page" onClick={addPage}><Plus size={16}/> Add page</button></div></footer>
  </div>
}