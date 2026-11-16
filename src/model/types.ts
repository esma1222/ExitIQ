// Core types for the ExitIQ v1 model (Product and Implementation Brief, 4 Nov 2026).
// Everything here is plain data so the same structures can be persisted,
// snapshotted and tested without a browser.

export type DimensionKey = 'S' | 'O' | 'T';
export type DomainKey =
  | 'S1' | 'S2' | 'S3'
  | 'O1' | 'O2' | 'O3' | 'O4' | 'O5'
  | 'T1' | 'T2' | 'T3' | 'T4';

export type Profile = 'OWNER' | 'CORPORATE' | 'PE' | 'VC';

export type RouteCode =
  | 'CORE' | 'DEBT' | 'CONTINGENT' | 'REGULATED' | 'INVESTOR_RIGHTS' | 'EMPLOYEE_EQUITY'
  | 'SEPARATION' | 'PE_CONTEXT' | 'CONVERTIBLE' | 'CROSS_BORDER' | 'ASSET_TRANSFER'
  | 'PARTIAL' | 'PRIMARY_CAPITAL' | 'ACQUISITIONS';

/** on = applicable, off = not applicable, pending = applicability unresolved (stays in the denominator). */
export type RouteState = 'on' | 'off' | 'pending';
export type RouteMap = Record<RouteCode, RouteState>;

export type Points = 0 | 50 | 100;

/** Section 18 answer states. Only SUBSTANTIVE carries points. */
export type AnswerStatus =
  | 'substantive'
  | 'unknown'
  | 'needs_internal_confirmation'
  | 'needs_adviser_review'
  | 'withheld'
  | 'conflicted'
  | 'not_applicable_requested'
  | 'not_applicable_confirmed';

export const UNRESOLVED_STATUSES: AnswerStatus[] = [
  'unknown', 'needs_internal_confirmation', 'needs_adviser_review', 'withheld', 'conflicted', 'not_applicable_requested',
];

/** Evidence factor v_q (section 7): 0 self-report, 0.5 dated reference with named role, 1 reviewed by an authorised reviewer. */
export type EvidenceReviewStatus = 'self_reported' | 'dated_reference' | 'reviewed';

export interface EvidenceRef {
  reference: string;          // restricted reference, e.g. "Board minutes 2026-03, data room 4.2"; never the document itself
  ownerRole: string;          // named responsible role
  asOfDate: string | null;    // ISO date
  reviewStatus: EvidenceReviewStatus;
  reviewerId?: string | null;
  reviewedAt?: string | null;
}

/** One contributor's submission for a control. More than one diverging submission makes the control CONFLICTED. */
export interface Submission {
  respondent: string;
  status: AnswerStatus;
  points?: Points;
  at: string;
}

export interface Answer {
  status: AnswerStatus;
  points?: Points;
  answeredAt: string;
  evidence?: EvidenceRef | null;
  /** Set when the control's route was switched off and on again; the old answer must be reconfirmed. */
  requiresReconfirmation?: boolean;
  /** Set while the control is outside the applicable set (answer kept for audit, excluded from calculation). */
  inactiveSince?: string | null;
  naReason?: string | null;
  submissions?: Submission[];
}

export type AnswerMap = Record<string, Answer>;

// ── Context (section 3): unscored routing metadata ───────────────────────────

