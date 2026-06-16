'use client'

import type { DocFolderNode } from '@/types'

export function FolderTreeNode({
  node,
  depth,
  selectedId,
  expandedIds,
  reorderingId,
  onSelect,
  onToggleExpand,
  onRightClick,
}: {
  node: DocFolderNode
  depth: number
  selectedId: string | null
  expandedIds: Set<string>
  reorderingId: string | null
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onRightClick: (node: DocFolderNode, x: number, y: number) => void
}) {
  const isSelected = selectedId === node.id
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0
  const isReordering = reorderingId === node.id

  function handleClick() {
    onSelect(node.id)
    if (hasChildren) onToggleExpand(node.id)
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onRightClick(node, e.clientX, e.clientY)
  }

  return (
    <>
      <div
        className={`folder-row${isSelected ? ' selected' : ''}${isReordering ? ' reordering' : ''}`}
        style={{ paddingLeft: `${0.625 + depth * 1.125}rem` }}
        title={node.name}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="folder-chevron">
          {isReordering ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="folder-spinner"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12a8 8 0 018-8V4" /></svg>
          ) : hasChildren ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              {isExpanded
                ? <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                : <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              }
            </svg>
          ) : <span style={{ display: 'inline-block', width: 10 }} />}
        </span>
        <svg className="folder-icon" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <span className="folder-name">{node.name}</span>
        {node.documents.length > 0 && (
          <span className="folder-count">{node.documents.length}</span>
        )}
      </div>
      {isExpanded && node.children.map((child) => (
        <FolderTreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          expandedIds={expandedIds}
          reorderingId={reorderingId}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          onRightClick={onRightClick}
        />
      ))}
    </>
  )
}
