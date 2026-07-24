import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Usuario {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  website: string;
}

export interface RespuestaUsuarios {
  capa: string;
  mensaje: string;
  servicio: {
    capa: string;
    origen: string;
    cantidad: number;
    datos: Usuario[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class UsuariosService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    'https://worker-a.christopherjb125.workers.dev/api/usuarios';

  obtenerUsuarios(): Observable<RespuestaUsuarios> {
    return this.http.get<RespuestaUsuarios>(this.apiUrl);
  }
}