import { Component, inject, signal } from '@angular/core';
import { LocationsStore } from '../../core/locations-store.service';

@Component({
  selector: 'app-cf-search',
  standalone: true,
  imports: [],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
})
export class CfSearchComponent {
  private readonly store = inject(LocationsStore);

  readonly query = this.store.searchQuery;
  readonly results = this.store.searchResults;
  readonly showResults = signal(false);

  onInput(value: string): void {
    this.store.setSearchQuery(value);
    this.showResults.set(true);
  }

  onFocus(): void {
    if (this.query()) {
      this.showResults.set(true);
    }
  }

  onBlur(): void {
    // Delay so a click on a result registers before the dropdown closes.
    setTimeout(() => this.showResults.set(false), 150);
  }

  selectResult(id: string): void {
    this.store.focusLocation(id);
    this.showResults.set(false);
  }
}
