import { useEffect, useRef } from 'react';
import { type PageDocument, type Command, type LoopData, renderPage, findNode, parentOf, widgets, createNode } from './core';

interface Props {
  document: PageDocument;
  siteName: string;
  sitePhone: string;
  loops: LoopData;
  selected: string | null;
  select: (id: string | null) => void;
  command: (command: Command, group?: string) => void;
  width: number;
  zoom: number;
  editable: boolean;
  device?: string;
}

const initial = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Lato:wght@300;400;700&family=Montserrat:wght@300;400;500;600;700;800&family=Open+Sans:wght@300;400;500;600;700&family=Oswald:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&family=Tiro+Bangla:ital@0;1&display=swap"><link rel="stylesheet" href="/eicons/css/elementor-icons.min.css"><link rel="stylesheet" href="/font-awesome/css/all.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"><style id="page-css"></style><style>body{margin:0;min-height:100vh;background:#ffffff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif} figure{margin:0;padding:0} img{max-width:100%;height:auto} [data-builder-page]{min-height:100vh;padding-bottom:80px} [data-builder-id]{position:relative;min-height:12px} [data-builder-id]:hover{outline:1px dashed #58bcee;outline-offset:1px}[data-builder-selected]{outline:2px solid #58bcee!important;outline-offset:1px} [data-builder-drop]{box-shadow:inset 0 0 0 3px #58bcee!important} [data-builder-empty]{padding:30px;text-align:center;font:12px system-ui;color:#617a70;background:#f4f8f5;border:1px dashed #b8cbbf} [contenteditable=true]{outline:2px solid #58bcee;cursor:text} .elementor-add-section-area{margin:40px auto 60px;max-width:900px;padding:32px 20px;border:2px dashed #cbd5e1;border-radius:8px;text-align:center;background:rgba(248,250,252,0.6);transition:all 0.2s ease}.elementor-add-section-area:hover{border-color:#58bcee;background:rgba(240,249,255,0.8)}.elementor-add-section-btns{display:flex;justify-content:center;align-items:center;gap:14px;margin-bottom:12px}.elementor-add-section-btn{width:46px;height:46px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:transform 0.15s ease,box-shadow 0.15s ease}.elementor-add-section-btn:hover{transform:scale(1.1);box-shadow:0 4px 12px rgba(0,0,0,0.15)}.elementor-add-section-btn.add-container{background:#93003c;color:#ffffff}.elementor-add-section-btn.add-template{background:#23282d;color:#ffffff}.elementor-add-section-btn.add-ai{background:#f3e8ff;color:#9333ea}.elementor-add-section-btn.add-grid{background:#0284c7;color:#ffffff}.elementor-add-section-text{font-size:13px;color:#64748b;font-weight:500;font-family:system-ui,-apple-system,sans-serif}</style></head><body><div id="canvas-root"></div></body></html>';

