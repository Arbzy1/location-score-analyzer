import React from 'react';
import { Helmet } from 'react-helmet-async';
import './PrivacyPolicy.css';

const PrivacyPolicy = () => {
  return (
    <div className="privacy-policy-container">
      <Helmet>
        <title>Privacy Policy - Location Score Analyzer</title>
        <meta name="description" content="Privacy policy for Location Score Analyzer - Learn how we protect your data and privacy." />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <div className="privacy-policy-content">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last Updated: June 1, 2023</p>

        <section>
          <h2>Introduction</h2>
          <p>
            Welcome to Location Score Analyzer. We respect your privacy and are committed to protecting your personal data. 
            This privacy policy will inform you about how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.
          </p>
        </section>

        <section>
          <h2>Data We Collect</h2>
          <p>We collect and process the following data:</p>
          <ul>
            <li>Location data you provide for analysis</li>
            <li>Travel preferences and requirements</li>
            <li>Contact information if you choose to provide it</li>
            <li>Usage data and analytics</li>
          </ul>
        </section>

        <section>
          <h2>How We Use Your Data</h2>
          <p>We use your data to:</p>
          <ul>
            <li>Provide location analysis and scoring</li>
            <li>Improve our services</li>
            <li>Send you updates about your analysis</li>
            <li>Respond to your inquiries</li>
          </ul>
        </section>

        <section>
          <h2>Data Storage and Security</h2>
          <p>
            We implement appropriate security measures to protect your personal data against unauthorized access, 
            alteration, disclosure, or destruction. Your data is stored securely and is only accessible to authorized personnel.
          </p>
        </section>

        <section>
          <h2>Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to processing of your data</li>
            <li>Request data portability</li>
          </ul>
        </section>

        <section>
          <h2>Contact Us</h2>
          <p>
            If you have any questions about this privacy policy or our privacy practices, please contact us at:
            <br />
            Email: privacy@your-domain.com
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy; 