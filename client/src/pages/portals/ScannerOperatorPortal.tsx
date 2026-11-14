import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { getEvents, getEvent, checkInTicket, getRecentScans } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { playScanChime } from '../../utils/audio';
import {
  Camera,
  CheckCircle,
  XCircle,
  WarningCircle,
  ArrowClockwise,
  SpeakerHigh,
  SpeakerSimpleSlash,
  UploadSimple
} from '@phosphor-icons/react';

export const ScannerOperatorPortal: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [gates, setGates] = useState<any[]>([]);
  const [selectedGateId, setSelectedGateId] = useState<string>('');

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Scan Outcome Display
  const [scanResult, setScanResult] = useState<{
    outcome: string;
    message: string;
    ticketNumber?: string;
    attendeeName?: string;
    ticketTypeName?: string;
    checkedInAt?: string;
  } | null>(null);

  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const autoResetTimerRef = useRef<any>(null);
  const scanLockRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleValidateRef = useRef<(rawInput: string) => void>(() => {});

  useEffect(() => {
    return () => {
      if (autoResetTimerRef.current) {
        clearTimeout(autoResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setLoadingEvents(true);
    getEvents()
      .then((res) => {
        if (res.success && res.events?.length > 0) {
          setEvents(res.events);
          const firstEvent = res.events[0];
          setSelectedEventId(firstEvent.id);
          if (firstEvent.gates?.length > 0) {
            setGates(firstEvent.gates);
            setSelectedGateId(firstEvent.gates[0].id);
          }
        }
      })
      .catch((err: any) => setLoadError(err.message || 'Failed to load events'))
      .finally(() => setLoadingEvents(false));
  }, []);

  const loadRecentScans = (evtId?: string) => {
    const id = evtId || selectedEventId;
    if (!id) return;
    getRecentScans(id)
      .then((res) => {
        if (res.success) {
          setRecentScans(res.scans);
        }
      })
      .catch((err: any) => console.error('Failed to load recent scans:', err));
  };

  const handleEventChange = async (evtId: string) => {
    setSelectedEventId(evtId);
    setScanResult(null);
    setLoadError(null);
    try {
      const res = await getEvent(evtId);
      if (res.success && res.event) {
        setGates(res.event.gates || []);
        if (res.event.gates?.length > 0) {
          setSelectedGateId(res.event.gates[0].id);
        } else {
          setSelectedGateId('');
        }
      }
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load event gates');
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      loadRecentScans(selectedEventId);
    }
  }, [selectedEventId]);

  const handleValidate = async (rawInput: string) => {
    if (!rawInput.trim() || scanLockRef.current) return;
    if (!selectedEventId) {
      setScanResult({
        outcome: 'not_found',
        message: 'Select an active event before scanning a pass.',
      });
      return;
    }
    scanLockRef.current = true;

    let token = rawInput.trim();
    try {
      const parsed = JSON.parse(rawInput);
      if (parsed.token) token = parsed.token;
    } catch {
      // Raw string token
    }

    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
    }

    setValidating(true);
    setScanResult(null);

    try {
      const res = await checkInTicket({
        token,
        eventId: selectedEventId,
        gateId: selectedGateId || undefined,
      });

      // CRITICAL FIX (Bug 3): Backend response structure has `res.data` with outcome: 'admit'
      const outcomeData = res.data || res;
      setScanResult(outcomeData);

      if (outcomeData.outcome === 'admit') {
        if (soundEnabled) playScanChime('admit');
      } else {
        if (soundEnabled) playScanChime('reject');
      }

      loadRecentScans();
      setManualTokenInput('');

      // Auto-reset feedback banner after 3.5s for gate queue flow
      autoResetTimerRef.current = setTimeout(() => {
        setScanResult(null);
      }, 3500);
    } catch (err: any) {
      setScanResult({
        outcome: 'not_found',
        message: err.message || 'Validation request failed',
      });
      if (soundEnabled) playScanChime('reject');

      autoResetTimerRef.current = setTimeout(() => {
        setScanResult(null);
      }, 3500);
    } finally {
      setValidating(false);
      scanLockRef.current = false;
    }
  };

  handleValidateRef.current = handleValidate;

  const handleScanImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCameraError(null);
    const readerId = 'operator-qr-file-reader';
    const tempScanner = new Html5Qrcode(readerId);
    try {
      const decodedText = await tempScanner.scanFile(file, false);
      handleValidateRef.current(decodedText);
    } catch {
      setCameraError('Could not detect a valid QR code in the selected image.');
    } finally {
      try {
        tempScanner.clear();
      } catch {
        // ignore cleanup error
      }
    }
  };

  // Camera Scanner Lifecycle
  useEffect(() => {
    if (!cameraActive) return;

    let mounted = true;
    let started = false;
    const html5QrCode = new Html5Qrcode('operator-qr-reader');

    const startCamera = async () => {
      setCameraError(null);
      try {
        const onScanSuccess = (decodedText: string) => {
          if (!mounted) return;
          mounted = false;
          handleValidateRef.current(decodedText);
          setCameraActive(false);
        };

        try {
          await html5QrCode.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 240, height: 240 } },
            onScanSuccess,
            () => {}
          );
          started = true;
        } catch {
          const devices = await Html5Qrcode.getCameras();
          if (!mounted) return;
          if (!devices || devices.length === 0) {
            setCameraError('No camera detected. You can upload a QR image or enter the pass code manually below.');
            setCameraActive(false);
            return;
          }
          const preferred =
            devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[0];

          await html5QrCode.start(
            preferred.id,
            { fps: 10, qrbox: { width: 240, height: 240 } },
            onScanSuccess,
            () => {}
          );
          started = true;
        }
      } catch (err: any) {
        if (!mounted) return;
        setCameraError(
          err?.message || 'Camera permission denied or unavailable. You can upload a QR image or enter the pass code manually below.'
        );
        setCameraActive(false);
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (started) {
        html5QrCode
          .stop()
          .then(() => html5QrCode.clear())
          .catch(() => {});
      } else {
        try {
          html5QrCode.clear();
        } catch {
          // ignore
        }
      }
    };
  }, [cameraActive]);

  const activeGateName = gates.find((g) => g.id === selectedGateId)?.name || 'Default Gate';

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10">
      {/* 1. Operational Station Header */}
      {loadError && (
        <div className="p-3 rounded-card bg-crimson/5 border border-crimson/20 text-crimson text-xs">
          {loadError}
        </div>
      )}
      <div className="editorial-card p-4 sm:p-5 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold font-display text-ink tracking-tight">
            Gate Admission
          </h1>
        </div>

        {/* Station Selectors */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="w-full sm:w-56">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
              Active Event
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              disabled={loadingEvents || events.length === 0}
              className="w-full px-3 py-1.5 rounded-btn border border-slate-300 bg-white text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-tangerine transition disabled:bg-slate-50"
            >
              {loadingEvents ? (
                <option value="">Loading events...</option>
              ) : events.length === 0 ? (
                <option value="">No events available</option>
              ) : (
                events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="w-full sm:w-44">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
              Assigned Gate
            </label>
            <select
              value={selectedGateId}
              onChange={(e) => setSelectedGateId(e.target.value)}
              disabled={loadingEvents || gates.length === 0}
              className="w-full px-3 py-1.5 rounded-btn border border-slate-300 bg-white text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-tangerine transition disabled:bg-slate-50"
            >
              {gates.length === 0 ? (
                <option value="">Default Gate</option>
              ) : (
                gates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-btn border mt-auto transition cursor-pointer ${
              soundEnabled
                ? 'bg-ivory border-slate-300 text-ink'
                : 'bg-white border-slate-200 text-slate-400'
            }`}
            title={soundEnabled ? 'Mute Chime Feedback' : 'Enable Chime Feedback'}
          >
            {soundEnabled ? <SpeakerHigh size={16} className="text-forest" /> : <SpeakerSimpleSlash size={16} />}
          </button>
        </div>
      </div>

      {/* 2. IMMEDIATE HIGH-CONTRAST SCAN RESULT OVERLAY BANNER */}
      {scanResult && (
        <div
          className={`p-5 rounded-card border shadow-modal animate-slide-down ${
            scanResult.outcome === 'admit'
              ? 'bg-forest text-white border-forest'
              : scanResult.outcome === 'already_used'
              ? 'bg-ink text-white border-slate-700'
              : 'bg-crimson text-white border-crimson'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {scanResult.outcome === 'admit' ? (
                <CheckCircle size={48} weight="fill" className="shrink-0 text-white" />
              ) : (
                <XCircle size={48} weight="fill" className="shrink-0 text-white" />
              )}
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest font-bold">
                  {scanResult.outcome === 'admit'
                    ? 'VALID TICKET · ADMIT ATTENDEE'
                    : scanResult.outcome === 'already_used'
                    ? 'ALREADY USED · ENTRY RECORDED'
                    : scanResult.outcome === 'wrong_event'
                    ? 'WRONG EVENT'
                    : scanResult.outcome === 'revoked'
                    ? 'TICKET CANCELLED'
                    : 'INVALID PASS'}
                </span>
                <h2 className="text-xl font-bold font-display mt-0.5 leading-snug">
                  {scanResult.attendeeName || scanResult.message}
                </h2>
                {scanResult.ticketNumber && (
                  <p className="text-xs font-mono opacity-90 mt-1">
                    Pass Code: {scanResult.ticketNumber} · Tier: {scanResult.ticketTypeName || 'Standard'}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => setScanResult(null)}
              className="p-1 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
            >
              <ArrowClockwise size={16} weight="regular" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Scanning Area & Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Optical Camera Viewport + Manual Input (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="editorial-card p-5 sm:p-6 bg-white space-y-4 shadow-subtle">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-ink">
                <span>Scan Attendee Pass</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                {activeGateName}
              </span>
            </div>

            {/* Camera Viewport Area (55% thumb zone) */}
            {cameraError && (
              <div className="p-3 rounded-btn bg-crimson/5 border border-crimson/20 text-crimson text-xs">
                {cameraError}
              </div>
            )}

            <div id="operator-qr-file-reader" className="hidden" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleScanImageFile}
              className="hidden"
            />

            {cameraActive ? (
              <div className="space-y-3">
                <div
                  id="operator-qr-reader"
                  className="rounded-card overflow-hidden border-2 border-dashed border-slate-300 bg-ink min-h-[280px]"
                />
                <button
                  type="button"
                  onClick={() => setCameraActive(false)}
                  className="w-full py-2.5 rounded-btn bg-slate-100 hover:bg-slate-200 text-ink text-xs font-semibold transition cursor-pointer"
                >
                  Turn Off Camera
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-card p-8 sm:p-10 text-center space-y-4 bg-ivory/50">
                <div className="w-14 h-14 rounded-full bg-white text-ink mx-auto flex items-center justify-center border border-slate-200 shadow-subtle">
                  <Camera size={28} weight="regular" />
                </div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Start camera to scan ticket QR code, or upload an image
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    disabled={!selectedEventId}
                    onClick={() => setCameraActive(true)}
                    className="editorial-btn-dark text-xs inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Camera size={16} weight="regular" />
                    <span>Start Camera</span>
                  </button>
                  <button
                    type="button"
                    disabled={!selectedEventId}
                    onClick={() => fileInputRef.current?.click()}
                    className="editorial-btn-secondary text-xs inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <UploadSimple size={16} weight="regular" />
                    <span>Upload QR</span>
                  </button>
                </div>
              </div>
            )}

            {/* Manual Token Fallback */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-semibold text-ink">
                Manual Pass Code
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleValidate(manualTokenInput);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Enter pass code (e.g. ICN-9X7-P4W)..."
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-btn border border-slate-300 bg-white text-xs font-mono text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tangerine focus:border-tangerine transition"
                />
                <button
                  type="submit"
                  disabled={validating || !manualTokenInput.trim()}
                  className="editorial-btn-primary text-xs shrink-0 disabled:opacity-50"
                >
                  {validating ? 'Verifying...' : 'Validate'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Recent Scans Log (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="editorial-card p-5 bg-white space-y-3 shadow-subtle">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold font-mono uppercase text-ink">
                <span>Recent Gate Activity</span>
              </h3>
              <button
                onClick={() => loadRecentScans()}
                className="text-[11px] text-tangerine hover:underline cursor-pointer font-semibold"
              >
                Refresh
              </button>
            </div>

            {recentScans.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                No recent scan attempts recorded at this station yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {recentScans.map((scan) => {
                  const isSuccess = scan.outcome === 'admit';
                  return (
                    <div
                      key={scan.id}
                      className="p-3 rounded-btn border border-slate-200 bg-ivory/50 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isSuccess ? 'bg-forest' : 'bg-crimson'
                            }`}
                          />
                          <span className="font-bold font-mono text-[11px] text-ink uppercase">
                            {scan.outcome}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate font-mono">
                          {scan.ticket?.ticketNumber || scan.tokenHashPresented?.substring(0, 12)}...
                        </p>
                      </div>

                      <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                        {(() => {
                          const rawDate = scan.scannedAt || scan.attemptedAt || scan.createdAt;
                          if (!rawDate) return '—';
                          const d = new Date(rawDate);
                          return isNaN(d.getTime())
                            ? '—'
                            : d.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              });
                        })()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
