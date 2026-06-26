#!/usr/bin/env python3
"""
Restormel-keys K3s - GROUNDED GBP Total-Cost-of-Ownership model.

Maps the REAL live 3-node Hetzner hel1 K3s cluster (verified via kubectl read-only
on KUBECONFIG=~/.config/restormel/kubeconfig, 2026-06-26) to the nearest SKUs of each
SHORTLISTED sovereignty-cleared provider, and computes monthly + 1-year GBP TCO incl.
one-off migration cost and ongoing ops-overhead delta.

USAGE
  python3 tco.py                       # baseline run, all defaults
  python3 tco.py --egress-tb 2 --fx-eur-gbp 0.863 --fx-usd-gbp 0.760
  python3 tco.py --pv-growth 2.0 --ram-drift 1.25 --json
  python3 tco.py --provider hetzner    # single provider
  python3 tco.py --sensitivity         # run the canned sensitivity sweep
  python3 tco.py --lb-count 0          # apples-to-apples with current host-port ingress

All inputs are CLI flags (see --help). Nothing here is hard-coded that the
current-state inventory didn't establish; every default is annotated with its source.
Prices are DATED (June 2026 primary pricing pages) - see SOURCES at bottom.
"""
import argparse, json, copy
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# FX (dated: 26 Jun 2026 mid-market; USD ~0.760, EUR ~0.863)
# ---------------------------------------------------------------------------
DEFAULT_FX_EUR_GBP = 0.863   # xe.com mid-market 26-Jun-2026 (1 EUR = 0.8628 GBP)
DEFAULT_FX_USD_GBP = 0.760   # exchange-rates.org 26-Jun-2026 (1 USD = 0.7598 GBP)

# ---------------------------------------------------------------------------
# CURRENT STATE (verified live, 2026-06-26) - the workload we are pricing.
# ---------------------------------------------------------------------------
# Nodes: 2x cx43 (8 vCPU / 16 GiB) + 1x cx33 (4 vCPU / 8 GiB).
#   => cluster totals 20 vCPU, ~40 GiB RAM. All control-plane+etcd (HA quorum 3).
NODES = [
    {"name": "master1", "vcpu": 8, "ram_gib": 16, "hetzner_sku": "cx43"},
    {"name": "node2",   "vcpu": 8, "ram_gib": 16, "hetzner_sku": "cx43"},
    {"name": "node3",   "vcpu": 4, "ram_gib": 8,  "hetzner_sku": "cx33"},
]
# Persistent volumes (hcloud-volumes, all RWO) - summed from `kubectl get pvc -A`:
#   CNPG 5 clusters x 2 instances x (10Gi data + 10Gi WAL)            = 200 GiB
#   SurrealDB surreal-data-surreal-0                                  =  20 GiB
#   CloudBeaver workspace (PV 10Gi)                                   =  10 GiB
#   Huly: cockroach 10 + elastic 10 + redpanda 10                    =  30 GiB
#   monitoring: grafana 10 + prometheus 10 + alertmanager 10         =  30 GiB
#   (Loki = emptyDir, NOT a PV; Forgejo PVC not yet provisioned)
PV_GIB_TOTAL = 290           # 28 PVCs bound; provisioned ceiling, not used-bytes
PV_COUNT = 28

# Public IPs: each node has 1 primary IPv4 (3 total). Zero Hetzner LBs in cluster
#   (ingress = Traefik DaemonSet hostPort 80/443; all DNS -> master1 IP).
PUBLIC_IPV4 = 3
# Object storage (fsn1): CNPG Barman + restic (surreal/escrow) + registry-mirror + Loki.
#   Registry blobs ESTIMATED ~10-25 GB; backups gzip'd; all inside the ~1TB base tier.
OBJ_STORAGE_GB = 250         # generous; well within 1 TB base bundle. PARAMETERISED.
# Egress: UNMEASURED / UNMONITORED in repo (explicit absence-of-evidence). Parameterise.
EGRESS_TB_DEFAULT = 1.0      # placeholder; Hetzner cx nodes bundle ~20TB each anyway.
# Container registry: self-hosted Forgejo (no marginal cloud cost) -> 0 unless managed.
REGISTRY_GB = 25             # only billed where a managed registry replaces Forgejo.


