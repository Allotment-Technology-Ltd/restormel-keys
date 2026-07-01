import React, { useState } from "react";
import {
  Key, Workflow, FlaskConical, Share2, Search, ChevronRight, ChevronDown,
  Upload, FileText, ShieldCheck, Database, Check, CheckCircle2, AlertCircle,
  Info, Lock, Zap, Globe, Settings2, ArrowLeft, Ban, Boxes,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Wireframe for: ADR — Ingest Pipeline as a Connector Abstraction with a
// Tiered Verification Cascade. Shows the three simplicity tiers (Default /
// Presets / Plug-points) inside Connect, the real ingest product surface.
// Structural fidelity only — colours/type are a neutral wireframe register,
// not Restormel's actual brand, since the real dashboard isn't visible here.
// ---------------------------------------------------------------------------

const STEPS = [
  { id: "default", n: 1, label: "Default" },
  { id: "presets", n: 2, label: "Presets" },
  { id: "plugpoints", n: 3, label: "Plug-points" },
];

function AnnotationNote({ children }) {
  return (
    <div className="flex gap-2 items-start rounded border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
      <p>
        <span className="font-semibold uppercase tracking-wide mr-1">Wireframe note —</span>
        {children}
      </p>
    </div>
  );
}

function TrustBadge({ state }) {
  if (state === "supported") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Supported
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
      <AlertCircle className="h-3 w-3" /> Abstained — review
    </span>
  );
}

function Sidebar() {
  const items = [
    { label: "Keys", icon: Key, active: false },
    { label: "Connect", icon: Workflow, active: true },
    { label: "Testing", icon: FlaskConical, active: false, flagOff: true },
    { label: "Graph", icon: Share2, active: false, flagOff: true },
  ];
  return (
    <div className="w-56 flex-shrink-0 border-r border-slate-200 bg-white px-3 py-4 flex flex-col">
      <div className="px-2 mb-6">
        <p className="text-sm font-semibold text-slate-900 tracking-tight">restormel</p>
        <p className="text-xs text-slate-400">Route · Ingest · Verify</p>
      </div>
      <nav className="flex-1 space-y-1">
        {items.map(({ label, icon: Icon, active, flagOff }) => (
          <div
            key={label}
            className={
              "flex items-center justify-between rounded px-2 py-1.5 text-sm " +
              (active ? "bg-slate-900 text-white" : flagOff ? "text-slate-300" : "text-slate-600")
            }
          >
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {label}
            </span>
            {flagOff && (
              <span className="text-xs uppercase tracking-wide text-slate-300 border border-slate-200 rounded px-1">
                off
              </span>
            )}
          </div>
        ))}
      </nav>
      <div className="px-2 pt-4 border-t border-slate-100 flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-slate-200" />
        <span className="text-xs text-slate-500">workspace</span>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Connect</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-900 font-medium">Sources</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-xs text-slate-400">
          <Search className="h-3.5 w-3.5" /> Search sources
        </div>
        <div className="h-7 w-7 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

function Stepper({ view, setView }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <button
            onClick={() => setView(s.id)}
            className={
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 " +
              (view === s.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")
            }
          >
            <span
              className={
                "flex h-4 w-4 items-center justify-center rounded-full text-xs " +
                (view === s.id ? "bg-white text-slate-900" : "bg-slate-100 text-slate-500")
              }
            >
              {s.n}
            </span>
            {s.label}
          </button>
          {i < STEPS.length - 1 && <div className="h-px w-4 bg-slate-200" />}
        </React.Fragment>
      ))}
    </div>
  );
}

