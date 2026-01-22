const Database = require('better-sqlite3');
const db = new Database('./inventory.db');

// Find ldisq items
const items = db.prepare("SELECT id, product_name FROM lending_items WHERE product_name LIKE '%ldisq%'").all();
console.log('Found items:', items);

if (items.length > 0) {
    const result = db.prepare("DELETE FROM lending_items WHERE product_name LIKE '%ldisq%'").run();
    console.log('Deleted rows:', result.changes);
} else {
    // Check products table
    const products = db.prepare("SELECT id, name FROM products WHERE name LIKE '%ldisq%'").all();
    console.log('Found products:', products);

    if (products.length > 0) {
        const result = db.prepare("DELETE FROM products WHERE name LIKE '%ldisq%'").run();
        console.log('Deleted product rows:', result.changes);
    }
}

db.close();
console.log('Done!');
