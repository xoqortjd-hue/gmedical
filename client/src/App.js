import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import InboundPage from './pages/InboundPage';
import OutboundPage from './pages/OutboundPage';
import InventoryPage from './pages/InventoryPage';
import AlertsPage from './pages/AlertsPage';
import LogsPage from './pages/LogsPage';
import LendingPage from './pages/LendingPage';
import LendingDeployPage from './pages/LendingDeployPage';
import LendingMovementPage from './pages/LendingMovementPage';
import ExpirationAlertsPage from './pages/ExpirationAlertsPage';
import MobileLendingPage from './pages/mobile/MobileLendingPage';
import MobileHomePage from './pages/mobile/MobileHomePage';
import MobileLendingStatusPage from './pages/mobile/MobileLendingStatusPage';
import MobileEquipmentStatusPage from './pages/mobile/MobileEquipmentStatusPage';
import ProductRegistrationPage from './pages/ProductRegistrationPage';
import EquipmentRegistrationStatusPage from './pages/EquipmentRegistrationStatusPage';
import ConsumableRegistrationStatusPage from './pages/ConsumableRegistrationStatusPage';
import BiologicRegistrationStatusPage from './pages/BiologicRegistrationStatusPage';
import LendingProductRegistrationPage from './pages/LendingProductRegistrationPage';
import CEODashboardPage from './pages/CEODashboardPage';
import MobileCEODashboardPage from './pages/mobile/MobileCEODashboardPage';
import MobileInboundPage from './pages/mobile/MobileInboundPage';
import MobileOutboundPage from './pages/mobile/MobileOutboundPage';
import MobileBiologicInventoryPage from './pages/mobile/MobileBiologicInventoryPage';
import ChannelQRPage from './pages/ChannelQRPage';
import GeneralProductRegistrationPage from './pages/GeneralProductRegistrationPage';
import HospitalProductRegistrationPage from './pages/HospitalProductRegistrationPage';
import MobileBottomNav from './components/MobileBottomNav';
import ShakeDetectorProvider from './components/ShakeDetectorProvider';

// 내부 컴포넌트 - useLocation 사용을 위해 Router 내부에 배치
function AppContent() {
  const location = useLocation();
  const isMobilePage = location.pathname.startsWith('/mobile');

  return (
    <div className="app">
      {/* 모바일 페이지에서는 데스크톱 네비게이션 숨김 */}
      {!isMobilePage && <Navigation />}
      <main className={isMobilePage ? "mobile-page-with-nav" : "main-content"}>
        <Routes>
          {/* 기존 라우트 */}
          <Route path="/" element={<HomePage />} />
          <Route path="/inbound" element={<InboundPage />} />
          <Route path="/outbound" element={<OutboundPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/logs" element={<LogsPage />} />

          {/* 랜딩 관리 라우트 */}
          <Route path="/lending/equipment" element={<LendingPage category="EQUIPMENT" />} />
          <Route path="/lending/biologic" element={<LendingPage category="BIOLOGIC" />} />
          <Route path="/lending/deploy" element={<LendingDeployPage />} />
          <Route path="/lending/movement" element={<LendingMovementPage />} />
          <Route path="/lending/expiration" element={<ExpirationAlertsPage />} />

          {/* 제품 등록 및 QR 코드 생성 */}
          <Route path="/products/register" element={<ProductRegistrationPage />} />
          <Route path="/products/general" element={<GeneralProductRegistrationPage />} />
          <Route path="/products/hospital" element={<HospitalProductRegistrationPage />} />
          <Route path="/lending/register" element={<LendingProductRegistrationPage />} />
          <Route path="/channels/qr" element={<ChannelQRPage />} />

          {/* 등록 현황 - 기구/장비 (products 테이블 기반) */}
          <Route path="/equipment/status" element={<EquipmentRegistrationStatusPage />} />
          <Route path="/equipment/consumable" element={<ConsumableRegistrationStatusPage />} />
          <Route path="/lending/biologic-status" element={<BiologicRegistrationStatusPage />} />

          {/* CEO 대시보드 라우트 */}
          <Route path="/ceo/dashboard" element={<CEODashboardPage />} />

          {/* 모바일 PWA 라우트 */}
          <Route path="/mobile" element={<MobileLendingPage />} />
          <Route path="/mobile/home" element={<MobileHomePage />} />
          <Route path="/mobile/status" element={<MobileLendingStatusPage />} />
          <Route path="/mobile/equipment" element={<MobileEquipmentStatusPage />} />
          <Route path="/mobile/ceo-dashboard" element={<MobileCEODashboardPage />} />
          <Route path="/mobile/inbound" element={<MobileInboundPage />} />
          <Route path="/mobile/outbound" element={<MobileOutboundPage />} />
          <Route path="/mobile/biologic-inventory" element={<MobileBiologicInventoryPage />} />
        </Routes>
      </main>
      {/* 모바일 페이지에서 하단 네비게이션 표시 */}
      {isMobilePage && <MobileBottomNav />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <ShakeDetectorProvider>
        <AppContent />
      </ShakeDetectorProvider>
    </Router>
  );
}

export default App;
