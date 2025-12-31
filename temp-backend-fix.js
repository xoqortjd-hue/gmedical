// 백엔드 수정: 기존 사진 삭제 후 새 사진 추가
db.serialize(() => {
    // 1. 기존 사진 모두 삭제 (새 사진으로 완전 교체)
    db.run(`DELETE FROM lending_item_photos WHERE lending_item_id = ?`, [id], function (deleteErr) {
        if (deleteErr) console.error('기존 사진 삭제 실패:', deleteErr.message);

        // 2. 새 사진 추가
        db.run(`
            INSERT INTO lending_item_photos (lending_item_id, photo_url, uploaded_by)
            VALUES (?, ?, ?)
        `, [id, photo_url, uploaded_by || '영업담당자'], function (err) {
            if (err) {
                console.error('사진 저장 실패:', err.message);
                return res.status(500).json({ error: err.message });
            }

            const newPhotoId = this.lastID;

            // 3. lending_items 테이블도 최신 사진으로 업데이트 (호환성)
            db.run(`
                UPDATE lending_items 
                SET photo_url = ?, 
                    photo_uploaded_by = ?, 
                    photo_uploaded_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [photo_url, uploaded_by || '영업담당자', id]);

            console.log(`✅ 사진 업로드 완료: 아이템 ID ${id}, 업로더: ${uploaded_by || '영업담당자'}`);
            res.json({
                success: true,
                message: '사진이 업로드되었습니다',
                item_id: id,
                photo_id: newPhotoId
            });
        });
    });
});
