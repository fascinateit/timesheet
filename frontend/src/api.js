// src/api.js  –  Centralised API service
const BASE = process.env.REACT_APP_API_URL || "http://localhost:5002/api";

function token() {
  return localStorage.getItem("pp_token");
}

async function req(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (token()) headers["Authorization"] = `Bearer ${token()}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    localStorage.removeItem("pp_token");
    localStorage.removeItem("pp_user");
    window.dispatchEvent(new Event("pp_session_expired"));
    throw new Error("Session expired. Please log in again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login: (u, p) => req("POST", "/auth/login", { username: u, password: p }),
  me: () => req("GET", "/auth/me"),

  // Groups
  getGroups: () => req("GET", "/groups/"),
  createGroup: (d) => req("POST", "/groups/", d),
  updateGroup: (id, d) => req("PUT", `/groups/${id}`, d),
  deleteGroup: (id) => req("DELETE", `/groups/${id}`),

  // Employees
  getEmployees: () => req("GET", "/employees/"),
  getEmployee: (id) => req("GET", `/employees/${id}`),
  createEmployee: (d) => req("POST", "/employees/", d),
  updateEmployee: (id, d) => req("PUT", `/employees/${id}`, d),
  deleteEmployee: (id) => req("DELETE", `/employees/${id}`),
  getEmployeeProjects: (id) => req("GET", `/employees/${id}/projects`),
  updateEmployeeProjects: (id, projectIds) => req("PUT", `/employees/${id}/projects`, { projectIds }),

  // Projects
  getProjects: () => req("GET", "/projects/"),
  createProject: (d) => req("POST", "/projects/", d),
  updateProject: (id, d) => req("PUT", `/projects/${id}`, d),
  deleteProject: (id) => req("DELETE", `/projects/${id}`),

  // Timesheets
  getTimesheets: (params = {}) => req("GET", `/timesheets/?${new URLSearchParams(params)}`),
  createTimesheet: (d) => req("POST", "/timesheets/", d),
  updateTimesheet: (id, d) => req("PUT", `/timesheets/${id}`, d),
  approveTimesheet: (id) => req("PATCH", `/timesheets/${id}/approve`),
  rejectTimesheet: (id) => req("PATCH", `/timesheets/${id}/reject`),
  deleteTimesheet: (id) => req("DELETE", `/timesheets/${id}`),
  submitWeekTimesheets: (startDate, endDate) => req("POST", "/timesheets/submit-week", { startDate, endDate }),

  // Leaves
  getLeaves: (params = {}) => req("GET", `/leaves/?${new URLSearchParams(params)}`),
  createLeave: (d) => req("POST", "/leaves/", d),
  approveLeave: (id) => req("PATCH", `/leaves/${id}/approve`),
  rejectLeave: (id) => req("PATCH", `/leaves/${id}/reject`),
  deleteLeave: (id) => req("DELETE", `/leaves/${id}`),

  // User Accounts
  getAccounts: () => req("GET", "/accounts/"),
  createAccount: (d) => req("POST", "/accounts/", d),
  updateAccount: (id, d) => req("PUT", `/accounts/${id}`, d),
  deleteAccount: (id) => req("DELETE", `/accounts/${id}`),
  updatePassword: (d) => req("PUT", "/auth/password", d),

  // Expenses
  getExpenses: (params = {}) => req("GET", `/expenses/?${new URLSearchParams(params)}`),
  createExpense: (d) => req("POST", "/expenses/", d),
  updateExpense: (id, d) => req("PUT", `/expenses/${id}`, d),
  approveExpense: (id) => req("PATCH", `/expenses/${id}/approve`),
  payExpense: (id) => req("PATCH", `/expenses/${id}/pay`),
  rejectExpense: (id, note) => req("PATCH", `/expenses/${id}/reject`, { note }),
  sendbackExpense: (id, note) => req("PATCH", `/expenses/${id}/sendback`, { note }),
  deleteExpense: (id) => req("DELETE", `/expenses/${id}`),

  uploadExpenseReceipt: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/expenses/upload-receipt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}` },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  // Reports
  getDashboard: () => req("GET", "/reports/dashboard"),
  getProjectReport: (id) => req("GET", `/reports/project/${id}`),

  // Payslips
  getPayslips: (params = {}) => req("GET", `/payslips/?${new URLSearchParams(params)}`),
  generatePayslip: (d) => req("POST", "/payslips/generate", d),
  requestPayslipDownload: (id) => req("POST", `/payslips/${id}/request-download`),
  approvePayslip: (id) => req("POST", `/payslips/${id}/approve`),
  deletePayslip: (id) => req("DELETE", `/payslips/${id}`),

  // Performance
  getGoals: (params = {}) => req("GET", `/performance/goals?${new URLSearchParams(params)}`),
  createGoal: (d) => req("POST", "/performance/goals", d),
  updateGoal: (id, d) => req("PUT", `/performance/goals/${id}`, d),
  deleteGoal: (id) => req("DELETE", `/performance/goals/${id}`),

  getSelfAssessments: (params = {}) => req("GET", `/performance/self-assessments?${new URLSearchParams(params)}`),
  createSelfAssessment: (d) => req("POST", "/performance/self-assessments", d),
  updateSelfAssessment: (id, d) => req("PUT", `/performance/self-assessments/${id}`, d),
  submitSelfAssessment: (id) => req("PATCH", `/performance/self-assessments/${id}/submit`),

  getFeedback: (params = {}) => req("GET", `/performance/feedback?${new URLSearchParams(params)}`),
  createFeedback: (d) => req("POST", "/performance/feedback", d),
  deleteFeedback: (id) => req("DELETE", `/performance/feedback/${id}`),

  getReviews: (params = {}) => req("GET", `/performance/reviews?${new URLSearchParams(params)}`),
  createReview: (d) => req("POST", "/performance/reviews", d),
  updateReview: (id, d) => req("PUT", `/performance/reviews/${id}`, d),
  submitReview: (id) => req("PATCH", `/performance/reviews/${id}/submit`),
  acknowledgeReview: (id) => req("PATCH", `/performance/reviews/${id}/acknowledge`),
  deleteReview: (id) => req("DELETE", `/performance/reviews/${id}`),

  // Documents
  getDocuments: (params = {}) => req("GET", `/documents/?${new URLSearchParams(params)}`),
  createDocument: (d) => req("POST", "/documents/", d),
  updateDocument: (id, d) => req("PUT", `/documents/${id}`, d),
  deleteDocument: (id) => req("DELETE", `/documents/${id}`),

  // Invoices (Project Management)
  getInvoices: () => req("GET", "/invoices/"),
  createInvoice: (d) => req("POST", "/invoices/", d),
  updateInvoice: (id, d) => req("PUT", `/invoices/${id}`, d),
  updateInvoiceStatus: (id, status, payment_received_date, payment_received) => req("PUT", `/invoices/${id}/status`, { status, payment_received_date, payment_received }),
  deleteInvoice: (id) => req("DELETE", `/invoices/${id}`),

  // Company Expenses
  getCompanyExpenses: () => req("GET", "/company-expenses/"),
  createCompanyExpense: (d) => req("POST", "/company-expenses/", d),
  updateCompanyExpense: (id, d) => req("PUT", `/company-expenses/${id}`, d),
  updateCompanyExpenseStatus: (id, status, cleared_date) => req("PUT", `/company-expenses/${id}/status`, { status, cleared_date }),
  deleteCompanyExpense: (id) => req("DELETE", `/company-expenses/${id}`),

  // Clients
  getClients: () => req("GET", "/clients/"),
  createClient: (d) => req("POST", "/clients/", d),
  updateClient: (id, d) => req("PUT", `/clients/${id}`, d),
  deleteClient: (id) => req("DELETE", `/clients/${id}`),

  // Subscriptions
  getSubscriptions: () => req("GET", "/subscriptions/"),
  createSubscription: (d) => req("POST", "/subscriptions/", d),
  updateSubscription: (id, d) => req("PUT", `/subscriptions/${id}`, d),
  deleteSubscription: (id) => req("DELETE", `/subscriptions/${id}`),

  // Assets (Infra)
  getAssets: (params = {}) => req("GET", `/assets/?${new URLSearchParams(params)}`),
  createAsset: (d) => req("POST", "/assets/", d),
  updateAsset: (id, d) => req("PUT", `/assets/${id}`, d),
  assignAsset: (id, d) => req("PATCH", `/assets/${id}/assign`, d),
  deleteAsset: (id) => req("DELETE", `/assets/${id}`),

  // Onboarding
  getOnboardingRecords: () => req("GET", "/onboarding/"),
  getOnboardingRecord: (id) => req("GET", `/onboarding/${id}`),
  createOnboardingRecord: (d) => req("POST", "/onboarding/", d),
  updateOnboardingRecord: (id, d) => req("PUT", `/onboarding/${id}`, d),
  deleteOnboardingRecord: (id) => req("DELETE", `/onboarding/${id}`),
  deleteOnboardingDocument: (rid, did) => req("DELETE", `/onboarding/${rid}/documents/${did}`),
  getSpStatus: () => req("GET", "/onboarding/sp-status"),

  uploadOnboardingDocument: async (rid, docType, file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("doc_type", docType);
    const res = await fetch(`${BASE}/onboarding/${rid}/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}` },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  // Helpdesk / Ticketing
  getHelpdeskStats: () => req("GET", "/helpdesk/stats"),
  getTickets: (params = {}) => req("GET", `/helpdesk/tickets?${new URLSearchParams(params)}`),
  getTicket: (id) => req("GET", `/helpdesk/tickets/${id}`),
  createTicket: (d) => req("POST", "/helpdesk/tickets", d),
  updateTicket: (id, d) => req("PUT", `/helpdesk/tickets/${id}`, d),
  deleteTicket: (id) => req("DELETE", `/helpdesk/tickets/${id}`),
  addTicketComment: (id, d) => req("POST", `/helpdesk/tickets/${id}/comments`, d),

  getDocumentRequests: (params = {}) => req("GET", `/helpdesk/document-requests?${new URLSearchParams(params)}`),
  createDocumentRequest: (d) => req("POST", "/helpdesk/document-requests", d),
  approveDocumentRequest: (id, d) => req("PATCH", `/helpdesk/document-requests/${id}/approve`, d),
  rejectDocumentRequest: (id, d) => req("PATCH", `/helpdesk/document-requests/${id}/reject`, d),
  deleteDocumentRequest: (id) => req("DELETE", `/helpdesk/document-requests/${id}`),

  uploadHelpdeskDocument: async (rid, file) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/helpdesk/document-requests/${rid}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}` },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  getDocumentDownloadUrl: (rid) => `${BASE}/helpdesk/document-requests/${rid}/download`,

};
