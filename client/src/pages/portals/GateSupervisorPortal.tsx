import React, { useEffect, useState } from 'react';
import { getEvents, searchTickets, manualOverrideCheckIn, getRecentScans } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle,
  X,
  WarningCircle
} from '@phosphor-icons/react';

export const GateSupervisorPortal: React.FC = () => {
  const { user } = useAuth();

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [gates, setGates] = useState<any[]>([]);
  const [selectedGateId, setSelectedGateId] = useState<string>('');

  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);

  // Override Confirmation Modal
  const [targetTicket, setTargetTicket] = useState<any | null>(null);
  const [overrideCategory, setOverrideCategory] = useState('Damaged or unreadable mobile screen');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    getEvents()
      .then((res) => {
        if (res.success && res.events.length > 0) {
          setEvents(res.events);
          const defaultEvt = res.events[0];
          setSelectedEventId(defaultEvt.id);
          setGates(defaultEvt.gates || []);
          if (defaultEvt.gates?.length > 0) {
            setSelectedGateId(defaultEvt.gates[0].id);
          }
        }
      })
      .catch((err: any) => setLoadError(err.message || 'Failed to load events'));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && targetTicket && !submitting) {
        setTargetTicket(null);
        setOverrideError(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [targetTicket, submitting]);

  const loadData = (evtId?: string) => {
    const id = evtId || selectedEventId;
    if (!id) return;
    setLoadError(null);
    Promise.allSettled([searchTickets(id, query), getRecentScans(id)]).then(([ticketsRes, scansRes]) => {
      if (ticketsRes.status === 'fulfilled' && ticketsRes.value.success) {
        setTickets(ticketsRes.value.tickets);
      } else if (ticketsRes.status === 'rejected') {
        setLoadError(ticketsRes.reason?.message || 'Failed to load tickets');
      }
      if (scansRes.status === 'fulfilled' && scansRes.value.success) {
        setRecentScans(scansRes.value.scans);
      }
    });
  };

  useEffect(() => {
    if (selectedEventId) {
      loadData(selectedEventId);
    }
  }, [selectedEventId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;
    setSearching(true);
    setLoadError(null);
    searchTickets(selectedEventId, query)
      .then((res) => {
        if (res.success) setTickets(res.tickets);
      })
      .catch((err: any) => setLoadError(err.message || 'Search failed'))
      .finally(() => setSearching(false));
  };

  const handleExecuteOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTicket) return;

    if (!reason.trim()) {
      setOverrideError('Please provide a reason for the manual entry approval.');
      return;
    }

    setSubmitting(true);
    setOverrideError(null);
    const combinedReason = `${overrideCategory}: ${reason.trim()}`;
    try {
      const res = await manualOverrideCheckIn({
        ticketId: targetTicket.id,
        eventId: selectedEventId,
        gateId: selectedGateId || undefined,
        reason: combinedReason,
      });

      if (res.success && res.data) {
        setFeedback(
          `Manual admission recorded for ${targetTicket.registration.attendee.fullName}.`
        );
        setTargetTicket(null);
        setReason('');
        loadData();
      }
    } catch (err: any) {
      setOverrideError(err.message || 'Override failed');
    } finally {
      setSubmitting(false);
    }
  };

  const overrideCategories = [
    'Damaged or unreadable mobile screen',
    'Camera or scanner issue',
    'Official guest / manual entry',
    'Damaged printed paper pass',
    'Identity verified with student or national ID',
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="editorial-card p-6 sm:p-8 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            Gate Exceptions
          </h1>
        </div>

        {/* Event & Gate Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="w-full sm:w-56">
            <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-1">
              Active Event
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                const evt = events.find((ev) => ev.id === e.target.value);
                if (evt) {
                  setGates(evt.gates || []);
                  setSelectedGateId(evt.gates?.[0]?.id || '');
                }
              }}
              className="w-full px-3 py-1.5 rounded-btn border border-slate-300 bg-white text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-tangerine transition"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-44">
            <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-1">
              Assigned Gate
            </label>
            <select
              value={selectedGateId}
              onChange={(e) => setSelectedGateId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-btn border border-slate-300 bg-white text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-tangerine transition"
            >
              {gates.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {loadError && (
        <div className="p-4 rounded-card bg-crimson/5 border border-crimson/20 text-crimson text-xs flex items-center justify-between shadow-subtle">
          <span>{loadError}</span>
          <button
            onClick={() => loadData()}
            className="px-3 py-1 rounded-btn bg-white border border-crimson/30 font-semibold hover:bg-crimson/10 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
      {feedback && (
        <div className="p-4 rounded-card bg-forest-light border border-forest-border text-forest text-xs flex items-center justify-between shadow-subtle animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} weight="fill" className="shrink-0" />
            <span className="font-semibold">{feedback}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 rounded-full hover:bg-forest/10 transition cursor-pointer"
          >
            <X size={16} weight="regular" />
          </button>
        </div>
      )}

      {/* 2. Lookup & Exception Table */}
      <div className="editorial-card p-6 bg-white space-y-5 shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold font-display text-ink">
              Attendee Lookup
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Locate attendee records by name, email, phone or pass code to resolve gate scanning exceptions.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by name, email, or pass code..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-btn border border-slate-300 bg-white text-xs text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tangerine transition"
            />
            <button
              type="submit"
              disabled={searching}
              className="editorial-btn-dark text-xs shrink-0 cursor-pointer"
            >
              {searching ? 'Finding...' : 'Search'}
            </button>
          </form>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto rounded-card border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-ivory border-b border-slate-200 font-mono text-[10px] uppercase text-slate-500">
              <tr>
                <th className="p-3.5">Attendee Details</th>
                <th className="p-3.5">Pass Code</th>
                <th className="p-3.5">Ticket Tier</th>
                <th className="p-3.5">Entry Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No attendee records found matching your query. Enter a name or registration reference above.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => {
                  const reg = t.registration;
                  const isCheckedIn = Boolean(t.checkIn);
                  const isRevoked = t.status === 'revoked';

                  return (
                    <tr key={t.id} className="hover:bg-ivory/50 transition">
                      <td className="p-3.5">
                        <p className="font-bold text-ink">{reg.attendee.fullName}</p>
                        <p className="text-[11px] text-slate-500">{reg.attendee.email}</p>
                      </td>
                      <td className="p-3.5 font-mono text-ink font-semibold">
                        {t.ticketNumber}
                      </td>
                      <td className="p-3.5 text-slate-700">
                        {reg.ticketType.name}
                      </td>
                      <td className="p-3.5">
                        {isCheckedIn ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-badge bg-slate-100 text-slate-800 font-mono text-[10px] font-bold border border-slate-300">
                            Admitted ({t.checkIn?.gate?.name || 'Gate'})
                          </span>
                        ) : isRevoked ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-badge bg-crimson-subtle text-crimson font-mono text-[10px] font-bold border border-crimson-border">
                            Revoked
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-badge bg-forest-light text-forest font-mono text-[10px] font-bold border border-forest-border">
                            Ready for Entry
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {!isCheckedIn && !isRevoked ? (
                          <button
                            onClick={() => {
                              setTargetTicket(t);
                              setOverrideCategory('Damaged or unreadable mobile screen');
                              setReason('');
                            }}
                            className="editorial-btn-primary text-xs inline-flex items-center gap-1.5 cursor-pointer py-1.5 px-3"
                          >
                            <span>Manual Entry Approval</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-400">
                            {isCheckedIn ? 'Admission Recorded' : 'Pass Ineligible'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. CONFIRMATION MODAL FOR MANUAL OVERRIDE (FR-08) */}
      {targetTicket && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-300 max-w-lg w-full overflow-hidden shadow-modal animate-scale-in">
            <div className="bg-ink text-white p-6 space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-warning tracking-wider">
                SUPERVISOR ACTION
              </span>
              <h3 className="text-lg font-bold font-display text-white">
                Approve Manual Event Admission
              </h3>
              <p className="text-xs text-slate-300">
                This records manual entry approval without optical QR scanning. The action will be logged in the system activity records.
              </p>
            </div>

            <form onSubmit={handleExecuteOverride} className="p-6 space-y-4">
              {overrideError && (
                <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs">
                  {overrideError}
                </div>
              )}
              <div className="p-3.5 rounded-card bg-ivory border border-slate-200 text-xs space-y-1">
                <p>
                  <span className="font-semibold text-ink">Attendee:</span>{' '}
                  {targetTicket.registration.attendee.fullName} ({targetTicket.registration.attendee.email})
                </p>
                <p>
                  <span className="font-semibold text-ink">Pass Code:</span>{' '}
                  <span className="font-mono">{targetTicket.ticketNumber}</span>
                </p>
                <p>
                  <span className="font-semibold text-ink">Assigned Gate:</span>{' '}
                  {gates.find((g) => g.id === selectedGateId)?.name || 'Gate 1'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Approval Category <span className="text-tangerine">*</span>
                </label>
                <select
                  value={overrideCategory}
                  onChange={(e) => setOverrideCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 bg-white text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                >
                  {overrideCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Reason for Manual Approval <span className="text-tangerine">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State specific reason (e.g. Attendee presented matching student ID; phone screen was cracked and could not be scanned)."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-3 rounded-btn border border-slate-300 bg-white text-xs text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTargetTicket(null)}
                  className="editorial-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reason.trim()}
                  className="editorial-btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? 'Approving...' : 'Confirm Manual Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
