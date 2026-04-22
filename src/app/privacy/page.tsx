import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | CopyMe",
  description:
    "How CopyMe collects, uses, stores, and protects personal data — written to align with GDPR, UK GDPR, and US state privacy laws.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24">
        <a href="/" className="inline-flex items-center gap-0.5 mb-12">
          <span className="text-2xl font-bold text-slate-900">Copy</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent">
            Me
          </span>
        </a>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-10">
          Last updated: 22 April 2026 · Effective: 22 April 2026
        </p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-600 text-sm leading-relaxed">
          {/* Summary */}
          <section className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <h2 className="text-base font-semibold text-slate-900 mb-2">At a glance</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>We collect the minimum we need to run CopyMe.</li>
              <li>We never sell personal data.</li>
              <li>You can export or delete your account at any time in Settings.</li>
              <li>Your phone number and email are stored as one-way hashes; the plaintext never sits in our database.</li>
              <li>Messages are retained for the Rule-of-7 cycle (last 7 per contact) and then cycled out.</li>
            </ul>
          </section>

          {/* 1. Who we are */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">1. Who we are</h2>
            <p>
              CopyMe (&quot;CopyMe&quot;, &quot;we&quot;, &quot;us&quot;) is a messaging platform operated jointly by
              InteractiveIntel (United States) and Pimdom d.o.o. (Slovenia, European Union). For the
              purposes of the EU / UK GDPR, the data controller is the legal entity that owns the
              CopyMe trademark (listed below). For California residents, CopyMe is the
              &quot;business&quot; as defined under the CCPA / CPRA.
            </p>
            <p className="mt-2">
              Contact the privacy team at{" "}
              <a href="mailto:interactiveintel@gmail.com" className="text-[#7C3AED] hover:underline">
                interactiveintel@gmail.com
              </a>
              . For EU-specific requests we will route you to our EU representative.
            </p>
          </section>

          {/* 2. Data we collect */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">2. Data we collect</h2>
            <p className="mb-2">Categories of personal data we process:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Account identifiers</strong> — display name, account tier, currency
                preference, creation timestamp.
              </li>
              <li>
                <strong>Contact identifiers</strong> — phone number and email address, stored as
                SHA-256 hashes only. We never retain plaintext phone or email in our database.
              </li>
              <li>
                <strong>Authentication data</strong> — bcrypt password hash (12 rounds),
                session and refresh tokens.
              </li>
              <li>
                <strong>Profile data you provide</strong> — location (optional, visible only if
                you opt-in), interests (up to 7), role / institution description.
              </li>
              <li>
                <strong>Communication content</strong> — messages, message attachments, voice and
                video clip durations. Only the last 7 messages per contact are retained.
              </li>
              <li>
                <strong>Operational data</strong> — request logs, IP address for rate limiting,
                device and browser metadata, approximate last-active timestamp.
              </li>
              <li>
                <strong>AI interaction data</strong> — messages sent to the Yogi assistant, when
                you choose to use it. This data is processed by our AI subprocessor and not used
                to train their general models.
              </li>
            </ul>
          </section>

          {/* 3. Why we process it */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">3. Why we process it (lawful basis)</h2>
            <p className="mb-2">Under the EU / UK GDPR, we rely on:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Contract (Art. 6(1)(b))</strong> — to operate your account, deliver
                messages, and enforce Rule-of-7 limits.
              </li>
              <li>
                <strong>Legitimate interests (Art. 6(1)(f))</strong> — to keep the service secure,
                prevent abuse, and improve quality. You can object at any time.
              </li>
              <li>
                <strong>Consent (Art. 6(1)(a))</strong> — for non-essential cookies, optional
                marketing emails, and Yogi AI features that process your conversations.
              </li>
              <li>
                <strong>Legal obligation (Art. 6(1)(c))</strong> — to respond to lawful requests
                from authorities.
              </li>
            </ul>
          </section>

          {/* 4. Retention */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">4. How long we keep it</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Messages</strong> — only the last 7 per contact; older messages are auto-deleted.
              </li>
              <li>
                <strong>Account</strong> — retained until you delete it. On deletion, profile
                and identifying data are removed within 30 days; anonymized operational logs may
                be kept for up to 12 months.
              </li>
              <li>
                <strong>Security logs</strong> — up to 90 days.
              </li>
              <li>
                <strong>Billing records</strong> — retained for statutory periods required under
                US / EU tax law (typically 7 years) after the last transaction.
              </li>
            </ul>
          </section>

          {/* 5. Sharing */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">5. Who we share data with</h2>
            <p>
              We share personal data only with processors contracted under written agreements
              (including EU Standard Contractual Clauses where applicable):
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Vercel (application hosting, US / EU regions)</li>
              <li>Neon (Postgres database, US region)</li>
              <li>Resend (transactional email, US)</li>
              <li>Anthropic (Yogi AI, US) — processes only messages you choose to send to Yogi</li>
              <li>Twilio (SMS delivery, when SMS verification is enabled)</li>
              <li>PostHog or a comparable product-analytics processor (anonymized events only)</li>
            </ul>
            <p className="mt-2">
              We do <strong>not</strong> sell personal data, and we do not share it for
              cross-context behavioral advertising.
            </p>
          </section>

          {/* 6. International transfers */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">6. International transfers</h2>
            <p>
              If you are in the EU / UK, your data may be transferred to the United States for
              hosting and processing. Transfers are covered by the EU Commission&apos;s Standard
              Contractual Clauses and, where applicable, the EU-US Data Privacy Framework.
            </p>
          </section>

          {/* 7. Your rights */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">7. Your rights</h2>
            <p>
              Depending on your location, you have the right to access, rectify, erase, restrict,
              port, or object to the processing of your personal data. To exercise any of these
              rights:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>In-app: <strong>Profile → Settings → Delete account</strong> (immediate).</li>
              <li>
                Email:{" "}
                <a
                  href="mailto:interactiveintel@gmail.com"
                  className="text-[#7C3AED] hover:underline"
                >
                  interactiveintel@gmail.com
                </a>{" "}
                — we respond within 30 days.
              </li>
              <li>
                You may also complain to your national supervisory authority. In Slovenia this is
                the Information Commissioner (Informacijski pooblaščenec).
              </li>
            </ul>
          </section>

          {/* 8. Security */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">8. Security</h2>
            <p>
              We use bcrypt (cost 12) for password storage, TLS for all transport, JWT access
              tokens with short expiry and server-verified refresh, SHA-256 hashing of identifiers,
              and rate limiting on authentication endpoints. Despite these measures, no online
              service is perfectly secure; in the event of a breach affecting your personal data,
              we will notify you and the relevant supervisory authority within 72 hours as
              required by GDPR Art. 33–34.
            </p>
          </section>

          {/* 9. Cookies */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">9. Cookies &amp; local storage</h2>
            <p>
              CopyMe uses the minimum set of cookies and local-storage entries required to keep
              you signed in. Non-essential cookies (analytics, feature preferences) are only
              placed after you accept them via the consent banner.
            </p>
          </section>

          {/* 10. Children */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">10. Children</h2>
            <p>
              CopyMe is not intended for children under 13 (under 16 in the EEA, or the local age
              of digital consent, whichever is higher). We do not knowingly collect personal data
              from children below that age.
            </p>
          </section>

          {/* 11. Changes */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">11. Changes to this policy</h2>
            <p>
              We will post material changes on this page and, where they meaningfully affect your
              rights, notify you in-app or by email before they take effect.
            </p>
          </section>

          {/* 12. Contact */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">12. Contact</h2>
            <p>
              Privacy questions and data-subject requests:{" "}
              <a href="mailto:interactiveintel@gmail.com" className="text-[#7C3AED] hover:underline">
                interactiveintel@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
