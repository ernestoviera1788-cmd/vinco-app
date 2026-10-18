import * as SecureStore from 'expo-secure-store';

export interface SearchFilters {
  preferredGender: 'Todos' | 'Hombre' | 'Mujer';
  ageMin: number;
  ageMax: number;
  distanceMax: number;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  preferredGender: 'Todos',
  ageMin: 18,
  ageMax: 99,
  distanceMax: 50,
};

const KEY = 'vinco.searchFilters.v1';

export async function loadSearchFilters(): Promise<SearchFilters> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return DEFAULT_SEARCH_FILTERS;
    const value = JSON.parse(raw) as Partial<SearchFilters>;
    const ageMin = Number(value.ageMin);
    const ageMax = Number(value.ageMax);
    const distanceMax = Number(value.distanceMax);
    const preferredGender = value.preferredGender;
    return {
      preferredGender: preferredGender === 'Hombre' || preferredGender === 'Mujer' ? preferredGender : 'Todos',
      ageMin: Number.isFinite(ageMin) && ageMin >= 18 && ageMin <= 99 ? ageMin : 18,
      ageMax: Number.isFinite(ageMax) && ageMax >= 18 && ageMax <= 99 ? ageMax : 99,
      distanceMax: Number.isFinite(distanceMax) && distanceMax >= 1 && distanceMax <= 500 ? distanceMax : 50,
    };
  } catch {
    return DEFAULT_SEARCH_FILTERS;
  }
}

export async function saveSearchFilters(filters: SearchFilters): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(filters));
}
