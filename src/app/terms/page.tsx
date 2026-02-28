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
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">How We Use Your Data</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li>To run the app — court rotation, player selection, session management.</li>
              <li>To send push notifications about your game assignments (only if you enable them).</li>
              <li>To display advertisements within the app.</li>
              <li>We do not sell your personal data to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Where Your Data Lives</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li><strong>Database:</strong> Supabase (EU-West region, hosted on AWS).</li>
              <li><strong>Hosting:</strong> Vercel (global edge network).</li>
              <li><strong>Authentication:</strong> Supabase Auth with Google OAuth.</li>
            </ul>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We do not transfer your data outside of what&apos;s necessary to run these services.
            </p>
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
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
              <li>You can view and edit your profile at any time.</li>
              <li>You can leave any club at any time.</li>
              <li>You can request deletion of your account and all associated data.</li>
            </ul>
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
        </div>
      </main>
    </div>
  );
}
