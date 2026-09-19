# AGENTS.MD - AI Agent Quick Reference

> **Purpose**: This file helps AI agents quickly understand the Planterior AI project architecture without scanning all files. Optimized for agent consumption.

## Project Identity

**Type**: React Native Expo app
**Language**: TypeScript
**Platform**: iOS/Android (currently Expo Go, production will use Expo Dev Client)
**Purpose**: AI-powered interior design with plant placement suggestions

## Core Architecture

### Technology Stack
```
├── React Native (0.81.4) + Expo (~54.0.7)
├── TypeScript (~5.9.2)
├── React Navigation (Stack + Bottom Tabs)
├── SQLite (expo-sqlite) - Local persistence
├── Firebase Auth - User authentication
├── Gemini 2.5 Flash Image Preview - AI generation
└── React Context API - State management
```

### Navigation Structure
```
RootStack (Stack Navigator)
├── Auth Screen (modal) - Google/Apple sign-in
├── MainApp (Tab Navigator)
│   ├── Gallery (home) - Saved designs grid
│   ├── Account - Profile, subscription, settings
│   └── Settings - App preferences
├── Camera (modal) - Photo capture
├── PlantSelection (modal) - Choose plant type/style
├── Generation (modal) - AI generation progress
├── DesignDetail (modal) - Full-screen image view
└── Subscription (modal) - Purchase flow
```

### State Management (Contexts)
```typescript
// src/contexts/
AuthContext         // User auth, skip login for dev
ThemeContext        // Dark/light/system theme
TabBarContext       // Auto-hide tab bar on scroll
SubscriptionContext // Usage limits, subscription status
```

## Critical Data Flows

### 1. Image Generation Flow
```
Camera/Gallery → PlantSelection → Generation → DesignDetail → Gallery
     ↓              ↓                 ↓             ↓            ↓
  Capture       Choose plant      Gemini API    View/Edit     SQLite
  image         type/style        generates     full-screen   database
```

### 2. Subscription Flow
```
User Action → Usage Check → Paywall? → Purchase → Unlock
    ↓             ↓            ↓           ↓          ↓
Generate    Check free    Show if     Mock IAP   Update DB
image       remaining     limit hit   (for now)  subscription
```

### 3. Usage Tracking Flow
```
Generation Request → canGenerateImage() → Track → Update Stats
        ↓                    ↓               ↓          ↓
    User wants        Check subscription  Save to  Refresh UI
    to generate       & free limit        DB       indicators
```

## Database Schema (SQLite)

### Tables Overview
```sql
-- Core tables
saved_designs        -- Generated images and metadata
db_version          -- Migration tracking

-- Subscription system (added in v2)
subscriptions       -- User subscription status
usage_tracking      -- Generation history
free_trial_usage    -- Free generation counts
```

### Key Relationships
```
User (Firebase Auth userId)
  ├── saved_designs (user_id FK)
  ├── subscriptions (user_id UNIQUE)
  ├── usage_tracking (user_id FK)
  └── free_trial_usage (user_id PK)
```

### saved_designs Schema
```typescript
{
  id: INTEGER PRIMARY KEY
  user_id: TEXT                    // Firebase user ID
  original_image_uri: TEXT         // Before AI
  generated_image_uri: TEXT        // After AI
  local_image_path: TEXT           // Cached locally
  mode: 'multi-plant' | 'individual'

  // Multi-plant mode
  plant_type_name: TEXT            // "Succulents"
  plant_type_description: TEXT     // Description
  plant_style_name: TEXT           // "Modern"
  plant_style_description: TEXT    // Style details

  // Individual plant mode
  individual_plant_name: TEXT
  individual_plant_scientific_name: TEXT
  individual_plant_size: 'small' | 'medium' | 'large'
  individual_plant_placement: TEXT

  custom_prompt: TEXT              // User customization
  created_at: INTEGER
  is_favorite: INTEGER (0/1)
}
```

