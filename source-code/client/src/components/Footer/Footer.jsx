import { Link } from "react-router-dom";
import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <p>&copy; {new Date().getFullYear()} Location Score Analyzer · Cloud edition of a BSc project</p>
        <div className="footer-links">
          <Link to="/about" className="footer-link">About</Link>
          <Link to="/privacy" className="footer-link">Privacy Policy</Link>
          <Link to="/terms" className="footer-link">Terms of Service</Link>
          <a href="https://github.com/Arbzy1/location-score-analyzer" target="_blank" rel="noopener noreferrer" className="footer-link">GitHub</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
