import React from 'react';
import { Link } from 'react-router-dom';
import SalesBottomNav from '../../components/SalesBottomNav';
import '../../styles/mobile.css';

/**
 * SalesHomePage - 영업팀 홈 화면
 * 
 * 진입점: /mobile/sales
 * 역할: 입출고 등록 / 입출고 현황 카드 제공
 * 
 * @returns {JSX.Element}
 */
function SalesHomePage() {
    // 디버그 로그
    console.log('[SalesHomePage] Rendering sales home screen');

    return (
        <div className="mobile-container" style={{
            padding: '1rem',
            minHeight: '100vh',
            background: '#f8fafc',
            paddingBottom: '5rem'
        }}>
            {/* 헤더 */}
            <div className="mobile-header" style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                padding: '1.5rem',
                borderRadius: '16px',
                marginBottom: '1.5rem',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💼</div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>
                    영업팀
                </h1>
                <p style={{ fontSize: '0.85rem', opacity: 0.9, margin: '0.25rem 0 0 0' }}>
                    입출고 관리 시스템
                </p>
            </div>

            {/* 기능 카드 영역 */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                {/* 입출고 등록 카드 */}
                <Link
                    to="/mobile/sales/register"
                    style={{ textDecoration: 'none' }}
                >
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.75rem',
                            marginRight: '1rem'
                        }}>
                            📝
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: '1.1rem',
                                fontWeight: 'bold',
                                color: '#1e293b',
                                marginBottom: '0.25rem'
                            }}>
                                입출고 등록
                            </div>
                            <div style={{
                                fontSize: '0.8rem',
                                color: '#64748b'
                            }}>
                                입고 / 출고 / 신규 기구 등록
                            </div>
                        </div>
                        <div style={{
                            color: '#94a3b8',
                            fontSize: '1.25rem'
                        }}>
                            →
                        </div>
                    </div>
                </Link>

                {/* 입출고 현황 카드 */}
                <Link
                    to="/mobile/sales/status"
                    style={{ textDecoration: 'none' }}
                >
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.75rem',
                            marginRight: '1rem'
                        }}>
                            📊
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: '1.1rem',
                                fontWeight: 'bold',
                                color: '#1e293b',
                                marginBottom: '0.25rem'
                            }}>
                                입출고 현황
                            </div>
                            <div style={{
                                fontSize: '0.8rem',
                                color: '#64748b'
                            }}>
                                전체 기구 상태 한눈에 확인
                            </div>
                        </div>
                        <div style={{
                            color: '#94a3b8',
                            fontSize: '1.25rem'
                        }}>
                            →
                        </div>
                    </div>
                </Link>
            </div>

            {/* 하단 네비게이션 */}
            <SalesBottomNav />
        </div>
    );
}

export default SalesHomePage;
