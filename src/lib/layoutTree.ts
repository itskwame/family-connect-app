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

const LEVEL_GAP = 180
const BUS_OFFSET = 42

type NodeMap = Map<string, PositionedLayoutNode>

function buildNodeMap(nodes: PositionedLayoutNode[]): NodeMap {
  return new Map(nodes.map((node) => [node.id, node]))
}

function getCenterX(node: PositionedLayoutNode) {
  return node.x + node.width / 2
}

function getCenterY(node: PositionedLayoutNode) {
  return node.y + node.height / 2
}

function getLevelizedNodes(nodes: PositionedLayoutNode[], edges: LayoutEdgeInput[]) {
  const levels = new Map<string, number>(nodes.map((node) => [node.id, 0]))
  let updated = true

  while (updated) {
    updated = false

    for (const edge of edges) {
      const sourceLevel = levels.get(edge.source) ?? 0
      const targetLevel = levels.get(edge.target) ?? 0

      if (edge.relationType === 'spouse') {
        const shared = Math.max(sourceLevel, targetLevel)
        if (sourceLevel !== shared) {
          levels.set(edge.source, shared)
          updated = true
        }
        if (targetLevel !== shared) {
          levels.set(edge.target, shared)
          updated = true
        }
        continue
      }

      const required = sourceLevel + 1
      if (targetLevel < required) {
        levels.set(edge.target, required)
        updated = true
      }
    }
  }

  const leveled = nodes.map((node) => ({
    ...node,
    y: (levels.get(node.id) ?? 0) * LEVEL_GAP,
  }))

  return {
    nodes: leveled,
    levels,
  }
}

function centerUnionsBetweenSpouses(nodes: PositionedLayoutNode[], edges: LayoutEdgeInput[]) {
  const nodeMap = buildNodeMap(nodes)
  const spousesByUnion = new Map<string, PositionedLayoutNode[]>()

  for (const edge of edges) {
    if (edge.relationType !== 'spouse') {
      continue
    }

    const spouse = nodeMap.get(edge.source)
    const union = nodeMap.get(edge.target)
    if (!spouse || !union) {
      continue
    }

    if (!spousesByUnion.has(union.id)) {
      spousesByUnion.set(union.id, [])
    }
    spousesByUnion.get(union.id)?.push(spouse)
  }

  for (const [unionId, spouses] of spousesByUnion.entries()) {
    const union = nodeMap.get(unionId)
    if (!union || spouses.length === 0) {
      continue
    }

    const spouseCenters = spouses.map((spouse) => getCenterX(spouse)).sort((a, b) => a - b)
    const midpoint = spouseCenters.length === 1
      ? spouseCenters[0]
      : (spouseCenters[0] + spouseCenters[spouseCenters.length - 1]) / 2
    union.x = midpoint - union.width / 2
  }

  return nodes
}

function buildOrthogonalEdges(
  nodes: PositionedLayoutNode[],
  edges: LayoutEdgeInput[]
): PositionedLayoutEdge[] {
  const nodeMap = buildNodeMap(nodes)
  const childrenByUnion = new Map<string, LayoutEdgeInput[]>()

  for (const edge of edges) {
    if (edge.relationType !== 'spouse') {
      if (!childrenByUnion.has(edge.source)) {
        childrenByUnion.set(edge.source, [])
      }
      childrenByUnion.get(edge.source)?.push(edge)
    }
  }

  return edges.map((edge) => {
    const source = nodeMap.get(edge.source)
    const target = nodeMap.get(edge.target)
    if (!source || !target) {
      return {
        ...edge,
        points: [],
      }
    }

    if (edge.relationType === 'spouse') {
      const sourceX = getCenterX(source)
      const targetX = getCenterX(target)
      const y = getCenterY(source)
      return {
        ...edge,
        points: [
          { x: sourceX, y },
          { x: targetX, y },
        ],
      }
    }

    const unionCenterX = getCenterX(source)
    const childCenterX = getCenterX(target)
    const startY = source.y + source.height
    const busY = startY + BUS_OFFSET

    return {
      ...edge,
      points: [
        { x: unionCenterX, y: startY },
        { x: unionCenterX, y: busY },
        { x: childCenterX, y: busY },
        { x: childCenterX, y: target.y },
      ],
    }
  })
}

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
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
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

  const elkNodes: PositionedLayoutNode[] = nodes.map((node) => {
    const laidOutNode = graph.children?.find((item) => item.id === node.id)

    return {
      ...node,
      x: laidOutNode?.x ?? 0,
      y: laidOutNode?.y ?? 0,
    }
  })

  const { nodes: leveledNodes } = getLevelizedNodes(elkNodes, edges)
  const centeredNodes = centerUnionsBetweenSpouses(leveledNodes, edges)
  const positionedEdges = buildOrthogonalEdges(centeredNodes, edges)

  const bounds = centeredNodes.reduce(
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
    nodes: centeredNodes,
    edges: positionedEdges,
    width: Number.isFinite(bounds.minX) ? bounds.maxX - bounds.minX : 0,
    height: Number.isFinite(bounds.minY) ? bounds.maxY - bounds.minY : 0,
  }
}
