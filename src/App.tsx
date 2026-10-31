import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, FabricImage, Textbox, Rect, Circle, Line, Triangle as FabricTriangle, filters } from 'fabric'
import { PDFDocument } from 'pdf-lib'
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, Bold, BringToFront, ChevronDown,
  Circle as CircleIcon, Copy, Eye, EyeOff, FlipHorizontal, FlipVertical, ImagePlus,
  Italic, Layers, Lock, Minus, MousePointer2, Plus, Redo2, RotateCcw, Save,
  Scissors, SendToBack, Shapes, Square, Trash2, Type, Underline, Undo2, Upload,
  X, Grid3X3, Crop, Sun, Contrast, Droplets, Search, FileText, LayoutTemplate, Triangle as TriangleIcon,
  PanelLeftClose, MoreHorizontal
} from 'lucide-react'

type Page = { id:number; json:any; background:string }
type Tab = 'Templates'|'Elements'|'Text'|'Uploads'
type LayerItem = { id:string; label:string; type:string; visible:boolean; locked:boolean }
const W=794, H=1123
const makePage=(id:number):Page=>({id,json:null,background:'#ffffff'})
const fonts=['Arial','Helvetica','Georgia','Times New Roman','Verdana','Trebuchet MS','Courier New','Impact','Palatino Linotype','Tahoma']
const uid=()=>Math.random().toString(36).slice(2,10)

