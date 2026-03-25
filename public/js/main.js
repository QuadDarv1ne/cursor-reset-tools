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
  const lp = document.getElementById('live-logs');
  const wsc = document.getElementById('ws-status');

  // i18n система
  const currentLang = localStorage.getItem('lang') || 'ru';
  const t = key => window.i18n?.t(key, currentLang) || key;

  // WebSocket клиент
  let ws = null;
  let wsReconnectAttempts = 0;
  const WS_MAX_RECONNECT = 5;
  const WS_RECONNECT_DELAY = 2000;

  const getWsUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // WebSocket работает на том же порту что и HTTP с путем /ws
    const port = window.location.port || (protocol === 'wss:' ? '443' : '80');
    return `${protocol}//${window.location.hostname}:${port}/ws`;
  };

  const addLog = (message, type = 'info') => {
    if (!lp) {return;}
    const timestamp = new Date().toLocaleTimeString(currentLang);
    const icons = {
      info: 'ri-information-line',
      success: 'ri-check-line',
      warning: 'ri-alert-line',
      error: 'ri-error-warning-line',
      system: 'ri-server-line'
    };
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span><i class="${icons[type] || icons.info}"></i><span class="log-message">${message}</span>`;
    lp.appendChild(logEntry);
    lp.scrollTop = lp.scrollHeight;

    // Ограничение количества логов
    while (lp.children.length > 100) {
      lp.removeChild(lp.firstChild);
    }
  };

  const updateWsStatus = connected => {
    if (!wsc) {return;}
    wsc.className = `ws-status ${connected ? 'connected' : 'disconnected'}`;
    wsc.innerHTML = `<i class="ri-${connected ? 'wifi-line' : 'wifi-off-line'}"></i>${connected ? t('wsConnected') : t('wsDisconnected')}`;
  };

  const connectWebSocket = () => {
    if (ws) {
      ws.close();
    }

    const url = getWsUrl();
    addLog(`${t('wsConnecting')} ${url}`, 'system');
    ws = new WebSocket(url);

    ws.onopen = () => {
      wsReconnectAttempts = 0;
      updateWsStatus(true);
      addLog(t('wsConnected'), 'success');
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'status' }));
      ws.send(JSON.stringify({ type: 'request_status' }));
    };

    ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        handleWsMessage(message);
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    ws.onclose = event => {
      updateWsStatus(false);
      addLog(`${t('wsDisconnected')} (code: ${event.code})`, 'warning');

      if (wsReconnectAttempts < WS_MAX_RECONNECT) {
        wsReconnectAttempts++;
        const delay = WS_RECONNECT_DELAY * wsReconnectAttempts;
        addLog(`${t('wsReconnecting')} (${wsReconnectAttempts}/${WS_MAX_RECONNECT})...`, 'system');
        setTimeout(connectWebSocket, delay);
      } else {
        addLog(t('wsReconnectFailed'), 'error');
      }
    };

    ws.onerror = error => {
      console.error('WebSocket error:', error);
      addLog(t('wsError'), 'error');
    };
  };

  const handleWsMessage = message => {
    switch (message.type) {
      case 'welcome':
        addLog(`${t('wsWelcome')} (ID: ${message.clientId})`, 'success');
        break;

      case 'status':
        updateStatusFromWs(message.data);
        break;

      case 'heartbeat':
        if (message.data?.ip) {
          updateIpDisplay(message.data.ip);
        }
        break;

      case 'bypass_test_result':
        addLog(`${t('bypassTestComplete')}: ${message.best?.method || 'unknown'}`, 'success');
        break;

      case 'bypass_applied':
        addLog(t('bypassApplied'), 'success');
        break;

      case 'error':
        addLog(message.message || t('error'), 'error');
        break;

      case 'pong':
        console.log('WebSocket latency:', message.latency, 'ms');
        break;
    }
  };

  const updateStatusFromWs = data => {
    if (!data) {return;}

    if (data.monitor) {
      const status = data.monitor.currentStatus;
      if (status) {
        addLog(`${t('cursorStatusTitle')}: ${status === 'ok' ? t('cursorOk') : t('cursorBlocked')}`, status === 'ok' ? 'success' : 'warning');
      }
    }

    if (data.bypass) {
      const best = data.bypass.bestMethod;
      if (best) {
        addLog(`${t('bestBypassMethod')}: ${best}`, 'info');
      }
    }

    gs().catch(e => console.error('Status update error:', e));
  };

  const updateIpDisplay = ipInfo => {
    const ipElement = document.getElementById('current-ip');
    if (ipElement && ipInfo) {
      ipElement.textContent = `${ipInfo.ip || 'N/A'} (${ipInfo.country || 'N/A'})`;
    }
  };

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

  if (ad) {ad.addEventListener('click', cm);}
  if (mc) {mc.addEventListener('click', cm);}

  window.addEventListener('click', e => {
    if (e.target === dm) {cm();}
  });

  const gp = async () => {
    const r = await fetch('/api/paths');
    return r.json();
  };

  const ub = isRunning => {
    rb.disabled = isRunning;
    bp.disabled = isRunning;
    du.disabled = isRunning;
    pc.disabled = isRunning;

    if (isRunning) {
      rb.title = t('toastCloseCursor');
      bp.title = t('toastCloseCursorBypass');
      du.title = t('toastCloseCursorUpdate');
      pc.title = t('toastCloseCursorPro');
    } else {
      rb.title = '';
      bp.title = '';
      du.title = '';
      pc.title = '';
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
      si.innerHTML = `<div class="loading">${t('systemInfoLoading')}</div>`;
      cs.innerHTML = `<div class="loading">${t('cursorStatusLoading')}</div>`;

      const p = await gp();

      let systemHtml = '<table class="info-table">';
      systemHtml += `<tr><th>${t('platform')}</th><td>${p.platform || navigator.platform}</td></tr>`;
      systemHtml += `<tr><th>${t('os')}</th><td>${p.osVersion || navigator.userAgent}</td></tr>`;
      systemHtml += `<tr><th>${t('architecture')}</th><td>${p.arch || t('no')}</td></tr>`;
      systemHtml += `<tr><th>${t('homeDir')}</th><td><div class='code-block'>${p.homedir || t('no')}</div></td></tr>`;
      systemHtml += '</table>';

      si.innerHTML = systemHtml;

      let cursorHtml = '<table class="info-table">';
      cursorHtml += `<tr><th>${t('cursorStatus')}</th><td><div class="code-block" id="code-block" class="${p.isRunning ? 'badge badge-danger' : 'badge badge-success'}">${p.isRunning ? t('cursorRunning') : t('cursorNotRunning')}</div></td></tr>`;
      cursorHtml += `<tr><th>${t('machineIdPath')}</th><td><div class='code-block'>${p.machinePath || t('no')}</div></td></tr>`;
      cursorHtml += `<tr><th>${t('storagePath')}</th><td><div class='code-block'>${p.storagePath || t('no')}</div></td></tr>`;
      cursorHtml += `<tr><th>${t('dbPath')}</th><td><div class='code-block'>${p.dbPath || t('no')}</div></td></tr>`;
      cursorHtml += `<tr><th>${t('appPath')}</th><td><div class='code-block'>${p.appPath || t('no')}</div></td></tr>`;
      cursorHtml += `<tr><th>${t('updatePath')}</th><td><div class='code-block'>${p.updatePath || t('no')}</div></td></tr>`;

      if (p.exists) {
        const existsLabels = {
          machineId: t('machineIdExists'),
          storage: t('storageExists'),
          database: t('databaseExists'),
          app: t('appExists'),
          cursor: t('cursorExists'),
          update: t('updateExists')
        };
        const existsHtml = Object.entries(p.exists).map(([k, v]) => {
          const label = existsLabels[k] || k;
          return `<tr><th>${label}</th><td>${v ? `<span class="badge badge-success">${t('yes')}</span>` : `<span class="badge badge-danger">${t('no')}</span>`}</td></tr>`;
        }).join('');
        cursorHtml += existsHtml;
      }

      cursorHtml += `
        <div id="cursor-warning" class="alert alert-warning mt-3" ${!p.isRunning ? 'style="display:none"' : ''}>
          <i class="ri-alert-line"></i>
          <strong>${t('cursorWarning')}</strong>
        </div>

        <div class="alert alert-info mt-3">
          <i class="ri-information-line"></i>
          <strong>${t('cursorNote')}</strong>
        </div>
      `;

      cs.innerHTML = cursorHtml;

      ub(p.isRunning);

      setTimeout(cb, 100);

      setInterval(cc, 5000);
    } catch (error) {
      si.innerHTML = `<div class="error"><i class="ri-error-warning-line"></i>${t('error')}: ${error.message}</div>`;
      cs.innerHTML = `<div class="error"><i class="ri-error-warning-line"></i>${t('error')}: ${error.message}</div>`;
    }
  };

  const cb = () => {
    const codeBlocks = document.querySelectorAll('.code-block');
    codeBlocks.forEach(block => {
      block.style.height = 'auto';
      if (block.scrollHeight > block.clientHeight) {
        block.style.minHeight = `${Math.min(block.scrollHeight, 200)}px`;
      }
    });
  };

  const rm = async () => {
    try {
      const p = await gp();
      if (p.isRunning) {
        showToast(t('toastCloseCursor'), 'warning');
        return;
      }

      rb.disabled = true;
      rr.innerHTML = `
        <div class="processing">
          <p><i class="ri-loader-2-line ri-spin"></i>${t('resetProcessing')}</p>
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
            <p><i class="ri-check-line"></i><strong>${t('success')}</strong> ${t('resetTitle').toLowerCase()}.</p>
            ${result.log ? `<pre class="log-output">${result.log}</pre>` : ''}
          </div>
        `;
      } else {
        rr.innerHTML = `
          <div class="error">
            <p><i class="ri-error-warning-line"></i><strong>${t('error')}</strong></p>
            <p>${t('error')}: ${result.error || t('error')}</p>
          </div>
        `;
      }

      await gs();
      setTimeout(cb, 100);
    } catch (error) {
      rr.innerHTML = `<div class="error"><i class="ri-error-warning-line"></i>${t('error')}: ${error.message}</div>`;
    } finally {
      rb.disabled = false;
    }
  };

  const bk = async () => {
    try {
      const p = await gp();
      if (p.isRunning) {
        showToast(t('toastCloseCursorBypass'), 'warning');
        return;
      }

      bp.disabled = true;
      rr.innerHTML = `
        <div class="processing">
          <p><i class="ri-loader-2-line ri-spin"></i>${t('bypassProcessing')}</p>
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
            <p><i class="ri-check-line"></i><strong>${t('success')}</strong> ${t('featureTokenBypass').toLowerCase()}.</p>
            ${result.log ? `<pre class="log-output">${result.log}</pre>` : ''}
          </div>
        `;
      } else {
        rr.innerHTML = `
          <div class="error">
            <p><i class="ri-error-warning-line"></i><strong>${t('error')}</strong></p>
            <p>${t('error')}: ${result.error || t('error')}</p>
          </div>
        `;
      }

      await gs();
      setTimeout(cb, 100);
    } catch (error) {
      rr.innerHTML = `<div class="error"><i class="ri-error-warning-line"></i>${t('error')}: ${error.message}</div>`;
    } finally {
      bp.disabled = false;
    }
  };

  const dz = async () => {
    try {
      const p = await gp();
      if (p.isRunning) {
        showToast(t('toastCloseCursorUpdate'), 'warning');
        return;
      }

      du.disabled = true;
      rr.innerHTML = `
        <div class="processing">
          <p><i class="ri-loader-2-line ri-spin"></i>${t('disableProcessing')}</p>
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
            <p><i class="ri-check-line"></i><strong>${t('success')}</strong> ${t('featureAutoUpdateBlock').toLowerCase()}.</p>
            ${result.log ? `<pre class="log-output">${result.log}</pre>` : ''}
          </div>
        `;
      } else {
        rr.innerHTML = `
          <div class="error">
            <p><i class="ri-error-warning-line"></i><strong>${t('error')}</strong></p>
            <p>${t('error')}: ${result.error || t('error')}</p>
          </div>
        `;
      }

      await gs();
      setTimeout(cb, 100);
    } catch (error) {
      rr.innerHTML = `<div class="error"><i class="ri-error-warning-line"></i>${t('error')}: ${error.message}</div>`;
    } finally {
      du.disabled = false;
    }
  };

  const pt = async () => {
    try {
      const p = await gp();
      if (p.isRunning) {
        showToast(t('toastCloseCursorPro'), 'warning');
        return;
      }

      pc.disabled = true;
      rr.innerHTML = `
        <div class="processing">
          <p><i class="ri-loader-2-line ri-spin"></i>${t('proProcessing')}</p>
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
            <p><i class="ri-check-line"></i><strong>${t('success')}</strong> ${t('featureProConversion').toLowerCase()}.</p>
            ${result.log ? `<pre class="log-output">${result.log}</pre>` : ''}
          </div>
        `;
      } else {
        rr.innerHTML = `
          <div class="error">
            <p><i class="ri-error-warning-line"></i><strong>${t('error')}</strong></p>
            <p>${t('error')}: ${result.error || t('error')}</p>
          </div>
        `;
      }

      await gs();
      setTimeout(cb, 100);
    } catch (error) {
      rr.innerHTML = `<div class="error"><i class="ri-error-warning-line"></i>${t('error')}: ${error.message}</div>`;
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
    loadingDiv.textContent = t('systemInfoLoading');
    si.innerHTML = loadingDiv.outerHTML;
    cs.innerHTML = loadingDiv.outerHTML;
  };

  const ib = () => {
    const donateBtn = document.querySelector('.donate-btn');
    if (donateBtn) {
      donateBtn.addEventListener('click', e => {
        e.preventDefault();
        window.open('https://sociabuzz.com/maestro7it/tribe', '_blank');
      });
    }
  };

  const cl = () => {
    if (lp) {
      lp.innerHTML = '';
      addLog(t('logsCleared'), 'info');
    }
  };

  // Подключение WebSocket и инициализация
  const initWebSocket = () => {
    connectWebSocket();
  };

  // Обработчик кнопки очистки логов
  const clb = document.getElementById('clear-logs-btn');
  if (clb) {
    clb.addEventListener('click', cl);
  }

  pl();
  gs();
  initWebSocket();
  rb.addEventListener('click', rm);
  bp.addEventListener('click', bk);
  du.addEventListener('click', dz);
  pc.addEventListener('click', pt);

  // Инициализация мониторинга ресурсов
  initResourceMonitor();

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

  const icons = {
    success: 'check-line',
    error: 'error-warning-line',
    warning: 'alert-line',
    info: 'information-line'
  };

  toast.innerHTML = `
    <div class="toast-content">
      <i class="ri-${icons[type] || icons.info}"></i>
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

// Resource Monitor - обновление данных в реальном времени
function updateResourceMonitor() {
  fetch('/api/resources/summary')
    .then(res => res.json())
    .then(data => {
      if (!data.success) {return;}

      // CPU
      const cpuValue = document.getElementById('cpu-value');
      const cpuBar = document.getElementById('cpu-bar');
      if (cpuValue && cpuBar) {
        cpuValue.textContent = `${data.cpu.current}%`;
        cpuBar.style.width = `${data.cpu.current}%`;
        cpuBar.className = `progress-fill${data.cpu.current > 80 ? ' warning' : ''}${data.cpu.current > 90 ? ' danger' : ''}`;
      }

      // Memory
      const memoryValue = document.getElementById('memory-value');
      const memoryBar = document.getElementById('memory-bar');
      if (memoryValue && memoryBar) {
        memoryValue.textContent = `${data.memory.current}%`;
        memoryBar.style.width = `${data.memory.current}%`;
        memoryBar.className = `progress-fill${data.memory.current > 80 ? ' warning' : ''}${data.memory.current > 90 ? ' danger' : ''}`;
      }

      // Disk
      const diskValue = document.getElementById('disk-value');
      const diskBar = document.getElementById('disk-bar');
      if (diskValue && diskBar) {
        diskValue.textContent = `${data.disk.current}%`;
        diskBar.style.width = `${data.disk.current}%`;
        diskBar.className = `progress-fill${data.disk.current > 80 ? ' warning' : ''}${data.disk.current > 90 ? ' danger' : ''}`;
      }

      // Stats
      const samplesEl = document.getElementById('resource-samples');
      const uptimeEl = document.getElementById('resource-uptime');
      if (samplesEl) {samplesEl.textContent = `Samples: ${data.samples}`;}
      if (uptimeEl) {
        const uptimeSec = Math.floor(data.uptime);
        const hrs = Math.floor(uptimeSec / 3600);
        const mins = Math.floor((uptimeSec % 3600) / 60);
        const secs = uptimeSec % 60;
        uptimeEl.textContent = `Uptime: ${hrs}h ${mins}m ${secs}s`;
      }

      // Alerts
      fetch('/api/resources/alerts?limit=5')
        .then(res => res.json())
        .then(alertsData => {
          if (!alertsData.success) {return;}
          const alertsContainer = document.getElementById('resource-alerts');
          const alertsList = document.getElementById('alerts-list');
          if (alertsContainer && alertsList) {
            if (alertsData.alerts.length > 0) {
              alertsList.innerHTML = alertsData.alerts.map(alert => `
                <div class="alert-item">
                  <i class="ri-alert-line"></i>
                  <span>${alert.message}</span>
                </div>
              `).join('');
              alertsContainer.style.display = 'block';
            } else {
              alertsContainer.style.display = 'none';
            }
          }
        })
        .catch(() => {});
    })
    .catch(() => {});
}

// Запуск мониторинга ресурсов (вызывается из основного DOMContentLoaded)
function initResourceMonitor() {
  updateResourceMonitor();
  setInterval(updateResourceMonitor, 5000);
}
