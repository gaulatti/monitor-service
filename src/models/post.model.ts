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
import { Category } from './category.model';
import { Tagging } from './tagging.model';
import { Match } from './match.model';

@Table({
  tableName: 'posts',
  timestamps: false,
})
export class Post extends Model<Post> {
  @PrimaryKey
  @Column({
    type: DataType.CHAR(36),
    allowNull: false,
  })
  id: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  content: string;

  @Column({
    type: DataType.STRING(128),
  })
  author: string;

  @Column({
    type: DataType.STRING(64),
  })
  source: string;

  @Column({
    type: DataType.DATE,
  })
  posted_at: Date;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  received_at: Date;

  @Column({
    type: DataType.JSON,
  })
  embedding: any;

  @Column({
    type: DataType.STRING(8),
  })
  lang: string;

  // Relationships
  @BelongsToMany(() => Category, () => Tagging)
  categories: Category[];

  @HasMany(() => Match)
  matches: Match[];
} 