import { pool } from './config/database.js';

async function viewAllUsers() {
    try {
        console.log('📊 Fetching all users from database...\n');
        
        const [rows] = await pool.execute('SELECT id, email, first_name, last_name, phone, created_at, updated_at FROM users ORDER BY created_at DESC');
        
        if (rows.length === 0) {
            console.log('❌ No users found in database');
            return;
        }
        
        console.log(`✅ Found ${rows.length} users:\n`);
        console.log('ID  | Email                    | Name                | Phone        | Created');
        console.log('----+-------------------------+--------------------+--------------+------------------------');
        
        rows.forEach(user => {
            const id = String(user.id).padEnd(3);
            const email = String(user.email).padEnd(24);
            const name = `${user.first_name} ${user.last_name}`.padEnd(19);
            const phone = String(user.phone || 'N/A').padEnd(13);
            const created = user.created_at.toISOString().slice(0, 19).replace('T', ' ');
            
            console.log(`${id} | ${email} | ${name} | ${phone} | ${created}`);
        });
        
        console.log(`\n📊 Total users: ${rows.length}`);
        
    } catch (error) {
        console.error('❌ Error fetching users:', error.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

viewAllUsers();
