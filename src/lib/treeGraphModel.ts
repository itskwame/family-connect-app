import type { LayoutEdgeInput, LayoutNodeInput, PositionedLayoutEdge, PositionedLayoutNode } from './layoutTree'

export type TreePerson = {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  city: string | null
  state: string | null
}

export type TreeRelationship = {
  id: string
  person_a_id: string
  person_b_id: string
  relationship_type: string
}

export type TreeGraphModel = {
  nodes: LayoutNodeInput[]
  edges: LayoutEdgeInput[]
  peopleById: Map<string, TreePerson>
}

type UnionBucket = {
  id: string
  parentIds: string[]
  childById: Map<string, 'parent' | 'step_parent' | 'adopted_parent'>
}

function buildUnionId(parentIds: string[], childId?: string) {
  if (parentIds.length >= 2) {
    const [left, right] = [...parentIds].sort()
    return `U:${left}|${right}`
  }

  return `U:${parentIds[0]}->${childId ?? 'none'}`
}

function pickChildRelationType(
  relationTypes: string[]
): 'parent' | 'step_parent' | 'adopted_parent' {
  if (relationTypes.includes('adopted_parent')) {
    return 'adopted_parent'
  }

  if (relationTypes.includes('step_parent')) {
    return 'step_parent'
  }

  return 'parent'
}

export function buildTreeGraphModel({
  people,
  relationships,
  visiblePersonIds,
}: {
  people: TreePerson[]
  relationships: TreeRelationship[]
  visiblePersonIds?: string[]
}): TreeGraphModel {
  const visibleSet =
    visiblePersonIds && visiblePersonIds.length > 0 ? new Set<string>(visiblePersonIds) : null
  const peopleById = new Map(people.map((person) => [person.id, person]))
  const parentByChild = new Map<string, Array<{ parentId: string; relationType: string }>>()
  const spousePairs = new Set<string>()

  const scopedRelationships = relationships.filter((relationship) => {
    if (!visibleSet) {
      return true
    }

    return visibleSet.has(relationship.person_a_id) && visibleSet.has(relationship.person_b_id)
  })

  for (const relationship of scopedRelationships) {
    if (
      relationship.relationship_type === 'parent' ||
      relationship.relationship_type === 'step_parent' ||
      relationship.relationship_type === 'adopted_parent'
    ) {
      if (!parentByChild.has(relationship.person_b_id)) {
        parentByChild.set(relationship.person_b_id, [])
      }
      parentByChild.get(relationship.person_b_id)?.push({
        parentId: relationship.person_a_id,
        relationType: relationship.relationship_type,
      })
    }

    if (relationship.relationship_type === 'spouse') {
      const pairKey = [relationship.person_a_id, relationship.person_b_id].sort().join('|')
      spousePairs.add(pairKey)
    }
  }

  const unionBuckets = new Map<string, UnionBucket>()

  for (const pairKey of spousePairs) {
    const parentIds = pairKey.split('|')
    const unionId = buildUnionId(parentIds)
    unionBuckets.set(unionId, {
      id: unionId,
      parentIds,
      childById: new Map(),
    })
  }

  for (const [childId, parents] of parentByChild.entries()) {
    const uniqueParentIds = Array.from(new Set(parents.map((item) => item.parentId)))
    const spouseParentPair =
      uniqueParentIds.length >= 2
        ? uniqueParentIds
            .map((leftParentId, index) =>
              uniqueParentIds
                .slice(index + 1)
                .map((rightParentId) => [leftParentId, rightParentId] as const)
            )
            .flat()
            .find(([leftParentId, rightParentId]) =>
              spousePairs.has([leftParentId, rightParentId].sort().join('|'))
            )
        : null

    const parentIds = spouseParentPair
      ? [spouseParentPair[0], spouseParentPair[1]]
      : uniqueParentIds.length >= 2
        ? [uniqueParentIds[0], uniqueParentIds[1]]
        : [uniqueParentIds[0]]

    if (!parentIds[0]) {
      continue
    }

    const unionId = buildUnionId(parentIds, childId)
    if (!unionBuckets.has(unionId)) {
      unionBuckets.set(unionId, {
        id: unionId,
        parentIds,
        childById: new Map(),
      })
    }

    const union = unionBuckets.get(unionId)!
    const childRelationTypes = parents
      .filter((item) => parentIds.includes(item.parentId))
      .map((item) => item.relationType)
    union.childById.set(childId, pickChildRelationType(childRelationTypes))
  }

  const nodeIds = new Set<string>()
  const layoutNodes: LayoutNodeInput[] = []
  const layoutEdges: LayoutEdgeInput[] = []

  const registerPersonNode = (personId: string) => {
    const nodeId = `P:${personId}`
    if (nodeIds.has(nodeId)) {
      return
    }

    nodeIds.add(nodeId)
    layoutNodes.push({
      id: nodeId,
      type: 'person',
      width: 190,
      height: 112,
    })
  }

  const registerUnionNode = (unionId: string) => {
    if (nodeIds.has(unionId)) {
      return
    }

    nodeIds.add(unionId)
    layoutNodes.push({
      id: unionId,
      type: 'union',
      width: 18,
      height: 18,
    })
  }

  for (const union of unionBuckets.values()) {
    registerUnionNode(union.id)

    for (const parentId of union.parentIds) {
      if (!peopleById.has(parentId)) {
        continue
      }

      registerPersonNode(parentId)
      layoutEdges.push({
        id: `E:spouse:${parentId}:${union.id}`,
        source: `P:${parentId}`,
        target: union.id,
        relationType: 'spouse',
      })
    }

    for (const [childId, relationType] of union.childById.entries()) {
      if (!peopleById.has(childId)) {
        continue
      }

      registerPersonNode(childId)
      layoutEdges.push({
        id: `E:child:${union.id}:${childId}`,
        source: union.id,
        target: `P:${childId}`,
        relationType,
      })
    }
  }

  if (!visibleSet) {
    for (const person of people) {
      if (nodeIds.has(`P:${person.id}`)) {
        continue
      }

      layoutNodes.push({
        id: `P:${person.id}`,
        type: 'person',
        width: 190,
        height: 112,
      })
      nodeIds.add(`P:${person.id}`)
    }
  }

  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    peopleById,
  }
}