## Service Layer Architecture

### Location: `src/services/`

```typescript
// Database operations
databaseService.ts
  ├── initialize() - Setup DB and run migrations
  ├── runMigrations() - Version-based schema updates
  ├── saveDesign() - Store generated images
  ├── getAllDesigns() - Fetch user's designs
  ├── saveSubscription() - Store subscription data
  ├── getSubscription() - Get user subscription
  ├── trackUsage() - Record generation event
  └── getFreeTrialUsage() - Get usage counts

// AI Generation (backend owns the provider call; the app never holds an AI key)
aiApiService.ts
  ├── generatePlantImage() - Upload + POST /api/v1/generations + poll to completion
  ├── identifyPlant() / identifyDesignPlants() - POST /api/v1/identifications
  ├── Auth: Firebase ID token in Authorization (401 refreshes the token once)
  ├── Auto-retries retryable 429s with exponential backoff (4 attempts: 1s/2s/4s),
  │   reusing the Idempotency-Key so a retry cannot double-spend allowance.
  │   5xx is marked retryable for the UI but is not auto-retried.
  └── AiApiError { code, status, retryable, requestId }

geminiService.ts
  └── Thin compatibility wrapper over aiApiService

aiErrorPresentation.ts
  └── describeAiError(err) -> { kind, title, message, retryLabel, retryable, reference }
      Use this in every screen instead of branching on err.code or err.status.
      `429` is ambiguous (allowance vs throttle) so it classifies by `code` first;
      only `kind === 'allowance'` should open the paywall.

// Usage Enforcement
usageTrackingService.ts
  ├── canGenerateImage() - Check if user can generate
  ├── trackGeneration() - Record after generation
  ├── getFreeGenerationsRemaining() - 0-5 count
  └── getUserUsageStats() - Total/free/paid counts

// Subscription Management (MOCK for now)
subscriptionService.ts
  ├── getAvailableProducts() - Returns mock products
  ├── purchaseSubscription() - Simulates IAP purchase
  ├── getSubscriptionStatus() - Check if active
  └── restorePurchases() - Mock restore flow

// Authentication
firebaseAuthService.ts
  ├── signInWithGoogle()
  └── signOut()
```

## Subscription System Details

### Free Tier Logic
```typescript
// Constants
FREE_GENERATION_LIMIT = 5

// Check before generation
const { canGenerate, reason, freeRemaining } =
  await usageTrackingService.canGenerateImage(userId);

if (!canGenerate) {
  // Show paywall modal
  setShowPaywall(true);
  return;
}

// After successful save
const generationType = subscription.isActive ? 'paid' : 'free';
await usageTrackingService.trackGeneration(userId, generationType);
```

### Mock Products
```typescript
// Monthly: $9.99/month
// Annual: $79.99/year (33% savings)
// Features: Unlimited generations, priority processing, HD exports
```

### Subscription Status Interface
```typescript
interface SubscriptionStatus {
  isActive: boolean           // Has active subscription?
  type: 'monthly' | 'annual' | null
  expiryDate: number | null   // Unix timestamp
  isMock: boolean            // Mock purchase flag
  platform?: 'ios' | 'android'
  purchaseDate?: number
}
```

## Key UI Components

### Location: `src/components/`