export function Canvas(props: Props) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const cleanup = useRef<() => void>();

  const refresh = () => {
    const doc = iframe.current?.contentDocument;
    if (!doc) return;
    const { html, css } = renderPage(latest.current.document, {
      editor: true,
      siteName: latest.current.siteName,
      sitePhone: latest.current.sitePhone,
      loops: latest.current.loops
    });
    const addSectionHtml = latest.current.editable ? `
      <div class="elementor-add-section-area" data-add-section="true">
        <div class="elementor-add-section-btns">
          <button class="elementor-add-section-btn add-container" data-btn-action="add-container" title="Add Container"><i class="eicon-plus"></i></button>
          <button class="elementor-add-section-btn add-template" data-btn-action="add-template" title="Add Template Library"><i class="eicon-folder"></i></button>
          <button class="elementor-add-section-btn add-ai" data-btn-action="add-ai" title="AI Builder"><i class="eicon-sparkles"></i></button>
          <button class="elementor-add-section-btn add-grid" data-btn-action="add-grid" title="Add Grid Layout"><i class="eicon-apps"></i></button>
        </div>
        <div class="elementor-add-section-text">Drag widget here</div>
      </div>
    ` : '';
    const root = doc.getElementById('canvas-root');
    if (root) root.innerHTML = html + addSectionHtml;
    const style = doc.getElementById('page-css');
    if (style) style.textContent = css;
    if (latest.current.editable) {
      doc.querySelectorAll<HTMLElement>('[data-builder-id]:not([data-builder-owner])').forEach(el => {
        el.draggable = true;
      });
    }
    selectOutline();
  };

  const selectOutline = () => {
    const doc = iframe.current?.contentDocument;
    doc?.querySelectorAll('[data-builder-selected]').forEach(el => el.removeAttribute('data-builder-selected'));
    if (latest.current.selected) {
      doc?.querySelector(`[data-builder-id="${latest.current.selected}"]`)?.setAttribute('data-builder-selected', '');
    }
  };

  useEffect(refresh, [props.document, props.siteName, props.sitePhone, props.loops]);

  useEffect(() => {
    selectOutline();
    if (props.selected) {
      iframe.current?.contentDocument?.querySelector(`[data-builder-id="${props.selected}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [props.selected]);

  useEffect(() => () => cleanup.current?.(), []);

  const initialize = () => {
    cleanup.current?.();
    const doc = iframe.current?.contentDocument;
    if (!doc) return;
    refresh();

    const element = (target: EventTarget | null) => (target as Element | null)?.closest<HTMLElement>('[data-builder-id]');
    const idFor = (el?: HTMLElement | null) => el?.dataset.builderOwner || el?.dataset.builderId;

    const click = (event: MouseEvent) => {
      const actionBtn = (event.target as Element)?.closest<HTMLElement>('[data-btn-action]');
      if (actionBtn) {
        event.preventDefault();
        const actionType = actionBtn.dataset.btnAction;
        if (actionType === 'add-container') {
          const next = createNode('container');
          latest.current.command({ type: 'insert', node: next });
          latest.current.select(next.id);
        } else if (actionType === 'add-grid') {
          const next = createNode('grid');
          latest.current.command({ type: 'insert', node: next });
          latest.current.select(next.id);
        }
        return;
      }
      if ((event.target as Element)?.closest('[contenteditable=true]')) return;
      event.preventDefault();
      props.select(idFor(element(event.target)) || null);
    };

    const doubleClick = (event: MouseEvent) => {
      if (!latest.current.editable) return;
      const el = element(event.target);
      const id = idFor(el);
      if (!el || !id) return;
      const node = findNode(latest.current.document.rootNodes, id);
      if (
        !node ||
        node.locked ||
        node.bindings.text ||
        !['heading', 'text', 'paragraph', 'blockquote', 'code', 'badge', 'link', 'button', 'notice', 'text-editor'].includes(node.type)
      ) {
        return;
      }
      el.draggable = false;
      el.contentEditable = 'true';
      el.focus();
      const range = doc.createRange();
      range.selectNodeContents(el);
      doc.getSelection()?.removeAllRanges();
      doc.getSelection()?.addRange(range);
    };

    const blur = (event: FocusEvent) => {
      const el = event.target as HTMLElement;
      if (el.contentEditable !== 'true') return;
      el.contentEditable = 'false';
      el.draggable = true;
      const id = idFor(el);
      const node = id && findNode(latest.current.document.rootNodes, id);
      if (node) {
        latest.current.command(
          { type: 'update', id: node.id, patch: { props: { ...node.props, text: (el.textContent || '').slice(0, 20000) } } },
          `text:${node.id}`
        );
      }
    };

    const paste = (event: ClipboardEvent) => {
      const el = event.target as HTMLElement;
      if (el.contentEditable !== 'true') return;
      event.preventDefault();
      const selection = doc.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const text = doc.createTextNode(event.clipboardData?.getData('text/plain') || '');
      range.insertNode(text);
      range.setStartAfter(text);
      range.collapse(true);
    };

    const dragover = (event: DragEvent) => {
      if (!latest.current.editable) return;
      event.preventDefault();
      doc.querySelectorAll('[data-builder-drop]').forEach(el => el.removeAttribute('data-builder-drop'));
      element(event.target)?.setAttribute('data-builder-drop', '');
      if (event.clientY < 50) doc.defaultView?.scrollBy(0, -15);
      if (event.clientY > (doc.defaultView?.innerHeight || 0) - 50) doc.defaultView?.scrollBy(0, 15);
    };

    const drop = (event: DragEvent) => {
      event.preventDefault();
      doc.querySelectorAll('[data-builder-drop]').forEach(el => el.removeAttribute('data-builder-drop'));
      if (!latest.current.editable) return;
      const targetId = idFor(element(event.target));
      const target = targetId && findNode(latest.current.document.rootNodes, targetId);
      const place = targetId ? parentOf(latest.current.document.rootNodes, targetId) : undefined;
      const targetElement = element(event.target);
      const after = targetElement ? event.clientY > targetElement.getBoundingClientRect().top + targetElement.getBoundingClientRect().height / 2 : false;
      const destination = target && widgets.get(target.type)?.children
        ? { parentId: target.id }
        : place
          ? { parentId: place.parentId, index: place.index + (after ? 1 : 0) }
          : {};
      const type = event.dataTransfer?.getData('application/nix-widget');
      const id = event.dataTransfer?.getData('application/nix-node');
      if (type && widgets.get(type)) {
        const node = createNode(type);
        latest.current.command({ type: 'insert', node, ...destination });
        latest.current.select(node.id);
      } else if (id) {
        latest.current.command({ type: 'move', id, ...destination });
      }
    };

    const dragstart = (event: DragEvent) => {
      const id = idFor(element(event.target));
      if (!latest.current.editable || !id || (event.target as HTMLElement).contentEditable === 'true') {
        event.preventDefault();
        return;
      }
      event.dataTransfer?.setData('application/nix-node', id);
      latest.current.select(id);
    };

    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).contentEditable === 'true') {
        if (event.key === 'Escape') (event.target as HTMLElement).blur();
        return;
      }
      if (event.key === 'Escape') latest.current.select(null);
      const forwarded = new KeyboardEvent('keydown', {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        bubbles: true,
        cancelable: true
      });
      if (!window.dispatchEvent(forwarded)) event.preventDefault();
    };

    doc.addEventListener('click', click);
    doc.addEventListener('dblclick', doubleClick);
    doc.addEventListener('focusout', blur);
    doc.addEventListener('paste', paste);
    doc.addEventListener('dragstart', dragstart);
    doc.addEventListener('dragover', dragover);
    doc.addEventListener('drop', drop);
    doc.addEventListener('keydown', keydown);

    cleanup.current = () => {
      doc.removeEventListener('click', click);
      doc.removeEventListener('dblclick', doubleClick);
      doc.removeEventListener('focusout', blur);
      doc.removeEventListener('paste', paste);
      doc.removeEventListener('dragstart', dragstart);
      doc.removeEventListener('dragover', dragover);
      doc.removeEventListener('drop', drop);
      doc.removeEventListener('keydown', keydown);
    };
  };

  const isDesktop = !props.device || props.device === 'desktop';

  return (
    <div className={`studio-canvas-scroll ${isDesktop ? 'desktop' : 'device-preview'}`}>
      <div
        className="studio-canvas-size"
        style={
          isDesktop
            ? { width: '100%', height: '100%', minHeight: '100%' }
            : { width: props.width * props.zoom, height: `calc((100vh - 120px) * ${props.zoom})` }
        }
      >
        <iframe
          ref={iframe}
          title="Visual page canvas"
          sandbox="allow-same-origin"
          srcDoc={initial}
          onLoad={initialize}
          style={
            isDesktop
              ? { width: '100%', height: '100%', minHeight: '100%', transform: 'none' }
              : {
                  width: props.width,
                  height: 'calc(100vh - 120px)',
                  transform: `scale(${props.zoom})`,
                  transformOrigin: 'top center'
                }
          }
        />
      </div>
    </div>
  );
}
