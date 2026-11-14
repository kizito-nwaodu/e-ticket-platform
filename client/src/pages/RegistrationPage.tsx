import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import { getEvent, registerAttendee, scheduleFailedRegistrantApi } from '../services/api';
import { useAuth, getRolePortalLabel } from '../context/AuthContext';
import { ArrowLeft, ArrowRight, Check } from '@phosphor-icons/react';

export const RegistrationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, hasRole, getPrimaryPortalPath } = useAuth();
  const primaryRole = user?.roles?.[0]?.role;
  const isOpsUser = Boolean(user && primaryRole && primaryRole !== 'attendee');
  const canRegisterDelegates = hasRole(['admin', 'organiser']);
  const isAttendee = Boolean(user && !isOpsUser);

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isAttendee && user) {
      if (user.displayName && !fullName) setFullName(user.displayName);
      if (user.email && !email) setEmail(user.email);
    }

    if (!id) return;
    getEvent(id)
      .then((res) => {
        if (res.success && res.event) {
          setEvent(res.event);
          if (res.event.ticketTypes?.length > 0) {
            setTicketTypeId(res.event.ticketTypes[0].id);
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, user, isAttendee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (isAttendee && !privacyConsent) {
      setError('Please confirm your agreement to the privacy notice to proceed with registration.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = canRegisterDelegates
        ? await scheduleFailedRegistrantApi(id, {
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            ticketTypeId: ticketTypeId || undefined,
            reason: reason.trim() || 'Assisted attendee registration',
          })
        : await registerAttendee(id, {
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            ticketTypeId: ticketTypeId || undefined,
            privacyConsent,
          });

      if (res.success && res.data) {
        const ticketId = res.data.ticket?.id || res.data.ticket?.ticketNumber;
        navigate(`/ticket/${ticketId}`, {
          state: {
            registration: res.data.registration,
            ticket: res.data.ticket,
            plainToken: res.data.plainToken,
            qrDataUrl: res.data.qrDataUrl,
          },
        });
      }
    } catch (err: any) {
      setError(err.message || 'Registration request could not be processed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-tangerine" />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(`/register/${id}`)}&mode=signup`}
        replace
      />
    );
  }

  if (isOpsUser && !canRegisterDelegates) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="editorial-card p-8 bg-white text-center space-y-4">
          <h1 className="text-lg font-bold font-display text-ink">
            Registration Restricted for {getRolePortalLabel(primaryRole)}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Operations roles without registration rights cannot self-register as delegates or issue passes for attendees.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <Link
              to={getPrimaryPortalPath(user)}
              className="editorial-btn-dark text-xs inline-flex items-center gap-2"
            >
              <span>Return to {getRolePortalLabel(primaryRole)}</span>
              <ArrowRight size={16} weight="regular" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-tangerine" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-16 editorial-card p-8 max-w-lg mx-auto space-y-3">
        <h2 className="text-lg font-bold font-display text-ink">Event Not Found</h2>
        <p className="text-xs text-slate-500">The event you requested is unavailable or has ended.</p>
        <Link to="/" className="editorial-btn-secondary inline-block text-xs mt-2">
          Return to Events
        </Link>
      </div>
    );
  }

  const isConcluded = event && (new Date(event.endAt) < new Date() || event.status === 'completed');

  if (isConcluded) {
    return (
      <div className="text-center py-16 editorial-card p-8 max-w-lg mx-auto space-y-4 bg-white border border-slate-200">
        <span className="inline-block px-2.5 py-0.5 rounded-badge bg-slate-100 text-slate-600 text-[10px] font-mono uppercase tracking-wider font-bold">
          EVENT CONCLUDED
        </span>
        <h2 className="text-lg font-bold font-display text-ink">{event.title}</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          This event ended on {new Date(event.endAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Registration is closed.
        </p>
        <Link to="/" className="editorial-btn-dark inline-block text-xs mt-2">
          Browse Events
        </Link>
      </div>
    );
  }

  const startDate = new Date(event.startAt);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-ink transition"
      >
        <ArrowLeft size={16} weight="regular" /> Back to Events
      </Link>

      <div className="editorial-card overflow-hidden shadow-elevated bg-white">
        {/* Header Summary */}
        <div className="bg-ink text-white p-6 sm:p-8 space-y-3 border-b border-ink-light">
          <div className="inline-block px-2.5 py-0.5 rounded-badge bg-ink-light text-tangerine text-[10px] font-mono uppercase tracking-wider font-bold border border-slate-700">
            REGISTRATION
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-display leading-tight text-white">
            {event.title}
          </h1>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 text-xs text-slate-300 pt-1">
            <div>
              <span className="text-slate-400 font-mono uppercase mr-1.5 text-[10px]">Venue:</span>
              <span>{event.venue}</span>
            </div>
            <div>
              <span className="text-slate-400 font-mono uppercase mr-1.5 text-[10px]">Date:</span>
              <span>
                {startDate.toLocaleString('en-US', {
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-4 rounded-card bg-crimson-subtle border border-crimson-border text-crimson text-xs">
              <p className="font-semibold leading-relaxed">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Full Name <span className="text-tangerine">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-btn border border-slate-300 bg-white text-xs text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tangerine focus:border-tangerine transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Email Address <span className="text-tangerine">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-btn border border-slate-300 bg-white text-xs text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tangerine focus:border-tangerine transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+234 800 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-btn border border-slate-300 bg-white text-xs text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tangerine focus:border-tangerine transition"
                />
              </div>
            </div>

            {/* Ticket Tier Selection */}
            {event.ticketTypes?.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Ticket Tier
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {event.ticketTypes.map((tier: any) => (
                    <label
                      key={tier.id}
                      className={`p-3 rounded-btn border cursor-pointer transition flex items-center justify-between ${
                        ticketTypeId === tier.id
                          ? 'border-tangerine bg-tangerine-subtle text-ink font-semibold'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="ticketTier"
                          checked={ticketTypeId === tier.id}
                          onChange={() => setTicketTypeId(tier.id)}
                          className="text-tangerine focus:ring-tangerine"
                        />
                        <span className="text-xs">{tier.name}</span>
                      </div>
                      {tier.price > 0 && (
                        <span className="text-[11px] font-mono text-slate-500">
                          ₦{tier.price.toLocaleString()}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {canRegisterDelegates ? (
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Registration Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. In-person registration assistance"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-btn border border-slate-300 bg-white text-xs text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tangerine focus:border-tangerine transition"
                />
              </div>
            ) : (
              <div
                onClick={() => {
                  setPrivacyConsent((prev) => !prev);
                  if (error?.includes('privacy notice')) setError(null);
                }}
                role="checkbox"
                aria-checked={privacyConsent}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setPrivacyConsent((prev) => !prev);
                    if (error?.includes('privacy notice')) setError(null);
                  }
                }}
                className={`p-4 rounded-card border transition-all cursor-pointer select-none ${
                  privacyConsent
                    ? 'bg-tangerine-subtle/70 border-tangerine shadow-sm'
                    : error?.includes('privacy notice')
                    ? 'bg-crimson-subtle/40 border-crimson ring-2 ring-crimson/20'
                    : 'bg-white border-slate-300 hover:border-slate-400 hover:bg-slate-50/50 shadow-subtle'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Custom High-Visibility Checkbox */}
                  <div
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      privacyConsent
                        ? 'bg-tangerine border-tangerine text-white'
                        : error?.includes('privacy notice')
                        ? 'border-crimson bg-white'
                        : 'border-slate-400 bg-white group-hover:border-slate-600'
                    }`}
                  >
                    {privacyConsent && <Check size={14} weight="bold" className="text-white" />}
                  </div>

                  {/* Hidden accessibility input */}
                  <input
                    type="checkbox"
                    id="privacyConsent"
                    checked={privacyConsent}
                    onChange={(e) => {
                      e.stopPropagation();
                      setPrivacyConsent(e.target.checked);
                      if (error?.includes('privacy notice')) setError(null);
                    }}
                    className="sr-only"
                    tabIndex={-1}
                  />

                  <label
                    htmlFor="privacyConsent"
                    className="text-xs text-slate-800 leading-relaxed cursor-pointer font-medium"
                  >
                    I consent to the collection and processing of my registration details by Iconic Open University for event access and attendance records.
                  </label>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-btn bg-tangerine hover:bg-tangerine-hover text-white font-bold text-xs flex items-center justify-center gap-2 shadow-subtle transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{canRegisterDelegates ? 'Issue Pass' : 'Complete Registration'}</span>
                <ArrowRight size={16} weight="regular" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
