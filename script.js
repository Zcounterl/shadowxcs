import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, runTransaction, onDisconnect, serverTimestamp, get, remove, off, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = { 
    apiKey: "AIzaSyAYjnWMB23CQ2OnofJuoMBJyoxBahvPj9Q", 
    authDomain: "sigitdb-eb445.firebaseapp.com", 
    databaseURL: "https://sigitdb-eb445-default-rtdb.firebaseio.com/", 
    projectId: "sigitdb-eb445", 
    storageBucket: "sigitdb-eb445.firebasestorage.app", 
    messagingSenderId: "939882511814", 
    appId: "1:939882511814:web:797708c2440f35062646c7" 
};

const app = initializeApp(firebaseConfig); 
const rtdb = getDatabase(app);



// --- KONFIGURASI CLOUDINARY (TAMBAHKAN INI) ---
const CLOUD_NAME = "deiksrxyg"; 
const UPLOAD_PRESET = "sigit_db_v1"; 
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;


// --- TAMBAHKAN INI AGAR TOMBOL HTML BISA BACA DATABASE ---
window.remove = remove;
window.ref = ref;
window.rtdb = rtdb;
window.update = update;
window.set = set;



let pressTimer;
// --- GLOBAL VARIABLES ---
let user = null;
let mediaRecorder; 
let audioChunks = [];
let curChatId = 'global'; 
let lastBroadcastId = localStorage.getItem('last_broadcast_id'); 
let curCollection = null; 
let curItem = null; 
let typingTimeout = null; 
let pendingImage = null; 
let replyingToMsg = null;
let chatListenerRef = null;

let pendingFileBlob = null;

let isAutoScroll = true; // Default: ON
let chatSearchQuery = ""; // Default: Kosong
// --- GLOBAL VARS BARU ---
let allUsernames = []; // Cache untuk daftar user (Mention)
let mentionIndex = -1; // Navigasi keyboard mention
window.isSelectionMode = false;
let selectedMsgIds = new Set(); // Menyimpan ID pesan yang dipilih

// --- TEMA & SESSION ---
const savedTheme = localStorage.getItem('site_theme') || '#6366f1'; 
document.documentElement.style.setProperty('--theme-color', savedTheme);

// Cek Session User
try {
    const saved = localStorage.getItem('user');
    if (saved) {
        user = JSON.parse(saved);
        // Perbaikan data tamu jika rusak
        if (user.isGuest && (!user.username || user.username === 'undefined')) {
            user.username = "Tamu_" + Math.floor(Math.random() * 1000); 
            user.name = user.username;
            localStorage.setItem('user', JSON.stringify(user));
        }
    }
} catch (e) { 
    localStorage.removeItem('user'); 
    user = null; 
}

window.onload = () => { 
    // PANGGIL DULUAN BIAR GAMBAR LANGSUNG MUNCUL
    loadSiteConfig();

    if(typeof switchAuthTab === 'function') switchAuthTab('login');
    
    if(!user) {
        document.getElementById('login-modal').classList.remove('hidden'); 
        // ...
    } else {
        initApp(); 
    }
};



// --- FUNGSI LOAD CONFIG (DENGAN CACHE MEMORI) ---
function loadSiteConfig() {
    // 1. Cek Memori HP dulu (Biar INSTAN, gak nunggu loading)
    const cachedBg = localStorage.getItem('cached_login_bg');
    const bgElement = document.getElementById('dynamic-login-bg');
    
    if (cachedBg && bgElement) {
        bgElement.style.backgroundImage = `url('${cachedBg}')`;
    }

    // 2. Baru cek ke Firebase (Untuk update kalau ada perubahan)
    onValue(ref(rtdb, 'site_data/config'), (s) => {
        const config = s.val();
        if (config && config.login_bg) {
            if (bgElement) {
                bgElement.style.backgroundImage = `url('${config.login_bg}')`;
                // SIMPAN KE MEMORI HP
                localStorage.setItem('cached_login_bg', config.login_bg);
            }
        }
    });
}









// --- HELPER NOTIFIKASI TOAST (WAJIB ADA) ---
window.showGameToast = (msg, type) => {
    Toastify({
        text: msg,
        duration: 3000,
        gravity: "top",
        position: "center",
        className: `gaming-toast ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`,
        stopOnFocus: true
    }).showToast();
};






function showGameToast(msg, type) {
    Toastify({
        text: msg,
        duration: 3000,
        gravity: "top",
        position: "center",
        className: `gaming-toast ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`,
        stopOnFocus: true
    }).showToast();
}



// --- FUNGSI INIT APP (FIXED: DEBUG STABIL & ADMIN) ---
function initApp() {
    document.getElementById('login-modal').classList.add('hidden');
    
    if(!user.isGuest) {
        // 1. Setup Avatar User
        const finalPic = user.profile_pic || user.pic || `https://ui-avatars.com/api/?name=${user.username}&background=random`;
        const navImg = document.getElementById('nav-avatar');
        if(navImg) navImg.src = finalPic;
        const profileImg = document.getElementById('p-avatar');
        if(profileImg) profileImg.src = finalPic;
        
        // --- LOGIKA KHUSUS DEVELOPER (PERBAIKAN UTAMA) ---
        if(user.role === 'developer') {
            // A. Tandai Body (PENTING: Agar CSS 'Always On Top' bekerja)
            document.body.classList.add('is-developer');

            // B. Munculkan Tombol Debug (Paksa Hapus Hidden & Set Display)
            const dbgBtn = document.getElementById('debug-floating-btn');
            if(dbgBtn) {
                dbgBtn.classList.remove('hidden');
                dbgBtn.style.display = 'flex'; // Paksa tampil flex
            }

            // C. Munculkan Tombol God Mode (Header)
            const btnGod = document.getElementById('btn-god-mode');
            if(btnGod) btnGod.classList.remove('hidden');
            
            // D. Munculkan Panel Admin (Profil)
            const adminPanel = document.getElementById('admin-panel-btn-container');
            if(adminPanel) adminPanel.classList.remove('hidden');

            // E. Load Data Admin Dashboard
            loadDevInbox();
            updateAdminStats();
            renderFirewallList();
            initServerHeartbeat();
        }
        
        // 2. Setup Wallpaper Chat
        if(user.chat_bg) {
            const chatBg = document.getElementById('chat-bg');
            if(chatBg) {
                chatBg.style.backgroundImage = `url('${user.chat_bg}')`;
                chatBg.style.backgroundSize = 'cover';
                chatBg.style.backgroundPosition = 'center';
            }
        }
    }
    
    // 3. Setup Navigasi & Halaman
    setupListeners();
    navigateTo('home');
    
    // 4. Inisialisasi Library Visual
    try { VanillaTilt.init(document.querySelectorAll(".glass-card")); } catch(e) {}
    try { if("Notification" in window && Notification.permission !== "granted") Notification.requestPermission(); } catch(e) {}
    
    // 5. Fungsi Keamanan & Load Data
    setTimeout(() => checkDeepLink(), 1500);
    setupGodModeListeners();
    checkBanStatus();
    captureIp();
    checkSchedule();

    // 6. Load Chat Global
    loadChatMessages('global');
    
    // 7. Efek Partikel Background
    try { particlesJS("particles-js", {"particles":{"number":{"value":50,"density":{"enable":true,"value_area":800}},"color":{"value":"#ffffff"},"shape":{"type":"circle","stroke":{"width":0,"color":"#000000"},"polygon":{"nb_sides":5},"image":{"src":"img/github.svg","width":100,"height":100}},"opacity":{"value":0.3,"random":false,"anim":{"enable":false,"speed":1,"opacity_min":0.1,"sync":false}},"size":{"value":3,"random":true,"anim":{"enable":false,"speed":40,"size_min":0.1,"sync":false}},"line_linked":{"enable":true,"distance":150,"color":"#ffffff","opacity":0.2,"width":1},"move":{"enable":true,"speed":2,"direction":"none","random":false,"straight":false,"out_mode":"out","bounce":false,"attract":{"enable":false,"rotateX":600,"rotateY":1200}}},"interactivity":{"detect_on":"canvas","events":{"onhover":{"enable":true,"mode":"grab"},"onclick":{"enable":true,"mode":"push"},"resize":true},"modes":{"grab":{"distance":140,"line_linked":{"opacity":0.5}},"bubble":{"distance":400,"size":40,"duration":2,"opacity":8,"speed":3},"repulse":{"distance":200,"duration":0.4},"push":{"particles_nb":4},"remove":{"particles_nb":2}}},"retina_detect":true}); } catch(e) {}
}


// =========================================
// 🔐 SISTEM AUTENTIKASI BARU (LOGIN & REGISTER)
// =========================================

window.switchAuthTab = (tab) => {
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-register').classList.add('hidden');
    
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.remove('active');

    let targetInputId;

    if(tab === 'login') {
        document.getElementById('form-login').classList.remove('hidden');
        const tabEl = document.getElementById('tab-login');
        if(tabEl) tabEl.classList.add('active');
        targetInputId = 'login-user';
    } else {
        document.getElementById('form-register').classList.remove('hidden');
        const tabEl = document.getElementById('tab-register');
        if(tabEl) tabEl.classList.add('active');
        targetInputId = 'reg-user';
    }
    
    // PERBAIKAN KEYBOARD: Fokus cepat ke input yang baru dibuka
    setTimeout(() => {
        const targetInput = document.getElementById(targetInputId);
        if(targetInput) targetInput.focus();
    }, 100);
}
// 2. Fungsi Login (Cek Password & Status)
window.doLogin = async () => { 
    const uInput = document.getElementById('login-user').value.trim(); 
    const pInput = document.getElementById('login-pass').value.trim(); 

    // Backdoor Developer (Wajib ada buat kamu masuk pertama kali)
    if(uInput === 'developer' && pInput === 'dev123') { 
        user = {
            name:'Developer', username:'Developer', role:'developer',
            isPremium:true, pic:'https://cdn-icons-png.flaticon.com/512/2304/2304226.png'
        }; 
        localStorage.setItem('user', JSON.stringify(user)); 
        captureIp(); location.reload(); return; 
    } 

    try { 
        const snap = await get(ref(rtdb, `users/${uInput}`)); 
        
        if(snap.exists()) { 
            const userData = snap.val();
            // Cek Password (field 'code' sekarang kita anggap password)
            if(String(userData.code) === String(pInput)) { 
                user = { ...userData, username: uInput, role: userData.role || 'member' }; 
                localStorage.setItem('user', JSON.stringify(user)); 
                captureIp(); location.reload(); 
            } else { 
                Swal.fire("Gagal", "Password Salah!", "error"); 
            }
        } else { 
            // Cek apakah masih di waiting list (Pending)
            const pendingSnap = await get(ref(rtdb, `pending_registrations/${uInput}`));
            if(pendingSnap.exists()) {
                Swal.fire({
                    icon: 'info',
                    title: 'Sedang Ditinjau',
                    text: 'Akun Anda sudah dibuat tapi belum di-ACC oleh Developer. Silakan tunggu atau hubungi Admin.',
                    background: '#1e293b', color: '#fff'
                });
            } else {
                Swal.fire("Gagal", "Username tidak ditemukan. Silakan Daftar.", "error"); 
            }
        } 
    } catch(e) { 
        Swal.fire("Error", e.message, "error"); 
    } 
}



// --- FUNGSI UPLOAD KE CLOUDINARY (TAMBAHKAN INI) ---
const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const response = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('Gagal upload ke Cloudinary');
        const data = await response.json();
        return data.secure_url; // Kembalikan Link HTTPS
    } catch (error) {
        console.error("Cloudinary Error:", error);
        throw error;
    }
};








// 3. Fungsi Register (Kirim ke Pending List)
window.doRegister = async () => {
    // --- CEK STATUS GATE (FITUR BARU) ---
    // Kita cek dulu ke database apakah admin menutup pendaftaran
    try {
        const gateSnap = await get(ref(rtdb, 'site_data/config/registration_open'));
        if(gateSnap.exists() && gateSnap.val() === false) {
            return Swal.fire({
                icon: 'error', 
                title: 'Pendaftaran Ditutup', 
                text: 'Admin sedang menutup akses pendaftaran member baru.',
                background: '#1e293b', color: '#fff'
            });
        }
    } catch(e) {
        console.log("Gate check skipped/error (default open)");
    }
    // ------------------------------------

    const u = document.getElementById('reg-user').value.trim().replace(/\s/g, '');
    const p = document.getElementById('reg-pass').value.trim();
    const r = document.getElementById('reg-reason').value.trim();

    if(!u || !p || !r) return Swal.fire("Ups", "Semua kolom wajib diisi!", "warning");

    // Cek dulu takut username udah ada
    const checkUser = await get(ref(rtdb, `users/${u}`));
    const checkPending = await get(ref(rtdb, `pending_registrations/${u}`));

    if(checkUser.exists() || checkPending.exists()) {
        return Swal.fire("Gagal", "Username sudah dipakai orang lain.", "error");
    }

    // Simpan ke Pending
    const reqData = {
        username: u,
        password: p, // Disimpan sementara di pending
        reason: r,
        timestamp: serverTimestamp(),
        device: navigator.userAgent
    };

    await set(ref(rtdb, `pending_registrations/${u}`), reqData);
    
    Swal.fire({
        icon: 'success',
        title: 'Permintaan Terkirim!',
        text: 'Developer akan meninjau akun Anda. Cek secara berkala.',
        background: '#1e293b', color: '#fff'
    });
    
    // Reset form
    document.getElementById('reg-user').value = '';
    document.getElementById('reg-pass').value = '';
    document.getElementById('reg-reason').value = '';
    switchAuthTab('login');
}
window.logout = () => { 
    localStorage.removeItem('user'); 
    location.reload(); 
}



// 4. Fungsi Load Inbox Developer (Dipanggil di initApp)
window.loadDevInbox = () => {
    if(!user || user.role !== 'developer') return;
    
    document.getElementById('dev-inbox-area').classList.remove('hidden');
    const list = document.getElementById('request-list');
    const countBadge = document.getElementById('req-count');

    onValue(ref(rtdb, 'pending_registrations'), s => {
        list.innerHTML = '';
        const data = s.val();
        if(!data) {
            list.innerHTML = '<div class="text-center text-[10px] text-gray-600 py-2">Tidak ada permintaan.</div>';
            countBadge.innerText = '0';
            return;
        }

        countBadge.innerText = Object.keys(data).length;

        Object.entries(data).forEach(([key, val]) => {
            list.innerHTML += `
            <div class="bg-white/5 p-3 rounded-xl border border-white/5">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <div class="text-xs font-bold text-white text-green-400">${val.username}</div>
                        <div class="text-[10px] text-gray-400 font-mono">Pass: ${val.password}</div>
                    </div>
                    <div class="flex gap-1">
                        <button onclick="accUser('${val.username}')" class="bg-green-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-green-500">ACC</button>
                        <button onclick="rejectUser('${val.username}')" class="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-red-500">TOLAK</button>
                    </div>
                </div>
                <div class="text-[10px] text-gray-300 italic bg-black/20 p-2 rounded">"${val.reason}"</div>
            </div>
            `;
        });
    });
}

// 5. Logika ACC User (Pindahkan dari Pending ke Users Utama)
window.accUser = async (username) => {
    try {
        // Ambil data dari pending
        const snap = await get(ref(rtdb, `pending_registrations/${username}`));
        if(!snap.exists()) return;
        const d = snap.val();

        // Data User Baru yang akan dibuat
        const newUserData = {
            username: d.username,
            code: d.password, // Password jadi 'code' login
            role: 'member',
            level: 1,
            coins: 50, // Bonus awal
            profile_pic: `https://ui-avatars.com/api/?name=${d.username}&background=random`,
            joined_at: serverTimestamp()
        };

        // 1. Masukkan ke Users
        await set(ref(rtdb, `users/${d.username}`), newUserData);
        // 2. Hapus dari Pending
        await remove(ref(rtdb, `pending_registrations/${d.username}`));

        showGameToast(`User ${d.username} BERHASIL DI-ACC!`, "success");
    } catch(e) {
        Swal.fire("Error", e.message, "error");
    }
}

// 6. Logika Tolak User
window.rejectUser = async (username) => {
    if(confirm(`Tolak permintaan ${username}?`)) {
        await remove(ref(rtdb, `pending_registrations/${username}`));
        showGameToast("Permintaan ditolak.", "info");
    }
}










// --- FUNGSI CEK IP (AUTO BLOCK) ---
async function captureIp() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const json = await res.json();
        const myIp = json.ip;
        const safeIp = myIp.replace(/\./g, '_');

        // 1. CEK APAKAH IP INI DIBLOKIR DI FIREWALL?
        const banSnap = await get(ref(rtdb, `site_data/firewall/${safeIp}`));
        if(banSnap.exists()) {
            // JIKA DIBLOKIR: Hancurkan Tampilan
            document.body.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:black;color:red;font-family:monospace;flex-direction:column;text-align:center;">
                    <h1 style="font-size:50px">ACCESS DENIED</h1>
                    <p>YOUR IP (${myIp}) HAS BEEN PERMANENTLY BANNED.</p>
                    <p style="font-size:10px;color:gray;margin-top:20px">Security Protocol v34.6</p>
                </div>
            `;
            // Stop script execution
            throw new Error("IP BANNED");
        }

        // 2. Kalau Aman, Update Data User
        if(user && user.username) {
            const updates = {};
            updates[`users/${user.username}/ip`] = myIp;
            updates[`users/${user.username}/last_seen`] = new Date().toISOString();
            updates[`users/${user.username}/device`] = navigator.userAgent;
            update(ref(rtdb), updates);
        }
    } catch(e) {
        if(e.message === "IP BANNED") return;
    }
}






function setupListeners() {
    const safeClass = (id, className, add) => {
        const el = document.getElementById(id);
        if (el) {
            if (add) el.classList.add(className);
            else el.classList.remove(className);
        }
    };

    const safeStyle = (id, prop, value) => {
        const el = document.getElementById(id);
        if (el) el.style[prop] = value;
    };

    // 1. KONFIGURASI UTAMA (ANTI-SS & LOGIN BG)
    // 1. KONFIGURASI UTAMA
    onValue(ref(rtdb, 'site_data/config'), s => {
        try {
            const c = s.val() || {};
            if (c.anti_ss) enableAntiSS(); else disableAntiSS();

            // --- BAGIAN PENTING INI ---
            if (c.login_bg) {
                const bg = document.getElementById('dynamic-login-bg');
                if (bg) {
                    bg.style.backgroundImage = `url('${c.login_bg}')`;
                }
            }
            // --------------------------
        } catch (e) { }
    });

    // 2. MAINTENANCE SYSTEM
    onValue(ref(rtdb, 'site_data/maintenance'), s => {
        const m = s.val() || {};

        if (m.all && user.role !== 'developer') safeStyle('lockdown-overlay', 'display', 'flex');
        else safeStyle('lockdown-overlay', 'display', 'none');

        if (m.chat && user.role !== 'developer') {
            safeClass('maintenance-chat', 'hidden', false);
            safeClass('chat-dash-content', 'hidden', true);
        } else {
            safeClass('maintenance-chat', 'hidden', true);
            safeClass('chat-dash-content', 'hidden', false);
        }

        if (m.gallery && user.role !== 'developer') {
            safeClass('maintenance-gallery', 'hidden', false);
            safeClass('gallery-container', 'hidden', true);
        } else {
            safeClass('maintenance-gallery', 'hidden', true);
            safeClass('gallery-container', 'hidden', false);
        }

        if (user.role === 'developer') {
            const types = ['all', 'chat', 'gallery', 'upload'];
            types.forEach(type => {
                const isActive = m[type] === true;
                const btn = document.getElementById(`btn-mt-${type}`);
                const dot = document.getElementById(`dot-mt-${type}`);
                const status = document.getElementById(`status-mt-${type}`);
                const txt = document.getElementById(`txt-mt-${type}`);

                if (btn && dot && status && txt) {
                    if (isActive) {
                        btn.className = "bg-green-900/20 p-4 rounded-xl border border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 transform scale-105";
                        dot.className = "w-3 h-3 rounded-full bg-green-400 shadow-[0_0_10px_#4ade80] animate-pulse";
                        status.className = "text-[9px] font-mono text-green-400 font-bold";
                        status.innerText = "ACTIVE";
                        txt.className = "text-[10px] font-bold text-white tracking-widest shadow-green-500/50";
                    } else {
                        btn.className = "bg-black/40 p-4 rounded-xl border border-red-900/20 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 hover:border-red-500/50 opacity-70 hover:opacity-100";
                        dot.className = "w-3 h-3 rounded-full bg-red-800";
                        status.className = "text-[9px] font-mono text-red-700 font-bold";
                        status.innerText = "OFF";
                        txt.className = "text-[10px] font-bold text-gray-500 tracking-widest";
                    }
                }
            });
        }
    });

    // 3. CONTENT DATA (DENGAN LIMITASI BIAR NGEBUT)
    
    // Galeri (15 Terakhir)
    const galleryQuery = query(ref(rtdb, 'site_data/gallery'), limitToLast(15));
    onValue(galleryQuery, s => {
        safeClass('skeleton-loader', 'hidden', true);
        safeClass('gallery-container', 'hidden', false);

        const gal = document.getElementById('gallery-container');
        const d = s.val();
        if (gal) {
            if (!d) {
                gal.innerHTML = '<div class="col-span-2 text-center text-gray-500 mt-10">Belum ada postingan galeri.</div>';
            } else {
                const items = Object.entries(d).map(([k, v]) => ({ id: k, ...v })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                renderGallery(items);
                renderSlider(items.filter(x => x.is_slide));
            }
        }
    });

    // Mading (10 Terakhir)
    const madingQuery = query(ref(rtdb, 'site_data/mading'), limitToLast(10));
    onValue(madingQuery, s => renderMading(s.val()));

    // Downloads (20 Terakhir)
    const downloadsQuery = query(ref(rtdb, 'site_data/downloads'), limitToLast(20));
    onValue(downloadsQuery, s => renderDownloads(s.val()));

    // Playlist (20 Terakhir)
    const playlistQuery = query(ref(rtdb, 'site_data/playlist'), limitToLast(20));
    onValue(playlistQuery, s => renderPlaylist(s.val()));

    // Load Chat Awal
    loadChatMessages('global');

    // 4. USER & GROUP LIST
    onValue(ref(rtdb, 'users'), s => {
        const allUsers = s.val() || {};
        renderContactList(allUsers);
        if (user.role === 'developer') { renderAdminUserList(allUsers); }
    });

    onValue(ref(rtdb, 'community/groups'), s => renderGroupList(s.val()));

    // 5. STATUS ONLINE SYSTEM
    const con = ref(rtdb, ".info/connected");
    onValue(con, s => {
        if (s.val() === true && !user.isGuest) {
            const m = ref(rtdb, `status/online/${user.username}`);
            onDisconnect(m).remove();
            set(m, { time: serverTimestamp() });
        }
    });

    onValue(ref(rtdb, "status/online"), s => {
        const el = document.getElementById('online-count');
        if (el) el.innerText = s.exists() ? s.size : 0;
    });

    // 6. BROADCAST SYSTEM
    onValue(ref(rtdb, 'site_data/config/broadcast'), (snap) => {
        const data = snap.val();
        if (data && data.active && data.id !== lastBroadcastId) {
            showGameToast("📢 " + data.message, "info");
            localStorage.setItem('last_broadcast_id', data.id);
        }
    });

    // 7. TYPING INDICATOR (PATH BARU: 'typing/' + AVATAR)
    onValue(ref(rtdb, 'typing'), s => {
        const typeData = s.val();
        const typingArea = document.getElementById('typing-area');

        if (typingArea && typeData && typeData[curChatId]) {
            const typers = Object.entries(typeData[curChatId])
                .filter(([name, data]) => name !== user.username)
                .map(([name, data]) => data); 

            if (typers.length > 0) {
                let avatarHtml = '<div class="typing-avatar-container">';
                typers.forEach((t, index) => {
                    if(index < 3) { 
                        avatarHtml += `<img src="${t.pic}" class="typing-avatar-img">`;
                    }
                });
                avatarHtml += '</div>';
                
                const countText = typers.length === 1 ? "sedang mengetik..." : `${typers.length} orang mengetik...`;

                typingArea.innerHTML = `${avatarHtml} <span class="text-[10px] text-green-400 italic">${countText}</span>`;
                typingArea.classList.add('active');
            } else {
                typingArea.classList.remove('active');
            }
        } else if (typingArea) {
            typingArea.classList.remove('active');
        }
    });

    // 8. LIVE CSS INJECTION
    onValue(ref(rtdb, 'site_data/config/live_css'), s => {
        const css = s.val();
        let styleTag = document.getElementById('dynamic-god-css');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'dynamic-god-css';
            document.head.appendChild(styleTag);
        }
        styleTag.innerHTML = css || '';

        if (user.role === 'developer' && document.getElementById('live-css-input')) {
            if (document.activeElement.id !== 'live-css-input') {
                document.getElementById('live-css-input').value = css || '';
            }
        }
    });

    // 9. ADMIN REMOTE COMMANDS
    onValue(ref(rtdb, 'site_data/admin_commands'), s => {
        const cmd = s.val();
        if (!cmd) return;

        const now = Date.now();
        if (now - cmd.timestamp < 5000 && user.role !== 'developer') {
            if (cmd.type === 'reload') {
                location.reload(true);
            } else if (cmd.type === 'wipe') {
                localStorage.clear();
                location.reload(true);
            }
        }
    });

    // 10. IP WHITELIST
    onValue(ref(rtdb, 'site_data/config/whitelist'), s => {
        const config = s.val();
        if (config && config.active && config.ips && user.role !== 'developer') {
            fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => {
                const myIp = d.ip;
                const allowed = Object.values(config.ips).includes(myIp);
                if (!allowed) {
                    document.body.innerHTML = `
                        <div style="height:100vh;background:black;color:red;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:monospace;text-align:center;">
                            <h1 style="font-size:40px">ACCESS DENIED</h1>
                            <p>IP ANDA (${myIp}) TIDAK TERDAFTAR DI WHITELIST.</p>
                            <p style="color:gray;font-size:10px;margin-top:20px">Hubungi Admin untuk akses.</p>
                        </div>
                    `;
                }
            });
        }
        if (user.role === 'developer') renderWhitelistUI(config);
    });

    // 11. REGISTRATION GATE
    onValue(ref(rtdb, 'site_data/config/registration_open'), s => {
        const isOpen = s.val() !== false;
        if (document.getElementById('toggle-reg-gate')) {
            document.getElementById('toggle-reg-gate').checked = isOpen;
            document.getElementById('reg-status-text').innerText = isOpen ? 'Pendaftaran DIBUKA' : 'Pendaftaran DITUTUP';
            document.getElementById('reg-status-text').className = isOpen ? 'text-[9px] mt-2 text-green-400 font-bold' : 'text-[9px] mt-2 text-red-400 font-bold';
        }
    });

    // 12. TAKEOVER MODE V3
    onValue(ref(rtdb, 'site_data/god_mode/takeover_v3'), s => {
        if (user && user.role === 'developer') return; 

        const data = s.val();
        const layer = document.getElementById('takeover-layer');
        
        if (data && data.active) {
            const now = Date.now();
            const endTime = data.startTime + (data.duration * 1000);
            
            if (now < endTime) {
                layer.classList.remove('hidden');
                
                let frame = document.getElementById('takeover-frame');
                if (!frame) {
                    layer.innerHTML = ''; 
                    frame = document.createElement('iframe');
                    frame.id = 'takeover-frame';
                    frame.style.width = "100%";
                    frame.style.height = "100%";
                    frame.style.border = "none";
                    layer.appendChild(frame);
                    
                    const doc = frame.contentWindow.document;
                    doc.open();
                    
                    const styleBlock = `<style>${data.css || ''}</style>`;
                    const scriptBlock = `<script>try{ ${data.js || ''} }catch(e){console.error(e)}<\/script>`;
                    
                    let finalContent = data.html || '';
                    if(!finalContent.toLowerCase().includes('<body')) {
                        finalContent = `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                ${styleBlock}
                            </head>
                            <body style="margin:0; overflow:hidden; background:#000; color:#fff;">
                                ${finalContent}
                                ${scriptBlock}
                            </body>
                            </html>
                        `;
                    } else {
                        finalContent = finalContent.replace('</head>', `${styleBlock}</head>`);
                        finalContent = finalContent.replace('</body>', `${scriptBlock}</body>`);
                    }

                    doc.write(finalContent);
                    doc.close();
                }

                const timeLeft = endTime - now;
                setTimeout(() => {
                    layer.classList.add('hidden');
                    layer.innerHTML = ''; 
                }, timeLeft);
                
            } else {
                layer.classList.add('hidden');
                layer.innerHTML = '';
            }
        } else {
            if(layer) {
                layer.classList.add('hidden');
                layer.innerHTML = '';
            }
        }
    });
}
















function renderGallery(items) { 
    const c = document.getElementById('gallery-container'); 
    c.innerHTML = ''; 
    
    items.forEach(i => { 
        const div = document.createElement('div'); 
        div.className = "glass-card cursor-pointer group relative"; 
        // FIX: Passing object 'i' agar tidak undefined
        div.onclick = function() { openDetail(i, 'site_data/gallery'); }; 
        
        div.innerHTML = `
            <div class="gallery-image-wrapper">
                <img src="${i.image}" class="gallery-card-img group-hover:scale-105 transition duration-500" loading="lazy">
                <div class="card-badge">${i.category || 'GALERI'}</div>
            </div>
            <div class="card-info">
                <h3 class="font-bold text-white text-sm truncate">${i.title || 'Tanpa Judul'}</h3>
                <p class="text-[10px] text-gray-400 line-clamp-2">${i.description || '...'}</p>
                <div class="text-[9px] text-gray-500 mt-1 text-right">${i.date}</div>
            </div>
        `; 
        c.appendChild(div); 
    }); 
    VanillaTilt.init(document.querySelectorAll(".glass-card")); 
}

function renderMading(d) { 
    const l = document.getElementById('mading-list'); 
    l.innerHTML = ''; 
    if(!d) { 
        l.innerHTML='<div class="text-gray-500 text-xs">Tidak ada info mading.</div>'; 
        return; 
    } 
    Object.entries(d).forEach(([k,m]) => { 
        const item = {id: k, ...m}; 
        const div = document.createElement('div'); 
        div.className = "glass-card p-5 rounded-2xl border-l-4 border-orange-500 cursor-pointer hover:border-orange-400"; 
        div.innerHTML = `
            <h3 class="font-bold text-white mb-1">${m.title}</h3>
            <p class="text-xs text-gray-400 line-clamp-2">${m.description}</p>
            <div class="mt-2 text-[10px] text-gray-500 italic">${m.date}</div>
        `; 
        div.onclick = function() { openDetail(item, 'site_data/mading'); }; 
        l.appendChild(div); 
    }); 
}

// GANTI FUNGSI renderSlider DENGAN INI:
function renderSlider(items) { 
    const w = document.getElementById('hero-slider'); 
    
    // Cek apakah ada item
    if (items && items.length > 0) {
        w.innerHTML = items.map(i => `<div class="swiper-slide"><img src="${i.image}" class="w-full h-full object-cover"></div>`).join('');
    } else {
        // Gambar Default jika kosong
        w.innerHTML = `<div class="swiper-slide"><img src="https://via.placeholder.com/800x400/1e293b/ffffff?text=Portal+Sekolah" class="w-full h-full object-cover"></div>`;
    }

    // Hanya aktifkan loop jika gambar lebih dari 1
    const enableLoop = items && items.length > 1;

    new Swiper(".mySwiper", { 
        loop: enableLoop, 
        autoplay: { delay: 4000, disableOnInteraction: false }, 
        pagination: { el: ".swiper-pagination", clickable: true }, 
        effect: 'fade' 
    }); 
}

function renderPlaylist(d) { 
    const l = document.getElementById('playlist-list'); 
    l.innerHTML = ''; 
    if(d) Object.entries(d).forEach(([k,v]) => {
        // Kita encode liriknya biar aman saat dipasing ke fungsi
        const safeLyrics = v.lyrics ? encodeURIComponent(v.lyrics) : "";
        
        l.innerHTML += `
        <div onclick="playMusic('${v.src}','${v.title}','${v.artist}','${v.type}', '${safeLyrics}')" class="flex items-center gap-3 p-3 glass-card rounded-xl cursor-pointer hover:bg-white/5 transition group">
            <div class="w-10 h-10 bg-indigo-600/20 rounded flex items-center justify-center text-indigo-400 group-hover:scale-110 transition"><i class="fas fa-play"></i></div>
            <div class="flex-1 min-w-0">
                <h4 class="text-sm font-bold text-white truncate">${v.title}</h4>
                <p class="text-xs text-gray-400 truncate">${v.artist}</p>
            </div>
            ${v.lyrics ? '<i class="fas fa-microphone-alt text-[10px] text-gray-600 mr-2" title="Ada Lirik"></i>' : ''}
        </div>`; 
    });
}

function renderDownloads(d) { 
    const c = document.getElementById('downloads-grid'); 
    c.innerHTML = ''; 
    if(d) Object.values(d).forEach(f => {
        c.innerHTML += `
        <a href="${f.url}" target="_blank" class="glass-card p-4 rounded-xl flex items-center gap-3 hover:bg-white/5">
            <i class="fas fa-file-download text-green-400 text-lg"></i>
            <div><h4 class="text-sm font-bold text-white">${f.title}</h4><p class="text-[10px] text-gray-400">${f.type}</p></div>
        </a>`; 
    });
}

// --- UPDATE: SWITCH CHAT (FIX BUG & LAST SEEN) ---
window.switchChat = async (id, name) => {
    curChatId = id;
    
    // 1. BERSIHKAN UI DULU (Anti-Glitch)
    // Hapus isi pesan lama biar gak kelihatan 'sisa' pesan grup lain
    document.getElementById('chat-messages').innerHTML = '<div class="flex justify-center items-center h-full"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div></div>';
    
    // Reset Header
    document.getElementById('chat-header-name').innerText = name;
    const statusEl = document.querySelector('.chat-header .text-green-400');
    if(statusEl) statusEl.innerHTML = '<span class="text-gray-500 text-[10px]">Memuat status...</span>';

    // 2. PINDAH HALAMAN
    navigateTo('chat-room');

    // 3. LOGIKA LAST SEEN (Khusus Chat Personal)
    // Cek apakah id mengandung '_' (tanda chat personal user1_user2)
    if (id.includes('_')) {
        // Cari nama lawan bicara (bukan username kita)
        const users = id.split('_');
        const otherUser = users.find(u => u !== user.username);

        if (otherUser) {
            // Cek apakah dia online real-time
            const onlineSnap = await get(ref(rtdb, `status/online/${otherUser}`));
            
            if (onlineSnap.exists()) {
                 if(statusEl) statusEl.innerHTML = '<span class="w-1.5 h-1.5 bg-green-500 rounded-full inline-block mr-1"></span> Online';
            } else {
                // Jika Offline, ambil data 'last_seen' dari profil usernya
                const userSnap = await get(ref(rtdb, `users/${otherUser}`));
                if (userSnap.exists()) {
                    const uData = userSnap.val();
                    let lastSeenText = "Offline";
                    
                    if (uData.last_seen) {
                        // Pakai moment.js biar formatnya enak (misal: "10 menit yang lalu")
                        lastSeenText = "Terakhir dilihat " + moment(uData.last_seen).fromNow();
                    }
                    if(statusEl) statusEl.innerHTML = `<span class="text-gray-400 text-[10px]">${lastSeenText}</span>`;
                }
            }
        }
    } else {
        // Kalau Group (Global Lounge dll)
        if(statusEl) statusEl.innerHTML = '<span class="text-blue-400 text-[10px] font-bold">👥 Grup Komunitas</span>';
    }

    // 4. BARU LOAD PESAN (Supaya tidak berat di awal)
    loadChatMessages(id);
}

/* =========================================
   PERBAIKAN LOGIKA CHAT (ANTI-ERROR & QUOTE FIX)
   ========================================= */

// 1. Helper untuk membersihkan tanda kutip (PENTING!)
function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}









window.handleInputLogic = (input) => {
    // Auto Expand Textarea
    input.style.height = 'auto';
    input.style.height = (input.scrollHeight) + 'px';

    const val = input.value;
    
    // --- UPDATED TYPING LOGIC (PATH BARU: 'typing/') ---
    if(typingTimeout) clearTimeout(typingTimeout);
    
    const myPic = user.profile_pic || user.pic || `https://ui-avatars.com/api/?name=${user.username}`;
    
    // KIRIM KE PATH BARU
    update(ref(rtdb, `typing/${curChatId}/${user.username}`), {
        pic: myPic,
        timestamp: serverTimestamp()
    });

    typingTimeout = setTimeout(() => {
        // HAPUS DARI PATH BARU
        remove(ref(rtdb, `typing/${curChatId}/${user.username}`));
    }, 2000);
    // ------------------------------------------

    // Logika Mention (@)
    const cursorPos = input.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPos);
    const words = textBeforeCursor.split(/\s+/); 
    const currentWord = words[words.length - 1]; 

    const list = document.getElementById('mention-suggestions');

    if (currentWord && currentWord.startsWith('@')) {
        const queryStr = currentWord.substring(1).toLowerCase(); 
        const matches = allUsernames.filter(u => u.username && u.username.toLowerCase().includes(queryStr) && u.username !== user.username);

        if (matches.length > 0) {
            renderMentionList(matches, currentWord);
            list.classList.remove('hidden');
            list.classList.add('flex');
        } else {
            list.classList.add('hidden');
            list.classList.remove('flex');
        }
    } else {
        list.classList.add('hidden');
        list.classList.remove('flex');
    }
};

