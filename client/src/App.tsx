import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RoomProvider } from './context/RoomContext.js';
import { LandingPage } from './pages/LandingPage.js';
import { RoomPage } from './pages/RoomPage.js';

export const App: React.FC = () => {
  return (
    <RoomProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/room/:id" element={<RoomPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </RoomProvider>
  );
};

export default App;
