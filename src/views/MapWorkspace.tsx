import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

type FamilyMapCluster = {
  id: string
  country?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  label: string
  count: number
  peopleMembers: Array<{ id: string; name: string }>
  latitude: number
  longitude: number
}

type ZipPoint = {
  id: string
  zip: string | null
  label: string
  count: number
  latitude: number
  longitude: number
}

type CityCluster = {
  id: string
  stateId: string
  country: string | null
  city: string | null
  state: string | null
  label: string
  count: number
  members: Array<{ id: string; name: string }>
  latitude: number
  longitude: number
  zipPoints: ZipPoint[]
}

type StateCluster = {
  id: string
  country: string | null
  state: string | null
  label: string
  count: number
  members: Array<{ id: string; name: string }>
  latitude: number
  longitude: number
  cityIds: string[]
}

type Props = {
  mapMode: 'idle' | 'loading'
  mapError: string
  familyMapClusters: FamilyMapCluster[]
  currentPersonId: string
  onOpenProfile: (personId: string) => void
  onOpenDirectMessage: (personId: string) => void
  selectedMapClusterId: string
  setSelectedMapClusterId: (value: string) => void
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  })

  useEffect(() => {
    onZoomChange(map.getZoom())
  }, [map, onZoomChange])

  return null
}

export default function MapWorkspace({
  mapMode,
  mapError,
  familyMapClusters,
  currentPersonId,
  onOpenProfile,
  onOpenDirectMessage,
  selectedMapClusterId,
  setSelectedMapClusterId,
}: Props) {
  const [mapZoom, setMapZoom] = useState(5)
  const [countryFilter, setCountryFilter] = useState('All')
  const [stateFilter, setStateFilter] = useState('All')
  const [cityFilter, setCityFilter] = useState('All')

  const { stateClusters, cityClusters } = useMemo(() => {
    const stateGrouped = new Map<
      string,
      {
        id: string
        country: string | null
        state: string | null
        label: string
        count: number
        memberMap: Map<string, string>
        latWeighted: number
        lonWeighted: number
        cityIds: Set<string>
      }
    >()

    const cityGrouped = new Map<
      string,
      {
        id: string
        stateId: string
        country: string | null
        city: string | null
        state: string | null
        label: string
        count: number
        memberMap: Map<string, string>
        latWeighted: number
        lonWeighted: number
        zipPoints: Map<string, ZipPoint>
      }
    >()

    for (const cluster of familyMapClusters) {
      const [labelCity, labelState] = (cluster.label ?? '').split(',').map((item) => item.trim())
      const country = (cluster.country ?? '').trim() || null
      const city = (cluster.city ?? labelCity ?? '').trim() || null
      const state = (cluster.state ?? labelState ?? '').trim() || null
      const stateId = `state:${country ?? 'Unknown'}|${state ?? 'Unknown'}`
      const cityId = `city:${country ?? 'Unknown'}|${state ?? 'Unknown'}|${city ?? 'Unknown'}`
      const stateLabel = state || 'Unknown state'
      const cityLabel = [city, state].filter(Boolean).join(', ') || cluster.label || 'Unknown city'

      if (!stateGrouped.has(stateId)) {
        stateGrouped.set(stateId, {
          id: stateId,
          country,
          state,
          label: stateLabel,
          count: 0,
          memberMap: new Map<string, string>(),
          latWeighted: 0,
          lonWeighted: 0,
          cityIds: new Set<string>(),
        })
      }

      if (!cityGrouped.has(cityId)) {
        cityGrouped.set(cityId, {
          id: cityId,
          stateId,
          country,
          city,
          state,
          label: cityLabel,
          count: 0,
          memberMap: new Map<string, string>(),
          latWeighted: 0,
          lonWeighted: 0,
          zipPoints: new Map<string, ZipPoint>(),
        })
      }

      const stateGroup = stateGrouped.get(stateId)!
      const cityGroup = cityGrouped.get(cityId)!

      stateGroup.count += cluster.count
      cityGroup.count += cluster.count
      stateGroup.latWeighted += cluster.latitude * cluster.count
      stateGroup.lonWeighted += cluster.longitude * cluster.count
      cityGroup.latWeighted += cluster.latitude * cluster.count
      cityGroup.lonWeighted += cluster.longitude * cluster.count
      stateGroup.cityIds.add(cityId)

      for (const member of cluster.peopleMembers) {
        stateGroup.memberMap.set(member.id, member.name)
        cityGroup.memberMap.set(member.id, member.name)
      }

      const zipValue = cluster.zip?.trim() || null
      const zipKey = zipValue ?? 'ZIP not set'
      if (!cityGroup.zipPoints.has(zipKey)) {
        cityGroup.zipPoints.set(zipKey, {
          id: `${cityId}|zip:${zipKey}`,
          zip: zipValue,
          label: zipValue ? `ZIP ${zipValue}` : 'ZIP not set',
          count: 0,
          latitude: cluster.latitude,
          longitude: cluster.longitude,
        })
      }
      cityGroup.zipPoints.get(zipKey)!.count += cluster.count
    }

    const nextStateClusters: StateCluster[] = Array.from(stateGrouped.values())
      .map((stateGroup) => ({
        id: stateGroup.id,
        country: stateGroup.country,
        state: stateGroup.state,
        label: stateGroup.label,
        count: stateGroup.count,
        members: Array.from(stateGroup.memberMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((left, right) => left.name.localeCompare(right.name)),
        latitude: stateGroup.count > 0 ? stateGroup.latWeighted / stateGroup.count : 39.8283,
        longitude: stateGroup.count > 0 ? stateGroup.lonWeighted / stateGroup.count : -98.5795,
        cityIds: Array.from(stateGroup.cityIds),
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))

    const nextCityClusters: CityCluster[] = Array.from(cityGrouped.values())
      .map((cityGroup) => ({
        id: cityGroup.id,
        stateId: cityGroup.stateId,
        country: cityGroup.country,
        city: cityGroup.city,
        state: cityGroup.state,
        label: cityGroup.label,
        count: cityGroup.count,
        members: Array.from(cityGroup.memberMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((left, right) => left.name.localeCompare(right.name)),
        latitude: cityGroup.count > 0 ? cityGroup.latWeighted / cityGroup.count : 39.8283,
        longitude: cityGroup.count > 0 ? cityGroup.lonWeighted / cityGroup.count : -98.5795,
        zipPoints: Array.from(cityGroup.zipPoints.values()).sort(
          (left, right) => right.count - left.count || left.label.localeCompare(right.label)
        ),
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))

    return {
      stateClusters: nextStateClusters,
      cityClusters: nextCityClusters,
    }
  }, [familyMapClusters])

  const countryOptions = useMemo(() => {
    const values = new Set<string>()
    stateClusters.forEach((cluster) => {
      values.add(cluster.country || 'Unknown country')
    })
    return ['All', ...Array.from(values).sort((left, right) => left.localeCompare(right))]
  }, [stateClusters])

  useEffect(() => {
    if (countryFilter !== 'All' && !countryOptions.includes(countryFilter)) {
      setCountryFilter('All')
    }
  }, [countryFilter, countryOptions])

  const stateOptions = useMemo(() => {
    const values = new Set<string>()
    stateClusters
      .filter((cluster) => countryFilter === 'All' || (cluster.country || 'Unknown country') === countryFilter)
      .forEach((cluster) => {
        values.add(cluster.state || 'Unknown state')
      })
    return ['All', ...Array.from(values).sort((left, right) => left.localeCompare(right))]
  }, [countryFilter, stateClusters])

  useEffect(() => {
    if (stateFilter !== 'All' && !stateOptions.includes(stateFilter)) {
      setStateFilter('All')
    }
  }, [stateFilter, stateOptions])

  const cityOptions = useMemo(() => {
    const values = new Set<string>()
    cityClusters
      .filter((cluster) => {
        const clusterCountry = cluster.country || 'Unknown country'
        const clusterState = cluster.state || 'Unknown state'

        if (countryFilter !== 'All' && clusterCountry !== countryFilter) {
          return false
        }
        if (stateFilter !== 'All' && clusterState !== stateFilter) {
          return false
        }

        return true
      })
      .forEach((cluster) => {
        values.add(cluster.city || 'Unknown city')
      })
    return ['All', ...Array.from(values).sort((left, right) => left.localeCompare(right))]
  }, [cityClusters, countryFilter, stateFilter])

  useEffect(() => {
    if (cityFilter !== 'All' && !cityOptions.includes(cityFilter)) {
      setCityFilter('All')
    }
  }, [cityFilter, cityOptions])

  const filteredStateClusters = useMemo(
    () =>
      stateClusters.filter((cluster) => {
        const clusterCountry = cluster.country || 'Unknown country'
        const clusterState = cluster.state || 'Unknown state'

        if (countryFilter !== 'All' && clusterCountry !== countryFilter) {
          return false
        }
        if (stateFilter !== 'All' && clusterState !== stateFilter) {
          return false
        }

        return true
      }),
    [countryFilter, stateClusters, stateFilter]
  )

  const filteredCityClusters = useMemo(
    () =>
      cityClusters.filter((cluster) => {
        const clusterCountry = cluster.country || 'Unknown country'
        const clusterState = cluster.state || 'Unknown state'
        const clusterCity = cluster.city || 'Unknown city'

        if (countryFilter !== 'All' && clusterCountry !== countryFilter) {
          return false
        }
        if (stateFilter !== 'All' && clusterState !== stateFilter) {
          return false
        }
        if (cityFilter !== 'All' && clusterCity !== cityFilter) {
          return false
        }

        return true
      }),
    [cityClusters, cityFilter, countryFilter, stateFilter]
  )

  const filteredStateById = useMemo(
    () => new Map(filteredStateClusters.map((item) => [item.id, item])),
    [filteredStateClusters]
  )
  const filteredCityById = useMemo(
    () => new Map(filteredCityClusters.map((item) => [item.id, item])),
    [filteredCityClusters]
  )

  const viewLevel = mapZoom >= 10 ? 'zip' : mapZoom >= 6 ? 'city' : 'state'

  const selectedState = useMemo(() => {
    if (selectedMapClusterId.startsWith('state:')) {
      return filteredStateById.get(selectedMapClusterId) ?? filteredStateClusters[0] ?? null
    }

    if (selectedMapClusterId.startsWith('city:')) {
      const city = filteredCityById.get(selectedMapClusterId)
      return (city ? filteredStateById.get(city.stateId) : null) ?? filteredStateClusters[0] ?? null
    }

    return filteredStateClusters[0] ?? null
  }, [filteredCityById, filteredStateById, selectedMapClusterId, filteredStateClusters])

  const selectedCity = useMemo(() => {
    if (selectedMapClusterId.startsWith('city:')) {
      return filteredCityById.get(selectedMapClusterId) ?? null
    }

    if (!selectedState) {
      return null
    }

    return filteredCityClusters.find((city) => city.stateId === selectedState.id) ?? filteredCityClusters[0] ?? null
  }, [filteredCityById, filteredCityClusters, selectedMapClusterId, selectedState])

  useEffect(() => {
    const candidates = viewLevel === 'state' ? filteredStateClusters : filteredCityClusters
    if (candidates.length === 0) {
      if (selectedMapClusterId !== '') {
        setSelectedMapClusterId('')
      }
      return
    }

    const selectedIsValid =
      viewLevel === 'state' ? filteredStateById.has(selectedMapClusterId) : filteredCityById.has(selectedMapClusterId)

    if (!selectedIsValid) {
      setSelectedMapClusterId(candidates[0].id)
    }
  }, [
    filteredCityById,
    filteredCityClusters,
    filteredStateById,
    filteredStateClusters,
    selectedMapClusterId,
    setSelectedMapClusterId,
    viewLevel,
  ])

  const [selectedZipPointId, setSelectedZipPointId] = useState('')

  useEffect(() => {
    if (viewLevel !== 'zip' || !selectedCity) {
      setSelectedZipPointId('')
      return
    }

    setSelectedZipPointId((current) =>
      current && selectedCity.zipPoints.some((zipPoint) => zipPoint.id === current)
        ? current
        : selectedCity.zipPoints[0]?.id ?? ''
    )
  }, [selectedCity, viewLevel])

  const selectedZipPoint = selectedCity?.zipPoints.find((zipPoint) => zipPoint.id === selectedZipPointId) ?? null

  const mapCenter =
    viewLevel === 'zip' && selectedZipPoint
      ? ([selectedZipPoint.latitude, selectedZipPoint.longitude] as [number, number])
      : viewLevel !== 'state' && selectedCity
        ? ([selectedCity.latitude, selectedCity.longitude] as [number, number])
        : selectedState
          ? ([selectedState.latitude, selectedState.longitude] as [number, number])
          : ([39.8283, -98.5795] as [number, number])

  const browseItems =
    viewLevel === 'state'
      ? filteredStateClusters.map((stateCluster) => ({
          id: stateCluster.id,
          label: stateCluster.label,
          count: stateCluster.count,
          active: selectedState?.id === stateCluster.id,
        }))
      : filteredCityClusters.map((cityCluster) => ({
          id: cityCluster.id,
          label: cityCluster.label,
          count: cityCluster.count,
          active: selectedCity?.id === cityCluster.id,
        }))

  const selectedScopeMembers =
    viewLevel === 'state' ? selectedState?.members ?? [] : selectedCity?.members ?? []

  return (
    <section className="workspace-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Where Our Family Lives</p>
          <h2>Family location map</h2>
          <p className="panel-copy">
            Start at the state level, zoom in to city level, and use ZIP markers to estimate where members are
            within the selected city.
          </p>
        </div>
      </div>
      {mapError ? (
        <div className="error-callout" role="alert">
          <strong>Map error</strong>
          <p>{mapError}</p>
        </div>
      ) : null}
      <div className="map-layout">
        <aside className="card map-filters">
          <p className="eyebrow">Location Groups</p>
          <div className="map-filter-grid">
            <label>
              Country
              <select
                className="text-input"
                onChange={(event) => {
                  setCountryFilter(event.target.value)
                  setSelectedZipPointId('')
                }}
                value={countryFilter}
              >
                {countryOptions.map((option) => (
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
                onChange={(event) => {
                  setStateFilter(event.target.value)
                  setSelectedZipPointId('')
                }}
                value={stateFilter}
              >
                {stateOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              City
              <select
                className="text-input"
                onChange={(event) => {
                  setCityFilter(event.target.value)
                  setSelectedZipPointId('')
                }}
                value={cityFilter}
              >
                {cityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="status-callout">
            <strong>Coverage</strong>
            <p>
              {mapMode === 'loading'
                ? 'Loading locations...'
                : `${filteredStateClusters.length} mapped state${filteredStateClusters.length === 1 ? '' : 's'}`}
            </p>
            <p>View level: {viewLevel === 'state' ? 'State' : viewLevel === 'city' ? 'City' : 'City + ZIP'}</p>
          </div>
          {browseItems.length > 0 ? (
            <div className="path-match-list">
              {browseItems.map((item) => (
                <button
                  className={`path-match-item ${item.active ? 'path-match-item-active' : ''}`}
                  key={item.id}
                  onClick={() => setSelectedMapClusterId(item.id)}
                  type="button"
                >
                  <span className="avatar-badge">{item.count}</span>
                  <span>
                    <strong>{item.label || 'Unknown location'}</strong>
                    <small>
                      {item.count} family member{item.count === 1 ? '' : 's'}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted-text">
              No locations found yet. Add city, state, or zip to profiles to populate the map.
            </p>
          )}
        </aside>
        <div className="card map-canvas">
          {filteredStateClusters.length > 0 ? (
            <MapContainer
              center={mapCenter}
              className="family-map"
              key={`${viewLevel}-${selectedMapClusterId || 'map'}`}
              scrollWheelZoom
              zoom={viewLevel === 'zip' ? 10 : viewLevel === 'city' ? 7 : 5}
            >
              <ZoomTracker onZoomChange={setMapZoom} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {viewLevel === 'state'
                ? filteredStateClusters.map((stateCluster) => (
                    <CircleMarker
                      center={[stateCluster.latitude, stateCluster.longitude]}
                      eventHandlers={{
                        click: () => setSelectedMapClusterId(stateCluster.id),
                      }}
                      key={stateCluster.id}
                      pathOptions={{
                        color: selectedState?.id === stateCluster.id ? '#f4b942' : '#2fb8a3',
                        fillColor: selectedState?.id === stateCluster.id ? '#f4b942' : '#2fb8a3',
                        fillOpacity: 0.65,
                        weight: 2,
                      }}
                      radius={Math.min(26, 9 + stateCluster.count * 1.2)}
                    >
                      <Popup>
                        <strong>{stateCluster.label}</strong>
                        <br />
                        {stateCluster.count} family member{stateCluster.count === 1 ? '' : 's'}
                      </Popup>
                    </CircleMarker>
                  ))
                : cityClusters
                    .map((cityCluster) => (
                      <CircleMarker
                        center={[cityCluster.latitude, cityCluster.longitude]}
                        eventHandlers={{
                          click: () => setSelectedMapClusterId(cityCluster.id),
                        }}
                        key={cityCluster.id}
                        pathOptions={{
                          color: selectedCity?.id === cityCluster.id ? '#f4b942' : '#2fb8a3',
                          fillColor: selectedCity?.id === cityCluster.id ? '#f4b942' : '#2fb8a3',
                          fillOpacity: 0.65,
                          weight: 2,
                        }}
                        radius={Math.min(22, 8 + cityCluster.count)}
                      >
                        <Popup>
                          <strong>{cityCluster.label}</strong>
                          <br />
                          {cityCluster.count} family member{cityCluster.count === 1 ? '' : 's'}
                        </Popup>
                      </CircleMarker>
                    ))}

              {viewLevel === 'zip' && selectedCity
                ? selectedCity.zipPoints.map((zipPoint) => (
                    <CircleMarker
                      center={[zipPoint.latitude, zipPoint.longitude]}
                      eventHandlers={{
                        click: () => setSelectedZipPointId(zipPoint.id),
                      }}
                      key={zipPoint.id}
                      pathOptions={{
                        color: selectedZipPoint?.id === zipPoint.id ? '#1d4ed8' : '#64748b',
                        fillColor: selectedZipPoint?.id === zipPoint.id ? '#1d4ed8' : '#94a3b8',
                        fillOpacity: 0.45,
                        weight: 1.5,
                      }}
                      radius={Math.min(16, 6 + zipPoint.count)}
                    >
                      <Popup>
                        <strong>{zipPoint.label}</strong>
                        <br />
                        {zipPoint.count} family member{zipPoint.count === 1 ? '' : 's'}
                      </Popup>
                    </CircleMarker>
                  ))
                : null}
            </MapContainer>
          ) : (
            <div className="map-art">
              <div className="map-pin">
                <strong>Locations unlock here</strong>
                <span>Profiles with city/state/zip become map clusters.</span>
              </div>
              <div className="map-pin">
                <strong>Clustered by place</strong>
                <span>Relatives in the same area share one marker.</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="card">
          <p className="eyebrow">
            {viewLevel === 'state'
              ? 'Members in selected state'
              : viewLevel === 'city'
                ? 'Members in selected city'
                : 'Members in selected city (ZIP markers shown on map)'}
          </p>
          {viewLevel === 'state' && selectedState ? <h3>{selectedState.label}</h3> : null}
          {viewLevel !== 'state' && selectedCity ? <h3>{selectedCity.label}</h3> : null}
          {selectedScopeMembers.length > 0 ? (
            <ul className="stack-list">
              {selectedScopeMembers.map((member) => (
                <li className="banner-actions" key={member.id}>
                  <button className="ghost-button inline-button" onClick={() => onOpenProfile(member.id)} type="button">
                    {member.name}
                  </button>
                  <button
                    className="secondary-button inline-button"
                    disabled={member.id === currentPersonId}
                    onClick={() => onOpenDirectMessage(member.id)}
                    type="button"
                  >
                    Message
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-text">Select a marker to inspect members in that area.</p>
          )}
        </div>
        <div className="card">
          <p className="eyebrow">Map Notes</p>
          <ul className="stack-list">
            <li>State markers appear first for a high-level view.</li>
            <li>Use country, state, and city filters to narrow the map and member list.</li>
            <li>Zoom in to automatically switch to city markers.</li>
            <li>At higher zoom, ZIP markers show estimated intra-city member distribution.</li>
            <li>ZIP markers are visual guides and do not split the member list.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