# ---------------------------------------------------------------------------
# Provider price book.  Every figure is dated June-2026 primary pricing.
# native_ccy: prices entered in the provider's quoting currency, converted to GBP.
# ---------------------------------------------------------------------------
@dataclass
class Sku:
    name: str
    vcpu: int
    ram_gib: int
    price_native: float       # per month in native currency

@dataclass
class Provider:
    key: str
    label: str
    native: str               # "EUR" | "USD" | "GBP"
    skus: list                # list[Sku], ascending by size
    pv_per_gb: float          # block storage native/GB/mo
    lb_per_month: float       # one cloud LB native/mo (0 if N/A / host-port model)
    ip_per_month: float       # additional public IPv4 native/mo
    control_plane: float      # managed-k8s control-plane fee native/mo (0 if self-managed)
    obj_base: float           # object-storage base native/mo (bundle)
    obj_base_included_gb: float
    obj_per_gb_over: float    # native/GB/mo beyond bundle
    egress_per_tb: float      # native per TB egress (0 if free)
    egress_free_tb_per_node: float  # bundled free egress per compute node (TB/mo)
    registry_per_gb: float    # managed registry native/GB/mo (0 if self-host assumed)
    managed_k8s: bool         # True = managed control plane (lower ops overhead)
    notes: str = ""

# -- Hetzner (BASELINE) -- CX shared-vCPU line. June-2026 page (CX NOT in the
#    15-Jun CCX hike; CX last moved +30-37% on 1-Apr-2026, now stable).
HETZNER = Provider(
    key="hetzner", label="Hetzner (BASELINE)", native="EUR",
    skus=[Sku("cx33", 4, 8, 6.49), Sku("cx43", 8, 16, 11.99),
          Sku("cpx31", 4, 8, 8.49)],
    pv_per_gb=0.0572, lb_per_month=5.39, ip_per_month=0.50,
    control_plane=0.0,                       # self-managed K3s -> no control-plane fee
    obj_base=4.99, obj_base_included_gb=1024, obj_per_gb_over=0.0067*0.744,  # TB-hr->GB-mo
    egress_per_tb=1.00, egress_free_tb_per_node=20.0,
    registry_per_gb=0.0, managed_k8s=False,
    notes="EU (DE co), hel1 FI compute. Self-managed K3s. CX line stable post-Apr-2026.",
)

# -- Civo -- USD pricing. Managed K8s IS K3s; control plane free; egress free.
CIVO = Provider(
    key="civo", label="Civo (UK)", native="USD",
    skus=[Sku("g4s.medium~4/8", 4, 8, 43.45), Sku("g4s.large~8/16", 8, 16, 86.91)],
    pv_per_gb=0.11, lb_per_month=10.86, ip_per_month=0.0,   # IP bundled w/ instance
    control_plane=0.0,                       # free managed K3s control plane
    obj_base=0.0, obj_base_included_gb=0.0, obj_per_gb_over=0.01086,
    egress_per_tb=0.0, egress_free_tb_per_node=0.0,         # free & unlimited egress
    registry_per_gb=0.0, managed_k8s=True,
    notes="UK founder-controlled. Managed K3s == our stack. Free egress. Single UK region.",
)

# -- iomart -- bespoke/quote-only (no public per-unit list). Modelled as a UK
#    managed-IaaS PREMIUM over a Hetzner-equivalent bill. Parameterised numbers.
IOMART = Provider(
    key="iomart", label="iomart (UK plc)", native="GBP",
    skus=[Sku("vm-4/8 (est)", 4, 8, 70.0), Sku("vm-8/16 (est)", 8, 16, 140.0)],
    pv_per_gb=0.18, lb_per_month=25.0, ip_per_month=2.0,
    control_plane=0.0,                       # DIY K3s on iomart VMs/bare-metal
    obj_base=0.0, obj_base_included_gb=0.0, obj_per_gb_over=0.02,
    egress_per_tb=0.0, egress_free_tb_per_node=10.0,        # generous UK transit
    registry_per_gb=0.0, managed_k8s=False,
    notes="ESTIMATE: no public per-unit list (quote-only). UK plc, own DCs. DIY K3s.",
)

