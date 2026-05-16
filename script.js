import { db, storage, STORE_UID as DEFAULT_STORE_UID } from './firebase-config.js';
import { collection, doc, getDoc, setDoc, addDoc, onSnapshot, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Global Variables
let currentStoreUid = DEFAULT_STORE_UID;
let storeName = "Premium Store";
let storeWa = "";
let currentSelectedProduct = null;
let currentInvoiceNumber = "";
let currentTransactionId = null;

// Format Currency
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
}

// Format Phone Number
function formatPhone(phone) {
  let f = phone.replace(/\D/g, '');
  if (f.startsWith('0')) f = '62' + f.substring(1);
  return f;
}

// Generate Invoice Number
function generateInvoice() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `INV-${yy}${mm}${dd}-${rand}`;
}

// Init Function
async function init() {
  document.getElementById('currentYear').textContent = new Date().getFullYear();
  
  // Parse URL to get store ID
  const urlParams = new URLSearchParams(window.location.search);
  const storeParam = urlParams.get('store') || urlParams.get('u');
  if (storeParam) {
    currentStoreUid = storeParam;
  }
  
  if (currentStoreUid === "YOUR_UID_HERE") {
    alert("Silakan atur STORE_UID di file firebase-config.js terlebih dahulu.");
    return;
  }

  // 1. Fetch Store Settings
  onSnapshot(doc(db, 'users', currentStoreUid), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      storeName = data.storeName || data.name || "Premium Store";
      storeWa = data.whatsappStore || data.storeWhatsapp || "";
      
      const logoUrl = data.logoUrl || data.storeLogo || 'landing-page/assets/WhatsApp Image 2026-05-02 at 23.45.16.jpeg'; // fallback
      
      document.getElementById('storeName').textContent = storeName;
      document.getElementById('footerStoreName').textContent = storeName;
      document.title = storeName + " - Layanan Premium";
      
      const storeLogoEl = document.getElementById('storeLogo');
      if (storeLogoEl) storeLogoEl.src = logoUrl;
    }
  });

  // 2. Fetch Products (Pakets)
  onSnapshot(doc(db, 'pakets', currentStoreUid), (snap) => {
    const grid = document.getElementById('productGrid');
    if (!snap.exists()) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: var(--text-muted);">Belum ada produk yang tersedia.</p>';
      return;
    }

    const pakets = snap.data().items || [];
    const activePakets = pakets.filter(p => p.status === 'aktif');
    
    // Save pakets globally
    window._paketsData = activePakets;
    renderProducts(activePakets);

    // Render Dropdown Klaim Garansi
    const wProductSelect = document.getElementById('wProduct');
    if (wProductSelect) {
      wProductSelect.innerHTML = '<option value="" disabled selected>Pilih Produk / Layanan...</option>' + 
        activePakets.map(p => {
          return `<option value="${p.id}">${p.nama} • ${p.durasi} Hari</option>`;
        }).join('');
    }
  });

  // Search logic
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (!window._paketsData) return;
    
    const filtered = window._paketsData.filter(p => {
      const nama = (p.nama || '').toLowerCase();
      const deskripsi = (p.deskripsi || '').toLowerCase();
      return nama.includes(query) || deskripsi.includes(query);
    });
    
    renderProducts(filtered);
  });
}

function renderProducts(pakets) {
  const grid = document.getElementById('productGrid');
  if (pakets.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: var(--text-muted);">Produk yang Anda cari tidak tersedia.</p>';
    return;
  }

  grid.innerHTML = pakets.map(p => {
    const imgSrc = p.imageUrl || 'assets/placeholder-logo.png';
    return `
      <div class="product-card">
        <div class="product-header">
          <img src="${imgSrc}" alt="${p.nama}" class="product-logo" onerror="this.onerror=null;this.src='assets/placeholder-logo.png'">
          <div class="product-info">
            <h3 class="product-name">${p.nama}</h3>
            <span class="product-category">${p.durasi} Hari</span>
          </div>
        </div>
        <div class="product-price">${formatRupiah(p.harga)}</div>
        <button class="btn-primary" onclick="window.openCheckout(${p.id})">Pesan Sekarang</button>
      </div>
    `;
  }).join('');
}

// 3. Modals Logic
window.openCheckout = function(productId) {
  const p = window._paketsData.find(x => x.id === productId);
  if (!p) return;
  currentSelectedProduct = p;

  document.getElementById('checkoutProductImg').src = p.imageUrl || 'assets/placeholder-logo.png';
  document.getElementById('checkoutProductName').textContent = p.nama;
  document.getElementById('checkoutProductDurasi').textContent = p.durasi + " Hari";
  document.getElementById('checkoutProductPrice').textContent = formatRupiah(p.harga);
  
  document.getElementById('checkoutModal').classList.add('active');
};

document.getElementById('closeCheckoutBtn')?.addEventListener('click', () => {
  document.getElementById('checkoutModal').classList.remove('active');
});

