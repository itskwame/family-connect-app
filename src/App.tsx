import { useState } from 'react'
import './App.css'

type ViewKey =
  | 'home'
  | 'tree'
  | 'pathfinder'
  | 'businesses'
  | 'map'
  | 'messages'
  | 'profile'
  | 'export'

type NavItem = {
  key: ViewKey
  label: string
}

const navItems: NavItem[] = [
  { key: 'home', label: 'Home' },
  { key: 'tree', label: 'Tree' },
  { key: 'pathfinder', label: 'Pathfinder' },
  { key: 'businesses', label: 'Businesses' },
  { key: 'map', label: 'Map' },
  { key: 'messages', label: 'Messages' },
  { key: 'profile', label: 'Profile' },
  { key: 'export', label: 'Export' },
]

const features = [
  {
    title: 'Interactive Tree',
    description:
      'A zoomable family graph centered on any person, with clean hierarchy and guided relationship editing.',
  },
  {
    title: 'How Are We Connected',
    description:
      'Select two people and reveal the exact relationship path with focused highlighting.',
  },
  {
    title: 'Profiles + Memories',
    description:
      'Give every family member a living profile with milestones, photos, media, and context.',
  },
  {
    title: 'Messaging',
    description:
      'Keep conversations in one private family space with direct chats, groups, and a family-wide channel.',
  },
  {
    title: 'Family Businesses',
    description:
      'Surface businesses directly from profile data so families can support one another.',
  },
  {
    title: 'Where Our Family Lives',
    description:
      'See where everyone lives with a privacy-aware, clustered map and list view.',
  },
]

const testimonials = [
  {
    quote:
      'FamilyConnect gave us one place for relatives, birthdays, and reunion planning without the chaos.',
    author: 'Michelle J., Atlanta',
  },
  {
    quote:
      'My parents could use it on their phones without calling me for help. That mattered.',
    author: 'David R., Detroit',
  },
  {
    quote:
      'The connection finder answered questions our family argues about every holiday.',
    author: 'Tanya S., Houston',
  },
  {
    quote:
      'The business directory became the easiest way to remember who does what in the family.',
    author: 'Andre P., Chicago',
  },
  {
    quote:
      'It feels private, clean, and respectful. Nothing about it feels like noisy social media.',
    author: 'Renee K., Charlotte',
  },
  {
    quote:
      'Our family tree finally feels alive instead of stuck in a document nobody updates.',
    author: 'Samuel T., Newark',
  },
]

const faqItems = [
  'Is FamilyConnect private to one family?',
  'Can I invite people without paying for email or SMS tools?',
  'Can seniors use it on mobile?',
  'What if a profile already exists for me?',
  'Can I see how two cousins are connected?',
  'Can we store business details on a profile?',
  'Are children protected with consent controls?',
  'Can we export printable family trees?',
  'Can large families use it?',
  'Does it work on desktop and phones?',
]

const quickActions = [
  'View Tree',
  'Find Connection',
  'Invite Family',
  'Add Member',
  'Businesses',
  'Map',
]

const feedPosts = [
  {
    author: 'Alicia Johnson',
    timestamp: '2 hours ago',
    content:
      'Welcome to our new family space. Add your branch, upload a photo, and invite one relative today.',
  },
  {
    author: 'Marcus Lee',
    timestamp: 'Yesterday',
    content:
      'Reunion planning starts here. I posted a hotel block update and a few old photos from the 1998 trip.',
  },
]

const treeCards = [
  { name: 'You', years: '1988 - ', badge: 'ROOT' },
  { name: 'Elaine Carter', years: '1961 - ', badge: 'MOTHER' },
  { name: 'James Carter', years: '1959 - ', badge: 'FATHER' },
  { name: 'Doris Carter', years: '1938 - 2016', badge: 'ANCESTOR' },
]

const businesses = [
  {
    name: 'Carter Catering Co.',
    owner: 'Alicia Johnson',
    place: 'Atlanta, GA',
    category: 'Food & Events',
    description: 'Family-owned catering for reunions, weddings, and community events.',
  },
  {
    name: 'Northside Auto Care',
    owner: 'Marcus Lee',
    place: 'Detroit, MI',
    category: 'Automotive',
    description: 'Repairs, inspections, and fleet servicing with extended family discounts.',
  },
  {
    name: 'Bright Path Tax Help',
    owner: 'Nina Carter',
    place: 'Houston, TX',
    category: 'Professional Services',
    description: 'Tax preparation and bookkeeping for households and small businesses.',
  },
]

