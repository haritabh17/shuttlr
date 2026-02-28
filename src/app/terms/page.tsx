import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">Home</Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100">Terms & Privacy</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Terms of Service & Privacy Policy</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Last updated: 28 February 2026</p>

        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">What shuttlrs Is</h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              shuttlrs is a badminton club management tool. It helps clubs schedule sessions, rotate courts,
              and select players fairly. By using shuttlrs, you agree to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Your Account</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li>You must provide accurate information when signing up.</li>
              <li>You&apos;re responsible for keeping your login credentials secure.</li>
              <li>You must be at least 16 years old to use shuttlrs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">What Data We Collect</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li><strong>Account info:</strong> name, email address, profile picture (via Google).</li>
              <li><strong>Club data:</strong> membership, role (player/manager), skill level, gender (used for mixed-gender court balancing), club nickname.</li>
              <li><strong>Session data:</strong> game history, play count, court assignments.</li>
              <li><strong>Push notifications:</strong> browser push subscription tokens, if you opt in.</li>
              <li><strong>Usage data:</strong> session counts per club (for billing purposes, when applicable).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Legal Basis for Processing</h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Under the GDPR, we process your data on the following grounds:
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li><strong>Contract:</strong> account info, club data, and session data are necessary to provide the service you signed up for.</li>
              <li><strong>Consent:</strong> push notifications are opt-in. You can revoke consent at any time in your browser settings.</li>
              <li><strong>Legitimate interest:</strong> basic analytics and usage tracking to maintain and improve the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">How We Use Your Data</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li>To run the app — court rotation, player selection, session management.</li>
              <li>To send push notifications about your game assignments (only if you enable them).</li>
              <li>To display advertisements within the app.</li>
              <li>To process payments if you subscribe to a paid plan (handled by Stripe).</li>
              <li>We do not sell your personal data to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Third-Party Services</h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We use the following third-party services to operate shuttlrs. Each acts as a data processor under GDPR:
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li><strong>Supabase</strong> (EU-West, AWS) — database, authentication, real-time features.</li>
              <li><strong>Vercel</strong> (global edge network) — hosting and serverless functions.</li>
              <li><strong>Google</strong> — OAuth sign-in (we receive your name, email, and profile picture).</li>
              <li><strong>Stripe</strong> — payment processing (we never see or store your card details).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Cookies</h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              shuttlrs uses essential cookies for authentication (keeping you logged in). We do not use
              tracking cookies or third-party analytics cookies. Stripe may set cookies during the payment
              process — see{" "}
              <a href="https://stripe.com/privacy" className="text-teal-600 dark:text-teal-400 underline" target="_blank" rel="noopener noreferrer">
                Stripe&apos;s privacy policy
              </a>{" "}
              for details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Data Retention</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li>Your account data is kept for as long as your account is active, and up to 5 years after your last activity.</li>
              <li>Session history, game data, and club statistics are retained for up to 5 years for record-keeping and analytics purposes.</li>
              <li>If you request account deletion, we remove your personal data (name, email, profile) within 30 days. Game and session records are anonymised, not deleted, to preserve club statistics.</li>
              <li>Push notification tokens are deleted immediately when you unsubscribe or delete your account.</li>
              <li>Payment records are retained for 7 years as required by Irish tax law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Club Managers</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li>Managers can view and edit member profiles within their club (name, nickname, gender, skill level).</li>
              <li>Managers are responsible for the accuracy of member data in their club.</li>
              <li>Managers can add, remove, promote, or demote members.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Your Rights</h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Under GDPR, you have the right to:
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li><strong>Access</strong> — view and download your personal data at any time via your profile.</li>
              <li><strong>Rectification</strong> — edit your profile information at any time.</li>
              <li><strong>Erasure</strong> — request deletion of your account and all associated data.</li>
              <li><strong>Portability</strong> — request a copy of your data by emailing us.</li>
              <li><strong>Object</strong> — object to processing based on legitimate interest.</li>
              <li><strong>Withdraw consent</strong> — turn off push notifications at any time.</li>
            </ul>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              To exercise any of these rights, email us at{" "}
              <a href="mailto:support@shuttlrs.com" className="text-teal-600 dark:text-teal-400 underline">
                support@shuttlrs.com
              </a>.
              We&apos;ll respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Acceptable Use</h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">Don&apos;t abuse the platform. This includes:</p>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li>Creating fake accounts or clubs.</li>
              <li>Harassing other users.</li>
              <li>Attempting to access other users&apos; data.</li>
              <li>Using the platform for anything other than managing badminton (or similar sport) sessions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Our Rights</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li>We may suspend or terminate accounts that violate these terms.</li>
              <li>We may modify or discontinue the service at any time.</li>
              <li>We&apos;ll try to give reasonable notice of major changes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Liability</h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              shuttlrs is provided &quot;as is&quot;. We do our best to keep it running and your data safe,
              but we can&apos;t guarantee 100% uptime or zero bugs. We&apos;re not liable for any damages
              arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Subscriptions & Payments</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li>New clubs get a <strong>3-month free trial</strong> with unlimited sessions. After that, clubs are limited to 4 sessions per month on the free plan.</li>
              <li>The Pro plan removes session limits. It is available as a monthly (€2.99/month) or yearly (€24.99/year) subscription.</li>
              <li>Subscriptions <strong>auto-renew</strong> at the end of each billing period unless you cancel before the renewal date.</li>
              <li>You can cancel at any time from your club settings. Cancellation takes effect at the end of the current billing period — you keep access until then.</li>
              <li>Payments are processed by <strong>Stripe</strong>. We never see or store your card details.</li>
              <li>Refunds are handled on a case-by-case basis. Contact <a href="mailto:support@shuttlrs.com" className="text-teal-600 dark:text-teal-400 underline">support@shuttlrs.com</a> if you believe you were charged in error.</li>
              <li>Under EU consumer law, you have a 14-day right of withdrawal for digital services. By subscribing and using the service immediately, you acknowledge that you waive this right.</li>
              <li>We may change pricing with 30 days&apos; notice. Existing subscriptions are honoured until renewal.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Automated Decisions</h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              shuttlrs uses an automated algorithm to select players for courts and assign pairings during sessions.
              This is based on play count, rest time, skill level, gender, and teammate history. No human reviews
              these decisions in real time. You can always leave a session if you disagree with an assignment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Contact</h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              shuttlrs is operated by Haritabh Gupta, based in Dublin, Ireland.
            </p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Questions, concerns, or data requests? Reach us at{" "}
              <a href="mailto:support@shuttlrs.com" className="text-teal-600 dark:text-teal-400 underline">
                support@shuttlrs.com
              </a>.
              We&apos;ll respond within 30 days.
            </p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              If you&apos;re not satisfied with our response, you have the right to lodge a complaint with the{" "}
              <a href="https://www.dataprotection.ie" className="text-teal-600 dark:text-teal-400 underline" target="_blank" rel="noopener noreferrer">
                Irish Data Protection Commission
              </a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