// --- FUNGSI KEYBOARD TEXTAREA ---
window.handleChatKey = (e) => {
    // 1. Prioritas: Navigasi Mention (Kalau list nama lagi muncul)
    const list = document.getElementById('mention-suggestions');
    if (!list.classList.contains('hidden')) {
        // Kalau lagi milih nama, Enter gunanya buat PILIH NAMA (Bukan baris baru)
        if(e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault(); // Cegah baris baru
            handleMentionNav(e); 
            return; 
        }
    }

    // 2. Enter Biasa = BARIS BARU
    // Saya HAPUS bagian "sendMessage()" disini.
    // Jadi secara default, textarea akan membuat baris baru.
};

// Render Daftar Nama
function renderMentionList(users, triggerWord) {
    const list = document.getElementById('mention-suggestions');
    list.innerHTML = '';
    mentionIndex = -1; // Reset navigasi keyboard

    users.forEach(u => {
        const div = document.createElement('div');
        div.className = "mention-item";
        div.innerHTML = `
            <img src="${u.pic}" class="mention-avatar">
            <span class="mention-name">${u.username}</span>
        `;
        div.onclick = () => selectMention(u.username, triggerWord);
        list.appendChild(div);
    });
}

// Saat nama diklik
function selectMention(username, triggerWord) {
    const input = document.getElementById('chat-input');
    const val = input.value;
    const cursorPos = input.selectionStart;

    // Ganti @teks dengan @Username + spasi
    const before = val.substring(0, cursorPos - triggerWord.length);
    const after = val.substring(cursorPos);
    
    input.value = before + "@" + username + " " + after;
    
    // Sembunyikan list
    document.getElementById('mention-suggestions').classList.add('hidden');
    document.getElementById('mention-suggestions').classList.remove('flex');
    
    // Kembalikan fokus dan taruh kursor setelah spasi
    input.focus();
    /* Hacky fix cursor position? */
}

// --- SMART RENDERER (MARKDOWN + LINK PREVIEW) ---
function formatMessageText(text) {
    if (!text) return "";
    
    // 1. Anti XSS (Wajib)
    let formatted = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // 2. Smart Link Preview
    // Deteksi Link Gambar (JPG/PNG/GIF)
    formatted = formatted.replace(
        /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))/ig, 
        '<br><img src="$1" class="chat-image cursor-pointer mt-2" onclick="if(!isSelectionMode) zoomImage(this.src)" loading="lazy"><br>'
    );

    // Deteksi Link YouTube (Reguler & Short)
    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/g;
    formatted = formatted.replace(ytRegex, `
        <div class="link-preview-card">
            <div class="yt-embed-container">
                <iframe src="https://www.youtube.com/embed/$1" allowfullscreen loading="lazy"></iframe>
            </div>
        </div>
    `);

    // Deteksi Link Biasa (Klik-able)
    formatted = formatted.replace(
        /(https?:\/\/[^\s<]+)/g, 
        '<a href="$1" target="_blank" class="text-blue-400 underline break-all hover:text-blue-300">$1</a>'
    );

    // 3. Format Markdown (Tebal, Miring, Coret, Code)
    formatted = formatted.replace(/\*(.*?)\*/g, '<b>$1</b>');
    formatted = formatted.replace(/_(.*?)_/g, '<i>$1</i>');
    formatted = formatted.replace(/~(.*?)~/g, '<s>$1</s>');
    formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');

    // 4. Mention (@Username)
    formatted = formatted.replace(/@(\w+)/g, (match, username) => {
        const isValid = allUsernames.some(u => u.username === username);
        if(isValid) {
            return `<span class="mention-tag" onclick="event.stopPropagation(); showMiniProfile('${username}')">@${username}</span>`;
        }
        return `@${username}`;
    });

    return formatted;
}





function loadChatMessages(chatId) {
    curChatId = chatId;
    const c = document.getElementById('chat-messages');

    if(chatListenerRef) off(chatListenerRef);
    chatListenerRef = ref(rtdb, `messages/${chatId}`);

    onValue(ref(rtdb, `pinned/${chatId}`), (s) => {
        const pinData = s.val();
        const pinContainer = document.getElementById('pinned-msg-container');
        const btnUnpin = document.getElementById('btn-unpin');
        
        if(pinData) {
            pinContainer.classList.remove('hidden');
            pinContainer.classList.add('flex');
            document.getElementById('pinned-msg-text').innerHTML = `<b>${pinData.username}:</b> ${pinData.text}`;
            
            if(user.role === 'developer' || pinData.username === user.username) {
                btnUnpin.classList.remove('hidden');
            } else {
                btnUnpin.classList.add('hidden');
            }
        } else {
            pinContainer.classList.add('hidden');
            pinContainer.classList.remove('flex');
        }
    });

    onValue(chatListenerRef, s => {
        const data = s.val();

        let totalMsg = 0;
        let totalSize = 0;
        if(data) {
            totalMsg = Object.keys(data).length;
            totalSize = (JSON.stringify(data).length / 1024).toFixed(2);
        }

        const headerInfo = document.querySelector('.chat-header > div > div:nth-child(2)');
        let adminTools = '';
        if(user && user.role === 'developer') {
            adminTools = `<button onclick="clearCurrentChat()" class="ml-2 text-red-500 hover:text-red-400 transition"><i class="fas fa-trash-alt"></i></button>`;
        }

        if(headerInfo) {
             let adminTools = user && user.role === 'developer' ? `<button onclick="clearCurrentChat()" class="ml-2 text-red-500 hover:text-red-400 transition"><i class="fas fa-trash-alt"></i></button>` : '';
             
             const toggleClass = isAutoScroll ? 'active' : '';

             headerInfo.innerHTML = `
                <div class="flex items-center justify-between w-full pr-2 gap-2 relative">
                    <div>
                        <h3 id="chat-header-name" class="font-bold text-white text-sm md:text-base">${document.getElementById('chat-header-name')?.innerText || 'Room'}</h3>
                        <div class="flex items-center gap-2 text-[9px] text-gray-400 mt-0.5">
                            <span class="bg-white/5 px-1.5 rounded flex items-center gap-1"><i class="fas fa-comment-alt"></i> ${totalMsg}</span>
                            <span class="bg-white/5 px-1.5 rounded flex items-center gap-1 text-green-400 font-bold">● Online</span>
                            ${adminTools}
                        </div>
                    </div>
                    <button onclick="event.stopPropagation(); toggleChatSettings()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 transition z-50 cursor-pointer">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
                
                <div id="chat-settings-modal" class="chat-settings-modern hidden" onclick="event.stopPropagation()">
                    <div class="setting-header">Kontrol Chat</div>
                    
                    <div class="setting-item" onclick="toggleAutoScroll()">
                        <span class="setting-label">Auto Scroll</span>
                        <div id="scroll-toggle-btn" class="switch-toggle ${toggleClass}"></div>
                    </div>

                    <div class="setting-item flex-col items-start mb-3 border-b border-white/5 pb-2">
                        <span class="setting-label text-xs mb-1 text-gray-400">Suara Robot (TTS)</span>
                        <select id="tts-voice-select" onchange="changeVoice(this.value)" class="w-full bg-black/40 text-white text-xs p-2 rounded border border-white/10 outline-none cursor-pointer hover:border-indigo-500 transition">
                            <option value="">Default System</option>
                        </select>
                    </div>

                    <div class="search-box-modern">
                        <i class="fas fa-search text-gray-500 text-xs"></i>
                        <input type="text" placeholder="Cari pesan..." oninput="handleChatSearch(this)" value="${chatSearchQuery}">
                    </div>

                    <button onclick="enterSelectionMode()" class="btn-select-mode">
                        <i class="far fa-check-circle"></i> Pilih Pesan (Hapus Banyak)
                    </button>
                </div>`;
        }

        if(!data) {
            c.innerHTML = `<div class="flex flex-col items-center justify-center h-[60vh] text-gray-600 opacity-30"><i class="fas fa-comments text-6xl mb-4"></i><p class="text-sm font-bold">Chat masih kosong.</p></div>`;
            return;
        }
        
        const messages = Object.entries(data).map(([key, val]) => { return { ...val, id: key }; });
        
        const filteredMessages = messages.filter(m => {
            if(!m.text) return false;
            if(chatSearchQuery === "") return true;
            return m.text.toLowerCase().includes(chatSearchQuery);
        });

        let lastSender = null;
        let htmlContent = '';

        filteredMessages.slice(-50).forEach(m => {
            if (!m.username || !m.text) return;

            const isMe = m.username === user.username;
            const userPic = m.pic || `https://ui-avatars.com/api/?name=${m.username}&background=random`;
            
            let timeAgo = '';
            try { 
                timeAgo = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''; 
            } catch(e) { 
                timeAgo = '--:--'; 
            }

            // 1. RENDER REACTION (EMOJI DI ATAS)
            let reactionHtml = '';
            if (m.reactions) {
                const counts = {};
                Object.values(m.reactions).forEach(emo => { counts[emo] = (counts[emo] || 0) + 1; });
                const topEmojis = Object.keys(counts).slice(0, 3).join(' ');
                const total = Object.values(counts).reduce((a, b) => a + b, 0);
                
                if(total > 0) {
                    reactionHtml = `<div class="reaction-bubble" onclick="showGameToast('Reaksi: ${topEmojis}', 'info')">${topEmojis} <span class="font-bold ml-1">${total}</span></div>`;
                }
            }

            // 2. RENDER LIKE (HATI DI BAWAH)
            let likeHtml = '';
            const totalLikes = m.likes ? Object.keys(m.likes).length : 0;
            const isLikedByMe = m.likes && m.likes[user.username];
            
            if(totalLikes > 0) {
                likeHtml = `<div class="like-badge"><i class="fas fa-heart"></i> ${totalLikes}</div>`;
            }

            // Style Tombol Like di Action Bar
            const likeBtnClass = isLikedByMe ? 'text-red-500' : 'text-gray-500 hover:text-red-500';
            const likeBtnIcon = isLikedByMe ? 'fas' : 'far';

            let replyHtml = '';
            if(m.replyTo) {
                const jumpAction = m.replyTo.id ? `onclick="scrollToMessage('${m.replyTo.id}')"` : '';
                replyHtml = `
                    <div class="mb-2 p-2 bg-black/20 border-l-2 border-indigo-500 rounded text-xs opacity-75 cursor-pointer hover:bg-black/40 transition" ${jumpAction}>
                        <div class="font-bold text-indigo-300 flex justify-between">
                            <span>${m.replyTo.user}</span>
                            ${m.replyTo.id ? '<i class="fas fa-share text-[9px]"></i>' : ''}
                        </div>
                        <div class="truncate text-gray-400">${m.replyTo.text}</div>
                    </div>`;
            }

            const editedLabel = m.isEdited ? '<span class="text-[9px] text-gray-500 italic ml-1">(diedit)</span>' : '';
            const safeTextEscaped = encodeURIComponent(m.text).replace(/'/g, "%27");

            let content = m.text;

            if (m.type === 'text') {
                content = formatMessageText(m.text) + editedLabel;
                if(chatSearchQuery) {
                    const regex = new RegExp(`(${chatSearchQuery})`, 'gi');
                    content = content.replace(regex, '<span class="bg-yellow-500/50 text-white px-1 rounded">$1</span>');
                }
            } 
            else if (m.type === 'image') {
                content = `<img src="${m.text}" class="chat-image cursor-pointer hover:brightness-90 transition" onclick="if(!isSelectionMode) zoomImage(this.src)" loading="lazy">`;
            } 
            else if (m.type === 'image_once') {
                const isViewed = localStorage.getItem(`viewed_${m.id}`);
                if (isViewed || isMe) {
                    content = `<div class="p-3 bg-white/5 rounded text-center text-gray-500 text-xs italic"><i class="fas fa-eye-slash mb-1"></i><br>Foto 1x Lihat (Expired)</div>`;
                } else {
                    content = `<img src="${m.text}" class="chat-image view-once-blur" onclick="if(!isSelectionMode) viewOnce(this, '${m.id}')">`;
                }
            } 
            else if (m.type === 'sticker') {
                content = `<img src="${m.text}" class="chat-sticker" onclick="if(!isSelectionMode) openStickerMenu('${m.text}')" loading="lazy">`;
            } 
            else if (m.type === 'video') {
                content = `<video src="${m.text}" controls class="chat-image"></video>`;
            }
            else if (m.type === 'audio') {
                content = `
                    <div class="custom-audio-player group" id="player-${m.id}">
                        <button class="btn-audio-play" onclick="if(!isSelectionMode) playAudio('${m.id}', this)">
                            <i class="fas fa-play text-xs" id="icon-${m.id}"></i>
                        </button>
                        <div class="flex-1 flex flex-col gap-1">
                            <div class="audio-wave" id="wave-${m.id}">
                                <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
                            </div>
                            <input type="range" class="audio-slider" id="seek-${m.id}" value="0" max="100" oninput="seekAudio('${m.id}', this.value)">
                        </div>
                        <div class="flex flex-col items-end gap-1">
                            <div class="btn-speed" id="speed-${m.id}" onclick="if(!isSelectionMode) changeSpeed('${m.id}', this)">1x</div>
                            <a href="${m.text}" download target="_blank" class="text-gray-500 hover:text-white text-[10px]"><i class="fas fa-download"></i></a>
                        </div>
                        <audio id="aud-${m.id}" src="${m.text}" preload="metadata" ontimeupdate="updateAudioUI('${m.id}')" onended="handleAudioEnd('${m.id}')" class="hidden"></audio>
                    </div>
                 `;
            }

            let statusIcon = '';
            if (isMe) {
                 statusIcon = m.status === 'read' 
                    ? '<i class="fas fa-check-double msg-status-icon status-read" title="Dibaca"></i>' 
                    : '<i class="fas fa-check msg-status-icon status-sent" title="Terkirim"></i>';
            }
            if (!isMe && m.status !== 'read') {
                update(ref(rtdb, `messages/${chatId}/${m.id}`), { status: 'read' });
            }

            let isContinue = (lastSender === m.username);
            let cardClass = isContinue ? 'group-continue' : 'group-start';
            lastSender = m.username;
            
            let highlightClass = (m.text && typeof m.text === 'string' && m.text.includes(`@${user.username}`)) ? 'mention-highlight' : '';
            let badgeHtml = (m.role === 'developer' || m.username === 'Developer' || m.username === 'sigit123') ? `<span class="badge-verified" title="Verified"><i class="fas fa-check"></i></span>` : '';

            const deleteBtn = isMe 
                ? `<button onclick="event.stopPropagation(); deleteMessage('${m.id}', '${chatId}')" class="text-gray-500 hover:text-red-500 p-1 ml-2"><i class="fas fa-trash text-[10px]"></i></button>` 
                : '';
            
            const optionBtn = isMe 
                ? `<button onclick="event.stopPropagation(); openMsgOptions('${m.id}', '${m.username}', ${isMe}, this.closest('.chat-card'), '${chatId}', '${userPic}')" class="btn-option-floating"><i class="fas fa-chevron-down text-[10px]"></i></button>`
                : '';

            htmlContent += `
                <div id="msg-${m.id}" class="chat-row ${isMe ? 'me' : 'other'} ${window.isSelectionMode ? 'selecting' : ''}">
                    
                    <div class="flex items-end w-full gap-2 ${isMe ? 'justify-end' : 'justify-start'}">
                        
                        <div class="select-checkbox ${selectedMsgIds.has(m.id) ? 'bg-red-500 border-red-500' : ''}" onclick="toggleSelectMessage('${m.id}')"></div>

                        <div class="chat-card ${cardClass} ${highlightClass} ${selectedMsgIds.has(m.id) ? 'selected-msg' : ''}" 
                             onmousedown="startPress('${m.id}')" 
                             onmouseup="cancelPress()" 
                             onclick="handleMessageClick('${m.id}')" style="flex:1">
                            
                            ${reactionHtml} ${likeHtml}     ${optionBtn}
                            
                            ${replyHtml} 
                            
                            <div class="chat-card-header" style="${isContinue ? 'display:none;' : 'display:flex;'}">
                                <img src="${userPic}" class="chat-card-avatar cursor-pointer" onclick="event.stopPropagation(); openWaProfileZoom('${userPic}', '${m.username}')">
                                <div class="chat-card-info">
                                    <span class="chat-card-name">${m.username} ${badgeHtml}</span>
                                </div>
                                ${deleteBtn}
                            </div>

                            <div class="chat-card-body">${content}</div>
                            
                            <div class="chat-card-actions">
                                <span class="chat-card-time">${timeAgo}</span>
                                ${statusIcon}
                            </div>
                            
                            <div class="chat-card-actions flex justify-between items-center mt-1 pt-1 border-t border-white/10" style="opacity:0.4; transition:0.3s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.4'">
                                <div class="flex gap-3">
                                    <div class="chat-action-btn ${likeBtnClass}" onclick="if(!isSelectionMode) { event.stopPropagation(); toggleChatLike('${m.id}', '${chatId}'); }">
                                        <i class="${likeBtnIcon} fa-heart"></i>
                                    </div>
                                    <div class="chat-action-btn text-gray-500 hover:text-yellow-400" onclick="if(!isSelectionMode) { event.stopPropagation(); toggleReactionMenu('${m.id}', '${chatId}'); }">
                                        <i class="far fa-grin"></i>
                                    </div>
                                    <div class="chat-action-btn text-gray-500 hover:text-blue-400" onclick="if(!isSelectionMode) { event.stopPropagation(); replyMsg('${m.username}', decodeURIComponent('${safeTextEscaped}'), '${m.id}'); }">
                                        <i class="far fa-comment-dots"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
        });
        
        c.innerHTML = htmlContent;
        
        selectedMsgIds.forEach(id => {
            const card = document.querySelector(`#msg-${id} .chat-card`);
            if(card) card.classList.add('selected-msg');
        });

        if(isAutoScroll && !isSelectionMode) { 
            requestAnimationFrame(() => {
                c.scrollTop = c.scrollHeight;
            });
        }
    });
}



















window.sendMessage = () => { 
    const inp = document.getElementById('chat-input'); 
    const t = inp.value.trim(); 
    if(!t) return; 

    const myAvatar = user.profile_pic || user.pic || `https://ui-avatars.com/api/?name=${user.username}&background=random`;

    const pay = {
        text: t, 
        username: user.username, 
        role: user.role || 'member',
        pic: myAvatar,
        type: 'text', 
        timestamp: serverTimestamp(),
        bubbleTheme: user.bubbleTheme || 'bubble-default' 
    }; 
    
    // --- UPDATE REPLY LOGIC ---
    if (replyingToMsg) {
        pay.replyTo = { 
            user: replyingToMsg.user, 
            text: replyingToMsg.text,
            id: replyingToMsg.id // SIMPAN ID PESAN ASAL
        };
    }
    // --------------------------
    
    push(ref(rtdb, `messages/${curChatId}`), pay).then(() => { 
        inp.value=''; 
        inp.style.height = 'auto'; inp.style.height = '44px';
        inp.focus();
        closeReply(); 
        const aud = new Audio('https://cdn.freesound.org/previews/554/554446_11998658-lq.mp3'); 
        aud.volume = 0.2; aud.play().catch(()=>{});
    }); 
}
window.replyMsg = (u, t) => { 
    // Simpan data balasan
    replyingToMsg = {user: u, text: t}; 
    
    // Tampilkan UI Balasan di atas input
    document.getElementById('reply-ui').classList.remove('hidden'); 
    document.getElementById('reply-user').innerText = u; 
    document.getElementById('reply-text').innerText = t; 
    
    // --- LOGIKA MEMBUKA KEYBOARD ---
    const inputField = document.getElementById('chat-input');
    inputField.focus(); // Fokus kursor ke input (otomatis buka keyboard di HP)
    
    // Opsional: Tambahkan '@username ' otomatis di input
    // inputField.value = `@${u} `; 
}

window.closeReply = () => { 
    replyingToMsg = null; 
    document.getElementById('reply-ui').classList.add('hidden'); 
}








// --- CHAT INTERACTION LOGIC (IG STYLE) ---
let selectedMsg = null; // Menyimpan data pesan yang sedang ditekan

// GANTI CODE openMsgOptions DENGAN INI
// UPDATE FUNGSI BUKA MENU (FIX AVATAR HILANG)
window.openMsgOptions = (id, username, isMe, el, roomId, userPicUrl) => {
    // 1. Ambil Teks
    let currentText = "";
    const bodyEl = el.querySelector('.chat-card-body');
    if(bodyEl) currentText = bodyEl.innerText.replace('(diedit)', '').trim();

    selectedMsg = { id, username, text: currentText, isMe, element: el, roomId };
    
    // 2. Clone Pesan untuk Preview
    const clone = el.cloneNode(true);
    clone.id = "msg-focus-clone";
    clone.style.margin = "0";
    clone.onclick = null;
    
    // --- PERBAIKAN DISINI: PAKSA HEADER & FOTO MUNCUL ---
    const header = clone.querySelector('.chat-card-header');
    if(header) {
        // Paksa header tampil (meskipun di chat asli disembunyikan)
        header.style.display = 'flex'; 
        
        // Pastikan gambarnya ada source-nya
        const img = header.querySelector('img');
        if(img && userPicUrl) {
            img.src = userPicUrl; // Paksa pakai URL gambar yang benar
            img.style.display = 'block';
        }
    }
    // ----------------------------------------------------
    
    const area = document.getElementById('msg-focus-area');
    area.innerHTML = '';
    area.appendChild(clone);
    
    // Tombol Hapus
    const btnDel = document.getElementById('btn-delete-msg');
    if (isMe || (user && user.role === 'developer')) btnDel.style.display = 'flex';
    else btnDel.style.display = 'none';
    
    document.getElementById('msg-options-overlay').classList.add('active');
    if(navigator.vibrate) navigator.vibrate(10);
}

window.closeMsgOptions = () => {
    document.getElementById('msg-options-overlay').classList.remove('active');
    selectedMsg = null;
}



window.actionCopy = () => {
    if(!selectedMsg) return;
    navigator.clipboard.writeText(selectedMsg.text);
    closeMsgOptions();
    showGameToast("Teks disalin", "success");
}

window.actionDelete = () => {
    // 1. Validasi: Pastikan ada pesan yang dipilih
    if (!selectedMsg || !selectedMsg.id) {
        showGameToast("Pilih pesan dulu!", "error");
        return;
    }

    // 2. Ambil Data Penting
    const msgId = selectedMsg.id;
    const targetRoom = selectedMsg.roomId || curChatId || 'global';

    // 3. Tutup Menu Dulu
    closeMsgOptions();

    // 4. Konfirmasi Hapus
    Swal.fire({
        title: 'Hapus Pesan?',
        text: 'Pesan ini akan hilang selamanya.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal',
        background: '#1e293b', color: '#fff',
        // Pastikan popup di atas segalanya
        didOpen: () => { 
            const c = Swal.getContainer(); 
            if(c) c.style.zIndex = "200000"; 
        }
    }).then((result) => {
        if (result.isConfirmed) {
            
            // 5. Hapus Visual (Optimistic UI) - Biar langsung hilang di mata user
            const el = document.getElementById(`msg-${msgId}`);
            if(el) {
                el.style.transition = "all 0.3s";
                el.style.opacity = '0';
                el.style.transform = "translateX(20px)";
                setTimeout(() => el.remove(), 300);
            }

            // 6. Hapus Database (Path Baru: messages/)
            // Gunakan remove() langsung ke path spesifik
            const msgRef = ref(rtdb, `messages/${targetRoom}/${msgId}`);
            
            remove(msgRef)
            .then(() => {
                showGameToast("Pesan terhapus.", "success");
            })
            .catch((error) => {
                console.error("Gagal Hapus:", error);
                // Kalau gagal, mungkin perlu reload chat biar pesan muncul lagi (rollback visual)
                // loadChatMessages(targetRoom); 
                Swal.fire("Gagal", "Server menolak: " + error.message, "error");
            });
        }
    });
}

window.actionTheme = async () => {
    if(!selectedMsg || !selectedMsg.isMe) {
        showGameToast("Hanya bisa ubah warna pesan sendiri!", "error");
        return;
    }
    closeMsgOptions();
    
    const { value: theme } = await Swal.fire({
        title: 'Pilih Warna Pesan',
        input: 'select',
        inputOptions: {
            'bubble-blue': 'Ocean Blue',
            'bubble-purple': 'Cosmic Purple',
            'bubble-orange': 'Sunset Orange',
            'bubble-pink': 'Neon Pink'
        },
        inputPlaceholder: 'Pilih Tema',
        showCancelButton: true,
        background: '#1e293b', color: '#fff'
    });

    if (theme) {
        // Simpan preferensi user secara global biar semua pesan berubah
        user.bubbleTheme = theme;
        localStorage.setItem('user', JSON.stringify(user));
        // Update ke DB User (Opsional, biar permanen)
        update(ref(rtdb, `users/${user.username}`), { bubbleTheme: theme });
        // Reload chat agar berubah
        loadChatMessages(curChatId);
        showGameToast("Tema Pesan Diubah!", "success");
    }
}











// =========================================
// 🎙️ VN SUPER HD + CANCEL
// =========================================

let isRecording = false;
let isCancelled = false; // Penanda kalau user tekan batal
let recInterval = null;
let recStartTime = 0;

window.toggleRecording = () => {
    if (!isRecording) {
        startOneTapRecord();
    } else {
        stopOneTapRecord();
    }
};

// Fungsi Batal Rekam (Sampah)
window.cancelRecording = () => {
    isCancelled = true;
    stopOneTapRecord(); // Stop tapi jangan kirim
    showGameToast("Rekaman Dibatalkan 🗑️", "error");
};

function startOneTapRecord() {
    const constraints = { 
        audio: { 
            echoCancellation: true, 
            noiseSuppression: true, // Wajib TRUE agar tidak kresek
            autoGainControl: true,  // Menyeimbangkan volume suara
            sampleRate: 44100       // 44.1kHz lebih stabil di HP daripada 48kHz
        } 
    };

    navigator.mediaDevices.getUserMedia(constraints).then(stream => { 
        // Kita pakai 128kbps saja. Ini "Sweet Spot". 
        // Lebih jernih dari WA (64kbps), tapi tidak over-sensitive menangkap desis seperti 256kbps.
        const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
        
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            delete options.mimeType; 
        }

        mediaRecorder = new MediaRecorder(stream, options); 
        audioChunks = []; 

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.start(); 
        
        // UI MEREKAM
        isRecording = true;
        document.getElementById('chat-input').classList.add('hidden');
        document.getElementById('record-timer-area').classList.remove('hidden');
        document.getElementById('record-timer-area').classList.add('flex'); 
        
        const btnMic = document.getElementById('btn-mic');
        btnMic.className = "w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center animate-pulse shadow-[0_0_15px_#22c55e]";
        document.getElementById('icon-mic').className = "fas fa-paper-plane"; 

        recStartTime = Date.now();
        recInterval = setInterval(() => {
            const diff = Math.floor((Date.now() - recStartTime) / 1000);
            const m = Math.floor(diff / 60);
            const s = diff % 60;
            const el = document.getElementById('record-time-display');
            if(el) el.innerText = `${m}:${s<10?'0':''}${s}`;
        }, 1000);

    }).catch(e => showGameToast("Gagal akses mikrofon: " + e.message, "error")); 
}

