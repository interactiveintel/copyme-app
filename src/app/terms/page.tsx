import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | CopyMe",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24">
        <a href="/" className="inline-flex items-center gap-0.5 mb-12">
          <span className="text-2xl font-bold text-slate-900">Copy</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent">Me</span>
        </a>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">Terms of Service</h1>
        <p className="text-sm text-slate-400 mb-8">Last updated: April 5, 2026</p>

        <div className="prose prose-slate max-w-none space-y-6 text-slate-600 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">1. Acceptance of Terms</h2>
            <p>By using CopyMe, you agree to these Terms of Service. CopyMe is a messaging platform built on the Rule of 7 constraint system designed to promote intentional communication.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">2. The Rule of 7</h2>
            <p>CopyMe operates under the Rule of 7: messages are limited to 70 words, you may send up to 7 messages per conversation cycle, and maintain up to 7 active contacts on the free tier. These constraints are core to the platform experience.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">3. User Conduct</h2>
            <p>You agree not to use CopyMe for spam, harassment, or any illegal activity. Our AI moderation system actively monitors content to ensure a safe and respectful environment for all users.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">4. Subscriptions & Payments</h2>
            <p>CopyMe offers free and paid tiers. Paid subscriptions unlock expanded limits and additional features. You may cancel your subscription at any time. Refunds are handled on a case-by-case basis.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">5. Intellectual Property</h2>
            <p>You retain ownership of content you create on CopyMe. By posting, you grant CopyMe a license to display and transmit your content as necessary to operate the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">6. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:interactiveintel@gmail.com" className="text-[#7C3AED] hover:underline">interactiveintel@gmail.com</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
