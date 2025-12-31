import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const CameraScanner = ({ onDetected }) => {
    const [error, setError] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const html5QrCodeRef = useRef(null);
    const onDetectedRef = useRef(onDetected);

    useEffect(() => {
        onDetectedRef.current = onDetected;
    }, [onDetected]);

    useEffect(() => {
        let isMounted = true;
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;

        const startScanner = async () => {
            try {
                console.log('🎥 Starting camera scanner...');

                const formatsToSupport = [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.EAN_8,
                ];

                console.log('📷 Requesting camera access...');

                // 간단한 설정으로 시작
                await html5QrCode.start(
                    { facingMode: "environment" }, // 후면 카메라
                    {
                        fps: 10,
                        qrbox: 250,
                        formatsToSupport: formatsToSupport
                    },
                    (decodedText, decodedResult) => {
                        if (isMounted && onDetectedRef.current) {
                            console.log(`✅ Scan result: ${decodedText}`);
                            onDetectedRef.current(decodedText);
                        }
                    },
                    (errorMessage) => {
                        // 스캔 중 에러는 무시 (정상)
                    }
                );

                if (isMounted) {
                    console.log('✅ Camera started successfully!');
                    setIsScanning(true);
                    setError('');
                }
            } catch (err) {
                if (isMounted) {
                    console.error('❌ Camera error:', err);
                    console.error('Error name:', err.name);
                    console.error('Error message:', err.message);

                    let errorMsg = '⚠️ 카메라 시작 실패\n\n';

                    if (err.name === 'NotAllowedError') {
                        errorMsg += '카메라 권한이 거부되었습니다.\n브라우저 설정에서 권한을 허용해주세요.';
                    } else if (err.name === 'NotFoundError') {
                        errorMsg += '카메라를 찾을 수 없습니다.\n다른 앱이 사용 중인지 확인해주세요.';
                    } else if (err.name === 'NotReadableError') {
                        errorMsg += '카메라가 이미 사용 중입니다.\n다른 앱을 종료하고 다시 시도해주세요.';
                    } else {
                        errorMsg += `에러: ${err.message}`;
                    }

                    setError(errorMsg);
                }
            }
        };

        // DOM이 준비된 후 시작
        const timer = setTimeout(() => {
            if (isMounted) {
                startScanner();
            }
        }, 300);

        return () => {
            isMounted = false;
            clearTimeout(timer);

            if (html5QrCodeRef.current) {
                try {
                    const state = html5QrCodeRef.current.getState();
                    console.log('Scanner state:', state);

                    if (state === 2) { // SCANNING
                        html5QrCodeRef.current.stop().then(() => {
                            console.log('Scanner stopped');
                            html5QrCodeRef.current.clear();
                        }).catch(err => {
                            console.log('Stop error (ignored):', err);
                        });
                    }
                } catch (e) {
                    console.log('Cleanup error (ignored):', e);
                }
            }
        };
    }, []);

    return (
        <div className="camera-scanner-container">
            {error && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '1.5rem',
                    backgroundColor: '#fff3cd',
                    borderRadius: '8px',
                    color: '#856404',
                    border: '2px solid #ffc107',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    whiteSpace: 'pre-line'
                }}>
                    {error}
                </div>
            )}

            {!isScanning && !error && (
                <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    marginBottom: '1rem'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📷</div>
                    <p style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>카메라 시작 중...</p>
                    <p style={{ fontSize: '0.9rem', color: '#666' }}>잠시만 기다려주세요</p>
                </div>
            )}

            <div id="reader" style={{ width: '100%' }}></div>

            {isScanning && (
                <div style={{
                    textAlign: 'center',
                    padding: '1rem',
                    color: '#666',
                    backgroundColor: '#e8f5e9',
                    borderRadius: '8px',
                    marginTop: '1rem'
                }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#2e7d32' }}>
                        ✅ 카메라 활성화됨
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                        QR 코드를 카메라에 비춰주세요
                    </p>
                </div>
            )}
        </div>
    );
};

export default CameraScanner;
