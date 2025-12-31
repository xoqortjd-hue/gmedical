import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import '../../styles/mobile.css';

axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';

const MobileBiologicInventoryPage = () => {
    const [inventory, setInventory] = useState([]);
    const [channels, setChannels] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState('');
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [deleteMode, setDeleteMode] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchChannels();
    }, []);

    useEffect(() => {
        fetchInventory();
    }, [selectedChannel]);

    const fetchChannels = async () => {
        try {
            const res = await axios.get('/api/channels');
            setChannels(res.data);
        } catch (error) {
            console.error('채널 조회 실패:', error);
        }
    };

    const fetchInventory = async () => {
        try {
            setLoading(true);
            const params = selectedChannel ? `?channel_id=${selectedChannel}` : '';
            const res = await axios.get(`/api/lending/biologic-inventory${params}`);
            setInventory(res.data.items || []);
            setSummary(res.data.summary || {});
        } catch (error) {
            console.error('재고 조회 실패:', error);
            setMessage('❌ 재고 조회 실패');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (itemId, productName) => {
        if (!window.confirm(`"${productName}" 항목을 삭제하시겠습니까?\n\n⚠️ 삭제된 항목은 복구할 수 없습니다.`)) {
            return;
        }

        try {
            await axios.delete(`/api/lending/biologic-inventory/${itemId}`);
            setMessage('✅ 삭제되었습니다');
            fetchInventory();
        } catch (error) {
            console.error('삭제 실패:', error);
            setMessage('❌ 삭제 실패: ' + (error.response?.data?.error || error.message));
        }
    };

    const getExpiryStyle = (status) => {
        switch (status) {
            case 'EXPIRED': return { background: '#fee2e2', color: '#dc2626', fontWeight: '600' };
            case 'CRITICAL': return { background: '#fef3c7', color: '#d97706', fontWeight: '600' };
            case 'WARNING': return { background: '#fef9c3', color: '#ca8a04' };
            default: return { background: '#dcfce7', color: '#16a34a' };
        }
    };

    const getExpiryIcon = (status) => {
        switch (status) {
            case 'EXPIRED': return '⚫';
            case 'CRITICAL': return '🔴';
            case 'WARNING': return '🟡';
            case 'UNKNOWN': return '⚪';
            default: return '🟢';
        }
    };

    const getExpiryLabel = (status, days) => {
        if (status === 'EXPIRED') return '만료됨';
        if (status === 'UNKNOWN') return '기한 미정';
        if (days === null || days === undefined) return '-';
        return `D-${days}`;
    };

    return (
        <div className="mobile-inbound-page">
            {/* 헤더 */}
            <div className="mobile-header" style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                <Link to="/mobile/status" style={{ color: 'white', textDecoration: 'none' }}>
                    ← 현황
                </Link>
                <h1>📊 바이오로직 재고현황</h1>
            </div>

            {/* 메시지 알림 */}
            {message && (
                <div style={{
                    padding: '0.8rem',
                    margin: '0.5rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
                    color: message.includes('✅') ? '#155724' : '#721c24',
                    fontSize: '0.9rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>{message}</span>
                    <button
                        onClick={() => setMessage('')}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* 필터 및 액션 버튼 */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                alignItems: 'center'
            }}>
                <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        background: 'white'
                    }}
                >
                    <option value="">전체 창구</option>
                    {channels.map(ch => (
                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                    ))}
                </select>
                <button
                    onClick={fetchInventory}
                    style={{
                        padding: '0.75rem',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                    title="새로고침"
                >
                    🔄
                </button>
                <button
                    onClick={() => setDeleteMode(!deleteMode)}
                    style={{
                        padding: '0.75rem',
                        background: deleteMode ? '#dc2626' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                    title={deleteMode ? '삭제모드 종료' : '삭제모드'}
                >
                    🗑️
                </button>
            </div>

            {deleteMode && (
                <div style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    padding: '0.5rem 1rem',
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '0.85rem'
                }}>
                    ⚠️ 삭제 모드 - 각 항목의 삭제 버튼을 클릭하세요
                </div>
            )}

            {/* 요약 카드 */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.5rem',
                padding: '1rem',
                background: 'white',
                margin: '0.5rem',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e40af' }}>{summary.total_quantity || 0}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666' }}>총 재고</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>{summary.expired || 0}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666' }}>만료</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#d97706' }}>{summary.critical || 0}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666' }}>임박(7일)</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ca8a04' }}>{summary.warning || 0}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666' }}>주의(30일)</div>
                </div>
            </div>

            {/* 재고 목록 */}
            <div style={{ padding: '0 1rem', paddingBottom: '5rem' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                        로딩 중...
                    </div>
                ) : inventory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                        재고가 없습니다
                    </div>
                ) : (
                    inventory.map(item => (
                        <div
                            key={item.lending_item_id}
                            style={{
                                background: deleteMode ? '#fef2f2' : 'white',
                                borderRadius: '12px',
                                padding: '1rem',
                                marginBottom: '0.75rem',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                                borderLeft: `4px solid ${item.expiry_status === 'EXPIRED' ? '#dc2626' :
                                    item.expiry_status === 'CRITICAL' ? '#d97706' :
                                        item.expiry_status === 'WARNING' ? '#ca8a04' : '#16a34a'
                                    }`
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '0.25rem' }}>
                                        {item.product_name}
                                    </div>
                                    {item.channel_name && (
                                        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>
                                            📍 {item.channel_name}
                                        </div>
                                    )}
                                    {item.lot_number && (
                                        <div style={{ fontSize: '0.75rem', color: '#888' }}>
                                            LOT: {item.lot_number}
                                        </div>
                                    )}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                        fontSize: '1.25rem',
                                        fontWeight: '700',
                                        color: '#1e40af',
                                        marginBottom: '0.25rem'
                                    }}>
                                        {item.quantity}개
                                    </div>
                                    <div style={{
                                        ...getExpiryStyle(item.expiry_status),
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        display: 'inline-block'
                                    }}>
                                        {getExpiryIcon(item.expiry_status)} {getExpiryLabel(item.expiry_status, item.days_until_expiry)}
                                    </div>
                                </div>
                            </div>
                            {item.expiration_date && (
                                <div style={{
                                    fontSize: '0.75rem',
                                    color: '#666',
                                    marginTop: '0.5rem',
                                    borderTop: '1px solid #f0f0f0',
                                    paddingTop: '0.5rem'
                                }}>
                                    유통기한: {item.expiration_date}
                                </div>
                            )}

                            {/* 삭제 모드 시 삭제 버튼 표시 - MobileEquipmentStatusPage 스타일 */}
                            {deleteMode && (
                                <div style={{ marginTop: '0.8rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(item.lending_item_id, item.product_name)}
                                        style={{
                                            width: '100%',
                                            padding: '0.8rem',
                                            backgroundColor: '#dc2626',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🗑️ 삭제
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MobileBiologicInventoryPage;
