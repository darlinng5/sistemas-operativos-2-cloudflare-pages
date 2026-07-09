export type Continent =
  | 'North America'
  | 'Europe'
  | 'Asia'
  | 'South America'
  | 'Africa'
  | 'Oceania';

export interface CfLocation {
  id: string;
  city: string;
  country: string;
  continent: Continent;
  lat: number;
  lng: number;
  iata_code: string;
}

export const ALL_CONTINENTS: Continent[] = [
  'North America',
  'Europe',
  'Asia',
  'South America',
  'Africa',
  'Oceania',
];
