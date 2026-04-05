import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | CopyMe",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24">
        <a href="/" className="inline-flex items-center gap-0.5 mb-12">
          <span className="text-2xl font-bold text-slate-900">Copy</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent">Me</span>
        </a>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-8">Last updated: April 5, 2026</p>

        <div className="prose prose-slate max-w-none space-y-6 text-slate-600 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">1. Information We Collect</h2>
            <p>When you create an account, we collect your name, email address, and profile information you choose to provide. We also collect usage data to improve the CopyMe experience.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">2. How We Use Your Information</h2>
            <p>We use your information to provide and improve CopyMe, match you with other users based on shared interests, facilitate messaging within the Rule of 7 constraints, and send you important service updates.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">3. Data Security</h2>
            <p>CopyMe uses end-to-end encryption for all messages. We implement industry-standard security measures to protect your personal information from unauthorized access or disclosure.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">4. Your Rights</h2>
            <p>You can access, update, or delete your personal information at any time through your account settings. You may also request a complete export of your data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">5. Contact</h2>
            <p>For privacy-related questions, contact us at <a href="mailto:interactiveintel@gmail.com" className="text-[#7C3AED] hover:underline">interactiveintel@gmail.com</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
