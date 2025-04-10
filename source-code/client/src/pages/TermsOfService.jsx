import React from 'react';
import './TermsOfService.css';

function TermsOfService() {
  return (
    <div className="terms-container">
      <div className="terms-content">
        <h1>Terms of Service</h1>
        <p>Last updated: {new Date().toLocaleDateString()}</p>

        <h2>1. Introduction</h2>
        <p>
          Welcome to LocationScorer. By accessing and using our service, you agree to be bound by these Terms of Service.
          Please read these terms carefully before using our service.
        </p>

        <h2>2. Service Description</h2>
        <p>
          LocationScorer is a location analysis tool that provides scoring and insights for residential locations based on
          various factors including travel times, amenities, and public transport accessibility. Our service is provided
          "as is" and "as available" without any warranties of any kind.
        </p>

        <h2>3. User Responsibilities</h2>
        <p>
          Users are responsible for:
        </p>
        <ul>
          <li>Providing accurate information when using our service</li>
          <li>Using the service in compliance with all applicable laws and regulations</li>
          <li>Not attempting to manipulate or abuse the scoring system</li>
          <li>Not using the service for any illegal or unauthorized purpose</li>
        </ul>

        <h2>4. Data Usage and Privacy</h2>
        <p>
          We collect and process location data to provide our service. This data is handled in accordance with our
          Privacy Policy. By using our service, you consent to the collection and use of this data as described.
        </p>

        <h2>5. Intellectual Property</h2>
        <p>
          All content, features, and functionality of LocationScorer, including but not limited to text, graphics,
          logos, and software, are owned by LocationScorer and are protected by international copyright, trademark,
          and other intellectual property laws.
        </p>

        <h2>6. Disclaimer of Warranties</h2>
        <p>
          LocationScorer provides its service on an "as is" and "as available" basis. We make no representations or
          warranties of any kind, express or implied, as to the operation of our service or the information,
          content, or materials included.
        </p>

        <h2>7. Limitation of Liability</h2>
        <p>
          LocationScorer shall not be liable for any indirect, incidental, special, consequential, or punitive damages
          resulting from your use or inability to use the service.
        </p>

        <h2>8. Changes to Terms</h2>
        <p>
          We reserve the right to modify these terms at any time. We will notify users of any material changes by
          posting the new terms on this page.
        </p>

        <h2>9. Contact Information</h2>
        <p>
          If you have any questions about these Terms of Service, please contact us at:
          <br />
          Email: support@locationscorer.com
        </p>
      </div>
    </div>
  );
}

export default TermsOfService; 