# -- OVHcloud UK -- EUR-quoted catalogue (UK Erith region). B3 general-purpose.
#    Native Octavia LB + Cinder block. Unmetered/included egress on public cloud.
OVH = Provider(
    key="ovh", label="OVHcloud UK", native="EUR",
    skus=[Sku("b3-8 (2/8)", 2, 8, 44.17), Sku("b3-16 (4/16)", 4, 16, 88.18),
          Sku("b3-32 (8/32)", 8, 32, 176.36)],
    pv_per_gb=0.04, lb_per_month=18.0, ip_per_month=0.0,    # IP w/ instance
    control_plane=0.0,                       # DIY K3s on instances
    obj_base=0.0, obj_base_included_gb=0.0, obj_per_gb_over=0.01,
    egress_per_tb=0.0, egress_free_tb_per_node=0.0,         # unmetered egress
    registry_per_gb=0.0, managed_k8s=False,
    notes="FR parent (EU-sovereign, not strict-UK). UK Erith region. Unmetered egress.",
)

PROVIDERS = {p.key: p for p in (HETZNER, CIVO, IOMART, OVH)}


# ---------------------------------------------------------------------------
def fx(provider: Provider, fx_eur: float, fx_usd: float) -> float:
    return {"EUR": fx_eur, "USD": fx_usd, "GBP": 1.0}[provider.native]


def pick_sku(p: Provider, vcpu: int, ram_gib: int) -> Sku:
    """Nearest SKU that meets BOTH vCPU and RAM (ceil-match)."""
    fits = [s for s in p.skus if s.vcpu >= vcpu and s.ram_gib >= ram_gib]
    if fits:
        return min(fits, key=lambda s: s.price_native)
    return max(p.skus, key=lambda s: (s.vcpu, s.ram_gib))   # biggest available


def model_provider(p: Provider, args) -> dict:
    rate = fx(p, args.fx_eur_gbp, args.fx_usd_gbp)
    ram_drift = args.ram_drift                       # RAM-shortage price multiplier (>=1)

    # --- Compute: map each real node to nearest SKU. RAM drift hits compute price.
    compute_native = 0.0
    sku_map = []
    for n in NODES:
        s = pick_sku(p, n["vcpu"], n["ram_gib"])
        compute_native += s.price_native * ram_drift
        sku_map.append(f"{n['name']}({n['vcpu']}c/{n['ram_gib']}g)->{s.name}")
    # optional extra nodes (node-count sensitivity): clone a median 8/16 node sku
    if args.extra_nodes:
        s = pick_sku(p, 8, 16)
        compute_native += s.price_native * ram_drift * args.extra_nodes

    # --- Persistent volumes (PV growth multiplier; RAM drift does NOT touch disk)
    pv_gib = PV_GIB_TOTAL * args.pv_growth
    pv_native = pv_gib * p.pv_per_gb

    # --- Load balancers
    lb_native = p.lb_per_month * args.lb_count

    # --- Public IPs (Hetzner/iomart bill per primary IP; Civo/OVH bundle)
    ip_native = p.ip_per_month * PUBLIC_IPV4

    # --- Control plane (managed-K8s only; 0 for self-managed K3s)
    cp_native = p.control_plane

    # --- Object storage
    obj_gb = args.obj_storage_gb
    if obj_gb <= p.obj_base_included_gb:
        obj_native = p.obj_base
    else:
        obj_native = p.obj_base + (obj_gb - p.obj_base_included_gb) * p.obj_per_gb_over

    # --- Registry (0 unless provider replaces self-hosted Forgejo registry)
    reg_native = p.registry_per_gb * args.registry_gb

    # --- Egress
    egress_tb = args.egress_tb
    free_tb = p.egress_free_tb_per_node * len(NODES)
    if p.egress_per_tb == 0.0:
        egress_native = 0.0                          # free-egress provider
    else:
        billable = max(0.0, egress_tb - free_tb)
        egress_native = billable * p.egress_per_tb

    # --- Backups: bytes already in obj_storage above; add the transitional BX11
    #     box (EUR3.45/mo) only on baseline unless --drop-bx11.
    backup_native = 3.45 if p.key == "hetzner" and not args.drop_bx11 else 0.0

    lines_native = {
        "compute": compute_native, "persistent_volumes": pv_native,
        "load_balancers": lb_native, "public_ips": ip_native,
        "control_plane": cp_native, "object_storage": obj_native,
        "registry": reg_native, "egress": egress_native, "backups": backup_native,
    }
    lines_gbp = {k: round(v * rate, 2) for k, v in lines_native.items()}
    monthly_gbp = round(sum(lines_gbp.values()), 2)

    # --- One-off migration cost (GBP): engineering days + dual-running + cutover egress.
    eng_cost = args.eng_days * args.eng_day_rate
    dual_run = monthly_gbp * args.dual_run_months          # both stacks during cutover
    cutover_egress_gbp = (args.cutover_egress_tb
                          * HETZNER.egress_per_tb           # leaving Hetzner: their rate
                          * args.fx_eur_gbp)
    migration_oneoff = round(eng_cost + dual_run + cutover_egress_gbp, 2)
    if p.key == "hetzner":
        migration_oneoff = 0.0                            # staying put = no migration

    # --- Ongoing ops-overhead delta (GBP/mo). Self-managed K3s carries more toil
    #     (patching, etcd, upgrades - note: no system-upgrade-controller live today)
    #     than a managed control plane. eng-hours/mo * blended rate.
    ops_hours = args.ops_hours_managed if p.managed_k8s else args.ops_hours_selfmanaged
    ops_overhead_gbp = round(ops_hours * args.ops_hour_rate, 2)

    tco_year_gbp = round(monthly_gbp * 12 + migration_oneoff + ops_overhead_gbp * 12, 2)

    return {
        "provider": p.label, "native_ccy": p.native, "fx_to_gbp": rate,
        "sku_map": sku_map, "lines_gbp": lines_gbp,
        "monthly_infra_gbp": monthly_gbp,
        "migration_oneoff_gbp": migration_oneoff,
        "ops_overhead_gbp_per_month": ops_overhead_gbp,
        "tco_year1_gbp": tco_year_gbp,
        "tco_steady_year_gbp": round(monthly_gbp * 12 + ops_overhead_gbp * 12, 2),
        "managed_k8s": p.managed_k8s, "notes": p.notes,
    }


