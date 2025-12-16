document.addEventListener('DOMContentLoaded', () => {
    // Referencias DOM
    const btnAdd = document.getElementById('btn-add');
    const btnSell = document.getElementById('btn-sell');
    const btnStock = document.getElementById('btn-stock');
    const btnDelete = document.getElementById('btn-delete');
    // Save Buttons are inputs inside forms/handled by submit
    const btnClose = document.getElementById('btn-close');
    const btnCloseStock = document.getElementById('btn-close-stock');
    const btnRandom = document.getElementById('btn-random');

    // Modals
    const modalOverlay = document.getElementById('modal-overlay');
    const stockModalOverlay = document.getElementById('stock-modal-overlay');

    const productList = document.getElementById('product-list');
    const emptyState = document.getElementById('empty-state');

    // Stats
    const elTotalMoney = document.getElementById('total-money');
    const elTotalProducts = document.getElementById('total-products');
    // Use inputStock naming
    const inputStockQuantity = document.getElementById('stock-quantity-input');
    const labelStock = document.getElementById('stock-label');

    // Inputs
    const inputName = document.getElementById('product-name');
    const inputQuantity = document.getElementById('product-quantity');
    const inputPrice = document.getElementById('product-price');
    const inputCode = document.getElementById('product-code');

    // Estado
    let products = [];
    let totalMoney = 0;
    let selectedProductCode = null;

    // API Functions
    const API_URL = '/api'; // Relative URL for same-origin (deployment)

    async function loadData() {
        try {
            const res = await fetch(`${API_URL}/data`);
            if (!res.ok) throw new Error('Error loading data');
            const data = await res.json();
            products = data.products.map(p => ({
                ...p,
                price: parseFloat(p.price) // Ensure price is float
            }));
            totalMoney = parseFloat(data.money);
            renderProducts();
        } catch (err) {
            console.error(err);
            showStatus('Error de conexión con el servidor 🔴');
        }
    }

    // Funciones
    function openModal() {
        modalOverlay.classList.remove('hidden');
        inputName.value = '';
        inputQuantity.value = '';
        inputPrice.value = '';
        inputCode.value = '';
        inputName.focus();
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
    }

    function openStockModal() {
        if (!selectedProductCode) return;
        stockModalOverlay.classList.remove('hidden');
        inputStockQuantity.value = '';
        const product = products.find(p => p.code === selectedProductCode);
        if (product) {
            labelStock.textContent = `Añadir unidades a: ${product.name}`;
        }
        inputStockQuantity.focus();
    }

    function closeStockModal() {
        stockModalOverlay.classList.add('hidden');
    }

    function generateRandomCode() {
        const min = 10000000;
        const max = 99999999;
        const random = Math.floor(Math.random() * (max - min + 1)) + min;
        inputCode.value = random;
    }

    function validateCode(code) {
        return code.length === 8 && !isNaN(code);
    }

    function updateStats() {
        elTotalProducts.textContent = products.length;
        elTotalMoney.textContent = totalMoney.toFixed(2) + '€';
    }

    function showStatus(msg) {
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
            btnStock.classList.remove('hidden');
            btnStock.disabled = false;
            btnDelete.classList.remove('hidden');
            btnDelete.disabled = false;
        } else {
            btnSell.classList.add('hidden');
            btnSell.disabled = true;
            btnStock.classList.add('hidden');
            btnStock.disabled = true;
            btnDelete.classList.add('hidden');
            btnDelete.disabled = true;
        }
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
            const res = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, quantity, price, code })
            });

            if (res.ok) {
                await loadData(); // Reload everything to sync
                closeModal();
                showStatus('Producto guardado 🟢');
            } else {
                alert('Error al guardar. Puede que el código ya exista.');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión');
        }
    }

    async function saveStock(e) {
        e.preventDefault();
        if (!selectedProductCode) return;

        const addedQuantity = parseInt(inputStockQuantity.value);

        if (!isNaN(addedQuantity) && addedQuantity > 0) {
            try {
                const res = await fetch(`${API_URL}/stock`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                // Optimistic UI update (optional, but let's stick to sync for safety on invalid stock)
                const res = await fetch(`${API_URL}/sell`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                const res = await fetch(`${API_URL}/products/${selectedProductCode}`, {
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
    btnAdd.addEventListener('click', openModal);
    btnSell.addEventListener('click', sellProduct);
    btnStock.addEventListener('click', openStockModal);
    btnDelete.addEventListener('click', deleteProduct);

    btnClose.addEventListener('click', closeModal);
    btnCloseStock.addEventListener('click', closeStockModal);

    // Forms
    document.getElementById('product-form').addEventListener('submit', saveProduct);
    document.getElementById('stock-form').addEventListener('submit', saveStock);

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    stockModalOverlay.addEventListener('click', (e) => {
        if (e.target === stockModalOverlay) closeStockModal();
    });

    btnRandom.addEventListener('click', generateRandomCode);

    // Cargar datos al iniciar
    loadData();
});
