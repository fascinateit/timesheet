// src/App.js  –  ProjectPulse (API-connected)
import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip } from "recharts";
import { api } from "./api";

// ── Design Tokens ────────────────────────────────────────────────────────────
const DARK = {
  bg: "#0A0D14", surface: "#111520", card: "#161B2A", border: "#1E2740",
  accent: "#3B82F6", accentGlow: "rgba(59,130,246,0.18)", accentDim: "#1D4ED8",
  green: "#10B981", amber: "#F59E0B", red: "#EF4444", purple: "#8B5CF6",
  text: "#E2E8F0", textMuted: "#64748B", textDim: "#94A3B8",
  _nav: "linear-gradient(180deg,#0D1119 0%,#0F1420 100%)",
  _navSection: "#2A3550", _navItem: "#4A5A7A", _navHover: "#8899BB",
};
const LIGHT = {
  bg: "#F1F5F9", surface: "#FFFFFF", card: "#F8FAFC", border: "#CBD5E1",
  accent: "#2563EB", accentGlow: "rgba(37,99,235,0.15)", accentDim: "#1D4ED8",
  green: "#059669", amber: "#D97706", red: "#DC2626", purple: "#7C3AED",
  text: "#0F172A", textMuted: "#64748B", textDim: "#475569",
  _nav: "linear-gradient(180deg,#F8FAFC 0%,#F1F5F9 100%)",
  _navSection: "#94A3B8", _navItem: "#64748B", _navHover: "#1E293B",
};
// Mutable token object — Object.assign'd at render time by App
const C = { ...DARK };

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n || 0);
const fmtD = d => { try { const dt = (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) ? new Date(d.slice(0, 10) + "T00:00:00") : new Date(d); return dt.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d || "—"; } };
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

const PaginationControls = ({ page, setPage, perPage, setPerPage, total }) => {
  const totalPages = Math.ceil(total / perPage) || 1;
  if (total === 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", borderTop: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: C.textMuted }}>Rows per page:</span>
        <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
          style={{ padding: "4px 8px", borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`, color: C.text, fontSize: 12, outline: "none", cursor: "pointer" }}>
          {[10, 15, 20, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize: 12, color: C.textMuted }}>
          Showing {Math.min((page - 1) * perPage + 1, total)} to {Math.min(page * perPage, total)} of {total}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Btn small variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Btn>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, padding: "4px 8px" }}>Page {page} of {totalPages}</span>
        <Btn small variant="ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Btn>
      </div>
    </div>
  );
};

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
        onOk: () => { _setDialogState(null); resolve(true); },
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
const CLIENT_COLORS = [C.accent, C.green, C.purple, C.amber, "#f97316", "#ec4899", "#06b6d4", "#84cc16"];
const clientColor = idx => CLIENT_COLORS[idx % CLIENT_COLORS.length];

function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("cards");
  // Pagination
  const [cliPage, setCliPage] = useState(1);
  const [cliPerPage, setCliPerPage] = useState(10);

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
    if (!await dialog.confirm("Delete this client? This cannot be undone.", { dtype: "warning" })) return;
    try { await api.deleteClient(id); load(); }
    catch (e) { dialog.alert("Error: " + e.message, { title: "Error", dtype: "error" }); }
  };

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  const filtered = clients.filter(c =>
    !search ||
    c.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.gst_number?.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, fontSize: 14, pointerEvents: "none" }}>🔍</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setCliPage(1); }}
            placeholder="Search by name, email or GST…"
            style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "9px 12px 9px 36px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            {[["cards", "⊞ Cards"], ["table", "☰ Table"]].map(([m, lbl]) => (
              <button key={m} onClick={() => setViewMode(m)} style={{
                padding: "7px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                background: viewMode === m ? C.accent : "transparent",
                color: viewMode === m ? "#fff" : C.textMuted, transition: "all .2s",
              }}>{lbl}</button>
            ))}
          </div>
          <Btn onClick={() => setModal("new")}>+ Add Client</Btn>
        </div>
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: "60px 20px", textAlign: "center", color: C.textMuted, background: C.card, borderRadius: 16, border: `1px solid ${C.border}` }}>
          {search ? `No clients match "${search}".` : "No clients yet. Add your first client above."}
        </div>
      )}

      {/* ── Card Grid View ── */}
      {viewMode === "cards" && filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {filtered.slice((cliPage - 1) * cliPerPage, cliPage * cliPerPage).map((c, idx) => (
            <div key={c.id} style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
              overflow: "hidden", transition: "transform .15s, box-shadow .15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 28px ${clientColor(idx)}20`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
            >
              {/* Header strip */}
              <div style={{
                background: `linear-gradient(135deg, ${clientColor(idx)}22, ${clientColor(idx)}08)`,
                borderBottom: `1px solid ${C.border}`, padding: "16px 20px",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{
                  width: 50, height: 50, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, ${clientColor(idx)}, ${clientColor(idx)}99)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 800, color: "#fff",
                  boxShadow: `0 4px 14px ${clientColor(idx)}44`,
                }}>{mkAvi(c.client_name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.client_name}</div>
                  {c.gst_number
                    ? <Badge color={C.green}>{c.gst_number}</Badge>
                    : <span style={{ fontSize: 11, color: C.textMuted, background: C.surface, borderRadius: 4, padding: "2px 7px", border: `1px solid ${C.border}` }}>No GST</span>
                  }
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 9 }}>
                {c.email && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: C.textMuted, width: 18, textAlign: "center" }}>✉</span>
                    <a href={`mailto:${c.email}`} style={{ color: C.accent, fontSize: 13, textDecoration: "none" }}>{c.email}</a>
                  </div>
                )}
                {c.phone_number && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: C.textMuted, width: 18, textAlign: "center" }}>📞</span>
                    <a href={`tel:${c.phone_number}`} style={{ color: C.text, fontSize: 13, textDecoration: "none" }}>{c.phone_number}</a>
                  </div>
                )}
                {c.address && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 13, color: C.textMuted, width: 18, textAlign: "center", marginTop: 1 }}>📍</span>
                    <span style={{ color: C.textDim, fontSize: 12, lineHeight: 1.5 }}>{c.address}</span>
                  </div>
                )}
                {c.pay_day && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: C.textMuted, width: 18, textAlign: "center" }}>📅</span>
                    <span style={{ fontSize: 12, color: C.textDim }}>Expected payment</span>
                    <Badge color={C.purple}>Day {c.pay_day}</Badge>
                  </div>
                )}
                {!c.email && !c.phone_number && !c.address && !c.pay_day && (
                  <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>No contact details recorded.</div>
                )}
              </div>

              {/* Footer actions */}
              <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 16px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Btn small variant="ghost" onClick={() => setModal(c)}>✏ Edit</Btn>
                <Btn small variant="danger" onClick={() => del(c.id)}>🗑 Delete</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table View ── */}
      {viewMode === "table" && filtered.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: C.surface }}>
                <tr><Th>Client</Th><Th>Email</Th><Th>Phone</Th><Th>Address</Th><Th>GST Number</Th><Th>Pay Day</Th><Th>Actions</Th></tr>
              </thead>
              <tbody>
                {filtered.slice((cliPage - 1) * cliPerPage, cliPage * cliPerPage).map((c, idx) => (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                    <Td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                          background: `linear-gradient(135deg, ${clientColor(idx)}, ${clientColor(idx)}99)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 800, color: "#fff",
                        }}>{mkAvi(c.client_name)}</div>
                        <span style={{ fontWeight: 700, color: C.text }}>{c.client_name}</span>
                      </div>
                    </Td>
                    <Td>{c.email ? <a href={`mailto:${c.email}`} style={{ color: C.accent, textDecoration: "none", fontSize: 13 }}>{c.email}</a> : <span style={{ color: C.textMuted }}>—</span>}</Td>
                    <Td>{c.phone_number ? <a href={`tel:${c.phone_number}`} style={{ color: C.text, textDecoration: "none", fontSize: 13 }}>{c.phone_number}</a> : <span style={{ color: C.textMuted }}>—</span>}</Td>
                    <Td><span style={{ fontSize: 12, color: C.textDim }}>{c.address || "—"}</span></Td>
                    <Td>{c.gst_number ? <Badge color={C.green}>{c.gst_number}</Badge> : <span style={{ color: C.textMuted }}>—</span>}</Td>
                    <Td>{c.pay_day ? <Badge color={C.purple}>Day {c.pay_day}</Badge> : <span style={{ color: C.textMuted }}>—</span>}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Btn small variant="ghost" onClick={() => setModal(c)}>✏</Btn>
                        <Btn small variant="danger" onClick={() => del(c.id)}>🗑</Btn>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modal && (
        <Modal title={modal === "new" ? "Add Client" : "Edit Client"} onClose={() => setModal(null)}>
          <ClientForm
            init={modal === "new" ? { client_name: "", email: "", phone_number: "", address: "", pay_day: "", gst_number: "" } : modal}
            saving={saving} onCancel={() => setModal(null)} onSave={save}
          />
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

// ── Shared SVG ring gauge ────────────────────────────────────────────────────
const Ring = ({ pct, color, size = 64, stroke = 6 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray .5s ease" }} />
    </svg>
  );
};
const PALETTE = [C.accent, C.green, C.purple, "#f97316", "#ec4899", "#06b6d4", "#84cc16"];

// ════════════════════════════════════════════════════════
// PROJECT MANAGEMENT & INVOICES
function ProjectDashboard({ projects, invoices }) {
  const [filterStr, setFilterStr] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [tdsEdits, setTdsEdits] = useState({});     // { clientName: overrideAmount }
  const [editingTds, setEditingTds] = useState(null); // clientName being edited
  const [tdsInput, setTdsInput] = useState("");
  const [tdsExpectedOverride, setTdsExpectedOverride] = useState(null); // override for global Expected chip
  const [editingTdsExpected, setEditingTdsExpected] = useState(false);
  const [tdsExpectedInput, setTdsExpectedInput] = useState("");

  const filtered = projects.filter(p => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterStr && !p.name.toLowerCase().includes(filterStr.toLowerCase()) && !p.code.toLowerCase().includes(filterStr.toLowerCase())) return false;
    return true;
  });

  // ── Global aggregates ─────────────────────────────────────────────────
  const totalBudget  = projects.reduce((a, p) => p.status === "active" ? a + parseFloat(p.budget || 0) : a, 0);
  const totalBurned  = projects.reduce((a, p) => p.status === "active" ? a + parseFloat(p.burned || 0) : a, 0);
  const rootInvs     = invoices.filter(i => !i.parent_invoice_id);
  const totalRaised  = rootInvs.reduce((a, i) => a + parseFloat(i.amount || 0), 0);
  const totalTdsSum  = rootInvs.reduce((a, i) => a + parseFloat(i.tds_amount || 0), 0);
  const tdsDeducted  = rootInvs.filter(i => i.status === "cleared").reduce((a, i) => a + parseFloat(i.tds_amount || 0), 0);
  const tdsExpected  = rootInvs.filter(i => i.status !== "cleared").reduce((a, i) => a + parseFloat(i.tds_amount || 0), 0);
  const totalCleared = rootInvs.filter(i => i.status === "cleared").reduce((a, i) => a + (parseFloat(i.amount || 0) - parseFloat(i.tds_amount || 0)), 0)
                     + rootInvs.filter(i => i.status === "partial").reduce((a, i) => a + parseFloat(i.payment_received || 0), 0);
  const totalPending = rootInvs.filter(i => i.status === "partial").reduce((a, i) => a + parseFloat(i.balance_amount || 0), 0)
                     + rootInvs.filter(i => i.status === "pending").reduce((a, i) => a + parseFloat(i.amount || 0), 0);
  const collectPct   = (totalRaised - totalTdsSum) > 0 ? Math.min(Math.round((totalCleared / (totalRaised - totalTdsSum)) * 100), 100) : 0;
  const activeCount  = projects.filter(p => p.status === "active").length;
  const pendingCount = rootInvs.filter(i => i.status !== "cleared").length;

  // ── Chart helpers ─────────────────────────────────────────────────────
  const tooltipStyle = { backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" };
  const tickFmt = v => `₹${v >= 100000 ? (v / 100000).toFixed(1) + "L" : v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`;

  // ── Per-client aggregates ─────────────────────────────────────────────
  const clientStats = {};
  invoices.forEach(inv => {
    if (inv.parent_invoice_id) return; // BAL invoices are tracked via balance_amount on the parent
    const key = inv.client_name || "Unknown";
    if (!clientStats[key]) clientStats[key] = { name: key, raised: 0, cleared: 0, pending: 0, count: 0, tds: 0 };
    const amt = parseFloat(inv.amount || 0);
    const tds = parseFloat(inv.tds_amount || 0);
    clientStats[key].raised += amt;
    clientStats[key].tds += tds;
    clientStats[key].count += 1;
    if (inv.status === "cleared") {
      clientStats[key].cleared += amt - tds; // full settled value (BAL payments included via invoice amount)
    } else if (inv.status === "partial") {
      clientStats[key].cleared += parseFloat(inv.payment_received || 0);
      clientStats[key].pending += parseFloat(inv.balance_amount || 0);
    } else {
      clientStats[key].pending += amt;
    }
  });
  const clientList = Object.values(clientStats).sort((a, b) => b.raised - a.raised);

  // ── Chart data ────────────────────────────────────────────────────────
  const budgetChartData = filtered.filter(p => p.status === "active").map(p => ({
    name: p.code, fullName: p.name,
    Budget: parseFloat(p.budget || 0),
    Raised: invoices.filter(i => i.project_id === p.id && !i.parent_invoice_id).reduce((s, i) => s + parseFloat(i.amount || 0), 0),
    Burned: parseFloat(p.burned || 0),
  }));

  const projectInvData = filtered.map(p => {
    const pInvs = invoices.filter(i => i.project_id === p.id && !i.parent_invoice_id);
    return {
      name: p.code, fullName: p.name,
      Raised:  pInvs.reduce((s, i) => s + parseFloat(i.amount || 0), 0),
      Cleared: pInvs.filter(i => i.status === "cleared").reduce((s, i) => s + (parseFloat(i.amount || 0) - parseFloat(i.tds_amount || 0)), 0)
             + pInvs.filter(i => i.status === "partial").reduce((s, i) => s + parseFloat(i.payment_received || 0), 0),
      Pending: pInvs.filter(i => i.status === "partial").reduce((s, i) => s + parseFloat(i.balance_amount || 0), 0)
             + pInvs.filter(i => i.status === "pending").reduce((s, i) => s + parseFloat(i.amount || 0), 0),
    };
  }).filter(d => d.Raised > 0);

  const clientInvData = clientList.map(cl => ({
    name: cl.name.length > 14 ? cl.name.slice(0, 14) + "…" : cl.name,
    fullName: cl.name, Raised: cl.raised, Cleared: cl.cleared, Pending: cl.pending,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── SECTION 1: Hero KPI row ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>

        {/* Card: Total Budget */}
        <div style={{ background: `linear-gradient(135deg, ${C.surface} 0%, ${C.card} 100%)`, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.accent}`, borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${C.accent}15 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6 }}>Total Client Budget</div>
            <span style={{ background: C.accent + "22", color: C.accent, borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 800 }}>{activeCount} active</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: -.5 }}>{fmt$(totalBudget)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 4, background: C.border, overflow: "hidden" }}>
              <div style={{ width: `${totalBudget > 0 ? Math.min((totalBurned / totalBudget) * 100, 100) : 0}%`, height: "100%", background: `linear-gradient(90deg, ${C.accent}, ${C.purple})`, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>{totalBudget > 0 ? Math.round((totalBurned / totalBudget) * 100) : 0}% utilized</span>
          </div>
        </div>

        {/* Card: Total Raised */}
        <div style={{ background: `linear-gradient(135deg, ${C.surface} 0%, ${C.card} 100%)`, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.green}`, borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${C.green}15 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6 }}>Total Raised</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.green, letterSpacing: -.5 }}>{fmt$(totalRaised)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div style={{ background: C.green + "12", borderRadius: 7, padding: "6px 10px", border: `1px solid ${C.green}28` }}>
              <div style={{ fontSize: 9, color: C.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Cleared</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.green, marginTop: 2 }}>{fmt$(totalCleared)}</div>
            </div>
            <div style={{ background: C.amber + "12", borderRadius: 7, padding: "6px 10px", border: `1px solid ${C.amber}28` }}>
              <div style={{ fontSize: 9, color: C.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Pending</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.amber, marginTop: 2 }}>{fmt$(totalPending)}</div>
            </div>
          </div>
        </div>

        {/* Card: Collection Rate */}
        <div style={{ background: `linear-gradient(135deg, ${C.surface} 0%, ${C.card} 100%)`, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.purple}`, borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6 }}>Collection Rate</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Ring pct={collectPct} color={collectPct >= 80 ? C.green : collectPct >= 50 ? C.accent : C.amber} size={64} stroke={6} />
              <div style={{ position: "absolute", fontSize: 13, fontWeight: 900, color: C.text }}>{collectPct}%</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 11, color: C.textMuted }}>
                <span style={{ color: C.green, fontWeight: 700 }}>{invoices.filter(i => i.status === "cleared").length}</span> cleared
              </div>
              <div style={{ fontSize: 11, color: C.textMuted }}>
                <span style={{ color: C.amber, fontWeight: 700 }}>{pendingCount}</span> pending
              </div>
              <div style={{ fontSize: 11, color: C.textMuted }}>
                <span style={{ color: C.textDim, fontWeight: 700 }}>{invoices.length}</span> total
              </div>
            </div>
          </div>
        </div>

        {/* Card: TDS Summary */}
        {totalTdsSum > 0 && (
          <div style={{ background: `linear-gradient(135deg, ${C.surface} 0%, ${C.card} 100%)`, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.red}`, borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${C.red}15 0%, transparent 70%)`, pointerEvents: "none" }} />
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6 }}>Total TDS (10%)</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.red, letterSpacing: -.5 }}>{fmt$(totalTdsSum)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div style={{ background: C.red + "12", borderRadius: 7, padding: "6px 10px", border: `1px solid ${C.red}28` }}>
                <div style={{ fontSize: 9, color: C.red, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Deducted</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginTop: 2 }}>{fmt$(tdsDeducted)}</div>
              </div>
              <div style={{ background: C.amber + "12", borderRadius: 7, padding: "6px 10px", border: `1px solid ${C.amber}28` }}>
                <div style={{ fontSize: 9, color: C.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, display: "flex", alignItems: "center", gap: 4 }}>
                  Expected
                  {!editingTdsExpected && (
                    <span title="Enter expected TDS" style={{ cursor: "pointer", opacity: 0.65, fontSize: 9 }}
                      onClick={() => { setEditingTdsExpected(true); setTdsExpectedInput(String(tdsExpectedOverride ?? tdsExpected)); }}>✏</span>
                  )}
                </div>
                {editingTdsExpected ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                    <input type="number" value={tdsExpectedInput} onChange={e => setTdsExpectedInput(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === "Enter") { setTdsExpectedOverride(parseFloat(tdsExpectedInput) || 0); setEditingTdsExpected(false); } if (e.key === "Escape") setEditingTdsExpected(false); }}
                      style={{ flex: 1, width: 0, background: C.bg, border: `1px solid ${C.amber}`, borderRadius: 4, color: C.text, padding: "2px 4px", fontSize: 11, outline: "none", textAlign: "center" }} />
                    <span style={{ cursor: "pointer", color: C.green, fontWeight: 900, fontSize: 12 }} onClick={() => { setTdsExpectedOverride(parseFloat(tdsExpectedInput) || 0); setEditingTdsExpected(false); }}>✓</span>
                    <span style={{ cursor: "pointer", color: C.red, fontWeight: 900, fontSize: 12 }} onClick={() => setEditingTdsExpected(false)}>✕</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.amber, marginTop: 2 }}>{fmt$(tdsExpectedOverride ?? tdsExpected)}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Card: Burned Cost */}
        <div style={{ background: `linear-gradient(135deg, ${C.surface} 0%, ${C.card} 100%)`, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.amber}`, borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${C.amber}15 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6 }}>Burned Cost</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.amber, letterSpacing: -.5 }}>{fmt$(totalBurned)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted }}>
              <span>vs Budget</span>
              <span style={{ fontWeight: 700, color: totalBurned > totalBudget ? C.red : C.textDim }}>
                {totalBudget > 0 ? Math.round((totalBurned / totalBudget) * 100) : 0}%
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 4, background: C.border, overflow: "hidden" }}>
              <div style={{ width: `${totalBudget > 0 ? Math.min((totalBurned / totalBudget) * 100, 100) : 0}%`, height: "100%", background: `linear-gradient(90deg, ${C.amber}, ${C.red})`, borderRadius: 4 }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Client Invoice KPI Cards ─────────────────────────── */}
      {clientList.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 3, height: 18, background: `linear-gradient(180deg, ${C.accent}, ${C.purple})`, borderRadius: 2 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Client Invoice Overview</span>
            <span style={{ background: C.accent + "1a", color: C.accent, borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 700 }}>{clientList.length} clients</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {clientList.map((cl, idx) => {
              const netRaised = cl.raised - cl.tds;
              const pct = netRaised > 0 ? Math.min(Math.round((cl.cleared / netRaised) * 100), 100) : 0;
              const col = PALETTE[idx % PALETTE.length];
              const hColor = pct === 100 ? C.green : pct >= 60 ? C.accent : C.amber;
              const initials = cl.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div key={cl.name} style={{
                  background: `linear-gradient(145deg, ${C.surface}, ${C.card})`,
                  border: `1px solid ${hColor}33`,
                  borderRadius: 16, padding: "18px 20px",
                  display: "flex", flexDirection: "column", gap: 14,
                  position: "relative", overflow: "hidden"
                }}>
                  {/* Ambient glow */}
                  <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${col}12 0%, transparent 70%)`, pointerEvents: "none" }} />

                  {/* Row 1: avatar + name + badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, zIndex: 1 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${col}33, ${col}15)`, border: `1.5px solid ${col}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: col, flexShrink: 0 }}>{initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cl.name}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{cl.count} invoice{cl.count !== 1 ? "s" : ""}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <Ring pct={pct} color={hColor} size={40} stroke={4} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: hColor }}>{pct}%</span>
                    </div>
                  </div>

                  {/* Row 2: stat chips */}
                  <div style={{ display: "grid", gridTemplateColumns: cl.tds > 0 ? "1fr 1fr" : "1fr 1fr 1fr", gap: 7, zIndex: 1 }}>
                    <div style={{ background: C.bg, borderRadius: 9, padding: "8px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Raised</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.text, marginTop: 3 }}>{fmt$(cl.raised)}</div>
                    </div>
                    {cl.tds > 0 && (
                      <div style={{ background: C.red + "0e", borderRadius: 9, padding: "8px", border: `1px solid ${C.red}2a`, textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: C.red, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          TDS (10%)
                          {editingTds !== cl.name && (
                            <span title="Edit expected TDS" style={{ cursor: "pointer", opacity: 0.6, fontSize: 9 }} onClick={() => { setEditingTds(cl.name); setTdsInput(String(tdsEdits[cl.name] ?? cl.tds)); }}>✏</span>
                          )}
                        </div>
                        {editingTds === cl.name ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                            <input type="number" value={tdsInput} onChange={e => setTdsInput(e.target.value)} autoFocus
                              onKeyDown={e => { if (e.key === "Enter") { setTdsEdits(p => ({ ...p, [cl.name]: parseFloat(tdsInput) || 0 })); setEditingTds(null); } if (e.key === "Escape") setEditingTds(null); }}
                              style={{ flex: 1, width: 0, background: C.bg, border: `1px solid ${C.red}`, borderRadius: 4, color: C.text, padding: "2px 4px", fontSize: 11, outline: "none", textAlign: "center" }} />
                            <span style={{ cursor: "pointer", color: C.green, fontWeight: 900, fontSize: 12 }} onClick={() => { setTdsEdits(p => ({ ...p, [cl.name]: parseFloat(tdsInput) || 0 })); setEditingTds(null); }}>✓</span>
                            <span style={{ cursor: "pointer", color: C.red, fontWeight: 900, fontSize: 12 }} onClick={() => setEditingTds(null)}>✕</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginTop: 3 }}>{fmt$(tdsEdits[cl.name] ?? cl.tds)}</div>
                        )}
                      </div>
                    )}
                    <div style={{ background: C.green + "0e", borderRadius: 9, padding: "8px", border: `1px solid ${C.green}2a`, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Cleared</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.green, marginTop: 3 }}>{fmt$(cl.cleared)}</div>
                    </div>
                    <div style={{ background: C.amber + "0e", borderRadius: 9, padding: "8px", border: `1px solid ${C.amber}2a`, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Pending</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.amber, marginTop: 3 }}>{fmt$(cl.pending)}</div>
                    </div>
                  </div>

                  {/* Row 3: stacked bar */}
                  <div style={{ zIndex: 1 }}>
                    <div style={{ height: 6, borderRadius: 6, background: C.border, overflow: "hidden", display: "flex" }}>
                      <div style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${hColor === C.green ? C.green : C.accent}, ${C.green})`, transition: "width .4s ease" }} />
                      <div style={{ flex: 1, background: C.amber + "55" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10, color: C.textMuted }}>
                      <span>Clearance progress</span>
                      <span style={{ fontWeight: 700, color: hColor }}>{pct}% cleared</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 3: Project Cards ─────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Header + filters inline */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ width: 3, height: 18, background: `linear-gradient(180deg, ${C.amber}, ${C.accent})`, borderRadius: 2 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Project Breakdown</span>
          <div style={{ flex: 1 }} />
          <input type="text" placeholder="Search projects…" value={filterStr} onChange={e => setFilterStr(e.target.value)}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "7px 12px", fontSize: 12, outline: "none", width: 200 }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "7px 12px", fontSize: 12, outline: "none", cursor: "pointer" }}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {filtered.length === 0
          ? <div style={{ padding: 48, textAlign: "center", color: C.textMuted, background: C.surface, borderRadius: 16, fontSize: 13 }}>No projects match your filters.</div>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
              {filtered.map((p, idx) => {
                const raised  = invoices.filter(i => i.project_id === p.id).reduce((s, i) => s + parseFloat(i.amount || 0), 0);
                const budget  = parseFloat(p.budget || 0);
                const burned  = parseFloat(p.burned || 0);
                const highest = Math.max(budget, raised, burned, 1);
                const isOver  = raised > budget;
                const col     = PALETTE[idx % PALETTE.length];
                const utilPct = budget > 0 ? Math.min(Math.round((raised / budget) * 100), 999) : 0;

                return (
                  <div key={p.id} style={{
                    background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 16, overflow: "hidden",
                    display: "flex", flexDirection: "column"
                  }}>
                    {/* Colored header strip */}
                    <div style={{ background: `linear-gradient(90deg, ${col}33, ${col}0a)`, borderBottom: `1px solid ${col}22`, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: col, fontWeight: 600, marginTop: 2 }}>{p.code}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <StatusBadge status={p.status} />
                        <span style={{ fontSize: 10, color: C.textMuted }}>
                          {isOver ? "⚠ Over budget" : `${fmt$(budget - raised)} pending`}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { label: "BUDGET", value: budget, color: C.accent },
                        { label: "RAISED", value: raised, color: isOver ? C.red : C.green },
                        { label: "BURNED", value: burned, color: C.amber },
                      ].map(row => (
                        <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 52, fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: .5, textAlign: "right" }}>{row.label}</div>
                          <div style={{ flex: 1, height: 8, borderRadius: 6, background: C.surface, overflow: "hidden", border: `1px solid ${C.border}` }}>
                            <div style={{ width: `${(row.value / highest) * 100}%`, height: "100%", background: row.color, borderRadius: 6, transition: "width .35s ease" }} />
                          </div>
                          <div style={{ width: 82, fontSize: 12, fontWeight: 700, color: row.color, textAlign: "right" }}>{fmt$(row.value)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Footer: utilization */}
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface }}>
                      <span style={{ fontSize: 11, color: C.textMuted }}>Budget utilization</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: isOver ? C.red : utilPct >= 85 ? C.amber : C.green }}>{utilPct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </div>

      {/* ── SECTION 4: Analytics Charts ─────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: `linear-gradient(180deg, ${C.green}, ${C.accent})`, borderRadius: 2 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Analytics</span>
        </div>

        {/* Row 1: Budget vs Raised vs Burned */}
        {budgetChartData.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Budget vs Raised vs Burned</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Active projects only</div>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                {[{ label: "Budget", color: C.accent }, { label: "Raised", color: C.green }, { label: "Burned", color: C.amber }].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textDim }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }} barGap={3}>
                  <XAxis dataKey="name" stroke={C.textMuted} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={C.textMuted} fontSize={11} tickLine={false} axisLine={false} tickFormatter={tickFmt} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ fontSize: 12, fontWeight: 700 }}
                    formatter={(v, n) => [fmt$(v), n]}
                    labelStyle={{ color: C.textDim, fontWeight: 700, fontSize: 12, marginBottom: 6 }}
                    labelFormatter={(n, pl) => pl?.[0]?.payload?.fullName || n}
                    cursor={{ fill: C.accentGlow }} />
                  <Bar dataKey="Budget" fill={C.accent} radius={[5, 5, 0, 0]} barSize={22} />
                  <Bar dataKey="Raised"  fill={C.green}  radius={[5, 5, 0, 0]} barSize={22} />
                  <Bar dataKey="Burned"  fill={C.amber}  radius={[5, 5, 0, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Row 2: Invoice Status — Project + Client side by side */}
        {invoices.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { title: "Invoice Status by Project", sub: "Raised · Cleared · Pending per project", data: projectInvData },
              { title: "Invoice Status by Client",  sub: "Raised · Cleared · Pending per client",  data: clientInvData  },
            ].map(({ title, sub, data }) => (
              <div key={title} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "22px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{sub}</div>
                </div>
                {data.length === 0
                  ? <div style={{ padding: 32, textAlign: "center", color: C.textMuted, fontSize: 12 }}>No invoice data available</div>
                  : <div style={{ width: "100%", height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 4 }} barGap={2}>
                          <XAxis dataKey="name" stroke={C.textMuted} fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke={C.textMuted} fontSize={10} tickLine={false} axisLine={false} tickFormatter={tickFmt} />
                          <Tooltip contentStyle={tooltipStyle} itemStyle={{ fontSize: 12, fontWeight: 700 }}
                            formatter={(v, n) => [fmt$(v), n]}
                            labelStyle={{ color: C.textDim, fontWeight: 700, fontSize: 12, marginBottom: 6 }}
                            labelFormatter={(n, pl) => pl?.[0]?.payload?.fullName || n}
                            cursor={{ fill: C.accentGlow }} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: C.text, paddingTop: 10 }} />
                          <Bar dataKey="Raised"  fill={C.accent} radius={[4, 4, 0, 0]} barSize={16} />
                          <Bar dataKey="Cleared" fill={C.green}  radius={[4, 4, 0, 0]} barSize={16} />
                          <Bar dataKey="Pending" fill={C.amber}  radius={[4, 4, 0, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                }
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
  const [tdsEditsTab, setTdsEditsTab] = useState({});     // { clientName: overrideAmount }
  const [editingTdsTab, setEditingTdsTab] = useState(null);
  const [tdsInputTab, setTdsInputTab] = useState("");
  const [tdsExpectedOverrideTab, setTdsExpectedOverrideTab] = useState(null);
  const [editingTdsExpectedTab, setEditingTdsExpectedTab] = useState(false);
  const [tdsExpectedInputTab, setTdsExpectedInputTab] = useState("");

  // List Filters
  const [filterProject, setFilterProject] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  // Sort
  const [sortField, setSortField] = useState("raised_date");
  const [sortDir, setSortDir] = useState("desc");
  // Pagination
  const [invPage, setInvPage] = useState(1);
  const [invPerPage, setInvPerPage] = useState(10);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

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
      setPaymentDate(isoDate(new Date()));
      const tds = parseFloat(inv.tds_amount || 0);
      const amt = parseFloat(inv.amount || 0);
      const expectedPayment = tds > 0 ? (amt - tds) : amt;
      setPaymentAmount(inv.status === "partial" && inv.balance_amount != null
        ? inv.balance_amount
        : expectedPayment.toFixed(2));
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
    a.download = `invoices-export-${isoDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && tab === "invoices") return <Spinner />;
  if (err && tab === "invoices") return <ErrBox msg={err} onRetry={load} />;

  const activeProjects = projects.filter(p => p.status === "active");
  const filteredInvoices = invoices.filter(i => {
    if (filterProject !== "all" && i.project_id.toString() !== filterProject) return false;
    if (filterClient !== "all" && i.client_id?.toString() !== filterClient) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    return true;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    let va, vb;
    if (sortField === "raised_date" || sortField === "payment_due_date") {
      va = new Date(a[sortField] || 0).getTime();
      vb = new Date(b[sortField] || 0).getTime();
    } else if (sortField === "amount") {
      va = parseFloat(a.amount || 0);
      vb = parseFloat(b.amount || 0);
    } else if (sortField === "status") {
      va = a.status || "";
      vb = b.status || "";
    } else {
      va = a[sortField] || "";
      vb = b[sortField] || "";
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const invTotalPages = Math.ceil(sortedInvoices.length / invPerPage) || 1;
  const paginatedInvoices = sortedInvoices.slice((invPage - 1) * invPerPage, invPage * invPerPage);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Project Management & Ledger</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Monitor client budgets & track company expenses or invoices</p></div>
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

      {tab === "invoices" && (() => {
        // ── Per-client aggregates for this tab ────────────────────────────
        const clientMap = {};
        invoices.forEach(inv => {
          if (inv.parent_invoice_id) return; // BAL invoices tracked via balance_amount on parent
          const key = inv.client_name || "Unknown";
          if (!clientMap[key]) clientMap[key] = { name: key, raised: 0, cleared: 0, pending: 0, count: 0, tds: 0 };
          const amt = parseFloat(inv.amount || 0);
          const tds = parseFloat(inv.tds_amount || 0);
          clientMap[key].raised += amt;
          clientMap[key].tds += tds;
          clientMap[key].count += 1;
          if (inv.status === "cleared") {
            clientMap[key].cleared += amt - tds; // full settled value (BAL payments included via invoice amount)
          } else if (inv.status === "partial") {
            clientMap[key].cleared += parseFloat(inv.payment_received || 0);
            clientMap[key].pending += parseFloat(inv.balance_amount || 0);
          } else {
            clientMap[key].pending += amt;
          }
        });
        const clientList = Object.values(clientMap).sort((a, b) => b.raised - a.raised);

        // ── Global KPI aggregates ─────────────────────────────────────────
        const rootInvList  = invoices.filter(i => !i.parent_invoice_id);
        const totalRaised  = rootInvList.reduce((a, i) => a + parseFloat(i.amount || 0), 0);
        const totalTdsList = rootInvList.reduce((a, i) => a + parseFloat(i.tds_amount || 0), 0);
        const tdsDeducted  = rootInvList.filter(i => i.status === "cleared").reduce((a, i) => a + parseFloat(i.tds_amount || 0), 0);
        const tdsExpected  = rootInvList.filter(i => i.status !== "cleared").reduce((a, i) => a + parseFloat(i.tds_amount || 0), 0);
        const totalCleared = rootInvList.filter(i => i.status === "cleared").reduce((a, i) => a + (parseFloat(i.amount || 0) - parseFloat(i.tds_amount || 0)), 0)
                           + rootInvList.filter(i => i.status === "partial").reduce((a, i) => a + parseFloat(i.payment_received || 0), 0);
        const totalPending = rootInvList.filter(i => i.status === "partial").reduce((a, i) => a + parseFloat(i.balance_amount || 0), 0)
                           + rootInvList.filter(i => i.status === "pending").reduce((a, i) => a + parseFloat(i.amount || 0), 0);
        const collectPct   = (totalRaised - totalTdsList) > 0 ? Math.min(Math.round((totalCleared / (totalRaised - totalTdsList)) * 100), 100) : 0;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* ── Row 1: Global KPI strip ──────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              {[
                { label: "Total Raised",  value: fmt$(totalRaised),  color: C.accent, sub: `${rootInvList.length} invoices` },
                { label: "Total Cleared", value: fmt$(totalCleared), color: C.green,  sub: `${rootInvList.filter(i => i.status === "cleared").length} invoices` },
                { label: "Total Pending", value: fmt$(totalPending), color: C.amber,  sub: `${rootInvList.filter(i => i.status !== "cleared").length} outstanding` },
              ].map(k => (
                <div key={k.label} style={{ background: `linear-gradient(135deg, ${C.surface}, ${C.card})`, border: `1px solid ${k.color}33`, borderLeft: `3px solid ${k.color}`, borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -16, right: -16, width: 70, height: 70, borderRadius: "50%", background: `radial-gradient(circle, ${k.color}15 0%, transparent 70%)`, pointerEvents: "none" }} />
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6 }}>{k.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: k.color, marginTop: 8, letterSpacing: -.5 }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
              {/* TDS card */}
              {totalTdsList > 0 && (
                <div style={{ background: `linear-gradient(135deg, ${C.surface}, ${C.card})`, border: `1px solid ${C.red}33`, borderLeft: `3px solid ${C.red}`, borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -16, right: -16, width: 70, height: 70, borderRadius: "50%", background: `radial-gradient(circle, ${C.red}15 0%, transparent 70%)`, pointerEvents: "none" }} />
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6 }}>Total TDS (10%)</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: C.red, marginTop: 8, letterSpacing: -.5 }}>{fmt$(totalTdsList)}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginTop: 6 }}>
                    <div style={{ background: C.red + "12", borderRadius: 6, padding: "4px 8px", border: `1px solid ${C.red}28` }}>
                      <div style={{ fontSize: 9, color: C.red, fontWeight: 700, textTransform: "uppercase" }}>Deducted</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.red, marginTop: 1 }}>{fmt$(tdsDeducted)}</div>
                    </div>
                    <div style={{ background: C.amber + "12", borderRadius: 6, padding: "4px 8px", border: `1px solid ${C.amber}28` }}>
                      <div style={{ fontSize: 9, color: C.amber, fontWeight: 700, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                        Expected
                        {!editingTdsExpectedTab && (
                          <span title="Enter expected TDS" style={{ cursor: "pointer", opacity: 0.65, fontSize: 9 }}
                            onClick={() => { setEditingTdsExpectedTab(true); setTdsExpectedInputTab(String(tdsExpectedOverrideTab ?? tdsExpected)); }}>✏</span>
                        )}
                      </div>
                      {editingTdsExpectedTab ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                          <input type="number" value={tdsExpectedInputTab} onChange={e => setTdsExpectedInputTab(e.target.value)} autoFocus
                            onKeyDown={e => { if (e.key === "Enter") { setTdsExpectedOverrideTab(parseFloat(tdsExpectedInputTab) || 0); setEditingTdsExpectedTab(false); } if (e.key === "Escape") setEditingTdsExpectedTab(false); }}
                            style={{ flex: 1, width: 0, background: C.bg, border: `1px solid ${C.amber}`, borderRadius: 4, color: C.text, padding: "2px 4px", fontSize: 11, outline: "none", textAlign: "center" }} />
                          <span style={{ cursor: "pointer", color: C.green, fontWeight: 900, fontSize: 12 }} onClick={() => { setTdsExpectedOverrideTab(parseFloat(tdsExpectedInputTab) || 0); setEditingTdsExpectedTab(false); }}>✓</span>
                          <span style={{ cursor: "pointer", color: C.red, fontWeight: 900, fontSize: 12 }} onClick={() => setEditingTdsExpectedTab(false)}>✕</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, fontWeight: 800, color: C.amber, marginTop: 1 }}>{fmt$(tdsExpectedOverrideTab ?? tdsExpected)}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* Collection Rate ring card */}
              <div style={{ background: `linear-gradient(135deg, ${C.surface}, ${C.card})`, border: `1px solid ${C.purple}33`, borderLeft: `3px solid ${C.purple}`, borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Ring pct={collectPct} color={collectPct >= 80 ? C.green : collectPct >= 50 ? C.accent : C.amber} size={60} stroke={5} />
                  <div style={{ position: "absolute", fontSize: 12, fontWeight: 900, color: C.text }}>{collectPct}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6 }}>Collection Rate</div>
                  <div style={{ fontSize: 13, color: C.textDim, marginTop: 4 }}>
                    <span style={{ color: C.green, fontWeight: 700 }}>{rootInvList.filter(i => i.status === "cleared").length}</span> cleared /&nbsp;
                    <span style={{ color: C.amber, fontWeight: 700 }}>{rootInvList.filter(i => i.status !== "cleared").length}</span> pending
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 2: Client Invoice Overview KPI Cards ─────────────────── */}
            {clientList.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 3, height: 18, background: `linear-gradient(180deg, ${C.accent}, ${C.purple})`, borderRadius: 2 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Client Invoice Overview</span>
                  <span style={{ background: C.accent + "1a", color: C.accent, borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 700 }}>{clientList.length} clients</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {clientList.map((cl, idx) => {
                    const netRaised = cl.raised - cl.tds;
                    const pct = netRaised > 0 ? Math.min(Math.round((cl.cleared / netRaised) * 100), 100) : 0;
                    const col = PALETTE[idx % PALETTE.length];
                    const hColor = pct === 100 ? C.green : pct >= 60 ? C.accent : C.amber;
                    const initials = cl.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <div key={cl.name} style={{ background: `linear-gradient(145deg, ${C.surface}, ${C.card})`, border: `1px solid ${hColor}33`, borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${col}12 0%, transparent 70%)`, pointerEvents: "none" }} />
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, zIndex: 1 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${col}33, ${col}15)`, border: `1.5px solid ${col}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: col, flexShrink: 0 }}>{initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cl.name}</div>
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{cl.count} invoice{cl.count !== 1 ? "s" : ""}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <Ring pct={pct} color={hColor} size={40} stroke={4} />
                            <span style={{ fontSize: 13, fontWeight: 800, color: hColor }}>{pct}%</span>
                          </div>
                        </div>
                        {/* stat chips */}
                        <div style={{ display: "grid", gridTemplateColumns: cl.tds > 0 ? "1fr 1fr" : "1fr 1fr 1fr", gap: 7, zIndex: 1 }}>
                          <div style={{ background: C.bg, borderRadius: 9, padding: "8px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Raised</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: C.text, marginTop: 3 }}>{fmt$(cl.raised)}</div>
                          </div>
                          {cl.tds > 0 && (
                            <div style={{ background: C.red + "0e", borderRadius: 9, padding: "8px", border: `1px solid ${C.red}2a`, textAlign: "center" }}>
                              <div style={{ fontSize: 9, color: C.red, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                TDS (10%)
                                {editingTdsTab !== cl.name && (
                                  <span title="Edit expected TDS" style={{ cursor: "pointer", opacity: 0.6, fontSize: 9 }} onClick={() => { setEditingTdsTab(cl.name); setTdsInputTab(String(tdsEditsTab[cl.name] ?? cl.tds)); }}>✏</span>
                                )}
                              </div>
                              {editingTdsTab === cl.name ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                                  <input type="number" value={tdsInputTab} onChange={e => setTdsInputTab(e.target.value)} autoFocus
                                    onKeyDown={e => { if (e.key === "Enter") { setTdsEditsTab(p => ({ ...p, [cl.name]: parseFloat(tdsInputTab) || 0 })); setEditingTdsTab(null); } if (e.key === "Escape") setEditingTdsTab(null); }}
                                    style={{ flex: 1, width: 0, background: C.bg, border: `1px solid ${C.red}`, borderRadius: 4, color: C.text, padding: "2px 4px", fontSize: 11, outline: "none", textAlign: "center" }} />
                                  <span style={{ cursor: "pointer", color: C.green, fontWeight: 900, fontSize: 12 }} onClick={() => { setTdsEditsTab(p => ({ ...p, [cl.name]: parseFloat(tdsInputTab) || 0 })); setEditingTdsTab(null); }}>✓</span>
                                  <span style={{ cursor: "pointer", color: C.red, fontWeight: 900, fontSize: 12 }} onClick={() => setEditingTdsTab(null)}>✕</span>
                                </div>
                              ) : (
                                <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginTop: 3 }}>{fmt$(tdsEditsTab[cl.name] ?? cl.tds)}</div>
                              )}
                            </div>
                          )}
                          <div style={{ background: C.green + "0e", borderRadius: 9, padding: "8px", border: `1px solid ${C.green}2a`, textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: C.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Cleared</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: C.green, marginTop: 3 }}>{fmt$(cl.cleared)}</div>
                          </div>
                          <div style={{ background: C.amber + "0e", borderRadius: 9, padding: "8px", border: `1px solid ${C.amber}2a`, textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: C.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Pending</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: C.amber, marginTop: 3 }}>{fmt$(cl.pending)}</div>
                          </div>
                        </div>
                        {/* Stacked bar */}
                        <div style={{ zIndex: 1 }}>
                          <div style={{ height: 6, borderRadius: 6, background: C.border, overflow: "hidden", display: "flex" }}>
                            <div style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${hColor === C.green ? C.green : C.accent}, ${C.green})`, transition: "width .4s ease" }} />
                            <div style={{ flex: 1, background: C.amber + "55" }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10, color: C.textMuted }}>
                            <span>Clearance progress</span>
                            <span style={{ fontWeight: 700, color: hColor }}>{pct}% cleared</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Row 3: Project Budget Cards ──────────────────────────────── */}
            {activeProjects.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 3, height: 18, background: `linear-gradient(180deg, ${C.amber}, ${C.accent})`, borderRadius: 2 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Active Project Budgets</span>
                  <span style={{ background: C.amber + "1a", color: C.amber, borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 700 }}>{activeProjects.length} active</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {activeProjects.map((p, idx) => {
                    const projectInvoices = invoices.filter(i => i.project_id === p.id);
                    const raised  = projectInvoices.reduce((a, i) => a + parseFloat(i.amount || 0), 0);
                    const budget  = parseFloat(p.budget || 0);
                    const utilPct = budget > 0 ? Math.min(Math.round((raised / budget) * 100), 999) : 0;
                    const isOver  = raised > budget;
                    const col     = PALETTE[idx % PALETTE.length];
                    return (
                      <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
                        {/* Colour strip header */}
                        <div style={{ background: `linear-gradient(90deg, ${col}2a, ${col}08)`, borderBottom: `1px solid ${col}22`, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: col, fontWeight: 600, marginTop: 2 }}>{p.code}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 10, color: C.textMuted }}>Pending to raise</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: isOver ? C.red : C.text }}>{fmt$(budget - raised)}</div>
                          </div>
                        </div>
                        {/* Body */}
                        <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div style={{ background: C.surface, borderRadius: 8, padding: "8px 12px" }}>
                              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>Budget</div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: C.accent, marginTop: 3 }}>{fmt$(budget)}</div>
                            </div>
                            <div style={{ background: C.green + "0e", borderRadius: 8, padding: "8px 12px", border: `1px solid ${utilPct > 95 ? C.amber + "55" : "transparent"}` }}>
                              <div style={{ fontSize: 10, color: C.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>Raised</div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: isOver ? C.red : C.green, marginTop: 3 }}>{fmt$(raised)}</div>
                            </div>
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11 }}>
                              <span style={{ color: C.textMuted }}>Budget utilization</span>
                              <span style={{ fontWeight: 700, color: isOver ? C.red : utilPct >= 85 ? C.amber : C.green }}>{utilPct}%</span>
                            </div>
                            <div style={{ height: 6, borderRadius: 6, background: C.border, overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(utilPct, 100)}%`, height: "100%", background: isOver ? C.red : utilPct >= 85 ? `linear-gradient(90deg, ${C.amber}, ${C.red})` : `linear-gradient(90deg, ${C.accent}, ${C.green})`, borderRadius: 6, transition: "width .35s ease" }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Row 4: Invoice Table ──────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ width: 3, height: 18, background: `linear-gradient(180deg, ${C.green}, ${C.accent})`, borderRadius: 2 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Raised Invoices</span>
                <div style={{ flex: 1 }} />
                <select value={filterClient} onChange={e => { setFilterClient(e.target.value); setInvPage(1); }}
                  style={{ padding: "7px 11px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: filterClient !== "all" ? C.text : C.textMuted, fontSize: 12, outline: "none", cursor: "pointer" }}>
                  <option value="all">All Clients</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                </select>
                <select value={filterProject} onChange={e => { setFilterProject(e.target.value); setInvPage(1); }}
                  style={{ padding: "7px 11px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: filterProject !== "all" ? C.text : C.textMuted, fontSize: 12, outline: "none", cursor: "pointer" }}>
                  <option value="all">All Projects</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setInvPage(1); }}
                  style={{ padding: "7px 11px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: filterStatus !== "all" ? C.text : C.textMuted, fontSize: 12, outline: "none", cursor: "pointer" }}>
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="cleared">Cleared</option>
                </select>
                <Btn small variant="ghost" onClick={() => handleDownloadCSV(filteredInvoices)}>⬇ Export CSV</Btn>
                {!readOnly && <Btn small onClick={() => setModal(true)}>+ Raise Invoice</Btn>}
              </div>

              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
                {filteredInvoices.length === 0 ? (
                  <div style={{ padding: 48, textAlign: "center", color: C.textMuted, fontSize: 13 }}>No invoices match your filters.</div>
                ) : (
                  <div className="resp-table-wrap">
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
                          <Th>Project & Client</Th>
                          <Th>Task / Deliverables</Th>
                          <Th>Subtotal</Th>
                          <Th>TDS (10%)</Th>
                          <Th>Total Raised</Th>
                          <Th>Date Raised</Th>
                          <Th>Payment Due</Th>
                          <Th>Payment Received</Th>
                          <Th>Status</Th>
                          {!readOnly && <Th>Actions</Th>}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedInvoices.map((inv, rowIdx) => (
                          <tr key={inv.id} style={{ borderBottom: `1px solid ${C.border}`, background: rowIdx % 2 === 0 ? "transparent" : C.card + "44" }}>
                            <Td>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{inv.invoice_number}</div>
                              {inv.parent_invoice_number && (
                                <div style={{ fontSize: 10, color: "#f97316", marginTop: 1 }}>↳ Balance of {inv.parent_invoice_number}</div>
                              )}
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginTop: 2 }}>{inv.client_name || inv.project_name}</div>
                              <div style={{ fontSize: 10, color: C.textMuted }}>{inv.project_code}</div>
                              {inv.vendor_invoice_url && (
                                <a href={`${window.location.origin}/api/receipts/${inv.vendor_invoice_url}`} target="_blank" rel="noreferrer"
                                  style={{ fontSize: 10, color: C.purple, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                                  📎 Partner Invoice
                                </a>
                              )}
                            </Td>
                            <Td>
                              <div style={{ fontSize: 12, color: C.textMuted, maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={parseTaskNames(inv.task_details)}>{parseTaskNames(inv.task_details)}</div>
                            </Td>
                            <Td><div style={{ fontSize: 12, color: C.textDim }}>{inv.subtotal ? fmt$(inv.subtotal) : "—"}</div></Td>
                            <Td>
                              {inv.tds_amount
                                ? <div><div style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>− {fmt$(inv.tds_amount)}</div><div style={{ fontSize: 10, color: C.textMuted }}>@10%</div></div>
                                : <span style={{ fontSize: 11, color: C.textMuted }}>—</span>}
                            </Td>
                            <Td>
                              <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{fmt$(inv.amount)}</div>
                              {inv.tds_amount && <div style={{ fontSize: 10, color: C.textMuted }}>excl. TDS: {fmt$(parseFloat(inv.amount || 0) - parseFloat(inv.tds_amount || 0))}</div>}
                            </Td>
                            <Td><div style={{ fontSize: 12, color: C.textMuted }}>{fmtD(inv.raised_date)}</div></Td>
                            <Td><div style={{ fontSize: 12, color: inv.payment_due_date && new Date(inv.payment_due_date) < new Date() && inv.status !== "cleared" ? C.red : C.textMuted }}>{inv.payment_due_date ? fmtD(inv.payment_due_date) : "—"}</div></Td>
                            <Td>
                              {inv.payment_received_date || inv.payment_received
                                ? <div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{inv.payment_received != null ? fmt$(inv.payment_received) : "—"}</div>
                                    <div style={{ fontSize: 10, color: C.textMuted }}>{inv.payment_received_date ? fmtD(inv.payment_received_date) : ""}</div>
                                  </div>
                                : <span style={{ fontSize: 11, color: C.textMuted }}>—</span>}
                            </Td>
                            <Td>
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                <Badge color={inv.status === "cleared" ? C.green : inv.status === "partial" ? "#f97316" : C.amber}>{inv.status}</Badge>
                                {inv.status === "partial" && inv.balance_amount != null && (
                                  <div style={{ fontSize: 10, color: "#f97316", fontWeight: 600 }}>Bal: {fmt$(inv.balance_amount)}</div>
                                )}
                              </div>
                            </Td>
                            {!readOnly && (
                              <Td>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  <Btn small variant="ghost" onClick={() => setViewInvoice(inv)}>👁</Btn>
                                  <Btn small variant={inv.status === "cleared" ? "ghost" : "success"} onClick={() => handleToggleStatus(inv)}>
                                    {inv.status === "cleared" ? "Revert" : "Clear"}
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
                
                {/* Pagination Controls */}
                <PaginationControls page={invPage} setPage={setInvPage} perPage={invPerPage} setPerPage={setInvPerPage} total={sortedInvoices.length} />
              </div>
            </div>
          </div>
        );
      })()}

      {clearModal && (() => {
        const raisedAmt = parseFloat(clearModal.amount || 0);
        const tdsAmt = parseFloat(clearModal.tds_amount || 0);
        const receivedAmt = parseFloat(paymentAmount || 0);
        const effectiveAmt = receivedAmt + tdsAmt;
        const diff = raisedAmt - effectiveAmt;
        const hasShortfall = paymentAmount !== "" && diff > 0.005;
        const hasOverpay = paymentAmount !== "" && diff < -0.005;
        return (
          <Modal title="Mark Invoice as Cleared" onClose={() => setClearModal(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Invoice summary */}
              <div style={{ background: C.surface, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Invoice</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{clearModal.invoice_number || clearModal.client_name || clearModal.project_name}</div>
                <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>Total Raised</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt$(raisedAmt)}</div>
                  </div>
                  {tdsAmt > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>TDS (10%)</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>− {fmt$(tdsAmt)}</div>
                    </div>
                  )}
                  {tdsAmt > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>Expected from Client</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{fmt$(raisedAmt - tdsAmt)}</div>
                    </div>
                  )}
                  {clearModal.parent_invoice_number && (
                    <div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>Parent Invoice</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#f97316" }}>{clearModal.parent_invoice_number}</div>
                    </div>
                  )}
                </div>
              </div>

              {tdsAmt > 0 && (
                <div style={{ background: C.amber + "11", border: `1px solid ${C.amber}44`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.amber }}>
                  ℹ TDS of {fmt$(tdsAmt)} will be credited. Client pays {fmt$(raisedAmt - tdsAmt)} + TDS credit = {fmt$(raisedAmt)} total.
                </div>
              )}

              <Inp label="Payment Received Date" type="date" value={paymentDate} onChange={v => setPaymentDate(v)} required />
              <Inp
                label={tdsAmt > 0 ? `Payment Received from Client (₹) — excl. TDS ${fmt$(tdsAmt)}` : "Payment Received Amount (₹)"}
                type="number"
                value={paymentAmount}
                onChange={v => setPaymentAmount(v)}
                placeholder={tdsAmt > 0 ? `Expected: ${(raisedAmt - tdsAmt).toFixed(2)}` : `Full amount: ${fmt$(raisedAmt)}`}
              />

              {/* TDS reconciliation line when TDS exists */}
              {tdsAmt > 0 && paymentAmount !== "" && (
                <div style={{ background: C.surface, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: C.textDim, marginBottom: 4 }}>
                    <span>Payment Received</span><span style={{ fontWeight: 700, color: C.green }}>{fmt$(receivedAmt)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: C.textDim, marginBottom: 4 }}>
                    <span>TDS Credit (10%)</span><span style={{ fontWeight: 700, color: C.amber }}>{fmt$(tdsAmt)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.border}`, paddingTop: 6, fontWeight: 700 }}>
                    <span style={{ color: C.text }}>Effective Total</span>
                    <span style={{ color: effectiveAmt >= raisedAmt - 0.005 ? C.green : "#f97316" }}>{fmt$(effectiveAmt)} / {fmt$(raisedAmt)}</span>
                  </div>
                </div>
              )}

              {/* Difference indicator */}
              {hasShortfall && (
                <div style={{ background: "#f9731622", border: "1px solid #f97316", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f97316", marginBottom: 4 }}>⚠ Shortfall Detected</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textDim }}>
                    <span>Total Raised</span><span style={{ fontWeight: 700 }}>{fmt$(raisedAmt)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textDim }}>
                    <span>Effective Payment{tdsAmt > 0 ? " (cash + TDS)" : ""}</span><span style={{ fontWeight: 700, color: C.green }}>{fmt$(effectiveAmt)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: `1px solid #f9731644`, marginTop: 6, paddingTop: 6 }}>
                    <span style={{ fontWeight: 700, color: "#f97316" }}>Balance Due (Pending)</span>
                    <span style={{ fontWeight: 800, color: "#f97316" }}>{fmt$(diff)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
                    {(() => {
                      const rootNum = (clearModal.invoice_number || "").replace(/^(BAL-\d{4}-)+/, "");
                      const mmdd = new Date().toLocaleDateString("en-GB", { month: "2-digit", day: "2-digit" }).replace("/", "");
                      return <>Invoice will be marked <strong>partial</strong>. A new balance invoice <strong>BAL-{mmdd}-{rootNum}</strong> ({fmt$(diff)}) will be auto-created and linked to this invoice.</>;
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
                  ✓ {tdsAmt > 0 ? `Payment ${fmt$(receivedAmt)} + TDS ${fmt$(tdsAmt)} = ${fmt$(effectiveAmt)} — matches invoice total.` : "Full payment. Invoice will be marked cleared."}
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
              const today = isoDate(new Date());
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
  const [filterPayer, setFilterPayer] = useState("all");
  const [searchPurpose, setSearchPurpose] = useState("");
  const [chartOffset, setChartOffset] = useState(0);
  const [clearModal, setClearModal] = useState(null);
  const [showPayerBreakdown, setShowPayerBreakdown] = useState(false);
  // Pagination
  const [expPage, setExpPage] = useState(1);
  const [expPerPage, setExpPerPage] = useState(10);

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
    a.download = `company-expenses-export-${isoDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Spinner />;

  // ── Derived data ──────────────────────────────────────────────────────────
  const expTotal   = e => (parseFloat(e.amount) || 0) + (parseFloat(e.gst_amount) || 0);
  const totalAll   = expenses.reduce((s, e) => s + expTotal(e), 0);
  const totalPend  = expenses.filter(e => e.status === "pending").reduce((s, e) => s + expTotal(e), 0);
  const totalClr   = expenses.filter(e => e.status === "cleared").reduce((s, e) => s + expTotal(e), 0);
  const totalAudit = expenses.filter(e => e.status === "sent to auditing").reduce((s, e) => s + expTotal(e), 0);

  const payerOptions = Array.from(new Set(expenses.map(e => e.paid_by).filter(Boolean))).sort();
  const monthOptions = Array.from(new Set(expenses.map(e => e.expense_date?.slice(0, 7)).filter(Boolean))).sort().reverse();
  const clearedMonthOptions = Array.from(new Set(expenses.filter(e => e.cleared_date).map(e => e.cleared_date?.slice(0, 7)).filter(Boolean))).sort().reverse();

  const filteredList = expenses.filter(e => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (filterMonth !== "all" && !e.expense_date?.startsWith(filterMonth)) return false;
    if (filterClearedMonth !== "all" && !e.cleared_date?.startsWith(filterClearedMonth)) return false;
    if (filterPayer !== "all" && e.paid_by !== filterPayer) return false;
    if (searchPurpose && !e.purpose?.toLowerCase().includes(searchPurpose.toLowerCase())) return false;
    return true;
  });
  const filteredTotal = filteredList.reduce((s, e) => s + expTotal(e), 0);
  
  const expTotalPages = Math.ceil(filteredList.length / expPerPage) || 1;
  const paginatedExpenses = filteredList.slice((expPage - 1) * expPerPage, expPage * expPerPage);

  // Monthly chart data (pending + cleared split)
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i - chartOffset * 6);
    last6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const chartData = last6Months.map(m => {
    const inMonth = expenses.filter(e => e.expense_date?.startsWith(m));
    return {
      name: new Date(m + "-01T12:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      pending: inMonth.filter(e => e.status === "pending").reduce((s, e) => s + expTotal(e), 0),
      cleared: inMonth.filter(e => e.status === "cleared").reduce((s, e) => s + expTotal(e), 0),
      auditing: inMonth.filter(e => e.status === "sent to auditing").reduce((s, e) => s + expTotal(e), 0),
    };
  });

  // Per-payer breakdown
  const payerBreakdown = payerOptions.map(p => {
    const rows = expenses.filter(e => e.paid_by === p);
    return {
      payer: p,
      total: rows.reduce((s, e) => s + expTotal(e), 0),
      pending: rows.filter(e => e.status === "pending").reduce((s, e) => s + expTotal(e), 0),
      cleared: rows.filter(e => e.status === "cleared").reduce((s, e) => s + expTotal(e), 0),
      count: rows.length,
    };
  }).sort((a, b) => b.total - a.total);

  const selStyle = { background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", outline: "none", fontSize: 13 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Row 1: KPI Strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        {[
          { label: "Total All-Time", value: totalAll, color: C.accent, icon: "💰", sub: `${expenses.length} records` },
          { label: "Pending", value: totalPend, color: C.amber, icon: "⏳", sub: `${expenses.filter(e => e.status === "pending").length} entries` },
          { label: "Cleared", value: totalClr, color: C.green, icon: "✅", sub: `${expenses.filter(e => e.status === "cleared").length} entries` },
          { label: "Sent to Auditing", value: totalAudit, color: C.purple, icon: "📁", sub: `${expenses.filter(e => e.status === "sent to auditing").length} entries` },
        ].map((kpi, i) => (
          <div key={i} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
            borderLeft: `3px solid ${kpi.color}`, padding: "16px 20px",
            boxShadow: `0 0 18px ${kpi.color}10`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{kpi.icon}</span>
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: .6, textTransform: "uppercase" }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color, lineHeight: 1, marginBottom: 4 }}>{fmt$(kpi.value)}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Monthly Chart + Payer Summary ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16 }}>

        {/* Monthly Trend Chart */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>Monthly Expense Trend</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textMuted }}>Pending, Cleared & Auditing breakdown per month</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn variant="ghost" small onClick={() => setChartOffset(o => o + 1)}>← Prev</Btn>
              <Btn variant="ghost" small onClick={() => setChartOffset(o => Math.max(0, o - 1))} disabled={chartOffset === 0}>Next →</Btn>
            </div>
          </div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis dataKey="name" stroke={C.border} tick={{ fill: C.textMuted, fontSize: 11 }} />
                <YAxis stroke={C.border} tick={{ fill: C.textMuted, fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} width={52} />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }}
                  formatter={(v, n) => [fmt$(v), n.charAt(0).toUpperCase() + n.slice(1)]} />
                <Legend wrapperStyle={{ fontSize: 12, color: C.textMuted }} />
                <Bar dataKey="pending" name="Pending" stackId="a" fill={C.amber} radius={[0, 0, 0, 0]} />
                <Bar dataKey="cleared" name="Cleared" stackId="a" fill={C.green} radius={[0, 0, 0, 0]} />
                <Bar dataKey="auditing" name="Auditing" stackId="a" fill={C.purple} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payer Breakdown Panel */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>By Payer</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textMuted }}>Spend breakdown per payer</p>
            </div>
            <button onClick={() => setShowPayerBreakdown(v => !v)} style={{ background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              {showPayerBreakdown ? "Show Less" : "Show All"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: showPayerBreakdown ? 320 : 210 }}>
            {payerBreakdown.length === 0 && <div style={{ fontSize: 13, color: C.textMuted, padding: "20px 0", textAlign: "center" }}>No data yet.</div>}
            {(showPayerBreakdown ? payerBreakdown : payerBreakdown.slice(0, 4)).map((p, i) => {
              const pct = totalAll > 0 ? (p.total / totalAll) * 100 : 0;
              return (
                <div key={p.payer} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${PALETTE[i % PALETTE.length]}22`, border: `1px solid ${PALETTE[i % PALETTE.length]}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: PALETTE[i % PALETTE.length] }}>
                        {mkAvi(p.payer)}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{p.payer}</div>
                        <div style={{ fontSize: 10, color: C.textMuted }}>{p.count} entries</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt$(p.total)}</div>
                      <div style={{ fontSize: 10, color: C.textMuted }}>{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div style={{ height: 4, background: C.surface, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: PALETTE[i % PALETTE.length], borderRadius: 2, transition: "width .4s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Row 3: Expense Ledger Table ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>

        {/* Table header / filter bar */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>Expense Ledger</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textMuted }}>
              {filteredList.length} records · {fmt$(filteredTotal)} total
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Btn variant="outline" small onClick={handleDownloadCSV} disabled={!filteredList.length}>⬇ Export CSV</Btn>
            <Btn small onClick={() => setModal("newExpense")}>+ Add Expense</Btn>
          </div>
        </div>

        {/* Filter strip */}
        <div style={{ padding: "12px 24px", borderBottom: `1px solid ${C.border}`, background: C.surface, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted, fontSize: 13, pointerEvents: "none" }}>🔍</span>
            <input value={searchPurpose} onChange={e => { setSearchPurpose(e.target.value); setExpPage(1); }} placeholder="Search purpose…"
              style={{ ...selStyle, padding: "7px 10px 7px 30px", width: "100%", boxSizing: "border-box" }} />
          </div>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setExpPage(1); }} style={selStyle}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="cleared">Cleared</option>
            <option value="sent to auditing">Sent to Auditing</option>
          </select>
          <select value={filterPayer} onChange={e => { setFilterPayer(e.target.value); setExpPage(1); }} style={selStyle}>
            <option value="all">All Payers</option>
            {payerOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setExpPage(1); }} style={selStyle}>
            <option value="all">All Months</option>
            {monthOptions.map(m => <option key={m} value={m}>{new Date(m + "-01T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}</option>)}
          </select>
          <select value={filterClearedMonth} onChange={e => { setFilterClearedMonth(e.target.value); setExpPage(1); }} style={selStyle}>
            <option value="all">All Cleared Months</option>
            {clearedMonthOptions.map(m => <option key={m} value={m}>{new Date(m + "-01T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}</option>)}
          </select>
          {(filterStatus !== "all" || filterPayer !== "all" || filterMonth !== "all" || filterClearedMonth !== "all" || searchPurpose) && (
            <Btn variant="ghost" small onClick={() => { setFilterStatus("all"); setFilterPayer("all"); setFilterMonth("all"); setFilterClearedMonth("all"); setSearchPurpose(""); setExpPage(1); }}>✕ Clear</Btn>
          )}
        </div>

        {err && <div style={{ margin: "12px 24px", background: C.red + "18", color: C.red, padding: "10px 14px", borderRadius: 8, fontSize: 13, border: `1px solid ${C.red}44` }}>⚠ {err}</div>}

        {!filteredList.length ? (
          <div style={{ padding: "50px 20px", textAlign: "center", color: C.textMuted }}>
            {searchPurpose || filterStatus !== "all" || filterPayer !== "all" || filterMonth !== "all"
              ? "No expenses match your filters."
              : "No company expenses recorded yet."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.surface }}>
                  <Th>Date</Th>
                  <Th>Purpose</Th>
                  <Th>Net Amount</Th>
                  <Th>GST</Th>
                  <Th>Total</Th>
                  <Th>Paid By</Th>
                  <Th>ITR / Tax</Th>
                  <Th>Status</Th>
                  <Th>Cleared Date</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.map((exp, idx) => {
                  const [yr, mo, da] = (exp.expense_date || "").split("-");
                  const fmtDmy = yr && mo && da ? `${da}-${mo}-${yr}` : exp.expense_date;
                  const total = expTotal(exp);
                  const statusColor = exp.status === "cleared" ? C.green : exp.status === "sent to auditing" ? C.purple : C.amber;
                  return (
                    <tr key={exp.id} style={{ borderBottom: `1px solid ${C.border}22`, background: idx % 2 === 0 ? "transparent" : C.surface + "44" }}>
                      <Td>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>{fmtDmy}</div>
                      </Td>
                      <Td>
                        <div style={{ fontSize: 13, color: C.text, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{exp.purpose}</div>
                      </Td>
                      <Td><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{fmt$(exp.amount)}</div></Td>
                      <Td><div style={{ fontSize: 12, color: C.textMuted }}>{exp.gst_amount ? fmt$(exp.gst_amount) : "—"}</div></Td>
                      <Td>
                        <div style={{ fontSize: 13, fontWeight: 800, color: statusColor }}>{fmt$(total)}</div>
                      </Td>
                      <Td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${C.accent}22`, border: `1px solid ${C.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: C.accent, flexShrink: 0 }}>
                            {mkAvi(exp.paid_by)}
                          </div>
                          <span style={{ fontSize: 12, color: C.textDim }}>{exp.paid_by}</span>
                        </div>
                      </Td>
                      <Td>
                        <div style={{ fontSize: 12, color: C.text }}>{exp.itr_type || "—"}</div>
                        {exp.tax_type && <div style={{ fontSize: 11, color: C.accent, marginTop: 2 }}>{exp.tax_type}</div>}
                      </Td>
                      <Td>
                        <Badge color={statusColor}>{exp.status}</Badge>
                      </Td>
                      <Td>
                        {exp.cleared_date
                          ? <div style={{ fontSize: 12, fontWeight: 600, color: C.green, whiteSpace: "nowrap" }}>{(() => { const [cy, cm, cd] = exp.cleared_date.split("T")[0].split("-"); return `${cd}-${cm}-${cy}`; })()}</div>
                          : <div style={{ fontSize: 13, color: C.textMuted }}>—</div>
                        }
                      </Td>
                      <Td>
                        <div style={{ display: "flex", gap: 5, flexWrap: "nowrap" }}>
                          {(!exp.paid_by?.toUpperCase().includes("FIT") && exp.status !== "sent to auditing") && (
                            <Btn small variant="outline" onClick={() => { setEditObj(exp); setModal("generateExpense"); }}>Gen Exp</Btn>
                          )}
                          {exp.status === "pending" && (
                            <Btn small variant="success" onClick={() => setClearModal({ id: exp.id, clearedDate: isoDate(new Date()) })}>Clear</Btn>
                          )}
                          {exp.status === "cleared" && (
                            <Btn small style={{ background: C.purple, color: "#fff", border: "none", padding: "4px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }} onClick={() => handleToggleStatus(exp.id, "sent to auditing")}>→ Audit</Btn>
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

        {/* Footer totals row */}
        {filteredList.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 24px", background: C.surface, display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: C.textMuted }}>Showing <strong style={{ color: C.text }}>{filteredList.length}</strong> of {expenses.length} records</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>Net: <strong style={{ color: C.text }}>{fmt$(filteredList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0))}</strong></div>
            <div style={{ fontSize: 12, color: C.textMuted }}>GST: <strong style={{ color: C.accent }}>{fmt$(filteredList.reduce((s, e) => s + (parseFloat(e.gst_amount) || 0), 0))}</strong></div>
            <div style={{ fontSize: 12, color: C.textMuted }}>Total: <strong style={{ color: C.green }}>{fmt$(filteredTotal)}</strong></div>
          </div>
        )}
        
        {/* Pagination Controls */}
        <PaginationControls page={expPage} setPage={setExpPage} perPage={expPerPage} setPerPage={setExpPerPage} total={filteredList.length} />
      </div>

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
    try { const dt = (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) ? new Date(d.slice(0, 10) + "T00:00:00") : new Date(d); const p = n => String(n).padStart(2, "0"); return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}`; } catch { return ""; }
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
    tds_amount: initialData.tds_amount || "",
    raised_date: parseDate(initialData.raised_date),
    payment_due_date: parseDate(initialData.payment_due_date),
    status: initialData.status,
    vendor_invoice_url: initialData.vendor_invoice_url || "",
  } : { client_id: "", invoice_number: "", project_id: "", amount: "", items: [{ description: "", hours: "", rate: "" }], remarks: "", tax_rate: "18.00", subtotal: "", tds_amount: "", raised_date: isoDate(new Date()), payment_due_date: "", status: "pending", vendor_invoice_url: "" });
  const [vendorFile, setVendorFile] = useState(null);
  const [vendorUploading, setVendorUploading] = useState(false);

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
    const tds = sub * 0.10; // TDS @ 10% of subtotal
    setForm(f => ({ ...f, subtotal: sub.toFixed(2), tds_amount: tds.toFixed(2), amount: tot.toFixed(2) }));
  }, [form.items, form.tax_rate]);

  useEffect(() => {
    if (form.client_id && form.raised_date) {
      const client = clients.find(c => String(c.id) === String(form.client_id));
      if (client && client.pay_day) {
        const raised = new Date(form.raised_date + "T00:00:00");
        raised.setDate(raised.getDate() + parseInt(client.pay_day));
        const newDate = isoDate(raised);
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

      {/* Invoice Summary Breakdown */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Invoice Summary</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textDim }}>
          <span>Subtotal (Hours × Rate)</span>
          <span style={{ fontWeight: 700, color: C.text }}>₹{form.subtotal || "0.00"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textDim }}>
          <span>TDS Deductible (10% of Subtotal)</span>
          <span style={{ fontWeight: 700, color: C.amber }}>− ₹{form.tds_amount || "0.00"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textDim }}>
          <span>Tax / GST ({form.tax_rate || 0}%)</span>
          <span style={{ fontWeight: 700, color: C.textDim }}>+ ₹{((parseFloat(form.amount || 0) - parseFloat(form.subtotal || 0)) || 0).toFixed(2)}</span>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
          <span style={{ color: C.text }}>Total Invoice Amount</span>
          <span style={{ color: C.green }}>₹{form.amount || "0.00"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted, borderTop: `1px dashed ${C.border}`, paddingTop: 6, marginTop: 2 }}>
          <span>Expected Payment from Client (after TDS)</span>
          <span style={{ fontWeight: 700, color: C.accent }}>₹{((parseFloat(form.amount || 0) - parseFloat(form.tds_amount || 0)) || 0).toFixed(2)}</span>
        </div>
      </div>

      <Inp label="Total Amount (INR) *" type="number" step="0.01" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} required />

      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Date Raised *" type="date" value={form.raised_date} onChange={v => setForm(f => ({ ...f, raised_date: v }))} required />
        <Inp label="Payment Due Date" type="date" value={form.payment_due_date} onChange={v => setForm(f => ({ ...f, payment_due_date: v }))} />
      </div>

      {/* ── Partner / Vendor Invoice Upload ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: .5 }}>Partner / Vendor Invoice</div>
        <div style={{ fontSize: 12, color: C.textDim }}>Upload the invoice received from your partner company for reference.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{
            display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "7px 14px", fontSize: 12, fontWeight: 600, color: C.text,
          }}>
            📎 {vendorFile ? vendorFile.name : "Choose File"}
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp" style={{ display: "none" }}
              onChange={e => setVendorFile(e.target.files[0] || null)} />
          </label>
          {vendorFile && (
            <Btn small variant="outline" disabled={vendorUploading} onClick={async () => {
              setVendorUploading(true);
              try {
                const res = await api.uploadVendorInvoice(vendorFile);
                setForm(f => ({ ...f, vendor_invoice_url: res.filename }));
                setVendorFile(null);
              } catch (e) { alert(e.message); } finally { setVendorUploading(false); }
            }}>{vendorUploading ? "Uploading…" : "Upload"}</Btn>
          )}
          {form.vendor_invoice_url && !vendorFile && (
            <a href={`${window.location.origin}/api/receipts/${form.vendor_invoice_url}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: C.accent, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              📄 View uploaded invoice ↗
            </a>
          )}
        </div>
        {form.vendor_invoice_url && (
          <div style={{ fontSize: 11, color: C.textMuted }}>
            Saved: {form.vendor_invoice_url}
            <button onClick={() => setForm(f => ({ ...f, vendor_invoice_url: "" }))}
              style={{ marginLeft: 8, background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 11 }}>✕ Remove</button>
          </div>
        )}
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

// ── KpiCard: modern stat card with icon, value, optional bar & tooltip ──────
function KpiCard({ item }) {
  const [show, setShow] = useState(false);
  const barPct = item.bar ? (item.bar.value / (item.bar.max || 1)) : 0;
  return (
    // Outer wrapper owns hover — tooltip is a DOM sibling of the card div, not nested inside it.
    // This prevents onMouseLeave from firing when the mouse moves into the tooltip.
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => item.tooltipLines && setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div className="ov-kpi-card">
        <div className="ov-card-glow" style={{ background: item.color }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: item.color + "22", border: `1px solid ${item.color}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, flexShrink: 0,
          }}>{item.icon}</div>
          {item.bar && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
              background: barPct > 0.85 ? C.red + "22" : C.amber + "22",
              color: barPct > 0.85 ? C.red : C.amber,
              border: `1px solid ${barPct > 0.85 ? C.red : C.amber}44`,
            }}>{(barPct * 100).toFixed(0)}%</span>
          )}
          {item.tooltipLines && !item.bar && (
            <span style={{ fontSize: 10, color: C.textMuted, padding: "3px 7px", borderRadius: 20, background: C.surface, border: `1px solid ${C.border}` }}>
              {item.tooltipLines.length} ↑
            </span>
          )}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: item.color, letterSpacing: -0.5, lineHeight: 1.2 }}>{item.value}</div>
          <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginTop: 4 }}>{item.label}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{item.sub}</div>
        </div>
        {item.bar && <ProgressBar value={item.bar.value} max={item.bar.max} color={item.color} />}
      </div>

      {show && item.tooltipLines && item.tooltipLines.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 10px)", left: 0, zIndex: 999 }}>
          {/* Arrow */}
          <div style={{
            position: "absolute", top: -6, left: 22,
            width: 14, height: 14, background: "#2a2d3e",
            borderLeft: `1px solid ${C.border}`, borderTop: `1px solid ${C.border}`,
            transform: "rotate(45deg)", zIndex: 1,
          }} />
          {/* Body */}
          <div style={{
            position: "relative", zIndex: 2,
            background: "#2a2d3e", border: `1px solid ${C.border}`, borderRadius: 10,
            boxShadow: "0 10px 40px rgba(0,0,0,0.6)", padding: "12px 16px",
            minWidth: 240, maxWidth: 320, maxHeight: 260, overflowY: "auto",
          }}>
            {item.tooltipLines.map((line, i) => (
              <div key={i} style={{
                fontSize: 13, color: "#fff", fontWeight: 500, padding: "5px 0",
                borderBottom: i < item.tooltipLines.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}>{line}</div>
            ))}
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
    total_company_expenses = 0, total_claims_expenses = 0,
    pending_timesheets = 0, pending_leaves = 0,
    invoice_total_raised = 0, invoice_cleared = 0, invoice_pending = 0,
    pending_invoices = [],
  } = data || {};

  const total_burned_all = total_burned + total_company_expenses + total_claims_expenses;
  const burnPct = total_budget ? ((total_burned_all / total_budget) * 100).toFixed(1) : 0;
  const remainingBudget = Math.max(0, total_budget - total_burned_all);
  const collectionRate = invoice_total_raised ? ((invoice_cleared / invoice_total_raised) * 100).toFixed(1) : 0;

  const inactiveProjects = projects.filter(p => p.status !== "active");

  const budgetCards = [
    { label: "Total Budget", value: fmt$(total_budget), sub: `${projects.length} projects total`, icon: "💰", color: C.accent },
    { label: "Active Budget", value: fmt$(active_budget), sub: `${projects.filter(p => p.status === "active").length} active projects`, icon: "🚀", color: C.green, tooltipLines: projects.filter(p => p.status === "active").map(p => `🚀 ${p.name} — ${fmt$(p.budget)}`) },
    { label: "Inactive Budget", value: fmt$(inactive_budget), sub: `${inactiveProjects.length} inactive projects`, icon: "📦", color: C.textMuted, tooltipLines: inactiveProjects.map(p => `📦 ${p.name} (${p.status}) — ${fmt$(p.budget)}`) },
    { label: "Budget Burned", value: fmt$(total_burned_all), sub: `${burnPct}% of total utilized`, icon: "🔥", color: C.amber, bar: { value: total_burned_all, max: total_budget }, tooltipLines: [`🕐 Project Timesheets — ${fmt$(total_burned)}`, `🏢 Company Expenses — ${fmt$(total_company_expenses)}`, `💳 Claims Expenses — ${fmt$(total_claims_expenses)}`] },
    { label: "Remaining Budget", value: fmt$(remainingBudget), sub: `${(100 - +burnPct).toFixed(1)}% still available`, icon: "💎", color: "#06B6D4" },
  ];

  const invoiceCards = [
    { label: "Total Invoiced", value: fmt$(invoice_total_raised), sub: "All raised invoices", icon: "🧾", color: C.purple },
    { label: "Collected", value: fmt$(invoice_cleared), sub: `${collectionRate}% collection rate`, icon: "✅", color: C.green },
    { label: "Outstanding", value: fmt$(invoice_pending), sub: `${pending_invoices.length} invoices pending`, icon: "⏳", color: C.red, tooltipLines: pending_invoices.map(inv => `${inv.client_name}${inv.invoice_number ? ` · ${inv.invoice_number}` : ""} — ${fmt$(inv.amount)}`) },
    { label: "Pending Reviews", value: pending_timesheets + pending_leaves, sub: `${pending_timesheets} timesheets · ${pending_leaves} leaves`, icon: "🕐", color: C.purple },
  ];

  const SectionLabel = ({ text }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1.2, textTransform: "uppercase", whiteSpace: "nowrap" }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );

  return (
    <>
      <style>{`
        .ov-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .ov-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .ov-kpi-card {
          position: relative; background: ${C.card}; border: 1px solid ${C.border};
          border-radius: 14px; padding: 20px; display: flex; flex-direction: column;
          gap: 14px; transition: transform .2s, box-shadow .2s; overflow: visible;
        }
        .ov-kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.45); }
        .ov-card-glow {
          position: absolute; top: 0; right: 0; width: 90px; height: 90px;
          border-radius: 50%; opacity: 0.07; transform: translate(25px, -25px); pointer-events: none;
        }
        .ov-tr-hover { transition: background .15s; }
        .ov-tr-hover:hover { background: ${C.surface}99 !important; }
        @media (max-width: 1100px) { .ov-grid-4 { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px)  { .ov-grid-4 { grid-template-columns: 1fr; } .ov-grid-2 { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* ── Page Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>Overview</h2>
            <p style={{ margin: "5px 0 0", color: C.textMuted, fontSize: 13 }}>
              Real-time project & financial snapshot &nbsp;·&nbsp;
              {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <Btn variant="ghost" small onClick={load}>↻ Refresh</Btn>
        </div>

        {/* ── Budget KPIs ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionLabel text="Budget" />
          <div className="ov-grid-4">
            {budgetCards.map((item, i) => <KpiCard key={i} item={item} />)}
          </div>
        </div>

        {/* ── Invoice & Operations KPIs ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionLabel text="Invoices & Operations" />
          <div className="ov-grid-4">
            {invoiceCards.map((item, i) => <KpiCard key={i} item={item} />)}
          </div>
        </div>

        {/* ── Charts ── */}
        <div className="ov-grid-2">
          <Card>
            <h3 style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1.2, textTransform: "uppercase" }}>Budget Breakdown</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Active", value: active_budget },
                    { name: "Inactive", value: inactive_budget },
                    { name: "Burned", value: total_burned_all },
                  ]}
                  cx="50%" cy="50%" outerRadius={82} innerRadius={52} dataKey="value" paddingAngle={3}
                >
                  {[C.green, C.textMuted, C.amber].map((col, i) => <Cell key={i} fill={col} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt$(v)} contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} formatter={(v, e) => <span style={{ color: C.textDim, fontSize: 12 }}>{v}: {fmt$(e.payload.value)}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1.2, textTransform: "uppercase" }}>Invoice Breakdown</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Collected", value: invoice_cleared },
                    { name: "Outstanding", value: invoice_pending },
                  ]}
                  cx="50%" cy="50%" outerRadius={82} innerRadius={52} dataKey="value" paddingAngle={3}
                >
                  {[C.green, C.red].map((col, i) => <Cell key={i} fill={col} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt$(v)} contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} formatter={(v, e) => <span style={{ color: C.textDim, fontSize: 12 }}>{v}: {fmt$(e.payload.value)}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── Project Burn Rates ── */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1.2, textTransform: "uppercase" }}>Project Burn Rate</h3>
            <span style={{ fontSize: 11, color: C.textMuted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 10px", fontWeight: 600 }}>
              {projects.length} projects
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {projects.map(p => {
              const pct = (((p.burned || 0) / p.budget) * 100).toFixed(1);
              const statusColor = +pct > 85 ? C.red : +pct > 65 ? C.amber : C.green;
              return (
                <div key={p.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0, boxShadow: `0 0 6px ${statusColor}88` }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: C.textMuted }}>{fmt$(p.burned || 0)} / {fmt$(p.budget)}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: statusColor, minWidth: 42, textAlign: "right" }}>{pct}%</span>
                    </div>
                  </div>
                  <ProgressBar value={p.burned || 0} max={p.budget} />
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Clients ── */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1.2, textTransform: "uppercase" }}>Clients</h3>
            <span style={{ fontSize: 11, color: C.textMuted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 10px", fontWeight: 600 }}>
              {clients.length} total
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: C.surface }}>
                <tr>
                  {["Client", "Email", "Phone", "GST Number", "Pay Day"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: .5, textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>No clients yet.</td></tr>
                )}
                {clients.map((c) => (
                  <tr key={c.id} className="ov-tr-hover" style={{ borderBottom: `1px solid ${C.border}22` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: C.accent + "22", border: `1px solid ${C.accent}33`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, color: C.accent,
                        }}>{mkAvi(c.client_name)}</div>
                        <span style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{c.client_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12 }}>
                      {c.email ? <a href={`mailto:${c.email}`} style={{ color: C.accent, textDecoration: "none" }}>{c.email}</a> : <span style={{ color: C.textMuted }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12 }}>
                      {c.phone_number ? <a href={`tel:${c.phone_number}`} style={{ color: C.text, textDecoration: "none" }}>{c.phone_number}</a> : <span style={{ color: C.textMuted }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: C.textMuted, fontFamily: "monospace" }}>{c.gst_number || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {c.pay_day
                        ? <span style={{ background: C.accent + "22", color: C.accent, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>Day {c.pay_day}</span>
                        : <span style={{ color: C.textMuted, fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
// PROJECTS
// ════════════════════════════════════════════════════════
function Projects({ readOnly = false }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { setProjects(await api.getProjects()); } catch (e) { setErr(e.message); } finally { setLoading(false); }
  });
  useEffect(() => { load(); }, []);

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  return (
    <>
      <style>{`
        .prj-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px; }
        .prj-card {
          background: ${C.card}; border: 1px solid ${C.border}; border-radius: 16px;
          display: flex; flex-direction: column; gap: 0; overflow: hidden;
          transition: transform .2s, box-shadow .2s;
        }
        .prj-card:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.45); }
        .prj-stat { background: ${C.surface}; border-radius: 10px; padding: 12px 14px; }
        .prj-stat-label { font-size: 11px; color: ${C.textMuted}; font-weight: 600; letter-spacing: .4px; text-transform: uppercase; margin-bottom: 5px; }
        .prj-stat-value { font-size: 15px; font-weight: 800; letter-spacing: -0.3px; }
        .prj-bar-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
        .prj-bar-label { font-size: 11px; color: ${C.textMuted}; font-weight: 600; letter-spacing: .4px; }
        .prj-bar-pct { font-size: 11px; font-weight: 700; }
        @media (max-width: 760px) { .prj-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>Projects</h2>
            <p style={{ margin: "5px 0 0", color: C.textMuted, fontSize: 13 }}>
              Manage project codes, budgets & receivables &nbsp;·&nbsp; {projects.length} total
            </p>
          </div>
          {!readOnly && <Btn onClick={() => setModal("new")}>+ New Project</Btn>}
        </div>

        {/* Cards */}
        <div className="prj-grid">
          {projects.map(p => {
            const burned = p.burned || 0;
            const received = p.received_amount || 0;
            const balance = p.budget - received;
            const burnPct = p.budget ? ((burned / p.budget) * 100).toFixed(1) : 0;
            const collPct = p.budget ? ((received / p.budget) * 100).toFixed(1) : 0;
            const burnColor = +burnPct > 85 ? C.red : +burnPct > 65 ? C.amber : C.accent;
            const balColor = balance < 0 ? C.red : balance === 0 ? C.green : C.amber;
            const collColor = +collPct >= 100 ? C.green : +collPct > 50 ? C.accent : C.amber;

            return (
              <div key={p.id} className="prj-card">
                {/* Card Header */}
                <div style={{ padding: "18px 20px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: .8,
                      background: C.accent + "18", border: `1px solid ${C.accent}33`,
                      padding: "3px 8px", borderRadius: 6,
                    }}>{p.code}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <StatusBadge status={p.status} />
                      {!readOnly && (
                        <button onClick={() => setModal(p)} style={{
                          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                          color: C.textDim, cursor: "pointer", fontSize: 13, padding: "4px 10px",
                          transition: "border-color .15s, color .15s",
                        }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}
                        >✏ Edit</button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{p.name}</div>
                  {p.client && (
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 10 }}>🏢</span>{p.client}
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="prj-stat">
                    <div className="prj-stat-label">Budget</div>
                    <div className="prj-stat-value" style={{ color: C.text }}>{fmt$(p.budget)}</div>
                  </div>
                  <div className="prj-stat">
                    <div className="prj-stat-label">Received</div>
                    <div className="prj-stat-value" style={{ color: C.green }}>{fmt$(received)}</div>
                  </div>
                  <div className="prj-stat">
                    <div className="prj-stat-label">Balance Pending</div>
                    <div className="prj-stat-value" style={{ color: balColor }}>{fmt$(Math.abs(balance))}{balance < 0 && <span style={{ fontSize: 10, marginLeft: 4 }}>over</span>}</div>
                  </div>
                  <div className="prj-stat">
                    <div className="prj-stat-label">Cost Burned</div>
                    <div className="prj-stat-value" style={{ color: burnColor }}>{fmt$(burned)}</div>
                  </div>
                </div>

                {/* Progress Bars */}
                <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div className="prj-bar-row">
                      <span className="prj-bar-label">Burn Rate</span>
                      <span className="prj-bar-pct" style={{ color: burnColor }}>{burnPct}%</span>
                    </div>
                    <ProgressBar value={burned} max={p.budget} />
                  </div>
                  <div>
                    <div className="prj-bar-row">
                      <span className="prj-bar-label">Collection Rate</span>
                      <span className="prj-bar-pct" style={{ color: collColor }}>{collPct}%</span>
                    </div>
                    <ProgressBar value={received} max={p.budget} color={collColor} />
                  </div>
                </div>

                {/* Footer — dates */}
                <div style={{
                  padding: "10px 20px", borderTop: `1px solid ${C.border}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  fontSize: 11, color: C.textMuted,
                }}>
                  <span>📅 {fmtD(p.start_date)}</span>
                  <span style={{ color: C.border }}>→</span>
                  <span>{fmtD(p.end_date)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal */}
        {modal && (
          <Modal title={modal === "new" ? "New Project" : "Edit Project"} onClose={() => setModal(false)}>
            <ProjectForm
              init={modal === "new"
                ? { name: "", client: "", budget: "", receivedAmount: "0", startDate: "", endDate: "", status: "active" }
                : { name: modal.name, client: modal.client || "", budget: modal.budget, receivedAmount: modal.received_amount || 0, startDate: modal.start_date?.slice(0, 10) || "", endDate: modal.end_date?.slice(0, 10) || "", status: modal.status }}
              saving={saving}
              onCancel={() => setModal(false)}
              onSave={async (form) => {
                setSaving(true);
                try {
                  if (modal === "new") await api.createProject({ ...form, budget: +form.budget, receivedAmount: +form.receivedAmount, assignedGroups: [], assignedEmployees: [] });
                  else await api.updateProject(modal.id, { ...form, budget: +form.budget, receivedAmount: +form.receivedAmount });
                  setModal(false); await load();
                } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setSaving(false); }
              }}
            />
          </Modal>
        )}
      </div>
    </>
  );
}

function ProjectForm({ init, saving, onCancel, onSave }) {
  const [form, setForm] = useState(init);
  const balance = (+form.budget || 0) - (+form.receivedAmount || 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Inp label="Project Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required placeholder="e.g. Cloud Migration" />
      <Inp label="Client Name" value={form.client} onChange={v => setForm(f => ({ ...f, client: v }))} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Budget (INR)" type="number" value={form.budget} onChange={v => setForm(f => ({ ...f, budget: v }))} required />
        <Inp label="Received Amount (INR)" type="number" value={form.receivedAmount} onChange={v => setForm(f => ({ ...f, receivedAmount: v }))} />
      </div>
      {/* Live balance preview */}
      <div style={{
        background: C.surface, border: `1px solid ${balance < 0 ? C.red : balance === 0 ? C.green : C.amber}44`,
        borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>Balance Pending</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: balance < 0 ? C.red : balance === 0 ? C.green : C.amber }}>
          {fmt$(Math.abs(balance))}{balance < 0 ? " (over-received)" : balance === 0 ? " (fully paid)" : ""}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
function isoDate(d) { const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Timesheet helpers (module-level so modal inputs keep focus) ──
const TS_DAY_TARGET = 9;
const TS_STATUS = {
  draft: { label: "Draft", color: () => C.textDim },
  pending: { label: "Submitted", color: () => C.amber },
  approved: { label: "Approved", color: () => C.green },
  rejected: { label: "Rejected", color: () => C.red },
};
const tsStatusColor = s => (TS_STATUS[s] ? TS_STATUS[s].color() : C.textMuted);
const tsStatusLabel = s => (TS_STATUS[s] ? TS_STATUS[s].label : s);
const tsH = h => `${Math.round((+h || 0) * 100) / 100}h`;
const tsDay = r => String(r.work_date || "").slice(0, 10);
const tsProjColor = id => { const P = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#F97316", "#EC4899"]; return P[Math.abs(+id || 0) % P.length]; };
const tsWorkdays = (y, m) => { let n = 0; const last = new Date(y, m + 1, 0).getDate(); for (let d = 1; d <= last; d++) { const w = new Date(y, m, d).getDay(); if (w !== 0 && w !== 6) n++; } return n; };

function TsEntryModal({ init, projects, recentIds, dayTotals, onClose, onSubmit, onDelete }) {
  const isEdit = !!init.id;
  const [projectId, setProjectId] = useState(init.projectId ? String(init.projectId) : "");
  const [hours, setHours] = useState(init.hours ? String(init.hours) : "");
  const [task, setTask] = useState(init.task || "");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState([init.date]);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const wk = Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart(new Date(init.date + "T12:00:00")), i)));
  const h = parseFloat(hours);
  const origOnDay = isEdit ? (+init.hours || 0) : 0;
  const overDays = days.filter(d => (dayTotals[d] || 0) - origOnDay + (h || 0) > 24);
  const errs = {
    project: !projectId ? "Choose a project" : null,
    hours: !hours ? "Enter hours" : !(h > 0) ? "Hours must be greater than 0" : h > 24 ? "Max 24h per entry" : overDays.length ? `Exceeds 24h on ${overDays.map(d => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })).join(", ")}` : null,
    days: !days.length ? "Pick at least one day" : null,
  };
  const valid = !errs.project && !errs.hours && !errs.days;
  const longDay = !errs.hours && days.some(d => (dayTotals[d] || 0) - origOnDay + (h || 0) > TS_DAY_TARGET);

  const q = search.trim().toLowerCase();
  const list = projects.filter(p => !q || `${p.code} ${p.name}`.toLowerCase().includes(q));
  const recents = recentIds.map(id => projects.find(p => p.id === id)).filter(Boolean).slice(0, 4);

  async function submit() {
    setTried(true);
    if (!valid || busy) return;
    setBusy(true);
    const ok = await onSubmit({ id: init.id, dates: days, projectId: +projectId, hours: h, task: task.trim() });
    setBusy(false);
    if (ok) onClose();
  }

  const title = isEdit ? "Edit entry" : "Log time";
  const dateLabel = new Date(init.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="tsm-backdrop" onClick={onClose}>
      <div className="tsm" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}>
        <div className="tsm-head">
          <div>
            <div className="tsm-title">{title}</div>
            <div className="tsm-sub">{dateLabel}{isEdit && init.status ? <> · <span style={{ color: tsStatusColor(init.status) }}>{tsStatusLabel(init.status)}</span></> : null}</div>
          </div>
          <button className="ts-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="tsm-body">
          {/* Project */}
          <div className="tsm-field">
            <label className="tsm-lbl">Project</label>
            {recents.length > 0 && (
              <div className="tsm-chips" style={{ marginBottom: 8 }}>
                <span className="tsm-mini">Recent</span>
                {recents.map(p => (
                  <button key={p.id} className={`tsm-chip${String(p.id) === projectId ? " on" : ""}`} onClick={() => setProjectId(String(p.id))}
                    style={{ "--c": tsProjColor(p.id) }}>
                    <span className="tsm-dot" />{p.code}
                  </button>
                ))}
              </div>
            )}
            <div className={`tsm-proj${tried && errs.project ? " err" : ""}`}>
              {projects.length > 6 && (
                <input className="tsm-input tsm-search" placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search projects" />
              )}
              <div className="tsm-proj-list" role="listbox" aria-label="Projects">
                {list.length === 0 && <div className="tsm-none">No matching projects</div>}
                {list.map(p => {
                  const on = String(p.id) === projectId;
                  return (
                    <button key={p.id} role="option" aria-selected={on} className={`tsm-proj-item${on ? " on" : ""}`} onClick={() => setProjectId(String(p.id))}>
                      <span className="tsm-proj-badge" style={{ background: tsProjColor(p.id) + "22", color: tsProjColor(p.id), borderColor: tsProjColor(p.id) + "44" }}>{(p.code || "").slice(0, 4)}</span>
                      <span className="tsm-proj-name"><b>{p.code}</b><span>{p.name}</span></span>
                      {on && <span className="tsm-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            {tried && errs.project && <div className="tsm-err">{errs.project}</div>}
          </div>

          {/* Hours */}
          <div className="tsm-field">
            <label className="tsm-lbl" htmlFor="tsm-hours">Hours</label>
            <div className="tsm-hours-row">
              <div className="tsm-stepper">
                <button onClick={() => setHours(v => String(Math.max(0.5, (parseFloat(v) || 0) - 0.5)))} aria-label="Decrease hours">−</button>
                <input id="tsm-hours" className={`tsm-input${tried && errs.hours ? " err" : ""}`} type="number" inputMode="decimal" min="0.25" max="24" step="0.25"
                  value={hours} placeholder="0" onChange={e => setHours(e.target.value)} />
                <button onClick={() => setHours(v => String(Math.min(24, (parseFloat(v) || 0) + 0.5)))} aria-label="Increase hours">+</button>
              </div>
              <div className="tsm-chips">
                {[1, 2, 4, 6, 8, 9].map(n => (
                  <button key={n} className={`tsm-chip${h === n ? " on" : ""}`} onClick={() => setHours(String(n))}>{n}h</button>
                ))}
              </div>
            </div>
            {tried && errs.hours ? <div className="tsm-err">{errs.hours}</div>
              : longDay ? <div className="tsm-warn">Heads up — this takes the day past {TS_DAY_TARGET}h.</div> : null}
          </div>

          {/* Days (add only) */}
          {!isEdit && (
            <div className="tsm-field">
              <label className="tsm-lbl">Log on <span className="tsm-mini" style={{ marginLeft: 6 }}>select multiple days to repeat</span></label>
              <div className="tsm-days">
                {wk.map((d, i) => {
                  const on = days.includes(d);
                  return (
                    <button key={d} className={`tsm-day${on ? " on" : ""}${i >= 5 ? " we" : ""}`} aria-pressed={on}
                      onClick={() => setDays(ds => on ? ds.filter(x => x !== d) : [...ds, d].sort())}>
                      <span>{DAY_NAMES[i].slice(0, 1)}</span><b>{+d.slice(8)}</b>
                    </button>
                  );
                })}
              </div>
              <div className="tsm-chips" style={{ marginTop: 8 }}>
                <button className="tsm-link" onClick={() => setDays(wk.slice(0, 5))}>Weekdays</button>
                <button className="tsm-link" onClick={() => setDays([init.date])}>Just this day</button>
              </div>
              {tried && errs.days && <div className="tsm-err">{errs.days}</div>}
            </div>
          )}

          {/* Task */}
          <div className="tsm-field">
            <label className="tsm-lbl" htmlFor="tsm-task">What did you work on? <span className="tsm-mini" style={{ marginLeft: 6 }}>optional</span></label>
            <textarea id="tsm-task" className="tsm-input" rows={3} maxLength={500} value={task} onChange={e => setTask(e.target.value)} placeholder="e.g. API integration, code review, client call…" />
            <div className="tsm-mini" style={{ textAlign: "right" }}>{task.length}/500</div>
          </div>
        </div>

        <div className="tsm-foot">
          {isEdit && onDelete ? <button className="ts-btn ts-btn-danger" onClick={async () => { if (await onDelete(init.id)) onClose(); }}>🗑 Delete</button> : <span className="tsm-mini tsm-kbd">Ctrl/⌘ + Enter to save</span>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ts-btn ts-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="ts-btn ts-btn-primary" onClick={submit} disabled={busy || (tried && !valid)}>
              {busy ? "Saving…" : isEdit ? "Save changes" : days.length > 1 ? `Log ${days.length} days · ${tsH((h || 0) * days.length)}` : "Save entry"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Timesheets({ currentUser, viewOnly }) {
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [calView, setCalView] = useState("week"); // "week" | "month"
  const [weekOf, setWeekOf] = useState(() => weekStart(new Date()));
  const [monthOf, setMonthOf] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [entry, setEntry] = useState(null);       // entry modal init
  const [dayPanel, setDayPanel] = useState(null); // iso
  const [busy, setBusy] = useState(false);
  const [filterEmp, setFilterEmp] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const load = async (silent) => {
    silent ? setRefreshing(true) : setLoading(true);
    setErr("");
    try {
      const params = {}; if (viewOnly) params.employee_id = currentUser.employee_id;
      const [ts, pr] = await Promise.all([api.getTimesheets(params), api.getProjects()]);
      setRows(ts || []); setProjects(pr || []);
    } catch (e) { setErr(e.message); } finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { load(); }, []);

  const activeProjs = projects.filter(p => !["closed", "completed"].includes(p.status));
  const myProjs = viewOnly ? activeProjs.filter(p =>
    (p.assigned_employees || []).includes(currentUser.employee_id) ||
    (p.assigned_groups || []).includes(currentUser.group_id)
  ) : activeProjs;

  const errAlert = e => dialog.alert(e.message, { title: "Error", dtype: "error" });
  const isMine = r => r.employee_id === currentUser.employee_id;
  const canEdit = r => viewOnly && isMine(r) && (r.status === "draft" || r.status === "pending");

  async function saveEntry({ id, dates, projectId, hours, task }) {
    try {
      if (id) await api.updateTimesheet(id, { projectId, hours, task });
      else for (const date of dates) await api.createTimesheet({ employeeId: currentUser.employee_id, projectId, date, hours, task });
      await load(true);
      return true;
    } catch (e) { errAlert(e); await load(true); return false; }
  }
  async function deleteEntry(id) {
    if (!await dialog.confirm("Delete this entry? This can't be undone.", { title: "Delete entry", dtype: "warning" })) return false;
    try { await api.deleteTimesheet(id); await load(true); return true; } catch (e) { errAlert(e); return false; }
  }
  async function handleApprove(id) { try { await api.approveTimesheet(id); await load(true); } catch (e) { errAlert(e); } }
  async function handleReject(id) { try { await api.rejectTimesheet(id); await load(true); } catch (e) { errAlert(e); } }

  if (loading) return <Spinner />;
  if (err && !rows.length) return <ErrBox msg={err} onRetry={() => load()} />;

  // ── derived: week ──
  const todayIso = isoDate(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekOf, i));
  const wStart = isoDate(weekDays[0]);
  const wEnd = isoDate(weekDays[6]);
  const byDay = {};
  rows.forEach(r => { const d = tsDay(r); (byDay[d] = byDay[d] || []).push(r); });
  const sumH = list => list.reduce((s, r) => s + (+r.hours || 0), 0);
  const dayTotals = {};
  Object.keys(byDay).forEach(d => { dayTotals[d] = sumH(byDay[d].filter(isMine)); });

  const inRange = (a, b) => r => tsDay(r) >= a && tsDay(r) <= b;
  const weekRows = rows.filter(inRange(wStart, wEnd));
  const weekMine = weekRows.filter(isMine);
  const weekStats = rs => ({
    total: sumH(rs), approved: sumH(rs.filter(r => r.status === "approved")),
    pending: rs.filter(r => r.status === "pending").length, draft: rs.filter(r => r.status === "draft").length,
    rejected: rs.filter(r => r.status === "rejected").length, draftH: sumH(rs.filter(r => r.status === "draft")),
  });
  const ws = weekStats(viewOnly ? weekMine : weekRows);

  // ── derived: month ──
  const { y, m } = monthOf;
  const mStart = isoDate(new Date(y, m, 1));
  const mEnd = isoDate(new Date(y, m + 1, 0));
  const monthRows = rows.filter(inRange(mStart, mEnd));
  const ms = weekStats(viewOnly ? monthRows.filter(isMine) : monthRows);
  const monthDaysLogged = new Set((viewOnly ? monthRows.filter(isMine) : monthRows).map(tsDay)).size;

  const isWeek = calView === "week";
  const st = isWeek ? ws : ms;
  const target = isWeek ? 5 * TS_DAY_TARGET : tsWorkdays(y, m) * TS_DAY_TARGET;
  const pct = viewOnly
    ? (target ? Math.min(100, Math.round((st.total / target) * 100)) : 0)
    : (st.total ? Math.round((st.approved / st.total) * 100) : 0);
  const periodRows = isWeek ? (viewOnly ? weekMine : weekRows) : (viewOnly ? monthRows.filter(isMine) : monthRows);

  // project breakdown
  const projAgg = Object.values(periodRows.reduce((acc, r) => {
    const k = r.project_id;
    acc[k] = acc[k] || { id: k, code: r.project_code, name: r.project_name, hours: 0 };
    acc[k].hours += +r.hours || 0; return acc;
  }, {})).sort((a, b) => b.hours - a.hours);

  // recent projects for quick-pick
  const recentIds = [];
  [...rows].filter(isMine).sort((a, b) => tsDay(b).localeCompare(tsDay(a))).forEach(r => { if (!recentIds.includes(r.project_id)) recentIds.push(r.project_id); });

  // project list for modal (include the edited entry's project even if closed / unassigned)
  const modalProjects = entry && entry.projectId && !myProjs.some(p => p.id === +entry.projectId)
    ? [...myProjs, ...projects.filter(p => p.id === +entry.projectId)] : myProjs;

  // ── actions ──
  const openAdd = date => setEntry({ date: date || (todayIso >= wStart && todayIso <= wEnd ? todayIso : wStart) });
  const openEdit = r => setEntry({ id: r.id, date: tsDay(r), projectId: r.project_id, hours: r.hours, task: r.task, status: r.status });
  const onEntryClick = r => canEdit(r) ? openEdit(r) : setDayPanel(tsDay(r));

  async function handleSubmitWeek() {
    if (!ws.draft) return;
    if (!await dialog.confirm(`Submit ${ws.draft} draft entr${ws.draft === 1 ? "y" : "ies"} (${tsH(ws.draftH)}) for ${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })} to your manager?`, { title: "Submit week", dtype: "info" })) return;
    setBusy(true);
    try { await api.submitWeekTimesheets(wStart, wEnd); await load(true); } catch (e) { errAlert(e); } finally { setBusy(false); }
  }

  async function handleCopyLastWeek() {
    const pS = isoDate(addDays(weekOf, -7)), pE = isoDate(addDays(weekOf, -1));
    const prev = rows.filter(isMine).filter(inRange(pS, pE));
    if (!prev.length) { dialog.alert("There are no entries in the previous week to copy.", { title: "Nothing to copy" }); return; }
    const existing = new Set(weekMine.map(r => `${tsDay(r)}|${r.project_id}`));
    const toCreate = prev.map(r => ({ r, date: isoDate(addDays(new Date(tsDay(r) + "T12:00:00"), 7)) }))
      .filter(x => !existing.has(`${x.date}|${x.r.project_id}`));
    if (!toCreate.length) { dialog.alert("This week already has the same entries as last week.", { title: "Nothing to copy" }); return; }
    if (!await dialog.confirm(`Copy ${toCreate.length} entr${toCreate.length === 1 ? "y" : "ies"} (${tsH(sumH(toCreate.map(x => x.r)))}) from last week as drafts?`, { title: "Copy last week", dtype: "info" })) return;
    setBusy(true);
    try {
      for (const { r, date } of toCreate) await api.createTimesheet({ employeeId: currentUser.employee_id, projectId: r.project_id, date, hours: +r.hours, task: r.task || "" });
    } catch (e) { errAlert(e); }
    await load(true); setBusy(false);
  }

  // manager list
  const listRows = weekRows.filter(r => {
    if (filterEmp && r.employee_name !== filterEmp) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (search && !`${r.employee_name} ${r.project_code} ${r.project_name} ${r.task}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => tsDay(a).localeCompare(tsDay(b)) || String(a.employee_name).localeCompare(String(b.employee_name)));
  const approvable = listRows.filter(r => r.status === "pending" && !isMine(r));

  async function bulkApprove() {
    if (!approvable.length) return;
    if (!await dialog.confirm(`Approve ${approvable.length} pending entr${approvable.length === 1 ? "y" : "ies"} (${tsH(sumH(approvable))})?`, { title: "Approve all", dtype: "info" })) return;
    setBusy(true);
    try { for (const r of approvable) await api.approveTimesheet(r.id); } catch (e) { errAlert(e); }
    await load(true); setBusy(false);
  }

  function handleDownloadCSV(list) {
    if (!list.length) { dialog.alert("No data to download."); return; }
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["ID,Employee,Project Code,Project,Date,Hours,Task,Status",
      ...list.map(r => [r.id, esc(r.employee_name), esc(r.project_code), esc(r.project_name), tsDay(r), r.hours, esc(r.task), r.status].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `timesheets_${wStart}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ── navigation ──
  const goPrev = () => isWeek ? setWeekOf(d => addDays(d, -7)) : setMonthOf(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 });
  const goNext = () => isWeek ? setWeekOf(d => addDays(d, 7)) : setMonthOf(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 });
  const goToday = () => { const n = new Date(); setWeekOf(weekStart(n)); setMonthOf({ y: n.getFullYear(), m: n.getMonth() }); };
  const isCurrent = isWeek ? wStart === isoDate(weekStart(new Date())) : (y === new Date().getFullYear() && m === new Date().getMonth());
  const periodLabel = isWeek
    ? (() => {
      const [a, b] = [weekDays[0], weekDays[6]];
      const mo = d => MONTH_NAMES[d.getMonth()];
      if (a.getFullYear() !== b.getFullYear()) return `${mo(a)} ${a.getDate()}, ${a.getFullYear()} – ${mo(b)} ${b.getDate()}, ${b.getFullYear()}`;
      if (a.getMonth() !== b.getMonth()) return `${mo(a)} ${a.getDate()} – ${mo(b)} ${b.getDate()}, ${b.getFullYear()}`;
      return `${mo(a)} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`;
    })()
    : new Date(y, m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // ── week status banner (employee) ──
  const banner = !viewOnly || !isWeek ? null
    : ws.rejected ? { tone: C.red, icon: "⚠️", text: `${ws.rejected} entr${ws.rejected === 1 ? "y was" : "ies were"} rejected this week. Review and log corrected hours.` }
      : ws.draft ? { tone: C.accent, icon: "📝", text: `${ws.draft} draft entr${ws.draft === 1 ? "y" : "ies"} (${tsH(ws.draftH)}) not yet submitted.`, action: true }
        : ws.pending ? { tone: C.amber, icon: "⏳", text: "This week is submitted and awaiting manager approval." }
          : ws.total > 0 && ws.approved === ws.total ? { tone: C.green, icon: "✅", text: "All hours for this week are approved." }
            : null;

  const ring = (p, color, size = 96, stroke = 9) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
    );
  };

  const Pill = ({ s }) => (
    <span className="ts-pill" style={{ color: tsStatusColor(s), background: tsStatusColor(s) + "1a", borderColor: tsStatusColor(s) + "33" }}>
      <i style={{ background: tsStatusColor(s) }} />{tsStatusLabel(s)}
    </span>
  );

  // ── renderers (plain functions → no remounts) ──
  const renderEntry = r => {
    const pc = tsProjColor(r.project_id);
    const editable = canEdit(r);
    return (
      <button key={r.id} className={`ts-entry${r.status === "draft" ? " draft" : ""}`} style={{ "--pc": pc }} onClick={() => onEntryClick(r)}
        title={`${r.project_code} · ${tsH(r.hours)} · ${tsStatusLabel(r.status)}${r.task ? `\n${r.task}` : ""}`}>
        <div className="ts-entry-top">
          <span className="ts-entry-code">{r.project_code}</span>
          <span className="ts-entry-h">{tsH(r.hours)}</span>
        </div>
        {!viewOnly && <div className="ts-entry-emp">{r.employee_name}</div>}
        {r.task ? <div className="ts-entry-task">{r.task}</div> : <div className="ts-entry-task muted">{r.project_name}</div>}
        <div className="ts-entry-foot">
          <span className="ts-entry-st" style={{ color: tsStatusColor(r.status) }}><i style={{ background: tsStatusColor(r.status) }} />{tsStatusLabel(r.status)}</span>
          {editable && <span className="ts-entry-edit" aria-hidden>✎</span>}
        </div>
      </button>
    );
  };

  const renderWeek = () => (
    <div className="ts-week">
      {weekDays.map((day, i) => {
        const iso = isoDate(day);
        const list = (byDay[iso] || []);
        const tot = sumH(viewOnly ? list.filter(isMine) : list);
        const isToday = iso === todayIso;
        const we = i >= 5;
        const dp = Math.min(100, (tot / TS_DAY_TARGET) * 100);
        const over = viewOnly && tot > TS_DAY_TARGET;
        return (
          <div key={iso} className={`ts-day${isToday ? " today" : ""}${we ? " we" : ""}`}>
            <div className="ts-day-head">
              <div className="ts-day-id">
                <span className="ts-day-name">{DAY_NAMES[i]}</span>
                <span className="ts-day-num">{day.getDate()}</span>
              </div>
              <div className="ts-day-tot" style={{ color: tot ? (over ? C.amber : C.text) : C.textMuted }}>{tot ? tsH(tot) : "—"}</div>
              <div className="ts-day-bar"><div style={{ width: `${dp}%`, background: over ? C.amber : tot >= TS_DAY_TARGET ? C.green : C.accent }} /></div>
            </div>
            <div className="ts-day-body">
              {list.map(renderEntry)}
              {viewOnly && (
                <button className={`ts-add${list.length ? "" : " empty"}`} onClick={() => openAdd(iso)} aria-label={`Log time on ${day.toDateString()}`}>
                  <span>＋</span><em>{list.length ? "Add" : we ? "Log time" : "Log time"}</em>
                </button>
              )}
              {!viewOnly && !list.length && <div className="ts-day-empty">No entries</div>}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderMonth = () => {
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const grid = [];
    for (let i = 0; i < (first.getDay() + 6) % 7; i++) grid.push(null);
    for (let d = 1; d <= last.getDate(); d++) grid.push(new Date(y, m, d));
    while (grid.length % 7) grid.push(null);
    return (
      <div>
        <div className="ts-month-head">{DAY_NAMES.map((d, i) => <div key={d} className={i >= 5 ? "we" : ""}>{d}</div>)}</div>
        <div className="ts-month">
          {grid.map((day, idx) => {
            if (!day) return <div key={idx} className="ts-mcell blank" />;
            const iso = isoDate(day);
            const list = byDay[iso] || [];
            const tot = sumH(viewOnly ? list.filter(isMine) : list);
            const isToday = iso === todayIso;
            const we = [0, 6].includes(day.getDay());
            const intensity = Math.min(1, tot / TS_DAY_TARGET);
            const sts = ["rejected", "pending", "draft", "approved"].filter(s => list.some(r => r.status === s));
            return (
              <button key={iso} className={`ts-mcell${isToday ? " today" : ""}${we ? " we" : ""}`}
                style={tot ? { background: `color-mix(in srgb, ${C.accent} ${Math.round(8 + intensity * 30)}%, ${C.card})` } : undefined}
                onClick={() => (list.length || viewOnly) && setDayPanel(iso)} aria-label={`${day.toDateString()}: ${tot ? tsH(tot) : "no hours"}`}>
                <span className="ts-mnum">{day.getDate()}</span>
                {tot > 0 && <span className="ts-mh">{tsH(tot)}</span>}
                {sts.length > 0 && <span className="ts-mdots">{sts.map(s => <i key={s} style={{ background: tsStatusColor(s) }} />)}</span>}
              </button>
            );
          })}
        </div>
        <div className="ts-legend">
          {["approved", "pending", "draft", "rejected"].map(s => <span key={s}><i style={{ background: tsStatusColor(s) }} />{tsStatusLabel(s)}</span>)}
          <span className="ts-legend-scale">Less <b style={{ background: `color-mix(in srgb, ${C.accent} 10%, ${C.card})` }} /><b style={{ background: `color-mix(in srgb, ${C.accent} 22%, ${C.card})` }} /><b style={{ background: `color-mix(in srgb, ${C.accent} 38%, ${C.card})` }} /> More</span>
        </div>
      </div>
    );
  };

  const panelRows = dayPanel ? (byDay[dayPanel] || []) : [];

  return (
    <>
      <style>{`
        .ts { container-type: inline-size; container-name: ts; }
        .ts-wrap { display: flex; flex-direction: column; gap: 18px; }
        .ts-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid transparent; font-family: inherit; transition: transform .15s, opacity .15s, border-color .15s, background .15s; white-space: nowrap; }
        .ts-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .ts-btn:disabled { opacity: .5; cursor: not-allowed; }
        .ts-btn-primary { background: ${C.accent}; color: #fff; box-shadow: 0 8px 22px ${C.accent}40; }
        .ts-btn-ghost { background: ${C.surface}; color: ${C.text}; border-color: ${C.border}; }
        .ts-btn-ghost:hover:not(:disabled) { border-color: ${C.accent}77; }
        .ts-btn-danger { background: ${C.red}14; color: ${C.red}; border-color: ${C.red}40; }
        .ts-btn-success { background: ${C.green}18; color: ${C.green}; border-color: ${C.green}44; }
        .ts-icon-btn { width: 36px; height: 36px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.surface}; color: ${C.textDim}; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; font-family: inherit; flex-shrink: 0; }
        .ts-icon-btn:hover { color: ${C.text}; border-color: ${C.accent}77; }
        .ts-wrap button:focus-visible, .tsm button:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }

        /* Header */
        .ts-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
        .ts-title { margin: 0; font-size: clamp(22px, 2.4vw, 26px); font-weight: 800; color: ${C.text}; letter-spacing: -0.5px; }
        .ts-subtitle { margin: 4px 0 0; color: ${C.textMuted}; font-size: 13px; }
        .ts-head-acts { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .ts-seg { display: inline-flex; background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 12px; padding: 3px; }
        .ts-seg button { background: transparent; border: 1px solid transparent; color: ${C.textMuted}; border-radius: 9px; padding: 7px 14px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .ts-seg button.on { background: ${C.card}; color: ${C.text}; border-color: ${C.border}; box-shadow: 0 2px 8px rgba(0,0,0,.25); }

        /* Toolbar */
        .ts-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .ts-nav { display: inline-flex; align-items: center; gap: 4px; background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; padding: 4px; }
        .ts-nav button { width: 34px; height: 34px; border-radius: 10px; border: none; background: transparent; color: ${C.textDim}; font-size: 18px; cursor: pointer; font-family: inherit; }
        .ts-nav button:hover { background: ${C.surface}; color: ${C.text}; }
        .ts-nav span { min-width: 170px; text-align: center; font-size: 14px; font-weight: 800; color: ${C.text}; padding: 0 6px; }
        .ts-spacer { flex: 1; }
        .ts-sync { font-size: 12px; color: ${C.textMuted}; display: inline-flex; align-items: center; gap: 6px; }
        .ts-sync i { width: 7px; height: 7px; border-radius: 50%; background: ${C.accent}; animation: tsPulse 1s infinite ease-in-out; }
        @keyframes tsPulse { 50% { opacity: .3; } }

        .ts-banner { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 14px; border: 1px solid; font-size: 13px; font-weight: 600; flex-wrap: wrap; }
        .ts-banner span { flex: 1; min-width: 200px; }

        /* Summary */
        .ts-summary { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 16px; }
        .ts-card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 20px; padding: 18px; min-width: 0; }
        .ts-prog { display: flex; align-items: center; gap: 20px; }
        .ts-ring { position: relative; width: 96px; height: 96px; flex-shrink: 0; }
        .ts-ring div { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .ts-ring b { font-size: 20px; font-weight: 800; color: ${C.text}; line-height: 1; }
        .ts-ring small { font-size: 10px; color: ${C.textMuted}; font-weight: 700; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; }
        .ts-stats { flex: 1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; min-width: 0; }
        .ts-stat { background: ${C.surface}; border: 1px solid ${C.border}66; border-radius: 14px; padding: 12px; min-width: 0; }
        .ts-stat-v { font-size: 20px; font-weight: 800; letter-spacing: -0.4px; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .ts-stat-l { font-size: 11.5px; color: ${C.textMuted}; font-weight: 600; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ts-card-h { font-size: 13.5px; font-weight: 800; color: ${C.text}; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .ts-card-h small { font-size: 11.5px; color: ${C.textMuted}; font-weight: 600; }
        .ts-projbar { height: 10px; border-radius: 6px; overflow: hidden; display: flex; background: ${C.border}; margin-bottom: 12px; }
        .ts-projbar div { height: 100%; }
        .ts-projlist { display: flex; flex-direction: column; gap: 8px; }
        .ts-projrow { display: flex; align-items: center; gap: 8px; font-size: 12.5px; min-width: 0; }
        .ts-projrow i { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
        .ts-projrow span { flex: 1; min-width: 0; color: ${C.text}; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ts-projrow b { color: ${C.textDim}; font-weight: 700; font-variant-numeric: tabular-nums; }
        .ts-muted { color: ${C.textMuted}; font-size: 12.5px; }

        /* Week */
        .ts-cal { padding: 14px; }
        .ts-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; }
        .ts-day { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 16px; padding: 12px 10px; display: flex; flex-direction: column; gap: 10px; min-height: 230px; min-width: 0; }
        .ts-day.we { background: ${C.bg}; }
        .ts-day.today { border-color: ${C.accent}88; box-shadow: 0 0 0 3px ${C.accentGlow}; background: linear-gradient(180deg, ${C.accent}12, ${C.surface} 40%); }
        .ts-day-head { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 6px 8px; }
        .ts-day-id { display: flex; flex-direction: column; gap: 2px; }
        .ts-day-name { font-size: 10.5px; font-weight: 800; color: ${C.textMuted}; letter-spacing: .8px; text-transform: uppercase; }
        .ts-day-num { font-size: 20px; font-weight: 800; color: ${C.text}; line-height: 1; }
        .ts-day.we .ts-day-num { color: ${C.textMuted}; }
        .ts-day.today .ts-day-num { color: ${C.accent}; }
        .ts-day-tot { font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .ts-day-bar { grid-column: 1 / -1; height: 4px; border-radius: 4px; background: ${C.border}; overflow: hidden; }
        .ts-day-bar div { height: 100%; border-radius: 4px; transition: width .5s ease; }
        .ts-day-body { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
        .ts-entry { text-align: left; font-family: inherit; cursor: pointer; width: 100%; background: ${C.card}; border: 1px solid ${C.border}; border-left: 3px solid var(--pc); border-radius: 10px; padding: 8px 9px; display: flex; flex-direction: column; gap: 3px; transition: transform .12s, border-color .12s, box-shadow .12s; min-width: 0; }
        .ts-entry:hover { transform: translateY(-1px); box-shadow: 0 6px 18px -8px rgba(0,0,0,.6); border-color: color-mix(in srgb, var(--pc) 50%, ${C.border}); border-left-color: var(--pc); }
        .ts-entry.draft { border-style: dashed; border-left-style: solid; }
        .ts-entry-top { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
        .ts-entry-code { font-size: 11.5px; font-weight: 800; color: var(--pc); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ts-entry-h { font-size: 12.5px; font-weight: 800; color: ${C.text}; font-variant-numeric: tabular-nums; flex-shrink: 0; }
        .ts-entry-emp { font-size: 11px; color: ${C.textDim}; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ts-entry-task { font-size: 11px; color: ${C.textDim}; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
        .ts-entry-task.muted { color: ${C.textMuted}; }
        .ts-entry-foot { display: flex; justify-content: space-between; align-items: center; }
        .ts-entry-st { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; }
        .ts-entry-st i, .ts-pill i, .ts-legend i, .ts-mdots i { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .ts-entry-edit { color: ${C.textMuted}; font-size: 12px; }
        .ts-add { margin-top: auto; display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 8px; border-radius: 10px; border: 1px dashed ${C.border}; background: transparent; color: ${C.textMuted}; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; transition: all .15s; }
        .ts-add span { font-size: 15px; line-height: 1; }
        .ts-add em { font-style: normal; }
        .ts-add.empty { flex: 1; min-height: 70px; flex-direction: column; }
        .ts-add:hover { border-color: ${C.accent}; color: ${C.accent}; background: ${C.accent}0d; }
        .ts-day-empty { margin-top: auto; text-align: center; font-size: 11.5px; color: ${C.textMuted}; padding: 10px 0; }

        /* Month */
        .ts-month-head, .ts-month { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
        .ts-month-head div { text-align: center; font-size: 11px; font-weight: 800; color: ${C.textMuted}; letter-spacing: .6px; text-transform: uppercase; padding: 4px 0 8px; }
        .ts-month-head div.we { opacity: .6; }
        .ts-mcell { position: relative; min-height: 84px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.surface}; padding: 8px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; cursor: pointer; font-family: inherit; text-align: left; transition: transform .12s, border-color .12s; min-width: 0; }
        .ts-mcell:hover:not(.blank) { transform: translateY(-1px); border-color: ${C.accent}77; }
        .ts-mcell.blank { background: transparent; border-color: transparent; cursor: default; }
        .ts-mcell.we { opacity: .85; }
        .ts-mcell.today { border-color: ${C.accent}; box-shadow: 0 0 0 2px ${C.accentGlow}; }
        .ts-mnum { font-size: 12.5px; font-weight: 800; color: ${C.text}; }
        .ts-mcell.today .ts-mnum { background: ${C.accent}; color: #fff; border-radius: 999px; padding: 1px 7px; }
        .ts-mh { font-size: 14px; font-weight: 800; color: ${C.text}; margin-top: auto; font-variant-numeric: tabular-nums; }
        .ts-mdots { display: flex; gap: 3px; position: absolute; top: 10px; right: 8px; }
        .ts-legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 14px; font-size: 11.5px; color: ${C.textMuted}; align-items: center; }
        .ts-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .ts-legend-scale { margin-left: auto; }
        .ts-legend-scale b { width: 14px; height: 14px; border-radius: 4px; border: 1px solid ${C.border}; display: inline-block; }

        /* Pills */
        .ts-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; border: 1px solid; white-space: nowrap; }

        /* Manager list */
        .ts-list-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 16px 18px; border-bottom: 1px solid ${C.border}; }
        .ts-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .ts-select, .ts-search { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 10px; color: ${C.text}; padding: 8px 12px; font-size: 13px; outline: none; font-family: inherit; }
        .ts-search { min-width: 180px; }
        .ts-select:focus, .ts-search:focus { border-color: ${C.accent}; }
        .ts-lrow { display: grid; grid-template-columns: 1.4fr 0.9fr 0.8fr 0.5fr 1.6fr 0.8fr 1fr; gap: 10px; align-items: center; padding: 11px 18px; border-bottom: 1px solid ${C.border}44; font-size: 13px; }
        .ts-lrow:last-child { border-bottom: none; }
        .ts-lrow:not(.head):hover { background: ${C.accentGlow}; }
        .ts-lrow.head { background: ${C.surface}; font-size: 11px; font-weight: 800; color: ${C.textMuted}; letter-spacing: .5px; text-transform: uppercase; padding: 9px 18px; }
        .ts-lemp { display: flex; align-items: center; gap: 8px; min-width: 0; font-weight: 700; color: ${C.text}; }
        .ts-lemp span:last-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ts-avi { width: 28px; height: 28px; border-radius: 50%; background: ${C.accent}22; color: ${C.accent}; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ts-code { font-size: 12px; font-weight: 800; padding: 2px 8px; border-radius: 6px; border: 1px solid; width: fit-content; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ts-ltask { color: ${C.textDim}; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ts-lacts { display: flex; gap: 6px; }
        .ts-lacts button { border-radius: 8px; font-size: 12px; font-weight: 700; padding: 5px 10px; cursor: pointer; border: 1px solid; font-family: inherit; }
        .ts-empty { padding: 44px 20px; text-align: center; color: ${C.textMuted}; font-size: 13.5px; }
        .ts-empty div { font-size: 30px; margin-bottom: 8px; }

        /* Day panel + entry modal */
        .tsm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.66); backdrop-filter: blur(3px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .tsm { width: 100%; max-width: 560px; max-height: min(92vh, 860px); display: flex; flex-direction: column; background: ${C.card}; border: 1px solid ${C.border}; border-radius: 22px; box-shadow: 0 30px 80px rgba(0,0,0,.6); overflow: hidden; animation: tsmIn .18s ease-out; }
        @keyframes tsmIn { from { transform: translateY(12px); opacity: 0; } }
        .tsm-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 20px 22px 14px; border-bottom: 1px solid ${C.border}; }
        .tsm-title { font-size: 18px; font-weight: 800; color: ${C.text}; }
        .tsm-sub { font-size: 12.5px; color: ${C.textMuted}; margin-top: 3px; }
        .tsm-body { padding: 18px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; }
        .tsm-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px 22px; border-top: 1px solid ${C.border}; background: ${C.surface}; flex-wrap: wrap; }
        .tsm-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .tsm-lbl { font-size: 12.5px; font-weight: 800; color: ${C.textDim}; }
        .tsm-mini { font-size: 11.5px; color: ${C.textMuted}; font-weight: 600; }
        .tsm-input { width: 100%; box-sizing: border-box; background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 12px; color: ${C.text}; padding: 10px 12px; font-size: 14px; font-family: inherit; outline: none; resize: vertical; }
        .tsm-input:focus { border-color: ${C.accent}; box-shadow: 0 0 0 3px ${C.accentGlow}; }
        .tsm-input.err { border-color: ${C.red}; }
        .tsm-err { font-size: 12px; color: ${C.red}; font-weight: 600; }
        .tsm-warn { font-size: 12px; color: ${C.amber}; font-weight: 600; }
        .tsm-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .tsm-chip { --c: ${C.accent}; display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.surface}; color: ${C.text}; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .tsm-chip:hover { border-color: ${C.accent}88; }
        .tsm-chip.on { background: ${C.accent}; border-color: ${C.accent}; color: #fff; }
        .tsm-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c); }
        .tsm-chip.on .tsm-dot { background: #fff; }
        .tsm-link { background: none; border: none; color: ${C.accent}; font-size: 12px; font-weight: 700; cursor: pointer; padding: 2px 4px; font-family: inherit; }
        .tsm-proj { border: 1px solid ${C.border}; border-radius: 14px; background: ${C.surface}; overflow: hidden; }
        .tsm-proj.err { border-color: ${C.red}; }
        .tsm-search { border: none; border-bottom: 1px solid ${C.border}; border-radius: 0; background: transparent; }
        .tsm-search:focus { box-shadow: none; }
        .tsm-proj-list { max-height: 196px; overflow-y: auto; padding: 4px; }
        .tsm-proj-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; background: none; border: 1px solid transparent; border-radius: 10px; padding: 8px; cursor: pointer; font-family: inherit; color: ${C.text}; }
        .tsm-proj-item:hover { background: ${C.card}; }
        .tsm-proj-item.on { background: ${C.accent}18; border-color: ${C.accent}55; }
        .tsm-proj-badge { width: 40px; height: 30px; border-radius: 8px; border: 1px solid; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; flex-shrink: 0; overflow: hidden; }
        .tsm-proj-name { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .tsm-proj-name b { font-size: 13px; }
        .tsm-proj-name span { font-size: 11.5px; color: ${C.textMuted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tsm-check { color: ${C.accent}; font-weight: 800; }
        .tsm-none { padding: 16px; text-align: center; font-size: 12.5px; color: ${C.textMuted}; }
        .tsm-hours-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .tsm-stepper { display: flex; align-items: center; gap: 6px; }
        .tsm-stepper input { width: 84px; text-align: center; font-size: 16px; font-weight: 800; }
        .tsm-stepper button { width: 38px; height: 42px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.surface}; color: ${C.text}; font-size: 18px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .tsm-stepper button:hover { border-color: ${C.accent}88; }
        .tsm-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
        .tsm-day { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.surface}; color: ${C.textDim}; cursor: pointer; font-family: inherit; }
        .tsm-day span { font-size: 10.5px; font-weight: 800; }
        .tsm-day b { font-size: 15px; color: ${C.text}; }
        .tsm-day.we { opacity: .75; }
        .tsm-day.on { background: ${C.accent}; border-color: ${C.accent}; color: #fff; opacity: 1; }
        .tsm-day.on b { color: #fff; }
        .tsm-prow { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: ${C.surface}; border: 1px solid ${C.border}; border-left: 3px solid var(--pc); border-radius: 12px; }

        /* ── Responsive (container) ── */
        @container ts (max-width: 1100px) {
          .ts-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ts-entry-task { -webkit-line-clamp: 1; }
        }
        @container ts (max-width: 900px) {
          .ts-summary { grid-template-columns: 1fr; }
          .ts-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          /* week → agenda list */
          .ts-week { grid-template-columns: 1fr; gap: 8px; }
          .ts-day { min-height: 0; display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 12px; padding: 12px; }
          .ts-day-head { grid-template-columns: 1fr; align-content: start; gap: 6px; }
          .ts-day-id { flex-direction: row; align-items: baseline; gap: 6px; }
          .ts-day-body { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; align-content: start; }
          .ts-add, .ts-add.empty { margin-top: 0; min-height: 0; flex-direction: row; padding: 10px; }
          .ts-entry-task { -webkit-line-clamp: 2; }
          .ts-day-empty { margin: 0; text-align: left; padding: 6px 0; }
          .ts-lrow { grid-template-columns: 1.3fr 0.9fr 0.8fr 0.5fr 0.9fr 1fr; }
          .ts-lrow > :nth-child(5) { display: none; }
        }
        @container ts (max-width: 640px) {
          .ts-wrap { gap: 14px; }
          .ts-header { align-items: stretch; }
          .ts-head-acts { width: 100%; }
          .ts-head-acts .ts-seg { flex: 1; }
          .ts-head-acts .ts-seg button { flex: 1; }
          .ts-toolbar { gap: 8px; }
          .ts-nav { flex: 1 1 100%; justify-content: space-between; }
          .ts-nav span { min-width: 0; font-size: 13px; }
          .ts-toolbar .ts-btn { flex: 1; }
          .ts-spacer { display: none; }
          .ts-card { padding: 14px; border-radius: 18px; }
          .ts-prog { flex-direction: column; align-items: stretch; gap: 14px; }
          .ts-ring { align-self: center; }
          .ts-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .ts-stat-v { font-size: 18px; }
          .ts-cal { padding: 10px; }
          .ts-day { grid-template-columns: 1fr; gap: 10px; }
          .ts-day-head { grid-template-columns: 1fr auto; }
          .ts-day-body { grid-template-columns: 1fr; }
          .ts-month-head, .ts-month { gap: 4px; }
          .ts-mcell { min-height: 56px; padding: 6px; border-radius: 10px; }
          .ts-mh { font-size: 11.5px; }
          .ts-mdots { top: 7px; right: 5px; }
          .ts-mdots i { width: 5px; height: 5px; }
          .ts-legend-scale { margin-left: 0; }
          .ts-list-head { padding: 14px; }
          .ts-filters, .ts-filters > * { width: 100%; }
          .ts-search { min-width: 0; box-sizing: border-box; }
          .ts-lrow.head { display: none; }
          .ts-lrow { grid-template-columns: 1fr auto; grid-template-areas: "emp hrs" "proj st" "date act"; padding: 14px; gap: 8px; }
          .ts-lrow > :nth-child(1) { grid-area: emp; }
          .ts-lrow > :nth-child(2) { grid-area: proj; }
          .ts-lrow > :nth-child(3) { grid-area: date; }
          .ts-lrow > :nth-child(4) { grid-area: hrs; text-align: right; }
          .ts-lrow > :nth-child(6) { grid-area: st; justify-self: end; }
          .ts-lrow > :nth-child(7) { grid-area: act; justify-self: end; }
        }
        /* Modals live outside the container → use a viewport media query */
        @media (max-width: 640px) {
          .tsm-backdrop { align-items: flex-end; padding: 0; }
          .tsm { max-width: none; border-radius: 22px 22px 0 0; max-height: 94vh; animation: tsmUp .22s ease-out; }
          @keyframes tsmUp { from { transform: translateY(40px); opacity: 0; } }
          .tsm-head, .tsm-body, .tsm-foot { padding-left: 16px; padding-right: 16px; }
          .tsm-foot > div { flex: 1; }
          .tsm-foot > div .ts-btn { flex: 1; }
          .tsm-kbd { display: none; }
          .tsm-days { gap: 4px; }
          .tsm-stepper input { width: 70px; }
        }
      `}</style>

      <div className="ts">
        <div className="ts-wrap">

          {/* Header */}
          <div className="ts-header">
            <div>
              <h2 className="ts-title">{viewOnly ? "My Timesheets" : "Timesheets"}</h2>
              <p className="ts-subtitle">{viewOnly ? "Track your hours, then submit the week for approval" : "Review and approve team timesheet entries"}</p>
            </div>
            <div className="ts-head-acts">
              <div className="ts-seg" role="tablist" aria-label="Calendar view">
                {[["week", "Week"], ["month", "Month"]].map(([v, l]) => (
                  <button key={v} role="tab" aria-selected={calView === v} className={calView === v ? "on" : ""} onClick={() => setCalView(v)}>{l}</button>
                ))}
              </div>
              {viewOnly && <button className="ts-btn ts-btn-primary" onClick={() => openAdd()}>＋ Log time</button>}
            </div>
          </div>

          {/* Toolbar */}
          <div className="ts-toolbar">
            <div className="ts-nav">
              <button onClick={goPrev} aria-label={isWeek ? "Previous week" : "Previous month"}>‹</button>
              <span>{periodLabel}</span>
              <button onClick={goNext} aria-label={isWeek ? "Next week" : "Next month"}>›</button>
            </div>
            {!isCurrent && <button className="ts-btn ts-btn-ghost" onClick={goToday}>Today</button>}
            {refreshing && <span className="ts-sync"><i />Syncing…</span>}
            <div className="ts-spacer" />
            {viewOnly && isWeek && <button className="ts-btn ts-btn-ghost" onClick={handleCopyLastWeek} disabled={busy}>⧉ Copy last week</button>}
            {viewOnly && isWeek && ws.draft > 0 && (
              <button className="ts-btn ts-btn-primary" onClick={handleSubmitWeek} disabled={busy}>📤 {busy ? "Working…" : `Submit week (${ws.draft})`}</button>
            )}
          </div>

          {banner && (
            <div className="ts-banner" style={{ color: banner.tone, background: banner.tone + "12", borderColor: banner.tone + "40" }} role="status">
              <b style={{ fontSize: 16 }}>{banner.icon}</b><span>{banner.text}</span>
            </div>
          )}

          {/* Summary */}
          <div className="ts-summary">
            <div className="ts-card">
              <div className="ts-prog">
                <div className="ts-ring">
                  {ring(pct, pct >= 100 ? C.green : C.accent)}
                  <div><b>{pct}%</b><small>{viewOnly ? `of ${target}h` : "approved"}</small></div>
                </div>
                <div className="ts-stats">
                  {[
                    { l: isWeek ? "Logged this week" : "Logged this month", v: tsH(st.total), c: C.accent },
                    { l: "Approved", v: tsH(st.approved), c: C.green },
                    { l: "Awaiting approval", v: st.pending, c: C.amber },
                    isWeek ? { l: "Drafts", v: st.draft, c: C.textDim } : { l: "Days logged", v: monthDaysLogged, c: C.purple },
                  ].map(s => (
                    <div key={s.l} className="ts-stat">
                      <div className="ts-stat-v" style={{ color: s.c }}>{s.v}</div>
                      <div className="ts-stat-l">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="ts-card">
              <div className="ts-card-h">By project <small>{projAgg.length} project{projAgg.length !== 1 ? "s" : ""}</small></div>
              {projAgg.length === 0 ? <div className="ts-muted">No hours logged {isWeek ? "this week" : "this month"} yet.</div> : (
                <>
                  <div className="ts-projbar">{projAgg.map(p => <div key={p.id} title={`${p.code}: ${tsH(p.hours)}`} style={{ width: `${(p.hours / st.total) * 100}%`, background: tsProjColor(p.id) }} />)}</div>
                  <div className="ts-projlist">
                    {projAgg.slice(0, 4).map(p => (
                      <div key={p.id} className="ts-projrow"><i style={{ background: tsProjColor(p.id) }} /><span title={p.name}>{p.code}{p.name ? ` · ${p.name}` : ""}</span><b>{tsH(p.hours)}</b></div>
                    ))}
                    {projAgg.length > 4 && <div className="ts-muted">+{projAgg.length - 4} more</div>}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Calendar */}
          <div className="ts-card ts-cal">{isWeek ? renderWeek() : renderMonth()}</div>

          {/* Manager / admin list */}
          {!viewOnly && (
            <div className="ts-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="ts-list-head">
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>Weekly requests</div>
                  <div className="ts-muted">{listRows.length} entr{listRows.length === 1 ? "y" : "ies"} · {tsH(sumH(listRows))} · {periodLabel}</div>
                </div>
                <div className="ts-filters">
                  <input className="ts-search" placeholder="Search employee, project, task…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search entries" />
                  <select className="ts-select" value={filterEmp} onChange={e => setFilterEmp(e.target.value)} aria-label="Filter by employee">
                    <option value="">All employees</option>
                    {Array.from(new Set(weekRows.map(r => r.employee_name))).sort().map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select className="ts-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} aria-label="Filter by status">
                    <option value="all">All statuses</option>
                    <option value="pending">Submitted</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="draft">Draft</option>
                  </select>
                  {approvable.length > 0 && <button className="ts-btn ts-btn-success" onClick={bulkApprove} disabled={busy}>✓ Approve all ({approvable.length})</button>}
                  <button className="ts-btn ts-btn-ghost" onClick={() => handleDownloadCSV(listRows)}>📥 CSV</button>
                </div>
              </div>
              <div className="ts-lrow head">{["Employee", "Project", "Date", "Hours", "Task", "Status", "Action"].map(h => <div key={h}>{h}</div>)}</div>
              {listRows.length === 0 ? (
                <div className="ts-empty"><div>📭</div>No entries match for this week</div>
              ) : listRows.map(r => (
                <div key={r.id} className="ts-lrow">
                  <div className="ts-lemp"><span className="ts-avi">{mkAvi(r.employee_name || "")}</span><span>{r.employee_name}</span></div>
                  <div><span className="ts-code" style={{ color: tsProjColor(r.project_id), background: tsProjColor(r.project_id) + "14", borderColor: tsProjColor(r.project_id) + "40" }} title={r.project_name}>{r.project_code}</span></div>
                  <div style={{ color: C.textDim, fontSize: 12.5 }}>{new Date(tsDay(r) + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
                  <div style={{ fontWeight: 800, color: C.text }}>{tsH(r.hours)}</div>
                  <div className="ts-ltask" title={r.task}>{r.task || "—"}</div>
                  <div><Pill s={r.status} /></div>
                  <div className="ts-lacts">
                    {r.status === "pending" && !isMine(r) && (<>
                      <button onClick={() => handleApprove(r.id)} style={{ background: C.green + "18", borderColor: C.green + "44", color: C.green }}>✓ Approve</button>
                      <button onClick={() => handleReject(r.id)} aria-label="Reject" style={{ background: C.red + "18", borderColor: C.red + "44", color: C.red }}>✕</button>
                    </>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Entry modal */}
      {entry && (
        <TsEntryModal
          key={entry.id || entry.date}
          init={entry}
          projects={modalProjects}
          recentIds={recentIds}
          dayTotals={dayTotals}
          onClose={() => setEntry(null)}
          onSubmit={saveEntry}
          onDelete={deleteEntry}
        />
      )}

      {/* Day panel */}
      {dayPanel && (
        <div className="tsm-backdrop" onClick={() => setDayPanel(null)}>
          <div className="tsm" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} onKeyDown={e => e.key === "Escape" && setDayPanel(null)}>
            <div className="tsm-head">
              <div>
                <div className="tsm-title">{new Date(dayPanel + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
                <div className="tsm-sub">{panelRows.length} entr{panelRows.length === 1 ? "y" : "ies"} · {tsH(sumH(panelRows))}</div>
              </div>
              <button className="ts-icon-btn" onClick={() => setDayPanel(null)} aria-label="Close">✕</button>
            </div>
            <div className="tsm-body" style={{ gap: 10 }}>
              {panelRows.length === 0 && <div className="ts-empty" style={{ padding: "24px 0" }}><div>🗓</div>Nothing logged on this day</div>}
              {panelRows.map(r => (
                <div key={r.id} className="tsm-prow" style={{ "--pc": tsProjColor(r.project_id) }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {!viewOnly && <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim }}>{r.employee_name}</div>}
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{r.project_code} <span style={{ color: C.textMuted, fontWeight: 600, fontSize: 12.5 }}>{r.project_name}</span></div>
                    {r.task && <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 3, overflowWrap: "anywhere" }}>{r.task}</div>}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                      <b style={{ color: C.text, fontSize: 14 }}>{tsH(r.hours)}</b><Pill s={r.status} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    {canEdit(r) && <button className="ts-btn ts-btn-ghost" style={{ padding: "7px 12px" }} onClick={() => { setDayPanel(null); openEdit(r); }}>✎ Edit</button>}
                    {!viewOnly && r.status === "pending" && !isMine(r) && (<>
                      <button className="ts-btn ts-btn-success" style={{ padding: "7px 12px" }} onClick={() => handleApprove(r.id)}>✓ Approve</button>
                      <button className="ts-btn ts-btn-danger" style={{ padding: "7px 12px" }} onClick={() => handleReject(r.id)}>✕ Reject</button>
                    </>)}
                  </div>
                </div>
              ))}
            </div>
            {viewOnly && (
              <div className="tsm-foot">
                <span className="tsm-mini">{tsH(dayTotals[dayPanel] || 0)} of {TS_DAY_TARGET}h</span>
                <button className="ts-btn ts-btn-primary" onClick={() => { const d = dayPanel; setDayPanel(null); openAdd(d); }}>＋ Log time</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
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

// ── Leave helpers (module-level so modal inputs keep focus) ──
const LV_TYPES = [
  { value: "Annual", label: "Annual / Vacation", icon: "🌴", color: "#3B82F6", hint: "Uses balance" },
  { value: "Sick", label: "Sick leave", icon: "🤒", color: "#EF4444", hint: "Uses balance" },
  { value: "Unpaid", label: "Unpaid", icon: "⏸", color: "#94A3B8", hint: "No balance needed" },
  { value: "Reserve", label: "Reserve / Floating", icon: "🗓️", color: "#06B6D4", hint: "Floating holiday" },
  { value: "Maternity", label: "Maternity", icon: "🤰", color: "#EC4899", hint: "Statutory" },
  { value: "Paternity", label: "Paternity", icon: "👶", color: "#8B5CF6", hint: "Statutory" },
];
const lvType = t => LV_TYPES.find(x => x.value === t) || { value: t, label: t, icon: "📋", color: "#94A3B8" };
const lvISO = d => String(d || "").slice(0, 10);
const lvDate = s => { const [y, m, d] = lvISO(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const lvDays = (s, e, half) => {
  if (!s || !e) return 0;
  if (half && lvISO(s) === lvISO(e)) return 0.5;
  const n = Math.round((lvDate(e) - lvDate(s)) / 86400000) + 1;
  return n > 0 ? n : 0;
};
const lvWeekendDays = (s, e) => {
  if (!s || !e) return 0;
  let n = 0; const end = lvDate(e);
  for (let d = lvDate(s); d <= end; d.setDate(d.getDate() + 1)) if ([0, 6].includes(d.getDay())) n++;
  return n;
};
const lvFmt = (s, opts = { day: "numeric", month: "short" }) => lvDate(s).toLocaleDateString("en-GB", opts);
const lvRange = (s, e) => lvISO(s) === lvISO(e) ? lvFmt(s, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
  : `${lvFmt(s)} – ${lvFmt(e, { day: "numeric", month: "short", year: "numeric" })}`;
const lvToday = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };
const lvAddDays = (iso, n) => { const d = lvDate(iso); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const lvStatusColor = s => s === "approved" ? C.green : s === "rejected" ? C.red : C.amber;

function LvRequestModal({ init, isEdit, admin, employees, balance, showBalance, otherLeaves, onEmployeeChange, onClose, onSubmit }) {
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const days = lvDays(f.startDate, f.endDate, f.isHalfDay);
  const weekend = f.isHalfDay ? 0 : lvWeekendDays(f.startDate, f.endDate);
  const usesBal = BALANCE_TYPES.has(f.type) && showBalance;
  // pending edits already reserved their days → add them back for the check
  const reserved = isEdit && BALANCE_TYPES.has(init.type) ? lvDays(init.startDate, init.endDate, init.isHalfDay) : 0;
  const available = balance ? (parseFloat(balance.balance) || 0) + reserved : null;
  const after = available !== null ? available - days : null;
  const insufficient = usesBal && available !== null && days > available;
  const overlaps = (otherLeaves || []).filter(l => (admin ? String(l.employee_id) === String(f.employeeId) : true)
    && ["pending", "approved"].includes(l.status) && l.id !== init.id
    && f.startDate && f.endDate && lvISO(l.start_date) <= f.endDate && lvISO(l.end_date) >= f.startDate);

  const errs = {
    employee: admin && !isEdit && !f.employeeId ? "Choose an employee" : null,
    dates: !f.startDate || !f.endDate ? "Pick your dates" : f.endDate < f.startDate ? "End date is before start date" : null,
    balance: insufficient ? `Only ${available} day${available !== 1 ? "s" : ""} available — reduce the dates or choose Unpaid.` : null,
    overlap: overlaps.length ? `Overlaps an existing ${overlaps[0].status} request (${lvRange(overlaps[0].start_date, overlaps[0].end_date)}).` : null,
  };
  const valid = !errs.employee && !errs.dates && !errs.balance && !errs.overlap;

  const today = lvToday();
  const presets = [
    { l: "Today", s: today, e: today },
    { l: "Tomorrow", s: lvAddDays(today, 1), e: lvAddDays(today, 1) },
    (() => { const d = lvDate(today); const toMon = (8 - d.getDay()) % 7 || 7; const s = lvAddDays(today, toMon); return { l: "Next week", s, e: lvAddDays(s, 4) }; })(),
  ];

  async function submit() {
    setTried(true);
    if (!valid || busy) return;
    setBusy(true);
    const ok = await onSubmit({ ...f, reason: (f.reason || "").trim() });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <div className="lvm-backdrop" onClick={onClose}>
      <div className="lvm" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit leave request" : "Request leave"} onClick={e => e.stopPropagation()}>
        <div className="lvm-head">
          <div>
            <div className="lvm-title">{isEdit ? "Edit request" : "Request time off"}</div>
            <div className="lvm-sub">{isEdit ? "Changes keep the request pending for re-review" : "Your manager will be notified"}</div>
          </div>
          <button className="lv-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="lvm-body">
          {admin && !isEdit && (
            <div className="lvm-field">
              <label className="lvm-lbl" htmlFor="lvm-emp">Employee</label>
              <select id="lvm-emp" className={`lvm-input${tried && errs.employee ? " err" : ""}`} value={f.employeeId}
                onChange={e => { set("employeeId", e.target.value); onEmployeeChange(e.target.value); }}>
                <option value="">Select employee…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              {tried && errs.employee && <div className="lvm-err">{errs.employee}</div>}
            </div>
          )}

          <div className="lvm-field">
            <label className="lvm-lbl">Leave type</label>
            <div className="lvm-types" role="radiogroup" aria-label="Leave type">
              {LV_TYPES.map(t => {
                const on = f.type === t.value;
                return (
                  <button key={t.value} role="radio" aria-checked={on} className={`lvm-type${on ? " on" : ""}`} style={{ "--t": t.color }} onClick={() => set("type", t.value)}>
                    <span className="lvm-type-ico">{t.icon}</span>
                    <span className="lvm-type-txt"><b>{t.label}</b><small>{BALANCE_TYPES.has(t.value) && !showBalance ? "—" : t.hint}</small></span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lvm-field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label className="lvm-lbl">Dates</label>
              <div className="lvm-presets">
                {presets.map(p => <button key={p.l} className="lvm-chip" onClick={() => setF(x => ({ ...x, startDate: p.s, endDate: p.e, isHalfDay: false }))}>{p.l}</button>)}
              </div>
            </div>
            <div className="lvm-dates">
              <div>
                <label className="lvm-mini" htmlFor="lvm-start">From</label>
                <input id="lvm-start" type="date" className={`lvm-input${tried && errs.dates && !f.startDate ? " err" : ""}`} value={f.startDate}
                  onChange={e => { const v = e.target.value; setF(x => ({ ...x, startDate: v, endDate: x.isHalfDay || !x.endDate || x.endDate < v ? v : x.endDate })); }} />
              </div>
              <div>
                <label className="lvm-mini" htmlFor="lvm-end">To</label>
                <input id="lvm-end" type="date" min={f.startDate || undefined} className={`lvm-input${tried && errs.dates && f.startDate ? " err" : ""}`} value={f.endDate}
                  disabled={f.isHalfDay} onChange={e => set("endDate", e.target.value)} />
              </div>
            </div>
            <label className={`lvm-toggle${!f.startDate ? " disabled" : ""}`}>
              <input type="checkbox" checked={f.isHalfDay} disabled={!f.startDate}
                onChange={e => setF(x => ({ ...x, isHalfDay: e.target.checked, endDate: e.target.checked ? x.startDate : x.endDate }))} />
              <span className="lvm-switch" aria-hidden />
              Half day <span className="lvm-mini">(0.5 day, single date)</span>
            </label>
            {tried && errs.dates && <div className="lvm-err">{errs.dates}</div>}
          </div>

          {/* Summary / balance impact */}
          {days > 0 && (
            <div className={`lvm-summary${errs.balance || errs.overlap ? " bad" : ""}`}>
              <div className="lvm-sum-row">
                <div>
                  <div className="lvm-sum-big">{days} <small>day{days !== 1 ? "s" : ""}</small></div>
                  <div className="lvm-mini">{lvRange(f.startDate, f.endDate)}{weekend > 0 ? ` · includes ${weekend} weekend day${weekend !== 1 ? "s" : ""}` : ""}</div>
                </div>
                {usesBal && available !== null && (
                  <div style={{ textAlign: "right" }}>
                    <div className="lvm-mini">Balance after</div>
                    <div className="lvm-sum-big" style={{ color: insufficient ? C.red : after < 2 ? C.amber : C.green }}>{insufficient ? "—" : after}<small> / {available}</small></div>
                  </div>
                )}
              </div>
              {usesBal && available !== null && available > 0 && (
                <div className="lvm-bar">
                  <div style={{ width: `${Math.min(100, (Math.max(after, 0) / available) * 100)}%`, background: C.green }} />
                  <div style={{ width: `${Math.min(100, (Math.min(days, available) / available) * 100)}%`, background: insufficient ? C.red : C.amber }} />
                </div>
              )}
              {weekend > 0 && !errs.balance && <div className="lvm-note">ℹ Leave is counted in calendar days, so weekends inside the range are included.</div>}
              {errs.balance && <div className="lvm-err">⚠ {errs.balance}</div>}
              {errs.overlap && <div className="lvm-err">⚠ {errs.overlap}</div>}
            </div>
          )}

          <div className="lvm-field">
            <label className="lvm-lbl" htmlFor="lvm-reason">Reason <span className="lvm-mini">optional</span></label>
            <textarea id="lvm-reason" className="lvm-input" rows={3} maxLength={300} value={f.reason} onChange={e => set("reason", e.target.value)} placeholder="e.g. Family function, doctor's appointment…" />
            <div className="lvm-mini" style={{ textAlign: "right" }}>{(f.reason || "").length}/300</div>
          </div>
        </div>

        <div className="lvm-foot">
          <button className="lv-btn lv-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="lv-btn lv-btn-primary" onClick={submit} disabled={busy || (tried && !valid)}>
            {busy ? "Saving…" : isEdit ? "Save changes" : days > 0 ? `Request ${days} day${days !== 1 ? "s" : ""}` : "Submit request"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Leaves({ currentUser, viewOnly }) {
  const [rows, setRows] = useState([]); const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState("");
  const [balance, setBalance] = useState(null);
  const [formBalance, setFormBalance] = useState(null);
  const [crediting, setCrediting] = useState(false);
  const [leaveSettings, setLeaveSettings] = useState({});
  const [allBalances, setAllBalances] = useState({});
  const [settingsModal, setSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ holiday_link: "" });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [reqModal, setReqModal] = useState(null); // { init, isEdit }
  const [view, setView] = useState("list");      // list | calendar
  const [statusTab, setStatusTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [lvPage, setLvPage] = useState(1);
  const [lvPerPage, setLvPerPage] = useState(10);
  const [actingId, setActingId] = useState(null);

  const load = async (silent) => {
    if (!silent) setLoading(true);
    setErr("");
    try {
      const params = {}; if (viewOnly) params.employee_id = currentUser.employee_id;
      const [lv, em, bal, settings, allBal] = await Promise.all([
        api.getLeaves(params),
        api.getEmployees(),
        api.getLeaveBalance(viewOnly ? currentUser.employee_id : undefined).catch(() => null),
        api.getLeaveSettings().catch(() => ({})),
        (!viewOnly ? api.getAllLeaveBalances().catch(() => ({})) : Promise.resolve({})),
      ]);
      setRows(lv || []); setEmployees(em || []); setBalance(bal);
      setLeaveSettings(settings || {});
      setSettingsForm({ holiday_link: settings?.holiday_link || "" });
      setAllBalances(allBal || {});
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setLvPage(1); }, [statusTab, typeFilter, search]);

  const errAlert = e => dialog.alert(e.message, { title: "Error", dtype: "error" });
  const isAdmin = currentUser.role === "admin";
  const isIntern = (() => {
    const me = employees.find(e => e.id === currentUser.employee_id);
    return me ? /intern|intras/i.test(me.group_name || "") : false;
  })();

  async function loadBalanceFor(empId) {
    if (!empId) { setFormBalance(null); return; }
    try { setFormBalance(await api.getLeaveBalance(empId)); } catch { setFormBalance(null); }
  }

  async function submitRequest(f, isEdit, id) {
    try {
      if (isEdit) await api.updateLeave(id, { type: f.type, startDate: f.startDate, endDate: f.endDate, reason: f.reason, isHalfDay: f.isHalfDay });
      else await api.createLeave({ employeeId: viewOnly ? currentUser.employee_id : +f.employeeId, type: f.type, startDate: f.startDate, endDate: f.endDate, reason: f.reason, isHalfDay: f.isHalfDay });
      await load(true);
      return true;
    } catch (e) { errAlert(e); return false; }
  }
  async function withdraw(l) {
    const refund = BALANCE_TYPES.has(l.leave_type) ? ` ${lvDays(l.start_date, l.end_date, l.is_half_day)} day(s) will be returned to your balance.` : "";
    if (!await dialog.confirm(`Withdraw your ${l.leave_type} leave request for ${lvRange(l.start_date, l.end_date)}?${refund}`, { title: "Withdraw request", dtype: "warning" })) return;
    setActingId(l.id);
    try { await api.deleteLeave(l.id); await load(true); } catch (e) { errAlert(e); } finally { setActingId(null); }
  }
  async function act(l, kind) {
    if (kind === "reject" && !await dialog.confirm(`Reject ${l.employee_name}'s ${l.leave_type} leave (${lvRange(l.start_date, l.end_date)})?`, { title: "Reject leave", dtype: "warning" })) return;
    setActingId(l.id);
    try { await (kind === "approve" ? api.approveLeave(l.id) : api.rejectLeave(l.id)); await load(true); } catch (e) { errAlert(e); } finally { setActingId(null); }
  }

  async function handleCreditMonthly() {
    if (!await dialog.confirm("Credit 2 leaves to ALL employees for this month? This cannot be undone.", { dtype: "warning" })) return;
    setCrediting(true);
    try {
      const res = await api.creditMonthlyLeaves();
      dialog.alert(`✅ Credited ${res.credited} employee(s) for ${res.month}. ${res.credited === 0 ? "All already credited this month." : ""}`, { title: "Monthly Credit Done" });
      await load(true);
    } catch (e) { errAlert(e); } finally { setCrediting(false); }
  }
  async function handleSaveSettings() {
    setSettingsSaving(true);
    try {
      await api.updateLeaveSettings(settingsForm);
      setLeaveSettings({ ...leaveSettings, ...settingsForm });
      setSettingsModal(false);
      dialog.alert("Holiday calendar link saved!", { title: "Settings Saved", dtype: "success" });
    } catch (e) { errAlert(e); } finally { setSettingsSaving(false); }
  }

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={() => load()} />;

  // ── derived ──
  const today = lvToday();
  const year = new Date().getFullYear();
  const balNum = balance ? parseFloat(balance.balance) || 0 : 0;
  const balCred = balance ? parseFloat(balance.total_credited) || 0 : 0;
  const balUsed = balance ? parseFloat(balance.total_used) || 0 : 0;
  const balColor = balNum >= 4 ? C.green : balNum >= 2 ? C.amber : C.red;
  const showBal = viewOnly && balance !== null && !isIntern;
  const count = s => rows.filter(l => l.status === s).length;
  const daysOf = l => lvDays(l.start_date, l.end_date, l.is_half_day);

  const thisYear = rows.filter(l => lvISO(l.start_date).slice(0, 4) === String(year) && l.status === "approved");
  const byType = LV_TYPES.map(t => ({ ...t, days: thisYear.filter(l => l.leave_type === t.value).reduce((s, l) => s + daysOf(l), 0) })).filter(t => t.days > 0);
  const takenYear = byType.reduce((s, t) => s + t.days, 0);

  const upcoming = rows.filter(l => l.status !== "rejected" && lvISO(l.end_date) >= today)
    .sort((a, b) => lvISO(a.start_date).localeCompare(lvISO(b.start_date)));
  const nextLeave = viewOnly ? upcoming[0] : null;
  const daysUntil = nextLeave ? Math.round((lvDate(nextLeave.start_date) - lvDate(today)) / 86400000) : null;

  const outToday = !viewOnly ? rows.filter(l => l.status === "approved" && lvISO(l.start_date) <= today && lvISO(l.end_date) >= today) : [];
  const weekEnd = lvAddDays(today, 6);
  const outWeek = !viewOnly ? rows.filter(l => l.status === "approved" && lvISO(l.start_date) <= weekEnd && lvISO(l.end_date) >= today) : [];

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(l => (statusTab === "all" || l.status === statusTab)
    && (!typeFilter || l.leave_type === typeFilter)
    && (!q || `${l.employee_name || ""} ${l.leave_type} ${l.reason || ""}`.toLowerCase().includes(q)))
    .sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || lvISO(b.start_date).localeCompare(lvISO(a.start_date)));
  const paged = filtered.slice((lvPage - 1) * lvPerPage, lvPage * lvPerPage);

  const openNew = () => {
    setFormBalance(viewOnly ? balance : null);
    setReqModal({ isEdit: false, init: { employeeId: "", type: "Annual", startDate: "", endDate: "", reason: "", isHalfDay: false } });
  };
  const openEdit = l => {
    setFormBalance(viewOnly ? balance : (allBalances[String(l.employee_id)] || null));
    setReqModal({ isEdit: true, id: l.id, init: { id: l.id, employeeId: String(l.employee_id), type: l.leave_type, startDate: lvISO(l.start_date), endDate: lvISO(l.end_date), reason: l.reason || "", isHalfDay: !!l.is_half_day } });
  };

  // ── calendar ──
  const renderCalendar = () => {
    const { y, m } = calMonth;
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    const cells = [];
    for (let i = 0; i < (first.getDay() + 6) % 7; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    while (cells.length % 7) cells.push(null);
    const active = rows.filter(l => l.status !== "rejected");
    return (
      <div className="lv-card">
        <div className="lv-cal-top">
          <div className="lv-nav">
            <button onClick={() => setCalMonth(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })} aria-label="Previous month">‹</button>
            <span>{first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            <button onClick={() => setCalMonth(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })} aria-label="Next month">›</button>
          </div>
          <div className="lv-cal-legend">
            {LV_TYPES.slice(0, 4).map(t => <span key={t.value}><i style={{ background: t.color }} />{t.label.split(" ")[0]}</span>)}
            <span><i style={{ background: "transparent", border: `1.5px dashed ${C.amber}` }} />Pending</span>
          </div>
        </div>
        <div className="lv-cal-head">{DAY_NAMES.map(d => <div key={d}>{d}</div>)}</div>
        <div className="lv-cal">
          {cells.map((iso, i) => {
            if (!iso) return <div key={i} className="lv-cday blank" />;
            const on = active.filter(l => lvISO(l.start_date) <= iso && lvISO(l.end_date) >= iso);
            const dow = lvDate(iso).getDay();
            return (
              <div key={iso} className={`lv-cday${iso === today ? " today" : ""}${dow === 0 || dow === 6 ? " we" : ""}`}
                title={on.map(l => `${viewOnly ? "" : (l.employee_name || "") + " · "}${l.leave_type} (${l.status})`).join("\n")}>
                <span className="lv-cnum">{+iso.slice(8)}</span>
                <div className="lv-cchips">
                  {on.slice(0, viewOnly ? 2 : 3).map(l => {
                    const t = lvType(l.leave_type);
                    return (
                      <span key={l.id} className={`lv-cchip${l.status === "pending" ? " pending" : ""}`} style={{ "--t": t.color }}>
                        <span className="lv-cchip-ico">{t.icon}</span><span className="lv-cchip-txt">{viewOnly ? (l.is_half_day ? "½ day" : t.label.split(" ")[0]) : (l.employee_name || "").split(" ")[0]}</span>
                      </span>
                    );
                  })}
                  {on.length > (viewOnly ? 2 : 3) && <span className="lv-cmore">+{on.length - (viewOnly ? 2 : 3)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── request card ──
  const renderCard = l => {
    const t = lvType(l.leave_type);
    const d = daysOf(l);
    const sc = lvStatusColor(l.status);
    const isUpcoming = lvISO(l.start_date) > today;
    const isOngoing = lvISO(l.start_date) <= today && lvISO(l.end_date) >= today;
    const empBal = !viewOnly ? (allBalances[String(l.employee_id)] || null) : null;
    const empBalNum = empBal ? parseFloat(empBal.balance) || 0 : null;
    const mine = l.employee_id === currentUser.employee_id;
    const canManage = !viewOnly && l.status === "pending" && (isAdmin || !mine);
    const busy = actingId === l.id;
    return (
      <article key={l.id} className="lv-req" style={{ "--t": t.color, "--s": sc }}>
        <div className="lv-req-date">
          <span className="lv-req-mon">{lvFmt(l.start_date, { month: "short" })}</span>
          <span className="lv-req-day">{lvDate(l.start_date).getDate()}</span>
          <span className="lv-req-dow">{lvFmt(l.start_date, { weekday: "short" })}</span>
        </div>
        <div className="lv-req-main">
          {!viewOnly && (
            <div className="lv-req-emp">
              <span className="lv-avi" style={{ background: (l.group_color || C.accent) + "26", color: l.group_color || C.accent }}>{l.avatar || mkAvi(l.employee_name)}</span>
              <b>{l.employee_name}</b>
              {empBalNum !== null && <span className="lv-tag" style={{ color: empBalNum >= 4 ? C.green : empBalNum >= 2 ? C.amber : C.red }}>Bal {empBalNum}d</span>}
            </div>
          )}
          <div className="lv-req-title">
            <span className="lv-type" style={{ color: t.color, background: t.color + "18", borderColor: t.color + "40" }}>{t.icon} {t.label}</span>
            {l.is_half_day && <span className="lv-tag">🌗 Half day</span>}
            {isOngoing && l.status === "approved" && <span className="lv-tag" style={{ color: C.green }}>● On leave now</span>}
            {isUpcoming && l.status !== "rejected" && <span className="lv-tag">Upcoming</span>}
          </div>
          <div className="lv-req-range">{lvRange(l.start_date, l.end_date)} <span>· {d} day{d !== 1 ? "s" : ""}</span></div>
          {l.reason && <div className="lv-req-reason">“{l.reason}”</div>}
        </div>
        <div className="lv-req-side">
          <span className="lv-status" style={{ color: sc, background: sc + "18", borderColor: sc + "40" }}><i style={{ background: sc }} />{l.status[0].toUpperCase() + l.status.slice(1)}</span>
          <div className="lv-req-acts">
            {viewOnly && l.status === "pending" && (<>
              <button className="lv-btn lv-btn-ghost sm" onClick={() => openEdit(l)} disabled={busy}>✎ Edit</button>
              <button className="lv-btn lv-btn-danger sm" onClick={() => withdraw(l)} disabled={busy}>{busy ? "…" : "Withdraw"}</button>
            </>)}
            {canManage && (<>
              <button className="lv-btn lv-btn-success sm" onClick={() => act(l, "approve")} disabled={busy}>{busy ? "…" : "✓ Approve"}</button>
              <button className="lv-btn lv-btn-danger sm" onClick={() => act(l, "reject")} disabled={busy} aria-label="Reject">✕ Reject</button>
            </>)}
          </div>
        </div>
      </article>
    );
  };

  const ring = (p, color, size = 112, stroke = 10) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, p)))} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
    );
  };

  const tabs = [["all", "All", rows.length], ["pending", "Pending", count("pending")], ["approved", "Approved", count("approved")], ["rejected", "Rejected", count("rejected")]];

  return (
    <>
      <style>{`
        .lv { container-type: inline-size; container-name: lv; }
        .lv-wrap { display: flex; flex-direction: column; gap: 18px; }
        .lv-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid transparent; font-family: inherit; transition: transform .15s, opacity .15s, border-color .15s; white-space: nowrap; text-decoration: none; }
        .lv-btn.sm { padding: 7px 12px; font-size: 12px; border-radius: 10px; }
        .lv-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .lv-btn:disabled { opacity: .5; cursor: not-allowed; }
        .lv-btn-primary { background: ${C.accent}; color: #fff; box-shadow: 0 8px 22px ${C.accent}40; }
        .lv-btn-ghost { background: ${C.surface}; color: ${C.text}; border-color: ${C.border}; }
        .lv-btn-ghost:hover:not(:disabled) { border-color: ${C.accent}77; }
        .lv-btn-danger { background: ${C.red}14; color: ${C.red}; border-color: ${C.red}40; }
        .lv-btn-success { background: ${C.green}18; color: ${C.green}; border-color: ${C.green}44; }
        .lv-icon-btn { width: 36px; height: 36px; border-radius: 10px; border: 1px solid ${C.border}; background: ${C.surface}; color: ${C.textDim}; cursor: pointer; font-size: 15px; font-family: inherit; flex-shrink: 0; }
        .lv-wrap button:focus-visible, .lvm button:focus-visible, .lv-wrap a:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }

        .lv-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
        .lv-title { margin: 0; font-size: clamp(22px, 2.4vw, 26px); font-weight: 800; color: ${C.text}; letter-spacing: -0.5px; }
        .lv-subtitle { margin: 4px 0 0; color: ${C.textMuted}; font-size: 13px; }
        .lv-head-acts { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

        .lv-card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 20px; padding: 18px; min-width: 0; }
        .lv-top { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
        .lv-bal { display: flex; align-items: center; gap: 20px; position: relative; overflow: hidden; }
        .lv-bal::after { content: ""; position: absolute; right: -40px; top: -40px; width: 160px; height: 160px; border-radius: 50%; background: ${balColor}; opacity: .07; pointer-events: none; }
        .lv-ring { position: relative; width: 112px; height: 112px; flex-shrink: 0; }
        .lv-ring div { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .lv-ring b { font-size: 30px; font-weight: 800; line-height: 1; letter-spacing: -1px; }
        .lv-ring small { font-size: 10.5px; color: ${C.textMuted}; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; margin-top: 4px; }
        .lv-eyebrow { font-size: 11px; font-weight: 800; color: ${C.textMuted}; letter-spacing: .8px; text-transform: uppercase; }
        .lv-big { font-size: 19px; font-weight: 800; color: ${C.text}; margin-top: 4px; }
        .lv-mini { font-size: 12px; color: ${C.textMuted}; margin-top: 3px; }
        .lv-bal-stats { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
        .lv-bal-stats div { background: ${C.surface}; border: 1px solid ${C.border}66; border-radius: 12px; padding: 8px 12px; min-width: 76px; }
        .lv-bal-stats b { display: block; font-size: 16px; font-weight: 800; }
        .lv-bal-stats span { font-size: 11px; color: ${C.textMuted}; font-weight: 600; }

        .lv-next { display: flex; flex-direction: column; gap: 10px; }
        .lv-next-main { display: flex; align-items: center; gap: 14px; }
        .lv-next-ico { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
        .lv-count { font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 999px; width: fit-content; }
        .lv-typebar { height: 10px; border-radius: 6px; overflow: hidden; display: flex; background: ${C.border}; margin: 12px 0 10px; }
        .lv-typebar div { height: 100%; }
        .lv-typelist { display: flex; flex-direction: column; gap: 7px; }
        .lv-typelist div { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: ${C.text}; font-weight: 600; }
        .lv-typelist i { width: 9px; height: 9px; border-radius: 3px; }
        .lv-typelist b { margin-left: auto; color: ${C.textDim}; }
        .lv-out { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .lv-out span { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: ${C.text}; background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 999px; padding: 4px 10px 4px 4px; }
        .lv-avi { width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; flex-shrink: 0; }

        .lv-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .lv-tabs { display: inline-flex; background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 12px; padding: 3px; overflow-x: auto; scrollbar-width: none; max-width: 100%; }
        .lv-tabs button { background: transparent; border: 1px solid transparent; color: ${C.textMuted}; border-radius: 9px; padding: 7px 12px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
        .lv-tabs button.on { background: ${C.card}; color: ${C.text}; border-color: ${C.border}; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
        .lv-tabs em { font-style: normal; font-size: 11px; background: ${C.border}; color: ${C.textDim}; border-radius: 999px; padding: 1px 7px; }
        .lv-tabs button.on em { background: ${C.accent}; color: #fff; }
        .lv-spacer { flex: 1; }
        .lv-input { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 10px; color: ${C.text}; padding: 8px 12px; font-size: 13px; outline: none; font-family: inherit; }
        .lv-input:focus { border-color: ${C.accent}; }

        .lv-list { display: flex; flex-direction: column; gap: 10px; }
        .lv-req { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 16px; align-items: center; background: ${C.card}; border: 1px solid ${C.border}; border-radius: 18px; padding: 14px 16px; position: relative; overflow: hidden; transition: border-color .15s, transform .15s; }
        .lv-req::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--s); opacity: .8; }
        .lv-req:hover { border-color: color-mix(in srgb, var(--t) 45%, ${C.border}); }
        .lv-req-date { display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 14px; padding: 8px 0; background: color-mix(in srgb, var(--t) 14%, ${C.surface}); border: 1px solid color-mix(in srgb, var(--t) 30%, transparent); }
        .lv-req-mon { font-size: 10.5px; font-weight: 800; color: var(--t); text-transform: uppercase; letter-spacing: .6px; }
        .lv-req-day { font-size: 22px; font-weight: 800; color: ${C.text}; line-height: 1.1; }
        .lv-req-dow { font-size: 10.5px; color: ${C.textMuted}; font-weight: 700; }
        .lv-req-main { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
        .lv-req-emp { display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${C.text}; min-width: 0; }
        .lv-req-emp b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lv-req-title { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .lv-type { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 800; padding: 4px 10px; border-radius: 999px; border: 1px solid; }
        .lv-tag { font-size: 11px; font-weight: 700; color: ${C.textDim}; background: ${C.surface}; border: 1px solid ${C.border}; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
        .lv-req-range { font-size: 14px; font-weight: 700; color: ${C.text}; }
        .lv-req-range span { color: ${C.textMuted}; font-weight: 600; }
        .lv-req-reason { font-size: 12.5px; color: ${C.textDim}; font-style: italic; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .lv-req-side { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
        .lv-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 999px; border: 1px solid; white-space: nowrap; }
        .lv-status i, .lv-cal-legend i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
        .lv-req-acts { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .lv-empty { text-align: center; padding: 48px 20px; color: ${C.textMuted}; font-size: 13.5px; }
        .lv-empty div { font-size: 34px; margin-bottom: 8px; }

        .lv-cal-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .lv-nav { display: inline-flex; align-items: center; gap: 4px; background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 12px; padding: 3px; }
        .lv-nav button { width: 32px; height: 32px; border: none; border-radius: 9px; background: transparent; color: ${C.textDim}; font-size: 18px; cursor: pointer; font-family: inherit; }
        .lv-nav button:hover { background: ${C.card}; color: ${C.text}; }
        .lv-nav span { min-width: 140px; text-align: center; font-weight: 800; color: ${C.text}; font-size: 14px; }
        .lv-cal-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11.5px; color: ${C.textMuted}; }
        .lv-cal-legend span { display: inline-flex; align-items: center; gap: 5px; }
        .lv-cal-head, .lv-cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
        .lv-cal-head div { text-align: center; font-size: 11px; font-weight: 800; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: .6px; padding-bottom: 6px; }
        .lv-cday { min-height: 92px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.surface}; padding: 6px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .lv-cday.blank { background: transparent; border-color: transparent; }
        .lv-cday.we { background: ${C.bg}; }
        .lv-cday.today { border-color: ${C.accent}; box-shadow: 0 0 0 2px ${C.accentGlow}; }
        .lv-cnum { font-size: 12px; font-weight: 800; color: ${C.text}; }
        .lv-cday.today .lv-cnum { color: ${C.accent}; }
        .lv-cchips { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .lv-cchip { display: flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700; color: ${C.text}; background: color-mix(in srgb, var(--t) 24%, ${C.card}); border: 1px solid color-mix(in srgb, var(--t) 45%, transparent); border-radius: 6px; padding: 2px 5px; min-width: 0; }
        .lv-cchip.pending { background: transparent; border-style: dashed; border-color: ${C.amber}; }
        .lv-cchip-txt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lv-cmore { font-size: 10.5px; color: ${C.textMuted}; font-weight: 700; padding-left: 2px; }

        /* Request modal */
        .lvm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.66); backdrop-filter: blur(3px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .lvm { width: 100%; max-width: 600px; max-height: min(92vh, 900px); display: flex; flex-direction: column; background: ${C.card}; border: 1px solid ${C.border}; border-radius: 22px; box-shadow: 0 30px 80px rgba(0,0,0,.6); overflow: hidden; animation: lvmIn .18s ease-out; }
        @keyframes lvmIn { from { transform: translateY(12px); opacity: 0; } }
        .lvm-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 20px 22px 14px; border-bottom: 1px solid ${C.border}; }
        .lvm-title { font-size: 18px; font-weight: 800; color: ${C.text}; }
        .lvm-sub { font-size: 12.5px; color: ${C.textMuted}; margin-top: 3px; }
        .lvm-body { padding: 18px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; }
        .lvm-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 22px; border-top: 1px solid ${C.border}; background: ${C.surface}; }
        .lvm-field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .lvm-lbl { font-size: 12.5px; font-weight: 800; color: ${C.textDim}; }
        .lvm-mini { font-size: 11.5px; color: ${C.textMuted}; font-weight: 600; }
        .lvm-input { width: 100%; box-sizing: border-box; background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 12px; color: ${C.text}; padding: 10px 12px; font-size: 14px; font-family: inherit; outline: none; resize: vertical; color-scheme: ${C.bg === DARK.bg ? "dark" : "light"}; }
        .lvm-input:focus { border-color: ${C.accent}; box-shadow: 0 0 0 3px ${C.accentGlow}; }
        .lvm-input:disabled { opacity: .55; }
        .lvm-input.err { border-color: ${C.red}; }
        .lvm-err { font-size: 12px; color: ${C.red}; font-weight: 600; }
        .lvm-note { font-size: 12px; color: ${C.textDim}; }
        .lvm-types { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .lvm-type { --t: ${C.accent}; display: flex; align-items: center; gap: 10px; text-align: left; padding: 10px; border-radius: 14px; border: 1px solid ${C.border}; background: ${C.surface}; cursor: pointer; font-family: inherit; color: ${C.text}; min-width: 0; transition: border-color .15s, background .15s; }
        .lvm-type:hover { border-color: color-mix(in srgb, var(--t) 50%, ${C.border}); }
        .lvm-type.on { border-color: var(--t); background: color-mix(in srgb, var(--t) 14%, ${C.surface}); box-shadow: 0 0 0 1px var(--t) inset; }
        .lvm-type-ico { width: 34px; height: 34px; border-radius: 10px; background: color-mix(in srgb, var(--t) 18%, transparent); display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
        .lvm-type-txt { display: flex; flex-direction: column; min-width: 0; }
        .lvm-type-txt b { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lvm-type-txt small { font-size: 11px; color: ${C.textMuted}; }
        .lvm-presets { display: flex; gap: 6px; flex-wrap: wrap; }
        .lvm-chip { padding: 5px 10px; border-radius: 999px; border: 1px solid ${C.border}; background: ${C.surface}; color: ${C.textDim}; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .lvm-chip:hover { border-color: ${C.accent}; color: ${C.accent}; }
        .lvm-dates { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .lvm-dates > div { display: flex; flex-direction: column; gap: 4px; }
        .lvm-toggle { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; color: ${C.text}; cursor: pointer; width: fit-content; }
        .lvm-toggle.disabled { opacity: .5; cursor: not-allowed; }
        .lvm-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
        .lvm-switch { width: 38px; height: 22px; border-radius: 999px; background: ${C.border}; position: relative; transition: background .2s; flex-shrink: 0; }
        .lvm-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .2s; }
        .lvm-toggle input:checked + .lvm-switch { background: ${C.accent}; }
        .lvm-toggle input:checked + .lvm-switch::after { transform: translateX(16px); }
        .lvm-toggle input:focus-visible + .lvm-switch { outline: 2px solid ${C.accent}; outline-offset: 2px; }
        .lvm-summary { border-radius: 16px; padding: 14px 16px; background: ${C.surface}; border: 1px solid ${C.border}; display: flex; flex-direction: column; gap: 10px; }
        .lvm-summary.bad { border-color: ${C.red}66; background: ${C.red}0d; }
        .lvm-sum-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
        .lvm-sum-big { font-size: 24px; font-weight: 800; color: ${C.text}; line-height: 1.1; }
        .lvm-sum-big small { font-size: 13px; color: ${C.textMuted}; font-weight: 600; }
        .lvm-bar { display: flex; height: 8px; border-radius: 6px; overflow: hidden; background: ${C.border}; }

        /* ── Responsive ── */
        @container lv (max-width: 1100px) {
          .lv-top { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
          .lv-top > :first-child { grid-column: 1 / -1; }
        }
        @container lv (max-width: 640px) {
          .lv-wrap { gap: 14px; }
          .lv-header { align-items: stretch; }
          .lv-head-acts { width: 100%; }
          .lv-head-acts > * { flex: 1; }
          .lv-top { grid-template-columns: 1fr; gap: 12px; }
          .lv-card { padding: 14px; border-radius: 18px; }
          .lv-bal { flex-direction: column; text-align: center; gap: 12px; }
          .lv-bal-stats { justify-content: center; }
          .lv-toolbar > * { width: 100%; }
          .lv-tabs { display: flex; }
          .lv-tabs button { flex: 1; justify-content: center; padding: 7px 4px; font-size: 12px; gap: 4px; }
          .lv-tabs em { padding: 1px 5px; font-size: 10px; }
          .lv-spacer { display: none; }
          .lv-req { grid-template-columns: 56px minmax(0, 1fr); gap: 12px; padding: 12px 12px 12px 14px; }
          .lv-req-side { grid-column: 1 / -1; flex-direction: row; justify-content: space-between; align-items: center; flex-wrap: wrap; }
          .lv-req-day { font-size: 19px; }
          .lv-cal-head, .lv-cal { gap: 3px; }
          .lv-cday { min-height: 54px; padding: 4px; border-radius: 9px; }
          .lv-cchip { padding: 2px; justify-content: center; }
          .lv-cchip-txt { display: none; }
          .lv-cal-head div { font-size: 10px; }
          .lv-nav { width: 100%; justify-content: space-between; }
        }
        @media (max-width: 640px) {
          .lvm-backdrop { align-items: flex-end; padding: 0; }
          .lvm { max-width: none; border-radius: 22px 22px 0 0; max-height: 94vh; animation: lvmUp .22s ease-out; }
          @keyframes lvmUp { from { transform: translateY(40px); opacity: 0; } }
          .lvm-head, .lvm-body, .lvm-foot { padding-left: 16px; padding-right: 16px; }
          .lvm-foot .lv-btn { flex: 1; }
          .lvm-types { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>

      <div className="lv">
        <div className="lv-wrap">

          {/* Header */}
          <div className="lv-header">
            <div>
              <h2 className="lv-title">{viewOnly ? "My Leave" : "Leave Management"}</h2>
              <p className="lv-subtitle">{viewOnly ? "Plan time off, track your balance and requests" : "Track and manage all employee absences"}</p>
            </div>
            <div className="lv-head-acts">
              {!viewOnly && isAdmin && <button className="lv-btn lv-btn-ghost sm" onClick={handleCreditMonthly} disabled={crediting}>{crediting ? "Crediting…" : "🗓 Credit monthly"}</button>}
              {!viewOnly && isAdmin && <button className="lv-btn lv-btn-ghost sm" onClick={() => setAmendOpen(true)}>🧹 Amend buckets</button>}
              {!viewOnly && isAdmin && <button className="lv-btn lv-btn-ghost sm" onClick={() => setSettingsModal(true)}>⚙ Holiday link</button>}
              {leaveSettings.holiday_link && <a className="lv-btn lv-btn-ghost" href={leaveSettings.holiday_link} target="_blank" rel="noreferrer">🎉 Holidays</a>}
              <button className="lv-btn lv-btn-primary" onClick={openNew}>＋ Request leave</button>
            </div>
          </div>

          {/* Top summary */}
          <div className="lv-top">
            {viewOnly ? (
              showBal ? (
                <div className="lv-card lv-bal">
                  <div className="lv-ring">
                    {ring(balCred ? balNum / balCred : balNum > 0 ? 1 : 0, balColor)}
                    <div><b style={{ color: balColor }}>{balNum}</b><small>days left</small></div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="lv-eyebrow">Leave balance · Annual & Sick</div>
                    <div className="lv-big">{balNum === 0 ? "No days available right now" : `${balNum} day${balNum !== 1 ? "s" : ""} available`}</div>
                    <div className="lv-mini">+2 days credited monthly{balance.last_credited_month ? ` · last credited ${balance.last_credited_month}` : ""}</div>
                    <div className="lv-bal-stats">
                      <div><b style={{ color: C.green }}>{balCred}</b><span>Earned</span></div>
                      <div><b style={{ color: C.amber }}>{balUsed}</b><span>Used</span></div>
                      <div><b style={{ color: C.amber }}>{count("pending")}</b><span>Pending</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="lv-card">
                  <div className="lv-eyebrow">Requests</div>
                  <div className="lv-bal-stats">
                    <div><b style={{ color: C.accent }}>{rows.length}</b><span>Total</span></div>
                    <div><b style={{ color: C.amber }}>{count("pending")}</b><span>Pending</span></div>
                    <div><b style={{ color: C.green }}>{count("approved")}</b><span>Approved</span></div>
                    <div><b style={{ color: C.red }}>{count("rejected")}</b><span>Rejected</span></div>
                  </div>
                </div>
              )
            ) : (
              <div className="lv-card">
                <div className="lv-eyebrow">Overview</div>
                <div className="lv-bal-stats">
                  <div><b style={{ color: C.amber }}>{count("pending")}</b><span>Awaiting review</span></div>
                  <div><b style={{ color: C.green }}>{count("approved")}</b><span>Approved</span></div>
                  <div><b style={{ color: C.red }}>{count("rejected")}</b><span>Rejected</span></div>
                  <div><b style={{ color: C.accent }}>{rows.length}</b><span>Total</span></div>
                </div>
                {count("pending") > 0 && <button className="lv-btn lv-btn-ghost sm" style={{ marginTop: 12 }} onClick={() => { setStatusTab("pending"); setView("list"); }}>Review {count("pending")} pending →</button>}
              </div>
            )}

            {viewOnly ? (
              <div className="lv-card lv-next">
                <div className="lv-eyebrow">Next time off</div>
                {nextLeave ? (() => {
                  const t = lvType(nextLeave.leave_type);
                  const sc = lvStatusColor(nextLeave.status);
                  return (
                    <>
                      <div className="lv-next-main">
                        <div className="lv-next-ico" style={{ background: t.color + "1f", border: `1px solid ${t.color}40` }}>{t.icon}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{lvRange(nextLeave.start_date, nextLeave.end_date)}</div>
                          <div className="lv-mini">{t.label} · {daysOf(nextLeave)} day{daysOf(nextLeave) !== 1 ? "s" : ""} · <span style={{ color: sc, fontWeight: 700 }}>{nextLeave.status}</span></div>
                        </div>
                      </div>
                      <span className="lv-count" style={{ color: C.accent, background: C.accent + "18" }}>{daysUntil <= 0 ? (nextLeave.status === "approved" ? "You're on leave 🎉" : "Starts today · awaiting approval") : daysUntil === 1 ? "Starts tomorrow" : `In ${daysUntil} days`}</span>
                    </>
                  );
                })() : (
                  <>
                    <div className="lv-next-main">
                      <div className="lv-next-ico" style={{ background: C.surface, border: `1px solid ${C.border}` }}>🏖️</div>
                      <div><div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Nothing planned yet</div><div className="lv-mini">Time to plan a break?</div></div>
                    </div>
                    <button className="lv-btn lv-btn-ghost sm" style={{ width: "fit-content" }} onClick={openNew}>Plan time off</button>
                  </>
                )}
              </div>
            ) : (
              <div className="lv-card">
                <div className="lv-eyebrow">Who's out today</div>
                <div className="lv-big">{outToday.length} {outToday.length === 1 ? "person" : "people"}</div>
                <div className="lv-mini">{outWeek.length} approved leave{outWeek.length !== 1 ? "s" : ""} in the next 7 days</div>
                {outToday.length > 0 && (
                  <div className="lv-out">
                    {outToday.slice(0, 6).map(l => <span key={l.id}><i className="lv-avi" style={{ background: (l.group_color || C.accent) + "26", color: l.group_color || C.accent, fontStyle: "normal" }}>{l.avatar || mkAvi(l.employee_name)}</i>{(l.employee_name || "").split(" ")[0]}</span>)}
                    {outToday.length > 6 && <span>+{outToday.length - 6}</span>}
                  </div>
                )}
              </div>
            )}

            <div className="lv-card">
              <div className="lv-eyebrow" style={{ display: "flex", justifyContent: "space-between" }}><span>{viewOnly ? `Taken in ${year}` : `Team leave in ${year}`}</span><span style={{ color: C.text }}>{takenYear}d</span></div>
              {byType.length === 0 ? <div className="lv-mini" style={{ marginTop: 12 }}>No approved leave this year yet.</div> : (
                <>
                  <div className="lv-typebar">{byType.map(t => <div key={t.value} title={`${t.label}: ${t.days}d`} style={{ width: `${(t.days / takenYear) * 100}%`, background: t.color }} />)}</div>
                  <div className="lv-typelist">{byType.slice(0, 4).map(t => <div key={t.value}><i style={{ background: t.color }} />{t.label}<b>{t.days}d</b></div>)}</div>
                </>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="lv-toolbar">
            <div className="lv-tabs" role="tablist" aria-label="View">
              {[["list", "☰ List"], ["calendar", "🗓 Calendar"]].map(([v, l]) => (
                <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{l}</button>
              ))}
            </div>
            {view === "list" && (
              <div className="lv-tabs" role="tablist" aria-label="Filter by status">
                {tabs.map(([k, l, n]) => <button key={k} role="tab" aria-selected={statusTab === k} className={statusTab === k ? "on" : ""} onClick={() => setStatusTab(k)}>{l}<em>{n}</em></button>)}
              </div>
            )}
            <div className="lv-spacer" />
            {view === "list" && (<>
              <select className="lv-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filter by leave type">
                <option value="">All types</option>
                {LV_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input className="lv-input" placeholder={viewOnly ? "Search reason…" : "Search employee, reason…"} value={search} onChange={e => setSearch(e.target.value)} aria-label="Search leave requests" />
            </>)}
          </div>

          {/* Content */}
          {view === "calendar" ? renderCalendar() : filtered.length === 0 ? (
            <div className="lv-card lv-empty">
              <div>{rows.length ? "🔍" : "🏝️"}</div>
              {rows.length ? "No requests match these filters." : viewOnly ? "No leave requests yet. Plan your first break!" : "No leave records yet."}
              {!rows.length && <div style={{ fontSize: 13, marginTop: 14 }}><button className="lv-btn lv-btn-primary" onClick={openNew}>＋ Request leave</button></div>}
            </div>
          ) : (
            <>
              <div className="lv-list">{paged.map(renderCard)}</div>
              {filtered.length > lvPerPage && <PaginationControls page={lvPage} setPage={setLvPage} perPage={lvPerPage} setPerPage={setLvPerPage} total={filtered.length} />}
            </>
          )}
        </div>
      </div>

      {/* Request / edit modal */}
      {reqModal && (
        <LvRequestModal
          key={reqModal.id || "new"}
          init={reqModal.init}
          isEdit={reqModal.isEdit}
          admin={!viewOnly}
          employees={employees}
          balance={formBalance}
          showBalance={viewOnly ? !isIntern : true}
          otherLeaves={rows}
          onEmployeeChange={loadBalanceFor}
          onClose={() => setReqModal(null)}
          onSubmit={f => submitRequest(f, reqModal.isEdit, reqModal.id)}
        />
      )}

      {/* Admin: Amend Leave Buckets */}
      {amendOpen && (
        <Modal title="🧹 Amend Bucket of Leave" onClose={() => setAmendOpen(false)} maxWidth={860}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: C.textMuted }}>Edit leave balances for all employees. Click Save on each row to apply.</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: C.surface }}><tr>
                  {["Employee", "Available Balance", "Total Credited", "Total Used", "Action"].map(h => <Th key={h}>{h}</Th>)}
                </tr></thead>
                <tbody>
                  {employees.filter(e => e.id).map((emp, idx) => {
                    const key = String(emp.id);
                    const bal = allBalances[key] || { balance: 0, total_credited: 0, total_used: 0 };
                    return <AmendRow key={emp.id} emp={emp} initialBal={bal} idx={idx} onSaved={updated => setAllBalances(prev => ({ ...prev, [key]: updated }))} />;
                  })}
                  {employees.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No employees found.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn variant="ghost" onClick={() => setAmendOpen(false)}>Close</Btn></div>
          </div>
        </Modal>
      )}

      {/* Admin: Holiday Calendar Settings */}
      {settingsModal && (
        <Modal title="⚙ Holiday Calendar Settings" onClose={() => setSettingsModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: C.textMuted }}>Set a link to your company holiday calendar shown to all employees.</div>
            <Inp label="Holiday Calendar URL" value={settingsForm.holiday_link} onChange={v => setSettingsForm(f => ({ ...f, holiday_link: v }))} placeholder="https://calendar.google.com/…" />
            {settingsForm.holiday_link && <div style={{ fontSize: 12, color: C.textMuted }}>Preview: <a href={settingsForm.holiday_link} target="_blank" rel="noreferrer" style={{ color: C.accent }}>🗓 View →</a></div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setSettingsModal(false)}>Cancel</Btn>
              <Btn onClick={handleSaveSettings} disabled={settingsSaving}>{settingsSaving ? "Saving…" : "Save Link"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
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

  // Pagination
  const [acctPage, setAcctPage] = useState(1);
  const [acctPerPage, setAcctPerPage] = useState(10);

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
              {accounts.slice((acctPage - 1) * acctPerPage, acctPage * acctPerPage).map((a, idx) => {
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
        <PaginationControls page={acctPage} setPage={setAcctPage} perPage={acctPerPage} setPerPage={setAcctPerPage} total={accounts.length} />
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
  // Pagination
  const [repPage, setRepPage] = useState(1);
  const [repPerPage, setRepPerPage] = useState(10);

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
                {(report.by_employee || []).slice((repPage - 1) * repPerPage, repPage * repPerPage).map(e => (
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
          <PaginationControls page={repPage} setPage={setRepPage} perPage={repPerPage} setPerPage={setRepPerPage} total={(report.by_employee || []).length} />
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
// ── My Profile helpers (module-level so inputs keep focus across renders) ──
const PF_RULES = {
  mobile: { re: /^\+?[\d\s-]{8,16}$/, msg: "Enter a valid phone number" },
  emergencyContact: { re: /^\+?[\d\s-]{8,16}$/, msg: "Enter a valid phone number" },
  panNumber: { re: /^[A-Z]{5}[0-9]{4}[A-Z]$/, msg: "Format: ABCDE1234F" },
  bankIfsc: { re: /^[A-Z]{4}0[A-Z0-9]{6}$/, msg: "Format: HDFC0001234" },
  bankAccountNo: { re: /^\d{6,20}$/, msg: "6–20 digits only" },
};
const pfToForm = p => ({
  dob: (p.dob || "").slice(0, 10), mobile: p.mobile || "", emergencyContact: p.emergency_contact || "",
  address: p.address || "", skillset: p.skillset || "", panNumber: p.pan_number || "",
  bankName: p.bank_name || "", bankAccountNo: p.bank_account_no || "", bankIfsc: p.bank_ifsc || "",
});
const ymdLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const pfSkills = s => (s || "").split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
const pfMaskTail = (v, n = 4) => { const s = String(v || ""); return s.length <= n ? "••••" : "•".repeat(Math.min(8, s.length - n)) + " " + s.slice(-n); };
const pfParse = d => { if (!d) return null; const [y, m, day] = String(d).slice(0, 10).split("-").map(Number); return y ? new Date(y, m - 1, day) : null; };
const pfDaysUntilNext = (date, today) => {
  if (!date) return null;
  let next = new Date(today.getFullYear(), date.getMonth(), date.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, date.getMonth(), date.getDate());
  return Math.round((next - today) / 86400000);
};
const pfPwScore = pw => {
  const checks = [
    { ok: pw.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Z]/.test(pw) && /[a-z]/.test(pw), label: "Upper & lower case letters" },
    { ok: /\d/.test(pw), label: "At least one number" },
    { ok: /[^A-Za-z0-9]/.test(pw), label: "At least one symbol" },
  ];
  return { checks, score: checks.filter(c => c.ok).length };
};

function PfField({ icon, label, value, mono, masked, revealed, onReveal, copyKey, copied, onCopy, href, full }) {
  const has = value !== null && value !== undefined && value !== "";
  const shown = !has ? null : masked && !revealed ? (masked === "tail" ? pfMaskTail(value) : "••••••••") : value;
  return (
    <div className={`pf-field${full ? " full" : ""}`}>
      <div className="pf-field-ico">{icon}</div>
      <div className="pf-field-body">
        <div className="pf-field-lbl">{label}</div>
        {has ? (
          href && (!masked || revealed)
            ? <a className="pf-field-val pf-anchor" href={href} style={mono ? { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } : undefined}>{shown}</a>
            : <div className="pf-field-val" style={mono ? { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: .5 } : undefined}>{shown}</div>
        ) : <div className="pf-field-val pf-missing">Not added</div>}
      </div>
      {has && (
        <div className="pf-field-acts">
          {masked && <button className="pf-icon-btn" onClick={onReveal} aria-label={revealed ? `Hide ${label}` : `Show ${label}`} title={revealed ? "Hide" : "Show"}>{revealed ? "🙈" : "👁"}</button>}
          {copyKey && (!masked || revealed) && (
            <button className="pf-icon-btn" onClick={() => onCopy(copyKey, value)} aria-label={`Copy ${label}`} title="Copy">
              {copied === copyKey ? <span style={{ color: C.green, fontSize: 13, fontWeight: 800 }}>✓</span> : "⧉"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PfInput({ label, name, value, onChange, error, type = "text", placeholder, upper, textarea, hint, full, max }) {
  const common = {
    id: `pf-${name}`, value: value || "", placeholder,
    className: `pf-input${error ? " err" : ""}`,
    onChange: e => onChange(name, upper ? e.target.value.toUpperCase() : e.target.value),
    "aria-invalid": !!error,
  };
  return (
    <div className={`pf-inp-wrap${full ? " full" : ""}`}>
      <label htmlFor={`pf-${name}`} className="pf-inp-lbl">{label}</label>
      {textarea ? <textarea rows={3} {...common} /> : <input type={type} max={max} {...common} />}
      {error ? <div className="pf-inp-err">{error}</div> : hint ? <div className="pf-inp-hint">{hint}</div> : null}
    </div>
  );
}

function MyProfile({ currentUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(null); // null | "personal" | "skills" | "bank"
  const [touched, setTouched] = useState({});
  const [reveal, setReveal] = useState({});
  const [copied, setCopied] = useState(null);
  const [skillDraft, setSkillDraft] = useState("");
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ oldPassword: "", newPassword: "", confirm: "" });
  const [pwShow, setPwShow] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwErr, setPwErr] = useState("");

  useEffect(() => {
    api.getEmployee(currentUser.employee_id)
      .then(p => { setProfile(p); setForm(pfToForm(p)); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [currentUser.employee_id]);

  if (loading) return <Spinner />;
  if (err && !profile) return <ErrBox msg={err} />;

  // ── derived ──
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const original = pfToForm(profile);
  const dirty = Object.keys(original).some(k => (form[k] || "") !== (original[k] || ""));
  const validate = f => {
    const e = {};
    Object.entries(PF_RULES).forEach(([k, r]) => { if (f[k] && !r.re.test(String(f[k]).trim())) e[k] = r.msg; });
    const dob = pfParse(f.dob);
    if (dob && dob > today) e.dob = "Date of birth can't be in the future";
    else if (dob && today.getFullYear() - dob.getFullYear() < 14) e.dob = "Please check the year";
    return e;
  };
  const errors = validate(form);
  const sectionFields = { personal: ["dob", "mobile", "emergencyContact", "address"], skills: ["skillset"], bank: ["panNumber", "bankName", "bankAccountNo", "bankIfsc"] };
  const sectionHasErr = s => (sectionFields[s] || []).some(k => errors[k]);
  const fieldErr = k => (touched[k] || touched.__submit) ? errors[k] : null;

  const joined = pfParse(profile.joining_date);
  const dobD = pfParse(form.dob);
  const tenureMonths = joined ? Math.max(0, (today.getFullYear() - joined.getFullYear()) * 12 + today.getMonth() - joined.getMonth() - (today.getDate() < joined.getDate() ? 1 : 0)) : null;
  const tenureLabel = tenureMonths === null ? "—" : tenureMonths < 1 ? "New joiner" : `${Math.floor(tenureMonths / 12) ? Math.floor(tenureMonths / 12) + "y " : ""}${tenureMonths % 12}m`;
  const bdayIn = pfDaysUntilNext(dobD, today);
  const annivIn = joined && tenureMonths >= 1 ? pfDaysUntilNext(joined, today) : null;
  const skills = pfSkills(form.skillset);

  const checklist = [
    { k: "dob", label: "Date of birth", sec: "personal" },
    { k: "mobile", label: "Mobile number", sec: "personal" },
    { k: "emergencyContact", label: "Emergency contact", sec: "personal" },
    { k: "address", label: "Address", sec: "personal" },
    { k: "skillset", label: "Skills", sec: "skills" },
    { k: "panNumber", label: "PAN number", sec: "bank" },
    { k: "bankName", label: "Bank name", sec: "bank" },
    { k: "bankAccountNo", label: "Account number", sec: "bank" },
    { k: "bankIfsc", label: "IFSC code", sec: "bank" },
  ].map(c => ({ ...c, done: !!String(original[c.k] || "").trim() }));
  const doneCount = checklist.filter(c => c.done).length;
  const completePct = Math.round((doneCount / checklist.length) * 100);
  const completeColor = completePct >= 90 ? C.green : completePct >= 50 ? C.amber : C.red;

  const roleLabel = currentUser.role === "manager" ? "Manager" : currentUser.role === "admin" ? "Admin" : currentUser.role === "intras" ? "Intern" : "Employee";
  const roleColor = currentUser.role === "admin" ? C.purple : currentUser.role === "manager" ? C.accent : C.green;
  const groupColor = profile.group_color || C.purple;

  // ── actions ──
  const setF = (k, v) => { setForm(f => ({ ...f, [k]: v })); setTouched(t => ({ ...t, [k]: true })); };
  const toggleReveal = k => setReveal(r => ({ ...r, [k]: !r[k] }));
  const copy = async (key, text) => {
    try { await navigator.clipboard.writeText(String(text)); }
    catch { const t = document.createElement("textarea"); t.value = String(text); document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    setCopied(key); setTimeout(() => setCopied(c => (c === key ? null : c)), 1400);
  };
  const startEdit = sec => { setForm(pfToForm(profile)); setTouched({}); setErr(""); setSkillDraft(""); setEditing(sec); };
  const cancelEdit = () => { setForm(pfToForm(profile)); setTouched({}); setErr(""); setSkillDraft(""); setEditing(null); };
  const requestEdit = async sec => {
    if (editing && editing !== sec && dirty) {
      const ok = await dialog.confirm("You have unsaved changes. Discard them?", { title: "Unsaved changes" });
      if (!ok) return;
    }
    startEdit(sec);
  };

  const addSkill = raw => {
    const add = pfSkills(raw);
    if (!add.length) return;
    const existing = pfSkills(form.skillset);
    const lower = existing.map(s => s.toLowerCase());
    const merged = [...existing, ...add.filter(s => !lower.includes(s.toLowerCase()))];
    setF("skillset", merged.join(", "));
    setSkillDraft("");
  };
  const removeSkill = s => setF("skillset", pfSkills(form.skillset).filter(x => x !== s).join(", "));

  async function handleSave() {
    let f = form;
    if (editing === "skills" && skillDraft.trim()) {
      const existing = pfSkills(form.skillset);
      f = { ...form, skillset: [...existing, ...pfSkills(skillDraft)].join(", ") };
      setForm(f); setSkillDraft("");
    }
    setTouched(t => ({ ...t, __submit: true }));
    if (Object.keys(validate(f)).length) return;
    setSaving(true); setErr("");
    try {
      const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
      // The API replaces every column, so send the full record (incl. admin-managed fields) to avoid wiping them.
      const payload = {
        name: profile.name, email: profile.email, groupId: profile.group_id, joiningDate: profile.joining_date,
        ctcAnnual: profile.ctc_annual, variablePay: profile.variable_pay_amount, designation: profile.designation,
        location: profile.location, hourlyRate: profile.hourly_rate, managerId: profile.manager_id,
        customEmployeeId: profile.custom_employee_id,
        dob: clean.dob, address: clean.address, mobile: clean.mobile, emergencyContact: clean.emergencyContact,
        skillset: clean.skillset, panNumber: clean.panNumber, bankAccountNo: clean.bankAccountNo,
        bankIfsc: clean.bankIfsc, bankName: clean.bankName,
      };
      await api.updateEmployee(currentUser.employee_id, payload);
      const next = {
        ...profile, dob: clean.dob || null, address: clean.address || null, mobile: clean.mobile || null,
        emergency_contact: clean.emergencyContact || null, skillset: clean.skillset || null, pan_number: clean.panNumber || null,
        bank_account_no: clean.bankAccountNo || null, bank_ifsc: clean.bankIfsc || null, bank_name: clean.bankName || null,
      };
      setProfile(next); setForm(pfToForm(next)); setEditing(null); setTouched({});
      dialog.alert("Your profile has been updated.", { title: "Saved", dtype: "success" });
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  }

  const pw = pfPwScore(pwForm.newPassword);
  const pwMatch = pwForm.confirm.length > 0 && pwForm.confirm === pwForm.newPassword;
  const pwReady = pwForm.oldPassword && pw.score >= 3 && pwMatch && pwForm.newPassword !== pwForm.oldPassword;
  const pwColors = [C.red, C.red, C.amber, C.green, C.green];
  const pwLabels = ["Too weak", "Weak", "Fair", "Strong", "Very strong"];
  const closePw = () => { setShowPwModal(false); setPwForm({ oldPassword: "", newPassword: "", confirm: "" }); setPwErr(""); setPwShow(false); };
  async function handleSavePw() {
    if (!pwReady) return;
    setPwSaving(true); setPwErr("");
    try {
      await api.updatePassword({ oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword });
      closePw();
      dialog.alert("Your password has been changed.", { title: "Password updated", dtype: "success" });
    } catch (e) { setPwErr(e.message); }
    setPwSaving(false);
  }

  const EditBtn = ({ sec }) => editing === sec ? null : (
    <button className="pf-edit-btn" onClick={() => requestEdit(sec)} disabled={saving}>✏️ <span>Edit</span></button>
  );
  const EditFooter = ({ sec }) => editing !== sec ? null : (
    <div className="pf-card-foot">
      <span className="pf-foot-note">{dirty ? "● Unsaved changes" : "No changes yet"}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="pf-btn pf-btn-ghost" onClick={cancelEdit} disabled={saving}>Cancel</button>
        <button className="pf-btn pf-btn-primary" onClick={handleSave} disabled={saving || !dirty || (touched.__submit && sectionHasErr(sec))}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
  const ring = (pct, color, size = 84, stroke = 8) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
    );
  };

  return (
    <>
      <style>{`
        .pf { container-type: inline-size; container-name: pf; }
        .pf-wrap { display: flex; flex-direction: column; gap: 20px; }

        /* Hero */
        .pf-hero { position: relative; border-radius: 24px; border: 1px solid ${C.border}; background: ${C.card}; overflow: hidden; }
        .pf-cover { height: 56px; background:
            radial-gradient(420px 120px at 10% 0%, ${C.accent}66, transparent 70%),
            radial-gradient(460px 140px at 90% 100%, ${C.purple}55, transparent 70%),
            linear-gradient(120deg, ${C.surface}, ${C.card}); border-bottom: 1px solid ${C.border}; }
        .pf-hero-body { display: flex; align-items: center; gap: 18px; padding: 0 24px 18px; flex-wrap: wrap; }
        .pf-hero-body > .pf-avatar { margin-top: -28px; }
        .pf-hero-acts { align-self: center; padding-top: 12px; }
        .pf-avatar { width: 80px; height: 80px; border-radius: 22px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; color: #fff;
          background: linear-gradient(135deg, ${C.accent}, ${C.purple}); border: 4px solid ${C.card}; box-shadow: 0 14px 36px ${C.accent}40; position: relative; box-sizing: border-box; }
        .pf-status-dot { position: absolute; right: -2px; bottom: -2px; width: 18px; height: 18px; border-radius: 50%; background: ${C.green}; border: 3px solid ${C.card}; box-sizing: border-box; }
        .pf-id { flex: 1; min-width: 240px; padding-top: 12px; }
        .pf-name { font-size: clamp(20px, 2vw, 24px); font-weight: 800; color: ${C.text}; letter-spacing: -0.6px; line-height: 1.15; }
        .pf-sub { font-size: 13.5px; color: ${C.textDim}; margin-top: 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .pf-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
        .pf-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; padding: 5px 11px; border-radius: 999px; border: 1px solid ${C.border}; color: ${C.textDim}; background: ${C.surface}; white-space: nowrap; }
        .pf-chip.solid { text-transform: uppercase; letter-spacing: .5px; }
        .pf-hero-acts { display: flex; gap: 8px; flex-wrap: wrap; }
        .pf-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid transparent; font-family: inherit; transition: transform .15s, opacity .15s, border-color .15s, background .15s; white-space: nowrap; text-decoration: none; }
        .pf-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .pf-btn:disabled { opacity: .5; cursor: not-allowed; }
        .pf-btn-primary { background: ${C.accent}; color: #fff; box-shadow: 0 8px 22px ${C.accent}40; }
        .pf-btn-ghost { background: ${C.surface}; color: ${C.text}; border-color: ${C.border}; }
        .pf-btn-ghost:hover:not(:disabled) { border-color: ${C.accent}77; }
        .pf-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid ${C.border}; }
        .pf-stat { padding: 16px 22px; display: flex; align-items: center; gap: 12px; min-width: 0; }
        .pf-stat + .pf-stat { border-left: 1px solid ${C.border}; }
        .pf-stat-ico { width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .pf-stat-val { font-size: 17px; font-weight: 800; color: ${C.text}; letter-spacing: -0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pf-stat-lbl { font-size: 11.5px; color: ${C.textMuted}; font-weight: 600; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Layout */
        .pf-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; align-items: start; }
        .pf-main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
        .pf-side { display: flex; flex-direction: column; gap: 20px; position: sticky; top: 16px; min-width: 0; }

        .pf-card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 20px; padding: 22px; min-width: 0; transition: border-color .2s, box-shadow .2s; }
        .pf-card.editing { border-color: ${C.accent}88; box-shadow: 0 0 0 4px ${C.accentGlow}; }
        .pf-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
        .pf-card-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .pf-card-ico { width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .pf-card-h { font-size: 15px; font-weight: 800; color: ${C.text}; }
        .pf-card-sub { font-size: 12px; color: ${C.textMuted}; margin-top: 2px; display: flex; align-items: center; gap: 5px; }
        .pf-edit-btn { display: inline-flex; align-items: center; gap: 6px; background: ${C.surface}; border: 1px solid ${C.border}; color: ${C.text}; border-radius: 10px; padding: 7px 12px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; transition: border-color .15s; flex-shrink: 0; }
        .pf-edit-btn:hover:not(:disabled) { border-color: ${C.accent}88; }
        .pf-lock { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: ${C.textMuted}; background: ${C.surface}; border: 1px solid ${C.border}; padding: 5px 10px; border-radius: 999px; flex-shrink: 0; }

        .pf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .pf-field { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; background: ${C.surface}; border: 1px solid ${C.border}66; min-width: 0; transition: border-color .15s; }
        .pf-field:hover { border-color: ${C.border}; }
        .pf-field.full { grid-column: 1 / -1; }
        .pf-field-ico { width: 34px; height: 34px; border-radius: 10px; background: ${C.card}; border: 1px solid ${C.border}; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
        .pf-field-body { flex: 1; min-width: 0; }
        .pf-field-lbl { font-size: 10.5px; font-weight: 700; color: ${C.textMuted}; letter-spacing: .8px; text-transform: uppercase; }
        .pf-field-val { font-size: 13.5px; font-weight: 600; color: ${C.text}; margin-top: 3px; overflow-wrap: break-word; word-break: break-word; }
        .pf-anchor { text-decoration: none; display: block; }
        .pf-anchor:hover { color: ${C.accent}; }
        .pf-missing { color: ${C.textMuted}; font-weight: 500; font-style: italic; }
        .pf-field-acts { display: flex; gap: 4px; flex-shrink: 0; opacity: .65; transition: opacity .15s; }
        .pf-field:hover .pf-field-acts, .pf-field-acts:focus-within { opacity: 1; }
        .pf-icon-btn { width: 30px; height: 30px; border-radius: 9px; border: 1px solid transparent; background: transparent; color: ${C.textDim}; cursor: pointer; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; font-family: inherit; }
        .pf-icon-btn:hover { background: ${C.card}; border-color: ${C.border}; color: ${C.text}; }

        /* Form */
        .pf-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
        .pf-inp-wrap { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .pf-inp-wrap.full { grid-column: 1 / -1; }
        .pf-inp-lbl { font-size: 12px; font-weight: 700; color: ${C.textDim}; }
        .pf-input { width: 100%; box-sizing: border-box; background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 12px; color: ${C.text}; padding: 11px 13px; font-size: 14px; font-family: inherit; outline: none; transition: border-color .15s, box-shadow .15s; resize: vertical; color-scheme: ${C.bg === DARK.bg ? "dark" : "light"}; }
        .pf-input:focus { border-color: ${C.accent}; box-shadow: 0 0 0 3px ${C.accentGlow}; }
        .pf-input.err { border-color: ${C.red}; }
        .pf-input.err:focus { box-shadow: 0 0 0 3px ${C.red}2a; }
        .pf-inp-err { font-size: 11.5px; color: ${C.red}; font-weight: 600; }
        .pf-inp-hint { font-size: 11.5px; color: ${C.textMuted}; }
        .pf-card-foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 18px; padding-top: 16px; border-top: 1px solid ${C.border}; }
        .pf-foot-note { font-size: 12px; color: ${C.amber}; font-weight: 600; }

        /* Skills */
        .pf-skills { display: flex; flex-wrap: wrap; gap: 8px; }
        .pf-skill { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 700; color: ${C.text}; background: ${C.accent}14; border: 1px solid ${C.accent}33; }
        .pf-skill button { background: none; border: none; color: ${C.textMuted}; cursor: pointer; font-size: 14px; padding: 0 0 0 2px; line-height: 1; font-family: inherit; }
        .pf-skill button:hover { color: ${C.red}; }
        .pf-empty { display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px dashed ${C.border}; border-radius: 14px; color: ${C.textMuted}; font-size: 13px; }

        /* Sidebar */
        .pf-complete { display: flex; align-items: center; gap: 16px; }
        .pf-ring { position: relative; width: 84px; height: 84px; flex-shrink: 0; }
        .pf-ring b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 800; color: ${C.text}; }
        .pf-todo { display: flex; flex-direction: column; gap: 4px; margin-top: 16px; }
        .pf-todo button { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 9px 10px; border-radius: 10px; background: none; border: none; color: ${C.text}; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .pf-todo button:hover { background: ${C.surface}; }
        .pf-todo-dot { width: 18px; height: 18px; border-radius: 50%; border: 2px dashed ${C.textMuted}; flex-shrink: 0; }
        .pf-todo-add { margin-left: auto; color: ${C.accent}; font-size: 12px; font-weight: 700; }
        .pf-mile { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; background: ${C.surface}; border: 1px solid ${C.border}66; }
        .pf-mile + .pf-mile { margin-top: 10px; }
        .pf-mile-ico { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 19px; flex-shrink: 0; }
        .pf-mile-t { font-size: 13px; font-weight: 700; color: ${C.text}; }
        .pf-mile-s { font-size: 12px; color: ${C.textMuted}; margin-top: 2px; }
        .pf-mile-badge { margin-left: auto; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
        .pf-sec-row { display: flex; align-items: center; gap: 12px; }

        .pf-alert { background: ${C.red}14; color: ${C.red}; padding: 12px 16px; border-radius: 14px; font-size: 13px; font-weight: 600; border: 1px solid ${C.red}40; }
        .pf-btn:focus-visible, .pf-edit-btn:focus-visible, .pf-icon-btn:focus-visible, .pf-todo button:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }

        /* Mobile sticky save bar */
        .pf-sticky { display: none; }

        /* Password modal */
        .pf-pw-meter { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 2px; }
        .pf-pw-meter span { height: 5px; border-radius: 5px; background: ${C.border}; transition: background .2s; }
        .pf-pw-checks { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
        .pf-pw-checks div { font-size: 12px; display: flex; align-items: center; gap: 6px; }

        /* ── Responsive (container-based) ── */
        @container pf (max-width: 1100px) {
          .pf-layout { grid-template-columns: 1fr; }
          .pf-side { position: static; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .pf-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pf-stat:nth-child(3) { border-left: none; }
          .pf-stat:nth-child(n+3) { border-top: 1px solid ${C.border}; }
        }
        @container pf (max-width: 860px) {
          .pf-side { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pf-side > :first-child { grid-column: 1 / -1; }
          .pf-hero-acts { width: 100%; }
        }
        @container pf (max-width: 640px) {
          .pf-wrap, .pf-main, .pf-side { gap: 14px; }
          .pf-cover { height: 48px; }
          .pf-hero-body { flex-direction: column; align-items: center; text-align: center; padding: 0 16px 16px; gap: 10px; }
          .pf-hero-body > .pf-avatar { margin-top: -32px; }
          .pf-avatar { width: 72px; height: 72px; border-radius: 20px; font-size: 24px; }
          .pf-id, .pf-hero-acts { padding-top: 0; }
          .pf-id { min-width: 0; width: 100%; }
          .pf-sub, .pf-chips { justify-content: center; }
          .pf-hero-acts { justify-content: center; }
          .pf-hero-acts .pf-btn { flex: 1; }
          .pf-stat { padding: 14px; gap: 10px; }
          .pf-stat-ico { width: 32px; height: 32px; font-size: 15px; border-radius: 10px; }
          .pf-stat-val { font-size: 15px; }
          .pf-side { grid-template-columns: 1fr; }
          .pf-card { padding: 16px; border-radius: 18px; }
          .pf-grid, .pf-form { grid-template-columns: 1fr; }
          .pf-field-acts { opacity: 1; }
          .pf-edit-btn span { display: none; }
          .pf-card-foot { display: none; }
          .pf-sticky { display: flex; position: sticky; bottom: 12px; z-index: 20; gap: 10px; align-items: center; padding: 10px; border-radius: 16px; background: ${C.card}f2; border: 1px solid ${C.border}; box-shadow: 0 12px 40px rgba(0,0,0,.45); backdrop-filter: blur(10px); }
          .pf-sticky .pf-btn { flex: 1; }
          .pf-pw-checks { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="pf">
        <div className="pf-wrap">

          {/* ── Hero ── */}
          <section className="pf-hero">
            <div className="pf-cover" />
            <div className="pf-hero-body">
              <div className="pf-avatar">{currentUser.avatar || mkAvi(profile.name)}<span className="pf-status-dot" title="Active" /></div>
              <div className="pf-id">
                <div className="pf-name">{profile.name}</div>
                <div className="pf-sub">
                  <span>{profile.designation || roleLabel}</span>
                  {profile.custom_employee_id && <><span style={{ color: C.textMuted }}>·</span><span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5 }}>{profile.custom_employee_id}</span></>}
                </div>
                <div className="pf-chips">
                  <span className="pf-chip solid" style={{ color: roleColor, background: roleColor + "18", borderColor: roleColor + "44" }}>{roleLabel}</span>
                  {profile.group_name && <span className="pf-chip solid" style={{ color: `color-mix(in srgb, ${groupColor} 45%, ${C.text})`, background: groupColor + "22", borderColor: groupColor + "55" }}>{profile.group_name}</span>}
                  {profile.location && <span className="pf-chip">📍 {profile.location}</span>}
                  {joined && <span className="pf-chip">🗓 Joined {fmtD(profile.joining_date)}</span>}
                </div>
              </div>
              <div className="pf-hero-acts">
                <button className="pf-btn pf-btn-ghost" onClick={() => setShowPwModal(true)}>🔐 Password</button>
                <button className="pf-btn pf-btn-primary" onClick={() => requestEdit("personal")} disabled={editing === "personal"}>✏️ Edit Profile</button>
              </div>
            </div>
            <div className="pf-stats">
              {[
                { icon: "⏳", label: "Tenure", value: tenureLabel, color: C.accent },
                { icon: "🧑‍💼", label: "Reports to", value: profile.manager_name || "—", color: C.purple },
                { icon: "🛠", label: "Skills listed", value: skills.length, color: C.green },
                { icon: "✅", label: "Profile complete", value: `${completePct}%`, color: completeColor },
              ].map(s => (
                <div key={s.label} className="pf-stat">
                  <div className="pf-stat-ico" style={{ background: s.color + "18", border: `1px solid ${s.color}30` }}>{s.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="pf-stat-val">{s.value}</div>
                    <div className="pf-stat-lbl">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {err && <div className="pf-alert" role="alert">⚠ {err}</div>}

          <div className="pf-layout">
            {/* ── Main column ── */}
            <div className="pf-main">

              {/* Work details */}
              <section className="pf-card">
                <div className="pf-card-head">
                  <div className="pf-card-title">
                    <div className="pf-card-ico" style={{ background: C.accent + "18", border: `1px solid ${C.accent}30` }}>🏢</div>
                    <div><div className="pf-card-h">Work Details</div><div className="pf-card-sub">Managed by HR / admin</div></div>
                  </div>
                  <span className="pf-lock">🔒 Read-only</span>
                </div>
                <div className="pf-grid">
                  <PfField icon="👤" label="Full name" value={profile.name} />
                  <PfField icon="🪪" label="Employee ID" value={profile.custom_employee_id} mono copyKey="eid" copied={copied} onCopy={copy} />
                  <PfField icon="✉️" label="Work email" full value={profile.email} href={`mailto:${profile.email}`} copyKey="email" copied={copied} onCopy={copy} />
                  <PfField icon="💼" label="Designation" value={profile.designation} />
                  <PfField icon="👥" label="Group / Team" value={profile.group_name} />
                  <PfField icon="🧑‍💼" label="Reporting manager" value={profile.manager_name} />
                  <PfField icon="📅" label="Joining date" value={joined ? fmtD(profile.joining_date) : null} />
                  <PfField icon="📍" label="Location" value={profile.location} />
                  <PfField icon="💰" label="Annual CTC" full value={profile.ctc_annual ? fmt$(profile.ctc_annual) : null} masked="full" revealed={reveal.ctc} onReveal={() => toggleReveal("ctc")} />
                </div>
              </section>

              {/* Personal */}
              <section className={`pf-card${editing === "personal" ? " editing" : ""}`}>
                <div className="pf-card-head">
                  <div className="pf-card-title">
                    <div className="pf-card-ico" style={{ background: C.green + "18", border: `1px solid ${C.green}30` }}>🙂</div>
                    <div><div className="pf-card-h">Personal Information</div><div className="pf-card-sub">{editing === "personal" ? "Editing — remember to save" : "Visible to HR and your manager"}</div></div>
                  </div>
                  <EditBtn sec="personal" />
                </div>
                {editing === "personal" ? (
                  <div className="pf-form">
                    <PfInput label="Date of birth" name="dob" type="date" max={ymdLocal(today)} value={form.dob} onChange={setF} error={fieldErr("dob")} />
                    <PfInput label="Mobile" name="mobile" type="tel" value={form.mobile} onChange={setF} error={fieldErr("mobile")} placeholder="+91 98765 43210" />
                    <PfInput label="Emergency contact" name="emergencyContact" type="tel" value={form.emergencyContact} onChange={setF} error={fieldErr("emergencyContact")} placeholder="+91 98765 43210" hint="Someone we can reach in an emergency" full />
                    <PfInput label="Address" name="address" textarea value={form.address} onChange={setF} placeholder="House no, street, city, state, PIN" full />
                  </div>
                ) : (
                  <div className="pf-grid">
                    <PfField icon="🎂" label="Date of birth" value={dobD ? fmtD(form.dob) : null} />
                    <PfField icon="📱" label="Mobile" value={form.mobile} href={`tel:${(form.mobile || "").replace(/\s/g, "")}`} copyKey="mobile" copied={copied} onCopy={copy} />
                    <PfField icon="🆘" label="Emergency contact" value={form.emergencyContact} href={`tel:${(form.emergencyContact || "").replace(/\s/g, "")}`} full />
                    <PfField icon="🏠" label="Address" value={form.address} full copyKey="address" copied={copied} onCopy={copy} />
                  </div>
                )}
                <EditFooter sec="personal" />
              </section>

              {/* Skills */}
              <section className={`pf-card${editing === "skills" ? " editing" : ""}`}>
                <div className="pf-card-head">
                  <div className="pf-card-title">
                    <div className="pf-card-ico" style={{ background: C.purple + "18", border: `1px solid ${C.purple}30` }}>🛠</div>
                    <div><div className="pf-card-h">Skills</div><div className="pf-card-sub">{skills.length ? `${skills.length} skill${skills.length !== 1 ? "s" : ""} · helps with project staffing` : "Helps with project staffing"}</div></div>
                  </div>
                  <EditBtn sec="skills" />
                </div>
                {editing === "skills" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="pf-inp-wrap">
                      <label htmlFor="pf-skill-new" className="pf-inp-lbl">Add a skill</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input id="pf-skill-new" className="pf-input" value={skillDraft} placeholder="e.g. React, Python — press Enter"
                          onChange={e => setSkillDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(skillDraft); }
                            else if (e.key === "Backspace" && !skillDraft && skills.length) removeSkill(skills[skills.length - 1]);
                          }} />
                        <button className="pf-btn pf-btn-ghost" onClick={() => addSkill(skillDraft)} disabled={!skillDraft.trim()}>Add</button>
                      </div>
                      <div className="pf-inp-hint">Separate multiple skills with commas. Backspace removes the last one.</div>
                    </div>
                    {skills.length > 0 && (
                      <div className="pf-skills">
                        {skills.map(s => <span key={s} className="pf-skill">{s}<button onClick={() => removeSkill(s)} aria-label={`Remove ${s}`}>×</button></span>)}
                      </div>
                    )}
                  </div>
                ) : skills.length ? (
                  <div className="pf-skills">{skills.map(s => <span key={s} className="pf-skill">{s}</span>)}</div>
                ) : (
                  <div className="pf-empty"><span style={{ fontSize: 22 }}>✨</span>No skills added yet. Add a few so managers can find the right people for projects.</div>
                )}
                <EditFooter sec="skills" />
              </section>

              {/* Banking */}
              <section className={`pf-card${editing === "bank" ? " editing" : ""}`}>
                <div className="pf-card-head">
                  <div className="pf-card-title">
                    <div className="pf-card-ico" style={{ background: C.amber + "18", border: `1px solid ${C.amber}30` }}>🏦</div>
                    <div><div className="pf-card-h">Banking & Tax</div><div className="pf-card-sub">🛡 Sensitive · masked by default · used for payroll</div></div>
                  </div>
                  <EditBtn sec="bank" />
                </div>
                {editing === "bank" ? (
                  <div className="pf-form">
                    <PfInput label="PAN number" name="panNumber" value={form.panNumber} onChange={setF} error={fieldErr("panNumber")} placeholder="ABCDE1234F" upper />
                    <PfInput label="Bank name" name="bankName" value={form.bankName} onChange={setF} placeholder="e.g. HDFC Bank" />
                    <PfInput label="Account number" name="bankAccountNo" value={form.bankAccountNo} onChange={(k, v) => setF(k, v.replace(/\s/g, ""))} error={fieldErr("bankAccountNo")} placeholder="1234567890" />
                    <PfInput label="IFSC code" name="bankIfsc" value={form.bankIfsc} onChange={setF} error={fieldErr("bankIfsc")} placeholder="HDFC0001234" upper hint="11 characters, printed on your cheque book" />
                  </div>
                ) : (
                  <div className="pf-grid">
                    <PfField icon="🪪" label="PAN number" value={form.panNumber} mono masked="tail" revealed={reveal.pan} onReveal={() => toggleReveal("pan")} copyKey="pan" copied={copied} onCopy={copy} />
                    <PfField icon="🏛" label="Bank name" value={form.bankName} />
                    <PfField icon="🔢" label="Account number" value={form.bankAccountNo} mono masked="tail" revealed={reveal.acc} onReveal={() => toggleReveal("acc")} copyKey="acc" copied={copied} onCopy={copy} />
                    <PfField icon="🔤" label="IFSC code" value={form.bankIfsc} mono copyKey="ifsc" copied={copied} onCopy={copy} />
                  </div>
                )}
                <EditFooter sec="bank" />
              </section>

              {/* Mobile sticky save bar */}
              {editing && (
                <div className="pf-sticky">
                  <button className="pf-btn pf-btn-ghost" onClick={cancelEdit} disabled={saving}>Cancel</button>
                  <button className="pf-btn pf-btn-primary" onClick={handleSave} disabled={saving || !dirty || (touched.__submit && sectionHasErr(editing))}>{saving ? "Saving…" : "Save changes"}</button>
                </div>
              )}
            </div>

            {/* ── Sidebar ── */}
            <aside className="pf-side">
              <section className="pf-card">
                <div className="pf-complete">
                  <div className="pf-ring">{ring(completePct, completeColor)}<b>{completePct}%</b></div>
                  <div style={{ minWidth: 0 }}>
                    <div className="pf-card-h">Profile strength</div>
                    <div className="pf-card-sub" style={{ display: "block" }}>
                      {completePct === 100 ? "All set — your profile is complete 🎉" : `${checklist.length - doneCount} item${checklist.length - doneCount !== 1 ? "s" : ""} left to complete`}
                    </div>
                  </div>
                </div>
                {completePct < 100 && (
                  <div className="pf-todo">
                    {checklist.filter(c => !c.done).slice(0, 5).map(c => (
                      <button key={c.k} onClick={() => requestEdit(c.sec)}>
                        <span className="pf-todo-dot" />{c.label}<span className="pf-todo-add">Add</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="pf-card">
                <div className="pf-card-h" style={{ marginBottom: 14 }}>Milestones</div>
                <div className="pf-mile">
                  <div className="pf-mile-ico" style={{ background: "#EC4899" + "18", border: "1px solid #EC489930" }}>🎂</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="pf-mile-t">Birthday</div>
                    <div className="pf-mile-s">{dobD ? dobD.toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "Add your date of birth"}</div>
                  </div>
                  {bdayIn !== null && <span className="pf-mile-badge" style={{ color: "#EC4899", background: "#EC489918" }}>{bdayIn === 0 ? "Today 🎉" : `${bdayIn}d`}</span>}
                </div>
                <div className="pf-mile">
                  <div className="pf-mile-ico" style={{ background: C.amber + "18", border: `1px solid ${C.amber}30` }}>🏆</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="pf-mile-t">Work anniversary</div>
                    <div className="pf-mile-s">{joined ? (tenureMonths >= 1 ? `Year ${Math.floor(tenureMonths / 12) + 1} · since ${joined.getFullYear()}` : "Welcome aboard!") : "Joining date not set"}</div>
                  </div>
                  {annivIn !== null && <span className="pf-mile-badge" style={{ color: C.amber, background: C.amber + "18" }}>{annivIn === 0 ? "Today 🎉" : `${annivIn}d`}</span>}
                </div>
              </section>

              <section className="pf-card">
                <div className="pf-sec-row">
                  <div className="pf-mile-ico" style={{ background: C.green + "18", border: `1px solid ${C.green}30` }}>🔐</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="pf-card-h">Account security</div>
                    <div className="pf-card-sub" style={{ display: "block" }}>Signed in as <b style={{ color: C.textDim }}>{currentUser.username || profile.email}</b></div>
                  </div>
                </div>
                <button className="pf-btn pf-btn-ghost" style={{ width: "100%", marginTop: 14 }} onClick={() => setShowPwModal(true)}>Change password</button>
              </section>
            </aside>
          </div>
        </div>
      </div>

      {/* ── Change Password Modal ── */}
      {showPwModal && (
        <Modal title="Change password" onClose={closePw} maxWidth={460}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="pf-inp-wrap">
              <label htmlFor="pf-pw-old" className="pf-inp-lbl">Current password</label>
              <input id="pf-pw-old" className="pf-input" type={pwShow ? "text" : "password"} autoComplete="current-password" value={pwForm.oldPassword} onChange={e => setPwForm(f => ({ ...f, oldPassword: e.target.value }))} />
            </div>
            <div className="pf-inp-wrap">
              <label htmlFor="pf-pw-new" className="pf-inp-lbl">New password</label>
              <input id="pf-pw-new" className="pf-input" type={pwShow ? "text" : "password"} autoComplete="new-password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} />
              {pwForm.newPassword && (
                <>
                  <div className="pf-pw-meter">{[0, 1, 2, 3].map(i => <span key={i} style={i < pw.score ? { background: pwColors[pw.score] } : undefined} />)}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: pwColors[pw.score] }}>{pwLabels[pw.score]}</div>
                </>
              )}
            </div>
            <div className="pf-inp-wrap">
              <label htmlFor="pf-pw-confirm" className="pf-inp-lbl">Confirm new password</label>
              <input id="pf-pw-confirm" className={`pf-input${pwForm.confirm && !pwMatch ? " err" : ""}`} type={pwShow ? "text" : "password"} autoComplete="new-password" value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") handleSavePw(); }} />
              {pwForm.confirm && !pwMatch && <div className="pf-inp-err">Passwords don't match</div>}
            </div>
            <div className="pf-pw-checks">
              {pw.checks.map(c => <div key={c.label} style={{ color: c.ok ? C.green : C.textMuted }}>{c.ok ? "✓" : "○"} {c.label}</div>)}
              {pwForm.newPassword && pwForm.newPassword === pwForm.oldPassword && <div style={{ color: C.red }}>✕ Must differ from current</div>}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.textDim, cursor: "pointer" }}>
              <input type="checkbox" checked={pwShow} onChange={e => setPwShow(e.target.checked)} /> Show passwords
            </label>
            {pwErr && <div className="pf-alert" role="alert">⚠ {pwErr}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button className="pf-btn pf-btn-ghost" onClick={closePw}>Cancel</button>
              <button className="pf-btn pf-btn-primary" onClick={handleSavePw} disabled={!pwReady || pwSaving}>{pwSaving ? "Updating…" : "Update password"}</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════
// EMPLOYEE HOME
// ════════════════════════════════════════════════════════
// ── Employee / Manager Dashboard ─────────────────────────────────────────────
const PIE_COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#F97316", "#EC4899"];

function EmployeeDashboard({ currentUser, navFn }) {
  const [loading, setLoading] = useState(true);
  const [bal, setBal] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [teamPending, setTeamPending] = useState({ timesheets: 0, leaves: 0 });
  const [employeeData, setEmployeeData] = useState(null);

  useEffect(() => {
    async function load() {
      const empId = currentUser.employee_id;
      const isMgr = currentUser.role === "manager";
      const results = await Promise.allSettled([
        api.getLeaveBalance(empId),
        api.getLeaves({ employee_id: empId }),
        api.getTimesheets({ employee_id: empId }),
        api.getExpenses({ employee_id: empId }),
        api.getEmployee(empId),
        ...(isMgr ? [api.getTimesheets(), api.getLeaves()] : []),
      ]);
      const [balR, lvR, tsR, expR, empR, allTsR, allLvR] = results;
      setBal(balR.status === "fulfilled" ? balR.value : null);
      setLeaves(lvR.status === "fulfilled" ? (lvR.value || []) : []);
      setTimesheets(tsR.status === "fulfilled" ? (tsR.value || []) : []);
      setExpenses(expR.status === "fulfilled" ? (expR.value || []) : []);
      setEmployeeData(empR.status === "fulfilled" ? empR.value : null);
      if (isMgr && allTsR && allLvR) {
        const allTs = allTsR.status === "fulfilled" ? (allTsR.value || []) : [];
        const allLv = allLvR.status === "fulfilled" ? (allLvR.value || []) : [];
        setTeamPending({
          timesheets: allTs.filter(t => t.status === "pending" && t.employee_id !== empId).length,
          leaves: allLv.filter(l => l.status === "pending" && l.employee_id !== empId).length,
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Parse date strings as local time (avoid UTC offset shifting date by 1 day)
  const parseLocalDate = d => { if (!d) return new Date(0); const [y, m, day] = String(d).split("-"); return new Date(+y, +m - 1, +day); };

  const tsDate = t => (t.work_date || t.date || "").slice(0, 10);
  const weekTs = timesheets.filter(t => parseLocalDate(tsDate(t)) >= weekStart);
  const weekHours = weekTs.reduce((s, t) => s + (+t.hours || 0), 0);
  const pendingTsCount = timesheets.filter(t => t.status === "pending").length;
  const pendingExp = expenses.filter(e => e.status === "pending");
  const pendingExpAmt = pendingExp.reduce((s, e) => s + (+e.amount || 0), 0);
  const balNum = bal ? parseFloat(bal.balance) || 0 : 0;
  const balColor = balNum >= 4 ? C.green : balNum >= 2 ? C.amber : C.red;

  // Monthly utilization
  const getWorkdaysInMonth = (year, month) => {
    let workdays = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const day = new Date(year, month, i).getDay();
      if (day !== 0 && day !== 6) workdays++;
    }
    return workdays;
  };
  const monthBaseHours = getWorkdaysInMonth(now.getFullYear(), now.getMonth()) * 9;

  const monthTs = timesheets.filter(t => parseLocalDate(tsDate(t)) >= monthStart && t.status === "approved");
  const utilizedHours = monthTs.reduce((s, t) => s + (+t.hours || 0), 0);
  const unutilizedHours = Math.max(0, monthBaseHours - utilizedHours);

  const utilizationData = [
    ...(utilizedHours > 0 ? [{ name: "Utilized", hours: utilizedHours, color: C.green }] : []),
    ...(unutilizedHours > 0 ? [{ name: "Unutilized", hours: unutilizedHours, color: C.border }] : [])
  ];

  const totalMonthHours = utilizedHours;

  const recentTs = [...timesheets].sort((a, b) => parseLocalDate(tsDate(b)) - parseLocalDate(tsDate(a))).slice(0, 5);
  const recentLeaves = [...leaves].sort((a, b) => parseLocalDate(b.start_date) - parseLocalDate(a.start_date)).slice(0, 5);

  const greet = now.getHours() < 12 ? "Good Morning" : now.getHours() < 17 ? "Good Afternoon" : "Good Evening";
  const fullDate = now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstName = (currentUser.emp_name || currentUser.username || "").split(" ")[0];

  const scol = s => s === "approved" ? C.green : s === "rejected" ? C.red : s === "draft" ? C.textMuted : C.amber;
  const slbl = s => ({ approved: "Approved", rejected: "Rejected", draft: "Draft", pending: "Pending" }[s] || s);
  const fmtD2 = d => { try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); } catch { return d || "—"; } };

  const portalPage = currentUser.role === "manager" ? "mywork" : "employee-home";
  const isInternGroup = employeeData ? /intern|intras/i.test(employeeData.group_name || "") : false;

  const kpis = [
    { label: "Leave Balance", value: `${balNum}d`, sub: `${parseFloat(bal?.total_used || 0)}d used`, icon: "🌴", color: balColor },
    { label: "Hours This Week", value: `${weekHours}h`, sub: `${weekTs.length} entries`, icon: "⏱", color: C.accent },
    { label: "Pending Timesheets", value: pendingTsCount, sub: pendingTsCount === 0 ? "All up to date" : "Awaiting approval", icon: "📋", color: pendingTsCount > 0 ? C.amber : C.green },
    { label: "Expense Claims", value: fmt$(pendingExpAmt), sub: `${pendingExp.length} pending`, icon: "💳", color: pendingExp.length > 0 ? C.purple : C.textDim },
  ].filter(k => k.label !== "Leave Balance" || !isInternGroup);

  const quickActions = [
    { icon: "⏱", label: "Log Time", sub: "Add timesheet entry", color: C.accent, page: portalPage, tab: "timesheets" },
    { icon: "🌴", label: "Request Leave", sub: "Apply for time off", color: C.green, page: portalPage, tab: "leave" },
    { icon: "💳", label: "Claim Expense", sub: "Submit reimbursement", color: C.purple, page: portalPage, tab: "expenses" },
    { icon: "💰", label: "My Payslip", sub: "View your earnings", color: C.amber, page: portalPage, tab: "pay" },
    { icon: "👤", label: "My Profile", sub: "Update your details", color: C.textDim, page: portalPage, tab: "profile" },
  ].filter(a => a.label !== "My Payslip" || currentUser.role !== "intras");

  if (loading) return <Spinner />;

  // ── Derived view data ──
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const weekTarget = 45;
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = ymd(d);
    const hours = weekTs.filter(t => tsDate(t) === key).reduce((s, t) => s + (+t.hours || 0), 0);
    return { key, label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i], hours, isToday: key === ymd(now), isWeekend: i >= 5 };
  });
  const maxDay = Math.max(9, ...weekDays.map(d => d.hours));
  const weekPct = Math.min(100, Math.round((weekHours / weekTarget) * 100));
  const utilPct = monthBaseHours > 0 ? Math.round((utilizedHours / monthBaseHours) * 100) : 0;
  const roleColor = currentUser.role === "manager" ? C.amber : C.green;
  const roleLabel = currentUser.role === "manager" ? "Manager" : currentUser.role === "intras" ? "Intern" : "Employee";
  const kpiTabs = { "Leave Balance": "leave", "Hours This Week": "timesheets", "Pending Timesheets": "timesheets", "Expense Claims": "expenses" };
  const leaveCredited = bal ? parseFloat(bal.total_credited) || 0 : 0;
  const leaveUsed = bal ? parseFloat(bal.total_used) || 0 : 0;

  const Pill = ({ status }) => (
    <span className="pd-pill" style={{ color: scol(status), background: scol(status) + "1a", borderColor: scol(status) + "33" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: scol(status) }} />
      {slbl(status)}
    </span>
  );

  const CardHead = ({ icon, title, action, meta }) => (
    <div className="pd-card-head">
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span className="pd-card-ico">{icon}</span>
        <span className="pd-card-title">{title}</span>
      </div>
      {action ? <button className="pd-link" onClick={action}>View all <span aria-hidden>→</span></button> : meta}
    </div>
  );

  return (
    <>
      <style>{`
        .pd { container-type: inline-size; container-name: pd; }
        .pd-wrap { display: flex; flex-direction: column; gap: 20px; }

        /* Hero */
        .pd-hero { position: relative; overflow: hidden; border-radius: 24px; border: 1px solid ${C.border};
          background:
            radial-gradient(600px 260px at 0% 0%, ${C.accent}1f, transparent 60%),
            radial-gradient(520px 260px at 100% 100%, ${C.purple}1a, transparent 60%),
            ${C.card};
          padding: 28px; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 28px; align-items: center; }
        .pd-hero-id { display: flex; align-items: center; gap: 18px; min-width: 0; }
        .pd-avatar { width: 64px; height: 64px; border-radius: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
          font-size: 22px; font-weight: 800; color: #fff; background: linear-gradient(135deg, ${C.accent}, ${C.purple}); box-shadow: 0 10px 30px ${C.accent}40; }
        .pd-date { font-size: 12px; color: ${C.textMuted}; font-weight: 600; letter-spacing: .3px; }
        .pd-greet { font-size: clamp(22px, 2.6vw, 30px); font-weight: 800; color: ${C.text}; letter-spacing: -0.6px; line-height: 1.15; margin-top: 4px; }
        .pd-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; font-size: 12px; color: ${C.textDim}; }
        .pd-chip { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; border: 1px solid; letter-spacing: .4px; text-transform: uppercase; }
        .pd-dot-sep { width: 3px; height: 3px; border-radius: 50%; background: ${C.textMuted}; }
        .pd-cta { display: flex; gap: 10px; margin-top: 22px; flex-wrap: wrap; }
        .pd-btn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid transparent; transition: transform .15s, box-shadow .15s, background .15s; font-family: inherit; }
        .pd-btn:hover { transform: translateY(-1px); }
        .pd-btn-primary { background: ${C.accent}; color: #fff; box-shadow: 0 8px 24px ${C.accent}45; }
        .pd-btn-ghost { background: ${C.surface}; color: ${C.text}; border-color: ${C.border}; }
        .pd-btn-ghost:hover { border-color: ${C.accent}66; }

        .pd-week { background: ${C.surface}cc; backdrop-filter: blur(8px); border: 1px solid ${C.border}; border-radius: 18px; padding: 18px 20px; }
        .pd-week-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
        .pd-eyebrow { font-size: 11px; font-weight: 700; color: ${C.textMuted}; letter-spacing: .8px; text-transform: uppercase; }
        .pd-week-val { font-size: 26px; font-weight: 800; color: ${C.text}; letter-spacing: -0.5px; line-height: 1; margin-top: 6px; }
        .pd-week-val small { font-size: 13px; color: ${C.textMuted}; font-weight: 600; margin-left: 4px; }
        .pd-week-side { text-align: right; font-size: 12px; color: ${C.textDim}; }
        .pd-week-side b { display: block; font-size: 18px; color: ${C.purple}; font-weight: 800; }
        .pd-bars { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; height: 92px; margin-top: 16px; align-items: end; }
        .pd-bar { display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; }
        .pd-bar-track { width: 100%; max-width: 28px; flex: 1; border-radius: 8px; background: ${C.border}66; display: flex; align-items: flex-end; overflow: hidden; }
        .pd-bar-fill { width: 100%; border-radius: 8px; background: linear-gradient(180deg, ${C.accent}, ${C.accent}99); transition: height .6s ease; }
        .pd-bar-lbl { font-size: 10px; font-weight: 600; color: ${C.textMuted}; }
        .pd-bar.today .pd-bar-lbl { color: ${C.accent}; font-weight: 800; }
        .pd-bar.today .pd-bar-track { box-shadow: 0 0 0 1.5px ${C.accent}88; }
        .pd-progress { height: 6px; background: ${C.border}; border-radius: 6px; overflow: hidden; margin-top: 14px; }
        .pd-progress > div { height: 100%; border-radius: 6px; transition: width .6s ease; }

        /* KPIs */
        .pd-kpis { display: grid; grid-template-columns: repeat(${kpis.length}, minmax(0, 1fr)); gap: 14px; }
        .pd-kpi { text-align: left; font-family: inherit; cursor: pointer; position: relative; overflow: hidden; background: ${C.card}; border: 1px solid ${C.border}; border-radius: 18px; padding: 18px; display: flex; flex-direction: column; gap: 14px; transition: transform .18s, border-color .18s, box-shadow .18s; }
        .pd-kpi:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--k) 40%, transparent); box-shadow: 0 14px 34px -16px color-mix(in srgb, var(--k) 60%, transparent); }
        .pd-kpi::after { content: ""; position: absolute; right: -30px; top: -30px; width: 110px; height: 110px; border-radius: 50%; background: var(--k); opacity: .07; pointer-events: none; }
        .pd-kpi-top { display: flex; justify-content: space-between; align-items: center; }
        .pd-kpi-ico { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 19px; }
        .pd-kpi-arrow { color: ${C.textMuted}; font-size: 16px; transition: transform .18s, color .18s; }
        .pd-kpi:hover .pd-kpi-arrow { transform: translate(2px, -2px); color: ${C.text}; }
        .pd-kpi-val { font-size: 26px; font-weight: 800; letter-spacing: -0.6px; line-height: 1; }
        .pd-kpi-lbl { font-size: 13px; font-weight: 700; color: ${C.text}; margin-top: 6px; }
        .pd-kpi-sub { font-size: 12px; color: ${C.textMuted}; margin-top: 2px; }

        /* Alert */
        .pd-alert { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 18px; border-radius: 16px; background: ${C.amber}12; border: 1px solid ${C.amber}33; }
        .pd-alert-tag { background: ${C.amber}22; border: 1px solid ${C.amber}40; border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 700; color: ${C.amber}; }

        /* Main bento grid */
        .pd-main { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: "ts lv ut"; gap: 16px; }
        .pd-card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 20px; padding: 20px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .pd-card-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 2px; }
        .pd-card-ico { width: 32px; height: 32px; border-radius: 10px; background: ${C.surface}; border: 1px solid ${C.border}; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
        .pd-card-title { font-size: 14px; font-weight: 800; color: ${C.text}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pd-link { background: none; border: none; color: ${C.accent}; font-size: 12px; font-weight: 700; cursor: pointer; padding: 6px 8px; border-radius: 8px; white-space: nowrap; font-family: inherit; }
        .pd-link:hover { background: ${C.accentGlow}; }
        .pd-list { display: flex; flex-direction: column; gap: 4px; }
        .pd-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; transition: background .15s; min-width: 0; }
        .pd-row:hover { background: ${C.surface}; }
        .pd-row-ico { width: 36px; height: 36px; border-radius: 11px; background: ${C.surface}; border: 1px solid ${C.border}; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
        .pd-row-main { flex: 1; min-width: 0; }
        .pd-row-title { font-size: 13px; font-weight: 700; color: ${C.text}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pd-row-sub { font-size: 11.5px; color: ${C.textMuted}; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pd-row-end { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .pd-hours { font-size: 13px; font-weight: 800; color: ${C.text}; font-variant-numeric: tabular-nums; }
        .pd-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; border: 1px solid; white-space: nowrap; }
        .pd-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; color: ${C.textMuted}; font-size: 13px; padding: 28px 12px; border: 1px dashed ${C.border}; border-radius: 14px; }
        .pd-empty span { font-size: 28px; }

        .pd-bal { border-radius: 16px; padding: 16px; background: linear-gradient(135deg, ${balColor}14, transparent 70%), ${C.surface}; border: 1px solid ${C.border}; }
        .pd-bal-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
        .pd-bal-num { font-size: 28px; font-weight: 800; color: ${balColor}; letter-spacing: -0.5px; line-height: 1; }
        .pd-bal-num small { font-size: 13px; color: ${C.textMuted}; font-weight: 600; margin-left: 4px; letter-spacing: 0; }
        .pd-bal-foot { display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: ${C.textMuted}; }

        .pd-util-body { display: flex; flex-direction: column; align-items: center; gap: 16px; flex: 1; justify-content: center; }
        .pd-donut { position: relative; width: 100%; max-width: 230px; height: 220px; }
        .pd-donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
        .pd-donut-center b { font-size: 34px; font-weight: 800; color: ${C.text}; letter-spacing: -1px; line-height: 1; }
        .pd-donut-center span { font-size: 11px; color: ${C.textMuted}; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; margin-top: 6px; }
        .pd-legend { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .pd-legend > div { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 12px; padding: 10px 12px; min-width: 0; }
        .pd-legend-lbl { display: flex; align-items: center; gap: 6px; font-size: 11px; color: ${C.textMuted}; font-weight: 600; white-space: nowrap; }
        .pd-legend-val { font-size: 15px; font-weight: 800; color: ${C.text}; margin-top: 4px; font-variant-numeric: tabular-nums; }

        /* Quick actions */
        .pd-qa-grid { display: grid; grid-template-columns: repeat(${quickActions.length}, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
        .pd-qa { font-family: inherit; display: flex; align-items: center; gap: 12px; text-align: left; padding: 14px 16px; border-radius: 16px; border: 1px solid ${C.border}; background: ${C.card}; cursor: pointer; transition: transform .18s, border-color .18s, background .18s; min-width: 0; }
        .pd-qa:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--a) 45%, transparent); background: linear-gradient(135deg, color-mix(in srgb, var(--a) 10%, transparent), transparent 70%), ${C.card}; }
        .pd-qa:focus-visible, .pd-kpi:focus-visible, .pd-btn:focus-visible, .pd-link:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
        .pd-qa-ico { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .pd-qa-lbl { font-size: 13px; font-weight: 700; color: ${C.text}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pd-qa-sub { font-size: 11.5px; color: ${C.textMuted}; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* ── Responsive (container-based, so it adapts to sidebar open/closed) ── */
        @container pd (max-width: 1180px) {
          .pd-main { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: "ts lv" "ut ut"; }
          .pd-util-body { flex-direction: row; justify-content: space-around; }
          .pd-donut { max-width: 220px; }
          .pd-legend { max-width: 420px; grid-template-columns: 1fr; }
          .pd-qa { flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 16px 10px; }
          .pd-qa > div:last-child { width: 100%; }
        }
        @container pd (max-width: 900px) {
          .pd-hero { grid-template-columns: 1fr; gap: 22px; }
          .pd-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @container pd (max-width: 640px) {
          .pd-wrap { gap: 16px; }
          .pd-hero { padding: 20px; border-radius: 20px; }
          .pd-avatar { width: 52px; height: 52px; border-radius: 16px; font-size: 18px; }
          .pd-hero-id { gap: 14px; }
          .pd-cta .pd-btn { flex: 1; justify-content: center; }
          .pd-week { padding: 16px; }
          .pd-bars { height: 76px; gap: 6px; }
          .pd-kpis { gap: 10px; }
          .pd-kpi { padding: 14px; gap: 10px; border-radius: 16px; }
          .pd-kpi-ico { width: 34px; height: 34px; font-size: 16px; border-radius: 10px; }
          .pd-kpi-val { font-size: 22px; }
          .pd-kpi-lbl { font-size: 12px; }
          .pd-kpi-sub { font-size: 11px; }
          .pd-main { grid-template-columns: 1fr; grid-template-areas: "ts" "lv" "ut"; }
          .pd-card { padding: 16px; border-radius: 18px; }
          .pd-row { padding: 9px 6px; }
          .pd-util-body { flex-direction: column; }
          .pd-legend { grid-template-columns: repeat(3, 1fr); max-width: none; }
          .pd-qa-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .pd-qa { flex-direction: column; align-items: flex-start; text-align: left; gap: 10px; padding: 14px; }
          .pd-qa-sub { white-space: normal; }
          .pd-qa:last-child:nth-child(odd) { grid-column: 1 / -1; flex-direction: row; align-items: center; }
          .pd-legend > div { padding: 8px 10px; }
          .pd-legend-val { font-size: 14px; }
        }
        @container pd (max-width: 340px) {
          .pd-legend { grid-template-columns: 1fr; }
          .pd-row-sub { white-space: normal; }
          .pd-kpi-arrow { display: none; }
        }
      `}</style>

      <div className="pd">
        <div className="pd-wrap">

          {/* ── Hero ── */}
          <section className="pd-hero">
            <div style={{ minWidth: 0 }}>
              <div className="pd-hero-id">
                <div className="pd-avatar">{mkAvi(currentUser.emp_name || currentUser.username)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="pd-date">{fullDate}</div>
                  <div className="pd-greet">{greet}, {firstName} 👋</div>
                  <div className="pd-meta">
                    <span className="pd-chip" style={{ color: roleColor, background: roleColor + "1a", borderColor: roleColor + "44" }}>{roleLabel}</span>
                    {currentUser.group_name && <><span className="pd-dot-sep" /><span>{currentUser.group_name}</span></>}
                    {currentUser.emp_id && <><span className="pd-dot-sep" /><span>ID {currentUser.emp_id}</span></>}
                  </div>
                </div>
              </div>
              <div className="pd-cta">
                <button className="pd-btn pd-btn-primary" onClick={() => navFn(portalPage, "timesheets")}>⏱ Log Time</button>
                <button className="pd-btn pd-btn-ghost" onClick={() => navFn(portalPage, "leave")}>🌴 Request Leave</button>
              </div>
            </div>

            <div className="pd-week">
              <div className="pd-week-top">
                <div>
                  <div className="pd-eyebrow">This week</div>
                  <div className="pd-week-val">{weekHours}h<small>/ {weekTarget}h</small></div>
                </div>
                <div className="pd-week-side">
                  <b>{totalMonthHours}h</b>
                  approved this month
                </div>
              </div>
              <div className="pd-bars" role="img" aria-label={`Hours logged per day this week: ${weekDays.map(d => `${d.label} ${d.hours}h`).join(", ")}`}>
                {weekDays.map(d => (
                  <div key={d.key} className={`pd-bar${d.isToday ? " today" : ""}`} title={`${d.label}: ${d.hours}h`}>
                    <div className="pd-bar-track" style={d.isWeekend ? { opacity: .55 } : undefined}>
                      <div className="pd-bar-fill" style={{ height: `${(d.hours / maxDay) * 100}%` }} />
                    </div>
                    <span className="pd-bar-lbl">{d.label}</span>
                  </div>
                ))}
              </div>
              <div className="pd-progress"><div style={{ width: `${weekPct}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.purple})` }} /></div>
            </div>
          </section>

          {/* ── KPI cards ── */}
          <section className="pd-kpis">
            {kpis.map(k => (
              <button key={k.label} className="pd-kpi" style={{ "--k": k.color }} onClick={() => navFn(portalPage, kpiTabs[k.label])}>
                <div className="pd-kpi-top">
                  <div className="pd-kpi-ico" style={{ background: k.color + "1a", border: `1px solid ${k.color}30` }}>{k.icon}</div>
                  <span className="pd-kpi-arrow" aria-hidden>↗</span>
                </div>
                <div>
                  <div className="pd-kpi-val" style={{ color: k.color }}>{k.value}</div>
                  <div className="pd-kpi-lbl">{k.label}</div>
                  <div className="pd-kpi-sub">{k.sub}</div>
                </div>
              </button>
            ))}
          </section>

          {/* ── Manager team pending alert ── */}
          {currentUser.role === "manager" && (teamPending.timesheets > 0 || teamPending.leaves > 0) && (
            <div className="pd-alert">
              <span style={{ fontSize: 18 }}>⏳</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginRight: 4 }}>Team reviews pending</span>
              {teamPending.timesheets > 0 && <span className="pd-alert-tag">{teamPending.timesheets} timesheet{teamPending.timesheets !== 1 ? "s" : ""}</span>}
              {teamPending.leaves > 0 && <span className="pd-alert-tag">{teamPending.leaves} leave request{teamPending.leaves !== 1 ? "s" : ""}</span>}
            </div>
          )}

          {/* ── Bento: Timesheets | Leave | Utilization ── */}
          <section className="pd-main">

            <div className="pd-card" style={{ gridArea: "ts" }}>
              <CardHead icon="⏱" title="Recent Timesheets" action={() => navFn(portalPage, "timesheets")} />
              {recentTs.length === 0 ? (
                <div className="pd-empty"><span>🗒️</span>No timesheets yet</div>
              ) : (
                <div className="pd-list">
                  {recentTs.map(t => (
                    <div key={t.id} className="pd-row">
                      <div className="pd-row-ico" style={{ color: C.accent, fontSize: 12, fontWeight: 800 }}>{mkAvi(t.project_name || "—")}</div>
                      <div className="pd-row-main">
                        <div className="pd-row-title">{t.project_name || "—"}</div>
                        <div className="pd-row-sub">{fmtD2(tsDate(t))}{t.task ? ` · ${t.task}` : ""}</div>
                      </div>
                      <div className="pd-row-end">
                        <span className="pd-hours">{(+t.hours || 0).toFixed(1)}h</span>
                        <Pill status={t.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pd-card" style={{ gridArea: "lv" }}>
              <CardHead icon="🌴" title="Leave" action={() => navFn(portalPage, "leave")} />
              {bal && !isInternGroup && (
                <div className="pd-bal">
                  <div className="pd-bal-row">
                    <div className="pd-bal-num">{balNum}d<small>remaining</small></div>
                    <span style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>of {leaveCredited}d</span>
                  </div>
                  <div className="pd-progress" style={{ marginTop: 12 }}>
                    <div style={{ width: `${Math.min(100, (balNum / Math.max(leaveCredited || 1, balNum)) * 100)}%`, background: `linear-gradient(90deg, ${balColor}, ${balColor}aa)` }} />
                  </div>
                  <div className="pd-bal-foot"><span>{leaveUsed}d used</span><span>{leaveCredited}d credited</span></div>
                </div>
              )}
              {recentLeaves.length === 0 ? (
                <div className="pd-empty"><span>🏖️</span>No leave requests yet</div>
              ) : (
                <div className="pd-list">
                  {recentLeaves.map(l => {
                    const days = Math.round((parseLocalDate(l.end_date) - parseLocalDate(l.start_date)) / 86400000) + 1;
                    const typeIcon = { Annual: "🌴", Sick: "🤒", Unpaid: "⏸", Maternity: "🤰", Paternity: "👶", Reserve: "🗓️" }[l.leave_type] || "📋";
                    return (
                      <div key={l.id} className="pd-row">
                        <div className="pd-row-ico">{typeIcon}</div>
                        <div className="pd-row-main">
                          <div className="pd-row-title">{l.leave_type}</div>
                          <div className="pd-row-sub">{fmtD2(l.start_date)} → {fmtD2(l.end_date)} · {days}d</div>
                        </div>
                        <div className="pd-row-end"><Pill status={l.status} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pd-card" style={{ gridArea: "ut" }}>
              <CardHead icon="📊" title={`${monthName} Utilization`} meta={<span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>{monthBaseHours}h base</span>} />
              <div className="pd-util-body">
                <div className="pd-donut">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={utilizationData} dataKey="hours" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={76} paddingAngle={utilizationData.length > 1 ? 2 : 0} cornerRadius={8} strokeWidth={0} startAngle={90} endAngle={-270}>
                        {utilizationData.map(d => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip
                        formatter={(v, n) => [`${v}h (${monthBaseHours > 0 ? ((v / monthBaseHours) * 100).toFixed(0) : 0}%)`, n]}
                        contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, color: C.text }}
                        itemStyle={{ color: C.text }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pd-donut-center">
                    <b>{utilPct}%</b>
                    <span>Utilized</span>
                  </div>
                </div>
                <div className="pd-legend">
                  <div>
                    <div className="pd-legend-lbl"><span style={{ width: 8, height: 8, borderRadius: 3, background: C.green }} />Approved</div>
                    <div className="pd-legend-val">{utilizedHours}h</div>
                  </div>
                  <div>
                    <div className="pd-legend-lbl"><span style={{ width: 8, height: 8, borderRadius: 3, background: C.border }} />Remaining</div>
                    <div className="pd-legend-val">{unutilizedHours}h</div>
                  </div>
                  <div>
                    <div className="pd-legend-lbl"><span style={{ width: 8, height: 8, borderRadius: 3, background: C.textMuted }} />Base</div>
                    <div className="pd-legend-val">{monthBaseHours}h</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Quick Actions ── */}
          <section>
            <div className="pd-eyebrow">Quick actions</div>
            <div className="pd-qa-grid">
              {quickActions.map(a => (
                <button key={a.label} className="pd-qa" style={{ "--a": a.color }} onClick={() => navFn(a.page, a.tab)}>
                  <div className="pd-qa-ico" style={{ background: a.color + "1a", border: `1px solid ${a.color}30` }}>{a.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="pd-qa-lbl">{a.label}</div>
                    <div className="pd-qa-sub">{a.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
function EmployeeHome({ currentUser, defaultTab, navFn }) {
  const [tab, setTab] = useState("profile");
  useEffect(() => { if (defaultTab) setTab(defaultTab); }, [defaultTab]);

  const roleLabel = currentUser.role === "manager" ? "Manager"
    : currentUser.role === "admin" ? "Admin"
      : currentUser.role === "intras" ? "Intern"
        : "Employee";

  const roleColor = currentUser.role === "admin" ? C.red
    : currentUser.role === "manager" ? C.amber
      : currentUser.role === "intras" ? C.purple
        : C.green;

  const tabs = [
    { key: "profile", icon: "👤", label: "My Profile" },
    { key: "timesheets", icon: "⏱", label: "My Timesheets" },
    { key: "leave", icon: "🌴", label: "My Leave" },
    { key: "expenses", icon: "💳", label: "My Expenses" },
    { key: "pay", icon: "💰", label: "My Pay" },
    { key: "performance", icon: "🎯", label: "My Performance" },
    { key: "policies", icon: "📋", label: "Company Policy" },
  ].filter(t => {
    if (t.key === "pay" && currentUser.role === "intras") return false;
    if (t.key === "performance" && currentUser.role === "intras") return false;
    return true;
  });

  return (
    <>
      <style>{`
        .eh-tabs-bar { display: flex; overflow-x: auto; gap: 2px; scrollbar-width: none; }
        .eh-tabs-bar::-webkit-scrollbar { display: none; }
        .eh-tab-btn { display: flex; align-items: center; gap: 7px; padding: 11px 20px; border: none; cursor: pointer; font-size: 13.5px; font-weight: 600; white-space: nowrap; border-bottom: 3px solid transparent; transition: all .18s; background: transparent; }
        .eh-tab-btn:hover { color: #ffffff !important; background: rgba(255,255,255,0.05); }
        @media (max-width: 768px) {
          .eh-hero-content { padding: 0 20px !important; }
          .eh-hero-name { font-size: 22px !important; }
          .eh-hero-meta { display: none; }
          .eh-tab-btn { padding: 10px 14px; font-size: 12.5px; }
        }
        @media (max-width: 500px) {
          .eh-tab-btn .eh-tab-label { display: none; }
          .eh-tab-btn { padding: 10px 14px; font-size: 18px; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Back to Dashboard ── */}
        {navFn && (
          <div>
            <button onClick={() => navFn("emp-dashboard")} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "9px 18px", cursor: "pointer",
              color: C.accent, fontSize: 13, fontWeight: 700,
            }}>
              ← Back to Dashboard
            </button>
          </div>
        )}

        {/* ── Hero Banner ── */}
        <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", border: `1px solid ${C.border}`, boxShadow: "0 8px 40px rgba(0,0,0,0.4)", display: "none" }}>
          {/* Background image */}
          <img src="/banner.jpg" alt="Fascinate IT"
            style={{ width: "100%", height: 220, display: "block", objectFit: "cover", objectPosition: "bottom" }} />

          {/* Gradient overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(100deg, rgba(8,12,24,0.95) 0%, rgba(8,12,24,0.78) 45%, rgba(8,12,24,0.15) 100%)",
          }} />

          {/* Content */}
          <div className="eh-hero-content" style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 36px",
          }}>
            {/* Left: Avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {/* Avatar ring */}
              <div style={{
                padding: 3, borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                boxShadow: `0 0 24px ${C.accent}55`,
              }}>
                <div style={{
                  width: 68, height: 68, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${C.accent}cc, ${C.purple}99)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: -1,
                  border: "2px solid rgba(0,0,0,0.4)",
                }}>
                  {currentUser.avatar || mkAvi(currentUser.emp_name || currentUser.username || "")}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>
                  Employee Portal
                </div>
                <div className="eh-hero-name" style={{ fontSize: 28, fontWeight: 900, color: "#ffffff", letterSpacing: -0.5, lineHeight: 1 }}>
                  Welcome, {(currentUser.emp_name || currentUser.username).split(" ")[0]} 👋
                </div>
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{
                    background: roleColor + "33", color: roleColor, border: `1px solid ${roleColor}55`,
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, letterSpacing: .5, textTransform: "uppercase",
                  }}>{roleLabel}</span>
                  {currentUser.group_name && (
                    <span style={{
                      background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)",
                      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                    }}>{currentUser.group_name}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick info chips (hidden on mobile via CSS) */}
            <div className="eh-hero-meta" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              {currentUser.emp_id && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "7px 14px" }}>
                  <span style={{ fontSize: 13 }}>🪪</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>ID</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{currentUser.emp_id}</span>
                </div>
              )}
              {currentUser.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "7px 14px" }}>
                  <span style={{ fontSize: 13 }}>✉️</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>{currentUser.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tab Navigation Bar ── */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
          overflow: "hidden",
        }}>
          <div className="eh-tabs-bar" style={{ borderBottom: `1px solid ${C.border}` }}>
            {tabs.map(t => (
              <button key={t.key} className="eh-tab-btn" onClick={() => setTab(t.key)}
                style={{
                  color: tab === t.key ? C.accent : C.textMuted,
                  borderBottomColor: tab === t.key ? C.accent : "transparent",
                  background: tab === t.key ? C.accent + "0e" : "transparent",
                }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <span className="eh-tab-label">{t.label}</span>
              </button>
            ))}
          </div>

          {/* ── Tab Content ── */}
          <div style={{ padding: "24px 20px" }}>
            {tab === "profile" && <MyProfile currentUser={currentUser} />}
            {tab === "timesheets" && <Timesheets currentUser={currentUser} viewOnly />}
            {tab === "leave" && <Leaves currentUser={currentUser} viewOnly />}
            {tab === "expenses" && <Expenses currentUser={currentUser} viewOnly />}
            {tab === "pay" && currentUser.role !== "intras" && <MyPay currentUser={currentUser} />}
            {tab === "performance" && <EmployeePerformance currentUser={currentUser} />}
            {tab === "policies" && <DocumentGrid type="policy" allowEdit={false} />}
          </div>
        </div>

      </div>
    </>
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

// ── My Pay helpers ──
const MP_EARN = [
  ["basic", "Basic salary"], ["hra", "House rent allowance"], ["leave_travel_allowance", "Leave travel allowance"],
  ["special_allowance", "Special allowance"], ["transport", "Conveyance"], ["medical_allowance", "Medical"],
  ["internet_allowance", "Internet & broadband"], ["professional_dev_allowance", "Professional development"],
  ["insurance_allowance", "Insurance"], ["variable_pay", "Variable pay"], ["bonus", "Bonus"],
];
const MP_DED = [["pf_employee", "Provident fund"], ["income_tax", "Income tax (TDS)"], ["professional_tax", "Professional tax"], ["extra_deductions", "Other deductions"]];
const MP_COLORS = ["#3B82F6", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16", "#EAB308"];
const mpDed = p => MP_DED.reduce((s, [k]) => s + (+p[k] || 0), 0);
const mpINR = n => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const mpFY = p => (p.month >= 4 ? p.year : p.year - 1);
const mpKey = p => p.year * 100 + p.month;

function MyPay({ currentUser }) {
  const [payslips, setPayslips] = useState([]);
  const [selId, setSelId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState(null);
  const [show, setShow] = useState(() => { try { return localStorage.getItem("pp_pay_show") === "1"; } catch { return false; } });
  const [autoHide, setAutoHide] = useState(() => { try { return localStorage.getItem("pp_pay_autohide") !== "0"; } catch { return true; } });
  const origin = window.location.origin;

  useEffect(() => {
    api.getPayslips().then(ps => {
      const sorted = [...(ps || [])].sort((a, b) => mpKey(b) - mpKey(a));
      setPayslips(sorted);
      if (sorted.length) setSelId(sorted[0].id);
    }).catch(e => dialog.alert(e.message, { title: "Couldn't load payslips", dtype: "error" })).finally(() => setLoading(false));
  }, []);
  useEffect(() => { try { localStorage.setItem("pp_pay_show", show ? "1" : "0"); localStorage.setItem("pp_pay_autohide", autoHide ? "1" : "0"); } catch { } }, [show, autoHide]);
  // Privacy: hide amounts when the tab goes to the background
  useEffect(() => {
    if (!autoHide) return;
    const onVis = () => { if (document.hidden) setShow(false); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [autoHide]);

  async function requestDownload(ps) {
    setRequestingId(ps.id);
    try {
      const updated = await api.requestPayslipDownload(ps.id);
      setPayslips(prev => prev.map(p => p.id === ps.id ? { ...p, ...updated } : p));
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setRequestingId(null); }
  }
  async function requestAll(list) {
    if (!await dialog.confirm(`Request download access for ${list.length} payslip${list.length !== 1 ? "s" : ""}? Your admin will be notified.`, { title: "Request downloads", dtype: "info" })) return;
    for (const p of list) await requestDownload(p);
  }

  if (loading) return <Spinner />;

  const sel = payslips.find(p => p.id === selId) || payslips[0];
  const idx = sel ? payslips.indexOf(sel) : -1;
  const prev = idx >= 0 ? payslips[idx + 1] : null;
  const m = v => (show ? mpINR(v) : "₹ ••••••");
  const period = p => `${SLIP_MONTHS[p.month - 1]} ${p.year}`;
  const short = p => `${SLIP_MONTHS[p.month - 1].slice(0, 3)} ${String(p.year).slice(2)}`;

  const status = p => p.is_approved ? { k: "ready", label: "Ready to download", color: C.green }
    : p.download_requested ? { k: "waiting", label: "Awaiting approval", color: C.amber }
      : { k: "locked", label: "Download locked", color: C.textMuted };
  const toRequest = payslips.filter(p => !p.is_approved && !p.download_requested);

  const DownloadBtn = ({ p, small }) => {
    const s = status(p);
    if (s.k === "ready") return <button className={`mp-btn mp-btn-primary${small ? " sm" : ""}`} onClick={() => printPayslipData(p, origin)}>⬇ {small ? "PDF" : "Download PDF"}</button>;
    if (s.k === "waiting") return <button className={`mp-btn mp-btn-ghost${small ? " sm" : ""}`} disabled>⏳ {small ? "Pending" : "Awaiting approval"}</button>;
    return <button className={`mp-btn mp-btn-ghost${small ? " sm" : ""}`} onClick={() => requestDownload(p)} disabled={requestingId === p.id}>{requestingId === p.id ? "Requesting…" : small ? "📩 Request" : "📩 Request download"}</button>;
  };

  // ── derived for selected ──
  let earn = [], ded = [], totalDed = 0, delta = null, ytd = null, trend = [];
  if (sel) {
    earn = MP_EARN.map(([k, l], i) => ({ k, l, v: +sel[k] || 0, c: MP_COLORS[i % MP_COLORS.length] })).filter(x => x.v > 0);
    ded = MP_DED.map(([k, l]) => ({ k, l, v: +sel[k] || 0 })).filter(x => x.v > 0);
    totalDed = mpDed(sel);
    if (prev) delta = { net: (+sel.net_pay || 0) - (+prev.net_pay || 0), gross: (+sel.gross || 0) - (+prev.gross || 0) };
    const fy = mpFY(sel);
    const fyList = payslips.filter(p => mpFY(p) === fy && mpKey(p) <= mpKey(sel));
    ytd = {
      fy, n: fyList.length,
      gross: fyList.reduce((s, p) => s + (+p.gross || 0), 0),
      net: fyList.reduce((s, p) => s + (+p.net_pay || 0), 0),
      tds: fyList.reduce((s, p) => s + (+p.income_tax || 0), 0),
      pf: fyList.reduce((s, p) => s + (+p.pf_employee || 0), 0),
    };
    trend = payslips.slice(0, 12).reverse();
  }
  const maxNet = Math.max(1, ...trend.map(p => +p.gross || 0));
  const gross = sel ? +sel.gross || 0 : 0;
  const netPct = gross ? Math.round(((+sel.net_pay || 0) / gross) * 100) : 0;

  return (
    <>
      <style>{`
        .mp { container-type: inline-size; container-name: mp; }
        .mp-wrap { display: flex; flex-direction: column; gap: 18px; }
        .mp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid transparent; font-family: inherit; transition: transform .15s, opacity .15s, border-color .15s; white-space: nowrap; }
        .mp-btn.sm { padding: 7px 11px; font-size: 12px; border-radius: 10px; }
        .mp-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .mp-btn:disabled { opacity: .55; cursor: not-allowed; }
        .mp-btn-primary { background: ${C.accent}; color: #fff; box-shadow: 0 8px 22px ${C.accent}40; }
        .mp-btn-ghost { background: ${C.surface}; color: ${C.text}; border-color: ${C.border}; }
        .mp-btn-ghost:hover:not(:disabled) { border-color: ${C.accent}77; }
        .mp-wrap button:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }

        .mp-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
        .mp-title { margin: 0; font-size: clamp(22px, 2.4vw, 26px); font-weight: 800; color: ${C.text}; letter-spacing: -0.5px; }
        .mp-sub { margin: 4px 0 0; color: ${C.textMuted}; font-size: 13px; }
        .mp-head-acts { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .mp-eye { display: inline-flex; align-items: center; gap: 8px; }
        .mp-eye.on { color: ${C.accent}; border-color: ${C.accent}66; }

        /* Month strip */
        .mp-months { display: flex; align-items: center; gap: 8px; }
        .mp-arrow { width: 38px; height: 38px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.card}; color: ${C.textDim}; font-size: 18px; cursor: pointer; flex-shrink: 0; font-family: inherit; }
        .mp-arrow:disabled { opacity: .35; cursor: not-allowed; }
        .mp-arrow:hover:not(:disabled) { color: ${C.text}; border-color: ${C.accent}77; }
        .mp-chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; flex: 1; padding: 2px; scroll-snap-type: x proximity; }
        .mp-chips::-webkit-scrollbar { display: none; }
        .mp-chip { flex-shrink: 0; scroll-snap-align: start; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 14px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.card}; color: ${C.textDim}; cursor: pointer; font-family: inherit; min-width: 92px; text-align: left; }
        .mp-chip b { font-size: 13px; color: ${C.text}; }
        .mp-chip span { font-size: 11px; display: inline-flex; align-items: center; gap: 5px; }
        .mp-chip i { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .mp-chip.on { border-color: ${C.accent}; background: color-mix(in srgb, ${C.accent} 14%, ${C.card}); box-shadow: 0 0 0 1px ${C.accent} inset; }

        /* Hero */
        .mp-hero-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; }
        .mp-card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 20px; padding: 20px; min-width: 0; }
        .mp-hero { position: relative; overflow: hidden; background:
            radial-gradient(500px 220px at 0% 0%, ${C.green}22, transparent 70%),
            radial-gradient(500px 220px at 100% 100%, ${C.accent}1f, transparent 70%), ${C.card}; }
        .mp-eyebrow { font-size: 11px; font-weight: 800; color: ${C.textMuted}; letter-spacing: .8px; text-transform: uppercase; }
        .mp-net { font-size: clamp(30px, 4vw, 42px); font-weight: 800; color: ${C.green}; letter-spacing: -1.2px; line-height: 1.1; margin-top: 6px; font-variant-numeric: tabular-nums; }
        .mp-net.hidden { color: ${C.textDim}; letter-spacing: 2px; }
        .mp-delta { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 999px; }
        .mp-hero-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
        .mp-mini-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 18px; }
        .mp-mini { background: ${C.surface}cc; border: 1px solid ${C.border}66; border-radius: 14px; padding: 12px; min-width: 0; }
        .mp-mini b { display: block; font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mp-mini span { font-size: 11.5px; color: ${C.textMuted}; font-weight: 600; }
        .mp-split { height: 10px; border-radius: 6px; overflow: hidden; display: flex; background: ${C.border}; margin-top: 16px; }
        .mp-split-legend { display: flex; justify-content: space-between; font-size: 11.5px; color: ${C.textMuted}; margin-top: 6px; font-weight: 600; }

        .mp-steps { display: flex; flex-direction: column; gap: 0; margin-top: 14px; }
        .mp-step { display: flex; gap: 12px; align-items: flex-start; position: relative; padding-bottom: 14px; }
        .mp-step:last-child { padding-bottom: 0; }
        .mp-step:not(:last-child)::before { content: ""; position: absolute; left: 11px; top: 24px; bottom: 0; width: 2px; background: var(--line); }
        .mp-step-dot { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; flex-shrink: 0; border: 2px solid; }
        .mp-step b { display: block; font-size: 13px; color: ${C.text}; }
        .mp-step span { font-size: 12px; color: ${C.textMuted}; }

        /* Breakdown */
        .mp-break { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 16px; }
        .mp-card-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 14px; }
        .mp-card-t { font-size: 15px; font-weight: 800; color: ${C.text}; }
        .mp-line { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 9px 0; border-bottom: 1px solid ${C.border}44; font-size: 13px; }
        .mp-line:last-of-type { border-bottom: none; }
        .mp-line i { width: 10px; height: 10px; border-radius: 3px; }
        .mp-line-l { color: ${C.textDim}; min-width: 0; }
        .mp-line-l small { display: block; height: 4px; border-radius: 3px; background: ${C.border}; margin-top: 6px; overflow: hidden; }
        .mp-line-l small em { display: block; height: 100%; border-radius: 3px; }
        .mp-line-v { font-weight: 700; color: ${C.text}; font-variant-numeric: tabular-nums; text-align: right; }
        .mp-total { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-radius: 12px; margin-top: 12px; font-weight: 800; font-size: 14px; }
        .mp-none { font-size: 13px; color: ${C.textMuted}; padding: 10px 0; }

        /* Trend + YTD */
        .mp-insights { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; }
        .mp-trend { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px; align-items: end; height: 150px; margin-top: 18px; }
        .mp-tbar { display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; cursor: pointer; background: none; border: none; padding: 0; font-family: inherit; min-width: 0; }
        .mp-tbar-track { width: 100%; max-width: 34px; flex: 1; display: flex; flex-direction: column; justify-content: flex-end; border-radius: 8px; overflow: hidden; background: ${C.border}55; }
        .mp-tbar-track div { width: 100%; }
        .mp-tbar span { font-size: 10.5px; font-weight: 700; color: ${C.textMuted}; white-space: nowrap; }
        .mp-tbar.on span { color: ${C.accent}; font-weight: 800; }
        .mp-tbar.on .mp-tbar-track { box-shadow: 0 0 0 2px ${C.accent}; }
        .mp-legend { display: flex; gap: 14px; font-size: 11.5px; color: ${C.textMuted}; margin-top: 10px; flex-wrap: wrap; }
        .mp-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .mp-legend i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
        .mp-ytd { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        /* History */
        .mp-hist-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 16px 18px; border-bottom: 1px solid ${C.border}; }
        .mp-row { display: grid; grid-template-columns: 1.1fr 1fr 1fr 1fr 1.2fr 150px; gap: 12px; align-items: center; padding: 12px 18px; border-bottom: 1px solid ${C.border}44; font-size: 13px; cursor: pointer; transition: background .15s; }
        .mp-row:last-child { border-bottom: none; }
        .mp-row:not(.head):hover { background: ${C.accentGlow}; }
        .mp-row.on { background: color-mix(in srgb, ${C.accent} 10%, transparent); }
        .mp-row.head { cursor: default; background: ${C.surface}; font-size: 11px; font-weight: 800; color: ${C.textMuted}; letter-spacing: .5px; text-transform: uppercase; padding: 10px 18px; }
        .mp-num { font-variant-numeric: tabular-nums; font-weight: 700; }
        .mp-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; padding: 4px 10px; border-radius: 999px; border: 1px solid; white-space: nowrap; }
        .mp-pill i { width: 6px; height: 6px; border-radius: 50%; }
        .mp-cl { display: none; }

        .mp-empty { text-align: center; padding: 56px 24px; }
        .mp-empty div { font-size: 48px; margin-bottom: 10px; }

        @container mp (max-width: 1000px) {
          .mp-hero-grid, .mp-break, .mp-insights { grid-template-columns: 1fr; }
          .mp-row { grid-template-columns: 1fr 1fr 1fr 1.2fr 130px; }
          .mp-row > .c-gross { display: none; }
        }
        @container mp (max-width: 640px) {
          .mp-wrap { gap: 14px; }
          .mp-header { align-items: stretch; }
          .mp-head-acts { width: 100%; display: grid; grid-template-columns: 1fr 1fr; }
          .mp-card { padding: 16px; border-radius: 18px; }
          .mp-arrow { display: none; }
          .mp-mini-stats { grid-template-columns: 1fr 1fr; }
          .mp-mini-stats > :last-child { grid-column: 1 / -1; }
          .mp-hero-row > .mp-btn { width: 100%; }
          .mp-trend { height: 120px; gap: 4px; }
          .mp-tbar span { font-size: 9.5px; }
          .mp-row.head { display: none; }
          .mp-row { grid-template-columns: 1fr 1fr; gap: 8px 12px; padding: 14px; }
          .mp-row > .c-per { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; }
          .mp-row > .c-gross { display: block; }
          .mp-row > .c-act { grid-column: 1 / -1; }
          .mp-row > .c-act .mp-btn { width: 100%; }
          .mp-row > .c-st { display: none; }
          .mp-cl { display: block; font-size: 10.5px; color: ${C.textMuted}; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
        }
      `}</style>

      <div className="mp">
        <div className="mp-wrap">
          {/* Header */}
          <div className="mp-header">
            <div>
              <h2 className="mp-title">My Pay</h2>
              <p className="mp-sub">Your monthly salary slips, breakdown and year-to-date totals</p>
            </div>
            {payslips.length > 0 && (
              <div className="mp-head-acts">
                <button className={`mp-btn mp-btn-ghost mp-eye${show ? " on" : ""}`} onClick={() => setShow(v => !v)} aria-pressed={show}>
                  {show ? "🙈 Hide amounts" : "👁 Show amounts"}
                </button>
                {sel && <DownloadBtn p={sel} />}
              </div>
            )}
          </div>

          {payslips.length === 0 ? (
            <div className="mp-card mp-empty">
              <div>💰</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 6 }}>No payslips yet</div>
              <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Your payslips will appear here once your admin generates them.</p>
            </div>
          ) : (<>
            {/* Month strip */}
            <div className="mp-months">
              <button className="mp-arrow" onClick={() => payslips[idx + 1] && setSelId(payslips[idx + 1].id)} disabled={!payslips[idx + 1]} aria-label="Previous payslip">‹</button>
              <div className="mp-chips" role="tablist" aria-label="Payslip month">
                {payslips.map(p => {
                  const s = status(p);
                  return (
                    <button key={p.id} role="tab" aria-selected={p.id === sel.id} className={`mp-chip${p.id === sel.id ? " on" : ""}`} onClick={() => setSelId(p.id)}>
                      <b>{SLIP_MONTHS[p.month - 1].slice(0, 3)} {p.year}</b>
                      <span><i style={{ background: s.color }} />{s.k === "ready" ? "Ready" : s.k === "waiting" ? "Pending" : "Locked"}</span>
                    </button>
                  );
                })}
              </div>
              <button className="mp-arrow" onClick={() => idx > 0 && setSelId(payslips[idx - 1].id)} disabled={idx <= 0} aria-label="Next payslip">›</button>
            </div>

            {/* Hero */}
            <div className="mp-hero-grid">
              <section className="mp-card mp-hero">
                <div className="mp-hero-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="mp-eyebrow">Take-home · {period(sel)}</div>
                    <div className={`mp-net${show ? "" : " hidden"}`}>{m(sel.net_pay)}</div>
                    {delta && show && Math.abs(delta.net) >= 1 && (
                      <span className="mp-delta" style={{ color: delta.net > 0 ? C.green : C.red, background: (delta.net > 0 ? C.green : C.red) + "18", marginTop: 8 }}>
                        {delta.net > 0 ? "▲" : "▼"} {mpINR(Math.abs(delta.net))} vs {SLIP_MONTHS[prev.month - 1].slice(0, 3)}
                      </span>
                    )}
                    {delta && show && Math.abs(delta.net) < 1 && <span className="mp-delta" style={{ color: C.textDim, background: C.surface, marginTop: 8 }}>Same as {SLIP_MONTHS[prev.month - 1].slice(0, 3)}</span>}
                  </div>
                </div>
                <div className="mp-mini-stats">
                  <div className="mp-mini"><b style={{ color: C.text }}>{m(sel.gross)}</b><span>Gross earnings</span></div>
                  <div className="mp-mini"><b style={{ color: C.red }}>{show ? `−${mpINR(totalDed)}` : m(0)}</b><span>Deductions</span></div>
                  <div className="mp-mini"><b style={{ color: C.accent }}>{netPct}%</b><span>Kept of gross</span></div>
                </div>
                <div className="mp-split" aria-hidden>
                  <div style={{ width: `${netPct}%`, background: C.green }} />
                  <div style={{ width: `${100 - netPct}%`, background: C.red }} />
                </div>
                <div className="mp-split-legend"><span>● Take-home {netPct}%</span><span>Deductions {100 - netPct}%</span></div>
              </section>

              <section className="mp-card">
                <div className="mp-eyebrow">Payslip PDF</div>
                {(() => {
                  const s = status(sel);
                  const steps = [
                    { t: "Payslip generated", d: sel.generated_at ? `On ${String(sel.generated_at).slice(0, 10)}` : "By your admin", done: true },
                    { t: "Download requested", d: sel.download_requested || sel.is_approved ? "Admin notified" : "Request access to the PDF", done: !!(sel.download_requested || sel.is_approved) },
                    { t: "Approved", d: sel.is_approved ? (sel.approved_at ? `On ${String(sel.approved_at).slice(0, 10)}` : "Ready to download") : "Waiting for admin", done: !!sel.is_approved },
                  ];
                  return (
                    <>
                      <div className="mp-steps">
                        {steps.map((st, i) => {
                          const col = st.done ? C.green : i === steps.findIndex(x => !x.done) ? C.amber : C.border;
                          return (
                            <div key={st.t} className="mp-step" style={{ "--line": steps[i + 1]?.done ? C.green : C.border }}>
                              <div className="mp-step-dot" style={{ borderColor: col, background: st.done ? C.green : "transparent", color: st.done ? "#fff" : col }}>{st.done ? "✓" : i + 1}</div>
                              <div><b>{st.t}</b><span>{st.d}</span></div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: 16 }}><DownloadBtn p={sel} /></div>
                      {s.k === "locked" && <div className="mp-sub" style={{ fontSize: 12 }}>You can view everything here; the PDF needs admin approval.</div>}
                    </>
                  );
                })()}
              </section>
            </div>

            {/* Breakdown */}
            <div className="mp-break">
              <section className="mp-card">
                <div className="mp-card-h"><div className="mp-card-t">Earnings</div><span className="mp-sub" style={{ margin: 0 }}>{earn.length} components</span></div>
                {earn.map(x => (
                  <div key={x.k} className="mp-line">
                    <i style={{ background: x.c }} />
                    <div className="mp-line-l">{x.l}<small><em style={{ width: `${gross ? Math.min(100, (x.v / gross) * 100) : 0}%`, background: x.c }} /></small></div>
                    <div className="mp-line-v">{m(x.v)}{show && gross ? <span style={{ display: "block", fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{((x.v / gross) * 100).toFixed(1)}%</span> : null}</div>
                  </div>
                ))}
                <div className="mp-total" style={{ background: C.green + "14", color: C.green }}><span>Gross earnings</span><span>{m(sel.gross)}</span></div>
              </section>
              <section className="mp-card">
                <div className="mp-card-h"><div className="mp-card-t">Deductions</div><span className="mp-sub" style={{ margin: 0 }}>{ded.length || "No"} item{ded.length !== 1 ? "s" : ""}</span></div>
                {ded.length === 0 ? <div className="mp-none">No deductions this month 🎉</div> : ded.map(x => (
                  <div key={x.k} className="mp-line">
                    <i style={{ background: C.red }} />
                    <div className="mp-line-l">{x.l}</div>
                    <div className="mp-line-v" style={{ color: C.red }}>{show ? `−${mpINR(x.v)}` : m(0)}</div>
                  </div>
                ))}
                <div className="mp-total" style={{ background: C.red + "12", color: C.red }}><span>Total deductions</span><span>{show ? `−${mpINR(totalDed)}` : m(0)}</span></div>
                <div className="mp-total" style={{ background: `linear-gradient(135deg, ${C.green}22, ${C.accent}18)`, color: C.text, border: `1px solid ${C.green}40` }}>
                  <span>Net pay</span><span style={{ color: C.green, fontSize: 17 }}>{m(sel.net_pay)}</span>
                </div>
              </section>
            </div>

            {/* Insights */}
            <div className="mp-insights">
              <section className="mp-card">
                <div className="mp-card-h"><div className="mp-card-t">Pay trend</div><span className="mp-sub" style={{ margin: 0 }}>Last {trend.length} month{trend.length !== 1 ? "s" : ""}{show ? "" : " · amounts hidden"}</span></div>
                <div className="mp-trend" role="img" aria-label="Monthly net pay and deductions">
                  {trend.map(p => {
                    const g = +p.gross || 0, n = +p.net_pay || 0;
                    return (
                      <button key={p.id} className={`mp-tbar${p.id === sel.id ? " on" : ""}`} onClick={() => setSelId(p.id)} title={show ? `${period(p)}: net ${mpINR(n)} · gross ${mpINR(g)}` : period(p)}>
                        <div className="mp-tbar-track" style={{ height: `${(g / maxNet) * 100}%`, flex: "none" }}>
                          <div style={{ height: `${g ? ((g - n) / g) * 100 : 0}%`, background: C.red + "aa" }} />
                          <div style={{ flex: 1, background: `linear-gradient(180deg, ${C.green}, ${C.green}99)` }} />
                        </div>
                        <span>{short(p)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mp-legend"><span><i style={{ background: C.green }} />Take-home</span><span><i style={{ background: C.red + "aa" }} />Deductions</span><span>Tap a bar to open that month</span></div>
              </section>
              <section className="mp-card">
                <div className="mp-card-h"><div className="mp-card-t">Year to date</div><span className="mp-sub" style={{ margin: 0 }}>FY {ytd.fy}–{String(ytd.fy + 1).slice(2)} · {ytd.n} slip{ytd.n !== 1 ? "s" : ""}</span></div>
                <div className="mp-ytd">
                  <div className="mp-mini"><b style={{ color: C.green }}>{m(ytd.net)}</b><span>Net received</span></div>
                  <div className="mp-mini"><b style={{ color: C.text }}>{m(ytd.gross)}</b><span>Gross earned</span></div>
                  <div className="mp-mini"><b style={{ color: C.amber }}>{m(ytd.tds)}</b><span>Tax (TDS) paid</span></div>
                  <div className="mp-mini"><b style={{ color: C.purple }}>{m(ytd.pf)}</b><span>PF contributed</span></div>
                </div>
                <div className="mp-sub" style={{ fontSize: 12, marginTop: 12 }}>April – {SLIP_MONTHS[sel.month - 1]} {sel.year}, based on payslips issued so far.</div>
              </section>
            </div>

            {/* History */}
            <section className="mp-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="mp-hist-head">
                <div><div className="mp-card-t">Payslip history</div><div className="mp-sub" style={{ margin: 0, fontSize: 12 }}>{payslips.length} payslip{payslips.length !== 1 ? "s" : ""} · tap a row to view</div></div>
                {toRequest.length > 1 && <button className="mp-btn sm mp-btn-ghost" onClick={() => requestAll(toRequest)} disabled={!!requestingId}>📩 Request all ({toRequest.length})</button>}
              </div>
              <div className="mp-row head">{["Period", "Gross", "Deductions", "Net pay", "Status", ""].map((h, i) => <div key={i} className={h === "Gross" ? "c-gross" : undefined}>{h}</div>)}</div>
              {payslips.map(p => {
                const s = status(p);
                return (
                  <div key={p.id} className={`mp-row${p.id === sel.id ? " on" : ""}`} onClick={() => { setSelId(p.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    <div className="c-per" style={{ fontWeight: 800, color: C.text }}>
                      <span>{p.id === sel.id && <span style={{ color: C.accent }}>● </span>}{period(p)}</span>
                      <span className="mp-pill mp-cl" style={{ color: s.color, background: s.color + "18", borderColor: s.color + "40", margin: 0, textTransform: "none", letterSpacing: 0 }}>{s.label}</span>
                    </div>
                    <div className="c-gross"><span className="mp-cl">Gross</span><span className="mp-num" style={{ color: C.text }}>{m(p.gross)}</span></div>
                    <div><span className="mp-cl">Deductions</span><span className="mp-num" style={{ color: C.red }}>{show ? (mpDed(p) ? `−${mpINR(mpDed(p))}` : "—") : m(0)}</span></div>
                    <div><span className="mp-cl">Net pay</span><span className="mp-num" style={{ color: C.green, fontWeight: 800 }}>{m(p.net_pay)}</span></div>
                    <div className="c-st"><span className="mp-pill" style={{ color: s.color, background: s.color + "18", borderColor: s.color + "40" }}><i style={{ background: s.color }} />{s.label}</span></div>
                    <div className="c-act" onClick={e => e.stopPropagation()}><DownloadBtn p={p} small /></div>
                  </div>
                );
              })}
            </section>

            <label className="mp-sub" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", width: "fit-content" }}>
              <input type="checkbox" checked={autoHide} onChange={e => setAutoHide(e.target.checked)} /> Hide amounts automatically when I switch tabs or apps
            </label>
          </>)}
        </div>
      </div>
    </>
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
  // Pagination
  const [expPage, setExpPage] = useState(1);
  const [expPerPage, setExpPerPage] = useState(10);

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
    <>
      <style>{`
        .exp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }
        .exp-card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; overflow: hidden; transition: transform .15s, box-shadow .15s; }
        .exp-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        .exp-filter-pill { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 20px; padding: 5px 14px; font-size: 12px; font-weight: 600; color: ${C.textMuted}; cursor: pointer; transition: all .15s; white-space: nowrap; }
        .exp-filter-pill.active { background: ${C.accent}22; border-color: ${C.accent}66; color: ${C.accent}; }
        @media (max-width: 640px) { .exp-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>
              {viewOnly ? "My Expenses" : "Expense Reports"}
            </h2>
            <p style={{ margin: "5px 0 0", color: C.textMuted, fontSize: 13 }}>
              {viewOnly ? "Submit and track your expense claims" : "Review and approve employee expenses"}
            </p>
          </div>
          {viewOnly && <Btn onClick={() => setModal("new")}>+ Submit Expense</Btn>}
        </div>

        {/* ── Summary KPIs ── */}
        {rows.length > 0 && (() => {
          const totalAmt = rows.reduce((s, r) => s + (+r.amount || 0), 0);
          const pendingAmt = rows.filter(r => r.status === "pending").reduce((s, r) => s + (+r.amount || 0), 0);
          const paidAmt = rows.filter(r => r.status === "paid").reduce((s, r) => s + (+r.amount || 0), 0);
          return (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "Total Claimed", value: fmt$(totalAmt), color: C.accent, icon: "🧾" },
                { label: "Pending", value: fmt$(pendingAmt), color: C.amber, icon: "⏳" },
                { label: "Paid Out", value: fmt$(paidAmt), color: C.green, icon: "✅" },
                { label: "Submissions", value: rows.length, color: C.purple, icon: "📋" },
              ].map(s => (
                <div key={s.label} style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                  padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flex: "1 1 160px",
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: s.color + "22", border: `1px solid ${s.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Status Filter Pills ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: .5, textTransform: "uppercase" }}>Filter:</span>
          {["", "pending", "approved", "rejected", "needs_correction", "paid"].map(s => (
            <button key={s} className={`exp-filter-pill${filterStatus === s ? " active" : ""}`}
              onClick={() => { setFilterStatus(s); setExpPage(1); }}
              style={{
                background: filterStatus === s ? (EXP_STATUS_COLOR[s] || C.accent) + "22" : C.surface,
                border: `1px solid ${filterStatus === s ? (EXP_STATUS_COLOR[s] || C.accent) + "66" : C.border}`,
                borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600,
                color: filterStatus === s ? (EXP_STATUS_COLOR[s] || C.accent) : C.textMuted,
                cursor: "pointer", transition: "all .15s", whiteSpace: "nowrap",
              }}
            >
              {s === "" ? "All" : s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>

        {/* ── Expense Cards ── */}
        {rows.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 48, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
            No expense records found.{viewOnly && " Click \u201c+ Submit Expense\u201d to add your first claim."}
          </div>
        ) : (
          <>
          <div className="exp-grid">
            {rows.slice((expPage - 1) * expPerPage, expPage * expPerPage).map(ex => {
              const statusColor = EXP_STATUS_COLOR[ex.status] || C.textMuted;
              const canEdit = viewOnly && (ex.status === "pending" || ex.status === "needs_correction");
              const catIcon = ex.category === "Travel" ? "✈️" : ex.category === "Meals" ? "🍽" : ex.category === "Software" ? "💻" : ex.category === "Hardware" ? "🖥" : ex.category === "Training" ? "📚" : "🧾";
              return (
                <div key={ex.id} className="exp-card">
                  {/* Card Header */}
                  <div style={{
                    padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: statusColor + "0A",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: statusColor + "22", border: `1px solid ${statusColor}44`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                      }}>{catIcon}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{ex.title}</div>
                        {!viewOnly && ex.employee_name && (
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{ex.employee_name}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>₹{(+ex.amount || 0).toFixed(2)}</div>
                      <div style={{ marginTop: 4 }}><Badge color={statusColor}>{ex.status.replace("_", " ")}</Badge></div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Badge color={C.accent}>{ex.category}</Badge>
                      {ex.project_code && <Badge color={C.purple}>{ex.project_code}</Badge>}
                    </div>
                    {ex.description && (
                      <div style={{ fontSize: 12, color: C.textDim }}>{ex.description}</div>
                    )}
                    {ex.admin_note && (
                      <div style={{ background: C.purple + "18", border: `1px solid ${C.purple}33`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.purple }}>
                        📝 {ex.admin_note}
                      </div>
                    )}
                  </div>

                  {/* Card Footer — actions */}
                  <div style={{
                    padding: "10px 18px", borderTop: `1px solid ${C.border}`,
                    display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
                  }}>
                    {canEdit && <Btn small variant="ghost" onClick={() => setModal(ex)}>✏ Edit</Btn>}
                    {canEdit && <Btn small variant="danger" onClick={() => handleDelete(ex.id)}>🗑</Btn>}
                    {ex.receipt_url && (
                      <a href={`${process.env.REACT_APP_API_URL || "http://localhost:5002/api"}/receipts/${ex.receipt_url}`}
                        target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: C.accent + "18", color: C.accent, textDecoration: "none", border: `1px solid ${C.accent}44`, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        📎 Receipt
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
              );
            })}
          </div>
          <PaginationControls page={expPage} setPage={setExpPage} perPage={expPerPage} setPerPage={setExpPerPage} total={rows.length} />
          </>
        )}

        {/* ── Submit / Edit Modal ── */}
        {modal && (
          <Modal title={modal === "new" ? "Submit Expense" : "Edit Expense"} onClose={() => setModal(null)}>
            <ExpenseForm
              init={modal === "new"
                ? { title: "", amount: "", category: "Other", projectId: "", description: "", receiptUrl: "" }
                : { title: modal.title, amount: modal.amount, category: modal.category, projectId: modal.project_id || "", description: modal.description || "", receiptUrl: modal.receipt_url || "" }}
              projects={projects}
              saving={saving}
              onCancel={() => setModal(null)}
              onSave={handleSave}
              btnLabel={modal === "new" ? "Submit" : "Save & Resubmit"}
            />
          </Modal>
        )}

        {/* ── Admin Action Modal ── */}
        {noteModal && (
          <Modal
            title={noteModal.action === "pay" ? "Mark Expense Paid" : noteModal.action === "approve" ? "Approve Expense" : noteModal.action === "reject" ? "Reject Expense" : "Send Back for Correction"}
            onClose={() => { setNoteModal(null); setNote(""); }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {noteModal.action !== "approve" && noteModal.action !== "pay" && (
                <Inp label={noteModal.action === "reject" ? "Rejection reason" : "Correction notes"}
                  value={note} onChange={setNote}
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
    </>
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


// EMPLOYEE PERFORMANCE (Employee-facing) — Live API
// ════════════════════════════════════════════════════════
function EmployeePerformance({ currentUser }) {
  const TABS = [
    { id: "goals",    label: "My Goals",            icon: "🎯" },
    { id: "self",     label: "Self-Assessment",     icon: "🪞" },
    { id: "feedback", label: "Manager Feedback",    icon: "💬" },
    { id: "reviews",  label: "Performance Reviews", icon: "📋" },
  ];
  const [tab, setTab] = useState("goals");

  // ── Goals ──────────────────────────────────────────────
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalModal, setGoalModal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [goalSaving, setGoalSaving] = useState(false);
  const emptyGoal = { title: "", type: "OKR", target: "", current: "", due: "", status: "on-track", priority: "medium", description: "" };
  const [goalForm, setGoalForm] = useState(emptyGoal);

  // ── Self-Assessment ────────────────────────────────────
  const PERIODS = ["Q1 2026","Q2 2026","Q3 2026","Q4 2026","Annual 2025","Annual 2026"];
  const [selfPeriod, setSelfPeriod] = useState("Q1 2026");
  const [selfRatings, setSelfRatings] = useState({ technical: 3, communication: 3, teamwork: 3, leadership: 3, innovation: 3 });
  const [selfText, setSelfText] = useState({ accomplishments: "", challenges: "", learnings: "", nextGoals: "", supportNeeded: "" });
  const [selfSubmitted, setSelfSubmitted] = useState(false);
  const [selfSubmitting, setSelfSubmitting] = useState(false);
  const [selfLoading, setSelfLoading] = useState(false);

  // ── Manager Feedback ───────────────────────────────────
  const [feedbacks, setFeedbacks] = useState([]);
  const [fbLoading, setFbLoading] = useState(true);
  const [expandedFb, setExpandedFb] = useState(null);

  // ── Reviews ────────────────────────────────────────────
  const [reviews, setReviews] = useState([]);
  const [revLoading, setRevLoading] = useState(true);
  const [expandedRev, setExpandedRev] = useState(null);

  // ── Load data by tab ───────────────────────────────────
  useEffect(() => {
    if (tab === "goals") loadGoals();
    if (tab === "feedback") loadFeedbacks();
    if (tab === "reviews") loadReviews();
    // eslint-disable-next-line
  }, [tab]);

  useEffect(() => {
    if (tab === "self") loadSelf();
    // eslint-disable-next-line
  }, [tab, selfPeriod]);

  async function loadGoals() {
    setGoalsLoading(true);
    try { setGoals(await api.getPerformanceGoals()); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setGoalsLoading(false); }
  }

  async function loadFeedbacks() {
    setFbLoading(true);
    try { setFeedbacks(await api.getManagerFeedbacks()); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setFbLoading(false); }
  }

  async function loadReviews() {
    setRevLoading(true);
    try { setReviews(await api.getPerformanceReviews()); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setRevLoading(false); }
  }

  async function loadSelf() {
    setSelfLoading(true);
    try {
      const rows = await api.getSelfAssessments({ period: selfPeriod });
      if (rows.length > 0) {
        const r = rows[0];
        setSelfRatings({ technical: r.technical_skill, communication: r.communication, teamwork: r.teamwork, leadership: r.leadership, innovation: r.innovation });
        setSelfText({ accomplishments: r.accomplishments || "", challenges: r.challenges || "", learnings: r.learnings || "", nextGoals: r.next_goals || "", supportNeeded: r.support_needed || "" });
        setSelfSubmitted(!!r.submitted_at);
      } else {
        setSelfRatings({ technical: 3, communication: 3, teamwork: 3, leadership: 3, innovation: 3 });
        setSelfText({ accomplishments: "", challenges: "", learnings: "", nextGoals: "", supportNeeded: "" });
        setSelfSubmitted(false);
      }
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setSelfLoading(false); }
  }

  // ── Helpers ────────────────────────────────────────────
  const sc = s => s === "achieved" ? C.green : s === "on-track" ? C.accent : s === "at-risk" ? C.amber : C.red;
  const sl = s => ({ "achieved": "Achieved", "on-track": "On Track", "at-risk": "At Risk", "behind": "Behind" }[s] || s);
  const pc = p => p === "high" ? C.red : p === "medium" ? C.amber : C.textDim;
  const Stars = ({ n, size = 16 }) => Array.from({ length: 5 }, (_, i) => (
    <span key={i} style={{ fontSize: size, color: i < Math.floor(n) ? "#F59E0B" : i === Math.floor(n) && (n % 1 >= 0.5) ? "#F59E0B" : C.border, opacity: i === Math.floor(n) && (n % 1 >= 0.5) ? 0.55 : 1 }}>★</span>
  ));
  const avgSelf = Math.round((Object.values(selfRatings).reduce((a, v) => a + v, 0) / 5) * 10) / 10;

  const openAddGoal = () => { setEditGoal(null); setGoalForm(emptyGoal); setGoalModal(true); };
  const openEditGoal = g => { setEditGoal(g); setGoalForm({ title: g.title, type: g.type, target: g.target || "", current: g.current_value || "", due: g.due_date?.slice(0,10) || "", status: g.status, priority: g.priority, description: g.description || "" }); setGoalModal(true); };

  async function saveGoal() {
    if (!goalForm.title.trim()) return;
    setGoalSaving(true);
    try {
      const payload = { title: goalForm.title, type: goalForm.type, target: goalForm.target, current: goalForm.current, due: goalForm.due || null, status: goalForm.status, priority: goalForm.priority, description: goalForm.description };
      if (editGoal) await api.updatePerformanceGoal(editGoal.id, payload);
      else await api.createPerformanceGoal(payload);
      setGoalModal(false);
      await loadGoals();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setGoalSaving(false); }
  }

  async function deleteGoal(id) {
    if (!await dialog.confirm("Delete this goal?", { dtype: "warning" })) return;
    try { await api.deletePerformanceGoal(id); await loadGoals(); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  async function submitSelf() {
    setSelfSubmitting(true);
    try {
      await api.upsertSelfAssessment({
        period: selfPeriod,
        technicalSkill: selfRatings.technical,
        communication: selfRatings.communication,
        teamwork: selfRatings.teamwork,
        leadership: selfRatings.leadership,
        innovation: selfRatings.innovation,
        accomplishments: selfText.accomplishments,
        challenges: selfText.challenges,
        learnings: selfText.learnings,
        nextGoals: selfText.nextGoals,
        supportNeeded: selfText.supportNeeded,
      });
      setSelfSubmitted(true);
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setSelfSubmitting(false); }
  }

  const RatingBar = ({ label, value, onChange }) => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: C.textDim, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: C.accent }}>{value}<span style={{ color: C.textMuted, fontWeight: 500 }}>/5</span></span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => onChange(n)}
            style={{ flex: 1, height: 8, borderRadius: 6, border: "none", cursor: "pointer", transition: "all 0.2s",
              background: n <= value ? `linear-gradient(90deg,${C.accent},${C.purple})` : C.border,
              transform: n <= value ? "scaleY(1.3)" : "scaleY(1)" }} />
        ))}
      </div>
    </div>
  );

  const achieved = goals.filter(g => g.status === "achieved").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <style>{`
        .ep-tab { padding: 10px 20px; border: none; border-bottom: 3px solid transparent; background: transparent; cursor: pointer; font-size: 13px; font-weight: 600; transition: all .18s; display: flex; align-items: center; gap: 7px; white-space: nowrap; border-radius: 8px 8px 0 0; }
        .ep-tab:hover { background: rgba(59,130,246,0.07); }
        .ep-textarea { width: 100%; background: ${C.surface}; border: 1.5px solid ${C.border}; border-radius: 10px; color: ${C.text}; padding: 12px 14px; font-size: 13px; font-family: inherit; resize: vertical; outline: none; line-height: 1.6; box-sizing: border-box; transition: border-color .2s; }
        .ep-textarea:focus { border-color: ${C.accent}; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: C.text, letterSpacing: -0.5 }}>My Performance</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>Set goals, complete your self-assessment and track your growth</p>
        </div>
        {goals.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: "12px 20px", display: "flex", gap: 18 }}>
            {[
              { label: "Goals", value: goals.length, color: C.accent },
              { label: "Achieved", value: achieved, color: C.green },
              { label: "At Risk", value: goals.filter(g => g.status === "at-risk").length, color: C.amber },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} className="ep-tab"
            onClick={() => setTab(t.id)}
            style={{ color: tab === t.id ? C.accent : C.textMuted, borderBottomColor: tab === t.id ? C.accent : "transparent", background: tab === t.id ? C.accent + "12" : "transparent" }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ══ GOALS TAB ══════════════════════════════════════════════════════ */}
      {tab === "goals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>My Goals ({goals.length})</span>
            <Btn onClick={openAddGoal}>+ Add Goal</Btn>
          </div>
          {goalsLoading ? <Spinner /> : goals.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 48, textAlign: "center", color: C.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>No goals set yet</div>
              <p style={{ margin: 0, fontSize: 13 }}>Click "+ Add Goal" to set your first OKR or KPI.</p>
            </div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 100px 100px 110px 90px 90px 80px", background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 20px", gap: 0 }}>
                {["Goal / Objective","Type","Target","Current","Due Date","Priority","Status",""].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: .5 }}>{h}</div>
                ))}
              </div>
              {goals.map((g, i) => {
                const tNum = parseFloat(g.target), cNum = parseFloat(g.current_value);
                const pct = (!isNaN(tNum) && tNum > 0 && !isNaN(cNum)) ? Math.min(Math.round((cNum / tNum) * 100), 100) : 0;
                return (
                  <div key={g.id} style={{ display: "grid", gridTemplateColumns: "2fr 80px 100px 100px 110px 90px 90px 80px", padding: "14px 20px", borderBottom: i < goals.length - 1 ? `1px solid ${C.border}44` : "none", alignItems: "center", gap: 0, transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surface}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{g.title}</div>
                      {g.target && <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 4, maxWidth: 160, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${sc(g.status)}, ${sc(g.status)}aa)`, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>{pct}%</span>
                      </div>}
                    </div>
                    <span style={{ background: g.type === "OKR" ? C.purple + "22" : C.accent + "22", color: g.type === "OKR" ? C.purple : C.accent, border: `1px solid ${g.type === "OKR" ? C.purple : C.accent}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{g.type}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{g.target || "—"}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: sc(g.status) }}>{g.current_value || "—"}</span>
                    <span style={{ fontSize: 12, color: C.textDim }}>{g.due_date ? new Date(g.due_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>
                    <span style={{ background: pc(g.priority) + "22", color: pc(g.priority), border: `1px solid ${pc(g.priority)}44`, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{g.priority}</span>
                    <span style={{ background: sc(g.status) + "22", color: sc(g.status), border: `1px solid ${sc(g.status)}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{sl(g.status)}</span>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button title="Edit" onClick={() => openEditGoal(g)} style={{ background: C.accent + "18", color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}>✏</button>
                      <button title="Delete" onClick={() => deleteGoal(g.id)} style={{ background: C.red + "18", color: C.red, border: `1px solid ${C.red}33`, borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add / Edit Goal Modal */}
          {goalModal && (
            <Modal title={editGoal ? "Edit Goal" : "Add New Goal"} onClose={() => setGoalModal(false)}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Inp label="Goal / Objective Title" value={goalForm.title} onChange={v => setGoalForm(p => ({ ...p, title: v }))} required />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Type</div>
                    <select value={goalForm.type} onChange={e => setGoalForm(p => ({ ...p, type: e.target.value }))}
                      style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "9px 12px", fontSize: 13, outline: "none" }}>
                      <option value="OKR">OKR — Objective Key Result</option>
                      <option value="KPI">KPI — Key Performance Indicator</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Priority</div>
                    <select value={goalForm.priority} onChange={e => setGoalForm(p => ({ ...p, priority: e.target.value }))}
                      style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "9px 12px", fontSize: 13, outline: "none" }}>
                      <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Inp label="Target" value={goalForm.target} onChange={v => setGoalForm(p => ({ ...p, target: v }))} placeholder="e.g. 90%" />
                  <Inp label="Current Progress" value={goalForm.current} onChange={v => setGoalForm(p => ({ ...p, current: v }))} placeholder="e.g. 78%" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Inp label="Due Date" type="date" value={goalForm.due} onChange={v => setGoalForm(p => ({ ...p, due: v }))} />
                  <div>
                    <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Status</div>
                    <select value={goalForm.status} onChange={e => setGoalForm(p => ({ ...p, status: e.target.value }))}
                      style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "9px 12px", fontSize: 13, outline: "none" }}>
                      <option value="on-track">On Track</option><option value="at-risk">At Risk</option>
                      <option value="achieved">Achieved</option><option value="behind">Behind</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                  <Btn variant="ghost" onClick={() => setGoalModal(false)}>Cancel</Btn>
                  <Btn onClick={saveGoal} disabled={goalSaving}>{goalSaving ? "Saving…" : editGoal ? "Save Changes" : "Add Goal"}</Btn>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* ══ SELF-ASSESSMENT TAB ════════════════════════════════════════════ */}
      {tab === "self" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Period selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Period:</span>
            <select value={selfPeriod} onChange={e => { setSelfPeriod(e.target.value); setSelfSubmitted(false); }}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "7px 12px", fontSize: 13, outline: "none" }}>
              {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {selfSubmitted && <span style={{ background: C.green + "18", color: C.green, border: `1px solid ${C.green}33`, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>✓ Submitted</span>}
          </div>

          {selfLoading ? <Spinner /> : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Competency Ratings */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>Competency Self-Rating</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>Period: {selfPeriod}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {[
                    { key: "technical", label: "Technical Skills" },
                    { key: "communication", label: "Communication" },
                    { key: "teamwork", label: "Teamwork & Collaboration" },
                    { key: "leadership", label: "Leadership & Initiative" },
                    { key: "innovation", label: "Innovation & Problem Solving" },
                  ].map(({ key, label }) => (
                    <RatingBar key={key} label={label} value={selfRatings[key]}
                      onChange={v => setSelfRatings(p => ({ ...p, [key]: v }))} />
                  ))}
                </div>
                <div style={{ marginTop: 22, padding: "14px 16px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Overall Self Score</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: C.accent, marginTop: 4 }}>
                    {avgSelf}<span style={{ fontSize: 14, color: C.textMuted, fontWeight: 600 }}>/5</span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Stars n={avgSelf} size={18} />
                  </div>
                </div>
              </div>

              {/* Written Assessment */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 18 }}>Written Assessment</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {[
                      { key: "accomplishments", label: "Key Accomplishments", placeholder: "What did you achieve this period?" },
                      { key: "challenges", label: "Challenges Faced", placeholder: "What obstacles did you encounter?" },
                      { key: "learnings", label: "Key Learnings & Growth", placeholder: "What new skills did you gain?" },
                      { key: "nextGoals", label: "Goals for Next Period", placeholder: "What do you aim to achieve next?" },
                      { key: "supportNeeded", label: "Support Needed", placeholder: "What would help you perform better?" },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>{label}</div>
                        <textarea rows={2} value={selfText[key]} onChange={e => setSelfText(p => ({ ...p, [key]: e.target.value }))}
                          placeholder={placeholder} className="ep-textarea" />
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <Btn variant="ghost" onClick={() => loadSelf()}>Reset</Btn>
                  <Btn variant="success" onClick={submitSelf} disabled={selfSubmitting}>
                    {selfSubmitting ? "Saving…" : selfSubmitted ? "✓ Update Assessment" : "Submit Assessment"}
                  </Btn>
                </div>
                {selfSubmitted && (
                  <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 10, padding: "12px 16px", fontSize: 13, color: C.green, fontWeight: 600 }}>
                    ✓ Your self-assessment has been saved for {selfPeriod}.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ MANAGER FEEDBACK TAB ═══════════════════════════════════════════ */}
      {tab === "feedback" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Feedback received from managers</div>
            <span style={{ background: C.accent + "18", color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>{feedbacks.length} entries</span>
          </div>
          {fbLoading ? <Spinner /> : feedbacks.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 48, textAlign: "center", color: C.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>No feedback yet</div>
              <p style={{ margin: 0, fontSize: 13 }}>Your manager hasn't submitted feedback yet.</p>
            </div>
          ) : feedbacks.map(fb => (
            <div key={fb.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", background: expandedFb === fb.id ? C.surface : "transparent" }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: C.purple + "22", border: `1px solid ${C.purple}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: C.purple, flexShrink: 0 }}>
                  {(fb.manager_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpandedFb(expandedFb === fb.id ? null : fb.id)}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fb.manager_name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{fb.cycle_name || fb.period || "—"} · {fb.feedback_date ? fmtD(fb.feedback_date) : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ display: "flex", gap: 1 }}><Stars n={fb.overall_rating} size={16} /></div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, textAlign: "right" }}>{fb.overall_rating}/5</div>
                  </div>
                  <span style={{ color: C.textMuted, fontSize: 18, cursor: "pointer", transition: "transform 0.2s", transform: expandedFb === fb.id ? "rotate(180deg)" : "none" }}
                    onClick={() => setExpandedFb(expandedFb === fb.id ? null : fb.id)}>▾</span>
                </div>
              </div>
              {expandedFb === fb.id && (
                <div style={{ padding: "0 22px 22px", display: "flex", flexDirection: "column", gap: 14, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ background: C.green + "0d", border: `1px solid ${C.green}22`, borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 11, color: C.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>💪 Strengths</div>
                      <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, margin: 0 }}>{fb.strengths || "—"}</p>
                    </div>
                    <div style={{ background: C.amber + "0d", border: `1px solid ${C.amber}22`, borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 11, color: C.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>📈 Areas to Improve</div>
                      <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, margin: 0 }}>{fb.areas_to_improve || "—"}</p>
                    </div>
                  </div>
                  {fb.manager_comment && (
                    <div style={{ background: C.accent + "0d", border: `1px solid ${C.accent}22`, borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>💬 Manager's Comment</div>
                      <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>"{fb.manager_comment}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══ PERFORMANCE REVIEWS TAB ════════════════════════════════════════ */}
      {tab === "reviews" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Your Review Cycles</div>
            <span style={{ background: C.purple + "18", color: C.purple, border: `1px solid ${C.purple}33`, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</span>
          </div>
          {revLoading ? <Spinner /> : reviews.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 48, textAlign: "center", color: C.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>No reviews yet</div>
              <p style={{ margin: 0, fontSize: 13 }}>Your manager or admin will schedule your first performance review.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reviews.map(r => (
                <div key={r.id} style={{ background: C.card, border: `1px solid ${r.status === "pending" ? C.amber + "55" : C.border}`, borderLeft: `4px solid ${r.status === "completed" ? C.green : C.amber}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px" }}>
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: (r.status === "completed" ? C.green : C.amber) + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                      {r.status === "completed" ? "✅" : "⏳"}
                    </div>
                    <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpandedRev(expandedRev === r.id ? null : r.id)}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.cycle_name || r.review_cycle}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                        {r.period && `Period: ${r.period} · `}Reviewer: {r.reviewer_name || "—"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {r.final_score && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: C.green }}>{r.final_score}</div>
                          <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>SCORE</div>
                        </div>
                      )}
                      {r.badge && <span style={{ background: C.green + "18", color: C.green, border: `1px solid ${C.green}33`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{r.badge}</span>}
                      {r.status === "pending" && <span style={{ background: C.amber + "18", color: C.amber, border: `1px solid ${C.amber}33`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>Pending</span>}
                      <span style={{ color: C.textMuted, fontSize: 18, cursor: "pointer", transform: expandedRev === r.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                        onClick={() => setExpandedRev(expandedRev === r.id ? null : r.id)}>▾</span>
                    </div>
                  </div>
                  {expandedRev === r.id && r.status === "completed" && (
                    <div style={{ padding: "0 22px 22px", borderTop: `1px solid ${C.border}` }}>
                      <div style={{ paddingTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 12 }}>
                        {[
                          { label: "Final Score", value: r.final_score ? r.final_score + "/5" : "—", color: C.green },
                          { label: "Rating", value: r.badge || "—", color: C.accent },
                          { label: "Review Date", value: r.review_date ? fmtD(r.review_date) : "—", color: C.purple },
                          { label: "Reviewer", value: r.reviewer_name || "—", color: C.amber },
                        ].map(d => (
                          <div key={d.label} style={{ background: C.surface, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>{d.label}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: d.color, marginTop: 4 }}>{d.value}</div>
                          </div>
                        ))}
                      </div>
                      {r.notes && (
                        <div style={{ marginTop: 14, background: C.surface, borderRadius: 10, padding: "14px 16px", border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Notes</div>
                          <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, margin: 0 }}>{r.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {expandedRev === r.id && r.status === "pending" && (
                    <div style={{ padding: "0 22px 22px", borderTop: `1px solid ${C.border}` }}>
                      <div style={{ paddingTop: 16, background: C.amber + "0d", border: `1px solid ${C.amber}33`, borderRadius: 10, padding: 16, textAlign: "center" }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>Review In Progress</div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Your manager will complete this review. You will be notified once it's ready.</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminEmployees({ readOnly = false, currentUser }) {
  const isAdminOnly = currentUser?.role === "admin";
  const [employees, setEmployees] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null); // null | "new" | emp-object
  const [viewModal, setViewModal] = useState(null); // null | emp-object
  const [saving, setSaving] = useState(false);
  // Pagination
  const [empPage, setEmpPage] = useState(1);
  const [empPerPage, setEmpPerPage] = useState(10);

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
              {employees.slice((empPage - 1) * empPerPage, empPage * empPerPage).map((emp, idx) => {
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
        <PaginationControls page={empPage} setPage={setEmpPage} perPage={empPerPage} setPerPage={setEmpPerPage} total={employees.length} />
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
        <td style="width: 25%;" class="center">${ps.custom_employee_id || 'FASIT/' + String(ps.employee_id).padStart(3, '0')}</td>
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



// ── Payslip helpers ──
const PS_DEFAULTS = { conveyance: 1600, medical: 1250, internet: 1200 };
const psR = n => Math.round((+n || 0) * 100) / 100;
const psHas = v => v !== null && v !== undefined && String(v).trim() !== "";
const psINR = n => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const psNext = (m, y) => (+m === 12 ? { month: 1, year: +y + 1 } : { month: +m + 1, year: +y });
const psPeriod = (m, y) => `${SLIP_MONTHS[m - 1]} ${y}`;
const psEmptyForm = () => ({
  employeeId: "", month: new Date().getMonth() + 1, year: new Date().getFullYear(),
  usePf: false, pfAmount: "", useTds: false, tdsAmount: "", useVp: false, vpAmount: "",
  usePda: false, pdaAmount: "", useIns: false, insAmount: "",
  conveyanceAmount: "", medicalAmount: "", internetAmount: "",
});
// Mirrors backend routes/payslips.py::_compute — used for the live estimate only.
function psCompute(emp, f) {
  const ctc = +emp?.ctc_annual || 0;
  if (!ctc) return null;
  const basic = psR(ctc * 0.5 / 12), hra = psR(basic * 0.5), lta = psR(basic * 0.1);
  const fixed = (o, d) => (psHas(o) ? psR(o) : d);
  const transport = fixed(f.conveyanceAmount, PS_DEFAULTS.conveyance);
  const medical = fixed(f.medicalAmount, PS_DEFAULTS.medical);
  const internet = fixed(f.internetAmount, PS_DEFAULTS.internet);
  const pda = f.usePda && psHas(f.pdaAmount) ? psR(f.pdaAmount) : 0;
  const ins = f.useIns && psHas(f.insAmount) ? psR(f.insAmount) : 0;
  const gratuityA = psR(basic * 12 * 0.0481);
  const vp = f.useVp && psHas(f.vpAmount) ? psR(f.vpAmount) : 0;
  const grossM = psR((ctc - gratuityA - (+emp.variable_pay_amount || 0)) / 12);
  const special = psR(grossM - basic - hra - lta - transport - medical - internet - pda - ins);
  const gross = psR(grossM + vp);
  const pf = f.usePf ? (psHas(f.pfAmount) && +f.pfAmount ? psR(f.pfAmount) : psR(basic * 0.12)) : 0;
  const tds = f.useTds && psHas(f.tdsAmount) && +f.tdsAmount ? psR(f.tdsAmount) : 0;
  const pre = psR(gross - pf - tds);
  const pt = pre < 25000 ? 0 : 200;
  return { basic, hra, lta, transport, medical, internet, pda, ins, special, vp, gross, pf, tds, pt, net: psR(pre - pt), deductions: psR(pf + tds + pt) };
}
// Rebuild generator options from a stored payslip (auto values stay blank so they keep tracking CTC).
function psFormFrom(ps, emp) {
  const basic = psR((+emp?.ctc_annual || 0) * 0.5 / 12);
  const pf = +ps.pf_employee || 0, tds = +ps.income_tax || 0, vp = +ps.variable_pay || 0;
  const pda = +ps.professional_dev_allowance || 0, ins = +ps.insurance_allowance || 0;
  const keep = (v, d) => (Math.abs((+v || 0) - d) < 0.01 ? "" : String(+v || 0));
  return {
    usePf: pf > 0, pfAmount: pf > 0 && Math.abs(pf - psR(basic * 0.12)) >= 0.01 ? String(pf) : "",
    useTds: tds > 0, tdsAmount: tds > 0 ? String(tds) : "",
    useVp: vp > 0, vpAmount: vp > 0 ? String(vp) : "",
    usePda: pda > 0, pdaAmount: pda > 0 ? String(pda) : "",
    useIns: ins > 0, insAmount: ins > 0 ? String(ins) : "",
    conveyanceAmount: keep(ps.transport, PS_DEFAULTS.conveyance),
    medicalAmount: keep(ps.medical_allowance, PS_DEFAULTS.medical),
    internetAmount: keep(ps.internet_allowance, PS_DEFAULTS.internet),
  };
}
const psPayload = f => ({
  employeeId: +f.employeeId, month: +f.month, year: +f.year,
  usePf: f.usePf, pfAmount: f.pfAmount, useTds: f.useTds, tdsAmount: f.tdsAmount,
  useVp: f.useVp, vpAmount: f.vpAmount, usePda: f.usePda, pdaAmount: f.pdaAmount,
  useIns: f.useIns, insAmount: f.insAmount,
  conveyanceAmount: f.conveyanceAmount || null, medicalAmount: f.medicalAmount || null, internetAmount: f.internetAmount || null,
});
const psStatus = ps => ps.is_approved ? { k: "approved", label: "Approved", color: C.green }
  : ps.download_requested ? { k: "requested", label: "Download requested", color: C.amber }
    : { k: "generated", label: "Generated", color: C.textDim };

function PsToggle({ on, onToggle, title, hint, kind, value, onValue, placeholder, note }) {
  return (
    <div className={`ps-tog${on ? " on" : ""}`}>
      <label className="ps-tog-head">
        <input type="checkbox" checked={on} onChange={e => onToggle(e.target.checked)} />
        <span className="ps-switch" aria-hidden />
        <span className="ps-tog-title">{title}</span>
      </label>
      <div className="ps-hint" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span className={`ps-kind ${kind}`}>{kind === "ded" ? "Deduction" : "Earning"}</span>{hint}
      </div>
      <div className="ps-money">
        <span>₹</span>
        <input type="number" min="0" inputMode="decimal" value={value} disabled={!on} placeholder={placeholder} onChange={e => onValue(e.target.value)} aria-label={`${title} amount`} />
      </div>
      {on && note && <div className="ps-hint">{note}</div>}
    </div>
  );
}

function AdminPayslips() {
  const [employees, setEmployees] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState(psEmptyForm);
  const [prefilledFrom, setPrefilledFrom] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterEmp, setFilterEmp] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [psPage, setPsPage] = useState(1);
  const [psPerPage, setPsPerPage] = useState(10);
  const [rollFrom, setRollFrom] = useState(null);   // payslip used for "Next month"
  const [runOpen, setRunOpen] = useState(false);
  const [runPeriod, setRunPeriod] = useState(() => ({ month: new Date().getMonth() + 1, year: new Date().getFullYear() }));
  const [runSel, setRunSel] = useState({});
  const [runProgress, setRunProgress] = useState(null); // { done, total, failed: [] }
  const [busyId, setBusyId] = useState(null);
  const [flash, setFlash] = useState(null);
  const formRef = useRef(null);
  const origin = window.location.origin;

  const load = async (silent) => {
    if (!silent) setLoading(true);
    try {
      const [e, ps] = await Promise.all([api.getEmployees(), api.getPayslips()]);
      setEmployees(e || []); setPayslips(ps || []);
    } catch (e) { dialog.alert(e.message, { title: "Couldn't load payslips", dtype: "error" }); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setPsPage(1); }, [filterEmp, filterYear, filterStatus, search]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 4500); return () => clearTimeout(t); }, [flash]);

  const empById = id => employees.find(e => e.id === +id);
  const slipFor = (empId, m, y) => payslips.find(p => p.employee_id === +empId && p.month === +m && p.year === +y);
  const latestFor = empId => payslips.filter(p => p.employee_id === +empId).sort((a, b) => b.year - a.year || b.month - a.month)[0];
  const latestBefore = (empId, m, y) => payslips.filter(p => p.employee_id === +empId && (p.year < +y || (p.year === +y && p.month < +m)))
    .sort((a, b) => b.year - a.year || b.month - a.month)[0];
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selEmp = empById(form.employeeId);
  const estimate = selEmp ? psCompute(selEmp, form) : null;
  const existing = form.employeeId ? slipFor(form.employeeId, form.month, form.year) : null;
  const prevSlip = form.employeeId ? latestBefore(form.employeeId, form.month, form.year) : null;

  const confirmReplace = async (ps, m, y, name) => {
    if (!ps) return true;
    return dialog.confirm(`${name} already has a payslip for ${psPeriod(m, y)}${ps.is_approved ? " that is APPROVED" : ""}. Generating again will overwrite it with the new figures. Continue?`, { title: "Replace existing payslip?", dtype: "warning" });
  };

  function selectEmployee(id) {
    const emp = empById(id);
    const last = id ? latestFor(id) : null;
    setPrefilledFrom(null);
    if (last && emp) {
      const nx = psNext(last.month, last.year);
      setForm(f => ({ ...psEmptyForm(), ...psFormFrom(last, emp), employeeId: id, month: nx.month, year: nx.year }));
      setPrefilledFrom(last);
    } else {
      setForm(f => ({ ...psEmptyForm(), employeeId: id, month: f.month, year: f.year }));
    }
  }
  function applyTemplate(ps, period) {
    const emp = empById(ps.employee_id);
    const p = period || psNext(ps.month, ps.year);
    setForm({ ...psEmptyForm(), ...psFormFrom(ps, emp), employeeId: String(ps.employee_id), month: p.month, year: p.year });
    setPrefilledFrom(ps);
    setShowAdvanced(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function generate() {
    if (!form.employeeId || !selEmp) return;
    if (!(+selEmp.ctc_annual > 0)) { dialog.alert(`${selEmp.name} has no CTC configured. Set CTC first.`, { title: "Missing CTC", dtype: "warning" }); return; }
    if (!await confirmReplace(existing, form.month, form.year, selEmp.name)) return;
    setGenerating(true);
    try {
      await api.generatePayslip(psPayload(form));
      setFlash({ ok: true, text: `Payslip for ${selEmp.name} · ${psPeriod(form.month, form.year)} ${existing ? "updated" : "generated"}.` });
      await load(true);
    } catch (e) { setFlash({ ok: false, text: e.message }); } finally { setGenerating(false); }
  }

  async function rollForward(ps, edit) {
    const nx = psNext(ps.month, ps.year);
    if (edit) { setRollFrom(null); applyTemplate(ps, nx); return; }
    const emp = empById(ps.employee_id);
    const ex = slipFor(ps.employee_id, nx.month, nx.year);
    if (!await confirmReplace(ex, nx.month, nx.year, ps.employee_name)) return;
    setBusyId(ps.id);
    try {
      await api.generatePayslip(psPayload({ ...psEmptyForm(), ...psFormFrom(ps, emp), employeeId: ps.employee_id, month: nx.month, year: nx.year }));
      setRollFrom(null);
      setFlash({ ok: true, text: `${ps.employee_name} · ${psPeriod(nx.month, nx.year)} generated from ${psPeriod(ps.month, ps.year)}.` });
      await load(true);
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setBusyId(null); }
  }

  async function del(ps) {
    if (!await dialog.confirm(`Delete ${ps.employee_name}'s payslip for ${psPeriod(ps.month, ps.year)}?${ps.is_approved ? " It is already approved." : ""}`, { title: "Delete payslip", dtype: "warning" })) return;
    try { await api.deletePayslip(ps.id); setPayslips(list => list.filter(p => p.id !== ps.id)); } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }
  async function approve(id) {
    setBusyId(id);
    try { const updated = await api.approvePayslip(id); setPayslips(list => list.map(p => p.id === id ? { ...p, ...updated } : p)); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); } finally { setBusyId(null); }
  }

  // ── Payroll run (bulk next month) ──
  const runRows = employees.filter(e => +e.ctc_annual > 0).map(e => {
    const has = slipFor(e.id, runPeriod.month, runPeriod.year);
    const src = latestBefore(e.id, runPeriod.month, runPeriod.year);
    const est = src ? psCompute(e, psFormFrom(src, e)) : null;
    return { e, has, src, est, ready: !has && !!src };
  }).sort((a, b) => (b.ready - a.ready) || a.e.name.localeCompare(b.e.name));
  const readyRows = runRows.filter(r => r.ready);
  const selectedRun = readyRows.filter(r => runSel[r.e.id] !== false);
  const openRun = () => { setRunSel({}); setRunProgress(null); setRunOpen(true); };
  async function executeRun() {
    if (!selectedRun.length) return;
    if (!await dialog.confirm(`Generate ${selectedRun.length} payslip${selectedRun.length !== 1 ? "s" : ""} for ${psPeriod(runPeriod.month, runPeriod.year)} using each employee's previous payslip settings?`, { title: "Run payroll", dtype: "info" })) return;
    const failed = [];
    setRunProgress({ done: 0, total: selectedRun.length, failed });
    for (let i = 0; i < selectedRun.length; i++) {
      const r = selectedRun[i];
      try { await api.generatePayslip(psPayload({ ...psEmptyForm(), ...psFormFrom(r.src, r.e), employeeId: r.e.id, month: runPeriod.month, year: runPeriod.year })); }
      catch (err) { failed.push(`${r.e.name}: ${err.message}`); }
      setRunProgress({ done: i + 1, total: selectedRun.length, failed: [...failed] });
    }
    await load(true);
  }

  // ── list / KPIs ──
  const now = new Date();
  const curM = now.getMonth() + 1, curY = now.getFullYear();
  const thisMonth = payslips.filter(p => p.month === curM && p.year === curY);
  const payroll = thisMonth.reduce((s, p) => s + (+p.net_pay || 0), 0);
  const requested = payslips.filter(p => p.download_requested && !p.is_approved);
  const ctcEmps = employees.filter(e => +e.ctc_annual > 0);
  const missing = ctcEmps.filter(e => !slipFor(e.id, curM, curY));
  const years = Array.from(new Set([curY + 1, curY, curY - 1, curY - 2, curY - 3, ...payslips.map(p => p.year)])).sort((a, b) => b - a);

  const q = search.trim().toLowerCase();
  const shown = payslips.filter(p => {
    if (filterEmp && p.employee_id !== +filterEmp) return false;
    if (filterYear && p.year !== +filterYear) return false;
    if (filterStatus && psStatus(p).k !== filterStatus) return false;
    if (q && !`${p.employee_name} ${p.group_name || ""} ${SLIP_MONTHS[p.month - 1]} ${p.year}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const paged = shown.slice((psPage - 1) * psPerPage, psPage * psPerPage);
  const latestIds = new Set(employees.map(e => latestFor(e.id)?.id).filter(Boolean));

  const rollTarget = rollFrom ? psNext(rollFrom.month, rollFrom.year) : null;
  const rollEmp = rollFrom ? empById(rollFrom.employee_id) : null;
  const rollEst = rollFrom && rollEmp ? psCompute(rollEmp, psFormFrom(rollFrom, rollEmp)) : null;
  const rollExisting = rollFrom ? slipFor(rollFrom.employee_id, rollTarget.month, rollTarget.year) : null;

  if (loading) return <Spinner />;

  const toggles = [
    { k: "Pf", title: "Provident Fund (PF)", kind: "ded", placeholder: estimate ? `Auto · ${psINR(estimate.basic * 0.12)}` : "Auto: 12% of Basic", hint: "Employee contribution" },
    { k: "Tds", title: "Income Tax (TDS)", kind: "ded", placeholder: "Monthly TDS amount", hint: "Blank = ₹0" },
    { k: "Vp", title: "Variable Pay", kind: "earn", placeholder: "Monthly amount", hint: "Added on top of gross · blank = ₹0" },
    { k: "Pda", title: "Professional Development", kind: "earn", placeholder: "Monthly amount", note: "Taken from the Special Allowance pool" },
    { k: "Ins", title: "Insurance", kind: "earn", placeholder: "Monthly amount", note: "Taken from the Special Allowance pool" },
  ];
  const tKey = { Pf: ["usePf", "pfAmount"], Tds: ["useTds", "tdsAmount"], Vp: ["useVp", "vpAmount"], Pda: ["usePda", "pdaAmount"], Ins: ["useIns", "insAmount"] };

  return (
    <>
      <style>{`
        .ps { container-type: inline-size; container-name: ps; }
        .ps-wrap { display: flex; flex-direction: column; gap: 18px; }
        .ps-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid transparent; font-family: inherit; transition: transform .15s, opacity .15s, border-color .15s; white-space: nowrap; }
        .ps-btn.sm { padding: 7px 11px; font-size: 12px; border-radius: 10px; }
        .ps-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .ps-btn:disabled { opacity: .5; cursor: not-allowed; }
        .ps-btn-primary { background: ${C.accent}; color: #fff; box-shadow: 0 8px 22px ${C.accent}40; }
        .ps-btn-ghost { background: ${C.surface}; color: ${C.text}; border-color: ${C.border}; }
        .ps-btn-ghost:hover:not(:disabled) { border-color: ${C.accent}77; }
        .ps-btn-roll { background: ${C.purple}1c; color: ${C.purple}; border-color: ${C.purple}55; }
        .ps-btn-roll:hover:not(:disabled) { border-color: ${C.purple}; }
        .ps-btn-success { background: ${C.green}18; color: ${C.green}; border-color: ${C.green}44; }
        .ps-btn-danger { background: ${C.red}12; color: ${C.red}; border-color: ${C.red}40; }
        .ps-icon { width: 34px; height: 34px; padding: 0; }
        .ps-wrap button:focus-visible, .psm button:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }

        .ps-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
        .ps-title { margin: 0; font-size: clamp(22px, 2.4vw, 26px); font-weight: 800; color: ${C.text}; letter-spacing: -0.5px; }
        .ps-sub { margin: 4px 0 0; color: ${C.textMuted}; font-size: 13px; }
        .ps-head-acts { display: flex; gap: 8px; flex-wrap: wrap; }

        .ps-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .ps-kpi { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 18px; padding: 16px; display: flex; gap: 12px; align-items: center; min-width: 0; text-align: left; font-family: inherit; }
        button.ps-kpi { cursor: pointer; transition: border-color .15s, transform .15s; }
        button.ps-kpi:hover { border-color: ${C.accent}77; transform: translateY(-1px); }
        .ps-kpi-ico { width: 42px; height: 42px; border-radius: 13px; display: flex; align-items: center; justify-content: center; font-size: 19px; flex-shrink: 0; }
        .ps-kpi-v { font-size: 20px; font-weight: 800; letter-spacing: -0.4px; color: ${C.text}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ps-kpi-l { font-size: 12px; color: ${C.textMuted}; font-weight: 600; margin-top: 2px; }

        .ps-flash { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 14px; font-size: 13px; font-weight: 600; border: 1px solid; }

        .ps-gen { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; scroll-margin-top: 16px; }
        .ps-card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 20px; padding: 20px; min-width: 0; }
        .ps-card-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .ps-card-t { font-size: 15px; font-weight: 800; color: ${C.text}; display: flex; align-items: center; gap: 10px; }
        .ps-card-t span.ico { width: 34px; height: 34px; border-radius: 11px; background: ${C.accent}1a; border: 1px solid ${C.accent}33; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; }
        .ps-row3 { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, .7fr); gap: 12px; }
        .ps-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .ps-lbl { font-size: 12px; font-weight: 800; color: ${C.textDim}; }
        .ps-input { width: 100%; box-sizing: border-box; background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 12px; color: ${C.text}; padding: 10px 12px; font-size: 14px; font-family: inherit; outline: none; }
        .ps-input:focus { border-color: ${C.accent}; box-shadow: 0 0 0 3px ${C.accentGlow}; }
        .ps-banner { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 14px; padding: 10px 14px; border-radius: 12px; font-size: 12.5px; font-weight: 600; border: 1px solid; }
        .ps-banner span { flex: 1; min-width: 180px; }
        .ps-section { font-size: 11px; font-weight: 800; color: ${C.textMuted}; letter-spacing: .8px; text-transform: uppercase; margin: 20px 0 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ps-toggles { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
        .ps-tog { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px; transition: border-color .15s, background .15s; min-width: 0; }
        .ps-tog.on { border-color: ${C.accent}77; background: color-mix(in srgb, ${C.accent} 7%, ${C.surface}); }
        .ps-tog-head { display: flex; align-items: center; gap: 10px; cursor: pointer; min-width: 0; }
        .ps-tog-head input { position: absolute; opacity: 0; width: 0; height: 0; }
        .ps-switch { width: 34px; height: 20px; border-radius: 999px; background: ${C.border}; position: relative; flex-shrink: 0; transition: background .2s; }
        .ps-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .2s; }
        .ps-tog-head input:checked + .ps-switch { background: ${C.accent}; }
        .ps-tog-head input:checked + .ps-switch::after { transform: translateX(14px); }
        .ps-tog-head input:focus-visible + .ps-switch { outline: 2px solid ${C.accent}; outline-offset: 2px; }
        .ps-tog-title { font-size: 13px; font-weight: 700; color: ${C.text}; flex: 1; min-width: 0; line-height: 1.3; }
        .ps-kind { font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 999px; text-transform: uppercase; letter-spacing: .4px; flex-shrink: 0; }
        .ps-kind.ded { color: ${C.red}; background: ${C.red}18; }
        .ps-kind.earn { color: ${C.green}; background: ${C.green}18; }
        .ps-hint { font-size: 11.5px; color: ${C.textMuted}; }
        .ps-money { display: flex; align-items: center; background: ${C.card}; border: 1px solid ${C.border}; border-radius: 10px; overflow: hidden; }
        .ps-money span { padding: 0 10px; color: ${C.textMuted}; font-weight: 700; font-size: 13px; }
        .ps-money input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: ${C.text}; padding: 9px 10px 9px 0; font-size: 14px; font-family: inherit; }
        .ps-money input:disabled { opacity: .45; }
        .ps-money:focus-within { border-color: ${C.accent}; }
        .ps-adv-btn { background: none; border: none; color: ${C.accent}; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; text-transform: none; letter-spacing: 0; }
        .ps-fixed { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .ps-gen-foot { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 18px; flex-wrap: wrap; }

        .ps-prev { position: sticky; top: 16px; }
        .ps-prev-net { border-radius: 16px; padding: 16px; background: linear-gradient(135deg, ${C.green}22, transparent 70%), ${C.surface}; border: 1px solid ${C.green}40; }
        .ps-prev-net b { display: block; font-size: 28px; font-weight: 800; color: ${C.green}; letter-spacing: -0.6px; }
        .ps-lines { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
        .ps-line { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; color: ${C.textDim}; }
        .ps-line b { color: ${C.text}; font-variant-numeric: tabular-nums; font-weight: 700; }
        .ps-line.tot { border-top: 1px dashed ${C.border}; padding-top: 8px; margin-top: 2px; font-weight: 800; color: ${C.text}; }
        .ps-line.neg b { color: ${C.red}; }
        .ps-empty-prev { text-align: center; color: ${C.textMuted}; font-size: 13px; padding: 30px 10px; }
        .ps-empty-prev div { font-size: 30px; margin-bottom: 6px; }

        .ps-list-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 16px 18px; border-bottom: 1px solid ${C.border}; }
        .ps-filters { display: flex; gap: 8px; flex-wrap: wrap; }
        .ps-filters .ps-input { width: auto; padding: 8px 12px; font-size: 13px; border-radius: 10px; }
        .ps-row { display: grid; grid-template-columns: minmax(0, 1.5fr) .9fr .9fr .9fr 1fr 1.2fr 330px; gap: 12px; align-items: center; padding: 12px 18px; border-bottom: 1px solid ${C.border}44; font-size: 13px; }
        .ps-row:last-child { border-bottom: none; }
        .ps-row:not(.head):hover { background: ${C.accentGlow}; }
        .ps-row.head { background: ${C.surface}; font-size: 11px; font-weight: 800; color: ${C.textMuted}; letter-spacing: .5px; text-transform: uppercase; padding: 10px 18px; }
        .ps-emp { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .ps-avi { width: 34px; height: 34px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; flex-shrink: 0; }
        .ps-emp b { display: block; font-size: 13.5px; color: ${C.text}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ps-emp small { font-size: 11.5px; color: ${C.textMuted}; }
        .ps-num { font-variant-numeric: tabular-nums; font-weight: 700; }
        .ps-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; padding: 4px 10px; border-radius: 999px; border: 1px solid; white-space: nowrap; }
        .ps-pill i { width: 6px; height: 6px; border-radius: 50%; }
        .ps-acts { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
        .ps-latest { font-size: 10px; font-weight: 800; color: ${C.purple}; background: ${C.purple}18; padding: 1px 6px; border-radius: 999px; margin-left: 6px; }
        .ps-cell-l { display: none; }
        .ps-empty { padding: 48px 20px; text-align: center; color: ${C.textMuted}; font-size: 13.5px; }
        .ps-empty div { font-size: 32px; margin-bottom: 8px; }

        /* Modals */
        .psm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.66); backdrop-filter: blur(3px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .psm { width: 100%; max-width: 520px; max-height: min(92vh, 900px); display: flex; flex-direction: column; background: ${C.card}; border: 1px solid ${C.border}; border-radius: 22px; box-shadow: 0 30px 80px rgba(0,0,0,.6); overflow: hidden; animation: psmIn .18s ease-out; }
        .psm.wide { max-width: 760px; }
        @keyframes psmIn { from { transform: translateY(12px); opacity: 0; } }
        .psm-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 20px 22px 14px; border-bottom: 1px solid ${C.border}; }
        .psm-title { font-size: 18px; font-weight: 800; color: ${C.text}; }
        .psm-sub { font-size: 12.5px; color: ${C.textMuted}; margin-top: 3px; }
        .psm-body { padding: 18px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
        .psm-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 22px; border-top: 1px solid ${C.border}; background: ${C.surface}; flex-wrap: wrap; }
        .psm-flow { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; }
        .psm-per { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 14px; padding: 12px; text-align: center; }
        .psm-per small { display: block; font-size: 11px; color: ${C.textMuted}; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
        .psm-per b { display: block; font-size: 15px; color: ${C.text}; margin-top: 4px; }
        .psm-per.to { border-color: ${C.purple}77; background: ${C.purple}12; }
        .psm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .psm-chips span { font-size: 12px; font-weight: 700; color: ${C.textDim}; background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 999px; padding: 4px 10px; }
        .psm-warn { font-size: 12.5px; color: ${C.amber}; background: ${C.amber}12; border: 1px solid ${C.amber}40; border-radius: 12px; padding: 10px 12px; font-weight: 600; }
        .ps-run-list { border: 1px solid ${C.border}; border-radius: 14px; overflow: hidden; }
        .ps-run-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 12px; align-items: center; padding: 10px 14px; border-bottom: 1px solid ${C.border}44; font-size: 13px; }
        .ps-run-row:last-child { border-bottom: none; }
        .ps-run-row.dim { opacity: .6; }
        .ps-run-row input { width: 16px; height: 16px; accent-color: ${C.accent}; cursor: pointer; }
        .ps-progress { height: 8px; border-radius: 6px; background: ${C.border}; overflow: hidden; }
        .ps-progress div { height: 100%; background: linear-gradient(90deg, ${C.accent}, ${C.purple}); transition: width .3s; }

        /* ── Responsive ── */
        @container ps (max-width: 1100px) {
          .ps-gen { grid-template-columns: 1fr; }
          .ps-prev { position: static; }
          .ps-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ps-row { grid-template-columns: minmax(0, 1.5fr) .8fr .9fr 1.2fr 330px; }
          .ps-row > .c-gross, .ps-row > .c-ded { display: none; }
        }
        @container ps (max-width: 700px) {
          .ps-wrap { gap: 14px; }
          .ps-header { align-items: stretch; }
          .ps-head-acts, .ps-head-acts > * { width: 100%; }
          .ps-head-acts { display: grid; grid-template-columns: 1fr 1fr; }
          .ps-kpi { padding: 12px; gap: 10px; }
          .ps-kpi-ico { width: 34px; height: 34px; font-size: 16px; border-radius: 10px; }
          .ps-kpi-v { font-size: 17px; }
          .ps-card { padding: 14px; border-radius: 18px; }
          .ps-row3 { grid-template-columns: 1fr 1fr; }
          .ps-row3 > :first-child { grid-column: 1 / -1; }
          .ps-fixed { grid-template-columns: 1fr; }
          .ps-gen-foot .ps-btn { flex: 1; }
          .ps-filters, .ps-filters .ps-input { width: 100%; }
          .ps-row.head { display: none; }
          .ps-row { grid-template-columns: 1fr 1fr; gap: 10px 12px; padding: 14px; }
          .ps-row > .c-emp { grid-column: 1 / -1; }
          .ps-row > .c-gross, .ps-row > .c-ded { display: block; }
          .ps-row > .c-acts { grid-column: 1 / -1; }
          .ps-acts { justify-content: stretch; }
          .ps-acts .ps-btn { flex: 1; }
          .ps-cell-l { display: block; font-size: 10.5px; color: ${C.textMuted}; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
        }
        @media (max-width: 640px) {
          .psm-backdrop { align-items: flex-end; padding: 0; }
          .psm, .psm.wide { max-width: none; border-radius: 22px 22px 0 0; max-height: 94vh; }
          .psm-head, .psm-body, .psm-foot { padding-left: 16px; padding-right: 16px; }
          .psm-foot .ps-btn { flex: 1; }
          .ps-run-row { grid-template-columns: auto minmax(0, 1fr) auto; }
          .ps-run-row > :nth-child(4) { grid-column: 2 / -1; }
        }
      `}</style>

      <div className="ps">
        <div className="ps-wrap">
          {/* Header */}
          <div className="ps-header">
            <div>
              <h2 className="ps-title">Payslips</h2>
              <p className="ps-sub">Generate, roll forward and approve employee salary slips</p>
            </div>
            <div className="ps-head-acts">
              <button className="ps-btn ps-btn-roll" onClick={openRun}>⟳ Payroll run</button>
              <button className="ps-btn ps-btn-primary" onClick={() => { setForm(psEmptyForm()); setPrefilledFrom(null); formRef.current?.scrollIntoView({ behavior: "smooth" }); }}>＋ New payslip</button>
            </div>
          </div>

          {/* KPIs */}
          <div className="ps-kpis">
            <div className="ps-kpi">
              <div className="ps-kpi-ico" style={{ background: C.accent + "1a" }}>🧾</div>
              <div style={{ minWidth: 0 }}><div className="ps-kpi-v">{thisMonth.length}<span style={{ fontSize: 13, color: C.textMuted }}> / {ctcEmps.length}</span></div><div className="ps-kpi-l">Generated · {SLIP_MONTHS[curM - 1].slice(0, 3)} {curY}</div></div>
            </div>
            <div className="ps-kpi">
              <div className="ps-kpi-ico" style={{ background: C.green + "1a" }}>💰</div>
              <div style={{ minWidth: 0 }}><div className="ps-kpi-v" style={{ color: C.green }}>{psINR(Math.round(payroll))}</div><div className="ps-kpi-l">Net payout this month</div></div>
            </div>
            <button className="ps-kpi" onClick={() => { setFilterStatus("requested"); setFilterEmp(""); setFilterYear(""); }} disabled={!requested.length}>
              <div className="ps-kpi-ico" style={{ background: C.amber + "1a" }}>⏳</div>
              <div style={{ minWidth: 0 }}><div className="ps-kpi-v" style={{ color: requested.length ? C.amber : C.text }}>{requested.length}</div><div className="ps-kpi-l">Awaiting approval</div></div>
            </button>
            <button className="ps-kpi" onClick={openRun}>
              <div className="ps-kpi-ico" style={{ background: C.purple + "1a" }}>⟳</div>
              <div style={{ minWidth: 0 }}><div className="ps-kpi-v" style={{ color: missing.length ? C.purple : C.green }}>{missing.length}</div><div className="ps-kpi-l">{missing.length ? "Missing this month →" : "All generated ✓"}</div></div>
            </button>
          </div>

          {flash && (
            <div className="ps-flash" role="status" style={{ color: flash.ok ? C.green : C.red, background: (flash.ok ? C.green : C.red) + "12", borderColor: (flash.ok ? C.green : C.red) + "40" }}>
              {flash.ok ? "✅" : "⚠️"} <span style={{ flex: 1 }}>{flash.text}</span>
              <button className="ps-btn sm ps-btn-ghost" onClick={() => setFlash(null)} aria-label="Dismiss">✕</button>
            </div>
          )}

          {/* Generator + preview */}
          <div className="ps-gen" ref={formRef}>
            <section className="ps-card">
              <div className="ps-card-h">
                <div className="ps-card-t"><span className="ico">🖨</span>Generate payslip</div>
                {prevSlip && !prefilledFrom && (
                  <button className="ps-btn sm ps-btn-roll" onClick={() => applyTemplate(prevSlip, { month: form.month, year: form.year })}>⧉ Copy from {psPeriod(prevSlip.month, prevSlip.year)}</button>
                )}
              </div>

              <div className="ps-row3">
                <div className="ps-field">
                  <label className="ps-lbl" htmlFor="ps-emp">Employee</label>
                  <select id="ps-emp" className="ps-input" value={form.employeeId} onChange={e => selectEmployee(e.target.value)}>
                    <option value="">Select employee…</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} {+e.ctc_annual > 0 ? `· ₹${(e.ctc_annual / 100000).toFixed(1)}L` : "· No CTC"}</option>)}
                  </select>
                </div>
                <div className="ps-field">
                  <label className="ps-lbl" htmlFor="ps-month">Month</label>
                  <select id="ps-month" className="ps-input" value={form.month} onChange={e => set("month", +e.target.value)}>
                    {SLIP_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="ps-field">
                  <label className="ps-lbl" htmlFor="ps-year">Year</label>
                  <select id="ps-year" className="ps-input" value={form.year} onChange={e => set("year", +e.target.value)}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {prefilledFrom && (
                <div className="ps-banner" style={{ color: C.purple, background: C.purple + "12", borderColor: C.purple + "40" }}>
                  ⧉ <span>Settings copied from <b>{psPeriod(prefilledFrom.month, prefilledFrom.year)}</b> payslip. Review and adjust before generating.</span>
                  <button className="ps-btn sm ps-btn-ghost" onClick={() => { setForm(f => ({ ...psEmptyForm(), employeeId: f.employeeId, month: f.month, year: f.year })); setPrefilledFrom(null); }}>Reset to defaults</button>
                </div>
              )}
              {selEmp && !(+selEmp.ctc_annual > 0) && (
                <div className="ps-banner" style={{ color: C.red, background: C.red + "12", borderColor: C.red + "40" }}>⚠ <span>{selEmp.name} has no CTC configured — set it in Compensation before generating.</span></div>
              )}
              {existing && (
                <div className="ps-banner" style={{ color: C.amber, background: C.amber + "12", borderColor: C.amber + "40" }}>
                  ⚠ <span>A payslip for {psPeriod(form.month, form.year)} already exists{existing.is_approved ? " and is approved" : ""} — generating will overwrite it.</span>
                </div>
              )}

              <div className="ps-section">Earnings & deductions</div>
              <div className="ps-toggles">
                {toggles.map(t => {
                  const [onK, valK] = tKey[t.k];
                  return <PsToggle key={t.k} on={form[onK]} onToggle={v => set(onK, v)} title={t.title} kind={t.kind} hint={t.hint} note={t.note}
                    value={form[valK]} onValue={v => set(valK, v)} placeholder={t.placeholder} />;
                })}
              </div>

              <div className="ps-section">
                <span>Fixed components {!showAdvanced && (form.conveyanceAmount || form.medicalAmount || form.internetAmount) ? "· customised" : ""}</span>
                <button className="ps-adv-btn" onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced}>{showAdvanced ? "Hide ▲" : "Override ▼"}</button>
              </div>
              {showAdvanced && (
                <div className="ps-fixed">
                  {[["conveyanceAmount", "Conveyance", PS_DEFAULTS.conveyance], ["medicalAmount", "Medical", PS_DEFAULTS.medical], ["internetAmount", "Internet & broadband", PS_DEFAULTS.internet]].map(([k, l, d]) => (
                    <div key={k} className="ps-field">
                      <label className="ps-lbl" htmlFor={`ps-${k}`}>{l} <span className="ps-hint">default {psINR(d)}</span></label>
                      <div className="ps-money"><span>₹</span><input id={`ps-${k}`} type="number" min="0" inputMode="decimal" value={form[k]} placeholder={String(d)} onChange={e => set(k, e.target.value)} /></div>
                    </div>
                  ))}
                </div>
              )}

              <div className="ps-gen-foot">
                <button className="ps-btn ps-btn-ghost" onClick={() => { setForm(psEmptyForm()); setPrefilledFrom(null); }} disabled={generating}>Clear</button>
                <button className="ps-btn ps-btn-primary" onClick={generate} disabled={generating || !form.employeeId || !(+selEmp?.ctc_annual > 0)}>
                  {generating ? "Generating…" : existing ? `Regenerate ${SLIP_MONTHS[form.month - 1].slice(0, 3)} ${form.year}` : `Generate ${SLIP_MONTHS[form.month - 1].slice(0, 3)} ${form.year}`}
                </button>
              </div>
            </section>

            <aside className="ps-card ps-prev">
              <div className="ps-card-h" style={{ marginBottom: 12 }}>
                <div className="ps-card-t">Live estimate</div>
                {estimate && <span className="ps-hint">{psPeriod(form.month, form.year)}</span>}
              </div>
              {!estimate ? (
                <div className="ps-empty-prev"><div>🧮</div>{selEmp ? "Set a CTC for this employee to see the breakdown." : "Pick an employee to preview take-home pay."}</div>
              ) : (
                <>
                  <div className="ps-prev-net">
                    <div className="ps-hint">Estimated net pay</div>
                    <b>{psINR(estimate.net)}</b>
                    <div className="ps-hint">Gross {psINR(estimate.gross)} · Deductions {psINR(estimate.deductions)}</div>
                  </div>
                  <div className="ps-lines">
                    {[["Basic", estimate.basic], ["HRA", estimate.hra], ["LTA", estimate.lta], ["Conveyance", estimate.transport], ["Medical", estimate.medical], ["Internet", estimate.internet],
                      ...(estimate.pda ? [["Prof. development", estimate.pda]] : []), ...(estimate.ins ? [["Insurance", estimate.ins]] : []),
                      ["Special allowance", estimate.special], ...(estimate.vp ? [["Variable pay", estimate.vp]] : [])].map(([l, v]) => (
                        <div key={l} className="ps-line"><span>{l}</span><b>{psINR(v)}</b></div>
                      ))}
                    <div className="ps-line tot"><span>Gross</span><b>{psINR(estimate.gross)}</b></div>
                    {estimate.pf > 0 && <div className="ps-line neg"><span>PF</span><b>−{psINR(estimate.pf)}</b></div>}
                    {estimate.tds > 0 && <div className="ps-line neg"><span>TDS</span><b>−{psINR(estimate.tds)}</b></div>}
                    {estimate.pt > 0 && <div className="ps-line neg"><span>Professional tax</span><b>−{psINR(estimate.pt)}</b></div>}
                    <div className="ps-line tot"><span>Net pay</span><b style={{ color: C.green }}>{psINR(estimate.net)}</b></div>
                  </div>
                  {estimate.special < 0 && <div className="psm-warn" style={{ marginTop: 12 }}>Special allowance is negative — fixed components exceed the CTC pool.</div>}
                  <div className="ps-hint" style={{ marginTop: 10 }}>Estimate mirrors the server formula; the generated slip is authoritative.</div>
                </>
              )}
            </aside>
          </div>

          {/* History */}
          <section className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="ps-list-head">
              <div>
                <div className="ps-card-t">Generated payslips</div>
                <div className="ps-hint">{shown.length} of {payslips.length} · use <b style={{ color: C.purple }}>Next month</b> to roll a slip forward</div>
              </div>
              <div className="ps-filters">
                <input className="ps-input" placeholder="Search name, team, month…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search payslips" />
                <select className="ps-input" value={filterEmp} onChange={e => setFilterEmp(e.target.value)} aria-label="Filter by employee">
                  <option value="">All employees</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select className="ps-input" value={filterYear} onChange={e => setFilterYear(e.target.value)} aria-label="Filter by year">
                  <option value="">All years</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select className="ps-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} aria-label="Filter by status">
                  <option value="">All statuses</option>
                  <option value="requested">Download requested</option>
                  <option value="approved">Approved</option>
                  <option value="generated">Generated</option>
                </select>
              </div>
            </div>
            <div className="ps-row head">{["Employee", "Period", "Gross", "Deductions", "Net pay", "Status", "Actions"].map(h => <div key={h} style={h === "Actions" ? { textAlign: "right" } : undefined} className={h === "Gross" ? "c-gross" : h === "Deductions" ? "c-ded" : undefined}>{h}</div>)}</div>
            {shown.length === 0 ? (
              <div className="ps-empty"><div>{payslips.length ? "🔍" : "🧾"}</div>{payslips.length ? "No payslips match these filters." : "No payslips generated yet."}</div>
            ) : paged.map(ps => {
              const st = psStatus(ps);
              const ded = (+ps.pf_employee || 0) + (+ps.professional_tax || 0) + (+ps.income_tax || 0) + (+ps.extra_deductions || 0);
              const gc = ps.group_color || C.accent;
              const nx = psNext(ps.month, ps.year);
              return (
                <div key={ps.id} className="ps-row">
                  <div className="c-emp ps-emp">
                    <div className="ps-avi" style={{ background: gc + "22", color: gc }}>{ps.avatar || mkAvi(ps.employee_name)}</div>
                    <div style={{ minWidth: 0 }}><b>{ps.employee_name}</b><small title={ps.generated_at ? `Generated ${ps.generated_at.slice(0, 10)}` : undefined}>{ps.group_name || "—"}</small></div>
                  </div>
                  <div><span className="ps-cell-l">Period</span><span style={{ fontWeight: 700, color: C.text }}>{SLIP_MONTHS[ps.month - 1].slice(0, 3)} {ps.year}</span>{latestIds.has(ps.id) && <span className="ps-latest">LATEST</span>}</div>
                  <div className="c-gross"><span className="ps-cell-l">Gross</span><span className="ps-num" style={{ color: C.text }}>{psINR(ps.gross)}</span></div>
                  <div className="c-ded"><span className="ps-cell-l">Deductions</span><span className="ps-num" style={{ color: C.red }}>{ded ? `−${psINR(ded)}` : "—"}</span></div>
                  <div><span className="ps-cell-l">Net pay</span><span className="ps-num" style={{ color: C.green, fontSize: 14.5, fontWeight: 800 }}>{psINR(ps.net_pay)}</span></div>
                  <div><span className="ps-cell-l">Status</span><span className="ps-pill" style={{ color: st.color, background: st.color + "18", borderColor: st.color + "40" }}><i style={{ background: st.color }} />{st.label}</span></div>
                  <div className="c-acts ps-acts">
                    {st.k === "requested" && <button className="ps-btn sm ps-btn-success" onClick={() => approve(ps.id)} disabled={busyId === ps.id}>✓ Approve</button>}
                    <button className="ps-btn sm ps-btn-roll" onClick={() => setRollFrom(ps)} disabled={busyId === ps.id} title={`Generate ${psPeriod(nx.month, nx.year)} using this payslip's settings`}>⟳ Next: {SLIP_MONTHS[nx.month - 1].slice(0, 3)}{nx.year !== ps.year ? ` ${nx.year}` : ""}</button>
                    <button className="ps-btn sm ps-btn-ghost" onClick={() => printPayslipData(ps, origin)} aria-label="Print payslip">🖨 Print</button>
                    <button className="ps-btn sm ps-btn-danger ps-icon" onClick={() => del(ps)} aria-label="Delete payslip">🗑</button>
                  </div>
                </div>
              );
            })}
            {shown.length > psPerPage && <PaginationControls page={psPage} setPage={setPsPage} perPage={psPerPage} setPerPage={setPsPerPage} total={shown.length} />}
          </section>
        </div>
      </div>

      {/* Roll-forward (Next month) modal */}
      {rollFrom && (
        <div className="psm-backdrop" onClick={() => busyId !== rollFrom.id && setRollFrom(null)}>
          <div className="psm" role="dialog" aria-modal="true" aria-label="Generate next month" onClick={e => e.stopPropagation()}>
            <div className="psm-head">
              <div>
                <div className="psm-title">Generate next month</div>
                <div className="psm-sub">{rollFrom.employee_name} · reuse this payslip's settings</div>
              </div>
              <button className="ps-btn sm ps-btn-ghost" onClick={() => setRollFrom(null)} aria-label="Close">✕</button>
            </div>
            <div className="psm-body">
              <div className="psm-flow">
                <div className="psm-per"><small>From</small><b>{psPeriod(rollFrom.month, rollFrom.year)}</b><span className="ps-hint">{psINR(rollFrom.net_pay)} net</span></div>
                <span style={{ fontSize: 20, color: C.purple }}>→</span>
                <div className="psm-per to"><small>Generate</small><b>{psPeriod(rollTarget.month, rollTarget.year)}</b><span className="ps-hint">{rollEst ? `≈ ${psINR(rollEst.net)} net` : "—"}</span></div>
              </div>
              <div>
                <div className="ps-lbl" style={{ marginBottom: 8 }}>Settings carried forward</div>
                <div className="psm-chips">
                  {(() => {
                    const f = psFormFrom(rollFrom, rollEmp);
                    const c = [];
                    c.push(f.usePf ? `PF ${f.pfAmount ? psINR(f.pfAmount) : "auto 12%"}` : "No PF");
                    c.push(f.useTds ? `TDS ${psINR(f.tdsAmount)}` : "No TDS");
                    if (f.useVp) c.push(`Variable ${psINR(f.vpAmount)}`);
                    if (f.usePda) c.push(`Prof. dev ${psINR(f.pdaAmount)}`);
                    if (f.useIns) c.push(`Insurance ${psINR(f.insAmount)}`);
                    if (f.conveyanceAmount || f.medicalAmount || f.internetAmount) c.push("Custom fixed components");
                    return c.map(x => <span key={x}>{x}</span>);
                  })()}
                </div>
              </div>
              {rollEmp && rollEst && Math.abs(rollEst.net - (+rollFrom.net_pay || 0)) >= 1 && (
                <div className="psm-warn">Net pay differs from {SLIP_MONTHS[rollFrom.month - 1]} by {psINR(Math.abs(rollEst.net - rollFrom.net_pay))} — the employee's CTC may have changed since.</div>
              )}
              {rollExisting && <div className="psm-warn">⚠ {psPeriod(rollTarget.month, rollTarget.year)} already exists{rollExisting.is_approved ? " and is approved" : ""} — it will be overwritten.</div>}
              {!rollEmp?.ctc_annual && <div className="psm-warn">This employee no longer has a CTC configured.</div>}
            </div>
            <div className="psm-foot">
              <button className="ps-btn ps-btn-ghost" onClick={() => rollForward(rollFrom, true)}>✎ Edit first</button>
              <button className="ps-btn ps-btn-primary" onClick={() => rollForward(rollFrom, false)} disabled={busyId === rollFrom.id || !(+rollEmp?.ctc_annual > 0)}>
                {busyId === rollFrom.id ? "Generating…" : `Generate ${SLIP_MONTHS[rollTarget.month - 1].slice(0, 3)} ${rollTarget.year}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll run modal (bulk next month) */}
      {runOpen && (
        <div className="psm-backdrop" onClick={() => !(runProgress && runProgress.done < runProgress.total) && setRunOpen(false)}>
          <div className="psm wide" role="dialog" aria-modal="true" aria-label="Payroll run" onClick={e => e.stopPropagation()}>
            <div className="psm-head">
              <div>
                <div className="psm-title">Payroll run</div>
                <div className="psm-sub">Generate a month for everyone from their previous payslip</div>
              </div>
              <button className="ps-btn sm ps-btn-ghost" onClick={() => setRunOpen(false)} disabled={!!runProgress && runProgress.done < runProgress.total} aria-label="Close">✕</button>
            </div>
            <div className="psm-body">
              <div className="ps-row3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="ps-field">
                  <label className="ps-lbl" htmlFor="run-m">Month</label>
                  <select id="run-m" className="ps-input" value={runPeriod.month} disabled={!!runProgress} onChange={e => { setRunPeriod(p => ({ ...p, month: +e.target.value })); setRunSel({}); }}>
                    {SLIP_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="ps-field">
                  <label className="ps-lbl" htmlFor="run-y">Year</label>
                  <select id="run-y" className="ps-input" value={runPeriod.year} disabled={!!runProgress} onChange={e => { setRunPeriod(p => ({ ...p, year: +e.target.value })); setRunSel({}); }}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {runProgress ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: C.text }}>
                    <span>{runProgress.done < runProgress.total ? "Generating…" : "Done"}</span><span>{runProgress.done} / {runProgress.total}</span>
                  </div>
                  <div className="ps-progress"><div style={{ width: `${(runProgress.done / runProgress.total) * 100}%` }} /></div>
                  {runProgress.done === runProgress.total && (
                    <div style={{ fontSize: 13, color: runProgress.failed.length ? C.amber : C.green, fontWeight: 600 }}>
                      {runProgress.total - runProgress.failed.length} generated{runProgress.failed.length ? `, ${runProgress.failed.length} failed` : " ✓"}
                    </div>
                  )}
                  {runProgress.failed.map(f => <div key={f} className="psm-warn" style={{ color: C.red, borderColor: C.red + "40", background: C.red + "10" }}>{f}</div>)}
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div className="ps-hint"><b style={{ color: C.text }}>{readyRows.length}</b> ready · {runRows.filter(r => r.has).length} already generated · {runRows.filter(r => !r.has && !r.src).length} need a first payslip</div>
                    {readyRows.length > 0 && (
                      <button className="ps-adv-btn" onClick={() => { const all = selectedRun.length === readyRows.length; setRunSel(Object.fromEntries(readyRows.map(r => [r.e.id, !all]))); }}>
                        {selectedRun.length === readyRows.length ? "Deselect all" : "Select all"}
                      </button>
                    )}
                  </div>
                  <div className="ps-run-list">
                    {runRows.length === 0 && <div className="ps-empty" style={{ padding: 24 }}>No employees with a CTC configured.</div>}
                    {runRows.map(r => (
                      <label key={r.e.id} className={`ps-run-row${r.ready ? "" : " dim"}`} style={{ cursor: r.ready ? "pointer" : "default" }}>
                        <input type="checkbox" disabled={!r.ready} checked={r.ready && runSel[r.e.id] !== false} onChange={e => setRunSel(s => ({ ...s, [r.e.id]: e.target.checked }))} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.e.name}</div>
                          <div className="ps-hint">{r.has ? "Already generated" : r.src ? `From ${psPeriod(r.src.month, r.src.year)}` : "No previous payslip — generate manually"}</div>
                        </div>
                        <span className="ps-num" style={{ color: r.est ? C.green : C.textMuted }}>{r.has ? psINR(r.has.net_pay) : r.est ? `≈ ${psINR(r.est.net)}` : "—"}</span>
                        <span className="ps-pill" style={{ color: r.has ? C.green : r.ready ? C.purple : C.textMuted, borderColor: (r.has ? C.green : r.ready ? C.purple : C.border) + "55", background: (r.has ? C.green : r.ready ? C.purple : C.border) + "14", justifySelf: "end" }}>
                          {r.has ? "✓ Done" : r.ready ? "Ready" : "Manual"}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="psm-foot">
              {runProgress && runProgress.done === runProgress.total ? (
                <button className="ps-btn ps-btn-primary" onClick={() => setRunOpen(false)}>Close</button>
              ) : (<>
                <button className="ps-btn ps-btn-ghost" onClick={() => setRunOpen(false)} disabled={!!runProgress}>Cancel</button>
                <button className="ps-btn ps-btn-primary" onClick={executeRun} disabled={!selectedRun.length || !!runProgress}>
                  {runProgress ? "Working…" : `Generate ${selectedRun.length} payslip${selectedRun.length !== 1 ? "s" : ""}`}
                </button>
              </>)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DocumentGrid({ type = "document", allowEdit = false }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { id, title, url }
  const [saving, setSaving] = useState(false);
  // Pagination
  const [docPage, setDocPage] = useState(1);
  const [docPerPage, setDocPerPage] = useState(10);

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

  const isPolicy = type === "policy";
  const docIcon = isPolicy ? "📋" : "📄";
  const accentColor = isPolicy ? C.accent : C.purple;

  // Pick a distinctive icon per index for policy cards
  const policyIcons = ["📋", "🛡️", "📊", "🔐", "📝", "⚖️", "🏢", "💼", "🎯", "📌"];

  return (
    <>
      <style>{`
        .doc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .doc-card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; transition: transform .15s, box-shadow .2s; }
        .doc-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.35); }
        .doc-open-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 0; background: transparent; color: ${accentColor}; font-size: 13px; font-weight: 700; text-decoration: none; border-top: 1px solid ${C.border}; transition: background .15s; }
        .doc-open-btn:hover { background: ${accentColor}14; }
        @media (max-width: 640px) {
          .doc-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: accentColor + "22", border: `1px solid ${accentColor}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{docIcon}</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>{titleText}</h2>
              <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>{descText}</p>
            </div>
          </div>
          {allowEdit && (
            <Btn onClick={() => setModal({ title: "", url: "" })}>+ Add Link</Btn>
          )}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div style={{ padding: 60, textAlign: "center" }}><Spinner /></div>
        ) : docs.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "60px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>{isPolicy ? "🛡️" : "📄"}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>No {isPolicy ? "policies" : "documents"} yet</div>
            <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
              {isPolicy ? "Company policies will appear here once added by your admin." : "No document links have been added yet."}
            </p>
          </div>
        ) : (
          <>
          <div className="doc-grid">
            {docs.slice((docPage - 1) * docPerPage, docPage * docPerPage).map((d, i) => (
              <div key={d.id} className="doc-card">
                {/* Card top accent bar */}
                <div style={{ height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }} />

                <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                  {/* Icon + title row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: accentColor + "20", border: `1px solid ${accentColor}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                        {policyIcons[i % policyIcons.length]}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{d.title}</div>
                    </div>
                    {allowEdit && (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button onClick={() => setModal(d)} title="Edit"
                          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, padding: "5px 9px", color: C.textMuted, transition: "all .15s" }}>✏</button>
                        <button onClick={() => del(d.id)} title="Delete"
                          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, padding: "5px 9px", color: C.red, transition: "all .15s" }}>🗑</button>
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>👤</div>
                    <span style={{ fontSize: 12, color: C.textMuted }}>Added by <span style={{ color: C.textDim, fontWeight: 600 }}>{d.creator_name || "Unknown"}</span></span>
                    <span style={{ fontSize: 12, color: C.border }}>·</span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{d.created_at?.slice(0, 10)}</span>
                  </div>

                  {/* URL preview chip */}
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                    <span style={{ fontSize: 12 }}>🔗</span>
                    <span style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.url}</span>
                  </div>
                </div>

                {/* Open link button */}
                <a href={d.url} target="_blank" rel="noreferrer" className="doc-open-btn">
                  ↗ Open {isPolicy ? "Policy" : "Document"}
                </a>
              </div>
            ))}
          </div>
          <PaginationControls page={docPage} setPage={setDocPage} perPage={docPerPage} setPerPage={setDocPerPage} total={docs.length} />
          </>
        )}

        {/* ── Add/Edit Modal ── */}
        {modal && (
          <Modal title={modal.id ? `Edit ${isPolicy ? "Policy" : "Document"}` : `New ${isPolicy ? "Policy" : "Document"}`} onClose={() => setModal(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700, marginBottom: 6, letterSpacing: .5 }}>Title</div>
                <input value={modal.title} onChange={e => setModal({ ...modal, title: e.target.value })}
                  placeholder={isPolicy ? "e.g. Employee Handbook" : "e.g. Design Guidelines"}
                  style={{ width: "100%", boxSizing: "border-box", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700, marginBottom: 6, letterSpacing: .5 }}>URL</div>
                <input value={modal.url} onChange={e => setModal({ ...modal, url: e.target.value })}
                  placeholder="https://..."
                  style={{ width: "100%", boxSizing: "border-box", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13 }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                <Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn>
                <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </>
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
    if (!form.app_name || !form.start_date || !form.expire_date || !form.link) { dialog.alert("App name, start date, expire date and link are required.", { title: "Validation", dtype: "warning" }); return; }
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
  // Pagination
  const [aPage, setAPage] = useState(1);
  const [aPerPage, setAPerPage] = useState(10);

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
        <input placeholder="Search tag / brand / employee…" value={search} onChange={e => { setSearch(e.target.value); setAPage(1); }} style={{ ...inputStyle, width: 240 }} />
        <input placeholder="Filter by type…" value={filterType} onChange={e => { setFilterType(e.target.value); setAPage(1); }} style={{ ...inputStyle, width: 160 }} />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setAPage(1); }} style={{ ...inputStyle, width: 150 }}>
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
              ) : filtered.slice((aPage - 1) * aPerPage, aPage * aPerPage).map(a => (
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
        <PaginationControls page={aPage} setPage={setAPage} perPage={aPerPage} setPerPage={setAPerPage} total={filtered.length} />
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

// ════════════════════════════════════════════════════════
// PERFORMANCE MANAGEMENT (Admin / Manager view) — Live API
// ════════════════════════════════════════════════════════
function PerformanceManagement({ currentUser }) {
  const isAdmin = currentUser?.role === "admin";
  const isManager = currentUser?.role === "manager";

  const TABS = [
    { id: "goals",    label: "Goals (All Employees)",    icon: "🎯" },
    { id: "self",     label: "Self-Assessments",         icon: "🪞" },
    { id: "feedback", label: "Manager Feedback",         icon: "💬" },
    { id: "reviews",  label: "Performance Reviews",      icon: "📋" },
    { id: "cycles",   label: "Review Cycles",            icon: "🗓" },
  ];
  const [tab, setTab] = useState("goals");

  // employee list for dropdowns
  const [allEmployees, setAllEmployees] = useState([]);
  const [selEmp, setSelEmp] = useState("");

  // goals — unified view (all reports / all employees)
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalFilter, setGoalFilter] = useState("");       // filter by employee name in table
  const [goalModal, setGoalModal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [goalSaving, setGoalSaving] = useState(false);
  const emptyGoal = { employeeId: "", title: "", type: "OKR", target: "", current: "", due: "", status: "on-track", priority: "medium" };
  const [goalForm, setGoalForm] = useState(emptyGoal);

  // self-assessments — unified view
  const [selfRows, setSelfRows] = useState([]);
  const [selfLoading, setSelfLoading] = useState(false);
  const [selfFilter, setSelfFilter] = useState("");
  const [expandedSA, setExpandedSA] = useState(null);

  // feedback — per-employee
  const [feedbacks, setFeedbacks] = useState([]);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbModal, setFbModal] = useState(false);
  const [editFb, setEditFb] = useState(null);
  const [fbSaving, setFbSaving] = useState(false);
  const emptyFb = { employeeId: "", reviewCycleId: "", period: "", feedbackDate: "", overallRating: 4, strengths: "", areasToImprove: "", managerComment: "" };
  const [fbForm, setFbForm] = useState(emptyFb);
  const [expandedFb, setExpandedFb] = useState(null);

  // reviews — per-employee
  const [reviews, setReviews] = useState([]);
  const [revLoading, setRevLoading] = useState(false);
  const [revModal, setRevModal] = useState(false);
  const [editRev, setEditRev] = useState(null);
  const [revSaving, setRevSaving] = useState(false);
  const emptyRev = { employeeId: "", reviewCycleId: "", period: "", status: "pending", finalScore: "", badge: "", reviewDate: "", notes: "" };
  const [revForm, setRevForm] = useState(emptyRev);
  const [expandedRev, setExpandedRev] = useState(null);

  // cycles
  const [cycles, setCycles] = useState([]);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [cycleModal, setCycleModal] = useState(false);
  const [editCycle, setEditCycle] = useState(null);
  const emptyCycle = { name: "", startDate: "", endDate: "", status: "active" };
  const [cycleForm, setCycleForm] = useState(emptyCycle);
  const [cycleSaving, setCycleSaving] = useState(false);

  const selStyle = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "9px 12px", fontSize: 13, outline: "none", width: "100%" };
  const sc = s => s === "achieved" ? C.green : s === "on-track" ? C.accent : s === "at-risk" ? C.amber : C.red;
  const sl = s => ({ "achieved": "Achieved", "on-track": "On Track", "at-risk": "At Risk", "behind": "Behind" }[s] || s);
  const Stars = ({ n, size = 14 }) => Array.from({ length: 5 }, (_, i) => (
    <span key={i} style={{ fontSize: size, color: i < Math.floor(n) ? "#F59E0B" : C.border }}>★</span>
  ));
  const empName = id => allEmployees.find(e => String(e.id) === String(id))?.name || "—";

  // ── Load on mount
  useEffect(() => { loadEmployees(); loadCycles(); }, []);
  useEffect(() => {
    if (tab === "goals") loadGoals();
    else if (tab === "self") loadSelf();
    else if (tab === "feedback" && selEmp) loadFeedback();
    else if (tab === "reviews" && selEmp) loadReviews();
    // eslint-disable-next-line
  }, [tab]);
  useEffect(() => {
    if (tab === "feedback" && selEmp) loadFeedback();
    if (tab === "reviews" && selEmp) loadReviews();
    // eslint-disable-next-line
  }, [selEmp]);

  async function loadEmployees() {
    try { setAllEmployees(await api.getMyReports()); } catch (e) { console.error(e); }
  }
  async function loadCycles() {
    setCyclesLoading(true);
    try { setCycles(await api.getReviewCycles()); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setCyclesLoading(false); }
  }
  async function loadGoals() {
    setGoalsLoading(true);
    try { setGoals(await api.getPerformanceGoals()); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setGoalsLoading(false); }
  }
  async function loadSelf() {
    setSelfLoading(true);
    try { setSelfRows(await api.getSelfAssessments()); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setSelfLoading(false); }
  }
  async function loadFeedback() {
    setFbLoading(true);
    try { setFeedbacks(await api.getManagerFeedbacks(selEmp ? { employee_id: selEmp } : {})); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setFbLoading(false); }
  }
  async function loadReviews() {
    setRevLoading(true);
    try { setReviews(await api.getPerformanceReviews(selEmp ? { employee_id: selEmp } : {})); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setRevLoading(false); }
  }

  // CRUD helpers
  async function saveGoal() {
    if (!goalForm.title.trim() || !goalForm.employeeId) return;
    setGoalSaving(true);
    try {
      if (editGoal) await api.updatePerformanceGoal(editGoal.id, goalForm);
      else await api.createPerformanceGoal(goalForm);
      setGoalModal(false); await loadGoals();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setGoalSaving(false); }
  }
  async function deleteGoal(id) {
    if (!await dialog.confirm("Delete this goal?", { dtype: "warning" })) return;
    try { await api.deletePerformanceGoal(id); await loadGoals(); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }
  async function saveFeedback() {
    if (!fbForm.employeeId) return;
    setFbSaving(true);
    try {
      if (editFb) await api.updateManagerFeedback(editFb.id, fbForm);
      else await api.createManagerFeedback(fbForm);
      setFbModal(false); await loadFeedback();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setFbSaving(false); }
  }
  async function deleteFeedback(id) {
    if (!await dialog.confirm("Delete feedback?", { dtype: "warning" })) return;
    try { await api.deleteManagerFeedback(id); await loadFeedback(); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }
  async function saveReview() {
    if (!revForm.employeeId || !revForm.reviewCycleId) return;
    setRevSaving(true);
    try {
      if (editRev) await api.updatePerformanceReview(editRev.id, revForm);
      else await api.createPerformanceReview(revForm);
      setRevModal(false); await loadReviews();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setRevSaving(false); }
  }
  async function deleteReview(id) {
    if (!await dialog.confirm("Delete review?", { dtype: "warning" })) return;
    try { await api.deletePerformanceReview(id); await loadReviews(); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }
  async function saveCycle() {
    if (!cycleForm.name.trim()) return;
    setCycleSaving(true);
    try {
      if (editCycle) await api.updateReviewCycle(editCycle.id, cycleForm);
      else await api.createReviewCycle(cycleForm);
      setCycleModal(false); await loadCycles();
    } catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
    finally { setCycleSaving(false); }
  }
  async function deleteCycle(id) {
    if (!await dialog.confirm("Delete cycle?", { dtype: "warning" })) return;
    try { await api.deleteReviewCycle(id); await loadCycles(); }
    catch (e) { dialog.alert(e.message, { title: "Error", dtype: "error" }); }
  }

  // ── Filtered goals/self for search
  const filteredGoals = goals.filter(g =>
    !goalFilter || (g.employee_name || "").toLowerCase().includes(goalFilter.toLowerCase())
  );
  const filteredSelf = selfRows.filter(s =>
    !selfFilter || (s.employee_name || "").toLowerCase().includes(selfFilter.toLowerCase())
  );

  // ── Employee selector (for feedback/reviews tabs)
  const EmpSelector = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>Employee:</span>
      <select value={selEmp} onChange={e => setSelEmp(e.target.value)} style={{ ...selStyle, maxWidth: 280 }}>
        <option value="">— Select Employee —</option>
        {allEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
    </div>
  );
  const NoEmpBanner = () => (
    <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 16, padding: 48, textAlign: "center", color: C.textMuted }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Select an employee first</div>
      <p style={{ fontSize: 13, margin: 0 }}>Use the dropdown above to filter by employee.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: 0, letterSpacing: -0.5 }}>Performance Management</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>
          {isManager ? "View your team's goals and self-assessments, give feedback" : "All employee performance data — goals, assessments, feedback, reviews"}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? C.accent + "18" : "transparent",
            color: tab === t.id ? C.accent : C.textMuted,
            border: "none", borderBottom: `2px solid ${tab === t.id ? C.accent : "transparent"}`,
            borderRadius: "8px 8px 0 0", padding: "10px 18px", fontSize: 13,
            fontWeight: tab === t.id ? 700 : 500, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", transition: "all 0.15s",
          }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ══ GOALS TAB — shows ALL employees in one table ══ */}
      {tab === "goals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>All Employees' Goals</span>
              <span style={{ background: C.accent + "18", color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
                {filteredGoals.length}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input placeholder="Filter by employee…" value={goalFilter} onChange={e => setGoalFilter(e.target.value)}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "7px 12px", fontSize: 13, outline: "none", width: 200 }} />
              <Btn onClick={() => { setEditGoal(null); setGoalForm(emptyGoal); setGoalModal(true); }}>+ Add Goal</Btn>
            </div>
          </div>

          {goalsLoading ? <Spinner /> : filteredGoals.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 48, textAlign: "center", color: C.textMuted }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>No goals yet</div>
              <p style={{ fontSize: 13, margin: 0 }}>Employees can add their goals from "My Performance" or you can add them here.</p>
            </div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "160px 2fr 70px 90px 90px 90px 80px 70px", background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 20px", gap: 0 }}>
                {["Employee", "Goal", "Type", "Target", "Current", "Priority", "Status", ""].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: .5 }}>{h}</div>
                ))}
              </div>
              {filteredGoals.map((g, i) => (
                <div key={g.id} style={{ display: "grid", gridTemplateColumns: "160px 2fr 70px 90px 90px 90px 80px 70px", padding: "12px 20px", borderBottom: i < filteredGoals.length - 1 ? `1px solid ${C.border}44` : "none", alignItems: "center", gap: 0, transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surface}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: C.accent + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: C.accent, flexShrink: 0 }}>
                      {(g.employee_name || "?").split(" ").map(w => w[0]).join("").slice(0,2)}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.employee_name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text, paddingRight: 8 }}>{g.title}</span>
                  <span style={{ background: g.type === "OKR" ? C.purple + "22" : C.accent + "22", color: g.type === "OKR" ? C.purple : C.accent, borderRadius: 5, padding: "2px 6px", fontSize: 10, fontWeight: 700 }}>{g.type}</span>
                  <span style={{ fontSize: 12, color: C.text }}>{g.target || "—"}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: sc(g.status) }}>{g.current_value || "—"}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: g.priority === "high" ? C.red : g.priority === "medium" ? C.amber : C.textDim, textTransform: "uppercase" }}>{g.priority}</span>
                  <span style={{ background: sc(g.status) + "22", color: sc(g.status), borderRadius: 5, padding: "2px 6px", fontSize: 10, fontWeight: 700 }}>{sl(g.status)}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => { setEditGoal(g); setGoalForm({ employeeId: g.employee_id, title: g.title, type: g.type, target: g.target || "", current: g.current_value || "", due: g.due_date?.slice(0,10) || "", status: g.status, priority: g.priority }); setGoalModal(true); }}
                      style={{ background: C.accent + "18", color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: 5, padding: "3px 7px", fontSize: 11, cursor: "pointer" }}>✏</button>
                    {isAdmin && <button onClick={() => deleteGoal(g.id)}
                      style={{ background: C.red + "18", color: C.red, border: `1px solid ${C.red}33`, borderRadius: 5, padding: "3px 7px", fontSize: 11, cursor: "pointer" }}>🗑</button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {goalModal && (
            <Modal title={editGoal ? "Edit Goal" : "Add Goal for Employee"} onClose={() => setGoalModal(false)}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Employee *</div>
                  <select value={goalForm.employeeId} onChange={e => setGoalForm(p => ({ ...p, employeeId: e.target.value }))} style={selStyle}>
                    <option value="">— Select Employee —</option>
                    {allEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <Inp label="Goal Title *" value={goalForm.title} onChange={v => setGoalForm(p => ({ ...p, title: v }))} required />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Type</div>
                    <select value={goalForm.type} onChange={e => setGoalForm(p => ({ ...p, type: e.target.value }))} style={selStyle}>
                      <option value="OKR">OKR</option><option value="KPI">KPI</option>
                    </select></div>
                  <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Priority</div>
                    <select value={goalForm.priority} onChange={e => setGoalForm(p => ({ ...p, priority: e.target.value }))} style={selStyle}>
                      <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Inp label="Target" value={goalForm.target} onChange={v => setGoalForm(p => ({ ...p, target: v }))} />
                  <Inp label="Current Progress" value={goalForm.current} onChange={v => setGoalForm(p => ({ ...p, current: v }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Inp label="Due Date" type="date" value={goalForm.due} onChange={v => setGoalForm(p => ({ ...p, due: v }))} />
                  <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Status</div>
                    <select value={goalForm.status} onChange={e => setGoalForm(p => ({ ...p, status: e.target.value }))} style={selStyle}>
                      <option value="on-track">On Track</option><option value="at-risk">At Risk</option>
                      <option value="achieved">Achieved</option><option value="behind">Behind</option>
                    </select></div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <Btn variant="ghost" onClick={() => setGoalModal(false)}>Cancel</Btn>
                  <Btn onClick={saveGoal} disabled={goalSaving}>{goalSaving ? "Saving…" : editGoal ? "Save" : "Add Goal"}</Btn>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* ══ SELF-ASSESSMENTS TAB — all employees in cards ══ */}
      {tab === "self" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>All Submitted Self-Assessments</span>
              <span style={{ background: C.purple + "18", color: C.purple, border: `1px solid ${C.purple}33`, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{filteredSelf.length}</span>
            </div>
            <input placeholder="Filter by employee…" value={selfFilter} onChange={e => setSelfFilter(e.target.value)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "7px 12px", fontSize: 13, outline: "none", width: 200 }} />
          </div>
          {selfLoading ? <Spinner /> : filteredSelf.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 48, textAlign: "center", color: C.textMuted }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🪞</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>No assessments submitted yet</div>
              <p style={{ fontSize: 13, margin: 0 }}>Employees submit self-assessments from their "My Performance" page.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredSelf.map(sa => {
                const avg = ((sa.technical_skill + sa.communication + sa.teamwork + sa.leadership + sa.innovation) / 5).toFixed(1);
                const expanded = expandedSA === sa.id;
                return (
                  <div key={sa.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", cursor: "pointer", background: expanded ? C.surface : "transparent" }}
                      onClick={() => setExpandedSA(expanded ? null : sa.id)}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: C.purple + "22", border: `1px solid ${C.purple}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: C.purple, flexShrink: 0 }}>
                        {(sa.employee_name || "?").split(" ").map(w => w[0]).join("").slice(0,2)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{sa.employee_name}</div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Period: {sa.period || sa.cycle_name || "—"} · Submitted: {sa.submitted_at?.slice(0,10) || "—"}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: C.accent }}>{avg}</div>
                          <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, textTransform: "uppercase" }}>Avg Score</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {[["T", sa.technical_skill], ["C", sa.communication], ["Te", sa.teamwork]].map(([lbl, val]) => (
                            <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontSize: 9, color: C.textMuted, width: 14 }}>{lbl}</span>
                              <div style={{ width: 50, height: 4, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${(val/5)*100}%`, height: "100%", background: `linear-gradient(90deg,${C.accent},${C.purple})`, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 9, color: C.textMuted }}>{val}</span>
                            </div>
                          ))}
                        </div>
                        <span style={{ color: C.textMuted, fontSize: 16, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
                      </div>
                    </div>
                    {expanded && (
                      <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${C.border}` }}>
                        <div style={{ paddingTop: 14, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 14 }}>
                          {[
                            { label: "Technical", val: sa.technical_skill },
                            { label: "Communication", val: sa.communication },
                            { label: "Teamwork", val: sa.teamwork },
                            { label: "Leadership", val: sa.leadership },
                            { label: "Innovation", val: sa.innovation },
                          ].map(({ label, val }) => (
                            <div key={label} style={{ background: C.surface, borderRadius: 10, padding: "10px 12px", textAlign: "center", border: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                              <div style={{ fontSize: 18, fontWeight: 900, color: C.accent }}>{val}</div>
                              <div style={{ fontSize: 9, color: C.textMuted }}>/5</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {[
                            { key: "accomplishments", label: "Key Accomplishments", color: C.green },
                            { key: "challenges", label: "Challenges", color: C.amber },
                            { key: "learnings", label: "Key Learnings", color: C.accent },
                            { key: "next_goals", label: "Next Period Goals", color: C.purple },
                          ].map(({ key, label, color }) => sa[key] && (
                            <div key={key} style={{ background: color + "0d", border: `1px solid ${color}22`, borderRadius: 10, padding: "12px 14px" }}>
                              <div style={{ fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                              <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, margin: 0 }}>{sa[key]}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ FEEDBACK TAB ══ */}
      {tab === "feedback" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <EmpSelector />
            <Btn onClick={() => { setEditFb(null); setFbForm({ ...emptyFb, employeeId: selEmp || "" }); setFbModal(true); }}>+ Add Feedback</Btn>
          </div>
          {!selEmp ? <NoEmpBanner /> : fbLoading ? <Spinner /> : feedbacks.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 40, textAlign: "center", color: C.textMuted }}>No feedback for this employee yet.</div>
          ) : feedbacks.map(fb => (
            <div key={fb.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", background: expandedFb === fb.id ? C.surface : "transparent" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: C.purple + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: C.purple, flexShrink: 0 }}>
                  {(fb.manager_name || "?").split(" ").map(w => w[0]).join("").slice(0,2)}
                </div>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpandedFb(expandedFb === fb.id ? null : fb.id)}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>By {fb.manager_name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{fb.cycle_name || fb.period || "—"} · {fb.feedback_date?.slice(0,10) || ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div><Stars n={fb.overall_rating} /><div style={{ fontSize: 10, color: C.textMuted, textAlign: "right" }}>{fb.overall_rating}/5</div></div>
                  <button onClick={() => { setEditFb(fb); setFbForm({ employeeId: fb.employee_id, reviewCycleId: fb.review_cycle_id || "", period: fb.period || "", feedbackDate: fb.feedback_date?.slice(0,10) || "", overallRating: fb.overall_rating, strengths: fb.strengths || "", areasToImprove: fb.areas_to_improve || "", managerComment: fb.manager_comment || "" }); setFbModal(true); }}
                    style={{ background: C.accent + "18", color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✏</button>
                  {(isAdmin || String(fb.manager_id) === String(currentUser?.employee_id)) && (
                    <button onClick={() => deleteFeedback(fb.id)} style={{ background: C.red + "18", color: C.red, border: `1px solid ${C.red}33`, borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>🗑</button>
                  )}
                  <span style={{ color: C.textMuted, fontSize: 16, cursor: "pointer" }} onClick={() => setExpandedFb(expandedFb === fb.id ? null : fb.id)}>▾</span>
                </div>
              </div>
              {expandedFb === fb.id && (
                <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 10, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ background: C.green + "0d", border: `1px solid ${C.green}22`, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, color: C.green, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>💪 Strengths</div>
                      <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, margin: 0 }}>{fb.strengths || "—"}</p>
                    </div>
                    <div style={{ background: C.amber + "0d", border: `1px solid ${C.amber}22`, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, color: C.amber, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>📈 Areas to Improve</div>
                      <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, margin: 0 }}>{fb.areas_to_improve || "—"}</p>
                    </div>
                  </div>
                  {fb.manager_comment && <div style={{ background: C.accent + "0d", border: `1px solid ${C.accent}22`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>💬 Comment</div>
                    <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>"{fb.manager_comment}"</p>
                  </div>}
                </div>
              )}
            </div>
          ))}
          {fbModal && (
            <Modal title={editFb ? "Edit Feedback" : "Add Manager Feedback"} onClose={() => setFbModal(false)}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Employee *</div>
                  <select value={fbForm.employeeId} onChange={e => setFbForm(p => ({ ...p, employeeId: e.target.value }))} style={selStyle}>
                    <option value="">— Select —</option>
                    {allEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Review Cycle</div>
                    <select value={fbForm.reviewCycleId} onChange={e => setFbForm(p => ({ ...p, reviewCycleId: e.target.value }))} style={selStyle}>
                      <option value="">— None —</option>
                      {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select></div>
                  <Inp label="Period (manual)" value={fbForm.period} onChange={v => setFbForm(p => ({ ...p, period: v }))} placeholder="e.g. Q1 2026" />
                </div>
                <Inp label="Feedback Date" type="date" value={fbForm.feedbackDate} onChange={v => setFbForm(p => ({ ...p, feedbackDate: v }))} />
                <div>
                  <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 8 }}>Overall Rating: {fbForm.overallRating}/5</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setFbForm(p => ({ ...p, overallRating: n }))}
                        style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: `1px solid ${n <= fbForm.overallRating ? "#F59E0B" : C.border}`, background: n <= fbForm.overallRating ? "#F59E0B22" : "transparent", color: n <= fbForm.overallRating ? "#F59E0B" : C.textMuted, fontSize: 18, cursor: "pointer" }}>★</button>
                    ))}
                  </div>
                </div>
                <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Strengths</div>
                  <textarea rows={2} value={fbForm.strengths} onChange={e => setFbForm(p => ({ ...p, strengths: e.target.value }))}
                    style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "9px 12px", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }} /></div>
                <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Areas to Improve</div>
                  <textarea rows={2} value={fbForm.areasToImprove} onChange={e => setFbForm(p => ({ ...p, areasToImprove: e.target.value }))}
                    style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "9px 12px", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }} /></div>
                <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Manager Comment</div>
                  <textarea rows={2} value={fbForm.managerComment} onChange={e => setFbForm(p => ({ ...p, managerComment: e.target.value }))}
                    style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "9px 12px", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }} /></div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <Btn variant="ghost" onClick={() => setFbModal(false)}>Cancel</Btn>
                  <Btn onClick={saveFeedback} disabled={fbSaving}>{fbSaving ? "Saving…" : editFb ? "Save" : "Add Feedback"}</Btn>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* ══ REVIEWS TAB ══ */}
      {tab === "reviews" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <EmpSelector />
            <Btn onClick={() => { setEditRev(null); setRevForm({ ...emptyRev, employeeId: selEmp || "" }); setRevModal(true); }}>+ Add Review</Btn>
          </div>
          {!selEmp ? <NoEmpBanner /> : revLoading ? <Spinner /> : reviews.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 40, textAlign: "center", color: C.textMuted }}>No reviews for this employee yet.</div>
          ) : reviews.map(r => (
            <div key={r.id} style={{ background: C.card, border: `1px solid ${r.status === "pending" ? C.amber + "55" : C.border}`, borderLeft: `4px solid ${r.status === "completed" ? C.green : C.amber}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: (r.status === "completed" ? C.green : C.amber) + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                  {r.status === "completed" ? "✅" : "⏳"}
                </div>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpandedRev(expandedRev === r.id ? null : r.id)}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{r.cycle_name || r.review_cycle || "—"}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{r.period && `${r.period} · `}Reviewer: {r.reviewer_name || "—"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {r.final_score && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 900, color: C.green }}>{r.final_score}</div><div style={{ fontSize: 9, color: C.textMuted }}>SCORE</div></div>}
                  {r.badge && <span style={{ background: C.green + "18", color: C.green, border: `1px solid ${C.green}33`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{r.badge}</span>}
                  {r.status === "pending" && <span style={{ background: C.amber + "18", color: C.amber, border: `1px solid ${C.amber}33`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>Pending</span>}
                  <button onClick={() => { setEditRev(r); setRevForm({ employeeId: r.employee_id, reviewCycleId: r.review_cycle_id || "", period: r.period || "", status: r.status, finalScore: r.final_score || "", badge: r.badge || "", reviewDate: r.review_date?.slice(0,10) || "", notes: r.notes || "" }); setRevModal(true); }}
                    style={{ background: C.accent + "18", color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✏</button>
                  {isAdmin && <button onClick={() => deleteReview(r.id)} style={{ background: C.red + "18", color: C.red, border: `1px solid ${C.red}33`, borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>🗑</button>}
                  <span style={{ color: C.textMuted, fontSize: 16, cursor: "pointer" }} onClick={() => setExpandedRev(expandedRev === r.id ? null : r.id)}>▾</span>
                </div>
              </div>
            </div>
          ))}
          {revModal && (
            <Modal title={editRev ? "Edit Review" : "Add Review"} onClose={() => setRevModal(false)}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Employee *</div>
                  <select value={revForm.employeeId} onChange={e => setRevForm(p => ({ ...p, employeeId: e.target.value }))} style={selStyle}>
                    <option value="">— Select —</option>
                    {allEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select></div>
                <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Review Cycle *</div>
                  <select value={revForm.reviewCycleId} onChange={e => setRevForm(p => ({ ...p, reviewCycleId: e.target.value }))} style={selStyle}>
                    <option value="">— Select Cycle —</option>
                    {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
                <Inp label="Period" value={revForm.period} onChange={v => setRevForm(p => ({ ...p, period: v }))} placeholder="e.g. Jan–Mar 2026" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Status</div>
                    <select value={revForm.status} onChange={e => setRevForm(p => ({ ...p, status: e.target.value }))} style={selStyle}>
                      <option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="completed">Completed</option>
                    </select></div>
                  <Inp label="Review Date" type="date" value={revForm.reviewDate} onChange={v => setRevForm(p => ({ ...p, reviewDate: v }))} />
                </div>
                {revForm.status === "completed" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Inp label="Final Score" value={revForm.finalScore} onChange={v => setRevForm(p => ({ ...p, finalScore: v }))} placeholder="e.g. 4.2" />
                    <Inp label="Rating Badge" value={revForm.badge} onChange={v => setRevForm(p => ({ ...p, badge: v }))} placeholder="e.g. Exceeds Expectations" />
                  </div>
                )}
                <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Notes</div>
                  <textarea rows={3} value={revForm.notes} onChange={e => setRevForm(p => ({ ...p, notes: e.target.value }))}
                    style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "9px 12px", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }} /></div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <Btn variant="ghost" onClick={() => setRevModal(false)}>Cancel</Btn>
                  <Btn onClick={saveReview} disabled={revSaving}>{revSaving ? "Saving…" : editRev ? "Save" : "Create Review"}</Btn>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* ══ REVIEW CYCLES TAB ══ */}
      {tab === "cycles" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Review Cycles ({cycles.length})</span>
            <Btn onClick={() => { setEditCycle(null); setCycleForm(emptyCycle); setCycleModal(true); }}>+ New Cycle</Btn>
          </div>
          {cyclesLoading ? <Spinner /> : cycles.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 48, textAlign: "center", color: C.textMuted }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🗓</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>No cycles yet</div>
              <p style={{ fontSize: 13, margin: 0 }}>Create a cycle like "Q1 2026" to start assigning reviews.</p>
            </div>
          ) : cycles.map(c => (
            <div key={c.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>🗓</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{c.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{c.start_date?.slice(0,10)} → {c.end_date?.slice(0,10)}</div>
              </div>
              <span style={{ background: c.status === "active" ? C.green + "18" : C.textMuted + "18", color: c.status === "active" ? C.green : C.textMuted, border: `1px solid ${c.status === "active" ? C.green : C.textMuted}33`, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                {c.status === "active" ? "Active" : "Closed"}
              </span>
              <button onClick={() => { setEditCycle(c); setCycleForm({ name: c.name, startDate: c.start_date?.slice(0,10) || "", endDate: c.end_date?.slice(0,10) || "", status: c.status }); setCycleModal(true); }}
                style={{ background: C.accent + "18", color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: 6, padding: "5px 9px", fontSize: 12, cursor: "pointer" }}>✏</button>
              {isAdmin && <button onClick={() => deleteCycle(c.id)} style={{ background: C.red + "18", color: C.red, border: `1px solid ${C.red}33`, borderRadius: 6, padding: "5px 9px", fontSize: 12, cursor: "pointer" }}>🗑</button>}
            </div>
          ))}
          {cycleModal && (
            <Modal title={editCycle ? "Edit Cycle" : "New Review Cycle"} onClose={() => setCycleModal(false)}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Inp label="Cycle Name *" value={cycleForm.name} onChange={v => setCycleForm(p => ({ ...p, name: v }))} placeholder="e.g. Q1 2026" required />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Inp label="Start Date" type="date" value={cycleForm.startDate} onChange={v => setCycleForm(p => ({ ...p, startDate: v }))} />
                  <Inp label="End Date" type="date" value={cycleForm.endDate} onChange={v => setCycleForm(p => ({ ...p, endDate: v }))} />
                </div>
                <div><div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6 }}>Status</div>
                  <select value={cycleForm.status} onChange={e => setCycleForm(p => ({ ...p, status: e.target.value }))} style={selStyle}>
                    <option value="active">Active</option><option value="closed">Closed</option>
                  </select></div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <Btn variant="ghost" onClick={() => setCycleModal(false)}>Cancel</Btn>
                  <Btn onClick={saveCycle} disabled={cycleSaving}>{cycleSaving ? "Saving…" : editCycle ? "Save" : "Create Cycle"}</Btn>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}



const ADMIN_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "project_management", label: "Project Mgmt (Client)", icon: "📊" },
  { id: "people", label: "Employees & Resources", icon: "👥" },
  { id: "performance", label: "Performance Management", icon: "🎯" },
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
  "/* Consistent dropdown chevron (replaces the native arrow that hugs the edge) */",
  "select:not([multiple]):not([size]) { -webkit-appearance: none !important; -moz-appearance: none !important; appearance: none !important; background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\") !important; background-repeat: no-repeat !important; background-position: right 12px center !important; background-size: 14px 14px !important; padding-right: 36px !important; text-overflow: ellipsis; cursor: pointer; }",
  "select:not([multiple]):not([size]):disabled { cursor: not-allowed; }",
  "select::-ms-expand { display: none; }",
  "input[type='date'], input[type='time'], input[type='datetime-local'] { color-scheme: var(--color-scheme, dark); }",
  ".dark-mode input[type='date']::-webkit-calendar-picker-indicator, .dark-mode input[type='time']::-webkit-calendar-picker-indicator, .dark-mode input[type='datetime-local']::-webkit-calendar-picker-indicator { filter: brightness(0) invert(1) !important; opacity: 1 !important; cursor: pointer; }",
  "::-webkit-scrollbar { width: 4px; height: 4px; }",
  "::-webkit-scrollbar-track { background: transparent; }",
  "::-webkit-scrollbar-thumb { background: var(--c-border); border-radius: 4px; }",
  "@keyframes spin { to { transform: rotate(360deg); } }",
  /* ── Root layout ── */
  ".app-root { display: flex; flex-direction: column; min-height: 100vh; }",
  /* ── Header ── */
  ".app-header { position: fixed; top: 0; left: 0; right: 0; height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px 0 14px; z-index: 300; }",
  ".burger-btn { background: none; border: 1px solid var(--c-border); color: var(--c-text); border-radius: 8px; padding: 6px 10px; font-size: 18px; cursor: pointer; line-height: 1; display: flex; align-items: center; flex-shrink: 0; }",
  ".burger-btn:hover { background: rgba(128,128,128,0.12); }",
  /* ── Body (sidebar + main) ── */
  ".app-body { display: flex; flex: 1; padding-top: 56px; }",
  /* ── Sidebar ── */
  ".app-nav { width: 240px; flex-shrink: 0; display: flex; flex-direction: column; position: fixed; top: 56px; left: 0; height: calc(100vh - 56px); transition: width 0.28s cubic-bezier(0.4,0,0.2,1); z-index: 200; overflow-y: auto; overflow-x: hidden; background: var(--c-nav); box-shadow: 1px 0 0 var(--c-border), 8px 0 24px rgba(0,0,0,0.18); }",
  ".app-nav.nav-closed { width: 56px; }",
  /* ── Nav section label ── */
  ".nav-section { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--c-nav-section); padding: 16px 16px 6px; white-space: nowrap; }",
  ".app-nav.nav-closed .nav-section { display: none; }",
  /* ── Nav items ── */
  ".nav-item { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; border: none; cursor: pointer; text-align: left; margin-bottom: 2px; font-size: 13px; font-weight: 500; transition: background 0.18s ease, color 0.18s ease, width 0.28s, margin 0.28s, padding 0.28s; color: var(--c-nav-item); background: transparent; outline: none; white-space: nowrap; }",
  ".nav-item:hover { background: rgba(59,130,246,0.07); color: var(--c-nav-hover); }",
  ".nav-item.active { background: linear-gradient(135deg,rgba(59,130,246,0.18) 0%,rgba(59,130,246,0.08) 100%); color: #3B82F6; font-weight: 650; box-shadow: inset 0 0 0 1px rgba(59,130,246,0.18); }",
  /* Collapsed: fixed 36px square, auto-centered */
  ".app-nav.nav-closed .nav-item { width: 36px; height: 36px; padding: 0; margin: 0 auto 4px; justify-content: center; gap: 0; border-radius: 10px; }",
  ".nav-label { flex: 1; }",
  ".app-nav.nav-closed .nav-label { display: none; }",
  /* ── Nav items wrapper ── */
  ".nav-items-wrap { flex: 1; overflow-y: auto; padding: 4px 8px; }",
  ".app-nav.nav-closed .nav-items-wrap { padding: 8px 0; }",
  /* ── Nav icon ── */
  ".nav-icon { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 16px; flex-shrink: 0; transition: background 0.18s; }",
  ".nav-item.active .nav-icon { background: rgba(59,130,246,0.15); }",
  ".nav-item:hover:not(.active) .nav-icon { background: rgba(255,255,255,0.05); }",
  /* ── Role badge ── */
  ".nav-badge { display: flex; align-items: center; gap: 7px; border-radius: 8px; padding: 6px 12px; }",
  ".app-nav.nav-closed .nav-badge { justify-content: center; padding: 8px 0; }",
  ".nav-badge-text { font-size: 10px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; white-space: nowrap; }",
  ".app-nav.nav-closed .nav-badge-text { display: none; }",
  /* ── Main content ── */
  ".main-content { flex: 1; padding: 32px 36px; margin-left: 240px; transition: margin-left 0.28s cubic-bezier(0.4,0,0.2,1); min-height: calc(100vh - 56px - 44px); }",
  ".main-content.nav-closed { margin-left: 56px; }",
  /* ── Footer ── */
  ".app-footer { height: 44px; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; margin-left: 240px; transition: margin-left 0.28s cubic-bezier(0.4,0,0.2,1); }",
  ".app-footer.nav-closed { margin-left: 56px; }",
  /* ── Responsive utility classes ── */
  ".resp-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }",
  ".grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }",
  ".grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }",
  ".grid-2 { display: grid; grid-template-columns: 1fr 1fr; }",
  ".page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }",
  ".tab-bar { display: flex; gap: 4px; overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; }",
  "@media (max-width: 1199px) { .grid-4 { grid-template-columns: repeat(2,1fr) !important; } }",
  "@media (max-width: 1023px) { .grid-3 { grid-template-columns: repeat(2,1fr) !important; } .main-content { padding: 24px 20px; } }",
  "@media (max-width: 767px) {",
  "  .app-nav { width: 240px !important; transform: translateX(0); transition: transform 0.28s cubic-bezier(0.4,0,0.2,1) !important; }",
  "  .app-nav.nav-closed { transform: translateX(-240px) !important; width: 240px !important; }",
  "  .app-nav.nav-closed .nav-section { display: block !important; }",
  "  .app-nav.nav-closed .nav-label { display: inline !important; }",
  "  .app-nav.nav-closed .nav-item { width: 100% !important; height: auto !important; padding: 9px 12px !important; margin: 0 0 2px 0 !important; justify-content: flex-start !important; gap: 10px !important; }",
  "  .app-nav.nav-closed .nav-items-wrap { padding: 4px 8px !important; }",
  "  .app-nav.nav-closed .nav-badge { justify-content: flex-start !important; padding: 6px 12px !important; }",
  "  .app-nav.nav-closed .nav-badge-text { display: inline !important; }",
  "  .main-content { margin-left: 0 !important; padding: 20px 14px 24px; }",
  "  .app-footer { margin-left: 0 !important; }",
  "  .grid-3 { grid-template-columns: 1fr !important; }",
  "  .grid-4 { grid-template-columns: repeat(2,1fr) !important; }",
  "  .grid-2 { grid-template-columns: 1fr !important; }",
  "  .page-header { flex-direction: column; align-items: flex-start; }",
  "  .page-header > * { width: 100%; }",
  "  .page-header > button, .page-header > div > button { width: auto !important; }",
  "  .resp-table-wrap table { min-width: 600px; }",
  "  h2 { font-size: 18px !important; }",
  "  .recharts-wrapper { font-size: 11px; }",
  "  .modal-body { padding: 20px 16px !important; }",
  "  .tab-bar { flex-wrap: wrap !important; }",
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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("pp_theme") !== "light");
  const [page, setPage] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);

  // Apply theme tokens before render
  Object.assign(C, darkMode ? DARK : LIGHT);

  // CSS variables string for class-based styles
  const themeVars = `
    :root {
      --c-border: ${C.border};
      --c-text: ${C.text};
      --c-nav: ${(darkMode ? DARK : LIGHT)._nav};
      --c-nav-section: ${(darkMode ? DARK : LIGHT)._navSection};
      --c-nav-item: ${(darkMode ? DARK : LIGHT)._navItem};
      --c-nav-hover: ${(darkMode ? DARK : LIGHT)._navHover};
      --color-scheme: ${darkMode ? "dark" : "light"};
    }
  `;

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("pp_theme", next ? "dark" : "light");
  }

  // Theme toggle button used in both headers
  const ThemeToggle = () => (
    <button onClick={toggleTheme} title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.textDim, padding: "5px 10px", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.2s" }}>
      {darkMode ? "☀" : "🌙"}
      <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>{darkMode ? "Light" : "Dark"}</span>
    </button>
  );
  const [portalTab, setPortalTab] = useState(null);
  const nav = (p) => { setPage(p); setNavOpen(false); };
  const navWithTab = (p, tab) => { if (tab) setPortalTab(tab); nav(p); };

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
    setPage(data.user.role === "admin" ? "dashboard" : "emp-dashboard");
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
      <style>{STYLE}</style>
      <style>{themeVars}</style>
      <div className={`app-root${darkMode ? " dark-mode" : ""}`} style={{ background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
        {/* ── Header ── */}
        <header className="app-header" style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="burger-btn" onClick={() => setNavOpen(v => !v)} aria-label="Toggle sidebar">
              {navOpen ? "✕" : "☰"}
            </button>
            <div style={{ background: darkMode ? "transparent" : "#0A0D14", borderRadius: 8, padding: darkMode ? 0 : "3px 10px", display: "flex", alignItems: "center" }}>
              <img src="/image.png" alt="Logo" style={{ height: 50, objectFit: "contain" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ThemeToggle />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar initials={currentUser.avatar || mkAvi(currentUser.emp_name || "")} color={C.accent} size={28} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{currentUser.emp_name || currentUser.username}</span>
            </div>
            <Btn variant="ghost" onClick={handleLogout} small style={{ fontSize: 12 }}>↩ Sign Out</Btn>
          </div>
        </header>
        {/* ── Body ── */}
        <div className="app-body">
          {/* Sidebar */}
          <nav className={`app-nav${navOpen ? "" : " nav-closed"}`}>
            <div className="nav-items-wrap" style={{ paddingTop: 10 }}>
              <div className="nav-section">Overview</div>
              <button onClick={() => nav("emp-dashboard")} title="Dashboard"
                className={`nav-item${page === "emp-dashboard" ? " active" : ""}`}>
                <span className="nav-icon">⊞</span>
                <span className="nav-label">Dashboard</span>
              </button>
              <div className="nav-section">My Portal</div>
              <button onClick={() => nav("employee-home")} title="My Portal"
                className={`nav-item${page === "employee-home" ? " active" : ""}`}>
                <span className="nav-icon">🏠</span>
                <span className="nav-label">My Portal</span>
              </button>
              <button onClick={() => nav("resumes")} title="Company Resume"
                className={`nav-item${page === "resumes" ? " active" : ""}`}>
                <span className="nav-icon">📑</span>
                <span className="nav-label">Company Resume</span>
              </button>
            </div>
          </nav>
          {/* Main */}
          <main className={`main-content${navOpen ? "" : " nav-closed"}`}>
            {page === "emp-dashboard" && <EmployeeDashboard currentUser={currentUser} navFn={navWithTab} />}
            {page === "employee-home" && <EmployeeHome currentUser={currentUser} defaultTab={portalTab} navFn={navWithTab} />}
            {page === "resumes" && <AdminCompanyResume />}
          </main>
        </div>
        {/* ── Footer ── */}
        <footer className={`app-footer${navOpen ? "" : " nav-closed"}`} style={{ background: "#0D1119", borderTop: `1px solid ${C.border}`, color: C.textMuted }}>
          © {new Date().getFullYear()} FascinateIT · All rights reserved
        </footer>
      </div>
    </>
  );

  return (
    <><DialogProvider />
      <style>{STYLE}</style>
      <style>{themeVars}</style>
      <div className={`app-root${darkMode ? " dark-mode" : ""}`} style={{ background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
        {/* ── Header ── */}
        <header className="app-header" style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="burger-btn" onClick={() => setNavOpen(v => !v)} aria-label="Toggle sidebar">
              {navOpen ? "✕" : "☰"}
            </button>
            <div style={{ background: darkMode ? "transparent" : "#0A0D14", borderRadius: 8, padding: darkMode ? 0 : "3px 10px", display: "flex", alignItems: "center" }}>
              <img src="/image.png" alt="Logo" style={{ height: 34, objectFit: "contain" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ThemeToggle />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar initials={currentUser.avatar || mkAvi(currentUser.emp_name || "")} color={currentUser.role === "manager" ? C.green : C.purple} size={28} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{currentUser.emp_name || currentUser.username}</div>
                <div style={{ fontSize: 10, color: C.textMuted, textTransform: "capitalize" }}>{currentUser.role}</div>
              </div>
            </div>
            <Btn variant="ghost" onClick={handleLogout} small style={{ fontSize: 12 }}>↩ Sign Out</Btn>
          </div>
        </header>
        {/* ── Body ── */}
        <div className="app-body">
          {/* Sidebar */}
          <nav className={`app-nav${navOpen ? "" : " nav-closed"}`}>
            {/* Role badge */}
            <div style={{ padding: "12px 8px 4px" }}>
              {currentUser.role === "admin" && (
                <div className="nav-badge" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.22)" }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>🔑</span>
                  <span className="nav-badge-text" style={{ color: C.purple }}>Administrator</span>
                </div>
              )}
              {currentUser.role === "manager" && (
                <div className="nav-badge" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>📋</span>
                  <span className="nav-badge-text" style={{ color: C.green }}>Manager</span>
                </div>
              )}
            </div>
            {/* Nav items */}
            <div className="nav-items-wrap">
              {isManager && (
                <>
                  <div className="nav-section">Overview</div>
                  <button onClick={() => nav("emp-dashboard")} title="Dashboard" className={`nav-item${page === "emp-dashboard" ? " active" : ""}`}>
                    <span className="nav-icon">⊞</span><span className="nav-label">Dashboard</span>
                  </button>
                  <div className="nav-section">My Portal</div>
                  <button onClick={() => nav("mywork")} title="My Work" className={`nav-item${page === "mywork" ? " active" : ""}`}>
                    <span className="nav-icon">🏠</span><span className="nav-label">My Work</span>
                  </button>
                </>
              )}
              <div className="nav-section">Navigation</div>
              {ADMIN_NAV.filter(n =>
                isManager ? ["attendance", "documents", "resumes"].includes(n.id) : true
              ).map(n => (
                <button key={n.id} onClick={() => nav(n.id)} title={n.label} className={`nav-item${page === n.id ? " active" : ""}`}>
                  <span className="nav-icon">{n.icon}</span>
                  <span className="nav-label">{n.label}</span>
                </button>
              ))}
            </div>
          </nav>
          {/* Main */}
          <main className={`main-content${navOpen ? "" : " nav-closed"}`}>
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
            {page === "performance" && <PerformanceManagement currentUser={currentUser} />}
            {page === "compensation" && currentUser.role === "admin" && <CompensationDetails />}
            {page === "infra" && currentUser.role === "admin" && <AdminAssets />}
            {page === "emp-dashboard" && isManager && <EmployeeDashboard currentUser={currentUser} navFn={navWithTab} />}
            {page === "mywork" && <EmployeeHome currentUser={currentUser} defaultTab={portalTab} navFn={navWithTab} />}
          </main>
        </div>
        {/* ── Footer ── */}
        <footer className={`app-footer${navOpen ? "" : " nav-closed"}`} style={{ background: "#0D1119", borderTop: `1px solid ${C.border}`, color: C.textMuted }}>
          © {new Date().getFullYear()} FascinateIT · All rights reserved
        </footer>
      </div>
    </>
  );
}