def run(args) -> dict:
    keys = [args.provider] if args.provider else list(PROVIDERS)
    out = {k: model_provider(PROVIDERS[k], args) for k in keys}
    base = out.get("hetzner", {}).get("monthly_infra_gbp")
    base_year = out.get("hetzner", {}).get("tco_steady_year_gbp")
    for r in out.values():
        if base:
            r["x_vs_hetzner_monthly"] = round(r["monthly_infra_gbp"] / base, 2)
        if base_year:
            r["x_vs_hetzner_steady_year"] = round(r["tco_steady_year_gbp"] / base_year, 2)
    return out


def print_table(out: dict):
    cols = ["provider", "monthly_infra_gbp", "x_vs_hetzner_monthly",
            "migration_oneoff_gbp", "ops_overhead_gbp_per_month",
            "tco_year1_gbp", "tco_steady_year_gbp", "x_vs_hetzner_steady_year"]
    hdr = ["Provider", "GBP/mo infra", "x vs Hz", "Migrate 1off",
           "Ops GBP/mo", "Yr1 TCO", "Steady Yr", "x vs Hz yr"]
    widths = [22, 12, 8, 13, 10, 10, 11, 11]
    print(" | ".join(h.ljust(w) for h, w in zip(hdr, widths)))
    print("-+-".join("-" * w for w in widths))
    for r in out.values():
        row = [str(r.get(c, "")) for c in cols]
        print(" | ".join(s.ljust(w) for s, w in zip(row, widths)))


def sensitivity(args):
    """Canned sweep over the four prompt-mandated axes."""
    scenarios = {
        "BASELINE": {},
        "node_count +1": {"extra_nodes": 1},
        "node_count +2": {"extra_nodes": 2},
        "PV growth x2": {"pv_growth": 2.0},
        "PV growth x5": {"pv_growth": 5.0},
        "PV growth x10": {"pv_growth": 10.0},
        "RAM drift +25%": {"ram_drift": 1.25},
        "RAM drift +50%": {"ram_drift": 1.50},
        "egress 5 TB": {"egress_tb": 5.0},
        "egress 20 TB": {"egress_tb": 20.0},
        "FX EUR weak 0.90": {"fx_eur_gbp": 0.90},
        "FX USD strong 0.82": {"fx_usd_gbp": 0.82},
    }
    print("\n=== SENSITIVITY (GBP/mo infra by provider) ===\n")
    keys = list(PROVIDERS)
    print("Scenario".ljust(20) + " | " + " | ".join(k.ljust(9) for k in keys)
          + " | x(civo) x(iomart) x(ovh)")
    print("-" * 92)
    for name, ov in scenarios.items():
        a = copy.deepcopy(args)
        for kk, vv in ov.items():
            setattr(a, kk, vv)
        out = run(a)
        cells = [f"{out[k]['monthly_infra_gbp']:.0f}".ljust(9) for k in keys]
        xs = " ".join(f"{out[k].get('x_vs_hetzner_monthly',0):.2f}"
                      for k in ("civo", "iomart", "ovh"))
        print(name.ljust(20) + " | " + " | ".join(cells) + " | " + xs)


