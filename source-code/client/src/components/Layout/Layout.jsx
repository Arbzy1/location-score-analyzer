import { Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import './Layout.css';

function Layout() {
  console.log("🎨 Layout: Rendering");
  const { user, signIn, logout } = useAuth();

  return (
    <div className="app-container">
      <Navbar user={user} onLogin={signIn} onLogout={logout} />
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default Layout; 