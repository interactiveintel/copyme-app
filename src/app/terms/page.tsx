import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | CopyMe",
  description:
    "Terms of service for CopyMe — the rights, limits, and responsibilities of using the platform.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24">
        <Link href="/" className="inline-flex items-center gap-0.5 mb-12">
          <span className="text-2xl font-bold text-slate-900">Copy</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent">
            Me
          </span>
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-400 mb-10">
          Last updated: 22 April 2026 · Effective: 22 April 2026
        </p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-600 text-sm leading-relaxed">
          {/* Summary */}
          <section className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <h2 className="text-base font-semibold text-slate-900 mb-2">At a glance</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>You need to be 16+ (or the local age of digital consent, whichever is higher).</li>
              <li>Every message is capped at 70 words, you keep up to 7 active contacts on the free tier, and your last 7 messages per contact are retained.</li>
              <li>No spam, no harassment, no illegal content — AI and humans moderate.</li>
              <li>Accounts that break these rules may be suspended.</li>
              <li>You can cancel or delete your account at any time.</li>
            </ul>
          </section>

          {/* 1. Acceptance */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">1. Acceptance of these terms</h2>
            <p>
              These Terms of Service (&quot;Terms&quot;) are a binding agreement between you and
              CopyMe (operated jointly by InteractiveIntel, United States, and Pimdom d.o.o.,
              Slovenia). By creating an account, accessing, or using CopyMe (the &quot;Service&quot;),
              you agree to these Terms and to our{" "}
              <a href="/privacy" className="text-[#7C3AED] hover:underline">
                Privacy Policy
              </a>
              . If you do not agree, do not use the Service.
            </p>
          </section>

          {/* 2. Eligibility */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">2. Eligibility</h2>
            <p>
              You must be at least 16 years old (or the minimum age of digital consent where you
              live, if higher) to use CopyMe. If you use the Service on behalf of an organization,
              you represent that you have authority to bind it to these Terms.
            </p>
          </section>

          {/* 3. Rule of 7 */}
          <section id="rule-of-7" className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">3. The Rule of 7</h2>
            <p>
              The Service imposes a constraint system called the &quot;Rule of 7&quot;:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Each message is capped at 70 words.</li>
              <li>Each media attachment group is capped at 7 items.</li>
              <li>Each voice / video clip is capped at 70 seconds.</li>
              <li>The free tier maintains up to 7 active contacts and the last 7 messages per contact.</li>
              <li>Paid tiers raise these caps but do not remove them.</li>
            </ul>
            <p className="mt-2">
              These limits are enforced server-side and are a core part of what CopyMe is.
            </p>
          </section>

          {/* 4. Acceptable use */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">4. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Harass, threaten, dox, or target others.</li>
              <li>Post content that is unlawful, defamatory, sexually explicit involving minors, or that infringes intellectual-property rights.</li>
              <li>Attempt to bypass Rule-of-7 enforcement, rate limits, or authentication.</li>
              <li>Use the Service to send bulk unsolicited messages (spam).</li>
              <li>Scrape, reverse-engineer, or automate the Service in ways not permitted by us.</li>
              <li>Use the Service to train a competing AI system.</li>
            </ul>
            <p className="mt-2">
              We may remove content, suspend accounts, or terminate access for violations. Where
              required by law we will preserve or disclose content in response to valid legal
              process.
            </p>
          </section>

          {/* 5. Your content */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">5. Your content</h2>
            <p>
              You retain ownership of the content you create on CopyMe. By posting content you
              grant us a worldwide, non-exclusive, royalty-free licence to host, store, transmit,
              and display it only as necessary to run the Service and to comply with law. This
              licence ends when you delete the content, except where we must retain it under
              legal obligation.
            </p>
          </section>

          {/* 6. Subscriptions */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">6. Subscriptions &amp; payments</h2>
            <p>
              CopyMe offers a free tier and paid plans (&quot;Subscriptions&quot;). Fees, features,
              and terms of each plan are shown at checkout and in the pricing page. Subscriptions
              renew automatically at the end of each billing period unless you cancel before
              renewal. Cancellation takes effect at the end of the current period; you retain
              access until then.
            </p>
            <p className="mt-2">
              EU / UK consumers have a statutory 14-day right of withdrawal from the date of
              purchase, except for digital content that has begun performance with your express
              consent (see checkout).
            </p>
          </section>

          {/* 7. AI features */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">7. AI features (Yogi)</h2>
            <p>
              Yogi is an AI assistant provided inside CopyMe. Output from Yogi may be incorrect,
              outdated, or offensive and should not be relied on for medical, legal, financial,
              or safety-critical decisions. You are responsible for how you use Yogi&apos;s output.
              Yogi is powered by a third-party AI subprocessor; see our Privacy Policy for
              details.
            </p>
          </section>

          {/* 8. Account termination */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">8. Termination</h2>
            <p>
              You may close your account at any time in{" "}
              <strong>Profile → Settings → Delete account</strong>. We may suspend or terminate
              your account if you breach these Terms, if required by law, or if operating the
              Service for you creates a material risk. We will give you reasonable notice where
              practical and lawful.
            </p>
          </section>

          {/* 9. Warranty / liability */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">9. Warranty &amp; liability</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the maximum extent
              permitted by law, CopyMe disclaims implied warranties of merchantability, fitness
              for a particular purpose, and non-infringement. Nothing in these Terms limits
              liability that cannot be limited under applicable law (including, for EU consumers,
              liability for death, personal injury, or gross negligence).
            </p>
            <p className="mt-2">
              Subject to the above, CopyMe&apos;s aggregate liability arising out of or in
              connection with the Service is limited to the greater of (a) the amount you paid
              CopyMe in the 12 months preceding the event giving rise to the claim, or (b) EUR
              100.
            </p>
          </section>

          {/* 10. Indemnity */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">10. Indemnity</h2>
            <p>
              You agree to indemnify and hold CopyMe harmless from claims arising out of your
              misuse of the Service or your breach of these Terms, except where prohibited by
              law.
            </p>
          </section>

          {/* 11. Governing law */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">11. Governing law &amp; disputes</h2>
            <p>
              Consumers based in the European Economic Area or the United Kingdom may bring
              claims under their local mandatory consumer-protection rules and before their local
              courts. For all other users, these Terms are governed by the laws of the State of
              Florida, United States, and disputes will be resolved in the state or federal
              courts located in Miami-Dade County, Florida, subject to any mandatory arbitration
              or consumer law to the contrary.
            </p>
          </section>

          {/* 12. Changes */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">12. Changes to these Terms</h2>
            <p>
              We may update these Terms. If changes are material, we will give you at least 30
              days&apos; notice before they take effect. Continuing to use the Service after that
              notice period means you accept the updated Terms.
            </p>
          </section>

          {/* 13. Contact */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">13. Contact</h2>
            <p>
              Questions about these Terms:{" "}
              <a href="mailto:info@copyme1.com" className="text-[#7C3AED] hover:underline">
                info@copyme1.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
