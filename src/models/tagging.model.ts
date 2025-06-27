import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Post } from './post.model';
import { Category } from './category.model';

@Table({
  tableName: 'taggings',
  timestamps: false,
})
export class Tagging extends Model<Tagging> {
  @PrimaryKey
  @ForeignKey(() => Post)
  @Column({
    type: DataType.CHAR(36),
    allowNull: false,
  })
  post_id: string;

  @PrimaryKey
  @ForeignKey(() => Category)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  category_id: number;

  // Relationships
  @BelongsTo(() => Post)
  post: Post;

  @BelongsTo(() => Category)
  category: Category;
} 