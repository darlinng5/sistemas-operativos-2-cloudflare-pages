import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import * as L from 'leaflet';
import {
  ConnectionLine,
  ContinentFilter,
  LocationsStore,
  UserOrigin,
} from '../../core/locations-store.service';
import { ALL_CONTINENTS, CfLocation } from '../../shared/models/cf-location';

const CONTINENT_FILTERS: ContinentFilter[] = ['All', ...ALL_CONTINENTS];

const WORLD_CENTER: L.LatLngTuple = [20, 0];
const WORLD_ZOOM = 2;

@Component({
  selector: 'app-cf-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css',
})
export class CfMapComponent implements AfterViewInit, OnDestroy {
  private readonly store = inject(LocationsStore);

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  readonly continentFilters = CONTINENT_FILTERS;
  readonly selectedContinent = this.store.selectedContinent;
  readonly pickOnMapActive = this.store.pickOnMapActive;

  private map: L.Map | null = null;
  private markerLayer: L.LayerGroup | null = null;
  private readonly markersById = new Map<string, L.Marker>();
  private originMarker: L.Marker | null = null;
  private connectionLine: L.Polyline | null = null;

  constructor() {
    effect(() => {
      const filtered = this.store.filteredByContinent();
      if (this.map) {
        this.renderMarkers(filtered);
      }
    });

    effect(() => {
      const request = this.store.focusRequest();
      if (!request || !this.map) return;
      const location = this.store.locationById(request.id);
      if (location) {
        this.flyToLocation(location);
      }
    });

    effect(() => {
      const line = this.store.connectionLine();
      if (this.map) {
        this.renderConnectionLine(line);
      }
    });

    // Reacts directly to userOrigin (not just connectionLine) so the origin
    // marker's style and draggability update for both GPS and simulated
    // sources, even before any target/connection line exists.
    effect(() => {
      const origin = this.store.userOrigin();
      if (this.map) {
        this.renderOriginMarker(origin);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.renderMarkers(this.store.filteredByContinent());
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  selectContinent(continent: ContinentFilter): void {
    this.store.selectContinent(continent);
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: WORLD_CENTER,
      zoom: WORLD_ZOOM,
      minZoom: 2,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => this.handleMapClick(event));
  }

  private handleMapClick(event: L.LeafletMouseEvent): void {
    if (!this.store.pickOnMapActive()) return;

    const placed = this.store.setUserOriginFromMap({
      lat: event.latlng.lat,
      lng: event.latlng.lng,
    });
    // If data isn't loaded yet, leave pick-on-map active and skip placing the
    // marker; the store has already raised originNotReadyAt so
    // your-connection.component.ts can show its "not loaded yet" message.
    if (placed) {
      this.store.setPickOnMapActive(false);
    }
  }

  // Leaflet's default marker icons resolve to node_modules image paths that
  // Angular's build does not serve, so a CSS-styled divIcon avoids broken
  // marker images entirely and lets the dot match the CF orange theme.
  private buildIcon(modifierClass = ''): L.DivIcon {
    return L.divIcon({
      className: 'cf-marker',
      html: `<span class="cf-marker-dot ${modifierClass}"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -8],
    });
  }

  private renderMarkers(locations: CfLocation[]): void {
    if (!this.map || !this.markerLayer) return;

    this.markerLayer.clearLayers();
    this.markersById.clear();

    const icon = this.buildIcon();

    for (const loc of locations) {
      const marker = L.marker([loc.lat, loc.lng], { icon }).bindPopup(
        `<div class="cf-popup">
          <strong>${loc.city}</strong><br />
          ${loc.country}<br />
          <span class="cf-popup-region">${loc.continent}</span> &middot;
          <span class="cf-popup-iata">${loc.iata_code}</span>
        </div>`,
      );
      marker.on('click', () => this.store.selectedLocationId.set(loc.id));
      marker.addTo(this.markerLayer!);
      this.markersById.set(loc.id, marker);
    }

    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng] as L.LatLngTuple));
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
    } else {
      this.map.setView(WORLD_CENTER, WORLD_ZOOM);
    }
  }

  private flyToLocation(location: CfLocation): void {
    if (!this.map) return;
    this.map.flyTo([location.lat, location.lng], 5, { duration: 1.2 });
    this.markersById.get(location.id)?.openPopup();
  }

  private renderConnectionLine(line: ConnectionLine | null): void {
    if (!this.map) return;

    this.connectionLine?.remove();
    this.connectionLine = null;

    if (!line) return;

    this.connectionLine = L.polyline([line.from, line.to], {
      color: '#fbad41',
      weight: 2,
      dashArray: '6 6',
    }).addTo(this.map);

    this.map.fitBounds(L.latLngBounds([line.from, line.to]), { padding: [60, 60], maxZoom: 6 });
  }

  // Kept independent from renderConnectionLine so the origin marker (and its
  // drag handling) shows up as soon as an origin exists, whether or not a
  // target/connection line has been resolved yet.
  private renderOriginMarker(origin: UserOrigin | null): void {
    if (!this.map) return;

    this.originMarker?.remove();
    this.originMarker = null;

    if (!origin) return;

    const isSimulated = origin.source === 'simulated';
    const modifierClass = isSimulated ? 'cf-marker-dot--simulated' : 'cf-marker-dot--user';
    const label = isSimulated ? 'You (simulated)' : 'You (GPS)';

    this.originMarker = L.marker([origin.lat, origin.lng], {
      icon: this.buildIcon(modifierClass),
      draggable: isSimulated,
    })
      .bindPopup(`<div class="cf-popup"><strong>${label}</strong></div>`)
      .addTo(this.map);

    if (isSimulated) {
      this.originMarker.on('dragend', () => {
        const position = this.originMarker!.getLatLng();
        this.store.setUserOrigin({ lat: position.lat, lng: position.lng, source: 'simulated' });
      });
    }
  }
}
