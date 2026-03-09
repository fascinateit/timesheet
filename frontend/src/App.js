// src/App.js  –  ProjectPulse (API-connected)
import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
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
const Modal = ({ title, onClose, children }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20
  }} onClick={onClose}>
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28,
      width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto"
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [saving, setSaving] = useState(false);

  // List Filters
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [inv, prj] = await Promise.all([api.getInvoices(), api.getProjects()]);
      setInvoices(inv); setProjects(prj);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  });
  useEffect(() => { load(); }, []);

  async function handleToggleStatus(inv) {
    const newStatus = inv.status === "pending" ? "cleared" : "pending";
    try {
      await api.updateInvoiceStatus(inv.id, newStatus);
      await load();
    } catch (e) { alert(e.message); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this invoice?")) return;
    try {
      await api.deleteInvoice(id);
      await load();
    } catch (e) { alert(e.message); }
  }

  function handleDownloadCSV(filteredInvoices) {
    if (!filteredInvoices.length) return alert("No invoices to export.");
    const headers = ["Project Code", "Project Name", "Task / Deliverables", "Amount Raised (INR)", "Date Raised", "Next Invoice Date", "Clearance Status"];
    const rows = filteredInvoices.map(inv => [
      inv.project_code,
      `"${inv.project_name.replace(/"/g, '""')}"`,
      `"${inv.task_details.replace(/"/g, '""')}"`,
      inv.amount,
      inv.raised_date,
      inv.next_invoice_date || "",
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Project Management & Ledger</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Monitor client budgets & track company expenses or invoices</p></div>
        {!readOnly && tab === "invoices" && <Btn onClick={() => setModal(true)}>+ Raise Invoice</Btn>}
        {!readOnly && tab === "company_expenses" && <Btn onClick={() => setModal("newExpense")}>+ Add Expense</Btn>}
      </div>

      <div style={{ display: "flex", gap: 4, background: C.surface, padding: 4, borderRadius: 10, width: "fit-content", overflowX: "auto" }}>
        {["dashboard", "invoices", "company_expenses"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? C.card : "transparent", color: tab === t ? C.text : C.textMuted,
            border: tab === t ? `1px solid ${C.border}` : "1px solid transparent",
            borderRadius: 8, padding: "6px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize"
          }}>{t === "dashboard" ? "Dashboard" : t === "company_expenses" ? "Company Expenses" : "Client Budgets & Invoiced"}</button>
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
                      <Th>Next Invoice</Th>
                      <Th>Clearance Status</Th>
                      {!readOnly && <Th>Action</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <Td>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{inv.project_name}</div>
                          <div style={{ fontSize: 11, color: C.accent }}>{inv.project_code}</div>
                        </Td>
                        <Td>
                          <div style={{ fontSize: 13, color: C.textMuted, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inv.task_details}</div>
                        </Td>
                        <Td>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt$(inv.amount)}</div>
                        </Td>
                        <Td><div style={{ fontSize: 13, color: C.textMuted }}>{fmtD(inv.raised_date)}</div></Td>
                        <Td><div style={{ fontSize: 13, color: C.textMuted }}>{inv.next_invoice_date ? fmtD(inv.next_invoice_date) : "—"}</div></Td>
                        <Td>
                          <Badge color={inv.status === "cleared" ? C.green : C.amber}>
                            {inv.status}
                          </Badge>
                        </Td>
                        {!readOnly && (
                          <Td>
                            <div style={{ display: "flex", gap: 6, float: "right" }}>
                              <Btn small variant={inv.status === "pending" ? "success" : "ghost"}
                                onClick={() => handleToggleStatus(inv)}>
                                {inv.status === "pending" ? "Mark Cleared" : "Mark Pending"}
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

      {modal && (
        <Modal title={modal === "edit" ? "Edit Invoice" : "Raise New Invoice"} onClose={() => { setModal(false); setEditInvoice(null); }}>
          <InvoiceForm
            projects={projects}
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
              } catch (e) { alert(e.message); } finally { setSaving(false); }
            }}
          />
        </Modal>
      )}

      {tab === "company_expenses" && (
        <CompanyExpenses modal={modal} setModal={setModal} currentUser={currentUser} projects={projects} />
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
  const [filterStatus, setFilterStatus] = useState("all");
  const [chartOffset, setChartOffset] = useState(0);

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
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      await api.deleteCompanyExpense(id);
      await load();
    } catch (e) { alert(e.message); }
  }

  async function handleToggleStatus(id, newStatus) {
    try {
      await api.updateCompanyExpenseStatus(id, newStatus);
      await load();
    } catch (e) { alert(e.message); }
  }

  function handleDownloadCSV() {
    if (!filteredList || !filteredList.length) return alert("No company expenses to export.");
    const headers = ["Expense Date", "Purpose", "Amount (INR)", "GST Amount (INR)", "Paid By", "ITR Type", "Tax Type", "Status"];
    const rows = filteredList.map(e => {
      // Parse strictly as dd-mm-yyyy per requirements
      const [yr, mo, da] = (e.expense_date || "").split("-");
      const fmtDate = yr && mo && da ? `${da}-${mo}-${yr}` : e.expense_date;
      return [
        fmtDate,
        `"${(e.purpose || "").replace(/"/g, '""')}"`,
        e.amount,
        e.gst_amount || 0,
        `"${(e.paid_by || "").replace(/"/g, '""')}"`,
        e.itr_type || "",
        e.tax_type || "",
        e.status.toUpperCase()
      ];
    });
    const csvStr = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvStr], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `company-expenses-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Spinner />;

  const totalExpenses = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

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
  const filteredList = expenses.filter(e => {
    if (filterMonth !== "all" && !e.expense_date?.startsWith(filterMonth)) return false;
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    return true;
  });
  const filteredTotal = filteredList.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const chartData = last6Months.map(m => {
    const amt = expenses.filter(e => e.expense_date?.startsWith(m)).reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    return { name: new Date(m + "-01T12:00:00").toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), amount: amt };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Card>
          <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 700, letterSpacing: .5 }}>TOTAL EXPENSES (ALL TIME)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 8 }}>{fmt$(totalExpenses)}</div>
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 700, letterSpacing: .5 }}>FILTERED EXPENSES</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 8 }}>{fmt$(filteredTotal)}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", outline: "none", fontSize: 13 }}>
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="cleared">Cleared</option>
                <option value="sent to auditing">Sent to Auditing</option>
              </select>
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", outline: "none", fontSize: 13 }}>
                <option value="all">All Months</option>
                {monthOptions.map(m => <option key={m} value={m}>{new Date(m + "-01T12:00:00").toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</option>)}
              </select>
            </div>
          </div>
        </Card>
      </div>


      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
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
                  <Th>Paid By</Th>
                  <Th>ITR / Tax Type</Th>
                  <Th>GST Amount</Th>
                  <Th>Status</Th>
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
                      <Td><div style={{ fontSize: 13, color: C.textMuted }}>{exp.paid_by}</div></Td>
                      <Td>
                        <div style={{ fontSize: 13, color: C.text }}>{exp.itr_type || "—"}</div>
                        <div style={{ fontSize: 11, color: C.accent }}>{exp.tax_type || "—"}</div>
                      </Td>
                      <Td><div style={{ fontSize: 13, color: C.textMuted }}>{fmt$(exp.gst_amount || 0)}</div></Td>
                      <Td>
                        <Badge color={exp.status === "cleared" ? C.green : exp.status === "sent to auditing" ? C.purple : C.amber}>
                          {exp.status}
                        </Badge>
                      </Td>
                      <Td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(!exp.paid_by?.toUpperCase().includes('FIT') && exp.status !== "sent to auditing") && (
                            <Btn small variant="outline" onClick={() => { setEditObj(exp); setModal("generateExpense"); }}>Generate Exp</Btn>
                          )}
                          {exp.status === "pending" && (
                            <Btn small variant="success" onClick={() => handleToggleStatus(exp.id, "cleared")}>Mark Cleared</Btn>
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
                alert("Employee expense drafted & submitted for approval!");
              } catch (ex) { alert(ex.message); }
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Expense Date *" type="date" value={form.expenseDate} onChange={v => setForm({ ...form, expenseDate: v })} required />
              <Inp label="Paid By *" value={form.paidBy} onChange={v => setForm({ ...form, paidBy: v })} placeholder="e.g. Corporate Card, Arjun" required />
            </div>

            <Inp label="Purpose *" value={form.purpose} onChange={v => setForm({ ...form, purpose: v })} placeholder="e.g. AWS Hosting, Office Supplies" required />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Net Amount *" type="number" step="0.01" value={form.amount} onChange={v => setForm({ ...form, amount: v })} required />
              <Inp label="GST Amount" type="number" step="0.01" value={form.gstAmount} onChange={v => setForm({ ...form, gstAmount: v })} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

function InvoiceForm({ projects, initialData, saving, onCancel, onSave }) {
  const parseDate = d => {
    if (!d) return "";
    try { return new Date(d).toISOString().slice(0, 10); } catch (e) { return ""; }
  };
  const [form, setForm] = useState(initialData ? {
    project_id: initialData.project_id,
    amount: initialData.amount,
    task_details: initialData.task_details,
    raised_date: parseDate(initialData.raised_date),
    next_invoice_date: parseDate(initialData.next_invoice_date),
    status: initialData.status
  } : { project_id: "", amount: "", task_details: "", raised_date: new Date().toISOString().slice(0, 10), next_invoice_date: "", status: "pending" });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Inp label="Software Project (Client)" value={form.project_id} onChange={v => setForm(f => ({ ...f, project_id: v }))}
        options={projects.map(p => ({ value: p.id, label: `${p.code} - ${p.name}` }))} required />
      <Inp label="Amount to Raise (INR)" type="number" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} required />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>Task & Deliverables Details *</label>
        <textarea value={form.task_details} onChange={e => setForm(f => ({ ...f, task_details: e.target.value }))}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 13, minHeight: 80, outline: "none", resize: "vertical" }}
          required placeholder="Describe the software development tasks phase completed for this invoice..."
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Date Raised" type="date" value={form.raised_date} onChange={v => setForm(f => ({ ...f, raised_date: v }))} required />
        <Inp label="Next Invoice Reminder Date" type="date" value={form.next_invoice_date} onChange={v => setForm(f => ({ ...f, next_invoice_date: v }))} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={() => onSave(form)} disabled={saving}>{saving ? "Submitting…" : "Raise Invoice"}</Btn>
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
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: 20, position: "relative"
    }}>
      <div style={{
        position: "fixed", inset: 0, backgroundImage: `radial-gradient(${C.border} 1px,transparent 1px)`,
        backgroundSize: "32px 32px", opacity: .5, pointerEvents: "none"
      }} />
      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/image.png" alt="ProjectPulse Logo" style={{
            width: 120, height: 80, marginBottom: 8,
            objectFit: "contain"
          }} />
        </div>
        <Card style={{ padding: 32 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: C.text }}>Welcome back</h2>
          <p style={{ margin: "0 0 28px", fontSize: 13, color: C.textMuted }}>Sign in to your workspace</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Inp label="Username" value={username} onChange={setUsername} placeholder="Enter username" required />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600, letterSpacing: .4 }}>Password <span style={{ color: C.red }}>*</span></label>
              <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="Enter password"
                  style={{
                    width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                    color: C.text, padding: "8px 40px 8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box"
                  }} />
                <button onClick={() => setShowPass(v => !v)} style={{
                  position: "absolute", right: 10, top: "50%",
                  transform: "translateY(-50%)", background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 15
                }}>
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>
            {error && <div style={{
              background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 8,
              padding: "10px 14px", fontSize: 12, color: C.red
            }}>⚠ {error}</div>}
            <button onClick={handleSubmit} disabled={loading} style={{
              background: `linear-gradient(135deg,${C.accent},${C.accentDim})`, color: "#fff", border: "none",
              borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              marginTop: 4, opacity: loading ? .7 : 1, boxShadow: `0 4px 24px ${C.accent}33`
            }}>
              {loading ? "Authenticating…" : "Sign In →"}
            </button>
          </div>


        </Card>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════
function Dashboard() {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState("");
  const load = useCallback(async () => { setLoading(true); setErr(""); try { setData(await api.getDashboard()); } catch (e) { setErr(e.message); } finally { setLoading(false); } });
  useEffect(() => { load(); }, []);
  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;
  const { projects = [], total_budget = 0, total_burned = 0, pending_timesheets = 0, pending_leaves = 0 } = data || {};
  const stats = [
    { label: "Total Budget", value: fmt$(total_budget), sub: "Across all projects", icon: "💰", color: C.accent },
    { label: "Budget Burned", value: fmt$(total_burned), sub: `${total_budget ? ((total_burned / total_budget) * 100).toFixed(1) : 0}% utilized`, icon: "🔥", color: C.amber },
    { label: "Active Projects", value: projects.filter(p => p.status === "active").length, sub: `${projects.length} total`, icon: "🚀", color: C.green },
    { label: "Pending Reviews", value: pending_timesheets + pending_leaves, sub: `${pending_timesheets} ts · ${pending_leaves} leaves`, icon: "⏳", color: C.purple },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Overview</h2>
        <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Real-time project & budget snapshot</p></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
        {stats.map(s => (
          <Card key={s.label} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ fontSize: 26 }}>{s.icon}</div>
            <div><div style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: -.5 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: C.text, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{s.sub}</div></div>
          </Card>
        ))}
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
              } catch (e) { alert(e.message); } finally { setSaving(false); }
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
      if (isNewEmp) await api.createEmployee({ ...form, groupId: form.groupId ? +form.groupId : null });
      else await api.updateEmployee(modal.id, { ...form, groupId: form.groupId ? +form.groupId : null });
      setModal(null); await load();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  }

  async function saveGrp(form) {
    if (!form.name || !form.hourlyRate) return;
    setSaving(true);
    try {
      if (isNewGrp) await api.createGroup({ ...form, hourlyRate: +form.hourlyRate });
      else await api.updateGroup(modal.id, { ...form, hourlyRate: +form.hourlyRate });
      setModal(null); await load();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  }

  async function openAssign(emp) {
    try { const ids = await api.getEmployeeProjects(emp.id); setAssignedIds(ids); setAssignModal(emp); }
    catch (e) { alert(e.message); }
  }
  async function saveAssign() {
    setSaving(true);
    try { await api.updateEmployeeProjects(assignModal.id, assignedIds); setAssignModal(null); }
    catch (e) { alert(e.message); } finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Resources</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Manage employees &amp; billing groups</p></div>
        {!readOnly && (
          <Btn onClick={() => setModal(tab === "employees" ? { type: "emp" } : { type: "grp" })}>
            + {tab === "employees" ? "Add Employee" : "Add Group"}
          </Btn>
        )}
      </div>
      <div style={{ display: "flex", gap: 4, background: C.surface, padding: 4, borderRadius: 10, width: "fit-content" }}>
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
                  {!readOnly && <Btn small variant="ghost" onClick={() => setModal({ type: "emp", id: emp.id, name: emp.name, email: emp.email, groupId: emp.group_id || "", joiningDate: emp.joining_date || "", ctcAnnual: emp.ctc_annual || "" })}>✏ Edit</Btn>}
                  {!readOnly && <Btn small variant="ghost" onClick={() => openAssign(emp)}>🗂 Projects</Btn>}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>₹{emp.hourly_rate || 0}/hr</div>
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
          <EmpForm init={{ name: modal.name || "", email: modal.email || "", groupId: modal.groupId || "", joiningDate: modal.joiningDate || "", ctcAnnual: modal.ctcAnnual || "" }}
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Full Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
        <Inp label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} required type="email" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Group" value={form.groupId} onChange={v => setForm(f => ({ ...f, groupId: v }))} options={groups.map(g => ({ value: g.id, label: g.name }))} />
        <SearchableSelect label="Manager" value={form.managerId} onChange={v => setForm(f => ({ ...f, managerId: v }))} options={(employees || []).map(e => ({ value: e.id, label: e.name }))} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Annual CTC (₹)" type="number" value={form.ctcAnnual || ""} onChange={v => setForm(f => ({ ...f, ctcAnnual: v }))} placeholder="e.g. 1200000" />
        <Inp label="Variable Pay (₹)" type="number" value={form.variablePay || ""} onChange={v => setForm(f => ({ ...f, variablePay: v }))} placeholder="e.g. 200000" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Designation" value={form.designation || ""} onChange={v => setForm(f => ({ ...f, designation: v }))} placeholder="e.g. Software Engineer" />
        <Inp label="Location" value={form.location || ""} onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="e.g. Bangalore" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="PAN Number" value={form.panNumber || ""} onChange={v => setForm(f => ({ ...f, panNumber: v }))} placeholder="ABCDE1234F" />
        <Inp label="Joining Date" type="date" value={form.joiningDate || ""} onChange={v => setForm(f => ({ ...f, joiningDate: v }))} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Date of Birth" type="date" value={form.dob || ""} onChange={v => setForm(f => ({ ...f, dob: v }))} />
        <Inp label="Mobile" value={form.mobile || ""} onChange={v => setForm(f => ({ ...f, mobile: v }))} placeholder="+1 123 456 7890" />
      </div>
      <Inp label="Address" value={form.address || ""} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Full address..." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Bank Name" value={form.bankName || ""} onChange={v => setForm(f => ({ ...f, bankName: v }))} placeholder="e.g. Chase" />
        <Inp label="Account No" value={form.bankAccountNo || ""} onChange={v => setForm(f => ({ ...f, bankAccountNo: v }))} placeholder="1234567890" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
      const empId = viewOnly ? currentUser.employee_id : currentUser.employee_id;
      await api.createTimesheet({ employeeId: empId, projectId: +addRow.projectId, date: addRow.dayIso, hours: +addRow.hours, task: "" });
      setAddRow(null); await load();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Remove this entry?")) return;
    try { await api.deleteTimesheet(id); await load(); } catch (e) { alert(e.message); }
  }

  async function handleApprove(id) { try { await api.approveTimesheet(id); await load(); } catch (e) { alert(e.message); } }
  async function handleReject(id) { try { await api.rejectTimesheet(id); await load(); } catch (e) { alert(e.message); } }

  function handleDownloadCSV(filteredRows) {
    if (filteredRows.length === 0) return alert("No data to download.");
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={() => setWeekOf(d => addDays(d, -7))} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", color: C.textDim, cursor: "pointer", fontSize: 16 }}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
            {weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <button onClick={() => setWeekOf(d => addDays(d, 7))} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", color: C.textDim, cursor: "pointer", fontSize: 16 }}>›</button>
          <Btn small variant="ghost" onClick={() => setWeekOf(weekStart(new Date()))}>Today</Btn>
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
                      <div key={r.id} style={{ background: C.surface, borderRadius: 6, padding: "5px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${r.status === "approved" ? C.green + "44" : r.status === "rejected" ? C.red + "44" : C.border}` }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.project_code}</div>
                          {!viewOnly && <div style={{ fontSize: 10, color: C.textMuted }}>{r.employee_name}</div>}
                          <div style={{ fontSize: 10, color: C.textMuted }}>{r.hours}h · <span style={{ color: r.status === "approved" ? C.green : r.status === "rejected" ? C.red : C.amber }}>{r.status}</span></div>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          {!viewOnly && r.status === "pending" && (
                            <button onClick={() => handleDelete(r.id)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, padding: "0 2px", lineHeight: 1 }}>🗑</button>
                          )}
                          {viewOnly && r.status === "pending" && (
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
                        {myProjs.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                      </select>
                      <input type="number" value={addRow.hours || ""} onChange={e => setAddRow(r => ({ ...r, hours: e.target.value }))}
                        placeholder="Hours" min="0.5" max="24" step="0.5"
                        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: "4px 6px", fontSize: 11, width: "100%" }} />
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={handleAdd} disabled={saving} style={{ flex: 1, background: C.accent, border: "none", borderRadius: 5, color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 0", cursor: "pointer" }}>
                          {saving ? "…" : "Submit"}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
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

// ════════════════════════════════════════════════════════
// LEAVES
// ════════════════════════════════════════════════════════
function Leaves({ currentUser, viewOnly }) {
  const [rows, setRows] = useState([]); const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ employeeId: "", type: "Annual", startDate: "", endDate: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const params = {}; if (viewOnly) params.employee_id = currentUser.employee_id;
      const [lv, em] = await Promise.all([api.getLeaves(params), api.getEmployees()]);
      setRows(lv); setEmployees(em);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  });
  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!form.startDate || !form.endDate) return;
    setSaving(true);
    try {
      const empId = viewOnly ? currentUser.employee_id : +form.employeeId;
      await api.createLeave({ employeeId: empId, ...form });
      setModal(false); setForm({ employeeId: "", type: "Annual", startDate: "", endDate: "", reason: "" }); await load();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  }

  const summary = { total: rows.length, pending: rows.filter(l => l.status === "pending").length, approved: rows.filter(l => l.status === "approved").length };
  const cols = [...(!viewOnly ? ["Employee"] : []), "Type", "From", "To", "Reason", "Status", ...(!viewOnly ? ["Action"] : [])];

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>{viewOnly ? "My Leave" : "Leave Management"}</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>
            {viewOnly ? "View your time-off requests" : "Track all absences"}
          </p></div>
        <Btn onClick={() => setModal(true)}>+ Request Leave</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {[["Total", summary.total, C.accent], ["Pending", summary.pending, C.amber], ["Approved", summary.approved, C.green]].map(([l, v, col]) => (
          <Card key={l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: col }}>{v}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{l}</div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: C.surface }}><tr>{cols.map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {rows.map((l, idx) => (
                <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}22`, background: idx % 2 === 0 ? "transparent" : C.bg + "44" }}>
                  {!viewOnly && <Td><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar initials={l.avatar} color={l.group_color} size={28} />
                    <span style={{ fontSize: 13, color: C.text }}>{l.employee_name}</span>
                  </div></Td>}
                  <Td><Badge color={l.leave_type === "Annual" ? C.accent : C.red}>{l.leave_type}</Badge></Td>
                  <Td style={{ fontSize: 12, color: C.textDim }}>{fmtD(l.start_date)}</Td>
                  <Td style={{ fontSize: 12, color: C.textDim }}>{fmtD(l.end_date)}</Td>
                  <Td style={{ fontSize: 12, color: C.textDim, maxWidth: 180 }}>{l.reason}</Td>
                  <Td><StatusBadge status={l.status} /></Td>
                  {!viewOnly && <Td>{l.status === "pending" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn small variant="success" onClick={async () => { try { await api.approveLeave(l.id); await load(); } catch (e) { alert(e.message); } }}>✓</Btn>
                      <Btn small variant="danger" onClick={async () => { try { await api.rejectLeave(l.id); await load(); } catch (e) { alert(e.message); } }}>✕</Btn>
                    </div>
                  )}</Td>}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={cols.length} style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {modal && (
        <Modal title="Request Leave" onClose={() => setModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!viewOnly && <Inp label="Employee" value={form.employeeId} onChange={v => setForm(f => ({ ...f, employeeId: v }))} required options={employees.map(e => ({ value: e.id, label: e.name }))} />}
            {viewOnly && <div style={{ background: C.surface, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.textDim }}>
              Requesting as: <span style={{ color: C.text, fontWeight: 700 }}>{currentUser.emp_name}</span>
            </div>}
            <Inp label="Leave Type" value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))}
              options={["Annual", "Sick", "Unpaid", "Maternity", "Paternity"].map(t => ({ value: t, label: t }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Start Date" type="date" value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} required />
              <Inp label="End Date" type="date" value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} required />
            </div>
            <Inp label="Reason" value={form.reason} onChange={v => setForm(f => ({ ...f, reason: v }))} placeholder="Brief description…" />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
              <Btn onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Submit"}</Btn>
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
    catch (e) { alert(e.message); } finally { setSaving(false); }
  }

  async function toggleActive(id, current) {
    try { const acct = accounts.find(a => a.id === id); await api.updateAccount(id, { ...acct, active: !current }); await load(); }
    catch (e) { alert(e.message); }
  }

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>User Accounts</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Create and manage employee login credentials</p></div>
        <Btn onClick={() => setModal(true)}>+ Create Login</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
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
                    <Btn small variant="danger" onClick={async () => { if (window.confirm("Delete this account?")) try { await api.deleteAccount(a.id); await load(); } catch (e) { alert(e.message); } }}>🗑</Btn>
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
      alert("Profile updated successfully!");
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
      alert("Password updated successfully!");
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Card>
          <h4 style={{ margin: "0 0 16px", fontSize: 14, color: C.text, fontWeight: 800 }}>Organizational Details <span style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, marginLeft: 8 }}>(Read-Only)</span></h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Inp label="Full Name" value={profile.name} disabled />
            <Inp label="Email" value={profile.email} disabled />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Role / Group" value={profile.group_name || "—"} disabled />
              <Inp label="Manager" value={profile.manager_name || "—"} disabled />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Designation" value={profile.designation || "—"} disabled />
              <Inp label="Location" value={profile.location || "—"} disabled />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Joining Date" value={profile.joining_date ? fmtD(profile.joining_date) : "—"} disabled />
              <Inp label="Annual CTC" value={profile.ctc_annual ? `₹${Number(profile.ctc_annual).toLocaleString("en-IN")}` : "—"} disabled />
            </div>
          </div>
        </Card>

        <Card>
          <h4 style={{ margin: "0 0 16px", fontSize: 14, color: C.text, fontWeight: 800 }}>Personal Information</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Inp disabled={!isEditing} label="PAN Number" value={form.panNumber || profile.pan_number || ""} onChange={v => setForm(f => ({ ...f, panNumber: v }))} placeholder="ABCDE1234F" />
          <Inp disabled={!isEditing} label="Bank Name" value={form.bankName || ""} onChange={v => setForm(f => ({ ...f, bankName: v }))} placeholder="e.g. Chase" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Inp disabled={!isEditing} label="Account No" value={form.bankAccountNo || ""} onChange={v => setForm(f => ({ ...f, bankAccountNo: v }))} placeholder="1234567890" />
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
      <Card style={{ background: `linear-gradient(135deg,${C.accentDim}22,${C.card})`, border: `1px solid ${C.accent}33` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <Avatar initials={currentUser.avatar || mkAvi(currentUser.emp_name || "")} color={C.accent} size={54} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Welcome, {(currentUser.emp_name || currentUser.username).split(" ")[0]} 👋</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>Employee Portal</div>
            <div style={{ marginTop: 8 }}><Badge color={C.green}>{currentUser.role === "manager" ? "Manager" : currentUser.role === "admin" ? "Admin" : currentUser.role === "intras" ? "Intern" : "Employee"}</Badge></div>
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
  const origin = window.location.origin;

  useEffect(() => {
    api.getPayslips().then(ps => {
      setPayslips(ps);
      if (ps.length > 0) setSelected(ps[0]);
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const fmt = n => `₹${Number(n).toLocaleString("en-IN")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>My Pay</h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Monthly salary slips issued by your admin</p>
        </div>
        {payslips.length > 0 && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={selected?.id || ""} onChange={e => setSelected(payslips.find(p => p.id === +e.target.value))}
              style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 13, cursor: "pointer" }}>
              {payslips.map(p => (
                <option key={p.id} value={p.id}>{SLIP_MONTHS[p.month - 1]} {p.year}</option>
              ))}
            </select>
            {selected && <Btn onClick={() => printPayslipData(selected, origin)}>🖨 Download PDF</Btn>}
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
            {[["Monthly Gross", fmt(selected.gross), C.green], ["Basic Salary", fmt(selected.basic), C.accent],
            ["HRA", fmt(selected.hra), C.purple], ["Transport", fmt(selected.transport), C.amber],
            ["PF Deduction", fmt(selected.pf_employee), C.red], ["Net Pay", fmt(selected.net_pay), C.green]].map(([label, value, color]) => (
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Earnings</div>
                {[
                  ["Basic Salary", selected.basic], ["HRA", selected.hra],
                  ["Leave Travel Allowance", selected.leave_travel_allowance],
                  ["Special Allowance", selected.special_allowance],
                  ["Transport Allowance", selected.transport],
                  ["Medical Allowance", selected.medical_allowance],
                  ["Internet & Broadband Allowance", selected.internet_allowance],
                  ["Variable Pay", selected.variable_pay],
                  ["Bonus", selected.bonus]
                ].map(([k, v]) => Number(v) > 0 ? (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 13 }}>
                    <span style={{ color: C.textDim }}>{k}</span><span style={{ fontWeight: 600, color: C.text }}>{fmt(v)}</span>
                  </div>
                ) : null)}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 14, fontWeight: 800, color: C.green, borderTop: `2px solid ${C.border}44`, marginTop: 4 }}>
                  <span>Gross Salary</span><span>{fmt(selected.gross)}</span>
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
                    <span style={{ color: C.textDim }}>{k}</span><span style={{ fontWeight: 600, color: C.red }}>{fmt(v)}</span>
                  </div>
                ) : null)}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 14, fontWeight: 800, color: C.red, borderTop: `2px solid ${C.border}44`, marginTop: 4 }}>
                  <span>Total Deductions</span><span>{fmt(Number(selected.pf_employee) + Number(selected.professional_tax) + Number(selected.income_tax) + Number(selected.extra_deductions))}</span>
                </div>
              </div>
            </div>
            <div style={{ background: `linear-gradient(135deg,#1a234044,#2d3d6e44)`, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: "16px 24px", marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: C.textMuted }}>Net Pay for {SLIP_MONTHS[selected.month - 1]} {selected.year}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.green }}>{fmt(selected.net_pay)}</div>
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
                  <td style={{ padding: "11px 16px", fontSize: 13, color: C.green }}>{fmt(p.gross)}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: C.red }}>{fmt(Number(p.pf_employee) + Number(p.professional_tax))}</td>
                  <td style={{ padding: "11px 16px", fontSize: 14, fontWeight: 800, color: C.green }}>{fmt(p.net_pay)}</td>
                  <td style={{ padding: "11px 16px" }}><Btn small variant="ghost" onClick={e => { e.stopPropagation(); printPayslipData(p, origin); }}>🖨 Print</Btn></td>
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
      if (modal === "new") await api.createExpense({ ...form, employeeId: currentUser.employee_id });
      else await api.updateExpense(modal.id, form);
      setModal(null); await load();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  }
  async function handleDelete(id) {
    if (!window.confirm("Delete this expense?")) return;
    try { await api.deleteExpense(id); await load(); } catch (e) { alert(e.message); }
  }
  async function handleAction() {
    setSaving(true);
    try {
      if (noteModal.action === "approve") await api.approveExpense(noteModal.id);
      else if (noteModal.action === "pay") await api.payExpense(noteModal.id);
      else if (noteModal.action === "reject") await api.rejectExpense(noteModal.id, note);
      else await api.sendbackExpense(noteModal.id, note);
      setNoteModal(null); setNote(""); await load();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
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
            init={modal === "new" ? { title: "", amount: "", category: "Other", projectId: "", description: "" } :
              { title: modal.title, amount: modal.amount, category: modal.category, projectId: modal.project_id || "", description: modal.description || "" }}
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="Amount (INR) *" type="number" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} required />
        <Inp label="Category" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))}
          options={EXP_CATEGORIES.map(c => ({ value: c, label: c }))} />
      </div>
      <Inp label="Project (optional)" value={form.projectId} onChange={v => setForm(f => ({ ...f, projectId: v }))}
        options={projects.filter(p => !["closed", "completed"].includes(p.status)).map(p => ({ value: p.id, label: `${p.code} — ${p.name} ` }))} />
      <Inp label="Description" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Details…" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={() => {
          if (!form.title || !form.amount) return alert("Title and Amount are required");
          if (employees && form.employeeId === undefined) return alert("Please select an employee owning this expense.");
          onSave(form);
        }} disabled={saving}>{saving ? "Saving…" : btnLabel}</Btn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ADMIN EMPLOYEES TAB
