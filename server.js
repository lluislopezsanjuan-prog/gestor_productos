const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Servir archivos estáticos (frontend)

// DB Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Init DB
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                code VARCHAR(8) UNIQUE NOT NULL
            );
            CREATE TABLE IF NOT EXISTS stats (
                id SERIAL PRIMARY KEY,
                total_money DECIMAL(10, 2) DEFAULT 0
            );
            INSERT INTO stats (id, total_money) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
        `);
        console.log('Database initialized');
    } catch (err) {
        console.error('Error initializing DB:', err);
    }
};

initDB();

// Endpoints

// GET Products & Money
app.get('/api/data', async (req, res) => {
    try {
        const products = await pool.query('SELECT * FROM products');
        const stats = await pool.query('SELECT total_money FROM stats WHERE id = 1');
        res.json({
            products: products.rows,
            money: stats.rows[0]?.total_money || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE Product
app.post('/api/products', async (req, res) => {
    const { name, quantity, price, code } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO products (name, quantity, price, code) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, quantity, price, code]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE Stock (Add or Remove/Sell)
// Eliminar el endpoint PUT específico de "sell" y "add" y hacer uno más genérico o mantener lógica en frontend y actualizar aquí
// Para simplificar, haremos un endpoint que actualiza cantidad y otro que actualiza dinero global, o uno transaccional.
// Vamos a hacer una transacción para la venta.

// VENTA
app.post('/api/sell', async (req, res) => {
    const { code, price } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Restar stock
        await client.query('UPDATE products SET quantity = quantity - 1 WHERE code = $1', [code]);
        // Sumar dinero
        await client.query('UPDATE stats SET total_money = total_money + $1 WHERE id = 1', [price]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// AÑADIR STOCK
app.post('/api/stock', async (req, res) => {
    const { code, quantity } = req.body;
    try {
        await pool.query('UPDATE products SET quantity = quantity + $1 WHERE code = $2', [quantity, code]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Product
app.delete('/api/products/:code', async (req, res) => {
    const { code } = req.params;
    try {
        await pool.query('DELETE FROM products WHERE code = $1', [code]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
