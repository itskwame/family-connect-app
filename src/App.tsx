import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import dagre from 'dagre'
import type { Edge as FlowEdge, Node as FlowNode, ReactFlowInstance } from 'reactflow'
import './App.css'
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabase'

const TreeCanvas = lazy(() => import('./views/TreeCanvas'))
const PathfinderWorkspace = lazy(() => import('./views/PathfinderWorkspace'))
const MapWorkspace = lazy(() => import('./views/MapWorkspace'))

type Route = 'landing' | 'signup' | 'login' | 'family' | 'onboarding' | 'workspace'
type WorkspaceView =
  | 'home'
  | 'tree'
  | 'pathfinder'
  | 'businesses'
  | 'map'
  | 'messages'
  | 'profile'
  | 'export'
type CandidateProfile = {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  city: string | null
  state: string | null
  parent_hints: string[]
}
type ProfileRecord = {
  id: string
  first_name: string
  last_name: string
  gender: string | null
  birth_date: string | null
  city: string | null
  state: string | null
  zip: string | null
  bio: string | null
  contact_email: string | null
  contact_phone: string | null
  profile_photo_url: string | null
  business_name: string | null
  business_logo_url: string | null
  business_category: string | null
  business_description: string | null
  business_city: string | null
  business_state: string | null
  business_website: string | null
  business_instagram: string | null
  business_facebook: string | null
}
type ProfileTab = 'overview' | 'timeline' | 'media' | 'connections' | 'business'
type ConnectionItem = {
  id: string
  name: string
  relationshipLabel: string
}
type TimelineItem = {
  id: string
  event_type: string
  event_date: string | null
  description: string
}
type MediaItem = {
  id: string
  media_url: string
  caption: string | null
}
type PersonOption = {
  id: string
  name: string
}
type ConversationListItem = {
  id: string
  type: 'direct' | 'group' | 'family'
  title: string
  participantIds: string[]
  preview: string
  unreadCount: number
}
type MessageItem = {
  id: string
  sender_person_id: string
  content: string
  media_url: string | null
  created_at: string
  read_at: string | null
}
type FeedPostItem = {
  id: string
  authorPersonId: string
  authorName: string
  content: string
  mediaUrl: string | null
  createdAt: string
  likeCount: number
  commentCount: number
  likedByMe: boolean
}
type BusinessDirectoryItem = {
  id: string
  ownerName: string
  businessName: string
  businessLogoUrl: string | null
  businessCategory: string | null
  businessDescription: string | null
  businessCity: string | null
  businessState: string | null
  businessWebsite: string | null
}
type FamilyMapCluster = {
  id: string
  label: string
  city: string | null
  state: string | null
  zip: string | null
  count: number
  peopleNames: string[]
  latitude: number
  longitude: number
}
type TreePersonItem = {
  id: string
  first_name: string
  last_name: string
  gender: string | null
  birth_date: string | null
  city: string | null
  state: string | null
  business_name: string | null
}
type TreeRelationshipItem = {
  id: string
  person_a_id: string
  person_b_id: string
  relationship_type: string
  locked: boolean
}
type TreeRelativeLink = {
  person: TreePersonItem
  relationshipType: 'parent' | 'step_parent' | 'adopted_parent'
}
type TreeCollapseState = {
  ancestors: boolean
  descendants: boolean
  siblings: boolean
  spouses: boolean
}
type PathfinderStep = {
  fromId: string
  toId: string
  relationLabel: string
}
type PathfinderResult = {
  personAId: string
  personBId: string
  summary: string
  pathPersonIds: string[]
  steps: PathfinderStep[]
}

const workspaceViews: WorkspaceView[] = [
  'home',
  'tree',
  'pathfinder',
  'businesses',
  'map',
  'messages',
  'profile',
  'export',
]
const FAMILY_ID_STORAGE_KEY = 'family-connect.current-family-id'
const FAMILY_NAME_STORAGE_KEY = 'family-connect.current-family-name'
const PERSON_ID_STORAGE_KEY = 'family-connect.current-person-id'
const PERSON_NAME_STORAGE_KEY = 'family-connect.current-person-name'
const DEV_NO_AUTH_TEST_MODE = import.meta.env.VITE_DEV_NO_AUTH === 'true'
const DEV_TEST_FAMILY_ID = 'dev-family-mark-white'
const DEV_TEST_PERSON_ID = 'person-great-1-1-1'

function createInviteToken() {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()
      : Math.random().toString(36).slice(2, 14).toUpperCase()

  return `JOIN-${randomPart}`
}

function extractInviteToken(input: string) {
  const value = input.trim()

  if (value === '') {
    return ''
  }

  try {
    const parsedUrl = new URL(value)

    return (
      parsedUrl.searchParams.get('token') ??
      parsedUrl.searchParams.get('invite') ??
      parsedUrl.searchParams.get('code') ??
      value
    )
  } catch {
    return value
  }
}

