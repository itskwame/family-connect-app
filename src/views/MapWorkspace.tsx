import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

type FamilyMapCluster = {
  id: string
  label: string
  count: number
  peopleNames: string[]
  latitude: number
  longitude: number
}

type Props = {
  mapMode: 'idle' | 'loading'
  mapError: string
  familyMapClusters: FamilyMapCluster[]
  selectedMapClusterId: string
  setSelectedMapClusterId: (value: string) => void
}

export default function MapWorkspace({
  mapMode,
  mapError,
  familyMapClusters,
  selectedMapClusterId,
  setSelectedMapClusterId,
}: Props) {
  const selectedMapCluster =
    familyMapClusters.find((cluster) => cluster.id === selectedMapClusterId) ?? familyMapClusters[0] ?? null

  const mapCenter = selectedMapCluster
    ? ([selectedMapCluster.latitude, selectedMapCluster.longitude] as [number, number])
    : ([39.8283, -98.5795] as [number, number])

  return (
    <section className="workspace-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Where Our Family Lives</p>
          <h2>Family location map</h2>
          <p className="panel-copy">
            Family members are grouped into shared location clusters and rendered on a live Leaflet map.
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
          <p className="eyebrow">Location Clusters</p>
          <div className="status-callout">
            <strong>Coverage</strong>
            <p>
              {mapMode === 'loading'
                ? 'Loading locations...'
                : `${familyMapClusters.length} mapped location${familyMapClusters.length === 1 ? '' : 's'}`}
            </p>
          </div>
          {familyMapClusters.length > 0 ? (
            <div className="path-match-list">
              {familyMapClusters.map((cluster) => (
                <button
                  className={`path-match-item ${
                    selectedMapCluster?.id === cluster.id ? 'path-match-item-active' : ''
                  }`}
                  key={cluster.id}
                  onClick={() => setSelectedMapClusterId(cluster.id)}
                  type="button"
                >
                  <span className="avatar-badge">{cluster.count}</span>
                  <span>
                    <strong>{cluster.label || 'Unknown location'}</strong>
                    <small>
                      {cluster.count} family member{cluster.count === 1 ? '' : 's'}
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
          {familyMapClusters.length > 0 ? (
            <MapContainer
              center={mapCenter}
              className="family-map"
              key={selectedMapCluster?.id ?? 'family-map'}
              scrollWheelZoom={false}
              zoom={selectedMapCluster && selectedMapCluster.count > 4 ? 4 : 5}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {familyMapClusters.map((cluster) => (
                <CircleMarker
                  center={[cluster.latitude, cluster.longitude]}
                  eventHandlers={{
                    click: () => setSelectedMapClusterId(cluster.id),
                  }}
                  key={cluster.id}
                  pathOptions={{
                    color: selectedMapCluster?.id === cluster.id ? '#f4b942' : '#2fb8a3',
                    fillColor: selectedMapCluster?.id === cluster.id ? '#f4b942' : '#2fb8a3',
                    fillOpacity: 0.65,
                    weight: 2,
                  }}
                  radius={Math.min(24, 8 + cluster.count * 2)}
                >
                  <Popup>
                    <strong>{cluster.label || 'Unknown location'}</strong>
                    <br />
                    {cluster.count} family member{cluster.count === 1 ? '' : 's'}
                  </Popup>
                </CircleMarker>
              ))}
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
          <p className="eyebrow">Selected Cluster</p>
          {selectedMapCluster ? (
            <>
              <h3>{selectedMapCluster.label || 'Unknown location'}</h3>
              <p className="muted-text">
                {selectedMapCluster.count} family member
                {selectedMapCluster.count === 1 ? '' : 's'} in this cluster
              </p>
              <ul className="stack-list">
                {selectedMapCluster.peopleNames.map((name) => (
                  <li key={`${selectedMapCluster.id}-${name}`}>{name}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted-text">Select a map cluster to view the members grouped there.</p>
          )}
        </div>
        <div className="card">
          <p className="eyebrow">Map Notes</p>
          <ul className="stack-list">
            <li>Clusters group members by shared city, state, and zip when available.</li>
            <li>Marker size increases with the number of relatives in that location.</li>
            <li>Click any marker to inspect the grouped family members.</li>
            <li>MVP coordinates are estimated from saved location fields to avoid requiring paid geocoding.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
