const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function request(path, options = {}, token = null) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

async function multipart(path, formData, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}

export const photoUrl = (filename) =>
  filename ? `${API_BASE}/uploads/${filename}` : null;

// Auth
export const authApi = {
  register: (body)  => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login:    (body)  => request('/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
  me:       (token) => request('/auth/me', {}, token),
};

// Reports
export const reportsApi = {
  list:         (token, params = '') => request(`/api/v1/reports${params}`, {}, token),
  get:          (id, token)          => request(`/api/v1/reports/${id}`, {}, token),
  create:       (body, token)        => request('/api/v1/reports', { method: 'POST', body: JSON.stringify(body) }, token),
  updateStatus: (id, status, token)  => request(`/api/v1/reports/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token),
  rescore:      (id, token)          => request(`/api/v1/reports/${id}/rescore`, { method: 'POST' }, token),
  delete:       (id, token)          => request(`/api/v1/reports/${id}`, { method: 'DELETE' }, token),
};

// Locations
export const locationsApi = {
  list:   ()                => request('/api/v1/locations'),
  get:    (id)              => request(`/api/v1/locations/${id}`),
  create: (body, token)     => request('/api/v1/locations', { method: 'POST', body: JSON.stringify(body) }, token),
  update: (id, body, token) => request(`/api/v1/locations/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token),
};

// Inspections
export const inspectionsApi = {
  list:   (token)             => request('/api/v1/inspections', {}, token),
  get:    (id, token)         => request(`/api/v1/inspections/${id}`, {}, token),
  create: (body, token)       => request('/api/v1/inspections', { method: 'POST', body: JSON.stringify(body) }, token),
  update: (id, body, token)   => request(`/api/v1/inspections/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),
};

// Admin
export const adminApi = {
  applications:     (token)           => request('/admin/applications', {}, token),
  pending:          (token)           => request('/admin/pending', {}, token),
  summary:          (token)           => request('/admin/summary', {}, token),
  users:            (token)           => request('/admin/users', {}, token),
  verifiers:        (token)           => request('/admin/verifiers', {}, token),
  review:           (id, body, token) => request(`/admin/applications/${id}/review`, { method: 'POST', body: JSON.stringify(body) }, token),
  logs:             (token)           => request('/admin/logs', {}, token),
  updateUserStatus: (id, status, token) => request(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token),
  // Stations
  stations:         (token)           => request('/admin/stations', {}, token),
  createStation:    (body, token)     => request('/admin/stations', { method: 'POST', body: JSON.stringify(body) }, token),
  updateStation:    (id, body, token) => request(`/admin/stations/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token),
  toggleStation:    (id, active, token) => request(`/admin/stations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ is_active: active }) }, token),
  // Settings
  settings:         (token)           => request('/admin/settings', {}, token),
  saveSettings:     (body, token)     => request('/admin/settings', { method: 'PATCH', body: JSON.stringify(body) }, token),
};

// Dashboard
export const dashboardApi = {
  summary: (token) => request('/api/v1/dashboard/summary', {}, token),
};

// Notifications
export const notificationsApi = {
  list:        (token, unreadOnly = false) => request(`/api/v1/notifications?unread_only=${unreadOnly}&limit=50`, {}, token),
  count:       (token)                     => request('/api/v1/notifications/count', {}, token),
  markRead:    (id, token)                 => request(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }, token),
  markAllRead: (token)                     => request('/api/v1/notifications/read-all', { method: 'POST' }, token),
};

// Analytics
export const analyticsApi = {
  overview:   (token, params = '') => request(`/api/v1/analytics/overview${params}`, {}, token),
  timeSeries: (token, params = '') => request(`/api/v1/analytics/time-series${params}`, {}, token),
  byCategory: (token)              => request('/api/v1/analytics/by-category', {}, token),
  bySource:   (token)              => request('/api/v1/analytics/by-source', {}, token),
  inspections:(token)              => request('/api/v1/analytics/inspections', {}, token),
};

// Measurements
export const measurementsApi = {
  list:   (token, params = '') => request(`/api/v1/measurements${params}`, {}, token),
  get:    (id, token)          => request(`/api/v1/measurements/${id}`, {}, token),
  create: (body, token)        => request('/api/v1/measurements', { method: 'POST', body: JSON.stringify(body) }, token),
};

// Assignments
export const assignmentsApi = {
  list:         (token, status)         => request(`/api/v1/assignments${status ? `?status=${status}` : ''}`, {}, token),
  get:          (id, token)             => request(`/api/v1/assignments/${id}`, {}, token),
  create:       (body, token)           => request('/api/v1/assignments', { method: 'POST', body: JSON.stringify(body) }, token),
  updateStatus: (id, status, token)     => request(`/api/v1/assignments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token),
  review:       (id, body, token)       => request(`/api/v1/assignments/${id}/review`, { method: 'PATCH', body: JSON.stringify(body) }, token),
};

// Field Observations
export const fieldObsApi = {
  list:        (token, assignmentId)    => request(`/api/v1/field-observations${assignmentId ? `?assignment_id=${assignmentId}` : ''}`, {}, token),
  get:         (id, token)              => request(`/api/v1/field-observations/${id}`, {}, token),
  create:      (body, token)            => request('/api/v1/field-observations', { method: 'POST', body: JSON.stringify(body) }, token),
  update:      (id, body, token)        => request(`/api/v1/field-observations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),
  submit:      (id, token)              => request(`/api/v1/field-observations/${id}/submit`, { method: 'POST' }, token),
  listEvidence:(id, token)              => request(`/api/v1/field-observations/${id}/evidence`, {}, token),
  addEvidence: (_id, _fn, _desc, _tok) => Promise.resolve({ ok: true }),
};

// Analyst Notes
export const analystNotesApi = {
  list:   (token, { report_id, assignment_id } = {}) => {
    const qs = [report_id && `report_id=${report_id}`, assignment_id && `assignment_id=${assignment_id}`].filter(Boolean).join('&');
    return request(`/api/v1/analyst-notes${qs ? '?' + qs : ''}`, {}, token);
  },
  create: (body, token) => request('/api/v1/analyst-notes', { method: 'POST', body: JSON.stringify(body) }, token),
};

// CSV Imports
export const importsApi = {
  preview:  (formData, token) => multipart('/api/v1/imports/preview',  formData, token),
  validate: (formData, token) => multipart('/api/v1/imports/validate', formData, token),
  commit:   (formData, token) => multipart('/api/v1/imports/commit',   formData, token),
  history:  (token)           => request('/api/v1/imports', {}, token),
};

// IoT
export const iotApi = {
  ingest:      (body, token)  => request('/api/v1/iot/reading',   { method: 'POST', body: JSON.stringify(body) }, token),
  simulate:    (token)        => request('/api/v1/iot/simulate',  {}, token),
  alerts:      (token)        => request('/api/v1/iot/alerts',    {}, token),
  acknowledge: (id, token)    => request(`/api/v1/iot/alerts/${id}/acknowledge`, { method: 'PATCH' }, token),
};

// Public Advisories
export const advisoriesApi = {
  list: () => request('/api/v1/advisories'),
};

// Case Events (status timeline)
export const caseEventsApi = {
  list: (reportId, token) => request(`/api/v1/case-events/${reportId}`, {}, token),
};

// Uploads
export const uploadApi = {
  photo: (file, token) => {
    const fd = new FormData();
    fd.append('file', file);
    return multipart('/uploads/photo', fd, token);
  },
};
