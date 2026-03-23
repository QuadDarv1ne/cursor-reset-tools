document.addEventListener('DOMContentLoaded', () => {
  const si = document.getElementById('system-info');
  const cs = document.getElementById('cursor-status');
  const rb = document.getElementById('reset-btn');
  const bp = document.getElementById('bypass-btn');
  const du = document.getElementById('disable-update-btn');
  const pc = document.getElementById('pro-convert-btn');
  const rr = document.getElementById('reset-result');
  const dm = document.getElementById('disclaimer-modal');
  const ad = document.getElementById('accept-disclaimer');
  const mc = document.querySelector('.modal-close');

  const cm = () => {
    dm.style.display = 'none';
    localStorage.setItem('disclaimerAccepted', 'true');
    document.body.style.overflow = 'auto';
  };

  const sd = () => {
    if (!localStorage.getItem('disclaimerAccepted')) {
      dm.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }
  };

  if (ad) ad.addEventListener('click', cm);
  if (mc) mc.addEventListener('click', cm);

  window.addEventListener('click', (e) => {
    if (e.target === dm) cm();
  });

  const gp = async () => {
    const r = await fetch('/api/paths');
    return await r.json();
  };

  const ub = (isRunning) => {
    rb.disabled = isRunning;
    bp.disabled = isRunning;
    du.disabled = isRunning;
    pc.disabled = isRunning;

    if (isRunning) {
      rb.title = "Закройте Cursor сначала";
      bp.title = "Закройте Cursor сначала";
      du.title = "Закройте Cursor сначала";
      pc.title = "Закройте Cursor сначала";
    } else {
      rb.title = "";
      bp.title = "";
      du.title = "";
      pc.title = "";
    }
  };

  const cc = async () => {
    try {
      const p = await gp();
      if (p.isRunning !== undefined) {
        ub(p.isRunning);

        const warningMsg = document.getElementById('cursor-warning');
        if (warningMsg) {
          warningMsg.style.display = p.isRunning ? 'block' : 'none';
        }
      }
    } catch (e) {
      console.error('Ошибка проверки статуса Cursor:', e);
    }
  };

  const gs = async () => {
    try {
      si.innerHTML = '<div class="loading">Загрузка информации о системе...</div>';
      cs.innerHTML = '<div class="loading">Проверка статуса Cursor...</div>';

      const p = await gp();

      let systemHtml = '<table class="info-table">';
      systemHtml += `<tr><th>Платформа</th><td>${p.platform || navigator.platform}</td></tr>`;
      systemHtml += `<tr><th>ОС</th><td>${p.osVersion || navigator.userAgent}</td></tr>`;
      systemHtml += `<tr><th>Архитектура</th><td>${p.arch || 'Неизвестно'}</td></tr>`;
      systemHtml += `<tr><th>Домашняя директория</th><td><div class='code-block'>${p.homedir || 'Неизвестно'}</div></td></tr>`;
      systemHtml += '</table>';

      si.innerHTML = systemHtml;

      let cursorHtml = '<table class="info-table">';
      cursorHtml += `<tr><th>Статус Cursor</th><td><div class="code-block" id="code-block" class="${p.isRunning ? 'badge badge-danger' : 'badge badge-success'}">${p.isRunning ? 'Запущен' : 'Не запущен'}</div></td></tr>`;
      cursorHtml += `<tr><th>Путь Machine ID</th><td><div class='code-block'>${p.machinePath || 'Не найден'}</div></td></tr>`;
      cursorHtml += `<tr><th>Путь хранилища</th><td><div class='code-block'>${p.storagePath || 'Не найден'}</div></td></tr>`;
      cursorHtml += `<tr><th>Путь базы данных</th><td><div class='code-block'>${p.dbPath || 'Не найден'}</div></td></tr>`;
      cursorHtml += `<tr><th>Путь приложения</th><td><div class='code-block'>${p.appPath || 'Не найден'}</div></td></tr>`;
      cursorHtml += `<tr><th>Путь обновлений</th><td><div class='code-block'>${p.updatePath || 'Не найден'}</div></td></tr>`;

      if (p.exists) {
        const existsHtml = Object.entries(p.exists).map(([k, v]) =>
          `<tr><th>${k} существует</th><td>${v ? '<span class="badge badge-success">Да</span>' : '<span class="badge badge-danger">Нет</span>'}</td></tr>`
        ).join('');
        cursorHtml += existsHtml;
      }

      cursorHtml += `
        <div id="cursor-warning" class="alert alert-warning mt-3" ${!p.isRunning ? 'style="display:none"' : ''}>
          <i class="ri-alert-line"></i>
          <strong>Внимание:</strong> Cursor сейчас запущен. Пожалуйста, закройте его перед использованием функций.
        </div>

        <div class="alert alert-info mt-3">
          <i class="ri-information-line"></i>
          <strong>Примечание:</strong> Убедитесь, что Cursor закрыт перед использованием любых функций.
        </div>
      `;

      cs.innerHTML = cursorHtml;

      ub(p.isRunning);

      setTimeout(cb, 100);

      setInterval(cc, 5000);
    } catch (error) {
      si.innerHTML = `<div class="error"><i class="ri-error-warning-line"></i>Ошибка: ${error.message}</div>`;
      cs.innerHTML = `<div class="error"><i class="ri-error-warning-line"></i>Ошибка: ${error.message}</div>`;
    }
  };

  const cb = () => {
    const codeBlocks = document.querySelectorAll('.code-block');
    codeBlocks.forEach(block => {
      block.style.height = 'auto';
      if (block.scrollHeight > block.clientHeight) {
        block.style.minHeight = Math.min(block.scrollHeight, 200) + 'px';
      }
    });
  };

  const rm = async () => {
    try {
      const p = await gp();
      if (p.isRunning) {
        showToast("Пожалуйста, закройте Cursor перед сбросом Machine ID", "warning");
        return;
      }

      rb.disabled = true;
      rr.innerHTML = `
        <div class="processing">
          <p><i class="ri-loader-2-line ri-spin"></i>Сброс Machine ID... Пожалуйста, подождите</p>
        </div>
      `;

      const response = await fetch('/api/reset', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        rr.innerHTML = `
          <div class="success">
            <p><i class="ri-check-line"></i><strong>Успешно!</strong> Machine ID был сброшен.</p>
            ${result.log ? `<pre class="log-output">${result.log}</pre>` : ''}
          </div>
        `;
      } else {
        rr.innerHTML = `
          <div class="error">
            <p><i class="ri-error-warning-line"></i><strong>Не удалось сбросить Machine ID</strong></p>
            <p>Ошибка: ${result.error || 'Неизвестная ошибка'}</p>
          </div>
        `;
      }

      await gs();
      setTimeout(cb, 100);
    } catch (error) {
      rr.innerHTML = `<div class="error"><i class="ri-error-warning-line"></i>Ошибка: ${error.message}</div>`;
    } finally {
      rb.disabled = false;
    }
  };

  const bk = async () => {
    try {
      const p = await gp();
      if (p.isRunning) {
        showToast("Пожалуйста, закройте Cursor перед обходом лимита токенов", "warning");
        return;
      }

      bp.disabled = true;
      rr.innerHTML = `
        <div class="processing">
          <p><i class="ri-loader-2-line ri-spin"></i>Обход лимита токенов... Пожалуйста, подождите</p>
        </div>
      `;

      const response = await fetch('/api/patch?action=bypass', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        rr.innerHTML = `
          <div class="success">
            <p><i class="ri-check-line"></i><strong>Успешно!</strong> Лимит токенов был обойдён.</p>
            ${result.log ? `<pre class="log-output">${result.log}</pre>` : ''}
          </div>
        `;
      } else {
        rr.innerHTML = `
          <div class="error">
            <p><i class="ri-error-warning-line"></i><strong>Не удалось обойти лимит токенов</strong></p>
            <p>Ошибка: ${result.error || 'Неизвестная ошибка'}</p>
          </div>
        `;
      }

      await gs();
      setTimeout(cb, 100);
    } catch (error) {
      rr.innerHTML = `<div class="error"><i class="ri-error-warning-line"></i>Ошибка: ${error.message}</div>`;
    } finally {
      bp.disabled = false;
    }
  };

  const dz = async () => {
    try {
      const p = await gp();
      if (p.isRunning) {
        showToast("Пожалуйста, закройте Cursor перед отключением автообновления", "warning");
        return;
      }

      du.disabled = true;
      rr.innerHTML = `
        <div class="processing">
          <p><i class="ri-loader-2-line ri-spin"></i>Отключение автообновления... Пожалуйста, подождите</p>
        </div>
      `;

      const response = await fetch('/api/patch?action=disable', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        rr.innerHTML = `
          <div class="success">
            <p><i class="ri-check-line"></i><strong>Успешно!</strong> Автообновление было отключено.</p>
            ${result.log ? `<pre class="log-output">${result.log}</pre>` : ''}
          </div>
        `;
      } else {
        rr.innerHTML = `
          <div class="error">
            <p><i class="ri-error-warning-line"></i><strong>Не удалось отключить автообновление</strong></p>
            <p>Ошибка: ${result.error || 'Неизвестная ошибка'}</p>
          </div>
        `;
      }

      await gs();
      setTimeout(cb, 100);
    } catch (error) {
      rr.innerHTML = `<div class="error"><i class="ri-error-warning-line"></i>Ошибка: ${error.message}</div>`;
    } finally {
      du.disabled = false;
    }
  };

  const pt = async () => {
    try {
      const p = await gp();
      if (p.isRunning) {
        showToast("Пожалуйста, закройте Cursor перед включением Pro функций", "warning");
        return;
      }

      pc.disabled = true;
      rr.innerHTML = `
        <div class="processing">
          <p><i class="ri-loader-2-line ri-spin"></i>Конвертация в Pro + Кастомный UI... Пожалуйста, подождите</p>
        </div>
      `;

      const response = await fetch('/api/patch?action=pro', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        rr.innerHTML = `
          <div class="success">
            <p><i class="ri-check-line"></i><strong>Успешно!</strong> Pro функции и кастомный UI были включены.</p>
            ${result.log ? `<pre class="log-output">${result.log}</pre>` : ''}
          </div>
        `;
      } else {
        rr.innerHTML = `
          <div class="error">
            <p><i class="ri-error-warning-line"></i><strong>Не удалось включить Pro функции</strong></p>
            <p>Ошибка: ${result.error || 'Неизвестная ошибка'}</p>
          </div>
        `;
      }

      await gs();
      setTimeout(cb, 100);
    } catch (error) {
      rr.innerHTML = `<div class="error"><i class="ri-error-warning-line"></i>Ошибка: ${error.message}</div>`;
    } finally {
      pc.disabled = false;
    }
  };

  const ta = () => {
    const accordionItems = document.querySelectorAll('.accordion-item');

    accordionItems.forEach(item => {
      const header = item.querySelector('.accordion-header');

      header.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        accordionItems.forEach(accItem => {
          accItem.classList.remove('active');
        });

        if (!isActive) {
          item.classList.add('active');
        }
      });
    });
  };

  const tl = () => {
    const items = document.querySelectorAll('.timeline-item');
    items.forEach(item => {
      item.style.opacity = '1';
      item.style.transform = 'translateY(0)';
    });
  };

  const td = () => {
    const vh = document.querySelectorAll('.version-header');
    vh.forEach(header => {
      header.style.display = 'flex';
      if (window.innerWidth <= 768) {
        header.style.flexDirection = 'column';
      } else {
        header.style.flexDirection = 'row';
      }
    });
  };

  const pl = () => {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.textContent = 'Загрузка';
    si.innerHTML = loadingDiv.outerHTML;
    cs.innerHTML = loadingDiv.outerHTML;
  };

  const ib = () => {
    const donateBtn = document.querySelector('.donate-btn');
    if (donateBtn) {
      donateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('https://sociabuzz.com/sazumi/tribe', '_blank');
      });
    }
  };

  pl();
  gs();
  rb.addEventListener('click', rm);
  bp.addEventListener('click', bk);
  du.addEventListener('click', dz);
  pc.addEventListener('click', pt);

  setTimeout(() => {
    ta();
    ib();
    cb();
    sd();
    tl();
    td();
  }, 500);
});

function showToast(message, type = 'info') {
  const toastContainer = document.querySelector('.toast-container') || (() => {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  })();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  toast.innerHTML = `
    <div class="toast-content">
      <i class="ri-${type === 'success' ? 'check-line' : type === 'error' ? 'error-warning-line' : type === 'warning' ? 'alert-line' : 'information-line'}"></i>
      <span>${message}</span>
    </div>
    <button class="toast-close"><i class="ri-close-line"></i></button>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-closing');
    setTimeout(() => {
      toast.remove();
      if (toastContainer.children.length === 0) {
        toastContainer.remove();
      }
    }, 300);
  }, 5000);

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.add('toast-closing');
    setTimeout(() => {
      toast.remove();
      if (toastContainer.children.length === 0) {
        toastContainer.remove();
      }
    }, 300);
  });
}
