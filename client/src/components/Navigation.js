import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link';
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link to="/" className="nav-brand">
          🏥 의약품 재고관리
        </Link>

        <ul className="nav-links">
          <li>
            <Link to="/" className={isActive('/')}>
              홈
            </Link>
          </li>
          <li>
            <Link to="/ceo/dashboard" className={isActive('/ceo/dashboard')}>
              📊 CEO 대시보드
            </Link>
          </li>
          <li>
            <Link to="/inbound" className={isActive('/inbound')}>
              📦 입고
            </Link>
          </li>
          <li>
            <Link to="/outbound" className={isActive('/outbound')}>
              📤 출고
            </Link>
          </li>
          <li>
            <Link to="/inventory" className={isActive('/inventory')}>
              📊 재고현황
            </Link>
          </li>
          <li className="nav-dropdown">
            <span className="nav-link">📝 제품등록</span>
            <ul className="dropdown-menu">
              <li>
                <Link to="/products/general" className={isActive('/products/general')}>
                  📋 일반 제품 등록
                </Link>
              </li>
              <li>
                <Link to="/products/hospital" className={isActive('/products/hospital')}>
                  🏥 병원별 가격 등록
                </Link>
              </li>
              <li>
                <Link to="/products/register" className={isActive('/products/register')}>
                  🔧 기구/장비 등록
                </Link>
              </li>
              <li>
                <Link to="/lending/register" className={isActive('/lending/register')}>
                  📦 랜딩 (가납) 등록
                </Link>
              </li>
              <li>
                <Link to="/channels/qr" className={isActive('/channels/qr')}>
                  🏷️ 창구 QR 생성
                </Link>
              </li>
            </ul>
          </li>
          <li className="nav-dropdown">
            <span className="nav-link">🏥 장비 관리</span>
            <ul className="dropdown-menu">
              <li>
                <Link to="/equipment/status" className={isActive('/equipment/status')}>
                  📋 기구/장비 현황
                </Link>
              </li>
              <li>
                <Link to="/equipment/consumable" className={isActive('/equipment/consumable')}>
                  🔩 소모성 기구 현황
                </Link>
              </li>
              <li>
                <Link to="/lending/biologic-status" className={isActive('/lending/biologic-status')}>
                  💉 바이오로직 현황
                </Link>
              </li>
              <li>
                <Link to="/mobile" className={isActive('/mobile')}>
                  📦 랜딩 배치
                </Link>
              </li>
              <li>
                <Link to="/lending/movement" className={isActive('/lending/movement')}>
                  🚚 이동 관리
                </Link>
              </li>
              <li>
                <Link to="/lending/expiration" className={isActive('/lending/expiration')}>
                  ⏰ 유통기한 알림
                </Link>
              </li>
            </ul>
          </li>
          <li>
            <Link to="/alerts" className={isActive('/alerts')}>
              ⚠️ 알림
            </Link>
          </li>
          <li>
            <Link to="/logs" className={isActive('/logs')}>
              📋 이력
            </Link>
          </li>

        </ul>
      </div>
    </nav>
  );
};

export default Navigation;
