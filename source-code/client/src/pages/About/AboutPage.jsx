import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './AboutPage.css';

const REPO_URL = 'https://github.com/Arbzy1/location-score-analyzer';

function AboutPage() {
  const location = useLocation();

  // React Router doesn't scroll to #anchors on its own
  useEffect(() => {
    if (location.hash) {
      document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash]);

  return (
    <div className="about-page">
      <h1 className="page-title">About Location Score Analyzer</h1>

      <section className="about-section">
        <h2>What it does</h2>
        <p>
          Location Score Analyzer helps you find a good area to live. It samples locations
          across a city and scores each one on how long your regular journeys would take,
          how close the nearest schools, hospitals and supermarkets are, and how well it is
          served by buses. You choose the destinations, how often you visit them and how much
          each amenity matters.
        </p>
        <p>It was built as my BSc dissertation project, focused on Cardiff.</p>
      </section>

      <section className="about-section">
        <h2>How it works</h2>
        <ol className="feature-list">
          <li>Find the city boundary and pick 20 random locations inside it</li>
          <li>Find the nearest school, hospital and supermarket to each from OpenStreetMap</li>
          <li>Work out travel times by car, bike, foot and bus to your destinations</li>
          <li>Score bus access from the routes serving the nearest stop</li>
          <li>Combine everything into a score out of 100 and show the top five</li>
        </ol>
      </section>

      <section className="about-section cloud-edition" id="cloud-edition">
        <h2>Cloud edition vs. the BSc submission</h2>
        <p>
          The version on this website is <strong>not exactly what was submitted for my BSc</strong>.
          The original depended on several services I ran on my own machines, which can't be
          hosted for free in the cloud, so they have been replaced:
        </p>
        <table className="comparison-table">
          <thead>
            <tr><th></th><th>BSc submission</th><th>This website</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Bus journeys</td>
              <td>OpenTripPlanner server, live timetable queries</td>
              <td>Pre-computed from a January 2025 Cardiff Bus timetable for a typical weekday morning</td>
            </tr>
            <tr>
              <td>Car, bike and walking</td>
              <td>Self-hosted OpenRouteService, one request per journey</td>
              <td>Hosted openrouteservice API, batched into one request per mode</td>
            </tr>
            <tr>
              <td>Amenities</td>
              <td>OSMnx and GeoPandas in Python</td>
              <td>OpenStreetMap queried directly, cached for two weeks</td>
            </tr>
            <tr>
              <td>Backend</td>
              <td>Python Flask server</td>
              <td>Cloudflare Workers (TypeScript)</td>
            </tr>
            <tr>
              <td>Saved data</td>
              <td>Firebase Firestore</td>
              <td>Neon Postgres</td>
            </tr>
          </tbody>
        </table>
        <p>
          Two scoring calculations were also corrected: amenity distances are now true
          distances (the original over-estimated them), and the travel score uses total weekly
          travel time, as the score explanation describes. Scores will therefore differ from
          those in the dissertation. The original code is kept in the{' '}
          <a href={`${REPO_URL}/tree/master/source-code/server`} target="_blank" rel="noopener noreferrer">repository</a>.
        </p>
      </section>

      <section className="about-section">
        <h2>Technology</h2>
        <div className="tech-stack">
          <div className="tech-category">
            <h3>Frontend</h3>
            <ul>
              <li>React</li>
              <li>React Router</li>
              <li>Mapbox GL</li>
            </ul>
          </div>

          <div className="tech-category">
            <h3>Backend</h3>
            <ul>
              <li>Cloudflare Workers</li>
              <li>Neon Postgres</li>
              <li>openrouteservice</li>
              <li>OpenStreetMap</li>
            </ul>
          </div>

          <div className="tech-category">
            <h3>Authentication</h3>
            <ul>
              <li>Firebase Authentication</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2>Source code and feedback</h2>
        <p>The code, setup guide and original BSc version are on GitHub. Issues and suggestions are welcome.</p>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="contact-link">
          github.com/Arbzy1/location-score-analyzer
        </a>
      </section>
    </div>
  );
}

export default AboutPage;
