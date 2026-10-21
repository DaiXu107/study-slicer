import { Link, NavLink, Outlet } from 'react-router-dom';
import { cx } from '../lib/utils';
import { BookIcon, LayersIcon, SettingsIcon, SunIcon } from './Icons';

const NAV = [
  { to: '/', label: '今日', icon: SunIcon, end: true },
  { to: '/projects', label: '项目', icon: LayersIcon, end: false },
  { to: '/library', label: '文献', icon: BookIcon, end: false },
  { to: '/settings', label: '设置', icon: SettingsIcon, end: false },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto w-full max-w-2xl px-5 pb-32 pt-6 sm:px-8 sm:pt-10">
        <header className="flex items-center justify-between">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-paper transition-transform group-active:scale-95">
              <LayersIcon className="h-[18px] w-[18px]" />
            </span>
            <span className="font-display text-[16px] tracking-wide text-ink">
              Study Slicer
            </span>
          </Link>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-moss" />
            数据只存本机
          </span>
        </header>

        <main className="pt-7">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="主导航"
        className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl border border-line bg-surface/85 px-2 py-2 shadow-lift backdrop-blur-md"
      >
        <div className="grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors',
                  isActive ? 'text-ink' : 'text-ink-faint hover:text-ink-soft'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cx(
                      'grid h-8 w-12 place-items-center rounded-2xl transition-colors',
                      isActive ? 'bg-accent-soft text-accent-deep' : 'text-inherit'
                    )}
                  >
                    <Icon className="h-[19px] w-[19px]" />
                  </span>
                  <span className="text-[11px] font-medium tracking-wide">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
