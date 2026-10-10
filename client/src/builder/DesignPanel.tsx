import { useState } from 'react';
import { Field } from './Inspector';
import { type PageDocument, type Command, type BuilderNode, cloneNode, styleGroups, createNode, tokenUsageCount } from './core';

interface Props {
  document: PageDocument;
  command: (command: Command) => void;
  selected?: BuilderNode;
  select: (id: string) => void;
}

export function DesignPanel({ document, command, selected, select }: Props) {
  const [key, setKey] = useState('');
  const [className, setClassName] = useState('');
  const [property, setProperty] = useState('color');
  const validKey = /^[a-z][a-z0-9-]{0,47}$/.test(key);
  const patch = (patch: Partial<PageDocument>) => command({ type: 'document', patch });
  const usage = (value: string) =>
    JSON.stringify({ rootNodes: document.rootNodes, components: document.components, classes: document.classes }).split(value).length - 1;
  const variableUsage = (name: string) =>
    tokenUsageCount({ rootNodes: document.rootNodes, components: document.components, classes: document.classes, tokens: document.tokens }, name);

  return (
    <div className="studio-inspector">
      <div style={{ padding: '12px 14px 4px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 4px', color: 'var(--e-text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Site Style & Design
        </h3>
        <p className="studio-hint" style={{ margin: '0 0 10px' }}>
          Global design tokens, reusable component masters, and custom breakpoints for this page.
        </p>

        <div className="elementor-search-box" style={{ margin: '0 0 12px' }}>
          <input
            className="studio-search"
            style={{ margin: 0, padding: 0, border: 0 }}
            aria-label="New resource key"
            placeholder="New token/class key (e.g. brand-accent)"
            value={key}
            onChange={event => setKey(event.target.value)}
          />
        </div>
      </div>

      {/* 1. Global Colors & Variables */}
      <details className="elementor-section-group" open>
        <summary>
          <span className="elementor-category-title">
            <i className="eicon-paint-brush" style={{ marginRight: '6px' }} /> Global Colors & Variables
          </span>
        </summary>
        <div className="elementor-group-content">
          <button
            className="elementor-icon-btn-action"
            style={{ marginBottom: '10px' }}
            disabled={!validKey || key in document.tokens}
            onClick={() => {
              patch({ tokens: { ...document.tokens, [key]: '#176b53' } });
              setKey('');
            }}
          >
            <i className="eicon-plus" /> Add variable
          </button>
          {Object.entries(document.tokens).map(([name, value]) => {
            const count = variableUsage(name);
            return (
              <div key={name} style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--e-border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        borderRadius: '3px',
                        backgroundColor: value.startsWith('#') || value.startsWith('rgb') ? value : '#58bcee',
                        border: '1px solid var(--e-border-dark)'
                      }}
                    />
                    <strong style={{ fontSize: '11px', color: 'var(--e-text-primary)' }}>--{name}</strong>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--e-text-muted)' }}>{count} refs</span>
                </div>
                <Field
                  label=""
                  value={value}
                  onChange={v => patch({ tokens: { ...document.tokens, [name]: v } })}
                />
                <button
                  className="studio-text-button"
                  style={{ fontSize: '10px', color: count > 0 ? 'var(--e-text-muted)' : '#ef4444', padding: '2px 0', cursor: count > 0 ? 'not-allowed' : 'pointer' }}
                  disabled={count > 0}
                  onClick={() => {
                    const tokens = { ...document.tokens };
                    delete tokens[name];
                    patch({ tokens });
                  }}
                >
                  {count > 0 ? 'Cannot remove (in use)' : 'Remove unused variable'}
                </button>
              </div>
            );
          })}
        </div>
      </details>

      {/* 2. Global Classes */}
      <details className="elementor-section-group">
        <summary>
          <span className="elementor-category-title">
            <i className="eicon-code" style={{ marginRight: '6px' }} /> Global CSS Classes
          </span>
        </summary>
        <div className="elementor-group-content">
          <button
            className="elementor-icon-btn-action"
            style={{ marginBottom: '10px' }}
            disabled={!validKey || key in document.classes}
            onClick={() => {
              patch({ classes: { ...document.classes, [key]: { styles: {}, responsiveStyles: {}, states: {} } } });
              setClassName(key);
              setKey('');
            }}
          >
            <i className="eicon-plus" /> Create class
          </button>

          <label className="studio-field">
            <span>Choose Class to Edit</span>
            <select value={className} onChange={event => setClassName(event.target.value)}>
              <option value="">Select a class…</option>
              {Object.keys(document.classes).map(name => (
                <option key={name} value={name}>
                  .{name}
                </option>
              ))}
            </select>
          </label>

          {document.classes[className] && (
            <div style={{ marginTop: '10px', padding: '10px', background: 'var(--e-bg-card)', borderRadius: '4px', border: '1px solid var(--e-border-base)' }}>
              <label className="studio-field">
                <span>Style property</span>
                <select value={property} onChange={event => setProperty(event.target.value)}>
                  {Object.values(styleGroups)
                    .flat()
                    .map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </label>
              <Field
                label={property}
                value={document.classes[className].styles[property] || ''}
                onChange={value => {
                  const definition = structuredClone(document.classes[className]);
                  if (value) definition.styles[property] = value;
                  else delete definition.styles[property];
                  patch({ classes: { ...document.classes, [className]: definition } });
                }}
              />
              <p className="studio-hint">Attach this class to any element in its Advanced tab.</p>
              <button
                className="elementor-icon-btn-action"
                style={{ color: '#ef4444', borderColor: '#fecaca', marginTop: '6px' }}
                disabled={JSON.stringify({ nodes: document.rootNodes, components: document.components }).includes(`"${className}"`)}
                onClick={() => {
                  const classes = { ...document.classes };
                  delete classes[className];
                  patch({ classes });
                  setClassName('');
                }}
              >
                Delete unused class
              </button>
            </div>
          )}
        </div>
      </details>

      {/* 3. Component Masters */}
      <details className="elementor-section-group">
        <summary>
          <span className="elementor-category-title">
            <i className="eicon-flow" style={{ marginRight: '6px' }} /> Component Masters
          </span>
        </summary>
        <div className="elementor-group-content">
          <button
            className="elementor-icon-btn-action"
            style={{ marginBottom: '10px' }}
            disabled={!validKey || !selected || key in document.components}
            onClick={() => {
              if (selected) command({ type: 'component', id: selected.id, key, name: selected.name });
              setKey('');
            }}
          >
            <i className="eicon-plus-square" /> Create from selection
          </button>

          {Object.entries(document.components).map(([name, component]) => (
            <div className="studio-resource" key={name} style={{ marginBottom: '8px' }}>
              <strong>{component.name}</strong>
              <small>.{name}</small>
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    const node = createNode('component');
                    node.props.component = name;
                    node.name = component.name;
                    command({ type: 'insert', node });
                    select(node.id);
                  }}
                >
                  Insert instance
                </button>
                <button
                  disabled={!selected || selected.type === 'component'}
                  onClick={() => {
                    if (selected)
                      patch({
                        components: {
                          ...document.components,
                          [name]: { ...component, nodes: [cloneNode(selected)] }
                        }
                      });
                  }}
                >
                  Replace master with selection
                </button>
                <button
                  disabled={usage(`"component":"${name}"`) > 0}
                  onClick={() => {
                    const components = { ...document.components };
                    delete components[name];
                    patch({ components });
                  }}
                >
                  Delete unused master
                </button>
              </div>
            </div>
          ))}

          {selected?.type === 'component' && (
            <button
              className="elementor-icon-btn-action"
              style={{ marginTop: '8px' }}
              onClick={() => command({ type: 'detach', id: selected.id })}
            >
              <i className="eicon-external-link" /> Detach selected instance
            </button>
          )}
        </div>
      </details>

      {/* 4. Responsive Breakpoints */}
      <details className="elementor-section-group">
        <summary>
          <span className="elementor-category-title">
            <i className="eicon-device-responsive" style={{ marginRight: '6px' }} /> Responsive Breakpoints
          </span>
        </summary>
        <div className="elementor-group-content">
          <button
            className="elementor-icon-btn-action"
            style={{ marginBottom: '10px' }}
            disabled={!validKey || key === 'desktop' || document.breakpoints.some(bp => bp.id === key)}
            onClick={() => {
              let width = 800;
              while (document.breakpoints.some(bp => bp.maxWidth === width)) width++;
              patch({ breakpoints: [...document.breakpoints, { id: key, label: key, maxWidth: width }] });
              setKey('');
            }}
          >
            <i className="eicon-plus" /> Add breakpoint
          </button>
          {document.breakpoints.map(bp => (
            <Field
              key={bp.id}
              label={`${bp.label} · max width (px)`}
              value={String(bp.maxWidth)}
              type="number"
              onChange={value =>
                patch({
                  breakpoints: document.breakpoints.map(item =>
                    item.id === bp.id ? { ...item, maxWidth: Number(value) } : item
                  )
                })
              }
            />
          ))}
        </div>
      </details>
    </div>
  );
}
