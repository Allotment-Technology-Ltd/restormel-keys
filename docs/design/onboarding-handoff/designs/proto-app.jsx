const { useState, useEffect, useRef } = React;
const KEY = 'restormel_proto_v2';

/* ──────────────────────────────────────────────────────────
   ARCHETYPES — one journey, three depths.
   path = the milestones this persona is nudged through.
   M2 (make ready) & M3 (own stack) are opt-in depth.
─────────────────────────────────────────────────────────── */
const PERSONAS = {
  initial:  { label: 'Initial',  blurb: 'Brand new. Minimum path to a live graph.',     path: ['m0', 'm1', 'm4'] },
  learning: { label: 'Learning', blurb: 'Building their first real graph, with guidance.', path: ['m0', 'm1', 'm2', 'm4'] },
  advanced: { label: 'Advanced', blurb: 'Wants the levers: own infra, own models, agents.', path: ['m0', 'm1', 'm2', 'm3', 'm4'] },
};
const ALL = ['m0', 'm1', 'm2', 'm3', 'm4'];
const META = {
  m0: { name: 'M0', sub: 'Explore', title: 'Explore the starter graph' },
  m1: { name: 'M1', sub: 'Build',   title: 'Build your graph' },
  m2: { name: 'M2', sub: 'Verify',  title: 'Verify & trust it', opt: true },
  m3: { name: 'M3', sub: 'Store',   title: 'Own your store', opt: true },
  m4: { name: 'M4', sub: 'Connect', title: 'Connect your app' },
};

function freshState(persona) {
  return {
    persona,
    screen: 'home',
    progress: {},
    graph: { ideas: 0, trust: 100, sources: 0, flagged: 0, stack: 'managed', connections: 0 },
  };
}

/* effects each milestone applies to the graph when completed */
function applyEffect(id, g) {
  const n = { ...g };
  if (id === 'm1') { n.ideas = 1204; n.sources = 3; n.flagged = 6; n.trust = 88; }
  if (id === 'm2') { n.flagged = 0; n.trust = 97; }
  if (id === 'm3') { n.stack = 'self'; }
  if (id === 'm4') { n.connections = Math.max(1, n.connections); }
  return n;
}

function useProto() {
  const [s, setS] = useState(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return freshState('learning');
  });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }, [s]);
  return [s, setS];
}

/* ───────────────────── RUTHLESSLY-SIMPLE IA — the aha loop + tucked depth ───────────────────── */
const PRIMARY_NAV = [
  { slug: 'home', label: 'Home' },
  { slug: 'build', label: 'Build' },
  { slug: 'verify', label: 'Verify' },
  { slug: 'connect', label: 'Connect' },
];
const SETTINGS_NAV = [
  { slug: 'providers', label: 'Providers' },
  { slug: 'store', label: 'Store' },
  { slug: 'routes', label: 'Routes' },
  { slug: 'audit', label: 'Audit log' },
  { slug: 'metrics', label: 'Metrics' },
];
const TITLES = { home: 'Home', build: 'Build', verify: 'Verify', connect: 'Connect', providers: 'Providers', store: 'Store', routes: 'Routes', audit: 'Audit log', metrics: 'Metrics' };
const MILE_TO_SECTION = { m0: 'home', m1: 'build', m2: 'verify', m3: 'store', m4: 'connect' };

function NavLink({ slug, label, work, active, badge, go }) {
  return (
    <button className={'rmnav-link' + (work ? ' work' : '') + (active === slug ? ' active' : '')} onClick={() => go(slug)}>
      {label}{badge ? <span className="nb">{badge}</span> : null}
    </button>
  );
}

function Sidebar({ s, go }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const active = s.screen;
  const claims = s.progress.m1 && !s.progress.m2 ? s.graph.flagged : 0;
  return (
    <aside className="rmsidebar">
      <div className="rmbrand"><span className="sq"></span>Restormel</div>
      <nav className="rmnav">
        <div className="rmnav-sec">
          {PRIMARY_NAV.map(n => (
            <button key={n.slug} className={'rmnav-link work' + (active === n.slug ? ' active' : '')} onClick={() => go(n.slug)}>
              {n.label}{n.slug === 'verify' && claims ? <span className="nb">{claims}</span> : null}
            </button>
          ))}
        </div>
        <button className="rmgrp-head" onClick={() => setSettingsOpen(o => !o)}>Settings <span aria-hidden="true">{settingsOpen ? '▾' : '▸'}</span></button>
        {settingsOpen && SETTINGS_NAV.map(n => <NavLink key={n.slug} slug={n.slug} label={n.label} active={active} go={go} />)}
      </nav>
      <div className="rmside-foot"><b>acme</b> · prod workspace<br />settings rarely needed</div>
    </aside>
  );
}

function Topbar({ s, persona, onPersona }) {
  return (
    <header className="rmtopbar">
      <span className="rmtitle">{TITLES[s.screen] || 'Home'}</span>
      <div className="rmtop-right">
        <button className="rmsearch" title="Search (⌘K)">⌕ Search <kbd>⌘K</kbd></button>
        <span className="rmdemo">
          <span className="dl">Demo persona</span>
          <span className="rmseg">{Object.keys(PERSONAS).map(k => <button key={k} className={persona === k ? 'on' : ''} onClick={() => onPersona(k)}>{PERSONAS[k].label}</button>)}</span>
        </span>
        <span className="rmacct" title="Account">AC</span>
      </div>
    </header>
  );
}

