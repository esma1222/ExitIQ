import { useEffect, type ReactNode } from 'react';
import { navigate } from '../App';
import { Brand, LangSwitch } from '../components/ui';
import { useLang } from '../lib/i18n';

// Imprint and privacy notice for the ExitIQ tool.
// The legal text is reproduced exactly as supplied by atares (English). It is
// not translated or reworded here: legal wording is owned by atares. The German
// interface shows a short note that the notices are currently in English.

const NOTE_DE = 'Diese rechtlichen Hinweise liegen derzeit auf Englisch vor.';

function Page({ title, children }: { title: string; children: ReactNode }) {
  const lang = useLang();
  useEffect(() => {
    document.title = `${title} | ExitIQ by atares`;
  }, [title]);
  return (
    <div className="legal-page">
      <header className="site-header">
        <div className="wrap" style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <Brand />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <LangSwitch />
            <a href="/" className="btn btn-ghost btn-sm" onClick={(e) => { e.preventDefault(); navigate('/'); }}>{lang === 'de' ? 'Zur Startseite' : 'Back to ExitIQ'}</a>
          </div>
        </div>
      </header>
      <main className="wrap legal-body">
        {lang === 'de' && <p className="legal-note">{NOTE_DE}</p>}
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function Imprint() {
  return (
    <Page title="Imprint">
      <p className="legal-lead">Information pursuant to Sec. 5 DDG and Sec. 2 DL-InfoV</p>
      <p>
        <b>atares GmbH</b><br />
        Prinz-Ludwig-Str. 7<br />
        80333 Munich<br />
        Germany
      </p>
      <p>
        Phone: +49 (0) 89 388 88 1 – 0<br />
        Fax: +49 (0) 89 954 280 20 – 0<br />
        Email: <a href="mailto:muc@atares.team">muc@atares.team</a>
      </p>
      <p>
        VAT ID No.: DE220207918<br />
        Commercial register: HRB 136 913<br />
        Register court: Munich<br />
        Managing Directors: Jan Pörschmann, Rainer Wieser
      </p>

      <h2>Terms of Use</h2>
      <p>Access to and use of this website are subject to the following terms and to all applicable laws:</p>
      <p>All content on this website is protected by the copyright of atares GmbH (renamed on 9 November 2023 from Proventis Partners GmbH ("atares")) or of third parties who have granted atares a corresponding right of use. Individual pages of this website may be downloaded, temporarily stored and printed for exclusive use within your company.</p>
      <p>Any further use requires the written consent of atares.</p>
      <p>Brand names or marks of atares appearing on this website are the intellectual property of atares or of companies affiliated with atares, or are used by them under licence. Any use of these brand names or marks on this website is not permitted unless expressly allowed on the website by way of exception or in accordance with these Terms of Use.</p>
      <p>Hyperlinks are always "living" (dynamic) references. When first establishing a link, atares did review the external content as to whether it might give rise to potential civil or criminal liability. Note on linked pages: as a content provider, atares is responsible under the general laws for its "own content" that it makes available for use. This own content must be distinguished from hyperlinks to content provided by other providers. atares is responsible for such third-party content only if it has positive knowledge of it (i.e. also of any unlawful or criminal content) and it is technically possible and reasonable for atares to prevent its use. atares is, however, not obliged to continuously review the content it refers to in its offering for changes that might newly give rise to liability.</p>
      <p>Neither atares nor companies affiliated with atares are liable for any direct or indirect damages or consequential damages resulting from access to the website or from the use of the content of this website or of any website linked to it.</p>
      <p>atares accepts no liability with regard to the accuracy or completeness of the content, or the functionality and availability of this website or of any other website connected to it by cross-references ("hyperlinks"). This does not apply in cases of intent or gross negligence.</p>
      <p>Any message or material that you send or transmit to atares over the internet is deemed to be non-confidential and not legally protected, and will be treated as such. By sending or transmitting messages or material to this website, you agree that atares or companies affiliated with atares may use these messages or this material for any purpose, including reproduction. Do not send or transmit any unlawful, threatening, obscene, defamatory, pornographic or immoral material, or material that constitutes or encourages unlawful or criminal conduct.</p>
      <p>atares reserves the right to amend these Terms of Use and recommends that you inform yourself regularly about the terms in force at any given time. By using the website, you accept the applicability of the Terms of Use in their respectively valid version.</p>
      <p>The legal notices on this page, as well as any disputes arising out of or in connection with the content of this website, are governed by the law of the Federal Republic of Germany.</p>
    </Page>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy notice">
      <p className="legal-lead">This notice explains, in accordance with Art. 13 GDPR, how personal data is processed when you use the ExitIQ tool operated by atares GmbH. Personal data is any information relating to you (e.g. name, email address, details about your company, your questionnaire answers).</p>

      <h2>I. Controller and data protection officer</h2>
      <p>The controller within the meaning of Art. 4 (7) GDPR is</p>
      <p>
        atares GmbH (renamed on 9 Nov 2023 from Proventis Partners GmbH)<br />
        Prinz-Ludwig-Str. 7<br />
        80333 Munich, Germany<br />
        <a href="mailto:info@atares.team">info@atares.team</a><br />
        +49 89 388881-0
      </p>
      <p>
        You can reach our data protection officer at:<br />
        Bugl &amp; Kollegen Gesellschaft für Datenschutz und Informationssicherheit mbH<br />
        Eifelstraße 55<br />
        93057 Regensburg, Germany<br />
        Email: <a href="mailto:kontakt@buglundkollegen.de">kontakt@buglundkollegen.de</a>
      </p>

      <h2>II. What data we process in the ExitIQ tool</h2>
      <p>When you use the tool we process:</p>
      <ul>
        <li>details about your company (name, sector, legal/ownership structure, country, revenue and headcount range, optional exact headcount and free-text notes);</li>
        <li>your answers to the qualification and assessment questions;</li>
        <li>if you request the report or contact us: your name, email address, your phone number if you request a call back, and the content of your enquiry.</li>
      </ul>

      <h2>III. Purposes and legal bases</h2>
      <p>We process this data to produce and display your exit-readiness assessment, to send you the report by email on request, and to respond to your enquiries. Providing the tool and producing the assessment take place at your request (Art. 6 (1) (b) GDPR). Sending the report by email is based on your consent (Art. 6 (1) (a) GDPR), which you give when requesting it and can withdraw at any time with effect for the future. Call-back and contact requests to our advisory team are processed as a pre-contractual measure taken at your request (Art. 6 (1) (b) GDPR) and on the basis of our legitimate interest in responding to your enquiry (Art. 6 (1) (f) GDPR).</p>

      <h2>IV. Accessing the tool (server log data)</h2>
      <p>For purely informational use we collect only the data your browser technically transmits to our server: IP address, date and time of the request, the content requested, access status/HTTP status code, volume of data transferred, referring website, and your browser, operating system and language setting. This data is stored on the basis of our legitimate interest (Art. 6 (1) (f) GDPR) to ensure security and stability, and is deleted after 14 days at the latest.</p>

      <h2>V. Local storage in your browser</h2>
      <p>The tool stores a few technically necessary entries in your browser's local storage (a random session identifier, your language preference and the acknowledgement of the intro notice). These entries exist solely so the tool works; no tracking takes place through them (Sec. 25 (2) of the German TDDDG), so no cookie banner is required. You can delete them at any time via your browser.</p>
      <p>For privacy-friendly audience measurement the tool uses Vercel Web Analytics, a cookieless analytics service provided by our hosting provider Vercel Inc. (USA). It records only aggregated, anonymous usage statistics (e.g. page views, referrer, approximate region, browser and device type). It sets no cookies, performs no cross-device recognition, and stores no personal data that identifies you. The legal basis is our legitimate interest in improving the tool (Art. 6 (1) (f) GDPR); because no information is accessed on your device, neither consent under Sec. 25 (2) TDDDG nor a cookie banner is required. Any third-country transfer is safeguarded by EU standard contractual clauses or the EU-US Data Privacy Framework.</p>
      <p>Beyond this, the tool does not embed any further analytics or tracking services. If you have previously visited the main website www.atares.team, a cookie set there domain-wide by the Leadfeeder service ("_lfa") may for technical reasons also be transmitted to this tool's server. This tool does not set, read or use that cookie in any way. Information about this service can be found in the privacy policy of the main website (www.atares.team).</p>

      <h2>VI. Hosting and processors</h2>
      <p>We use the following providers as processors under Art. 28 GDPR:</p>
      <ul>
        <li>Vercel (Vercel Inc., USA) for hosting and delivery of the tool and for the cookieless "Web Analytics" audience measurement;</li>
        <li>Supabase (hosting and database, servers in the EU) to store the data entered in the tool;</li>
        <li>Anthropic (AI service "Claude") to generate the assessment report automatically;</li>
        <li>Resend (email delivery provider) to send the report and confirmation emails.</li>
      </ul>
      <p>Where processing takes place outside the EU/EEA (in particular in the USA), it is safeguarded by EU standard contractual clauses or certification under the EU-US Data Privacy Framework. You can request a copy of these safeguards via <a href="mailto:exitiq@atares.team">exitiq@atares.team</a>.</p>

      <h2>VII. Newsletter</h2>
      <p>The ExitIQ tool does not collect newsletter subscriptions itself and processes no personal data for that purpose. On the results page we only provide a link to the atares newsletter subscription page. If you subscribe there, the sign-up and the associated processing of your data (including the double opt-in process and dispatch via the newsletter platform "MailChimp") are carried out by atares on its main website and are governed by the privacy policy available there (www.atares.team). No data is transmitted to atares for this purpose via the ExitIQ tool.</p>

      <h2>VIII. User account</h2>
      <p>You can optionally create an account to save your assessments and revisit them later. For this we process your email address, your name and your password (stored exclusively as a cryptographic hash). The legal basis is the performance of the usage relationship (Art. 6 (1) (b) GDPR). The data is stored until you delete your account, which you can request at any time via <a href="mailto:exitiq@atares.team">exitiq@atares.team</a>.</p>

      <h2>IX. Automated evaluation</h2>
      <p>The report is generated automatically from the information you provide and serves solely as non-binding guidance. There is no solely automated decision producing legal effects concerning you within the meaning of Art. 22 GDPR; any firm assessment is always made as part of personal advice.</p>

      <h2>X. Retention</h2>
      <p>We retain your data only for as long as necessary for the purposes described. The following periods apply and are enforced technically by an automated deletion routine:</p>
      <ul>
        <li>server log data: deleted after 14 days at the latest;</li>
        <li>assessment data without a user account (company details, answers, result): deleted 12 months after the last activity;</li>
        <li>lead data (name and email address from a report request): until withdrawal, at the latest 24 months after the last contact;</li>
        <li>user account: until you delete your account (see section VIII).</li>
      </ul>
      <p>Statutory retention obligations remain unaffected. Independently of these periods, you may request deletion of your data at any time.</p>

      <h2>XI. Your rights</h2>
      <p>You have the following rights vis-à-vis the controller:</p>
      <ul>
        <li>right of access (Art. 15 GDPR);</li>
        <li>right to rectification or erasure (Art. 16, 17 GDPR);</li>
        <li>right to restriction of processing (Art. 18 GDPR);</li>
        <li>right to notification of recipients about rectification, erasure or restriction of processing (Art. 19 GDPR);</li>
        <li>right to data portability (Art. 20 GDPR);</li>
        <li>right to object (Art. 21 GDPR);</li>
        <li>right to withdraw consent with future effect; the lawfulness of processing carried out before withdrawal remains unaffected (Art. 7 (3) GDPR);</li>
        <li>right to lodge a complaint with a supervisory authority (Art. 77 GDPR).</li>
      </ul>
      <p>To exercise your rights, an informal message to <a href="mailto:exitiq@atares.team">exitiq@atares.team</a> or to our data protection officer is sufficient. The supervisory authority responsible for us is the Bavarian State Office for Data Protection Supervision (BayLDA), Promenade 18, 91522 Ansbach, Germany.</p>
      <p>This notice applies to the ExitIQ tool. A separate privacy policy applies to our main website atares.team, available in its footer.</p>
      <p className="legal-updated">Last updated: 21 July 2026</p>
    </Page>
  );
}