```typescript
// Buttons - ALWAYS use this instead of TouchableOpacity for new UI
AppButton.tsx
  - Variants: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'icon' | 'chip'
  - Sizes: 'sm' (44pt) | 'md' (48pt) | 'lg' (54pt)
  - Props: title, onPress, variant, size, icon, iconPosition, iconColor, iconWeight,
           selected, overlay, loading, disabled, elevated, fullWidth, hitSlop,
           style, textStyle, accessibilityLabel, accessibilityHint, testID
  - Guarantees: >=44pt touch target, themed label colour (never raw white - use
    theme.colors.onPrimary), scale(0.98) pressed feedback, accessibilityRole
    "button" + accessibilityState {disabled, busy}
  - `overlay` = always-dark treatment for buttons sitting on photos
  - `hitSlop` defaults to 8 on icon/chip variants

// Overflow / secondary actions
ActionSheet.tsx
  - Props: visible, title, actions[{key,label,icon,destructive,loading,onPress}],
           onDismiss, cancelLabel
  - 56pt rows, destructive rows use theme.colors.destructive

// Usage indicators
UsageIndicator.tsx
  - Props: freeRemaining, isSubscribed, variant, onUpgradePress
  - Variants: 'compact' (for headers) | 'full' (for gallery)
  - Shows: Progress bar, remaining count, upgrade button

// Paywall
PaywallModal.tsx
  - Props: visible, onUpgrade, onDismiss
  - 70% height bottom sheet with blur backdrop
  - Feature list with checkmarks
  - Triggered when user exhausts free generations
```

### Button colour tokens
`theme.colors` includes `onPrimary` (cream in light, `#0d1210` in dark),
`destructive` / `onDestructive` / `destructiveSurface` / `destructiveBorder`,
and `scrim` for modal backdrops. Do not hardcode `white`/`#ffffff` for button
labels.

### DesignDetailScreen dock (3 + overflow)
The full-screen dock shows three primary actions (Favorite, Collect, Share)
plus a "More" action that opens an `ActionSheet` with Details, Save to device
and Delete. Details is also reachable by swiping up on the image.


## Screen Implementation Patterns

### GenerationScreen.tsx Pattern
```typescript
// 1. Check usage on mount
useEffect(() => {
  checkUsageAndStart();
}, []);

const checkUsageAndStart = async () => {
  const { canGenerate } = await usageTrackingService.canGenerateImage(user.id);
  if (!canGenerate) {
    setShowPaywall(true);
    return;
  }
  startGeneration();
};

// 2. Track after successful save
const handleUseResult = async () => {
  await databaseService.saveDesign({ ...design, userId: user.id });

  const subscription = await subscriptionService.getSubscriptionStatus(user.id);
  const type = subscription.isActive ? 'paid' : 'free';
  await usageTrackingService.trackGeneration(user.id, type);

  await refreshStatus(); // Update SubscriptionContext
};
```

### GalleryScreen.tsx Pattern
```typescript
// Display usage prominently
<UsageIndicator
  freeRemaining={freeGenerationsRemaining}
  isSubscribed={subscription?.isActive || false}
  variant="full"
  onUpgradePress={() => navigation.navigate('Subscription')}
/>

// Refresh subscription on pull-to-refresh
const onRefresh = async () => {
  await Promise.all([loadDesigns(), refreshStatus()]);
};
```

### AccountScreen.tsx Pattern
```typescript
// Show subscription status card
{subscription?.isActive ? (
  <PremiumMemberCard
    type={subscription.type}
    expiryDate={subscription.expiryDate}
    onManage={handleManageSubscription}
  />
) : (
  <FreePlanCard
    remaining={freeGenerationsRemaining}
    onUpgrade={handleUpgrade}
  />
)}

// Show usage statistics
<UsageStatsCard
  totalGenerations={usageStats.totalGenerations}
  freeUsed={usageStats.freeUsed}
  paidUsed={usageStats.paidUsed}
/>
```

## Common Development Tasks

### Add New Screen with Subscription Check
1. Add to `RootStackParamList` in App.tsx
2. Create screen component in `src/screens/`
3. Add `useSubscription()` hook if needed
4. Check `canGenerate` before allowing action
5. Track usage after completion
6. Add navigation in App.tsx

### Modify Database Schema
1. Increment `DB_VERSION` in databaseService.ts
2. Add migration function `migrateToV{N}()`
3. Add migration call in `runMigrations()`
4. Test with existing data (migrations are non-destructive)

