const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('etkt_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data;
}

// Events
export const getEvents = () => apiRequest('/events');
export const getEvent = (id: string) => apiRequest(`/events/${id}`);
export const createEvent = (data: any) => apiRequest('/events', { method: 'POST', body: JSON.stringify(data) });
export const deleteEventApi = (id: string) => apiRequest(`/events/${id}`, { method: 'DELETE' });
export const addEventGate = (eventId: string, name: string) =>
  apiRequest(`/events/${eventId}/gates`, { method: 'POST', body: JSON.stringify({ name }) });

// Registrations
export const registerAttendee = (eventId: string, data: any) =>
  apiRequest(`/events/${eventId}/registrations`, { method: 'POST', body: JSON.stringify(data) });
export const scheduleFailedRegistrantApi = (eventId: string, data: {
  fullName: string;
  email: string;
  phone?: string;
  ticketTypeId?: string;
  reason?: string;
}) => apiRequest(`/events/${eventId}/schedule-registrant`, { method: 'POST', body: JSON.stringify(data) });
export const getRegistrationByRef = (ref: string) => apiRequest(`/registrations/ref/${ref}`);
export const getTicketForRegistration = (regId: string) => apiRequest(`/registrations/${regId}/ticket`);
export const getMyTickets = () => apiRequest('/registrations/my-tickets');

// Tickets
export const getTicket = (id: string) => apiRequest(`/tickets/view/${id}`);
export const searchTickets = (eventId: string, q: string) =>
  apiRequest(`/tickets/search?eventId=${eventId}&q=${encodeURIComponent(q)}`);
export const revokeTicket = (ticketId: string, reason: string) =>
  apiRequest(`/tickets/${ticketId}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) });
export const reissueTicket = (ticketId: string, reason: string) =>
  apiRequest(`/tickets/${ticketId}/reissue`, { method: 'POST', body: JSON.stringify({ reason }) });

// Gate Validation
export const checkInTicket = (data: { token: string; eventId: string; gateId?: string }) =>
  apiRequest('/validation/check-in', { method: 'POST', body: JSON.stringify(data) });
export const manualOverrideCheckIn = (data: { ticketId: string; eventId: string; gateId?: string; reason: string }) =>
  apiRequest('/validation/manual-override', { method: 'POST', body: JSON.stringify(data) });
export const getRecentScans = (eventId?: string) =>
  apiRequest(`/validation/recent-scans${eventId ? `?eventId=${eventId}` : ''}`);

// Analytics
export const getEventDashboard = (eventId: string) => apiRequest(`/events/${eventId}/dashboard`);
export const getExportUrl = (eventId: string) => `${API_BASE}/events/${eventId}/attendance-export`;
export async function exportAttendanceCsvApi(eventId: string): Promise<void> {
  const token = localStorage.getItem('etkt_token');
  const response = await fetch(`${API_BASE}/events/${eventId}/attendance-export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Export failed (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-report-${eventId.slice(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// Audit
export const getAuditLogs = (action?: string) =>
  apiRequest(`/audit${action ? `?action=${encodeURIComponent(action)}` : ''}`);

// Admin User & Role Provisioning
export const listAllUsersApi = () => apiRequest('/admin/users');
export const createUserWithRoleApi = (data: {
  displayName: string;
  email: string;
  password: string;
  role: string;
  eventId?: string;
}) => apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(data) });
export const assignUserRoleApi = (data: { userId: string; role: string; eventId?: string }) =>
  apiRequest('/admin/assign-role', { method: 'POST', body: JSON.stringify(data) });
export const deleteUserApi = (userId: string) =>
  apiRequest(`/admin/users/${userId}`, { method: 'DELETE' });

// Auth
export const loginApi = (email: string, password: string) =>
  apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const registerAccountApi = (data: { displayName: string; email: string; password: string; phone?: string }) =>
  apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) });
export const getMeApi = () => apiRequest('/auth/me');
