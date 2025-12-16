const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_me_in_prod';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

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
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                code VARCHAR(8) NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(code, user_id) -- Código único PERO por usuario
            );
            CREATE TABLE IF NOT EXISTS stats (
                id SERIAL PRIMARY KEY,
                total_money DECIMAL(10, 2) DEFAULT 0,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        console.log('Database initialized with Users support');
    } catch (err) {
        console.error('Error initializing DB:', err);
    }
};

initDB();

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- AUTH ENDPOINTS ---

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
            [username, hashedPassword]
        );
        const userId = result.rows[0].id;

        // Inicializar stats para el usuario
        await pool.query('INSERT INTO stats (user_id, total_money) VALUES ($1, 0)', [userId]);

        res.status(201).json({ message: 'Usuario creado' });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'El usuario ya existe' });
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

        if (await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
            res.json({ token, username: user.username });
        } else {
            res.status(403).json({ error: 'Contraseña incorrecta' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- DATA ENDPOINTS (Protected) ---

app.get('/api/data', authenticateToken, async (req, res) => {
    try {
        // SELECT only for this user
        const products = await pool.query('SELECT * FROM products WHERE user_id = $1', [req.user.id]);
        const stats = await pool.query('SELECT total_money FROM stats WHERE user_id = $1', [req.user.id]);

        res.json({
            products: products.rows,
            money: stats.rows[0]?.total_money || 0 // Should exist if registered correctly
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', authenticateToken, async (req, res) => {
    const { name, quantity, price, code } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO products (name, quantity, price, code, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, quantity, price, code, req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sell', authenticateToken, async (req, res) => {
    const { code, price } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Filter by user_id to ensure ownership
        const resUpdate = await client.query('UPDATE products SET quantity = quantity - 1 WHERE code = $1 AND user_id = $2 AND quantity > 0', [code, req.user.id]);

        if (resUpdate.rowCount === 0) throw new Error('Producto no encontrado o sin stock');

        await client.query('UPDATE stats SET total_money = total_money + $1 WHERE user_id = $2', [price, req.user.id]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/stock', authenticateToken, async (req, res) => {
    const { code, quantity } = req.body;
    try {
        const result = await pool.query('UPDATE products SET quantity = quantity + $1 WHERE code = $2 AND user_id = $3', [quantity, code, req.user.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:code', authenticateToken, async (req, res) => {
    const { code } = req.params;
    try {
        const result = await pool.query('DELETE FROM products WHERE code = $1 AND user_id = $2', [code, req.user.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
