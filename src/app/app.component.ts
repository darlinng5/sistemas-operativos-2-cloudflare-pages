import { Component, inject, OnInit, signal } from '@angular/core';

import { NavbarComponent } from './features/navbar/navbar.component';
import { CfMapComponent } from './features/map/map.component';
import { CfStatsComponent } from './features/stats/stats.component';
import { CfSearchComponent } from './features/search/search.component';
import { HowItWorksComponent } from './features/how-it-works/how-it-works.component';
import { YourConnectionComponent } from './features/your-connection/your-connection.component';

import { LocationsStore } from './core/locations-store.service';
import {
  Usuario,
  UsuariosService,
} from './core/usuarios.service';

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
export class AppComponent implements OnInit {
  private readonly store = inject(LocationsStore);
  private readonly usuariosService = inject(UsuariosService);

  readonly loadError = this.store.loadError;

  readonly usuarios = signal<Usuario[]>([]);
  readonly cargandoUsuarios = signal(true);
  readonly errorUsuarios = signal('');

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  private cargarUsuarios(): void {
    this.usuariosService.obtenerUsuarios().subscribe({
      next: (respuesta) => {
        this.usuarios.set(respuesta.servicio.datos);
        this.cargandoUsuarios.set(false);
      },
      error: (error) => {
        console.error('Error al consultar Worker A:', error);

        this.errorUsuarios.set(
          'No fue posible obtener los usuarios desde Worker A.'
        );

        this.cargandoUsuarios.set(false);
      },
    });
  }
}