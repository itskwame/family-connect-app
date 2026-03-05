import ELK from 'elkjs/lib/elk.bundled.js'

export type LayoutNodeInput = {
  id: string
  type: 'person' | 'union'
  width: number
  height: number
}

export type LayoutEdgeInput = {
  id: string
  source: string
  target: string
  relationType: 'spouse' | 'parent' | 'step_parent' | 'adopted_parent'
}

export type PositionedLayoutNode = LayoutNodeInput & {
  x: number
  y: number
}

export type PositionedLayoutEdge = LayoutEdgeInput & {
  points: Array<{ x: number; y: number }>
}

const elk = new ELK()

export async function layoutTree(
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[],
  direction: 'DOWN' | 'UP' = 'DOWN'
) {
  const graph = await elk.layout({
    id: 'family-tree',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '44',
      'elk.layered.spacing.nodeNodeBetweenLayers': '95',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width,
      height: node.height,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  })

  const positionedNodes: PositionedLayoutNode[] = nodes.map((node) => {
    const laidOutNode = graph.children?.find((item) => item.id === node.id)

    return {
      ...node,
      x: laidOutNode?.x ?? 0,
      y: laidOutNode?.y ?? 0,
    }
  })

  const positionedEdges: PositionedLayoutEdge[] = edges.map((edge) => {
    const laidOutEdge = graph.edges?.find((item) => item.id === edge.id) as
      | {
          sections?: Array<{
            startPoint?: { x: number; y: number }
            bendPoints?: Array<{ x: number; y: number }>
            endPoint?: { x: number; y: number }
          }>
        }
      | undefined
    const section = laidOutEdge?.sections?.[0]
    const startPoint = section?.startPoint
    const bendPoints = section?.bendPoints ?? []
    const endPoint = section?.endPoint
    const points = [
      ...(startPoint ? [{ x: startPoint.x, y: startPoint.y }] : []),
      ...bendPoints.map((point: { x: number; y: number }) => ({ x: point.x, y: point.y })),
      ...(endPoint ? [{ x: endPoint.x, y: endPoint.y }] : []),
    ]

    return {
      ...edge,
      points,
    }
  })

  const bounds = positionedNodes.reduce(
    (acc, node) => {
      acc.minX = Math.min(acc.minX, node.x)
      acc.minY = Math.min(acc.minY, node.y)
      acc.maxX = Math.max(acc.maxX, node.x + node.width)
      acc.maxY = Math.max(acc.maxY, node.y + node.height)
      return acc
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  )

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    width: Number.isFinite(bounds.minX) ? bounds.maxX - bounds.minX : 0,
    height: Number.isFinite(bounds.minY) ? bounds.maxY - bounds.minY : 0,
  }
}