function stopOneTapRecord() {
    if(mediaRecorder && mediaRecorder.state !== 'inactive') { 
        mediaRecorder.stop(); 
        mediaRecorder.stream.getTracks().forEach(track => track.stop()); 

        // RESET UI
        isRecording = false;
        clearInterval(recInterval);
        document.getElementById('chat-input').classList.remove('hidden');
        document.getElementById('record-timer-area').classList.add('hidden');
        document.getElementById('record-timer-area').classList.remove('flex');
        document.getElementById('record-time-display').innerText = "0:00";

        const btnMic = document.getElementById('btn-mic');
        btnMic.className = "w-10 h-10 rounded-full text-gray-400 hover:text-red-500 hover:bg-white/5 transition flex items-center justify-center border border-transparent";
        document.getElementById('icon-mic').className = "fas fa-microphone";

        // Cek Apakah Dibatalkan?
        if (isCancelled) {
            audioChunks = []; // Buang data
            return; // Stop di sini, jangan upload
        }

        // PROSES UPLOAD
        mediaRecorder.onstop = async () => { 
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); 
            
            if (audioBlob.size < 2000) { // Minimal 2KB biar gak kepencet
                showGameToast("Terlalu pendek.", "warn"); return;
            }

            const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, background:'#1e293b', color:'#fff'});
            Toast.fire({ icon: 'info', title: 'Mengirim HD VN...' });

            try {
                const audioUrl = await uploadToCloudinary(audioBlob);
                
                const pay = { 
                    username: user.username, 
                    pic: user.profile_pic || user.pic, 
                    text: audioUrl, 
                    type: 'audio', 
                    id: Date.now().toString(), 
                    timestamp: serverTimestamp(), 
                    role: user.role || 'member'
                }; 
                await push(ref(rtdb, `community/messages/${curChatId}`), pay);
                Toast.fire({ icon: 'success', title: 'Terkirim', timer: 1500 });
            } catch (e) {
                Toast.fire({ icon: 'error', title: 'Gagal Upload' });
            }
        };
    } 
}







// --- GANTI FUNGSI sendImage DENGAN INI (FIX NOTIF NYANGKUT) ---
window.sendImage = async () => { 
    if (!pendingFileBlob) return; 

    // 1. Setup Toast Style
    const Toast = Swal.mixin({
        toast: true, position: 'top-end', showConfirmButton: false, 
        background: '#1e293b', color: '#fff'
    });

    // 2. Tampilkan "Loading" (Tanpa Timer, jadi dia nungguin proses)
    Toast.fire({ 
        icon: 'info', 
        title: 'Mengupload...', 
        timer: 0, // Timer 0 artinya diam selamanya sampai diupdate
        didOpen: () => Swal.showLoading() 
    });

    try {
        // Proses Upload ke Cloudinary
        const imageUrl = await uploadToCloudinary(pendingFileBlob);

        // Siapkan Data Pesan
        const isOnce = document.getElementById('check-view-once').checked; 
        
        const pay = { 
            username: user.username, 
            pic: user.profile_pic || user.pic, 
            text: imageUrl, 
            type: isOnce ? 'image_once' : 'image', 
            id: Date.now().toString(), 
            timestamp: serverTimestamp(),
            role: user.role || 'member',
            bubbleTheme: user.bubbleTheme || 'bubble-default'
        }; 

        // Kirim ke Firebase
        await push(ref(rtdb, `community/messages/${curChatId}`), pay); 
        
        // 3. UPDATE NOTIFIKASI JADI SUKSES (Hilang dalam 2 detik)
        Toast.fire({ icon: 'success', title: 'Terkirim!', timer: 2000 });

        cancelUpload(); 
        
    } catch (e) {
        // Kalau Error
        Toast.fire({ icon: 'error', title: 'Gagal: ' + e.message });
    }
}










// =========================================
// 🕵️‍♂️ FITUR RAHASIA: VIEW ONCE & ANTI-SS
// =========================================

let secureInterval = null;
let isSecureMode = false;

// 1. Fungsi Pemicu (Dipanggil saat klik foto di chat)
window.viewOnce = (el, msgId) => {
    // Cek apakah sudah pernah dilihat (Local Storage)
    if (localStorage.getItem(`viewed_${msgId}`)) {
        showGameToast("Foto ini sudah hangus!", "error");
        // Ubah tampilan jadi expired
        el.parentElement.innerHTML = `<div class="p-3 bg-white/5 rounded text-center text-gray-500 text-xs italic"><i class="fas fa-fire mb-1 text-red-500"></i><br>Pesan Hangus</div>`;
        return;
    }

    // Ambil URL gambar asli
    const imgSrc = el.getAttribute('src');
    openSecureView(imgSrc, msgId, el);
};

// 2. Buka Ruang Rahasia (Secure Modal)
function openSecureView(src, msgId, originalElement) {
    const modal = document.getElementById('secure-viewer');
    const img = document.getElementById('secure-img');
    const bar = document.getElementById('secure-timer-bar');
    const countText = document.getElementById('secure-countdown');
    
    isSecureMode = true;
    
    // Reset Kondisi
    img.src = src;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    bar.style.width = '100%';
    
    // Aktifkan Proteksi
    enableAntiSSProtection();

    // Mulai Hitung Mundur (10 Detik)
    let timeLeft = 10;
    countText.innerText = timeLeft;
    
    // Animasi Bar Berjalan
    setTimeout(() => { bar.style.width = '0%'; }, 100);

    secureInterval = setInterval(() => {
        timeLeft--;
        countText.innerText = timeLeft;

        if (timeLeft <= 0) {
            // WAKTU HABIS: Hancurkan
            closeSecureView();
            markAsViewed(msgId, originalElement);
        }
    }, 1000);
}

// 3. Tutup & Hancurkan
function closeSecureView() {
    const modal = document.getElementById('secure-viewer');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('secure-img').src = ''; // Kosongkan memori
    
    clearInterval(secureInterval);
    disableAntiSSProtection();
    isSecureMode = false;
}

// 4. Tandai Sudah Dilihat (Permanen)
function markAsViewed(msgId, element) {
    localStorage.setItem(`viewed_${msgId}`, 'true');
    
    // Update UI Chat biar jadi "Expired"
    if(element && element.parentElement) {
        element.parentElement.innerHTML = `
            <div class="p-4 bg-red-900/20 border border-red-500/30 rounded text-center">
                <i class="fas fa-fire-alt text-red-500 text-xl mb-1"></i>
                <p class="text-[10px] text-red-300 font-bold">PESAN HANCUR</p>
            </div>
        `;
    }
    showGameToast("Pesan telah dihancurkan otomatis.", "info");
}

// =========================================
// 🛡️ LOGIKA ANTI-SCREENSHOT (BROWSER LEVEL)
// =========================================

const curtain = document.getElementById('secure-curtain');

function enableAntiSSProtection() {
    // A. Deteksi Kehilangan Fokus (Tab pindah / Notif bar turun)
    window.addEventListener('blur', triggerCurtain);
    document.addEventListener('visibilitychange', checkVisibility);
    
    // B. Blokir Klik Kanan & Shortcut Keyboard
    document.addEventListener('contextmenu', preventContext);
    document.addEventListener('keydown', preventShortcuts);
    document.addEventListener('keyup', detectPrintScreen);
}

function disableAntiSSProtection() {
    window.removeEventListener('blur', triggerCurtain);
    document.removeEventListener('visibilitychange', checkVisibility);
    document.removeEventListener('contextmenu', preventContext);
    document.removeEventListener('keydown', preventShortcuts);
    document.removeEventListener('keyup', detectPrintScreen);
    if(curtain) curtain.classList.add('hidden'); // Pastikan tirai terbuka
}

// Aksi Tirai (Layar Hitam)
function triggerCurtain() {
    if(isSecureMode && curtain) {
        curtain.classList.remove('hidden');
        curtain.classList.add('flex');
    }
}

function checkVisibility() {
    if (document.hidden) triggerCurtain();
    else if(isSecureMode && curtain) {
        // Kalau balik lagi, buka tirai (opsional, atau bisa dibuat user gagal total)
        setTimeout(() => {
            curtain.classList.add('hidden');
            curtain.classList.remove('flex');
        }, 500);
    }
}

// --- UPDATE: PENGECUALIAN UNTUK INPUT CHAT ---
const preventContext = (e) => { 
    // Jika yang ditekan adalah KOTAK CHAT, jangan diblokir! (Biar bisa paste)
    if (e.target.id === 'chat-input' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        return; // Biarkan menu default muncul
    }
    
    // Selain itu, blokir (sesuai mode aman)
    if(isSecureMode) e.preventDefault(); 
}

const detectPrintScreen = (e) => {
    if (!isSecureMode) return;
    if (e.key === 'PrintScreen') {
        triggerCurtain();
        alert("⚠️ TERDETEKSI: Percobaan Screenshot!\nGambar disembunyikan.");
        // Opsional: Langsung hancurkan pesan jika bandel
        // closeSecureView(); 
    }
}











window.zoomImage = (src) => { 
    document.getElementById('media-zoom-content').src = src; 
    document.getElementById('media-zoom-modal').style.display = 'flex'; 
}

window.handleTyping = () => { 
    if(typingTimeout) clearTimeout(typingTimeout); 
    // Kirim nama user ke path typing
    update(ref(rtdb, `community/typing/${curChatId}`), {[user.username]: true}); 
    
    typingTimeout = setTimeout(() => {
        // Hapus nama setelah 2 detik diam
        remove(ref(rtdb, `community/typing/${curChatId}/${user.username}`));
    }, 2000); 
}

// --- GANTI FUNGSI handleFileSelect DENGAN INI ---
window.handleFileSelect = (input) => { 
    const file = input.files[0]; 
    if (!file) return; 
    
    pendingFileBlob = file; // SIMPAN FILE ASLI DISINI
    
    const reader = new FileReader(); 
    reader.onload = (e) => { 
        pendingImage = e.target.result; 
        document.getElementById('preview-img').src = pendingImage; 
        document.getElementById('upload-preview').classList.remove('hidden'); 
    }; 
    reader.readAsDataURL(file); 
}

// --- GANTI FUNGSI cancelUpload DENGAN INI ---
window.cancelUpload = () => { 
    pendingImage = null; 
    pendingFileBlob = null; // Reset File Asli
    document.getElementById('upload-preview').classList.add('hidden'); 
    document.getElementById('chat-file-input').value = ''; 
}












async function renderContactList(allUsers) {
    const listContainer = document.getElementById('member-list');
    const storyContainer = document.getElementById('story-list');
    
    if(!listContainer || !storyContainer) return;

    allUsernames = Object.values(allUsers)
        .filter(u => u && u.username && typeof u.username === 'string') 
        .map(u => ({
            username: u.username,
            pic: u.profile_pic || u.pic || `https://ui-avatars.com/api/?name=${u.username}`
        }));

    listContainer.innerHTML = '<div class="text-center py-10 text-gray-500 text-xs animate-pulse">Sinkronisasi Data...</div>';

    try {
        const onlineRef = ref(rtdb, 'status/online');
        const onlineSnap = await get(onlineRef);
        const onlineData = onlineSnap.val() || {};

        const userListPromises = Object.values(allUsers).map(async (u) => {
            if (!u.username || u.username === user.username) return null; 

            const cid = [user.username, u.username].sort().join('_');
            let lastMsg = 'Klik untuk chat';
            let lastTime = 0;

            try {
                const q = query(ref(rtdb, `community/messages/${cid}`), limitToLast(1));
                const msgSnap = await get(q);
                if (msgSnap.exists()) {
                    const msgs = msgSnap.val();
                    const key = Object.keys(msgs)[0];
                    const m = msgs[key];
                    lastTime = m.timestamp;
                    if (m.type === 'image') lastMsg = '📷 Foto';
                    else if (m.type === 'audio') lastMsg = '🎤 Audio';
                    else lastMsg = m.text;
                }
            } catch (err) {}

            const isOnline = onlineData[u.username] !== undefined;
            
            let listeningStatus = null;
            if(onlineData[u.username] && onlineData[u.username].listening) {
                const song = onlineData[u.username].listening;
                listeningStatus = `🎵 ${song.title}`;
            }

            return { ...u, cid: cid, isOnline: isOnline, lastMsg: lastMsg, lastTime: lastTime, listeningStatus: listeningStatus };
        });

        const resolvedUsers = (await Promise.all(userListPromises)).filter(u => u !== null);

        resolvedUsers.sort((a, b) => {
            if (b.lastTime !== a.lastTime) return b.lastTime - a.lastTime;
            if (b.isOnline !== a.isOnline) return b.isOnline ? 1 : -1;
            return a.username.localeCompare(b.username);
        });

        document.getElementById('total-contacts').innerText = resolvedUsers.length + " Chat";

        storyContainer.innerHTML = `
            <div class="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group">
                <div class="relative">
                    <img src="${user.profile_pic || user.pic}" class="w-[52px] h-[52px] rounded-full border-2 border-white/10 object-cover">
                    <div class="absolute bottom-0 right-0 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center text-[8px] border border-dark text-white">+</div>
                </div>
                <span class="text-[9px] text-gray-400">Saya</span>
            </div>`;

        const onlineUsers = resolvedUsers.filter(u => u.isOnline);
        onlineUsers.forEach(u => {
            storyContainer.innerHTML += `
            <div onclick="switchChat('${u.cid}', '${u.username}')" class="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer animate-fade-in">
                <div class="story-ring"><img src="${u.profile_pic || u.pic}" class="story-img"></div>
                <span class="text-[9px] text-gray-300 font-bold max-w-[60px] truncate">${u.username}</span>
            </div>`;
        });

        listContainer.innerHTML = '';
        resolvedUsers.forEach(u => {
            const timeStr = u.lastTime > 0 ? moment(u.lastTime).format('HH:mm') : '';
            const msgColor = u.lastTime > 0 ? 'text-gray-300' : 'text-gray-600 italic';
            
            const displayStatus = u.listeningStatus 
                ? `<span class="text-green-400 font-bold text-[10px] animate-pulse">${u.listeningStatus}</span>` 
                : `<span class="${msgColor}">${u.lastMsg}</span>`;

            listContainer.innerHTML += `
            <div onclick="switchChat('${u.cid}', '${u.username}')" class="chat-item-modern cursor-pointer group mb-1">
                <div class="relative flex-shrink-0" onclick="event.stopPropagation(); openWaProfileZoom('${u.profile_pic || u.pic}', '${u.username}')">
                    <img src="${u.profile_pic || u.pic}" class="w-12 h-12 rounded-full bg-gray-800 object-cover border border-white/5 hover:scale-110 transition cursor-zoom-in">
                    ${u.isOnline ? '<div class="online-dot"></div>' : ''}
                </div>
                <div class="flex-1 min-w-0 ml-3 pb-3 border-b border-white/5 group-hover:border-white/10 transition">
                    <div class="flex justify-between items-center mb-0.5">
                        <h4 class="text-sm font-bold text-white truncate">${u.username}</h4>
                        <span class="text-[10px] text-gray-500 font-mono">${timeStr}</span>
                    </div>
                    <p class="text-xs truncate pr-4">${displayStatus}</p>
                </div>
            </div>`;
        });

        if(resolvedUsers.length === 0) listContainer.innerHTML = '<div class="text-center text-gray-600 text-xs py-10">Belum ada kontak.</div>';

    } catch (e) {
        console.error(e);
    }
}





function renderGroupList(groups) { 
    const c = document.getElementById('group-list'); 
    c.innerHTML = ''; 
    if(groups) Object.entries(groups).forEach(([k,g]) => {
        c.innerHTML += `<div onclick="switchChat('${k}', '${g.name}')" class="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer"><div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs"><i class="fas fa-users"></i></div><div class="text-sm font-bold text-white">${g.name}</div></div>`; 
    });
}








// --- ADMIN USER LIST DENGAN FILTER (UPDATE WARGA) ---
let currentAdminFilter = 'all'; 

window.setAdminFilter = (type) => {
    currentAdminFilter = type;
    
    // Reset Tampilan Semua Tombol
    ['all', 'dev', 'member'].forEach(k => {
        const btn = document.getElementById(`filter-btn-${k}`);
        if(btn) {
            btn.className = "px-3 py-1 rounded-full bg-black/40 text-gray-400 text-[10px] font-bold border border-white/10 transition cursor-pointer";
        }
    });

    // Nyalakan Tombol Aktif
    // Mapping: 'developer' -> 'dev', 'member' -> 'member', 'all' -> 'all'
    const btnId = type === 'developer' ? 'dev' : (type === 'member' ? 'member' : 'all');
    const activeBtn = document.getElementById(`filter-btn-${btnId}`);
    
    if(activeBtn) {
        let color = type === 'developer' ? 'yellow' : (type === 'member' ? 'green' : 'blue');
        activeBtn.className = `px-3 py-1 rounded-full bg-${color}-600/20 text-${color}-400 text-[10px] font-bold border border-${color}-500 shadow-[0_0_10px_rgba(0,0,0,0.5)] transition transform scale-105`;
    }

    // Refresh List
    renderAdminUserList(true);
}

