import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Footer: React.FC = () => {
  const { user } = useAuth();
  const userRoles = user?.roles?.map((r) => r.role) || [];
  const primaryRole = userRoles[0];
  const isOpsUser = Boolean(user && primaryRole && primaryRole !== 'attendee');
  const canAccessCatalog = userRoles.includes('admin') || userRoles.includes('organiser');
  const isAttendee = Boolean(user && primaryRole === 'attendee');

  if (isOpsUser && user) {
    return (
      <footer className="bg-[#1e293b] border-t border-slate-700/80 text-slate-300 text-[13px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h4 className="text-white font-bold text-xs uppercase tracking-wider">
                Iconic Open University · Operations
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed max-w-md">
                Manage event admission, attendee verification and gate access.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-white font-bold text-xs uppercase tracking-wider">
                Platform Navigation
              </h4>
              <ul className="space-y-2 text-xs">
                {canAccessCatalog && (
                  <li>
                    <Link to="/" className="hover:text-white transition">
                      • Public Event Catalog
                    </Link>
                  </li>
                )}
                <li>
                  <Link to={`/portal/${primaryRole}`} className="hover:text-white transition">
                    • Operational Console
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>© 2026 Iconic Open University. All Rights Reserved.</p>
            <p className="text-xs text-slate-400">Privacy &amp; Data Protection Notice</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-[#1e293b] border-t border-slate-700/80 text-slate-300 text-[13px]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isAttendee ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-10`}>
          {/* Column 1: Platform Summary & Action */}
          <div className="space-y-4">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">
              Iconic Open University Events
            </h4>
            <p className="text-slate-300 text-[13px] leading-relaxed">
              Register for university events, access your passes and get assistance with event attendance.
            </p>
            <div className="pt-1">
              {isAttendee ? (
                <Link
                  to="/portal/attendee"
                  className="editorial-btn-primary inline-flex items-center text-xs tracking-wider"
                >
                  MY PASSES
                </Link>
              ) : (
                <Link
                  to="/login?mode=signup"
                  className="editorial-btn-primary inline-flex items-center text-xs tracking-wider"
                >
                  GET TICKETS
                </Link>
              )}
            </div>
          </div>

          {/* Column 2: Find Events */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">
              Events
            </h4>
            <ul className="space-y-2 text-[13px]">
              <li>
                <Link to="/" className="hover:text-white transition flex items-center gap-2">
                  <span className="text-slate-500">•</span>
                  <span>Browse All Events</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Verification */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">
              Gate Access
            </h4>
            <ul className="space-y-2 text-[13px]">
              <li className="text-slate-400">
                • Digital pass check-in at event venue
              </li>
              <li className="text-slate-400">
                • Support available at entrance desk
              </li>
            </ul>
          </div>

          {/* Column 4: Account (Public Only) */}
          {!isAttendee && (
            <div className="space-y-3">
              <h4 className="text-white font-bold text-xs uppercase tracking-wider">
                Account Access
              </h4>
              <ul className="space-y-2 text-[13px]">
                <li>
                  <Link to="/login?mode=signin" className="hover:text-white transition flex items-center gap-2">
                    <span className="text-slate-500">•</span>
                    <span>Sign In</span>
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 Iconic Open University. All Rights Reserved.</p>
          <p className="text-xs text-slate-400">Privacy &amp; Data Protection Notice</p>
        </div>
      </div>
    </footer>
  );
};
