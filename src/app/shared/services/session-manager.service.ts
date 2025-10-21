import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionManagerService {
  private tabIdKey = 'app_tab_id';
  private openTabsKey = 'app_open_tabs';
  private tokenKeys = ['refresh_token', 'jwt'];
  private heartbeatIntervalMs = 5000; // actualizar cada 5s
  private tabTtlMs = 15000; // considerar pestañas muertas si no han enviado heartbeat en 15s
  private heartbeatHandle: any = null;

  init() {
    const tabId = this.ensureTabId();

    // limpiar pestañas obsoletas antes de registrar la nuestra
    this.cleanupStaleTabs();

    this.addOrUpdateTab(tabId);

    // arrancar heartbeat para esta pestaña
    this.heartbeatHandle = setInterval(() => this.addOrUpdateTab(tabId), this.heartbeatIntervalMs);

    window.addEventListener('beforeunload', () => {
      try { this.removeTab(tabId); } catch (e) {}
    });

    // reaccionar a cambios en openTabs desde otras pestañas
    window.addEventListener('storage', (ev: StorageEvent) => {
      if (ev.key === this.openTabsKey) {
        // si la lista quedó vacía, limpiar tokens
        const raw = localStorage.getItem(this.openTabsKey);
        if (!raw) {
          this.clearTokens();
        } else {
          // también limpiar entradas stale cuando otra pestaña actualiza
          this.cleanupStaleTabs();
        }
      }
    });
  }

  private ensureTabId(): string {
    let id = sessionStorage.getItem(this.tabIdKey);
    if (!id) {
      id = Math.random().toString(36).slice(2);
      sessionStorage.setItem(this.tabIdKey, id);
    }
    return id;
  }

  private getOpenTabsMap(): Record<string, number> {
    try {
      const raw = localStorage.getItem(this.openTabsKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveOpenTabsMap(map: Record<string, number>) {
    try {
      localStorage.setItem(this.openTabsKey, JSON.stringify(map));
    } catch (e) {
      // ignore
    }
  }

  private addOrUpdateTab(tabId: string) {
    const map = this.getOpenTabsMap();
    map[tabId] = Date.now();
    this.saveOpenTabsMap(map);
  }

  private removeTab(tabId: string) {
    const map = this.getOpenTabsMap();
    delete map[tabId];
    const remaining = Object.keys(map);
    if (remaining.length === 0) {
      // última pestaña -> limpiar tokens
      this.clearTokens();
      try { localStorage.removeItem(this.openTabsKey); } catch (e) {}
    } else {
      this.saveOpenTabsMap(map);
    }
    if (this.heartbeatHandle) {
      clearInterval(this.heartbeatHandle);
      this.heartbeatHandle = null;
    }
  }

  private cleanupStaleTabs() {
    const map = this.getOpenTabsMap();
    const now = Date.now();
    let changed = false;
    for (const [id, lastSeen] of Object.entries(map)) {
      if ((now - (lastSeen || 0)) > this.tabTtlMs) {
        delete map[id];
        changed = true;
      }
    }
    const remaining = Object.keys(map);
    if (changed) {
      if (remaining.length === 0) {
        // si no quedan pestañas activas, limpiar tokens
        this.clearTokens();
        try { localStorage.removeItem(this.openTabsKey); } catch (e) {}
      } else {
        this.saveOpenTabsMap(map);
      }
    }
  }

  private clearTokens() {
    try {
      this.tokenKeys.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }
}
