import React, { useEffect, useState } from 'react';
import { getAuditLogs } from '../services/api';
import { ArrowClockwise, Code, X } from '@phosphor-icons/react';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('');
  const [selectedMeta, setSelectedMeta] = useState<any | null>(null);

  const loadLogs = (action?: string) => {
    setLoading(true);
    getAuditLogs(action)
      .then((res) => {
        if (res.success) setLogs(res.logs || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLogs(filterAction);
  }, [filterAction]);

  const actions = [
    'EVENT_CREATED',
    'TICKET_ISSUED',
    'TICKET_REVOKED',
    'TICKET_REISSUED',
    'MANUAL_CHECKIN_OVERRIDE',
    'REPORT_EXPORTED',
    'USER_LOGIN',
    'REGISTRATION_CREATED',
    'SYSTEM_SEEDED',
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Auditor Header */}
      <div className="bg-[#0f172a] text-white rounded-xl border border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Audit Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Chronological log of administrative actions, gate validations, and overrides.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">All Actions</option>
            {actions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadLogs(filterAction)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            title="Refresh logs"
          >
            <ArrowClockwise size={16} weight="regular" />
          </button>
        </div>
      </div>

      {/* Log Entries Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-subtle">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-800" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs sm:text-sm font-mono">
            No audit records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-sans font-bold">Timestamp (WAT)</th>
                  <th className="py-3 px-4 font-sans font-bold">Security Action</th>
                  <th className="py-3 px-4 font-sans font-bold">Actor</th>
                  <th className="py-3 px-4 font-sans font-bold">Target Type</th>
                  <th className="py-3 px-4 font-sans font-bold">Target ID</th>
                  <th className="py-3 px-4 text-right font-sans font-bold">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(log.occurredAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-900">
                        {log.actor ? (
                          <div>
                            <p className="font-semibold text-xs">{log.actor.displayName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{log.actor.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic font-sans">System / Delegate</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-slate-700 text-xs">{log.targetType}</td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">
                        {log.targetId ? log.targetId.substring(0, 12) + '...' : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        {log.metadata && (
                          <button
                            onClick={() => setSelectedMeta(JSON.parse(log.metadata))}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                          >
                            <Code size={14} weight="regular" />
                            <span>Inspect</span>
                          </button>
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

      {/* JSON Metadata Viewer Modal */}
      {selectedMeta && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] text-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                Event Record Details
              </h3>
              <button
                onClick={() => setSelectedMeta(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs overflow-x-auto max-h-80">
              {JSON.stringify(selectedMeta, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedMeta(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
