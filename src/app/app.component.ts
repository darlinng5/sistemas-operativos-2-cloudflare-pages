import { Component, inject } from '@angular/core';
import { NavbarComponent } from './features/navbar/navbar.component';
import { CfMapComponent } from './features/map/map.component';
import { CfStatsComponent } from './features/stats/stats.component';
import { CfSearchComponent } from './features/search/search.component';
import { HowItWorksComponent } from './features/how-it-works/how-it-works.component';
import { YourConnectionComponent } from './features/your-connection/your-connection.component';
import { LocationsStore } from './core/locations-store.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    NavbarComponent,
    CfMapComponent,
    CfStatsComponent,
    CfSearchComponent,
    HowItWorksComponent,
    YourConnectionComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly store = inject(LocationsStore);

  readonly loadError = this.store.loadError;
}
