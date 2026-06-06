import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ExhibitorList from './pages/ExhibitorList';
import PersonnelList from './pages/PersonnelList';
import PhotoAudit from './pages/PhotoAudit';
import CredentialAudit from './pages/CredentialAudit';
import BatchList from './pages/BatchList';
import VerifyScan from './pages/VerifyScan';
import VerifyLogs from './pages/VerifyLogs';
import MainLayout from './components/MainLayout';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <PrivateRoute>
          <MainLayout>
            <Dashboard />
          </MainLayout>
        </PrivateRoute>
      } />
      <Route path="/exhibitors" element={
        <PrivateRoute>
          <MainLayout>
            <ExhibitorList />
          </MainLayout>
        </PrivateRoute>
      } />
      <Route path="/personnel" element={
        <PrivateRoute>
          <MainLayout>
            <PersonnelList />
          </MainLayout>
        </PrivateRoute>
      } />
      <Route path="/photo-audit" element={
        <PrivateRoute>
          <MainLayout>
            <PhotoAudit />
          </MainLayout>
        </PrivateRoute>
      } />
      <Route path="/credential-audit" element={
        <PrivateRoute>
          <MainLayout>
            <CredentialAudit />
          </MainLayout>
        </PrivateRoute>
      } />
      <Route path="/batches" element={
        <PrivateRoute>
          <MainLayout>
            <BatchList />
          </MainLayout>
        </PrivateRoute>
      } />
      <Route path="/verify" element={
        <PrivateRoute>
          <MainLayout>
            <VerifyScan />
          </MainLayout>
        </PrivateRoute>
      } />
      <Route path="/verify-logs" element={
        <PrivateRoute>
          <MainLayout>
            <VerifyLogs />
          </MainLayout>
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
