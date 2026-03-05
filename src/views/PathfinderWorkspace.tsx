import { useMemo } from 'react'

type TreePersonItem = {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
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

type Props = {
  pathfinderError: string
  treePeople: TreePersonItem[]
  currentPersonId: string
  pathfinderPersonAId: string
  setPathfinderPersonAId: (value: string) => void
  pathfinderPersonBId: string
  setPathfinderPersonBId: (value: string) => void
  pathfinderPersonBQuery: string
  setPathfinderPersonBQuery: (value: string) => void
  pathfinderMode: 'idle' | 'searching'
  pathfinderSearchResults: TreePersonItem[]
  pathfinderResult: PathfinderResult | null
  onRunPathfinder: () => void
  onHighlightPathInTree: () => void
  clearPathfinderResult: () => void
}

export default function PathfinderWorkspace({
  pathfinderError,
  treePeople,
  currentPersonId,
  pathfinderPersonAId,
  setPathfinderPersonAId,
  pathfinderPersonBId,
  setPathfinderPersonBId,
  pathfinderPersonBQuery,
  setPathfinderPersonBQuery,
  pathfinderMode,
  pathfinderSearchResults,
  pathfinderResult,
  onRunPathfinder,
  onHighlightPathInTree,
  clearPathfinderResult,
}: Props) {
  const treePeopleLookup = useMemo(
    () => new Map(treePeople.map((person) => [person.id, person])),
    [treePeople]
  )
  const personBOptions = useMemo(
    () =>
      treePeople
        .filter((person) => person.id !== pathfinderPersonAId)
        .sort((left, right) =>
          `${left.first_name} ${left.last_name}`.trim().localeCompare(`${right.first_name} ${right.last_name}`.trim())
        ),
    [pathfinderPersonAId, treePeople]
  )

  return (
    <section className="workspace-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Pathfinder</p>
          <h2>How are we connected?</h2>
          <p className="panel-copy">
            Pick two people, find the shortest connection path, and send that exact route into the
            tree view.
          </p>
        </div>
      </div>
      {pathfinderError ? (
        <div className="error-callout" role="alert">
          <strong>Pathfinder</strong>
          <p>{pathfinderError}</p>
        </div>
      ) : null}
      <div className="pathfinder-layout">
        <div className="card form-card">
          <p className="eyebrow">Select People</p>
          <label>
            Person A
            <select
              className="text-input"
              onChange={(event) => {
                const nextValue = event.target.value
                setPathfinderPersonAId(nextValue)

                if (nextValue === pathfinderPersonBId) {
                  setPathfinderPersonBId('')
                  setPathfinderPersonBQuery('')
                }

                clearPathfinderResult()
              }}
              value={pathfinderPersonAId}
            >
              {treePeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.id === currentPersonId
                    ? `Me (${`${person.first_name} ${person.last_name}`.trim()})`
                    : `${person.first_name} ${person.last_name}`.trim()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Person B
            <select
              className="text-input"
              onChange={(event) => {
                const nextPersonId = event.target.value
                setPathfinderPersonBId(nextPersonId)
                const selectedPerson = treePeopleLookup.get(nextPersonId)
                setPathfinderPersonBQuery(
                  selectedPerson ? `${selectedPerson.first_name} ${selectedPerson.last_name}`.trim() : ''
                )
                clearPathfinderResult()
              }}
              value={pathfinderPersonBId}
            >
              <option value="">Select a family member</option>
              {personBOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {`${person.first_name} ${person.last_name}`.trim()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Optional name search
            <input
              className="text-input"
              onChange={(event) => {
                setPathfinderPersonBQuery(event.target.value)
                clearPathfinderResult()
              }}
              placeholder="Search by name"
              type="text"
              value={pathfinderPersonBQuery}
            />
          </label>
          <div className="path-match-list">
            {pathfinderMode === 'searching' && pathfinderSearchResults.length === 0 ? (
              <p className="muted-text">Searching family members...</p>
            ) : null}
            {pathfinderSearchResults.map((person) => (
              <button
                className={`path-match-item ${
                  pathfinderPersonBId === person.id ? 'path-match-item-active' : ''
                }`}
                key={person.id}
                onClick={() => {
                  setPathfinderPersonBId(person.id)
                  setPathfinderPersonBQuery(`${person.first_name} ${person.last_name}`.trim())
                  clearPathfinderResult()
                }}
                type="button"
              >
                <span className="avatar-badge">{person.first_name.slice(0, 1).toUpperCase()}</span>
                <span>
                  <strong>{`${person.first_name} ${person.last_name}`.trim()}</strong>
                  <small>
                    {person.birth_date ? new Date(person.birth_date).getFullYear() : 'Year unknown'}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <button className="primary-button wide-button" onClick={onRunPathfinder} type="button">
            Show Connection
          </button>
        </div>
        <div className="card">
          <p className="eyebrow">Connection Result</p>
          {pathfinderResult ? (
            <div className="pathfinder-result-stack">
              <div className="pathfinder-result-summary">{pathfinderResult.summary}</div>
              <ol className="path-step-list">
                {pathfinderResult.pathPersonIds.map((personId, index) => {
                  const person = treePeopleLookup.get(personId)
                  const personName = person
                    ? `${person.first_name} ${person.last_name}`.trim()
                    : 'Unknown person'
                  const nextStep = pathfinderResult.steps[index]

                  return (
                    <li key={`${personId}-${index}`}>
                      <strong>{personName}</strong>
                      {nextStep ? <span>{` -> ${nextStep.relationLabel}`}</span> : null}
                    </li>
                  )
                })}
              </ol>
              <div className="banner-actions">
                <button className="secondary-button" onClick={onHighlightPathInTree} type="button">
                  Highlight in Tree
                </button>
                <button className="secondary-button" onClick={onHighlightPathInTree} type="button">
                  Open in Tree
                </button>
              </div>
            </div>
          ) : (
            <p className="muted-text">Select Person B to continue.</p>
          )}
        </div>
      </div>
    </section>
  )
}