// Warranty Modal Toggle
document.getElementById('btnNavWarranty')?.addEventListener('click', () => {
  document.getElementById('warrantyModal').classList.add('active');
});
document.getElementById('btnFooterWarranty')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('warrantyModal').classList.add('active');
});
document.getElementById('closeWarrantyBtn')?.addEventListener('click', () => {
  document.getElementById('warrantyModal').classList.remove('active');
});
document.getElementById('btnDoneWarranty')?.addEventListener('click', () => {
  document.getElementById('warrantyModal').classList.remove('active');
  document.getElementById('warrantyForm').reset();
  document.getElementById('warrantyForm').style.display = 'block';
  document.getElementById('warrantySuccess').style.display = 'none';
});

// 4. Form Submission (Create Order)
let isOrderSubmitting = false;

document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (isOrderSubmitting) return;
  
  const name = document.getElementById('custName').value.trim();
  const phoneRaw = document.getElementById('custWa').value.trim();
  const phone = formatPhone(phoneRaw);
  
  if (!name || !phone) {
    alert('Nama dan Nomor WhatsApp wajib diisi.');
    return;
  }

  isOrderSubmitting = true;
  const btn = document.getElementById('btnSubmitOrder');
  btn.textContent = "Memproses...";
  btn.disabled = true;

  try {
    currentInvoiceNumber = generateInvoice();

    await addDoc(collection(db, 'live_orders'), {
      storeUid: currentStoreUid,
      nama: name,
      wa: phone,
      produk: currentSelectedProduct.nama,
      harga: currentSelectedProduct.harga,
      durasi: currentSelectedProduct.durasi,
      catatan: 'Dari Landing Page',
      timestamp: serverTimestamp(),
      status: 'pending',
      invoice: currentInvoiceNumber
    });

    // D. Sinkronisasi ke Transaksi SubFlow Admin
    const custRef = doc(db, 'customers', currentStoreUid);
    const trxRef = doc(db, 'transaksis', currentStoreUid);
    
    const [custSnap, trxSnap] = await Promise.all([
      getDoc(custRef),
      getDoc(trxRef)
    ]);
    
    let customers = custSnap.exists() ? (custSnap.data().items || []) : [];
    let transaksis = trxSnap.exists() ? (trxSnap.data().items || []) : [];
    
    let custId = null;
    let customerUpdated = false;
    const existingCust = customers.find(c => {
      if (!c.wa) return false;
      let existingWa = c.wa.toString().replace(/\D/g, '');
      if (existingWa.startsWith('0')) existingWa = '62' + existingWa.substring(1);
      return existingWa === phone;
    });

    if (existingCust) {
      custId = existingCust.id;
    } else {
      custId = customers.length ? Math.max(...customers.map(c => c.id)) + 1 : 1;
      
      const tgl = new Date();
      const yy = tgl.getFullYear();
      const mm = String(tgl.getMonth() + 1).padStart(2, '0');
      const dd = String(tgl.getDate()).padStart(2, '0');
      
      customers.push({ 
        id: custId, 
        nama: name, 
        wa: phone, 
        created_at: tgl.toISOString(),
        tgl_order: `${yy}-${mm}-${dd}`,
        status: 'aktif',
        catatan: 'Customer dari Landing Page'
      });
      customerUpdated = true;
    }

    const duplicateTrx = transaksis.find(t => t.invoice_number === currentInvoiceNumber);
    if (!duplicateTrx) {
      const today = new Date();
      // Format YYYY-MM-DD using local time safely
      const yy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const tglStr = `${yy}-${mm}-${dd}`;
      
      const expDate = new Date(today);
      expDate.setDate(expDate.getDate() + currentSelectedProduct.durasi);
      const e_yy = expDate.getFullYear();
      const e_mm = String(expDate.getMonth() + 1).padStart(2, '0');
      const e_dd = String(expDate.getDate()).padStart(2, '0');
      const expiredStr = `${e_yy}-${e_mm}-${e_dd}`;
      
      const newTrxId = transaksis.length ? Math.max(...transaksis.map(t => t.id)) + 1 : 1;
      
      transaksis.push({
        id: newTrxId,
        tgl: tglStr,
        custId: custId,
        paketId: currentSelectedProduct.id,
        invoice_number: currentInvoiceNumber,
        harga: currentSelectedProduct.harga,
        hpp: currentSelectedProduct.hpp || 0,
        profit: currentSelectedProduct.harga - (currentSelectedProduct.hpp || 0),
        mulai: tglStr,
        expired: expiredStr,
        statusLangganan: 'aktif',
        statusBayar: 'pending',
        suppId: null,
        catatan: 'Order dari Landing Page',
        customerNotes: `Terima kasih telah berbelanja di ${storeName}.`,
        accountEmail: '',
        accountPassword: '',
        accountProfil: '',
        accountPin: ''
      });

      const batch = writeBatch(db);
      if (customerUpdated) {
        batch.set(custRef, { items: customers });
      }
      batch.set(trxRef, { items: transaksis });
      await batch.commit();
    }

    // Success -> Show QRIS
    document.getElementById('checkoutModal').classList.remove('active');
    
    document.getElementById('qrisTotal').textContent = formatRupiah(currentSelectedProduct.harga);
    document.getElementById('qrisInvoice').textContent = currentInvoiceNumber;
    document.getElementById('qrisModal').classList.add('active');

  } catch (err) {
    console.error(err);
    alert('Terjadi kesalahan. Silakan coba lagi.');
  } finally {
    isOrderSubmitting = false;
    btn.textContent = "Lanjut Pembayaran";
    btn.disabled = false;
  }
});

