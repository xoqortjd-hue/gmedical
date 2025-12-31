import React, { useState, useEffect } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import '../styles/main.css';

function ChannelQRPage() {
    const [channels, setChannels] = useState([]);
    const [qrCodes, setQrCodes] = useState({});
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchChannels();
    }, []);

    const fetchChannels = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/channels');
            setChannels(res.data);

            // 각 채널별 QR 코드 생성
            const qrPromises = res.data.map(async (channel) => {
                const qrData = JSON.stringify({
                    type: 'CHANNEL',
                    id: channel.id,
                    code: channel.code,
                    name: channel.name
                });
                const url = await QRCode.toDataURL(qrData, {
                    width: 200,
                    margin: 2,
                    errorCorrectionLevel: 'M'
                });
                return { id: channel.id, url };
            });

            const qrResults = await Promise.all(qrPromises);
            const qrMap = {};
            qrResults.forEach(item => {
                qrMap[item.id] = item.url;
            });
            setQrCodes(qrMap);
            setLoading(false);
        } catch (error) {
            console.error('채널 조회 실패:', error);
            setMessage('❌ 채널 목록을 불러오지 못했습니다');
            setLoading(false);
        }
    };

    const handlePrint = (channel) => {
        const qrUrl = qrCodes[channel.id];
        if (!qrUrl) return;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>창구 QR - ${channel.name}</title>
                <style>
                    body { 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        margin: 0; 
                        font-family: 'Malgun Gothic', sans-serif;
                    }
                    .qr-container { 
                        text-align: center; 
                        padding: 20px;
                        border: 2px dashed #333;
                        border-radius: 10px;
                    }
                    .qr-container img { 
                        width: 4cm; 
                        height: 4cm; 
                    }
                    .qr-container h2 { 
                        font-size: 18pt; 
                        margin: 15px 0 5px 0; 
                        font-weight: bold;
                    }
                    .qr-container p { 
                        font-size: 10pt; 
                        margin: 0;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="qr-container">
                    <img src="${qrUrl}" />
                    <h2>${channel.name}</h2>
                    <p>창구 코드: ${channel.code}</p>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const handlePrintAll = () => {
        const printWindow = window.open('', '_blank');

        let qrHtml = '';
        channels.forEach(channel => {
            const qrUrl = qrCodes[channel.id];
            if (qrUrl) {
                qrHtml += `
                    <div class="qr-item">
                        <img src="${qrUrl}" />
                        <h3>${channel.name}</h3>
                        <p>${channel.code}</p>
                    </div>
                `;
            }
        });

        printWindow.document.write(`
            <html>
            <head>
                <title>전체 창구 QR 코드</title>
                <style>
                    body { 
                        font-family: 'Malgun Gothic', sans-serif;
                        margin: 20px;
                    }
                    .qr-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                    }
                    .qr-item { 
                        text-align: center; 
                        padding: 15px;
                        border: 2px dashed #333;
                        border-radius: 10px;
                        page-break-inside: avoid;
                    }
                    .qr-item img { 
                        width: 4cm; 
                        height: 4cm; 
                    }
                    .qr-item h3 { 
                        font-size: 14pt; 
                        margin: 10px 0 5px 0; 
                    }
                    .qr-item p { 
                        font-size: 9pt; 
                        margin: 0;
                        color: #666;
                    }
                    @media print {
                        .qr-grid {
                            grid-template-columns: repeat(2, 1fr);
                        }
                    }
                </style>
            </head>
            <body>
                <h1 style="text-align: center; margin-bottom: 20px;">창구별 QR 코드</h1>
                <div class="qr-grid">
                    ${qrHtml}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>🏷️ 창구 QR 코드 생성</h1>
                <p>각 창구(채널) 선반에 부착할 QR 코드를 생성하고 출력합니다</p>
            </div>

            {message && (
                <div style={{
                    padding: '1rem', borderRadius: '8px', marginBottom: '1rem',
                    backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
                    color: message.includes('✅') ? '#155724' : '#721c24'
                }}>
                    {message}
                </div>
            )}

            <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="card-title">📋 창구 목록</h2>
                    <button onClick={handlePrintAll} className="btn btn-primary">
                        🖨️ 전체 출력
                    </button>
                </div>
                <div style={{ padding: '1.5rem' }}>
                    {loading ? (
                        <div className="loading">로딩 중...</div>
                    ) : channels.length === 0 ? (
                        <div className="empty-state"><p>등록된 창구가 없습니다</p></div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                            gap: '1.5rem'
                        }}>
                            {channels.map(channel => (
                                <div key={channel.id} style={{
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                    textAlign: 'center',
                                    backgroundColor: '#fafafa'
                                }}>
                                    {qrCodes[channel.id] ? (
                                        <img
                                            src={qrCodes[channel.id]}
                                            alt={`${channel.name} QR`}
                                            style={{ width: '150px', height: '150px' }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '150px',
                                            height: '150px',
                                            backgroundColor: '#eee',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto'
                                        }}>
                                            로딩...
                                        </div>
                                    )}
                                    <h3 style={{ margin: '1rem 0 0.5rem 0' }}>{channel.name}</h3>
                                    <p style={{ color: '#666', margin: '0 0 1rem 0' }}>코드: {channel.code}</p>
                                    <button
                                        onClick={() => handlePrint(channel)}
                                        className="btn btn-secondary btn-sm"
                                    >
                                        🖨️ 인쇄
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="info-box" style={{ marginTop: '2rem' }}>
                <h3>💡 사용 방법</h3>
                <ul>
                    <li><strong>QR 코드 출력</strong>: 각 창구의 "인쇄" 버튼을 클릭하여 QR 코드를 출력합니다</li>
                    <li><strong>선반 부착</strong>: 출력된 QR 코드를 해당 창구의 선반에 부착합니다</li>
                    <li><strong>입고 시 사용</strong>: 바이오로직 입고 시 선반 QR을 먼저 스캔하면 창구가 자동 선택됩니다</li>
                </ul>
            </div>
        </div>
    );
}

export default ChannelQRPage;
