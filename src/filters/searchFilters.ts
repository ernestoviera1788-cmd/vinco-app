import * as SecureStore from 'expo-secure-store';

export type DiscoverySort = 'recommended' | 'recent' | 'active';
export interface SearchFilters {
  preferredGender: 'Todos' | 'Hombre' | 'Mujer';
  withPhoto: boolean;
  verifiedOnly: boolean;
  onlineNow: boolean;
  recentlyActive: boolean;
  commonInterests: boolean;
  newProfiles: boolean;
  sortBy: DiscoverySort;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  preferredGender: 'Todos',
  withPhoto: false,
  verifiedOnly: false,
  onlineNow: false,
  recentlyActive: false,
  commonInterests: false,
  newProfiles: false,
  sortBy: 'recommended',
};

const KEY = 'vinco.searchFilters.v1';

export async function loadSearchFilters(): Promise<SearchFilters> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return DEFAULT_SEARCH_FILTERS;
    const value = JSON.parse(raw) as Partial<SearchFilters>;
    const gender = value.preferredGender;
    return {
      preferredGender: gender === 'Hombre' || gender === 'Mujer' ? gender : 'Todos',
      withPhoto: value.withPhoto === true,
      verifiedOnly: value.verifiedOnly === true,
      onlineNow: value.onlineNow === true,
      recentlyActive: value.recentlyActive === true,
      commonInterests: value.commonInterests === true,
      newProfiles: value.newProfiles === true,
      sortBy: value.sortBy === 'recent' || value.sortBy === 'active' ? value.sortBy : 'recommended',
    };
  } catch {
    return DEFAULT_SEARCH_FILTERS;
  }
}

export async function saveSearchFilters(filters: SearchFilters): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(filters));
}
