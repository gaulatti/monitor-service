import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AllowNull,
  HasMany,
  BelongsToMany,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Post } from './post.model';
import { Match } from './match.model';
import { Draft } from './draft.model';

@Table({
  tableName: 'events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class Event extends Model<Event> {
  @PrimaryKey
  @Column({
    type: DataType.CHAR(36),
    allowNull: false,
  })
  id: string;

  @Column({
    type: DataType.TEXT,
  })
  title: string;

  @Column({
    type: DataType.TEXT,
  })
  summary: string;

  @Column({
    type: DataType.ENUM('open', 'archived', 'dismissed'),
    defaultValue: 'open',
  })
  status: 'open' | 'archived' | 'dismissed';

  @CreatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  created_at: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  updated_at: Date;

  // Relationships
  @BelongsToMany(() => Post, () => Match)
  posts: Post[];

  @HasMany(() => Match)
  matches: Match[];

  @HasMany(() => Draft)
  drafts: Draft[];
} 