function DefaultView({ onCustomise }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
        <Upload className="mx-auto h-6 w-6 text-slate-400" />
        <p className="mt-2 text-sm font-medium text-slate-700">Connect a source</p>
        <p className="text-xs text-slate-400">A folder, a repo, a knowledge base — Restormel verifies what it finds.</p>
        <button className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
          Connect new source
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
        {[
          { name: "Q3 Filings — Legal Corpus", claims: 1204, abstained: 12 },
          { name: "Pharmacovigilance KB", claims: 842, abstained: 4 },
        ].map((src) => (
          <div key={src.name} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{src.name}</p>
              <p className="text-xs text-slate-400">
                {src.claims.toLocaleString()} claims verified · {src.abstained} abstained → review
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                <Check className="h-3.5 w-3.5" /> Verified
              </span>
              <button
                onClick={onCustomise}
                className="text-xs text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded"
              >
                Restormel default pipeline · Customise →
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Recently verified</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm gap-3">
            <span className="text-slate-700">
              "Q3 revenue grew 14% year-on-year" <span className="text-slate-400">— view source span</span>
            </span>
            <TrustBadge state="supported" />
          </div>
          <div className="flex items-center justify-between text-sm gap-3">
            <span className="text-slate-700">
              "Adverse event rate within expected range" <span className="text-slate-400">— ambiguous span</span>
            </span>
            <TrustBadge state="abstained" />
          </div>
        </div>
      </div>

      <AnnotationNote>
        this is the entire default experience — connect a source, see verified claims with citations and trust
        states. No extractor, embedder, verifier or store is chosen here; the cascade, cache and managed defaults
        all run underneath, per the ADR.
      </AnnotationNote>
    </div>
  );
}

const PRESETS = [
  {
    id: "managed",
    icon: Zap,
    title: "Fully-managed",
    blurb: "Restormel's managed components, tuned for cost and speed.",
    hint: "Recommended for most sources.",
  },
  {
    id: "accuracy",
    icon: ShieldCheck,
    title: "Highest-accuracy",
    blurb: "Escalates more claims to the strongest available verifier.",
    hint: "Best for high-stakes corpora.",
  },
  {
    id: "regional",
    icon: Globe,
    title: "Regional-residency",
    blurb: "Keeps processing inside a chosen region.",
    hint: "For data-residency requirements.",
  },
  {
    id: "airgapped",
    icon: Lock,
    title: "Self-host / air-gapped",
    blurb: "Runs entirely inside your own infrastructure, verification included.",
    hint: "For sovereignty or no-external-calls requirements.",
  },
];

function PresetsView({ preset, setPreset, onAdvanced, onBack }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div>
        <p className="text-sm font-medium text-slate-800">Choose a deployment preset</p>
        <p className="text-xs text-slate-400">
          One click re-bundles the whole pipeline. Defaults are vetted — you're not choosing individual models.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PRESETS.map(({ id, icon: Icon, title, blurb, hint }) => {
          const selected = preset === id;
          return (
            <button
              key={id}
              onClick={() => setPreset(id)}
              className={
                "text-left rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 " +
                (selected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300")
              }
            >
              <div className="flex items-center justify-between">
                <Icon className={"h-4 w-4 " + (selected ? "text-emerald-600" : "text-slate-400")} />
                {selected && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800">{title}</p>
              <p className="text-xs text-slate-500">{blurb}</p>
              <p className="mt-1 text-xs text-slate-400">{hint}</p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onAdvanced}
          className="text-xs text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded"
        >
          Advanced: change individual components →
        </button>
        <button className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
          Apply preset
        </button>
      </div>

      <AnnotationNote>
        still zero individual model choices. A preset swaps the whole vetted bundle — extractor, embedder,
        verifier cascade and store — at once.
      </AnnotationNote>
    </div>
  );
}

const SLOTS = [
  {
    id: "extract",
    icon: FileText,
    label: "Extract",
    current: "Restormel default — structured extraction with span anchoring",
    options: [
      { name: "Restormel default", note: "best value, span + confidence", disabled: false },
      { name: "Highest-fidelity extractor", note: "richer layout detection, higher cost", disabled: false },
      { name: "Bring your own", note: "for an extractor you already run", disabled: false },
    ],
  },
  {
    id: "embed",
    icon: Boxes,
    label: "Embed",
    current: "Restormel default — contextualised chunk embeddings",
    options: [
      { name: "Restormel default", note: "best value, multilingual", disabled: false },
      { name: "Domain-tuned embedder", note: "for legal/finance-heavy corpora", disabled: false },
    ],
  },
  {
    id: "verify",
    icon: ShieldCheck,
    label: "Verify",
    current: "Restormel default — independent verifier cascade",
    options: [
      { name: "Restormel default cascade", note: "cheap pre-filter → independent checker → escalation", disabled: false },
      { name: "Highest-accuracy verifier", note: "more claims escalate to the strongest tier", disabled: false },
      { name: "Same-family model as your generator", note: "not available — breaks cross-model independence", disabled: true },
    ],
  },
  {
    id: "store",
    icon: Database,
    label: "Store",
    current: "Restormel default — managed graph store",
    options: [
      { name: "Restormel default", note: "managed, quantised for cost", disabled: false },
      { name: "Bring your own graph store", note: "for an existing SurrealDB / Postgres", disabled: false },
    ],
  },
];

function SlotRow({ slot, expanded, onToggle }) {
  const Icon = slot.icon;
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-800">{slot.label}</p>
            <p className="text-xs text-slate-400">{slot.current}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded"
        >
          Change
          <ChevronDown className={"h-3.5 w-3.5 transition-transform " + (expanded ? "rotate-180" : "")} />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-2 space-y-1">
          {slot.options.map((opt) => (
            <div
              key={opt.name}
              className={
                "flex items-center justify-between rounded px-2 py-1.5 text-xs gap-3 " +
                (opt.disabled ? "text-slate-300" : "text-slate-600 hover:bg-slate-50")
              }
            >
              <span className="flex items-center gap-2">
                {opt.disabled ? <Ban className="h-3 w-3 flex-shrink-0" /> : <span className="h-3 w-3 flex-shrink-0" />}
                {opt.name}
              </span>
              <span className={opt.disabled ? "text-slate-300" : "text-slate-400"}>{opt.note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlugPointsView({ expandedSlot, setExpandedSlot, onBack }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div>
        <p className="text-sm font-medium text-slate-800 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-slate-400" /> Advanced — individual components
        </p>
        <p className="text-xs text-slate-400">
          Most sources don't need this. Every option here is pre-vetted; incompatible combinations aren't offered.
        </p>
      </div>

      <div className="space-y-2">
        {SLOTS.map((slot) => (
          <SlotRow
            key={slot.id}
            slot={slot}
            expanded={expandedSlot === slot.id}
            onToggle={() => setExpandedSlot(expandedSlot === slot.id ? null : slot.id)}
          />
        ))}
      </div>

      <AnnotationNote>
        expand "Verify" — one option is shown disabled with a plain-language reason. That's the ADR's
        cross-model-independence invariant enforced in the UI: the system won't let this combination exist,
        rather than explaining the rule upfront.
      </AnnotationNote>
    </div>
  );
}

export default function RestormelConnectWireframes() {
  const [view, setView] = useState("default");
  const [preset, setPreset] = useState("managed");
  const [expandedSlot, setExpandedSlot] = useState(null);

  return (
    <div className="min-h-screen bg-slate-100 font-sans py-6 px-4">
      <div className="max-w-5xl mx-auto mb-4">
        <p className="text-xs text-slate-400">
          Wireframe — structural fidelity only, not the real Restormel dashboard pixels. Illustrates the ADR:
          <span className="font-medium text-slate-500"> Ingest Pipeline as a Connector Abstraction with a Tiered Verification Cascade.</span>
        </p>
      </div>

      <div className="max-w-5xl mx-auto rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden flex">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <TopBar />
          <div className="px-6 py-6">
            <h1 className="text-lg font-semibold text-slate-900">Sources</h1>
            <p className="text-xs text-slate-400 mb-5">Connect a source, get verified context. Configuration is optional.</p>
            <Stepper view={view} setView={setView} />
            {view === "default" && <DefaultView onCustomise={() => setView("presets")} />}
            {view === "presets" && (
              <PresetsView
                preset={preset}
                setPreset={setPreset}
                onAdvanced={() => setView("plugpoints")}
                onBack={() => setView("default")}
              />
            )}
            {view === "plugpoints" && (
              <PlugPointsView
                expandedSlot={expandedSlot}
                setExpandedSlot={setExpandedSlot}
                onBack={() => setView("presets")}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
