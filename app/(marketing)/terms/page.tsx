import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Terms of Service · GroomHub",
  description:
    "The terms that govern your use of GroomHub's grooming-shop management software.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" effectiveDate="May 29, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
        use of GroomHub, a software-as-a-service platform for pet grooming
        businesses (the &ldquo;Service&rdquo;) operated by GroomHub
        (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By creating
        an account or using the Service, you agree to these Terms. If you do
        not agree, do not use the Service.
      </p>

      <LegalSection heading="1. Eligibility and accounts">
        <p>
          You must be at least 18 years old and legally able to enter into a
          contract to use GroomHub. By creating an account you confirm that the
          information you provide is accurate and that you are authorized to
          act on behalf of the grooming business you register.
        </p>
        <p>
          You are responsible for safeguarding your sign-in credentials and for
          all activity that occurs under your account. Notify us immediately at{" "}
          <a href="mailto:hello@groomhub.ca">hello@groomhub.ca</a> if you
          suspect unauthorized access.
        </p>
      </LegalSection>

      <LegalSection heading="2. The Service">
        <p>
          GroomHub provides tools for grooming shops to manage appointments,
          customer and pet records, staff schedules, automated reminders, and
          related operations. Features and functionality may change over time;
          we may add, modify, or remove features at our discretion.
        </p>
      </LegalSection>

      <LegalSection heading="3. Subscriptions, billing, and free trials">
        <p>
          GroomHub is offered on monthly subscription plans. Plan pricing and
          included features are described on our pricing page and may be
          updated from time to time. New shops may be eligible for a free
          trial; at the end of the trial you will be required to choose a paid
          plan to continue using the Service.
        </p>
        <p>
          Subscription fees are billed in advance on a recurring basis and are
          non-refundable except where required by law. You may cancel your
          subscription at any time from your account settings; cancellation
          takes effect at the end of the current billing period.
        </p>
        <p>
          We reserve the right to change subscription pricing with at least 30
          days&rsquo; notice. Continued use of the Service after a price change
          constitutes acceptance of the new pricing.
        </p>
      </LegalSection>

      <LegalSection heading="4. Your data and your customers&rsquo; data">
        <p>
          You retain all rights to the information you enter into GroomHub,
          including business details, client and pet records, appointments,
          notes, and uploaded images (&ldquo;Customer Data&rdquo;).
        </p>
        <p>
          You grant us a limited licence to host, process, and display
          Customer Data solely to provide and improve the Service. You are
          solely responsible for the lawful collection and use of Customer
          Data, including obtaining any consents required from your own
          clients for storing their personal information in GroomHub.
        </p>
        <p>
          You can export or request deletion of your Customer Data at any time
          by contacting{" "}
          <a href="mailto:hello@groomhub.ca">hello@groomhub.ca</a>.
        </p>
      </LegalSection>

      <LegalSection heading="5. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service to violate any law or third-party right.</li>
          <li>
            Upload content that is unlawful, abusive, fraudulent, or that
            infringes intellectual property rights.
          </li>
          <li>
            Attempt to gain unauthorized access to the Service, other
            accounts, or our infrastructure.
          </li>
          <li>
            Reverse engineer, decompile, or scrape the Service, or build a
            competing product using our materials.
          </li>
          <li>
            Send unsolicited marketing communications to your clients through
            the Service.
          </li>
        </ul>
        <p>
          We may suspend or terminate accounts that violate these rules,
          without notice where the violation poses risk to other users or our
          infrastructure.
        </p>
      </LegalSection>

      <LegalSection heading="6. Third-party services">
        <p>
          GroomHub relies on third-party providers for authentication, hosting,
          and transactional email. By using the Service you acknowledge that
          your data will be processed by these providers under their own terms
          and privacy practices. See our{" "}
          <a href="/privacy">Privacy Policy</a> for the current list.
        </p>
      </LegalSection>

      <LegalSection heading="7. Intellectual property">
        <p>
          The Service, including its software, design, logos, and content
          authored by us, is owned by GroomHub and protected by intellectual
          property laws. These Terms do not grant you any right to our
          trademarks or branding.
        </p>
      </LegalSection>

      <LegalSection heading="8. Service availability">
        <p>
          We aim to keep the Service available continuously, but we do not
          guarantee uninterrupted access. Planned maintenance, third-party
          outages, or unforeseen events may cause downtime. We are not liable
          for any losses resulting from temporary unavailability.
        </p>
      </LegalSection>

      <LegalSection heading="9. Termination">
        <p>
          You may close your account at any time. We may suspend or terminate
          your access if you breach these Terms, fail to pay fees, or if we
          discontinue the Service. On termination we will provide a reasonable
          window to export Customer Data before deletion.
        </p>
      </LegalSection>

      <LegalSection heading="10. Disclaimers">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, without warranties of any kind, express or
          implied, including warranties of merchantability, fitness for a
          particular purpose, and non-infringement. We do not warrant that the
          Service will be error-free or meet your specific requirements.
        </p>
      </LegalSection>

      <LegalSection heading="11. Limitation of liability">
        <p>
          To the maximum extent permitted by law, GroomHub will not be liable
          for any indirect, incidental, special, consequential, or punitive
          damages, or for lost profits, revenue, or data, arising out of or
          related to your use of the Service. Our aggregate liability for any
          claim arising from these Terms or the Service will not exceed the
          amount you paid us in the 12 months preceding the claim.
        </p>
      </LegalSection>

      <LegalSection heading="12. Indemnification">
        <p>
          You agree to indemnify and hold GroomHub harmless from any claims,
          damages, or expenses arising from your use of the Service, your
          Customer Data, or your violation of these Terms.
        </p>
      </LegalSection>

      <LegalSection heading="13. Changes to these Terms">
        <p>
          We may update these Terms from time to time. When we do, we will
          revise the &ldquo;Effective&rdquo; date above and, for material
          changes, notify you by email or in-app notice. Continued use of the
          Service after the changes take effect constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection heading="14. Governing law">
        <p>
          These Terms are governed by the laws of the Province of Ontario and
          the federal laws of Canada applicable therein, without regard to
          conflict-of-laws principles. You agree to the exclusive jurisdiction
          of the courts located in Ontario for any dispute arising from these
          Terms or the Service.
        </p>
      </LegalSection>

      <LegalSection heading="15. Contact">
        <p>
          Questions about these Terms? Reach us at{" "}
          <a href="mailto:hello@groomhub.ca">hello@groomhub.ca</a>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