export type RespondentRole = 'owner' | 'management' | 'cfo' | 'corporate_ma' | 'investor' | 'adviser' | 'other';
export type OwnershipTag = 'private_family' | 'corporate_group' | 'pe' | 'vc' | 'other' | 'unknown';
export type ManagementModel = 'owner_led' | 'employed' | 'mixed' | 'unknown';
export type Objective = 'full_sale' | 'partial_sale' | 'succession' | 'growth_capital' | 'exploration' | 'ipo' | 'distress';
export type Perimeter = 'whole_business' | 'subsidiary' | 'business_unit_assets' | 'minority_interest' | 'undecided';
export type Horizon = 'under_6' | 'm6_18' | 'm19_36' | 'over_36' | 'undecided';
export type Liquidity = 'no_pressure' | 'potential' | 'acute' | 'unknown';
export type TriState = 'yes' | 'no' | 'unknown';
export type TriggerKey = 'debt' | 'acquisitions' | 'employee_equity' | 'preferences' | 'convertibles' | 'regulated' | 'contingent' | 'group_dependency';
/**
 * Specialist triggers added in catalogue v1.2 (brief s.3):
 *  - restructuring: past reorganizations, contributions or share exchanges. Leads to an R04 review of Q28 only.
 *  - cross_border_ops: material operations, subsidiaries or employees in more than one country. Switches CROSS_BORDER on.
 * Kept apart from TriggerKey so that tables keyed by the original eight (e.g. ui-journey trigWhy) stay valid.
 */
export type TaxTriggerKey = 'restructuring' | 'cross_border_ops';
export type AnyTriggerKey = TriggerKey | TaxTriggerKey;
/** Unscored setup field (s.5): selects the Q07 growth-economics wording. */
export type EconomicsModel = 'profitable' | 'growth' | 'unknown';
export type SellerType = 'individuals' | 'holding_companies' | 'corporate_parent' | 'funds' | 'mixed' | 'unknown';
export type SellerTaxStatus = 'same' | 'different' | 'multiple' | 'unknown';

export interface CompanyProfile {
  businessModel: string | null;
  sector: string | null;
  revenueBand: string | null;
  employeeBand: string | null;
  jurisdiction: string | null;
}

export interface AssessmentContext {
  role: RespondentRole | null;
  ownershipTags: OwnershipTag[];
  managementModel: ManagementModel | null;
  /** Explicitly confirmed by the user; 'UNDECIDED' keeps scoring pending. */
  profile: Profile | 'UNDECIDED' | null;
  objectives: Objective[];
  perimeter: Perimeter | null;
  horizon: Horizon | null;
  liquidity: Liquidity | null;
  triggers: Partial<Record<AnyTriggerKey, TriState>>;
  sellerType: SellerType | null;
  sellerTaxStatus: SellerTaxStatus | null;
  company: CompanyProfile;
  /** Optional (s.5). 'growth' selects the Q07 growth wording. Absent in contexts saved before catalogue v1.2. */
  economicsModel?: EconomicsModel | null;
  /**
   * Optional confirmed predicate for R04 (s.8): a tax adviser has confirmed a
   * restriction or deadline that affects the planned timetable. 'yes' makes R04 critical.
   */
  taxRestrictionConfirmed?: TriState | null;
  /**
   * Optional confirmed predicate for R06 (s.8): a confirmed funding gap before
   * the planned transaction without an agreed bridge. 'yes' makes R06 critical, 'unknown' a review.
   */
  fundingGapConfirmed?: TriState | null;
}

export type Diagnostics = Partial<Record<'E01' | 'E03' | 'E04' | 'E07', string | string[]>>;

export interface QuestionDef {
  id: string;
  domain: DomainKey;
  localWeight: 1 | 2 | 3;
  route: RouteCode;
  name: string;
  question: string;
  /** anchors[0] = 0 points, [1] = 50, [2] = 100 */
  anchors: [string, string, string];
  contributor: string;
  help?: string;
  evidenceRequest?: string;
  /** Context-specific wording that keeps the meaning of the control. */
  variants?: Partial<Record<'owner_led' | 'employed' | 'growth' | 'venture', string>>;
  dependsOn?: string[];
  /**
   * Context-dependent help that replaces (or, where the control has general
   * help, follows) the help text. Selected by routing.questionHelp.
   */
  helpVariants?: Partial<Record<'exploration', string>>;
  /**
   * Risk rules (plan.ts evaluateRisks) that read this control's answer (s.18
   * "linked task/risk rules"). Documentation and traceability only: the rules
   * themselves live in plan.ts and scoring.ts. TypeScript only, not seeded.
   */
  linkedRules?: string[];
}
