import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { getTicket } from '../services/api';
import { useAuth, getRolePortalLabel } from '../context/AuthContext';
import {
  CheckCircle,
  Clock,
  Printer,
  ArrowLeft,
  WarningCircle
} from '@phosphor-icons/react';

export const TicketViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user, getPrimaryPortalPath } = useAuth();
  const primaryRole = user?.roles?.[0]?.role;
  const isOpsUser = Boolean(user && primaryRole && primaryRole !== 'attendee');
  const backPath = user ? (isOpsUser ? getPrimaryPortalPath(user) : '/portal/attendee') : '/';
  const backLabel = user
    ? isOpsUser
      ? `Back to ${getRolePortalLabel(primaryRole)}`
      : 'Back to My Passes'
    : 'Back to Events';

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const statePlainToken = (location.state as any)?.plainToken;
  const stateQrUrl = (location.state as any)?.qrDataUrl;

  useEffect(() => {
    if (!id) return;

    getTicket(id)
      .then(async (res) => {
        if (res.success && res.ticket) {
          setTicket(res.ticket);

          if (stateQrUrl) {
            setQrCodeDataUrl(stateQrUrl);
          } else {
            // CRITICAL FIX (Bug 2): Use the actual valid original token, avoiding tokenHash double-hash
            const validToken = statePlainToken || res.ticket.token || res.ticket.tokenHash;

            // In accordance with custom boarding-pass ID standards:
            // Encode ONLY the ticket_code (ticketNumber) inside the ISO/IEC 18004 QR code
            const qrPayload = res.ticket.ticketNumber || validToken;
            const url = await QRCode.toDataURL(qrPayload, {
              errorCorrectionLevel: 'M',
              margin: 3,
              scale: 10,
              color: { dark: '#111827', light: '#ffffff' },
            });
            setQrCodeDataUrl(url);
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, statePlainToken, stateQrUrl]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-tangerine" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-16 editorial-card p-8 max-w-lg mx-auto space-y-3 bg-white">
        <h2 className="text-lg font-bold font-display text-ink">Ticket Record Not Found</h2>
        <p className="text-xs text-slate-500">{error || 'Ticket not found.'}</p>
        <Link to="/" className="editorial-btn-dark inline-block text-xs mt-2">
          Return to Events
        </Link>
      </div>
    );
  }

  const reg = ticket.registration;
  const eventDate = new Date(reg.event.startAt);
  const isUsed = ticket.status === 'used' || Boolean(ticket.checkIn);
  const isRevoked = ticket.status === 'revoked';
  const isActive = ticket.status === 'active' && !isUsed;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Top Action Bar */}
      <div className="no-print flex items-center justify-between">
        <Link
          to={backPath}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-ink transition"
        >
          <ArrowLeft size={16} weight="regular" /> {backLabel}
        </Link>

        <div className="flex items-center gap-2">
          {isOpsUser && (primaryRole === 'admin' || primaryRole === 'organiser') && (
            <Link
              to={`/register/${reg.event.id}`}
              className="editorial-btn-dark text-xs inline-flex items-center gap-2"
            >
              <span>Issue Another Pass</span>
            </Link>
          )}
          <button
            onClick={handlePrint}
            className="editorial-btn-secondary text-xs inline-flex items-center gap-2 cursor-pointer"
          >
            <Printer size={16} weight="regular" />
            <span>Print Pass</span>
          </button>
        </div>
      </div>

      {/* PHYSICAL DIGITAL TICKET STUB */}
      <div id="printable-ticket" className="printable-ticket editorial-card overflow-hidden shadow-modal bg-white border border-slate-300">
        {/* Pass Top Section: Deep Ink Header */}
        <div className="bg-ink text-white p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/iconic-logo.png"
                alt="Iconic Open University"
                className="h-8 w-auto object-contain"
              />
              <span className="text-[10px] font-mono tracking-wider uppercase text-tangerine font-bold border-l border-slate-700 pl-2 hidden sm:inline">
                OFFICIAL EVENT PASS
              </span>
            </div>

            {/* Admission Status Stamp */}
            {isActive && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-badge text-[10px] font-mono uppercase tracking-wider font-bold bg-forest text-white">
                <CheckCircle size={14} weight="fill" /> Valid for Entry
              </span>
            )}
            {isUsed && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-badge text-[10px] font-mono uppercase tracking-wider font-bold bg-ink-light text-slate-300 border border-slate-700">
                <Clock size={14} weight="regular" className="text-slate-400" /> Admitted / Used
              </span>
            )}
            {isRevoked && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-badge text-[10px] font-mono uppercase tracking-wider font-bold bg-crimson text-white">
                <WarningCircle size={14} weight="fill" /> Ticket Cancelled
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-tangerine tracking-wider font-semibold">
              {reg.ticketType.name}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display leading-tight text-white mt-0.5">
              {reg.event.title}
            </h1>
          </div>

          <div className="space-y-1 text-xs text-slate-300 pt-2 border-t border-slate-800">
            <div>
              <span className="text-slate-400 font-mono uppercase mr-1.5 text-[10px]">Venue:</span>
              <span>{reg.event.venue}</span>
            </div>
            <div>
              <span className="text-slate-400 font-mono uppercase mr-1.5 text-[10px]">Date:</span>
              <span>
                {eventDate.toLocaleString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Notched Ticket Divider */}
        <div className="relative flex items-center bg-white px-2 py-1">
          <div className="w-4 h-8 bg-ivory rounded-r-full -ml-4 border-r border-slate-300" />
          <div className="flex-1 border-b-2 border-dashed border-slate-200 mx-2" />
          <div className="w-4 h-8 bg-ivory rounded-l-full -mr-4 border-l border-slate-300" />
        </div>

        {/* Pass Lower Section: Attendee Information & QR */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-white">
          {/* Left Metadata (7 cols) */}
          <div className="md:col-span-7 space-y-4">
            <div>
              <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                Attendee
              </span>
              <p className="text-lg font-bold font-display text-ink mt-0.5">
                {reg.attendee.fullName}
              </p>
              <p className="text-xs text-slate-600 font-sans">{reg.attendee.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-card bg-ivory border border-slate-200">
                <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">Pass Code</span>
                <span className="text-xs font-mono font-semibold tracking-wider text-ink tabular-nums">
                  {ticket.ticketNumber}
                </span>
              </div>
              <div className="p-3 rounded-card bg-ivory border border-slate-200">
                <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">Registration Code</span>
                <span className="text-xs font-mono font-semibold tracking-wider text-ink tabular-nums">
                  {reg.reference}
                </span>
              </div>
            </div>
          </div>

          {/* Right QR Section (5 cols): Solid White Quiet Zone Container */}
          <div className="md:col-span-5 flex flex-col items-center text-center space-y-2">
            <div className="p-3.5 bg-white border-2 border-slate-200 rounded-card shadow-subtle inline-block">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Gate Entry QR Code"
                  className="w-44 h-44 sm:w-48 sm:h-48 object-contain"
                />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-tangerine" />
                </div>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-medium">
              Present at Entrance
            </span>
          </div>
        </div>
      </div>

      {/* Attendee Guidance Box */}
      <div className="no-print editorial-card p-5 bg-white border border-slate-200 text-xs space-y-2.5">
        <h3 className="font-bold text-ink text-sm">How to use your pass</h3>
        <ul className="space-y-1.5 text-slate-600 list-disc list-inside leading-relaxed">
          <li>Present this QR code on your mobile device or bring a printed copy to the event entrance.</li>
          <li>Set your screen brightness to high for faster scanning at the gate.</li>
          <li>If your QR code cannot be scanned, show your Pass Code (<span className="font-mono font-bold text-ink">{ticket.ticketNumber}</span>) to event staff for manual assistance.</li>
        </ul>
      </div>
    </div>
  );
};
