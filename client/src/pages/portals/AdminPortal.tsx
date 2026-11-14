import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getEvents,
  getAuditLogs,
  listAllUsersApi,
  createUserWithRoleApi,
  assignUserRoleApi,
  createEvent,
  deleteEventApi,
  deleteUserApi,
  scheduleFailedRegistrantApi,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  X,
  Trash,
  ArrowClockwise,
  PencilSimple,
  MagnifyingGlass,
  Code,
  CheckCircle,
  WarningCircle,
  Ticket,
  UserPlus
} from '@phosphor-icons/react';

export const AdminPortal: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditCount, setAuditCount] = useState<number>(0);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilterAction, setAuditFilterAction] = useState<string>('');
  const [selectedMeta, setSelectedMeta] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'events' | 'audit'>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const modalTimerRef = useRef<number | null>(null);

  const clearModalTimer = useCallback(() => {
    if (modalTimerRef.current !== null) {
      window.clearTimeout(modalTimerRef.current);
      modalTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearModalTimer();
  }, [clearModalTimer]);

  const generateTemporaryPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 8; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `IU-${rand}!`;
  };

  // Modal 1: Provision New User
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provName, setProvName] = useState('');
  const [provEmail, setProvEmail] = useState('');
  const [provPassword, setProvPassword] = useState(() => generateTemporaryPassword());
  const [provRole, setProvRole] = useState('scanner_operator');
  const [provEventId, setProvEventId] = useState('');
  const [provSubmitting, setProvSubmitting] = useState(false);
  const [provError, setProvError] = useState('');
  const [provSuccess, setProvSuccess] = useState('');

  // Modal 2: Assign Additional Role to Existing User
  const [selectedUserForRole, setSelectedUserForRole] = useState<any | null>(null);
  const [assignRoleVal, setAssignRoleVal] = useState('supervisor');
  const [assignEventIdVal, setAssignEventIdVal] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');

  // Modal 3: Quick Event Creation
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evVenue, setEvVenue] = useState('');
  const [evStart, setEvStart] = useState('');
  const [evEnd, setEvEnd] = useState('');
  const [evCapacity, setEvCapacity] = useState('500');
  const [evSubmitting, setEvSubmitting] = useState(false);
  const [evError, setEvError] = useState('');

  // Delete User Modal State (NDPA 2023 Right to Erasure)
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [userDeleting, setUserDeleting] = useState(false);
  const [userDeleteError, setUserDeleteError] = useState<string | null>(null);

  // Delete Event Modal State
  const [eventToDelete, setEventToDelete] = useState<any | null>(null);
  const [eventDeleting, setEventDeleting] = useState(false);
  const [eventDeleteError, setEventDeleteError] = useState<string | null>(null);

  // Modal: Issue Pass on Behalf of Delegate
  const [showIssuePassModal, setShowIssuePassModal] = useState(false);
  const [issueEventId, setIssueEventId] = useState('');
  const [issueFullName, setIssueFullName] = useState('');
  const [issueEmail, setIssueEmail] = useState('');
  const [issuePhone, setIssuePhone] = useState('');
  const [issueTicketTypeId, setIssueTicketTypeId] = useState('');
  const [issueReason, setIssueReason] = useState('');
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueResult, setIssueResult] = useState<any | null>(null);

  const auditActions = [
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

  const reloadAuditLogs = useCallback(async (action?: string) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await getAuditLogs(action || undefined);
      if (res.success) {
        setAuditLogs(res.logs || []);
        if (!action) {
          setAuditCount(typeof res.total === 'number' ? res.total : res.logs?.length || 0);
        }
      }
    } catch (err: any) {
      setAuditError(err.message || 'Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [eventsResult, usersResult, auditResult] = await Promise.allSettled([
        getEvents(),
        listAllUsersApi(),
        getAuditLogs(auditFilterAction || undefined),
      ]);

      const errors: string[] = [];

      if (eventsResult.status === 'fulfilled' && eventsResult.value.success) {
        setEvents(eventsResult.value.events || []);
      } else if (eventsResult.status === 'rejected') {
        errors.push(eventsResult.reason?.message || 'Failed to load events');
      }

      if (usersResult.status === 'fulfilled' && usersResult.value.success) {
        setUsersList(usersResult.value.users || []);
      } else if (usersResult.status === 'rejected') {
        errors.push(usersResult.reason?.message || 'Failed to load user accounts');
      }

      if (auditResult.status === 'fulfilled' && auditResult.value.success) {
        setAuditLogs(auditResult.value.logs || []);
        if (!auditFilterAction) {
          setAuditCount(
            typeof auditResult.value.total === 'number'
              ? auditResult.value.total
              : auditResult.value.logs?.length || 0
          );
        }
      } else if (auditResult.status === 'rejected') {
        errors.push(auditResult.reason?.message || 'Failed to load audit logs');
      }

      if (errors.length > 0) {
        setLoadError(errors.join(' | '));
      }
    } finally {
      setLoading(false);
    }
  }, [auditFilterAction]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selectedMeta) {
        setSelectedMeta(null);
      } else if (userToDelete && !userDeleting) {
        setUserToDelete(null);
      } else if (eventToDelete && !eventDeleting) {
        setEventToDelete(null);
      } else if (showIssuePassModal && !issueSubmitting) {
        setShowIssuePassModal(false);
      } else if (showCreateEventModal && !evSubmitting) {
        setShowCreateEventModal(false);
      } else if (selectedUserForRole && !assignSubmitting) {
        clearModalTimer();
        setSelectedUserForRole(null);
      } else if (showProvisionModal && !provSubmitting) {
        clearModalTimer();
        setShowProvisionModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedMeta,
    userToDelete,
    userDeleting,
    eventToDelete,
    eventDeleting,
    showIssuePassModal,
    issueSubmitting,
    showCreateEventModal,
    evSubmitting,
    selectedUserForRole,
    assignSubmitting,
    showProvisionModal,
    provSubmitting,
    clearModalTimer,
  ]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provName.trim() || !provEmail.trim() || !provPassword) return;

    clearModalTimer();
    setProvSubmitting(true);
    setProvError('');
    setProvSuccess('');

    try {
      const res = await createUserWithRoleApi({
        displayName: provName.trim(),
        email: provEmail.trim(),
        password: provPassword,
        role: provRole,
        eventId: provEventId || undefined,
      });

      if (res.success) {
        setProvSuccess(`Account provisioned successfully for ${res.user.displayName}`);
        setProvName('');
        setProvEmail('');
        setProvPassword(generateTemporaryPassword());
        await loadData();
        modalTimerRef.current = window.setTimeout(() => {
          setShowProvisionModal(false);
          setProvSuccess('');
          modalTimerRef.current = null;
        }, 1500);
      }
    } catch (err: any) {
      setProvError(err.message || 'Failed to provision user');
    } finally {
      setProvSubmitting(false);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRole) return;

    clearModalTimer();
    setAssignSubmitting(true);
    setAssignError('');
    setAssignSuccess('');

    try {
      const res = await assignUserRoleApi({
        userId: selectedUserForRole.id,
        role: assignRoleVal,
        eventId: assignEventIdVal || undefined,
      });

      if (res.success) {
        setAssignSuccess(`Role granted to ${selectedUserForRole.displayName}`);
        await loadData();
        modalTimerRef.current = window.setTimeout(() => {
          setSelectedUserForRole(null);
          setAssignSuccess('');
          modalTimerRef.current = null;
        }, 1200);
      }
    } catch (err: any) {
      setAssignError(err.message || 'Failed to assign role');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleQuickCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim() || !evVenue.trim()) return;

    const parsedCapacity = parseInt(evCapacity, 10);
    if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1) {
      setEvError('Venue capacity must be at least 1.');
      return;
    }

    if (evStart && evEnd && new Date(evEnd) <= new Date(evStart)) {
      setEvError('End time must be after start time.');
      return;
    }

    setEvSubmitting(true);
    setEvError('');

    try {
      const now = new Date();
      const start = evStart ? new Date(evStart).toISOString() : new Date(now.getTime() + 3600000).toISOString();
      const end = evEnd ? new Date(evEnd).toISOString() : new Date(now.getTime() + 28800000).toISOString();

      const payload = {
        title: evTitle.trim(),
        description: evDesc.trim() || 'Institutional academic symposium & research presentation.',
        venue: evVenue.trim(),
        capacity: parsedCapacity,
        status: 'published',
        startAt: start,
        endAt: end,
        ticketTypes: [
          { name: 'Standard Delegate', price: 0, capacity: parsedCapacity },
        ],
        gates: [
          { name: 'Main Gate' },
          { name: 'Faculty & VIP Gate' },
        ],
      };

      const res = await createEvent(payload);
      if (res.success) {
        setEvTitle('');
        setEvDesc('');
        setEvVenue('');
        setEvStart('');
        setEvEnd('');
        setEvCapacity('500');
        setShowCreateEventModal(false);
        await loadData();
      }
    } catch (err: any) {
      setEvError(err.message || 'Failed to create event');
    } finally {
      setEvSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setUserDeleting(true);
    setUserDeleteError(null);
    try {
      const res = await deleteUserApi(userToDelete.id);
      if (res.success) {
        setUserToDelete(null);
        await loadData();
      }
    } catch (err: any) {
      setUserDeleteError(err.message || 'Failed to delete user');
    } finally {
      setUserDeleting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    setEventDeleting(true);
    setEventDeleteError(null);
    try {
      const res = await deleteEventApi(eventToDelete.id);
      if (res.success) {
        setEventToDelete(null);
        await loadData();
      }
    } catch (err: any) {
      setEventDeleteError(err.message || 'Failed to delete event');
    } finally {
      setEventDeleting(false);
    }
  };

  const handleIssuePass = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEventId = issueEventId || events[0]?.id;
    if (!targetEventId || !issueFullName.trim() || !issueEmail.trim()) {
      setIssueError('Please select an event and enter the attendee name and email.');
      return;
    }

    setIssueSubmitting(true);
    setIssueError(null);
    setIssueResult(null);

    try {
      const res = await scheduleFailedRegistrantApi(targetEventId, {
        fullName: issueFullName.trim(),
        email: issueEmail.trim(),
        phone: issuePhone.trim() || undefined,
        ticketTypeId: issueTicketTypeId || undefined,
        reason: issueReason.trim() || 'Assisted registration',
      });

      if (res.success && res.data) {
        setIssueResult(res.data);
        setIssueFullName('');
        setIssueEmail('');
        setIssuePhone('');
        setIssueReason('');
        await loadData();
      }
    } catch (err: any) {
      setIssueError(err.message || 'Failed to issue pass');
    } finally {
      setIssueSubmitting(false);
    }
  };

  const totalCapacity = useMemo(
    () => events.reduce((acc, e) => acc + (e.capacity || 0), 0),
    [events]
  );
  const totalRegistrations = useMemo(
    () => events.reduce((acc, e) => acc + (e._count?.registrations || 0), 0),
    [events]
  );
  const totalCheckIns = useMemo(
    () => events.reduce((acc, e) => acc + (e._count?.checkIns || 0), 0),
    [events]
  );

  const selectedIssueEvent = useMemo(() => {
    const activeId = issueEventId || events[0]?.id;
    return events.find((e) => e.id === activeId) || null;
  }, [events, issueEventId]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return usersList.filter((u) => {
      const matchesSearch =
        !q ||
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q);
      const matchesRole =
        roleFilter === 'ALL' ||
        u.roleAssignments?.some((ra: any) => ra.role === roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [usersList, searchQuery, roleFilter]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Editorial Admin Header */}
      <div className="editorial-card p-6 sm:p-8 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            Access Control & Systems Management
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              if (events.length > 0 && !events.some((e) => e.id === issueEventId)) {
                setIssueEventId(events[0].id);
                setIssueTicketTypeId('');
              }
              setIssueError(null);
              setIssueResult(null);
              setShowIssuePassModal(true);
            }}
            className="editorial-btn-dark text-xs inline-flex items-center gap-2 cursor-pointer"
          >
            <Ticket size={16} weight="regular" />
            <span>Issue Attendee Pass</span>
          </button>
          <button
            onClick={() => {
              clearModalTimer();
              setProvError('');
              setProvSuccess('');
              setProvPassword(generateTemporaryPassword());
              setShowProvisionModal(true);
            }}
            className="editorial-btn-secondary text-xs inline-flex items-center gap-2 cursor-pointer"
          >
            <UserPlus size={16} weight="regular" />
            <span>Provision Account</span>
          </button>
          <button
            onClick={() => {
              setEvError('');
              setShowCreateEventModal(true);
            }}
            className="editorial-btn-primary text-xs inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} weight="regular" />
            <span>Create Event</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div className="editorial-card p-4 bg-crimson/5 border border-crimson/20 flex items-center justify-between gap-3 text-xs text-crimson">
          <div className="flex items-center gap-2">
            <WarningCircle size={16} weight="fill" className="shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 rounded-btn bg-white border border-crimson/30 text-crimson font-semibold hover:bg-crimson/10 transition cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Global Metrics */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="editorial-card p-4 sm:p-5 bg-white space-y-2 animate-pulse">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-7 w-16 bg-slate-200 rounded" />
              <div className="h-3 w-32 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="editorial-card p-4 sm:p-5 bg-white space-y-1">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
            Provisioned Accounts
          </span>
          <p className="text-xl sm:text-2xl font-bold font-display tracking-tight text-ink">
            {usersList.length}
          </p>
          <p className="text-[11px] text-slate-500">Verified institutional users</p>
        </div>

        <div className="editorial-card p-4 sm:p-5 bg-white space-y-1">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
            Active Events
          </span>
          <p className="text-xl sm:text-2xl font-bold font-display tracking-tight text-ink">
            {events.length}
          </p>
          <p className="text-[11px] text-slate-500">Capacity: {totalCapacity.toLocaleString()} seats</p>
        </div>

        <div className="editorial-card p-4 sm:p-5 bg-white space-y-1">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
            Total Check-Ins
          </span>
          <p className="text-xl sm:text-2xl font-bold font-display tracking-tight text-ink">
            {totalCheckIns}
          </p>
          <p className="text-[11px] text-slate-500">
            of {totalRegistrations.toLocaleString()} registered
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveTab('audit');
            const el = document.getElementById('audit-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="editorial-card p-4 sm:p-5 bg-white space-y-1 text-left hover:border-slate-300 transition cursor-pointer"
        >
          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
            Audit Ledger
          </span>
          <p className="text-xl sm:text-2xl font-bold font-display tracking-tight text-ink">
            {auditCount}
          </p>
          <p className="text-[11px] text-slate-500">
            View Security Trail
          </p>
        </button>
      </div>
      )}

      {/* Navigation Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {(['all', 'users', 'events', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-btn text-xs font-semibold capitalize transition cursor-pointer ${
              activeTab === tab
                ? 'bg-ink text-white shadow-subtle'
                : 'bg-white text-slate-600 hover:text-ink hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab === 'all'
              ? 'All Sections'
              : tab === 'audit'
              ? 'Audit Ledger'
              : tab}
          </button>
        ))}
      </div>

      {/* User Accounts Management Section */}
      {(activeTab === 'all' || activeTab === 'users') && (
        <div className="editorial-card bg-white overflow-hidden shadow-subtle space-y-4 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold font-display text-ink">
                Account Directory &amp; Access Roles
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage user accounts, system access and role permissions.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative">
                <MagnifyingGlass size={16} weight="regular" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-7 py-1.5 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine transition w-full sm:w-56"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink cursor-pointer"
                    title="Clear search"
                  >
                    <X size={14} weight="regular" />
                  </button>
                )}
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-btn border border-slate-300 bg-white text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-tangerine transition"
              >
                <option value="ALL">All Roles</option>
                <option value="admin">Platform Admin</option>
                <option value="organiser">Organiser</option>
                <option value="supervisor">Gate Supervisor</option>
                <option value="scanner_operator">Scanner Operator</option>
                <option value="auditor">Auditor</option>
                <option value="attendee">Attendee</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ivory/60 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-bold">User</th>
                  <th className="py-2.5 px-3 font-bold">Role Privileges</th>
                  <th className="py-2.5 px-3 font-bold">Created</th>
                  <th className="py-2.5 px-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-ink">{u.displayName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roleAssignments?.map((ra: any, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-ivory text-ink border border-slate-200"
                            >
                              {ra.role.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedUserForRole(u);
                              setAssignError('');
                              setAssignSuccess('');
                            }}
                            className="editorial-btn-secondary text-[11px] py-1 px-2.5 inline-flex items-center gap-1"
                          >
                            <span>Assign Role</span>
                          </button>
                          <button
                            onClick={() => {
                              setUserToDelete(u);
                              setUserDeleteError(null);
                            }}
                            disabled={u.id === user?.id}
                            className={`p-1.5 rounded-btn transition ${
                              u.id === user?.id
                                ? 'text-slate-200 cursor-not-allowed'
                                : 'hover:bg-crimson/10 text-slate-400 hover:text-crimson cursor-pointer'
                            }`}
                            title={
                              u.id === user?.id
                                ? 'Cannot delete your own active session'
                                : 'Delete Account'
                            }
                          >
                            <Trash size={16} weight="regular" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Events Portfolio Section */}
      {(activeTab === 'all' || activeTab === 'events') && (
        <div className="editorial-card bg-white overflow-hidden shadow-subtle space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold font-display text-ink">
                Managed Event Portfolio
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Current university sessions, capacity, and gate configuration.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {events.length} Live Sessions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ivory/60 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-bold">Event Title</th>
                  <th className="py-2.5 px-3 font-bold">Venue</th>
                  <th className="py-2.5 px-3 font-bold">Capacity</th>
                  <th className="py-2.5 px-3 font-bold">Gates</th>
                  <th className="py-2.5 px-3 font-bold text-right">Admitted / Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                      {loading ? 'Loading events...' : 'No events configured yet.'}
                    </td>
                  </tr>
                ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-semibold text-ink">{evt.title}</td>
                    <td className="py-3 px-3 text-slate-600">{evt.venue}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{evt.capacity}</td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {evt.gates?.map((g: any) => g.name).join(', ') || 'Main Entrance'}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono font-bold text-ink">
                          {evt._count?.checkIns || 0} / {evt._count?.registrations || 0}
                        </span>
                        <button
                          onClick={() => {
                            setEventToDelete(evt);
                            setEventDeleteError(null);
                          }}
                          className="p-1.5 rounded-btn hover:bg-crimson/10 text-slate-400 hover:text-crimson transition cursor-pointer"
                          title="Delete Event"
                        >
                          <Trash size={16} weight="regular" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Section Container */}
      {(activeTab === 'all' || activeTab === 'audit') && (
        <div id="audit-section" className="editorial-card bg-white overflow-hidden shadow-subtle space-y-4 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold font-display text-ink">
                System Audit Log
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Record of administrative actions, entry overrides, and role updates.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditFilterAction}
                onChange={(e) => {
                  const act = e.target.value;
                  setAuditFilterAction(act);
                  reloadAuditLogs(act);
                }}
                className="px-2.5 py-1.5 rounded-btn border border-slate-300 bg-white text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-tangerine transition"
              >
                <option value="">All Security Events</option>
                {auditActions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>

              <button
                onClick={() => reloadAuditLogs(auditFilterAction)}
                disabled={auditLoading}
                className="p-1.5 rounded-btn border border-slate-300 bg-ivory text-ink hover:bg-slate-200 transition cursor-pointer disabled:opacity-60"
                title="Refresh logs"
              >
                <ArrowClockwise size={16} weight="regular" className={`text-slate-600 ${auditLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {auditError && (
            <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs flex items-center gap-2">
              <WarningCircle size={16} weight="fill" className="shrink-0" />
              <span>{auditError}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ivory/60 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-bold">Timestamp</th>
                  <th className="py-2.5 px-3 font-bold">Action</th>
                  <th className="py-2.5 px-3 font-bold">Actor</th>
                  <th className="py-2.5 px-3 font-bold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLoading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                      Refreshing audit ledger...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                      No audit events match the selected filter.
                    </td>
                  </tr>
                ) : (
                auditLogs.slice(0, activeTab === 'audit' ? 50 : 15).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.occurredAt || log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-ivory text-ink border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-ink">
                      {log.actor?.displayName || log.user?.displayName || 'System Kernel'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {log.metadata && (
                        <button
                          onClick={() => {
                            try {
                              const parsed = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
                              setSelectedMeta(parsed);
                            } catch {
                              setSelectedMeta(log.metadata);
                            }
                          }}
                          className="editorial-btn-secondary text-[11px] py-1 px-2 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Code size={14} weight="regular" />
                          <span>Inspect</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Provision New User */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-card max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-modal border border-slate-300 space-y-4 animate-slide-down">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-ink font-bold font-display text-sm">
                <span>Provision User Account</span>
              </div>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="text-slate-400 hover:text-ink cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            {provError && (
              <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs flex items-center gap-2">
                <WarningCircle size={16} weight="fill" className="shrink-0" />
                <span>{provError}</span>
              </div>
            )}

            {provSuccess && (
              <div className="p-3 bg-forest/10 border border-forest/20 text-forest rounded-btn text-xs flex items-center gap-2">
                <CheckCircle size={16} weight="fill" className="shrink-0" />
                <span>{provSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-ink font-bold mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter full legal name"
                  value={provName}
                  onChange={(e) => setProvName(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
              </div>

              <div>
                <label className="block text-ink font-bold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="user@iconic.edu.ng"
                  value={provEmail}
                  onChange={(e) => setProvEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-ink font-bold">Temporary Password</label>
                  <button
                    type="button"
                    onClick={() => setProvPassword(generateTemporaryPassword())}
                    className="text-[11px] text-tangerine hover:underline flex items-center gap-1 font-mono cursor-pointer"
                  >
                    <ArrowClockwise size={14} weight="regular" />
                    <span>Generate Fresh</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={provPassword}
                  onChange={(e) => setProvPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine bg-ivory/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink font-bold mb-1">Assigned Role</label>
                  <select
                    value={provRole}
                    onChange={(e) => setProvRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 bg-white text-ink text-xs focus:outline-none focus:ring-2 focus:ring-tangerine"
                  >
                    <option value="scanner_operator">Scanner Operator</option>
                    <option value="supervisor">Gate Supervisor</option>
                    <option value="organiser">Event Organiser</option>
                    <option value="auditor">Auditor</option>
                    <option value="admin">Platform Admin</option>
                    <option value="attendee">Attendee / Delegate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-ink font-bold mb-1">Event Scope</label>
                  <select
                    value={provEventId}
                    onChange={(e) => setProvEventId(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 bg-white text-ink text-xs focus:outline-none focus:ring-2 focus:ring-tangerine"
                  >
                    <option value="">All Events (Global)</option>
                    {events.map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="editorial-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provSubmitting}
                  className="editorial-btn-dark text-xs"
                >
                  {provSubmitting ? 'Provisioning...' : 'Confirm Provisioning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Assign Additional Role */}
      {selectedUserForRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-card max-w-md w-full p-6 shadow-modal border border-slate-300 space-y-4 animate-slide-down">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-ink font-bold font-display text-sm">
                <span>Assign Additional Role</span>
              </div>
              <button
                onClick={() => setSelectedUserForRole(null)}
                className="text-slate-400 hover:text-ink cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            <div className="bg-ivory p-3 rounded-btn border border-slate-200 text-xs">
              <div className="text-slate-500 font-mono text-[10px] uppercase">Target User:</div>
              <div className="font-bold text-ink">{selectedUserForRole.displayName}</div>
              <div className="text-slate-500 text-[11px] font-mono">{selectedUserForRole.email}</div>
            </div>

            {assignError && (
              <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs">
                {assignError}
              </div>
            )}

            {assignSuccess && (
              <div className="p-3 bg-forest/10 border border-forest/20 text-forest rounded-btn text-xs">
                {assignSuccess}
              </div>
            )}

            <form onSubmit={handleAssignRole} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-ink font-bold mb-1">New Role to Grant</label>
                <select
                  value={assignRoleVal}
                  onChange={(e) => setAssignRoleVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 bg-white text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                >
                  <option value="scanner_operator">Scanner Operator</option>
                  <option value="supervisor">Gate Supervisor</option>
                  <option value="organiser">Event Organiser</option>
                  <option value="auditor">Auditor</option>
                  <option value="admin">Platform Admin</option>
                  <option value="attendee">Attendee / Delegate</option>
                </select>
              </div>

              <div>
                <label className="block text-ink font-bold mb-1">Event Scope (Optional)</label>
                <select
                  value={assignEventIdVal}
                  onChange={(e) => setAssignEventIdVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 bg-white text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                >
                  <option value="">All Events (Platform-wide)</option>
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForRole(null)}
                  className="editorial-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting}
                  className="editorial-btn-dark text-xs"
                >
                  {assignSubmitting ? 'Granting...' : 'Grant Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Create Fresh Event */}
      {showCreateEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-card max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-modal border border-slate-300 space-y-4 animate-slide-down">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-ink font-bold font-display text-sm">
                <span>Create Fresh Event</span>
              </div>
              <button
                onClick={() => setShowCreateEventModal(false)}
                className="text-slate-400 hover:text-ink cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            {evError && (
              <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs">
                {evError}
              </div>
            )}

            <form onSubmit={handleQuickCreateEvent} className="space-y-3 text-xs">
              <div>
                <label className="block text-ink font-bold mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Iconic Open University AI Research Conference"
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
              </div>

              <div>
                <label className="block text-ink font-bold mb-1">Venue Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Amphitheatre, Iconic Campus, Abuja"
                  value={evVenue}
                  onChange={(e) => setEvVenue(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
              </div>

              <div>
                <label className="block text-ink font-bold mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Session summary and objective..."
                  value={evDesc}
                  onChange={(e) => setEvDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink font-bold mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={evStart}
                    onChange={(e) => setEvStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={evEnd}
                    onChange={(e) => setEvEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink font-bold mb-1">Venue Capacity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={evCapacity}
                  onChange={(e) => setEvCapacity(e.target.value)}
                  className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className="editorial-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={evSubmitting}
                  className="editorial-btn-dark text-xs"
                >
                  {evSubmitting ? 'Creating Event...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete User Account Confirmation */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-card max-w-md w-full p-6 shadow-modal border border-slate-300 space-y-4 animate-slide-down">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-crimson font-bold text-sm">
                <span>Delete User Account</span>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="text-slate-400 hover:text-ink cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            {userDeleteError && (
              <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs">
                {userDeleteError}
              </div>
            )}

            <div className="bg-ivory border border-slate-200 rounded-btn p-3.5 text-xs space-y-1">
              <p className="text-slate-500 font-mono text-[10px] uppercase">Account Name:</p>
              <p className="font-bold text-ink text-sm">{userToDelete.displayName}</p>
              <p className="text-slate-500 text-[11px] font-mono">{userToDelete.email}</p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Confirm account deletion. Under <span className="font-semibold text-ink">NDPA 2023 Section 34 (Right to Erasure)</span>, this will permanently remove the user credentials and associated role privileges.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="editorial-btn-secondary text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={userDeleting}
                className="px-4 py-2 rounded-btn bg-crimson text-white text-xs font-bold hover:bg-crimson/90 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash size={16} weight="regular" />
                <span>{userDeleting ? 'Deleting...' : 'Confirm Delete Account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Delete Event Confirmation */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-card max-w-md w-full p-6 shadow-modal border border-slate-300 space-y-4 animate-slide-down">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-crimson font-bold text-sm">
                <span>Delete Event Record</span>
              </div>
              <button
                onClick={() => setEventToDelete(null)}
                className="text-slate-400 hover:text-ink cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            {eventDeleteError && (
              <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs">
                {eventDeleteError}
              </div>
            )}

            <div className="bg-ivory border border-slate-200 rounded-btn p-3.5 text-xs space-y-1">
              <p className="text-slate-500 font-mono text-[10px] uppercase">Event Title:</p>
              <p className="font-bold text-ink text-sm">{eventToDelete.title}</p>
              <p className="text-slate-500 text-[11px]">Venue: {eventToDelete.venue}</p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this event? This action will permanently remove the event, its ticket tiers, and gate records.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                className="editorial-btn-secondary text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEvent}
                disabled={eventDeleting}
                className="px-4 py-2 rounded-btn bg-crimson text-white text-xs font-bold hover:bg-crimson/90 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash size={16} weight="regular" />
                <span>{eventDeleting ? 'Deleting...' : 'Confirm Delete Event'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Issue Pass on Behalf of Delegate */}
      {showIssuePassModal && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-card max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-modal space-y-4 border border-slate-200 animate-slide-down">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold font-display text-ink">
                <span>Issue Attendee Pass</span>
              </h3>
              <button
                onClick={() => {
                  setShowIssuePassModal(false);
                  setIssueResult(null);
                  setIssueError(null);
                }}
                className="text-slate-400 hover:text-ink cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            <div className="bg-ivory border border-slate-200 rounded-btn p-3 text-xs text-slate-700 space-y-1">
              <div className="font-bold text-ink">
                <span>Administrative Attendee Registration</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Issue an admission pass on behalf of an attendee directly into the registry.
              </p>
            </div>

            {issueError && (
              <div className="p-3 bg-crimson/10 border border-crimson/20 text-crimson rounded-btn text-xs flex items-center gap-2">
                <WarningCircle size={16} weight="fill" className="shrink-0" />
                <span>{issueError}</span>
              </div>
            )}

            {issueResult ? (
              <div className="space-y-4 text-xs py-2">
                <div className="p-4 bg-forest/10 border border-forest/20 rounded-btn text-forest space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle size={16} weight="fill" /> Pass Issued
                  </div>
                  <p className="text-xs text-slate-700">
                    Pass issued for <span className="font-bold text-ink">{issueResult.registration?.attendee?.fullName}</span>.
                  </p>
                  <div className="pt-2 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600">
                    <div>Booking Ref: <span className="font-bold text-ink">{issueResult.registration?.reference}</span></div>
                    <div>Ticket ID: <span className="font-bold text-ink">{issueResult.ticket?.ticketNumber}</span></div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setIssueResult(null);
                      setShowIssuePassModal(false);
                    }}
                    className="editorial-btn-secondary text-xs cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => window.open(`/ticket/${issueResult.ticket.id}`, '_blank')}
                    className="editorial-btn-dark text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Ticket size={16} weight="regular" />
                    <span>View / Print Issued Pass</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleIssuePass} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-ink font-bold mb-1">
                    Select Target Event *
                  </label>
                  <select
                    value={issueEventId || (events[0]?.id || '')}
                    onChange={(e) => {
                      setIssueEventId(e.target.value);
                      setIssueTicketTypeId('');
                    }}
                    disabled={events.length === 0}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 bg-white text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine font-medium disabled:bg-slate-100"
                  >
                    {events.length === 0 ? (
                      <option value="">No active events available</option>
                    ) : (
                      events.map((evt) => (
                        <option key={evt.id} value={evt.id}>
                          {evt.title} ({evt.venue})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-ink font-bold mb-1">
                    Attendee Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter attendee full name"
                    value={issueFullName}
                    onChange={(e) => setIssueFullName(e.target.value)}
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
                    value={issueEmail}
                    onChange={(e) => setIssueEmail(e.target.value)}
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
                      value={issuePhone}
                      onChange={(e) => setIssuePhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                    />
                  </div>
                  <div>
                    <label className="block text-ink font-bold mb-1">
                      Ticket Tier
                    </label>
                    <select
                      value={issueTicketTypeId}
                      onChange={(e) => setIssueTicketTypeId(e.target.value)}
                      className="w-full px-3 py-2 rounded-btn border border-slate-300 bg-white text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                    >
                      <option value="">Default / Standard Attendee</option>
                      {selectedIssueEvent?.ticketTypes?.map((tt: any) => (
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
                    placeholder="e.g. Assisted on-site registration"
                    value={issueReason}
                    onChange={(e) => setIssueReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn border border-slate-300 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-tangerine"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowIssuePassModal(false)}
                    className="editorial-btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={issueSubmitting || events.length === 0 || !issueFullName.trim() || !issueEmail.trim()}
                    className="editorial-btn-dark text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Ticket size={16} weight="regular" />
                    <span>{issueSubmitting ? 'Issuing Pass...' : 'Issue Pass'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 6: Structured Cryptographic Payload Modal */}
      {selectedMeta && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-ink text-white rounded-card max-w-lg w-full p-6 shadow-modal space-y-4 border border-slate-700 animate-slide-down">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-mono font-bold flex items-center gap-2 text-tangerine uppercase tracking-wider">
                <Code size={16} weight="regular" /> Payload Inspector
              </h3>
              <button
                onClick={() => setSelectedMeta(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>
            <pre className="p-4 rounded-btn bg-ink-light border border-slate-800 text-emerald-400 font-mono text-xs overflow-x-auto max-h-72">
              {JSON.stringify(selectedMeta, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};