// 5. Confirm Payment
document.getElementById('btnConfirmPayment').addEventListener('click', async () => {
  const btn = document.getElementById('btnConfirmPayment');
  btn.textContent = "Mengonfirmasi...";
  btn.disabled = true;

  try {
    // Redirect to WhatsApp
    const waText = `Halo, saya sudah melakukan pembayaran.\n\nNama: ${document.getElementById('custName').value}\nNomor: ${document.getElementById('custWa').value}\nProduk: ${currentSelectedProduct.nama}\nDurasi: ${currentSelectedProduct.durasi} Hari\nTotal: ${formatRupiah(currentSelectedProduct.harga)}\n\nInvoice: ${currentInvoiceNumber}\n\nMohon segera diproses. Terima kasih.`;
    
    let adminWa = storeWa || '6281234567890'; // fallback
    window.location.href = `https://wa.me/${adminWa}?text=${encodeURIComponent(waText)}`;

  } catch(err) {
    console.error(err);
    alert('Terjadi kesalahan saat konfirmasi.');
    btn.textContent = "Saya Sudah Transfer";
    btn.disabled = false;
  }
});

// Initialize on load
init();

// 6. Warranty Claim Submission
let isSubmitting = false;

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.position = 'fixed';
  t.style.bottom = '20px';
  t.style.left = '50%';
  t.style.transform = 'translateX(-50%)';
  t.style.background = type === 'success' ? '#10B981' : '#EF4444';
  t.style.color = '#fff';
  t.style.padding = '12px 24px';
  t.style.borderRadius = '8px';
  t.style.fontWeight = '600';
  t.style.zIndex = '9999';
  t.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.5s'; setTimeout(() => t.remove(), 500); }, 3000);
}

const handleWarrantySubmit = async (e) => {
  e.preventDefault();

  if (isSubmitting) return;

  const btn = document.getElementById('btnSubmitWarranty');
  isSubmitting = true;
  btn.textContent = "Mengirim...";
  btn.disabled = true;

  try {
    const wPhoneRaw = document.getElementById('wPhone').value.trim();
    const wEmail = document.getElementById('wEmail').value.trim();
    const wProductId = document.getElementById('wProduct').value;
    const wInvoice = document.getElementById('wInvoice').value.trim();
    const wDesc = document.getElementById('wDesc').value.trim();
    const fileInput = document.getElementById('wAttachment');
    const file = fileInput.files[0];

    // Validasi
    if (!wPhoneRaw || !wProductId || !wInvoice || !wDesc || !file) {
      throw new Error('Lengkapi semua field wajib beserta buktinya.');
    }

    const selectedPackage = window._paketsData?.find(p => String(p.id) === String(wProductId));
    if (!selectedPackage) {
      throw new Error('Produk/Layanan yang dipilih tidak valid.');
    }
    
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Ukuran file maksimal 5 MB.');
    }

    const wPhone = formatPhone(wPhoneRaw);

    console.log('Uploading proof file to Cloudinary...');

    const cloudName = 'djz7gnki1'; 
    const uploadPreset = 'subflow_warranty'; 
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    let proofUrl;
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Gagal mengunggah gambar ke Cloudinary');
      }
      
      const data = await response.json();
      proofUrl = data.secure_url;
      
    } catch (error) {
      console.error('Cloudinary Upload Error:', error);
      showToast('Upload bukti gagal. Silakan periksa koneksi atau kredensial Cloudinary Anda.', 'error');
      throw error;
    }

    console.log('Saving warranty claim to Firestore...');

    // Simpan ke Firestore
    await addDoc(collection(db, 'warranty_claims'), {
      whatsapp: wPhone,
      email: wEmail || '',
      packageId: selectedPackage.id,
      packageName: selectedPackage.nama,
      serviceName: selectedPackage.nama_aplikasi || selectedPackage.nama,
      duration: selectedPackage.durasi || 0,
      productName: selectedPackage.nama, // Backward compatibility
      invoiceId: wInvoice,
      issue: wDesc,
      proofUrl: proofUrl,
      proofFileName: file.name,
      status: 'Menunggu Diproses',
      source: 'landing-page',
      storeUid: currentStoreUid, // Disimpan untuk filter di dashboard admin
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Sukses
    showToast('Klaim garansi berhasil dikirim.', 'success');
    document.getElementById('warrantyForm').reset();
    document.getElementById('warrantyModal').classList.remove('active');

  } catch (error) {
    console.error('Warranty submit failed:', error);
    alert(error.message);
    showToast(error.message || 'Gagal mengirim klaim garansi.', 'error');
  } finally {
    isSubmitting = false;
    btn.textContent = "Kirim Klaim";
    btn.disabled = false;
  }
};

document.getElementById('warrantyForm')?.addEventListener('submit', handleWarrantySubmit);
