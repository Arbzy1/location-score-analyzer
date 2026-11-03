import { Link } from 'react-router-dom';
import './CloudNotice.css';

// Explains that the hosted site is not the exact version submitted for the BSc.
function CloudNotice() {
  return (
    <div className="cloud-notice" role="note">
      <span className="cloud-notice-badge">Cloud edition</span>
      <span className="cloud-notice-text">
        This hosted version differs from my BSc submission: the original ran its own routing
        servers, so transport times here come from cloud services instead.
      </span>
      <Link to="/about#cloud-edition" className="cloud-notice-link">What changed</Link>
    </div>
  );
}

export default CloudNotice;
