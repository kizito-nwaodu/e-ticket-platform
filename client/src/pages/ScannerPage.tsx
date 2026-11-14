import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  getEvents,
  checkInTicket,
  manualOverrideCheckIn,
  getRecentScans,
  searchTickets,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle,
  WarningCircle,
  XCircle,
  Camera,
  ArrowClockwise,
  MagnifyingGlass,
  X
} from '@phosphor-icons/react';

export const ScannerPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedGateId, setSelectedGateId] = useState<string>('');
  const [gates, setGates] = useState<any[]>([]);

  // Validation State
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [cameraActive, setCameraActive] = useState(false);

  // Supervisor Manual Lookup State
  const [lookupQuery, setLookupQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [overrideModalTicket, setOverrideModalTicket] = useState<any>(null);
  const [overrideCategory, setOverrideCategory] = useState('Damaged / Unreadable Mobile Screen');
  const [overrideReason, setOverrideReason] = useState('');

  // Auto-reset timer for scanner overlay
  useEffect(() => {
    if (scanResult) {
      const timer = setTimeout(() => {
        setScanResult(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [scanResult]);

  // Audio feedback
  const playSound = (type: 'admit' | 'reject') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'admit') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.setValueAtTime(160, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch {
      // Audio not permitted or supported
    }
  };

  // Load events
  useEffect(() => {
    getEvents().then((res) => {
      if (res.success && res.events.length > 0) {
        setEvents(res.events);
        const queryEvtId = searchParams.get('eventId');
        const defaultEvt = queryEvtId
          ? res.events.find((e: any) => e.id === queryEvtId) || res.events[0]
          : res.events[0];

        setSelectedEventId(defaultEvt.id);
        setGates(defaultEvt.gates || []);
        if (defaultEvt.gates?.length > 0) {
          setSelectedGateId(defaultEvt.gates[0].id);
        }

        const queryToken = searchParams.get('token');
        if (queryToken) {
          setManualTokenInput(queryToken);
        }
      }
    });
  }, [searchParams]);

  const handleEventChange = (evtId: string) => {
    setSelectedEventId(evtId);
    const evt = events.find((e) => e.id === evtId);
    if (evt) {
      setGates(evt.gates || []);
      setSelectedGateId(evt.gates?.[0]?.id || '');
    }
    loadRecentScans(evtId);
  };

  const loadRecentScans = (evtId?: string) => {
    const target = evtId || selectedEventId;
    if (!target) return;
    getRecentScans(target).then((res) => {
      if (res.success) setRecentScans(res.scans);
    });
  };

  useEffect(() => {
    if (selectedEventId) {
      loadRecentScans(selectedEventId);
    }
  }, [selectedEventId]);

  const handleValidate = async (rawToken: string) => {
    if (!rawToken || !selectedEventId) return;
    setValidating(true);
    setScanResult(null);

    try {
      const res = await checkInTicket({
        token: rawToken.trim(),
        eventId: selectedEventId,
        gateId: selectedGateId || undefined,
      });

      if (res.success && res.data) {
        setScanResult(res.data);
        if (res.data.outcome === 'admit') {
          playSound('admit');
        } else {
          playSound('reject');
        }
        loadRecentScans();
      }
    } catch (err: any) {
      setScanResult({
        outcome: 'not_found',
        message: err.message || 'Validation request failed',
      });
      playSound('reject');
    } finally {
      setValidating(false);
    }
  };

  // HTML5 QR Camera Scanner
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (cameraActive) {
      scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
        },
        false
      );

      scanner.render(
        (decodedText) => {
          handleValidate(decodedText);
          setCameraActive(false);
          scanner?.clear();
        },
        () => {}
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(() => {});
      }
    };
  }, [cameraActive, selectedEventId, selectedGateId]);

  // Supervisor Search
  const handleSearchAttendees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim() || !selectedEventId) return;
    setSearching(true);
    try {
      const res = await searchTickets(selectedEventId, lookupQuery);
      if (res.success) {
        setSearchResults(res.tickets);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  // Supervisor Override
  const handleExecuteOverride = async () => {
    if (!overrideModalTicket) return;
    const combinedReason = `${overrideCategory}: ${overrideReason.trim()}`;
    try {
      const res = await manualOverrideCheckIn({
        ticketId: overrideModalTicket.id,
        eventId: selectedEventId,
        gateId: selectedGateId || undefined,
        reason: combinedReason,
      });

      if (res.success && res.data) {
        setScanResult(res.data);
        playSound('admit');
        setOverrideModalTicket(null);
        setOverrideReason('');
        loadRecentScans();
      }
    } catch (err: any) {
      alert(`Override failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Full-Screen High-Contrast Validation Overlay with Auto-Reset */}
      {scanResult && (
        <div
          onClick={() => setScanResult(null)}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all animate-in fade-in duration-150 ${
            scanResult.outcome === 'admit'
              ? 'bg-[#0f172a] text-white border-8 border-slate-700'
              : scanResult.outcome === 'already_used'
              ? 'bg-[#451a03] text-amber-100 border-8 border-amber-600'
              : 'bg-[#4c0519] text-rose-100 border-8 border-rose-600'
          }`}
        >
          <div className="max-w-md w-full space-y-4">
            <div className="inline-flex p-4 rounded-full bg-white/10 mx-auto">
              {scanResult.outcome === 'admit' && <CheckCircle size={48} weight="fill" className="text-white" />}
              {scanResult.outcome === 'already_used' && <WarningCircle size={48} weight="fill" className="text-amber-300" />}
              {scanResult.outcome !== 'admit' && scanResult.outcome !== 'already_used' && (
                <XCircle size={48} weight="fill" className="text-rose-300" />
              )}
            </div>

            <div>
              <p className="font-mono text-xs uppercase tracking-widest font-bold opacity-80">
                Gate Validation Decision: {scanResult.outcome.toUpperCase()}
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight mt-1 text-white">
                {scanResult.message}
              </h1>
            </div>

            {scanResult.attendeeName && (
              <div className="bg-black/30 p-4 rounded-xl border border-white/10 text-left space-y-1 text-sm">
                <p className="font-bold text-base text-white">{scanResult.attendeeName}</p>
                <p className="text-xs opacity-90">{scanResult.ticketTypeName || 'Standard Attendee'}</p>
                {scanResult.ticketNumber && (
                  <p className="font-mono text-xs opacity-90 pt-1 tracking-wider tabular-nums">Pass Code: {scanResult.ticketNumber}</p>
                )}
                {scanResult.checkedInAt && (
                  <p className="text-xs opacity-80">Time: {new Date(scanResult.checkedInAt).toLocaleTimeString()}</p>
                )}
              </div>
            )}

            <p className="text-xs opacity-75 font-mono">
              Auto-dismissing in 3.5s (or tap screen to dismiss)
            </p>
          </div>
        </div>
      )}

      {/* Terminal Station Banner */}
      <div className="bg-[#0f172a] text-white rounded-2xl p-6 sm:p-7 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Gate Terminal
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
              Live QR Admission Scanner
            </h1>
          </div>

          {/* Event & Gate Dropdown Selectors */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-56">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Active Event
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => handleEventChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 sm:py-2 text-base sm:text-xs focus:ring-2 focus:ring-slate-400"
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-44">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Assigned Gate
              </label>
              <select
                value={selectedGateId}
                onChange={(e) => setSelectedGateId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 sm:py-2 text-base sm:text-xs focus:ring-2 focus:ring-slate-400"
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
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Optical Scanner & Manual Input (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Camera Viewfinder (Locked to top 55% on mobile) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-subtle">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Camera Optical Scanner
              </h2>
              <button
                onClick={() => setCameraActive(!cameraActive)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                  cameraActive
                    ? 'bg-slate-100 text-slate-700 border border-slate-300'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <Camera size={16} weight="regular" />
                <span>{cameraActive ? 'Stop Camera' : 'Start Camera'}</span>
              </button>
            </div>

            {cameraActive ? (
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a] p-2 min-h-[50vh] sm:min-h-0">
                <div id="qr-reader" className="w-full" />
              </div>
            ) : (
              <div
                onClick={() => setCameraActive(true)}
                className="py-10 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition p-6"
              >
                <p className="text-sm font-semibold text-slate-800">Start Camera</p>
              </div>
            )}
          </div>

          {/* Manual Token Input (Bottom thumb zone on mobile) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-subtle">
            <h2 className="text-sm font-bold text-slate-900">
              Manual Pass Code
            </h2>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Enter pass code (e.g. ICN-9X7-P4W or ICN9X7P4W)..."
                value={manualTokenInput}
                onChange={(e) => setManualTokenInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleValidate(manualTokenInput)}
                className="flex-1 px-4 py-3 sm:py-2.5 rounded-xl border border-slate-300 text-base sm:text-xs font-mono tracking-wider tabular-nums focus:ring-2 focus:ring-slate-900 uppercase"
              />
              <button
                onClick={() => handleValidate(manualTokenInput)}
                disabled={validating || !manualTokenInput.trim()}
                className="px-6 py-3 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition disabled:opacity-50 min-h-[44px]"
              >
                {validating ? 'Checking...' : 'Validate'}
              </button>
            </div>

            {/* Test Scenario Presets */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[11px] font-mono uppercase font-bold text-slate-500 mb-2">
                Test Scenarios:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() =>
                    handleValidate('ccf073fc5ef4aa88ea65b3fb0c62971c78e9862fd297ca4e8995f264d2f9b0a5')
                  }
                  className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-left transition"
                >
                  <span className="block text-xs font-bold">1. Valid Pass</span>
                  <span className="text-[10px] text-slate-500 font-mono">Unused ticket</span>
                </button>

                <button
                  onClick={() =>
                    handleValidate('ccf073fc5ef4aa88ea65b3fb0c62971c78e9862fd297ca4e8995f264d2f9b0a5')
                  }
                  className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-left transition"
                >
                  <span className="block text-xs font-bold">2. Replay Test</span>
                  <span className="text-[10px] text-slate-500 font-mono">Already used</span>
                </button>

                <button
                  onClick={() =>
                    handleValidate('f38c37c9cc29ed32a241ebbdb584bc1deb8dd1393daea54b67db7fa20d873a84')
                  }
                  className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-left transition"
                >
                  <span className="block text-xs font-bold">3. Revoked Pass</span>
                  <span className="text-[10px] text-slate-500 font-mono">Revoked status</span>
                </button>

                <button
                  onClick={() =>
                    handleValidate('827141026fc110552bc46a3a1412cbf6e357fde608f5c5cd018bc93565493203')
                  }
                  className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-left transition"
                >
                  <span className="block text-xs font-bold">4. Wrong Event</span>
                  <span className="text-[10px] text-slate-500 font-mono">Cross-event</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Supervisor Lookup & Recent Admissions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Supervisor Exception Lookup (FR-08) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-subtle">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Supervisor Exception Lookup
              </h2>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                FR-08
              </span>
            </div>

            <form onSubmit={handleSearchAttendees} className="flex gap-2">
              <div className="relative flex-1">
                <MagnifyingGlass size={16} weight="regular" className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search attendee name or ref..."
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 sm:py-2 rounded-xl border border-slate-300 text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
              >
                {searching ? '...' : 'Search'}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {searchResults.map((t) => (
                  <div key={t.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-900">{t.registration.attendee.fullName}</p>
                      <p className="text-[11px] text-slate-500 font-mono tracking-wider tabular-nums">{t.ticketNumber} • {t.status.toUpperCase()}</p>
                    </div>
                    {t.status === 'active' && !t.checkIn ? (
                      <button
                        onClick={() => setOverrideModalTicket(t)}
                        className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Override Entry
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">Already Admitted</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Gate Admissions Ledger */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-subtle">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Recent Gate Admissions
              </h2>
              <button
                onClick={() => loadRecentScans()}
                className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowClockwise size={14} weight="regular" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {recentScans.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No scans recorded.</p>
              ) : (
                recentScans.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 uppercase font-mono text-[11px]">
                          {s.outcome}
                        </span>
                        <span className="text-slate-400 text-[10px] font-mono">
                          {new Date(s.scannedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-700 text-[11px] font-medium">
                        {s.ticket?.registration?.attendee?.fullName || 'Unidentified Ticket'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Gate: {s.gate?.name || 'Main Entrance'} • {s.notes}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Supervisor Override Reason Modal (FR-08) */}
      {overrideModalTicket && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Manual Gate Override</h3>
                <p className="text-xs text-slate-500 font-mono">FR-08 Compliance Audit Mandate</p>
              </div>
              <button
                onClick={() => setOverrideModalTicket(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <p><span className="font-bold text-slate-700">Attendee:</span> {overrideModalTicket.registration.attendee.fullName}</p>
              <p><span className="font-bold text-slate-700">Pass Code:</span> <span className="font-mono tracking-wider tabular-nums font-semibold">{overrideModalTicket.ticketNumber}</span></p>
              <p><span className="font-bold text-slate-700">Category:</span> {overrideModalTicket.registration.ticketType.name}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Structured Exception Category *
                </label>
                <select
                  value={overrideCategory}
                  onChange={(e) => setOverrideCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-slate-900"
                >
                  <option value="Damaged / Low Brightness Mobile Screen">Damaged / Low Brightness Mobile Screen</option>
                  <option value="Damaged / Creased Printed Pass">Damaged / Creased Printed Pass</option>
                  <option value="Verified National / University Photo ID">Verified National / University Photo ID</option>
                  <option value="Device Battery Exhaustion">Device Battery Exhaustion</option>
                  <option value="Accredited Speaker / VIP Exception">Accredited Speaker / VIP Exception</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Additional Supervisor Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail identity verification steps taken before admitting attendee..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setOverrideModalTicket(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!overrideReason.trim()}
                onClick={handleExecuteOverride}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                Commit Manual Admission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