export function buildTreeSvgFromLayout({
  nodes,
  edges,
  peopleById,
}: {
  nodes: PositionedLayoutNode[]
  edges: PositionedLayoutEdge[]
  peopleById: Map<string, TreePerson>
}) {
  const margin = 24
  const minX = Math.min(...nodes.map((node) => node.x), 0)
  const minY = Math.min(...nodes.map((node) => node.y), 0)
  const maxX = Math.max(...nodes.map((node) => node.x + node.width), 0)
  const maxY = Math.max(...nodes.map((node) => node.y + node.height), 0)
  const width = maxX - minX + margin * 2
  const height = maxY - minY + margin * 2

  const translateX = margin - minX
  const translateY = margin - minY

  const edgeMarkup = edges
    .map((edge) => {
      if (edge.points.length < 2) {
        return ''
      }

      const stroke =
        edge.relationType === 'spouse'
          ? '#b45309'
          : edge.relationType === 'step_parent'
            ? '#7c3aed'
            : edge.relationType === 'adopted_parent'
              ? '#059669'
              : '#1f2937'
      const dash =
        edge.relationType === 'step_parent'
          ? '8 6'
          : edge.relationType === 'adopted_parent'
            ? '4 4'
            : ''
      const path = edge.points
        .map((point, index) =>
          `${index === 0 ? 'M' : 'L'} ${point.x + translateX} ${point.y + translateY}`
        )
        .join(' ')

      return `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${
        edge.relationType === 'spouse' ? 2 : 2.5
      }" ${dash ? `stroke-dasharray="${dash}"` : ''} />`
    })
    .join('')

  const nodeMarkup = nodes
    .map((node) => {
      if (node.type === 'union') {
        return `<circle cx="${node.x + node.width / 2 + translateX}" cy="${node.y + node.height / 2 + translateY}" r="6" fill="#0f172a" />`
      }

      const personId = node.id.replace(/^P:/, '')
      const person = peopleById.get(personId)
      const name = person ? `${person.first_name} ${person.last_name}`.trim() : 'Unknown member'
      const details = person?.birth_date ? String(new Date(person.birth_date).getFullYear()) : ''

      return `<g>
        <rect x="${node.x + translateX}" y="${node.y + translateY}" width="${node.width}" height="${node.height}" rx="12" ry="12" fill="#ffffff" stroke="#1f2a44" stroke-width="2" />
        <text x="${node.x + 16 + translateX}" y="${node.y + 30 + translateY}" font-size="14" font-weight="700" fill="#1f2a44">${name}</text>
        ${details ? `<text x="${node.x + 16 + translateX}" y="${node.y + 56 + translateY}" font-size="12" fill="#64748b">${details}</text>` : ''}
      </g>`
    })
    .join('')

  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(
    width,
    816
  )}" height="${Math.max(height, 680)}" viewBox="0 0 ${Math.max(width, 816)} ${Math.max(
    height,
    680
  )}">
    <rect width="100%" height="100%" fill="#f8f9fb" />
    ${edgeMarkup}
    ${nodeMarkup}
  </svg>`

  return {
    svgMarkup,
    width: Math.max(width, 816),
    height: Math.max(height, 680),
    nodeCount: nodes.filter((node) => node.type === 'person').length,
  }
}
