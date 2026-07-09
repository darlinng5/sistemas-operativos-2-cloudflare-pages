import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  ArcElement,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Legend,
  Tooltip,
} from 'chart.js';
import { LocationsStore } from '../../core/locations-store.service';
import { Continent } from '../../shared/models/cf-location';

Chart.register(ArcElement, DoughnutController, Legend, Tooltip);

const CONTINENT_COLORS: Record<Continent, string> = {
  'North America': '#f6821f',
  Europe: '#fbad41',
  Asia: '#f2b705',
  'South America': '#d96c1f',
  Africa: '#8a5a2b',
  Oceania: '#e0943a',
};

const COUNT_UP_DURATION_MS = 900;

@Component({
  selector: 'app-cf-stats',
  standalone: true,
  imports: [],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css',
})
export class CfStatsComponent implements AfterViewInit, OnDestroy {
  private readonly store = inject(LocationsStore);

  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  readonly loading = this.store.loading;
  readonly displayedTotal = signal(0);
  readonly displayedCountries = signal(0);

  private chart: Chart | null = null;
  private animationFrameId: number | null = null;

  constructor() {
    effect(() => {
      const total = this.store.totalCount();
      const countries = this.store.countryCount();
      if (total > 0) {
        this.animateCountUp(total, countries);
      }
    });

    effect(() => {
      const breakdown = this.store.continentBreakdown();
      if (this.chart) {
        this.updateChart(breakdown);
      }
    });
  }

  ngAfterViewInit(): void {
    this.chart = new Chart(this.chartCanvas.nativeElement, this.buildConfig());
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.chart?.destroy();
  }

  private buildConfig(): ChartConfiguration<'doughnut'> {
    return {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#d4d4d4', boxWidth: 12, font: { size: 11 } },
          },
        },
      },
    };
  }

  private updateChart(breakdown: Record<string, number>): void {
    if (!this.chart) return;
    const labels = Object.keys(breakdown);
    const data = labels.map((label) => breakdown[label]);
    const colors = labels.map((label) => CONTINENT_COLORS[label as Continent] ?? '#666');

    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = data;
    this.chart.data.datasets[0].backgroundColor = colors;
    this.chart.update();
  }

  private animateCountUp(targetTotal: number, targetCountries: number): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - start) / COUNT_UP_DURATION_MS, 1);
      this.displayedTotal.set(Math.round(targetTotal * progress));
      this.displayedCountries.set(Math.round(targetCountries * progress));

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }
}