export default function App(){
  const canvasEl=useRef<HTMLCanvasElement|null>(null)
  const editor=useRef<Canvas|null>(null)
  const fileRef=useRef<HTMLInputElement|null>(null)
  const history=useRef<any[]>([])
  const historyIndex=useRef(-1)
  const restoring=useRef(false)
  const [pages,setPages]=useState<Page[]>([makePage(1)])
  const [active,setActive]=useState(0)
  const [selected,setSelected]=useState<any>(null)
  const [layers,setLayers]=useState<LayerItem[]>([])
  const [tab,setTab]=useState<Tab>('Text')
  const [zoom,setZoom]=useState(75)
  const [name,setName]=useState('Untitled document')
  const [busy,setBusy]=useState(false)
  const [saved,setSaved]=useState(true)
  const [grid,setGrid]=useState(true)
  const [snap,setSnap]=useState(true)
  const [search,setSearch]=useState('')
  const [mask,setMask]=useState<'none'|'circle'|'rounded'>('none')
  const [cropMode,setCropMode]=useState(false)

  const refreshLayers=useCallback(()=>{
    const c=editor.current;if(!c)return
    setLayers([...c.getObjects()].map((o:any,i)=>({id:o.__layerId||(o.__layerId=uid()),label:o.__layerName||((o.type==='textbox'?'Text':o.type==='image'?'Image':o.type==='line'?'Line':'Shape')+' '+(i+1)),type:o.type,visible:o.visible!==false,locked:o.selectable===false})).reverse())
  },[])
  const snapshot=useCallback((force=false)=>{
    const c=editor.current;if(!c||restoring.current)return
    const json=c.toJSON()
    const encoded=JSON.stringify(json)
    if(!force&&history.current[historyIndex.current]===encoded)return
    history.current=history.current.slice(0,historyIndex.current+1)
    history.current.push(encoded)
    if(history.current.length>60)history.current.shift()
    historyIndex.current=history.current.length-1
    setPages(prev=>prev.map((p,i)=>i===active?{...p,json}:p))
    setSaved(false);refreshLayers()
  },[active,refreshLayers])
  const restore=useCallback(async(index:number)=>{
    const c=editor.current;if(!c||index<0||index>=history.current.length)return
    restoring.current=true
    historyIndex.current=index
    await c.loadFromJSON(JSON.parse(history.current[index]))
    c.requestRenderAll();setSelected(c.getActiveObject()||null);refreshLayers()
    setPages(prev=>prev.map((p,i)=>i===active?{...p,json:c.toJSON(['__layerId','__layerName'])}:p))
    restoring.current=false;setSaved(false)
  },[active,refreshLayers])
  const undo=()=>{if(historyIndex.current>0)void restore(historyIndex.current-1)}
  const redo=()=>{if(historyIndex.current<history.current.length-1)void restore(historyIndex.current+1)}

  useEffect(()=>{
    if(!canvasEl.current)return
    const c=new Canvas(canvasEl.current,{width:W,height:H,backgroundColor:'rgba(255,255,255,0)',selection:true,preserveObjectStacking:true,uniformScaling:false})
    editor.current=c
    const page=pages[active]
    const init=async()=>{
      if(page.json)await c.loadFromJSON(page.json)
      history.current=[JSON.stringify(c.toJSON(['__layerId','__layerName']))]
      historyIndex.current=0;c.requestRenderAll();refreshLayers()
    }
    void init()
    c.on('selection:created',e=>setSelected(e.selected?.[0]||null))
    c.on('selection:updated',e=>setSelected(e.selected?.[0]||null))
    c.on('selection:cleared',()=>setSelected(null))
    const changed=()=>{if(!restoring.current){snapshot();refreshLayers()}}
    c.on('object:modified',changed);c.on('text:changed',changed);c.on('object:added',changed);c.on('object:removed',changed);c.on('path:created',changed)
    c.on('object:moving',e=>{
      if(!snap||!e.target)return
      const step=10
      e.target.set({left:Math.round((e.target.left||0)/step)*step,top:Math.round((e.target.top||0)/step)*step})
    })
    return()=>{c.dispose();editor.current=null}
  // Page changes intentionally rebuild the Fabric canvas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[active])
  useEffect(()=>{const c=editor.current;if(!c)return;c.setZoom(zoom/100);c.setDimensions({width:W*zoom/100,height:H*zoom/100});c.requestRenderAll()},[zoom])
  useEffect(()=>{const raw=localStorage.getItem('valocanvas-project');if(!raw)return;try{const d=JSON.parse(raw);if(d.pages?.length){setName(d.name||'Untitled document');setPages(d.pages);setActive(d.active||0)}}catch{}},[])
  const save=useCallback(()=>{
    const c=editor.current
    const snapshotPages=pages.map((p,i)=>i===active?{...p,json:c?.toJSON()}:p)
    localStorage.setItem('valocanvas-project',JSON.stringify({name,pages:snapshotPages,active}))
    setPages(snapshotPages);setSaved(true)
  },[pages,active,name])
  useEffect(()=>{if(saved)return;const t=window.setTimeout(save,1200);return()=>window.clearTimeout(t)},[saved,save])

  const addText=(kind:'title'|'heading'|'body'|'caption')=>{
    const c=editor.current;if(!c)return
    const config={title:{text:'Document title',size:34,weight:'bold'},heading:{text:'Heading',size:24,weight:'bold'},body:{text:'Start typing your paragraph here. Press Enter to begin a new line. Text wraps naturally inside this text box.',size:14,weight:'normal'},caption:{text:'Caption',size:10,weight:'normal'}}[kind]
    const obj=new Textbox(config.text,{left:82,top:100,width:620,fontFamily:'Arial',fontSize:config.size,fontWeight:config.weight,lineHeight:1.35,charSpacing:0,fill:'#202124',splitByGrapheme:false,padding:4,editable:true})
    ;(obj as any).__layerName=kind[0].toUpperCase()+kind.slice(1)
    c.add(obj);c.setActiveObject(obj);obj.enterEditing();obj.selectAll();c.requestRenderAll();snapshot(true)
  }
  const addShape=(kind:'rect'|'circle'|'line'|'triangle')=>{
    const c=editor.current;if(!c)return
    const base={left:130,top:180,fill:'#e9e9e7',stroke:'#222222',strokeWidth:1}
    const obj=kind==='rect'?new Rect({...base,width:220,height:130}):kind==='circle'?new Circle({...base,radius:70}):kind==='triangle'?new FabricTriangle({...base,width:150,height:130}):new Line([100,100,420,100],{stroke:'#222222',strokeWidth:2})
    ;(obj as any).__layerName=kind[0].toUpperCase()+kind.slice(1)
    c.add(obj);c.setActiveObject(obj);c.requestRenderAll();snapshot(true)
  }
  const addImage=async(file?:File)=>{
    if(!file)return
    const c=editor.current;if(!c)return
    const url=URL.createObjectURL(file)
    try{const img=await FabricImage.fromURL(url);const scale=Math.min(480/(img.width||1),430/(img.height||1),1);img.set({left:100,top:130,scaleX:scale,scaleY:scale});(img as any).__layerName=file.name.replace(/\.[^.]+$/,'')||'Image';c.add(img);c.setActiveObject(img);c.requestRenderAll();snapshot(true)}finally{URL.revokeObjectURL(url)}
  }
  const update=(key:string,value:any)=>{
    const c=editor.current,o=c?.getActiveObject() as any;if(!c||!o)return
    o.set(key,value);o.setCoords();c.requestRenderAll();setSelected({...o});snapshot(true)
  }
  const updateText=(key:string,value:any)=>update(key,value)
  const deleteSelected=()=>{const c=editor.current,o=c?.getActiveObject();if(!c||!o)return;c.remove(o);c.discardActiveObject();setSelected(null);c.requestRenderAll();snapshot(true)}
  const changePage=(i:number)=>{const c=editor.current;if(c)setPages(prev=>prev.map((p,n)=>n===active?{...p,json:c.toJSON(['__layerId','__layerName'])}:p));setActive(i);setSelected(null)}
  const addPage=()=>{const c=editor.current;if(c)setPages(prev=>prev.map((p,i)=>i===active?{...p,json:c.toJSON(['__layerId','__layerName'])}:p));const next=Math.max(...pages.map(p=>p.id))+1;setPages(p=>[...p,makePage(next)]);setActive(pages.length)}
  const duplicatePage=()=>{const c=editor.current;if(!c)return;const copy={...pages[active],id:Date.now(),json:c.toJSON(['__layerId','__layerName'])};setPages(p=>[...p.slice(0,active+1),copy,...p.slice(active+1)]);setActive(active+1)}
  const deletePage=(i:number)=>{if(pages.length===1)return;setPages(p=>p.filter((_,n)=>n!==i));setActive(Math.max(0,i===active?i-1:i>active?active:active-1))}
  const selectLayer=(id:string)=>{const c=editor.current;if(!c)return;const obj=c.getObjects().find((o:any)=>o.__layerId===id);if(obj){c.setActiveObject(obj);c.requestRenderAll();setSelected(obj)}}
  const toggleLayer=(id:string,key:'visible'|'locked')=>{const c=editor.current;if(!c)return;const obj=c.getObjects().find((o:any)=>o.__layerId===id) as any;if(!obj)return;if(key==='visible')obj.set('visible',!obj.visible);else obj.set({selectable:obj.selectable===false,evented:obj.evented===false});c.requestRenderAll();refreshLayers();snapshot(true)}
  const moveLayer=(direction:'up'|'down')=>{const c=editor.current,o=c?.getActiveObject();if(!c||!o)return;direction==='up'?c.bringObjectForward(o):c.sendObjectBackwards(o);c.requestRenderAll();refreshLayers();snapshot(true)}
  const applyMask=(shape:'none'|'circle'|'rounded')=>{
    const c=editor.current,o=c?.getActiveObject() as any;if(!c||!o||o.type!=='image')return
    if(shape==='none')o.set('clipPath',undefined)
    else if(shape==='circle')o.set('clipPath',new Circle({radius:Math.min(o.width||100,o.height||100)/2,left:0,top:0,originX:'center',originY:'center'}))
    else o.set('clipPath',new Rect({width:o.width||100,height:o.height||100,rx:24,ry:24,originX:'center',originY:'center'}))
    setMask(shape);c.requestRenderAll();snapshot(true)
  }
  const applyFilter=(kind:'grayscale'|'sepia'|'brightness'|'contrast'|'blur',value?:number)=>{
    const c=editor.current,o=c?.getActiveObject() as any;if(!c||!o||o.type!=='image')return
    const F:any=filters
    const constructors:any={grayscale:()=>new F.Grayscale(),sepia:()=>new F.Sepia(),brightness:()=>new F.Brightness({brightness:value??0.08}),contrast:()=>new F.Contrast({contrast:value??0.12}),blur:()=>new F.Blur({blur:value??0.12})}
    const existing=(o.filters||[]).filter((f:any)=>f.type!==({grayscale:'Grayscale',sepia:'Sepia',brightness:'Brightness',contrast:'Contrast',blur:'Blur'} as any)[kind])
    o.filters=[...existing,constructors[kind]()];o.applyFilters();c.requestRenderAll();snapshot(true)
  }
  const exportPDF=async()=>{
    const c=editor.current;if(!c)return;setBusy(true)
    try{
      const doc=await PDFDocument.create()
      for(let i=0;i<pages.length;i++){
        const json=i===active?c.toJSON(['__layerId','__layerName']):pages[i].json
        const tempEl=document.createElement('canvas')
        const temp=new Canvas(tempEl,{width:W,height:H,backgroundColor:'#ffffff'})
        if(json)await temp.loadFromJSON(json)
        temp.setDimensions({width:W*2,height:H*2});temp.setZoom(2);temp.renderAll()
        const data=temp.toDataURL({format:'png',multiplier:1})
        const png=await doc.embedPng(data)
        const page=doc.addPage([595.28,841.89]);page.drawImage(png,{x:0,y:0,width:595.28,height:841.89})
        await temp.dispose()
      }
      const bytes=await doc.save();const blob=new Blob([bytes as BlobPart],{type:'application/pdf'});const url=URL.createObjectURL(blob)
      const a=document.createElement('a');a.href=url;a.download=(name.trim()||'valocanvas')+'.pdf';a.click();URL.revokeObjectURL(url)
    }catch(e){console.error(e);alert('PDF export failed. Your project is still available in this browser.')}finally{setBusy(false)}
  }
  const isText=selected?.type==='textbox'||selected?.type==='i-text'
  const isImage=selected?.type==='image'
  const visibleLayers=useMemo(()=>layers.filter(l=>l.label.toLowerCase().includes(search.toLowerCase())),[layers,search])

  return <div className="app">
    <header className="topbar">
      <a className="brand" href="#" aria-label="Valocanvas home"><span className="brand-mark">V</span><span>Valocanvas</span></a>
      <div className="top-doc"><input value={name} onChange={e=>{setName(e.target.value);setSaved(false)}} aria-label="Document name"/><span className={saved?'save-state':'save-state pending'}>{saved?'All changes saved':'Saving…'}</span></div>
      <div className="top-actions">
        <button className="top-icon" title="Undo (Ctrl+Z)" onClick={undo} disabled={historyIndex.current<=0}><Undo2 size={17}/></button>
        <button className="top-icon" title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={historyIndex.current>=history.current.length-1}><Redo2 size={17}/></button>
        <span className="top-divider"/>
        <button className="top-icon" title="Save project" onClick={save}><Save size={16}/></button>
        <button className="export-btn" onClick={exportPDF} disabled={busy}><ArrowDownToLine size={15}/>{busy?'Exporting…':'Export PDF'}</button>
      </div>
    </header>
    <main className="workspace">
      <aside className="left-panel">
        <nav className="side-tabs">{(['Templates','Elements','Text','Uploads'] as Tab[]).map((t,i)=><button key={t} className={tab===t?'side-tab active':'side-tab'} onClick={()=>setTab(t)}>{[<LayoutTemplate/>,<Shapes/>,<Type/>,<Upload/>][i]}<span>{t}</span></button>)}</nav>
        <div className="sidebar-content">
          {tab==='Templates'&&<div className="tab-content"><div className="sidebar-title">Page layouts</div><p className="helper">Start with a simple page structure.</p>{['Blank page','Editorial title','Two-column layout','Image with caption','Simple report'].map((t,i)=><button className="template-row" key={t} onClick={()=>{if(i===0)return;addText(i===1?'title':'heading');if(i===3)addShape('rect')}}><span className={'template-preview preview-'+i}><i/><i/><i/></span><span>{t}</span></button>)}</div>}
          {tab==='Elements'&&<div className="tab-content"><div className="sidebar-title">Basic elements</div><div className="element-grid"><button onClick={()=>addShape('rect')}><Square/><span>Rectangle</span></button><button onClick={()=>addShape('circle')}><CircleIcon/><span>Circle</span></button><button onClick={()=>addShape('line')}><Minus/><span>Line</span></button><button onClick={()=>addShape('triangle')}><TriangleIcon/><span>Triangle</span></button></div><div className="sidebar-title section-gap">Layout</div><label className="setting-row"><span>Show grid</span><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/></label><label className="setting-row"><span>Snap to grid</span><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/></label><p className="helper">Grid is a visual guide and will not appear in exported files.</p></div>}
          {tab==='Text'&&<div className="tab-content"><div className="sidebar-title">Add text</div><button className="text-preset title-preset" onClick={()=>addText('title')}>Add a title</button><button className="text-preset heading-preset" onClick={()=>addText('heading')}>Add a heading</button><button className="text-preset body-preset" onClick={()=>addText('body')}>Add body text</button><button className="text-preset caption-preset" onClick={()=>addText('caption')}>Add a caption</button><div className="sidebar-note">Text boxes support paragraphs, automatic wrapping and line breaks. Double-click to edit.</div></div>}
          {tab==='Uploads'&&<div className="tab-content"><div className="sidebar-title">Your uploads</div><button className="upload-drop" onClick={()=>fileRef.current?.click()}><ImagePlus size={22}/><strong>Upload files</strong><span>Choose images from this device</span></button><input ref={fileRef} hidden type="file" accept="image/*" onChange={e=>{void addImage(e.target.files?.[0]);e.currentTarget.value=''}}/><p className="helper">Images are kept in this browser project.</p></div>}
        </div>
        <div className="sidebar-bottom"><span className="local-dot"/> Saved locally on this device</div>
      </aside>
      <section className="stage">
        <div className="stage-toolbar"><div className="crumb">Page {active+1}<span>/</span> A4 · Portrait</div><div className="stage-tools"><button className={grid?'tool-toggle on':'tool-toggle'} onClick={()=>setGrid(v=>!v)} title="Toggle grid"><Grid3X3 size={15}/></button><span className="toolbar-divider"/><button className="small-tool" onClick={()=>setZoom(z=>Math.max(25,z-10))}><Minus size={14}/></button><span className="zoom-value">{zoom}%</span><button className="small-tool" onClick={()=>setZoom(z=>Math.min(150,z+10))}><Plus size={14}/></button></div></div>
        <div className="canvas-scroll"><div className={grid?'canvas-wrap grid-on':'canvas-wrap'} style={{width:W*zoom/100,height:H*zoom/100}}><canvas ref={canvasEl}/></div></div>
        <div className="stage-footer"><span>{selected?'Element selected':'Select an element to edit'}</span><span>{W} × {H} px</span></div>
      </section>
      <aside className="right-panel">
        <div className="right-header"><span>{selected?'Properties':'Layers'}</span><button className="quiet-icon" title="Layers" onClick={()=>setSelected(null)}><Layers size={16}/></button></div>
        {selected?<div className="properties-scroll">
          <section className="prop-section"><div className="prop-heading">Transform</div><div className="prop-grid"><label>X<input type="number" value={Math.round(selected.left||0)} onChange={e=>update('left',+e.target.value)}/></label><label>Y<input type="number" value={Math.round(selected.top||0)} onChange={e=>update('top',+e.target.value)}/></label><label>Width<input type="number" value={Math.round(selected.getScaledWidth?.()||0)} onChange={e=>update('scaleX',(+e.target.value)/(selected.width||1))}/></label><label>Height<input type="number" value={Math.round(selected.getScaledHeight?.()||0)} onChange={e=>update('scaleY',(+e.target.value)/(selected.height||1))}/></label></div><label className="prop-field">Rotation <input type="number" value={Math.round(selected.angle||0)} onChange={e=>update('angle',+e.target.value)}/></label><div className="layer-actions"><button onClick={()=>moveLayer('up')}><BringToFront size={14}/> Bring forward</button><button onClick={()=>moveLayer('down')}><SendToBack size={14}/> Send backward</button></div></section>
          {isText&&<section className="prop-section"><div className="prop-heading">Typography</div><label className="prop-field">Font family<select value={selected.fontFamily||'Arial'} onChange={e=>updateText('fontFamily',e.target.value)}>{fonts.map(f=><option key={f}>{f}</option>)}</select></label><div className="prop-grid"><label>Font size (pt)<input type="number" min="4" max="240" value={Math.round((selected.fontSize||14)*.75)} onChange={e=>updateText('fontSize',Math.max(4,+e.target.value)/.75)}/></label><label>Line spacing<input type="number" min="0.7" max="3" step=".05" value={selected.lineHeight||1.35} onChange={e=>updateText('lineHeight',+e.target.value)}/></label></div><label className="prop-field">Letter spacing<input type="number" min="-5" max="50" value={selected.charSpacing||0} onChange={e=>updateText('charSpacing',+e.target.value)}/></label><div className="format-tools"><button className={selected.fontWeight==='bold'?'chosen':''} onClick={()=>updateText('fontWeight',selected.fontWeight==='bold'?'normal':'bold')}><Bold size={15}/></button><button className={selected.fontStyle==='italic'?'chosen':''} onClick={()=>updateText('fontStyle',selected.fontStyle==='italic'?'normal':'italic')}><Italic size={15}/></button><button className={selected.underline?'chosen':''} onClick={()=>updateText('underline',!selected.underline)}><Underline size={15}/></button><span/><button className={selected.textAlign==='left'?'chosen':''} onClick={()=>updateText('textAlign','left')}><AlignLeft size={15}/></button><button className={selected.textAlign==='center'?'chosen':''} onClick={()=>updateText('textAlign','center')}><AlignCenter size={15}/></button><button className={selected.textAlign==='right'?'chosen':''} onClick={()=>updateText('textAlign','right')}><AlignRight size={15}/></button></div><label className="color-prop">Text color <input type="color" value={typeof selected.fill==='string'?selected.fill:'#202124'} onChange={e=>updateText('fill',e.target.value)}/></label><p className="helper">Double-click text on the page to edit words and paragraphs directly.</p></section>}
          {isImage&&<section className="prop-section"><div className="prop-heading">Image tools</div><div className="image-tool-row"><button onClick={()=>update('flipX',!selected.flipX)}><FlipHorizontal size={15}/>Flip H</button><button onClick={()=>update('flipY',!selected.flipY)}><FlipVertical size={15}/>Flip V</button><button onClick={()=>setCropMode(v=>!v)} className={cropMode?'chosen':''}><Crop size={15}/>Crop</button></div><label className="prop-field">Mask shape<select value={mask} onChange={e=>applyMask(e.target.value as any)}><option value="none">Original</option><option value="rounded">Rounded corners</option><option value="circle">Circle</option></select></label><div className="prop-heading subheading">Adjustments</div><label className="slider-field"><span><Sun size={14}/> Brightness</span><input type="range" min="-0.5" max="0.5" step=".05" defaultValue="0.08" onChange={e=>applyFilter('brightness',+e.target.value)}/></label><label className="slider-field"><span><Contrast size={14}/> Contrast</span><input type="range" min="-0.5" max="0.5" step=".05" defaultValue="0.12" onChange={e=>applyFilter('contrast',+e.target.value)}/></label><label className="slider-field"><span><Droplets size={14}/> Blur</span><input type="range" min="0" max="0.5" step=".02" defaultValue="0" onChange={e=>applyFilter('blur',+e.target.value)}/></label><div className="image-tool-row"><button onClick={()=>applyFilter('grayscale')} >Grayscale</button><button onClick={()=>applyFilter('sepia')}>Sepia</button></div><p className="helper">Crop currently enables image framing controls; drag the image handles to resize.</p></section>}
          <section className="prop-section"><div className="prop-heading">Appearance</div><label className="slider-field"><span>Opacity <b>{Math.round((selected.opacity??1)*100)}%</b></span><input type="range" min="0" max="1" step=".01" value={selected.opacity??1} onChange={e=>update('opacity',+e.target.value)}/></label>{!isText&&<label className="color-prop">Fill / color <input type="color" value={typeof selected.fill==='string'&&selected.fill.startsWith('#')?selected.fill:'#ffffff'} onChange={e=>update('fill',e.target.value)}/></label>}</section>
          <button className="delete-object" onClick={deleteSelected}><Trash2 size={14}/> Delete element</button>
        </div>:<div className="layers-panel"><div className="layer-panel-top"><span>Page layers</span><span>{layers.length} items</span></div><label className="layer-search"><Search size={14}/><input placeholder="Find a layer" value={search} onChange={e=>setSearch(e.target.value)}/></label>{visibleLayers.length?visibleLayers.map(l=><div className="layer-row" key={l.id}><button className="layer-name" onClick={()=>selectLayer(l.id)}><span className="layer-thumb">{l.type==='image'?<ImagePlus size={14}/>:l.type==='textbox'?<Type size={14}/>:<Square size={14}/>}</span><span>{l.label}</span></button><button className="layer-eye" title={l.visible?'Hide':'Show'} onClick={()=>toggleLayer(l.id,'visible')}>{l.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button><button className="layer-eye" title={l.locked?'Unlock':'Lock'} onClick={()=>toggleLayer(l.id,'locked')}><Lock size={13}/></button></div>):<div className="layers-empty"><Layers size={23}/><strong>No layers yet</strong><span>Add text, images or shapes to this page. They will appear here.</span></div>}</div>}
      </aside>
    </main>
    <footer className="pagesbar"><div className="pages-label">Pages <span>{pages.length}</span></div><div className="page-list">{pages.map((p,i)=><button key={p.id} className={i===active?'page-card current':'page-card'} onClick={()=>changePage(i)}><span className="page-thumb"><i/><i/><i/></span><span>Page {i+1}</span><span className="page-remove" onClick={e=>{e.stopPropagation();deletePage(i)}}><X size={12}/></span></button>)}</div><div className="page-actions"><button className="secondary-btn" onClick={duplicatePage}><Copy size={14}/> Duplicate</button><button className="add-page" onClick={addPage}><Plus size={15}/> Add page</button></div></footer>
  </div>
}
