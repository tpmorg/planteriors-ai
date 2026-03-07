# Firebase Analytics Integration

## Overview

Firebase Analytics has been integrated into the Planterior AI app to track user behavior, engagement, and key conversion metrics. This document outlines the implementation, tracked events, and how to use the analytics service.

## Setup

### Dependencies

```json
{
  "@react-native-firebase/app": "^21.x.x",
  "@react-native-firebase/analytics": "^21.x.x"
}
```

### Configuration

Analytics is automatically initialized when the app starts:

```typescript
// In App.tsx
await analyticsService.initialize();
```

The Firebase configuration is pulled from `google-services.json` (Android) and `GoogleService-Info.plist` (iOS).

## Analytics Service

Location: `src/services/analyticsService.ts`

### Core Methods

- `initialize()` - Initialize Firebase Analytics
- `logEvent(eventName, params)` - Log a custom event
- `logScreenView(screenName, screenClass)` - Track screen views
- `setUserId(userId)` - Set the user ID for tracking
- `setUserProperty(name, value)` - Set a user property
- `setUserProperties(properties)` - Set multiple user properties

### Tracked Events

#### Authentication
- `sign_in` - User signs in (method: google, apple, skip)
- `sign_out` - User signs out
- `sign_up` - New user registration

#### Design Generation
- `design_generation_started` - User starts generating a design
  - `mode`: 'multi-plant' | 'individual'
  - `plantType`: Selected plant type (multi-plant mode)
  - `plantName`: Selected plant name (individual mode)
  - `hasCustomPrompt`: boolean

- `design_generation_completed` - Design generation succeeds
  - `mode`: 'multi-plant' | 'individual'
  - `plantType`: Plant type used
  - `plantName`: Plant name used
  - `generationType`: 'free' | 'paid'
  - `duration`: Generation time in milliseconds

- `design_generation_failed` - Design generation fails
  - `mode`: 'multi-plant' | 'individual'
  - `error`: Error message

#### Plant Selection
- `plant_selected` - User selects a plant
  - `mode`: 'multi-plant' | 'individual'
  - `plantId`: Plant ID
  - `plantName`: Plant name
  - `plantType`: Plant type/category
  - `size`: Selected size
  - `placement`: Selected placement

- `plant_search` - User searches for plants
  - `search_term`: Search query
  - `results_count`: Number of results

- `plant_identified` - Plant identification completed

#### User Actions
- `image_captured` - User captures/selects an image
  - `source`: 'camera' | 'gallery' | 'recent'

- `design_saved` - User saves a design
  - `mode`: 'multi-plant' | 'individual'
  - `generationType`: 'free' | 'paid'

- `design_deleted` - User deletes a design
- `design_shared` - User shares a design
- `design_favorited` - User favorites/unfavorites a design
  - `is_favorite`: boolean

#### Subscription
- `subscription_viewed` - User views subscription screen
  - `source`: 'paywall' | 'account' | 'settings'

- `subscription_purchased` - User purchases subscription
  - `productId`: Product identifier
  - `type`: 'monthly' | 'annual'
  - `price`: Price in local currency
  - `currency`: Currency code

- `subscription_restored` - User restores purchases

- `paywall_shown` - Paywall is displayed
  - `trigger`: 'generation_limit' | 'manual'

#### Navigation
- `screen_view` - Screen view tracking
  - `screen_name`: Name of the screen
  - `screen_class`: Screen class/component name

#### Onboarding
- `onboarding_started` - User starts onboarding
- `onboarding_completed` - User completes onboarding
- `onboarding_skipped` - User skips onboarding

### User Properties

- `subscription_status` - User's subscription status ('free', 'monthly', 'annual')
- `total_designs` - Total number of designs created
- `free_generations_remaining` - Number of free generations left

## Usage Examples

### Track Design Generation

```typescript
import { analyticsService } from '../services/analyticsService';

// Start generation
await analyticsService.trackDesignGenerationStarted({
  mode: 'individual',
  plantName: 'Monstera Deliciosa',
  hasCustomPrompt: false
});

// On success
await analyticsService.trackDesignGenerationCompleted({
  mode: 'individual',
  plantName: 'Monstera Deliciosa',
  generationType: 'free',
  duration: 5000 // 5 seconds
});

// On failure
await analyticsService.trackDesignGenerationFailed({
  mode: 'individual',
  error: 'Network timeout'
});
```

### Track Plant Selection

```typescript
await analyticsService.trackPlantSelected({
  mode: 'individual',
  plantId: 'monstera-deliciosa',
  plantName: 'Monstera Deliciosa',
  plantType: 'tropical',
  size: 'medium',
  placement: 'floor'
});
```

### Track Subscription Events

```typescript
// View subscription screen
await analyticsService.trackSubscriptionViewed('paywall');

// Purchase subscription
await analyticsService.trackSubscriptionPurchased({
  productId: 'monthly_subscription',
  type: 'monthly',
  price: 9.99,
  currency: 'USD'
});

// Show paywall
await analyticsService.trackPaywallShown('generation_limit');
```

### Update User Properties

```typescript
await analyticsService.updateSubscriptionStatus({
  isSubscribed: true,
  subscriptionType: 'monthly',
  freeGenerationsRemaining: 0,
  totalDesigns: 15
});
```

### Track Screen Views

```typescript
await analyticsService.logScreenView('Gallery', 'GalleryScreen');
```

## Implementation Status

### ✅ Completed
- Analytics service created
- Firebase Analytics initialized in App.tsx
- Authentication tracking (sign-in, sign-out)
- User ID tracking

### 🚧 In Progress
- Generation screen tracking
- Subscription screen tracking
- Onboarding screen tracking

### 📋 Pending
- Plant selection tracking
- Design actions tracking (save, delete, share, favorite)
- Image capture tracking
- Plant search tracking
- Screen view tracking for all screens

## Testing

### Debug Mode

To enable debug mode for analytics during development:

```bash
# iOS
adb shell setprop debug.firebase.analytics.app <package_name>

# Android
adb shell setprop debug.firebase.analytics.app com.yourapp.package
```

### Viewing Events

1. **Firebase Console**: Events appear in the Firebase Console after 24 hours
2. **DebugView**: Enable debug mode to see events in real-time
3. **BigQuery**: Export to BigQuery for advanced analysis

## Best Practices

1. **Event Naming**: Use lowercase with underscores (e.g., `design_generation_started`)
2. **Parameter Naming**: Use lowercase with underscores (e.g., `plant_type`)
3. **User Privacy**: Never log PII (personally identifiable information)
4. **Event Limits**: Firebase has a limit of 500 distinct events
5. **Parameter Limits**: Each event can have up to 25 parameters
6. **Value Limits**: Parameter values are limited to 100 characters

## Privacy Considerations

- User IDs are anonymized Firebase UIDs
- No email addresses or names are logged in events
- Analytics can be disabled per user if needed (future enhancement)
- Complies with GDPR and CCPA requirements

## Future Enhancements

- [ ] Add custom conversion funnels
- [ ] Track A/B test variants
- [ ] Add crash reporting correlation
- [ ] Implement user cohort analysis
- [ ] Add revenue tracking for IAP
- [ ] Create custom dashboards in Firebase Console
- [ ] Export to Google Analytics 4
