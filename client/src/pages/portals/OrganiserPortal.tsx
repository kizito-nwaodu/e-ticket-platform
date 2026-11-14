import React, { useEffect, useState } from 'react';
import {
  getEvents,
  getEventDashboard,
  exportAttendanceCsvApi,
  revokeTicket,
  reissueTicket,
  searchTickets,
  createEvent,
  addEventGate,
  deleteEventApi,
  scheduleFailedRegistrantApi,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  Plus,
  X,
  Trash,
  ArrowClockwise,
  FileCsv,
  Ticket,
  UserPlus,
  CheckCircle,
  WarningCircle
} from '@phosphor-icons/react';

export const OrganiserPortal: React.FC = () => {
  const { user } = useAuth();

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Ticket Management
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [selectedTicketAction, setSelectedTicketAction] = useState<{
    ticket: any;
    action: 'revoke' | 'reissue';
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create Event Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newCapacity, setNewCapacity] = useState('300');
  const [newTicketTypeName, setNewTicketTypeName] = useState('Standard Delegate');
  const [newGateName, setNewGateName] = useState('North Main Gate');

  // Add Gate Modal State
  const [showGateModal, setShowGateModal] = useState(false);
  const [addingGate, setAddingGate] = useState(false);
  const [additionalGateName, setAdditionalGateName] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);

  // Delete Event Modal State
  const [showDeleteEventModal, setShowDeleteEventModal] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Schedule Failed Registrant Modal State
  const [showScheduleFailedModal, setShowScheduleFailedModal] = useState(false);
  const [failedFullName, setFailedFullName] = useState('');
  const [failedEmail, setFailedEmail] = useState('');
  const [failedPhone, setFailedPhone] = useState('');
  const [failedTicketTypeId, setFailedTicketTypeId] = useState('');
  const [failedReason, setFailedReason] = useState('In-person registration assistance');
  const [schedulingSubmitting, setSchedulingSubmitting] = useState(false);
  const [schedulingError, setSchedulingError] = useState<string | null>(null);
  const [scheduledResult, setScheduledResult] = useState<any | null>(null);

  const loadAllEvents = (autoSelectId?: string) => {
    setLoadError(null);
    return getEvents()
      .then((res) => {
        if (res.success) {
          const list = res.events || [];
          setEvents(list);
          if (list.length > 0) {
            const targetId =
              autoSelectId ||
              (selectedEventId && list.some((e: any) => e.id === selectedEventId)
                ? selectedEventId
                : list[0].id);
            setSelectedEventId(targetId);
          } else {
            setSelectedEventId('');
            setAnalytics(null);
            setTicketsList([]);
            setLoading(false);
          }
        }
      })
      .catch((err: any) => {
        setLoadError(err.message || 'Failed to load events');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadAllEvents();
  }, []);

  const loadData = (evtId: string) => {
    if (!evtId) return;
    setLoading(true);
    setLoadError(null);
    Promise.all([getEventDashboard(evtId), searchTickets(evtId, '')])
      .then(([dashRes, ticketRes]) => {
        if (dashRes.success) setAnalytics(dashRes.data);
        if (ticketRes.success) setTicketsList(ticketRes.tickets);
      })
      .catch((err: any) => setLoadError(err.message || 'Failed to load event analytics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedEventId) {
      loadData(selectedEventId);
    }
  }, [selectedEventId]);

  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newVenue.trim()) return;

    const parsedCapacity = parseInt(newCapacity, 10);
    if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1) {
      setCreateError('Capacity must be at least 1.');
      return;
    }
    if (newStart && newEnd && new Date(newEnd) <= new Date(newStart)) {
      setCreateError('End time must be after start time.');
      return;
    }

    setCreatingEvent(true);
    setCreateError(null);
    try {
      const now = new Date();
      const start = newStart ? new Date(newStart).toISOString() : new Date(now.getTime() + 3600000).toISOString();
      const end = newEnd ? new Date(newEnd).toISOString() : new Date(now.getTime() + 28800000).toISOString();

      const res = await createEvent({
        title: newTitle.trim(),
        description: newDesc.trim() || 'Live academic conference session and technology exhibition.',
        venue: newVenue.trim(),
        startAt: start,
        endAt: end,
        capacity: parsedCapacity,
        status: 'published',
        ticketTypes: [{ name: newTicketTypeName.trim() || 'Standard Delegate', price: 0, capacity: parsedCapacity }],
        gates: [{ name: newGateName.trim() || 'Main Gate A' }],
      });

      if (res.success && res.event) {
        setShowCreateModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewVenue('');
        setNewStart('');
        setNewEnd('');
        setNewCapacity('300');
        await loadAllEvents(res.event.id);
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create event');
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleAddGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !additionalGateName.trim()) return;

    setAddingGate(true);
    setGateError(null);
    try {
      const res = await addEventGate(selectedEventId, additionalGateName.trim());
      if (res.success) {
        setShowGateModal(false);
        setAdditionalGateName('');
        loadData(selectedEventId);
      }
    } catch (err: any) {
      setGateError(err.message || 'Failed to add gate');
    } finally {
      setAddingGate(false);
    }
  };

  const handleExecuteTicketAction = async () => {
    if (!selectedTicketAction || !actionReason.trim()) return;

    setActionSubmitting(true);
    setActionError(null);
    const { ticket, action } = selectedTicketAction;

    try {
      if (action === 'revoke') {
        const res = await revokeTicket(ticket.id, actionReason.trim());
        if (res.success) {
          setSelectedTicketAction(null);
          setActionReason('');
          loadData(selectedEventId);
        }
      } else {
        const res = await reissueTicket(ticket.id, actionReason.trim());
        if (res.success) {
          setSelectedTicketAction(null);
          setActionReason('');
          loadData(selectedEventId);
        }
      }
    } catch (err: any) {
      setActionError(err.message || 'Ticket action failed');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleDeleteSelectedEvent = async () => {
    if (!selectedEventId) return;
    setDeletingEvent(true);
    setDeleteError(null);
    try {
      const res = await deleteEventApi(selectedEventId);
      if (res.success) {
        setShowDeleteEventModal(false);
        setSelectedEventId('');
        await loadAllEvents();
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete event');
    } finally {
      setDeletingEvent(false);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedEventId || exportingCsv) return;
    setExportingCsv(true);
    setLoadError(null);
    try {
      await exportAttendanceCsvApi(selectedEventId);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to export CSV report');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleScheduleFailedRegistrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !failedFullName.trim() || !failedEmail.trim()) return;

    setSchedulingSubmitting(true);
    setSchedulingError(null);
    setScheduledResult(null);

    try {
      const res = await scheduleFailedRegistrantApi(selectedEventId, {
        fullName: failedFullName.trim(),
        email: failedEmail.trim(),
        phone: failedPhone.trim() || undefined,
        ticketTypeId: failedTicketTypeId || undefined,
        reason: failedReason.trim() || 'Assisted registration on behalf of delegate',
      });

      if (res.success && res.data) {
        setScheduledResult(res.data);
        setFailedFullName('');
        setFailedEmail('');
        setFailedPhone('');
        loadData(selectedEventId);
      }
    } catch (err: any) {
      setSchedulingError(err.message || 'Failed to schedule registrant');
    } finally {
      setSchedulingSubmitting(false);
    }
  };

  if (loading && !analytics) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-tangerine" />
      </div>
    );
  }

  const s = analytics?.summary || {};

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Editorial Header */}
      {loadError && (
        <div className="editorial-card p-4 bg-crimson/5 border border-crimson/20 text-crimson text-xs flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            onClick={() => (selectedEventId ? loadData(selectedEventId) : loadAllEvents())}
            className="px-3 py-1 rounded-btn bg-white border border-crimson/30 font-semibold hover:bg-crimson/10 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
      <div className="editorial-card p-6 sm:p-8 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            Event Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowCreateModal(true)}
            className="editorial-btn-dark text-xs inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} weight="regular" />
            <span>Create Event</span>
          </button>

          <button
            onClick={() => {
              setSchedulingError(null);
              setScheduledResult(null);
              setFailedEmail('');
              setFailedFullName('');
              setFailedPhone('');
              setShowScheduleFailedModal(true);
            }}
            className="editorial-btn-secondary text-xs inline-flex items-center gap-2 cursor-pointer"
            title="Register an attendee who needs in-person assistance"
          >
            <UserPlus size={16} weight="regular" />
            <span>Assisted Registration</span>
          </button>

          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3 py-1.5 rounded-btn border border-slate-300 bg-white text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-tangerine transition"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadData(selectedEventId)}
            className="p-2 rounded-btn border border-slate-300 bg-ivory hover:bg-slate-200 text-ink transition cursor-pointer"
            title="Refresh analytics data"
          >
            <ArrowClockwise size={16} weight="regular" />
          </button>

          <button
            onClick={handleExportCsv}
            disabled={!selectedEventId || exportingCsv}
            className="editorial-btn-secondary text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <FileCsv size={16} weight="regular" />
            <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
          </button>

          {selectedEventId && (
            <button
              onClick={() => {
                setDeleteError(null);
                setShowDeleteEventModal(true);
              }}
              className="p-2 rounded-btn border border-crimson/20 bg-crimson/5 hover:bg-crimson/10 text-crimson transition cursor-pointer"
              title="Delete this event"
            >
              <Trash size={16} weight="regular" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="editorial-card p-4 sm:p-5 bg-white space-y-1">
          <div className="text-slate-500">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider">
              Registrations
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-display tracking-tight text-ink">
            {s.approvedRegistrations || 0}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400">Capacity: {analytics?.capacity || 0}</p>
        </div>

        <div className="editorial-card p-4 sm:p-5 bg-white space-y-1">
          <div className="text-slate-500">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider">
              Total Check-ins
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-display tracking-tight text-ink">
            {s.checkedInAttendees || 0}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400">{s.manualOverrides || 0} via supervisor</p>
        </div>

        <div className="editorial-card p-4 sm:p-5 bg-white space-y-1">
          <div className="text-slate-500">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider">
              Turnout Rate
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-display tracking-tight text-ink">
            {s.attendanceRate || 0}%
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-ink h-1.5 rounded-full"
              style={{ width: `${Math.min(100, s.attendanceRate || 0)}%` }}
            />
          </div>
        </div>

        <div className="editorial-card p-4 sm:p-5 bg-white space-y-1">
          <div className="text-slate-500">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider">
              Unadmitted Passes
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-display tracking-tight text-ink">
            {s.noShowCount || 0}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400">Rate: {s.noShowRate || 0}%</p>
        </div>

        <div className="editorial-card p-4 sm:p-5 bg-white space-y-1">
          <div className="text-slate-500">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider">
              Duplicate Attempts Prevented
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-display tracking-tight text-ink">
            {s.repeatScanAttempts || 0}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400">Blocked duplicates</p>
        </div>
      </div>

      {/* Arrival Velocity & Gate Activity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 editorial-card p-6 bg-white space-y-4">
          <div>
            <h2 className="text-sm font-bold font-display text-ink">
              Attendance Over Time
            </h2>
            <p className="text-xs text-slate-500">Check-ins recorded in 15-minute intervals</p>
          </div>

          <div className="h-64 w-full">
            {analytics?.arrivalVelocity?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.arrivalVelocity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderRadius: '8px',
                      color: '#ffffff',
                      border: '1px solid #334155',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="checkIns"
                    stroke="#F06436"
                    strokeWidth={2.5}
                    dot={{ fill: '#111827', stroke: '#F06436', strokeWidth: 2, r: 4 }}
                    name="Admissions"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No check-in activity recorded yet.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 editorial-card p-6 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold font-display text-ink">
                Gate Throughput
              </h2>
              <p className="text-xs text-slate-500">Admissions by gate terminal</p>
            </div>
            <button
              onClick={() => setShowGateModal(true)}
              className="editorial-btn-secondary text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} weight="regular" />
              <span>Add Gate</span>
            </button>
          </div>

          <div className="h-64 w-full">
            {analytics?.gateStats?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.gateStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="gateName" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderRadius: '8px',
                      color: '#ffffff',
                      border: '1px solid #334155',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="admitted" fill="#111827" name="Admitted" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rejected" fill="#D83D48" name="Rejected" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No gate admission records yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Management Lifecycle */}
      <div className="editorial-card p-6 bg-white space-y-4">
        <div>
          <h2 className="text-sm font-bold font-display text-ink">
            Ticket Credential Lifecycle
          </h2>
          <p className="text-xs text-slate-500">
            Revoke compromised credentials or reissue fresh tokens with historical audit preservation.
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-btn">
          <table className="w-full text-left text-xs">
            <thead className="bg-ivory/60 text-slate-500 font-mono text-[10px] uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Ticket Number</th>
                <th className="py-2.5 px-3">Attendee Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Issued At</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {ticketsList.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-3 font-mono font-bold text-ink">{t.ticketNumber}</td>
                  <td className="py-3 px-3 font-semibold text-ink">
                    {t.registration.attendee.fullName}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{t.registration.ticketType.name}</td>
                  <td className="py-3 px-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-ivory text-ink border border-slate-200">
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                    {new Date(t.issuedAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                    {t.status === 'active' && (
                      <button
                        onClick={() => setSelectedTicketAction({ ticket: t, action: 'revoke' })}
                        className="editorial-btn-secondary text-[11px] py-1 px-2.5"
                      >
                        Revoke
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedTicketAction({ ticket: t, action: 'reissue' })}
                      className="editorial-btn-dark text-[11px] py-1 px-2.5"
                    >
                      Reissue
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE FRESH EVENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-card max-w-lg w-full p-6 sm:p-7 shadow-modal space-y-4 border border-slate-300 max-h-[90vh] overflow-y-auto animate-slide-down">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold font-display text-ink">Create Fresh Event</h3>
                <p className="text-xs text-slate-500">Configure title, venue, capacity, ticket type, and gate</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-ink cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            <form onSubmit={handleCreateEventSubmit} className="space-y-3.5 text-xs">
              {createError && (
                <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs">
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-ink font-bold mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026 Iconic AI & Cloud Innovation Summit"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
              </div>

              <div>
                <label className="block text-ink font-bold mb-1">
                  Venue / Location *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. University Multipurpose Hall, Abuja"
                  value={newVenue}
                  onChange={(e) => setNewVenue(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink font-bold mb-1">
                    Total Capacity *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                  />
                </div>

                <div>
                  <label className="block text-ink font-bold mb-1">
                    Initial Gate Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newGateName}
                    onChange={(e) => setNewGateName(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink font-bold mb-1">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                  />
                </div>

                <div>
                  <label className="block text-ink font-bold mb-1">
                    End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink font-bold mb-1">
                  Default Ticket Tier Name
                </label>
                <input
                  type="text"
                  required
                  value={newTicketTypeName}
                  onChange={(e) => setNewTicketTypeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
              </div>

              <div>
                <label className="block text-ink font-bold mb-1">
                  Event Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional brief for event catalog..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full p-2.5 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="editorial-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingEvent}
                  className="editorial-btn-dark text-xs"
                >
                  {creatingEvent ? 'Creating...' : 'Create & Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD GATE MODAL */}
      {showGateModal && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-card max-w-sm w-full p-6 shadow-modal space-y-4 border border-slate-300 animate-slide-down">
            <div>
              <h3 className="text-base font-bold font-display text-ink">Add Entry Gate</h3>
              <p className="text-xs text-slate-500">Configure an additional access gate for this venue</p>
            </div>

            <form onSubmit={handleAddGateSubmit} className="space-y-3.5 text-xs">
              {gateError && (
                <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs">
                  {gateError}
                </div>
              )}
              <div>
                <label className="block text-ink font-bold mb-1">
                  Gate Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP East Gate or Gate 3"
                  value={additionalGateName}
                  onChange={(e) => setAdditionalGateName(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGateModal(false)}
                  className="editorial-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingGate || !additionalGateName.trim()}
                  className="editorial-btn-dark text-xs"
                >
                  {addingGate ? 'Adding...' : 'Add Gate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke/Reissue Modal */}
      {selectedTicketAction && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-card max-w-md w-full p-6 shadow-modal space-y-4 border border-slate-300 animate-slide-down">
            <h3 className="text-base font-bold font-display text-ink capitalize">
              {selectedTicketAction.action === 'revoke' ? 'Cancel Ticket' : 'Reissue Ticket'}
            </h3>
            <p className="text-xs text-slate-500">
              Target Ticket: <span className="font-mono font-bold text-ink">{selectedTicketAction.ticket.ticketNumber}</span>
            </p>

            {actionError && (
              <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs">
                {actionError}
              </div>
            )}

            <div className="text-xs">
              <label className="block text-ink font-bold mb-1">
                Reason *
              </label>
              <textarea
                required
                rows={3}
                placeholder="State reason for audit trail..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full p-2.5 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTicketAction(null)}
                className="editorial-btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionSubmitting || !actionReason.trim()}
                onClick={handleExecuteTicketAction}
                className="editorial-btn-dark text-xs"
              >
                {actionSubmitting ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Event Confirmation Modal */}
      {showDeleteEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-card max-w-md w-full p-6 shadow-modal border border-slate-300 space-y-4 animate-slide-down">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-crimson font-bold text-sm">
                <span>Delete Event</span>
              </div>
              <button
                onClick={() => setShowDeleteEventModal(false)}
                className="text-slate-400 hover:text-ink cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            {deleteError && (
              <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs">
                {deleteError}
              </div>
            )}

            <div className="bg-ivory border border-slate-200 rounded-btn p-3.5 text-xs space-y-1">
              <p className="text-slate-500 font-mono text-[10px] uppercase">Event Title:</p>
              <p className="font-bold text-ink text-sm">
                {events.find((e) => e.id === selectedEventId)?.title || 'Current Event'}
              </p>
              <p className="text-slate-500 text-[11px]">
                Capacity: {analytics?.capacity || 0} seats • Registered: {analytics?.summary?.approvedRegistrations || 0}
              </p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this event? This action will permanently remove the event, its ticket tiers, and gate records.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteEventModal(false)}
                className="editorial-btn-secondary text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedEvent}
                disabled={deletingEvent}
                className="px-4 py-2 rounded-btn bg-crimson text-white text-xs font-bold hover:bg-crimson/90 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash size={16} weight="regular" />
                <span>{deletingEvent ? 'Deleting...' : 'Confirm Delete Event'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Failed Registrant Modal */}
      {showScheduleFailedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-card max-w-lg w-full p-6 shadow-modal border border-slate-300 space-y-4 animate-slide-down">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-ink font-bold font-display text-sm">
                <span>Assisted Attendee Registration</span>
              </div>
              <button
                onClick={() => setShowScheduleFailedModal(false)}
                className="text-slate-400 hover:text-ink cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            {/* Assistance Banner */}
            <div className="bg-ivory border border-slate-200 rounded-btn p-3 text-xs text-slate-700 space-y-1">
              <div className="font-bold text-ink">
                <span>Assisted Attendee Registration</span>
              </div>
            </div>

            {schedulingError && (
              <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs flex items-center gap-2">
                <WarningCircle size={16} weight="fill" className="shrink-0" />
                <span>{schedulingError}</span>
              </div>
            )}

            {scheduledResult ? (
              <div className="space-y-4 text-xs py-2">
                <div className="p-4 bg-forest/10 border border-forest/20 rounded-btn text-forest space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle size={16} weight="fill" /> Pass Issued
                  </div>
                  <p className="text-xs text-slate-700">
                    Pass active for <span className="font-bold text-ink">{scheduledResult.registration.attendee.fullName}</span>.
                  </p>
                  <div className="pt-2 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600">
                    <div>Booking Ref: <span className="font-bold text-ink">{scheduledResult.registration.reference}</span></div>
                    <div>Ticket ID: <span className="font-bold text-ink">{scheduledResult.ticket.ticketNumber}</span></div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setScheduledResult(null);
                      setShowScheduleFailedModal(false);
                    }}
                    className="editorial-btn-secondary text-xs cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => window.open(`/ticket/${scheduledResult.ticket.id}`, '_blank')}
                    className="editorial-btn-dark text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Ticket size={16} weight="regular" />
                    <span>View / Print Issued Pass</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleScheduleFailedRegistrant} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-ink font-bold mb-1">
                    Attendee Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter attendee full name"
                    value={failedFullName}
                    onChange={(e) => setFailedFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                  />
                </div>

                <div>
                  <label className="block text-ink font-bold mb-1">
                    Attendee Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="attendee@example.com"
                    value={failedEmail}
                    onChange={(e) => setFailedEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-ink font-bold mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="+234 803 000 0000"
                      value={failedPhone}
                      onChange={(e) => setFailedPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                    />
                  </div>
                  <div>
                    <label className="block text-ink font-bold mb-1">
                      Ticket Tier
                    </label>
                    <select
                      value={failedTicketTypeId}
                      onChange={(e) => setFailedTicketTypeId(e.target.value)}
                      className="w-full px-3 py-2 rounded-btn border border-slate-300 bg-white text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                    >
                      <option value="">Default / Standard Attendee</option>
                      {events
                        .find((ev) => ev.id === selectedEventId)
                        ?.ticketTypes?.map((tt: any) => (
                          <option key={tt.id} value={tt.id}>
                            {tt.name} {tt.price > 0 ? `(₦${tt.price.toLocaleString()})` : '(Complimentary)'}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-ink font-bold mb-1">
                    Registration Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Assisted registration / on-site desk check-in"
                    value={failedReason}
                    onChange={(e) => setFailedReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScheduleFailedModal(false)}
                    className="editorial-btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      schedulingSubmitting ||
                      !failedFullName.trim() ||
                      !failedEmail.trim()
                    }
                    className="editorial-btn-dark text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Ticket size={16} weight="regular" />
                    <span>{schedulingSubmitting ? 'Issuing Pass...' : 'Issue Pass'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};