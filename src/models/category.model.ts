import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Unique,
  BelongsToMany,
} from 'sequelize-typescript';
import { Post } from './post.model';
import { Tagging } from './tagging.model';

@Table({
  tableName: 'categories',
  timestamps: false,
})
export class Category extends Model<Category> {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.INTEGER,
  })
  id: number;

  @Unique
  @Column({
    type: DataType.STRING(64),
    allowNull: false,
  })
  slug: string;

  @Column({
    type: DataType.STRING(128),
    allowNull: false,
  })
  name: string;

  // Relationships
  @BelongsToMany(() => Post, () => Tagging)
  posts: Post[];
}
