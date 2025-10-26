import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';

function StudentDashboard() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    // Prevent multiple clicks
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    
    try {
      // Call logout API
      await authService.logout();
      
      // Redirect to landing page
      navigate('/', { 
        replace: true,
        state: { message: 'You have been logged out successfully.' }
      });
      
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, redirect to landing page
      // because local storage has been cleared
      navigate('/', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f5f5f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header with Logout */}
      <header style={{
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        padding: '16px 24px'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: '600',
            color: '#1a1a1a',
            margin: 0
          }}>
            Student Dashboard
          </h1>
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{
              padding: '8px 20px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              opacity: isLoggingOut ? 0.6 : 1
            }}
            onMouseOver={(e) => {
              if (!isLoggingOut) e.target.style.backgroundColor = '#dc2626';
            }}
            onMouseOut={(e) => {
              if (!isLoggingOut) e.target.style.backgroundColor = '#ef4444';
            }}
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 24px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '32px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '600',
            marginBottom: '16px',
            color: '#1a1a1a'
          }}>
            Welcome, {user?.name || 'Student'}!
          </h2>

          <p style={{
            fontSize: '16px',
            color: '#666',
            marginBottom: '32px'
          }}>
            This is your student dashboard. We'll design this page later.
          </p>

          {/* User Info Card */}
          <div style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '16px',
              color: '#1a1a1a'
            }}>
              User Information
            </h3>
            <p style={{ marginBottom: '8px', color: '#333' }}>
              <strong>Name:</strong> {user?.name}
            </p>
            <p style={{ marginBottom: '8px', color: '#333' }}>
              <strong>Email:</strong> {user?.email}
            </p>
            <p style={{ marginBottom: '0', color: '#333' }}>
              <strong>Role:</strong> {user?.role || 'student'}
            </p>
          </div>

          {/* Coming Soon Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px'
          }}>
            <div style={{
              backgroundColor: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '24px', marginBottom: '8px' }}>📚</p>
              <p style={{ color: '#1e40af', fontWeight: '500' }}>
                Course content coming soon...
              </p>
            </div>
            <div style={{
              backgroundColor: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '24px', marginBottom: '8px' }}>📊</p>
              <p style={{ color: '#1e40af', fontWeight: '500' }}>
                Progress tracking coming soon...
              </p>
            </div>
            <div style={{
              backgroundColor: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '24px', marginBottom: '8px' }}>📝</p>
              <p style={{ color: '#1e40af', fontWeight: '500' }}>
                Assignments coming soon...
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default StudentDashboard;