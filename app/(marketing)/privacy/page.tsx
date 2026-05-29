import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy · GroomHub",
  description:
    "How GroomHub collects, uses, and protects personal information for grooming shops and their clients.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" effectiveDate="May 29, 2026">
      <p>
        This Privacy Policy explains how GroomHub (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects, uses, shares, and
        protects personal information when you use our grooming-shop
        management platform (the &ldquo;Service&rdquo;). We comply with
        applicable Canadian privacy laws, including the Personal Information
        Protection and Electronic Documents Act (PIPEDA).
      </p>

      <LegalSection heading="1. Who this policy applies to">
        <p>
          This policy applies to two groups of people:
        </p>
        <ul>
          <li>
            <strong>Account holders</strong> — grooming shop owners and staff
            who sign in to use GroomHub.
          </li>
          <li>
            <strong>Shop clients</strong> — pet owners whose information
            account holders enter into GroomHub for the purpose of running
            their business.
          </li>
        </ul>
        <p>
          If you are a shop client, the grooming shop that uses GroomHub is
          the &ldquo;controller&rdquo; of your personal information; GroomHub
          processes it on their behalf. To exercise rights over your data,
          contact the grooming shop directly.
        </p>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <p>
          <strong>Information you provide when creating an account:</strong>{" "}
          name, email address, password (handled by our authentication
          provider), shop name, shop address, phone number, and billing
          details.
        </p>
        <p>
          <strong>Business and customer data you enter into the Service:</strong>{" "}
          client names, contact information, pet names, breed, species,
          vaccination records, grooming notes, photos, appointment history,
          staff schedules, and service catalogues.
        </p>
        <p>
          <strong>Usage and device data:</strong> IP address, browser type,
          device identifiers, pages visited, and timestamps. We use this to
          operate, secure, and improve the Service.
        </p>
        <p>
          <strong>Communications:</strong> messages you send to us at our
          support address, and our replies.
        </p>
      </LegalSection>

      <LegalSection heading="3. How we use information">
        <p>We use personal information to:</p>
        <ul>
          <li>Provide, maintain, and improve the Service.</li>
          <li>
            Authenticate users, protect against fraud, and keep accounts
            secure.
          </li>
          <li>
            Send transactional emails such as booking confirmations, reminders,
            and password resets — on behalf of the grooming shop.
          </li>
          <li>Process subscription payments.</li>
          <li>Respond to support requests and feedback.</li>
          <li>Comply with legal obligations.</li>
        </ul>
        <p>
          We do not sell personal information, and we do not use Customer Data
          to train machine-learning models or for advertising.
        </p>
      </LegalSection>

      <LegalSection heading="4. Service providers we share data with">
        <p>
          GroomHub uses a small number of trusted vendors to operate the
          Service. Each processes data on our behalf under contractual privacy
          and security obligations.
        </p>
        <ul>
          <li>
            <strong>Clerk</strong> — authentication and session management. Stores
            account credentials and profile information.
          </li>
          <li>
            <strong>Convex</strong> — backend database and application logic.
            Hosts your shop&rsquo;s Customer Data.
          </li>
          <li>
            <strong>Vercel</strong> — application hosting and content delivery.
            May process IP addresses and request metadata.
          </li>
          <li>
            <strong>Transactional email provider</strong> — delivers booking
            confirmations, reminders, and invitation emails. Processes
            recipient name, email, and message content.
          </li>
        </ul>
        <p>
          We may also disclose information if required by law, in response to
          a valid legal process, to protect the rights or safety of GroomHub or
          others, or in connection with a merger, acquisition, or sale of
          assets (in which case affected users will be notified).
        </p>
      </LegalSection>

      <LegalSection heading="5. International data transfers">
        <p>
          GroomHub and its service providers may store and process data in
          jurisdictions outside of Canada, including the United States. When
          data is transferred internationally, we rely on appropriate
          safeguards, including our vendors&rsquo; contractual commitments and
          security certifications.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data retention">
        <p>
          We keep account and Customer Data for as long as your subscription
          is active and for a reasonable period afterward to allow for export,
          dispute resolution, and legal compliance. You can request earlier
          deletion of your Customer Data at any time by contacting us; some
          information may be retained where required by law or for legitimate
          business purposes (e.g. billing records).
        </p>
      </LegalSection>

      <LegalSection heading="7. Security">
        <p>
          We protect personal information using a combination of technical and
          organizational measures, including encryption in transit, hardened
          authentication, role-based access controls, and routine security
          reviews. No system is completely secure; if you believe your account
          has been compromised, contact{" "}
          <a href="mailto:hello@groomhub.ca">hello@groomhub.ca</a> immediately.
        </p>
      </LegalSection>

      <LegalSection heading="8. Your rights">
        <p>
          Depending on where you live, you may have the right to:
        </p>
        <ul>
          <li>Access the personal information we hold about you.</li>
          <li>Correct inaccurate information.</li>
          <li>Request deletion of your personal information.</li>
          <li>Withdraw consent or object to certain processing.</li>
          <li>Receive a portable copy of your data.</li>
          <li>
            Lodge a complaint with your local privacy regulator (in Canada,
            the Office of the Privacy Commissioner).
          </li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a href="mailto:hello@groomhub.ca">hello@groomhub.ca</a>. Shop
          clients should contact the grooming shop they interact with first;
          we will support that shop in fulfilling the request.
        </p>
      </LegalSection>

      <LegalSection heading="9. Cookies and similar technologies">
        <p>
          GroomHub uses cookies and local storage strictly to keep you signed
          in, remember preferences, and operate the Service. We do not use
          advertising cookies or third-party tracking pixels for marketing.
        </p>
      </LegalSection>

      <LegalSection heading="10. Children&rsquo;s privacy">
        <p>
          The Service is intended for businesses and is not directed to
          children under 16. We do not knowingly collect personal information
          from children. If you believe a child has provided us with personal
          information, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we
          will update the &ldquo;Effective&rdquo; date above and, for material
          changes, notify you by email or in-app notice before the changes
          take effect.
        </p>
      </LegalSection>

      <LegalSection heading="12. Contact">
        <p>
          For privacy questions or to exercise your rights, reach us at{" "}
          <a href="mailto:hello@groomhub.ca">hello@groomhub.ca</a>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
