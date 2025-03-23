import { useAuth } from '../../contexts/AuthContext';
import './Navbar.css';

function Navbar() {
  const { currentUser, signInWithGoogle, logout } = useAuth();

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <a href="/" className="navbar-logo">
            <span className="logo-icon">🏠</span>
            <span className="logo-text">
              <span className="logo-text-main">PropertyFinder</span>
              <span className="logo-text-sub">Find Your Perfect Location</span>
            </span>
          </a>
        </div>
        
        <div className="navbar-auth">
          {currentUser ? (
            <div className="user-profile">
              {currentUser.photoURL && (
                <img 
                  src={currentUser.photoURL} 
                  alt="Profile" 
                  className="user-avatar"
                />
              )}
              <div className="user-info">
                <span className="user-email">{currentUser.email}</span>
                <button onClick={handleLogout} className="auth-button logout">
                  <span className="button-icon">👋</span>
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <button onClick={handleLogin} className="auth-button login">
              <span className="button-icon">🔑</span>
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar; 