import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/mobile.css';

function MobileBottomNav() {
    const location = useLocation();
    const isActive = (path) => location.pathname === path;

    return (
        <nav className="mobile-bottom-nav">
            <Link
                to="/mobile/home"
                className={`nav-item ${isActive('/mobile/home') ? 'active' : ''}`}
            >
                <span className="nav-icon">🏠</span>
                <span className="nav-label">홈</span>
            </Link>

            <Link
                to="/mobile/inbound"
                className={`nav-item ${isActive('/mobile/inbound') ? 'active' : ''}`}
            >
                <span className="nav-icon">📦</span>
                <span className="nav-label">입고</span>
            </Link>

            <Link
                to="/mobile/outbound"
                className={`nav-item ${isActive('/mobile/outbound') ? 'active' : ''}`}
            >
                <span className="nav-icon">📤</span>
                <span className="nav-label">출고</span>
            </Link>

            <Link
                to="/mobile/ceo-dashboard"
                className={`nav-item ${isActive('/mobile/ceo-dashboard') ? 'active' : ''}`}
            >
                <span className="nav-icon">📊</span>
                <span className="nav-label">대시보드</span>
            </Link>

            <Link
                to="/mobile/status"
                className={`nav-item ${isActive('/mobile/status') ? 'active' : ''}`}
            >
                <span className="nav-icon">📋</span>
                <span className="nav-label">현황</span>
            </Link>

            <Link
                to="/mobile/report"
                className={`nav-item ${isActive('/mobile/report') ? 'active' : ''}`}
            >
                <span className="nav-icon">📊</span>
                <span className="nav-label">리포트</span>
            </Link>
        </nav>
    );
}

export default MobileBottomNav;

