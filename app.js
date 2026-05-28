// OTPKey - 一次性密码生成器
// 使用 otpauth 库实现 TOTP

(function() {
  'use strict';

  // ========== 状态管理 ==========
  const STORAGE_KEY = 'otpkey_accounts';
  let accounts = [];
  let intervalId = null;

  // ========== DOM 元素 ==========
  const cardList = document.getElementById('cardList');
  const emptyState = document.getElementById('emptyState');
  const addModal = document.getElementById('addModal');
  const editModal = document.getElementById('editModal');
  const exportModal = document.getElementById('exportModal');
  const importModal = document.getElementById('importModal');
  const toast = document.getElementById('toast');

  // ========== 初始化 ==========
  function init() {
    loadAccounts();
    renderCards();
    startTicker();
    bindEvents();
  }

  // ========== 事件绑定 ==========
  function bindEvents() {
    // 添加账户
    document.getElementById('addBtn').addEventListener('click', () => openModal(addModal));
    document.getElementById('closeAddModal').addEventListener('click', () => closeModal(addModal));
    document.getElementById('cancelAdd').addEventListener('click', () => closeModal(addModal));
    document.getElementById('addForm').addEventListener('submit', handleAddAccount);

    // 编辑账户
    document.getElementById('closeEditModal').addEventListener('click', () => closeModal(editModal));
    document.getElementById('cancelEdit').addEventListener('click', () => closeModal(editModal));
    document.getElementById('editForm').addEventListener('submit', handleEditAccount);

    // 导出
    document.getElementById('exportBtn').addEventListener('click', () => openModal(exportModal));
    document.getElementById('closeExportModal').addEventListener('click', () => closeModal(exportModal));
    document.getElementById('cancelExport').addEventListener('click', () => closeModal(exportModal));
    document.getElementById('exportForm').addEventListener('submit', handleExport);

    // 导入
    document.getElementById('importBtn').addEventListener('click', () => openModal(importModal));
    document.getElementById('closeImportModal').addEventListener('click', () => closeModal(importModal));
    document.getElementById('cancelImport').addEventListener('click', () => closeModal(importModal));
    document.getElementById('importForm').addEventListener('submit', handleImport);

    // 点击弹窗背景关闭
    [addModal, editModal, exportModal, importModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    });

    // 卡片按钮事件委托
    cardList.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;

      const id = target.dataset.id;
      if (!id) return;

      if (target.classList.contains('edit-btn')) {
        editAccount(id);
      } else if (target.classList.contains('delete-btn')) {
        deleteAccount(id);
      }
    });

    // OTP 点击复制（事件委托）
    cardList.addEventListener('click', (e) => {
      const target = e.target.closest('.otp-code');
      if (!target) return;

      const id = target.dataset.id;
      if (id) copyOTP(target, id);
    });
  }

  // ========== 账户CRUD ==========
  function loadAccounts() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      accounts = data ? JSON.parse(data) : [];
      // 兼容旧数据：将 name 拆分为 issuer 和 account
      accounts = accounts.map(a => {
        if (a.name && !a.issuer) {
          a.issuer = a.name;
          a.account = a.account || '';
          delete a.name;
        }
        a.mode = a.mode || 'totp';
        a.algorithm = a.algorithm || 'SHA1';
        a.digits = a.digits || 6;
        a.period = a.period || 30;
        return a;
      });
    } catch (e) {
      accounts = [];
    }
  }

  function saveAccounts() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function handleAddAccount(e) {
    e.preventDefault();
    const issuer = document.getElementById('issuer').value.trim();
    const accountLabel = document.getElementById('account').value.trim();
    const secret = document.getElementById('secretKey').value.trim().toUpperCase().replace(/\s+/g, '');
    const mode = document.getElementById('mode').value;
    const algorithm = document.getElementById('algorithm').value;
    const digits = parseInt(document.getElementById('digits').value, 10);
    const period = parseInt(document.getElementById('period').value, 10);

    if (!issuer || !accountLabel || !secret) {
      showToast('请填写完整信息', 'error');
      return;
    }

    if (!isValidBase32(secret)) {
      showToast('密钥格式不正确，请检查Base32密钥', 'error');
      return;
    }

    const account = {
      id: generateId(),
      issuer: issuer,
      account: accountLabel,
      secret: secret,
      mode: mode,
      algorithm: algorithm,
      digits: digits,
      period: period,
      createdAt: Date.now()
    };

    accounts.push(account);
    saveAccounts();
    renderCards();

    document.getElementById('addForm').reset();
    // Reset selects to defaults
    document.getElementById('mode').value = 'totp';
    document.getElementById('algorithm').value = 'SHA1';
    document.getElementById('digits').value = '6';
    document.getElementById('period').value = '30';
    closeModal(addModal);
    showToast('账户添加成功', 'success');
  }

  function handleEditAccount(e) {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const issuer = document.getElementById('editIssuer').value.trim();
    const accountLabel = document.getElementById('editAccount').value.trim();
    const mode = document.getElementById('editMode').value;
    const algorithm = document.getElementById('editAlgorithm').value;
    const digits = parseInt(document.getElementById('editDigits').value, 10);
    const period = parseInt(document.getElementById('editPeriod').value, 10);

    if (!issuer || !accountLabel) {
      showToast('请填写完整信息', 'error');
      return;
    }

    const account = accounts.find(a => a.id === id);
    if (account) {
      account.issuer = issuer;
      account.account = accountLabel;
      account.mode = mode;
      account.algorithm = algorithm;
      account.digits = digits;
      account.period = period;
      saveAccounts();
      renderCards();
      closeModal(editModal);
      showToast('账户已更新', 'success');
    }
  }

  function deleteAccount(id) {
    if (confirm('确定要删除这个账户吗？')) {
      accounts = accounts.filter(a => a.id !== id);
      saveAccounts();
      renderCards();
      showToast('账户已删除', 'success');
    }
  }

  function editAccount(id) {
    const account = accounts.find(a => a.id === id);
    if (account) {
      document.getElementById('editId').value = account.id;
      document.getElementById('editIssuer').value = account.issuer || '';
      document.getElementById('editAccount').value = account.account || '';
      document.getElementById('editMode').value = account.mode || 'totp';
      document.getElementById('editAlgorithm').value = account.algorithm || 'SHA1';
      document.getElementById('editDigits').value = String(account.digits || 6);
      document.getElementById('editPeriod').value = String(account.period || 30);
      openModal(editModal);
    }
  }

  // ========== TOTP 生成 ==========
  function generateOTP(account) {
    try {
      const otpauth = new OTPAuth.TOTP({
        issuer: account.issuer || 'OTPKey',
        label: account.account || 'Account',
        algorithm: account.algorithm || 'SHA1',
        digits: account.digits || 6,
        period: account.period || 30,
        secret: OTPAuth.Secret.fromBase32(account.secret)
      });
      return otpauth.generate();
    } catch (e) {
      return '-'.repeat(account.digits || 6);
    }
  }

  function getTimeRemaining(account) {
    const period = account.period || 30;
    const now = Math.floor(Date.now() / 1000);
    return period - (now % period);
  }

  function getProgressPercent(account) {
    const period = account.period || 30;
    const remaining = getTimeRemaining(account);
    return (remaining / period) * 100;
  }

  // ========== Base32 验证 ==========
  function isValidBase32(str) {
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const padded = str.replace(/=+$/, '').toUpperCase();
    if (padded.length === 0) return false;
    for (const char of padded) {
      if (base32Chars.indexOf(char) === -1) return false;
    }
    return true;
  }

  // ========== 渲染 ==========
  function renderCards() {
    if (accounts.length === 0) {
      cardList.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    cardList.innerHTML = accounts.map(account => {
      const otp = generateOTP(account);
      const remaining = getTimeRemaining(account);
      const progress = getProgressPercent(account);
      const issuer = escapeHtml(account.issuer || '未知');
      const accountLabel = escapeHtml(account.account || '');
      const algoInfo = `${account.algorithm || 'SHA1'} · ${account.digits || 6}位 · ${account.period || 30}s`;

      return `
        <div class="card" data-id="${account.id}">
          <div class="card-header">
            <div class="card-info">
              <span class="card-issuer">${issuer}</span>
              <span class="card-account">${accountLabel}</span>
            </div>
            <div class="card-actions">
              <button class="edit-btn" data-id="${account.id}" title="编辑">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="delete-btn" data-id="${account.id}" title="删除">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
          <div class="card-body">
            <div class="otp-code" data-id="${account.id}">${otp}</div>
            <div class="countdown-wrapper">
              <div class="countdown-header">
                <span class="countdown-text">${remaining}秒</span>
                <span class="countdown-algo">${algoInfo}</span>
              </div>
              <div class="countdown-bar">
                <div class="countdown-progress" style="width: ${progress}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function startTicker() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      renderCards();
    }, 1000);
  }

  // ========== 复制功能 ==========
  function copyOTP(element, accountId) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;
    const otp = generateOTP(account);
    navigator.clipboard.writeText(otp).then(() => {
      element.classList.add('copied');
      showToast('已复制: ' + otp, 'success');
      setTimeout(() => {
        element.classList.remove('copied');
      }, 1000);
    }).catch(() => {
      showToast('复制失败', 'error');
    });
  }

  // ========== 加密备份 ==========
  async function exportBackup(password) {
    const data = JSON.stringify(accounts);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      new TextEncoder().encode(data)
    );

    const result = {
      version: 1,
      salt: arrayBufferToBase64(salt),
      iv: arrayBufferToBase64(iv),
      data: arrayBufferToBase64(encrypted)
    };

    return JSON.stringify(result);
  }

  async function importBackup(password, fileContent) {
    try {
      const backup = JSON.parse(fileContent);

      if (!backup.version || !backup.salt || !backup.iv || !backup.data) {
        throw new Error('无效的备份文件格式');
      }

      const salt = base64ToArrayBuffer(backup.salt);
      const iv = base64ToArrayBuffer(backup.iv);
      const encrypted = base64ToArrayBuffer(backup.data);

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );

      const data = JSON.parse(new TextDecoder().decode(decrypted));

      if (!Array.isArray(data)) {
        throw new Error('备份数据格式错误');
      }

      return data;
    } catch (e) {
      if (e.message.includes('decrypt') || e.message.includes('无效')) {
        throw new Error('密码错误或文件已损坏');
      }
      throw e;
    }
  }

  // ========== 工具函数 ==========
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  function openModal(modal) {
    modal.classList.add('active');
  }

  function closeModal(modal) {
    modal.classList.remove('active');
  }

  // ========== 表单处理 ==========
  async function handleExport(e) {
    e.preventDefault();
    const password = document.getElementById('exportPassword').value;
    const password2 = document.getElementById('exportPassword2').value;

    if (password !== password2) {
      showToast('两次密码不一致', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('密码至少6位', 'error');
      return;
    }

    try {
      const backup = await exportBackup(password);
      const blob = new Blob([backup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `otpkey-backup-${new Date().toISOString().slice(0,10)}.otpkey.json`;
      a.click();
      URL.revokeObjectURL(url);

      document.getElementById('exportForm').reset();
      closeModal(exportModal);
      showToast('备份已导出', 'success');
    } catch (e) {
      showToast('导出失败: ' + e.message, 'error');
    }
  }

  async function handleImport(e) {
    e.preventDefault();
    const password = document.getElementById('importPassword').value;
    const fileInput = document.getElementById('importFile');

    if (!fileInput.files || !fileInput.files[0]) {
      showToast('请选择备份文件', 'error');
      return;
    }

    try {
      const file = fileInput.files[0];
      const content = await file.text();
      const data = await importBackup(password, content);

      if (confirm(`确定要导入 ${data.length} 个账户吗？这将覆盖现有数据。`)) {
        accounts = data;
        saveAccounts();
        renderCards();
        document.getElementById('importForm').reset();
        closeModal(importModal);
        showToast('导入成功', 'success');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  // ========== 暴露API到全局 ==========
  window.otpApp = {
    editAccount,
    deleteAccount,
    copyOTP
  };

  // 启动
  init();
})();
