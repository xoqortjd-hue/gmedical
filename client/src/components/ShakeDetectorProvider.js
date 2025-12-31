import React, { useState, useEffect } from 'react';
import useShakeDetector from '../hooks/useShakeDetector';

/**
 * iOS 13+ 에서 DeviceMotion 권한 요청을 위한 컴포넌트
 * 사용자가 화면을 터치하면 권한 요청 팝업 표시
 */
const ShakeDetectorProvider = ({ children }) => {
    const [needsPermission, setNeedsPermission] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);

    // Shake detector hook 사용
    const { requestPermission } = useShakeDetector({
        threshold: 25,           // 민감도 조절 (높을수록 더 세게 흔들어야 함)
        timeout: 1500,           // 연속 감지 방지 (1.5초)
        targetPath: '/mobile/home',
        enabled: permissionGranted || !needsPermission
    });

    useEffect(() => {
        // iOS 13+ 체크
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            setNeedsPermission(true);
        } else {
            // Android 또는 구형 iOS - 권한 요청 불필요
            setPermissionGranted(true);
        }
    }, []);

    const handleRequestPermission = async () => {
        try {
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === 'granted') {
                    setPermissionGranted(true);
                    setNeedsPermission(false);
                }
            }
        } catch (error) {
            console.error('Permission request failed:', error);
        }
    };

    // iOS에서 권한이 필요하고 아직 부여받지 않은 경우 안내 배너 표시
    if (needsPermission && !permissionGranted) {
        return (
            <>
                {children}
                <div
                    onClick={handleRequestPermission}
                    style={{
                        position: 'fixed',
                        bottom: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '12px 20px',
                        borderRadius: '25px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                        cursor: 'pointer',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        animation: 'pulse 2s infinite'
                    }}
                >
                    <span style={{ fontSize: '18px' }}>📳</span>
                    <span>터치하여 흔들기 기능 활성화</span>
                </div>
                <style>
                    {`
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
              50% { opacity: 0.9; transform: translateX(-50%) scale(1.02); }
            }
          `}
                </style>
            </>
        );
    }

    return <>{children}</>;
};

export default ShakeDetectorProvider;