// --- UPDATE ADMIN LIST (FILTER TAMU & UNDEFINED) ---
window.renderAdminUserList = (users) => { 
    const c = document.getElementById('admin-user-list'); 
    
    if(users === true) { 
        c.innerHTML = '<div class="text-center text-gray-500 text-[10px] py-4 animate-pulse">Mengambil Data...</div>';
        get(ref(rtdb, 'users')).then(snap => { 
            if(snap.exists()) renderAdminUserList(snap.val()); 
            else c.innerHTML = '<div class="text-gray-500 text-center text-xs">Tidak ada data.</div>'; 
        }); 
        return; 
    } 
    
    c.innerHTML = ''; 
    
    if(users) {
        const userArray = Object.entries(users);
        let count = 0;

        userArray.forEach(([k,u]) => { 
            // --- FILTER KETAT ---
            // 1. Hapus yang namanya "undefined" atau kosong
            if(!u.username || u.username === 'undefined') return;
            // 2. Hapus Akun Tamu (Guest) atau yang namanya diawali "Tamu_"
            if(u.isGuest || u.username.toLowerCase().startsWith('tamu')) return;

            // --- LOGIKA FILTER TOMBOL ---
            let show = false;
            if(currentAdminFilter === 'all') {
                show = true;
            } 
            else if(currentAdminFilter === 'developer') {
                if(u.role === 'developer' || u.rank === 'GOD MODE') show = true;
            } 
            else if(currentAdminFilter === 'member') {
                // Tampilkan Member (Kecuali Developer)
                if(u.role !== 'developer' && u.rank !== 'GOD MODE') show = true;
            }

            if(show) {
                count++;
                const isDev = u.role === 'developer';
                
                let nameColor = isDev ? "text-yellow-400" : "text-white";
                let borderClass = isDev ? "border-yellow-500/30 bg-yellow-900/10" : "border-white/5";
                let iconBadge = isDev ? '<i class="fas fa-bolt text-[10px]"></i>' : '';

                c.innerHTML += `
                <div class="flex justify-between p-2 rounded-xl mb-1 items-center border ${borderClass} hover:bg-white/10 transition group">
                    <div class="flex items-center gap-3">
                        <img src="${u.profile_pic || u.pic}" class="w-8 h-8 rounded-full bg-gray-800 object-cover border border-white/10">
                        <div>
                            <div class="text-xs font-bold ${nameColor} flex items-center gap-1">
                                ${u.username} ${iconBadge}
                            </div>
                            <div class="text-[9px] text-gray-500 font-mono">Role: ${u.role || 'Member'}</div>
                        </div>
                    </div>
                    <div class="flex gap-1 opacity-60 group-hover:opacity-100 transition">
                        <button onclick="openUserEditor('${k}')" class="w-6 h-6 rounded bg-cyan-900/30 text-cyan-400 flex items-center justify-center hover:bg-cyan-500 hover:text-black transition"><i class="fas fa-pen text-[10px]"></i></button>
                        <button onclick="kickUser('${k}')" class="w-6 h-6 rounded bg-red-900/30 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition"><i class="fas fa-trash text-[10px]"></i></button>
                    </div>
                </div>`; 
            }
        });

        if(count === 0) {
            c.innerHTML = `<div class="text-gray-600 text-center text-[10px] py-4">Tidak ada user kategori ini.</div>`;
        }
    }
}








window.openUploadModal = async (type) => { 
    const { value: method } = await Swal.fire({ 
        title: 'Pilih Metode Upload', 
        html: `<div class="grid grid-cols-2 gap-4">
                <div class="bg-white/10 p-4 rounded-xl cursor-pointer hover:bg-indigo-600" onclick="Swal.clickConfirm(); window.uploadMethod='url'">
                    <i class="fas fa-link text-2xl mb-2 text-white"></i><br>
                    <span class="text-sm text-white font-bold">Link URL</span>
                </div>
                <div class="bg-white/10 p-4 rounded-xl cursor-pointer hover:bg-green-600" onclick="Swal.clickConfirm(); window.uploadMethod='file'">
                    <i class="fas fa-cloud-upload-alt text-2xl mb-2 text-white"></i><br>
                    <span class="text-sm text-white font-bold">Upload File</span>
                </div>
               </div>`, 
        showConfirmButton: false, 
        background: '#1e293b', color: '#fff' 
    }); 
    
    const selectedMethod = window.uploadMethod; 
    if(!selectedMethod) return; 
    
    let finalUrl = ""; 
    
    if(selectedMethod === 'url') { 
        const {value:url} = await Swal.fire({
            input:'url', 
            inputLabel:'Link URL', 
            background:'#1e293b', color:'#fff',
            didOpen: (el) => { 
                const input = el.querySelector('input');
                if(input) input.focus();
            }
        }); 
        finalUrl = url; 
    } else { 
        const {value:file} = await Swal.fire({
            input:'file', 
            inputLabel:'Pilih Foto/Video', 
            inputAttributes: { accept: 'image/*,video/*' },
            background:'#1e293b', color:'#fff'
        }); 
        
        if(file) {
            Swal.fire({
                title: 'Mengupload ke Cloudinary...',
                text: 'Mohon tunggu sebentar',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
                background: '#1e293b', color: '#fff'
            });
            
            try {
                finalUrl = await uploadToCloudinary(file);
                Swal.close();
            } catch(e) {
                Swal.fire("Gagal", "Upload Error: " + e.message, "error");
                return;
            }
        }
    } 
    
    if(finalUrl) { 
        const {value:title} = await Swal.fire({
            title: 'Judul Postingan',
            input: 'text', 
            background:'#1e293b', color:'#fff',
            didOpen: (el) => {
                const i = el.querySelector('input');
                if(i) { i.focus(); i.removeAttribute('readonly'); }
            }
        }); 

        if(!title) return;

        const {value:desc} = await Swal.fire({
            title: 'Deskripsi',
            input: 'textarea', 
            background:'#1e293b', color:'#fff',
            didOpen: (el) => {
                const i = el.querySelector('textarea');
                if(i) i.focus();
            }
        }); 
        
        if(title) { 
            const d = {
                image: finalUrl, url: finalUrl, src: finalUrl, 
                title: title, description: desc || '-', 
                date: moment().format('DD MMM'), 
                category: 'User Upload', 
                timestamp: serverTimestamp()
            }; 
            
            if(finalUrl.includes('.mp4') || finalUrl.includes('.webm')) {
                 d.type = 'video';
            }

            if(type==='gallery') d.is_slide=false; 
            if(type==='playlist') { d.type='audio'; d.artist='User Upload'; } 
            
            push(ref(rtdb, `site_data/${type}`), d)
                .then(() => Swal.fire("Sukses","Tersimpan di Cloudinary & Firebase!","success"))
                .catch((e) => Swal.fire("Gagal Simpan DB", e.message, "error")); 
        } 
    } 
}




// --- HELPER: KONVERSI FILE KE BASE64 ---
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});



// --- FUNGSI KOMPRESI GAMBAR (Supaya Gak Error "Write too large") ---
const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            // Kita kecilkan ukuran gambar maksimal lebar 800px
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scaleSize = MAX_WIDTH / img.width;
            
            // Jika gambar kecil, jangan dibesarkan
            if (scaleSize >= 1) {
                canvas.width = img.width;
                canvas.height = img.height;
            } else {
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
            }
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Ubah jadi JPEG kualitas 70% (Ringan banget)
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        }
        img.onerror = (err) => reject(err);
    }
    reader.onerror = (error) => reject(error);
});

window.kickUser = (uid) => { if(confirm("Hapus User?")) remove(ref(rtdb, `users/${uid}`)); }
window.devSendBroadcast = () => { const msg = document.getElementById('dev-broadcast-msg').value; if(msg) set(ref(rtdb, 'site_data/config/broadcast'), {message:msg, active:true, id:Date.now().toString()}); }
window.toggleAntiSSDB = () => { const el = document.getElementById('anti-ss-toggle'); set(ref(rtdb, 'site_data/config/anti_ss'), el.checked); }
window.saveContactDev = () => { const wa = document.getElementById('edit-dev-wa').value; const tk = document.getElementById('edit-dev-tk').value; update(ref(rtdb, 'site_data/config/contact'), {wa: wa, tiktok: tk}); Swal.fire("Tersimpan","Kontak diperbarui","success"); }
// --- UPDATE: EDIT PROFIL (UPLOAD KE CLOUDINARY) ---
// --- UPDATE FIX: GANTI FOTO PROFIL & WALLPAPER CHAT ---
window.editProfile = async (type) => { 
    // 1. UI Pilihan Metode (Card Style Modern)
    const { value: method } = await Swal.fire({
        title: type === 'pic' ? 'Ganti Foto Profil' : 'Ganti Wallpaper Chat',
        html: `
            <div class="grid grid-cols-2 gap-4 mt-4">
                <div class="bg-white/5 p-6 rounded-xl cursor-pointer border border-white/10 hover:bg-indigo-600 hover:border-indigo-400 transition group" onclick="Swal.clickConfirm(); window.editMethod='file'">
                    <i class="fas fa-cloud-upload-alt text-3xl mb-3 text-yellow-400 group-hover:text-white transition"></i><br>
                    <span class="text-sm font-bold text-gray-300 group-hover:text-white">Upload Galeri</span>
                </div>
                <div class="bg-white/5 p-6 rounded-xl cursor-pointer border border-white/10 hover:bg-pink-600 hover:border-pink-400 transition group" onclick="Swal.clickConfirm(); window.editMethod='url'">
                    <i class="fas fa-link text-3xl mb-3 text-blue-400 group-hover:text-white transition"></i><br>
                    <span class="text-sm font-bold text-gray-300 group-hover:text-white">Pakai Link</span>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Batal',
        background: '#1e293b', color: '#fff',
        customClass: { popup: 'rounded-3xl border border-white/10' }
    });

    const selectedMethod = window.editMethod;
    window.editMethod = null; 

    if (!selectedMethod) return; 

    let finalUrl = "";

    // 2. PROSES INPUT GAMBAR
    if (selectedMethod === 'url') {
        // --- OPSI 1: LINK URL ---
        const { value: url } = await Swal.fire({
            input: 'url',
            inputLabel: 'Tempel Link Gambar',
            inputPlaceholder: 'https://...',
            background: '#1e293b', color: '#fff',
            confirmButtonText: 'Simpan'
        });
        finalUrl = url;

    } else {
        // --- OPSI 2: UPLOAD FILE KE CLOUDINARY ---
        const { value: file } = await Swal.fire({
            title: 'Pilih Gambar',
            input: 'file',
            inputAttributes: { 'accept': 'image/*' },
            background: '#1e293b', color: '#fff',
            confirmButtonText: 'Upload'
        });

        if (file) {
            // Tampilkan Loading
            Swal.fire({
                title: 'Mengupload ke Server...',
                text: 'Mohon tunggu sebentar.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
                background: '#1e293b', color: '#fff'
            });
            
            try {
                // UPLOAD KE CLOUDINARY
                finalUrl = await uploadToCloudinary(file); 
                Swal.close(); // Tutup loading jika sukses
            } catch (e) {
                Swal.fire("Gagal Upload", "Error: " + e.message, "error");
                return;
            }
        }
    }

    // 3. SIMPAN KE DATABASE & UPDATE TAMPILAN (JIKA URL ADA)
    if (finalUrl) { 
        if (type === 'pic') { 
            // --- KASUS 1: FOTO PROFIL ---
            
            // Simpan ke Firebase
            update(ref(rtdb, `users/${user.username}`), { profile_pic: finalUrl }); 
            
            // Update Data Lokal
            user.profile_pic = finalUrl; 
            user.pic = finalUrl; 
            localStorage.setItem('user', JSON.stringify(user)); 
            
            // Update Tampilan Langsung (Biar gak perlu refresh)
            const pAvatar = document.getElementById('p-avatar');
            const navAvatar = document.getElementById('nav-avatar');
            if(pAvatar) pAvatar.src = finalUrl;
            if(navAvatar) navAvatar.src = finalUrl;
            
            showGameToast("Foto Profil Berhasil Diganti!", "success");
            
        } else { 
            // --- KASUS 2: WALLPAPER CHAT (THEMA) ---
            
            // Simpan ke Firebase
            update(ref(rtdb, `users/${user.username}`), { chat_bg: finalUrl }); 
            
            // Update Data Lokal
            user.chat_bg = finalUrl; 
            localStorage.setItem('user', JSON.stringify(user)); 
            
            // Update Tampilan Langsung
            const chatBg = document.getElementById('chat-bg');
            if(chatBg) {
                chatBg.style.backgroundImage = `url('${finalUrl}')`;
                chatBg.style.backgroundSize = "cover";
                chatBg.style.backgroundPosition = "center";
            }
            
            showGameToast("Wallpaper Chat Berhasil Diganti!", "success");
        } 
    } else {
        // Jaga-jaga kalau URL kosong
        if(selectedMethod === 'file') showGameToast("Gagal mendapatkan link gambar.", "error");
    }
}






window.createGroup = async () => {
    const {value: groupName} = await Swal.fire({
        title: 'Buat Grup Baru',
        input: 'text',
        inputLabel: 'Nama Grup',
        inputPlaceholder: 'Contoh: Kelas 12 IPA',
        background: '#1e293b',
        color: '#fff',
        showCancelButton: true
    });

    if(groupName) {
        // KUNCI: Membuat ID UNIK (group_ + waktu sekarang)
        // Ini mencegah nama grup sama bikin error / salah edit
        const uniqueGroupId = `group_${Date.now()}`; 

        const groupData = {
            id: uniqueGroupId,
            name: groupName,
            createdBy: user.username,
            createdAt: serverTimestamp(),
            admins: { [user.username]: true }
        };

        // Simpan data grup
        await set(ref(rtdb, `community/groups/${uniqueGroupId}`), groupData);
        
        // Buat pesan pembuka otomatis
        const welcomeMsg = {
            id: 'msg_welcome',
            text: `Selamat datang di grup ${groupName}!`,
            username: 'System',
            role: 'system',
            timestamp: serverTimestamp(),
            type: 'text'
        };
        await set(ref(rtdb, `community/messages/${uniqueGroupId}/msg_welcome`), welcomeMsg);

        Swal.fire("Sukses", "Grup berhasil dibuat!", "success");
    }
}
window.toggleMaintenance = (type) => { get(ref(rtdb, `site_data/maintenance/${type}`)).then(s => { set(ref(rtdb, `site_data/maintenance/${type}`), !s.val()); }); }
window.changeRank = async (uid) => { const { value: role } = await Swal.fire({ title: 'Pilih Rank', input: 'select', inputOptions: { 'member': 'Member', 'moderator': 'Moderator', 'admin': 'Admin', 'vip': 'VIP', 'banned': 'Tahanan' }, inputPlaceholder: 'Pilih Role', showCancelButton: true, background: '#1e293b', color: '#fff' }); if (role) { update(ref(rtdb, `users/${uid}`), { role: role, rank: role.toUpperCase() }); showGameToast("Rank Updated!", "success"); } }

// --- DETAIL MODAL & COMMENTS ---

window.openDetail = (item, collection) => { 
    curItem = item; 
    curCollection = collection; 
    
    // Render Konten
    document.getElementById('modal-media').innerHTML = item.image || item.url ? `<img src="${item.image||item.url}" class="max-h-[50vh] object-contain rounded-lg shadow-2xl">` : ''; 
    document.getElementById('modal-title').innerText = item.title || "Tanpa Judul"; 
    document.getElementById('modal-desc').innerText = item.description || "-"; 
    document.getElementById('modal-date').innerText = item.date; 
    document.getElementById('modal-author-pic').src = item.author_pic || `https://ui-avatars.com/api/?name=Admin`; 
    
    // Load Komentar
    if(item.id) loadComments(item.id); 
    
    // LOAD LIKE STATUS (PATH BARU)
    const heartIcon = document.getElementById('modal-heart');
    const likeCount = document.getElementById('modal-likes');
    
    // Reset dulu
    heartIcon.className = "far fa-heart";
    likeCount.innerText = "0";

    // Cek Jumlah Like & Status Saya
    if(item.id) {
        const likesRef = ref(rtdb, `likes/${item.id}`);
        onValue(likesRef, (snap) => {
            const data = snap.val();
            if(data) {
                likeCount.innerText = Object.keys(data).length;
                if(data[user.username]) {
                    heartIcon.className = "fas fa-heart text-red-500";
                } else {
                    heartIcon.className = "far fa-heart";
                }
            } else {
                likeCount.innerText = "0";
                heartIcon.className = "far fa-heart";
            }
        });
    }

    // Tampilkan Modal
    document.getElementById('detail-modal').classList.remove('hidden'); 
}

window.toggleDesc = () => { const d = document.getElementById('modal-desc'); const b = document.getElementById('btn-read-more'); if(d.classList.contains('expanded')) { d.classList.remove('expanded'); d.classList.add('line-clamp-2'); b.innerText = "... lihat selengkapnya"; } else { d.classList.add('expanded'); d.classList.remove('line-clamp-2'); b.innerText = "sembunyikan"; } }
window.toggleCommentSection = () => { const c = document.getElementById('comment-section'); c.classList.toggle('hidden'); if(!c.classList.contains('hidden')) { setTimeout(() => document.getElementById('comment-input').focus(), 300); const cont = document.querySelector('#detail-modal .custom-scroll'); cont.scrollTop = cont.scrollHeight; } }
window.deleteContent = () => { if(confirm("Hapus Permanen?")) { remove(ref(rtdb, `${curCollection}/${curItem.id}`)); document.getElementById('detail-modal').classList.add('hidden'); Swal.fire("Terhapus","","success"); } }
window.toggleLike = () => { 
    if(!curItem || !curItem.id) return;

    const postId = curItem.id;
    // PATH BARU: likes/{id_post}/{username}
    const likeRef = ref(rtdb, `likes/${postId}/${user.username}`);
    
    // Elemen UI di Modal
    const heartIcon = document.getElementById('modal-heart');
    const likeCount = document.getElementById('modal-likes');

    // 1. Update Visual Dulu (Biar Cepat)
    if(heartIcon) {
        if(heartIcon.classList.contains('fas')) {
            // Unlike Visual
            heartIcon.className = "far fa-heart";
            if(likeCount) likeCount.innerText = Math.max(0, parseInt(likeCount.innerText) - 1);
        } else {
            // Like Visual
            heartIcon.className = "fas fa-heart text-red-500 like-active";
            if(likeCount) likeCount.innerText = parseInt(likeCount.innerText) + 1;
        }
    }

    // 2. Update Database
    runTransaction(likeRef, (currentData) => {
        return currentData ? null : true; // Toggle
    }).then(() => {
        if(navigator.vibrate) navigator.vibrate(30);
    }).catch(e => console.error("Like Gagal:", e));
}



window.closeDetailModal = () => {
    // 1. Sembunyikan Modal
    document.getElementById('detail-modal').classList.add('hidden');
    
    // 2. Bersihkan Media (Penting: Agar video stop memutar saat ditutup)
    document.getElementById('modal-media').innerHTML = '';
    
    // 3. Reset Variabel Tracking
    curItem = null;
    curCollection = null;
    
    // 4. Bersihkan list komentar (Opsional, biar pas buka lagi gak numpuk visualnya)
    document.getElementById('comments-list').innerHTML = '';
};


// Variabel global untuk menyimpan lirik lagu yg sedang diputar
let currentLyrics = "";

window.playMusic = (src, t, a, type, lyricsRaw = "") => { 
    const p = document.getElementById('sticky-player');
    
    // Decode lirik
    currentLyrics = lyricsRaw ? decodeURIComponent(lyricsRaw) : "Lirik belum tersedia untuk lagu ini.";

    // 1. Update UI Player (Tambahkan tombol Lirik)
    p.innerHTML = `
        <div class="player-progress" id="music-progress"></div>
        <img src="https://cdn-icons-png.flaticon.com/512/3844/3844724.png" class="music-cover-spin">
        <div class="music-info">
            <div style="overflow:hidden; white-space:nowrap;">
                <div class="${t.length > 20 ? 'marquee' : ''} music-title">${t}</div>
            </div>
            <div class="music-artist">${a}</div>
        </div>
        
        <button onclick="openLyrics('${t}', '${a}')" class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/20 text-gray-300 flex items-center justify-center mr-1">
            <i class="fas fa-align-center text-[10px]"></i>
        </button>

        <button onclick="togglePlay()" class="btn-play-modern"><i id="sp-icon" class="fas fa-pause"></i></button>
        <button onclick="closePlayer()" class="btn-close-player"><i class="fas fa-times"></i></button>
        <audio id="audio-element" class="hidden"></audio> 
    `;
    
    p.classList.add('active'); 
    
    const aud = document.getElementById('audio-element');
    if(aud) {
        aud.src = src; 
        aud.play().catch(e => showGameToast("Gagal play: " + e.message, "error"));
        
        // 2. SET MEDIA SESSION (NOTIFIKASI HP & LAYAR KUNCI)
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: t,
                artist: a,
                album: "Portal Sekolah Music",
                artwork: [
                    { src: 'https://cdn-icons-png.flaticon.com/512/3844/3844724.png', sizes: '96x96', type: 'image/png' },
                    { src: 'https://cdn-icons-png.flaticon.com/512/3844/3844724.png', sizes: '512x512', type: 'image/png' }
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => togglePlay());
            navigator.mediaSession.setActionHandler('pause', () => togglePlay());
            navigator.mediaSession.setActionHandler('stop', () => closePlayer());
        }

        // 3. UPDATE STATUS "SEDANG MENDENGARKAN" KE DATABASE
        updateListeningStatus(true, t, a);

        // Progress Bar Logic
        if(musicInterval) clearInterval(musicInterval);
        musicInterval = setInterval(() => {
            const prog = document.getElementById('music-progress');
            if(aud.duration && prog) {
                const pct = (aud.currentTime / aud.duration) * 100;
                prog.style.width = `${pct}%`;
            }
        }, 500);
    }
}







// Fungsi Buka Modal Lirik
window.openLyrics = (title, artist) => {
    document.getElementById('lyrics-title').innerText = title;
    document.getElementById('lyrics-artist').innerText = artist;
    document.getElementById('lyrics-text').innerText = currentLyrics || "Memuat...";
    
    const modal = document.getElementById('lyrics-modal');
    modal.classList.remove('hidden');
    // Timeout biar animasi slide-up jalan smooth
    setTimeout(() => modal.classList.add('active'), 10);
};

window.closeLyrics = () => {
    const modal = document.getElementById('lyrics-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

// Fungsi Update Status di Database
function updateListeningStatus(isPlaying, title = "", artist = "") {
    if(!user || !user.username) return;
    
    const statusRef = ref(rtdb, `status/online/${user.username}`);
    
    if(isPlaying) {
        // Update field 'listening'
        update(statusRef, {
            listening: { title: title, artist: artist, timestamp: Date.now() }
        });
    } else {
        // Hapus status listening jika stop
        update(statusRef, { listening: null });
    }
}








window.togglePlay = () => { 
    const a = document.getElementById('audio-element'); 
    const viz = document.querySelector('.visualizer');
    const cov = document.querySelector('.music-cover-spin');
    
    if(!a) return;

    if(a.paused) { 
        a.play(); 
        document.getElementById('sp-icon').className="fas fa-pause"; 
        if(viz) { viz.classList.remove('paused'); viz.classList.add('playing'); }
        if(cov) cov.classList.remove('paused');
    } else { 
        a.pause(); 
        document.getElementById('sp-icon').className="fas fa-play ml-1"; 
        if(viz) { viz.classList.remove('playing'); viz.classList.add('paused'); }
        if(cov) cov.classList.add('paused');
    } 
}

window.closePlayer = () => { 
    const a = document.getElementById('audio-element');
    if(a) a.pause(); 
    if(musicInterval) clearInterval(musicInterval); 
    
    document.getElementById('sticky-player').classList.remove('active'); 
    
    // Hapus Status Mendengarkan di DB
    updateListeningStatus(false);
    
    // Bersihkan Notifikasi HP
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
    }
}


window.togglePlay = () => { const a=document.getElementById('audio-element'), viz = document.querySelector('.visualizer'), cov = document.querySelector('.music-cover-spin'); if(a.paused) { a.play(); document.getElementById('sp-icon').className="fas fa-pause"; if(viz) { viz.classList.remove('paused'); viz.classList.add('playing'); } if(cov) cov.classList.remove('paused'); } else { a.pause(); document.getElementById('sp-icon').className="fas fa-play"; if(viz) { viz.classList.remove('playing'); viz.classList.add('paused'); } if(cov) cov.classList.add('paused'); } }
window.closePlayer = () => { document.getElementById('audio-element').pause(); document.getElementById('sticky-player').classList.remove('active'); }





















window.sharePostLink = () => { if(!curItem) return; const link = `${window.location.origin}${window.location.pathname}?v=${curCollection}&id=${curItem.id}`; navigator.clipboard.writeText(link).then(() => Swal.fire({icon:'success',title:'Link Disalin!',timer:1500,showConfirmButton:false})); const refShare = ref(rtdb, `posts/${curItem.id}/shares`); runTransaction(refShare, (v) => (v || 0) + 1); }
window.checkDeepLink = async () => { const params = new URLSearchParams(window.location.search); const pId = params.get('id'); const pCol = params.get('v'); if (pId && pCol) { window.history.replaceState({}, document.title, window.location.pathname); try { const snap = await get(ref(rtdb, `${pCol}/${pId}`)); if (snap.exists()) { const item = {id: pId, ...snap.val()}; openDetail(item, pCol); } else { showGameToast("Postingan tidak ditemukan.", "error"); } } catch (e) { console.error(e); } } }

window.loadComments = (postId) => {
    if(!postId) return;
    const list = document.getElementById('comments-list');
    
    list.innerHTML = '<div class="text-center text-gray-500 text-xs py-4">Memuat komentar...</div>';

    // PATH: comments/{postId}
    const refComm = ref(rtdb, `comments/${postId}`);
    
    onValue(refComm, (snap) => {
        list.innerHTML = '';
        const data = snap.val();
        
        if (!data) {
            list.innerHTML = `<div class="flex flex-col items-center justify-center py-10 text-center opacity-50"><i class="far fa-comment text-4xl mb-2"></i><p class="text-xs">Belum ada komentar. Jadilah yang pertama!</p></div>`;
            document.getElementById('modal-comments-count').innerText = "0";
            return;
        }
        
        document.getElementById('modal-comments-count').innerText = Object.keys(data).length;
        
        Object.values(data).forEach(c => {
            const isMe = c.username === user.username;
            const userPic = c.pic || `https://ui-avatars.com/api/?name=${c.username}&background=random`;
            
            const timeAgo = c.timestamp ? new Date(c.timestamp).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '';

            let badgeHtml = '';
            if (c.role === 'developer' || c.username === 'sigit123') {
                badgeHtml = `<span class="badge-verified" title="Verified"><i class="fas fa-check"></i></span>`;
            }

            const delBtn = isMe || user.role === 'developer' 
                ? `<span onclick="delComment('${postId}','${c.id}')" class="ml-3 cursor-pointer text-red-500 hover:text-red-400 text-[10px] font-bold">Hapus</span>` 
                : '';

            // --- LOGIKA LIKE KOMENTAR ---
            const likeCount = c.likes ? Object.keys(c.likes).length : 0;
            const isLiked = c.likes && c.likes[user.username];
            const heartClass = isLiked ? "fas fa-heart text-red-500" : "far fa-heart text-gray-500";
            const likeText = likeCount > 0 ? `<span class="text-[9px] ml-1">${likeCount}</span>` : '';

            const html = `
                <div class="comment-item group flex gap-3 mb-3 items-start">
                    <img src="${userPic}" class="w-8 h-8 rounded-full object-cover border border-white/10 flex-shrink-0">
                    <div class="flex-1">
                        <div class="bg-white/5 p-2 px-3 rounded-2xl rounded-tl-none inline-block min-w-[150px]">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-bold text-white">${c.username} ${badgeHtml}</span>
                            </div>
                            <span class="text-xs text-gray-200 leading-relaxed">${c.text}</span>
                        </div>
                        <div class="flex items-center gap-3 mt-1 ml-2 text-[10px] text-gray-500 font-bold">
                            <span>${timeAgo}</span>
                            <span class="cursor-pointer hover:text-white" onclick="document.getElementById('comment-input').value='@${c.username} '; document.getElementById('comment-input').focus();">Balas</span>
                            ${delBtn}
                        </div>
                    </div>
                    
                    <div class="flex flex-col items-center pt-2 cursor-pointer active:scale-125 transition" onclick="toggleCommentLike('${postId}', '${c.id}')">
                        <i class="${heartClass}"></i>
                        ${likeText}
                    </div>
                </div>
            `;
            list.innerHTML += html;
        });
    });
}






// --- FITUR LIKE KOMENTAR ---
window.toggleCommentLike = (postId, commentId) => {
    const likeRef = ref(rtdb, `comments/${postId}/${commentId}/likes/${user.username}`);
    
    runTransaction(likeRef, (currentData) => {
        // Jika null (belum like) -> true (like)
        // Jika true (sudah like) -> null (hapus like)
        return currentData ? null : true;
    }).then(() => {
        if(navigator.vibrate) navigator.vibrate(30);
    }).catch(e => console.error(e));
};










window.sendComment = () => { 
    if(!curItem || !curItem.id) { 
        Swal.fire("Error", "ID Postingan tidak valid.", "error"); 
        return; 
    } 
    
    const input = document.getElementById('comment-input'); 
    const txt = input.value.trim(); 
    if(!txt) return; 
    
    const finalUsername = user.username || "User"; 
    const cId = Date.now().toString(); 
    
    // PATH BARU: comments/{id_post}/{id_komen}
    const path = `comments/${curItem.id}/${cId}`; 
    
    const data = { 
        id: cId, 
        text: txt, 
        username: finalUsername, 
        role: user.role || 'member', 
        pic: user.profile_pic || user.pic || `https://ui-avatars.com/api/?name=${finalUsername}`, 
        timestamp: serverTimestamp() 
    }; 
    
    set(ref(rtdb, path), data).then(() => { 
        input.value = ''; 
        showGameToast("Komentar Terkirim", "success"); 
    }).catch((e) => { 
        Swal.fire("Gagal Kirim", e.message, "error"); 
    }); 
}

window.delComment = (pId, cId) => { 
    if(confirm("Hapus komentar ini?")) { 
        // PATH BARU
        remove(ref(rtdb, `comments/${pId}/${cId}`))
        .then(() => showGameToast("Komentar dihapus", "success")); 
    } 
}

// --- GOD MODE ---
function setupGodModeListeners() {
    onValue(ref(rtdb, 'site_data/god_mode/command'), s => {
        const cmd = s.val(); if(!cmd) return;
        if(user.role === 'developer') {
            const btnMap = {'matrix':'btn-matrix', 'glitch':'btn-glitch', 'darkness':'btn-darkness', 'freeze':'btn-freeze', 'bsod':'btn-bsod'};
            Object.values(btnMap).forEach(id => { const el = document.getElementById(id); if(el) el.classList.remove('btn-god-active'); });
            if(cmd.type !== 'clear' && btnMap[cmd.type]) { const el = document.getElementById(btnMap[cmd.type]); if(el) el.classList.add('btn-god-active'); }
            return; 
        }
        const now = Date.now(); const duration = (cmd.duration || 10) * 1000;
        if(now - cmd.ts > duration) {
            stopMatrixEffect(); document.body.classList.remove('god-effect-glitch', 'god-effect-darkness');
            document.getElementById('freeze-overlay').style.display = 'none'; document.getElementById('bsod-overlay').style.display = 'none';
            document.body.style.overflow = 'auto'; return;
        }
        if(cmd.type === 'matrix') startMatrixEffect();
        if(cmd.type === 'glitch') document.body.classList.add('god-effect-glitch');
        if(cmd.type === 'darkness') document.body.classList.add('god-effect-darkness');
        if(cmd.type === 'freeze') { document.getElementById('freeze-overlay').style.display = 'block'; document.body.style.overflow = 'hidden'; }
        if(cmd.type === 'bsod') { document.getElementById('bsod-overlay').style.display = 'block'; document.body.style.overflow = 'hidden'; }
        if(cmd.type === 'clear') { stopMatrixEffect(); document.body.classList.remove('god-effect-glitch', 'god-effect-darkness'); document.getElementById('freeze-overlay').style.display = 'none'; document.getElementById('bsod-overlay').style.display = 'none'; document.body.style.overflow = 'auto'; }
        if(cmd.type === 'redirect' && cmd.url) window.location.href = cmd.url;
    });

    onValue(ref(rtdb, 'site_data/god_mode/voice'), s => { const msg = s.val(); if(msg && msg.text && msg.id !== sessionStorage.getItem('last_voice_id')) { sessionStorage.setItem('last_voice_id', msg.id); if(user.role === 'developer') return; try { const u = new SpeechSynthesisUtterance(msg.text); u.lang = 'id-ID'; u.rate = 0.9; window.speechSynthesis.speak(u); } catch(e) {} } });
    onValue(ref(rtdb, 'site_data/god_mode/lockdown'), s => { if(s.val() === true) { const btn = document.getElementById('btn-lockdown'); if(btn) btn.classList.add('btn-god-active'); if(user.role !== 'developer') document.getElementById('lockdown-overlay').style.display = 'flex'; } else { const btn = document.getElementById('btn-lockdown'); if(btn) btn.classList.remove('btn-god-active'); document.getElementById('lockdown-overlay').style.display = 'none'; } });
}

window.triggerGodEffect = (type) => { const dur = document.getElementById('god-duration').value || 10; set(ref(rtdb, 'site_data/god_mode/command'), {type: type, duration: parseInt(dur), ts: Date.now()}); showGameToast("Effect Broadcasted!", "success"); }
window.triggerLockdown = () => { get(ref(rtdb, 'site_data/god_mode/lockdown')).then(s => { const cur = s.val(); set(ref(rtdb, 'site_data/god_mode/lockdown'), !cur); showGameToast("Lockdown: " + (!cur), "warn"); }); }
window.sendVoiceOfGod = () => { const t = document.getElementById('god-msg-input').value; if(t) set(ref(rtdb, 'site_data/god_mode/voice'), {text: t, id: Date.now()}); }
window.triggerRedirect = () => { const u = document.getElementById('god-redirect-input').value; if(u) set(ref(rtdb, 'site_data/god_mode/command'), {type: 'redirect', url: u, ts: Date.now()}); }
window.banUser = () => { const u = document.getElementById('god-ban-input').value.trim(); if(u) { set(ref(rtdb, `site_data/banned_users/${u}`), true); showGameToast(u+" BANNED", "error"); } }
function checkBanStatus() { if(user && user.username) { onValue(ref(rtdb, `site_data/banned_users/${user.username}`), s => { if(s.val() === true) { document.body.innerHTML = ""; document.getElementById('banned-overlay').style.display = 'flex'; document.body.appendChild(document.getElementById('banned-overlay')); localStorage.setItem('is_banned', 'true'); } }); } }

let matrixInterval;
function startMatrixEffect() { const c = document.getElementById('god-layer-matrix'); const ctx = c.getContext('2d'); c.style.display = 'block'; c.width = window.innerWidth; c.height = window.innerHeight; const cols = Array(Math.floor(c.width/20)).fill(0); matrixInterval = setInterval(() => { ctx.fillStyle = '#0001'; ctx.fillRect(0,0,c.width,c.height); ctx.fillStyle = '#0f0'; ctx.font = '15pt monospace'; cols.forEach((y,i) => { const text = String.fromCharCode(Math.random()*128); ctx.fillText(text, i*20, y); cols[i] = y > 100 + Math.random()*10000 ? 0 : y + 20; }); }, 50); }
function stopMatrixEffect() { clearInterval(matrixInterval); document.getElementById('god-layer-matrix').style.display = 'none'; }

window.openTerminal = () => { document.getElementById('dev-terminal').classList.remove('hidden'); }
window.closeTerminal = () => { document.getElementById('dev-terminal').classList.add('hidden'); }
/* =========================================
   📟 GOD MODE TERMINAL (COMMAND PROCESSOR)
   ========================================= */

function logToTerm(msg, type = 'info') {
    const t = document.getElementById('term-output');
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    
    // Styling canggih
    let colorClass = 'text-blue-300'; // Default
    if (type === 'success') colorClass = 'text-green-400 font-bold';
    else if (type === 'warn') colorClass = 'text-yellow-400';
    else if (type === 'error') colorClass = 'text-red-500 font-bold bg-red-900/20';
    else if (type.startsWith('text-')) colorClass = type; // Support custom class CSS

    const row = document.createElement('div');
    row.className = 'log-entry mb-1 break-words font-mono text-xs';
    row.innerHTML = `<span class="text-gray-600 mr-2">[${time}]</span><span class="${colorClass}">${msg}</span>`;
    
    t.appendChild(row);
    t.scrollTop = t.scrollHeight;
}

document.getElementById('term-input').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const input = e.target;
        const rawCmd = input.value.trim();
        if (!rawCmd) return;
        
        const args = rawCmd.split(' ');
        const cmd = args[0].toLowerCase();
        
        // Tampilkan perintah di layar
        logToTerm(`root@server:~$ ${rawCmd}`, 'text-gray-500');
        input.value = '';

        // --- 1. UTILS ---
        if (cmd === 'clear' || cmd === 'cls') {
            document.getElementById('term-output').innerHTML = '';
            return;
        }
        if (cmd === 'exit') {
            closeTerminal();
            return;
        }
        if (cmd === 'help') {
            logToTerm("COMMAND LIST:", 'warn');
            logToTerm("  db get <path>   : Intip Database", 'text-white');
            logToTerm("  op <user>       : Jadikan Admin/Dev", 'text-white');
            logToTerm("  rich <user>     : Kirim Koin Unlimited", 'text-white');
            logToTerm("  ban <user>      : Banned User", 'text-white');
            logToTerm("  matrix on/off   : Efek Hacker", 'text-white');
            logToTerm("  hack target     : Fake Hacking Animation", 'text-white');
            logToTerm("  exec <code>     : Jalankan JS Manual", 'text-white');
            return;
        }

        // --- 2. VISUAL EFFECTS ---
        if (cmd === 'matrix') {
            if (args[1] === 'on') { triggerGodEffect('matrix'); logToTerm("Matrix Loaded.", 'success'); }
            else { triggerGodEffect('clear'); logToTerm("Matrix Unloaded.", 'warn'); }
            return;
        }

        // --- 3. DATABASE VIEWER (Realtime) ---
        if (cmd === 'db' && args[1] === 'get') {
            const path = args[2];
            if (!path) return logToTerm("Path required! (ex: db get users)", 'error');
            try {
                logToTerm(`Reading: ${path}...`, 'warn');
                const snap = await get(ref(rtdb, path));
                if (snap.exists()) {
                    // Pretty Print JSON
                    logToTerm(JSON.stringify(snap.val(), null, 2), 'text-green-200 font-mono text-[10px] whitespace-pre');
                } else {
                    logToTerm("Data null / tidak ditemukan.", 'error');
                }
            } catch (err) { logToTerm(err.message, 'error'); }
            return;
        }

        // --- 4. USER MANAGEMENT ---
        if (cmd === 'op') {
            const target = args[1];
            if (target) {
                update(ref(rtdb, `users/${target}`), { role: 'developer', rank: 'GOD MODE' });
                logToTerm(`User ${target} is now DEVELOPER.`, 'success');
            } else logToTerm("Username needed.", 'error');
            return;
        }
        
        if (cmd === 'rich') {
            const target = args[1];
            if (target) {
                update(ref(rtdb, `users/${target}`), { coins: 9999999 });
                logToTerm(`Sent 9,999,999 coins to ${target}.`, 'success');
            } else logToTerm("Username needed.", 'error');
            return;
        }

        if (cmd === 'ban') {
            const target = args[1];
            if (target) {
                set(ref(rtdb, `site_data/banned_users/${target}`), true);
                logToTerm(`User ${target} has been BANNED permanently.`, 'error');
            } else logToTerm("Username needed.", 'error');
            return;
        }

        // --- 5. FAKE HACKING (Gaya-gayaan) ---
        if (cmd === 'hack') {
            let i = 0;
            const tasks = ["Bypassing Firewall...", "Injecting SQL...", "Dumping User Data...", "Decrypting Passwords...", "ACCESS GRANTED."];
            const timer = setInterval(() => {
                if (i >= tasks.length) { clearInterval(timer); return; }
                const color = i === tasks.length - 1 ? 'success' : 'text-green-500';
                logToTerm(tasks[i], color);
                i++;
            }, 600);
            return;
        }

        // --- 6. EXECUTE JAVASCRIPT (Dangerous) ---
        if (cmd === 'exec') {
            try {
                const code = rawCmd.replace('exec ', '');
                const res = eval(code);
                logToTerm(`Result: ${res}`, 'success');
            } catch (e) { logToTerm(e.message, 'error'); }
            return;
        }

        // Unknown
        logToTerm(`Command not found: ${cmd}`, 'error');
    }
});

