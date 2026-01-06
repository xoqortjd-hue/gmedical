import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/mobile.css';

/**
 * MobileTeamSelectPage - 팀 선택 화면
 * 
 * 진입점: /mobile
 * 역할: 영업팀/관리팀 중 하나를 선택하여 해당 홈으로 이동
 * 
 * @returns {JSX.Element}
 */
function MobileTeamSelectPage() {
    const navigate = useNavigate();

    // 디버그 로그
    console.log('[MobileTeamSelectPage] Rendering team selection screen');

    /**
     * 팀 선택 핸들러
     * @param {string} team - 'sales' | 'management'
     */
    const handleTeamSelect = (team) => {
        console.log(`[MobileTeamSelectPage] Team selected: ${team}`);

        if (team === 'sales') {
            navigate('/mobile/sales');
        } else if (team === 'management') {
            navigate('/mobile/management');
        }
    };

    return (
        <div className="mobile-container" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            padding: '2rem',
            background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)'
        }}>
            {/* 로고/타이틀 영역 */}
            <div style={{
                textAlign: 'center',
                marginBottom: '3rem'
            }}>
                <div style={{
                    fontSize: '3rem',
                    marginBottom: '1rem'
                }}>
                    🏢
                </div>
                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#1e293b',
                    marginBottom: '0.5rem'
                }}>
                    금양메디칼 기구관리
                </h1>
                <p style={{
                    color: '#64748b',
                    fontSize: '0.9rem'
                }}>
                    팀을 선택해 주세요
                </p>
            </div>

            {/* 팀 선택 카드 */}
            <div style={{
                width: '100%',
                maxWidth: '400px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                {/* 영업팀 카드 */}
                <button
                    onClick={() => handleTeamSelect('sales')}
                    className="team-card"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        border: 'none',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                >
                    <div style={{
                        fontSize: '2.5rem',
                        marginRight: '1rem'
                    }}>
                        💼
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{
                            fontSize: '1.25rem',
                            fontWeight: 'bold',
                            color: 'white',
                            marginBottom: '0.25rem'
                        }}>
                            영업팀
                        </div>
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'rgba(255,255,255,0.8)'
                        }}>
                            입출고 등록 / 입출고 현황
                        </div>
                    </div>
                    <div style={{
                        marginLeft: 'auto',
                        color: 'white',
                        fontSize: '1.5rem'
                    }}>
                        →
                    </div>
                </button>

                {/* 관리팀 카드 */}
                <button
                    onClick={() => handleTeamSelect('management')}
                    className="team-card"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                        border: 'none',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                >
                    <div style={{
                        fontSize: '2.5rem',
                        marginRight: '1rem'
                    }}>
                        🔧
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{
                            fontSize: '1.25rem',
                            fontWeight: 'bold',
                            color: 'white',
                            marginBottom: '0.25rem'
                        }}>
                            관리팀
                        </div>
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'rgba(255,255,255,0.8)'
                        }}>
                            기구 이동 등록 / 상세 관리
                        </div>
                    </div>
                    <div style={{
                        marginLeft: 'auto',
                        color: 'white',
                        fontSize: '1.5rem'
                    }}>
                        →
                    </div>
                </button>
            </div>

            {/* 버전 정보 */}
            <div style={{
                marginTop: '3rem',
                color: '#94a3b8',
                fontSize: '0.75rem'
            }}>
                v2.0 - 영업팀/관리팀 분리
            </div>
        </div>
    );
}

export default MobileTeamSelectPage;
