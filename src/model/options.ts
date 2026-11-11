// Option lists and English copy for the context fields (section 3) and the
// discovery screens (section 9). Values are stable ids that get persisted;
// labels are presentation only.

import type {
  Horizon, Liquidity, ManagementModel, Objective, OwnershipTag, Perimeter, RespondentRole,
  SellerTaxStatus, SellerType, TriggerKey,
} from './types';

export type Opt<T extends string> = { value: T; label: string };

export const ROLE_OPTIONS: Opt<RespondentRole>[] = [
  { value: 'owner', label: 'Owner or shareholder' },
  { value: 'management', label: 'Management' },
  { value: 'cfo', label: 'CFO or finance' },
  { value: 'corporate_ma', label: 'Corporate M&A' },
  { value: 'investor', label: 'Investor' },
  { value: 'adviser', label: 'Adviser' },
  { value: 'other', label: 'Other' },
];

export const OWNERSHIP_OPTIONS: Opt<OwnershipTag>[] = [
  { value: 'private_family', label: 'Private or family' },
  { value: 'corporate_group', label: 'Corporate group' },
  { value: 'pe', label: 'Private equity' },
  { value: 'vc', label: 'Venture capital' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Not sure' },
];

export const MANAGEMENT_OPTIONS: Opt<ManagementModel>[] = [
  { value: 'owner_led', label: 'Owner-led' },
  { value: 'employed', label: 'Employed management' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'unknown', label: 'Not sure' },
];

export const OBJECTIVE_OPTIONS: Opt<Objective>[] = [
  { value: 'full_sale', label: 'Full sale' },
  { value: 'partial_sale', label: 'Partial sale' },
  { value: 'succession', label: 'Succession' },
  { value: 'growth_capital', label: 'Growth capital' },
  { value: 'exploration', label: 'Exploring options' },
  { value: 'ipo', label: 'IPO' },
  { value: 'distress', label: 'Distress or restructuring' },
];

export const PERIMETER_OPTIONS: Opt<Perimeter>[] = [
  { value: 'whole_business', label: 'Whole standalone business' },
  { value: 'subsidiary', label: 'Subsidiary of a group' },
  { value: 'business_unit_assets', label: 'Business unit or assets' },
  { value: 'minority_interest', label: 'Minority interest' },
  { value: 'undecided', label: 'Undecided' },
];

export const HORIZON_OPTIONS: Opt<Horizon>[] = [
  { value: 'under_6', label: 'Under 6 months' },
  { value: 'm6_18', label: '6 to 18 months' },
  { value: 'm19_36', label: '19 to 36 months' },
  { value: 'over_36', label: 'Over 36 months' },
  { value: 'undecided', label: 'Undecided' },
];

export const LIQUIDITY_OPTIONS: Opt<Liquidity>[] = [
  { value: 'no_pressure', label: 'No known pressure' },
  { value: 'potential', label: 'Potential pressure requiring review' },
  { value: 'acute', label: 'Confirmed acute pressure' },
  { value: 'unknown', label: 'Unknown' },
];

export const TRIGGER_OPTIONS: Opt<TriggerKey>[] = [
  { value: 'debt', label: 'External or shareholder debt, security or guarantees' },
  { value: 'acquisitions', label: 'A past acquisition with ongoing integration obligations' },
  { value: 'employee_equity', label: 'Employee or management equity: options, shares, virtual equity or a MIP' },
  { value: 'preferences', label: 'Investor preferences or other special investor rights' },
  { value: 'convertibles', label: 'Convertible notes or other converting instruments' },
  { value: 'regulated', label: 'Material business licences, permits or regulatory approvals' },
  { value: 'contingent', label: 'Earn-out, rollover or deferred payment under discussion' },
  { value: 'group_dependency', label: 'Material dependence on a group that stays behind' },
];

export const SELLER_TYPE_OPTIONS: Opt<SellerType>[] = [
  { value: 'individuals', label: 'Individuals' },
  { value: 'holding_companies', label: 'Personal holding companies' },
  { value: 'corporate_parent', label: 'A corporate parent' },
  { value: 'funds', label: 'Investment funds' },
  { value: 'mixed', label: 'A mix of these' },
  { value: 'unknown', label: 'Not sure' },
];

export const SELLER_TAX_OPTIONS: Opt<SellerTaxStatus>[] = [
  { value: 'same', label: 'All in the company’s country' },
  { value: 'different', label: 'In another country' },
  { value: 'multiple', label: 'Spread across several countries' },
  { value: 'unknown', label: 'Not sure' },
];

export const REVENUE_BANDS = ['Under €5m', '€5–20m', '€20–50m', '€50–150m', 'Over €150m', 'Prefer not to say'];
export const EMPLOYEE_BANDS = ['Under 25', '25–99', '100–249', '250–999', '1,000 or more', 'Prefer not to say'];
export const BUSINESS_MODELS = ['Software / SaaS', 'IT and technology services', 'Industrial technology', 'Manufacturing', 'Project business', 'Trade and distribution', 'Other services', 'Other'];

export function labelOf<T extends string>(opts: Opt<T>[], v: T | null | undefined): string {
  return opts.find((o) => o.value === v)?.label ?? 'Not set';
}

// ── Discovery screens (section 9) ────────────────────────────────────────────

export type DiscoveryScreen =
  | { id: 'E01'; theme: string; kind: 'multi'; title: string; help: string; options: string[]; max: number }
  | { id: 'E03' | 'E04' | 'E07'; theme: string; kind: 'band'; title: string; help: string; options: string[] }
  | { id: 'E02' | 'E05' | 'E06' | 'E08'; theme: string; kind: 'control'; control: string; title: string | null; help: string };

export const DISCOVERY: DiscoveryScreen[] = [
  { id: 'E01', theme: 'Strengths', kind: 'multi', max: 3, title: 'What is the strongest reason a potential buyer should be interested in your business?', help: 'Choose up to three. This is a preference and is not scored.', options: ['Customer loyalty', 'Distinctive products or technology', 'Experienced team', 'Recurring revenue', 'Market position', 'Operational capabilities', 'Growth opportunities', 'Other'] },
  { id: 'E02', theme: 'Strengths', kind: 'control', control: 'Q19', title: 'What evidence supports the reasons customers choose your business over lower-priced alternatives?', help: 'Pick the statement that describes the evidence you have today.' },
  { id: 'E03', theme: 'Revenue', kind: 'band', title: 'How much of your revenue over the next 12 months is already secured through contractual commitments?', help: 'Optional. A rough band is enough. Not scored. A low share is not automatically a weakness.', options: ['Under 25%', '25 to 50%', '50 to 75%', 'Over 75%', 'Not yet calculated'] },
  { id: 'E04', theme: 'Revenue', kind: 'band', title: 'What percentage of annual revenue would be affected by the loss of your largest customer?', help: 'Optional. A rough band is enough. Not scored.', options: ['Under 10%', '10 to 20%', '20 to 30%', 'Over 30%', 'Not yet calculated'] },
  { id: 'E05', theme: 'People', kind: 'control', control: 'Q12', title: null, help: 'Buyers look at whether the business keeps running without its current decision makers.' },
  { id: 'E06', theme: 'People', kind: 'control', control: 'Q13', title: 'How effectively could essential work continue during the extended absence of a key specialist?', help: 'Think of the one or two people whose absence would hurt most.' },
  { id: 'E07', theme: 'Growth', kind: 'band', title: 'Where would your business face the greatest pressure if demand increased by 30%?', help: 'The 30% is only an illustration. Not scored.', options: ['People and skills', 'Production or service capacity', 'Suppliers', 'Technology and systems', 'Working capital', 'Other', 'Not assessed'] },
  { id: 'E08', theme: 'Preparation', kind: 'control', control: 'Q25', title: 'Have you engaged a transaction-experienced tax adviser and agreed on the scope of their review?', help: 'A general tax adviser is not the same as transaction-specific analysis.' },
];

export const STATUS_LABELS: Record<string, string> = {
  unknown: 'Unknown',
  needs_internal_confirmation: 'Needs internal confirmation',
  needs_adviser_review: 'Needs adviser review',
  withheld: 'Prefer not to answer',
  not_applicable_requested: 'Not applicable?',
  not_applicable_confirmed: 'Not applicable (confirmed)',
  conflicted: 'Conflicting answers',
};
