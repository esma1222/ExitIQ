import { Fragment, type ReactNode } from 'react';
import { useLang } from '../lib/i18n';

// Imprint and privacy notice for the ExitIQ tool, shown in the legal dialog
// (LegalDialog.tsx), styled like exitiq.atares.team.
// The imprint is reproduced exactly as supplied by atares (English).
// The privacy notice describes what this version of the tool actually does
// (EN and DE). Keep it in step with the code: if the AI summary
// (VITE_AI_SUMMARY) or CAPTCHA (Cloudflare Turnstile) is switched on, add
// Anthropic or Cloudflare to section VI before release.

export function ImprintContent() {
  return (
    <>
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
    </>
  );
}

type Block = string | { list: string[] };
interface Section { h: string; body: Block[] }

const EMAIL = /([\w.+-]+@[\w-]+\.[\w.]+)/g;

/** Plain text with email addresses turned into mailto links. */
function linked(text: string): ReactNode {
  return text.split(EMAIL).map((part, i) =>
    i % 2 === 1 ? <a key={i} href={`mailto:${part}`}>{part}</a> : <Fragment key={i}>{part}</Fragment>);
}

const PRIVACY: Record<'en' | 'de', { lead: string; sections: Section[]; updated: string }> = {
  en: {
    lead: 'This notice explains, in accordance with Art. 13 GDPR, how personal data is processed when you use the ExitIQ self-assessment operated by atares GmbH.',
    sections: [
      { h: 'I. Controller and data protection officer', body: [
        'The controller within the meaning of Art. 4 (7) GDPR is atares GmbH, Prinz-Ludwig-Str. 7, 80333 Munich, Germany, info@atares.team, +49 89 388881-0.',
        'Data protection officer: Bugl & Kollegen Gesellschaft für Datenschutz und Informationssicherheit mbH, Eifelstraße 55, 93057 Regensburg, Germany, kontakt@buglundkollegen.de.',
        'For all questions about ExitIQ, please write to exitiq@atares.team.',
      ] },
      { h: 'II. What data we process', body: [
        { list: [
          'your details about the business and the transaction, for example ownership, management, objectives, timing, specialist topics, seller type and tax residence, and optional details such as business model, sector, revenue and headcount band and country;',
          'your answers to the discovery and assessment questions, including short optional text for “Other” and evidence references you enter (reference, responsible role, date);',
          'your action plan: the status of each task and, if you enter them, an agreed due date and a short note on how and by whom a task was resolved;',
          'the computed result (readiness indices, coverage, risks, tasks) with the model version;',
          'your email address, only if you ask to continue on another device;',
          'minimal usage events without answer content: which screen or question was shown, device class (mobile, tablet, desktop) and campaign source.',
        ] },
        'Please do not enter names of other people in free-text fields unless this is necessary.',
      ] },
      { h: 'III. Purposes and legal bases', body: [
        'We process this data to provide the self-assessment, save your progress and produce your result and action plan at your request (Art. 6 (1) (b) GDPR). Continuing on another device is processed at your request on the same basis. Usage events serve our legitimate interest in improving the tool (Art. 6 (1) (f) GDPR). If you write to us, we process your message to answer it (Art. 6 (1) (b) and (f) GDPR).',
      ] },
      { h: 'IV. Accessing the tool (server log data)', body: [
        'When you open the tool, your browser technically transmits data to our hosting provider: IP address, date and time of the request, the content requested, HTTP status code, volume of data transferred, referring website, browser, operating system and language setting. This data is processed on the basis of our legitimate interest in security and stability (Art. 6 (1) (f) GDPR) and deleted after 14 days at the latest.',
      ] },
      { h: 'V. Anonymous session and storage in your browser', body: [
        'ExitIQ does not use accounts or passwords. Each visitor receives an anonymous session so that only you can access your assessment. Your browser’s local storage keeps your progress, your language choice and this session. These entries are technically necessary for the tool (Sec. 25 (2) TDDDG); no tracking cookies are set and no third-party analytics service is used, so no cookie banner is required. You can delete the entries in your browser at any time.',
        'If you have previously visited www.atares.team, a cookie set there by the Leadfeeder service (“_lfa”) may for technical reasons be transmitted when the tool runs under an atares.team address. The tool does not set, read or use that cookie. Information about it can be found in the privacy policy of www.atares.team.',
      ] },
      { h: 'VI. Service providers', body: [
        'We use the following providers as processors under Art. 28 GDPR:',
        { list: [
          'Vercel Inc. (USA): hosting and delivery of the tool, including the server log data described in section IV;',
          'Supabase (servers in the EU, Ireland): database and anonymous sign-in, including the email address for continuing on another device and the confirmation email sent for it.',
        ] },
        'Where processing takes place outside the EU/EEA, in particular in the USA, it is safeguarded by EU standard contractual clauses or certification under the EU-US Data Privacy Framework. You can request a copy of these safeguards via exitiq@atares.team.',
        'Your answers are not sent to any AI service. The written summary in the action plan is created by fixed rules in your browser.',
      ] },
      { h: 'VII. Reports and contact', body: [
        'Reports are downloaded directly in your browser as PDF or Excel files; ExitIQ does not send reports by email and does not collect newsletter subscriptions. If you choose to contact atares, you write a normal email to exitiq@atares.team, which we process to answer your enquiry.',
      ] },
      { h: 'VIII. Automated evaluation', body: [
        'Your result is calculated automatically from your answers by fixed rules and is non-binding guidance. There is no solely automated decision producing legal effects concerning you within the meaning of Art. 22 GDPR; any firm assessment is always made as part of personal advice.',
      ] },
      { h: 'IX. Retention', body: [
        'Your assessment is kept until you delete it in the tool (action plan or save screen) or ask us to delete it. Server log data is deleted after 14 days at the latest. Usage events contain no answer content and are kept for evaluating the tool. Statutory retention obligations remain unaffected.',
      ] },
      { h: 'X. Your rights', body: [
        'You have the right of access (Art. 15 GDPR), to rectification or erasure (Art. 16, 17 GDPR), to restriction of processing (Art. 18 GDPR), to notification of recipients (Art. 19 GDPR), to data portability (Art. 20 GDPR) and to object (Art. 21 GDPR). You can withdraw consent at any time with effect for the future (Art. 7 (3) GDPR), and you have the right to lodge a complaint with a supervisory authority (Art. 77 GDPR).',
        'To exercise your rights, an informal message to exitiq@atares.team or to our data protection officer is sufficient. The supervisory authority responsible for us is the Bavarian State Office for Data Protection Supervision (BayLDA), Promenade 18, 91522 Ansbach, Germany.',
        'This notice applies to the ExitIQ tool. A separate privacy policy applies to our main website atares.team, available in its footer.',
      ] },
    ],
    updated: 'Last updated: November 16, 2026',
  },
  de: {
    lead: 'Diese Erklärung informiert nach Art. 13 DSGVO darüber, wie personenbezogene Daten bei der Nutzung der ExitIQ-Selbsteinschätzung der atares GmbH verarbeitet werden.',
    sections: [
      { h: 'I. Verantwortlicher und Datenschutzbeauftragter', body: [
        'Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO ist die atares GmbH, Prinz-Ludwig-Str. 7, 80333 München, info@atares.team, +49 89 388881-0.',
        'Datenschutzbeauftragter: Bugl & Kollegen Gesellschaft für Datenschutz und Informationssicherheit mbH, Eifelstraße 55, 93057 Regensburg, kontakt@buglundkollegen.de.',
        'Für alle Fragen zu ExitIQ schreiben Sie bitte an exitiq@atares.team.',
      ] },
      { h: 'II. Welche Daten wir verarbeiten', body: [
        { list: [
          'Ihre Angaben zum Unternehmen und zur Transaktion, zum Beispiel Eigentümer, Führung, Ziele, Zeitrahmen, Spezialthemen, Art und steuerliche Ansässigkeit der Verkäufer sowie optional Geschäftsmodell, Branche, Umsatz- und Mitarbeiterspanne und Land;',
          'Ihre Antworten auf die Einstiegs- und Detailfragen, einschließlich kurzer freiwilliger Texte bei „Sonstiges“ und eingetragener Nachweisangaben (Fundstelle, verantwortliche Rolle, Datum);',
          'Ihren Maßnahmenplan: den Status jeder Aufgabe und, sofern Sie diese eintragen, ein vereinbartes Fälligkeitsdatum und eine kurze Notiz, wie und von wem eine Aufgabe erledigt wurde;',
          'das berechnete Ergebnis (Readiness-Indizes, Abdeckung, Risiken, Aufgaben) mit der Modellversion;',
          'Ihre E-Mail-Adresse, nur wenn Sie auf einem anderen Gerät weiterarbeiten möchten;',
          'minimale Nutzungsereignisse ohne Antwortinhalte: angezeigter Bildschirm oder angezeigte Frage, Geräteklasse (Mobil, Tablet, Desktop) und Kampagnenquelle.',
        ] },
        'Bitte tragen Sie in Freitextfelder nur dann Namen anderer Personen ein, wenn dies erforderlich ist.',
      ] },
      { h: 'III. Zwecke und Rechtsgrundlagen', body: [
        'Wir verarbeiten diese Daten, um die Selbsteinschätzung bereitzustellen, Ihren Fortschritt zu speichern und Ihr Ergebnis und Ihren Maßnahmenplan auf Ihren Wunsch zu erstellen (Art. 6 Abs. 1 lit. b DSGVO). Das Weiterarbeiten auf einem anderen Gerät erfolgt auf Ihren Wunsch auf derselben Grundlage. Nutzungsereignisse dienen unserem berechtigten Interesse an der Verbesserung des Tools (Art. 6 Abs. 1 lit. f DSGVO). Schreiben Sie uns, verarbeiten wir Ihre Nachricht zur Beantwortung (Art. 6 Abs. 1 lit. b und f DSGVO).',
      ] },
      { h: 'IV. Aufruf des Tools (Server-Logdaten)', body: [
        'Beim Aufruf des Tools übermittelt Ihr Browser technisch bedingt Daten an unseren Hosting-Anbieter: IP-Adresse, Datum und Uhrzeit der Anfrage, abgerufene Inhalte, HTTP-Statuscode, übertragene Datenmenge, verweisende Website, Browser, Betriebssystem und Spracheinstellung. Die Verarbeitung erfolgt auf Grundlage unseres berechtigten Interesses an Sicherheit und Stabilität (Art. 6 Abs. 1 lit. f DSGVO); die Daten werden spätestens nach 14 Tagen gelöscht.',
      ] },
      { h: 'V. Anonyme Sitzung und Speicherung im Browser', body: [
        'ExitIQ verwendet keine Konten und keine Passwörter. Jede Besucherin und jeder Besucher erhält eine anonyme Sitzung, damit nur Sie auf Ihre Selbsteinschätzung zugreifen können. Im lokalen Speicher Ihres Browsers liegen Ihr Fortschritt, Ihre Sprachwahl und diese Sitzung. Diese Einträge sind für den Betrieb technisch erforderlich (§ 25 Abs. 2 TDDDG); es werden keine Tracking-Cookies gesetzt und kein Analysedienst Dritter eingesetzt, daher ist kein Cookie-Banner erforderlich. Sie können die Einträge jederzeit in Ihrem Browser löschen.',
        'Wenn Sie zuvor www.atares.team besucht haben, kann ein dort vom Dienst Leadfeeder gesetztes Cookie („_lfa“) technisch bedingt mitübertragen werden, wenn das Tool unter einer atares.team-Adresse läuft. Das Tool setzt, liest oder nutzt dieses Cookie nicht. Informationen dazu finden Sie in der Datenschutzerklärung von www.atares.team.',
      ] },
      { h: 'VI. Dienstleister', body: [
        'Wir setzen folgende Auftragsverarbeiter nach Art. 28 DSGVO ein:',
        { list: [
          'Vercel Inc. (USA): Hosting und Auslieferung des Tools, einschließlich der in Abschnitt IV beschriebenen Server-Logdaten;',
          'Supabase (Server in der EU, Irland): Datenbank und anonyme Anmeldung, einschließlich der E-Mail-Adresse für das Weiterarbeiten auf einem anderen Gerät und der dafür versandten Bestätigungs-E-Mail.',
        ] },
        'Soweit eine Verarbeitung außerhalb der EU/des EWR stattfindet, insbesondere in den USA, ist sie durch EU-Standardvertragsklauseln oder eine Zertifizierung nach dem EU-US Data Privacy Framework abgesichert. Eine Kopie dieser Garantien erhalten Sie über exitiq@atares.team.',
        'Ihre Antworten werden an keinen KI-Dienst übermittelt. Die schriftliche Zusammenfassung im Maßnahmenplan wird nach festen Regeln in Ihrem Browser erstellt.',
      ] },
      { h: 'VII. Berichte und Kontakt', body: [
        'Berichte werden direkt in Ihrem Browser als PDF- oder Excel-Datei heruntergeladen; ExitIQ versendet keine Berichte per E-Mail und erhebt keine Newsletter-Anmeldungen. Wenn Sie atares kontaktieren möchten, schreiben Sie eine normale E-Mail an exitiq@atares.team, die wir zur Beantwortung Ihrer Anfrage verarbeiten.',
      ] },
      { h: 'VIII. Automatisierte Auswertung', body: [
        'Ihr Ergebnis wird nach festen Regeln automatisch aus Ihren Antworten berechnet und ist eine unverbindliche Orientierung. Eine ausschließlich automatisierte Entscheidung mit rechtlicher Wirkung im Sinne von Art. 22 DSGVO findet nicht statt; eine belastbare Einschätzung erfolgt stets im Rahmen einer persönlichen Beratung.',
      ] },
      { h: 'IX. Speicherdauer', body: [
        'Ihre Selbsteinschätzung wird gespeichert, bis Sie sie im Tool löschen (Maßnahmenplan oder Speicherseite) oder uns um Löschung bitten. Server-Logdaten werden spätestens nach 14 Tagen gelöscht. Nutzungsereignisse enthalten keine Antwortinhalte und werden zur Auswertung des Tools aufbewahrt. Gesetzliche Aufbewahrungspflichten bleiben unberührt.',
      ] },
      { h: 'X. Ihre Rechte', body: [
        'Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung oder Löschung (Art. 16, 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO), Unterrichtung der Empfänger (Art. 19 DSGVO), Datenübertragbarkeit (Art. 20 DSGVO) und Widerspruch (Art. 21 DSGVO). Eine Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO), und Sie haben das Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO).',
        'Zur Ausübung Ihrer Rechte genügt eine formlose Nachricht an exitiq@atares.team oder an unseren Datenschutzbeauftragten. Die für uns zuständige Aufsichtsbehörde ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach.',
        'Diese Erklärung gilt für das ExitIQ-Tool. Für unsere Website atares.team gilt eine eigene Datenschutzerklärung, abrufbar im Footer der Website.',
      ] },
    ],
    updated: 'Stand: 16.11.2026',
  },
};

export function PrivacyContent() {
  const p = PRIVACY[useLang()];
  return (
    <>
      <p className="legal-lead">{p.lead}</p>
      {p.sections.map((sec) => (
        <Fragment key={sec.h}>
          <h2>{sec.h}</h2>
          {sec.body.map((b, i) => typeof b === 'string'
            ? <p key={i}>{linked(b)}</p>
            : <ul key={i}>{b.list.map((li) => <li key={li}>{linked(li)}</li>)}</ul>)}
        </Fragment>
      ))}
      <p className="legal-updated">{p.updated}</p>
    </>
  );
}
