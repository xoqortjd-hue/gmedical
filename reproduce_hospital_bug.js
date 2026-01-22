// Configure base URL (assuming server is running on localhost:5000)
const API_URL = 'http://localhost:5000/api';

async function runTest() {
    try {
        console.log('1. Fetching initial hospital list...');
        const initialRes = await fetch(`${API_URL}/hospitals`);
        if (!initialRes.ok) throw new Error(`Fetch failed: ${initialRes.status}`);
        const initialData = await initialRes.json();
        const initialCount = initialData.length;
        console.log(`   Initial count: ${initialCount}`);
        console.log('   Current Names:', initialData.map(h => h.name).join(', '));

        console.log('\n2. Adding new hospital...');
        const newHospitalName = `TestHospital_${Date.now()}`;
        const createRes = await fetch(`${API_URL}/hospitals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: newHospitalName,
                code: `TEST${Date.now()}`,
                address: 'Test Address',
                contact_person: 'Tester',
                phone: '010-0000-0000'
            })
        });

        if (createRes.ok) {
            const createData = await createRes.json();
            console.log(`   Successfully added: ${newHospitalName} (ID: ${createData.hospital_id})`);
        } else {
            const errText = await createRes.text();
            console.error('   Failed to add hospital:', errText);
            return;
        }

        console.log('\n3. Fetching updated hospital list...');
        const updatedRes = await fetch(`${API_URL}/hospitals`);
        if (!updatedRes.ok) throw new Error(`Fetch failed: ${updatedRes.status}`);
        const updatedData = await updatedRes.json();
        const updatedCount = updatedData.length;
        console.log(`   Updated count: ${updatedCount}`);
        console.log('   Current Names:', updatedData.map(h => h.name).join(', '));

        console.log('\n4. Verification...');
        if (updatedCount === initialCount + 1) {
            console.log('✅ SUCCESS: Hospital count increased by 1.');
        } else {
            console.log('❌ FAILURE: Hospital count did not increase correctly.');
            if (updatedCount < initialCount) {
                console.log('   CRITICAL: Count DECREASED! Data loss detected.');
            } else if (updatedCount === initialCount) {
                console.log('   WARNING: Count stayed the same. Maybe it was treated as duplicate?');
            }
        }

    } catch (error) {
        console.error('❌ Error during test:', error.message);
    }
}

runTest();
