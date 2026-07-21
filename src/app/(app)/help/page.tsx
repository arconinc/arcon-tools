import Link from 'next/link'

const quickStartItems = [
  {
    title: 'Start at the dashboard',
    body: 'Review company announcements, the banner strip, My Tasks, news, and the company calendar before jumping into department work.',
    href: '/dashboard',
    action: 'Open dashboard',
  },
  {
    title: 'Update your profile',
    body: 'Add a photo, phone number, timezone, short bio, skills, and interests so coworkers can find the right person faster.',
    href: '/profile',
    action: 'Edit profile',
  },
  {
    title: 'Check your tasks',
    body: 'Use My Tasks as your daily work list. Filter by priority, due date, department, delegated work, and completed status.',
    href: '/my-tasks',
    action: 'View my tasks',
  },
]

const workflowItems = [
  {
    label: 'Find something',
    title: 'Use the top search bar first',
    body: 'Search the site for customers, suppliers, contacts, and documents. It is usually faster than opening a section and browsing manually.',
  },
  {
    label: 'Need action',
    title: 'Create or update a task',
    body: 'If someone inside Arcon needs to do something, put it in a task. Tasks keep the owner, status, priority, due date, comments, attachments, and history together.',
  },
  {
    label: 'Need attention',
    title: 'Watch notifications',
    body: 'Notifications point you back to assignments, task comments, approvals, PTO updates, expense reports, and Aturian queue activity.',
  },
  {
    label: 'Need a reference',
    title: 'Use documents by department',
    body: 'Documents are organized by business area. HR, Accounting, Sales, Marketing, E-Commerce, Warehouse, and Technology can each keep their reference material in one place.',
  },
]

const taskBenefits = [
  'One clear owner instead of a buried email thread',
  'Status, priority, and due date are visible without asking for an update',
  'Comments, attachments, links, and history stay attached to the work',
  'Delegated work can be tracked without forwarding messages',
  'Notifications bring people back when something changes',
  'Completed work becomes searchable history instead of inbox clutter',
]

const tutorials = [
  {
    title: 'Add The Arc as your Chrome home page',
    steps: [
      'Open Chrome settings.',
      'Go to On startup.',
      'Choose Open a specific page or set of pages.',
      'Add https://thearc.arconinc.com.',
      'Restart Chrome and confirm The Arc opens first.',
    ],
  },
  {
    title: 'Create a useful task',
    steps: [
      'Open My Tasks or a department task board.',
      'Select New Task.',
      'Write a clear action title, not just a topic.',
      'Assign the owner, department, category, priority, and due date.',
      'Add comments or attachments so the owner has enough context to begin.',
    ],
  },
  {
    title: 'Submit an expense report',
    steps: [
      'Open Expense Reports under Accounting.',
      'Create the report for the correct month.',
      'Add each expense with date, vendor, category, description, and amount.',
      'Attach receipt photos or PDFs.',
      'Submit for review and watch notifications for changes or approval.',
    ],
  },
]

