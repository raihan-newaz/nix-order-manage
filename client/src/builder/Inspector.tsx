import { useState } from 'react';
import { MediaPicker } from '../components/MediaPicker';
import { IconLibraryModal } from './IconLibraryModal';
import { type BuilderNode, type PageDocument, type Command, widgets, states, shapes } from './core';

export function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = 'text',
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="studio-field">
      {label && <span>{label}</span>}
      {multiline ? (
        <textarea
          key={value}
          defaultValue={value}
          placeholder={placeholder}
          onBlur={event => {
            if (event.target.value !== value) onChange(event.target.value);
          }}
        />
      ) : (
        <input
          key={value}
          type={type}
          defaultValue={value}
          placeholder={placeholder}
          onBlur={event => {
            if (event.target.value !== value) onChange(event.target.value);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      )}
    </label>
  );
}

const fontFamilies = [
  { label: 'Default (System)', value: '' },
  { label: 'Hind Siliguri (বাংলা)', value: "'Hind Siliguri', sans-serif" },
  { label: 'Tiro Bangla (বাংলা)', value: "'Tiro Bangla', serif" },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Roboto', value: "'Roboto', sans-serif" },
  { label: 'Poppins', value: "'Poppins', sans-serif" },
  { label: 'Montserrat', value: "'Montserrat', sans-serif" },
  { label: 'Open Sans', value: "'Open Sans', sans-serif" },
  { label: 'Lato', value: "'Lato', sans-serif" },
  { label: 'Playfair Display', value: "'Playfair Display', serif" },
  { label: 'Oswald', value: "'Oswald', sans-serif" },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Courier New', value: "'Courier New', monospace" }
];

const fontWeights = [
  { label: 'Default', value: '' },
  { label: '100 (Thin)', value: '100' },
  { label: '200 (Extra Light)', value: '200' },
  { label: '300 (Light)', value: '300' },
  { label: '400 (Normal)', value: '400' },
  { label: '500 (Medium)', value: '500' },
  { label: '600 (Semi-Bold)', value: '600' },
  { label: '700 (Bold)', value: '700' },
  { label: '800 (Extra Bold)', value: '800' },
  { label: '900 (Black)', value: '900' }
];

interface Props {
  node: BuilderNode | undefined;
  document: PageDocument;
  device: string;
  command: (command: Command, group?: string) => void;
  onDeselect?: () => void;
}

