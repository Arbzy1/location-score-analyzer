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
      <div className="navbar-brand">
        <a href="/">Property Location Recommender</a>
      </div>
      <div className="navbar-links">
        {currentUser ? (
          <>
            <span className="user-email">{currentUser.email}</span>
            <button onClick={handleLogout} className="nav-link">Logout</button>
          </>
        ) : (
          <button onClick={handleLogin} className="nav-link">Login with Google</button>
        )}
      </div>
    </nav>
  );
}

export default Navbar; 