// ════════════════════════════════════════════════════════
function AdminEmployees({ readOnly = false }) {
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
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  }

  if (loading) return <Spinner />;
  if (err) return <ErrBox msg={err} onRetry={load} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
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
              {["Employee", "Email", "Group", "Manager", "Joining Date", "CTC", "Actions"].map(h => <Th key={h}>{h}</Th>)}
            </tr></thead>
            <tbody>
              {employees.map((emp, idx) => {
                const grp = groups.find(g => g.id === emp.group_id);
                return (
                  <tr key={emp.id} style={{ borderBottom: `1px solid ${C.border} 22`, background: idx % 2 === 0 ? "transparent" : C.bg + "44" }}>
                    <Td><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar initials={emp.avatar} color={emp.group_color || C.accent} size={32} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{emp.name}</span>
                    </div></Td>
                    <Td style={{ fontSize: 12, color: C.textDim }}>{emp.email}</Td>
                    <Td>{grp ? <Badge color={grp.color}>{grp.name}</Badge> : <span style={{ color: C.textMuted, fontSize: 12 }}>—</span>}</Td>
                    <Td style={{ fontSize: 12, color: C.textDim }}>{emp.manager_name || "—"}</Td>
                    <Td style={{ fontSize: 12, color: C.textDim }}>{emp.joining_date ? fmtD(emp.joining_date) : <span style={{ color: C.textMuted }}>—</span>}</Td>
                    <Td style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{emp.ctc_annual ? `₹${Number(emp.ctc_annual).toLocaleString("en-IN")}` : <span style={{ color: C.textMuted, fontWeight: 400 }}>—</span>}</Td>
                    <Td><div style={{ display: "flex", gap: 6 }}>
                      <Btn small variant="secondary" onClick={() => setViewModal(emp)}>👁 View</Btn>
                      {!readOnly && <Btn small variant="ghost" onClick={() => setModal(emp)}>✏ Edit</Btn>}
                    </div></Td>
                  </tr>
                );
              })}
              {employees.length === 0 && <tr><td colSpan={readOnly ? 6 : 7} style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No employees found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create / Edit employee modal */}
      {!readOnly && modal && (
        <Modal title={modal === "new" ? "New Employee" : "Edit Employee"} onClose={() => setModal(null)}>
          <EmpForm
            init={modal === "new" ? { name: "", email: "", groupId: "", managerId: "", joiningDate: "", ctcAnnual: "", variablePay: "", designation: "", location: "", panNumber: "", dob: "", address: "", mobile: "", bankAccountNo: "", bankIfsc: "", bankName: "", skillset: "" } : { name: modal.name, email: modal.email, groupId: modal.group_id || "", managerId: modal.manager_id || "", joiningDate: modal.joining_date || "", ctcAnnual: modal.ctc_annual || "", variablePay: modal.variable_pay_amount || "", designation: modal.designation || "", location: modal.location || "", panNumber: modal.pan_number || "", dob: modal.dob || "", address: modal.address || "", mobile: modal.mobile || "", bankAccountNo: modal.bank_account_no || "", bankIfsc: modal.bank_ifsc || "", bankName: modal.bank_name || "", skillset: modal.skillset || "" }}
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
                <div style={{ fontSize: 13, color: C.textMuted }}>{viewModal.email}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                  {viewModal.group_name ? <Badge color={viewModal.group_color}>{viewModal.group_name}</Badge> : null}
                  {viewModal.designation && <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>• {viewModal.designation}</span>}
                  {viewModal.location && <span style={{ fontSize: 12, color: C.textDim }}>({viewModal.location})</span>}
                </div>
              </div>
            </div>

            <div style={{ background: C.surface, padding: 16, borderRadius: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600, fontFamily: "monospace" }}>{viewModal.bank_account_no || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>PAN Number</div>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600, fontFamily: "monospace" }}>{viewModal.pan_number || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Annual CTC</div>
                  <div style={{ fontSize: 14, color: C.green, fontWeight: 700 }}>{viewModal.ctc_annual ? `₹${Number(viewModal.ctc_annual).toLocaleString("en-IN")}` : "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Variable Pay</div>
                  <div style={{ fontSize: 14, color: C.amber, fontWeight: 700 }}>{viewModal.variable_pay_amount ? `₹${Number(viewModal.variable_pay_amount).toLocaleString("en-IN")}` : "—"}</div>
                </div>
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
                  <tr><td style="border: none;">Convey Allowance</td><td style="border: none;" class="right">${fmt(ps.transport)}</td></tr>
                  <tr><td style="border: none;">Medical Allowance</td><td style="border: none;" class="right">${fmt(ps.medical_allowance)}</td></tr>
                  <tr><td style="border: none;">Internet & Broadband<br>Allowance</td><td style="border: none;" class="right">${fmt(ps.internet_allowance)}</td></tr>
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
    usePf: false, pfAmount: "", useTds: false, tdsAmount: "", useVp: false, vpAmount: ""
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
        useVp: form.useVp, vpAmount: form.vpAmount
      });
      setMsg("✅ Payslip generated successfully!");
      await load();
    } catch (e) { setMsg(`❌ ${e.message}`); } finally { setGenerating(false); }
  }

  async function del(id) {
    if (!window.confirm("Delete this payslip?")) return;
    try { await api.deletePayslip(id); setPayslips(ps => ps.filter(p => p.id !== id)); } catch (e) { alert(e.message); }
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
            <input type="number" min="0" placeholder="Auto calculate 1/12th VP" value={form.vpAmount} disabled={!form.useVp}
              onChange={e => setForm(f => ({ ...f, vpAmount: e.target.value }))}
              style={{ ...inpStyle, opacity: form.useVp ? 1 : 0.5 }} />
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
              {["Employee", "Period", "Gross", "Bonus", "Deductions", "Net Pay", "Generated", ""].map(h => (
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
    try { setDocs(await api.getDocuments({ type })); } catch (e) { alert("Failed to fetch: " + e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [type]);

  async function save() {
    if (!modal.title || !modal.url) return alert("Title and URL required");
    setSaving(true);
    try {
      if (modal.id) await api.updateDocument(modal.id, { title: modal.title, url: modal.url, type });
      else await api.createDocument({ title: modal.title, url: modal.url, type });
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function del(id) {
    if (!window.confirm("Delete this document link?")) return;
    try { await api.deleteDocument(id); setDocs(ds => ds.filter(d => d.id !== id)); } catch (e) { alert(e.message); }
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

const ADMIN_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "project_management", label: "Project Mgmt (Client)", icon: "📊" },
  { id: "projects", label: "Projects", icon: "◈" },
  { id: "employees", label: "Employees", icon: "👥" },
  { id: "resources", label: "Resources", icon: "◉" },
  { id: "timesheets", label: "Timesheets", icon: "◷", badge: "ts" },
  { id: "leaves", label: "Leave", icon: "◌", badge: "lv" },
  { id: "expenses", label: "Expenses", icon: "💳" },
  { id: "payslips", label: "Payslips", icon: "💰" },
  { id: "reports", label: "Reports", icon: "◫" },
  { id: "useraccounts", label: "User Accounts", icon: "🔑" },
  { id: "documents", label: "Documents", icon: "📄" },
  { id: "policies", label: "Company Policy", icon: "📜" },
];

// ════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════
const STYLE = [
  "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');",
  "* { box-sizing: border-box; }",
  "input, select, button { font-family: inherit !important; }",
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
  ".mobile-top-bar { display: none; height: 52px; align-items: center; padding: 0 16px; position: sticky; top: 0; z-index: 100; }",
  "@media (max-width: 1023px) { .app-nav { width: 200px; } .emp-nav { width: 180px; } .main-content { padding: 24px 20px; max-width: calc(100vw - 200px); } .emp-main { padding: 24px 20px; } }",
  "@media (max-width: 767px) { .hamburger-btn { display: block; } .mobile-top-bar { display: flex; } .app-nav { position: fixed; top: 0; left: 0; height: 100vh; width: 240px !important; transform: translateX(-100%); box-shadow: 4px 0 24px rgba(0,0,0,0.5); } .app-nav.nav-open { transform: translateX(0); } .main-content { padding: 70px 14px 24px; max-width: 100vw; width: 100%; } .emp-main { padding: 70px 14px 24px; } }"
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

  async function handleLogin(username, password) {
    const data = await api.login(username, password);
    localStorage.setItem("pp_token", data.access_token);
    localStorage.setItem("pp_user", JSON.stringify(data.user));
    setCurrentUser(data.user);
    setPage(data.user.role === "admin" ? "dashboard" : "employee-home");
  }

  function handleLogout() {
    localStorage.removeItem("pp_token"); localStorage.removeItem("pp_user");
    setCurrentUser(null); setPage("dashboard");
  }

  if (!currentUser) return (<><style>{STYLE}</style><LoginPage onLogin={handleLogin} /></>);

  const isAdmin = currentUser.role === "admin" || currentUser.role === "manager";
  const isManager = currentUser.role === "manager";

  if (!isAdmin) return (
    <div className="app-layout" style={{ background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <style>{STYLE}</style>
      {/* Hamburger button */}
      <button className="hamburger-btn" onClick={() => setNavOpen(v => !v)}>☰</button>
      {/* Overlay */}
      <div className={`nav-overlay${navOpen ? " open" : ""}`} onClick={() => setNavOpen(false)} />
      <nav className={`app-nav emp-nav${navOpen ? " nav-open" : ""}`} style={{
        background: C.surface, borderRight: `1px solid ${C.border}`, padding: "24px 0"
      }}>
        <div style={{ padding: "0 16px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/image.png" alt="Logo" style={{ height: 60, objectFit: "contain" }} />
          </div>
        </div>
        <div style={{ padding: "14px 10px", flex: 1 }}>
          <button onClick={() => nav("employee-home")} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px",
            borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
            background: C.accentGlow, color: C.accent, fontWeight: 700, fontSize: 13,
            borderLeft: `2px solid ${C.accent}`
          }}>🏠 My Portal</button>
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
        <EmployeeHome currentUser={currentUser} />
      </main>
    </div>
  );

  return (
    <div className="app-layout" style={{ background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <style>{STYLE}</style>
      {/* Hamburger button */}
      <button className="hamburger-btn" onClick={() => setNavOpen(v => !v)}>☰</button>
      {/* Overlay */}
      <div className={`nav-overlay${navOpen ? " open" : ""}`} onClick={() => setNavOpen(false)} />
      <nav className={`app-nav${navOpen ? " nav-open" : ""}`} style={{
        background: C.surface, borderRight: `1px solid ${C.border}`, padding: "24px 0"
      }}>
        <div style={{ padding: "0 20px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/image.png" alt="Logo" style={{ height: 60, objectFit: "contain" }} />
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
            !(n.id === "useraccounts" && isManager) &&
            !(n.id === "payslips" && isManager) &&
            !(n.id === "project_management" && isManager)
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
        {page === "projects" && <Projects readOnly={isManager} />}
        {page === "employees" && <AdminEmployees readOnly={isManager} />}
        {page === "resources" && <Resources readOnly={isManager} />}
        {page === "timesheets" && <Timesheets currentUser={currentUser} viewOnly={false} />}
        {page === "leaves" && <Leaves currentUser={currentUser} viewOnly={false} />}
        {page === "expenses" && <Expenses currentUser={currentUser} viewOnly={false} />}
        {page === "payslips" && !isManager && <AdminPayslips />}
        {page === "reports" && <Reports />}
        {page === "useraccounts" && <UserAccounts />}
        {page === "documents" && <DocumentGrid type="document" allowEdit={isAdmin} />}
        {page === "policies" && <DocumentGrid type="policy" allowEdit={currentUser.role === "admin"} />}
        {page === "mywork" && <EmployeeHome currentUser={currentUser} />}
      </main>
    </div>
  );
}