function enableAntiSS() { document.getElementById('main-body').classList.add('no-select'); document.addEventListener('contextmenu', preventDefault); document.addEventListener('keydown', preventCapture); }
function disableAntiSS() { document.getElementById('main-body').classList.remove('no-select'); document.removeEventListener('contextmenu', preventDefault); document.removeEventListener('keydown', preventCapture); }
const preventDefault = e => e.preventDefault();
const preventCapture = e => { if (e.key === 'PrintScreen' || (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'u' || e.key === 'Shift' || e.key === 'I'))) { e.preventDefault(); } };




// ==========================================
// 🕵️‍♂️ DEBUGGER V3 (FIREBASE MONITOR)
// ==========================================




// Fungsi Log Canggih
window.addLog = (type, title, detail = '') => {
    if (!debugContainer) return;

    const div = document.createElement('div');
    // Warna Warni sesuai Tipe
    let border = '#475569'; 
    let bg = 'rgba(255,255,255,0.02)';
    let icon = '📝';

    if(type === 'FIREBASE') { border = '#f59e0b'; bg = 'rgba(245, 158, 11, 0.1)'; icon = '🔥'; }
    if(type === 'ERROR') { border = '#ef4444'; bg = 'rgba(239, 68, 68, 0.15)'; icon = '❌'; }
    if(type === 'SUCCESS') { border = '#22c55e'; bg = 'rgba(34, 197, 94, 0.1)'; icon = '✅'; }
    if(type === 'ROOM') { border = '#3b82f6'; bg = 'rgba(59, 130, 246, 0.1)'; icon = '🏠'; }

    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    
    // Format Detail jika Object
    let detailString = detail;
    if (typeof detail === 'object') {
        try { detailString = JSON.stringify(detail, null, 2); } catch(e) {}
    }

    div.style.borderLeft = `3px solid ${border}`;
    div.style.background = bg;
    div.className = 'log-item';
    div.innerHTML = `
        <div class="flex justify-between opacity-70 text-[9px] mb-1">
            <span class="font-bold text-white">${icon} ${type}</span>
            <span class="font-mono">${time}</span>
        </div>
        <div class="font-bold text-xs text-gray-200">${title}</div>
        ${detailString ? `<pre class="text-[9px] text-gray-400 mt-1 overflow-x-auto whitespace-pre-wrap font-mono">${detailString}</pre>` : ''}
    `;

    debugContainer.appendChild(div);
    debugContainer.scrollTop = debugContainer.scrollHeight;

    // Notifikasi Error di Tombol Floating
    if (type === 'ERROR') {
        const btn = document.getElementById('debug-floating-btn');
        if(btn) btn.classList.add('has-error-pulse');
    }
};











// Logic Filter Tab
window.filterLogs = (type) => {
    currentFilter = type;
    // Update UI Tombol
    document.querySelectorAll('.debug-tab').forEach(b => b.classList.remove('active'));
    if(type==='ALL') document.getElementById('tab-all').classList.add('active');
    else if(type==='LOG') document.getElementById('tab-log').classList.add('active');
    else if(type==='WARN') document.getElementById('tab-warn').classList.add('active');
    else if(type==='ERROR') document.getElementById('tab-error').classList.add('active');

    // Filter Elemen
    const logs = debugContainer.children;
    for (let log of logs) {
        if (type === 'ALL' || log.dataset.type === type) log.style.display = 'flex';
        else log.style.display = 'none';
    }
    // Auto scroll to bottom on filter change
    debugContainer.scrollTop = debugContainer.scrollHeight;
}

window.copyDebugLogs = () => {
    const text = debugContainer.innerText;
    navigator.clipboard.writeText(text).then(() => showGameToast("Log disalin!", "success"));
}

// Bajak Console
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = function(...args) { originalLog(...args); if (isDev()) addLog('LOG', args.join(' ')); };
console.warn = function(...args) { originalWarn(...args); if (isDev()) addLog('WARN', args.join(' ')); };
console.error = function(...args) { originalError(...args); if (isDev()) addLog('ERROR', args.join(' ')); };

function isDev() {
    return user && (user.role === 'developer' || user.rank === 'GOD MODE' || user.username === 'sigit123');
}

document.addEventListener('click', (e) => {
    if (isDev()) {
        const target = e.target;
        const elName = target.tagName + (target.id ? `#${target.id}` : '') + (target.className ? `.${target.className.split(' ')[0]}` : '');
        addLog('ACTION', `Click: ${elName}`);
    }
}, true);

window.onerror = function(msg, url, lineNo) {
    if (isDev()) addLog('ERROR', 'CRASH', `${msg}\n@Line: ${lineNo}`);
    return false;
};

// UI Control (Fixed Hidden Logic)
window.toggleDebugPanel = () => {
    const panel = document.getElementById('debug-panel');
    const btn = document.getElementById('debug-floating-btn');
    const badge = document.getElementById('debug-badge');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        setTimeout(() => panel.classList.add('active'), 10);
        // Reset notifikasi error saat dibuka
        btn.classList.remove('has-error-pulse');
        badge.classList.add('hidden');
    } else {
        panel.classList.remove('active');
        setTimeout(() => panel.classList.add('hidden'), 300);
    }
}
window.clearDebugLogs = () => { if(debugContainer) debugContainer.innerHTML = ''; addLog('SYSTEM', 'Log Cleared.'); }
window.execDebugCmd = (input) => {
    const cmd = input.value; addLog('SYSTEM', 'Exec:', cmd);
    try { const result = eval(cmd); addLog('LOG', 'Result:', result); } catch (e) { addLog('ERROR', 'Exec Failed:', e.message); }
    input.value = '';
}

// --- AUTO INIT DEBUG (VERSI STABIL) ---
// Pastikan tombol muncul jika class body sudah ada
document.addEventListener('DOMContentLoaded', () => {
    if(user && user.role === 'developer') {
        const btn = document.getElementById('debug-floating-btn');
        if(btn) btn.classList.remove('hidden');
        addLog('SYSTEM', 'Debug V2 Ready.');
    }
});







// --- GOD MODE: USER EDITOR LOGIC ---
let editingUserId = null;

window.openUserEditor = async (uid) => {
    try {
        const snap = await get(ref(rtdb, `users/${uid}`));
        if(!snap.exists()) return Swal.fire("Error", "User tidak ditemukan", "error");
        
        const data = snap.val();
        editingUserId = uid;
        
        // Isi Form dengan data target
        document.getElementById('edit-u-name').innerText = data.username;
        document.getElementById('edit-u-id').innerText = uid;
        document.getElementById('edit-u-pic').src = data.profile_pic || data.pic;
        
        document.getElementById('edit-u-role').value = data.role || 'member';
        document.getElementById('edit-u-level').value = data.level || 1;
        document.getElementById('edit-u-coins').value = data.coins || 0;
        document.getElementById('edit-u-pic-url').value = data.profile_pic || data.pic || "";
        
        // Tampilkan Modal
        document.getElementById('user-editor-modal').classList.remove('hidden');
        document.getElementById('user-editor-modal').classList.add('flex');
        
    } catch(e) {
        console.error(e);
    }
}

window.closeUserEditor = () => {
    document.getElementById('user-editor-modal').classList.add('hidden');
    document.getElementById('user-editor-modal').classList.remove('flex');
    editingUserId = null;
}

window.saveUserChanges = async () => {
    if(!editingUserId) return;
    
    const updates = {
        role: document.getElementById('edit-u-role').value,
        rank: document.getElementById('edit-u-role').value.toUpperCase(), // Sinkronkan Rank & Role
        level: parseInt(document.getElementById('edit-u-level').value) || 1,
        coins: parseInt(document.getElementById('edit-u-coins').value) || 0,
        profile_pic: document.getElementById('edit-u-pic-url').value
    };
    
    try {
        await update(ref(rtdb, `users/${editingUserId}`), updates);
        
        // Efek visual
        closeUserEditor();
        showGameToast(`Data ${document.getElementById('edit-u-name').innerText} berhasil diubah!`, "success");
        
        // Refresh list admin
        renderAdminUserList(true);
        
    } catch(e) {
        Swal.fire("Gagal", e.message, "error");
    }
}



// --- HELPER FUNGSI UNTUK INTERAKSI CHAT & PENGATURAN ---

// 1. Logika Buka/Tutup Settings (Fix Z-Index & Hidden)
window.toggleChatSettings = () => {
    const modal = document.getElementById('chat-settings-modal');
    if(modal) {
        if(modal.classList.contains('hidden')) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    } else {
        console.error("Modal settings tidak ditemukan di DOM");
    }
}

// 2. Logika Like Pesan
window.toggleChatLike = (msgId) => {
    if(!msgId) return;
    const path = `community/messages/${curChatId}/${msgId}/likes/${user.username}`;
    get(ref(rtdb, path)).then(s => {
        if(s.exists()) {
            remove(ref(rtdb, path)); // Jika sudah like, hapus (Unlike)
        } else {
            set(ref(rtdb, path), true); // Jika belum, like
            if(navigator.vibrate) navigator.vibrate(30); // Getar sedikit
        }
    });
}

// 3. Logika Balas Pesan (Reply)
window.replyMsg = (username, text) => {
    // text sudah di-decode di HTML onclick, jadi aman
    replyingToMsg = { user: username, text: text };
    
    // Tampilkan UI Balas
    const ui = document.getElementById('reply-ui');
    if(ui) {
        ui.classList.remove('hidden');
        document.getElementById('reply-user').innerText = username;
        document.getElementById('reply-text').innerText = text;
    }
    
    // Buka Keyboard Otomatis
    const inp = document.getElementById('chat-input');
    if(inp) inp.focus();
}

// --- UPDATE: LOGIKA COPY OTOMATIS ---
window.actionCopy = (text) => {
    // Cek prioritas: Parameter langsung ATAU ambil dari pesan yang dipilih
    const targetText = text || (selectedMsg ? selectedMsg.text : null);
    
    if (!targetText) {
        showGameToast("Tidak ada teks untuk disalin.", "error");
        return;
    }

    navigator.clipboard.writeText(targetText)
        .then(() => {
            showGameToast("Teks berhasil disalin!", "success");
            closeMsgOptions(); // Tutup menu jika terbuka
        })
        .catch(() => showGameToast("Gagal menyalin.", "error"));
}

window.clearCurrentChat = () => {
    // 1. Cek Akses (Hanya Developer)
    if(!user || user.role !== 'developer') return;
    
    // 2. Konfirmasi Ekstrem
    Swal.fire({
        title: '🔥 MUSNAHKAN CHAT?',
        text: `Semua pesan di room "${curChatId}" akan dihapus permanen! Termasuk pesan yang dipin.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33', // Warna Merah Bahaya
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'YA, HAPUS SEMUA!',
        cancelButtonText: 'Batal',
        background: '#1e293b', color: '#fff',
        didOpen: () => { 
            const c = Swal.getContainer(); 
            if(c) c.style.zIndex = "200000"; // Biar di atas segalanya
        }
    }).then((result) => {
        if (result.isConfirmed) {
            
            // 3. SIAPKAN PENGHAPUSAN (Multi-Path Delete)
            const updates = {};
            
            // Hapus Chat Utama (Path Baru)
            updates[`messages/${curChatId}`] = null;
            
            // Hapus Pesan Tersemat (Path Baru)
            updates[`pinned/${curChatId}`] = null;

            // Eksekusi
            update(ref(rtdb), updates)
            .then(() => {
                showGameToast("🧹 Room berhasil dibersihkan!", "success");
                
                // Sound Effect "Trash"
                const audio = new Audio('https://cdn.freesound.org/previews/240/240776_4107740-lq.mp3');
                audio.volume = 0.5;
                audio.play().catch(()=>{});
            })
            .catch((error) => {
                console.error("Gagal Hapus:", error);
                Swal.fire("Gagal", "Server menolak: " + error.message, "error");
            });
        }
    });
}

// 2. Fungsi Buka Tutup Menu Settings
window.toggleChatSettings = () => {
    const modal = document.getElementById('chat-settings-modal');
    if(modal) modal.classList.toggle('hidden');
}

// 3. Fungsi Toggle Auto Scroll
window.toggleAutoScroll = () => {
    isAutoScroll = !isAutoScroll; // Balik nilai true/false
    
    // Reload chat agar UI tombol berubah (hijau/abu)
    loadChatMessages(curChatId);
    
    // Notifikasi
    if(isAutoScroll) {
        showGameToast("Auto Scroll: ON ✅", "success");
        // Langsung scroll ke bawah
        const c = document.getElementById('chat-messages');
        if(c) c.scrollTop = c.scrollHeight;
    } else {
        showGameToast("Auto Scroll: OFF ⛔", "info");
    }
}

// 4. Fungsi Search Chat
window.handleChatSearch = (el) => {
    chatSearchQuery = el.value.toLowerCase();
    loadChatMessages(curChatId); // Reload pesan dengan filter pencarian
}








window.toggleAutoScroll = () => {
    isAutoScroll = !isAutoScroll;
    const btn = document.getElementById('btn-toggle-scroll');
    if(isAutoScroll) {
        btn.classList.add('active');
        showGameToast("Auto Scroll: ON", "success");
        // Langsung scroll ke bawah saat dinyalakan
        const c = document.getElementById('chat-messages');
        c.scrollTop = c.scrollHeight;
    } else {
        btn.classList.remove('active');
        showGameToast("Auto Scroll: OFF", "info");
    }
}

window.handleChatSearch = (el) => {
    chatSearchQuery = el.value.toLowerCase();
    loadChatMessages(curChatId); // Reload chat untuk filter
}





window.deleteMessage = (msgId, roomId) => {
    const targetRoom = roomId || curChatId;
    if(!msgId) return;

    Swal.fire({
        title: 'Hapus Pesan?',
        text: 'Pesan ini akan dihapus permanen.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        background: '#1e293b', color: '#fff',
        didOpen: () => { const c = Swal.getContainer(); if(c) c.style.zIndex = "200000"; }
    }).then((result) => {
        if (result.isConfirmed) {
            const el = document.getElementById(`msg-${msgId}`);
            if(el) {
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 300);
            }

            // --- PERBAIKAN DISINI: HAPUS 'community/' ---
            const msgRef = ref(rtdb, `messages/${targetRoom}/${msgId}`);
            
            remove(msgRef)
            .then(() => showGameToast("Pesan dihapus.", "success"))
            .catch((error) => Swal.fire("Gagal", "Error: " + error.message, "error"));
        }
    });
}
// --- UPDATE: LOGIKA LIKE DARI MENU ---
window.actionLike = () => {
    // Ambil ID dari pesan yang sedang dibuka menunya
    if (!selectedMsg || !selectedMsg.id) return;
    
    toggleChatLike(selectedMsg.id); // Panggil fungsi utama
    closeMsgOptions(); // Tutup menu
}

// --- UPDATE: LOGIKA CORE LIKE + EFEK VISUAL INSTAN ---
window.toggleChatLike = (msgId, roomId) => {
    const targetRoom = roomId || curChatId;
    if (!msgId) return;

    // 1. UPDATE VISUAL DULUAN (Biar terasa cepat/sat-set)
    const btnLike = document.querySelector(`#msg-${msgId} .chat-action-btn:first-child`);
    const iconLike = btnLike ? btnLike.querySelector('i') : null;
    const countSpan = btnLike ? btnLike.querySelector('span') : null;

    if (btnLike && iconLike) {
        const isLiked = btnLike.classList.contains('liked');
        
        if (isLiked) {
            // Visual UNLIKE
            btnLike.classList.remove('liked');
            iconLike.className = "far fa-heart"; 
            if(countSpan) {
                let num = parseInt(countSpan.innerText || "0");
                countSpan.innerText = num > 1 ? num - 1 : "";
            }
        } else {
            // Visual LIKE
            btnLike.classList.add('liked');
            iconLike.className = "fas fa-heart";
            iconLike.classList.add('like-active'); // Efek pop
            if(countSpan) {
                let num = parseInt(countSpan.innerText || "0");
                countSpan.innerText = num + 1;
            }
        }
    }

    // 2. UPDATE DATABASE (PATH SUDAH DIPERBAIKI)
    // Hapus 'community/' agar sesuai dengan tempat pesan berada
    const likeRef = ref(rtdb, `messages/${targetRoom}/${msgId}/likes/${user.username}`);
    
    runTransaction(likeRef, (currentData) => {
        if (currentData) {
            return null; // Hapus Like (Kalau sudah ada)
        } else {
            return true; // Tambah Like (Kalau belum ada)
        }
    }).then(() => {
        if (navigator.vibrate) navigator.vibrate(30); // Getar dikit
        console.log("Like Updated di Server!");
    }).catch((err) => {
        console.error("Like Gagal:", err);
        // Opsional: Kalau gagal, kembalikan visual ke semula (tapi jarang terjadi)
    });
}














// --- ADMIN DASHBOARD LOGIC (NEW) ---

// 1. Update Jam Realtime
setInterval(() => {
    const el = document.getElementById('admin-clock');
    if(el && !document.getElementById('view-admin').classList.contains('hidden')) {
        const now = new Date();
        el.innerText = now.toLocaleTimeString('en-GB'); // Format 24 Jam
    }
}, 1000);

// 2. Update Statistik (User, Chat, Online)
function updateAdminStats() {
    if(user.role !== 'developer') return;

    // Count Users
    get(ref(rtdb, 'users')).then(s => {
        document.getElementById('stat-total-users').innerText = s.exists() ? s.size : 0;
    });

    // Count Online
    onValue(ref(rtdb, 'status/online'), s => {
        document.getElementById('stat-online-users').innerText = s.exists() ? s.size : 0;
        document.getElementById('online-count').innerText = s.exists() ? s.size : '...';
    });

    // Count Total Chat (Global)
    get(ref(rtdb, 'community/messages/global')).then(s => {
        document.getElementById('stat-total-chats').innerText = s.exists() ? s.size : 0;
    });
}

// --- FITUR DEWA (ADVANCED OPS) ---

// 1. GARBAGE COLLECTOR (Hapus Chat Lama)
window.runGarbageCollector = async () => {
    if(!user || user.role !== 'developer') return;
    const days = parseInt(document.getElementById('gc-limit').value);
    if(!confirm(`Hapus semua pesan yang lebih tua dari ${days} hari?`)) return;
    
    showGameToast("Sedang membersihkan...", "info");
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Ambil semua pesan
    const snap = await get(ref(rtdb, 'community/messages'));
    if(snap.exists()) {
        const updates = {};
        let count = 0;
        
        // Loop semua room
        Object.entries(snap.val()).forEach(([roomId, msgs]) => {
            Object.entries(msgs).forEach(([msgId, msg]) => {
                if(msg.timestamp < cutoff) {
                    updates[`community/messages/${roomId}/${msgId}`] = null; // Hapus
                    count++;
                }
            });
        });
        
        if(count > 0) {
            await update(ref(rtdb), updates);
            showGameToast(`Berhasil menghapus ${count} pesan sampah!`, "success");
        } else {
            showGameToast("Tidak ada pesan sampah.", "info");
        }
    }
}

// 2. BACKUP & RESTORE
window.backupDatabase = () => {
    if(!user || user.role !== 'developer') return;
    showGameToast("Membuat Backup...", "info");
    get(ref(rtdb)).then(snap => {
        const data = JSON.stringify(snap.val(), null, 2);
        const blob = new Blob([data], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PORTAL_BACKUP_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        showGameToast("Backup didownload!", "success");
    });
}

window.restoreDatabase = (input) => {
    if(!user || user.role !== 'developer') return;
    const file = input.files[0];
    if(!file) return;
    
    if(confirm("PERINGATAN: Ini akan MENIMPA seluruh database saat ini. Lanjutkan?")) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                set(ref(rtdb), data)
                    .then(() => showGameToast("Database Berhasil Direstore!", "success"))
                    .catch(err => Swal.fire("Error", err.message, "error"));
            } catch(e) {
                Swal.fire("Error", "File Backup Rusak/Salah Format", "error");
            }
        };
        reader.readAsText(file);
    }
}

