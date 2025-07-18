import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  AutoIncrement,
  CreatedAt,
} from 'sequelize-typescript';
import { Device } from './device.model';

@Table({
  tableName: 'read_posts',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
})
export class ReadPost extends Model<ReadPost> {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.INTEGER,
  })
  id: number;

  @ForeignKey(() => Device)
  @AllowNull(false)
  @Column({
    type: DataType.STRING(255),
  })
  deviceToken: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(255),
  })
  postId: string;

  @AllowNull(false)
  @Column({
    type: DataType.DATE,
  })
  readAt: Date;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  createdAt: Date;

  // Relationships
  @BelongsTo(() => Device, 'deviceToken')
  device: Device;
}
