import { navigate } from '../../App';
import { CheckboxGroup, Field, RadioGroup, Segmented } from '../../components/ui';
import { PROFILES } from '../../model/catalogue';
import { bandLabel, localOptions, profileText } from '../../i18n/localize';
import { useT } from '../../i18n/ui';
import { useJT } from '../../i18n/ui-journey';
import { contextComplete, setupComplete, specialistComplete } from '../../lib/journey';
import { useLang } from '../../lib/i18n';
import {
  BUSINESS_MODELS, EMPLOYEE_BANDS, HORIZON_OPTIONS, LIQUIDITY_OPTIONS, MANAGEMENT_OPTIONS, OBJECTIVE_OPTIONS, OWNERSHIP_OPTIONS,
  PERIMETER_OPTIONS, REVENUE_BANDS, ROLE_OPTIONS, SELLER_TAX_OPTIONS, SELLER_TYPE_OPTIONS, TRIGGER_OPTIONS,
} from '../../model/options';
import { suggestProfile } from '../../model/routing';
import type { AssessmentContext, OwnershipTag, TriState } from '../../model/types';
import { go, setContext, useAssessment } from '../../lib/store';
import { Banners } from './Banners';

function toggle<T>(xs: T[], v: T): T[] {
  return xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v];
}

const TRI_VALUES: TriState[] = ['yes', 'no', 'unknown'];

/** Step 1: four unscored questions (ownership, management, objectives, liquidity). */
export function ContextScreen() {
  const { ctx } = useAssessment();
  const set = (p: Partial<AssessmentContext>) => setContext(p);
  const lang = useLang();
  const t = useT();
  const jt = useJT();
  const ok = contextComplete(ctx);
  // Someone editing the context from the setup summary goes back there, not through discovery again.
  const toSummary = setupComplete(ctx) && specialistComplete(ctx);

  return (
    <main className="app-main">
      <Heading kicker={jt.ctxKicker} title={jt.ctxTitle} sub={jt.ctxSub} />
      <PrivacyNotice />
      <Field id="f-own" label={t.ownLabel} why={t.ownWhy}>
        <CheckboxGroup label={t.ownAria} choices={localOptions(lang, 'ownership', OWNERSHIP_OPTIONS)} values={ctx.ownershipTags}
          onToggle={(v: OwnershipTag) => set({ ownershipTags: v === 'unknown' ? (ctx.ownershipTags.includes('unknown') ? [] : ['unknown']) : toggle(ctx.ownershipTags.filter((x) => x !== 'unknown'), v) })} />
      </Field>
      <Field id="f-mgmt" label={t.mgmtLabel} why={t.mgmtWhy}>
        <RadioGroup label={t.mgmtAria} choices={localOptions(lang, 'management', MANAGEMENT_OPTIONS)} value={ctx.managementModel} onChange={(managementModel) => set({ managementModel })} />
      </Field>
      <Field id="f-obj" label={t.objLabel} why={t.objWhy}>
        <CheckboxGroup label={t.objAria} choices={localOptions(lang, 'objective', OBJECTIVE_OPTIONS)} values={ctx.objectives} onToggle={(v) => set({ objectives: toggle(ctx.objectives, v) })} />
      </Field>
      <Field id="f-liq" label={t.liqLabel} why={t.liqWhy}>
        <RadioGroup label={t.liqAria} choices={localOptions(lang, 'liquidity', LIQUIDITY_OPTIONS)} value={ctx.liquidity} onChange={(liquidity) => set({ liquidity })} min="220px" />
      </Field>
      <Banners />
      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>{t.back}</button>
        <div className="right">
          {!ok && <span className="hint">{t.answerEach}</span>}
          <button type="button" className="btn btn-lime" disabled={!ok} onClick={() => go(toSummary ? 'summary' : 'discovery', toSummary ? {} : { dIdx: 0 })}>{toSummary ? jt.toSummary : jt.toDiscovery}</button>
        </div>
      </div>
    </main>
  );
}

