import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  CreatedAt,
} from 'sequelize-typescript';
import { Event } from './event.model';
import { Post } from './post.model';

@Table({
  tableName: 'matches',
  timestamps: false,
  createdAt: 'added_at',
})
export class Match extends Model<Match> {
  @PrimaryKey
  @ForeignKey(() => Event)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  event_id: number;

  @PrimaryKey
  @ForeignKey(() => Post)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  post_id: number;

  @Column({
    type: DataType.FLOAT,
  })
  match_score: number;

  @Column({
    type: DataType.STRING(64),
  })
  added_by: string;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  added_at: Date;

  // Relationships
  @BelongsTo(() => Event)
  event: Event;

  @BelongsTo(() => Post)
  post: Post;
} 