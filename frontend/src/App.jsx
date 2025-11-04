import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './components/LandingPage';
import SignUp from './components/SignUp'
import SignIn from './components/SignIn'
import OTPVerification from './components/OTPVerification'
import GoogleCallback from './components/GoogleCallback'
import ProtectedRoute from './components/ProtectedRoute'
import StudentDashboard from './components/StudentDashboard'
import AdminDashboard from './components/AdminDashboard'
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          {/* Default route - redirect to signin */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Public routes */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/verify-otp" element={<OTPVerification />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />
          <Route path="/auth/google/success" element={<GoogleCallback />} />  {/* ADD THIS LINE */}
          
          {/* Protected routes - Student Dashboard */}
          <Route 
            path="/student/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Protected routes - Admin Dashboard */}
          <Route 
            path="/admin/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Catch all route - redirect to signin if route doesn't exist */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App