/** Setup for the detailed assessment, after the initial picture: page 1 (you and the transaction), page 2 (specialist topics and sellers). */
export function SetupScreen({ step }: { step: 'setup' | 'specialist' }) {
  const { ctx } = useAssessment();
  const set = (p: Partial<AssessmentContext>) => setContext(p);
  const lang = useLang();
  const t = useT();
  const jt = useJT();
  const TRI = TRI_VALUES.map((value) => ({ value, label: t.tri[value] }));

  if (step === 'setup') {
    const sug = suggestProfile(ctx);
    const ok = setupComplete(ctx);
    return (
      <main className="app-main">
        <Heading kicker={jt.setupKicker(1)} title={jt.setupTitle} sub={jt.setupSub} />
        <Banners />
        <Field id="f-role" label={t.roleLabel} why={t.roleWhy}>
          <RadioGroup label={t.roleAria} choices={localOptions(lang, 'role', ROLE_OPTIONS)} value={ctx.role} onChange={(role) => set({ role })} />
        </Field>
        <Field id="f-per" label={t.perLabel} why={t.perWhy}>
          <RadioGroup label={t.perAria} choices={localOptions(lang, 'perimeter', PERIMETER_OPTIONS)} value={ctx.perimeter} onChange={(perimeter) => set({ perimeter })} />
        </Field>
        <Field id="f-hor" label={t.horLabel} why={t.horWhy}>
          <RadioGroup label={t.horAria} choices={localOptions(lang, 'horizon', HORIZON_OPTIONS)} value={ctx.horizon} onChange={(horizon) => set({ horizon })} min="160px" />
        </Field>
        <Field id="f-prof" label={t.profLabel} why={t.profWhy}>
          <RadioGroup label={t.profAria} min="280px"
            choices={[...PROFILES.map((p) => ({ value: p.key as AssessmentContext['profile'] & string, label: profileText(lang, p.key).name, sub: profileText(lang, p.key).description, tag: p.key === sug ? t.suggested : '' })),
              { value: 'UNDECIDED', label: t.undecided, sub: t.undecidedSub, tag: '' }]}
            value={ctx.profile} onChange={(profile) => set({ profile })} />
        </Field>
        <Field id="f-company" label={t.companyLabel} why={t.companyWhy}>
          <div className="grid-auto" style={{ ['--min' as string]: '200px', gap: 12 }}>
            <Select label={t.businessModel} value={ctx.company.businessModel} options={BUSINESS_MODELS} onChange={(businessModel) => set({ company: { ...ctx.company, businessModel } })} />
            <Select label={t.revenue} value={ctx.company.revenueBand} options={REVENUE_BANDS} onChange={(revenueBand) => set({ company: { ...ctx.company, revenueBand } })} />
            <Select label={t.employees} value={ctx.company.employeeBand} options={EMPLOYEE_BANDS} onChange={(employeeBand) => set({ company: { ...ctx.company, employeeBand } })} />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              {t.country}
              <input className="input" value={ctx.company.jurisdiction ?? ''} maxLength={60} placeholder={t.countryPlaceholder}
                onChange={(e) => set({ company: { ...ctx.company, jurisdiction: e.target.value || null } })} />
            </label>
          </div>
        </Field>
        <div className="nav-row">
          <button type="button" className="btn btn-ghost" onClick={() => go('picture')}>{t.back}</button>
          <div className="right">
            {!ok && <span className="hint">{t.answerEach}</span>}
            <button type="button" className="btn btn-lime" disabled={!ok} onClick={() => go('specialist')}>{t.continue}</button>
          </div>
        </div>
      </main>
    );
  }

  const ok = specialistComplete(ctx);
  return (
    <main className="app-main">
      <Heading kicker={jt.setupKicker(2)} title={t.c3Title} sub={jt.specialistSub} />
      <Banners />
      <Field id="f-trig" label={t.trigLabel} why={t.trigWhy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {localOptions(lang, 'trigger', TRIGGER_OPTIONS).map((o) => (
            <div key={o.value} className="opt trigger-row">
              <span className="trigger-text">
                <span id={`trig-${o.value}`}>{o.label}</span>
                <span className="sub">{jt.trigWhy[o.value]}</span>
              </span>
              <Segmented label={o.label} choices={TRI} value={ctx.triggers[o.value]} onChange={(v) => set({ triggers: { ...ctx.triggers, [o.value]: v } })} />
            </div>
          ))}
        </div>
      </Field>
      <Field id="f-sel" label={t.selLabel} why={`${t.selWhy} ${jt.sellerWhy}`}>
        <RadioGroup label={t.selAria} choices={localOptions(lang, 'sellerType', SELLER_TYPE_OPTIONS)} value={ctx.sellerType} onChange={(sellerType) => set({ sellerType })} />
      </Field>
      <Field id="f-tax" label={t.taxLabel} why={jt.taxResWhy}>
        <RadioGroup label={t.taxAria} choices={localOptions(lang, 'sellerTax', SELLER_TAX_OPTIONS)} value={ctx.sellerTaxStatus} onChange={(sellerTaxStatus) => set({ sellerTaxStatus })} min="220px" />
      </Field>
      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => go('setup')}>{t.back}</button>
        <div className="right">
          {!ok && <span className="hint">{t.answerEach}</span>}
          <button type="button" className="btn btn-lime" disabled={!ok} onClick={() => go('summary')}>{jt.toSummaryBtn}</button>
        </div>
      </div>
    </main>
  );
}

function Heading({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="kicker">{kicker}</div>
      <h1 className="h1" style={{ fontSize: 'clamp(30px,3.6vw,44px)' }}>{title}</h1>
      <p className="lead" style={{ color: 'rgba(255,255,255,0.86)', fontSize: 17 }}>{sub}</p>
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string | null; options: string[]; onChange: (v: string | null) => void }) {
  const lang = useLang();
  const t = useT();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
      {label}
      <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t.notSpecified}</option>
        {options.map((o) => <option key={o} value={o}>{bandLabel(lang, o)}</option>)}
      </select>
    </label>
  );
}

function PrivacyNotice() {
  const jt = useJT();
  const t = useT();
  return (
    <section className="glass privacy-note" aria-labelledby="privacy-title">
      <h2 id="privacy-title">{jt.privacyTitle}</h2>
      <p>{jt.privacyShort}</p>
      <details>
        <summary>{jt.privacyMore}</summary>
        <p>{t.privacyBody}</p>
      </details>
      <a href="/privacy">{jt.privacyNotice}</a>
    </section>
  );
}