const conversations = [
  { name: 'Family Chat', preview: 'Cousin dinner plans are looking good.', unread: 3 },
  { name: 'Alicia Johnson', preview: 'I updated the reunion hotel link.', unread: 0 },
  { name: 'Photo Committee', preview: 'Upload deadline is Friday evening.', unread: 1 },
]

const messages = [
  { sender: 'other', text: 'Can you review the June reunion schedule?' },
  { sender: 'me', text: 'Yes. I also added the updated family branch list.' },
  { sender: 'other', text: 'Perfect. I will invite the missing cousins tonight.' },
]

const mapLocations = [
  { city: 'Atlanta', state: 'GA', count: 18 },
  { city: 'Detroit', state: 'MI', count: 11 },
  { city: 'Houston', state: 'TX', count: 14 },
  { city: 'Charlotte', state: 'NC', count: 9 },
]

const timelineEvents = [
  { year: '1988', label: 'Born in Newark, NJ' },
  { year: '2010', label: 'Graduated from Rutgers University' },
  { year: '2018', label: 'Started Carter Community Foundation' },
]

const pathSteps = [
  'You',
  'Mother',
  'Grandfather',
  'Grandfather’s Brother',
  'His Daughter',
  'Sarah',
]

function App() {
  const [activeView, setActiveView] = useState<ViewKey>('home')

  const renderWorkspace = () => {
    switch (activeView) {
      case 'home':
        return (
          <section className="workspace-panel workspace-home">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Family Hub</p>
                <h2>Private family center</h2>
                <p className="panel-copy">
                  A living home feed with clear next steps, recent activity, and fast access to the
                  most-used tools.
                </p>
              </div>
              <button className="primary-button">Invite Family</button>
            </div>
            <div className="quick-actions">
              {quickActions.map((action) => (
                <button className="action-tile" key={action}>
                  {action}
                </button>
              ))}
            </div>
            <div className="dashboard-grid">
              <div className="card highlight-card">
                <p className="eyebrow">Highlights</p>
                <ul className="stack-list">
                  <li>Upcoming birthdays: 5 in the next 30 days</li>
                  <li>New members this week: 3</li>
                  <li>Invite shares copied today: 12</li>
                </ul>
              </div>
              <div className="card">
                <p className="eyebrow">Recent Posts</p>
                <div className="feed-list">
                  {feedPosts.map((post) => (
                    <article className="feed-post" key={`${post.author}-${post.timestamp}`}>
                      <div className="avatar-badge">{post.author.slice(0, 1)}</div>
                      <div>
                        <div className="feed-meta">
                          <strong>{post.author}</strong>
                          <span>{post.timestamp}</span>
                        </div>
                        <p>{post.content}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )
      case 'tree':
        return (
          <section className="workspace-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Interactive Tree</p>
                <h2>Graph-first family layout</h2>
                <p className="panel-copy">
                  A PRD-aligned preview of the tree canvas, sticky filters, and a contextual side
                  panel for profile actions.
                </p>
              </div>
            </div>
            <div className="tree-toolbar">
              <div className="toolbar-pill">Viewing from: You</div>
              <div className="toolbar-pill">Branch: Both</div>
              <div className="toolbar-pill">Generations: Up 4 / Down 3</div>
              <div className="toolbar-pill">Search person</div>
            </div>
            <div className="tree-layout">
              <div className="tree-canvas">
                {treeCards.map((card) => (
                  <article className="tree-node" key={card.name}>
                    <div className="node-avatar">{card.name.slice(0, 1)}</div>
                    <strong>{card.name}</strong>
                    <span>{card.years}</span>
                    <em>{card.badge}</em>
                  </article>
                ))}
                <div className="tree-line tree-line-vertical" />
                <div className="tree-line tree-line-horizontal" />
              </div>
              <aside className="card side-panel">
                <p className="eyebrow">Selected Node</p>
                <h3>Elaine Carter</h3>
                <p>Mother, Atlanta, GA</p>
                <div className="side-actions">
                  <button className="secondary-button">View Profile</button>
                  <button className="secondary-button">Message</button>
                  <button className="secondary-button">Set as Root</button>
                  <button className="secondary-button">Add Relationship</button>
                </div>
              </aside>
            </div>
          </section>
        )
      case 'pathfinder':
        return (
          <section className="workspace-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Pathfinder</p>
                <h2>How are we connected?</h2>
                <p className="panel-copy">
                  Two-person selection, relationship summary, and the exact connection path.
                </p>
              </div>
              <button className="primary-button">Highlight in Tree</button>
            </div>
            <div className="dashboard-grid">
              <div className="card form-card">
                <label>
                  Person A
                  <div className="field-shell">Me</div>
                </label>
                <label>
                  Person B
                  <div className="field-shell">Sarah Carter</div>
                </label>
                <button className="primary-button wide-button">Show Connection</button>
              </div>
              <div className="card">
                <p className="eyebrow">Result</p>
                <h3>You are Sarah&apos;s 2nd cousin once removed.</h3>
                <ol className="path-list">
                  {pathSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        )
      case 'businesses':
        return (
          <section className="workspace-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Business Directory</p>
                <h2>Support family-owned businesses</h2>
                <p className="panel-copy">
                  Derived from profile data, with clear cards optimized for mobile and desktop.
                </p>
              </div>
            </div>
            <div className="filter-row">
              <div className="toolbar-pill">Search name or business</div>
              <div className="toolbar-pill">Category</div>
              <div className="toolbar-pill">State</div>
            </div>
            <div className="business-grid">
              {businesses.map((business) => (
                <article className="card business-card" key={business.name}>
                  <div className="business-logo">{business.name.slice(0, 1)}</div>
                  <p className="eyebrow">{business.category}</p>
                  <h3>{business.name}</h3>
                  <p className="muted-text">Owner: {business.owner}</p>
                  <p className="muted-text">{business.place}</p>
                  <p>{business.description}</p>
                  <button className="secondary-button">Visit Website</button>
                </article>
              ))}
            </div>
          </section>
        )
      case 'map':
        return (
          <section className="workspace-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Where Our Family Lives</p>
                <h2>Privacy-aware location view</h2>
                <p className="panel-copy">
                  The MVP uses aggregation by city and state rather than exact addresses.
                </p>
              </div>
            </div>
            <div className="map-layout">
              <div className="card map-filters">
                <p className="eyebrow">Filters</p>
                <div className="field-shell">Country</div>
                <div className="field-shell">State</div>
                <div className="field-shell">City</div>
                <button className="secondary-button wide-button">Switch to List View</button>
              </div>
              <div className="card map-canvas">
                <div className="map-art">
                  {mapLocations.map((location) => (
                    <div className="map-pin" key={`${location.city}-${location.state}`}>
                      <strong>{location.count}</strong>
                      <span>
                        {location.city}, {location.state}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )
      case 'messages':
        return (
          <section className="workspace-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Messaging</p>
                <h2>Realtime family conversations</h2>
                <p className="panel-copy">
                  Direct chats, groups, and a default family channel in a single responsive layout.
                </p>
              </div>
              <button className="primary-button">New Message</button>
            </div>
            <div className="chat-layout">
              <aside className="card conversation-list">
                {conversations.map((conversation) => (
                  <button className="conversation-item" key={conversation.name}>
                    <div className="avatar-badge">{conversation.name.slice(0, 1)}</div>
                    <div>
                      <strong>{conversation.name}</strong>
                      <p>{conversation.preview}</p>
                    </div>
                    {conversation.unread > 0 ? (
                      <span className="unread-pill">{conversation.unread}</span>
                    ) : null}
                  </button>
                ))}
              </aside>
              <div className="card chat-window">
                <div className="chat-header">Family Chat</div>
                <div className="message-list">
                  {messages.map((message) => (
                    <div
                      className={`message-bubble ${
                        message.sender === 'me' ? 'message-bubble-me' : 'message-bubble-other'
                      }`}
                      key={message.text}
                    >
                      {message.text}
                    </div>
                  ))}
                </div>
                <div className="chat-composer">
                  <div className="field-shell">Type a message</div>
                  <button className="primary-button">Send</button>
                </div>
              </div>
            </div>
          </section>
        )
      case 'profile':
        return (
          <section className="workspace-panel">
            <div className="profile-hero card">
              <div className="profile-avatar">A</div>
              <div>
                <p className="eyebrow">Profile</p>
                <h2>Alicia Johnson</h2>
                <p className="muted-text">Atlanta, GA • Age 38 • Contributor</p>
              </div>
              <button className="primary-button">Edit Profile</button>
            </div>
            <div className="dashboard-grid">
              <div className="card">
                <p className="eyebrow">Overview</p>
                <p>
                  Community organizer, reunion lead, and keeper of the family photo archive. This
                  panel reflects the PRD&apos;s bio, location, and quick-link requirements.
                </p>
                <div className="chip-row">
                  <span className="chip">View in Tree</span>
                  <span className="chip">Find Connection</span>
                  <span className="chip">Message</span>
                </div>
              </div>
              <div className="card">
                <p className="eyebrow">Timeline</p>
                <ul className="stack-list">
                  {timelineEvents.map((event) => (
                    <li key={event.year + event.label}>
                      <strong>{event.year}</strong> {event.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="dashboard-grid">
              <div className="card">
                <p className="eyebrow">Connections</p>
                <ul className="stack-list">
                  <li>Parents: Elaine Carter, James Carter</li>
                  <li>Spouse: Marcus Lee</li>
                  <li>Children: Jordan Lee, Maya Lee</li>
                  <li>Siblings: Nina Carter</li>
                </ul>
              </div>
              <div className="card">
                <p className="eyebrow">Business</p>
                <ul className="stack-list">
                  <li>Business name: Carter Catering Co.</li>
                  <li>Category: Food & Events</li>
                  <li>Website: https://cartercatering.example</li>
                  <li>Location: Atlanta, GA</li>
                </ul>
              </div>
            </div>
          </section>
        )
      case 'export':
        return (
          <section className="workspace-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Export / Print</p>
                <h2>Deterministic export preview</h2>
                <p className="panel-copy">
                  The MVP target is SVG-driven output for clean letter and poster formats.
                </p>
              </div>
            </div>
            <div className="dashboard-grid">
              <div className="card form-card">
                <label>
                  Root person
                  <div className="field-shell">Alicia Johnson</div>
                </label>
                <label>
                  Direction
                  <div className="field-shell">Both</div>
                </label>
                <label>
                  Detail level
                  <div className="field-shell">Standard</div>
                </label>
                <label>
                  Output size
                  <div className="field-shell">Letter 8.5 x 11</div>
                </label>
                <button className="primary-button wide-button">Download PDF</button>
              </div>
              <div className="card export-preview">
                <div className="export-sheet">
                  <div className="export-title">Family Tree Preview</div>
                  <div className="export-diagram">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <p className="muted-text">Poster recommended for very large trees if text would drop below 12px.</p>
              </div>
            </div>
          </section>
        )
      default:
        return null
    }
  }

  return (
    <div className="app-page">
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
        <button className="primary-button">Create Your Family Space</button>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">Private by default. Built for families.</p>
            <h1>Your Entire Family. Connected in One Private Space.</h1>
            <p className="hero-text">
              Build a living family tree, discover how you&apos;re related, message family
              members, and preserve your legacy without ads or noise.
            </p>
            <div className="hero-actions">
              <button className="primary-button">Create Your Family Space</button>
              <button className="secondary-button">Watch 60-second demo</button>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="orbital-card">
              <div className="signal-line" />
              <div className="signal-line signal-line-short" />
              <div className="hero-node hero-node-center">You</div>
              <div className="hero-node hero-node-top">Mother</div>
              <div className="hero-node hero-node-right">Cousin</div>
              <div className="hero-node hero-node-left">Aunt</div>
            </div>
          </div>
        </section>

        <section className="problem-strip">
          <h2>Big families shouldn&apos;t feel confusing.</h2>
          <div className="problem-grid">
            <div className="card">
              <p>Not sure how certain cousins are related?</p>
            </div>
            <div className="card">
              <p>Family photos and stories scattered everywhere?</p>
            </div>
            <div className="card">
              <p>Reunion planning stuck in group texts?</p>
            </div>
          </div>
          <p className="section-note">FamilyConnect turns your family into a living network.</p>
        </section>

        <section className="section-block" id="features">
          <div className="section-heading">
            <p className="eyebrow">Core Features</p>
            <h2>One ecosystem for relationships, memories, and communication</h2>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="card feature-card" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block" id="how-it-works">
          <div className="section-heading">
            <p className="eyebrow">How It Works</p>
            <h2>Simple enough for first-time users, structured enough for large families</h2>
          </div>
          <div className="steps-grid">
            <div className="card step-card">
              <span>01</span>
              <h3>Create account</h3>
              <p>Start a new private family space with email and password.</p>
            </div>
            <div className="card step-card">
              <span>02</span>
              <h3>Create or join</h3>
              <p>Set up your family or use an invite token to enter an existing one.</p>
            </div>
            <div className="card step-card">
              <span>03</span>
              <h3>Add yourself + parents</h3>
              <p>Seed the graph with identity fields and claim your existing profile if found.</p>
            </div>
            <div className="card step-card">
              <span>04</span>
              <h3>Invite relatives</h3>
              <p>Grow missing branches with shareable invite links and branch prompts.</p>
            </div>
          </div>
        </section>

        <section className="section-block privacy-block" id="privacy">
          <div className="section-heading">
            <p className="eyebrow">Privacy</p>
            <h2>Private by default. Family controlled.</h2>
          </div>
          <div className="privacy-grid">
            <div className="card">
              <h3>Family spaces</h3>
              <p>Every family stays isolated, with roles controlling read and write access.</p>
            </div>
            <div className="card">
              <h3>Consent options</h3>
              <p>Minor profiles can hide birth dates, exact location, and contact details.</p>
            </div>
            <div className="card">
              <h3>Clean editing rules</h3>
              <p>Admins control locked relationships while contributors handle day-to-day updates.</p>
            </div>
          </div>
        </section>

        <section className="section-block testimonial-block">
          <div className="section-heading">
            <p className="eyebrow">Testimonials</p>
            <h2>Placeholder proof points ready to be replaced with real family stories</h2>
          </div>
          <div className="testimonial-grid">
            {testimonials.map((testimonial) => (
              <article className="card quote-card" key={testimonial.author}>
                <p>&quot;{testimonial.quote}&quot;</p>
                <strong>{testimonial.author}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block" id="faq">
          <div className="section-heading">
            <p className="eyebrow">FAQ</p>
            <h2>Clear answers before onboarding starts</h2>
          </div>
          <div className="faq-list">
            {faqItems.map((question) => (
              <div className="card faq-item" key={question}>
                <strong>{question}</strong>
                <p>Designed for the MVP scope described in the PRD, with mobile and desktop support.</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-strip">
          <h2>Start your family space today.</h2>
          <button className="primary-button">Create Your Family Space</button>
        </section>

        <section className="workspace-showcase">
          <div className="section-heading">
            <p className="eyebrow">Authenticated App</p>
            <h2>Responsive MVP workspace scaffold</h2>
            <p className="section-note">
              This implementation establishes the product shell and page patterns from the PRD so
              the app can be expanded feature by feature.
            </p>
          </div>

          <div className="workspace-frame">
            <div className="workspace-topbar">
              <div className="workspace-brand">
                <div className="avatar-badge">F</div>
                <div>
                  <strong>Current family: Carter Family</strong>
                  <p>Global search, notifications, and profile menu ready for wiring.</p>
                </div>
              </div>
              <button className="secondary-button">Settings</button>
            </div>

            <div className="workspace-body">
              <nav className="workspace-nav" aria-label="App navigation">
                {navItems.map((item) => (
                  <button
                    className={`workspace-nav-item ${
                      activeView === item.key ? 'workspace-nav-item-active' : ''
                    }`}
                    key={item.key}
                    onClick={() => setActiveView(item.key)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
              <div className="workspace-content">{renderWorkspace()}</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