def build_parser():
    p = argparse.ArgumentParser(description="Restormel K3s GBP TCO model")
    p.add_argument("--provider", choices=list(PROVIDERS), help="single provider")
    p.add_argument("--json", action="store_true")
    p.add_argument("--sensitivity", action="store_true")
    p.add_argument("--fx-eur-gbp", type=float, default=DEFAULT_FX_EUR_GBP)
    p.add_argument("--fx-usd-gbp", type=float, default=DEFAULT_FX_USD_GBP)
    p.add_argument("--egress-tb", type=float, default=EGRESS_TB_DEFAULT,
                   help="measured monthly egress TB (UNMONITORED today -> parameterised)")
    p.add_argument("--obj-storage-gb", type=float, default=OBJ_STORAGE_GB)
    p.add_argument("--registry-gb", type=float, default=REGISTRY_GB)
    p.add_argument("--pv-growth", type=float, default=1.0, help="PV multiplier")
    p.add_argument("--ram-drift", type=float, default=1.0,
                   help="2026 RAM-shortage compute-price multiplier (>=1)")
    p.add_argument("--lb-count", type=int, default=1,
                   help="cloud LBs on TARGET (current Hetzner uses 0; managed need ~1)")
    p.add_argument("--extra-nodes", type=int, default=0,
                   help="add N median (8/16) nodes for node-count sensitivity")
    p.add_argument("--drop-bx11", action="store_true",
                   help="drop transitional BX11 backup box line on baseline")
    p.add_argument("--eng-days", type=float, default=15.0)
    p.add_argument("--eng-day-rate", type=float, default=600.0, help="GBP/eng-day")
    p.add_argument("--dual-run-months", type=float, default=1.0)
    p.add_argument("--cutover-egress-tb", type=float, default=2.0)
    p.add_argument("--ops-hour-rate", type=float, default=75.0, help="GBP/eng-hour")
    p.add_argument("--ops-hours-selfmanaged", type=float, default=12.0)
    p.add_argument("--ops-hours-managed", type=float, default=4.0)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    out = run(args)
    if args.json:
        print(json.dumps(out, indent=2))
    else:
        print_table(out)
    if args.sensitivity:
        sensitivity(args)
    return out


# ---------------------------------------------------------------------------
# SOURCES (dated, primary):
#   Hetzner CX/CCX + 15-Jun-2026 adjustment:
#     https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
#     CX33 EUR6.49 / CX43 EUR11.99 / volume EUR0.0572 GB-mo / +IPv4 EUR0.50 / LB11 EUR5.39
#     (costgoat.com/pricing/hetzner, last-updated 26-Mar-2026; "CX +30-37% Apr-2026")
#   Hetzner Object Storage (exempt from Jun-2026 hike): EUR4.99 base incl 1TB+1TB egress,
#     EUR0.0067/TB-hr over, EUR1.00/TB egress over - hetzner.com/storage/object-storage/
#   Civo: civo.com/pricing - 4/8 $43.45, 8/16 $86.91, PV $0.11/GB, LB $10.86/10k req,
#     free control plane, FREE egress, object $0.01086/GB.
#   OVHcloud public cloud: ovhcloud.com/en/public-cloud/prices - B3-8 EUR44.17,
#     B3-16 EUR88.18; unmetered egress; block ~EUR0.04/GB.
#   iomart: NO public per-unit list (quote-only) - ESTIMATE band, UK plc, own DCs.
#   FX 26-Jun-2026: EUR->GBP 0.8628 (xe), USD->GBP 0.7598 (exchange-rates.org).
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    main()