export function Inspector({ node, document: _document, device, command, onDeselect }: Props) {
  const [activeTab, setActiveTab] = useState<'content' | 'style' | 'advanced'>('content');
  const [state, setState] = useState('normal');
  const [showTypography, setShowTypography] = useState(false);
  const [showNameTypography, setShowNameTypography] = useState(false);
  const [showTitleTypography, setShowTitleTypography] = useState(false);
  const [marginLinked, setMarginLinked] = useState(true);
  const [paddingLinked, setPaddingLinked] = useState(true);
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);

  if (!node) {
    return (
      <div className="studio-empty">
        <h3>Element Inspector</h3>
        <p>Select any section, column, container, or widget on the canvas to configure its content, styling, motion effects, and responsive options.</p>
      </div>
    );
  }

  const widget = widgets.get(node.type);
  const update = (patch: Partial<BuilderNode>) => command({ type: 'update', id: node.id, patch }, `inspect:${node.id}`);

  const local = device !== 'desktop' ? node.responsiveStyles[device] || {} : state !== 'normal' ? node.states[state as typeof states[number]] || {} : node.styles;

  const style = (key: string, value: string) => {
    const values = { ...local };
    if (value.trim()) values[key] = value.trim();
    else delete values[key];

    if (device !== 'desktop') {
      update({ responsiveStyles: { ...node.responsiveStyles, [device]: values } });
    } else if (state !== 'normal') {
      update({ states: { ...node.states, [state]: values } });
    } else {
      update({ styles: values });
    }
  };

  const updateShapeDivider = (side: 'top' | 'bottom', patch: Partial<{ type: string; color: string; height: string | number; flip: boolean; invert: boolean; bringToFront: boolean }>) => {
    const current = node.shapeDividers || {};
    const updatedSide = { ...(current[side] || {}), ...patch };
    if (!updatedSide.type) delete current[side];
    else current[side] = { ...updatedSide, type: updatedSide.type };
    update({ shapeDividers: { ...current } });
  };

  const updateAdvanced = (patch: Record<string, unknown>) => {
    const advanced = { ...(node.advanced || {}), ...patch };
    update({ advanced });
  };

  const parseNum = (val: string = '', def: number = 0) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? def : num;
  };

  const parseBox = (val: string = '') => {
    const parts = val.trim().split(/\s+/);
    if (!parts.length || !parts[0]) return { top: '', right: '', bottom: '', left: '' };
    if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    if (parts.length === 4) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
    return { top: parts[0] || '', right: parts[1] || '', bottom: parts[2] || '', left: parts[3] || '' };
  };

  const setBox = (key: 'margin' | 'padding', side: 'top' | 'right' | 'bottom' | 'left', val: string, linked: boolean) => {
    const current = parseBox(local[key]);
    if (linked) {
      const v = val ? `${val}px` : '';
      style(key, v ? `${v} ${v} ${v} ${v}` : '');
    } else {
      current[side] = val ? `${val}px` : '0px';
      style(key, `${current.top || '0px'} ${current.right || '0px'} ${current.bottom || '0px'} ${current.left || '0px'}`);
    }
  };

  const margin = parseBox(local.margin);
  const padding = parseBox(local.padding);

  // Helper renderers for Elementor Controls
  const renderAlignmentControl = (currentAlign: string = 'left', onAlignChange: (align: string) => void) => (
    <div className="elementor-control-row">
      <div className="elementor-control-label">
        <span>Alignment</span>
        <i className="eicon-device-desktop elementor-device-icon" />
      </div>
      <div className="elementor-align-buttons">
        <button
          type="button"
          className={currentAlign === 'left' || currentAlign === 'start' ? 'active' : ''}
          title="Left / Start"
          onClick={() => onAlignChange('left')}
        >
          <i className="eicon-text-align-left" />
        </button>
        <button
          type="button"
          className={currentAlign === 'center' ? 'active' : ''}
          title="Center"
          onClick={() => onAlignChange('center')}
        >
          <i className="eicon-text-align-center" />
        </button>
        <button
          type="button"
          className={currentAlign === 'right' || currentAlign === 'end' ? 'active' : ''}
          title="Right / End"
          onClick={() => onAlignChange('right')}
        >
          <i className="eicon-text-align-right" />
        </button>
        <button
          type="button"
          className={currentAlign === 'justify' ? 'active' : ''}
          title="Justified"
          onClick={() => onAlignChange('justify')}
        >
          <i className="eicon-text-align-justify" />
        </button>
      </div>
    </div>
  );

  const renderColorControl = (label: string, colorKey: string, defaultColor = '#ffffff') => (
    <div className="elementor-control-row">
      <div className="elementor-control-label">
        <span>{label}</span>
      </div>
      <div className="elementor-color-control">
        <button type="button" className="elementor-globe-btn" title="Global Colors">
          <i className="eicon-globe" />
        </button>
        <label className="elementor-color-picker-wrapper" title="Pick Color">
          <input
            type="color"
            value={local[colorKey] && local[colorKey].startsWith('#') ? local[colorKey] : defaultColor}
            onChange={e => style(colorKey, e.target.value)}
          />
          <span className="elementor-color-swatch" style={{ background: local[colorKey] || 'transparent' }} />
        </label>
      </div>
    </div>
  );

  const renderTypographyBox = () => (
    <div className="elementor-typography-box">
      <div className="elementor-popover-header">
        <strong>Typography</strong>
        <div className="elementor-popover-tools">
          <button
            type="button"
            title="Reset Typography"
            onClick={() => {
              style('font-family', '');
              style('font-size', '');
              style('font-weight', '');
              style('text-transform', '');
              style('line-height', '');
              style('letter-spacing', '');
            }}
          >
            <i className="eicon-redo" />
          </button>
        </div>
      </div>

      <label className="studio-field">
        <span>Family</span>
        <select
          value={local['font-family'] || ''}
          onChange={e => style('font-family', e.target.value)}
        >
          {fontFamilies.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>
      </label>

      <div className="elementor-slider-row">
        <div className="elementor-slider-label">
          <span>Size</span>
          <i className="eicon-device-desktop" />
          <span className="elementor-unit-badge">px</span>
        </div>
        <div className="elementor-slider-inputs">
          <input
            type="range"
            min="8"
            max="120"
            value={parseNum(local['font-size'], 24)}
            onChange={e => style('font-size', `${e.target.value}px`)}
          />
          <input
            type="number"
            value={parseNum(local['font-size'], 24)}
            onChange={e => style('font-size', `${e.target.value}px`)}
          />
        </div>
      </div>

      <label className="studio-field">
        <span>Weight</span>
        <select
          value={local['font-weight'] || ''}
          onChange={e => style('font-weight', e.target.value)}
        >
          {fontWeights.map(w => <option key={w.label} value={w.value}>{w.label}</option>)}
        </select>
      </label>

      <label className="studio-field">
        <span>Transform</span>
        <select
          value={local['text-transform'] || ''}
          onChange={e => style('text-transform', e.target.value)}
        >
          <option value="">Default</option>
          <option value="uppercase">Uppercase</option>
          <option value="lowercase">Lowercase</option>
          <option value="capitalize">Capitalize</option>
          <option value="none">Normal</option>
        </select>
      </label>

      <div className="elementor-slider-row">
        <div className="elementor-slider-label">
          <span>Line Height</span>
          <i className="eicon-device-desktop" />
          <span className="elementor-unit-badge">px</span>
        </div>
        <div className="elementor-slider-inputs">
          <input
            type="range"
            min="10"
            max="160"
            value={parseNum(local['line-height'], 32)}
            onChange={e => style('line-height', `${e.target.value}px`)}
          />
          <input
            type="number"
            value={parseNum(local['line-height'], 32)}
            onChange={e => style('line-height', `${e.target.value}px`)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="studio-inspector elementor-inspector">
      {/* Top Header matching Elementor Edit Mode */}
      <div className="elementor-panel-header">
        <button className="elementor-header-btn" title="Elementor Menu" onClick={() => setActiveTab('content')}>
          <i className="eicon-menu-bar" />
        </button>
        <span className="elementor-header-title">Edit {widget?.name || node.type}</span>
        <button
          className="elementor-header-btn"
          title="Back to Elements"
          onClick={() => onDeselect?.()}
        >
          <i className="eicon-apps" />
        </button>
      </div>

      {/* 3 Tabs with icons matching Screenshot */}
      <div className="elementor-tabs-nav">
        <button
          className={`elementor-tab-btn ${activeTab === 'content' ? 'active' : ''}`}
          onClick={() => setActiveTab('content')}
        >
          <i className="eicon-edit" />
          <span>Content</span>
        </button>
        <button
          className={`elementor-tab-btn ${activeTab === 'style' ? 'active' : ''}`}
          onClick={() => setActiveTab('style')}
        >
          <i className="eicon-paint-brush" />
          <span>Style</span>
        </button>
        <button
          className={`elementor-tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
          onClick={() => setActiveTab('advanced')}
        >
          <i className="eicon-cog" />
          <span>Advanced</span>
        </button>
      </div>

      <div className="elementor-panel-body">
        {activeTab === 'content' && (
          <>
            {/* 1. TESTIMONIAL (100% Matching Screenshot 1 & 2) */}
            {node.type === 'testimonial' && (
              <details className="elementor-section-group" open>
                <summary><span className="elementor-group-title">Testimonial</span></summary>
                <div className="elementor-group-content">
                  <div className="elementor-control-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                    <div className="elementor-control-label" style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Content</span>
                      <span style={{ fontSize: '10px', color: '#9333ea', cursor: 'pointer' }}>✨ Write with AI</span>
                    </div>
                    <textarea
                      style={{ width: '100%', minHeight: '80px', background: 'var(--e-bg-input)', border: '1px solid var(--e-border-dark)', color: 'var(--e-text-primary)', padding: '8px', borderRadius: '3px', font: 'inherit', fontSize: '12px' }}
                      value={String(node.props.content ?? node.props.text ?? '')}
                      onChange={e => update({ props: { ...node.props, content: e.target.value } })}
                    />
                  </div>

                  <div className="elementor-control-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', margin: '14px 0' }}>
                    <div className="elementor-control-label">
                      <span>Choose Image</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                      <div
                        style={{
                          width: '80px',
                          height: '80px',
                          border: '1px solid var(--e-border-dark)',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--e-bg-card)',
                          overflow: 'hidden',
                          cursor: 'pointer'
                        }}
                      >
                        {node.props.image || node.props.avatar ? (
                          <img
                            src={String(node.props.image || node.props.avatar)}
                            alt="Avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <i className="eicon-image-bold" style={{ fontSize: '32px', color: 'var(--e-text-muted)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <MediaPicker
                          compact
                          value={node.props.image ? [String(node.props.image)] : []}
                          onChange={urls => update({ props: { ...node.props, image: urls[0] || '', avatar: urls[0] || '' } })}
                        />
                        {(node.props.image || node.props.avatar) && (
                          <button
                            type="button"
                            className="elementor-icon-btn-action"
                            style={{ color: '#ef4444' }}
                            onClick={() => update({ props: { ...node.props, image: '', avatar: '' } })}
                          >
                            <i className="eicon-trash-o" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <label className="studio-field">
                    <span>Image Resolution</span>
                    <select
                      value={String(node.props.imageSize || 'full')}
                      onChange={e => update({ props: { ...node.props, imageSize: e.target.value } })}
                    >
                      <option value="thumbnail">Thumbnail - 150 x 150</option>
                      <option value="medium">Medium - 300 x 300</option>
                      <option value="large">Large - 1024 x 1024</option>
                      <option value="full">Full</option>
                    </select>
                  </label>

                  <Field
                    label="Name"
                    value={String(node.props.name ?? 'John Doe')}
                    onChange={val => update({ props: { ...node.props, name: val } })}
                  />

                  <Field
                    label="Title"
                    value={String(node.props.job ?? node.props.title ?? 'Designer')}
                    onChange={val => update({ props: { ...node.props, job: val, title: val } })}
                  />

                  <Field
                    label="Link"
                    placeholder="Paste URL or type"
                    value={String(node.props.link ?? node.props.url ?? '')}
                    onChange={val => update({ props: { ...node.props, link: val, url: val } })}
                  />

                  <div className="elementor-control-row" style={{ margin: '12px 0' }}>
                    <div className="elementor-control-label">
                      <span>Image Position</span>
                    </div>
                    <div className="elementor-align-buttons">
                      <button
                        type="button"
                        className={(node.props.imagePosition || 'aside') === 'aside' ? 'active' : ''}
                        title="Aside (Side)"
                        onClick={() => update({ props: { ...node.props, imagePosition: 'aside' } })}
                      >
                        <i className="eicon-h-align-left" />
                      </button>
                      <button
                        type="button"
                        className={node.props.imagePosition === 'top' ? 'active' : ''}
                        title="Top"
                        onClick={() => update({ props: { ...node.props, imagePosition: 'top' } })}
                      >
                        <i className="eicon-v-align-top" />
                      </button>
                    </div>
                  </div>

                  {renderAlignmentControl(String(node.props.align || 'center'), (align) => {
                    update({ props: { ...node.props, align } });
                    style('text-align', align);
                  })}
                </div>
              </details>
            )}

            {/* 2. HEADING */}
            {node.type === 'heading' && (
              <details className="elementor-section-group" open>
                <summary><span className="elementor-group-title">Title</span></summary>
                <div className="elementor-group-content">
                  <Field
                    label="Title Text"
                    multiline
                    value={String(node.props.text ?? 'Add Your Heading Text Here')}
                    onChange={val => update({ props: { ...node.props, text: val } })}
                  />
                  <Field
                    label="Link"
                    value={String(node.props.url ?? '')}
                    placeholder="https://your-link.com"
                    onChange={val => update({ props: { ...node.props, url: val } })}
                  />
                  <label className="studio-field">
                    <span>HTML Tag</span>
                    <select
                      value={String(node.props.level ?? '2')}
                      onChange={e => update({ props: { ...node.props, level: Number(e.target.value) } })}
                    >
                      <option value="1">H1</option>
                      <option value="2">H2</option>
                      <option value="3">H3</option>
                      <option value="4">H4</option>
                      <option value="5">H5</option>
                      <option value="6">H6</option>
                      <option value="div">div</option>
                      <option value="span">span</option>
                      <option value="p">p</option>
                    </select>
                  </label>
                  {renderAlignmentControl(local['text-align'] || 'left', (align) => style('text-align', align))}
                </div>
              </details>
            )}

            {/* 3. BUTTON & LINK */}
            {(node.type === 'button' || node.type === 'link') && (
              <details className="elementor-section-group" open>
                <summary><span className="elementor-group-title">Button</span></summary>
                <div className="elementor-group-content">
                  <label className="studio-field">
                    <span>Type</span>
                    <select
                      value={String(node.props.type || 'default')}
                      onChange={e => update({ props: { ...node.props, type: e.target.value } })}
                    >
                      <option value="default">Default</option>
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                      <option value="danger">Danger</option>
                    </select>
                  </label>
                  <Field
                    label="Text"
                    value={String(node.props.text ?? 'Click here')}
                    onChange={val => update({ props: { ...node.props, text: val } })}
                  />
                  <Field
                    label="Link"
                    value={String(node.props.url ?? node.props.href ?? '#')}
                    placeholder="https://your-link.com"
                    onChange={val => update({ props: { ...node.props, url: val, href: val } })}
                  />
                  <label className="studio-check">
                    <input
                      type="checkbox"
                      checked={Boolean(node.props.newTab)}
                      onChange={e => update({ props: { ...node.props, newTab: e.target.checked } })}
                    />
                    Open in new window
                  </label>

                  {renderAlignmentControl(local['text-align'] || 'left', (align) => style('text-align', align))}

                  <label className="studio-field">
                    <span>Size</span>
                    <select
                      value={String(node.props.size || 'medium')}
                      onChange={e => update({ props: { ...node.props, size: e.target.value } })}
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                      <option value="xl">Extra Large</option>
                    </select>
                  </label>

                  <div className="elementor-control-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                    <div className="elementor-control-label">
                      <span>Icon</span>
                    </div>
                    <div className="elementor-icon-preview-wrapper">
                      <div
                        className="elementor-icon-checkered-box"
                        onClick={() => setIsIconModalOpen(true)}
                        title="Click to choose icon"
                      >
                        {node.props.icon ? (
                          <i className={String(node.props.icon)} />
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--e-text-muted)' }}>None</span>
                        )}
                      </div>
                      <div className="elementor-icon-preview-actions">
                        <button
                          type="button"
                          className="elementor-icon-btn-action"
                          onClick={() => setIsIconModalOpen(true)}
                        >
                          <i className="eicon-folder" /> Icon Library
                        </button>
                        {node.props.icon && (
                          <button
                            type="button"
                            className="elementor-icon-btn-action"
                            style={{ color: '#ef4444' }}
                            title="Remove Icon"
                            onClick={() => update({ props: { ...node.props, icon: '' } })}
                          >
                            <i className="eicon-trash-o" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {node.props.icon && (
                    <>
                      <label className="studio-field">
                        <span>Icon Position</span>
                        <select
                          value={String(node.props.iconPosition || 'before')}
                          onChange={e => update({ props: { ...node.props, iconPosition: e.target.value } })}
                        >
                          <option value="before">Before (Left)</option>
                          <option value="after">After (Right)</option>
                        </select>
                      </label>

                      <div className="elementor-slider-row">
                        <div className="elementor-slider-label">
                          <span>Icon Spacing</span>
                          <span className="elementor-unit-badge">px</span>
                        </div>
                        <div className="elementor-slider-inputs">
                          <input
                            type="range"
                            min="0"
                            max="50"
                            value={Number(node.props.iconSpacing ?? 8)}
                            onChange={e => update({ props: { ...node.props, iconSpacing: Number(e.target.value) } })}
                          />
                          <input
                            type="number"
                            value={Number(node.props.iconSpacing ?? 8)}
                            onChange={e => update({ props: { ...node.props, iconSpacing: Number(e.target.value) } })}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </details>
            )}

            {/* 4. IMAGE */}
            {node.type === 'image' && (
              <details className="elementor-section-group" open>
                <summary><span className="elementor-group-title">Image</span></summary>
                <div className="elementor-group-content">
                  <div className="elementor-control-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                    <div className="elementor-control-label">
                      <span>Choose Image</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                      <div
                        style={{
                          width: '80px',
                          height: '80px',
                          border: '1px solid var(--e-border-dark)',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--e-bg-card)',
                          overflow: 'hidden'
                        }}
                      >
                        {node.props.src ? (
                          <img src={String(node.props.src)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <i className="eicon-image-bold" style={{ fontSize: '32px', color: 'var(--e-text-muted)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <MediaPicker
                          compact
                          value={node.props.src ? [String(node.props.src)] : []}
                          onChange={urls => update({ props: { ...node.props, src: urls[0] || '' } })}
                        />
                      </div>
                    </div>
                  </div>

                  <label className="studio-field">
                    <span>Aspect Ratio</span>
                    <select
                      value={String(node.props.aspectRatio || 'auto')}
                      onChange={e => update({ props: { ...node.props, aspectRatio: e.target.value } })}
                    >
                      <option value="auto">Auto (Original)</option>
                      <option value="1/1">1:1 Square (Instagram Post)</option>
                      <option value="4/5">4:5 Portrait (Instagram Feed)</option>
                      <option value="3/4">3:4 Fashion Portrait</option>
                      <option value="16/9">16:9 Landscape / Video</option>
                      <option value="9/16">9:16 Story / Mobile Vertical</option>
                      <option value="4/3">4:3 Classic Standard</option>
                      <option value="21/9">21:9 Ultrawide Banner</option>
                      <option value="custom">Custom Ratio</option>
                    </select>
                  </label>

                  {node.props.aspectRatio === 'custom' && (
                    <Field
                      label="Custom Aspect Ratio"
                      placeholder="e.g. 16/9, 3/2, 1.25"
                      value={String(node.props.customAspectRatio ?? '')}
                      onChange={customAspectRatio => update({ props: { ...node.props, customAspectRatio } })}
                    />
                  )}

                  <label className="studio-field">
                    <span>Object Fit</span>
                    <select
                      value={String(node.props.objectFit || 'cover')}
                      onChange={e => update({ props: { ...node.props, objectFit: e.target.value } })}
                    >
                      <option value="cover">Cover (Fill container, crop overflow)</option>
                      <option value="contain">Contain (Preserve entire image)</option>
                      <option value="fill">Fill (Stretch to fit)</option>
                      <option value="scale-down">Scale Down</option>
                      <option value="none">None (Natural size)</option>
                    </select>
                  </label>

                  <Field label="Alt Text" value={String(node.props.alt ?? '')} onChange={alt => update({ props: { ...node.props, alt } })} />
                  <Field label="Caption" value={String(node.props.caption ?? '')} onChange={caption => update({ props: { ...node.props, caption } })} />
                  <Field label="Link URL" value={String(node.props.link ?? '')} onChange={link => update({ props: { ...node.props, link } })} />
                  {renderAlignmentControl(local['text-align'] || 'center', align => style('text-align', align))}
                </div>
              </details>
            )}

            {/* 5. ICON */}
            {node.type === 'icon' && (
              <details className="elementor-section-group" open>
                <summary><span className="elementor-group-title">Icon</span></summary>
                <div className="elementor-group-content">
                  <div className="elementor-control-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                    <div className="elementor-control-label">
                      <span>Icon</span>
                    </div>
                    <div className="elementor-icon-preview-wrapper">
                      <div
                        className="elementor-icon-checkered-box"
                        onClick={() => setIsIconModalOpen(true)}
                        title="Click to open Icon Library"
                      >
                        <i className={String(node.props.icon || 'fas fa-star')} />
                      </div>
                      <div className="elementor-icon-preview-actions">
                        <button
                          type="button"
                          className="elementor-icon-btn-action"
                          onClick={() => setIsIconModalOpen(true)}
                        >
                          <i className="eicon-folder" /> Icon Library
                        </button>
                      </div>
                    </div>
                  </div>

                  <label className="studio-field">
                    <span>View</span>
                    <select
                      value={String(node.props.view || 'default')}
                      onChange={e => update({ props: { ...node.props, view: e.target.value } })}
                    >
                      <option value="default">Default</option>
                      <option value="stacked">Stacked</option>
                      <option value="framed">Framed</option>
                    </select>
                  </label>

                  {['stacked', 'framed'].includes(String(node.props.view)) && (
                    <label className="studio-field">
                      <span>Shape</span>
                      <select
                        value={String(node.props.shape || 'circle')}
                        onChange={e => update({ props: { ...node.props, shape: e.target.value } })}
                      >
                        <option value="circle">Circle</option>
                        <option value="square">Square</option>
                      </select>
                    </label>
                  )}

                  <Field
                    label="Link"
                    value={String(node.props.url || node.props.link || '')}
                    placeholder="https://your-link.com"
                    onChange={val => update({ props: { ...node.props, url: val, link: val } })}
                  />

                  {renderAlignmentControl(local['text-align'] || 'center', align => style('text-align', align))}
                </div>
              </details>
            )}

            {/* 6. CONTAINER & LAYOUT WIDGETS */}
            {['container', 'flex', 'grid', 'section', 'column'].includes(node.type) && (
              <details className="elementor-section-group" open>
                <summary><span className="elementor-group-title">Container Layout</span></summary>
                <div className="elementor-group-content">
                  <label className="studio-field">
                    <span>Direction</span>
                    <select
                      value={local['flex-direction'] || 'column'}
                      onChange={e => style('flex-direction', e.target.value)}
                    >
                      <option value="row">Row (Horizontal)</option>
                      <option value="column">Column (Vertical)</option>
                      <option value="row-reverse">Row Reverse</option>
                      <option value="column-reverse">Column Reverse</option>
                    </select>
                  </label>

                  <label className="studio-field">
                    <span>Justify Content</span>
                    <select
                      value={local['justify-content'] || 'flex-start'}
                      onChange={e => style('justify-content', e.target.value)}
                    >
                      <option value="flex-start">Start</option>
                      <option value="center">Center</option>
                      <option value="flex-end">End</option>
                      <option value="space-between">Space Between</option>
                      <option value="space-around">Space Around</option>
                      <option value="space-evenly">Space Evenly</option>
                    </select>
                  </label>

                  <label className="studio-field">
                    <span>Align Items</span>
                    <select
                      value={local['align-items'] || 'stretch'}
                      onChange={e => style('align-items', e.target.value)}
                    >
                      <option value="stretch">Stretch</option>
                      <option value="flex-start">Start</option>
                      <option value="center">Center</option>
                      <option value="flex-end">End</option>
                    </select>
                  </label>

                  <div className="elementor-slider-row">
                    <div className="elementor-slider-label">
                      <span>Gaps (Spacing)</span>
                      <span className="elementor-unit-badge">px</span>
                    </div>
                    <div className="elementor-slider-inputs">
                      <input
                        type="range"
                        min="0"
                        max="80"
                        value={parseNum(local.gap, 16)}
                        onChange={e => style('gap', `${e.target.value}px`)}
                      />
                      <input
                        type="number"
                        value={parseNum(local.gap, 16)}
                        onChange={e => style('gap', `${e.target.value}px`)}
                      />
                    </div>
                  </div>

                  <label className="studio-field">
                    <span>HTML Tag</span>
                    <select
                      value={String(node.props.tag || 'div')}
                      onChange={e => update({ props: { ...node.props, tag: e.target.value } })}
                    >
                      <option value="div">div</option>
                      <option value="section">section</option>
                      <option value="main">main</option>
                      <option value="article">article</option>
                      <option value="header">header</option>
                      <option value="footer">footer</option>
                      <option value="nav">nav</option>
                    </select>
                  </label>
                </div>
              </details>
            )}

            {/* 7. ALL OTHER WIDGETS DYNAMIC CONTROLS */}
            {!['testimonial', 'heading', 'button', 'link', 'image', 'icon', 'container', 'flex', 'grid', 'section', 'column'].includes(node.type) && widget?.controls && widget.controls.length > 0 && (
              <details className="elementor-section-group" open>
                <summary><span className="elementor-group-title">{widget.name}</span></summary>
                <div className="elementor-group-content">
                  {widget.controls.map(control => {
                    const value = node.props[control.key] ?? '';
                    const change = (val: string | number | boolean | string[]) => update({ props: { ...node.props, [control.key]: val } });
                    if (control.key === 'icon' || control.type === 'icons') {
                      return (
                        <div key={control.key} className="elementor-control-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
                          <div className="elementor-control-label">
                            <span>{control.label}</span>
                          </div>
                          <div className="elementor-icon-preview-wrapper">
                            <div
                              className="elementor-icon-checkered-box"
                              onClick={() => setIsIconModalOpen(true)}
                              title="Click to choose icon"
                            >
                              <i className={String(value || 'fas fa-star')} />
                            </div>
                            <div className="elementor-icon-preview-actions">
                              <button
                                type="button"
                                className="elementor-icon-btn-action"
                                onClick={() => setIsIconModalOpen(true)}
                              >
                                <i className="eicon-folder" /> Icon Library
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={control.key} style={{ marginBottom: '12px' }}>
                        {control.type === 'select' ? (
                          <label className="studio-field">
                            <span>{control.label}</span>
                            <select value={String(value)} onChange={event => change(event.target.value)}>
                              {control.options?.map(opt => {
                                const optVal = typeof opt === 'string' ? opt : opt.value;
                                const optLabel = typeof opt === 'string' ? opt : opt.label;
                                return <option key={optVal} value={optVal}>{optLabel}</option>;
                              })}
                            </select>
                          </label>
                        ) : control.type === 'color' ? (
                          <label className="studio-field">
                            <span>{control.label}</span>
                            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value) : '#000000'} onChange={event => change(event.target.value)} />
                          </label>
                        ) : control.type === 'switch' ? (
                          <label className="studio-check">
                            <input type="checkbox" checked={Boolean(value)} onChange={event => change(event.target.checked)} />
                            {control.label}
                          </label>
                        ) : (
                          <Field
                            label={control.label}
                            value={String(value)}
                            multiline={control.type === 'textarea'}
                            type={control.type === 'number' ? 'number' : 'text'}
                            onChange={val => change(control.type === 'number' ? Number(val) : val)}
                          />
                        )}
                        {control.type === 'media' && (
                          <MediaPicker compact value={value ? [String(value)] : []} onChange={urls => change(urls[0] || '')} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </>
        )}

        {activeTab === 'style' && (
          <>
            {/* Style State & Device switcher */}
            <div className="elementor-style-context">
              <span className="elementor-device-badge">
                <i className={device === 'desktop' ? 'eicon-device-desktop' : device === 'tablet' ? 'eicon-device-tablet' : 'eicon-device-mobile'} />
                {device === 'desktop' ? 'Desktop' : device}
              </span>
              <select aria-label="Style state" value={state} disabled={device !== 'desktop'} onChange={event => setState(event.target.value)}>
                <option value="normal">Normal</option>
                {states.map(val => <option key={val} value={val}>{val}</option>)}
              </select>
            </div>

            {/* Testimonial Style Sections */}
            {node.type === 'testimonial' ? (
              <>
                <details className="elementor-section-group" open>
                  <summary><span className="elementor-group-title">Content</span></summary>
                  <div className="elementor-group-content">
                    {renderColorControl('Text Color', 'color', '#1e293b')}
                    <div className="elementor-control-row">
                      <div className="elementor-control-label"><span>Typography</span></div>
                      <div className="elementor-typography-actions">
                        <button type="button" className={`elementor-pencil-btn ${showTypography ? 'active' : ''}`} onClick={() => setShowTypography(!showTypography)}><i className="eicon-edit" /></button>
                      </div>
                    </div>
                    {showTypography && renderTypographyBox()}
                  </div>
                </details>

                <details className="elementor-section-group">
                  <summary><span className="elementor-group-title">Image</span></summary>
                  <div className="elementor-group-content">
                    <div className="elementor-slider-row">
                      <div className="elementor-slider-label"><span>Image Size</span><span className="elementor-unit-badge">px</span></div>
                      <div className="elementor-slider-inputs">
                        <input type="range" min="20" max="200" value={parseNum(local.width, 48)} onChange={e => style('width', `${e.target.value}px`)} />
                        <input type="number" value={parseNum(local.width, 48)} onChange={e => style('width', `${e.target.value}px`)} />
                      </div>
                    </div>
                    <Field label="Border Radius" value={local['border-radius'] || ''} placeholder="e.g. 50% or 8px" onChange={val => style('border-radius', val)} />
                  </div>
                </details>

                <details className="elementor-section-group">
                  <summary><span className="elementor-group-title">Name</span></summary>
                  <div className="elementor-group-content">
                    {renderColorControl('Text Color', 'color', '#1e293b')}
                    <div className="elementor-control-row">
                      <div className="elementor-control-label"><span>Typography</span></div>
                      <div className="elementor-typography-actions">
                        <button type="button" className={`elementor-pencil-btn ${showNameTypography ? 'active' : ''}`} onClick={() => setShowNameTypography(!showNameTypography)}><i className="eicon-edit" /></button>
                      </div>
                    </div>
                    {showNameTypography && renderTypographyBox()}
                  </div>
                </details>

                <details className="elementor-section-group">
                  <summary><span className="elementor-group-title">Title</span></summary>
                  <div className="elementor-group-content">
                    {renderColorControl('Text Color', 'color', '#64748b')}
                    <div className="elementor-control-row">
                      <div className="elementor-control-label"><span>Typography</span></div>
                      <div className="elementor-typography-actions">
                        <button type="button" className={`elementor-pencil-btn ${showTitleTypography ? 'active' : ''}`} onClick={() => setShowTitleTypography(!showTitleTypography)}><i className="eicon-edit" /></button>
                      </div>
                    </div>
                    {showTitleTypography && renderTypographyBox()}
                  </div>
                </details>
              </>
            ) : (
              <>
                {/* General Style Tab */}
                <details className="elementor-section-group" open>
                  <summary><span className="elementor-group-title">Typography & Colors</span></summary>
                  <div className="elementor-group-content">
                    {renderColorControl('Text / Primary Color', 'color', '#ffffff')}
                    <div className="elementor-control-row">
                      <div className="elementor-control-label"><span>Typography</span></div>
                      <div className="elementor-typography-actions">
                        <button type="button" className="elementor-globe-btn" title="Global Fonts"><i className="eicon-globe" /></button>
                        <button type="button" className={`elementor-pencil-btn ${showTypography ? 'active' : ''}`} title="Edit Typography" onClick={() => setShowTypography(!showTypography)}><i className="eicon-edit" /></button>
                      </div>
                    </div>
                    {showTypography && renderTypographyBox()}

                    {['icon', 'image', 'star-rating', 'counter', 'social-icons'].includes(node.type) && (
                      <div className="elementor-slider-row" style={{ marginTop: '12px' }}>
                        <div className="elementor-slider-label"><span>Size</span><span className="elementor-unit-badge">px</span></div>
                        <div className="elementor-slider-inputs">
                          <input type="range" min="12" max="200" value={parseNum(local['font-size'] || local.width, 36)} onChange={e => style(node.type === 'image' ? 'width' : 'font-size', `${e.target.value}px`)} />
                          <input type="number" value={parseNum(local['font-size'] || local.width, 36)} onChange={e => style(node.type === 'image' ? 'width' : 'font-size', `${e.target.value}px`)} />
                        </div>
                      </div>
                    )}
                  </div>
                </details>

                <details className="elementor-section-group">
                  <summary><span className="elementor-group-title">Background & Border</span></summary>
                  <div className="elementor-group-content">
                    {renderColorControl('Background Color', 'background-color', '#ffffff')}
                    <Field label="Background (Image / Gradient)" value={local.background || ''} placeholder="e.g. linear-gradient(135deg, #176b53, #114e3d)" onChange={val => style('background', val)} />
                    <Field label="Border" value={local.border || ''} placeholder="e.g. 1px solid #e5e7eb" onChange={val => style('border', val)} />
                    <Field label="Border Radius" value={local['border-radius'] || ''} placeholder="e.g. 8px" onChange={val => style('border-radius', val)} />
                    <Field label="Box Shadow" value={local['box-shadow'] || ''} placeholder="e.g. 0 4px 12px rgba(0,0,0,0.1)" onChange={val => style('box-shadow', val)} />
                  </div>
                </details>
              </>
            )}

            {/* Shape Dividers for Containers */}
            {['section', 'container', 'flex', 'column'].includes(node.type) && (
              <details className="elementor-section-group">
                <summary><span className="elementor-group-title">Shape Dividers</span></summary>
                <div className="elementor-group-content">
                  <strong style={{ display: 'block', margin: '8px 0 4px' }}>Top Shape Divider</strong>
                  <label className="studio-field">
                    <span>Type</span>
                    <select
                      value={node.shapeDividers?.top?.type || ''}
                      onChange={event => updateShapeDivider('top', { type: event.target.value })}
                    >
                      <option value="">None</option>
                      {Object.keys(shapes).map(key => <option key={key} value={key}>{shapes[key].name}</option>)}
                    </select>
                  </label>
                  {node.shapeDividers?.top?.type && (
                    <>
                      <Field label="Color" value={node.shapeDividers.top.color || '#ffffff'} onChange={color => updateShapeDivider('top', { color })} />
                      <Field label="Height" value={String(node.shapeDividers.top.height || '50px')} onChange={height => updateShapeDivider('top', { height })} />
                      <label className="studio-check">
                        <input type="checkbox" checked={Boolean(node.shapeDividers.top.flip)} onChange={e => updateShapeDivider('top', { flip: e.target.checked })} />
                        Flip horizontally
                      </label>
                      <label className="studio-check">
                        <input type="checkbox" checked={Boolean(node.shapeDividers.top.invert)} onChange={e => updateShapeDivider('top', { invert: e.target.checked })} />
                        Invert vertically
                      </label>
                    </>
                  )}

                  <strong style={{ display: 'block', margin: '12px 0 4px' }}>Bottom Shape Divider</strong>
                  <label className="studio-field">
                    <span>Type</span>
                    <select
                      value={node.shapeDividers?.bottom?.type || ''}
                      onChange={event => updateShapeDivider('bottom', { type: event.target.value })}
                    >
                      <option value="">None</option>
                      {Object.keys(shapes).map(key => <option key={key} value={key}>{shapes[key].name}</option>)}
                    </select>
                  </label>
                  {node.shapeDividers?.bottom?.type && (
                    <>
                      <Field label="Color" value={node.shapeDividers.bottom.color || '#ffffff'} onChange={color => updateShapeDivider('bottom', { color })} />
                      <Field label="Height" value={String(node.shapeDividers.bottom.height || '50px')} onChange={height => updateShapeDivider('bottom', { height })} />
                      <label className="studio-check">
                        <input type="checkbox" checked={Boolean(node.shapeDividers.bottom.flip)} onChange={e => updateShapeDivider('bottom', { flip: e.target.checked })} />
                        Flip horizontally
                      </label>
                      <label className="studio-check">
                        <input type="checkbox" checked={Boolean(node.shapeDividers.bottom.invert)} onChange={e => updateShapeDivider('bottom', { invert: e.target.checked })} />
                        Invert vertically
                      </label>
                    </>
                  )}
                </div>
              </details>
            )}
          </>
        )}

        {activeTab === 'advanced' && (
          <>
            {/* Margin & Padding with 4-box layout and Link icon */}
            <details className="elementor-section-group">
              <summary><span className="elementor-group-title">Layout & Spacing</span></summary>
              <div className="elementor-group-content">
                {/* Margin */}
                <div className="elementor-dimension-control">
                  <div className="elementor-dimension-header">
                    <span>Margin</span>
                    <div className="elementor-dimension-actions">
                      <span className="elementor-unit-badge">PX</span>
                      <button
                        type="button"
                        className={`elementor-link-btn ${marginLinked ? 'active' : ''}`}
                        title={marginLinked ? 'Unlink values' : 'Link values together'}
                        onClick={() => setMarginLinked(!marginLinked)}
                      >
                        <i className={marginLinked ? 'eicon-link' : 'eicon-unlink'} />
                      </button>
                    </div>
                  </div>
                  <div className="elementor-dimension-grid">
                    <label>
                      <input
                        type="number"
                        placeholder="Top"
                        value={parseNum(margin.top, 0)}
                        onChange={e => setBox('margin', 'top', e.target.value, marginLinked)}
                      />
                      <span>Top</span>
                    </label>
                    <label>
                      <input
                        type="number"
                        placeholder="Right"
                        value={parseNum(margin.right, 0)}
                        onChange={e => setBox('margin', 'right', e.target.value, marginLinked)}
                      />
                      <span>Right</span>
                    </label>
                    <label>
                      <input
                        type="number"
                        placeholder="Bottom"
                        value={parseNum(margin.bottom, 0)}
                        onChange={e => setBox('margin', 'bottom', e.target.value, marginLinked)}
                      />
                      <span>Bottom</span>
                    </label>
                    <label>
                      <input
                        type="number"
                        placeholder="Left"
                        value={parseNum(margin.left, 0)}
                        onChange={e => setBox('margin', 'left', e.target.value, marginLinked)}
                      />
                      <span>Left</span>
                    </label>
                  </div>
                </div>

                {/* Padding */}
                <div className="elementor-dimension-control" style={{ marginTop: '16px' }}>
                  <div className="elementor-dimension-header">
                    <span>Padding</span>
                    <div className="elementor-dimension-actions">
                      <span className="elementor-unit-badge">PX</span>
                      <button
                        type="button"
                        className={`elementor-link-btn ${paddingLinked ? 'active' : ''}`}
                        title={paddingLinked ? 'Unlink values' : 'Link values together'}
                        onClick={() => setPaddingLinked(!paddingLinked)}
                      >
                        <i className={paddingLinked ? 'eicon-link' : 'eicon-unlink'} />
                      </button>
                    </div>
                  </div>
                  <div className="elementor-dimension-grid">
                    <label>
                      <input
                        type="number"
                        placeholder="Top"
                        value={parseNum(padding.top, 0)}
                        onChange={e => setBox('padding', 'top', e.target.value, paddingLinked)}
                      />
                      <span>Top</span>
                    </label>
                    <label>
                      <input
                        type="number"
                        placeholder="Right"
                        value={parseNum(padding.right, 0)}
                        onChange={e => setBox('padding', 'right', e.target.value, paddingLinked)}
                      />
                      <span>Right</span>
                    </label>
                    <label>
                      <input
                        type="number"
                        placeholder="Bottom"
                        value={parseNum(padding.bottom, 0)}
                        onChange={e => setBox('padding', 'bottom', e.target.value, paddingLinked)}
                      />
                      <span>Bottom</span>
                    </label>
                    <label>
                      <input
                        type="number"
                        placeholder="Left"
                        value={parseNum(padding.left, 0)}
                        onChange={e => setBox('padding', 'left', e.target.value, paddingLinked)}
                      />
                      <span>Left</span>
                    </label>
                  </div>
                </div>

                <Field label="Width" value={local.width || ''} placeholder="e.g. 100% or 450px" onChange={val => style('width', val)} />
                <Field label="Z-Index" value={local['z-index'] || ''} placeholder="e.g. 10" onChange={val => style('z-index', val)} />
              </div>
            </details>

            {/* Motion Effects */}
            <details className="elementor-section-group">
              <summary><span className="elementor-group-title">Motion Effects</span></summary>
              <div className="elementor-group-content">
                <label className="studio-field">
                  <span>Entrance Animation</span>
                  <select
                    value={local.animation || ''}
                    onChange={event => style('animation', event.target.value ? `${event.target.value} 0.8s ease-out forwards` : '')}
                  >
                    <option value="">None</option>
                    <option value="builderFadeIn">Fade In</option>
                    <option value="builderFadeInUp">Fade In Up</option>
                    <option value="builderFadeInDown">Fade In Down</option>
                    <option value="builderFadeInLeft">Fade In Left</option>
                    <option value="builderFadeInRight">Fade In Right</option>
                    <option value="builderZoomIn">Zoom In</option>
                    <option value="builderBounceIn">Bounce In</option>
                    <option value="builderSlideInLeft">Slide In Left</option>
                    <option value="builderSlideInRight">Slide In Right</option>
                  </select>
                </label>
                <Field label="Transition" value={local.transition || ''} placeholder="e.g. all 0.3s ease" onChange={val => style('transition', val)} />
              </div>
            </details>

            {/* Transform */}
            <details className="elementor-section-group">
              <summary><span className="elementor-group-title">Transform (2D/3D)</span></summary>
              <div className="elementor-group-content">
                <Field label="Transform" value={local.transform || ''} placeholder="e.g. rotate(5deg) scale(1.05)" onChange={val => style('transform', val)} />
              </div>
            </details>

            {/* Custom CSS */}
            <details className="elementor-section-group">
              <summary><span className="elementor-group-title">Custom CSS</span></summary>
              <div className="elementor-group-content">
                <p className="studio-hint">Use <code>selector</code> to target this element.</p>
                <Field
                  label="CSS Code"
                  multiline
                  value={node.advanced?.customCss || ''}
                  placeholder="selector { color: #176b53; }"
                  onChange={customCss => updateAdvanced({ customCss })}
                />
              </div>
            </details>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => command({ type: 'wrap', id: node.id })}>Wrap in Container</button>
              {widget?.children && <button onClick={() => command({ type: 'unwrap', id: node.id })}>Unwrap Container</button>}
              <button onClick={() => update({ styles: {}, responsiveStyles: {}, states: {}, shapeDividers: undefined })}>Reset Local Styles</button>
            </div>
          </>
        )}
      </div>

      {/* Icon Library Modal Popup */}
      <IconLibraryModal
        isOpen={isIconModalOpen}
        onClose={() => setIsIconModalOpen(false)}
        currentIcon={String(node.props.icon || 'fas fa-star')}
        onSelect={(iconClass) => update({ props: { ...node.props, icon: iconClass } })}
      />
    </div>
  );
}