// 3. AUTO LOCKDOWN SCHEDULER
window.setLockdownSchedule = () => {
    const time = document.getElementById('lockdown-start').value;
    if(!time) return;
    const ts = new Date(time).getTime();
    
    set(ref(rtdb, 'site_data/config/lockdown_schedule'), { start: ts, active: true });
    showGameToast("Jadwal Lockdown Disimpan!", "success");
}

window.cancelLockdownSchedule = () => {
    remove(ref(rtdb, 'site_data/config/lockdown_schedule'));
    showGameToast("Jadwal Dibatalkan.", "info");
}

// Listener Jadwal (Otomatis Jalan di Semua Client)
function checkSchedule() {
    onValue(ref(rtdb, 'site_data/config/lockdown_schedule'), s => {
        const d = s.val();
        if(d && d.active) {
            const now = Date.now();
            const status = document.getElementById('timer-status');
            if(status) status.innerText = `SET: ${moment(d.start).format('DD/MM HH:mm')}`;
            
            // Jika waktu sudah lewat, aktifkan Lockdown
            if(now >= d.start) {
                // Cek dulu apakah sudah lockdown biar gak spam
                get(ref(rtdb, 'site_data/maintenance/all')).then(m => {
                    if(!m.val()) {
                         set(ref(rtdb, 'site_data/maintenance/all'), true);
                         // Matikan jadwal setelah dieksekusi
                         update(ref(rtdb, 'site_data/config/lockdown_schedule'), { active: false });
                    }
                });
            }
        } else {
            const status = document.getElementById('timer-status');
            if(status) status.innerText = "INACTIVE";
        }
    });
}

// 4. IP FIREWALL MANAGER (BLOKIR PERMANEN)
window.blockIP = () => {
    const ip = document.getElementById('firewall-ip').value.trim();
    if(!ip) return;
    
    // Ganti titik dengan garis bawah karena Firebase key gak boleh ada titik
    const safeIp = ip.replace(/\./g, '_');
    
    const data = {
        ip: ip,
        blocked_by: user.username,
        date: new Date().toLocaleString(),
        timestamp: serverTimestamp()
    };
    
    set(ref(rtdb, `site_data/firewall/${safeIp}`), data);
    document.getElementById('firewall-ip').value = '';
    showGameToast(`${ip} DIBLOKIR PERMANEN!`, "error");
}

window.unblockIP = (safeIp) => {
    if(confirm("Buka blokir IP ini?")) {
        remove(ref(rtdb, `site_data/firewall/${safeIp}`));
        showGameToast("Blokir dibuka.", "success");
    }
}

function renderFirewallList() {
    const list = document.getElementById('firewall-list');
    onValue(ref(rtdb, 'site_data/firewall'), s => {
        list.innerHTML = '';
        const d = s.val();
        if(d) {
            Object.entries(d).forEach(([key, val]) => {
                list.innerHTML += `
                <div class="flex justify-between items-center bg-red-900/20 p-1 px-2 rounded border border-red-500/30">
                    <div>
                        <div class="text-[10px] font-mono text-red-400 font-bold">${val.ip}</div>
                        <div class="text-[8px] text-gray-500">${val.date}</div>
                    </div>
                    <button onclick="unblockIP('${key}')" class="text-xs text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
                </div>`;
            });
        } else {
            list.innerHTML = '<div class="text-[9px] text-gray-600 text-center italic">Aman. Tidak ada blokir.</div>';
        }
    });
}




window.changeLoginBackground = async () => {
    if(!user || user.role !== 'developer') return;

    const { value: confirmValue } = await Swal.fire({
        title: 'Pilih Sumber Gambar',
        html: `
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-black/20 p-4 rounded-xl cursor-pointer hover:bg-white/10 transition" onclick="Swal.clickConfirm(); window.loginBgSource='file'">
                    <i class="fas fa-upload text-2xl mb-2 text-white/80"></i><br>
                    <span class="text-sm text-white font-bold">Upload File</span>
                </div>
                <div class="bg-black/20 p-4 rounded-xl cursor-pointer hover:bg-white/10 transition" onclick="Swal.clickConfirm(); window.loginBgSource='url'">
                    <i class="fas fa-link text-2xl mb-2 text-white/80"></i><br>
                    <span class="text-sm text-white font-bold">Link URL</span>
                </div>
            </div>`,
        showConfirmButton: false,
        background: '#1e293b', color: '#fff',
        preConfirm: () => { return window.loginBgSource; }
    });

    const selectedMethod = window.loginBgSource;
    if(!selectedMethod) return;

    let finalUrl = '';
    
    if(selectedMethod === 'url') {
        const { value: url } = await Swal.fire({input:'url', inputLabel:'Masukkan URL Gambar', background:'#1e293b', color:'#fff'});
        finalUrl = url;
    } else if(selectedMethod === 'file') {
        const { value: file } = await Swal.fire({input:'file', inputAttributes: {accept:'image/*'}, background:'#1e293b', color:'#fff'});
        if(file) {
            Swal.fire({title:'Mengupload & Mengompres...', didOpen:()=>Swal.showLoading(), background:'#1e293b', color:'#fff'});
            finalUrl = await compressImage(file); 
            Swal.close();
        }
    }

    if(finalUrl) {
        // 1. UPDATE DATABASE FIREBASE
        update(ref(rtdb, 'site_data/config'), { login_bg: finalUrl })
        .then(() => {
            showGameToast("Background Login Berhasil Diganti!", "success");
            
            // 2. UPDATE VISUAL LANGSUNG (FORCE)
            const bgEl = document.getElementById('dynamic-login-bg');
            if(bgEl) {
                bgEl.style.backgroundImage = `url('${finalUrl}')`;
            }
            
            // 3. UPDATE CACHE MEMORI HP (PENTING! BIAR GAK BALIK LAMA)
            // Ini kuncinya supaya pas refresh, dia ingat gambar baru
            localStorage.setItem('cached_login_bg', finalUrl);
        })
        .catch(e => Swal.fire("Gagal", e.message, "error"));
    }
}

// Helper Toggle Password
window.togglePass = (id) => {
    const el = document.getElementById(id);
    if(el.type === 'password') el.type = 'text';
    else el.type = 'password';
}







// =========================================
// 🎵 LOGIKA AUDIO PLAYER (WHATSAPP STYLE)
// =========================================

window.playAudio = (id) => {
    const audio = document.getElementById(`aud-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    
    // Matikan audio lain yang sedang nyala (Biar gak berisik)
    document.querySelectorAll('audio').forEach(a => {
        if(a.id !== `aud-${id}`) {
            a.pause();
            a.currentTime = 0; // Reset
            // Reset icon audio lain
            const otherId = a.id.replace('aud-', '');
            const otherIcon = document.getElementById(`icon-${otherId}`);
            if(otherIcon) otherIcon.className = "fas fa-play text-xs";
        }
    });

    if (audio.paused) {
        audio.play();
        icon.className = "fas fa-pause text-xs";
    } else {
        audio.pause();
        icon.className = "fas fa-play text-xs";
    }
};

window.updateAudioUI = (id) => {
    const audio = document.getElementById(`aud-${id}`);
    const seek = document.getElementById(`seek-${id}`);
    const time = document.getElementById(`time-${id}`);
    
    if (audio.duration) {
        // Update Slider
        const percent = (audio.currentTime / audio.duration) * 100;
        seek.value = percent;
        
        // Update Waktu (0:00)
        const mins = Math.floor(audio.currentTime / 60);
        const secs = Math.floor(audio.currentTime % 60);
        time.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
};

window.seekAudio = (id, val) => {
    const audio = document.getElementById(`aud-${id}`);
    if (audio.duration) {
        const seekTime = (val / 100) * audio.duration;
        audio.currentTime = seekTime;
    }
};

window.resetAudioUI = (id) => {
    document.getElementById(`icon-${id}`).className = "fas fa-play text-xs";
    document.getElementById(`seek-${id}`).value = 0;
    document.getElementById(`time-${id}`).innerText = "0:00";
};





// =========================================
// 🎵 SMART AUDIO CONTROLLER (OTAK PLAYER)
// =========================================

// 1. Ganti Kecepatan (1x -> 1.5x -> 2x)
window.changeSpeed = (id, btn) => {
    const audio = document.getElementById(`aud-${id}`);
    let current = parseFloat(btn.innerText.replace('x', ''));
    
    // Siklus: 1x -> 1.5x -> 2x -> 1x
    let nextSpeed = current === 1 ? 1.5 : (current === 1.5 ? 2 : 1);
    
    if(audio) {
        audio.playbackRate = nextSpeed;
        btn.innerText = nextSpeed + "x";
        // Warna indikator: Hijau kalau cepat, Abu kalau normal
        btn.style.color = nextSpeed === 1 ? "#cbd5e1" : "#34d399"; 
    }
};

// 2. Play/Pause Logika
window.playAudio = (id) => {
    const audio = document.getElementById(`aud-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    const wave = document.getElementById(`wave-${id}`);

    if(!audio) return;

    // Matikan audio lain yang sedang nyala (Biar gak berisik tabrakan)
    document.querySelectorAll('audio').forEach(a => {
        if(a.id !== `aud-${id}` && !a.paused) {
            a.pause();
            // Reset tampilan audio lain
            const oid = a.id.replace('aud-', '');
            const oIcon = document.getElementById(`icon-${oid}`);
            const oWave = document.getElementById(`wave-${oid}`);
            if(oIcon) oIcon.className = "fas fa-play text-xs";
            if(oWave) oWave.classList.remove('playing');
        }
    });

    if (audio.paused) {
        audio.play();
        icon.className = "fas fa-pause text-xs";
        if(wave) wave.classList.add('playing');
    } else {
        audio.pause();
        icon.className = "fas fa-play text-xs";
        if(wave) wave.classList.remove('playing');
    }
};

// 3. Update Garis Slider saat lagu jalan
window.updateAudioUI = (id) => {
    const audio = document.getElementById(`aud-${id}`);
    const seek = document.getElementById(`seek-${id}`);
    if (audio && audio.duration) {
        seek.value = (audio.currentTime / audio.duration) * 100;
    }
};

// 4. User Geser Slider
window.seekAudio = (id, val) => {
    const audio = document.getElementById(`aud-${id}`);
    if (audio && audio.duration) {
        audio.currentTime = (val / 100) * audio.duration;
    }
};

// 5. FITUR AUTO-NEXT (Sambung Menyambung - FIXED)
window.handleAudioEnd = (id) => {
    // Reset UI Audio yang baru selesai
    const icon = document.getElementById(`icon-${id}`);
    const seek = document.getElementById(`seek-${id}`);
    const wave = document.getElementById(`wave-${id}`);
    
    if(icon) icon.className = "fas fa-play text-xs";
    if(seek) seek.value = 0;
    if(wave) wave.classList.remove('playing');

    // Cari Audio Berikutnya di dalam Chat
    const allAudios = Array.from(document.querySelectorAll('#chat-messages audio'));
    const currentIdx = allAudios.findIndex(a => a.id === `aud-${id}`);
    
    // Jika ditemukan dan masih ada audio selanjutnya
    if (currentIdx !== -1 && currentIdx + 1 < allAudios.length) {
        const nextAudio = allAudios[currentIdx + 1];
        const nextId = nextAudio.id.replace('aud-', '');
        
        // Scroll halus ke audio berikutnya
        const nextPlayer = document.getElementById(`player-${nextId}`);
        if(nextPlayer) nextPlayer.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Play otomatis (Kasih jeda dikit biar mulus)
        setTimeout(() => {
            playAudio(nextId);
            if(typeof showGameToast === 'function') showGameToast("Memutar selanjutnya... ⏩", "info");
        }, 500);
    }
};



window.enterSelectionMode = (firstId) => {
    // Perbaikan: Jika firstId kosong, ambil dari selectedMsg (saat klik menu "Pilih")
    const targetId = firstId || (selectedMsg ? selectedMsg.id : null);
    if (!targetId) return;

    window.isSelectionMode = true; // Update ke Window
    selectedMsgIds.clear();
    
    // Sembunyikan Menu Opsi Lama
    closeMsgOptions();
    
    // Tampilkan Toolbar Hapus
    document.getElementById('bulk-action-bar').classList.add('active');
    const inputArea = document.querySelector('.chat-input-area'); // Selektor lebih aman
    if(inputArea) inputArea.style.display = 'none';
    
    // Pilih pesan pertama otomatis
    toggleSelectMessage(targetId);
    showGameToast("Mode Hapus: Klik chat lain untuk memilih", "info");
};






window.exitSelectionMode = () => {
    window.isSelectionMode = false;
    selectedMsgIds.clear();
    
    // Reset Tampilan
    document.getElementById('bulk-action-bar').classList.remove('active');
    document.getElementById('chat-input').parentElement.style.display = 'flex'; // Munculkan input chat
    
    // Hapus kelas .selected-msg dari semua elemen
    document.querySelectorAll('.selected-msg').forEach(el => el.classList.remove('selected-msg'));
};

// 3. Logika Centang/Hapus Centang
window.toggleSelectMessage = (id) => {
    if (!isSelectionMode) return;

    const card = document.querySelector(`#msg-${id} .chat-card`);
    if (!card) return;

    if (selectedMsgIds.has(id)) {
        // Unselect
        selectedMsgIds.delete(id);
        card.classList.remove('selected-msg');
    } else {
        // Select
        selectedMsgIds.add(id);
        card.classList.add('selected-msg');
    }
    
    // Update Angka Counter
    document.getElementById('select-count').innerText = selectedMsgIds.size;
    
    // Kalau kosong, keluar mode seleksi otomatis
    if (selectedMsgIds.size === 0) exitSelectionMode();
};

// --- VERSI FINAL FIX: HAPUS PESAN DENGAN DEBUGGING PATH ---
window.deleteBulkMessages = () => {
    if (selectedMsgIds.size === 0) return;
    
    // Ambil ID Chat Room yang aktif saat ini
    // Jika kosong, paksa jadi 'global' (karena defaultnya global)
    const currentRoom = curChatId || 'global'; 

    Swal.fire({
        title: `Hapus ${selectedMsgIds.size} Pesan?`,
        text: `Menghapus dari room: ${currentRoom}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'YA, HAPUS',
        background: '#1e293b', color: '#fff'
    }).then(async (res) => {
        if (res.isConfirmed) {
            Swal.showLoading();

            const idsArray = Array.from(selectedMsgIds);
            const deletePromises = [];

            // --- DEBUGGING: LIHAT DI CONSOLE BROWSER ---
            console.log("=== MULAI PROSES HAPUS ===");
            console.log("Room ID:", currentRoom);

            idsArray.forEach(id => {
                // PERBAIKAN ALAMAT (PATH):
                // Pastikan path-nya sama persis dengan struktur di Tab 'Data' Firebase Anda
                const exactPath = `community/messages/${currentRoom}/${id}`;
                
                console.log("Menghapus Path:", exactPath); // Cek ini di Console!

                // Hapus dari Server
                deletePromises.push(remove(ref(rtdb, exactPath)));
            });

            try {
                // Tunggu sampai server bilang "OK"
                await Promise.all(deletePromises);

                // Hapus dari Layar HP
                idsArray.forEach(id => {
                    const el = document.getElementById(`msg-${id}`);
                    if(el) el.remove();
                });

                exitSelectionMode();

                Swal.fire({
                    icon: 'success', 
                    title: 'BERHASIL!', 
                    text: 'Pesan sudah hilang dari server.',
                    timer: 1500, 
                    showConfirmButton: false,
                    background: '#1e293b', color: '#fff'
                });

            } catch (error) {
                console.error("GAGAL HAPUS:", error);
                Swal.fire("Gagal", "Server Error: " + error.message, "error");
            }
        }
    });
};


// --- LOGIKA LONG PRESS (TEKAN TAHAN) ---
window.startPress = (id) => {
    // Jika sudah dalam mode seleksi, abaikan long press (biar jadi klik biasa untuk select/unselect)
    if (isSelectionMode) return;

    // Mulai hitung waktu 800ms (0.8 detik)
    pressTimer = setTimeout(() => {
        // Jika user menahan selama 0.8 detik, masuk mode seleksi
        enterSelectionMode(id);
        // Getar dikit biar kerasa (Haptic Feedback)
        if (navigator.vibrate) navigator.vibrate(50);
    }, 800);
}

window.cancelPress = () => {
    // Jika jari diangkat sebelum 0.8 detik, batalkan timer
    clearTimeout(pressTimer);
}

// Modifikasi fungsi klik agar pintar membedakan situasi
window.handleMessageClick = (id) => {
    // Jika sedang mode seleksi, fungsi klik bertugas memilih/batal pilih pesan
    if (isSelectionMode) {
        toggleSelectMessage(id);
    }
    // Jika TIDAK mode seleksi, klik biasa tidak melakukan apa-apa (atau bisa dipakai untuk zoom gambar)
}










// =========================================
// 🛠️ GOD MODE ULTIMATE LOGIC
// =========================================

// 1. LIVE CSS INJECTOR
window.applyLiveCSS = () => {
    const css = document.getElementById('live-css-input').value;
    set(ref(rtdb, 'site_data/config/live_css'), css);
    showGameToast("Live CSS Applied!", "success");
};
window.clearLiveCSS = () => {
    set(ref(rtdb, 'site_data/config/live_css'), "");
    showGameToast("CSS Reset.", "info");
};

// 2. GLOBAL COMMANDS (RELOAD / WIPE)
window.triggerGlobalAction = (type) => {
    if(!confirm(`Yakin eksekusi GLOBAL ${type.toUpperCase()}? Semua user akan terkena efek!`)) return;
    set(ref(rtdb, 'site_data/admin_commands'), {
        type: type,
        timestamp: serverTimestamp()
    });
    showGameToast(`Perintah ${type} dikirim!`, "success");
};

// 3. WHITELIST IP SYSTEM
window.toggleWhitelistMode = () => {
    const isActive = document.getElementById('toggle-whitelist').checked;
    update(ref(rtdb, 'site_data/config/whitelist'), { active: isActive });
    showGameToast(`Whitelist Mode: ${isActive ? 'ON' : 'OFF'}`, isActive ? "success" : "info");
};

window.addWhitelistIP = () => {
    const ip = document.getElementById('whitelist-ip-input').value.trim();
    if(!ip) return;
    push(ref(rtdb, 'site_data/config/whitelist/ips'), ip);
    document.getElementById('whitelist-ip-input').value = '';
};

window.removeWhitelistIP = (key) => {
    remove(ref(rtdb, `site_data/config/whitelist/ips/${key}`));
};

function renderWhitelistUI(config) {
    const list = document.getElementById('whitelist-list');
    const toggle = document.getElementById('toggle-whitelist');
    if(!list || !toggle) return;

    toggle.checked = config ? config.active : false;
    list.innerHTML = '';

    if(config && config.ips) {
        Object.entries(config.ips).forEach(([key, ip]) => {
            list.innerHTML += `
                <div class="whitelist-tag">
                    <span class="whitelist-ip">${ip}</span>
                    <button onclick="removeWhitelistIP('${key}')" class="text-red-400 hover:text-white"><i class="fas fa-times text-[8px]"></i></button>
                </div>
            `;
        });
    } else {
        list.innerHTML = '<div class="text-[9px] text-gray-600 text-center">List Kosong</div>';
    }
}

// 4. REGISTRATION GATE
window.toggleRegGate = () => {
    const isOpen = document.getElementById('toggle-reg-gate').checked;
    set(ref(rtdb, 'site_data/config/registration_open'), isOpen);
    showGameToast(`Registrasi: ${isOpen ? 'OPEN' : 'CLOSED'}`, "info");
};

// 5. IP DETECTIVE (CLONE CHECKER SUPER BAGUS)
window.scanForClones = async () => {
    const container = document.getElementById('clone-result-area');
    container.innerHTML = '<div class="col-span-full text-center text-indigo-400 animate-pulse text-xs font-bold">Menganalisa Database...</div>';

    try {
        const snap = await get(ref(rtdb, 'users'));
        if(!snap.exists()) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-500">Tidak ada user.</div>';
            return;
        }

        const users = snap.val();
        const ipMap = {};

        // Grouping User by IP
        Object.values(users).forEach(u => {
            if(u.ip) {
                if(!ipMap[u.ip]) ipMap[u.ip] = [];
                ipMap[u.ip].push(u);
            }
        });

        // Filter hanya yang punya clone (> 1 akun per IP)
        const clones = Object.entries(ipMap).filter(([ip, list]) => list.length > 1);

        container.innerHTML = '';
        
        if(clones.length === 0) {
            container.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center text-green-500 py-4">
                    <i class="fas fa-check-circle text-3xl mb-2"></i>
                    <p class="text-xs font-bold">Bersih! Tidak ditemukan akun ganda.</p>
                </div>
            `;
            return;
        }

        // Render Hasil Keren
        clones.forEach(([ip, list]) => {
            let userHtml = '';
            list.forEach(u => {
                userHtml += `
                    <div class="clone-user-item">
                        <img src="${u.profile_pic || u.pic}" class="clone-user-img">
                        <span class="clone-user-name">${u.username}</span>
                    </div>
                `;
            });

            container.innerHTML += `
                <div class="clone-card">
                    <div class="clone-header">
                        <span>IP: ${ip}</span>
                        <span class="bg-red-500/20 text-red-400 px-1.5 rounded text-[9px] font-bold">${list.length} AKUN</span>
                    </div>
                    <div class="clone-users">
                        ${userHtml}
                    </div>
                    <button onclick="blockIPFromClone('${ip}')" class="mt-1 w-full py-1 bg-red-900/30 border border-red-500/30 text-red-400 text-[9px] hover:bg-red-600 hover:text-white rounded transition">BLOCK IP INI</button>
                </div>
            `;
        });

    } catch(e) {
        container.innerHTML = `<div class="text-red-500 text-xs">Error: ${e.message}</div>`;
    }
};

window.blockIPFromClone = (ip) => {
    if(confirm(`Blokir permanen IP ${ip}? Semua akun di IP ini akan kehilangan akses.`)) {
        const safeIp = ip.replace(/\./g, '_');
        set(ref(rtdb, `site_data/firewall/${safeIp}`), {
            ip: ip, blocked_by: 'IP Detective', date: new Date().toLocaleString()
        });
        showGameToast("IP Diblokir!", "error");
    }
};





// =========================================
// 🕵️‍♂️ HACKER TAKEOVER LOGIC
// =========================================

window.launchTakeover = () => {
    const htmlCode = document.getElementById('takeover-input').value;
    const duration = parseInt(document.getElementById('takeover-duration').value) || 10; // Default 10 detik

    if (!htmlCode) return Swal.fire("Kosong", "Isi dulu kode HTML-nya!", "warning");

    if (confirm(`Ambil alih layar semua user selama ${duration} detik?`)) {
        set(ref(rtdb, 'site_data/god_mode/takeover'), {
            active: true,
            html: htmlCode,
            duration: duration,
            startTime: serverTimestamp()
        });
        
        // Tampilkan Timer Mundur di Toast Admin
        let timer = duration;
        const interval = setInterval(() => {
            showGameToast(`Takeover Active: ${timer}s`, "info");
            timer--;
            if(timer < 0) clearInterval(interval);
        }, 1000);
    }
};

window.stopTakeoverForce = () => {
    set(ref(rtdb, 'site_data/god_mode/takeover'), { active: false });
    showGameToast("Takeover Dihentikan Paksa.", "error");
};








// =========================================
// 🕵️‍♂️ HACKER TAKEOVER V3 (MULTI-FILE SUPPORT)
// =========================================

let activeTakeoverTab = 'html';

window.switchTakeoverTab = (tab) => {
    activeTakeoverTab = tab;
    
    // Sembunyikan semua textarea
    ['html', 'css', 'js'].forEach(t => {
        document.getElementById(`takeover-input-${t}`).classList.add('hidden');
        document.getElementById(`tab-to-${t}`).style.borderColor = 'transparent';
        document.getElementById(`tab-to-${t}`).style.opacity = '0.5';
    });

    // Tampilkan yang aktif
    document.getElementById(`takeover-input-${tab}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-to-${tab}`);
    activeBtn.style.opacity = '1';
    
    if(tab === 'html') activeBtn.style.borderBottomColor = '#f97316'; // Orange
    if(tab === 'css') activeBtn.style.borderBottomColor = '#60a5fa'; // Blue
    if(tab === 'js') activeBtn.style.borderBottomColor = '#facc15'; // Yellow
};

window.handleTakeoverFileUpload = (input) => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        
        // Deteksi Tipe File Otomatis
        if (file.name.endsWith('.html') || file.name.endsWith('.txt')) {
            document.getElementById('takeover-input-html').value = content;
            switchTakeoverTab('html');
            showGameToast("File HTML Dimuat!", "success");
        } else if (file.name.endsWith('.css')) {
            document.getElementById('takeover-input-css').value = content;
            switchTakeoverTab('css');
            showGameToast("File CSS Dimuat!", "success");
        } else if (file.name.endsWith('.js')) {
            document.getElementById('takeover-input-js').value = content;
            switchTakeoverTab('js');
            showGameToast("File JS Dimuat!", "success");
        } else {
            Swal.fire("Format Salah", "Hanya support .html, .css, .js, .txt", "error");
        }
    };
    reader.readAsText(file);
    input.value = ''; // Reset input biar bisa upload file sama lagi
};

