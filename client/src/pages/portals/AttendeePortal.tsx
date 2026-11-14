import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { getMyTickets } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  QrCode,
  Printer,
  X,
  CheckCircle,
  Clock,
  WarningCircle
} from '@phosphor-icons/react';

export const AttendeePortal: React.FC = () => {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'admitted'>('all');

  // Modal State for Large High-Contrast Viewport
  const [activeTicketModal, setActiveTicketModal] = useState<{
    ticket: any;
    event: any;
    attendeeName: string;
  } | null>(null);
  const [modalQrUrl, setModalQrUrl] = useState<string | null>(null);

  const loadTickets = () => {
    setLoading(true);
    setLoadError(null);
    getMyTickets()
      .then((res) => {
        if (res.success) {
          setRegistrations(res.registrations || []);
        }
      })
      .catch((err: any) => setLoadError(err.message || 'Failed to load your passes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    loadTickets();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeTicketModal) closeModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTicketModal]);

  const openQrModal = async (ticket: any, event: any, attendeeName: string) => {
    setActiveTicketModal({ ticket, event, attendeeName });

    // Custom boarding-pass standard: encode ONLY the ticket_code (ticketNumber) inside the QR code
    const qrPayload = ticket?.ticketNumber || ticket?.token || ticket?.plainToken || ticket?.tokenHash || 'PASS';

    try {
      const url = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'M',
        margin: 3,
        scale: 10,
        color: { dark: '#111827', light: '#ffffff' },
      });
      setModalQrUrl(url);
    } catch (err) {
      console.error('Failed to render QR code:', err);
    }
  };

  const closeModal = () => {
    setActiveTicketModal(null);
    setModalQrUrl(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredRegistrations = registrations.filter((reg) => {
    const ticket = reg.tickets?.[0];
    const isCheckedIn = Boolean(ticket?.checkIn);
    const isPastEvent = new Date(reg.event.endAt) < new Date();
    if (filterTab === 'active') return !isCheckedIn && ticket?.status === 'active' && !isPastEvent;
    if (filterTab === 'admitted') return isCheckedIn || ticket?.status === 'used' || isPastEvent;
    return true;
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className={activeTicketModal ? 'no-print space-y-8' : 'space-y-8'}>
        {/* Wallet Header */}
        <div className="editorial-card p-6 sm:p-8 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold font-display tracking-tight text-ink">
              My Event Passes
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Event passes registered to <span className="font-semibold text-ink">{user?.email}</span>
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-1.5 rounded-btn text-xs font-semibold transition cursor-pointer ${filterTab === 'all'
                ? 'bg-ink text-white'
                : 'bg-white text-slate-600 hover:text-ink border border-slate-200'
              }`}
          >
            All Passes ({registrations.length})
          </button>
          <button
            onClick={() => setFilterTab('active')}
            className={`px-3.5 py-1.5 rounded-btn text-xs font-semibold transition cursor-pointer ${filterTab === 'active'
                ? 'bg-ink text-white'
                : 'bg-white text-slate-600 hover:text-ink border border-slate-200'
              }`}
          >
            Active Passes
          </button>
          <button
            onClick={() => setFilterTab('admitted')}
            className={`px-3.5 py-1.5 rounded-btn text-xs font-semibold transition cursor-pointer ${filterTab === 'admitted'
                ? 'bg-ink text-white'
                : 'bg-white text-slate-600 hover:text-ink border border-slate-200'
              }`}
          >
            Past Events
          </button>
        </div>

        {/* Main Grid */}
        {loadError && (
          <div className="editorial-card p-4 bg-crimson/5 border border-crimson/20 text-xs text-crimson flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button
              onClick={loadTickets}
              className="px-3 py-1 rounded-btn bg-white border border-crimson/30 font-semibold hover:bg-crimson/10 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-tangerine" />
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="editorial-card p-12 text-center space-y-3 bg-white">
            <h2 className="text-base font-bold font-display text-ink">No Passes Found</h2>
            <Link to="/" className="editorial-btn-dark inline-block text-xs mt-1">
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {filteredRegistrations.map((reg) => {
              const ticket = reg.tickets?.[0];
              const isCheckedIn = Boolean(ticket?.checkIn);
              const isRevoked = ticket?.status === 'revoked';
              const isPast = new Date(reg.event.endAt) < new Date();
              const isActive = ticket?.status === 'active' && !isCheckedIn && !isPast;

              const evtDate = new Date(reg.event.startAt);

              return (
                <div
                  key={reg.id}
                  className="editorial-card overflow-hidden bg-white flex flex-col justify-between hover:shadow-elevated transition duration-200"
                >
                  {/* Physical Ticket Pass Stub Header */}
                  <div className="bg-ink text-white p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src="/iconic-logo.png"
                          alt="Iconic Open University"
                          className="h-6 w-auto object-contain"
                        />
                        <span className="text-[10px] font-mono tracking-wider text-slate-300 uppercase font-bold">
                          Pass
                        </span>
                      </div>

                      {/* Status Stamp */}
                      {isActive && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-badge text-[10px] font-mono uppercase font-bold bg-forest text-white">
                          <CheckCircle size={13} weight="fill" /> Valid for Entry
                        </span>
                      )}
                      {isCheckedIn && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-badge text-[10px] font-mono uppercase font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          <Clock size={13} weight="regular" /> Admitted / Used
                        </span>
                      )}
                      {isPast && !isCheckedIn && !isRevoked && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-badge text-[10px] font-mono uppercase font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          <Clock size={13} weight="regular" className="text-slate-400" /> Event Concluded
                        </span>
                      )}
                      {isRevoked && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-badge text-[10px] font-mono uppercase font-bold bg-crimson text-white">
                          <WarningCircle size={13} weight="fill" /> Ticket Cancelled
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-tangerine tracking-wider font-semibold">
                        {reg.ticketType.name}
                      </span>
                      <h3 className="text-base font-bold font-display text-white leading-snug mt-0.5">
                        {reg.event.title}
                      </h3>
                    </div>

                    <div className="space-y-1 text-xs text-slate-300 pt-1 font-sans">
                      <div>
                        <span className="text-slate-400 font-mono uppercase mr-1.5 text-[10px]">Venue:</span>
                        <span className="truncate">{reg.event.venue}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono uppercase mr-1.5 text-[10px]">Date:</span>
                        <span>
                          {evtDate.toLocaleString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ticket Details & Tear-line */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between text-xs py-2 px-3 rounded-card bg-ivory border border-slate-200">
                      <div>
                        <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">Pass Code</span>
                        <span className="font-mono font-semibold text-ink tracking-wider tabular-nums">{ticket?.ticketNumber || 'PENDING'}</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">Reg Code</span>
                        <span className="font-mono font-semibold text-slate-700 tracking-wider tabular-nums">{reg.reference}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-1">
                      {ticket && (
                        <button
                          type="button"
                          onClick={() => {
                            const attendeeName = reg.attendee?.fullName || user?.displayName || 'Attendee';
                            openQrModal(ticket, reg.event, attendeeName);
                          }}
                          className="w-full py-2.5 px-4 rounded-btn bg-tangerine hover:bg-tangerine-hover text-white text-xs font-bold flex items-center justify-center gap-2 shadow-subtle transition cursor-pointer"
                        >
                          <QrCode size={18} weight="regular" />
                          <span>View & Present Pass</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* HIGH-CONTRAST FULL-SCREEN QR ADMISSION MODAL */}
      {activeTicketModal && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="printable-ticket bg-white rounded-2xl border border-slate-300 max-w-sm w-full overflow-hidden shadow-modal animate-scale-in">
            {/* Modal Header */}
            <div className="bg-ink text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-tangerine font-bold">
                  GATE PRESENTATION PASS
                </span>
                <h3 className="text-sm font-bold text-white truncate max-w-[240px]">
                  {activeTicketModal.event.title}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-full bg-ink-light text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            {/* QR Viewport with Solid White Quiet Zone */}
            <div className="p-6 text-center space-y-4 bg-white">
              <div className="p-4 bg-white border-2 border-dashed border-slate-300 rounded-card inline-block shadow-subtle">
                {modalQrUrl ? (
                  <img
                    src={modalQrUrl}
                    alt="Admission QR Token"
                    className="w-56 h-56 mx-auto object-contain"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-tangerine" />
                  </div>
                )}
              </div>

              <div>
                <p className="font-bold text-sm text-ink">{activeTicketModal.attendeeName}</p>
                <p className="font-mono text-xs font-semibold tracking-wider text-slate-700 mt-0.5 tabular-nums">
                  {activeTicketModal.ticket.ticketNumber}
                </p>
                <p className="text-[11px] text-slate-500 mt-2 font-mono">
                  Present QR code at gate scanner.
                </p>
              </div>

              <div className="no-print pt-2 flex items-center justify-center gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="editorial-btn-secondary text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Printer size={16} weight="regular" />
                  <span>Print Pass</span>
                </button>
                <Link
                  to={`/ticket/${activeTicketModal.ticket.id}`}
                  state={{
                    registration: registrations.find((r) => r.tickets?.some((t: any) => t.id === activeTicketModal.ticket.id)) || {
                      event: activeTicketModal.event,
                      attendee: { fullName: activeTicketModal.attendeeName },
                      reference: activeTicketModal.ticket.ticketNumber,
                    },
                    ticket: activeTicketModal.ticket,
                    plainToken: activeTicketModal.ticket.token,
                  }}
                  className="text-xs text-slate-500 hover:text-ink font-medium px-2 py-1 transition underline"
                  title="Open full credential document view"
                >
                  Full Document
                </Link>
                <button
                  type="button"
                  onClick={closeModal}
                  className="editorial-btn-dark text-xs cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
