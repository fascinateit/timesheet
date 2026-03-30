// src/App.js  –  ProjectPulse (API-connected)
import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip } from "recharts";
import { api } from "./api";

// ── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#0A0D14", surface: "#111520", card: "#161B2A", border: "#1E2740",
  accent: "#3B82F6", accentGlow: "rgba(59,130,246,0.18)", accentDim: "#1D4ED8",
  green: "#10B981", amber: "#F59E0B", red: "#EF4444", purple: "#8B5CF6",
  text: "#E2E8F0", textMuted: "#64748B", textDim: "#94A3B8",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n || 0);
const fmtD = d => { try { return new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d || "—"; } };
const mkAvi = n => (n || "??").split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();

// ── Shared UI ─────────────────────────────────────────────────────────────────
const Badge = ({ color, children }) => (
  <span style={{
    background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 4,
    padding: "2px 8px", fontSize: 11, fontWeight: 600, letterSpacing: .5, textTransform: "uppercase", whiteSpace: "nowrap"
  }}>
    {children}
  </span>
);
const StatusBadge = ({ status }) => {
  const m = {
    active: [C.green, "Active"], approved: [C.green, "Approved"], pending: [C.amber, "Pending"],
    "on-hold": [C.amber, "On Hold"], rejected: [C.red, "Rejected"], inactive: [C.textMuted, "Inactive"]
  };
  const [color, label] = m[status] || [C.textMuted, status];
  return <Badge color={color}>{label}</Badge>;
};
const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, ...style }}>{children}</div>
);
const Btn = ({ onClick, children, variant = "primary", small, style = {}, disabled }) => {
  const s = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    ghost: { background: "transparent", color: C.textDim, border: `1px solid ${C.border}` },
    danger: { background: C.red + "22", color: C.red, border: `1px solid ${C.red}44` },
    success: { background: C.green + "22", color: C.green, border: `1px solid ${C.green}44` }
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...s[variant], borderRadius: 8,
      padding: small ? "5px 12px" : "9px 20px", fontSize: small ? 12 : 13, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center",
      gap: 6, opacity: disabled ? .5 : 1, transition: "opacity .15s", ...style
    }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = ".82" }}
      onMouseLeave={e => { e.currentTarget.style.opacity = "1" }}
    >{children}</button>
  );
};
const Inp = ({ label, value, onChange, type = "text", options, required, placeholder, disabled }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600, letterSpacing: .4 }}>
      {label}{required && <span style={{ color: C.red }}> *</span>}
    </label>}
    {options ? (
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={{
        background: disabled ? C.bg : C.surface, opacity: disabled ? 0.7 : 1,
        border: `1px solid ${C.border}`, borderRadius: 8, color: value ? C.text : C.textMuted,
        padding: "8px 12px", fontSize: 13, outline: "none", cursor: disabled ? "not-allowed" : "pointer"
      }}>
        <option value="">Select…</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    ) : (
      <input type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        placeholder={placeholder} style={{
          background: disabled ? C.bg : C.surface, opacity: disabled ? 0.7 : 1, border: `1px solid ${C.border}`,
          borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 13, outline: "none", width: "100%",
          cursor: disabled ? "not-allowed" : "text"
        }} />
    )}
  </div>
);

const maskStr = v => {
  if (!v) return "—";
  const s = String(v);
  if (s.length <= 4) return "•".repeat(s.length);
  return "•".repeat(s.length - 4) + s.slice(-4);
};

const SensitiveDisplay = ({ value, fontFamily }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: fontFamily || "monospace", fontSize: 14, color: C.text, fontWeight: 600 }}>
        {show ? (value || "—") : maskStr(value)}
      </span>
      {value && (
        <button onClick={() => setShow(s => !s)} style={{
          background: "none", border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer",
          color: C.accent, fontSize: 11, padding: "1px 7px", fontWeight: 600, lineHeight: "18px"
        }}>
          {show ? "Hide" : "View"}
        </button>
      )}
    </span>
  );
};

