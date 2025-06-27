# Database Models and Migrations

This document describes the Sequelize models and migrations for the monitoring service.

## Models

The following models have been created in `src/models/`:

### Post Model (`post.model.ts`)
- **Table**: `posts`
- **Primary Key**: `id` (CHAR(36))
- **Fields**:
  - `content`: TEXT (required)
  - `author`: VARCHAR(128)
  - `source`: VARCHAR(64)
  - `posted_at`: DATETIME
  - `received_at`: DATETIME (default: CURRENT_TIMESTAMP)
  - `embedding`: JSON
  - `lang`: VARCHAR(8)
- **Relationships**:
  - Belongs to many Categories (through Tagging)
  - Has many Matches

### Category Model (`category.model.ts`)
- **Table**: `categories`
- **Primary Key**: `id` (INT, auto-increment)
- **Fields**:
  - `slug`: VARCHAR(64) (unique)
  - `name`: VARCHAR(128)
- **Relationships**:
  - Belongs to many Posts (through Tagging)

### Tagging Model (`tagging.model.ts`)
- **Table**: `taggings` (join table)
- **Composite Primary Key**: (`post_id`, `category_id`)
- **Fields**:
  - `post_id`: CHAR(36) (foreign key to posts.id)
  - `category_id`: INT (foreign key to categories.id)
- **Relationships**:
  - Belongs to Post
  - Belongs to Category

### Event Model (`event.model.ts`)
- **Table**: `events`
- **Primary Key**: `id` (CHAR(36))
- **Fields**:
  - `title`: TEXT
  - `summary`: TEXT
  - `status`: ENUM('open', 'archived', 'dismissed') (default: 'open')
  - `created_at`: DATETIME (default: CURRENT_TIMESTAMP)
  - `updated_at`: DATETIME (auto-update: CURRENT_TIMESTAMP)
- **Relationships**:
  - Belongs to many Posts (through Match)
  - Has many Matches
  - Has many Drafts

### Match Model (`match.model.ts`)
- **Table**: `matches` (join table)
- **Composite Primary Key**: (`event_id`, `post_id`)
- **Fields**:
  - `event_id`: CHAR(36) (foreign key to events.id)
  - `post_id`: CHAR(36) (foreign key to posts.id)
  - `match_score`: FLOAT
  - `added_by`: VARCHAR(64)
  - `added_at`: DATETIME (default: CURRENT_TIMESTAMP)
- **Relationships**:
  - Belongs to Event
  - Belongs to Post

### Draft Model (`draft.model.ts`)
- **Table**: `drafts`
- **Primary Key**: `id` (CHAR(36))
- **Fields**:
  - `event_id`: CHAR(36) (foreign key to events.id)
  - `content`: TEXT
  - `model_used`: VARCHAR(128)
  - `created_by`: VARCHAR(64)
  - `created_at`: DATETIME (default: CURRENT_TIMESTAMP)
- **Relationships**:
  - Belongs to Event

## Migrations

Migration files are located in the `migrations/` directory:

1. `001-create-posts-table.js` - Creates the posts table
2. `002-create-categories-table.js` - Creates the categories table
3. `003-create-taggings-table.js` - Creates the taggings join table
4. `004-create-events-table.js` - Creates the events table
5. `005-create-matches-table.js` - Creates the matches join table
6. `006-create-drafts-table.js` - Creates the drafts table

## Setup Instructions

### 1. Install Sequelize CLI (if not already installed)
```bash
npm install -g sequelize-cli
```

### 2. Configure Database Connection
Create a `.env` file in the root directory with your database credentials:
```env
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=your_database_name
DB_HOST=localhost
DB_PORT=3306
```

### 3. Run Migrations
```bash
# Run all migrations
npx sequelize-cli db:migrate

# Undo last migration
npx sequelize-cli db:migrate:undo

# Undo all migrations
npx sequelize-cli db:migrate:undo:all
```

### 4. Using Models in NestJS

The models are already registered in the `DalModule`. You can inject them into your services:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Post } from '../models/post.model';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post)
    private postModel: typeof Post,
  ) {}

  async findAll(): Promise<Post[]> {
    return this.postModel.findAll({
      include: ['categories', 'matches'],
    });
  }
}
```

## Example Queries

### Create a Post with Categories
```typescript
const post = await Post.create({
  id: 'uuid-here',
  content: 'Post content',
  author: 'John Doe',
  source: 'twitter',
  posted_at: new Date(),
  lang: 'en',
});

const category = await Category.create({
  slug: 'technology',
  name: 'Technology',
});

await post.$add('categories', category);
```

### Find Posts with Related Data
```typescript
const posts = await Post.findAll({
  include: [
    {
      model: Category,
      through: { attributes: [] }, // Exclude join table attributes
    },
    {
      model: Match,
      include: [Event],
    },
  ],
});
```

### Create an Event with Matched Posts
```typescript
const event = await Event.create({
  id: 'event-uuid',
  title: 'Breaking News',
  summary: 'Important event summary',
  status: 'open',
});

const match = await Match.create({
  event_id: event.id,
  post_id: 'post-uuid',
  match_score: 0.95,
  added_by: 'system',
});
``` 