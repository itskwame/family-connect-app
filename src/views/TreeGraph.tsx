import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import ReactFlow, { Background, Controls, Position } from 'reactflow'
import type { Edge, Node, ReactFlowInstance } from 'reactflow'
import 'reactflow/dist/style.css'
import { layoutTree } from '../lib/layoutTree'
import { buildTreeGraphModel } from '../lib/treeGraphModel'
import type { PositionedLayoutEdge } from '../lib/layoutTree'

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

  const edgeTypes = useMemo(
    () => ({
      orthogonal: ({
        id,
        data,
        style,
      }: {
        id: string
        data?: { points?: Array<{ x: number; y: number }> }
        style?: CSSProperties
      }) => {
        const points = data?.points ?? []
        if (points.length < 2) {
          return null
        }
        const path = points
          .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
          .join(' ')

        return (
          <g className="react-flow__edge">
            <path id={id} className="react-flow__edge-path" d={path} fill="none" style={style} />
          </g>
        )
      },
    }),
    []
  )

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

      const baseNodes: Node[] = laidOut.nodes.map((node) => {
        if (node.type === 'union') {
          return {
            id: node.id,
            position: { x: node.x, y: node.y },
            draggable: false,
            selectable: false,
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top,
            style: { width: node.width, height: node.height, border: 'none', background: 'transparent' },
            data: {
              label: (
                <div className="tree-flow-connector" aria-hidden="true">
                  <span className="tree-flow-marriage-bar" />
                  <span className="tree-flow-union-dot" />
                </div>
              ),
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
          style: { width: node.width, height: node.height, border: 'none', background: 'transparent' },
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

      const personLayoutNodes = laidOut.nodes.filter((node) => node.type === 'person')
      const uniqueGenerationRows = Array.from(
        new Set(personLayoutNodes.map((node) => Math.round(node.y)))
      ).sort((left, right) => left - right)
      const minX = laidOut.nodes.reduce((acc, node) => Math.min(acc, node.x), Number.POSITIVE_INFINITY)
      const maxX = laidOut.nodes.reduce(
        (acc, node) => Math.max(acc, node.x + node.width),
        Number.NEGATIVE_INFINITY
      )
      const guideWidth = Number.isFinite(minX) && Number.isFinite(maxX) ? Math.max(maxX - minX + 140, 320) : 320
      const guideStartX = Number.isFinite(minX) ? minX - 70 : -70
      const generationGuideNodes: Node[] = uniqueGenerationRows.map((rowY, index) => ({
        id: `G:${index}`,
        position: { x: guideStartX, y: rowY + 56 },
        draggable: false,
        selectable: false,
        focusable: false,
        style: {
          width: guideWidth,
          height: 2,
          border: 'none',
          background: 'transparent',
          boxShadow: 'none',
          pointerEvents: 'none',
          zIndex: 0,
        },
        data: {
          label: <div className="tree-generation-guide-line" aria-hidden="true" />,
        },
      }))
      const nodes: Node[] = [...generationGuideNodes, ...baseNodes]

      const edges: Edge[] = laidOut.edges.map((edge: PositionedLayoutEdge) => {
        const isSpouse = edge.relationType === 'spouse'

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'orthogonal',
          animated: false,
          data: {
            points: edge.points,
          },
          style: isSpouse
            ? { strokeWidth: 2, stroke: '#b45309' }
            : edge.relationType === 'step_parent'
              ? { strokeWidth: 2.5, stroke: '#7c3aed', strokeDasharray: '8 6' }
              : edge.relationType === 'adopted_parent'
                ? { strokeWidth: 2.5, stroke: '#059669', strokeDasharray: '4 4' }
                : { strokeWidth: 2.5, stroke: '#1f2937' },
        }
      })

      setLayoutNodes(nodes)
      setLayoutEdges(edges)
      onLayoutChange(baseNodes, edges)
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
        edgeTypes={edgeTypes}
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