const SearchableSelect = ({ label, value, onChange, options, placeholder = "Search...", disabled }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter(o => (o?.label || "").toLowerCase().includes(search.toLowerCase()));
  const selected = options.find(o => o?.value === value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }} ref={ref}>
      {label && <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600, letterSpacing: .4 }}>{label}</label>}
      <div
        onClick={() => !disabled && setOpen(!open)}
        style={{
          background: disabled ? C.bg : C.surface, border: `1px solid ${open ? C.accent : C.border}`, opacity: disabled ? 0.7 : 1,
          borderRadius: 8, padding: "8px 12px", color: selected ? C.text : C.textMuted,
          fontSize: 13, cursor: disabled ? "not-allowed" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "center"
        }}
      >
        {selected ? selected.label : "Select..."}
        <span style={{ fontSize: 10 }}>▼</span>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 100,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", flexDirection: "column"
        }}>
          <input
            autoFocus type="text" placeholder={placeholder} value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: "10px 12px", border: "none", borderBottom: `1px solid ${C.border}`, background: C.surface, outline: "none", fontSize: 13, color: C.text }}
          />
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            <div onClick={() => { onChange(""); setOpen(false); setSearch(""); }} style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", color: C.textMuted, background: !value ? C.surface : "transparent" }}>
              None
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: "8px 12px", fontSize: 13, color: C.textMuted }}>No matches found</div>
            ) : (
              filtered.map(o => (
                <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                  style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", color: C.text, background: o.value === value ? C.surface : "transparent" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surface}
                  onMouseLeave={e => e.currentTarget.style.background = o.value === value ? C.surface : "transparent"}
                >
                  {o.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
// ── Dialog (replaces window.alert / window.confirm) ──────────────────────────
let _setDialogState;
const dialog = {
  alert: (message, { title = "Notice", dtype = "info" } = {}) =>
    new Promise(resolve => {
      _setDialogState({ kind: "alert", title, message, dtype, onOk: () => { _setDialogState(null); resolve(); } });
    }),
  confirm: (message, { title = "Confirm", dtype = "warning" } = {}) =>
    new Promise(resolve => {
      _setDialogState({
        kind: "confirm", title, message, dtype,
        onOk:     () => { _setDialogState(null); resolve(true); },
        onCancel: () => { _setDialogState(null); resolve(false); },
      });
    }),
};
function DialogProvider() {
  const [state, setState] = useState(null);
  _setDialogState = setState;
  if (!state) return null;
  const icons = { info: "ℹ️", warning: "⚠️", error: "❌", success: "✅" };
  const colors = { info: C.accent, warning: C.amber, error: C.red, success: C.green };
  const color = colors[state.dtype] || C.accent;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${color}55`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 22 }}>
          <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{icons[state.dtype] || "ℹ️"}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>{state.title}</div>
            <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6 }}>{state.message}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {state.kind === "confirm" && (
            <button onClick={state.onCancel} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.textDim, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          )}
          <button onClick={state.onOk} style={{ background: color, color: "#fff", border: "none", borderRadius: 8, padding: "8px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>OK</button>
        </div>
      </div>
    </div>
  );
}

const Modal = ({ title, onClose, children, maxWidth = 520 }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20
  }} onClick={onClose}>
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28,
      width: "100%", maxWidth, maxHeight: "88vh", overflowY: "auto"
    }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 20, cursor: "pointer" }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);
const ProgressBar = ({ value, max, color = C.accent }) => {
  const pct = Math.min(((value || 0) / (max || 1)) * 100, 100);
  const bar = pct > 85 ? C.red : pct > 65 ? C.amber : color;
  return <div style={{ background: C.surface, borderRadius: 4, height: 6, overflow: "hidden" }}>
    <div style={{ width: `${pct}%`, height: "100%", background: bar, borderRadius: 4, transition: "width .4s" }} />
  </div>;
};
const Avatar = ({ initials: i, color = C.accent, size = 32 }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%", background: color + "33",
    border: `1.5px solid ${color}66`, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * .35, fontWeight: 700, color, flexShrink: 0
  }}>{i || "??"}</div>
);
const Th = ({ children }) => (
  <th style={{
    textAlign: "left", fontSize: 11, color: C.textMuted, fontWeight: 600, padding: "12px 14px",
    letterSpacing: .5, textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap"
  }}>
    {children}
  </th>
);
const Td = ({ children, style = {} }) => <td style={{ padding: "11px 14px", ...style }}>{children}</td>;

const Spinner = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
    <div style={{
      width: 32, height: 32, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`,
      borderRadius: "50%", animation: "spin .8s linear infinite"
    }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const ErrBox = ({ msg, onRetry }) => (
  <div style={{
    background: C.red + "14", border: `1px solid ${C.red}33`, borderRadius: 10, padding: "16px 20px",
    display: "flex", justifyContent: "space-between", alignItems: "center"
  }}>
    <span style={{ fontSize: 13, color: C.red }}>⚠ {msg}</span>
    {onRetry && <Btn small variant="danger" onClick={onRetry}>Retry</Btn>}
  </div>
);

// ════════════════════════════════════════════════════════
// CLIENT MANAGEMENT
// ════════════════════════════════════════════════════════
function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { setClients(await api.getClients()); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    setSaving(true);
    try {
      if (modal === "new") await api.createClient(form);
      else await api.updateClient(modal.id, form);
      setModal(null); load();
    } catch (e) { dialog.alert("Error: " + e.message, { title: "Error", dtype: "error" }); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!await dialog.confirm("Are you sure you want to delete this client?", { dtype: "warning" })) return;
    try { await api.deleteClient(id); load(); }
    catch (e) { dialog.alert("Error: " + e.message, { title: "Error", dtype: "error" }); }
  };

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text }}>Client Management</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Manage clients for invoicing and projects.</p>
        </div>
        <Btn onClick={() => setModal("new")}>+ Add Client</Btn>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: C.surface }}><tr>
              <Th>Client Name</Th><Th>Email</Th><Th>Phone</Th><Th>GST Number</Th><Th>Pay Day</Th><Th>Actions</Th>
            </tr></thead>
            <tbody>
              {clients.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}22`, background: idx % 2 === 0 ? "transparent" : C.bg + "44" }}>
                  <Td style={{ fontWeight: 700, color: C.text }}>{c.client_name}</Td>
                  <Td style={{ color: C.textMuted, fontSize: 12 }}>
                    {c.email ? <a href={`mailto:${c.email}`} style={{ color: C.accent, textDecoration: "none" }}>{c.email}</a> : "—"}
                  </Td>
                  <Td style={{ color: C.textMuted, fontSize: 12 }}>
                    {c.phone_number ? <a href={`tel:${c.phone_number}`} style={{ color: C.text, textDecoration: "none" }}>{c.phone_number}</a> : "—"}
                  </Td>
                  <Td style={{ color: C.textMuted, fontSize: 12 }}>{c.gst_number || "—"}</Td>
                  <Td style={{ fontSize: 12 }}>{c.pay_day ? `Day ${c.pay_day}` : "—"}</Td>
                  <Td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn small variant="ghost" onClick={() => setModal(c)}>✏</Btn>
                      <Btn small variant="danger" onClick={() => del(c.id)}>🗑</Btn>
                    </div>
                  </Td>
                </tr>
              ))}
              {clients.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No clients found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {modal && (
        <Modal title={modal === "new" ? "Add Client" : "Edit Client"} onClose={() => setModal(null)}>
          <ClientForm init={modal === "new" ? { client_name: "", email: "", phone_number: "", address: "", pay_day: "", gst_number: "" } : modal} saving={saving} onCancel={() => setModal(null)} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

function ClientForm({ init, saving, onCancel, onSave }) {
  const [form, setForm] = useState({
    client_name: init.client_name || "", email: init.email || "",
    phone_number: init.phone_number || "", address: init.address || "",
    pay_day: init.pay_day || "", gst_number: init.gst_number || ""
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Inp label="Client Name" value={form.client_name} onChange={v => setForm(f => ({ ...f, client_name: v }))} required />
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Email" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="contact@client.com" />
        <Inp label="Phone Number" value={form.phone_number} onChange={v => setForm(f => ({ ...f, phone_number: v }))} placeholder="+91 98765 43210" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>Billing Address</label>
        <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 13, minHeight: 80, outline: "none", resize: "vertical" }}
          placeholder="Client billing address..." />
      </div>
      <Inp label="GST Number" value={form.gst_number || ""} onChange={v => setForm(f => ({ ...f, gst_number: v }))} placeholder="e.g. 29AAFCF9723K1Z3" />
      <Inp label="Expected Pay Day (1-31)" type="number" value={form.pay_day || ""} onChange={v => setForm(f => ({ ...f, pay_day: v }))} placeholder="e.g. 28" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={() => onSave(form)} disabled={saving}>{saving ? "Saving…" : "Save Client"}</Btn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// PROJECT MANAGEMENT & INVOICES
function ProjectDashboard({ projects, invoices }) {
  const [filterStr, setFilterStr] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = projects.filter(p => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterStr && !p.name.toLowerCase().includes(filterStr.toLowerCase()) && !p.code.toLowerCase().includes(filterStr.toLowerCase())) return false;
    return true;
  });

  const totalBudget = filtered.reduce((acc, p) => p.status === 'active' ? acc + parseFloat(p.budget || 0) : acc, 0);
  const totalBurned = filtered.reduce((acc, p) => p.status === 'active' ? acc + parseFloat(p.burned || 0) : acc, 0);
  const { totalRaised, pendingRaised, clearedRaised } = filtered.reduce((acc, p) => {
    const pInvoices = invoices.filter(i => i.project_id === p.id);
    const pTotal = pInvoices.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const pPending = pInvoices.filter(i => i.status === "pending").reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const pCleared = pInvoices.filter(i => i.status === "cleared").reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    return {
      totalRaised: acc.totalRaised + pTotal,
      pendingRaised: acc.pendingRaised + pPending,
      clearedRaised: acc.clearedRaised + pCleared
    };
  }, { totalRaised: 0, pendingRaised: 0, clearedRaised: 0 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Global Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
        <Card style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 8, background: `linear-gradient(145deg, ${C.surface}, ${C.card})`, border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: C.textDim, fontWeight: 700, textTransform: "uppercase" }}>Total Client Budget</span>
            <span style={{ background: C.accent + "33", color: C.accent, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 800 }}>{filtered.length} Projects</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: C.text }}>{fmt$(totalBudget)}</div>
        </Card>

        <Card style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, background: `linear-gradient(145deg, ${C.surface}, ${C.card})`, border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: C.textDim, fontWeight: 700, textTransform: "uppercase" }}>Total Amount Raised</span>
            <span style={{ background: C.green + "33", color: C.green, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 800 }}>Via Invoices</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: C.green }}>{fmt$(totalRaised)}</div>

          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
            <div style={{ background: C.bg, padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Pending</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>{fmt$(pendingRaised)}</div>
            </div>
            <div style={{ background: C.bg, padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Cleared</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{fmt$(clearedRaised)}</div>
            </div>
          </div>
        </Card>

        <Card style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, background: `linear-gradient(145deg, ${C.surface}, ${C.card})`, border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: C.textDim, fontWeight: 700, textTransform: "uppercase" }}>Total Burned Cost</span>
            <span style={{ background: C.amber + "33", color: C.amber, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 800 }}>Via Timesheets</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: C.amber }}>{fmt$(totalBurned)}</div>
        </Card>
      </div>
      {/* Aggregate Recharts Visualization */}
      {
        filtered.length > 0 && (
          <Card style={{ padding: "24px 24px", display: "flex", flexDirection: "column", gap: 16, background: C.surface, border: `1px solid ${C.border}` }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>Budget vs Raised Analytics</h3>
            <div style={{ width: "100%", height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filtered.filter(p => p.status === 'active').map(p => ({
                    name: p.code,
                    fullName: p.name,
                    Budget: parseFloat(p.budget || 0),
                    Raised: invoices.filter(i => i.project_id === p.id).reduce((s, i) => s + parseFloat(i.amount || 0), 0),
                    Burned: parseFloat(p.burned || 0)
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="name" stroke={C.textMuted} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={C.textMuted} fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                  <Tooltip
                    cursor={{ fill: C.surface, opacity: 0.8 }}
                    contentStyle={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }}
                    itemStyle={{ fontSize: 13, fontWeight: 700 }}
                    formatter={(value, name) => [fmt$(value), name]}
                    labelStyle={{ color: C.textDim, fontWeight: 700, marginBottom: 8, fontSize: 12 }}
                    labelFormatter={(name, payload) => payload?.[0]?.payload?.fullName || name}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: 20, fontSize: 13, color: C.text }} />
                  <Bar dataKey="Budget" fill={C.accent} radius={[4, 4, 0, 0]} barSize={25} />
                  <Bar dataKey="Raised" fill={C.green} radius={[4, 4, 0, 0]} barSize={25} />
                  <Bar dataKey="Burned" fill={C.amber} radius={[4, 4, 0, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )
      }

      {/* Filters */}
      <Card style={{ padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: C.surface }}>
        <input
          type="text"
          placeholder="Search by project name or code..."
          value={filterStr}
          onChange={e => setFilterStr(e.target.value)}
          style={{ flex: 1, minWidth: 200, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "10px 14px", fontSize: 13, outline: "none" }}
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ width: 160, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: filterStatus !== "all" ? C.text : C.textMuted, padding: "10px 14px", fontSize: 13, outline: "none", cursor: "pointer" }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="on-hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="closed">Closed</option>
        </select>
      </Card>

      {/* Project Bar Chart Grid */}
      <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.textMuted, background: C.card, borderRadius: 12 }}>No projects match your filters.</div>
        ) : (
          filtered.map(p => {
            const raised = invoices.filter(i => i.project_id === p.id).reduce((s, i) => s + parseFloat(i.amount || 0), 0);
            const budget = parseFloat(p.budget || 0);
            const burned = parseFloat(p.burned || 0);
            const highest = Math.max(budget, raised, burned, 1); // Avoid div by zero
            const budgetPct = (budget / highest) * 100;
            const raisedPct = (raised / highest) * 100;
            const burnedPct = (burned / highest) * 100;
            const isOverBudget = raised > budget;

            return (
              <Card key={p.id} style={{ display: "flex", flexDirection: "column", gap: 14, padding: "20px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{p.name}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{p.code}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>Balance Pending View</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: isOverBudget ? C.red : C.text }}>{fmt$(budget - raised)}</span>
                  </div>
                </div>

                {/* Dual Bar System */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  {/* Row: Budget */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 70, fontSize: 11, color: C.textDim, fontWeight: 700, textAlign: "right", letterSpacing: .5 }}>BUDGET</div>
                    <div style={{ flex: 1, background: C.surface, height: 24, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
                      <div style={{ width: `${budgetPct}%`, height: "100%", background: C.accent, borderRadius: 12, transition: "width .3s ease" }} />
                    </div>
                    <div style={{ width: 90, fontSize: 13, fontWeight: 700, color: C.accent }}>{fmt$(budget)}</div>
                  </div>

                  {/* Row: Raised */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 70, fontSize: 11, color: C.textDim, fontWeight: 700, textAlign: "right", letterSpacing: .5 }}>RAISED</div>
                    <div style={{ flex: 1, background: C.surface, height: 20, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
                      <div style={{ width: `${raisedPct}%`, height: "100%", background: isOverBudget ? C.red : C.green, borderRadius: 10, transition: "width .3s ease" }} />
                    </div>
                    <div style={{ width: 90, fontSize: 13, fontWeight: 700, color: isOverBudget ? C.red : C.green }}>{fmt$(raised)}</div>
                  </div>

                  {/* Row: Burned */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 70, fontSize: 11, color: C.textDim, fontWeight: 700, textAlign: "right", letterSpacing: .5 }}>BURNED</div>
                    <div style={{ flex: 1, background: C.surface, height: 20, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
                      <div style={{ width: `${burnedPct}%`, height: "100%", background: C.amber, borderRadius: 10, transition: "width .3s ease" }} />
                    </div>
                    <div style={{ width: 90, fontSize: 13, fontWeight: 700, color: C.amber }}>{fmt$(burned)}</div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div >
  );
}

function ProjectManagement({ readOnly = false, currentUser }) {
  const [tab, setTab] = useState("dashboard");
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [clearModal, setClearModal] = useState(null);  // null | invoice object
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  // List Filters
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [inv, prj, cls] = await Promise.all([api.getInvoices(), api.getProjects(), api.getClients()]);
      setInvoices(inv); setProjects(prj); setClients(cls);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  });
  useEffect(() => { load(); }, []);

  async function handleToggleStatus(inv) {
    if (inv.status !== "cleared") {
      // Show modal to collect payment received date (pending or partial)
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentAmount(inv.status === "partial" && inv.balance_amount != null ? inv.balance_amount : (inv.amount || ""));
      setClearModal(inv);
    } else {
      // Revert to pending immediately
      try {
        await api.updateInvoiceStatus(inv.id, "pending");
        await load();
      } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    }
  }

  async function handleConfirmCleared() {
    if (!clearModal) return;
    try {
      await api.updateInvoiceStatus(clearModal.id, "cleared", paymentDate || null, paymentAmount !== "" ? paymentAmount : null);
      setClearModal(null); setPaymentDate(""); setPaymentAmount("");
      await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  async function handleDelete(id) {
    if (!await dialog.confirm("Are you sure you want to delete this invoice?", { dtype: "warning" })) return;
    try {
      await api.deleteInvoice(id);
      await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  const parseTaskNames = (rawStr) => {
    try {
      const parsed = JSON.parse(rawStr);
      if (Array.isArray(parsed)) return parsed.map(p => p.description).join(", ");
    } catch { }
    return rawStr || "—";
  };

  function handleDownloadCSV(filteredInvoices) {
    if (!filteredInvoices.length) { dialog.alert("No invoices to export."); return; }
    const fmtCsvDate = d => {
      if (!d) return "";
      const dt = new Date(d);
      if (isNaN(dt)) return d;
      return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    };
    const headers = ["Project Code", "Project Name", "Task / Deliverables", "Amount Raised (INR)", "Date Raised", "Payment Due Date", "Payment Received (INR)", "Payment Received Date", "Clearance Status"];
    const rows = filteredInvoices.map(inv => [
      inv.project_code,
      `"${inv.project_name.replace(/"/g, '""')}"`,
      `"${parseTaskNames(inv.task_details).replace(/"/g, '""')}"`,
      inv.amount,
      fmtCsvDate(inv.raised_date),
      fmtCsvDate(inv.payment_due_date),
      inv.payment_received != null ? inv.payment_received : "",
      fmtCsvDate(inv.payment_received_date),
      inv.status.toUpperCase()
    ]);
    const csvStr = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvStr], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && tab === "invoices") return <Spinner />;
  if (err && tab === "invoices") return <ErrBox msg={err} onRetry={load} />;

  const activeProjects = projects.filter(p => p.status === "active");
  const filteredInvoices = invoices.filter(i => {
    if (filterProject !== "all" && i.project_id.toString() !== filterProject) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Project Management & Ledger</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Monitor client budgets & track company expenses or invoices</p></div>
        {!readOnly && tab === "invoices" && <Btn onClick={() => setModal(true)}>+ Raise Invoice</Btn>}
        {!readOnly && tab === "company_expenses" && <Btn onClick={() => setModal("newExpense")}>+ Add Expense</Btn>}
      </div>

      <div style={{ display: "flex", gap: 4, background: C.surface, padding: 4, borderRadius: 10, width: "fit-content", overflowX: "auto" }}>
        {["dashboard", "invoices", "company_expenses", "clients", "projects"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? C.card : "transparent", color: tab === t ? C.text : C.textMuted,
            border: tab === t ? `1px solid ${C.border}` : "1px solid transparent",
            borderRadius: 8, padding: "6px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize"
          }}>{t === "dashboard" ? "Dashboard" : t === "company_expenses" ? "Company Expenses" : t === "clients" ? "Clients" : t === "projects" ? "Projects" : "Client Budgets & Invoiced"}</button>
        ))}
      </div>

      {tab === "dashboard" && <ProjectDashboard projects={projects} invoices={invoices} />}

      {tab === "invoices" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Project Budget Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
            {activeProjects.map(p => {
              const projectInvoices = invoices.filter(i => i.project_id === p.id);
              const amountRaised = projectInvoices.reduce((acc, i) => acc + parseFloat(i.amount || 0), 0);
              const balancePending = p.budget - amountRaised;
              const pct = ((amountRaised / p.budget) * 100).toFixed(1);
              return (
                <Card key={p.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, letterSpacing: .5 }}>{p.code}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginTop: 4 }}>{p.name}</div>
                    </div>
                  </div>
                  <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: C.surface, borderRadius: 8, padding: "8px 12px" }}>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Client Budget</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt$(p.budget)}</div>
                    </div>
                    <div style={{ background: C.surface, borderRadius: 8, padding: "8px 12px", border: `1px solid ${pct > 95 ? C.amber : 'transparent'}` }}>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Amount Raised</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{fmt$(amountRaised)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: C.textMuted }}>Pending to Raise: <span style={{ fontWeight: 600, color: C.text }}>{fmt$(balancePending)}</span></div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: pct > 85 ? C.red : C.accent }}>{pct}% utilized</div>
                  </div>
                  <ProgressBar value={amountRaised} max={p.budget} />
                </Card>
              );
            })}
          </div>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>Raised Invoices</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`, color: filterProject !== "all" ? C.text : C.textMuted, fontSize: 12, outline: "none", cursor: "pointer" }}>
                    <option value="all">All Projects</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`, color: filterStatus !== "all" ? C.text : C.textMuted, fontSize: 12, outline: "none", cursor: "pointer" }}>
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="cleared">Cleared</option>
                  </select>
                </div>
              </div>
              <Btn small variant="ghost" onClick={() => handleDownloadCSV(filteredInvoices)}>⬇ Download CSV</Btn>
            </div>
            {filteredInvoices.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>No invoices match your filters.</div>
            ) : (
              <div className="resp-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>Project & Client</Th>
                      <Th>Task / Deliverables</Th>
                      <Th>Amount Raised</Th>
                      <Th>Date Raised</Th>
                      <Th>Payment Due Date</Th>
                      <Th>Payment Received</Th>
                      <Th>Clearance Status</Th>
                      {!readOnly && <Th>Action</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <Td>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{inv.invoice_number}</div>
                          {inv.parent_invoice_number && (
                            <div style={{ fontSize: 11, color: "#f97316", marginBottom: 2 }}>
                              ↳ Balance of {inv.parent_invoice_number}
                            </div>
                          )}
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{inv.client_name || inv.project_name}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{inv.project_code}</div>
                        </Td>
                        <Td>
                          <div style={{ fontSize: 13, color: C.textMuted, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={parseTaskNames(inv.task_details)}>{parseTaskNames(inv.task_details)}</div>
                        </Td>
                        <Td>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt$(inv.amount)}</div>
                        </Td>
                        <Td><div style={{ fontSize: 13, color: C.textMuted }}>{fmtD(inv.raised_date)}</div></Td>
                        <Td><div style={{ fontSize: 13, color: C.textMuted }}>{inv.payment_due_date ? fmtD(inv.payment_due_date) : "—"}</div></Td>
                        <Td>
                          {inv.payment_received_date || inv.payment_received
                            ? <div>
                              {inv.payment_received != null && <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{fmt$(inv.payment_received)}</div>}
                              {inv.payment_received_date && <div style={{ fontSize: 12, color: C.textMuted }}>{fmtD(inv.payment_received_date)}</div>}
                            </div>
                            : <span style={{ fontSize: 12, color: C.textMuted }}>—</span>}
                        </Td>
                        <Td>
                          <Badge color={inv.status === "cleared" ? C.green : inv.status === "partial" ? "#f97316" : C.amber}>
                            {inv.status}
                          </Badge>
                          {inv.status === "partial" && inv.balance_amount != null && (
                            <div style={{ fontSize: 11, color: "#f97316", marginTop: 3, fontWeight: 600 }}>
                              Balance: {fmt$(inv.balance_amount)}
                            </div>
                          )}
                        </Td>
                        {!readOnly && (
                          <Td>
                            <div style={{ display: "flex", gap: 8 }}>
                              <Btn small variant="ghost" onClick={() => setViewInvoice(inv)}>👁</Btn>
                              <Btn small variant={inv.status === "cleared" ? "ghost" : "success"}
                                onClick={() => handleToggleStatus(inv)}>
                                {inv.status === "cleared" ? "Mark Pending" : "Mark Cleared"}
                              </Btn>
                              <Btn small variant="ghost" onClick={() => { setEditInvoice(inv); setModal("edit"); }}>✏</Btn>
                              <Btn small variant="danger" onClick={() => handleDelete(inv.id)}>🗑</Btn>
                            </div>
                          </Td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {clearModal && (() => {
        const raisedAmt = parseFloat(clearModal.amount || 0);
        const receivedAmt = parseFloat(paymentAmount || 0);
        const diff = raisedAmt - receivedAmt;
        const hasShortfall = paymentAmount !== "" && diff > 0.005;
        const hasOverpay = paymentAmount !== "" && diff < -0.005;
        return (
          <Modal title="Mark Invoice as Cleared" onClose={() => setClearModal(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Invoice summary */}
              <div style={{ background: C.surface, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Invoice</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{clearModal.invoice_number || clearModal.client_name || clearModal.project_name}</div>
                <div style={{ display: "flex", gap: 20, marginTop: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>Amount Raised</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt$(raisedAmt)}</div>
                  </div>
                  {clearModal.parent_invoice_number && (
                    <div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>Parent Invoice</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#f97316" }}>{clearModal.parent_invoice_number}</div>
                    </div>
                  )}
                </div>
              </div>

              <Inp label="Payment Received Date" type="date" value={paymentDate} onChange={v => setPaymentDate(v)} required />
              <Inp
                label="Payment Received Amount (₹)"
                type="number"
                value={paymentAmount}
                onChange={v => setPaymentAmount(v)}
                placeholder={`Full amount: ${fmt$(raisedAmt)}`}
              />

              {/* Difference indicator */}
              {hasShortfall && (
                <div style={{ background: "#f9731622", border: "1px solid #f97316", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f97316", marginBottom: 4 }}>⚠ Shortfall Detected</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textDim }}>
                    <span>Amount Raised</span><span style={{ fontWeight: 700 }}>{fmt$(raisedAmt)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textDim }}>
                    <span>Payment Received</span><span style={{ fontWeight: 700, color: C.green }}>{fmt$(receivedAmt)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: `1px solid #f9731644`, marginTop: 6, paddingTop: 6 }}>
                    <span style={{ fontWeight: 700, color: "#f97316" }}>Balance Due</span>
                    <span style={{ fontWeight: 800, color: "#f97316" }}>{fmt$(diff)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
                    {(() => {
                      const rootNum = (clearModal.invoice_number || "").replace(/^(BAL-\d{4}-)+/, "");
                      const mmdd = new Date().toLocaleDateString("en-GB", { month: "2-digit", day: "2-digit" }).replace("/", "");
                      return <>Invoice will be marked <strong>partial</strong>. A new balance invoice <strong>BAL-{mmdd}-{rootNum}</strong> (₹{diff.toLocaleString("en-IN", { minimumFractionDigits: 2 })}) will be auto-created and linked to this invoice.</>;
                    })()}
                  </div>
                </div>
              )}
              {hasOverpay && (
                <div style={{ background: C.green + "22", border: `1px solid ${C.green}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.green }}>
                  ℹ Overpayment of {fmt$(Math.abs(diff))} detected. Invoice will be marked cleared.
                </div>
              )}
              {paymentAmount !== "" && !hasShortfall && !hasOverpay && (
                <div style={{ background: C.green + "22", border: `1px solid ${C.green}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.green }}>
                  ✓ Full payment. Invoice will be marked cleared.
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <Btn variant="ghost" onClick={() => setClearModal(null)}>Cancel</Btn>
                <Btn variant="success" onClick={handleConfirmCleared}>
                  {hasShortfall ? "✓ Confirm Partial Payment" : "✓ Confirm Cleared"}
                </Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {modal && (
        <Modal title={modal === "edit" ? "Edit Invoice" : "Raise New Invoice"} onClose={() => { setModal(false); setEditInvoice(null); }}>
          <InvoiceForm
            projects={projects}
            clients={clients}
            initialData={modal === "edit" ? editInvoice : null}
            saving={saving}
            onCancel={() => { setModal(false); setEditInvoice(null); }}
            onSave={async (form) => {
              setSaving(true);
              try {
                if (modal === "edit") {
                  await api.updateInvoice(editInvoice.id, form);
                } else {
                  await api.createInvoice(form);
                }
                setModal(false);
                setEditInvoice(null);
                await load();
              } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
            }}
          />
        </Modal>
      )}

      {tab === "company_expenses" && (
        <CompanyExpenses modal={modal} setModal={setModal} currentUser={currentUser} projects={projects} />
      )}

      {tab === "clients" && <AdminClients />}

      {tab === "projects" && <Projects readOnly={readOnly} />}

      {viewInvoice && (
        <Modal title="Invoice Preview" onClose={() => setViewInvoice(null)} maxWidth="100%">
          <div style={{ maxHeight: "75vh", overflowY: "auto", position: "relative" }}>
            <InvoicePrintPreview invoice={viewInvoice} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setViewInvoice(null)}>Close</Btn>
            <Btn onClick={() => {
              const printContent = document.getElementById("invoice-print-area").outerHTML;
              const originalContent = document.body.innerHTML;
              const oldTitle = document.title;
              const safeClient = (viewInvoice?.client_name || "Client").replace(/[^a-zA-Z0-9]/g, "_");
              const safeInv = (viewInvoice?.invoice_number || "Invoice").replace(/[^a-zA-Z0-9]/g, "_");
              const today = new Date().toISOString().split('T')[0];
              document.title = `${safeClient}_${safeInv}_${today}`;
              document.body.innerHTML = `<style>${STYLE}</style><div style="padding: 40px; box-sizing: border-box; width: 100%; min-height: 100vh;">` + printContent + `</div>`;
              setTimeout(() => {
                window.print();
                document.title = oldTitle;
                document.body.innerHTML = originalContent;
                window.location.reload();
              }, 150);
            }}>🖨 Print Invoice</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CompanyExpenses({ modal, setModal, currentUser, projects }) {
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [editObj, setEditObj] = useState(null);
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterClearedMonth, setFilterClearedMonth] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [chartOffset, setChartOffset] = useState(0);
  const [clearModal, setClearModal] = useState(null); // { id, clearedDate }

  const initForm = { expenseDate: "", purpose: "", amount: "", paidBy: "", itrType: "", taxType: "", gstAmount: "", status: "pending" };
  const [form, setForm] = useState({ ...initForm });

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [exps, emps] = await Promise.all([api.getCompanyExpenses(), api.getEmployees()]);
      setExpenses(exps);
      setEmployees(emps);
    }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (modal === "editExpense" && editObj) {
      setForm({ ...editObj, expenseDate: editObj.expense_date, itrType: editObj.itr_type || "", taxType: editObj.tax_type || "", gstAmount: editObj.gst_amount || "", paidBy: editObj.paid_by });
    } else if (modal === "newExpense") {
      setForm({ ...initForm });
    }
  }, [modal, editObj]);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true); setErr("");
    try {
      if (modal === "editExpense" && editObj) {
        await api.updateCompanyExpense(editObj.id, form);
      } else {
        await api.createCompanyExpense(form);
      }
      setModal(false); setEditObj(null);
      await load();
    } catch (ex) { setErr(ex.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!await dialog.confirm("Are you sure you want to delete this expense?", { dtype: "warning" })) return;
    try {
      await api.deleteCompanyExpense(id);
      await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  async function handleToggleStatus(id, newStatus, clearedDate) {
    try {
      await api.updateCompanyExpenseStatus(id, newStatus, clearedDate || null);
      await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  function handleDownloadCSV() {
    if (!filteredList || !filteredList.length) { dialog.alert("No company expenses to export."); return; }
    const headers = ["Expense Date", "Purpose", "Amount (INR)", "GST Amount (INR)", "Total Amount (INR)", "Paid By", "ITR Type", "Tax Type", "Status", "Cleared Date"];
    const rows = filteredList.map(e => {
      const [yr, mo, da] = (e.expense_date || "").split("-");
      const fmtDate = yr && mo && da ? `${da}-${mo}-${yr}` : e.expense_date;
      const [cyr, cmo, cda] = (e.cleared_date || "").split("-");
      const fmtCleared = cyr && cmo && cda ? `${cda}-${cmo}-${cyr}` : (e.cleared_date || "");
      const total = (parseFloat(e.amount) || 0) + (parseFloat(e.gst_amount) || 0);
      return [
        fmtDate,
        `"${(e.purpose || "").replace(/"/g, '""')}"`,
        e.amount,
        e.gst_amount || 0,
        total.toFixed(2),
        `"${(e.paid_by || "").replace(/"/g, '""')}"`,
        e.itr_type || "",
        e.tax_type || "",
        e.status.toUpperCase(),
        fmtCleared
      ];
    });
    const totalAmount = filteredList.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalGst = filteredList.reduce((sum, e) => sum + (parseFloat(e.gst_amount) || 0), 0);
    const grandTotal = totalAmount + totalGst;
    const totalRow = ["", "TOTAL", totalAmount.toFixed(2), totalGst.toFixed(2), grandTotal.toFixed(2), "", "", "", "", ""];
    const csvStr = [headers.join(","), ...rows.map(r => r.join(",")), totalRow.join(",")].join("\n");
    const blob = new Blob([csvStr], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `company-expenses-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Spinner />;

  const totalExpenses = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0) + (parseFloat(curr.gst_amount) || 0), 0);

  // Apply chart window offset
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i - (chartOffset * 6));
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    last6Months.push(`${yr}-${mo}`);
  }

  const chartDataMap = {};
  const monthOptions = Array.from(new Set(expenses.map(e => e.expense_date?.slice(0, 7)).filter(Boolean))).sort().reverse();
  const clearedMonthOptions = Array.from(new Set(expenses.filter(e => e.cleared_date).map(e => e.cleared_date?.slice(0, 7)).filter(Boolean))).sort().reverse();
  const filteredList = expenses.filter(e => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (filterMonth !== "all" && !e.expense_date?.startsWith(filterMonth)) return false;
    if (filterClearedMonth !== "all" && !e.cleared_date?.startsWith(filterClearedMonth)) return false;
    return true;
  });
  const filteredTotal = filteredList.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0) + (parseFloat(curr.gst_amount) || 0), 0);

  const chartData = last6Months.map(m => {
    const amt = expenses.filter(e => e.expense_date?.startsWith(m)).reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0) + (parseFloat(curr.gst_amount) || 0), 0);
    return { name: new Date(m + "-01T12:00:00").toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), amount: amt };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Card>
          <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 700, letterSpacing: .5 }}>TOTAL EXPENSES (ALL TIME)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 8 }}>{fmt$(totalExpenses)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 700, letterSpacing: .5, marginBottom: 8 }}>FILTERED EXPENSES</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginBottom: 14 }}>{fmt$(filteredTotal)}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setFilterMonth("all"); setFilterClearedMonth("all"); }} style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", outline: "none", fontSize: 13 }}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="cleared">Cleared</option>
              <option value="sent to auditing">Sent to Auditing</option>
            </select>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", outline: "none", fontSize: 13 }}>
              <option value="all">All Expense Months</option>
              {monthOptions.map(m => <option key={m} value={m}>{new Date(m + "-01T12:00:00").toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</option>)}
            </select>
            <select value={filterClearedMonth} onChange={e => setFilterClearedMonth(e.target.value)} style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", outline: "none", fontSize: 13 }}>
              <option value="all">All Cleared Months</option>
              {clearedMonthOptions.map(m => <option key={m} value={m}>{new Date(m + "-01T12:00:00").toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</option>)}
            </select>
          </div>
        </Card>
      </div>


      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>Monthly Trace</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" small onClick={() => setChartOffset(o => o + 1)}>← Prev 6 Months</Btn>
            <Btn variant="ghost" small onClick={() => setChartOffset(o => Math.max(0, o - 1))} disabled={chartOffset === 0}>Next 6 Months →</Btn>
          </div>
        </div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke={C.border} tick={{ fill: C.textMuted, fontSize: 12 }} />
              <YAxis stroke={C.border} tick={{ fill: C.textMuted, fontSize: 12 }} tickFormatter={v => `₹${v / 1000}k`} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} itemStyle={{ color: C.amber }} />
              <Bar dataKey="amount" fill={C.amber} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>Company Expenses Ledger</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="outline" onClick={handleDownloadCSV} disabled={!filteredList.length}>⬇ Export Excel</Btn>
          </div>
        </div>

        {err && <div style={{ background: C.red + "18", color: C.red, padding: "10px 14px", borderRadius: 8, fontSize: 13, border: `1px solid ${C.red}44`, marginBottom: 16 }}>⚠ {err}</div>}

        {!filteredList.length ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: C.textMuted }}>No company expenses recorded yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Expense Date</Th>
                  <Th>Purpose</Th>
                  <Th>Amount</Th>
                  <Th>GST Amount</Th>
                  <Th>Total Amount</Th>
                  <Th>Paid By</Th>
                  <Th>ITR / Tax Type</Th>
                  <Th>Status</Th>
                  <Th>Cleared Date</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(exp => {
                  const [yr, mo, da] = (exp.expense_date || "").split("-");
                  const fmtDmy = yr && mo && da ? `${da}-${mo}-${yr}` : exp.expense_date;
                  return (
                    <tr key={exp.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <Td><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{fmtDmy}</div></Td>
                      <Td><div style={{ fontSize: 13, color: C.textMuted }}>{exp.purpose}</div></Td>
                      <Td><div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt$(exp.amount)}</div></Td>
                      <Td><div style={{ fontSize: 13, color: C.textMuted }}>{fmt$(exp.gst_amount || 0)}</div></Td>
                      <Td><div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{fmt$((parseFloat(exp.amount) || 0) + (parseFloat(exp.gst_amount) || 0))}</div></Td>
                      <Td><div style={{ fontSize: 13, color: C.textMuted }}>{exp.paid_by}</div></Td>
                      <Td>
                        <div style={{ fontSize: 13, color: C.text }}>{exp.itr_type || "—"}</div>
                        <div style={{ fontSize: 11, color: C.accent }}>{exp.tax_type || "—"}</div>
                      </Td>
                      <Td>
                        <Badge color={exp.status === "cleared" ? C.green : exp.status === "sent to auditing" ? C.purple : C.amber}>
                          {exp.status}
                        </Badge>
                      </Td>
                      <Td>
                        {exp.cleared_date
                          ? <div style={{ fontSize: 13, fontWeight: 600, color: C.green }}>{(() => { const [cy, cm, cd] = exp.cleared_date.split("T")[0].split("-"); return `${cd}-${cm}-${cy}`; })()}</div>
                          : <div style={{ fontSize: 13, color: C.textMuted }}>—</div>
                        }
                      </Td>
                      <Td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(!exp.paid_by?.toUpperCase().includes('FIT') && exp.status !== "sent to auditing") && (
                            <Btn small variant="outline" onClick={() => { setEditObj(exp); setModal("generateExpense"); }}>Generate Exp</Btn>
                          )}
                          {exp.status === "pending" && (
                            <Btn small variant="success" onClick={() => setClearModal({ id: exp.id, clearedDate: new Date().toISOString().split("T")[0] })}>Mark Cleared</Btn>
                          )}
                          {exp.status === "cleared" && (
                            <Btn small style={{ background: C.purple, color: "#fff", border: "none" }} onClick={() => handleToggleStatus(exp.id, "sent to auditing")}>Send to Auditing</Btn>
                          )}
                          {exp.status !== "sent to auditing" && (
                            <>
                              <Btn small variant="ghost" onClick={() => { setEditObj(exp); setModal("editExpense"); }}>✏</Btn>
                              <Btn small variant="danger" onClick={() => handleDelete(exp.id)}>🗑</Btn>
                            </>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {clearModal && (
        <Modal title="Mark as Cleared" onClose={() => setClearModal(null)} maxWidth={360}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: C.textMuted }}>Select the date this expense was cleared / paid.</div>
            <div>
              <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, display: "block", marginBottom: 6 }}>Cleared Date *</label>
              <input type="date" value={clearModal.clearedDate}
                onChange={e => setClearModal(m => ({ ...m, clearedDate: e.target.value }))}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 13, width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setClearModal(null)}>Cancel</Btn>
            <Btn variant="success" onClick={async () => {
              try {
                await handleToggleStatus(clearModal.id, "cleared", clearModal.clearedDate || null);
                setClearModal(null);
              } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
            }}>Confirm Cleared</Btn>
          </div>
        </Modal>
      )}

      {modal === "generateExpense" && editObj && (
        <Modal title="Generate Employee Expense" onClose={() => { setModal(false); setEditObj(null); }}>
          <ExpenseForm
            init={{
              title: editObj.purpose || "",
              amount: editObj.amount || "",
              category: "Other",
              projectId: "",
              description: `Auto-generated from Company Expense ID ${editObj.id} (Paid by: ${editObj.paid_by})`
            }}
            projects={projects}
            employees={employees}
            saving={saving}
            onCancel={() => { setModal(false); setEditObj(null); }}
            onSave={async (f) => {
              setSaving(true);
              try {
                await api.createExpense({ ...f, employeeId: f.employeeId || currentUser.employee_id });
                setModal(false);
                setEditObj(null);
                dialog.alert("Employee expense drafted & submitted for approval!", { title: "Success", dtype: "success" });
              } catch (ex) { dialog.alert(ex.message, { title: "Error", dtype: "error" }); }
              finally { setSaving(false); }
            }}
            btnLabel="Generate & Submit"
          />
        </Modal>
      )}

      {(modal === "newExpense" || modal === "editExpense") && (
        <Modal title={modal === "newExpense" ? "Add Company Expense" : "Edit Expense"} onClose={() => { setModal(false); setEditObj(null); }}>
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {err && <div style={{ color: C.red, fontSize: 13 }}>⚠ {err}</div>}

            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Expense Date *" type="date" value={form.expenseDate} onChange={v => setForm({ ...form, expenseDate: v })} required />
              <Inp label="Paid By *" value={form.paidBy} onChange={v => setForm({ ...form, paidBy: v })} placeholder="e.g. Corporate Card, Arjun" required />
            </div>

            <Inp label="Purpose *" value={form.purpose} onChange={v => setForm({ ...form, purpose: v })} placeholder="e.g. AWS Hosting, Office Supplies" required />

            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Net Amount *" type="number" step="0.01" value={form.amount} onChange={v => setForm({ ...form, amount: v })} required />
              <Inp label="GST Amount" type="number" step="0.01" value={form.gstAmount} onChange={v => setForm({ ...form, gstAmount: v })} />
            </div>

            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="ITR Type" value={form.itrType} onChange={v => setForm({ ...form, itrType: v })} placeholder="e.g. ITR-4" />
              <Inp label="Tax Type" value={form.taxType} onChange={v => setForm({ ...form, taxType: v })} placeholder="e.g. CGST, IGST" />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 6, textTransform: "uppercase" }}>Clearance Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{
                width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.surface, color: C.text, fontSize: 14, outline: "none"
              }}>
                <option value="pending">Pending</option>
                <option value="cleared">Cleared</option>
                <option value="sent to auditing">Sent to Auditing</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <Btn type="button" variant="ghost" onClick={() => { setModal(false); setEditObj(null); }}>Cancel</Btn>
              <Btn type="submit" disabled={saving || !form.expenseDate || !form.amount || !form.purpose || !form.paidBy}>
                {saving ? "Saving…" : (modal === "newExpense" ? "Create Expense" : "Save Changes")}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function InvoiceForm({ projects, clients, initialData, saving, onCancel, onSave }) {
  const parseItems = (details, h, r) => {
    if (!details) return [{ description: "", hours: "", rate: "" }];
    try {
      const parsed = JSON.parse(details);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { }
    return [{ description: details, hours: h || "", rate: r || "" }];
  };
  const parseDate = (d) => {
    if (!d) return "";
    try { return new Date(d).toISOString().slice(0, 10); } catch { return ""; }
  };
  const [form, setForm] = useState(initialData ? {
    client_id: initialData.client_id || "",
    invoice_number: initialData.invoice_number || "",
    project_id: initialData.project_id || "",
    amount: initialData.amount,
    items: parseItems(initialData.task_details, initialData.hours, initialData.rate),
    remarks: initialData.remarks || "",
    tax_rate: initialData.tax_rate || "18.00",
    subtotal: initialData.subtotal || "",
    raised_date: parseDate(initialData.raised_date),
    payment_due_date: parseDate(initialData.payment_due_date),
    status: initialData.status
  } : { client_id: "", invoice_number: "", project_id: "", amount: "", items: [{ description: "", hours: "", rate: "" }], remarks: "", tax_rate: "18.00", subtotal: "", raised_date: new Date().toISOString().slice(0, 10), payment_due_date: "", status: "pending" });

  // Auto-calculate logic
  useEffect(() => {
    let sub = 0;
    form.items.forEach(item => {
      const h = parseFloat(item.hours) || 0;
      const r = parseFloat(item.rate) || 0;
      sub += (h * r);
    });
    const t = parseFloat(form.tax_rate) || 0;
    const taxAmt = sub * (t / 100);
    const tot = sub + taxAmt;
    setForm(f => ({ ...f, subtotal: sub.toFixed(2), amount: tot.toFixed(2) }));
  }, [form.items, form.tax_rate]);

  useEffect(() => {
    if (form.client_id && form.raised_date) {
      const client = clients.find(c => String(c.id) === String(form.client_id));
      if (client && client.pay_day) {
        const raised = new Date(form.raised_date);
        raised.setDate(raised.getDate() + parseInt(client.pay_day));
        const newDate = raised.toISOString().slice(0, 10);
        if (form.payment_due_date !== newDate) setForm(f => ({ ...f, payment_due_date: newDate }));
      }
    }
  }, [form.client_id, form.raised_date, clients]); // eslint-disable-line

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SearchableSelect label="Client *" value={form.client_id} onChange={v => setForm(f => ({ ...f, client_id: v }))}
          options={clients.map(c => ({ value: c.id, label: c.client_name }))} />
        <Inp label="Invoice Number *" value={form.invoice_number} onChange={v => setForm(f => ({ ...f, invoice_number: v }))} placeholder="e.g. FI/010/2025-26" required />
      </div>

      <Inp label="Related Project (Optional)" value={form.project_id} onChange={v => setForm(f => ({ ...f, project_id: v }))}
        options={projects.map(p => ({ value: p.id, label: `${p.code} - ${p.name}` }))} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ margin: 0, fontSize: 13, color: C.textMuted, fontWeight: 700, textTransform: "uppercase" }}>Invoice Items</h4>
        <Btn type="button" variant="outline" onClick={() => setForm(f => ({ ...f, items: [...f.items, { description: "", hours: "", rate: "" }] }))} style={{ fontSize: 12, padding: "4px 8px" }}>+ Add Item</Btn>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {form.items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: C.surface, padding: 12, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>Description *</label>
              <textarea value={item.description} onChange={e => { const n = [...form.items]; n[i].description = e.target.value; setForm(f => ({ ...f, items: n })); }}
                style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: "8px", fontSize: 13, minHeight: 60, outline: "none", resize: "vertical" }} required placeholder="Description of work..." />
            </div>
            <div style={{ width: 80 }}>
              <Inp label="Hours" type="number" step="0.5" value={item.hours} onChange={v => { const n = [...form.items]; n[i].hours = v; setForm(f => ({ ...f, items: n })); }} />
            </div>
            <div style={{ width: 100 }}>
              <Inp label="Rate (₹)" type="number" step="1" value={item.rate} onChange={v => { const n = [...form.items]; n[i].rate = v; setForm(f => ({ ...f, items: n })); }} />
            </div>
            {form.items.length > 1 && (
              <button type="button" onClick={() => setForm(f => ({ ...f, items: form.items.filter((_, idx) => idx !== i) }))}
                style={{ background: "none", border: "none", color: C.red, cursor: "pointer", padding: "26px 8px 8px", fontSize: 18 }}>×</button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>Remarks / Instructions (Optional)</label>
        <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 13, minHeight: 60, outline: "none", resize: "vertical" }}
          placeholder="Will be printed on the invoice. E.g. Please release payment to..."
        />
      </div>

      <div>
        <div style={{ width: 200, display: "inline-block" }}>
          <Inp label="Tax Rate %" type="number" step="0.1" value={form.tax_rate} onChange={v => setForm(f => ({ ...f, tax_rate: v }))} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end" }}>
        <div style={{ fontSize: 12, color: C.textMuted }}>Subtotal: <b>₹{form.subtotal || "0.00"}</b></div>
      </div>

      <Inp label="Total Amount (INR) *" type="number" step="0.01" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} required />

      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Date Raised *" type="date" value={form.raised_date} onChange={v => setForm(f => ({ ...f, raised_date: v }))} required />
        <Inp label="Payment Due Date" type="date" value={form.payment_due_date} onChange={v => setForm(f => ({ ...f, payment_due_date: v }))} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={() => onSave({ ...form, task_details: JSON.stringify(form.items), hours: 0, rate: 0 })} disabled={saving || !form.client_id}>{saving ? "Submitting…" : "Save Invoice"}</Btn>
      </div>
    </div>
  );
}

function InvoicePrintPreview({ invoice }) {
  const origin = window.location.origin;
  const amt = parseFloat(invoice.amount || 0);
  const sub = parseFloat(invoice.subtotal || 0) || amt;
  const taxRate = parseFloat(invoice.tax_rate || 18);
  const tax = amt - sub;

  const parseItemsPreview = (details, h, r) => {
    try {
      const parsed = JSON.parse(details);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { }
    return [{ description: details || "", hours: h, rate: r }];
  };
  const items = parseItemsPreview(invoice.task_details, invoice.hours, invoice.rate);

  return (
    <div id="invoice-print-area" style={{ background: "#fff", color: "#000", fontFamily: "Arial, sans-serif", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", width: "100%", padding: "40px 30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 30 }}>
        <div style={{ width: "45%" }}>
          <img src={`${origin}/paysliplogo.png`} alt="Fascinate IT Logo" style={{ height: 60, objectFit: "contain", marginBottom: 12 }} />
          <div style={{ width: "80%", height: 4, background: C.accent, marginBottom: 12, borderRadius: 2, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
        </div>
        <div style={{ width: "45%", textAlign: "right" }}>
          <h1 style={{ color: "#8E44AD", margin: "0 0 10px 0", fontSize: 36, fontWeight: "bold" }}>INVOICE</h1>
          <div style={{ width: "100%", height: 8, background: "#8E44AD", marginBottom: 4, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
          <div style={{ width: "100%", height: 3, background: "#3498DB", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
        <div style={{ width: "50%" }}>
          <h3 style={{ color: "#8E44AD", fontSize: 14, marginBottom: 8 }}>FASCINATE IT INDIA PRIVATE LIMITED</h3>
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "#000" }}>#20/7, HanuRadha Nilaya, 2nd Main, Near<br />Kateramma Temple, Kattigenahalli, Yelahanka<br />Bengaluru, Karnataka, India - 560064</p>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#8E44AD" }}>GSTIN: 29AAFCF9723K1Z3</p>

          <h4 style={{ color: "#8E44AD", fontSize: 13, marginBottom: 4 }}>BILL TO</h4>
          <div style={{ borderTop: "2px solid #8E44AD", width: "100%", marginBottom: 8 }} />
          <h3 style={{ color: "#3498DB", fontSize: 14, margin: "0 0 8px", textTransform: "uppercase" }}>{invoice.client_name || "CLIENT NAME"}</h3>
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "#000", whiteSpace: "pre-wrap" }}>{invoice.client_address || ""}</p>
          {invoice.client_gst_number && <p style={{ margin: "0 0 16px", fontSize: 13, color: "#3498DB" }}>GSTIN: {invoice.client_gst_number}</p>}
        </div>
        <div style={{ width: "35%", textAlign: "center" }}>
          <div>
            <h4 style={{ color: "#8E44AD", fontSize: 12, margin: "0 0 4px" }}>DATE</h4>
            <div style={{ borderTop: "2px solid #8E44AD", marginBottom: 8 }} />
            <p style={{ margin: "0 0 20px", fontSize: 13 }}>{fmtD(invoice.raised_date)}</p>
          </div>
          <div>
            <h4 style={{ color: "#8E44AD", fontSize: 12, margin: "0 0 4px" }}>INVOICE NO.</h4>
            <div style={{ borderTop: "2px solid #8E44AD", marginBottom: 8 }} />
            <p style={{ margin: "0 0 20px", fontSize: 13 }}>{invoice.invoice_number}</p>
          </div>
          <div>
            <h4 style={{ color: "#8E44AD", fontSize: 12, margin: "0 0 4px" }}>DATE PAYMENT DUE</h4>
            <div style={{ borderTop: "2px solid #8E44AD", marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>{invoice.payment_due_date ? fmtD(invoice.payment_due_date) : "Upon receipt"}</p>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h4 style={{ color: "#8E44AD", fontSize: 12, textAlign: "center", marginBottom: 4 }}>PROJECT DETAILS</h4>
        <div style={{ background: "#E8D5F5", padding: "12px 16px", fontSize: 13, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
          Provide brief overview of or any pertinent information regarding the project, if applicable.
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
        <thead>
          <tr>
            <th style={{ color: "#8E44AD", fontSize: 11, padding: 8, borderBottom: "2px solid #ddd", textAlign: "left" }}>DATE</th>
            <th style={{ color: "#8E44AD", fontSize: 11, padding: 8, borderBottom: "2px solid #ddd", textAlign: "left" }}>DESCRIPTION OF WORK</th>
            <th style={{ color: "#8E44AD", fontSize: 11, padding: 8, borderBottom: "2px solid #ddd", textAlign: "center" }}>HOURS</th>
            <th style={{ color: "#8E44AD", fontSize: 11, padding: 8, borderBottom: "2px solid #ddd", textAlign: "right" }}>RATE</th>
            <th style={{ color: "#8E44AD", fontSize: 11, padding: 8, borderBottom: "2px solid #ddd", textAlign: "right" }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const rowSub = (parseFloat(item.hours) || 0) * (parseFloat(item.rate) || 0);
            return (
              <tr key={i}>
                <td style={{ padding: "8px", borderBottom: "1px solid #ddd", fontSize: 13 }}>{i === 0 ? fmtD(invoice.raised_date) : ""}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #ddd", fontSize: 13, whiteSpace: "pre-wrap" }}>{item.description}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #ddd", fontSize: 13, textAlign: "center" }}>{item.hours || "—"}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #ddd", fontSize: 13, textAlign: "right" }}>{item.rate ? `₹ ${Number(item.rate).toLocaleString("en-IN")}` : "—"}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #ddd", fontSize: 13, textAlign: "right", background: "#E8D5F5", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>₹ {rowSub ? rowSub.toLocaleString("en-IN") : "—"}</td>
              </tr>
            )
          })}
          {invoice.remarks ? (
            <>
              <tr>
                <td colSpan="2" style={{ padding: "8px", fontSize: 13, color: "#8E44AD", fontWeight: "bold", textAlign: "center", borderBottom: "1px solid #ddd", borderTop: "1px solid #ddd" }}>REMARKS/INSTRUCTIONS</td>
                <td colSpan="2" style={{ padding: "8px", fontSize: 11, color: "#8E44AD", fontWeight: "bold", textAlign: "right", background: "#E8D5F5", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>SUBTOTAL</td>
                <td style={{ padding: "8px", fontSize: 13, textAlign: "right", background: "#E8D5F5", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>₹ {sub.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td colSpan="2" rowSpan="2" style={{ border: "1px solid #ddd", padding: "8px", fontSize: 12, color: "#555", verticalAlign: "top", whiteSpace: "pre-wrap" }}>{invoice.remarks}</td>
                <td colSpan="2" style={{ padding: "8px", fontSize: 11, color: "#8E44AD", fontWeight: "bold", textAlign: "right", background: "#E8D5F5", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>TAX RATE <span style={{ background: "#fff", display: "inline-block", padding: "2px 6px", border: "1px solid #ccc", marginLeft: 8 }}>{taxRate}%</span></td>
                <td style={{ padding: "8px", fontSize: 13, textAlign: "right", background: "#E8D5F5", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>₹ {tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td colSpan="2" style={{ padding: "12px 8px", fontSize: 16, color: "#000", fontWeight: "bold", textAlign: "right", background: "#A569BD", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>TOTAL</td>
                <td style={{ padding: "12px 8px", fontSize: 18, color: "#000", fontWeight: "bold", textAlign: "right", background: "#A569BD", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>₹ {amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <td colSpan="2" rowSpan="3" style={{ border: "none" }}></td>
                <td colSpan="2" style={{ padding: "8px", fontSize: 11, color: "#8E44AD", fontWeight: "bold", textAlign: "right", background: "#E8D5F5", borderTop: "1px solid #ddd", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>SUBTOTAL</td>
                <td style={{ padding: "8px", fontSize: 13, textAlign: "right", background: "#E8D5F5", borderTop: "1px solid #ddd", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>₹ {sub.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td colSpan="2" style={{ padding: "8px", fontSize: 11, color: "#8E44AD", fontWeight: "bold", textAlign: "right", background: "#E8D5F5", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>TAX RATE <span style={{ background: "#fff", display: "inline-block", padding: "2px 6px", border: "1px solid #ccc", marginLeft: 8 }}>{taxRate}%</span></td>
                <td style={{ padding: "8px", fontSize: 13, textAlign: "right", background: "#E8D5F5", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>₹ {tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td colSpan="2" style={{ padding: "12px 8px", fontSize: 16, color: "#000", fontWeight: "bold", textAlign: "right", background: "#A569BD", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>TOTAL</td>
                <td style={{ padding: "12px 8px", fontSize: 18, color: "#000", fontWeight: "bold", textAlign: "right", background: "#A569BD", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>₹ {amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 20 }}>
        <div style={{ width: "40%", fontSize: 12, color: "#333", lineHeight: 1.6 }}>
          <b>Account Holder Name :</b> FASCINATE IT INDIA PRIVATE LIMITED<br />
          <b>Bank :</b> ICICI BANK<br />
          <b>Bank Account :</b> 041105005609<br />
          <b>IFSC Code :</b> ICIC0000411
        </div>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: "#8E44AD", fontSize: 28, margin: 0, fontWeight: "bold", letterSpacing: 1 }}>THANK YOU</h2>
        </div>
      </div>

      <div style={{ borderTop: "2px solid #8E44AD", marginTop: 40, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h4 style={{ color: "#8E44AD", fontSize: 13, margin: "0 0 8px" }}>FASCINATE IT INDIA PRIVATE LIMITED</h4>
          <p style={{ margin: 0, fontSize: 12, color: "#8E44AD" }}><b>CIN - U62099KA2024PTC189877</b></p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#3498DB" }}>✉ yourbuddy@fascinateit.com</p>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#8E44AD" }}>☎ +91 9110638567</p>
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "#8E44AD", fontWeight: "bold" }}>PAN: AAFCF9723K</p>
          <p style={{ margin: 0, fontSize: 13, color: "#8E44AD", fontWeight: "bold" }}>GST-29AAFCF9723K1Z3</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// LOGIN PAGE
// ════════════════════════════════════════════════════════
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit() {
    setError(""); if (!username || !password) { setError("Both fields required."); return; }
    setLoading(true);
    try { await onLogin(username, password); }
    catch (e) { setError(e.message || "Login failed"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", fontFamily: "'DM Sans','Segoe UI',sans-serif", position: "relative", overflow: "hidden" }}>

      {/* Full-page banner background */}
      <img src="/banner.jpg" alt="" style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        objectFit: "fill", objectPosition: "center", zIndex: 0
      }} />
      {/* Dark overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1,
        background: "linear-gradient(135deg, rgba(10,14,26,0.88) 0%, rgba(10,14,26,0.72) 50%, rgba(20,10,40,0.82) 100%)"
      }} />
      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "10%", left: "5%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${C.accent}22 0%, transparent 70%)` }} />
        <div style={{ position: "absolute", bottom: "10%", right: "5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, #7c3aed22 0%, transparent 70%)" }} />
      </div>

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 2,
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px"
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Logo + heading */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <img src="/image.png" alt="Logo" style={{ objectFit: "contain", marginBottom: 14, filter: "drop-shadow(0 4px 16px rgba(59,130,246,0.4))" }} />
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: 0.3, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>Welcome back</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>Sign in to your Fascinate IT workspace</div>
          </div>

          {/* Glass card */}
          <div style={{
            background: "rgba(22,27,42,0.78)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: `1px solid rgba(255,255,255,0.10)`,
            borderRadius: 18, padding: "32px 28px",
            boxShadow: `0 8px 48px rgba(0,0,0,0.5), 0 0 0 1px ${C.accent}22`
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Username */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: 0.5 }}>USERNAME</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "rgba(255,255,255,0.35)" }}>👤</span>
                  <input value={username} onChange={e => setUsername(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    placeholder="Enter your username"
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10, color: "#fff", padding: "11px 12px 11px 38px", fontSize: 13,
                      outline: "none", boxSizing: "border-box", transition: "border-color 0.2s"
                    }} />
                </div>
              </div>

              {/* Password */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: 0.5 }}>PASSWORD</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "rgba(255,255,255,0.35)" }}>🔒</span>
                  <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="Enter your password"
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10, color: "#fff", padding: "11px 40px 11px 38px", fontSize: 13,
                      outline: "none", boxSizing: "border-box"
                    }} />
                  <button onClick={() => setShowPass(v => !v)} style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 15
                  }}>{showPass ? "🙈" : "👁"}</button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#fca5a5" }}>
                  ⚠ {error}
                </div>
              )}

              {/* Submit */}
              <button onClick={handleSubmit} disabled={loading} style={{
                background: `linear-gradient(135deg, ${C.accent}, ${C.accentDim})`,
                color: "#fff", border: "none", borderRadius: 10, padding: "13px",
                fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                marginTop: 4, opacity: loading ? 0.75 : 1,
                boxShadow: `0 4px 28px ${C.accent}55`, letterSpacing: 0.4
              }}>
                {loading ? "Authenticating…" : "Sign In →"}
              </button>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 22, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            © {new Date().getFullYear()} Fascinate IT. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TooltipCard: stat card with optional hover tooltip list ─────────────────
function TooltipCard({ s, tooltipLines }) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Card style={{ display: "flex", gap: 14, alignItems: "flex-start", cursor: tooltipLines ? "pointer" : "default" }}>
        <div style={{ fontSize: 24 }}>{s.icon}</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: s.color, letterSpacing: -.5 }}>{s.value}</div>
          <div style={{ fontSize: 12, color: C.text, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{s.sub}</div>
        </div>
      </Card>
      {tooltipLines && show && (
        <div style={{
          position: "absolute", top: "calc(100% + 10px)", left: 0, zIndex: 999
        }}>
          {/* Pointer (Arrow) */}
          <div style={{
            position: "absolute", top: -6, left: 32,
            width: 14, height: 14, background: "#2a2d3e",
            borderLeft: `1px solid ${C.border}`, borderTop: `1px solid ${C.border}`,
            transform: "rotate(45deg)", zIndex: 1
          }} />
          {/* Tooltip Body */}
          <div style={{
            position: "relative", zIndex: 2,
            background: "#2a2d3e", border: `1px solid ${C.border}`, borderRadius: 10,
            boxShadow: "0 10px 40px rgba(0,0,0,0.6)", padding: "12px 16px",
            minWidth: 240, maxWidth: 320, maxHeight: 260, overflowY: "auto",
          }}>
            {tooltipLines.length === 0
              ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>None</div>
              : tooltipLines.map((line, i) => (
                <div key={i} style={{ fontSize: 13, color: "#ffffff", fontWeight: 500, padding: "5px 0", borderBottom: i < tooltipLines.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                  {line}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════
function Dashboard() {
  const [data, setData] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [d, cls] = await Promise.all([api.getDashboard(), api.getClients()]);
      setData(d); setClients(cls);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  });
  useEffect(() => { load(); }, []);
  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;
  const {
    projects = [],
    total_budget = 0, active_budget = 0, inactive_budget = 0,
    total_burned = 0,
    pending_timesheets = 0, pending_leaves = 0,
    invoice_total_raised = 0, invoice_cleared = 0, invoice_pending = 0,
    pending_invoices = [],
  } = data || {};

  const stats = [
    // ── Budget ───────────────────────────────────────────
    { label: "Total Budget",           value: fmt$(total_budget),        sub: `${projects.length} projects (active + inactive)`, icon: "💰", color: C.accent },
    { label: "Active Project Budget",  value: fmt$(active_budget),       sub: `${projects.filter(p => p.status === "active").length} active projects`,   icon: "🚀", color: C.green },
    { label: "Inactive Project Budget",value: fmt$(inactive_budget),     sub: `${projects.filter(p => p.status !== "active").length} inactive projects`,  icon: "📦", color: C.textMuted },
    { label: "Budget Burned",          value: fmt$(total_burned),        sub: `${total_budget ? ((total_burned / total_budget) * 100).toFixed(1) : 0}% utilized`, icon: "🔥", color: C.amber },
    // ── Invoices ─────────────────────────────────────────
    { label: "Total Invoiced",         value: fmt$(invoice_total_raised), sub: "All raised invoices",    icon: "🧾", color: C.purple },
    { label: "Invoice Cleared",        value: fmt$(invoice_cleared),      sub: "Received / settled",     icon: "✅", color: C.green },
    { label: "Invoice Pending",        value: fmt$(invoice_pending),      sub: "Awaiting payment",       icon: "⏳", color: C.red },
    // ── Operations ───────────────────────────────────────
    { label: "Pending Reviews",        value: pending_timesheets + pending_leaves, sub: `${pending_timesheets} ts · ${pending_leaves} leaves`, icon: "🕐", color: C.purple },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Overview</h2>
        <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Real-time project & budget snapshot</p></div>
      {/* ── Row 1: Budget cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {/* Total Budget — plain */}
        <TooltipCard s={stats[0]} />
        {/* Active Project Budget — tooltip: active project names */}
        <TooltipCard s={stats[1]} tooltipLines={projects.filter(p => p.status === "active").map(p => `🚀 ${p.name} — ${fmt$(p.budget)}`)} />
        {/* Inactive Project Budget — tooltip: inactive project names + status */}
        <TooltipCard s={stats[2]} tooltipLines={projects.filter(p => p.status !== "active").map(p => `📦 ${p.name} (${p.status}) — ${fmt$(p.budget)}`)} />
        {/* Budget Burned — plain */}
        <TooltipCard s={stats[3]} />
      </div>

      {/* ── Row 2: Invoice cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {/* Total Invoiced — plain */}
        <TooltipCard s={stats[4]} />
        {/* Invoice Cleared — plain */}
        <TooltipCard s={stats[5]} />
        {/* Invoice Pending — tooltip: client + invoice no + amount */}
        <TooltipCard s={stats[6]} tooltipLines={pending_invoices.map(inv => `${inv.client_name}${inv.invoice_number ? ` · ${inv.invoice_number}` : ""} — ${fmt$(inv.amount)}`)} />
        {/* Pending Reviews — plain */}
        <TooltipCard s={stats[7]} />
      </div>

      {/* ── Pie charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Budget Pie */}
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text }}>💰 Budget Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={[
                  { name: "Active",   value: active_budget   },
                  { name: "Inactive", value: inactive_budget  },
                  { name: "Burned",   value: total_burned     },
                ]}
                cx="50%" cy="50%" outerRadius={80} innerRadius={44}
                dataKey="value" paddingAngle={3}
              >
                {[C.green, C.textMuted, C.amber].map((col, i) => <Cell key={i} fill={col} />)}
              </Pie>
              <Tooltip formatter={(v) => fmt$(v)} contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={10} formatter={(v, e) => <span style={{ color: C.textMuted, fontSize: 12 }}>{v}: {fmt$(e.payload.value)}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Invoice Pie */}
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text }}>🧾 Invoice Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={[
                  { name: "Cleared", value: invoice_cleared },
                  { name: "Pending", value: invoice_pending },
                ]}
                cx="50%" cy="50%" outerRadius={80} innerRadius={44}
                dataKey="value" paddingAngle={3}
              >
                {[C.green, C.red].map((col, i) => <Cell key={i} fill={col} />)}
              </Pie>
              <Tooltip formatter={(v) => fmt$(v)} contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={10} formatter={(v, e) => <span style={{ color: C.textMuted, fontSize: 12 }}>{v}: {fmt$(e.payload.value)}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card>
        <h3 style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 700, color: C.text }}>Project Budget Burn Rate</h3>
        {projects.map(p => {
          const pct = (((p.burned || 0) / p.budget) * 100).toFixed(1);
          return (<div key={p.id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</span>
                <StatusBadge status={p.status} />
              </div>
              <span style={{ fontSize: 12, color: C.textMuted }}>{fmt$(p.burned || 0)} / {fmt$(p.budget)} ({pct}%)</span>
            </div>
            <ProgressBar value={p.burned || 0} max={p.budget} />
          </div>);
        })}
      </Card>

      {/* Clients quick-view */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>
            🏢 Clients <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 400, marginLeft: 6 }}>{clients.length} total</span>
          </h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: C.surface }}>
              <tr>
                {["Client Name", "Email", "Phone", "GST Number", "Pay Day"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: .5, textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: C.textMuted, fontSize: 13 }}>No clients yet.</td></tr>
              )}
              {clients.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}22`, background: idx % 2 === 0 ? "transparent" : C.bg + "44" }}>
                  <td style={{ padding: "11px 16px", fontWeight: 700, color: C.text, fontSize: 13 }}>{c.client_name}</td>
                  <td style={{ padding: "11px 16px", fontSize: 12 }}>
                    {c.email
                      ? <a href={`mailto:${c.email}`} style={{ color: C.accent, textDecoration: "none" }}>{c.email}</a>
                      : <span style={{ color: C.textMuted }}>—</span>}
                  </td>
                  <td style={{ padding: "11px 16px", fontSize: 12 }}>
                    {c.phone_number
                      ? <a href={`tel:${c.phone_number}`} style={{ color: C.text, textDecoration: "none" }}>{c.phone_number}</a>
                      : <span style={{ color: C.textMuted }}>—</span>}
                  </td>
                  <td style={{ padding: "11px 16px", fontSize: 12, color: C.textMuted }}>{c.gst_number || "—"}</td>
                  <td style={{ padding: "11px 16px", fontSize: 12, color: C.textMuted }}>{c.pay_day ? `Day ${c.pay_day}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// PROJECTS
// ════════════════════════════════════════════════════════
function Projects({ readOnly = false }) {
  const [projects, setProjects] = useState([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { setLoading(true); setErr(""); try { setProjects(await api.getProjects()); } catch (e) { setErr(e.message); } finally { setLoading(false); } });
  useEffect(() => { load(); }, []);

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Projects</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Manage project codes & budgets</p></div>
        {!readOnly && <Btn onClick={() => setModal("new")}>+ New Project</Btn>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
        {projects.map(p => {
          const burned = p.burned || 0; const pct = ((burned / p.budget) * 100).toFixed(1);
          return (<Card key={p.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><div style={{ fontSize: 11, color: C.accent, fontWeight: 700, letterSpacing: .5, marginBottom: 4 }}>{p.code}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{p.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{p.client}</div></div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <StatusBadge status={p.status} />
                {!readOnly && <Btn small variant="ghost" onClick={() => setModal(p)}>✏</Btn>}
              </div>
            </div>
            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["Budget", fmt$(p.budget), C.text], ["Burned", fmt$(burned), pct > 85 ? C.red : C.amber]].map(([l, v, col]) => (
                <div key={l} style={{ background: C.surface, borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: col }}>{v}</div>
                </div>
              ))}
            </div>
            <ProgressBar value={burned} max={p.budget} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted }}>
              <span>{fmtD(p.start_date)}</span><span>→</span><span>{fmtD(p.end_date)}</span>
            </div>
          </Card>);
        })}
      </div>
      {modal && (
        <Modal title={modal === "new" ? "Create New Project" : "Edit Project"} onClose={() => setModal(false)}>
          <ProjectForm
            init={modal === "new" ? { name: "", client: "", budget: "", startDate: "", endDate: "", status: "active" } :
              { name: modal.name, client: modal.client || "", budget: modal.budget, startDate: modal.start_date?.slice(0, 10) || "", endDate: modal.end_date?.slice(0, 10) || "", status: modal.status }}
            saving={saving}
            onCancel={() => setModal(false)}
            onSave={async (form) => {
              setSaving(true);
              try {
                if (modal === "new") await api.createProject({ ...form, budget: +form.budget, assignedGroups: [], assignedEmployees: [] });
                else await api.updateProject(modal.id, { ...form, budget: +form.budget });
                setModal(false); await load();
              } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function ProjectForm({ init, saving, onCancel, onSave }) {
  const [form, setForm] = useState(init);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Inp label="Project Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required placeholder="e.g. Cloud Migration" />
      <Inp label="Client Name" value={form.client} onChange={v => setForm(f => ({ ...f, client: v }))} />
      <Inp label="Budget (INR)" type="number" value={form.budget} onChange={v => setForm(f => ({ ...f, budget: v }))} required />
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Start Date" type="date" value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} />
        <Inp label="End Date" type="date" value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} />
      </div>
      <Inp label="Status" value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
        options={[{ value: "active", label: "Active" }, { value: "on-hold", label: "On Hold" }, { value: "inactive", label: "Inactive" }, { value: "completed", label: "Completed" }, { value: "closed", label: "Closed" }]} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={() => onSave(form)} disabled={saving}>{saving ? "Saving…" : init.name ? "Save Changes" : "Create Project"}</Btn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// RESOURCES
// ════════════════════════════════════════════════════════
function Resources({ readOnly = false }) {
  const [tab, setTab] = useState("employees");
  const [employees, setEmployees] = useState([]); const [groups, setGroups] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [assignedIds, setAssignedIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { const [e, g, p] = await Promise.all([api.getEmployees(), api.getGroups(), api.getProjects()]); setEmployees(e); setGroups(g); setProjects(p); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
  });
  useEffect(() => { load(); }, []);

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  const isEditEmp = modal && modal.type === "emp" && modal.id;
  const isNewEmp = modal && modal.type === "emp" && !modal.id;
  const isEditGrp = modal && modal.type === "grp" && modal.id;
  const isNewGrp = modal && modal.type === "grp" && !modal.id;

  async function saveEmp(form) {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      const payload = { ...form, groupId: form.groupId ? +form.groupId : null, hourlyRate: form.hourlyRate !== "" ? +form.hourlyRate : null };
      if (isNewEmp) await api.createEmployee(payload);
      else await api.updateEmployee(modal.id, payload);
      setModal(null); await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
  }

  async function saveGrp(form) {
    if (!form.name || !form.hourlyRate) return;
    setSaving(true);
    try {
      if (isNewGrp) await api.createGroup({ ...form, hourlyRate: +form.hourlyRate });
      else await api.updateGroup(modal.id, { ...form, hourlyRate: +form.hourlyRate });
      setModal(null); await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
  }

  async function openAssign(emp) {
    try { const ids = await api.getEmployeeProjects(emp.id); setAssignedIds(ids); setAssignModal(emp); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }
  async function saveAssign() {
    setSaving(true);
    try { await api.updateEmployeeProjects(assignModal.id, assignedIds); setAssignModal(null); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Resources</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Manage employees &amp; billing groups</p></div>
        {!readOnly && (
          <Btn onClick={() => setModal(tab === "employees" ? { type: "emp" } : { type: "grp" })}>
            + {tab === "employees" ? "Add Employee" : "Add Group"}
          </Btn>
        )}
      </div>
      <div style={{ display: "flex", gap: 4, background: C.surface, padding: 4, borderRadius: 10, width: "fit-content", maxWidth: "100%", overflowX: "auto" }}>
        {["employees", "groups"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? C.card : "transparent", color: tab === t ? C.text : C.textMuted,
            border: tab === t ? `1px solid ${C.border}` : "1px solid transparent",
            borderRadius: 8, padding: "6px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize"
          }}>{t}</button>
        ))}
      </div>
      {tab === "employees" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
          {employees.map(emp => (
            <Card key={emp.id} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <Avatar initials={emp.avatar} color={emp.group_color || C.accent} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{emp.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{emp.email}</div>
                {emp.joining_date && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Joined {emp.joining_date}</div>}
                {emp.group_name && <div style={{ marginTop: 6 }}><Badge color={emp.group_color || C.accent}>{emp.group_name}</Badge></div>}
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {!readOnly && <Btn small variant="ghost" onClick={() => setModal({ type: "emp", id: emp.id, name: emp.name, email: emp.email, groupId: emp.group_id || "", joiningDate: emp.joining_date || "", ctcAnnual: emp.ctc_annual || "", hourlyRate: emp.hourly_rate != null ? emp.hourly_rate : "" })}>✏ Edit</Btn>}
                  {!readOnly && <Btn small variant="ghost" onClick={() => openAssign(emp)}>🗂 Projects</Btn>}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>₹{emp.effective_hourly_rate || emp.hourly_rate || 0}/hr{emp.hourly_rate != null && <span style={{ fontSize: 10, color: C.accent, marginLeft: 4 }}>custom</span>}</div>
            </Card>
          ))}
        </div>
      )}
      {tab === "groups" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
          {groups.map(g => {
            const members = employees.filter(e => e.group_id === g.id);
            return (<Card key={g.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: g.color }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{g.name}</span>
                </div>
                {!readOnly && <Btn small variant="ghost" onClick={() => setModal({ type: "grp", id: g.id, name: g.name, hourlyRate: g.hourly_rate, color: g.color })}>✏ Edit</Btn>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <div><div style={{ fontSize: 11, color: C.textMuted }}>Hourly Rate</div><div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>₹{g.hourly_rate}</div></div>
                <div><div style={{ fontSize: 11, color: C.textMuted }}>Members</div><div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{members.length}</div></div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {members.map(m => <Avatar key={m.id} initials={m.avatar} color={g.color} size={28} />)}
              </div>
            </Card>);
          })}
        </div>
      )}
      {!readOnly && (isNewEmp || isEditEmp) && (
        <Modal title={isNewEmp ? "Add Employee" : "Edit Employee"} onClose={() => setModal(null)}>
          <EmpForm init={{ name: modal.name || "", email: modal.email || "", groupId: modal.groupId || "", joiningDate: modal.joiningDate || "", ctcAnnual: modal.ctcAnnual || "", hourlyRate: modal.hourlyRate ?? "" }}
            groups={groups} saving={saving} onCancel={() => setModal(null)} onSave={saveEmp}
            btnLabel={isNewEmp ? "Add Employee" : "Save Changes"} />
        </Modal>
      )}
      {!readOnly && (isNewGrp || isEditGrp) && (
        <Modal title={isNewGrp ? "Add Group" : "Edit Group"} onClose={() => setModal(null)}>
          <GrpForm init={{ name: modal.name || "", hourlyRate: modal.hourlyRate || "", color: modal.color || "#3B82F6" }}
            saving={saving} onCancel={() => setModal(null)} onSave={saveGrp}
            btnLabel={isNewGrp ? "Create Group" : "Save Changes"} />
        </Modal>
      )}
      {assignModal && (
        <Modal title={`Assign Projects — ${assignModal.name}`} onClose={() => setAssignModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: C.textMuted }}>Select projects this employee can log hours against.</p>
            {projects.filter(p => !["closed", "completed"].includes(p.status)).map(p => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0" }}>
                <input type="checkbox" checked={assignedIds.includes(p.id)}
                  onChange={e => setAssignedIds(ids => e.target.checked ? [...ids, p.id] : ids.filter(i => i !== p.id))}
                  style={{ width: 16, height: 16, cursor: "pointer" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: C.accent }}>{p.code}</div>
                </div>
              </label>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setAssignModal(null)}>Cancel</Btn>
              <Btn onClick={saveAssign} disabled={saving}>{saving ? "Saving…" : "Save Assignments"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EmpForm({ init, groups, employees, saving, onCancel, onSave, btnLabel }) {
  const [form, setForm] = useState(init);
  const [showPan, setShowPan] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Full Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
        <Inp label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} required type="email" />
      </div>
      <Inp label="Employee ID" value={form.customEmployeeId || ""} onChange={v => setForm(f => ({ ...f, customEmployeeId: v }))} placeholder="e.g. EMP-001" />
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Group" value={form.groupId} onChange={v => setForm(f => ({ ...f, groupId: v }))} options={groups.map(g => ({ value: g.id, label: g.name }))} />
        <SearchableSelect label="Manager" value={form.managerId} onChange={v => setForm(f => ({ ...f, managerId: v }))} options={(employees || []).map(e => ({ value: e.id, label: e.name }))} />
      </div>
      <Inp label="Hourly Rate (₹/hr)" type="number" value={form.hourlyRate ?? ""} onChange={v => setForm(f => ({ ...f, hourlyRate: v }))} placeholder="Leave blank to use group rate" />
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Annual CTC (₹)" type="number" value={form.ctcAnnual || ""} onChange={v => setForm(f => ({ ...f, ctcAnnual: v }))} placeholder="e.g. 1200000" />
        <Inp label="Variable Pay (₹)" type="number" value={form.variablePay || ""} onChange={v => setForm(f => ({ ...f, variablePay: v }))} placeholder="e.g. 200000" />
      </div>
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Designation" value={form.designation || ""} onChange={v => setForm(f => ({ ...f, designation: v }))} placeholder="e.g. Software Engineer" />
        <Inp label="Location" value={form.location || ""} onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="e.g. Bangalore" />
      </div>
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <Inp label="PAN Number" type={showPan ? "text" : "password"} value={form.panNumber || ""} onChange={v => setForm(f => ({ ...f, panNumber: v }))} placeholder="ABCDE1234F" />
          <button onClick={() => setShowPan(s => !s)} style={{ marginTop: 4, background: "none", border: "none", cursor: "pointer", color: C.accent, fontSize: 11, fontWeight: 600, padding: 0 }}>{showPan ? "Hide" : "View"}</button>
        </div>
        <Inp label="Joining Date" type="date" value={form.joiningDate || ""} onChange={v => setForm(f => ({ ...f, joiningDate: v }))} />
      </div>
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Date of Birth" type="date" value={form.dob || ""} onChange={v => setForm(f => ({ ...f, dob: v }))} />
        <Inp label="Mobile" value={form.mobile || ""} onChange={v => setForm(f => ({ ...f, mobile: v }))} placeholder="+1 123 456 7890" />
      </div>
      <Inp label="Address" value={form.address || ""} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Full address..." />
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Bank Name" value={form.bankName || ""} onChange={v => setForm(f => ({ ...f, bankName: v }))} placeholder="e.g. Chase" />
        <div>
          <Inp label="Account No" type={showAccount ? "text" : "password"} value={form.bankAccountNo || ""} onChange={v => setForm(f => ({ ...f, bankAccountNo: v }))} placeholder="1234567890" />
          <button onClick={() => setShowAccount(s => !s)} style={{ marginTop: 4, background: "none", border: "none", cursor: "pointer", color: C.accent, fontSize: 11, fontWeight: 600, padding: 0 }}>{showAccount ? "Hide" : "View"}</button>
        </div>
      </div>
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="IFSC Code" value={form.bankIfsc || ""} onChange={v => setForm(f => ({ ...f, bankIfsc: v }))} placeholder="CHAS0123456" />
        <Inp label="Skillset" value={form.skillset || ""} onChange={v => setForm(f => ({ ...f, skillset: v }))} placeholder="e.g. React, Node, SQL" />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={() => onSave(form)} disabled={saving}>{saving ? "Saving…" : btnLabel}</Btn>
      </div>
    </div>
  );
}

function GrpForm({ init, saving, onCancel, onSave, btnLabel }) {
  const [form, setForm] = useState(init);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Inp label="Group Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required placeholder="e.g. Senior Developers" />
      <Inp label="Hourly Rate" type="number" value={form.hourlyRate} onChange={v => setForm(f => ({ ...f, hourlyRate: v }))} required />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>Color</label>
        <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
          style={{ width: 48, height: 36, borderRadius: 8, border: "none", cursor: "pointer" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={() => onSave(form)} disabled={saving}>{saving ? "Saving…" : btnLabel}</Btn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// TIMESHEETS – Work-Week Calendar View
// ════════════════════════════════════════════════════════

// Helper: get Monday of the week containing `date`
function weekStart(date) {
  const d = new Date(date); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); return d;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function isoDate(d) { return d.toISOString().slice(0, 10); }
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Timesheets({ currentUser, viewOnly }) {
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [calView, setCalView] = useState("week"); // "week" | "month"
  const [weekOf, setWeekOf] = useState(() => weekStart(new Date()));
  const [monthOf, setMonthOf] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  // addRow: {dayIso, projectId, hours}
  const [addRow, setAddRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dayPanel, setDayPanel] = useState(null);

  // Admin filter states
  const [filterEmp, setFilterEmp] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const params = {}; if (viewOnly) params.employee_id = currentUser.employee_id;
      const [ts, pr, em] = await Promise.all([api.getTimesheets(params), api.getProjects(), api.getEmployees()]);
      setRows(ts); setProjects(pr); setEmployees(em);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  });
  useEffect(() => { load(); }, []);

  const activeProjs = projects.filter(p => !["closed", "completed"].includes(p.status));
  const myProjs = viewOnly ? activeProjs.filter(p =>
    (p.assigned_employees || []).includes(currentUser.employee_id) ||
    (p.assigned_groups || []).includes(currentUser.group_id)
  ) : activeProjs;

  async function handleAdd() {
    if (!addRow || !addRow.projectId || !addRow.hours) return;
    setSaving(true);
    try {
      await api.createTimesheet({ employeeId: currentUser.employee_id, projectId: +addRow.projectId, date: addRow.dayIso, hours: +addRow.hours, task: "" });
      setAddRow(null); await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
  }

  async function handleSubmitWeek() {
    const startDate = isoDate(weekOf);
    const endDate   = isoDate(addDays(weekOf, 6));
    const draftCount = rows.filter(r => r.work_date?.slice(0, 10) >= startDate && r.work_date?.slice(0, 10) <= endDate && r.status === "draft").length;
    if (draftCount === 0) { dialog.alert("No saved (draft) entries to submit for this week."); return; }
    if (!await dialog.confirm(`Submit ${draftCount} draft entr${draftCount === 1 ? "y" : "ies"} for this week to your manager?`, { title: "Submit Timesheet", dtype: "info" })) return;
    setSaving(true);
    try {
      await api.submitWeekTimesheets(startDate, endDate);
      await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!await dialog.confirm("Remove this entry?", { dtype: "warning" })) return;
    try { await api.deleteTimesheet(id); await load(); } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  async function handleApprove(id) { try { await api.approveTimesheet(id); await load(); } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } }
  async function handleReject(id) { try { await api.rejectTimesheet(id); await load(); } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } }

  function handleDownloadCSV(filteredRows) {
    if (filteredRows.length === 0) { dialog.alert("No data to download."); return; }
    const headers = ["ID", "Employee", "Project Code", "Date", "Hours", "Task", "Status"];
    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + filteredRows.map(r => [
        r.id, `"${r.employee_name}"`, `"${r.project_code}"`, r.work_date?.split("T")[0],
        r.hours, `"${r.task || ""}"`, r.status
      ].join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `timesheets_${weekOf.toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  // ── Week view ────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekOf, i));

  function WeekView() {
    const todayIso = isoDate(new Date());
    return (
      <div>
        {/* Week navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setWeekOf(d => addDays(d, -7))} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", color: C.textDim, cursor: "pointer", fontSize: 16 }}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
            {weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <button onClick={() => setWeekOf(d => addDays(d, 7))} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", color: C.textDim, cursor: "pointer", fontSize: 16 }}>›</button>
          <Btn small variant="ghost" onClick={() => setWeekOf(weekStart(new Date()))}>Today</Btn>
          {viewOnly && (() => {
            const wStart = isoDate(weekDays[0]);
            const wEnd   = isoDate(weekDays[6]);
            const draftCount = rows.filter(r => r.work_date?.slice(0, 10) >= wStart && r.work_date?.slice(0, 10) <= wEnd && r.status === "draft").length;
            return draftCount > 0 ? (
              <Btn small onClick={handleSubmitWeek} disabled={saving}
                style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", fontWeight: 700, cursor: "pointer" }}>
                {saving ? "Submitting…" : `Submit Week (${draftCount})`}
              </Btn>
            ) : null;
          })()}
        </div>

        {/* Day columns */}
        <div className="resp-table-wrap">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, minWidth: 560 }}>
            {weekDays.map((day, i) => {
              const iso = isoDate(day);
              const isToday = iso === todayIso;
              const dayRows = rows.filter(r => r.work_date?.slice(0, 10) === iso);
              const totalHrs = dayRows.reduce((s, r) => s + (+r.hours || 0), 0);
              const isAdding = addRow && addRow.dayIso === iso;

              return (
                <div key={iso} style={{ background: isToday ? C.accentGlow : C.card, border: `1px solid ${isToday ? C.accent : C.border}`, borderRadius: 10, padding: 12, minHeight: 160, display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: .5 }}>{DAY_NAMES[i]}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? C.accent : C.text }}>{day.getDate()}</div>
                    </div>
                    {totalHrs > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: C.green, background: C.green + "18", borderRadius: 4, padding: "2px 6px" }}>{totalHrs}h</div>}
                  </div>

                  {/* Timesheet rows */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                    {dayRows.map(r => (
                      <div key={r.id} style={{ background: r.status === "draft" ? C.bg : C.surface, borderRadius: 6, padding: "5px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${r.status === "approved" ? C.green + "44" : r.status === "rejected" ? C.red + "44" : r.status === "draft" ? C.border : C.border}`, opacity: r.status === "draft" ? 0.75 : 1 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.project_code}</div>
                          {!viewOnly && <div style={{ fontSize: 10, color: C.textMuted }}>{r.employee_name}</div>}
                          <div style={{ fontSize: 10, color: C.textMuted }}>{r.hours}h · <span style={{ color: r.status === "approved" ? C.green : r.status === "rejected" ? C.red : r.status === "draft" ? C.textMuted : C.amber }}>{r.status === "draft" ? "saved" : r.status}</span></div>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          {(r.status === "pending" || r.status === "draft") && (
                            <button onClick={() => handleDelete(r.id)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, padding: "0 2px", lineHeight: 1 }}>🗑</button>
                          )}
                          {!viewOnly && r.status === "pending" && (
                            <button onClick={() => handleApprove(r.id)} title="Approve" style={{ background: "none", border: "none", cursor: "pointer", color: C.green, fontSize: 13, padding: "0 2px", lineHeight: 1 }}>✓</button>
                          )}
                          {!viewOnly && r.status === "pending" && (
                            <button onClick={() => handleReject(r.id)} title="Reject" style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 13, padding: "0 2px", lineHeight: 1 }}>✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Inline add form */}
                  {isAdding ? (
                    <div style={{ background: C.surface, borderRadius: 6, padding: 8, border: `1px solid ${C.accent}44`, display: "flex", flexDirection: "column", gap: 6 }}>
                      <select value={addRow.projectId || ""} onChange={e => setAddRow(r => ({ ...r, projectId: e.target.value }))}
                        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: "4px 6px", fontSize: 11, width: "100%" }}>
                        <option value="">Project…</option>
                        {myProjs.map(p => <option key={p.id} value={p.id}>{p.code} – {p.name}</option>)}
                      </select>
                      <input type="number" value={addRow.hours || ""} onChange={e => setAddRow(r => ({ ...r, hours: e.target.value }))}
                        placeholder="Hours" min="0.5" max="24" step="0.5"
                        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: "4px 6px", fontSize: 11, width: "100%" }} />
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={handleAdd} disabled={saving} style={{ flex: 1, background: C.accent, border: "none", borderRadius: 5, color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 0", cursor: "pointer" }}>
                          {saving ? "…" : "Save"}
                        </button>
                        <button onClick={() => setAddRow(null)} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, color: C.textMuted, fontSize: 11, padding: "4px 0", cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAddRow({ dayIso: iso, projectId: "", hours: "" })}
                      style={{ background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 6, color: C.textMuted, fontSize: 20, padding: "4px 0", cursor: "pointer", lineHeight: 1, transition: "all .15s" }}
                      title="Add project hours"
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}>
                      ＋
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Month view (read-only summary tiles) ─────────────────
  function MonthView() {
    const { y, m } = monthOf;
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    // pad to start on Monday
    let startPad = (firstDay.getDay() + 6) % 7;
    const grid = [];
    for (let i = 0; i < startPad; i++)grid.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++)grid.push(new Date(y, m, d));
    while (grid.length % 7 !== 0) grid.push(null);
    const todayIso = isoDate(new Date());

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={() => setMonthOf(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", color: C.textDim, cursor: "pointer", fontSize: 16 }}>‹</button>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{MONTH_NAMES[m]} {y}</span>
          <button onClick={() => setMonthOf(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", color: C.textDim, cursor: "pointer", fontSize: 16 }}>›</button>
          <Btn small variant="ghost" onClick={() => { const n = new Date(); setMonthOf({ y: n.getFullYear(), m: n.getMonth() }); }}>Today</Btn>
        </div>
        <div className="resp-table-wrap">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4, minWidth: 480 }}>
            {DAY_NAMES.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: C.textMuted, padding: "4px 0", textTransform: "uppercase" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, minWidth: 480 }}>
            {grid.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const iso = isoDate(day);
              const isToday = iso === todayIso;
              const dayRows = rows.filter(r => r.work_date?.slice(0, 10) === iso);
              const totalHrs = dayRows.reduce((s, r) => s + (+r.hours || 0), 0);
              const hasApproved = dayRows.some(r => r.status === "approved");
              const hasPending = dayRows.some(r => r.status === "pending");
              const dotColor = hasApproved ? C.green : hasPending ? C.amber : "transparent";
              return (
                <div key={iso} onClick={() => { if (dayRows.length) setDayPanel({ iso, dayRows }); }}
                  style={{ background: isToday ? C.accentGlow : C.card, border: `1px solid ${isToday ? C.accent : C.border}`, borderRadius: 8, padding: "8px 4px", minHeight: 60, cursor: dayRows.length ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "opacity .15s" }}
                  onMouseEnter={e => { if (dayRows.length) e.currentTarget.style.opacity = ".8"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
                  <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, color: isToday ? C.accent : C.text }}>{day.getDate()}</div>
                  {totalHrs > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: C.green }}>{totalHrs}h</div>}
                  {dotColor !== "transparent" && <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>{viewOnly ? "My Timesheets" : "Timesheets"}</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>{viewOnly ? "Click ＋ on any day to log hours" : "Work-week view — approve pending entries"}</p>
        </div>
        {/* View toggle */}
        <div style={{ display: "flex", gap: 4, background: C.surface, padding: 4, borderRadius: 10 }}>
          {[["week", "📅 Work Week"], ["month", "🗓 Month"]].map(([v, label]) => (
            <button key={v} onClick={() => setCalView(v)} style={{
              background: calView === v ? C.card : "transparent", color: calView === v ? C.text : C.textMuted,
              border: calView === v ? `1px solid ${C.border}` : "1px solid transparent",
              borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer"
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <Card style={{ padding: 20 }}>
        {calView === "week" ? <WeekView /> : <MonthView />}
      </Card>

      {/* Admin legend */}
      {!viewOnly && (
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.textMuted }}>
          <span>✓ = Approve &nbsp; ✕ = Reject &nbsp; 🗑 = Delete</span>
          <span style={{ color: C.green }}>● Approved</span>
          <span style={{ color: C.amber }}>● Pending</span>
          <span style={{ color: C.red }}>● Rejected</span>
        </div>
      )}

      {/* Day detail panel (month view click / admin) */}
      {dayPanel && (
        <Modal title={`Entries for ${new Date(dayPanel.iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`} onClose={() => setDayPanel(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dayPanel.dayRows.map(r => (
              <div key={r.id} style={{ background: C.surface, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  {!viewOnly && <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{r.employee_name}</div>}
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{r.project_code} · {r.hours}h</div>
                  {r.task && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{r.task}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <StatusBadge status={r.status} />
                  {!viewOnly && r.status === "pending" && (
                    <>
                      <Btn small variant="success" onClick={async () => { await handleApprove(r.id); setDayPanel(null); }}>✓ Approve</Btn>
                      <Btn small variant="danger" onClick={async () => { await handleReject(r.id); setDayPanel(null); }}>✕ Reject</Btn>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Admin / Manager Weekly List View */}
      {!viewOnly && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.text }}>Weekly Timesheet Requests</h3>
              <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>List view of the selected week's entries</p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: filterEmp ? C.text : C.textMuted, padding: "8px 12px", fontSize: 13, outline: "none", cursor: "pointer" }}>
                <option value="">All Employees</option>
                {Array.from(new Set(rows.map(r => r.employee_name))).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: filterStatus !== "all" ? C.text : C.textMuted, padding: "8px 12px", fontSize: 13, outline: "none", cursor: "pointer" }}>
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <Btn onClick={() => {
                const start = isoDate(weekDays[0]);
                const end = isoDate(weekDays[6]);
                const weekRows = rows.filter(r => r.work_date?.split("T")[0] >= start && r.work_date?.split("T")[0] <= end);
                const listFiltered = weekRows.filter(r => {
                  if (filterEmp && r.employee_name !== filterEmp) return false;
                  if (filterStatus !== "all" && r.status !== filterStatus) return false;
                  return true;
                });
                handleDownloadCSV(listFiltered);
              }} variant="secondary" style={{ border: `1px solid ${C.accent}`, background: "transparent", color: C.accent }}>
                📥 Download CSV
              </Btn>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: C.surface }}><tr>
                {["Employee", "Project", "Date", "Hours", "Task", "Status", "Action"].map(h => <Th key={h}>{h}</Th>)}
              </tr></thead>
              <tbody>
                {(() => {
                  const start = isoDate(weekDays[0]);
                  const end = isoDate(weekDays[6]);
                  const weekRows = rows.filter(r => r.work_date?.split("T")[0] >= start && r.work_date?.split("T")[0] <= end);
                  const listFiltered = weekRows.filter(r => {
                    if (filterEmp && r.employee_name !== filterEmp) return false;
                    if (filterStatus !== "all" && r.status !== filterStatus) return false;
                    return true;
                  });

                  if (listFiltered.length === 0) {
                    return <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No timesheets found for this week.</td></tr>;
                  }

                  return listFiltered.map((r, idx) => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}22`, background: idx % 2 === 0 ? "transparent" : C.bg + "44" }}>
                      <Td style={{ fontWeight: 600, color: C.text }}>{r.employee_name}</Td>
                      <Td style={{ fontWeight: 700, color: C.accent }}>{r.project_code}</Td>
                      <Td style={{ color: C.textDim, fontSize: 12 }}>{r.work_date ? fmtD(r.work_date) : "—"}</Td>
                      <Td style={{ fontWeight: 700, color: C.text }}>{r.hours}</Td>
                      <Td style={{ color: C.textDim, fontSize: 12 }}>{r.task || "—"}</Td>
                      <Td><StatusBadge status={r.status} /></Td>
                      <Td>
                        {r.status === "pending" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <Btn small variant="success" onClick={() => handleApprove(r.id)}>✓ Approve</Btn>
                            <Btn small variant="danger" onClick={() => handleReject(r.id)}>✕</Btn>
                          </div>
                        )}
                      </Td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── AmendRow: self-contained editable row for a single employee's balance ────
function AmendRow({ emp, initialBal, idx, onSaved }) {
  const [bal, setBal] = useState({
    balance: String(parseFloat(initialBal.balance) || 0),
    total_credited: String(parseFloat(initialBal.total_credited) || 0),
    total_used: String(parseFloat(initialBal.total_used) || 0),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const updated = await api.updateLeaveBalance(emp.id, {
        balance: parseFloat(bal.balance) || 0,
        total_credited: parseFloat(bal.total_credited) || 0,
        total_used: parseFloat(bal.total_used) || 0,
      });
      onSaved({ balance: parseFloat(updated.balance) || 0, total_credited: parseFloat(updated.total_credited) || 0, total_used: parseFloat(updated.total_used) || 0 });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
  }

  const inputStyle = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: "5px 8px", fontSize: 13, width: 72, outline: "none" };

  return (
    <tr style={{ borderBottom: `1px solid ${C.border}22`, background: idx % 2 === 0 ? "transparent" : C.bg + "44" }}>
      <Td><span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{emp.name}</span></Td>
      <Td><input type="number" min={0} step={0.5} value={bal.balance} onChange={e => setBal(b => ({ ...b, balance: e.target.value }))} style={{ ...inputStyle, color: C.accent, fontWeight: 700 }} /></Td>
      <Td><input type="number" min={0} step={0.5} value={bal.total_credited} onChange={e => setBal(b => ({ ...b, total_credited: e.target.value }))} style={inputStyle} /></Td>
      <Td><input type="number" min={0} step={0.5} value={bal.total_used} onChange={e => setBal(b => ({ ...b, total_used: e.target.value }))} style={inputStyle} /></Td>
      <Td>
        <button onClick={save} disabled={saving}
          style={{ background: saved ? C.green : C.accent, color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: saving ? "wait" : "pointer", transition: "background .2s" }}>
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save"}
        </button>
      </Td>
    </tr>
  );
}

// ════════════════════════════════════════════════════════
// LEAVES
// ════════════════════════════════════════════════════════
// Leave types that consume from the shared balance bucket
const BALANCE_TYPES = new Set(["Sick", "Annual"]);

function Leaves({ currentUser, viewOnly }) {
  const [rows, setRows] = useState([]); const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ employeeId: "", type: "Annual", startDate: "", endDate: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState(null);   // { balance, total_credited, total_used, last_credited_month }
  const [crediting, setCrediting] = useState(false);
  const [leaveSettings, setLeaveSettings] = useState({});   // { holiday_link: "..." }
  const [allBalances, setAllBalances] = useState({});       // { "emp_id": { balance, ... } } for admin/manager
  const [settingsModal, setSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ holiday_link: "" });
  const [settingsSaving, setSettingsSaving] = useState(false);
  // { employeeId, employeeName, balance, total_credited, total_used }
  const [editBalanceTarget, setEditBalanceTarget] = useState(null);
  const [editBalanceSaving, setEditBalanceSaving] = useState(false);

  // Compute days selected in the form
  const selectedDays = (() => {
    if (!form.startDate || !form.endDate) return 0;
    const s = new Date(form.startDate), e = new Date(form.endDate);
    const d = Math.round((e - s) / 86400000) + 1;
    return d > 0 ? d : 0;
  })();
  const willDeduct = BALANCE_TYPES.has(form.type) && selectedDays > 0;
  const balAfter = balance ? Math.max((parseFloat(balance.balance) || 0) - selectedDays, 0) : 0;
  const insufficient = willDeduct && balance && selectedDays > parseFloat(balance.balance);
  const isIntern = (() => {
    const me = employees.find(e => e.id === currentUser.employee_id);
    return me ? /intern/i.test(me.group_name || "") : false;
  })();

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const params = {}; if (viewOnly) params.employee_id = currentUser.employee_id;
      const [lv, em, bal, settings, allBal] = await Promise.all([
        api.getLeaves(params),
        api.getEmployees(),
        api.getLeaveBalance(viewOnly ? currentUser.employee_id : undefined).catch(() => null),
        api.getLeaveSettings().catch(() => ({})),
        (!viewOnly ? api.getAllLeaveBalances().catch(() => ({})) : Promise.resolve({})),
      ]);
      setRows(lv); setEmployees(em); setBalance(bal);
      setLeaveSettings(settings || {});
      setSettingsForm({ holiday_link: settings?.holiday_link || "" });
      setAllBalances(allBal || {});
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  });
  useEffect(() => { load(); }, []);

  // Refresh balance for a specific employee in the modal (admin view)
  async function loadBalanceFor(empId) {
    if (!empId) { setBalance(null); return; }
    try { setBalance(await api.getLeaveBalance(empId)); } catch { setBalance(null); }
  }

  async function handleCreate() {
    if (!form.startDate || !form.endDate) return;
    if (insufficient) { dialog.alert("Insufficient leave balance.", { title: "Not enough balance", dtype: "warning" }); return; }
    setSaving(true);
    try {
      const empId = viewOnly ? currentUser.employee_id : +form.employeeId;
      await api.createLeave({ employeeId: empId, ...form });
      setModal(false); setForm({ employeeId: "", type: "Annual", startDate: "", endDate: "", reason: "" });
      await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
  }

  async function handleCreditMonthly() {
    if (!await dialog.confirm("Credit 2 leaves to ALL employees for this month? This cannot be undone.", { dtype: "warning" })) return;
    setCrediting(true);
    try {
      const res = await api.creditMonthlyLeaves();
      dialog.alert(`✅ Credited ${res.credited} employee(s) for ${res.month}. ${res.credited === 0 ? "All already credited this month." : ""}`, { title: "Monthly Credit Done" });
      await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setCrediting(false); }
  }

  const summary = { total: rows.length, pending: rows.filter(l => l.status === "pending").length, approved: rows.filter(l => l.status === "approved").length };
  const cols = [...(!viewOnly ? ["Employee"] : []), "Type", "From", "To", "Days", "Reason", "Status", ...(!viewOnly ? ["Balance", "Action"] : [])];
  const balNum = balance ? parseFloat(balance.balance) || 0 : 0;
  const balColor = balNum >= 4 ? C.green : balNum >= 2 ? C.amber : C.red;

  async function handleSaveSettings() {
    setSettingsSaving(true);
    try {
      await api.updateLeaveSettings(settingsForm);
      setLeaveSettings({ ...leaveSettings, ...settingsForm });
      setSettingsModal(false);
      dialog.alert("Holiday calendar link saved!", { title: "Settings Saved", dtype: "success" });
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSettingsSaving(false); }
  }

  async function handleSaveBalance() {
    if (!editBalanceTarget) return;
    setEditBalanceSaving(true);
    try {
      const updated = await api.updateLeaveBalance(editBalanceTarget.employeeId, {
        balance: parseFloat(editBalanceTarget.balance) || 0,
        total_credited: parseFloat(editBalanceTarget.total_credited) || 0,
        total_used: parseFloat(editBalanceTarget.total_used) || 0,
      });
      setAllBalances(prev => ({
        ...prev,
        [String(editBalanceTarget.employeeId)]: {
          balance: parseFloat(updated.balance) || 0,
          total_credited: parseFloat(updated.total_credited) || 0,
          total_used: parseFloat(updated.total_used) || 0,
        },
      }));
      setEditBalanceTarget(null);
      dialog.alert("Leave balance updated!", { title: "Updated", dtype: "success" });
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setEditBalanceSaving(false); }
  }

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>{viewOnly ? "My Leave" : "Leave Management"}</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>
            {viewOnly ? "View your time-off requests" : "Track all absences"}
          </p></div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {!viewOnly && currentUser.role === "admin" && (
            <Btn variant="ghost" onClick={handleCreditMonthly} disabled={crediting} small>
              {crediting ? "Crediting…" : "🗓 Credit Monthly Leaves"}
            </Btn>
          )}
          {!viewOnly && currentUser.role === "admin" && (
            <Btn variant="ghost" onClick={() => setEditBalanceTarget("open")} small>🧹 Amend Bucket of Leave</Btn>
          )}
          {!viewOnly && currentUser.role === "admin" && (
            <Btn variant="ghost" onClick={() => setSettingsModal(true)} small>⚙ Holiday Link</Btn>
          )}
          {leaveSettings.holiday_link && (
            <a
              href={leaveSettings.holiday_link}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 13, fontWeight: 600, color: C.accent,
                textDecoration: "none", display: "flex", alignItems: "center", gap: 5,
                border: `1px solid ${C.accent}44`, borderRadius: 8,
                padding: "6px 12px", background: C.accentGlow, transition: "opacity .15s"
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = ".8"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              🗓 View Holiday Calendar
            </a>
          )}
          <Btn onClick={() => setModal(true)}>+ Request Leave</Btn>
        </div>
      </div>

      {/* Summary cards + Balance card */}
      <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {[["Total Requests", summary.total, C.accent], ["Pending", summary.pending, C.amber], ["Approved", summary.approved, C.green]].map(([l, v, col]) => (
          <Card key={l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: col }}>{v}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{l}</div>
          </Card>
        ))}
      </div>

      {/* Leave Balance Banner */}
      {balance !== null && !isIntern && (
        <Card style={{ background: balNum === 0 ? C.red + "12" : C.surface, border: `1px solid ${balColor}44`, padding: "18px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, letterSpacing: .5, textTransform: "uppercase", marginBottom: 6 }}>
                🗂 Leave Balance (Sick &amp; Vacation)
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: balColor, lineHeight: 1 }}>{balNum}</span>
                <span style={{ fontSize: 14, color: C.textMuted }}>day{balNum !== 1 ? "s" : ""} available</span>
              </div>
              {balance.last_credited_month && (
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  Last credited: <strong style={{ color: C.textDim }}>{balance.last_credited_month}</strong>
                  &nbsp;· +2 leaves added every month-end automatically
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              {[["Total Earned", balance.total_credited, C.green], ["Total Used", balance.total_used, C.amber]].map(([lbl, val, col]) => (
                <div key={lbl} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: col }}>{parseFloat(val) || 0}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Leave table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: C.surface }}><tr>{cols.map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {rows.map((l, idx) => {
                const s = new Date(l.start_date); const e = new Date(l.end_date);
                const days = Math.round((e - s) / 86400000) + 1;
                const usesBalance = BALANCE_TYPES.has(l.leave_type);
                const empBal = !viewOnly ? (allBalances[String(l.employee_id)] || null) : null;
                const empBalNum = empBal ? parseFloat(empBal.balance) || 0 : null;
                const empBalColor = empBalNum === null ? C.textMuted : empBalNum >= 4 ? C.green : empBalNum >= 2 ? C.amber : C.red;
                return (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}22`, background: idx % 2 === 0 ? "transparent" : C.bg + "44" }}>
                    {!viewOnly && <Td><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar initials={l.avatar} color={l.group_color} size={28} />
                      <span style={{ fontSize: 13, color: C.text }}>{l.employee_name}</span>
                    </div></Td>}
                    <Td>
                      <Badge color={l.leave_type === "Sick" ? C.red : l.leave_type === "Annual" ? C.accent : C.textMuted}>{l.leave_type}</Badge>
                      {usesBalance && <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 4 }}>(-bucket)</span>}
                    </Td>
                    <Td style={{ fontSize: 12, color: C.textDim }}>{fmtD(l.start_date)}</Td>
                    <Td style={{ fontSize: 12, color: C.textDim }}>{fmtD(l.end_date)}</Td>
                    <Td style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{days > 0 ? `${days}d` : "—"}</Td>
                    <Td style={{ fontSize: 12, color: C.textDim, maxWidth: 180 }}>{l.reason}</Td>
                    <Td><StatusBadge status={l.status} /></Td>
                    {!viewOnly && <Td>
                      {empBalNum !== null ? (
                        <span style={{ fontWeight: 700, fontSize: 13, color: empBalColor }}>{empBalNum}d</span>
                      ) : <span style={{ color: C.textMuted, fontSize: 12 }}>—</span>}
                    </Td>}
                    {!viewOnly && <Td>{l.status === "pending" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <Btn small variant="success" onClick={async () => { try { await api.approveLeave(l.id); await load(); } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } }}>✓</Btn>
                        <Btn small variant="danger" onClick={async () => { try { await api.rejectLeave(l.id); await load(); } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } }}>✕</Btn>
                      </div>
                    )}</Td>}
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={cols.length} style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Admin: Amend Bucket of Leave Modal */}
      {editBalanceTarget === "open" && (() => {
        // Build one editable row per unique employee from allBalances + employees list
        return (
          <Modal title="🧹 Amend Bucket of Leave" onClose={() => setEditBalanceTarget(null)} maxWidth={860}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 13, color: C.textMuted }}>
                Edit leave balances for all employees. Click ❯❯ Save on each row to apply changes.
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: C.surface }}><tr>
                    {["Employee", "Available Balance", "Total Credited", "Total Used", "Action"].map(h => <Th key={h}>{h}</Th>)}
                  </tr></thead>
                  <tbody>
                    {employees.filter(e => e.id).map((emp, idx) => {
                      const key = String(emp.id);
                      const bal = allBalances[key] || { balance: 0, total_credited: 0, total_used: 0 };
                      return (
                        <AmendRow
                          key={emp.id}
                          emp={emp}
                          initialBal={bal}
                          idx={idx}
                          onSaved={(updated) => {
                            setAllBalances(prev => ({ ...prev, [key]: updated }));
                          }}
                        />
                      );
                    })}
                    {employees.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No employees found.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Btn variant="ghost" onClick={() => setEditBalanceTarget(null)}>Close</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Admin: Holiday Calendar Settings Modal */}
      {settingsModal && (
        <Modal title="⚙ Holiday Calendar Settings" onClose={() => setSettingsModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: C.textMuted }}>
              Set a link to your company holiday calendar. This link will be shown to employees in the Request Leave form.
            </div>
            <Inp label="Holiday Calendar URL" value={settingsForm.holiday_link} onChange={v => setSettingsForm(f => ({ ...f, holiday_link: v }))} placeholder="https://calendar.google.com/..." />
            {settingsForm.holiday_link && (
              <div style={{ fontSize: 12, color: C.textMuted }}>
                Preview: <a href={settingsForm.holiday_link} target="_blank" rel="noreferrer" style={{ color: C.accent }}>🗓 View Holiday Calendar →</a>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setSettingsModal(false)}>Cancel</Btn>
              <Btn onClick={handleSaveSettings} disabled={settingsSaving}>{settingsSaving ? "Saving…" : "Save Link"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title="Request Leave" onClose={() => { setModal(false); setBalance(viewOnly ? balance : null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!viewOnly && (
              <Inp label="Employee" value={form.employeeId} onChange={v => { setForm(f => ({ ...f, employeeId: v })); loadBalanceFor(v); }} required
                options={employees.map(e => ({ value: e.id, label: e.name }))} />
            )}
            {viewOnly && (
              <div style={{ background: C.surface, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.textDim }}>
                Requesting as: <span style={{ color: C.text, fontWeight: 700 }}>{currentUser.emp_name}</span>
              </div>
            )}

            {/* Leave type */}
            <Inp label="Leave Type" value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))}
              options={[
                { value: "Annual", label: "Annual / Vacation 🌴 (uses balance)" },
                { value: "Sick", label: "Sick Leave 🤒 (uses balance)" },
                { value: "Unpaid", label: "Unpaid" },
                { value: "Maternity", label: "Maternity" },
                { value: "Paternity", label: "Paternity" },
              ]} />

            {/* Balance indicator for bucket types */}
            {BALANCE_TYPES.has(form.type) && balance !== null && !isIntern && (
              <div style={{
                background: insufficient ? C.red + "18" : C.green + "12",
                border: `1px solid ${insufficient ? C.red : C.green}44`,
                borderRadius: 10, padding: "12px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8
              }}>
                <div>
                  <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700 }}>LEAVE BALANCE</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: insufficient ? C.red : balColor }}>
                    {balNum} <span style={{ fontSize: 13, fontWeight: 400, color: C.textMuted }}>available</span>
                  </div>
                </div>
                {selectedDays > 0 && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: C.textMuted }}>After this request</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: insufficient ? C.red : C.textDim }}>
                      {insufficient ? "—" : balAfter} days left
                    </div>
                  </div>
                )}
              </div>
            )}
            {insufficient && (
              <div style={{ background: C.red + "14", border: `1px solid ${C.red}44`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.red }}>
                ⚠ You only have <strong>{balNum}</strong> day(s) available but requested <strong>{selectedDays}</strong>. Please reduce the duration or choose Unpaid leave.
              </div>
            )}

            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Start Date" type="date" value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} required />
              <Inp label="End Date" type="date" value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} required />
            </div>
            {selectedDays > 0 && (
              <div style={{ fontSize: 12, color: C.textDim, textAlign: "center" }}>
                📅 {selectedDays} day{selectedDays !== 1 ? "s" : ""} selected
                {willDeduct && <span style={{ color: C.amber }}> — will deduct from your balance</span>}
              </div>
            )}
            <Inp label="Reason" value={form.reason} onChange={v => setForm(f => ({ ...f, reason: v }))} placeholder="Brief description…" />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
              <Btn onClick={handleCreate} disabled={saving || insufficient}>{saving ? "Saving…" : "Submit Request"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// USER ACCOUNTS
// ════════════════════════════════════════════════════════
function UserAccounts() {
  const [accounts, setAccounts] = useState([]); const [employees, setEmployees] = useState([]); const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState("");
  const [modal, setModal] = useState(false); const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ employeeId: "", username: "", password: "", role: "employee" });
  const [editForm, setEditForm] = useState({}); const [formErr, setFormErr] = useState(""); const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { const [a, e, g] = await Promise.all([api.getAccounts(), api.getEmployees(), api.getGroups()]); setAccounts(a); setEmployees(e); setGroups(g); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
  });
  useEffect(() => { load(); }, []);

  const unlinked = employees.filter(e => !accounts.find(a => a.employee_id === e.id));

  async function handleCreate() {
    setFormErr("");
    if (!form.username || !form.password) { setFormErr("Username and password required"); return; }
    if (form.password.length < 4) { setFormErr("Password must be at least 4 characters"); return; }
    setSaving(true);
    try {
      await api.createAccount({ ...form, employeeId: form.employeeId ? +form.employeeId : null });
      setModal(false); setForm({ employeeId: "", username: "", password: "", role: "employee" }); await load();
    }
    catch (e) { setFormErr(e.message); } finally { setSaving(false); }
  }

  async function handleEdit() {
    setSaving(true);
    try { await api.updateAccount(editId, { ...editForm }); setEditId(null); await load(); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
  }

  async function toggleActive(id, current) {
    try { const acct = accounts.find(a => a.id === id); await api.updateAccount(id, { ...acct, active: !current }); await load(); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>User Accounts</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Create and manage employee login credentials</p></div>
        <Btn onClick={() => setModal(true)}>+ Create Login</Btn>
      </div>
      <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {[["Total Accounts", accounts.length, C.accent], ["Active", accounts.filter(a => a.active).length, C.green], ["Awaiting Setup", unlinked.length, C.amber]].map(([l, v, col]) => (
          <Card key={l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: col }}>{v}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{l}</div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: C.surface }}><tr>
              {["Employee", "Group", "Username", "Role", "Status", "Actions"].map(h => <Th key={h}>{h}</Th>)}
            </tr></thead>
            <tbody>
              {accounts.map((a, idx) => {
                const grp = groups.find(g => g.id === a.group_id);
                return (<tr key={a.id} style={{ borderBottom: `1px solid ${C.border}22`, background: idx % 2 === 0 ? "transparent" : C.bg + "44" }}>
                  <Td><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar initials={a.avatar || "??"} color={a.group_color || C.accent} size={28} />
                    <span style={{ fontSize: 13, color: C.text }}>{a.emp_name || "—"}</span>
                  </div></Td>
                  <Td>{a.group_name ? <Badge color={a.group_color || C.accent}>{a.group_name}</Badge> : <span style={{ color: C.textMuted, fontSize: 12 }}>—</span>}</Td>
                  <Td><span style={{ fontSize: 13, fontWeight: 600, color: C.accent, fontFamily: "monospace" }}>{a.username}</span></Td>
                  <Td><Badge color={a.role === "admin" ? C.purple : C.green}>{a.role}</Badge></Td>
                  <Td><button onClick={() => toggleActive(a.id, a.active)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <StatusBadge status={a.active ? "active" : "inactive"} />
                  </button></Td>
                  <Td><div style={{ display: "flex", gap: 6 }}>
                    <Btn small variant="ghost" onClick={() => { setEditForm({ ...a, newPass: "" }); setEditId(a.id); }}>✏ Edit</Btn>
                    <Btn small variant="danger" onClick={async () => { if (await dialog.confirm("Delete this account?", { dtype: "warning" })) try { await api.deleteAccount(a.id); await load(); } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } }}>🗑</Btn>
                  </div></Td>
                </tr>);
              })}
              {accounts.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>No accounts yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {unlinked.length > 0 && (
        <div style={{ background: C.amber + "14", border: `1px solid ${C.amber}33`, borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 10 }}>⚠ {unlinked.length} employee{unlinked.length > 1 ? "s" : ""} without login</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {unlinked.map(e => {
              const g = groups.find(x => x.id === e.group_id); return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 6, background: C.surface, borderRadius: 8, padding: "5px 10px", border: `1px solid ${C.border}` }}>
                  <Avatar initials={e.avatar} color={g?.color || C.accent} size={20} />
                  <span style={{ fontSize: 12, color: C.textDim }}>{e.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {modal && (
        <Modal title="Create Employee Login" onClose={() => { setModal(false); setFormErr(""); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Inp label="Employee" value={form.employeeId} onChange={v => setForm(f => ({ ...f, employeeId: v }))}
              options={employees.map(e => ({ value: e.id, label: `${e.name} (${groups.find(g => g.id === e.group_id)?.name || "No Group"})` }))} />
            <Inp label="Username" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} required placeholder="e.g. john.doe" />
            <Inp label="Password" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} required placeholder="Min 4 characters" />
            <Inp label="Role" value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))}
              options={[{ value: "employee", label: "Employee" }, { value: "intras", label: "Intern" }, { value: "admin", label: "Admin" }, { value: "manager", label: "Manager" }]} />
            {formErr && <div style={{ background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.red }}>⚠ {formErr}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => { setModal(false); setFormErr(""); }}>Cancel</Btn>
              <Btn onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create Account"}</Btn>
            </div>
          </div>
        </Modal>
      )}
      {editId && (
        <Modal title="Edit Account" onClose={() => setEditId(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Inp label="Username" value={editForm.username || ""} onChange={v => setEditForm(f => ({ ...f, username: v }))} required />
            <Inp label="New Password (blank = keep)" type="password" value={editForm.newPass || ""} onChange={v => setEditForm(f => ({ ...f, newPass: v }))} placeholder="Enter new password…" />
            <Inp label="Role" value={editForm.role || "employee"} onChange={v => setEditForm(f => ({ ...f, role: v }))}
              options={[{ value: "employee", label: "Employee" }, { value: "intras", label: "Intern" }, { value: "admin", label: "Admin" }, { value: "manager", label: "Manager" }]} />
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={!!editForm.active} onChange={e => setEditForm(f => ({ ...f, active: e.target.checked }))} />
              <span style={{ fontSize: 13, color: C.textDim }}>Account Active</span>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setEditId(null)}>Cancel</Btn>
              <Btn onClick={handleEdit} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// REPORTS
// ════════════════════════════════════════════════════════
function Reports() {
  const [projects, setProjects] = useState([]); const [selId, setSelId] = useState("");
  const [report, setReport] = useState(null); const [loading, setLoading] = useState(true); const [repLoading, setRepLoading] = useState(false);

  useEffect(() => { api.getProjects().then(p => { setProjects(p); if (p.length > 0) setSelId(String(p[0].id)); }).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!selId) return; setRepLoading(true); api.getProjectReport(selId).then(setReport).catch(() => setReport(null)).finally(() => setRepLoading(false)); }, [selId]);

  if (loading) return <Spinner />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Client Reports</h2>
        <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Automated billing & transparency reports</p></div>
      <div style={{ maxWidth: 360 }}>
        <Inp label="Select Project" value={selId} onChange={setSelId} options={projects.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))} />
      </div>
      {repLoading && <Spinner />}
      {report && !repLoading && (<>
        <Card style={{ background: `linear-gradient(135deg,${C.accentDim}22,${C.card})`, border: `1px solid ${C.accent}33` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase", marginBottom: 6 }}>Client Report — {report.project?.code}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{report.project?.name}</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Client: {report.project?.client}</div>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[["Total Budget", fmt$(report.project?.budget), C.text], ["Amount Billed", fmt$(report.total_cost), C.green], ["Hours Logged", `${report.total_hours}h`, C.accent]].map(([l, v, col]) => (
                <div key={l} style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text }}>Resource Breakdown</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Employee", "Group", "Rate", "Hours", "Total Cost"].map(h => <Th key={h}>{h}</Th>)}
              </tr></thead>
              <tbody>
                {(report.by_employee || []).map(e => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                    <Td><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar initials={e.avatar} color={e.group_color} size={28} />
                      <span style={{ fontSize: 13, color: C.text }}>{e.name}</span>
                    </div></Td>
                    <Td>{e.group_name && <Badge color={e.group_color || C.accent}>{e.group_name}</Badge>}</Td>
                    <Td style={{ fontSize: 12, color: C.textDim }}>₹{e.hourly_rate}/hr</Td>
                    <Td style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{e.total_hours}h</Td>
                    <Td style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{fmt$(e.total_cost)}</Td>
                  </tr>
                ))}
                <tr style={{ borderTop: `1px solid ${C.border}` }}>
                  <td colSpan={3} style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Total</td>
                  <Td style={{ fontSize: 13, fontWeight: 800, color: C.accent }}>{report.total_hours}h</Td>
                  <Td style={{ fontSize: 13, fontWeight: 800, color: C.green }}>{fmt$(report.total_cost)}</Td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        {(report.by_task || []).length > 0 && (
          <Card>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text }}>Task Distribution</h3>
            {report.by_task.map(t => (
              <div key={t.task} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: C.text }}>{t.task || "(no description)"}</span>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{t.total_hours}h ({report.total_hours ? ((t.total_hours / report.total_hours) * 100).toFixed(0) : 0}%)</span>
                </div>
                <ProgressBar value={t.total_hours} max={report.total_hours} color={C.purple} />
              </div>
            ))}
          </Card>
        )}
      </>)}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// MY PROFILE
// ════════════════════════════════════════════════════════
function MyProfile({ currentUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({});

  const [pwForm, setPwForm] = useState({ oldPassword: "", newPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [showCtc, setShowCtc] = useState(false);
  const [showPan, setShowPan] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => {
    api.getEmployee(currentUser.employee_id)
      .then(p => { setProfile(p); setForm({ ...p, bankAccountNo: p.bank_account_no, bankIfsc: p.bank_ifsc, bankName: p.bank_name, emergencyContact: p.emergency_contact }); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [currentUser.employee_id]);

  async function handleSave() {
    setSaving(true); setErr("");
    try {
      const payload = {
        name: profile.name, email: profile.email, groupId: profile.group_id, joiningDate: profile.joining_date, ctcAnnual: profile.ctc_annual,
        dob: form.dob, address: form.address, mobile: form.mobile, emergencyContact: form.emergencyContact, skillset: form.skillset,
        bankAccountNo: form.bankAccountNo, bankIfsc: form.bankIfsc, bankName: form.bankName,
        panNumber: form.panNumber, designation: profile.designation, location: profile.location, variablePay: profile.variable_pay_amount
      };
      await api.updateEmployee(currentUser.employee_id, payload);
      dialog.alert("Profile updated successfully!", { title: "Success", dtype: "success" });
      setIsEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePw() {
    if (!pwForm.oldPassword || !pwForm.newPassword) return setErr("Both password fields are required.");
    setPwSaving(true);
    try {
      await api.updatePassword(pwForm);
      dialog.alert("Password updated successfully!", { title: "Success", dtype: "success" });
      setPwForm({ oldPassword: "", newPassword: "" });
      setErr(null);
      setShowPwModal(false);
    } catch (e) { setErr(e.message); }
    setPwSaving(false);
  }

  if (loading) return <Spinner />;
  if (err && !profile) return <ErrBox msg={err} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>My Profile</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>
            View your organizational details and manage your personal information.
            {" "}
            <span style={{ color: C.accent, cursor: "pointer", textDecoration: "underline", fontWeight: 600, marginLeft: 8 }} onClick={() => setShowPwModal(true)}>
              Change Password
            </span>
          </p>
        </div>
        <div>
          {!isEditing ? (
            <Btn onClick={() => setIsEditing(true)}>✏ Edit Profile</Btn>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={() => {
                setIsEditing(false);
                setForm({ ...profile, bankAccountNo: profile.bank_account_no, bankIfsc: profile.bank_ifsc, bankName: profile.bank_name });
              }}>Cancel</Btn>
              <Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Profile"}</Btn>
            </div>
          )}
        </div>
      </div>

      {err && <div style={{ background: C.red + "18", color: C.red, padding: "10px 14px", borderRadius: 8, fontSize: 13, border: `1px solid ${C.red}44` }}>⚠ {err}</div>}

      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Card>
          <h4 style={{ margin: "0 0 16px", fontSize: 14, color: C.text, fontWeight: 800 }}>Organizational Details <span style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, marginLeft: 8 }}>(Read-Only)</span></h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Inp label="Full Name" value={profile.name} disabled />
            <Inp label="Employee ID" value={profile.custom_employee_id || "—"} disabled />
            <Inp label="Email" value={profile.email} disabled />
            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Role / Group" value={profile.group_name || "—"} disabled />
              <Inp label="Manager" value={profile.manager_name || "—"} disabled />
            </div>
            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Designation" value={profile.designation || "—"} disabled />
              <Inp label="Location" value={profile.location || "—"} disabled />
            </div>
            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Joining Date" value={profile.joining_date ? fmtD(profile.joining_date) : "—"} disabled />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, letterSpacing: .4 }}>Annual CTC</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px" }}>
                  <span style={{ flex: 1, fontSize: 13, color: C.text, letterSpacing: showCtc ? "normal" : "0.15em" }}>
                    {profile.ctc_annual
                      ? (showCtc ? `₹${Number(profile.ctc_annual).toLocaleString("en-IN")}` : "••••••••")
                      : "—"}
                  </span>
                  {profile.ctc_annual && (
                    <button onClick={() => setShowCtc(v => !v)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 15, padding: 0, lineHeight: 1 }} title={showCtc ? "Hide" : "Show"}>
                      {showCtc ? "🙈" : "👁"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h4 style={{ margin: "0 0 16px", fontSize: 14, color: C.text, fontWeight: 800 }}>Personal Information</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp disabled={!isEditing} label="Date of Birth" type="date" value={form.dob || ""} onChange={v => setForm(f => ({ ...f, dob: v }))} />
              <Inp disabled={!isEditing} label="Mobile" value={form.mobile || ""} onChange={v => setForm(f => ({ ...f, mobile: v }))} placeholder="+1 123 456 7890" />
              <Inp disabled={!isEditing} label="Emergency Contact" value={form.emergencyContact || ""} onChange={v => setForm(f => ({ ...f, emergencyContact: v }))} placeholder="+1 ... (Emergency)" />
            </div>
            <Inp disabled={!isEditing} label="Address" value={form.address || ""} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Full address..." />
            <Inp disabled={!isEditing} label="Skillset" value={form.skillset || ""} onChange={v => setForm(f => ({ ...f, skillset: v }))} placeholder="e.g. React, Node, SQL, Python" />
          </div>
        </Card>
      </div>

      <Card>
        <h4 style={{ margin: "0 0 16px", fontSize: 14, color: C.text, fontWeight: 800 }}>Banking Details & Taxation</h4>
        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {isEditing ? (
            <div>
              <Inp label="PAN Number" value={form.panNumber || profile.pan_number || ""} onChange={v => setForm(f => ({ ...f, panNumber: v }))} placeholder="ABCDE1234F" type={showPan ? "text" : "password"} />
              <button onClick={() => setShowPan(s => !s)} style={{ marginTop: 4, background: "none", border: "none", cursor: "pointer", color: C.accent, fontSize: 11, fontWeight: 600, padding: 0 }}>{showPan ? "Hide" : "View"}</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600, letterSpacing: .4 }}>PAN Number</label>
              <SensitiveDisplay value={form.panNumber || profile?.pan_number} />
            </div>
          )}
          <Inp disabled={!isEditing} label="Bank Name" value={form.bankName || ""} onChange={v => setForm(f => ({ ...f, bankName: v }))} placeholder="e.g. Chase" />
        </div>
        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          {isEditing ? (
            <div>
              <Inp label="Account No" value={form.bankAccountNo || ""} onChange={v => setForm(f => ({ ...f, bankAccountNo: v }))} placeholder="1234567890" type={showAccount ? "text" : "password"} />
              <button onClick={() => setShowAccount(s => !s)} style={{ marginTop: 4, background: "none", border: "none", cursor: "pointer", color: C.accent, fontSize: 11, fontWeight: 600, padding: 0 }}>{showAccount ? "Hide" : "View"}</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600, letterSpacing: .4 }}>Account No</label>
              <SensitiveDisplay value={form.bankAccountNo} />
            </div>
          )}
          <Inp disabled={!isEditing} label="IFSC Code" value={form.bankIfsc || ""} onChange={v => setForm(f => ({ ...f, bankIfsc: v }))} placeholder="CHAS0123456" />
        </div>
      </Card>

      {showPwModal && (
        <Modal title="Change Password" onClose={() => setShowPwModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              <Inp label="Current Password" type="password" value={pwForm.oldPassword} onChange={v => setPwForm(f => ({ ...f, oldPassword: v }))} placeholder="••••••••" />
              <Inp label="New Password" type="password" value={pwForm.newPassword} onChange={v => setPwForm(f => ({ ...f, newPassword: v }))} placeholder="••••••••" />
            </div>
            <div style={{ fontSize: 12, color: C.textDim }}>Updates your login credentials immediately.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <Btn onClick={handleSavePw} disabled={pwSaving} style={{ padding: "8px 24px", fontSize: 13, background: `linear-gradient(135deg,${C.purple},${C.purple}dd)` }}>
                {pwSaving ? "Updating…" : "Update Password"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

// ════════════════════════════════════════════════════════
// EMPLOYEE HOME
// ════════════════════════════════════════════════════════
function EmployeeHome({ currentUser }) {
  const [tab, setTab] = useState("profile");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card style={{ padding: 0, overflow: "hidden", border: `1px solid ${C.accent}33`, position: "relative", height: 225 }}>
        <img src="/banner.jpg" alt="Fascinate IT" style={{ width: "100%", height: "100%", display: "block", objectFit: "cover", objectPosition: "bottom" }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, rgba(10,14,26,0.88) 0%, rgba(10,14,26,0.65) 50%, rgba(10,14,26,0.15) 100%)",
          display: "flex", alignItems: "center", padding: "0 28px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Avatar initials={currentUser.avatar || mkAvi(currentUser.emp_name || "")} color={C.accent} size={54} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#ffffff" }}>Welcome, {(currentUser.emp_name || currentUser.username).split(" ")[0]} 👋</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>Employee Portal</div>
              <div style={{ marginTop: 8 }}><Badge color={C.green}>{currentUser.role === "manager" ? "Manager" : currentUser.role === "admin" ? "Admin" : currentUser.role === "intras" ? "Intern" : "Employee"}</Badge></div>
            </div>
          </div>
        </div>
      </Card>
      <div style={{ display: "flex", gap: 4, background: C.surface, padding: 4, borderRadius: 10, width: "fit-content", flexWrap: "wrap" }}>
        {[["profile", "👤 My Profile"], ["timesheets", "⏱ My Timesheets"], ["leave", "🌴 My Leave"], ["expenses", "💳 My Expenses"], ["pay", "💰 My Pay"], ["policies", "📜 Company Policy"]]
          .filter(([t]) => t !== "pay" || currentUser.role !== "intras")
          .map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: tab === t ? C.card : "transparent", color: tab === t ? C.text : C.textMuted,
              border: tab === t ? `1px solid ${C.border}` : "1px solid transparent",
              borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer"
            }}>{label}</button>
          ))}
      </div>
      {tab === "profile" && <MyProfile currentUser={currentUser} />}
      {tab === "timesheets" && <Timesheets currentUser={currentUser} viewOnly />}
      {tab === "leave" && <Leaves currentUser={currentUser} viewOnly />}
      {tab === "expenses" && <Expenses currentUser={currentUser} viewOnly />}
      {tab === "pay" && currentUser.role !== "intras" && <MyPay currentUser={currentUser} />}
      {tab === "policies" && <DocumentGrid type="policy" allowEdit={false} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// MY PAY – Payslip with print-to-PDF
// ════════════════════════════════════════════════════════
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function computeSlip(ctc) {
  const gross = Math.round(ctc / 12);
  const basic = Math.round(gross * 0.40);
  const hra = Math.round(basic * 0.50);
  const transport = 1600;
  const special = Math.max(0, gross - basic - hra - transport);
  const pfEmp = Math.round(basic * 0.12);
  const profTax = 200;
  return { gross, basic, hra, transport, special, pfEmp, profTax, netPay: gross - pfEmp - profTax };
}

function MyPay({ currentUser }) {
  const [payslips, setPayslips] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [showAmounts, setShowAmounts] = useState(false);
  const origin = window.location.origin;

  useEffect(() => {
    api.getPayslips().then(ps => {
      setPayslips(ps);
      if (ps.length > 0) setSelected(ps[0]);
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);

  async function handleRequestDownload(ps) {
    setRequesting(true);
    try {
      const updated = await api.requestPayslipDownload(ps.id);
      setPayslips(prev => prev.map(p => p.id === ps.id ? { ...p, ...updated } : p));
      setSelected(prev => prev?.id === ps.id ? { ...prev, ...updated } : prev);
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setRequesting(false); }
  }

  if (loading) return <Spinner />;

  const fmt = n => `₹${Number(n).toLocaleString("en-IN")}`;
  const mask = n => showAmounts ? fmt(n) : "••••••";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>My Pay</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Monthly salary slips issued by your admin</p>
        </div>
        {payslips.length > 0 && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setShowAmounts(v => !v)} title={showAmounts ? "Hide amounts" : "View amounts"}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.textMuted, padding: "7px 12px", fontSize: 14, cursor: "pointer", lineHeight: 1 }}>
              {showAmounts ? "🙈 Hide" : "👁 View"}
            </button>
            <select value={selected?.id || ""} onChange={e => setSelected(payslips.find(p => p.id === +e.target.value))}
              style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 13, cursor: "pointer" }}>
              {payslips.map(p => (
                <option key={p.id} value={p.id}>{SLIP_MONTHS[p.month - 1]} {p.year}</option>
              ))}
            </select>
            {selected && (
              selected.is_approved
                ? <Btn onClick={() => printPayslipData(selected, origin)}>🖨 Download PDF</Btn>
                : selected.download_requested
                  ? <Btn variant="ghost" disabled style={{ opacity: 0.6, cursor: "not-allowed" }}>⏳ Awaiting Approval</Btn>
                  : <Btn variant="ghost" onClick={() => handleRequestDownload(selected)} disabled={requesting}>📩 Request for Download</Btn>
            )}
          </div>
        )}
      </div>

      {payslips.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48, color: C.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No payslips yet</div>
          <p style={{ fontSize: 13, marginTop: 8 }}>Your admin hasn't generated any payslips for you yet.</p>
        </Card>
      ) : selected ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 }}>
            {[["Monthly Gross", mask(selected.gross), C.green], ["Basic Salary", mask(selected.basic), C.accent],
            ["HRA", mask(selected.hra), C.purple], ["Conveyance", mask(selected.transport), C.amber],
            ["PF Deduction", mask(selected.pf_employee), C.red], ["Net Pay", mask(selected.net_pay), C.green]].map(([label, value, color]) => (
              <Card key={label} style={{ textAlign: "center", padding: "18px 12px" }}>
                <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
              </Card>
            ))}
          </div>
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>
              Earnings &amp; Deductions — {SLIP_MONTHS[selected.month - 1]} {selected.year}
            </div>
            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Earnings</div>
                {[
                  ["Basic Salary", selected.basic], ["HRA", selected.hra],
                  ["Leave Travel Allowance", selected.leave_travel_allowance],
                  ["Special Allowance", selected.special_allowance],
                  ["Conveyance Allowance", selected.transport],
                  ["Medical Allowance", selected.medical_allowance],
                  ["Internet & Broadband Allowance", selected.internet_allowance],
                  ["Professional Development Allowance", selected.professional_dev_allowance],
                  ["Insurance", selected.insurance_allowance],
                  ["Variable Pay", selected.variable_pay],
                  ["Bonus", selected.bonus]
                ].map(([k, v]) => Number(v) > 0 ? (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 13 }}>
                    <span style={{ color: C.textDim }}>{k}</span><span style={{ fontWeight: 600, color: C.text }}>{mask(v)}</span>
                  </div>
                ) : null)}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 14, fontWeight: 800, color: C.green, borderTop: `2px solid ${C.border}44`, marginTop: 4 }}>
                  <span>Gross Salary</span><span>{mask(selected.gross)}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Deductions</div>
                {[
                  ["Professional Tax", selected.professional_tax],
                  ["Income Tax (TDS)", selected.income_tax],
                  ["Provident Fund", selected.pf_employee],
                  ["Other Deductions", selected.extra_deductions]
                ].map(([k, v]) => Number(v) > 0 ? (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 13 }}>
                    <span style={{ color: C.textDim }}>{k}</span><span style={{ fontWeight: 600, color: C.red }}>{mask(v)}</span>
                  </div>
                ) : null)}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 14, fontWeight: 800, color: C.red, borderTop: `2px solid ${C.border}44`, marginTop: 4 }}>
                  <span>Total Deductions</span><span>{mask(Number(selected.pf_employee) + Number(selected.professional_tax) + Number(selected.income_tax) + Number(selected.extra_deductions))}</span>
                </div>
              </div>
            </div>
            <div style={{ background: `linear-gradient(135deg,#1a234044,#2d3d6e44)`, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: "16px 24px", marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: C.textMuted }}>Net Pay for {SLIP_MONTHS[selected.month - 1]} {selected.year}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.green }}>{mask(selected.net_pay)}</div>
            </div>
          </Card>
        </>
      ) : null}

      {/* All payslips list */}
      {payslips.length > 1 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text }}>All Payslips</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: C.surface }}>
              {["Period", "Gross", "Deductions", "Net Pay", ""].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: .5, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {payslips.map(p => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}22`, background: selected?.id === p.id ? C.accentGlow : "transparent", cursor: "pointer" }} onClick={() => setSelected(p)}>
                  <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600, color: C.text }}>{SLIP_MONTHS[p.month - 1]} {p.year}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: C.green }}>{mask(p.gross)}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: C.red }}>{mask(Number(p.pf_employee) + Number(p.professional_tax))}</td>
                  <td style={{ padding: "11px 16px", fontSize: 14, fontWeight: 800, color: C.green }}>{mask(p.net_pay)}</td>
                  <td style={{ padding: "11px 16px" }} onClick={e => e.stopPropagation()}>
                    {p.is_approved
                      ? <Btn small variant="ghost" onClick={() => printPayslipData(p, origin)}>🖨 Download PDF</Btn>
                      : p.download_requested
                        ? <span style={{ fontSize: 12, color: C.textMuted, padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 6 }}>⏳ Awaiting Approval</span>
                        : <Btn small variant="ghost" onClick={() => handleRequestDownload(p)} disabled={requesting}>📩 Request</Btn>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
const EXP_CATEGORIES = ["Travel", "Meals", "Software", "Hardware", "Training", "Other"];
const EXP_STATUS_COLOR = { pending: C.amber, approved: C.green, rejected: C.red, needs_correction: C.purple, paid: C.accent };


function Expenses({ currentUser, viewOnly }) {
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null); // null | "new" | row-object
  const [noteModal, setNoteModal] = useState(null); // {id, action}
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const [ex, pr, em] = await Promise.all([api.getExpenses(params), api.getProjects(), api.getEmployees()]);
      setRows(ex); setProjects(pr); setEmployees(em);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  });
  useEffect(() => { load(); }, [filterStatus]);

  async function handleSave(form) {
    setSaving(true);
    try {
      let receiptUrl = form.receiptUrl || "";
      if (form.receiptFile) {
        const res = await api.uploadExpenseReceipt(form.receiptFile);
        receiptUrl = res.filename;
      }
      const payload = { ...form, receiptUrl };
      delete payload.receiptFile;
      if (modal === "new") await api.createExpense({ ...payload, employeeId: currentUser.employee_id });
      else await api.updateExpense(modal.id, payload);
      setModal(null); await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
  }
  async function handleDelete(id) {
    if (!await dialog.confirm("Delete this expense?", { dtype: "warning" })) return;
    try { await api.deleteExpense(id); await load(); } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }
  async function handleAction() {
    setSaving(true);
    try {
      if (noteModal.action === "approve") await api.approveExpense(noteModal.id);
      else if (noteModal.action === "pay") await api.payExpense(noteModal.id);
      else if (noteModal.action === "reject") await api.rejectExpense(noteModal.id, note);
      else await api.sendbackExpense(noteModal.id, note);
      setNoteModal(null); setNote(""); await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
  }

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  const statusOpts = ["pending", "approved", "rejected", "needs_correction", "paid"].map(s => ({ value: s, label: s.replace("_", " ") }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>{viewOnly ? "My Expenses" : "Expense Reports"}</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>{viewOnly ? "Submit and track expense claims" : "Review and approve employee expenses"}</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Inp label="" value={filterStatus} onChange={setFilterStatus} options={statusOpts} placeholder="All statuses" />
          {viewOnly && <Btn onClick={() => setModal("new")}>+ Submit Expense</Btn>}
        </div>
      </div>

      {rows.length === 0 && (
        <Card style={{ textAlign: "center", padding: 40, color: C.textMuted }}>No expense records found.</Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map(ex => {
          const statusColor = EXP_STATUS_COLOR[ex.status] || C.textMuted;
          const canEdit = viewOnly && (ex.status === "pending" || ex.status === "needs_correction");
          return (
            <Card key={ex.id} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: statusColor + "22", border: `1px solid ${statusColor} 44`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0
              }}>
                {ex.category === "Travel" ? "✈️" : ex.category === "Meals" ? "🍽" : ex.category === "Software" ? "💻" : ex.category === "Hardware" ? "🖥" : ex.category === "Training" ? "📚" : "🧾"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{ex.title}</div>
                    {!viewOnly && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{ex.employee_name}</div>}
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                      <Badge color={C.accent}>{ex.category}</Badge>
                      {ex.project_code && <span style={{ marginLeft: 8 }}><Badge color={C.purple}>{ex.project_code}</Badge></span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>₹{(+ex.amount || 0).toFixed(2)}</div>
                    <div style={{ marginTop: 4 }}><Badge color={statusColor}>{ex.status.replace("_", " ")}</Badge></div>
                  </div>
                </div>
                {ex.description && <div style={{ fontSize: 12, color: C.textDim, marginTop: 8 }}>{ex.description}</div>}
                {ex.admin_note && (
                  <div style={{ marginTop: 8, background: C.purple + "18", border: `1px solid ${C.purple} 33`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.purple }}>
                    📝 Admin note: {ex.admin_note}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {canEdit && <Btn small variant="ghost" onClick={() => setModal(ex)}>✏ Edit</Btn>}
                  {canEdit && <Btn small variant="danger" onClick={() => handleDelete(ex.id)}>🗑 Delete</Btn>}
                  {ex.receipt_url && (
                    <a href={`${process.env.REACT_APP_API_URL || "http://localhost:5002/api"}/receipts/${ex.receipt_url}`}
                      target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: C.accent + "18", color: C.accent, textDecoration: "none", border: `1px solid ${C.accent}44`, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      📎 View Receipt
                    </a>
                  )}
                  {!viewOnly && ex.status === "pending" && (
                    <>
                      <Btn small variant="success" onClick={() => setNoteModal({ id: ex.id, action: "approve" })}>✓ Approve</Btn>
                      <Btn small variant="danger" onClick={() => setNoteModal({ id: ex.id, action: "reject" })}>✕ Reject</Btn>
                      <Btn small variant="ghost" onClick={() => setNoteModal({ id: ex.id, action: "sendback" })}>↩ Send Back</Btn>
                    </>
                  )}
                  {!viewOnly && ex.status === "approved" && (
                    <Btn small variant="success" onClick={() => setNoteModal({ id: ex.id, action: "pay" })}>💵 Mark Paid</Btn>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Submit / Edit modal */}
      {modal && (
        <Modal title={modal === "new" ? "Submit Expense" : "Edit Expense"} onClose={() => setModal(null)}>
          <ExpenseForm
            init={modal === "new" ? { title: "", amount: "", category: "Other", projectId: "", description: "", receiptUrl: "" } :
              { title: modal.title, amount: modal.amount, category: modal.category, projectId: modal.project_id || "", description: modal.description || "", receiptUrl: modal.receipt_url || "" }}
            projects={projects}
            saving={saving}
            onCancel={() => setModal(null)}
            onSave={handleSave}
            btnLabel={modal === "new" ? "Submit" : "Save & Resubmit"}
          />
        </Modal>
      )}

      {/* Admin action note modal */}
      {noteModal && (
        <Modal title={noteModal.action === "pay" ? "Mark Expense Paid" : noteModal.action === "approve" ? "Approve Expense" : noteModal.action === "reject" ? "Reject Expense" : "Send Back for Correction"} onClose={() => { setNoteModal(null); setNote(""); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {noteModal.action !== "approve" && noteModal.action !== "pay" && (
              <Inp label={noteModal.action === "reject" ? "Rejection reason" : "Correction notes"} value={note} onChange={setNote}
                placeholder={noteModal.action === "reject" ? "Please explain why…" : "What needs to be fixed…"} />
            )}
            {noteModal.action === "approve" && <p style={{ color: C.textDim, fontSize: 13, margin: 0 }}>Confirm approval of this expense?</p>}
            {noteModal.action === "pay" && <p style={{ color: C.textDim, fontSize: 13, margin: 0 }}>Confirm this approved expense has been paid out?</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => { setNoteModal(null); setNote(""); }}>Cancel</Btn>
              <Btn variant={noteModal.action === "approve" || noteModal.action === "pay" ? "success" : "danger"} onClick={handleAction} disabled={saving}>
                {saving ? "Saving…" : noteModal.action === "approve" ? "✓ Approve" : noteModal.action === "pay" ? "💵 Mark Paid" : noteModal.action === "reject" ? "✕ Reject" : "↩ Send Back"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ExpenseForm({ init, projects, employees, saving, onCancel, onSave, btnLabel }) {
  const [form, setForm] = useState(init);
  const [receiptFile, setReceiptFile] = useState(null);

  const empOptions = employees ? [
    ...employees.map(e => ({ value: e.id, label: e.name || e.username }))
  ] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {employees && (
        <SearchableSelect
          label="Paid By / Owner *"
          value={form.employeeId || ""}
          onChange={v => setForm(f => ({ ...f, employeeId: v }))}
          options={empOptions}
          placeholder="Search Employee..."
        />
      )}
      <Inp label="Title / Purpose *" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} required placeholder="e.g. Flight to NYC" />
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Amount (INR) *" type="number" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} required />
        <Inp label="Category" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))}
          options={EXP_CATEGORIES.map(c => ({ value: c, label: c }))} />
      </div>
      <Inp label="Project (optional)" value={form.projectId} onChange={v => setForm(f => ({ ...f, projectId: v }))}
        options={projects.filter(p => !["closed", "completed"].includes(p.status)).map(p => ({ value: p.id, label: `${p.code} — ${p.name} ` }))} />
      <Inp label="Description" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Details…" />
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 6 }}>Receipt / Bill (optional)</label>
        <input type="file" accept="image/*,.pdf"
          onChange={e => setReceiptFile(e.target.files[0] || null)}
          style={{ fontSize: 13, color: C.text, width: "100%" }} />
        {init.receiptUrl && !receiptFile && (
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Current: {init.receiptUrl} (upload new to replace)</div>
        )}
        {receiptFile && <div style={{ fontSize: 11, color: C.green, marginTop: 4 }}>Selected: {receiptFile.name}</div>}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={() => {
          if (!form.title || !form.amount) { dialog.alert("Title and Amount are required", { title: "Validation", dtype: "warning" }); return; };
          if (employees && form.employeeId === undefined) { dialog.alert("Please select an employee owning this expense.", { title: "Validation", dtype: "warning" }); return; };
          onSave({ ...form, receiptFile: receiptFile || null });
        }} disabled={saving}>{saving ? "Saving…" : btnLabel}</Btn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ADMIN EMPLOYEES TAB
// ════════════════════════════════════════════════════════
function AdminEmployees({ readOnly = false, currentUser }) {
  const isAdminOnly = currentUser?.role === "admin";
  const [employees, setEmployees] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null); // null | "new" | emp-object
  const [viewModal, setViewModal] = useState(null); // null | emp-object
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [e, g] = await Promise.all([api.getEmployees(), api.getGroups()]);
      setEmployees(e); setGroups(g);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  });
  useEffect(() => { load(); }, []);

  async function saveEmp(form) {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      if (modal === "new") await api.createEmployee({ ...form, groupId: form.groupId ? +form.groupId : null });
      else await api.updateEmployee(modal.id, { ...form, groupId: form.groupId ? +form.groupId : null });
      setModal(null); await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
  }

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Employees</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Manage employees, groups & project assignments</p>
        </div>
        {!readOnly && <Btn onClick={() => setModal("new")}>+ New Employee</Btn>}
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: C.surface }}><tr>
              {["Emp ID", "Employee", "Email", "Group", "Manager", "Joining Date", "CTC", ...(isAdminOnly ? ["Gratuity"] : []), "Actions"].map(h => <Th key={h}>{h}</Th>)}
            </tr></thead>
            <tbody>
              {employees.map((emp, idx) => {
                const grp = groups.find(g => g.id === emp.group_id);
                return (
                  <tr key={emp.id} style={{ borderBottom: `1px solid ${C.border} 22`, background: idx % 2 === 0 ? "transparent" : C.bg + "44" }}>
                    <Td style={{ fontSize: 13, fontWeight: 700, color: C.textDim }}>{emp.custom_employee_id || "—"}</Td>
                    <Td><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar initials={emp.avatar} color={emp.group_color || C.accent} size={32} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{emp.name}</span>
                    </div></Td>
                    <Td style={{ fontSize: 12, color: C.textDim }}>{emp.email}</Td>
                    <Td>{grp ? <Badge color={grp.color}>{grp.name}</Badge> : <span style={{ color: C.textMuted, fontSize: 12 }}>—</span>}</Td>
                    <Td style={{ fontSize: 12, color: C.textDim }}>{emp.manager_name || "—"}</Td>
                    <Td style={{ fontSize: 12, color: C.textDim }}>{emp.joining_date ? fmtD(emp.joining_date) : <span style={{ color: C.textMuted }}>—</span>}</Td>
                    <Td style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{emp.ctc_annual ? `₹${Number(emp.ctc_annual).toLocaleString("en-IN")}` : <span style={{ color: C.textMuted, fontWeight: 400 }}>—</span>}</Td>
                    {isAdminOnly && <Td style={{ fontSize: 12, fontWeight: 700, color: C.purple }}>{emp.gratuity ? `₹${Number(emp.gratuity).toLocaleString("en-IN")}` : <span style={{ color: C.textMuted, fontWeight: 400 }}>₹0</span>}</Td>}
                    <Td><div style={{ display: "flex", gap: 6 }}>
                      <Btn small variant="secondary" onClick={() => setViewModal(emp)}>👁 View</Btn>
                      {!readOnly && <Btn small variant="ghost" onClick={() => setModal(emp)}>✏ Edit</Btn>}
                    </div></Td>
                  </tr>
                );
              })}
              {employees.length === 0 && <tr><td colSpan={(readOnly ? 7 : 8) + (isAdminOnly ? 1 : 0)} style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No employees found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create / Edit employee modal */}
      {!readOnly && modal && (
        <Modal title={modal === "new" ? "New Employee" : "Edit Employee"} onClose={() => setModal(null)}>
          <EmpForm
            init={modal === "new" ? { name: "", email: "", customEmployeeId: "", groupId: "", managerId: "", joiningDate: "", ctcAnnual: "", variablePay: "", designation: "", location: "", panNumber: "", dob: "", address: "", mobile: "", bankAccountNo: "", bankIfsc: "", bankName: "", skillset: "" } : { name: modal.name, email: modal.email, customEmployeeId: modal.custom_employee_id || "", groupId: modal.group_id || "", managerId: modal.manager_id || "", joiningDate: modal.joining_date || "", ctcAnnual: modal.ctc_annual || "", variablePay: modal.variable_pay_amount || "", designation: modal.designation || "", location: modal.location || "", panNumber: modal.pan_number || "", dob: modal.dob || "", address: modal.address || "", mobile: modal.mobile || "", bankAccountNo: modal.bank_account_no || "", bankIfsc: modal.bank_ifsc || "", bankName: modal.bank_name || "", skillset: modal.skillset || "" }}
            groups={groups} employees={employees} saving={saving} onCancel={() => setModal(null)} onSave={saveEmp}
            btnLabel={modal === "new" ? "Create Employee" : "Save Changes"}
          />
        </Modal>
      )}

      {/* View employee profile modal */}
      {viewModal && (
        <Modal title="Employee Profile" onClose={() => setViewModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar initials={viewModal.avatar} color={viewModal.group_color || C.accent} size={64} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{viewModal.name}</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>{viewModal.email} {viewModal.custom_employee_id ? `| ${viewModal.custom_employee_id}` : ""}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                  {viewModal.group_name ? <Badge color={viewModal.group_color}>{viewModal.group_name}</Badge> : null}
                  {viewModal.designation && <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>• {viewModal.designation}</span>}
                  {viewModal.location && <span style={{ fontSize: 12, color: C.textDim }}>({viewModal.location})</span>}
                </div>
              </div>
            </div>

            <div className="grid-2" style={{ background: C.surface, padding: 16, borderRadius: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Mobile</div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{viewModal.mobile || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>DOB</div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{viewModal.dob ? fmtD(viewModal.dob) : "—"}</div>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Address</div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{viewModal.address || "—"}</div>
              </div>
            </div>

            <div style={{ background: C.surface, padding: 16, borderRadius: 10 }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 13, color: C.text, fontWeight: 700 }}>Banking, Tax & Compensation</h4>
              <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Bank Name</div>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{viewModal.bank_name || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>IFSC Code</div>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600, fontFamily: "monospace" }}>{viewModal.bank_ifsc || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Account No</div>
                  <SensitiveDisplay value={viewModal.bank_account_no} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>PAN Number</div>
                  <SensitiveDisplay value={viewModal.pan_number} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Annual CTC</div>
                  <div style={{ fontSize: 14, color: C.green, fontWeight: 700 }}>{viewModal.ctc_annual ? `₹${Number(viewModal.ctc_annual).toLocaleString("en-IN")}` : "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Variable Pay</div>
                  <div style={{ fontSize: 14, color: C.amber, fontWeight: 700 }}>{viewModal.variable_pay_amount ? `₹${Number(viewModal.variable_pay_amount).toLocaleString("en-IN")}` : "—"}</div>
                </div>
                {isAdminOnly && (
                  <div style={{ gridColumn: "span 2", background: C.purple + "11", border: `1px solid ${C.purple}33`, borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: C.purple, textTransform: "uppercase", fontWeight: 700, letterSpacing: .5 }}>Accumulated Gratuity (4.81% of Basic / month)</div>
                    <div style={{ fontSize: 18, color: C.purple, fontWeight: 800, marginTop: 4 }}>
                      {viewModal.gratuity ? `₹${Number(viewModal.gratuity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹0.00"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: C.surface, padding: 16, borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Skillset</div>
              <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{viewModal.skillset || "—"}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <Btn variant="ghost" onClick={() => setViewModal(null)}>Close</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ADMIN NAV
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// COMPENSATION DETAILS – CTC breakdown calculator (admin only)
// ════════════════════════════════════════════════════════
function CompensationDetails() {
  const [ctc, setCtc] = useState("");
  const [useVp, setUseVp] = useState(true);
  const [vpAmount, setVpAmount] = useState("");
  const [usePda, setUsePda] = useState(false);
  const [pdaAmount, setPdaAmount] = useState("");
  const [useIns, setUseIns] = useState(false);
  const [insAmount, setInsAmount] = useState("");
  const [useEmployerPf, setUseEmployerPf] = useState(false);
  const [conveyanceAmount, setConveyanceAmount] = useState("");
  const [medicalAmount, setMedicalAmount] = useState("");
  const [internetAmount, setInternetAmount] = useState("");

  function round2(n) { return Math.round(n * 100) / 100; }
  const fmt = n => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtR = n => `₹ ${fmt(n)}`;

  const ctcVal = parseFloat(ctc) || 0;
  const computed = ctcVal > 0 ? (() => {
    const basic_m = round2(ctcVal * 0.50 / 12);
    const hra_m = round2(basic_m * 0.50);
    const lta_m = round2(basic_m * 0.10);
    const transport = conveyanceAmount !== "" ? (parseFloat(conveyanceAmount) || 0) : 1600;
    const medical = medicalAmount !== "" ? (parseFloat(medicalAmount) || 0) : 1250;
    const internet = internetAmount !== "" ? (parseFloat(internetAmount) || 0) : 1200;

    const pda_m = usePda ? (parseFloat(pdaAmount) || 0) : 0;
    const ins_m = useIns ? (parseFloat(insAmount) || 0) : 0;

    const gratuity_a = round2(basic_m * 12 * 0.0481);
    const employer_pf_a = useEmployerPf ? round2(basic_m * 12 * 0.12) : 0;
    const employer_pf_m = round2(employer_pf_a / 12);

    const defaultVp_a = round2(ctcVal * 0.05);
    const vp_a_input = useVp ? (vpAmount !== "" ? (parseFloat(vpAmount) || 0) : defaultVp_a) : 0;

    // gross_a = CTC minus retirement and VP — special absorbs the remainder
    const gross_a = round2(ctcVal - gratuity_a - employer_pf_a - vp_a_input);
    const gross_m = round2(gross_a / 12);

    // Special Allowance = remaining balance (no floor/cap)
    const remaining = round2(gross_m - basic_m - hra_m - lta_m - transport - medical - internet - pda_m - ins_m);
    const special_m = remaining;

    const gross_total_m = round2(basic_m + hra_m + lta_m + transport + medical + internet + special_m + pda_m + ins_m);
    const gross_total_a = round2(gross_total_m * 12);

    const vp_a = useVp ? vp_a_input : 0;
    const vp_m = round2(vp_a / 12);

    const total_ctc = round2(gross_total_a + employer_pf_a + gratuity_a + vp_a);

    return {
      basic_m, hra_m, lta_m, transport, medical, internet, special_m, pda_m, ins_m,
      gross_total_m, gross_total_a, employer_pf_m, employer_pf_a, gratuity_a, vp_a, vp_m, defaultVp_a, total_ctc
    };
  })() : null;

  function downloadCompensation() {
    if (!computed) return;
    const c = computed;
    const n = v => Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dash = '<span style="letter-spacing:2px">-</span>';
    const bouquetRows = [
      [1, "House Rent Allowance (HRA)", n(c.hra_m), n(round2(c.hra_m * 12))],
      [2, "Special Allowance", n(c.special_m), n(round2(c.special_m * 12))],
      [3, "Conveyance", n(c.transport), n(round2(c.transport * 12))],
      [4, "Medical Allowance", n(c.medical), n(round2(c.medical * 12))],
      [5, "Internet &amp; Broadband Allowance", n(c.internet), n(round2(c.internet * 12))],
      [6, "Leave Travel Allowance (LTA)", n(c.lta_m), n(round2(c.lta_m * 12))],
      [7, "Professional Development Allowance", c.pda_m > 0 ? n(c.pda_m) : dash, c.pda_m > 0 ? n(round2(c.pda_m * 12)) : dash],
      [8, "Insurance", c.ins_m > 0 ? n(c.ins_m) : dash, c.ins_m > 0 ? n(round2(c.ins_m * 12)) : dash],
    ].map(([sl, label, mo, yr]) => `<tr><td class="sl">${sl}</td><td class="label">${label}</td><td class="num">${mo}</td><td class="num">${yr}</td></tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Compensation Details</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;font-size:13px;background:#fff;color:#000;}
  .wrapper{max-width:860px;margin:24px auto;padding:16px;}
  table{width:100%;border-collapse:collapse;border:1px solid #999;}
  td,th{border:1px solid #999;padding:6px 10px;font-size:13px;}
  .sl{width:52px;text-align:center;}
  .label{text-align:left;}
  .num{text-align:right;width:160px;}
  .title-row td{background:#4a4a6a;color:#fff;font-weight:bold;font-size:14px;text-align:center;padding:10px;}
  .col-header td{background:#e8e8e8;font-weight:bold;text-align:center;font-size:12px;}
  .section-row td{background:#c8c8d8;font-weight:bold;text-align:center;font-size:13px;padding:7px 10px;}
  .total-row td{background:#8888aa;color:#fff;font-weight:bold;}
  .ctc-row td{background:#4a4a6a;color:#fff;font-weight:bold;font-size:14px;}
  .empty-sl{width:52px;}
  @media print{body{margin:0;} .wrapper{margin:0;padding:8px;}}
</style></head><body><div class="wrapper">
<table>
  <tr class="title-row"><td colspan="4">COMPENSATION DETAILS* (All Amount in INR)</td></tr>

  <!-- Section A: Basic Salary -->
  <tr class="section-row"><td colspan="4">Basic Salary - A</td></tr>
  <tr class="col-header"><td class="sl">Sl.No.</td><td class="label"></td><td class="num">INR Monthly</td><td class="num">INR Annualized</td></tr>
  <tr><td class="sl">1</td><td class="label">Basic Salary</td><td class="num">${n(c.basic_m)}</td><td class="num">${n(round2(c.basic_m * 12))}</td></tr>

  <!-- Section B: Bouquet of Allowances -->
  <tr class="section-row"><td colspan="4">Bouquet of Allowances - B</td></tr>
  ${bouquetRows}
  <tr class="total-row"><td class="sl"></td><td class="label">Monthly Gross Salary</td><td class="num">${n(c.gross_total_m)}</td><td class="num">${n(c.gross_total_a)}</td></tr>

  <!-- Section C: Retirement & Corporate Benefits -->
  <tr class="section-row"><td colspan="4">Retirement &amp; Corporate Benefits - C</td></tr>
  <tr><td class="sl">1</td><td class="label">Provident Fund Employer Contribution</td><td class="num">${c.employer_pf_m > 0 ? n(c.employer_pf_m) : dash}</td><td class="num">${c.employer_pf_a > 0 ? n(c.employer_pf_a) : dash}</td></tr>
  <tr><td class="sl">2</td><td class="label">Gratuity</td><td class="num">${dash}</td><td class="num">${n(c.gratuity_a)}</td></tr>

  <!-- Section D: Variable Pay -->
  <tr class="section-row"><td colspan="4">Variable Pay/Bonus &#8211; D</td></tr>
  <tr><td class="sl">1</td><td class="label">Variable Performance Pay</td><td class="num">${c.vp_m > 0 ? n(c.vp_m) : dash}</td><td class="num">${c.vp_a > 0 ? n(c.vp_a) : dash}</td></tr>

  <!-- Total CTC -->
  <tr class="ctc-row"><td class="sl"></td><td class="label">Yearly CTC (A + B + C + D)</td><td class="num"></td><td class="num">${n(c.total_ctc)}</td></tr>
</table>
<p style="margin-top:10px;font-size:11px;color:#555;">* Variable Pay is performance-based and paid at management discretion.</p>
</div><script>window.onload=function(){window.print();}</script></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  const inpStyle = { background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%" };
  const rows = computed ? [
    ["Basic Salary", computed.basic_m, computed.basic_m * 12, "50% of CTC"],
    ["House Rent Allowance (HRA)", computed.hra_m, computed.hra_m * 12, "50% of Basic"],
    ["Leave Travel Allowance (LTA)", computed.lta_m, computed.lta_m * 12, "10% of Basic"],
    ["Conveyance", computed.transport, computed.transport * 12, "Fixed (default ₹1,600)"],
    ["Medical Allowance", computed.medical, computed.medical * 12, "Fixed (default ₹1,250)"],
    ["Internet & Broadband Allowance", computed.internet, computed.internet * 12, "Fixed (default ₹1,200)"],
    ["Professional Dev. Allowance", computed.pda_m, computed.pda_m * 12, computed.pda_m > 0 ? "Fixed monthly" : "NA"],
    ["Insurance (Group Medical/Life)", computed.ins_m, computed.ins_m * 12, computed.ins_m > 0 ? "Fixed monthly" : "NA"],
    ["Special Allowance", computed.special_m, computed.special_m * 12, "Remaining balance"],
  ] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Compensation Details</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Calculate CTC breakdown — monthly & yearly</p>
        </div>
        {computed && <Btn onClick={downloadCompensation}>⬇ Download PDF</Btn>}
      </div>

      {/* Inputs */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Enter CTC Details</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Annual CTC (₹) *</div>
            <input type="number" min="0" placeholder="e.g. 600000" value={ctc}
              onChange={e => setCtc(e.target.value)} style={inpStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              <input type="checkbox" checked={useVp} onChange={e => { setUseVp(e.target.checked); if (!e.target.checked) setVpAmount(""); }} style={{ cursor: "pointer", width: 16, height: 16 }} />
              Include Variable Pay (Bonus)
            </label>
            {useVp ? (
              <>
                <div style={{ fontSize: 11, color: C.textMuted }}>
                  Default: ₹ {computed ? Math.round(computed.defaultVp_a).toLocaleString("en-IN") : "0"}/yr (5% of CTC) — enter annual amount below to override
                </div>
                <input type="number" min="0" placeholder="Override annual amount (₹)" value={vpAmount}
                  onChange={e => setVpAmount(e.target.value)} style={inpStyle} />
              </>
            ) : (
              <div style={{ fontSize: 11, color: C.textMuted, padding: "4px 0" }}>Not included — check to add Variable Pay to CTC</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              <input type="checkbox" checked={useEmployerPf} onChange={e => setUseEmployerPf(e.target.checked)} style={{ cursor: "pointer", width: 16, height: 16 }} />
              Employer PF (12% of Basic)
            </label>
            <div style={{ fontSize: 11, color: C.textMuted, padding: "8px 0" }}>{computed && useEmployerPf ? `₹ ${fmt(computed.employer_pf_m)}/month` : "Not included in CTC by default"}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginTop: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              <input type="checkbox" checked={usePda} onChange={e => setUsePda(e.target.checked)} style={{ cursor: "pointer", width: 16, height: 16 }} />
              Professional Development Allowance
            </label>
            <input type="number" min="0" placeholder="Monthly amount (₹)" value={pdaAmount} disabled={!usePda}
              onChange={e => setPdaAmount(e.target.value)} style={{ ...inpStyle, opacity: usePda ? 1 : 0.5 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              <input type="checkbox" checked={useIns} onChange={e => setUseIns(e.target.checked)} style={{ cursor: "pointer", width: 16, height: 16 }} />
              Insurance
            </label>
            <input type="number" min="0" placeholder="Monthly amount (₹)" value={insAmount} disabled={!useIns}
              onChange={e => setInsAmount(e.target.value)} style={{ ...inpStyle, opacity: useIns ? 1 : 0.5 }} />
          </div>
        </div>
        {/* Fixed component overrides */}
        <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Override Fixed Components</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Conveyance (default ₹1,600)</div>
            <input type="number" min="0" placeholder="1600" value={conveyanceAmount}
              onChange={e => setConveyanceAmount(e.target.value)} style={inpStyle} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Medical Allowance (default ₹1,250)</div>
            <input type="number" min="0" placeholder="1250" value={medicalAmount}
              onChange={e => setMedicalAmount(e.target.value)} style={inpStyle} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Internet Allowance (default ₹1,200)</div>
            <input type="number" min="0" placeholder="1200" value={internetAmount}
              onChange={e => setInternetAmount(e.target.value)} style={inpStyle} />
          </div>
        </div>
      </Card>

      {/* Breakdown Table */}
      {computed ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.surface }}>
                {["Component", "Amount / Month", "Amount / Year", "Remarks"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: h === "Component" || h === "Remarks" ? "left" : "right", fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: .5, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, monthly, yearly, note]) => (
                <tr key={label} style={{ borderBottom: `1px solid ${C.border}22` }}>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: C.text }}>{label}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: C.text, textAlign: "right" }}>{fmtR(round2(monthly))}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: C.textMuted, textAlign: "right" }}>{fmtR(round2(yearly))}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: C.textDim, fontStyle: "italic" }}>{note}</td>
                </tr>
              ))}
              {/* Gross total row */}
              <tr style={{ background: C.surface, borderTop: `2px solid ${C.border}` }}>
                <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 800, color: C.text }}>Total Gross / Base Salary</td>
                <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 800, color: C.green, textAlign: "right" }}>{fmtR(computed.gross_total_m)}</td>
                <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 800, color: C.green, textAlign: "right" }}>{fmtR(computed.gross_total_a)}</td>
                <td style={{ padding: "10px 16px", fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>
                  {computed.gross_total_m >= 25000 ? "₹200/month professional tax applicable" : "Below ₹25,000 — no professional tax"}
                </td>
              </tr>
              {/* Separator */}
              <tr><td colSpan={4} style={{ padding: 0, height: 8, background: C.bg }} /></tr>
              {/* CTC components below gross */}
              {[
                ["Provident Fund (Employer)", computed.employer_pf_m > 0 ? fmtR(computed.employer_pf_m) : "—", computed.employer_pf_a > 0 ? fmtR(computed.employer_pf_a) : "NA", "12% of Basic"],
                ["Gratuity", "—", fmtR(computed.gratuity_a), "4.81% of Basic"],
                ["Variable Pay / Bonus*", "—", computed.vp_a > 0 ? fmtR(computed.vp_a) : "—", "5% of CTC (default)"],
              ].map(([label, monthly, yearly, note]) => (
                <tr key={label} style={{ borderBottom: `1px solid ${C.border}22` }}>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: C.text }}>{label}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: C.textMuted, textAlign: "right" }}>{monthly}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: C.textMuted, textAlign: "right" }}>{yearly}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: C.textDim, fontStyle: "italic" }}>{note}</td>
                </tr>
              ))}
              {/* Total CTC */}
              <tr style={{ background: `${C.green}18`, borderTop: `2px solid ${C.green}44` }}>
                <td style={{ padding: "14px 16px", fontSize: 15, fontWeight: 800, color: C.text }}>Total CTC</td>
                <td style={{ padding: "14px 16px", textAlign: "right" }} />
                <td style={{ padding: "14px 16px", fontSize: 16, fontWeight: 800, color: C.green, textAlign: "right" }}>{fmtR(computed.total_ctc)}</td>
                <td style={{ padding: "14px 16px", fontSize: 12, color: C.textDim, fontStyle: "italic" }}>Gross + Gratuity + PF (Employer) + VP</td>
              </tr>
            </tbody>
          </table>
        </Card>
      ) : (
        <Card style={{ textAlign: "center", padding: 48, color: C.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧮</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Enter Annual CTC to see the breakdown</div>
        </Card>
      )}
    </div>
  );
}

// ADMIN PAYSLIPS – Generate & manage payslips for all employees
// ════════════════════════════════════════════════════════
const SLIP_MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function inWords(num) {
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  if ((num = num.toString()).length > 9) return 'overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return; let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim();
}

function printPayslipData(ps) {
  const origin = window.location.origin;
  const fmt = n => Number(n).toLocaleString("en-IN");
  const monthLabel = `${SLIP_MONTHS[ps.month - 1]} ${ps.year}`;
  const totalDed = Number(ps.pf_employee) + Number(ps.professional_tax) + Number(ps.income_tax) + Number(ps.extra_deductions);
  const words = inWords(Math.round(ps.net_pay));

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Payslip - ${monthLabel} - ${ps.employee_name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #fff; color: #000; font-size: 13px; }
    .wrapper { max-width: 900px; margin: 20px auto; padding: 10px; }
    table { width: 100%; border-collapse: collapse; border: 3px solid #000; }
    table, th, td { border: 1px solid #000; text-align: left; }
    th { padding: 6px 10px; font-size: 14px; font-weight: bold; }
    td { padding: 4px 10px; height: 26px; font-size: 13px; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .header-box { text-align: center; border-bottom: 2px solid #000; position: relative; }
    .header-box h2 { font-size: 18px; margin: 8px 0 4px; }
    .header-box h3 { font-size: 15px; margin-bottom: 8px; font-weight: normal; }
    .divider { border-bottom: 2px solid #000; }
    .cols-2 td { width: 50%; vertical-align: top; padding: 0; border: none; }
    .inner-t { width: 100%; border-collapse: collapse; border: none; }
    .inner-t td { border-top: none; border-bottom: none; border-left: none; }
    .inner-t td:last-child { border-right: none; }
    .sub-h { font-weight: bold; text-align: center; border-bottom: 1px solid #000; padding: 6px; }
    .footer-msg { margin-top: 8px; font-size: 13px; text-align: left; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table>
      <tr>
        <td colspan="4" class="header-box" style="border-bottom: 1px solid #000; padding: 12px 0 8px;">
          <img src="${origin}/paysliplogo.png" alt="Logo" style="position: absolute; left: 16px; top: 12px; height: 44px; object-fit: contain;" />
          <h2>FASCINATE IT INDIA PRIVATE LIMITED</h2>
          <h3>Payslip for the Month of ${monthLabel}</h3>
        </td>
      </tr>
      <tr>
        <td style="width: 25%;">Employee Id</td>
        <td style="width: 25%;" class="center">FASIT/${String(ps.employee_id).padStart(3, '0')}</td>
        <td style="width: 25%;">Employee Name</td>
        <td style="width: 25%;" class="center">${ps.employee_name || ''}</td>
      </tr>
      <tr>
        <td>Designation</td>
        <td class="center">${ps.designation || 'Associate'}</td>
        <td>Location</td>
        <td class="center">${ps.location || 'Bangalore'}</td>
      </tr>
      <tr>
        <td>Date of Joining</td>
        <td class="center">${ps.joining_date ? new Date(ps.joining_date).toLocaleDateString('en-GB') : '-'}</td>
        <td>PAN</td>
        <td class="center">${ps.pan_number || '-'}</td>
      </tr>
      <tr>
        <td>Bank Name</td>
        <td class="center">${ps.bank_name || '-'}</td>
        <td>Bank Account No</td>
        <td class="center">${ps.bank_account_no || '-'}</td>
      </tr>
      <tr>
        <td>Fixed Days</td>
        <td class="center">31</td>
        <td>Present Days</td>
        <td class="center">31</td>
      </tr>
      <tr>
        <td>LOP</td>
        <td class="center">0</td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td colspan="4" style="padding: 0; border: none;">
          <table class="inner-t" style="border: none;">
            <tr>
              <td style="width: 50%; padding: 0; border-right: 1px solid #000;" valign="top">
                <table style="width: 100%; border: none;">
                  <tr><td colspan="2" class="sub-h" style="border-right: none; border-left: none;">Earnings</td></tr>
                  <tr><td style="width: 60%; border: none;">Basic</td><td style="width: 40%; border: none;" class="right">${fmt(ps.basic)}</td></tr>
                  <tr><td style="border: none;">HRA</td><td style="border: none;" class="right">${fmt(ps.hra)}</td></tr>
                  <tr><td style="border: none;">Leave Travel Allowance</td><td style="border: none;" class="right">${fmt(ps.leave_travel_allowance)}</td></tr>
                  <tr><td style="border: none;">Special Allowance</td><td style="border: none;" class="right">${fmt(ps.special_allowance)}</td></tr>
                  <tr><td style="border: none;">Conveyance Allowance</td><td style="border: none;" class="right">${fmt(ps.transport)}</td></tr>
                  <tr><td style="border: none;">Medical Allowance</td><td style="border: none;" class="right">${fmt(ps.medical_allowance)}</td></tr>
                  <tr><td style="border: none;">Internet & Broadband<br>Allowance</td><td style="border: none;" class="right">${fmt(ps.internet_allowance)}</td></tr>
                  <tr><td style="border: none;">Professional Development<br>Allowance</td><td style="border: none;" class="right">${Number(ps.professional_dev_allowance) ? fmt(ps.professional_dev_allowance) : '-'}</td></tr>
                  <tr><td style="border: none;">Insurance</td><td style="border: none;" class="right">${Number(ps.insurance_allowance) ? fmt(ps.insurance_allowance) : '-'}</td></tr>
                  <tr><td style="border: none;">Variable Pay</td><td style="border: none;" class="right">${Number(ps.variable_pay) ? fmt(ps.variable_pay) : '-'}</td></tr>
                  <tr><td style="border: none;">Bonus</td><td style="border: none;" class="right">${Number(ps.bonus) ? fmt(ps.bonus) : '-'}</td></tr>
                  <tr><td style="border: none; padding-bottom: 20px;"></td><td style="border: none;"></td></tr>
                </table>
              </td>
              <td style="width: 50%; padding: 0;" valign="top">
                <table style="width: 100%; border: none;">
                  <tr><td colspan="2" class="sub-h" style="border-right: none; border-left: none;">Deductions</td></tr>
                  <tr><td style="width: 60%; border: none;">Professional Tax</td><td style="width: 40%; border: none;" class="right">${fmt(ps.professional_tax)}</td></tr>
                  <tr><td style="border: none;">Income Tax</td><td style="border: none;" class="right">${Number(ps.income_tax) ? fmt(ps.income_tax) : '-'}</td></tr>
                  <tr><td style="border: none;">Provident Fund</td><td style="border: none;" class="right">${Number(ps.pf_employee) ? fmt(ps.pf_employee) : '-'}</td></tr>
                  <tr><td style="border: none;">Other Deductions</td><td style="border: none;" class="right">${Number(ps.extra_deductions) ? fmt(ps.extra_deductions) : '-'}</td></tr>
                  <tr><td style="border: none; padding-bottom: 20px;"></td><td style="border: none;"></td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="border-top: 1px solid #000; padding: 0;">
          <table style="width: 100%; border: none;">
            <tr>
              <td class="bold" style="width: 60%; border: none; font-size: 14px;">Gross Salary</td>
              <td class="bold right" style="width: 40%; border: none; font-size: 14px;">${fmt(ps.gross)}</td>
            </tr>
          </table>
        </td>
        <td colspan="2" style="border-top: 1px solid #000; padding: 0;">
          <table style="width: 100%; border: none;">
            <tr>
              <td class="bold" style="width: 60%; border: none; font-size: 14px;">Total Deductions</td>
              <td class="bold right" style="width: 40%; border: none; font-size: 14px;">${fmt(totalDed)}</td>
            </tr>
            <tr>
              <td class="bold" style="border: none; font-size: 14px; border-top: 1px solid #000;">Net</td>
              <td class="bold right" style="border: none; font-size: 14px; border-top: 1px solid #000;">${fmt(ps.net_pay)}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td colspan="4" class="bold" style="border-top: 2px solid #000;">Rupees ${words} only</td>
      </tr>
    </table>
    <div class="footer-msg">Private and confidential :This is a system generated document and signature is not required</div>
  </div>
  <script>window.onload=function(){window.print();}</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function AdminPayslips() {
  const [employees, setEmployees] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterEmp, setFilterEmp] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [form, setForm] = useState({
    employeeId: "", month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    usePf: false, pfAmount: "", useTds: false, tdsAmount: "", useVp: true, vpAmount: "",
    usePda: false, pdaAmount: "", useIns: false, insAmount: "",
    conveyanceAmount: "", medicalAmount: "", internetAmount: ""
  });
  const [msg, setMsg] = useState("");
  const origin = window.location.origin;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, ps] = await Promise.all([api.getEmployees(), api.getPayslips()]);
      setEmployees(e); setPayslips(ps);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, []);

  async function generate() {
    if (!form.employeeId) return;
    setGenerating(true); setMsg("");
    try {
      await api.generatePayslip({
        employeeId: +form.employeeId,
        month: +form.month,
        year: +form.year,
        usePf: form.usePf, pfAmount: form.pfAmount,
        useTds: form.useTds, tdsAmount: form.tdsAmount,
        useVp: form.useVp, vpAmount: form.vpAmount,
        usePda: form.usePda, pdaAmount: form.pdaAmount,
        useIns: form.useIns, insAmount: form.insAmount,
        conveyanceAmount: form.conveyanceAmount || null,
        medicalAmount: form.medicalAmount || null,
        internetAmount: form.internetAmount || null,
      });
      setMsg("✅ Payslip generated successfully!");
      await load();
    } catch (e) { setMsg(`❌ ${e.message}`); } finally { setGenerating(false); }
  }

  async function del(id) {
    if (!await dialog.confirm("Delete this payslip?", { dtype: "warning" })) return;
    try { await api.deletePayslip(id); setPayslips(ps => ps.filter(p => p.id !== id)); } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  async function approve(id) {
    try {
      const updated = await api.approvePayslip(id);
      setPayslips(ps => ps.map(p => p.id === id ? { ...p, ...updated } : p));
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  const shown = payslips.filter(p => {
    if (filterEmp && p.employee_id !== +filterEmp) return false;
    if (filterYear && p.year !== +filterYear) return false;
    return true;
  });

  const fmt = n => `₹${Number(n).toLocaleString("en-IN")}`;
  const years = [2023, 2024, 2025, 2026];
  const inpStyle = { width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Payslips</h2>
        <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Generate and manage employee salary slips</p>
      </div>

      {/* Generate Panel */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>🖨 Generate Payslip</div>
        {/* Row 1: employee / month / year */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Employee</div>
            <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} style={inpStyle}>
              <option value="">— Select Employee —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} {e.ctc_annual > 0 ? `(₹${(e.ctc_annual / 100000).toFixed(1)}L CTC)` : "(No CTC)"}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Month</div>
            <select value={form.month} onChange={e => setForm(f => ({ ...f, month: +e.target.value }))} style={inpStyle}>
              {SLIP_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Year</div>
            <select value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} style={inpStyle}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        {/* Row 2: PF / TDS / Variable Pay Toggles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              <input type="checkbox" checked={form.usePf} onChange={e => setForm(f => ({ ...f, usePf: e.target.checked }))} style={{ cursor: "pointer", width: 16, height: 16 }} />
              Provident Fund (PF)
            </label>
            <input type="number" min="0" placeholder="Auto calculate 12% Basic" value={form.pfAmount} disabled={!form.usePf}
              onChange={e => setForm(f => ({ ...f, pfAmount: e.target.value }))}
              style={{ ...inpStyle, opacity: form.usePf ? 1 : 0.5 }} />
          </div>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              <input type="checkbox" checked={form.useTds} onChange={e => setForm(f => ({ ...f, useTds: e.target.checked }))} style={{ cursor: "pointer", width: 16, height: 16 }} />
              Income Tax (TDS)
            </label>
            <input type="number" min="0" placeholder="Override default ₹ 0" value={form.tdsAmount} disabled={!form.useTds}
              onChange={e => setForm(f => ({ ...f, tdsAmount: e.target.value }))}
              style={{ ...inpStyle, opacity: form.useTds ? 1 : 0.5 }} />
          </div>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              <input type="checkbox" checked={form.useVp} onChange={e => setForm(f => ({ ...f, useVp: e.target.checked }))} style={{ cursor: "pointer", width: 16, height: 16 }} />
              Variable Pay
            </label>
            <input type="number" min="0" placeholder="Monthly amount (auto: 5% of CTC ÷ 12)" value={form.vpAmount} disabled={!form.useVp}
              onChange={e => setForm(f => ({ ...f, vpAmount: e.target.value }))}
              style={{ ...inpStyle, opacity: form.useVp ? 1 : 0.5 }} />
            {form.useVp && !form.vpAmount && <div style={{ fontSize: 11, color: C.textMuted }}>Default: 5% of annual CTC ÷ 12 — enter monthly amount to override</div>}
          </div>
        </div>
        {/* Row 3: Professional Dev & Insurance */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              <input type="checkbox" checked={form.usePda} onChange={e => setForm(f => ({ ...f, usePda: e.target.checked }))} style={{ cursor: "pointer", width: 16, height: 16 }} />
              Professional Development Allowance
            </label>
            <input type="number" min="0" placeholder="Enter amount (₹)" value={form.pdaAmount} disabled={!form.usePda}
              onChange={e => setForm(f => ({ ...f, pdaAmount: e.target.value }))}
              style={{ ...inpStyle, opacity: form.usePda ? 1 : 0.5 }} />
            {form.usePda && <div style={{ fontSize: 11, color: C.textMuted }}>Deducted from Special Allowance pool</div>}
          </div>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              <input type="checkbox" checked={form.useIns} onChange={e => setForm(f => ({ ...f, useIns: e.target.checked }))} style={{ cursor: "pointer", width: 16, height: 16 }} />
              Insurance
            </label>
            <input type="number" min="0" placeholder="Enter amount (₹)" value={form.insAmount} disabled={!form.useIns}
              onChange={e => setForm(f => ({ ...f, insAmount: e.target.value }))}
              style={{ ...inpStyle, opacity: form.useIns ? 1 : 0.5 }} />
            {form.useIns && <div style={{ fontSize: 11, color: C.textMuted }}>Deducted from Special Allowance pool</div>}
          </div>
        </div>
        {/* Row 4: Fixed Component Overrides */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Override Fixed Components <span style={{ fontWeight: 400, textTransform: "none" }}>(leave blank to use defaults)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Conveyance (default ₹1,600)</div>
              <input type="number" min="0" placeholder="₹ 1,600" value={form.conveyanceAmount}
                onChange={e => setForm(f => ({ ...f, conveyanceAmount: e.target.value }))} style={inpStyle} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Medical Allowance (default ₹1,250)</div>
              <input type="number" min="0" placeholder="₹ 1,250" value={form.medicalAmount}
                onChange={e => setForm(f => ({ ...f, medicalAmount: e.target.value }))} style={inpStyle} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Internet & Broadband (default ₹1,200)</div>
              <input type="number" min="0" placeholder="₹ 1,200" value={form.internetAmount}
                onChange={e => setForm(f => ({ ...f, internetAmount: e.target.value }))} style={inpStyle} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Btn onClick={generate} disabled={generating || !form.employeeId}>
            {generating ? "Generating…" : "Generate Payslip"}
          </Btn>
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith("✅") ? C.green : C.red }}>{msg}</div>}
      </Card>

      {/* Filter + Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, flex: 1 }}>Generated Payslips ({shown.length})</div>
          <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
            style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 13 }}>
            <option value="">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
            style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 13 }}>
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {loading ? <div style={{ padding: 32 }}><Spinner /></div> : shown.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No payslips generated yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: C.surface }}>
              {["Employee", "Period", "Gross", "Bonus", "Deductions", "Net Pay", "Generated", "Approval", ""].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: .5, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {shown.map(ps => (
                <tr key={ps.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Avatar initials={ps.avatar} color={ps.group_color || C.accent} size={30} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ps.employee_name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{ps.group_name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: C.text }}>{SLIP_MONTHS[ps.month - 1]} {ps.year}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: C.green, fontWeight: 600 }}>{fmt(ps.gross)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: C.amber }}>{Number(ps.bonus) > 0 ? fmt(ps.bonus) : "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: C.red }}>{fmt(Number(ps.pf_employee) + Number(ps.professional_tax) + Number(ps.extra_deductions || 0))}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 800, color: C.green }}>{fmt(ps.net_pay)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 11, color: C.textMuted }}>{ps.generated_at?.slice(0, 10)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {ps.is_approved
                      ? <Badge color={C.green}>✓ Approved</Badge>
                      : ps.download_requested
                        ? <Btn small variant="success" onClick={() => approve(ps.id)}>Approve</Btn>
                        : <span style={{ fontSize: 12, color: C.textMuted }}>—</span>
                    }
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn small variant="ghost" onClick={() => printPayslipData(ps, origin)}>🖨 Print</Btn>
                      <Btn small variant="ghost" onClick={() => del(ps.id)} style={{ color: C.red }}>🗑</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function DocumentGrid({ type = "document", allowEdit = false }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { id, title, url }
  const [saving, setSaving] = useState(false);

  const titleText = type === "policy" ? "Company Policies" : "Documents";
  const descText = type === "policy" ? "Review important guidelines" : "Manage important links";

  async function load() {
    setLoading(true);
    try { setDocs(await api.getDocuments({ type })); } catch (e) { dialog.alert("Failed to fetch: " + e.message, { title: "Error", dtype: "error" }); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [type]);

  async function save() {
    if (!modal.title || !modal.url) { dialog.alert("Title and URL required", { title: "Validation", dtype: "warning" }); return; }
    setSaving(true);
    try {
      if (modal.id) await api.updateDocument(modal.id, { title: modal.title, url: modal.url, type });
      else await api.createDocument({ title: modal.title, url: modal.url, type });
      setModal(null);
      load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    setSaving(false);
  }

  async function del(id) {
    if (!await dialog.confirm("Delete this document link?", { dtype: "warning" })) return;
    try { await api.deleteDocument(id); setDocs(ds => ds.filter(d => d.id !== id)); } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>{titleText}</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>{descText}</p>
        </div>
        {allowEdit && <Btn onClick={() => setModal({ title: "", url: "" })}>+ Add Link</Btn>}
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center" }}><Spinner /></div> : docs.length === 0 ? (
        <Card style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No {type === "policy" ? "policies" : "documents"} found.</Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {docs.map(d => (
            <Card key={d.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{d.title}</div>
                {allowEdit && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setModal(d)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14 }}>✏</button>
                    <button onClick={() => del(d.id)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: C.red }}>🗑</button>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Added by {d.creator_name || "Unknown"} on {d.created_at?.slice(0, 10)}</div>
              <a href={d.url} target="_blank" rel="noreferrer" style={{
                marginTop: "auto", display: "inline-block", backgroundColor: C.surface, color: C.accent,
                textDecoration: "none", padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: `1px solid ${C.border}`, textAlign: "center"
              }}>↗ Open Link</a>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal.id ? "Edit Document" : "New Document"} onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Title</div>
              <input value={modal.title} onChange={e => setModal({ ...modal, title: e.target.value })}
                placeholder="e.g. Employee Handbook" style={{ width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>URL</div>
              <input value={modal.url} onChange={e => setModal({ ...modal, url: e.target.value })}
                placeholder="https://..." style={{ width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13 }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn>
              <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// COMPANY RESUME GENERATOR
// ════════════════════════════════════════════════════════
function AdminCompanyResume() {
  const [form, setForm] = useState({
    name: "",
    technologies: "",
    summary: "",
    certifications: "",
    exposure: "",
    industries: "",
    clients: "",
    experience: [{ client: "", role: "", startDate: "", endDate: "", environment: "", responsibilities: "" }],
    showLogo: true
  });

  const handleExpChange = (i, field, value) => {
    const e = [...form.experience]; e[i][field] = value;
    setForm({ ...form, experience: e });
  };
  const addExp = () => setForm({ ...form, experience: [...form.experience, { client: "", role: "", startDate: "", endDate: "", environment: "", responsibilities: "" }] });
  const remExp = (i) => setForm({ ...form, experience: form.experience.filter((_, idx) => idx !== i) });

  // split string by newline character, trim, remove leading bullets/dashes if user typed them, and return array of non-empty bullets
  const parseBullets = (text) => text.split('\n')
    .map(t => t.trim().replace(/^[\u2022\u25E6\u25A0\-\*]\s*/, ''))
    .filter(t => t !== '');

  const SectionHeader = ({ title }) => (
    <h3 style={{ margin: "24px 0 12px", fontSize: "14px", color: "#000", fontFamily: "Arial, sans-serif", fontWeight: "bold", textTransform: "uppercase" }}>{title}</h3>
  );

  const BulletList = ({ items }) => (
    <ul style={{ margin: 0, paddingLeft: "40px", fontSize: "12px", color: "#000", lineHeight: "1.6", fontFamily: "Arial, sans-serif" }}>
      {items.map((item, i) => <li key={i} style={{ marginBottom: "6px" }}>{item}</li>)}
    </ul>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── Unified page header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Generate Company Resume</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Generate official Fascinate IT vendor profiles</p>
        </div>
        <Btn variant="success" onClick={() => {
          const oldTitle = document.title;
          document.title = form.name ? `${form.name}_Resume` : "Company_Resume";
          window.print();
          document.title = oldTitle;
        }}>🖨 Download PDF / Print</Btn>
      </div>

      {/* ── Two-panel body (form | preview) ── */}
      <div className="resume-panels" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      {/* Left: Editor Panel */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="show-logo-cb" checked={form.showLogo} onChange={e => setForm({ ...form, showLogo: e.target.checked })} style={{ cursor: "pointer", width: 16, height: 16, accentColor: C.accent }} />
              <label htmlFor="show-logo-cb" style={{ fontSize: 13, color: C.text, fontWeight: 600, cursor: "pointer" }}>Display Company Logo on Resume</label>
            </div>

            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Employee Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. FirstName LastName" />
              <Inp label="Technologies (Subtitle)" value={form.technologies} onChange={v => setForm({ ...form, technologies: v })} placeholder="e.g. SAP C4C, Sales Cloud..." />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Profile Summary (1 bullet per line)</label>
              <textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} rows={4}
                style={{ width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
            </div>

            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Certifications (1 per line)</label>
                <textarea value={form.certifications} onChange={e => setForm({ ...form, certifications: e.target.value })} rows={3}
                  style={{ width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Global Exposure (1 per line)</label>
                <textarea value={form.exposure} onChange={e => setForm({ ...form, exposure: e.target.value })} rows={3}
                  style={{ width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
              </div>
            </div>

            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Industries (1 per line)</label>
                <textarea value={form.industries} onChange={e => setForm({ ...form, industries: e.target.value })} rows={3}
                  style={{ width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Clients (1 per line)</label>
                <textarea value={form.clients} onChange={e => setForm({ ...form, clients: e.target.value })} rows={3}
                  style={{ width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Professional Experience</span>
                <Btn small variant="ghost" onClick={addExp}>+ Add Experience</Btn>
              </div>
              {form.experience.map((exp, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12, border: `1px solid ${C.border}66`, padding: 12, borderRadius: 8, marginBottom: 12, background: C.bg }}>
                  <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Inp label="Client" value={exp.client} onChange={v => handleExpChange(i, "client", v)} placeholder="e.g. NIR" />
                    <Inp label="Role" value={exp.role} onChange={v => handleExpChange(i, "role", v)} placeholder="e.g. SAP C4C Functional consultant" />
                    <Inp label="Start Date" value={exp.startDate} onChange={v => handleExpChange(i, "startDate", v)} placeholder="e.g. Jan 2020" />
                    <Inp label="End Date" value={exp.endDate} onChange={v => handleExpChange(i, "endDate", v)} placeholder="e.g. Dec 2022 or Present" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Environment</label>
                    <input value={exp.environment} onChange={e => handleExpChange(i, "environment", e.target.value)} placeholder="e.g. SAP C4C ISU & SAP S4 Hana"
                      style={{ width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13 }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Responsibilities (1 per line)</label>
                    <textarea value={exp.responsibilities} onChange={e => handleExpChange(i, "responsibilities", e.target.value)} rows={3}
                      style={{ width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
                  </div>
                  <div style={{ textAlign: "right" }}><Btn small variant="danger" onClick={() => remExp(i)}>Remove</Btn></div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Right: Live Preview Panel */}
      <div style={{ flex: 1.2, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* The Capture Box */}
        <div style={{ background: "#e2e8f0", padding: "20px", borderRadius: 12, overflowY: "auto", flex: 1, display: "flex", justifyContent: "center" }}>
          <div id="capture-resume" style={{ background: "#fff", width: "210mm", minHeight: "297mm", padding: "0", boxShadow: "0 0 10px rgba(0,0,0,0.1)", color: "#000", fontFamily: "Arial, sans-serif" }}>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <td style={{ paddingTop: "16px", paddingBottom: "12px" }}>
                    {/* Payslip Logo - Top Left */}
                    {form.showLogo && (
                      <div style={{ textAlign: "left", marginLeft: "40px" }}>
                        <img src={`${window.location.origin}/paysliplogo.png`} alt="Fascinate IT Logo" style={{ height: "35px", objectFit: "contain" }} />
                      </div>
                    )}
                  </td>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "0 40px 40px" }}>
                    {/* Header */}
                    <div style={{ marginBottom: "20px" }}>
                      {form.name && <h1 style={{ margin: 0, fontSize: "16px", color: "#000", fontWeight: "bold", borderLeft: "3px solid #000", paddingLeft: "8px" }}>{form.name}</h1>}
                      {form.technologies && <p style={{ margin: "4px 0 0 11px", fontSize: "12px", color: "#1e40af", fontWeight: "bold", textDecoration: "underline" }}>{form.technologies}</p>}
                    </div>

                    <hr style={{ border: "none", borderTop: "2px solid #000", margin: "10px 0 20px" }} />

                    {/* Summary */}
                    {form.summary && (
                      <div style={{ marginBottom: "16px", pageBreakInside: "avoid" }}>
                        <SectionHeader title="PROFILE SUMMARY:" />
                        <BulletList items={parseBullets(form.summary)} />
                      </div>
                    )}

                    {/* Certifications */}
                    {form.certifications && (
                      <div style={{ marginBottom: "16px", pageBreakInside: "avoid" }}>
                        <SectionHeader title="CERTIFICATIONS:" />
                        <BulletList items={parseBullets(form.certifications)} />
                      </div>
                    )}

                    {/* Global Exposure */}
                    {form.exposure && (
                      <div style={{ marginBottom: "16px", pageBreakInside: "avoid" }}>
                        <SectionHeader title="GLOBAL EXPOSURE:" />
                        <BulletList items={parseBullets(form.exposure)} />
                      </div>
                    )}

                    {/* Industries */}
                    {form.industries && (
                      <div style={{ marginBottom: "16px", pageBreakInside: "avoid" }}>
                        <SectionHeader title="INDUSTRIES:" />
                        <BulletList items={parseBullets(form.industries)} />
                      </div>
                    )}

                    {/* Clients */}
                    {form.clients && (
                      <div style={{ marginBottom: "16px", pageBreakInside: "avoid" }}>
                        <SectionHeader title="CLIENTS:" />
                        <BulletList items={parseBullets(form.clients)} />
                      </div>
                    )}

                    {/* Experience */}
                    {form.experience.some(e => e.client || e.role || e.startDate || e.endDate || e.environment || e.responsibilities) && (
                      <div style={{ marginBottom: "16px" }}>
                        <SectionHeader title="PROFESSIONAL EXPERIENCE:" />
                        {form.experience.map((exp, i) => (exp.client || exp.role || exp.startDate || exp.endDate || exp.environment || exp.responsibilities) ? (
                          <div key={i} style={{ marginBottom: "16px", fontSize: "12px", color: "#000", fontFamily: "Arial, sans-serif", pageBreakInside: "avoid" }}>
                            {exp.client && <div style={{ marginBottom: "2px" }}><strong>Client:</strong> <span style={{ color: "#1e40af" }}>{exp.client}</span></div>}
                            {exp.role && <div style={{ marginBottom: "2px" }}><strong>Role:</strong> <span style={{ color: "#1e40af" }}>{exp.role}</span></div>}
                            {(exp.startDate || exp.endDate) && (
                              <div style={{ marginBottom: "2px" }}>
                                <strong>Duration:</strong> <span style={{ color: "#1e40af" }}>{exp.startDate || "—"} to {exp.endDate || "Present"}</span>
                              </div>
                            )}
                            {exp.environment && <div style={{ marginBottom: "8px" }}><strong>Environment:</strong> <span style={{ color: "#1e40af" }}>{exp.environment}</span></div>}
                            {exp.responsibilities && (
                              <div>
                                <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Responsibilities/Deliverables:</div>
                                <BulletList items={parseBullets(exp.responsibilities)} />
                              </div>
                            )}
                          </div>
                        ) : null)}
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
              <tfoot style={{ display: "table-footer-group" }}>
                <tr>
                  <td style={{ height: "40px" }}></td>
                </tr>
              </tfoot>
            </table>

            {/* CSS Print Footer for Page Numbers */}
            <div className="print-footer" style={{ position: "fixed", bottom: 0, left: 0, right: 0, textAlign: "center", fontSize: "10px", color: "#666", paddingBottom: "10mm", background: "#fff" }}>
              <span className="pageNumber"></span>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

// ════════════════════════════════════════════════════════
// SUBSCRIPTION MANAGEMENT
// ════════════════════════════════════════════════════════
const EXPIRY_THRESHOLD_DAYS = 10;

function daysUntilExpiry(expireDateStr) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const exp = new Date(expireDateStr); exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

function SubscriptionManagement() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(false); // false | "new" | sub-object
  const [saving, setSaving] = useState(false);

  const empty = { app_name: "", start_date: "", expire_date: "", amount: "", link: "" };
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { setSubs(await api.getSubscriptions()); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() { setForm(empty); setModal("new"); }
  function openEdit(s) {
    setForm({
      app_name: s.app_name, start_date: s.start_date, expire_date: s.expire_date,
      amount: s.amount, link: s.link
    });
    setModal(s);
  }

  async function handleSave() {
    if (!form.app_name || !form.start_date || !form.expire_date || !form.link)
      { dialog.alert("App name, start date, expire date and link are required.", { title: "Validation", dtype: "warning" }); return; }
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount) || 0 };
      if (modal === "new") await api.createSubscription(payload);
      else await api.updateSubscription(modal.id, payload);
      setModal(false); await load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!await dialog.confirm("Delete this subscription?", { dtype: "warning" })) return;
    try { await api.deleteSubscription(id); await load(); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Subscription Management</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>
            Track app subscriptions — highlighted in red if expiring within {EXPIRY_THRESHOLD_DAYS} days
          </p>
        </div>
        <Btn onClick={openNew}>+ Add Subscription</Btn>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div className="resp-table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                {["App Name", "Start Date", "Expire Date", "Amount (INR)", "Days Left", "Link", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: .5, textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.textMuted, fontSize: 13 }}>No subscriptions yet. Click "+ Add Subscription" to get started.</td></tr>
              )}
              {subs.map(s => {
                const days = daysUntilExpiry(s.expire_date);
                const expiring = days <= EXPIRY_THRESHOLD_DAYS;
                const expired = days < 0;
                const rowBg = expired ? C.red + "14" : expiring ? C.red + "0D" : "transparent";
                const expiryColor = expired ? C.red : expiring ? C.red : C.text;
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}`, background: rowBg, transition: "background .15s" }}>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 600, color: C.text }}>
                      {expiring && <span style={{ color: C.red, marginRight: 6, fontSize: 14 }}>⚠</span>}
                      {s.app_name}
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: C.textDim }}>{fmtD(s.start_date)}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: expiryColor, fontWeight: expiring ? 700 : 400 }}>{fmtD(s.expire_date)}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: C.text }}>{fmt$(s.amount)}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: expiryColor }}>
                      {expired ? "Expired" : `${days}d`}
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13 }}>
                      <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, textDecoration: "none", fontWeight: 600 }}
                        onMouseEnter={e => e.target.style.textDecoration = "underline"}
                        onMouseLeave={e => e.target.style.textDecoration = "none"}>
                        Open ↗
                      </a>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Btn small variant="ghost" onClick={() => openEdit(s)}>✏ Edit</Btn>
                        <Btn small variant="danger" onClick={() => handleDelete(s.id)}>🗑</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {modal && (
        <Modal title={modal === "new" ? "Add Subscription" : "Edit Subscription"} onClose={() => setModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Inp label="App Name" value={form.app_name} onChange={v => setForm(f => ({ ...f, app_name: v }))} required placeholder="e.g. GitHub, Jira, AWS" />
            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Start Date" type="date" value={form.start_date} onChange={v => setForm(f => ({ ...f, start_date: v }))} required />
              <Inp label="Expire Date" type="date" value={form.expire_date} onChange={v => setForm(f => ({ ...f, expire_date: v }))} required />
            </div>
            <Inp label="Amount (INR)" type="number" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} placeholder="0" />
            <Inp label="Link / URL" value={form.link} onChange={v => setForm(f => ({ ...f, link: v }))} required placeholder="https://..." />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
              <Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : modal === "new" ? "Add" : "Save Changes"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ONBOARD EMPLOYEE
// ════════════════════════════════════════════════════════
const ONBOARD_DOC_TYPES = [
  { key: "photo", label: "Employee Photo", required: true },
  { key: "aadhar", label: "Aadhar Card", required: true },
  { key: "pan", label: "PAN Card", required: true },
  { key: "address_proof", label: "Address Proof (Passport / DL)", required: true },
  { key: "education", label: "Educational Certificates", required: true },
  { key: "relieving", label: "Relieving / Experience Letter", required: false },
  { key: "bank", label: "Bank Proof (Cheque / Passbook)", required: true },
  { key: "offer_letter", label: "Signed Offer Letter", required: true },
  { key: "bgv_form", label: "Background Verification Form", required: false },
  { key: "other", label: "Other Document", required: false },
];

const ONBOARD_STATUS_COLORS = {
  pending: C.amber,
  in_progress: C.accent,
  completed: C.green,
};

function OnboardEmployee() {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [spConfigured, setSpConfigured] = useState(null);

  // view = null | "list" | "form" | "detail"
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);   // onboarding record
  const [detail, setDetail] = useState(null);   // full record with docs

  // form state
  const emptyForm = {
    employee_id: "", joining_date: "", status: "pending",
    laptop_issued: false, id_card_issued: false, email_created: false,
    system_access: false, induction_done: false, notes: ""
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // upload state per doc_type
  const [uploads, setUploads] = useState({});   // { doc_type: File | null }
  const [uploading, setUploading] = useState({}); // { doc_type: bool }

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [recs, emps] = await Promise.all([api.getOnboardingRecords(), api.getEmployees()]);
      setRecords(recs); setEmployees(emps);
      try { const s = await api.getSpStatus(); setSpConfigured(s.configured); } catch { }
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadDetail(rid) {
    try {
      const r = await api.getOnboardingRecord(rid);
      setDetail(r);
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  function openNew() {
    setForm(emptyForm); setSelected(null); setView("form");
  }
  function openEdit(rec) {
    setForm({
      employee_id: rec.employee_id, joining_date: rec.joining_date || "",
      status: rec.status, laptop_issued: !!rec.laptop_issued,
      id_card_issued: !!rec.id_card_issued, email_created: !!rec.email_created,
      system_access: !!rec.system_access, induction_done: !!rec.induction_done,
      notes: rec.notes || ""
    });
    setSelected(rec); setView("form");
  }
  async function openDetail(rec) {
    setDetail(null); setSelected(rec); setView("detail");
    await loadDetail(rec.id);
  }

  async function handleSave() {
    if (!form.employee_id) { dialog.alert("Please select an employee.", { title: "Validation", dtype: "warning" }); return; }
    setSaving(true);
    try {
      if (selected) await api.updateOnboardingRecord(selected.id, form);
      else await api.createOnboardingRecord(form);
      await load(); setView("list");
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!await dialog.confirm("Delete this onboarding record and all its documents?", { dtype: "warning" })) return;
    try { await api.deleteOnboardingRecord(id); await load(); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  async function handleUpload(docType) {
    const file = uploads[docType];
    if (!file || !detail) return;
    setUploading(u => ({ ...u, [docType]: true }));
    try {
      await api.uploadOnboardingDocument(detail.id, docType, file);
      setUploads(u => ({ ...u, [docType]: null }));
      await loadDetail(detail.id);
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setUploading(u => ({ ...u, [docType]: false })); }
  }

  async function handleDeleteDoc(did) {
    if (!await dialog.confirm("Remove this document?", { dtype: "warning" })) return;
    try {
      await api.deleteOnboardingDocument(detail.id, did);
      await loadDetail(detail.id);
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  function empOptions() {
    return employees.map(e => ({
      value: String(e.id),
      label: `${e.name}${e.custom_employee_id ? ` (${e.custom_employee_id})` : ""}`
    }));
  }

  const completedDocs = (docs) => new Set((docs || []).map(d => d.doc_type));
  const progress = (docs) => {
    const required = ONBOARD_DOC_TYPES.filter(t => t.required);
    const done = required.filter(t => completedDocs(docs).has(t.key)).length;
    return Math.round((done / required.length) * 100);
  };

  // ── SharePoint warning banner ──
  const SpWarning = () => spConfigured === false ? (
    <div style={{ background: C.amber + "18", border: `1px solid ${C.amber}44`, borderRadius: 10, padding: "10px 16px", fontSize: 12, color: C.amber, marginBottom: 16 }}>
      ⚠ SharePoint is not configured. Documents will be recorded but <strong>not uploaded to SharePoint</strong>.
      Add <code style={{ background: C.bg, padding: "1px 5px", borderRadius: 4 }}>SP_*</code> env vars to the backend to enable cloud storage.
    </div>
  ) : null;

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  // ── DETAIL view ──────────────────────────────────────────────────────────
  if (view === "detail") {
    const emp = employees.find(e => detail && e.id === detail.employee_id);
    const docs = detail?.documents || [];
    const done = completedDocs(docs);
    const pct = detail ? progress(docs) : 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn variant="ghost" small onClick={() => { setView("list"); setDetail(null); }}>← Back</Btn>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>
            Onboarding — {detail?.employee_name || "…"}
          </h2>
          {detail && <Badge color={ONBOARD_STATUS_COLORS[detail.status]}>{detail.status.replace("_", " ")}</Badge>}
        </div>

        <SpWarning />

        {!detail ? <Spinner /> : (
          <>
            {/* Info cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
              {[
                { label: "Employee ID", val: detail.custom_employee_id || "—" },
                { label: "Email", val: detail.email || "—" },
                { label: "Joining Date", val: detail.joining_date ? fmtD(detail.joining_date) : "—" },
              ].map(i => (
                <Card key={i.label} style={{ padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>{i.label}</div>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginTop: 4 }}>{i.val}</div>
                </Card>
              ))}
            </div>

            {/* IT / HR checklist */}
            <Card>
              <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: C.text }}>IT & HR Checklist</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
                {[
                  ["Laptop Issued", "laptop_issued"],
                  ["ID Card Issued", "id_card_issued"],
                  ["Email Created", "email_created"],
                  ["System Access", "system_access"],
                  ["Induction Done", "induction_done"],
                ].map(([lbl, key]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{detail[key] ? "✅" : "⬜"}</span>
                    <span style={{ fontSize: 13, color: detail[key] ? C.green : C.textMuted }}>{lbl}</span>
                  </div>
                ))}
              </div>
              {detail.notes && (
                <div style={{ marginTop: 14, padding: "10px 14px", background: C.bg, borderRadius: 8, fontSize: 13, color: C.textDim }}>
                  <span style={{ fontWeight: 700, color: C.textMuted }}>Notes: </span>{detail.notes}
                </div>
              )}
            </Card>

            {/* Document progress */}
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>Document Upload</h4>
                <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? C.green : C.accent }}>{pct}% complete</span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 10, marginBottom: 20 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? C.green : C.accent, borderRadius: 10, transition: "width .4s" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {ONBOARD_DOC_TYPES.map(dt => {
                  const uploaded = docs.filter(d => d.doc_type === dt.key);
                  const isUploading = uploading[dt.key];
                  return (
                    <div key={dt.key} style={{
                      background: C.surface, borderRadius: 8, padding: "12px 16px",
                      border: `1px solid ${done.has(dt.key) ? C.green + "44" : C.border}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{done.has(dt.key) ? "✅" : "📄"}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{dt.label}</span>
                          {dt.required && <Badge color={C.red}>Required</Badge>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                            <input type="file" style={{ display: "none" }}
                              onChange={e => setUploads(u => ({ ...u, [dt.key]: e.target.files[0] || null }))}
                            />
                            <span style={{
                              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
                              padding: "5px 12px", fontSize: 12, color: C.textDim, cursor: "pointer"
                            }}>
                              {uploads[dt.key] ? uploads[dt.key].name : "Choose file"}
                            </span>
                          </label>
                          <Btn small onClick={() => handleUpload(dt.key)}
                            disabled={!uploads[dt.key] || isUploading}>
                            {isUploading ? "Uploading…" : "Upload"}
                          </Btn>
                        </div>
                      </div>

                      {/* Uploaded files for this doc type */}
                      {uploaded.length > 0 && (
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                          {uploaded.map(d => (
                            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.card, borderRadius: 6 }}>
                              <span style={{ fontSize: 13, flex: 1, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                📎 {d.filename}
                              </span>
                              {d.sharepoint_url ? (
                                <a href={d.sharepoint_url} target="_blank" rel="noopener noreferrer"
                                  style={{ fontSize: 12, color: C.accent, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                                  Open ↗
                                </a>
                              ) : (
                                <span style={{ fontSize: 11, color: C.textMuted }}>Local only</span>
                              )}
                              <Btn small variant="danger" onClick={() => handleDeleteDoc(d.id)}>🗑</Btn>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" onClick={() => openEdit(selected)}>✏ Edit Details</Btn>
              <Btn variant="ghost" onClick={() => { setView("list"); setDetail(null); }}>← Back to List</Btn>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── FORM view ────────────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 680 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn variant="ghost" small onClick={() => setView("list")}>← Back</Btn>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>
            {selected ? "Edit Onboarding" : "New Onboarding"}
          </h2>
        </div>

        <Card>
          <h4 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: C.text }}>Employee Details</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SearchableSelect
              label="Employee *"
              value={String(form.employee_id || "")}
              onChange={v => setForm(f => ({ ...f, employee_id: v }))}
              options={empOptions()}
              placeholder="Search employee…"
              disabled={!!selected}
            />
            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Joining Date" type="date" value={form.joining_date}
                onChange={v => setForm(f => ({ ...f, joining_date: v }))} />
              <Inp label="Status" value={form.status}
                onChange={v => setForm(f => ({ ...f, status: v }))}
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "in_progress", label: "In Progress" },
                  { value: "completed", label: "Completed" },
                ]} />
            </div>
          </div>
        </Card>

        <Card>
          <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: C.text }}>IT & HR Checklist</h4>
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              ["Laptop Issued", "laptop_issued"],
              ["ID Card Issued", "id_card_issued"],
              ["Email Created", "email_created"],
              ["System Access", "system_access"],
              ["Induction Done", "induction_done"],
            ].map(([lbl, key]) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 12px", background: C.surface, borderRadius: 8 }}>
                <input type="checkbox" checked={!!form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: C.accent, cursor: "pointer" }} />
                <span style={{ fontSize: 13, color: C.text }}>{lbl}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <Inp label="Notes / Remarks" value={form.notes}
            onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Any additional onboarding notes…" />
        </Card>

        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : selected ? "Save Changes" : "Create & Start Onboarding"}</Btn>
          <Btn variant="ghost" onClick={() => setView("list")}>Cancel</Btn>
        </div>
      </div>
    );
  }

  // ── LIST view ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Onboard Employee</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>
            Manage employee onboarding — track documents, IT setup & HR checklist
          </p>
        </div>
        <Btn onClick={openNew}>+ New Onboarding</Btn>
      </div>

      <SpWarning />

      {records.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🧑‍💼</div>
          <div style={{ fontSize: 15, color: C.textMuted }}>No onboarding records yet.</div>
          <Btn style={{ marginTop: 16 }} onClick={openNew}>+ Start First Onboarding</Btn>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div className="resp-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  {["Employee", "Emp ID", "Joining Date", "Status", "Docs", "Checklist", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: .5, textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(rec => {
                  const checklistDone = [rec.laptop_issued, rec.id_card_issued, rec.email_created, rec.system_access, rec.induction_done].filter(Boolean).length;
                  const statusColor = ONBOARD_STATUS_COLORS[rec.status] || C.textMuted;
                  return (
                    <tr key={rec.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{rec.employee_name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{rec.email}</div>
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 12, color: C.textDim }}>{rec.custom_employee_id || "—"}</td>
                      <td style={{ padding: "13px 16px", fontSize: 13, color: C.textDim }}>{rec.joining_date ? fmtD(rec.joining_date) : "—"}</td>
                      <td style={{ padding: "13px 16px" }}><Badge color={statusColor}>{rec.status.replace("_", " ")}</Badge></td>
                      <td style={{ padding: "13px 16px", fontSize: 13, color: C.textDim }}>{rec.document_count} uploaded</td>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 60, height: 5, background: C.border, borderRadius: 10 }}>
                            <div style={{ width: `${(checklistDone / 5) * 100}%`, height: "100%", background: checklistDone === 5 ? C.green : C.accent, borderRadius: 10 }} />
                          </div>
                          <span style={{ fontSize: 11, color: C.textMuted }}>{checklistDone}/5</span>
                        </div>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Btn small variant="ghost" onClick={() => openDetail(rec)}>📂 View Docs</Btn>
                          <Btn small variant="ghost" onClick={() => openEdit(rec)}>✏</Btn>
                          <Btn small variant="danger" onClick={() => handleDelete(rec.id)}>🗑</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// INFRA / ASSETS
// ════════════════════════════════════════════════════════
const ASSET_TYPE_ICON = {
  laptop: "💻", headphone: "🎧", headphones: "🎧", monitor: "🖥", keyboard: "⌨️",
  mouse: "🖱", phone: "📱", tablet: "📱", printer: "🖨", chair: "🪑",
  desk: "🪑", server: "🗄", router: "📡", other: "📦"
};
function assetIcon(t) {
  if (!t) return "📦";
  const key = t.toLowerCase();
  for (const k of Object.keys(ASSET_TYPE_ICON)) { if (key.includes(k)) return ASSET_TYPE_ICON[k]; }
  return "📦";
}
const ASSET_STATUS_COLOR = {
  available: C.green, assigned: C.accent, maintenance: C.amber, retired: C.textMuted || "#64748b"
};

function AdminAssets() {
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [modal, setModal] = useState(null); // null | "add" | "edit" | "assign"
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");

  const EMPTY_FORM = { asset_tag: "", asset_type: "", brand: "", model: "", serial_number: "", purchase_date: "", purchase_cost: "", warranty_expiry: "", status: "available", notes: "", depreciation_amount: "" };
  const [form, setForm] = useState(EMPTY_FORM);
  const [assignForm, setAssignForm] = useState({ employee_id: "", assigned_date: "" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [a, e] = await Promise.all([api.getAssets(), api.getEmployees()]);
      setAssets(a);
      setEmployees(e);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setForm(EMPTY_FORM); setEditing(null); setModal("add"); }
  function openEdit(a) { setEditing(a); setForm({ ...a, purchase_cost: a.purchase_cost ?? "", purchase_date: a.purchase_date?.split("T")[0] || "", warranty_expiry: a.warranty_expiry?.split("T")[0] || "", depreciation_amount: a.depreciation_amount ?? "" }); setModal("edit"); }
  function openAssign(a) { setEditing(a); setAssignForm({ employee_id: a.employee_id ? String(a.employee_id) : "", assigned_date: a.assigned_date?.split("T")[0] || "" }); setModal("assign"); }

  async function handleSave() {
    try {
      if (modal === "add") await api.createAsset(form);
      else await api.updateAsset(editing.id, form);
      setModal(null);
      load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  async function handleAssign() {
    try {
      await api.assignAsset(editing.id, { employee_id: assignForm.employee_id || null, assigned_date: assignForm.assigned_date || null });
      setModal(null);
      load();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  async function handleDelete(a) {
    if (!await dialog.confirm(`Delete asset "${a.asset_tag}"?`, { dtype: "warning" })) return;
    try { await api.deleteAsset(a.id); load(); } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  const filtered = assets.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterType && !a.asset_type?.toLowerCase().includes(filterType.toLowerCase())) return false;
    if (search) {
      const q = search.toLowerCase();
      return (a.asset_tag || "").toLowerCase().includes(q) ||
        (a.brand || "").toLowerCase().includes(q) ||
        (a.model || "").toLowerCase().includes(q) ||
        (a.employee_name || "").toLowerCase().includes(q);
    }
    return true;
  });

  const statCounts = { available: 0, assigned: 0, maintenance: 0, retired: 0 };
  assets.forEach(a => { if (statCounts[a.status] !== undefined) statCounts[a.status]++; });

  const inputStyle = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 13, outline: "none", width: "100%" };

  if (loading) return <div style={{ color: C.textMuted, padding: 40, textAlign: "center" }}>Loading…</div>;
  if (err) return <div style={{ color: C.red, padding: 40 }}>{err}</div>;

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>🖥 Infra / Assets</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>Track company assets assigned to employees</p>
        </div>
        <Btn onClick={openAdd}>+ Add Asset</Btn>
      </div>

      {/* Stat cards */}
      <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {Object.entries(statCounts).map(([s, n]) => (
          <Card key={s} style={{ padding: "16px 20px", cursor: "pointer", border: filterStatus === s ? `1px solid ${ASSET_STATUS_COLOR[s]}` : `1px solid ${C.border}` }} onClick={() => setFilterStatus(filterStatus === s ? "" : s)}>
            <div style={{ fontSize: 22, fontWeight: 800, color: ASSET_STATUS_COLOR[s] }}>{n}</div>
            <div style={{ fontSize: 12, color: C.textMuted, textTransform: "capitalize", marginTop: 2 }}>{s}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input placeholder="Search tag / brand / employee…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 240 }} />
        <input placeholder="Filter by type…" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inputStyle, width: 160 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 150 }}>
          <option value="">All Statuses</option>
          {["available", "assigned", "maintenance", "retired"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.surface }}>
                {["Type", "Asset Tag", "Brand / Model", "Serial #", "Purchase", "Depreciation", "Warranty", "Status", "Assigned To", ""].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: C.textMuted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: .5, whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: C.textMuted }}>No assets found.</td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}55` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surface + "88"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "12px 14px", fontSize: 20 }}>{assetIcon(a.asset_type)}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>{a.asset_tag}</td>
                  <td style={{ padding: "12px 14px", color: C.textDim }}>
                    <div>{a.brand || "—"}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{a.model || ""}</div>
                  </td>
                  <td style={{ padding: "12px 14px", color: C.textMuted, fontFamily: "monospace", fontSize: 12 }}>{a.serial_number || "—"}</td>
                  <td style={{ padding: "12px 14px", color: C.textMuted, whiteSpace: "nowrap" }}>
                    <div>{a.purchase_date ? a.purchase_date.split("T")[0] : "—"}</div>
                    <div style={{ fontSize: 12 }}>{a.purchase_cost != null ? `₹${Number(a.purchase_cost).toLocaleString("en-IN")}` : ""}</div>
                  </td>
                  <td style={{ padding: "12px 14px", color: C.textMuted, whiteSpace: "nowrap" }}>
                    {a.depreciation_amount != null ? `₹${Number(a.depreciation_amount).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td style={{ padding: "12px 14px", color: C.textMuted, whiteSpace: "nowrap" }}>{a.warranty_expiry ? a.warranty_expiry.split("T")[0] : "—"}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <Badge color={ASSET_STATUS_COLOR[a.status] || C.textMuted}>{a.status}</Badge>
                  </td>
                  <td style={{ padding: "12px 14px", color: C.textDim }}>
                    {a.employee_name ? (
                      <div>
                        <div style={{ fontWeight: 500 }}>{a.employee_name}</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>{a.assigned_date ? a.assigned_date.split("T")[0] : ""}</div>
                      </div>
                    ) : <span style={{ color: C.textMuted }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn small variant="ghost" onClick={() => openAssign(a)}>Assign</Btn>
                      <Btn small variant="ghost" onClick={() => openEdit(a)}>Edit</Btn>
                      <Btn small variant="danger" onClick={() => handleDelete(a)}>✕</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Modal */}
      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "add" ? "Add Asset" : "Edit Asset"} onClose={() => setModal(null)} maxWidth={560}>
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Inp label="Asset Tag *" value={form.asset_tag} onChange={v => setForm(f => ({ ...f, asset_tag: v }))} />
            <Inp label="Asset Type *" value={form.asset_type} onChange={v => setForm(f => ({ ...f, asset_type: v }))} placeholder="Laptop, Headphone, Monitor…" />
            <Inp label="Brand" value={form.brand} onChange={v => setForm(f => ({ ...f, brand: v }))} />
            <Inp label="Model" value={form.model} onChange={v => setForm(f => ({ ...f, model: v }))} />
            <Inp label="Serial Number" value={form.serial_number} onChange={v => setForm(f => ({ ...f, serial_number: v }))} />
            <Inp label="Purchase Date" type="date" value={form.purchase_date} onChange={v => setForm(f => ({ ...f, purchase_date: v }))} />
            <Inp label="Purchase Cost (₹)" type="number" value={form.purchase_cost} onChange={v => setForm(f => ({ ...f, purchase_cost: v }))} />
            <Inp label="Depreciation Amount (₹)" type="number" value={form.depreciation_amount} onChange={v => setForm(f => ({ ...f, depreciation_amount: v }))} />
            <Inp label="Warranty Expiry" type="date" value={form.warranty_expiry} onChange={v => setForm(f => ({ ...f, warranty_expiry: v }))} />
            <Inp label="Status" value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={["available", "assigned", "maintenance", "retired"].map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} />
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, display: "block", marginBottom: 6 }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={handleSave}>{modal === "add" ? "Create" : "Save"}</Btn>
          </div>
        </Modal>
      )}

      {/* Assign Modal */}
      {modal === "assign" && editing && (
        <Modal title={`Assign – ${editing.asset_tag}`} onClose={() => setModal(null)} maxWidth={400}>
          <div style={{ marginBottom: 14, padding: "10px 14px", background: C.surface, borderRadius: 8, fontSize: 13, color: C.textDim }}>
            <span style={{ fontWeight: 600 }}>{assetIcon(editing.asset_type)} {editing.asset_type}</span>
            {editing.brand && ` · ${editing.brand}`}{editing.model && ` ${editing.model}`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SearchableSelect
              label="Assign to Employee"
              value={assignForm.employee_id}
              onChange={v => setAssignForm(f => ({ ...f, employee_id: v }))}
              options={employees.map(e => ({ value: String(e.id), label: e.name }))}
              placeholder="Search employee…"
            />
            <Inp label="Assigned Date" type="date" value={assignForm.assigned_date} onChange={v => setAssignForm(f => ({ ...f, assigned_date: v }))} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn>
            {editing.employee_id && <Btn variant="danger" onClick={async () => { await api.assignAsset(editing.id, { employee_id: null, assigned_date: null }); setModal(null); load(); }}>Unassign</Btn>}
            <Btn onClick={handleAssign}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// PEOPLE HUB (Employees + Resources)
// ════════════════════════════════════════════════════════
function PeopleHub({ readOnly, currentUser }) {
  const [tab, setTab] = useState("employees");
  const TABS = [
    { id: "employees", label: "Employees", icon: "👥" },
    { id: "resources", label: "Resources", icon: "◉" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Employees & Resources</h2>
        <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Manage employees, groups, project assignments and resources</p>
      </div>
      <div style={{ display: "flex", gap: 4, background: C.surface, padding: 4, borderRadius: 10, width: "fit-content", maxWidth: "100%", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? C.card : "transparent",
            color: tab === t.id ? C.text : C.textMuted,
            border: tab === t.id ? `1px solid ${C.border}` : "1px solid transparent",
            borderRadius: 8, padding: "6px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6
          }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      {tab === "employees" && <AdminEmployees readOnly={readOnly} currentUser={currentUser} />}
      {tab === "resources" && <Resources readOnly={readOnly} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ATTENDANCE & CLAIMS (Timesheets / Leave / Expenses)
// ════════════════════════════════════════════════════════
function AttendanceClaims({ currentUser }) {
  const [tab, setTab] = useState("timesheets");
  const TABS = [
    { id: "timesheets", label: "Timesheets", icon: "◷" },
    { id: "leaves", label: "Leave", icon: "◌" },
    { id: "expenses", label: "Expenses", icon: "💳" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Attendance & Claims</h2>
        <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Manage timesheets, leave requests and expense claims</p>
      </div>
      <div style={{ display: "flex", gap: 4, background: C.surface, padding: 4, borderRadius: 10, width: "fit-content", maxWidth: "100%", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? C.card : "transparent",
            color: tab === t.id ? C.text : C.textMuted,
            border: tab === t.id ? `1px solid ${C.border}` : "1px solid transparent",
            borderRadius: 8, padding: "6px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6
          }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      {tab === "timesheets" && <Timesheets currentUser={currentUser} viewOnly={false} />}
      {tab === "leaves" && <Leaves currentUser={currentUser} viewOnly={false} />}
      {tab === "expenses" && <Expenses currentUser={currentUser} viewOnly={false} />}
    </div>
  );
}

const ADMIN_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "project_management", label: "Project Mgmt (Client)", icon: "📊" },
  { id: "people", label: "Employees & Resources", icon: "👥" },
  { id: "attendance", label: "Attendance & Claims", icon: "◷" },
  { id: "payslips", label: "Payslips", icon: "💰" },
  { id: "reports", label: "Reports", icon: "◫" },
  { id: "useraccounts", label: "User Accounts", icon: "🔑" },
  { id: "documents", label: "Documents", icon: "📄" },
  { id: "resumes", label: "Generate Company Resume", icon: "📑" },
  { id: "policies", label: "Company Policy", icon: "📜" },
  { id: "subscriptions", label: "Subscription Management", icon: "🔔" },
  { id: "onboard", label: "Onboard Employee", icon: "🧑‍💼" },
  { id: "compensation", label: "Compensation Details", icon: "🧮" },
  { id: "infra", label: "Infra / Assets", icon: "🖥" },
];

// ════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════
const STYLE = [
  "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');",
  "* { box-sizing: border-box; }",
  "input, select, button { font-family: inherit !important; }",
  "input[type='date'], input[type='time'], input[type='datetime-local'] { color-scheme: dark; }",
  "input[type='date']::-webkit-calendar-picker-indicator, input[type='time']::-webkit-calendar-picker-indicator, input[type='datetime-local']::-webkit-calendar-picker-indicator { filter: brightness(0) invert(1) !important; opacity: 1 !important; cursor: pointer; }",
  "::-webkit-scrollbar { width: 4px; height: 4px; }",
  "::-webkit-scrollbar-track { background: transparent; }",
  "::-webkit-scrollbar-thumb { background: #1E2740; border-radius: 4px; }",
  "@keyframes spin { to { transform: rotate(360deg); } }",
  ".app-layout { display: flex; min-height: 100vh; }",
  ".app-nav { width: 224px; flex-shrink: 0; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; transition: transform 0.25s ease; z-index: 200; }",
  ".emp-nav { width: 200px; }",
  ".hamburger-btn { display: none; position: fixed; top: 12px; left: 12px; z-index: 300; background: #161B2A; border: 1px solid #1E2740; color: #E2E8F0; border-radius: 8px; padding: 8px 11px; font-size: 18px; cursor: pointer; line-height: 1; }",
  ".nav-overlay { display: none; position: fixed; inset: 0; z-index: 199; background: rgba(0,0,0,0.6); }",
  ".nav-overlay.open { display: block; }",
  ".main-content { flex: 1; padding: 32px 36px; overflow-y: auto; max-width: calc(100vw - 224px); }",
  ".emp-main { flex: 1; padding: 32px 36px; overflow-y: auto; }",
  ".resp-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }",
  ".mobile-top-bar { display: none; height: 52px; align-items: center; padding: 0 16px; z-index: 150; }",
  "@media (max-width: 1023px) { .app-nav { width: 200px; } .emp-nav { width: 180px; } .main-content { padding: 24px 20px; max-width: calc(100vw - 200px); } .emp-main { padding: 24px 20px; } }",
  "@media (max-width: 767px) { .hamburger-btn { display: block; } .mobile-top-bar { display: flex; position: fixed; top: 0; left: 0; right: 0; width: 100%; } .app-nav { position: fixed; top: 0; left: 0; height: 100vh; width: 240px !important; transform: translateX(-100%); box-shadow: 4px 0 24px rgba(0,0,0,0.5); } .app-nav.nav-open { transform: translateX(0); } .main-content { padding: 70px 14px 24px; max-width: 100vw; width: 100%; } .emp-main { padding: 70px 14px 24px; } }",
  /* ── Responsive utility classes ─────────────────────────────── */
  ".grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }",
  ".grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }",
  ".grid-2 { display: grid; grid-template-columns: 1fr 1fr; }",
  ".page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }",
  ".tab-bar { display: flex; gap: 4px; overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; }",
  /* Tablet (≤1199px) */
  "@media (max-width: 1199px) { .grid-4 { grid-template-columns: repeat(2,1fr) !important; } }",
  /* Large tablet (≤1023px) */
  "@media (max-width: 1023px) { .grid-3 { grid-template-columns: repeat(2,1fr) !important; } }",
  /* Mobile (≤767px) */
  "@media (max-width: 767px) {",
  "  .grid-3 { grid-template-columns: 1fr !important; }",
  "  .grid-4 { grid-template-columns: repeat(2,1fr) !important; }",
  "  .grid-2 { grid-template-columns: 1fr !important; }",
  "  .page-header { flex-direction: column; align-items: flex-start; }",
  "  .page-header > * { width: 100%; }",
  "  .page-header > button, .page-header > div > button { width: auto !important; }",
  "  .mobile-top-bar-title { font-size: 15px !important; }",
  "  .resp-table-wrap table { min-width: 600px; }",
  /* Nav close button inside mobile sidebar */
  "  .nav-close-btn { display: flex !important; }",
  /* Reduce font sizes slightly for very small screens */
  "  h2 { font-size: 18px !important; }",
  "  .recharts-wrapper { font-size: 11px; }",
  /* Make modal padding smaller on mobile */
  "  .modal-body { padding: 20px 16px !important; }",
  /* Make tab bar wrap on tiny screens */
  "  .tab-bar { flex-wrap: wrap !important; }",
  /* Ensure inputs are full-width on mobile */
  "  input[type='text'], input[type='email'], input[type='password'], input[type='number'], input[type='date'], select, textarea { width: 100% !important; box-sizing: border-box !important; }",
  "}",
  "@media print { ",
  "  body * { visibility: hidden; }",
  "  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }",
  "  #capture-resume, #capture-resume *, #invoice-print-area, #invoice-print-area * { visibility: visible; }",
  "  #capture-resume, #invoice-print-area { position: relative !important; width: 100%; height: auto !important; margin: 0; padding: 0 !important; box-shadow: none !important; }",
  "  @page { margin: 0; }",
  "  .print-footer { display: block !important; }",
  "  .print-footer .pageNumber::after { content: counter(page); }",
  "}"
].join("\n");



export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const t = localStorage.getItem("pp_token"); const u = localStorage.getItem("pp_user");
      return t && u ? JSON.parse(u) : null;
    } catch { return null; }
  });
  const [page, setPage] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const nav = (p) => { setPage(p); setNavOpen(false); };

  useEffect(() => {
    function onSessionExpired() { setCurrentUser(null); setPage("dashboard"); }
    window.addEventListener("pp_session_expired", onSessionExpired);
    return () => window.removeEventListener("pp_session_expired", onSessionExpired);
  }, []);

  async function handleLogin(username, password) {
    const data = await api.login(username, password);
    localStorage.setItem("pp_token", data.access_token);
    localStorage.setItem("pp_user", JSON.stringify(data.user));
    setCurrentUser(data.user);
    setPage(data.user.role === "admin" ? "dashboard" : data.user.role === "manager" ? "mywork" : "employee-home");
  }

  function handleLogout() {
    localStorage.removeItem("pp_token"); localStorage.removeItem("pp_user");
    setCurrentUser(null); setPage("dashboard");
  }

  if (!currentUser) return (<><style>{STYLE}</style><LoginPage onLogin={handleLogin} /></>);

  const isAdmin = currentUser.role === "admin" || currentUser.role === "manager";
  const isManager = currentUser.role === "manager";

  if (!isAdmin) return (
    <><DialogProvider />
    <div className="app-layout" style={{ background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <style>{STYLE}</style>
      {/* Hamburger button */}
      <button className="hamburger-btn" onClick={() => setNavOpen(v => !v)}>☰</button>
      {/* Mobile top bar */}
      <div className="mobile-top-bar" style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, gap: 10 }}>
        <div style={{ width: 36 }} />
        <div style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 700, color: C.text, className: "mobile-top-bar-title" }}>
          {currentUser.emp_name || currentUser.username}
        </div>
        <Avatar initials={currentUser.avatar || mkAvi(currentUser.emp_name || "")} color={C.accent} size={26} />
      </div>
      {/* Overlay */}
      <div className={`nav-overlay${navOpen ? " open" : ""}`} onClick={() => setNavOpen(false)} />
      <nav className={`app-nav emp-nav${navOpen ? " nav-open" : ""}`} style={{
        background: C.surface, borderRight: `1px solid ${C.border}`, padding: "24px 0"
      }}>
        <div style={{ padding: "0 16px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <img src="/image.png" alt="Logo" style={{ height: 60, objectFit: "contain" }} />
            <button className="nav-close-btn" onClick={() => setNavOpen(false)} style={{
              display: "none", position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
              background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMuted,
              fontSize: 16, cursor: "pointer", padding: "2px 8px", lineHeight: 1
            }}>✕</button>
          </div>
        </div>
        <div style={{ padding: "14px 10px", flex: 1 }}>
          <button onClick={() => nav("employee-home")} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px",
            borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", marginBottom: 2,
            background: (page === "employee-home" || page === "dashboard") ? C.accentGlow : "transparent",
            color: (page === "employee-home" || page === "dashboard") ? C.accent : C.textMuted,
            fontWeight: (page === "employee-home" || page === "dashboard") ? 700 : 500, fontSize: 13,
            borderLeft: (page === "employee-home" || page === "dashboard") ? `2px solid ${C.accent}` : "2px solid transparent"
          }}>🏠 My Portal</button>

          <button onClick={() => nav("resumes")} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px",
            borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
            background: page === "resumes" ? C.accentGlow : "transparent",
            color: page === "resumes" ? C.accent : C.textMuted,
            fontWeight: page === "resumes" ? 700 : 500, fontSize: 13,
            borderLeft: page === "resumes" ? `2px solid ${C.accent}` : "2px solid transparent"
          }}>📑 Generate Company Resume</button>
        </div>
        <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
            <Avatar initials={currentUser.avatar || mkAvi(currentUser.emp_name || "")} color={C.accent} size={30} />
            <div><div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{currentUser.emp_name || currentUser.username}</div>
              <div style={{ fontSize: 10, color: C.textMuted }}>Employee</div></div>
          </div>
          <Btn variant="ghost" onClick={handleLogout} style={{ width: "100%", justifyContent: "center", fontSize: 12 }}>↩ Sign Out</Btn>
        </div>
      </nav>
      <main className="emp-main">
        {(page === "employee-home" || page === "dashboard") && <EmployeeHome currentUser={currentUser} />}
        {page === "resumes" && <AdminCompanyResume />}
      </main>
    </div>
    </>
  );

  return (
    <><DialogProvider />
    <div className="app-layout" style={{ background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <style>{STYLE}</style>
      {/* Hamburger button */}
      <button className="hamburger-btn" onClick={() => setNavOpen(v => !v)}>☰</button>
      {/* Mobile top bar */}
      <div className="mobile-top-bar" style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, gap: 10 }}>
        <div style={{ width: 36 }} />
        <div style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 700, color: C.text }}>
          {currentUser.role === "admin" ? "Admin Panel" : currentUser.role === "manager" ? "Manager Panel" : currentUser.emp_name || currentUser.username}
        </div>
        <Avatar initials={currentUser.avatar || mkAvi(currentUser.emp_name || "")} color={currentUser.role === "manager" ? C.green : C.purple} size={26} />
      </div>
      {/* Overlay */}
      <div className={`nav-overlay${navOpen ? " open" : ""}`} onClick={() => setNavOpen(false)} />
      <nav className={`app-nav${navOpen ? " nav-open" : ""}`} style={{
        background: C.surface, borderRight: `1px solid ${C.border}`, padding: "24px 0"
      }}>
        <div style={{ padding: "0 20px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <img src="/image.png" alt="Logo" style={{ height: 60, objectFit: "contain" }} />
            <button className="nav-close-btn" onClick={() => setNavOpen(false)} style={{
              display: "none", position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
              background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMuted,
              fontSize: 16, cursor: "pointer", padding: "2px 8px", lineHeight: 1
            }}>✕</button>
          </div>
        </div>
        {currentUser.role === "admin" && (
          <div style={{ margin: "12px 12px 4px", background: C.purple + "18", border: `1px solid ${C.purple}33`, borderRadius: 8, padding: "6px 12px" }}>
            <div style={{ fontSize: 10, color: C.purple, fontWeight: 700, letterSpacing: .5, textTransform: "uppercase" }}>🔑 Administrator</div>
          </div>
        )}
        {currentUser.role === "manager" && (
          <div style={{ margin: "12px 12px 4px", background: C.green + "18", border: `1px solid ${C.green}33`, borderRadius: 8, padding: "6px 12px" }}>
            <div style={{ fontSize: 10, color: C.green, fontWeight: 700, letterSpacing: .5, textTransform: "uppercase" }}>📋 Manager</div>
          </div>
        )}
        <div style={{ padding: "8px 10px", flex: 1, overflowY: "auto" }}>
          {currentUser.role === "manager" && (
            <button onClick={() => nav("mywork")} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 12px",
              marginBottom: 2, borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
              background: page === "mywork" ? C.accentGlow : "transparent",
              color: page === "mywork" ? C.accent : C.textMuted,
              fontWeight: page === "mywork" ? 700 : 500, fontSize: 13,
              borderLeft: page === "mywork" ? `2px solid ${C.accent}` : "2px solid transparent"
            }}><span style={{ fontSize: 14 }}>👤</span><span>My Work</span></button>
          )}
          {ADMIN_NAV.filter(n =>
            isManager
              ? ["attendance", "documents", "resumes"].includes(n.id)
              : true
          ).map(n => {
            const active = page === n.id;
            return (<button key={n.id} onClick={() => nav(n.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 12px",
              borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2, textAlign: "left",
              background: active ? C.accentGlow : "transparent", color: active ? C.accent : C.textMuted,
              fontWeight: active ? 700 : 500, fontSize: 13, transition: "all .15s",
              borderLeft: active ? `2px solid ${C.accent}` : "2px solid transparent"
            }}><span style={{ fontSize: 14, opacity: active ? 1 : .7 }}>{n.icon}</span><span style={{ flex: 1 }}>{n.label}</span></button>);
          })}
        </div>
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <Avatar initials={currentUser.avatar || mkAvi(currentUser.emp_name || "")} color={currentUser.role === "manager" ? C.green : C.purple} size={30} />
            <div><div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{currentUser.emp_name || currentUser.username}</div>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "capitalize" }}>{currentUser.role}</div></div>
          </div>
          <Btn variant="ghost" onClick={handleLogout} style={{ width: "100%", justifyContent: "center", fontSize: 12 }}>↩ Sign Out</Btn>
        </div>
      </nav>
      <main className="main-content">
        {page === "dashboard" && <Dashboard />}
        {page === "project_management" && <ProjectManagement readOnly={isManager} currentUser={currentUser} />}
        {page === "people" && <PeopleHub readOnly={isManager} currentUser={currentUser} />}
        {page === "attendance" && <AttendanceClaims currentUser={currentUser} />}
        {page === "payslips" && !isManager && <AdminPayslips />}
        {page === "reports" && <Reports />}
        {page === "useraccounts" && <UserAccounts />}
        {page === "documents" && <DocumentGrid type="document" allowEdit={isAdmin} />}
        {page === "policies" && <DocumentGrid type="policy" allowEdit={currentUser.role === "admin"} />}
        {page === "resumes" && <AdminCompanyResume />}
        {page === "subscriptions" && <SubscriptionManagement />}
        {page === "onboard" && <OnboardEmployee />}
        {page === "compensation" && currentUser.role === "admin" && <CompensationDetails />}
        {page === "infra" && currentUser.role === "admin" && <AdminAssets />}
        {page === "mywork" && <EmployeeHome currentUser={currentUser} />}
      </main>
    </div>
    </>
  );
}