/* ───────────────────────── LEDGER ───────────────────────── */
function Ledger({ s, go }) {
  const path = PERSONAS[s.persona].path;
  // a milestone is reachable if done, or it's the next unfinished step on the path
  const nextId = path.find(id => !s.progress[id]);
  return (
    <div className="pledger">
      {ALL.map(id => {
        const done = !!s.progress[id];
        const onPath = path.includes(id);
        const isNow = id === nextId && s.screen !== 'home';
        const reachable = done || id === nextId;
        let cls = 'plc';
        if (done) cls += ' done';
        else if (s.screen === id) cls += ' now';
        else if (!onPath) cls += ' lock';
        if (reachable) cls += ' clk';
        if (META[id].opt) cls += ' optional';
        return (
          <button key={id} className={cls} disabled={!reachable} onClick={() => reachable && go(id)}>
            <span className="d">{done ? '✓' : (s.screen === id ? '▸' : (onPath ? '○' : '—'))}</span>
            <span className="pl-name">{META[id].name}<small>{META[id].sub}{META[id].opt ? ' · opt' : ''}</small></span>
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────── GRAPH HOME ───────────────────────── */
function tileData(s, go) {
  const g = s.graph;
  return [
    { id: 'sources', name: 'Sources', dot: g.ideas ? 'ok' : 'idle',
      stat: g.ideas ? <span><b>{g.ideas.toLocaleString()}</b> ideas · {g.sources} sources</span> : <span>no docs yet</span>,
      act: g.ideas ? '+ Add docs' : 'Ingest →', actY: !g.ideas, to: 'm1' },
    { id: 'ready', name: 'Verify', dot: !s.progress.m1 ? 'idle' : (g.flagged ? 'todo' : 'ok'),
      stat: !s.progress.m1 ? <span>ingest first</span> : <span>trust <b>{g.trust}</b> · <b>{g.flagged}</b> flagged</span>,
      act: g.flagged ? 'Review →' : 'Open', actY: !!g.flagged, to: 'm2', lock: !s.progress.m1 },
    { id: 'models', name: 'Models', dot: s.progress.m1 ? 'ok' : 'idle',
      stat: s.progress.m1 ? <span><b>6</b> stages assigned</span> : <span>set at ingest</span>,
      act: 'Adjust', to: 'm1', lock: !s.progress.m1 },
    { id: 'stack', name: 'Store', dot: g.stack === 'self' ? 'ok' : 'warn',
      stat: g.stack === 'self' ? <span>self-hosted DB</span> : <span>Restormel <b>managed</b></span>,
      act: g.stack === 'self' ? 'Manage' : 'Self-host →', to: 'm3' },
    { id: 'conn', name: 'Connect', dot: g.connections ? 'ok' : 'todo',
      stat: g.connections ? <span><b>{g.connections}</b> connected</span> : <span>no app connected</span>,
      act: g.connections ? 'Manage' : 'Connect app →', actY: !g.connections, to: 'm4', lock: !s.progress.m1 },
    { id: 'routes', name: 'Routes', dot: s.progress.m4 ? 'ok' : 'idle',
      stat: s.progress.m4 ? <span><b>2</b> routes live</span> : <span>after you connect</span>,
      act: 'Edit', to: 'routes', lock: !s.progress.m4 },
  ];
}

function GraphHome({ s, go }) {
  const g = s.graph;
  const path = PERSONAS[s.persona].path;
  const nextId = path.find(id => !s.progress[id]);
  const live = !!s.progress.m4;
  const tiles = tileData(s, go);
  return (
    <div className="pscreen">
      <div className="phome-top">
        <div className="phero">
          <span className="gname">{g.ideas ? 'acme-graph' : 'starter-graph'}</span>
          <span className="gmeta">
            {g.ideas ? <span><b>{g.ideas.toLocaleString()}</b> ideas · trust <b>{g.trust}</b> · <b>{g.sources}</b> sources</span>
                     : <span>demo data · <b>312</b> ideas</span>}
          </span>
          {live ? <span className="glive yes"><span className="ld"></span>Live</span> : <span className="glive no">Not connected</span>}
        </div>
      </div>

      {nextId ? (
        <div className="pnudge">
          <div className="nt"><b>Next · {META[nextId].name} {META[nextId].sub}.</b> {nudgeCopy(nextId, s)}</div>
          <button className="pbtn primary nb" onClick={() => go(nextId)}>{nextId === 'm0' ? 'Explore' : META[nextId].title.split(' ')[0]} →</button>
        </div>
      ) : (
        <div className="pnudge live">
          <div className="nt"><b>You're live.</b> Your app can answer from your graph. Everything below stays editable — revisit any area, any time.</div>
          <button className="pbtn ghost nb" onClick={() => go('m4')}>Manage connections</button>
        </div>
      )}

      <div className="psec">Areas <span className="leg">jump in &amp; out — nothing here restarts the journey</span></div>
      <div className="ptiles">
        {tiles.map(t => (
          <button key={t.id} className="ptile" disabled={t.lock} onClick={() => !t.lock && go(t.to)}>
            <span className={'dot ' + t.dot}></span>
            <span className="tname">{t.name}</span>
            <span className="tstat">{t.stat}</span>
            {!t.lock && <span className={'tact' + (t.actY ? ' y' : '')}>{t.act}</span>}
          </button>
        ))}
      </div>

      <div className="phome-foot">
        <button className="fl" onClick={() => go('metrics')}>Metrics</button>
        <span>·</span>
        <button className="fl" onClick={() => go('providers')}>Providers</button>
        <span>·</span>
        <button className="fl" onClick={() => go('routes')}>Routes</button>
        <span style={{ marginLeft: 'auto' }}>Persona: <b style={{ color: 'var(--color-ink)' }}>{PERSONAS[s.persona].label}</b> — {PERSONAS[s.persona].blurb}</span>
      </div>
    </div>
  );
}

function nudgeCopy(id, s) {
  if (id === 'm0') return 'See it answer a question — with citations — before doing anything.';
  if (id === 'm1') return 'Point it at your docs and make the graph yours.';
  if (id === 'm2') return 'Validate and triage until the answers are production-grade.';
  if (id === 'm3') return 'Move onto your own database and provider keys.';
  if (id === 'm4') return 'Let your app, agent, or site answer from your graph.';
  return '';
}

/* ───────────────────────── M0 · EXPLORE ───────────────────────── */
const STARTER_QA = [
  { q: 'What is our data retention policy?',
    a: 'Customer data is retained for 90 days after account closure, then permanently deleted. Audit logs are kept for 12 months for compliance.',
    cites: ['retention-policy.md', 'security-faq.md'] },
  { q: 'Which plans include SSO?',
    a: 'Single sign-on (SAML & OIDC) is included on Business and Enterprise plans. Starter does not include SSO; it can be added via an add-on.',
    cites: ['pricing.md', 'sso-setup.md'] },
  { q: 'What is the API rate limit?',
    a: 'The default limit is 600 requests per minute per key. Enterprise customers can request higher ceilings through support with 48h notice.',
    cites: ['api-reference.md', 'rate-limits.md'] },
];

function M0Explore({ s, complete, go }) {
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [typed, setTyped] = useState('');
  const timer = useRef(null);

  function ask(qa) {
    setAnswer(null); setAsking(true); setTyped(qa.q);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setAsking(false); setAnswer(qa); }, 850);
  }
  function askTyped() {
    const match = STARTER_QA.find(x => x.q.toLowerCase() === typed.trim().toLowerCase()) || STARTER_QA[0];
    ask({ ...match, q: typed.trim() || match.q });
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="pscreen">
      <p className="pscreen-eye">M0 · explore · the aha</p>
      <h1 className="pscreen-title">Ask the starter graph</h1>
      <p className="pscreen-desc">Before you connect anything, see what a knowledge graph does: ask a question and get a <b>grounded answer with citations</b> — built from a small demo knowledge base. No setup.</p>

      <div className="m0grid">
        <div className="askcard">
          <div className="lbl">Ask a question</div>
          <div className="askrow">
            <input value={typed} placeholder="Ask the demo knowledge base…"
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askTyped()} />
            <button className="pbtn primary" onClick={askTyped}>Ask →</button>
          </div>
          <div className="chips">
            {STARTER_QA.map((qa, i) => (
              <button key={i} className="chip" onClick={() => ask(qa)}><span className="q">Q</span>{qa.q}</button>
            ))}
          </div>
        </div>

        {(asking || answer) && (
          <div className="answer">
            <div className="a-q"><span className="qm">?</span>{typed}</div>
            {asking ? (
              <div className="a-think"><span className="sp"></span>Searching the graph · retrieving grounded passages…</div>
            ) : (
              <React.Fragment>
                <div className="a-body">{answer.a}</div>
                <div className="a-cites">
                  {answer.cites.map((c, i) => (
                    <span className="cite" key={i} title={'Source: ' + c}><span className="cn">↗</span>{c}</span>
                  ))}
                </div>
              </React.Fragment>
            )}
          </div>
        )}

        {answer && !asking && (
          <div className="aha">
            <div className="at"><b>That's the aha — every answer is grounded and cited.</b> Now make it answer from <i>your</i> knowledge.</div>
            <button className="pbtn primary ab" onClick={() => { complete('m0'); go('home'); }}>Ingest your docs →</button>
          </div>
        )}
      </div>

      <p className="pfoot-hint">Archetype note — <b>Initial</b> stops at the aha; <b>Learning</b> notices it's demo data and wants their own; <b>Advanced</b> probes the citations &amp; retrieval quality. All three see the same screen.</p>
    </div>
  );
}

/* ───────────────────────── M1 · INGEST ───────────────────────── */
const SRC_TYPES = ['Upload', 'Notion', 'Drive', 'GitHub', 'URL'];
const SEED_SOURCES = {
  initial:  [{ type: 'Upload', name: 'product-handbook.pdf' }],
  learning: [{ type: 'Upload', name: 'employee-handbook.pdf' }, { type: 'Notion', name: 'Engineering wiki' }, { type: 'Drive', name: 'Product specs' }],
  advanced: [{ type: 'Upload', name: 'handbook.pdf' }, { type: 'Notion', name: 'Eng wiki' }, { type: 'Drive', name: 'Specs folder' }, { type: 'GitHub', name: 'acme/docs' }, { type: 'URL', name: 'status.acme.com' }],
};
const NEW_SOURCE_NAME = { Upload: 'new-file.pdf', Notion: 'Notion page', Drive: 'Drive folder', GitHub: 'org/repo', URL: 'https://…' };
const ING_STAGES = [
  { k: 'Extract', d: 'docs → ideas' },
  { k: 'Relate', d: 'link ideas' },
  { k: 'Group', d: 'cluster' },
  { k: 'Embed', d: 'retrieval index' },
];
const STAGE_MODEL = { Extract: 'qwen3-235b', Relate: 'qwen3-235b', Group: 'qwen3-235b', Embed: 'voyage-3' };
const YOUR_QA = [
  { q: "What's our on-call rotation?", a: 'On-call rotates weekly on Mondays at 10:00. The primary owns paging; the secondary is backup. Handover notes go in the runbook before each switch.', cites: ['Engineering wiki', 'runbook.md'] },
  { q: 'When do we sunset v1 of the API?', a: 'v1 is scheduled to sunset in Q3, six months after v2 GA. Customers on v1 keys get two deprecation notices and a migration guide.', cites: ['Product specs', 'api-migration.md'] },
];
const M1_TITLES = { sources: 'Add your sources', configure: 'Choose models', running: 'Building your graph', done: 'Ask your own data' };

function M1Ingest({ s, complete, go }) {
  const [step, setStep] = useState('sources');
  const [sources, setSources] = useState(() => SEED_SOURCES[s.persona].map(x => ({ ...x })));
  const [keyVal, setKeyVal] = useState('');
  const [adv, setAdv] = useState(s.persona === 'advanced');
  const [runIdx, setRunIdx] = useState(-1);
  const [fault, setFault] = useState('none');
  const [runErr, setRunErr] = useState(null);
  const [rateMsg, setRateMsg] = useState(false);
  const [keyErr, setKeyErr] = useState(false);
  const [nonce, setNonce] = useState(0);
  function launch() { if (fault === 'key') { setKeyErr(true); return; } setStep('running'); }
  function retry() { setRunErr(null); setFault('none'); setNonce(n => n + 1); }
  const [ans, setAns] = useState(null);
  const [asking, setAsking] = useState(false);
  const tmr = useRef(null);
  const keyed = keyVal.trim().length >= 6;
  const order = ['sources', 'configure', 'running', 'done'];
  const curStep = order.indexOf(step);
  const path = PERSONAS[s.persona].path;
  const afterId = path[path.indexOf('m1') + 1];
  const afterCopy = afterId === 'm2' ? 'Next: make it trustworthy.' : 'Next: connect your app.';

  function addSource(t) { setSources(p => [...p, { type: t, name: NEW_SOURCE_NAME[t] }]); }
  function rmSource(i) { setSources(p => p.filter((_, j) => j !== i)); }
  function askYour(qa) {
    setAns(null); setAsking(true); clearTimeout(tmr.current);
    tmr.current = setTimeout(() => { setAsking(false); setAns(qa); }, 800);
  }
  useEffect(() => {
    if (step !== 'running') return;
    setRunIdx(0); setRunErr(null); setRateMsg(false);
    let i = 0;
    let rateConsumed = false;
    const FAULT_AT = 1; // Relate
    const tick = () => {
      if (i === FAULT_AT && fault === 'fail') { setRunErr({ stage: ING_STAGES[FAULT_AT].k }); return; }
      if (i === FAULT_AT && fault === 'rate' && !rateConsumed) { rateConsumed = true; setRateMsg(true); tmr.current = setTimeout(() => { setRateMsg(false); tick(); }, 2600); return; }
      i++;
      if (i < ING_STAGES.length) { setRunIdx(i); tmr.current = setTimeout(tick, 850); }
      else { setRunIdx(ING_STAGES.length); tmr.current = setTimeout(() => setStep('done'), 650); }
    };
    tmr.current = setTimeout(tick, 850);
    return () => clearTimeout(tmr.current);
  }, [step, nonce]);
  useEffect(() => () => clearTimeout(tmr.current), []);

  return (
    <div>
      <div className="m1steps">
        {['Sources', 'Configure', 'Ingest', 'Ask'].map((label, i) => (
          <div key={label} className={'m1step ' + (i < curStep ? 'done' : i === curStep ? 'now' : '')}>
            <span className="n">{i < curStep ? '✓' : i + 1}</span>{label}
          </div>
        ))}
      </div>
      <p className="pscreen-eye">M1 · ingest</p>
      <h1 className="pscreen-title">{M1_TITLES[step]}</h1>

      {step === 'sources' && (
        <React.Fragment>
          <p className="pscreen-desc">Point Restormel at where your knowledge lives — files, wikis, repos. We read them and build the graph.</p>
          <div className="m1card">
            <div className="m1lbl">Your sources <span className="m1cnt">{sources.length}</span></div>
            <div className="srclist">
              {sources.map((src, i) => (
                <div className="srcrow" key={i}>
                  <span className="srcic">{src.type[0]}</span>
                  <span className="srcname">{src.name}<small>{src.type}</small></span>
                  <button className="srcx" onClick={() => rmSource(i)}>✕</button>
                </div>
              ))}
              {sources.length === 0 && <div className="srcempty">No sources yet — add at least one to continue.</div>}
            </div>
            <div className="m1addlbl">+ Add a source</div>
            <div className="srcadd">
              {SRC_TYPES.map(t => <button key={t} className="srcbtn" onClick={() => addSource(t)}>{t}</button>)}
            </div>
          </div>
          <div className="m1foot">
            <span className="m1hint">{s.persona === 'advanced' ? 'Many sources is fine — they ingest together.' : 'Start with one; you can add more any time from Sources.'}</span>
            <button className="pbtn primary" disabled={!sources.length} onClick={() => setStep('configure')}>Configure models →</button>
          </div>
        </React.Fragment>
      )}

      {step === 'configure' && (
        <React.Fragment>
          <p className="pscreen-desc">Ingestion runs on your model provider. Paste one key to cover every stage — or open the controls to pick a model per stage.</p>
          <div className="m1card">
            <div className="m1lbl">Provider key</div>
            <input className="m1key" value={keyVal} onChange={e => setKeyVal(e.target.value)} placeholder="tok_live_…  (covers extract, relate, group, embed)" />
            <div className="cov">
              {ING_STAGES.map(st => <span key={st.k} className={'covpill ' + (keyed ? 'on' : '')}>{keyed ? '✓' : '○'} {st.k}</span>)}
            </div>
          </div>
          <div className="m1card">
            <button className="advtog" onClick={() => setAdv(a => !a)}>
              <span className="caret">{adv ? '▾' : '▸'}</span> Advanced — choose a model per stage
              <span className="advnote">{adv ? '' : 'recommended defaults applied'}</span>
            </button>
            {adv && (
              <div className="stagetbl">
                {ING_STAGES.map(st => (
                  <div className="stagerow" key={st.k}>
                    <div className="stagename">{st.k}<small>{st.d}</small></div>
                    <div className="modelsel">{STAGE_MODEL[st.k]} <span className="cv">▾</span></div>
                    <span className="recpill">Rec</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="faultpick">
            <span className="fpl">⚙ Prototype · simulate</span>
            {[['none', 'Success'], ['fail', 'Stage fails'], ['rate', 'Rate-limited'], ['key', 'Bad key']].map(([k, l]) => (
              <button key={k} className={'fpb' + (fault === k ? ' on' : '')} onClick={() => { setFault(k); setKeyErr(false); }}>{l}</button>
            ))}
          </div>
          {keyErr && <div className="m1warn fail"><span className="wic">!</span><div><b>Provider rejected this key.</b> It’s expired or lacks access to the required models. Paste a working key, or pick a different provider.</div></div>}
          <div className="m1foot">
            <button className="pbtn ghost sm" onClick={() => setStep('sources')}>← Sources</button>
            <span className="m1hint">{keyed ? sources.length + ' source' + (sources.length > 1 ? 's' : '') + ' · ' + (adv ? 'custom' : 'recommended') + ' models' : 'Paste a key to continue'}</span>
            <button className="pbtn primary" disabled={!keyed} onClick={launch}>Launch ingest →</button>
          </div>
        </React.Fragment>
      )}

      {step === 'running' && (
        <React.Fragment>
          <p className="pscreen-desc">Reading {sources.length} source{sources.length > 1 ? 's' : ''} and building your graph. Each stage runs on the model you assigned.</p>
          {rateMsg && <div className="m1warn rate"><span className="wic">◴</span><div><b>Provider rate-limited.</b> Backing off and retrying automatically — no action needed.</div></div>}
          {runErr && <div className="m1warn fail"><span className="wic">!</span><div><b>{runErr.stage} failed.</b> The provider returned an error mid-stage. Earlier stages are saved — retry the run.</div><button className="pbtn sm" style={{ marginLeft: 'auto' }} onClick={retry}>↻ Retry run</button></div>}
          <div className="m1run">
            {ING_STAGES.map((st, i) => {
              const failed = runErr && i === runIdx;
              const done = !failed && (runIdx > i || runIdx >= ING_STAGES.length);
              const active = !failed && runIdx === i;
              const rl = rateMsg && active;
              return (
                <div className={'runstage ' + (failed ? 'failed' : done ? 'done' : active ? 'active' : 'wait')} key={st.k}>
                  <span className="rsd">{failed ? '✕' : done ? '✓' : active ? '' : '○'}{active && !rl && <span className="sp2"></span>}</span>
                  <div className="rsname">{st.k}<small>{st.d}</small></div>
                  <div className="rsbar"><span style={{ width: failed ? '40%' : done ? '100%' : active ? '62%' : '0%' }}></span></div>
                  <span className="rsmeta">{failed ? 'failed' : rl ? 'rate-limited…' : done ? 'done' : active ? 'running…' : 'queued'}</span>
                </div>
              );
            })}
          </div>
          {!runErr && <p className="pfoot-hint">Honest by default — every stage is named and visible. If one fails, it stops here and tells you which, with a retry.</p>}
        </React.Fragment>
      )}

      {step === 'done' && (
        <div className="m0grid">
          <div className="m1done">
            <span className="dch">✓</span>
            <div className="dct"><b>Your graph is built.</b> 1,204 ideas from {sources.length} source{sources.length > 1 ? 's' : ''}, ready to query.</div>
          </div>
          <div className="askcard">
            <div className="lbl">Ask your own data now</div>
            <div className="chips">
              {YOUR_QA.map((qa, i) => <button key={i} className="chip" onClick={() => askYour(qa)}><span className="q">Q</span>{qa.q}</button>)}
            </div>
          </div>
          {(asking || ans) && (
            <div className="answer">
              <div className="a-q"><span className="qm">?</span>{(ans || {}).q}</div>
              {asking ? <div className="a-think"><span className="sp"></span>Searching your graph · retrieving grounded passages…</div> : (
                <React.Fragment>
                  <div className="a-body">{ans.a}</div>
                  <div className="a-cites">{ans.cites.map((c, i) => <span className="cite" key={i}><span className="cn">↗</span>{c}</span>)}</div>
                </React.Fragment>
              )}
            </div>
          )}
          <div className="aha">
            <div className="at"><b>It's your knowledge now — grounded in your own sources.</b> {afterCopy}</div>
            <button className="pbtn primary ab" onClick={() => { complete('m1'); go('home'); }}>See what's next →</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── M2 · MAKE READY ───────────────────────── */
const FLAGGED = [
  { claim: 'Merch re-rank lifted CTR by 4%', why: 'Single source, small sample (n=120).' },
  { claim: 'We sunset v1 of the API in Q2', why: 'Contradicts roadmap.md, which says Q3.' },
  { claim: 'SSO is included on the Starter plan', why: 'pricing.md says Business & Enterprise only.' },
  { claim: 'p99 latency budget is 150ms', why: 'perf-slo.md states 200ms.' },
  { claim: 'Customer data is retained for 30 days', why: 'retention-policy.md says 90 days.' },
  { claim: 'On-call rotates bi-weekly', why: 'runbook.md says weekly.' },
];
const VERDICTS = [
  { k: 'accept', label: 'Accept', tone: '' },
  { k: 'weaken', label: 'Weaken', tone: 'warn' },
  { k: 'remove', label: 'Remove', tone: 'bad' },
];

function GateRow({ name, done, busy, todo, doneMsg, action, onAct }) {
  return (
    <div className={'m2gate ' + (done ? 'done' : '')}>
      <span className={'gdot ' + (done ? 'ok' : 'todo')}></span>
      <div className="gname">{name}</div>
      <div className="gstat">{done ? doneMsg : todo}</div>
      {done
        ? <span className="gdone">✓ done</span>
        : <button className="pbtn sm" onClick={onAct} disabled={busy}>{busy ? 'Working…' : action}</button>}
    </div>
  );
}

function M2MakeReady({ s, complete, go }) {
  const [view, setView] = useState('hub');
  const [srcBusy, setSrcBusy] = useState(false);
  const [srcDone, setSrcDone] = useState(false);
  const [embBusy, setEmbBusy] = useState(false);
  const [embDone, setEmbDone] = useState(false);
  const [qi, setQi] = useState(0);
  const tmr = useRef(null);
  useEffect(() => () => clearTimeout(tmr.current), []);

  const valDone = qi >= FLAGGED.length;
  const trust = 88 + (srcDone ? 3 : 0) + (embDone ? 2 : 0) + (valDone ? 4 : 0);
  const allDone = srcDone && embDone && valDone;
  const path = PERSONAS[s.persona].path;
  const afterId = path[path.indexOf('m2') + 1];

  function doSrc() { setSrcBusy(true); tmr.current = setTimeout(() => { setSrcBusy(false); setSrcDone(true); }, 850); }
  function doEmb() { setEmbBusy(true); tmr.current = setTimeout(() => { setEmbBusy(false); setEmbDone(true); }, 850); }

  if (view === 'triage') {
    return (
      <div>
        <div className="pscreen-bar2">
          <button className="pback" onClick={() => setView('hub')}>← Make ready</button>
          <span className="pcrumb">Validate <span style={{ opacity: 0.5 }}>/</span> <span className="here">Triage</span></span>
        </div>
        <p className="pscreen-eye">M2 · make ready · validate</p>
        <h1 className="pscreen-title">Triage flagged claims</h1>
        <div className="tqprogwrap">
          <div className="tqbar"><span style={{ width: (qi / FLAGGED.length * 100) + '%' }}></span></div>
          <div className="tqlbl"><b>{Math.min(qi, FLAGGED.length)}</b> / {FLAGGED.length} resolved</div>
        </div>
        {!valDone ? (
          <div className="tqcard">
            <div className="tqtag">Flagged · low confidence</div>
            <div className="tqclaim">“{FLAGGED[qi].claim}”</div>
            <div className="tqwhy"><span className="wl">Why flagged</span>{FLAGGED[qi].why}</div>
            <div className="tqverdicts">
              {VERDICTS.map(v => <button key={v.k} className={'vbtn ' + v.tone} onClick={() => setQi(q => q + 1)}>{v.label}</button>)}
            </div>
            <div className="tqhint">Accept keeps it · Weaken lowers its confidence · Remove drops it from answers.</div>
          </div>
        ) : (
          <div className="m2ready">
            <span className="dch">✓</span>
            <div><b>All flags cleared.</b> The graph won’t answer from anything contradicted or unsupported.</div>
            <button className="pbtn primary" style={{ marginLeft: 'auto' }} onClick={() => setView('hub')}>Back to make ready →</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="pscreen-eye">M2 · make ready</p>
      <h1 className="pscreen-title">Make it trustworthy</h1>
      <p className="pscreen-desc">Three gates stand between a graph that answers and one you can <b>ship</b>: every idea sourced, everything retrievable, and weak claims triaged. Clear them and trust climbs.</p>

      <div className="m2trust">
        <div className="m2tnum">{trust}<small>/ 100</small></div>
        <div className="m2tbody">
          <div className="m2tlbl">Trust score {allDone && <span className="m2tup">▲ production-grade</span>}</div>
          <div className="m2tbar"><span style={{ width: trust + '%' }}></span></div>
        </div>
      </div>

      <div className="m2gates">
        <GateRow name="Sources" done={srcDone} busy={srcBusy} todo="164 ideas have no source" doneMsg="All 1,204 ideas sourced" action="Link 164 matched" onAct={doSrc} />
        <GateRow name="Embed" done={embDone} busy={embBusy} todo="24 ideas not yet embedded" doneMsg="100% retrievable" action="Embed remaining" onAct={doEmb} />
        <GateRow name="Validate" done={valDone} busy={false} todo={(FLAGGED.length - qi) + ' claims need your judgment'} doneMsg="No open flags" action="Triage →" onAct={() => setView('triage')} />
      </div>

      {allDone ? (
        <div className="aha" style={{ marginTop: 18 }}>
          <div className="at"><b>Production-grade — trust {trust}.</b> {afterId === 'm3' ? 'Next: own your stack.' : 'Next: connect your app.'}</div>
          <button className="pbtn primary ab" onClick={() => { complete('m2'); go('home'); }}>Mark ready →</button>
        </div>
      ) : (
        <p className="pfoot-hint">Clear all three gates to mark the graph ready. Sources &amp; Embed are one tap; Validate needs your judgment on {FLAGGED.length - qi} claim{FLAGGED.length - qi === 1 ? '' : 's'}.</p>
      )}
    </div>
  );
}

/* ───────────────────────── M3 · OWN STACK ───────────────────────── */
const ENGINES = [
  { k: 'SurrealDB', d: 'graph + vector' },
  { k: 'Neo4j', d: 'graph' },
  { k: 'Postgres', d: '+ pgvector' },
  { k: 'Other', d: 'bring a URL' },
];
const DATA_CHOICES = [
  { k: 'use', t: 'Use the graph that’s already here', d: 'Restormel serves the existing 4,210 nodes. Your managed graph stays as a separate copy, untouched.', cta: 'Use this graph' },
  { k: 'add', t: 'Add my managed graph alongside it', d: 'Copy your 1,204 ideas in next to the existing data. Nothing is overwritten; duplicates are flagged, not merged.', cta: 'Copy mine in' },
  { k: 'sep', t: 'Keep them separate', d: 'Leave this graph alone; put yours in a new namespace (acme/restormel).', cta: 'Create namespace' },
];
const STACK_KEYS = [
  { prov: 'Together', use: 'extract · relate · group · remediate' },
  { prov: 'Voyage', use: 'embed' },
];

function M3OwnStack({ s, complete, go }) {
  const [step, setStep] = useState('connect');   // connect | verifying | found | keys
  const [engine, setEngine] = useState('SurrealDB');
  const [choice, setChoice] = useState('use');
  const tmr = useRef(null);
  useEffect(() => () => clearTimeout(tmr.current), []);
  const order = ['connect', 'found', 'keys'];
  const stepIdx = step === 'verifying' ? 0 : order.indexOf(step);
  const chosen = DATA_CHOICES.find(c => c.k === choice);
  function verify() { setStep('verifying'); clearTimeout(tmr.current); tmr.current = setTimeout(() => setStep('found'), 1100); }

  return (
    <div>
      <div className="m1steps">
        {['Connect', 'Data', 'Keys'].map((label, i) => (
          <div key={label} className={'m1step ' + (i < stepIdx ? 'done' : i === stepIdx ? 'now' : '')}>
            <span className="n">{i < stepIdx ? '✓' : i + 1}</span>{label}
          </div>
        ))}
      </div>
      <p className="pscreen-eye">M3 · own your stack</p>

      {step === 'connect' && (
        <React.Fragment>
          <h1 className="pscreen-title">Connect a database</h1>
          <p className="pscreen-desc">Connecting only proves Restormel can <b>reach</b> your database — nothing is read into it, copied, or overwritten. You choose what happens to the data in the next step.</p>
          <div className="m3banner blue"><span>ⓘ</span><span>Your graph lives in the <b>Restormel managed store</b> today. Moving to your own DB doesn’t move it — you’ll decide next.</span></div>
          <div className="m1card">
            <div className="m1lbl">Choose an engine</div>
            <div className="m3eng">
              {ENGINES.map(e => (
                <button key={e.k} className={'m3engb ' + (engine === e.k ? 'sel' : '')} onClick={() => setEngine(e.k)}>{e.k}<small>{e.d}</small></button>
              ))}
            </div>
          </div>
          <div className="m1card">
            <div className="m3fld"><label>Connection URL</label><div className="m3in">wss://db.acme.internal:8000/rpc</div></div>
            <div className="m3row">
              <div className="m3fld"><label>Namespace</label><div className="m3in">acme</div></div>
              <div className="m3fld"><label>Database</label><div className="m3in">prod_graph</div></div>
            </div>
            <div className="m3fld"><label>Credentials</label><div className="m3in">••••••••  ·  stored encrypted</div></div>
          </div>
          <div className="m1foot">
            <span className="m1hint">Read-only check — we only confirm we can reach it. Nothing is written.</span>
            <button className="pbtn primary" onClick={verify}>Connect &amp; verify →</button>
          </div>
        </React.Fragment>
      )}

      {step === 'verifying' && (
        <div className="m3verify"><span className="sp"></span><div><b>Reaching {engine} · acme/prod_graph</b><small>read-only handshake — confirming we can connect, writing nothing</small></div></div>
      )}

      {step === 'found' && (
        <React.Fragment>
          <h1 className="pscreen-title">This database isn’t empty</h1>
          <div className="m3found"><span className="fic">✓</span><span>Connected to <b>{engine} · acme/prod_graph</b>. It already holds a graph — <b>4,210 nodes</b>, last write 3 days ago.</span></div>
          <div className="m3prompt">Choose what happens — nothing here is destructive</div>
          <div className="m3choices">
            {DATA_CHOICES.map(c => (
              <button key={c.k} className={'m3choice ' + (choice === c.k ? 'on' : '')} onClick={() => setChoice(c.k)}>
                <span className="rd"></span>
                <div><div className="ct">{c.t}</div><div className="cd">{c.d}</div></div>
              </button>
            ))}
          </div>
          <div className="m3safe"><span>🔒</span><span><b>Nothing is deleted or overwritten.</b> Your managed copy remains until you confirm the switch — and you can switch back at any time.</span></div>
          <div className="m1foot">
            <button className="pbtn ghost sm" onClick={() => setStep('connect')}>← Connect</button>
            <span className="m1hint">You’re choosing where reads come from — reversible.</span>
            <button className="pbtn primary" onClick={() => setStep('keys')}>{chosen.cta} →</button>
          </div>
        </React.Fragment>
      )}

      {step === 'keys' && (
        <React.Fragment>
          <h1 className="pscreen-title">Bring your production keys</h1>
          <p className="pscreen-desc">What the models run on, going forward. <b>You’re not choosing ingestion models here</b> — that happens at ingest. These are the provider keys bound to your own stack.</p>
          <div className="m1card">
            <div className="m1lbl">Keys bound to this stack <span className="m1cnt">{STACK_KEYS.length}</span></div>
            <div className="m3keys">
              {STACK_KEYS.map((k, i) => (
                <div className="m3keyrow" key={i}>
                  <span className="kprov">{k.prov}</span>
                  <span className="kuse">{k.use}</span>
                  <span className="klive"><span className="dotlive"></span>Live</span>
                </div>
              ))}
            </div>
            <button className="srcbtn add">+ Add another key</button>
          </div>
          <div className="aha">
            <div className="at"><b>Your stack — your DB, your keys.</b> The graph now reads from {engine}, served on infrastructure you own.</div>
            <button className="pbtn primary ab" onClick={() => { complete('m3'); go('home'); }}>Bind keys &amp; finish →</button>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

/* ───────────────────────── M4 · CONNECT ───────────────────────── */
const CONN_TYPES = [
  { k: 'widget', name: 'Chat widget', tag: 'No code', desc: 'A ready-made chat box for your site. Paste one snippet.' },
  { k: 'mcp', name: 'MCP server', tag: 'For agents', desc: 'Plug into Claude, Cursor, or any AI agent.' },
  { k: 'api', name: 'REST API', tag: 'Any app', desc: 'Call your graph over HTTP from any app, any language.' },
  { k: 'sdk', name: 'SDK', tag: 'JS · Python', desc: 'Typed client libraries for JavaScript & Python.' },
  { k: 'graphql', name: 'GraphQL', tag: 'Advanced', desc: 'Query nodes, links, and clusters directly.' },
];
const ACCESS_OPTS = [
  { k: 'read', label: 'Look things up', tag: 'Read-only', desc: 'Your app asks questions and pulls back ideas. Nothing in the graph changes. The safe default.' },
  { k: 'write', label: 'Look up & contribute', tag: 'Read + write', desc: 'Your agent can also add and edit ideas as it works — so the graph grows over time.' },
];
const READ_CAPS = [
  { h: 'Ask a question', d: 'grounded answer + citations', t: 'query_graph' },
  { h: 'Search ideas', d: 'semantic retrieval', t: 'retrieve_ideas' },
  { h: 'Look up an idea', d: 'fetch one by id', t: 'get_idea' },
  { h: 'Your routes', d: 'named shortcuts', t: 'list_routes' },
];
const WRITE_CAPS = [
  { h: 'Add an idea', d: 'insert a new node', t: 'create_idea' },
  { h: 'Update an idea', d: 'edit or relink', t: 'update_idea' },
];
function typeName(k) { const t = CONN_TYPES.find(x => x.k === k); return t ? t.name : k; }
function defName(k) { return ({ widget: 'site-chat', mcp: 'agent', api: 'backend', sdk: 'app', graphql: 'graph-api' })[k] || 'connection'; }
function endpointFor(c) {
  return ({
    widget: 'cdn.restormel.ai/widget.js',
    mcp: 'https://mcp.restormel.ai/' + (c.name || 'graph'),
    api: 'https://api.restormel.ai/v1/' + (c.name || 'graph'),
    sdk: 'npm i @restormel/sdk',
    graphql: 'https://api.restormel.ai/graphql',
  })[c.type];
}
function codeFor(c) {
  if (c.type === 'widget') return '<scr' + 'ipt src="https://cdn.restormel.ai/widget.js"\n        data-graph="acme-graph"></scr' + 'ipt>';
  if (c.type === 'mcp') return '{\n  "mcpServers": {\n    "' + c.name + '": {\n      "url": "' + endpointFor(c) + '"\n    }\n  }\n}';
  if (c.type === 'api') return 'curl ' + endpointFor(c) + '/query \\\n  -H "Authorization: Bearer rk_live_…" \\\n  -d \'{"q":"What is our refund policy?"}\'';
  if (c.type === 'sdk') return 'import { Restormel } from "@restormel/sdk";\nconst graph = new Restormel("rk_live_…");\nawait graph.ask("What is our refund policy?");';
  if (c.type === 'graphql') return 'query {\n  ask(q: "What is our refund policy?") {\n    answer\n    citations { source }\n  }\n}';
  return '';
}

function ConnIcon({ type, size = 18 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (type === 'widget') return <svg {...p}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" /></svg>;
  if (type === 'mcp') return <svg {...p}><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0z" /><path d="M12 16v6" /></svg>;
  if (type === 'api') return <svg {...p}><path d="M7 8l-4 4 4 4M3 12h11" /><path d="M17 8l4 4-4 4M21 12h-4" opacity="0.45" /></svg>;
  if (type === 'sdk') return <svg {...p}><path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13 7l-2 10" /></svg>;
  if (type === 'graphql') return <svg {...p}><circle cx="12" cy="4" r="2" /><circle cx="5" cy="17" r="2" /><circle cx="19" cy="17" r="2" /><path d="M12 6L5.6 15.4M12 6l6.4 9.4M7 17h10" /></svg>;
  return null;
}

function M4Connect({ s, complete, go }) {
  const initialConns = s.persona === 'advanced'
    ? [{ id: 1, type: 'mcp', access: 'read', name: 'agent-readonly' }, { id: 2, type: 'widget', access: 'read', name: 'site-chat' }]
    : [];
  const [conns, setConns] = useState(initialConns);
  const [view, setView] = useState(initialConns.length ? 'list' : 'wizard');
  const [detailId, setDetailId] = useState(null);
  const [wstep, setWstep] = useState('type');
  const [draft, setDraft] = useState({ type: 'widget', access: 'read', name: '' });

  function startNew() { setDraft({ type: 'widget', access: 'read', name: '' }); setWstep('type'); setView('wizard'); }
  function pickType(k) { setDraft(d => ({ ...d, type: k })); setWstep('access'); }
  function pickAccess(k) { setDraft(d => ({ ...d, access: k })); setWstep('name'); }
  function create() {
    const id = Date.now();
    const name = draft.name.trim() || defName(draft.type);
    setConns(c => [...c, { id, type: draft.type, access: draft.access, name }]);
    complete('m4');
    setDetailId(id); setView('detail');
  }
  function del(id) { setConns(c => c.filter(x => x.id !== id)); if (detailId === id) { setView('list'); setDetailId(null); } }
  const detail = conns.find(c => c.id === detailId);

  if (view === 'wizard') {
    const wi = ['type', 'access', 'name'].indexOf(wstep);
    return (
      <div>
        <div className="m1steps">
          {['Type', 'Access', 'Name'].map((label, i) => (
            <div key={label} className={'m1step ' + (i < wi ? 'done' : i === wi ? 'now' : '')}><span className="n">{i < wi ? '✓' : i + 1}</span>{label}</div>
          ))}
        </div>
        <p className="pscreen-eye">M4 · connect · new connection</p>
        <h1 className="pscreen-title">{wstep === 'type' ? 'How will your app connect?' : wstep === 'access' ? 'What can it do?' : 'Name this connection'}</h1>
        <div className="m4wiz">
          <div className="m4wizmain">
            {wstep === 'type' && (
              <div className="m4types">
                {CONN_TYPES.map(t => (
                  <button key={t.k} className="m4type" onClick={() => pickType(t.k)}>
                    <span className="m4ic"><ConnIcon type={t.k} /></span>
                    <div className="m4tbody"><div className="m4tname">{t.name}</div><div className="m4tdesc">{t.desc}</div></div>
                    <span className="m4tag">{t.tag}</span>
                    <span className="m4arr">→</span>
                  </button>
                ))}
              </div>
            )}
            {wstep === 'access' && (
              <React.Fragment>
                <div className="m4acc">
                  {ACCESS_OPTS.map(a => (
                    <button key={a.k} className={'m4accb ' + (draft.access === a.k ? 'on' : '')} onClick={() => pickAccess(a.k)}>
                      <span className="rd"></span>
                      <div><div className="m4acclbl">{a.label} <span className="m4acctag">{a.tag}</span></div><div className="m4accdesc">{a.desc}</div></div>
                    </button>
                  ))}
                </div>
                <div className="m4note">Want <b>one that looks up</b> and <b>one that also contributes</b>? Make two — a read-only and a read+write connection are just separate entries, each with its own key.</div>
                <div className="m1foot"><button className="pbtn ghost sm" onClick={() => setWstep('type')}>← Type</button></div>
              </React.Fragment>
            )}
            {wstep === 'name' && (
              <div className="m1card">
                <div className="m1lbl">Connection name</div>
                <input className="m1key" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder={defName(draft.type)} autoFocus />
                <div className="m4namehint">A label you’ll recognize in the list — e.g. <b>{defName(draft.type)}</b>, <b>prod-agent</b>, <b>marketing-site</b>.</div>
                <div className="m1foot" style={{ marginTop: 14 }}>
                  <button className="pbtn ghost sm" onClick={() => setWstep('access')}>← Access</button>
                  <button className="pbtn primary" style={{ marginLeft: 'auto' }} onClick={create}>Create connection →</button>
                </div>
              </div>
            )}
          </div>
          <div className="m4prev">
            <div className="m4prevh">Live preview</div>
            <div className="m4prevrow"><span>Type</span><b>{typeName(draft.type)}</b></div>
            <div className="m4prevrow"><span>Access</span><b>{draft.access === 'write' ? 'Read + write' : 'Read-only'}</b></div>
            <div className="m4prevrow"><span>Name</span>{draft.name.trim() ? <b>{draft.name.trim()}</b> : <i>{wstep === 'name' ? 'type a name' : 'next step'}</i>}</div>
            <div className="m4prevrow"><span>Endpoint</span><i>on create</i></div>
            <div className="m4prevrow"><span>Key</span><i>on create</i></div>
          </div>
        </div>
        {conns.length > 0 && <div className="m1foot" style={{ marginTop: 16 }}><button className="pbtn ghost sm" onClick={() => setView('list')}>← Cancel, back to connections</button></div>}
      </div>
    );
  }

  if (view === 'detail' && detail) {
    const caps = detail.access === 'write' ? READ_CAPS.concat(WRITE_CAPS) : READ_CAPS;
    return (
      <div>
        <div className="pscreen-bar2">
          <button className="pback" onClick={() => { setView('list'); setDetailId(null); }}>← Connections</button>
          <span className="pcrumb">Connections <span style={{ opacity: 0.5 }}>/</span> <span className="here">{detail.name}</span></span>
        </div>
        <p className="pscreen-eye">M4 · connect</p>
        <h1 className="pscreen-title">{detail.name}</h1>
        <div className="m4drow">
          <span className="m4dbadge"><span className="m4ic sm"><ConnIcon type={detail.type} size={14} /></span>{typeName(detail.type)}</span>
          <span className={'m4access ' + detail.access}>{detail.access === 'write' ? 'Read + write' : 'Read-only'}</span>
          <span className="m4live"><span className="dotlive"></span>Live</span>
        </div>
        <div className="m1card">
          <div className="m1lbl">Endpoint</div>
          <div className="m4endp"><code>{endpointFor(detail)}</code><button className="pbtn sm">Copy</button></div>
        </div>
        <div className="m4code">
          <div className="m4codeh">{detail.type === 'widget' ? 'Paste before end of body' : detail.type === 'mcp' ? 'Add to your agent config' : detail.type === 'sdk' ? 'Install & call' : 'Call it'}</div>
          <pre>{codeFor(detail)}</pre>
        </div>
        <div className="m1card">
          <div className="m1lbl">What your app can do</div>
          <div className="m4caps">
            {caps.map(c => (
              <div className="m4cap" key={c.t}><div className="m4caph">{c.h}</div><div className="m4capd">{c.d}</div><span className="m4capt">{c.t}</span></div>
            ))}
          </div>
        </div>
        <div className="m4dactions">
          <button className="pbtn ghost sm">Rotate key</button>
          <button className="pbtn ghost sm" onClick={startNew}>+ Another connection</button>
          <button className="pbtn ghost sm danger" onClick={() => del(detail.id)}>Delete</button>
          <button className="pbtn primary" style={{ marginLeft: 'auto' }} onClick={() => go('home')}>Done → Graph home</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="pscreen-eye">M4 · connect</p>
      <h1 className="pscreen-title">Your connections</h1>
      <p className="pscreen-desc">Each way your app reaches the graph is a connection — make as many as you need. A read-only widget for your site, a read+write MCP for an agent, a REST key for your backend.</p>
      <div className="m4list">
        {conns.map(c => (
          <button key={c.id} className="m4lrow" onClick={() => { setDetailId(c.id); setView('detail'); }}>
            <span className="m4ic"><ConnIcon type={c.type} /></span>
            <div className="m4lbody"><div className="m4lname">{c.name}</div><div className="m4lmeta">{typeName(c.type)} · {c.access === 'write' ? 'read + write' : 'read-only'}</div></div>
            <span className="m4live"><span className="dotlive"></span>Live</span>
            <span className="m4arr">→</span>
          </button>
        ))}
        {conns.length === 0 && <div className="srcempty">No connections yet.</div>}
      </div>
      <button className="pbtn primary" style={{ marginTop: 16 }} onClick={startNew}>+ New connection</button>
      <p className="pfoot-hint">Archetype note — <b>Initial</b> makes one widget and stops; <b>Learning</b> a widget or REST key; <b>Advanced</b> runs several at once (MCP read-only + read+write, API, GraphQL). Same screen, different depth.</p>
    </div>
  );
}

/* ───────────────────────── STUB ───────────────────────── */
function Stub({ id, s, complete, go }) {
  const m = META[id];
  const built = {
    m1: 'Add a source + a provider key, launch ingest, watch per-stage progress, then ask your own data.',
    m2: 'The make-ready hub: Sources → Embed → Validate gates, then triage flagged claims until trust climbs.',
    m3: 'Connect your own database (a safe, read-only check), choose what happens to existing data, then bind production keys.',
    m4: 'Pick a connection type (widget / MCP / API / GraphQL), set read vs read+write, name it, and manage many connections.',
  }[id];
  return (
    <div className="pscreen">
      <p className="pscreen-eye">{m.name} · {m.sub}</p>
      <h1 className="pscreen-title">{m.title}</h1>
      <div className="stub">
        <div><b>This screen is being built in the next pass.</b></div>
        <div style={{ marginTop: 8 }}>{built}</div>
        <div style={{ marginTop: 8, color: 'var(--color-ink-faint)' }}>For now, complete it to walk the full {PERSONAS[s.persona].label} path end-to-end.</div>
        <div className="stub-actions">
          <button className="pbtn primary" onClick={() => { complete(id); go('home'); }}>Complete {m.name} →</button>
          <button className="pbtn ghost" onClick={() => go('home')}>Back to home</button>
        </div>
      </div>
      <p className="pfoot-hint">Walkable skeleton — the real interactions for {m.name} land in pass {({ m1: 'P3', m2: 'P4', m3: 'P5', m4: 'P6' })[id]}.</p>
    </div>
  );
}

/* ───────────────────────── RUNS (ingest history) ───────────────────────── */
function Runs({ s, go }) {
  const has = !!s.progress.m1;
  return (
    <div className="pscreen">
      <p className="pscreen-eye">Runs · ingest history</p>
      <h1 className="pscreen-title">Runs</h1>
      {has ? (
        <React.Fragment>
          <p className="pscreen-desc">Every ingest run, with the stages it went through. Re-run from Sources when you add documents.</p>
          <div className="runlist">
            <div className="runrow">
              <span className="rst ok">✓ Done</span>
              <div className="rmain">Ingest · {s.graph.sources} source{s.graph.sources > 1 ? 's' : ''}<small>extract · relate · group · embed → {s.graph.ideas.toLocaleString()} ideas</small></div>
              <span className="rmeta">4m 12s<br />2 days ago</span>
              <button className="pbtn sm ghost" onClick={() => go('claims')}>View</button>
            </div>
          </div>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <div className="rmempty"><div className="ei">▦</div><div className="et">No runs yet</div><div className="ed">Ingest runs show up here once you build a graph. Head to Sources to start your first run.</div></div>
          <div className="m1foot" style={{ marginTop: 18 }}><button className="pbtn primary" style={{ marginLeft: 'auto' }} onClick={() => go('sources')}>Go to Sources →</button></div>
        </React.Fragment>
      )}
    </div>
  );
}

/* ───────────────────────── PROVE (ask your graph) ───────────────────────── */
function Prove({ s, go }) {
  const [ans, setAns] = useState(null);
  const [asking, setAsking] = useState(false);
  const tmr = useRef(null);
  useEffect(() => () => clearTimeout(tmr.current), []);
  const has = !!s.progress.m1;
  function ask(qa) { setAns(null); setAsking(true); clearTimeout(tmr.current); tmr.current = setTimeout(() => { setAsking(false); setAns(qa); }, 800); }
  return (
    <div className="pscreen">
      <p className="pscreen-eye">Prove · answer from your graph</p>
      <h1 className="pscreen-title">Prove it</h1>
      <p className="pscreen-desc">Ask your graph anything — answers come back grounded in your sources, with citations. This is exactly what your connected apps will get.</p>
      {!has ? (
        <React.Fragment>
          <div className="rmempty"><div className="ei">?</div><div className="et">Ingest first</div><div className="ed">Prove answers from your own knowledge — build a graph in Sources, then come back here.</div></div>
          <div className="m1foot" style={{ marginTop: 18 }}><button className="pbtn primary" style={{ marginLeft: 'auto' }} onClick={() => go('sources')}>Go to Sources →</button></div>
        </React.Fragment>
      ) : (
        <div className="m0grid">
          <div className="askcard"><div className="lbl">Ask your graph</div><div className="chips">{YOUR_QA.map((qa, i) => <button key={i} className="chip" onClick={() => ask(qa)}><span className="q">Q</span>{qa.q}</button>)}</div></div>
          {(asking || ans) && (
            <div className="answer">
              <div className="a-q"><span className="qm">?</span>{(ans || {}).q}</div>
              {asking ? <div className="a-think"><span className="sp"></span>Searching your graph · retrieving grounded passages…</div> : (
                <React.Fragment><div className="a-body">{ans.a}</div><div className="a-cites">{ans.cites.map((c, i) => <span className="cite" key={i}><span className="cn">↗</span>{c}</span>)}</div></React.Fragment>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── SECTION placeholder ───────────────────────── */
const SECTION_META = {
  providers: ['Providers', 'Inbound model providers — Together, Voyage, Anthropic — that ingest and serving run on. Paste a key once; every stage can use it.'],
  routes: ['Routes', 'Saved query shortcuts your connections expose to apps and agents — e.g. “Exec summary”, “Customer signal”.'],
  audit: ['Audit log', 'Every read and write against your graph, by connection — who asked what, when, and which sources answered. Advanced; rarely needed day to day.'],
  metrics: ['Metrics', 'How often your chatbot, MCP, and API are used — calls, latency, and cost over time. Advanced; check it occasionally.'],
};
function Section({ slug }) {
  const [t, d] = SECTION_META[slug] || [TITLES[slug] || 'Section', '—'];
  return (
    <div className="pscreen">
      <p className="pscreen-eye">{slug}</p>
      <h1 className="pscreen-title">{t}</h1>
      <div className="rmempty"><div className="ei">▤</div><div className="et">{t}</div><div className="ed">{d}<br /><br />A real section in the product — this prototype focuses on the M0–M4 golden path. The sidebar shows where it lives.</div></div>
    </div>
  );
}

/* ───────────────────────── SCREEN WRAPPER ───────────────────────── */
/* ── BUILD (ingest + runs history) ── */
function Build({ s, complete, go }) {
  const [tab, setTab] = useState('ingest');
  if (!s.progress.m1) return <M1Ingest s={s} complete={complete} go={go} />;
  return (
    <div>
      <div className="rmtabs">
        <button className={'rmtab' + (tab === 'ingest' ? ' on' : '')} onClick={() => setTab('ingest')}>Sources</button>
        <button className={'rmtab' + (tab === 'runs' ? ' on' : '')} onClick={() => setTab('runs')}>Runs</button>
      </div>
      {tab === 'ingest' ? <M1Ingest s={s} complete={complete} go={go} /> : <Runs s={s} go={go} />}
    </div>
  );
}

/* ── VERIFY (claims triage + prove harness) ── */
function Verify({ s, complete, go }) {
  const [tab, setTab] = useState('claims');
  if (!s.progress.m1) return (
    <div className="pscreen">
      <p className="pscreen-eye">Verify · trust</p><h1 className="pscreen-title">Verify</h1>
      <div className="rmempty"><div className="ei">!</div><div className="et">Build first</div><div className="ed">There’s nothing to verify until you’ve built a graph. Head to Build to ingest your sources.</div></div>
      <div className="m1foot" style={{ marginTop: 18 }}><button className="pbtn primary" style={{ marginLeft: 'auto' }} onClick={() => go('build')}>Go to Build →</button></div>
    </div>
  );
  return (
    <div>
      <div className="rmtabs">
        <button className={'rmtab' + (tab === 'claims' ? ' on' : '')} onClick={() => setTab('claims')}>Claims{!s.progress.m2 && s.graph.flagged ? <span className="rmtabb">{s.graph.flagged}</span> : null}</button>
        <button className={'rmtab' + (tab === 'prove' ? ' on' : '')} onClick={() => setTab('prove')}>Prove</button>
      </div>
      {tab === 'claims' ? <M2MakeReady s={s} complete={complete} go={go} /> : <Prove s={s} go={go} />}
    </div>
  );
}

function Screen({ s, go, children }) {
  return (
    <div className="pscreen">
      <div className="pscreen-bar">
        <button className="pback" onClick={() => go('home')}>← Graph home</button>
        <span className="pcrumb">Graph home <span style={{ opacity: 0.5 }}>/</span> <span className="here">{META[s.screen] ? META[s.screen].name + ' · ' + META[s.screen].sub : ''}</span></span>
      </div>
      {children}
    </div>
  );
}

/* ───────────────────────── APP ───────────────────────── */
function App() {
  const [s, setS] = useProto();
  const go = (id) => setS(p => ({ ...p, screen: MILE_TO_SECTION[id] || id }));
  const complete = (id) => setS(p => ({ ...p, progress: { ...p.progress, [id]: true }, graph: applyEffect(id, p.graph) }));
  const onPersona = (persona) => setS(() => ({ ...freshState(persona) }));

  const sc = MILE_TO_SECTION[s.screen] || s.screen;
  let view;
  if (sc === 'home') view = (!s.progress.m0) ? <M0Explore s={s} complete={complete} go={go} /> : <GraphHome s={s} go={go} />;
  else if (sc === 'build') view = <Build s={s} complete={complete} go={go} />;
  else if (sc === 'verify') view = <Verify s={s} complete={complete} go={go} />;
  else if (sc === 'connect') view = <M4Connect s={s} complete={complete} go={go} />;
  else if (sc === 'store') view = <M3OwnStack s={s} complete={complete} go={go} />;
  else view = <Section slug={sc} />;

  return (
    <div className="rmshell">
      <Sidebar s={s} go={go} />
      <div className="rmmain">
        <Topbar s={s} persona={s.persona} onPersona={onPersona} />
        <main className="rmcontent"><div className="rmcontent-inner">{view}</div></main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
