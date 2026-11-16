// Tax context shown next to the tax workstream (brief s.22): the company's
// country and the sellers' tax residence status, as the user stated them.
// Display only; nothing here feeds scoring.

import { localOptions } from '../i18n/localize';
import { SELLER_TAX_OPTIONS } from '../model/options';
import type { AssessmentContext } from '../model/types';
import { locale, type Lang } from './i18n';

/** A two-letter country code becomes its name in the display language; any other text is shown as entered. */
export function countryName(lang: Lang, value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) {
    try {
      const name = new Intl.DisplayNames([locale(lang)], { type: 'region' }).of(v.toUpperCase());
      if (name && name.toUpperCase() !== v.toUpperCase()) return name;
    } catch {
      /* older engines without DisplayNames: fall back to the code */
    }
    return v.toUpperCase();
  }
  return v;
}

export interface TaxContext { country: string | null; residence: string | null }

export function taxContext(lang: Lang, ctx: AssessmentContext): TaxContext {
  const residence = ctx.sellerTaxStatus
    ? localOptions(lang, 'sellerTax', SELLER_TAX_OPTIONS).find((o) => o.value === ctx.sellerTaxStatus)?.label ?? null
    : null;
  return { country: countryName(lang, ctx.company?.jurisdiction), residence };
}
