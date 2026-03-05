import { useEffect, useMemo, useState } from 'react'
import ReactFlow, { Background, Controls, Position } from 'reactflow'
import type { Edge, Node, ReactFlowInstance } from 'reactflow'
import 'reactflow/dist/style.css'
import { layoutTree } from '../lib/layoutTree'
import { buildTreeGraphModel } from '../lib/treeGraphModel'

type TreePerson = {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  city: string | null
  state: string | null
}

type TreeRelationship = {
  id: string
  person_a_id: string
  person_b_id: string
  relationship_type: string
}

type Props = {
  people: TreePerson[]
  relationships: TreeRelationship[]
  rootPersonId: string
  visiblePersonIds: string[]
  selectedPersonId: string
  onInit: (instance: ReactFlowInstance) => void
  onNodeSelect: (personId: string) => void
  onLayoutChange: (nodes: Node[], edges: Edge[]) => void
}

export default function TreeGraph({
  people,
  relationships,
  rootPersonId,
  visiblePersonIds,
  selectedPersonId,
  onInit,
  onNodeSelect,
  onLayoutChange,
}: Props) {
  const [layoutNodes, setLayoutNodes] = useState<Node[]>([])
  const [layoutEdges, setLayoutEdges] = useState<Edge[]>([])

  const model = useMemo(
    () =>
      buildTreeGraphModel({
        people,
        relationships,
        visiblePersonIds,
      }),
    [people, relationships, visiblePersonIds]
  )

  useEffect(() => {
    let active = true

    void (async () => {
      const laidOut = await layoutTree(model.nodes, model.edges, 'DOWN')

      if (!active) {
        return
      }

      const nodes: Node[] = laidOut.nodes.map((node) => {
        if (node.type === 'union') {
          return {
            id: node.id,
            position: { x: node.x, y: node.y },
            draggable: false,
            selectable: false,
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top,
            data: {
              label: <div className="tree-flow-connector" aria-hidden="true" />,
            },
          }
        }

        const personId = node.id.replace(/^P:/, '')
        const person = model.peopleById.get(personId)
        const title = person ? `${person.first_name} ${person.last_name}`.trim() : 'Unknown member'
        const subtitle =
          person && (person.city || person.state)
            ? [person.city, person.state].filter(Boolean).join(', ')
            : person?.birth_date || 'No details yet'
        const isRoot = personId === rootPersonId
        const isSelected = personId === selectedPersonId

        return {
          id: node.id,
          position: { x: node.x, y: node.y },
          draggable: false,
          selectable: true,
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          data: {
            label: (
              <div
                className={`tree-flow-node ${isRoot ? 'tree-flow-node-root' : 'tree-flow-node-parent'} ${
                  isSelected ? 'tree-flow-node-highlighted' : ''
                }`}
              >
                <div className="node-avatar">{person?.first_name.slice(0, 1).toUpperCase() ?? '?'}</div>
                <strong>{title}</strong>
                <span>{subtitle}</span>
              </div>
            ),
          },
        }
      })

      const edges: Edge[] = laidOut.edges.map((edge) => {
        const isSpouse = edge.relationType === 'spouse'
        const label =
          edge.relationType === 'step_parent'
            ? 'step parent'
            : edge.relationType === 'adopted_parent'
              ? 'adoptive parent'
              : edge.relationType

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: isSpouse ? 'straight' : 'smoothstep',
          label: isSpouse ? '' : label,
          animated: false,
          style: isSpouse
            ? { strokeWidth: 2, stroke: '#b45309' }
            : edge.relationType === 'step_parent'
              ? { strokeWidth: 2.5, stroke: '#7c3aed', strokeDasharray: '8 6' }
              : edge.relationType === 'adopted_parent'
                ? { strokeWidth: 2.5, stroke: '#059669', strokeDasharray: '4 4' }
                : { strokeWidth: 2.5, stroke: '#1f2937' },
          labelStyle: { fill: '#111827', fontSize: 11, fontWeight: 600 },
          markerEnd: isSpouse ? undefined : { type: 'arrowclosed' as any },
        }
      })

      setLayoutNodes(nodes)
      setLayoutEdges(edges)
      onLayoutChange(nodes, edges)
    })()

    return () => {
      active = false
    }
  }, [model, onLayoutChange, rootPersonId, selectedPersonId])

  return (
    <div className="tree-flow-shell">
      <ReactFlow
        edges={layoutEdges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodes={layoutNodes}
        nodesDraggable={false}
        nodesFocusable
        onInit={onInit}
        onNodeClick={(_, node) => {
          const nodeId = String(node.id)
          if (!nodeId.startsWith('P:')) {
            return
          }
          onNodeSelect(nodeId.replace(/^P:/, ''))
        }}
        proOptions={{ hideAttribution: true }}
        zoomOnScroll={false}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
