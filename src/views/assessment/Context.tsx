import { navigate } from '../../App';
import { CheckboxGroup, Field, RadioGroup, Segmented } from '../../components/ui';
import { PROFILES } from '../../model/catalogue';
import { bandLabel, localOptions, profileText } from '../../i18n/localize';
import { useT } from '../../i18n/ui';
import { useLang } from '../../lib/i18n';
import { privacyUrl } from '../../lib/links';
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

export function ContextScreen({ screen }: { screen: 'c1' | 'c2' | 'c3' }) {
  const { ctx } = useAssessment();
  const set = (p: Partial<AssessmentContext>) => setContext(p);
  const lang = useLang();
  const t = useT();
  const TRI = TRI_VALUES.map((value) => ({ value, label: t.tri[value] }));

  let kicker = '';
  let title = '';
  let sub = '';
  let ok = false;
  let body: React.ReactNode = null;

  if (screen === 'c1') {
    kicker = t.ctxKicker(1);
    title = t.c1Title;
    sub = t.c1Sub;
    ok = !!ctx.role && ctx.ownershipTags.length > 0 && !!ctx.managementModel;
    body = (
      <>
        <PrivacyNotice />
        <Field id="f-role" label={t.roleLabel} why={t.roleWhy}>
          <RadioGroup label={t.roleAria} choices={localOptions(lang, 'role', ROLE_OPTIONS)} value={ctx.role} onChange={(role) => set({ role })} />
        </Field>
        <Field id="f-own" label={t.ownLabel} why={t.ownWhy}>
          <CheckboxGroup label={t.ownAria} choices={localOptions(lang, 'ownership', OWNERSHIP_OPTIONS)} values={ctx.ownershipTags}
            onToggle={(v: OwnershipTag) => set({ ownershipTags: v === 'unknown' ? (ctx.ownershipTags.includes('unknown') ? [] : ['unknown']) : toggle(ctx.ownershipTags.filter((x) => x !== 'unknown'), v) })} />
        </Field>
        <Field id="f-mgmt" label={t.mgmtLabel} why={t.mgmtWhy}>
          <RadioGroup label={t.mgmtAria} choices={localOptions(lang, 'management', MANAGEMENT_OPTIONS)} value={ctx.managementModel} onChange={(managementModel) => set({ managementModel })} />
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
      </>
    );
  } else if (screen === 'c2') {
    const sug = suggestProfile(ctx);
    kicker = t.ctxKicker(2);
    title = t.c2Title;
    sub = t.c2Sub;
    ok = ctx.objectives.length > 0 && !!ctx.perimeter && !!ctx.horizon && !!ctx.profile;
    body = (
      <>
        <Field id="f-obj" label={t.objLabel} why={t.objWhy}>
          <CheckboxGroup label={t.objAria} choices={localOptions(lang, 'objective', OBJECTIVE_OPTIONS)} values={ctx.objectives} onToggle={(v) => set({ objectives: toggle(ctx.objectives, v) })} />
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
      </>
    );
  } else {
    kicker = t.ctxKicker(3);
    title = t.c3Title;
    sub = t.c3Sub;
    ok = !!ctx.liquidity && TRIGGER_OPTIONS.every((t) => !!ctx.triggers[t.value]) && !!ctx.sellerType && !!ctx.sellerTaxStatus;
    body = (
      <>
        <Field id="f-liq" label={t.liqLabel} why={t.liqWhy}>
          <RadioGroup label={t.liqAria} choices={localOptions(lang, 'liquidity', LIQUIDITY_OPTIONS)} value={ctx.liquidity} onChange={(liquidity) => set({ liquidity })} min="220px" />
        </Field>
        <Field id="f-trig" label={t.trigLabel} why={t.trigWhy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {localOptions(lang, 'trigger', TRIGGER_OPTIONS).map((o) => (
              <div key={o.value} className="opt" style={{ cursor: 'default', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span id={`trig-${o.value}`}>{o.label}</span>
                <Segmented label={o.label} choices={TRI} value={ctx.triggers[o.value]} onChange={(v) => set({ triggers: { ...ctx.triggers, [o.value]: v } })} />
              </div>
            ))}
          </div>
        </Field>
        <Field id="f-sel" label={t.selLabel} why={t.selWhy}>
          <RadioGroup label={t.selAria} choices={localOptions(lang, 'sellerType', SELLER_TYPE_OPTIONS)} value={ctx.sellerType} onChange={(sellerType) => set({ sellerType })} />
        </Field>
        <Field id="f-tax" label={t.taxLabel} why={t.taxWhy}>
          <RadioGroup label={t.taxAria} choices={localOptions(lang, 'sellerTax', SELLER_TAX_OPTIONS)} value={ctx.sellerTaxStatus} onChange={(sellerTaxStatus) => set({ sellerTaxStatus })} min="220px" />
        </Field>
      </>
    );
  }

  const order = ['c1', 'c2', 'c3', 'summary'] as const;
  const i = order.indexOf(screen);
  return (
    <main className="app-main">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="kicker">{kicker}</div>
        <h1 className="h1" style={{ fontSize: 'clamp(30px,3.6vw,44px)' }}>{title}</h1>
        <p className="lead" style={{ color: 'rgba(255,255,255,0.86)', fontSize: 17 }}>{sub}</p>
      </div>
      {screen !== 'c1' && <Banners />}
      {body}
      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => (i === 0 ? navigate('/') : go(order[i - 1]))}>{t.back}</button>
        <div className="right">
          {!ok && <span className="hint">{t.answerEach}</span>}
          <button type="button" className="btn btn-lime" disabled={!ok} onClick={() => go(order[i + 1])}>{screen === 'c3' ? t.reviewSetup : t.continue}</button>
        </div>
      </div>
    </main>
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
  const t = useT();
  const lang = useLang();
  return (
    <section className="glass" aria-labelledby="privacy-title" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
      <h2 id="privacy-title" style={{ margin: 0, fontSize: 15 }}>{t.privacyTitle}</h2>
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.84)' }}>
        {t.privacyBody}
      </p>
      <a href={privacyUrl(lang)} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start', fontSize: 13 }}>{t.privacyLink}</a>
    </section>
  );
}
