import {
  AllowNull,
  BelongsToMany,
  Column,
  DataType,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  AutoIncrement,
} from 'sequelize-typescript';
import { Category } from './category.model';
import { Match } from './match.model';
import { Tagging } from './tagging.model';

@Table({
  tableName: 'posts',
  timestamps: false,
})
export class Post extends Model<Post> {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.INTEGER,
  })
  id: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
  })
  uuid: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  source_id: string;

  @Column({
    type: DataType.STRING(64),
    allowNull: false,
  })
  source: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  uri: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  content: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  createdAt: Date;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  relevance: number;

  @Column({
    type: DataType.STRING(8),
  })
  lang: string;

  @Column({
    type: DataType.STRING(255),
  })
  author_id: string;

  @Column({
    type: DataType.STRING(255),
  })
  author_name: string;

  @Column({
    type: DataType.STRING(255),
  })
  author_handle: string;

  @Column({
    type: DataType.STRING(500),
  })
  author_avatar: string;

  @Column({
    type: DataType.JSON,
  })
  media: any;

  @Column({
    type: DataType.STRING(500),
  })
  linkPreview: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  original: string;

  // Legacy fields for backward compatibility
  @Column({
    type: DataType.STRING(128),
  })
  author: string;

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

  // Relationships
  @BelongsToMany(() => Category, () => Tagging)
  categories_relation: Category[];

  @HasMany(() => Match)
  matches: Match[];
}
