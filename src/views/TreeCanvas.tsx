import ReactFlow, { Background, Controls } from 'reactflow'
import type { Edge, Node, ReactFlowInstance } from 'reactflow'
import 'reactflow/dist/style.css'

type Props = {
  nodes: Node[]
  edges: Edge[]
  onInit: (instance: ReactFlowInstance) => void
  onNodeSelect: (nodeId: string) => void
}

export default function TreeCanvas({ nodes, edges, onInit, onNodeSelect }: Props) {
  return (
    <div className="tree-flow-shell">
      <ReactFlow
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodes={nodes}
        nodesDraggable={false}
        nodesFocusable
        onInit={onInit}
        onNodeClick={(_, node) => {
          const nodeId = String(node.id)

          if (nodeId.startsWith('family-group-') || nodeId.startsWith('sibling-group-')) {
            return
          }

          onNodeSelect(nodeId)
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
