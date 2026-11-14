import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, getRolePortalPath, getRolePortalLabel } from '../context/AuthContext';
import {
  CalendarBlank,
  SignOut,
  Ticket,
  List,
  X
} from '@phosphor-icons/react';

export const Navbar: React.FC = () => {
  const { user, logout, getPrimaryPortalPath } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pathname = location.pathname;
  const userRoles = user?.roles?.map((r) => r.role) || [];
  const primaryRole = userRoles[0];
  const isAdmin = userRoles.includes('admin');
  const isAttendeeOnly = Boolean(user) && primaryRole === 'attendee';

  const isGateScanner = pathname.startsWith('/portal/scanner') && !isAdmin;
  const isOperationsRoute =
    pathname.startsWith('/portal/organiser') ||
    pathname.startsWith('/portal/admin') ||
    pathname.startsWith('/portal/supervisor') ||
    pathname.startsWith('/portal/auditor') ||
    (pathname.startsWith('/portal/scanner') && isAdmin);

  const getInitials = (name?: string) => {
    if (!name) return 'IU';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const closeMenu = () => {
    setMobileMenuOpen(false);
  };

  // ENVIRONMENT 1: DEDICATED GATE SCANNER (High-focus, operational, zero consumer clutter)
  if (isGateScanner) {
    return (
      <header className="bg-ink text-white border-b border-ink-light sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-3">
              <Link to="/portal/scanner" className="flex items-center gap-2.5">
                <img
                  src="/iconic-logo.png"
                  alt="Iconic Open University"
                  className="h-7 sm:h-8 w-auto object-contain"
                />
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-right">
                <span className="text-xs font-medium text-slate-300">
                  {user?.displayName || 'Operator'}
                </span>
              </div>

              <div className="h-4 w-px bg-ink-light" />

              <button
                onClick={logout}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-btn bg-ink-light hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
                title="Sign out of scanner terminal"
              >
                <SignOut size={16} weight="regular" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // ENVIRONMENT 2: OPERATIONS DESK (Dedicated to the single role assigned to this account)
  if (isOperationsRoute) {
    return (
      <header className="bg-ink text-white border-b border-ink-light sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand + Specific Role Console Title */}
            <div className="flex items-center gap-4">
              <Link to={getRolePortalPath(primaryRole)} className="flex items-center gap-3">
                <img
                  src="/iconic-logo.png"
                  alt="Iconic Open University"
                  className="h-8 w-auto object-contain"
                />
              </Link>

              {/* Operations Navigation */}
              <nav className="hidden lg:flex items-center gap-1 ml-2">
                {isAdmin && (
                  <>
                    <Link
                      to="/portal/admin"
                      className={`px-2.5 py-1.5 rounded-btn text-xs font-semibold transition ${pathname.startsWith('/portal/admin')
                        ? 'bg-ink-light text-white border border-slate-700'
                        : 'text-slate-400 hover:text-white hover:bg-ink-light/50'
                        }`}
                    >
                      Overview
                    </Link>
                    <Link
                      to="/portal/organiser"
                      className={`px-2.5 py-1.5 rounded-btn text-xs font-semibold transition ${pathname.startsWith('/portal/organiser')
                        ? 'bg-ink-light text-white border border-slate-700'
                        : 'text-slate-400 hover:text-white hover:bg-ink-light/50'
                        }`}
                    >
                      Events &amp; Analytics
                    </Link>
                    <Link
                      to="/portal/supervisor"
                      className={`px-2.5 py-1.5 rounded-btn text-xs font-semibold transition ${pathname.startsWith('/portal/supervisor')
                        ? 'bg-ink-light text-white border border-slate-700'
                        : 'text-slate-400 hover:text-white hover:bg-ink-light/50'
                        }`}
                    >
                      Gate Exceptions
                    </Link>
                    <Link
                      to="/portal/auditor"
                      className={`px-2.5 py-1.5 rounded-btn text-xs font-semibold transition ${pathname.startsWith('/portal/auditor')
                        ? 'bg-ink-light text-white border border-slate-700'
                        : 'text-slate-400 hover:text-white hover:bg-ink-light/50'
                        }`}
                    >
                      Audit Trail
                    </Link>
                    <Link
                      to="/portal/scanner"
                      className={`px-2.5 py-1.5 rounded-btn text-xs font-semibold transition ${pathname.startsWith('/portal/scanner')
                        ? 'bg-ink-light text-white border border-slate-700'
                        : 'text-slate-400 hover:text-white hover:bg-ink-light/50'
                        }`}
                    >
                      Gate Check-in
                    </Link>
                  </>
                )}
              </nav>
            </div>

            {/* Right: User Profile & Sign Out */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-ink-light border border-slate-700 flex items-center justify-center text-xs font-mono font-bold text-slate-200">
                  {getInitials(user?.displayName)}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold text-slate-200 leading-tight">
                    {user?.displayName}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 uppercase mt-0.5">
                    {primaryRole?.replace('_', ' ')}
                  </p>
                </div>
              </div>

              <button
                onClick={logout}
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-btn text-xs font-semibold hover:bg-ink-light transition cursor-pointer"
                title="Sign Out"
              >
                <SignOut size={16} weight="regular" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-btn text-slate-300 hover:text-white hover:bg-ink-light transition cursor-pointer"
                aria-label="Toggle operations menu"
              >
                {mobileMenuOpen ? <X size={20} weight="regular" /> : <List size={20} weight="regular" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-ink-light bg-ink px-4 pt-3 pb-5 space-y-1.5">
            {isAdmin && (
              <>
                <Link
                  to="/portal/admin"
                  onClick={closeMenu}
                  className={`block px-3 py-2.5 rounded-btn text-xs font-semibold transition ${pathname.startsWith('/portal/admin') ? 'bg-ink-light text-white border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-ink-light/60'}`}
                >
                  Overview
                </Link>
                <Link
                  to="/portal/organiser"
                  onClick={closeMenu}
                  className={`block px-3 py-2.5 rounded-btn text-xs font-semibold transition ${pathname.startsWith('/portal/organiser') ? 'bg-ink-light text-white border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-ink-light/60'}`}
                >
                  Events &amp; Analytics
                </Link>
                <Link
                  to="/portal/supervisor"
                  onClick={closeMenu}
                  className={`block px-3 py-2.5 rounded-btn text-xs font-semibold transition ${pathname.startsWith('/portal/supervisor') ? 'bg-ink-light text-white border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-ink-light/60'}`}
                >
                  Gate Exceptions
                </Link>
                <Link
                  to="/portal/auditor"
                  onClick={closeMenu}
                  className={`block px-3 py-2.5 rounded-btn text-xs font-semibold transition ${pathname.startsWith('/portal/auditor') ? 'bg-ink-light text-white border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-ink-light/60'}`}
                >
                  Audit Trail
                </Link>
                <Link
                  to="/portal/scanner"
                  onClick={closeMenu}
                  className={`block px-3 py-2.5 rounded-btn text-xs font-semibold transition ${pathname.startsWith('/portal/scanner') ? 'bg-ink-light text-white border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-ink-light/60'}`}
                >
                  Gate Check-in
                </Link>
              </>
            )}
          </div>
        )}
      </header>
    );
  }

  // ENVIRONMENT 3: PUBLIC & ATTENDEE EXPERIENCE
  return (
    <header className="bg-ink text-white border-b border-ink-light sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <div className="flex items-center gap-6">
            <Link to="/" onClick={closeMenu} className="flex items-center gap-3">
              <img
                src="/iconic-logo.png"
                alt="Iconic Open University"
                className="h-8 sm:h-9 w-auto object-contain"
              />
              <div className="hidden sm:flex flex-col border-l border-slate-700 pl-3">
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-tangerine">
                  UNIVERSITY EVENTS
                </span>
              </div>
            </Link>

            {/* Desktop Public Navigation */}
            <nav className="hidden md:flex items-center gap-1.5">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-btn text-xs font-semibold flex items-center gap-2 transition ${pathname === '/'
                  ? 'bg-ink-light text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-ink-light/50'
                  }`}
              >
                <CalendarBlank size={18} weight={pathname === '/' ? 'fill' : 'regular'} className="text-slate-400" />
                <span>Browse Events</span>
              </Link>

              {isAttendeeOnly && (
                <Link
                  to="/portal/attendee"
                  className={`px-3 py-1.5 rounded-btn text-xs font-semibold flex items-center gap-2 transition ${pathname === '/portal/attendee'
                    ? 'bg-ink-light text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white hover:bg-ink-light/50'
                    }`}
                >
                  <Ticket size={18} weight={pathname === '/portal/attendee' ? 'fill' : 'regular'} className="text-tangerine" />
                  <span>My Passes</span>
                </Link>
              )}
            </nav>
          </div>

          {/* Desktop Right Side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Single Direct Link to User's Assigned Role Console */}
                {primaryRole && primaryRole !== 'attendee' && (
                  <Link
                    to={getRolePortalPath(primaryRole)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-btn bg-ink-light border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition"
                  >
                    <span>{getRolePortalLabel(primaryRole)}</span>
                  </Link>
                )}

                <div className="flex items-center gap-2.5 pl-1">
                  <div className="w-8 h-8 rounded-full bg-ink-light border border-slate-700 flex items-center justify-center text-xs font-mono font-bold text-slate-200">
                    {getInitials(user.displayName)}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-slate-200 leading-none">
                      {user.displayName}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 uppercase mt-0.5">
                      {primaryRole?.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <div className="h-4 w-px bg-ink-light" />

                <button
                  onClick={logout}
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-btn text-xs font-semibold hover:bg-ink-light transition cursor-pointer"
                  title="Sign Out"
                >
                  <SignOut size={16} weight="regular" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login?mode=signin"
                  className="px-3.5 py-2 rounded-btn text-xs font-semibold text-slate-300 hover:text-white hover:bg-ink-light transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/login?mode=signup"
                  className="editorial-btn-primary"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
              className="p-2 rounded-btn text-slate-300 hover:text-white hover:bg-ink-light transition cursor-pointer"
            >
              {mobileMenuOpen ? <X size={22} weight="regular" /> : <List size={22} weight="regular" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-ink-light bg-ink px-4 pt-3 pb-6 space-y-3">
          {user && (
            <div className="flex items-center justify-between p-3 rounded-card bg-ink-light border border-slate-700">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-mono font-bold text-slate-200">
                  {getInitials(user.displayName)}
                </div>
                <div className="truncate">
                  <p className="font-semibold text-slate-100 text-xs truncate">
                    {user.displayName}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono uppercase">
                    {primaryRole?.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  closeMenu();
                  logout();
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-btn bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
              >
                <SignOut size={16} weight="regular" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          <div className="space-y-1">
            <Link
              to="/"
              onClick={closeMenu}
              className="flex items-center gap-2 px-3 py-2.5 rounded-btn text-xs font-medium text-slate-300 hover:text-white hover:bg-ink-light"
            >
              <CalendarBlank size={18} weight={pathname === '/' ? 'fill' : 'regular'} className="text-slate-400" />
              <span>Explore Events</span>
            </Link>

            {isAttendeeOnly && (
              <Link
                to="/portal/attendee"
                onClick={closeMenu}
                className="flex items-center gap-2 px-3 py-2.5 rounded-btn text-xs font-medium text-slate-300 hover:text-white hover:bg-ink-light"
              >
                <Ticket size={18} weight={pathname === '/portal/attendee' ? 'fill' : 'regular'} className="text-tangerine" />
                <span>My Passes</span>
              </Link>
            )}

            {user && primaryRole && primaryRole !== 'attendee' && (
              <Link
                to={getRolePortalPath(primaryRole)}
                onClick={closeMenu}
                className="flex items-center gap-2 px-3 py-2.5 rounded-btn text-xs font-semibold text-white bg-ink-light border border-slate-700"
              >
                <span>{getRolePortalLabel(primaryRole)}</span>
              </Link>
            )}
          </div>

          {!user && (
            <div className="pt-3 border-t border-slate-800 flex gap-2">
              <Link
                to="/login?mode=signin"
                onClick={closeMenu}
                className="flex-1 py-2.5 rounded-btn text-center text-xs font-semibold border border-slate-700 text-white bg-ink-light"
              >
                Sign In
              </Link>
              <Link
                to="/login?mode=signup"
                onClick={closeMenu}
                className="flex-1 py-2.5 rounded-btn text-center text-xs font-semibold bg-tangerine hover:bg-tangerine-hover text-white"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};