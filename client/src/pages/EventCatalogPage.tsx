import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getEvents } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight,
  Ticket,
  MagnifyingGlass
} from '@phosphor-icons/react';

interface EventItem {
  id: string;
  title: string;
  description: string;
  venue: string;
  capacity: number;
  status: string;
  startAt: string;
  endAt: string;
  ticketTypes?: Array<{ id: string; name: string; price: number; capacity: number }>;
  _count?: { registrations: number };
}

const isDummyDescription = (desc?: string | null): boolean => {
  if (!desc) return true;
  const d = desc.trim().toLowerCase();
  return (
    d === 'live academic conference session and technology exhibition.' ||
    d === 'institutional academic symposium & research presentation.'
  );
};

export const EventCatalogPage: React.FC = () => {
  const { user, hasRole, getPrimaryPortalPath } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const loadEvents = () => {
    setLoading(true);
    getEvents()
      .then((res) => {
        if (res.success) setEvents(res.events || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user && user.roles?.[0]?.role) {
      const primaryRole = user.roles[0].role;
      if (['scanner_operator', 'supervisor', 'auditor'].includes(primaryRole)) {
        navigate(getPrimaryPortalPath(user), { replace: true });
        return;
      }
    }
    loadEvents();
  }, [user, navigate, getPrimaryPortalPath]);

  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const matchesCategory = (evt: EventItem, categoryId: string) => {
    if (categoryId === 'UPCOMING') {
      return new Date(evt.endAt) >= now && evt.status !== 'completed';
    }
    if (categoryId === 'THIS_WEEK') {
      const start = new Date(evt.startAt);
      const end = new Date(evt.endAt);
      return end >= now && start <= oneWeekFromNow && evt.status !== 'completed';
    }
    if (categoryId === 'OPEN') {
      return (evt._count?.registrations || 0) < evt.capacity && new Date(evt.endAt) >= now && evt.status !== 'completed';
    }
    if (categoryId === 'PAST') {
      return new Date(evt.endAt) < now || evt.status === 'completed';
    }
    return true;
  };

  const categories = [
    { id: 'ALL', label: 'All Events', count: events.length },
    { id: 'UPCOMING', label: 'Upcoming', count: events.filter((e) => matchesCategory(e, 'UPCOMING')).length },
    { id: 'THIS_WEEK', label: 'This Week', count: events.filter((e) => matchesCategory(e, 'THIS_WEEK')).length },
    { id: 'OPEN', label: 'Registration Open', count: events.filter((e) => matchesCategory(e, 'OPEN')).length },
    { id: 'PAST', label: 'Past Events', count: events.filter((e) => matchesCategory(e, 'PAST')).length },
  ];

  const filteredEvents = events.filter((evt) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      evt.title?.toLowerCase().includes(q) ||
      evt.venue?.toLowerCase().includes(q) ||
      evt.description?.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    return matchesCategory(evt, selectedCategory);
  });

  const featuredEvent = events.find((e) => new Date(e.endAt) >= now && e.status !== 'completed') || events[0] || null;
  const isFeaturedPast = featuredEvent ? (new Date(featuredEvent.endAt) < now || featuredEvent.status === 'completed') : false;
  const canManageEvents = hasRole(['admin', 'organiser']);
  const isOpsUser = Boolean(user && user.roles?.some((r) => r.role !== 'attendee'));

  // Format Dates
  const formatEventDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      day: d.getDate(),
      weekday: d.toLocaleString('en-US', { weekday: 'short' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      full: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    };
  };

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-12">
      {/* 1. EDITORIAL HERO & SPOTLIGHT */}
      <section className="relative overflow-hidden rounded-2xl bg-ink text-white border border-ink-light shadow-elevated">
        <div className="absolute inset-0 bg-radial-gradient opacity-20 pointer-events-none" />

        <div className="relative p-6 sm:p-10 lg:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-4">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display tracking-tight text-white leading-tight">
              University Events &amp; Registration
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl font-normal">
              Find upcoming university events, register to attend and access your event pass in one place.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href="#event-directory"
                className="editorial-btn-primary inline-flex items-center gap-2"
              >
                <span>Browse Events</span>
                <ArrowRight size={16} weight="regular" />
              </a>

              {user && !isOpsUser && (
                <Link
                  to="/portal/attendee"
                  className="editorial-btn-secondary inline-flex items-center gap-2"
                >
                  <Ticket size={16} weight="regular" className="text-tangerine" />
                  <span>My Passes</span>
                </Link>
              )}
              {!user && (
                <Link
                  to="/login?mode=signup"
                  className="editorial-btn-secondary inline-flex items-center gap-2"
                >
                  <span>Create Account</span>
                </Link>
              )}
            </div>
          </div>

          {/* Featured Spotlight Card */}
          {featuredEvent && (
            <div className="w-full lg:w-96 shrink-0 bg-ink-light/80 backdrop-blur-md rounded-card border border-slate-700/80 p-5 sm:p-6 space-y-4 shadow-modal">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-tangerine/10 text-tangerine border border-tangerine/30">
                  FEATURED EVENT
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {featuredEvent._count?.registrations || 0} Registered
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold font-display text-white leading-snug">
                  {featuredEvent.title}
                </h3>
                {featuredEvent.description && !isDummyDescription(featuredEvent.description) && (
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    {featuredEvent.description}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-700/60 font-sans">
                <div>
                  <span className="text-slate-400 font-mono uppercase mr-1.5 text-[10px]">Date:</span>
                  <span>{formatEventDate(featuredEvent.startAt).full} · {formatEventDate(featuredEvent.startAt).time}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-mono uppercase mr-1.5 text-[10px]">Venue:</span>
                  <span className="truncate">{featuredEvent.venue}</span>
                </div>
              </div>

              {isFeaturedPast ? (
                <div className="w-full py-2.5 rounded-btn bg-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700">
                  <span>Event Concluded</span>
                </div>
              ) : canManageEvents ? (
                <Link
                  to={`/register/${featuredEvent.id}`}
                  className="w-full py-2.5 rounded-btn bg-white hover:bg-ivory text-ink font-bold text-xs flex items-center justify-center gap-2 transition shadow-subtle"
                >
                  <span>Register Attendee</span>
                  <ArrowRight size={16} weight="regular" />
                </Link>
              ) : isOpsUser ? (
                <div className="w-full py-2 rounded-btn bg-ink border border-slate-700 text-slate-400 font-mono text-[11px] uppercase tracking-wider text-center">
                  Operations View Only
                </div>
              ) : (
                <Link
                  to={user ? `/register/${featuredEvent.id}` : `/login?redirect=${encodeURIComponent(`/register/${featuredEvent.id}`)}&mode=signup`}
                  className="w-full py-2.5 rounded-btn bg-white hover:bg-ivory text-ink font-bold text-xs flex items-center justify-center gap-2 transition shadow-subtle"
                >
                  <span>Register for Event</span>
                  <ArrowRight size={16} weight="regular" />
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 2. DIRECTORY SEARCH & CATEGORY FILTERS */}
      <section id="event-directory" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-tangerine">
              CATALOG
            </span>
            <h2 className="text-2xl font-bold font-display text-ink tracking-tight mt-0.5">
              Events
            </h2>
          </div>

          <div className="relative w-full md:w-80">
            <MagnifyingGlass size={16} weight="regular" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search events by name, topic or venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-card border border-slate-300 bg-white text-xs text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tangerine focus:border-tangerine shadow-subtle transition"
            />
          </div>
        </div>

        {/* Session Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-btn text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition cursor-pointer ${selectedCategory === cat.id
                  ? 'bg-ink text-white shadow-subtle'
                  : 'bg-white text-slate-600 hover:text-ink hover:bg-slate-100 border border-slate-200'
                }`}
            >
              <span>{cat.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-badge ${
                  selectedCategory === cat.id
                    ? 'bg-white/15 text-white'
                    : 'bg-ivory text-slate-500'
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* 3. EVENT CARDS GRID */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-tangerine" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="editorial-card p-12 text-center space-y-3">
            <h3 className="text-base font-bold text-ink">No events found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              We couldn't find any events matching your query. Try clearing your search term or selecting another category filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
              }}
              className="editorial-btn-secondary text-xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {filteredEvents.map((evt, idx) => {
              const regCount = evt._count?.registrations || 0;
              const spotsRemaining = Math.max(0, evt.capacity - regCount);
              const capacityPct = Math.min(100, Math.round((regCount / evt.capacity) * 100));
              const dt = formatEventDate(evt.startAt);
              const isEventPast = new Date(evt.endAt) < now || evt.status === 'completed';

              // Distinctive Graphic Motifs / Editorial Card Artwork Header
              const isDarkAccent = idx % 2 === 0;

              return (
                <div
                  key={evt.id}
                  className="editorial-card overflow-hidden flex flex-col justify-between hover:border-slate-300 hover:shadow-elevated transition duration-200 group"
                >
                  <div>
                    {/* Visual Poster Banner */}
                    <div
                      className={`h-28 p-5 flex items-end justify-between relative ${isDarkAccent
                          ? 'bg-gradient-to-r from-ink to-slate-800 text-white'
                          : 'bg-gradient-to-r from-slate-900 to-ink-deep text-white'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-14 rounded-btn bg-white/10 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-tangerine">
                            {dt.month}
                          </span>
                          <span className="text-lg font-bold font-display leading-none text-white">
                            {dt.day}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-medium">
                            {dt.weekday} · {dt.time}
                          </span>
                          <p className="text-xs text-white/90 font-medium mt-0.5 truncate max-w-[200px] sm:max-w-xs">
                            {evt.venue}
                          </p>
                        </div>
                      </div>

                      {isEventPast ? (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-badge bg-slate-800 text-slate-300 border border-slate-700">
                          Concluded
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-badge bg-white/10 text-white border border-white/20">
                          {spotsRemaining} seats left
                        </span>
                      )}
                    </div>

                    {/* Content Body */}
                    <div className="p-6 space-y-3.5">
                      <h3 className="text-lg font-bold font-display text-ink leading-snug group-hover:text-tangerine transition">
                        {evt.title}
                      </h3>

                      {evt.description && !isDummyDescription(evt.description) && (
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {evt.description}
                        </p>
                      )}

                      {/* Capacity Meter */}
                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-[11px] text-slate-500 font-sans">
                          <span>Registration Capacity</span>
                          <span className="font-semibold text-ink">
                            {capacityPct}% ({regCount}/{evt.capacity})
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-ink h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${capacityPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-5 bg-ivory/60 border-t border-slate-100 flex items-center justify-between gap-3">
                    {isEventPast ? (
                      <div className="w-full py-2 px-3 rounded-btn bg-slate-100 text-slate-500 text-xs font-semibold inline-flex items-center justify-between border border-slate-200">
                        <span>Event Concluded</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Closed</span>
                      </div>
                    ) : canManageEvents ? (
                      <Link
                        to={`/register/${evt.id}`}
                        className="editorial-btn-dark inline-flex items-center gap-2 text-xs"
                      >
                        <span>Register Attendee</span>
                        <ArrowRight size={16} weight="regular" />
                      </Link>
                    ) : isOpsUser ? (
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                        Operations View Only
                      </span>
                    ) : (
                      <Link
                        to={user ? `/register/${evt.id}` : `/login?redirect=${encodeURIComponent(`/register/${evt.id}`)}&mode=signup`}
                        className="editorial-btn-dark inline-flex items-center gap-2 text-xs"
                      >
                        <span>Register for Event</span>
                        <ArrowRight size={16} weight="regular" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