### Add New Subscription Feature
1. Update `subscriptionService.ts` with new method
2. Update `SubscriptionContext.tsx` to expose method
3. Update UI components to use new method
4. Update database if persistence needed

### Testing Subscription Flows
```typescript
// Available in dev console
global.subHelpers.resetUsage(userId)
global.subHelpers.exhaustFreeGenerations(userId)
global.subHelpers.grantSubscription(userId, 'monthly')
global.subHelpers.testFreeTierFlow(userId)
global.subHelpers.runAllTests(userId)
```

## Important Conventions

### User ID Usage
```typescript
// Always get from AuthContext
const { user } = useAuth();
const userId = user.id;

// Always pass to database operations
await databaseService.saveDesign({ ...design, userId });
await usageTrackingService.canGenerateImage(userId);
```

### Subscription Context Refresh
```typescript
// After any subscription-changing operation
const { refreshStatus } = useSubscription();
await refreshStatus();
```

### Error Handling Pattern
```typescript
try {
  // Operation
  const result = await someOperation();
  if (result.success) {
    // Success path
  } else {
    Alert.alert('Error', result.error);
  }
} catch (error) {
  console.error('Operation failed:', error);
  Alert.alert('Error', 'Something went wrong');
}
```

### Theme Usage
```typescript
const { theme } = useTheme();
const styles = createStyles(theme);

// Theme object structure
theme.colors.primary
theme.colors.background
theme.colors.surface
theme.colors.text
theme.isDark // boolean
```

## File Location Quick Reference

### When you need to...

**Understand database schema**: `src/services/databaseService.ts` (lines 30-130)

**Check usage limits**: `src/services/usageTrackingService.ts` (line 15-50)

**Modify subscription logic**: `src/services/subscriptionService.ts` (entire file)

**Add global state**: `src/contexts/` (create new context or modify existing)

**Create UI component**: `src/components/` (follow existing patterns)

**Add a button**: `src/components/AppButton.tsx` (do not add new `TouchableOpacity` CTAs)

**Add an overflow menu**: `src/components/ActionSheet.tsx`

**Change theme colours**: `src/contexts/ThemeContext.tsx` (light + dark must both be updated)

**Add new screen**: `src/screens/` + update `App.tsx` navigation

**Update types**: `src/types/index.ts` (all TypeScript interfaces)

**Test subscriptions**: `src/utils/testingHelpers.ts` (testing utilities)

**Configure app**: `app.json` (API keys via environment variables)

**Check authentication**: `src/contexts/AuthContext.tsx` (has skip login for dev)

## Migration Path to Production

### Current State: Expo Go + Mock IAP
- Skip authentication available
- Mock subscription purchases
- Works without native builds
- Perfect for UI/UX development

### Production Path: Expo Dev Client + Real IAP
1. Switch to Expo Dev Client
2. Replace mock methods in `subscriptionService.ts` with `expo-iap`
3. Remove `is_mock` checks
4. Implement server-side verification (stubbed in plan)
5. Configure App Store Connect & Google Play Console
6. Remove skip authentication option

### Files to Modify for Production
- `src/services/subscriptionService.ts` - Replace mock with real IAP
- `src/contexts/AuthContext.tsx` - Remove skip login
- `functions/src/verifyPurchase.ts` - Implement server verification (TODO)

## Environment Configuration

### Required Environment Variables (via app.json)
```javascript
{
  "expo": {
    "extra": {
      "googleClientId": "YOUR_GOOGLE_CLIENT_ID",
      "geminiApiKey": "YOUR_GEMINI_API_KEY"
    }
  }
}
```

### Access in Code
```typescript
import Constants from 'expo-constants';
const googleClientId = Constants.expoConfig?.extra?.googleClientId;
const geminiApiKey = Constants.expoConfig?.extra?.geminiApiKey;
```

## Debugging Tips

### Check subscription state
```typescript
const { subscription, freeGenerationsRemaining, usageStats } = useSubscription();
console.log({ subscription, freeGenerationsRemaining, usageStats });
```