function splitFullName(value: string) {
  const cleaned = value.trim().replace(/\s+/g, ' ')

  if (cleaned === '') {
    return { firstName: 'Unknown', lastName: '' }
  }

  const parts = cleaned.split(' ')

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function isUnknownParentName(value: string) {
  return value.trim().toLowerCase() === 'unknown'
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function isParentRelationshipType(value: string) {
  return value === 'parent' || value === 'step_parent' || value === 'adopted_parent'
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isSamePersonName(
  person: Pick<TreePersonItem, 'first_name' | 'last_name'>,
  firstName: string,
  lastName: string
) {
  return (
    normalizeName(person.first_name) === normalizeName(firstName) &&
    normalizeName(person.last_name) === normalizeName(lastName)
  )
}

function buildPathfinderSummary(
  personAName: string,
  personBName: string,
  relationLabels: string[]
) {
  if (relationLabels.length === 0) {
    return `${personAName} and ${personBName} are the same person.`
  }

  if (relationLabels.length === 1) {
    const [label] = relationLabels

    switch (label) {
      case 'parent':
        return `${personBName} is ${personAName}'s parent.`
      case 'step parent':
        return `${personBName} is ${personAName}'s step parent.`
      case 'adoptive parent':
        return `${personBName} is ${personAName}'s adoptive parent.`
      case 'child':
        return `${personBName} is ${personAName}'s child.`
      case 'spouse':
        return `${personBName} is ${personAName}'s spouse.`
      case 'sibling':
        return `${personBName} is ${personAName}'s sibling.`
      default:
        return `${personAName} is connected to ${personBName} through ${label}.`
    }
  }

  if (relationLabels.length === 2) {
    const pathKey = relationLabels.join('>')

    switch (pathKey) {
      case 'parent>parent':
        return `${personBName} is ${personAName}'s grandparent.`
      case 'child>child':
        return `${personBName} is ${personAName}'s grandchild.`
      case 'parent>sibling':
        return `${personBName} is ${personAName}'s aunt or uncle.`
      case 'sibling>child':
        return `${personBName} is ${personAName}'s niece or nephew.`
      case 'spouse>parent':
        return `${personBName} is ${personAName}'s parent-in-law.`
      default:
        return `${personAName} is connected to ${personBName} through ${relationLabels.length} steps.`
    }
  }

  return `${personAName} is connected to ${personBName} through ${relationLabels.length} relationships.`
}

const STATE_MAP_CENTERS: Record<string, [number, number]> = {
  AL: [32.8067, -86.7911],
  AK: [61.3707, -152.4044],
  AZ: [33.7298, -111.4312],
  AR: [34.9697, -92.3731],
  CA: [36.1162, -119.6816],
  CO: [39.0598, -105.3111],
  CT: [41.5978, -72.7554],
  DE: [39.3185, -75.5071],
  FL: [27.7663, -81.6868],
  GA: [33.0406, -83.6431],
  HI: [21.0943, -157.4983],
  ID: [44.2405, -114.4788],
  IL: [40.3495, -88.9861],
  IN: [39.8494, -86.2583],
  IA: [42.0115, -93.2105],
  KS: [38.5266, -96.7265],
  KY: [37.6681, -84.6701],
  LA: [31.1695, -91.8678],
  ME: [44.6939, -69.3819],
  MD: [39.0639, -76.8021],
  MA: [42.2302, -71.5301],
  MI: [43.3266, -84.5361],
  MN: [45.6945, -93.9002],
  MS: [32.7416, -89.6787],
  MO: [38.4561, -92.2884],
  MT: [46.9219, -110.4544],
  NE: [41.1254, -98.2681],
  NV: [38.3135, -117.0554],
  NH: [43.4525, -71.5639],
  NJ: [40.2989, -74.521],
  NM: [34.8405, -106.2485],
  NY: [42.1657, -74.9481],
  NC: [35.6301, -79.8064],
  ND: [47.5289, -99.784],
  OH: [40.3888, -82.7649],
  OK: [35.5653, -96.9289],
  OR: [44.572, -122.0709],
  PA: [40.5908, -77.2098],
  RI: [41.6809, -71.5118],
  SC: [33.8569, -80.945],
  SD: [44.2998, -99.4388],
  TN: [35.7478, -86.6923],
  TX: [31.0545, -97.5635],
  UT: [40.1500, -111.8624],
  VT: [44.0459, -72.7107],
  VA: [37.7693, -78.17],
  WA: [47.4009, -121.4905],
  WV: [38.4912, -80.9545],
  WI: [44.2685, -89.6165],
  WY: [42.756, -107.3025],
  DC: [38.9072, -77.0369],
}

const EXPORT_TEMPLATES = [
  { id: 'heritage', name: 'Heritage', fill: '#ffffff', stroke: '#1f2a44', accent: '#2fb8a3' },
  { id: 'linen', name: 'Linen', fill: '#faf7f0', stroke: '#6b7280', accent: '#1f2a44' },
  { id: 'legacy', name: 'Legacy', fill: '#f8fafc', stroke: '#0f172a', accent: '#f4b942' },
  { id: 'teal', name: 'Teal', fill: '#f0fdfa', stroke: '#115e59', accent: '#14b8a6' },
  { id: 'navy', name: 'Navy', fill: '#eef2ff', stroke: '#1e3a8a', accent: '#60a5fa' },
  { id: 'sage', name: 'Sage', fill: '#f0fdf4', stroke: '#166534', accent: '#86efac' },
  { id: 'ember', name: 'Ember', fill: '#fff7ed', stroke: '#9a3412', accent: '#fb923c' },
  { id: 'plum', name: 'Plum', fill: '#faf5ff', stroke: '#6b21a8', accent: '#c084fc' },
  { id: 'slate', name: 'Slate', fill: '#f8fafc', stroke: '#334155', accent: '#94a3b8' },
  { id: 'midnight', name: 'Midnight', fill: '#e2e8f0', stroke: '#020617', accent: '#0ea5e9' },
] as const

const EXPORT_PRESET_LABELS = {
  immediate_family: 'Immediate Family',
  ancestor_fan: 'Ancestor Fan',
  descendant_poster: 'Descendant Poster',
  maternal_line: 'Maternal Line',
  paternal_line: 'Paternal Line',
  one_page_letter: 'One-Page Letter',
} as const

function hashLocationKey(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function estimateLocationCoordinates(city: string | null, state: string | null, zip: string | null) {
  const normalizedState = (state ?? '').trim().toUpperCase()
  const base = STATE_MAP_CENTERS[normalizedState] ?? [39.8283, -98.5795]
  const hashSeed = hashLocationKey(`${city ?? ''}|${state ?? ''}|${zip ?? ''}`)
  const latOffset = ((hashSeed % 900) / 1000 - 0.45) * 2.2
  const lngOffset = (((Math.floor(hashSeed / 1000) % 900) / 1000) - 0.45) * 2.8

  return {
    latitude: Math.max(Math.min(base[0] + latOffset, 71), 18),
    longitude: Math.max(Math.min(base[1] + lngOffset, -66), -168),
  }
}

function buildProfileForm(record: ProfileRecord) {
  return {
    firstName: record.first_name ?? '',
    lastName: record.last_name ?? '',
    gender: record.gender ?? '',
    birthDate: record.birth_date ?? '',
    city: record.city ?? '',
    state: record.state ?? '',
    zip: record.zip ?? '',
    bio: record.bio ?? '',
    contactEmail: record.contact_email ?? '',
    contactPhone: record.contact_phone ?? '',
    businessName: record.business_name ?? '',
    businessLogoUrl: record.business_logo_url ?? '',
    businessCategory: record.business_category ?? '',
    businessDescription: record.business_description ?? '',
    businessCity: record.business_city ?? '',
    businessState: record.business_state ?? '',
    businessWebsite: record.business_website ?? '',
    businessInstagram: record.business_instagram ?? '',
    businessFacebook: record.business_facebook ?? '',
  }
}

function buildDevWhiteFamilySeed() {
  const familyId = DEV_TEST_FAMILY_ID
  const now = Date.now()
  const locations = [
    { city: 'Atlanta', state: 'GA', zip: '30301', latitude: 33.749, longitude: -84.388 },
    { city: 'Charlotte', state: 'NC', zip: '28202', latitude: 35.227, longitude: -80.843 },
    { city: 'Dallas', state: 'TX', zip: '75201', latitude: 32.7767, longitude: -96.797 },
    { city: 'Houston', state: 'TX', zip: '77002', latitude: 29.7604, longitude: -95.3698 },
    { city: 'Orlando', state: 'FL', zip: '32801', latitude: 28.5383, longitude: -81.3792 },
    { city: 'Nashville', state: 'TN', zip: '37201', latitude: 36.1627, longitude: -86.7816 },
    { city: 'Chicago', state: 'IL', zip: '60601', latitude: 41.8781, longitude: -87.6298 },
    { city: 'Los Angeles', state: 'CA', zip: '90012', latitude: 34.0522, longitude: -118.2437 },
  ]

  const peopleMeta = new Map<
    string,
    {
      id: string
      first_name: string
      last_name: string
      gender: string | null
      birth_date: string | null
      city: string | null
      state: string | null
      zip: string | null
      business_name: string | null
      business_category?: string | null
      business_description?: string | null
      business_city?: string | null
      business_state?: string | null
      business_website?: string | null
    }
  >()
  const people: TreePersonItem[] = []
  const relationships: TreeRelationshipItem[] = []
  let relationshipCounter = 1
  let locationCursor = 0

  const addPerson = (
    id: string,
    firstName: string,
    lastName: string,
    gender: string,
    birthDate: string,
    businessName: string | null = null
  ) => {
    const location = locations[locationCursor % locations.length]
    locationCursor += 1
    const personRecord = {
      id,
      first_name: firstName,
      last_name: lastName,
      gender,
      birth_date: birthDate,
      city: location.city,
      state: location.state,
      zip: location.zip,
      business_name: businessName,
      business_category: businessName ? 'Family Business' : null,
      business_description: businessName
        ? `${businessName} is part of the White family business directory seed data.`
        : null,
      business_city: businessName ? location.city : null,
      business_state: businessName ? location.state : null,
      business_website: businessName ? `https://${businessName.toLowerCase().replace(/\s+/g, '')}.example.com` : null,
    }

    peopleMeta.set(id, personRecord)
    people.push({
      id,
      first_name: firstName,
      last_name: lastName,
      gender,
      birth_date: birthDate,
      city: location.city,
      state: location.state,
      business_name: businessName,
    })
  }

  const addRelationship = (personAId: string, personBId: string, relationshipType: string) => {
    relationships.push({
      id: `rel-${relationshipCounter}`,
      person_a_id: personAId,
      person_b_id: personBId,
      relationship_type: relationshipType,
      locked: true,
    })
    relationshipCounter += 1
  }

  addPerson('person-mark-white-sr', 'Mark', 'White', 'Male', '1938-04-14', 'White Family Holdings')
  addPerson('person-spouse-1', 'Evelyn', 'White', 'Female', '1942-07-09', null)
  addPerson('person-spouse-2', 'Donna', 'White', 'Female', '1947-02-18', null)
  addRelationship('person-mark-white-sr', 'person-spouse-1', 'spouse')
  addRelationship('person-mark-white-sr', 'person-spouse-2', 'spouse')

  const childNames = [
    { first: 'Mark', last: 'White Jr', gender: 'Male' },
    { first: 'Angela', last: 'White', gender: 'Female' },
    { first: 'Benjamin', last: 'White', gender: 'Male' },
    { first: 'Carla', last: 'White', gender: 'Female' },
    { first: 'Derrick', last: 'White', gender: 'Male' },
    { first: 'Elaine', last: 'White', gender: 'Female' },
    { first: 'Frank', last: 'White', gender: 'Male' },
    { first: 'Gloria', last: 'White', gender: 'Female' },
    { first: 'Harold', last: 'White', gender: 'Male' },
    { first: 'Irene', last: 'White', gender: 'Female' },
    { first: 'James', last: 'White', gender: 'Male' },
    { first: 'Karen', last: 'White', gender: 'Female' },
    { first: 'Leon', last: 'White', gender: 'Male' },
    { first: 'Monica', last: 'White', gender: 'Female' },
    { first: 'Nathan', last: 'White', gender: 'Male' },
    { first: 'Olivia', last: 'White', gender: 'Female' },
    { first: 'Patrick', last: 'White', gender: 'Male' },
    { first: 'Queenie', last: 'White', gender: 'Female' },
  ]

  const markJrChildren = ['Eric', 'Melissa', 'David', 'Nina']
  const businesses: BusinessDirectoryItem[] = []
  const currentPersonId = DEV_TEST_PERSON_ID
  let currentPersonName = 'Jordan White'

  childNames.forEach((child, childIndex) => {
    const childId = `person-child-${childIndex + 1}`
    const childSpouseId = `person-child-spouse-${childIndex + 1}`
    const parentSpouseId = childIndex < 9 ? 'person-spouse-1' : 'person-spouse-2'
    const childBirthYear = 1962 + childIndex

    addPerson(
      childId,
      child.first,
      child.last,
      child.gender,
      `${childBirthYear}-05-12`,
      childIndex % 4 === 0 ? `${child.first} ${child.last} Ventures` : null
    )
    addPerson(
      childSpouseId,
      `${child.first}Partner`,
      child.last === 'White Jr' ? 'Carter' : child.last,
      child.gender === 'Male' ? 'Female' : 'Male',
      `${childBirthYear + 2}-08-20`
    )

    addRelationship('person-mark-white-sr', childId, 'parent')
    addRelationship(parentSpouseId, childId, 'parent')
    addRelationship(childId, childSpouseId, 'spouse')

    const grandchildCount = child.first === 'Mark' ? 4 : 2

    for (let grandchildIndex = 0; grandchildIndex < grandchildCount; grandchildIndex += 1) {
      const grandchildId = `person-grand-${childIndex + 1}-${grandchildIndex + 1}`
      const grandchildSpouseId = `person-grand-spouse-${childIndex + 1}-${grandchildIndex + 1}`
      const grandchildBirthYear = childBirthYear + 24 + grandchildIndex

      const grandchildFirstName =
        child.first === 'Mark'
          ? markJrChildren[grandchildIndex]
          : `${child.first}${grandchildIndex + 1}`
      const grandchildGender = grandchildIndex % 2 === 0 ? 'Male' : 'Female'

      addPerson(
        grandchildId,
        grandchildFirstName,
        'White',
        grandchildGender,
        `${grandchildBirthYear}-03-15`,
        grandchildIndex === 0 && childIndex % 3 === 0 ? `${grandchildFirstName} White Studio` : null
      )
      addPerson(
        grandchildSpouseId,
        `${grandchildFirstName}Spouse`,
        grandchildFirstName === 'Eric' ? 'White' : 'Lane',
        grandchildGender === 'Male' ? 'Female' : 'Male',
        `${grandchildBirthYear + 1}-11-08`
      )

      addRelationship(childId, grandchildId, 'parent')
      addRelationship(childSpouseId, grandchildId, 'parent')
      addRelationship(grandchildId, grandchildSpouseId, 'spouse')

      for (let greatGrandchildIndex = 0; greatGrandchildIndex < 2; greatGrandchildIndex += 1) {
        const greatGrandchildId = `person-great-${childIndex + 1}-${grandchildIndex + 1}-${greatGrandchildIndex + 1}`
        const greatGrandchildBirthYear = grandchildBirthYear + 23 + greatGrandchildIndex
        const greatGrandchildFirstName =
          grandchildFirstName === 'Eric'
            ? greatGrandchildIndex === 0
              ? 'Jordan'
              : 'Emma'
            : `${grandchildFirstName}Kid${greatGrandchildIndex + 1}`

        addPerson(
          greatGrandchildId,
          greatGrandchildFirstName,
          'White',
          greatGrandchildIndex % 2 === 0 ? 'Male' : 'Female',
          `${greatGrandchildBirthYear}-09-03`
        )

        addRelationship(grandchildId, greatGrandchildId, 'parent')
        addRelationship(grandchildSpouseId, greatGrandchildId, 'parent')

        if (greatGrandchildId === currentPersonId) {
          currentPersonName = `${greatGrandchildFirstName} White`
        }
      }
    }
  })

  for (const person of peopleMeta.values()) {
    if (person.business_name) {
      businesses.push({
        id: person.id,
        ownerName: `${person.first_name} ${person.last_name}`.trim(),
        businessName: person.business_name,
        businessLogoUrl: null,
        businessCategory: person.business_category ?? null,
        businessDescription: person.business_description ?? null,
        businessCity: person.business_city ?? person.city ?? null,
        businessState: person.business_state ?? person.state ?? null,
        businessWebsite: person.business_website ?? null,
      })
    }
  }

  const profileSource = peopleMeta.get(currentPersonId)
  const profile: ProfileRecord = {
    id: currentPersonId,
    first_name: profileSource?.first_name ?? 'Jordan',
    last_name: profileSource?.last_name ?? 'White',
    gender: profileSource?.gender ?? 'Male',
    birth_date: profileSource?.birth_date ?? '2001-09-03',
    city: profileSource?.city ?? 'Atlanta',
    state: profileSource?.state ?? 'GA',
    zip: profileSource?.zip ?? '30301',
    bio: 'Temporary seeded profile for testing the full app experience.',
    contact_email: 'jordan.white@example.com',
    contact_phone: '555-0137',
    profile_photo_url: null,
    business_name: null,
    business_logo_url: null,
    business_category: null,
    business_description: null,
    business_city: null,
    business_state: null,
    business_website: null,
    business_instagram: null,
    business_facebook: null,
  }

  const peopleOptions: PersonOption[] = people
    .map((person) => ({
      id: person.id,
      name: `${person.first_name} ${person.last_name}`.trim(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const clusterMap = new Map<string, FamilyMapCluster>()
  for (const person of peopleMeta.values()) {
    const city = person.city ?? ''
    const state = person.state ?? ''
    const zip = person.zip ?? ''
    const key = `${city}|${state}|${zip}`
    const location = locations.find(
      (item) => item.city === city && item.state === state && item.zip === zip
    )
    if (!location) {
      continue
    }

    const existing = clusterMap.get(key)
    if (existing) {
      existing.count += 1
      existing.peopleNames.push(`${person.first_name} ${person.last_name}`.trim())
      continue
    }

    clusterMap.set(key, {
      id: `cluster-${clusterMap.size + 1}`,
      label: `${city}, ${state}`,
      city,
      state,
      zip,
      count: 1,
      peopleNames: [`${person.first_name} ${person.last_name}`.trim()],
      latitude: location.latitude,
      longitude: location.longitude,
    })
  }

  const familyConversationId = 'conv-family-chat'
  const directConversationId = 'conv-direct-eric'
  const messages: MessageItem[] = [
    {
      id: 'msg-1',
      sender_person_id: 'person-grand-1-1',
      content: 'Family reunion is this Saturday at 2 PM.',
      media_url: null,
      created_at: new Date(now - 1000 * 60 * 45).toISOString(),
      read_at: new Date(now - 1000 * 60 * 10).toISOString(),
    },
    {
      id: 'msg-2',
      sender_person_id: currentPersonId,
      content: 'I can bring dessert and drinks.',
      media_url: null,
      created_at: new Date(now - 1000 * 60 * 30).toISOString(),
      read_at: new Date(now - 1000 * 60 * 30).toISOString(),
    },
    {
      id: 'msg-3',
      sender_person_id: 'person-grand-1-1',
      content: 'Perfect. Please invite your siblings too.',
      media_url: null,
      created_at: new Date(now - 1000 * 60 * 12).toISOString(),
      read_at: null,
    },
  ]

  return {
    familyId,
    familyName: 'The White Family',
    currentPersonId,
    currentPersonName,
    rootId: 'person-mark-white-sr',
    inviteToken: 'JOIN-WHITE-DEV-2026',
    people,
    relationships,
    profile,
    connections: [
      { id: 'con-1', name: 'Eric White', relationshipLabel: 'Father' },
      { id: 'con-2', name: 'EricSpouse White', relationshipLabel: 'Mother' },
      { id: 'con-3', name: 'Emma White', relationshipLabel: 'Sibling' },
      { id: 'con-4', name: 'Mark White Jr', relationshipLabel: 'Grandfather' },
    ],
    timeline: [
      { id: 'timeline-1', event_type: 'birth', event_date: '2001-09-03', description: 'Born in Atlanta, GA.' },
      { id: 'timeline-2', event_type: 'school', event_date: '2019-05-22', description: 'Graduated high school.' },
      { id: 'timeline-3', event_type: 'career', event_date: '2024-06-01', description: 'Started first full-time role.' },
    ],
    media: [
      {
        id: 'media-1',
        media_url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=80',
        caption: 'Family cookout',
      },
      {
        id: 'media-2',
        media_url: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80',
        caption: 'Reunion day',
      },
    ],
    peopleOptions,
    businesses,
    familyMapClusters: Array.from(clusterMap.values()),
    feedPosts: [
      {
        id: 'post-1',
        authorPersonId: 'person-mark-white-sr',
        authorName: 'Mark White',
        content: 'Welcome to the new family space. Keep the tree updated as we grow.',
        mediaUrl: null,
        createdAt: new Date(now - 1000 * 60 * 60 * 3).toISOString(),
        likeCount: 8,
        commentCount: 3,
        likedByMe: true,
      },
      {
        id: 'post-2',
        authorPersonId: 'person-grand-1-1',
        authorName: 'Eric White',
        content: 'I uploaded photos from last year’s reunion.',
        mediaUrl: 'https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=1200&q=80',
        createdAt: new Date(now - 1000 * 60 * 95).toISOString(),
        likeCount: 5,
        commentCount: 1,
        likedByMe: false,
      },
      {
        id: 'post-3',
        authorPersonId: currentPersonId,
        authorName: currentPersonName,
        content: 'Testing Pathfinder now that we have multiple generations loaded.',
        mediaUrl: null,
        createdAt: new Date(now - 1000 * 60 * 30).toISOString(),
        likeCount: 2,
        commentCount: 0,
        likedByMe: false,
      },
      {
        id: 'post-4',
        authorPersonId: 'person-child-1',
        authorName: 'Mark White Jr',
        content: 'Eric, Melissa, David, and Nina are all added now. Check your branches.',
        mediaUrl: null,
        createdAt: new Date(now - 1000 * 60 * 80).toISOString(),
        likeCount: 9,
        commentCount: 2,
        likedByMe: false,
      },
      {
        id: 'post-5',
        authorPersonId: 'person-child-2',
        authorName: 'Angela White',
        content: 'Family cookout is this Sunday. RSVP in chat.',
        mediaUrl: null,
        createdAt: new Date(now - 1000 * 60 * 70).toISOString(),
        likeCount: 6,
        commentCount: 1,
        likedByMe: false,
      },
      {
        id: 'post-6',
        authorPersonId: 'person-child-3',
        authorName: 'Benjamin White',
        content: 'I updated business details in the directory.',
        mediaUrl: null,
        createdAt: new Date(now - 1000 * 60 * 60).toISOString(),
        likeCount: 5,
        commentCount: 0,
        likedByMe: false,
      },
      {
        id: 'post-7',
        authorPersonId: 'person-child-4',
        authorName: 'Carla White',
        content: 'Map view looks great with our city clusters.',
        mediaUrl: null,
        createdAt: new Date(now - 1000 * 60 * 50).toISOString(),
        likeCount: 4,
        commentCount: 0,
        likedByMe: false,
      },
      {
        id: 'post-8',
        authorPersonId: 'person-child-5',
        authorName: 'Derrick White',
        content: 'Added two more cousins and linked their parents.',
        mediaUrl: null,
        createdAt: new Date(now - 1000 * 60 * 45).toISOString(),
        likeCount: 4,
        commentCount: 1,
        likedByMe: false,
      },
      {
        id: 'post-9',
        authorPersonId: 'person-child-6',
        authorName: 'Elaine White',
        content: 'Testing export presets now. Poster size looks clean.',
        mediaUrl: null,
        createdAt: new Date(now - 1000 * 60 * 40).toISOString(),
        likeCount: 3,
        commentCount: 0,
        likedByMe: false,
      },
      {
        id: 'post-10',
        authorPersonId: 'person-child-7',
        authorName: 'Frank White',
        content: 'Please verify your profile details before the reunion.',
        mediaUrl: null,
        createdAt: new Date(now - 1000 * 60 * 35).toISOString(),
        likeCount: 2,
        commentCount: 0,
        likedByMe: false,
      },
      {
        id: 'post-11',
        authorPersonId: 'person-child-8',
        authorName: 'Gloria White',
        content: 'Pathfinder now correctly shows how we are connected.',
        mediaUrl: null,
        createdAt: new Date(now - 1000 * 60 * 25).toISOString(),
        likeCount: 2,
        commentCount: 0,
        likedByMe: false,
      },
      {
        id: 'post-12',
        authorPersonId: 'person-child-9',
        authorName: 'Harold White',
        content: 'I can see all generations from Mark White in Tree view.',
        mediaUrl: null,
        createdAt: new Date(now - 1000 * 60 * 20).toISOString(),
        likeCount: 1,
        commentCount: 0,
        likedByMe: false,
      },
    ],
    upcomingBirthdaysCount: 14,
    newMembersCount: 6,
    conversations: [
      {
        id: familyConversationId,
        type: 'family',
        title: 'Family Chat',
        participantIds: ['person-mark-white-sr', 'person-grand-1-1', currentPersonId],
        preview: 'Perfect. Please invite your siblings too.',
        unreadCount: 1,
      },
      {
        id: directConversationId,
        type: 'direct',
        title: 'Eric White',
        participantIds: ['person-grand-1-1', currentPersonId],
        preview: 'Can you review the new tree branch tonight?',
        unreadCount: 0,
      },
    ] as ConversationListItem[],
    selectedConversationId: familyConversationId,
    messages,
  }
}

function App() {
  const [route, setRoute] = useState<Route>(DEV_NO_AUTH_TEST_MODE ? 'workspace' : 'landing')
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('home')
  const [authMode, setAuthMode] = useState<'idle' | 'submitting'>('idle')
  const [familyMode, setFamilyMode] = useState<'idle' | 'submitting'>('idle')
  const [homeMode, setHomeMode] = useState<'idle' | 'loading' | 'posting' | 'updating'>('idle')
  const [authReady, setAuthReady] = useState(DEV_NO_AUTH_TEST_MODE || !isSupabaseConfigured())
  const [isAuthenticated, setIsAuthenticated] = useState(DEV_NO_AUTH_TEST_MODE)
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [passwordResetMode, setPasswordResetMode] = useState<'idle' | 'submitting'>('idle')
  const [passwordResetMessage, setPasswordResetMessage] = useState('')
  const [authError, setAuthError] = useState('')
  const [familyError, setFamilyError] = useState('')
  const [homeError, setHomeError] = useState('')
  const [familyName, setFamilyName] = useState(() => localStorage.getItem(FAMILY_NAME_STORAGE_KEY) ?? '')
  const [currentFamilyId, setCurrentFamilyId] = useState(
    () => localStorage.getItem(FAMILY_ID_STORAGE_KEY) ?? ''
  )
  const [currentInviteToken, setCurrentInviteToken] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [feedPosts, setFeedPosts] = useState<FeedPostItem[]>([])
  const [postDraft, setPostDraft] = useState({ content: '', mediaUrl: '' })
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [upcomingBirthdaysCount, setUpcomingBirthdaysCount] = useState(0)
  const [newMembersCount, setNewMembersCount] = useState(0)
  const [onboardingMode, setOnboardingMode] = useState<'idle' | 'submitting'>('idle')
  const [onboardingError, setOnboardingError] = useState('')
  const [profileMode, setProfileMode] = useState<'idle' | 'loading' | 'saving'>('idle')
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview')
  const [profileError, setProfileError] = useState('')
  const [businessDirectoryMode, setBusinessDirectoryMode] = useState<'idle' | 'loading'>('idle')
  const [businessDirectoryError, setBusinessDirectoryError] = useState('')
  const [businessSearch, setBusinessSearch] = useState('')
  const [businessCategoryFilter, setBusinessCategoryFilter] = useState('All')
  const [businessStateFilter, setBusinessStateFilter] = useState('All')
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [businessDirectoryItems, setBusinessDirectoryItems] = useState<BusinessDirectoryItem[]>([])
  const [mapMode, setMapMode] = useState<'idle' | 'loading'>('idle')
  const [mapError, setMapError] = useState('')
  const [familyMapClusters, setFamilyMapClusters] = useState<FamilyMapCluster[]>([])
  const [selectedMapClusterId, setSelectedMapClusterId] = useState('')
  const [treeMode, setTreeMode] = useState<'idle' | 'loading' | 'saving'>('idle')
  const [treeError, setTreeError] = useState('')
  const [treePeople, setTreePeople] = useState<TreePersonItem[]>([])
  const [treeRelationships, setTreeRelationships] = useState<TreeRelationshipItem[]>([])
  const [pathfinderMode, setPathfinderMode] = useState<'idle' | 'searching'>('idle')
  const [pathfinderError, setPathfinderError] = useState('')
  const [pathfinderPersonAId, setPathfinderPersonAId] = useState('')
  const [pathfinderPersonBQuery, setPathfinderPersonBQuery] = useState('')
  const [debouncedPathfinderQuery, setDebouncedPathfinderQuery] = useState('')
  const [pathfinderPersonBId, setPathfinderPersonBId] = useState('')
  const [pathfinderResult, setPathfinderResult] = useState<PathfinderResult | null>(null)
  const [highlightedTreePath, setHighlightedTreePath] = useState<PathfinderResult | null>(null)
  const [treeRootId, setTreeRootId] = useState('')
  const [selectedTreePersonId, setSelectedTreePersonId] = useState('')
  const [treeSearch, setTreeSearch] = useState('')
  const [treeBranchFilter, setTreeBranchFilter] = useState<'both' | 'maternal' | 'paternal'>('both')
  const [showAddRelationship, setShowAddRelationship] = useState(false)
  const [treeFlowInstance, setTreeFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [collapsedTreeSections, setCollapsedTreeSections] = useState<TreeCollapseState>({
    ancestors: false,
    descendants: false,
    siblings: false,
    spouses: false,
  })
  const [addRelationshipForm, setAddRelationshipForm] = useState({
    relationshipType: 'parent',
    existingPersonId: '',
    useExisting: true,
    firstName: '',
    lastName: '',
    gender: '',
    birthDate: '',
  })
  const [messagingMode, setMessagingMode] = useState<'idle' | 'loading' | 'sending' | 'creating'>('idle')
  const [messagingError, setMessagingError] = useState('')
  const [peopleOptions, setPeopleOptions] = useState<PersonOption[]>([])
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [messageDraft, setMessageDraft] = useState({ content: '', mediaUrl: '' })
  const [newConversationType, setNewConversationType] = useState<'direct' | 'group'>('direct')
  const [newConversationParticipantIds, setNewConversationParticipantIds] = useState<string[]>([])
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileRecord, setProfileRecord] = useState<ProfileRecord | null>(null)
  const [connections, setConnections] = useState<ConnectionItem[]>([])
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [profileDataMode, setProfileDataMode] = useState<'idle' | 'loading' | 'saving'>('idle')
  const [timelineDraft, setTimelineDraft] = useState({
    eventType: '',
    eventDate: '',
    description: '',
  })
  const [mediaDraft, setMediaDraft] = useState({
    mediaUrl: '',
    caption: '',
  })
  const [exportMode, setExportMode] = useState<'idle' | 'exporting'>('idle')
  const [exportError, setExportError] = useState('')
  const [exportRootId, setExportRootId] = useState('')
  const [exportDirection, setExportDirection] = useState<'ancestors' | 'descendants' | 'both'>('both')
  const [exportBranch, setExportBranch] = useState<'both' | 'maternal' | 'paternal'>('both')
  const [exportGenerations, setExportGenerations] = useState(3)
  const [exportIncludeSpouses, setExportIncludeSpouses] = useState(true)
  const [exportIncludeSiblings, setExportIncludeSiblings] = useState(false)
  const [exportIncludeParentsOfSiblings, setExportIncludeParentsOfSiblings] = useState(false)
  const [exportIncludeSiblingSpouses, setExportIncludeSiblingSpouses] = useState(false)
  const [exportIncludeChildrenOfSiblings, setExportIncludeChildrenOfSiblings] = useState(false)
  const [exportDetailLevel, setExportDetailLevel] = useState<'minimal' | 'standard' | 'full'>('standard')
  const [exportTemplateId, setExportTemplateId] = useState<(typeof EXPORT_TEMPLATES)[number]['id']>(
    'heritage'
  )
  const [exportFormat, setExportFormat] = useState<'letter' | 'poster'>('letter')
  const [exportPosterSize, setExportPosterSize] = useState<'dynamic' | '18x24' | '24x36' | '36x48'>(
    'dynamic'
  )
  const [lastExportPresetId, setLastExportPresetId] = useState<keyof typeof EXPORT_PRESET_LABELS | null>(null)
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    birthDate: '',
    city: '',
    state: '',
    zip: '',
    bio: '',
    contactEmail: '',
    contactPhone: '',
    businessName: '',
    businessLogoUrl: '',
    businessCategory: '',
    businessDescription: '',
    businessCity: '',
    businessState: '',
    businessWebsite: '',
    businessInstagram: '',
    businessFacebook: '',
  })
  const [claimCandidates, setClaimCandidates] = useState<CandidateProfile[]>([])
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [photoFileName, setPhotoFileName] = useState('')
  const [currentPersonId, setCurrentPersonId] = useState(
    () => localStorage.getItem(PERSON_ID_STORAGE_KEY) ?? ''
  )
  const [currentPersonName, setCurrentPersonName] = useState(
    () => localStorage.getItem(PERSON_NAME_STORAGE_KEY) ?? ''
  )
  const [onboardingForm, setOnboardingForm] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    birthDate: '',
    city: '',
    state: '',
    zip: '',
    motherName: '',
    fatherName: '',
  })
  const [status, setStatus] = useState(
    DEV_NO_AUTH_TEST_MODE
      ? 'Testing mode is enabled. No login is required and demo family context is seeded locally.'
      : 'Milestone 1 started: landing, auth, family setup, onboarding, and workspace are now connected.'
  )

  useEffect(() => {
    if (!DEV_NO_AUTH_TEST_MODE) {
      return
    }

    setAuthReady(true)
    setIsAuthenticated(true)
    const seed = buildDevWhiteFamilySeed()

    setCurrentFamilyId(seed.familyId)
    setFamilyName(seed.familyName)
    setCurrentInviteToken(seed.inviteToken)
    setCurrentPersonId(seed.currentPersonId)
    setCurrentPersonName(seed.currentPersonName)
    setPeopleOptions(seed.peopleOptions)
    setTreePeople(seed.people)
    setTreeRelationships(seed.relationships)
    setTreeRootId(seed.rootId)
    setSelectedTreePersonId(seed.currentPersonId)
    setPathfinderPersonAId(seed.currentPersonId)
    setProfileRecord(seed.profile)
    setProfileForm(buildProfileForm(seed.profile))
    setConnections(seed.connections)
    setTimelineItems(seed.timeline)
    setMediaItems(seed.media)
    setBusinessDirectoryItems(seed.businesses)
    setSelectedBusinessId(seed.businesses[0]?.id ?? '')
    setFamilyMapClusters(seed.familyMapClusters)
    setSelectedMapClusterId(seed.familyMapClusters[0]?.id ?? '')
    setFeedPosts(seed.feedPosts)
    setUpcomingBirthdaysCount(seed.upcomingBirthdaysCount)
    setNewMembersCount(seed.newMembersCount)
    setConversations(seed.conversations)
    setSelectedConversationId(seed.selectedConversationId)
    setMessages(seed.messages)
    setExportRootId(seed.rootId)
    setStatus(
      'Testing mode loaded: Mark White family seed dataset is active (18 children with descendants).'
    )
    setHomeError('')
    setMessagingError('')
    setTreeError('')
    setMapError('')
    setProfileError('')
    setBusinessDirectoryError('')
    setPathfinderError('')
    setRoute('workspace')
  }, [])

  useEffect(() => {
    if (DEV_NO_AUTH_TEST_MODE) {
      setAuthReady(true)
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setAuthReady(true)
      return
    }

    let active = true

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return
      }

      if (error) {
        setAuthError(error.message)
        setIsAuthenticated(false)
        setRoute('landing')
        setStatus('Supabase session restore failed. Sign in again to continue.')
      } else if (data.session) {
        setIsAuthenticated(true)
        setRoute(currentPersonId ? 'workspace' : currentFamilyId ? 'onboarding' : 'family')
        setStatus(
          currentPersonId
            ? 'Existing Supabase session, family context, and profile context restored.'
            : currentFamilyId
              ? 'Existing Supabase session and family context restored.'
            : 'Existing Supabase session restored. You are still signed in.'
        )
      } else {
        setIsAuthenticated(false)
      }

      setAuthReady(true)
    })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return
      }

      const signedIn = Boolean(session)
      setIsAuthenticated(signedIn)

      if (signedIn) {
        if (event === 'SIGNED_IN') {
          setStatus('Supabase session active. Continue with family setup.')
        }

        setRoute((current) =>
          current === 'landing' || current === 'signup' || current === 'login' ? 'family' : current
        )
      } else if (event === 'SIGNED_OUT') {
        setCurrentFamilyId('')
        setFamilyName('')
        setCurrentInviteToken('')
        setCurrentPersonId('')
        setCurrentPersonName('')
        setRoute('landing')
        setStatus('Signed out. Create an account or log back in to continue.')
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [currentFamilyId, currentPersonId])

  useEffect(() => {
    if (currentFamilyId) {
      localStorage.setItem(FAMILY_ID_STORAGE_KEY, currentFamilyId)
    } else {
      localStorage.removeItem(FAMILY_ID_STORAGE_KEY)
    }
  }, [currentFamilyId])

  useEffect(() => {
    if (familyName) {
      localStorage.setItem(FAMILY_NAME_STORAGE_KEY, familyName)
    } else {
      localStorage.removeItem(FAMILY_NAME_STORAGE_KEY)
    }
  }, [familyName])

  useEffect(() => {
    if (DEV_NO_AUTH_TEST_MODE) {
      return
    }

    const client = getSupabaseClient()

    if (!client || !isAuthenticated || !currentFamilyId || familyName) {
      return
    }

    let active = true

    void client
      .from('families')
      .select('name')
      .eq('id', currentFamilyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) {
          return
        }

        if (error) {
          setFamilyError(error.message)
          return
        }

        if (data?.name) {
          setFamilyName(data.name)
        }
      })

    return () => {
      active = false
    }
  }, [currentFamilyId, familyName, isAuthenticated])

  useEffect(() => {
    if (DEV_NO_AUTH_TEST_MODE) {
      return
    }

    const client = getSupabaseClient()

    if (!client || !isAuthenticated || !currentPersonId || currentPersonName) {
      return
    }

    let active = true

    void client
      .from('people')
      .select('first_name, last_name')
      .eq('id', currentPersonId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) {
          return
        }

        if (error) {
          setOnboardingError(error.message)
          return
        }

        if (data) {
          setCurrentPersonName(`${data.first_name} ${data.last_name}`.trim())
        }
      })

    return () => {
      active = false
    }
  }, [currentPersonId, currentPersonName, isAuthenticated])

  useEffect(() => {
    if (DEV_NO_AUTH_TEST_MODE) {
      return
    }

    const client = getSupabaseClient()

    if (!client || !isAuthenticated || !currentPersonId) {
      setProfileRecord(null)
      setIsEditingProfile(false)
      return
    }

    let active = true
    setProfileMode('loading')

    void client
      .from('people')
      .select(
        'id, first_name, last_name, gender, birth_date, city, state, zip, bio, contact_email, contact_phone, profile_photo_url, business_name, business_logo_url, business_category, business_description, business_city, business_state, business_website, business_instagram, business_facebook'
      )
      .eq('id', currentPersonId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) {
          return
        }

        setProfileMode('idle')

        if (error) {
          setProfileError(error.message)
          return
        }

        if (!data) {
          setProfileError('The active profile could not be found.')
          setProfileRecord(null)
          return
        }

        const record = data as ProfileRecord
        setProfileRecord(record)
        setProfileForm(buildProfileForm(record))
      })

    return () => {
      active = false
    }
  }, [currentPersonId, isAuthenticated])

  useEffect(() => {
    if (DEV_NO_AUTH_TEST_MODE) {
      return
    }

    const client = getSupabaseClient()

    if (!client || !isAuthenticated || !currentPersonId || !currentFamilyId) {
      setConnections([])
      setTimelineItems([])
      setMediaItems([])
      return
    }

    let active = true
    setProfileDataMode('loading')

    void (async () => {
      const [
        relationshipsResponse,
        timelineResponse,
        mediaResponse,
      ] = await Promise.all([
        client
          .from('relationships')
          .select('id, person_a_id, person_b_id, relationship_type')
          .eq('family_id', currentFamilyId)
          .or(`person_a_id.eq.${currentPersonId},person_b_id.eq.${currentPersonId}`),
        client
          .from('profile_timeline_events')
          .select('id, event_type, event_date, description')
          .eq('person_id', currentPersonId)
          .order('event_date', { ascending: false }),
        client
          .from('profile_media')
          .select('id, media_url, caption')
          .eq('person_id', currentPersonId)
          .order('created_at', { ascending: false }),
      ])

      if (!active) {
        return
      }

      if (relationshipsResponse.error) {
        setProfileDataMode('idle')
        setProfileError(relationshipsResponse.error.message)
        return
      }

      if (timelineResponse.error) {
        setProfileDataMode('idle')
        setProfileError(timelineResponse.error.message)
        return
      }

      if (mediaResponse.error) {
        setProfileDataMode('idle')
        setProfileError(mediaResponse.error.message)
        return
      }

      const relationshipRows = relationshipsResponse.data ?? []
      const otherIds = Array.from(
        new Set(
          relationshipRows.map((row) =>
            row.person_a_id === currentPersonId ? row.person_b_id : row.person_a_id
          )
        )
      )

      let otherPeopleLookup = new Map<string, string>()

      if (otherIds.length > 0) {
        const peopleResponse = await client
          .from('people')
          .select('id, first_name, last_name')
          .in('id', otherIds)

        if (!active) {
          return
        }

        if (peopleResponse.error) {
          setProfileDataMode('idle')
          setProfileError(peopleResponse.error.message)
          return
        }

        otherPeopleLookup = new Map(
          (peopleResponse.data ?? []).map((person) => [
            person.id,
            `${person.first_name} ${person.last_name}`.trim(),
          ])
        )
      }

      const relationshipLabelMap: Record<string, { outgoing: string; incoming: string }> = {
        parent: { outgoing: 'Parent of', incoming: 'Child of' },
        child: { outgoing: 'Child of', incoming: 'Parent of' },
        spouse: { outgoing: 'Spouse of', incoming: 'Spouse of' },
        sibling: { outgoing: 'Sibling of', incoming: 'Sibling of' },
        step_parent: { outgoing: 'Step-parent of', incoming: 'Step-child of' },
        adopted_parent: { outgoing: 'Adoptive parent of', incoming: 'Adopted child of' },
      }

      setConnections(
        relationshipRows.map((row) => {
          const isOutgoing = row.person_a_id === currentPersonId
          const otherId = isOutgoing ? row.person_b_id : row.person_a_id
          const mapping = relationshipLabelMap[row.relationship_type] ?? {
            outgoing: row.relationship_type,
            incoming: row.relationship_type,
          }

          return {
            id: row.id,
            name: otherPeopleLookup.get(otherId) ?? 'Unknown person',
            relationshipLabel: isOutgoing ? mapping.outgoing : mapping.incoming,
          }
        })
      )
      setTimelineItems((timelineResponse.data ?? []) as TimelineItem[])
      setMediaItems((mediaResponse.data ?? []) as MediaItem[])
      setProfileDataMode('idle')
    })()

    return () => {
      active = false
    }
  }, [currentFamilyId, currentPersonId, isAuthenticated])

  useEffect(() => {
    if (DEV_NO_AUTH_TEST_MODE) {
      return
    }

    const client = getSupabaseClient()

    if (!client || !isAuthenticated || !currentFamilyId) {
      setTreePeople([])
      setTreeRelationships([])
      setTreeRootId('')
      setSelectedTreePersonId('')
      return
    }

    let active = true
    setTreeMode('loading')
    setTreeError('')

    void Promise.all([
      client
        .from('people')
        .select('id, first_name, last_name, gender, birth_date, city, state, business_name')
        .eq('family_id', currentFamilyId),
      client
        .from('relationships')
        .select('id, person_a_id, person_b_id, relationship_type, locked')
        .eq('family_id', currentFamilyId),
    ]).then(([peopleResponse, relationshipsResponse]) => {
      if (!active) {
        return
      }

      setTreeMode('idle')

      const error = peopleResponse.error ?? relationshipsResponse.error

      if (error) {
        setTreeError(error.message)
        return
      }

      const people = (peopleResponse.data ?? []) as TreePersonItem[]
      const relationships = (relationshipsResponse.data ?? []) as TreeRelationshipItem[]

      setTreePeople(people)
      setTreeRelationships(relationships)
      setTreeRootId((current) =>
        current && people.some((person) => person.id === current)
          ? current
          : currentPersonId && people.some((person) => person.id === currentPersonId)
            ? currentPersonId
            : people[0]?.id ?? ''
      )
      setSelectedTreePersonId((current) =>
        current && people.some((person) => person.id === current)
          ? current
          : currentPersonId && people.some((person) => person.id === currentPersonId)
            ? currentPersonId
            : people[0]?.id ?? ''
      )
    })

    return () => {
      active = false
    }
  }, [currentFamilyId, currentPersonId, isAuthenticated])

  const treePeopleLookup = useMemo(
    () => new Map(treePeople.map((person) => [person.id, person])),
    [treePeople]
  )

  const selectedTreePerson =
    treePeopleLookup.get(selectedTreePersonId) ??
    treePeopleLookup.get(treeRootId) ??
    null

  const rootTreePerson = treePeopleLookup.get(treeRootId) ?? null

  const selectedTreeConnections = useMemo(() => {
    if (!selectedTreePerson) {
      return {
        parents: [] as TreeRelativeLink[],
        grandparents: [] as TreeRelativeLink[],
        children: [] as TreeRelativeLink[],
        grandchildren: [] as TreeRelativeLink[],
        spouses: [] as TreePersonItem[],
        siblings: [] as TreePersonItem[],
        siblingParentLinks: new Map<string, Array<{ parentId: string; relationshipType: string }>>(),
      }
    }

    const parentLinks: TreeRelativeLink[] = []
    const childLinks: TreeRelativeLink[] = []
    const spouses: TreePersonItem[] = []
    const siblingIds = new Set<string>()
    const siblingParentLinks = new Map<string, Map<string, string>>()
    const grandparentLinks = new Map<string, TreeRelativeLink>()
    const grandchildLinks = new Map<string, TreeRelativeLink>()

    for (const relationship of treeRelationships) {
      if (isParentRelationshipType(relationship.relationship_type)) {
        if (relationship.person_b_id === selectedTreePerson.id) {
          const parent = treePeopleLookup.get(relationship.person_a_id)
          if (parent) {
            parentLinks.push({
              person: parent,
              relationshipType: relationship.relationship_type as TreeRelativeLink['relationshipType'],
            })
          }
        }

        if (relationship.person_a_id === selectedTreePerson.id) {
          const child = treePeopleLookup.get(relationship.person_b_id)
          if (child) {
            childLinks.push({
              person: child,
              relationshipType: relationship.relationship_type as TreeRelativeLink['relationshipType'],
            })
          }
        }
      }

      if (relationship.relationship_type === 'spouse') {
        if (relationship.person_a_id === selectedTreePerson.id) {
          const spouse = treePeopleLookup.get(relationship.person_b_id)
          if (spouse) spouses.push(spouse)
        } else if (relationship.person_b_id === selectedTreePerson.id) {
          const spouse = treePeopleLookup.get(relationship.person_a_id)
          if (spouse) spouses.push(spouse)
        }
      }

      if (relationship.relationship_type === 'sibling') {
        if (relationship.person_a_id === selectedTreePerson.id) {
          siblingIds.add(relationship.person_b_id)
        } else if (relationship.person_b_id === selectedTreePerson.id) {
          siblingIds.add(relationship.person_a_id)
        }
      }
    }

    const uniqueRelativeLinks = (items: TreeRelativeLink[]) =>
      Array.from(new Map(items.map((item) => [item.person.id, item])).values())

    const filteredParents = uniqueRelativeLinks(parentLinks).filter(({ person }) => {
      if (treeBranchFilter === 'maternal') {
        return (person.gender ?? '').toLowerCase().startsWith('f')
      }
      if (treeBranchFilter === 'paternal') {
        return (person.gender ?? '').toLowerCase().startsWith('m')
      }
      return true
    })

    const selectedParentIds = Array.from(new Set(filteredParents.map(({ person }) => person.id)))

    if (selectedParentIds.length > 0) {
      for (const relationship of treeRelationships) {
        if (
          isParentRelationshipType(relationship.relationship_type) &&
          selectedParentIds.includes(relationship.person_a_id) &&
          relationship.person_b_id !== selectedTreePerson.id
        ) {
          siblingIds.add(relationship.person_b_id)

          if (!siblingParentLinks.has(relationship.person_b_id)) {
            siblingParentLinks.set(relationship.person_b_id, new Map<string, string>())
          }

          siblingParentLinks
            .get(relationship.person_b_id)
            ?.set(relationship.person_a_id, relationship.relationship_type)
        }
      }
    }

    const uniqueById = (items: TreePersonItem[]) =>
      Array.from(new Map(items.map((item) => [item.id, item])).values())

    const siblings = uniqueById(
      Array.from(siblingIds)
        .map((personId) => treePeopleLookup.get(personId))
        .filter((person): person is TreePersonItem => Boolean(person))
    )

    const selectedChildIds = Array.from(new Set(childLinks.map(({ person }) => person.id)))

    for (const relationship of treeRelationships) {
      if (
        isParentRelationshipType(relationship.relationship_type) &&
        selectedParentIds.includes(relationship.person_b_id)
      ) {
        const grandparent = treePeopleLookup.get(relationship.person_a_id)
        if (grandparent) {
          grandparentLinks.set(relationship.person_a_id, {
            person: grandparent,
            relationshipType: relationship.relationship_type as TreeRelativeLink['relationshipType'],
          })
        }
      }

      if (
        isParentRelationshipType(relationship.relationship_type) &&
        selectedChildIds.includes(relationship.person_a_id)
      ) {
        const grandchild = treePeopleLookup.get(relationship.person_b_id)
        if (grandchild) {
          grandchildLinks.set(relationship.person_b_id, {
            person: grandchild,
            relationshipType: relationship.relationship_type as TreeRelativeLink['relationshipType'],
          })
        }
      }
    }

    return {
      parents: filteredParents,
      grandparents: Array.from(grandparentLinks.values()).filter(({ person }) => {
        if (treeBranchFilter === 'maternal') {
          return (person.gender ?? '').toLowerCase().startsWith('f')
        }
        if (treeBranchFilter === 'paternal') {
          return (person.gender ?? '').toLowerCase().startsWith('m')
        }
        return true
      }),
      children: uniqueRelativeLinks(childLinks),
      grandchildren: Array.from(grandchildLinks.values()),
      spouses: uniqueById(spouses),
      siblings,
      siblingParentLinks: new Map(
        Array.from(siblingParentLinks.entries()).map(([personId, parentLinks]) => [
          personId,
          Array.from(parentLinks.entries())
            .filter(([parentId]) => filteredParents.some((parent) => parent.person.id === parentId))
            .map(([parentId, relationshipType]) => ({ parentId, relationshipType })),
        ])
      ),
    }
  }, [selectedTreePerson, treeRelationships, treePeopleLookup, treeBranchFilter])

  const searchedTreePeople = useMemo(() => {
    const normalized = treeSearch.trim().toLowerCase()
    if (normalized === '') return treePeople
    return treePeople.filter((person) =>
      `${person.first_name} ${person.last_name}`.trim().toLowerCase().includes(normalized)
    )
  }, [treePeople, treeSearch])

  const pathfinderSearchResults = useMemo(() => {
    const normalized = debouncedPathfinderQuery.trim().toLowerCase()

    if (normalized === '') {
      return []
    }

    return treePeople
      .filter(
        (person) =>
          person.id !== pathfinderPersonAId &&
          `${person.first_name} ${person.last_name}`.trim().toLowerCase().includes(normalized)
      )
      .slice(0, 10)
  }, [debouncedPathfinderQuery, pathfinderPersonAId, treePeople])

  const relationshipAdjacency = useMemo(() => {
    const adjacency = new Map<
      string,
      Array<{ personId: string; relationLabel: string }>
    >()

    const addNeighbor = (fromId: string, toId: string, relationLabel: string) => {
      if (!adjacency.has(fromId)) {
        adjacency.set(fromId, [])
      }

      adjacency.get(fromId)?.push({ personId: toId, relationLabel })
    }

    for (const relationship of treeRelationships) {
      if (relationship.relationship_type === 'parent') {
        addNeighbor(relationship.person_a_id, relationship.person_b_id, 'child')
        addNeighbor(relationship.person_b_id, relationship.person_a_id, 'parent')
      } else if (relationship.relationship_type === 'step_parent') {
        addNeighbor(relationship.person_a_id, relationship.person_b_id, 'child')
        addNeighbor(relationship.person_b_id, relationship.person_a_id, 'step parent')
      } else if (relationship.relationship_type === 'adopted_parent') {
        addNeighbor(relationship.person_a_id, relationship.person_b_id, 'child')
        addNeighbor(relationship.person_b_id, relationship.person_a_id, 'adoptive parent')
      } else if (relationship.relationship_type === 'spouse' || relationship.relationship_type === 'sibling') {
        const label = relationship.relationship_type
        addNeighbor(relationship.person_a_id, relationship.person_b_id, label)
        addNeighbor(relationship.person_b_id, relationship.person_a_id, label)
      }
    }

    return adjacency
  }, [treeRelationships])

  const treeSectionCounts = useMemo(
    () => ({
      ancestors: selectedTreeConnections.parents.length + selectedTreeConnections.grandparents.length,
      descendants: selectedTreeConnections.children.length + selectedTreeConnections.grandchildren.length,
      siblings: selectedTreeConnections.siblings.length,
      spouses: selectedTreeConnections.spouses.length,
    }),
    [selectedTreeConnections]
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedPathfinderQuery(pathfinderPersonBQuery)
      setPathfinderMode(pathfinderPersonBQuery.trim() === '' ? 'idle' : 'searching')
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [pathfinderPersonBQuery])

  useEffect(() => {
    setPathfinderMode('idle')
  }, [debouncedPathfinderQuery])

  useEffect(() => {
    if (treePeople.length === 0) {
      setPathfinderPersonAId('')
      setPathfinderPersonBId('')
      setPathfinderResult(null)
      setHighlightedTreePath(null)
      return
    }

    setPathfinderPersonAId((current) =>
      current && treePeople.some((person) => person.id === current)
        ? current
        : currentPersonId && treePeople.some((person) => person.id === currentPersonId)
          ? currentPersonId
          : treePeople[0]?.id ?? ''
    )

    setPathfinderPersonBId((current) =>
      current && treePeople.some((person) => person.id === current) ? current : ''
    )
  }, [currentPersonId, treePeople])

  useEffect(() => {
    if (treePeople.length === 0) {
      setExportRootId('')
      return
    }

    setExportRootId((current) =>
      current && treePeople.some((person) => person.id === current)
        ? current
        : currentPersonId && treePeople.some((person) => person.id === currentPersonId)
          ? currentPersonId
          : treePeople[0]?.id ?? ''
      )
  }, [currentPersonId, treePeople])

  useEffect(() => {
    if (!exportIncludeSiblings && exportIncludeParentsOfSiblings) {
      setExportIncludeParentsOfSiblings(false)
    }
  }, [exportIncludeParentsOfSiblings, exportIncludeSiblings])

  useEffect(() => {
    if (!exportIncludeSiblings && exportIncludeSiblingSpouses) {
      setExportIncludeSiblingSpouses(false)
    }
  }, [exportIncludeSiblingSpouses, exportIncludeSiblings])

  useEffect(() => {
    if (!exportIncludeSiblings && exportIncludeChildrenOfSiblings) {
      setExportIncludeChildrenOfSiblings(false)
    }
  }, [exportIncludeChildrenOfSiblings, exportIncludeSiblings])

  const exportScopeSummary = useMemo(() => {
    const directionLabel =
      exportDirection === 'ancestors'
        ? 'ancestors'
        : exportDirection === 'descendants'
          ? 'descendants'
          : 'ancestors and descendants'
    const branchLabel =
      exportBranch === 'both'
        ? 'both branches'
        : exportBranch === 'maternal'
          ? 'the maternal branch'
          : 'the paternal branch'
    const extraParts = [
      exportIncludeSpouses ? 'spouses' : null,
      exportIncludeSiblings ? 'siblings' : null,
      exportIncludeParentsOfSiblings ? 'parents of siblings' : null,
      exportIncludeSiblingSpouses ? "siblings' spouses" : null,
      exportIncludeChildrenOfSiblings ? 'children of siblings' : null,
    ].filter(Boolean)
    const extrasLabel = extraParts.length > 0 ? ` Includes ${extraParts.join(', ')}.` : ''

    return `Exporting ${directionLabel} from the selected root across ${branchLabel}, up to ${exportGenerations} generation${
      exportGenerations === 1 ? '' : 's'
    }.${extrasLabel}`
  }, [
    exportBranch,
    exportDirection,
    exportGenerations,
    exportIncludeChildrenOfSiblings,
    exportIncludeParentsOfSiblings,
    exportIncludeSiblingSpouses,
    exportIncludeSiblings,
    exportIncludeSpouses,
  ])

  const activeExportPresetLabel = useMemo(() => {
    const matches = (
      config: {
        direction: 'ancestors' | 'descendants' | 'both'
        branch: 'both' | 'maternal' | 'paternal'
        generations: number
        includeSpouses: boolean
        includeSiblings: boolean
        includeParentsOfSiblings: boolean
        includeSiblingSpouses: boolean
        includeChildrenOfSiblings: boolean
        detailLevel: 'minimal' | 'standard' | 'full'
        format: 'letter' | 'poster'
        posterSize: 'dynamic' | '18x24' | '24x36' | '36x48'
        templateId: (typeof EXPORT_TEMPLATES)[number]['id']
      }
    ) =>
      exportDirection === config.direction &&
      exportBranch === config.branch &&
      exportGenerations === config.generations &&
      exportIncludeSpouses === config.includeSpouses &&
      exportIncludeSiblings === config.includeSiblings &&
      exportIncludeParentsOfSiblings === config.includeParentsOfSiblings &&
      exportIncludeSiblingSpouses === config.includeSiblingSpouses &&
      exportIncludeChildrenOfSiblings === config.includeChildrenOfSiblings &&
      exportDetailLevel === config.detailLevel &&
      exportFormat === config.format &&
      exportPosterSize === config.posterSize &&
      exportTemplateId === config.templateId

    if (
      matches({
        direction: 'both',
        branch: 'both',
        generations: 1,
        includeSpouses: true,
        includeSiblings: true,
        includeParentsOfSiblings: false,
        includeSiblingSpouses: false,
        includeChildrenOfSiblings: false,
        detailLevel: 'standard',
        format: 'letter',
        posterSize: 'dynamic',
        templateId: 'heritage',
      })
    ) {
      return 'Immediate Family'
    }

    if (
      matches({
        direction: 'ancestors',
        branch: 'both',
        generations: 4,
        includeSpouses: false,
        includeSiblings: false,
        includeParentsOfSiblings: false,
        includeSiblingSpouses: false,
        includeChildrenOfSiblings: false,
        detailLevel: 'minimal',
        format: 'poster',
        posterSize: '24x36',
        templateId: 'legacy',
      })
    ) {
      return 'Ancestor Fan'
    }

    if (
      matches({
        direction: 'descendants',
        branch: 'both',
        generations: 4,
        includeSpouses: true,
        includeSiblings: false,
        includeParentsOfSiblings: false,
        includeSiblingSpouses: false,
        includeChildrenOfSiblings: false,
        detailLevel: 'full',
        format: 'poster',
        posterSize: '24x36',
        templateId: 'linen',
      })
    ) {
      return 'Descendant Poster'
    }

    if (
      matches({
        direction: 'ancestors',
        branch: 'maternal',
        generations: 4,
        includeSpouses: false,
        includeSiblings: false,
        includeParentsOfSiblings: false,
        includeSiblingSpouses: false,
        includeChildrenOfSiblings: false,
        detailLevel: 'minimal',
        format: 'poster',
        posterSize: '24x36',
        templateId: 'sage',
      })
    ) {
      return 'Maternal Line'
    }

    if (
      matches({
        direction: 'ancestors',
        branch: 'paternal',
        generations: 4,
        includeSpouses: false,
        includeSiblings: false,
        includeParentsOfSiblings: false,
        includeSiblingSpouses: false,
        includeChildrenOfSiblings: false,
        detailLevel: 'minimal',
        format: 'poster',
        posterSize: '24x36',
        templateId: 'navy',
      })
    ) {
      return 'Paternal Line'
    }

    if (
      matches({
        direction: 'both',
        branch: 'both',
        generations: 2,
        includeSpouses: true,
        includeSiblings: false,
        includeParentsOfSiblings: false,
        includeSiblingSpouses: false,
        includeChildrenOfSiblings: false,
        detailLevel: 'minimal',
        format: 'letter',
        posterSize: 'dynamic',
        templateId: 'slate',
      })
    ) {
      return 'One-Page Letter'
    }

    return 'Custom'
  }, [
    exportBranch,
    exportDetailLevel,
    exportDirection,
    exportFormat,
    exportGenerations,
    exportIncludeChildrenOfSiblings,
    exportIncludeParentsOfSiblings,
    exportIncludeSiblingSpouses,
    exportIncludeSiblings,
    exportIncludeSpouses,
    exportPosterSize,
    exportTemplateId,
  ])

  const selectedTreeGraph = useMemo(() => {
    if (!selectedTreePerson) {
      return { nodes: [] as FlowNode[], edges: [] as FlowEdge[] }
    }

    if (highlightedTreePath && highlightedTreePath.pathPersonIds.length > 1) {
      const graph = new dagre.graphlib.Graph()
      graph.setGraph({
        rankdir: 'LR',
        ranksep: 90,
        nodesep: 36,
        marginx: 24,
        marginy: 24,
      })
      graph.setDefaultEdgeLabel(() => ({}))

      const pathNodes: FlowNode[] = highlightedTreePath.pathPersonIds
        .map((personId) => treePeopleLookup.get(personId))
        .filter((person): person is TreePersonItem => Boolean(person))
        .map((person) => {
          const title = `${person.first_name} ${person.last_name}`.trim()
          const subtitle =
            [person.city, person.state].filter(Boolean).join(', ') || person.birth_date || 'No details yet'

          graph.setNode(person.id, { width: 190, height: 118 })

          return {
            id: person.id,
            position: { x: 0, y: 0 },
            sourcePosition: 'right' as FlowNode['sourcePosition'],
            targetPosition: 'left' as FlowNode['targetPosition'],
            draggable: false,
            selectable: true,
            data: {
              label: (
                <div className="tree-flow-node tree-flow-node-highlighted">
                  <div className="node-avatar">{person.first_name.slice(0, 1).toUpperCase()}</div>
                  <strong>{title}</strong>
                  <span>{subtitle}</span>
                </div>
              ),
            },
          } satisfies FlowNode
        })

      const pathEdges: FlowEdge[] = highlightedTreePath.steps.map((step) => {
        graph.setEdge(step.fromId, step.toId)

        return {
          id: `path-${step.fromId}-${step.toId}`,
          source: step.fromId,
          target: step.toId,
          type: 'smoothstep',
          label: step.relationLabel,
          animated: true,
          markerEnd: { type: 'arrowclosed' as any },
          style: {
            strokeWidth: 3,
            stroke: '#f4b942',
          },
          labelStyle: {
            fill: '#9a6c00',
            fontSize: 11,
            fontWeight: 700,
          },
        }
      })

      dagre.layout(graph)

      return {
        nodes: pathNodes.map((node) => {
          const layoutNode = graph.node(node.id)

          return {
            ...node,
            position: {
              x: layoutNode.x - 95,
              y: layoutNode.y - 59,
            },
          }
        }),
        edges: pathEdges,
      }
    }

    const graph = new dagre.graphlib.Graph()
    graph.setGraph({
      rankdir: 'TB',
      ranksep: 110,
      nodesep: 44,
      marginx: 32,
      marginy: 32,
    })
    graph.setDefaultEdgeLabel(() => ({}))

    const nodeDefinitions = new Map<string, FlowNode>()
    const edgeDefinitions = new Map<string, FlowEdge>()
    const personNodeSize = { width: 190, height: 118 }
    const connectorNodeSize = { width: 18, height: 18 }

    const addGraphNode = (
      id: string,
      width: number,
      height: number,
      definition: Omit<FlowNode, 'position'>
    ) => {
      graph.setNode(id, { width, height })
      nodeDefinitions.set(id, {
        ...definition,
        position: { x: 0, y: 0 },
      })
    }

    const addNode = (person: TreePersonItem, tone: 'root' | 'parent' | 'sibling' | 'spouse' | 'child') => {
      const title = `${person.first_name} ${person.last_name}`.trim()
      const subtitle = [person.city, person.state].filter(Boolean).join(', ') || person.birth_date || 'No details yet'

      addGraphNode(person.id, personNodeSize.width, personNodeSize.height, {
        id: person.id,
        sourcePosition: 'bottom' as FlowNode['sourcePosition'],
        targetPosition: 'top' as FlowNode['targetPosition'],
        draggable: false,
        selectable: true,
        data: {
          label: (
            <div className={`tree-flow-node tree-flow-node-${tone}`}>
              <div className="node-avatar">{person.first_name.slice(0, 1).toUpperCase()}</div>
              <strong>{title}</strong>
              <span>{subtitle}</span>
            </div>
          ),
        },
      })
    }

    const addConnectorNode = (id: string) => {
      addGraphNode(id, connectorNodeSize.width, connectorNodeSize.height, {
        id,
        draggable: false,
        selectable: false,
        sourcePosition: 'bottom' as FlowNode['sourcePosition'],
        targetPosition: 'top' as FlowNode['targetPosition'],
        data: {
          label: <div className="tree-flow-connector" aria-hidden="true" />,
        },
      })
    }

    const addEdge = (
      id: string,
      source: string,
      target: string,
      relationshipType: 'parent' | 'step_parent' | 'adopted_parent' | 'spouse' | 'sibling'
    ) => {
      const isParentEdge =
        relationshipType === 'parent' ||
        relationshipType === 'step_parent' ||
        relationshipType === 'adopted_parent'
      const label =
        relationshipType === 'step_parent'
          ? 'step parent'
          : relationshipType === 'adopted_parent'
            ? 'adoptive parent'
            : relationshipType

      graph.setEdge(source, target)
      edgeDefinitions.set(id, {
        id,
        source,
        target,
        type: relationshipType === 'spouse' ? 'straight' : 'smoothstep',
        label,
        animated: relationshipType === 'spouse',
        markerEnd: isParentEdge ? { type: 'arrowclosed' as any } : undefined,
        style:
          relationshipType === 'spouse'
            ? { strokeWidth: 2, stroke: '#b45309' }
            : relationshipType === 'sibling'
              ? { strokeWidth: 2, stroke: '#2563eb' }
              : relationshipType === 'step_parent'
                ? { strokeWidth: 2.5, stroke: '#7c3aed', strokeDasharray: '8 6' }
                : relationshipType === 'adopted_parent'
                  ? { strokeWidth: 2.5, stroke: '#059669', strokeDasharray: '4 4' }
                  : { strokeWidth: 2.5, stroke: '#1f2937' },
        labelStyle: { fill: '#111827', fontSize: 11, fontWeight: 600 },
      })
    }

    addNode(selectedTreePerson, 'root')

    const showAncestors = !collapsedTreeSections.ancestors
    const showDescendants = !collapsedTreeSections.descendants
    const showSiblings = !collapsedTreeSections.siblings
    const showSpouses = !collapsedTreeSections.spouses

    const visibleSpouses = showSpouses ? selectedTreeConnections.spouses : []
    const visibleParents = showAncestors ? selectedTreeConnections.parents : []
    const visibleGrandparents = showAncestors ? selectedTreeConnections.grandparents : []
    const visibleChildren = showDescendants ? selectedTreeConnections.children : []
    const visibleGrandchildren = showDescendants ? selectedTreeConnections.grandchildren : []
    const visibleSiblings = showSiblings ? selectedTreeConnections.siblings : []

    const familyConnectorId =
      visibleChildren.length > 0 && visibleSpouses.length > 0 ? `family-group-${selectedTreePerson.id}` : ''

    if (familyConnectorId) {
      addConnectorNode(familyConnectorId)
      addEdge(`family-root-${selectedTreePerson.id}`, selectedTreePerson.id, familyConnectorId, 'spouse')
    }

    visibleSpouses.forEach((person) => {
      addNode(person, 'spouse')
      addEdge(`spouse-${selectedTreePerson.id}-${person.id}`, selectedTreePerson.id, person.id, 'spouse')

      if (familyConnectorId) {
        addEdge(`family-spouse-${person.id}`, person.id, familyConnectorId, 'spouse')
      }
    })

    visibleGrandparents.forEach(({ person }) => {
      addNode(person, 'parent')
    })

    visibleParents.forEach(({ person, relationshipType }) => {
      addNode(person, 'parent')
      addEdge(`parent-${person.id}-${selectedTreePerson.id}`, person.id, selectedTreePerson.id, relationshipType)

      const grandparentLinks = visibleGrandparents.filter(
        ({ person: grandparent }) =>
          treeRelationships.some(
            (relationship) =>
              relationship.person_a_id === grandparent.id &&
              relationship.person_b_id === person.id &&
              isParentRelationshipType(relationship.relationship_type)
          )
      )

      grandparentLinks.forEach(({ person: grandparent }) => {
        const relationship = treeRelationships.find(
          (item) =>
            item.person_a_id === grandparent.id &&
            item.person_b_id === person.id &&
            isParentRelationshipType(item.relationship_type)
        )

        addEdge(
          `grandparent-${grandparent.id}-${person.id}`,
          grandparent.id,
          person.id,
          (relationship?.relationship_type as TreeRelativeLink['relationshipType']) ?? 'parent'
        )
      })
    })

    visibleSiblings.forEach((person) => {
      addNode(person, 'sibling')

      const parentLinks = selectedTreeConnections.siblingParentLinks.get(person.id) ?? []
      const visibleParentLinks = parentLinks.filter(({ parentId }) =>
        visibleParents.some((parent) => parent.person.id === parentId)
      )

      if (visibleParentLinks.length > 0) {
        const siblingConnectorId = `sibling-group-${selectedTreePerson.id}-${person.id}`
        addConnectorNode(siblingConnectorId)

        visibleParentLinks.forEach(({ parentId, relationshipType }) => {
          addEdge(
            `shared-parent-${parentId}-${siblingConnectorId}`,
            parentId,
            siblingConnectorId,
            relationshipType as TreeRelativeLink['relationshipType']
          )
        })

        addEdge(`shared-sibling-${siblingConnectorId}-${person.id}`, siblingConnectorId, person.id, 'sibling')
      } else {
        addEdge(`sibling-${selectedTreePerson.id}-${person.id}`, selectedTreePerson.id, person.id, 'sibling')
      }
    })

    visibleChildren.forEach(({ person, relationshipType }) => {
      addNode(person, 'child')
      addEdge(
        `child-${selectedTreePerson.id}-${person.id}`,
        familyConnectorId || selectedTreePerson.id,
        person.id,
        relationshipType
      )
    })

    visibleGrandchildren.forEach(({ person }) => {
      addNode(person, 'child')

      const parentRelationship = treeRelationships.find(
        (relationship) =>
          relationship.person_b_id === person.id &&
          visibleChildren.some(({ person: child }) => child.id === relationship.person_a_id) &&
          isParentRelationshipType(relationship.relationship_type)
      )

      if (parentRelationship) {
        addEdge(
          `grandchild-${parentRelationship.person_a_id}-${person.id}`,
          parentRelationship.person_a_id,
          person.id,
          parentRelationship.relationship_type as TreeRelativeLink['relationshipType']
        )
      }
    })

    dagre.layout(graph)

    const nodes = Array.from(nodeDefinitions.values()).map((node) => {
      const layoutNode = graph.node(node.id)
      const isConnectorNode =
        node.id.startsWith('family-group-') || node.id.startsWith('sibling-group-')
      const fallbackWidth = isConnectorNode ? connectorNodeSize.width : personNodeSize.width
      const fallbackHeight = isConnectorNode ? connectorNodeSize.height : personNodeSize.height

      return {
        ...node,
        position: {
          x: layoutNode.x - (layoutNode.width ?? fallbackWidth) / 2,
          y: layoutNode.y - (layoutNode.height ?? fallbackHeight) / 2,
        },
      }
    })

    const edges = Array.from(edgeDefinitions.values())

    return { nodes, edges }
  }, [
    collapsedTreeSections,
    highlightedTreePath,
    selectedTreeConnections,
    selectedTreePerson,
    treePeopleLookup,
    treeRelationships,
  ])

  const exportGraph = useMemo(() => {
    const rootPerson = treePeopleLookup.get(exportRootId)

    if (!rootPerson) {
      return null
    }

    const personIds = new Set<string>([rootPerson.id])
    const edgeIds = new Set<string>()
    const edgeRows: Array<{
      id: string
      source: string
      target: string
      label: string
      type: 'parent' | 'step_parent' | 'adopted_parent' | 'spouse' | 'sibling'
    }> = []

    const pushEdge = (edge: (typeof edgeRows)[number]) => {
      if (edgeIds.has(edge.id)) {
        return
      }

      edgeIds.add(edge.id)
      edgeRows.push(edge)
    }

    const enqueueAncestors = (startId: string, depth: number) => {
      if (depth >= exportGenerations) {
        return
      }

      const parentEdges = treeRelationships.filter(
        (relationship) =>
          relationship.person_b_id === startId && isParentRelationshipType(relationship.relationship_type)
      )

      const filteredParentEdges =
        depth === 0 && exportBranch !== 'both'
          ? parentEdges.filter((relationship) => {
              const parent = treePeopleLookup.get(relationship.person_a_id)
              const normalizedGender = (parent?.gender ?? '').toLowerCase()

              if (exportBranch === 'maternal') {
                return normalizedGender.startsWith('f')
              }

              return normalizedGender.startsWith('m')
            })
          : parentEdges

      for (const relationship of filteredParentEdges) {
        personIds.add(relationship.person_a_id)
        pushEdge({
          id: relationship.id,
          source: relationship.person_a_id,
          target: relationship.person_b_id,
          label:
            relationship.relationship_type === 'step_parent'
              ? 'step parent'
              : relationship.relationship_type === 'adopted_parent'
                ? 'adoptive parent'
                : 'parent',
          type: relationship.relationship_type as 'parent' | 'step_parent' | 'adopted_parent',
        })
        enqueueAncestors(relationship.person_a_id, depth + 1)
      }
    }

    const enqueueDescendants = (startId: string, depth: number) => {
      if (depth >= exportGenerations) {
        return
      }

      const childEdges = treeRelationships.filter(
        (relationship) =>
          relationship.person_a_id === startId && isParentRelationshipType(relationship.relationship_type)
      )

      for (const relationship of childEdges) {
        personIds.add(relationship.person_b_id)
        pushEdge({
          id: relationship.id,
          source: relationship.person_a_id,
          target: relationship.person_b_id,
          label:
            relationship.relationship_type === 'step_parent'
              ? 'step parent'
              : relationship.relationship_type === 'adopted_parent'
                ? 'adoptive parent'
                : 'parent',
          type: relationship.relationship_type as 'parent' | 'step_parent' | 'adopted_parent',
        })
        enqueueDescendants(relationship.person_b_id, depth + 1)
      }
    }

    if (exportDirection === 'ancestors' || exportDirection === 'both') {
      enqueueAncestors(rootPerson.id, 0)
    }

    if (exportDirection === 'descendants' || exportDirection === 'both') {
      enqueueDescendants(rootPerson.id, 0)
    }

    const includedSiblingIds = new Set<string>()

    if (exportIncludeSiblings) {
      for (const relationship of treeRelationships) {
        if (
          relationship.relationship_type === 'sibling' &&
          (personIds.has(relationship.person_a_id) || personIds.has(relationship.person_b_id))
        ) {
          personIds.add(relationship.person_a_id)
          personIds.add(relationship.person_b_id)
          includedSiblingIds.add(relationship.person_a_id)
          includedSiblingIds.add(relationship.person_b_id)
          pushEdge({
            id: relationship.id,
            source: relationship.person_a_id,
            target: relationship.person_b_id,
            label: 'sibling',
            type: 'sibling',
          })
        }
      }
    }

    if (exportIncludeParentsOfSiblings) {
      for (const relationship of treeRelationships) {
        if (
          isParentRelationshipType(relationship.relationship_type) &&
          includedSiblingIds.has(relationship.person_b_id)
        ) {
          personIds.add(relationship.person_a_id)
          personIds.add(relationship.person_b_id)
          pushEdge({
            id: relationship.id,
            source: relationship.person_a_id,
            target: relationship.person_b_id,
            label:
              relationship.relationship_type === 'step_parent'
                ? 'step parent'
                : relationship.relationship_type === 'adopted_parent'
                  ? 'adoptive parent'
                  : 'parent',
            type: relationship.relationship_type as 'parent' | 'step_parent' | 'adopted_parent',
          })
        }
      }
    }

    if (exportIncludeSpouses) {
      for (const relationship of treeRelationships) {
        if (
          relationship.relationship_type === 'spouse' &&
          (personIds.has(relationship.person_a_id) || personIds.has(relationship.person_b_id))
        ) {
          personIds.add(relationship.person_a_id)
          personIds.add(relationship.person_b_id)
          pushEdge({
            id: relationship.id,
            source: relationship.person_a_id,
            target: relationship.person_b_id,
            label: 'spouse',
            type: 'spouse',
          })
        }
      }
    }

    if (exportIncludeSiblingSpouses) {
      for (const relationship of treeRelationships) {
        if (
          relationship.relationship_type === 'spouse' &&
          (includedSiblingIds.has(relationship.person_a_id) || includedSiblingIds.has(relationship.person_b_id))
        ) {
          personIds.add(relationship.person_a_id)
          personIds.add(relationship.person_b_id)
          pushEdge({
            id: relationship.id,
            source: relationship.person_a_id,
            target: relationship.person_b_id,
            label: 'spouse',
            type: 'spouse',
          })
        }
      }
    }

    if (exportIncludeChildrenOfSiblings) {
      for (const relationship of treeRelationships) {
        if (
          isParentRelationshipType(relationship.relationship_type) &&
          includedSiblingIds.has(relationship.person_a_id)
        ) {
          personIds.add(relationship.person_a_id)
          personIds.add(relationship.person_b_id)
          pushEdge({
            id: relationship.id,
            source: relationship.person_a_id,
            target: relationship.person_b_id,
            label:
              relationship.relationship_type === 'step_parent'
                ? 'step parent'
                : relationship.relationship_type === 'adopted_parent'
                  ? 'adoptive parent'
                  : 'parent',
            type: relationship.relationship_type as 'parent' | 'step_parent' | 'adopted_parent',
          })
        }
      }
    }

    const exportPeople = Array.from(personIds)
      .map((personId) => treePeopleLookup.get(personId))
      .filter((person): person is TreePersonItem => Boolean(person))

    const graph = new dagre.graphlib.Graph()
    graph.setGraph({
      rankdir: exportDirection === 'ancestors' ? 'BT' : 'TB',
      ranksep: 90,
      nodesep: 32,
      marginx: 24,
      marginy: 24,
    })
    graph.setDefaultEdgeLabel(() => ({}))

    const nodeWidth = exportDetailLevel === 'minimal' ? 150 : exportDetailLevel === 'standard' ? 180 : 210
    const nodeHeight = exportDetailLevel === 'minimal' ? 58 : exportDetailLevel === 'standard' ? 82 : 116

    for (const person of exportPeople) {
      graph.setNode(person.id, { width: nodeWidth, height: nodeHeight })
    }

    for (const edge of edgeRows) {
      graph.setEdge(edge.source, edge.target)
    }

    dagre.layout(graph)

    const template =
      EXPORT_TEMPLATES.find((item) => item.id === exportTemplateId) ?? EXPORT_TEMPLATES[0]

    const laidOutNodes = exportPeople.map((person) => {
      const layoutNode = graph.node(person.id)

      return {
        person,
        x: layoutNode.x - nodeWidth / 2,
        y: layoutNode.y - nodeHeight / 2,
        width: nodeWidth,
        height: nodeHeight,
      }
    })

    const xValues = laidOutNodes.map((node) => node.x)
    const yValues = laidOutNodes.map((node) => node.y)
    const maxXValues = laidOutNodes.map((node) => node.x + node.width)
    const maxYValues = laidOutNodes.map((node) => node.y + node.height)
    const contentWidth = Math.max(...maxXValues, 0) - Math.min(...xValues, 0) + 80
    const contentHeight = Math.max(...maxYValues, 0) - Math.min(...yValues, 0) + 80

    const presetSizes: Record<'18x24' | '24x36' | '36x48', { width: number; height: number }> = {
      '18x24': { width: 1728, height: 2304 },
      '24x36': { width: 2304, height: 3456 },
      '36x48': { width: 3456, height: 4608 },
    }

    const targetSize =
      exportFormat === 'letter'
        ? { width: 816, height: 1056 }
        : exportPosterSize === 'dynamic'
          ? { width: Math.max(1200, contentWidth), height: Math.max(900, contentHeight) }
          : presetSizes[exportPosterSize]

    const scale = Math.min(
      (targetSize.width - 48) / Math.max(contentWidth, 1),
      (targetSize.height - 48) / Math.max(contentHeight, 1)
    )
    const scaledBodyFont = 16 * scale
    const warning =
      exportFormat === 'letter' && scaledBodyFont < 12
        ? 'Poster recommended for readability.'
        : ''

    const edgeMarkup = edgeRows
      .map((edge) => {
        const sourceNode = graph.node(edge.source)
        const targetNode = graph.node(edge.target)
        const stroke =
          edge.type === 'spouse'
            ? '#b45309'
            : edge.type === 'sibling'
              ? '#2563eb'
            : edge.type === 'step_parent'
              ? '#7c3aed'
              : edge.type === 'adopted_parent'
                ? '#059669'
                : template.stroke
        const dashArray =
          edge.type === 'step_parent' ? '8 6' : edge.type === 'adopted_parent' ? '4 4' : '0'

        return `<line x1="${sourceNode.x}" y1="${sourceNode.y + nodeHeight / 2}" x2="${targetNode.x}" y2="${targetNode.y - nodeHeight / 2}" stroke="${stroke}" stroke-width="${edge.type === 'spouse' ? 2 : 2.5}" stroke-dasharray="${dashArray}" />`
      })
      .join('')

    const nodeMarkup = laidOutNodes
      .map((node) => {
        const fullName = escapeSvgText(`${node.person.first_name} ${node.person.last_name}`.trim())
        const years = escapeSvgText(
          node.person.birth_date ? `${new Date(node.person.birth_date).getFullYear()}` : 'Year unknown'
        )
        const location = escapeSvgText(
          [node.person.city, node.person.state].filter(Boolean).join(', ') || 'Location not set'
        )
        const avatarInitial = escapeSvgText(node.person.first_name.slice(0, 1).toUpperCase())
        const avatarMarkup =
          exportDetailLevel === 'full'
            ? `<circle cx="${node.x + 22}" cy="${node.y + 22}" r="14" fill="${template.accent}" opacity="0.18" />
               <text x="${node.x + 22}" y="${node.y + 27}" text-anchor="middle" font-size="14" font-weight="700" fill="${template.stroke}">${avatarInitial}</text>`
            : ''
        const titleX = exportDetailLevel === 'full' ? node.x + 46 : node.x + 14
        const yearsMarkup =
          exportDetailLevel === 'minimal'
            ? ''
            : `<text x="${titleX}" y="${node.y + 50}" font-size="12" fill="#6b7280">${years}</text>`
        const fullMarkup =
          exportDetailLevel === 'full'
            ? `<text x="${node.x + 14}" y="${node.y + 74}" font-size="12" fill="#6b7280">${location}</text>`
            : ''

        return `<g>
          <rect x="${node.x}" y="${node.y}" rx="12" ry="12" width="${node.width}" height="${node.height}" fill="${template.fill}" stroke="${template.stroke}" stroke-width="2" />
          ${avatarMarkup}
          <text x="${titleX}" y="${node.y + 28}" font-size="14" font-weight="700" fill="${template.stroke}">${fullName}</text>
          ${yearsMarkup}
          ${fullMarkup}
        </g>`
      })
      .join('')

    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${targetSize.width}" height="${targetSize.height}" viewBox="0 0 ${targetSize.width} ${targetSize.height}">
      <rect width="100%" height="100%" fill="#f8f9fb" />
      <g transform="translate(24 24) scale(${scale})">
        ${edgeMarkup}
        ${nodeMarkup}
      </g>
    </svg>`

    return {
      svgMarkup,
      width: targetSize.width,
      height: targetSize.height,
      warning,
      nodeCount: exportPeople.length,
    }
  }, [
    exportBranch,
    exportIncludeChildrenOfSiblings,
    exportIncludeParentsOfSiblings,
    exportDetailLevel,
    exportDirection,
    exportFormat,
    exportGenerations,
    exportIncludeSiblingSpouses,
    exportIncludeSiblings,
    exportIncludeSpouses,
    exportPosterSize,
    exportRootId,
    exportTemplateId,
    treePeopleLookup,
    treeRelationships,
  ])

  const letterNodeCountWarning = useMemo(() => {
    if (exportFormat !== 'letter') {
      return ''
    }

    const estimatedNodeCount = exportGraph?.nodeCount ?? 0

    if (estimatedNodeCount >= 16) {
      return 'This node count may make Letter output hard to read. Consider a poster format.'
    }

    return ''
  }, [exportFormat, exportGraph])

  const largeExportWarning = useMemo(() => {
    if (!exportGraph) {
      return ''
    }

    if (exportGraph.nodeCount >= 36) {
      return 'Large branch detected. Reduce generations or use Minimal detail if the preview feels crowded.'
    }

    if (exportGraph.nodeCount >= 24 && exportDetailLevel === 'full') {
      return 'Full detail on this branch may export slowly. Standard or Minimal detail will produce a cleaner print.'
    }

    return ''
  }, [exportDetailLevel, exportGraph])

  useEffect(() => {
    if (!treeFlowInstance || selectedTreeGraph.nodes.length === 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      treeFlowInstance.fitView({
        duration: 250,
        padding: 0.2,
      })
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [selectedTreeGraph, treeFlowInstance])

  useEffect(() => {
    if (DEV_NO_AUTH_TEST_MODE) {
      return
    }

    const client = getSupabaseClient()

    if (!client || !isAuthenticated || !currentFamilyId) {
      setBusinessDirectoryItems([])
      setSelectedBusinessId('')
      return
    }

    let active = true
    setBusinessDirectoryMode('loading')
    setBusinessDirectoryError('')

    void client
      .from('people')
      .select(
        'id, first_name, last_name, business_name, business_logo_url, business_category, business_description, business_city, business_state, business_website'
      )
      .eq('family_id', currentFamilyId)
      .not('business_name', 'is', null)
      .then(({ data, error }) => {
        if (!active) {
          return
        }

        setBusinessDirectoryMode('idle')

        if (error) {
          setBusinessDirectoryError(error.message)
          return
        }

        const items = (data ?? [])
          .filter((row) => (row.business_name ?? '').trim() !== '')
          .map((row) => ({
            id: row.id,
            ownerName: `${row.first_name} ${row.last_name}`.trim(),
            businessName: row.business_name ?? '',
            businessLogoUrl: row.business_logo_url ?? null,
            businessCategory: row.business_category ?? null,
            businessDescription: row.business_description ?? null,
            businessCity: row.business_city ?? null,
            businessState: row.business_state ?? null,
            businessWebsite: row.business_website ?? null,
          }))

        setBusinessDirectoryItems(items)
        setSelectedBusinessId((current) => (current && items.some((item) => item.id === current) ? current : items[0]?.id ?? ''))
      })

    return () => {
      active = false
    }
  }, [currentFamilyId, isAuthenticated])

  useEffect(() => {
    if (DEV_NO_AUTH_TEST_MODE) {
      return
    }

    const client = getSupabaseClient()

    if (!client || !isAuthenticated || !currentFamilyId) {
      setFamilyMapClusters([])
      setSelectedMapClusterId('')
      return
    }

    let active = true
    setMapMode('loading')
    setMapError('')

    void client
      .from('people')
      .select('id, first_name, last_name, city, state, zip')
      .eq('family_id', currentFamilyId)
      .then(({ data, error }) => {
        if (!active) {
          return
        }

        setMapMode('idle')

        if (error) {
          setMapError(error.message)
          return
        }

        const grouped = new Map<
          string,
          { city: string | null; state: string | null; zip: string | null; peopleNames: string[] }
        >()

        for (const row of data ?? []) {
          const city = row.city?.trim() || null
          const state = row.state?.trim() || null
          const zip = row.zip?.trim() || null

          if (!city && !state && !zip) {
            continue
          }

          const key = `${city ?? ''}|${state ?? ''}|${zip ?? ''}`

          if (!grouped.has(key)) {
            grouped.set(key, {
              city,
              state,
              zip,
              peopleNames: [],
            })
          }

          grouped
            .get(key)
            ?.peopleNames.push(`${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Unknown member')
        }

        const clusters = Array.from(grouped.entries()).map(([id, cluster]) => {
          const label = [cluster.city, cluster.state, cluster.zip].filter(Boolean).join(', ')
          const coordinates = estimateLocationCoordinates(cluster.city, cluster.state, cluster.zip)

          return {
            id,
            label,
            city: cluster.city,
            state: cluster.state,
            zip: cluster.zip,
            count: cluster.peopleNames.length,
            peopleNames: cluster.peopleNames.sort((a, b) => a.localeCompare(b)),
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          } satisfies FamilyMapCluster
        })

        setFamilyMapClusters(clusters)
        setSelectedMapClusterId((current) =>
          current && clusters.some((cluster) => cluster.id === current) ? current : clusters[0]?.id ?? ''
        )
      })

    return () => {
      active = false
    }
  }, [currentFamilyId, isAuthenticated])

  const businessCategoryOptions = useMemo(
    () => ['All', ...Array.from(new Set(businessDirectoryItems.map((item) => item.businessCategory).filter(Boolean) as string[])).sort()],
    [businessDirectoryItems]
  )

  const businessStateOptions = useMemo(
    () => ['All', ...Array.from(new Set(businessDirectoryItems.map((item) => item.businessState).filter(Boolean) as string[])).sort()],
    [businessDirectoryItems]
  )

  const filteredBusinessDirectoryItems = useMemo(() => {
    const normalizedSearch = businessSearch.trim().toLowerCase()

    return businessDirectoryItems.filter((item) => {
      const matchesSearch =
        normalizedSearch === '' ||
        item.businessName.toLowerCase().includes(normalizedSearch) ||
        item.ownerName.toLowerCase().includes(normalizedSearch)

      const matchesCategory =
        businessCategoryFilter === 'All' || item.businessCategory === businessCategoryFilter

      const matchesState = businessStateFilter === 'All' || item.businessState === businessStateFilter

      return matchesSearch && matchesCategory && matchesState
    })
  }, [businessCategoryFilter, businessDirectoryItems, businessSearch, businessStateFilter])

  const selectedBusiness =
    filteredBusinessDirectoryItems.find((item) => item.id === selectedBusinessId) ??
    filteredBusinessDirectoryItems[0] ??
    null

  useEffect(() => {
    if (DEV_NO_AUTH_TEST_MODE) {
      return
    }

    const client = getSupabaseClient()

    if (!client || !isAuthenticated || !currentFamilyId || !currentPersonId) {
      setFeedPosts([])
      setUpcomingBirthdaysCount(0)
      setNewMembersCount(0)
      return
    }

    let active = true
    setHomeMode('loading')
    setHomeError('')

    void (async () => {
      const [postsResponse, likesResponse, commentsResponse, peopleResponse] = await Promise.all([
        client
          .from('posts')
          .select('id, author_person_id, content, media_url, created_at')
          .eq('family_id', currentFamilyId)
          .order('created_at', { ascending: false })
          .limit(20),
        client.from('post_likes').select('post_id, person_id'),
        client.from('post_comments').select('id, post_id, person_id, content'),
        client
          .from('people')
          .select('id, first_name, last_name, birth_date, created_at')
          .eq('family_id', currentFamilyId),
      ])

      if (!active) {
        return
      }

      const error =
        postsResponse.error ?? likesResponse.error ?? commentsResponse.error ?? peopleResponse.error

      if (error) {
        setHomeMode('idle')
        setHomeError(error.message)
        return
      }

      const people = peopleResponse.data ?? []
      const personLookup = new Map(
        people.map((person) => [person.id, `${person.first_name} ${person.last_name}`.trim()])
      )

      const likeRows = likesResponse.data ?? []
      const commentRows = commentsResponse.data ?? []

      const likeCountByPost = new Map<string, number>()
      const likedByMePosts = new Set<string>()
      for (const row of likeRows) {
        likeCountByPost.set(row.post_id, (likeCountByPost.get(row.post_id) ?? 0) + 1)
        if (row.person_id === currentPersonId) {
          likedByMePosts.add(row.post_id)
        }
      }

      const commentCountByPost = new Map<string, number>()
      for (const row of commentRows) {
        commentCountByPost.set(row.post_id, (commentCountByPost.get(row.post_id) ?? 0) + 1)
      }

      setFeedPosts(
        (postsResponse.data ?? []).map((post) => ({
          id: post.id,
          authorPersonId: post.author_person_id,
          authorName: personLookup.get(post.author_person_id) ?? 'Family member',
          content: post.content,
          mediaUrl: post.media_url,
          createdAt: post.created_at,
          likeCount: likeCountByPost.get(post.id) ?? 0,
          commentCount: commentCountByPost.get(post.id) ?? 0,
          likedByMe: likedByMePosts.has(post.id),
        }))
      )

      const now = new Date()
      const todayMonthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const futureLimit = new Date(now)
      futureLimit.setDate(futureLimit.getDate() + 30)
      const futureLimitMonthDay = `${String(futureLimit.getMonth() + 1).padStart(2, '0')}-${String(
        futureLimit.getDate()
      ).padStart(2, '0')}`

      const upcomingBirthdays = people.filter((person) => {
        if (!person.birth_date) {
          return false
        }

        const monthDay = person.birth_date.slice(5, 10)

        if (todayMonthDay <= futureLimitMonthDay) {
          return monthDay >= todayMonthDay && monthDay <= futureLimitMonthDay
        }

        return monthDay >= todayMonthDay || monthDay <= futureLimitMonthDay
      }).length

      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const newMembers = people.filter((person) => new Date(person.created_at).getTime() >= sevenDaysAgo.getTime()).length

      setUpcomingBirthdaysCount(upcomingBirthdays)
      setNewMembersCount(newMembers)
      setHomeMode('idle')
    })()

    return () => {
      active = false
    }
  }, [currentFamilyId, currentPersonId, isAuthenticated])

  useEffect(() => {
    if (DEV_NO_AUTH_TEST_MODE) {
      return
    }

    const client = getSupabaseClient()

    if (!client || !isAuthenticated || !currentFamilyId || !currentPersonId) {
      setPeopleOptions([])
      setConversations([])
      setSelectedConversationId('')
      return
    }

    let active = true
    setMessagingMode('loading')
    setMessagingError('')

    void (async () => {
      const peopleResponse = await client
        .from('people')
        .select('id, first_name, last_name')
        .eq('family_id', currentFamilyId)

      if (!active) {
        return
      }

      if (peopleResponse.error) {
        setMessagingMode('idle')
        setMessagingError(peopleResponse.error.message)
        return
      }

      const people = (peopleResponse.data ?? []).map((person) => ({
        id: person.id,
        name: `${person.first_name} ${person.last_name}`.trim(),
      }))
      const peopleLookup = new Map(people.map((person) => [person.id, person.name]))
      setPeopleOptions(people.filter((person) => person.id !== currentPersonId))

      let familyConversationId = ''
      const familyChatResponse = await client
        .from('conversations')
        .select('id')
        .eq('family_id', currentFamilyId)
        .eq('type', 'family')
        .maybeSingle()

      if (!active) {
        return
      }

      if (familyChatResponse.error) {
        setMessagingMode('idle')
        setMessagingError(familyChatResponse.error.message)
        return
      }

      if (familyChatResponse.data?.id) {
        familyConversationId = familyChatResponse.data.id
      } else {
        const createdFamilyChat = await client
          .from('conversations')
          .insert({
            family_id: currentFamilyId,
            type: 'family',
          })
          .select('id')
          .single()

        if (!active) {
          return
        }

        if (createdFamilyChat.error) {
          setMessagingMode('idle')
          setMessagingError(createdFamilyChat.error.message)
          return
        }

        familyConversationId = createdFamilyChat.data.id
      }

      const conversationsResponse = await client
        .from('conversations')
        .select('id, type, created_at')
        .eq('family_id', currentFamilyId)
        .order('created_at', { ascending: false })

      if (!active) {
        return
      }

      if (conversationsResponse.error) {
        setMessagingMode('idle')
        setMessagingError(conversationsResponse.error.message)
        return
      }

      const conversationRows = conversationsResponse.data ?? []
      const conversationIds = conversationRows.map((conversation) => conversation.id)

      const [participantsResponse, lastMessagesResponse] = await Promise.all([
        conversationIds.length > 0
          ? client
              .from('conversation_participants')
              .select('conversation_id, person_id')
              .in('conversation_id', conversationIds)
          : Promise.resolve({ data: [], error: null }),
        conversationIds.length > 0
          ? client
              .from('messages')
              .select('id, conversation_id, content, media_url, created_at, sender_person_id, read_at')
              .in('conversation_id', conversationIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ])

      if (!active) {
        return
      }

      if (participantsResponse.error) {
        setMessagingMode('idle')
        setMessagingError(participantsResponse.error.message)
        return
      }

      if (lastMessagesResponse.error) {
        setMessagingMode('idle')
        setMessagingError(lastMessagesResponse.error.message)
        return
      }

      const participantsByConversation = new Map<string, string[]>()
      for (const row of participantsResponse.data ?? []) {
        const current = participantsByConversation.get(row.conversation_id) ?? []
        current.push(row.person_id)
        participantsByConversation.set(row.conversation_id, current)
      }

      const previewByConversation = new Map<string, string>()
      const unreadCountByConversation = new Map<string, number>()
      for (const row of lastMessagesResponse.data ?? []) {
        if (!previewByConversation.has(row.conversation_id)) {
          previewByConversation.set(
            row.conversation_id,
            row.content.trim() || (row.media_url ? 'Media attachment' : 'No messages yet.')
          )
        }

        if (row.sender_person_id !== currentPersonId && row.read_at === null) {
          unreadCountByConversation.set(
            row.conversation_id,
            (unreadCountByConversation.get(row.conversation_id) ?? 0) + 1
          )
        }
      }

      const builtConversations = conversationRows.map((conversation) => {
        const participantIds = participantsByConversation.get(conversation.id) ?? []
        const otherParticipantNames = participantIds
          .filter((id) => id !== currentPersonId)
          .map((id) => peopleLookup.get(id) ?? 'Unknown person')

        let title = 'Conversation'

        if (conversation.type === 'family') {
          title = 'Family Chat'
        } else if (conversation.type === 'direct') {
          title = otherParticipantNames[0] ?? 'Direct Chat'
        } else {
          title = otherParticipantNames.length > 0 ? otherParticipantNames.join(', ') : 'Group Chat'
        }

        return {
          id: conversation.id,
          type: conversation.type,
          title,
          participantIds,
          preview: previewByConversation.get(conversation.id) ?? 'No messages yet.',
          unreadCount: unreadCountByConversation.get(conversation.id) ?? 0,
        } as ConversationListItem
      })

      builtConversations.sort((left, right) => {
        if (left.id === familyConversationId) return -1
        if (right.id === familyConversationId) return 1
        return 0
      })

      setConversations(builtConversations)
      setSelectedConversationId((current) =>
        current && builtConversations.some((conversation) => conversation.id === current)
          ? current
          : familyConversationId || builtConversations[0]?.id || ''
      )
      setMessagingMode('idle')
    })()

    return () => {
      active = false
    }
  }, [currentFamilyId, currentPersonId, isAuthenticated])

  useEffect(() => {
    if (DEV_NO_AUTH_TEST_MODE) {
      return
    }

    const client = getSupabaseClient()

    if (!client || !isAuthenticated || !selectedConversationId) {
      setMessages([])
      return
    }

    let active = true
    setMessagingMode((current) => (current === 'idle' ? 'loading' : current))

    void client
      .from('messages')
      .select('id, sender_person_id, content, media_url, created_at, read_at')
      .eq('conversation_id', selectedConversationId)
      .order('created_at', { ascending: true })
      .then(async ({ data, error }) => {
        if (!active) {
          return
        }

        if (error) {
          setMessagingMode('idle')
          setMessagingError(error.message)
          return
        }

        const loadedMessages = (data ?? []) as MessageItem[]
        setMessages(loadedMessages)
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === selectedConversationId
              ? { ...conversation, unreadCount: 0 }
              : conversation
          )
        )

        const unreadIncomingIds = loadedMessages
          .filter((message) => message.sender_person_id !== currentPersonId && message.read_at === null)
          .map((message) => message.id)

        if (unreadIncomingIds.length > 0) {
          const nowIso = new Date().toISOString()
          const { error: markReadError } = await client
            .from('messages')
            .update({ read_at: nowIso })
            .in('id', unreadIncomingIds)

          if (!active) {
            return
          }

          if (markReadError) {
            setMessagingMode('idle')
            setMessagingError(markReadError.message)
            return
          }

          setMessages((current) =>
            current.map((message) =>
              unreadIncomingIds.includes(message.id) ? { ...message, read_at: nowIso } : message
            )
          )
        }

        setMessagingMode('idle')
      })

    return () => {
      active = false
    }
  }, [currentPersonId, isAuthenticated, selectedConversationId])

  useEffect(() => {
    const client = getSupabaseClient()

    if (!client || !isAuthenticated || !currentFamilyId || !currentPersonId) {
      return
    }

    const channel = client
      .channel(`family-messages:${currentFamilyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const nextMessage = payload.new as MessageItem & { conversation_id?: string }
          const conversationId = nextMessage.conversation_id

          if (!conversationId) {
            return
          }

          let belongsToKnownConversation = false

          setConversations((current) =>
            current.map((conversation) => {
              if (conversation.id !== conversationId) {
                return conversation
              }

              belongsToKnownConversation = true
              const preview =
                nextMessage.content.trim() ||
                (nextMessage.media_url ? 'Media attachment' : 'No messages yet.')
              const isUnread =
                conversationId !== selectedConversationId &&
                nextMessage.sender_person_id !== currentPersonId &&
                nextMessage.read_at === null

              return {
                ...conversation,
                preview,
                unreadCount: isUnread ? conversation.unreadCount + 1 : conversation.unreadCount,
              }
            })
          )

          if (!belongsToKnownConversation) {
            return
          }

          if (conversationId === selectedConversationId) {
            setMessages((current) =>
              current.some((message) => message.id === nextMessage.id) ? current : [...current, nextMessage]
            )

            if (nextMessage.sender_person_id !== currentPersonId) {
              const nowIso = new Date().toISOString()

              void client
                .from('messages')
                .update({ read_at: nowIso })
                .eq('id', nextMessage.id)

              setMessages((current) =>
                current.map((message) =>
                  message.id === nextMessage.id ? { ...message, read_at: nowIso } : message
                )
              )
            }
          }
        }
      )
      .subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  }, [currentFamilyId, currentPersonId, isAuthenticated, selectedConversationId])

  useEffect(() => {
    if (currentPersonId) {
      localStorage.setItem(PERSON_ID_STORAGE_KEY, currentPersonId)
    } else {
      localStorage.removeItem(PERSON_ID_STORAGE_KEY)
    }
  }, [currentPersonId])

  useEffect(() => {
    if (currentPersonName) {
      localStorage.setItem(PERSON_NAME_STORAGE_KEY, currentPersonName)
    } else {
      localStorage.removeItem(PERSON_NAME_STORAGE_KEY)
    }
  }, [currentPersonName])

  useEffect(() => {
    if (!photoPreviewUrl) {
      return
    }

    return () => {
      URL.revokeObjectURL(photoPreviewUrl)
    }
  }, [photoPreviewUrl])

  const resetAuthFeedback = () => {
    setAuthError('')
    setPasswordResetMessage('')
  }

  const updateAuthField = (field: 'email' | 'password' | 'confirmPassword', value: string) => {
    resetAuthFeedback()
    setAuthForm((current) => ({ ...current, [field]: value }))
  }

  const resetFamilyFeedback = () => {
    setFamilyError('')
  }

  const resetOnboardingFeedback = () => {
    setOnboardingError('')
  }

  const resetProfileFeedback = () => {
    setProfileError('')
  }

  const updateOnboardingField = (
    field:
      | 'firstName'
      | 'lastName'
      | 'gender'
      | 'birthDate'
      | 'city'
      | 'state'
      | 'zip'
      | 'motherName'
      | 'fatherName',
    value: string
  ) => {
    resetOnboardingFeedback()
    setOnboardingForm((current) => ({ ...current, [field]: value }))
  }

  const updateProfileField = (field: keyof typeof profileForm, value: string) => {
    resetProfileFeedback()
    setProfileForm((current) => ({ ...current, [field]: value }))
  }

  const updateTimelineDraft = (field: keyof typeof timelineDraft, value: string) => {
    resetProfileFeedback()
    setTimelineDraft((current) => ({ ...current, [field]: value }))
  }

  const updateMediaDraft = (field: keyof typeof mediaDraft, value: string) => {
    resetProfileFeedback()
    setMediaDraft((current) => ({ ...current, [field]: value }))
  }

  const resetMessagingFeedback = () => {
    setMessagingError('')
  }

  const toggleConversationParticipant = (personId: string) => {
    resetMessagingFeedback()
    setNewConversationParticipantIds((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId]
    )
  }

  const resetHomeFeedback = () => {
    setHomeError('')
  }

  const resetTreeFeedback = () => {
    setTreeError('')
  }

  const handlePhotoSelection = (file: File | null) => {
    resetOnboardingFeedback()

    if (!file) {
      setPhotoFileName('')
      setPhotoPreviewUrl('')
      return
    }

    setPhotoFileName(file.name)
    setPhotoPreviewUrl(URL.createObjectURL(file))
  }

  const goToFamilySetup = async (
    event: FormEvent<HTMLFormElement>,
    mode: 'signup' | 'login'
  ) => {
    event.preventDefault()

    if (!isSupabaseConfigured()) {
      setAuthError(
        'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a .env file.'
      )
      return
    }

    if (mode === 'signup' && authForm.password !== authForm.confirmPassword) {
      setAuthError('Passwords do not match.')
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setAuthError('Supabase client could not be created from the current environment values.')
      return
    }

    setAuthMode('submitting')
    setAuthError('')

    const response =
      mode === 'signup'
        ? await client.auth.signUp({
            email: authForm.email.trim(),
            password: authForm.password,
          })
        : await client.auth.signInWithPassword({
            email: authForm.email.trim(),
            password: authForm.password,
          })

    setAuthMode('idle')

    if (response.error) {
      setAuthError(response.error.message)
      return
    }

    if (!response.data.session) {
      if (mode === 'signup') {
        setStatus('Signup succeeded. Check your email to confirm your account, then log in.')
        setRoute('login')
        return
      }

      setAuthError('No active auth session found. Please log in again.')
      return
    }

    setStatus(
      mode === 'signup'
        ? 'Supabase signup succeeded. Next: create a family or join with an invite.'
        : 'Supabase login succeeded. Next: create a family or join with an invite.'
    )
    setIsAuthenticated(true)
    setRoute('family')
  }

  const handlePasswordReset = async () => {
    resetAuthFeedback()

    if (!isSupabaseConfigured()) {
      setAuthError(
        'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a .env file.'
      )
      return
    }

    if (authForm.email.trim() === '') {
      setAuthError('Enter your email first, then request a password reset.')
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setAuthError('Supabase client could not be created from the current environment values.')
      return
    }

    setPasswordResetMode('submitting')

    const { error } = await client.auth.resetPasswordForEmail(authForm.email.trim(), {
      redirectTo: window.location.origin,
    })

    setPasswordResetMode('idle')

    if (error) {
      setAuthError(error.message)
      return
    }

    setPasswordResetMessage('Password reset email sent. Check your inbox for the Supabase reset link.')
  }

  const handleFamilyAction = async (mode: 'create' | 'join') => {
    if (mode === 'create' && familyName.trim() === '') {
      return
    }

    if (mode === 'join' && inviteCode.trim() === '') {
      return
    }

    resetFamilyFeedback()

    const client = getSupabaseClient()

    if (!client) {
      setFamilyError('Supabase is not configured. Family creation requires a live client.')
      return
    }

    setFamilyMode('submitting')

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()

    if (userError || !user) {
      setFamilyMode('idle')
      setFamilyError(userError?.message ?? 'No authenticated user was found for family creation.')
      return
    }

    if (mode === 'join') {
      const token = extractInviteToken(inviteCode)

      if (token === '') {
        setFamilyMode('idle')
        setFamilyError('A valid invite token is required.')
        return
      }

      const { data: invite, error: inviteError } = await client
        .from('invites')
        .select('family_id, role_default, expires_at')
        .eq('token', token)
        .maybeSingle()

      if (inviteError) {
        setFamilyMode('idle')
        setFamilyError(inviteError.message)
        return
      }

      if (!invite) {
        setFamilyMode('idle')
        setFamilyError('No invite was found for that token.')
        return
      }

      if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
        setFamilyMode('idle')
        setFamilyError('That invite has expired.')
        return
      }

      const { error: membershipError } = await client.from('family_memberships').insert({
        family_id: invite.family_id,
        user_id: user.id,
        role: invite.role_default ?? 'contributor',
      })

      setFamilyMode('idle')

      if (membershipError) {
        setFamilyError(membershipError.message)
        return
      }

      setCurrentFamilyId(invite.family_id)
      setCurrentInviteToken('')
      const { data: joinedFamily } = await client
        .from('families')
        .select('name')
        .eq('id', invite.family_id)
        .maybeSingle()

      if (joinedFamily?.name) {
        setFamilyName(joinedFamily.name)
      }

      setStatus('Invite accepted and membership created. Next: required identity seeding.')
      setRoute('onboarding')
      return
    }

    const { data, error } = await client
      .from('families')
      .insert({
        name: familyName.trim(),
        created_by: user.id,
      })
      .select('id, name')
      .single()

    setFamilyMode('idle')

    if (error) {
      setFamilyError(error.message)
      return
    }

    const { error: membershipError } = await client.from('family_memberships').insert({
      family_id: data.id,
      user_id: user.id,
      role: 'admin',
    })

    if (membershipError) {
      setFamilyError(membershipError.message)
      return
    }

    setCurrentFamilyId(data.id)
    setFamilyName(data.name)

    const generatedInviteToken = createInviteToken()
    const { error: inviteError } = await client.from('invites').insert({
      family_id: data.id,
      token: generatedInviteToken,
      type: 'join',
      role_default: 'contributor',
      created_by: user.id,
    })

    if (inviteError) {
      setCurrentInviteToken('')
      setStatus(
        `Family "${data.name}" was created and your admin membership was added, but invite generation failed.`
      )
      setRoute('onboarding')
      return
    }

    setCurrentInviteToken(generatedInviteToken)
    setStatus(
      `Family "${data.name}" was created, your admin membership was added, and a join invite is ready.`
    )
    setRoute('onboarding')
  }

  const handleLogout = async () => {
    if (DEV_NO_AUTH_TEST_MODE) {
      setAuthError('')
      setStatus('Testing mode is enabled. Log out is disabled while VITE_DEV_NO_AUTH=true.')
      setRoute('workspace')
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setIsAuthenticated(false)
      setCurrentFamilyId('')
      setFamilyName('')
      setCurrentInviteToken('')
      setCurrentPersonId('')
      setCurrentPersonName('')
      setRoute('landing')
      setStatus('Signed out locally. Supabase is not configured in this environment.')
      return
    }

    setAuthMode('submitting')
    setAuthError('')

    const { error } = await client.auth.signOut()

    setAuthMode('idle')

    if (error) {
      setAuthError(error.message)
      return
    }

    setIsAuthenticated(false)
    setCurrentFamilyId('')
    setFamilyName('')
    setCurrentInviteToken('')
    setCurrentPersonId('')
    setCurrentPersonName('')
    setRoute('landing')
    setStatus('Signed out. Create an account or log back in to continue.')
  }

  const findClaimCandidates = async () => {
    const client = getSupabaseClient()

    if (!client || !currentFamilyId) {
      return { data: null, error: 'Family context is missing for profile matching.' }
    }

    const firstName = onboardingForm.firstName.trim()
    const lastName = onboardingForm.lastName.trim()
    const knownParentInputs = [onboardingForm.motherName, onboardingForm.fatherName]
      .map((value) => value.trim())
      .filter((value) => value !== '' && !isUnknownParentName(value))
      .map(normalizeName)

    const { data, error } = await client
      .from('people')
      .select('id, first_name, last_name, birth_date, city, state')
      .eq('family_id', currentFamilyId)
      .ilike('last_name', lastName)
      .limit(10)

    if (error) {
      return { data: null, error: error.message }
    }

    const matches = (data ?? []).filter((candidate) => {
      const candidateFirst = candidate.first_name.trim().toLowerCase()
      const normalizedFirst = firstName.toLowerCase()

      return (
        candidateFirst === normalizedFirst ||
        candidateFirst.startsWith(normalizedFirst) ||
        normalizedFirst.startsWith(candidateFirst)
      )
    })

    if (matches.length === 0) {
      return { data: [], error: null }
    }

    const candidateIds = matches.map((candidate) => candidate.id)
    const { data: parentEdges, error: parentEdgesError } = await client
      .from('relationships')
      .select('person_a_id, person_b_id')
      .eq('family_id', currentFamilyId)
      .eq('relationship_type', 'parent')
      .in('person_b_id', candidateIds)

    if (parentEdgesError) {
      return { data: null, error: parentEdgesError.message }
    }

    const parentIds = Array.from(new Set((parentEdges ?? []).map((edge) => edge.person_a_id)))

    const parentLookup = new Map<string, string>()

    if (parentIds.length > 0) {
      const { data: parentPeople, error: parentPeopleError } = await client
        .from('people')
        .select('id, first_name, last_name')
        .in('id', parentIds)

      if (parentPeopleError) {
        return { data: null, error: parentPeopleError.message }
      }

      for (const parent of parentPeople ?? []) {
        parentLookup.set(
          parent.id,
          `${parent.first_name} ${parent.last_name}`.trim().replace(/\s+/g, ' ')
        )
      }
    }

    const parentHintsByCandidate = new Map<string, string[]>()

    for (const edge of parentEdges ?? []) {
      const existingHints = parentHintsByCandidate.get(edge.person_b_id) ?? []
      const parentName = parentLookup.get(edge.person_a_id)

      if (parentName) {
        existingHints.push(parentName)
        parentHintsByCandidate.set(edge.person_b_id, existingHints)
      }
    }

    const filteredMatches = (matches as CandidateProfile[])
      .map((candidate) => ({
        ...candidate,
        parent_hints: parentHintsByCandidate.get(candidate.id) ?? [],
      }))
      .filter((candidate) => {
        if (knownParentInputs.length === 0) {
          return false
        }

        const normalizedParentHints = candidate.parent_hints.map(normalizeName)

        return knownParentInputs.some((enteredParent) =>
          normalizedParentHints.some(
            (candidateParent) =>
              candidateParent === enteredParent ||
              candidateParent.startsWith(enteredParent) ||
              enteredParent.startsWith(candidateParent)
          )
        )
      })
      .sort((left, right) => {
        const inputBirthYear = onboardingForm.birthDate ? onboardingForm.birthDate.slice(0, 4) : ''
        const leftScore = left.birth_date?.startsWith(inputBirthYear) ? 1 : 0
        const rightScore = right.birth_date?.startsWith(inputBirthYear) ? 1 : 0

        return rightScore - leftScore
      })

    return { data: filteredMatches, error: null }
  }

  const linkUserToPerson = async (userId: string, personId: string) => {
    const client = getSupabaseClient()

    if (!client) {
      return 'Supabase is not configured. User-profile linking requires a live client.'
    }

    const { error } = await client.from('user_person_links').upsert(
      {
        user_id: userId,
        person_id: personId,
        family_id: currentFamilyId,
      },
      { onConflict: 'user_id' }
    )

    return error?.message ?? null
  }

  const createPlaceholderParents = async (childId: string, userId: string) => {
    const client = getSupabaseClient()

    if (!client) {
      return 'Supabase is not configured. Parent placeholder creation requires a live client.'
    }

    const parentInputs = [
      { rawName: onboardingForm.motherName.trim(), fallbackGender: 'Female' },
      { rawName: onboardingForm.fatherName.trim(), fallbackGender: 'Male' },
    ]

    for (const parent of parentInputs) {
      const normalizedName = isUnknownParentName(parent.rawName) ? 'Unknown' : parent.rawName
      const parsedName = splitFullName(normalizedName)

      const { data: parentPerson, error: parentError } = await client
        .from('people')
        .insert({
          family_id: currentFamilyId,
          created_by: userId,
          first_name: parsedName.firstName,
          last_name: parsedName.lastName || onboardingForm.lastName.trim(),
          gender: parent.fallbackGender,
        })
        .select('id')
        .single()

      if (parentError) {
        return parentError.message
      }

      const { error: relationshipError } = await client.from('relationships').insert({
        family_id: currentFamilyId,
        created_by: userId,
        person_a_id: parentPerson.id,
        person_b_id: childId,
        relationship_type: 'parent',
        locked: true,
      })

      if (relationshipError) {
        return relationshipError.message
      }
    }

    return null
  }

  const createNewProfile = async () => {
    const client = getSupabaseClient()

    if (!client) {
      setOnboardingError('Supabase is not configured. Profile creation requires a live client.')
      return
    }

    setOnboardingMode('submitting')
    setOnboardingError('')
    setShowClaimModal(false)

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()

    if (userError || !user) {
      setOnboardingMode('idle')
      setOnboardingError(userError?.message ?? 'No authenticated user was found for onboarding.')
      return
    }

    const { data, error } = await client
      .from('people')
      .insert({
        family_id: currentFamilyId,
        created_by: user.id,
        first_name: onboardingForm.firstName.trim(),
        last_name: onboardingForm.lastName.trim(),
        gender: onboardingForm.gender.trim(),
        birth_date: onboardingForm.birthDate || null,
        city: onboardingForm.city.trim() || null,
        state: onboardingForm.state.trim() || null,
        zip: onboardingForm.zip.trim() || null,
        profile_photo_url: photoFileName || null,
      })
      .select('id, first_name, last_name')
      .single()

    if (error) {
      setOnboardingMode('idle')
      setOnboardingError(error.message)
      return
    }

    const linkError = await linkUserToPerson(user.id, data.id)

    if (linkError) {
      setOnboardingMode('idle')
      setOnboardingError(linkError)
      return
    }

    const parentError = await createPlaceholderParents(data.id, user.id)

    setOnboardingMode('idle')

    if (parentError) {
      setOnboardingError(parentError)
      return
    }

    const fullName = `${data.first_name} ${data.last_name}`.trim()
    setCurrentPersonId(data.id)
    setCurrentPersonName(fullName)
    setClaimCandidates([])
    setStatus(`${fullName} was created in Supabase, linked to your user, and parent placeholders were added.`)
    setRoute('workspace')
  }

  const claimExistingProfile = async (candidate: CandidateProfile) => {
    const client = getSupabaseClient()

    if (!client) {
      setOnboardingError('Supabase is not configured. Profile claim requires a live client.')
      return
    }

    setOnboardingMode('submitting')
    setOnboardingError('')

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()

    if (userError || !user) {
      setOnboardingMode('idle')
      setOnboardingError(userError?.message ?? 'No authenticated user was found for profile claim.')
      return
    }

    const linkError = await linkUserToPerson(user.id, candidate.id)

    setOnboardingMode('idle')

    if (linkError) {
      setOnboardingError(linkError)
      return
    }

    const fullName = `${candidate.first_name} ${candidate.last_name}`.trim()
    setCurrentPersonId(candidate.id)
    setCurrentPersonName(fullName)
    setClaimCandidates([])
    setShowClaimModal(false)
    setStatus(`${fullName} was claimed and linked to your user account.`)
    setRoute('workspace')
  }

  const handleOnboardingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    resetOnboardingFeedback()

    if (
      onboardingForm.firstName.trim() === '' ||
      onboardingForm.lastName.trim() === '' ||
      onboardingForm.gender.trim() === '' ||
      onboardingForm.motherName.trim() === '' ||
      onboardingForm.fatherName.trim() === ''
    ) {
      setOnboardingError('All required onboarding fields must be completed.')
      return
    }

    if (!currentFamilyId) {
      setOnboardingError('No family is selected. Create or join a family before onboarding.')
      return
    }

    const { data, error } = await findClaimCandidates()

    if (error) {
      setOnboardingError(error)
      return
    }

    const currentFullName = `${onboardingForm.firstName.trim()} ${onboardingForm.lastName.trim()}`.trim()

    if (data && data.length > 0) {
      setClaimCandidates(data)
      setShowClaimModal(true)
      setStatus(`Possible matches were found for ${currentFullName}. Choose a profile to claim or create a new one.`)
      return
    }

    await createNewProfile()
  }

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!currentPersonId) {
      setProfileError('No active profile is selected.')
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setProfileError('Supabase is not configured. Profile saving requires a live client.')
      return
    }

    resetProfileFeedback()
    setProfileMode('saving')

    const { data, error } = await client
      .from('people')
      .update({
        first_name: profileForm.firstName.trim(),
        last_name: profileForm.lastName.trim(),
        gender: profileForm.gender.trim() || null,
        birth_date: profileForm.birthDate || null,
        city: profileForm.city.trim() || null,
        state: profileForm.state.trim() || null,
        zip: profileForm.zip.trim() || null,
        bio: profileForm.bio.trim() || null,
        contact_email: profileForm.contactEmail.trim() || null,
        contact_phone: profileForm.contactPhone.trim() || null,
        business_name: profileForm.businessName.trim() || null,
        business_logo_url: profileForm.businessLogoUrl.trim() || null,
        business_category: profileForm.businessCategory.trim() || null,
        business_description: profileForm.businessDescription.trim() || null,
        business_city: profileForm.businessCity.trim() || null,
        business_state: profileForm.businessState.trim() || null,
        business_website: profileForm.businessWebsite.trim() || null,
        business_instagram: profileForm.businessInstagram.trim() || null,
        business_facebook: profileForm.businessFacebook.trim() || null,
      })
      .eq('id', currentPersonId)
      .select(
        'id, first_name, last_name, gender, birth_date, city, state, zip, bio, contact_email, contact_phone, profile_photo_url, business_name, business_logo_url, business_category, business_description, business_city, business_state, business_website, business_instagram, business_facebook'
      )
      .single()

    setProfileMode('idle')

    if (error) {
      setProfileError(error.message)
      return
    }

    const record = data as ProfileRecord
    setProfileRecord(record)
    setProfileForm(buildProfileForm(record))
    setCurrentPersonName(`${record.first_name} ${record.last_name}`.trim())
    setIsEditingProfile(false)
    setStatus(`${record.first_name} ${record.last_name}`.trim() + ' profile updated.')
  }

  const handleAddTimelineEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!currentPersonId || !currentFamilyId) {
      setProfileError('No active profile is selected.')
      return
    }

    if (timelineDraft.eventType.trim() === '' || timelineDraft.description.trim() === '') {
      setProfileError('Timeline events need an event type and description.')
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setProfileError('Supabase is not configured. Timeline updates require a live client.')
      return
    }

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()

    if (userError || !user) {
      setProfileError(userError?.message ?? 'No authenticated user was found for timeline updates.')
      return
    }

    setProfileDataMode('saving')
    resetProfileFeedback()

    const { data, error } = await client
      .from('profile_timeline_events')
      .insert({
        person_id: currentPersonId,
        family_id: currentFamilyId,
        created_by: user.id,
        event_type: timelineDraft.eventType.trim(),
        event_date: timelineDraft.eventDate || null,
        description: timelineDraft.description.trim(),
      })
      .select('id, event_type, event_date, description')
      .single()

    setProfileDataMode('idle')

    if (error) {
      setProfileError(error.message)
      return
    }

    setTimelineItems((current) => [data as TimelineItem, ...current])
    setTimelineDraft({ eventType: '', eventDate: '', description: '' })
  }

  const handleAddMediaItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!currentPersonId || !currentFamilyId) {
      setProfileError('No active profile is selected.')
      return
    }

    if (mediaDraft.mediaUrl.trim() === '') {
      setProfileError('A media URL is required.')
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setProfileError('Supabase is not configured. Media updates require a live client.')
      return
    }

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()

    if (userError || !user) {
      setProfileError(userError?.message ?? 'No authenticated user was found for media updates.')
      return
    }

    setProfileDataMode('saving')
    resetProfileFeedback()

    const { data, error } = await client
      .from('profile_media')
      .insert({
        person_id: currentPersonId,
        family_id: currentFamilyId,
        created_by: user.id,
        media_url: mediaDraft.mediaUrl.trim(),
        caption: mediaDraft.caption.trim() || null,
      })
      .select('id, media_url, caption')
      .single()

    setProfileDataMode('idle')

    if (error) {
      setProfileError(error.message)
      return
    }

    setMediaItems((current) => [data as MediaItem, ...current])
    setMediaDraft({ mediaUrl: '', caption: '' })
  }

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedConversationId || !currentPersonId) {
      setMessagingError('Select a conversation before sending a message.')
      return
    }

    if (messageDraft.content.trim() === '' && messageDraft.mediaUrl.trim() === '') {
      setMessagingError('Add message text or a media URL before sending.')
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setMessagingError('Supabase is not configured. Messaging requires a live client.')
      return
    }

    setMessagingMode('sending')
    resetMessagingFeedback()

    const { error } = await client.from('messages').insert({
      conversation_id: selectedConversationId,
      sender_person_id: currentPersonId,
      content: messageDraft.content.trim(),
      media_url: messageDraft.mediaUrl.trim() || null,
    })

    setMessagingMode('idle')

    if (error) {
      setMessagingError(error.message)
      return
    }

    setMessageDraft({ content: '', mediaUrl: '' })
  }

  const handleCreateConversation = async () => {
    if (!currentFamilyId || !currentPersonId) {
      setMessagingError('A family and active profile are required to create a conversation.')
      return
    }

    const participantIds = Array.from(new Set([currentPersonId, ...newConversationParticipantIds]))

    if (participantIds.length < 2) {
      setMessagingError('Choose at least one other participant.')
      return
    }

    if (newConversationType === 'direct' && participantIds.length !== 2) {
      setMessagingError('Direct chats can only have one other participant.')
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setMessagingError('Supabase is not configured. Conversation creation requires a live client.')
      return
    }

    setMessagingMode('creating')
    resetMessagingFeedback()

    const { data: conversation, error: conversationError } = await client
      .from('conversations')
      .insert({
        family_id: currentFamilyId,
        type: newConversationType,
      })
      .select('id')
      .single()

    if (conversationError) {
      setMessagingMode('idle')
      setMessagingError(conversationError.message)
      return
    }

    const { error: participantsError } = await client.from('conversation_participants').insert(
      participantIds.map((personId) => ({
        conversation_id: conversation.id,
        person_id: personId,
      }))
    )

    setMessagingMode('idle')

    if (participantsError) {
      setMessagingError(participantsError.message)
      return
    }

    const nameLookup = new Map(peopleOptions.map((person) => [person.id, person.name]))
    const otherNames = participantIds
      .filter((personId) => personId !== currentPersonId)
      .map((personId) => nameLookup.get(personId) ?? 'Unknown person')

    const newConversation: ConversationListItem = {
      id: conversation.id,
      type: newConversationType,
      title:
        newConversationType === 'direct'
          ? otherNames[0] ?? 'Direct Chat'
          : otherNames.length > 0
            ? otherNames.join(', ')
            : 'Group Chat',
      participantIds,
      preview: 'No messages yet.',
      unreadCount: 0,
    }

    setConversations((current) => [newConversation, ...current])
    setSelectedConversationId(conversation.id)
    setNewConversationParticipantIds([])
    setNewConversationType('direct')
  }

  const handleCreatePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!currentFamilyId || !currentPersonId) {
      setHomeError('A family and active profile are required to create a post.')
      return
    }

    if (postDraft.content.trim() === '' && postDraft.mediaUrl.trim() === '') {
      setHomeError('Add post content or a media URL before posting.')
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setHomeError('Supabase is not configured. Posting requires a live client.')
      return
    }

    setHomeMode('posting')
    resetHomeFeedback()

    const { data, error } = await client
      .from('posts')
      .insert({
        family_id: currentFamilyId,
        author_person_id: currentPersonId,
        content: postDraft.content.trim(),
        media_url: postDraft.mediaUrl.trim() || null,
      })
      .select('id, author_person_id, content, media_url, created_at')
      .single()

    setHomeMode('idle')

    if (error) {
      setHomeError(error.message)
      return
    }

    setFeedPosts((current) => [
      {
        id: data.id,
        authorPersonId: data.author_person_id,
        authorName: currentPersonName || 'You',
        content: data.content,
        mediaUrl: data.media_url,
        createdAt: data.created_at,
        likeCount: 0,
        commentCount: 0,
        likedByMe: false,
      },
      ...current,
    ])
    setPostDraft({ content: '', mediaUrl: '' })
  }

  const handleTogglePostLike = async (postId: string) => {
    if (!currentPersonId) {
      setHomeError('An active profile is required to like posts.')
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setHomeError('Supabase is not configured. Likes require a live client.')
      return
    }

    const targetPost = feedPosts.find((post) => post.id === postId)

    if (!targetPost) {
      return
    }

    setHomeMode('updating')
    resetHomeFeedback()

    if (targetPost.likedByMe) {
      const { error } = await client
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('person_id', currentPersonId)

      setHomeMode('idle')

      if (error) {
        setHomeError(error.message)
        return
      }

      setFeedPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, likedByMe: false, likeCount: Math.max(0, post.likeCount - 1) }
            : post
        )
      )
      return
    }

    const { error } = await client.from('post_likes').insert({
      post_id: postId,
      person_id: currentPersonId,
    })

    setHomeMode('idle')

    if (error) {
      setHomeError(error.message)
      return
    }

    setFeedPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, likedByMe: true, likeCount: post.likeCount + 1 } : post
      )
    )
  }

  const handleAddComment = async (postId: string) => {
    const content = (commentDrafts[postId] ?? '').trim()

    if (!currentPersonId) {
      setHomeError('An active profile is required to comment.')
      return
    }

    if (content === '') {
      setHomeError('Enter a comment before posting.')
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setHomeError('Supabase is not configured. Comments require a live client.')
      return
    }

    setHomeMode('updating')
    resetHomeFeedback()

    const { error } = await client.from('post_comments').insert({
      post_id: postId,
      person_id: currentPersonId,
      content,
    })

    setHomeMode('idle')

    if (error) {
      setHomeError(error.message)
      return
    }

    setFeedPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post
      )
    )
    setCommentDrafts((current) => ({ ...current, [postId]: '' }))
  }

  const handleAddRelationship = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedTreePerson || !currentFamilyId) {
      setTreeError('Select a person in the tree before adding a relationship.')
      return
    }

    const client = getSupabaseClient()

    if (!client) {
      setTreeError('Supabase is not configured. Tree updates require a live client.')
      return
    }

    let targetPersonId = addRelationshipForm.existingPersonId

    if (addRelationshipForm.useExisting) {
      if (!targetPersonId) {
        setTreeError('Choose an existing person to connect.')
        return
      }
    } else {
      if (addRelationshipForm.firstName.trim() === '' || addRelationshipForm.lastName.trim() === '') {
        setTreeError('New people require at least a first and last name.')
        return
      }
    }

    setTreeMode('saving')
    resetTreeFeedback()

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()

    if (userError || !user) {
      setTreeMode('idle')
      setTreeError(userError?.message ?? 'No authenticated user was found for tree updates.')
      return
    }

    if (!addRelationshipForm.useExisting) {
      const duplicatePerson = treePeople.find(
        (person) =>
          person.id !== selectedTreePerson.id &&
          isSamePersonName(
            person,
            addRelationshipForm.firstName.trim(),
            addRelationshipForm.lastName.trim()
          )
      )

      if (duplicatePerson) {
        setTreeMode('idle')
        setTreeError(
          `Possible duplicate found: ${duplicatePerson.first_name} ${duplicatePerson.last_name}. Reuse the existing person instead.`
        )
        setAddRelationshipForm((current) => ({
          ...current,
          useExisting: true,
          existingPersonId: duplicatePerson.id,
        }))
        return
      }

      const { data: newPerson, error: newPersonError } = await client
        .from('people')
        .insert({
          family_id: currentFamilyId,
          created_by: user.id,
          first_name: addRelationshipForm.firstName.trim(),
          last_name: addRelationshipForm.lastName.trim(),
          gender: addRelationshipForm.gender.trim() || null,
          birth_date: addRelationshipForm.birthDate || null,
        })
        .select('id, first_name, last_name, gender, birth_date, city, state, business_name')
        .single()

      if (newPersonError) {
        setTreeMode('idle')
        setTreeError(newPersonError.message)
        return
      }

      targetPersonId = newPerson.id
      setTreePeople((current) => [...current, newPerson as TreePersonItem])
    }

    let relationshipInsert: {
      person_a_id: string
      person_b_id: string
      relationship_type: string
    }

    switch (addRelationshipForm.relationshipType) {
      case 'child':
        relationshipInsert = {
          person_a_id: selectedTreePerson.id,
          person_b_id: targetPersonId,
          relationship_type: 'parent',
        }
        break
      case 'parent':
      case 'step_parent':
      case 'adopted_parent':
        relationshipInsert = {
          person_a_id: targetPersonId,
          person_b_id: selectedTreePerson.id,
          relationship_type: addRelationshipForm.relationshipType,
        }
        break
      case 'spouse':
      case 'sibling':
        relationshipInsert = {
          person_a_id: selectedTreePerson.id,
          person_b_id: targetPersonId,
          relationship_type: addRelationshipForm.relationshipType,
        }
        break
      default:
        relationshipInsert = {
          person_a_id: selectedTreePerson.id,
          person_b_id: targetPersonId,
          relationship_type: 'sibling',
        }
    }

    const { data: newRelationship, error: relationshipError } = await client
      .from('relationships')
      .insert({
        family_id: currentFamilyId,
        created_by: user.id,
        person_a_id: relationshipInsert.person_a_id,
        person_b_id: relationshipInsert.person_b_id,
        relationship_type: relationshipInsert.relationship_type,
        locked: true,
      })
      .select('id, person_a_id, person_b_id, relationship_type, locked')
      .single()

    setTreeMode('idle')

    if (relationshipError) {
      setTreeError(relationshipError.message)
      return
    }

    setTreeRelationships((current) => [...current, newRelationship as TreeRelationshipItem])
    setShowAddRelationship(false)
    setAddRelationshipForm({
      relationshipType: 'parent',
      existingPersonId: '',
      useExisting: true,
      firstName: '',
      lastName: '',
      gender: '',
      birthDate: '',
    })
  }

  const handleFitTreeBranch = () => {
    if (!treeFlowInstance || selectedTreeGraph.nodes.length === 0) {
      return
    }

    treeFlowInstance.fitView({
      duration: 350,
      padding: 0.2,
    })
  }

  const toggleTreeSection = (section: keyof TreeCollapseState) => {
    setCollapsedTreeSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

  const handleZoomToSelectedTreeNode = () => {
    if (!treeFlowInstance || !selectedTreePerson) {
      return
    }

    const selectedNode = selectedTreeGraph.nodes.find((node) => node.id === selectedTreePerson.id)

    if (!selectedNode) {
      return
    }

    treeFlowInstance.setCenter(selectedNode.position.x + 95, selectedNode.position.y + 55, {
      zoom: 1.15,
      duration: 350,
    })
  }

  const handleRunPathfinder = () => {
    setPathfinderError('')
    setPathfinderResult(null)

    if (!pathfinderPersonAId || !pathfinderPersonBId) {
      setPathfinderError('Select Person B to continue.')
      return
    }

    if (pathfinderPersonAId === pathfinderPersonBId) {
      const samePersonName =
        treePeopleLookup.get(pathfinderPersonAId) &&
        `${treePeopleLookup.get(pathfinderPersonAId)?.first_name} ${treePeopleLookup
          .get(pathfinderPersonAId)
          ?.last_name}`.trim()

      setPathfinderResult({
        personAId: pathfinderPersonAId,
        personBId: pathfinderPersonBId,
        summary: `${samePersonName} is the same person.`,
        pathPersonIds: [pathfinderPersonAId],
        steps: [],
      })
      return
    }

    const visited = new Set<string>([pathfinderPersonAId])
    const queue: Array<{ personId: string; pathPersonIds: string[]; steps: PathfinderStep[] }> = [
      {
        personId: pathfinderPersonAId,
        pathPersonIds: [pathfinderPersonAId],
        steps: [],
      },
    ]

    while (queue.length > 0) {
      const current = queue.shift()

      if (!current) {
        continue
      }

      const neighbors = relationshipAdjacency.get(current.personId) ?? []

      for (const neighbor of neighbors) {
        if (visited.has(neighbor.personId)) {
          continue
        }

        const nextPath = [...current.pathPersonIds, neighbor.personId]
        const nextSteps = [
          ...current.steps,
          {
            fromId: current.personId,
            toId: neighbor.personId,
            relationLabel: neighbor.relationLabel,
          },
        ]

        if (neighbor.personId === pathfinderPersonBId) {
          const personAName = `${
            treePeopleLookup.get(pathfinderPersonAId)?.first_name ?? 'Person A'
          } ${treePeopleLookup.get(pathfinderPersonAId)?.last_name ?? ''}`.trim()
          const personBName = `${
            treePeopleLookup.get(pathfinderPersonBId)?.first_name ?? 'Person B'
          } ${treePeopleLookup.get(pathfinderPersonBId)?.last_name ?? ''}`.trim()

          setPathfinderResult({
            personAId: pathfinderPersonAId,
            personBId: pathfinderPersonBId,
            summary: buildPathfinderSummary(
              personAName,
              personBName,
              nextSteps.map((step) => step.relationLabel)
            ),
            pathPersonIds: nextPath,
            steps: nextSteps,
          })
          return
        }

        visited.add(neighbor.personId)
        queue.push({
          personId: neighbor.personId,
          pathPersonIds: nextPath,
          steps: nextSteps,
        })
      }
    }

    setPathfinderError('No connection found yet, this tree may be missing relationships.')
  }

  const handleHighlightPathInTree = () => {
    if (!pathfinderResult) {
      return
    }

    setHighlightedTreePath(pathfinderResult)
    setTreeRootId(pathfinderResult.personAId)
    setSelectedTreePersonId(pathfinderResult.personAId)
    setWorkspaceView('tree')
  }

  const handleDownloadExportSvg = () => {
    if (!exportGraph) {
      setExportError('No export preview is available yet.')
      return
    }

    setExportError('')
    downloadBlob(
      new Blob([exportGraph.svgMarkup], { type: 'image/svg+xml;charset=utf-8' }),
      `family-tree-${exportFormat}.svg`
    )
  }

  const applyExportPreset = (
    preset: keyof typeof EXPORT_PRESET_LABELS
  ) => {
    setExportError('')
    setLastExportPresetId(preset)

    if (preset === 'immediate_family') {
      setExportDirection('both')
      setExportBranch('both')
      setExportGenerations(1)
      setExportIncludeSpouses(true)
      setExportIncludeSiblings(true)
      setExportIncludeParentsOfSiblings(false)
      setExportIncludeSiblingSpouses(false)
      setExportIncludeChildrenOfSiblings(false)
      setExportDetailLevel('standard')
      setExportFormat('letter')
      setExportPosterSize('dynamic')
      setExportTemplateId('heritage')
      return
    }

    if (preset === 'ancestor_fan') {
      setExportDirection('ancestors')
      setExportBranch('both')
      setExportGenerations(4)
      setExportIncludeSpouses(false)
      setExportIncludeSiblings(false)
      setExportIncludeParentsOfSiblings(false)
      setExportIncludeSiblingSpouses(false)
      setExportIncludeChildrenOfSiblings(false)
      setExportDetailLevel('minimal')
      setExportFormat('poster')
      setExportPosterSize('24x36')
      setExportTemplateId('legacy')
      return
    }

    if (preset === 'maternal_line') {
      setExportDirection('ancestors')
      setExportBranch('maternal')
      setExportGenerations(4)
      setExportIncludeSpouses(false)
      setExportIncludeSiblings(false)
      setExportIncludeParentsOfSiblings(false)
      setExportIncludeSiblingSpouses(false)
      setExportIncludeChildrenOfSiblings(false)
      setExportDetailLevel('minimal')
      setExportFormat('poster')
      setExportPosterSize('24x36')
      setExportTemplateId('sage')
      return
    }

    if (preset === 'paternal_line') {
      setExportDirection('ancestors')
      setExportBranch('paternal')
      setExportGenerations(4)
      setExportIncludeSpouses(false)
      setExportIncludeSiblings(false)
      setExportIncludeParentsOfSiblings(false)
      setExportIncludeSiblingSpouses(false)
      setExportIncludeChildrenOfSiblings(false)
      setExportDetailLevel('minimal')
      setExportFormat('poster')
      setExportPosterSize('24x36')
      setExportTemplateId('navy')
      return
    }

    if (preset === 'one_page_letter') {
      setExportDirection('both')
      setExportBranch('both')
      setExportGenerations(2)
      setExportIncludeSpouses(true)
      setExportIncludeSiblings(false)
      setExportIncludeParentsOfSiblings(false)
      setExportIncludeSiblingSpouses(false)
      setExportIncludeChildrenOfSiblings(false)
      setExportDetailLevel('minimal')
      setExportFormat('letter')
      setExportPosterSize('dynamic')
      setExportTemplateId('slate')
      return
    }

    setExportDirection('descendants')
    setExportBranch('both')
    setExportGenerations(4)
    setExportIncludeSpouses(true)
    setExportIncludeSiblings(false)
    setExportIncludeParentsOfSiblings(false)
    setExportIncludeSiblingSpouses(false)
    setExportIncludeChildrenOfSiblings(false)
    setExportDetailLevel('full')
    setExportFormat('poster')
    setExportPosterSize('24x36')
    setExportTemplateId('linen')
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDownloadExportPng = async () => {
    if (!exportGraph) {
      setExportError('No export preview is available yet.')
      return
    }

    setExportMode('exporting')
    setExportError('')

    try {
      const svgBlob = new Blob([exportGraph.svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)
      const image = new Image()

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Unable to render the SVG export preview.'))
        image.src = svgUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = exportGraph.width
      canvas.height = exportGraph.height
      const context = canvas.getContext('2d')

      if (!context) {
        URL.revokeObjectURL(svgUrl)
        throw new Error('Canvas export is not available in this browser.')
      }

      context.fillStyle = '#f8f9fb'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)
      URL.revokeObjectURL(svgUrl)

      const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))

      if (!pngBlob) {
        throw new Error('PNG export failed.')
      }

      downloadBlob(pngBlob, `family-tree-${exportFormat}.png`)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'PNG export failed.')
    } finally {
      setExportMode('idle')
    }
  }

  const handleDownloadExportPdf = async () => {
    if (!exportGraph) {
      setExportError('No export preview is available yet.')
      return
    }

    setExportMode('exporting')
    setExportError('')

    try {
      const svgBlob = new Blob([exportGraph.svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)
      const image = new Image()

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Unable to render the SVG export preview.'))
        image.src = svgUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = exportGraph.width
      canvas.height = exportGraph.height
      const context = canvas.getContext('2d')

      if (!context) {
        URL.revokeObjectURL(svgUrl)
        throw new Error('Canvas export is not available in this browser.')
      }

      context.fillStyle = '#f8f9fb'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)
      URL.revokeObjectURL(svgUrl)

      const pngDataUrl = canvas.toDataURL('image/png')
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: exportGraph.width > exportGraph.height ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [exportGraph.width, exportGraph.height],
      })

      pdf.addImage(pngDataUrl, 'PNG', 0, 0, exportGraph.width, exportGraph.height)
      pdf.save(`family-tree-${exportFormat}.pdf`)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'PDF export failed.')
    } finally {
      setExportMode('idle')
    }
  }

  const renderLanding = () => (
    <>
      <header className="marketing-header">
        <div className="brand-lockup">
          <span className="brand-mark" />
          <span className="brand-name">FamilyConnect</span>
        </div>
        <nav className="marketing-nav" aria-label="Public navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it Works</a>
          <a href="#privacy">Privacy</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="header-actions">
          <button className="ghost-button" onClick={() => setRoute('login')} type="button">
            Log In
          </button>
          <button className="primary-button" onClick={() => setRoute('signup')} type="button">
            Create Your Family Space
          </button>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">Private by default. Built for families.</p>
            <h1>Your Entire Family. Connected in One Private Space.</h1>
            <p className="hero-text">
              Build a living family tree, discover how you&apos;re related, message relatives, and
              preserve your legacy without ads or noise.
            </p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => setRoute('signup')} type="button">
                Create Your Family Space
              </button>
              <button className="secondary-button" onClick={() => setRoute('login')} type="button">
                Log In
              </button>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="orbital-card">
              <div className="signal-line" />
              <div className="signal-line signal-line-short" />
              <div className="hero-node hero-node-center">You</div>
              <div className="hero-node hero-node-top">Parent</div>
              <div className="hero-node hero-node-right">Cousin</div>
              <div className="hero-node hero-node-left">Aunt</div>
            </div>
          </div>
        </section>

        <section className="section-block build-strip" id="features">
          <div className="section-heading">
            <p className="eyebrow">Build Started</p>
            <h2>Milestone 1 frontend shell is in place</h2>
            <p className="section-note">{status}</p>
          </div>
          <div className="steps-grid">
            <div className="card step-card">
              <span>01</span>
              <h3>Auth shell</h3>
              <p>Signup and login forms now advance into the app.</p>
            </div>
            <div className="card step-card">
              <span>02</span>
              <h3>Family setup</h3>
              <p>Create and join flows are now represented in the UI.</p>
            </div>
            <div className="card step-card">
              <span>03</span>
              <h3>Onboarding</h3>
              <p>Identity seeding now gates entry to the workspace.</p>
            </div>
            <div className="card step-card">
              <span>04</span>
              <h3>Workspace</h3>
              <p>The app shell is ready for real data wiring.</p>
            </div>
          </div>
        </section>

        <section className="section-block" id="how-it-works">
          <div className="section-heading">
            <p className="eyebrow">Next Build Targets</p>
            <h2>What should be wired next</h2>
          </div>
          <div className="feature-grid">
            <article className="card feature-card">
              <h3>Supabase Auth</h3>
              <p>Replace the temporary UI submit handlers with real signup and login requests.</p>
            </article>
            <article className="card feature-card">
              <h3>Family Tables</h3>
              <p>Connect family setup to `families`, `family_memberships`, and `invites`.</p>
            </article>
            <article className="card feature-card">
              <h3>Profile Matching</h3>
              <p>Add duplicate detection and the &quot;Is this you?&quot; claim flow.</p>
            </article>
          </div>
        </section>

        <section className="cta-strip">
          <h2>Start your family space today.</h2>
          <button className="primary-button" onClick={() => setRoute('signup')} type="button">
            Create Your Family Space
          </button>
        </section>
      </main>
    </>
  )

  const renderAuth = (mode: 'signup' | 'login') => (
    <main className="flow-shell">
      <section className="flow-sidebar">
        <div className="brand-lockup">
          <span className="brand-mark" />
          <span className="brand-name">FamilyConnect</span>
        </div>
        <p className="eyebrow">Milestone 1</p>
        <h1>{mode === 'signup' ? 'Create your account' : 'Sign in'}</h1>
        <p className="hero-text">{status}</p>
        <button className="ghost-button inline-button" onClick={() => setRoute('landing')} type="button">
          Back to landing
        </button>
      </section>

      <section className="flow-card card">
        <form className="form-card" onSubmit={(event) => void goToFamilySetup(event, mode)}>
          <div className="form-heading">
            <p className="eyebrow">{mode === 'signup' ? 'Signup' : 'Login'}</p>
            <h2>{mode === 'signup' ? 'Create account' : 'Welcome back'}</h2>
            <p className="muted-text">This form now calls Supabase Auth directly.</p>
          </div>
          {!isSupabaseConfigured() ? (
            <div className="status-callout">
              <strong>Configuration required</strong>
              <p>Copy `.env.example` to `.env` and add your Supabase URL and anon key.</p>
            </div>
          ) : null}
          {authError ? (
            <div className="error-callout" role="alert">
              <strong>Auth error</strong>
              <p>{authError}</p>
            </div>
          ) : null}
          {passwordResetMessage ? (
            <div className="status-callout" role="status">
              <strong>Password reset</strong>
              <p>{passwordResetMessage}</p>
            </div>
          ) : null}
          <label>
            Email
            <input
              className="text-input"
              onChange={(event) => updateAuthField('email', event.target.value)}
              required
              type="email"
              value={authForm.email}
            />
          </label>
          <label>
            Password
            <input
              className="text-input"
              minLength={8}
              onChange={(event) => updateAuthField('password', event.target.value)}
              required
              type="password"
              value={authForm.password}
            />
          </label>
          {mode === 'signup' ? (
            <label>
              Confirm password
              <input
                className="text-input"
                minLength={8}
                onChange={(event) => updateAuthField('confirmPassword', event.target.value)}
                required
                type="password"
                value={authForm.confirmPassword}
              />
            </label>
          ) : null}
          <button className="primary-button wide-button" disabled={authMode === 'submitting'} type="submit">
            {authMode === 'submitting'
              ? 'Submitting...'
              : mode === 'signup'
                ? 'Create account'
                : 'Log in'}
          </button>
          {mode === 'login' ? (
            <button
              className="ghost-button wide-button"
              disabled={passwordResetMode === 'submitting'}
              onClick={() => void handlePasswordReset()}
              type="button"
            >
              {passwordResetMode === 'submitting' ? 'Sending reset email...' : 'Forgot password'}
            </button>
          ) : null}
        </form>
      </section>
    </main>
  )

  const renderFamilySetup = () => (
    <main className="flow-shell">
      <section className="flow-sidebar">
        <div className="brand-lockup">
          <span className="brand-mark" />
          <span className="brand-name">FamilyConnect</span>
        </div>
        <p className="eyebrow">Family Setup</p>
        <h1>Create a family or join with an invite</h1>
        <p className="hero-text">This matches the PRD&apos;s first post-auth step.</p>
        {currentInviteToken ? (
          <div className="status-callout">
            <strong>Join invite ready</strong>
            <p>{`${window.location.origin}?token=${currentInviteToken}`}</p>
          </div>
        ) : null}
      </section>

      <section className="split-card-grid">
        <article className="card form-card">
          <div className="form-heading">
            <p className="eyebrow">Primary</p>
            <h2>Start my family space</h2>
          </div>
          {familyError ? (
            <div className="error-callout" role="alert">
              <strong>Family error</strong>
              <p>{familyError}</p>
            </div>
          ) : null}
          <label>
            Family name
            <input
              className="text-input"
              onChange={(event) => {
                resetFamilyFeedback()
                setFamilyName(event.target.value)
              }}
              placeholder="The Carter Family"
              type="text"
              value={familyName}
            />
          </label>
          <button
            className="primary-button wide-button"
            disabled={familyName.trim() === '' || familyMode === 'submitting'}
            onClick={() => void handleFamilyAction('create')}
            type="button"
          >
            {familyMode === 'submitting' ? 'Creating family...' : 'Create family'}
          </button>
        </article>

        <article className="card form-card">
          <div className="form-heading">
            <p className="eyebrow">Invite</p>
            <h2>I have an invite</h2>
          </div>
          <label>
            Invite code or link
            <input
              className="text-input"
              onChange={(event) => {
                resetFamilyFeedback()
                setInviteCode(event.target.value)
              }}
              placeholder="JOIN-CARTER-2026"
              type="text"
              value={inviteCode}
            />
          </label>
          <button
            className="secondary-button wide-button"
            disabled={inviteCode.trim() === '' || familyMode === 'submitting'}
            onClick={() => void handleFamilyAction('join')}
            type="button"
          >
            Join family
          </button>
        </article>
      </section>
    </main>
  )

  const renderOnboarding = () => (
    <main className="flow-shell">
      <section className="flow-sidebar">
        <div className="brand-lockup">
          <span className="brand-mark" />
          <span className="brand-name">FamilyConnect</span>
        </div>
        <p className="eyebrow">Onboarding</p>
        <h1>Create or claim your profile</h1>
        <p className="hero-text">
          Step 1 builds your identity seed, checks for an existing profile match, then either claims
          that profile or creates a new one with placeholder parents.
        </p>
        {currentInviteToken ? (
          <div className="status-callout">
            <strong>Share this join link</strong>
            <p>{`${window.location.origin}?token=${currentInviteToken}`}</p>
          </div>
        ) : null}
      </section>

      <section className="flow-card card">
        <form className="form-card" onSubmit={(event) => void handleOnboardingSubmit(event)}>
          <div className="form-heading">
            <p className="eyebrow">Step 1</p>
            <h2>Identity seeding</h2>
          </div>
          {onboardingError ? (
            <div className="error-callout" role="alert">
              <strong>Onboarding error</strong>
              <p>{onboardingError}</p>
            </div>
          ) : null}
          <label>
            First name
            <input
              className="text-input"
              onChange={(event) => updateOnboardingField('firstName', event.target.value)}
              placeholder="Alicia"
              type="text"
              value={onboardingForm.firstName}
            />
          </label>
          <label>
            Last name
            <input
              className="text-input"
              onChange={(event) => updateOnboardingField('lastName', event.target.value)}
              placeholder="Johnson"
              type="text"
              value={onboardingForm.lastName}
            />
          </label>
          <label>
            Gender
            <input
              className="text-input"
              onChange={(event) => updateOnboardingField('gender', event.target.value)}
              placeholder="Female"
              type="text"
              value={onboardingForm.gender}
            />
          </label>
          <label>
            Birth date
            <input
              className="text-input"
              onChange={(event) => updateOnboardingField('birthDate', event.target.value)}
              type="date"
              value={onboardingForm.birthDate}
            />
          </label>
          <label>
            City
            <input
              className="text-input"
              onChange={(event) => updateOnboardingField('city', event.target.value)}
              placeholder="Atlanta"
              type="text"
              value={onboardingForm.city}
            />
          </label>
          <label>
            State
            <input
              className="text-input"
              onChange={(event) => updateOnboardingField('state', event.target.value)}
              placeholder="GA"
              type="text"
              value={onboardingForm.state}
            />
          </label>
          <label>
            Zip
            <input
              className="text-input"
              onChange={(event) => updateOnboardingField('zip', event.target.value)}
              placeholder="30301"
              type="text"
              value={onboardingForm.zip}
            />
          </label>
          <label>
            Profile photo
            <input
              className="text-input"
              onChange={(event) => handlePhotoSelection(event.target.files?.[0] ?? null)}
              type="file"
              accept="image/*"
            />
          </label>
          {photoFileName ? (
            <div className="status-callout">
              <strong>Photo selected</strong>
              <p>{photoFileName}</p>
            </div>
          ) : null}
          {photoPreviewUrl ? <img alt="Profile preview" className="photo-preview" src={photoPreviewUrl} /> : null}
          <label>
            Mother name or Unknown
            <input
              className="text-input"
              onChange={(event) => updateOnboardingField('motherName', event.target.value)}
              required
              type="text"
              value={onboardingForm.motherName}
            />
          </label>
          <label>
            Father name or Unknown
            <input
              className="text-input"
              onChange={(event) => updateOnboardingField('fatherName', event.target.value)}
              required
              type="text"
              value={onboardingForm.fatherName}
            />
          </label>
          <button
            className="primary-button wide-button"
            disabled={
              onboardingMode === 'submitting' ||
              onboardingForm.firstName.trim() === '' ||
              onboardingForm.lastName.trim() === '' ||
              onboardingForm.gender.trim() === '' ||
              onboardingForm.motherName.trim() === '' ||
              onboardingForm.fatherName.trim() === ''
            }
            type="submit"
          >
            {onboardingMode === 'submitting' ? 'Creating profile...' : 'Continue to workspace'}
          </button>
        </form>
      </section>
      {showClaimModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="claim-modal-title">
          <div className="modal-card card">
            <div className="form-heading">
              <p className="eyebrow">Possible Match</p>
              <h2 id="claim-modal-title">Is this you?</h2>
              <p className="muted-text">
                We found existing profiles in this family with a similar name and at least one
                matching parent relationship. Claim one or create a new profile instead.
              </p>
            </div>
            <div className="candidate-list">
              {claimCandidates.map((candidate) => (
                <article className="candidate-card" key={candidate.id}>
                  <div>
                    <strong>{`${candidate.first_name} ${candidate.last_name}`}</strong>
                    <p className="muted-text">
                      {candidate.birth_date ? `Born ${candidate.birth_date}` : 'Birth date not set'}
                    </p>
                    <p className="muted-text">
                      {[candidate.city, candidate.state].filter(Boolean).join(', ') || 'Location not set'}
                    </p>
                    <p className="muted-text">
                      {candidate.parent_hints.length > 0
                        ? `Known parents: ${candidate.parent_hints.join(', ')}`
                        : 'Known parents not available'}
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={onboardingMode === 'submitting'}
                    onClick={() => void claimExistingProfile(candidate)}
                    type="button"
                  >
                    Claim profile
                  </button>
                </article>
              ))}
            </div>
            <div className="banner-actions">
              <button
                className="ghost-button"
                disabled={onboardingMode === 'submitting'}
                onClick={() => setShowClaimModal(false)}
                type="button"
              >
                Close
              </button>
              <button
                className="primary-button"
                disabled={onboardingMode === 'submitting'}
                onClick={() => void createNewProfile()}
                type="button"
              >
                {onboardingMode === 'submitting' ? 'Working...' : 'Create new profile'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )

  const renderWorkspace = () => (
    <main className="workspace-shell">
      <header className="workspace-banner">
        <div>
          <p className="eyebrow">Authenticated Workspace</p>
          <h1>Core app shell is active</h1>
          <p className="hero-text">{status}</p>
        </div>
        <div className="banner-actions">
          {authError ? (
            <div className="inline-error" role="alert">
              {authError}
            </div>
          ) : null}
          <button
            className="ghost-button"
            disabled={authMode === 'submitting'}
            onClick={() => void handleLogout()}
            type="button"
          >
            {authMode === 'submitting' ? 'Signing out...' : 'Log out'}
          </button>
        </div>
      </header>
      {DEV_NO_AUTH_TEST_MODE ? (
        <div className="status-callout">
          <strong>Testing mode active</strong>
          <p>No login required. Disable by setting `VITE_DEV_NO_AUTH=false` and restarting `npm run dev`.</p>
        </div>
      ) : null}

      <section className="workspace-showcase workspace-showcase-live">
        <div className="workspace-frame">
          <div className="workspace-topbar">
            <div className="workspace-brand">
              <div className="avatar-badge">F</div>
              <div>
                <strong>Current family: {familyName.trim() || 'Joined family'}</strong>
                <p>
                  {currentFamilyId
                    ? `Family ID: ${currentFamilyId}`
                    : 'Next step: connect these screens to real backend data.'}
                </p>
                {currentPersonName ? <p>Active profile: {currentPersonName}</p> : null}
                {currentInviteToken ? (
                  <p>Join link: {`${window.location.origin}?token=${currentInviteToken}`}</p>
                ) : null}
              </div>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                setWorkspaceView('profile')
                setProfileTab('overview')
                setIsEditingProfile(false)
              }}
              type="button"
            >
              Settings
            </button>
          </div>

          <div className="workspace-body">
            <nav className="workspace-nav" aria-label="App navigation">
              {workspaceViews.map((view) => (
                <button
                  className={`workspace-nav-item ${
                    workspaceView === view ? 'workspace-nav-item-active' : ''
                  }`}
                  key={view}
                  onClick={() => setWorkspaceView(view)}
                  type="button"
                >
                  {view[0].toUpperCase()}
                  {view.slice(1)}
                </button>
              ))}
            </nav>
            <div className="workspace-content">
              {workspaceView === 'home' ? (
                <section className="workspace-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Family Hub</p>
                      <h2>Live family home</h2>
                      <p className="panel-copy">
                        The Home tab now loads real family-scoped feed data, highlights, and posting actions.
                      </p>
                    </div>
                  </div>
                  {homeError ? (
                    <div className="error-callout" role="alert">
                      <strong>Home error</strong>
                      <p>{homeError}</p>
                    </div>
                  ) : null}
                  <div className="quick-actions">
                    {['View Tree', 'Find Connection', 'Invite Family', 'Add Member', 'Businesses', 'Map'].map(
                      (action) => (
                        <button
                          className="action-tile"
                          key={action}
                          onClick={() => {
                            if (action === 'View Tree') {
                              setWorkspaceView('tree')
                            } else if (action === 'Find Connection') {
                              setWorkspaceView('pathfinder')
                            } else if (action === 'Businesses') {
                              setWorkspaceView('businesses')
                            } else if (action === 'Map') {
                              setWorkspaceView('map')
                            }
                          }}
                          type="button"
                        >
                          {action}
                        </button>
                      )
                    )}
                  </div>
                  <div className="dashboard-grid">
                    <div className="card highlight-card">
                      <p className="eyebrow">Highlights</p>
                      <ul className="stack-list">
                        <li>Upcoming birthdays in 30 days: {upcomingBirthdaysCount}</li>
                        <li>New members in 7 days: {newMembersCount}</li>
                        <li>Recent posts: {feedPosts.length}</li>
                      </ul>
                    </div>
                    <form className="card form-card" onSubmit={(event) => void handleCreatePost(event)}>
                      <p className="eyebrow">Post Composer</p>
                      <label>
                        Message
                        <textarea
                          className="text-input text-area"
                          onChange={(event) =>
                            setPostDraft((current) => ({ ...current, content: event.target.value }))
                          }
                          rows={4}
                          value={postDraft.content}
                        />
                      </label>
                      <label>
                        Optional media URL
                        <input
                          className="text-input"
                          onChange={(event) =>
                            setPostDraft((current) => ({ ...current, mediaUrl: event.target.value }))
                          }
                          type="url"
                          value={postDraft.mediaUrl}
                        />
                      </label>
                      <button className="primary-button wide-button" disabled={homeMode === 'posting'} type="submit">
                        {homeMode === 'posting' ? 'Posting...' : 'Share post'}
                      </button>
                    </form>
                  </div>
                  <div className="card">
                    <p className="eyebrow">Feed</p>
                    {homeMode === 'loading' ? <p className="muted-text">Loading family feed...</p> : null}
                    <div className="feed-list">
                      {feedPosts.length > 0 ? (
                        feedPosts.map((post) => (
                          <article className="feed-post-card" key={post.id}>
                            <div className="feed-post">
                              <div className="avatar-badge">{post.authorName.slice(0, 1).toUpperCase()}</div>
                              <div>
                                <div className="feed-meta">
                                  <strong>{post.authorName}</strong>
                                  <span>{new Date(post.createdAt).toLocaleString()}</span>
                                </div>
                                <p>{post.content || 'Media-only post'}</p>
                                {post.mediaUrl ? (
                                  <a href={post.mediaUrl} rel="noreferrer" target="_blank">
                                    {post.mediaUrl}
                                  </a>
                                ) : null}
                              </div>
                            </div>
                            <div className="banner-actions">
                              <button
                                className="secondary-button"
                                disabled={homeMode === 'updating'}
                                onClick={() => void handleTogglePostLike(post.id)}
                                type="button"
                              >
                                {post.likedByMe ? 'Unlike' : 'Like'} ({post.likeCount})
                              </button>
                              <span className="muted-text">Comments: {post.commentCount}</span>
                            </div>
                            <div className="comment-row">
                              <input
                                className="text-input"
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [post.id]: event.target.value,
                                  }))
                                }
                                placeholder="Write a comment"
                                type="text"
                                value={commentDrafts[post.id] ?? ''}
                              />
                              <button
                                className="secondary-button"
                                disabled={homeMode === 'updating'}
                                onClick={() => void handleAddComment(post.id)}
                                type="button"
                              >
                                Comment
                              </button>
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="muted-text">No posts yet. Share the first update for your family.</p>
                      )}
                    </div>
                  </div>
                </section>
              ) : workspaceView === 'tree' ? (
                <section className="workspace-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Interactive Tree</p>
                      <h2>Family graph view</h2>
                      <p className="panel-copy">
                        The tree is now backed by real `people` and `relationships` data with a selected root,
                        branch filtering, and relationship creation.
                      </p>
                    </div>
                  </div>
                  {highlightedTreePath ? (
                    <div className="success-callout path-highlight-banner" role="status">
                      <div>
                        <strong>Path highlight active</strong>
                        <p>{highlightedTreePath.summary}</p>
                      </div>
                      <button
                        className="secondary-button"
                        onClick={() => setHighlightedTreePath(null)}
                        type="button"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                  {treeError ? (
                    <div className="error-callout" role="alert">
                      <strong>Tree error</strong>
                      <p>{treeError}</p>
                    </div>
                  ) : null}
                  <div className="tree-toolbar">
                    <label>
                      <span className="eyebrow">Viewing from</span>
                      <select
                        className="text-input"
                        onChange={(event) => {
                          setTreeRootId(event.target.value)
                          setSelectedTreePersonId(event.target.value)
                        }}
                        value={treeRootId}
                      >
                        {treePeople.map((person) => (
                          <option key={person.id} value={person.id}>
                            {`${person.first_name} ${person.last_name}`.trim()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="eyebrow">Branch</span>
                      <select
                        className="text-input"
                        onChange={(event) =>
                          setTreeBranchFilter(event.target.value as 'both' | 'maternal' | 'paternal')
                        }
                        value={treeBranchFilter}
                      >
                        <option value="both">Both</option>
                        <option value="maternal">Maternal</option>
                        <option value="paternal">Paternal</option>
                      </select>
                    </label>
                    <label>
                      <span className="eyebrow">Search</span>
                      <input
                        className="text-input"
                        onChange={(event) => setTreeSearch(event.target.value)}
                        placeholder="Find a person"
                        type="text"
                        value={treeSearch}
                      />
                    </label>
                  </div>
                  <div className="tree-layout">
                    <div className="tree-canvas real-tree-canvas">
                      {treeMode === 'loading' ? <p className="muted-text">Loading family tree...</p> : null}
                      {rootTreePerson ? (
                        <>
                          <div className="tree-canvas-actions">
                            <button className="secondary-button" onClick={handleZoomToSelectedTreeNode} type="button">
                              Zoom to Selected
                            </button>
                            <button className="secondary-button" onClick={handleFitTreeBranch} type="button">
                              Fit Branch
                            </button>
                          </div>
                          <div className="tree-collapse-actions">
                            <button
                              className="ghost-button"
                              onClick={() => toggleTreeSection('ancestors')}
                              type="button"
                            >
                              {collapsedTreeSections.ancestors ? 'Expand' : 'Collapse'} Ancestors ({treeSectionCounts.ancestors})
                            </button>
                            <button
                              className="ghost-button"
                              onClick={() => toggleTreeSection('descendants')}
                              type="button"
                            >
                              {collapsedTreeSections.descendants ? 'Expand' : 'Collapse'} Descendants ({treeSectionCounts.descendants})
                            </button>
                            <button
                              className="ghost-button"
                              onClick={() => toggleTreeSection('siblings')}
                              type="button"
                            >
                              {collapsedTreeSections.siblings ? 'Expand' : 'Collapse'} Siblings ({treeSectionCounts.siblings})
                            </button>
                            <button
                              className="ghost-button"
                              onClick={() => toggleTreeSection('spouses')}
                              type="button"
                            >
                              {collapsedTreeSections.spouses ? 'Expand' : 'Collapse'} Spouses ({treeSectionCounts.spouses})
                            </button>
                          </div>
                          <Suspense fallback={<div className="tree-flow-shell"><p className="muted-text">Loading tree canvas...</p></div>}>
                            <TreeCanvas
                              edges={selectedTreeGraph.edges}
                              nodes={selectedTreeGraph.nodes}
                              onInit={setTreeFlowInstance}
                              onNodeSelect={setSelectedTreePersonId}
                            />
                          </Suspense>
                          <div className="card tree-legend">
                            <p className="eyebrow">Graph Layout</p>
                            <p className="muted-text">
                              {highlightedTreePath
                                ? 'Path focus mode highlights the exact connection in gold and temporarily hides unrelated nodes.'
                                : 'Dagre now spaces the branch automatically, couples share a family connector before children branch downward, and dense generations can be collapsed or expanded on demand.'}
                            </p>
                          </div>
                          <div className="card">
                            <p className="eyebrow">Search Results</p>
                            <div className="tree-search-results">
                              {searchedTreePeople.slice(0, 10).map((person) => (
                                <button
                                  className="chip"
                                  key={person.id}
                                  onClick={() => setSelectedTreePersonId(person.id)}
                                  type="button"
                                >
                                  {`${person.first_name} ${person.last_name}`.trim()}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="muted-text">No people are available to render in this family tree yet.</p>
                      )}
                    </div>
                    <aside className="card side-panel">
                      {selectedTreePerson ? (
                        <>
                          <p className="eyebrow">Selected Node</p>
                          <h3>{`${selectedTreePerson.first_name} ${selectedTreePerson.last_name}`.trim()}</h3>
                          <p className="muted-text">
                            {[selectedTreePerson.city, selectedTreePerson.state].filter(Boolean).join(', ') ||
                              'Location not set'}
                          </p>
                          <div className="side-actions">
                            <button
                              className="secondary-button"
                              onClick={() => {
                                setTreeRootId(selectedTreePerson.id)
                                setWorkspaceView('tree')
                              }}
                              type="button"
                            >
                              Set as Root
                            </button>
                            <button
                              className="secondary-button"
                              onClick={() => {
                                setCurrentPersonId(selectedTreePerson.id)
                                setCurrentPersonName(
                                  `${selectedTreePerson.first_name} ${selectedTreePerson.last_name}`.trim()
                                )
                                setWorkspaceView('profile')
                              }}
                              type="button"
                            >
                              View Profile
                            </button>
                            <button
                              className="secondary-button"
                              onClick={() => {
                                setShowAddRelationship((current) => !current)
                                resetTreeFeedback()
                              }}
                              type="button"
                            >
                              {showAddRelationship ? 'Close Form' : 'Add Relationship'}
                            </button>
                          </div>
                          {showAddRelationship ? (
                            <form className="form-card" onSubmit={(event) => void handleAddRelationship(event)}>
                              <label>
                                Relationship type
                                <select
                                  className="text-input"
                                  onChange={(event) =>
                                    setAddRelationshipForm((current) => ({
                                      ...current,
                                      relationshipType: event.target.value,
                                    }))
                                  }
                                  value={addRelationshipForm.relationshipType}
                                >
                                  <option value="parent">Add Parent</option>
                                  <option value="child">Add Child</option>
                                  <option value="spouse">Add Spouse</option>
                                  <option value="sibling">Add Sibling</option>
                                  <option value="step_parent">Add Step Parent</option>
                                  <option value="adopted_parent">Add Adopted Parent</option>
                                </select>
                              </label>
                              <label className="checkbox-row">
                                <input
                                  checked={addRelationshipForm.useExisting}
                                  onChange={(event) =>
                                    setAddRelationshipForm((current) => ({
                                      ...current,
                                      useExisting: event.target.checked,
                                      existingPersonId: '',
                                    }))
                                  }
                                  type="checkbox"
                                />
                                <span>Use existing person</span>
                              </label>
                              {addRelationshipForm.useExisting ? (
                                <label>
                                  Existing person
                                  <select
                                    className="text-input"
                                    onChange={(event) =>
                                      setAddRelationshipForm((current) => ({
                                        ...current,
                                        existingPersonId: event.target.value,
                                      }))
                                    }
                                    value={addRelationshipForm.existingPersonId}
                                  >
                                    <option value="">Select a person</option>
                                    {treePeople
                                      .filter((person) => person.id !== selectedTreePerson.id)
                                      .map((person) => (
                                        <option key={person.id} value={person.id}>
                                          {`${person.first_name} ${person.last_name}`.trim()}
                                        </option>
                                      ))}
                                  </select>
                                </label>
                              ) : (
                                <>
                                  <label>
                                    First name
                                    <input
                                      className="text-input"
                                      onChange={(event) =>
                                        setAddRelationshipForm((current) => ({
                                          ...current,
                                          firstName: event.target.value,
                                        }))
                                      }
                                      type="text"
                                      value={addRelationshipForm.firstName}
                                    />
                                  </label>
                                  <label>
                                    Last name
                                    <input
                                      className="text-input"
                                      onChange={(event) =>
                                        setAddRelationshipForm((current) => ({
                                          ...current,
                                          lastName: event.target.value,
                                        }))
                                      }
                                      type="text"
                                      value={addRelationshipForm.lastName}
                                    />
                                  </label>
                                  <label>
                                    Gender
                                    <input
                                      className="text-input"
                                      onChange={(event) =>
                                        setAddRelationshipForm((current) => ({
                                          ...current,
                                          gender: event.target.value,
                                        }))
                                      }
                                      type="text"
                                      value={addRelationshipForm.gender}
                                    />
                                  </label>
                                  <label>
                                    Birth date
                                    <input
                                      className="text-input"
                                      onChange={(event) =>
                                        setAddRelationshipForm((current) => ({
                                          ...current,
                                          birthDate: event.target.value,
                                        }))
                                      }
                                      type="date"
                                      value={addRelationshipForm.birthDate}
                                    />
                                  </label>
                                </>
                              )}
                              <button className="primary-button wide-button" disabled={treeMode === 'saving'} type="submit">
                                {treeMode === 'saving' ? 'Saving...' : 'Save relationship'}
                              </button>
                            </form>
                          ) : null}
                        </>
                      ) : (
                        <p className="muted-text">Select a node to inspect it.</p>
                      )}
                    </aside>
                  </div>
                </section>
              ) : workspaceView === 'pathfinder' ? (
                <Suspense fallback={<section className="workspace-panel"><div className="card"><p className="muted-text">Loading pathfinder...</p></div></section>}>
                  <PathfinderWorkspace
                    clearPathfinderResult={() => {
                      setPathfinderResult(null)
                      setPathfinderError('')
                    }}
                    currentPersonId={currentPersonId}
                    onHighlightPathInTree={handleHighlightPathInTree}
                    onRunPathfinder={handleRunPathfinder}
                    pathfinderError={pathfinderError}
                    pathfinderMode={pathfinderMode}
                    pathfinderPersonAId={pathfinderPersonAId}
                    pathfinderPersonBId={pathfinderPersonBId}
                    pathfinderPersonBQuery={pathfinderPersonBQuery}
                    pathfinderResult={pathfinderResult}
                    pathfinderSearchResults={pathfinderSearchResults}
                    setPathfinderPersonAId={setPathfinderPersonAId}
                    setPathfinderPersonBId={setPathfinderPersonBId}
                    setPathfinderPersonBQuery={setPathfinderPersonBQuery}
                    treePeople={treePeople}
                  />
                </Suspense>
              ) : workspaceView === 'messages' ? (
                <section className="workspace-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Messaging</p>
                      <h2>Realtime family conversations</h2>
                      <p className="panel-copy">
                        Family chat, direct chats, and group chats are now backed by Supabase tables.
                      </p>
                    </div>
                  </div>
                  {messagingError ? (
                    <div className="error-callout" role="alert">
                      <strong>Messaging error</strong>
                      <p>{messagingError}</p>
                    </div>
                  ) : null}
                  <div className="chat-layout">
                    <aside className="card conversation-list">
                      <div className="form-card">
                        <p className="eyebrow">New Conversation</p>
                        <label>
                          Type
                          <select
                            className="text-input"
                            onChange={(event) =>
                              setNewConversationType(event.target.value as 'direct' | 'group')
                            }
                            value={newConversationType}
                          >
                            <option value="direct">Direct</option>
                            <option value="group">Group</option>
                          </select>
                        </label>
                        <div className="participant-picker">
                          {peopleOptions.map((person) => (
                            <label className="checkbox-row" key={person.id}>
                              <input
                                checked={newConversationParticipantIds.includes(person.id)}
                                onChange={() => toggleConversationParticipant(person.id)}
                                type="checkbox"
                              />
                              <span>{person.name}</span>
                            </label>
                          ))}
                        </div>
                        <button
                          className="primary-button wide-button"
                          disabled={messagingMode === 'creating'}
                          onClick={() => void handleCreateConversation()}
                          type="button"
                        >
                          {messagingMode === 'creating' ? 'Creating...' : 'Start chat'}
                        </button>
                      </div>
                      <div className="conversation-stack">
                        {conversations.map((conversation) => (
                          <button
                            className={`conversation-item ${
                              selectedConversationId === conversation.id ? 'conversation-item-active' : ''
                            }`}
                            key={conversation.id}
                            onClick={() => setSelectedConversationId(conversation.id)}
                            type="button"
                          >
                            <div className="avatar-badge">{conversation.title.slice(0, 1).toUpperCase()}</div>
                            <div>
                              <strong>{conversation.title}</strong>
                              <p>{conversation.preview}</p>
                            </div>
                            {conversation.unreadCount > 0 ? (
                              <span className="unread-pill">{conversation.unreadCount}</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </aside>
                    <div className="card chat-window">
                      <div className="chat-header">
                        {conversations.find((conversation) => conversation.id === selectedConversationId)?.title ||
                          'Select a conversation'}
                      </div>
                      <div className="message-list">
                        {messages.length > 0 ? (
                          messages.map((message) => {
                            const isMine = message.sender_person_id === currentPersonId
                            const senderName =
                              isMine ||
                              !message.sender_person_id
                                ? currentPersonName || 'You'
                                : peopleOptions.find((person) => person.id === message.sender_person_id)?.name ||
                                  'Family member'

                            return (
                              <div
                                className={`message-bubble ${
                                  isMine ? 'message-bubble-me' : 'message-bubble-other'
                                }`}
                                key={message.id}
                              >
                                <strong>{senderName}</strong>
                                {message.content ? <div>{message.content}</div> : null}
                                {message.media_url ? (
                                  <a href={message.media_url} rel="noreferrer" target="_blank">
                                    {message.media_url}
                                  </a>
                                ) : null}
                              </div>
                            )
                          })
                        ) : (
                          <p className="muted-text">No messages yet in this conversation.</p>
                        )}
                      </div>
                      <form className="chat-composer-column" onSubmit={(event) => void handleSendMessage(event)}>
                        <input
                          className="text-input"
                          onChange={(event) =>
                            setMessageDraft((current) => ({ ...current, content: event.target.value }))
                          }
                          placeholder="Type a message"
                          type="text"
                          value={messageDraft.content}
                        />
                        <input
                          className="text-input"
                          onChange={(event) =>
                            setMessageDraft((current) => ({ ...current, mediaUrl: event.target.value }))
                          }
                          placeholder="Optional media URL"
                          type="url"
                          value={messageDraft.mediaUrl}
                        />
                        <button
                          className="primary-button"
                          disabled={messagingMode === 'sending' || selectedConversationId === ''}
                          type="submit"
                        >
                          {messagingMode === 'sending' ? 'Sending...' : 'Send'}
                        </button>
                      </form>
                    </div>
                  </div>
                </section>
              ) : workspaceView === 'businesses' ? (
                <section className="workspace-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Business Directory</p>
                      <h2>Family-owned businesses</h2>
                      <p className="panel-copy">
                        Directory data is now loaded from profile business fields on `people`.
                      </p>
                    </div>
                  </div>
                  {businessDirectoryError ? (
                    <div className="error-callout" role="alert">
                      <strong>Business directory error</strong>
                      <p>{businessDirectoryError}</p>
                    </div>
                  ) : null}
                  <div className="dashboard-grid">
                    <div className="card form-card">
                      <label>
                        Search
                        <input
                          className="text-input"
                          onChange={(event) => setBusinessSearch(event.target.value)}
                          placeholder="Search owner or business"
                          type="text"
                          value={businessSearch}
                        />
                      </label>
                      <label>
                        Category
                        <select
                          className="text-input"
                          onChange={(event) => setBusinessCategoryFilter(event.target.value)}
                          value={businessCategoryFilter}
                        >
                          {businessCategoryOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        State
                        <select
                          className="text-input"
                          onChange={(event) => setBusinessStateFilter(event.target.value)}
                          value={businessStateFilter}
                        >
                          {businessStateOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="status-callout">
                        <strong>Results</strong>
                        <p>
                          {businessDirectoryMode === 'loading'
                            ? 'Loading businesses...'
                            : `${filteredBusinessDirectoryItems.length} business${
                                filteredBusinessDirectoryItems.length === 1 ? '' : 'es'
                              } found`}
                        </p>
                      </div>
                    </div>
                    <div className="card">
                      <p className="eyebrow">Selected Business</p>
                      {selectedBusiness ? (
                        <div className="business-detail">
                          <div className="business-detail-header">
                            <div className="business-logo-badge">
                              {selectedBusiness.businessLogoUrl ? (
                                <img alt={selectedBusiness.businessName} src={selectedBusiness.businessLogoUrl} />
                              ) : (
                                selectedBusiness.businessName.slice(0, 1).toUpperCase()
                              )}
                            </div>
                            <div>
                              <h3>{selectedBusiness.businessName}</h3>
                              <p className="muted-text">{selectedBusiness.ownerName}</p>
                            </div>
                          </div>
                          <ul className="stack-list">
                            <li>Category: {selectedBusiness.businessCategory || 'Not set'}</li>
                            <li>
                              Location:{' '}
                              {[selectedBusiness.businessCity, selectedBusiness.businessState]
                                .filter(Boolean)
                                .join(', ') || 'Not set'}
                            </li>
                            <li>Website: {selectedBusiness.businessWebsite || 'Not set'}</li>
                          </ul>
                          {selectedBusiness.businessDescription ? (
                            <p>{selectedBusiness.businessDescription}</p>
                          ) : (
                            <p className="muted-text">No business description yet.</p>
                          )}
                        </div>
                      ) : (
                        <p className="muted-text">No businesses match the current filters.</p>
                      )}
                    </div>
                  </div>
                  <div className="business-directory-grid">
                    {filteredBusinessDirectoryItems.map((item) => (
                      <button
                        className={`card business-directory-card ${
                          selectedBusiness?.id === item.id ? 'business-directory-card-active' : ''
                        }`}
                        key={item.id}
                        onClick={() => setSelectedBusinessId(item.id)}
                        type="button"
                      >
                        <div className="business-directory-card-top">
                          <div className="business-logo-badge">
                            {item.businessLogoUrl ? (
                              <img alt={item.businessName} src={item.businessLogoUrl} />
                            ) : (
                              item.businessName.slice(0, 1).toUpperCase()
                            )}
                          </div>
                          <div>
                            <strong>{item.businessName}</strong>
                            <p className="muted-text">{item.ownerName}</p>
                          </div>
                        </div>
                        <p className="muted-text">
                          {[item.businessCity, item.businessState].filter(Boolean).join(', ') || 'Location not set'}
                        </p>
                        <p>{item.businessDescription || 'No description yet.'}</p>
                        <span className="chip">{item.businessCategory || 'Uncategorized'}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : workspaceView === 'map' ? (
                <Suspense fallback={<section className="workspace-panel"><div className="card"><p className="muted-text">Loading map...</p></div></section>}>
                  <MapWorkspace
                    familyMapClusters={familyMapClusters}
                    mapError={mapError}
                    mapMode={mapMode}
                    selectedMapClusterId={selectedMapClusterId}
                    setSelectedMapClusterId={setSelectedMapClusterId}
                  />
                </Suspense>
              ) : workspaceView === 'export' ? (
                <section className="workspace-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Export / Print Tree</p>
                      <h2>Deterministic tree export</h2>
                      <p className="panel-copy">
                        Generate a clean SVG preview, then download a PDF or PNG without screenshotting the
                        interactive tree.
                      </p>
                    </div>
                  </div>
                  {exportError ? (
                    <div className="error-callout" role="alert">
                      <strong>Export error</strong>
                      <p>{exportError}</p>
                    </div>
                  ) : null}
                  <div className="map-layout">
                    <aside className="card form-card">
                      <div className="quick-actions">
                        <button
                          className={`action-tile ${
                            activeExportPresetLabel === EXPORT_PRESET_LABELS.immediate_family
                              ? 'action-tile-active'
                              : ''
                          }`}
                          onClick={() => applyExportPreset('immediate_family')}
                          type="button"
                        >
                          {EXPORT_PRESET_LABELS.immediate_family}
                        </button>
                        <button
                          className={`action-tile ${
                            activeExportPresetLabel === EXPORT_PRESET_LABELS.ancestor_fan
                              ? 'action-tile-active'
                              : ''
                          }`}
                          onClick={() => applyExportPreset('ancestor_fan')}
                          type="button"
                        >
                          {EXPORT_PRESET_LABELS.ancestor_fan}
                        </button>
                        <button
                          className={`action-tile ${
                            activeExportPresetLabel === EXPORT_PRESET_LABELS.descendant_poster
                              ? 'action-tile-active'
                              : ''
                          }`}
                          onClick={() => applyExportPreset('descendant_poster')}
                          type="button"
                        >
                          {EXPORT_PRESET_LABELS.descendant_poster}
                        </button>
                        <button
                          className={`action-tile ${
                            activeExportPresetLabel === EXPORT_PRESET_LABELS.maternal_line
                              ? 'action-tile-active'
                              : ''
                          }`}
                          onClick={() => applyExportPreset('maternal_line')}
                          type="button"
                        >
                          {EXPORT_PRESET_LABELS.maternal_line}
                        </button>
                        <button
                          className={`action-tile ${
                            activeExportPresetLabel === EXPORT_PRESET_LABELS.paternal_line
                              ? 'action-tile-active'
                              : ''
                          }`}
                          onClick={() => applyExportPreset('paternal_line')}
                          type="button"
                        >
                          {EXPORT_PRESET_LABELS.paternal_line}
                        </button>
                        <button
                          className={`action-tile ${
                            activeExportPresetLabel === EXPORT_PRESET_LABELS.one_page_letter
                              ? 'action-tile-active'
                              : ''
                          }`}
                          onClick={() => applyExportPreset('one_page_letter')}
                          type="button"
                        >
                          {EXPORT_PRESET_LABELS.one_page_letter}
                        </button>
                      </div>
                      <div className="status-callout">
                        <strong>
                          Preset Active: {activeExportPresetLabel === 'Custom' ? 'Custom Settings' : activeExportPresetLabel}
                        </strong>
                        <p>{exportScopeSummary}</p>
                        <p>
                          Estimated node count: {exportGraph?.nodeCount ?? 0}
                        </p>
                        {letterNodeCountWarning ? <p>{letterNodeCountWarning}</p> : null}
                        {largeExportWarning ? <p>{largeExportWarning}</p> : null}
                        {activeExportPresetLabel === 'Custom' && lastExportPresetId ? (
                          <div className="banner-actions">
                            <button
                              className="ghost-button"
                              onClick={() => applyExportPreset(lastExportPresetId)}
                              type="button"
                            >
                              Reset to {EXPORT_PRESET_LABELS[lastExportPresetId]}
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <label>
                        Root person
                        <select
                          className="text-input"
                          onChange={(event) => setExportRootId(event.target.value)}
                          value={exportRootId}
                        >
                          {treePeople.map((person) => (
                            <option key={person.id} value={person.id}>
                              {`${person.first_name} ${person.last_name}`.trim()}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Direction
                        <select
                          className="text-input"
                          onChange={(event) =>
                            setExportDirection(event.target.value as 'ancestors' | 'descendants' | 'both')
                          }
                          value={exportDirection}
                        >
                          <option value="ancestors">Ancestors</option>
                          <option value="descendants">Descendants</option>
                          <option value="both">Both</option>
                        </select>
                      </label>
                      <label>
                        Branch
                        <select
                          className="text-input"
                          onChange={(event) =>
                            setExportBranch(event.target.value as 'both' | 'maternal' | 'paternal')
                          }
                          value={exportBranch}
                        >
                          <option value="both">Both</option>
                          <option value="maternal">Maternal</option>
                          <option value="paternal">Paternal</option>
                        </select>
                      </label>
                      <label>
                        Generations
                        <input
                          className="text-input"
                          max={6}
                          min={1}
                          onChange={(event) =>
                            setExportGenerations(Math.max(1, Math.min(6, Number(event.target.value) || 1)))
                          }
                          type="number"
                          value={exportGenerations}
                        />
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={exportIncludeSpouses}
                          onChange={(event) => setExportIncludeSpouses(event.target.checked)}
                          type="checkbox"
                        />
                        <span>Include spouses</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={exportIncludeSiblings}
                          onChange={(event) => setExportIncludeSiblings(event.target.checked)}
                          type="checkbox"
                        />
                        <span>Include siblings</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={exportIncludeParentsOfSiblings}
                          disabled={!exportIncludeSiblings}
                          onChange={(event) => setExportIncludeParentsOfSiblings(event.target.checked)}
                          type="checkbox"
                        />
                        <span>Include parents of siblings</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={exportIncludeSiblingSpouses}
                          disabled={!exportIncludeSiblings}
                          onChange={(event) => setExportIncludeSiblingSpouses(event.target.checked)}
                          type="checkbox"
                        />
                        <span>Include siblings&apos; spouses</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={exportIncludeChildrenOfSiblings}
                          disabled={!exportIncludeSiblings}
                          onChange={(event) => setExportIncludeChildrenOfSiblings(event.target.checked)}
                          type="checkbox"
                        />
                        <span>Include children of siblings</span>
                      </label>
                      <label>
                        Detail level
                        <select
                          className="text-input"
                          onChange={(event) =>
                            setExportDetailLevel(event.target.value as 'minimal' | 'standard' | 'full')
                          }
                          value={exportDetailLevel}
                        >
                          <option value="minimal">Minimal</option>
                          <option value="standard">Standard</option>
                          <option value="full">Full</option>
                        </select>
                      </label>
                      <label>
                        Template
                        <select
                          className="text-input"
                          onChange={(event) =>
                            setExportTemplateId(
                              event.target.value as (typeof EXPORT_TEMPLATES)[number]['id']
                            )
                          }
                          value={exportTemplateId}
                        >
                          {EXPORT_TEMPLATES.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Output
                        <select
                          className="text-input"
                          onChange={(event) => setExportFormat(event.target.value as 'letter' | 'poster')}
                          value={exportFormat}
                        >
                          <option value="letter">Letter (8.5 x 11)</option>
                          <option value="poster">Poster</option>
                        </select>
                      </label>
                      {exportFormat === 'poster' ? (
                        <label>
                          Poster size
                          <select
                            className="text-input"
                            onChange={(event) =>
                              setExportPosterSize(
                                event.target.value as 'dynamic' | '18x24' | '24x36' | '36x48'
                              )
                            }
                            value={exportPosterSize}
                          >
                            <option value="dynamic">Dynamic</option>
                            <option value="18x24">18 x 24</option>
                            <option value="24x36">24 x 36</option>
                            <option value="36x48">36 x 48</option>
                          </select>
                        </label>
                      ) : null}
                      <div className="banner-actions">
                        <button
                          className="primary-button"
                          disabled={exportMode === 'exporting' || !exportGraph}
                          onClick={handleDownloadExportSvg}
                          type="button"
                        >
                          Download SVG
                        </button>
                        <button
                          className="secondary-button"
                          disabled={exportMode === 'exporting' || !exportGraph}
                          onClick={() => void handleDownloadExportPdf()}
                          type="button"
                        >
                          {exportMode === 'exporting' ? 'Exporting...' : 'Download PDF'}
                        </button>
                        <button
                          className="secondary-button"
                          disabled={exportMode === 'exporting' || !exportGraph}
                          onClick={() => void handleDownloadExportPng()}
                          type="button"
                        >
                          Download PNG
                        </button>
                      </div>
                    </aside>
                    <div className="card">
                      <p className="eyebrow">SVG Preview</p>
                      {exportGraph ? (
                        <>
                          {exportGraph.warning ? (
                            <div className="status-callout">
                              <strong>Readability warning</strong>
                              <p>{exportGraph.warning}</p>
                            </div>
                          ) : null}
                          {largeExportWarning ? (
                            <div className="status-callout">
                              <strong>Large branch warning</strong>
                              <p>{largeExportWarning}</p>
                            </div>
                          ) : null}
                          <div
                            className="export-preview-shell"
                            dangerouslySetInnerHTML={{ __html: exportGraph.svgMarkup }}
                          />
                        </>
                      ) : (
                        <p className="muted-text">Select a valid root person to generate the export preview.</p>
                      )}
                    </div>
                  </div>
                </section>
              ) : workspaceView === 'profile' ? (
                <section className="workspace-panel">
                  {profileMode === 'loading' ? (
                    <div className="card">
                      <p className="eyebrow">Profile</p>
                      <h2>Loading profile</h2>
                      <p className="muted-text">Fetching the active person record from Supabase.</p>
                    </div>
                  ) : null}
                  {profileError ? (
                    <div className="error-callout" role="alert">
                      <strong>Profile error</strong>
                      <p>{profileError}</p>
                    </div>
                  ) : null}
                  {profileRecord ? (
                    <>
                      <div className="profile-hero card">
                        <div className="profile-avatar">
                          {(currentPersonName || `${profileRecord.first_name} ${profileRecord.last_name}`)
                            .trim()
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="eyebrow">Profile</p>
                          <h2>{`${profileRecord.first_name} ${profileRecord.last_name}`.trim()}</h2>
                          <p className="muted-text">
                            {[
                              [profileRecord.city, profileRecord.state].filter(Boolean).join(', '),
                              profileRecord.gender,
                              profileRecord.birth_date ? `Born ${profileRecord.birth_date}` : '',
                            ]
                              .filter(Boolean)
                              .join(' | ') || 'Location, gender, and birth date can be added here.'}
                          </p>
                        </div>
                        <div className="banner-actions">
                          {isEditingProfile ? (
                            <button
                              className="ghost-button"
                              onClick={() => {
                                setProfileForm(buildProfileForm(profileRecord))
                                setIsEditingProfile(false)
                                resetProfileFeedback()
                              }}
                              type="button"
                            >
                              Cancel
                            </button>
                          ) : null}
                          <button
                            className="primary-button"
                            onClick={() => {
                              setProfileForm(buildProfileForm(profileRecord))
                              setIsEditingProfile(true)
                              resetProfileFeedback()
                            }}
                            type="button"
                          >
                            {isEditingProfile ? 'Editing' : 'Edit Profile'}
                          </button>
                        </div>
                      </div>
                      {isEditingProfile ? (
                        <form className="card form-card" onSubmit={(event) => void handleProfileSave(event)}>
                          <div className="form-heading">
                            <p className="eyebrow">Edit Profile</p>
                            <h3>Update person and business details</h3>
                          </div>
                          <div className="dashboard-grid profile-form-grid">
                            <label>
                              First name
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('firstName', event.target.value)}
                                type="text"
                                value={profileForm.firstName}
                              />
                            </label>
                            <label>
                              Last name
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('lastName', event.target.value)}
                                type="text"
                                value={profileForm.lastName}
                              />
                            </label>
                            <label>
                              Gender
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('gender', event.target.value)}
                                type="text"
                                value={profileForm.gender}
                              />
                            </label>
                            <label>
                              Birth date
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('birthDate', event.target.value)}
                                type="date"
                                value={profileForm.birthDate}
                              />
                            </label>
                            <label>
                              City
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('city', event.target.value)}
                                type="text"
                                value={profileForm.city}
                              />
                            </label>
                            <label>
                              State
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('state', event.target.value)}
                                type="text"
                                value={profileForm.state}
                              />
                            </label>
                            <label>
                              Zip
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('zip', event.target.value)}
                                type="text"
                                value={profileForm.zip}
                              />
                            </label>
                            <label>
                              Contact email
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('contactEmail', event.target.value)}
                                type="email"
                                value={profileForm.contactEmail}
                              />
                            </label>
                          </div>
                          <label>
                            Contact phone
                            <input
                              className="text-input"
                              onChange={(event) => updateProfileField('contactPhone', event.target.value)}
                              type="text"
                              value={profileForm.contactPhone}
                            />
                          </label>
                          <label>
                            Bio
                            <textarea
                              className="text-input text-area"
                              onChange={(event) => updateProfileField('bio', event.target.value)}
                              rows={4}
                              value={profileForm.bio}
                            />
                          </label>
                          <div className="form-heading">
                            <p className="eyebrow">Business</p>
                            <h3>Business details</h3>
                          </div>
                          <div className="dashboard-grid profile-form-grid">
                            <label>
                              Business name
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('businessName', event.target.value)}
                                type="text"
                                value={profileForm.businessName}
                              />
                            </label>
                            <label>
                              Business logo URL
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('businessLogoUrl', event.target.value)}
                                type="url"
                                value={profileForm.businessLogoUrl}
                              />
                            </label>
                            <label>
                              Category
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('businessCategory', event.target.value)}
                                type="text"
                                value={profileForm.businessCategory}
                              />
                            </label>
                            <label>
                              Business city
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('businessCity', event.target.value)}
                                type="text"
                                value={profileForm.businessCity}
                              />
                            </label>
                            <label>
                              Business state
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('businessState', event.target.value)}
                                type="text"
                                value={profileForm.businessState}
                              />
                            </label>
                            <label>
                              Website
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('businessWebsite', event.target.value)}
                                type="url"
                                value={profileForm.businessWebsite}
                              />
                            </label>
                            <label>
                              Instagram
                              <input
                                className="text-input"
                                onChange={(event) => updateProfileField('businessInstagram', event.target.value)}
                                type="text"
                                value={profileForm.businessInstagram}
                              />
                            </label>
                          </div>
                          <label>
                            Facebook
                            <input
                              className="text-input"
                              onChange={(event) => updateProfileField('businessFacebook', event.target.value)}
                              type="text"
                              value={profileForm.businessFacebook}
                            />
                          </label>
                          <label>
                            Business description
                            <textarea
                              className="text-input text-area"
                              onChange={(event) => updateProfileField('businessDescription', event.target.value)}
                              rows={4}
                              value={profileForm.businessDescription}
                            />
                          </label>
                          <button className="primary-button wide-button" disabled={profileMode === 'saving'} type="submit">
                            {profileMode === 'saving' ? 'Saving profile...' : 'Save profile'}
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="chip-row">
                            {(['overview', 'timeline', 'media', 'connections', 'business'] as ProfileTab[]).map(
                              (tab) => (
                                <button
                                  className={`workspace-nav-item ${profileTab === tab ? 'workspace-nav-item-active' : ''}`}
                                  key={tab}
                                  onClick={() => setProfileTab(tab)}
                                  type="button"
                                >
                                  {tab[0].toUpperCase()}
                                  {tab.slice(1)}
                                </button>
                              )
                            )}
                          </div>
                          {profileTab === 'overview' ? (
                            <div className="dashboard-grid">
                              <div className="card">
                                <p className="eyebrow">Overview</p>
                                <p>{profileRecord.bio || 'No bio yet. Use Edit Profile to add more context.'}</p>
                                <div className="chip-row">
                                  {profileRecord.contact_email ? <span className="chip">{profileRecord.contact_email}</span> : null}
                                  {profileRecord.contact_phone ? <span className="chip">{profileRecord.contact_phone}</span> : null}
                                  {profileRecord.zip ? <span className="chip">ZIP {profileRecord.zip}</span> : null}
                                </div>
                              </div>
                              <div className="card">
                                <p className="eyebrow">Snapshot</p>
                                <ul className="stack-list">
                                  <li>Timeline entries: {timelineItems.length}</li>
                                  <li>Media items: {mediaItems.length}</li>
                                  <li>Connections: {connections.length}</li>
                                </ul>
                              </div>
                            </div>
                          ) : null}
                          {profileTab === 'timeline' ? (
                            <div className="dashboard-grid">
                              <form className="card form-card" onSubmit={(event) => void handleAddTimelineEvent(event)}>
                                <p className="eyebrow">Add Timeline Event</p>
                                <label>
                                  Event type
                                  <input
                                    className="text-input"
                                    onChange={(event) => updateTimelineDraft('eventType', event.target.value)}
                                    type="text"
                                    value={timelineDraft.eventType}
                                  />
                                </label>
                                <label>
                                  Event date
                                  <input
                                    className="text-input"
                                    onChange={(event) => updateTimelineDraft('eventDate', event.target.value)}
                                    type="date"
                                    value={timelineDraft.eventDate}
                                  />
                                </label>
                                <label>
                                  Description
                                  <textarea
                                    className="text-input text-area"
                                    onChange={(event) => updateTimelineDraft('description', event.target.value)}
                                    rows={4}
                                    value={timelineDraft.description}
                                  />
                                </label>
                                <button className="primary-button wide-button" disabled={profileDataMode === 'saving'} type="submit">
                                  {profileDataMode === 'saving' ? 'Saving...' : 'Add event'}
                                </button>
                              </form>
                              <div className="card">
                                <p className="eyebrow">Timeline</p>
                                <ul className="stack-list">
                                  {timelineItems.length > 0 ? (
                                    timelineItems.map((item) => (
                                      <li key={item.id}>
                                        <strong>{item.event_date || 'No date'}</strong> {item.event_type}: {item.description}
                                      </li>
                                    ))
                                  ) : (
                                    <li>No timeline entries yet.</li>
                                  )}
                                </ul>
                              </div>
                            </div>
                          ) : null}
                          {profileTab === 'media' ? (
                            <div className="dashboard-grid">
                              <form className="card form-card" onSubmit={(event) => void handleAddMediaItem(event)}>
                                <p className="eyebrow">Add Media</p>
                                <label>
                                  Media URL
                                  <input
                                    className="text-input"
                                    onChange={(event) => updateMediaDraft('mediaUrl', event.target.value)}
                                    type="url"
                                    value={mediaDraft.mediaUrl}
                                  />
                                </label>
                                <label>
                                  Caption
                                  <input
                                    className="text-input"
                                    onChange={(event) => updateMediaDraft('caption', event.target.value)}
                                    type="text"
                                    value={mediaDraft.caption}
                                  />
                                </label>
                                <button className="primary-button wide-button" disabled={profileDataMode === 'saving'} type="submit">
                                  {profileDataMode === 'saving' ? 'Saving...' : 'Add media'}
                                </button>
                              </form>
                              <div className="card">
                                <p className="eyebrow">Media Gallery</p>
                                <div className="media-grid">
                                  {mediaItems.length > 0 ? (
                                    mediaItems.map((item) => (
                                      <figure className="media-card" key={item.id}>
                                        <img alt={item.caption || 'Profile media'} src={item.media_url} />
                                        <figcaption>{item.caption || 'No caption'}</figcaption>
                                      </figure>
                                    ))
                                  ) : (
                                    <p className="muted-text">No media items yet.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : null}
                          {profileTab === 'connections' ? (
                            <div className="card">
                              <p className="eyebrow">Connections</p>
                              <ul className="stack-list">
                                {connections.length > 0 ? (
                                  connections.map((connection) => (
                                    <li key={connection.id}>
                                      <strong>{connection.relationshipLabel}</strong> {connection.name}
                                    </li>
                                  ))
                                ) : (
                                  <li>No connections found for this profile yet.</li>
                                )}
                              </ul>
                            </div>
                          ) : null}
                          {profileTab === 'business' ? (
                            <div className="card">
                              <p className="eyebrow">Business</p>
                              <ul className="stack-list">
                                <li>Business name: {profileRecord.business_name || 'Not set'}</li>
                                <li>Logo URL: {profileRecord.business_logo_url || 'Not set'}</li>
                                <li>Category: {profileRecord.business_category || 'Not set'}</li>
                                <li>Website: {profileRecord.business_website || 'Not set'}</li>
                                <li>
                                  Location:{' '}
                                  {[profileRecord.business_city, profileRecord.business_state]
                                    .filter(Boolean)
                                    .join(', ') || 'Not set'}
                                </li>
                                <li>Instagram: {profileRecord.business_instagram || 'Not set'}</li>
                                <li>Facebook: {profileRecord.business_facebook || 'Not set'}</li>
                              </ul>
                              {profileRecord.business_description ? <p>{profileRecord.business_description}</p> : null}
                            </div>
                          ) : null}
                        </>
                      )}
                    </>
                  ) : null}
                </section>
              ) : (
                <section className="workspace-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Module</p>
                      <h2>Module scaffold</h2>
                      <p className="panel-copy">
                        This panel is the next implementation surface for the next feature slice.
                      </p>
                    </div>
                  </div>
                  <div className="dashboard-grid">
                    <article className="card">
                      <p className="eyebrow">What exists now</p>
                      <ul className="stack-list">
                        <li>Route wiring from landing into the app shell</li>
                        <li>Milestone 1 form states for auth, family setup, and onboarding</li>
                        <li>Responsive shell that keeps the existing visual system</li>
                      </ul>
                    </article>
                    <article className="card">
                      <p className="eyebrow">What to build next</p>
                      <ul className="stack-list">
                        <li>Replace this tab with real data-backed feature components</li>
                        <li>Continue milestone-by-milestone feature delivery</li>
                        <li>Reuse the same family and person context already in state</li>
                      </ul>
                    </article>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )

  if (!authReady) {
    return (
      <main className="flow-shell">
        <section className="flow-sidebar">
          <div className="brand-lockup">
            <span className="brand-mark" />
            <span className="brand-name">FamilyConnect</span>
          </div>
          <p className="eyebrow">Auth</p>
          <h1>Restoring your session</h1>
          <p className="hero-text">Checking Supabase for an existing login before rendering the app.</p>
        </section>
        <section className="flow-card card">
          <div className="status-callout">
            <strong>Loading</strong>
            <p>Waiting for `getSession()` to complete.</p>
          </div>
        </section>
      </main>
    )
  }

  if (route === 'signup') return renderAuth('signup')
  if (route === 'login') return renderAuth('login')
  if (route === 'family')
    return isAuthenticated || DEV_NO_AUTH_TEST_MODE ? renderFamilySetup() : <div className="app-page">{renderLanding()}</div>
  if (route === 'onboarding')
    return isAuthenticated || DEV_NO_AUTH_TEST_MODE ? renderOnboarding() : <div className="app-page">{renderLanding()}</div>
  if (route === 'workspace')
    return isAuthenticated || DEV_NO_AUTH_TEST_MODE ? renderWorkspace() : <div className="app-page">{renderLanding()}</div>

  return <div className="app-page">{renderLanding()}</div>
}

export default App
