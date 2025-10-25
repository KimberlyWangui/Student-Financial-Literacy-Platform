import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';

function AdminDashboard() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    navigate('/signin');
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '40px',
          borderBottom: '2px solid #dc2626',
          paddingBottom: '20px'
        }}>
          <h1 style={{ color: '#dc2626', margin: 0 }}>Admin Dashboard</h1>
          <button 
            onClick={handleLogout}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Logout
          </button>
        </header>

        <div style={{ 
          backgroundColor: '#fff5f5', 
          padding: '30px', 
          borderRadius: '8px',
          border: '1px solid #dc2626'
        }}>
          <h2 style={{ marginTop: 0, color: '#333' }}>Welcome back, {user?.name || 'Admin'}!</h2>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '20px' }}>
            This is your admin dashboard. Use this space to manage users, monitor activity, 
            and oversee system performance.
          </p>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '6px',
            marginTop: '20px'
          }}>
            <h3 style={{ marginTop: 0, color: '#dc2626' }}>Admin Information</h3>
            <p><strong>Name:</strong> {user?.name}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Role:</strong> {user?.role || 'admin'}</p>
          </div>

          <div style={{ marginTop: '30px', color: '#666' }}>
            <p>👥 User management tools coming soon...</p>
            <p>📊 System analytics dashboard coming soon...</p>
            <p>⚙️ Settings and permissions management coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
