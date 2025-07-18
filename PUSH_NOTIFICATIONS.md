# Push Notification System

A comprehensive push notification system for iOS news monitoring applications, built with NestJS, Sequelize, and Apple Push Notification service (APNs). The system is integrated into the Core module, combining traditional SSE notifications with push notifications.

## Features

- **Unified Notification Service**: Combines Server-Sent Events (SSE) and Apple Push Notifications in a single service
- **Device Registration**: Register iOS devices with device tokens and user preferences
- **Smart Targeting**: Send notifications based on relevance thresholds and category preferences
- **Read Status Tracking**: Track which posts users have read to avoid duplicate notifications
- **Analytics**: Comprehensive analytics tracking for user engagement and app usage
- **APNs Integration**: Full Apple Push Notification service integration with production and sandbox support
- **Batch Processing**: Efficient batch notification sending with rate limiting
- **Device Management**: Automatic cleanup of stale devices and old read records
- **SSE Broadcasting**: Simultaneously broadcast to web clients via Server-Sent Events

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   iOS App       │───▶│  Device API      │───▶│  Device Service │
│                 │    │  (Core Module)   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
┌─────────────────┐             ▼                        ▼
│   Web Clients   │◀───┌──────────────────┐    ┌─────────────────┐
│   (SSE)         │    │  Notifications   │◀───│  Database       │
└─────────────────┘    │  Service         │    │  (MySQL)        │
                       │  (Core Module)   │    └─────────────────┘
┌─────────────────┐    └──────────────────┘             │
│   APNs          │◀───│  APNs Service    │◀─────────────┘
│   Service       │    │  (Core Module)   │
└─────────────────┘    └──────────────────┘
```

## File Structure

```
src/
├── core/
│   ├── core.module.ts                    # Updated module with push notification services
│   ├── notifications/
│   │   ├── notifications.service.ts      # Enhanced with push notification methods
│   │   ├── notifications.controller.ts   # SSE endpoint controller
│   │   └── push/
│   │       ├── apns.service.ts           # Apple Push Notification service
│   │       ├── device.service.ts         # Device management service
│   │       └── device.controller.ts      # Device API endpoints
│   └── ...
├── dto/
│   └── device.dto.ts                     # Device-related DTOs
├── models/
│   ├── device.model.ts                   # Device database model
│   ├── read-post.model.ts               # Read status tracking model
│   └── analytics.model.ts               # Analytics model
└── ...
```

## API Endpoints

### Device Registration
- **POST** `/devices` - Register a new device or update existing device
- **PUT** `/devices/:deviceToken` - Update device settings (relevance threshold, active status)

### Read Status
- **POST** `/devices/:deviceToken/read` - Mark a post as read for a specific device

### Analytics
- **POST** `/analytics` - Record analytics events for usage tracking

## Database Schema

### Devices Table
- Device token (unique identifier)
- Platform information (iOS/Android)
- Relevance threshold for notifications
- Device information (model, OS version, app version)
- User preferences (categories, quiet hours)
- Registration and last update timestamps

### Read Posts Table
- Device token reference
- Post ID
- Read timestamp
- Unique constraint on (device_token, post_id)

### Analytics Table
- Device token reference
- Event type (app_open, notification_received, post_read, etc.)
- Timestamp
- Platform information
- Metadata (JSON field for additional event data)

## Configuration

### Environment Variables

```env
# APNs Configuration
APNS_TEAM_ID=your_team_id
APNS_KEY_ID=your_key_id
APNS_PRIVATE_KEY=your_private_key_content
APNS_BUNDLE_ID=your_app_bundle_id
APNS_PRODUCTION=false  # Set to true for production

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database
```

### APNs Setup

1. **Generate APNs Key**: Create an APNs key in your Apple Developer account
2. **Configure Environment**: Set the required environment variables
3. **Bundle ID**: Ensure the bundle ID matches your iOS application

## Usage Examples

### Device Registration

```typescript
const deviceData = {
  deviceToken: 'device_token_from_ios',
  platform: 'ios',
  relevanceThreshold: 0.7,
  isActive: true,
  deviceInfo: {
    deviceId: 'device_identifier',
    model: 'iPhone14,2',
    systemVersion: '17.0',
    appVersion: '1.0.0',
    buildNumber: '100',
    bundleId: 'com.yourapp.news',
    timeZone: 'America/New_York',
    language: 'en'
  },
  preferences: {
    categories: ['politics', 'technology', 'sports'],
    quietHours: {
      start: '22:00',
      end: '08:00',
      enabled: true
    }
  },
  registeredAt: new Date().toISOString()
};

// POST /devices
const response = await fetch('/devices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(deviceData)
});
```

### Sending Notifications

```typescript
// When a new post is ingested
const post = {
  id: 'post_uuid',
  title: 'Breaking News: Important Update',
  content: 'Full content of the news article...',
  relevance: 0.85,
  categories: ['politics', 'breaking'],
  url: 'https://example.com/news/123',
  publishedAt: new Date().toISOString()
};