### Inspect database directly
```typescript
// In any screen/component
const designs = await databaseService.getAllDesigns(userId);
const subscription = await databaseService.getSubscription(userId);
const usage = await databaseService.getFreeTrialUsage(userId);
```

### Clear all data for user (testing)
```typescript
await databaseService.resetUserUsage(userId);
await databaseService.deleteSubscription(userId);
```

### Check if generation allowed
```typescript
const result = await usageTrackingService.canGenerateImage(userId);
console.log(result);
// { canGenerate: boolean, reason?: string, freeRemaining?: number }
```

## Common Issues & Solutions

### "I get a 429 when generating - is it my subscription?"
Not necessarily. The API returns `429` for **both** exhausted allowance and plain
rate limiting, so the status alone cannot tell you which. Debug it like this:

1. The full `AiApiError` is logged by `GenerationScreen.startGeneration()`
   (`console.error("Generation error:", err)`). Read its `code`, `status`,
   `retryable` and `requestId` from the Metro console.
2. `code` decides: an allowance code means the paywall path; a rate-limit code
   (or an empty code) means throttling.
3. `requestId` identifies the request in backend logs - quote that, not the 429.
4. A bare `429` with no allowance code is treated as a throttle and is retried
   automatically up to 4 times with backoff, so a persistent 429 means the
   throttle outlasted ~7s, or the server sent `retryable: false`.

Do not add a new `err.code === '...'` branch in a screen - extend
`aiErrorPresentation.ts` so every surface stays consistent.

### "User exhausted free generations but can still generate"
- Check if `trackGeneration()` is called after save
- Verify `GenerationScreen.tsx` has usage check on mount
- Inspect `free_trial_usage` table for correct counts

### "Subscription status not updating in UI"
- Call `refreshStatus()` from SubscriptionContext after changes
- Check that SubscriptionProvider wraps entire app
- Verify useEffect dependencies in SubscriptionContext

### "User ID is null/undefined"
- Ensure AuthContext is properly initialized
- Check that user is signed in (or skip login is used)
- Verify AuthProvider wraps entire app tree

### "Database migration failed"
- Check DB_VERSION constant is correct
- Ensure migration functions use IF NOT EXISTS
- Test with fresh install vs. existing data

## Performance Considerations

### Image Caching
- Original and generated images cached locally
- `local_image_path` column stores cache location
- Use `FileSystem.copyAsync()` for cache storage

### Database Queries
- Indexes on `user_id` columns for fast lookups
- Queries filtered by `user_id` for multi-user support
- Use `LIMIT` for paginated loading (future enhancement)

### Context Updates
- SubscriptionContext only refreshes on explicit user actions
- Avoid unnecessary re-renders with `useMemo`/`useCallback`
- Tab bar animation throttled with `scrollEventThrottle={16}`

## Security Notes

### Client-Side (Current Implementation)
- Usage checks happen before API calls (saves Gemini credits)
- Not secure against determined attackers (acceptable for prototype)
- All subscriptions flagged with `is_mock: true`

### Server-Side (Future Implementation)
- Receipt verification with Apple/Google servers
- Cloud function stubs exist in plan
- Required before production launch
- Located in `functions/src/verifyPurchase.ts` (TODO)

## Quick Start for Agents

1. **Read this file first** - Don't scan all files
2. **Check plan file** if it exists: `~/.claude/plans/*.md`
3. **For database changes**: Start with `databaseService.ts`
4. **For UI changes**: Find screen in `src/screens/`
5. **For state management**: Check `src/contexts/`
6. **For business logic**: Check `src/services/`
7. **For types**: Update `src/types/index.ts`
8. **Test changes**: Use `global.subHelpers` in dev console

## Last Updated
Version: 2.0 (Subscription system implemented)
Date: 2026-01-28
Database Version: 2
