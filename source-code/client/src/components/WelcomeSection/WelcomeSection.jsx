import "./WelcomeSection.css";

export const WelcomeSection = ({ user, onLogout }) => {
  return (
    <div className="welcome-section">
      <div className="user-greeting">
        <div className="user-info">
          <img src={user.photoURL} alt={user.displayName} className="user-avatar" />
          <div className="user-details">
            <h3>Welcome, {user.displayName}!</h3>
            <p>Use the search bar below to analyze street networks in your area.</p>
          </div>
        </div>
      </div>
      <button onClick={onLogout} className="btn btn-logout">Logout</button>
    </div>
  );
}; 