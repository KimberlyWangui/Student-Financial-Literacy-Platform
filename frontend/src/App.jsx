import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SignUp from './components/SignUp'
import SignIn from './components/SignIn'
import OTPVerification from './components/OTPVerification'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          {/* Default route - redirect to signin */}
          <Route path="/" element={<Navigate to="/signin" replace />} />
          
          {/* Sign In route */}
          <Route path="/signin" element={<SignIn />} />
          
          {/* Sign Up route */}
          <Route path="/signup" element={<SignUp />} />
          
          {/* OTP Verification route */}
          <Route path="/verify-otp" element={<OTPVerification />} />
          
          {/* Catch all route - redirect to signin if route doesn't exist */}
          <Route path="*" element={<Navigate to="/signin" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App