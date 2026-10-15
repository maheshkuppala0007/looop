import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { ToastProvider } from './context/ToastContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { SiteConfigProvider } from './context/SiteConfigContext';
import OfflineBanner from './components/common/OfflineBanner';
import LocationPromptModal from './components/location/LocationPromptModal';
import AppRoutes from './routes/AppRoutes';

export const App = () => {
  return (
    <AuthProvider>
      <LocationProvider>
        <SocketProvider>
          <ToastProvider>
            <SiteConfigProvider>
              <BrowserRouter>
                <OfflineBanner />
                <LocationPromptModal />
                <NotificationProvider>
                  <AppRoutes />
                </NotificationProvider>
              </BrowserRouter>
            </SiteConfigProvider>
          </ToastProvider>
        </SocketProvider>
      </LocationProvider>
    </AuthProvider>
  );
};

export default App;
