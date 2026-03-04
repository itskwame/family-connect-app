import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabase'

type Route = 'landing' | 'signup' | 'login' | 'family' | 'onboarding' | 'workspace'
type WorkspaceView = 'home' | 'tree' | 'messages' | 'profile'
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

const workspaceViews: WorkspaceView[] = ['home', 'tree', 'messages', 'profile']
const FAMILY_ID_STORAGE_KEY = 'family-connect.current-family-id'
const FAMILY_NAME_STORAGE_KEY = 'family-connect.current-family-name'
const PERSON_ID_STORAGE_KEY = 'family-connect.current-person-id'
const PERSON_NAME_STORAGE_KEY = 'family-connect.current-person-name'

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
    businessCategory: record.business_category ?? '',
    businessDescription: record.business_description ?? '',
    businessCity: record.business_city ?? '',
    businessState: record.business_state ?? '',
    businessWebsite: record.business_website ?? '',
    businessInstagram: record.business_instagram ?? '',
    businessFacebook: record.business_facebook ?? '',
  }
}

function App() {
  const [route, setRoute] = useState<Route>('landing')
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('home')
  const [authMode, setAuthMode] = useState<'idle' | 'submitting'>('idle')
  const [familyMode, setFamilyMode] = useState<'idle' | 'submitting'>('idle')
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured())
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [passwordResetMode, setPasswordResetMode] = useState<'idle' | 'submitting'>('idle')
  const [passwordResetMessage, setPasswordResetMessage] = useState('')
  const [authError, setAuthError] = useState('')
  const [familyError, setFamilyError] = useState('')
  const [familyName, setFamilyName] = useState(() => localStorage.getItem(FAMILY_NAME_STORAGE_KEY) ?? '')
  const [currentFamilyId, setCurrentFamilyId] = useState(
    () => localStorage.getItem(FAMILY_ID_STORAGE_KEY) ?? ''
  )
  const [currentInviteToken, setCurrentInviteToken] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [onboardingMode, setOnboardingMode] = useState<'idle' | 'submitting'>('idle')
  const [onboardingError, setOnboardingError] = useState('')
  const [profileMode, setProfileMode] = useState<'idle' | 'loading' | 'saving'>('idle')
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview')
  const [profileError, setProfileError] = useState('')
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
    'Milestone 1 started: landing, auth, family setup, onboarding, and workspace are now connected.'
  )

  useEffect(() => {
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
        'id, first_name, last_name, gender, birth_date, city, state, zip, bio, contact_email, contact_phone, profile_photo_url, business_name, business_category, business_description, business_city, business_state, business_website, business_instagram, business_facebook'
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
        'id, first_name, last_name, gender, birth_date, city, state, zip, bio, contact_email, contact_phone, profile_photo_url, business_name, business_category, business_description, business_city, business_state, business_website, business_instagram, business_facebook'
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
            <button className="secondary-button">Settings</button>
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
              {workspaceView === 'profile' ? (
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
                      <p className="eyebrow">{workspaceView}</p>
                      <h2>{workspaceView[0].toUpperCase() + workspaceView.slice(1)} module scaffold</h2>
                      <p className="panel-copy">
                        This panel is the next implementation surface for the real `{workspaceView}`
                        feature.
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
  if (route === 'family') return isAuthenticated ? renderFamilySetup() : <div className="app-page">{renderLanding()}</div>
  if (route === 'onboarding')
    return isAuthenticated ? renderOnboarding() : <div className="app-page">{renderLanding()}</div>
  if (route === 'workspace')
    return isAuthenticated ? renderWorkspace() : <div className="app-page">{renderLanding()}</div>

  return <div className="app-page">{renderLanding()}</div>
}

export default App
