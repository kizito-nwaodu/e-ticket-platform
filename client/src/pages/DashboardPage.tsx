import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getEvents,
  getEventDashboard,
  getExportUrl,
  revokeTicket,
  reissueTicket,
  searchTickets,
} from '../services/api';
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
import { ArrowClockwise, FileCsv } from '@phosphor-icons/react';

export const DashboardPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Ticket Management & Reissue/Revoke
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [selectedTicketAction, setSelectedTicketAction] = useState<{
    ticket: any;
    action: 'revoke' | 'reissue';
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  useEffect(() => {
    getEvents().then((res) => {
      if (res.success && res.events.length > 0) {
        setEvents(res.events);
        const queryEvtId = searchParams.get('eventId');
        const defaultEvt = queryEvtId
          ? res.events.find((e: any) => e.id === queryEvtId) || res.events[0]
          : res.events[0];
        setSelectedEventId(defaultEvt.id);
      }
    });
  }, [searchParams]);

  const loadDashboardData = (evtId: string) => {
    if (!evtId) return;
    setLoading(true);
    Promise.all([getEventDashboard(evtId), searchTickets(evtId, '')])
      .then(([dashRes, ticketRes]) => {
        if (dashRes.success) setAnalytics(dashRes.data);
        if (ticketRes.success) setTicketsList(ticketRes.tickets);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedEventId) {
      loadDashboardData(selectedEventId);
    }
  }, [selectedEventId]);

  const handleExecuteTicketAction = async () => {
    if (!selectedTicketAction || !actionReason.trim()) return;
    setActionSubmitting(true);
    try {
      if (selectedTicketAction.action === 'revoke') {
        await revokeTicket(selectedTicketAction.ticket.id, actionReason.trim());
      } else {
        await reissueTicket(selectedTicketAction.ticket.id, actionReason.trim());
      }
      setSelectedTicketAction(null);
      setActionReason('');
      loadDashboardData(selectedEventId);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    if (!selectedEventId) return;
    window.open(getExportUrl(selectedEventId), '_blank');
  };

  if (loading && !analytics) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const s = analytics?.summary || {};

  return (
    <div className="space-y-8">
      {/* Top Header & Event Switcher */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono tracking-wider uppercase text-indigo-400 font-semibold">
            Analytics
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            Attendance Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadDashboardData(selectedEventId)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
            title="Refresh analytics data"
          >
            <ArrowClockwise size={16} weight="regular" />
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <FileCsv size={16} weight="regular" /> Export CSV Report
          </button>
        </div>
      </div>

      {/* Key Metric Cards Grid (Table 13 in Report) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Approved Registrations */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Approved Registrations</span>
          </div>
          <p className="text-3xl font-black text-slate-900">{s.approvedRegistrations || 0}</p>
          <p className="text-[11px] text-slate-400">Capacity: {analytics?.capacity || 0} seats</p>
        </div>

        {/* Checked-In Volume */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Checked-In Volume</span>
          </div>
          <p className="text-3xl font-black text-emerald-600">{s.checkedInAttendees || 0}</p>
          <p className="text-[11px] text-slate-400">{s.manualOverrides || 0} via supervisor override</p>
        </div>

        {/* Net Turnout Percentage */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Net Turnout Rate</span>
          </div>
          <p className="text-3xl font-black text-indigo-600">{s.attendanceRate || 0}%</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, s.attendanceRate || 0)}%` }}
            />
          </div>
        </div>

        {/* No-Show Volume */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">No-Show Attendees</span>
          </div>
          <p className="text-3xl font-black text-amber-600">{s.noShowCount || 0}</p>
          <p className="text-[11px] text-slate-400">Rate: {s.noShowRate || 0}%</p>
        </div>

        {/* Replay Fraud Blocks */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Replay Blocks</span>
          </div>
          <p className="text-3xl font-black text-rose-600">{s.repeatScanAttempts || 0}</p>
          <p className="text-[11px] text-slate-400">Prevented double-entry fraud</p>
        </div>
      </div>

      {/* Arrival Velocity & Gate Activity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Arrival Velocity Line Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Arrival Velocity
              </h3>
            </div>
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
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="checkIns"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    dot={{ fill: '#4f46e5', r: 4 }}
                    name="Admissions"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No check-ins recorded.
              </div>
            )}
          </div>
        </div>

        {/* Gate Activity Breakdown Bar Chart (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Gate Activity
            </h3>
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
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="admitted" fill="#10b981" name="Admitted" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rejected" fill="#f43f5e" name="Rejected" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No scans recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Management Table (Revoke / Reissue Lifecycle - FR-12) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Ticket Management
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Ticket Number</th>
                <th className="py-3 px-4">Attendee Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Issued At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ticketsList.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600">{t.ticketNumber}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {t.registration.attendee.fullName}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{t.registration.ticketType.name}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        t.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : t.status === 'used'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(t.issuedAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {t.status === 'active' && (
                      <button
                        onClick={() => setSelectedTicketAction({ ticket: t, action: 'revoke' })}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-semibold text-[11px]"
                      >
                        Revoke
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedTicketAction({ ticket: t, action: 'reissue' })}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold text-[11px]"
                    >
                      Reissue New Token
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revoke / Reissue Modal */}
      {selectedTicketAction && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 capitalize">
              {selectedTicketAction.action === 'revoke' ? 'Revoke Active Ticket' : 'Reissue Ticket Credential'}
            </h3>
            <p className="text-xs text-slate-500">
              Target Ticket: <span className="font-mono font-bold text-slate-900">{selectedTicketAction.ticket.ticketNumber}</span> (
              {selectedTicketAction.ticket.registration.attendee.fullName})
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mandatory Operational Reason *
              </label>
              <textarea
                required
                rows={3}
                placeholder="State reason for audit trail..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTicketAction(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionSubmitting || !actionReason.trim()}
                onClick={handleExecuteTicketAction}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md transition disabled:opacity-50 ${
                  selectedTicketAction.action === 'revoke'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {actionSubmitting ? 'Processing...' : 'Confirm & Log Audit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
