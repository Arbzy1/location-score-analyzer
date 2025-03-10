import { Link, NavLink } from "react-router-dom";
import "./Navbar.css";

function Navbar({ user, onLogin, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          StreetAnalysis
        </Link>
        
        <div className="nav-links">
          <NavLink to="/" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Home
          </NavLink>
          <NavLink to="/map" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Map View
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            About
          </NavLink>
        </div>
        
        <div className="auth-container">
          {user ? (
            <div className="user-info">
              <img src={user.photoURL} alt={user.displayName} className="user-avatar" />
              <span className="user-name">{user.displayName}</span>
              <button onClick={onLogout} className="logout-button">
                Logout
              </button>
            </div>
          ) : (
            <button onClick={onLogin} className="login-button">
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar; 