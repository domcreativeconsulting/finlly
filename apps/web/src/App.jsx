import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PerfilPage from './pages/PerfilPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import BillingStatusPage from './pages/BillingStatusPage.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import ContasPagarPage from './pages/ContasPagarPage.jsx';
import ContasReceberPage from './pages/ContasReceberPage.jsx';
import CategoriasPage from './pages/CategoriasPage.jsx';
import ContasPage from './pages/ContasPage.jsx';
import ExtratoPage from './pages/ExtratoPage.jsx';
import InvestimentosPage from './pages/InvestimentosPage.jsx';
import MetasPage from './pages/MetasPage.jsx';
import AnexosPage from './pages/AnexosPage.jsx';
import RelatoriosPage from './pages/RelatoriosPage.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import LandingPage from './pages/LandingPage.jsx';

const isAppSubdomain = window.location.hostname === 'app.finlly.com.br';

export default function App() {
  return (
    <>
      <OfflineBanner />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route
          path="/dashboard"
          element={<ProtectedRoute element={<DashboardPage />} />}
        />
        <Route
          path="/perfil"
          element={<ProtectedRoute element={<PerfilPage />} requiresSubscription={false} />}
        />
        <Route
          path="/billing/status"
          element={<ProtectedRoute element={<BillingStatusPage />} requiresSubscription={false} />}
        />
        <Route
          path="/assinatura"
          element={<ProtectedRoute element={<BillingStatusPage />} requiresSubscription={false} />}
        />
        <Route
          path="/contas-pagar"
          element={<ProtectedRoute element={<ContasPagarPage />} />}
        />
        <Route
          path="/contas-receber"
          element={<ProtectedRoute element={<ContasReceberPage />} />}
        />
        <Route
          path="/categorias"
          element={<ProtectedRoute element={<CategoriasPage />} />}
        />
        <Route
          path="/contas"
          element={<ProtectedRoute element={<ContasPage />} />}
        />
        <Route
          path="/extrato"
          element={<ProtectedRoute element={<ExtratoPage />} />}
        />
        <Route
          path="/investimentos"
          element={<ProtectedRoute element={<InvestimentosPage />} />}
        />
        <Route
          path="/metas"
          element={<ProtectedRoute element={<MetasPage />} />}
        />
        <Route
          path="/anexos"
          element={<ProtectedRoute element={<AnexosPage />} />}
        />
        <Route
          path="/relatorios"
          element={<ProtectedRoute element={<RelatoriosPage />} />}
        />
        <Route
          path="/"
          element={isAppSubdomain ? <Navigate to="/login" replace /> : <LandingPage />}
        />
        <Route path="/logout" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </>
  );
}
