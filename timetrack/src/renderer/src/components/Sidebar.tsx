import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '⌂', end: true },
  { to: '/projects', label: 'Projects', icon: '▤', end: false },
  { to: '/reports', label: 'Reports', icon: '▦', end: false },
  { to: '/history', label: 'History', icon: '🕐', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙', end: false }
]

export function Sidebar(): JSX.Element {
  return (
    <nav className="flex h-full w-56 flex-col gap-1 border-r border-slate-200 bg-slate-50/70 px-3 py-4 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="mb-4 flex items-center gap-2 px-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-600 text-sm font-bold text-white">
          T
        </div>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">TimeTrack</span>
      </div>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800'
            }`
          }
        >
          <span aria-hidden className="text-base leading-none">
            {item.icon}
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
