import * as Location from 'expo-location';
import { env } from '../utils/env';

const PLACES_API_BASE = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_DETAILS_BASE = 'https://places.googleapis.com/v1/places';

export interface NearbyShop {
  id: string;
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
  latitude?: number;
  longitude?: number;
  primaryType?: string;
  googleMapsUri?: string;
  openNow?: boolean;
  distanceMeters?: number;
}

interface PlacesApiResponse {
  places?: Array<{
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
    location?: { latitude: number; longitude: number };
    primaryTypeDisplayName?: { text: string };
    googleMapsUri?: string;
    openingHours?: { openNow?: boolean };
  }>;
}

class PlacesService {
  private apiKey: string;

  constructor() {
    this.apiKey = env.getGooglePlacesApiKey();
  }

  private async getLocation(): Promise<{ latitude: number; longitude: number } | null> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    const location = await Location.getCurrentPositionAsync({});
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  }

  async searchNearbyPlantShops(
    query?: string
  ): Promise<{ shops: NearbyShop[]; usedLocation: boolean }> {
    const location = await this.getLocation();
    const searchQuery = query ? `${query} plant nursery` : 'plant nursery';

    const body: Record<string, any> = {
      textQuery: searchQuery,
      maxResultCount: 10,
      rankPreference: 'DISTANCE',
    };

    if (location) {
      body.locationBias = {
        circle: {
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          radius: 10000.0,
        },
      };
    }

    try {
      const response = await fetch(PLACES_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.primaryTypeDisplayName,places.googleMapsUri,places.openingHours.openNow',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Places API error:', errorText);
        throw new Error(`Places API error: ${response.status}`);
      }

      const data = (await response.json()) as PlacesApiResponse;

      const shops: NearbyShop[] =
        data.places?.map((place) => ({
          id: place.id,
          name: place.displayName?.text || 'Unknown',
          address: place.formattedAddress || '',
          rating: place.rating,
          userRatingCount: place.userRatingCount,
          latitude: place.location?.latitude,
          longitude: place.location?.longitude,
          primaryType: place.primaryTypeDisplayName?.text,
          googleMapsUri: place.googleMapsUri,
          openNow: place.openingHours?.openNow,
          distanceMeters: location && place.location
            ? this.haversineDistance(
                location.latitude,
                location.longitude,
                place.location.latitude,
                place.location.longitude
              )
            : undefined,
        })) || [];

      // Sort by distance if we have location
      if (location) {
        shops.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
      }

      return { shops, usedLocation: !!location };
    } catch (error) {
      console.error('Failed to search nearby plant shops:', error);
      throw error;
    }
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}

export const placesService = new PlacesService();
