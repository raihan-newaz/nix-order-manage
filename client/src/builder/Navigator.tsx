import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { type BuilderNode, type Command } from './core';

interface Props {
  nodes: BuilderNode[];
  selected: string | null;
  select: (id: string) => void;
  command: (command: Command) => void;
  parentId?: string;
  level?: number;
  onContextMenu?: (e: React.MouseEvent, node: BuilderNode) => void;
}

export const getNavigatorIcon = (type: string) => {
  switch (type) {
    case 'container':
    case 'section':
    case 'flex':
    case 'column':
      return 'eicon-flex';
    case 'heading':
      return 'eicon-t-letter';
    case 'text':
    case 'text-editor':
    case 'paragraph':
      return 'eicon-text';
    case 'icon':
      return 'eicon-favorite';
    case 'form':
    case 'form-field':
    case 'form-submit':
    case 'checkout':
      return 'eicon-form-horizontal';
    case 'button':
    case 'link':
      return 'eicon-button';
    case 'image':
      return 'eicon-image';
    case 'video':
      return 'eicon-youtube';
    case 'countdown':
      return 'eicon-countdown';
    case 'star-rating':
      return 'eicon-rating';
    case 'counter':
      return 'eicon-counter';
    case 'progress':
      return 'eicon-skill-bar';
    case 'social-icons':
      return 'eicon-social-icons';
    case 'divider':
      return 'eicon-divider';
    case 'spacer':
      return 'eicon-spacer';
    case 'google-maps':
      return 'eicon-google-maps';
    case 'nav':
      return 'eicon-nav-menu';
    case 'details':
      return 'eicon-accordion';
    default:
      return 'eicon-elementor-circle';
  }
};

export function Navigator({ nodes, selected, select, command, parentId, level = 0, onContextMenu }: Props) {
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const toggleCollapse = (id: string) => {
    setCollapsed(values => (values.includes(id) ? values.filter(v => v !== id) : [...values, id]));
  };

  const toggleVisibility = (e: React.MouseEvent, node: BuilderNode) => {
    e.stopPropagation();
    command({ type: 'update', id: node.id, patch: { hidden: !node.hidden } });
  };

  return (
    <ul className="elementor-nav-tree" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {nodes.map((node, index) => {
        const isSelected = selected === node.id;
        const hasChildren = node.children && node.children.length > 0;
        const isCollapsed = collapsed.includes(node.id);
        const iconClass = getNavigatorIcon(node.type);

        return (
          <li key={node.id} className="elementor-nav-tree-node">
            <div
              className={`elementor-nav-row ${isSelected ? 'is-selected' : ''}`}
              style={{
                paddingLeft: `${10 + level * 16}px`
              }}
              draggable
              onClick={() => select(node.id)}
              onContextMenu={e => {
                if (onContextMenu) {
                  e.preventDefault();
                  e.stopPropagation();
                  select(node.id);
                  onContextMenu(e, node);
                }
              }}
              onDragStart={event => {
                event.stopPropagation();
                event.dataTransfer.setData('application/nix-node', node.id);
              }}
              onDragOver={event => {
                event.preventDefault();
                event.currentTarget.classList.add('is-drop-target');
              }}
              onDragLeave={event => {
                event.currentTarget.classList.remove('is-drop-target');
              }}
              onDrop={event => {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.classList.remove('is-drop-target');
                const id = event.dataTransfer.getData('application/nix-node');
                if (id) command({ type: 'move', id, parentId, index });
              }}
            >
              {/* Expand / Collapse Toggle Arrow */}
              {hasChildren ? (
                <button
                  type="button"
                  className="elementor-nav-caret-btn"
                  onClick={e => {
                    e.stopPropagation();
                    toggleCollapse(node.id);
                  }}
                  title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  <i className={isCollapsed ? 'eicon-caret-right' : 'eicon-caret-down'} />
                </button>
              ) : (
                <span className="elementor-nav-caret-spacer" />
              )}

              {/* Elementor Widget Icon */}
              <span className="elementor-nav-icon-badge">
                <i className={iconClass} />
              </span>

              {/* Node Name */}
              <span className="elementor-nav-label" title={`${node.name} (${node.type})`}>
                {node.name}
              </span>

              {/* Action Buttons on Hover */}
              <div className="elementor-nav-row-actions">
                <button
                  type="button"
                  className="elementor-nav-action-btn"
                  title={node.hidden ? 'Show element' : 'Hide element'}
                  onClick={e => toggleVisibility(e, node)}
                >
                  {node.hidden ? <EyeOff size={12} color="#ef4444" /> : <Eye size={12} />}
                </button>
              </div>
            </div>

            {/* Drop Zone for Nesting */}
            {['container', 'section', 'flex', 'column'].includes(node.type) && (
              <div
                className="elementor-nav-drop-zone"
                style={{ paddingLeft: `${26 + level * 16}px` }}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  const id = event.dataTransfer.getData('application/nix-node');
                  if (id) command({ type: 'move', id, parentId: node.id });
                }}
              >
                + Drop inside {node.name}
              </div>
            )}

            {/* Recursive Children Rendering */}
            {!isCollapsed && hasChildren && (
              <Navigator
                nodes={node.children}
                selected={selected}
                select={select}
                command={command}
                parentId={node.id}
                level={level + 1}
                onContextMenu={onContextMenu}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
