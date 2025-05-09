let cart = [];
const stripe = Stripe('pk_test_...'); // Ersetzen Sie mit Ihrem Stripe Public Key
let cardElement;

window.onload = function() {
  // Stripe Card Element initialisieren
  const elements = stripe.elements();
  cardElement = elements.create('card');
  cardElement.mount('#card-element');
  cardElement.on('change', function(event) {
    const displayError = document.getElementById('card-errors');
    displayError.textContent = event.error ? event.error.message : '';
  });

  updateCartDisplay();
};

function showModal(id) {
  document.getElementById(id).style.display = 'flex';
  if (id === 'checkoutModal') {
    updateCartDisplay();
  }
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function showLegalModal(type) {
  showModal(`${type}Modal`);
}

function addToCart(name, price, gelatoId) {
  cart.push({ name, price, gelatoId });
  updateCartCount();
  alert(`${name} wurde zum Warenkorb hinzugefügt`);
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartCount();
  updateCartDisplay();
}

function updateCartCount() {
  document.getElementById('cartButton').textContent = `Warenkorb (${cart.length})`;
}

function updateCartDisplay() {
  const cartItems = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');
  cartItems.innerHTML = '';
  if (cart.length === 0) {
    cartItems.innerHTML = '<p>Ihr Warenkorb ist leer.</p>';
    cartTotal.textContent = '';
    return;
  }
  cart.forEach((item, index) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'cart-item';
    itemElement.innerHTML = `
      <span>${item.name} - $${item.price.toFixed(2)}</span>
      <button onclick="removeFromCart(${index})">Entfernen</button>
    `;
    cartItems.appendChild(itemElement);
  });
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  cartTotal.textContent = `Gesamt: $${total.toFixed(2)}`;
}

function filterProducts(category) {
  const cards = document.querySelectorAll('.product-card');
  cards.forEach(card => {
    const cardCategory = card.getAttribute('data-category');
    card.style.display = (category === 'All' || cardCategory === category) ? 'block' : 'none';
  });
}

async function checkout() {
  if (cart.length === 0) {
    alert('Ihr Warenkorb ist leer.');
    return;
  }

  const email = document.getElementById('checkoutEmail').value;
  const name = document.getElementById('checkoutName').value;
  const street = document.getElementById('checkoutStreet').value;
  const city = document.getElementById('checkoutCity').value;
  const postal = document.getElementById('checkoutPostal').value;
  const country = document.getElementById('checkoutCountry').value;

  if (!email || !name || !street || !city || !postal || !country) {
    alert('Bitte füllen Sie alle Felder aus.');
    return;
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  try {
    // Zahlungs-Intent erstellen
    const response = await fetch('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: total, currency: 'usd' }),
    });
    const { clientSecret } = await response.json();

    // Zahlung bestätigen
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: { name, email },
      },
    });

    if (result.error) {
      document.getElementById('card-errors').textContent = result.error.message;
      return;
    }

    if (result.paymentIntent.status === 'succeeded') {
      // Bestellung an Backend senden
      const order = {
        items: cart,
        customer: { name, email },
        shippingAddress: { street, city, postal, country },
        total,
      };
      const orderResponse = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      const orderData = await orderResponse.json();

      alert(`Bestellung erfolgreich! Bestell-ID: ${orderData.orderId}`);
      window.location.href = orderData.pdfPath; // PDF herunterladen
      cart = [];
      updateCartCount();
      updateCartDisplay();
      closeModal('checkoutModal');
    }
  } catch (error) {
    console.error('Checkout-Fehler:', error);
    alert('Zahlung fehlgeschlagen. Bitte versuchen Sie es erneut.');
  }
}