function HelpIcon({ type }: { type: 'search' | 'task' | 'bell' | 'doc' | 'profile' | 'request' }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  if (type === 'search') return <svg {...props}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
  if (type === 'task') return <svg {...props}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
  if (type === 'bell') return <svg {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
  if (type === 'doc') return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h8" /></svg>
  if (type === 'profile') return <svg {...props}><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
  return <svg {...props}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
}

export default function HelpPage() {
  return (
    <>
      <style>{`
        .help-page { max-width: 1180px; margin: 0 auto; padding: 28px 24px 44px; color: #111111; }
        .help-hero { display: grid; grid-template-columns: minmax(0, 1.25fr) 360px; gap: 24px; align-items: stretch; margin-bottom: 24px; }
        .help-hero-main { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 28px; }
        .help-kicker { margin: 0 0 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #6b1e98; }
        .help-title { margin: 0; font-size: 28px; line-height: 1.15; font-weight: 800; color: #111111; text-wrap: balance; }
        .help-lede { margin: 14px 0 0; max-width: 72ch; font-size: 15px; line-height: 1.65; color: #374151; }
        .help-promise { background: #111111; border-radius: 10px; padding: 24px; color: #ffffff; display: flex; flex-direction: column; justify-content: space-between; min-height: 220px; }
        .help-promise h2 { margin: 0 0 10px; font-size: 18px; line-height: 1.3; font-weight: 800; }
        .help-promise p { margin: 0; color: #e5e7eb; font-size: 14px; line-height: 1.55; }
        .help-promise strong { color: #c084fc; }
        .help-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 24px; }
        .help-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px; display: flex; flex-direction: column; min-height: 190px; }
        .help-card h2 { margin: 0 0 8px; font-size: 16px; font-weight: 800; color: #111111; }
        .help-card p { margin: 0; font-size: 13px; line-height: 1.55; color: #4b5563; }
        .help-card a, .help-link { margin-top: auto; display: inline-flex; align-items: center; gap: 6px; color: #6b1e98; font-size: 13px; font-weight: 800; text-decoration: none; }
        .help-card a:hover, .help-link:hover { text-decoration: underline; }
        .help-section { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 22px; margin-bottom: 24px; }
        .help-section-header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 18px; }
        .help-section h2 { margin: 0; font-size: 19px; font-weight: 800; color: #111111; }
        .help-section-desc { margin: 5px 0 0; max-width: 70ch; font-size: 13px; line-height: 1.55; color: #6b7280; }
        .help-workflow { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .help-workflow-item { border: 1px solid #f3e8ff; background: #faf5ff; border-radius: 8px; padding: 16px; display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 12px; }
        .help-icon { width: 42px; height: 42px; border-radius: 999px; background: #f3e8ff; color: #6b1e98; display: flex; align-items: center; justify-content: center; border: 1px solid #e9d5ff; }
        .help-workflow-item h3 { margin: 0 0 5px; font-size: 14px; font-weight: 800; color: #111111; }
        .help-workflow-item p { margin: 0; font-size: 13px; line-height: 1.5; color: #4b5563; }
        .help-label { margin: 0 0 4px; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7e22ce; }
        .help-benefits { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; margin: 0; padding: 0; list-style: none; }
        .help-benefits li { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; line-height: 1.45; color: #374151; }
        .help-benefits li::before { content: ''; width: 8px; height: 8px; margin-top: 6px; border-radius: 999px; background: #6b1e98; flex: 0 0 auto; }
        .help-tutorials { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .help-tutorial { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: #ffffff; }
        .help-tutorial h3 { margin: 0 0 12px; font-size: 14px; font-weight: 800; color: #111111; }
        .help-tutorial ol { margin: 0; padding-left: 18px; color: #374151; }
        .help-tutorial li { margin-bottom: 8px; font-size: 13px; line-height: 1.45; }
        .help-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .help-action { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: #f8fafc; }
        .help-action h3 { margin: 0 0 7px; font-size: 14px; font-weight: 800; color: #111111; }
        .help-action p { margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: #4b5563; }
        @media (max-width: 1023px) {
          .help-hero { grid-template-columns: 1fr; }
          .help-grid, .help-tutorials, .help-actions { grid-template-columns: 1fr; }
          .help-workflow, .help-benefits { grid-template-columns: 1fr; }
        }
        @media (max-width: 639px) {
          .help-page { padding: 18px 14px 32px; }
          .help-hero-main, .help-promise, .help-section { padding: 18px; }
          .help-title { font-size: 24px; }
          .help-section-header { flex-direction: column; }
          .help-workflow-item { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="help-page">
        <section className="help-hero" aria-labelledby="help-title">
          <div className="help-hero-main">
            <p className="help-kicker">Welcome to The Arc</p>
            <h1 id="help-title" className="help-title">Your starting point for work at Arcon</h1>
            <p className="help-lede">
              The Arc is the company hub for tasks, documents, requests, announcements, people, and shared reference information. It should make work easier to find, easier to hand off, and easier to finish.
            </p>
          </div>
          <aside className="help-promise" aria-label="Launch guidance">
            <div>
              <h2>Use the site when work needs a shared home.</h2>
              <p>
                Email still has a place, but internal work belongs where the owner, status, next step, and history are visible.
              </p>
            </div>
            <p><strong>Rule of thumb:</strong> if you need someone at Arcon to do something, make it a task.</p>
          </aside>
        </section>

        <section className="help-grid" aria-label="Quick start">
          {quickStartItems.map((item) => (
            <article className="help-card" key={item.title}>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              <Link href={item.href}>{item.action}</Link>
            </article>
          ))}
        </section>

        <section className="help-section" aria-labelledby="daily-loop-title">
          <div className="help-section-header">
            <div>
              <h2 id="daily-loop-title">A normal day in The Arc</h2>
              <p className="help-section-desc">Use this flow before opening separate tools or asking around for information.</p>
            </div>
          </div>
          <div className="help-workflow">
            {workflowItems.map((item, index) => (
              <article className="help-workflow-item" key={item.title}>
                <div className="help-icon">
                  <HelpIcon type={index === 0 ? 'search' : index === 1 ? 'task' : index === 2 ? 'bell' : 'doc'} />
                </div>
                <div>
                  <p className="help-label">{item.label}</p>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="help-section" aria-labelledby="tasks-title">
          <div className="help-section-header">
            <div>
              <h2 id="tasks-title">Why tasks matter more than internal email</h2>
              <p className="help-section-desc">Tasks are how Arcon turns requests into accountable work instead of scattered follow-up threads.</p>
            </div>
            <Link className="help-link" href="/my-tasks">Open My Tasks</Link>
          </div>
          <ul className="help-benefits">
            {taskBenefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
          </ul>
        </section>

        <section className="help-section" aria-labelledby="tutorials-title">
          <div className="help-section-header">
            <div>
              <h2 id="tutorials-title">Launch tutorials</h2>
              <p className="help-section-desc">These are the onboarding actions every employee should understand before launch week.</p>
            </div>
          </div>
          <div className="help-tutorials">
            {tutorials.map((tutorial) => (
              <article className="help-tutorial" key={tutorial.title}>
                <h3>{tutorial.title}</h3>
                <ol>
                  {tutorial.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </article>
            ))}
          </div>
        </section>

        <section className="help-section" aria-labelledby="requests-title">
          <div className="help-section-header">
            <div>
              <h2 id="requests-title">Common requests and support</h2>
              <p className="help-section-desc">Use the right path so requests reach the people who can act on them.</p>
            </div>
          </div>
          <div className="help-actions">
            <article className="help-action">
              <div className="help-icon"><HelpIcon type="request" /></div>
              <h3>Request access</h3>
              <p>Use this when a page says you need another role or permission.</p>
              <Link className="help-link" href="/access-requests/new">Request access</Link>
            </article>
            <article className="help-action">
              <div className="help-icon"><HelpIcon type="task" /></div>
              <h3>Report an app defect</h3>
              <p>Create a Technology task with what happened, what you expected, and a screenshot when possible.</p>
              <Link className="help-link" href="/it/tasks">Open Technology Tasks</Link>
            </article>
            <article className="help-action">
              <div className="help-icon"><HelpIcon type="profile" /></div>
              <h3>Explore company info</h3>
              <p>Use the directory and documents sections to find coworkers, HR material, and department reference files.</p>
              <Link className="help-link" href="/employees">Open directory</Link>
            </article>
          </div>
        </section>
      </div>
    </>
  )
}
