import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';

function StudentDashboard() {
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
          borderBottom: '2px solid #1a8ccc',
          paddingBottom: '20px'
        }}>
          <h1 style={{ color: '#1a8ccc', margin: 0 }}>Student Dashboard</h1>
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
          backgroundColor: '#f0f9ff', 
          padding: '30px', 
          borderRadius: '8px',
          border: '1px solid #1a8ccc'
        }}>
          <h2 style={{ marginTop: 0, color: '#333' }}>Welcome, {user?.name || 'Student'}!</h2>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '20px' }}>
            This is your student dashboard. We'll design this page later.
          </p>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '6px',
            marginTop: '20px'
          }}>
            <h3 style={{ marginTop: 0, color: '#1a8ccc' }}>User Information</h3>
            <p><strong>Name:</strong> {user?.name}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Role:</strong> {user?.role || 'student'}</p>
          </div>

          <div style={{ marginTop: '30px', color: '#666' }}>
            <p>📚 Course content coming soon...</p>
            <p>📊 Progress tracking coming soon...</p>
            <p>📝 Assignments coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;