// Automatically send to relevant devices
await notificationService.sendPostNotification(post);
```

### Analytics Tracking

```typescript
const analyticsEvent = {
  deviceToken: 'device_token',
  event: 'post_read',
  timestamp: new Date().toISOString(),
  platform: 'ios',
  postId: 'post_uuid',
  relevance: 0.85,
  categories: ['politics']
};

// POST /analytics
await fetch('/analytics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(analyticsEvent)
});
```

## Integration with Existing Services

The push notification system is now fully integrated into the Core module and works seamlessly with the existing notification system:

### Enhanced NotificationsService

The existing `NotificationsService` has been enhanced with push notification capabilities:

```typescript
// The service now supports both SSE and push notifications
import { NotificationsService } from 'src/core/notifications/notifications.service';

@Injectable()
export class IngestService {
  constructor(
    private readonly notificationsService: NotificationsService,
    // ... other dependencies
  ) {}

  async savePost(post: any): Promise<void> {
    // Save post to database
    const savedPost = await this.postModel.create(post);

    // Send both push notifications AND SSE broadcasts
    await this.notificationsService.sendPostNotification({
      id: savedPost.id,
      title: savedPost.title,
      content: savedPost.content,
      relevance: savedPost.relevance,
      categories: savedPost.categories,
      url: savedPost.url,
      publishedAt: savedPost.publishedAt
    });
    // This automatically sends to:
    // 1. iOS devices via APNs
    // 2. Web clients via SSE broadcast
  }
}
```

### Module Organization

All push notification functionality is now organized under the Core module:

- **Core Module** (`src/core/core.module.ts`)
  - Imports all required models and services
  - Configures Sequelize for push notification tables
  - Exports unified notifications service

- **Notifications Service** (`src/core/notifications/notifications.service.ts`)
  - Enhanced with push notification methods
  - Maintains existing SSE functionality
  - Coordinates between APNs and SSE broadcasting

- **Push Services** (`src/core/notifications/push/`)
  - `apns.service.ts`: Apple Push Notification integration
  - `device.service.ts`: Device management and targeting
  - `device.controller.ts`: REST API endpoints for device management

## Performance Considerations

- **Batch Processing**: Notifications are sent in batches to improve performance
- **Read Status Optimization**: Duplicate notifications are prevented through read status tracking
- **Index Optimization**: Database indexes on device_token, post_id, and timestamp fields
- **Cleanup Jobs**: Automatic cleanup of old read records and inactive devices
- **Rate Limiting**: Built-in rate limiting to respect APNs guidelines

## Monitoring and Analytics

### Available Analytics Events
- `app_open`: When the app is opened
- `notification_received`: When a push notification is received
- `notification_opened`: When a user taps on a notification
- `post_read`: When a user reads a post
- `app_background`: When the app goes to background
- `settings_changed`: When user updates notification preferences

### Cleanup Tasks
- Old read posts are automatically cleaned up after 30 days
- Inactive devices (not updated in 30 days) are automatically deactivated
- Analytics data can be queried for reporting and insights

## Security

- All endpoints are protected with authorization guards
- Device tokens are validated before registration
- APNs connections use secure certificates
- Database connections use encrypted credentials
- Input validation on all DTO classes

## Testing

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
npm run test:e2e
```

### Test Notification
```typescript
// Send test notification to verify setup
await notificationService.sendTestNotification('device_token');
```

## Deployment

1. **Environment Setup**: Configure all required environment variables
2. **Database Migration**: Run the migration to create required tables
3. **APNs Certificates**: Ensure APNs certificates are properly configured
4. **Core Module**: The push notifications are automatically available through the Core module

```bash
# Run migrations
npm run migration:run

# Start the application
npm run start:prod
```

## Benefits of the Merged Architecture

### Unified Notification Strategy
- **Single Service**: One service handles both SSE and push notifications
- **Consistent API**: Same interface for different notification types
- **Coordinated Broadcasting**: Simultaneous delivery to web and mobile clients

### Simplified Module Structure
- **Reduced Complexity**: No separate push notification module to manage
- **Better Organization**: All notification logic centralized in Core module
- **Easier Maintenance**: Single point of configuration and monitoring

### Enhanced Functionality
- **Dual Delivery**: Posts automatically sent via both SSE and push notifications
- **Unified Logging**: All notification activity logged in one place
- **Shared Configuration**: Common environment variables and settings

## Troubleshooting

### Common Issues

1. **Invalid Device Token**: Ensure device tokens are properly formatted and valid
2. **APNs Connection**: Verify APNs credentials and network connectivity
3. **Database Constraints**: Check foreign key relationships and unique constraints
4. **Rate Limiting**: Monitor APNs rate limits and adjust batch sizes if needed

### Logging

The system includes comprehensive logging for:
- Device registrations and updates
- Notification sending operations
- Analytics events
- Error conditions and debugging

Check application logs for detailed information about system operations and any issues.
