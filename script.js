document.addEventListener('DOMContentLoaded', () => {
    // UI Elements - Auth
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const registerBox = document.getElementById('register-box');
    const linkToRegister = document.getElementById('link-to-register');
    const linkToLogin = document.getElementById('link-to-login');
    const displayUsername = document.getElementById('display-username');
    const displayRole = document.getElementById('display-role'); // Badge may not exist in DOM yet if HTML update failed, handle safely
    const btnLogout = document.getElementById('btn-logout');

    const authUsernameInput = document.getElementById('auth-username');
    const authPasswordInput = document.getElementById('auth-password');
    const regUsernameInput = document.getElementById('reg-username');
    const regPasswordInput = document.getElementById('reg-password');

    // UI Elements - Team
    const teamPanel = document.getElementById('team-panel');
    const btnTeamAdd = document.getElementById('btn-team-add');
    const inputTeamUsername = document.getElementById('team-username');
    const selectTeamRole = document.getElementById('team-role');

    // UI Elements - App
    const productList = document.getElementById('product-list');
    const emptyState = document.getElementById('empty-state');
    const elTotalMoney = document.getElementById('total-money');
    const elTotalProducts = document.getElementById('total-products');
    const elStatusMessage = document.getElementById('status-message');

    // UI Elements - Modals
    const modalOverlay = document.getElementById('modal-overlay');
    const stockModalOverlay = document.getElementById('stock-modal-overlay');

    // UI Elements - Buttons & Inputs inside app
    const btnAdd = document.getElementById('btn-add');
    const btnSell = document.getElementById('btn-sell');
    const btnStock = document.getElementById('btn-stock');
    const btnDelete = document.getElementById('btn-delete');

    const btnClose = document.getElementById('btn-close');
    const btnCloseStock = document.getElementById('btn-close-stock');
    const btnRandom = document.getElementById('btn-random');

    const productForm = document.getElementById('product-form');
    const stockForm = document.getElementById('stock-form');

    const inputName = document.getElementById('product-name');
    const inputQuantity = document.getElementById('product-quantity');
    const inputPrice = document.getElementById('product-price');
    const inputCode = document.getElementById('product-code');
    const inputStockQuantity = document.getElementById('stock-quantity-input');
    const labelStock = document.getElementById('stock-label');

    // Estado
    let products = [];
    let totalMoney = 0;
    let selectedProductCode = null;
    let authToken = localStorage.getItem('auth_token');
    let currentUser = localStorage.getItem('auth_username');
    let currentRole = localStorage.getItem('auth_role');

    // API Functions
    const API_URL = '/api';

    // --- AUTH LOGIC ---

    function checkAuth() {
        if (authToken) {
            if (authContainer) authContainer.classList.add('hidden');
            if (appContainer) appContainer.classList.remove('hidden');
            if (displayUsername) displayUsername.textContent = currentUser || 'Usuario';
            if (displayRole) displayRole.textContent = currentRole === 'admin' ? 'Administrador' : 'Vendedor';

            // Role Based UI
            if (currentRole === 'admin') {
                if (teamPanel) teamPanel.classList.remove('hidden');
                if (btnAdd) btnAdd.classList.remove('hidden');
            } else {
                if (teamPanel) teamPanel.classList.add('hidden');
                if (btnAdd) btnAdd.classList.add('hidden'); // Vendedor no puede crear
            }

            loadData();
        } else {
            if (authContainer) authContainer.classList.remove('hidden');
            if (appContainer) appContainer.classList.add('hidden');
        }
    }

    async function handleLogin(e) {
        e.preventDefault();
        const username = authUsernameInput.value;
        const password = authPasswordInput.value;

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok) {
                authToken = data.token;
                currentUser = data.username;
                currentRole = data.role || 'admin'; // default to admin if not provided

                localStorage.setItem('auth_token', authToken);
                localStorage.setItem('auth_username', currentUser);
                localStorage.setItem('auth_role', currentRole);

                checkAuth();
            } else {
                alert(data.error || 'Error al iniciar sesión. (Si estás abriendo el archivo localmente, necesitas desplegarlo para que funcione)');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión. Asegúrate de que el servidor está corriendo (o despliégalo en Railway).');
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        const username = regUsernameInput.value;
        const password = regPasswordInput.value;

        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (res.ok) {
                alert('Usuario creado con éxito. Ahora inicia sesión.');
                toggleAuthMode();
            } else {
                const data = await res.json();
                alert(data.error || 'Error al registrarse');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión');
        }
    }

    function handleLogout() {
        authToken = null;
        currentUser = null;
        currentRole = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_username');
        localStorage.removeItem('auth_role');
        checkAuth();
    }

    async function handleAddTeamMember(e) {
        e.preventDefault();
        const targetUsername = inputTeamUsername.value.trim();
        const role = selectTeamRole.value;

        if (!targetUsername) return;

        if (!confirm(`¿Estás seguro de añadir a ${targetUsername} a tu equipo? Sus datos antiguos se perderán.`)) return;

        try {
            const res = await apiRequest('/team/add', {
                method: 'POST',
                body: JSON.stringify({ targetUsername, role })
            });
            const data = await res.json();

            if (res.ok) {
                alert('¡Usuario añadido con éxito! Ahora tenéis la tienda compartida.');
                inputTeamUsername.value = '';
            } else {
                alert(data.error || 'Error al añadir miembro');
            }
        } catch (err) {
            console.error(err);
            alert('Error: No se pudo añadir al miembro');
        }
    }

    function toggleAuthMode() {
        const loginBox = document.querySelector('#auth-container .auth-box:not(#register-box)');

        if (loginBox.classList.contains('hidden')) {
            loginBox.classList.remove('hidden');
            registerBox.classList.add('hidden');
        } else {
            loginBox.classList.add('hidden');
            registerBox.classList.remove('hidden');
        }
    }

    // --- APP LOGIC (Protected) ---

    async function apiRequest(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            ...options.headers
        };
        const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        if (res.status === 401 || res.status === 403) {
            handleLogout(); // Session expired
            throw new Error('Sesión expirada');
        }
        return res;
    }

    async function loadData() {
        if (!authToken) return;
        try {
            const res = await apiRequest('/data');
            if (!res.ok) throw new Error('Error loading data');
            const data = await res.json();
            products = data.products.map(p => ({
                ...p,
                price: parseFloat(p.price)
            }));
            totalMoney = parseFloat(data.money);
            renderProducts();
        } catch (err) {
            console.error(err);
            if (err.message !== 'Sesión expirada') {
                showStatus('Error de conexión con el servidor 🔴');
            }
        }
    }

    function openModal() {
        if (modalOverlay) modalOverlay.classList.remove('hidden');
        inputName.value = '';
        inputQuantity.value = '';
        inputPrice.value = '';
        inputCode.value = '';
        inputName.focus();
    }

    function closeModal() {
        if (modalOverlay) modalOverlay.classList.add('hidden');
    }

    function openStockModal() {
        if (!selectedProductCode) return;
        if (stockModalOverlay) stockModalOverlay.classList.remove('hidden');
        inputStockQuantity.value = '';
        const product = products.find(p => p.code === selectedProductCode);
        if (product && labelStock) {
            labelStock.textContent = `Añadir unidades a: ${product.name}`;
        }
        inputStockQuantity.focus();
    }

    function closeStockModal() {
        if (stockModalOverlay) stockModalOverlay.classList.add('hidden');
    }

    function generateRandomCode() {
        const min = 10000000;
        const max = 99999999;
        const random = Math.floor(Math.random() * (max - min + 1)) + min;
        inputCode.value = random;
    }

    function showStatus(msg) {
        if (!elStatusMessage) return;
        elStatusMessage.textContent = msg;
        elStatusMessage.classList.remove('hidden');
        setTimeout(() => {
            elStatusMessage.classList.add('hidden');
        }, 2000);
    }

    function toggleSelection(code) {
        if (selectedProductCode === code) {
            selectedProductCode = null;
        } else {
            selectedProductCode = code;
        }
        renderProducts();
        updateSellButton();
    }

    function updateSellButton() {
        if (selectedProductCode) {
            btnSell.classList.remove('hidden');
            btnSell.disabled = false;

            // Only admin can edit stock or delete
            if (currentRole === 'admin') {
                btnStock.classList.remove('hidden');
                btnStock.disabled = false;
                btnDelete.classList.remove('hidden');
                btnDelete.disabled = false;
            } else {
                btnStock.classList.add('hidden');
                btnDelete.classList.add('hidden');
            }
        } else {
            btnSell.classList.add('hidden');
            btnSell.disabled = true;
            btnStock.classList.add('hidden');
            btnStock.disabled = true;
            btnDelete.classList.add('hidden');
            btnDelete.disabled = true;
        }
    }

    function updateStats() {
        elTotalProducts.textContent = products.length;
        elTotalMoney.textContent = totalMoney.toFixed(2) + '€';
    }

    function renderProducts() {
        productList.innerHTML = '';
        updateStats();

        if (products.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        products.forEach(p => {
            const card = document.createElement('div');
            card.className = `product-card ${selectedProductCode === p.code ? 'selected' : ''}`;
            card.onclick = () => toggleSelection(p.code);

            card.innerHTML = `
                <div class="product-info">
                    <h3>${p.name}</h3>
                    <div class="product-details">
                        Cant: <strong>${p.quantity}</strong> | Precio: <strong>${parseFloat(p.price).toFixed(2)}€</strong> <br>
                        <small>Ref: ${p.code}</small>
                    </div>
                </div>
            `;
            productList.appendChild(card);
        });
    }

    async function saveProduct(e) {
        e.preventDefault();

        const name = inputName.value.trim();
        const quantity = parseInt(inputQuantity.value);
        const price = parseFloat(inputPrice.value);
        const code = inputCode.value;

        if (!name || isNaN(quantity) || isNaN(price) || !code) {
            alert('Por favor completa todos los campos correctamente');
            return;
        }

        if (code.length !== 8) {
            alert('El código debe tener exactamente 8 dígitos');
            return;
        }

        try {
            const res = await apiRequest('/products', {
                method: 'POST',
                body: JSON.stringify({ name, quantity, price, code })
            });

            if (res.ok) {
                await loadData();
                closeModal();
                showStatus('Producto guardado 🟢');
            } else {
                const data = await res.json();
                alert(data.error || 'Error al guardar');
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function saveStock(e) {
        e.preventDefault();
        if (!selectedProductCode) return;

        const addedQuantity = parseInt(inputStockQuantity.value);

        if (!isNaN(addedQuantity) && addedQuantity > 0) {
            try {
                const res = await apiRequest('/stock', {
                    method: 'POST',
                    body: JSON.stringify({ code: selectedProductCode, quantity: addedQuantity })
                });

                if (res.ok) {
                    showStatus(`¡Stock actualizado! +${addedQuantity} unidades`);
                    await loadData();
                    closeStockModal();
                }
            } catch (err) {
                console.error(err);
            }
        } else {
            alert('Por favor introduce una cantidad válida.');
        }
    }

    async function sellProduct() {
        if (!selectedProductCode) return;

        const productIndex = products.findIndex(p => p.code === selectedProductCode);
        if (productIndex === -1) return;

        const product = products[productIndex];

        if (product.quantity > 0) {
            try {
                const res = await apiRequest('/sell', {
                    method: 'POST',
                    body: JSON.stringify({ code: selectedProductCode, price: product.price })
                });

                if (res.ok) {
                    showStatus(`¡${product.name} vendido! +${product.price.toFixed(2)}€`);
                    await loadData();
                } else {
                    alert('Error en la venta');
                }
            } catch (err) {
                console.error(err);
            }
        } else {
            alert('¡No hay stock de este producto!');
        }
    }

    async function deleteProduct() {
        if (!selectedProductCode) return;
        const product = products.find(p => p.code === selectedProductCode);
        if (!product) return;

        if (confirm(`¿Estás seguro de eliminar el producto "${product.name}"?`)) {
            try {
                const res = await apiRequest(`/products/${selectedProductCode}`, {
                    method: 'DELETE'
                });

                if (res.ok) {
                    selectedProductCode = null;
                    showStatus('Producto eliminado');
                    await loadData();
                    updateSellButton();
                } else {
                    alert('Error al eliminar');
                }
            } catch (err) {
                console.error(err);
            }
        }
    }

    // Event Listeners
    if (btnAdd) btnAdd.addEventListener('click', openModal);
    if (btnSell) btnSell.addEventListener('click', sellProduct);
    if (btnStock) btnStock.addEventListener('click', openStockModal);
    if (btnDelete) btnDelete.addEventListener('click', deleteProduct);

    // Team
    if (btnTeamAdd) btnTeamAdd.addEventListener('click', handleAddTeamMember);

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCloseStock) btnCloseStock.addEventListener('click', closeStockModal);

    if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    if (stockModalOverlay) stockModalOverlay.addEventListener('click', (e) => {
        if (e.target === stockModalOverlay) closeStockModal();
    });

    if (productForm) productForm.addEventListener('submit', saveProduct);
    if (stockForm) stockForm.addEventListener('submit', saveStock);

    if (btnRandom) btnRandom.addEventListener('click', generateRandomCode);

    // Auth Event Listeners
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    if (linkToRegister) linkToRegister.addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode(); });
    if (linkToLogin) linkToLogin.addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode(); });
    if (btnLogout) btnLogout.addEventListener('click', handleLogout);

    // Initial Auth Check
    checkAuth();
});
