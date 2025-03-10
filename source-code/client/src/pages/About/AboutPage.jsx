import './AboutPage.css';

function AboutPage() {
  return (
    <div className="about-page">
      <h1 className="page-title">About Street Network Analysis</h1>
      
      <section className="about-section">
        <h2>Our Mission</h2>
        <p>
          Street Network Analysis is a tool designed to help users find optimal locations
          based on proximity to essential amenities like schools, hospitals, and supermarkets.
          Our mission is to provide data-driven insights for urban planning, real estate decisions,
          and community development.
        </p>
      </section>
      
      <section className="about-section">
        <h2>How It Works</h2>
        <p>
          Our application uses OpenStreetMap data and spatial analysis to:
        </p>
        <ol className="feature-list">
          <li>Generate potential locations within a city</li>
          <li>Calculate distances to nearby amenities</li>
          <li>Score locations based on accessibility metrics</li>
          <li>Visualize results on an interactive map</li>
        </ol>
      </section>
      
      <section className="about-section">
        <h2>Technology Stack</h2>
        <div className="tech-stack">
          <div className="tech-category">
            <h3>Frontend</h3>
            <ul>
              <li>React</li>
              <li>React Router</li>
              <li>Mapbox GL</li>
              <li>Axios</li>
            </ul>
          </div>
          
          <div className="tech-category">
            <h3>Backend</h3>
            <ul>
              <li>Python</li>
              <li>Flask</li>
              <li>OSMnx</li>
              <li>GeoPandas</li>
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
        <h2>Contact Us</h2>
        <p>
          Have questions or suggestions? We'd love to hear from you!
        </p>
        <a href="mailto:contact@streetnetworkanalysis.com" className="contact-link">
          contact@streetnetworkanalysis.com
        </a>
      </section>
    </div>
  );
}

export default AboutPage; 