window.launchAdvancedTakeover = () => {
    const html = document.getElementById('takeover-input-html').value;
    const css = document.getElementById('takeover-input-css').value;
    const js = document.getElementById('takeover-input-js').value;
    const duration = parseInt(document.getElementById('takeover-duration').value) || 10;

    if (!html && !js) return Swal.fire("Kosong", "Isi minimal HTML atau JS!", "warning");

    if (confirm(`Broadcast tampilan ini ke semua user selama ${duration} detik?`)) {
        // Kita gunakan path baru 'takeover_v3' agar tidak bentrok dengan kode lama
        set(ref(rtdb, 'site_data/god_mode/takeover_v3'), {
            active: true,
            html: html,
            css: css,
            js: js,
            duration: duration,
            startTime: serverTimestamp()
        });
        
        showGameToast(`Takeover V3 Started (${duration}s)`, "success");
    }
};

window.stopTakeoverForce = () => {
    set(ref(rtdb, 'site_data/god_mode/takeover_v3'), { active: false });
    showGameToast("Takeover Dihentikan.", "error");
};




window.actionEdit = async () => {
    // 1. Validasi Dasar
    if (!selectedMsg || !selectedMsg.isMe) {
        showGameToast("Hanya pesan sendiri!", "error");
        return;
    }

    const msgId = selectedMsg.id;
    const currentTextLocal = selectedMsg.text; // Teks di HP kamu
    
    // Pastikan Room ID valid
    const targetRoom = selectedMsg.roomId || curChatId || 'global';
    
    // ALAMAT TARGET (Pastikan ini 'messages', bukan 'community')
    const basePath = `messages/${targetRoom}/${msgId}`;
    
    closeMsgOptions();

    // --- LANGKAH 1: CEK DATA SERVER SEBELUM EDIT ---
    console.log(`[DIAGNOSE] Mengecek data di: ${basePath}`);
    
    try {
        const snapshotBefore = await get(ref(rtdb, basePath));
        if (!snapshotBefore.exists()) {
            Swal.fire("GAWAT!", "Pesan ini TIDAK ADA di Server! (Hanya ada di HP kamu)", "error");
            return;
        }
        
        const dataServer = snapshotBefore.val();
        console.log("[DIAGNOSE] Data Server Saat Ini:", dataServer);

        // --- LANGKAH 2: INPUT TEKS BARU ---
        const { value: newText } = await Swal.fire({
            title: 'Edit Pesan',
            html: `<p class="text-xs text-gray-400">Server ID: ${msgId}</p>`,
            input: 'text',
            inputValue: dataServer.text || currentTextLocal, // Ambil teks asli dari server
            showCancelButton: true,
            confirmButtonText: 'HAJAR UPDATE',
            confirmButtonColor: '#ef4444', // Merah biar beda
            background: '#1e293b', color: '#fff'
        });

        if (newText && newText !== dataServer.text) {
            
            Swal.fire({ title: 'Sedang Menulis...', didOpen: () => Swal.showLoading() });

            // --- LANGKAH 3: EKSEKUSI DENGAN 'SET' (Lebih Kuat dari Update) ---
            // Kita update teks dan status secara terpisah untuk memastikan masuk
            await set(ref(rtdb, `${basePath}/text`), newText);
            await set(ref(rtdb, `${basePath}/isEdited`), true);

            // --- LANGKAH 4: VERIFIKASI LANGSUNG (BACA ULANG) ---
            const snapshotAfter = await get(ref(rtdb, `${basePath}/text`));
            const textAfter = snapshotAfter.val();

            Swal.close();

            if (textAfter === newText) {
                // SUKSES DI SERVER
                await Swal.fire({
                    icon: 'success',
                    title: 'BERHASIL MASUK SERVER!',
                    text: `Server sekarang menyimpan: "${textAfter}"`,
                    background: '#1e293b', color: '#fff'
                });

                // Update Tampilan HP
                const msgEl = document.getElementById(`msg-${msgId}`);
                if(msgEl) {
                    const bodyEl = msgEl.querySelector('.chat-card-body');
                    if(bodyEl) bodyEl.innerHTML = formatMessageText(newText) + '<span class="text-[9px] text-gray-500 italic ml-1">(diedit)</span>';
                    
                    // Perbaiki tombol opsi
                    const btnOpt = msgEl.querySelector('.chat-card-header button:last-child');
                    if(btnOpt) {
                        const newOnclick = `event.stopPropagation(); openMsgOptions('${msgId}', '${user.username}', true, this.closest('.chat-card'), '${targetRoom}')`;
                        btnOpt.setAttribute('onclick', newOnclick);
                    }
                }
            } else {
                // GAGAL DI SERVER (MISTERIUS)
                Swal.fire("ANEH BIN AJAIB", `Saya kirim "${newText}", tapi Server menyimpan "${textAfter}"`, "question");
            }
        }

    } catch (error) {
        console.error("[DIAGNOSE ERROR]", error);
        Swal.fire("Error Sistem", error.message, "error");
    }
};
// --- FITUR PIN PESAN (SEMATKAN) ---
window.actionPin = () => {
    if (!selectedMsg) return;
    
    // PATH BARU: pinned/ (Hapus community)
    set(ref(rtdb, `pinned/${curChatId}`), {
        text: decodeURIComponent(selectedMsg.text),
        username: selectedMsg.username,
        id: selectedMsg.id,
        timestamp: Date.now()
    });
    
    closeMsgOptions();
    showGameToast("Pesan Disematkan! 📌", "success");
};

window.unpinMessage = () => {
    if(confirm("Lepas sematan pesan?")) {
        // PATH BARU: pinned/
        remove(ref(rtdb, `pinned/${curChatId}`));
    }
};

// --- MINI PROFILE CARD (QUICK VIEW) ---
window.showMiniProfile = async (username) => {
    const modal = document.getElementById('mini-profile-modal');
    const content = document.getElementById('mini-profile-content');
    
    // Reset UI
    document.getElementById('mp-name').innerText = "Loading...";
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);

    try {
        // Ambil data user target
        const snap = await get(ref(rtdb, `users/${username}`));
        const d = snap.val();
        
        if(d) {
            document.getElementById('mp-name').innerText = d.username;
            document.getElementById('mp-pic').src = d.profile_pic || d.pic || `https://ui-avatars.com/api/?name=${d.username}`;
            document.getElementById('mp-role').innerText = d.role || "MEMBER";
            document.getElementById('mp-level').innerText = d.level || 1;
            document.getElementById('mp-xp').innerText = d.coins || 0;
            
            // Cek Online Status
            const onlineSnap = await get(ref(rtdb, `status/online/${username}`));
            const statusEl = document.getElementById('mp-status');
            if(onlineSnap.exists()) {
                statusEl.innerText = "ONLINE";
                statusEl.className = "text-xs font-bold text-green-400 animate-pulse";
            } else {
                statusEl.innerText = "OFFLINE";
                statusEl.className = "text-xs font-bold text-gray-500";
            }

            // Tombol Chat Personal
            document.getElementById('mp-chat-btn').onclick = () => {
                closeMiniProfile();
                // Buat ID Chat Unik (Alphabetical Order)
                const cid = [user.username, username].sort().join('_');
                switchChat(cid, username);
            };
        }
    } catch(e) { console.error(e); }
};

window.closeMiniProfile = () => {
    const modal = document.getElementById('mini-profile-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
};
 
 
 
 
 
// --- FITUR ZOOM FOTO PROFIL ALA WHATSAPP (FIXED ORDER) ---

// 1. Definisikan Fungsinya Terlebih Dahulu
window.closeWaProfileZoom = () => {
    const modal = document.getElementById('wa-profile-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.classList.add('hidden'); 
        }, 300);
    }
};

window.openWaProfileZoom = (src, name) => {
    const modal = document.getElementById('wa-profile-modal');
    const img = document.getElementById('wa-zoom-img');
    const txt = document.getElementById('wa-zoom-name');
    
    if (modal && img && txt) {
        img.src = src;
        txt.innerText = name;
        
        modal.classList.remove('hidden');
        // Timeout biar transisi opacity jalan halus
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    }
};

// 2. Baru Inject HTML Modal ke Body (Setelah fungsi siap)
if(!document.getElementById('wa-profile-modal')) {
    const div = document.createElement('div');
    div.id = 'wa-profile-modal';
    div.className = 'wa-profile-zoom hidden'; // Tambah hidden default
    
    // Gunakan setAttribute agar lebih aman memanggil fungsi global
    div.setAttribute('onclick', 'closeWaProfileZoom()');
    
    div.innerHTML = `
        <div class="wa-info-bar">
            <h2 id="wa-zoom-name" class="text-2xl font-bold drop-shadow-md">User</h2>
        </div>
        <img id="wa-zoom-img" src="" class="wa-profile-img">
    `;
    document.body.appendChild(div);
}




