import React, { useEffect, useState } from 'react';
import { getAuditLogs } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowClockwise,
  Code,
  X
} from '@phosphor-icons/react';

export const AuditorPortal: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('');
  const [selectedMeta, setSelectedMeta] = useState<any | null>(null);

  const loadLogs = (action?: string) => {
    setLoading(true);
    setError(null);
    getAuditLogs(action || undefined)
      .then((res) => {
        if (res.success) setLogs(res.logs || []);
      })
      .catch((err: any) => setError(err.message || 'Failed to load audit logs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLogs(filterAction);
  }, [filterAction]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedMeta) setSelectedMeta(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedMeta]);

  const actions = [
    'ALL',
    'EVENT_CREATED',
    'EVENT_STATUS_UPDATED',
    'EVENT_DELETED',
    'GATE_ADDED',
    'TICKET_ISSUED',
    'TICKET_REVOKED',
    'TICKET_REISSUED',
    'MANUAL_CHECKIN_OVERRIDE',
    'REPORT_EXPORTED',
    'USER_LOGIN',
    'USER_PROVISIONED',
    'USER_DELETED',
    'ROLE_ASSIGNED',
    'ATTENDEE_ACCOUNT_CREATED',
    'REGISTRATION_CREATED',
    'FAILED_REGISTRANT_ASSISTED',
  ];

  const getActionBadgeClass = (action: string) => {
    if (action.includes('OVERRIDE') || action.includes('REVOKED')) {
      return 'bg-crimson/10 text-crimson border-crimson/20';
    }
    if (action.includes('ISSUED') || action.includes('CREATED') || action.includes('ASSIGNED')) {
      return 'bg-forest/10 text-forest border-forest/20';
    }
    return 'bg-ivory text-ink border-slate-200';
  };

  const parseMetadata = (meta: any) => {
    if (!meta) return null;
    if (typeof meta === 'object') return meta;
    try {
      return JSON.parse(meta);
    } catch {
      return { raw: meta };
    }
  };

  const formatLogDate = (rawDate: any) => {
    if (!rawDate) return '—';
    const dt = new Date(rawDate);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Editorial Auditor Header */}
      <div className="editorial-card p-6 sm:p-8 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            Audit Ledger
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadLogs(filterAction || undefined)}
            disabled={loading}
            className="editorial-btn-secondary text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
            title="Refresh Ledger"
          >
            <ArrowClockwise size={16} weight="regular" className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="editorial-card p-4 bg-crimson/5 border border-crimson/20 text-xs text-crimson flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={() => loadLogs(filterAction || undefined)}
            className="px-3 py-1 rounded-btn bg-white border border-crimson/30 font-semibold hover:bg-crimson/10 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Chips Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {actions.map((act) => {
          const isSelected = (act === 'ALL' && !filterAction) || filterAction === act;
          return (
            <button
              key={act}
              onClick={() => setFilterAction(act === 'ALL' ? '' : act)}
              className={`px-3 py-1.5 rounded-btn text-xs font-mono font-medium whitespace-nowrap transition cursor-pointer ${
                isSelected
                  ? 'bg-ink text-white shadow-subtle'
                  : 'bg-white text-slate-600 hover:text-ink hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {act}
            </button>
          );
        })}
      </div>

      {/* Ledger Table Container */}
      <div className="editorial-card bg-white overflow-hidden shadow-subtle">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold font-display text-ink">
            <span>System Activity Records</span>
          </h2>
          <span className="text-xs font-mono text-slate-500">
            {logs.length} records
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-tangerine" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No audit records match the selected action filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ivory/60 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4 font-bold">Timestamp</th>
                  <th className="py-3 px-4 font-bold">Action Type</th>
                  <th className="py-3 px-4 font-bold">Actor</th>
                  <th className="py-3 px-4 font-bold">Target Entity</th>
                  <th className="py-3 px-4 font-bold text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {logs.map((log) => {
                  const dateStr = formatLogDate(log.occurredAt || log.createdAt);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getActionBadgeClass(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-ink whitespace-nowrap">
                        {log.actor?.displayName || log.actor?.email || 'System Kernel'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {log.targetType ? `${log.targetType} · ${log.targetId?.slice(0, 8)}...` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {log.metadata ? (
                          <button
                            onClick={() => setSelectedMeta(log)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-btn bg-ivory hover:bg-slate-200 text-ink text-[11px] font-mono transition cursor-pointer border border-slate-200"
                          >
                            <Code size={14} weight="regular" />
                            <span>Inspect</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payload Modal */}
      {selectedMeta && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-card max-w-lg w-full border border-slate-300 shadow-modal overflow-hidden animate-slide-down">
            <div className="p-4 sm:p-5 bg-ink text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-tangerine uppercase font-bold">
                  LEDGER PAYLOAD INSPECTOR
                </span>
                <h3 className="text-sm font-bold font-display mt-0.5">
                  Action: {selectedMeta.action}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMeta(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>Record ID: {selectedMeta.id?.slice(0, 12)}...</span>
                <span>{formatLogDate(selectedMeta.occurredAt || selectedMeta.createdAt)}</span>
              </div>

              <div className="bg-slate-900 rounded-btn p-3.5 overflow-x-auto text-emerald-400 font-mono text-[11px] max-h-80 leading-relaxed">
                <pre>{JSON.stringify(parseMetadata(selectedMeta.metadata), null, 2)}</pre>
              </div>
            </div>

            <div className="p-4 bg-ivory border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedMeta(null)}
                className="editorial-btn-dark text-xs cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};