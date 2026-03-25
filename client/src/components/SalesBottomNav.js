import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * SalesBottomNav - 영업팀 전용 하단 네비게이션
 * 
 * 5개 메뉴: 홈, 입고, 출고, 신규등록, 입출고현황
 * - 현재 페이지는 부드러운 보라색으로 하이라이트
 * - 각 메뉴 클릭시 해당 페이지/모드로 이동
 */
function SalesBottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    // 현재 경로와 쿼리 파라미터 확인
    const currentPath = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const currentMode = searchParams.get('mode');

    // 메뉴 정의
    const menuItems = [
        {
            id: 'home',
            icon: '🏠',
            label: '홈',
            path: '/mobile/sales',
            isActive: currentPath === '/mobile/sales' && !currentMode
        },
        {
            id: 'inbound',
            icon: '📥',
            label: '입고',
            path: '/mobile/sales/register',
            mode: 'inbound',
            isActive: currentPath === '/mobile/sales/register' && currentMode === 'inbound'
        },
        {
            id: 'outbound',
            icon: '📤',
            label: '출고',
            path: '/mobile/sales/register',
            mode: 'outbound',
            isActive: currentPath === '/mobile/sales/register' && currentMode === 'outbound'
        },
        {
            id: 'new',
            icon: '➕',
            label: '신규등록',
            path: '/mobile/sales/register',
            mode: 'new',
            isActive: currentPath === '/mobile/sales/register' && currentMode === 'new'
        },
        {
            id: 'quick',
            icon: '⚡',
            label: '핵심기구',
            path: '/mobile/sales/quick',
            isActive: currentPath === '/mobile/sales/quick'
        },
        {
            id: 'repair',
            icon: '🔧',
            label: '수리관리',
            path: '/mobile/sales/repair',
            isActive: currentPath === '/mobile/sales/repair'
        },
        {
            id: 'status',
            icon: '📊',
            label: '입출고현황',
            path: '/mobile/sales/status',
            isActive: currentPath === '/mobile/sales/status'
        }
    ];

    // 메뉴 클릭 핸들러
    const handleMenuClick = (item) => {
        if (item.mode) {
            navigate(`${item.path}?mode=${item.mode}`);
        } else {
            navigate(item.path);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'white',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-around',
            padding: '0.5rem 0',
            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
            zIndex: 1000,
            boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
        }}>
            {menuItems.map((item) => (
                <button
                    key={item.id}
                    onClick={() => handleMenuClick(item)}
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.5rem 0.25rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: item.isActive ? '#7c3aed' : '#64748b',
                        backgroundColor: item.isActive ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                        borderRadius: '8px',
                        margin: '0 2px',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <span style={{
                        fontSize: '1.25rem',
                        marginBottom: '0.25rem',
                        filter: item.isActive ? 'none' : 'grayscale(30%)'
                    }}>
                        {item.icon}
                    </span>
                    <span style={{
                        fontSize: '0.65rem',
                        fontWeight: item.isActive ? '600' : '400',
                        whiteSpace: 'nowrap'
                    }}>
                        {item.label}
                    </span>
                </button>
            ))}
        </div>
    );
}

export default SalesBottomNav;
