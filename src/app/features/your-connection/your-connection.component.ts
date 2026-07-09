import { Component, computed, effect, inject, signal } from '@angular/core';
import { ConnectionMode, LocationsStore } from '../../core/locations-store.service';
import { ALL_CONTINENTS, CfLocation, Continent } from '../../shared/models/cf-location';
import { findNearest, haversineDistanceKm } from '../../shared/haversine';
import { estimateRttMs } from '../../shared/latency-estimate';

type GeoStatus = 'idle' | 'locating' | 'success' | 'denied' | 'unsupported' | 'error' | 'no-data';
type TestStatus = 'idle' | 'testing' | 'done';

interface NearestResult {
  location: CfLocation;
  distanceKm: number;
}

interface LocationGroup {
  continent: Continent;
  locations: CfLocation[];
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 60_000,
};

// Purely a UI simulation delay so the test reads like a live round trip;
// the actual number is computed instantly from geometry.
const TEST_DELAY_MIN_MS = 400;
const TEST_DELAY_MAX_MS = 900;

@Component({
  selector: 'app-your-connection',
  standalone: true,
  imports: [],
  templateUrl: './your-connection.component.html',
  styleUrl: './your-connection.component.css',
})
export class YourConnectionComponent {
  private readonly store = inject(LocationsStore);

  readonly status = signal<GeoStatus>('idle');
  readonly dataLoading = this.store.loading;

  readonly userOrigin = this.store.userOrigin;
  readonly pickOnMapActive = this.store.pickOnMapActive;
  readonly connectionMode = this.store.connectionMode;
  readonly manualTargetId = this.store.manualTargetId;

  readonly testStatus = signal<TestStatus>('idle');
  readonly testResultMs = signal<number | null>(null);

  // Bumped whenever a test is (re)started or a previous one is invalidated
  // (see the origin/target effect below), so a stale in-flight
  // testConnection() delay can detect it's no longer the current test and
  // avoid overwriting a fresher result.
  private testGeneration = 0;

  readonly groupedLocations = computed<LocationGroup[]>(() => {
    const byContinent = new Map<Continent, CfLocation[]>();
    for (const loc of this.store.locations()) {
      const list = byContinent.get(loc.continent) ?? [];
      list.push(loc);
      byContinent.set(loc.continent, list);
    }
    return ALL_CONTINENTS.map((continent) => ({
      continent,
      locations: (byContinent.get(continent) ?? [])
        .slice()
        .sort((a, b) => a.city.localeCompare(b.city)),
    })).filter((group) => group.locations.length > 0);
  });

  readonly nearestResult = computed<NearestResult | null>(() => {
    const origin = this.userOrigin();
    const candidates = this.store.locations();
    if (!origin || candidates.length === 0) return null;
    return findNearest(origin, candidates);
  });

  readonly targetLocation = computed<CfLocation | null>(() => {
    if (this.connectionMode() === 'manual') {
      const id = this.manualTargetId();
      return id ? (this.store.locationById(id) ?? null) : null;
    }
    return this.nearestResult()?.location ?? null;
  });

  readonly distanceKm = computed<number | null>(() => {
    const origin = this.userOrigin();
    const target = this.targetLocation();
    if (!origin || !target) return null;
    return haversineDistanceKm(origin, target);
  });

  readonly distanceLabel = computed<string | null>(() => {
    const km = this.distanceKm();
    return km === null ? null : this.formattedDistance(km);
  });

  constructor() {
    // Keeps the map's connection line following the active origin/target
    // pair for both GPS and simulated origins, and for auto/manual targets,
    // so map.component.ts keeps a single renderConnectionLine code path.
    effect(() => {
      const origin = this.userOrigin();
      const target = this.targetLocation();
      if (origin && target) {
        this.store.setConnectionLine(
          { from: [origin.lat, origin.lng], to: [target.lat, target.lng] },
          target.continent,
        );
      } else {
        this.store.clearConnectionLine();
      }
    });

    // A moved marker or a newly chosen target invalidates any previous
    // latency reading until the user re-runs the test. Bumping the
    // generation here abandons any in-flight testConnection() delay for the
    // old origin/target pairing so it can never resurrect a stale result.
    effect(() => {
      this.userOrigin();
      this.targetLocation();
      this.testGeneration++;
      this.testStatus.set('idle');
      this.testResultMs.set(null);
    });

    // Mirrors the GPS 'no-data' handling in onPositionSuccess() for the
    // map-click origin path: the store raises this whenever a click tries to
    // place a simulated origin before locations have finished loading.
    effect(() => {
      if (this.store.originNotReadyAt() !== null) {
        this.status.set('no-data');
      }
    });
  }

  locateMe(): void {
    if (!('geolocation' in navigator)) {
      this.status.set('unsupported');
      return;
    }

    this.status.set('locating');

    navigator.geolocation.getCurrentPosition(
      (position) => this.onPositionSuccess(position),
      (error) => this.onPositionError(error),
      GEOLOCATION_OPTIONS,
    );
  }

  togglePickOnMap(): void {
    this.store.setPickOnMapActive(!this.pickOnMapActive());
  }

  setConnectionMode(mode: ConnectionMode): void {
    this.store.setConnectionMode(mode);
  }

  onManualTargetChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    if (id) {
      this.store.selectManualTarget(id);
    }
  }

  async testConnection(): Promise<void> {
    const origin = this.userOrigin();
    const target = this.targetLocation();
    if (!origin || !target || this.testStatus() === 'testing') return;

    this.testStatus.set('testing');
    const generation = ++this.testGeneration;

    const rttMs = estimateRttMs(haversineDistanceKm(origin, target));
    const delayMs = TEST_DELAY_MIN_MS + Math.random() * (TEST_DELAY_MAX_MS - TEST_DELAY_MIN_MS);
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

    // If a newer test started, or the invalidate-on-change effect fired
    // while we were waiting, this result is stale — the newer call (or the
    // effect resetting to idle) already owns the current state.
    if (this.testGeneration !== generation) return;

    this.testResultMs.set(rttMs);
    this.testStatus.set('done');
  }

  formattedDistance(distanceKm: number): string {
    return `${Math.round(distanceKm).toLocaleString('en-US')} km`;
  }

  private onPositionSuccess(position: GeolocationPosition): void {
    if (this.store.locations().length === 0) {
      this.status.set('no-data');
      return;
    }

    this.store.setUserOrigin({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      source: 'gps',
    });
    this.status.set('success');
  }

  private onPositionError(error: GeolocationPositionError): void {
    this.status.set(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
  }
}