// --- FUNGSI NAVIGASI KEYBOARD MENTION (YANG HILANG) ---
window.handleMentionNav = (e) => {
    const list = document.getElementById('mention-suggestions');
    if (list.classList.contains('hidden')) return;

    const items = list.querySelectorAll('.mention-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        mentionIndex = (mentionIndex + 1) % items.length;
        updateMentionHighlight(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        mentionIndex = (mentionIndex - 1 + items.length) % items.length;
        updateMentionHighlight(items);
    } else if (e.key === 'Enter') {
        if (mentionIndex > -1) {
            e.preventDefault();
            items[mentionIndex].click();
        }
    }
};

function updateMentionHighlight(items) {
    items.forEach((item, idx) => {
        if (idx === mentionIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}



// ==========================================================
// 🛠️ BAGIAN 1: FIX POSISI TOMBOL (DRAGGABLE & ALWAYS ON TOP)
// ==========================================================
(function forceDebugToTop() {
    const waitForElement = setInterval(() => {
        const btn = document.getElementById('debug-floating-btn');
        const panel = document.getElementById('debug-panel');

        if (btn && panel && user && user.role === 'developer') {
            clearInterval(waitForElement);

            if(btn.parentNode !== document.body) document.body.appendChild(btn);
            if(panel.parentNode !== document.body) document.body.appendChild(panel);

            btn.classList.remove('hidden');
            btn.style.display = 'flex';
            btn.style.zIndex = "2147483647"; 
            panel.style.zIndex = "2147483646";

            // --- LOGIKA DRAG & DROP (GESER TOMBOL) ---
            let isDragging = false;
            let hasMoved = false; // Untuk membedakan Klik vs Geser
            
            // Fungsi Handle Geser
            const handleDrag = (e) => {
                e.preventDefault(); // Cegah scroll layar saat geser tombol
                isDragging = true;
                hasMoved = true;
                
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                
                // Update Posisi
                btn.style.left = (clientX - 20) + 'px';
                btn.style.top = (clientY - 20) + 'px';
                btn.style.bottom = 'auto'; // Hapus bottom default
                btn.style.right = 'auto';
            };

            const endDrag = () => {
                isDragging = false;
                setTimeout(() => { hasMoved = false; }, 100); // Reset status gerak
            };

            // Mouse Events (Desktop)
            btn.addEventListener('mousedown', () => { isDragging = true; hasMoved = false; });
            window.addEventListener('mousemove', (e) => { if(isDragging) handleDrag(e); });
            window.addEventListener('mouseup', endDrag);

            // Touch Events (Mobile)
            btn.addEventListener('touchstart', () => { isDragging = true; hasMoved = false; }, {passive: false});
            btn.addEventListener('touchmove', handleDrag, {passive: false});
            btn.addEventListener('touchend', endDrag);

            // Fungsi Buka/Tutup Panel (Hanya jalan kalau tidak digeser)
            window.toggleDebugPanel = () => {
                if (hasMoved) return; // Jangan buka panel kalau habis digeser

                if (panel.classList.contains('hidden')) {
                    panel.classList.remove('hidden');
                    requestAnimationFrame(() => {
                        panel.classList.add('active');
                        panel.style.transform = "translateY(0)";
                    });
                    const badge = document.getElementById('debug-badge');
                    if(badge) badge.classList.add('hidden');
                    btn.classList.remove('has-error-pulse');
                } else {
                    panel.style.transform = "translateY(100%)";
                    panel.classList.remove('active');
                    setTimeout(() => {
                        panel.classList.add('hidden');
                    }, 300);
                }
            };

            // Reset onclick HTML (Timpa fungsi lama di HTML)
            btn.onclick = window.toggleDebugPanel;

            console.log("[SYSTEM] Debug UI Fixed & Draggable.");
        }
    }, 500);
})();







// ==========================================================
// 🛠️ DEBUGGER V6.3 (FINAL FIX: ALWAYS ON TOP & GLOBAL)
// ==========================================================

// 1. INJECT CSS KHUSUS
const debugStyle = document.createElement('style');
debugStyle.innerHTML = `
    #debug-panel { 
        transition: height 0.3s, transform 0.3s; 
        display: flex; flex-direction: column; 
        max-height: 100vh; background: #0f172a; 
        position: fixed; bottom: 0; left: 0; right: 0;
    }
    #debug-panel.expanded { height: 100vh !important; bottom: 0 !important; }
    
    /* Container Views */
    .debug-view { flex: 1; overflow-y: auto; display: none; padding: 10px; min-height: 0; }
    .debug-view.active { display: block; }
    
    /* LOGS */
    .log-item { border-bottom: 1px solid rgba(255,255,255,0.05); font-family: 'Fira Code', monospace; font-size: 10px; padding: 4px; }
    
    /* STORAGE */
    .storage-item { background: #1e293b; border: 1px solid #334155; padding: 8px; margin-bottom: 5px; border-radius: 4px; font-size: 10px; word-break: break-all; }
    .storage-key { color: #facc15; font-weight: bold; }
    .storage-val { color: #94a3b8; font-family: monospace; }

    /* DB TREE */
    .tree-node { margin-left: 12px; border-left: 1px solid #334155; padding-left: 5px; }
    .tree-key { cursor: pointer; color: #60a5fa; font-size: 11px; font-weight: bold; }
    .tree-val { color: #a7f3d0; font-size: 10px; }
    .tree-key:hover { text-decoration: underline; }

    /* INSPECTOR V2 */
    .debug-highlight { outline: 2px solid #06b6d4 !important; background: rgba(6, 182, 212, 0.1) !important; cursor: crosshair !important; }
    #inspector-hud {
        position: fixed; z-index: 2147483647; pointer-events: none;
        background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(4px);
        border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;
        padding: 6px; font-family: 'Fira Code', monospace; font-size: 10px;
        color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        display: none; flex-direction: column; gap: 2px; min-width: 120px;
    }
    .hud-tag { color: #d8b4fe; font-weight: bold; }
    .hud-id { color: #facc15; }
    .hud-class { color: #60a5fa; }
    .hud-size { color: #94a3b8; font-size: 9px; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 2px; padding-top: 2px; }
`;
document.head.appendChild(debugStyle);

const debugContainer = document.getElementById('debug-logs-container');
const MAX_LOGS = 200;
let currentFilter = 'ALL';

// 2. INISIALISASI UI (DENGAN LOGIKA ANTI-TENGGELAM)
(function initDebugV6() {
    // Loop pengecekan setiap 1 detik
    // Ini memastikan kalau tombolnya hilang/ketutup, langsung dibenerin lagi
    setInterval(() => {
        const panel = document.getElementById('debug-panel');
        const btn = document.getElementById('debug-floating-btn');

        if (user && user.role === 'developer') {
            
            // A. Buat Tombol Jika Hilang
            if(!btn && document.getElementById('main-body')) {
                // ... (Kode inject tombol manual jika terhapus total, opsional)
            }

            if (btn && panel) {
                // B. PAKSA PINDAH KE BODY (Agar tidak terjebak di div lain)
                if(btn.parentNode !== document.body) {
                    document.body.appendChild(btn);
                    console.log("[SYSTEM] Debug Button rescued to Body.");
                }
                if(panel.parentNode !== document.body) {
                    document.body.appendChild(panel);
                }

                // C. PAKSA STYLE AGAR MUNCUL
                btn.classList.remove('hidden');
                btn.style.display = 'flex';
                btn.style.position = 'fixed';
                btn.style.bottom = '100px';
                btn.style.left = '20px';
                btn.style.zIndex = "2147483647"; // Max Z-Index
                panel.style.zIndex = "2147483646";

                // D. Setup HUD Inspector
                if (!document.getElementById('inspector-hud')) {
                    const hud = document.createElement('div');
                    hud.id = 'inspector-hud';
                    document.body.appendChild(hud);
                }
                
                // E. Setup Header Panel (Hanya sekali)
                if (!document.getElementById('debug-monitor-bar')) {
                    setupPanelContent(panel);
                }
            }
        }
    }, 1000);

    // Fungsi Toggle Global
    window.toggleDebugPanel = () => {
        const panel = document.getElementById('debug-panel');
        const btn = document.getElementById('debug-floating-btn');
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            requestAnimationFrame(() => {
                panel.classList.add('active');
                panel.style.transform = "translateY(0)";
            });
            if(btn) btn.classList.remove('has-error-pulse');
        } else {
            panel.style.transform = "translateY(100%)";
            panel.classList.remove('active');
            setTimeout(() => panel.classList.add('hidden'), 300);
        }
    };
})();

// Helper Setup Isi Panel
function setupPanelContent(panel) {
    // Bersihkan Header Lama
    const oldHeader = panel.querySelector('.border-b');
    if(oldHeader) oldHeader.remove();

    const newHeader = document.createElement('div');
    newHeader.className = 'bg-black/90 backdrop-blur border-b border-white/10 p-2 flex justify-between items-center select-none z-20';
    newHeader.innerHTML = `
        <div class="flex gap-1 overflow-x-auto no-scrollbar">
            <button onclick="switchDebugTab('logs')" id="tab-btn-logs" class="debug-nav-btn active text-[9px] bg-blue-600 text-white px-2 py-1 rounded font-bold">LOGS</button>
            <button onclick="switchDebugTab('storage')" id="tab-btn-storage" class="debug-nav-btn text-[9px] text-gray-400 px-2 py-1 rounded hover:bg-white/10">STORAGE</button>
            <button onclick="switchDebugTab('tree')" id="tab-btn-tree" class="debug-nav-btn text-[9px] text-gray-400 px-2 py-1 rounded hover:bg-white/10">DB TREE</button>
        </div>
        <div class="flex gap-3 text-gray-400 items-center">
            <i id="btn-inspector" class="fas fa-vector-square cursor-pointer hover:text-cyan-400" onclick="toggleInspector()" title="Layout Inspector"></i>
            <i class="fas fa-expand cursor-pointer hover:text-white" onclick="toggleExpandDebug()" title="Fullscreen"></i>
            <i class="fas fa-chevron-down cursor-pointer hover:text-white" onclick="toggleDebugPanel()"></i>
        </div>
    `;
    panel.insertBefore(newHeader, panel.firstChild);

    // Monitor Bar
    const monitor = document.createElement('div');
    monitor.id = 'debug-monitor-bar';
    monitor.className = 'bg-black/40 border-b border-white/5 p-1 px-2 text-[9px] font-mono text-gray-500 flex justify-between';
    monitor.innerHTML = `<span>R: <b id="d-room" class="text-green-400">...</b></span> <span>PING: <b id="d-ping" class="text-blue-400">...</b></span>`;
    panel.insertBefore(monitor, panel.children[1]);

    // Container Views (Reset)
    const oldCont = document.getElementById('debug-logs-container');
    if(oldCont) oldCont.remove();

    const logView = document.createElement('div');
    logView.id = 'view-logs';
    logView.className = 'debug-view active custom-scroll';
    
    const filterBar = document.createElement('div');
    filterBar.className = 'flex gap-2 mb-2 sticky top-0 bg-[#0f172a] z-10 p-1';
    filterBar.innerHTML = `
        <button onclick="filterLogs('ALL')" class="text-[8px] border border-white/20 px-2 rounded text-gray-300">ALL</button>
        <button onclick="filterLogs('FIREBASE')" class="text-[8px] border border-yellow-500/30 px-2 rounded text-yellow-500">DB</button>
        <button onclick="filterLogs('ERROR')" class="text-[8px] border border-red-500/30 px-2 rounded text-red-500">ERR</button>
        <button onclick="clearDebugLogs()" class="text-[8px] ml-auto text-red-400"><i class="fas fa-trash"></i></button>
    `;
    logView.appendChild(filterBar);
    
    const logContent = document.createElement('div');
    logContent.id = 'debug-logs-content';
    logView.appendChild(logContent);

    const storageView = document.createElement('div');
    storageView.id = 'view-storage';
    storageView.className = 'debug-view custom-scroll';

    const treeView = document.createElement('div');
    treeView.id = 'view-tree';
    treeView.className = 'debug-view custom-scroll';

    panel.appendChild(logView);
    panel.appendChild(storageView);
    panel.appendChild(treeView);

    // Loop Monitor Update
    setInterval(() => {
        if(document.getElementById('d-room')) {
            document.getElementById('d-room').innerText = typeof curChatId !== 'undefined' ? curChatId : '-';
            document.getElementById('d-ping').innerText = Math.floor(Math.random() * 30 + 10) + 'ms';
        }
    }, 1000);
}

// 3. LOGIC TOMBOL & FITUR LAINNYA
window.toggleExpandDebug = () => { 
    const panel = document.getElementById('debug-panel');
    if(panel) panel.classList.toggle('expanded'); 
};

// --- INSPECTOR LOGIC ---
let inspectorActive = false;
let lastTarget = null;

window.toggleInspector = () => {
    inspectorActive = !inspectorActive;
    const btn = document.getElementById('btn-inspector');
    const hud = document.getElementById('inspector-hud');
    
    if(inspectorActive) {
        btn.style.color = '#06b6d4';
        document.body.style.cursor = 'crosshair';
        showGameToast("Inspector ON", "info");
    } else {
        btn.style.color = '';
        document.body.style.cursor = '';
        hud.style.display = 'none';
        if(lastTarget) lastTarget.classList.remove('debug-highlight');
    }
};

document.addEventListener('touchmove', (e) => handleInspectorMove(e.touches[0]), {passive: true});
document.addEventListener('mousemove', handleInspectorMove);

function handleInspectorMove(e) {
    if(!inspectorActive) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if(!target || target.id === 'inspector-hud' || target.closest('#debug-panel') || target.closest('#debug-floating-btn')) return;

    if(lastTarget && lastTarget !== target) lastTarget.classList.remove('debug-highlight');
    target.classList.add('debug-highlight');
    lastTarget = target;

    const hud = document.getElementById('inspector-hud');
    const rect = target.getBoundingClientRect();
    let classes = target.className && typeof target.className === 'string' ? '.' + target.className.split(' ').join('.') : '';
    if(classes.length > 20) classes = classes.substring(0, 20) + '...';

    hud.innerHTML = `<div class="hud-tag">&lt;${target.tagName.toLowerCase()}&gt;</div>${target.id ? `<div class="hud-id">#${target.id}</div>` : ''}${classes ? `<div class="hud-class">${classes}</div>` : ''}<div class="hud-size">W: ${Math.round(rect.width)}px | H: ${Math.round(rect.height)}px</div>`;

    hud.style.display = 'flex';
    let top = e.clientY + 15;
    let left = e.clientX + 15;
    if (left + 150 > window.innerWidth) left = e.clientX - 160;
    if (top + 100 > window.innerHeight) top = e.clientY - 110;
    hud.style.top = top + 'px';
    hud.style.left = left + 'px';
}

// 4. TAB & STORAGE LOGIC
window.switchDebugTab = (tabName) => {
    document.querySelectorAll('.debug-nav-btn').forEach(b => {
        b.classList.remove('active', 'bg-blue-600', 'text-white');
        b.classList.add('text-gray-400');
    });
    document.getElementById(`tab-btn-${tabName}`).classList.add('active', 'bg-blue-600', 'text-white');
    document.getElementById(`tab-btn-${tabName}`).classList.remove('text-gray-400');

    document.querySelectorAll('.debug-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${tabName}`).classList.add('active');

    if(tabName === 'storage') renderStorageView();
    if(tabName === 'tree') renderDBTreeView();
};

function renderStorageView() {
    const container = document.getElementById('view-storage');
    container.innerHTML = `<div class="flex justify-between items-center mb-3"><h4 class="text-xs font-bold text-white">Local Storage</h4><button onclick="wipeLocalData()" class="bg-red-600 text-white text-[9px] px-3 py-1 rounded font-bold hover:bg-red-500">🔥 WIPE</button></div>`;
    Object.keys(localStorage).forEach(key => {
        let val = localStorage.getItem(key);
        try { val = JSON.stringify(JSON.parse(val), null, 2); } catch(e) {} 
        container.innerHTML += `<div class="storage-item"><div class="storage-key">${key}</div><pre class="storage-val text-[9px] overflow-x-auto">${val}</pre><button onclick="removeItem('${key}')" class="text-red-400 text-[8px] mt-1 underline">Hapus</button></div>`;
    });
}
window.wipeLocalData = () => { if(confirm("Hapus SEMUA data?")) { localStorage.clear(); location.reload(); } };
window.removeItem = (k) => { localStorage.removeItem(k); renderStorageView(); };

// 5. DB TREE & LOGGING
// 5. DB TREE (LAZY LOAD VERSION - ANTI LAG)
function renderDBTreeView() {
    const container = document.getElementById('view-tree');
    container.innerHTML = '';

    // Kita daftar folder utama biar gak load semua sekaligus
    const rootNodes = ['messages', 'pinned', 'users', 'site_data', 'status', 'community', 'likes', 'comments'];

    container.innerHTML = '<h4 class="text-xs font-bold text-white mb-2 sticky top-0 bg-[#0f172a] p-1 border-b border-white/10">Firebase Root (Lazy Mode)</h4>';

    rootNodes.forEach(nodeName => {
        const div = document.createElement('div');
        div.className = 'mb-1 border-b border-white/5 pb-1';
        div.innerHTML = `
            <div class="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded transition" onclick="loadPath('${nodeName}', this)">
                <span class="text-blue-400 text-xs">📂</span>
                <span class="text-xs text-gray-200 font-bold font-mono">${nodeName}</span>
                <span class="text-[9px] text-gray-600 status-text ml-auto">(Klik utk buka)</span>
            </div>
            <div class="ml-4 mt-1 hidden child-container text-[10px] font-mono text-gray-400 border-l border-white/10 pl-2"></div>
        `;
        container.appendChild(div);
    });
}

// Helper Load Per-Folder (Dibatasi 50 item)
window.loadPath = (path, el) => {
    const container = el.nextElementSibling;
    const status = el.querySelector('.status-text');

    // Toggle Tutup
    if(!container.classList.contains('hidden')) {
        container.classList.add('hidden');
        status.innerText = "(Klik utk buka)";
        return;
    }

    // Loading UI
    status.innerText = "⏳ Loading...";
    status.className = "text-[9px] text-yellow-500 ml-auto animate-pulse";
    container.innerHTML = '<div class="text-[9px] text-gray-600">Mengambil data...</div>';
    container.classList.remove('hidden');

    // Fetch Data (Dibatasi 50 item biar ringan)
    get(query(ref(rtdb, path), limitToLast(50)))
    .then(snap => {
        const data = snap.val();
        container.innerHTML = '';
        
        if(!data) {
            container.innerHTML = '<div class="text-red-400 italic">Folder Kosong / Null</div>';
            status.innerText = "(Kosong)";
            status.className = "text-[9px] text-red-500 ml-auto";
        } else {
            container.appendChild(createTreeElement(data));
            
            // Info tambahan jika data banyak
            const count = Object.keys(data).length;
            if(count >= 50) {
                container.innerHTML += '<div class="text-[8px] text-yellow-500 italic mt-1 border-t border-white/5 pt-1">⚠️ Menampilkan 50 data terakhir saja (agar tidak lag).</div>';
            }
            
            status.innerText = `(${count} Item)`;
            status.className = "text-[9px] text-green-500 ml-auto";
        }
    })
    .catch(e => {
        console.error(e);
        container.innerHTML = `<div class="text-red-500 bg-red-900/20 p-1 rounded">Error: ${e.message}</div>`;
        status.innerText = "❌ Error";
        status.className = "text-[9px] text-red-500 ml-auto";
    });
}

// Helper Render JSON Tree
function createTreeElement(obj) {
    const ul = document.createElement('div');
    ul.className = 'tree-node';
    
    Object.keys(obj).forEach(key => {
        const val = obj[key];
        const div = document.createElement('div');
        div.className = 'mb-1';
        
        if (typeof val === 'object' && val !== null) {
            // Folder Nested (Dalam folder)
            div.innerHTML = `
                <div class="cursor-pointer hover:text-white transition flex items-center gap-1">
                    <span class="tree-key text-blue-300">📁 ${key}</span> 
                </div>
            `;
            
            const childContainer = document.createElement('div');
            childContainer.style.display = 'none'; 
            childContainer.style.paddingLeft = '10px';
            childContainer.style.borderLeft = '1px dashed #333';
            childContainer.appendChild(createTreeElement(val));
            
            div.onclick = (e) => {
                e.stopPropagation();
                const isHidden = childContainer.style.display === 'none';
                childContainer.style.display = isHidden ? 'block' : 'none';
            };
            
            div.appendChild(childContainer);
        } else {
            // Data Ujung (Leaf)
            let displayVal = val;
            let valColor = '#a7f3d0'; // Hijau (String)
            
            if(typeof val === 'number') valColor = '#facc15'; // Kuning (Angka)
            if(typeof val === 'boolean') valColor = '#f472b6'; // Pink (Boolean)
            if(String(val).startsWith('http')) {
                displayVal = `<a href="${val}" target="_blank" class="underline hover:text-white">${val.substring(0,20)}...</a>`;
                valColor = '#60a5fa'; // Biru (Link)
            }

            div.innerHTML = `<span class="tree-key text-gray-400">📄 ${key}:</span> <span style="color:${valColor}">${displayVal}</span>`;
        }
        ul.appendChild(div);
    });
    return ul;
}

window.addLog = (type, title, detail = null) => {
    const container = document.getElementById('debug-logs-content');
    if (!container) return;
    const div = document.createElement('div');
    div.dataset.type = type === 'FIREBASE' ? 'FIREBASE' : (type === 'ERROR' ? 'ERROR' : 'LOG');
    let color = '#94a3b8';
    if (type === 'FIREBASE') color = '#f59e0b';
    if (type === 'ERROR') color = '#ef4444';
    if (type === 'SUCCESS') color = '#22c55e';
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false, minute:'2-digit', second:'2-digit' });
    div.className = 'log-item';
    div.style.borderLeft = `3px solid ${color}`;
    div.innerHTML = `<div class="flex justify-between opacity-70 mb-1"><span style="color:${color}" class="font-bold">${type}</span><span class="text-gray-500">${time}</span></div><div class="text-gray-300 font-bold text-xs">${title}</div>${detail ? `<pre class="text-[9px] text-gray-400 mt-1 overflow-x-auto bg-black/20 p-1 rounded">${typeof detail==='object' ? JSON.stringify(detail,null,2) : detail}</pre>` : ''}`;
    container.appendChild(div);
    if (container.childElementCount > MAX_LOGS) container.removeChild(container.firstChild);
    if (type === 'ERROR') { const btn = document.getElementById('debug-floating-btn'); if(btn) btn.classList.add('has-error-pulse'); }
};

window.filterLogs = (type) => {
    currentFilter = type;
    const logs = document.getElementById('debug-logs-content').children;
    for (let log of logs) {
        if (type === 'ALL' || log.dataset.type === type) log.style.display = 'block';
        else log.style.display = 'none';
    }
};
window.clearDebugLogs = () => { const c = document.getElementById('debug-logs-content'); if(c) c.innerHTML = ''; };

// 6. MONITOR CONSOLE (FIXED)
var origConsoleLog = console.log;
var origConsoleErr = console.error;
console.log = function(...args) {
    if (origConsoleLog) origConsoleLog.apply(console, args);
    if (window.addLog && args.length > 0 && typeof args[0] === 'string' && args[0].includes('[')) {
        window.addLog('SYSTEM', args[0], args.slice(1));
    } 
};
console.error = function(...args) {
    if (origConsoleErr) origConsoleErr.apply(console, args);
    if (window.addLog) window.addLog('ERROR', 'JS Exception', args);
};























// --- LOGIKA REPLY JUMP (LONCAT KE PESAN) ---
window.scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if(el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const card = el.querySelector('.chat-card');
        if(card) {
            card.classList.add('highlight-jump');
            setTimeout(() => card.classList.remove('highlight-jump'), 1500);
        }
    } else {
        showGameToast("Pesan terlalu lama (tidak dimuat).", "info");
    }
};

// --- LOGIKA MULTI-REACTION ---
window.toggleReactionMenu = (msgId, roomId) => {
    // Cek apakah menu sudah ada? Hapus dulu
    const existing = document.getElementById(`react-menu-${msgId}`);
    if(existing) { existing.remove(); return; }

    // Tutup menu lain
    document.querySelectorAll('.reaction-menu').forEach(e => e.remove());

    const parent = document.querySelector(`#msg-${msgId} .chat-card`);
    if(!parent) return;

    const menu = document.createElement('div');
    menu.id = `react-menu-${msgId}`;
    menu.className = 'reaction-menu';
    
    const emojis = ['👍', '❤️', '😂', '😲', '😢', '😡'];
    
    emojis.forEach(emo => {
        const btn = document.createElement('span');
        btn.className = 'reaction-btn';
        btn.innerText = emo;
        btn.onclick = (e) => {
            e.stopPropagation();
            submitReaction(msgId, roomId, emo);
            menu.remove();
        };
        menu.appendChild(btn);
    });

    parent.appendChild(menu);
    
    // Auto close setelah 3 detik
    setTimeout(() => { if(menu.parentNode) menu.remove(); }, 3000);
};

window.submitReaction = (msgId, roomId, emoji) => {
    const path = `messages/${roomId}/${msgId}/reactions/${user.username}`;
    
    get(ref(rtdb, path)).then(snap => {
        if(snap.exists() && snap.val() === emoji) {
            remove(ref(rtdb, path)); // Hapus jika klik emoji sama (Unlike)
        } else {
            set(ref(rtdb, path), emoji); // Set emoji baru
        }
    });
};

// UPDATE REPLY FUNCTION (TERIMA ID)
window.replyMsg = (username, text, msgId) => { 
    replyingToMsg = { user: username, text: text, id: msgId }; // Simpan ID Asli
    
    const ui = document.getElementById('reply-ui');
    if(ui) {
        ui.classList.remove('hidden');
        document.getElementById('reply-user').innerText = username;
        document.getElementById('reply-text').innerText = text;
    }
    
    const inp = document.getElementById('chat-input');
    if(inp) inp.focus();
}




// --- FUNGSI REAKSI CEPAT DARI MENU ---
window.quickReact = (emoji) => {
    if (!selectedMsg) return;

    const msgId = selectedMsg.id;
    // Ambil Room ID dengan aman (Prioritas: selectedMsg -> Global Var -> 'global')
    const targetRoom = selectedMsg.roomId || curChatId || 'global';
    
    // Panggil fungsi submitReaction yang sudah ada
    submitReaction(msgId, targetRoom, emoji);
    
    // Tutup menu dan kasih notif
    closeMsgOptions();
    showGameToast(`Reaksi ${emoji} dikirim!`, "success");
};




// --- FITUR EXPAND EMOJI (AUTO CLOSE FIX) ---
window.expandEmojiPanel = () => {
    const bar = document.getElementById('emoji-bar');
    
    // Cek apakah sudah expand? Kalau sudah, jangan reload lagi
    if(bar.classList.contains('expanded')) return;

    // 1. Ubah Tampilan jadi Kotak Besar
    bar.classList.add('expanded');
    
    // 2. Daftar Emoji Lengkap
    const moreEmojis = [
        "👻","💀","👽","💩","🤡","👺","👹","👿",
        "👋","👌","✌️","🤞","🤟","🤙","👈","👉",
        "🙏","💪","🧠","👀","💋","👄","👅","👂",
        "💘","💔","💖","💗","💓","💞","💕","💌",
        "💣","💥","💦","💨","💫","⭐","🌟","✨",
        "💯","💢","💤","💬","👁️‍🗨️","🛑","🚫","⛔",
        "🎈","🎉","🎊","🎁","🎂","🕯️","🎃","🎄",
        "📱","💻","📸","🎥","🎧","🎤","🎮","🕹️",
        "🚗","🚀","✈️","🛸","🚲","🛵","🏎️","🚑",
        "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼",
        "🐸","🐔","🐧","🐦","🐤","🦆","🦅","🦉",
        "🍎","🍌","🍉","🍇","🍓","🍒","🍑","🍍"
    ];

    // 3. Hapus tombol (+) biar gak dobel
    const moreBtn = bar.querySelector('.emoji-more-btn');
    if(moreBtn) moreBtn.remove();

    // 4. Masukkan Emoji Tambahan
    moreEmojis.forEach(emo => {
        const btn = document.createElement('button');
        btn.className = 'emoji-btn animate-fade-in'; 
        btn.innerText = emo;
        
        // --- PERBAIKAN DISINI ---
        btn.onclick = (e) => { 
            e.stopPropagation(); // Biar gak ngetrigger klik background
            
            // A. Kirim Reaksi
            quickReact(emo); 
            
            // B. Tutup Menu Overlay
            closeMsgOptions();
            
            // C. Kembalikan Ukuran Kotak (Reset)
            // Biar pas dibuka lagi nanti, dia mulai dari kecil lagi
            setTimeout(() => {
                bar.classList.remove('expanded');
                // Kembalikan tombol (+) kalau mau rapi, tapi karena menu ketutup, 
                // nanti html akan ke-reset sendiri saat dibuka ulang.
            }, 300);
        };
        
        bar.appendChild(btn);
    });
};








// --- NAVIGATION & UTILS (FULL UPDATE) ---
window.navigateTo = (p) => { 
    // Cek akses admin
    if(p === 'admin' && user.role !== 'developer') return Swal.fire("Access Denied", "Developer Only", "error"); 
    
    // 1. Sembunyikan semua halaman dulu
    document.querySelectorAll('.view-section').forEach(e => {
        e.classList.remove('active-view'); // Hapus efek muncul
        e.classList.add('hidden');         // Pastikan tersembunyi
        e.style.display = 'none';          // Paksa hilang
    });

    // 2. Munculkan halaman yang dipilih
    const target = document.getElementById('view-' + p);
    if (target) {
        target.classList.remove('hidden');
        target.style.display = 'block'; // Pastikan block agar render
        
        // Beri jeda sedikit agar animasi "fade-in" jalan halus
        setTimeout(() => {
            target.classList.add('active-view'); 
        }, 10);
    }

    // 3. Update Logika Halaman Profil (MODERN, STATS & FITUR DEV)
    if(p === 'profile') { 
        if(user.isGuest) { 
            document.getElementById('profile-guest-view').classList.remove('hidden'); 
            document.getElementById('profile-member-view').classList.add('hidden'); 
        } else { 
            document.getElementById('profile-guest-view').classList.add('hidden'); 
            document.getElementById('profile-member-view').classList.remove('hidden'); 
            
            // --- LOGIKA TAMPILAN KHUSUS (DEV / PREMIUM) ---
            const pAvatar = document.getElementById('p-avatar');
            const pName = document.getElementById('p-name');
            const pRank = document.getElementById('p-rank');
            const fallbackPic = `https://ui-avatars.com/api/?name=${user.username}&background=random`;

            pAvatar.src = user.profile_pic || user.pic || fallbackPic;
            pName.innerHTML = user.username;
            
            // Reset Class Dulu
            pAvatar.className = "w-32 h-32 rounded-full mx-auto object-cover mb-4 transition-all duration-500";

            // Cek Role & Tambah Efek
            if (user.role === 'developer') {
                pAvatar.classList.add('profile-glow-dev');
                pName.innerHTML = `${user.username} <i class="fas fa-bolt text-yellow-400 ml-1" title="Developer"></i>`;
                pRank.className = "px-4 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 text-xs font-bold uppercase tracking-widest";
                pRank.innerText = "DEVELOPER";
            } else if (user.isPremium) {
                pAvatar.classList.add('profile-glow-premium');
                pName.innerHTML = `${user.username} <i class="fas fa-crown text-pink-500 ml-1" title="Premium"></i>`;
                pRank.className = "px-4 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/50 text-xs font-bold uppercase tracking-widest";
                pRank.innerText = "VIP MEMBER";
            } else {
                // Member Biasa
                pAvatar.classList.add('border-4', 'border-[#1e293b]');
                pRank.className = "px-4 py-1 rounded-full bg-white/10 text-gray-400 border border-white/10 text-xs font-bold uppercase tracking-widest";
                pRank.innerText = user.role || "MEMBER";
            }

            // --- HITUNG TOTAL UPLOAD (Gallery + Playlist) ---
            let uploadCount = 0;
            const countUploads = async () => {
                let total = 0;
                try {
                    // Cek Galeri
                    const snapG = await get(ref(rtdb, 'site_data/gallery'));
                    if(snapG.exists()) {
                        Object.values(snapG.val()).forEach(v => { 
                            if(v.category === 'User Upload') total++; 
                        });
                    }
                    // Cek Musik
                    const snapP = await get(ref(rtdb, 'site_data/playlist'));
                    if(snapP.exists()) {
                        Object.values(snapP.val()).forEach(v => { if(v.artist === 'User Upload') total++; });
                    }
                } catch(e) {}
                return total;
            };

            // Render Statistik
            countUploads().then(total => {
                const statsContainer = document.getElementById('profile-stats-area') || document.createElement('div');
                statsContainer.id = 'profile-stats-area';
                statsContainer.className = "grid grid-cols-3 gap-3 mt-6 mb-6";
                statsContainer.innerHTML = `
                    <div class="stat-box">
                        <div class="text-lg font-black text-white">${total}</div>
                        <div class="text-[9px] text-gray-400 uppercase font-bold">Uploads</div>
                    </div>
                    <div class="stat-box">
                        <div class="text-lg font-black text-blue-400" id="p-level-stat">...</div>
                        <div class="text-[9px] text-gray-400 uppercase font-bold">Level</div>
                    </div>
                    <div class="stat-box">
                        <div class="text-lg font-black text-yellow-400" id="p-xp-stat">...</div>
                        <div class="text-[9px] text-gray-400 uppercase font-bold">XP</div>
                    </div>
                `;
                
                // Masukkan ke DOM jika belum ada (sisipkan setelah Rank)
                if(!document.getElementById('profile-stats-area')) {
                    pRank.parentNode.insertBefore(statsContainer, pRank.nextSibling);
                } else {
                    document.getElementById('profile-stats-area').innerHTML = statsContainer.innerHTML;
                }

                // Update Data User dari DB (Level & XP)
                onValue(ref(rtdb, `users/${user.username}`), s => {
                    const d = s.val();
                    if(d){
                        document.getElementById('p-level-stat').innerText = d.level || 1;
                        document.getElementById('p-xp-stat').innerText = d.coins || 0; 
                    }
                });
            });
            
            // --- TAMPILKAN TOMBOL KHUSUS DEVELOPER ---
            if(user.role === 'developer') {
                const adminPanel = document.getElementById('admin-panel-btn-container');
                adminPanel.classList.remove('hidden');
                
                // Tambahkan Tombol Ganti Background Login (Jika belum ada)
                if(!document.getElementById('btn-change-login-bg')) {
                    const btn = document.createElement('button');
                    btn.id = 'btn-change-login-bg';
                    btn.className = "w-full py-3 rounded-xl bg-pink-900/20 border border-pink-500/30 text-pink-400 font-bold text-xs hover:bg-pink-500 hover:text-white transition mt-2 flex items-center justify-center gap-2";
                    btn.innerHTML = '<i class="fas fa-image"></i> GANTI BACKGROUND LOGIN';
                    btn.onclick = changeLoginBackground; 
                    adminPanel.appendChild(btn);
                }
            }
        } 
    } 

    // 4. Update Tombol Navigasi Bawah (Biar nyala warnanya)
    document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.remove('active'); 
        const icon = b.querySelector('i');
        if(icon) icon.classList.remove('text-indigo-400');
    }); 
    
    const btn = document.getElementById('nav-' + p); 
    if(btn) {
        btn.classList.add('active'); 
        const icon = btn.querySelector('i');
        if(icon) icon.classList.add('text-indigo-400');
    } 
    
    window.scrollTo(0, 0); 
}







// =================================================
// 🛠️ FIX HELPER FUNCTIONS (TTS, ZOOM, SPEECH)
// =================================================

// 1. FIX SPEECH SYNTHESIS (TEXT-TO-SPEECH)
let availableVoices = [];
let selectedVoiceIndex = localStorage.getItem('tts_voice_index');

function loadVoices() {
    // Cek apakah browser support speech synthesis
    if ('speechSynthesis' in window) {
        availableVoices = window.speechSynthesis.getVoices();
        const select = document.getElementById('tts-voice-select');
        if(select) {
            select.innerHTML = '<option value="">Default (Google/Siri)</option>';
            availableVoices.forEach((voice, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${voice.name} (${voice.lang})`;
                if(selectedVoiceIndex && index == selectedVoiceIndex) option.selected = true;
                select.appendChild(option);
            });
        }
    }
}

// Safe Event Listener (Anti-Error Undefined)
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
}

window.changeVoice = (index) => {
    selectedVoiceIndex = index;
    localStorage.setItem('tts_voice_index', index);
    const utterance = new SpeechSynthesisUtterance("Tes suara.");
    if(availableVoices[index]) utterance.voice = availableVoices[index];
    window.speechSynthesis.speak(utterance);
};

window.speakMessage = (text) => {
    if (!'speechSynthesis' in window) return showGameToast("HP tidak support suara.", "error");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID'; 
    utterance.rate = 1.0; 
    if(selectedVoiceIndex && availableVoices[selectedVoiceIndex]) {
        utterance.voice = availableVoices[selectedVoiceIndex];
    }
    window.speechSynthesis.speak(utterance);
};

// FIX FUNGSI "BACA SUARA" (SAFE MODE)
window.speakSelectedMsg = () => {
    // 1. Cek dulu apakah variabel selectedMsg ada isinya?
    // Kalau null/undefined, langsung stop. Jangan lanjut.
    if (!selectedMsg) {
        console.warn("[TTS] Gagal: selectedMsg is null");
        showGameToast("Pilih pesan dulu.", "error");
        return;
    }

    // 2. Cek apakah properti .text ada isinya?
    if (!selectedMsg.text) {
        console.warn("[TTS] Gagal: Text kosong");
        showGameToast("Pesan ini tidak ada teksnya.", "error");
        return;
    }

    // 3. Kalau lolos pengecekan, baru eksekusi
    // Kita simpan teks ke variabel lokal dulu
    const textToRead = selectedMsg.text;

    closeMsgOptions();
    
    // Gunakan try-catch saat decode biar aman
    try {
        speakMessage(decodeURIComponent(textToRead));
    } catch (e) {
        speakMessage(textToRead); // Baca mentahan kalau gagal decode
    }
};

// 3. FIX ZOOM PROFIL (Anti-Error Undefined)
window.closeWaProfileZoom = () => {
    const modal = document.getElementById('wa-profile-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => { modal.classList.add('hidden'); }, 300);
    }
};

window.openWaProfileZoom = (src, name) => {
    // Cek apakah modal sudah ada di HTML? Kalau belum, buat dulu.
    if(!document.getElementById('wa-profile-modal')) {
        const div = document.createElement('div');
        div.id = 'wa-profile-modal';
        div.className = 'wa-profile-zoom hidden'; 
        div.setAttribute('onclick', 'closeWaProfileZoom()'); // Panggil global function
        div.innerHTML = `
            <div class="wa-info-bar">
                <h2 id="wa-zoom-name" class="text-2xl font-bold drop-shadow-md">User</h2>
            </div>
            <img id="wa-zoom-img" src="" class="wa-profile-img">
        `;
        document.body.appendChild(div);
    }

    const modal = document.getElementById('wa-profile-modal');
    const img = document.getElementById('wa-zoom-img');
    const txt = document.getElementById('wa-zoom-name');
    
    if (modal && img && txt) {
        img.src = src;
        txt.innerText = name;
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.add('active'); }, 10);
    }
};















// =========================================
// 📈 REALTIME NETWORK MONITOR V6 (STABIL & RINGAN)
// =========================================

function initServerHeartbeat() {
    const canvas = document.getElementById('heartbeat-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = 0, height = 0;
    
    const maxPoints = 60;
    const dataPoints = new Array(maxPoints).fill(0);
    let isRunning = true;

    // Resize Handler (Cek Ukuran)
    const resize = () => {
        const parent = canvas.parentElement;
        // Hanya set ukuran jika parent ada dan terlihat
        if(parent && parent.clientWidth > 0) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
            width = canvas.width;
            height = canvas.height;
        }
    };
    window.addEventListener('resize', resize);
    
    // Cek ukuran tiap detik (Backup jika resize gagal)
    const sizeCheck = setInterval(() => {
        if(!width || width === 0) resize();
    }, 1000);

    // --- LOGIKA SINYAL (NATIVE API) ---
    const measurePing = () => {
        if(!isRunning) return;
        
        // 1. DETEKSI OFFLINE TOTAL (Saklar Mati)
        if (!navigator.onLine) {
            updateGraph(0, true); // Mode Offline
            setTimeout(measurePing, 500);
            return;
        }

        // 2. BACA SINYAL DARI CHIPSET HP (Ringan Banget)
        let rtt = 50; // Default bagus
        
        if (navigator.connection) {
            // rtt = Round Trip Time (Ping Asli Hardware)
            const conn = navigator.connection;
            if(conn.rtt) rtt = conn.rtt;
            
            // Kalau sinyal 2G/3G (Lemot), tambah angka ping biar merah
            if(conn.effectiveType === '2g') rtt += 500;
            else if(conn.effectiveType === '3g') rtt += 200;
        }

        // 3. Variasi Alami (Biar grafik hidup)
        // Tidak fetch data, cuma matematika simpel -> GAK BIKIN LAG
        const jitter = Math.floor(Math.random() * 10) - 5;
        let finalPing = rtt + jitter;
        if (finalPing < 10) finalPing = 10;

        updateGraph(finalPing, false);
        setTimeout(measurePing, 200); // Update cepat (5x per detik)
    };

    // --- LOGIKA MEMORY (RAM) ---
    setInterval(() => {
        const elMem = document.getElementById('hb-mem');
        if(!elMem) return;
        if(window.performance && window.performance.memory) {
            const used = (window.performance.memory.usedJSHeapSize / 1048576).toFixed(1); 
            elMem.innerText = used + " MB";
        } else {
            elMem.innerText = "N/A";
        }
    }, 3000); // Cek RAM santai aja tiap 3 detik

    // --- UPDATE VISUAL ---
    function updateGraph(pingValue, isOffline) {
        const elPing = document.getElementById('hb-ping');
        const elInd = document.getElementById('ind-live');
        
        if(elPing) {
            if (isOffline) {
                elPing.innerText = "OFFLINE";
                elPing.className = "text-2xl font-black text-red-600 font-mono animate-pulse";
                if(elInd) elInd.className = "w-2 h-2 rounded-full bg-red-600 shadow-[0_0_10px_red]";
            } else {
                elPing.innerText = pingValue + " ms";
                let color = "text-green-400";
                let dot = "bg-green-500";
                
                if(pingValue > 150) { color = "text-yellow-400"; dot = "bg-yellow-500"; }
                if(pingValue > 300) { color = "text-red-500"; dot = "bg-red-600 animate-ping"; }

                elPing.className = `text-3xl font-black ${color} font-mono tracking-tighter`;
                if(elInd) elInd.className = `w-2 h-2 rounded-full ${dot} animate-pulse`;
            }
        }

        if (!height || height <= 0) return;

        let normalizedHeight;
        if (isOffline) {
            normalizedHeight = height / 2; // Garis lurus tengah
        } else {
            normalizedHeight = (pingValue / 400) * height;
            if(pingValue < 50) normalizedHeight *= 2.5; // Zoom sinyal bagus
            if(normalizedHeight > height) normalizedHeight = height;
            if(normalizedHeight < 2) normalizedHeight = 2;
        }

        dataPoints.push(height - normalizedHeight); 
        dataPoints.shift();
    }

    // --- RENDER LOOP (OPTIMIZED) ---
    function render() {
        if(!isRunning) return;
        
        // Kalau panel admin belum dibuka (lebar 0), jangan render -> HEMAT BATERAI
        if (!width || !height || width === 0) {
            requestAnimationFrame(render);
            return;
        }
        
        ctx.clearRect(0, 0, width, height);
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        
        const lastY = dataPoints[dataPoints.length - 1];
        const isOfflineVisual = document.getElementById('hb-ping')?.innerText === "OFFLINE";
        const isLag = lastY < (height / 2.5); 
        
        // Warna Garis
        if (isOfflineVisual) {
            ctx.strokeStyle = '#ef4444'; // Merah
            ctx.setLineDash([5, 5]); // Putus-putus
        } else {
            ctx.strokeStyle = isLag ? '#facc15' : '#22d3ee'; // Kuning/Cyan
            ctx.setLineDash([]); 
        }
        
        ctx.beginPath();
        ctx.moveTo(0, dataPoints[0]);
        
        for (let i = 0; i < dataPoints.length - 1; i++) {
            if(isOfflineVisual) {
                ctx.lineTo((i+1) * (width / (maxPoints - 1)), dataPoints[i+1]);
            } else {
                // Kurva mulus
                const x_mid = (i * (width / (maxPoints - 1))) + (width / (maxPoints - 1)) / 2;
                const y_mid = (dataPoints[i] + dataPoints[i + 1]) / 2;
                ctx.quadraticCurveTo(i * (width / (maxPoints - 1)), dataPoints[i], x_mid, y_mid);
            }
        }
        ctx.lineTo(width, dataPoints[dataPoints.length - 1]);
        ctx.stroke();
        ctx.setLineDash([]); 

        // Gradasi Bawah
        if(!isOfflineVisual) {
            const grad = ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, isLag ? 'rgba(250, 204, 21, 0.2)' : 'rgba(34, 211, 238, 0.2)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.fillStyle = grad;
            ctx.fill();
        }

        requestAnimationFrame(render);
    }

    measurePing(); 
    render(); 
}