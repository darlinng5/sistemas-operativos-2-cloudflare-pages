import { Injectable, computed, signal } from '@angular/core';
import { CfLocation, Continent } from '../shared/models/cf-location';

export type ContinentFilter = Continent | 'All';

export interface FocusRequest {
  id: string;
  requestedAt: number;
}

export interface ConnectionLine {
  from: [number, number];
  to: [number, number];
}

export type OriginSource = 'gps' | 'simulated';

export interface UserOrigin {
  lat: number;
  lng: number;
  source: OriginSource;
}

export type ConnectionMode = 'auto' | 'manual';

const DATA_URL = 'data/cloudflare-locations.json';

// Strips diacritics so searches like "sao paulo" match "São Paulo" and
// "bogota" matches "Bogotá".
const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

@Injectable({ providedIn: 'root' })
export class LocationsStore {
  readonly locations = signal<CfLocation[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly selectedContinent = signal<ContinentFilter>('All');
  readonly searchQuery = signal('');
  readonly selectedLocationId = signal<string | null>(null);

  // Command signals other components observe via effect() to react to
  // search selections / geolocation results without direct ViewChild wiring.
  // These are fire-and-forget: there is no replay/queueing, so a consumer
  // (the map component) must be permanently mounted to ever receive them.
  // app.component.html currently mounts <app-cf-map> unconditionally.
  readonly focusRequest = signal<FocusRequest | null>(null);
  readonly connectionLine = signal<ConnectionLine | null>(null);

  // Fires whenever a map click tries to place a simulated origin before
  // location data has finished loading, so your-connection.component.ts can
  // surface the same "data not loaded yet" feedback it already shows for the
  // GPS path (see its 'no-data' GeoStatus).
  readonly originNotReadyAt = signal<number | null>(null);

  // Origin can come from real GPS or a simulated click/drag on the map; the
  // map component reacts to this directly to render the right marker style.
  readonly userOrigin = signal<UserOrigin | null>(null);
  readonly pickOnMapActive = signal(false);
  readonly connectionMode = signal<ConnectionMode>('auto');
  readonly manualTargetId = signal<string | null>(null);

  readonly filteredByContinent = computed<CfLocation[]>(() => {
    const continent = this.selectedContinent();
    const all = this.locations();
    return continent === 'All' ? all : all.filter((loc) => loc.continent === continent);
  });

  readonly searchResults = computed<CfLocation[]>(() => {
    const query = normalize(this.searchQuery().trim());
    if (!query) return [];
    return this.locations()
      .filter(
        (loc) => normalize(loc.city).includes(query) || normalize(loc.country).includes(query),
      )
      .slice(0, 8);
  });

  readonly totalCount = computed(() => this.locations().length);

  readonly countryCount = computed(
    () => new Set(this.locations().map((loc) => loc.country)).size,
  );

  readonly continentBreakdown = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const loc of this.locations()) {
      counts[loc.continent] = (counts[loc.continent] ?? 0) + 1;
    }
    return counts;
  });

  constructor() {
    this.loadLocations();
  }

  private async loadLocations(): Promise<void> {
    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) {
        throw new Error(`Failed to load locations (HTTP ${response.status})`);
      }
      const data = (await response.json()) as CfLocation[];
      this.locations.set(data);
    } catch (err) {
      this.loadError.set(err instanceof Error ? err.message : 'Unknown error loading locations');
    } finally {
      this.loading.set(false);
    }
  }

  selectContinent(continent: ContinentFilter): void {
    this.selectedContinent.set(continent);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  focusLocation(id: string): void {
    const location = this.locationById(id);
    if (location) {
      this.ensureVisible(location.continent);
    }
    this.selectedLocationId.set(id);
    this.focusRequest.set({ id, requestedAt: Date.now() });
  }

  setConnectionLine(line: ConnectionLine, nearestContinent?: Continent): void {
    if (nearestContinent) {
      this.ensureVisible(nearestContinent);
    }
    this.connectionLine.set(line);
  }

  clearConnectionLine(): void {
    this.connectionLine.set(null);
  }

  setUserOrigin(origin: UserOrigin): void {
    this.userOrigin.set(origin);
  }

  // Guarded entry point for map-click/drag origin placement: unlike GPS
  // (which fails synchronously if navigator.geolocation is unavailable),
  // a map click can happen before locations have finished loading, in which
  // case there's nothing to find the nearest node against. Returns whether
  // the origin was actually placed so callers (e.g. the map component) can
  // decide whether to exit "pick on map" mode.
  setUserOriginFromMap(origin: Omit<UserOrigin, 'source'>): boolean {
    if (this.loading() || this.locations().length === 0) {
      this.originNotReadyAt.set(Date.now());
      return false;
    }
    this.setUserOrigin({ ...origin, source: 'simulated' });
    return true;
  }

  setPickOnMapActive(active: boolean): void {
    this.pickOnMapActive.set(active);
  }

  setConnectionMode(mode: ConnectionMode): void {
    this.connectionMode.set(mode);
  }

  selectManualTarget(id: string): void {
    const location = this.locationById(id);
    if (!location) return;
    this.ensureVisible(location.continent);
    this.manualTargetId.set(id);
  }

  locationById(id: string): CfLocation | undefined {
    return this.locations().find((loc) => loc.id === id);
  }

  // A filtered continent view could hide the focused marker or the nearest
  // connection-line node entirely, so widen the filter back to "All"
  // whenever the target falls outside the current selection.
  private ensureVisible(continent: Continent): void {
    if (this.selectedContinent() !== 'All' && this.selectedContinent() !== continent) {
      this.selectContinent('All');
    }
  }
}
